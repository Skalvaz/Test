/**
 * Performans bütçeleri (GDD §13.5, §4.7): 7×9 D3 garanti 2 tahtada
 * `hamleUygula` (garanti dahil) ortanca < 2 ms, `onizle` < 1 ms. Test
 * makinesi ve paralel koşu gürültüsü için eşikler 3× gevşek tutulur;
 * gerçek değerler `npm run bot -- --olcum` ile raporlanır.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, hamleUygula, onizle, olumluHamleler } from './index';
import type { BolumVerisi, Hamle, OyunDurumu } from './types';
import { rngInt } from './rng';
import { tumHamleler } from './testAraclari';
import b001 from '../levels/veri/b001.json';

function ortanca(l: number[]): number {
  const s = l.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe('performans (7×9, garanti 2)', () => {
  it('hamleUygula ortanca < 6 ms, onizle ortanca < 3 ms', () => {
    const v: BolumVerisi = { ...(b001 as unknown as BolumVerisi), id: 777, w: 7, h: 9, tohum: 99, dogum: [20, 20, 20, 11, 11, 11], garanti: 2, hamle: 40, duzen: Array(9).fill('. . . . . . .'), zorunluIlkHamle: undefined, hedefler: [{ tur: 'puan', puan: 1e9 }] };
    const hamleSure: number[] = [];
    const onizleSure: number[] = [];
    for (let oyun = 0; oyun < 4; oyun++) {
      let d: OyunDurumu = bolumuYukle(v, oyun);
      const r = { rng: oyun + 7 };
      for (let k = 0; k < 30 && !d.bitti; k++) {
        const l = tumHamleler(d);
        for (const h of l.slice(0, 10)) {
          const t0 = performance.now();
          onizle(d, h);
          onizleSure.push(performance.now() - t0);
        }
        const hz = olumluHamleler(d);
        const h: Hamle = hz.length && rngInt(r, 4) ? hz[rngInt(r, hz.length)].hamle : l[rngInt(r, l.length)];
        const t0 = performance.now();
        const s = hamleUygula(d, h);
        hamleSure.push(performance.now() - t0);
        d = s.durum;
      }
    }
    const h50 = ortanca(hamleSure);
    const o50 = ortanca(onizleSure);
    expect(h50).toBeLessThan(6);
    expect(o50).toBeLessThan(3);
  }, 60_000);
});
