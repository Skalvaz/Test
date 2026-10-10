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
 *
 * Bu dosya bütün motorlarda ortak olan kısmı taşır (akış fonksiyonu, sıra
 * boyutlandırma, gaz yolu, kütle, ölçüler). Motor tipine özel 3B yerleşim
 * (gövde, lüle, kaporta, pervane…) `layouts/` altındadır ve yerleşim
 * stiline göre (`traits.ts layoutStyleOf`) seçilir. Motor ekseni z, +z
 * egzoz yönü, metre.
 */

import { AIR, GAS, type GasProps } from '../sim/gas';
import type { SizedEngine, Station, StationId } from '../sim/design';
import { layoutStyleOf } from './traits';
import { LAYOUTS, assertLayoutReady, type EngineLayout } from './layouts/index';
import type { CombustorModule, CompressorModule, EngineGraph, InletModule, PropellerModule, ShaftModule, TurbineModule } from './types';

// Eski adlar: yerleşim tipleri layouts/ altına taşındı
export type { EngineLayout, LayoutFn, LayoutResult } from './layouts/index';
export type { BareJetLayout } from './layouts/bare';
export type { TurbofanLayout } from './layouts/turbofan';
export { TF_REF_FAN_TIP } from './layouts/turbofan';
export type { TurbopropLayout } from './layouts/turboprop';
export type { TurboshaftLayout } from './layouts/turboshaft';
export type { GasGeneratorLayout } from './layouts/gasgen';

/** Giriş düzleminin konumu (test hücresi, kamera açıları buna göre) */
export const INTAKE_Z = -2.2;

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
export const meanR = (row: RowGeometry, end: 0 | 1) => (row.hub[end] + row.tip[end]) / 2;
export const mid = (a: number, b: number) => (a + b) / 2;

/**
 * Kademe histerezisi: önceki gaz yolundaki kademe sayısı ve eşik. Kademe
 * sayısı x = Δh/(ψ·U²) tamsayıya `hysteresis`'ten yakınken bir kademe
 * değişmez (atölyede sürüklerken sınırda titreme olmasın).
 */
export interface StageMemory {
  stages: number;
  hysteresis: number;
}

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
  prev?: StageMemory,
): RowGeometry {
  const aIn = annulusArea(inSt, m.mach[0], gas);
  const aOut = annulusArea(outSt, m.mach[1], gas);
  const tipIn = Math.sqrt(aIn / (Math.PI * (1 - m.hubTip * m.hubTip)));
  const hubIn = m.hubTip * tipIn;
  const tipOut = m.taper * tipIn;
  const hub2 = tipOut * tipOut - aOut / Math.PI;
  if (!(hub2 > 0)) {
    throw new FlowpathError(
      `${m.type.toUpperCase()} çıkışında kanal sığmıyor: uç daralması çok fazla ya da Mach çok düşük.`,
      'annulus.closed',
      m.type,
      [`${m.type}.taper`, `${m.type}.mach.1`],
      { mach1: m.mach[1], taper: m.taper },
    );
  }
  const hubOut = Math.sqrt(hub2);
  const r = (rms(hubIn, tipIn) + rms(hubOut, tipOut)) / 2;
  const uMean = omega * r;
  const x = dh / (m.loading * uMean * uMean);
  // Bozuk girdi (sıfır uç hızı ya da yükleme): sonsuz kademe döngüsü yerine öğretici hata
  if (!(x <= 1000)) throw new FlowpathError(`${m.type.toUpperCase()} kademe sayısı hesaplanamadı: uç hızı ya da yükleme sıfıra çok yakın.`, 'stages.invalid', m.type, [], { value: x });
  let stages = Math.max(1, Math.ceil(x - 1e-9));
  if (prev && prev.hysteresis > 0 && Math.abs(stages - prev.stages) === 1 && Math.abs(x - Math.round(x)) < prev.hysteresis) {
    stages = Math.max(1, prev.stages);
  }
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

/**
 * Geometri aşaması hatası (grafik kuralları geçmiş ama gaz yolu kurulamıyor).
 * GraphError gibi yapısal alan taşır: öğretici çeviri (warnings.ts) metni
 * ayrıştırmadan modülü, düğmeleri ve sayıları okur.
 */
/**
 * LP milinin yükü (FlowpathError.data.lpLoad): LPT hatalarının öğretici
 * metni buna göre seçilir (fan → BPR/FPR, LPC → LPC PR/T4, güç türbini → genel)
 */
export const LP_LOAD = { shaft: 0, fan: 1, lpc: 2 } as const;

/** LPT hatasına milin yükünü ekler (FlowpathError değilse olduğu gibi) */
export function withLpLoad(err: unknown, lpLoad: number): unknown {
  if (!(err instanceof FlowpathError) || err.data?.lpLoad !== undefined) return err;
  return new FlowpathError(err.message, err.code, err.group, err.knobs, { ...err.data, lpLoad });
}

export class FlowpathError extends Error {
  /** Hata kimliği (ör. 'annulus.closed', 'combustor.cansFit', 'layout.notReady') */
  readonly code: string;
  /** İlgili modül tipi ya da 'engine' */
  readonly group: string;
  /** İlgili düğme kimlikleri (knobs.ts) */
  readonly knobs: string[];
  /** Mesajdaki sayılar (ör. { cans, canDiameter }) */
  readonly data?: Record<string, number>;
  constructor(message: string, code = '', group = 'engine', knobs: string[] = [], data?: Record<string, number>) {
    super(message);
    this.name = 'FlowpathError';
    this.code = code;
    this.group = group;
    this.knobs = knobs;
    this.data = data;
  }
}

/* ------------------------------------------------------------------ */
/* Ortak gaz yolu                                                      */
/* ------------------------------------------------------------------ */

/** Turboprobun pervane düzlemi (z) */
export const PROP_Z = -2.08;

/**
 * Turboşaftın çıkış flanşı düzlemi (z). Motor küçük (T700 sınıfı ~1,2 m):
 * flanş, gaz jeneratörü test hücresinin ortasına (z ≈ 0) gelecek kadar önde.
 */
/** Turboşaft halka girişinin en kısa boyu (HPC uç yarıçapı katı): çerçeve (0,04·k ≈ 0,26·uç) sığar */
export const TURBOSHAFT_MIN_INLET = 0.3;

export const SHAFT_Z = -0.95;

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
  /** Gömleklerin iç/dış zarfı (kutuda: ortalama yarıçap ∓ kutu yarıçapı) */
  rIn: number;
  rOut: number;
  injectors: number;
  /** Kutu tipi: kutu sayısı (halkada yok) */
  cans?: number;
  /** Kutu stili (M5a P5): ayrı kaplı kutu ya da ortak kasalı kutu-halka (halkada yok) */
  style?: 'can' | 'canAnnular';
  /** Kutu gömleği yarıçapı [m] (halkada yok) */
  canR?: number;
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

/** Gaz yolu seçenekleri (graph.ts BuildOptions'tan) */
export interface GasPathOptions {
  /** Kademe histerezisi için önceki gaz yolu */
  previous?: GasPath;
  /** Varsayılan 0 (şablonlar, testler); atölye sürüklemede 0,03 */
  stageHysteresis?: number;
}

/** Grafikteki (tekil) modül */
export function moduleOf<T extends { type: string }>(g: EngineGraph, type: T['type']): T | undefined {
  return g.modules.find((m) => m.type === type) as T | undefined;
}

const tipFor = (st: Station, m: { mach: [number, number]; hubTip: number }, g: GasProps) =>
  Math.sqrt(annulusArea(st, m.mach[0], g) / (Math.PI * (1 - m.hubTip ** 2)));

export function computeGasPath(graph: EngineGraph, sized: SizedEngine, opts: GasPathOptions = {}): GasPath {
  const s = sized.point.stations;
  const st = (id: StationId) => s[id];
  const inlet = moduleOf<InletModule>(graph, 'inlet')!;
  const prop = moduleOf<PropellerModule>(graph, 'propeller');
  const shaftMod = moduleOf<ShaftModule>(graph, 'shaft');
  const fan = moduleOf<CompressorModule>(graph, 'fan');
  const lpcMod = moduleOf<CompressorModule>(graph, 'lpc');
  const hpcMod = moduleOf<CompressorModule>(graph, 'hpc')!;
  const comb = moduleOf<CombustorModule>(graph, 'combustor')!;
  const hptMod = moduleOf<TurbineModule>(graph, 'hpt')!;
  const lptMod = moduleOf<TurbineModule>(graph, 'lpt')!;
  const frontMod = fan ?? lpcMod;
  const boosterMod = fan ? lpcMod : undefined;
  const prev = opts.previous;
  const hyst = opts.stageHysteresis ?? 0;
  const memory = (row: RowGeometry | undefined): StageMemory | undefined => (row && hyst > 0 ? { stages: row.stages, hysteresis: hyst } : undefined);

  // --- mil devirleri: milin ilk kompresörünün (yoksa güç türbininin) uç hızından ---
  if (!hpcMod.tipSpeed) throw new FlowpathError('HPC uç hızı vermeli.', 'tipSpeed.missing', 'hpc', ['hpc.tipSpeed']);
  const w2 = hpcMod.tipSpeed / tipFor(st('25'), hpcMod, AIR);
  let w1: number;
  if (frontMod) {
    if (!frontMod.tipSpeed) {
      throw new FlowpathError('LP milinin ilk kompresörü uç hızı vermeli.', 'tipSpeed.missing', frontMod.type, [`${frontMod.type}.tipSpeed`]);
    }
    w1 = frontMod.tipSpeed / tipFor(st('2'), frontMod, AIR);
  } else {
    if (!lptMod.tipSpeed) throw new FlowpathError('Kompresörsüz LP mili (güç türbini) uç hızı vermeli.', 'tipSpeed.missing', 'lpt', ['lpt.tipSpeed']);
    w1 = lptMod.tipSpeed / tipFor(st('45'), lptMod, GAS);
  }

  const cpA = AIR.cp;
  const cpG = GAS.cp;
  const W2 = st('2').W;
  let front: RowGeometry | undefined;
  if (frontMod) {
    // Fan çıkışı baypas + çekirdek akışının tamamını taşır (ayırıcıdan önce)
    const out: Station = fan ? { T: st('13').T, P: st('13').P, W: W2 } : st('21');
    front = sizeRow(frontMod, st('2'), out, w1, AIR, cpA * (out.T - st('2').T), memory(prev?.front));
  }
  const booster = boosterMod
    ? sizeRow(boosterMod, st('21'), st('25'), w1, AIR, cpA * (st('25').T - st('21').T), memory(prev?.booster))
    : undefined;

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
  const hpc = sizeRow(hpcMod, s25, axOut, w2, AIR, cpA * (axOut.T - s25.T), memory(prev?.hpc));
  const hpt = sizeRow(hptMod, st('4'), st('45'), w2, GAS, cpG * (st('4').T - st('45').T), memory(prev?.hpt));
  // LPT'nin yükü hataya taşınır: öğretici metin (warnings.ts) fanı, LPC'yi
  // ya da serbest güç türbinini ayırır, düğmeleri buna göre önerir
  const lpLoad = fan ? LP_LOAD.fan : frontMod ? LP_LOAD.lpc : LP_LOAD.shaft;
  let lpt: RowGeometry;
  try {
    lpt = sizeRow(lptMod, st('45'), st('5'), w1, GAS, cpG * (st('45').T - st('5').T), memory(prev?.lpt));
  } catch (err) {
    throw withLpLoad(err, lpLoad);
  }

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
  // Turboşaft (M5a P7): çıkış flanşı → mil gövdesi (gearboxLength) → halka
  // giriş (boyu HPC uç yarıçapı cinsinden; en az TURBOSHAFT_MIN_INLET: giriş
  // çerçevesi ilk rotora girmesin) → HPC
  else if (shaftMod) place(hpc, SHAFT_Z + shaftMod.gearboxLength + Math.max(inlet.length, TURBOSHAFT_MIN_INLET) * hpc.tip[0]);
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
  // Halka: yükseklik alandan. Kutu (ve kutu-halka): toplam alan N kutuya
  // bölünür, kutu çapı halka yüksekliğinin yerine geçer; kutular çevreye sığmalı
  let H = aComb / (2 * Math.PI * rMean);
  // Kutu sayısı tanımlı ve 6–16 tamsayı: grafik kuralı 'combustor.cans' garanti eder
  const cans = comb.style !== 'annular' ? comb.cans! : undefined;
  if (cans) {
    const rc = Math.sqrt(aComb / (cans * Math.PI));
    if (cans * 2 * rc * 1.08 > 2 * Math.PI * rMean) {
      throw new FlowpathError(
        `${cans} kutu çevreye sığmıyor (kutu çapı ${(2 * rc * 100).toFixed(0)} cm): daha az kutu ya da daha yüksek referans hızı.`,
        'combustor.cansFit',
        'combustor',
        ['combustor.cans', 'combustor.refVelocity'],
        { cans, canDiameter: 2 * rc },
      );
    }
    H = 2 * rc;
  }
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
    combustor: {
      z0: cz0,
      z1: cz1,
      rIn: rMean - H / 2,
      rOut: rMean + H / 2,
      injectors: cans ?? comb.injectors,
      cans,
      // Halkada alan yazılmaz (şablon yerleşimleri ve altın test aynı kalır)
      ...(cans ? { style: comb.style as 'can' | 'canAnnular', canR: H / 2 } : {}),
    },
    hpt,
    lpt,
    shafts: { lp: rLp, hp: rHp },
    omega: { lp: w1, hp: w2 },
  };
}

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

/**
 * Dış zarf: [r, z] profillerinden [z, r] listesi, z kesin artan (geri
 * dönen ya da aynı z'deki noktalar atlanır). Yerleşimlerin `outerProfile`
 * alanı ve motor kartının `envelope`'u bu biçimdedir.
 */
export function envelopeOf(...profiles: [number, number][][]): [number, number][] {
  const out: [number, number][] = [];
  for (const pts of profiles) {
    for (const [r, z] of pts) if (!out.length || z > out[out.length - 1][0] + 1e-6) out.push([z, r]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Kütle                                                               */
/* ------------------------------------------------------------------ */

/** Yoğunluklar [kg/m³] */
export const RHO = { ti: 4500, steel: 7900, ni: 8200 };
/**
 * Kademe başına dolu hacim oranı (kanat + disk + stator + gövde payı) ve
 * ince cidarlı kabukların etkin kalınlıkları [m]. Mertebeler kamuya açık
 * motor kütlelerinden (J79 sınıfı turbojet ~1,7 t, F110 sınıfı ~1,8 t)
 * ayarlandı; amaç tasarımlar arası karşılaştırma, tam değer değil.
 */
const FILL = { comp: 0.14, turb: 0.16 };
/** Gövde, yanma odası (iç+dış gömlek ve kasa), art yakıcı (kanal+gömlek), lüle yaprakları */
export const SHELL_T = { casing: 0.004, combustor: 0.008, afterburner: 0.005, nozzle: 0.012 };
export const shellMass = (r: number, len: number, t: number, rho: number) => 2 * Math.PI * r * len * t * rho;

function rowMass(row: RowGeometry, fill: number, rho: (i: number) => number): number {
  let m = 0;
  for (let i = 0; i < row.stages; i++) {
    const t = row.stages > 1 ? i / (row.stages - 1) : 0;
    const tip = row.tip[0] + (row.tip[1] - row.tip[0]) * t;
    m += Math.PI * tip * tip * row.pitch * fill * rho(i);
  }
  return m;
}

export type MassBreakdown = FlowMetrics['mass'];

/** Sıranın eksenel ortası */
const rowMid = (row: RowGeometry) => mid(row.z0, row.z1);

/**
 * Gaz yolu + motor tipine özel parçalar (gövde, art yakıcı, pervane…).
 * Her kalemin eksenel ağırlık merkezi de döner (M5a): gaz yolu kalemleri
 * sıraların ortasında, tipe özel kalemler `extraZ`'den (yerleşimden).
 */
function estimateMass(
  gp: GasPath,
  shaftLen: { lp: number; hp: number },
  extra: Record<string, number>,
  extraZ: (key: string) => number,
): MassBreakdown {
  // Kompresörde ön kademeler titanyum, son üçte bir çelik/nikel
  const comp = (row: RowGeometry) => rowMass(row, FILL.comp, (i) => (i < row.stages * 0.67 ? RHO.ti : RHO.steel));
  const cb = gp.combustor;
  // Santrifüj çark: dolu titanyum disk (çark + difüzör payı)
  const impeller = gp.centrifugal ? Math.PI * gp.centrifugal.r1 ** 2 * 0.12 * 0.3 * RHO.ti : 0;
  const hpcAxial = comp(gp.hpc);
  // İnce cidarlı mil boruları: LP cidarı yarıçapın %15'i, HP (LP'nin
  // dışından geçen geniş tüp) %6'sı
  const shaftLp = shellMass(gp.shafts.lp, shaftLen.lp, 0.15 * gp.shafts.lp, RHO.steel);
  const shaftHp = shellMass(gp.shafts.hp, shaftLen.hp, 0.06 * gp.shafts.hp, RHO.steel);
  const parts: Record<string, number> = {
    // Geniş fan kendi kalemiyle (extra.fan) sayılır
    ...(gp.front && extra.fan === undefined ? { lpc: comp(gp.front) } : {}),
    ...(gp.booster ? { booster: comp(gp.booster) } : {}),
    hpc: hpcAxial + impeller,
    combustor: shellMass(cb.rOut, cb.z1 - cb.z0, SHELL_T.combustor, RHO.ni),
    hpt: rowMass(gp.hpt, FILL.turb, () => RHO.ni),
    lpt: rowMass(gp.lpt, FILL.turb, () => RHO.ni),
    shafts: shaftLp + shaftHp,
    ...extra,
  };
  const core = Object.values(parts).reduce((a, b) => a + b, 0);
  // Dış donanım, aksesuar dişli kutusu, yataklar, borular
  parts.externals = 0.18 * core;

  // --- eksenel ağırlık merkezleri ---
  // Miller: LP milin ilk kompresöründen (yoksa HPC'den) LPT sonuna, HP mil HPC'den HPT sonuna
  const lpStart = (gp.front ?? gp.hpc).z0;
  const zLp = mid(lpStart, gp.lpt.z1);
  const zHp = mid(gp.hpc.z0, gp.hpt.z1);
  const centroids: Record<string, number> = {
    ...(parts.lpc !== undefined ? { lpc: rowMid(gp.front!) } : {}),
    ...(gp.booster ? { booster: rowMid(gp.booster) } : {}),
    hpc: parts.hpc > 0 ? (hpcAxial * rowMid(gp.hpc) + impeller * (gp.centrifugal?.z ?? 0)) / parts.hpc : rowMid(gp.hpc),
    combustor: mid(cb.z0, cb.z1),
    hpt: rowMid(gp.hpt),
    lpt: rowMid(gp.lpt),
    shafts: shaftLp + shaftHp > 0 ? (shaftLp * zLp + shaftHp * zHp) / (shaftLp + shaftHp) : zHp,
  };
  for (const k of Object.keys(extra)) centroids[k] = extraZ(k);
  let mz = 0;
  for (const k of Object.keys(centroids)) mz += parts[k] * centroids[k];
  // Dış donanım çekirdeğin üstüne dağılmış sayılır: çekirdekle aynı merkez
  centroids.externals = core > 0 ? mz / core : zHp;
  const total = core + parts.externals;
  return { total, parts, centroids, cgZ: core > 0 ? mz / core : zHp };
}

/**
 * Yerleşime özgü kütle kaleminin eksenel ağırlık merkezi. Bilinmeyen kalem
 * (yeni yerleşimlerin kalemleri) giriş ile egzoz ağzının ortasına konur.
 */
function extraCentroid(layout: EngineLayout, gp: GasPath, key: string): number {
  // Yerleşim tiplerinin yalnız kalıcı alanları okunur (exhaustExit hepsinde
  // var); konumlar çoğunlukla gaz yolundan: yerleşim dosyaları değişse de
  // bu hesap kırılmaz
  const exitZ = layout.exhaustExit.z;
  const front = gp.front;
  switch (layout.style) {
    case 'bare': {
      const ab = layout.ab as { z0: number; z1: number } | null | undefined;
      if (key === 'casing') return mid(INTAKE_Z, gp.lpt.z1);
      if (key === 'afterburner' && ab) return mid(ab.z0, ab.z1);
      // Kuru motor (M5a P5): jet borusu ve sabit lüle kendi boylarının ortasında
      if (key === 'jetPipe' && layout.jetPipe) return mid(layout.jetPipe.z0, layout.jetPipe.z1);
      if (key === 'nozzle' && layout.nozzle.kind === 'fixed') return mid(layout.nozzle.z0, layout.nozzle.z1);
      if (key === 'nozzle') return mid(ab ? ab.z1 : gp.lpt.z1, exitZ);
      break;
    }
    case 'nacelle':
      if (key === 'fan' && front) return rowMid(front);
      // Muhafaza fan diskinin çevresinde, biraz arkaya uzanır
      if (key === 'fanCase' && front) return front.z0 + 0.28 * layout.s;
      if (key === 'casing') return mid(gp.hpc.z0, gp.lpt.z1);
      if (key === 'exhaust') return mid(gp.lpt.z1, exitZ);
      break;
    case 'turboprop':
      if (key === 'casing') return mid(gp.hpc.z0, gp.lpt.z1);
      if (key === 'gearbox') return mid(PROP_Z + 0.28, gp.hpc.z0 - 0.1);
      if (key === 'propeller') return PROP_Z;
      if (key === 'exhaust') return mid(gp.lpt.z1, exitZ);
      break;
    case 'turboshaft':
      // M5a P7: gövde gaz jeneratörü boyunca, ön çerçeve ve mil gövdesi önde
      if (key === 'casing') return mid(gp.hpc.z0, gp.lpt.z1);
      if (key === 'inlet') return mid(layout.inlet.z0, layout.inlet.z1);
      if (key === 'outputShaft' || key === 'gearbox') return mid(layout.output.z, layout.inlet.z0);
      if (key === 'exhaust') return mid(gp.lpt.z1, exitZ);
      break;
  }
  return mid(layout.intake.z, exitZ);
}

/* ------------------------------------------------------------------ */
/* Motor                                                               */
/* ------------------------------------------------------------------ */

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
  /**
   * Kuru kütle tahmini [kg] ve modül dağılımı (pervane dahil); her kalemin
   * eksenel ağırlık merkezi [m, motor z'si] ve motorun ağırlık merkezi
   */
  mass: { total: number; parts: Record<string, number>; centroids: Record<string, number>; cgZ: number };
  /** Turbomakine sıraları (uyarılar ve sonuç paneli; M5a) */
  rows: Partial<Record<RowKey, RowMetrics>>;
  /** Santrifüj çark ucu hızı [m/s] */
  impellerUTip?: number;
  /** HPT girişi eksenel Mach'ı (düğme: hpt.mach[0]) */
  hptInletMach: number;
  /** Yanma odası: referans hız [m/s], boy ve halka yüksekliği (kutuda kutu çapı) [m] */
  combustor: { style: CombustorModule['style']; vref: number; length: number; height: number; cans?: number };
  /** Serbest güç türbini / pervane ya da çıkış mili devir oranı */
  gearRatio?: number;
  /** Son eksenel HPC kademesinin kanat yüksekliği [mm] */
  hpcExitBladeMm: number;
}

/** Gaz yolu sıraları: LP milinin ilk kompresörü, booster, HPC (eksenel), HPT, LPT */
export type RowKey = 'front' | 'booster' | 'hpc' | 'hpt' | 'lpt';

export interface RowMetrics {
  stages: number;
  /** İlk kademe uç hızı ve ortalama yarıçapta kanat hızı [m/s] */
  uTip: number;
  uMean: number;
  /** Gerçek kademe yüklemesi ψ (tamsayı kademeyle) */
  loading: number;
  /** Son kademe kanat yüksekliği [m] */
  hExit: number;
  /** Mil devri [rpm] */
  rpm: number;
}

/** Bağıl uç Mach'ı: eksenel hız + uç dönme hızı, giriş statik sıcaklığında */
export function tipMachRel(st: Station, M: number, uTip: number, g: GasProps): number {
  const Ts = st.T / (1 + ((g.gamma - 1) / 2) * M * M);
  const a = Math.sqrt(g.gamma * g.R * Ts);
  const vax = M * a;
  return Math.sqrt(vax * vax + uTip * uTip) / a;
}

const rpmOf = (w: number) => (w * 60) / (2 * Math.PI);

/**
 * Gaz yolu + yerleşim stiline göre 3B yerleşim + ölçüler. Hazır olmayan
 * yerleşimde (READY=false) tipli FlowpathError atar.
 */
export function computeFlowpath(graph: EngineGraph, sized: SizedEngine, opts: GasPathOptions = {}): Flowpath {
  const st = (id: StationId) => sized.point.stations[id];
  assertLayoutReady(graph);
  const gp = computeGasPath(graph, sized, opts);
  const hpcMod = moduleOf<CompressorModule>(graph, 'hpc')!;
  const { hpt, lpt } = gp;
  const r = LAYOUTS[layoutStyleOf(graph)](graph, sized, gp);
  const rpm = { lp: rpmOf(gp.omega.lp), hp: rpmOf(gp.omega.hp) };

  const rowMetrics = (row: RowGeometry, spool: 'lp' | 'hp'): RowMetrics => ({
    stages: row.stages,
    uTip: row.uTip,
    uMean: row.uMean,
    loading: row.loading,
    hExit: row.tip[1] - row.hub[1],
    rpm: rpm[spool],
  });
  const rows: FlowMetrics['rows'] = {
    ...(gp.front ? { front: rowMetrics(gp.front, 'lp') } : {}),
    ...(gp.booster ? { booster: rowMetrics(gp.booster, 'lp') } : {}),
    hpc: rowMetrics(gp.hpc, 'hp'),
    hpt: rowMetrics(gp.hpt, 'hp'),
    lpt: rowMetrics(gp.lpt, 'lp'),
  };
  const comb = moduleOf<CombustorModule>(graph, 'combustor')!;
  const cb = gp.combustor;
  // Çıkış devri: pervane ya da çıkış mili (serbest güç türbini → redüktör)
  const outRpm = moduleOf<PropellerModule>(graph, 'propeller')?.rpm ?? moduleOf<ShaftModule>(graph, 'shaft')?.rpm;

  const metrics: FlowMetrics = {
    tipMachRel: { lp: r.lpTipMach, hp: tipMachRel(st('25'), hpcMod.mach[0], gp.hpc.uTip, AIR) },
    an2: {
      hpt: Math.PI * (hpt.tip[1] ** 2 - hpt.hub[1] ** 2) * rpm.hp ** 2,
      lpt: Math.PI * (lpt.tip[1] ** 2 - lpt.hub[1] ** 2) * rpm.lp ** 2,
    },
    diameter: r.diameter,
    length: r.length,
    mass: estimateMass(gp, r.shaftLen, r.extra, (k) => extraCentroid(r.layout, gp, k)),
    rows,
    impellerUTip: gp.centrifugal?.uTip,
    hptInletMach: moduleOf<TurbineModule>(graph, 'hpt')!.mach[0],
    combustor: {
      style: comb.style,
      vref: comb.refVelocity,
      length: cb.z1 - cb.z0,
      // Kutuda yükseklik yerine kutu çapı (computeGasPath H = 2·rc)
      height: cb.rOut - cb.rIn,
      cans: cb.cans,
    },
    gearRatio: outRpm ? rpm.lp / outRpm : undefined,
    hpcExitBladeMm: (gp.hpc.tip[1] - gp.hpc.hub[1]) * 1000,
  };
  return { rpm, gas: gp, layout: r.layout, metrics };
}
