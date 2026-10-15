/**
 * Çekirdek API (GDD §13.2). Çizici, girdi, arayüz, bot ve bölüm araçları
 * çekirdeğe YALNIZ buradan erişir. Ayrıntılı API, olay sözlüğü ve zamanlama:
 * `src/core/README.md`.
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
 *  5. Boşta ipucu: `olumluHamleler(d)[0]` (§12.4).
 */
import { fnv1a } from './rng';
import type { BolumVerisi, OyunDurumu } from './types';

export * from './types';
export { bolumuYukle, BolumHatasi, hedefDurumu, bosIstatistik } from './bolumYukle';
export { karisimSonucu, gruplariBul, gecerliHamleVar, durumKopyala, gruplanir, hamMi, karisikMi, damla, idx, konum, icinde, bosHucre, DIK } from './tahta';
export { rngSonraki, rngInt, agirlikliSec, oyunTohumu, fnv1a, mulberry32Bir } from './rng';
export * as SABIT from './sabitler';
export { hamleUygula, hamleHatasi, gecerliHedefler, HamleHatasiIstisnasi } from './hamle';
export { onizle, onizleDetay, olumluHamleler, type OnizlemeDetayi } from './onizle';
export { ebruSoleni, ustaEliUygula, EylemHatasi, SOLEN_TARAK_SINIRI } from './solen';
export { hazirCiftSayisi, hazirHamleler, karisimHamleleri, type IndeksHamle } from './hazir';
export { komboTuru, komboPuani, ozelTuruBul, OZEL_ZAMAN } from './ozel';
export { kaskatKademesi } from './cozum';
export { gorselTahtaKur, olayUygula, olaylariUygula, gorselFark, OynaticiHatasi, type GorselTahta } from './oynatici';

/**
 * Geriye uyum: P0 taslaklarının yerini tutan hata sınıfı (artık hiçbir işlev
 * fırlatmaz).
 */
export class UygulanmadiHatasi extends Error {
  constructor(ad: string) {
    super(`${ad}: uygulanmadı`);
  }
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
