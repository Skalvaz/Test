import { describe, expect, it } from 'vitest';
import { gorunumGenisligi, tabletOlcegi } from './gorunum';

describe('tablet görünümü', () => {
  it('telefonda ölçek 1 ve görünüm değişmez', () => {
    for (const k of [320, 360, 390, 430, 600]) {
      expect(tabletOlcegi(k)).toBe(1);
      expect(gorunumGenisligi(k, k)).toBeNull();
    }
  });
  it('tablette kısa kenar 600 dp\'ye iner; ölçek en çok 1,5', () => {
    expect(tabletOlcegi(800)).toBeCloseTo(800 / 600);
    expect(gorunumGenisligi(800, 800)).toBe(600);
    expect(gorunumGenisligi(1280, 800)).toBe(960); // yatay
    expect(tabletOlcegi(1024)).toBe(1.5);
    expect(gorunumGenisligi(1024, 1024)).toBe(683);
    expect(gorunumGenisligi(673, 673)).toBe(600); // katlanır telefon açık
  });
  it('geçersiz girdide değişiklik yok', () => {
    expect(gorunumGenisligi(0, 800)).toBeNull();
    expect(tabletOlcegi(Number.NaN)).toBe(1);
  });
});
