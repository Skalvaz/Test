/** Test hücresi (serbest mod) kontrol paneli. */

import type { EngineVisual } from '../engine/visual';
import { ENGINE_CATALOG, type EngineKind, type EngineSim } from '../sim';
import type { SlotId } from '../design/catalog';
import { fmtNum, type DesignSummary } from '../design/summary';
import { h, icon } from './dom';
import { FlightControls } from './FlightControls';

export interface SandboxCallbacks {
  autoStart(): void;
  onEngine(slot: SlotId): void;
  onLights(level: number): void;
  onTimeScale(v: number): void;
  onExit(): void;
  /** "Atölye tasarımı" düğmesi: atölye yuvasını test hücresinde kurar (M5a P10) */
  onWorkshop?(): void;
  /** "← Atölyeye dön" */
  onBackToWorkshop?(): void;
  /** Atölye tasarımının adı (tasarım yoksa null) */
  workshopName?(): string | null;
  /** Atölyenin tasarım noktası özeti (beklenen itki/güç) */
  workshopExpected?(): DesignSummary | null;
}

export class SandboxPanel {
  readonly el: HTMLDivElement;
  private flight: FlightControls;
  private faultBtns: Record<string, HTMLButtonElement> = {};
  private selectEngine: (kind: EngineKind) => void = () => {};
  private resetShown: () => void = () => {};
  private applyView: () => void = () => {};
  private viewApplied: EngineVisual | null = null;
  private cb: SandboxCallbacks;
  private wsStrip: HTMLDivElement;
  private wsName: HTMLElement;
  private wsCompare: HTMLDivElement;
  private wsBtn: HTMLButtonElement | null = null;
  /** Simülasyonda atölye tasarımı mı (şerit görünür) */
  private wsActive = false;

  constructor(
    private sim: EngineSim,
    private visual: () => EngineVisual,
    cb: SandboxCallbacks,
  ) {
    this.flight = new FlightControls(sim);
    this.cb = cb;
    // Atölye şeridi (M5a §6.9): tasarımın adı, geri dönüş, beklenen/ölçülen
    this.wsName = h('b');
    this.wsCompare = h('div', { class: 'ws-cell-compare mono' });
    this.wsStrip = h('div', { class: 'ws-cell-strip hidden' }, [
      h('div', { class: 'ws-cell-row' }, [
        h('span', { text: 'Atölye tasarımı ' }),
        this.wsName,
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn small',
          attrs: { type: 'button', 'data-action': 'back-to-workshop' },
          on: { click: () => cb.onBackToWorkshop?.() },
        }, ['← Atölyeye dön']),
      ]),
      this.wsCompare,
    ]);

    const quick = (label: string, fn: () => void, primary = false) =>
      h('button', { class: `btn small${primary ? ' primary' : ''}`, text: label, on: { click: fn } });

    const speeds: [number, string][] = [[0.25, '¼×'], [0.5, '½×'], [1, '1×'], [2, '2×'], [4, '4×']];
    // Hücre ışıkları: gece modunda alev ve kor parçalar sahneyi aydınlatır
    const lightSeg = h('div', { class: 'seg' });
    for (const [v, label] of [[1, 'Açık'], [0.35, 'Loş'], [0, 'Gece']] as [number, string][]) {
      const b = h('button', { text: label, class: v === 1 ? 'sel' : '' });
      b.addEventListener('click', () => {
        for (const x of lightSeg.children) x.classList.remove('sel');
        b.classList.add('sel');
        cb.onLights(v);
      });
      lightSeg.append(b);
    }
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

    // Motor seçici: katalogdaki motor tipleri, seçilenin kısa açıklaması
    const LABELS: Record<EngineKind, string> = {
      turbofan: 'Yolcu turbofanı',
      militaryTurbofan: 'Askeri turbofan',
      turbojet: 'Turbojet',
      turboprop: 'Turboprop',
      turboshaft: 'Turboşaft',
    };
    const summary = h('p', { class: 'step-body engine-summary' });
    const engineSeg = h('div', { class: 'engine-grid' });
    const abBtn = quick('Art yakıcı', () => {
      sim.controls.throttle = 1;
      sim.controls.reheat = sim.controls.reheat > 0 ? 0 : 1;
    });
    let shown: EngineKind | null = null;
    // Görünüm tercihleri motor değişince yeni modele yeniden uygulanır
    const view = { pylon: true, wing: false, plume: true, effects: true, blur: true };
    const applyView = () => {
      const v = visual();
      this.viewApplied = v;
      v.setPylonVisible(view.pylon);
      v.setWingVisible(view.wing);
      v.setPlumeVisible(view.plume);
      // Efektsiz kurulan model (atölye) açılmaz
      v.effects.enabled = view.effects && v.effectsAllowed;
      v.motionBlur = view.blur;
    };
    const pylonBtn = toggle('Pilon', view.pylon, (v) => {
      view.pylon = v;
      visual().setPylonVisible(v);
    });
    const wingBtn = toggle('Kanat', view.wing, (v) => {
      view.wing = v;
      visual().setWingVisible(v);
    });
    const selectEngine = (kind: EngineKind) => {
      if (kind === shown) return;
      shown = kind;
      // Simülasyondaki tasarım (yuvanın güncel tasarımı; atölye yuvası da olabilir)
      const d = sim.eng.design;
      abBtn.classList.toggle('hidden', !d.afterburner);
      // Pilon ve kanat yalnız kaportalı yolcu turbofanında vardır
      pylonBtn.classList.toggle('hidden', kind !== 'turbofan');
      wingBtn.classList.toggle('hidden', kind !== 'turbofan');
      for (const b of engineSeg.children) b.classList.toggle('sel', (b as HTMLElement).dataset.kind === kind);
      // Ad ve açıklama oyuncudan gelebilir (atölye yuvası): HTML olarak yorumlanmaz
      summary.replaceChildren(h('b', { text: d.name }), h('br'), document.createTextNode(d.summary));
    };
    for (const kind of Object.keys(ENGINE_CATALOG) as EngineKind[]) {
      const b = h('button', { class: 'btn small', text: LABELS[kind], attrs: { 'data-kind': kind } });
      b.addEventListener('click', () => {
        // Katalog motoru seçmek atölye şeridini kapatır (source = catalog)
        this.setWorkshop(false);
        cb.onEngine(kind);
        applyView();
        selectEngine(kind);
        for (const f of Object.values(this.faultBtns)) f.classList.remove('active');
      });
      engineSeg.append(b);
    }
    // Atölye tasarımı (6. düğme): tasarım varsa görünür
    const wsBtn = h('button', { class: 'btn small hidden', text: 'Atölye tasarımı', attrs: { 'data-kind': 'workshop' } });
    wsBtn.addEventListener('click', () => {
      cb.onWorkshop?.();
      applyView();
    });
    engineSeg.append(wsBtn);
    this.wsBtn = wsBtn;
    this.selectEngine = (kind: EngineKind) => {
      const fromWs = this.wsActive;
      if (fromWs) {
        // Atölye yuvası: katalog düğmeleri seçili görünmez
        shown = null;
        selectEngine(kind);
        for (const b of engineSeg.children) b.classList.toggle('sel', (b as HTMLElement).dataset.kind === 'workshop');
        return;
      }
      selectEngine(kind);
    };
    this.resetShown = () => {
      shown = null;
    };
    this.applyView = applyView;
    selectEngine(sim.kind);

    this.el = h('div', { class: 'side-left panel' }, [
      h('div', { class: 'panel-head' }, [
        h('span', { class: 'panel-title', text: 'Test hücresi' }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small ghost icon', title: 'Menüye dön', on: { click: cb.onExit } }, [icon('close', 16)]),
      ]),
      h('div', { class: 'scroll panel-body' }, [
        this.wsStrip,
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
        h('div', { class: 'section-label', text: 'Hücre ışıkları' }),
        lightSeg,
        h('div', { class: 'section-label', text: 'Görünüm' }),
        h('div', { class: 'chips' }, [
          pylonBtn,
          wingBtn,
          toggle('Egzoz akışı', view.plume, (v) => {
            view.plume = v;
            visual().setPlumeVisible(v);
          }),
          toggle('Efektler', view.effects, (v) => {
            view.effects = v;
            visual().effects.enabled = v && visual().effectsAllowed;
          }),
          toggle('Hareket bulanıklığı', view.blur, (v) => {
            view.blur = v;
            visual().motionBlur = v;
          }),
        ]),
      ]),
    ]);
  }

  /**
   * Motor ya da tasarımı değişti (yuva, yeni rev): seçici ve açıklama
   * simülasyondaki tasarımdan yeniden kurulur.
   */
  refreshEngine() {
    this.resetShown();
    this.selectEngine(this.sim.kind);
  }

  /** Atölye tasarımı simülasyonda mı: şerit ve seçici durumu */
  setWorkshop(on: boolean) {
    this.wsActive = on;
    this.wsStrip.classList.toggle('hidden', !on);
    this.refreshWorkshopStrip();
    this.refreshEngine();
  }

  private refreshWorkshopStrip() {
    const name = this.cb.workshopName?.() ?? null;
    this.wsBtn?.classList.toggle('hidden', !name);
    if (!this.wsActive) return;
    this.wsName.textContent = name ?? '';
    // Beklenen (tasarım noktası, ISA deniz seviyesi) / ölçülen (canlı)
    const exp = this.cb.workshopExpected?.() ?? null;
    if (!exp) {
      this.wsCompare.textContent = '';
      return;
    }
    const shaft = exp.output !== 'thrust' && exp.shaftPower !== undefined;
    const p = this.sim.eng.point as { thrust: number; shaftPower?: number };
    const want = shaft ? exp.shaftPower! : exp.thrust;
    const got = shaft ? (p.shaftPower ?? 0) : p.thrust;
    const pct = want > 0 ? ((got - want) / want) * 100 : 0;
    const unit = shaft ? 'kW' : 'kN';
    const k = shaft ? 1e-3 : 1e-3;
    const lit = this.sim.lit && this.sim.controls.throttle >= 0.99;
    const why = !lit ? 'tam güçte ölçülür' : Math.abs(pct) <= 3 ? 'tasarımla uyumlu (±%3)' : this.sim.egtLimited ? 'EGT sınırlayıcı devrede' : 'devir sınırı ya da koşul farkı';
    this.wsCompare.replaceChildren(
      h('span', { text: `Beklenen ${fmtNum(want * k, shaft ? 0 : 1)} ${unit}` }),
      h('span', { text: `Ölçülen ${fmtNum(got * k, shaft ? 0 : 1)} ${unit}${lit ? ` (${pct >= 0 ? '+' : '−'}%${fmtNum(Math.abs(pct), 1)})` : ''}` }),
      h('span', { class: lit && Math.abs(pct) > 3 ? 'warn' : 'muted', text: why }),
    );
  }

  update() {
    this.refreshWorkshopStrip();
    // Motor (ders ya da seçici ile) değiştiyse görünüm tercihleri yeni modele
    if (this.visual() !== this.viewApplied) this.applyView();
    this.flight.refresh();
    this.selectEngine(this.sim.kind);
    if (this.faultBtns.bird && this.sim.fanDamage === 0) this.faultBtns.bird.classList.remove('active');
  }
}
