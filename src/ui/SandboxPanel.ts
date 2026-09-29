/** Test hücresi (serbest mod) kontrol paneli. */

import type { EngineVisual } from '../engine/visual';
import { ENGINE_CATALOG, type EngineKind, type EngineSim } from '../sim';
import { h, icon } from './dom';
import { FlightControls } from './FlightControls';

export interface SandboxCallbacks {
  autoStart(): void;
  onEngine(kind: EngineKind): void;
  onTimeScale(v: number): void;
  onExit(): void;
}

export class SandboxPanel {
  readonly el: HTMLDivElement;
  private flight: FlightControls;
  private faultBtns: Record<string, HTMLButtonElement> = {};
  private selectEngine: (kind: EngineKind) => void = () => {};

  constructor(
    private sim: EngineSim,
    visual: () => EngineVisual,
    cb: SandboxCallbacks,
  ) {
    this.flight = new FlightControls(sim);

    const quick = (label: string, fn: () => void, primary = false) =>
      h('button', { class: `btn small${primary ? ' primary' : ''}`, text: label, on: { click: fn } });

    const speeds: [number, string][] = [[0.25, '¼×'], [0.5, '½×'], [1, '1×'], [2, '2×'], [4, '4×']];
    const speedSeg = h('div', { class: 'seg' });
    for (const [v, label] of speeds) {
      const b = h('button', { text: label, class: v === 1 ? 'sel' : '' });
      b.addEventListener('click', () => {
        for (const x of speedSeg.children) x.classList.remove('sel');
        b.classList.add('sel');
        cb.onTimeScale(v);
      });
      speedSeg.append(b);
    }

    const fault = (key: string, label: string, apply: (on: boolean) => void, oneShot = false) => {
      const b = h('button', { class: 'btn small', text: label });
      b.addEventListener('click', () => {
        const on = oneShot ? true : !b.classList.contains('active');
        apply(on);
        if (!oneShot) b.classList.toggle('active', on);
        else b.classList.add('active');
      });
      this.faultBtns[key] = b;
      return b;
    };

    const toggle = (label: string, initial: boolean, fn: (v: boolean) => void) => {
      const b = h('button', { class: `btn small${initial ? ' active' : ''}`, text: label });
      b.addEventListener('click', () => {
        const on = !b.classList.contains('active');
        b.classList.toggle('active', on);
        fn(on);
      });
      return b;
    };

    // Motor seçici: dört motor tipi, seçilenin kısa açıklaması
    const LABELS: Record<EngineKind, string> = {
      turbofan: 'Yolcu turbofanı',
      militaryTurbofan: 'Askeri turbofan',
      turbojet: 'Turbojet',
      turboprop: 'Turboprop',
    };
    const summary = h('p', { class: 'step-body engine-summary' });
    const engineSeg = h('div', { class: 'engine-grid' });
    const abBtn = quick('Art yakıcı', () => {
      sim.controls.throttle = 1;
      sim.controls.reheat = sim.controls.reheat > 0 ? 0 : 1;
    });
    let shown: EngineKind | null = null;
    // Efekt tercihi motor değişince de korunur
    let effectsOn = true;
    const selectEngine = (kind: EngineKind) => {
      if (kind === shown) return;
      shown = kind;
      abBtn.classList.toggle('hidden', !ENGINE_CATALOG[kind].afterburner);
      for (const b of engineSeg.children) b.classList.toggle('sel', (b as HTMLElement).dataset.kind === kind);
      const d = ENGINE_CATALOG[kind];
      summary.innerHTML = `<b>${d.name}</b><br>${d.summary}`;
    };
    for (const kind of Object.keys(ENGINE_CATALOG) as EngineKind[]) {
      const b = h('button', { class: 'btn small', text: LABELS[kind], attrs: { 'data-kind': kind } });
      b.addEventListener('click', () => {
        cb.onEngine(kind);
        visual().effects.enabled = effectsOn;
        selectEngine(kind);
        for (const f of Object.values(this.faultBtns)) f.classList.remove('active');
      });
      engineSeg.append(b);
    }
    this.selectEngine = selectEngine;
    selectEngine(sim.kind);

    this.el = h('div', { class: 'side-left panel' }, [
      h('div', { class: 'panel-head' }, [
        h('span', { class: 'panel-title', text: 'Test hücresi' }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small ghost icon', title: 'Menüye dön', on: { click: cb.onExit } }, [icon('close', 16)]),
      ]),
      h('div', { class: 'scroll panel-body' }, [
        h('div', { class: 'section-label', text: 'Motor' }),
        engineSeg,
        summary,
        h('div', { class: 'section-label', text: 'Hızlı işlemler' }),
        h('div', { class: 'chips' }, [
          quick('Otomatik çalıştır', cb.autoStart, true),
          quick('Rölanti', () => {
            sim.controls.throttle = 0;
          }),
          quick('Tam güç', () => {
            sim.controls.throttle = 1;
            sim.controls.reheat = 0;
          }),
          abBtn,
          quick('Motoru kapat', () => {
            sim.controls.fuelRun = false;
            sim.controls.starter = false;
          }),
          quick('Yeni motor', () => {
            sim.reset();
            for (const b of Object.values(this.faultBtns)) b.classList.remove('active');
          }),
        ]),
        h('div', { class: 'section-label', text: 'Simülasyon hızı' }),
        speedSeg,
        h('div', { class: 'section-label', text: 'Uçuş koşulları' }),
        this.flight.el,
        h('div', { class: 'section-label', text: 'Arıza ve yıpranma' }),
        h('div', { class: 'chips' }, [
          fault('bird', 'Kuş çarpması', () => sim.birdStrike(), true),
          fault('hpc', 'Kompresör aşınması', (on) => {
            sim.health.hpcSurgeMargin = on ? 0.35 : 1;
            sim.health.hpcEta = on ? 0.96 : 1;
          }),
          fault('turb', 'Türbin aşınması', (on) => {
            sim.health.hptEta = on ? 0.94 : 1;
            sim.health.lptEta = on ? 0.95 : 1;
          }),
          fault('starter', 'Marş arızası', (on) => {
            sim.failures.starter = on;
          }),
          fault('igniter', 'Ateşleyici arızası', (on) => {
            sim.failures.igniter = on;
          }),
        ]),
        h('p', {
          class: 'step-body',
          style: { fontSize: '12px', marginTop: '8px' },
          html: 'Deneyler: aşınmış kompresörle gaz kolunu hızla it · ateşleyici arızasında çalıştırmayı dene · <b>FADEC → MANUEL</b> ile yakıtı elle aç · ¼× hızda çalıştırmayı izle.',
        }),
        h('div', { class: 'section-label', text: 'Görünüm' }),
        h('div', { class: 'chips' }, [
          toggle('Pilon', true, (v) => visual().setPylonVisible(v)),
          toggle('Kanat', false, (v) => visual().setWingVisible(v)),
          toggle('Egzoz akışı', true, (v) => visual().setPlumeVisible(v)),
          toggle('Efektler', true, (v) => {
            effectsOn = v;
            visual().effects.enabled = v;
          }),
          toggle('Hareket bulanıklığı', true, (v) => {
            visual().motionBlur = v;
          }),
        ]),
      ]),
    ]);
  }

  update() {
    this.flight.refresh();
    this.selectEngine(this.sim.kind);
    if (this.faultBtns.bird && this.sim.fanDamage === 0) this.faultBtns.bird.classList.remove('active');
  }
}
