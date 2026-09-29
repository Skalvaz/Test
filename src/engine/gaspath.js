/**
 * Parametrik gaz yolu: kompresör kademeleri, yanma odası, türbinler, miller.
 *
 * Yüksek baypaslı turbofanın çekirdeği (core.js) elle ölçülendirilmiştir;
 * diğer motorlar (askeri turbofan, turbojet, turboprop) aynı parçaları
 * istasyon tablosundan üretir. Rotorlar ilgili mil grubuna (LP/HP), statorlar
 * ve gövdeler sabit gruba eklenir; böylece mil dönüşleri ve kesit görünümü
 * her motorda aynı şekilde çalışır.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, bladeRow, radialInstances, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';

const lerp = (a, b, t) => a + (b - a) * t;
const deg = THREE.MathUtils.degToRad;

/**
 * Eksenel kompresör kademeleri.
 * @param {object} c { stages, z0, z1, hub:[a,b], tip:[a,b], blades:[a,b], part }
 */
function compressor(materials, c, rotorGroup, statorGroup) {
  const n = c.stages;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const z = lerp(c.z0, c.z1, t);
    const hub = lerp(c.hub[0], c.hub[1], t);
    const tip = lerp(c.tip[0], c.tip[1], t);
    const span = tip - hub;
    const chord = Math.max(0.03, span * lerp(0.95, 0.7, t));
    const count = Math.round(lerp(c.blades[0], c.blades[1], t));
    const opts = {
      sections: 6,
      samples: 22,
      chord: [chord, chord * 0.9],
      twist: [deg(48 - t * 14), deg(26 - t * 8)],
      thickness: [0.1, 0.055],
    };
    rotorGroup.add(tagPart(bladeRow(createStageBladeGeometry(hub, tip, opts), materials.hubMetal, count, { z, phase: i * 0.07 }), c.part));
    const stator = bladeRow(
      createStageBladeGeometry(hub + 0.006, tip + 0.003, {
        ...opts,
        chord: [chord * 0.85, chord * 0.8],
        twist: [deg(-30), deg(-18)],
      }),
      materials.superalloy,
      count + 4,
      { z: z + chord * 0.75, phase: 0.03 },
    );
    statorGroup.add(tagPart(stator, c.part));
  }
  // Rotor tamburu
  const drum = smoothProfile(
    [
      [c.hub[0] - 0.01, c.z0 - 0.04],
      [lerp(c.hub[0], c.hub[1], 0.5) - 0.01, (c.z0 + c.z1) / 2],
      [c.hub[1] - 0.01, c.z1 + 0.08],
    ],
    30,
  );
  rotorGroup.add(tagPart(new THREE.Mesh(latheFromProfile(drum, 96), materials.hubMetal), c.part));
}

/** Türbin kademeleri (stator + rotor). */
function turbine(materials, c, rotorGroup, statorGroup) {
  const n = c.stages;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const z = lerp(c.z0, c.z1, t);
    const hub = lerp(c.hub[0], c.hub[1], t);
    const tip = lerp(c.tip[0], c.tip[1], t);
    const chord = Math.max(0.035, (tip - hub) * 0.85);
    const vane = bladeRow(
      createStageBladeGeometry(hub, tip, {
        sections: 6,
        samples: 24,
        chord: [chord, chord * 0.92],
        twist: [deg(-42), deg(-30)],
        thickness: [0.17, 0.12],
        camber: [0.1, 0.08],
      }),
      materials.superalloy,
      Math.round(lerp(c.blades[0], c.blades[1], t) * 0.6),
      { z: z - chord * 0.9 },
    );
    statorGroup.add(tagPart(vane, c.part));
    const rotor = bladeRow(
      createStageBladeGeometry(hub, tip, {
        sections: 6,
        samples: 24,
        chord: [chord * 0.92, chord * 0.86],
        twist: [deg(40), deg(22)],
        thickness: [0.16, 0.1],
        camber: [0.09, 0.07],
      }),
      materials.superalloy,
      Math.round(lerp(c.blades[0], c.blades[1], t)),
      { z, phase: i * 0.05 },
    );
    rotorGroup.add(tagPart(rotor, c.part));
  }
  // Disk
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(c.hub[0] - 0.005, c.hub[1] - 0.005, Math.abs(c.z1 - c.z0) + 0.08, 48),
    materials.superalloy,
  );
  disk.rotation.x = Math.PI / 2;
  disk.position.z = (c.z0 + c.z1) / 2;
  rotorGroup.add(tagPart(disk, c.part));
}

/**
 * @param {object} spec
 *   lpc?, hpc, centrifugal?, combustor, hpt, lpt — kademe tabloları
 *   casing: [[r, z], …] gaz yolu dış duvarı
 *   shafts: { lp:[z0,z1,r], hp:[z0,z1,r] }
 * @returns {{ group, lpSpool, hpSpool }}
 */
export function buildGasPath(materials, spec) {
  const group = new THREE.Group();
  group.name = 'gas-path';
  const lpSpool = new THREE.Group();
  lpSpool.name = 'lp-spool';
  const hpSpool = new THREE.Group();
  hpSpool.name = 'hp-spool';
  group.add(lpSpool, hpSpool);

  if (spec.casing) {
    const casing = new THREE.Mesh(latheFromProfile(smoothProfile(spec.casing, 120), 128), materials.superalloy);
    casing.name = 'gas-path-casing';
    group.add(tagPart(casing, 'casing'));
  }

  if (spec.lpc) compressor(materials, { part: 'booster', ...spec.lpc }, lpSpool, group);
  compressor(materials, { part: 'hpc', ...spec.hpc }, hpSpool, group);

  // Santrifüj son kademe (turboprop gaz jeneratörleri)
  if (spec.centrifugal) {
    const { z, r0, r1 } = spec.centrifugal;
    const impeller = smoothProfile(
      [
        [r0, z - 0.1],
        [r0 + 0.02, z - 0.02],
        [lerp(r0, r1, 0.6), z + 0.05],
        [r1, z + 0.08],
        [r1, z + 0.11],
        [0.06, z + 0.13],
      ],
      40,
    );
    hpSpool.add(tagPart(new THREE.Mesh(latheFromProfile(impeller, 96), materials.hubMetal), 'hpc'));
    const vaneGeo = new THREE.BoxGeometry(0.008, (r1 - r0) * 0.9, 0.12);
    vaneGeo.translate(0, (r0 + r1) / 2, 0);
    hpSpool.add(tagPart(radialInstances(vaneGeo, materials.hubMetal, 17, 0, z + 0.02, { extraRotation: new THREE.Euler(0.35, 0, 0) }), 'hpc'));
    // Difüzör halkası
    const diffuser = new THREE.Mesh(new THREE.TorusGeometry(r1 + 0.03, 0.03, 12, 96), materials.superalloy);
    diffuser.position.z = z + 0.1;
    group.add(tagPart(diffuser, 'hpc'));
  }

  // Halka yanma odası: iki gömlek + enjektörler
  const cb = spec.combustor;
  const mid = (cb.rIn + cb.rOut) / 2;
  const h = (cb.rOut - cb.rIn) / 2;
  const L = cb.z1 - cb.z0;
  const outer = smoothProfile(
    [
      [mid + h * 0.35, cb.z0],
      [cb.rOut, cb.z0 + L * 0.2],
      [cb.rOut, cb.z0 + L * 0.7],
      [mid + h * 0.55, cb.z1],
    ],
    40,
  );
  const inner = smoothProfile(
    [
      [mid - h * 0.35, cb.z0],
      [cb.rIn, cb.z0 + L * 0.2],
      [cb.rIn, cb.z0 + L * 0.7],
      [mid - h * 0.55, cb.z1],
    ],
    40,
  );
  group.add(
    tagPart(new THREE.Mesh(latheFromProfile(outer, 96), materials.combustorGlow), 'combustor'),
    tagPart(new THREE.Mesh(latheFromProfile(inner, 96), materials.combustorGlow), 'combustor'),
  );
  const inj = new THREE.CylinderGeometry(h * 0.18, h * 0.25, L * 0.25, 8);
  inj.rotateX(Math.PI / 2);
  inj.translate(0, mid, 0);
  group.add(tagPart(radialInstances(inj, materials.machinery, cb.injectors ?? 16, 0, cb.z0), 'combustor'));

  turbine(materials, { part: 'hpt', ...spec.hpt }, hpSpool, group);
  turbine(materials, { part: 'lpt', ...spec.lpt }, lpSpool, group);

  // Miller
  const shaft = (z0, z1, r, mat, target) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 32), mat);
    m.rotation.x = Math.PI / 2;
    m.position.z = (z0 + z1) / 2;
    target.add(tagPart(m, 'shafts'));
  };
  shaft(...spec.shafts.lp, materials.hubMetal, lpSpool);
  shaft(...spec.shafts.hp, materials.machinery, hpSpool);

  return { group, lpSpool, hpSpool };
}
