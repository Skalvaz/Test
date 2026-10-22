import { describe, expect, it } from 'vitest';
import {
  GERI_YUKLEME_HATASI,
  androidSaglayici,
  bekleyenlerCoz,
  geriYukleCoz,
  gelirSaglayici,
  gelirSaglayiciKur,
  gelirSecimi,
  olculenSaglayici,
  reklamSonucuCoz,
  satinAlmaCoz,
  urunlerCoz,
  type AndroidGelirKoprusu,
  type GelirOlayYazici,
  type GelirSaglayici,
  type GelirSecimGirdisi,
} from './gelir';

const girdi = (g: Partial<GelirSecimGirdisi>): GelirSecimGirdisi => ({ kopru: undefined, adres: '', depo: null, ...g });

/** Yanıtları elle verilen sahte köprü; çağrıları sayar. */
function kopruKur(y: Partial<Record<keyof AndroidGelirKoprusu, unknown>>): AndroidGelirKoprusu & { cagri: string[] } {
  const cagri: string[] = [];
  const yanit = (ad: keyof AndroidGelirKoprusu, ...a: unknown[]) => {
    cagri.push(`${ad}(${a.join(',')})`);
    const v = y[ad];
    return typeof v === 'function' ? (v as (...x: unknown[]) => unknown)(...a) : v;
  };
  return {
    cagri,
    reklamHazir: (yer) => yanit('reklamHazir', yer) as boolean,
    reklamGoster: (yer) => yanit('reklamGoster', yer) as Promise<string>,
    urunler: () => yanit('urunler') as Promise<string>,
    satinAl: (id) => yanit('satinAl', id) as Promise<string>,
    tamamla: (j) => yanit('tamamla', j) as Promise<void>,
    bekleyenler: () => yanit('bekleyenler') as Promise<string>,
    geriYukle: () => yanit('geriYukle') as Promise<string>,
  };
}

const KISA = { reklam: 50, satin: 50, kisa: 50 };
const hic = () => new Promise<never>(() => {});

describe('sağlayıcı seçimi (§5)', () => {
  it('Android köprüsü her şeyden önce gelir', () => {
    expect(gelirSecimi(girdi({ kopru: {} }))).toBe('android');
    expect(gelirSecimi(girdi({ kopru: {}, adres: '?gelir=yok', depo: 'sahte' }))).toBe('android');
  });
  it('?gelir=sahte ya da cihaz anahtarı sahte sağlayıcıyı açar', () => {
    expect(gelirSecimi(girdi({ adres: '?gelir=sahte' }))).toBe('sahte');
    expect(gelirSecimi(girdi({ adres: '?dil=en&gelir=sahte&reklam=hizli' }))).toBe('sahte');
    expect(gelirSecimi(girdi({ depo: 'sahte' }))).toBe('sahte');
  });
  it('?gelir=yok cihaz anahtarını bu sayfa için kapatır; başka değerler yok sayılır', () => {
    expect(gelirSecimi(girdi({ adres: '?gelir=yok', depo: 'sahte' }))).toBeNull();
    expect(gelirSecimi(girdi({ adres: '?gelir=android' }))).toBeNull();
    expect(gelirSecimi(girdi({ depo: 'SAHTE' }))).toBeNull();
  });
  it('köprü, adres ve depo yoksa null (claude.ai, fitil.html)', () => {
    expect(gelirSecimi(girdi({}))).toBeNull();
    expect(gelirSecimi(girdi({ kopru: null }))).toBeNull();
    expect(gelirSecimi(girdi({ kopru: 'evet' }))).toBeNull();
  });
  it('kurulum: seçime göre sarmalı sağlayıcı ya da null', () => {
    expect(gelirSaglayiciKur(girdi({}))).toBeNull();
    expect(gelirSaglayiciKur(girdi({ kopru: {} }))?.ad).toBe('android');
    expect(gelirSaglayiciKur(girdi({ adres: '?gelir=sahte' }))?.ad).toBe('sahte');
  });
  it('gelirSaglayici sayfa başına bir kez seçer (Node: sağlayıcı yok)', () => {
    expect(gelirSaglayici()).toBeNull();
    expect(gelirSaglayici()).toBe(gelirSaglayici());
  });
});

describe('köprü yanıtlarının çözümü', () => {
  it('reklam sonucu: bilinmeyen her değer hata', () => {
    expect(reklamSonucuCoz('odul')).toBe('odul');
    expect(reklamSonucuCoz(' iptal ')).toBe('iptal');
    expect(reklamSonucuCoz('yok')).toBe('yok');
    for (const x of ['ODUL', '', '"odul"', null, undefined, 1, {}]) expect(reklamSonucuCoz(x)).toBe('hata');
  });
  it('ürünler: JSON metni ya da dizi; geçersiz, tekrar ve boş fiyat atlanır; Mağaza sırası', () => {
    const j = JSON.stringify([
      { id: 'usta_karti', fiyat: '₺149,99' },
      { id: 'can_doldur', fiyat: ' ₺29,99 ' },
      { id: 'can_doldur', fiyat: '₺1' },
      { id: 'elmas', fiyat: '₺5' },
      { id: 'guclendirici_paketi', fiyat: '' },
      { id: 'guclendirici_paketi', fiyat: 59.99 },
      null,
      'can_doldur',
    ]);
    expect(urunlerCoz(j)).toEqual([
      { id: 'can_doldur', fiyat: '₺29,99' },
      { id: 'usta_karti', fiyat: '₺149,99' },
    ]);
    expect(urunlerCoz([{ id: 'can_doldur', fiyat: '$0.99' }])).toEqual([{ id: 'can_doldur', fiyat: '$0.99' }]);
    for (const x of ['{bozuk', '{}', 'null', '', undefined, 3]) expect(urunlerCoz(x)).toEqual([]);
    expect(urunlerCoz([{ id: 'can_doldur', fiyat: 'x'.repeat(100) }])[0].fiyat).toHaveLength(32);
  });
  it('satın alma: başarılı için bilinen ürün + jeton şart, değilse hata', () => {
    expect(satinAlmaCoz('{"durum":"basarili","urun":"can_doldur","jeton":"j1"}')).toEqual({ durum: 'basarili', urun: 'can_doldur', jeton: 'j1' });
    expect(satinAlmaCoz({ durum: 'basarili', urun: 'usta_karti', jeton: 'j2', fazla: 1 })).toEqual({ durum: 'basarili', urun: 'usta_karti', jeton: 'j2' });
    expect(satinAlmaCoz('{"durum":"basarili","urun":"can_doldur"}')).toEqual({ durum: 'hata' });
    expect(satinAlmaCoz('{"durum":"basarili","urun":"can_doldur","jeton":""}')).toEqual({ durum: 'hata' });
    expect(satinAlmaCoz('{"durum":"basarili","urun":"elmas","jeton":"j"}')).toEqual({ durum: 'hata' });
    for (const d of ['iptal', 'beklemede', 'hata'] as const) expect(satinAlmaCoz(JSON.stringify({ durum: d, urun: 'x' }))).toEqual({ durum: d });
    for (const x of ['{"durum":"tamam"}', '[]', 'bozuk', '', null, undefined]) expect(satinAlmaCoz(x)).toEqual({ durum: 'hata' });
  });
  it('bekleyenler: geçersizler atlanır, jetona göre tekil', () => {
    const j = JSON.stringify([
      { urun: 'can_doldur', jeton: 'a' },
      { urun: 'can_doldur', jeton: 'a' },
      { urun: 'guclendirici_paketi', jeton: 'b' },
      { urun: 'elmas', jeton: 'c' },
      { urun: 'usta_karti' },
      { urun: 'usta_karti', jeton: 7 },
    ]);
    expect(bekleyenlerCoz(j)).toEqual([
      { urun: 'can_doldur', jeton: 'a' },
      { urun: 'guclendirici_paketi', jeton: 'b' },
    ]);
    for (const x of ['bozuk', '{}', undefined]) expect(bekleyenlerCoz(x)).toEqual([]);
  });
  it('geri yükleme: yalnız bilinen kalıcı ürünler, tekil', () => {
    expect(geriYukleCoz('["can_doldur","usta_karti","usta_karti","elmas"]')).toEqual(['usta_karti']);
    expect(geriYukleCoz(['usta_karti'])).toEqual(['usta_karti']);
    for (const x of ['bozuk', '"usta_karti"', '{}', null]) expect(geriYukleCoz(x)).toEqual([]);
  });
});

describe('Android köprü sarmalayıcısı (§5.1)', () => {
  it('JSON yanıtları çözer ve yöntemleri iletir', async () => {
    const k = kopruKur({
      reklamHazir: (yer: string) => yer === 'can',
      reklamGoster: async () => 'odul',
      urunler: async () => JSON.stringify([{ id: 'can_doldur', fiyat: '₺29,99' }]),
      satinAl: async (id: string) => JSON.stringify({ durum: 'basarili', urun: id, jeton: 'gp-1' }),
      tamamla: async () => undefined,
      bekleyenler: async () => JSON.stringify([{ urun: 'guclendirici_paketi', jeton: 'gp-0' }]),
      geriYukle: async () => '["usta_karti"]',
    });
    const s = androidSaglayici(k, KISA);
    expect(s.ad).toBe('android');
    expect(s.reklamHazir('can')).toBe(true);
    expect(s.reklamHazir('hamle')).toBe(false);
    expect(await s.reklamGoster('hamle')).toBe('odul');
    expect(await s.urunler()).toEqual([{ id: 'can_doldur', fiyat: '₺29,99' }]);
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'basarili', urun: 'usta_karti', jeton: 'gp-1' });
    await s.tamamla('gp-1');
    expect(await s.bekleyenler()).toEqual([{ urun: 'guclendirici_paketi', jeton: 'gp-0' }]);
    expect(await s.geriYukle()).toEqual(['usta_karti']);
    expect(k.cagri).toEqual([
      'reklamHazir(can)',
      'reklamHazir(hamle)',
      'reklamGoster(hamle)',
      'urunler()',
      'satinAl(usta_karti)',
      'tamamla(gp-1)',
      'bekleyenler()',
      'geriYukle()',
    ]);
  });

  it('fırlatan, reddeden ya da tuhaf dönen köprüde hiç fırlatmaz', async () => {
    const at = () => {
      throw new Error('köprü');
    };
    const reddet = async () => {
      throw new Error('köprü');
    };
    for (const kotu of [at, reddet]) {
      const s = androidSaglayici(kopruKur({ reklamHazir: at, reklamGoster: kotu, urunler: kotu, satinAl: kotu, tamamla: kotu, bekleyenler: kotu, geriYukle: kotu }), KISA);
      expect(s.reklamHazir('can')).toBe(false);
      expect(await s.reklamGoster('can')).toBe('hata');
      expect(await s.urunler()).toEqual([]);
      expect(await s.satinAl('can_doldur')).toEqual({ durum: 'hata' });
      await expect(s.tamamla('j')).resolves.toBeUndefined();
      expect(await s.bekleyenler()).toEqual([]);
      // Geri yükleme yapılamadı: boş liste ("yok") değil, ret ("yapılamadı").
      await expect(s.geriYukle()).rejects.toThrow(GERI_YUKLEME_HATASI);
    }
    // Promise yerine düz değer, eksik yöntemler, "true" metni.
    const t = androidSaglayici(kopruKur({ reklamHazir: 'true', reklamGoster: 'iptal', urunler: '[]', satinAl: 42 }), KISA);
    expect(t.reklamHazir('can')).toBe(false);
    expect(await t.reklamGoster('can')).toBe('iptal');
    expect(await t.urunler()).toEqual([]);
    expect(await t.satinAl('can_doldur')).toEqual({ durum: 'hata' });
    const bos = androidSaglayici({} as AndroidGelirKoprusu, KISA);
    expect(bos.reklamHazir('can')).toBe(false);
    expect(await bos.reklamGoster('can')).toBe('hata');
    expect(await bos.bekleyenler()).toEqual([]);
    await expect(bos.tamamla('j')).resolves.toBeUndefined();
  });

  it('yanıt vermeyen köprü süre sınırında hata / boş liste döner', async () => {
    const s = androidSaglayici(kopruKur({ reklamGoster: hic, urunler: hic, satinAl: hic, tamamla: hic, bekleyenler: hic, geriYukle: hic }), KISA);
    expect(await s.reklamGoster('can')).toBe('hata');
    expect(await s.urunler()).toEqual([]);
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'hata' });
    await expect(s.tamamla('j')).resolves.toBeUndefined();
    expect(await s.bekleyenler()).toEqual([]);
    await expect(s.geriYukle()).rejects.toThrow(GERI_YUKLEME_HATASI);
    // Bozuk (dizi olmayan) yanıt da "yapılamadı"; boş dizi "yok".
    await expect(androidSaglayici(kopruKur({ geriYukle: async () => '{}' }), KISA).geriYukle()).rejects.toThrow(GERI_YUKLEME_HATASI);
    expect(await androidSaglayici(kopruKur({ geriYukle: async () => '[]' }), KISA).geriYukle()).toEqual([]);
  });

  it('reklam ve satın alma süresi yalnız sayfa görünürken işler (reklam ekranı öndeyken geç sonuç yutulmaz)', async () => {
    const g = globalThis as { document?: unknown };
    const onceki = g.document;
    const belge = { hidden: true };
    g.document = belge;
    try {
      let coz: (x: string) => void = () => undefined;
      const s = androidSaglayici(kopruKur({ reklamGoster: () => new Promise<string>((r) => (coz = r)) }), KISA);
      const sonuc = s.reklamGoster('can');
      // Sayfa gizliyken süre sınırının 4 katı geçer: hâlâ bekler, geç gelen ödül kaybolmaz.
      await new Promise((r) => setTimeout(r, 200));
      coz('odul');
      expect(await sonuc).toBe('odul');
      // Görünür sayfada yanıt vermeyen köprü yine süre sınırında 'hata'.
      belge.hidden = false;
      expect(await androidSaglayici(kopruKur({ reklamGoster: hic, satinAl: hic }), KISA).reklamGoster('can')).toBe('hata');
    } finally {
      g.document = onceki;
    }
  });

  it('bilinmeyen ürün ve boş jeton köprüye gitmez', async () => {
    const k = kopruKur({ satinAl: async () => '{}', tamamla: async () => undefined });
    const s = androidSaglayici(k, KISA);
    expect(await s.satinAl('elmas' as never)).toEqual({ durum: 'hata' });
    await s.tamamla('');
    expect(k.cagri).toEqual([]);
  });
});

describe('ölçüm sarmalayıcısı (§8)', () => {
  function kaydedici() {
    const olaylar: [string, unknown][] = [];
    const olay: GelirOlayYazici = (ad, p) => {
      olaylar.push([ad, p]);
    };
    return { olaylar, olay };
  }
  const ic = (y: Partial<GelirSaglayici>): GelirSaglayici => ({
    ad: 'sahte',
    reklamHazir: () => true,
    reklamGoster: async () => 'odul',
    urunler: async () => [],
    satinAl: async (id) => ({ durum: 'basarili', urun: id, jeton: 'j' }),
    tamamla: async () => undefined,
    bekleyenler: async () => [],
    geriYukle: async () => [],
    ...y,
  });

  it('reklam sonucu ve satın alma olaylarını yazar (jeton yazılmaz)', async () => {
    const { olaylar, olay } = kaydedici();
    const s = olculenSaglayici(ic({ geriYukle: async () => ['usta_karti'] }), olay);
    expect(s.ad).toBe('sahte');
    expect(await s.reklamGoster('hamle')).toBe('odul');
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'basarili', urun: 'can_doldur', jeton: 'j' });
    expect(await s.geriYukle()).toEqual(['usta_karti']);
    expect(olaylar).toEqual([
      ['reklam_sonuc', { yer: 'hamle', sonuc: 'odul', kart: false }],
      ['satin_alma', { urun: 'can_doldur', durum: 'basla' }],
      ['satin_alma', { urun: 'can_doldur', durum: 'basarili' }],
      ['satin_alma', { urun: 'usta_karti', durum: 'geri_yukle' }],
    ]);
  });

  it('iptal, beklemede, hata ve reklam sonuçları; ölçülmeyen yöntemler sessiz', async () => {
    const { olaylar, olay } = kaydedici();
    const sonuclar = ['iptal', 'beklemede', 'hata'] as const;
    let i = 0;
    const s = olculenSaglayici(ic({ satinAl: async () => ({ durum: sonuclar[i++] }), reklamGoster: async () => 'yok' }), olay);
    for (let n = 0; n < 3; n++) await s.satinAl('guclendirici_paketi');
    expect(await s.reklamGoster('can')).toBe('yok');
    await s.urunler();
    await s.bekleyenler();
    await s.tamamla('j');
    s.reklamHazir('can');
    expect(olaylar.map(([a, p]) => `${a}:${Object.values(p as object).join('/')}`)).toEqual([
      'satin_alma:guclendirici_paketi/basla',
      'satin_alma:guclendirici_paketi/iptal',
      'satin_alma:guclendirici_paketi/basla',
      'satin_alma:guclendirici_paketi/beklemede',
      'satin_alma:guclendirici_paketi/basla',
      'satin_alma:guclendirici_paketi/hata',
      'reklam_sonuc:can/yok/false',
    ]);
  });

  it('sözleşme dışı iç yanıtları çözümleyiciden geçirir', async () => {
    const { olaylar, olay } = kaydedici();
    const s = olculenSaglayici(
      ic({
        satinAl: async () => ({ durum: 'basarili' }) as never,
        urunler: async () => [{ id: 'elmas', fiyat: '₺1' }, { id: 'can_doldur', fiyat: '₺2' }] as never,
        bekleyenler: async () => [{ urun: 'can_doldur', jeton: '' }] as never,
        geriYukle: async () => ['can_doldur', 'usta_karti'],
      }),
      olay,
    );
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'hata' });
    expect(await s.urunler()).toEqual([{ id: 'can_doldur', fiyat: '₺2' }]);
    expect(await s.bekleyenler()).toEqual([]);
    expect(await s.geriYukle()).toEqual(['usta_karti']);
    expect(olaylar).toEqual([
      ['satin_alma', { urun: 'can_doldur', durum: 'basla' }],
      ['satin_alma', { urun: 'can_doldur', durum: 'hata' }],
      ['satin_alma', { urun: 'usta_karti', durum: 'geri_yukle' }],
    ]);
  });

  it('iç sağlayıcı ya da ölçüm fırlatsa da fırlatmaz', async () => {
    const at = () => {
      throw new Error('iç');
    };
    const { olaylar, olay } = kaydedici();
    const s = olculenSaglayici(
      { ad: 'android', reklamHazir: at, reklamGoster: at, urunler: at, satinAl: at, tamamla: at, bekleyenler: at, geriYukle: at },
      olay,
    );
    expect(s.reklamHazir('can')).toBe(false);
    expect(await s.reklamGoster('can')).toBe('hata');
    expect(await s.urunler()).toEqual([]);
    expect(await s.satinAl('usta_karti')).toEqual({ durum: 'hata' });
    await expect(s.tamamla('j')).resolves.toBeUndefined();
    expect(await s.bekleyenler()).toEqual([]);
    // Geri yükleme: içerideki hata "yapılamadı" olarak geçer (ölçüm olayı yok).
    await expect(s.geriYukle()).rejects.toThrow(GERI_YUKLEME_HATASI);
    expect(olaylar.map(([a]) => a)).toEqual(['reklam_sonuc', 'satin_alma', 'satin_alma']);

    const t = olculenSaglayici(ic({ reklamGoster: async () => 'bilinmeyen' as never }), () => {
      throw new Error('ölçüm');
    });
    expect(await t.reklamGoster('can')).toBe('hata');
    expect(await t.satinAl('can_doldur')).toEqual({ durum: 'basarili', urun: 'can_doldur', jeton: 'j' });
  });
});
