/**
 * Gaz yolu geometrisi: tasarım noktası istasyonlarından (sizeEngine) ve
 * modül düğmelerinden kanal yarıçapları, kademe/kanat sayıları, eksenel
 * yerleşim ve mil devirleri.
 *
 * Fizik:
 *  - Kanal alanı: A = W·√Tt / (Pt · F(M)), F akış fonksiyonu (eksenel Mach M)
 *  - Yarıçaplar: girişte göbek/uç oranı, çıkışta uç daralması (taper)
 *  - Mil devri: milin ilk kompresörünün uç hızı / uç yarıçapı
 *  - Kademe sayısı: Δh / (ψ · U²ort), ψ kademe yüklemesi
 *  - Kanat sayısı: 2π·r_ort·k / kanat yüksekliği (k = katılık × en-boy oranı)
 *  - Yanma odası halkası: referans hızdan (A = W3 / (ρ3·Vref))
 *  - Art yakıcı gömleği: jet borusu Mach'ından
 *
 * Çıktının `layout` alanı çıplak motor üreticisinin (engine/barejet.js)
 * beklediği biçimdedir. Motor ekseni z, +z egzoz yönü, metre.
 */

import { AIR, GAS, type GasProps } from '../sim/gas';
import type { SizedEngine, Station, StationId } from '../sim/design';
import type {
  AfterburnerModule,
  CombustorModule,
  CompressorModule,
  EngineGraph,
  InletModule,
  NozzleModule,
  PropellerModule,
  TurbineModule,
} from './types';

/** Giriş düzleminin konumu (test hücresi, kamera açıları buna göre) */
export const INTAKE_Z = -2.2;
/** Değişken lüle boğazı akış katsayısı (etkin / geometrik alan) */
const NOZZLE_CD = 0.77;

/* ------------------------------------------------------------------ */
/* Akış fonksiyonu                                                     */
/* ------------------------------------------------------------------ */

/** W·√Tt / (A·Pt) [kg·√K/(s·m²·Pa)] — eksenel Mach'ın fonksiyonu */
export function flowFunction(M: number, g: GasProps): number {
  const k = g.gamma;
  return Math.sqrt(k / g.R) * M * Math.pow(1 + ((k - 1) / 2) * M * M, -(k + 1) / (2 * (k - 1)));
}

/** Ses altı dalda akış fonksiyonunun tersi */
export function machFromFlow(f: number, g: GasProps): number {
  if (f >= flowFunction(1, g)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (flowFunction(m, g) < f) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** İstasyon akışının verilen eksenel Mach'ta gerektirdiği kanal alanı [m²] */
export function annulusArea(st: Station, M: number, g: GasProps): number {
  return (st.W * Math.sqrt(st.T)) / (st.P * flowFunction(M, g));
}

/* ------------------------------------------------------------------ */
/* Turbomakine sırası                                                  */
/* ------------------------------------------------------------------ */

export interface RowGeometry {
  stages: number;
  /** İlk ve son rotor ekseni */
  z0: number;
  z1: number;
  /** Kademe aralığı (eksenel) */
  pitch: number;
  hub: [number, number];
  tip: [number, number];
  blades: [number, number];
  /** Ortalama yarıçapta kanat hızı [m/s] ve ilk kademe uç hızı */
  uMean: number;
  uTip: number;
  /** Kademe başına gerçek yükleme (tamsayı kademeyle) */
  loading: number;
}

const rms = (h: number, t: number) => Math.sqrt((h * h + t * t) / 2);
const meanR = (row: RowGeometry, end: 0 | 1) => (row.hub[end] + row.tip[end]) / 2;

/**
 * Kanal yarıçapları ve kademe sayısı. Eksenel konum (z0/z1) sonra
 * yerleşimde atanır.
 */
export function sizeRow(
  m: CompressorModule | TurbineModule,
  inSt: Station,
  outSt: Station,
  omega: number,
  gas: GasProps,
  dh: number,
): RowGeometry {
  const aIn = annulusArea(inSt, m.mach[0], gas);
  const aOut = annulusArea(outSt, m.mach[1], gas);
  const tipIn = Math.sqrt(aIn / (Math.PI * (1 - m.hubTip * m.hubTip)));
  const hubIn = m.hubTip * tipIn;
  const tipOut = m.taper * tipIn;
  const hub2 = tipOut * tipOut - aOut / Math.PI;
  if (!(hub2 > 0)) throw new FlowpathError(`${m.type.toUpperCase()} çıkışında kanal sığmıyor: uç daralması çok fazla ya da Mach çok düşük.`);
  const hubOut = Math.sqrt(hub2);
  const r = (rms(hubIn, tipIn) + rms(hubOut, tipOut)) / 2;
  const uMean = omega * r;
  const stages = Math.max(1, Math.ceil(dh / (m.loading * uMean * uMean) - 1e-9));
  const span = (tipIn - hubIn + tipOut - hubOut) / 2;
  const pitch = m.pitchSpan * span;
  const count = (h: number, t: number, k: number) => Math.max(3, Math.round((2 * Math.PI * ((h + t) / 2) * k) / (t - h)));
  return {
    stages,
    z0: 0,
    z1: (stages - 1) * pitch,
    pitch,
    hub: [hubIn, hubOut],
    tip: [tipIn, tipOut],
    blades: [count(hubIn, tipIn, m.bladeK[0]), count(hubOut, tipOut, m.bladeK[1])],
    uMean,
    uTip: omega * tipIn,
    loading: dh / stages / (uMean * uMean),
  };
}

export class FlowpathError extends Error {}


/* ------------------------------------------------------------------ */
/* Ortak gaz yolu                                                      */
/* ------------------------------------------------------------------ */

/** Turboprobun pervane düzlemi (z) */
export const PROP_Z = -2.08;

export interface CentrifugalGeometry {
  /** Çark ekseni (çıkış düzlemi) */
  z: number;
  /** Göz (giriş) ve çark uç yarıçapı, difüzör çıkış yarıçapı */
  r0: number;
  r1: number;
  rd: number;
  /** Çark uç hızı [m/s] */
  uTip: number;
}

export interface CombustorGeometry {
  z0: number;
  z1: number;
  rIn: number;
  rOut: number;
  injectors: number;
}

/** Bütün motor tiplerinde ortak gaz yolu sıraları ve mil devirleri */
export interface GasPath {
  /** LP milinin ilk kompresörü (fan ya da LPC); pervaneli motorda yok */
  front?: RowGeometry;
  /** Fanın arkasındaki alçak basınç kompresörü (booster) */
  booster?: RowGeometry;
  /** HPC'nin eksenel kademeleri */
  hpc: RowGeometry;
  centrifugal?: CentrifugalGeometry;
  combustor: CombustorGeometry;
  hpt: RowGeometry;
  lpt: RowGeometry;
  /** Mil dış yarıçapları [m] */
  shafts: { lp: number; hp: number };
  /** Açısal hızlar [rad/s] */
  omega: { lp: number; hp: number };
}

function find<T extends { type: string }>(g: EngineGraph, type: T['type']): T | undefined {
  return g.modules.find((m) => m.type === type) as T | undefined;
}

const tipFor = (st: Station, m: { mach: [number, number]; hubTip: number }, g: GasProps) =>
  Math.sqrt(annulusArea(st, m.mach[0], g) / (Math.PI * (1 - m.hubTip ** 2)));

export function computeGasPath(graph: EngineGraph, sized: SizedEngine): GasPath {
  const s = sized.point.stations;
  const st = (id: StationId) => s[id];
  const inlet = find<InletModule>(graph, 'inlet')!;
  const prop = find<PropellerModule>(graph, 'propeller');
  const fan = find<CompressorModule>(graph, 'fan');
  const lpcMod = find<CompressorModule>(graph, 'lpc');
  const hpcMod = find<CompressorModule>(graph, 'hpc')!;
  const comb = find<CombustorModule>(graph, 'combustor')!;
  const hptMod = find<TurbineModule>(graph, 'hpt')!;
  const lptMod = find<TurbineModule>(graph, 'lpt')!;
  const frontMod = fan ?? lpcMod;
  const boosterMod = fan ? lpcMod : undefined;

  // --- mil devirleri: milin ilk kompresörünün (yoksa güç türbininin) uç hızından ---
  if (!hpcMod.tipSpeed) throw new FlowpathError('HPC uç hızı vermeli.');
  const w2 = hpcMod.tipSpeed / tipFor(st('25'), hpcMod, AIR);
  let w1: number;
  if (frontMod) {
    if (!frontMod.tipSpeed) throw new FlowpathError('LP milinin ilk kompresörü uç hızı vermeli.');
    w1 = frontMod.tipSpeed / tipFor(st('2'), frontMod, AIR);
  } else {
    if (!lptMod.tipSpeed) throw new FlowpathError('Kompresörsüz LP mili (güç türbini) uç hızı vermeli.');
    w1 = lptMod.tipSpeed / tipFor(st('45'), lptMod, GAS);
  }

  const cpA = AIR.cp;
  const cpG = GAS.cp;
  const W2 = st('2').W;
  let front: RowGeometry | undefined;
  if (frontMod) {
    // Fan çıkışı baypas + çekirdek akışının tamamını taşır (ayırıcıdan önce)
    const out: Station = fan ? { T: st('13').T, P: st('13').P, W: W2 } : st('21');
    front = sizeRow(frontMod, st('2'), out, w1, AIR, cpA * (out.T - st('2').T));
  }
  const booster = boosterMod ? sizeRow(boosterMod, st('21'), st('25'), w1, AIR, cpA * (st('25').T - st('21').T)) : undefined;

  // HPC: santrifüj son kademe varsa eksenel kademeler işin kalanını yapar;
  // ara istasyon aynı verimle
  const s25 = st('25');
  const s3 = st('3');
  const cen = hpcMod.centrifugal;
  let axOut: Station = s3;
  if (cen) {
    const Tm = s25.T + (1 - cen.workFraction) * (s3.T - s25.T);
    const g = AIR.gamma;
    const prAx = Math.pow(1 + hpcMod.eff * (Tm / s25.T - 1), g / (g - 1));
    axOut = { T: Tm, P: s25.P * prAx, W: s25.W };
  }
  const hpc = sizeRow(hpcMod, s25, axOut, w2, AIR, cpA * (axOut.T - s25.T));
  const hpt = sizeRow(hptMod, st('4'), st('45'), w2, GAS, cpG * (st('4').T - st('45').T));
  const lpt = sizeRow(lptMod, st('45'), st('5'), w1, GAS, cpG * (st('45').T - st('5').T));

  // --- eksenel yerleşim ---
  const place = (row: RowGeometry, z0: number) => {
    row.z0 = z0;
    row.z1 = z0 + (row.stages - 1) * row.pitch;
  };
  const after = (prev: RowGeometry, row: RowGeometry, gap = 1) => place(row, prev.z1 + gap * ((prev.pitch + row.pitch) / 2));
  if (front) place(front, INTAKE_Z + inlet.length * front.tip[0]);
  if (front && booster) after(front, booster, boosterMod!.gap);
  const lastLp = booster ?? front;
  if (lastLp) after(lastLp, hpc, hpcMod.gap);
  else if (prop) place(hpc, PROP_Z + prop.gearboxLength);
  else throw new FlowpathError('HPC konumlanamıyor.');

  let centrifugal: CentrifugalGeometry | undefined;
  if (cen) {
    const u = Math.sqrt((cen.workFraction * cpA * (s3.T - s25.T)) / cen.loading);
    const r1 = u / w2;
    centrifugal = { z: hpc.z1 + cen.gap * hpc.pitch, r0: hpc.hub[1] - 0.01, r1, rd: r1 * cen.diffuserRatio, uTip: u };
  }

  // Yanma odası: halka yüksekliği referans hızdan, ortalama yarıçap HPC
  // çıkışı ile HPT girişi arasında
  const rho3 = s3.P / (AIR.R * s3.T);
  const aComb = s3.W / (rho3 * comb.refVelocity);
  const rMean = (meanR(hpc, 1) + meanR(hpt, 0)) / 2 + comb.meanShift;
  const H = aComb / (2 * Math.PI * rMean);
  const cz0 = (centrifugal ? centrifugal.z : hpc.z1) + comb.gap * hpc.pitch;
  const cz1 = cz0 + comb.lengthHeight * H;
  place(hpt, cz1 + hptMod.gap * hpt.pitch);
  place(lpt, hpt.z1 + lptMod.gap * lpt.pitch);

  // --- miller: yarıçap tork^(1/3) ile; LP mili HP milinin içinden geçer ---
  const rHp = 0.0055 * Math.cbrt(sized.ref.hpPower / w2);
  const rLp = Math.min(0.00305 * Math.cbrt(sized.ref.lpPower / w1), 0.55 * rHp);

  return {
    front,
    booster,
    hpc,
    centrifugal,
    combustor: { z0: cz0, z1: cz1, rIn: rMean - H / 2, rOut: rMean + H / 2, injectors: comb.injectors },
    hpt,
    lpt,
    shafts: { lp: rLp, hp: rHp },
    omega: { lp: w1, hp: w2 },
  };
}

/* ------------------------------------------------------------------ */
/* Çıplak motor (test hücresi): turbojet, art yakıcılı turbofan        */
/* ------------------------------------------------------------------ */

/** engine/barejet.js girdisi */
export interface BareJetLayout {
  style: 'bare';
  R: number;
  throat: number;
  intakeZ: number;
  noseLen: number;
  igv: number;
  gas: {
    lpc: RowGeometry & { part: string; firstMaterial?: string; firstChord?: number };
    hpc: RowGeometry;
    combustor: CombustorGeometry;
    hpt: RowGeometry;
    lpt: RowGeometry;
    casing: [number, number][];
    shafts: { lp: [number, number, number]; hp: [number, number, number] };
  };
  splitterZ: number | null;
  tailCone: [number, number, number];
  ab: { z0: number; z1: number; R: number; liner: number };
  nozzle: { hingeR: number; throat0: number; primary: number; divergent: number; flaps: number };
  mounts: [number, number];
  flanges: number[];
  shell: [number, number][];
  /** Değişken stator halkalarının eksenel konumları (dış donanım) */
  vsv: { z: number[]; part: string }[];
}

const mid = (a: number, b: number) => (a + b) / 2;

function bareJetLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): BareJetLayout {
  const st = (id: StationId) => sized.point.stations[id];
  const inlet = find<InletModule>(graph, 'inlet')!;
  const fan = find<CompressorModule>(graph, 'fan');
  const frontMod = (fan ?? find<CompressorModule>(graph, 'lpc'))!;
  const hpcMod = find<CompressorModule>(graph, 'hpc')!;
  const ab = find<AfterburnerModule>(graph, 'afterburner');
  const noz = find<NozzleModule>(graph, 'nozzle')!;
  const lpc = gp.front!;
  const { hpc, hpt, lpt } = gp;
  const { z0: cz0, z1: cz1, rOut } = gp.combustor;

  // --- egzoz ve art yakıcı ---
  const coneR = lpt.hub[1] - 0.015;
  const coneZ0 = lpt.z1 + 0.12;
  const tailCone: [number, number, number] = [coneZ0, coneZ0 + 2.4 * coneR, coneR];
  // Jet borusu: kuru art yakıcıda karışmış akış (istasyon 7)
  const liner = ab ? Math.sqrt(annulusArea(st('7'), ab.mach, GAS) / Math.PI) : lpt.tip[1];
  const abZ0 = coneZ0 + 0.05;
  const abZ1 = abZ0 + (ab ? ab.lengthDiameter * 2 * liner : 0.6);
  // Lüle boğazı: kuru tasarım noktası etkin alanından; geometrik boğaz
  // akış katsayısı kadar (~0,77) büyüktür
  const A8 = sized.ref.A8dry > 0 ? sized.ref.A8dry : sized.ref.A9;
  const nozzle = {
    hingeR: liner + 0.01,
    throat0: Math.sqrt(A8 / Math.PI / NOZZLE_CD),
    primary: 0.3,
    divergent: noz.style === 'cd' ? 0.34 : 0,
    flaps: noz.flaps ?? 14,
  };

  // --- gövde ---
  const turbTip = Math.max(hpt.tip[0], lpt.tip[1]);
  let shell: [number, number][];
  let R: number;
  let splitterZ: number | null = null;
  if (fan && (fan.bypassRatio ?? 0) > 0) {
    // Baypas kanalı: çekirdek gövdesinin dışında, verilen Mach'ta
    const bypass = graph.bypassDuct ?? { dp: 0, mach: 0.15 };
    const aBp = annulusArea(st('13'), bypass.mach, AIR);
    const splitR = Math.max(hpc.tip[0], rOut) + 0.04;
    R = Math.sqrt(splitR * splitR + aBp / Math.PI);
    const fanR = lpc.tip[0] + 0.055;
    splitterZ = lpc.z1 + 0.12;
    shell = [
      [Math.max(R, fanR - 0.01), INTAKE_Z + 0.12],
      [fanR, lpc.z0 + 0.07],
      [fanR, lpc.z1 + 0.07],
      [R, lpc.z1 + 0.17],
      [R, coneZ0],
    ];
  } else {
    R = Math.max(lpc.tip[0], hpc.tip[0]) + 0.035;
    const combR = rOut + 0.105;
    const turbR = turbTip + 0.06;
    shell = [
      [R, INTAKE_Z + 0.12],
      [R, hpc.z1 + 0.02],
      [combR, cz0 - 0.06],
      [combR, cz1 - 0.02],
      [turbR, hpt.z0 - 0.02],
      [turbR, lpt.z1 + 0.15],
    ];
  }

  // Yanma odası bölümü gövdesi (HPC çıkışından HPT girişine)
  const casing: [number, number][] = [
    [hpc.tip[1] + 0.04, hpc.z1 - 0.02],
    [rOut + 0.01, cz0 + 0.02],
    [rOut + 0.01, cz1],
    [hpt.tip[0] + 0.005, hpt.z0 + 0.04],
    [lpt.tip[1] + 0.02, lpt.z1 + 0.17],
  ];

  // Flanşlar: modül sınırlarında
  const flanges = [INTAKE_Z, mid(lpc.z1, hpc.z0), hpc.z1 + 0.07, cz0 + 0.02, mid(cz1, hpt.z0) + 0.04, abZ0, mid(abZ0, abZ1), abZ1 - 0.05];
  if (fan) flanges.splice(1, 1, lpc.z1 + 0.1);

  // VSV halkaları (dış donanım): kompresörlerin ön stator sıraları. Baypaslı
  // motorda HPC baypas kanalının altında kalır, halkaları dışarıdan görünmez
  const vsv: BareJetLayout['vsv'] = [];
  const outer: [RowGeometry, CompressorModule, string][] = [[lpc, frontMod, fan ? 'fan' : 'booster']];
  if (!fan || !(fan.bypassRatio! > 0)) outer.push([hpc, hpcMod, 'hpc']);
  for (const [row, mod, part] of outer) {
    const n = Math.min(mod.vsv ?? 0, row.stages);
    if (n > 0) vsv.push({ z: Array.from({ length: n }, (_, i) => row.z0 + (i + 0.5) * row.pitch * 0.62), part });
  }

  return {
    style: 'bare',
    R,
    throat: lpc.tip[0] + 0.005,
    intakeZ: INTAKE_Z,
    noseLen: inlet.noseLength * lpc.tip[0],
    igv: inlet.struts,
    gas: {
      lpc: { ...lpc, part: fan ? 'fan' : 'booster', firstMaterial: frontMod.firstMaterial, firstChord: frontMod.firstChord },
      hpc,
      combustor: gp.combustor,
      hpt,
      lpt,
      casing,
      shafts: { lp: [INTAKE_Z + 0.1, coneZ0 - 0.05, gp.shafts.lp], hp: [hpc.z0 - 0.08, hpt.z1 + 0.05, gp.shafts.hp] },
    },
    splitterZ,
    tailCone,
    ab: { z0: abZ0, z1: abZ1, R: liner + 0.03, liner },
    nozzle,
    mounts: [mid(hpc.z0, hpc.z1), lpt.z1 + 0.05],
    flanges,
    shell,
    vsv,
  };
}

/* ------------------------------------------------------------------ */
/* Turboprop                                                           */
/* ------------------------------------------------------------------ */

/** engine/turboprop.js girdisi */
export interface TurbopropLayout {
  style: 'turboprop';
  prop: { z: number; radius: number; blades: number; gearRatio: number };
  /** Redüksiyon dişli kutusu gövdesinin eksenel uçları */
  gearbox: { z0: number; z1: number };
  /** engine/gaspath.js girdisi */
  gas: {
    hpc: RowGeometry;
    centrifugal: CentrifugalGeometry;
    combustor: CombustorGeometry;
    hpt: RowGeometry;
    lpt: RowGeometry;
    casing: [number, number][];
    shafts: { lp: [number, number, number]; hp: [number, number, number] };
  };
  /** Dış gövde profili [r, z] */
  case: [number, number][];
  /** Jet borusu: başı, ağzı, baş ve ağız yarıçapı; kuyruk konisi */
  exhaust: { z0: number; z1: number; r0: number; radius: number; coneR: number; coneZ1: number };
  mounts: [number, number];
  engineR: number;
}

function turbopropLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): TurbopropLayout {
  const prop = find<PropellerModule>(graph, 'propeller')!;
  const noz = find<NozzleModule>(graph, 'nozzle')!;
  const { hpc, hpt, lpt, combustor: cb } = gp;
  const cen = gp.centrifugal;
  if (!cen) throw new FlowpathError('Turboprop gaz jeneratörü şimdilik santrifüj son kademe ister.');
  const rd = cen.rd;
  // Egzoz borusu ağzı: güç türbini çıkışı (istasyon 5), ağız Mach'ında
  const exitR = Math.sqrt(annulusArea(sized.point.stations['5'], noz.exitMach ?? 0.3, GAS) / Math.PI);
  const exhaust = {
    z0: lpt.z1 + 0.08,
    z1: lpt.z1 + 0.72,
    r0: lpt.tip[1] + 0.04,
    radius: exitR,
    coneR: lpt.hub[1],
    coneZ1: lpt.z1 + 0.52,
  };
  const casePts: [number, number][] = [
    [hpc.tip[0] + 0.1, hpc.z0 - 0.12],
    [hpc.tip[0] + 0.12, hpc.z0 + 0.12],
    [hpc.tip[1] + 0.13, hpc.z1],
    [rd + 0.1, cen.z + 0.04],
    [cb.rOut + 0.11, cb.z1 - 0.06],
    [hpt.tip[0] + 0.11, hpt.z0 + 0.06],
    [lpt.tip[1] + 0.06, lpt.z1 + 0.1],
  ];
  return {
    style: 'turboprop',
    prop: { z: PROP_Z, radius: prop.diameter / 2, blades: prop.blades, gearRatio: gp.omega.lp / ((prop.rpm * 2 * Math.PI) / 60) },
    gearbox: { z0: PROP_Z + 0.28, z1: hpc.z0 - 0.1 },
    gas: {
      hpc,
      centrifugal: cen,
      combustor: cb,
      hpt,
      lpt,
      casing: [
        [hpc.tip[0] + 0.01, hpc.z0 - 0.06],
        [hpc.tip[1] + 0.01, hpc.z1],
        [rd + 0.02, cen.z + 0.09],
        [cb.rOut + 0.02, cb.z1 - 0.01],
        [hpt.tip[0] + 0.01, hpt.z0],
        [lpt.tip[1] + 0.01, lpt.z1 + 0.05],
      ],
      shafts: { lp: [PROP_Z + 0.38, lpt.z1 + 0.05, gp.shafts.lp], hp: [hpc.z0 - 0.06, hpt.z1 + 0.04, gp.shafts.hp] },
    },
    case: casePts,
    exhaust,
    mounts: [mid(PROP_Z + 0.28, hpc.z0 - 0.1) + 0.06, cb.z1 - 0.11],
    engineR: Math.max(...casePts.map((p) => p[0])) + 0.05,
  };
}

/* ------------------------------------------------------------------ */
/* Yüksek baypaslı turbofan (kaportalı, ayrık akış)                    */
/* ------------------------------------------------------------------ */

/** M4 öncesi elle modellenmiş turbofanın fan uç yarıçapı: fan/kaporta/pilon şekilleri buna göre ölçeklenir */
export const TF_REF_FAN_TIP = 1.386;
/** Lüle akış katsayıları (etkin / geometrik alan): baypas ve çekirdek */
const CD_BYPASS = 0.89;
const CD_CORE = 0.97;

/** [r, z] noktaları arasında doğrusal ara değer (z artan) */
export function profileAt(pts: [number, number][], z: number): number {
  if (z <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][1]) {
      const [r0, z0] = pts[i - 1];
      const [r1, z1] = pts[i];
      return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
    }
  }
  return pts[pts.length - 1][0];
}

/** engine/core.js, fan.js, nacelle.js, pylon.js girdisi */
export interface TurbofanLayout {
  style: 'turbofan';
  /** Fan, kaporta ve pilonun ölçeği (fan ucu / M4 öncesi model) */
  s: number;
  fan: RowGeometry;
  booster: RowGeometry;
  hpc: RowGeometry;
  hpt: RowGeometry;
  lpt: RowGeometry;
  combustor: CombustorGeometry;
  shafts: { lp: [number, number, number]; hp: [number, number, number] };
  /** Ayırıcı burnu ve çekirdek kaportası profili [r, z] (lüle başına kadar) */
  splitter: { z: number; r: number };
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
  intake: { z: number; radius: number };
  exhaust: { z: number; radius: number };
}

function turbofanLayout(sized: SizedEngine, gp: GasPath): TurbofanLayout {
  const fan = gp.front!;
  const booster = gp.booster!;
  const { hpc, hpt, lpt, combustor: cb } = gp;
  if (!booster) throw new FlowpathError('Kaportalı turbofan şimdilik booster (LPC) ister.');
  const s = fan.tip[0] / TF_REF_FAN_TIP;
  const fanZ = fan.z0;

  // Çekirdek kaportası: iç parçaların zarfı + boşluk (aksesuar, boru, bleed payı)
  const zS = fanZ + 0.3 * s;
  const rS = booster.tip[0] + 0.058;
  const rMax = Math.max(booster.tip[1] + 0.2, hpc.tip[0] + 0.31, cb.rOut + 0.32, lpt.tip[1] + 0.1);
  const zLip = lpt.z1 + 0.52;
  // Egzoz konisi: taban LPT çıkış göbeğinde; M4 öncesi modelin ojiv
  // profili (taban 0,4 m, boy 1,2 m) taban yarıçapıyla orantılı ölçeklenir
  const plugBase = lpt.hub[1] - 0.01;
  const k = plugBase / 0.4;
  const pz0 = lpt.z1 + 0.19;
  const plug: [number, number][] = (
    [
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
    ] as [number, number][]
  ).map(([r, dz]) => [plugBase * r, pz0 + dz * k]);
  // Çekirdek lülesi ağzı: ağızdaki koni yarıçapının dışında, A9 kadar
  const r1 = Math.sqrt(profileAt(plug, zLip) ** 2 + sized.ref.A9 / CD_CORE / Math.PI);
  const zN0 = lpt.z1 + 0.22;
  const rN0 = Math.max(r1 + 0.065, lpt.tip[1] + 0.05);
  const cowl: [number, number][] = [
    [rS, zS],
    [rS + 0.35 * (rMax - rS), zS + 0.13],
    [rS + 0.75 * (rMax - rS), booster.z1 - 0.1],
    [rMax * 0.99, hpc.z0 + 0.1],
    [rMax, (hpc.z1 + cb.z0) / 2],
    [rMax * 0.985, cb.z1],
    [Math.max(rMax * 0.94, lpt.tip[1] + 0.12), hpt.z1 + 0.1],
    [Math.max(rN0 + 0.05, lpt.tip[1] + 0.08), lpt.z1 - 0.05],
    [rN0, zN0],
  ];
  // Baypas lülesi: kaporta iç duvarı, ağızdaki çekirdek kaportasından A19 kadar dışarıda
  const bz = fanZ + 1.8 * s;
  const rCore = profileAt(cowl, bz);
  const rDuct = Math.sqrt(rCore ** 2 + sized.ref.A19 / CD_BYPASS / Math.PI);
  const ductR = lpt.tip[1] + 0.046;
  const exhaustDuct: [number, number][] = [
    [ductR, lpt.z1 + 0.065],
    [ductR - 0.016, lpt.z1 + 0.15],
    [(ductR + r1) / 2 + 0.01, lpt.z1 + 0.28],
    [r1 + 0.01, lpt.z1 + 0.42],
    [r1, zLip],
  ];
  const ogvZ = fanZ + 0.48 * s;
  const strutZ = booster.z1;
  return {
    style: 'turbofan',
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
    splitter: { z: zS, r: rS },
    coreCowl: cowl,
    bypassExit: { z: bz, rCore, rDuct },
    coreNozzle: { z0: zN0, r0: rN0, z1: zLip, r1 },
    plug,
    rearFrame: { z: lpt.z1 + 0.16, hub: plugBase, tip: ductR },
    exhaustDuct,
    ogv: { z: ogvZ, hub: profileAt(cowl, ogvZ) + 0.014, tip: 1.392 * s },
    struts: { z: strutZ, hub: profileAt(cowl, strutZ) - 0.02, tip: 1.39 * s },
    intake: { z: fanZ - 1.97 * s, radius: 1.1 * s },
    exhaust: { z: zLip - 0.01, radius: r1 - 0.09 },
  };
}

/* ------------------------------------------------------------------ */
/* Kütle                                                               */
/* ------------------------------------------------------------------ */

/** Yoğunluklar [kg/m³] */
const RHO = { ti: 4500, steel: 7900, ni: 8200 };
/**
 * Kademe başına dolu hacim oranı (kanat + disk + stator + gövde payı) ve
 * ince cidarlı kabukların etkin kalınlıkları [m]. Mertebeler kamuya açık
 * motor kütlelerinden (J79 sınıfı turbojet ~1,7 t, F110 sınıfı ~1,8 t)
 * ayarlandı; amaç tasarımlar arası karşılaştırma, tam değer değil.
 */
const FILL = { comp: 0.14, turb: 0.16 };
/** Gövde, yanma odası (iç+dış gömlek ve kasa), art yakıcı (kanal+gömlek), lüle yaprakları */
const SHELL_T = { casing: 0.004, combustor: 0.008, afterburner: 0.005, nozzle: 0.012 };
const shellMass = (r: number, len: number, t: number, rho: number) => 2 * Math.PI * r * len * t * rho;

function rowMass(row: RowGeometry, fill: number, rho: (i: number) => number): number {
  let m = 0;
  for (let i = 0; i < row.stages; i++) {
    const t = row.stages > 1 ? i / (row.stages - 1) : 0;
    const tip = row.tip[0] + (row.tip[1] - row.tip[0]) * t;
    m += Math.PI * tip * tip * row.pitch * fill * rho(i);
  }
  return m;
}

/** Gaz yolu + motor tipine özel parçalar (gövde, art yakıcı, pervane…) */
function estimateMass(gp: GasPath, shaftLen: { lp: number; hp: number }, extra: Record<string, number>): FlowMetrics['mass'] {
  // Kompresörde ön kademeler titanyum, son üçte bir çelik/nikel
  const comp = (row: RowGeometry) => rowMass(row, FILL.comp, (i) => (i < row.stages * 0.67 ? RHO.ti : RHO.steel));
  const cb = gp.combustor;
  const parts: Record<string, number> = {
    // Geniş fan kendi kalemiyle (extra.fan) sayılır
    ...(gp.front && extra.fan === undefined ? { lpc: comp(gp.front) } : {}),
    ...(gp.booster ? { booster: comp(gp.booster) } : {}),
    // Santrifüj çark: dolu titanyum disk (çark + difüzör payı)
    hpc: comp(gp.hpc) + (gp.centrifugal ? Math.PI * gp.centrifugal.r1 ** 2 * 0.12 * 0.3 * RHO.ti : 0),
    combustor: shellMass(cb.rOut, cb.z1 - cb.z0, SHELL_T.combustor, RHO.ni),
    hpt: rowMass(gp.hpt, FILL.turb, () => RHO.ni),
    lpt: rowMass(gp.lpt, FILL.turb, () => RHO.ni),
    // İnce cidarlı mil boruları: LP cidarı yarıçapın %15'i, HP (LP'nin
    // dışından geçen geniş tüp) %6'sı
    shafts: shellMass(gp.shafts.lp, shaftLen.lp, 0.15 * gp.shafts.lp, RHO.steel) + shellMass(gp.shafts.hp, shaftLen.hp, 0.06 * gp.shafts.hp, RHO.steel),
    ...extra,
  };
  const core = Object.values(parts).reduce((a, b) => a + b, 0);
  // Dış donanım, aksesuar dişli kutusu, yataklar, borular
  parts.externals = 0.18 * core;
  return { total: core + parts.externals, parts };
}

/* ------------------------------------------------------------------ */
/* Motor                                                               */
/* ------------------------------------------------------------------ */

export type EngineLayout = BareJetLayout | TurbopropLayout | TurbofanLayout;

export interface Flowpath {
  rpm: { lp: number; hp: number };
  gas: GasPath;
  layout: EngineLayout;
  /** Geometriye bağlı denetim büyüklükleri */
  metrics: FlowMetrics;
}

export interface FlowMetrics {
  /**
   * Uç bağıl Mach sayısı: LP milinin ilk kompresörü (pervaneli motorda
   * durağan pervane ucu) ve HPC ilk kademesi
   */
  tipMachRel: { lp: number; hp: number };
  /** Son türbin kademelerinin AN² değeri [m²·rpm²] (disk/kanat gerilmesi ölçüsü) */
  an2: { hpt: number; lpt: number };
  /** Fan/LPC uç çapı ya da pervane çapı [m]; toplam boy (giriş → lüle) [m] */
  diameter: number;
  length: number;
  /** Kuru kütle tahmini [kg] ve modül dağılımı (pervane dahil) */
  mass: { total: number; parts: Record<string, number> };
}

/** Bağıl uç Mach'ı: eksenel hız + uç dönme hızı, giriş statik sıcaklığında */
function tipMachRel(st: Station, M: number, uTip: number, g: GasProps): number {
  const Ts = st.T / (1 + ((g.gamma - 1) / 2) * M * M);
  const a = Math.sqrt(g.gamma * g.R * Ts);
  const vax = M * a;
  return Math.sqrt(vax * vax + uTip * uTip) / a;
}

const rpmOf = (w: number) => (w * 60) / (2 * Math.PI);

export function computeFlowpath(graph: EngineGraph, sized: SizedEngine): Flowpath {
  const st = (id: StationId) => sized.point.stations[id];
  const gp = computeGasPath(graph, sized);
  const frontMod = find<CompressorModule>(graph, 'fan') ?? find<CompressorModule>(graph, 'lpc');
  const hpcMod = find<CompressorModule>(graph, 'hpc')!;
  const prop = find<PropellerModule>(graph, 'propeller');
  const { hpt, lpt } = gp;

  let layout: EngineLayout;
  let extra: Record<string, number>;
  let shaftLen: { lp: number; hp: number };
  let diameter: number;
  let length: number;
  let lpTipMach: number;
  if (prop) {
    const L = turbopropLayout(graph, sized, gp);
    layout = L;
    shaftLen = { lp: L.gas.shafts.lp[1] - L.gas.shafts.lp[0], hp: L.gas.shafts.hp[1] - L.gas.shafts.hp[0] };
    // Redüktör kütlesi pervane torkuyla (≈ 8,5 kg / kN·m), kompozit pervane ≈ 14 kg/m² × D²
    const propOmega = (prop.rpm * 2 * Math.PI) / 60;
    const propTorque = (sized.ref.shaftPower / propOmega) * 1e-3;
    extra = {
      casing: shellMass(L.engineR - 0.05, L.case[L.case.length - 1][1] - L.case[0][1], SHELL_T.casing, RHO.steel),
      gearbox: 8.5 * propTorque,
      propeller: 14 * prop.diameter ** 2,
      exhaust: shellMass(L.exhaust.r0, L.exhaust.z1 - L.exhaust.z0, 0.002, RHO.ni),
    };
    diameter = prop.diameter;
    length = L.exhaust.z1 - (PROP_Z - 0.54);
    // Durağan pervane ucu Mach'ı
    lpTipMach = (propOmega * L.prop.radius) / Math.sqrt(AIR.gamma * AIR.R * st('0').T);
  } else if (find<NozzleModule>(graph, 'nozzle')!.style === 'separate') {
    const L = turbofanLayout(sized, gp);
    layout = L;
    shaftLen = { lp: L.shafts.lp[1] - L.shafts.lp[0], hp: L.shafts.hp[1] - L.shafts.hp[0] };
    const f = L.fan;
    extra = {
      // Fan: kanatlar + disk (dolu oran düşük: geniş kordlu ama ince kanatlar)
      fan: Math.PI * f.tip[0] ** 2 * f.pitch * 0.055 * RHO.ti,
      // Fan muhafazası (kanat kopması muhafazası, kevlar sargılı)
      fanCase: shellMass(f.tip[0] + 0.06, 0.75 * L.s, 0.012, 2000),
      casing: shellMass(L.hpc.tip[0] + 0.05, L.lpt.z1 - L.hpc.z0, SHELL_T.casing, RHO.ti),
      exhaust: shellMass(L.coreNozzle.r0, L.coreNozzle.z1 - L.coreNozzle.z0 + 0.3, 0.004, RHO.ni) + shellMass(L.rearFrame.hub, L.plug[L.plug.length - 1][1] - L.plug[0][1], 0.003, RHO.ni),
    };
    diameter = 2 * f.tip[0];
    length = L.plug[L.plug.length - 1][1] - L.intake.z;
    lpTipMach = tipMachRel(st('2'), frontMod!.mach[0], f.uTip, AIR);
  } else {
    const L = bareJetLayout(graph, sized, gp);
    layout = L;
    shaftLen = { lp: L.gas.shafts.lp[1] - L.gas.shafts.lp[0], hp: L.gas.shafts.hp[1] - L.gas.shafts.hp[0] };
    extra = {
      casing: shellMass(L.R, L.tailCone[0] - L.intakeZ, SHELL_T.casing, RHO.ti),
      afterburner: shellMass(L.ab.R, L.ab.z1 - L.ab.z0, SHELL_T.afterburner, RHO.ni),
      // Yapraklar + contalar + senkron halka + aktüatörler
      nozzle: shellMass(L.nozzle.hingeR, L.nozzle.primary + L.nozzle.divergent, SHELL_T.nozzle, RHO.ni) * 1.3,
    };
    diameter = 2 * gp.front!.tip[0];
    length = L.ab.z1 + L.nozzle.primary + L.nozzle.divergent - INTAKE_Z;
    lpTipMach = tipMachRel(st('2'), frontMod!.mach[0], gp.front!.uTip, AIR);
  }

  const metrics: FlowMetrics = {
    tipMachRel: { lp: lpTipMach, hp: tipMachRel(st('25'), hpcMod.mach[0], gp.hpc.uTip, AIR) },
    an2: {
      hpt: Math.PI * (hpt.tip[1] ** 2 - hpt.hub[1] ** 2) * rpmOf(gp.omega.hp) ** 2,
      lpt: Math.PI * (lpt.tip[1] ** 2 - lpt.hub[1] ** 2) * rpmOf(gp.omega.lp) ** 2,
    },
    diameter,
    length,
    mass: estimateMass(gp, shaftLen, extra),
  };
  return { rpm: { lp: rpmOf(gp.omega.lp), hp: rpmOf(gp.omega.hp) }, gas: gp, layout, metrics };
}
