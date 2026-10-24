/**
 * Android köprüsü uçtan uca: dört eklenti `vi.mock` ile taklit edilir,
 * `androidKur()` `window.FitilYerel`'i kurar; oyunun gerçek sarmalayıcısı
 * (`platform/gelir.ts` `gelirSaglayiciKur` → `androidSaglayici` +
 * `olculenSaglayici`) köprünün JSON yanıtlarını çözer. Geri tuşu, yaşam
 * döngüsü, açılış perdesi ve gizlilik satırı da buradan.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  type Dinleyici = (...a: unknown[]) => void;
  const admobDinleyici = new Map<string, Dinleyici[]>();
  const appDinleyici = new Map<string, Dinleyici>();
  return {
    admobDinleyici,
    appDinleyici,
    admob: {
      requestConsentInfo: vi.fn(),
      showConsentForm: vi.fn(),
      showPrivacyOptionsForm: vi.fn(),
      initialize: vi.fn(),
      prepareRewardVideoAd: vi.fn(),
      showRewardVideoAd: vi.fn(),
      addListener: vi.fn(),
    },
    np: {
      configure: vi.fn(),
      isBillingSupported: vi.fn(),
      getProducts: vi.fn(),
      purchaseProduct: vi.fn(),
      consumePurchase: vi.fn(),
      acknowledgePurchase: vi.fn(),
      getPurchases: vi.fn(),
      restorePurchases: vi.fn(),
    },
    app: { addListener: vi.fn(), minimizeApp: vi.fn() },
    splash: { hide: vi.fn() },
  };
});

vi.mock('@capacitor-community/admob', async (asil) => ({ ...(await asil<typeof import('@capacitor-community/admob')>()), AdMob: h.admob }));
vi.mock('@capgo/native-purchases', async (asil) => ({ ...(await asil<typeof import('@capgo/native-purchases')>()), NativePurchases: h.np }));
vi.mock('@capacitor/app', () => ({ App: h.app }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: h.splash }));

import { androidKur, odulluBirim } from './index';
import { PERDE_EN_GEC_MS } from './yasam';
import { ODUL_PAYI_MS, TEST_ODULLU } from './reklam';
import { GERI_YUKLEME_HATASI, gelirSaglayiciKur, gelirSecimi, type GelirSaglayici } from '../gelir';
import { olcum } from '../olcum';
import { geriTusunuDinle, gizlilikSecenekleri, yasamDinle, yerelHazir } from '../yerel';

const ODUL = 'onRewardedVideoAdReward';
const KAPANDI = 'onRewardedVideoAdDismissed';

function islem(urun: string, jeton: string, o: { durum?: string; onayli?: boolean } = {}) {
  return { transactionId: jeton, purchaseToken: jeton, productIdentifier: urun, purchaseState: o.durum ?? '1', isAcknowledged: o.onayli ?? false };
}

const akit = () => vi.advanceTimersByTimeAsync(0);
let pencere: EventTarget & Partial<Window>;
let olaylar: { ad: string; p: unknown }[];

/** androidKur + oyunun sarmalayıcısı (ölçümlü). */
async function kur(): Promise<GelirSaglayici> {
  await androidKur();
  const kopru = window.FitilYerel?.gelir;
  expect(gelirSecimi({ kopru, adres: '', depo: null })).toBe('android');
  const s = gelirSaglayiciKur({ kopru, adres: '', depo: null }, (ad, p) => olaylar.push({ ad, p }));
  expect(s?.ad).toBe('android');
  return s!;
}

beforeEach(() => {
  vi.useFakeTimers();
  pencere = new EventTarget() as EventTarget & Partial<Window>;
  vi.stubGlobal('window', pencere);
  olaylar = [];
  h.admobDinleyici.clear();
  h.appDinleyici.clear();
  for (const grup of [h.admob, h.np, h.app, h.splash]) for (const f of Object.values(grup)) f.mockReset();
  h.admob.addListener.mockImplementation(async (ad: string, fn: (...a: unknown[]) => void) => {
    h.admobDinleyici.set(ad, [...(h.admobDinleyici.get(ad) ?? []), fn]);
    return { remove: async () => undefined };
  });
  h.admob.requestConsentInfo.mockResolvedValue({ status: 'NOT_REQUIRED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
  h.admob.initialize.mockResolvedValue(undefined);
  h.admob.prepareRewardVideoAd.mockResolvedValue({ adUnitId: TEST_ODULLU });
  h.admob.showRewardVideoAd.mockReturnValue(new Promise(() => undefined));
  h.admob.showPrivacyOptionsForm.mockResolvedValue(undefined);
  h.np.configure.mockResolvedValue(undefined);
  h.np.isBillingSupported.mockResolvedValue({ isBillingSupported: true });
  h.np.getProducts.mockResolvedValue({ products: [] });
  h.np.getPurchases.mockResolvedValue({ purchases: [] });
  h.np.restorePurchases.mockResolvedValue(undefined);
  h.np.consumePurchase.mockResolvedValue(undefined);
  h.np.acknowledgePurchase.mockResolvedValue(undefined);
  h.app.addListener.mockImplementation(async (ad: string, fn: (...a: unknown[]) => void) => {
    h.appDinleyici.set(ad, fn);
    return { remove: async () => undefined };
  });
  h.app.minimizeApp.mockResolvedValue(undefined);
  h.splash.hide.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('androidKur', () => {
  it('window.FitilYerel eşzamanlı kurulur (uygulama kurulmadan önce)', async () => {
    const soz = androidKur();
    expect(window.FitilYerel?.gelir).toBeDefined();
    expect(window.FitilYerel?.olay).toBeTypeOf('function');
    expect(window.FitilYerel?.gizlilik).toBeDefined();
    expect(window.FitilYerel?.hazir).toBeTypeOf('function');
    // Gizlilik politikası pakete gömülü (docs/gizlilik.html; Ayarlar > Hakkında), iki dil bölümüyle.
    const politika = window.FitilYerel?.politika?.() ?? '';
    expect(politika).toContain('<section id="tr" lang="tr">');
    expect(politika).toContain('<section id="en" lang="en">');
    expect(() => window.FitilYerel!.olay!('bolum_basla', '{}')).not.toThrow();
    await soz;
  });

  it('ödüllü birim: ortamda yoksa Google test birimi', () => {
    expect(odulluBirim()).toBe(TEST_ODULLU);
  });
});

describe('sarmalayıcıyla (gelir.ts) uçtan uca JSON uyumu', () => {
  it('urunler: getProducts → Urun[] (yerel fiyat metni, Mağaza sırası)', async () => {
    h.np.getProducts.mockResolvedValue({
      products: [
        { identifier: 'usta_karti', priceString: '₺149,99' },
        { identifier: 'can_doldur', priceString: '₺29,99' },
        { identifier: 'guclendirici_paketi', priceString: '₺59,99' },
      ],
    });
    const s = await kur();
    expect(await s.urunler()).toEqual([
      { id: 'can_doldur', fiyat: '₺29,99' },
      { id: 'guclendirici_paketi', fiyat: '₺59,99' },
      { id: 'usta_karti', fiyat: '₺149,99' },
    ]);
  });

  it('urunler: getProducts reddederse boş liste (Mağaza fiyatsız)', async () => {
    h.np.getProducts.mockRejectedValue(new Error('Product not found'));
    const s = await kur();
    expect(await s.urunler()).toEqual([]);
  });

  it('satinAl → basarili; tamamla tüketilir üründe consumePurchase; ölçüm olayları', async () => {
    h.np.purchaseProduct.mockResolvedValue(islem('can_doldur', 'tok-1'));
    const s = await kur();
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'basarili', urun: 'can_doldur', jeton: 'tok-1' });
    await s.tamamla('tok-1');
    expect(h.np.consumePurchase).toHaveBeenCalledWith({ purchaseToken: 'tok-1' });
    expect(h.np.acknowledgePurchase).not.toHaveBeenCalled();
    expect(olaylar).toEqual([
      { ad: 'satin_alma', p: { urun: 'can_doldur', durum: 'basla' } },
      { ad: 'satin_alma', p: { urun: 'can_doldur', durum: 'basarili' } },
    ]);
  });

  it('satinAl iptal / beklemede / hata; kalıcı ürün onaylanır', async () => {
    const s = await kur();
    h.np.purchaseProduct.mockRejectedValueOnce(Object.assign(new Error('Purchase is not purchased'), { code: 'USER_CANCELED' }));
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'iptal' });
    h.np.purchaseProduct.mockRejectedValueOnce(new Error('Purchase is pending'));
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'beklemede' });
    h.np.purchaseProduct.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'NETWORK_ERROR' }));
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'hata' });
    h.np.purchaseProduct.mockResolvedValueOnce(islem('usta_karti', 'kart-1'));
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'basarili', urun: 'usta_karti', jeton: 'kart-1' });
    await s.tamamla('kart-1');
    expect(h.np.acknowledgePurchase).toHaveBeenCalledWith({ purchaseToken: 'kart-1' });
  });

  it('bekleyenler ve geriYukle; geri yükleme yapılamazsa sarmalayıcı reddeder', async () => {
    h.np.getPurchases.mockResolvedValue({
      purchases: [islem('guclendirici_paketi', 'p1'), islem('usta_karti', 'k1', { onayli: true }), islem('can_doldur', 'c1', { durum: '2' })],
    });
    const s = await kur();
    expect(await s.bekleyenler()).toEqual([{ urun: 'guclendirici_paketi', jeton: 'p1' }]);
    expect(await s.geriYukle()).toEqual(['usta_karti']);
    h.np.getPurchases.mockRejectedValue(new Error('QUERY_PURCHASES_FAILED'));
    await expect(s.geriYukle()).rejects.toThrow(GERI_YUKLEME_HATASI);
    expect(await s.bekleyenler()).toEqual([]);
  });

  it('reklam: yüklenince hazır; ödül + kapanış → odul; bilinmeyen yer hata', async () => {
    const s = await kur();
    expect(s.reklamHazir('can')).toBe(false);
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledWith({ adId: TEST_ODULLU });
    expect(s.reklamHazir('can')).toBe(true);
    expect(s.reklamHazir('hamle')).toBe(true);
    const r = s.reklamGoster('hamle');
    await akit();
    for (const fn of h.admobDinleyici.get(ODUL) ?? []) fn({ type: 'x', amount: 1 });
    for (const fn of h.admobDinleyici.get(KAPANDI) ?? []) fn();
    expect(await r).toBe('odul');
    expect(olaylar.at(-1)).toEqual({ ad: 'reklam_sonuc', p: { yer: 'hamle', sonuc: 'odul', kart: false } });
    await akit();
    expect(await window.FitilYerel!.gelir!.reklamGoster('baska')).toBe('hata');
    expect(window.FitilYerel!.gelir!.reklamHazir('baska')).toBe(false);
  });

  it('reklam: ödülsüz kapanış iptal; onay alınamazsa hazır değil ve "yok"', async () => {
    const s = await kur();
    await akit();
    const r = s.reklamGoster('can');
    await akit();
    for (const fn of h.admobDinleyici.get(KAPANDI) ?? []) fn();
    await vi.advanceTimersByTimeAsync(ODUL_PAYI_MS);
    expect(await r).toBe('iptal');

    h.admob.requestConsentInfo.mockRejectedValue(new Error('ağ'));
    const s2 = await kur();
    await akit();
    expect(s2.reklamHazir('can')).toBe(false);
    expect(await s2.reklamGoster('can')).toBe('yok');
  });
});

describe('geri tuşu ve yaşam döngüsü', () => {
  it('uygulama işlemezse (harita) arka plana alınır; işlerse bir şey yapılmaz', async () => {
    await androidKur();
    await akit();
    const geri = h.appDinleyici.get('backButton')!;
    expect(geri).toBeTypeOf('function');
    geri({ canGoBack: false });
    expect(h.app.minimizeApp).toHaveBeenCalledTimes(1);
    let islendi = true;
    const kaldir = geriTusunuDinle(() => islendi);
    geri({ canGoBack: false });
    expect(h.app.minimizeApp).toHaveBeenCalledTimes(1);
    islendi = false;
    geri({ canGoBack: false });
    expect(h.app.minimizeApp).toHaveBeenCalledTimes(2);
    kaldir();
  });

  it('ön plandan çıkınca ölçüm yazılır ve uygulamaya bildirilir', async () => {
    const yaz = vi.spyOn(olcum, 'yaz');
    const gelen: boolean[] = [];
    yasamDinle((a) => gelen.push(a));
    await androidKur();
    await akit();
    const durum = h.appDinleyici.get('appStateChange')!;
    durum({ isActive: false });
    expect(yaz).toHaveBeenCalledTimes(1);
    durum({ isActive: true });
    expect(yaz).toHaveBeenCalledTimes(1);
    expect(gelen).toEqual([false, true]);
    yaz.mockRestore();
  });

  it('dinleyici kurulamasa da kurulum reddetmez', async () => {
    h.app.addListener.mockRejectedValue(new Error('eklenti yok'));
    const hata = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(androidKur()).resolves.toBeUndefined();
    await akit();
    expect(hata).toHaveBeenCalled();
    hata.mockRestore();
  });
});

describe('açılış perdesi ve onay formu', () => {
  it('uygulama hazır deyince iki kare sonra perde kalkar (bir kez)', async () => {
    await androidKur();
    yerelHazir();
    yerelHazir();
    expect(h.splash.hide).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40);
    expect(h.splash.hide).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(PERDE_EN_GEC_MS);
    expect(h.splash.hide).toHaveBeenCalledTimes(1);
  });

  it('uygulama hazır demezse perde en geç 8 sn sonra kalkar', async () => {
    await androidKur();
    await vi.advanceTimersByTimeAsync(PERDE_EN_GEC_MS - 1);
    expect(h.splash.hide).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.splash.hide).toHaveBeenCalledTimes(1);
  });

  it('onay formu perde kalktıktan sonra; gizlilik satırı UMP isteyince görünür ve formu açar', async () => {
    h.admob.requestConsentInfo.mockResolvedValue({ status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
    h.admob.showConsentForm.mockResolvedValue({ status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
    await androidKur();
    await akit();
    expect(h.admob.showConsentForm).not.toHaveBeenCalled();
    yerelHazir();
    await vi.advanceTimersByTimeAsync(40);
    expect(h.splash.hide).toHaveBeenCalledTimes(1);
    expect(h.admob.showConsentForm).toHaveBeenCalledTimes(1);
    expect(h.splash.hide.mock.invocationCallOrder[0]).toBeLessThan(h.admob.showConsentForm.mock.invocationCallOrder[0]);
    expect(window.FitilYerel!.gelir!.reklamHazir('can')).toBe(true);
    const ac = gizlilikSecenekleri();
    expect(ac).toBeTypeOf('function');
    ac!();
    expect(h.admob.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  });

  it('UMP giriş noktası istemiyorsa gizlilik satırı yok', async () => {
    await androidKur();
    await akit();
    expect(gizlilikSecenekleri()).toBeNull();
  });
});
