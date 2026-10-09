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
import { smoothProfile, latheFromProfile, radialInstances, tagPart } from './geom.js';
import { compressorModule, turbineModule, casingShell } from './stages.js';
import { revolve, roundPoly } from './revolve.js';
import { buildCombustor } from './combustor.js';

const lerp = (a, b, t) => a + (b - a) * t;
const deg = THREE.MathUtils.degToRad;

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

  const [lpZ0, lpZ1, lpR] = spec.shafts.lp;
  const [hpZ0, hpZ1, hpR] = spec.shafts.hp;
  // İlk kademe malzemesi: M2 kanat malzemeleri kesitte bütün kalır
  const first = (m) => (m === 'titanium' && materials.fanBlade ? 'fanBlade' : m);
  const addComp = (c, part, spool, boreR, shaftZ0) => {
    const pitch = c.stages > 1 ? (c.z1 - c.z0) / (c.stages - 1) : 0.1;
    const mod = compressorModule(materials, {
      part,
      ...c,
      firstMaterial: first(c.firstMaterial),
      blisk: part === 'fan',
      bore: [boreR + 0.008, Math.max(0.02, (c.hub[0] - boreR) * 0.25)],
      vsv: c.vsv ?? (part === 'hpc' ? Math.min(4, c.stages) : 0),
      igv: c.igv ?? part === 'hpc',
      cones: { front: [boreR + 0.004, Math.max(shaftZ0 + 0.03, c.z0 - pitch * 1.2)] },
      casing: { flanges: c.flanges ?? [] },
    });
    spool.add(mod.rotor);
    group.add(mod.stator);
    return mod;
  };
  const lpc = spec.lpc ? addComp(spec.lpc, spec.lpc.part ?? 'booster', lpSpool, lpR, lpZ0) : null;
  const hpc = addComp(spec.hpc, 'hpc', hpSpool, hpR, hpZ0);
  void lpc;

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
    // Kanatlı radyal difüzör: çark ucundan difüzör çıkışına (rd), akışı
    // yavaşlatıp basınca çeviren eğik kanatlar; dış toplama halkası
    const rd = spec.centrifugal.rd ?? r1;
    if (rd > r1 + 0.02) {
      const dv = new THREE.BoxGeometry(0.006, rd - r1 - 0.01, 0.07);
      dv.rotateZ(0.55);
      dv.translate(0, (r1 + rd) / 2, 0);
      group.add(tagPart(radialInstances(dv, materials.superalloy, 21, 0, z + 0.075), 'hpc'));
      const plate = new THREE.Mesh(
        latheFromProfile(smoothProfile([[r1 + 0.005, z + 0.035], [rd, z + 0.035], [rd, z + 0.115], [r1 + 0.005, z + 0.115]], 8), 96),
        materials.superalloy,
      );
      group.add(tagPart(plate, 'hpc'));
    }
    const diffuser = new THREE.Mesh(new THREE.TorusGeometry(rd + 0.03, 0.03, 12, 96), materials.superalloy);
    diffuser.position.z = z + 0.1;
    group.add(tagPart(diffuser, 'hpc'));
  }

  const hpt = turbineModule(materials, {
    part: 'hpt',
    ...spec.hpt,
    pitch: spec.hpt.pitch ?? Math.min(0.16, (spec.lpt.z0 - spec.hpt.z1) * 0.9),
    bore: [hpR + 0.008, 0.045],
    cones: { front: [hpR + 0.004, Math.max(hpZ0, spec.hpt.z0 - 0.12)] },
  });
  hpSpool.add(hpt.rotor);
  group.add(hpt.stator);
  const lpt = turbineModule(materials, {
    part: 'lpt',
    ...spec.lpt,
    pitch: spec.lpt.pitch ?? 0.16,
    bore: [lpR + 0.008, 0.028],
    casingFrom: hpt.zBack,
    cones: { aft: [lpR + 0.004, Math.min(lpZ1 - 0.02, spec.lpt.z1 + 0.1)] },
  });
  lpSpool.add(lpt.rotor);
  group.add(lpt.stator);

  // Yanma odası bölümü gövdesi: kompresör çıkışından türbin girişine
  if (spec.casing) {
    const prof = spec.casing.map(([r, z]) => [z, r]).sort((x, y) => x[0] - y[0]);
    const at = (z) => {
      if (z <= prof[0][0]) return prof[0][1];
      for (let i = 1; i < prof.length; i++) if (z <= prof[i][0]) return lerp(prof[i - 1][1], prof[i][1], (z - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0]));
      return prof[prof.length - 1][1];
    };
    const z0 = spec.centrifugal ? spec.centrifugal.z + 0.13 : hpc.zBack;
    const z1 = hpt.zFront;
    const rIn = Math.max(spec.combustor.rOut + 0.03, 0);
    const caseAt = (z) => {
      const u = THREE.MathUtils.smoothstep(z, z0, z0 + (z1 - z0) * 0.2) * (1 - THREE.MathUtils.smoothstep(z, z1 - (z1 - z0) * 0.12, z1));
      const edge = z < (z0 + z1) / 2 ? hpc.casingAt(hpc.zBack) : hpt.casingAt(z1);
      return lerp(spec.centrifugal && z < (z0 + z1) / 2 ? at(z) : edge, Math.max(at(z), rIn), u);
    };
    const cb = spec.combustor;
    const ngv = hpt.vanes[0];
    const L = cb.z1 - cb.z0;
    group.add(
      buildCombustor(materials, {
        z0,
        zDome: cb.z0 + L * 0.14,
        z1: ngv.z - ngv.axial * 0.55,
        rIn: cb.rIn,
        rOut: cb.rOut,
        inHub: spec.centrifugal ? cb.rIn + (cb.rOut - cb.rIn) * 0.3 : hpc.hubAt(hpc.zBack),
        inTip: spec.centrifugal ? cb.rOut - (cb.rOut - cb.rIn) * 0.3 : hpc.casingAt(hpc.zBack),
        exHub: ngv.hub,
        exTip: ngv.tip - 0.004,
        caseAt,
        injectors: cb.injectors ?? 16,
        cans: cb.cans,
        style: cb.style,
      }),
    );
    group.add(
      casingShell(
        { casing: materials.caseInner, bolt: materials.boltSteel },
        {
          inner: caseAt,
          z0,
          z1,
          // Kutu (can) tipinde her kutu kendi basınç kabında: ortak kasa yalnız
          // bölümü kapatan ince kabuk (M5a)
          t: cb.style === 'can' ? 0.005 : 0.008,
          steps: 24,
          flanges: [z0 + 0.012, z1 - 0.012],
          part: 'combustor',
        },
      ),
    );
  }

  // Miller: iç içe tüpler (kesitte duvar kalınlığı görünür)
  const tube = (z0, z1, r, t, mat, target) => {
    const m = new THREE.Mesh(
      revolve(
        roundPoly(
          [
            [r, z0],
            [r, z1],
            [r - t, z1],
            [r - t, z0],
          ],
          0.003,
          1,
        ),
        { segments: 48 },
      ),
      mat,
    );
    target.add(tagPart(m, 'shafts'));
  };
  tube(lpZ0, lpZ1, lpR, lpR * 0.35, materials.diskMetal, lpSpool);
  tube(hpZ0, hpZ1, hpR, hpR * 0.18, materials.diskMetal, hpSpool);

  return { group, lpSpool, hpSpool };
}
