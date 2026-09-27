/**
 * Nacelle: hava girişi dudağı, fan kaportası / itiş çevirici kabuğu,
 * baypas kanalı iç duvarı ve çevrikli (chevron) baypas lülesi.
 *
 * Gerçek bir yüksek baypas oranlı turbofanda bu parçalar farklı malzemelerdir:
 * dudak parlatılmış alüminyum, dış kaporta boyalı kompozit, kanal iç yüzeyi
 * ise delikli akustik astardır. Burada da ayrı meshler olarak modellenir —
 * hem malzeme farkı hem de dudakta dikişsiz yuvarlaklık için.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, arcLengthV, radialInstances, tagPart } from './geom.js';

const SEG = 256;

/** Testere dişli (chevron) lüle kenarı. */
function chevronBand({
  startR, startZ, endR, endZ,
  count = 14, segments = 384, sharpness = 1.35,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const rows = 8;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = t * Math.PI * 2;
    const phase = (t * count) % 1;
    // Yumuşatılmış üçgen dalga: 0 → çentik dibi, 1 → çevrik ucu
    let tri = 1 - Math.abs(phase * 2 - 1);
    tri = Math.pow(tri, sharpness);
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const z = startZ + (endZ - startZ) * v * tri;
      const r = startR + (endR - startR) * v * tri;
      positions.push(Math.cos(a) * r, Math.sin(a) * r, z);
      uvs.push(t * count, v);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = (i + 1) * (rows + 1) + j;
      indices.push(a, b, a + 1);
      indices.push(a + 1, b, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildNacelle(materials, dims) {
  const group = new THREE.Group();
  group.name = 'nacelle';

  /* ---------------- hava girişi dudağı (parlatılmış) ---------------- */
  const lipProfile = smoothProfile(
    [
      [1.392, -1.35],
      [1.381, -1.72],
      [1.378, -1.95],
      [1.392, -2.14],
      [1.437, -2.225],
      [1.512, -2.243],
      [1.60, -2.185],
      [1.672, -2.06],
      [1.716, -1.90],
      [1.742, -1.72],
    ],
    140,
  );
  const lip = new THREE.Mesh(latheFromProfile(lipProfile, SEG), materials.polishedLip);
  lip.name = 'inlet-lip';
  lip.castShadow = true;
  lip.receiveShadow = true;
  group.add(tagPart(lip, 'inlet'));

  /* ---------------- dış kaporta (boyalı) ---------------- */
  const cowlProfile = smoothProfile(
    [
      [1.742, -1.72],
      [1.771, -1.46],
      [1.784, -1.10],
      [1.780, -0.55],
      [1.755, 0.05],
      [1.706, 0.55],
      [1.638, 1.00],
      [1.560, 1.34],
      [1.516, 1.52],
    ],
    180,
  );
  const cowl = new THREE.Mesh(
    arcLengthV(latheFromProfile(cowlProfile, SEG), cowlProfile),
    materials.cowlDetail,
  );
  cowl.name = 'fan-cowl';
  cowl.castShadow = true;
  cowl.receiveShadow = true;
  group.add(tagPart(cowl, 'nacelle'));

  /* ---------------- baypas kanalı iç duvarı (akustik astar) ---------------- */
  const ductProfile = smoothProfile(
    [
      [1.392, -1.35],
      [1.402, -0.95],
      [1.414, -0.60],
      [1.418, -0.30],
      [1.412, 0.10],
      [1.396, 0.55],
      [1.372, 1.05],
      [1.352, 1.40],
      [1.344, 1.52],
    ],
    160,
  );
  const duct = new THREE.Mesh(latheFromProfile(ductProfile, SEG), materials.acousticLiner);
  duct.name = 'bypass-duct';
  duct.receiveShadow = true;
  group.add(tagPart(duct, 'bypassDuct'));

  /* ---------------- fan muhafazası (kesitte görünür) ---------------- */
  const caseProfile = smoothProfile(
    [
      [1.424, -0.62],
      [1.470, -0.60],
      [1.500, -0.40],
      [1.505, -0.10],
      [1.470, 0.10],
      [1.424, 0.12],
    ],
    60,
  );
  const fanCase = new THREE.Mesh(latheFromProfile(caseProfile, 160), materials.composite);
  fanCase.name = 'fan-containment-case';
  group.add(tagPart(fanCase, 'fanCase'));

  /* ---------------- baypas lülesi: çevrikli arka kenar ---------------- */
  const outerChevrons = new THREE.Mesh(
    chevronBand({ startR: 1.516, startZ: 1.52, endR: 1.478, endZ: 1.70, count: 18 }),
    materials.cowlPaint,
  );
  outerChevrons.name = 'bypass-chevrons-outer';
  outerChevrons.castShadow = true;
  group.add(tagPart(outerChevrons, 'bypassNozzle'));

  const innerChevrons = new THREE.Mesh(
    chevronBand({ startR: 1.344, startZ: 1.52, endR: 1.382, endZ: 1.70, count: 18 }),
    materials.acousticLiner,
  );
  innerChevrons.name = 'bypass-chevrons-inner';
  group.add(tagPart(innerChevrons, 'bypassNozzle'));

  // Lüle arka kenarını kapatan ince halka
  const nozzleRing = new THREE.Mesh(
    latheFromProfile(
      [new THREE.Vector2(1.516, 1.52), new THREE.Vector2(1.344, 1.52)],
      SEG,
    ),
    materials.composite,
  );
  group.add(tagPart(nozzleRing, 'bypassNozzle'));

  /* ---------------- kaporta üstü detaylar ---------------- */
  // Perçin, vida ve kapaklar kaporta dokusuna pişirildi; burada yalnız
  // yüzeyden belirgin taşan parçalar geometri olarak kalır.

  // İtiş çevirici aktüatör muhafazaları (kaporta üzerinde hafif kabartılar)
  const fairingShape = new THREE.CapsuleGeometry(0.075, 0.52, 6, 14);
  fairingShape.rotateX(Math.PI / 2);
  const actuatorFairings = radialInstances(fairingShape, materials.fairingPaint, 3, 1.775, 0.30, {
    phase: Math.PI / 2 + 0.45,
  });
  actuatorFairings.name = 'tr-actuator-fairings';
  group.add(tagPart(actuatorFairings, 'nacelle'));

  // Alt kaporta kilitleri, kapaklar ve perçinler kaporta dokusuna pişirildi
  // (blender/panel_details.py).

  // Drenaj mastı
  const mast = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.26, 0.34),
    materials.machinery,
  );
  mast.position.set(0, -1.85, 0.95);
  mast.rotation.x = -0.12;
  mast.castShadow = true;
  group.add(tagPart(mast, 'nacelle'));

  return group;
}
