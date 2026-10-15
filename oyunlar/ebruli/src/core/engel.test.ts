import { describe, expect, it } from 'vitest';
import { Baglam } from './baglam';
import { cozumDongusu } from './cozum';
import { hamleUygula } from './index';
import type { Olay, OyunDurumu } from './types';
import { H, kur, tahtaMetni } from './testAraclari';

const tur = <T extends Olay['tur']>(ol: Olay[], t: T) => ol.filter((o) => o.tur === t) as Extract<Olay, { tur: T }>[];

/** Var olan grupları doğumsuz çözer (beyaz kutu: engel kuralları). */
function coz(d: OyunDurumu): Olay[] {
  const c = new Baglam(d, true, 0);
  cozumDongusu(c, 1);
  return c.olaylar;
}

describe('mermer (§6.2, §4.4 adım 6)', () => {
  it('gruba birden çok hücresiyle komşu mermer grup başına bir kez −1', () => {
    const d = kur(['4 4 4 4', '4 1 4 4', '3 2 4 4', '3 X3 4 4']);
    const r = hamleUygula(d, H(1, 1, 1, 2));
    expect(tur(r.olaylar, 'mermerHasar')).toEqual([{ t: 640, tur: 'mermerHasar', hucre: { x: 1, y: 3 }, kalan: 2 }]);
    expect(r.durum.puan).toBe(90 + 40);
  });

  it('iki gruba komşu mermer −2', () => {
    const d = kur(['3 X3 5', '3 4 5', '3 4 5']);
    const ol = coz(d);
    expect(tur(ol, 'mermerHasar').map((o) => o.kalan)).toEqual([2, 1]);
  });

  it('alan hasarı adım başına bir: girdap ve zincirdeki tarak aynı mermeri bir kez vurur', () => {
    const d = kur(['4 4 4 4 4', '4 4 X3 4 4', '4 4 G6 1 4', '4 4 T5d 4 4', '4 4 4 4 4']);
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(tur(r.olaylar, 'ozelTetiklendi').map((o) => o.ozel)).toEqual(['girdap', 'tarak']);
    expect(tur(r.olaylar, 'mermerHasar')).toEqual([expect.objectContaining({ hucre: { x: 2, y: 1 }, kalan: 2 })]);
  });

  it('can 0 → kalkar, yerine damla iner; mermerin kırılması kâğıt almaz', () => {
    const d = kur(['4 4 4', '4 X1 4', '3 3 3'], { zemin: { kagit: [[1, 1, 1]] } });
    const ol = coz(d);
    expect(tur(ol, 'mermerHasar')).toEqual([expect.objectContaining({ hucre: { x: 1, y: 1 }, kalan: 0 })]);
    expect(tur(ol, 'kagitAlindi')).toEqual([]);
    expect(d.hucreler[4].kagit).toBe(1);
    expect(tahtaMetni(d)).toEqual(['- - -', '4 - 4', '4 4 4']);
  });
});

describe('kâğıt, yağ, desen (§6.1, §6.3, §7.3)', () => {
  it('kâğıt 2 → 1 → 0, boyası temizlenen damlanın rengi, kat başına 50', () => {
    const d = kur(['4 4 4 4', '4 4 4 4', '3 3 2 1'], { zemin: { kagit: [[0, 2, 2], [1, 2, 1]] } });
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(tur(r.olaylar, 'kagitAlindi')).toEqual([
      { t: 640, tur: 'kagitAlindi', hucre: { x: 0, y: 2 }, kalan: 1, renk: 3 },
      { t: 640, tur: 'kagitAlindi', hucre: { x: 1, y: 2 }, kalan: 0, renk: 3 },
    ]);
    // Sıra: temizlendi → kagitAlindi → puanEklendi (aynı t).
    const i = r.olaylar.findIndex((o) => o.tur === 'kagitAlindi');
    expect(r.olaylar[i - 1]).toMatchObject({ tur: 'temizlendi', hucre: { x: 0, y: 2 } });
    expect(r.olaylar[i + 1]).toMatchObject({ tur: 'puanEklendi', miktar: 50, neden: 'engel' });
    expect(r.durum.hucreler[8].kagit).toBe(1);
    expect(r.durum.puan).toBe(90 + 100);
  });

  it('yağlı hücredeki damla karışmaz ama gruba katılır; temizlenince yağ kalkar (+20)', () => {
    const d = kur(['4 4 4 4', '4 4 4 4', '3 3 2 1'], { zemin: { yag: [[0, 2], [3, 1]] } });
    expect(() => hamleUygula(d, H(3, 1, 3, 2))).toThrow(/yag/);
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(tur(r.olaylar, 'yagKalkti')).toEqual([{ t: 640, tur: 'yagKalkti', hucre: { x: 0, y: 2 } }]);
    expect(r.durum.hucreler[8].yag).toBe(false);
    expect(r.durum.hucreler[7].yag).toBe(true);
    expect(r.durum.puan).toBe(110);
  });

  it('desen yalnız kendi rengiyle boyanır (+100)', () => {
    const d = kur(['4 4 4 4', '4 4 4 4', '3 3 2 1'], { zemin: { desen: { motif: 'lale', hucreler: [[0, 2, 3], [1, 2, 5]] } } });
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(tur(r.olaylar, 'desenBoyandi')).toEqual([{ t: 640, tur: 'desenBoyandi', hucre: { x: 0, y: 2 }, renk: 3 }]);
    expect(r.durum.hucreler[8].desenBoyali).toBe(true);
    expect(r.durum.hucreler[9].desenBoyali).toBe(false);
    expect(r.durum.puan).toBe(190);
  });
});
