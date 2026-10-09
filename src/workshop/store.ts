/**
 * Atölye durumu (M5a, docs/M5A-SPEC.md §2.13): saf TS mağaza. 3B ve
 * simülasyona dokunan tek nokta `onBuilt`'tir; App bunu
 * `applyDesign('workshop', …)` ile bağlar.
 *
 * Kurallar:
 *  - Beklenen hatalar (GraphError | FlowpathError | DesignError, NaN/∞)
 *    yakalanır, `state.error`'a yazılır; ASLA console.error çağrılmaz
 *    (oynanış testi konsol hatasını başarısızlık sayar).
 *  - Otomatik kayıt: localStorage['turbofan-akademi:workshop:v1'] =
 *    WorkshopProjectDocV1 (try/catch; okunamazsa sessizce boş başlar).
 *  - Mimari değişimi yeni aile açar; eski aile listede kalır.
 *
 * P0: imzalar (gövdeler `throw new Error('P4b')`). Gövdeleri P4b yazar.
 */

import type { Architecture } from '../design/architecture';
import type { Edit } from '../design/core/edit';
import type { KnobValue } from '../design/core/knob';
import type { Finding } from '../design/core/rules';
import type { Evaluation } from '../design/evaluate';
import type { BuiltEngine } from '../design/graph';
import type { KnobId } from '../design/knobs';
import type { DesignSummary } from '../design/summary';
import type { EngineGraph } from '../design/types';
import type { TeachingError } from '../design/warnings';
import type { HandleId, ModuleRef, TemplateId, WorkshopProject } from './project';

/** Otomatik kayıt anahtarı */
export const WORKSHOP_STORAGE_KEY = 'turbofan-akademi:workshop:v1';

export interface WorkshopState {
  project: WorkshopProject;
  /** Çözülmüş etkin varyant (geçersiz olabilir) */
  graph: EngineGraph;
  /** Son geçerli değerlendirme */
  last: Evaluation;
  error: TeachingError | null;
  selected: ModuleRef | null;
  /** Delta çiplerinin kıyas noktası */
  compare: DesignSummary;
  phase: 'start' | 'wizard' | 'edit' | 'testing';
  dragging: HandleId | KnobId | null;
  canUndo: boolean;
  canRedo: boolean;
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

export interface WorkshopStoreOptions {
  onBuilt(b: BuiltEngine, detail: 'draft' | 'full'): void;
  now?: () => number;
  storage?: Storage | null;
}

const todo = (): never => {
  throw new Error('P4b: atölye mağazası henüz yok.');
};

export class WorkshopStore {
  constructor(readonly opts: WorkshopStoreOptions) {}

  get state(): Readonly<WorkshopState> {
    return todo();
  }

  subscribe(_fn: (s: WorkshopState) => void): () => void {
    return todo();
  }

  // --- başlangıç ---
  startFromTemplate(_id: TemplateId): void {
    todo();
  }
  startWizard(): void {
    todo();
  }
  wizardChoose(_axis: keyof Architecture | 'output', _value: unknown): void {
    todo();
  }
  wizardSize(_target: { thrust?: number; shaftPower?: number }): void {
    todo();
  }
  wizardFinish(): void {
    todo();
  }
  /** Otomatik kayıttan */
  resume(): boolean {
    return todo();
  }

  // --- düzenleme (her biri Edit üretir, geri al yığınına girer; input aşaması birleşir) ---
  apply(_e: Edit, _phase?: 'input' | 'change'): void {
    todo();
  }
  setKnob(_id: KnobId, _v: KnobValue, _phase: 'input' | 'change'): void {
    todo();
  }
  /** Yeni aile açar */
  setArchitecture(_axis: keyof Architecture, _value: unknown): void {
    todo();
  }
  dragHandle(_id: HandleId, _target: number, _phase: 'start' | 'move' | 'end'): void {
    todo();
  }
  setName(_name: string): void {
    todo();
  }
  select(_m: ModuleRef | null): void {
    todo();
  }
  setExpert(_on: boolean): void {
    todo();
  }
  addVariant(): void {
    todo();
  }
  selectVariant(_id: string): void {
    todo();
  }
  selectFamily(_id: string): void {
    todo();
  }
  pinBaseline(): void {
    todo();
  }
  applyRemedy(_f: Finding): void {
    todo();
  }
  revertToLastGood(): void {
    todo();
  }
  resetToTemplate(): void {
    todo();
  }
  /** Son 30 Edit, bellekte */
  undo(): void {
    todo();
  }
  redo(): void {
    todo();
  }
  /** Dünya konumlarıyla */
  handles(): HandleSpec[] {
    return todo();
  }
  exportDoc(): string {
    return todo();
  }
  importDoc(_json: string): { errors: string[]; notes: string[] } {
    return todo();
  }
}
