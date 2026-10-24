/**
 * Play Billing köprüsü: `@capgo/native-purchases` `vi.mock` ile taklit edilir.
 * Reddetme biçimleri yerel eklentiden: kullanıcı vazgeçince kod
 * `USER_CANCELED`, bekleyen ödemede "Purchase is pending" (kodsuz), zaten
 * sahip olunan üründe `ITEM_ALREADY_OWNED`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
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
}));

vi.mock('@capgo/native-purchases', async (asil) => ({
  ...(await asil<typeof import('@capgo/native-purchases')>()),
  NativePurchases: h.np,
}));

import { alimlarCevir, bekliyorMu, satinAlmaKur, satinHatasiCevir, urunlerCevir, SATIN_ALINDI } from './satin';

/** Capacitor'ün reddi gibi: ileti + kod. */
function eklentiHatasi(ileti: string, kod?: string): Error {
  return Object.assign(new Error(ileti), kod ? { code: kod } : {});
}

/** `getPurchases` / `purchaseProduct` işlemi (Android alanları). */
function islem(urun: string, jeton: string, o: { durum?: string; onayli?: boolean } = {}) {
  return {
    transactionId: jeton,
    purchaseToken: jeton,
    productIdentifier: urun,
    purchaseDate: '2026-10-24T10:00:00Z',
    productType: 'inapp',
    purchaseState: o.durum ?? SATIN_ALINDI,
    isAcknowledged: o.onayli ?? false,
    quantity: 1,
    willCancel: null,
  };
}

function urun(id: string, fiyat: string, offerId: string | null = null) {
  return { identifier: id, priceString: fiyat, offerId, title: id, description: '', price: 1, currencyCode: 'TRY', currencySymbol: '₺' };
}

function ertele<T = void>() {
  let coz!: (v: T) => void;
  const soz = new Promise<T>((c) => (coz = c));
  return { soz, coz };
}

const akit = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  for (const f of Object.values(h.np)) f.mockReset();
  h.np.configure.mockResolvedValue(undefined);
  h.np.isBillingSupported.mockResolvedValue({ isBillingSupported: true });
  h.np.getProducts.mockResolvedValue({ products: [] });
  h.np.consumePurchase.mockResolvedValue(undefined);
  h.np.acknowledgePurchase.mockResolvedValue(undefined);
  h.np.getPurchases.mockResolvedValue({ purchases: [] });
  h.np.restorePurchases.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('çeviriler (saf)', () => {
  it('urunlerCevir: bilinen ürünler, boş fiyat yok, taban teklif yeğlenir, Mağaza sırası', () => {
    expect(
      urunlerCevir([
        urun('usta_karti', '₺149,99'),
        urun('baska', '₺1'),
        urun('can_doldur', '₺19,99', 'indirim'),
        urun('can_doldur', '₺29,99'),
        urun('can_doldur', '₺9,99', 'ikinci'),
        urun('guclendirici_paketi', '  '),
        { identifier: 'guclendirici_paketi' },
      ]),
    ).toEqual([
      { id: 'can_doldur', fiyat: '₺29,99' },
      { id: 'usta_karti', fiyat: '₺149,99' },
    ]);
    expect(urunlerCevir(undefined)).toEqual([]);
  });

  it('satinHatasiCevir: vazgeçme iptal, bekleyen ödeme beklemede, gerisi hata', () => {
    expect(satinHatasiCevir(eklentiHatasi('Purchase is not purchased', 'USER_CANCELED'))).toBe('iptal');
    expect(satinHatasiCevir(eklentiHatasi('Purchase is pending'))).toBe('beklemede');
    expect(satinHatasiCevir(eklentiHatasi('Purchase is not purchased', 'ITEM_UNAVAILABLE'))).toBe('hata');
    expect(satinHatasiCevir(eklentiHatasi('Product not found'))).toBe('hata');
    expect(satinHatasiCevir('x')).toBe('hata');
    expect(satinHatasiCevir(null)).toBe('hata');
  });

  it('alimlarCevir: yalnız satın alınmış (bekleyen ödeme değil), bilinen ürün, jetonlu, tekil', () => {
    expect(
      alimlarCevir([
        islem('can_doldur', 'j1'),
        islem('usta_karti', 'j2', { onayli: true }),
        islem('guclendirici_paketi', 'j3', { durum: '2' }),
        islem('baska', 'j4'),
        islem('can_doldur', 'j1'),
        { ...islem('can_doldur', ''), transactionId: '' },
      ]),
    ).toEqual([
      { urun: 'can_doldur', jeton: 'j1', onayli: false },
      { urun: 'usta_karti', jeton: 'j2', onayli: true },
    ]);
  });

  it('bekliyorMu: tüketilir tüketilene dek, kalıcı onaylanana dek', () => {
    expect(bekliyorMu({ urun: 'can_doldur', jeton: 'a', onayli: true })).toBe(true);
    expect(bekliyorMu({ urun: 'guclendirici_paketi', jeton: 'a', onayli: false })).toBe(true);
    expect(bekliyorMu({ urun: 'usta_karti', jeton: 'a', onayli: false })).toBe(true);
    expect(bekliyorMu({ urun: 'usta_karti', jeton: 'a', onayli: true })).toBe(false);
  });
});

describe('satinAlmaKur', () => {
  it('ilk iş elle tamamlamayı açar (autoFinishTransactions false)', async () => {
    const s = satinAlmaKur();
    await s.bekleyenler();
    expect(h.np.configure).toHaveBeenCalledWith({ autoFinishTransactions: false });
    expect(h.np.configure.mock.invocationCallOrder[0]).toBeLessThan(h.np.getPurchases.mock.invocationCallOrder[0]);
  });

  it('urunler: fatura yoksa boş (yeniden sorulur), varsa getProducts inapp ve fiyat metni', async () => {
    h.np.isBillingSupported.mockResolvedValueOnce({ isBillingSupported: false });
    const s = satinAlmaKur();
    expect(await s.urunler()).toEqual([]);
    expect(h.np.getProducts).not.toHaveBeenCalled();
    h.np.getProducts.mockResolvedValue({ products: [urun('guclendirici_paketi', '₺59,99'), urun('can_doldur', '₺29,99')] });
    expect(await s.urunler()).toEqual([
      { id: 'can_doldur', fiyat: '₺29,99' },
      { id: 'guclendirici_paketi', fiyat: '₺59,99' },
    ]);
    expect(h.np.getProducts).toHaveBeenCalledWith({ productIdentifiers: ['can_doldur', 'guclendirici_paketi', 'usta_karti'], productType: 'inapp' });
    await s.urunler();
    // Desteklendi bilgisi saklanır: üç çağrıda iki soru (false, true).
    expect(h.np.isBillingSupported).toHaveBeenCalledTimes(2);
  });

  it('urunler: isBillingSupported hata verirse boş', async () => {
    h.np.isBillingSupported.mockRejectedValue(new Error('x'));
    expect(await satinAlmaKur().urunler()).toEqual([]);
  });

  it('satinAl başarılı: seçenekler, jeton = purchaseToken', async () => {
    h.np.purchaseProduct.mockResolvedValue(islem('can_doldur', 'jeton-1'));
    const s = satinAlmaKur();
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'basarili', urun: 'can_doldur', jeton: 'jeton-1' });
    expect(h.np.purchaseProduct).toHaveBeenCalledWith({
      productIdentifier: 'can_doldur',
      productType: 'inapp',
      quantity: 1,
      autoAcknowledgePurchases: false,
      isConsumable: false,
    });
  });

  it('satinAl: iptal, beklemede, hata kodları; bilinmeyen ürün eklentiye gitmez', async () => {
    const s = satinAlmaKur();
    h.np.purchaseProduct.mockRejectedValueOnce(eklentiHatasi('Purchase is not purchased', 'USER_CANCELED'));
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'iptal' });
    h.np.purchaseProduct.mockRejectedValueOnce(eklentiHatasi('Purchase is pending'));
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'beklemede' });
    h.np.purchaseProduct.mockRejectedValueOnce(eklentiHatasi('Purchase is not purchased', 'SERVICE_UNAVAILABLE'));
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'hata' });
    h.np.purchaseProduct.mockRejectedValueOnce(eklentiHatasi('BILLING_SETUP_FAILED', 'Billing is not available on this device.'));
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'hata' });
    h.np.purchaseProduct.mockResolvedValueOnce({ ...islem('can_doldur', ''), transactionId: '' });
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'hata' });
    expect(await s.satinAl('baska' as never)).toEqual({ durum: 'hata' });
    expect(h.np.purchaseProduct).toHaveBeenCalledTimes(5);
  });

  it('satinAl: zaten sahip olunan ürün mağazadaki alımla başarılı döner; yoksa hata', async () => {
    const s = satinAlmaKur();
    h.np.purchaseProduct.mockRejectedValue(eklentiHatasi('Purchase is not purchased', 'ITEM_ALREADY_OWNED'));
    h.np.getPurchases.mockResolvedValueOnce({ purchases: [islem('usta_karti', 'eski-kart', { onayli: true })] });
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'basarili', urun: 'usta_karti', jeton: 'eski-kart' });
    // Onaylı kalıcı ürün yeniden onaylanmaz.
    await s.tamamla('eski-kart');
    expect(h.np.acknowledgePurchase).not.toHaveBeenCalled();
    h.np.getPurchases.mockResolvedValueOnce({ purchases: [] });
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'hata' });
    h.np.getPurchases.mockRejectedValueOnce(new Error('QUERY_PURCHASES_FAILED'));
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'hata' });
  });

  it('tamamla: tüketilir ürün tüketilir, kalıcı onaylanır (eşleme bellekte)', async () => {
    const s = satinAlmaKur();
    h.np.purchaseProduct.mockResolvedValueOnce(islem('guclendirici_paketi', 'p1'));
    h.np.purchaseProduct.mockResolvedValueOnce(islem('usta_karti', 'k1'));
    await s.satinAl('guclendirici_paketi');
    await s.satinAl('usta_karti');
    await s.tamamla('p1');
    await s.tamamla('k1');
    expect(h.np.consumePurchase).toHaveBeenCalledWith({ purchaseToken: 'p1' });
    expect(h.np.acknowledgePurchase).toHaveBeenCalledWith({ purchaseToken: 'k1' });
    expect(h.np.consumePurchase).toHaveBeenCalledTimes(1);
    expect(h.np.acknowledgePurchase).toHaveBeenCalledTimes(1);
    expect(h.np.getPurchases).not.toHaveBeenCalled();
    // İkinci tamamlama: kalıcı artık onaylı, bir şey yapılmaz.
    await s.tamamla('k1');
    expect(h.np.acknowledgePurchase).toHaveBeenCalledTimes(1);
  });

  it('tamamla: bilinmeyen jeton getPurchases ile çözülür; mağazada yoksa bir şey yapılmaz; hata reddedilir', async () => {
    const s = satinAlmaKur();
    h.np.getPurchases.mockResolvedValueOnce({ purchases: [islem('can_doldur', 'c9', { onayli: true })] });
    await s.tamamla('c9');
    expect(h.np.getPurchases).toHaveBeenCalledWith({ productType: 'inapp' });
    expect(h.np.consumePurchase).toHaveBeenCalledWith({ purchaseToken: 'c9' });
    await s.tamamla('yok-boyle');
    expect(h.np.consumePurchase).toHaveBeenCalledTimes(1);
    expect(h.np.acknowledgePurchase).not.toHaveBeenCalled();
    h.np.getPurchases.mockResolvedValueOnce({ purchases: [islem('can_doldur', 'c10')] });
    h.np.consumePurchase.mockRejectedValueOnce(new Error('Failed to consume purchase'));
    await expect(s.tamamla('c10')).rejects.toThrow();
    await s.tamamla('');
    expect(h.np.consumePurchase).toHaveBeenCalledTimes(2);
  });

  it('bekleyenler: tüketilmemiş tüketilirler ve onaylanmamış kalıcılar; bekleyen ödeme yok', async () => {
    h.np.getPurchases.mockResolvedValue({
      purchases: [
        islem('can_doldur', 'a', { onayli: true }),
        islem('guclendirici_paketi', 'b'),
        islem('usta_karti', 'c', { onayli: true }),
        islem('usta_karti', 'd'),
        islem('can_doldur', 'e', { durum: '2' }),
        islem('baska', 'f'),
      ],
    });
    const s = satinAlmaKur();
    expect(await s.bekleyenler()).toEqual([
      { urun: 'can_doldur', jeton: 'a' },
      { urun: 'guclendirici_paketi', jeton: 'b' },
      { urun: 'usta_karti', jeton: 'd' },
    ]);
    // Eşleme tazelendi: tamamla getPurchases'a yeniden gitmez.
    await s.tamamla('d');
    expect(h.np.getPurchases).toHaveBeenCalledTimes(1);
    expect(h.np.acknowledgePurchase).toHaveBeenCalledWith({ purchaseToken: 'd' });
  });

  it('bekleyenler: mağazaya ulaşılamazsa reddeder', async () => {
    h.np.getPurchases.mockRejectedValue(eklentiHatasi('Failed to query purchases', 'QUERY_PURCHASES_FAILED'));
    await expect(satinAlmaKur().bekleyenler()).rejects.toThrow();
  });

  it('geriYukle: restorePurchases + getPurchases; yalnız kalıcı ürünler (onaylı ya da değil)', async () => {
    const s = satinAlmaKur();
    h.np.getPurchases.mockResolvedValueOnce({ purchases: [islem('can_doldur', 'a'), islem('usta_karti', 'k', { onayli: true }), islem('usta_karti', 'k2')] });
    expect(await s.geriYukle()).toEqual(['usta_karti']);
    expect(h.np.restorePurchases.mock.invocationCallOrder[0]).toBeLessThan(h.np.getPurchases.mock.invocationCallOrder[0]);
    h.np.getPurchases.mockResolvedValueOnce({ purchases: [islem('can_doldur', 'a')] });
    expect(await s.geriYukle()).toEqual([]);
    h.np.restorePurchases.mockRejectedValueOnce(new Error('x'));
    h.np.getPurchases.mockResolvedValueOnce({ purchases: [islem('usta_karti', 'k')] });
    expect(await s.geriYukle()).toEqual(['usta_karti']);
    h.np.getPurchases.mockRejectedValueOnce(new Error('QUERY_PURCHASES_FAILED'));
    await expect(s.geriYukle()).rejects.toThrow();
  });

  it('kuyruk: çağrılar üst üste binmez (yeni BillingClient öncekini kapatırdı)', async () => {
    const urunlerSozu = ertele<{ products: unknown[] }>();
    h.np.getProducts.mockReturnValueOnce(urunlerSozu.soz);
    const s = satinAlmaKur();
    const a = s.urunler();
    const b = s.bekleyenler();
    await akit();
    expect(h.np.getProducts).toHaveBeenCalledTimes(1);
    expect(h.np.getPurchases).not.toHaveBeenCalled();
    urunlerSozu.coz({ products: [urun('can_doldur', '₺29,99')] });
    expect(await a).toEqual([{ id: 'can_doldur', fiyat: '₺29,99' }]);
    expect(await b).toEqual([]);
    expect(h.np.getPurchases).toHaveBeenCalledTimes(1);
  });

  it('kuyruk: yanıt vermeyen çağrıdan sonra süre sınırında ilerler', async () => {
    h.np.purchaseProduct.mockReturnValue(new Promise(() => undefined));
    const s = satinAlmaKur({ satin: 5000, kisa: 1000 });
    void s.satinAl('can_doldur');
    const b = s.bekleyenler();
    await vi.advanceTimersByTimeAsync(4999);
    expect(h.np.getPurchases).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.np.getPurchases).toHaveBeenCalledTimes(1);
    expect(await b).toEqual([]);
  });
});
