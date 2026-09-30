/**
 * Motor çekirdeği.
 *
 * Dıştan bakıldığında yalnızca ayırıcı (splitter), çekirdek kaportası, fan
 * çıkış yönlendirici kanatları (OGV) ve egzoz lülesi görünür. Kesit modunda
 * ise tam gaz yolu açığa çıkar:
 *   booster (LP kompresör) → HP kompresör → halka yanma odası →
 *   HP türbin → LP türbin → egzoz konisi
 *
 * İki ayrı mil grubu döndürülür: LP (fan + booster + LP türbin) ve
 * HP (HP kompresör + HP türbin), gerçekteki gibi farklı devirlerde.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, thickLathe, arcLengthV, bladeRow, radialInstances, pipeAlong, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';
import { compressorModule, turbineModule, casingShell } from './stages.js';
import { revolve, roundPoly } from './revolve.js';
import { buildCombustor } from './combustor.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function buildCore(materials) {
  const group = new THREE.Group();
  group.name = 'core';

  const lpSpool = new THREE.Group();
  lpSpool.name = 'lp-spool';
  const hpSpool = new THREE.Group();
  hpSpool.name = 'hp-spool';
  group.add(lpSpool, hpSpool);

  /* ================= dış yüzeyler ================= */

  // Çekirdek kaportası (baypas kanalının iç gövdesi)
  const coreCowlProfile = smoothProfile(
    [
      [0.600, 0.020],
      [0.686, 0.150],
      [0.772, 0.400],
      [0.832, 0.780],
      [0.856, 1.180],
      [0.845, 1.640],
      [0.806, 2.120],
      [0.752, 2.540],
      [0.694, 2.880],
      [0.655, 3.060],
    ],
    170,
  );
  const coreCowl = new THREE.Mesh(
    thickLathe(coreCowlProfile, 200, 0.012, 'in', { arcV: true }),
    materials.coreDetail,
  );
  coreCowl.name = 'core-cowl';
  coreCowl.castShadow = true;
  coreCowl.receiveShadow = true;
  group.add(tagPart(coreCowl, 'coreCowl'));

  // Ayırıcı burnu: baypas ile çekirdek akışını bölen keskin halka
  const splitterProfile = smoothProfile(
    [
      [0.600, 0.020],
      [0.578, 0.060],
      [0.566, 0.130],
      [0.560, 0.240],
    ],
    40,
  );
  const splitter = new THREE.Mesh(thickLathe(splitterProfile, 200, 0.01, 'out'), materials.polishedLip);
  splitter.name = 'flow-splitter';
  group.add(tagPart(splitter, 'coreCowl'));

  /* ================= fan çıkış yönlendirici kanatları ================= */

  const ogvGeo = createStageBladeGeometry(0.70, 1.392, {
    sections: 12,
    samples: 46,
    chord: [0.34, 0.30],
    twist: [THREE.MathUtils.degToRad(26), THREE.MathUtils.degToRad(8)],
    thickness: [0.10, 0.06],
    camber: [0.07, 0.045],
  });
  const ogv = bladeRow(ogvGeo, materials.compVane ?? materials.hubMetal, 44, { z: 0.20 });
  ogv.name = 'outlet-guide-vanes';
  group.add(tagPart(ogv, 'ogv'));

  // Yapısal fan çerçevesi kolları (kalın, yük taşıyan)
  const strutGeo = createStageBladeGeometry(0.74, 1.390, {
    sections: 10,
    samples: 40,
    chord: [0.62, 0.55],
    twist: [THREE.MathUtils.degToRad(6), THREE.MathUtils.degToRad(2)],
    thickness: [0.18, 0.12],
    camber: [0.0, 0.0],
  });
  const struts = bladeRow(strutGeo, materials.compVane ?? materials.hubMetal, 8, { z: 0.62, phase: 0.12 });
  struts.name = 'fan-frame-struts';
  group.add(tagPart(struts, 'ogv'));

  /* ================= gaz yolu (kesitte görünür) ================= */
  // Kademeler stages.js ile istasyon tablosundan üretilir: kanat + kök +
  // disk + ara kol + stator bandı + kalınlıklı gövde (bkz. stages.js)

  /* ---------------- LP booster (3 kademe) ---------------- */
  const booster = compressorModule(materials, {
    part: 'booster',
    stages: 3,
    z0: 0.2,
    z1: 0.62,
    hub: [0.437, 0.452],
    tip: [0.542, 0.516],
    blades: [38, 38],
    vanes: [42, 46],
    bore: [0.16, 0.03],
    casing: { flanges: [0.45] },
    cones: { front: [0.112, 0.06] },
  });
  lpSpool.add(booster.rotor);
  group.add(booster.stator);

  /* ---------------- HP kompresör (IGV + 9 kademe) ---------------- */
  const hpc = compressorModule(materials, {
    part: 'hpc',
    stages: 9,
    z0: 0.82,
    z1: 1.52,
    hub: [0.312, 0.404],
    tip: [0.522, 0.438],
    blades: [44, 76],
    bore: [0.215, 0.035],
    igv: true,
    vsv: 4,
    casing: { flanges: [1.0, 1.36] },
    cones: { front: [0.2, 0.7], aft: [0.2, 1.64] },
  });
  hpSpool.add(hpc.rotor);
  group.add(hpc.stator);

  // Booster çıkışından HPC girişine inen geçiş kanalı ("kuğu boynu")
  const bEnd = booster.zBack;
  const hStart = hpc.zFront;
  const duct = (rA, rB, t) => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const k = u * u * (3 - 2 * u);
      pts.push([lerp(rA, rB, k), lerp(bEnd, hStart, u)]);
    }
    for (let i = 12; i >= 0; i--) pts.push([pts[i][0] + t, pts[i][1]]);
    return pts;
  };
  const transition = new THREE.Group();
  transition.add(
    new THREE.Mesh(revolve(duct(booster.casingAt(0.62), hpc.casingAt(0.82), 0.008), { segments: 120, smooth: 40 }), materials.caseInner),
    new THREE.Mesh(revolve(duct(booster.hubAt(0.62) - 0.012, hpc.hubAt(0.82) - 0.012, 0.01), { segments: 120, smooth: 40 }), materials.caseInner),
  );
  group.add(tagPart(transition, 'hpc'));

  // Yanma odası gövdesi (difüzör + dış kasa): HPC gövdesinden HPT'ye
  const combCaseAt = (z) =>
    z < 1.66 ? lerp(hpc.casingAt(1.52), 0.575, THREE.MathUtils.smoothstep(z, hpc.zBack, 1.66)) : z < 1.88 ? 0.585 : lerp(0.585, 0.5, THREE.MathUtils.smoothstep(z, 1.88, 1.97));
  const combCase = casingShell(
    { casing: materials.caseInner, bolt: materials.boltSteel },
    {
      inner: combCaseAt,
      z0: hpc.zBack,
      z1: 1.975,
      t: 0.01,
      steps: 24,
      flanges: [1.66, 1.93],
      part: 'combustor',
    },
  );
  group.add(combCase);

  /* ---------------- HP türbin (2 kademe) ---------------- */
  const hpt = turbineModule(materials, {
    part: 'hpt',
    stages: 2,
    z0: 2.05,
    z1: 2.21,
    hub: [0.352, 0.358],
    tip: [0.49, 0.503],
    blades: [62, 68],
    bore: [0.205, 0.06],
    casing: { flanges: [2.13] },
    cones: { front: [0.2, 1.95] },
  });
  hpSpool.add(hpt.rotor);
  group.add(hpt.stator);

  /* ---------------- halka yanma odası ---------------- */
  const ngv = hpt.vanes[0];
  group.add(
    buildCombustor(materials, {
      z0: hpc.zBack,
      zDome: 1.68,
      z1: ngv.z - ngv.axial * 0.55,
      rIn: 0.33,
      rOut: 0.54,
      inHub: hpc.hubAt(1.52),
      inTip: hpc.casingAt(1.52),
      exHub: ngv.hub,
      exTip: ngv.tip - 0.004,
      caseAt: combCaseAt,
      injectors: 20,
    }),
  );

  /* ---------------- LP türbin (5 kademe) ---------------- */
  const lpt = turbineModule(materials, {
    part: 'lpt',
    stages: 5,
    z0: 2.36,
    z1: 2.84,
    hub: [0.34, 0.356],
    tip: [0.512, 0.602],
    blades: [74, 98],
    bore: [0.12, 0.03],
    casingFrom: hpt.zBack,
    casing: { flanges: [2.48, 2.72] },
    cones: { aft: [0.11, 2.96] },
  });
  lpSpool.add(lpt.rotor);
  group.add(lpt.stator);

  /* ---------------- miller ---------------- */
  const lpShaft = new THREE.Mesh(
    revolve(
      roundPoly(
        [
          [0.105, -1.55],
          [0.105, 3.05],
          [0.07, 3.05],
          [0.07, -1.55],
        ],
        0.004,
        1,
      ),
      { segments: 48 },
    ),
    materials.diskMetal,
  );
  lpSpool.add(tagPart(lpShaft, 'shafts'));

  const hpShaft = new THREE.Mesh(
    revolve(
      roundPoly(
        [
          [0.195, 0.69],
          [0.195, 2.0],
          [0.168, 2.0],
          [0.168, 0.69],
        ],
        0.004,
        1,
      ),
      { segments: 56 },
    ),
    materials.diskMetal,
  );
  hpSpool.add(tagPart(hpShaft, 'shafts'));

  /* ================= egzoz ================= */

  /* ---------------- türbin arka çerçevesi ----------------
   * Gerçek motorlarda LP türbinin hemen arkasında, yükü taşıyan ve akışı
   * düzleştiren bir çerçeve vardır. Aynı zamanda lüleden bakıldığında
   * türbin kanatlarını gizler; onsuz egzoz ağzı "içi görünen" bir delik
   * gibi durur.
   */
  const rearFrameHub = new THREE.Mesh(
    thickLathe(
      smoothProfile(
        [
          [0.344, 2.900],
          [0.372, 2.945],
          [0.392, 2.990],
          [0.400, 3.030],
        ],
        40,
      ),
      120,
      0.01,
      'in',
    ),
    materials.sooted,
  );
  group.add(tagPart(rearFrameHub, 'exhaust'));

  const rearStrutGeo = new THREE.BoxGeometry(0.052, 0.235, 0.16);
  rearStrutGeo.translate(0, 0.515, 0);
  group.add(tagPart(radialInstances(rearStrutGeo, materials.sooted, 8, 0, 3.000, { phase: 0.2 }), 'exhaust'));

  // Egzoz kanalı iç duvarı: türbin çıkışından lüle ağzına
  const exhaustDuct = new THREE.Mesh(
    thickLathe(
      smoothProfile(
        [
          [0.648, 2.905],
          [0.632, 2.990],
          [0.618, 3.120],
          [0.600, 3.260],
          [0.590, 3.360],
        ],
        50,
      ),
      160,
      0.01,
      'out',
    ),
    materials.sooted,
  );
  exhaustDuct.name = 'exhaust-duct';
  group.add(tagPart(exhaustDuct, 'exhaust'));

  const exhaust = new THREE.Group();
  exhaust.name = 'exhaust';

  const nozzleProfile = smoothProfile(
    [
      [0.655, 3.060],
      [0.628, 3.180],
      [0.604, 3.290],
      [0.590, 3.360],
    ],
    40,
  );
  const primaryNozzle = new THREE.Mesh(thickLathe(nozzleProfile, 180, 0.008, 'out'), materials.inconel);
  primaryNozzle.castShadow = true;
  exhaust.add(primaryNozzle);

  const plugProfile = smoothProfile(
    [
      [0.400, 3.030],
      [0.397, 3.140],
      [0.384, 3.290],
      [0.352, 3.480],
      [0.300, 3.690],
      [0.232, 3.885],
      [0.158, 4.045],
      [0.086, 4.155],
      [0.030, 4.212],
      [0.000, 4.235],
    ],
    110,
  );
  const plug = new THREE.Mesh(thickLathe(plugProfile, 180, 0.01, 'in'), materials.inconel);
  plug.name = 'exhaust-plug';
  plug.castShadow = true;
  exhaust.add(plug);

  // Konik üzerindeki çevresel takviye halkaları
  const ribGeo = new THREE.TorusGeometry(0.36, 0.008, 8, 90);
  [3.18, 3.38].forEach((z, i) => {
    const rib = new THREE.Mesh(ribGeo, materials.inconel);
    rib.scale.setScalar(i === 0 ? 1.02 : 0.88);
    rib.position.z = z;
    exhaust.add(rib);
  });

  group.add(tagPart(exhaust, 'exhaust'));

  /* ================= aksesuar kutusu ve tesisat ================= */

  const gearbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.30, 1.05, 1, 1, 1),
    materials.machinery,
  );
  gearbox.position.set(0, -0.94, 0.85);
  gearbox.rotation.x = 0.06;
  gearbox.castShadow = true;
  group.add(tagPart(gearbox, 'gearbox'));

  const pumpGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.26, 20);
  pumpGeo.rotateZ(Math.PI / 2);
  [-0.18, 0.12, 0.42].forEach((z, i) => {
    const pump = new THREE.Mesh(pumpGeo, materials.machinery);
    pump.position.set(0.22 * (i % 2 ? 1 : -1), -1.02, 0.55 + z);
    group.add(tagPart(pump, 'gearbox'));
  });

  const lines = [
    pipeAlong(
      [
        [0.30, -0.86, 0.40],
        [0.55, -0.70, 0.90],
        [0.70, -0.42, 1.45],
        [0.62, -0.20, 1.95],
      ],
      0.026,
    ),
    pipeAlong(
      [
        [-0.28, -0.88, 0.45],
        [-0.58, -0.66, 1.00],
        [-0.72, -0.34, 1.60],
        [-0.60, -0.12, 2.10],
      ],
      0.022,
    ),
    pipeAlong(
      [
        [0.10, -0.98, 0.30],
        [0.42, -0.86, 0.10],
        [0.70, -0.52, -0.05],
      ],
      0.018,
    ),
  ];
  for (const geo of lines) {
    const pipe = new THREE.Mesh(geo, materials.hose);
    pipe.castShadow = true;
    group.add(tagPart(pipe, 'gearbox'));
  }

  const clampGeo = new THREE.TorusGeometry(0.034, 0.010, 8, 16);
  [
    [0.55, -0.70, 0.90],
    [0.70, -0.42, 1.45],
    [-0.58, -0.66, 1.00],
  ].forEach((p) => {
    const clamp = new THREE.Mesh(clampGeo, materials.brassFitting);
    clamp.position.set(...p);
    clamp.lookAt(0, 0, p[2]);
    group.add(tagPart(clamp, 'gearbox'));
  });

  return {
    group,
    lpSpool,
    hpSpool,
    combustorMaterial: materials.combustorGlow,
    exhaust,
  };
}
