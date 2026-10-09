/**
 * Kaportalı turbofan görsel modeli: çekirdek yerleşimden (design/layouts/
 * turbofan.ts), fan, kaporta ve pilon M4 öncesi modelin ölçülerinde kurulup
 * fan ucu oranında ölçeklenir; fan rotoru yerleşimdeki konuma oturur.
 * (M5a P0: visual.ts'ten taşındı, davranış aynı.)
 */

import * as THREE from 'three';
import type { TurbofanLayout } from '../design/flowpath';
import { keyOf, reuse } from './buildCache.js';
import { buildCore } from './core.js';
import { buildFan } from './fan.js';
import type { EngineModel, Materials } from './models';
import { buildNacelle } from './nacelle.js';
import { buildPylon } from './pylon.js';

export function buildTurbofanModel(materials: Materials, L: TurbofanLayout): EngineModel {
  const group = new THREE.Group();
  // Kaporta, fan ve pilon yalnız kendi girdilerine bağlı: parametre
  // değişikliğinde önbellekten taşınır (artımlı üretim)
  const ductExitR = L.bypassExit.rDuct / L.s;
  const chevrons = L.chevrons.bypass;
  const nacelle = reuse(keyOf('nacelle', { ductExitR, chevrons }), () => buildNacelle(materials, { ductExitR, chevrons }));
  const fan = reuse(keyOf('fan', L.fan.blades[0]), () => buildFan(materials, L.fan.blades[0]));
  const core = buildCore(materials, L);
  const pylon = reuse('pylon', () => buildPylon(materials));
  const place = (o: THREE.Object3D) => {
    o.scale.setScalar(L.s);
    o.position.z = L.fan.z0 + 0.28 * L.s;
  };
  place(nacelle);
  place(fan.group);
  place(pylon.group);
  // Fan rotoru LP milinin ön ucudur
  core.lpSpool.add(fan.group);
  group.add(nacelle, core.group, pylon.group);
  return {
    group,
    lpSpool: core.lpSpool,
    hpSpool: core.hpSpool,
    blurDisc: fan.blurDisc,
    blurMat: fan.blurMat,
    bladeCount: L.fan.blades[0],
    wing: pylon.wing,
    mount: pylon.group,
    intake: L.intake,
    exhaust: L.exhaustExit,
  };
}
