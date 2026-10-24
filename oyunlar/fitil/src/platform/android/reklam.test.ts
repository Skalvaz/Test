/**
 * Ödüllü reklam + onay (UMP) köprüsü: eklenti `vi.mock` ile taklit edilir
 * (gerçek eklentinin davranışı: `showRewardVideoAd` yalnız ödülde çözülür,
 * ödülsüz kapanışta hiç çözülmez; sonuç olaylardan okunur).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  type Dinleyici = (...a: unknown[]) => void;
  const dinleyiciler = new Map<string, Dinleyici[]>();
  const admob = {
    requestConsentInfo: vi.fn(),
    showConsentForm: vi.fn(),
    showPrivacyOptionsForm: vi.fn(),
    initialize: vi.fn(),
    prepareRewardVideoAd: vi.fn(),
    showRewardVideoAd: vi.fn(),
    addListener: vi.fn(async (ad: string, fn: Dinleyici) => {
      dinleyiciler.set(ad, [...(dinleyiciler.get(ad) ?? []), fn]);
      return { remove: async () => undefined };
    }),
  };
  const yay = (ad: string, ...a: unknown[]) => {
    for (const fn of dinleyiciler.get(ad) ?? []) fn(...a);
  };
  return { admob, dinleyiciler, yay };
});

vi.mock('@capacitor-community/admob', async (asil) => ({
  ...(await asil<typeof import('@capacitor-community/admob')>()),
  AdMob: h.admob,
}));

import { KAPANIS_BEKLEME_MS, KAPANIS_EN_GEC_MS, ODUL_PAYI_MS, REKLAM_OMRU_MS, YENIDEN_DENEME_MS, reklamIstenebilir, reklamKur } from './reklam';

const BIRIM = 'ca-app-pub-test/odullu';
const ODUL = 'onRewardedVideoAdReward';
const KAPANDI = 'onRewardedVideoAdDismissed';
const GOSTERILEMEDI = 'onRewardedVideoAdFailedToShow';

const GEREKSIZ = { status: 'NOT_REQUIRED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' };

let saat = 1_000_000;
const akit = () => vi.advanceTimersByTimeAsync(0);

function kur(hazir?: Promise<void>) {
  return reklamKur({ birim: BIRIM, hazir, simdi: () => saat });
}

/** Elle çözülen söz. */
function ertele<T = void>() {
  let coz!: (v: T) => void;
  let reddet!: (e: unknown) => void;
  const soz = new Promise<T>((c, r) => {
    coz = c;
    reddet = r;
  });
  return { soz, coz, reddet };
}

beforeEach(() => {
  vi.useFakeTimers();
  saat = 1_000_000;
  h.dinleyiciler.clear();
  for (const f of Object.values(h.admob)) f.mockReset();
  h.admob.addListener.mockImplementation(async (ad: string, fn: (...a: unknown[]) => void) => {
    h.dinleyiciler.set(ad, [...(h.dinleyiciler.get(ad) ?? []), fn]);
    return { remove: async () => undefined };
  });
  h.admob.requestConsentInfo.mockResolvedValue(GEREKSIZ);
  h.admob.initialize.mockResolvedValue(undefined);
  h.admob.prepareRewardVideoAd.mockResolvedValue({ adUnitId: BIRIM });
  // Gerçek eklenti gibi: ödül gelmezse söz hiç çözülmez.
  h.admob.showRewardVideoAd.mockReturnValue(new Promise(() => undefined));
  h.admob.showPrivacyOptionsForm.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('onay (UMP) ve başlatma', () => {
  it('onay gereksiz: form yok; initialize A9 alanlarıyla, sonra ödüllü reklam önden yüklenir', async () => {
    const r = kur();
    await r.baslat();
    await akit();
    expect(h.admob.showConsentForm).not.toHaveBeenCalled();
    expect(h.admob.initialize).toHaveBeenCalledWith({
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: 'ParentalGuidance',
    });
    expect(h.admob.initialize.mock.calls[0][0]).not.toHaveProperty('initializeForTesting');
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledWith({ adId: BIRIM });
    expect([...h.dinleyiciler.keys()].sort()).toEqual([KAPANDI, GOSTERILEMEDI, ODUL].sort());
    expect(r.durum).toBe('hazir');
    expect(r.hazirMi()).toBe(true);
    expect(r.gizlilikGerekli()).toBe(false);
  });

  it('onay gerekli: form açılış perdesi kalkınca gösterilir, sonra initialize ve yükleme', async () => {
    h.admob.requestConsentInfo.mockResolvedValue({ status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED', isConsentFormAvailable: true });
    h.admob.showConsentForm.mockResolvedValue({ status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
    const perde = ertele();
    const r = kur(perde.soz);
    const b = r.baslat();
    await akit();
    expect(h.admob.showConsentForm).not.toHaveBeenCalled();
    expect(h.admob.initialize).not.toHaveBeenCalled();
    expect(r.hazirMi()).toBe(false);
    perde.coz();
    await b;
    await akit();
    expect(h.admob.showConsentForm).toHaveBeenCalledTimes(1);
    expect(h.admob.initialize.mock.invocationCallOrder[0]).toBeGreaterThan(h.admob.showConsentForm.mock.invocationCallOrder[0]);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
    expect(r.hazirMi()).toBe(true);
    expect(r.gizlilikGerekli()).toBe(true);
  });

  it('onay bilgisi alınamazsa reklam yüklenmez, gösterim "yok"', async () => {
    h.admob.requestConsentInfo.mockRejectedValue(new Error('ağ yok'));
    const r = kur();
    await r.baslat();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(r.durum).toBe('kapali');
    expect(h.admob.initialize).not.toHaveBeenCalled();
    expect(h.admob.prepareRewardVideoAd).not.toHaveBeenCalled();
    expect(r.hazirMi()).toBe(false);
    expect(await r.goster()).toBe('yok');
    expect(h.admob.showRewardVideoAd).not.toHaveBeenCalled();
  });

  it('form hatası ya da form sonrası reklam istenemiyorsa kapalı', async () => {
    h.admob.requestConsentInfo.mockResolvedValue({ status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
    h.admob.showConsentForm.mockRejectedValueOnce(new Error('form yok'));
    const a = kur();
    await a.baslat();
    expect(a.durum).toBe('kapali');

    h.admob.showConsentForm.mockResolvedValueOnce({ status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
    const b = kur();
    await b.baslat();
    expect(b.durum).toBe('kapali');
    expect(h.admob.initialize).not.toHaveBeenCalled();
    expect(h.admob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('initialize hatası: kapalı', async () => {
    h.admob.initialize.mockRejectedValue(new Error('sdk'));
    const r = kur();
    await r.baslat();
    expect(r.durum).toBe('kapali');
    expect(h.admob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('baslat bir kez çalışır', async () => {
    const r = kur();
    const a = r.baslat();
    const b = r.baslat();
    expect(a).toBe(b);
    await a;
    expect(h.admob.requestConsentInfo).toHaveBeenCalledTimes(1);
  });

  it('reklamIstenebilir yalnız canRequestAds true iken', () => {
    expect(reklamIstenebilir({ canRequestAds: true })).toBe(true);
    expect(reklamIstenebilir({ canRequestAds: false })).toBe(false);
    expect(reklamIstenebilir({})).toBe(false);
    expect(reklamIstenebilir(null)).toBe(false);
  });
});

describe('gösterim sonuçları', () => {
  async function hazir() {
    const r = kur();
    await r.baslat();
    await akit();
    expect(r.hazirMi()).toBe(true);
    return r;
  }

  it('ödül olayı + kapanış → odul; gösterimden sonra yeniden yüklenir', async () => {
    const r = await hazir();
    const s = r.goster();
    await akit();
    expect(h.admob.showRewardVideoAd).toHaveBeenCalledWith({ adId: BIRIM });
    expect(r.durum).toBe('gosteriliyor');
    expect(r.hazirMi()).toBe(false);
    h.yay(ODUL, { type: 'coin', amount: 1 });
    h.yay(KAPANDI);
    expect(await s).toBe('odul');
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
    expect(r.hazirMi()).toBe(true);
  });

  it('sözün çözülmesi (ödül) + kapanış → odul', async () => {
    h.admob.showRewardVideoAd.mockResolvedValue({ type: 'coin', amount: 1 });
    const r = await hazir();
    const s = r.goster();
    await akit();
    h.yay(KAPANDI);
    expect(await s).toBe('odul');
  });

  it('ödülsüz kapanış → iptal (geç ödül payı beklenir)', async () => {
    const r = await hazir();
    const s = r.goster();
    await akit();
    h.yay(KAPANDI);
    let sonuc: string | null = null;
    void s.then((x) => (sonuc = x));
    await vi.advanceTimersByTimeAsync(ODUL_PAYI_MS - 1);
    expect(sonuc).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(sonuc).toBe('iptal');
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
  });

  it('kapanıştan sonra pay içinde gelen ödül → odul', async () => {
    const r = await hazir();
    const s = r.goster();
    await akit();
    h.yay(KAPANDI);
    await vi.advanceTimersByTimeAsync(ODUL_PAYI_MS / 2);
    h.yay(ODUL, { type: 'coin', amount: 1 });
    expect(await s).toBe('odul');
  });

  it('gösterim hatası olayı ya da sözün reddi → hata', async () => {
    const r = await hazir();
    const s = r.goster();
    await akit();
    h.yay(GOSTERILEMEDI, { code: 1, message: 'x' });
    expect(await s).toBe('hata');
    await akit();
    h.admob.showRewardVideoAd.mockRejectedValueOnce(new Error('hazır değil'));
    expect(r.hazirMi()).toBe(true);
    expect(await r.goster()).toBe('hata');
  });

  it('ödül geldi ama kapanış hiç gelmezse süre sonunda yine odul', async () => {
    const r = await hazir();
    const s = r.goster();
    await akit();
    h.yay(ODUL, { type: 'coin', amount: 1 });
    let sonuc: string | null = null;
    void s.then((x) => (sonuc = x));
    await vi.advanceTimersByTimeAsync(KAPANIS_BEKLEME_MS - 1);
    expect(sonuc).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(sonuc).toBe('odul');
    // Reklam ekranı hâlâ açık olabilir: yeni reklam kapanışa dek yüklenmez (eklenti aynı
    // birim anahtarındaki yeni reklamı, gösterilen reklam kapanınca silerdi).
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
    expect(r.hazirMi()).toBe(false);
    expect(await r.goster()).toBe('yok');
    expect(h.admob.showRewardVideoAd).toHaveBeenCalledTimes(1);
    h.yay(ODUL, { type: 'coin', amount: 1 });
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
    h.yay(KAPANDI);
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
    expect(r.hazirMi()).toBe(true);
  });

  it('kapanışsız odul sonrası kapanış hiç gelmezse yeni reklam en geç süre sonunda yüklenir', async () => {
    const r = await hazir();
    const s = r.goster();
    await akit();
    h.yay(ODUL, { type: 'coin', amount: 1 });
    await vi.advanceTimersByTimeAsync(KAPANIS_BEKLEME_MS);
    expect(await s).toBe('odul');
    await vi.advanceTimersByTimeAsync(KAPANIS_EN_GEC_MS - 1);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
    expect(r.hazirMi()).toBe(true);
    // Geç gelen kapanış yeni gösterim yokken yok sayılır.
    h.yay(KAPANDI);
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
  });

  it('yüklü değilken ve gösterim sürerken "yok"', async () => {
    const yukleme = ertele<{ adUnitId: string }>();
    h.admob.prepareRewardVideoAd.mockReturnValueOnce(yukleme.soz);
    const r = kur();
    await r.baslat();
    expect(r.durum).toBe('yukleniyor');
    expect(await r.goster()).toBe('yok');
    yukleme.coz({ adUnitId: 'baska-birim' });
    await akit();
    const s = r.goster();
    await akit();
    expect(h.admob.showRewardVideoAd).toHaveBeenCalledWith({ adId: 'baska-birim' });
    expect(await r.goster()).toBe('yok');
    h.yay(KAPANDI);
    await vi.advanceTimersByTimeAsync(ODUL_PAYI_MS);
    expect(await s).toBe('iptal');
  });

  it('olaylar gösterim dışında gelirse yok sayılır', async () => {
    const r = await hazir();
    h.yay(ODUL, { type: 'coin', amount: 1 });
    h.yay(KAPANDI);
    expect(r.hazirMi()).toBe(true);
    const s = r.goster();
    await akit();
    h.yay(KAPANDI);
    await vi.advanceTimersByTimeAsync(ODUL_PAYI_MS);
    expect(await s).toBe('iptal');
  });
});

describe('yükleme hatası ve yenileme', () => {
  it('artan aralıkla yeniden dener (30 sn, 2 dk, 5 dk, sonra 5 dk); başarı sayacı sıfırlar', async () => {
    expect(YENIDEN_DENEME_MS).toEqual([30_000, 120_000, 300_000]);
    h.admob.prepareRewardVideoAd.mockRejectedValue(new Error('no fill'));
    const r = kur();
    await r.baslat();
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
    expect(r.durum).toBe('bekliyor');
    expect(await r.goster()).toBe('yok');
    await vi.advanceTimersByTimeAsync(30_000 - 1);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(300_000 - 1);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(5);

    // Sonraki deneme başarılı: hazır; gösterimden sonraki yükleme hatası yine 30 sn'den başlar.
    h.admob.prepareRewardVideoAd.mockResolvedValueOnce({ adUnitId: BIRIM });
    await vi.advanceTimersByTimeAsync(300_000);
    expect(r.hazirMi()).toBe(true);
    const s = r.goster();
    await akit();
    h.yay(ODUL, {});
    h.yay(KAPANDI);
    expect(await s).toBe('odul');
    await akit();
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(7);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(8);
  });

  it('55 dakikadan eski reklam kullanılmaz, yeniden yüklenir', async () => {
    const r = kur();
    await r.baslat();
    await akit();
    expect(r.hazirMi()).toBe(true);
    saat += REKLAM_OMRU_MS;
    expect(r.hazirMi()).toBe(true);
    saat += 1;
    expect(r.hazirMi()).toBe(false);
    expect(h.admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2);
    await akit();
    expect(r.hazirMi()).toBe(true);
  });
});

describe('gizlilik seçenekleri', () => {
  it('formu gösterir, sonra durumu tazeler; hata yutulur', async () => {
    h.admob.requestConsentInfo.mockResolvedValueOnce({ ...GEREKSIZ, privacyOptionsRequirementStatus: 'REQUIRED' });
    const r = kur();
    await r.baslat();
    expect(r.gizlilikGerekli()).toBe(true);
    await r.gizlilikAc();
    expect(h.admob.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    expect(h.admob.requestConsentInfo).toHaveBeenCalledTimes(2);
    expect(r.gizlilikGerekli()).toBe(false);
    h.admob.showPrivacyOptionsForm.mockRejectedValueOnce(new Error('form'));
    await expect(r.gizlilikAc()).resolves.toBeUndefined();
  });
});
