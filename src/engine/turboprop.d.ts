/** turboprop.js tip bildirimi: model kayıt defteri (models.ts) dönüş tipini bilir */
import type { TurbopropLayout } from '../design/flowpath';
import type { EngineModel, Materials } from './models';

export declare function buildTurboprop(materials: Materials, L: TurbopropLayout): EngineModel;
