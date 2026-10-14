/**
 * Müzikal fitil notaları (GDD §12.3, §11 kanca 1) — saf, testli.
 *
 * Pentatonik dizi (C majör pentatonik, C5 → C7). k. düğüm → indeks
 * min(k−1, 10). Isı dalgaları fitilin son notasından devam eder: w. dalga →
 * min(son + w, 10).
 */

/** §12.3 pentatonik dizi (Hz): C5 D5 E5 G5 A5 C6 D6 E6 G6 A6 C7. */
export const PENTATONIK: readonly number[] = [523.25, 587.33, 659.26, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];
export const SON_INDEKS = PENTATONIK.length - 1;

/** Düğüm sırası k (1 tabanlı) → dizi indeksi. */
export function notaIndeksi(k: number): number {
  return Math.max(0, Math.min(Math.floor(k) - 1, SON_INDEKS));
}

/** Düğüm sırası k'nın frekansı. */
export function dugumFrekansi(k: number): number {
  return PENTATONIK[notaIndeksi(k)];
}

/**
 * Parıltı katmanı: perde C7'de durduğunda bir oktav üstte, kazancı 0,15
 * olan ek katman. Yorum (görev metni "11+ düğümde"): k ≥ 11.
 */
export function pariltiVar(k: number): boolean {
  return k >= 11;
}
export const PARILTI_KAZANCI = 0.15;

/** Isı dalgası w (nesil, 1 tabanlı) → indeks min(son + w, 10). */
export function dalgaIndeksi(son: number, w: number): number {
  return Math.max(0, Math.min(son + Math.max(0, Math.floor(w)), SON_INDEKS));
}

/** İndeks sınırlı nota frekansı. */
export function nota(i: number): number {
  return PENTATONIK[Math.max(0, Math.min(Math.round(i), SON_INDEKS))];
}

/** MIDI numarasından frekans (A4 = 69 = 440 Hz). */
export function midiFrekans(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/**
 * Müzik pedi akorları (§12.3): I–vi–IV–V, her 8 sn'de bir. Sesler pentatonik
 * melodiyle çatışmasın diye V akoru sus2 (G–D–A) olarak dizildi (B yok).
 * MIDI: C3 = 48.
 */
export const PED_AKORLARI: readonly (readonly number[])[] = [
  [48, 55, 64], // I   C3 G3 E4
  [45, 52, 60], // vi  A2 E3 C4
  [41, 48, 57], // IV  F2 C3 A3
  [43, 50, 57], // V   G2 D3 A3 (sus2)
];
export const AKOR_SURESI = 8;

/** Akor sırasındaki melodi için uygun pentatonik indeksler (akor tonları önce). */
export const AKOR_MELODI: readonly (readonly number[])[] = [
  [0, 2, 3, 5, 7], // C E G
  [0, 2, 4, 5, 7], // A C E
  [0, 4, 5, 9], // F A C → C A
  [1, 3, 4, 6, 8], // G D A
];

/** Reaksiyon kademesi arpeji (§12.2 "kademeye göre yükselen arpej"). */
export const KADEME_ARPEJ: Record<'guzel' | 'harika' | 'muhtesem' | 'senlik', readonly number[]> = {
  guzel: [0, 2, 4],
  harika: [0, 2, 4, 5],
  muhtesem: [0, 2, 4, 5, 7],
  senlik: [0, 2, 4, 5, 7, 9, 10],
};

/** Kazandın arpeji (§12.2): C5-E5-G5-C6-E6 (pentatonik indeksler). */
export const KAZANC_ARPEJ: readonly number[] = [0, 2, 3, 5, 7];
