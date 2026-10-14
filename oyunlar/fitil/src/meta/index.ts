/**
 * FİTİL meta katmanı (GDD §9, §10, §11, §15 Coşku, §16.7). Saf, belirlenimli,
 * DOM'suz; zaman ve tarih parametre olarak gelir, RNG çekirdeğin mulberry32'si.
 *
 * Akış (uygulama, src/app):
 *
 *   // Açılış
 *   const depo = new SaveStore<Kayit>(kayitDeposuAyarlari());
 *   const { kayit } = kayitYukle([depo.loadLocal()?.data], ilkTohum);
 *   kayit = gunGiris(kayit, bugun).kayit;          // günlük görevler
 *   const harita = haritaVerisi(kayit);             // harita ekranı
 *
 *   // Bölüm
 *   const d0 = bolumuYukle(v, siradakiDenemeNo(kayit, v.id), { cosku: coskuAktif(kayit) });
 *   let oz = ozetBaslat();
 *   oz = ozetHamle(oz, sonuc.olaylar, { hamle, onceki });   // her eylemde
 *   oz = ozetFinal(oz, final.olaylar);                       // kazanınca
 *   const r = bolumSonucu(kayit, { bolumId, kazandi, puan, yildiz, istatistik,
 *                                 olaylarOzeti: oz, tarih: bugun, kalanHamle, toplamHamle });
 *   kayit = r.kayit; depo.save(kayit);              // r.oduller → kazandın ekranı
 *
 * Modüller:
 *  - kayit    şema, varsayılan, göç, onarım, progressScore, kayıt kodu (FTL1:)
 *  - ilerleme bolumSonucu: yıldız, kilit, sandık hakları, Coşku, rozet, rekor…
 *  - sandik   normal/parlak sandık, kötü şans koruması, toz
 *  - gunluk   görev seçimi/ilerlemesi, Fener Nöbeti, arşiv, paylaşım metni
 *  - galeri   Gece Tablosu kayıtları (32 bit, base64) ve nadirlik
 *  - defter   koleksiyon görünümü, takılı desenler, kartlar, tozla parça
 *  - harita   harita düğümleri (düz tip)
 *  - mola     mola hatırlatıcısı zamanlayıcısı
 *  - ozet     çekirdek olaylarından oyun özeti
 *  - rozetler başarım koşulları
 *  - takvim   yyyymmdd aritmetiği (Date'siz)
 */
export * from './sabitler';
export * from './takvim';
export * from './kodlama';
export * from './kayit';
export * from './envanter';
export * from './ozet';
export * from './galeri';
export * from './sandik';
export * from './gunluk';
export * from './defter';
export * from './rozetler';
export * from './ilerleme';
export * from './harita';
export * from './mola';
