/** barejet.js tip bildirimi: model kayıt defteri (models.ts) dönüş tipini bilir */
import type { EngineModel, Materials, VisualSource } from './models';

/**
 * `src.layout` çıplak yerleşim olmalı (models.ts layoutAs denetler).
 * `abZ`/`abR` (alev tutucu ekseni, gömlek yarıçapı) yalnız art yakıcılı motorda.
 */
export declare function buildBareJet(materials: Materials, src: VisualSource): EngineModel & { abZ?: number; abR?: number };

/** Baypas ayırıcısının profili ([r, z], z artan; splitterZ null olmayan yerleşimde) */
export declare function splitterProfile(v: import('../design/flowpath').BareJetLayout, s: number): import('three').Vector2[];
