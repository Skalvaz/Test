import { describe, expect, it } from 'vitest';
import type { Olay } from '../core/types';
import { titresimDeseni } from './titresim';

describe('titreşim (§10.1)', () => {
  it('karışım 8, eşleşme 12 (adım başına bir), özel 20, birleşim desen', () => {
    expect(titresimDeseni({ t: 0, tur: 'karisti', kaynak: { x: 0, y: 0 }, hedef: { x: 1, y: 0 }, a: 1, b: 2, sonuc: 3, yeniId: 1 })).toBe(8);
    const e: Olay = { t: 300, tur: 'eslesti', renk: 3, hucreler: [], k: 1, merkez: { x: 0, y: 0 } };
    expect(titresimDeseni(e)).toBe(12);
    expect(titresimDeseni(e, 300)).toBeNull();
    expect(titresimDeseni({ t: 0, tur: 'birlesim', hucre: { x: 0, y: 0 }, kombo: 'tarakTarak', alan: [] })).toEqual([20, 30, 40]);
    expect(titresimDeseni({ t: 0, tur: 'hamleOzeti', temizlenen: 0, kaskat: 1, eslesme: false, merkez: { x: 0, y: 0 } })).toBeNull();
  });
});
