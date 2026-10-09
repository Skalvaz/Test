/**
 * Görsel model kayıt defteri (M5a): yerleşim stili → prosedürel 3B model
 * üreticisi. Görsel model seçimi motor tipinden (`kind`) değil, modüllerden
 * türetilen yerleşim stilinden (`traits.layout`) yapılır.
 *
 * Her üretici aynı arayüzü (`EngineModel`) döndürür: mil grupları, bulanıklık
 * diski, stand bağlantıları, giriş/egzoz konumları (efektler için).
 */

import type * as THREE from 'three';
import { builtFor, type SlotId } from '../design/catalog';
import { GraphError } from '../design/errors';
import type { EngineLayout } from '../design/flowpath';
import type { BuiltEngine } from '../design/graph';
import type { EngineTraits, LayoutStyle } from '../design/traits';
import type { createMaterials } from '../materials/library.js';
import { buildBareJet } from './barejet.js';
import { buildTurboprop } from './turboprop.js';
import { buildTurboshaft } from './turboshaft.js';
import { buildTurbofanModel } from './turbofanModel';

export type Materials = ReturnType<typeof createMaterials>;

/** Motor tipinden bağımsız görsel model arayüzü */
export interface EngineModel {
  group: THREE.Group;
  lpSpool: THREE.Object3D;
  hpSpool: THREE.Object3D;
  blurDisc?: THREE.Mesh;
  blurMat?: THREE.MeshBasicMaterial;
  /** Önden görünen rotor kademesinin kanat sayısı (stroboskop sınırı için) */
  bladeCount?: number;
  /** Kaportasız motorlar: hücre askısı ve yer standı için bağlantı noktaları */
  stand?: { yoke: THREE.Object3D; mounts: number[]; engineR: number };
  /** Turboprop: pervane grubu, pal açısı ve pervane diski (efektler için) */
  propeller?: THREE.Object3D;
  prop?: { z: number; radius: number; blades: number };
  setPitch?: (load: number, feather: number) => void;
  /** Art yakıcılı motorlar: değişken lüle */
  nozzle?: { set(area: number, abLevel: number): void };
  wing?: THREE.Object3D;
  mount?: THREE.Object3D;
  intake: { z: number; radius: number; y?: number };
  exhaust: { z: number; radius: number };
  /** Modele özel ek animasyon (ör. planet dişliler) */
  tick?: (lpAngle: number, propAngle: number) => void;
  /** Turboşaft: çıkış mili (M5a P7) */
  outputShaft?: THREE.Object3D;
  /** Karıştırıcı (M5a P5/P6) */
  mixer?: THREE.Object3D;
}

/** Görsel modelin kaynağı: yuva, üretilmiş motor, yerleşim ve türetilmiş tip */
export interface VisualSource {
  slot: SlotId;
  built: BuiltEngine;
  layout: EngineLayout;
  traits: EngineTraits;
}

export type ModelBuilder = (materials: Materials, src: VisualSource) => EngineModel;

/** Yerleşimi beklenen stilde değilse tipli hata (kayıt defteri tutarsızlığı) */
function layoutAs<S extends LayoutStyle>(src: VisualSource, style: S): Extract<EngineLayout, { style: S }> {
  if (src.layout.style !== style) throw new Error(`Yerleşim "${src.layout.style}", beklenen "${style}".`);
  return src.layout as Extract<EngineLayout, { style: S }>;
}

export const MODEL_BUILDERS: Record<LayoutStyle, ModelBuilder> = {
  // Dış donanım düzeni barejet.js içinde src.traits'ten (P5: traits.lpLoad)
  bare: (m, src) => (layoutAs(src, 'bare'), buildBareJet(m, src)),
  nacelle: (m, src) => buildTurbofanModel(m, layoutAs(src, 'nacelle')),
  turboprop: (m, src) => buildTurboprop(m, layoutAs(src, 'turboprop')),
  turboshaft: (m, src) => buildTurboshaft(m, src),
};

/** Yuvanın görsel kaynağı; grafiği olmayan yuvada tipli hata */
export function visualSourceFor(slot: SlotId): VisualSource {
  const built = builtFor(slot);
  if (!built) throw new GraphError(`"${slot}" yuvasında görsel model üretilecek bir tasarım yok.`, 'slot.empty');
  return { slot, built, layout: built.flowpath.layout, traits: built.traits };
}
