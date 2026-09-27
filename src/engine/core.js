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
import { smoothProfile, latheFromProfile, arcLengthV, bladeRow, radialInstances, pipeAlong, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';

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
    arcLengthV(latheFromProfile(coreCowlProfile, 200), coreCowlProfile),
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
  const splitter = new THREE.Mesh(latheFromProfile(splitterProfile, 200), materials.polishedLip);
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
  const ogv = bladeRow(ogvGeo, materials.hubMetal, 44, { z: 0.20 });
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
  const struts = bladeRow(strutGeo, materials.hubMetal, 8, { z: 0.62, phase: 0.12 });
  struts.name = 'fan-frame-struts';
  group.add(tagPart(struts, 'ogv'));

  /* ================= gaz yolu (kesitte görünür) ================= */

  // Çekirdek akış kanalının dış duvarı
  const gasPathOuter = smoothProfile(
    [
      [0.560, 0.240],
      [0.552, 0.420],
      [0.540, 0.640],
      [0.520, 0.860],
      [0.495, 1.120],
      [0.470, 1.400],
      [0.452, 1.560],
      [0.520, 1.700],
      [0.540, 1.880],
      [0.500, 2.010],
      [0.505, 2.180],
      [0.545, 2.420],
      [0.600, 2.680],
      [0.648, 2.900],
    ],
    150,
  );
  const gasPath = new THREE.Mesh(latheFromProfile(gasPathOuter, 160), materials.superalloy);
  gasPath.name = 'gas-path-casing';
  group.add(tagPart(gasPath, 'casing'));

  /* ---------------- LP booster (3 kademe) ---------------- */
  const boosterDrum = smoothProfile(
    [
      [0.430, 0.120],
      [0.440, 0.260],
      [0.448, 0.420],
      [0.452, 0.580],
      [0.448, 0.700],
    ],
    40,
  );
  const drumMesh = new THREE.Mesh(latheFromProfile(boosterDrum, 120), materials.hubMetal);
  lpSpool.add(tagPart(drumMesh, 'booster'));

  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const z = lerp(0.20, 0.62, t);
    const hub = lerp(0.437, 0.452, t);
    const tip = lerp(0.542, 0.516, t);
    const rotor = bladeRow(
      createStageBladeGeometry(hub, tip, {
        chord: [0.16, 0.14],
        twist: [THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(30)],
      }),
      materials.hubMetal,
      38,
      { z, phase: i * 0.11 },
    );
    lpSpool.add(tagPart(rotor, 'booster'));

    const stator = bladeRow(
      createStageBladeGeometry(hub + 0.01, tip + 0.005, {
        chord: [0.14, 0.13],
        twist: [THREE.MathUtils.degToRad(-34), THREE.MathUtils.degToRad(-20)],
      }),
      materials.superalloy,
      42,
      { z: z + 0.085, phase: 0.04 },
    );
    group.add(tagPart(stator, 'booster'));
  }

  /* ---------------- HP kompresör (9 kademe) ---------------- */
  const hpcDrum = smoothProfile(
    [
      [0.300, 0.780],
      [0.330, 0.900],
      [0.360, 1.060],
      [0.385, 1.240],
      [0.400, 1.420],
      [0.408, 1.560],
    ],
    50,
  );
  hpSpool.add(tagPart(new THREE.Mesh(latheFromProfile(hpcDrum, 120), materials.hubMetal), 'hpc'));

  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const z = lerp(0.82, 1.52, t);
    const hub = lerp(0.312, 0.404, t);
    const tip = lerp(0.522, 0.438, t);
    const chord = lerp(0.115, 0.060, t);
    const rotor = bladeRow(
      createStageBladeGeometry(hub, tip, {
        sections: 6,
        samples: 22,
        chord: [chord, chord * 0.92],
        twist: [THREE.MathUtils.degToRad(46 - t * 14), THREE.MathUtils.degToRad(26 - t * 8)],
        thickness: [0.10, 0.055],
      }),
      materials.hubMetal,
      44 + i * 4,
      { z, phase: i * 0.07 },
    );
    hpSpool.add(tagPart(rotor, 'hpc'));

    const stator = bladeRow(
      createStageBladeGeometry(hub + 0.008, tip + 0.004, {
        sections: 6,
        samples: 22,
        chord: [chord * 0.9, chord * 0.85],
        twist: [THREE.MathUtils.degToRad(-30), THREE.MathUtils.degToRad(-18)],
        thickness: [0.09, 0.05],
      }),
      materials.superalloy,
      48 + i * 4,
      { z: z + chord * 0.72, phase: 0.03 },
    );
    group.add(tagPart(stator, 'hpc'));
  }

  /* ---------------- halka yanma odası ---------------- */
  const linerOuter = smoothProfile(
    [
      [0.452, 1.585],
      [0.512, 1.640],
      [0.536, 1.760],
      [0.524, 1.900],
      [0.480, 1.975],
    ],
    50,
  );
  const linerInner = smoothProfile(
    [
      [0.372, 1.585],
      [0.330, 1.650],
      [0.318, 1.770],
      [0.330, 1.900],
      [0.372, 1.975],
    ],
    50,
  );
  const combustorOuter = new THREE.Mesh(latheFromProfile(linerOuter, 140), materials.combustorGlow);
  const combustorInner = new THREE.Mesh(latheFromProfile(linerInner, 140), materials.combustorGlow);
  combustorOuter.name = 'combustor-outer-liner';
  combustorInner.name = 'combustor-inner-liner';
  group.add(tagPart(combustorOuter, 'combustor'), tagPart(combustorInner, 'combustor'));

  // Yakıt enjektörleri
  const nozzleGeo = new THREE.CylinderGeometry(0.022, 0.030, 0.13, 10);
  nozzleGeo.rotateX(Math.PI / 2);
  nozzleGeo.translate(0, 0.452, 0);
  group.add(tagPart(radialInstances(nozzleGeo, materials.machinery, 20, 0, 1.585), 'combustor'));

  /* ---------------- HP türbin (2 kademe) ---------------- */
  for (let i = 0; i < 2; i++) {
    const z = 2.03 + i * 0.16;
    const hub = 0.352 + i * 0.006;
    const tip = 0.490 + i * 0.013;
    const nozzleRow = bladeRow(
      createStageBladeGeometry(hub, tip, {
        sections: 6,
        samples: 26,
        chord: [0.115, 0.105],
        twist: [THREE.MathUtils.degToRad(-42), THREE.MathUtils.degToRad(-30)],
        thickness: [0.17, 0.12],
        camber: [0.10, 0.08],
      }),
      materials.superalloy,
      36 + i * 4,
      { z: z - 0.10 },
    );
    group.add(tagPart(nozzleRow, 'hpt'));

    const rotor = bladeRow(
      createStageBladeGeometry(hub, tip, {
        sections: 6,
        samples: 26,
        chord: [0.105, 0.098],
        twist: [THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(22)],
        thickness: [0.16, 0.10],
        camber: [0.09, 0.07],
      }),
      materials.superalloy,
      62 + i * 6,
      { z, phase: i * 0.05 },
    );
    hpSpool.add(tagPart(rotor, 'hpt'));
  }

  /* ---------------- LP türbin (5 kademe) ---------------- */
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const z = lerp(2.34, 2.84, t);
    const hub = lerp(0.340, 0.356, t);
    const tip = lerp(0.512, 0.602, t);
    const nozzleRow = bladeRow(
      createStageBladeGeometry(hub, tip, {
        sections: 6,
        samples: 24,
        chord: [0.10, 0.095],
        twist: [THREE.MathUtils.degToRad(-38), THREE.MathUtils.degToRad(-26)],
        thickness: [0.14, 0.09],
        camber: [0.09, 0.07],
      }),
      materials.superalloy,
      52 + i * 4,
      { z: z - 0.065 },
    );
    group.add(tagPart(nozzleRow, 'lpt'));

    const rotor = bladeRow(
      createStageBladeGeometry(hub, tip, {
        sections: 6,
        samples: 24,
        chord: [0.095, 0.09],
        twist: [THREE.MathUtils.degToRad(36), THREE.MathUtils.degToRad(20)],
        thickness: [0.13, 0.08],
        camber: [0.085, 0.06],
      }),
      materials.superalloy,
      74 + i * 6,
      { z, phase: i * 0.04 },
    );
    lpSpool.add(tagPart(rotor, 'lpt'));
  }

  /* ---------------- miller ---------------- */
  const lpShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 4.6, 40),
    materials.hubMetal,
  );
  lpShaft.rotation.x = Math.PI / 2;
  lpShaft.position.z = 0.75;
  lpSpool.add(tagPart(lpShaft, 'shafts'));

  const hpShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.195, 0.195, 1.45, 40),
    materials.machinery,
  );
  hpShaft.rotation.x = Math.PI / 2;
  hpShaft.position.z = 1.45;
  hpSpool.add(tagPart(hpShaft, 'shafts'));

  /* ================= egzoz ================= */

  /* ---------------- türbin arka çerçevesi ----------------
   * Gerçek motorlarda LP türbinin hemen arkasında, yükü taşıyan ve akışı
   * düzleştiren bir çerçeve vardır. Aynı zamanda lüleden bakıldığında
   * türbin kanatlarını gizler; onsuz egzoz ağzı "içi görünen" bir delik
   * gibi durur.
   */
  const rearFrameHub = new THREE.Mesh(
    latheFromProfile(
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
    ),
    materials.sooted,
  );
  group.add(tagPart(rearFrameHub, 'exhaust'));

  const rearStrutGeo = new THREE.BoxGeometry(0.052, 0.235, 0.16);
  rearStrutGeo.translate(0, 0.515, 0);
  group.add(tagPart(radialInstances(rearStrutGeo, materials.sooted, 8, 0, 3.000, { phase: 0.2 }), 'exhaust'));

  // Egzoz kanalı iç duvarı: türbin çıkışından lüle ağzına
  const exhaustDuct = new THREE.Mesh(
    latheFromProfile(
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
  const primaryNozzle = new THREE.Mesh(latheFromProfile(nozzleProfile, 180), materials.inconel);
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
  const plug = new THREE.Mesh(latheFromProfile(plugProfile, 180), materials.inconel);
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
