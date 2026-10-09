/**
 * 3B parça etiketi → atölye modülü (M5a, docs/M5A-SPEC.md §6.7). Atölyede
 * bir parçaya tıklamak o modülü seçer; seçili modülün bütün parçaları
 * birlikte vurgulanır.
 *
 * Katman kuralı gereği `PartId` (engine/visual.ts) içe aktarılmaz: aynı
 * dizgeler `PartTag` olarak yinelenir. Ayrışma partsMap.test.ts'teki tip
 * eşitliği denetimiyle derleme anında yakalanır.
 */

import type { ModuleType } from './types';
import type { EngineTraits } from './traits';

export type PartTag =
  | 'spinner'
  | 'inlet'
  | 'fan'
  | 'fanCase'
  | 'nacelle'
  | 'bypassDuct'
  | 'bypassNozzle'
  | 'ogv'
  | 'coreCowl'
  | 'casing'
  | 'booster'
  | 'hpc'
  | 'combustor'
  | 'hpt'
  | 'lpt'
  | 'shafts'
  | 'exhaust'
  | 'gearbox'
  | 'pylon'
  | 'wing'
  | 'afterburner'
  | 'nozzle'
  | 'propeller'
  | 'stand'
  | 'mixer'
  | 'outputShaft'
  | 'engineCase'
  | 'accessories';

/** Seçilebilir modül ya da motorun bütünü */
export type ModuleRef = ModuleType | 'engine';

/** Varsayılan eşleme (kaportalı turbofan adlandırması); mimariye göre düzeltmeler moduleOfPart'ta */
export const PART_MODULE: Record<PartTag, ModuleRef | null> = {
  spinner: 'inlet',
  inlet: 'inlet',
  fan: 'fan',
  ogv: 'fan',
  fanCase: 'fan',
  booster: 'lpc',
  hpc: 'hpc',
  combustor: 'combustor',
  hpt: 'hpt',
  lpt: 'lpt',
  afterburner: 'afterburner',
  nozzle: 'nozzle',
  bypassNozzle: 'nozzle',
  exhaust: 'nozzle',
  propeller: 'propeller',
  gearbox: 'propeller',
  mixer: 'mixer',
  outputShaft: 'shaft',
  engineCase: 'engine',
  accessories: 'engine',
  nacelle: 'engine',
  bypassDuct: 'engine',
  coreCowl: 'engine',
  shafts: 'engine',
  casing: 'engine',
  pylon: null,
  wing: null,
  stand: null,
};

export const PART_TAGS = Object.keys(PART_MODULE) as PartTag[];

/**
 * Parçanın modülü. Mimariye göre: tek akışlı jette ön kompresör 'booster'
 * etiketlidir (→ lpc); fansız motorda fan kasası etiketi gövdedir;
 * pervanesiz motorda dişli kutusu aksesuar kutusudur; pervanelide burun
 * konisi (spinner) pervanenindir.
 */
export function moduleOfPart(p: PartTag, t: EngineTraits): ModuleRef | null {
  switch (p) {
    case 'fanCase':
    case 'ogv':
      return t.lpLoad === 'fan' ? 'fan' : 'engine';
    case 'gearbox':
      return t.lpLoad === 'propeller' ? 'propeller' : 'engine';
    case 'spinner':
      return t.lpLoad === 'propeller' ? 'propeller' : 'inlet';
    case 'fan':
      // Pervaneli/turboşaft gövdesinde 'fan' etiketi yok; eski modellerde ön sıra
      return t.lpLoad === 'fan' ? 'fan' : t.lpLoad === 'lpc' ? 'lpc' : null;
    default:
      return PART_MODULE[p];
  }
}

/** Modülün 3B parçaları (seçimde birlikte vurgulanır) */
export function partsOfModule(m: ModuleRef, t: EngineTraits): PartTag[] {
  return PART_TAGS.filter((p) => moduleOfPart(p, t) === m);
}
