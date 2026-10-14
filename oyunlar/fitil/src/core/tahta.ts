/** Izgara yardımcıları (saf). */
import type { Hucre, Icerik, Konum, OyunDurumu, Renk } from './types';

export const DIK: readonly Konum[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
export const SEKIZ: readonly Konum[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export function icinde(d: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < d.w && y < d.h;
}

export function idx(d: { w: number }, x: number, y: number): number {
  return y * d.w + x;
}

export function konum(d: { w: number }, i: number): Konum {
  return { x: i % d.w, y: Math.floor(i / d.w) };
}

export function hucre(d: OyunDurumu, x: number, y: number): Hucre | null {
  if (!icinde(d, x, y)) return null;
  const h = d.hucreler[idx(d, x, y)];
  return h.delik ? null : h;
}

export function bosHucre(): Hucre {
  return { delik: false, icerik: null, kafes: false, doseme: 0, desenRengi: -1, desenBoyali: false, izIndeksi: -1, isikIzi: false };
}

export function kapsul(renk: Renk | -1, isi = 0): Icerik {
  return { tur: 'kapsul', renk, isi, ozel: renk === -1 ? 'yildiz' : 'yok', eksen: 0 };
}

/** Zincire katılabilir mi (§3.2): kafessiz kapsül, renk eşit ya da joker. renk −1: renk bağımsız. */
export function zincirlenebilir(d: OyunDurumu, x: number, y: number, renk: number): boolean {
  const h = hucre(d, x, y);
  if (!h || h.kafes || !h.icerik || h.icerik.tur !== 'kapsul') return false;
  if (h.icerik.renk === -1 || renk === -1) return true;
  return h.icerik.renk === renk;
}

/** Hareketli içerik mi (düşer): kafessiz kapsül, ıslak, fener. */
export function hareketliMi(h: Hucre): boolean {
  if (h.delik || !h.icerik) return false;
  const t = h.icerik.tur;
  if (t === 'kapsul') return !h.kafes;
  return t === 'islak' || t === 'fener';
}

/** Sabit yuva mı (yerçekimi atlar): kaya, kova, dev fişek, is, kafesli kapsül. */
export function sabitMi(h: Hucre): boolean {
  if (h.delik || !h.icerik) return false;
  const t = h.icerik.tur;
  if (t === 'kapsul') return h.kafes;
  return t === 'kaya' || t === 'kova' || t === 'devFisek' || t === 'is';
}

/** Derin kopya (yapısal; JSON güvenli tipler). */
export function durumKopyala(d: OyunDurumu): OyunDurumu {
  return structuredClone(d);
}
