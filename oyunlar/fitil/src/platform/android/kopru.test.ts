/**
 * `FitilYerel.gelir` biçimi (CAN-REKLAM §5.1): JSON dönen yöntemler METİN
 * döner (sarmalayıcı nesneyi de kabul ederdi; sözleşme metin), reklam ve
 * satın alma reddetmez, geri yükleme hatası reddedilir.
 */
import { describe, expect, it, vi } from 'vitest';
import { gelirKoprusu, type IzinDeposu } from './kopru';
import type { ReklamIzni } from '../reklamIzni';
import type { SatinAlma } from './satin';

/** İzin verilmiş depo (bellekte). */
function izinli(i: ReklamIzni | null = { izin: true, kisisel: false, tarih: 1 }): IzinDeposu & { deger: ReklamIzni | null } {
  const d = { deger: i, oku: () => d.deger, yaz: (x: ReklamIzni) => (d.deger = x) };
  return d;
}
const ekYontem = { baslat: vi.fn(async () => undefined), durdur: vi.fn(), hazirBekle: vi.fn(async () => false) };
import { androidSaglayici, GERI_YUKLEME_HATASI } from '../gelir';

function sahteSatin(o: Partial<SatinAlma> = {}): SatinAlma {
  return {
    urunler: vi.fn(async () => [{ id: 'can_doldur' as const, fiyat: '₺29,99' }]),
    satinAl: vi.fn(async (id) => ({ durum: 'basarili' as const, urun: id, jeton: 'j' })),
    tamamla: vi.fn(async () => undefined),
    bekleyenler: vi.fn(async () => [{ urun: 'usta_karti' as const, jeton: 'k' }]),
    geriYukle: vi.fn(async () => ['usta_karti' as const]),
    ...o,
  };
}

describe('gelirKoprusu', () => {
  it('JSON yöntemleri metin döner, biçim sarmalayıcının beklediği', async () => {
    const k = gelirKoprusu({ ...ekYontem, hazirMi: () => true, goster: async () => 'odul' }, sahteSatin(), izinli());
    const u = await k.urunler();
    expect(typeof u).toBe('string');
    expect(JSON.parse(u)).toEqual([{ id: 'can_doldur', fiyat: '₺29,99' }]);
    expect(JSON.parse(await k.satinAl('usta_karti'))).toEqual({ durum: 'basarili', urun: 'usta_karti', jeton: 'j' });
    expect(JSON.parse(await k.bekleyenler())).toEqual([{ urun: 'usta_karti', jeton: 'k' }]);
    expect(JSON.parse(await k.geriYukle())).toEqual(['usta_karti']);
    expect(await k.reklamGoster('can')).toBe('odul');
    expect(k.reklamHazir('hamle')).toBe(true);
  });

  it('bilinmeyen ürün ve yer: hata (eklentiye gitmez); fırlatan modül reddetmez', async () => {
    const satin = sahteSatin({
      satinAl: vi.fn(async () => {
        throw new Error('x');
      }),
    });
    const k = gelirKoprusu(
      {
        ...ekYontem,
        hazirMi: () => {
          throw new Error('x');
        },
        goster: async () => {
          throw new Error('x');
        },
      },
      satin,
      izinli(),
    );
    expect(JSON.parse(await k.satinAl('baska'))).toEqual({ durum: 'hata' });
    expect(JSON.parse(await k.satinAl('can_doldur'))).toEqual({ durum: 'hata' });
    expect(satin.satinAl).toHaveBeenCalledTimes(1);
    expect(k.reklamHazir('can')).toBe(false);
    expect(k.reklamHazir('baska')).toBe(false);
    expect(await k.reklamGoster('can')).toBe('hata');
    expect(await k.reklamGoster('baska')).toBe('hata');
  });

  it('sarmalayıcı: geri yükleme reddi "yapılamadı"; ürün/bekleyen reddi boş liste', async () => {
    const k = gelirKoprusu(
      { ...ekYontem, hazirMi: () => false, goster: async () => 'yok' },
      sahteSatin({
        urunler: async () => {
          throw new Error('x');
        },
        bekleyenler: async () => {
          throw new Error('x');
        },
        geriYukle: async () => {
          throw new Error('x');
        },
      }),
      izinli(),
    );
    await expect(k.geriYukle()).rejects.toThrow();
    const s = androidSaglayici(k);
    await expect(s.geriYukle()).rejects.toThrow(GERI_YUKLEME_HATASI);
    expect(await s.urunler()).toEqual([]);
    expect(await s.bekleyenler()).toEqual([]);
    expect(await s.reklamGoster('can')).toBe('yok');
  });

  it('(YASAL-UYUM §2) izin sorulmadan reklam SDK\'sı başlamaz; izin verilince başlar, geri alınınca durur', async () => {
    const r = { baslat: vi.fn(async () => undefined), durdur: vi.fn(), hazirBekle: vi.fn(async () => true), hazirMi: vi.fn(() => false), goster: vi.fn(async () => 'odul' as const) };
    const depo = izinli(null);
    const k = gelirKoprusu(r, sahteSatin(), depo);
    // Sorulmadı: düğme görünür (ilk dokunuşta sorulur) ama gösterim yok, SDK başlamadı.
    expect(k.reklamHazir('can')).toBe(true);
    expect(await k.reklamGoster('can')).toBe('yok');
    expect(r.baslat).not.toHaveBeenCalled();
    expect(k.reklamIzni?.()).toBe('');
    const s = androidSaglayici(k);
    expect(s.reklamIzni?.()).toBeNull();
    // İzin: SDK başlar, ilk reklam beklenir ve gösterilir; kişiselleştirme ayrı.
    s.reklamIzniVer?.({ izin: true, kisisel: false, tarih: 5 });
    expect(r.baslat).toHaveBeenCalledTimes(1);
    expect(depo.deger).toEqual({ izin: true, kisisel: false, tarih: 5 });
    expect(await k.reklamGoster('can')).toBe('odul');
    expect(r.hazirBekle).toHaveBeenCalled();
    // Geri alma: SDK durur, düğme kaybolur.
    s.reklamIzniVer?.({ izin: false, kisisel: true, tarih: 6 });
    expect(r.durdur).toHaveBeenCalledTimes(1);
    expect(depo.deger).toEqual({ izin: false, kisisel: false, tarih: 6 });
    expect(k.reklamHazir('can')).toBe(false);
    expect(await k.reklamGoster('can')).toBe('yok');
  });
});
