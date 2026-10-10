/**
 * Kaportalı turbofan yerleşimi. engine/core.js, fan.js, nacelle.js,
 * pylon.js girdisi. İki egzoz düzeni:
 *
 * - Ayrık akış (CFM56-7, LEAP): kısa fan kaportası, baypas lülesi çekirdek
 *   kaportasının ortasında biter, çekirdek kendi lülesinden çıkar.
 * - Karışık akış (M5a P6; CFM56-5C, TFE731, PW300): uzun kanallı kaporta
 *   baypas havasını motorun sonuna kadar taşır. Çekirdek kaportası LPT
 *   arkasındaki karıştırıcıda biter; iki akış karıştırma kanalında buluşur
 *   ve ortak sabit yakınsak lüleden çıkar. Lüle ağzı tasarım noktasının
 *   ortak lüle alanından (A9mix, sim/design.ts); kanal boyu ağız
 *   yarıçapının 1,6 katı (karışma için L/D ≈ 0,8).
 */

import { AIR } from '../../sim/gas';
import type { SizedEngine, Station } from '../../sim/design';
import type { MountPoint } from '../card';
import {
  FlowpathError,
  RHO,
  SHELL_T,
  annulusArea,
  envelopeOf,
  moduleOf,
  profileAt,
  shellMass,
  tipMachRel,
  type CombustorGeometry,
  type GasPath,
  type RowGeometry,
} from '../flowpath';
import type { CompressorModule, EngineGraph, MixerModule, NozzleModule } from '../types';
import type { LayoutResult } from './index';

/** Ayrık akışlı dal hazır */
export const READY = true;
/** Karışık akışlı (uzun kanallı, ortak lüleli) dal: M5a P6 */
export const READY_MIXED = true;

/** Karıştırma kanalı boyu / ortak lüle ağzı yarıçapı (şartname §3.4) */
export const MIXING_DUCT_LD = 1.6;
/** Karışık akışta egzoz konisi ucunun ortak lüle ağzından çıkıntısı / ağız yarıçapı (şartname §3.4) */
export const PLUG_PROTRUSION = 0.7;
/** Ortak lüle ve karıştırıcı sacı et kalınlığı [m] (inconel, kütle) */
const MIX_SHEET_T = 0.003;
/** Karışık akış: çekirdek kaportasının fan kanalı iç duvarına en az açıklığı (fan ucu oranında) */
const MIN_DUCT_GAP = 0.04;
/**
 * Karışık akış: çekirdek kaportası boşluk payının en çok daraltılabileceği
 * oran. Paylar (aksesuar, boru, bleed) M4 öncesi TF referansında mutlak
 * metre; küçük ya da düşük baypaslı karışık TF'de kanal kapanırsa bu orana
 * kadar orantılı daraltılır (en dar boşluk: bleed payı 0,058 → 17 mm).
 */
export const CORE_CLEARANCE_MIN = 0.3;
/**
 * Karışık akış: fan kanalının ön kısmında (OGV → itki çevirici başı) en dar
 * halka alanında baypas akışının hedef ortalama Mach'ı. Geometrik açıklık
 * yetmez: küçük motorda kanal açık ama tıkalı kalıyordu (W 300'de Mach 1).
 * Şablon (CFM56-5C) bu kesitte 0,76'da; şablonu değiştirmemek için hedef
 * 0,8 (gerçek fan çıkış kanalları ~0,5: şablonun çekirdek kaportası büyük,
 * açık sorun).
 */
export const FAN_DUCT_MACH_MAX = 0.8;
/**
 * Ayırıcı burnu (core.js): profil ağızdan (rS) geriye 0,022 / 0,034 /
 * 0,04 m × `lip` iner; iç yüzeyi booster gövdesinin üstünden geçer. Gövde
 * dış yüzeyi uç + 0,004 (boşluk + aşınabilir şerit) + 0,008 (et); burnun
 * iç yüzeyi bunun en az 2 mm dışında kalmalı. Ayrık akışta (c = 1) bleed
 * payı 0,058 ≥ 0,014 + 0,04: değişmez.
 */
export const SPLITTER_LIP_DROP = 0.04;
export const SPLITTER_CASE_CLEAR = 0.014;
/**
 * Ortak sabit yakınsak lülenin ağız yarıçapının karıştırma düzlemindeki
 * kanal duvarına en büyük oranı. Karışmış akışın basıncı düşükse (baypas
 * basıncı çekirdeğinkinin çok altında, P19t/P5t ≈ 0,3–0,4) A9mix
 * A9 + A19'un 3–4 katına çıkar: ağız kanaldan geniş olur, "yakınsak" lüle
 * ıraksar ve kaporta arkası trompet gibi açılırdı. Şablon 0,75.
 */
export const MIXED_NOZZLE_CONTRACTION_MAX = 0.95;
/** Egzoz konisinin M4 öncesi ojiv profili: [taban yarıçapı oranı, boy (taban 0,4 m'de)] */
const PLUG_SHAPE: readonly [number, number][] = [
  [1, 0],
  [0.993, 0.11],
  [0.96, 0.26],
  [0.88, 0.45],
  [0.75, 0.66],
  [0.58, 0.855],
  [0.395, 1.015],
  [0.215, 1.125],
  [0.075, 1.182],
  [0, 1.205],
];

/** M4 öncesi elle modellenmiş turbofanın fan uç yarıçapı: fan/kaporta/pilon şekilleri buna göre ölçeklenir */
export const TF_REF_FAN_TIP = 1.386;
/** Lüle akış katsayıları (etkin / geometrik alan): baypas ve çekirdek */
const CD_BYPASS = 0.89;
const CD_CORE = 0.97;

/** engine/core.js, fan.js, nacelle.js, pylon.js girdisi */
export interface TurbofanLayout {
  style: 'nacelle';
  /** Fan, kaporta ve pilonun ölçeği (fan ucu / M4 öncesi model) */
  s: number;
  fan: RowGeometry;
  booster: RowGeometry;
  hpc: RowGeometry;
  hpt: RowGeometry;
  lpt: RowGeometry;
  combustor: CombustorGeometry;
  shafts: { lp: [number, number, number]; hp: [number, number, number] };
  /**
   * Ayırıcı burnu (ağız yarıçapı; `lip`: burun inişinin ölçeği, karışık
   * akışta kaporta payı ölçeği c, yoksa 1) ve çekirdek kaportası profili
   * [r, z] (lüle başına kadar)
   */
  splitter: { z: number; r: number; lip?: number };
  coreCowl: [number, number][];
  /** Baypas lülesi ağzı: z, çekirdek kaportası ve kaporta iç duvarı yarıçapları */
  bypassExit: { z: number; rCore: number; rDuct: number };
  /** Çekirdek lülesi: başı ve ağzı; egzoz konisi profili [r, z] */
  coreNozzle: { z0: number; r0: number; z1: number; r1: number };
  plug: [number, number][];
  /** Türbin arka çerçevesi ve egzoz kanalı iç duvarı */
  rearFrame: { z: number; hub: number; tip: number };
  exhaustDuct: [number, number][];
  /** Fan çıkış yönlendiricileri ve çerçeve kolları */
  ogv: { z: number; hub: number; tip: number };
  struts: { z: number; hub: number; tip: number };
  intake: { z: number; radius: number; y: number };
  /** Çekirdek lülesi ağzı (egzoz akışı ve efektler) */
  exhaustExit: { z: number; radius: number };
  /** Lüle arka kenarlarındaki chevron sayıları (0: düz kenar) */
  chevrons: { core: number; bypass: number };
  /** Gövde bağlantıları (motor kartı): fan kasası üstü + türbin arka çerçevesi */
  mounts: MountPoint[];
  /** Dış zarf [z, r], z artan (kaporta + çekirdek kaportası + koni) */
  outerProfile: [number, number][];
  /**
   * Karışık akış (uzun kanallı kaporta); ayrık akışta yok. Varken
   * `coreNozzle` çekirdek akışının karıştırıcıdan çıkışını, `bypassExit`
   * baypas akışının karıştırma düzlemine girişini anlatır; `exhaustExit`
   * ortak lüle ağzıdır.
   */
  mixed?: MixedExhaust;
}

/** Uzun kanallı kaportanın karıştırıcısı, karıştırma kanalı ve ortak lülesi */
export interface MixedExhaust {
  /** Karıştırıcı: çekirdek kaportasının arka kenarından başlar (lobe'lu: çıkışta ±amp) */
  mixer: { z0: number; z1: number; r: number; amp: number; lobes: number; style: 'confluent' | 'lobed' };
  /** Kaporta iç duvarı karıştırma düzleminde (karıştırıcı çıkışı) */
  ductEnd: { z: number; r: number };
  /** Ortak sabit yakınsak lüle: karıştırıcı çıkışından ağıza (rExit: ağız iç yarıçapı) */
  nozzle: { z0: number; z1: number; r0: number; rExit: number };
  /** Ağızdaki koni yarıçapı (koni lüleden çıkıyorsa > 0; ağız alanı halka) */
  plugExitR: number;
  /**
   * Kaportanın fan çıkışından (nacelle.js referansında z 0,55) lüle ağzına
   * iç duvar ve dış yüzey profilleri [r, z] (dünya); nacelle.js bunları
   * kendi ölçeğine çevirip kaportanın arka kısmı yapar
   */
  duct: [number, number][];
  outer: [number, number][];
}

/**
 * Kaportanın dış profili [r, z]: nacelle.js dudak ve dış kaporta noktaları
 * (fan ucu 1,386 m ölçeğinde, model grubu koordinatı). Ayrık akışta arka
 * kısım (z > 0,55) baypas ağzının iç duvarıyla birlikte kayar (nacelle.js
 * `aft`); karışık akışta z > 0,55 kısmı uzun kanalın profiliyle değişir.
 */
const NACELLE_OUTER: [number, number][] = [
  [1.512, -2.243],
  [1.672, -2.06],
  [1.742, -1.72],
  [1.784, -1.1],
  [1.755, 0.05],
  [1.638, 1.0],
  [1.516, 1.52],
];
/** nacelle.js baypas kanalı iç duvarı (z ≤ 0,55: fan muhafazası ve OGV bölümü) ve dış kaportanın 0,55'teki yarıçapı */
const NACELLE_DUCT_FRONT: [number, number][] = [
  [1.392, -1.35],
  [1.402, -0.95],
  [1.414, -0.6],
  [1.418, -0.3],
  [1.412, 0.1],
  [1.396, 0.55],
];
const NACELLE_OUTER_AT_055 = 1.706;
/** Kaportanın sabit ön kısmının bittiği referans z (nacelle.js) */
export const NACELLE_AFT_Z = 0.55;
/** Ayrık akışta kaporta iç duvarının baypas ağzındaki referans yarıçapı (nacelle.js) */
const NACELLE_DUCT_EXIT_REF = 1.344;

const smooth01 = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Profilin z'de geri dönen ([r, z], z artmalı) iç noktalarını komşularının z
 * ortasına alır; ortası da sıralı değilse noktayı atar. Uç noktalar kalır.
 */
function monotoneZ(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1][1];
    const [r, z] = pts[i];
    if (z > prev) {
      out.push(pts[i]);
      continue;
    }
    const next = pts[i + 1]?.[1];
    if (next !== undefined && next > prev) out.push([r, (prev + next) / 2]);
  }
  return out;
}

/** Toplam basınç ve sıcaklığı verilen akış (Station: T, P toplam) */
const flowStation = (T: number, P: number, W: number): Station => ({ T, P, W });

function turbofanLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): TurbofanLayout {
  const noz = moduleOf<NozzleModule>(graph, 'nozzle')!;
  const mixMod = moduleOf<MixerModule>(graph, 'mixer');
  const fan = gp.front;
  const booster = gp.booster;
  const { hpc, hpt, lpt, combustor: cb } = gp;
  if (!fan) throw new FlowpathError('Kaportalı turbofan fan ister.', 'inlet.nacelle', 'fan');
  if (!booster) throw new FlowpathError('Kaportalı turbofan şimdilik booster (LPC) ister.', 'inlet.nacelleBooster', 'lpc');
  const s = fan.tip[0] / TF_REF_FAN_TIP;
  const fanZ = fan.z0;
  // Kaporta referans koordinatından dünyaya (model grubu fan ucu oranında ölçeklenir)
  const nacZ0 = fanZ + 0.28 * s;
  const toWorld = ([r, z]: [number, number]): [number, number] => [r * s, nacZ0 + z * s];

  // Çekirdek kaportası: iç parçaların zarfı + boşluk (aksesuar, boru, bleed
  // payı). `c` boşluk ölçeği: ayrık akışta ve sığan karışık akışta 1 (M4
  // öncesi referans, bayt düzeyinde aynı); karışık akışta kanal kapanırsa
  // CORE_CLEARANCE_MIN'e kadar daralır (aşağıda)
  const zS = fanZ + 0.3 * s;
  const coreCowlFront = (c: number) => {
    // Bleed payı c ile daralır ama ayırıcı burnunun iç yüzeyi booster
    // gövdesinin dışında kalır (burnun inişi de c ile ölçeklenir: `lip`)
    const rS = booster.tip[0] + Math.max(0.058 * c, SPLITTER_CASE_CLEAR + SPLITTER_LIP_DROP * c);
    const rMax = Math.max(booster.tip[1] + 0.2 * c, hpc.tip[0] + 0.31 * c, cb.rOut + 0.32 * c, lpt.tip[1] + 0.1 * c);
    const pts: [number, number][] = [
      [rS, zS],
      [rS + 0.35 * (rMax - rS), zS + 0.13],
      [rS + 0.75 * (rMax - rS), booster.z1 - 0.1],
      [rMax * 0.99, hpc.z0 + 0.1],
      [rMax, (hpc.z1 + cb.z0) / 2],
      [rMax * 0.985, cb.z1],
      [Math.max(rMax * 0.94, lpt.tip[1] + 0.12 * c), hpt.z1 + 0.1],
    ];
    // Karışık akışta z'de geri dönen nokta (kısa booster: booster.z1 − 0,1 <
    // zS + 0,13) komşularının ortasına alınır: yumuşatılmış profil (core.js)
    // kendi üstüne kıvrılıp fan kanalına taşmasın. Ayrık akış M4 öncesiyle aynı
    return { rS, pts: mixMod ? monotoneZ(pts) : pts };
  };
  const zLipSep = lpt.z1 + 0.52;
  // Egzoz kanalının dış duvarı (türbin arka çerçevesinin uç yarıçapı)
  const ductR = lpt.tip[1] + 0.046;
  // Karışık akışta karıştırıcı çekirdek kaportasının arka kenarından başlar
  // (türbin arka çerçevesinin hemen arkası); yarıçapı egzoz kanalının dış duvarı
  const mixR = ductR + 0.01;
  const mz0 = lpt.z1 + 0.22;
  const mz1 = mz0 + Math.max(0.3, 0.75 * mixR);
  const A9mix = sized.ref.A9mix ?? sized.ref.A9 + sized.ref.A19;
  // `??` NaN'ı geçirir: karışma basıncı yetersizken (karışma düzleminde
  // statik basınç eşitlenemez) bütün uzun kanal profilleri NaN olurdu
  if (mixMod && !(Number.isFinite(A9mix) && A9mix > 0))
    throw new FlowpathError(
      // Baypas oranı artınca LPT fana daha çok iş verir, çekirdek çıkış
      // basıncı düşer: P19t/P5t yükselir (FPR 1,4'te BPR 2,5 → 7: 0,31 → 0,56)
      'Ortak lüle alanı hesaplanamadı: karışma düzleminde baypas basıncı yetersiz. Fan basınç oranını ya da baypas oranını artır.',
      'mixer.area',
      'nozzle',
      ['fan.pr', 'fan.bypassRatio'],
      { value: A9mix },
    );
  // Egzoz konisi: taban LPT çıkış göbeğinde; M4 öncesi modelin ojiv
  // profili (taban 0,4 m, boy 1,2 m) taban yarıçapıyla orantılı ölçeklenir.
  // Karışık akışta koni uzar, ucu ortak lülenin ağzından ~0,7 ağız yarıçapı
  // çıkar (CFM56-5C gibi): ağız alanı koninin çevresinde halka olur
  const plugBase = lpt.hub[1] - 0.01;
  const k = plugBase / 0.4;
  const pz0 = lpt.z1 + 0.19;
  const plugFor = (kz: number): [number, number][] =>
    PLUG_SHAPE.map(([r, dz]) => [plugBase * r, pz0 + dz * kz] as [number, number]);
  let plug = plugFor(k);
  const plugAt = (z: number) => (z >= plug[plug.length - 1][1] ? 0 : profileAt(plug, z));
  // Ortak lüle ağzı: halka alanı A9mix (koni ağızdan çıkıyorsa halka). Koni
  // boyu ağız yarıçapına, ağız yarıçapı ağızdaki koni kesitine, kanal boyu da
  // ağız yarıçapına bağlı: üçü birlikte yinelenerek yakınsar (sabit nokta)
  let rExit = Math.sqrt(A9mix / Math.PI);
  let endZ = mz1 + MIXING_DUCT_LD * rExit;
  if (mixMod) {
    for (let i = 0; i < 8; i++) {
      plug = plugFor(Math.max(k, (mz1 + (MIXING_DUCT_LD + PLUG_PROTRUSION) * rExit - pz0) / 1.205));
      rExit = Math.sqrt(plugAt(endZ) ** 2 + A9mix / Math.PI);
      endZ = mz1 + MIXING_DUCT_LD * rExit;
    }
  }
  const ogvZ = fanZ + 0.48 * s;
  const strutZ = booster.z1;
  const rearZ = lpt.z1 + 0.16;
  let { rS, pts: cowlFront } = coreCowlFront(1);
  /** Kaporta payı ölçeği (karışık akışta daralabilir) */
  let cUsed = 1;

  let cowl: [number, number][];
  let coreNozzle: TurbofanLayout['coreNozzle'];
  let bypassExit: TurbofanLayout['bypassExit'];
  let exhaustDuct: [number, number][];
  let exhaustExit: TurbofanLayout['exhaustExit'];
  let mixed: MixedExhaust | undefined;
  let nacOuter: [number, number][];

  if (!mixMod) {
    // --- ayrık akış: çekirdek lülesi + kısa kaportanın baypas lülesi ---
    // Çekirdek lülesi ağzı: ağızdaki koni yarıçapının dışında, A9 kadar
    const r1 = Math.sqrt(profileAt(plug, zLipSep) ** 2 + sized.ref.A9 / CD_CORE / Math.PI);
    const zN0 = lpt.z1 + 0.22;
    const rN0 = Math.max(r1 + 0.065, lpt.tip[1] + 0.05);
    cowl = [...cowlFront, [Math.max(rN0 + 0.05, lpt.tip[1] + 0.08), lpt.z1 - 0.05], [rN0, zN0]];
    // Baypas lülesi: kaporta iç duvarı, ağızdaki çekirdek kaportasından A19 kadar dışarıda
    const bz = fanZ + 1.8 * s;
    const rCore = profileAt(cowl, bz);
    const rDuct = Math.sqrt(rCore ** 2 + sized.ref.A19 / CD_BYPASS / Math.PI);
    exhaustDuct = [
      [ductR, lpt.z1 + 0.065],
      [ductR - 0.016, lpt.z1 + 0.15],
      [(ductR + r1) / 2 + 0.01, lpt.z1 + 0.28],
      [r1 + 0.01, lpt.z1 + 0.42],
      [r1, zLipSep],
    ];
    coreNozzle = { z0: zN0, r0: rN0, z1: zLipSep, r1 };
    bypassExit = { z: bz, rCore, rDuct };
    exhaustExit = { z: zLipSep - 0.01, radius: r1 - 0.09 };
    // Dış kaporta arka kısmı baypas ağzıyla kayar (nacelle.js `aft`)
    const d = rDuct / s - NACELLE_DUCT_EXIT_REF;
    nacOuter = NACELLE_OUTER.map(([r, z]) => toWorld([r + d * smooth01((z - NACELLE_AFT_Z) / (1.52 - NACELLE_AFT_Z)), z]));
  } else {
    // --- karışık akış: uzun kanallı kaporta, karıştırıcı, ortak lüle ---
    const st = sized.point.stations;
    // Çekirdek kaportasının arka ucu: LPT üstünden karıştırıcıya. Payları da
    // c ile daralır (yoksa küçük motorda LPT üstünde ~8 cm'lik tümsek); kısa
    // LPT'de (lpt.z1 − 0,05 ≤ hpt.z1 + 0,1) nokta z'de geri dönmesin diye en
    // az önceki noktadan karıştırıcıya yolun %40'ında; önceki noktadan
    // (ya da karıştırıcı kenarından) yükseğe çıkmaz
    const cowlTailOf = (c: number, front: [number, number][]): [number, number][] => {
      const [rPrev, zPrev] = front[front.length - 1];
      const r = Math.min(Math.max(mixR + 0.06 * c, lpt.tip[1] + 0.08 * c), Math.max(rPrev, mixR + 0.02));
      return [
        [r, Math.max(lpt.z1 - 0.05, lerp(zPrev, mz0, 0.4))],
        [mixR + 0.02, mz0],
      ];
    };
    cowl = [...cowlFront, ...cowlTailOf(1, cowlFront)];
    // Kaporta iç duvarı: OGV arkasındaki halka alanından karıştırma
    // düzleminde baypas kanalı Mach'ına (bypassDuct.mach) göre gereken alana
    // düzgün geçiş. Her z'de iç sınırın (çekirdek kaportası, karıştırıcı)
    // dışında kalır; alan pozitif olduğu sürece duvar kaportayı kesmez.
    const P19t = st['13'].P * (1 - (graph.bypassDuct?.dp ?? 0));
    const Mb = graph.bypassDuct?.mach ?? 0.45;
    const aMix = annulusArea(flowStation(st['13'].T, P19t, st['13'].W), Mb, AIR);
    const [rA, zA] = toWorld([NACELLE_DUCT_FRONT[NACELLE_DUCT_FRONT.length - 1][0], NACELLE_AFT_Z]);
    // Karıştırıcı başında (mz0) çekirdek kaportasının kenarı: duvar orada örneklenir
    const inner = (z: number) => (z <= mz0 ? profileAt(cowl, z) : mixR);
    // Fan kanalının ön kısmı (OGV, destek kanatları, itki çevirici başı) fan
    // ucu oranında ölçeklenir, çekirdek kaportası ise çekirdek parçalarının
    // zarfından mutlak payla: düşük BPR ya da küçük hava akışında çekirdek
    // kaportası kanal duvarını geçer ya da kanalı tıkar. Önce kaporta payları
    // orantılı daraltılır (küçük motorda aksesuar ve borular da küçük; şablon
    // ve sığan tasarım değişmez). Hedef: geometrik açıklık (fan ucu oranında)
    // ve baypas akışını FAN_DUCT_MACH_MAX altında geçiren halka alanı. Alan
    // en dar payla da yetmiyorsa en dar pay kullanılır (c sürekli kalır);
    // yalnız geometrik açıklık yetmezse sessizce kırpmak yerine öğretici hata.
    const ductFront = NACELLE_DUCT_FRONT.map(toWorld);
    const needGap = MIN_DUCT_GAP * s;
    const needArea = annulusArea(flowStation(st['13'].T, st['13'].P, st['13'].W), FAN_DUCT_MACH_MAX, AIR);
    const fitOf = (cc: number) => {
      const pts = coreCowlFront(cc).pts;
      const c = [...pts, ...cowlTailOf(cc, pts)];
      let gap = Infinity;
      let area = Infinity;
      for (let i = 0; i <= 16; i++) {
        const z = lerp(Math.min(ogvZ, strutZ), Math.max(zA, strutZ), i / 16);
        const ro = profileAt(ductFront, z);
        const ri = z < mz0 ? profileAt(c, z) : mixR;
        gap = Math.min(gap, ro - ri);
        area = Math.min(area, Math.PI * (ro * ro - ri * ri));
      }
      return { gap, area, ok: gap >= needGap && area >= needArea };
    };
    let fit = fitOf(1);
    if (!fit.ok) {
      // Boşluk ölçeği c: hedefi sağlayan en büyük c (açıklık ve alan c'de
      // tekdüze azalır); en dar payla da sağlanmıyorsa en dar pay
      let lo = CORE_CLEARANCE_MIN;
      if (fitOf(lo).ok) {
        let hi = 1;
        for (let i = 0; i < 24; i++) {
          const m = (lo + hi) / 2;
          if (fitOf(m).ok) lo = m;
          else hi = m;
        }
      }
      ({ rS, pts: cowlFront } = coreCowlFront(lo));
      cUsed = lo;
      cowl = [...cowlFront, ...cowlTailOf(lo, cowlFront)];
      fit = fitOf(lo);
    }
    const gap = fit.gap;
    if (!(gap >= needGap))
      throw new FlowpathError(
        'Fan kanalı kapanıyor: çekirdek kaportası baypas kanalının dış duvarına dayanıyor (çekirdek fana göre çok büyük). Baypas oranını ya da hava akışını artır.',
        'bypassDuct.closed',
        'fan',
        ['fan.bypassRatio', 'engine.massFlow'],
        { value: gap },
      );
    const a0 = Math.PI * (rA * rA - inner(zA) ** 2);
    const wallAt = (z: number) => {
      const u = (z - zA) / (mz1 - zA);
      const a = lerp(a0, aMix, smooth01(u));
      return Math.sqrt(inner(z) ** 2 + Math.max(a, 0.02 * aMix) / Math.PI);
    };
    const rW = wallAt(mz1);
    // Sabit yakınsak lüle: ağız karıştırma düzlemindeki kanaldan dar olmalı
    const m2 = (v: number) => v.toFixed(2).replace('.', ',');
    if (!(rExit <= MIXED_NOZZLE_CONTRACTION_MAX * rW))
      throw new FlowpathError(
        `Ortak lüle ağzı (çap ${m2(2 * rExit)} m) karıştırma kanalından (çap ${m2(2 * rW)} m) geniş çıkıyor: karışma düzleminde baypas basıncı çekirdeğinkinin çok altında, karışmış akışın basıncı düşük ve sabit yakınsak lüle bu kadar büyük ağız veremez. Fan basınç oranını ya da baypas oranını artır.`,
        'mixer.nozzle',
        'nozzle',
        ['fan.pr', 'fan.bypassRatio'],
        { rExit, rDuct: rW },
      );
    // Ortak lüle ağzı (rExit, endZ) koniyle birlikte yukarıda yakınsadı
    const plugExitR = plugAt(endZ);
    // Lobe genliği: tepeler kaporta iç duvarına, çukurlar koniye değmez
    const amp =
      mixMod.style === 'lobed' ? Math.max(0, Math.min(0.4 * (rW - mixR), 0.45 * (mixR - plugAt(mz1)), 0.35 * mixR)) : 0;
    const mixer: MixedExhaust['mixer'] = {
      z0: mz0,
      z1: mz1,
      r: mixR,
      amp,
      lobes: mixMod.style === 'lobed' ? (mixMod.lobes ?? 18) : 0,
      style: mixMod.style ?? 'confluent',
    };
    // İç duvar: fan çıkışından karıştırıcıya alan kuralıyla, sonra karıştırma
    // kanalı kısa bir düz bölümden sonra ağza konik yakınsar (yarı açı ~13°,
    // ağızda ~19°). Alan kuralı düzgün örneklerin yanında çekirdek
    // kaportasının köşelerinde ve karıştırıcı başında da örneklenir: yalnız
    // düzgün örnekte kaportanın tepesi iki örnek arasında kalınca astar
    // kaportanın içinden geçiyordu
    const duct: [number, number][] = [];
    const n = 10;
    const zDuct = [...Array.from({ length: n + 1 }, (_, i) => lerp(zA, mz1, i / n)), ...cowl.map(([, z]) => z)]
      .filter((z) => z >= zA && z <= mz1)
      .sort((a, b) => a - b)
      .filter((z, i, a) => i === 0 || z - a[i - 1] > 0.01 * (mz1 - zA));
    for (const z of zDuct) duct.push([z === zA ? rA : wallAt(z), z]);
    if (duct[duct.length - 1][1] < mz1) duct.push([wallAt(mz1), mz1]);
    const Lm = endZ - mz1;
    for (const [u, f] of [
      [0.2, 0.02],
      [0.45, 0.25],
      [0.72, 0.58],
      [1, 1],
    ] as const)
      duct.push([lerp(rW, rExit, f), mz1 + u * Lm]);
    // Dış yüzey: iç duvar + kaporta kalınlığı. Kalınlık fan kaportasının
    // 0,55'teki değerinden (itki çevirici yuvası) ağızdaki ince arka kenara
    // düzgün incelir; arka kısım lüleyle birlikte konik daralır (gemi kıçı)
    const te = 0.012 + 0.008 * s;
    const t0 = NACELLE_OUTER_AT_055 * s - rA;
    const outer: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const z = lerp(zA, endZ, u);
      outer.push([profileAt(duct, z) + lerp(t0, te, smooth01(u)), z]);
    }
    mixed = {
      mixer,
      ductEnd: { z: mz1, r: rW },
      nozzle: { z0: mz1, z1: endZ, r0: rW, rExit },
      plugExitR,
      duct,
      outer,
    };
    exhaustDuct = [
      [ductR, lpt.z1 + 0.065],
      [ductR - 0.012, lpt.z1 + 0.14],
      [ductR - 0.004, mz0 - 0.03],
      [mixR - 0.002, mz0],
    ];
    // Çekirdek akışı karıştırıcıdan, baypas akışı karıştırma düzlemine çıkar
    coreNozzle = { z0: mz0, r0: mixR, z1: mz1, r1: mixR };
    bypassExit = { z: mz1, rCore: mixR, rDuct: rW };
    exhaustExit = { z: endZ, radius: rExit };
    nacOuter = [...NACELLE_OUTER.filter(([, z]) => z < NACELLE_AFT_Z).map(toWorld), ...outer];
  }

  // Motor kartı alanları
  const nacEnd = nacOuter[nacOuter.length - 1][1];
  const outerProfile = envelopeOf(
    nacOuter,
    cowl.filter(([, z]) => z > nacEnd),
    plug.filter(([, z]) => z > Math.max(nacEnd, coreNozzle.z0)),
  );
  const mounts: MountPoint[] = [
    { id: 'front', z: fanZ + 0.55 * s, r: profileAt(nacOuter, fanZ + 0.55 * s), angle: 0, type: 'pylon' },
    { id: 'rear', z: rearZ, r: profileAt(cowl, rearZ), angle: 0, type: 'pylon' },
  ];

  return {
    style: 'nacelle',
    s,
    fan,
    booster,
    hpc,
    hpt,
    lpt,
    combustor: cb,
    shafts: {
      lp: [fanZ - 1.27 * s, lpt.z1 + 0.21, gp.shafts.lp],
      hp: [hpc.z0 - 0.13, hpt.z0 - 0.05, gp.shafts.hp],
    },
    // Ayrık akışta `lip` yok (yerleşim M4 öncesiyle bayt düzeyinde aynı)
    splitter: mixed ? { z: zS, r: rS, lip: cUsed } : { z: zS, r: rS },
    coreCowl: cowl,
    bypassExit,
    coreNozzle,
    plug,
    rearFrame: { z: rearZ, hub: plugBase, tip: ductR },
    exhaustDuct,
    ogv: { z: ogvZ, hub: profileAt(cowl, ogvZ) + 0.014, tip: 1.392 * s },
    struts: { z: strutZ, hub: profileAt(cowl, strutZ) - 0.02, tip: 1.39 * s },
    intake: { z: fanZ - 1.97 * s, radius: 1.1 * s, y: 0 },
    exhaustExit,
    chevrons: { core: mixed ? 0 : (noz.chevrons?.core ?? 0), bypass: noz.chevrons?.bypass ?? 0 },
    mounts,
    outerProfile,
    ...(mixed ? { mixed } : {}),
  };
}

/**
 * Egzoz kütlesi: egzoz konisi + çekirdek lülesi (ayrık) ya da karıştırıcı +
 * ortak lüle (karışık). Uzun kanallı kaportanın kendisi (ayrık akıştaki fan
 * kaportası gibi) motor kuru kütlesine sayılmaz; ortak lüle ve karıştırıcı
 * motora aittir. Lobe'lu sacın alanı lobe dalgasının yay boyu oranında büyür.
 */
function exhaustMass(L: TurbofanLayout): number {
  const plug = shellMass(L.rearFrame.hub, L.plug[L.plug.length - 1][1] - L.plug[0][1], 0.003, RHO.ni);
  const m = L.mixed;
  if (!m) return plug + shellMass(L.coreNozzle.r0, L.coreNozzle.z1 - L.coreNozzle.z0 + 0.3, 0.004, RHO.ni);
  const mx = m.mixer;
  // r + a·cos(Nθ) dalgasının ortalama yay boyu oranı (genlik çıkışta en büyük, ortalama ~a/2)
  const k = mx.lobes > 0 ? Math.sqrt(1 + 0.5 * ((mx.amp / 2) * mx.lobes / mx.r) ** 2) : 1;
  const mixer = shellMass(mx.r, mx.z1 - mx.z0, MIX_SHEET_T, RHO.ni) * k;
  const n = m.nozzle;
  // Ortak lüle: karıştırma kanalı + yakınsak bölüm, et kalınlığı 3 mm (inconel)
  const nozzle = shellMass((n.r0 + n.rExit) / 2, n.z1 - n.z0, MIX_SHEET_T, RHO.ni);
  return plug + mixer + nozzle;
}

/** Kaportalı turbofan: yerleşim + fan, muhafaza, gövde ve egzoz kütlesi + ölçüler */
export function nacelleLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): LayoutResult {
  const L = turbofanLayout(graph, sized, gp);
  const f = L.fan;
  const frontMod = (moduleOf<CompressorModule>(graph, 'fan') ?? moduleOf<CompressorModule>(graph, 'lpc'))!;
  return {
    layout: L,
    shaftLen: { lp: L.shafts.lp[1] - L.shafts.lp[0], hp: L.shafts.hp[1] - L.shafts.hp[0] },
    extra: {
      // Fan: kanatlar + disk (dolu oran düşük: geniş kordlu ama ince kanatlar)
      fan: Math.PI * f.tip[0] ** 2 * f.pitch * 0.055 * RHO.ti,
      // Fan muhafazası (kanat kopması muhafazası, kevlar sargılı)
      fanCase: shellMass(f.tip[0] + 0.06, 0.75 * L.s, 0.012, 2000),
      casing: shellMass(L.hpc.tip[0] + 0.05, L.lpt.z1 - L.hpc.z0, SHELL_T.casing, RHO.ti),
      exhaust: exhaustMass(L),
    },
    diameter: 2 * f.tip[0],
    // Karışık akışta ortak lüle ağzı koninin ucundan geride olabilir
    length: Math.max(L.plug[L.plug.length - 1][1], L.mixed?.nozzle.z1 ?? -Infinity) - L.intake.z,
    lpTipMach: tipMachRel(sized.point.stations['2'], frontMod.mach[0], f.uTip, AIR),
  };
}
