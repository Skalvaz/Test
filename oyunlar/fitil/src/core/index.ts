/**
 * Çekirdek API (GDD §16.2). Çizici, girdi, arayüz, bot ve bölüm araçları
 * çekirdeğe yalnız buradan erişir.
 *
 * P0 notu: `bolumuYukle`, `kilitliMi`, `yolDogrula`, `zincirRengi`,
 * `ilerlemeYuzdesi`, `durumKarmasi` başvuru uygulamasıdır; `hamleUygula`,
 * `onizle`, `finalGosterisi` P1 (çekirdek paketi) tarafından yazılacak.
 */
import { SEKIZ, DIK, hucre, icinde, idx, zincirlenebilir } from './tahta';
import { fnv1a } from './rng';
import type { Hamle, HamleSonucu, Konum, Onizleme, OyunDurumu, YolHatasi } from './types';

export * from './types';
export { bolumuYukle, BolumHatasi } from './bolumYukle';
export { kilitliMi } from './kilit';
export { zincirlenebilir, durumKopyala, idx, konum, hucre, icinde, DIK, SEKIZ } from './tahta';
export { rngSonraki, rngInt, oyunTohumu, fnv1a, mulberry32Bir } from './rng';
export * as SABIT from './sabitler';

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

/** Hedef ilerleme yüzdesi 0..1 (§6): ortalama(min(1, ilerleme/gerekli)). */
export function ilerlemeYuzdesi(d: OyunDurumu): number {
  if (d.hedefler.length === 0) return 1;
  let s = 0;
  for (const h of d.hedefler) s += h.gerekli <= 0 ? 1 : Math.min(1, h.ilerleme / h.gerekli);
  return s / d.hedefler.length;
}

/** Durum karması (FNV-1a 32 bit) — testler ve altın tekrarlar için. */
export function durumKarmasi(d: OyunDurumu): number {
  return fnv1a(
    JSON.stringify([d.hucreler, d.rng, d.puan, d.kalanHamle, d.hedefler.map((h) => [h.ilerleme, h.gerekli, h.tamam]), d.korukDolum, d.izler, d.havaOlaylari, d.bitti]),
  );
}

/** P1: hamleyi çözer; girdiyi DEĞİŞTİRMEZ (§3.5). */
export function hamleUygula(_d: OyunDurumu, _h: Hamle): HamleSonucu {
  throw new Error('hamleUygula: P1 çekirdek paketi uygulayacak');
}

/** P1: çizerken önizleme (§3.9), O(|yol|). */
export function onizle(_d: OyunDurumu, _yol: readonly Konum[], _halka: boolean): Onizleme {
  throw new Error('onizle: P1 çekirdek paketi uygulayacak');
}

/** P1: kazanınca final gösterisi (§7.3). */
export function finalGosterisi(_d: OyunDurumu): HamleSonucu {
  throw new Error('finalGosterisi: P1 çekirdek paketi uygulayacak');
}

// Kullanılmayan içe aktarım uyarısını önler (P1 bunları kullanacak).
void SEKIZ;
void DIK;
