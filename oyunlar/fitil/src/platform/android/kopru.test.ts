/**
 * `FitilYerel.gelir` biçimi (CAN-REKLAM §5.1): JSON dönen yöntemler METİN
 * döner (sarmalayıcı nesneyi de kabul ederdi; sözleşme metin), reklam ve
 * satın alma reddetmez, geri yükleme hatası reddedilir.
 */
import { describe, expect, it, vi } from 'vitest';
import { gelirKoprusu } from './kopru';
import type { SatinAlma } from './satin';
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
    const k = gelirKoprusu({ hazirMi: () => true, goster: async () => 'odul' }, sahteSatin());
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
        hazirMi: () => {
          throw new Error('x');
        },
        goster: async () => {
          throw new Error('x');
        },
      },
      satin,
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
      { hazirMi: () => false, goster: async () => 'yok' },
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
    );
    await expect(k.geriYukle()).rejects.toThrow();
    const s = androidSaglayici(k);
    await expect(s.geriYukle()).rejects.toThrow(GERI_YUKLEME_HATASI);
    expect(await s.urunler()).toEqual([]);
    expect(await s.bekleyenler()).toEqual([]);
    expect(await s.reklamGoster('can')).toBe('yok');
  });
});
