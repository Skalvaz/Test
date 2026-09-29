/**
 * Turboprop: pervane + redüksiyon dişli kutusu + gaz jeneratörü + serbest
 * güç türbini.
 *
 * Pervane palleri kendi eksenleri etrafında dönebilir: simülasyondaki sabit
 * devir valisi pal yükünü değiştirdikçe pal açısı görünür biçimde değişir;
 * motor durunca paller "tüy" (feather) konumuna, rüzgâra paralel döner.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, radialInstances, pipeAlong, tagPart } from './geom.js';
import { createBladeGeometry } from './airfoil.js';
import { buildGasPath } from './gaspath.js';
import { buildStandYoke } from './stand.js';
import { createBlurDiscTexture } from '../materials/textures.js';

const deg = THREE.MathUtils.degToRad;
export const PROP_RADIUS = 1.965;
const PROP_Z = -2.08;

export function buildTurboprop(materials, blades = 6) {
  const group = new THREE.Group();
  group.name = 'turboprop';

  /* ---------------- pervane ---------------- */
  const propeller = new THREE.Group();
  propeller.name = 'propeller';
  group.add(propeller);

  const spinner = smoothProfile(
    [
      [0.002, -2.62],
      [0.12, -2.54],
      [0.235, -2.38],
      [0.305, -2.18],
      [0.33, -1.96],
      [0.335, -1.78],
    ],
    80,
  );
  propeller.add(tagPart(new THREE.Mesh(latheFromProfile(spinner, 128), materials.propSpinner), 'spinner'));

  const bladeGeo = createBladeGeometry({
    hubRadius: 0.24,
    tipRadius: PROP_RADIUS,
    sections: 26,
    samples: 60,
    // Kökte dar "manşet", orta açıklıkta geniş, uçta incelen pala
    chord: (t) => 0.16 + 0.24 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.85)) * (1 - 0.35 * t),
    twist: (t) => deg(58 - 44 * Math.pow(t, 0.8)),
    thickness: (t) => 0.2 - 0.16 * Math.pow(t, 0.6),
    camber: (t) => 0.05 - 0.02 * t,
    sweep: (t) => 0.2 * t * t,
    lean: () => 0,
    chordAnchor: 0.35,
    tipRound: 0.06,
  });
  const pivots = [];
  for (let i = 0; i < blades; i++) {
    const spoke = new THREE.Group();
    spoke.rotation.z = (i / blades) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.z = PROP_Z;
    const blade = new THREE.Mesh(bladeGeo, materials.propBlade);
    blade.castShadow = true;
    pivot.add(blade);
    spoke.add(pivot);
    propeller.add(tagPart(spoke, 'propeller'));
    pivots.push(pivot);
  }
  // Pal kökü manşonları
  const cuff = new THREE.CylinderGeometry(0.07, 0.08, 0.16, 16);
  cuff.translate(0, 0.3, 0);
  propeller.add(tagPart(radialInstances(cuff, materials.machinery, blades, 0, PROP_Z), 'propeller'));

  // Hareket bulanıklığı diski
  const blurMat = new THREE.MeshBasicMaterial({
    map: createBlurDiscTexture(1024, blades),
    color: 0x1a1a1a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(PROP_RADIUS, 96), blurMat);
  blurDisc.position.z = PROP_Z + 0.02;
  blurDisc.visible = false;
  propeller.add(blurDisc);

  /* ---------------- redüksiyon dişli kutusu ---------------- */
  const rgb = smoothProfile(
    [
      [0.3, -1.8],
      [0.38, -1.62],
      [0.45, -1.35],
      [0.46, -1.1],
      [0.4, -0.92],
      [0.35, -0.82],
    ],
    60,
  );
  group.add(tagPart(new THREE.Mesh(latheFromProfile(rgb, 128), materials.engineCase), 'gearbox'));
  const rgbBolt = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6);
  rgbBolt.rotateX(Math.PI / 2);
  group.add(tagPart(radialInstances(rgbBolt, materials.machinery, 36, 0.455, -1.3), 'gearbox'));

  /* ---------------- gaz jeneratörü + güç türbini ---------------- */
  const gas = buildGasPath(materials, {
    hpc: { stages: 4, z0: -0.72, z1: -0.3, hub: [0.1, 0.13], tip: [0.2, 0.17], blades: [26, 36] },
    centrifugal: { z: -0.14, r0: 0.12, r1: 0.26 },
    combustor: { z0: 0.06, z1: 0.46, rIn: 0.14, rOut: 0.26, injectors: 14 },
    hpt: { stages: 1, z0: 0.56, z1: 0.56, hub: [0.15, 0.15], tip: [0.22, 0.22], blades: [44, 44] },
    lpt: { stages: 2, z0: 0.74, z1: 0.9, hub: [0.15, 0.15], tip: [0.23, 0.26], blades: [52, 58] },
    casing: [[0.21, -0.78], [0.18, -0.3], [0.28, -0.05], [0.28, 0.45], [0.23, 0.56], [0.27, 0.95]],
    shafts: { lp: [-1.7, 0.95, 0.035], hp: [-0.78, 0.6, 0.06] },
  });
  group.add(gas.group);

  const casePts = [
    [0.3, -0.84],
    [0.32, -0.6],
    [0.3, -0.3],
    [0.36, -0.1],
    [0.37, 0.4],
    [0.33, 0.62],
    [0.32, 1.0],
  ];
  group.add(tagPart(new THREE.Mesh(latheFromProfile(smoothProfile(casePts, 80), 128), materials.engineCase), 'fanCase'));
  for (const fz of [-0.84, -0.3, -0.08, 0.48, 1.0]) {
    const fl = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.01, 8, 96), materials.machinery);
    fl.position.z = fz;
    fl.scale.setScalar(fz < -0.2 ? 0.92 : fz > 0.6 ? 0.94 : 1.05);
    group.add(tagPart(fl, 'fanCase'));
  }

  // Egzoz: jet borusu
  const jetPipe = new THREE.Mesh(
    latheFromProfile(smoothProfile([[0.3, 0.98], [0.29, 1.3], [0.27, 1.62]], 20), 96),
    materials.sooted,
  );
  group.add(tagPart(jetPipe, 'exhaust'));
  const tail = new THREE.Mesh(latheFromProfile(smoothProfile([[0.15, 0.95], [0.1, 1.2], [0.01, 1.42]], 30), 48), materials.sooted);
  group.add(tagPart(tail, 'exhaust'));

  /* ---------------- çene tipi hava girişi ---------------- */
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 14, 64), materials.polishedLip);
  lip.scale.set(1.35, 0.8, 1);
  lip.position.set(0, -0.62, -1.62);
  group.add(tagPart(lip, 'inlet'));
  const duct = new THREE.Mesh(
    pipeAlong([
      [0, -0.62, -1.62],
      [0, -0.6, -1.25],
      [0, -0.5, -0.95],
      [0, -0.3, -0.8],
    ], 0.17, 24),
    materials.engineCase,
  );
  duct.scale.set(1.3, 1, 1);
  group.add(tagPart(duct, 'inlet'));

  // Tesisat
  const pipe = (pts, r, mat) => group.add(tagPart(new THREE.Mesh(pipeAlong(pts, r, 8), mat), 'gearbox'));
  pipe([[0.3, 0.1, -1.1], [0.36, 0.15, -0.5], [0.4, 0.05, 0.2], [0.36, -0.1, 0.8]], 0.013, materials.engineCase);
  pipe([[-0.3, 0.12, -1.0], [-0.38, 0.1, -0.2], [-0.39, -0.05, 0.4]], 0.011, materials.brassFitting);
  pipe([[0.2, -0.3, -0.9], [0.3, -0.28, -0.2], [0.34, -0.2, 0.6]], 0.009, materials.hose);
  pipe([[-0.2, -0.32, -0.85], [-0.32, -0.25, 0.0], [-0.35, -0.15, 0.7]], 0.009, materials.hose);
  const fuelRing = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.01, 8, 80), materials.engineCase);
  fuelRing.position.z = 0.2;
  group.add(tagPart(fuelRing, 'gearbox'));
  // Starter-jeneratör ve pompalar (dişli kutusunun arkasında)
  for (const [x, y, r, l] of [[0.26, 0.28, 0.08, 0.22], [-0.24, 0.3, 0.06, 0.18], [0.0, -0.44, 0.05, 0.16]]) {
    const acc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 18), materials.machinery);
    acc.rotation.x = Math.PI / 2;
    acc.position.set(x, y, -0.8 + l / 2);
    group.add(tagPart(acc, 'gearbox'));
  }

  /* ---------------- test standı askısı ---------------- */
  group.add(tagPart(buildStandYoke(materials, { mounts: [-1.25, 0.35], engineR: 0.42 }), 'stand'));

  /**
   * Pal açısı: vali yükü (0.03 ince … 1.8 kalın) → pal açısı farkı;
   * `feather` 1 iken paller rüzgâra paralel.
   */
  const setPitch = (load, feather = 0) => {
    const fine = THREE.MathUtils.lerp(-14, 18, Math.sqrt(THREE.MathUtils.clamp(load / 1.8, 0, 1)));
    const a = deg(THREE.MathUtils.lerp(fine, 62, feather));
    for (const p of pivots) p.rotation.y = a;
  };
  setPitch(0, 1);

  return {
    group,
    lpSpool: gas.lpSpool,
    hpSpool: gas.hpSpool,
    propeller,
    blurDisc,
    blurMat,
    setPitch,
    intake: { z: -1.62, radius: 0.2, y: -0.62 },
    exhaust: { z: 1.62, radius: 0.27 },
  };
}
