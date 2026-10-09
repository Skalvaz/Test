/**
 * Kokpit konsolu: motor çalıştırma paneli ve gaz kolu.
 *
 * Anahtar düzeni, modern çift motorlu jetlerin prosedürünü izler:
 * APU BLEED → MARŞ (GRD) → ATEŞLEME → N2 ≥ %20'de YAKIT KONTROL RUN.
 */

import type { EngineKind, EngineSim, SimSnapshot } from '../sim';
import { h } from './dom';

export type SwitchId = 'apuBleed' | 'starter' | 'ignition' | 'fuelRun' | 'fadec';

interface SwitchView {
  el: HTMLButtonElement;
  value: HTMLSpanElement;
  lamp: HTMLSpanElement;
}

interface Detent {
  v: number;
  label: string;
}

/** Art yakıcı bölgesinin kol üzerindeki uzunluğu (MIL = 1.0 … MAX AB = 1 + AB_RANGE) */
const AB_RANGE = 0.3;

const DETENTS: Record<EngineKind, Detent[]> = {
  turbofan: [
    { v: 0, label: 'IDLE' },
    { v: 0.82, label: 'CL' },
    { v: 1, label: 'TO' },
  ],
  militaryTurbofan: [
    { v: 0, label: 'IDLE' },
    { v: 1, label: 'MIL' },
    { v: 1 + AB_RANGE, label: 'MAX' },
  ],
  turbojet: [
    { v: 0, label: 'IDLE' },
    { v: 1, label: 'MIL' },
    { v: 1 + AB_RANGE, label: 'MAX' },
  ],
  turboprop: [
    { v: 0, label: 'G.IDLE' },
    { v: 0.75, label: 'CLB' },
    { v: 1, label: 'MAX' },
  ],
  // Gaz jeneratörü gücü: rölanti / uçuş (yer tutucu; M5a P8 kesinleştirir)
  turboshaft: [
    { v: 0, label: 'IDLE' },
    { v: 1, label: 'FLY' },
  ],
};

export interface CockpitCallbacks {
  onSwitch?: (id: SwitchId, value: boolean | string) => void;
  onThrottle?: (v: number) => void;
}

export class Cockpit {
  readonly startPanel: HTMLDivElement;
  readonly throttleEl: HTMLDivElement;
  private sw = {} as Record<SwitchId, SwitchView>;
  private manualRow: HTMLDivElement;
  private manualInput: HTMLInputElement;
  private manualReadout: HTMLSpanElement;
  private handle: HTMLDivElement;
  private track: HTMLDivElement;
  private readout: HTMLDivElement;
  private throttleLocked = false;
  private hidden = new Set<SwitchId>();
  private detents: Detent[] = DETENTS.turbofan;
  /** Kolun üst ucu: art yakıcılı motorlarda MIL'in ötesine uzanır */
  private leverMax = 1;
  private detentEls: HTMLElement[] = [];

  constructor(
    private sim: EngineSim,
    private cb: CockpitCallbacks = {},
  ) {
    /* ---------------- çalıştırma paneli ---------------- */
    const grid = h('div', { class: 'start-grid' });
    const add = (id: SwitchId, label: string, guarded = false) => {
      const value = h('span', { class: 'sw-value' });
      const lamp = h('span', { class: 'lamp' });
      const el = h(
        'button',
        {
          class: `sw${guarded ? ' guarded' : ''}`,
          attrs: { type: 'button', 'data-sw': id },
          on: { click: () => this.toggle(id) },
        },
        [h('span', { class: 'sw-label', text: label }), h('span', { class: 'sw-state' }, [value, lamp])],
      );
      grid.append(el);
      this.sw[id] = { el, value, lamp };
    };
    add('apuBleed', 'APU BLEED');
    add('starter', 'MARŞ');
    add('ignition', 'ATEŞLEME');
    add('fuelRun', 'YAKIT KONTROL', true);
    add('fadec', 'FADEC');

    this.manualInput = h('input', {
      attrs: { type: 'range', min: '0', max: '1', step: '0.005', value: '0', 'aria-label': 'Manuel yakıt' },
      on: {
        input: () => {
          this.sim.controls.manualFuel = Number(this.manualInput.value);
        },
      },
    });
    this.manualReadout = h('span', { class: 'mono', style: { fontSize: '11px', minWidth: '64px', textAlign: 'right' } });
    this.manualRow = h('div', { class: 'manual-fuel hidden' }, [
      h('span', { class: 'sw-label', text: 'YAKIT VALFİ' }),
      this.manualInput,
      this.manualReadout,
    ]);
    grid.append(this.manualRow);

    this.startPanel = h('div', { class: 'start-panel panel' }, [
      h('div', { class: 'panel-head' }, [
        h('span', { class: 'panel-title', text: 'Motor çalıştırma' }),
        h('span', { class: 'spacer' }),
        h('span', { class: 'panel-title', text: 'ENG 1' }),
      ]),
      grid,
    ]);

    /* ---------------- gaz kolu ---------------- */
    this.handle = h('div', { class: 'throttle-handle' });
    this.track = h('div', { class: 'throttle-track', attrs: { role: 'slider', tabindex: '0', 'aria-label': 'Gaz kolu' } }, [
      h('div', { class: 'throttle-slot' }),
      this.handle,
    ]);
    this.setEngineKind('turbofan');
    this.readout = h('div', { class: 'throttle-readout' });
    this.throttleEl = h('div', { class: 'throttle panel' }, [
      h('span', { class: 'panel-title', text: 'Gaz' }),
      this.track,
      this.readout,
    ]);
    this.bindThrottle();
  }

  /* ---------------------------------------------------------------- */

  private toggle(id: SwitchId) {
    const c = this.sim.controls;
    switch (id) {
      case 'apuBleed':
        c.apuBleed = !c.apuBleed;
        this.cb.onSwitch?.(id, c.apuBleed);
        break;
      case 'starter':
        c.starter = !c.starter;
        this.cb.onSwitch?.(id, c.starter);
        break;
      case 'ignition':
        c.ignition = !c.ignition;
        this.cb.onSwitch?.(id, c.ignition);
        break;
      case 'fuelRun':
        c.fuelRun = !c.fuelRun;
        this.cb.onSwitch?.(id, c.fuelRun);
        break;
      case 'fadec': {
        const next = c.fadec === 'normal' ? 'manual' : 'normal';
        if (next === 'manual') {
          // Kademesiz geçiş: valfi mevcut akışa ayarla
          const wfMax = this.sim.eng.ref.Wf * 1.15;
          c.manualFuel = Math.min(1, this.sim.wf / wfMax);
          this.manualInput.value = String(c.manualFuel);
        }
        c.fadec = next;
        this.cb.onSwitch?.(id, next);
        break;
      }
    }
  }

  /** Motor tipine göre kol kademelerini kurar (art yakıcı bölgesi dahil). */
  setEngineKind(kind: EngineKind) {
    this.detents = DETENTS[kind];
    this.leverMax = this.detents[this.detents.length - 1].v;
    for (const el of this.detentEls) el.remove();
    this.detentEls = this.detents.map((d) => {
      const t = 1 - d.v / this.leverMax;
      const el = h('div', {
        class: `throttle-detent${d.v > 1 ? ' ab' : ''}`,
        style: { top: `calc(10px + ${t * 100}% - ${t * 20}px)` },
      }, [h('span', { text: d.label })]);
      this.track.insertBefore(el, this.handle);
      return el;
    });
    this.track.classList.toggle('has-ab', this.leverMax > 1);
  }

  /** Kol konumu: 0 … 1 gaz, 1 … 1.3 art yakıcı kademesi */
  private get lever(): number {
    const c = this.sim.controls;
    return c.throttle + (this.leverMax > 1 ? c.reheat * AB_RANGE : 0);
  }

  private setThrottle(v: number, snap = true) {
    if (this.throttleLocked) return;
    let x = Math.min(this.leverMax, Math.max(0, v));
    if (snap) for (const d of this.detents) if (Math.abs(x - d.v) < 0.025 * this.leverMax) x = d.v;
    this.sim.controls.throttle = Math.min(1, x);
    this.sim.controls.reheat = x > 1.0001 ? (x - 1) / AB_RANGE : 0;
    this.cb.onThrottle?.(Math.min(1, x));
  }

  private bindThrottle() {
    let dragging = false;
    const fromEvent = (e: PointerEvent) => {
      const r = this.track.getBoundingClientRect();
      const y = e.clientY - r.top - 10;
      return (1 - y / (r.height - 20)) * this.leverMax;
    };
    this.track.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.track.setPointerCapture(e.pointerId);
      this.setThrottle(fromEvent(e));
    });
    this.track.addEventListener('pointermove', (e) => {
      if (dragging) this.setThrottle(fromEvent(e));
    });
    const end = () => {
      dragging = false;
    };
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);
    this.track.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.nudge(e.deltaY < 0 ? 0.02 : -0.02);
    }, { passive: false });
    this.track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') this.nudge(e.shiftKey ? 0.005 : 0.02);
      else if (e.key === 'ArrowDown') this.nudge(e.shiftKey ? -0.005 : -0.02);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
  }

  /**
   * Klavye kısayolları için: gaz kolunu kademeli hareket ettirir. Kademe
   * yakalama yalnızca sürüklemede uygulanır; aksi halde küçük adımlar IDLE
   * kademesine geri yapışır ve kol hiç kıpırdamaz.
   */
  nudge(delta: number) {
    this.setThrottle(this.lever + delta, false);
  }

  setThrottleTo(v: number) {
    this.setThrottle(v, false);
  }

  lockThrottle(locked: boolean) {
    this.throttleLocked = locked;
    this.throttleEl.classList.toggle('locked', locked);
  }

  setSwitchVisible(id: SwitchId, visible: boolean) {
    if (visible) this.hidden.delete(id);
    else this.hidden.add(id);
    this.sw[id].el.classList.toggle('hidden', !visible);
  }

  /** Görünür anahtar sayısı (hiç yoksa panel gizlenir). */
  get visibleSwitchCount(): number {
    return (Object.keys(this.sw) as SwitchId[]).filter((id) => !this.hidden.has(id)).length;
  }

  setSwitchEnabled(id: SwitchId, enabled: boolean) {
    this.sw[id].el.classList.toggle('disabled', !enabled);
  }

  /** Ders ipucu: ilgili anahtarı yanıp söndürür. */
  flash(ids: SwitchId[] | null) {
    for (const id of Object.keys(this.sw) as SwitchId[]) {
      this.sw[id].el.classList.toggle('flash', !!ids?.includes(id));
    }
  }

  update(s: SimSnapshot) {
    const c = s.controls;
    const set = (id: SwitchId, text: string, lamp: '' | 'on' | 'amber' | 'red') => {
      const v = this.sw[id];
      if (v.value.textContent !== text) v.value.textContent = text;
      v.lamp.className = `lamp${lamp ? ' ' + lamp : ''}`;
    };
    set('apuBleed', c.apuBleed ? 'AÇIK' : 'KAPALI', c.apuBleed ? 'on' : '');
    set('starter', c.starter ? 'GRD' : 'KAPALI', s.starterEngaged ? 'amber' : '');
    set('ignition', c.ignition ? 'AÇIK' : 'KAPALI', s.igniting ? 'on' : '');
    set('fuelRun', c.fuelRun ? 'RUN' : 'CUTOFF', c.fuelRun ? (s.lit ? 'on' : 'amber') : '');
    set('fadec', c.fadec === 'normal' ? 'NORMAL' : 'MANUEL', c.fadec === 'manual' ? 'amber' : 'on');

    const manual = c.fadec === 'manual' && !this.hidden.has('fadec');
    this.manualRow.classList.toggle('hidden', !manual);
    if (manual) this.manualReadout.textContent = `${(s.wf * 3600).toFixed(0)} kg/h`;

    const lever = this.lever;
    const t = 1 - lever / this.leverMax;
    this.handle.style.top = `calc(10px + ${t * 100}% - ${t * 20}px)`;
    this.handle.classList.toggle('ab', c.reheat > 0 && this.leverMax > 1);
    const top = this.detents[this.detents.length - 1];
    let label: string;
    if (c.reheat > 0 && this.leverMax > 1) label = `AB ${Math.max(1, Math.ceil(c.reheat * 5))}`;
    else if (c.throttle <= 0.001) label = this.detents[0].label;
    else if (c.throttle >= 0.999) label = this.leverMax > 1 ? 'MIL' : top.label;
    else label = `${Math.round(c.throttle * 100)}%`;
    if (this.readout.textContent !== label) this.readout.textContent = label;
  }
}
