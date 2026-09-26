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
  compressT,
  convergentNozzle,
  expansionPR,
  flowFunctionRatio,
  fuelForT4,
  P_STD,
  T_STD,
} from './gas';

export type StationId = '0' | '2' | '13' | '19' | '21' | '25' | '3' | '4' | '45' | '5' | '9';

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
  name: string;
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
}

/**
 * Varsayılan motor: 2.77 m fanlı, ~330 kN sınıfı jenerik yüksek baypas
 * turbofan. Değerler bu sınıfın kamuya açık tipik aralıklarından seçilmiştir
 * (BPR ≈ 9, OPR ≈ 45, T4 ≈ 1680 K); belirli bir ticari motoru temsil etmez.
 */
export const DEFAULT_DESIGN: EngineDesign = {
  name: 'TF-330 (jenerik yüksek baypas)',
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
};

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
}

export interface DesignPoint {
  stations: Stations;
  thrust: number;
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

  // LP türbin: fan + booster gücünü karşılar
  const lpPower =
    W13 * AIR.cp * (T13 - T2) + W25 * AIR.cp * (T21 - T2) + W25 * AIR.cp * (T25 - T21);
  const T5 = T45 - lpPower / d.eff.mech / (W4 * GAS.cp);
  const PRlpt = expansionPR(T45, T5, d.eff.lpt);
  if (!Number.isFinite(PRlpt)) throw new DesignError('LP türbini fanı çeviremiyor.');
  const P5 = P45 / PRlpt;
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

  const thrust = F9 + F19 - W2 * amb.V0;

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
    '9': { T: core.staticT, P: core.staticP, W: W4 },
  };

  return {
    design,
    ref,
    point: { stations, thrust, wf: Wf, tsfc: Wf / thrust, opr: P3 / P2 },
  };
}
