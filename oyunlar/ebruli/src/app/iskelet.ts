/**
 * P0 iskelet sahnesi: uygulama paketi (P-app) gelene kadar gösterilir.
 * Altyapıyı uçtan uca doğrular: Stage (DPR ≤ 2), gömülü yazı tipleri,
 * palet ve damla tarifi (§11.3), tek dosya derlemesi ve test kancası.
 * Uygulama paketi bu dosyayı SİLER ve main.ts'i `Uygulama`ya bağlar.
 */
import { Stage } from '../render/stage';
import { damlaCiz } from '../render/damla';
import { PALET } from './katalog';
import type { Renk } from '../core/types';

/** Örnek tekne: 7×9, bütün renkler ve bir karışım tarifi görünür. */
const ORNEK: readonly string[] = [
  '1 2 4 3 5 6 7',
  '2 2 1 4 4 1 2',
  '4 3 3 2 1 5 4',
  '1 4 2 6 6 2 1',
  '2 1 5 4 1 4 3',
  '6 4 5 1 2 3 3',
  '6 2 1 2 4 1 2',
  '4 1 3 4 2 5 4',
  '2 5 5 1 6 2 1',
];

export function iskeletBaslat(host: HTMLElement, yaziHazir: Promise<void>): Record<string, unknown> {
  const stage = new Stage(host, 2);
  const kart = document.createElement('div');
  kart.className = 'iskelet-kart';
  kart.innerHTML = '<h1>Ebruli</h1><p>Deneme iskeleti. Oyun <b>yakında</b> bu teknede.</p>';
  host.appendChild(kart);

  let zaman = 0;
  let son = 0;
  const ciz = (t: number) => {
    const dt = son ? Math.min(50, t - son) : 16;
    son = t;
    zaman += dt;
    const c = stage.begin();
    const W = stage.width;
    const H = stage.height;
    // Su (tekne): koyu deniz yeşili → lacivert.
    const su = c.createLinearGradient(0, 0, 0, H);
    su.addColorStop(0, PALET.suUst);
    su.addColorStop(1, PALET.suAlt);
    c.fillStyle = su;
    c.fillRect(0, 0, W, H);
    // Hafif dalga şeritleri.
    c.strokeStyle = 'rgba(31,77,79,0.35)';
    c.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
      const y0 = (H / 14) * k + 10;
      c.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const y = y0 + Math.sin(x * 0.02 + zaman * 0.0006 + k) * 3;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    // Tahta: hücre = min((W − 32)/7, (0,62·H)/9, 64).
    const hucre = Math.floor(Math.min((W - 32) / 7, (0.62 * H) / 9, 64));
    const bw = hucre * 7;
    const bh = hucre * 9;
    const ox = Math.round((W - bw) / 2);
    const oy = Math.round(Math.max(16, (H - bh) * 0.28));
    // Ceviz çerçeve.
    c.fillStyle = PALET.cevizKoyu;
    c.fillRect(ox - 12, oy - 12, bw + 24, bh + 24);
    c.strokeStyle = PALET.altin;
    c.lineWidth = 2;
    c.strokeRect(ox - 6, oy - 6, bw + 12, bh + 12);
    c.fillStyle = 'rgba(10,30,51,0.55)';
    c.fillRect(ox, oy, bw, bh);
    for (let y = 0; y < 9; y++) {
      const sat = ORNEK[y].split(' ');
      for (let x = 0; x < 7; x++) {
        const kod = Number(sat[x]) as Renk;
        const nefes = 1 + 0.02 * Math.sin(zaman * 0.0019 + x * 0.7 + y * 1.3);
        damlaCiz(c, ox + (x + 0.5) * hucre, oy + (y + 0.5) * hucre, hucre, kod, { olcek: nefes });
      }
    }
    requestAnimationFrame(ciz);
  };
  requestAnimationFrame(ciz);

  return {
    surum: 'P0-iskelet',
    ekran: () => 'iskelet',
    yaziHazir: () => yaziHazir.then(() => true),
    boyut: () => ({ w: stage.width, h: stage.height, dpr: stage.dpr }),
  };
}
