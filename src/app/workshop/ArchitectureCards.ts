/**
 * Mimari kartları (M5a §6.4, Mimari sekmesi): eksen başına iki sütunlu
 * `.lesson-card` ızgarası, kart başına `data-arch="<eksen>:<değer>"`.
 *
 * Kart: başlık, ne yapar, + kazanç, − bedel, gerçek örnek, canlı bedel
 * ("kütle +6 %, boy +4 %, TSFC 0") ve ders/sözlük bağlantısı. Durumlar:
 * seçili · seçilebilir · bağımlı ("Şunlar da değişir: …") · kilitli (gri,
 * kilit simgesi, `blocked()` metni; M5b/M5c kartları da burada).
 * Mimari değişimi yeni aile açar (mağaza bildirir).
 *
 * Canlı bedel boşta hesaplanır (`requestIdleCallback`, kart başına bir
 * üretim), yalnız görünen sekmede; sonuç tasarım rev'i başına önbellekte.
 */

import { ARCH_OPTIONS, applyArchitecture, archKey, resolveChange, type Architecture, type ArchOption } from '../../design/architecture';
import { buildChecked } from '../../design/knobs';
import { graphRev } from '../../design/engineDoc';
import { deriveTraits } from '../../design/traits';
import { fmtSigned, summarize, type DesignSummary } from '../../design/summary';
import { referenceBuilt, templateFor } from '../../workshop/project';
import type { WorkshopStore, WorkshopState } from '../../workshop/store';
import { h, icon } from '../../ui/dom';
import { ATTR } from './selectors';

type Axis = keyof Architecture;

const AXES: { axis: Axis; title: string }[] = [
  { axis: 'lpLoad', title: 'LP yükü' },
  { axis: 'booster', title: 'Booster' },
  { axis: 'centrifugal', title: 'Yüksek basınç kompresörü' },
  { axis: 'combustor', title: 'Yanma odası' },
  { axis: 'exhaust', title: 'Egzoz' },
  { axis: 'mixer', title: 'Karıştırıcı' },
  { axis: 'afterburner', title: 'Art yakıcı' },
  { axis: 'abNozzle', title: 'Art yakıcı lülesi' },
  { axis: 'installation', title: 'Kurulum' },
];

const AXIS_NAME: Partial<Record<Axis, string>> = {
  output: 'Çıkış',
  lpLoad: 'LP yükü',
  booster: 'Booster',
  centrifugal: 'HPC',
  combustor: 'Yanma odası',
  exhaust: 'Egzoz',
  mixer: 'Karıştırıcı',
  afterburner: 'Art yakıcı',
  abNozzle: 'Lüle',
  installation: 'Kurulum',
};

/** Eksen değerinin kısa adı ("Şunlar da değişir" satırı) */
function valueName(axis: Axis, v: unknown): string {
  const o = ARCH_OPTIONS.find((x) => x.axis === axis && x.value === v);
  return o ? o.card.title.toLocaleLowerCase('tr-TR') : String(v);
}

export interface ArchCardsCallbacks {
  openLesson(id: string): void;
  openGlossary(id: string): void;
}

const idle: (fn: () => void) => void =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (fn) => (window as Window & { requestIdleCallback(cb: () => void, o?: { timeout: number }): number }).requestIdleCallback(fn, { timeout: 400 })
    : (fn) => setTimeout(fn, 30);

export class ArchitectureCards {
  readonly el: HTMLDivElement;
  private key = '';
  private costs = new Map<string, string>();
  private costEls = new Map<string, HTMLElement>();
  private queue: ArchOption[] = [];
  private busy = false;
  visible = false;

  constructor(
    private store: WorkshopStore,
    private cb: ArchCardsCallbacks,
  ) {
    this.el = h('div', { class: 'ws-arch' });
  }

  update(s: Readonly<WorkshopState>): void {
    if (!s.last || s.phase !== 'edit') return;
    let a: Architecture;
    try {
      a = this.store.ctx().arch;
    } catch {
      return;
    }
    const rev = graphRev({ ...s.graph, name: '' });
    const key = `${archKey(a)}|${rev}`;
    if (key === this.key) return;
    if (!this.key.startsWith(archKey(a)) || this.key.split('|')[1] !== rev) this.costs.clear();
    this.key = key;
    this.render(a, s.last.summary);
  }

  private render(a: Architecture, cur: DesignSummary): void {
    this.costEls.clear();
    this.queue = [];
    const sections: Node[] = [
      h('p', { class: 'step-body ws-arch-intro', text: 'Mimari değiştirmek yeni bir aile açar; eski tasarımın listede kalır (Aile sekmesi).' }),
    ];
    for (const { axis, title } of AXES) {
      const opts = ARCH_OPTIONS.filter((o) => o.axis === axis);
      // Anlamsız eksen gizlenir (ör. fan yokken booster, karışık akış yokken karıştırıcı)
      const meaningful = opts.some((o) => a[o.axis] === o.value || !o.blocked(a));
      if (!meaningful) continue;
      sections.push(h('div', { class: 'section-label', text: title }));
      sections.push(h('div', { class: 'ws-arch-grid' }, opts.map((o) => this.card(o, a, cur))));
    }
    this.el.replaceChildren(...sections);
    this.pump();
  }

  private card(o: ArchOption, a: Architecture, cur: DesignSummary): HTMLElement {
    const selected = a[o.axis] === o.value;
    const why = selected ? null : o.blocked(a);
    let implied: string[] = [];
    if (!selected && !why) {
      const r = resolveChange(a, o.axis, o.value);
      if (!('blocked' in r)) implied = r.implied.map((i) => `${AXIS_NAME[i.axis] ?? String(i.axis)} → ${valueName(i.axis, i.to)}`);
    }
    const id = `${o.axis}:${String(o.value)}`;
    const cost = h('div', { class: 'ws-arch-cost mono', text: selected ? 'Şu anki seçim' : why ? '' : (this.costs.get(id) ?? 'bedel hesaplanıyor…') });
    if (!selected && !why) {
      this.costEls.set(id, cost);
      if (!this.costs.has(id)) this.queue.push(o);
    }
    const c = o.card;
    const links: Node[] = [];
    if (c.lesson) links.push(h('button', { class: 'ws-link', text: 'Ders', attrs: { type: 'button', [ATTR.action]: 'lesson' }, on: { click: (e) => (e.stopPropagation(), this.cb.openLesson(c.lesson!)) } }));
    if (c.glossary) links.push(h('button', { class: 'ws-link', text: 'Sözlük', attrs: { type: 'button', [ATTR.action]: 'glossary' }, on: { click: (e) => (e.stopPropagation(), this.cb.openGlossary(c.glossary!)) } }));
    const state = selected ? ' sel' : why ? ' locked' : implied.length ? ' implied' : '';
    return h('div', {
      class: `ws-card ws-arch-card${state}`,
      attrs: { role: 'button', tabindex: why || selected ? '-1' : '0', [ATTR.arch]: id, ...(why ? { 'aria-disabled': 'true' } : {}) },
      on: {
        click: () => {
          if (!selected && !why) this.store.setArchitecture(o.axis, o.value);
        },
        keydown: (e) => {
          // İç bağlantılardan (Ders, Sözlük) kabarcıklanan Enter/Boşluk
          // onların kendi tıklamasıdır: mimariyi değiştirmez, engellenmez
          if (e.target !== e.currentTarget) return;
          if ((e.key === 'Enter' || e.key === ' ') && !selected && !why) {
            e.preventDefault();
            this.store.setArchitecture(o.axis, o.value);
          }
        },
      },
    }, [
      h('div', { class: 't' }, [why ? icon('lock', 14) : null, c.title, selected ? h('span', { class: 'ws-badge', text: 'SEÇİLİ' }) : null]),
      h('div', { class: 'd', text: why ?? c.does }),
      why ? null : h('div', { class: 'ws-gain', text: `+ ${c.gains}` }),
      why ? null : h('div', { class: 'ws-cost', text: `− ${c.costs}` }),
      h('div', { class: 'ws-ex', text: c.examples }),
      implied.length ? h('div', { class: 'ws-implied', text: `Şunlar da değişir: ${implied.join(', ')}` }) : null,
      why ? null : cost,
      links.length ? h('div', { class: 'meta' }, links) : null,
    ]);
    void cur;
  }

  /** Boşta bir kart bedeli */
  private pump(): void {
    if (this.busy || !this.queue.length || !this.visible) return;
    this.busy = true;
    idle(() => {
      this.busy = false;
      const o = this.queue.shift();
      const s = this.store.state;
      if (!o || !s.last) return;
      const id = `${o.axis}:${String(o.value)}`;
      let text: string;
      try {
        const a = this.store.ctx().arch;
        const r = resolveChange(a, o.axis, o.value);
        if ('blocked' in r) text = r.blocked;
        else {
          const g = applyArchitecture(s.graph, r.arch);
          const b = buildChecked(g, { reference: referenceBuilt(templateFor(deriveTraits(g))) });
          text = costText(s.last.summary, summarize(b));
        }
      } catch {
        text = 'Bu tasarımla kurulamıyor';
      }
      this.costs.set(id, text);
      const el = this.costEls.get(id);
      if (el) el.textContent = text;
      this.pump();
    });
  }

  /** Sekme görünür oldu: kuyruk işlemeye başlar */
  setVisible(v: boolean): void {
    this.visible = v;
    if (v) this.pump();
  }
}

/** "kütle +6 %, boy +4 %, TSFC −2 %" */
export function costText(a: DesignSummary, b: DesignSummary): string {
  const pct = (x: number, y: number) => (Math.abs(x) > 1e-9 ? fmtSigned(((y - x) / x) * 100, 0) : '0');
  const parts = [`kütle ${pct(a.mass, b.mass)} %`, `boy ${pct(a.length, b.length)} %`];
  if (a.tsfc !== undefined && b.tsfc !== undefined) parts.push(`TSFC ${pct(a.tsfc, b.tsfc)} %`);
  else if (a.sfc !== undefined && b.sfc !== undefined) parts.push(`SFC ${pct(a.sfc, b.sfc)} %`);
  if (b.output === 'thrust') parts.push(`itki ${pct(a.thrust, b.thrust)} %`);
  return parts.join(', ');
}
