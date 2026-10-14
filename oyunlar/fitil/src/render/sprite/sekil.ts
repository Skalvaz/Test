/**
 * Kapsül siluetleri (GDD §13.2 adım 2). Yol, (0,0) merkezli ve r = gövde
 * yarıçapıyla üretilir. Gri tonlamada siluet tek başına ayırt edilir.
 */
import type { SekilAdi } from '../palet';
import type { Ctx } from '../tuval';

type Nokta = [number, number];

/** Köşeleri `yr` yarıçapla yuvarlanmış kapalı çokgen. */
function yuvarlakCokgen(c: Ctx | Path2D, v: Nokta[], yr: number): void {
  const n = v.length;
  const ort = (a: Nokta, b: Nokta): Nokta => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const bas = ort(v[n - 1], v[0]);
  c.moveTo(bas[0], bas[1]);
  for (let i = 0; i < n; i++) {
    const a = v[i];
    const b = ort(v[i], v[(i + 1) % n]);
    c.arcTo(a[0], a[1], b[0], b[1], yr);
  }
  c.closePath();
}

/** Siluet yolunu `c` (bağlam ya da Path2D) üstüne çizer. */
export function sekilYolu(c: Ctx | Path2D, sekil: SekilAdi, r: number): void {
  // Bağlamda her zaman yeni yol (önceki alt yollar kontura karışmasın).
  if ('beginPath' in c) c.beginPath();
  switch (sekil) {
    case 'daire':
      c.moveTo(r, 0);
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.closePath();
      return;
    case 'yildiz': {
      const v: Nokta[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? 1.05 * r : 0.55 * r;
        v.push([Math.cos(a) * rr, Math.sin(a) * rr + 0.06 * r]);
      }
      yuvarlakCokgen(c, v, 0.12 * r);
      return;
    }
    case 'damla': {
      // Alt yarım daire r, tepe (0, −1,25r), Bezier kontrolü (±0,9r, −0,4r).
      // Görsel merkezleme için 0,1r aşağı kaydırıldı.
      const dy = 0.1 * r;
      c.moveTo(-r, dy);
      c.arc(0, dy, r, Math.PI, 0, true);
      c.quadraticCurveTo(0.9 * r, -0.4 * r + dy, 0, -1.25 * r + dy);
      c.quadraticCurveTo(-0.9 * r, -0.4 * r + dy, -r, dy);
      c.closePath();
      return;
    }
    case 'elmas':
      yuvarlakCokgen(
        c,
        [
          [0, -1.05 * r],
          [0.85 * r, 0],
          [0, 1.05 * r],
          [-0.85 * r, 0],
        ],
        0.1 * r,
      );
      return;
    case 'altigen': {
      const v: Nokta[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        v.push([Math.cos(a) * 1.02 * r, Math.sin(a) * 1.02 * r]);
      }
      yuvarlakCokgen(c, v, 0.08 * r);
      return;
    }
    case 'ucgen': {
      const v: Nokta[] = [];
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        v.push([Math.cos(a) * 1.15 * r, Math.sin(a) * 1.15 * r + 0.1 * r]);
      }
      yuvarlakCokgen(c, v, 0.15 * r);
      return;
    }
  }
}

/** Yansıma elipsinin siluete göre sol üst konumu (gövde içinde kalsın). */
export function yansimaKonumu(sekil: SekilAdi, r: number): Nokta {
  switch (sekil) {
    case 'ucgen':
      return [-0.2 * r, -0.12 * r];
    case 'yildiz':
      return [-0.22 * r, -0.2 * r];
    case 'elmas':
      return [-0.22 * r, -0.36 * r];
    case 'damla':
      return [-0.3 * r, -0.2 * r];
    default:
      return [-0.33 * r, -0.42 * r];
  }
}

/** Yüksek kontrast iç simgesi için ölçek (siluetin küçük beyaz kopyası). */
export const IC_SIMGE_OLCEK = 0.34;
