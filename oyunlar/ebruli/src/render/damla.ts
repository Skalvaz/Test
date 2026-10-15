/**
 * Damla çizim tarifi (GDD §11.3) — P0 başvuru çizimi. Çizici paketi bunu
 * sprite önbelleğine (offscreen, renk × tür × boyut × DPR) pişirir; burada
 * doğrudan çizilir. `shadowBlur` YASAK: parıltı radyal gradyanla.
 *
 * Ham damla: mat gövde, tek ince ebru halkası, tek motif.
 * Karışık damla: parlak gövde, üç halka (açık/koyu/açık), iki motif ve altın
 * pırıltı — "bu eşleşir" işareti. Mürekkep: koyu gövde, altın kenar, üç motif.
 */
import type { Renk } from '../core/types';
import { PALET, RENK_TANIMLARI, type Motif } from '../app/katalog';

export interface DamlaSecenek {
  palet?: 'standart' | 'renkKoru';
  /** 0..1 nefes/nabız ölçeği çarpanı (1 = durgun). */
  olcek?: number;
}

function motifCiz(c: CanvasRenderingContext2D, motifler: readonly Motif[], r: number, renk: string): void {
  const nokta = motifler.includes('nokta');
  const halka = motifler.includes('halka');
  const dalga = motifler.includes('dalga');
  c.strokeStyle = renk;
  c.fillStyle = renk;
  c.lineCap = 'round';
  const iki = motifler.length >= 2;
  if (halka) {
    c.lineWidth = r * 0.085;
    c.beginPath();
    c.arc(0, dalga && !nokta ? -r * 0.05 : 0, r * (iki ? 0.34 : 0.3), 0, Math.PI * 2);
    c.stroke();
  }
  if (dalga) {
    c.lineWidth = r * 0.085;
    const yy = halka && nokta ? r * 0.5 : nokta ? r * 0.2 : halka ? r * 0.05 : 0;
    const gen = r * (iki ? 0.5 : 0.42);
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const x = -gen + 2 * gen * u;
      const y = yy + Math.sin(u * Math.PI * 3) * r * 0.11;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  if (nokta) {
    c.beginPath();
    c.arc(0, dalga && !halka ? -r * 0.18 : dalga ? -r * 0.12 : 0, r * 0.13, 0, Math.PI * 2);
    c.fill();
  }
}

/** (cx, cy) merkezli, hücre boyu `h` olan bir damla çizer. */
export function damlaCiz(c: CanvasRenderingContext2D, cx: number, cy: number, h: number, kod: Renk, s: DamlaSecenek = {}): void {
  const tanim = RENK_TANIMLARI[kod];
  const [ana, acik, koyu] = s.palet === 'renkKoru' ? tanim.renkKoru : tanim.standart;
  const ham = tanim.ham;
  const murekkep = kod === 7;
  const r = h * (ham ? 0.4 : 0.43) * (s.olcek ?? 1);
  c.save();
  c.translate(cx, cy);

  // 1. Suya yayılan hale (parıltı; shadowBlur değil).
  const hale = c.createRadialGradient(0, 0, r * 0.6, 0, 0, h * (ham ? 0.56 : 0.64));
  hale.addColorStop(0, murekkep ? 'rgba(201,162,39,0.30)' : ana + (ham ? '40' : '66'));
  hale.addColorStop(1, ana + '00');
  c.fillStyle = hale;
  c.beginPath();
  c.arc(0, 0, h * 0.66, 0, Math.PI * 2);
  c.fill();

  // 2. Gövde.
  const g = c.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.1, 0, 0, r);
  g.addColorStop(0, acik);
  g.addColorStop(ham ? 0.6 : 0.45, ana);
  g.addColorStop(1, koyu);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();

  // 3. Ebru halkaları.
  c.lineWidth = r * (ham ? 0.06 : 0.075);
  if (ham) {
    c.strokeStyle = 'rgba(243,233,210,0.42)';
    c.beginPath();
    c.arc(0, 0, r * 0.74, 0, Math.PI * 2);
    c.stroke();
  } else if (murekkep) {
    c.strokeStyle = PALET.altin;
    c.lineWidth = r * 0.09;
    c.beginPath();
    c.arc(0, 0, r * 0.93, 0, Math.PI * 2);
    c.stroke();
  } else {
    const halkalar: [number, string][] = [
      [0.86, 'rgba(243,233,210,0.70)'],
      [0.7, koyu + 'B0'],
      [0.56, 'rgba(243,233,210,0.45)'],
    ];
    for (const [rr, renk] of halkalar) {
      c.strokeStyle = renk;
      c.beginPath();
      c.arc(0, 0, r * rr, 0, Math.PI * 2);
      c.stroke();
    }
  }

  // 4. Motif (renk körlüğü; karışık iki ebeveynin motifini taşır).
  motifCiz(c, tanim.motifler, r * (ham ? 0.95 : 0.8), murekkep ? PALET.altinAcik : ham ? 'rgba(30,26,22,0.62)' : 'rgba(243,233,210,0.92)');

  // 5. Yansıma: ham mat, karışık parlak.
  c.fillStyle = `rgba(255,255,255,${ham ? 0.22 : 0.5})`;
  c.beginPath();
  c.ellipse(-r * 0.38, -r * 0.48, r * 0.3, r * 0.14, -0.5, 0, Math.PI * 2);
  c.fill();

  // 6. Karışık: altın pırıltı (sağ üst, dört uçlu).
  if (!ham && !murekkep) {
    const px = r * 0.62;
    const py = -r * 0.62;
    const u = r * 0.26;
    c.fillStyle = PALET.altinAcik;
    c.beginPath();
    c.moveTo(px, py - u);
    c.quadraticCurveTo(px, py, px + u, py);
    c.quadraticCurveTo(px, py, px, py + u);
    c.quadraticCurveTo(px, py, px - u, py);
    c.quadraticCurveTo(px, py, px, py - u);
    c.fill();
  }
  c.restore();
}
