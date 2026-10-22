import { describe, expect, it } from 'vitest';
import { EN_COK, Olcum, olcumOzeti, type OlcumOlayi } from './olcum';

class Bellek {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const GUN = 86_400_000;

describe('ölçüm günlüğü', () => {
  it('oturum sayar, kurulumdan bu yana günü yazar, yeniden açılışta sürer', () => {
    const d = new Bellek();
    let t = 1_000_000;
    const a = new Olcum(d, () => t);
    a.basla({ surum: '1.0' });
    a.olay('bolum_basla', { id: 1 });
    a.yaz();
    t += GUN + 5;
    const b = new Olcum(d, () => t);
    b.basla();
    const o = b.olaylar();
    expect(o.map((x) => [x.a, x.g, x.o])).toEqual([
      ['oturum_basla', 0, 1],
      ['bolum_basla', 0, 1],
      ['oturum_basla', 1, 2],
    ]);
    expect(o[0].p).toMatchObject({ surum: '1.0', dil: 'tr' });
  });

  it('halka: en çok EN_COK olay tutar; bozuk kayıtta baştan başlar', () => {
    const d = new Bellek();
    const a = new Olcum(d, () => 5);
    for (let i = 0; i < EN_COK + 50; i++) a.olay('x', { i });
    a.yaz();
    expect(a.olaylar()).toHaveLength(EN_COK);
    expect(a.olaylar()[0].p?.i).toBe(50);
    d.setItem('fitil.olcum.v1', '{bozuk');
    expect(new Olcum(d, () => 5).olaylar()).toHaveLength(0);
  });

  it('kişisel veri yok: olaylarda yalnız verilen özellikler, gün ve oturum', () => {
    const a = new Olcum(new Bellek(), () => 7);
    a.basla();
    a.olay('ekran', { ad: 'harita' });
    for (const o of a.olaylar()) expect(Object.keys(o).sort()).toEqual(expect.arrayContaining(['a', 'g', 'o', 't']));
    expect(JSON.stringify(a.olaylar())).not.toMatch(/userAgent|kimlik|id":"[a-f0-9-]{20,}/);
  });
});

describe('ölçüm özeti', () => {
  const o = (a: string, t: number, oturum: number, p?: OlcumOlayi['p'], g = 0): OlcumOlayi => ({ a, t, g, o: oturum, p });
  it('bölüm hunisi, ilk kazanca deneme, ilk oturumda en yüksek bölüm, bölüm 5 süresi', () => {
    const olaylar: OlcumOlayi[] = [
      o('oturum_basla', 0, 1),
      o('ekran', 1, 1, { ad: 'harita' }),
      o('bolum_basla', 1000, 1, { id: 1, tur: 'ana' }),
      o('bolum_bitti', 61_000, 1, { id: 1, tur: 'ana', sonuc: 'kazanc', sure: 60 }),
      o('bolum_basla', 62_000, 1, { id: 5, tur: 'ana' }),
      o('bolum_bitti', 92_000, 1, { id: 5, tur: 'ana', sonuc: 'kayip', sure: 30 }),
      o('bolum_basla', 93_000, 1, { id: 5, tur: 'ana' }),
      o('bolum_bitti', 183_000, 1, { id: 5, tur: 'ana', sonuc: 'kazanc', sure: 90 }),
      o('oturum_basla', GUN, 2, undefined, 1),
      o('bolum_basla', GUN + 1, 2, { id: 6, tur: 'ana' }, 1),
      o('bolum_bitti', GUN + 2, 2, { id: 6, tur: 'ana', sonuc: 'cikis', sure: 4 }, 1),
    ];
    const z = olcumOzeti(olaylar);
    expect(z.oturumlar).toBe(2);
    expect(z.gunler).toEqual([0, 1]);
    expect(z.ilkOturumEnYuksek).toBe(5);
    expect(z.bolum5Suresi).toBe(183);
    expect(z.ekranlar).toEqual({ harita: 1 });
    expect(z.bolumler.find((b) => b.id === 5)).toMatchObject({ basla: 2, kazanc: 1, kayip: 1, ilkKazancDenemesi: 2, ortSure: 60 });
    expect(z.bolumler.find((b) => b.id === 6)).toMatchObject({ cikis: 1, kazanc: 0, ilkKazancDenemesi: null });
  });
});
