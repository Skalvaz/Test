/**
 * Ödüllü reklam + onay (UMP) — docs/ANDROID.md §3, docs/CAN-REKLAM.md §3,
 * §5.1. `@capacitor-community/admob` 8.2.1 üstünde.
 *
 * Akış (`baslat`, açılışta bir kez):
 *  1. `requestConsentInfo()`; durum REQUIRED ise açılış perdesi kalkınca
 *     (`ayar.hazir`) `showConsentForm()`. Onay bilgisi alınamazsa ya da form
 *     sonrası `canRequestAds` false ise reklam bu oturumda KAPALI: hiç
 *     yüklenmez, `goster` 'yok' döner.
 *  2. `initialize({ tagForChildDirectedTreatment: false,
 *     tagForUnderAgeOfConsent: false, maxAdContentRating: ParentalGuidance })`
 *     (A9: 13+ hedef kitle, aile dostu reklam; test cihazı kaydı yok).
 *  3. Ödüllü reklam önden yüklenir (`prepareRewardVideoAd`). Yükleme hatası:
 *     30 sn, 2 dk, 5 dk (sonra hep 5 dk) aralıkla yeniden denenir; başarıda
 *     sayaç sıfırlanır. Yüklü reklam 55 dakikayı geçince (Google'ın reklamları
 *     1 saatte geçersizleşir) `hazirMi` false döner ve yeniden yüklenir.
 *
 * Gösterim sonucu (eklenti `showRewardVideoAd`'i yalnız ödülde çözer;
 * ödülsüz kapanışta hiç çözmez, gösterim hatasında reddetmez — bu yüzden
 * olaylar dinlenir): ödül olayı (ya da sözün çözülmesi) + kapanış → 'odul';
 * ödülsüz kapanış → 'iptal' (geç gelen ödül için `ODUL_PAYI_MS` beklenir);
 * gösterim hatası / sözün reddi → 'hata'; yüklü reklam yoksa 'yok'. Her
 * gösterimden sonra, reklam ekranı KAPANINCA yeni reklam yüklenir: eklenti
 * yüklenen reklamı birim kimliği anahtarıyla saklar ve gösterilen reklam
 * kapanınca o anahtarı siler; ekran açıkken yüklenen yeni reklam silinir,
 * köprü onu "hazır" sanırdı (sonraki gösterim 'hata').
 */
import {
  AdMob,
  AdmobConsentStatus,
  MaxAdContentRating,
  RewardAdPluginEvents,
  type AdmobConsentInfo,
} from '@capacitor-community/admob';
import type { ReklamSonucu } from '../gelir';

/** Google'ın herkese açık TEST ödüllü reklam birimi (A7; `.env.android` boşsa). */
export const TEST_ODULLU = 'ca-app-pub-3940256099942544/5224354917';
/** Yükleme hatasından sonra yeniden deneme aralıkları (ms): 30 sn, 2 dk, 5 dk; sonra hep sonuncusu. */
export const YENIDEN_DENEME_MS: readonly number[] = Object.freeze([30_000, 120_000, 300_000]);
/** Yüklü reklam bu kadar eskiyince kullanılmaz, yeniden yüklenir (ms). */
export const REKLAM_OMRU_MS = 55 * 60_000;
/** Ödülsüz kapanıştan sonra geç gelebilecek ödül olayı için bekleme (ms). */
export const ODUL_PAYI_MS = 1000;
/** Ödül geldi ama kapanış olayı hiç gelmezse bu süre sonra 'odul' (ms; ödül yutulmasın). */
export const KAPANIS_BEKLEME_MS = 60_000;
/**
 * 'odul' kapanışsız verildiyse (oyuncu son kartta kaldı) yeni reklam kapanış
 * olayında yüklenir; kapanış hiç gelmezse bu kadar sonra yine yüklenir (ms;
 * reklam bu oturumda kalıcı olarak kaybolmasın).
 */
export const KAPANIS_EN_GEC_MS = 10 * 60_000;

/**
 * - `baslamadi`: `baslat` çağrılmadı;
 * - `onay`: onay bilgisi / form / initialize sürüyor;
 * - `kapali`: onay alınamadı ya da reklam istenemez (bu oturumda reklam yok);
 * - `yukleniyor`, `hazir`, `gosteriliyor`;
 * - `bekliyor`: yükleme hatası, yeniden deneme zamanlayıcısı kurulu.
 */
export type ReklamDurumu = 'baslamadi' | 'onay' | 'kapali' | 'yukleniyor' | 'hazir' | 'gosteriliyor' | 'bekliyor';

export interface ReklamAyari {
  /** Ödüllü reklam birimi (`VITE_ADMOB_ODULLU`; boşsa `TEST_ODULLU`). */
  birim: string;
  /** Onay formu bundan sonra gösterilir (açılış perdesi kalksın; verilmezse hemen). */
  hazir?: Promise<void>;
  /** Saat (ms; testler verir). */
  simdi?: () => number;
}

export interface Reklam {
  readonly durum: ReklamDurumu;
  /** Onay → initialize → ön yükleme. Bir kez çalışır; hiçbir durumda reddetmez. */
  baslat(): Promise<void>;
  /** Yüklü ve taze reklam var mı (eskimişse yeniden yüklemeyi başlatır, false döner). */
  hazirMi(): boolean;
  /** Reklamı gösterir; hiçbir durumda reddetmez. */
  goster(): Promise<ReklamSonucu>;
  /** UMP "gizlilik seçenekleri" giriş noktası isteniyor mu (Ayarlar satırı). */
  gizlilikGerekli(): boolean;
  /** Gizlilik seçenekleri formunu gösterir; sonra onay bilgisini tazeler. Hata yutulur. */
  gizlilikAc(): Promise<void>;
}

/**
 * UMP `PrivacyOptionsRequirementStatus.REQUIRED` (eklenti bu enum'u dışa
 * aktarmıyor; yerel taraf `name()` ile metin olarak verir).
 */
export const GIZLILIK_GEREKLI = 'REQUIRED';

/** Onay bilgisinden: reklam istenebilir mi (UMP `canRequestAds`). */
export function reklamIstenebilir(b: Partial<AdmobConsentInfo> | null | undefined): boolean {
  return b?.canRequestAds === true;
}

export function reklamKur(ayar: ReklamAyari): Reklam {
  const simdi = ayar.simdi ?? (() => Date.now());
  let durum: ReklamDurumu = 'baslamadi';
  let gizlilik = false;
  let baslatSozu: Promise<void> | null = null;
  /** Yüklenen reklamın birimi (eklentinin `adUnitId`'si) ve yüklenme anı. */
  let yuklenen: string | null = null;
  let yuklenmeAni = 0;
  /** Ardışık yükleme hatası sayısı (bekleme aralığını seçer). */
  let hataSayisi = 0;
  /** Her yükleme denemesinin kimliği: geç gelen eski yanıt durumu bozmasın. */
  let nesil = 0;
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  /** Süren gösterimin olay işleyicileri (yalnız gösterim sırasında). */
  let gosterim: { odul(): void; kapandi(): void; hata(): void } | null = null;

  const gizlilikOku = (b: Partial<AdmobConsentInfo> | null | undefined) => {
    if (b && typeof b.privacyOptionsRequirementStatus === 'string') {
      gizlilik = String(b.privacyOptionsRequirementStatus) === GIZLILIK_GEREKLI;
    }
  };

  function yukle(): void {
    if (durum === 'baslamadi' || durum === 'onay' || durum === 'kapali' || durum === 'gosteriliyor' || durum === 'yukleniyor') return;
    if (zamanlayici !== null) clearTimeout(zamanlayici);
    zamanlayici = null;
    durum = 'yukleniyor';
    yuklenen = null;
    const benim = ++nesil;
    let soz: Promise<{ adUnitId?: string } | undefined>;
    try {
      soz = Promise.resolve(AdMob.prepareRewardVideoAd({ adId: ayar.birim }));
    } catch (e) {
      soz = Promise.reject(e);
    }
    soz.then(
      (bilgi) => {
        if (benim !== nesil || durum !== 'yukleniyor') return;
        durum = 'hazir';
        yuklenen = typeof bilgi?.adUnitId === 'string' && bilgi.adUnitId ? bilgi.adUnitId : ayar.birim;
        yuklenmeAni = simdi();
        hataSayisi = 0;
      },
      () => {
        if (benim !== nesil || durum !== 'yukleniyor') return;
        durum = 'bekliyor';
        const ms = YENIDEN_DENEME_MS[Math.min(hataSayisi, YENIDEN_DENEME_MS.length - 1)];
        hataSayisi++;
        zamanlayici = setTimeout(() => {
          zamanlayici = null;
          if (durum === 'bekliyor') yukle();
        }, ms);
      },
    );
  }

  async function dinleyicileriKur(): Promise<void> {
    await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => gosterim?.odul());
    await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => gosterim?.kapandi());
    await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => gosterim?.hata());
  }

  function baslat(): Promise<void> {
    if (baslatSozu) return baslatSozu;
    baslatSozu = (async () => {
      durum = 'onay';
      try {
        let bilgi: Partial<AdmobConsentInfo> = await AdMob.requestConsentInfo();
        gizlilikOku(bilgi);
        if (bilgi.status === AdmobConsentStatus.REQUIRED) {
          // Form açılış perdesinin altında kalmasın: perde kalkınca.
          if (ayar.hazir) await ayar.hazir.catch(() => undefined);
          bilgi = { ...bilgi, ...(await AdMob.showConsentForm()) };
          gizlilikOku(bilgi);
        }
        if (!reklamIstenebilir(bilgi)) {
          durum = 'kapali';
          return;
        }
        await AdMob.initialize({
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
          maxAdContentRating: MaxAdContentRating.ParentalGuidance,
        });
        await dinleyicileriKur();
      } catch {
        // Onay alınamadı (ağ, form hatası) ya da SDK kurulamadı: bu oturumda reklam yok.
        durum = 'kapali';
        return;
      }
      durum = 'bekliyor';
      yukle();
    })();
    return baslatSozu;
  }

  function hazirMi(): boolean {
    if (durum !== 'hazir') return false;
    if (simdi() - yuklenmeAni > REKLAM_OMRU_MS) {
      durum = 'bekliyor';
      yukle();
      return false;
    }
    return true;
  }

  async function goster(): Promise<ReklamSonucu> {
    if (!hazirMi()) return 'yok';
    durum = 'gosteriliyor';
    const birim = yuklenen ?? ayar.birim;
    yuklenen = null;
    /** Reklam ekranı kapandı (kapanış ya da gösterim hatası olayı / reddi geldi). */
    let ekranKapandi = false;
    const sonuc = await new Promise<ReklamSonucu>((coz) => {
      let odul = false;
      let bitti = false;
      let pay: ReturnType<typeof setTimeout> | null = null;
      let kapanisSure: ReturnType<typeof setTimeout> | null = null;
      const bitir = (s: ReklamSonucu) => {
        if (bitti) return;
        bitti = true;
        if (pay !== null) clearTimeout(pay);
        if (kapanisSure !== null) clearTimeout(kapanisSure);
        coz(s);
      };
      const g = {
        odul() {
          if (bitti) return;
          odul = true;
          // Kapanış zaten geldiyse (geç ödül) hemen; değilse kapanışı bekle.
          if (pay !== null) bitir('odul');
          else if (kapanisSure === null) kapanisSure = setTimeout(() => bitir('odul'), KAPANIS_BEKLEME_MS);
        },
        kapandi() {
          ekranKapandi = true;
          if (bitti) return;
          if (odul) bitir('odul');
          else if (pay === null) pay = setTimeout(() => bitir('iptal'), ODUL_PAYI_MS);
        },
        hata() {
          ekranKapandi = true;
          bitir(odul ? 'odul' : 'hata');
        },
      };
      gosterim = g;
      try {
        Promise.resolve(AdMob.showRewardVideoAd({ adId: birim })).then(
          () => g.odul(),
          () => g.hata(),
        );
      } catch {
        g.hata();
      }
    });
    let enGec: ReturnType<typeof setTimeout> | null = null;
    const ekranBitti = () => {
      if (enGec !== null) clearTimeout(enGec);
      gosterim = null;
      durum = 'bekliyor';
      yukle();
    };
    if (ekranKapandi) ekranBitti();
    else {
      // Ödül verildi ama reklam ekranı hâlâ açık olabilir: yeni reklam kapanışta (durum
      // 'gosteriliyor' kalır, `hazirMi` false: düğme görünmez, ikinci gösterim 'yok').
      gosterim = { odul: () => undefined, kapandi: ekranBitti, hata: ekranBitti };
      enGec = setTimeout(ekranBitti, KAPANIS_EN_GEC_MS);
    }
    return sonuc;
  }

  async function gizlilikAc(): Promise<void> {
    try {
      await AdMob.showPrivacyOptionsForm();
    } catch {
      return;
    }
    try {
      gizlilikOku(await AdMob.requestConsentInfo());
    } catch {
      /* bilgi tazelenemedi: satır olduğu gibi kalır */
    }
  }

  return {
    get durum() {
      return durum;
    },
    baslat,
    hazirMi,
    goster,
    gizlilikGerekli: () => gizlilik,
    gizlilikAc,
  };
}
