/**
 * Çekirdek API (GDD §13.2). Çizici, girdi, arayüz, bot ve bölüm araçları
 * çekirdeğe YALNIZ buradan erişir.
 *
 * P0 durumu:
 *  - Hazır (başvuru, testli): `bolumuYukle`, `karisimSonucu`, `gruplariBul`,
 *    `gecerliHamleVar`, `hamleHatasi`, `gecerliHedefler`, `durumKarmasi`,
 *    `ilerlemeYuzdesi`, `yildizHesapla`, RNG.
 *  - Taslak (P1 çekirdek paketi doldurur; imza ve anlam bağlayıcı):
 *    `hamleUygula`, `onizle`, `olumluHamleler`, `ebruSoleni`, `ustaEliUygula`,
 *    `gorselTahtaKur` / `olayUygula` / `gorselFark` (oynatıcı, §13.2).
 *
 * Tipik akış (uygulama):
 *  1. `d = bolumuYukle(v, denemeNo)`; çizici `bolumKur(d, v)`.
 *  2. Parmak bir damlaya basınca `gecerliHedefler(d, kaynak)` vurgulanır
 *     (geçersiz hedefler HİÇ gösterilmez, K6); geçerli hedefin üstünde
 *     `onizle(d, hamle)` (K8).
 *  3. Bırakınca `hamleHatasi(d, h)`; null ise `{durum, olaylar} =
 *     hamleUygula(d, h)`; çizici `oynat(d, olaylar, durum)`; `d = durum`.
 *  4. `d.bitti === 'kazanc'` → `ebruSoleni(d)` ve yine `oynat`. `'kayip'` →
 *     kaybettin ekranı; Usta'nın Eli seçilirse `ustaEliUygula(d)`.
 */
import { fnv1a } from './rng';
import { DIK, damla, icinde, karisimSonucu } from './tahta';
import type { BolumVerisi, Hamle, HamleHatasi, HamleSonucu, Konum, OlumluHamle, Olay, Onizleme, OyunDurumu } from './types';

export * from './types';
export { bolumuYukle, BolumHatasi, hedefDurumu, bosIstatistik } from './bolumYukle';
export { karisimSonucu, gruplariBul, gecerliHamleVar, durumKopyala, gruplanir, hamMi, karisikMi, damla, idx, konum, icinde, bosHucre, DIK } from './tahta';
export { rngSonraki, rngInt, agirlikliSec, oyunTohumu, fnv1a, mulberry32Bir } from './rng';
export * as SABIT from './sabitler';

/** P1'in dolduracağı işlevler çağrılırsa (geliştirme sırasında) açık hata. */
export class UygulanmadiHatasi extends Error {
  constructor(ad: string) {
    super(`${ad}: P1 çekirdek paketi henüz uygulamadı (GDD §16)`);
  }
}

/**
 * Hamle geçersizse nedeni, geçerliyse null (§3.3). Geçersiz hamle hamle
 * harcamaz; girdi katmanı damlayı titretir.
 */
export function hamleHatasi(d: OyunDurumu, h: Hamle): HamleHatasi | null {
  if (d.bitti) return 'bitti';
  if (d.kalanHamle <= 0) return 'hamleYok';
  const { kaynak: k, hedef: e } = h;
  if (!icinde(d, k.x, k.y) || !icinde(d, e.x, e.y)) return 'konum';
  if (Math.abs(k.x - e.x) + Math.abs(k.y - e.y) !== 1) return 'komsuDegil';
  const hk = d.hucreler[k.y * d.w + k.x];
  const he = d.hucreler[e.y * d.w + e.x];
  if (hk.icerik?.tur === 'mermer' || he.icerik?.tur === 'mermer') return 'mermer';
  const a = damla(hk);
  const b = damla(he);
  if (!a || !b) return 'bos';
  if (hk.yag || he.yag) return 'yag';
  // Özel taşa dokunan her sürükleme geçerlidir (§5.3): özel kaynak hedefte ya
  // da yerinde ateşlenir; düz damla özel taşa sürüklenirse özel taş YERİNDE
  // ateşlenir; özel + özel birleşimdir.
  if (a.ozel !== 'yok' || b.ozel !== 'yok') return null;
  const s = karisimSonucu(a.renk as 1, b.renk as 1, d.kurallar.murekkep);
  return 'hata' in s ? s.hata : null;
}

/** Kaynaktaki damlanın geçerli hedefleri (K6: yalnız bunlar vurgulanır). */
export function gecerliHedefler(d: OyunDurumu, kaynak: Konum): Konum[] {
  const out: Konum[] = [];
  for (const o of DIK) {
    const hedef = { x: kaynak.x + o.x, y: kaynak.y + o.y };
    if (hamleHatasi(d, { tur: 'surukle', kaynak, hedef }) === null) out.push(hedef);
  }
  return out;
}

/**
 * Hamleyi çözer → `{ durum, olaylar }` (§4). Girdiyi DEĞİŞTİRMEZ (derin
 * kopya); geçersiz hamlede `HamleHatasiIstisnasi` fırlatır. Olaylar §13.2
 * sözlüğüne uyar; son olay `hamleOzeti`, bitişte ondan önce `bolumBitti`.
 */
export function hamleUygula(_d: OyunDurumu, _h: Hamle): HamleSonucu {
  throw new UygulanmadiHatasi('hamleUygula');
}

export class HamleHatasiIstisnasi extends Error {
  constructor(readonly neden: HamleHatasi) {
    super(`geçersiz hamle: ${neden}`);
  }
}

/** Sürüklerken önizleme (§3.5): doğumsuz çözüm; geçersizde `gecerli: false`. */
export function onizle(_d: OyunDurumu, _h: Hamle): Onizleme {
  throw new UygulanmadiHatasi('onizle');
}

/**
 * Hazır (olumlu) hamleler (§4.7): önizlemede en az bir grup eşleşen geçerli
 * karışım hamleleri, temizlenen damla sayısına göre azalan, eşitlikte
 * (kaynak indeksi, hedef indeksi) artan sırada. Garanti, boşta ipucu ve
 * botlar bunu kullanır. Özel taş sürüklemeleri listede yoktur.
 */
export function olumluHamleler(_d: OyunDurumu): OlumluHamle[] {
  throw new UygulanmadiHatasi('olumluHamleler');
}

/**
 * Ebru Şöleni (§8.3): kazançtan sonra uygulama ayrıca çağırır; kalan her
 * hamle bir tarağa dönüşüp ateşlenir. İkinci çağrıda fırlatır.
 */
export function ebruSoleni(_d: OyunDurumu): HamleSonucu {
  throw new UygulanmadiHatasi('ebruSoleni');
}

/** Usta'nın Eli (§8.4): kayıptan +5 hamleyle devam, en fazla 1★. */
export function ustaEliUygula(_d: OyunDurumu): HamleSonucu {
  throw new UygulanmadiHatasi('ustaEliUygula');
}

/** Hedef ilerleme yüzdesi 0..1: ortalama(min(1, ilerleme/gerekli)). */
export function ilerlemeYuzdesi(d: OyunDurumu): number {
  if (d.hedefler.length === 0) return 1;
  let s = 0;
  for (const h of d.hedefler) s += h.gerekli <= 0 ? 1 : Math.min(1, h.ilerleme / h.gerekli);
  return s / d.hedefler.length;
}

/** Yıldız (§8.4): 1★ hedef; 2★/3★ puan eşikleri; Usta'nın Eli → en fazla 1★. */
export function yildizHesapla(d: OyunDurumu, v: BolumVerisi): 0 | 1 | 2 | 3 {
  if (d.bitti !== 'kazanc') return 0;
  if (d.istatistik.ustaEli) return 1;
  if (d.puan >= v.yildizEsikleri[1]) return 3;
  if (d.puan >= v.yildizEsikleri[0]) return 2;
  return 1;
}

/** Durum karması (FNV-1a 32 bit) — altın tekrarlar ve bot için. */
export function durumKarmasi(d: OyunDurumu): number {
  return fnv1a(
    JSON.stringify([d.hucreler, d.rng, d.puan, d.kalanHamle, d.sonrakiId, d.hedefler.map((h) => [h.ilerleme, h.gerekli, h.tamam]), d.bitti]),
  );
}

/**
 * Görsel tahta (§13.2): çizicinin olaylardan güncellediği kopya. P1
 * `oynatici.ts`'de başvuru indirgeyicisini (`olayUygula`, katı kipte önkoşul
 * denetimi) ve bulanık testini yazar; çizici bunu kullanır.
 */
export interface GorselTahta {
  w: number;
  h: number;
  hucreler: OyunDurumu['hucreler'];
  puan: number;
  hedefler: { ilerleme: number; gerekli: number; tamam: boolean }[];
  bitti: OyunDurumu['bitti'];
}

export function gorselTahtaKur(d: OyunDurumu): GorselTahta {
  return {
    w: d.w,
    h: d.h,
    hucreler: d.hucreler.map((h) => ({ ...h, icerik: h.icerik ? (h.icerik.tur === 'damla' ? { tur: 'damla', damla: { ...h.icerik.damla } } : { ...h.icerik }) : null })),
    puan: d.puan,
    hedefler: d.hedefler.map((h) => ({ ilerleme: h.ilerleme, gerekli: h.gerekli, tamam: h.tamam })),
    bitti: d.bitti,
  };
}

/** Tek olayı görsel tahtaya uygular (P1). `kati`: önkoşul ihlalinde fırlatır. */
export function olayUygula(_g: GorselTahta, _o: Olay, _kati = false): void {
  throw new UygulanmadiHatasi('olayUygula');
}

/** Görsel tahta ile durum arasındaki farklar (boş = eşit) (P1). */
export function gorselFark(_g: GorselTahta, _d: OyunDurumu): string[] {
  throw new UygulanmadiHatasi('gorselFark');
}
