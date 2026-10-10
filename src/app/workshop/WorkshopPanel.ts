/**
 * Atölyenin sol paneli (M5a §6.1–§6.5, `.side-left`): sekmeler [Mimari]
 * [Ayar] [Aile], sihirbaz (phase 'wizard'), hata kutusu (`data-error`,
 * "Son geçerli tasarıma dön" `data-action="revert"`) ve ad alanı
 * (`data-field="name"`). Üst çubuk araçları (aile, varyantlar, Uzman,
 * geri al/yinele) `toolbar` öğesindedir; App onu üst çubuğa koyar.
 *
 * Ayar sekmesi modül bölümlerinden oluşur: başlık `data-module="<ModuleRef>"`
 * (tıklamak modülü seçer: 3B'de nabızlı vurgu ve tutamaçlar), içinde
 * KnobField'lar. Seçili modülün bölümü açılır ve görünür alana kayar.
 */

import { ENGINE_KNOBS, type EngineKnob, type KnobId } from '../../design/knobs';
import { graphRev } from '../../design/engineDoc';
import { GOALS } from '../../workshop/goals';
import type { TeachingError } from '../../design/warnings';
import type { ModuleRef } from '../../workshop/project';
import type { WorkshopStore, WorkshopState } from '../../workshop/store';
import { h, icon } from '../../ui/dom';
import { ArchitectureCards } from './ArchitectureCards';
import { KnobField } from './KnobField';
import { ATTR } from './selectors';
import { Wizard } from './Wizard';

/** Modül bölümlerinin sırası ve adları */
export const MODULE_ORDER: { id: ModuleRef; name: string }[] = [
  { id: 'engine', name: 'Motor' },
  { id: 'inlet', name: 'Giriş' },
  { id: 'propeller', name: 'Pervane' },
  { id: 'fan', name: 'Fan' },
  { id: 'lpc', name: 'LPC' },
  { id: 'hpc', name: 'HPC' },
  { id: 'combustor', name: 'Yanma odası' },
  { id: 'hpt', name: 'HPT' },
  { id: 'lpt', name: 'LPT' },
  { id: 'mixer', name: 'Karıştırıcı' },
  { id: 'afterburner', name: 'Art yakıcı' },
  { id: 'nozzle', name: 'Lüle' },
  { id: 'shaft', name: 'Çıkış mili' },
] as { id: ModuleRef; name: string }[];

export const moduleName = (m: string | null | undefined) => MODULE_ORDER.find((x) => x.id === m)?.name ?? (m ?? '');

/** Düğmenin bölümü: 'bypassDuct' motor bölümüne girer */
const sectionOf = (k: EngineKnob): string => (k.group === 'bypassDuct' ? 'engine' : k.group);

export type WorkshopTab = 'arch' | 'tune' | 'family';

export interface WorkshopPanelCallbacks {
  onExit(): void;
  /** Başlangıç ekranını aç (yeni aile / şablon) */
  onNewFromTemplate(): void;
  /** Sihirbazdan vazgeç: başlangıç ekranı */
  onWizardCancel(): void;
  openLesson(id: string): void;
  openGlossary(id: string): void;
  /** Kaydırıcı sürüklemesi (hayalet) */
  onKnobDrag(active: boolean): void;
}

export class WorkshopPanel {
  readonly el: HTMLDivElement;
  /** Üst çubuk araçları */
  readonly toolbar: HTMLDivElement;
  tab: WorkshopTab = 'tune';
  readonly wizard: Wizard;
  readonly arch: ArchitectureCards;
  private fields: KnobField[] = [];
  private sections = new Map<string, { el: HTMLElement; head: HTMLButtonElement; body: HTMLElement }>();
  private open = new Set<string>(['engine']);
  private tabsEl: HTMLDivElement;
  private tabBtns = new Map<WorkshopTab, HTMLButtonElement>();
  private tune: HTMLDivElement;
  private family: HTMLDivElement;
  private errorBox: ErrorBox;
  private nameInput: HTMLInputElement;
  private nameRow: HTMLDivElement;
  private editor: HTMLDivElement;
  private famSelect: HTMLSelectElement;
  private variantsEl: HTMLDivElement;
  private expertBtn: HTMLButtonElement;
  private undoBtn: HTMLButtonElement;
  private redoBtn: HTMLButtonElement;
  private badge: HTMLSpanElement;
  private fieldsKey = '';
  private famKey = '';
  private famViewKey = '';
  private lastSelected: ModuleRef | null = null;

  constructor(
    private store: WorkshopStore,
    private cb: WorkshopPanelCallbacks,
  ) {
    this.wizard = new Wizard(store, { onCancel: () => cb.onWizardCancel() });
    this.arch = new ArchitectureCards(store, { openLesson: cb.openLesson, openGlossary: cb.openGlossary });

    // Üst çubuk: aile seçici, varyantlar, uzman, geri al/yinele
    this.famSelect = h('select', {
      class: 'btn small ws-fam-select',
      title: 'Motor ailesi',
      attrs: { 'aria-label': 'Motor ailesi' },
      on: { change: () => store.selectFamily(this.famSelect.value) },
    });
    this.variantsEl = h('div', { class: 'ws-variants' });
    this.expertBtn = h('button', {
      class: 'btn small',
      text: 'Uzman',
      title: 'Uzman düğmeleri ve ek sınır çubukları (U)',
      attrs: { type: 'button', [ATTR.action]: 'expert', 'aria-pressed': 'false' },
      on: { click: () => store.setExpert(!store.state.project.expert) },
    });
    this.undoBtn = h('button', { class: 'btn small ghost icon', title: 'Geri al (Ctrl+Z)', attrs: { type: 'button', 'aria-label': 'Geri al' }, on: { click: () => store.undo() } }, ['↶']);
    this.redoBtn = h('button', { class: 'btn small ghost icon', title: 'Yinele (Ctrl+Shift+Z)', attrs: { type: 'button', 'aria-label': 'Yinele' }, on: { click: () => store.redo() } }, ['↷']);
    // Yeni aile (başlangıç ekranı): her sekmede görünür (§8 adım 14 bu düğmeyi tıklar)
    const newFam = h('button', {
      class: 'btn small ghost',
      text: '+ Yeni aile',
      title: 'Şablondan ya da sıfırdan yeni motor ailesi (eskisi listede kalır)',
      attrs: { type: 'button', [ATTR.action]: 'new-from-template' },
      on: { click: () => cb.onNewFromTemplate() },
    });
    this.toolbar = h('div', { class: 'ws-toolbar' }, [
      this.famSelect,
      newFam,
      this.variantsEl,
      this.expertBtn,
      this.undoBtn,
      this.redoBtn,
    ]);

    // Sekmeler
    const tabBtn = (t: WorkshopTab, label: string) => {
      const b = h('button', { class: 'ws-tab', text: label, attrs: { type: 'button', role: 'tab' }, on: { click: () => this.setTab(t) } });
      this.tabBtns.set(t, b);
      return b;
    };
    this.tabsEl = h('div', { class: 'ws-tabs', attrs: { role: 'tablist' } }, [tabBtn('arch', 'Mimari'), tabBtn('tune', 'Ayar'), tabBtn('family', 'Aile')]);
    this.tune = h('div', { class: 'ws-tune' });
    this.family = h('div', { class: 'ws-family' });
    this.errorBox = new ErrorBox({ revert: () => store.revertToLastGood(), openGlossary: (id) => cb.openGlossary(id) });
    this.nameInput = h('input', {
      class: 'ws-name',
      attrs: { type: 'text', maxlength: '40', [ATTR.field]: 'name', 'aria-label': 'Tasarım adı', spellcheck: 'false' },
      on: {
        change: () => store.setName(this.nameInput.value),
        keydown: (e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        },
      },
    });
    this.nameRow = h('div', { class: 'ws-name-row' }, [h('span', { text: 'Ad' }), this.nameInput]);
    this.badge = h('span', { class: 'ws-lastgood hidden', text: 'son geçerli' });
    this.editor = h('div', { class: 'ws-editor' }, [
      this.tabsEl,
      this.errorBox.el,
      h('div', { class: 'scroll panel-body ws-body' }, [this.arch.el, this.tune, this.family]),
      h('div', { class: 'ws-foot' }, [
        h('button', {
          class: 'btn small ghost',
          text: 'Şablon değerlerine dön',
          title: 'Ailenin başlangıç değerleri (tek geri al adımı)',
          attrs: { type: 'button' },
          on: { click: () => store.resetToTemplate() },
        }),
        this.nameRow,
      ]),
    ]);

    this.el = h('div', { class: 'side-left panel ws-panel hidden' }, [
      h('div', { class: 'panel-head' }, [
        h('span', { class: 'panel-title', text: 'Motor atölyesi' }),
        this.badge,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small ghost icon', title: 'Menüye dön (Esc)', attrs: { type: 'button' }, on: { click: () => cb.onExit() } }, [icon('close', 16)]),
      ]),
      this.wizard.el,
      this.editor,
    ]);
    this.setTab('tune');
  }

  setTab(t: WorkshopTab): void {
    this.tab = t;
    for (const [k, b] of this.tabBtns) {
      b.classList.toggle('sel', k === t);
      b.setAttribute('aria-selected', String(k === t));
    }
    this.arch.el.classList.toggle('hidden', t !== 'arch');
    this.tune.classList.toggle('hidden', t !== 'tune');
    this.family.classList.toggle('hidden', t !== 'family');
    this.arch.setVisible(t === 'arch');
    this.update(this.store.state);
  }

  /** Düğme alanlarını bağlama göre yeniden kurar (aile/mimari değişince) */
  private buildFields(): void {
    const ctx = this.store.ctx();
    this.fields = [];
    this.sections.clear();
    const groups = new Map<string, KnobField[]>();
    for (const k of ENGINE_KNOBS) {
      let r: [number, number] | null = null;
      try {
        r = k.range(ctx);
      } catch {
        r = null;
      }
      if (r === null && k.type !== 'enum' && k.type !== 'bool') continue;
      if (k.type === 'enum' || k.type === 'bool') {
        try {
          if (k.get(this.store.state.graph) === undefined) continue;
        } catch {
          continue;
        }
      }
      const f = new KnobField(k, { store: this.store, onDrag: (a) => this.cb.onKnobDrag(a) });
      this.fields.push(f);
      const sec = sectionOf(k);
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec)!.push(f);
    }
    const nodes: Node[] = [];
    for (const m of MODULE_ORDER) {
      const fs = groups.get(m.id);
      if (!fs?.length) continue;
      nodes.push(this.section(m.id, m.name, fs));
    }
    // Sırada olmayan gruplar (gelecek modüller) sona
    for (const [g, fs] of groups) if (!MODULE_ORDER.some((m) => m.id === g)) nodes.push(this.section(g as ModuleRef, g, fs));
    this.tune.replaceChildren(...nodes);
  }

  private section(id: ModuleRef, name: string, fs: KnobField[]): HTMLElement {
    const summary = h('span', { class: 'ws-sec-sum mono' });
    const head = h('button', {
      class: 'ws-sec-head',
      attrs: { type: 'button', [ATTR.module]: id, 'aria-expanded': 'false' },
      on: {
        click: () => {
          const sel = this.store.state.selected === id;
          if (sel) {
            // Seçili bölüme yeniden tıklamak katlar/açar
            if (this.open.has(id)) this.open.delete(id);
            else this.open.add(id);
            this.refreshOpen();
          } else this.store.select(id);
        },
      },
    }, [h('span', { class: 'ws-caret', text: '▸' }), h('span', { class: 'ws-sec-name', text: name }), summary]);
    const basic = fs.filter((f) => f.knob.level !== 'expert');
    const body = h('div', { class: 'ws-sec-body' }, fs.map((f) => f.el));
    const el = h('div', { class: 'ws-sec' }, [head, body]);
    this.sections.set(id, { el, head, body });
    void basic;
    return el;
  }

  private refreshOpen(): void {
    for (const [id, s] of this.sections) {
      const o = this.open.has(id);
      s.el.classList.toggle('open', o);
      s.el.classList.toggle('sel', this.store.state.selected === id);
      s.head.setAttribute('aria-expanded', String(o));
    }
  }

  /** Aile sekmesi: aileler, varyantlar, görev */
  private renderFamily(s: Readonly<WorkshopState>): void {
    const store = this.store;
    const p = s.project;
    const fam = store.activeFamily();
    // Yalnız içerik değişince yeniden kurulur: 0,2 s'lik yenileme açık
    // <select>'i ve basılı düğmeyi yok etmesin
    const key = familyViewKey(s);
    if (key === this.famViewKey) return;
    this.famViewKey = key;
    const rows = p.families.map((f) =>
      h('button', {
        class: `ws-fam-row${f.id === p.activeFamily ? ' sel' : ''}`,
        attrs: { type: 'button' },
        on: { click: () => store.selectFamily(f.id) },
      }, [h('b', { text: f.code }), h('span', { text: f.name }), h('small', { text: `${f.variants.length} varyant` })]),
    );
    const goalSel = h('select', {
      class: 'btn small',
      attrs: { 'aria-label': 'Görev' },
      on: { change: () => store.setGoal(goalSel.value || null) },
    }, [h('option', { text: 'Görev yok', attrs: { value: '' } }), ...GOALS.map((g) => h('option', { text: g.title, attrs: { value: g.id } }))]);
    goalSel.value = p.goal?.id ?? '';
    const kids: (Node | null)[] = [
      h('div', { class: 'section-label', text: 'Aileler' }),
      h('div', { class: 'ws-fam-list' }, rows),
      h('div', { class: 'chips' }, [
        // Seçici sözleşmesindeki 'new-from-template' üst çubuktaki düğmededir
        h('button', {
          class: 'btn small ws-new-family',
          attrs: { type: 'button' },
          on: { click: () => this.cb.onNewFromTemplate() },
        }, ['+ Yeni aile']),
        fam && fam.variants.length < 4
          ? h('button', { class: 'btn small', text: '+ Varyant', attrs: { type: 'button' }, on: { click: () => store.addVariant() } })
          : null,
      ]),
      h('p', { class: 'step-body', text: 'Aile aynı mimariyi paylaşır; varyantlar (ör. AT-1/45, AT-1/52) ortak tabandan küçük farklarla türer. Aile düğmeleri bütün varyantları değiştirir.' }),
      h('div', { class: 'section-label', text: 'Görev' }),
      goalSel,
      p.goal ? h('p', { class: 'step-body', text: p.goal.brief }) : null,
    ];
    this.family.replaceChildren(...kids.filter((x): x is Node => x !== null));
  }

  private renderToolbar(s: Readonly<WorkshopState>): void {
    const p = s.project;
    const fam = this.store.activeFamily();
    const key = JSON.stringify([p.families.map((f) => [f.id, f.code, f.name, f.active, f.variants.map((v) => [v.id, v.name])]), p.activeFamily]);
    if (key !== this.famKey) {
      this.famKey = key;
      this.famSelect.replaceChildren(...p.families.map((f) => h('option', { text: `${f.code} ${f.name.replace(f.code, '').trim()}`, attrs: { value: f.id } })));
      this.famSelect.value = p.activeFamily;
      this.variantsEl.replaceChildren(...[
        ...(fam?.variants ?? []).map((v) =>
          h('button', {
            class: `ws-variant${v.id === fam!.active ? ' sel' : ''}`,
            text: v.name,
            attrs: { type: 'button' },
            title: 'Varyant',
            on: { click: () => this.store.selectVariant(v.id) },
          }),
        ),
        fam && fam.variants.length < 4
          ? h('button', { class: 'ws-variant add', text: '+', title: 'Yeni varyant', attrs: { type: 'button', 'aria-label': 'Yeni varyant' }, on: { click: () => this.store.addVariant() } })
          : null,
      ].filter((x): x is HTMLButtonElement => x !== null));
    }
    this.expertBtn.classList.toggle('active', p.expert);
    this.expertBtn.setAttribute('aria-pressed', String(p.expert));
    this.undoBtn.disabled = !s.canUndo;
    this.redoBtn.disabled = !s.canRedo;
  }

  update(s: Readonly<WorkshopState> = this.store.state): void {
    const wiz = s.phase === 'wizard';
    this.wizard.el.classList.toggle('hidden', !wiz);
    this.editor.classList.toggle('hidden', wiz || s.phase === 'start');
    this.el.classList.toggle('is-wizard', wiz);
    this.toolbar.classList.toggle('hidden', s.phase !== 'edit' && s.phase !== 'testing');
    if (wiz) {
      this.wizard.update(s);
      return;
    }
    if (s.phase !== 'edit') return;
    this.el.classList.toggle('expert', s.project.expert);
    this.renderToolbar(s);
    const fam = this.store.activeFamily();
    let archKeyStr = '';
    try {
      archKeyStr = JSON.stringify(this.store.ctx().arch);
    } catch {
      archKeyStr = '';
    }
    const fkey = `${fam?.id}|${archKeyStr}`;
    if (fkey !== this.fieldsKey) {
      this.fieldsKey = fkey;
      this.buildFields();
      this.renderFamily(s);
    }
    if (this.tab === 'family') this.renderFamily(s);
    if (this.tab === 'arch') this.arch.update(s);
    // Seçim: bölümü aç, görünür alana kaydır
    if (s.selected !== this.lastSelected) {
      this.lastSelected = s.selected;
      if (s.selected) {
        if (this.tab !== 'tune') this.setTab('tune');
        this.open.add(s.selected);
        this.sections.get(s.selected)?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
    this.refreshOpen();
    for (const f of this.fields) f.update(s);
    // Bölüm özetleri (ilk düğmenin değeri)
    for (const [id, sec] of this.sections) {
      const first = this.fields.find((f) => sectionOf(f.knob) === id && f.knob.level === 'basic');
      const sum = sec.head.querySelector('.ws-sec-sum');
      if (sum && first) {
        const v = first.el.querySelector<HTMLInputElement>('input.ws-num');
        const u = first.el.querySelector('.ws-unit')?.textContent ?? '';
        sum.textContent = v ? `${shortLabel(first.knob)} ${v.value.replace('.', ',')}${u ? ` ${u}` : ''}` : '';
      }
    }
    this.errorBox.update(s.error);
    this.badge.classList.toggle('hidden', this.store.ownsLast() || !s.last);
    // Ad
    const v = fam?.variants.find((x) => x.id === fam.active);
    if (v && document.activeElement !== this.nameInput) this.nameInput.value = v.name;
  }

  /**
   * Yasak bölgeler: boşta (App 0,2 s'de bir çağırır). Önbellek alan
   * başınadır (KnobField, rev anahtarı): sonradan açılan bölümün ya da Uzman
   * açılınca görünen alanların aralığı tasarım değişmeden de hesaplanır.
   */
  updateFeasible(): void {
    const s = this.store.state;
    if (s.phase !== 'edit' || s.dragging || !s.last || this.tab !== 'tune') return;
    const rev = graphRev(s.last.graph);
    const todo: KnobField[] = [];
    for (const f of this.fields) {
      const shown = this.open.has(sectionOf(f.knob)) && (f.knob.level === 'basic' || s.project.expert);
      // Görünmeyen alanın eski rev'deki aralığı geçersiz: yeniden açılınca
      // değer yanlış sınıra yapışmasın
      if (!shown) f.invalidateFeasible(rev);
      else if (f.feasibleFor !== rev) todo.push(f);
    }
    // Pahalı (~12 üretim/düğme): bir çağrıda en çok ~12 ms, kalanı sonraki boşta
    const t0 = performance.now();
    for (const f of todo) {
      f.updateFeasible(rev);
      if (performance.now() - t0 > 12) break;
    }
  }

  /** Klavye: Tab ile sonraki modül */
  nextModule(dir: 1 | -1 = 1): void {
    const ids = [...this.sections.keys()] as ModuleRef[];
    if (!ids.length) return;
    const i = ids.indexOf(this.store.state.selected as ModuleRef);
    this.store.select(ids[(i + dir + ids.length) % ids.length]);
  }

  /** Düğmenin alanı (tutamaç okuması, test) */
  field(id: KnobId): KnobField | undefined {
    return this.fields.find((f) => f.knob.id === id);
  }
}

/**
 * Hata kutusu (`data-error`, `role=alert`): düğmeler bir kez kurulur,
 * yalnız hata içeriği değişince metinler yazılır. 0,2 s'lik yenileme
 * "Son geçerli tasarıma dön"ü fare basılıyken DOM'dan sökmesin (tık
 * kaybolurdu), klavye odağı düşmesin, ekran okuyucu hatayı yinelemesin.
 */
export class ErrorBox {
  readonly el: HTMLDivElement;
  private title: HTMLElement;
  private text: HTMLParagraphElement;
  private glossaryBtn: HTMLButtonElement;
  private glossary: string | null = null;
  private key = '';

  constructor(cb: { revert(): void; openGlossary(id: string): void }) {
    this.title = h('b');
    this.text = h('p');
    this.glossaryBtn = h('button', {
      class: 'btn small ghost hidden',
      text: 'Sözlük',
      attrs: { type: 'button', [ATTR.action]: 'glossary' },
      on: { click: () => this.glossary && cb.openGlossary(this.glossary) },
    });
    this.el = h('div', { class: 'callout ws-error hidden', attrs: { [ATTR.error]: '', role: 'alert' } }, [
      this.title,
      this.text,
      h('div', { class: 'chips' }, [
        h('button', { class: 'btn small', text: 'Son geçerli tasarıma dön', attrs: { type: 'button', [ATTR.action]: 'revert' }, on: { click: () => cb.revert() } }),
        this.glossaryBtn,
      ]),
    ]);
  }

  update(e: Readonly<Pick<TeachingError, 'title' | 'text' | 'glossary'>> | null): void {
    const key = e ? JSON.stringify([e.title, e.text, e.glossary ?? null]) : '';
    if (key === this.key) return;
    this.key = key;
    this.el.classList.toggle('hidden', !e);
    if (!e) return;
    this.title.textContent = e.title;
    this.text.textContent = e.text;
    this.glossary = e.glossary ?? null;
    this.glossaryBtn.classList.toggle('hidden', !e.glossary);
  }
}

/** Aile sekmesinin içeriğini belirleyen durum (değişmedikçe DOM yeniden kurulmaz) */
export function familyViewKey(s: Pick<WorkshopState, 'project'>): string {
  const p = s.project;
  return JSON.stringify([
    p.families.map((f) => [f.id, f.code, f.name, f.variants.length]),
    p.activeFamily,
    p.goal?.id ?? null,
  ]);
}

function shortLabel(k: EngineKnob): string {
  const map: Record<string, string> = { 'engine.massFlow': 'W', 'fan.pr': 'FPR', 'lpc.pr': 'PR', 'hpc.pr': 'PR', 'combustor.tit': 'T4', 'propeller.diameter': 'D', 'shaft.rpm': 'n' };
  return map[k.id] ?? '';
}
