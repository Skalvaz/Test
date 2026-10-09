/**
 * Atölye düğme alanı (M5a §6.5): etiket + düzenlenebilir sayı + kaydırıcı,
 * yasak bölge (taralı kırmızı), değişim çipi, kesikli olay etiketi ve
 * "↺" (aile tabanına dön). `.field` kalıbı (FlightControls.ts).
 *
 * DOM sözleşmesi (selectors.ts): alan `data-knob="<KnobId>"`; ilk `input`
 * sayı kutusudur (oynanış testi `[data-knob=…] input`'a gösterim biriminde
 * değer yazar, `input` + `change` olayı gönderir). Uzman düğmesi
 * `data-expert` taşır.
 *
 * Olaylar: `input` → mağazaya 'input' aşaması (sayılar + hayalet + taslak
 * 3B kısmayla); `change` → 'change' (tam ayrıntı). Sayı ve kaydırıcı aynı
 * yolu kullanır.
 */

import type { EngineKnob, KnobId } from '../../design/knobs';
import { diffSummary, fmtNum, fmtSigned, type DesignSummary, type SummaryDelta } from '../../design/summary';
import type { KnobValue } from '../../design/core/knob';
import type { WorkshopStore, WorkshopState } from '../../workshop/store';
import { h } from '../../ui/dom';
import { ATTR } from './selectors';

/* ------------------------------------------------------------------ */
/* Genel sayı alanı (sihirbazın hedef itkisi de kullanır)              */
/* ------------------------------------------------------------------ */

export interface NumberFieldOptions {
  id: string;
  label: string;
  /** Gösterim birimi */
  unit: string;
  /** Gösterim biriminde aralık */
  min: number;
  max: number;
  step: number;
  digits: number;
  log?: boolean;
  explain?: string;
  onInput(v: number): void;
  onChange(v: number): void;
}

const SLIDER_STEPS = 1000;

/** Etiket, sayı kutusu, kaydırıcı ve alt satırlar; değerler gösterim biriminde */
export class NumberField {
  readonly el: HTMLDivElement;
  readonly num: HTMLInputElement;
  readonly slider: HTMLInputElement;
  readonly labelEl: HTMLSpanElement;
  readonly chip: HTMLDivElement;
  readonly event: HTMLDivElement;
  readonly tools: HTMLSpanElement;
  private rail: HTMLDivElement;
  min: number;
  max: number;
  private flashTimer = 0;

  constructor(readonly o: NumberFieldOptions) {
    this.min = o.min;
    this.max = o.max;
    this.labelEl = h('span', { class: 'ws-knob-label', text: o.label, title: o.explain ?? '' });
    this.num = h('input', {
      class: 'ws-num mono',
      attrs: { type: 'number', step: 'any', inputmode: 'decimal', 'aria-label': o.label },
    });
    this.slider = h('input', {
      class: 'ws-slider',
      attrs: { type: 'range', min: '0', max: String(SLIDER_STEPS), step: '1', 'aria-label': `${o.label} kaydırıcı`, tabindex: '-1' },
    });
    this.rail = h('div', { class: 'ws-rail' }, [this.slider]);
    this.tools = h('span', { class: 'ws-knob-tools' });
    this.chip = h('div', { class: 'ws-chip hidden' });
    this.event = h('div', { class: 'ws-event hidden' });
    this.el = h('div', { class: 'field ws-knob', attrs: { [ATTR.knob]: o.id } }, [
      h('div', { class: 'field-row ws-knob-row' }, [
        this.labelEl,
        h('span', { class: 'ws-knob-value' }, [this.num, h('span', { class: 'ws-unit', text: o.unit }), this.tools]),
      ]),
      this.rail,
      this.chip,
      this.event,
    ]);

    // Sayı kutusu: yazarken (input) taslak, Enter/odak kaybı (change) tam
    this.num.addEventListener('input', () => {
      const v = Number(this.num.value.replace(',', '.'));
      if (Number.isFinite(v) && this.num.value !== '') o.onInput(this.clampShow(v));
    });
    this.num.addEventListener('change', () => {
      const v = Number(this.num.value.replace(',', '.'));
      if (Number.isFinite(v) && this.num.value !== '') o.onChange(this.clampShow(v));
    });
    this.slider.addEventListener('input', () => o.onInput(this.fromPos(Number(this.slider.value))));
    this.slider.addEventListener('change', () => o.onChange(this.fromPos(Number(this.slider.value))));
  }

  /** Aralık dışını sınıra yapıştırır, rayı kısa süre kırmızı yakar */
  private clampShow(v: number): number {
    if (v < this.min || v > this.max) {
      this.flash();
      return Math.min(this.max, Math.max(this.min, v));
    }
    return v;
  }

  flash(): void {
    this.rail.classList.remove('is-flash');
    void this.rail.offsetWidth;
    this.rail.classList.add('is-flash');
    clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => this.rail.classList.remove('is-flash'), 600);
  }

  private toPos(v: number): number {
    const { min, max } = this;
    if (max <= min) return 0;
    const t = this.o.log && min > 0 ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
    return Math.round(Math.min(1, Math.max(0, t)) * SLIDER_STEPS);
  }

  private fromPos(p: number): number {
    const { min, max } = this;
    const t = p / SLIDER_STEPS;
    let v = this.o.log && min > 0 ? min * Math.pow(max / min, t) : min + t * (max - min);
    const s = this.o.step;
    if (s > 0) v = Math.round(v / s) * s;
    return Math.min(max, Math.max(min, Number(v.toPrecision(10))));
  }

  /** Değeri gösterir (odakta yazılan sayıya dokunmaz) */
  setValue(v: number): void {
    if (!Number.isFinite(v)) return;
    if (document.activeElement !== this.num) this.num.value = v.toFixed(this.o.digits);
    if (document.activeElement !== this.slider) this.slider.value = String(this.toPos(v));
  }

  setRange(min: number, max: number): void {
    this.min = min;
    this.max = max;
  }

  /** Yasak bölgeler (gösterim biriminde çözülebilir aralık); ray arka planı */
  setFeasible(lo: number | null, hi: number | null): void {
    const a = lo === null ? 0 : this.toPos(lo) / SLIDER_STEPS;
    const b = hi === null ? 1 : this.toPos(hi) / SLIDER_STEPS;
    this.rail.style.setProperty('--ok-lo', `${(a * 100).toFixed(2)}%`);
    this.rail.style.setProperty('--ok-hi', `${(b * 100).toFixed(2)}%`);
    this.rail.classList.toggle('has-bad', a > 0.001 || b < 0.999);
  }
}

/* ------------------------------------------------------------------ */
/* Değişim çipi                                                        */
/* ------------------------------------------------------------------ */

/** Çipte gösterilecek en önemli değişimler (sıra: itki/güç, TSFC/SFC, kütle, sonra diğerleri) */
const CHIP_ORDER = ['thrust', 'shaftPower', 'thrustWet', 'tsfc', 'sfc', 'mass', 'diameter', 'length', 'opr', 't4'];

export function chipDeltas(d: SummaryDelta[], max = 3): SummaryDelta[] {
  const rank = (k: string) => {
    const i = CHIP_ORDER.indexOf(k);
    return i < 0 ? 99 : i;
  };
  return d
    .filter((x) => Number.isFinite(x.abs) && Math.abs(x.rel) > 5e-4)
    .sort((a, b) => rank(String(a.key)) - rank(String(b.key)))
    .slice(0, max);
}

/** Çip öğeleri: renk iyileşme (yeşil) / kötüleşme (kırmızı) / nötr (gri) */
export function renderChip(el: HTMLElement, deltas: SummaryDelta[]): void {
  const parts: Node[] = [];
  deltas.forEach((d, i) => {
    if (i) parts.push(document.createTextNode(' · '));
    parts.push(h('span', { class: d.better === true ? 'up' : d.better === false ? 'down' : 'neutral', text: d.text }));
  });
  el.replaceChildren(...parts);
  el.classList.toggle('hidden', parts.length === 0);
}

/** Kademe sayısı değişimleri ("HPC 9 → 10 kademe") */
const ROW_LABEL: Record<string, string> = { front: 'Ön kompresör', booster: 'Booster', hpc: 'HPC', hpt: 'HPT', lpt: 'LPT' };
export function stageEvents(a: DesignSummary, b: DesignSummary): string[] {
  const out: string[] = [];
  for (const key of Object.keys(ROW_LABEL) as (keyof DesignSummary['rows'])[]) {
    const x = a.rows[key]?.stages;
    const y = b.rows[key]?.stages;
    if (x !== undefined && y !== undefined && x !== y) out.push(`${ROW_LABEL[key]} ${x} → ${y} kademe`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Mağazaya bağlı düğme alanı                                          */
/* ------------------------------------------------------------------ */

export interface KnobFieldHost {
  store: WorkshopStore;
  /** Kaydırıcı sürüklemesinin başı/sonu (hayalet meridyen) */
  onDrag?(active: boolean): void;
}

const disp = (k: EngineKnob) => k.display ?? { unit: k.unit === 'adet' ? '' : k.unit, factor: 1, digits: digitsFor(k), offset: 0 };
function digitsFor(k: EngineKnob): number {
  if (k.type === 'int') return 0;
  const s = k.step;
  if (s >= 1) return 0;
  return Math.min(4, Math.max(1, Math.ceil(-Math.log10(s) - 1e-9)));
}

export class KnobField {
  readonly el: HTMLDivElement;
  private field: NumberField | null = null;
  private select: HTMLSelectElement | null = null;
  private dot: HTMLSpanElement;
  private reset: HTMLButtonElement;
  private feasibleKey = '';
  private dragging = false;
  private tipShown = false;

  constructor(
    readonly knob: EngineKnob,
    private host: KnobFieldHost,
  ) {
    const k = knob;
    const d = disp(k);
    const store = host.store;
    this.dot = h('span', { class: 'ws-dot hidden', title: 'Aile tabanından farklı' });
    this.reset = h('button', {
      class: 'ws-reset hidden',
      text: '↺',
      title: 'Aile tabanındaki değere dön',
      attrs: { type: 'button', 'aria-label': `${k.label}: tabana dön` },
      on: {
        click: () => {
          const base = this.baseValue();
          if (base !== undefined) store.setKnob(k.id as KnobId, base, 'change');
        },
      },
    });
    if (k.type === 'enum' || k.type === 'bool') {
      const opts = k.type === 'bool' ? ['true', 'false'] : [...(k.options ?? [])];
      const label = (o: string) => (o === 'true' ? 'Var' : o === 'false' ? 'Yok' : o);
      this.select = h('select', {
        class: 'btn small ws-select',
        attrs: { 'aria-label': k.label },
        on: {
          change: () => store.setKnob(k.id as KnobId, k.type === 'bool' ? this.select!.value === 'true' : this.select!.value, 'change'),
        },
      }, opts.map((o) => h('option', { text: label(o), attrs: { value: o } })));
      this.el = h('div', { class: 'field ws-knob', attrs: { [ATTR.knob]: k.id } }, [
        h('div', { class: 'field-row ws-knob-row' }, [
          h('span', { class: 'ws-knob-label', text: k.label, title: k.explain }),
          h('span', { class: 'ws-knob-value' }, [this.select, this.dot, this.reset]),
        ]),
      ]);
    } else {
      const toShow = (v: number) => v * d.factor + (d.offset ?? 0);
      const fromShow = (v: number) => (v - (d.offset ?? 0)) / d.factor;
      const send = (v: number, phase: 'input' | 'change') => {
        const model = fromShow(v);
        if (phase === 'input' && !this.dragging) {
          this.dragging = true;
          host.onDrag?.(true);
        }
        store.setKnob(k.id as KnobId, k.type === 'int' ? Math.round(model) : model, phase);
        if (phase === 'change') {
          this.dragging = false;
          host.onDrag?.(false);
          this.feasibleKey = '';
        }
      };
      this.field = new NumberField({
        id: k.id,
        label: k.label,
        unit: d.unit,
        min: 0,
        max: 1,
        step: k.step * d.factor,
        digits: d.digits,
        log: k.scale === 'log',
        explain: k.explain,
        onInput: (v) => send(this.clampFeasible(v, toShow), 'input'),
        onChange: (v) => send(this.clampFeasible(v, toShow), 'change'),
      });
      this.field.tools.append(this.dot, this.reset);
      this.el = this.field.el;
      // Duyarlılık ipucu: etiket üzerine gelince (+1 adımın etkisi)
      this.field.labelEl.addEventListener('mouseenter', () => {
        if (this.tipShown) return;
        this.tipShown = true;
        const s = store.sensitivity(k.id as KnobId);
        const top = chipDeltas(s, 4).map((x) => x.text).join(' · ');
        this.field!.labelEl.title = `${k.explain}${top ? `\n+1 adım: ${top}` : ''}`;
      });
    }
    if (k.level === 'expert') this.el.setAttribute(ATTR.expert, '');
  }

  private feasible: { lo: number; hi: number; loWhy?: string; hiWhy?: string } | null = null;

  /** Değer yasak bölgeye geçmez: sınıra yapışır, ray kırmızı yanıp söner */
  private clampFeasible(v: number, toShow: (x: number) => number): number {
    const f = this.feasible;
    if (!f || !this.field) return v;
    const lo = toShow(Math.min(f.lo, f.hi));
    const hi = toShow(Math.max(f.lo, f.hi));
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    if (v < a - 1e-9 || v > b + 1e-9) {
      this.field.flash();
      const why = v < a ? f.loWhy : f.hiWhy;
      if (why) this.field.el.title = why;
      return Math.min(b, Math.max(a, v));
    }
    return v;
  }

  private baseValue(): KnobValue | undefined {
    const fam = this.host.store.activeFamily();
    return fam ? this.knob.get(fam.base) : undefined;
  }

  /** Bu bağlamda düğme var mı (aralık null değilse) */
  available(): boolean {
    try {
      return this.knob.range(this.host.store.ctx()) !== null;
    } catch {
      return false;
    }
  }

  /** Durumdan yeniden çizer (0,2 s'de bir ve mağaza değişince) */
  update(s: Readonly<WorkshopState>): void {
    const k = this.knob;
    const store = this.host.store;
    let v: KnobValue | undefined;
    try {
      v = k.get(s.graph);
    } catch {
      v = undefined;
    }
    const base = this.baseValue();
    const changed = v !== undefined && base !== undefined && !same(v, base);
    this.dot.classList.toggle('hidden', !changed);
    this.reset.classList.toggle('hidden', !changed);
    const errKnobs = s.error?.knobs ?? [];
    this.el.classList.toggle('is-error', errKnobs.includes(k.id));
    if (this.select) {
      if (v !== undefined && document.activeElement !== this.select) this.select.value = String(v);
      return;
    }
    const f = this.field!;
    const d = disp(k);
    const toShow = (x: number) => x * d.factor + (d.offset ?? 0);
    let r: [number, number] | null = null;
    try {
      r = k.range(store.ctx());
    } catch {
      r = null;
    }
    if (r) {
      const a = toShow(r[0]);
      const b = toShow(r[1]);
      f.setRange(Math.min(a, b), Math.max(a, b));
    }
    if (typeof v === 'number') f.setValue(toShow(v));
    // Değişim çipi: sürükleme/son hareket başına göre (kıyas noktası)
    const active = s.dragging === k.id || this.dragging;
    if (active && s.last && s.compare) {
      const deltas = chipDeltas(diffSummary(s.compare, s.last.summary));
      renderChip(f.chip, deltas);
      const ev = stageEvents(s.compare, s.last.summary);
      f.event.textContent = ev.join(' · ');
      f.event.classList.toggle('hidden', ev.length === 0);
    } else if (!active) {
      f.chip.classList.add('hidden');
      f.event.classList.add('hidden');
    }
  }

  /** Yasak bölge: bırakınca ve boşta hesaplanır (pahalı; rev başına bir kez) */
  updateFeasible(rev: string): void {
    if (!this.field || this.feasibleKey === rev || this.dragging) return;
    this.feasibleKey = rev;
    const r = this.host.store.feasible(this.knob.id as KnobId);
    const d = disp(this.knob);
    const toShow = (x: number) => x * d.factor + (d.offset ?? 0);
    if (!r || !Number.isFinite(r.lo) || !Number.isFinite(r.hi)) {
      this.feasible = null;
      this.field.setFeasible(null, null);
      return;
    }
    this.feasible = { lo: r.lo, hi: r.hi, loWhy: r.loReason?.text, hiWhy: r.hiReason?.text };
    const a = toShow(r.lo);
    const b = toShow(r.hi);
    this.field.setFeasible(Math.min(a, b), Math.max(a, b));
    const why = [r.loReason && `Alt sınır: ${r.loReason.text}`, r.hiReason && `Üst sınır: ${r.hiReason.text}`].filter(Boolean).join('\n');
    this.field.el.title = why;
  }
}

function same(a: KnobValue, b: KnobValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return a === b;
}

/** Sayıyı gösterim biçiminde yazar (alanların dışında kullanılır) */
export const fmtKnob = (k: EngineKnob, v: number): string => {
  const d = disp(k);
  return `${fmtNum(v * d.factor + (d.offset ?? 0), d.digits)}${d.unit ? ` ${d.unit}` : ''}`;
};
export { fmtSigned };
