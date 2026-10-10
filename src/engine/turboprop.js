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
import { buildStandYoke } from './stand.js';
import { createPropDiscTexture } from '../materials/textures.js';
import { buildGasGenerator, gearGeometry } from './gasgen.js';

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

  /* ---------------- gaz jeneratörü + güç türbini (gasgen.js) ----------------
   * Gaz yolu, gövde ve flanşlar, jet borusu, gövde tesisatı. Turbopropta
   * ölçek 1: M5a öncesi modelle aynı. */
  const gg = buildGasGenerator(materials, { gas: g, case: L.case, exhaust: L.exhaust, engineR: L.engineR, shafts: g.shafts }, { k: 1, casePart: 'fanCase', extPart: 'gearbox' });
  const gas = gg.gas;
  group.add(gg.group);
  gas.lpSpool.add(tagPart(sun, 'gearbox'));
  const { prof, kit } = gg;
  const ex = L.exhaust;

  /* ---------------- çene tipi hava girişi: S-kanal ---------------- */
  // Dişli kutusunun altındaki eliptik ağızdan başlar, geriye ve yukarı
  // kıvrılarak kompresör girişinin altındaki toplama odasına bağlanır.
  // Çapalar: ağız alanı giriş akışından (L.intake, eş alanlı daire; elips
  // en/boy 0,52), uç ve toplama odası kompresör gözüne (HPC ilk kademe
  // ucu; ölçüler M4 öncesi modelin 0,2 m'lik ucuna göre farktır). Dişli
  // kutusu pervane redüktörüdür, boyutu değişmez.
  const MOUTH_ASPECT = 0.52;
  const mouthA = L.intake.radius / Math.sqrt(MOUTH_ASPECT);
  const mouthB = mouthA * MOUTH_ASPECT;
  const kIn = mouthA / 0.25;
  const eye = g.hpc.tip[0];
  const dEye = eye - 0.2;
  const kEye = (eye + 0.13) / 0.33;
  // [x, y, z, genişlik, yükseklik, ağızdan uca geçiş payı]
  const ductPts = [
    [0, -0.6, hz - 0.94, 0.25, 0.13, 0],
    [0, -0.6, hz - 0.68, 0.24, 0.13, 0],
    [0, -0.55, hz - 0.38, 0.22, 0.12, 0.5],
    [0, -0.42, hz - 0.18, 0.2, 0.1, 1],
    [0, -0.3, hz - 0.08, 0.2, 0.09, 1],
  ].map(([x, y, z, w, h, f]) => {
    const k = THREE.MathUtils.lerp(kIn, kEye, f);
    return [x, y - dEye * f, z, w * k, h * k];
  });
  const duct = new THREE.Mesh(ellipticDuct(ductPts), materials.engineCaseOpen ?? materials.engineCase);
  group.add(tagPart(duct, 'inlet'));
  // Ağız dudağı: parlatılmış, eliptik
  const lipCurve = new THREE.EllipseCurve(0, 0, mouthA, mouthB);
  const lipPts = lipCurve.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y - 0.6, hz - 0.94));
  const lip = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts, true), 96, 0.022, 10, true),
    materials.polishedLip,
  );
  group.add(tagPart(lip, 'inlet'));
  // Toplama odası (plenum): kompresör girişini saran halka (gövde gibi göz yarıçapı + pay)
  const plenum = new THREE.Mesh(
    latheFromProfile(smoothProfile([[eye + 0.04, hz - 0.18], [eye + 0.12, hz - 0.14], [eye + 0.13, hz - 0.08], [eye + 0.1, hz - 0.04]], 20), 96),
    materials.castAlu,
  );
  group.add(tagPart(plenum, 'inlet'));

  /* ---------------- dış tesisat ---------------- */
  // Gövde tesisatı gasgen.js'te; burada redüktöre bağlı aksesuarlar.
  // Dişli kutusunun arka yüzündeki aksesuarlar (eksenel, +Z): starter-jeneratör,
  // yakıt kontrol ünitesi/pompa, hidrolik pompa. Gövdenin üstüne oturur:
  // gaz jeneratörü gövdesi incelince (M4 öncesi modelde 0,3 m) içeri kayar
  const accZ = L.gearbox.z1 - 0.05;
  const accShift = prof(accZ) - 0.3;
  for (const [x, y, r, l, kind] of [
    [0.3, 0.24, 0.085, 0.22, 'generator'],
    [-0.28, 0.26, 0.06, 0.18, 'pump'],
    [0.3, -0.24, 0.05, 0.16, 'hydPump'],
  ]) {
    const s = r / 0.06;
    kit.at(kind, Math.atan2(y, x), Math.hypot(x, y) + accShift, accZ, { pitch: Math.PI / 2, scale: [s, l / 0.145, s] }, 'gearbox');
  }
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
    intake: { ...L.intake },
    exhaust: { z: ex.z1, radius: ex.radius },
    prop: { z: PROP_Z, radius: PROP_RADIUS, blades },
  };
}
