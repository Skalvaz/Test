/**
 * Çekirdeğin RNG'si: mulberry32, durum tek bir uint32 (OyunDurumu.rng).
 * GDD §13.3. Sonuç her platformda aynıdır: rngSonraki·n < 2⁵³ ve 2³²'ye
 * bölme kesindir.
 */
export function rngSonraki(d: { rng: number }): number {
  d.rng = (d.rng + 0x6d2b79f5) >>> 0;
  let t = d.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** [0, n) tamsayı. */
export function rngInt(d: { rng: number }, n: number): number {
  return Math.floor((rngSonraki(d) * n) / 4294967296);
}

/** Tamsayı ağırlıklarla seçim (kümülatif toplam). Ağırlıkların toplamı > 0. */
export function agirlikliSec(d: { rng: number }, agirliklar: readonly number[]): number {
  let toplam = 0;
  for (const a of agirliklar) toplam += a;
  let r = rngInt(d, toplam);
  for (let i = 0; i < agirliklar.length; i++) {
    r -= agirliklar[i];
    if (r < 0) return i;
  }
  return agirliklar.length - 1;
}

/** Tek seferlik mulberry32 çıktısı (tohum türetmek için). */
export function mulberry32Bir(tohum: number): number {
  return rngSonraki({ rng: tohum >>> 0 });
}

/** Oyun akışı tohumu (§8.1): her deneme taze dolum, ilk tahta sabit (FİTİL K15). */
export function oyunTohumu(bolumTohumu: number, denemeNo: number): number {
  return mulberry32Bir((bolumTohumu ^ Math.imul(denemeNo + 1, 0x9e3779b9)) >>> 0);
}

/** FNV-1a 32 bit (durum karması, tarih tohumu vb.). */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
