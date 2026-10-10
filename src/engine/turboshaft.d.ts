/** turboshaft.js tip bildirimi: model kayıt defteri (models.ts) dönüş tipini bilir */
import type * as THREE from 'three';
import type { EngineModel, Materials, VisualSource } from './models';

export declare function buildTurboshaft(materials: Materials, src: VisualSource): EngineModel;

/** Bu orandan büyükte planet takımı; altında bileşik dişli dizisi */
export declare const PLANET_MIN_RATIO: number;

/** Redüktör dişli takımı, orana göre boyutlanır (kinematik tutarlı) */
export declare function reductionGears(
  materials: Materials,
  o: { z0: number; z1: number; R: number; ratio: number; part: string },
): {
  input: THREE.Group;
  fixed: THREE.Group;
  output: THREE.Group;
  /** planet2: iki planet kademesi seri (yüksek oran) */
  kind: 'planet' | 'planet2' | 'compound';
  radii: number[];
  /** Çıkış kademesinin ekseni (çıkış mili orada biter) */
  outZ: number;
  tick: (lpAngle: number, outAngle: number) => void;
};
