/**
 * Google Play Billing ile küçük satın alma — docs/ANDROID.md §3,
 * docs/CAN-REKLAM.md §4, §5.1. `@capgo/native-purchases` 8.9.2 üstünde.
 *
 * Kurallar:
 *  - Bütün ürünler `inapp`. Satın alma `autoAcknowledgePurchases: false`,
 *    `isConsumable: false`: eklenti hiçbir şeyi kendiliğinden onaylamaz ya da
 *    tüketmez; oyun ödülü kayda yazdıktan SONRA `tamamla(jeton)` tüketilir
 *    üründe `consumePurchase`, kalıcıda `acknowledgePurchase` çağırır.
 *    Ayrıca eklentinin `autoFinishTransactions`'ı kapatılır (yoksa
 *    `restorePurchases` ödülü verilmemiş alımları da onaylardı;
 *    `capacitor.config.ts` ve açılışta `configure`).
 *  - Sıra: eklentinin her çağrısı yeni bir BillingClient kurup öncekini
 *    kapatır; aynı anda iki çağrı (açılışta fiyatlar + bekleyenler, ödeme
 *    akışı sürerken Mağaza'nın fiyat tazelemesi) birbirinin bağlantısını
 *    keserdi. Bu yüzden bütün çağrılar tek kuyrukta, sırayla gider (kuyruk
 *    yanıt vermeyen çağrıda süre sınırından sonra ilerler).
 *  - Jeton = `purchaseToken`. Jeton → ürün eşlemesi bellekte; yoksa
 *    `getPurchases`'tan çözülür.
 *  - Bekleyen alım: durumu SATIN ALINDI (Play `PurchaseState.PURCHASED` = "1";
 *    "2" bekleyen ödeme verilmez) ve tüketilir üründe tüketilmemiş (onaylı
 *    olsa da), kalıcıda onaylanmamış.
 *  - "Zaten sahipsin" (`ITEM_ALREADY_OWNED`, ör. yeniden kurulumdan sonra
 *    Usta kartı): sahip olunan alım `getPurchases`'tan bulunur ve başarılı
 *    satın alma olarak döner (oyun jetonla çifte vermeyi önler; ödenmiş ürün
 *    "hata" denip kaybolmasın).
 */
import { NativePurchases, PURCHASE_TYPE, type Product, type Transaction } from '@capgo/native-purchases';
import { URUN_IDLERI, URUN_TURLERI, urunIdMi, type SatinAlmaSonucu, type Urun, type UrunId } from '../gelir';

/** Play `Purchase.PurchaseState.PURCHASED` (eklenti metin olarak verir). */
export const SATIN_ALINDI = '1';

/**
 * Kuyruğun süre sınırları (ms): satın alma (ödeme ekranı) uzun, öbürleri
 * kısa. Sınır yalnız kuyruğu ilerletir; çağrının kendisini iptal etmez.
 */
export const KUYRUK_SURELERI: Readonly<{ satin: number; kisa: number }> = Object.freeze({ satin: 10 * 60_000, kisa: 30_000 });

/** Bir alımın köprüdeki özeti. */
export interface Alim {
  urun: UrunId;
  jeton: string;
  onayli: boolean;
}

export interface SatinAlma {
  /** Satıştaki ürünler ve yerel fiyat metinleri (fatura yoksa boş). */
  urunler(): Promise<Urun[]>;
  /** Hiçbir durumda reddetmez. */
  satinAl(id: UrunId): Promise<SatinAlmaSonucu>;
  /** Tüketilir → tüket, kalıcı → onayla. Hata reddedilir (alım bekleyenlerde kalır). */
  tamamla(jeton: string): Promise<void>;
  /** Tamamlanmamış alımlar. Mağazaya ulaşılamazsa reddeder. */
  bekleyenler(): Promise<{ urun: UrunId; jeton: string }[]>;
  /** Sahip olunan kalıcı ürünler. Mağazaya ulaşılamazsa REDDEDER ("yok" sanılmasın). */
  geriYukle(): Promise<UrunId[]>;
}

// ─────────────────────────── Çeviriler (saf) ───────────────────────────

/**
 * `getProducts` → `Urun[]`: yalnız bilinen ürünler, boş olmayan fiyat;
 * bir ürünün birden çok tek seferlik teklifi varsa taban teklif (`offerId`
 * boş) yeğlenir, yoksa ilki. Mağaza sırası.
 */
export function urunlerCevir(liste: readonly Partial<Product>[] | null | undefined): Urun[] {
  const secilen = new Map<UrunId, { fiyat: string; taban: boolean }>();
  for (const p of liste ?? []) {
    if (!p || !urunIdMi(p.identifier) || typeof p.priceString !== 'string') continue;
    const fiyat = p.priceString.trim();
    if (!fiyat) continue;
    const taban = !p.offerId;
    const onceki = secilen.get(p.identifier);
    if (!onceki || (taban && !onceki.taban)) secilen.set(p.identifier, { fiyat, taban });
  }
  return URUN_IDLERI.filter((id) => secilen.has(id)).map((id) => ({ id, fiyat: secilen.get(id)!.fiyat }));
}

/** Eklenti hatasının kodu (Capacitor `call.reject(ileti, kod)`). */
export function hataKodu(e: unknown): string {
  const k = (e as { code?: unknown } | null)?.code;
  return typeof k === 'string' ? k : '';
}

function hataIletisi(e: unknown): string {
  if (typeof e === 'string') return e;
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' ? m : '';
}

/**
 * Satın alma reddi → sonuç: kullanıcı vazgeçti (`USER_CANCELED`) 'iptal';
 * bekleyen ödeme (eklenti "Purchase is pending" ile reddeder) 'beklemede';
 * diğer her şey 'hata'.
 */
export function satinHatasiCevir(e: unknown): 'iptal' | 'beklemede' | 'hata' {
  if (hataKodu(e) === 'USER_CANCELED') return 'iptal';
  if (/pending/i.test(hataIletisi(e))) return 'beklemede';
  return 'hata';
}

/** Bir işlemin (Transaction) jetonu: Android'de `purchaseToken` (yoksa `transactionId` aynı değerdir). */
function jetonu(t: Partial<Transaction>): string {
  const j = typeof t.purchaseToken === 'string' && t.purchaseToken ? t.purchaseToken : t.transactionId;
  return typeof j === 'string' ? j : '';
}

/** `getPurchases` → satın alınmış (bekleyen ödeme değil), bilinen ürünlü, jetonlu alımlar. */
export function alimlarCevir(liste: readonly Partial<Transaction>[] | null | undefined): Alim[] {
  const sonuc: Alim[] = [];
  const gorulen = new Set<string>();
  for (const t of liste ?? []) {
    if (!t || t.purchaseState !== SATIN_ALINDI || !urunIdMi(t.productIdentifier)) continue;
    const jeton = jetonu(t);
    if (!jeton || gorulen.has(jeton)) continue;
    gorulen.add(jeton);
    sonuc.push({ urun: t.productIdentifier, jeton, onayli: t.isAcknowledged === true });
  }
  return sonuc;
}

/** Tamamlanmamış mı: tüketilir ürün tüketilene dek (onaylı olsa da), kalıcı onaylanana dek. */
export function bekliyorMu(a: Alim): boolean {
  return URUN_TURLERI[a.urun] === 'tuketilir' || !a.onayli;
}

// ─────────────────────────── Köprü ───────────────────────────

export function satinAlmaKur(sure: Readonly<{ satin: number; kisa: number }> = KUYRUK_SURELERI): SatinAlma {
  const jetonlar = new Map<string, Alim>();
  /** Fatura desteklendi mi (yalnız `true` saklanır; yoksa her `urunler`de yeniden sorulur). */
  let faturaVar = false;
  let kuyruk: Promise<void> = Promise.resolve();

  /** `is`'i kuyruğa koyar: öncekiler bitince (ya da süre sınırı dolunca) başlar. */
  function sirala<T>(is: () => Promise<T>, sinir: number): Promise<T> {
    const onceki = kuyruk;
    const sonuc = onceki.then(is);
    kuyruk = new Promise<void>((birak) => {
      void onceki.then(() => {
        const z = setTimeout(birak, sinir);
        const bitti = () => {
          clearTimeout(z);
          birak();
        };
        sonuc.then(bitti, bitti);
      });
    });
    return sonuc;
  }

  /** `getPurchases` (inapp): eşlemeyi tazeler. Mağazaya ulaşılamazsa reddeder. Kuyruğun İÇİNDEN çağrılır. */
  async function alimlariOku(): Promise<Alim[]> {
    const r = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    const liste = alimlarCevir(r?.purchases);
    for (const a of liste) jetonlar.set(a.jeton, a);
    return liste;
  }

  // Elle tamamlama: kurtarma akışı (restorePurchases) da hiçbir alımı kendiliğinden onaylamasın.
  void sirala(async () => {
    try {
      await NativePurchases.configure({ autoFinishTransactions: false });
    } catch {
      /* capacitor.config.ts'teki aynı ayar yine geçerli */
    }
  }, sure.kisa);

  return {
    urunler: () =>
      sirala(async () => {
        if (!faturaVar) {
          try {
            faturaVar = (await NativePurchases.isBillingSupported())?.isBillingSupported === true;
          } catch {
            faturaVar = false;
          }
          if (!faturaVar) return [];
        }
        const r = await NativePurchases.getProducts({ productIdentifiers: [...URUN_IDLERI], productType: PURCHASE_TYPE.INAPP });
        return urunlerCevir(r?.products);
      }, sure.kisa),

    satinAl: (id) =>
      sirala(async (): Promise<SatinAlmaSonucu> => {
        if (!urunIdMi(id)) return { durum: 'hata' };
        try {
          const t = await NativePurchases.purchaseProduct({
            productIdentifier: id,
            productType: PURCHASE_TYPE.INAPP,
            quantity: 1,
            autoAcknowledgePurchases: false,
            isConsumable: false,
          });
          const jeton = t ? jetonu(t) : '';
          if (!jeton) return { durum: 'hata' };
          if (typeof t.purchaseState === 'string' && t.purchaseState !== SATIN_ALINDI) return { durum: 'beklemede' };
          const urun = urunIdMi(t.productIdentifier) ? t.productIdentifier : id;
          jetonlar.set(jeton, { urun, jeton, onayli: t.isAcknowledged === true });
          return { durum: 'basarili', urun, jeton };
        } catch (e) {
          if (hataKodu(e) === 'ITEM_ALREADY_OWNED') {
            try {
              const sahip = (await alimlariOku()).find((a) => a.urun === id);
              if (sahip) return { durum: 'basarili', urun: sahip.urun, jeton: sahip.jeton };
            } catch {
              /* sahiplik okunamadı */
            }
            return { durum: 'hata' };
          }
          return { durum: satinHatasiCevir(e) };
        }
      }, sure.satin),

    tamamla: (jeton) =>
      sirala(async () => {
        if (typeof jeton !== 'string' || !jeton) return;
        let a = jetonlar.get(jeton);
        if (!a) a = (await alimlariOku()).find((x) => x.jeton === jeton);
        // Mağazada yoksa zaten tüketilmiştir (ya da hiç olmamıştır): yapılacak bir şey yok.
        if (!a) return;
        if (URUN_TURLERI[a.urun] === 'tuketilir') {
          await NativePurchases.consumePurchase({ purchaseToken: jeton });
          jetonlar.delete(jeton);
        } else if (!a.onayli) {
          await NativePurchases.acknowledgePurchase({ purchaseToken: jeton });
          jetonlar.set(jeton, { ...a, onayli: true });
        }
      }, sure.kisa),

    bekleyenler: () =>
      sirala(async () => (await alimlariOku()).filter(bekliyorMu).map(({ urun, jeton }) => ({ urun, jeton })), sure.kisa),

    geriYukle: () =>
      sirala(async () => {
        try {
          await NativePurchases.restorePurchases();
        } catch {
          /* karar aşağıdaki sorgunun: mağazaya ulaşılamıyorsa o da reddeder */
        }
        const kume = new Set<UrunId>();
        for (const a of await alimlariOku()) if (URUN_TURLERI[a.urun] === 'kalici') kume.add(a.urun);
        return URUN_IDLERI.filter((id) => kume.has(id));
      }, sure.kisa),
  };
}
