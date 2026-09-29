/**
 * Motor içi paneli: istasyon şeması, T–s diyagramı ve çevrim göstergeleri.
 *
 * T–s diyagramı Brayton çevrimini canlı gösterir: sıkıştırma (2→3) sıcaklığı
 * yükseltir ve kayıplar nedeniyle entropiyi biraz artırır; yanma (3→4) sabit
 * basınç eğrisi boyunca ısı ekler; türbin ve lüle (4→9) genişletir.
 */

import type { PartId } from '../engine/visual';
import { AIR, GAS, type SimSnapshot, type StationId } from '../sim';
import { h } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
const K = 273.15;

/** Sıcaklıktan renge: soğuk mavi → camgöbeği → sarı → turuncu → kırmızı */
export function tempColor(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [250, [40, 90, 190]],
    [330, [40, 170, 200]],
    [500, [110, 200, 150]],
    [750, [235, 205, 70]],
    [1100, [245, 130, 40]],
    [1500, [235, 60, 40]],
    [1900, [255, 220, 200]],
  ];
  if (t <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / (t1 - t0);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
      return `rgb(${c.join(',')})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}

interface Region {
  part: PartId;
  station: StationId;
  path: string;
}

// Yarım kesit şeması (viewBox 320×120; eksen altta)
const REGIONS: Region[] = [
  { part: 'fan', station: '2', path: 'M8 8 L52 8 L52 112 L8 112 Z' },
  { part: 'bypassDuct', station: '13', path: 'M52 12 L222 20 L222 44 L52 50 Z' },
  { part: 'booster', station: '25', path: 'M52 54 L88 56 L88 104 L52 104 Z' },
  { part: 'hpc', station: '3', path: 'M88 56 L150 66 L150 100 L88 104 Z' },
  { part: 'combustor', station: '4', path: 'M150 60 L182 58 L182 102 L150 100 Z' },
  { part: 'hpt', station: '45', path: 'M182 60 L200 62 L200 100 L182 102 Z' },
  { part: 'lpt', station: '5', path: 'M200 62 L244 56 L244 104 L200 100 Z' },
  { part: 'exhaust', station: '9', path: 'M244 58 L300 68 L300 96 L244 104 Z' },
];

const MARKERS: { id: StationId; x: number; y: number }[] = [
  { id: '2', x: 8, y: 118 },
  { id: '13', x: 60, y: 6 },
  { id: '19', x: 226, y: 14 },
  { id: '25', x: 88, y: 118 },
  { id: '3', x: 150, y: 118 },
  { id: '4', x: 182, y: 118 },
  { id: '45', x: 200, y: 118 },
  { id: '5', x: 244, y: 118 },
  { id: '9', x: 300, y: 118 },
];

export interface CycleDiagramCallbacks {
  onHoverPart?: (part: PartId | null) => void;
}

export class CycleDiagram {
  readonly el: HTMLDivElement;
  private regionEls = new Map<Region, SVGPathElement>();
  private markerEls = new Map<StationId, SVGGElement>();
  private hasBypass = true;
  private ts: HTMLCanvasElement;
  private tsCtx: CanvasRenderingContext2D;
  private kv: HTMLDListElement;
  private tbody: HTMLTableSectionElement;
  private acc = 1;

  constructor(cb: CycleDiagramCallbacks = {}) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 320 128');
    svg.setAttribute('class', 'stations-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Motor istasyonları ve sıcaklıklar');

    const axis = document.createElementNS(SVG_NS, 'line');
    Object.entries({ x1: '4', y1: '112', x2: '316', y2: '112', stroke: 'rgba(200,220,240,0.35)', 'stroke-dasharray': '4 3' })
      .forEach(([k, v]) => axis.setAttribute(k, v));
    svg.append(axis);

    for (const r of REGIONS) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', r.path);
      p.setAttribute('stroke', 'rgba(10,14,20,0.9)');
      p.setAttribute('stroke-width', '1.2');
      p.style.cursor = 'help';
      p.addEventListener('mouseenter', () => {
        p.setAttribute('stroke', '#2ee6d6');
        p.setAttribute('stroke-width', '2');
        cb.onHoverPart?.(r.part);
      });
      p.addEventListener('mouseleave', () => {
        p.setAttribute('stroke', 'rgba(10,14,20,0.9)');
        p.setAttribute('stroke-width', '1.2');
        cb.onHoverPart?.(null);
      });
      svg.append(p);
      this.regionEls.set(r, p);
    }
    for (const m of MARKERS) {
      const g = document.createElementNS(SVG_NS, 'g');
      const c = document.createElementNS(SVG_NS, 'circle');
      Object.entries({ cx: String(m.x), cy: String(m.y), r: '6.5', fill: '#0b1017', stroke: 'rgba(230,240,250,0.7)' })
        .forEach(([k, v]) => c.setAttribute(k, v));
      const t = document.createElementNS(SVG_NS, 'text');
      Object.entries({ x: String(m.x), y: String(m.y + 2.6), 'text-anchor': 'middle', 'font-size': '7', fill: '#e8eef4', 'font-family': 'ui-monospace, monospace' })
        .forEach(([k, v]) => t.setAttribute(k, v));
      t.textContent = m.id;
      g.append(c, t);
      svg.append(g);
      this.markerEls.set(m.id, g);
    }

    this.ts = h('canvas', { class: 'ts-canvas' });
    this.tsCtx = this.ts.getContext('2d')!;
    this.kv = h('dl', { class: 'kv' });
    this.tbody = h('tbody');
    const table = h('table', { class: 'st-table' }, [
      h('thead', {}, [
        h('tr', {}, [h('th', { text: 'İST' }), h('th', { text: 'T °C' }), h('th', { text: 'P kPa' }), h('th', { text: 'W kg/s' })]),
      ]),
      this.tbody,
    ]);

    const legend = h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--muted)', marginTop: '4px' } }, [
      h('span', { text: 'soğuk' }),
      h('span', {
        style: {
          flex: '1',
          height: '5px',
          borderRadius: '3px',
          background: `linear-gradient(to right, ${[250, 330, 500, 750, 1100, 1500, 1900].map(tempColor).join(',')})`,
        },
      }),
      h('span', { text: 'sıcak' }),
    ]);

    this.el = h('div', { class: 'side-right panel' }, [
      h('div', { class: 'panel-head' }, [h('span', { class: 'panel-title', text: 'Motorun içi' })]),
      h('div', { class: 'scroll panel-body' }, [
        h('div', { class: 'section-label', text: 'İstasyonlar (üzerine gel)' }),
        svg,
        legend,
        h('div', { class: 'section-label', text: 'T–s diyagramı (çekirdek akışı)' }),
        this.ts,
        h('div', { class: 'section-label', text: 'Çevrim' }),
        this.kv,
        h('div', { class: 'section-label', text: 'İstasyon değerleri' }),
        table,
      ]),
    ]);
  }

  update(s: SimSnapshot, dt: number, force = false) {
    this.acc += dt;
    if (this.acc < 0.1 && !force) return;
    this.acc = 0;
    const st = s.cycle.stations;
    // Baypassız motorlarda (turbojet, turboprop) 13/19 istasyonu yoktur
    const bypass = s.cycle.bypassRatio > 0.05;
    if (bypass !== this.hasBypass) {
      this.hasBypass = bypass;
      for (const [r, p] of this.regionEls) if (r.part === 'bypassDuct') p.style.display = bypass ? '' : 'none';
      for (const id of ['13', '19'] as StationId[]) {
        const g = this.markerEls.get(id);
        if (g) g.style.display = bypass ? '' : 'none';
      }
    }

    for (const [r, p] of this.regionEls) {
      const t = r.part === 'fan' && bypass ? st['13'].T : st[r.station].T;
      p.setAttribute('fill', tempColor(t));
    }

    const c = s.cycle;
    const coreShare = c.coreThrust / Math.max(1, c.coreThrust + c.bypassThrust);
    const rows: [string, string][] = [
      ['Toplam basınç oranı (OPR)', c.opr.toFixed(1)],
      ...(bypass ? ([['Baypas oranı (BPR)', c.bypassRatio.toFixed(1)]] as [string, string][]) : []),
      ['Türbin giriş sıcaklığı T4', `${(st['4'].T - K).toFixed(0)} °C`],
      ['Yakıt / hava oranı', c.far.toFixed(4)],
      ['Özgül yakıt tüketimi', s.tsfc > 0 ? `${(s.tsfc * 1e6).toFixed(2)} g/kN·s` : '—'],
      ['Surge payı (HPC)', `${(c.surgeMargin * 100).toFixed(1)} %`],
      ['HPC harita konumu β', c.beta.toFixed(2)],
    ];
    if (s.kind === 'turboprop') {
      const total = Math.max(1, s.propThrust + c.netThrust);
      rows.push(
        ['Mil gücü', `${(s.shaftPower / 1000).toFixed(0)} kW`],
        ['Pervane devri', `${s.propRpm.toFixed(0)} dev/dk`],
        ['Hatve yük katsayısı', s.propPitch.toFixed(2)],
        ['İtki: pervane / jet', `${((s.propThrust / total) * 100).toFixed(0)} / ${((Math.max(0, c.netThrust) / total) * 100).toFixed(0)} %`],
        ['Jet hızı V9', `${c.V9.toFixed(0)} m/s`],
      );
    } else if (bypass) {
      rows.push(
        ['İtki: fan / çekirdek', `${((1 - coreShare) * 100).toFixed(0)} / ${(coreShare * 100).toFixed(0)} %`],
        ['Çekirdek jet hızı V9', `${c.V9.toFixed(0)} m/s`],
        ['Fan jet hızı V19', `${c.V19.toFixed(0)} m/s`],
      );
    } else {
      rows.push(['Jet hızı V9', `${c.V9.toFixed(0)} m/s`]);
    }
    if (s.kind === 'militaryTurbofan' || s.kind === 'turbojet') {
      rows.push(
        ['Art yakıcı', s.abLit ? `yanık · ${(s.abLevel * 100).toFixed(0)} %` : 'sönük'],
        ['Lüle alanı A8', `${(s.nozzleArea * 100).toFixed(0)} %`],
        ['Karışım / art yakıcı T7', `${(st['7'].T - K).toFixed(0)} °C`],
      );
    }
    this.kv.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]));

    const ids: StationId[] = bypass
      ? ['0', '2', '13', '25', '3', '4', '45', '5', '9']
      : ['0', '2', '25', '3', '4', '45', '5', '9'];
    if (s.kind === 'militaryTurbofan' || s.kind === 'turbojet') ids.splice(ids.length - 1, 0, '7');
    this.tbody.replaceChildren(
      ...ids.map((id) =>
        h('tr', {}, [
          h('td', {}, [h('span', { class: 'st-num', text: id })]),
          h('td', { text: (st[id].T - K).toFixed(0) }),
          h('td', { text: (st[id].P / 1000).toFixed(id === '3' || id === '4' ? 0 : 1) }),
          h('td', { text: st[id].W.toFixed(1) }),
        ]),
      ),
    );

    this.drawTs(s);
  }

  private drawTs(s: SimSnapshot) {
    const cv = this.ts;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 300;
    const hgt = cv.clientHeight || 190;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hgt * dpr);
    }
    const ctx = this.tsCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);

    const st = s.cycle.stations;
    const T0 = st['0'].T;
    const P0 = st['0'].P;
    const ent = (id: StationId) => {
      const g = id === '4' || id === '45' || id === '5' || id === '9' ? GAS : AIR;
      return g.cp * Math.log(st[id].T / T0) - g.R * Math.log(st[id].P / P0);
    };
    const core: StationId[] = ['0', '2', '25', '3', '4', '45', '5', '9'];
    const byp: StationId[] = this.hasBypass ? ['2', '13', '19'] : [];
    const pts = core.map((id) => ({ id, s: ent(id), T: st[id].T }));
    const bpts = byp.map((id) => ({ id, s: ent(id), T: st[id].T }));

    const all = [...pts, ...bpts];
    const sMin = Math.min(...all.map((p) => p.s)) - 60;
    const sMax = Math.max(...all.map((p) => p.s), sMin + 400) + 80;
    const tMin = 180;
    const tMax = Math.max(900, ...all.map((p) => p.T)) * 1.08;

    const L = 34;
    const R = 8;
    const T = 8;
    const B = 22;
    const X = (sv: number) => L + ((sv - sMin) / (sMax - sMin)) * (w - L - R);
    const Y = (tv: number) => hgt - B - ((tv - tMin) / (tMax - tMin)) * (hgt - T - B);

    // Eksenler
    ctx.strokeStyle = 'rgba(160,185,210,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L, T);
    ctx.lineTo(L, hgt - B);
    ctx.lineTo(w - R, hgt - B);
    ctx.stroke();
    ctx.fillStyle = '#7b8a99';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let t = 400; t < tMax; t += 400) {
      ctx.fillText(String(t), L - 4, Y(t));
      ctx.strokeStyle = 'rgba(160,185,210,0.07)';
      ctx.beginPath();
      ctx.moveTo(L, Y(t));
      ctx.lineTo(w - R, Y(t));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillText('entropi s →', (L + w) / 2, hgt - 8);
    ctx.save();
    ctx.translate(10, (T + hgt - B) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('T (K)', 0, 0);
    ctx.restore();

    // Sabit basınç eğrileri: P0 ve P3
    const isobar = (P: number, g: typeof AIR, color: string, label: string) => {
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      let first = true;
      for (let sv = sMin; sv <= sMax; sv += (sMax - sMin) / 60) {
        const tv = T0 * Math.exp((sv + g.R * Math.log(P / P0)) / g.cp);
        if (tv < tMin || tv > tMax) continue;
        if (first) ctx.moveTo(X(sv), Y(tv));
        else ctx.lineTo(X(sv), Y(tv));
        first = false;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const sl = sMax - (sMax - sMin) * 0.08;
      const tl = T0 * Math.exp((sl + g.R * Math.log(P / P0)) / g.cp);
      if (tl > tMin && tl < tMax) {
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(label, X(sl) - 2, Y(tl) - 7);
      }
    };
    isobar(P0, AIR, 'rgba(120,170,230,0.45)', 'P0');
    if (st['3'].P > P0 * 1.5) isobar(st['3'].P, AIR, 'rgba(255,176,32,0.45)', 'P3');

    // Baypas yolu
    ctx.strokeStyle = 'rgba(80,170,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (bpts.length) bpts.forEach((p, i) => (i ? ctx.lineTo(X(p.s), Y(p.T)) : ctx.moveTo(X(p.s), Y(p.T))));
    ctx.stroke();

    // Çekirdek yolu: süreçlere göre renklendirilmiş
    const seg = (a: number, b: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(X(pts[a].s), Y(pts[a].T));
      for (let i = a + 1; i <= b; i++) ctx.lineTo(X(pts[i].s), Y(pts[i].T));
      ctx.stroke();
    };
    seg(0, 3, '#2ee6d6'); // sıkıştırma
    seg(3, 4, '#ff7a2a'); // yanma
    seg(4, 7, '#ffb020'); // genişleme

    ctx.font = '600 9.5px ui-monospace, monospace';
    for (const p of pts.slice(1)) {
      ctx.fillStyle = tempColor(p.T);
      ctx.beginPath();
      ctx.arc(X(p.s), Y(p.T), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8eef4';
      ctx.textAlign = 'left';
      ctx.fillText(p.id, X(p.s) + 5, Y(p.T) - 5);
    }
  }
}
