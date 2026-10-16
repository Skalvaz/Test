/**
 * HUD puan çubuğu geometrisi (GDD §11.6): 1★/2★/3★ işaretlerinin konumu ve
 * dolgunun puana göre oranı. Saf (DOM yok, testli).
 *
 * Eşikler birbirine yakınsa doğrusal ölçekte iki yıldız 110 px'lik çubukta
 * üst üste biner. Çubuk parçalı doğrusaldır: işaretler arasında en az
 * `EN_AZ_ARALIK` (çubuğun %22'si ≈ 24 px) kalır ve dolgu aynı eşlemeyle
 * ilerler; dolgu her zaman tam eşikte işarete ulaşır.
 */
export const EN_AZ_ARALIK = 0.22;
/** 1★ işareti (hedefler tamam) çubuğun başında sabit. */
export const BIR_YILDIZ = 0.08;

function tavanHesapla(e2: number, e3: number): number {
  return Math.max(1, e3 * 1.12, e2 * 1.5);
}

/** [1★, 2★, 3★] işaretlerinin çubuktaki oranı (0..1), artan ve aralıklı. */
export function yildizKonumlari(esikler: readonly number[]): [number, number, number] {
  const e2 = Math.max(0, esikler[0] ?? 0);
  const e3 = Math.max(e2, esikler[1] ?? 0);
  const tavan = tavanHesapla(e2, e3);
  let k2 = Math.max(BIR_YILDIZ + EN_AZ_ARALIK, e2 / tavan);
  let k3 = e3 / tavan;
  k2 = Math.min(k2, 1 - 0.06 - EN_AZ_ARALIK);
  k3 = Math.max(k3, k2 + EN_AZ_ARALIK);
  k3 = Math.min(k3, 0.94);
  return [BIR_YILDIZ, k2, k3];
}

/** Puanın dolgu oranı: [0, e2] → [0, k2], [e2, e3] → [k2, k3], [e3, tavan] → [k3, 1]. */
export function puanOrani(puan: number, esikler: readonly number[]): number {
  const e2 = Math.max(0, esikler[0] ?? 0);
  const e3 = Math.max(e2, esikler[1] ?? 0);
  const tavan = tavanHesapla(e2, e3);
  const [, k2, k3] = yildizKonumlari([e2, e3]);
  const p = Math.max(0, puan);
  const dogru = (x: number, x0: number, x1: number, y0: number, y1: number): number => (x1 > x0 ? y0 + ((x - x0) / (x1 - x0)) * (y1 - y0) : y1);
  if (p < e2) return dogru(p, 0, e2, 0, k2);
  if (p < e3) return dogru(p, e2, e3, k2, k3);
  return Math.min(1, dogru(p, e3, tavan, k3, 1));
}

/** Puana göre yıldız işaretlerinden kaçı dolu (1★ hedefe bağlı: `hedefTamam`). */
export function doluIsaret(puan: number, esikler: readonly number[], hedefTamam: boolean): number {
  if (!hedefTamam) return 0;
  return puan >= (esikler[1] ?? Infinity) ? 3 : puan >= (esikler[0] ?? Infinity) ? 2 : 1;
}
