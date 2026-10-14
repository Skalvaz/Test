/**
 * Kural sabitleri (GDD §3–§7). Hepsi tamsayı; zaman birimi tik.
 * Ayar değerleri (hamle sayısı, eşik, renk sayısı) bölüm verisindedir.
 */

/** k. düğüm (1 tabanlı, k ≥ 2) için önceki düğümden gecikme: max(35, 110 − 7·(k−1)). */
export const FITIL_ILK_ARALIK = 110;
export const FITIL_HIZLANMA = 7;
export const FITIL_EN_KISA = 35;

/** Isıyla eşiğe ulaşan kapsülün patlama gecikmesi. */
export const ISI_GECIKME = 90;
/** Roket: hücre başına gecikme. */
export const ROKET_ADIM = 25;
/** Kasımpatı: komşu vuruşu ve ısı dalgası gecikmeleri. */
export const KASIMPATI_VURUS = 30;
export const KASIMPATI_DALGA = 60;
/** Yıldız topu: hedef başına aralık. */
export const YILDIZ_ADIM = 20;
/** Kombinasyon dönüşümlerinde (roket yağmuru, bahçe) aralık. */
export const KOMBO_ADIM = 40;
/** Büyük final halka aralığı. */
export const BUYUK_FINAL_ADIM = 40;
/** Dev kasımpatı halka aralığı ve ısı dalgası. */
export const DEV_KASIMPATI_ADIM = 30;
export const DEV_KASIMPATI_DALGA = 90;
/** Barut izi adım süresi. */
export const IZ_ADIM = 60;
/** Dev fişek fırlama gecikmesi ve yukarı adım. */
export const DEV_FISEK_GECIKME = 150;
export const DEV_FISEK_ADIM = 30;
/** Final gösterisi: roketler arası ve özel taş turları arası. */
export const FINAL_ROKET_ARALIK = 120;
export const FINAL_OZEL_ARALIK = 80;
export const FINAL_OZEL_TUR = 5;
/** Yerçekiminden sonraki aşamaların başlama payı (düşme canlandırması). */
export const YERCEKIMI_PAYI = 350;

export const VARSAYILAN_ESIK = 4;
export const VARSAYILAN_OZEL_ESIKLERI: [number, number, number] = [6, 9, 12];
export const VARSAYILAN_DEV_FISEK = 5;
export const VARSAYILAN_KORUK = 20;
/** Kıvılcım Usta'nın Eli (K16): kayıptan sonra eklenen hamle. */
export const USTA_ELI_HAMLE = 5;
/** Fener toplama + yerçekimi tekrar sınırı; karıştırma deneme sınırı. */
export const FENER_TUR_SINIRI = 10;
export const KARISTIRMA_SINIRI = 20;
/** İlk tahtada 8-komşu aynı renk bileşen sınırı ve yeniden çekim sayısı. */
export const ILK_TAHTA_BILESEN_SINIRI = 10;
export const ILK_TAHTA_YENIDEN_CEKIM = 5;

/** Puanlar (§7.1). */
export const PUAN = {
  fitilDugum: 10, // ·k
  isiPatlamasi: 20, // ·nesil
  vurus: 15,
  olusum: { roket: 60, kasimpati: 120, yildiz: 200 },
  kombo: { yildizHatti: 300, kalinRoket: 300, devKasimpati: 400, roketYagmuru: 600, bahce: 600, buyukFinal: 1000 },
  halka: 100,
  engelKat: 20,
  engelYokOldu: 50,
  kafes: 50,
  doseme: 20,
  desen: 40,
  fener: 200,
  devFisek: 300,
  isTemizle: 30,
  kalanHamle: 100,
} as const;

/** Reaksiyon bonusu kademeleri (§7.2): yalnız en yüksek kademe verilir. */
export const REAKSIYON_KADEMELERI = [
  { esik: 40, bonus: 1200, kademe: 'senlik' },
  { esik: 25, bonus: 600, kademe: 'muhtesem' },
  { esik: 15, bonus: 300, kademe: 'harika' },
  { esik: 8, bonus: 100, kademe: 'guzel' },
] as const;
