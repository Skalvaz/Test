/** Kilitlenme testi (§3.4). */
import { SEKIZ, DIK, icinde, idx, zincirlenebilir } from './tahta';
import type { OyunDurumu } from './types';

export function kilitliMi(d: OyunDurumu): boolean {
  for (const h of d.hucreler) {
    if (!h.delik && h.icerik?.tur === 'kapsul' && h.icerik.ozel !== 'yok' && !h.kafes) return false;
  }
  const komsu = d.kurallar.dortKomsu ? DIK : SEKIZ;
  for (let c = 0; c < d.renkSayisi; c++) {
    const gorulen = new Uint8Array(d.w * d.h);
    for (let y = 0; y < d.h; y++) {
      for (let x = 0; x < d.w; x++) {
        const i = idx(d, x, y);
        if (gorulen[i] || !zincirlenebilir(d, x, y, c)) continue;
        // BFS bileşen boyutu
        let boyut = 0;
        const kuyruk = [i];
        gorulen[i] = 1;
        while (kuyruk.length) {
          const j = kuyruk.pop()!;
          boyut++;
          const jx = j % d.w;
          const jy = (j - jx) / d.w;
          for (const k of komsu) {
            const nx = jx + k.x;
            const ny = jy + k.y;
            if (!icinde(d, nx, ny)) continue;
            const n = idx(d, nx, ny);
            if (gorulen[n] || !zincirlenebilir(d, nx, ny, c)) continue;
            gorulen[n] = 1;
            kuyruk.push(n);
          }
        }
        if (boyut >= 3) {
          if (!d.kurallar.yalnizHalka) return false;
          // yalnizHalka: döngü araması P1'de (§3.4) — şimdilik yeterli say.
          return false;
        }
      }
    }
  }
  return true;
}
