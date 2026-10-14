/** Çizerken önizleme (§3.9). */
import { describe, expect, it } from 'vitest';
import { onizle } from './onizle';
import { desen, kur, yol } from './testAraclari';

const k = (l: { x: number; y: number }[]) => l.map((p) => `${p.x},${p.y}`).sort();

describe('onizle (§3.9)', () => {
  it('eşik hücreleri: yalnız ilk dalga, yol dışı; ısınacaklar artışlarıyla', () => {
    const d = kur(['A A3 A', 'R R R', 'G G G', 'Z A2 Z']);
    const o = onizle(d, yol([0, 1], [1, 1], [2, 1]), false);
    expect(o.gecerli).toBe(true);
    expect(o.renk).toBe(0);
    expect(k(o.esikHucreler)).toEqual(['1,0']);
    expect(o.isinacaklar).toHaveLength(6);
    expect(o.isinacaklar.every((i) => i.artis === 1)).toBe(true);
    // İkinci dalga gösterilmez: (1,3) A2, (1,2) patlasa bile işaretlenmez.
    expect(k(o.esikHucreler)).not.toContain('1,3');
    expect(o.ozelHayalet).toBeNull();
    expect(o.etkiAlanlari).toEqual([]);
    expect(o.kombo).toBeNull();
  });

  it('halka +2; kalkan ve yol düğümleri dikkate alınır', () => {
    const d = kur(['R R A2 Z', 'R R G A', 'A Z G Z']);
    const o = onizle(d, yol([0, 0], [1, 0], [1, 1], [0, 1]), true);
    const art = Object.fromEntries(o.isinacaklar.map((i) => [`${i.hucre.x},${i.hucre.y}`, i.artis]));
    expect(art).toEqual({ '2,0': 2, '2,1': 2, '0,2': 2, '1,2': 2 });
    expect(k(o.esikHucreler)).toEqual(['2,0']);
    const kalkan = kur(['R R A2 Z', 'R R S A', 'A Z G Z']);
    const o2 = onizle(kalkan, yol([0, 0], [1, 0], [1, 1], [0, 1]), true);
    expect(k(o2.isinacaklar.map((i) => i.hucre))).toEqual(['0,2', '1,2']);
  });

  it('dönüşecek son düğüm ısı vermez; özel hayalet tür ve eksen', () => {
    const d = kur(['G A G A G A G', 'R R R R R R A3', 'A G A G A G G']);
    const o = onizle(d, yol([0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]), false);
    expect(o.ozelHayalet).toEqual({ hucre: { x: 5, y: 1 }, ozel: 'roket', eksen: 0 });
    expect(k(o.isinacaklar.map((i) => i.hucre))).not.toContain('6,1');
    expect(o.esikHucreler).toEqual([]);
  });

  it('kısa yol: geçersiz ama ısı önizlemesi yine hesaplanır; tahta dışı yok sayılır', () => {
    const d = kur(['A A3 A', 'R R R', 'G G G']);
    const o = onizle(d, yol([0, 1], [1, 1]), false);
    expect(o.gecerli).toBe(false);
    expect(k(o.esikHucreler)).toEqual(['1,0']);
    expect(() => onizle(d, yol([-1, 0], [0, 1]), false)).not.toThrow();
  });

  it('etki alanları: yoldaki roketin ekseni; iki özel taş → kombinasyon S2\'de', () => {
    const d = kur(desen(5, 5, { '0,2': 'R', '1,2': 'Rr1', '2,2': 'R' }));
    const o = onizle(d, yol([0, 2], [1, 2], [2, 2]), false);
    expect(o.etkiAlanlari).toHaveLength(1);
    expect(k(o.etkiAlanlari[0].hucreler)).toEqual(['1,0', '1,1', '1,3', '1,4']);
    const d2 = kur(desen(5, 5, { '0,2': 'R', '1,2': 'Rr1', '2,2': 'Rr0', '3,2': 'Rk' }));
    const o2 = onizle(d2, yol([0, 2], [1, 2], [2, 2], [3, 2]), false);
    expect(o2.kombo).toBe('yildizHatti');
    expect(o2.etkiAlanlari.map((e) => e.kaynak)).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
    // (3,2) kasımpatısı: Chebyshev ≤ 2, tahta içinde 4 × 5 − 1 = 19 hücre.
    expect(o2.etkiAlanlari[1].hucreler).toHaveLength(19);
  });

  it('yalnız joker yol: renk −1', () => {
    const d = kur(['* * * A', 'R G Z A']);
    const o = onizle(d, yol([0, 0], [1, 0], [2, 0]), false);
    expect(o.renk).toBe(-1);
    expect(o.gecerli).toBe(true);
    expect(o.kombo).toBe('buyukFinal');
  });
});
