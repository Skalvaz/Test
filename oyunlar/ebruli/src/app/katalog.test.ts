import { describe, expect, it } from 'vitest';
import { ATOLYELER, KARISIK_RENKLER, RENK_TANIMLARI, TARIFLER, TEKNIKLER, tabloTohumu } from './katalog';
import type { Renk } from '../core/types';

describe('katalog (§1, §9, §11)', () => {
  it('karışık rengin kodu ebeveynlerinin bit VEYA’sı, motifleri ebeveynlerin birleşimi', () => {
    for (const k of KARISIK_RENKLER) {
      const t = RENK_TANIMLARI[k];
      expect(t.ebeveyn).not.toBeNull();
      const [a, b] = t.ebeveyn!;
      expect(a | b).toBe(k);
      expect([...t.motifler].sort()).toEqual([...RENK_TANIMLARI[a].motifler, ...RENK_TANIMLARI[b].motifler].sort());
    }
    for (const t of TARIFLER) expect(t.a | t.b).toBe(t.sonuc);
  });

  it('her renk için iki palet ve geçerli hex', () => {
    for (const kod of [1, 2, 3, 4, 5, 6, 7] as Renk[]) {
      const t = RENK_TANIMLARI[kod];
      expect(t.kod).toBe(kod);
      for (const r of [...t.standart, ...t.renkKoru]) expect(r).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('atölyeler 1–20’yi boşluksuz kaplar; teknikler eşsiz', () => {
    expect(ATOLYELER.map((a) => a.bolumler)).toEqual([
      [1, 10],
      [11, 20],
    ]);
    expect(new Set(TEKNIKLER.map((t) => t.id)).size).toBe(TEKNIKLER.length);
  });

  it('tablo tohumu belirlenimli ve girdiye duyarlı', () => {
    expect(tabloTohumu(4, 0, 2150)).toBe(tabloTohumu(4, 0, 2150));
    expect(tabloTohumu(4, 0, 2150)).not.toBe(tabloTohumu(4, 1, 2150));
    expect(tabloTohumu(4, 0, 2150)).not.toBe(tabloTohumu(4, 0, 2160));
  });
});
