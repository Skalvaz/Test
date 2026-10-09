/**
 * Turboprop: pervane + redüksiyon dişli kutusu + gaz jeneratörü + serbest
 * güç türbini.
 *
 * Pervane palleri kendi eksenleri etrafında dönebilir: simülasyondaki sabit
 * devir valisi pal yükünü değiştirdikçe pal açısı görünür biçimde değişir;
 * motor durunca paller "tüy" (feather) konumuna, rüzgâra paralel döner.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, thickLathe, radialInstances, tagPart } from './geom.js';
import { createBladeGeometry } from './airfoil.js';
import { buildGasPath } from './gaspath.js';
import { buildStandYoke } from './stand.js';
import { createPropDiscTexture } from '../materials/textures.js';
import { KitBatch } from './kit.js';
import {
  radiusProfile,
  flangeBolts,
  probes,
  liftLugs,
  hugPipe,
  harness,
  fuelManifold,
  igniters,
  borescopePorts,
  oilTank,
  controlUnit,
} from './externals.js';

/** Dişli çark: dış (ya da iç, halka dişli) dişli profil, ekstrüzyon */
function gearGeometry(r, teeth, depth, internal = false, outerR = r + 0.03) {
  const tooth = Math.max(0.006, (Math.PI * 2 * r) / teeth * 0.35);
  const profile = (radius, inward) => {
    const pts = [];
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const da = (Math.PI * 2) / teeth;
      const tip = radius + (inward ? -tooth : tooth);
      pts.push([a0, radius], [a0 + da * 0.2, tip], [a0 + da * 0.5, tip], [a0 + da * 0.7, radius]);
    }
    return pts.map(([a, rr]) => new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  };
  let shape;
  if (internal) {
    shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    shape.holes.push(new THREE.Path(profile(r, true).reverse()));
  } else {
    shape = new THREE.Shape(profile(r, false));
    shape.holes.push(new THREE.Path().absarc(0, 0, r * 0.3, 0, Math.PI * 2, true));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Eliptik kesitli kanal: yol boyunca genişlik/yükseklik değişen bir boru
 * (çene girişi S-kanalı gibi). path: [[x, y, z, genişlik, yükseklik], …]
 */
function ellipticDuct(path, segments = 40, radial = 32) {
  const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const pos = [];
  const idx = [];
  const frames = curve.computeFrenetFrames(segments, false);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = curve.getPointAt(t);
    // Genişlik/yükseklik yol boyunca doğrusal ara değer
    const f = t * (path.length - 1);
    const k = Math.min(Math.floor(f), path.length - 2);
    const u = f - k;
    const w = THREE.MathUtils.lerp(path[k][3], path[k + 1][3], u);
    const h = THREE.MathUtils.lerp(path[k][4], path[k + 1][4], u);
    // Kesit düzlemi: yatay eksen hep dünya X'i, dikey eksen teğete dik
    const tan = frames.tangents[i];
    const xAxis = new THREE.Vector3(1, 0, 0);
    const yAxis = new THREE.Vector3().crossVectors(tan, xAxis).normalize();
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const p = c.clone().addScaledVector(xAxis, Math.cos(a) * w).addScaledVector(yAxis, Math.sin(a) * h);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const deg = THREE.MathUtils.degToRad;

/**
 * @param L  gaz yolu yerleşimi: design/flowpath.ts `TurbopropLayout`
 *           (modül grafiğinden fizikle hesaplanır). Pervane göbeği, dişli
 *           kutusu, giriş kanalı ve dış donanım bu çapalara göre yerleşir:
 *           pervane düzlemi, dişli kutusu gövdesi, HPC girişi, yanma odası,
 *           türbinler.
 */
export function buildTurboprop(materials, L) {
  const group = new THREE.Group();
  group.name = 'turboprop';
  const PROP_Z = L.prop.z;
  const PROP_RADIUS = L.prop.radius;
  const blades = L.prop.blades;
  const g = L.gas;
  const hz = g.hpc.z0; // HPC girişi: giriş kanalı ve gövde donanımının çapası
  const cb = g.combustor;
  const cen = g.centrifugal;
  // Dişli kutusu gövdesi: M4 öncesi modelde z −1,8 … −0,82 arası
  const gbz = (z) => L.gearbox.z0 + ((z + 1.8) / 0.98) * (L.gearbox.z1 - L.gearbox.z0);

  /* ---------------- pervane ---------------- */
  const propeller = new THREE.Group();
  propeller.name = 'propeller';
  group.add(propeller);

  const spinner = smoothProfile(
    [
      [0.002, PROP_Z - 0.54],
      [0.12, PROP_Z - 0.46],
      [0.235, PROP_Z - 0.3],
      [0.305, PROP_Z - 0.1],
      [0.33, PROP_Z + 0.12],
      [0.335, PROP_Z + 0.3],
    ],
    80,
  );
  propeller.add(tagPart(new THREE.Mesh(thickLathe(spinner, 128, 0.01, 'in'), materials.propSpinner), 'spinner'));

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
    map: createPropDiscTexture(1024, blades, 0.16),
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
      [0.3, gbz(-1.8)],
      [0.38, gbz(-1.62)],
      [0.45, gbz(-1.35)],
      [0.46, gbz(-1.1)],
      [0.4, gbz(-0.92)],
      [0.35, gbz(-0.82)],
    ],
    60,
  );
  group.add(tagPart(new THREE.Mesh(latheFromProfile(rgb, 128), materials.castAlu), 'gearbox'));
  // Pervane valisi (dişli kutusunun üstünde) ve yağ karteri (altta)
  const gov = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.14, 20), materials.castAlu);
  gov.position.set(0, 0.49, gbz(-1.2));
  group.add(tagPart(gov, 'gearbox'));
  const govCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 16), materials.anodized);
  govCap.position.set(0, 0.575, gbz(-1.2));
  group.add(tagPart(govCap, 'gearbox'));
  const sump = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), materials.castAlu);
  sump.position.set(0, -0.47, gbz(-1.25));
  group.add(tagPart(sump, 'gearbox'));
  const rgbBolt = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6);
  rgbBolt.rotateX(Math.PI / 2);
  group.add(tagPart(radialInstances(rgbBolt, materials.machinery, 36, 0.455, gbz(-1.3)), 'gearbox'));

  /* ---------------- planet dişli takımı (dişli kutusunun içi) ----------------
   * Güneş dişlisi güç türbini milindedir, çember dişli gövdeye sabittir,
   * taşıyıcı pervaneyi çevirir: çıkış devri = giriş × Rg / (Rg + Rç).
   * Yalnız kesit görünümünde görülür. */
  const RS = 0.07;
  const RP = 0.1;
  const RR = RS + 2 * RP;
  const gearZ = gbz(-1.32);
  const sun = new THREE.Mesh(gearGeometry(RS, 18, 0.1), materials.hubMetal);
  sun.position.z = gearZ;
  const ring = new THREE.Mesh(gearGeometry(RR, 54, 0.1, true, RR + 0.04), materials.machinery);
  ring.position.z = gearZ;
  group.add(tagPart(ring, 'gearbox'));
  const carrier = new THREE.Group();
  carrier.name = 'planet-carrier';
  const planets = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pl = new THREE.Mesh(gearGeometry(RP, 26, 0.09), materials.hubMetal);
    pl.position.set(Math.cos(a) * (RS + RP), Math.sin(a) * (RS + RP), gearZ);
    carrier.add(tagPart(pl, 'gearbox'));
    planets.push(pl);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(RR - 0.02, RR - 0.02, 0.02, 48), materials.machinery);
  plate.rotation.x = Math.PI / 2;
  plate.position.z = gearZ - 0.08;
  carrier.add(tagPart(plate, 'gearbox'));
  // Pervane mili: taşıyıcıdan göbeğe
  const propShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 24), materials.hubMetal);
  propShaft.rotation.x = Math.PI / 2;
  propShaft.position.z = gearZ - 0.4;
  carrier.add(tagPart(propShaft, 'shafts'));
  propeller.add(carrier);

  /* ---------------- gaz jeneratörü + güç türbini ---------------- */
  const gas = buildGasPath(materials, g);
  group.add(gas.group);
  gas.lpSpool.add(tagPart(sun, 'gearbox'));

  const casePts = L.case;
  group.add(tagPart(new THREE.Mesh(thickLathe(smoothProfile(casePts, 80), 128, 0.01, 'in'), materials.engineCase), 'fanCase'));
  const prof = radiusProfile(casePts.map(([r, z]) => [r, z]));
  // Kit parçaları (Blender'da modellenmiş dış donanım, bkz. kit.js)
  const kit = new KitBatch(materials);
  for (const fz of [hz - 0.12, g.hpc.z1, cen.z + 0.06, cb.z1 + 0.02, g.lpt.z1 + 0.1]) {
    const r = prof(fz);
    const fl = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.01, 8, 96), materials.kitSteel ?? materials.machinery);
    fl.position.z = fz;
    group.add(tagPart(fl, 'fanCase'));
    flangeBolts(r + 0.013, fz, 36, { kit }, 0.009);
  }

  // Egzoz: jet borusu
  const ex = L.exhaust;
  const jetPipe = new THREE.Mesh(
    thickLathe(smoothProfile([[ex.r0, ex.z0], [(ex.r0 + ex.radius) / 2 + 0.005, (ex.z0 + ex.z1) / 2], [ex.radius, ex.z1]], 20), 96, 0.008, 'out'),
    materials.sooted,
  );
  group.add(tagPart(jetPipe, 'exhaust'));
  const tail = new THREE.Mesh(
    thickLathe(smoothProfile([[ex.coneR, ex.z0 - 0.03], [ex.coneR * 0.67, ex.z0 + 0.22], [0.01, ex.coneZ1]], 30), 48, 0.008, 'in'),
    materials.sooted,
  );
  group.add(tagPart(tail, 'exhaust'));

  /* ---------------- çene tipi hava girişi: S-kanal ---------------- */
  // Dişli kutusunun altındaki eliptik ağızdan başlar, geriye ve yukarı
  // kıvrılarak kompresör girişinin altındaki toplama odasına bağlanır
  const duct = new THREE.Mesh(
    ellipticDuct([
      [0, -0.6, hz - 0.94, 0.25, 0.13],
      [0, -0.6, hz - 0.68, 0.24, 0.13],
      [0, -0.55, hz - 0.38, 0.22, 0.12],
      [0, -0.42, hz - 0.18, 0.2, 0.1],
      [0, -0.3, hz - 0.08, 0.2, 0.09],
    ]),
    materials.engineCaseOpen ?? materials.engineCase,
  );
  group.add(tagPart(duct, 'inlet'));
  // Ağız dudağı: parlatılmış, eliptik
  const lipCurve = new THREE.EllipseCurve(0, 0, 0.25, 0.13);
  const lipPts = lipCurve.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y - 0.6, hz - 0.94));
  const lip = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts, true), 96, 0.022, 10, true),
    materials.polishedLip,
  );
  group.add(tagPart(lip, 'inlet'));
  // Toplama odası (plenum): kompresör girişini saran halka
  const plenum = new THREE.Mesh(
    latheFromProfile(smoothProfile([[0.24, hz - 0.18], [0.32, hz - 0.14], [0.33, hz - 0.08], [0.3, hz - 0.04]], 20), 96),
    materials.castAlu,
  );
  group.add(tagPart(plenum, 'inlet'));

  /* ---------------- dış tesisat ---------------- */
  const mats = {
    metal: materials.machinery,
    lever: materials.engineCase,
    ring: materials.hubMetal,
    pipe: materials.engineCase,
    anodized: materials.anodized,
    box: materials.boxPaint,
    braid: materials.braid,
    cast: materials.castAlu,
    tank: materials.engineCase,
    glass: materials.sightGlass,
    rubber: materials.hose,
    castKit: materials.kitCast,
    kit,
  };
  fuelManifold(group, prof, cb.z0 + 0.08, cb.injectors, mats, 'gearbox');
  igniters(group, prof, cb.z0 + 0.19, [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8], cb.z1 + 0.14, mats, 'gearbox');
  borescopePorts(group, prof, [hz + 0.22, cb.z1 - 0.16, g.hpt.z0, g.lpt.z0 + 0.06], 0.4, mats);
  oilTank(group, prof, { a: -0.15, z: hz + 0.27, len: 0.28, r: 0.065 }, mats);
  controlUnit(group, prof, { a: Math.PI + 0.25, z: hz + 0.37, w: 0.18, d: 0.26 }, mats);
  const pipe = (a0, a1, z0, z1, rad, mat, gap = 0.012) => hugPipe(group, prof, { a0, a1, z0, z1, rad, gap, mat, kit });
  pipe(0.35, 0.15, hz - 0.08, cb.z0 + 0.06, 0.013, materials.engineCase); // yakıt besleme
  pipe(-0.3, -0.6, hz + 0.32, g.lpt.z0 + 0.01, 0.009, materials.brassFitting, 0.01); // yağ dönüş
  pipe(Math.PI - 0.4, Math.PI - 0.1, hz - 0.03, g.lpt.z1, 0.009, materials.brassFitting, 0.01); // yağ basınç
  pipe(Math.PI / 2 + 0.5, Math.PI / 2 + 0.2, cen.z - 0.06, cb.z1 - 0.06, 0.022, materials.engineCase, 0.016); // bleed
  harness(group, prof, { a0: Math.PI + 0.15, a1: Math.PI + 0.55, z0: cen.z - 0.06, z1: g.lpt.z1 + 0.05, mat: materials.hose, kit });
  // Dişli kutusunun arka yüzündeki aksesuarlar (eksenel, +Z): starter-jeneratör,
  // yakıt kontrol ünitesi/pompa, hidrolik pompa
  for (const [x, y, r, l, kind] of [
    [0.3, 0.24, 0.085, 0.22, 'generator'],
    [-0.28, 0.26, 0.06, 0.18, 'pump'],
    [0.3, -0.24, 0.05, 0.16, 'hydPump'],
  ]) {
    const s = r / 0.06;
    kit.at(kind, Math.atan2(y, x), Math.hypot(x, y), L.gearbox.z1 - 0.05, { pitch: Math.PI / 2, scale: [s, l / 0.145, s] }, 'gearbox');
  }
  probes(prof, g.lpt.z1 + 0.05, 6, { kit }, 0.3, 'lpt');
  liftLugs(prof, [hz + 0.17, g.hpt.z0 + 0.06], { kit });
  group.add(kit.build());

  /* ---------------- test standı askısı ---------------- */
  const yoke = buildStandYoke(materials, { mounts: L.standZ, engineR: L.engineR });
  group.add(tagPart(yoke, 'stand'));

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

  // Planetlerin kendi eksenleri etrafındaki dönüşü: güneş ile taşıyıcı
  // arasındaki bağıl dönüşün RS/RP katı, ters yönde
  const tick = (lpAngle, propAngle) => {
    for (const p of planets) p.rotation.z = -(lpAngle - propAngle) * (RS / RP);
  };

  return {
    group,
    tick,
    lpSpool: gas.lpSpool,
    hpSpool: gas.hpSpool,
    propeller,
    blurDisc,
    blurMat,
    bladeCount: blades * 2,
    setPitch,
    stand: { yoke, mounts: L.standZ, engineR: L.engineR },
    intake: { z: hz - 0.9, radius: 0.2, y: -0.62 },
    exhaust: { z: ex.z1, radius: ex.radius },
    prop: { z: PROP_Z, radius: PROP_RADIUS, blades },
  };
}
