/**
 * Uluslararası Standart Atmosfer (ISA) ve ram (dinamik basınç) etkisi.
 * 0–20 km aralığı: troposfer (sıcaklık gradyanı −6.5 K/km) ve alt stratosfer
 * (11 km üstünde izotermal 216.65 K).
 */

import { AIR, P_STD, T_STD } from './gas';

export interface Ambient {
  altitude: number; // m
  mach: number;
  isaDev: number; // K
  /** Statik sıcaklık [K] */
  T0: number;
  /** Statik basınç [Pa] */
  P0: number;
  rho0: number;
  /** Ses hızı [m/s] */
  a0: number;
  /** Uçuş hızı [m/s] */
  V0: number;
  /** Fan yüzü toplam sıcaklık [K] */
  T2: number;
  /** Fan yüzü toplam basınç [Pa] (giriş kaybı dahil) */
  P2: number;
}

export function isaStatic(altitude: number): { T: number; P: number } {
  const h = Math.max(0, Math.min(altitude, 20000));
  if (h <= 11000) {
    const T = T_STD - 0.0065 * h;
    return { T, P: P_STD * Math.pow(T / T_STD, 5.25588) };
  }
  const P11 = 22632.06;
  return { T: 216.65, P: P11 * Math.exp(-(h - 11000) / 6341.62) };
}

export function ambient(altitude = 0, mach = 0, isaDev = 0, inletRecovery = 0.995): Ambient {
  const { T, P } = isaStatic(altitude);
  const T0 = T + isaDev;
  const P0 = P;
  const a0 = Math.sqrt(AIR.gamma * AIR.R * T0);
  const V0 = mach * a0;
  const ram = 1 + ((AIR.gamma - 1) / 2) * mach * mach;
  const T2 = T0 * ram;
  const P2 = P0 * Math.pow(ram, AIR.gamma / (AIR.gamma - 1)) * inletRecovery;
  return {
    altitude,
    mach,
    isaDev,
    T0,
    P0,
    rho0: P0 / (AIR.R * T0),
    a0,
    V0,
    T2,
    P2,
  };
}
