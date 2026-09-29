/**
 * Tasarım dışı (off-design) çevrim hesabı.
 *
 * Verilen mil devirleri (N1, N2), yakıt akışı ve dış koşullar için bütün
 * istasyonların sıcaklık/basınç/akış değerlerini, bileşen güçlerini ve itkiyi
 * hesaplar. Mil devirleri burada girdidir; devirleri değiştiren şey türbin ile
 * kompresör arasındaki güç farkıdır ve bu fark `engineSim` içinde zamanla
 * entegre edilir. Böylece model hem kararlı durumu hem de geçici rejimi
 * (spool-up, surge, flameout) aynı denklemlerle üretir.
 *
 * İki eşleşme problemi iç içe çözülür:
 *  1. HP tarafı: HPC hız hattı üzerindeki β konumu, HP türbin statorunun akış
 *     kapasitesini (W4·√T4/P4) sağlayacak şekilde bulunur.
 *  2. LP tarafı: LP türbin çıkış basıncı P5, çekirdek lülesinin W4 akışını
 *     geçireceği şekilde bulunur (lüle alanı tasarımda sabitlenmiştir).
 */

import type { Ambient } from './atmosphere';
import type { SizedEngine, Stations } from './design';
import { hptCapacityFactor } from './design';
import {
  AIR,
  GAS,
  FAR_STOICH,
  P_STD,
  T_STD,
  LHV,
  combustorExitT,
  compressT,
  convergentNozzle,
  expandT,
  idealJet,
  mixStreams,
} from './gas';
import { compressorMap, workingLineEta, workingLineFlow, workingLinePR } from './maps';

/** Bileşen sağlığı: 1 = yeni motor. Arıza ve yıpranma senaryoları bunları düşürür. */
export interface Health {
  fanEta: number;
  fanFlow: number;
  hpcEta: number;
  /** HPC surge payı çarpanı (1 = nominal, 0.5 = surge hattı yarı yolda) */
  hpcSurgeMargin: number;
  hptEta: number;
  lptEta: number;
}

export const HEALTHY: Readonly<Health> = Object.freeze({
  fanEta: 1,
  fanFlow: 1,
  hpcEta: 1,
  hpcSurgeMargin: 1,
  hptEta: 1,
  lptEta: 1,
});

export interface CycleInput {
  eng: SizedEngine;
  amb: Ambient;
  /** Mekanik devir, tasarımın oranı (1 = %100) */
  N1: number;
  N2: number;
  /** Yanma odasına giren yakıt [kg/s] */
  wf: number;
  lit: boolean;
  surging: boolean;
  health?: Health;
  /** Art yakıcıya giden yakıt [kg/s] (yalnız art yakıcılı motorlar) */
  wfAb?: number;
}

export interface CycleResult {
  stations: Stations;
  N1c: number;
  N2c: number;
  /** HPC hız hattı konumu (0 = surge, 1 = boğulma) */
  beta: number;
  hpcPR: number;
  hpcSurgePR: number;
  /** Surge payı: aynı düzeltilmiş akışta PR_surge / PR − 1 */
  surgeMargin: number;
  /** Eşleşme surge hattının ötesinde bir nokta gerektiriyor */
  surgeRequired: boolean;
  far: number;
  wfBurned: number;
  fanPower: number;
  boosterPower: number;
  hpcPower: number;
  hptPower: number;
  lptPower: number;
  coreThrust: number;
  bypassThrust: number;
  ramDrag: number;
  netThrust: number;
  bypassRatio: number;
  opr: number;
  V9: number;
  V19: number;
  coreNozzleChoked: boolean;
  bypassNozzleChoked: boolean;
  /** Art yakıcıda yanan yakıt [kg/s] ve tam yanığa oranı (0..1) */
  wfAbBurned: number;
  abFraction: number;
  /** Lüle boğaz alanı / kuru tasarım alanı (art yakıcıda lüle açılır) */
  nozzleArea: number;
  /** Jet çıkış Mach sayısı ve lüle basınç oranı (şok elmasları için) */
  jetMach: number;
  nozzlePR: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function bisect(f: (x: number) => number, lo: number, hi: number, iters = 42): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  for (let i = 0; i < iters; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (fm === 0) return m;
    if (fa * fm < 0) {
      b = m;
    } else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}

/** Eşleşme bu devrin altında kararsızlaşır; alt-rölanti bölgesinde sabit β kullanılır. */
const MATCH_MIN_N2C = 0.12;
const MATCH_BLEND_N2C = 0.2;

interface FrontEnd {
  T2: number;
  P2: number;
  N1c: number;
  fanPR: number;
  etaFan: number;
  W2demand: number;
  T13: number;
  P13: number;
  T21: number;
  P21: number;
  T25: number;
  P25: number;
}

/** Fan ve booster: N1 ile belirlenen ön bölüm. */
function frontEnd(eng: SizedEngine, amb: Ambient, N1: number, h: Health): FrontEnd {
  const d = eng.design;
  const r = eng.ref;
  const T2 = amb.T2;
  const P2 = amb.P2;
  const N1c = N1 / Math.sqrt(T2 / r.T2);
  const fanPR = workingLinePR(d.fanPR, N1c);
  const etaFan = workingLineEta(d.eff.fan, N1c) * h.fanEta;
  const W2demand =
    (r.W2c * workingLineFlow(N1c) * h.fanFlow * (P2 / P_STD)) / Math.sqrt(T2 / T_STD);
  const T13 = compressT(T2, fanPR, etaFan);
  const P13 = P2 * fanPR;
  const prHub = 1 + (fanPR - 1) * d.fanHubPRFraction;
  const T21 = compressT(T2, prHub, etaFan);
  const P21 = P2 * prHub;
  const boosterPR = workingLinePR(d.boosterPR, N1c);
  const etaBooster = workingLineEta(d.eff.booster, N1c);
  const T25 = compressT(T21, boosterPR, etaBooster);
  const P25 = P21 * boosterPR;
  return { T2, P2, N1c, fanPR, etaFan, W2demand, T13, P13, T21, P21, T25, P25 };
}

interface HpContext {
  eng: SizedEngine;
  amb: Ambient;
  fe: FrontEnd;
  N2c: number;
  wf: number;
  lit: boolean;
  surging: boolean;
  h: Health;
}

/** HPC hız hattında verilen β için HPC + yanma odası + HPT kapasite artığı. */
function evalHp(ctx: HpContext, beta: number) {
  const { eng, amb, fe, h } = ctx;
  const d = eng.design;
  const r = eng.ref;
  const shape =
    h.hpcSurgeMargin === 1
      ? d.hpcMap
      : { ...d.hpcMap, surgePRFactor: 1 + (d.hpcMap.surgePRFactor - 1) * h.hpcSurgeMargin };
  const etaB = ctx.surging ? d.eff.combustor * 0.8 : d.eff.combustor;
  const surgeFlowFactor = ctx.surging ? 0.42 : 1;
  const surgeEtaFactor = ctx.surging ? 0.65 : 1;

  const mp = compressorMap(shape, d.hpcPR, ctx.N2c, beta);
  const W25 =
    (r.W25c * mp.flow * surgeFlowFactor * (fe.P25 / P_STD)) / Math.sqrt(fe.T25 / T_STD);
  const eta = clamp(d.eff.hpc * h.hpcEta * mp.etaFactor * surgeEtaFactor, 0.2, 0.95);
  const T3 = compressT(fe.T25, mp.pr, eta);
  const P3 = fe.P25 * mp.pr;
  const wfBurned = ctx.lit ? Math.min(ctx.wf, FAR_STOICH * W25) : 0;
  const T4 = ctx.lit ? combustorExitT(W25, T3, ctx.wf, etaB) : T3;
  const W4 = W25 + wfBurned;
  // Yanma odası basınç kaybı düzeltilmiş akışın karesiyle ölçeklenir
  const flowParam = P3 > 0 ? (W25 * Math.sqrt(T3)) / P3 : 0;
  const dp = d.combustorDP * Math.min(2, (flowParam / r.combustorFlowParam) ** 2);
  const P4 = P3 * (1 - dp);
  const capacity = r.FC4 * hptCapacityFactor(P4 / amb.P0);
  const residual = P4 > 0 ? (W4 * Math.sqrt(T4)) / P4 - capacity : 1;
  return { mp, W25, eta, T3, P3, T4, W4, P4, wfBurned, residual, surgeEtaFactor };
}

/**
 * Verilen devirlerde HPC'yi tam surge hattına getiren yakıt akışı [kg/s].
 * FADEC'in ivmelenme sınırı bunun bir oranıdır (model tabanlı surge koruması).
 * Nominal (sağlıklı) harita ile hesaplanır: yıpranmış bir motorda gerçek surge
 * hattı daha aşağıdadır ve FADEC bunu bilemez — gerçekte de böyledir.
 */
export function surgeFuelFlow(eng: SizedEngine, amb: Ambient, N1: number, N2: number): number {
  const fe = frontEnd(eng, amb, Math.max(0, N1), HEALTHY);
  const N2c = Math.max(0, N2) / Math.sqrt(fe.T25 / eng.ref.T25);
  if (N2c < MATCH_BLEND_N2C) return Infinity;
  const ctx: HpContext = { eng, amb, fe, N2c, wf: 0, lit: true, surging: false, h: HEALTHY };
  const res = (wf: number) => {
    ctx.wf = wf;
    return evalHp(ctx, 0).residual;
  };
  const w25 = evalHp(ctx, 0).W25;
  const hi = FAR_STOICH * w25;
  if (res(hi) < 0) return hi;
  if (res(0) > 0) return 0;
  return bisect(res, 0, hi, 32);
}

export function computeCycle(input: CycleInput): CycleResult {
  const { eng, amb } = input;
  const d = eng.design;
  const r = eng.ref;
  const h = input.health ?? HEALTHY;
  const N1 = Math.max(0, input.N1);
  const N2 = Math.max(0, input.N2);

  const fe = frontEnd(eng, amb, N1, h);
  const { T2, P2, N1c, W2demand, T13, P13, T21, P21, T25, P25 } = fe;
  const N2c = N2 / Math.sqrt(T25 / r.T25);
  const ctx: HpContext = {
    eng,
    amb,
    fe,
    N2c,
    wf: input.wf,
    lit: input.lit,
    surging: input.surging,
    h,
  };

  let beta: number;
  let surgeRequired = false;
  if (input.surging) {
    beta = 0;
  } else if (N2c < MATCH_MIN_N2C) {
    beta = d.hpcMap.betaDesign;
  } else {
    const r0 = evalHp(ctx, 0).residual;
    const r1 = evalHp(ctx, 1).residual;
    let matched: number;
    if (r0 > 0) {
      matched = 0;
      surgeRequired = true;
    } else if (r1 < 0) {
      matched = 1;
    } else {
      matched = bisect((b) => evalHp(ctx, b).residual, 0, 1);
    }
    // Alt-rölantiden eşleşmeli bölgeye yumuşak geçiş
    const w = clamp((N2c - MATCH_MIN_N2C) / (MATCH_BLEND_N2C - MATCH_MIN_N2C), 0, 1);
    beta = d.hpcMap.betaDesign * (1 - w) + matched * w;
    if (w < 1) surgeRequired = false;
  }

  const hp = evalHp(ctx, beta);
  const { W25, T3, P3, T4, W4, P4, wfBurned } = hp;

  /* ---------------- HP türbin ---------------- */
  // HP ve LP türbin statorları boğulmuşken HPT basınç oranı sabittir; düşük
  // güçte toplam genişleme oranı yetmediğinde küçülür.
  const p4p0 = Math.max(P4 / amb.P0, 1);
  const PRhpt = clamp(Math.min(r.PRhpt, Math.pow(p4p0, 0.95)), 1, r.PRhpt);
  const hptSpeed = N2 / Math.sqrt(Math.max(T4, 200) / r.T4);
  const etaHpt =
    clamp(d.eff.hpt * h.hptEta * (1 - 0.25 * (hptSpeed - 1) ** 2), 0.3, 0.95) *
    hp.surgeEtaFactor;
  const T45 = expandT(T4, PRhpt, etaHpt);
  const P45 = P4 / PRhpt;
  const hptPower = W4 * GAS.cp * (T4 - T45);

  /* ---------------- LP türbin + çekirdek lülesi (P5 eşleşmesi) ---------------- */
  const lptSpeed = N1 / Math.sqrt(Math.max(T45, 200) / r.T45);
  const etaLpt = clamp(d.eff.lpt * h.lptEta * (1 - 0.2 * (lptSpeed - 1) ** 2), 0.3, 0.95);
  const P0 = amb.P0;

  let P5: number;
  if (P45 <= P0 * 1.0001 || W4 < 1e-6) {
    P5 = Math.max(P45, P0);
  } else {
    const massErr = (p5: number) => {
      const t5 = expandT(T45, P45 / p5, etaLpt);
      return convergentNozzle(p5, t5, P0, GAS).massFlux * r.A9 - W4;
    };
    P5 = massErr(P45) < 0 ? P45 : bisect(massErr, P0, P45, 40);
  }
  const T5 = expandT(T45, P45 / P5, etaLpt);
  const lptPower = W4 * GAS.cp * (T45 - T5);

  const coreNoz = convergentNozzle(P5, T5, P0, GAS);
  const coreThrust = W4 * (coreNoz.velocity * d.nozzleCv + coreNoz.pressureThrustPerFlow);

  /* ---------------- baypas ---------------- */
  // Baypassız motorda (turbojet, turboprop) giriş akışını çekirdek belirler
  const W2 = d.bypassRatio > 0 ? Math.max(W2demand, W25) : W25;
  const W13 = W2 - W25;
  const P19t = P13 * (1 - d.bypassDuctDP);
  const bypNoz = convergentNozzle(P19t, T13, P0, AIR);
  const bypassThrust = W13 * (bypNoz.velocity * d.nozzleCv + bypNoz.pressureThrustPerFlow);

  const ramDrag = W2 * amb.V0;
  let netThrust = coreThrust + bypassThrust - ramDrag;
  let st7 = { T: T5, P: P5, W: W4 };
  let exit = { T: coreNoz.staticT, P: coreNoz.staticP };
  let mixedThrust = coreThrust;
  let mixedBypass = bypassThrust;
  let V9 = coreNoz.velocity * d.nozzleCv;
  let jetMach = coreNoz.mach;
  let nozzlePR = P5 / P0;
  let wfAbBurned = 0;
  let abFraction = 0;
  let nozzleArea = 1;

  /* ---------------- karıştırıcı + art yakıcı + değişken lüle ---------------- */
  if (d.afterburner) {
    const ab = d.afterburner;
    const mix = mixStreams(W4, T5, P5, W13, T13, P19t, ab.mixerLoss);
    const oxyLeft = Math.max(0, FAR_STOICH * W2 - wfBurned);
    wfAbBurned = input.lit ? Math.min(Math.max(0, input.wfAb ?? 0), oxyLeft) : 0;
    abFraction = r.wfAbMax > 0 ? wfAbBurned / r.wfAbMax : 0;
    // Tamamen duran motorda akış sıfırdır: karışım sıcaklığı tanımsız kalmasın
    const T7 =
      mix.W + wfAbBurned > 1e-9
        ? (mix.W * GAS.cp * mix.T + ab.eta * wfAbBurned * LHV) / ((mix.W + wfAbBurned) * GAS.cp)
        : mix.T;
    const dp = ab.dpDry + (ab.dpLit - ab.dpDry) * Math.min(1, abFraction);
    const P7 = mix.P * (1 - dp);
    const W7 = mix.W + wfAbBurned;
    const jet = idealJet(P7, T7, P0);
    mixedThrust = P7 > P0 ? W7 * jet.velocity * d.nozzleCv : 0;
    mixedBypass = 0;
    netThrust = mixedThrust - ramDrag;
    V9 = jet.velocity * d.nozzleCv;
    jetMach = jet.mach;
    nozzlePR = P7 / P0;
    nozzleArea = P7 > P0 * 1.01 ? Math.min(3, W7 / jet.throatFlux / r.A8dry) : 1;
    st7 = { T: T7, P: P7, W: W7 };
    exit = { T: jet.staticT, P: P0 };
  }

  /* ---------------- güçler ---------------- */
  const fanPower = W13 * AIR.cp * (T13 - T2) + W25 * AIR.cp * (T21 - T2);
  const boosterPower = W25 * AIR.cp * (T25 - T21);
  const hpcPower = W25 * AIR.cp * (T3 - T25);

  const stations: Stations = {
    '0': { T: amb.T0, P: P0, W: W2 },
    '2': { T: T2, P: P2, W: W2 },
    '13': { T: T13, P: P13, W: W13 },
    '19': { T: bypNoz.staticT, P: bypNoz.staticP, W: W13 },
    '21': { T: T21, P: P21, W: W25 },
    '25': { T: T25, P: P25, W: W25 },
    '3': { T: T3, P: P3, W: W25 },
    '4': { T: T4, P: P4, W: W4 },
    '45': { T: T45, P: P45, W: W4 },
    '5': { T: T5, P: P5, W: W4 },
    '7': st7,
    '9': { T: exit.T, P: exit.P, W: st7.W },
  };

  return {
    stations,
    N1c,
    N2c,
    beta,
    hpcPR: hp.mp.pr,
    hpcSurgePR: hp.mp.prSurge,
    surgeMargin: hp.mp.surgeMargin,
    surgeRequired,
    far: W25 > 1e-6 ? wfBurned / W25 : 0,
    wfBurned,
    fanPower,
    boosterPower,
    hpcPower,
    hptPower,
    lptPower,
    coreThrust: mixedThrust,
    bypassThrust: mixedBypass,
    ramDrag,
    netThrust,
    bypassRatio: W25 > 1e-6 ? W13 / W25 : 0,
    opr: P3 / P2,
    V9,
    V19: bypNoz.velocity * d.nozzleCv,
    coreNozzleChoked: coreNoz.choked,
    bypassNozzleChoked: bypNoz.choked,
    wfAbBurned,
    abFraction,
    nozzleArea,
    jetMach,
    nozzlePR,
  };
}
