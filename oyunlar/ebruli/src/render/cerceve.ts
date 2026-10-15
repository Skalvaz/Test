/**
 * Ceviz tekne çerçevesi (GDD §11.4): damarlı ceviz kenar, içte ince altın
 * çizgi, köşelerde sekiz köşeli yıldız (iki iç içe kare, 45°), kenar
 * ortalarında rumi kıvrımı; suya düşen gölge ve teknenin iç kenarında
 * derinlik. Hepsi offscreen'e pişer; yalnız yeniden boyutlanmada çizilir.
 */
import { PALET } from '../app/katalog';
import type { Dikdortgen } from '../app/sozlesme';
import { gurultu1, karma01, TAU } from './matematik';
import { rgba } from './palet';
import { tuvalOlustur, yuvarlakDikdortgen, type Ctx, type Tuval } from './tuval';

export interface CerceveOlcu {
  /** Ceviz bant kalınlığı (px). */
  bant: number;
  /** Pişmiş tuvalin sahnedeki sol üstü. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bantKalinligi(hucre: number): number {
  return Math.max(12, Math.min(20, Math.round(hucre * 0.3)));
}

export class CerceveKatmani {
  tuval: Tuval | null = null;
  olcu: CerceveOlcu = { bant: 14, x: 0, y: 0, w: 0, h: 0 };
  private anahtar = '';

  /** `tahta`: hücrelerin kapladığı dikdörtgen. */
  pisir(tahta: Dikdortgen, hucre: number, dpr: number): void {
    const k = `${tahta.x}|${tahta.y}|${tahta.w}|${tahta.h}|${hucre}|${dpr}`;
    if (k === this.anahtar && this.tuval) return;
    this.anahtar = k;
    const bant = bantKalinligi(hucre);
    const ic = 3; // su ile ceviz arası pay
    const golge = 18;
    const pay = bant + ic + golge;
    const W = tahta.w + pay * 2;
    const H = tahta.h + pay * 2;
    const { tuval, ctx: c } = tuvalOlustur(W * dpr, H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.olcu = { bant, x: tahta.x - pay, y: tahta.y - pay, w: W, h: H };
    // Yerel koordinatlar: iç dikdörtgen (su açıklığı) ve dış.
    const ix = pay - ic;
    const iy = pay - ic;
    const iw = tahta.w + ic * 2;
    const ih = tahta.h + ic * 2;
    const ox = ix - bant;
    const oy = iy - bant;
    const ow = iw + bant * 2;
    const oh = ih + bant * 2;
    const R = bant * 0.7;

    // 1. Suya düşen gölge (shadowBlur yok: genişleyen yarı saydam konturlar).
    for (let i = golge; i >= 1; i--) {
      const a = 0.05 * (1 - i / golge) ** 1.6;
      c.strokeStyle = `rgba(0,6,10,${a.toFixed(3)})`;
      c.lineWidth = 2;
      yuvarlakDikdortgen(c, ox - i + 2, oy - i + 5, ow + i * 2 - 4, oh + i * 2 - 2, R + i);
      c.stroke();
    }

    // 2. Ceviz halka: dış yol − iç yol (evenodd).
    const halkaYolu = () => {
      yuvarlakDikdortgen(c, ox, oy, ow, oh, R);
      yuvarlakDikdortgen(c, ix, iy, iw, ih, 3, true);
    };
    c.save();
    halkaYolu();
    c.clip('evenodd');
    const tg = c.createLinearGradient(0, oy, 0, oy + oh);
    tg.addColorStop(0, PALET.ceviz);
    tg.addColorStop(0.5, '#4E321D');
    tg.addColorStop(1, PALET.cevizKoyu);
    c.fillStyle = tg;
    c.fillRect(ox, oy, ow, oh);
    // Damar: her kenarda boyuna, sin(y·0,15 + gürültü(x)·3) ile dalgalanan ince çizgiler.
    const damar = (uzun: number, kisa: number, yatay: boolean, x0: number, y0: number, tohum: number) => {
      const n = Math.round(kisa * 0.9);
      for (let i = 0; i < n; i++) {
        const v = (i + 0.5) / n;
        const a = 0.05 + 0.12 * karma01(i, tohum);
        c.strokeStyle = karma01(i, tohum + 1) < 0.5 ? `rgba(122,82,51,${a + 0.08})` : `rgba(30,18,10,${a + 0.05})`;
        c.lineWidth = 0.6 + karma01(i, tohum + 2) * 1.2;
        c.beginPath();
        for (let s = 0; s <= uzun; s += 6) {
          const off = Math.sin(s * 0.05 + gurultu1(s * 0.02 + i * 1.7, tohum) * 3) * kisa * 0.08 + gurultu1(s * 0.04, tohum + i) * 1.4;
          const kx = yatay ? x0 + s : x0 + v * kisa + off;
          const ky = yatay ? y0 + v * kisa + off : y0 + s;
          if (s === 0) c.moveTo(kx, ky);
          else c.lineTo(kx, ky);
        }
        c.stroke();
      }
    };
    // Gönye: her kenarı kendi yamuğuyla kırp.
    const kenar = (pts: number[], fn: () => void) => {
      c.save();
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.clip();
      fn();
      c.restore();
    };
    kenar([ox, oy, ox + ow, oy, ix + iw, iy, ix, iy], () => damar(ow, bant, true, ox, oy, 11));
    kenar([ox, oy + oh, ox + ow, oy + oh, ix + iw, iy + ih, ix, iy + ih], () => damar(ow, bant, true, ox, iy + ih, 23));
    kenar([ox, oy, ix, iy, ix, iy + ih, ox, oy + oh], () => damar(oh, bant, false, ox, oy, 37));
    kenar([ox + ow, oy, ix + iw, iy, ix + iw, iy + ih, ox + ow, oy + oh], () => damar(oh, bant, false, ix + iw, oy, 53));
    // Gönye çizgileri (köşegen birleşim).
    c.strokeStyle = 'rgba(20,12,6,0.45)';
    c.lineWidth = 1;
    for (const [ax, ay, bx, by] of [
      [ox, oy, ix, iy],
      [ox + ow, oy, ix + iw, iy],
      [ox, oy + oh, ix, iy + ih],
      [ox + ow, oy + oh, ix + iw, iy + ih],
    ]) {
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
    }
    c.restore();

    // 3. Pah: dış kenar üstte ışık, altta koyu; iç kenar koyu (suya iner).
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,220,170,0.22)';
    yuvarlakDikdortgen(c, ox + 0.75, oy + 0.75, ow - 1.5, oh - 1.5, R);
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 1;
    yuvarlakDikdortgen(c, ox, oy, ow, oh, R);
    c.stroke();

    // 4. İç altın çizgi (2 px) + koyu kontur.
    c.strokeStyle = PALET.altinKoyu;
    c.lineWidth = 3.4;
    yuvarlakDikdortgen(c, ix - 1.2, iy - 1.2, iw + 2.4, ih + 2.4, 4);
    c.stroke();
    const ag = c.createLinearGradient(ix, iy, ix + iw, iy + ih);
    ag.addColorStop(0, PALET.altinAcik);
    ag.addColorStop(0.5, PALET.altin);
    ag.addColorStop(1, PALET.altinAcik);
    c.strokeStyle = ag;
    c.lineWidth = 2;
    yuvarlakDikdortgen(c, ix - 1.2, iy - 1.2, iw + 2.4, ih + 2.4, 4);
    c.stroke();
    // Dış altın ip (ince).
    c.strokeStyle = rgba(PALET.altin, 0.55);
    c.lineWidth = 1;
    yuvarlakDikdortgen(c, ox + 3, oy + 3, ow - 6, oh - 6, Math.max(2, R - 3));
    c.stroke();

    // 5. Su açıklığının iç kenarında derinlik gölgesi.
    c.save();
    yuvarlakDikdortgen(c, ix, iy, iw, ih, 3);
    c.clip();
    const d = 10;
    const kenarGolge = (x: number, y: number, w: number, h: number, x0: number, y0: number, x1: number, y1: number, a: number) => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(0,6,12,${a})`);
      g.addColorStop(1, 'rgba(0,6,12,0)');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
    };
    kenarGolge(ix, iy, iw, d, 0, iy, 0, iy + d, 0.5);
    kenarGolge(ix, iy, d, ih, ix, 0, ix + d, 0, 0.4);
    kenarGolge(ix + iw - d, iy, d, ih, ix + iw, 0, ix + iw - d, 0, 0.3);
    kenarGolge(ix, iy + ih - d * 0.6, iw, d * 0.6, 0, iy + ih, 0, iy + ih - d * 0.6, 0.25);
    c.restore();

    // 6. Köşelerde sekiz köşeli yıldız, kenar ortalarında rumi.
    const ks = bant * 0.95;
    for (const [x, y] of [
      [ox + bant / 2, oy + bant / 2],
      [ox + ow - bant / 2, oy + bant / 2],
      [ox + bant / 2, oy + oh - bant / 2],
      [ox + ow - bant / 2, oy + oh - bant / 2],
    ]) yildiz8(c, x, y, ks);
    rumi(c, ox + ow / 2, oy + bant / 2, bant, 0);
    rumi(c, ox + ow / 2, oy + oh - bant / 2, bant, Math.PI);
    if (oh > bant * 10) {
      rumi(c, ox + bant / 2, oy + oh / 2, bant, -Math.PI / 2);
      rumi(c, ox + ow - bant / 2, oy + oh / 2, bant, Math.PI / 2);
    }
    this.tuval = tuval;
  }

  ciz(c: Ctx): void {
    if (!this.tuval) return;
    const o = this.olcu;
    c.drawImage(this.tuval, o.x, o.y, o.w, o.h);
  }
}

/** Sekiz köşeli yıldız: iki iç içe kare (45°), altın kontur, ceviz dolgu. */
export function yildiz8(c: Ctx, x: number, y: number, s: number): void {
  const yol = () => {
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.62 : s * 0.62 * Math.cos(Math.PI / 8) * 0.62;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  };
  c.save();
  // İki kare.
  for (const don of [0, Math.PI / 4]) {
    c.save();
    c.translate(x, y);
    c.rotate(don);
    const k = s * 0.44;
    c.fillStyle = PALET.cevizKoyu;
    c.fillRect(-k, -k, 2 * k, 2 * k);
    c.restore();
  }
  for (const don of [0, Math.PI / 4]) {
    c.save();
    c.translate(x, y);
    c.rotate(don);
    const k = s * 0.44;
    c.strokeStyle = PALET.altin;
    c.lineWidth = Math.max(1, s * 0.08);
    c.strokeRect(-k, -k, 2 * k, 2 * k);
    c.restore();
  }
  yol();
  c.fillStyle = rgba(PALET.altin, 0.0);
  c.fill();
  // Göbek.
  const g = c.createRadialGradient(x - s * 0.06, y - s * 0.06, 0, x, y, s * 0.2);
  g.addColorStop(0, PALET.altinAcik);
  g.addColorStop(1, PALET.altinKoyu);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, s * 0.17, 0, TAU);
  c.fill();
  c.restore();
}

/** Rumi kıvrımı: ortada küçük bir goncanın iki yanında simetrik iki Bezier kıvrım. */
export function rumi(c: Ctx, x: number, y: number, bant: number, aci: number): void {
  const s = bant * 0.42;
  c.save();
  c.translate(x, y);
  c.rotate(aci);
  c.lineCap = 'round';
  const kivrim = (yon: number) => {
    c.beginPath();
    c.moveTo(yon * s * 0.35, s * 0.15);
    c.bezierCurveTo(yon * s * 1.2, s * 0.9, yon * s * 2.6, s * 0.6, yon * s * 2.6, -s * 0.1);
    c.bezierCurveTo(yon * s * 2.6, -s * 0.7, yon * s * 1.9, -s * 0.8, yon * s * 1.7, -s * 0.25);
    c.stroke();
    c.beginPath();
    c.moveTo(yon * s * 2.6, -s * 0.1);
    c.quadraticCurveTo(yon * s * 3.3, -s * 0.2, yon * s * 3.8, s * 0.25);
    c.stroke();
  };
  for (const [renk, gen] of [
    [PALET.cevizKoyu, s * 0.55],
    [PALET.altin, s * 0.28],
  ] as const) {
    c.strokeStyle = renk;
    c.lineWidth = gen;
    kivrim(1);
    kivrim(-1);
  }
  // Gonca.
  c.fillStyle = PALET.cevizKoyu;
  c.beginPath();
  c.moveTo(0, -s * 0.95);
  c.quadraticCurveTo(s * 0.7, -s * 0.1, 0, s * 0.75);
  c.quadraticCurveTo(-s * 0.7, -s * 0.1, 0, -s * 0.95);
  c.fill();
  c.fillStyle = PALET.altinAcik;
  c.beginPath();
  c.moveTo(0, -s * 0.7);
  c.quadraticCurveTo(s * 0.45, -s * 0.1, 0, s * 0.5);
  c.quadraticCurveTo(-s * 0.45, -s * 0.1, 0, -s * 0.7);
  c.fill();
  c.restore();
}
