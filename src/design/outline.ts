/**
 * Meridyen silueti (M5a, docs/M5A-SPEC.md §6.7): üretilmiş motorun yarı
 * kesit çizgileri {z, r}. Atölyede sürüklerken "hayalet" (Ghost.ts)
 * bununla çizilir; başlangıç ekranının şablon kartları `outlineSvg` ile
 * render gerektirmeden siluet gösterir. three.js ve DOM yok (< 0,5 ms).
 */

import type { BuiltEngine } from './graph';
import type { RowGeometry } from './flowpath';

export interface OutlinePoint {
  z: number;
  r: number;
}

/** Sıranın göbek ve uç çizgileri (yarım kademe aralığı payla) */
function rowLines(row: RowGeometry): OutlinePoint[][] {
  const h = row.pitch / 2;
  const z0 = row.z0 - h;
  const z1 = row.z1 + h;
  return [
    [
      { z: z0, r: row.tip[0] },
      { z: z1, r: row.tip[1] },
    ],
    [
      { z: z0, r: row.hub[0] },
      { z: z1, r: row.hub[1] },
    ],
    // Ön ve arka kanat kenarı
    [
      { z: z0, r: row.hub[0] },
      { z: z0, r: row.tip[0] },
    ],
    [
      { z: z1, r: row.hub[1] },
      { z: z1, r: row.tip[1] },
    ],
  ];
}

/**
 * Motorun meridyen çizgileri: dış zarf, turbomakine sıraları (göbek/uç),
 * santrifüj çark, yanma odası kutusu ve pervane diski. z artan; r ≥ 0.
 */
export function meridionalOutline(b: BuiltEngine): OutlinePoint[][] {
  const out: OutlinePoint[][] = [];
  const L = b.flowpath.layout;
  out.push(L.outerProfile.map(([z, r]) => ({ z, r })));
  const g = b.flowpath.gas;
  for (const row of [g.front, g.booster, g.hpc, g.hpt, g.lpt]) if (row) out.push(...rowLines(row));
  if (g.centrifugal) {
    const c = g.centrifugal;
    out.push([
      { z: c.z - (c.r1 - c.r0) * 0.6, r: c.r0 },
      { z: c.z, r: c.r1 },
      { z: c.z, r: c.rd },
    ]);
  }
  const cb = g.combustor;
  out.push([
    { z: cb.z0, r: cb.rIn },
    { z: cb.z0, r: cb.rOut },
    { z: cb.z1, r: cb.rOut },
    { z: cb.z1, r: cb.rIn },
    { z: cb.z0, r: cb.rIn },
  ]);
  if (L.style === 'turboprop') {
    out.push([
      { z: L.prop.z, r: 0 },
      { z: L.prop.z, r: L.prop.radius },
    ]);
  }
  return out.filter((p) => p.length >= 2 && p.every((q) => Number.isFinite(q.z) && Number.isFinite(q.r)));
}

/** Siluetin sınırları */
export function outlineBounds(lines: OutlinePoint[][]): { z0: number; z1: number; r: number } {
  let z0 = Infinity;
  let z1 = -Infinity;
  let r = 0;
  for (const l of lines) {
    for (const p of l) {
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
      r = Math.max(r, p.r);
    }
  }
  return { z0, z1, r };
}

/**
 * Siluetin SVG dizgesi (iki yarı, eksen yatay, akış soldan sağa). Renk
 * `currentColor`: kart metin rengini alır. Ölçek `fit` ile verilirse
 * (metre/piksel) motorlar aynı ölçekte karşılaştırılabilir.
 */
export function outlineSvg(b: BuiltEngine, o: { width?: number; height?: number; pad?: number; scale?: number } = {}): string {
  const W = o.width ?? 240;
  const H = o.height ?? 90;
  const pad = o.pad ?? 4;
  const lines = meridionalOutline(b);
  const bb = outlineBounds(lines);
  const s = o.scale ?? Math.min((W - 2 * pad) / Math.max(bb.z1 - bb.z0, 1e-6), (H - 2 * pad) / Math.max(2 * bb.r, 1e-6));
  const x = (z: number) => (pad + (z - bb.z0) * s).toFixed(1);
  const cy = H / 2;
  const path = (l: OutlinePoint[], sign: 1 | -1) => l.map((p, i) => `${i ? 'L' : 'M'}${x(p.z)} ${(cy - sign * p.r * s).toFixed(1)}`).join('');
  const d = lines.map((l) => path(l, 1) + path(l, -1)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round">` +
    `<line x1="${pad}" y1="${cy}" x2="${W - pad}" y2="${cy}" stroke-dasharray="4 3" opacity="0.4"/>` +
    `<path d="${d}"/></svg>`
  );
}
