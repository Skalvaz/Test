/**
 * Renk yardımcıları (GDD §11.1): katalogdaki onaltılık renklerden çizim
 * renkleri, karışım ve alfa dizeleri. Çizici, tablo ve efektler paylaşır.
 */
import { PALET, RENK_TANIMLARI } from '../app/katalog';
import type { Renk } from '../core/types';
import type { Palet } from '../app/sozlesme';

export type Rgb = [number, number, number];

export function hexRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbHex(c: Rgb): string {
  const s = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${s(c[0])}${s(c[1])}${s(c[2])}`;
}

export function rgba(c: Rgb | string, a: number): string {
  const r = typeof c === 'string' ? hexRgb(c) : c;
  return `rgba(${Math.round(r[0])},${Math.round(r[1])},${Math.round(r[2])},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** İki rengin doğrusal karışımı (t = 0 → a, 1 → b). */
export function karistir(a: Rgb | string, b: Rgb | string, t: number): Rgb {
  const x = typeof a === 'string' ? hexRgb(a) : a;
  const y = typeof b === 'string' ? hexRgb(b) : b;
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

/** Lale (renk 0) için krem yanardöner taban. */
const LALE_UCLU: readonly [string, string, string] = ['#EADFC8', '#FFF8EA', '#A08C6C'];

/** Renk kodunun [ana, açık, koyu] üçlüsü (0 = Lale kremi). */
export function renkUclu(kod: Renk | 0, palet: Palet = 'standart'): readonly [string, string, string] {
  if (kod === 0) return LALE_UCLU;
  const t = RENK_TANIMLARI[kod];
  return palet === 'renkKoru' ? t.renkKoru : t.standart;
}

export const renkAna = (kod: Renk | 0, palet: Palet = 'standart'): string => renkUclu(kod, palet)[0];

/**
 * Parçacık/efekt renk dizini (sprite önbelleği dizini). 0–7 renk kodları
 * (0 = krem); sonrakiler sabit efekt renkleri.
 */
export const ER = {
  KREM: 0,
  ALTIN: 8,
  IS: 9,
  BEYAZ: 10,
  YANAR: 11,
  ALTIN_ACIK: 12,
  MERMER: 13,
} as const;
export const EFEKT_RENK_SAYISI = 14;

/** Efekt renk dizininin rengi. */
export function efektRengi(i: number, palet: Palet = 'standart'): string {
  if (i >= 1 && i <= 7) return renkAna(i as Renk, palet);
  switch (i) {
    case ER.ALTIN:
      return PALET.altin;
    case ER.IS:
      return '#2A231C';
    case ER.BEYAZ:
      return '#FFFFFF';
    case ER.YANAR:
      return '#9FE6D8';
    case ER.ALTIN_ACIK:
      return PALET.altinAcik;
    case ER.MERMER:
      return PALET.mermer[0];
    default:
      return PALET.kagit;
  }
}
