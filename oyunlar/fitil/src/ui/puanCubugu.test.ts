import { describe, expect, it } from 'vitest';
import { EN_AZ_ARALIK, puanOrani, yildizKonumlari } from './puanCubugu';

describe('puan çubuğu (§13.7): yıldız işaretleri üst üste binmez', () => {
  it('yakın eşiklerde (bölüm 1: 2600/2900) 2★ ve 3★ arasında en az %20', () => {
    const [, k2, k3] = yildizKonumlari([2600, 2900]);
    expect(k3 - k2).toBeGreaterThanOrEqual(EN_AZ_ARALIK - 1e-9);
    expect(k3).toBeLessThanOrEqual(0.9);
  });

  it('uzak eşiklerde doğrusal konum korunur', () => {
    const [, k2, k3] = yildizKonumlari([3000, 9000]);
    const tavan = 9000 * 1.12;
    expect(k2).toBeCloseTo(3000 / tavan, 6);
    expect(k3).toBeCloseTo(9000 / tavan, 6);
  });

  it('dolgu tam eşikte işarete ulaşır ve monoton artar', () => {
    for (const e of [[2600, 2900], [3000, 4500], [6800, 8100], [500, 520], [0, 0]] as [number, number][]) {
      const [, k2, k3] = yildizKonumlari(e);
      if (e[0] > 0) expect(puanOrani(e[0], e)).toBeCloseTo(k2, 6);
      if (e[1] > e[0]) expect(puanOrani(e[1], e)).toBeCloseTo(k3, 6);
      let once = -1;
      for (let p = 0; p <= e[1] * 1.5 + 10; p += Math.max(1, e[1] / 50)) {
        const o = puanOrani(p, e);
        expect(o).toBeGreaterThanOrEqual(once - 1e-9);
        expect(o).toBeLessThanOrEqual(1);
        once = o;
      }
    }
  });
});
