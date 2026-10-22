import { describe, expect, it } from 'vitest';
import { EN_COK, Olcum, olaylardanToplam, olcumOzeti, yerelGun, type OlcumOlayi } from './olcum';

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

describe('ömür boyu toplamlar (Oyun özeti)', () => {
  it('halka günlük dolsa da gün, süre ve bölüm sayaçları baştan beri doğru; yeniden açılışta sürer', () => {
    const d = new Bellek();
    let t = new Date(2026, 9, 18, 12, 0, 0).getTime();
    let a = new Olcum(d, () => t);
    // 6 gün, günde 20 deneme (deneme başına 7 olay, ekran olaylarıyla), 1. bölümde hep kayıp.
    for (let gun = 0; gun < 6; gun++) {
      if (gun > 0) {
        a.yaz();
        t += GUN;
        a = new Olcum(d, () => t);
      }
      a.basla({ surum: '1.0', ana: 1 });
      for (let i = 0; i < 20; i++) {
        a.olay('ekran', { ad: 'harita' });
        a.olay('ekran', { ad: 'bolumOncesi' });
        a.olay('bolum_basla', { id: 1, tur: 'ana', deneme: i });
        a.olay('ekran', { ad: 'oyun' });
        a.olay('bolum_bitti', { id: 1, tur: 'ana', sonuc: 'kayip', sure: 90 });
        a.olay('ekran', { ad: 'kaybettin' });
        a.olay('ekran', { ad: 'harita' });
      }
    }
    expect(a.olaylar()).toHaveLength(EN_COK);
    const T = a.toplam();
    expect(T.gunler).toHaveLength(6);
    expect(T.oturum).toBe(6);
    expect(T.sure).toBe(6 * 20 * 90);
    expect(T.bolum[1]).toMatchObject({ deneme: 120, kayip: 120, birakma: 0, kazanildi: false, biten: 120 });
    // Günlükte kalan olaylardan kurulan toplam eksik kalırdı.
    expect(olaylardanToplam(a.olaylar()).bolum[1].deneme).toBeLessThan(120);
    a.yaz();
    expect(new Olcum(d, () => t).toplam()).toEqual(T);
  });

  it('toplamsız eski kayıt: toplam günlükteki olaylardan kurulur; bozuk toplam da', () => {
    const t0 = new Date(2026, 9, 18, 12, 0, 0).getTime();
    const olaylar: OlcumOlayi[] = [
      { a: 'oturum_basla', t: t0, g: 0, o: 1, p: { surum: '1.0', dil: 'tr', ana: 1 } },
      { a: 'bolum_basla', t: t0 + 1000, g: 0, o: 1, p: { id: 1, tur: 'ana' } },
      { a: 'bolum_bitti', t: t0 + 61_000, g: 0, o: 1, p: { id: 1, tur: 'ana', sonuc: 'kazanc', sure: 60 } },
    ];
    const d = new Bellek();
    d.setItem('fitil.olcum.v1', JSON.stringify({ ilk: t0, oturum: 1, olaylar }));
    const T = new Olcum(d, () => t0 + 70_000).toplam();
    expect(T).toMatchObject({ sira: 3, oturum: 1, gunler: [yerelGun(t0)], sure: 60, enYuksek: 1, surum: '1.0', dil: 'tr', suren: null });
    d.setItem('fitil.olcum.v1', JSON.stringify({ ilk: t0, oturum: 1, olaylar, toplam: { sira: 'x' } }));
    expect(new Olcum(d, () => t0).toplam().sira).toBe(3);
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
