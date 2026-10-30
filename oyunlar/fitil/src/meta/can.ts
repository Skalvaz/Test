/**
 * Can, ödüllü reklam hakkı ve küçük satın almanın kayıt mantığı
 * (docs/CAN-REKLAM.md §2–§4, §7, §9). Saf, belirlenimli, DOM'suz; meta
 * `Date` kullanmaz: zaman ve gün parametre olarak gelir.
 *
 * SÖZLEŞME (G0), gövdeler G1. İmzalar ve buradaki JSDoc bağlayıcıdır
 * (şartname §13). Ortak kurallar:
 *
 *  - `simdi`: DUVAR SAATİ, epoch ms (`app/zaman.ts` `duvarSaati()` =
 *    `Date.now()`). `zaman.ts`'teki `simdi()` (performance.now, sayfa başına
 *    sıfırlanan monoton saat)
 *    BURADA KULLANILMAZ: `can.dolumBasi` kayda yazılır ve sayfalar/cihazlar
 *    arasında taşınır. Kesirli `simdi` aşağı yuvarlanır; geçersiz `simdi`
 *    (sonlu değil, eksi) zamana bağlı işlevlerde hiçbir şey yapmaz.
 *  - `bugun`: yerel takvim günü `yyyymmdd` (`app/zaman.ts` `bugun()`;
 *    Günün Şenliği ile aynı gün tanımı). Reklam hakkının günlük sayacı buna
 *    göre sıfırlanır. Geçersiz `bugun` hak vermez.
 *  - Kayıt alan işlevler girdiyi DEĞİŞTİRMEZ. Kayıtta değişecek bir şey
 *    yoksa aynı nesneyi döndürür; varsa yeni kopya (`kayitKopyala` gibi derin
 *    kopya). Uygulama `yeni !== eski` ile kaydedip kaydetmeyeceğine karar verebilir.
 *  - `k.can` / `k.gelir` yoksa (eski kayıt, sağlayıcısız sürümün kaydı)
 *    `varsayilanCan()` / `varsayilanGelir()` sayılır. Alan, varsayılandan
 *    farklı bir değer yazılana dek kayda EKLENMEZ: sağlayıcısız sürümün
 *    (web, claude.ai) kaydı hiç değişmez. Onarım (`kayitOnar`) var olan alanı
 *    `canOnar` / `gelirOnar` ile onarır, olmayanı eklemez.
 *  - Her kayıt işlevi önce tembel dolumu uygular (`canTazele` ile aynı
 *    hesap), sonra kendi değişikliğini yapar. Can < CAN_ENCOK iken
 *    `dolumBasi` null ise (ör. elle yamalanmış kayıt) dolum `simdi`'de başlar.
 *  - Can yalnız gelir sağlayıcısı varken vardır (C1); bu işlevler sağlayıcıyı
 *    bilmez, kapıyı uygulama (G4) tutar.
 */
import { GUCLENDIRICI_SATIN_SINIRI, GUCLENDIRICILER } from '../app/katalog';
import type { GuclendiriciId } from '../app/katalog';
import type { BolumVerisi } from '../core/types';
import type { UrunId } from '../platform/gelir';
import type { Kayit } from './kayit';
import { tarihGecerli } from './takvim';

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
/** Büyük güçlendirici paketi (§14 E2). */
export const BUYUK_PAKET: Readonly<Record<GuclendiriciId, number>> = Object.freeze({ kibrit: 6, kalip: 5, geriSar: 5 });
/** Bilinen ürünler (meta platforma değer olarak bağlanmasın diye burada; `URUN_IDLERI` ile aynı, test denetler). */
export const BILINEN_URUNLER: ReadonlySet<string> = new Set(['baslangic_paketi', 'can_doldur', 'guclendirici_paketi', 'buyuk_paket', 'usta_karti']);
/** Başlangıç paketinin güçlendiricileri (§14 E1; ayrıca canlar dolar). */
export const BASLANGIC_PAKETI: Readonly<Record<GuclendiriciId, number>> = Object.freeze({ kibrit: 3, kalip: 3, geriSar: 3 });
/** `gelir.jetonlar`'da tutulan son satın alma jetonu sayısı (çifte verme koruması). */
export const JETON_SINIRI = 50;
/**
 * Geçerli bir satın alma jetonunun en çok uzunluğu (karakter). Play Billing
 * jetonları ~150–250 karakter; sınır kaydı bozuk/kötü veriden korur. Daha uzun
 * jeton geçersizdir (`jetonGecerli`): ödül verilmez, satın alma sağlayıcıda bekler.
 */
export const JETON_EN_UZUN = 4096;

/** Geçerli duvar saatinin üst sınırı (ECMAScript `Date` en büyük değeri, ms). */
const EN_BUYUK_ZAMAN = 8.64e15;

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
  /**
   * (§14 E3) Günlük hediye sandığının kullanıldığı gün (yyyymmdd). Yoksa
   * hiç kullanılmadı (eski kayıt onarım notu üretmesin diye isteğe bağlı).
   */
  sandikGun?: number;
}

/** Kayıttaki satın alma durumu (`Kayit.gelir`). */
export interface GelirKaydi {
  /** Usta kartı (kalıcı ürün): ödüllü reklamların ödülü reklamsız (C9). */
  ustaKarti: boolean;
  /** Ödülü verilmiş son `JETON_SINIRI` satın alma jetonu (eskiden yeniye). */
  jetonlar: string[];
  /** (§14 E1) Başlangıç paketi alındı (bir kez satılır). Yoksa alınmadı. */
  baslangic?: boolean;
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

// ─────────────────────────── Onarım (kayitOnar kullanır) ───────────────────────────

const sessiz = (): void => undefined;

function nesneMi(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Aralıktaki tamsayı; kesirli/aralık dışı kırpılır, sayı değilse varsayılan (ikisi de not edilir). */
function tamsayi(x: unknown, min: number, max: number, vars: number, yol: string, not: (y: string) => void): number {
  if (typeof x === 'number' && Number.isFinite(x)) {
    const t = Math.trunc(x);
    if (t === x && t >= min && t <= max) return t;
    not(yol);
    return Math.min(max, Math.max(min, t));
  }
  not(yol);
  return vars;
}

/** Satın alma jetonu geçerli mi: boş olmayan, en çok `JETON_EN_UZUN` karakterlik metin. */
export function jetonGecerli(j: unknown): j is string {
  return typeof j === 'string' && j.trim().length > 0 && j.length <= JETON_EN_UZUN;
}

/**
 * Kayıttaki `can` alanının onarımı (`kayitOnar`; alan VARSA çağrılır). Nesne
 * değilse varsayılan. `sayi` 0..CAN_ENCOK tamsayı (eksikse CAN_ENCOK: bozuk
 * kayıt can kaybettirmez); `dolumBasi` null ya da 0..8,64e15 tamsayı ms;
 * can doluyken `dolumBasi` null; `reklamGun` 0 ya da geçerli yyyymmdd;
 * `reklamSayisi` 0..REKLAM_CAN_GUNLUK, `reklamGun` 0 iken 0. Can < CAN_ENCOK
 * iken `dolumBasi` null kalabilir (zaman bilinmez; tembel dolum `simdi`'de
 * başlatır). Bilinmeyen alt alanlar atılır. Onarılmış değer yeniden onarım gerektirmez.
 */
export function canOnar(ham: unknown, not: (yol: string) => void = sessiz): CanKaydi {
  const v = varsayilanCan();
  if (!nesneMi(ham)) {
    not('can');
    return v;
  }
  v.sayi = tamsayi(ham.sayi, 0, CAN_ENCOK, CAN_ENCOK, 'can.sayi', not);
  if (ham.dolumBasi === null) v.dolumBasi = null;
  else if (typeof ham.dolumBasi === 'number' && Number.isFinite(ham.dolumBasi) && ham.dolumBasi >= 0 && ham.dolumBasi <= EN_BUYUK_ZAMAN) {
    v.dolumBasi = Math.floor(ham.dolumBasi);
    if (v.dolumBasi !== ham.dolumBasi) not('can.dolumBasi');
  } else not('can.dolumBasi');
  if (v.sayi >= CAN_ENCOK && v.dolumBasi !== null) {
    v.dolumBasi = null;
    not('can.dolumBasi');
  }
  if (ham.reklamGun === 0 || tarihGecerli(ham.reklamGun)) v.reklamGun = ham.reklamGun as number;
  else not('can.reklamGun');
  v.reklamSayisi = tamsayi(ham.reklamSayisi, 0, REKLAM_CAN_GUNLUK, 0, 'can.reklamSayisi', not);
  if (v.reklamGun === 0 && v.reklamSayisi !== 0) {
    v.reklamSayisi = 0;
    not('can.reklamSayisi');
  }
  if (ham.sandikGun !== undefined) {
    if (tarihGecerli(ham.sandikGun)) v.sandikGun = ham.sandikGun as number;
    else not('can.sandikGun');
  }
  return v;
}

/**
 * Kayıttaki `gelir` alanının onarımı (`kayitOnar`; alan VARSA çağrılır).
 * Nesne değilse varsayılan. `ustaKarti` mantıksal (değilse false);
 * `jetonlar` geçerli (`jetonGecerli`), tekrarsız, sırası korunur ve en çok
 * son JETON_SINIRI tutulur. Bilinmeyen alt alanlar atılır.
 */
export function gelirOnar(ham: unknown, not: (yol: string) => void = sessiz): GelirKaydi {
  const v = varsayilanGelir();
  if (!nesneMi(ham)) {
    not('gelir');
    return v;
  }
  if (typeof ham.ustaKarti === 'boolean') v.ustaKarti = ham.ustaKarti;
  else not('gelir.ustaKarti');
  if (Array.isArray(ham.jetonlar)) {
    const gorulen = new Set<string>();
    for (const j of ham.jetonlar) {
      if (jetonGecerli(j) && !gorulen.has(j)) {
        gorulen.add(j);
        v.jetonlar.push(j);
      } else not('gelir.jetonlar');
    }
    if (v.jetonlar.length > JETON_SINIRI) {
      v.jetonlar = v.jetonlar.slice(-JETON_SINIRI);
      not('gelir.jetonlar');
    }
  } else not('gelir.jetonlar');
  if (ham.baslangic !== undefined) {
    if (typeof ham.baslangic === 'boolean') {
      if (ham.baslangic) v.baslangic = true;
    } else not('gelir.baslangic');
  }
  return v;
}

/**
 * Bulut + tarayıcı birleştirmesinde gelir (`kancaBirlestir`; şartname §13
 * "Ürün sahibine" önerisi): Usta kartı VEYA (kalıcı ürün hiçbir kayıttan
 * düşmesin), jetonlar birleşimi (kazananınkiler sırasıyla, sonra öbürünün
 * eksikleri; son JETON_SINIRI). İki kayıtta da alan yoksa ve sonuç
 * varsayılansa `undefined` (alan eklenmez). Can birleştirilmez: seçilen kaydınki kalır.
 */
export function gelirBirlestir(kazanan: Pick<Kayit, 'gelir'>, diger: Partial<Pick<Kayit, 'gelir'>>): GelirKaydi | undefined {
  const a = kazanan.gelir === undefined ? varsayilanGelir() : gelirOnar(kazanan.gelir);
  const b = diger.gelir === undefined ? varsayilanGelir() : gelirOnar(diger.gelir);
  const kume = new Set(a.jetonlar);
  const y: GelirKaydi = {
    ustaKarti: a.ustaKarti || b.ustaKarti,
    jetonlar: [...a.jetonlar, ...b.jetonlar.filter((j) => !kume.has(j))].slice(-JETON_SINIRI),
  };
  if (a.baslangic || b.baslangic) y.baslangic = true;
  if (kazanan.gelir === undefined && !y.ustaKarti && y.jetonlar.length === 0) return undefined;
  return y;
}

// ─────────────────────────── İç yardımcılar ───────────────────────────

/** Duvar saati kullanılabilir mi (sonlu, 0..Date tavanı). */
function saatGecerli(simdi: number): boolean {
  return typeof simdi === 'number' && Number.isFinite(simdi) && simdi >= 0 && simdi <= EN_BUYUK_ZAMAN;
}

/** Kayıttaki can (yoksa varsayılan; varsa onarılmış değer: elle yamalanmış kayda karşı savunma). */
function canOku(k: Kayit): CanKaydi {
  return k.can === undefined ? varsayilanCan() : canOnar(k.can);
}

function gelirOku(k: Kayit): GelirKaydi {
  return k.gelir === undefined ? varsayilanGelir() : gelirOnar(k.gelir);
}

/**
 * Tembel dolum (§2): can < CAN_ENCOK iken `dolumBasi`'ndan bu yana geçen her
 * tam CAN_DOLUM_MS +1 can ve `dolumBasi` o kadar ileri; CAN_ENCOK'ta null.
 * Saat geri gittiyse (t < dolumBasi) ya da dolum başlamamışsa `dolumBasi = t`.
 * Değişiklik yoksa aynı nesne.
 */
function dolum(c: CanKaydi, simdi: number): CanKaydi {
  if (c.sayi >= CAN_ENCOK) return c.dolumBasi === null ? c : { ...c, dolumBasi: null };
  if (!saatGecerli(simdi)) return c;
  const t = Math.floor(simdi);
  if (c.dolumBasi === null || t < c.dolumBasi) return { ...c, dolumBasi: t };
  const n = Math.floor((t - c.dolumBasi) / CAN_DOLUM_MS);
  if (n <= 0) return c;
  if (c.sayi + n >= CAN_ENCOK) return { ...c, sayi: CAN_ENCOK, dolumBasi: null };
  return { ...c, sayi: c.sayi + n, dolumBasi: c.dolumBasi + n * CAN_DOLUM_MS };
}

function canEsit(a: CanKaydi, b: CanKaydi): boolean {
  return a.sayi === b.sayi && a.dolumBasi === b.dolumBasi && a.reklamGun === b.reklamGun && a.reklamSayisi === b.reklamSayisi && a.sandikGun === b.sandikGun;
}

/** Derin kopya (`kayitKopyala` ile aynı; kayit.ts bu modülü içe aktardığı için döngü kurulmasın diye burada). */
function kopya(k: Kayit): Kayit {
  return JSON.parse(JSON.stringify(k)) as Kayit;
}

/**
 * Yeni can değerini kayda yazar: kayıttakiyle aynıysa (alan yokken
 * varsayılanla aynıysa) aynı nesne, değilse derin kopya.
 */
function canYaz(k: Kayit, c: CanKaydi): Kayit {
  const eski = k.can;
  if (eski === undefined ? canEsit(c, varsayilanCan()) : nesneMi(eski) && canEsit(eski as CanKaydi, c)) return k;
  const y = kopya(k);
  y.can = { ...c };
  return y;
}

/** `canYaz`'ın yerinde biçimi (yalnız bu modülün yeni kopyası üzerinde): varsayılan can yoksa eklenmez. */
function canAta_yerinde(y: Kayit, c: CanKaydi): void {
  if (y.can === undefined && canEsit(c, varsayilanCan())) return;
  y.can = { ...c };
}

/** Can'a `n` ekler (CAN_ENCOK'u aşmaz; varınca dolumBasi null). */
function ekle(c: CanKaydi, n: number): CanKaydi {
  if (c.sayi >= CAN_ENCOK) return c;
  const sayi = Math.min(CAN_ENCOK, c.sayi + n);
  return { ...c, sayi, dolumBasi: sayi >= CAN_ENCOK ? null : c.dolumBasi };
}

function stok(k: Kayit, id: GuclendiriciId): number {
  const s = k.guclendiriciler?.[id];
  return typeof s === 'number' && Number.isFinite(s) ? s : 0;
}

// ─────────────────────────── İşlevler ───────────────────────────

/**
 * Okuma: tembel dolumu uygulayarak can durumunu döndürür (kaydı değiştirmez).
 * Kurallar (§2): can < CAN_ENCOK iken `dolumBasi`'ndan bu yana geçen her tam
 * `CAN_DOLUM_MS` +1; CAN_ENCOK'ta durur (`sonrakiMs` null). Saat geri gittiyse
 * (simdi < dolumBasi) dolum `simdi`'den başlamış sayılır: eksi süre ve ceza
 * yok, `sonrakiMs` = CAN_DOLUM_MS.
 * @param simdi duvar saati ms (`Date.now()`)
 */
export function canDurumu(k: Kayit, simdi: number): CanDurumu {
  const c = dolum(canOku(k), simdi);
  let sonrakiMs: number | null = null;
  if (c.sayi < CAN_ENCOK) {
    sonrakiMs = CAN_DOLUM_MS;
    if (c.dolumBasi !== null && saatGecerli(simdi)) sonrakiMs = Math.min(CAN_DOLUM_MS, Math.max(1, c.dolumBasi + CAN_DOLUM_MS - Math.floor(simdi)));
  }
  return { sayi: c.sayi, enCok: CAN_ENCOK, sonrakiMs };
}

/**
 * Bölüm can harcıyor mu (C3): ana bölüm (`tur` öğretim, tanıtım, normal,
 * zor, rahatlama, final) ve `id` > CAN_UCRETSIZ_SON_BOLUM, ya da Usta Bölümü
 * (`tur` 'usta'). Günün Şenliği ('gunluk') ve Sonsuz Şenlik ('sonsuz')
 * ücretsiz. Sağlayıcı yokken uygulama bunu hiç sormaz (C1).
 */
export function canGerekirMi(v: Pick<BolumVerisi, 'tur' | 'id'>): boolean {
  switch (v.tur) {
    case 'usta':
      return true;
    case 'gunluk':
    case 'sonsuz':
      return false;
    case 'ogretim':
    case 'tanitim':
    case 'normal':
    case 'zor':
    case 'rahatlama':
    case 'final':
      return v.id > CAN_UCRETSIZ_SON_BOLUM;
    default:
      // Bilinmeyen tür (ileriki sürüm): can istenmez (oyun kilitlenmesin).
      return false;
  }
}

/**
 * Tembel dolumu ve saat geri düzeltmesini KAYDA yazar: `canDurumu(k, simdi)`
 * ile aynı sayı; `dolumBasi` ileri kayar (CAN_ENCOK'ta null), saat geri
 * gittiyse `dolumBasi = simdi`. Değişiklik yoksa aynı nesne döner. Uygulama
 * açılışta ve harita zamanlayıcısında çağırıp değiştiyse kaydeder (`can_doldu`
 * `neden: 'zaman'` ölçümü buradan: sayı arttıysa).
 */
export function canTazele(k: Kayit, simdi: number): Kayit {
  if (!saatGecerli(simdi)) return k;
  return canYaz(k, dolum(canOku(k), simdi));
}

/**
 * 1 can düşer (kayıp anında ya da onaylı çıkışta, C4). Can 0 ise aynı nesne
 * döner. CAN_ENCOK'tan düşerken `dolumBasi = simdi`; zaten dolum sürüyorsa
 * `dolumBasi` korunur (sayaç baştan başlamaz).
 * @param neden yalnız ölçüm ve okunabilirlik için; kural aynı
 */
export function canHarca(k: Kayit, simdi: number, neden: CanHarcamaNedeni): Kayit {
  void neden;
  if (!saatGecerli(simdi)) return k;
  const c = dolum(canOku(k), simdi);
  // Can 0: harcanacak can yok; yalnız (varsa) dolum düzeltmesi yazılır.
  if (c.sayi <= 0) return canYaz(k, c);
  return canYaz(k, { ...c, sayi: c.sayi - 1, dolumBasi: c.dolumBasi ?? Math.floor(simdi) });
}

/**
 * Devam (Usta'nın Eli ya da reklamla +5 hamle) sonrası kazanç: kayıpta giden
 * can geri gelir (+1, CAN_ENCOK'u aşmaz; C4). CAN_ENCOK'a varınca
 * `dolumBasi = null`. "Aynı denemede bir kez" kuralını oturum (G4) tutar.
 */
export function canIade(k: Kayit, simdi: number): Kayit {
  return canEkle(k, simdi, 1);
}

/**
 * `n` can ekler (n ≥ 1; reklam/Usta kartı +1 için `reklamCanKullan` kullanılır).
 * CAN_ENCOK'u aşmaz; varınca `dolumBasi = null`, aşağıda kalırsa `dolumBasi`
 * korunur. Geçersiz `n` (≤ 0, tamsayı değil) → aynı nesne.
 */
export function canEkle(k: Kayit, simdi: number, n: number): Kayit {
  if (!Number.isInteger(n) || n < 1 || !saatGecerli(simdi)) return k;
  return canYaz(k, ekle(dolum(canOku(k), simdi), n));
}

/**
 * Canları CAN_ENCOK'a doldurur (`can_doldur` ürünü): `dolumBasi = null`. Zaten doluysa aynı nesne.
 * Sonuç zamandan bağımsız olduğundan geçersiz `simdi` ile de doldurur (ödeme alınmıştır).
 */
export function canDoldur(k: Kayit, simdi: number): Kayit {
  void simdi;
  return canYaz(k, { ...canOku(k), sayi: CAN_ENCOK, dolumBasi: null });
}

/**
 * Bugün kalan "+1 can" reklam hakkı: `reklamGun === bugun` ise
 * REKLAM_CAN_GUNLUK − reklamSayisi, değilse REKLAM_CAN_GUNLUK (gün değişti,
 * C6). Usta kartı da aynı hakkı kullanır (C9). Can doluluğuna BAKMAZ: arayüz
 * "Yarın yine" (hak 0) ile "can dolu" (satır yok) ayrımını `canDurumu` ile yapar.
 * @param bugun yerel takvim günü yyyymmdd
 */
export function reklamCanHakki(k: Kayit, bugun: number): number {
  if (!tarihGecerli(bugun)) return 0;
  const c = canOku(k);
  return c.reklamGun === bugun ? Math.max(0, REKLAM_CAN_GUNLUK - c.reklamSayisi) : REKLAM_CAN_GUNLUK;
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
  if (!saatGecerli(simdi) || !tarihGecerli(bugun)) return k;
  const c = dolum(canOku(k), simdi);
  const kullanilan = c.reklamGun === bugun ? c.reklamSayisi : 0;
  if (kullanilan >= REKLAM_CAN_GUNLUK || c.sayi >= CAN_ENCOK) return canYaz(k, c);
  return canYaz(k, { ...ekle(c, 1), reklamGun: bugun, reklamSayisi: kullanilan + 1 });
}

/**
 * Güçlendirici paketi şu an verilebilir mi: her güçlendirici için stok +
 * `GUCLENDIRICI_PAKETI[id]` ≤ `GUCLENDIRICI_SATIN_SINIRI` (9; hediye sınırı 3 değil). Güçlendiricinin
 * açılmış olması GEREKMEZ (C13: satın alınan stok açılmamışken de bekler).
 * false ise Mağaza paketi "Stok dolu" gösterir ve satmaz (§4).
 */
export function paketSigarMi(k: Kayit, paket: Readonly<Record<GuclendiriciId, number>> = GUCLENDIRICI_PAKETI): boolean {
  return GUCLENDIRICILER.every((g) => stok(k, g.id) + paket[g.id] <= GUCLENDIRICI_SATIN_SINIRI);
}

/** Ürünün güçlendirici içeriği (yoksa `null`). */
export function urunPaketi(urun: UrunId): Readonly<Record<GuclendiriciId, number>> | null {
  return urun === 'guclendirici_paketi' ? GUCLENDIRICI_PAKETI : urun === 'buyuk_paket' ? BUYUK_PAKET : urun === 'baslangic_paketi' ? BASLANGIC_PAKETI : null;
}

/** (§14 E1) Başlangıç paketi daha önce alındı mı (bir kez satılır). */
export function baslangicAlindi(k: Kayit): boolean {
  return gelirOku(k).baslangic === true;
}

/** (§14 E3) Günlük hediye sandığı bugün kullanılabilir mi. */
export function hediyeSandikHakki(k: Kayit, bugun: number): boolean {
  return canOku(k).sandikGun !== bugun;
}

/** (§14 E3) Günlük hediye sandığını bugün kullanılmış yazar (sandığı çağıran açar). */
export function hediyeSandikKullan(k: Kayit, bugun: number): Kayit {
  if (!tarihGecerli(bugun) || !hediyeSandikHakki(k, bugun)) return k;
  const y = kopya(k);
  canAta_yerinde(y, { ...canOku(y), sandikGun: bugun });
  return y;
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
 * JETON_SINIRI tutulur. Boş jeton geçersizdir: `{ kayit: k, verildi: false, tekrar: false }`
 * (`jetonGecerli`: boş, yalnız boşluk ya da JETON_EN_UZUN'dan uzun). Bilinmeyen ürün de öyle.
 * @param simdi duvar saati ms (tembel dolum; geçersizse dolum atlanır, ödül yine verilir)
 */
export function satinAlmaUygula(k: Kayit, urun: UrunId, jeton: string, simdi: number): SatinAlmaUygulamasi {
  const verilemez: SatinAlmaUygulamasi = { kayit: k, verildi: false, tekrar: false };
  if (!jetonGecerli(jeton)) return verilemez;
  const g = gelirOku(k);
  if (g.jetonlar.includes(jeton)) return { kayit: k, verildi: false, tekrar: true };
  if (!BILINEN_URUNLER.has(urun)) return verilemez;
  const paket = urunPaketi(urun);
  if (paket && !paketSigarMi(k, paket)) return verilemez;
  // Başlangıç paketi bir kez verilir; yine de ödenmişse (iki cihaz) tamamlanmalı: tekrar sayılır.
  if (urun === 'baslangic_paketi' && g.baslangic) return { kayit: k, verildi: false, tekrar: true };
  const temel = canTazele(k, simdi);
  const y = temel === k ? kopya(k) : temel;
  switch (urun) {
    case 'can_doldur':
    case 'baslangic_paketi':
      canAta_yerinde(y, { ...canOku(y), sayi: CAN_ENCOK, dolumBasi: null });
      break;
    default:
      break;
  }
  if (paket) for (const gc of GUCLENDIRICILER) y.guclendiriciler[gc.id] = stok(y, gc.id) + paket[gc.id];
  y.gelir = {
    ustaKarti: g.ustaKarti || urun === 'usta_karti',
    jetonlar: [...g.jetonlar, jeton].slice(-JETON_SINIRI),
  };
  if (g.baslangic || urun === 'baslangic_paketi') y.gelir.baslangic = true;
  return { kayit: y, verildi: true, tekrar: false };
}

/**
 * "Satın alımları geri yükle" (§4): sağlayıcının `geriYukle()` listesindeki
 * KALICI ürünleri verir (`usta_karti` → `gelir.ustaKarti = true`); tüketilir
 * ürünler yok sayılır, jeton yazılmaz. Değişiklik yoksa aynı nesne.
 * (`simdi` almadığı için tembel dolum uygulanmaz; can'a dokunmaz.)
 */
export function geriYuklemeUygula(k: Kayit, urunler: readonly UrunId[]): Kayit {
  const g = gelirOku(k);
  // Kalıcı ürün yalnız Usta kartı (platform/gelir.ts URUN_TURLERI; test denetler).
  const ustaKarti = g.ustaKarti || urunler.some((u) => u === 'usta_karti');
  if (ustaKarti === g.ustaKarti) return k;
  const y = kopya(k);
  y.gelir = { ...g, ustaKarti };
  return y;
}
