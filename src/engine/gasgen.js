/**
 * Serbest türbinli motorların ortak gaz jeneratörü (M5a P7): turboprop ve
 * turboşaft aynı çekirdeği kullanır. Eksenel + santrifüj HPC, yanma odası,
 * HPT, serbest güç türbini, dış gövde ve flanşları, kısa egzoz borusu ve
 * gövde tesisatı (yakıt manifoldu, ateşleyiciler, yağ hatları, kablo
 * demetleri, sondalar).
 *
 * Girdi: design/layouts/gasgen.ts `GasGeneratorLayout`. Sabit ölçüler (pay,
 * flanş, boru çapı) turboprop şablonunda elle ölçülmüş metre değerleridir;
 * başka boyuttaki gaz jeneratörü `k` ile ölçekler (k = HPC göz yarıçapı /
 * turboprop şablonununki). Turbopropta k = 1: model değişmez.
 */

import * as THREE from 'three';
import { smoothProfile, thickLathe, tagPart } from './geom.js';
import { buildGasPath } from './gaspath.js';
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
export function gearGeometry(r, teeth, depth, internal = false, outerR = r + 0.03) {
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
 * Planet dişli takımı (redüktör): güneş dişlisi güç türbini milinde, çember
 * dişli gövdeye sabit, taşıyıcı çıkışı çevirir. Çıkış devri = giriş ×
 * Rg / (Rg + Rç). Yalnız kesit görünümünde görülür.
 * @param {number} s ölçek (turboprop redüktörü 1)
 * @returns {{ sun: THREE.Mesh, ring: THREE.Mesh, carrier: THREE.Group, planets: THREE.Mesh[], RS: number, RP: number }}
 */
export function planetSet(materials, z, s = 1, part = 'gearbox') {
  const RS = 0.07 * s;
  const RP = 0.1 * s;
  const RR = RS + 2 * RP;
  const sun = new THREE.Mesh(gearGeometry(RS, 18, 0.1 * s), materials.hubMetal);
  sun.position.z = z;
  tagPart(sun, part);
  const ring = new THREE.Mesh(gearGeometry(RR, 54, 0.1 * s, true, RR + 0.04 * s), materials.machinery);
  ring.position.z = z;
  tagPart(ring, part);
  const carrier = new THREE.Group();
  carrier.name = 'planet-carrier';
  const planets = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pl = new THREE.Mesh(gearGeometry(RP, 26, 0.09 * s), materials.hubMetal);
    pl.position.set(Math.cos(a) * (RS + RP), Math.sin(a) * (RS + RP), z);
    carrier.add(tagPart(pl, part));
    planets.push(pl);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(RR - 0.02 * s, RR - 0.02 * s, 0.02 * s, 48), materials.machinery);
  plate.rotation.x = Math.PI / 2;
  plate.position.z = z - 0.08 * s;
  carrier.add(tagPart(plate, part));
  return { sun, ring, carrier, planets, RS, RP };
}

/**
 * Gaz jeneratörü modeli.
 * @param gg  design/layouts/gasgen.ts GasGeneratorLayout
 * @param o.k          sabit ölçülerin ölçeği (turboprop 1)
 * @param o.casePart   gövde parçası etiketi (turboprop 'fanCase', turboşaft 'engineCase')
 * @param o.extPart    tesisat etiketi (turboprop 'gearbox', turboşaft 'accessories')
 * @param o.exhaustMat egzoz borusu ve konisi malzemesi (turboprop isli; turboşaftın egzoz çerçevesi inconel)
 * @returns {{ group: THREE.Group, gas: { group, lpSpool, hpSpool }, prof: (z: number) => number, kit: KitBatch, mats: object }}
 *   kit henüz kurulmadı: çağıran kendi parçalarını ekleyip `kit.build()` eder
 */
export function buildGasGenerator(materials, gg, o = {}) {
  const k = o.k ?? 1;
  const casePart = o.casePart ?? 'fanCase';
  const extPart = o.extPart ?? 'gearbox';
  const exMat = o.exhaustMat ?? materials.sooted;
  const group = new THREE.Group();
  group.name = 'gas-generator';
  const g = gg.gas;
  const hz = g.hpc.z0; // HPC girişi: gövde donanımının çapası
  const cb = g.combustor;
  const cen = g.centrifugal;

  /* ---------------- gaz yolu ---------------- */
  const gas = buildGasPath(materials, g);
  group.add(gas.group);

  /* ---------------- gövde ve flanşlar ---------------- */
  const casePts = gg.case;
  group.add(tagPart(new THREE.Mesh(thickLathe(smoothProfile(casePts, 80), 128, 0.01 * k, 'in'), materials.engineCase), casePart));
  const prof = radiusProfile(casePts.map(([r, z]) => [r, z]));
  // Kit parçaları (Blender'da modellenmiş dış donanım, bkz. kit.js)
  const kit = new KitBatch(materials);
  // Ön flanş gövdenin ön ucunda (turbopropta hz − 0,12k; turboşaftta ağza kırpılmış)
  for (const fz of [casePts[0][1], g.hpc.z1, cen.z + 0.06 * k, cb.z1 + 0.02 * k, g.lpt.z1 + 0.1 * k]) {
    const r = prof(fz);
    const fl = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004 * k, 0.01 * k, 8, 96), materials.kitSteel ?? materials.machinery);
    fl.position.z = fz;
    group.add(tagPart(fl, casePart));
    flangeBolts(r + 0.013 * k, fz, 36, { kit }, 0.009 * k, casePart);
  }

  /* ---------------- egzoz: jet borusu ve kuyruk konisi ---------------- */
  const ex = gg.exhaust;
  const jetPipe = new THREE.Mesh(
    thickLathe(smoothProfile([[ex.r0, ex.z0], [(ex.r0 + ex.radius) / 2 + 0.005 * k, (ex.z0 + ex.z1) / 2], [ex.radius, ex.z1]], 20), 96, 0.008 * k, 'out'),
    exMat,
  );
  group.add(tagPart(jetPipe, 'exhaust'));
  const tail = new THREE.Mesh(
    thickLathe(smoothProfile([[ex.coneR, ex.z0 - 0.03 * k], [ex.coneR * 0.67, 0.5 * (ex.z0 + ex.coneZ1)], [0.01 * k, ex.coneZ1]], 30), 48, 0.008 * k, 'in'),
    exMat,
  );
  group.add(tagPart(tail, 'exhaust'));

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
  fuelManifold(group, prof, cb.z0 + 0.08 * k, cb.injectors, mats, extPart);
  igniters(group, prof, cb.z0 + 0.19 * k, [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8], cb.z1 + 0.14 * k, mats, extPart);
  borescopePorts(group, prof, [hz + 0.22 * k, cb.z1 - 0.16 * k, g.hpt.z0, g.lpt.z0 + 0.06 * k], 0.4, mats, casePart === 'fanCase' ? 'casing' : casePart);
  oilTank(group, prof, { a: -0.15, z: hz + 0.27 * k, len: 0.28 * k, r: 0.065 * k }, mats, extPart);
  controlUnit(group, prof, { a: Math.PI + 0.25, z: hz + 0.37 * k, w: 0.18 * k, d: 0.26 * k, h: 0.08 * k }, mats, extPart);
  const pipe = (a0, a1, z0, z1, rad, mat, gap = 0.012) => hugPipe(group, prof, { a0, a1, z0, z1, rad, gap, mat, kit, part: extPart });
  pipe(0.35, 0.15, hz - 0.08 * k, cb.z0 + 0.06 * k, 0.013 * k, materials.engineCase, 0.012 * k); // yakıt besleme
  pipe(-0.3, -0.6, hz + 0.32 * k, g.lpt.z0 + 0.01 * k, 0.009 * k, materials.brassFitting, 0.01 * k); // yağ dönüş
  pipe(Math.PI - 0.4, Math.PI - 0.1, hz - 0.03 * k, g.lpt.z1, 0.009 * k, materials.brassFitting, 0.01 * k); // yağ basınç
  pipe(Math.PI / 2 + 0.5, Math.PI / 2 + 0.2, cen.z - 0.06 * k, cb.z1 - 0.06 * k, 0.022 * k, materials.engineCase, 0.016 * k); // bleed
  harness(group, prof, { a0: Math.PI + 0.15, a1: Math.PI + 0.55, z0: cen.z - 0.06 * k, z1: g.lpt.z1 + 0.05 * k, mat: materials.hose, kit, part: extPart });
  probes(prof, g.lpt.z1 + 0.05 * k, 6, { kit }, 0.3, 'lpt');
  liftLugs(prof, [hz + 0.17 * k, g.hpt.z0 + 0.06 * k], { kit }, Math.PI / 2, casePart);

  return { group, gas, prof, kit, mats };
}
