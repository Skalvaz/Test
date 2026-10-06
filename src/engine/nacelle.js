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
import { smoothProfile, latheFromProfile, thickLathe, arcLengthV, radialInstances, tagPart } from './geom.js';

const SEG = 256;

/** Testere dişli (chevron) lüle kenarı. */
export function chevronBand({
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

/**
 * Kaporta M4 öncesi modelin ölçülerinde (fan ucu 1,386 m) kurulur; görsel
 * model grubu fan ucu oranında ölçekler (visual.ts).
 * @param dims.chevrons   baypas lülesi kenarındaki chevron sayısı (0: düz)
 * @param dims.ductExitR  baypas lülesi ağzında kaporta iç duvarı yarıçapı
 *   (aynı ölçekte; termodinamik A19 alanından). Kaportanın arka kısmı
 *   (z > 0,55) bu farka göre yumuşakça kayar, dudak ve fan bölümü aynı kalır.
 */
export function buildNacelle(materials, dims = {}) {
  const group = new THREE.Group();
  group.name = 'nacelle';
  const d = (dims.ductExitR ?? 1.344) - 1.344;
  const chevrons = dims.chevrons ?? 18;
  const aft = (pts) => pts.map(([r, z]) => [r + d * THREE.MathUtils.smoothstep(z, 0.55, 1.52), z]);

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
  const lip = new THREE.Mesh(thickLathe(lipProfile, SEG, 0.012, [1.56, -1.9]), materials.polishedLip);
  lip.name = 'inlet-lip';
  lip.castShadow = true;
  lip.receiveShadow = true;
  group.add(tagPart(lip, 'inlet'));

  /* ---------------- dış kaporta (boyalı) ---------------- */
  const cowlProfile = smoothProfile(
    aft([
      [1.742, -1.72],
      [1.771, -1.46],
      [1.784, -1.10],
      [1.780, -0.55],
      [1.755, 0.05],
      [1.706, 0.55],
      [1.638, 1.00],
      [1.560, 1.34],
      [1.516, 1.52],
    ]),
    180,
  );
  const cowl = new THREE.Mesh(
    thickLathe(cowlProfile, SEG, 0.012, 'in', { arcV: true }),
    materials.cowlDetail,
  );
  cowl.name = 'fan-cowl';
  cowl.castShadow = true;
  cowl.receiveShadow = true;
  group.add(tagPart(cowl, 'nacelle'));

  /* ---------------- baypas kanalı iç duvarı (akustik astar) ---------------- */
  const ductProfile = smoothProfile(
    aft([
      [1.392, -1.35],
      [1.402, -0.95],
      [1.414, -0.60],
      [1.418, -0.30],
      [1.412, 0.10],
      [1.396, 0.55],
      [1.372, 1.05],
      [1.352, 1.40],
      [1.344, 1.52],
    ]),
    160,
  );
  const duct = new THREE.Mesh(thickLathe(ductProfile, SEG, 0.014, 'out'), materials.acousticLiner);
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
  // Kapalı kesit: muhafaza duvarı + baypas kanalına oturan taban
  const fanCase = new THREE.Mesh(thickLathe(caseProfile, 160, 0.012, 'in'), materials.composite);
  fanCase.name = 'fan-containment-case';
  group.add(tagPart(fanCase, 'fanCase'));

  /* ---------------- baypas lülesi: çevrikli arka kenar ---------------- */
  // Chevron'lar: 0 ise baypas lülesi düz kenarla biter
  if (chevrons > 0) {
    const outerChevrons = new THREE.Mesh(
      chevronBand({ startR: 1.516 + d, startZ: 1.52, endR: 1.478 + d, endZ: 1.70, count: chevrons }),
      materials.cowlPaint,
    );
    outerChevrons.name = 'bypass-chevrons-outer';
    outerChevrons.castShadow = true;
    group.add(tagPart(outerChevrons, 'bypassNozzle'));

    const innerChevrons = new THREE.Mesh(
      chevronBand({ startR: 1.344 + d, startZ: 1.52, endR: 1.382 + d, endZ: 1.70, count: chevrons }),
      materials.acousticLinerOpen ?? materials.acousticLiner,
    );
    innerChevrons.name = 'bypass-chevrons-inner';
    group.add(tagPart(innerChevrons, 'bypassNozzle'));
  }

  // Lüle arka kenarını kapatan ince halka
  const nozzleRing = new THREE.Mesh(
    thickLathe([new THREE.Vector2(1.516 + d, 1.52), new THREE.Vector2(1.344 + d, 1.52)], SEG, 0.01, [1.43 + d, 1.4]),
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
