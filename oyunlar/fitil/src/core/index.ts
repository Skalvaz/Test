/**
 * Çekirdek API (GDD §16.2). Çizici, girdi, arayüz, bot ve bölüm araçları
 * çekirdeğe yalnız buradan erişir.
 *
 * Dosyalar (§16.1): yol.ts (doğrulama, zincir rengi), resolve.ts (olay
 * simülasyonu), ozel.ts, engel.ts, yercekimi.ts, kilit.ts, karistir.ts,
 * hedef.ts, puan.ts, onizle.ts, final.ts, hava.ts, hamle.ts (hamleUygula,
 * körük, hamle sonu sırası), oynatici.ts (olaylardan görsel tahta; çizicinin
 * başvuru indirgeyicisi, §16.1). Ayrıntılar: src/core/README.md.
 */
import { fnv1a } from './rng';
import type { OyunDurumu } from './types';

export * from './types';
export { bolumuYukle, BolumHatasi } from './bolumYukle';
export { kilitliMi, bilesenVar, halkaVar, ozelVar } from './kilit';
export { karistir } from './karistir';
export { zincirRengi, zincirKomsusu, yolDogrula, eksenBul, ozelTuruBul, enCokRenk } from './yol';
export { hamleUygula, hamleHatasi, HamleHatasi, GUCLENDIRICI_SINIRI, ustaEliUygula } from './hamle';
export { onizle } from './onizle';
export { gorselTahtaKur, olayUygula, olaylariUygula, gorselFark, OynaticiHatasi } from './oynatici';
export type { GorselTahta } from './oynatici';
export { finalGosterisi } from './final';
export { komboTuru } from './ozel';
export { patlamaPuani, reaksiyonKademesi, yildizHesapla } from './puan';
export { zincirlenebilir, durumKopyala, idx, konum, hucre, icinde, DIK, SEKIZ } from './tahta';
export { rngSonraki, rngInt, oyunTohumu, fnv1a, mulberry32Bir } from './rng';
export * as SABIT from './sabitler';

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
