/** Yerçekimi ve doldurma (§3.6), fener çıkışı ve doğumu (§5), yardım n, RNG tüketim sırası (§16.3). */
import { describe, expect, it } from 'vitest';
import { hamleUygula } from './hamle';
import { rngSonraki } from './rng';
import { fitil, icerik, kur, sec } from './testAraclari';

function ilerlet(rng: number, n: number): number {
  const s = { rng };
  for (let k = 0; k < n; k++) rngSonraki(s);
  return s.rng;
}

describe('yerçekimi (§3.6)', () => {
  it('hareketli içerik sabitlerin (kaya) arkasından geçer', () => {
    const d = kur(['A G A', 'G K2 G', 'Z A Z', 'R R R']);
    const r = hamleUygula(d, fitil([0, 3], [1, 3], [2, 3]));
    const y = sec(r.olaylar, 'yercekimi')[0];
    expect(y.dusenler).toContainEqual({ den: { x: 1, y: 0 }, e: { x: 1, y: 2 } });
    expect(icerik(r.durum, 1, 1)).toEqual({ tur: 'kaya', kat: 2 });
    expect(icerik(r.durum, 1, 2)).toMatchObject({ tur: 'kapsul', renk: 3 });
    expect(icerik(r.durum, 1, 3)).toMatchObject({ tur: 'kapsul', renk: 1 });
  });

  it('kafesli kapsül düşmez; ıslak ve fener düşer', () => {
    const d = kur(['wG A F', 'A cZ G', 'Z G A', 'R R R'], { cikislar: [] });
    const r = hamleUygula(d, fitil([0, 3], [1, 3], [2, 3]));
    expect(icerik(r.durum, 1, 1)).toMatchObject({ tur: 'kapsul', renk: 2 });
    expect(r.durum.hucreler[1 * 3 + 1].kafes).toBe(true);
    expect(icerik(r.durum, 0, 1)).toEqual({ tur: 'islak', renk: 3 });
    expect(icerik(r.durum, 2, 1)).toEqual({ tur: 'fener' });
  });

  it('doğanlar sütun soldan sağa, yuva aşağıdan yukarı; sanalY −1, −2…', () => {
    const d = kur(['A G A', 'G A G', 'R R Z', 'R G A']);
    const r = hamleUygula(d, fitil([0, 2], [0, 3], [1, 2]));
    const y = sec(r.olaylar, 'yercekimi')[0];
    expect(y.doganlar.map((g) => [g.hucre.x, g.hucre.y, g.sanalY])).toEqual([
      [0, 1, -1],
      [0, 0, -2],
      [1, 0, -1],
    ]);
    expect(y.doganlar[0].icerik).toEqual({ tur: 'kapsul', renk: 4, isi: 0, ozel: 'yok', eksen: 0 });
    // 3 dolum = 3 RNG çekimi.
    expect(r.durum.rng).toBe(ilerlet(d.rng, 3));
  });

  it('delikler atlanır: delik altındaki yuvaya düşülmez, delik doldurulmaz', () => {
    const d = kur(['A G A', 'G # G', 'Z A Z', 'R R R']);
    const r = hamleUygula(d, fitil([0, 3], [1, 3], [2, 3]));
    expect(r.durum.hucreler[1 * 3 + 1]).toMatchObject({ delik: true, icerik: null });
    expect(icerik(r.durum, 1, 3)).toMatchObject({ renk: 1 });
    expect(icerik(r.durum, 1, 2)).toMatchObject({ renk: 3 });
    expect(icerik(r.durum, 1, 0)).toMatchObject({ renk: 4 });
  });

  it('düşen taşlar kendiliğinden patlamaz (kaskad yok, §3.7)', () => {
    const d = kur(['R G A', 'R A G', 'Z Z Z', 'A G A']);
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    expect(sec(r.olaylar, 'patlama')).toHaveLength(3);
  });
});

describe('fener (§5)', () => {
  it('çıkış yuvasına (sütunun deliksiz en alt hücresi) ulaşan fener toplanır, yerçekimi yinelenir', () => {
    const d = kur(['G A G', 'F G A', 'R R R'], { hedefler: [{ tur: 'fener', adet: 2 }] });
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    expect(sec(r.olaylar, 'fenerToplandi')).toEqual([{ t: 549, tur: 'fenerToplandi', hucre: { x: 0, y: 2 } }]);
    expect(sec(r.olaylar, 'yercekimi').map((o) => o.t)).toEqual([199, 549]);
    expect(sec(r.olaylar, 'reaksiyon')[0].t).toBe(899);
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
    expect(r.durum.istatistik.fenerToplanan).toBe(1);
    expect(r.durum.puan).toBe(60 + 200);
  });

  it('çıkış yuvasında sabit engel varsa fener toplanamaz; engel kalkınca toplanır', () => {
    const k2 = hamleUygula(kur(['G A G Z', 'F G A G', 'K2 R R R']), fitil([1, 2], [2, 2], [3, 2]));
    expect(sec(k2.olaylar, 'fenerToplandi')).toHaveLength(0);
    expect(icerik(k2.durum, 0, 1)).toEqual({ tur: 'fener' });
    const k1 = hamleUygula(kur(['G A G Z', 'F G A G', 'K1 R R R']), fitil([1, 2], [2, 2], [3, 2]));
    expect(sec(k1.olaylar, 'fenerToplandi')).toEqual([expect.objectContaining({ hucre: { x: 0, y: 2 } })]);
  });

  it('cikislar dışındaki sütunda fener toplanmaz', () => {
    const r = hamleUygula(kur(['G A G', 'F G A', 'R R R'], { cikislar: [2] }), fitil([0, 2], [1, 2], [2, 2]));
    expect(sec(r.olaylar, 'fenerToplandi')).toHaveLength(0);
  });

  it('fener doğumu: dolum alan sütunlardan rngInt ile biri, en üst dolum yuvası; tur başına 1', () => {
    const d = kur(['G A G', 'Z G A', 'R R R'], { fenerDogum: { kalan: 1, sahadaEnFazla: 1 } });
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    const fenerler = r.durum.hucreler.flatMap((h, i) => (h.icerik?.tur === 'fener' ? [i] : []));
    expect(fenerler).toHaveLength(1);
    expect(fenerler[0]).toBeLessThan(3); // en üst satır
    expect(r.durum.fenerDogum).toEqual({ kalan: 0, sahadaEnFazla: 1 });
    expect(sec(r.olaylar, 'yercekimi')[0].doganlar.filter((g) => g.icerik.tur === 'fener')).toHaveLength(1);
    // 3 dolum + 1 fener sütunu seçimi.
    expect(r.durum.rng).toBe(ilerlet(d.rng, 4));
  });

  it('sahada en fazla sınırı doluysa fener doğmaz', () => {
    const d = kur(['G A F', 'Z G A', 'R R R'], { fenerDogum: { kalan: 2, sahadaEnFazla: 1 }, cikislar: [] });
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    expect(r.durum.fenerDogum?.kalan).toBe(2);
    expect(r.durum.rng).toBe(ilerlet(d.rng, 3));
  });
});

describe('yardım n (§3.6)', () => {
  it('≥ 4 bileşen yoksa doğanlar aynı akıştan en fazla n kez yeniden çekilir', () => {
    const satirlar = ['G A G', 'Z G A', 'R R R'];
    const y0 = kur(satirlar, { yardim: 0 });
    expect(hamleUygula(y0, fitil([0, 2], [1, 2], [2, 2])).durum.rng).toBe(ilerlet(y0.rng, 3));
    const y2 = kur(satirlar, { yardim: 2 });
    expect(hamleUygula(y2, fitil([0, 2], [1, 2], [2, 2])).durum.rng).toBe(ilerlet(y2.rng, 9));
  });

  it('≥ 4 bileşen varsa yeniden çekim yok', () => {
    const d = kur(['M A G', 'M G A', 'R R R'], { yardim: 3 });
    // Dolum M: (0,0) M … (0,2)'ye inen M'lerle birlikte ≥ 4.
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    expect(r.durum.rng).toBe(ilerlet(d.rng, 3));
  });
});
