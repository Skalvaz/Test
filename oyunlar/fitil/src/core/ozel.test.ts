/** Özel taşlar (§4): oluşum, eksen, etkiler, tetiklenme, yıldız hedef rengi, 6 kombinasyon. */
import { describe, expect, it } from 'vitest';
import { hamleUygula } from './hamle';
import { komboTuru } from './ozel';
import { desen, fitil, halka, icerik, kur, patlamaZamani, sec } from './testAraclari';
import { eksenBul, ozelTuruBul } from './yol';
import type { Eksen, Hamle } from './types';

const cift = (x: number, y: number): Hamle => ({ tur: 'ciftDokunus', hucre: { x, y } });

/** Merkezden roket vuruş zamanları (beklenen). */
function roketBeklenen(cx: number, cy: number, eksen: Eksen, w: number, h: number): Record<string, number> {
  const yon = [
    [
      [1, 0],
      [-1, 0],
    ],
    [
      [0, -1],
      [0, 1],
    ],
    [
      [1, -1],
      [-1, 1],
    ],
    [
      [1, 1],
      [-1, -1],
    ],
  ][eksen];
  const z: Record<string, number> = { [`${cx},${cy}`]: 0 };
  for (const [dx, dy] of yon) {
    for (let u = 1; ; u++) {
      const x = cx + dx * u;
      const y = cy + dy * u;
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      z[`${x},${y}`] = 25 * u;
    }
  }
  return z;
}

describe('oluşum (§4.1) ve eksen (§2.3)', () => {
  it('eksenBul: son segmentten', () => {
    const e = (dx: number, dy: number) => eksenBul({ x: 3, y: 3 }, { x: 3 + dx, y: 3 + dy });
    expect([e(1, 0), e(-1, 0), e(0, 1), e(0, -1), e(1, -1), e(-1, 1), e(1, 1), e(-1, -1)]).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('ozelTuruBul: eşikler ve 0 = kapalı', () => {
    const v: [number, number, number] = [6, 9, 12];
    expect([5, 6, 8, 9, 11, 12, 20].map((n) => ozelTuruBul(v, n))).toEqual(['yok', 'roket', 'roket', 'kasimpati', 'kasimpati', 'yildiz', 'yildiz']);
    expect(ozelTuruBul([0, 0, 0], 15)).toBe('yok');
    expect(ozelTuruBul([6, 0, 0], 12)).toBe('roket');
    expect(ozelTuruBul([6, 9, 0], 12)).toBe('kasimpati');
  });

  it('6 düğüm → son düğüm roket (patlamaz, ısı 0, +60, sayılmaz)', () => {
    const d = kur(['G A G A G A G', 'R R R R R R2 A', 'A G A G A G G'], { hedefler: [{ tur: 'topla', renk: 'hepsi', adet: 99 }] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]));
    expect(sec(r.olaylar, 'ozelOlustu')).toEqual([{ t: 445, tur: 'ozelOlustu', hucre: { x: 5, y: 1 }, ozel: 'roket', eksen: 0, renk: 0, isi: 0 }]);
    expect(patlamaZamani(r.olaylar)['5,1']).toBeUndefined();
    expect(sec(r.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ t: 445, miktar: 60, hucre: { x: 5, y: 1 } }));
    expect(r.durum.hedefler[0].ilerleme).toBe(5);
    // Dönüşüm ısı vermez: (6,1) yalnız (5,1)'e komşu.
    expect(sec(r.olaylar, 'isindi').some((o) => o.hucre.x === 6 && o.hucre.y === 1)).toBe(false);
    expect(r.durum.istatistik.roket).toBe(1);
    // (5,1) altında dolu, roket yerinde kalır.
    expect(icerik(r.durum, 5, 1)).toEqual({ tur: 'kapsul', renk: 0, isi: 0, ozel: 'roket', eksen: 0 });
  });

  it.each([
    [[[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 1]], 3],
    [[[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 0]], 2],
    [[[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]], 1],
  ] as [[number, number][], Eksen][])('roket ekseni son segmentten (%j → %i)', (yol, eksen) => {
    const d = kur(['R R R R R R', 'R R R R R R', 'G A G A G A']);
    const r = hamleUygula(d, fitil(...yol));
    expect(sec(r.olaylar, 'ozelOlustu')[0]).toMatchObject({ ozel: 'roket', eksen });
  });

  it('9 düğüm → kasımpatı (+120), 12 düğüm → yıldız topu (renk −1, +200)', () => {
    const s = ['R R R R R R', 'R R R R R R', 'G A G A G A'];
    const yol9: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [4, 1], [3, 1]];
    const r9 = hamleUygula(kur(s), fitil(...yol9));
    expect(sec(r9.olaylar, 'ozelOlustu')[0]).toMatchObject({ ozel: 'kasimpati', renk: 0, hucre: { x: 3, y: 1 } });
    expect(sec(r9.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ miktar: 120 }));
    const yol12: [number, number][] = [...yol9, [2, 1], [1, 1], [0, 1]];
    const r12 = hamleUygula(kur(s), fitil(...yol12));
    expect(sec(r12.olaylar, 'ozelOlustu')[0]).toMatchObject({ ozel: 'yildiz', renk: -1, hucre: { x: 0, y: 1 } });
    expect(sec(r12.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ miktar: 200 }));
    expect(r12.durum.istatistik.yildiz).toBe(1);
  });

  it('kapalı eşik, halka ve özel son düğüm dönüşüm üretmez', () => {
    const s = ['R R R R R R', 'R R R R R R', 'G A G A G A'];
    const yol: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]];
    expect(sec(hamleUygula(kur(s, { ozelEsikleri: [0, 0, 0] }), fitil(...yol)).olaylar, 'ozelOlustu')).toHaveLength(0);
    const h = hamleUygula(kur(s), halka([0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1]));
    expect(sec(h.olaylar, 'ozelOlustu')).toHaveLength(0);
    // Son düğüm zaten roketse dönüşmez; normal biçimde tetiklenir.
    const s2 = ['R R R R R Rr1', 'R R R R R R', 'G A G A G A'];
    const r = hamleUygula(kur(s2), fitil(...yol));
    expect(sec(r.olaylar, 'ozelOlustu')).toHaveLength(0);
    expect(sec(r.olaylar, 'ozelTetiklendi')).toEqual([{ t: 445, tur: 'ozelTetiklendi', hucre: { x: 5, y: 0 }, ozel: 'roket', eksen: 1 }]);
  });
});

describe('etkiler (§4.2)', () => {
  it.each([0, 1, 2, 3] as Eksen[])('roket eksen %i: iki yönde kenara kadar, T + 25·d', (eksen) => {
    const d = kur(desen(7, 7, { '3,3': `Rr${eksen}` }));
    const r = hamleUygula(d, cift(3, 3));
    expect(patlamaZamani(r.olaylar)).toEqual(roketBeklenen(3, 3, eksen, 7, 7));
    expect(sec(r.olaylar, 'patlama')[0]).toMatchObject({ hucre: { x: 3, y: 3 }, neden: 'vurus', nesil: 0, puan: 15, ozel: 'roket' });
  });

  it('roket delikleri atlar, engel hasar alır ve roket yoluna devam eder', () => {
    const d = kur(desen(7, 5, { '0,2': 'Rr0', '2,2': '#', '4,2': 'K2' }));
    const r = hamleUygula(d, cift(0, 2));
    const z = patlamaZamani(r.olaylar);
    expect(z['1,2']).toBe(25);
    expect(z['3,2']).toBe(75);
    expect(z['5,2']).toBe(125);
    expect(z['6,2']).toBe(150);
    expect(sec(r.olaylar, 'engelHasar').map((o) => [o.t, o.kalan])).toEqual([
      [75, 1],
      [100, 0],
    ]);
  });

  it('kasımpatı: Chebyshev 1 → T+30 vuruş; 2 → T+60 ısı dalgası (engele hasar yok)', () => {
    const d = kur(desen(7, 7, { '3,3': 'Rk', '1,1': 'A3', '5,5': 'K1' }));
    const r = hamleUygula(d, cift(3, 3));
    const z = patlamaZamani(r.olaylar);
    const halka1 = ['2,2', '3,2', '4,2', '2,3', '4,3', '2,4', '3,4', '4,4'];
    for (const k of halka1) expect(z[k]).toBe(30);
    expect(sec(r.olaylar, 'isiDalgasi')).toEqual([{ t: 60, tur: 'isiDalgasi', merkez: { x: 3, y: 3 }, yaricap: 2 }]);
    const dalga = sec(r.olaylar, 'isindi').filter((o) => o.t === 60).map((o) => `${o.hucre.x},${o.hucre.y}`);
    expect(dalga).toHaveLength(15); // 16 hücre, (5,5) kaya ısınmaz
    expect(dalga).not.toContain('5,5');
    expect(sec(r.olaylar, 'engelHasar')).toHaveLength(0);
    expect(sec(r.olaylar, 'patlama').find((o) => o.hucre.x === 1 && o.hucre.y === 1)).toMatchObject({ t: 150, neden: 'isi', nesil: 1 });
  });

  it('yıldız topu (zincir dışı eylem): en çok renk; (dx²+dy², y, x) sırasıyla T + 20·(i+1); kafesli dahil', () => {
    const d = kur(['R A R', 'G * G', 'R Z cR']);
    const r = hamleUygula(d, cift(1, 1));
    expect(sec(r.olaylar, 'ozelTetiklendi')[0]).toMatchObject({ ozel: 'yildiz', hedefRenk: 0 });
    const z = patlamaZamani(r.olaylar);
    expect([z['0,0'], z['2,0'], z['0,2'], z['2,2']]).toEqual([20, 40, 60, 80]);
    expect(sec(r.olaylar, 'kafesKirildi')).toEqual([{ t: 80, tur: 'kafesKirildi', hucre: { x: 2, y: 2 } }]);
  });

  it('yıldız topu: en çok renk eşitliğinde küçük indeks', () => {
    const d = kur(['G A R', 'G * Z', 'R Z A']);
    const r = hamleUygula(d, cift(1, 1));
    expect(sec(r.olaylar, 'ozelTetiklendi')[0]).toMatchObject({ hedefRenk: 0 });
  });

  it('yıldız topu zincirde: zincir rengi; zincir düğümleri (planlı) hedef değil', () => {
    const d = kur(['G G * R', 'R R R G']);
    const r = hamleUygula(d, fitil([0, 0], [1, 0], [2, 0]));
    expect(sec(r.olaylar, 'ozelTetiklendi')[0]).toMatchObject({ t: 199, ozel: 'yildiz', hedefRenk: 3 });
    expect(patlamaZamani(r.olaylar)['3,1']).toBe(219);
    expect(patlamaZamani(r.olaylar)['0,1']).toBeUndefined();
  });

  it('yıldız topu zincir dışından tetiklenirse o hamlenin zincir rengi', () => {
    const d = kur(['Z Z Zr0 * R', 'R R R R Z']);
    const r = hamleUygula(d, fitil([0, 0], [1, 0], [2, 0]));
    const y = sec(r.olaylar, 'ozelTetiklendi').find((o) => o.ozel === 'yildiz');
    expect(y).toMatchObject({ t: 224, hucre: { x: 3, y: 0 }, hedefRenk: 2 });
    expect(patlamaZamani(r.olaylar)['4,1']).toBe(244);
  });

  it('çift dokunuş 1 hamle harcar, t = 0, nesil 0', () => {
    const d = kur(desen(5, 5, { '2,2': 'Rr0' }));
    const r = hamleUygula(d, cift(2, 2));
    expect(r.durum.kalanHamle).toBe(d.kalanHamle - 1);
    expect(sec(r.olaylar, 'ozelTetiklendi')[0]).toMatchObject({ t: 0 });
  });
});

describe('kombinasyonlar (§4.4)', () => {
  it('komboTuru: 6 çift, sıra önemsiz', () => {
    expect(komboTuru('roket', 'roket')).toBe('yildizHatti');
    expect(komboTuru('kasimpati', 'roket')).toBe('kalinRoket');
    expect(komboTuru('roket', 'kasimpati')).toBe('kalinRoket');
    expect(komboTuru('kasimpati', 'kasimpati')).toBe('devKasimpati');
    expect(komboTuru('yildiz', 'roket')).toBe('roketYagmuru');
    expect(komboTuru('kasimpati', 'yildiz')).toBe('bahce');
    expect(komboTuru('yildiz', 'yildiz')).toBe('buyukFinal');
  });

  it('YILDIZ HATTI: S1 yüklenir (sayılır, puan alır), S2\'den 8 yön T + 25·d', () => {
    const d = kur(desen(7, 7, { '3,3': 'Rr1', '4,3': 'Rr0' }));
    const r = hamleUygula(d, fitil([2, 3], [3, 3], [4, 3]));
    expect(sec(r.olaylar, 'yuklendi')).toEqual([{ t: 103, tur: 'yuklendi', hucre: { x: 3, y: 3 }, ozel: 'roket' }]);
    expect(sec(r.olaylar, 'patlama').find((o) => o.hucre.x === 3 && o.hucre.y === 3)).toMatchObject({ neden: 'fitil', puan: 20, k: 2 });
    expect(sec(r.olaylar, 'kombinasyon')).toEqual([{ t: 199, tur: 'kombinasyon', hucre: { x: 4, y: 3 }, kombo: 'yildizHatti' }]);
    expect(sec(r.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ t: 199, miktar: 300 }));
    const z = patlamaZamani(r.olaylar);
    expect(z['5,2']).toBe(224);
    expect(z['6,1']).toBe(249);
    expect(z['3,2']).toBe(224);
    expect(z['4,0']).toBe(274);
    expect(z['4,6']).toBe(274);
    expect(z['6,3']).toBe(249);
    expect(z['1,3']).toBe(274);
    expect(z['0,3']).toBe(299);
    expect(z['6,5']).toBe(249);
    expect(z['2,5']).toBe(249);
    // S1'in kendi (dikey) etkisi uygulanmaz.
    expect(z['3,0']).toBeUndefined();
    expect(sec(r.olaylar, 'ozelTetiklendi')).toHaveLength(0);
    expect(r.durum.istatistik.kombinasyon).toBe(1);
    expect(sec(r.olaylar, 'reaksiyon')[0].kombo).toBe(true);
  });

  it('KALIN ROKET (yatay): y−1, y, y+1 satırları T + 25·|dx|', () => {
    const d = kur(desen(7, 7, { '1,3': 'R', '2,3': 'Rr0', '3,3': 'Rk' }));
    const r = hamleUygula(d, fitil([1, 3], [2, 3], [3, 3]));
    expect(sec(r.olaylar, 'kombinasyon')[0]).toMatchObject({ kombo: 'kalinRoket', t: 199 });
    const z = patlamaZamani(r.olaylar);
    for (const y of [2, 3, 4]) {
      for (let x = 0; x < 7; x++) {
        if (y === 3 && x <= 3) continue; // zincir
        expect(z[`${x},${y}`], `${x},${y}`).toBe(199 + 25 * Math.abs(x - 3));
      }
    }
    expect(z['3,1']).toBeUndefined();
    expect(z['3,5']).toBeUndefined();
  });

  it('KALIN ROKET (çapraz ↗): (x−1,y), (x,y), (x+1,y) noktalarından geçen üç çapraz', () => {
    const d = kur(desen(7, 7, { '2,3': 'Rk', '3,3': 'Rr2', '1,3': 'R' }));
    const r = hamleUygula(d, fitil([1, 3], [2, 3], [3, 3]));
    const z = patlamaZamani(r.olaylar);
    const T = 199;
    expect(z['4,2']).toBe(T + 25);
    expect(z['6,0']).toBe(T + 75);
    expect(z['0,6']).toBe(T + 75);
    expect(z['3,2']).toBe(T + 25); // (2,3) hattı
    expect(z['5,0']).toBe(T + 75);
    expect(z['4,3']).toBe(T); // (4,3) taban noktası, d = 0
    expect(z['5,2']).toBe(T + 25);
    expect(z['1,6']).toBe(T + 75);
    expect(z['3,0']).toBeUndefined();
  });

  it('DEV KASIMPATI: Chebyshev ≤ 2 → T + 30·d vuruş, d = 3 → T + 90 ısı', () => {
    const d = kur(desen(7, 7, { '1,3': 'R', '2,3': 'Rk', '3,3': 'Rk' }));
    const r = hamleUygula(d, fitil([1, 3], [2, 3], [3, 3]));
    expect(sec(r.olaylar, 'kombinasyon')[0]).toMatchObject({ kombo: 'devKasimpati' });
    const z = patlamaZamani(r.olaylar);
    expect(z['4,4']).toBe(229);
    expect(z['5,5']).toBe(259);
    expect(z['1,1']).toBe(259);
    expect(sec(r.olaylar, 'isiDalgasi')).toEqual([{ t: 289, tur: 'isiDalgasi', merkez: { x: 3, y: 3 }, yaricap: 3 }]);
    const d3 = sec(r.olaylar, 'isindi').filter((o) => o.t === 289).map((o) => `${o.hucre.x},${o.hucre.y}`);
    expect(d3).toContain('0,0');
    expect(d3).toContain('6,6');
    expect(d3).toContain('6,3');
  });

  it('ROKET YAĞMURU: zincir rengindeki planlı olmayanlar (y,x) sırasıyla roket, eksen i mod 4, T + 40·(i+1)', () => {
    const d = kur(['R * Rr0 A Z', 'R Z G R A', 'R G A Z G', 'Z A R G R']);
    const r = hamleUygula(d, fitil([0, 0], [1, 0], [2, 0]));
    expect(sec(r.olaylar, 'kombinasyon')[0]).toMatchObject({ kombo: 'roketYagmuru', t: 199, hucre: { x: 2, y: 0 } });
    const yeni = sec(r.olaylar, 'ozelOlustu').map((o) => [o.hucre.x, o.hucre.y, o.eksen, o.t]);
    expect(yeni).toEqual([
      [0, 1, 0, 199],
      [3, 1, 1, 199],
      [0, 2, 2, 199],
      [2, 3, 3, 199],
      [4, 3, 0, 199],
    ]);
    const z = patlamaZamani(r.olaylar);
    expect([z['0,1'], z['3,1'], z['0,2'], z['2,3'], z['4,3']]).toEqual([239, 279, 319, 359, 399]);
    expect(sec(r.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ miktar: 600, t: 199 }));
  });

  it('BAHÇE: zincir rengindekiler kasımpatı, S2\'ye uzaklık sırasıyla T + 40·(i+1)', () => {
    const d = kur(['R * Rk A Z', 'R Z G R A', 'R G A Z G', 'Z A R G R']);
    const r = hamleUygula(d, fitil([0, 0], [1, 0], [2, 0]));
    expect(sec(r.olaylar, 'kombinasyon')[0]).toMatchObject({ kombo: 'bahce' });
    const yeni = sec(r.olaylar, 'ozelOlustu').map((o) => `${o.hucre.x},${o.hucre.y}:${o.ozel}`);
    expect(yeni).toEqual(['3,1:kasimpati', '0,1:kasimpati', '0,2:kasimpati', '2,3:kasimpati', '4,3:kasimpati']);
    const z = patlamaZamani(r.olaylar);
    expect([z['3,1'], z['0,1'], z['0,2'], z['2,3'], z['4,3']]).toEqual([239, 279, 319, 359, 399]);
  });

  it('BÜYÜK FİNAL: delik dışı bütün hücreler S2\'den Chebyshev halkaları T + 40·d; engel 1 hasar', () => {
    const d = kur(['* * R A', 'Z # K3 G', 'A G R Z']);
    const r = hamleUygula(d, fitil([0, 0], [1, 0], [2, 0]));
    expect(sec(r.olaylar, 'kombinasyon')[0]).toMatchObject({ kombo: 'buyukFinal', t: 103, hucre: { x: 1, y: 0 } });
    const z = patlamaZamani(r.olaylar);
    expect(z['0,1']).toBe(143);
    expect(z['3,1']).toBe(183);
    expect(z['0,2']).toBe(183);
    expect(z['3,2']).toBe(183);
    expect(z['3,0']).toBe(183);
    expect(z['2,0']).toBe(199); // zincir düğümü, vuruş yok sayıldı
    // K3: büyük final vuruşu 1 hasar (143); sonra komşu patlamalar (3,1) ve (2,2) bitişik hasar (183).
    expect(sec(r.olaylar, 'engelHasar').map((o) => [o.t, o.kalan])).toEqual([
      [143, 2],
      [183, 1],
      [183, 0],
    ]);
    expect(sec(r.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ miktar: 1000 }));
  });

  it('üçüncü özel taş ayrı tetiklenir', () => {
    const d = kur(desen(5, 3, { '0,1': 'Rr1', '1,1': 'Rr1', '2,1': 'Rr0' }));
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'yuklendi').map((o) => o.hucre)).toEqual([{ x: 0, y: 1 }]);
    expect(sec(r.olaylar, 'kombinasyon').map((o) => o.hucre)).toEqual([{ x: 1, y: 1 }]);
    expect(sec(r.olaylar, 'ozelTetiklendi')).toEqual([{ t: 199, tur: 'ozelTetiklendi', hucre: { x: 2, y: 1 }, ozel: 'roket', eksen: 0 }]);
  });

  it('zincir dışındaki tetiklemeler birleşmez', () => {
    const d = kur(desen(7, 3, { '1,1': 'Rr0', '3,1': 'Rr1', '5,1': 'Rr1' }));
    const r = hamleUygula(d, cift(1, 1));
    expect(sec(r.olaylar, 'kombinasyon')).toHaveLength(0);
    expect(sec(r.olaylar, 'ozelTetiklendi').map((o) => `${o.hucre.x},${o.hucre.y}@${o.t}`)).toEqual(['1,1@0', '3,1@50', '5,1@100']);
  });
});
