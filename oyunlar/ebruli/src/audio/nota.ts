/**
 * Ses dili (GDD §10.3, K18): gündelik sesler Re (D) üzerinde konsonans;
 * hicazın artık ikilisi (E♭–F♯) yalnız kaskat merdiveninde ve kazanma ney
 * motifinde duyulur.
 */
import type { Renk } from '../core/types';

/** Re hicaz dizisi (D4 E♭4 F♯4 G4 A4 B♭4 C5 D5), Hz. */
export const HICAZ: readonly number[] = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];

/** Renk notaları (konsonans): Kırmızı D4, Sarı F♯4, Mavi A4, Turuncu G4, Mor B♭4, Yeşil C5, Mürekkep D3. */
export const RENK_NOTASI: Readonly<Record<number, number>> = {
  0: 587.33,
  1: 293.66,
  2: 369.99,
  4: 440.0,
  3: 392.0,
  5: 466.16,
  6: 523.25,
  7: 146.83,
};

export function renkNotasi(kod: Renk | 0 | number | null | undefined): number {
  return RENK_NOTASI[kod ?? 0] ?? 440;
}

/** k. kaskat → hicaz basamağı min(k−1, 7). */
export function kaskatBasamagi(k: number): number {
  return Math.max(0, Math.min(7, k - 1));
}

/** 8+ kaskatta D5'te kalır, üstüne oktav parıltısı. */
export function kaskatParilti(k: number): boolean {
  return k >= 9;
}

/** Müzik cümleleri: D pentatonik (D F G A C), iki oktav (D3–C5). */
export const PENTATONIK: readonly number[] = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25];

/**
 * Ud tamponları (Karplus–Strong, §10.3): 8 nota × 2 oktav. Renk notaları,
 * hicaz merdiveni ve müzik buradan çalar; yakın nota en yakın tampondan
 * `playbackRate` ile türetilir.
 */
export const UD_NOTALARI: readonly number[] = [...HICAZ.map((f) => f / 2), ...HICAZ];

/** Frekansa en yakın ud tamponunun dizini ve oran. */
export function enYakinUd(f: number): { i: number; oran: number } {
  let en = 0;
  let enFark = Infinity;
  for (let i = 0; i < UD_NOTALARI.length; i++) {
    const d = Math.abs(Math.log2(f / UD_NOTALARI[i]));
    if (d < enFark) {
      enFark = d;
      en = i;
    }
  }
  return { i: en, oran: f / UD_NOTALARI[en] };
}
