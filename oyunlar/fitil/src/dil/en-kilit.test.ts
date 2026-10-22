/**
 * Meta açılış kilitlerinin metinleri (Ekim 2026: Usta Bölümleri 12., Günün
 * Şenliği 14. bölümden sonra; ilk oturum denetimi). İki dil: Türkçe çıktı
 * birebir, İngilizcede Türkçe harf yok. Dil modüller yüklenmeden önce açılır
 * (yalnız dinamik içe aktarım; Türkçe için `vi.resetModules`).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

const g = globalThis as { __FITIL_DIL__?: string };

type Mod = typeof import('../ui/metinler');
let en: Mod;
let tr: Mod;

beforeAll(async () => {
  g.__FITIL_DIL__ = 'en';
  en = await import('../ui/metinler');
  vi.resetModules();
  g.__FITIL_DIL__ = 'tr';
  tr = await import('../ui/metinler');
});

describe('kilit metinleri (Usta 12, Günün Şenliği 14)', () => {
  it('Türkçe', () => {
    expect(tr.M.gunlukKilitli(14)).toBe('14. bölümden sonra açılır');
    expect(tr.M.kilitliUsta(15)).toBe('15 yıldızda açılır');
    expect(tr.M.kilitliUstaBolum(12)).toBe('12. bölümden sonra açılır');
    expect(tr.M.kilitliUstaIkisi(30, 12)).toBe('30 yıldız ve 12. bölüm gerekir');
    expect(tr.M.ustaKapiEtiket(12)).toEqual(['12. bölümden', 'sonra']);
  });

  it('İngilizce: Türkçe harf yok', () => {
    const metinler = [en.M.gunlukKilitli(14), en.M.kilitliUstaBolum(12), en.M.kilitliUstaIkisi(30, 12), ...en.M.ustaKapiEtiket(12)];
    expect(metinler).toEqual(['Opens after level 14', 'Opens after level 12', 'Needs 30 stars and level 12', 'After', 'level 12']);
    for (const s of metinler) expect(s).not.toMatch(/[ğüşıöçĞÜŞİÖÇ]/);
  });
});
