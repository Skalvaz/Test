/**
 * Sıfırdan tasarım sihirbazı (M5a §6.3): altı soru, model arkada canlı
 * güncellenir. Her adım `data-wizard-step="<n>"`, seçenekler
 * `data-arch="<eksen>:<değer>"`, ileri `data-action="wizard-next"`, bitir
 * `data-action="wizard-finish"`, boyut alanı `data-knob="engine.targetOutput"`.
 *
 * Seçimler `store.wizardChoose` ile mimariye uygulanır (kurallar ve zorunlu
 * eşlikler mağazada); kilitli seçenek gri görünür, nedeni üzerinde yazar.
 */

import { ARCH_OPTIONS, type Architecture, type ArchOption } from '../../design/architecture';
import { fmtNum } from '../../design/summary';
import type { WorkshopStore, WorkshopState } from '../../workshop/store';
import { h, icon } from '../../ui/dom';
import { NumberField } from './KnobField';
import { ATTR, TARGET_OUTPUT_KNOB } from './selectors';

type Axis = keyof Architecture;

interface StepDef {
  n: number;
  title: string;
  hint: string;
  axes: Axis[];
  /** Bu mimaride adım atlanır mı */
  skip?(a: Architecture): boolean;
  /** Eksen değerlerini süzer */
  filter?(o: ArchOption, a: Architecture): boolean;
}

const STEPS: StepDef[] = [
  { n: 1, title: 'Motor ne üretecek?', hint: 'Jet itkisi mi, yoksa bir rotoru (helikopter, jeneratör) çeviren mil gücü mü?', axes: ['output'] },
  {
    n: 2,
    title: 'Alçak basınç milini ne çevirecek?',
    hint: 'LP türbininin işi: ön kompresör, fan, pervane ya da çıkış mili.',
    axes: ['lpLoad'],
    filter: (o, a) => (a.output === 'shaft' ? o.value === 'shaft' : o.value !== 'shaft'),
  },
  {
    n: 3,
    title: 'Baypas havası nereye?',
    hint: 'Fanın dış akışı ayrı lüleden mi çıkar, yoksa çekirdek akışla karışıp tek lüleden mi?',
    axes: ['exhaust', 'mixer'],
    skip: (a) => a.lpLoad !== 'fan',
    filter: (o, a) => (o.axis === 'exhaust' ? o.value !== 'single' : a.exhaust === 'mixed'),
  },
  { n: 4, title: 'Yanma odası?', hint: 'Halka hafif ve kısadır; kutular bakımı kolay ve sağlamdır.', axes: ['combustor'] },
  {
    n: 5,
    title: 'Art yakıcı ve kurulum?',
    hint: 'Art yakıcı kısa süreli büyük itki verir; kaporta motoru gövdeye ya da kanada bağlar.',
    axes: ['afterburner', 'installation'],
  },
  { n: 6, title: 'Boyut', hint: 'Hedef itkiyi ya da mil gücünü seç: hava akışı buna göre çözülür.', axes: [] },
];

const AXIS_LABEL: Partial<Record<Axis, string>> = {
  exhaust: 'Egzoz',
  mixer: 'Karıştırıcı',
  afterburner: 'Art yakıcı',
  installation: 'Kurulum',
};

export interface WizardCallbacks {
  /** Başlangıç ekranına dön */
  onCancel(): void;
}

export class Wizard {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;
  private foot: HTMLDivElement;
  private dots: HTMLDivElement;
  private step = 0;
  private live: HTMLDivElement | null = null;
  private key = '';

  constructor(
    private store: WorkshopStore,
    private cb: WizardCallbacks,
  ) {
    this.body = h('div', { class: 'scroll panel-body ws-wizard-body' });
    this.foot = h('div', { class: 'ws-wizard-foot' });
    this.dots = h('div', { class: 'ws-wizard-dots' });
    this.el = h('div', { class: 'ws-wizard' }, [
      h('div', { class: 'panel-head' }, [
        h('span', { class: 'panel-title', text: 'Sıfırdan tasarla' }),
        h('span', { class: 'spacer' }),
        this.dots,
      ]),
      this.body,
      this.foot,
    ]);
  }

  /** Sihirbaz yeniden başlarken ilk adım */
  reset(): void {
    this.step = 0;
    this.key = '';
  }

  private visibleSteps(a: Architecture): StepDef[] {
    return STEPS.filter((s) => !s.skip?.(a));
  }

  private go(dir: 1 | -1): void {
    const w = this.store.state.wizard;
    if (!w) return;
    const steps = this.visibleSteps(w.arch);
    const cur = steps.findIndex((s) => s.n === STEPS[this.step].n);
    const next = steps[Math.min(steps.length - 1, Math.max(0, cur + dir))];
    this.step = STEPS.indexOf(next);
    this.key = '';
    this.update(this.store.state);
  }

  update(s: Readonly<WorkshopState>): void {
    const w = s.wizard;
    if (!w) return;
    const def = STEPS[this.step];
    // Atlanan adımda kalınmaz (mimari değişti)
    if (def.skip?.(w.arch)) {
      this.go(1);
      return;
    }
    const key = `${this.step}|${JSON.stringify(w.arch)}|${w.blocked}`;
    if (key !== this.key) {
      this.key = key;
      this.render(def, w.arch);
    }
    this.updateLive(s);
  }

  private render(def: StepDef, a: Architecture): void {
    const steps = this.visibleSteps(a);
    const idx = steps.findIndex((x) => x.n === def.n);
    this.dots.replaceChildren(
      ...steps.map((x, i) => h('span', { class: `ws-dot-step${i === idx ? ' on' : i < idx ? ' done' : ''}`, title: x.title })),
    );
    const blocks: Node[] = [
      h('div', { class: 'ws-wizard-num', text: `ADIM ${idx + 1} / ${steps.length}` }),
      h('h3', { class: 'ws-wizard-title', text: def.title }),
      h('p', { class: 'step-body', text: def.hint }),
    ];
    for (const axis of def.axes) {
      const opts = ARCH_OPTIONS.filter((o) => o.axis === axis && (!def.filter || def.filter(o, a)));
      if (!opts.length) continue;
      if (def.axes.length > 1) blocks.push(h('div', { class: 'section-label', text: AXIS_LABEL[axis] ?? String(axis) }));
      blocks.push(h('div', { class: 'ws-opts' }, opts.map((o) => this.option(o, a))));
    }
    if (def.n === 6) blocks.push(this.sizeBlock(a));
    else {
      this.live = null;
    }
    this.body.replaceChildren(h('div', { attrs: { [ATTR.wizardStep]: String(def.n) } }, blocks));

    const last = idx === steps.length - 1;
    this.foot.replaceChildren(
      h('button', {
        class: 'btn small ghost',
        text: idx === 0 ? 'Vazgeç' : 'Geri',
        attrs: { type: 'button' },
        on: { click: () => (idx === 0 ? this.cb.onCancel() : this.go(-1)) },
      }),
      h('span', { class: 'spacer' }),
      last
        ? h('button', {
            class: 'btn primary',
            attrs: { type: 'button', [ATTR.action]: 'wizard-finish' },
            on: { click: () => this.store.wizardFinish() },
          }, ['Tasarımı oluştur', icon('play', 14)])
        : h('button', {
            class: 'btn primary',
            attrs: { type: 'button', [ATTR.action]: 'wizard-next' },
            on: { click: () => this.go(1) },
          }, ['İleri', icon('play', 14)]),
    );
  }

  private option(o: ArchOption, a: Architecture): HTMLElement {
    const selected = a[o.axis] === o.value;
    const why = o.blocked(a);
    const b = h('button', {
      class: `ws-opt${selected ? ' sel' : ''}${why ? ' locked' : ''}`,
      attrs: { type: 'button', [ATTR.arch]: `${o.axis}:${String(o.value)}`, ...(why ? { 'aria-disabled': 'true' } : {}) },
      title: why ?? o.card.does,
      on: { click: () => this.store.wizardChoose(o.axis, o.value) },
    }, [
      h('span', { class: 'ws-opt-t' }, [why ? icon('lock', 13) : null, o.card.title]),
      h('span', { class: 'ws-opt-d', text: why ?? o.card.does }),
      h('span', { class: 'ws-opt-ex', text: o.card.examples }),
    ]);
    return b;
  }

  private sizeBlock(a: Architecture): HTMLElement {
    const shaft = a.output === 'shaft' || a.lpLoad === 'propeller';
    const w = this.store.state.wizard!;
    const f = new NumberField({
      id: TARGET_OUTPUT_KNOB,
      label: shaft ? 'Hedef mil gücü' : 'Hedef itki',
      unit: shaft ? 'kW' : 'kN',
      min: shaft ? 150 : 2,
      max: shaft ? 8000 : 400,
      step: shaft ? 10 : 0.5,
      digits: shaft ? 0 : 1,
      log: true,
      explain: 'Hava akışı bu hedefe göre çözülür (tasarım noktası: ISA deniz seviyesi, durağan).',
      onInput: (v) => this.store.wizardSize(shaft ? { shaftPower: v * 1e3 } : { thrust: v * 1e3 }),
      onChange: (v) => this.store.wizardSize(shaft ? { shaftPower: v * 1e3 } : { thrust: v * 1e3 }),
    });
    f.setValue(shaft ? (w.target.shaftPower ?? 1.2e6) / 1e3 : (w.target.thrust ?? 50e3) / 1e3);
    this.live = h('div', { class: 'ws-live mono' });
    return h('div', { class: 'ws-size' }, [f.el, this.live]);
  }

  private updateLive(s: Readonly<WorkshopState>): void {
    if (!this.live) return;
    const sm = s.last?.summary;
    if (!sm || !s.last) return;
    const W = s.last.graph.massFlow;
    const out = sm.output === 'thrust' ? `İtki ${fmtNum(sm.thrust / 1e3, 1)} kN` : `Mil gücü ${fmtNum((sm.shaftPower ?? 0) / 1e3, 0)} kW`;
    this.live.textContent = `${out} · Hava ${fmtNum(W, 1)} kg/s · çap ${fmtNum(sm.diameter, 2)} m · boy ${fmtNum(sm.length, 2)} m`;
    this.live.classList.toggle('is-error', !!s.error);
  }
}
