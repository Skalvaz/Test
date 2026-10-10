/**
 * Motor çekirdeği.
 *
 * Dıştan bakıldığında yalnızca ayırıcı (splitter), çekirdek kaportası, fan
 * çıkış yönlendirici kanatları (OGV) ve egzoz lülesi görünür. Kesit modunda
 * ise tam gaz yolu açığa çıkar:
 *   booster (LP kompresör) → HP kompresör → halka yanma odası →
 *   HP türbin → türbin geçiş kanalı → LP türbin → egzoz konisi
 *
 * İki ayrı mil grubu döndürülür: LP (fan + booster + LP türbin) ve
 * HP (HP kompresör + HP türbin), gerçekteki gibi farklı devirlerde.
 *
 * Bütün ölçüler gaz yolu yerleşiminden gelir (design/flowpath.ts
 * `TurbofanLayout`): kademeler fizikten, çekirdek kaportası iç parçaların
 * zarfından, lüle ağızları termodinamik alanlardan.
 *
 * Karışık akışlı kaportalı turbofanda (M5a P6, `L.mixed`) çekirdek lülesi
 * yoktur: çekirdek kaportası LPT arkasındaki karıştırıcıda biter
 * (lobe'lu ya da düz), egzoz konisi uzar ve ortak lülenin ağzından çıkar.
 * Ortak lüle kaportanın parçasıdır (nacelle.js).
 */

import * as THREE from 'three';
import { smoothProfile, thickLathe, bladeRow, radialInstances, pipeAlong, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';
import { compressorModule, turbineModule, casingShell } from './stages.js';
import { revolve, roundPoly } from './revolve.js';
import { buildCombustor } from './combustor.js';
import { profileAt } from '../design/flowpath';
import { chevronBand } from './nacelle.js';
import { lobedMixer } from './mixer.js';

const lerp = (a, b, t) => a + (b - a) * t;

const smoothstep = (u) => u * u * (3 - 2 * u);
/** Kosinüs geçiş: uçlarda eğim sıfır, en dik yer ortada (π/2 · Δr/boy) */
const cosineEase = (u) => (1 - Math.cos(Math.PI * u)) / 2;

/** İki halka arasında yumuşak geçiş kanalı: kalınlıklı duvar */
function transitionWall(rA, rB, zA, zB, t, ease = smoothstep, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([lerp(rA, rB, ease(u)), lerp(zA, zB, u)]);
  }
  for (let i = n; i >= 0; i--) pts.push([pts[i][0] + t, pts[i][1]]);
  return revolve(pts, { segments: 120, smooth: 40 });
}

export function buildCore(materials, L) {
  const group = new THREE.Group();
  group.name = 'core';
  const s = L.s;
  const [, , rLp] = L.shafts.lp;
  const [, , rHp] = L.shafts.hp;

  const lpSpool = new THREE.Group();
  lpSpool.name = 'lp-spool';
  const hpSpool = new THREE.Group();
  hpSpool.name = 'hp-spool';
  group.add(lpSpool, hpSpool);

  /* ================= dış yüzeyler ================= */

  // Çekirdek kaportası (baypas kanalının iç gövdesi)
  const coreCowl = new THREE.Mesh(
    thickLathe(smoothProfile(L.coreCowl, 170), 200, 0.012, 'in', { arcV: true }),
    materials.coreDetail,
  );
  coreCowl.name = 'core-cowl';
  coreCowl.castShadow = true;
  coreCowl.receiveShadow = true;
  group.add(tagPart(coreCowl, 'coreCowl'));

  // Ayırıcı burnu: baypas ile çekirdek akışını bölen keskin halka. İnişi
  // kaporta payıyla ölçeklenir (karışık akışta daralan pay: `lip`); iç
  // yüzeyi booster gövdesinin dışında kalır (layouts/turbofan.ts)
  const { z: zs, r: rs, lip = 1 } = L.splitter;
  const splitter = new THREE.Mesh(
    thickLathe(smoothProfile([[rs, zs], [rs - 0.022 * lip, zs + 0.04], [rs - 0.034 * lip, zs + 0.11], [rs - 0.04 * lip, zs + 0.22]], 40), 200, 0.01, 'out'),
    materials.polishedLip,
  );
  splitter.name = 'flow-splitter';
  group.add(tagPart(splitter, 'coreCowl'));

  /* ================= fan çıkış yönlendirici kanatları ================= */

  const ogvGeo = createStageBladeGeometry(L.ogv.hub, L.ogv.tip, {
    sections: 12,
    samples: 46,
    chord: [0.34 * s, 0.3 * s],
    twist: [THREE.MathUtils.degToRad(26), THREE.MathUtils.degToRad(8)],
    thickness: [0.1, 0.06],
    camber: [0.07, 0.045],
  });
  const ogv = bladeRow(ogvGeo, materials.compVane ?? materials.hubMetal, 44, { z: L.ogv.z });
  ogv.name = 'outlet-guide-vanes';
  group.add(tagPart(ogv, 'ogv'));

  // Yapısal fan çerçevesi kolları (kalın, yük taşıyan)
  const strutGeo = createStageBladeGeometry(L.struts.hub, L.struts.tip, {
    sections: 10,
    samples: 40,
    chord: [0.62 * s, 0.55 * s],
    twist: [THREE.MathUtils.degToRad(6), THREE.MathUtils.degToRad(2)],
    thickness: [0.18, 0.12],
    camber: [0.0, 0.0],
  });
  const struts = bladeRow(strutGeo, materials.compVane ?? materials.hubMetal, 8, { z: L.struts.z, phase: 0.12 });
  struts.name = 'fan-frame-struts';
  group.add(tagPart(struts, 'ogv'));

  /* ================= gaz yolu (kesitte görünür) ================= */
  // Kademeler stages.js ile istasyon tablosundan üretilir: kanat + kök +
  // disk + ara kol + stator bandı + kalınlıklı gövde (bkz. stages.js)

  /* ---------------- LP booster ---------------- */
  const b = L.booster;
  // Gövdenin orta flanşı (+cıvatalar) gövdeden ~2 cm taşar: kısa booster'da
  // (karışık akışta daralan kaporta payı) ayırıcı burnunun altına düşüp onu
  // delerdi. Burnun arkasına alınır; oraya da sığmıyorsa flanş yok
  const flangeMid = (b.z0 + b.z1) / 2;
  const lipEnd = zs + 0.22 + 0.02;
  const boosterFlanges = flangeMid > lipEnd ? [flangeMid] : lipEnd < b.z1 - 0.03 ? [lipEnd] : [];
  const booster = compressorModule(materials, {
    part: 'booster',
    stages: b.stages,
    z0: b.z0,
    z1: b.z1,
    pitch: b.pitch,
    hub: b.hub,
    tip: b.tip,
    blades: b.blades,
    vanes: b.blades.map((n) => Math.round(n * 1.1)),
    bore: [rLp + 0.055, 0.03],
    casing: { flanges: boosterFlanges },
    cones: { front: [rLp + 0.007, b.z0 - 0.14] },
  });
  lpSpool.add(booster.rotor);
  group.add(booster.stator);

  /* ---------------- HP kompresör (IGV + eksenel kademeler) ---------------- */
  const h = L.hpc;
  const hpc = compressorModule(materials, {
    part: 'hpc',
    stages: h.stages,
    z0: h.z0,
    z1: h.z1,
    pitch: h.pitch,
    hub: h.hub,
    tip: h.tip,
    blades: h.blades,
    bore: [rHp + 0.02, 0.035],
    igv: true,
    vsv: 4,
    casing: { flanges: [h.z0 + 0.18, h.z0 + 0.54] },
    cones: { front: [rHp + 0.005, h.z0 - 0.12], aft: [rHp + 0.005, h.z1 + 0.12] },
  });
  hpSpool.add(hpc.rotor);
  group.add(hpc.stator);

  // Booster çıkışından HPC girişine inen geçiş kanalı ("kuğu boynu")
  const transition = new THREE.Group();
  transition.add(
    new THREE.Mesh(transitionWall(booster.casingAt(b.z1), hpc.casingAt(h.z0), booster.zBack, hpc.zFront, 0.008), materials.caseInner),
    new THREE.Mesh(transitionWall(booster.hubAt(b.z1) - 0.012, hpc.hubAt(h.z0) - 0.012, booster.zBack, hpc.zFront, 0.01), materials.caseInner),
  );
  group.add(tagPart(transition, 'hpc'));

  /* ---------------- HP türbin ---------------- */
  const t = L.hpt;
  const hpt = turbineModule(materials, {
    part: 'hpt',
    stages: t.stages,
    z0: t.z0,
    z1: t.z1,
    pitch: t.pitch,
    hub: t.hub,
    tip: t.tip,
    blades: t.blades,
    bore: [rHp + 0.01, 0.06],
    casing: { flanges: [t.z0 + 0.08] },
    cones: { front: [rHp + 0.005, t.z0 - 0.1] },
  });
  hpSpool.add(hpt.rotor);
  group.add(hpt.stator);

  // Yanma odası gövdesi (difüzör + dış kasa): HPC gövdesinden HPT'ye
  const cb = L.combustor;
  const cDome = cb.z0 + 0.06;
  const cEnd = t.z0 - 0.17;
  const cNgv = t.z0 - 0.08;
  const combCaseAt = (z) =>
    z < cDome
      ? lerp(hpc.casingAt(h.z1), cb.rOut + 0.035, THREE.MathUtils.smoothstep(z, hpc.zBack, cDome))
      : z < cEnd
        ? cb.rOut + 0.045
        : lerp(cb.rOut + 0.045, t.tip[0] + 0.01, THREE.MathUtils.smoothstep(z, cEnd, cNgv));
  group.add(
    casingShell(
      { casing: materials.caseInner, bolt: materials.boltSteel },
      { inner: combCaseAt, z0: hpc.zBack, z1: cNgv + 0.005, t: 0.01, steps: 24, flanges: [cDome, cNgv - 0.04], part: 'combustor' },
    ),
  );

  /* ---------------- halka yanma odası ---------------- */
  const ngv = hpt.vanes[0];
  group.add(
    buildCombustor(materials, {
      z0: hpc.zBack,
      zDome: cb.z0 + 0.08,
      z1: ngv.z - ngv.axial * 0.55,
      rIn: cb.rIn,
      rOut: cb.rOut,
      inHub: hpc.hubAt(h.z1),
      inTip: hpc.casingAt(h.z1),
      exHub: ngv.hub,
      exTip: ngv.tip - 0.004,
      caseAt: combCaseAt,
      injectors: cb.injectors,
      cans: cb.cans,
      style: cb.style,
    }),
  );

  /* ---------------- LP türbin ---------------- */
  const l = L.lpt;
  const lpt = turbineModule(materials, {
    part: 'lpt',
    stages: l.stages,
    z0: l.z0,
    z1: l.z1,
    pitch: l.pitch,
    hub: l.hub,
    tip: l.tip,
    blades: l.blades,
    bore: [rLp + 0.015, 0.03],
    casing: { flanges: [l.z0 + 0.12, l.z1 - 0.12] },
    cones: { aft: [rLp + 0.005, l.z1 + 0.12] },
  });
  lpSpool.add(lpt.rotor);
  group.add(lpt.stator);

  // Türbin geçiş kanalı: HPT çıkışından dışa açılarak LPT'nin büyük
  // yarıçaplı halkasına; ortasında yağ/hava hatlarını taşıyan kollar.
  // Kosinüs geçiş (M5a): HPT küçülünce kanal LPT'ye dik tırmanıyordu;
  // şablonda boy ≥ 1,2 × tırmanış (templates.ts lpt.gap, templates.test.ts)
  const itd0 = hpt.zBack;
  const itd1 = lpt.zFront;
  if (itd1 > itd0 + 0.02) {
    const itd = new THREE.Group();
    itd.add(
      new THREE.Mesh(transitionWall(hpt.casingAt(t.z1), lpt.casingAt(l.z0), itd0, itd1, 0.01, cosineEase, 20), materials.turbineCase ?? materials.caseInner),
      new THREE.Mesh(transitionWall(hpt.hubAt(t.z1) - 0.014, lpt.hubAt(l.z0) - 0.014, itd0, itd1, 0.01, cosineEase, 20), materials.turbineCase ?? materials.caseInner),
    );
    const zm = (itd0 + itd1) / 2;
    const rIn = (hpt.hubAt(t.z1) + lpt.hubAt(l.z0)) / 2;
    const rOut = (hpt.casingAt(t.z1) + lpt.casingAt(l.z0)) / 2;
    const itdStrut = new THREE.BoxGeometry(0.03, rOut - rIn, Math.min(0.12, (itd1 - itd0) * 0.6));
    itdStrut.translate(0, (rIn + rOut) / 2, 0);
    itd.add(radialInstances(itdStrut, materials.turbineCase ?? materials.caseInner, 12, 0, zm, { phase: 0.15 }));
    group.add(tagPart(itd, 'lpt'));
  }

  /* ---------------- miller ---------------- */
  const tube = ([z0, z1, r], inner, segments) =>
    revolve(
      roundPoly(
        [
          [r, z0],
          [r, z1],
          [r * inner, z1],
          [r * inner, z0],
        ],
        0.004,
        1,
      ),
      { segments },
    );
  lpSpool.add(tagPart(new THREE.Mesh(tube(L.shafts.lp, 0.667, 48), materials.diskMetal), 'shafts'));
  hpSpool.add(tagPart(new THREE.Mesh(tube(L.shafts.hp, 0.862, 56), materials.diskMetal), 'shafts'));

  /* ================= egzoz ================= */

  /* ---------------- türbin arka çerçevesi ----------------
   * Gerçek motorlarda LP türbinin hemen arkasında, yükü taşıyan ve akışı
   * düzleştiren bir çerçeve vardır. Aynı zamanda lüleden bakıldığında
   * türbin kanatlarını gizler; onsuz egzoz ağzı "içi görünen" bir delik
   * gibi durur.
   */
  const rf = L.rearFrame;
  const rearFrameHub = new THREE.Mesh(
    thickLathe(
      smoothProfile(
        [
          [rf.hub * 0.86, rf.z - 0.1],
          [rf.hub * 0.93, rf.z - 0.055],
          [rf.hub * 0.98, rf.z - 0.01],
          [rf.hub, rf.z + 0.03],
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

  const rearStrutGeo = new THREE.BoxGeometry(0.052, rf.tip - rf.hub - 0.013, 0.16);
  rearStrutGeo.translate(0, (rf.hub + rf.tip) / 2, 0);
  group.add(tagPart(radialInstances(rearStrutGeo, materials.sooted, 8, 0, rf.z, { phase: 0.2 }), 'exhaust'));

  // Egzoz kanalı iç duvarı: türbin çıkışından lüle ağzına
  const exhaustDuct = new THREE.Mesh(thickLathe(smoothProfile(L.exhaustDuct, 50), 160, 0.01, 'out'), materials.sooted);
  exhaustDuct.name = 'exhaust-duct';
  group.add(tagPart(exhaustDuct, 'exhaust'));

  const exhaust = new THREE.Group();
  exhaust.name = 'exhaust';

  const n = L.coreNozzle;
  const mixed = L.mixed;
  /** Karıştırıcı (karışık akış): kesitte ayrı parça, `mixer` modülü */
  let mixer = null;
  if (mixed) {
    const mx = mixed.mixer;
    if (mx.style === 'lobed') {
      // Lobe'lu karıştırıcı: ince sac, yamasız iki yüzlü malzeme (kesitte
      // arka yüzler kırmızı kesik yüzey boyanmaz; engine/mixer.js)
      mixer = lobedMixer(mx);
    } else {
      // Düz (confluent) karıştırıcı: çekirdek kaportasının iç duvarı ince bir
      // kenarla biter; iki akış yan yana karıştırma kanalına girer
      mixer = new THREE.Mesh(
        thickLathe(smoothProfile([[mx.r + 0.012, mx.z0], [mx.r + 0.004, (mx.z0 + mx.z1) / 2], [mx.r - 0.004, mx.z1]], 30), 180, 0.006, 'in'),
        materials.inconel,
      );
      mixer.name = 'confluent-mixer';
    }
    mixer.castShadow = true;
    group.add(tagPart(mixer, 'mixer'));
  }
  const primaryNozzle = mixed ? null : new THREE.Mesh(
    thickLathe(
      smoothProfile(
        [
          [n.r0, n.z0],
          [lerp(n.r0, n.r1, 0.42), lerp(n.z0, n.z1, 0.4)],
          [lerp(n.r0, n.r1, 0.79), lerp(n.z0, n.z1, 0.77)],
          [n.r1, n.z1],
        ],
        40,
      ),
      180,
      0.008,
      'out',
    ),
    materials.inconel,
  );
  if (primaryNozzle) {
    primaryNozzle.castShadow = true;
    exhaust.add(primaryNozzle);
  }

  // Çekirdek lülesi chevron'ları: ağızdan geriye testere dişli kenar, uçları
  // jete hafif eğik (karışma katmanını hızlandırıp gürültüyü azaltır)
  if (!mixed && L.chevrons.core > 0) {
    const len = 0.17 * s;
    const outer = new THREE.Mesh(
      chevronBand({ startR: n.r1 + 0.008, startZ: n.z1, endR: n.r1 - 0.028 * s, endZ: n.z1 + len, count: L.chevrons.core }),
      materials.inconel,
    );
    const inner = new THREE.Mesh(
      chevronBand({ startR: n.r1, startZ: n.z1, endR: n.r1 - 0.034 * s, endZ: n.z1 + len, count: L.chevrons.core }),
      materials.inconel,
    );
    outer.castShadow = true;
    exhaust.add(outer, inner);
  }

  const plug = new THREE.Mesh(thickLathe(smoothProfile(L.plug, 110), 180, 0.01, 'in'), materials.inconel);
  plug.name = 'exhaust-plug';
  plug.castShadow = true;
  exhaust.add(plug);

  // Konik üzerindeki çevresel takviye halkaları (uzun konide üç)
  for (const z of mixed ? [n.z0 + 0.12, n.z0 + 0.32, (n.z0 + mixed.nozzle.z1) / 2] : [n.z0 + 0.12, n.z0 + 0.32]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(profileAt(L.plug, z) - 0.02, 0.008, 8, 90), materials.inconel);
    rib.position.z = z;
    exhaust.add(rib);
  }

  group.add(tagPart(exhaust, 'exhaust'));

  /* ================= aksesuar kutusu ve tesisat ================= */
  // Çekirdek kaportasının altında; konumlar HPC girişine, yarıçaplar
  // kaportaya göre (M4 öncesi modelde HPC z 0,82, kaporta 0,856)
  const zh = (z) => h.z0 + (z - 0.82);
  const ky = Math.max(...L.coreCowl.map((p) => p[0])) / 0.856;

  const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 1.05, 1, 1, 1), materials.machinery);
  gearbox.position.set(0, -0.94 * ky, zh(0.85));
  gearbox.rotation.x = 0.06;
  gearbox.castShadow = true;
  group.add(tagPart(gearbox, 'gearbox'));

  const pumpGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.26, 20);
  pumpGeo.rotateZ(Math.PI / 2);
  [-0.18, 0.12, 0.42].forEach((z, i) => {
    const pump = new THREE.Mesh(pumpGeo, materials.machinery);
    pump.position.set(0.22 * (i % 2 ? 1 : -1), -1.02 * ky, zh(0.55 + z));
    group.add(tagPart(pump, 'gearbox'));
  });

  const P = (x, y, z) => [x * ky, y * ky, zh(z)];
  const lines = [
    pipeAlong([P(0.3, -0.86, 0.4), P(0.55, -0.7, 0.9), P(0.7, -0.42, 1.45), P(0.62, -0.2, 1.95)], 0.026),
    pipeAlong([P(-0.28, -0.88, 0.45), P(-0.58, -0.66, 1.0), P(-0.72, -0.34, 1.6), P(-0.6, -0.12, 2.1)], 0.022),
    pipeAlong([P(0.1, -0.98, 0.3), P(0.42, -0.86, 0.1), P(0.7, -0.52, -0.05)], 0.018),
  ];
  for (const geo of lines) {
    const pipe = new THREE.Mesh(geo, materials.hose);
    pipe.castShadow = true;
    group.add(tagPart(pipe, 'gearbox'));
  }

  const clampGeo = new THREE.TorusGeometry(0.034, 0.01, 8, 16);
  [P(0.55, -0.7, 0.9), P(0.7, -0.42, 1.45), P(-0.58, -0.66, 1.0)].forEach((p) => {
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
    mixer,
  };
}

