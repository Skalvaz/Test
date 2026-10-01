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
/* Motor                                                               */
/* ------------------------------------------------------------------ */

const meanR = (row: RowGeometry, end: 0 | 1) => (row.hub[end] + row.tip[end]) / 2;

/** Çıplak (kaportasız) motor yerleşimi: engine/barejet.js girdisi */
export interface BareJetLayout {
  R: number;
  throat: number;
  intakeZ: number;
  noseLen: number;
  igv: number;
  gas: {
    lpc: RowGeometry & { part: string; firstMaterial?: string; firstChord?: number };
    hpc: RowGeometry;
    combustor: { z0: number; z1: number; rIn: number; rOut: number; injectors: number };
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

export interface Flowpath {
  rpm: { lp: number; hp: number };
  layout: BareJetLayout;
  /** Geometriye bağlı denetim büyüklükleri */
  metrics: FlowMetrics;
}

export interface FlowMetrics {
  /** İlk kompresör kademesinin uç bağıl Mach sayısı (LP ve HP) */
  tipMachRel: { lp: number; hp: number };
  /** Son türbin kademelerinin AN² değeri [m²·rpm²] (disk/kanat gerilmesi ölçüsü) */
  an2: { hpt: number; lpt: number };
  /** Fan/LPC uç çapı [m] ve toplam boy (giriş → lüle) [m] */
  diameter: number;
  length: number;
  /** Kuru kütle tahmini [kg] ve modül dağılımı */
  mass: { total: number; parts: Record<string, number> };
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

function rowMass(row: RowGeometry, fill: number, rho: (i: number) => number): number {
  let m = 0;
  for (let i = 0; i < row.stages; i++) {
    const t = row.stages > 1 ? i / (row.stages - 1) : 0;
    const tip = row.tip[0] + (row.tip[1] - row.tip[0]) * t;
    m += Math.PI * tip * tip * row.pitch * fill * rho(i);
  }
  return m;
}

function estimateMass(L: BareJetLayout): FlowMetrics['mass'] {
  const g = L.gas;
  const shell = (r: number, len: number, t: number, rho: number) => 2 * Math.PI * r * len * t * rho;
  // Kompresörde ön kademeler titanyum, son üçte bir çelik/nikel
  const comp = (row: RowGeometry) => rowMass(row, FILL.comp, (i) => (i < row.stages * 0.67 ? RHO.ti : RHO.steel));
  const parts: Record<string, number> = {
    lpc: comp(g.lpc),
    hpc: comp(g.hpc),
    combustor: shell(g.combustor.rOut, g.combustor.z1 - g.combustor.z0, SHELL_T.combustor, RHO.ni),
    hpt: rowMass(g.hpt, FILL.turb, () => RHO.ni),
    lpt: rowMass(g.lpt, FILL.turb, () => RHO.ni),
    // İnce cidarlı mil boruları: LP cidarı yarıçapın %15'i, HP (LP'nin
    // dışından geçen geniş tüp) %6'sı
    shafts:
      shell(g.shafts.lp[2], g.shafts.lp[1] - g.shafts.lp[0], 0.15 * g.shafts.lp[2], RHO.steel) +
      shell(g.shafts.hp[2], g.shafts.hp[1] - g.shafts.hp[0], 0.06 * g.shafts.hp[2], RHO.steel),
    casing: shell(L.R, L.tailCone[0] - L.intakeZ, SHELL_T.casing, RHO.ti),
    afterburner: shell(L.ab.R, L.ab.z1 - L.ab.z0, SHELL_T.afterburner, RHO.ni),
    // Yapraklar + contalar + senkron halka + aktüatörler
    nozzle: shell(L.nozzle.hingeR, L.nozzle.primary + L.nozzle.divergent, SHELL_T.nozzle, RHO.ni) * 1.3,
  };
  const core = Object.values(parts).reduce((a, b) => a + b, 0);
  // Dış donanım, aksesuar dişli kutusu, yataklar, borular
  parts.externals = 0.18 * core;
  return { total: core + parts.externals, parts };
}

function find<T extends { type: string }>(g: EngineGraph, type: T['type']): T | undefined {
  return g.modules.find((m) => m.type === type) as T | undefined;
}

/** Bağıl uç Mach'ı: eksenel hız + uç dönme hızı, giriş statik sıcaklığında */
function tipMachRel(st: Station, M: number, uTip: number, g: GasProps): number {
  const Ts = st.T / (1 + ((g.gamma - 1) / 2) * M * M);
  const a = Math.sqrt(g.gamma * g.R * Ts);
  const vax = M * a;
  return Math.sqrt(vax * vax + uTip * uTip) / a;
}

export function computeFlowpath(graph: EngineGraph, sized: SizedEngine): Flowpath {
  const s = sized.point.stations;
  const st = (id: StationId) => s[id];
  const inlet = find<InletModule>(graph, 'inlet')!;
  const fan = find<CompressorModule>(graph, 'fan');
  const lpcMod = find<CompressorModule>(graph, 'lpc');
  const hpcMod = find<CompressorModule>(graph, 'hpc')!;
  const comb = find<CombustorModule>(graph, 'combustor')!;
  const hptMod = find<TurbineModule>(graph, 'hpt')!;
  const lptMod = find<TurbineModule>(graph, 'lpt')!;
  const ab = find<AfterburnerModule>(graph, 'afterburner');
  const noz = find<NozzleModule>(graph, 'nozzle')!;
  const front = fan ?? lpcMod;
  if (!front) throw new FlowpathError('LP milinde kompresör yok.');
  if (fan && lpcMod) throw new FlowpathError('Fan + ayrı LPC (booster) M4b ile gelecek.');

  // --- mil devirleri: milin ilk kompresörünün uç hızından ---
  const W2 = st('2').W;
  const frontIn = st('2');
  // Fan çıkışı baypas + çekirdek akışının tamamını taşır (ayırıcıdan önce)
  const frontOut: Station = fan ? { T: st('13').T, P: st('13').P, W: W2 } : st('21');
  const tipFront = Math.sqrt(annulusArea(frontIn, front.mach[0], AIR) / (Math.PI * (1 - front.hubTip ** 2)));
  const tipHpc = Math.sqrt(annulusArea(st('25'), hpcMod.mach[0], AIR) / (Math.PI * (1 - hpcMod.hubTip ** 2)));
  if (!front.tipSpeed || !hpcMod.tipSpeed) throw new FlowpathError('Milin ilk kompresörü uç hızı vermeli.');
  const w1 = front.tipSpeed / tipFront;
  const w2 = hpcMod.tipSpeed / tipHpc;

  const cpA = AIR.cp;
  const cpG = GAS.cp;
  const lpc = sizeRow(front, frontIn, frontOut, w1, AIR, cpA * (frontOut.T - frontIn.T));
  const hpc = sizeRow(hpcMod, st('25'), st('3'), w2, AIR, cpA * (st('3').T - st('25').T));
  const hpt = sizeRow(hptMod, st('4'), st('45'), w2, GAS, cpG * (st('4').T - st('45').T));
  const lpt = sizeRow(lptMod, st('45'), st('5'), w1, GAS, cpG * (st('45').T - st('5').T));

  // --- eksenel yerleşim ---
  const place = (row: RowGeometry, z0: number) => {
    row.z0 = z0;
    row.z1 = z0 + (row.stages - 1) * row.pitch;
  };
  place(lpc, INTAKE_Z + inlet.length * lpc.tip[0]);
  place(hpc, lpc.z1 + (hpcMod.gap ?? 1) * ((lpc.pitch + hpc.pitch) / 2));

  // Yanma odası: halka yüksekliği referans hızdan, ortalama yarıçap HPC
  // çıkışı ile HPT girişi arasında
  const s3 = st('3');
  const rho3 = s3.P / (AIR.R * s3.T);
  const aComb = s3.W / (rho3 * comb.refVelocity);
  const rMean = (meanR(hpc, 1) + meanR(hpt, 0)) / 2 + comb.meanShift;
  const H = aComb / (2 * Math.PI * rMean);
  const cz0 = hpc.z1 + comb.gap * hpc.pitch;
  const cz1 = cz0 + comb.lengthHeight * H;
  place(hpt, cz1 + hptMod.gap * hpt.pitch);
  place(lpt, hpt.z1 + lptMod.gap * lpt.pitch);

  // --- miller: yarıçap tork^(1/3) ile; HP mili LP milinin dışından geçer ---
  const lpTorque = sized.ref.lpPower / w1;
  const rLp = 0.00305 * Math.cbrt(lpTorque);
  const rHp = rLp + 0.06;

  // --- egzoz ve art yakıcı ---
  const coneR = lpt.hub[1] - 0.015;
  const coneZ0 = lpt.z1 + 0.12;
  const tailCone: [number, number, number] = [coneZ0, coneZ0 + 2.4 * coneR, coneR];
  // Jet borusu: kuru art yakıcıda karışmış akış (istasyon 7)
  const s7 = st('7');
  const liner = ab ? Math.sqrt(annulusArea(s7, ab.mach, GAS) / Math.PI) : lpt.tip[1];
  const abZ0 = coneZ0 + 0.05;
  const abZ1 = abZ0 + (ab ? ab.lengthDiameter * 2 * liner : 0.6);
  const abR = liner + 0.03;
  // Lüle boğazı: kuru tasarım noktası etkin alanından; geometrik boğaz
  // akış katsayısı kadar (~0,77) büyüktür
  const A8 = sized.ref.A8dry > 0 ? sized.ref.A8dry : sized.ref.A9;
  const nozzle = {
    hingeR: liner + 0.01,
    throat0: Math.sqrt(A8 / Math.PI / NOZZLE_CD),
    primary: 0.3,
    divergent: noz.style === 'cd' ? 0.34 : 0,
    flaps: noz.flaps,
  };

  // --- gövde ---
  const caseC = Math.max(lpc.tip[0], hpc.tip[0]);
  const rOut = rMean + H / 2;
  const rIn = rMean - H / 2;
  const turbTip = Math.max(hpt.tip[0], lpt.tip[1]);
  let shell: [number, number][];
  let R: number;
  let splitterZ: number | null = null;
  if (fan && (fan.bypassRatio ?? 0) > 0) {
    // Baypas kanalı: çekirdek gövdesinin dışında, verilen Mach'ta
    const s13 = st('13');
    const bypass = graph.bypassDuct ?? { dp: 0, mach: 0.15 };
    const aBp = annulusArea(s13, bypass.mach, AIR);
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
    R = caseC + 0.035;
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
  const mid = (a: number, b: number) => (a + b) / 2;
  const flanges = [
    INTAKE_Z,
    mid(lpc.z1, hpc.z0),
    hpc.z1 + 0.07,
    cz0 + 0.02,
    mid(cz1, hpt.z0) + 0.04,
    abZ0,
    mid(abZ0, abZ1),
    abZ1 - 0.05,
  ];
  if (fan) flanges.splice(1, 1, lpc.z1 + 0.1);

  // VSV halkaları (dış donanım): kompresörlerin ön stator sıraları. Baypaslı
  // motorda HPC baypas kanalının altında kalır, halkaları dışarıdan görünmez
  const vsv: BareJetLayout['vsv'] = [];
  const outer: [RowGeometry, CompressorModule, string][] = [[lpc, front, fan ? 'fan' : 'booster']];
  if (!fan || !(fan.bypassRatio! > 0)) outer.push([hpc, hpcMod, 'hpc']);
  for (const [row, mod, part] of outer) {
    const n = Math.min(mod.vsv ?? 0, row.stages);
    if (n > 0) vsv.push({ z: Array.from({ length: n }, (_, i) => row.z0 + (i + 0.5) * row.pitch * 0.62), part });
  }

  const layout: BareJetLayout = {
    R,
    throat: lpc.tip[0] + 0.005,
    intakeZ: INTAKE_Z,
    noseLen: inlet.noseLength * lpc.tip[0],
    igv: inlet.struts,
    gas: {
      lpc: { ...lpc, part: fan ? 'fan' : 'booster', firstMaterial: front.firstMaterial, firstChord: front.firstChord },
      hpc,
      combustor: { z0: cz0, z1: cz1, rIn, rOut, injectors: comb.injectors },
      hpt,
      lpt,
      casing,
      shafts: { lp: [INTAKE_Z + 0.1, coneZ0 - 0.05, rLp], hp: [hpc.z0 - 0.08, hpt.z1 + 0.05, rHp] },
    },
    splitterZ,
    tailCone,
    ab: { z0: abZ0, z1: abZ1, R: abR, liner },
    nozzle,
    mounts: [mid(hpc.z0, hpc.z1), lpt.z1 + 0.05],
    flanges,
    shell,
    vsv,
  };

  const metrics: FlowMetrics = {
    tipMachRel: {
      lp: tipMachRel(frontIn, front.mach[0], lpc.uTip, AIR),
      hp: tipMachRel(st('25'), hpcMod.mach[0], hpc.uTip, AIR),
    },
    an2: {
      hpt: Math.PI * (hpt.tip[1] ** 2 - hpt.hub[1] ** 2) * ((w2 * 60) / (2 * Math.PI)) ** 2,
      lpt: Math.PI * (lpt.tip[1] ** 2 - lpt.hub[1] ** 2) * ((w1 * 60) / (2 * Math.PI)) ** 2,
    },
    diameter: 2 * lpc.tip[0],
    length: abZ1 + nozzle.primary + nozzle.divergent - INTAKE_Z,
    mass: estimateMass(layout),
  };

  return { rpm: { lp: (w1 * 60) / (2 * Math.PI), hp: (w2 * 60) / (2 * Math.PI) }, layout, metrics };
}
