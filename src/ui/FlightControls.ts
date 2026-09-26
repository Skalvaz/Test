/** İrtifa / Mach / ISA sapması kaydırıcıları (test hücresi ve irtifa dersi). */

import type { EngineSim } from '../sim';
import { h } from './dom';

export class FlightControls {
  readonly el: HTMLDivElement;
  private readouts: Record<string, HTMLSpanElement> = {};
  private inputs: Record<string, HTMLInputElement> = {};

  constructor(private sim: EngineSim) {
    const field = (
      key: 'altitude' | 'mach' | 'isaDev',
      label: string,
      min: number,
      max: number,
      step: number,
    ) => {
      const out = h('span', { class: 'mono' });
      const input = h('input', {
        attrs: { type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label },
        on: {
          input: () => {
            this.sim.setFlight({ [key]: Number(input.value) });
            this.refresh();
          },
        },
      });
      this.readouts[key] = out;
      this.inputs[key] = input;
      return h('div', { class: 'field' }, [h('div', { class: 'field-row' }, [h('span', { text: label }), out]), input]);
    };
    this.el = h('div', {}, [
      field('altitude', 'İrtifa', 0, 12500, 50),
      field('mach', 'Uçuş Mach sayısı', 0, 0.85, 0.01),
      field('isaDev', 'Sıcaklık (ISA sapması)', -30, 40, 1),
    ]);
    this.refresh();
  }

  refresh() {
    const t = this.sim.flightTarget;
    const f = this.sim.flight;
    const amb = this.sim.ambientState;
    this.inputs.altitude.value = String(t.altitude);
    this.inputs.mach.value = String(t.mach);
    this.inputs.isaDev.value = String(t.isaDev);
    const arrow = (a: number, b: number) => (Math.abs(a - b) > 1e-3 ? ' →' : '');
    this.readouts.altitude.textContent = `${Math.round(f.altitude).toLocaleString('tr-TR')} m (${Math.round(f.altitude * 3.2808).toLocaleString('tr-TR')} ft)${arrow(f.altitude, t.altitude)}`;
    this.readouts.mach.textContent = `M ${f.mach.toFixed(2)} · ${Math.round(amb.V0 * 1.944)} kt${arrow(f.mach, t.mach)}`;
    this.readouts.isaDev.textContent = `ISA${t.isaDev >= 0 ? '+' : ''}${t.isaDev} · ${(amb.T0 - 273.15).toFixed(0)} °C`;
  }
}
