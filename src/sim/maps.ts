/**
 * Bileşen karakteristikleri (haritalar).
 *
 * Fan ve booster sabit lüle alanlı bir motorda neredeyse tek bir çalışma
 * hattı üzerinde koşar; bu yüzden düzeltilmiş hızın fonksiyonu olarak
 * modellenir. HP kompresör ise tam bir harita olarak modellenir: her
 * düzeltilmiş hızda bir "hız hattı" vardır ve çalışma noktası o hat
 * üzerinde β (0 = surge hattı, 1 = boğulma) ile konumlanır. Çalışma
 * noktasını türbinin akış kapasitesi belirler — yakıt artınca T4 yükselir,
 * türbin daha az düzeltilmiş akış geçirir ve nokta surge hattına yaklaşır.
 * Kompresör stall'unun fiziksel kaynağı budur.
 */

import type { CompressorMapShape } from './design';

export interface MapPoint {
  /** Düzeltilmiş akış / tasarım düzeltilmiş akışı */
  flow: number;
  pr: number;
  /** Tasarım verimine çarpan (0..1) */
  etaFactor: number;
  /** Aynı hızda surge hattındaki basınç oranı */
  prSurge: number;
  /**
   * Surge payı, standart tanım: aynı düzeltilmiş akışta surge hattının basınç
   * oranı / çalışma basınç oranı − 1.
   */
  surgeMargin: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Hız hattı ölçekleme üsleri (kalibrasyon için dışa açık). */
export const MAP_EXP = { flowSurge: 2.6, flowChoke: 2.2, pr: 3.2 };

export function compressorMap(
  shape: CompressorMapShape,
  prDesign: number,
  speed: number,
  beta: number,
): MapPoint {
  const n = Math.max(speed, 0);
  const b = clamp(beta, 0, 1);
  const { surgePRFactor: sp, chokePRFactor: cp, surgeFlowFactor: sf, chokeFlowFactor: cf } = shape;
  const bd = shape.betaDesign;

  // Üsler, tasarım hızında β = βd noktası tam tasarım noktasına düşecek
  // şekilde seçilir. Akış β ile iç bükey (surge yakınında hızlı değişir,
  // boğulmaya doğru doyar); basınç oranı dış bükey (surge yakınında düz,
  // boğulmaya doğru hızla düşer) — gerçek hız hatlarının karakteri.
  const pFlow = Math.log((1 - sf) / (cf - sf)) / Math.log(bd);
  const pPR = Math.log((sp - 1) / (sp - cp)) / Math.log(bd);

  // Çok kademeli yüksek basınç oranlı kompresörlerde düşük hızda akış ve
  // basınç oranı hızla düşer (arka kademeler boğulur, ön kademeler stall'a
  // yaklaşır); üsler bu davranışı yansıtır.
  const flowSurge = sf * Math.pow(n, MAP_EXP.flowSurge);
  const flowChoke = cf * Math.pow(n, MAP_EXP.flowChoke);
  const prSurge = 1 + (sp * prDesign - 1) * Math.pow(n, MAP_EXP.pr);
  const prChoke = Math.max(1, 1 + (cp * prDesign - 1) * Math.pow(n, MAP_EXP.pr));

  const flow = flowSurge + (flowChoke - flowSurge) * Math.pow(b, pFlow);
  const pr = prSurge + (prChoke - prSurge) * Math.pow(b, pPR);
  const etaFactor = clamp((1 - 0.3 * (n - 1) ** 2) * (1 - 0.8 * (b - bd) ** 2), 0.3, 1);

  // Surge hattı hız ile parametrelidir: akış = sf·N^a, PR = 1 + (sp·PRd − 1)·N^b.
  // Aynı akıştaki surge hızını bulup o noktadaki PR ile karşılaştırılır.
  const nAtFlow = Math.pow(Math.max(flow, 0) / sf, 1 / MAP_EXP.flowSurge);
  const prSurgeAtFlow = 1 + (sp * prDesign - 1) * Math.pow(nAtFlow, MAP_EXP.pr);
  const surgeMargin = prSurgeAtFlow / pr - 1;

  return { flow, pr, etaFactor, prSurge, surgeMargin };
}

/** Fan/booster çalışma hattı: basınç artışı çevresel hızın karesiyle ölçeklenir. */
export function workingLinePR(prDesign: number, speed: number): number {
  const n = Math.max(speed, 0);
  return 1 + (prDesign - 1) * n * n;
}

export function workingLineFlow(speed: number): number {
  return Math.pow(Math.max(speed, 0), 1.1);
}

export function workingLineEta(etaDesign: number, speed: number): number {
  return clamp(etaDesign * (1 - 0.25 * (speed - 1) ** 2), 0.3, 0.97);
}
