/**
 * Gaz özellikleri ve izentropik ilişkiler.
 *
 * Soğuk bölüm (fan, kompresörler) için hava, sıcak bölüm (yanma odası
 * sonrası) için yanma ürünleri özellikleri kullanılır. Değişken cp yerine
 * bölüm başına sabit cp/γ alınır — ders kitaplarındaki "iki gazlı" yaklaşım
 * (Mattingly, Saravanamuttoo). Tasarım noktası hesabında hata %1-2 seviyesinde.
 */

export interface GasProps {
  /** Sabit basınçta özgül ısı [J/(kg·K)] */
  cp: number;
  /** Özgül ısılar oranı */
  gamma: number;
  /** Gaz sabiti [J/(kg·K)] */
  R: number;
}

export const AIR: GasProps = { cp: 1004.5, gamma: 1.4, R: 287.05 };
export const GAS: GasProps = { cp: 1148, gamma: 1.333, R: 286.9 };

/** Jet yakıtı (Jet A-1) alt ısıl değeri [J/kg] */
export const LHV = 43.1e6;
/** Stokiyometrik yakıt/hava oranı (Jet A-1) */
export const FAR_STOICH = 0.068;

export const T_STD = 288.15;
export const P_STD = 101325;

const k = (g: GasProps) => (g.gamma - 1) / g.gamma;

/** Sıkıştırma sonrası gerçek toplam sıcaklık. PR ≥ 1, eta izentropik verim. */
export function compressT(tIn: number, pr: number, eta: number, g: GasProps = AIR): number {
  const p = Math.max(pr, 1);
  return tIn * (1 + (Math.pow(p, k(g)) - 1) / Math.max(eta, 0.05));
}

/** Genişleme sonrası gerçek toplam sıcaklık. pr = Pgiriş/Pçıkış ≥ 1. */
export function expandT(tIn: number, pr: number, eta: number, g: GasProps = GAS): number {
  const p = Math.max(pr, 1);
  return tIn * (1 - eta * (1 - Math.pow(p, -k(g))));
}

/** Verilen gerçek sıcaklık düşüşünü sağlayan türbin basınç oranı. */
export function expansionPR(tIn: number, tOut: number, eta: number, g: GasProps = GAS): number {
  const ideal = 1 - (1 - tOut / tIn) / eta;
  if (ideal <= 0) return Infinity;
  return Math.pow(ideal, -1 / k(g));
}

/** Kritik (boğulma) basınç oranı Pt/Pstatik. Hava için ≈1.893. */
export function criticalPR(g: GasProps): number {
  return Math.pow((g.gamma + 1) / 2, g.gamma / (g.gamma - 1));
}

/**
 * Bir lüleden ya da türbin statoru boğazından geçebilecek boyutsuz akışın,
 * boğulmuş duruma oranı (0..1). pr = Pt / Parka.
 */
export function flowFunctionRatio(pr: number, g: GasProps): number {
  const crit = criticalPR(g);
  if (pr >= crit) return 1;
  if (pr <= 1) return 0;
  const f = (x: number) =>
    Math.sqrt(Math.max(0, Math.pow(x, -2 / g.gamma) - Math.pow(x, -(g.gamma + 1) / g.gamma)));
  return f(pr) / f(crit);
}

export interface NozzleExit {
  /** Çıkış hızı [m/s] (hız katsayısı uygulanmamış) */
  velocity: number;
  /** Birim alandan geçen kütle akısı [kg/(s·m²)] */
  massFlux: number;
  /** Birim kütle akışı başına basınç itkisi [N/(kg/s)] */
  pressureThrustPerFlow: number;
  /** Çıkış statik sıcaklığı [K] */
  staticT: number;
  /** Çıkış statik basıncı [Pa] */
  staticP: number;
  mach: number;
  choked: boolean;
}

/** Yakınsak lüle çıkış koşulları (izentropik, tam genleşme ya da boğulma). */
export function convergentNozzle(pt: number, tt: number, pAmb: number, g: GasProps): NozzleExit {
  const pr = Math.max(pt / pAmb, 1);
  const crit = criticalPR(g);
  const gm1 = g.gamma - 1;

  let mach: number;
  let staticP: number;
  if (pr >= crit) {
    mach = 1;
    staticP = pt / crit;
  } else {
    mach = Math.sqrt((2 / gm1) * (Math.pow(pr, gm1 / g.gamma) - 1));
    staticP = pAmb;
  }
  const staticT = tt / (1 + (gm1 / 2) * mach * mach);
  const velocity = mach * Math.sqrt(g.gamma * g.R * staticT);
  const rho = staticP / (g.R * staticT);
  const massFlux = rho * velocity;
  const pressureThrustPerFlow = massFlux > 1e-9 ? (staticP - pAmb) / massFlux : 0;

  return { velocity, massFlux, pressureThrustPerFlow, staticT, staticP, mach, choked: pr >= crit };
}

/**
 * Yanma odası enerji dengesi: çıkış sıcaklığı.
 * W3·cp_hava·T3 + ηb·Wf·LHV = (W3 + Wf)·cp_gaz·T4
 * Stokiyometrik sınırın üstündeki yakıt yanmaz (zengin sınır).
 */
export function combustorExitT(w3: number, t3: number, wf: number, etaB: number): number {
  if (w3 <= 1e-9) return t3;
  const burned = Math.min(wf, FAR_STOICH * w3);
  return (w3 * AIR.cp * t3 + etaB * burned * LHV) / ((w3 + burned) * GAS.cp);
}

/** Hedef T4 için gereken yakıt akışı (tasarım noktası boyutlandırması). */
export function fuelForT4(w3: number, t3: number, t4: number, etaB: number): number {
  return (w3 * (GAS.cp * t4 - AIR.cp * t3)) / (etaB * LHV - GAS.cp * t4);
}
