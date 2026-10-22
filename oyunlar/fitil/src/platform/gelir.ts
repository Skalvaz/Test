/**
 * Gelir sağlayıcısı (docs/CAN-REKLAM.md §5): ödüllü reklam ve küçük satın
 * alma için sağlayıcıdan bağımsız arayüz. Sağlayıcı yoksa (`null`) can
 * sistemi ve bütün gelir arayüzü kapalıdır (C1: claude.ai sayfası ve tek
 * dosya `fitil.html`).
 *
 * Türler şartname §5'le birebir (G0). G2: sağlayıcı seçimi
 * (`gelirSaglayici`, sayfa başına bir kez), Android köprü sarmalayıcısı
 * (`androidSaglayici`: JSON çözer, hiçbir durumda fırlatmaz), ölçüm
 * sarmalayıcısı (`olculenSaglayici`: `reklam_sonuc`, `satin_alma`). Sahte
 * sağlayıcı (web denemesi, `?gelir=sahte`) `gelirSahte.ts`'te.
 */
import { gelirOlayi, type OlcumGelirOlayi, type OlcumGelirOzellikleri } from './olcum';
import { sahteAyarlari, sahteSaglayici } from './gelirSahte';

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
 * `window.FitilYerel.gelir`. JSON dönen yöntemleri `androidSaglayici`
 * çözer; beklenmeyen değerde 'hata' (ya da boş liste) döner, oyunu hiçbir
 * durumda durdurmaz.
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

// ─────────────────────────── Çözümleyiciler (saf) ───────────────────────────

const REKLAM_SONUCLARI: ReadonlySet<string> = new Set<ReklamSonucu>(['odul', 'iptal', 'yok', 'hata']);
const URUN_KUMESI: ReadonlySet<string> = new Set<string>(URUN_IDLERI);
/** Köprüden gelen metinlerin üst sınırı (bozuk köprü arayüzü taşırmasın). */
const FIYAT_SINIRI = 32;
const JETON_UZUNLUK_SINIRI = 4096;

/** Bilinen ürün kimliği mi. */
export function urunIdMi(x: unknown): x is UrunId {
  return typeof x === 'string' && URUN_KUMESI.has(x);
}

/** Köprü yanıtı: metinse JSON çözülür (bozuksa `undefined`), değilse olduğu gibi (eklenti nesne de dönebilir). */
function jsonCoz(x: unknown): unknown {
  if (typeof x !== 'string') return x;
  try {
    return JSON.parse(x) as unknown;
  } catch {
    return undefined;
  }
}

const nesneMi = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const jetonMu = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= JETON_UZUNLUK_SINIRI;
const magazaSirasi = (a: UrunId, b: UrunId) => URUN_IDLERI.indexOf(a) - URUN_IDLERI.indexOf(b);

/** Köprünün reklam sonucu; tanınmayan her değer 'hata'. */
export function reklamSonucuCoz(x: unknown): ReklamSonucu {
  const s = typeof x === 'string' ? x.trim() : '';
  return REKLAM_SONUCLARI.has(s) ? (s as ReklamSonucu) : 'hata';
}

/** Köprünün ürün listesi (JSON `Urun[]`): geçersiz öğeler atlanır, tekrarlar tekilleşir, Mağaza sırası. */
export function urunlerCoz(x: unknown): Urun[] {
  const v = jsonCoz(x);
  if (!Array.isArray(v)) return [];
  const gorulen = new Set<UrunId>();
  const sonuc: Urun[] = [];
  for (const o of v) {
    if (!nesneMi(o) || !urunIdMi(o.id) || gorulen.has(o.id) || typeof o.fiyat !== 'string') continue;
    const fiyat = o.fiyat.trim().slice(0, FIYAT_SINIRI);
    if (!fiyat) continue;
    gorulen.add(o.id);
    sonuc.push({ id: o.id, fiyat });
  }
  return sonuc.sort((a, b) => magazaSirasi(a.id, b.id));
}

/**
 * Köprünün satın alma sonucu (JSON `SatinAlmaSonucu`). Başarılı sayılması
 * için bilinen ürün ve boş olmayan jeton şart; değilse 'hata' (ödenmiş ama
 * çözülemeyen satın alma onaylanmadığı için `bekleyenler()`'de kalır).
 */
export function satinAlmaCoz(x: unknown): SatinAlmaSonucu {
  const v = jsonCoz(x);
  if (!nesneMi(v)) return { durum: 'hata' };
  if (v.durum === 'basarili') return urunIdMi(v.urun) && jetonMu(v.jeton) ? { durum: 'basarili', urun: v.urun, jeton: v.jeton } : { durum: 'hata' };
  if (v.durum === 'iptal' || v.durum === 'beklemede' || v.durum === 'hata') return { durum: v.durum };
  return { durum: 'hata' };
}

/** Köprünün bekleyen satın almaları (JSON `{ urun, jeton }[]`): geçersizler atlanır, jetona göre tekil. */
export function bekleyenlerCoz(x: unknown): { urun: UrunId; jeton: string }[] {
  const v = jsonCoz(x);
  if (!Array.isArray(v)) return [];
  const gorulen = new Set<string>();
  const sonuc: { urun: UrunId; jeton: string }[] = [];
  for (const o of v) {
    if (!nesneMi(o) || !urunIdMi(o.urun) || !jetonMu(o.jeton) || gorulen.has(o.jeton)) continue;
    gorulen.add(o.jeton);
    sonuc.push({ urun: o.urun, jeton: o.jeton });
  }
  return sonuc;
}

/** Köprünün geri yükleme listesi (JSON `UrunId[]`): yalnız bilinen KALICI ürünler, tekil, Mağaza sırası. */
export function geriYukleCoz(x: unknown): UrunId[] {
  const v = jsonCoz(x);
  if (!Array.isArray(v)) return [];
  const kume = new Set<UrunId>();
  for (const id of v) if (urunIdMi(id) && URUN_TURLERI[id] === 'kalici') kume.add(id);
  return [...kume].sort(magazaSirasi);
}

// ─────────────────────────── Güvenli çağrı ───────────────────────────

/**
 * `is()`'i çağırır; fırlatırsa, reddederse ya da `ms` içinde bitmezse
 * `yedek` döner. Hiçbir durumda reddetmez. `ms` sonsuzsa süre sınırı yok.
 */
function sureli<T>(is: () => T | PromiseLike<T>, ms: number, yedek: T): Promise<T> {
  return new Promise<T>((coz) => {
    let bitti = false;
    let zaman: ReturnType<typeof setTimeout> | null = null;
    const son = (x: T) => {
      if (bitti) return;
      bitti = true;
      if (zaman !== null) clearTimeout(zaman);
      coz(x);
    };
    if (Number.isFinite(ms)) zaman = setTimeout(() => son(yedek), ms);
    try {
      Promise.resolve(is()).then(son, () => son(yedek));
    } catch {
      son(yedek);
    }
  });
}

// ─────────────────────────── Android köprü sarmalayıcısı (§5.1) ───────────────────────────

/**
 * Köprü çağrılarının süre sınırları (ms). Köprü yanıt vermezse oyun beklemede
 * kalmasın: reklam ve satın alma oyuncunun yerel ekranda geçirdiği süreyi
 * kapsar (sınır aşılınca 'hata'; ödenmiş satın alma onaylanmadığı için
 * sonraki açılışta `bekleyenler()`'den gelir), öbürleri kısa.
 */
export interface KopruSureleri {
  reklam: number;
  satin: number;
  kisa: number;
}
export const KOPRU_SURELERI: Readonly<KopruSureleri> = Object.freeze({ reklam: 3 * 60_000, satin: 10 * 60_000, kisa: 15_000 });

/**
 * Android köprüsünü (`window.FitilYerel.gelir`) `GelirSaglayici`'ya çevirir:
 * JSON yanıtları çözer, her beklenmeyen değerde ya da hatada 'hata' / boş
 * liste döner; hiçbir yöntem fırlatmaz ya da reddetmez.
 */
export function androidSaglayici(kopru: AndroidGelirKoprusu, sure: Readonly<KopruSureleri> = KOPRU_SURELERI): GelirSaglayici {
  return {
    ad: 'android',
    reklamHazir(yer) {
      try {
        return kopru.reklamHazir(yer) === true;
      } catch {
        return false;
      }
    },
    async reklamGoster(yer) {
      return reklamSonucuCoz(await sureli<unknown>(() => kopru.reklamGoster(yer), sure.reklam, 'hata'));
    },
    async urunler() {
      return urunlerCoz(await sureli<unknown>(() => kopru.urunler(), sure.kisa, undefined));
    },
    async satinAl(id) {
      if (!urunIdMi(id)) return { durum: 'hata' };
      return satinAlmaCoz(await sureli<unknown>(() => kopru.satinAl(id), sure.satin, undefined));
    },
    async tamamla(jeton) {
      if (!jetonMu(jeton)) return;
      await sureli<unknown>(() => kopru.tamamla(jeton), sure.kisa, undefined);
    },
    async bekleyenler() {
      return bekleyenlerCoz(await sureli<unknown>(() => kopru.bekleyenler(), sure.kisa, undefined));
    },
    async geriYukle() {
      return geriYukleCoz(await sureli<unknown>(() => kopru.geriYukle(), sure.kisa, undefined));
    },
  };
}

// ─────────────────────────── Ölçüm sarmalayıcısı (§8) ───────────────────────────

/** Gelir olayı yazıcısı (varsayılan `gelirOlayi`; testler kendi dizisine yazar). */
export type GelirOlayYazici = <A extends OlcumGelirOlayi>(ad: A, p: OlcumGelirOzellikleri[A]) => void;

/**
 * Sağlayıcıyı ölçümle sarar (docs/OLCUM.md §8). Yazdığı olaylar:
 *  - `reklam_sonuc` { yer, sonuc, kart: false }: her `reklamGoster` sonunda;
 *  - `satin_alma` { urun, durum: 'basla' }: `satinAl` başında, sonra sonucun
 *    durumuyla (basarili, iptal, beklemede, hata);
 *  - `satin_alma` { urun, durum: 'geri_yukle' }: `geriYukle`'nin döndürdüğü
 *    her kalıcı ürün için.
 * Uygulama (G4) bu olayları YENİDEN yazmaz; `reklam_teklif`, Usta kartıyla
 * reklamsız ödül (`reklam_sonuc` kart: true) ve `can_*` olayları uygulamanın.
 * `bekleyenler()` ölçülmez (her açılışta aynı satın alma yeniden gelebilir).
 * İç sağlayıcı fırlatsa da sarmalayıcı fırlatmaz; yanıtları köprüdeki
 * çözümleyicilerden geçirir (sözleşme dışı değer 'hata' / boş liste).
 */
export function olculenSaglayici(s: GelirSaglayici, olay: GelirOlayYazici = gelirOlayi): GelirSaglayici {
  const yaz: GelirOlayYazici = (ad, p) => {
    try {
      olay(ad, p);
    } catch {
      /* ölçüm oyunu durdurmaz */
    }
  };
  return {
    ad: s.ad,
    reklamHazir(yer) {
      try {
        return s.reklamHazir(yer) === true;
      } catch {
        return false;
      }
    },
    async reklamGoster(yer) {
      const sonuc = reklamSonucuCoz(await sureli<unknown>(() => s.reklamGoster(yer), Infinity, 'hata'));
      yaz('reklam_sonuc', { yer, sonuc, kart: false });
      return sonuc;
    },
    async urunler() {
      return urunlerCoz(await sureli<unknown>(() => s.urunler(), Infinity, []));
    },
    async satinAl(id) {
      yaz('satin_alma', { urun: id, durum: 'basla' });
      const r = satinAlmaCoz(await sureli<unknown>(() => s.satinAl(id), Infinity, undefined));
      yaz('satin_alma', { urun: r.durum === 'basarili' ? r.urun : id, durum: r.durum });
      return r;
    },
    tamamla: (jeton) => sureli<void>(() => s.tamamla(jeton), Infinity, undefined),
    async bekleyenler() {
      return bekleyenlerCoz(await sureli<unknown>(() => s.bekleyenler(), Infinity, []));
    },
    async geriYukle() {
      const liste = geriYukleCoz(await sureli<unknown>(() => s.geriYukle(), Infinity, []));
      for (const urun of liste) yaz('satin_alma', { urun, durum: 'geri_yukle' });
      return liste;
    },
  };
}

// ─────────────────────────── Seçim ───────────────────────────

/** Deneme için sahte sağlayıcıyı açan cihaz anahtarı (`localStorage` `fitil.gelir` = `sahte`). */
export const GELIR_DEPO_ANAHTARI = 'fitil.gelir';

/** Seçimin girdileri (sayfadan `sayfaGirdisi()`; testler elle verir). */
export interface GelirSecimGirdisi {
  /** `window.FitilYerel?.gelir` (Android köprüsü; yoksa undefined). */
  kopru: unknown;
  /** Adres sorgusu (`location.search`). */
  adres: string;
  /** `localStorage` `fitil.gelir` değeri. */
  depo: string | null;
}

export type GelirSecimi = 'android' | 'sahte' | null;

/**
 * Hangi sağlayıcı (§5): Android köprüsü varsa 'android'; yoksa adreste
 * `?gelir=sahte` → 'sahte', `?gelir=yok` → null (cihaz anahtarını bu sayfa
 * için kapatır); yoksa cihaz anahtarı `fitil.gelir` = `sahte` → 'sahte';
 * aksi halde null.
 */
export function gelirSecimi(g: GelirSecimGirdisi): GelirSecimi {
  if (g.kopru !== null && (typeof g.kopru === 'object' || typeof g.kopru === 'function')) return 'android';
  let p: string | null = null;
  try {
    p = new URLSearchParams(g.adres).get('gelir');
  } catch {
    /* adres okunamadı */
  }
  if (p === 'sahte') return 'sahte';
  if (p === 'yok') return null;
  return g.depo === 'sahte' ? 'sahte' : null;
}

/** Sayfanın seçim girdileri (her erişim try/catch: WhatsApp içi tarayıcı, kapalı depolama). */
export function sayfaGirdisi(): GelirSecimGirdisi {
  const g: GelirSecimGirdisi = { kopru: undefined, adres: '', depo: null };
  if (typeof window === 'undefined') return g;
  try {
    g.kopru = window.FitilYerel?.gelir;
  } catch {
    /* köprü okunamadı */
  }
  try {
    g.adres = window.location.search;
  } catch {
    /* adres okunamadı */
  }
  try {
    g.depo = window.localStorage.getItem(GELIR_DEPO_ANAHTARI);
  } catch {
    /* depolama kapalı */
  }
  return g;
}

/**
 * Girdilere göre YENİ bir sağlayıcı kurar (ölçüm sarmalı) ya da null.
 * Uygulama bunu değil, önbellekli `gelirSaglayici()`'yı kullanır.
 */
export function gelirSaglayiciKur(g: GelirSecimGirdisi, olay: GelirOlayYazici = gelirOlayi): GelirSaglayici | null {
  switch (gelirSecimi(g)) {
    case 'android':
      return olculenSaglayici(androidSaglayici(g.kopru as AndroidGelirKoprusu), olay);
    case 'sahte':
      return olculenSaglayici(sahteSaglayici(sahteAyarlari(g.adres)), olay);
    default:
      return null;
  }
}

let secilen: { s: GelirSaglayici | null } | null = null;

/**
 * Sağlayıcı yoksa null: can sistemi ve bütün gelir arayüzü kapalı.
 *
 * Seçim `gelirSecimi` (§5): `window.FitilYerel?.gelir` varsa Android
 * köprüsü; `?gelir=sahte` (ya da `localStorage` `fitil.gelir` = `sahte`)
 * sahte sağlayıcı; aksi halde null. Sayfa başına BİR KEZ seçilir, sonraki
 * çağrılar aynı örneği (ya da null'u) döndürür. Dönen sağlayıcı ölçüm
 * sarmalıdır (`olculenSaglayici`).
 */
export function gelirSaglayici(): GelirSaglayici | null {
  if (!secilen) {
    let s: GelirSaglayici | null = null;
    try {
      s = gelirSaglayiciKur(sayfaGirdisi());
    } catch {
      s = null;
    }
    secilen = { s };
  }
  return secilen.s;
}
