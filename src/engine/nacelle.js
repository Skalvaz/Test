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
import { capify } from '../materials/engine';

const SEG = 256;

/** [r, z] noktaları arasında doğrusal ara değer (z artan) */
function profileAt(pts, z) {
  if (z <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][1]) {
      const [r0, z0] = pts[i - 1];
      const [r1, z1] = pts[i];
      return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
    }
  }
  return pts[pts.length - 1][0];
}

/** Fan kaportasının dış profili (M4 öncesi model ölçeğinde [r, z]) */
const COWL_POINTS = [
  [1.742, -1.72],
  [1.771, -1.46],
  [1.784, -1.10],
  [1.780, -0.55],
  [1.755, 0.05],
  [1.706, 0.55],
  [1.638, 1.00],
  [1.560, 1.34],
  [1.516, 1.52],
];

/**
 * Uzun kanallı kaportanın arka kısmının boyası: fan kaportasıyla aynı
 * vernikli beyaz, ama pişirilmiş derz/yazı dokusu yok (doku kısa fan
 * kaportasının boyuna göre çizildi; uzun kanala gerilince yazılar ve kuşak
 * bandı yanlış yere düşer). Derzler geometriyle. Kesitte kesik yüzey
 * kapağı (capify) kütüphane malzemeleri gibi. Oturum boyunca tek malzeme.
 */
let aftPaint = null;
function aftCowlPaint() {
  aftPaint ??= capify(
    new THREE.MeshPhysicalMaterial({
      name: 'aftCowlPaint',
      color: 0xe3e6e9,
      metalness: 0.12,
      roughness: 0.32,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.15,
      side: THREE.DoubleSide,
    }),
  );
  return aftPaint;
}
/** Derz yivleri: koyu, mat */
let seamMat = null;
function seamMaterial() {
  seamMat ??= new THREE.MeshStandardMaterial({ name: 'cowlSeam', color: 0x5d6670, metalness: 0.2, roughness: 0.6 });
  return seamMat;
}

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
 * @param dims.long  karışık akış (M5a P6): uzun kanallı kaporta. Arka kısım
 *   (z ≥ 0,55) yerleşimin profillerinden (aynı ölçekte): `duct` iç duvar,
 *   `outer` dış yüzey, `mixZ` karıştırıcının başı (iç duvar ondan sonra
 *   sıcak karışık akışa bakan metal ortak lüledir). Lüle ağzı son noktada.
 */
export function buildNacelle(materials, dims = {}) {
  const group = new THREE.Group();
  group.name = 'nacelle';
  const long = dims.long ?? null;
  const d = long ? 0 : (dims.ductExitR ?? 1.344) - 1.344;
  const chevrons = dims.chevrons ?? 18;
  const aft = (pts) => pts.map(([r, z]) => [r + d * THREE.MathUtils.smoothstep(z, 0.55, 1.52), z]);
  // Uzun kanalda arka kısım yerleşimden: ön bölümün z < 0,55 noktaları korunur
  const withAft = (pts, tail) => (long ? [...pts.filter(([, z]) => z < 0.55 - 1e-6), ...tail] : aft(pts));
  // Lüle ağzı: dış yüzey ve iç duvarın son noktaları
  const exitOuter = long ? long.outer[long.outer.length - 1] : [1.516 + d, 1.52];
  const exitInner = long ? long.duct[long.duct.length - 1] : [1.344 + d, 1.52];

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
  let cowl;
  if (!long) {
    cowl = new THREE.Mesh(thickLathe(smoothProfile(aft(COWL_POINTS), 180), SEG, 0.012, 'in', { arcV: true }), materials.cowlDetail);
  } else {
    // Fan kaportası (z ≤ 0,55) ayrık akıştakinin aynısı: pişirilmiş doku
    // kısa kaportanın yay boyuna göre (v = s / L), yazılar aynı yerde kalır
    const front = smoothProfile(COWL_POINTS.filter(([, z]) => z <= 0.55 + 1e-6), 120);
    const arc = (pts) => pts.reduce((a, q, i) => (i ? a + q.distanceTo(pts[i - 1]) : 0), 0);
    const geo = thickLathe(front, SEG, 0.012, 'in', { arcV: true });
    const f = arc(front) / arc(smoothProfile(COWL_POINTS, 180));
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * f);
    cowl = new THREE.Mesh(geo, materials.cowlDetail);
    // Arka kısım: itki çevirici kapakları ve sabit arka kaporta (CFM56-5C'de
    // dört dönen kapaklı çevirici), lüle ağzına daralan uzun gövde
    const aftCowl = new THREE.Mesh(thickLathe(smoothProfile(long.outer, 200), SEG, 0.012, 'in'), aftCowlPaint());
    aftCowl.name = 'aft-cowl';
    aftCowl.castShadow = true;
    aftCowl.receiveShadow = true;
    group.add(tagPart(aftCowl, 'nacelle'));
    // Derzler: fan kaportası / çevirici, çevirici / arka kaporta, arka kaporta / lüle
    const z0 = long.outer[0][1];
    const z1 = long.outer[long.outer.length - 1][1];
    for (const z of [z0 + 0.004, z0 + 0.3 * (z1 - z0), z0 + 0.72 * (z1 - z0)]) {
      // Yüzeyin hemen üstünde dar koyu bant (ince torus uzaktan kesik kesik görünür)
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(profileAt(long.outer, z + 0.007) + 0.0012, profileAt(long.outer, z - 0.007) + 0.0012, 0.014, 220, 1, true),
        seamMaterial(),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.z = z;
      group.add(tagPart(ring, 'nacelle'));
    }
    // Çevirici kapaklarının boyuna kenarları (dört kapak, kapak arası derz)
    const za = z0 + 0.3 * (z1 - z0);
    const zb = z0 + 0.72 * (z1 - z0);
    for (let k = 0; k < 4; k++) {
      // Kapak kenarı kaporta yüzeyini izleyen ince yiv (kaporta daralır)
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const z = za + ((zb - za) * i) / 12;
        const r = profileAt(long.outer, z) + 0.0015;
        pts.push(new THREE.Vector3(Math.sin(a) * r, Math.cos(a) * r, z));
      }
      const e = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0065, 6, false), seamMaterial());
      group.add(tagPart(e, 'nacelle'));
    }
  }
  cowl.name = 'fan-cowl';
  cowl.castShadow = true;
  cowl.receiveShadow = true;
  group.add(tagPart(cowl, 'nacelle'));

  /* ---------------- baypas kanalı iç duvarı (akustik astar) ---------------- */
  // Uzun kanalda iç duvar iki parça: soğuk baypas bölümü akustik astar,
  // karıştırıcıdan sonrası sıcak karışık akışa bakan ortak lüle (is tutmuş metal)
  const ductAll = withAft(
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
    long?.duct,
  );
  const ductCold = long ? ductAll.filter(([, z]) => z <= long.mixZ + 1e-6) : ductAll;
  const duct = new THREE.Mesh(thickLathe(smoothProfile(ductCold, long ? 220 : 160), SEG, 0.014, 'out'), materials.acousticLiner);
  duct.name = 'bypass-duct';
  duct.receiveShadow = true;
  group.add(tagPart(duct, 'bypassDuct'));
  if (long) {
    // Ortak lüle (karıştırma kanalı + yakınsak bölüm): astarın bittiği yerden ağza
    const hot = ductAll.filter(([, z]) => z >= long.mixZ - 1e-6);
    const nozzle = new THREE.Mesh(thickLathe(smoothProfile(hot, 120), SEG, 0.014, 'out'), materials.sooted ?? materials.inconel);
    nozzle.name = 'common-nozzle';
    nozzle.receiveShadow = true;
    group.add(tagPart(nozzle, 'nozzle'));
  }

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
  const [rO, zE] = exitOuter;
  const [rI] = exitInner;
  const lipPart = long ? 'nozzle' : 'bypassNozzle';
  if (chevrons > 0) {
    const outerChevrons = new THREE.Mesh(
      chevronBand({ startR: rO, startZ: zE, endR: rO - 0.038, endZ: zE + 0.18, count: chevrons }),
      materials.cowlPaint,
    );
    outerChevrons.name = 'bypass-chevrons-outer';
    outerChevrons.castShadow = true;
    group.add(tagPart(outerChevrons, lipPart));

    const innerChevrons = new THREE.Mesh(
      chevronBand({ startR: rI, startZ: zE, endR: rI + 0.038, endZ: zE + 0.18, count: chevrons }),
      materials.acousticLinerOpen ?? materials.acousticLiner,
    );
    innerChevrons.name = 'bypass-chevrons-inner';
    group.add(tagPart(innerChevrons, lipPart));
  }

  // Lüle arka kenarını kapatan ince halka
  const nozzleRing = new THREE.Mesh(
    thickLathe([new THREE.Vector2(rO, zE), new THREE.Vector2(rI, zE)], SEG, 0.01, [(rO + rI) / 2, zE - 0.12]),
    long ? (materials.inconel ?? materials.composite) : materials.composite,
  );
  group.add(tagPart(nozzleRing, lipPart));

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
