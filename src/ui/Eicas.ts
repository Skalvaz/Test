/**
 * EICAS (Engine Indicating and Crew Alerting System) ekranı.
 *
 * Canvas üzerine çizilir. Kadranlar geniş gövdeli uçaklardaki düzeni izler:
 * gri doluluk sektörü, beyaz ibre ve sayısal kutu; amber bant ve kırmızı
 * çizgi limitler; magenta imleç FADEC'in komut ettiği N1 hedefi. Sağda
 * ikincil göstergeler ve CAS (ekip uyarı) mesaj listesi yer alır.
 */

import type { EngineTraits } from '../design/traits';
import type { SimSnapshot } from '../sim';

/**
 * Motorun gösterge düzeni (türetilmiş tipten). Gaz jeneratörlü motorlarda
 * (turboprop, turboşaft) ilk kadran tork, EGT yerine ITT (T45), N2 yerine
 * NG; güç türbini devri NP ve mil gücü SHP satırlarda. Turboşaftta itki
 * satırı yok (jet artığı ihmal edilir).
 */
export interface EicasLayout {
  primary: 'n1' | 'torque';
  n1Label: string;
  egtLabel: string;
  n2Label: string;
  rows: { np: boolean; shp: boolean; ab: boolean; noz: boolean; thrust: boolean };
}

type EicasTraits = Pick<EngineTraits, 'lpLoad' | 'output' | 'bypass' | 'afterburner' | 'variableNozzle'>;

export function eicasLayout(t: EicasTraits): EicasLayout {
  const gasGen = t.lpLoad === 'propeller' || t.lpLoad === 'shaft';
  return {
    primary: gasGen ? 'torque' : 'n1',
    // Turbojette LP mili fan değil alçak basınç kompresörünü çevirir
    n1Label: t.lpLoad === 'lpc' ? 'N1 LP' : 'N1',
    // Art yakıcılı turbofanda sıcaklık fan türbini girişinden (FTIT) okunur
    egtLabel: gasGen ? 'ITT' : t.bypass && t.afterburner ? 'FTIT' : 'EGT',
    n2Label: gasGen ? 'NG' : 'N2',
    rows: { np: gasGen, shp: gasGen, ab: t.afterburner, noz: t.variableNozzle, thrust: t.output !== 'shaft' },
  };
}

/** Bağlanmadan önce (ve eski kancalar için) yolcu turbofanı düzeni */
const DEFAULT_LAYOUT = eicasLayout({ lpLoad: 'fan', output: 'thrust', bypass: true, afterburner: false, variableNozzle: false });

const C = {
  white: '#eef2f6',
  dim: 'rgba(238,242,246,0.28)',
  fill: 'rgba(238,242,246,0.13)',
  amber: '#ffb020',
  red: '#ff4d3d',
  magenta: '#ff5cf0',
  cyan: '#2ee6d6',
  green: '#3ddc84',
  label: '#8a99a8',
};

interface DialSpec {
  value: number;
  min: number;
  max: number;
  amber?: number;
  red?: number;
  startLimit?: number | null;
  target?: number | null;
  label: string;
  text: string;
  unit?: string;
  ticks: number[];
}

type CasLevel = 'warning' | 'caution' | 'advisory' | 'memo';

export class Eicas {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private blink = 0;
  private layout: EicasLayout = DEFAULT_LAYOUT;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'eicas panel';
    this.canvas = document.createElement('canvas');
    this.el.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(this.el);
  }

  /** Gösterge düzenini motorun türetilmiş tipine göre kurar */
  setEngine(traits: EngineTraits) {
    this.layout = eicasLayout(traits);
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, this.el.clientWidth);
    this.h = Math.max(1, this.el.clientHeight);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  draw(s: SimSnapshot, dt: number) {
    if (this.el.clientWidth !== Math.round(this.w) || this.el.clientHeight !== Math.round(this.h)) {
      this.resize();
    }
    this.blink = (this.blink + dt) % 1;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const cas = this.casMessages(s);
    const casW = Math.min(250, Math.max(170, this.w * 0.24));
    const secW = Math.min(170, Math.max(120, this.w * 0.15));
    const dialArea = this.w - casW - secW - 24;
    const r = Math.max(34, Math.min(this.h * 0.36, dialArea / 6.6));
    const cy = this.h * 0.47;
    const gap = dialArea / 3;
    const x0 = 12 + gap / 2;

    const starting = s.phase === 'motoring' || s.phase === 'lightoff' || s.phase === 'accelerating';

    const L = s.limits;
    const egtMax = Math.ceil((L.egtRedline + 90) / 200) * 200;
    const egtTicks = Array.from({ length: egtMax / 200 + 1 }, (_, i) => i * 200);
    const lay = this.layout;

    if (lay.primary === 'torque') {
      // Turboprop/turboşaft: tork (pervaneye/çıkış miline giden güç), ITT ve
      // gaz jeneratörü devri NG
      this.dial(x0, cy, r, {
        value: s.torque * 100,
        min: 0,
        max: 120,
        amber: 100,
        red: 106,
        target: null,
        label: 'TRQ',
        text: (s.torque * 100).toFixed(0),
        unit: '%',
        ticks: [0, 20, 40, 60, 80, 100, 120],
      });
    } else {
      this.dial(x0, cy, r, {
        value: s.N1 * 100,
        min: 0,
        max: 110,
        red: L.n1Redline * 100,
        target: s.n1Command !== null ? s.n1Command * 100 : null,
        label: lay.n1Label,
        text: (s.N1 * 100).toFixed(1),
        unit: '%',
        ticks: [0, 20, 40, 60, 80, 100],
      });
    }
    this.dial(x0 + gap, cy, r, {
      value: s.egt,
      min: 0,
      max: egtMax,
      amber: L.egtAmber,
      red: L.egtRedline,
      startLimit: starting ? L.egtStart : null,
      label: lay.egtLabel,
      text: Math.round(s.egt).toString(),
      unit: '°C',
      ticks: egtTicks,
    });
    this.dial(x0 + 2 * gap, cy, r * 0.84, {
      value: s.N2 * 100,
      min: 0,
      max: 110,
      red: L.n2Redline * 100,
      target: s.n2Command !== null ? s.n2Command * 100 : null,
      label: lay.n2Label,
      text: (s.N2 * 100).toFixed(1),
      unit: '%',
      ticks: [0, 20, 40, 60, 80, 100],
    });

    this.secondary(12 + dialArea + 4, 16, secW, s);
    this.casList(this.w - casW - 10, 14, casW, cas);
  }

  /* ---------------------------------------------------------------- */

  private ang(v: number, min: number, max: number) {
    const start = Math.PI * 0.78;
    const sweep = Math.PI * 1.2;
    const t = Math.min(1.06, Math.max(0, (v - min) / (max - min)));
    return start + sweep * t;
  }

  private dial(cx: number, cy: number, r: number, d: DialSpec) {
    const ctx = this.ctx;
    const a0 = this.ang(d.min, d.min, d.max);
    const a1 = this.ang(d.max, d.min, d.max);
    const av = this.ang(d.value, d.min, d.max);

    const over = d.red !== undefined && d.value >= d.red;
    const caution = !over && d.amber !== undefined && d.value >= d.amber;
    const blinkOn = this.blink < 0.6;
    const state = over ? C.red : caution ? C.amber : C.white;

    // Doluluk sektörü
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r - 2, a0, av);
    ctx.closePath();
    ctx.fillStyle = over ? 'rgba(255,77,61,0.22)' : caution ? 'rgba(255,176,32,0.18)' : C.fill;
    ctx.fill();

    // Ana yay
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.white;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, d.red !== undefined ? this.ang(d.amber ?? d.red, d.min, d.max) : a1);
    ctx.stroke();

    // Amber bant
    if (d.amber !== undefined && d.red !== undefined) {
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, this.ang(d.amber, d.min, d.max), this.ang(d.red, d.min, d.max));
      ctx.stroke();
    }

    // Çentikler
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.white;
    ctx.fillStyle = C.label;
    ctx.font = `${Math.round(r * 0.14)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of d.ticks) {
      const a = this.ang(t, d.min, d.max);
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx + c * r, cy + s * r);
      ctx.lineTo(cx + c * (r - r * 0.1), cy + s * (r - r * 0.1));
      ctx.stroke();
      if (r > 50) {
        const lr = r - r * 0.24;
        ctx.fillText(String(d.max > 200 ? t / 100 : t / 10), cx + c * lr, cy + s * lr);
      }
    }

    // Kırmızı çizgi
    if (d.red !== undefined) this.radial(cx, cy, r, this.ang(d.red, d.min, d.max), C.red, 3, 1.18);
    // Çalıştırma limiti (yalnızca çalıştırma sırasında)
    if (d.startLimit) this.radial(cx, cy, r, this.ang(d.startLimit, d.min, d.max), C.red, 2, 1.12, true);
    // FADEC hedefi (magenta)
    if (d.target !== null && d.target !== undefined) {
      this.radial(cx, cy, r, this.ang(d.target, d.min, d.max), C.magenta, 3, 1.16);
    }

    // İbre
    ctx.strokeStyle = state;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(av) * (r - 3), cy + Math.sin(av) * (r - 3));
    ctx.stroke();
    ctx.fillStyle = state;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Sayısal kutu: yayın hiç geçmediği sağ-alt çeyrekte
    const bw = r * 1.02;
    const bh = r * 0.36;
    const bx = cx + r * 0.02;
    const by = cy + r * 0.1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = state;
    if (over && !blinkOn) ctx.strokeStyle = 'transparent';
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = over ? 'rgba(255,77,61,0.18)' : 'rgba(0,0,0,0.35)';
    ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
    ctx.fillStyle = state;
    ctx.font = `600 ${Math.round(bh * 0.72)}px ui-monospace, 'SF Mono', Consolas, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.text, bx + bw - 6, by + bh / 2 + 1);

    // Etiket kutunun solunda
    ctx.fillStyle = C.cyan;
    ctx.font = `600 ${Math.round(r * 0.2)}px ui-monospace, monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(d.label, cx - r * 0.1, by + bh * 0.42);
    if (d.unit) {
      ctx.fillStyle = C.label;
      ctx.font = `${Math.round(r * 0.14)}px ui-monospace, monospace`;
      ctx.fillText(d.unit, cx - r * 0.1, by + bh * 0.42 + r * 0.2);
    }
  }

  private radial(
    cx: number,
    cy: number,
    r: number,
    a: number,
    color: string,
    width: number,
    outer: number,
    dashed = false,
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
    ctx.lineTo(cx + Math.cos(a) * r * outer, cy + Math.sin(a) * r * outer);
    ctx.stroke();
    ctx.restore();
  }

  private secondary(x: number, y: number, w: number, s: SimSnapshot) {
    const ctx = this.ctx;
    const rows: [string, string, string, string][] = [];
    const show = this.layout.rows;
    // Güç türbini devri (pervane ya da çıkış mili): vali %100'de tutar
    if (show.np) rows.push(['NP', s.propRpm.toFixed(0), 'rpm', s.lit && s.N1 < 0.95 && s.controls.throttle > 0.3 ? C.amber : C.white]);
    if (show.shp) rows.push(['SHP', (s.shaftPower / 1000).toFixed(0), 'kW', C.white]);
    if (show.ab) {
      const zone = s.abLit ? `Z${Math.max(1, Math.ceil(s.controls.reheat * 5))}` : '—';
      rows.push(['AB', zone, s.abLit ? `${Math.round(s.abLevel * 100)}%` : '', s.abLit ? C.amber : C.white]);
    }
    if (show.noz) rows.push(['NOZ', (s.nozzleArea * 100 - 100).toFixed(0), '%aç', C.white]);
    rows.push(['FF', (s.wf * 3600).toFixed(0), 'kg/h', C.white]);
    if (show.thrust) rows.push(['İTKİ', (s.thrust / 1000).toFixed(1), 'kN', C.white]);
    rows.push(
      ['YAĞ P', s.N2 > 0.05 ? s.oilPressure.toFixed(0) : '0', 'psi', s.N2 > 0.5 && s.oilPressure < 25 ? C.amber : C.white],
      ['TİTR', s.vibration.toFixed(1), 'N1', s.vibration > 2.5 ? C.amber : C.white],
      ['SM', (s.cycle.surgeMargin * 100).toFixed(0), '%', s.N2 > 0.45 && s.cycle.surgeMargin < 0.08 ? C.amber : C.white],
    );
    const lh = Math.min(30, (this.h - 30) / rows.length);
    ctx.textBaseline = 'middle';
    rows.forEach(([label, value, unit, color], i) => {
      const yy = y + i * lh + lh / 2;
      ctx.fillStyle = C.cyan;
      ctx.font = `600 11px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(label, x, yy);
      ctx.fillStyle = color;
      ctx.font = `600 ${Math.min(17, lh * 0.62)}px ui-monospace, 'SF Mono', Consolas, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(value, x + w - 34, yy);
      ctx.fillStyle = C.label;
      ctx.font = `10px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(unit, x + w - 30, yy);
    });
    ctx.strokeStyle = 'rgba(160,185,210,0.14)';
    ctx.beginPath();
    ctx.moveTo(x - 10, 12);
    ctx.lineTo(x - 10, this.h - 12);
    ctx.stroke();
  }

  private casMessages(s: SimSnapshot): { text: string; level: CasLevel }[] {
    const m: { text: string; level: CasLevel }[] = [];
    if (s.surging) m.push({ text: 'ENG SURGE', level: 'warning' });
    if (s.egt > s.limits.egtRedline) m.push({ text: 'ENG EGT LİMİT', level: 'warning' });
    if (s.flamedOut) m.push({ text: 'ENG ALEV SÖNDÜ', level: 'warning' });
    if (s.turbineDamaged) m.push({ text: 'ENG TÜRBİN HASARI', level: 'warning' });
    if (s.abLit) m.push({ text: 'ART YAKICI', level: 'advisory' });
    if (s.controls.fadec === 'manual') m.push({ text: 'FADEC MANUEL', level: 'caution' });
    if (s.egtLimited) m.push({ text: 'ENG EGT SINIRLAMA', level: 'caution' });
    if (s.vibration > 2.5) m.push({ text: 'ENG TİTREŞİM', level: 'caution' });
    if (s.controls.starter && !s.controls.apuBleed) m.push({ text: 'MARŞ HAVASI YOK', level: 'caution' });
    if (s.fuelPuddle > 0.45 && !s.lit) m.push({ text: 'YANMAMIŞ YAKIT', level: 'caution' });
    if (s.starterEngaged) m.push({ text: 'MARŞ VALFİ AÇIK', level: 'advisory' });
    if (s.igniting) m.push({ text: 'ATEŞLEME', level: 'memo' });
    if (s.controls.apuBleed) m.push({ text: 'APU BLEED', level: 'memo' });
    if (!s.controls.fuelRun && s.N2 < 0.05) m.push({ text: 'MOTOR DURUK', level: 'memo' });
    return m;
  }

  private casList(x: number, y: number, w: number, msgs: { text: string; level: CasLevel }[]) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(160,185,210,0.14)';
    ctx.beginPath();
    ctx.moveTo(x - 10, 12);
    ctx.lineTo(x - 10, this.h - 12);
    ctx.stroke();
    ctx.fillStyle = C.label;
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CAS MESAJLARI', x, y);
    const colors: Record<CasLevel, string> = {
      warning: C.red,
      caution: C.amber,
      advisory: C.cyan,
      memo: C.white,
    };
    const lh = 19;
    msgs.slice(0, Math.floor((this.h - y - 24) / lh)).forEach((m, i) => {
      const yy = y + 18 + i * lh;
      const flashing = m.level === 'warning' && this.blink > 0.55;
      if (m.level === 'warning' && !flashing) {
        ctx.fillStyle = 'rgba(255,77,61,0.18)';
        ctx.fillRect(x - 4, yy - 2, w - 6, lh - 2);
      }
      ctx.fillStyle = colors[m.level];
      ctx.font = `600 ${m.level === 'memo' ? 12 : 13}px ui-monospace, 'SF Mono', Consolas, monospace`;
      ctx.fillText(m.text, x, yy);
    });
  }
}
