/** Çözümleme (§3.5): fitil zamanları, ısı kuralı, kalkan, planlı hücre, eşik, nesil. */
import { describe, expect, it } from 'vitest';
import { hamleUygula } from './hamle';
import { fitil, halka, icerik, kur, patlamaZamani, sec } from './testAraclari';

const KAPALI: [number, number, number] = [0, 0, 0];

describe('fitil zamanları (§3.5.1)', () => {
  it('6 düğüm: 0, 103, 199, 288, 370, 445', () => {
    const d = kur(['G A G A G A G', 'R R R R R R A', 'A G A G A G G']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]));
    expect(sec(r.olaylar, 'dugumYandi').map((o) => o.t)).toEqual([0, 103, 199, 288, 370, 445]);
    expect(sec(r.olaylar, 'dugumYandi').map((o) => o.k)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('10 düğüm toplam 675 tik; düğüm puanı 10·k', () => {
    const d = kur(['R R R R R', 'R R R R R', 'G A G A G'], { ozelEsikleri: KAPALI });
    const r = hamleUygula(d, fitil([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [2, 1], [1, 1], [0, 1]));
    const p = sec(r.olaylar, 'patlama').filter((o) => o.neden === 'fitil');
    expect(p.map((o) => o.t)).toEqual([0, 103, 199, 288, 370, 445, 513, 574, 628, 675]);
    expect(p.map((o) => o.puan)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(p.map((o) => o.k)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('6 düğüm toplam 210, 12 düğüm 780 puan (özel kapalı, ısı patlaması yok)', () => {
    const d6 = kur(['G A G A G A G', 'R R R R R R A', 'A G A G A G G'], { ozelEsikleri: KAPALI });
    expect(hamleUygula(d6, fitil([0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1])).durum.puan).toBe(210);
    const d12 = kur(['R R R R R R', 'R R R R R R', 'G A G A G A'], { ozelEsikleri: KAPALI });
    const yol: [number, number][] = [];
    for (let x = 0; x < 6; x++) yol.push([x, 0]);
    for (let x = 5; x >= 0; x--) yol.push([x, 1]);
    expect(hamleUygula(d12, fitil(...yol)).durum.puan).toBe(780);
  });

  it('fitilBasladi t = 0; kalan hamle −1; hamleNo +1', () => {
    const d = kur(['A A A Z', 'R R R Z', 'G G G Z']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(r.olaylar[0]).toMatchObject({ t: 0, tur: 'fitilBasladi', halka: false, renk: 0 });
    expect(r.durum.kalanHamle).toBe(d.kalanHamle - 1);
    expect(r.durum.hamleNo).toBe(d.hamleNo + 1);
  });
});

describe('ısı kuralı (§3.5.2)', () => {
  it('+1: dik komşular ısınır, yol düğümleri (planlı) ısı almaz', () => {
    const d = kur(['A A A Z', 'R R R Z', 'G G G Z']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    const isinan = sec(r.olaylar, 'isindi').map((o) => `${o.hucre.x},${o.hucre.y}:${o.isi}`);
    expect(isinan.sort()).toEqual(['0,0:1', '0,2:1', '1,0:1', '1,2:1', '2,0:1', '2,2:1', '3,1:1']);
  });

  it('halka: düğüm patlamaları +2 verir, +100 puan ve halka sayılır', () => {
    const d = kur(['R R A G', 'R R A G', 'A Z G A', 'Z G A Z'], { hedefler: [{ tur: 'halka', adet: 2 }] });
    const r = hamleUygula(d, halka([0, 0], [1, 0], [1, 1], [0, 1]));
    const isinan = sec(r.olaylar, 'isindi').map((o) => `${o.hucre.x},${o.hucre.y}:${o.isi}`);
    expect(isinan.sort()).toEqual(['0,2:2', '1,2:2', '2,0:2', '2,1:2']);
    expect(sec(r.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ neden: 'halka', miktar: 100, t: 0 }));
    expect(r.durum.puan).toBe(10 + 20 + 30 + 40 + 100);
    expect(r.durum.istatistik.halkaSayisi).toBe(1);
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2, tamam: false });
    // Halka özel taş oluşturmaz.
    expect(sec(r.olaylar, 'ozelOlustu')).toHaveLength(0);
  });

  it('ısıyla patlayan kapsül komşularına halkada bile +1 verir', () => {
    const d = kur(['R R A3 Z', 'R R G A', 'A Z G Z']);
    const r = hamleUygula(d, halka([0, 0], [1, 0], [1, 1], [0, 1]));
    expect(patlamaZamani(r.olaylar)['2,0']).toBe(103 + 90);
    expect(sec(r.olaylar, 'isindi').find((o) => o.hucre.x === 3 && o.hucre.y === 0)).toMatchObject({ t: 193, isi: 1 });
  });

  it('U ile saran zincir kafesli kapsülü 3 kez ısıtır; eşikte kafes kırılır ve patlar (§15 bölüm 4)', () => {
    const d = kur(['A G A', 'Z cR1 Z', 'Z Z Z', 'G A G'], { hedefler: [{ tur: 'kafes' }, { tur: 'topla', renk: 'hepsi', adet: 99 }] });
    const r = hamleUygula(d, fitil([0, 1], [0, 2], [1, 2], [2, 2], [2, 1]));
    const kafes = sec(r.olaylar, 'isindi').filter((o) => o.hucre.x === 1 && o.hucre.y === 1);
    expect(kafes.map((o) => [o.t, o.isi])).toEqual([
      [0, 2],
      [199, 3],
      [370, 4],
    ]);
    expect(kafes[1].kizgin).toBe(true);
    expect(sec(r.olaylar, 'kafesKirildi')).toEqual([{ t: 460, tur: 'kafesKirildi', hucre: { x: 1, y: 1 } }]);
    expect(sec(r.olaylar, 'patlama').find((o) => o.hucre.x === 1 && o.hucre.y === 1)).toMatchObject({ neden: 'isi', nesil: 1, t: 460, puan: 20 });
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 1, tamam: true });
    expect(r.durum.istatistik.kafesKirilan).toBe(1);
  });

  it('kalkan: kovaya dik komşu hücre ısı almaz; kova bitişik hasar alır', () => {
    const d = kur(['A S A', 'R R R', 'G G G']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    const isinan = sec(r.olaylar, 'isindi').map((o) => `${o.hucre.x},${o.hucre.y}`);
    expect(isinan).not.toContain('0,0');
    expect(isinan).not.toContain('2,0');
    expect(isinan.sort()).toEqual(['0,2', '1,2', '2,2']);
    expect(sec(r.olaylar, 'engelHasar')).toEqual([{ t: 103, tur: 'engelHasar', hucre: { x: 1, y: 0 }, engel: 'kova', kalan: 1 }]);
  });

  it('planlı hücre ısı almaz: eşiğe varan kapsül ikinci kez ısınmaz', () => {
    const d = kur(['R A3 R', 'R R R', 'G Z G']);
    const r = hamleUygula(d, fitil([0, 0], [0, 1], [1, 1], [2, 1], [2, 0]));
    const a = sec(r.olaylar, 'isindi').filter((o) => o.hucre.x === 1 && o.hucre.y === 0);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ t: 0, isi: 4 });
    expect(patlamaZamani(r.olaylar)['1,0']).toBe(90);
  });

  it.each([2, 3, 4, 5])('eşik %i: eşik−1 ısılı komşu t+90\'da patlar, eşik−2 patlamaz', (esik) => {
    const d = kur([`A${esik - 1} K1 G K1 Z${esik - 2}`, 'R R R R R', 'G A G A G'], { esik, ozelEsikleri: KAPALI });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1], [3, 1], [4, 1]));
    const p = sec(r.olaylar, 'patlama');
    expect(p.find((o) => o.hucre.x === 0 && o.hucre.y === 0)).toMatchObject({ t: 90, neden: 'isi', nesil: 1 });
    expect(p.find((o) => o.hucre.x === 4 && o.hucre.y === 0)).toBeUndefined();
  });

  it('nesil: ısıyla patlayan, onu eşiğe taşıyan patlamanın nesli +1; puan 20·g', () => {
    const d = kur(['A G3 A', 'G A3 G', 'R R R', 'Z A Z']);
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    const p = sec(r.olaylar, 'patlama');
    expect(p.find((o) => o.hucre.x === 1 && o.hucre.y === 1)).toMatchObject({ t: 193, neden: 'isi', nesil: 1, puan: 20 });
    expect(p.find((o) => o.hucre.x === 1 && o.hucre.y === 0)).toMatchObject({ t: 283, neden: 'isi', nesil: 2, puan: 40 });
    expect(r.durum.istatistik.enCokNesil).toBe(2);
    expect(r.durum.istatistik.isiPatlamasi).toBe(2);
    expect(sec(r.olaylar, 'isindi').find((o) => o.hucre.x === 0 && o.hucre.y === 1 && o.t === 193)).toMatchObject({ isi: 2 });
    const reak = sec(r.olaylar, 'reaksiyon');
    expect(reak).toHaveLength(1);
    expect(reak[0].boyut).toBe(2);
  });

  it('isindi.kizgin eşik−1 ve üstünde', () => {
    const d = kur(['A2 Z A', 'R R R', 'G Z G']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'isindi').find((o) => o.hucre.x === 0 && o.hucre.y === 0)).toMatchObject({ isi: 3, kizgin: true });
    expect(sec(r.olaylar, 'isindi').find((o) => o.hucre.x === 1 && o.hucre.y === 0)).toMatchObject({ isi: 1, kizgin: false });
  });

  it('olaylar t\'ye göre azalmayan; yerçekimi kuyruk sonunda, sonrakiler YERCEKIMI_PAYI sonra', () => {
    const d = kur(['A G3 A', 'G A3 G', 'R R R', 'Z A Z']);
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    for (let k = 1; k < r.olaylar.length; k++) expect(r.olaylar[k].t).toBeGreaterThanOrEqual(r.olaylar[k - 1].t);
    const y = sec(r.olaylar, 'yercekimi');
    expect(y).toHaveLength(1);
    expect(y[0].t).toBe(283);
    expect(sec(r.olaylar, 'reaksiyon')[0].t).toBe(283 + 350);
  });

  it('içerik kapsül değilse eşik ısıtması yok; ısıyla patlayan özel taş etkisini işler', () => {
    const d = kur(['A G Z A G', 'G A3r0 G A Z', 'R R R G A', 'Z A Z R G']);
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    // A3 roket (1,1) t=103'te +1 → 193'te patlar, yatay roket nesil 1 vuruşlar 218, 243, 268.
    expect(sec(r.olaylar, 'ozelTetiklendi')).toEqual([{ t: 193, tur: 'ozelTetiklendi', hucre: { x: 1, y: 1 }, ozel: 'roket', eksen: 0 }]);
    const z = patlamaZamani(r.olaylar);
    expect(z['0,1']).toBe(218);
    expect(z['2,1']).toBe(218);
    expect(z['3,1']).toBe(243);
    expect(z['4,1']).toBe(268);
    expect(sec(r.olaylar, 'patlama').find((o) => o.hucre.x === 4 && o.hucre.y === 1)).toMatchObject({ neden: 'vurus', nesil: 1, puan: 15 });
  });
});

describe('ışık izi ve içerik', () => {
  it('patlayan hücre ışıklı kalır; içerik boşalır ve yerçekimi doldurur', () => {
    const d = kur(['A A A Z', 'R R R Z', 'G G G Z']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    for (const x of [0, 1, 2]) expect(r.durum.hucreler[1 * 4 + x].isikIzi).toBe(true);
    expect(r.durum.hucreler[0].isikIzi).toBe(false);
    expect(icerik(r.durum, 0, 1)).toMatchObject({ tur: 'kapsul', renk: 1 }); // A düştü
    expect(icerik(r.durum, 0, 0)).toMatchObject({ tur: 'kapsul', renk: 4, isi: 0 }); // M doğdu
  });
});
