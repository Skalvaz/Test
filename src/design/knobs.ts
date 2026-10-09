/**
 * Motor düğme kataloğu (M5a, docs/M5A-SPEC.md §2.10). Kimlik biçimi
 * `<modül>.<alan>[.<alt>]`; motor düzeyi `engine.*`, baypas kanalı
 * `bypassDuct.*`. Modül tipi grafikte tekil olduğu için adres dizi sırasına
 * bağlı değil. Kimlikler belgeye yazılır: ASLA yeniden adlandırılmaz
 * (gerekirse KNOB_ALIASES).
 *
 * P0: kimlik listesi (sözleşme), tipler ve imzalar. Düğme tanımlarını
 * (aralık, adım, metin, get/set) ve gövdeleri P4b yazar; ENGINE_KNOBS'un
 * kimlikleri KNOB_IDS ile birebir olmalı (P4b testi).
 */

import type { Architecture } from './architecture';
import type { Family } from './core/family';
import type { KnobDef } from './core/knob';
import type { SummaryDelta } from './summary';
import type { TechLimits } from './tech';
import type { EngineTraits } from './traits';
import type { EngineGraph } from './types';
import type { TeachingError } from './warnings';

export interface KnobCtx {
  arch: Architecture;
  traits: EngineTraits;
  tech: TechLimits;
  family?: Family<EngineGraph, Architecture>;
}

export type EngineKnob = KnobDef<EngineGraph, KnobCtx>;

/** Ortak kanal düğmeleri (kompresör ve türbin sıraları) */
const annulus = <M extends string>(m: M) =>
  [
    `${m}.eff`,
    `${m}.mach.0`,
    `${m}.mach.1`,
    `${m}.hubTip`,
    `${m}.taper`,
    `${m}.loading`,
    `${m}.pitchSpan`,
    `${m}.bladeK.0`,
    `${m}.bladeK.1`,
  ] as const;

/** Bütün düğme kimlikleri: temel (B) ve uzman (E) tabloları */
export const KNOB_IDS = [
  // Temel
  'engine.massFlow',
  'fan.pr',
  'fan.bypassRatio',
  'fan.tipSpeed',
  'lpc.pr',
  'lpc.tipSpeed',
  'hpc.pr',
  'hpc.centrifugal.workFraction',
  'combustor.tit',
  'combustor.cans',
  'mixer.lobes',
  'afterburner.t7Max',
  'nozzle.chevrons.core',
  'nozzle.chevrons.bypass',
  'propeller.diameter',
  'propeller.blades',
  'propeller.rpm',
  'shaft.rpm',
  // Uzman: motor
  'engine.accessoryPower',
  'engine.mechEff',
  'bypassDuct.dp',
  'bypassDuct.mach',
  // Giriş
  'inlet.length',
  'inlet.noseLength',
  'inlet.struts',
  // Kompresörler (fan.hubTip M5a'da gizli: model fan göbeğini göstermez)
  ...annulus('fan'),
  'fan.hubPRFraction',
  ...annulus('lpc'),
  'lpc.gap',
  'lpc.vsv',
  ...annulus('hpc'),
  'hpc.gap',
  'hpc.vsv',
  'hpc.tipSpeed',
  'hpc.centrifugal.loading',
  'hpc.centrifugal.diffuserRatio',
  'hpc.centrifugal.gap',
  // Yanma odası
  'combustor.refVelocity',
  'combustor.lengthHeight',
  'combustor.dp',
  'combustor.eff',
  'combustor.injectors',
  'combustor.meanShift',
  'combustor.gap',
  // Türbinler
  ...annulus('hpt'),
  'hpt.gap',
  ...annulus('lpt'),
  'lpt.gap',
  'lpt.tipSpeed',
  // Karıştırıcı, art yakıcı, lüle
  'mixer.loss',
  'afterburner.mach',
  'afterburner.lengthDiameter',
  'afterburner.eta',
  'afterburner.dpDry',
  'afterburner.dpLit',
  'nozzle.cv',
  'nozzle.flaps',
  'nozzle.exitMach',
  'nozzle.pressureRatio',
  // Pervane ve çıkış mili
  'propeller.figureOfMerit',
  'propeller.efficiency',
  'propeller.gearboxLength',
  'shaft.transmissionEff',
  'shaft.gearboxLength',
] as const;

export type KnobId = (typeof KNOB_IDS)[number];

/** Düğme tanımları (P4b doldurur) */
export const ENGINE_KNOBS: readonly EngineKnob[] = [];

/** Eski kimlik → güncel kimlik (M5a'da boş) */
export const KNOB_ALIASES: Record<string, KnobId> = {};

/** Çözülebilir aralık: [lo,hi] içinde build'in başarılı olduğu bölge (12 adımlı ikiye bölme × 2 uç) */
export function feasibleRange(
  _g: EngineGraph,
  _k: EngineKnob,
  _ctx: KnobCtx,
): { lo: number; hi: number; loReason?: TeachingError; hiReason?: TeachingError } {
  throw new Error('P4b: çözülebilir aralık henüz yok.');
}

/** +1 adımın etkisi (ipucu): sonlu fark */
export function sensitivity(_g: EngineGraph, _k: EngineKnob, _ctx: KnobCtx): SummaryDelta[] {
  throw new Error('P4b: duyarlılık henüz yok.');
}
