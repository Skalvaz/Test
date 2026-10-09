/**
 * Atölye arayüzünün `data-*` seçici sözleşmesi (docs/M5A-SPEC.md §6, §8).
 * Arayüz (P10) öğeleri bu adlarla etiketler; oynanış testi (P11) bu
 * seçicilerle bulur. Ad değişikliği yalnız bu dosyada ve sözleşme
 * commit'iyle.
 */

import type { Architecture } from '../../design/architecture';
import type { KnobId } from '../../design/knobs';
import type { ModuleRef, TemplateId } from '../../workshop/project';

/** Öznitelik adları */
export const ATTR = {
  menu: 'data-menu',
  start: 'data-start',
  action: 'data-action',
  template: 'data-template',
  arch: 'data-arch',
  wizardStep: 'data-wizard-step',
  knob: 'data-knob',
  expert: 'data-expert',
  module: 'data-module',
  gauge: 'data-gauge',
  warning: 'data-warning',
  severity: 'data-severity',
  goal: 'data-goal',
  error: 'data-error',
  field: 'data-field',
  kind: 'data-kind',
} as const;

/** `data-action` değerleri */
export const ACTIONS = [
  // Başlangıç ve sihirbaz
  'resume',
  'start-scratch',
  'new-from-template',
  'wizard-next',
  'wizard-finish',
  'coach-skip',
  // Düzenleme
  'expert',
  'pin-baseline',
  'revert',
  // Uyarı eylemleri
  'show-part',
  'glossary',
  'lesson',
  'remedy',
  // Test hücresi
  'run-in-cell',
  'back-to-workshop',
] as const;
export type WorkshopAction = (typeof ACTIONS)[number];

/** Sihirbazın sahte düğmesi: hedef itki (kN) ya da mil gücü (kW) */
export const TARGET_OUTPUT_KNOB = 'engine.targetOutput';

/** `data-field` değerleri */
export const FIELDS = ['name'] as const;
export type WorkshopField = (typeof FIELDS)[number];

/** Menüdeki atölye girişi ve test hücresi motor listesindeki atölye düğmesi */
export const WORKSHOP_MENU = 'workshop';
export const WORKSHOP_KIND = 'workshop';

const q = (name: string, value?: string) => (value === undefined ? `[${name}]` : `[${name}="${value}"]`);

/** Hazır CSS seçicileri (P10 öğeleri, P11 testleri) */
export const sel = {
  menu: (v = WORKSHOP_MENU) => `.menu-item${q(ATTR.menu, v)}`,
  start: () => q(ATTR.start),
  action: (a: WorkshopAction) => q(ATTR.action, a),
  template: (id: TemplateId) => q(ATTR.template, id),
  arch: <K extends keyof Architecture | 'output'>(axis: K, value: string | boolean) => q(ATTR.arch, `${axis}:${value}`),
  wizardStep: (n?: number) => q(ATTR.wizardStep, n === undefined ? undefined : String(n)),
  knob: (id: KnobId | typeof TARGET_OUTPUT_KNOB) => q(ATTR.knob, id),
  knobInput: (id: KnobId | typeof TARGET_OUTPUT_KNOB) => `${q(ATTR.knob, id)} input`,
  expert: () => q(ATTR.expert),
  module: (m: ModuleRef) => q(ATTR.module, m),
  gauge: (id?: string) => q(ATTR.gauge, id),
  warning: (id?: string) => q(ATTR.warning, id),
  warningsOf: (severity: 'info' | 'caution' | 'warning') => `${q(ATTR.warning)}${q(ATTR.severity, severity)}`,
  goal: (id?: string) => q(ATTR.goal, id),
  error: () => q(ATTR.error),
  field: (f: WorkshopField) => q(ATTR.field, f),
  workshopEngine: () => q(ATTR.kind, WORKSHOP_KIND),
} as const;
