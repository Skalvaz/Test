import { describe, expect, it } from 'vitest';
import { bolumuYukle, durumKarmasi, kilitliMi, yolDogrula, ilerlemeYuzdesi } from './index';
import type { BolumVerisi } from './types';
import b001 from '../levels/veri/b001.json';

const b1 = b001 as unknown as BolumVerisi;

describe('bolumuYukle (P0 başvuru)', () => {
  it('bölüm 1: boyutlar, sabit kapsüller, ön ısı', () => {
    const d = bolumuYukle(b1, 0);
    expect(d.w).toBe(5);
    expect(d.hucreler).toHaveLength(30);
    const a = d.hucreler[4 * 5 + 1].icerik;
    expect(a).toMatchObject({ tur: 'kapsul', renk: 1, isi: 3 });
    expect(d.hucreler[5 * 5 + 0].icerik).toMatchObject({ tur: 'kapsul', renk: 0 });
    expect(d.hedefler[0]).toMatchObject({ ilerleme: 0, gerekli: 25, tamam: false });
    expect(kilitliMi(d)).toBe(false);
    expect(ilerlemeYuzdesi(d)).toBe(0);
  });

  it('ilk tahta denemeden bağımsız, oyun akışı tohumu farklı', () => {
    const a = bolumuYukle(b1, 0);
    const b = bolumuYukle(b1, 1);
    expect(JSON.stringify(a.hucreler)).toBe(JSON.stringify(b.hucreler));
    expect(a.rng).not.toBe(b.rng);
    expect(durumKarmasi(a)).toBe(durumKarmasi(bolumuYukle(b1, 0)));
  });

  it('yolDogrula: alt sıradaki 4 kızıl geçerli, 2 düğüm kısa', () => {
    const d = bolumuYukle(b1, 0);
    const yol = [0, 1, 2, 3].map((x) => ({ x, y: 5 }));
    expect(yolDogrula(d, yol, false)).toBeNull();
    expect(yolDogrula(d, yol.slice(0, 2), false)).toBe('kisa');
    expect(yolDogrula(d, [{ x: 0, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }], false)).toBe('komsu');
  });
});
