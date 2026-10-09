/**
 * Motor tasarım parametreleri ve tasarım noktası boyutlandırması.
 *
 * Tasarım noktası (deniz seviyesi, durağan, ISA, kalkış gücü) çevrim analizi
 * bütün "donanım" büyüklüklerini sabitler: lüle alanları, HP türbin akış
 * kapasitesi, türbin basınç oranları, referans düzeltilmiş akışlar. Tasarım
 * dışı (off-design) hesap bu sabitlerle yapılır; yani motor bir kez
 * "üretilir", sonra farklı koşullarda "çalıştırılır".
 *
 * İleride oyuncunun kendi motorunu tasarlayacağı atölye doğrudan bu
 * `EngineDesign` yapısını düzenleyecek.
 */

import { ambient, type Ambient } from './atmosphere';
import {
  AIR,
  GAS,
  FAR_STOICH,
  compressT,
  convergentNozzle,
  expandT,
  expansionPR,
  flowFunctionRatio,
  fuelForT4,
  idealJet,
  mixStreams,
  LHV as LHV_,
  P_STD,
  T_STD,
} from './gas';

export type StationId = '0' | '2' | '13' | '19' | '21' | '25' | '3' | '4' | '45' | '5' | '7' | '9';

/**
 * Motor türü.
 *  - turbofan: yüksek baypaslı, ayrık akışlı sivil turbofan
 *  - militaryTurbofan: düşük baypaslı, karışık akışlı, art yakıcılı askeri turbofan
 *  - turbojet: iki milli, art yakıcılı turbojet (baypas yok)
 *  - turboprop: gaz jeneratörü + serbest güç türbini + pervane
 *  - turboshaft: gaz jeneratörü + serbest güç türbini + çıkış mili (M5a)
 *
 * M5a'dan beri modüllerden türetilen SUNUM tipidir (design/traits.ts):
 * kuru turbojet `turbojet`, karışık akışlı kaportalı turbofan `turbofan`
 * sunumunu kullanır; farkları `EngineTraits` taşır.
 */
export type EngineKind = 'turbofan' | 'militaryTurbofan' | 'turbojet' | 'turboprop' | 'turboshaft';

/** Sınır değerler (EICAS kırmızı/amber çizgileri ve prosedür limitleri). */
export interface EngineLimits {
  egtRedline: number; // °C
  egtAmber: number; // °C — sürekli azami
  egtStart: number; // °C — çalıştırma sırasında
  n1Redline: number;
  n2Redline: number;
  starterCutout: number;
  fuelOnMinN2: number; // prosedür: yakıtı en erken bu N2'de ver
  idleN2: number;
  leanBlowoutFar: number;
  /** Bu gerçek sıcaklığın üstünde kalınan süre türbine kalıcı hasar verir */
  egtDamage: number; // °C
  egtDamageSeconds: number;
  ignitionMinFar: number;
}

/** Çalıştırma sistemi */
export interface StartSystem {
  /** Marş motoru torku, HP mil ekseninde, sıfır devirde [N·m] */
  starterTorque: number;
  /** Marş torkunun sıfırlandığı N2 */
  starterFadeN2: number;
  /** Çalıştırma programı yakıt/hava oranı: marş başında ve rölantiye yakın */
  farHigh: number;
  farLow: number;
}

/** Art yakıcı (reheat) ve değişken kesitli yakınsak-ıraksak lüle */
export interface AfterburnerSpec {
  /** Tam art yakıcıda jet borusu çıkış sıcaklığı [K] */
  t7Max: number;
  eta: number;
  /** Jet borusu basınç kaybı: art yakıcı sönük / tam yanık */
  dpDry: number;
  dpLit: number;
  /** Baypas–çekirdek karıştırıcı basınç kaybı */
  mixerLoss: number;
  /**
   * Karışma verimi (0–1): kuru itki, ayrı iki jet ile tam karışmış jet
   * arasında bu oranda (1: tam karışma). Düz (confluent) karıştırıcı ~0,85,
   * lobe'lu ~0,97. Art yakıcı yanarken akış borunun içinde karışır.
   */
  mixingEff?: number;
}

/**
 * Karışmış akışın kuru itkisi, eksik karışma payıyla: tam karışmış jet ile
 * baypas ve çekirdeğin ayrı ayrı genişlediği iki jet arasında. `wet`
 * (0–1) art yakıcının yanma oranı: yanarken karışma tamamlanır.
 */
export function mixedJetThrust(
  fullyMixed: number,
  hot: { W: number; T: number; P: number },
  cold: { W: number; T: number; P: number },
  pFactor: number,
  pAmb: number,
  cv: number,
  mixingEff = 1,
  wet = 0,
): number {
  const eta = mixingEff + (1 - mixingEff) * Math.min(1, Math.max(0, wet));
  if (eta >= 1 || cold.W <= 1e-9) return fullyMixed;
  const jet = (s: { W: number; T: number; P: number }, g: typeof GAS) => {
    const p = s.P * pFactor;
    return p > pAmb ? s.W * idealJet(p, s.T, pAmb, g).velocity * cv : 0;
  };
  const separate = jet(hot, GAS) + jet(cold, AIR);
  return separate + eta * (fullyMixed - separate);
}

/** Pervane ve redüksiyon dişli kutusu (turboprop) */
export interface PropellerSpec {
  diameter: number;
  blades: number;
  /** %100 NP'de pervane devri [rpm] */
  rpm: number;
  /** Statik itkide pervane başarı katsayısı (figure of merit) */
  figureOfMerit: number;
  /** İleri uçuşta pervane verimi */
  efficiency: number;
  /** Tasarım noktasında egzoz lülesi basınç oranı (artık jet itkisi) */
  nozzlePR: number;
}

/**
 * Art yakıcısız karışık akış (M5a): baypas ve çekirdek ortak sabit lüleden
 * çıkar. Art yakıcılı motorda karışma `AfterburnerSpec`'tedir.
 */
export interface MixerSpec {
  /** Karıştırıcı basınç kaybı */
  loss: number;
  /** Karışma verimi (düz ~0,85, lobe'lu ~0,97) */
  mixingEff: number;
}

/** Turboşaft çıkış mili (serbest güç türbini, M5a) */
export interface ShaftOutputSpec {
  /** %100 NP'de çıkış devri [rpm] */
  rpm: number;
  /** Tasarım noktasında egzoz basınç oranı (P5/P0) */
  nozzlePR: number;
  /** Redüktör/aktarma verimi */
  transmissionEff: number;
}

export interface Station {
  /** Toplam sıcaklık [K] (0, 9 ve 19 için statik) */
  T: number;
  /** Toplam basınç [Pa] (0, 9 ve 19 için statik) */
  P: number;
  /** Kütle akışı [kg/s] */
  W: number;
}

export type Stations = Record<StationId, Station>;

export interface CompressorMapShape {
  /** Tasarım hızında surge hattı basınç oranı / tasarım basınç oranı */
  surgePRFactor: number;
  /** Tasarım hızında boğulma ucu basınç oranı / tasarım basınç oranı */
  chokePRFactor: number;
  /** Tasarım hızında surge hattı akışı / tasarım akışı */
  surgeFlowFactor: number;
  /** Tasarım hızında boğulma akışı / tasarım akışı */
  chokeFlowFactor: number;
  /** Hız hattı üzerindeki tasarım noktası konumu (0 = surge, 1 = boğulma) */
  betaDesign: number;
}

export interface EngineDesign {
  kind: EngineKind;
  name: string;
  /** Menüde gösterilen kısa açıklama */
  summary: string;
  /** Fan yüzü toplam hava akışı, kalkış [kg/s] */
  massFlow: number;
  bypassRatio: number;
  /** Fan basınç oranı (baypas tarafı) */
  fanPR: number;
  /** Fanın çekirdek tarafındaki basınç artışının baypas tarafına oranı */
  fanHubPRFraction: number;
  boosterPR: number;
  hpcPR: number;
  /** Türbin giriş sıcaklığı T4 [K] */
  tit: number;
  eff: {
    fan: number;
    booster: number;
    hpc: number;
    hpt: number;
    lpt: number;
    combustor: number;
    mech: number;
  };
  /** Yanma odası toplam basınç kaybı (oran) */
  combustorDP: number;
  /** Baypas kanalı toplam basınç kaybı (oran) */
  bypassDuctDP: number;
  /** Lüle hız katsayısı */
  nozzleCv: number;
  /** %100 N1 ve N2 mekanik devirleri [rpm] */
  n1Rpm: number;
  n2Rpm: number;
  /** Mil atalet momentleri [kg·m²] */
  inertia: { lp: number; hp: number };
  fanDiameter: number;
  fanBlades: number;
  /** HP milinden çekilen aksesuar gücü (%100 N2'de) [W] */
  accessoryPower: number;
  hpcMap: CompressorMapShape;
  limits: EngineLimits;
  start: StartSystem;
  afterburner?: AfterburnerSpec;
  prop?: PropellerSpec;
  /** Art yakıcısız karışık akış (yalnız `afterburner` yokken) */
  mixer?: MixerSpec;
  /** Turboşaft çıkış mili */
  shaft?: ShaftOutputSpec;
}

/** Yüksek baypaslı sivil turbofanın limitleri (dersler bu motorla yazıldı). */
export const TURBOFAN_LIMITS: EngineLimits = {
  egtRedline: 1010,
  egtAmber: 975,
  egtStart: 750,
  n1Redline: 1.04,
  n2Redline: 1.05,
  starterCutout: 0.56,
  fuelOnMinN2: 0.2,
  idleN2: 0.62,
  leanBlowoutFar: 0.0042,
  egtDamage: 1150,
  egtDamageSeconds: 4,
  ignitionMinFar: 0.0055,
};

/**
 * Varsayılan motor: 2.77 m fanlı, ~330 kN sınıfı jenerik yüksek baypas
 * turbofan. Değerler bu sınıfın kamuya açık tipik aralıklarından seçilmiştir
 * (BPR ≈ 9, OPR ≈ 45, T4 ≈ 1680 K); belirli bir ticari motoru temsil etmez.
 */
export const DEFAULT_DESIGN: EngineDesign = {
  kind: 'turbofan',
  name: 'TF-330 (jenerik yüksek baypas)',
  summary: 'Geniş gövdeli yolcu uçağı motoru. BPR 9: itkinin çoğunu dev fan üretir; sessiz ve tasarruflu.',
  massFlow: 1150,
  bypassRatio: 9.0,
  fanPR: 1.55,
  fanHubPRFraction: 0.8,
  boosterPR: 1.95,
  hpcPR: 16.5,
  tit: 1680,
  eff: {
    fan: 0.915,
    booster: 0.89,
    hpc: 0.87,
    hpt: 0.9,
    lpt: 0.92,
    combustor: 0.995,
    mech: 0.99,
  },
  combustorDP: 0.04,
  bypassDuctDP: 0.015,
  nozzleCv: 0.985,
  n1Rpm: 2550,
  n2Rpm: 10100,
  inertia: { lp: 700, hp: 28 },
  fanDiameter: 2.77,
  fanBlades: 22,
  accessoryPower: 350e3,
  hpcMap: {
    surgePRFactor: 1.2,
    chokePRFactor: 0.62,
    surgeFlowFactor: 0.91,
    chokeFlowFactor: 1.03,
    betaDesign: 0.5,
  },
  limits: TURBOFAN_LIMITS,
  start: { starterTorque: 520, starterFadeN2: 0.72, farHigh: 0.0165, farLow: 0.0095 },
};

/**
 * Art yakıcılı askeri turbofan: ~75 kN kuru, ~125 kN art yakıcılı sınıfı.
 * Üç kademeli fan, karışık akış, değişken yakınsak-ıraksak lüle. Tek motorlu
 * ya da çift motorlu 4. nesil avcıların motor sınıfından tipik değerler.
 */
export const MILITARY_TURBOFAN: EngineDesign = {
  kind: 'militaryTurbofan',
  name: 'AF-125 (jenerik art yakıcılı turbofan)',
  summary: 'Avcı uçağı motoru. Düşük baypas, karışık akış, art yakıcı ve açılıp kapanan lüle yaprakları.',
  massFlow: 112,
  bypassRatio: 0.68,
  fanPR: 3.1,
  fanHubPRFraction: 1,
  boosterPR: 1,
  hpcPR: 8.2,
  tit: 1670,
  eff: { fan: 0.86, booster: 0.9, hpc: 0.87, hpt: 0.89, lpt: 0.9, combustor: 0.995, mech: 0.99 },
  combustorDP: 0.05,
  bypassDuctDP: 0.03,
  nozzleCv: 0.98,
  n1Rpm: 10400,
  n2Rpm: 14200,
  inertia: { lp: 14, hp: 5 },
  fanDiameter: 0.93,
  fanBlades: 36,
  accessoryPower: 120e3,
  hpcMap: { ...DEFAULT_DESIGN.hpcMap },
  // Askeri motorlarda sıcaklık fan türbini girişinde (FTIT) ölçülür ve
  // sivil motorlardan daha yüksek çalışır
  limits: {
    ...TURBOFAN_LIMITS,
    egtRedline: 1130,
    egtAmber: 1100,
    egtStart: 800,
    egtDamage: 1270,
    idleN2: 0.64,
  },
  start: { starterTorque: 150, starterFadeN2: 0.7, farHigh: 0.0165, farLow: 0.0095 },
  afterburner: { t7Max: 2000, eta: 0.9, dpDry: 0.03, dpLit: 0.065, mixerLoss: 0.01, mixingEff: 0.85 },
};

/**
 * İki milli art yakıcılı turbojet: ~40 kN kuru, ~60 kN art yakıcılı. 1950–60'ların
 * süpersonik avcı motorlarının (baypassız, düşük basınç oranı) tipik değerleri.
 */
export const TURBOJET: EngineDesign = {
  kind: 'turbojet',
  name: 'TJ-60 (jenerik art yakıcılı turbojet)',
  summary: "Soğuk savaş dönemi avcı motoru. Baypas yok: bütün hava yanma odasından geçer. Gürültülü, susuz ama basit.",
  massFlow: 66,
  bypassRatio: 0,
  fanPR: 3.2,
  fanHubPRFraction: 1,
  boosterPR: 1,
  hpcPR: 2.9,
  tit: 1230,
  eff: { fan: 0.84, booster: 0.9, hpc: 0.84, hpt: 0.88, lpt: 0.88, combustor: 0.98, mech: 0.985 },
  combustorDP: 0.06,
  bypassDuctDP: 0.0,
  nozzleCv: 0.975,
  n1Rpm: 11150,
  n2Rpm: 11400,
  inertia: { lp: 10, hp: 6 },
  fanDiameter: 0.8,
  fanBlades: 25,
  accessoryPower: 60e3,
  hpcMap: { surgePRFactor: 1.18, chokePRFactor: 0.66, surgeFlowFactor: 0.9, chokeFlowFactor: 1.04, betaDesign: 0.5 },
  limits: {
    ...TURBOFAN_LIMITS,
    egtRedline: 890,
    egtAmber: 860,
    egtStart: 700,
    egtDamage: 1000,
    idleN2: 0.62,
  },
  start: { starterTorque: 170, starterFadeN2: 0.7, farHigh: 0.018, farLow: 0.011 },
  afterburner: { t7Max: 1900, eta: 0.88, dpDry: 0.04, dpLit: 0.08, mixerLoss: 0 },
};

/**
 * Turboprop: ~2.5 MW, altı palli 3.9 m pervane. Gaz jeneratörü (eksenel +
 * santrifüj kompresör) ve pervaneyi redüksiyon dişlisiyle çeviren serbest güç
 * türbini. Bölgesel yolcu ve taktik nakliye uçaklarının motor sınıfı.
 */
export const TURBOPROP: EngineDesign = {
  kind: 'turboprop',
  name: 'TP-25 (jenerik turboprop)',
  summary: 'Nakliye/bölgesel uçak motoru. Türbin gücü dişli kutusuyla pervaneyi çevirir; itkinin %90\'ı pervaneden.',
  massFlow: 9.5,
  bypassRatio: 0,
  fanPR: 1,
  fanHubPRFraction: 1,
  boosterPR: 1,
  hpcPR: 15,
  tit: 1440,
  eff: { fan: 0.9, booster: 0.9, hpc: 0.83, hpt: 0.88, lpt: 0.9, combustor: 0.99, mech: 0.985 },
  combustorDP: 0.05,
  bypassDuctDP: 0,
  nozzleCv: 0.97,
  n1Rpm: 20400,
  n2Rpm: 29800,
  inertia: { lp: 0.3, hp: 0.35 },
  fanDiameter: 3.93,
  fanBlades: 6,
  accessoryPower: 40e3,
  hpcMap: { ...DEFAULT_DESIGN.hpcMap },
  // Turboprop'ta EGT yerine türbinler arası sıcaklık (ITT) izlenir
  limits: {
    ...TURBOFAN_LIMITS,
    egtRedline: 900,
    egtAmber: 870,
    egtStart: 850,
    egtDamage: 1010,
    idleN2: 0.62,
  },
  start: { starterTorque: 34, starterFadeN2: 0.6, farHigh: 0.017, farLow: 0.01 },
  prop: { diameter: 3.93, blades: 6, rpm: 1200, figureOfMerit: 0.72, efficiency: 0.85, nozzlePR: 1.1 },
};

/**
 * Oyunda seçilebilen motorlar. El yazımı dört tasarım burada; grafikten
 * üretilen tipler (turboşaft, M5a P7) `registerCatalogDesign` ile başlangıçta
 * eklenir (sim katmanı design/'ı içe aktarmaz). Kaydı olmayan tip için
 * `catalogDesign` tipli hata atar.
 */
export const ENGINE_CATALOG = {
  turbofan: DEFAULT_DESIGN,
  militaryTurbofan: MILITARY_TURBOFAN,
  turbojet: TURBOJET,
  turboprop: TURBOPROP,
} as Record<EngineKind, EngineDesign>;

/** Grafikten üretilen bir tipi katalogda kaydeder (design/catalog.ts başlangıçta) */
export function registerCatalogDesign(kind: EngineKind, d: EngineDesign) {
  ENGINE_CATALOG[kind] = d;
}

/** Katalogdaki tasarım; kaydı olmayan tipte DesignError (undefined değil) */
export function catalogDesign(kind: EngineKind): EngineDesign {
  const d = ENGINE_CATALOG[kind] as EngineDesign | undefined;
  if (!d) throw new DesignError(`"${kind}" motoru henüz katalogda yok.`);
  return d;
}

/** Tasarım noktasında sabitlenen ve tasarım dışı hesapta kullanılan değerler. */
export interface EngineReference {
  T2: number;
  P2: number;
  /** Fan düzeltilmiş akışı [kg/s] */
  W2c: number;
  T25: number;
  /** HPC düzeltilmiş akışı [kg/s] */
  W25c: number;
  T4: number;
  P3: number;
  /** Yanma odası giriş düzeltilmiş akış parametresi W3·√T3/P3 (basınç kaybı ölçeği) */
  combustorFlowParam: number;
  /** HP türbin akış kapasitesi referansı W4·√T4/P4 (boğulmuş eşdeğer) */
  FC4: number;
  /** HP türbin basınç oranı */
  PRhpt: number;
  /** P4/P0 tasarım oranı */
  P4overP0: number;
  T45: number;
  /** Çekirdek (birincil) lüle alanı [m²] */
  A9: number;
  /** Baypas lüle alanı [m²] */
  A19: number;
  /** Tasarım yakıt akışı [kg/s] */
  Wf: number;
  /** Mil açısal hızları [rad/s] */
  omega1: number;
  omega2: number;
  /** HP ve LP milinin tasarım güçleri [W] */
  hpPower: number;
  lpPower: number;
  /** Tasarım (çekirdek) akışı [kg/s] — ölçekleme için */
  coreFlow: number;
  /** Art yakıcı: tam yanıkta yakıt [kg/s] ve kuru lüle boğaz alanı [m²] */
  wfAbMax: number;
  A8dry: number;
  /** Turboprop: tasarım mil gücü [W] */
  shaftPower: number;
  /** Art yakıcısız karışık akış: ortak sabit lüle alanı [m²] (M5a P1 doldurur) */
  A9mix?: number;
}

export interface DesignPoint {
  stations: Stations;
  thrust: number;
  /** Tam art yakıcılı itki (art yakıcısız motorda = thrust) */
  thrustWet: number;
  wf: number;
  tsfc: number;
  opr: number;
}

export interface SizedEngine {
  design: EngineDesign;
  ref: EngineReference;
  point: DesignPoint;
}

/** HP türbin statorunun, toplam genişleme oranına göre boğulma derecesi. */
export function hptCapacityFactor(p4OverP0: number): number {
  const prNgv = Math.max(1, Math.pow(Math.max(p4OverP0, 1), 0.35));
  return flowFunctionRatio(prNgv, GAS);
}

export class DesignError extends Error {}

/** Tasarım noktası çevrim analizi ve donanım boyutlandırması. */
export function sizeEngine(design: EngineDesign, amb: Ambient = ambient(0, 0, 0)): SizedEngine {
  const d = design;
  const T2 = amb.T2;
  const P2 = amb.P2;
  const W2 = d.massFlow;
  const W25 = W2 / (1 + d.bypassRatio);
  const W13 = W2 - W25;

  // Fan
  const T13 = compressT(T2, d.fanPR, d.eff.fan);
  const P13 = P2 * d.fanPR;
  const prHub = 1 + (d.fanPR - 1) * d.fanHubPRFraction;
  const T21 = compressT(T2, prHub, d.eff.fan);
  const P21 = P2 * prHub;

  // Booster + HPC
  const T25 = compressT(T21, d.boosterPR, d.eff.booster);
  const P25 = P21 * d.boosterPR;
  const T3 = compressT(T25, d.hpcPR, d.eff.hpc);
  const P3 = P25 * d.hpcPR;

  // Yanma odası
  const P4 = P3 * (1 - d.combustorDP);
  const T4 = d.tit;
  const Wf = fuelForT4(W25, T3, T4, d.eff.combustor);
  if (!(Wf > 0)) throw new DesignError('T4, kompresör çıkış sıcaklığından düşük: yakıt gerekmez.');
  const W4 = W25 + Wf;

  // HP türbin: HPC + aksesuar gücünü karşılar
  const hpPower = W25 * AIR.cp * (T3 - T25) + d.accessoryPower;
  const T45 = T4 - hpPower / d.eff.mech / (W4 * GAS.cp);
  const PRhpt = expansionPR(T4, T45, d.eff.hpt);
  if (!Number.isFinite(PRhpt)) throw new DesignError('HP türbini gereken işi çıkaramıyor.');
  const P45 = P4 / PRhpt;

  // LP türbin: fan + booster gücünü karşılar. Turboprop'ta serbest güç
  // türbini, egzoz lülesinde küçük bir artık basınç bırakacak kadar genişler;
  // çıkardığı güç pervaneye gider.
  const compLpPower =
    W13 * AIR.cp * (T13 - T2) + W25 * AIR.cp * (T21 - T2) + W25 * AIR.cp * (T25 - T21);
  let T5: number;
  let P5: number;
  let lpPower: number;
  let shaftPower = 0;
  if (d.prop) {
    P5 = amb.P0 * d.prop.nozzlePR;
    if (P45 <= P5) throw new DesignError('Güç türbinine genişleyecek basınç kalmıyor.');
    T5 = expandT(T45, P45 / P5, d.eff.lpt);
    lpPower = W4 * GAS.cp * (T45 - T5) * d.eff.mech;
    shaftPower = lpPower - compLpPower;
  } else {
    lpPower = compLpPower;
    T5 = T45 - lpPower / d.eff.mech / (W4 * GAS.cp);
    const PRlpt = expansionPR(T45, T5, d.eff.lpt);
    if (!Number.isFinite(PRlpt)) throw new DesignError('LP türbini fanı çeviremiyor.');
    P5 = P45 / PRlpt;
  }
  if (P5 <= amb.P0 * 1.01) {
    throw new DesignError('Çekirdek lülesinde genişleyecek basınç kalmıyor (P5 ≤ P0).');
  }

  // Lüleler
  const core = convergentNozzle(P5, T5, amb.P0, GAS);
  const A9 = W4 / core.massFlux;
  const F9 = W4 * (core.velocity * d.nozzleCv + core.pressureThrustPerFlow);

  const P19t = P13 * (1 - d.bypassDuctDP);
  const byp = convergentNozzle(P19t, T13, amb.P0, AIR);
  const A19 = W13 / byp.massFlux;
  const F19 = W13 * (byp.velocity * d.nozzleCv + byp.pressureThrustPerFlow);

  let thrust = F9 + F19 - W2 * amb.V0;
  let thrustWet = thrust;
  let wfAbMax = 0;
  let A8dry = 0;
  let st7 = { T: T5, P: P5, W: W4 };
  if (d.afterburner) {
    // Karışık akış: baypas ve çekirdek jet borusunda karışır, art yakıcıdan
    // geçer ve değişken yakınsak-ıraksak lüleden tam genleşmeyle çıkar.
    const ab = d.afterburner;
    const mix = mixStreams(W4, T5, P5, W13, T13, P19t, ab.mixerLoss);
    const P7 = mix.P * (1 - ab.dpDry);
    const dry = idealJet(P7, mix.T, amb.P0);
    const mixed = mix.W * dry.velocity * d.nozzleCv;
    thrust =
      mixedJetThrust(mixed, { W: W4, T: T5, P: P5 }, { W: W13, T: T13, P: P19t }, (1 - ab.mixerLoss) * (1 - ab.dpDry), amb.P0, d.nozzleCv, ab.mixingEff) -
      W2 * amb.V0;
    A8dry = mix.W / dry.throatFlux;
    st7 = { T: mix.T, P: P7, W: mix.W };
    // Tam art yakıcı: kalan oksijenle t7Max'a ulaşan yakıt
    const oxyLeft = FAR_STOICH * W2 - Wf;
    wfAbMax = Math.min(
      oxyLeft,
      (mix.W * GAS.cp * (ab.t7Max - mix.T)) / (ab.eta * LHV_ - GAS.cp * ab.t7Max),
    );
    const T7 = (mix.W * GAS.cp * mix.T + ab.eta * wfAbMax * LHV_) / ((mix.W + wfAbMax) * GAS.cp);
    const wet = idealJet(mix.P * (1 - ab.dpLit), T7, amb.P0);
    thrustWet = (mix.W + wfAbMax) * wet.velocity * d.nozzleCv - W2 * amb.V0;
  }

  const theta = (t: number) => t / T_STD;
  const delta = (p: number) => p / P_STD;

  const FC4design = (W4 * Math.sqrt(T4)) / P4;
  const P4overP0 = P4 / amb.P0;

  const ref: EngineReference = {
    T2,
    P2,
    W2c: (W2 * Math.sqrt(theta(T2))) / delta(P2),
    T25,
    W25c: (W25 * Math.sqrt(theta(T25))) / delta(P25),
    T4,
    P3,
    combustorFlowParam: (W25 * Math.sqrt(T3)) / P3,
    FC4: FC4design / hptCapacityFactor(P4overP0),
    PRhpt,
    P4overP0,
    T45,
    A9,
    A19,
    Wf,
    omega1: (d.n1Rpm * 2 * Math.PI) / 60,
    omega2: (d.n2Rpm * 2 * Math.PI) / 60,
    hpPower,
    lpPower,
    coreFlow: W25,
    wfAbMax,
    A8dry,
    shaftPower,
  };

  const stations: Stations = {
    '0': { T: amb.T0, P: amb.P0, W: W2 },
    '2': { T: T2, P: P2, W: W2 },
    '13': { T: T13, P: P13, W: W13 },
    '19': { T: byp.staticT, P: byp.staticP, W: W13 },
    '21': { T: T21, P: P21, W: W25 },
    '25': { T: T25, P: P25, W: W25 },
    '3': { T: T3, P: P3, W: W25 },
    '4': { T: T4, P: P4, W: W4 },
    '45': { T: T45, P: P45, W: W4 },
    '5': { T: T5, P: P5, W: W4 },
    '7': st7,
    '9': { T: core.staticT, P: core.staticP, W: W4 },
  };

  return {
    design,
    ref,
    point: { stations, thrust, thrustWet, wf: Wf, tsfc: Wf / thrust, opr: P3 / P2 },
  };
}
