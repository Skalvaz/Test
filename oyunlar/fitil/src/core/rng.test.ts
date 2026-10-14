import { describe, expect, it } from 'vitest';
import { agirlikliSec, oyunTohumu, rngInt, rngSonraki } from './rng';

describe('çekirdek RNG (mulberry32)', () => {
  it('bilinen çıktı: tohum 0', () => {
    const d = { rng: 0 };
    // mulberry32(0) başvuru değerleri
    expect(rngSonraki(d)).toBe(1144304738);
    expect(rngSonraki(d)).toBe(1416247);
  });

  it('rngInt aralıkta', () => {
    const d = { rng: 123 };
    for (let i = 0; i < 1000; i++) {
      const v = rngInt(d, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it('ağırlık 0 seçilmez', () => {
    const d = { rng: 5 };
    for (let i = 0; i < 500; i++) expect(agirlikliSec(d, [3, 0, 1])).not.toBe(1);
  });

  it('deneme tohumları farklı, belirlenimli', () => {
    expect(oyunTohumu(42, 0)).toBe(oyunTohumu(42, 0));
    expect(oyunTohumu(42, 0)).not.toBe(oyunTohumu(42, 1));
  });
});
