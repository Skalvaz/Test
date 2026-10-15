/**
 * HUD puan çubuğu geometrisi (§13.7): 2★ ve 3★ işaretlerinin konumu ve
 * dolgunun puana göre oranı. Saf (DOM yok, testli).
 *
 * Eşikler birbirine yakınsa (ör. bölüm 1: 2600 / 2900) doğrusal ölçekte iki
 * yıldız telefonda ~9 px aralıkla tek lekeye dönüşür. Çubuk doğrusal olmak
 * zorunda değil: işaretler arasında en az `EN_AZ_ARALIK` (çubuğun %20'si)
 * bırakılır, dolgu da aynı parçalı doğrusal eşlemeyle ilerler; böylece dolgu
 * her zaman tam eşikte işarete ulaşır.
 */
export const EN_AZ_ARALIK = 0.2;

/** [1★, 2★, 3★] işaretlerinin çubuktaki oranı (0..1). */
export function yildizKonumlari(esikler: readonly [number, number] | readonly number[]): [number, number, number] {
  const e1 = Math.max(0, esikler[0] ?? 0);
  const e2 = Math.max(e1, esikler[1] ?? 0);
  const tavan = Math.max(1, e2 * 1.12, e1 * 1.5);
  let k2 = e1 / tavan;
  let k3 = e2 / tavan;
  if (k3 - k2 < EN_AZ_ARALIK) {
    k2 = Math.min(k2, 0.62);
    k3 = Math.min(0.9, Math.max(k3, k2 + EN_AZ_ARALIK));
    if (k3 - k2 < EN_AZ_ARALIK) k2 = k3 - EN_AZ_ARALIK;
  }
  return [0.07, Math.max(0.2, k2), k3];
}

/** Puanın çubuktaki dolgu oranı: [0, e1] → [0, k2], [e1, e2] → [k2, k3], [e2, tavan] → [k3, 1]. */
export function puanOrani(puan: number, esikler: readonly [number, number] | readonly number[]): number {
  const e1 = Math.max(0, esikler[0] ?? 0);
  const e2 = Math.max(e1, esikler[1] ?? 0);
  const tavan = Math.max(1, e2 * 1.12, e1 * 1.5);
  const [, k2, k3] = yildizKonumlari([e1, e2]);
  const p = Math.max(0, puan);
  const dogru = (x: number, x0: number, x1: number, y0: number, y1: number) => (x1 > x0 ? y0 + ((x - x0) / (x1 - x0)) * (y1 - y0) : y1);
  if (p <= e1) return e1 > 0 ? dogru(p, 0, e1, 0, k2) : k2;
  if (p <= e2) return dogru(p, e1, e2, k2, k3);
  return Math.min(1, dogru(p, e2, tavan, k3, 1));
}
