/**
 * Motor mimarisi (M5a): sihirbazın ve mimari kartlarının eksenleri. Mimari
 * saklanmaz; grafikten `architectureOf` ile türetilir. Mimari değişimi
 * grafiğe `applyArchitecture` dönüşüm tablosuyla uygulanır
 * (docs/M5A-SPEC.md §2.4).
 *
 * Geçerlilik tek kaynaktan gelir: mimariden kurulan grafik GRAPH_RULES'tan
 * geçmeli (kilitli kartın metni kuralın öğretici mesajıdır). Grafikle
 * anlatılamayan birkaç birleşim (pervaneli motorda art yakıcı, fansız
 * booster…) burada yerel olarak denetlenir. Yerleşimi henüz olmayan
 * mimariler (layouts READY=false) "yakında" diye kilitlidir.
 */

import { sizeEngine } from '../sim/design';
import {
  DEFAULT_MODULES,
  annularCombustorFor,
  describeArchitecture,
  donorModule,
  familyOf,
  fanRangeFor,
  fitCans,
  graphFromArchitecture,
  graphSkeleton,
  massFlowRangeFor,
  referenceFor,
  setMassFlow,
  templateGraph,
} from './defaults';
import type { Severity } from './core/rules';
import { GraphError } from './errors';
import { evaluate } from './evaluate';
import { computeGasPath, FlowpathError } from './flowpath';
import { buildEngine, checkGraph, GRAPH_RULES, toEngineDesign, type BuiltEngine } from './graph';
import { clampEngineKnob, ENGINE_KNOBS, knobById, knobCtx, type KnobId } from './knobs';
import { layoutNotReady } from './layouts/index';
import { deriveTraits } from './traits';
import { MODULE_ORDER } from './types';
import type { CombustorModule, CombustorStyle, CompressorModule, EngineGraph, EngineModule, InletModule, MixerModule, NozzleModule, NozzleStyle, TurbineModule } from './types';

/** LP milini ne çeviriyor: alçak basınç kompresörü, fan, pervane ya da çıkış mili */
export type LpLoad = 'lpc' | 'fan' | 'propeller' | 'shaft';

export interface Architecture {
  /** Sihirbazın 1. sorusu; pervane 'shaft' çıkışlı sayılmaz (itki + mil) */
  output: 'thrust' | 'shaft';
  lpLoad: LpLoad;
  /** Yalnız lpLoad 'fan' */
  booster: boolean;
  /** HPC son kademe santrifüj */
  centrifugal: boolean;
  combustor: CombustorStyle;
  exhaust: 'single' | 'separate' | 'mixed';
  /** exhaust 'mixed' iken anlamlı */
  mixer: 'confluent' | 'lobed';
  afterburner: boolean;
  /** Art yakıcı varken değişken lüle */
  abNozzle: 'convergent' | 'cd';
  /** prop/shaft'ta yok sayılır */
  installation: 'bare' | 'nacelle';
}

export interface ArchCard {
  title: string;
  does: string;
  gains: string;
  costs: string;
  examples: string;
  lesson?: string;
  glossary?: string;
}

export interface ArchOption {
  axis: keyof Architecture;
  value: string | boolean;
  card: ArchCard;
  /** Zorunlu eşlik eden değişiklikler (kartta "Şunlar da değişir: …") */
  implies(a: Architecture): Partial<Architecture>;
  /** Hâlâ geçersizse GRAPH_RULES metni (kart kilitli, nedeni öğretir); M5b/M5c ise o metin */
  blocked(a: Architecture): string | null;
}

export type ArchChange =
  | { arch: Architecture; implied: { axis: keyof Architecture; from: unknown; to: unknown; reason: string }[] }
  | { blocked: string };

/**
 * Mimari uygulanırken seed'deki değeri korunamayan düğme (kırpıldı, motor
 * onunla kurulamadı ya da kutular sığmadı). Kartın eksen listesi bunları
 * göremez (grafiğe bağlı): atölye "Şunlar da değişti" bildiriminde gösterir.
 */
export interface ArchNote {
  knob: string;
  from: number;
  to: number;
  reason: string;
  /**
   * Değer değişmedi (from === to): yeni motorda kalan bir uyarının
   * bildirimi. Ailenin değerlerine dönmek uyarıyı gidermiyorsa yazılır;
   * `knob` uyarıyı giderebilecek düğme (çoğu zaman hava akışı).
   */
  residual?: boolean;
}

/* ------------------------------------------------------------------ */
/* Grafik → mimari                                                     */
/* ------------------------------------------------------------------ */

const AXES: readonly (keyof Architecture)[] = [
  'output',
  'lpLoad',
  'booster',
  'centrifugal',
  'combustor',
  'exhaust',
  'mixer',
  'afterburner',
  'abNozzle',
  'installation',
];

const freeTurbine = (a: Pick<Architecture, 'lpLoad'>) => a.lpLoad === 'propeller' || a.lpLoad === 'shaft';

/**
 * Anlamsız eksenleri kanonik değere çeker (karşılaştırma ve anahtar için):
 * çıkış LP yükünden; booster yalnız fanlı motorda; karıştırıcı stili
 * yalnız karışık akışta (yoksa 'confluent'); değişken lüle yalnız art
 * yakıcıyla (yoksa 'convergent'); serbest türbinli motorda egzoz tek ve
 * kurulum 'bare'. Gerçek (kuralla denetlenen) eksenlere dokunmaz.
 */
export function normalizeArchitecture(a: Architecture): Architecture {
  const ft = freeTurbine(a);
  return {
    output: a.lpLoad === 'shaft' ? 'shaft' : 'thrust',
    lpLoad: a.lpLoad,
    booster: a.lpLoad === 'fan' && a.booster,
    centrifugal: a.centrifugal,
    combustor: a.combustor,
    exhaust: ft ? 'single' : a.exhaust,
    mixer: !ft && a.exhaust === 'mixed' ? a.mixer : 'confluent',
    afterburner: a.afterburner,
    abNozzle: a.afterburner ? a.abNozzle : 'convergent',
    installation: ft ? 'bare' : a.installation,
  };
}

export function architectureOf(g: EngineGraph): Architecture {
  const t = deriveTraits(g);
  const mixer = g.modules.find((m) => m.type === 'mixer') as MixerModule | undefined;
  return normalizeArchitecture({
    output: t.lpLoad === 'shaft' ? 'shaft' : 'thrust',
    lpLoad: t.lpLoad,
    booster: t.booster,
    centrifugal: t.centrifugal,
    combustor: t.combustor,
    // Karıştırıcı varsa (baypassız geçersiz grafikte de) karışık sayılır
    exhaust: mixer ? 'mixed' : t.exhaust,
    mixer: mixer?.style ?? 'confluent',
    afterburner: t.afterburner,
    abNozzle: t.nozzle === 'cd' ? 'cd' : 'convergent',
    installation: g.modules.some((m) => m.type === 'inlet' && (m as InletModule).style === 'nacelle') ? 'nacelle' : 'bare',
  });
}

const COMB_KEY: Record<CombustorStyle, string> = { annular: 'ann', can: 'can', canAnnular: 'cna' };
const EXHAUST_KEY = { single: 'sgl', separate: 'sep', mixed: 'mix' } as const;

/** Aile gruplama anahtarı: 'fan+b|cf0|ann|mix:lobed|dry|nac' */
export function archKey(a: Architecture): string {
  const n = normalizeArchitecture(a);
  return [
    `${n.lpLoad}${n.booster ? '+b' : ''}`,
    `cf${n.centrifugal ? 1 : 0}`,
    COMB_KEY[n.combustor],
    n.exhaust === 'mixed' ? `mix:${n.mixer}` : EXHAUST_KEY[n.exhaust],
    n.afterburner ? `ab:${n.abNozzle}` : 'dry',
    n.installation === 'nacelle' ? 'nac' : 'bare',
  ].join('|');
}

/* ------------------------------------------------------------------ */
/* Dönüşüm tablosu (grafik üzerinde)                                   */
/* ------------------------------------------------------------------ */

const clone = <T>(x: T): T => structuredClone(x);
const find = <T extends EngineModule>(g: EngineGraph, type: T['type']) => g.modules.find((m) => m.type === type) as T | undefined;
const bprOf = (g: EngineGraph) => find<CompressorModule>(g, 'fan')?.bypassRatio ?? 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Modülü akış sırasındaki yerine koyar (aynı tipteki eskisinin yerine) */
function put(g: EngineGraph, m: EngineModule): void {
  const i = g.modules.findIndex((x) => x.type === m.type);
  if (i >= 0) {
    g.modules[i] = m;
    return;
  }
  const k = MODULE_ORDER.indexOf(m.type);
  const j = g.modules.findIndex((x) => MODULE_ORDER.indexOf(x.type) > k);
  if (j < 0) g.modules.push(m);
  else g.modules.splice(j, 0, m);
}

function drop(g: EngineGraph, type: EngineModule['type']): void {
  g.modules = g.modules.filter((m) => m.type !== type);
}

/**
 * Yanma odası stil değişimi (§2.4): kutu sayısı (kutu 10, kutu-halka 8),
 * basınç kaybı (halka .04 / kutu-halka .05 / kutu .06), referans hız (halka
 * 20–43 arasında korunur, kutu ≥ 25), boy oranı (kutuda boy / kutu çapı:
 * 4,5; halkaya dönüşte ailenin halka yanma odasınınki).
 */
function convertCombustor(c: CombustorModule, to: Architecture): void {
  const D = DEFAULT_MODULES.combustor;
  if (to.combustor === 'annular') {
    const ann = annularCombustorFor(to);
    c.style = 'annular';
    delete c.cans;
    c.dp = D.annular.dp;
    c.refVelocity = clamp(c.refVelocity, D.annular.refVelocity[0], D.annular.refVelocity[1]);
    c.lengthHeight = ann.lengthHeight;
    c.injectors = ann.injectors;
    return;
  }
  const d = D[to.combustor];
  c.style = to.combustor;
  c.cans = d.cans;
  c.dp = d.dp;
  c.refVelocity = Math.max(c.refVelocity, d.refVelocityMin);
  c.lengthHeight = d.lengthHeight;
}

/**
 * Fanlı motorda booster'ın basınç oranı (sihirbazla aynı kural): çıplak
 * motorda ya da yüksek PR'lı (askeri) fanın arkasında yolcu TF booster'ı
 * (1,95) fazla — askeri TF kaportaya alınınca LPT çıkış kanalı kapanırdı;
 * orada düşük PR'lı booster (bareBoosterPR), değilse bağışçınınki.
 */
function boosterPR(to: Architecture, fanPR: number): number | undefined {
  if (to.installation === 'bare' || fanPR > DEFAULT_MODULES.boosterFanPRMax) return DEFAULT_MODULES.bareBoosterPR;
  return donorModule<CompressorModule>('lpc', to)?.pr;
}

/** Mimarinin istediği lüle stili */
function nozzleStyleFor(a: Architecture): NozzleStyle {
  if (freeTurbine(a)) return 'stub';
  if (a.exhaust === 'separate') return 'separate';
  return a.afterburner ? a.abNozzle : 'fixed';
}

/** Kurulum değişince fan, fan kanalı ve LPT ile birlikte değişen ve notta bildirilen düğmeler */
const REFAN_KNOBS: readonly KnobId[] = ['fan.pr', 'fan.bypassRatio', 'fan.hubPRFraction', 'fan.eff', 'fan.tipSpeed', 'bypassDuct.dp', 'bypassDuct.mach', 'lpt.eff', 'lpt.tipSpeed'];

/**
 * Grafiği (yerinde) aynı LP yükündeki başka bir mimariye getirir: booster,
 * santrifüj kademe, yanma odası stili, egzoz/karıştırıcı, art yakıcı,
 * kurulum ve lüle (§2.4 dönüşüm tablosu). Geçersiz hedef olduğu gibi
 * kurulur; kurallar buildEngine'de öğretici hata verir.
 * LP yükü değişimi burada değil (applyArchitecture: yeni gaz jeneratörü).
 * `notes` verilirse korunamayan düğmeler (fan PR'ı, BPR) oraya yazılır.
 */
export function reshapeGraph(g: EngineGraph, next: Architecture, notes?: ArchNote[]): EngineGraph {
  const to = normalizeArchitecture(next);
  const hpc = find<CompressorModule>(g, 'hpc');

  // Kurulum: giriş biçimi. Kurulum değişince fan ve fan kanalı ailenin
  // fanıdır (bağışçı modül: askeri fan ↔ yolcu fanı) ve booster'ın PR'ı
  // sihirbazınki gibi seçilir; çekirdek akışı korunur. Askeri fanı (PR 4,3,
  // BPR 0,55) kaportalı aralığa (knobs.ts: PR 1,4–1,8, BPR 3–11) kırpmak
  // yetmez: sınırda fan kanalı kapanır, aradaki değerlerde motor sıcak
  // çalışır (EGT payı −54 K); yalnız PR/BPR'ı almak da (askeri fanın
  // geometrisi ve verimiyle) fan kanalını kapatır. Kurulum aynıyken fan
  // PR'ı ve BPR yeni ailenin aralığına kırpılır.
  const inlet = find<InletModule>(g, 'inlet');
  if (inlet && !freeTurbine(to)) {
    const want = to.installation === 'nacelle' ? 'nacelle' : 'bellmouth';
    const reinstalled = inlet.style !== want;
    if (reinstalled) {
      const src = want === 'nacelle' ? templateGraph('turbofan') : templateGraph(to.lpLoad === 'fan' ? 'militaryTurbofan' : 'turbojet');
      put(g, clone(find<InletModule>(src, 'inlet')!));
    }
    const fan = find<CompressorModule>(g, 'fan');
    const range = fanRangeFor(to);
    if (fan && reinstalled) {
      const where = to.installation === 'nacelle' ? 'Kaportalı' : 'Çıplak';
      const before = notes ? REFAN_KNOBS.map((id) => readKnob(g, id)) : [];
      const d = donorModule<CompressorModule>('fan', to)!;
      put(g, d);
      // LPT fanı çevirir: kanalı fanın baypas oranına kalibre (askeri TF'nin
      // tek kademeli LPT'si BPR 9'luk fanla çıkış kanalını kapatır)
      const lpt = donorModule<TurbineModule>('lpt', to);
      if (lpt) put(g, lpt);
      g.massFlow *= (1 + (d.bypassRatio ?? 0)) / (1 + (fan.bypassRatio ?? 0));
      g.bypassDuct = clone(templateGraph(familyOf(to)).bypassDuct ?? { dp: 0.02, mach: 0.45 });
      REFAN_KNOBS.forEach((id, i) => {
        const was = before[i];
        const now = readKnob(g, id);
        if (was !== undefined && now !== undefined && was !== now) {
          notes?.push({ knob: id, from: was, to: now, reason: `${where} motorun fanı, fan kanalı ve LPT'si ailenin fanınınkidir: kurulum değişince ondan alındı (çekirdek akışı korunur).` });
        }
      });
      // Var olan booster yeni fana göre (eklenen booster aşağıda aynı kuralla)
      const lpc = to.lpLoad === 'fan' ? find<CompressorModule>(g, 'lpc') : undefined;
      const bp = lpc && boosterPR(to, d.pr);
      if (lpc && bp !== undefined && bp !== lpc.pr) {
        notes?.push({ knob: 'lpc.pr', from: lpc.pr, to: bp, reason: `${where} motorun booster'ı yeni fana göre: basınç oranı ailenin değerine alındı.` });
        lpc.pr = bp;
      }
    } else if (fan && range) {
      const pr = clamp(fan.pr, range.pr[0], range.pr[1]);
      if (pr !== fan.pr) {
        notes?.push({ knob: 'fan.pr', from: fan.pr, to: pr, reason: `Bu kurulumda fan basınç oranı ${fmt(range.pr[0])}–${fmt(range.pr[1])}: sınıra çekildi.` });
        fan.pr = pr;
      }
      const bpr = fan.bypassRatio ?? 0;
      const nb = clamp(bpr, range.bpr[0], range.bpr[1]);
      if (nb !== bpr) {
        notes?.push({ knob: 'fan.bypassRatio', from: bpr, to: nb, reason: `Bu kurulumda baypas oranı ${fmt(range.bpr[0])}–${fmt(range.bpr[1])}: sınıra çekildi (çekirdek akışı korunur).` });
        g.massFlow *= (1 + nb) / (1 + bpr);
        fan.bypassRatio = nb;
      }
    }
  }

  // Booster: çekirdeği önden besler, OPR onun basınç oranı kadar artar.
  // HPC basınç oranı ve fan.hubPRFraction olduğu gibi kalır: HP işi (dolayısıyla
  // T45 ve EGT payı) değişmez. (OPR'yi koruyup HPC'yi kısaltmak HP işini
  // LP miline kaydırır: askeri TF'de T45 29 K artıp EGT payı 44 → 15 K'e iner.)
  if (to.lpLoad === 'fan') {
    const lpc = find<CompressorModule>(g, 'lpc');
    if (to.booster && !lpc) {
      const b = donorModule<CompressorModule>('lpc', to)!;
      delete b.tipSpeed;
      b.pr = boosterPR(to, find<CompressorModule>(g, 'fan')?.pr ?? 0) ?? b.pr;
      put(g, b);
    } else if (!to.booster && lpc) {
      drop(g, 'lpc');
    }
  }

  // Santrifüj son kademe: çark ve HPC uç hızı turboprop bağışçısından
  if (hpc && to.centrifugal && !hpc.centrifugal) {
    const d = find<CompressorModule>(templateGraph('turboprop'), 'hpc')!;
    hpc.centrifugal = clone(d.centrifugal!);
    hpc.tipSpeed = d.tipSpeed;
  } else if (hpc && !to.centrifugal && hpc.centrifugal) {
    delete hpc.centrifugal;
  }

  const c = find<CombustorModule>(g, 'combustor');
  if (c && c.style !== to.combustor) convertCombustor(c, to);

  // Egzoz: karıştırıcı (stil değişince önce bağışçınınki — stili tutuyorsa
  // kalibre kaybıyla, sihirbazla aynı motor — yoksa varsayılan), baypas kanalı
  const mixer = find<MixerModule>(g, 'mixer');
  if (to.exhaust === 'mixed') {
    if (!mixer || (mixer.style ?? 'confluent') !== to.mixer) {
      const d = donorModule<MixerModule>('mixer', to);
      put(g, d && (d.style ?? 'confluent') === to.mixer ? d : clone(DEFAULT_MODULES.mixer[to.mixer]));
    }
  } else if (mixer) {
    drop(g, 'mixer');
  }
  if (to.lpLoad === 'fan' && !g.bypassDuct) g.bypassDuct = clone(templateGraph(familyOf(to)).bypassDuct ?? { dp: 0.02, mach: 0.45 });
  if (to.lpLoad !== 'fan') delete g.bypassDuct;

  // Art yakıcı: baypaslıda askeri turbofanın, değilse turbojetin
  if (to.afterburner && !find(g, 'afterburner')) {
    const ab = donorModule('afterburner', to);
    if (ab) put(g, ab);
  } else if (!to.afterburner) {
    drop(g, 'afterburner');
  }

  // Lüle: stil değişince bağışçıdan ya da varsayılandan
  const noz = find<NozzleModule>(g, 'nozzle');
  const style = nozzleStyleFor(to);
  if (noz && noz.style !== style) {
    let n: NozzleModule;
    if (style === 'separate') n = clone(DEFAULT_MODULES.separateNozzle);
    else if (style === 'fixed') n = clone(DEFAULT_MODULES.fixedNozzle);
    else {
      n = donorModule<NozzleModule>('nozzle', to) ?? clone(DEFAULT_MODULES.fixedNozzle);
      n.style = style;
      if (noz.flaps !== undefined && style !== 'stub') n.flaps = noz.flaps;
    }
    put(g, n);
  } else if (noz && style !== 'separate') {
    delete noz.chevrons;
  }
  return g;
}

/**
 * Aileler arası anlamlı düğmeler (§2.10 kimlikleri): LP yükü değişince
 * yeni gaz jeneratörüne seed'den taşınır, yeni ailenin aralığına kırpılır.
 * Aralıklar tek kaynaktan: knobs.ts `knobRange` (yeni grafiğin tipiyle).
 * Geometri düğmeleri (Mach, göbek/uç, yükleme, boy oranı, uç hızları)
 * ailenin yerleşimine kalibre olduğu için bağışçıdan kalır.
 */
interface CarriedKnob {
  id: KnobId;
  /** Yanma odası stiline bağlı: yalnız seed'in stili hedefle aynıysa */
  sameCombustor?: boolean;
}

const CARRIED: readonly CarriedKnob[] = [
  { id: 'combustor.tit' },
  { id: 'hpc.pr' },
  { id: 'hpc.eff' },
  { id: 'hpt.eff' },
  { id: 'lpt.eff' },
  { id: 'combustor.eff' },
  // Referans hız taşınmaz: aileye özgü boyutlandırma (TJ 43, TF/TP 8–20 m/s);
  // turbofanınki turbojete taşınınca yanma odası iki kat büyür, kutular sığmaz.
  { id: 'combustor.dp', sameCombustor: true },
  { id: 'combustor.cans', sameCombustor: true },
  { id: 'afterburner.t7Max' },
  { id: 'afterburner.eta' },
  { id: 'engine.mechEff' },
];

/**
 * Kart yolu motoru uyarı veriyorsa ailenin (sihirbazın) değerine geri
 * alınabilen düğmeler, deneme sırasıyla: çevrimi en çok değiştirenler önce.
 */
const REVERTIBLE: readonly KnobId[] = [
  'combustor.tit',
  'hpc.pr',
  'fan.pr',
  'fan.bypassRatio',
  'fan.hubPRFraction',
  'lpc.pr',
  ...CARRIED.map((k) => k.id).filter((id) => id !== 'combustor.tit' && id !== 'hpc.pr'),
];

const knobOf = (id: KnobId) => knobById(id)!;

/** Sayısal düğme değeri (yoksa undefined) */
function readKnob(g: EngineGraph, id: KnobId): number | undefined {
  const v = knobOf(id).get(g);
  return typeof v === 'number' ? v : undefined;
}

/** Düğmeyi grafiğe yerinde yazar (knobs.ts set'i klon döndürür; modül başvuruları eskir) */
function writeKnob(g: EngineGraph, id: KnobId, v: number): void {
  Object.assign(g, knobOf(id).set(g, v));
}

const fmt = (v: number) => Number(v.toPrecision(4)).toLocaleString('tr-TR');

/**
 * Grafik kurulabiliyor mu (kutular sığdırılmış kopyada). Yerleşimi henüz
 * olmayan ailede gaz yoluna kadar denetlenir; o da yoksa doğrulanamaz.
 */
function buildCheck(g: EngineGraph, reference: BuiltEngine): { ok: true } | { ok: false; why: string } | { ok: null } {
  const t = fitCans(clone(g), reference);
  try {
    buildEngine(t, { reference });
    return { ok: true };
  } catch (e) {
    if (!(e instanceof FlowpathError && e.code === 'layout.notReady')) return { ok: false, why: (e as Error).message };
  }
  try {
    computeGasPath(t, sizeEngine(toEngineDesign(t, { reference })));
    return { ok: true };
  } catch {
    return { ok: null };
  }
}

/**
 * LP yükü değişimi: gaz jeneratörü yeni ailenin bağışçısından (fanlı
 * turbofanın HPC'si turboprobun santrifüjlü HPC'sine dönüşemez), ortak
 * düğmeler (CARRIED) seed'den. Taşınan değerle motor kurulamıyorsa
 * bağışçının değeri kalır ve nedeni nota yazılır.
 */
function changeLpLoad(seed: EngineGraph, from: Architecture, to: Architecture, notes: ArchNote[]): EngineGraph {
  const tpl = templateGraph(familyOf(to));
  const g = graphFromArchitecture(to, { massFlow: tpl.massFlow, name: seed.name });
  const reference = referenceFor(to);

  // Yeni fanın baypas oranı bağışçınınki (sihirbazla aynı): §2.4 tablosundaki
  // çıplak 0,6, P2'nin karışma dengesine kalibre ettiği askeri TF fanıyla
  // (PR 4,3, BPR 0,55) karıştırıcıda P19t/P5t 1,15 verir (mixerPR uyarısı)
  const fan = find<CompressorModule>(g, 'fan');

  // Çekirdek akışı korunur; ailenin hava akışı aralığına kırpılır (§2.10)
  const want = (seed.massFlow / (1 + bprOf(seed))) * (1 + bprOf(g));
  const [lo, hi] = massFlowRangeFor(to);
  const W = clamp(want, lo, hi);
  setMassFlow(g, W, tpl.massFlow);
  if (Math.abs(W / want - 1) > 1e-9) {
    notes.push({ knob: 'engine.massFlow', from: want, to: W, reason: `Yeni ailenin hava akışı aralığı ${fmt(lo)}–${fmt(hi)} kg/s: çekirdek akışı korunamadı.` });
  }

  // LPC ↔ fan uç hızı
  const oldFront = find<CompressorModule>(seed, from.lpLoad === 'fan' ? 'fan' : 'lpc');
  if (from.lpLoad === 'lpc' && to.lpLoad === 'fan' && oldFront?.tipSpeed) fan!.tipSpeed = clamp(oldFront.tipSpeed, 300, 560);
  if (from.lpLoad === 'fan' && to.lpLoad === 'lpc' && oldFront?.tipSpeed) find<CompressorModule>(g, 'lpc')!.tipSpeed = clamp(oldFront.tipSpeed, 300, 520);

  // Ortak düğmeler: önce bağışçı değerleriyle kurulabiliyor mu (değilse doğrulanamaz, hepsi taşınır)
  const verify = buildCheck(g, reference).ok === true;
  const sameComb = find<CombustorModule>(seed, 'combustor')?.style === to.combustor;
  const ctx = knobCtx(g);
  for (const k of CARRIED) {
    if (k.sameCombustor && !sameComb) continue;
    const old = readKnob(seed, k.id);
    const donor = readKnob(g, k.id);
    const range = knobOf(k.id).range(ctx);
    if (old === undefined || donor === undefined || !range) continue;
    // HPC PR'ın anlamı serbest türbinli gaz jeneratöründe toplam basınç
    // oranı, diğerlerinde LPC'nin/fanın arkasındaki oran: taşınmaz
    if (k.id === 'hpc.pr' && freeTurbine(from) !== freeTurbine(to)) {
      if (old !== donor) addNote(notes, { knob: k.id, from: old, to: donor, reason: `HPC basınç oranının anlamı değişiyor (serbest türbinli motorda toplam basınç oranı): ailenin değeri (${fmt(donor)}) kullanıldı.` });
      continue;
    }
    const v = clampEngineKnob(knobOf(k.id), old, ctx) as number;
    if (v !== donor) {
      writeKnob(g, k.id, v);
      if (verify) {
        const r = buildCheck(g, reference);
        if (r.ok === false) {
          writeKnob(g, k.id, donor);
          addNote(notes, { knob: k.id, from: old, to: donor, reason: `Bu değerle yeni motor kurulamıyor (${r.why}): ailenin değeri kullanıldı.` });
          continue;
        }
      }
    }
    if (v !== old) addNote(notes, { knob: k.id, from: old, to: v, reason: `Yeni ailenin aralığı ${fmt(range[0])}–${fmt(range[1])}: sınıra çekildi.` });
  }
  return g;
}

/**
 * Bütün sayısal düğmeleri grafiğin (yeni ailenin) aralığına kırpar
 * (knobs.ts tek kaynak): panel aralık dışı değer göstermesin, ilk
 * dokunuşta değer sıçramasın. Kırpılanlar notta.
 */
function clampToKnobRanges(g: EngineGraph, notes: ArchNote[]): void {
  const ctx = knobCtx(g);
  for (const k of ENGINE_KNOBS) {
    if (k.type !== 'number' && k.type !== 'int') continue;
    const v = k.get(g);
    const r = k.range(ctx);
    if (typeof v !== 'number' || !r) continue;
    const c = clampEngineKnob(k, v, ctx) as number;
    if (c === v) continue;
    Object.assign(g, k.set(g, c));
    addNote(notes, { knob: k.id, from: v, to: c, reason: `Yeni ailenin aralığı ${fmt(r[0])}–${fmt(r[1])}: sınıra çekildi.` });
  }
}

/** Hava akışını ailenin aralığına kırpar (pervane akışla ölçeklenir) */
function clampMassFlow(g: EngineGraph, to: Architecture, notes: ArchNote[], reason: string): void {
  const [lo, hi] = massFlowRangeFor(to);
  const W = clamp(g.massFlow, lo, hi);
  if (Math.abs(W / g.massFlow - 1) <= 1e-9) return;
  addNote(notes, { knob: 'engine.massFlow', from: g.massFlow, to: W, reason: `Yeni ailenin hava akışı aralığı ${fmt(lo)}–${fmt(hi)} kg/s: ${reason}` });
  setMassFlow(g, W, g.massFlow);
}

/* ---------------------------- çalışabilirlik ---------------------------- */

const RANK: Record<Severity, number> = { info: 0, caution: 1, warning: 2 };

/**
 * Değerlendirme sorunları: bulgu kimliği → önem (caution 1, warning 2;
 * kurulamazsa 'build' 3), başlık, düzeltme önerisi ve ilgili düğmeler
 */
type Problems = Map<string, { rank: number; title: string; fix: string; knobs: string[] }>;

/**
 * Grafiğin sorunları (kutular sığdırılmış kopyada, atölyenin referansıyla).
 * Yerleşimi hazır olmayan ya da değerlendirilemeyen grafikte null.
 */
function problemsOf(g: EngineGraph, reference: BuiltEngine): Problems | null {
  if (layoutNotReady(g)) return null;
  let ev: ReturnType<typeof evaluate>;
  try {
    ev = evaluate(fitCans(clone(g), reference), { reference, remedies: false });
  } catch {
    return null;
  }
  const out: Problems = new Map();
  if ('error' in ev) {
    out.set('build', { rank: 3, title: ev.error.title, fix: ev.error.text, knobs: ev.error.knobs });
    return out;
  }
  for (const f of ev.findings) {
    const rank = RANK[f.severity];
    if (rank > 0 && rank > (out.get(f.id)?.rank ?? 0)) out.set(f.id, { rank, title: f.title, fix: f.fix, knobs: f.knobs });
  }
  return out;
}

/** Sorun kümesinin ağırlığı: en yüksek önem, sonra sayı (küçük iyi) */
const severityOf = (p: Problems): [number, number] => [Math.max(0, ...[...p.values()].map((v) => v.rank)), p.size];
const lighter = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** `p`'de olup izinlilerde aynı ya da daha yüksek önemle olmayan sorunlar */
function newProblems(p: Problems, allowed: Problems[]): Problems {
  const out: Problems = new Map();
  for (const [id, v] of p) if (!allowed.some((a) => (a.get(id)?.rank ?? 0) >= v.rank)) out.set(id, v);
  return out;
}

/**
 * Kart yolunun çalışabilirlik güvencesi (sihirbazla aynı ölçüt): taşınan ya
 * da korunan değerlerle motor, seed'de ve sihirbazın motorunda olmayan bir
 * uyarı (caution/warning; EGT payı ≤ 0 dahil) veriyorsa REVERTIBLE
 * düğmeleri ailenin değerine (sihirbazın aynı mimarideki grafiği) geri
 * alır: önce tek tek (sırayla ilk yeten), yetmezse sırayla birikerek.
 * Geri alınanlar nedeniyle notta. BPR geri alınınca çekirdek akışı korunur.
 */
function ensureWorkable(seed: EngineGraph, from: Architecture, g: EngineGraph, to: Architecture, notes: ArchNote[]): EngineGraph {
  const reference = referenceFor(to);
  const p = problemsOf(g, reference);
  if (!p || p.size === 0) return g;
  const seedP = problemsOf(seed, referenceFor(from)) ?? new Map();
  if (newProblems(p, [seedP]).size === 0) return g;
  const wizard = graphFromArchitecture(to, { massFlow: templateGraph(familyOf(to)).massFlow, name: g.name });
  const allowed = [seedP, problemsOf(wizard, reference) ?? new Map()];
  const bad = newProblems(p, allowed);
  if (bad.size === 0) return g;

  const changed = REVERTIBLE.filter((id) => {
    const a = readKnob(g, id);
    const b = readKnob(wizard, id);
    return a !== undefined && b !== undefined && a !== b;
  });
  const revert = (base: EngineGraph, ids: readonly KnobId[]): EngineGraph => {
    const c = clone(base);
    for (const id of ids) {
      const v = readKnob(wizard, id)!;
      if (id === 'fan.bypassRatio') c.massFlow *= (1 + v) / (1 + (readKnob(c, id) ?? 0));
      writeKnob(c, id, v);
    }
    clampMassFlow(c, to, [], '');
    return c;
  };
  /** Geri alma denemesi: kalan yeni sorunlar (değerlendirilemezse null) */
  const trial = (ids: KnobId[]) => {
    const c = revert(g, ids);
    const q = problemsOf(c, reference);
    return { ids, c, q: q && newProblems(q, allowed) };
  };
  const trials: ReturnType<typeof trial>[] = [];
  const accepted = (t: ReturnType<typeof trial>) => (trials.push(t), t.q !== null && t.q.size === 0);

  // Önce tek tek (sırayla ilk yeten), yetmezse sırayla birikerek
  let hit = changed.map((id) => [id]).map(trial).find(accepted);
  for (let i = 2; !hit && i <= changed.length; i++) {
    const t = trial(changed.slice(0, i));
    if (accepted(t)) hit = t;
  }
  const titles = (p: Problems) => [...p.values()].map((v) => v.title).join('; ');
  if (hit) {
    revertNotes(g, hit.c, hit.ids, `Bu değerle yeni motor sınırı aşıyor (${titles(bad)}): ailenin değeri kullanıldı.`, notes);
    return hit.c;
  }

  // Hiçbir geri alma kümesi uyarıyı tamamen gidermiyor (örn. turboprop →
  // fan → ayrık akış: korunan küçük çekirdekte HPC son kanadı kısa; ailenin
  // değerleri EGT payını düzeltir ama kanadı kısaltır). Yanıltıcı "ailenin
  // değeri kullanıldı" notu yerine: sorunu en çok hafifleten en küçük
  // küme (yoksa hiçbir şey) geri alınır, giderdiği sorun yazılır; kalan
  // sorun, değeri değişmeyen `residual` notla nedeni ve önerisiyle bildirilir.
  let best = { ids: [] as KnobId[], c: g, q: bad };
  for (const t of trials) {
    if (!t.q) continue;
    const [a, b] = [severityOf(t.q), severityOf(best.q)];
    // Daha hafif ya da eşit ağırlıkta daha az geri alma (hiç geri almamak eşitlikte kalır)
    const fewer = best.ids.length > 0 && t.ids.length < best.ids.length && !lighter(b, a);
    if (lighter(a, b) || fewer) best = { ids: t.ids, c: t.c, q: t.q };
  }
  // Gereksiz geri almaları ayıkla: çıkarınca ağırlık artmıyorsa düğme kalır
  for (const id of [...best.ids]) {
    if (best.ids.length <= 1) break;
    const t = trial(best.ids.filter((x) => x !== id));
    if (t.q && !lighter(severityOf(best.q), severityOf(t.q))) best = { ids: t.ids, c: t.c, q: t.q };
  }
  if (best.ids.length) {
    const fixed = new Map([...bad].filter(([id, v]) => (best.q.get(id)?.rank ?? 0) < v.rank));
    revertNotes(g, best.c, best.ids, `Bu değerle yeni motor sınırı aşıyordu (${titles(fixed)}): ailenin değeri kullanıldı; bu onu giderdi ama motorda başka bir sorun kalıyor.`, notes);
  }
  const out = best.c;
  for (const v of best.q.values()) {
    // Öneri düğmesi: motorda olan, geri alınmamış ilk TEMEL düğme (yoksa hava akışı)
    const usable = (k: string) => !best.ids.includes(k as KnobId) && knobById(k as KnobId)?.level === 'basic' && readKnob(out, k as KnobId) !== undefined;
    const knob = (v.knobs.find(usable) ?? 'engine.massFlow') as KnobId;
    const val = readKnob(out, knob) ?? out.massFlow;
    notes.push({
      knob,
      from: val,
      to: val,
      residual: true,
      reason: `Yeni motor bu mimaride uyarı veriyor (${v.title}); ailenin değerlerine dönmek bunu gidermiyor. ${v.fix}`,
    });
  }
  return out;
}

/** Geri alınan düğmelerin notları (BPR geri alınınca hava akışı da) */
function revertNotes(g: EngineGraph, out: EngineGraph, ids: readonly KnobId[], reason: string, notes: ArchNote[]): void {
  for (const id of ids) addNote(notes, { knob: id, from: readKnob(g, id)!, to: readKnob(out, id)!, reason });
  if (Math.abs(out.massFlow / g.massFlow - 1) > 1e-9) {
    addNote(notes, { knob: 'engine.massFlow', from: g.massFlow, to: out.massFlow, reason: 'Baypas oranı ailenin değerine alındı: çekirdek akışı korunur.' });
  }
}

/**
 * Mimariye uygun grafik: modül ekler/çıkarır, ortak düğmeleri `seed`den
 * taşır. Çekirdek akışı korunur: massFlow' = massFlow·(1+bpr')/(1+bpr).
 *
 * LP yükü değişince gaz jeneratörü yeni ailenin şablonundan gelir, ortak
 * düğmeler (T4, HPC PR, verimler, yanma odası) seed'den taşınır; tablodaki
 * taşımalar (LPC↔fan uç hızı, yeni fanın BPR'ı) uygulanır. Aile değişince
 * `ops` atılır: çalışabilirlik yeni ailenin şablonundan ölçeklenir.
 * Mimari değişince bütün düğmeler yeni ailenin aralığına (knobs.ts)
 * kırpılır; motor seed'de ve sihirbazda olmayan bir uyarı veriyorsa
 * taşınan değerler ailenin değerine geri alınır (ensureWorkable).
 * Korunamayan değerler `notes`'ta (kırpma, kurulamama, uyarı, kutu sayısı).
 */
export function applyArchitectureReport(seed: EngineGraph, next: Architecture): { graph: EngineGraph; notes: ArchNote[] } {
  const from = architectureOf(seed);
  const to = normalizeArchitecture(next);
  const notes: ArchNote[] = [];
  let g: EngineGraph;
  if (from.lpLoad !== to.lpLoad) {
    g = changeLpLoad(seed, from, to, notes);
  } else {
    g = reshapeGraph(clone(seed), to, notes);
    delete g.kind;
    if (familyOf(from) !== familyOf(to)) delete g.ops;
    if (archKey(from) !== archKey(to)) g.summary = describeArchitecture(to);
    // BPR değişince çekirdek akışı korunur; sonuç ailenin aralığına
    clampMassFlow(g, to, notes, 'çekirdek akışı korunamadı.');
  }
  // Aralıklar yeni ailenin (knobs.ts), sonra çalışabilirlik (sihirbazla aynı ölçüt)
  if (archKey(from) !== archKey(to)) {
    clampToKnobRanges(g, notes);
    g = ensureWorkable(seed, from, g, to, notes);
  }
  // Kutular her mimari değişiminde yeniden sığdırılır: booster, kurulum ya da
  // akış değişimi çekirdeğin ortalama yarıçapını değiştirir
  const c = find<CombustorModule>(g, 'combustor');
  if (c && c.style !== 'annular') {
    const sc = find<CombustorModule>(seed, 'combustor');
    const seedCans = sc?.style === c.style ? sc.cans : undefined;
    const vref = c.refVelocity;
    fitCans(g, referenceFor(to));
    if (seedCans !== undefined && c.cans !== undefined && c.cans < seedCans) {
      addNote(notes, { knob: 'combustor.cans', from: seedCans, to: c.cans, reason: `${seedCans} kutu yeni çekirdeğin çevresine sığmıyor: sığana dek azaltıldı.` });
    }
    if (c.refVelocity > vref) {
      // Aynı LP yükünde kullanıcının değerinden (stil dönüşümü de onu değiştirmiş olabilir)
      const was = from.lpLoad === to.lpLoad && sc ? sc.refVelocity : vref;
      addNote(notes, { knob: 'combustor.refVelocity', from: was, to: c.refVelocity, reason: 'En az kutuyla bile çevreye sığmıyor: kutular incelsin diye referans hız artırıldı.' });
    }
  }
  return { graph: g, notes };
}

/** Aynı düğmenin notu varsa ilk değeri korunur, son değer ve neden güncellenir */
function addNote(notes: ArchNote[], n: ArchNote): void {
  const i = notes.findIndex((x) => x.knob === n.knob);
  if (i < 0) notes.push(n);
  else notes[i] = { ...n, from: notes[i].from };
}

/** applyArchitectureReport'un grafiği (§2.4 sözleşmesi) */
export function applyArchitecture(seed: EngineGraph, next: Architecture): EngineGraph {
  return applyArchitectureReport(seed, next).graph;
}

/* ------------------------------------------------------------------ */
/* Geçerlilik                                                          */
/* ------------------------------------------------------------------ */

const ruleMsg = (id: string) => GRAPH_RULES.find((r) => r.id === id)!.msg;

/** Grafikle anlatılamayan ya da anlamsız seçimlerin metinleri */
const ARCH_MSG = {
  freeTurbineAb: 'Art yakıcı jet itkisini artırır: pervaneli ya da çıkış milli motorda gücün çoğu mile gider, egzoz kısa bir borudur.',
  booster: 'Booster fanın arkasındaki alçak basınç kompresörüdür: önce LP yükü olarak fanı seç.',
  freeTurbineExhaust: 'Pervaneli ve çıkış milli motorda baypas yok: egzoz kısa bir borudur.',
  mixerNoBypass: ruleMsg('mixer.bypass'),
} as const;

/**
 * Mimari kurulabilir mi: yerel kurallar → GRAPH_RULES (mimariden kurulan
 * grafikte) → yerleşim hazır mı. Geçerliyse null; değilse tipli hata
 * (GraphError.ruleId ya da FlowpathError.code = 'layout.notReady').
 */
export function checkArchitecture(a: Architecture): GraphError | FlowpathError | null {
  const n = normalizeArchitecture(a);
  // Önce GRAPH_RULES: buildEngine ile aynı kural ve metin (yerel kural ancak
  // kurallar sessizse; GRAPH_RULES'a eklenince kendiliğinden devre dışı kalır)
  const g = graphSkeleton(n, { massFlow: templateGraph(familyOf(n)).massFlow, name: '' });
  const e = checkGraph(g);
  if (e) return e;
  if (n.afterburner && freeTurbine(n)) return new GraphError(ARCH_MSG.freeTurbineAb, 'arch.freeTurbineAb', 'afterburner');
  const why = layoutNotReady(g);
  if (why) return new FlowpathError(why, 'layout.notReady', 'engine');
  return null;
}

/* ------------------------------------------------------------------ */
/* Seçenekler (mimari kartları)                                        */
/* ------------------------------------------------------------------ */

interface OptionSpec {
  axis: keyof Architecture;
  value: string | boolean;
  card: ArchCard;
  /** Seçenek uygulanmış mimaride zorunlu eşlik edenler */
  requires?(a: Architecture): Partial<Architecture>;
  /** Eşlik edenlerin nedeni (kartta "çünkü …") */
  why?: string;
  /** Gelecek kilometre taşı (kart hep kilitli) */
  future?: string;
}

const SPECS: readonly OptionSpec[] = [
  /* --- çıkış --- */
  {
    axis: 'output',
    value: 'thrust',
    card: {
      title: 'İtki',
      does: 'Motor gücünü jetle (ya da pervaneyle) itkiye çevirir.',
      gains: 'Uçağı doğrudan iter.',
      costs: 'Jet hızı yüksekse verim düşer.',
      examples: 'J79, CFM56, PW150',
      lesson: 'brayton',
    },
    requires: (a) => (a.lpLoad === 'shaft' ? { lpLoad: 'lpc' } : {}),
    why: 'itki üreten motorun LP mili kompresör, fan ya da pervane çevirir',
  },
  {
    axis: 'output',
    value: 'shaft',
    card: {
      title: 'Mil gücü',
      does: 'Gaz jeneratörünün gücü serbest türbinden bir mile verilir.',
      gains: 'Helikopter rotoru, jeneratör ya da pompa çevirir.',
      costs: 'Jet itkisi neredeyse yok.',
      examples: 'T700, Makila',
      glossary: 'shaftPower',
    },
    requires: () => ({ lpLoad: 'shaft' }),
    why: 'mil gücü serbest güç türbininin çıkış milinden alınır',
  },
  /* --- LP yükü --- */
  {
    axis: 'lpLoad',
    value: 'lpc',
    card: {
      title: 'Tek akış (turbojet)',
      does: 'LP mili yalnız alçak basınç kompresörünü çevirir; bütün hava çekirdekten geçer.',
      gains: 'Küçük çap, yüksek özgül itki, basit yapı.',
      costs: 'Yüksek jet hızı: TSFC ve jet gürültüsü yüksek.',
      examples: 'J79, J57',
      lesson: 'brayton',
      glossary: 'brayton',
    },
    requires: () => ({ output: 'thrust', booster: false, centrifugal: false, exhaust: 'single', installation: 'bare' }),
    why: 'baypassız motorda tek jet borusu var, kaporta fanlı motor içindir',
  },
  {
    axis: 'lpLoad',
    value: 'fan',
    card: {
      title: 'Fan (turbofan)',
      does: 'LP mili önde bir fan çevirir; havanın bir kısmı çekirdeğin yanından (baypas) geçer.',
      gains: 'Daha çok havayı daha yavaş itmek: TSFC ve gürültü düşer.',
      costs: 'Çap ve LPT büyür; yüksek hızda özgül itki düşer.',
      examples: 'CFM56, F100',
      lesson: 'anatomy',
      glossary: 'bpr',
    },
    requires: (a) => ({
      output: 'thrust',
      centrifugal: false,
      exhaust: a.exhaust === 'single' ? (a.installation === 'nacelle' ? 'separate' : 'mixed') : a.exhaust,
      ...(a.installation === 'nacelle' ? { booster: true } : {}),
    }),
    why: 'baypas havası ya ayrı lüleden çıkar ya da çekirdekle karışır',
  },
  {
    axis: 'lpLoad',
    value: 'propeller',
    card: {
      title: 'Pervane + redüktör (turboprop)',
      does: 'Serbest güç türbini, dişli kutusuyla yavaş dönen büyük bir pervaneyi çevirir.',
      gains: 'Düşük hızda en verimli itki; kısa pistten kalkış.',
      costs: 'Pervane ucu Mach sınırı yüksek hızı keser; redüktör ağır.',
      examples: 'PW150, T56',
      lesson: 'altitude',
      glossary: 'shaftPower',
    },
    requires: () => ({ output: 'thrust', centrifugal: true, booster: false, exhaust: 'single', afterburner: false, installation: 'bare' }),
    why: 'küçük gaz jeneratörü santrifüj son kademe ister, egzoz kısa bir borudur',
  },
  {
    axis: 'lpLoad',
    value: 'shaft',
    card: {
      title: 'Çıkış mili (turboşaft)',
      does: 'Serbest güç türbini gücü önden çıkan bir milden verir.',
      gains: 'Hafif ve küçük: helikopter rotoru ya da jeneratör çevirir.',
      costs: 'İtki yok; çıkış devri yükün valisine bağlı.',
      examples: 'T700, Makila',
      glossary: 'turboshaft',
    },
    requires: () => ({ output: 'shaft', centrifugal: true, booster: false, exhaust: 'single', afterburner: false, installation: 'bare' }),
    why: 'küçük gaz jeneratörü santrifüj son kademe ister, egzoz kısa bir borudur',
  },
  {
    axis: 'lpLoad',
    value: 'gearedFan',
    card: {
      title: 'Dişli fan',
      does: 'Fan, LPT’den bir redüktörle daha yavaş döner.',
      gains: 'Fan ve LPT kendi en iyi devrinde: daha az LPT kademesi, daha yüksek BPR.',
      costs: 'Redüktör ağır ve ısınır.',
      examples: 'PW1000G',
      glossary: 'bpr',
    },
    future: "Dişli fan M5b'de.",
  },
  {
    axis: 'lpLoad',
    value: 'openRotor',
    card: {
      title: 'Açık rotor',
      does: 'Kaportasız, karşıt dönen iki sıra geniş pal.',
      gains: 'Çok yüksek baypas: turboprop verimi, jete yakın hız.',
      costs: 'Gürültü ve kanat yerleşimi zor.',
      examples: 'GE36 UDF, CFM RISE',
    },
    future: "Açık rotor M5c'de.",
  },
  /* --- booster --- */
  {
    axis: 'booster',
    value: true,
    card: {
      title: 'Booster var',
      does: 'Fanın arkasında, fan miliyle dönen birkaç kademelik alçak basınç kompresörü.',
      gains: 'Çekirdeğe giren havayı önceden sıkıştırır: HPC kısalır.',
      costs: 'LP miline ek kademe ve kütle.',
      examples: 'CFM56',
      lesson: 'anatomy',
    },
  },
  {
    axis: 'booster',
    value: false,
    card: {
      title: 'Booster yok',
      does: 'Fanın göbek bölgesi çekirdeği doğrudan besler.',
      gains: 'Kısa ve hafif LP mili.',
      costs: 'Basıncın tamamını HPC yapar: daha çok HP kademesi.',
      examples: 'F100, F110',
    },
  },
  /* --- HPC --- */
  {
    axis: 'centrifugal',
    value: false,
    card: {
      title: 'Eksenel HPC',
      does: 'Bütün kademeler eksenel.',
      gains: 'Büyük akışta verimli ve ince.',
      costs: 'Küçük motorda son kanatlar çok kısalır, uç boşluğu verimi düşürür.',
      examples: 'CFM56, J79',
      glossary: 'opr',
    },
  },
  {
    axis: 'centrifugal',
    value: true,
    card: {
      title: 'Eksenel + santrifüj',
      does: 'Son kademe bir santrifüj çark: havayı dışa doğru savurarak sıkıştırır.',
      gains: 'Küçük akışta kısa kanat sorunu yok; sağlam ve kısa.',
      costs: 'Çap büyür; büyük motorda verimsiz.',
      examples: 'T700, PW100',
      glossary: 'opr',
    },
  },
  /* --- yanma odası --- */
  {
    axis: 'combustor',
    value: 'annular',
    card: {
      title: 'Halka',
      does: 'Tek halka biçimli gömlek, çevresinde yakıt enjektörleri.',
      gains: 'Kısa, hafif, basınç kaybı düşük; türbine düzgün sıcaklık.',
      costs: 'Bakımda bütün oda birlikte sökülür.',
      examples: 'CFM56, F100',
      lesson: 'brayton',
    },
  },
  {
    axis: 'combustor',
    value: 'can',
    card: {
      title: 'Kutu',
      does: 'Ayrı ayrı kutu gömlekler, her biri kendi basınç kabında; ateşleme geçiş borularıyla birbirine bağlı.',
      gains: 'Tek kutu test edilip değiştirilebilir; sağlam.',
      costs: 'Ağır, uzun, basınç kaybı yüksek.',
      examples: 'RR Dart, J33',
      lesson: 'start',
    },
  },
  {
    axis: 'combustor',
    value: 'canAnnular',
    card: {
      title: 'Kutu-halka',
      does: 'Kutu gömlekler ortak bir halka kasanın içinde.',
      gains: 'Kutunun kolay geliştirilmesi, halkanın hafif kasası.',
      costs: 'Halkadan ağır ve uzun; çıkışta sıcaklık daha düzensiz.',
      examples: 'J57, JT8D, J79',
      lesson: 'start',
    },
  },
  /* --- egzoz --- */
  {
    axis: 'exhaust',
    value: 'single',
    card: {
      title: 'Tek jet',
      does: 'Bütün gaz tek lüleden çıkar (baypas yok).',
      gains: 'Basit egzoz.',
      costs: 'Baypaslı motorda kullanılamaz.',
      examples: 'J79, PW150',
    },
  },
  {
    axis: 'exhaust',
    value: 'separate',
    card: {
      title: 'Ayrık akış',
      does: 'Baypas havası fan kanalının kendi lülesinden, çekirdek gazı iç lüleden çıkar.',
      gains: 'Kısa kaporta, hafif.',
      costs: 'Karışmadan kalan sıcak çekirdek jeti biraz verim ve ses bedeli.',
      examples: 'CFM56-7',
      glossary: 'bpr',
    },
    requires: () => ({ afterburner: false, installation: 'nacelle' }),
    why: 'ayrık lüleli motor kaportalıdır ve art yakıcısı olmaz',
  },
  {
    axis: 'exhaust',
    value: 'mixed',
    card: {
      title: 'Karışık akış',
      does: 'Baypas ve çekirdek akışı karıştırıcıda buluşur, ortak lüleden çıkar.',
      gains: 'Sıcak ve soğuk akış ısıyı paylaşır: TSFC %1–3 iyi, jet sesi düşer.',
      costs: 'Uzun kanal ve karıştırıcı: kütle artar.',
      examples: 'CFM56-5C, F100, TFE731',
      glossary: 'mixer',
    },
  },
  {
    axis: 'mixer',
    value: 'confluent',
    card: {
      title: 'Düz karıştırıcı',
      does: 'İki akış düz bir halkada yan yana buluşur, jet borusunda kısmen karışır.',
      gains: 'Basit ve hafif; sürtünme kaybı az.',
      costs: 'Karışma eksik kalır (verim ~%85).',
      examples: 'F100, CFM56-5C',
      glossary: 'mixer',
    },
    requires: () => ({ exhaust: 'mixed' }),
    why: 'karıştırıcı karışık akışlı egzozun parçasıdır',
  },
  {
    axis: 'mixer',
    value: 'lobed',
    card: {
      title: "Lobe'lu karıştırıcı",
      does: 'Çiçek biçimli lobe’lar akışları iç içe geçirir.',
      gains: 'Karışma neredeyse tam (verim ~%97): TSFC ve ses düşer.',
      costs: 'Ek sürtünme kaybı ve kütle.',
      examples: 'TFE731, PW300',
      glossary: 'mixer',
    },
    requires: () => ({ exhaust: 'mixed' }),
    why: 'karıştırıcı karışık akışlı egzozun parçasıdır',
  },
  /* --- art yakıcı --- */
  {
    axis: 'afterburner',
    value: true,
    card: {
      title: 'Art yakıcı var',
      does: 'Türbinden sonra jet borusunda ikinci kez yakıt yakılır.',
      gains: 'Kısa süreli %40–70 ek itki (kalkış, ses üstü hız).',
      costs: 'Yakıt tüketimi 2–3 kat; değişken lüle ve uzun jet borusu ağır.',
      examples: 'J79, F100',
      lesson: 'fadec',
    },
    requires: (a) => ({ installation: 'bare', ...(a.lpLoad === 'fan' ? { exhaust: 'mixed', abNozzle: 'cd' } : {}) }),
    why: 'art yakıcı tek bir jet borusunda yanar ve değişken lüle ister; kaportalı motorda yer yok',
  },
  {
    axis: 'afterburner',
    value: false,
    card: {
      title: 'Art yakıcı yok',
      does: 'Lüle sabit yakınsak.',
      gains: 'Hafif, kısa, ekonomik.',
      costs: 'İtki çekirdekle sınırlı.',
      examples: 'J57, CFM56',
    },
  },
  {
    axis: 'abNozzle',
    value: 'convergent',
    card: {
      title: 'Değişken yakınsak lüle',
      does: 'Yapraklar art yakıcı yanınca açılır; ağız boğazdır.',
      gains: 'Basit, hafif.',
      costs: 'Yüksek basınç oranında jet tam genleşmez.',
      examples: 'J79',
    },
    requires: () => ({ afterburner: true }),
    why: 'değişken kesitli lüle yalnız art yakıcıyla gerekir',
  },
  {
    axis: 'abNozzle',
    value: 'cd',
    card: {
      title: 'Yakınsak-ıraksak lüle',
      does: 'Boğazdan sonra açılan ikinci yaprak sırası jeti ses üstüne genleştirir.',
      gains: 'Yüksek basınç oranında daha çok itki.',
      costs: 'Ağır ve karmaşık.',
      examples: 'F100, F110',
    },
    requires: () => ({ afterburner: true }),
    why: 'değişken kesitli lüle yalnız art yakıcıyla gerekir',
  },
  /* --- kurulum --- */
  {
    axis: 'installation',
    value: 'nacelle',
    card: {
      title: 'Kaportalı',
      does: 'Fan ve motor, kanattan sarkan bir kaportanın içinde; giriş dudaklı.',
      gains: 'Yolcu uçağı yerleşimi; fan kanalı baypas akışını taşır.',
      costs: 'Kaporta kütlesi ve sürtünmesi.',
      examples: 'CFM56, CF6',
      glossary: 'bpr',
    },
    requires: () => ({ booster: true, afterburner: false }),
    why: 'kaportalı turbofan şimdilik booster ister ve art yakıcısı olmaz',
  },
  {
    axis: 'installation',
    value: 'bare',
    card: {
      title: 'Çıplak',
      does: 'Motor gövdenin içine gömülür; test hücresinde ağızlık (bellmouth) takılır.',
      gains: 'Kısa ve dar: savaş uçağı gövdesine sığar.',
      costs: 'Yüksek baypas oranı için kaporta gerekir.',
      examples: 'J79, F100',
    },
    requires: (a) => (a.exhaust === 'separate' ? { exhaust: 'mixed' } : {}),
    why: 'çıplak motorda baypas akışı karıştırılır',
  },
];

const specOf = (axis: keyof Architecture, value: unknown) => SPECS.find((s) => s.axis === axis && s.value === value);

/** Seçim normalleştirmede anlamını yitirirse (ör. fansız booster) öğretici metin */
function meaningless(n: Architecture, axis: keyof Architecture): string {
  switch (axis) {
    case 'booster':
      return ARCH_MSG.booster;
    case 'exhaust':
      return ARCH_MSG.freeTurbineExhaust;
    case 'mixer':
      return freeTurbine(n) ? ARCH_MSG.freeTurbineExhaust : ARCH_MSG.mixerNoBypass;
    case 'installation':
      return ruleMsg('inlet.nacelle');
    case 'abNozzle':
      return freeTurbine(n) ? ARCH_MSG.freeTurbineAb : ruleMsg('nozzle.variableNeedsAb');
    default:
      return 'Bu seçenek bu mimaride anlamsız.';
  }
}

/**
 * Bir eksen değişimi: seçimi uygular, zorunlu eşlik edenleri zincir halinde
 * ekler (kullanıcının seçtiği eksen asla geri çevrilmez), sonra mimariyi
 * denetler. Geçersizse kuralın öğretici metniyle `{ blocked }`.
 */
export function resolveChange(a: Architecture, axis: keyof Architecture, value: unknown): ArchChange {
  const spec = specOf(axis, value);
  if (!spec) return { blocked: `Bilinmeyen mimari seçeneği: ${String(axis)} = ${String(value)}.` };
  if (spec.future) return { blocked: spec.future };
  const start = normalizeArchitecture(a);
  const cur: Architecture = { ...start, [axis]: value } as Architecture;
  const reasons = new Map<keyof Architecture, string>();
  const queue: (keyof Architecture)[] = [axis];
  for (let guard = 0; queue.length && guard < 32; guard++) {
    const ax = queue.shift()!;
    const s = specOf(ax, cur[ax]);
    const req = s?.requires?.(cur) ?? {};
    for (const k of Object.keys(req) as (keyof Architecture)[]) {
      if (k === axis || cur[k] === req[k]) continue;
      (cur as unknown as Record<string, unknown>)[k] = req[k];
      reasons.set(k, `${s!.card.title}: ${s!.why ?? 'zorunlu eşlik eden değişiklik'}`);
      queue.push(k);
    }
  }
  const n = normalizeArchitecture(cur);
  if (n[axis] !== value) return { blocked: meaningless(n, axis) };
  const err = checkArchitecture(n);
  if (err) return { blocked: err.message };
  const implied = AXES.filter((k) => k !== axis && n[k] !== start[k]).map((k) => ({
    axis: k,
    from: start[k] as unknown,
    to: n[k] as unknown,
    reason: reasons.get(k) ?? 'Mimari tutarlılığı',
  }));
  return { arch: n, implied };
}

/** Mimari kartları: eksen başına seçenekler; kilitli kart nedenini öğretir */
export const ARCH_OPTIONS: readonly ArchOption[] = SPECS.map(
  (s): ArchOption => ({
    axis: s.axis,
    value: s.value,
    card: s.card,
    implies(a) {
      const r = resolveChange(a, s.axis, s.value);
      if ('blocked' in r) return {};
      return Object.fromEntries(r.implied.map((i) => [i.axis, i.to])) as Partial<Architecture>;
    },
    blocked(a) {
      if (s.future) return s.future;
      const r = resolveChange(a, s.axis, s.value);
      return 'blocked' in r ? r.blocked : null;
    },
  }),
);
