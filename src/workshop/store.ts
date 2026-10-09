/**
 * Atölye durumu (M5a, docs/M5A-SPEC.md §2.13): saf TS mağaza. 3B ve
 * simülasyona dokunan tek nokta `onBuilt`'tir; App bunu
 * `applyDesign('workshop', …)` ile bağlar.
 *
 * Kurallar:
 *  - Beklenen hatalar (GraphError | FlowpathError | DesignError, NaN/∞)
 *    yakalanır, `state.error`'a yazılır; ASLA console.error çağrılmaz
 *    (oynanış testi konsol hatasını başarısızlık sayar). `last` son
 *    geçerli değerlendirmedir: 3B ve sonuç paneli onu gösterir.
 *  - "Son geçerli" aile başınadır: `lastFor` `last`'ı üreten aile/varyanttır.
 *    Etkin aile kurulamıyorsa `last` o ailenin son geçerli hali, yoksa
 *    şablonu olur (başka ailenin motoru gösterilmez). Düğme bağlamı her
 *    zaman etkin varyantın grafiğinden (`state.graph`); tutamaçlar, ters
 *    çözüm, çözülebilir aralık ve duyarlılık yalnız `last` etkin varyanta
 *    aitken çalışır.
 *  - Kısma: `input` aşamasında sayılar her olayda tam fizikle hesaplanır;
 *    `onBuilt('draft')` en çok 1/(son üretim süresi + 16 ms) sıklıkta.
 *    `change` ve tutamaç bırakılınca hemen taslak, 250 ms sonra tam ayrıntı.
 *  - Otomatik kayıt: localStorage['turbofan-akademi:workshop:v1'] =
 *    WorkshopProjectDocV1 (try/catch; okunamazsa sessizce boş başlar).
 *    Kurulamayan aile yerine son geçerli hali yazılır ("Devam et" hatayla
 *    açılmaz).
 *  - Mimari değişimi yeni aile açar; eski aile listede kalır.
 *  - Aile/varyant: aile kapsamlı düğme tabanı değiştirir. Varyant kapsamlı
 *    düğme tek varyantlı ailede de tabanı değiştirir (zarf kardeş
 *    varyantlar arasındaki farkı sınırlar); birden çok varyantta yalnız
 *    etkin varyanta yazılır ve zarfa kırpılır. Tek varyanta inilince kalan
 *    varyantın değerleri tabana katlanır.
 *
 * Henüz gövdesi başka pakette olan işlevler (değerlendirme P3, mimari P4a)
 * `deps` ile enjekte edilir; varsayılanlar gerçek modüllerdir.
 */

import {
  applyArchitecture,
  architectureOf,
  resolveChange,
  type ArchChange,
  type Architecture,
} from '../design/architecture';
import type { Edit } from '../design/core/edit';
import type { KnobValue } from '../design/core/knob';
import type { Finding } from '../design/core/rules';
import { graphFromArchitecture, solveMassFlow } from '../design/defaults';
import {
  graphRev,
  newDocId,
  parseDoc,
  parseProjectDoc,
  resolveFamilyVariant,
  serializeProjectDoc,
  familyFromDoc,
  type DocExtras,
} from '../design/engineDoc';
import { evaluate, type Evaluation } from '../design/evaluate';
import { TEMPLATES } from '../design/catalog';
import type { BuildOptions, BuiltEngine } from '../design/graph';
import { handleFor, handlesFor } from '../design/handles';
import {
  buildChecked,
  clampEngineKnob,
  feasibleRange,
  knobById,
  sensitivity,
  type EngineKnob,
  type KnobCtx,
  type KnobId,
} from '../design/knobs';
import { diffSummary, summarize, type DesignSummary, type SummaryDelta } from '../design/summary';
import { TECH_MODERN } from '../design/tech';
import { deriveTraits } from '../design/traits';
import type { EngineGraph } from '../design/types';
import { evaluateOperability, translateError, type DesignGoal, type TeachingError } from '../design/warnings';
import { goalById } from './goals';
import { EditHistory } from './history';
import {
  autoVariantName,
  defaultEnvelope,
  existingTemplate,
  familyBase,
  familyLabel,
  MAX_FAMILIES,
  MAX_VARIANTS,
  nextFamilyCode,
  projectFromDoc,
  projectToDoc,
  referenceBuilt,
  templateFor,
  type EngineFamily,
  type HandleId,
  type ModuleRef,
  type TemplateId,
  type WorkshopProject,
} from './project';

/** Otomatik kayıt anahtarı */
export const WORKSHOP_STORAGE_KEY = 'turbofan-akademi:workshop:v1';

/** Sürüklemede kademe histerezisi (§2.7); bırakınca 0 */
export const DRAG_STAGE_HYSTERESIS = 0.03;
/** Tam ayrıntı gecikmesi (App fullDetailTimer ile aynı) */
export const FULL_DETAIL_DELAY_MS = 250;

/** Sihirbaz durumu (phase 'wizard') */
export interface WizardState {
  arch: Architecture;
  /** Hedef itki [N] ya da mil gücü [W] */
  target: { thrust?: number; shaftPower?: number };
  /** Son seçimin kilit nedeni (seçim uygulanmadı) */
  blocked: string | null;
}

export interface WorkshopState {
  project: WorkshopProject;
  /** Çözülmüş etkin varyant (geçersiz olabilir) */
  graph: EngineGraph;
  /** Son geçerli değerlendirme */
  last: Evaluation;
  /**
   * `last`'ı üreten aile ve varyant. null: vitrin, sihirbaz önizlemesi ya da
   * ailenin şablonu (aile hiç kurulamadı). Etkin varyanttan farklıysa sonuç
   * paneli "son geçerli" rozetini gösterir; tutamaçlar gizlenir.
   */
  lastFor: { familyId: string; variantId: string } | null;
  error: TeachingError | null;
  selected: ModuleRef | null;
  /** Delta çiplerinin kıyas noktası */
  compare: DesignSummary;
  phase: 'start' | 'wizard' | 'edit' | 'testing';
  dragging: HandleId | KnobId | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Kısa bildirim ("Yeni aile AT-2 açıldı; AT-1 duruyor."); seq her bildirimde artar */
  notice: { text: string; seq: number } | null;
  /** Sihirbaz (yalnız phase 'wizard') */
  wizard: WizardState | null;
}

/** Tutamaç, dünya konumuyla (App.workshop.handles() ekran konumunu ekler) */
export interface HandleSpec {
  id: HandleId;
  group: string;
  label: string;
  axis: 'radial' | 'axial';
  /** Dünya: +Z akış, r XY'de (x=0, y=+r) */
  world: [number, number, number];
  /** Sürükleme sınırı (dünya biriminde) ve neden metinleri */
  range: { lo: number; hi: number; loReason?: string; hiReason?: string };
  /** Kademe çentikleri */
  snaps?: number[];
  /** Kilitliyse nedeni */
  blocked: string | null;
  /** Bağlı düğme */
  coupled: string;
}

/**
 * Değerlendirme seçenekleri: üretim seçenekleri + görev (zarf uyarısı) ve
 * "Düzelt" önerisinin hesaplanıp hesaplanmayacağı (sürüklemede pahalı
 * öneri atlanır, bırakınca hesaplanır). P3'ün `EvaluateOptions`'ıyla uyumlu;
 * bilmeyen değerlendirici fazla alanları yok sayar.
 */
export type WorkshopEvalOptions = BuildOptions & { goal?: DesignGoal; remedies?: boolean };

/** Enjekte edilebilir bağımlılıklar (varsayılan: gerçek modüller) */
export interface WorkshopDeps {
  evaluate(g: EngineGraph, opts?: WorkshopEvalOptions): Evaluation | { error: TeachingError };
  translateError(e: unknown): TeachingError;
  summarize(b: BuiltEngine): DesignSummary;
  diffSummary(a: DesignSummary, b: DesignSummary): SummaryDelta[];
  architectureOf(g: EngineGraph): Architecture;
  resolveChange(a: Architecture, axis: keyof Architecture, value: unknown): ArchChange;
  applyArchitecture(seed: EngineGraph, next: Architecture): EngineGraph;
  graphFromArchitecture(a: Architecture, size: { massFlow: number; name: string }): EngineGraph;
  solveMassFlow(g: EngineGraph, target: { thrust?: number; shaftPower?: number }): number;
  /** Rölanti ve tam güç trim'i (~30 ms): yalnız tam ayrıntıda, boşta (§2.11) */
  evaluateOperability(b: BuiltEngine): Finding[];
}

export const DEFAULT_DEPS: WorkshopDeps = {
  evaluate,
  evaluateOperability,
  translateError,
  summarize,
  diffSummary,
  architectureOf,
  resolveChange,
  applyArchitecture,
  graphFromArchitecture,
  solveMassFlow,
};

export interface WorkshopStoreOptions {
  onBuilt(b: BuiltEngine, detail: 'draft' | 'full'): void;
  now?: () => number;
  /** null: otomatik kayıt yok. Verilmezse tarayıcının localStorage'ı (varsa) */
  storage?: Storage | null;
  deps?: Partial<WorkshopDeps>;
}

/** Sihirbazın başlangıç mimarisi: art yakıcısız tek akışlı turbojet */
export const WIZARD_DEFAULT_ARCH: Architecture = {
  output: 'thrust',
  lpLoad: 'lpc',
  booster: false,
  centrifugal: false,
  combustor: 'annular',
  exhaust: 'single',
  mixer: 'confluent',
  afterburner: false,
  abNozzle: 'convergent',
  installation: 'bare',
};

/** Geri al yığınının durumu */
interface Snap {
  project: WorkshopProject;
  selected: ModuleRef | null;
}

const clone = <T>(x: T): T => structuredClone(x);
const sameValue = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Number(a.toPrecision(7)) === Number(b.toPrecision(7)) : a === b;

/** P3 çevirisi kullanılamazsa en sade öğretici hata (mağaza asla atmaz) */
function plainTeaching(e: unknown): TeachingError {
  const raw = e instanceof Error ? e.message : String(e);
  const x = e as { name?: string; knobs?: string[]; group?: string };
  const source = x?.name === 'GraphError' ? 'graph' : x?.name === 'FlowpathError' ? 'flowpath' : 'design';
  return { title: 'Tasarım kurulamadı', text: raw, knobs: Array.isArray(x?.knobs) ? [...x.knobs] : [], source, group: x?.group, raw };
}

const SEVERITY_RANK: Record<Finding['severity'], number> = { warning: 0, caution: 1, info: 2 };

/**
 * Değerlendirmenin bulgularına çalışabilirlik bulgularını ekler (aynı
 * kimlikli eskiler çıkar); sıra evaluateRules ile aynı: önem, sonra kimlik.
 */
function withOperability(e: Evaluation, ops: Finding[]): Evaluation {
  if (!ops.length) return e;
  const ids = new Set(ops.map((f) => f.id));
  const findings = [...e.findings.filter((f) => !ids.has(f.id)), ...ops].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return { ...e, findings };
}

/**
 * Görsel değişiklik imzası: aynı grafik + aynı kademe sayıları aynı modeldir.
 * Ad (varyant adı grafiğe girer) geometriyi değiştirmez: imzaya girmez.
 */
const visualSig = (b: BuiltEngine) => {
  const g = b.flowpath.gas;
  return `${graphRev({ ...b.graph, name: '' })}:${[g.front, g.booster, g.hpc, g.hpt, g.lpt].map((r) => r?.stages ?? 0).join(',')}`;
};

export class WorkshopStore {
  private s: WorkshopState;
  private readonly deps: WorkshopDeps;
  private readonly now: () => number;
  private readonly storage: Storage | null;
  private listeners: ((s: WorkshopState) => void)[] = [];
  private history = new EditHistory<Snap>();
  /** Aile başına belge yan bilgileri (meta, ext, bilinmeyen alanlar) */
  private extras = new Map<string, DocExtras>();
  /** Ailenin ilk tabanı ("Şablon değerlerine dön"; sihirbaz aileleri için) */
  private initialBase = new Map<string, EngineGraph>();
  /** Aile başına son geçerli hal: ailenin kendisi (etkin varyantıyla) ve değerlendirmesi */
  private lastGood = new Map<string, { family: EngineFamily; evaluation: Evaluation }>();
  private noticeSeq = 0;
  // Kısma ve yayın
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private fullTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDraftAt = -Infinity;
  private shown: { sig: string; detail: 'draft' | 'full' } | null = null;
  /** Son `onBuilt` süresi [ms] */
  lastBuildMs = 0;
  /** Son tam ayrıntıdaki çalışabilirlik bulguları (rev başına; geri al aynı tasarıma dönünce yeniden kullanılır) */
  private opFindings: { rev: string; findings: Finding[] } | null = null;
  /** Sürükleme sırasında sabit tutulan tutamaç sınırları */
  private dragSpecs: Map<string, Pick<HandleSpec, 'range' | 'snaps' | 'blocked'>> | null = null;

  constructor(readonly opts: WorkshopStoreOptions) {
    this.deps = { ...DEFAULT_DEPS, ...opts.deps };
    this.now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.storage = opts.storage !== undefined ? opts.storage : defaultStorage();
    // Başlangıç ekranının vitrini: şablon turbofan (yayınlanmaz)
    const graph = this.showcaseGraph();
    const r = this.safeEvaluate(graph, { reference: referenceBuilt('turbofan') });
    const last = 'error' in r ? (null as unknown as Evaluation) : r;
    this.s = {
      project: { families: [], activeFamily: '', expert: false },
      graph,
      last,
      lastFor: null,
      error: 'error' in r ? r.error : null,
      selected: null,
      compare: last?.summary as DesignSummary,
      phase: 'start',
      dragging: null,
      canUndo: false,
      canRedo: false,
      notice: null,
      wizard: null,
    };
  }

  get state(): Readonly<WorkshopState> {
    return this.s;
  }

  subscribe(fn: (s: WorkshopState) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /** Taslak/tam yayın bekleyen iş yok */
  get idle(): boolean {
    return !this.draftTimer && !this.fullTimer;
  }

  /** Bekleyen taslak ve tam ayrıntıyı hemen yayınlar (test kancası `flush`) */
  flush(): void {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
      this.fireDraft();
    }
    if (this.fullTimer) {
      clearTimeout(this.fullTimer);
      this.fullTimer = null;
      this.fireFull();
    }
  }

  /** Zamanlayıcıları durdurur (atölyeden çıkış) */
  dispose(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    if (this.fullTimer) clearTimeout(this.fullTimer);
    this.draftTimer = this.fullTimer = null;
    this.listeners = [];
  }

  /* ------------------------------------------------------------------ */
  /* Durum yardımcıları                                                  */
  /* ------------------------------------------------------------------ */

  private set(patch: Partial<WorkshopState>): void {
    this.s = { ...this.s, ...patch, canUndo: this.history.canUndo, canRedo: this.history.canRedo };
    for (const l of this.listeners) l(this.s);
  }

  private notify(text: string): void {
    this.set({ notice: { text, seq: ++this.noticeSeq } });
  }

  private snap(): Snap {
    return { project: clone(this.s.project), selected: this.s.selected };
  }

  private showcaseGraph(): EngineGraph {
    const g = familyBase(TEMPLATES.turbofan!);
    g.name = TEMPLATES.turbofan!.name;
    return g;
  }

  /** Etkin aile ve varyant */
  activeFamily(p: WorkshopProject = this.s.project): EngineFamily | undefined {
    return p.families.find((f) => f.id === p.activeFamily);
  }

  private referenceFor(f: EngineFamily | undefined, g: EngineGraph): BuiltEngine {
    const id = (f?.origin.template as TemplateId | undefined) ?? templateFor(deriveTraits(g));
    return referenceBuilt(id);
  }

  /** `last` etkin aile ve varyanta ait (tutamaç, ters çözüm, aralık bunu ister) */
  ownsLast(): boolean {
    const f = this.activeFamily();
    const o = this.s.lastFor;
    return !!f && !!o && !!this.s.last && o.familyId === f.id && o.variantId === f.active;
  }

  /**
   * Düğme bağlamı. Varsayılan: etkin varyantın çözülmüş grafiği (geçersiz
   * olsa da): `last` başka aileden kalmış olabilir, ondan türetilmez.
   */
  ctx(g: EngineGraph = this.s.graph): KnobCtx {
    const deps = this.deps;
    let arch: Architecture | undefined;
    return {
      traits: deriveTraits(g),
      tech: TECH_MODERN,
      family: this.activeFamily(),
      get arch(): Architecture {
        return (arch ??= deps.architectureOf(g));
      },
    };
  }

  /** Mağazanın üretim seçenekleri (aile referansı); App ve paneller aynısını kullanır */
  buildOptions(g: EngineGraph = this.s.graph): BuildOptions {
    return { reference: this.referenceFor(this.activeFamily(), g) };
  }

  private safeTranslate(e: unknown): TeachingError {
    try {
      return this.deps.translateError(e);
    } catch {
      return plainTeaching(e);
    }
  }

  private safeEvaluate(g: EngineGraph, opts: WorkshopEvalOptions): Evaluation | { error: TeachingError } {
    try {
      return this.deps.evaluate(g, opts);
    } catch (e) {
      return { error: this.safeTranslate(e) };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Değerlendirme ve yayın                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Etkin varyantı çözer, değerlendirir ve (geçerliyse) yayın sırasına
   * koyar. Varyant adı kilitli değilse itkiden otomatik ad verilir.
   */
  private recompute(phase: 'input' | 'change', drag = false): void {
    const p = this.s.project;
    const fam = this.activeFamily(p);
    if (!fam) return;
    let graph = resolveFamilyVariant(fam, fam.active);
    const opts: WorkshopEvalOptions = {
      reference: this.referenceFor(fam, graph),
      ...(drag && this.ownsLast() ? { previous: this.s.last.built.flowpath.gas, stageHysteresis: DRAG_STAGE_HYSTERESIS } : {}),
      ...(p.goal ? { goal: p.goal } : {}),
      // "Düzelt" önerisi yalnız tam değerlendirmede (input aşamasında < 2 ms bütçe)
      remedies: phase === 'change',
    };
    let r = this.safeEvaluate(graph, opts);
    if ('error' in r) {
      this.set({ graph, error: r.error });
      // Başka ailenin motoru gösterilmez: bu ailenin son geçerli hali ya da şablonu
      if (this.s.lastFor?.familyId !== fam.id) this.showFamilyFallback(fam, phase);
      return;
    }
    // Otomatik varyant adı ("AT-1/45"): ad grafiğe girer, değişirse bir kez daha üret
    const v = fam.variants.find((x) => x.id === fam.active)!;
    if (!v.nameLocked) {
      const name = autoVariantName(fam.code, r.summary);
      if (name !== v.name) {
        const p2 = clone(p);
        const f2 = this.activeFamily(p2)!;
        f2.variants.find((x) => x.id === fam.active)!.name = name;
        const g2 = { ...graph, name };
        const r2 = this.safeEvaluate(g2, opts);
        if (!('error' in r2)) {
          graph = g2;
          r = r2;
          this.s = { ...this.s, project: p2 };
        }
      }
    }
    if (this.opFindings?.rev === r.built.rev) r = withOperability(r, this.opFindings.findings);
    const good = this.activeFamily()!;
    this.lastGood.set(good.id, { family: clone(good), evaluation: r });
    this.set({ graph, last: r, lastFor: { familyId: good.id, variantId: good.active }, error: null });
    this.publish(phase);
  }

  /**
   * Etkin aile kurulamıyor ve `last` başka aileden: ailenin son geçerli
   * hali (varsa), yoksa ailenin şablonu gösterilir. Şablon da kurulamazsa
   * `last` olduğu gibi kalır (tutamaçlar yine gizli: ownsLast false).
   */
  private showFamilyFallback(fam: EngineFamily, phase: 'input' | 'change'): void {
    const good = this.lastGood.get(fam.id);
    if (good) {
      this.set({ last: good.evaluation, lastFor: { familyId: fam.id, variantId: good.family.active } });
    } else {
      let tid: TemplateId;
      try {
        tid = existingTemplate((fam.origin.template as TemplateId | undefined) ?? templateFor(deriveTraits(fam.base)));
      } catch {
        return;
      }
      const r = this.safeEvaluate(familyBase(TEMPLATES[tid]!), { reference: referenceBuilt(tid) });
      if ('error' in r) return;
      this.set({ last: r, lastFor: null });
    }
    this.publish(phase);
  }

  private publish(phase: 'input' | 'change'): void {
    if (phase === 'input') {
      if (this.draftTimer) return; // en son değer zamanlayıcıda yayınlanır
      const wait = this.lastDraftAt + this.lastBuildMs + 16 - this.now();
      if (wait <= 0) this.fireDraft();
      else
        this.draftTimer = setTimeout(() => {
          this.draftTimer = null;
          this.fireDraft();
        }, wait);
      return;
    }
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }
    this.fireDraft();
    if (this.fullTimer) clearTimeout(this.fullTimer);
    this.fullTimer = setTimeout(() => {
      this.fullTimer = null;
      this.fireFull();
    }, FULL_DETAIL_DELAY_MS);
  }

  private emit(b: BuiltEngine, detail: 'draft' | 'full'): void {
    const t = this.now();
    try {
      this.opts.onBuilt(b, detail);
    } finally {
      this.lastBuildMs = this.now() - t;
      this.shown = { sig: visualSig(b), detail };
    }
  }

  private fireDraft(): void {
    const b = this.s.last?.built;
    if (!b || this.s.phase === 'start') return;
    if (this.shown?.sig === visualSig(b)) return;
    this.emit(b, 'draft');
    this.lastDraftAt = this.now();
  }

  private fireFull(): void {
    const b = this.s.last?.built;
    if (!b || this.s.phase === 'start') return;
    if (!(this.shown?.sig === visualSig(b) && this.shown.detail === 'full')) this.emit(b, 'full');
    this.checkOperability(b);
  }

  /**
   * Rölanti ve tam güç trim'i (§2.11 surgeMargin, idleTrim, fullTrim): ~30 ms,
   * bu yüzden yalnız tam ayrıntıda. Bulgular son değerlendirmeye eklenir;
   * değerlendirici atarsa bulgu eklenmez (mağaza asla atmaz).
   */
  private checkOperability(b: BuiltEngine): void {
    if (this.opFindings?.rev !== b.rev) {
      let findings: Finding[] = [];
      try {
        findings = this.deps.evaluateOperability(b);
      } catch {
        findings = [];
      }
      this.opFindings = { rev: b.rev, findings };
    }
    const last = this.s.last;
    if (last?.built.rev === b.rev && this.opFindings.findings.length) {
      const next = withOperability(last, this.opFindings.findings);
      // Ailenin saklı son geçerli hali de bulgularla (aileye dönünce aynısı görünsün)
      const good = this.s.lastFor && this.lastGood.get(this.s.lastFor.familyId);
      if (good && good.evaluation === last) good.evaluation = next;
      this.set({ last: next });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Düzenleme çekirdeği                                                 */
  /* ------------------------------------------------------------------ */

  /** Projeyi değiştirir, düzenlemeyi geri al yığınına koyar, yeniden değerlendirir */
  private commit(edit: Edit, phase: 'input' | 'change', mutate: (p: WorkshopProject) => void, o: { drag?: boolean; before?: Snap } = {}): void {
    const before = o.before ?? this.snap();
    const p = clone(this.s.project);
    mutate(p);
    this.history.push(edit, before, phase);
    this.s = { ...this.s, project: p };
    this.recompute(phase, o.drag);
    if (phase === 'change') this.autosave();
  }

  /**
   * Kıyas noktası: sabitlenmemişse her yeni hareketin başındaki özet. Aynı
   * hareketin devamı (sürüklenen hedef aynı) kıyası değiştirmez.
   */
  private gestureStart(target: HandleId | KnobId | null): void {
    if (this.s.dragging === target && target !== null) return;
    if (!this.s.project.baseline && this.s.last) this.s = { ...this.s, compare: this.s.last.summary };
  }

  /** Düğme değerini aileye yazar (kapsam ve zarf kuralı) */
  private writeKnob(k: EngineKnob, value: KnobValue, phase: 'input' | 'change', edit: Edit, drag = false): void {
    const fam = this.activeFamily();
    if (!fam || this.s.phase === 'start') return;
    const ctx = this.ctx();
    if (!k.range(ctx)) {
      this.notify(`${k.label} bu motorda yok.`);
      return;
    }
    let v = clampEngineKnob(k, value, ctx);
    let clipped = false;
    this.commit(
      edit,
      phase,
      (p) => {
        const f = this.activeFamily(p)!;
        const variant = f.variants.find((x) => x.id === f.active)!;
        if (k.scope === 'variant' && f.variants.length > 1) {
          const env = f.envelope[k.id];
          if (env && typeof v === 'number') {
            const c = Math.min(env[1], Math.max(env[0], v));
            clipped = c !== v;
            v = c;
          }
          if (sameValue(k.get(f.base), v)) delete variant.values[k.id];
          else variant.values[k.id] = v;
        } else {
          f.base = k.set(f.base, v);
          // Tek varyantta: varyantta kalmış değer tabanı ezmesin; zarf tabanla birlikte kayar
          if (f.variants.length === 1) {
            delete variant.values[k.id];
            f.envelope = {};
          }
        }
      },
      { drag },
    );
    if (clipped) this.notify('Bu fark yeni bir aile ister: "Aileyi çoğalt".');
  }

  /* ------------------------------------------------------------------ */
  /* Başlangıç                                                           */
  /* ------------------------------------------------------------------ */

  /** Yeni aile nesnesi (projeye eklemeden) */
  private makeFamily(p: WorkshopProject, g: EngineGraph, origin: EngineFamily['origin']): EngineFamily {
    const code = nextFamilyCode(p);
    const base = familyBase(g);
    const t = deriveTraits(base);
    base.name = `${code} ${familyLabel(t)}`;
    const vid = newDocId('v_');
    const f: EngineFamily = {
      id: newDocId('f_'),
      code,
      name: base.name,
      base,
      envelope: {},
      variants: [{ id: vid, name: code, nameLocked: false, values: {} }],
      active: vid,
      origin,
    };
    this.initialBase.set(f.id, clone(base));
    this.extras.set(f.id, { meta: { created: new Date().toISOString(), modified: new Date().toISOString() } });
    return f;
  }

  /** Aileyi ekler (8 sınırı: en eski etkin olmayan aile çıkar) */
  private addFamily(p: WorkshopProject, f: EngineFamily): string | null {
    let dropped: string | null = null;
    if (p.families.length >= MAX_FAMILIES) {
      const i = p.families.findIndex((x) => x.id !== p.activeFamily);
      const id = p.families[i].id;
      dropped = p.families[i].code;
      this.extras.delete(id);
      this.lastGood.delete(id);
      p.families.splice(i, 1);
    }
    p.families.push(f);
    p.activeFamily = f.id;
    return dropped;
  }

  /** Başlangıç ya da sihirbazdan düzenlemeye geçiş: önceki proje yoksa geçmiş temizlenir */
  private enterEdit(): void {
    this.set({ phase: 'edit', wizard: null, selected: null, dragging: null });
  }

  startFromTemplate(id: TemplateId): void {
    const tmpl = TEMPLATES[id];
    if (!tmpl) {
      this.notify('Bu şablon henüz yok.');
      return;
    }
    const fresh = this.s.project.families.length === 0;
    let dropped: string | null = null;
    const mutate = (p: WorkshopProject) => {
      dropped = this.addFamily(p, this.makeFamily(p, tmpl, { from: 'template', template: id }));
    };
    this.enterEdit();
    if (fresh) {
      this.history.clear();
      const p = clone(this.s.project);
      mutate(p);
      this.s = { ...this.s, project: p };
      this.recompute('change');
      this.autosave();
    } else {
      this.commit({ t: 'family', op: 'new', id: String(id) }, 'change', mutate);
    }
    if (this.s.last) this.set({ compare: this.s.last.summary });
    if (dropped) this.notify(`En çok ${MAX_FAMILIES} aile: ${dropped} kapatıldı.`);
  }

  startWizard(): void {
    this.set({ phase: 'wizard', wizard: { arch: { ...WIZARD_DEFAULT_ARCH }, target: { thrust: 50e3 }, blocked: null }, selected: null });
    this.previewWizard();
  }

  /** Sihirbazın canlı önizlemesi: mimariden grafik, hedef çıktıdan hava akışı */
  private previewWizard(): void {
    const w = this.s.wizard;
    if (!w) return;
    let g: EngineGraph;
    try {
      const code = nextFamilyCode(this.s.project);
      g = this.deps.graphFromArchitecture(w.arch, { massFlow: this.s.graph?.massFlow ?? 50, name: code });
      g = { ...g, massFlow: this.deps.solveMassFlow(g, w.target) };
      g.name = `${code} ${familyLabel(deriveTraits(g))}`;
    } catch (e) {
      this.set({ error: this.safeTranslate(e) });
      return;
    }
    const r = this.safeEvaluate(g, { reference: referenceBuilt(templateFor(deriveTraits(g))) });
    if ('error' in r) {
      this.set({ graph: g, error: r.error });
      return;
    }
    this.set({ graph: g, last: r, lastFor: null, error: null, compare: r.summary });
    this.publish('change');
  }

  wizardChoose(axis: keyof Architecture | 'output', value: unknown): void {
    const w = this.s.wizard;
    if (!w) return;
    let r: ArchChange;
    try {
      r = this.deps.resolveChange(w.arch, axis, value);
    } catch (e) {
      this.set({ error: this.safeTranslate(e) });
      return;
    }
    if ('blocked' in r) {
      this.set({ wizard: { ...w, blocked: r.blocked } });
      this.notify(r.blocked);
      return;
    }
    // Mil çıkışında hedef güç, itkide hedef itki
    const target = r.arch.output === 'shaft' || r.arch.lpLoad === 'propeller' ? { shaftPower: w.target.shaftPower ?? 1.2e6 } : { thrust: w.target.thrust ?? 50e3 };
    this.set({ wizard: { arch: r.arch, target, blocked: null } });
    this.previewWizard();
  }

  wizardSize(target: { thrust?: number; shaftPower?: number }): void {
    const w = this.s.wizard;
    if (!w) return;
    this.set({ wizard: { ...w, target: { ...target } } });
    this.previewWizard();
  }

  wizardFinish(): void {
    const w = this.s.wizard;
    if (!w) return;
    if (this.s.error || !this.s.last) {
      this.notify('Önce geçerli bir tasarım seç: sihirbazın son adımı kurulamadı.');
      return;
    }
    const g = this.s.last.graph;
    const fresh = this.s.project.families.length === 0;
    const mutate = (p: WorkshopProject) => {
      const f = this.makeFamily(p, g, { from: 'wizard', template: templateFor(deriveTraits(g)) });
      this.addFamily(p, f);
    };
    this.enterEdit();
    if (fresh) {
      this.history.clear();
      const p = clone(this.s.project);
      mutate(p);
      this.s = { ...this.s, project: p };
      this.recompute('change');
      this.autosave();
    } else {
      this.commit({ t: 'family', op: 'new', id: 'wizard' }, 'change', mutate);
    }
    if (this.s.last) this.set({ compare: this.s.last.summary });
  }

  /** Otomatik kayıttan; kayıt yoksa ya da okunamazsa false */
  resume(): boolean {
    let json: string | null = null;
    try {
      json = this.storage?.getItem(WORKSHOP_STORAGE_KEY) ?? null;
    } catch {
      return false;
    }
    if (!json) return false;
    let loaded: ReturnType<typeof projectFromDoc>;
    try {
      const r = parseProjectDoc(json);
      if (!r.doc || r.errors.length) return false;
      loaded = projectFromDoc(r.doc);
    } catch {
      // Bozuk kayıt atölyeyi çökertmez: boş başlangıç
      return false;
    }
    this.loadProject(loaded.project, loaded.extras);
    this.history.clear();
    this.enterEdit();
    this.recompute('change');
    if (this.s.last) this.set({ compare: this.s.last.summary });
    return true;
  }

  /** Belgeden gelen projeyi bellek durumuna koyar: aile başına eski durum atılır (kimlikler çakışabilir) */
  private loadProject(project: WorkshopProject, extras: Map<string, DocExtras>): void {
    this.extras = extras;
    this.lastGood.clear();
    this.initialBase.clear();
    this.s = { ...this.s, project, lastFor: null };
  }

  /** Otomatik kayıt var mı (başlangıç ekranının "Devam et" düğmesi) */
  hasSaved(): boolean {
    try {
      return !!this.storage?.getItem(WORKSHOP_STORAGE_KEY);
    } catch {
      return false;
    }
  }

  /**
   * Otomatik kayıt: kurulamayan ailenin yerine son geçerli hali yazılır
   * (§2.13 "son geçerli"); hiç kurulamamış aile olduğu gibi yazılır.
   */
  private autosave(): void {
    if (!this.storage || !this.s.project.families.length) return;
    try {
      const p = this.s.project;
      const saved = { ...p, families: p.families.map((f) => this.lastGood.get(f.id)?.family ?? f) };
      this.storage.setItem(WORKSHOP_STORAGE_KEY, serializeProjectDoc(projectToDoc(saved, this.extras)));
    } catch {
      // Kota ya da gizli kip: otomatik kayıt yalnız kolaylık
    }
  }

  /* ------------------------------------------------------------------ */
  /* Düzenleme                                                           */
  /* ------------------------------------------------------------------ */

  /** Edit kaydını uygular (geri al yığınına girer; input aşaması birleşir) */
  apply(e: Edit, phase: 'input' | 'change' = 'change'): void {
    switch (e.t) {
      case 'knob':
        return this.setKnob(e.id as KnobId, e.value, phase);
      case 'arch':
        return this.setArchitecture(e.option as keyof Architecture, e.value);
      case 'handle':
        if (phase === 'input') return this.dragHandle(e.id as HandleId, e.target, 'move');
        this.dragHandle(e.id as HandleId, e.target, 'move');
        return this.dragHandle(e.id as HandleId, e.target, 'end');
      case 'variant':
        if (e.op === 'add' || e.op === 'dup') return this.addVariant();
        if (e.op === 'remove') return this.removeVariant(e.id);
        if (e.op === 'rename') return this.setName(e.name ?? '');
        return this.selectVariant(e.id);
      case 'family':
        if (e.op === 'select') return this.selectFamily(e.id);
        if (e.op === 'rename') return this.renameFamily(e.name ?? '');
        if (e.op === 'new' && TEMPLATES[e.id as TemplateId]) return this.startFromTemplate(e.id as TemplateId);
        return;
    }
  }

  setKnob(id: KnobId, v: KnobValue, phase: 'input' | 'change'): void {
    const k = knobById(id);
    if (!k) {
      this.notify(`Bilinmeyen düğme: ${id}`);
      return;
    }
    // Kaydırıcıyı bırakınca gelen 'change' aynı hareketin sonu: kıyas noktası değişmez
    this.gestureStart(phase === 'input' || this.s.dragging === k.id ? (k.id as KnobId) : null);
    this.set({ dragging: phase === 'input' ? (k.id as KnobId) : null });
    const fam = this.activeFamily();
    this.writeKnob(k, v, phase, { t: 'knob', id: k.id, value: v, ...(fam ? { variant: fam.active } : {}) }, phase === 'input');
  }

  /** Mimari değişimi yeni aile açar; eski aile listede kalır */
  setArchitecture(axis: keyof Architecture, value: unknown): void {
    const fam = this.activeFamily();
    if (!fam || this.s.phase === 'start') return;
    let next: EngineGraph;
    let implied: string[] = [];
    // Tohum etkin varyantın grafiği (geçersiz olsa da); `last` başka aileden olabilir
    const seed = this.s.graph;
    try {
      const a = this.deps.architectureOf(seed);
      const r = this.deps.resolveChange(a, axis, value);
      if ('blocked' in r) {
        this.notify(r.blocked);
        return;
      }
      implied = r.implied.map((x) => x.reason).filter(Boolean);
      next = this.deps.applyArchitecture(seed, r.arch);
    } catch (e) {
      this.set({ error: this.safeTranslate(e) });
      return;
    }
    const oldCode = fam.code;
    let code = '';
    let dropped: string | null = null;
    this.commit({ t: 'arch', option: String(axis), value: value as string | boolean }, 'change', (p) => {
      const f = this.makeFamily(p, next, { from: fam.origin.from, template: templateFor(deriveTraits(next)) });
      code = f.code;
      dropped = this.addFamily(p, f);
    });
    this.set({ selected: null });
    const extra = implied.length ? ` (${implied.join('; ')})` : '';
    this.notify(`Yeni aile ${code} açıldı; ${oldCode} duruyor.${extra}${dropped ? ` ${dropped} kapatıldı.` : ''}`);
  }

  dragHandle(id: HandleId, target: number, phase: 'start' | 'move' | 'end'): void {
    // Ters çözüm `last`'tan: başka aileden ya da şablondan kalmışsa yazılmaz
    if (!this.s.last || this.s.phase !== 'edit' || !this.ownsLast()) return;
    if (phase === 'start' || this.s.dragging !== id) {
      this.gestureStart(id);
      this.history.seal();
      this.dragSpecs = new Map(this.handles().map((h) => [h.id, { range: h.range, snaps: h.snaps, blocked: h.blocked }]));
      this.set({ dragging: id });
      if (phase === 'start') return;
    }
    const ctx = this.ctx();
    const def = handleFor(id, ctx);
    const blocked = this.dragSpecs?.get(id)?.blocked ?? null;
    if (!def || blocked) {
      if (blocked) this.notify(blocked);
      if (phase === 'end') this.endDrag();
      return;
    }
    const k = knobById(def.coupled)!;
    let v: KnobValue | undefined;
    try {
      v = k.get(def.solve(this.s.last.graph, this.s.last.built, target).model);
    } catch (e) {
      this.set({ error: this.safeTranslate(e) });
    }
    if (v !== undefined) this.writeKnob(k, v, phase === 'end' ? 'change' : 'input', { t: 'handle', id, target }, phase !== 'end');
    if (phase === 'end') this.endDrag();
  }

  private endDrag(): void {
    this.history.seal();
    this.dragSpecs = null;
    this.set({ dragging: null });
  }

  /** Etkin varyantın adı (elle verilince kilitlenir) */
  setName(name: string): void {
    const fam = this.activeFamily();
    if (!fam) return;
    const n = name.trim();
    this.commit({ t: 'variant', op: 'rename', id: fam.active, name: n }, 'change', (p) => {
      const v = this.activeFamily(p)!.variants.find((x) => x.id === fam.active)!;
      v.name = n || fam.code;
      v.nameLocked = n.length > 0;
    });
  }

  /** Ailenin adı */
  renameFamily(name: string): void {
    const fam = this.activeFamily();
    if (!fam || !name.trim()) return;
    this.commit({ t: 'family', op: 'rename', id: fam.id, name: name.trim() }, 'change', (p) => {
      this.activeFamily(p)!.name = name.trim();
    });
  }

  select(m: ModuleRef | null): void {
    if (this.s.selected !== m) this.set({ selected: m });
  }

  setExpert(on: boolean): void {
    if (this.s.project.expert === on) return;
    this.set({ project: { ...this.s.project, expert: on } });
    this.autosave();
  }

  /** Görev kartı (null: görev yok) */
  setGoal(id: string | null): void {
    const goal = id ? goalById(id) : undefined;
    const project = { ...this.s.project };
    if (goal) project.goal = goal;
    else delete project.goal;
    this.set({ project });
    // Görevin zarfı uyarı listesine girer (envelope): yeniden değerlendir
    if (this.activeFamily()) this.recompute('change');
    this.autosave();
  }

  /** Test hücresine geçiş ve dönüş (App.runWorkshopDesign / openWorkshop) */
  setTesting(on: boolean): void {
    if (this.s.phase === 'start' || this.s.phase === 'wizard') return;
    this.set({ phase: on ? 'testing' : 'edit' });
  }

  addVariant(): void {
    const fam = this.activeFamily();
    if (!fam) return;
    if (fam.variants.length >= MAX_VARIANTS) {
      this.notify(`Bir ailede en çok ${MAX_VARIANTS} varyant olur.`);
      return;
    }
    const vid = newDocId('v_');
    this.commit({ t: 'variant', op: 'add', id: vid }, 'change', (p) => {
      const f = this.activeFamily(p)!;
      const cur = f.variants.find((x) => x.id === f.active)!;
      if (f.variants.length === 1 && !Object.keys(f.envelope).length) f.envelope = defaultEnvelope(f.base, this.ctx(f.base));
      f.variants.push({ id: vid, name: cur.name, nameLocked: false, values: { ...cur.values } });
      f.active = vid;
    });
  }

  removeVariant(id: string): void {
    const fam = this.activeFamily();
    if (!fam || fam.variants.length <= 1 || !fam.variants.some((v) => v.id === id)) return;
    this.commit({ t: 'variant', op: 'remove', id }, 'change', (p) => {
      const f = this.activeFamily(p)!;
      f.variants = f.variants.filter((v) => v.id !== id);
      if (f.active === id) f.active = f.variants[0].id;
      // Tek varyanta inildi: kalan varyantın çözülmüş değerleri tabana katlanır, zarf kalkar
      if (f.variants.length === 1) {
        const v = f.variants[0];
        f.base = { ...resolveFamilyVariant(f, v.id), name: f.base.name };
        v.values = {};
        f.envelope = {};
      }
    });
  }

  selectVariant(id: string): void {
    const fam = this.activeFamily();
    if (!fam || fam.active === id || !fam.variants.some((v) => v.id === id)) return;
    this.commit({ t: 'variant', op: 'select', id }, 'change', (p) => {
      this.activeFamily(p)!.active = id;
    });
  }

  selectFamily(id: string): void {
    if (this.s.project.activeFamily === id || !this.s.project.families.some((f) => f.id === id)) return;
    this.commit({ t: 'family', op: 'select', id }, 'change', (p) => {
      p.activeFamily = id;
    });
    this.set({ selected: null });
  }

  /** Etkin tasarımı kıyas noktası olarak sabitler (delta çipleri ona göre) */
  pinBaseline(): void {
    const fam = this.activeFamily();
    if (!fam || !this.ownsLast()) return;
    this.set({
      project: { ...this.s.project, baseline: { familyId: fam.id, variantId: fam.active, graph: clone(this.s.last.graph) } },
      compare: this.s.last.summary,
    });
  }

  /** Kıyas sabitini kaldırır */
  unpinBaseline(): void {
    if (!this.s.project.baseline) return;
    const project = { ...this.s.project };
    delete project.baseline;
    this.set({ project });
  }

  /** Uyarının "Düzelt" önerisi: bağlı düğmeyi önerilen değere getirir */
  applyRemedy(f: Finding): void {
    if (!f.remedy) return;
    this.setKnob(f.remedy.knob as KnobId, f.remedy.value, 'change');
  }

  /**
   * Etkin ailenin son geçerli haline dön (hata durumunda). Aile hiç
   * kurulamadıysa (bozuk içe aktarma, eski kayıt) başlangıç değerlerine.
   */
  revertToLastGood(): void {
    const fam = this.activeFamily();
    if (!fam || !this.s.error) return;
    const good = this.lastGood.get(fam.id);
    if (!good) {
      this.resetToTemplate();
      return;
    }
    this.commit({ t: 'family', op: 'select', id: fam.id }, 'change', (p) => {
      const i = p.families.findIndex((f) => f.id === fam.id);
      if (i >= 0) p.families[i] = clone(good.family);
    });
  }

  /** Etkin aileyi başlangıç tabanına döndürür (şablon ya da sihirbaz çıktısı) */
  resetToTemplate(): void {
    const fam = this.activeFamily();
    if (!fam) return;
    const tid = fam.origin.template as TemplateId | undefined;
    const init = this.initialBase.get(fam.id) ?? (fam.origin.from === 'template' && tid ? this.templateBaseFor(fam, tid) : undefined);
    if (!init) {
      this.notify('Bu ailenin başlangıç değerleri bilinmiyor.');
      return;
    }
    this.commit({ t: 'family', op: 'select', id: fam.id }, 'change', (p) => {
      const f = this.activeFamily(p)!;
      f.base = { ...clone(init), name: f.base.name };
      f.envelope = {};
      for (const v of f.variants) v.values = {};
    });
  }

  /**
   * Şablonun tabanı, ailenin mimarisinde (sayfa yenilenince ilk taban
   * bellekte yok). Mimari değişimiyle açılan aile şablondan farklı mimaride
   * olabilir: şablona ailenin mimarisi uygulanır; uygulanamazsa undefined
   * (mimari sessizce geri alınmaz).
   */
  private templateBaseFor(fam: EngineFamily, tid: TemplateId): EngineGraph | undefined {
    const t = TEMPLATES[existingTemplate(tid)];
    if (!t) return undefined;
    const base = familyBase(t);
    try {
      const key = (g: EngineGraph) => JSON.stringify(this.deps.architectureOf(g));
      const want = this.deps.architectureOf(fam.base);
      if (key(base) === JSON.stringify(want)) return base;
      const g = familyBase(this.deps.applyArchitecture(base, want));
      return key(g) === JSON.stringify(want) ? g : undefined;
    } catch {
      return undefined;
    }
  }

  undo(): void {
    const prev = this.history.undo(this.snap());
    if (!prev) return;
    this.restore(prev);
  }

  redo(): void {
    const next = this.history.redo(this.snap());
    if (!next) return;
    this.restore(next);
  }

  private restore(s: Snap): void {
    this.s = { ...this.s, project: clone(s.project), selected: s.selected, dragging: null };
    this.recompute('change');
    this.set({});
    this.autosave();
  }

  /* ------------------------------------------------------------------ */
  /* Tutamaçlar, çözülebilirlik, duyarlılık                              */
  /* ------------------------------------------------------------------ */

  /** Etkin motorun tutamaçları, dünya konumlarıyla. Sınırlar sürüklerken sabit kalır. */
  handles(): HandleSpec[] {
    const last = this.s.last;
    if (!last || this.s.phase === 'start' || !this.ownsLast()) return [];
    const g = last.graph;
    const b = last.built;
    const out: HandleSpec[] = [];
    for (const def of handlesFor(this.ctx(g))) {
      let a: { z: number; r: number } | null = null;
      try {
        a = def.anchor(b);
      } catch {
        a = null;
      }
      if (!a) continue;
      const frozen = this.dragSpecs?.get(def.id);
      let extra: Pick<HandleSpec, 'range' | 'snaps' | 'blocked'>;
      if (frozen) extra = frozen;
      else {
        try {
          extra = { range: def.range(g, b), snaps: def.snaps?.(g, b), blocked: def.blockedReason?.(g, b) ?? null };
        } catch (e) {
          extra = { range: { lo: a.r, hi: a.r }, blocked: this.safeTranslate(e).text };
        }
      }
      out.push({
        id: def.id,
        group: def.group,
        label: def.label,
        axis: def.axis,
        world: [0, a.r, a.z],
        coupled: def.coupled,
        ...extra,
      });
    }
    return out;
  }

  /** Düğmenin çözülebilir aralığı (yasak bölge; boşta çağrılır) */
  feasible(id: KnobId): ReturnType<typeof feasibleRange> | null {
    const k = knobById(id);
    const last = this.s.last;
    if (!k || !last || !this.ownsLast()) return null;
    // Değeri olmayan düğme (ör. düz karıştırıcıda lobe sayısı) ya da bu motorda olmayan düğme: aralık yok
    if (!k.range(this.ctx(last.graph)) || !Number.isFinite(Number(k.get(last.graph)))) return null;
    const opts = this.buildOptions(last.graph);
    return feasibleRange(last.graph, k, this.ctx(last.graph), { build: (g) => buildChecked(g, opts), translate: (e) => this.safeTranslate(e) });
  }

  /** Düğmenin +1 adım etkisi (ipucu) */
  sensitivity(id: KnobId): SummaryDelta[] {
    const k = knobById(id);
    const last = this.s.last;
    if (!k || !last || !this.ownsLast()) return [];
    const opts = this.buildOptions(last.graph);
    try {
      return sensitivity(last.graph, k, this.ctx(last.graph), {
        build: (g) => buildChecked(g, opts),
        summarize: this.deps.summarize,
        diff: this.deps.diffSummary,
      });
    } catch {
      return [];
    }
  }

  /* ------------------------------------------------------------------ */
  /* Belge                                                               */
  /* ------------------------------------------------------------------ */

  exportDoc(): string {
    return serializeProjectDoc(projectToDoc(this.s.project, this.extras));
  }

  /** Atölye belgesi projeyi değiştirir; tek motor belgesi yeni aile olarak eklenir */
  importDoc(json: string): { errors: string[]; notes: string[] } {
    let format: unknown;
    try {
      format = (JSON.parse(json) as { format?: unknown })?.format;
    } catch {
      return { errors: ['Belge okunamadı: geçerli bir JSON değil.'], notes: [] };
    }
    // Ayrıştırma hiçbir girdide atmaz; yine de beklenmedik bozulma atölyeyi çökertmesin
    const fail = (e: unknown) => ({ errors: [`Belge okunamadı: ${e instanceof Error ? e.message : String(e)}`], notes: [] });
    // Boş atölyeye (başlangıç ekranı) içe aktarma geri al yığınına girmez
    const fresh = this.s.project.families.length === 0;
    const write = (edit: Edit, mutate: (p: WorkshopProject) => void) => {
      this.enterEdit();
      if (fresh) {
        this.history.clear();
        const p = clone(this.s.project);
        mutate(p);
        this.s = { ...this.s, project: p };
        this.recompute('change');
        this.autosave();
      } else this.commit(edit, 'change', mutate);
      if (this.s.last) this.set({ compare: this.s.last.summary });
    };
    if (format === 'tfa-engine') {
      let doc: ReturnType<typeof familyFromDoc>;
      let notes: string[];
      try {
        const r = parseDoc(json);
        if (!r.doc || r.errors.length) return { errors: r.errors.length ? r.errors : ['Belge okunamadı.'], notes: r.notes };
        doc = familyFromDoc(r.doc);
        notes = [...r.notes];
      } catch (e) {
        return fail(e);
      }
      const { family, extras } = doc;
      write({ t: 'family', op: 'new', id: family.id }, (p) => {
        const f = family as EngineFamily;
        if (p.families.some((x) => x.id === f.id)) {
          f.id = newDocId('f_');
          notes.push('Aynı kimlikli aile zaten açık: kopya yeni kimlikle eklendi.');
        }
        this.extras.set(f.id, extras);
        // Kimlik başka bir eski aileden kalmış olabilir
        this.lastGood.delete(f.id);
        const dropped = this.addFamily(p, f);
        if (dropped) notes.push(`En çok ${MAX_FAMILIES} aile: ${dropped} kapatıldı.`);
      });
      return { errors: [], notes };
    }
    let loaded: ReturnType<typeof projectFromDoc>;
    let notes: string[];
    try {
      const r = parseProjectDoc(json);
      if (!r.doc || r.errors.length) return { errors: r.errors.length ? r.errors : ['Belge okunamadı.'], notes: r.notes };
      loaded = projectFromDoc(r.doc);
      notes = r.notes;
    } catch (e) {
      return fail(e);
    }
    const { project, extras } = loaded;
    this.loadProject(this.s.project, extras);
    write({ t: 'family', op: 'new', id: project.activeFamily }, (p) => {
      p.families = project.families;
      p.activeFamily = project.activeFamily;
      p.expert = project.expert;
      if (project.goal) p.goal = project.goal;
      else delete p.goal;
      delete p.baseline;
    });
    return { errors: [], notes };
  }
}

/** Tarayıcının localStorage'ı; erişim atarsa (gizli kip, test) null */
function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
