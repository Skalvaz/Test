/**
 * Kaportalı turbofan görsel modeli: çekirdek yerleşimden (design/layouts/
 * turbofan.ts), fan, kaporta ve pilon M4 öncesi modelin ölçülerinde kurulup
 * fan ucu oranında ölçeklenir; fan rotoru yerleşimdeki konuma oturur.
 * (M5a P0: visual.ts'ten taşındı.)
 *
 * Karışık akışta (M5a P6) kaportanın arka kısmı uzun kanaldır: yerleşimin
 * iç duvar ve dış yüzey profilleri kaporta ölçeğine çevrilip nacelle.js'e
 * verilir; çekirdek lülesi yerine karıştırıcı (core.js), egzoz ağzı ortak
 * lülenin ağzıdır.
 */

import * as THREE from 'three';
import type { TurbofanLayout } from '../design/flowpath';
import { keyOf, reuse } from './buildCache.js';
import { buildCore } from './core.js';
import { buildFan } from './fan.js';
import type { EngineModel, Materials } from './models';
import { buildNacelle } from './nacelle.js';
import { buildPylon } from './pylon.js';

/** Kaporta referansında uzun kanal profilleri (nacelle.js `dims.long`) */
export interface LongDuct {
  duct: [number, number][];
  outer: [number, number][];
  mixZ: number;
}

/** Yerleşimin dünya [r, z] profillerini kaporta referansına (fan ucu 1,386 m, z fan + 0,28·s'den) çevirir */
export function longDuctOf(L: TurbofanLayout): LongDuct | null {
  const m = L.mixed;
  if (!m) return null;
  const z0 = L.fan.z0 + 0.28 * L.s;
  const ref = ([r, z]: [number, number]): [number, number] => [r / L.s, (z - z0) / L.s];
  return { duct: m.duct.map(ref), outer: m.outer.map(ref), mixZ: (m.mixer.z0 - z0) / L.s };
}

export function buildTurbofanModel(materials: Materials, L: TurbofanLayout): EngineModel {
  const group = new THREE.Group();
  // Kaporta, fan ve pilon yalnız kendi girdilerine bağlı: parametre
  // değişikliğinde önbellekten taşınır (artımlı üretim)
  const ductExitR = L.bypassExit.rDuct / L.s;
  const chevrons = L.chevrons.bypass;
  const long = longDuctOf(L);
  const nacelleKey = long ? keyOf('nacelle-long', { ...long, chevrons }) : keyOf('nacelle', { ductExitR, chevrons });
  const nacelle = reuse(nacelleKey, () => buildNacelle(materials, long ? { long, chevrons } : { ductExitR, chevrons }));
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
    // Ayrık akışta çekirdek lülesi, karışık akışta ortak lüle ağzı (yerleşim)
    exhaust: L.exhaustExit,
    ...(core.mixer ? { mixer: core.mixer } : {}),
  };
}
