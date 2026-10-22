/**
 * Can, ödüllü reklam hakkı ve küçük satın almanın kayıt mantığı
 * (docs/CAN-REKLAM.md §2–§4, §7, §9). Saf, belirlenimli, DOM'suz; meta
 * `Date` kullanmaz: zaman ve gün parametre olarak gelir.
 *
 * SÖZLEŞME (G0). Gövdeleri G1 yazar; imzalar ve buradaki JSDoc bağlayıcıdır
 * (şartname §13). Ortak kurallar:
 *
 *  - `simdi`: DUVAR SAATİ, epoch ms (`app/zaman.ts` `duvarSaati()` =
 *    `Date.now()`). `zaman.ts`'teki `simdi()` (performance.now, sayfa başına
 *    sıfırlanan monoton saat)
 *    BURADA KULLANILMAZ: `can.dolumBasi` kayda yazılır ve sayfalar/cihazlar
 *    arasında taşınır.
 *  - `bugun`: yerel takvim günü `yyyymmdd` (`app/zaman.ts` `bugun()`;
 *    Günün Şenliği ile aynı gün tanımı). Reklam hakkının günlük sayacı buna
 *    göre sıfırlanır.
 *  - Kayıt alan işlevler girdiyi DEĞİŞTİRMEZ. Kayıtta değişecek bir şey
 *    yoksa aynı nesneyi döndürür; varsa yeni kopya (`kayitKopyala`). Uygulama
 *    `yeni !== eski` ile kaydedip kaydetmeyeceğine karar verebilir.
 *  - `k.can` / `k.gelir` yoksa (eski kayıt, sağlayıcısız sürümün kaydı)
 *    `varsayilanCan()` / `varsayilanGelir()` sayılır.
 *  - Her kayıt işlevi önce tembel dolumu uygular (`canTazele` ile aynı
 *    hesap), sonra kendi değişikliğini yapar.
 *  - Can yalnız gelir sağlayıcısı varken vardır (C1); bu işlevler sağlayıcıyı
 *    bilmez, kapıyı uygulama (G4) tutar.
 */
import type { GuclendiriciId } from '../app/katalog';
import type { BolumVerisi } from '../core/types';
import type { UrunId } from '../platform/gelir';
import type { Kayit } from './kayit';

// ─────────────────────────── Sabitler (§9) ───────────────────────────

/** En çok can (C2). */
export const CAN_ENCOK = 5;
/** Can < `CAN_ENCOK` iken bu sürede +1 (C2): 30 dk. */
export const CAN_DOLUM_MS = 30 * 60 * 1000;
/** Bu bölüme kadar (dahil) ana bölümler ücretsiz: öğretim + İskele (C3). */
export const CAN_UCRETSIZ_SON_BOLUM = 5;
/** Günde reklamla (ya da Usta kartıyla) alınabilecek +1 can sayısı (C6). */
export const REKLAM_CAN_GUNLUK = 3;
/** Güçlendirici paketi içeriği (C8): 3 Kibrit + 2 Fişek Kalıbı + 2 Geri Sar. */
export const GUCLENDIRICI_PAKETI: Readonly<Record<GuclendiriciId, number>> = Object.freeze({ kibrit: 3, kalip: 2, geriSar: 2 });
/** `gelir.jetonlar`'da tutulan son satın alma jetonu sayısı (çifte verme koruması). */
export const JETON_SINIRI = 50;

// ─────────────────────────── Tipler (§7) ───────────────────────────

/** Kayıttaki can durumu (`Kayit.can`). */
export interface CanKaydi {
  /** Kayıtlı can sayısı 0..CAN_ENCOK (tembel dolum UYGULANMAMIŞ olabilir; okurken `canDurumu`). */
  sayi: number;
  /**
   * Dolum zamanının başı (duvar saati ms): can < CAN_ENCOK olduğu an başlar,
   * her `CAN_DOLUM_MS` geçişinde +1 can ve `dolumBasi` o kadar ileri kayar;
   * CAN_ENCOK'a varınca `null`.
   */
  dolumBasi: number | null;
  /** Reklam hakkı sayacının günü (yyyymmdd; 0 = hiç). */
  reklamGun: number;
  /** `reklamGun` günü kullanılan reklam/Usta kartı +1 can sayısı (0..REKLAM_CAN_GUNLUK). */
  reklamSayisi: number;
}

/** Kayıttaki satın alma durumu (`Kayit.gelir`). */
export interface GelirKaydi {
  /** Usta kartı (kalıcı ürün): ödüllü reklamların ödülü reklamsız (C9). */
  ustaKarti: boolean;
  /** Ödülü verilmiş son `JETON_SINIRI` satın alma jetonu (eskiden yeniye). */
  jetonlar: string[];
}

/** Okunan (tembel dolum uygulanmış) can durumu; arayüz ve kapı bunu kullanır. */
export interface CanDurumu {
  sayi: number;
  /** Her zaman `CAN_ENCOK` (arayüz "3/5" yazar). */
  enCok: number;
  /** Sonraki cana kalan ms (1..CAN_DOLUM_MS); can doluysa `null`. */
  sonrakiMs: number | null;
}

/** Can harcama nedeni (ölçüm `can_harcandi.neden` ile aynı). */
export type CanHarcamaNedeni = 'kayip' | 'cikis';

/** `satinAlmaUygula` sonucu. */
export interface SatinAlmaUygulamasi {
  kayit: Kayit;
  /**
   * Ödül kayda yazıldı ve jeton `gelir.jetonlar`'a eklendi: uygulama kaydı
   * yazar, SONRA sağlayıcının `tamamla(jeton)`'unu çağırır.
   */
  verildi: boolean;
  /**
   * Jeton daha önce işlenmiş (çifte verme): kayıt aynen döner, ödül yok;
   * uygulama yine `tamamla(jeton)` çağırır (önceki tamamlama yarıda kalmış olabilir).
   */
  tekrar: boolean;
  // verildi = false, tekrar = false: ürün şu an verilemiyor (paket stok
  // sınırını aşıyor). Kayıt aynen döner; uygulama `tamamla` ÇAĞIRMAZ, satın
  // alma sağlayıcıda bekler ve sonraki açılışta `bekleyenler()` ile yeniden denenir.
}

// ─────────────────────────── Varsayılanlar ───────────────────────────

/** Yeni ya da can alanı olmayan kayıt: 5 can, dolum yok, reklam hakkı kullanılmamış. */
export function varsayilanCan(): CanKaydi {
  return { sayi: CAN_ENCOK, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 };
}

/** Yeni ya da gelir alanı olmayan kayıt: Usta kartı yok, jeton yok. */
export function varsayilanGelir(): GelirKaydi {
  return { ustaKarti: false, jetonlar: [] };
}

// ─────────────────────────── İşlevler (gövde: G1) ───────────────────────────

/** G0 iskeleti: G1 gövdeyi yazana kadar çağrılırsa hata. Bağımsız değişkenler yalnız imzayı korur. */
function g1(ad: string, ..._girdi: unknown[]): Error {
  return new Error(`G1: meta/can.ts ${ad} henüz yazılmadı`);
}

/**
 * Okuma: tembel dolumu uygulayarak can durumunu döndürür (kaydı değiştirmez).
 * Kurallar (§2): can < CAN_ENCOK iken `dolumBasi`'ndan bu yana geçen her tam
 * `CAN_DOLUM_MS` +1; CAN_ENCOK'ta durur (`sonrakiMs` null). Saat geri gittiyse
 * (simdi < dolumBasi) dolum `simdi`'den başlamış sayılır: eksi süre ve ceza
 * yok, `sonrakiMs` = CAN_DOLUM_MS.
 * @param simdi duvar saati ms (`Date.now()`)
 */
export function canDurumu(k: Kayit, simdi: number): CanDurumu {
  throw g1('canDurumu', k, simdi);
}

/**
 * Bölüm can harcıyor mu (C3): ana bölüm (`tur` öğretim, tanıtım, normal,
 * zor, rahatlama, final) ve `id` > CAN_UCRETSIZ_SON_BOLUM, ya da Usta Bölümü
 * (`tur` 'usta'). Günün Şenliği ('gunluk') ve Sonsuz Şenlik ('sonsuz')
 * ücretsiz. Sağlayıcı yokken uygulama bunu hiç sormaz (C1).
 */
export function canGerekirMi(v: Pick<BolumVerisi, 'tur' | 'id'>): boolean {
  throw g1('canGerekirMi', v);
}

/**
 * Tembel dolumu ve saat geri düzeltmesini KAYDA yazar: `canDurumu(k, simdi)`
 * ile aynı sayı; `dolumBasi` ileri kayar (CAN_ENCOK'ta null), saat geri
 * gittiyse `dolumBasi = simdi`. Değişiklik yoksa aynı nesne döner. Uygulama
 * açılışta ve harita zamanlayıcısında çağırıp değiştiyse kaydeder (`can_doldu`
 * `neden: 'zaman'` ölçümü buradan: sayı arttıysa).
 */
export function canTazele(k: Kayit, simdi: number): Kayit {
  throw g1('canTazele', k, simdi);
}

/**
 * 1 can düşer (kayıp anında ya da onaylı çıkışta, C4). Can 0 ise aynı nesne
 * döner. CAN_ENCOK'tan düşerken `dolumBasi = simdi`; zaten dolum sürüyorsa
 * `dolumBasi` korunur (sayaç baştan başlamaz).
 * @param neden yalnız ölçüm ve okunabilirlik için; kural aynı
 */
export function canHarca(k: Kayit, simdi: number, neden: CanHarcamaNedeni): Kayit {
  throw g1('canHarca', k, simdi, neden);
}

/**
 * Devam (Usta'nın Eli ya da reklamla +5 hamle) sonrası kazanç: kayıpta giden
 * can geri gelir (+1, CAN_ENCOK'u aşmaz; C4). CAN_ENCOK'a varınca
 * `dolumBasi = null`. "Aynı denemede bir kez" kuralını oturum (G4) tutar.
 */
export function canIade(k: Kayit, simdi: number): Kayit {
  throw g1('canIade', k, simdi);
}

/**
 * `n` can ekler (n ≥ 1; reklam/Usta kartı +1 için `reklamCanKullan` kullanılır).
 * CAN_ENCOK'u aşmaz; varınca `dolumBasi = null`, aşağıda kalırsa `dolumBasi`
 * korunur. Geçersiz `n` (≤ 0, tamsayı değil) → aynı nesne.
 */
export function canEkle(k: Kayit, simdi: number, n: number): Kayit {
  throw g1('canEkle', k, simdi, n);
}

/** Canları CAN_ENCOK'a doldurur (`can_doldur` ürünü): `dolumBasi = null`. Zaten doluysa aynı nesne. */
export function canDoldur(k: Kayit, simdi: number): Kayit {
  throw g1('canDoldur', k, simdi);
}

/**
 * Bugün kalan "+1 can" reklam hakkı: `reklamGun === bugun` ise
 * REKLAM_CAN_GUNLUK − reklamSayisi, değilse REKLAM_CAN_GUNLUK (gün değişti,
 * C6). Usta kartı da aynı hakkı kullanır (C9). Can doluluğuna BAKMAZ: arayüz
 * "Yarın yine" (hak 0) ile "can dolu" (satır yok) ayrımını `canDurumu` ile yapar.
 * @param bugun yerel takvim günü yyyymmdd
 */
export function reklamCanHakki(k: Kayit, bugun: number): number {
  throw g1('reklamCanHakki', k, bugun);
}

/**
 * Reklam ödülü (`odul`) ya da Usta kartıyla +1 can: hak 1 azalır (gün
 * değiştiyse sayaç önce sıfırlanır: `reklamGun = bugun`), can +1 (tembel
 * dolumdan sonra; CAN_ENCOK'ta `dolumBasi = null`). Hak yoksa ya da can
 * doluysa aynı nesne döner ve hak harcanmaz.
 * @param simdi duvar saati ms
 * @param bugun yerel takvim günü yyyymmdd
 */
export function reklamCanKullan(k: Kayit, simdi: number, bugun: number): Kayit {
  throw g1('reklamCanKullan', k, simdi, bugun);
}

/**
 * Güçlendirici paketi şu an verilebilir mi: her güçlendirici için stok +
 * `GUCLENDIRICI_PAKETI[id]` ≤ `GUCLENDIRICI_STOK_SINIRI`. Güçlendiricinin
 * açılmış olması GEREKMEZ (C13: satın alınan stok açılmamışken de bekler).
 * false ise Mağaza paketi "Stok dolu" gösterir ve satmaz (§4).
 */
export function paketSigarMi(k: Kayit): boolean {
  throw g1('paketSigarMi', k);
}

/**
 * Başarılı satın almanın ödülünü kayda yazar (§4). Önce jeton: `gelir.jetonlar`
 * içindeyse `{ kayit: k, verildi: false, tekrar: true }`. Sonra ürün:
 *  - `can_doldur`: `canDoldur` (can zaten doluysa da jeton yazılır, verildi
 *    true: ödeme alınmıştır, satın alma tamamlanmalı; arayüz 5 canda teklif etmez);
 *  - `guclendirici_paketi`: `paketSigarMi` false ise `{ kayit: k, verildi:
 *    false, tekrar: false }`; değilse stoklara `GUCLENDIRICI_PAKETI` eklenir
 *    (açılmamış güçlendiriciye de; toza dönmez, C13);
 *  - `usta_karti`: `gelir.ustaKarti = true` (zaten varsa da jeton yazılır).
 * Verilince jeton `gelir.jetonlar` sonuna eklenir, en eski atılarak son
 * JETON_SINIRI tutulur. Boş jeton geçersizdir: `{ kayit: k, verildi: false, tekrar: false }`.
 * @param simdi duvar saati ms (can doldururken tembel dolum)
 */
export function satinAlmaUygula(k: Kayit, urun: UrunId, jeton: string, simdi: number): SatinAlmaUygulamasi {
  throw g1('satinAlmaUygula', k, urun, jeton, simdi);
}

/**
 * "Satın alımları geri yükle" (§4): sağlayıcının `geriYukle()` listesindeki
 * KALICI ürünleri verir (`usta_karti` → `gelir.ustaKarti = true`); tüketilir
 * ürünler yok sayılır, jeton yazılmaz. Değişiklik yoksa aynı nesne.
 */
export function geriYuklemeUygula(k: Kayit, urunler: readonly UrunId[]): Kayit {
  throw g1('geriYuklemeUygula', k, urunler);
}
