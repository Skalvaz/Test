/**
 * Motor kartı (Faz 4 temeli, arayüzü M5c): uçak tasarımcısının motor
 * hakkında bildiği her şey. Kural (kalıcı): Faz 4 yalnız `EngineCard` okur;
 * kartı gömülü kopya + `rev` ile saklar (docs/M5A-SPEC.md §2.15).
 *
 * P0: tipler ve imza. `buildEngineCard` gövdesini P4b yazar.
 */

import type { EngineKind } from '../sim/design';
import type { EngineDocV1 } from './engineDoc';
import type { BuiltEngine } from './graph';

/** Gövdeye bağlantı noktası (yerleşimler `mounts` alanında taşır) */
export interface MountPoint {
  id: 'front' | 'rear' | 'thrust' | 'output';
  z: number;
  r: number;
  /** rad, 0 = +Y (üst) */
  angle: number;
  type: 'pylon' | 'trunnion' | 'flange' | 'gearbox';
}

export interface RatingPoint {
  thrust: number;
  shaftPower?: number;
  fuelFlow: number;
  tsfc: number;
  airflow: number;
  egt: number;
}

export interface EngineCard {
  format: 'tfa-engine-card';
  v: 1;
  ref: { familyId: string; variantId: string; rev: string; family: string; variant: string };
  presentation: EngineKind;
  archKey: string;
  output: 'thrust' | 'propeller' | 'shaft';
  afterburner: boolean;
  bypassRatio: number;
  dims: {
    length: number;
    maxRadius: number;
    intake: { z: number; radius: number; y: number };
    exhaust: { z: number; radius: number };
    /** Dış zarf [z, r], z artan */
    envelope: [number, number][];
    propDiameter?: number;
    outputShaft?: { z: number; radius: number; rpm: number; drive: 'front' | 'rear' };
  };
  mass: { dry: number; cgZ: number };
  mounts: MountPoint[];
  ratings: { takeoff: RatingPoint; maxAB?: RatingPoint };
  spools: { lpRpm: number; hpRpm: number };
  installation: { bleedMax: number; powerOfftake: number };
  /** M5c */
  deck?: unknown;
  noise?: unknown;
  emissions?: unknown;
  cost?: unknown;
  life?: unknown;
}

export function buildEngineCard(_doc: EngineDocV1, _variantId: string, _b: BuiltEngine): EngineCard {
  throw new Error('P4b: motor kartı henüz yok.');
}
