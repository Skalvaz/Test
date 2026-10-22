/**
 * Gelir sağlayıcısı (docs/CAN-REKLAM.md §5): ödüllü reklam ve küçük satın
 * alma için sağlayıcıdan bağımsız arayüz. Sağlayıcı yoksa (`null`) can
 * sistemi ve bütün gelir arayüzü kapalıdır (C1: claude.ai sayfası ve tek
 * dosya `fitil.html`).
 *
 * SÖZLEŞME (G0). Türler şartname §5'le birebir; seçim, sahte sağlayıcı ve
 * Android köprü sarmalayıcısı G2'nin (şartname §13).
 */

export type ReklamYeri = 'can' | 'hamle';
export type ReklamSonucu = 'odul' | 'iptal' | 'yok' | 'hata';
export type UrunId = 'can_doldur' | 'guclendirici_paketi' | 'usta_karti';
export interface Urun {
  id: UrunId;
  /** Mağazanın yerel biçimli fiyat metni ("₺29,99"); kodda fiyat yazılmaz. */
  fiyat: string;
}
export type SatinAlmaSonucu =
  | { durum: 'basarili'; urun: UrunId; jeton: string }
  | { durum: 'iptal' | 'beklemede' | 'hata' };
export interface GelirSaglayici {
  readonly ad: 'sahte' | 'android';
  /** Bu yer için reklam şu an gösterilebilir mi (düğme yalnız true iken görünür). */
  reklamHazir(yer: ReklamYeri): boolean;
  /** Reklamı gösterir; oyuncu sonuna kadar izlerse 'odul'. Hiçbir durumda reddetmez (hata → 'hata'). */
  reklamGoster(yer: ReklamYeri): Promise<ReklamSonucu>;
  /** Satıştaki ürünler ve yerel fiyatları (alınamayan ürün listede yoktur). */
  urunler(): Promise<Urun[]>;
  satinAl(id: UrunId): Promise<SatinAlmaSonucu>;
  /** Ödül kayda yazıldıktan SONRA: tüketilir ürünü tüketir, kalıcıyı onaylar. */
  tamamla(jeton: string): Promise<void>;
  /** Tamamlanmamış başarılı satın almalar (açılışta yeniden işlenir). */
  bekleyenler(): Promise<{ urun: UrunId; jeton: string }[]>;
  /** Sahip olunan kalıcı ürünler ("Satın alımları geri yükle"). */
  geriYukle(): Promise<UrunId[]>;
}

/** Bütün ürün kimlikleri, Mağaza sırasıyla (§4 tablosu). */
export const URUN_IDLERI: readonly UrunId[] = Object.freeze(['can_doldur', 'guclendirici_paketi', 'usta_karti'] as const);

/** Ürün türü (§4): tüketilir ürün tekrar alınabilir; kalıcı bir kez alınır, geri yüklenir. */
export const URUN_TURLERI: Readonly<Record<UrunId, 'tuketilir' | 'kalici'>> = Object.freeze({
  can_doldur: 'tuketilir',
  guclendirici_paketi: 'tuketilir',
  usta_karti: 'kalici',
});

/**
 * Android köprüsü (§5.1; aşama 3'te Capacitor eklentisi uygular):
 * `window.FitilYerel.gelir`. JSON dönen yöntemleri G2'nin sarmalayıcısı
 * çözer; beklenmeyen değerde 'hata' döner, oyunu hiçbir durumda durdurmaz.
 */
export interface AndroidGelirKoprusu {
  reklamHazir(yer: string): boolean;
  /** 'odul' | 'iptal' | 'yok' | 'hata' metni. */
  reklamGoster(yer: string): Promise<string>;
  /** JSON: `Urun[]`. */
  urunler(): Promise<string>;
  /** JSON: `SatinAlmaSonucu`. */
  satinAl(id: string): Promise<string>;
  tamamla(jeton: string): Promise<void>;
  /** JSON: `{ urun, jeton }[]`. */
  bekleyenler(): Promise<string>;
  /** JSON: `UrunId[]`. */
  geriYukle(): Promise<string>;
}

/**
 * Sağlayıcı yoksa null: can sistemi ve bütün gelir arayüzü kapalı.
 *
 * Seçim (G2): `window.FitilYerel?.gelir` varsa Android köprüsü; `?gelir=sahte`
 * (ya da `localStorage` `fitil.gelir` = `sahte`) sahte sağlayıcı; aksi halde
 * null. Sayfa başına BİR KEZ seçilir, sonraki çağrılar aynı örneği (ya da
 * null'u) döndürür. G0 iskeleti: her zaman null.
 */
export function gelirSaglayici(): GelirSaglayici | null {
  return null;
}
