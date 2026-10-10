/**
 * Turboşaft (M5a P7; T700 sınıfı): ortak gaz jeneratörü (gasgen.js) +
 * önden çıkışlı mil ve flanşı + entegre parçacık ayırıcılı halka giriş
 * çerçevesi + üstte aksesuar dişli kutusu. Pervane, çene S-kanalı ve pal
 * açısı (`setPitch`) yok; önden görünen kademe HPC'dir
 * (`bladeCount = hpc.blades[0]`).
 *
 * Test hücresinde motor itki çerçevesine asılıdır ve gücü su freni
 * (dinamometre) emer: flanşa esnek diskli kaplinli ara mille bağlı, beşik
 * yataklı (trunnion) tambur, tork kolu ve yük hücresi, su giriş/çıkış
 * boruları. Dinamometre stand askısının parçasıdır: yalnız hücrede görünür.
 *
 * Girdi: design/layouts/turboshaft.ts `TurboshaftLayout`. Sabit ölçüler
 * gaz jeneratörünün ölçeğiyle (`L.k`) büyür.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, thickLathe, radialInstances, tagPart } from './geom.js';
import { buildGasGenerator, gearGeometry } from './gasgen.js';
import { buildStandYoke, yokeScale, BEAM_Y, CELL_FLOOR_Y } from './stand.js';
import { radiusProfile, accessoryGearbox, hugPipe, flangeBolts } from './externals.js';

const lerp = (a, b, t) => a + (b - a) * t;

/** Z ekseni boyunca silindir (y ekseninden döndürülmüş) */
function zCylinder(r0, r1, len, seg = 32) {
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/**
 * @param {import('./models').Materials} materials
 * @param {import('./models').VisualSource} src
 * @returns {import('./models').EngineModel}
 */
export function buildTurboshaft(materials, src) {
  const L = src.layout;
  if (L.style !== 'turboshaft') throw new Error(`Turboşaft modeli turboşaft yerleşimi ister (gelen: ${L.style}).`);
  const k = L.k;
  const group = new THREE.Group();
  group.name = 'turboshaft';
  const g = L.gg.gas;
  const hz = g.hpc.z0;
  const inl = L.inlet;
  const out = L.output;
  const hs = L.housing;

  /* ---------------- gaz jeneratörü + serbest güç türbini ---------------- */
  const gg = buildGasGenerator(materials, L.gg, {
    k,
    casePart: 'engineCase',
    extPart: 'accessories',
    // Egzoz çerçevesi ve kanalı inconel: ısıyla renk alır, isli değil (T5 ~800 K)
    exhaustMat: materials.inconel ?? materials.sooted,
  });
  group.add(gg.group);
  const { kit, mats } = gg;
  const lpSpool = gg.gas.lpSpool;
  const hpSpool = gg.gas.hpSpool;

  /* ---------------- halka giriş çerçevesi (girdap kanatları, ayırıcı) ---------------- */
  const z0 = inl.z0;
  const z1 = inl.z1;
  const len = z1 - z0;
  const caseFront = L.gg.case[0]; // [r, z]: gaz jeneratörü gövdesinin ön ucu
  const frameR = L.frameR;
  // Çerçevenin içindeki parçalar (ayırıcı salyangozu, dış duvarın ağzı)
  // çerçeve kabuğunun ve onun arkasındaki gaz jeneratörü gövdesinin içinde
  // kalır (büyük merkez gövdeli girişte gövde çerçeveden dar olabilir)
  const shellIn = (z, gap) => Math.min(frameR, z <= caseFront[1] ? frameR : gg.prof(z)) - gap;
  const zFrameEnd = Math.max(caseFront[1], z0 + 0.4 * len);
  // Çerçevenin dış kabuğu: ağız flanşından gaz jeneratörü gövdesine
  const frameShell = thickLathe(
    smoothProfile(
      [
        [frameR - 0.018 * k, z0 + 0.004 * k],
        [frameR, z0 + 0.03 * k],
        [frameR, lerp(z0, zFrameEnd, 0.7)],
        [lerp(frameR, caseFront[0], 0.6), lerp(z0, zFrameEnd, 0.92)],
        [caseFront[0], zFrameEnd],
      ],
      40,
    ),
    128,
    0.008 * k,
    'in',
  );
  group.add(tagPart(new THREE.Mesh(frameShell, materials.engineCase), 'inlet'));
  // Ağız: parlatılmış dış ve iç dudak, dış dudakla çerçeve arasında ön yüz
  const lipO = new THREE.Mesh(new THREE.TorusGeometry(inl.rOuter + 0.011 * k, 0.011 * k, 12, 128), materials.polishedLip);
  lipO.position.z = z0;
  group.add(tagPart(lipO, 'inlet'));
  const face = thickLathe(
    [
      [inl.rOuter + 0.02 * k, z0 + 0.002 * k],
      [frameR - 0.016 * k, z0 + 0.004 * k],
    ].map(([r, z]) => new THREE.Vector2(r, z)),
    128,
    0.006 * k,
    [inl.rOuter + 0.05 * k, z0 + 0.03 * k],
  );
  group.add(tagPart(new THREE.Mesh(face, materials.engineCase), 'inlet'));
  flangeBolts(lerp(inl.rOuter + 0.02 * k, frameR, 0.55), z0 + 0.004 * k, 24, { kit }, 0.004 * k, 'inlet');

  // Dış kanal duvarı: ayırıcı varsa dış akış salyangoza açılır; yoksa HPC ucuna iner
  const tipIn = g.hpc.tip[0] + 0.008 * k;
  const outerWall = inl.separator
    ? [
        [inl.rOuter + 0.011 * k, z0],
        [inl.rOuter + 0.004 * k, z0 + 0.3 * len],
        [inl.rOuter + 0.016 * k, z0 + 0.58 * len],
        [shellIn(z0 + 0.78 * len, 0.022 * k), z0 + 0.78 * len],
      ]
    : [
        [inl.rOuter + 0.011 * k, z0],
        [inl.rOuter, z0 + 0.35 * len],
        [lerp(inl.rOuter, tipIn, 0.7), z0 + 0.75 * len],
        [tipIn, z1],
      ];
  group.add(tagPart(new THREE.Mesh(thickLathe(smoothProfile(outerWall, 40), 128, 0.004 * k, 'out'), materials.engineCase), 'inlet'));

  // Merkez gövde: mil gövdesini sarar, HPC göbeğine iner. İniş dikse
  // (düşük çıkış devrinde kalın mil gövdesi) daha önce başlar
  const hubIn = g.hpc.hub[0];
  const steep = THREE.MathUtils.clamp(((inl.rInner - hubIn) / len - 0.25) / 0.5, 0, 1);
  const centerbody = thickLathe(
    smoothProfile(
      [
        [hs.r * 1.02, z0 - 0.02 * k],
        [inl.rInner, z0 + 0.03 * k],
        [inl.rInner * 0.99, z0 + lerp(0.55, 0.3, steep) * len],
        [lerp(inl.rInner, hubIn, 0.7), z0 + lerp(0.85, 0.78, steep) * len],
        [hubIn, z1 + 0.004 * k],
      ],
      40,
    ),
    128,
    0.006 * k,
    'in',
  );
  group.add(tagPart(new THREE.Mesh(centerbody, materials.castAlu), 'inlet'));
  const lipI = new THREE.Mesh(new THREE.TorusGeometry(inl.rInner - 0.002 * k, 0.006 * k, 10, 96), materials.polishedLip);
  lipI.position.z = z0 + 0.022 * k;
  group.add(tagPart(lipI, 'inlet'));

  // Girdap kanatları (swirl vanes): kuma ve toza dönme verir, ağır taneler
  // merkezkaçla dış duvara savrulur
  const vaneSpan = inl.rOuter - inl.rInner - 0.006 * k;
  const vaneGeo = new THREE.BoxGeometry(0.0045 * k, vaneSpan, 0.28 * len);
  vaneGeo.translate(0, inl.rInner + 0.003 * k + vaneSpan / 2, 0);
  group.add(
    tagPart(radialInstances(vaneGeo, materials.machinery, 16, 0, z0 + 0.24 * len, { extraRotation: new THREE.Euler(0, 0.5, 0) }), 'inlet'),
  );

  if (inl.separator) {
    // Ayırıcı dudağı: temiz çekirdek havası içeride HPC'ye, tozlu dış akış salyangoza
    const rSplit = lerp(inl.rInner, inl.rOuter, 0.62);
    const splitter = thickLathe(
      smoothProfile(
        [
          [rSplit, z0 + 0.55 * len],
          [lerp(rSplit, tipIn, 0.45), z0 + 0.72 * len],
          [tipIn, z1],
        ],
        30,
      ),
      128,
      0.004 * k,
      'out',
    );
    group.add(tagPart(new THREE.Mesh(splitter, materials.engineCase), 'inlet'));
    const splitLip = new THREE.Mesh(new THREE.TorusGeometry(rSplit + 0.002 * k, 0.003 * k, 8, 96), materials.polishedLip);
    splitLip.position.z = z0 + 0.55 * len;
    group.add(tagPart(splitLip, 'inlet'));
    // Toplama salyangozu (scroll): çerçevenin içinde, tozlu havayı üfleyiciye götürür
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(shellIn(z0 + 0.8 * len, 0.028 * k), 0.02 * k, 12, 128), materials.castAlu);
    scroll.position.z = z0 + 0.8 * len;
    group.add(tagPart(scroll, 'inlet'));
  }

  /* ---------------- aksesuar dişli kutusu (üstte, giriş çerçevesinin üzerinde) ---------------- */
  // Profil: çerçeve kabuğu + gaz jeneratörü gövdesi
  const prof = radiusProfile([[frameR, z0], [frameR, lerp(z0, zFrameEnd, 0.7)], ...L.gg.case.filter(([, z]) => z > zFrameEnd)]);
  const agbZ0 = z0 + 0.015 * k;
  const agbLen = Math.max(0.12, hz + 0.16 * k - agbZ0);
  const az = (t) => agbZ0 + t * agbLen;
  accessoryGearbox(
    group,
    prof,
    {
      z0: agbZ0,
      len: agbLen,
      arc: 1.0,
      depth: 0.085 * k + 0.03,
      center: Math.PI / 2,
      accessories: [
        { kind: 'starter', da: -0.3, z: az(0.3), r: 0.05 * k + 0.012, h: 0.16 * k },
        { kind: 'generator', da: 0.3, z: az(0.35), r: 0.055 * k + 0.012, h: 0.15 * k },
        { kind: 'pump', da: 0.02, z: az(0.75), r: 0.04 * k + 0.01, h: 0.12 * k },
      ],
    },
    mats,
    'accessories',
  );
  // Parçacık ayırıcı üfleyicisi (dişli kutusundan tahrikli) ve tahliye kanalı
  if (inl.separator) {
    const bA = Math.PI / 2 + 0.85;
    const rb = frameR + 0.04 * k;
    const bz = z0 + 0.62 * len;
    const blower = new THREE.Mesh(zCylinder(0.05 * k + 0.015, 0.05 * k + 0.015, 0.06 * k + 0.02, 28), materials.castAlu);
    blower.position.set(Math.cos(bA) * rb, Math.sin(bA) * rb, bz);
    group.add(tagPart(blower, 'inlet'));
    const exA = bA + 0.25;
    const duct = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(bA) * rb, Math.sin(bA) * rb, bz),
      new THREE.Vector3(Math.cos(exA) * (rb + 0.06 * k), Math.sin(exA) * (rb + 0.06 * k), bz + 0.05 * k),
      new THREE.Vector3(Math.cos(exA + 0.2) * (rb + 0.16 * k), Math.sin(exA + 0.2) * (rb + 0.16 * k), bz + 0.16 * k),
    ]);
    group.add(tagPart(new THREE.Mesh(new THREE.TubeGeometry(duct, 24, 0.024 * k + 0.006, 14, false), materials.engineCase), 'inlet'));
    const ductLip = new THREE.Mesh(new THREE.TorusGeometry(0.024 * k + 0.006, 0.004 * k, 8, 24), materials.polishedLip);
    ductLip.position.copy(duct.getPointAt(1));
    ductLip.lookAt(ductLip.position.clone().add(duct.getTangentAt(1)));
    group.add(tagPart(ductLip, 'inlet'));
  }
  // Yakıt girişi ve aksesuar yağ hattı: dişli kutusundan yanma odasına
  hugPipe(group, prof, { a0: Math.PI / 2 - 0.55, a1: Math.PI / 2 - 0.9, z0: az(0.8), z1: g.combustor.z0, rad: 0.009 * k, gap: 0.012 * k, mat: materials.brassFitting, kit, part: 'accessories' });

  /* ---------------- çıkış mili, flanş, mil gövdesi, (redüktör) ---------------- */
  // Dönen grup: doğrudan tahrikte güç türbini milinde, redüktörde kendi devrinde
  const outGroup = new THREE.Group();
  outGroup.name = 'output-shaft';
  // Redüktör kutusu: ön kapak (konik) kutunun ilk %20'si, dişliler kalanında
  const hz0 = hs.z0 + 0.004 * k;
  const gz1 = hs.gearbox[1];
  const gl = gz1 - hz0;
  const gears = out.reduction
    ? reductionGears(materials, {
        z0: hz0 + 0.2 * gl,
        z1: gz1 - 0.04 * gl,
        R: hs.gearboxR * 0.86,
        ratio: out.gearRatio,
        part: 'outputShaft',
      })
    : null;
  const shaftZ0 = out.z - 0.025 * k;
  // Doğrudan tahrikte mil merkez gövdeye girer (güç türbini milinin
  // uzantısı); redüktörde çıkış kademesinde (taşıyıcı ya da çıkış dişlisi) biter
  const shaftZ1 = gears ? gears.outZ : z0 + 0.05 * k;
  const shaft = new THREE.Mesh(zCylinder(out.radius, out.radius, shaftZ1 - shaftZ0, 40), materials.hubMetal);
  shaft.position.z = (shaftZ0 + shaftZ1) / 2;
  outGroup.add(tagPart(shaft, 'outputShaft'));
  // Flanş (kaplin göbeği): kalın disk, ön yüzde cıvata halkası ve merkezleme çıkıntısı
  const flT = 0.02 * k;
  const flange = new THREE.Mesh(zCylinder(out.flangeR, out.flangeR, flT, 64), materials.machinery);
  flange.position.z = out.z;
  outGroup.add(tagPart(flange, 'outputShaft'));
  const pilot = new THREE.Mesh(zCylinder(out.radius * 1.5, out.radius * 1.5, 0.012 * k, 40), materials.hubMetal);
  pilot.position.z = out.z - flT / 2 - 0.006 * k;
  outGroup.add(tagPart(pilot, 'outputShaft'));
  const boltGeo = zCylinder(0.0055 * k, 0.0055 * k, 0.012 * k, 6);
  outGroup.add(tagPart(radialInstances(boltGeo, materials.machinery, 8, out.flangeR * 0.74, out.z - flT / 2 - 0.004 * k), 'outputShaft'));
  // Kanal dişli (spline) kaplin: flanşın arkasında, milin üstünde
  const splineN = 24;
  const splineGeo = new THREE.BoxGeometry(0.004 * k, 0.006 * k, 0.05 * k);
  splineGeo.translate(0, out.radius + 0.003 * k, 0);
  outGroup.add(tagPart(radialInstances(splineGeo, materials.hubMetal, splineN, 0, out.z + flT / 2 + 0.03 * k), 'outputShaft'));

  // Mil gövdesi: flanşın arkasından merkez gövdeye. Redüktörde dişli
  // kutusu (pahlı tambur) ağzın önünde biter; boyundan hava ağza yandan girer.
  // Kutunun köşeleri keskin: eğri (spline) kısa kutuda taşar
  let housingPts;
  let housingCurve;
  if (out.reduction) {
    const gR = hs.gearboxR;
    const c = Math.min(0.012 * k, 0.1 * gl);
    const neckEnd = hs.z1 - 0.004 * k;
    housingPts = [
      [out.flangeR * 0.9, hz0],
      [hs.r, hz0 + c],
      [gR - c, hz0 + 0.18 * gl],
      [gR, hz0 + 0.18 * gl + c],
      [gR, gz1 - c],
      [gR - c, gz1],
      [hs.r * 1.08, gz1],
      ...(neckEnd - gz1 > 2 * c ? [[hs.r * 1.04, gz1 + c]] : []),
      [hs.r * 1.02, Math.max(neckEnd, gz1 + 1e-4)],
    ];
    housingCurve = housingPts.map(([r, z]) => new THREE.Vector2(r, z));
  } else {
    housingPts = [
      [out.flangeR * 0.9, hz0],
      [hs.r, hz0 + 0.04 * k],
      [hs.r * 1.04, lerp(hz0, hs.z1, 0.6)],
      [hs.gearboxR * 1.02, hs.z1 - 0.02 * k],
    ];
    housingCurve = smoothProfile(housingPts, 40);
  }
  group.add(tagPart(new THREE.Mesh(thickLathe(housingCurve, 96, 0.006 * k, 'in'), materials.engineCase), 'outputShaft'));
  flangeBolts(hs.r + 0.008 * k, hz0 + 0.03 * k, 12, { kit }, 0.005 * k, 'outputShaft');
  // Yağ besleme ve tahliye: mil gövdesinin yataklarına
  const housingProf = radiusProfile(housingPts.map(([r, z]) => [r, z]));
  hugPipe(group, (z) => (z < hs.z1 ? housingProf(z) : prof(z)), {
    a0: -Math.PI / 2 + 0.4,
    a1: -Math.PI / 2 + 0.1,
    z0: hz0 + 0.05 * k,
    z1: z0 + 0.6 * len,
    rad: 0.006 * k,
    gap: 0.01 * k,
    mat: materials.brassFitting,
    kit,
    part: 'outputShaft',
  });

  if (gears) {
    // Redüktör dişli takımı orana göre boyutlanır (kinematik tutarlı):
    // giriş güç türbini milinde, çıkış flanşın milinde. Testler ve kesit etiketleri için: takımın türü ve yarıçapları
    outGroup.userData.gears = { kind: gears.kind, radii: gears.radii };
    lpSpool.add(gears.input);
    group.add(gears.fixed);
    outGroup.add(gears.output);
    group.add(outGroup);
  } else {
    // Doğrudan tahrik: çıkış mili güç türbini milinin uzantısı
    lpSpool.add(outGroup);
  }

  /* ---------------- askı pabuçları ---------------- */
  // Stand askısının yastıkları gövdenin en geniş yerinin üstündedir;
  // daha ince bölümde (egzoz çerçevesi) gövdeden yastığa çıkan dökme pabuç
  // Pabuç ölçüleri askının yastığıyla (yokeScale)
  const ys = yokeScale(L.engineR);
  for (const mz of L.standZ) {
    const r = gg.prof(mz);
    const h = L.engineR + 0.005 - r;
    if (h < 0.01) continue;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.075 * ys, h, 0.09 * ys), materials.kitCast ?? materials.castAlu);
    lug.position.set(0, r + h / 2 - 0.004, mz);
    group.add(tagPart(lug, 'engineCase'));
    for (const x of [-1, 1]) {
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.012 * ys, h * 0.8, 0.16 * ys), materials.kitCast ?? materials.castAlu);
      web.position.set(x * 0.03 * ys, r + h * 0.4 - 0.004, mz);
      group.add(tagPart(web, 'engineCase'));
    }
  }

  /* ---------------- dış donanım kit parçaları ---------------- */
  group.add(kit.build());

  /* ---------------- test standı askısı + dinamometre ---------------- */
  const yoke = buildStandYoke(materials, { mounts: L.standZ, engineR: L.engineR });
  const dyno = buildDynamometer(materials, L, Math.min(...L.standZ) - 0.25);
  yoke.add(dyno.group);
  group.add(tagPart(yoke, 'stand'));

  // Doğrudan tahrikte çıkış (flanş) güç türbini milinin parçası: oran 1,
  // ara mil ve kaplin flanşla birlikte döner
  const ratio = out.reduction ? Math.max(out.gearRatio, 1e-3) : 1;
  const tick = (lpAngle) => {
    const a = lpAngle / ratio;
    dyno.drive.rotation.z = a;
    if (gears) {
      outGroup.rotation.z = a;
      gears.tick(lpAngle, a);
    }
  };

  return {
    group,
    lpSpool,
    hpSpool,
    bladeCount: g.hpc.blades[0],
    stand: { yoke, mounts: L.standZ, engineR: L.engineR },
    intake: { ...L.intake },
    exhaust: { z: L.exhaustExit.z, radius: L.exhaustExit.radius },
    outputShaft: outGroup,
    tick,
  };
}

/** Bu orandan büyükte planet takımı; altında (1'e yakın ya da devir artırıcı) bileşik dişli dizisi */
export const PLANET_MIN_RATIO = 2.6;

/**
 * Redüktör dişli takımı, istenen orana göre boyutlanır; dişler kaymaz:
 *  - i ≥ PLANET_MIN_RATIO: planet takımı. Çember gövdeye sabit, güneş güç
 *    türbini milinde, taşıyıcı çıkışta: i = 1 + Rç/Rg, Rç = Rg + 2·Rp →
 *    Rp = Rg·(i − 2)/2.
 *  - Aksi halde: eş eksenli bileşik (geri dönüşlü) dizi. Gövdeye yataklı üç
 *    ara mil; giriş dişlisi (R1) ara milin R2'sini, ara milin R3'ü çıkış
 *    dişlisini (R4) çevirir: i = (R2/R1)·(R4/R3), eksenler çakışık
 *    (R1 + R2 = R3 + R4). İki kademe eşit oranda (√i): devir artırıcıda
 *    (i < 1) giriş dişlisi büyüktür. İki dış kavrama: çıkış girişle aynı yönde.
 * Giriş kademesi arkada (güç türbini tarafı), çıkış kademesi önde (flanş).
 * @param {{ z0: number, z1: number, R: number, ratio: number, part: string }} o
 *   z0–z1 kutunun içindeki eksenel aralık, R dişlilerin sığacağı yarıçap
 * @returns {{ input: THREE.Group, fixed: THREE.Group, output: THREE.Group, kind: 'planet' | 'compound', radii: number[], outZ: number, tick: (lpAngle: number, outAngle: number) => void }}
 *   outZ: çıkış kademesinin ekseni (çıkış mili orada biter)
 */
export function reductionGears(materials, o) {
  const { z0, z1, R, ratio: i, part } = o;
  const span = Math.max(z1 - z0, 1e-3);
  const input = new THREE.Group();
  input.name = 'gear-input';
  const fixed = new THREE.Group();
  fixed.name = 'gear-fixed';
  const output = new THREE.Group();
  output.name = 'gear-output';
  const add = (parent, mesh) => parent.add(tagPart(mesh, part));
  const teeth = (r, m) => Math.max(8, Math.round(r / m));

  if (i >= PLANET_MIN_RATIO) {
    const RR = R * 0.84;
    const RS = RR / (i - 1);
    const RP = (RR - RS) / 2;
    const m = RR / 60;
    const w = Math.min(0.12 * RR, 0.42 * span);
    const zg = z0 + span * 0.55;
    const sun = new THREE.Mesh(gearGeometry(RS, teeth(RS, m), w), materials.hubMetal);
    sun.position.z = zg;
    add(input, sun);
    // Güneş göbeği: güç türbini milinden dişliye
    const hub = new THREE.Mesh(zCylinder(RS * 0.45, RS * 0.45, span * 0.5, 24), materials.hubMetal);
    hub.position.z = zg + span * 0.2;
    add(input, hub);
    const ring = new THREE.Mesh(gearGeometry(RR, teeth(RR, m), w, true, Math.min(R, RR * 1.12)), materials.machinery);
    ring.position.z = zg;
    add(fixed, ring);
    const planets = [];
    // Komşu planetler çakışmasın: 2·Rp < 2·(Rg + Rp)·sin(π/n)
    const nP = RP < (RS + RP) * Math.sin(Math.PI / 4) * 0.92 ? 4 : 3;
    for (let j = 0; j < nP; j++) {
      const a = (j / nP) * Math.PI * 2;
      const pl = new THREE.Mesh(gearGeometry(RP, teeth(RP, m), w * 0.92), materials.hubMetal);
      pl.position.set(Math.cos(a) * (RS + RP), Math.sin(a) * (RS + RP), zg);
      add(output, pl);
      planets.push(pl);
      const pin = new THREE.Mesh(zCylinder(RP * 0.28, RP * 0.28, w * 1.6, 16), materials.machinery);
      pin.position.set(pl.position.x, pl.position.y, zg - w * 0.3);
      add(output, pin);
    }
    // Taşıyıcı plakası: planetlerin önünde, çıkış miline bağlı
    const plateR = RS + 1.9 * RP;
    const plate = new THREE.Mesh(zCylinder(plateR, plateR, 0.15 * w, 48), materials.machinery);
    plate.position.z = zg - w * 0.62;
    add(output, plate);
    return {
      input,
      fixed,
      output,
      kind: 'planet',
      radii: [RS, RP, RR],
      outZ: plate.position.z,
      tick(lpAngle, outAngle) {
        // Planet taşıyıcıya göre döner: güneşle kavrama Rg·(θg − θt) = −Rp·φ
        const phi = (-(lpAngle - outAngle) * RS) / RP;
        for (const p of planets) p.rotation.z = phi;
      },
    };
  }

  // Bileşik dizi: q = √i her kademede; en dış uç (C + büyük dişli) R'ye sığar
  const q = Math.sqrt(i);
  const C = (R * 0.9) / (1 + Math.max(q, 1) / (1 + q));
  const R1 = C / (1 + q);
  const R2 = C - R1;
  const R3 = R1;
  const R4 = R2;
  const m = C / 26;
  const w = Math.min(0.22 * C, 0.3 * span);
  const zIn = z1 - w * 0.75; // giriş kademesi arkada
  const zOut = z0 + w * 0.75; // çıkış kademesi önde
  const g1 = new THREE.Mesh(gearGeometry(R1, teeth(R1, m), w), materials.hubMetal);
  g1.position.z = zIn;
  add(input, g1);
  const g4 = new THREE.Mesh(gearGeometry(R4, teeth(R4, m), w), materials.hubMetal);
  g4.position.z = zOut;
  add(output, g4);
  const lays = [];
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * Math.PI * 2 + Math.PI / 6;
    const lay = new THREE.Group();
    lay.name = 'layshaft';
    lay.position.set(Math.cos(a) * C, Math.sin(a) * C, 0);
    const g2 = new THREE.Mesh(gearGeometry(R2, teeth(R2, m), w * 0.95), materials.hubMetal);
    g2.position.z = zIn;
    add(lay, g2);
    const g3 = new THREE.Mesh(gearGeometry(R3, teeth(R3, m), w * 0.95), materials.hubMetal);
    g3.position.z = zOut;
    add(lay, g3);
    const axR = Math.min(R2, R3) * 0.32;
    const axle = new THREE.Mesh(zCylinder(axR, axR, zIn - zOut + w * 1.4, 16), materials.machinery);
    axle.position.z = (zIn + zOut) / 2;
    add(lay, axle);
    fixed.add(lay);
    lays.push(lay);
  }
  return {
    input,
    fixed,
    output,
    kind: 'compound',
    radii: [R1, R2, R3, R4],
    outZ: zOut,
    tick(lpAngle) {
      // Ara mil girişle ters yönde, R1/R2 oranında
      const th = (-lpAngle * R1) / R2;
      for (const l of lays) l.rotation.z = th;
    },
  };
}

/**
 * Su freni dinamometresi ve askısı (hücre donanımı): motorun önünde, itki
 * çerçevesinin kirişine asılı. Tambur beşik yataklıdır: suyun rotora
 * uyguladığı tork tamburu döndürmeye çalışır, tork kolu bunu yük hücresine
 * iletir (güç = tork × devir). Ara mil esnek diskli kaplinlerle flanşa
 * bağlanır ve koruma kafesinin içinde döner.
 * @param {number} beamZ1 stand kirişinin ön ucu (askı kirişi buraya uzanır)
 */
function buildDynamometer(materials, L, beamZ1) {
  const group = new THREE.Group();
  group.name = 'dynamometer';
  const out = L.output;
  // Tambur boyutu çıkış flanşına göre (güç ↔ tork); T700 sınıfında ~0,45 m çap
  const Rd = THREE.MathUtils.clamp(out.flangeR * 2.9, 0.16, 0.42);
  const Ld = 1.9 * Rd;
  const zb = out.z - 0.62; // tamburun arka yüzü (motor tarafı)
  const zf = zb - Ld;
  const paint = materials.standPaint;
  const steel = materials.kitSteel ?? materials.machinery;
  const castM = materials.kitCast ?? materials.castAlu;

  // --- Tambur: döküm gövde, uç kapakları, takviye kaburgaları ---
  const body = latheFromProfile(
    smoothProfile(
      [
        [0.001, zf],
        [Rd * 0.55, zf + 0.004],
        [Rd * 0.9, zf + 0.03],
        [Rd, zf + 0.09],
        [Rd, zb - 0.09],
        [Rd * 0.9, zb - 0.03],
        [Rd * 0.55, zb - 0.004],
        [0.001, zb],
      ],
      60,
    ),
    96,
  );
  // Gövde boyalı döküm (endüstriyel yeşil-gri); kaburgalar ve uç kapakları çıplak döküm
  group.add(new THREE.Mesh(body, materials.boxPaint ?? castM));
  const ribGeo = new THREE.BoxGeometry(0.018, 0.035, Ld - 0.2);
  ribGeo.translate(0, Rd + 0.012, 0);
  group.add(radialInstances(ribGeo, castM, 8, 0, (zf + zb) / 2, { phase: Math.PI / 8 }));
  for (const z of [zf + 0.07, zb - 0.07]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(Rd + 0.006, 0.012, 8, 72), castM);
    band.position.z = z;
    group.add(band);
  }
  // Uç yatak kovanları
  const brgR = Rd * 0.32;
  for (const [z, s] of [
    [zf - 0.04, -1],
    [zb + 0.04, 1],
  ]) {
    const brg = new THREE.Mesh(zCylinder(brgR, brgR * 1.08, 0.08, 40), steel);
    brg.position.z = z;
    group.add(brg);
    const cap = new THREE.Mesh(zCylinder(brgR * 0.6, brgR * 0.6, 0.02, 32), castM);
    cap.position.z = z + s * 0.045;
    group.add(cap);
  }

  // --- Beşik (trunnion) askısı: kirişten inen levhalar, yatak halkaları ---
  // Askı levhaları motorun askısıyla aynı ölçekte (yokeScale): küçük motorda ince
  const ys = yokeScale(L.engineR);
  const top = BEAM_Y - 0.12;
  for (const z of [zf - 0.04, zb + 0.04]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(brgR * 1.18, 0.022 * ys, 10, 48), paint);
    ring.position.z = z;
    group.add(ring);
    for (const x of [-1, 1]) {
      const bottom = 0;
      const h = top - bottom;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03 * ys, h, 0.16 * ys), paint);
      plate.position.set(x * (brgR * 1.18 + 0.03 * ys), bottom + h / 2, z);
      group.add(plate);
    }
  }
  // Askı kirişi: stand kirişinin önünden tamburun önüne (I profil)
  const bz0 = zf - 0.25;
  const bLen = beamZ1 - bz0;
  for (const dy of [0.11, -0.11]) {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, bLen), paint);
    fl.position.set(0, BEAM_Y + dy, bz0 + bLen / 2);
    group.add(fl);
  }
  const web = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, bLen), paint);
  web.position.set(0, BEAM_Y, bz0 + bLen / 2);
  group.add(web);

  // --- Tork kolu ve yük hücresi ---
  const armL = Rd + 0.42;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(armL, 0.06, 0.08), steel);
  arm.position.set(armL / 2, 0, zf + Ld * 0.5);
  group.add(arm);
  const cellY0 = 0.03;
  const link = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, top - cellY0 - 0.14, 12), steel);
  link.position.set(armL - 0.03, cellY0 + (top - cellY0 - 0.14) / 2 + 0.14, zf + Ld * 0.5);
  group.add(link);
  const loadCell = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 24), materials.anodized);
  loadCell.position.set(armL - 0.03, cellY0 + 0.1, zf + Ld * 0.5);
  group.add(loadCell);
  const lcBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), materials.boxPaint);
  lcBox.position.set(armL - 0.03, top - 0.05, zf + Ld * 0.5);
  group.add(lcBox);

  // --- Su giriş/çıkış boruları: zemindeki kanala iner ---
  const floorY = CELL_FLOOR_Y;
  const pipeTo = (pts, r, mat) => {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 64, r, 14, false), mat));
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.8, r * 1.8, 0.02, 20), steel);
    fl.position.set(pts[pts.length - 1][0], floorY + 0.01, pts[pts.length - 1][2]);
    group.add(fl);
  };
  const zi = zf + Ld * 0.3;
  pipeTo([[0, -Rd, zi], [0, -Rd - 0.25, zi], [-0.05, -Rd - 0.8, zi - 0.05], [-0.35, floorY + 0.6, zi - 0.1], [-0.4, floorY, zi - 0.1]], 0.035, materials.hose);
  const zo = zf + Ld * 0.72;
  pipeTo([[-Rd * 0.7, Rd * 0.7, zo], [-Rd - 0.18, Rd * 0.9, zo], [-Rd - 0.4, 0, zo + 0.05], [-Rd - 0.5, floorY + 0.5, zo + 0.1], [-Rd - 0.5, floorY, zo + 0.1]], 0.045, steel);
  // Su seviyesi (yük) kontrol vanası ve aktüatörü: çıkış borusunda
  const valve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), materials.boxPaint);
  valve.position.set(-Rd - 0.42, -0.35, zo + 0.07);
  group.add(valve);
  const act = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 20), materials.anodized);
  act.rotation.z = Math.PI / 2;
  act.position.set(-Rd - 0.58, -0.35, zo + 0.07);
  group.add(act);

  // --- Ara mil: diskli kaplinler, boru mil, koruma kafesi ---
  const drive = new THREE.Group();
  drive.name = 'dyno-drive';
  const dz0 = zb + 0.08;
  const dz1 = out.z - 0.035;
  const tubeR = Math.max(0.025, out.radius * 1.3);
  const tube = new THREE.Mesh(zCylinder(tubeR, tubeR, dz1 - dz0 - 0.12, 32), materials.hubMetal);
  tube.position.z = (dz0 + dz1) / 2;
  drive.add(tube);
  const cR = Math.max(out.flangeR, tubeR * 2.4);
  for (const z of [dz0 + 0.03, dz1 - 0.03]) {
    for (const dzz of [-0.022, 0, 0.022]) {
      const disc = new THREE.Mesh(zCylinder(cR, cR, dzz === 0 ? 0.006 : 0.014, 48), dzz === 0 ? materials.machinery : steel);
      disc.position.z = z + dzz;
      drive.add(disc);
    }
    const bolts = radialInstances(zCylinder(0.006, 0.006, 0.06, 6), steel, 6, cR * 0.72, z);
    drive.add(bolts);
  }
  group.add(drive);
  // Koruma kafesi (sabit): halkalar ve boyuna çubuklar
  const gR = cR + 0.06;
  for (const t of [0, 0.33, 0.66, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(gR, 0.008, 6, 48), paint);
    ring.position.z = lerp(dz0 - 0.02, dz1 + 0.01, t);
    group.add(ring);
  }
  const barGeo = new THREE.CylinderGeometry(0.006, 0.006, dz1 - dz0 + 0.03, 6);
  barGeo.rotateX(Math.PI / 2);
  barGeo.translate(0, gR, 0);
  group.add(radialInstances(barGeo, paint, 10, 0, (dz0 + dz1) / 2 - 0.005));
  // Devir algılayıcı (fonik tekerlek okuyucu)
  const pickup = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), materials.anodized);
  pickup.position.set(0, -(gR + 0.03), dz0 + 0.06);
  group.add(pickup);

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, drive };
}
