/**
 * Motor düğme kataloğu (M5a, docs/M5A-SPEC.md §2.10). Kimlik biçimi
 * `<modül>.<alan>[.<alt>]`; motor düzeyi `engine.*`, baypas kanalı
 * `bypassDuct.*`. Modül tipi grafikte tekil olduğu için adres dizi sırasına
 * bağlı değil. Kimlikler belgeye yazılır: ASLA yeniden adlandırılmaz
 * (gerekirse KNOB_ALIASES).
 *
 * Aralıklar yalnız türetilmiş tipe (`ctx.traits`) bakar: aynı düğme
 * çıplak turbojette ve kaportalı turbofanda farklı aralık taşır. `range`
 * null ise düğme o motorda yoktur; `get` undefined ise (ör. düz
 * karıştırıcıda lobe sayısı) panel düğmeyi göstermez.
 *
 * Log ölçekli düğmede (`scale: 'log'`, hava akışı) `step` görece adımdır
 * (0,01 = %1).
 */

import { DesignError } from '../sim/design';
import type { Architecture } from './architecture';
import type { Family } from './core/family';
import { clampKnob, getPath, setPath, type KnobDef, type KnobValue, type Unit } from './core/knob';
import { TURBOSHAFT_MIN_INLET } from './flowpath';
import { buildEngine, type BuildOptions, type BuiltEngine } from './graph';
import { diffSummary, summarize, type DesignSummary, type SummaryDelta } from './summary';
import { TECH_MODERN, type TechLimits } from './tech';
import { deriveTraits, type EngineTraits } from './traits';
import type { EngineGraph, EngineModule } from './types';
import { translateError, type TeachingError } from './warnings';

export interface KnobCtx {
  arch: Architecture;
  traits: EngineTraits;
  tech: TechLimits;
  family?: Family<EngineGraph, Architecture>;
}

/**
 * Mimarisiz bağlam: aralıklar, kırpma ve tutamaç seçimi yalnız bunu okur
 * (`traits`). `knobCtx(g)` mimari verilmeden bunu döndürür; böylece `arch`
 * okumaya çalışan tüketici derlemede yakalanır. KnobCtx buna atanabilir.
 */
export type KnobRangeCtx = Omit<KnobCtx, 'arch'>;

/** Düğme tanımı; `range` mimarisiz bağlam alır, KnobDef<EngineGraph, KnobCtx>'e atanabilir */
export type EngineKnob = KnobDef<EngineGraph, KnobRangeCtx>;

/** Ortak kanal düğmeleri (kompresör ve türbin sıraları) */
const annulus = <M extends string>(m: M) =>
  [
    `${m}.eff`,
    `${m}.mach.0`,
    `${m}.mach.1`,
    `${m}.hubTip`,
    `${m}.taper`,
    `${m}.loading`,
    `${m}.pitchSpan`,
    `${m}.bladeK.0`,
    `${m}.bladeK.1`,
  ] as const;

/** Bütün düğme kimlikleri: temel (B) ve uzman (E) tabloları */
export const KNOB_IDS = [
  // Temel
  'engine.massFlow',
  'fan.pr',
  'fan.bypassRatio',
  'fan.tipSpeed',
  'lpc.pr',
  'lpc.tipSpeed',
  'hpc.pr',
  'hpc.centrifugal.workFraction',
  'combustor.tit',
  'combustor.cans',
  'mixer.lobes',
  'afterburner.t7Max',
  'nozzle.chevrons.core',
  'nozzle.chevrons.bypass',
  'propeller.diameter',
  'propeller.blades',
  'propeller.rpm',
  'shaft.rpm',
  // Uzman: motor
  'engine.accessoryPower',
  'engine.mechEff',
  'bypassDuct.dp',
  'bypassDuct.mach',
  // Giriş
  'inlet.length',
  'inlet.noseLength',
  'inlet.struts',
  // Kompresörler (fan.hubTip M5a'da gizli: model fan göbeğini göstermez)
  ...annulus('fan'),
  'fan.hubPRFraction',
  ...annulus('lpc'),
  'lpc.gap',
  'lpc.vsv',
  ...annulus('hpc'),
  'hpc.gap',
  'hpc.vsv',
  'hpc.tipSpeed',
  'hpc.centrifugal.loading',
  'hpc.centrifugal.diffuserRatio',
  'hpc.centrifugal.gap',
  // Yanma odası
  'combustor.refVelocity',
  'combustor.lengthHeight',
  'combustor.dp',
  'combustor.eff',
  'combustor.injectors',
  'combustor.meanShift',
  'combustor.gap',
  // Türbinler
  ...annulus('hpt'),
  'hpt.gap',
  ...annulus('lpt'),
  'lpt.gap',
  'lpt.tipSpeed',
  // Karıştırıcı, art yakıcı, lüle
  'mixer.loss',
  'afterburner.mach',
  'afterburner.lengthDiameter',
  'afterburner.eta',
  'afterburner.dpDry',
  'afterburner.dpLit',
  'nozzle.cv',
  'nozzle.flaps',
  'nozzle.exitMach',
  'nozzle.pressureRatio',
  // Pervane ve çıkış mili
  'propeller.figureOfMerit',
  'propeller.efficiency',
  'propeller.gearboxLength',
  'shaft.transmissionEff',
  'shaft.gearboxLength',
] as const;

export type KnobId = (typeof KNOB_IDS)[number];

/* ------------------------------------------------------------------ */
/* Aralıklar                                                           */
/* ------------------------------------------------------------------ */

type Range = [number, number];
type RangeFn = (t: EngineTraits) => Range | null;

/** Koşullu aralık: koşul tutmazsa düğme bu motorda yok */
const when =
  (cond: (t: EngineTraits) => boolean, r: Range | ((t: EngineTraits) => Range)): RangeFn =>
  (t) =>
    cond(t) ? (typeof r === 'function' ? r(t) : r) : null;
const always = (r: Range): RangeFn => () => r;

const hasFan = (t: EngineTraits) => t.lpLoad === 'fan';
/** LPC modülü var: tek akışlı motorun ön kompresörü ya da turbofanın booster'ı */
const hasLpc = (t: EngineTraits) => t.lpLoad === 'lpc' || t.booster;
const freeTurbine = (t: EngineTraits) => t.lpLoad === 'propeller' || t.lpLoad === 'shaft';
/** Kaportalı karışık akışlı turbofan (TFM) */
const mixedNacelle = (t: EngineTraits) => t.layout === 'nacelle' && t.exhaust === 'mixed';

/** Hava akışı aralığı aileye göre (çap ≤ 4 m, boy ≤ 9 m: hücreye sığar) */
function massFlowRange(t: EngineTraits): Range {
  switch (t.presentation) {
    case 'turboprop':
      return [3, 30];
    case 'turboshaft':
      return [1.5, 15];
    case 'militaryTurbofan':
      return [30, 250];
    case 'turbofan':
      return t.exhaust === 'mixed' ? [50, 600] : [150, 1500];
    default:
      return [10, 200];
  }
}

/**
 * HPC basınç oranı aileye göre (bulanık testle daraltıldı, §2.10): tek
 * akışlı iki milli jette HPC kısa (J57 HPC ~3), düşük baypaslıda orta
 * (F100 ~8), kaportalı turbofanda uzun (CFM56 ~11–17); serbest türbinli
 * gaz jeneratöründe toplam.
 */
function hpcPrRange(t: EngineTraits): Range {
  if (freeTurbine(t)) return [6, 20];
  if (t.lpLoad === 'lpc') return [2, 6];
  return t.layout === 'nacelle' ? [8, 25] : [4, 12];
}

/**
 * T4 aralığı aileye göre; üst sınır M5a'da 1900 K (soğutma havası modeli
 * yok). Alt sınır: yüksek baypaslı fanı çevirecek çekirdek enerjisi
 * (altında P5 ≤ P0), küçük gaz jeneratöründe HPT çıkış kanalı.
 */
function titRange(t: EngineTraits): Range {
  if (freeTurbine(t)) return [1150, 1750];
  if (t.lpLoad === 'lpc') return [1050, 1650];
  if (t.layout === 'nacelle') return t.exhaust === 'mixed' ? [1400, 1900] : [1500, 1900];
  return [1300, 1900];
}
/* ------------------------------------------------------------------ */
/* Tanımlar                                                            */
/* ------------------------------------------------------------------ */

interface KnobSpec {
  label: string;
  explain: string;
  unit: Unit;
  type?: 'number' | 'int';
  range: RangeFn;
  step: number;
  scale?: 'lin' | 'log';
  display?: EngineKnob['display'];
  level?: 'basic' | 'expert';
  scope?: 'family' | 'variant';
  preview?: 'exact' | 'approx' | 'none';
  glossary?: string;
  lesson?: string;
  techLimit?: string;
  /** Yol (varsayılan: kimlikten, sayısal parçalar dizin) */
  path?: (string | number)[];
  get?(g: EngineGraph): KnobValue | undefined;
  set?(g: EngineGraph, v: KnobValue): EngineGraph;
  /** Aralık içindeki ek kısıt (ör. chevron: 0 ya da 8–24) */
  snap?(v: number): number;
}

const basic = (s: KnobSpec): KnobSpec => ({ level: 'basic', ...s });

const MODULE_LABEL: Record<'fan' | 'lpc' | 'hpc' | 'hpt' | 'lpt', string> = {
  fan: 'Fan',
  lpc: 'LPC',
  hpc: 'HPC',
  hpt: 'HPT',
  lpt: 'LPT',
};

/** Kanal düğmesi kimlikleri */
type AnnulusId<M extends string> = `${M}.${'eff' | 'mach.0' | 'mach.1' | 'hubTip' | 'taper' | 'loading' | 'pitchSpan' | 'bladeK.0' | 'bladeK.1'}`;

/** Kompresör sırası kanal düğmeleri */
function compressorAnnulus<M extends 'fan' | 'lpc' | 'hpc'>(m: M, cond: (t: EngineTraits) => boolean): Record<AnnulusId<M>, KnobSpec> {
  const L = MODULE_LABEL[m];
  const mach0: Range = m === 'hpc' ? [0.2, 0.6] : [0.35, 0.7];
  return {
    [`${m}.eff`]: {
      label: `${L} verimi`,
      explain: 'İzentropik verim: düşükse aynı basınç oranı daha çok iş ister ve havayı daha çok ısıtır.',
      unit: '',
      range: when(cond, [0.8, 0.94]),
      step: 0.005,
      preview: 'none',
    },
    [`${m}.mach.0`]: {
      label: `${L} giriş Mach'ı`,
      explain: "Girişte eksenel Mach: yüksekse kanal daralır (küçük çap) ama uç bağıl Mach'ı ve kayıp artar.",
      unit: '',
      range: when(cond, mach0),
      step: 0.005,
      glossary: 'tipMach',
    },
    [`${m}.mach.1`]: {
      label: `${L} çıkış Mach'ı`,
      explain: 'Çıkışta eksenel Mach: düşükse son kanatlar uzun, yüksekse kısa ve verimsiz olur.',
      unit: '',
      range: when(cond, [0.1, 0.5]),
      step: 0.005,
    },
    [`${m}.hubTip`]: {
      label: `${L} göbek/uç oranı`,
      explain: 'Giriş göbeğinin uç yarıçapına oranı: küçükse aynı alan daha küçük çapa sığar ama göbekte iş zorlaşır.',
      unit: '',
      // Fan göbeği modelde gösterilmiyor (M5b): fan.hubTip M5a'da gizli
      range: m === 'fan' ? () => null : when(cond, [0.25, 0.85]),
      step: 0.005,
      preview: m === 'fan' ? 'approx' : 'exact',
    },
    [`${m}.taper`]: {
      label: `${L} uç daralması`,
      explain: 'Çıkış uç yarıçapı / giriş uç yarıçapı: daralan uç sabit ortalama yarıçapa yaklaştırır.',
      unit: '',
      range: when(cond, [0.8, 1.05]),
      step: 0.005,
    },
    [`${m}.loading`]: {
      label: `${L} kademe yüklemesi ψ`,
      explain: 'Kademe başına iş / U²: yüksek ψ daha az kademe demek, ama kanatlar ayrılmaya (surge) yaklaşır.',
      unit: '',
      range: m === 'lpc' ? when(cond, (t) => (t.booster ? [0.2, 1.2] : [0.2, 1.0])) : when(cond, [0.2, 1.0]),
      step: 0.005,
      glossary: 'stageLoading',
      lesson: 'surge',
    },
    [`${m}.pitchSpan`]: {
      label: `${L} kademe aralığı`,
      explain: 'Kademe aralığı / kanat boyu: modülün eksenel boyunu belirler.',
      unit: '',
      range: when(cond, [0.4, 2.5]),
      step: 0.01,
    },
    [`${m}.bladeK.0`]: {
      label: `${L} kanat sayısı katsayısı (ilk)`,
      explain: 'Katılık × en-boy oranı: ilk kademedeki kanat sayısını belirler.',
      unit: '',
      range: when(cond, [0.8, 4.5]),
      step: 0.01,
    },
    [`${m}.bladeK.1`]: {
      label: `${L} kanat sayısı katsayısı (son)`,
      explain: 'Katılık × en-boy oranı: son kademedeki kanat sayısını belirler.',
      unit: '',
      range: when(cond, [0.8, 4.5]),
      step: 0.01,
    },
  } as Record<AnnulusId<M>, KnobSpec>;
}

/** Türbin sırası kanal düğmeleri */
function turbineAnnulus<M extends 'hpt' | 'lpt'>(m: M): Record<AnnulusId<M>, KnobSpec> {
  const L = MODULE_LABEL[m];
  const all = () => true;
  return {
    [`${m}.eff`]: {
      label: `${L} verimi`,
      explain: 'İzentropik verim: düşükse aynı işi çıkarmak için gaz daha çok genişler, lüleye az basınç kalır.',
      unit: '',
      range: when(all, [0.82, 0.94]),
      step: 0.005,
      preview: 'none',
    },
    [`${m}.mach.0`]: {
      label: `${L} giriş Mach'ı`,
      explain: 'Girişte eksenel Mach: düşükse halka geniş ve ağır, yüksekse kayıp artar.',
      unit: '',
      range: when(all, [0.04, 0.35]),
      step: 0.005,
    },
    [`${m}.mach.1`]: {
      label: `${L} çıkış Mach'ı`,
      explain: 'Çıkışta eksenel Mach: artırınca kanat kısalır, AN² (disk gerilmesi) azalır.',
      unit: '',
      range: when(all, [0.15, 0.55]),
      step: 0.005,
      glossary: 'an2',
    },
    [`${m}.hubTip`]: {
      label: `${L} göbek/uç oranı`,
      explain: 'Göbek yarıçapı / uç yarıçapı: büyükse kanat kısa, halka ince olur.',
      unit: '',
      range: when(all, [0.5, 0.92]),
      step: 0.005,
    },
    [`${m}.taper`]: {
      label: `${L} uç açılması`,
      explain: 'Çıkış uç yarıçapı / giriş uç yarıçapı: genişleyen gaza yer açar.',
      unit: '',
      range: when(all, [0.9, 1.3]),
      step: 0.005,
    },
    [`${m}.loading`]: {
      label: `${L} kademe yüklemesi ψ`,
      explain: 'Kademe başına iş / U²: türbinde 1–2,5; yüksekse kademe azalır, verim düşer.',
      unit: '',
      range: when(all, [0.8, 3.5]),
      step: 0.01,
      glossary: 'stageLoading',
    },
    [`${m}.pitchSpan`]: {
      label: `${L} kademe aralığı`,
      explain: 'Kademe aralığı / kanat boyu: modülün eksenel boyunu belirler.',
      unit: '',
      range: when(all, [0.4, 2.5]),
      step: 0.01,
    },
    [`${m}.bladeK.0`]: {
      label: `${L} kanat sayısı katsayısı (ilk)`,
      explain: 'Katılık × en-boy oranı: ilk kademedeki kanat sayısını belirler.',
      unit: '',
      range: when(all, [0.8, 7]),
      step: 0.01,
    },
    [`${m}.bladeK.1`]: {
      label: `${L} kanat sayısı katsayısı (son)`,
      explain: 'Katılık × en-boy oranı: son kademedeki kanat sayısını belirler.',
      unit: '',
      range: when(all, [0.8, 7]),
      step: 0.01,
    },
  } as Record<AnnulusId<M>, KnobSpec>;
}

const gapSpec = (m: string, cond: (t: EngineTraits) => boolean): KnobSpec => ({
  label: `${m} öncesi aralık`,
  explain: 'Önceki modülün son rotorundan bu modülün ilk rotoruna aralık (kademe aralığı cinsinden).',
  unit: '',
  range: when(cond, [0.5, 3]),
  step: 0.01,
});

const vsvSpec = (m: string, cond: (t: EngineTraits) => boolean): KnobSpec => ({
  label: `${m} değişken stator sırası`,
  explain: 'Ön stator sıralarından kaçı dönebilir: düşük devirde surge payını korur (dış donanımda VSV halkaları).',
  unit: 'adet',
  type: 'int',
  range: when(cond, [0, 6]),
  step: 1,
  lesson: 'surge',
});

/** Chevron: 0 (düz kenar) ya da 8–24 */
const chevronSnap = (v: number) => (v <= 0 ? 0 : v < 8 ? (v < 4 ? 0 : 8) : Math.round(v / 2) * 2);

const SPECS: Record<KnobId, KnobSpec> = {
  // --- Temel ---
  'engine.massFlow': basic({
    label: 'Hava akışı',
    explain: 'Motorun yuttuğu hava: itki onunla, çap karekökü ile büyür.',
    unit: 'kg/s',
    range: massFlowRange,
    step: 0.01,
    scale: 'log',
    path: ['engine', 'massFlow'],
  }),
  'fan.pr': basic({
    label: 'Fan basınç oranı',
    explain: "Baypas jetini hızlandırır; LPT'den daha çok iş ister.",
    unit: '',
    // TFM 1,4–2,0 (dalga 2 bulanık testi): FPR > 2'de yüksek BPR'de LPT çekirdek
    // lülesine basınç bırakmıyor ve ortak lüle ağzı çözülmüyor (P6 ölçümü);
    // gerçek kaportalı karışık TF'ler 1,5–1,9 (JT8D-200, TFE731, CFM56-5C)
    range: when(hasFan, (t) => (t.layout !== 'nacelle' ? [1.8, 4.5] : mixedNacelle(t) ? [1.4, 2] : [1.4, 1.8])),
    step: 0.01,
    scope: 'variant',
  }),
  'fan.bypassRatio': basic({
    label: 'Baypas oranı',
    explain: 'Çekirdeğin yanından geçen hava: TSFC düşer, çap ve LPT büyür.',
    unit: '',
    // TFM 2,5–7: BPR < 2,5'te LPT ucu uzun kanallı kaportanın fan kanalı
    // duvarına dayanıyor (`bypassDuct.closed`, kaporta payları daraltılsa da);
    // Tay 3,0, BR710 4,2, CFM56-5C 6,6 içeride, JT8D-200 (1,74) dışarıda
    range: when(hasFan, (t) => (t.layout !== 'nacelle' ? [0.1, 1.5] : mixedNacelle(t) ? [2.5, 7] : [3, 11])),
    step: 0.05,
    scope: 'variant',
    glossary: 'bpr',
    lesson: 'anatomy',
  }),
  'fan.tipSpeed': basic({
    label: 'Fan uç hızı',
    explain: 'Hızlı fan daha az LPT kademesi ister ama uçta şok yapar.',
    unit: 'm/s',
    range: when(hasFan, [300, 560]),
    step: 1,
    glossary: 'tipMach',
    lesson: 'birdstrike',
  }),
  'lpc.pr': basic({
    label: 'LPC / booster basınç oranı',
    explain: 'Alçak basınç kompresörü: çekirdeğe giren havayı HPC öncesi sıkıştırır.',
    unit: '',
    range: (t) => (t.lpLoad === 'lpc' ? [2.2, 5] : t.booster ? [1.1, 2.5] : null),
    step: 0.01,
    scope: 'variant',
    glossary: 'opr',
  }),
  'lpc.tipSpeed': basic({
    label: 'LPC uç hızı',
    explain: 'LP milinin devrini belirler: hızlı uç daha az kademe ister ama uç bağıl Mach artar.',
    unit: 'm/s',
    range: when((t) => t.lpLoad === 'lpc', [300, 520]),
    step: 1,
    glossary: 'tipMach',
  }),
  'hpc.pr': basic({
    label: 'HPC basınç oranı',
    explain: 'OPR artar → TSFC düşer; kademe, T3 ve kütle artar.',
    unit: '',
    range: hpcPrRange,
    step: 0.1,
    scope: 'variant',
    glossary: 'opr',
    lesson: 'brayton',
  }),
  'hpc.centrifugal.workFraction': basic({
    label: 'Santrifüj iş payı',
    explain: 'İşin ne kadarını çark yapar: eksenel kademe azalır, çap büyür.',
    unit: '%',
    range: when((t) => t.centrifugal, [0.2, 0.8]),
    step: 0.01,
    display: { unit: '%', factor: 100, digits: 0 },
  }),
  'combustor.tit': basic({
    label: 'T4 (türbin giriş sıcaklığı)',
    explain: 'Sıcak türbin girişi: itki artar; EGT payı ve kanat ömrü azalır.',
    unit: 'K',
    range: titRange,
    step: 5,
    scope: 'variant',
    preview: 'exact',
    glossary: 'tit',
    lesson: 'brayton',
    techLimit: 't4',
  }),
  'combustor.cans': basic({
    label: 'Kutu sayısı',
    explain: 'Kutu ve kutu-halka yanma odasında alev borusu sayısı: az kutu daha büyük çap ister.',
    unit: 'adet',
    type: 'int',
    // Grafik kuralı 6–16; bulanık testte (kuru turbojet) 11+ kutu çoğu
    // kümede çevreye sığmadı (J57 8, JT8D 9, J79 10 kutu): kaydırıcı 6–10
    range: when((t) => t.combustor !== 'annular', [6, 10]),
    step: 1,
  }),
  'mixer.lobes': basic({
    label: 'Lobe sayısı',
    explain: "Lobe'lu karıştırıcının çiçek yaprakları: çok lobe akışları daha iyi karıştırır, sürtünme artar.",
    unit: 'adet',
    type: 'int',
    // Düz karıştırıcıda lobe yok (get undefined → panelde görünmez)
    range: when((t) => t.exhaust === 'mixed', [6, 24]),
    step: 1,
    glossary: 'mixer',
  }),
  'afterburner.t7Max': basic({
    label: 'Art yakıcı T7',
    explain: 'Tam art yakıcıda jet borusu sıcaklığı: itki artar, yakıt akışı katlanır.',
    unit: 'K',
    range: when((t) => t.afterburner, [1600, 2200]),
    step: 10,
    scope: 'variant',
    preview: 'none',
  }),
  'nozzle.chevrons.core': basic({
    label: 'Çekirdek lülesi chevron',
    explain: "Her chevron'lu lüle itkiden %0,25 alır, jet sesini azaltır (dB M5c).",
    unit: 'adet',
    type: 'int',
    range: when((t) => t.nozzle === 'separate', [0, 24]),
    step: 2,
    glossary: 'chevron',
    snap: chevronSnap,
  }),
  'nozzle.chevrons.bypass': basic({
    label: 'Baypas lülesi chevron',
    explain: "Her chevron'lu lüle itkiden %0,25 alır, jet sesini azaltır (dB M5c).",
    unit: 'adet',
    type: 'int',
    range: when((t) => t.nozzle === 'separate', [0, 24]),
    step: 2,
    glossary: 'chevron',
    snap: chevronSnap,
  }),
  'propeller.diameter': basic({
    label: 'Pervane çapı',
    explain: 'Büyük pervane aynı güçle daha çok havayı yavaş iter: kalkış itkisi artar, uç hızı da.',
    unit: 'm',
    range: when((t) => t.lpLoad === 'propeller', [1.5, 5]),
    step: 0.01,
    lesson: 'altitude',
  }),
  'propeller.blades': basic({
    label: 'Pal sayısı',
    explain: 'Çok pal aynı çapta daha çok güç emer; ağırlık ve ses frekansı değişir.',
    unit: 'adet',
    type: 'int',
    range: when((t) => t.lpLoad === 'propeller', [2, 8]),
    step: 1,
  }),
  'propeller.rpm': basic({
    label: 'Pervane devri',
    explain: 'Redüktör oranını belirler: hızlı pervanenin ucu ses hızına yaklaşır.',
    unit: 'rpm',
    range: when((t) => t.lpLoad === 'propeller', [900, 2000]),
    step: 10,
    scope: 'variant',
    glossary: 'tipMach',
  }),
  'shaft.rpm': basic({
    label: 'Çıkış devri',
    explain:
      'Yalnız redüktör oranını değiştirir; güç türbini devri uç hızından gelir. Güç türbini devrinin %5 yakınında redüktör yok: çıkış mili güç türbini devrinde döner.',
    unit: 'rpm',
    range: when((t) => t.lpLoad === 'shaft', [3000, 30000]),
    step: 50,
    glossary: 'shaftPower',
  }),

  // --- Uzman: motor ---
  'engine.accessoryPower': {
    label: 'Aksesuar gücü',
    explain: 'HP milinden alınan güç (jeneratör, pompalar): HPT daha çok iş çıkarır, lüleye az basınç kalır.',
    unit: 'W',
    range: always([0, 600e3]),
    step: 1e3,
    display: { unit: 'kW', factor: 1e-3, digits: 0 },
    preview: 'none',
    glossary: 'bleed',
    path: ['engine', 'accessoryPower'],
    // Düzeltme ops'a yazılır (operability.ts resolveAccessoryPower); yoksa taban değer
    get: (g) => g.ops?.accessoryPower ?? g.accessoryPower,
    set: (g, v) => ({ ...g, ops: { ...g.ops, accessoryPower: Number(v) } }),
  },
  'engine.mechEff': {
    label: 'Mekanik verim',
    explain: 'Yatak ve dişli kayıpları: düşükse türbin aynı kompresör için daha çok iş çıkarır.',
    unit: '',
    range: always([0.97, 0.995]),
    step: 0.001,
    preview: 'none',
    path: ['engine', 'mechEff'],
  },
  'bypassDuct.dp': {
    label: 'Baypas kanalı basınç kaybı',
    explain: 'Kanal sürtünmesi: baypas jetinin basıncını ve itkisini azaltır.',
    unit: '',
    range: when((t) => t.bypass, [0.005, 0.05]),
    step: 0.001,
    preview: 'none',
  },
  'bypassDuct.mach': {
    label: "Baypas kanalı Mach'ı",
    explain: 'Kanal eksenel Mach: yüksekse kanal dar (ince gövde), kayıp büyür.',
    unit: '',
    range: when((t) => t.bypass, [0.1, 0.55]),
    step: 0.005,
  },

  // --- Giriş ---
  'inlet.length': {
    label: 'Giriş boyu',
    explain: 'Giriş düzleminden ilk rotora mesafe (ilk kademe uç yarıçapı cinsinden).',
    unit: '',
    // Turboşaftın halka girişi en az TURBOSHAFT_MIN_INLET (çerçeve sığar):
    // altındaki değerler geometriyi değiştirmez, aralık oradan başlar
    range: (t) => [t.lpLoad === 'shaft' ? TURBOSHAFT_MIN_INLET : 0, 2],
    step: 0.01,
  },
  'inlet.noseLength': {
    label: 'Burun konisi boyu',
    explain: 'Burun konisi boyu (ilk kademe uç yarıçapı cinsinden).',
    unit: '',
    range: always([0, 1.2]),
    step: 0.01,
  },
  'inlet.struts': {
    label: 'Ön çerçeve dikmeleri',
    explain: 'Girişteki taşıyıcı dikme sayısı (0: yok).',
    unit: 'adet',
    type: 'int',
    range: always([0, 12]),
    step: 1,
  },

  // --- Kompresörler ---
  ...compressorAnnulus('fan', hasFan),
  'fan.hubPRFraction': {
    label: 'Fan göbek basınç payı',
    explain: 'Fan göbeği (çekirdeğe giden hava) uca göre daha az sıkıştırır: booster farkı kapatır.',
    unit: '',
    range: when(hasFan, [0.6, 1]),
    step: 0.01,
    preview: 'none',
  },
  ...compressorAnnulus('lpc', hasLpc),
  'lpc.gap': gapSpec('LPC', (t) => t.booster),
  'lpc.vsv': vsvSpec('LPC', hasLpc),
  ...compressorAnnulus('hpc', () => true),
  'hpc.gap': gapSpec('HPC', (t) => t.lpLoad === 'lpc' || t.lpLoad === 'fan'),
  'hpc.vsv': vsvSpec('HPC', () => true),
  'hpc.tipSpeed': {
    label: 'HPC uç hızı',
    explain: "HP milinin devrini belirler: hızlı uç daha az kademe ister ama ilk kademe uç Mach'ı artar.",
    unit: 'm/s',
    range: always([350, 650]),
    step: 1,
    glossary: 'tipMach',
  },
  'hpc.centrifugal.loading': {
    label: 'Çark yüklemesi',
    explain: 'Çark işi / uç hızı²: yüksekse aynı iş daha küçük çarkla yapılır.',
    unit: '',
    range: when((t) => t.centrifugal, [0.55, 0.85]),
    step: 0.005,
  },
  'hpc.centrifugal.diffuserRatio': {
    label: 'Difüzör oranı',
    explain: 'Difüzör çıkış yarıçapı / çark ucu: motorun en geniş yeri.',
    unit: '',
    range: when((t) => t.centrifugal, [1.3, 2.0]),
    step: 0.01,
  },
  'hpc.centrifugal.gap': {
    label: 'Çark aralığı',
    explain: 'Son eksenel rotordan çark eksenine aralık (kademe aralığı cinsinden).',
    unit: '',
    range: when((t) => t.centrifugal, [0.5, 2]),
    step: 0.01,
  },

  // --- Yanma odası ---
  'combustor.refVelocity': {
    label: 'Referans hızı',
    explain: 'Alev borusu kesitine göre ortalama hız: düşükse oda büyük ve ağır, yüksekse alev söner.',
    unit: 'm/s',
    range: always([5, 60]),
    step: 0.1,
    glossary: 'refVelocity',
    lesson: 'start',
  },
  'combustor.lengthHeight': {
    label: 'Boy / yükseklik',
    explain: 'Oda boyu / halka yüksekliği (kutuda kutu çapı): yanma için kalma süresi.',
    unit: '',
    range: always([1.5, 8]),
    step: 0.01,
  },
  'combustor.dp': {
    label: 'Yanma odası basınç kaybı',
    explain: 'Karışım için harcanan basınç: artınca türbine ve lüleye az basınç kalır.',
    unit: '',
    range: always([0.02, 0.08]),
    step: 0.001,
    preview: 'none',
  },
  'combustor.eff': {
    label: 'Yanma verimi',
    explain: 'Yakıtın ne kadarı tam yanar: düşükse aynı T4 için daha çok yakıt.',
    unit: '',
    range: always([0.97, 0.999]),
    step: 0.001,
    preview: 'none',
  },
  'combustor.injectors': {
    label: 'Enjektör sayısı',
    explain: 'Halka yanma odasında yakıt püskürtücü sayısı.',
    unit: 'adet',
    type: 'int',
    range: always([6, 40]),
    step: 1,
  },
  'combustor.meanShift': {
    label: 'Halka yarıçap kayması',
    explain: 'Oda ortalama yarıçapının HPC çıkışı–HPT girişi ortalamasına göre farkı.',
    unit: 'm',
    range: always([-0.1, 0.1]),
    step: 0.001,
  },
  'combustor.gap': gapSpec('Yanma odası', () => true),

  // --- Türbinler ---
  ...turbineAnnulus('hpt'),
  'hpt.gap': gapSpec('HPT', () => true),
  ...turbineAnnulus('lpt'),
  'lpt.gap': gapSpec('LPT', () => true),
  'lpt.tipSpeed': {
    label: 'Güç türbini uç hızı',
    explain: 'Kompresörsüz LP milinde (serbest türbin) devri belirler.',
    unit: 'm/s',
    range: when(freeTurbine, [300, 550]),
    step: 1,
  },

  // --- Karıştırıcı, art yakıcı, lüle ---
  'mixer.loss': {
    label: 'Karışma kaybı',
    explain: 'Baypas ve çekirdek akışının karışırken kaybettiği basınç.',
    unit: '',
    range: when((t) => t.exhaust === 'mixed', [0.005, 0.03]),
    step: 0.001,
    preview: 'none',
    glossary: 'mixer',
  },
  'afterburner.mach': {
    label: "Jet borusu Mach'ı",
    explain: 'Kuru jet borusu eksenel Mach: art yakıcı gömleğinin çapını belirler.',
    unit: '',
    range: when((t) => t.afterburner, [0.15, 0.3]),
    step: 0.005,
  },
  'afterburner.lengthDiameter': {
    label: 'Art yakıcı boy / çap',
    explain: 'Uzun art yakıcı yakıtı daha tam yakar ama motoru uzatır ve ağırlaştırır.',
    unit: '',
    range: when((t) => t.afterburner, [1.2, 3]),
    step: 0.01,
  },
  'afterburner.eta': {
    label: 'Art yakıcı verimi',
    explain: 'Art yakıcıda yakıtın ne kadarı yanar.',
    unit: '',
    range: when((t) => t.afterburner, [0.8, 0.95]),
    step: 0.005,
    preview: 'none',
  },
  'afterburner.dpDry': {
    label: 'Art yakıcı kuru kaybı',
    explain: 'Alev tutucuların yanmazken bile götürdüğü basınç.',
    unit: '',
    range: when((t) => t.afterburner, [0.02, 0.06]),
    step: 0.001,
    preview: 'none',
  },
  'afterburner.dpLit': {
    label: 'Art yakıcı yanık kaybı',
    explain: 'Yanarken ısıl ve sürtünme basınç kaybı.',
    unit: '',
    range: when((t) => t.afterburner, [0.04, 0.1]),
    step: 0.001,
    preview: 'none',
  },
  'nozzle.cv': {
    label: 'Lüle itki katsayısı',
    explain: 'Gerçek itki / ideal itki: lüle sürtünmesi ve açısal kayıplar.',
    unit: '',
    range: always([0.95, 0.995]),
    step: 0.001,
    preview: 'none',
  },
  'nozzle.flaps': {
    label: 'Lüle yaprağı sayısı',
    explain: 'Değişken lüledeki yaprak sayısı.',
    unit: 'adet',
    type: 'int',
    range: when((t) => t.variableNozzle, [8, 24]),
    step: 1,
  },
  'nozzle.exitMach': {
    label: "Egzoz ağzı Mach'ı",
    explain: 'Kısa egzoz borusunun ağzında eksenel Mach: ağız çapını belirler.',
    unit: '',
    range: when((t) => t.nozzle === 'stub', [0.08, 0.5]),
    step: 0.005,
  },
  'nozzle.pressureRatio': {
    label: 'Egzoz basınç oranı',
    explain: 'Güç türbininden sonra egzozda kalan basınç: artık itki için; artırınca mil gücü azalır.',
    unit: '',
    range: when((t) => t.nozzle === 'stub', [1.02, 1.3]),
    step: 0.005,
  },

  // --- Pervane ve çıkış mili ---
  'propeller.figureOfMerit': {
    label: 'Pervane başarım katsayısı',
    explain: 'Durağan itki verimi (figure of merit): kalkış itkisini belirler.',
    unit: '',
    range: when((t) => t.lpLoad === 'propeller', [0.6, 0.8]),
    step: 0.005,
    preview: 'none',
  },
  'propeller.efficiency': {
    label: 'Pervane verimi',
    explain: 'Uçuşta pervane verimi.',
    unit: '',
    range: when((t) => t.lpLoad === 'propeller', [0.75, 0.9]),
    step: 0.005,
    preview: 'none',
  },
  'propeller.gearboxLength': {
    label: 'Redüktör boyu',
    explain: 'Pervane düzleminden gaz jeneratörü girişine eksenel mesafe.',
    unit: 'm',
    range: when((t) => t.lpLoad === 'propeller', [0.8, 2]),
    step: 0.01,
  },
  'shaft.transmissionEff': {
    label: 'Aktarma verimi',
    explain: 'Çıkış milinde ve redüktörde kaybolan güç.',
    unit: '',
    range: when((t) => t.lpLoad === 'shaft', [0.97, 0.995]),
    step: 0.001,
    preview: 'none',
  },
  'shaft.gearboxLength': {
    label: 'Çıkış mili boyu',
    explain: 'Çıkış flanşından halka giriş ağzına eksenel mesafe (mil gövdesi boyu); HPC girişin arkasında.',
    unit: 'm',
    range: when((t) => t.lpLoad === 'shaft', [0.2, 1.5]),
    step: 0.01,
  },
};

/* ------------------------------------------------------------------ */
/* Okuma / yazma                                                       */
/* ------------------------------------------------------------------ */

/** 'hpc.mach.0' → ['hpc', 'mach', 0] */
const pathOf = (id: string): (string | number)[] => id.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p));

/** Modül düğmesi mi (ilk parça modül tipi) */
const isRoot = (p: (string | number)[]) => p[0] === 'engine' || p[0] === 'bypassDuct';

function getAt(g: EngineGraph, path: (string | number)[]): KnobValue | undefined {
  if (path[0] === 'engine') return getPath(g, path.slice(1)) as KnobValue | undefined;
  if (path[0] === 'bypassDuct') return getPath(g, path) as KnobValue | undefined;
  const m = g.modules.find((x) => x.type === path[0]);
  return m ? (getPath(m, path.slice(1)) as KnobValue | undefined) : undefined;
}

function setAt(g: EngineGraph, path: (string | number)[], v: KnobValue): EngineGraph {
  if (path[0] === 'engine') return setPath(g, path.slice(1), v);
  if (path[0] === 'bypassDuct') return setPath(g, path, v);
  const i = g.modules.findIndex((x) => x.type === path[0]);
  // Modülü olmayan motorda düğme yok (range null): grafik değişmez
  if (i < 0) return g;
  const modules = g.modules.slice();
  modules[i] = setPath(modules[i], path.slice(1), v) as EngineModule;
  return { ...g, modules };
}

/** Düğmeye özgü ek kısıt (chevron: 0 ya da 8–24) */
const SNAPS = new Map<string, (v: number) => number>();

function makeKnob(id: KnobId, s: KnobSpec): EngineKnob {
  const path = s.path ?? pathOf(id);
  if (s.snap) SNAPS.set(id, s.snap);
  // Motor düzeyi ve baypas kanalı düğmeleri panelde 'engine' bölümünde
  const group = isRoot(path) ? 'engine' : String(path[0]);
  return {
    id,
    path,
    group,
    label: s.label,
    explain: s.explain,
    unit: s.unit,
    type: s.type ?? 'number',
    range: (ctx: KnobRangeCtx) => s.range(ctx.traits),
    step: s.step,
    scale: s.scale ?? 'lin',
    display: s.display,
    level: s.level ?? 'expert',
    scope: s.scope ?? 'family',
    preview: s.preview ?? 'exact',
    glossary: s.glossary,
    lesson: s.lesson,
    techLimit: s.techLimit,
    get: s.get ?? ((g) => getAt(g, path)),
    set: s.set ?? ((g, v) => setAt(g, path, v)),
  };
}

/** Düğme tanımları: KNOB_IDS sırasında, her kimlik bir kez */
export const ENGINE_KNOBS: readonly EngineKnob[] = KNOB_IDS.map((id) => makeKnob(id, SPECS[id]));

/** Kimlik → düğme */
export const KNOB_MAP: ReadonlyMap<string, EngineKnob> = new Map(ENGINE_KNOBS.map((k) => [k.id, k]));

/** Eski kimlik → güncel kimlik (M5a'da boş) */
export const KNOB_ALIASES: Record<string, KnobId> = {};

/**
 * Eski kimliğin güncel karşılığı. Yalnız öz alanlar: belgeden gelen
 * 'constructor' ya da '__proto__' Object.prototype üyesine çözülmez.
 */
export function knobAlias(id: string): KnobId | undefined {
  return Object.hasOwn(KNOB_ALIASES, id) ? KNOB_ALIASES[id] : undefined;
}

/** Kimliği (eski adlar dahil) düğmeye çevirir; bilinmiyorsa undefined */
export function knobById(id: string): EngineKnob | undefined {
  const alias = KNOB_MAP.has(id) ? undefined : knobAlias(id);
  return KNOB_MAP.get(alias ?? id);
}

/** Düğmenin türetilmiş tipteki aralığı (bağlam nesnesi olmadan) */
export function knobRange(k: EngineKnob | KnobId, traits: EngineTraits): [number, number] | null {
  const spec = SPECS[(typeof k === 'string' ? k : k.id) as KnobId];
  return spec ? spec.range(traits) : null;
}

/**
 * Değeri düğmenin tipine, aralığına ve ek kısıtına kırpar (core clampKnob +
 * chevron gibi aralık içi kısıtlar). `get(set(g, v)) === clampEngineKnob(v)`.
 */
export function clampEngineKnob(k: EngineKnob, v: KnobValue, ctx: KnobRangeCtx): KnobValue {
  const c = clampKnob(k, v, ctx);
  const snap = SNAPS.get(k.id);
  return snap && typeof c === 'number' ? snap(c) : c;
}

/**
 * Grafiğin düğme bağlamı. Aralıklar yalnız `traits` okur. Mimari (`arch`)
 * yalnız verilmişse vardır (değer ya da `architectureOf` gibi tembel bir
 * türetici); verilmezse dönüş tipi `KnobRangeCtx`'tir ve `arch` alanı hiç
 * yoktur, okumaya çalışan kod derlenmez. knobs.ts architecture.ts'i içe
 * AKTARMAZ: graph.ts → engineDoc.ts (graphRev) → knobs.ts →
 * architecture.ts → graph.ts döngüsünde architecture.ts modül yüklenirken
 * GRAPH_RULES'u okur ve henüz yüklenmemiş graph.ts yüzünden çöker. Mağaza
 * (store.ts) kendi bağlamını `architectureOf` ile kurar.
 */
type KnobCtxOptions = { family?: KnobCtx['family']; tech?: TechLimits };
export function knobCtx(g: EngineGraph, o: KnobCtxOptions & { arch: Architecture | ((g: EngineGraph) => Architecture) }): KnobCtx;
export function knobCtx(g: EngineGraph, o?: KnobCtxOptions): KnobRangeCtx;
export function knobCtx(
  g: EngineGraph,
  o: KnobCtxOptions & { arch?: Architecture | ((g: EngineGraph) => Architecture) } = {},
): KnobCtx | KnobRangeCtx {
  const base: KnobRangeCtx = { traits: deriveTraits(g), tech: o.tech ?? TECH_MODERN, family: o.family };
  const given = o.arch;
  if (given === undefined) return base;
  let arch = typeof given === 'function' ? undefined : given;
  return {
    ...base,
    get arch(): Architecture {
      return (arch ??= (given as (g: EngineGraph) => Architecture)(g));
    },
  };
}

/* ------------------------------------------------------------------ */
/* Çözülebilirlik ve duyarlılık                                        */
/* ------------------------------------------------------------------ */

/** Değerlendirme seçenekleri: üretim ve hata çevirisi (atölye kendi referansıyla verir) */
export interface KnobEvalOptions {
  /** Varsayılan: buildChecked(g) */
  build?: (g: EngineGraph) => BuiltEngine;
  /** Varsayılan: warnings.ts translateError */
  translate?: (e: unknown) => TeachingError;
  summarize?: (b: BuiltEngine) => DesignSummary;
  diff?: (a: DesignSummary, b: DesignSummary) => SummaryDelta[];
}

/**
 * buildEngine + sonluluk denetimi: NaN/∞ itki, kütle ya da geometri tipli
 * DesignError olur (çözücü ıraksadıysa sessizce bozuk motor dönmesin).
 */
export function buildChecked(g: EngineGraph, opts?: BuildOptions): BuiltEngine {
  const b = buildEngine(g, opts);
  const m = b.flowpath.metrics;
  const nums = [b.sized.point.thrust, b.sized.point.wf, m.mass.total, m.diameter, m.length, b.flowpath.rpm.lp, b.flowpath.rpm.hp];
  if (!nums.every(Number.isFinite)) throw new DesignError('Tasarım noktası çözülemedi: değerler fiziksel aralığın dışında.');
  return b;
}

type Probe = { ok: true; b: BuiltEngine } | { ok: false; e: unknown };

function probe(build: (g: EngineGraph) => BuiltEngine, g: EngineGraph): Probe {
  try {
    return { ok: true, b: build(g) };
  } catch (e) {
    return { ok: false, e };
  }
}

const BISECT_STEPS = 12;

/**
 * Çözülebilir aralık: [lo,hi] içinde build'in başarılı olduğu bölge. Her
 * uç için önce uç denenir; kurulmazsa geçerli değerden uca 12 adımlı ikiye
 * bölme ile son kurulan değer bulunur, neden (öğretici hata) eklenir.
 * Geçerli değer kurulmuyorsa aralık o değere çöker ve iki neden de o hata.
 */
export function feasibleRange(
  g: EngineGraph,
  k: EngineKnob,
  ctx: KnobRangeCtx,
  opts: KnobEvalOptions = {},
): { lo: number; hi: number; loReason?: TeachingError; hiReason?: TeachingError } {
  const build = opts.build ?? ((x: EngineGraph) => buildChecked(x));
  const translate = opts.translate ?? translateError;
  const r = k.range(ctx);
  const cur = Number(k.get(g));
  if (!r || !Number.isFinite(cur)) return { lo: cur, hi: cur };
  const v0 = Number(clampEngineKnob(k, cur, ctx));
  const at = (v: number) => probe(build, k.set(g, clampEngineKnob(k, v, ctx)));
  const p0 = at(v0);
  if (!p0.ok) {
    const why = translate(p0.e);
    return { lo: v0, hi: v0, loReason: why, hiReason: why };
  }
  const log = k.scale === 'log' && r[0] > 0;
  const fwd = (v: number) => (log ? Math.log(v) : v);
  const inv = (u: number) => (log ? Math.exp(u) : u);
  const edge = (end: number): { v: number; why?: TeachingError } => {
    const pe = at(end);
    if (pe.ok) return { v: end };
    let good = fwd(v0);
    let bad = fwd(end);
    let err = pe.e;
    for (let i = 0; i < BISECT_STEPS; i++) {
      let m = inv((good + bad) / 2);
      if (k.type === 'int') {
        m = Math.round(m);
        if (m === Math.round(inv(good)) || m === Math.round(inv(bad))) break;
      }
      const pm = at(m);
      if (pm.ok) good = fwd(m);
      else {
        bad = fwd(m);
        err = pm.e;
      }
    }
    return { v: Number(clampEngineKnob(k, inv(good), ctx)), why: translate(err) };
  };
  const lo = edge(r[0]);
  const hi = edge(r[1]);
  return { lo: lo.v, hi: hi.v, loReason: lo.why, hiReason: hi.why };
}

/**
 * Bir adım sonraki değer (log ölçekte görece adım). Ek kısıt (chevron: 0 ya
 * da 8–24) tek adımı yutabilir: değer değişene dek aynı yönde en çok 8 adım
 * denenir; yalnız gerçekten aralık sonundaysa geri adım.
 */
export function stepValue(k: EngineKnob, v: number, ctx: KnobRangeCtx, dir: 1 | -1 = 1): number {
  const next = (d: number) => Number(clampEngineKnob(k, k.scale === 'log' ? v * (1 + d * k.step) : v + d * k.step, ctx));
  for (const s of [dir, -dir])
    for (let d = 1; d <= 8; d++) {
      const n = next(s * d);
      if (n !== v) return n;
    }
  return v;
}

/** +1 adımın etkisi (ipucu): sonlu fark. Kurulamıyorsa boş. */
export function sensitivity(g: EngineGraph, k: EngineKnob, ctx: KnobRangeCtx, opts: KnobEvalOptions = {}): SummaryDelta[] {
  const build = opts.build ?? ((x: EngineGraph) => buildChecked(x));
  const summ = opts.summarize ?? summarize;
  const diff = opts.diff ?? diffSummary;
  const v = Number(k.get(g));
  if (!Number.isFinite(v) || !k.range(ctx)) return [];
  const v1 = stepValue(k, v, ctx);
  if (v1 === v) return [];
  const a = probe(build, g);
  const b = probe(build, k.set(g, v1));
  if (!a.ok || !b.ok) return [];
  return diff(summ(a.b), summ(b.b));
}
