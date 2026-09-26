/**
 * Kokpit konsolu: motor çalıştırma paneli ve gaz kolu.
 *
 * Anahtar düzeni, modern çift motorlu jetlerin prosedürünü izler:
 * APU BLEED → MARŞ (GRD) → ATEŞLEME → N2 ≥ %20'de YAKIT KONTROL RUN.
 */

import type { EngineSim, SimSnapshot } from '../sim';
import { h } from './dom';

export type SwitchId = 'apuBleed' | 'starter' | 'ignition' | 'fuelRun' | 'fadec';

interface SwitchView {
  el: HTMLButtonElement;
  value: HTMLSpanElement;
  lamp: HTMLSpanElement;
}

const DETENTS = [
  { v: 0, label: 'IDLE' },
  { v: 0.82, label: 'CL' },
  { v: 1, label: 'TO' },
];

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
      ...DETENTS.map((d) =>
        h('div', { class: 'throttle-detent', style: { top: `calc(10px + ${(1 - d.v) * 100}% - ${(1 - d.v) * 20}px)` } }, [
          h('span', { text: d.label }),
        ]),
      ),
      this.handle,
    ]);
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

  private setThrottle(v: number, snap = true) {
    if (this.throttleLocked) return;
    let x = Math.min(1, Math.max(0, v));
    if (snap) for (const d of DETENTS) if (Math.abs(x - d.v) < 0.025) x = d.v;
    this.sim.controls.throttle = x;
    this.cb.onThrottle?.(x);
  }

  private bindThrottle() {
    let dragging = false;
    const fromEvent = (e: PointerEvent) => {
      const r = this.track.getBoundingClientRect();
      const y = e.clientY - r.top - 10;
      return 1 - y / (r.height - 20);
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
    this.setThrottle(this.sim.controls.throttle + delta, false);
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

    const pct = c.throttle;
    this.handle.style.top = `calc(10px + ${(1 - pct) * 100}% - ${(1 - pct) * 20}px)`;
    const label = pct <= 0.001 ? 'IDLE' : pct >= 0.999 ? 'TO' : `${Math.round(pct * 100)}%`;
    if (this.readout.textContent !== label) this.readout.textContent = label;
  }
}
