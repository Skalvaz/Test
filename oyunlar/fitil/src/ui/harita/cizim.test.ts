import { describe, expect, it } from 'vitest';
import { HARITA_W, HARITA_H, BOLGE_H, bolgeUst, bolgeCiz, dugumKonumu, ustaKonumu, yolParcalari, baslangicKonumu } from './cizim';
import type { BolumDugumuVM, Yildiz } from '../tipler';

const bolumler = (simdiki: number, yildiz: Yildiz = 3): BolumDugumuVM[] =>
  Array.from({ length: 40 }, (_, i) => ({ id: i + 1, yildiz: i + 1 < simdiki ? yildiz : 0, durum: i + 1 < simdiki ? 'acik' : i + 1 === simdiki ? 'simdiki' : 'kilitli' }));

describe('harita çizimi (§10.1)', () => {
  it('40 düğüm harita içinde, aşağıdan yukarı tırmanır, sağlı sollu dizilir', () => {
    let oncekiY = Infinity;
    for (let id = 1; id <= 40; id++) {
      const k = dugumKonumu(id);
      expect(k.x).toBeGreaterThan(40);
      expect(k.x).toBeLessThan(HARITA_W - 40);
      expect(k.y).toBeGreaterThan(0);
      expect(k.y).toBeLessThan(HARITA_H);
      expect(k.y).toBeLessThan(oncekiY);
      expect(k.taraf).toBe(id % 2 === 1 ? 'sol' : 'sag');
      oncekiY = k.y;
      // Düğüm kendi mahallesinin bandında
      const m = Math.floor((id - 1) / 5);
      expect(k.y).toBeGreaterThanOrEqual(bolgeUst(m));
      expect(k.y).toBeLessThanOrEqual(bolgeUst(m) + BOLGE_H);
    }
  });

  it('düğüm konumları belirlenimli', () => {
    expect(dugumKonumu(17)).toEqual(dugumKonumu(17));
  });

  it('Usta fenerleri mahalle sınırlarında, kenarda', () => {
    for (let s = 1; s <= 8; s++) {
      const u = ustaKonumu(s);
      expect(u.x === 60 || u.x === 340).toBe(true);
      expect(Math.abs(u.y - bolgeUst(s - 1))).toBeLessThan(20);
    }
  });

  it('fitil yolu iskeleden başlar, 40 parça', () => {
    const p = yolParcalari();
    expect(p).toHaveLength(40);
    expect(p[0].d.startsWith(`M${baslangicKonumu().x} `)).toBe(true);
  });

  it('pencereler yıldıza göre yanar: 3★ hepsi, 0★ hiçbiri; 3★ çatı fişeği', () => {
    const say = (s: string) => (s.match(/fill="#FFC86B"/g) ?? []).length;
    const uc = bolgeCiz(0, bolumler(6, 3), []);
    const bir = bolgeCiz(0, bolumler(6, 1), []);
    const sifir = bolgeCiz(0, bolumler(1), []);
    expect(say(uc.svg)).toBeGreaterThan(say(bir.svg));
    expect(say(bir.svg)).toBeGreaterThan(say(sifir.svg));
    expect(uc.catilar).toHaveLength(5);
    expect(bir.catilar).toHaveLength(0);
  });

  it('her mahalle çizilebilir (8 tema)', () => {
    for (let m = 0; m < 8; m++) {
      const c = bolgeCiz(m, bolumler(41), ['lale']);
      expect(c.svg.length).toBeGreaterThan(1000);
      expect(c.svg).not.toContain('NaN');
      expect(c.svg).not.toContain('undefined');
    }
  });
});
