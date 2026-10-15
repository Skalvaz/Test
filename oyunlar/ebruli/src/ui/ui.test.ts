import { describe, expect, it } from 'vitest';
import { EN_AZ_ARALIK, puanOrani, yildizKonumlari, doluIsaret } from './puanCubugu';
import { kazandinYerlesimi, SIFIR_KENAR, yerlesimHesapla } from './yerlesim';

describe('puan çubuğu (§11.6): işaretler üst üste binmez', () => {
  const ornekler: [number, number][] = [
    [1200, 1800],
    [3200, 3700],
    [3600, 3700],
    [100, 100],
    [0, 0],
    [5000, 12000],
    [9000, 9050],
  ];
  it('işaretler artan ve en az %22 aralıklı, [0, 1] içinde', () => {
    for (const e of ornekler) {
      const [a, b, c] = yildizKonumlari(e);
      expect(b - a).toBeGreaterThanOrEqual(EN_AZ_ARALIK - 1e-9);
      expect(c - b).toBeGreaterThanOrEqual(EN_AZ_ARALIK - 1e-9);
      expect(a).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(0.94 + 1e-9);
    }
  });
  it('dolgu tam eşikte işarete ulaşır ve monotondur', () => {
    for (const e of ornekler) {
      if (e[0] <= 0) continue;
      const [, b, c] = yildizKonumlari(e);
      if (e[0] < e[1]) expect(puanOrani(e[0], e)).toBeCloseTo(b, 9);
      expect(puanOrani(e[1], e)).toBeCloseTo(c, 9);
      let onceki = -1;
      for (let p = 0; p <= e[1] * 1.3; p += Math.max(1, e[1] / 50)) {
        const o = puanOrani(p, e);
        expect(o).toBeGreaterThanOrEqual(onceki);
        expect(o).toBeLessThanOrEqual(1);
        onceki = o;
      }
    }
  });
  it('dolu işaret sayısı', () => {
    expect(doluIsaret(5000, [3000, 4000], false)).toBe(0);
    expect(doluIsaret(100, [3000, 4000], true)).toBe(1);
    expect(doluIsaret(3000, [3000, 4000], true)).toBe(2);
    expect(doluIsaret(4000, [3000, 4000], true)).toBe(3);
  });
});

describe('kazandın yerleşimi (§9.5): mühürler tabloyu örtmez, her şey ekrana sığar', () => {
  it('telefon ve masaüstü', () => {
    for (const [W, H, ust, alt] of [
      [390, 844, 44, 34],
      [360, 640, 0, 0],
      [412, 915, 24, 16],
      [1280, 800, 0, 0],
      [768, 1024, 20, 20],
    ]) {
      const y = kazandinYerlesimi(W, H, { ust, sag: 0, alt, sol: 0 });
      expect(y.tablo.w / y.tablo.h).toBeCloseTo(2 / 3, 1);
      expect(y.tablo.x).toBeGreaterThanOrEqual(0);
      expect(y.tablo.x + y.tablo.w).toBeLessThanOrEqual(W);
      expect(y.tablo.y).toBeGreaterThanOrEqual(ust);
      if (!y.yan) {
        expect(y.muhurY).toBeGreaterThanOrEqual(y.tablo.y + y.tablo.h);
        expect(y.alt.y).toBeGreaterThan(y.muhurY);
        expect(y.alt.y + y.alt.h).toBeLessThanOrEqual(H - alt);
        expect(y.alt.h).toBeGreaterThanOrEqual(150);
      } else {
        expect(y.alt.x).toBeGreaterThanOrEqual(y.tablo.x + y.tablo.w);
        expect(y.tablo.y + y.tablo.h).toBeLessThanOrEqual(H);
      }
    }
  });
});

describe('yerleşim (§11.6)', () => {
  it('telefon dikey: bantlar ekranı böler, tahta ortada, 7×9 hücre ≥ 40 px', () => {
    for (const [W, H] of [
      [390, 844],
      [360, 640],
      [412, 915],
    ]) {
      const y = yerlesimHesapla(W, H, { ust: 24, sag: 0, alt: 20, sol: 0 }, 7, 9, true);
      expect(y.kip).toBe('dikey');
      expect(y.ust.y).toBe(0);
      expect(y.tahta.y).toBe(y.ust.h + (y.tarif?.h ?? 0));
      expect(y.tahta.y + y.tahta.h).toBe(y.alt.y);
      expect(y.alt.y + y.alt.h).toBe(H);
      expect(y.hucre).toBeGreaterThanOrEqual(40);
    }
  });
  it('tahta sığmazsa tarif şeridi gizlenir', () => {
    const y = yerlesimHesapla(360, 560, SIFIR_KENAR, 7, 10, true);
    expect(y.tarif).toBeNull();
  });
  it('masaüstü: tahta solda, 300 px panel sağda, çakışmaz', () => {
    for (const [W, H] of [
      [1280, 800],
      [900, 700],
      [1920, 1080],
    ]) {
      const y = yerlesimHesapla(W, H, SIFIR_KENAR, 7, 9, true);
      expect(y.kip).toBe('yan');
      expect(y.panel).not.toBeNull();
      expect(y.panel!.w).toBe(300);
      expect(y.tahta.x + y.tahta.w).toBeLessThanOrEqual(y.panel!.x);
      expect(y.panel!.x + y.panel!.w).toBeLessThanOrEqual(W);
    }
  });
});
