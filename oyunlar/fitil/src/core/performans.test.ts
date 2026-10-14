/**
 * Performans (§16.6): 7×9 tahtada hamleUygula ortancası < 1 ms. Test
 * makinesi ve paralel koşu gürültüsü için gevşek eşik (3 ms) ile denetlenir;
 * ölçülen ortanca test adında değil, hata iletisinde görünür.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from './bolumYukle';
import { hamleUygula } from './hamle';
import { rastgeleBolum, rastgeleHamle } from './testAraclari';
import type { Hamle, OyunDurumu } from './types';

function simdi(): number {
  return Number(process.hrtime.bigint()) / 1e6;
}

describe('performans', () => {
  it('7×9 hamleUygula ortancası', () => {
    // Örnek hamleleri önceden topla (ölçüm yalnız hamleUygula).
    const ornek: [OyunDurumu, Hamle][] = [];
    for (let oyun = 0; ornek.length < 300 && oyun < 100; oyun++) {
      const r = { rng: 1000 + oyun };
      let d = bolumuYukle(rastgeleBolum(r, 8000 + oyun, true), 0);
      for (let k = 0; k < 15; k++) {
        const h = rastgeleHamle(d, r, false);
        if (!h) break;
        ornek.push([d, h]);
        d = hamleUygula(d, h).durum;
      }
    }
    // Isınma.
    for (const [d, h] of ornek.slice(0, 50)) hamleUygula(d, h);
    const sureler: number[] = [];
    for (const [d, h] of ornek) {
      const t0 = simdi();
      hamleUygula(d, h);
      sureler.push(simdi() - t0);
    }
    sureler.sort((a, b) => a - b);
    const ortanca = sureler[sureler.length >> 1];
    expect(ornek.length).toBeGreaterThanOrEqual(200);
    expect(ortanca, `ortanca ${ortanca.toFixed(3)} ms`).toBeLessThan(3);
  });
});
