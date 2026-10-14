/**
 * Yol yardımcıları (§3.2–§3.3, §4.1): zincir rengi, komşuluk, doğrulama,
 * roket ekseni, özel taş türü, tahtadaki en çok renk.
 */
import { hucre, icinde, idx, zincirlenebilir } from './tahta';
import type { Eksen, Konum, OyunDurumu, OzelTur, YolHatasi } from './types';

/** Zincir rengi: yoldaki ilk joker olmayan kapsülün rengi; hepsi joker ise −1 (§3.3.1). */
export function zincirRengi(d: OyunDurumu, yol: readonly Konum[]): number {
  for (const p of yol) {
    const h = hucre(d, p.x, p.y);
    if (h?.icerik?.tur === 'kapsul' && h.icerik.renk !== -1) return h.icerik.renk;
  }
  return -1;
}

/** İki konum zincir komşusu mu (8-komşu; `dortKomsu` kuralında yalnız dik). */
export function zincirKomsusu(d: OyunDurumu, a: Konum, b: Konum): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx === 0 && dy === 0) return false;
  if (d.kurallar.dortKomsu) return dx + dy === 1;
  return dx <= 1 && dy <= 1;
}

/**
 * Bırakılan yolun geçerliliği (§3.3). null = geçerli.
 * halka: son düğüm ilk düğüme komşu ve |yol| ≥ 4 iken kapanmış yol.
 */
export function yolDogrula(d: OyunDurumu, yol: readonly Konum[], halka: boolean): YolHatasi | null {
  if (yol.length < 3) return 'kisa';
  const renk = zincirRengi(d, yol);
  const gorulen = new Set<number>();
  let capraz = 0;
  for (let k = 0; k < yol.length; k++) {
    const p = yol[k];
    if (!icinde(d, p.x, p.y)) return 'zincirlenemez';
    const i = idx(d, p.x, p.y);
    if (gorulen.has(i)) return 'tekrar';
    gorulen.add(i);
    if (!zincirlenebilir(d, p.x, p.y, -1)) return 'zincirlenemez';
    if (!zincirlenebilir(d, p.x, p.y, renk)) return 'renk';
    if (k > 0) {
      if (!zincirKomsusu(d, yol[k - 1], p)) return 'komsu';
      if (yol[k - 1].x !== p.x && yol[k - 1].y !== p.y) capraz++;
    }
  }
  if (halka && (yol.length < 4 || !zincirKomsusu(d, yol[yol.length - 1], yol[0]))) return 'komsu';
  const sinir = d.kurallar.caprazSiniri;
  if (sinir != null && capraz > sinir) return 'capraz';
  if (d.kurallar.yalnizHalka && !halka) return 'halkaGerekli';
  return null;
}

/**
 * Roket ekseni son segmentten (§2.3): dy = 0 → 0; dx = 0 → 1;
 * dx·dy < 0 → 2 (↗); dx·dy > 0 → 3 (↘).
 */
export function eksenBul(onceki: Konum, son: Konum): Eksen {
  const dx = son.x - onceki.x;
  const dy = son.y - onceki.y;
  if (dy === 0) return 0;
  if (dx === 0) return 1;
  return dx * dy < 0 ? 2 : 3;
}

/**
 * n düğümlü halka olmayan zincirin son düğümü hangi özel taşa döner (§4.1).
 * `ozelEsikleri` içinde 0 o türü kapatır. Kapalı türün aralığı bir alt türe
 * düşer (ör. [6,9,0] ve n = 12 → kasımpatı).
 */
export function ozelTuruBul(esikler: readonly [number, number, number], n: number): OzelTur {
  const [r, k, y] = esikler;
  if (y > 0 && n >= y) return 'yildiz';
  if (k > 0 && n >= k) return 'kasimpati';
  if (r > 0 && n >= r) return 'roket';
  return 'yok';
}

/**
 * Tahtada en çok bulunan renk (eşitlikte küçük indeks): bütün renkli
 * kapsüller (kafesli dahil, joker hariç) sayılır. Hiç yoksa 0. §3.3.1, §4.2.
 */
export function enCokRenk(d: OyunDurumu): number {
  const sayac = new Array<number>(6).fill(0);
  for (const h of d.hucreler) {
    const ic = h.icerik;
    if (!h.delik && ic?.tur === 'kapsul' && ic.renk >= 0) sayac[ic.renk]++;
  }
  let en = 0;
  for (let r = 1; r < d.renkSayisi && r < 6; r++) if (sayac[r] > sayac[en]) en = r;
  return en;
}
