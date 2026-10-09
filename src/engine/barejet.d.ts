/** barejet.js tip bildirimi: model kayıt defteri (models.ts) dönüş tipini bilir */
import type { EngineModel, Materials, VisualSource } from './models';

/** `src.layout` çıplak yerleşim olmalı (models.ts layoutAs denetler) */
export declare function buildBareJet(materials: Materials, src: VisualSource): EngineModel & { abZ: number; abR: number };
