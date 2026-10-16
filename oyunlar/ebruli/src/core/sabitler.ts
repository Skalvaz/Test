/**
 * Kural sabitleri (GDD §3–§8). Yalnız tamsayı. Zaman TİK'tir (normal hızda
 * 1 tik = 1 ms); çizici ölçekler, hızlandırma kuralı değiştirmez.
 */
import type { Renk } from './types';

/** Doğum ağırlıklarının renk sırası: [K, S, M, T, Mo, Y]. */
export const DOGUM_SIRASI: readonly Renk[] = [1, 2, 4, 3, 5, 6];
/** K2: varsayılan doğum ağırlıkları (karışık payı 33/93 ≈ %35). */
export const VARSAYILAN_DOGUM: readonly [number, number, number, number, number, number] = [20, 20, 20, 11, 11, 11];
/** K7: varsayılan özel taş eşikleri [tarak, girdap, lale]. */
export const VARSAYILAN_OZEL_ESIKLERI: readonly [number, number, number] = [4, 5, 6];
/** Eşleşme eşiği: aynı karışık renkten yatay/dikey bağlı en az 3 damla. */
export const ESLESME_ESIGI = 3;
/** Garanti (akıllı yardım) üst sınırı. */
export const GARANTI_SINIRI = 3;
/** Kaskat güvenlik sınırı (§4.2). */
export const KASKAT_SINIRI = 50;
/** Girdap yarıçapı: |dx| + |dy| ≤ 2 (baklava, 13 hücre) (§5.2). */
export const GIRDAP_YARICAPI = 2;
/** Usta'nın Eli: kayıptan sonra +5 hamle (§8.4). */
export const USTA_ELI_HAMLE = 5;

/** Puanlar (§8.1). */
export const PUAN = {
  /** Grup damlası: 30 × k (k kaskat adımı, 1 tabanlı). */
  grupDamla: 30,
  /** Özel güçle (tarak, girdap, lale, birleşim) temizlenen damla. */
  ozelDamla: 20,
  /** Mürekkep patlamasıyla temizlenen damla. */
  murekkepDamla: 15,
  /** Özel taş üretim bonusu. */
  tarak: 200,
  girdap: 400,
  lale: 800,
  /** Kâğıt katı alındı. */
  kagitKat: 50,
  /** Mermer canı −1. */
  mermerCan: 40,
  /** Yağ lekesi kalktı. */
  yag: 20,
  /** Desen hücresi boyandı. */
  desen: 100,
  /** Ebru Şöleni: kalan hamle başına bonus (tarak ateşlemesinin damla puanına ek). */
  solenHamle: 300,
} as const;

/** Zaman çizelgesi (tik) (§4.9). */
export const ZAMAN = {
  /** Karışım canlandırması (konik dolanma + zıplama). */
  karisim: 220,
  /** Özel sürükleme: taş hedefe kayar. */
  ozelKayma: 120,
  /** Yerçekimi ve doğum turu için ayrılan süre. */
  yercekimi: 300,
  /** Grup damlaları merkeze akar (eslesti → temizlendi). */
  toplanma: 120,
  /** Temizlenen damla suya yayılır; sonraki adım bundan sonra başlar. */
  yayilma: 250,
  /** Tarak: hücre başına süpürme. */
  tarakHucre: 25,
  /** Girdap: çöküş. */
  girdap: 400,
  /** Lale: hedef damla başına yaprak gecikmesi. */
  laleYaprak: 30,
  /** Mürekkep patlaması. */
  murekkep: 200,
  /** Zincirleme (BFS) katmanı başına gecikme. */
  zincir: 150,
  /** Birleşim yavaşlatması (çizici %40 hızda oynatır). */
  birlesim: 150,
  /** Ebru Şöleni: i. tarak 160·i tik sonra ateşlenir. */
  solenAraligi: 160,
} as const;
