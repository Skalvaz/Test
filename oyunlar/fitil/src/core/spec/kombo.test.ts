/**
 * §4.4 kombinasyonlar: altı çiftin hücre kümeleri ve zamanları, S1'in
 * yüklenmesi, üçüncü özel taşın ayrı tetiklenmesi, §7.1 kombinasyon puanı.
 *
 * Düzenek (7×7, eşik 5 → hiçbir hücre 4 dik komşudan fazla ısı alamaz,
 * dolayısıyla ısı patlaması karışmaz): yol (1,3) R → (2,3) S1 → (3,3) S2.
 * Zamanlar: (1,3) 0, S1 103, S2 199 → birleşik etki T = 199, S2 hücresinde.
 */
import { describe, expect, it } from 'vitest';
import type { Konum } from '../index';
import { anahtar, cheb, fitil, hucrede, konumlar, kur, patlamaHaritasi, reaksiyonBonusu, sec, uygula } from './kur';

const T = 199;
const YOL = '1,3 2,3 3,3';
const YOL_HUCRE = new Set(['1,3', '2,3', '3,3']);
const TUM = konumlar({ w: 7, h: 7 });

function komboTahtasi(s1: string, s2: string, ek: Record<string, string> = {}): string[] {
  const ozel: Record<string, string> = { '1,3': 'R', '2,3': s1, '3,3': s2, ...ek };
  return Array.from({ length: 7 }, (_, y) => Array.from({ length: 7 }, (_, x) => ozel[`${x},${y}`] ?? '.').join(' '));
}

const komboUygula = (s1: string, s2: string, ek: Record<string, string> = {}, cikislar?: number[]) =>
  uygula(kur({ esik: 5, tahta: komboTahtasi(s1, s2, ek), cikislar }), fitil(YOL));

/** S2 = (3,3)'ten 8 yöndeki ışın hücreleri ve uzaklıkları. */
function isinlar(): { p: Konum; d: number }[] {
  const r: { p: Konum; d: number }[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    for (let d = 1; ; d++) {
      const p = { x: 3 + dx * d, y: 3 + dy * d };
      if (p.x < 0 || p.y < 0 || p.x > 6 || p.y > 6) break;
      r.push({ p, d });
    }
  }
  return r;
}

describe('§4.4 kombinasyonlar', () => {
  it('§4.4 S1 normal düğüm gibi patlar (sayılır, ısıtır, puan alır) ama etkisi yüklenir', () => {
    const { olaylar } = komboUygula('R|', 'R-');
    expect(sec(olaylar, 'yuklendi')).toMatchObject([{ t: 103, hucre: { x: 2, y: 3 }, ozel: 'roket' }]);
    const m = patlamaHaritasi(olaylar);
    expect(m.get('2,3')).toMatchObject({ t: 103, neden: 'fitil', k: 2, puan: 20, ozel: 'roket' });
    expect(hucrede(olaylar, 'isindi', 2, 2)).toMatchObject([{ t: 103 }]);
    // S1'in kendi dikey etkisi uygulanmaz: S2 ışınlarında olmayan sütun 2 hücreleri patlamaz.
    for (const k of ['2,0', '2,1', '2,5', '2,6']) expect(m.has(k), k).toBe(false);
  });

  it('§4.4 Roket + Roket = YILDIZ HATTI: S2\'den 8 yön, her hücre T + 25·d', () => {
    const { olaylar } = komboUygula('R|', 'R-');
    expect(sec(olaylar, 'kombinasyon')).toEqual([{ t: T, tur: 'kombinasyon', hucre: { x: 3, y: 3 }, kombo: 'yildizHatti' }]);
    const m = patlamaHaritasi(olaylar);
    const beklenen = isinlar().filter(({ p }) => !YOL_HUCRE.has(anahtar(p)));
    expect(beklenen).toHaveLength(22);
    for (const { p, d } of beklenen) expect(m.get(anahtar(p)), anahtar(p)).toMatchObject({ t: T + 25 * d, neden: 'vurus' });
    expect(m.size).toBe(22 + 3);
  });

  it('§4.4 Roket(yatay) + Kasımpatı = KALIN ROKET: y−1, y, y+1 satırları, T + 25·d', () => {
    const { olaylar } = komboUygula('R-', 'R@');
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ t: T, hucre: { x: 3, y: 3 }, kombo: 'kalinRoket' }]);
    const m = patlamaHaritasi(olaylar);
    for (const p of TUM) {
      const k = anahtar(p);
      if (YOL_HUCRE.has(k)) continue;
      const seritte = p.y >= 2 && p.y <= 4;
      expect(m.has(k), k).toBe(seritte);
      if (!seritte) continue;
      const d = Math.abs(p.x - 3);
      // §4.4 belirsiz: S2'nin tam üstü/altı (d = 0) için zaman T..T+25 aralığında kabul edildi.
      if (d === 0) expect(m.get(k)!.t).toBeGreaterThanOrEqual(T);
      if (d === 0) expect(m.get(k)!.t).toBeLessThanOrEqual(T + 25);
      else expect(m.get(k), k).toMatchObject({ t: T + 25 * d, neden: 'vurus' });
    }
  });

  it('§4.4 Kasımpatı + Roket(dikey) = KALIN ROKET: x−1, x, x+1 sütunları (sıra bağımsız)', () => {
    const { olaylar } = komboUygula('R@', 'R|');
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ kombo: 'kalinRoket' }]);
    const m = patlamaHaritasi(olaylar);
    for (const p of TUM) {
      const k = anahtar(p);
      if (YOL_HUCRE.has(k)) continue;
      const seritte = p.x >= 2 && p.x <= 4;
      expect(m.has(k), k).toBe(seritte);
      const d = Math.abs(p.y - 3);
      if (seritte && d > 0) expect(m.get(k), k).toMatchObject({ t: T + 25 * d });
    }
  });

  it('§4.4 Kasımpatı + Roket(çapraz ↗) = KALIN ROKET: (x−1,y), (x,y), (x+1,y)\'den geçen üç paralel çapraz', () => {
    // eksen 2 yönü (1,−1) x+y'yi korur: şerit = x+y ∈ {5, 6, 7}.
    const { olaylar } = komboUygula('R@', 'R/');
    const m = patlamaHaritasi(olaylar);
    for (const p of TUM) {
      const k = anahtar(p);
      if (YOL_HUCRE.has(k)) continue;
      expect(m.has(k), k).toBe(p.x + p.y >= 5 && p.x + p.y <= 7);
    }
  });

  it('§4.4 Kasımpatı + Kasımpatı = DEV KASIMPATI: Chebyshev ≤ 2 T + 30·d VURUŞ, d = 3 halkasına T + 90 +1 ısı', () => {
    const { olaylar } = komboUygula('R@', 'R@');
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ t: T, kombo: 'devKasimpati' }]);
    const m = patlamaHaritasi(olaylar);
    const merkez = { x: 3, y: 3 };
    for (const p of TUM) {
      const k = anahtar(p);
      if (YOL_HUCRE.has(k)) continue;
      const d = cheb(p, merkez);
      if (d <= 2) expect(m.get(k), k).toMatchObject({ t: T + 30 * d, neden: 'vurus' });
      else {
        expect(m.has(k), k).toBe(false);
        expect(hucrede(olaylar, 'isindi', p.x, p.y).some((o) => o.t === T + 90), k).toBe(true);
      }
    }
  });

  it('§4.4 Yıldız + Roket = ROKET YAĞMURU: zincir rengindeki kapsüller (y,x) sırasıyla rokete döner, i. eksen i mod 4, T + 40·(i+1)', () => {
    // (y, x) sırası (6,0), (4,4), (1,5) — uzaklık sırasından ((4,4), (1,5), (6,0)) farklı.
    const { olaylar } = komboUygula('*', 'R-', { '6,0': 'R', '4,4': 'R', '1,5': 'R' });
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ t: T, hucre: { x: 3, y: 3 }, kombo: 'roketYagmuru' }]);
    const m = patlamaHaritasi(olaylar);
    [
      [6, 0],
      [4, 4],
      [1, 5],
    ].forEach(([x, y], i) => {
      expect(hucrede(olaylar, 'ozelTetiklendi', x, y), `${x},${y}`).toMatchObject([{ t: T + 40 * (i + 1), ozel: 'roket', eksen: i % 4 }]);
      expect(m.get(`${x},${y}`)).toMatchObject({ t: T + 40 * (i + 1) });
    });
    // 0. roket (6,0) yatay: (5,0) T+40+25'te; 1. roket (4,4) dikey: (4,3) ve (4,5) T+80+25'te
    expect(m.get('5,0')).toMatchObject({ t: T + 40 + 25, neden: 'vurus' });
    expect(m.get('4,3')).toMatchObject({ t: T + 80 + 25, neden: 'vurus' });
    expect(m.get('4,5')).toMatchObject({ t: T + 80 + 25, neden: 'vurus' });
  });

  it('§4.4 Yıldız + Kasımpatı = BAHÇE: zincir rengindeki kapsüller kasımpatıya döner, uzaklık sırasıyla T + 40·(i+1)', () => {
    // uzaklıklar (3,3)'ten: (3,1) [Cheb 2, d² 4] < (5,5) [Cheb 2, d² 8] < (6,0) [Cheb 3, d² 18];
    // (y, x) sırası bundan farklı olur: (6,0), (3,1), (5,5).
    const { olaylar } = komboUygula('*', 'R@', { '3,1': 'R', '5,5': 'R', '6,0': 'R' });
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ t: T, kombo: 'bahce' }]);
    [
      [3, 1],
      [5, 5],
      [6, 0],
    ].forEach(([x, y], i) => {
      expect(hucrede(olaylar, 'ozelTetiklendi', x, y), `${x},${y}`).toMatchObject([{ t: T + 40 * (i + 1), ozel: 'kasimpati' }]);
    });
    const m = patlamaHaritasi(olaylar);
    // (3,1) kasımpatısının halka 1'i T + 40 + 30'da
    expect(m.get('3,0')).toMatchObject({ t: T + 70, neden: 'vurus' });
  });

  it('§4.4 Yıldız + Yıldız = BÜYÜK FİNAL: delik dışındaki her hücre Chebyshev halkalarıyla T + 40·d VURUŞ; engel 1 hasar', () => {
    // (6,6) K2 yalnız vuruş alır (dik komşuları fener → bitişik hasar yok).
    const { olaylar } = komboUygula('*', '*', { '6,6': 'K2', '5,6': 'F', '6,5': 'F' }, []);
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ t: T, kombo: 'buyukFinal' }]);
    const m = patlamaHaritasi(olaylar);
    const merkez = { x: 3, y: 3 };
    for (const p of TUM) {
      const k = anahtar(p);
      if (YOL_HUCRE.has(k) || ['6,6', '5,6', '6,5'].includes(k)) continue;
      expect(m.get(k), k).toMatchObject({ t: T + 40 * cheb(p, merkez), neden: 'vurus' });
    }
    expect(hucrede(olaylar, 'engelHasar', 6, 6)).toEqual([{ t: T + 120, tur: 'engelHasar', hucre: { x: 6, y: 6 }, engel: 'kaya', kalan: 1 }]);
  });

  it('§4.4 yoldaki üçüncü özel taş ayrı tetiklenir (tek kombinasyon)', () => {
    const d = kur({ esik: 5, tahta: komboTahtasi('R|', 'R|', { '0,3': 'R', '1,3': 'R|', '2,3': 'R|', '3,3': 'R@' }) });
    const { olaylar } = uygula(d, fitil('0,3 1,3 2,3 3,3'));
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ t: 199, hucre: { x: 2, y: 3 }, kombo: 'yildizHatti' }]);
    expect(hucrede(olaylar, 'ozelTetiklendi', 3, 3)).toMatchObject([{ t: 288, ozel: 'kasimpati' }]);
    const m = patlamaHaritasi(olaylar);
    // (4,2) ve (4,4) yıldız hattının ışınlarında değil; yalnız S3 kasımpatısı (T3 + 30) vurur.
    expect(m.get('4,2')).toMatchObject({ t: 318, neden: 'vurus' });
    expect(m.get('4,4')).toMatchObject({ t: 318, neden: 'vurus' });
  });
});

describe('§7.1 kombinasyon puanı', () => {
  it.each([
    ['R|', 'R-', 'yildizHatti', 300],
    ['R-', 'R@', 'kalinRoket', 300],
    ['R@', 'R@', 'devKasimpati', 400],
    ['*', '*', 'buyukFinal', 1000],
  ] as const)('§7.1 %s + %s (%s): toplam = düğümler 60 + 15·vuruş + %i + reaksiyon bonusu', (s1, s2, kombo, kp) => {
    const { olaylar, durum } = komboUygula(s1, s2);
    expect(sec(olaylar, 'kombinasyon')).toMatchObject([{ kombo }]);
    const vurus = sec(olaylar, 'patlama').filter((p) => p.neden === 'vurus');
    for (const p of vurus) expect(p.puan).toBe(15);
    const R = vurus.length;
    expect(sec(olaylar, 'patlama')).toHaveLength(R + 3);
    expect(durum.puan).toBe(60 + 15 * R + kp + reaksiyonBonusu(R).bonus);
    expect(sec(olaylar, 'reaksiyon')).toMatchObject([{ boyut: R, kombo: true, kademe: reaksiyonBonusu(R).kademe }]);
  });
});
