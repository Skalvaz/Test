/**
 * Çıplak (kaportasız) askeri jet motorları: art yakıcılı turbofan ve turbojet.
 *
 * Askeri motorlar test hücresinde gövdesiz çalıştırılır: önde havayı düzgün
 * alan bir "bellmouth", dışarıda borular, kablo demetleri, aksesuar dişli
 * kutusu; arkada art yakıcı kanalı ve menteşeli yapraklardan oluşan değişken
 * yakınsak-ıraksak lüle. Lüle yaprakları simülasyonun lüle alanını izler:
 * rölantide açık, MIL'de kapalı, art yakıcıda tamamen açık.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, bladeRow, radialInstances, pipeAlong, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';
import { buildGasPath } from './gaspath.js';
import { buildStandYoke } from './stand.js';

const deg = THREE.MathUtils.degToRad;

/** İki varyantın ölçüleri (metre, motor ekseni Z, +Z egzoz yönü). */
const VARIANTS = {
  militaryTurbofan: {
    R: 0.5,
    throat: 0.465,
    intakeZ: -2.2,
    noseLen: 0.36,
    igv: 22,
    gas: {
      lpc: { part: 'fan', stages: 3, z0: -2.02, z1: -1.62, hub: [0.19, 0.26], tip: [0.46, 0.43], blades: [34, 46] },
      hpc: { stages: 10, z0: -1.32, z1: -0.36, hub: [0.2, 0.27], tip: [0.335, 0.3], blades: [40, 72] },
      combustor: { z0: -0.2, z1: 0.32, rIn: 0.2, rOut: 0.33, injectors: 18 },
      hpt: { stages: 1, z0: 0.46, z1: 0.46, hub: [0.25, 0.25], tip: [0.335, 0.335], blades: [62, 62] },
      lpt: { stages: 2, z0: 0.64, z1: 0.84, hub: [0.23, 0.23], tip: [0.37, 0.4], blades: [70, 76] },
      casing: [[0.35, -1.45], [0.33, -0.9], [0.305, -0.35], [0.34, -0.18], [0.35, 0.3], [0.34, 0.45], [0.38, 0.7], [0.41, 0.92]],
      shafts: { lp: [-2.1, 0.95, 0.07], hp: [-1.4, 0.52, 0.13] },
    },
    splitterZ: -1.5,
    tailCone: [0.95, 1.55, 0.22],
    ab: { z0: 1.0, z1: 2.55, R: 0.5, liner: 0.47 },
    nozzle: { hingeR: 0.47, throat0: 0.305, primary: 0.3, divergent: 0.34, flaps: 16 },
    mounts: [-0.9, 0.95],
    flanges: [-2.2, -1.52, -0.42, 0.38, 1.0, 1.75, 2.5],
  },
  turbojet: {
    R: 0.43,
    throat: 0.4,
    intakeZ: -2.2,
    noseLen: 0.3,
    igv: 24,
    gas: {
      lpc: { part: 'booster', stages: 3, z0: -2.05, z1: -1.62, hub: [0.14, 0.2], tip: [0.395, 0.36], blades: [28, 40] },
      hpc: { stages: 3, z0: -1.42, z1: -1.02, hub: [0.21, 0.25], tip: [0.35, 0.33], blades: [42, 52] },
      combustor: { z0: -0.82, z1: 0.0, rIn: 0.2, rOut: 0.36, injectors: 10 },
      hpt: { stages: 1, z0: 0.16, z1: 0.16, hub: [0.26, 0.26], tip: [0.36, 0.36], blades: [58, 58] },
      lpt: { stages: 1, z0: 0.38, z1: 0.38, hub: [0.26, 0.26], tip: [0.38, 0.38], blades: [64, 64] },
      casing: [[0.4, -1.6], [0.36, -1.3], [0.35, -0.95], [0.37, -0.8], [0.37, 0.0], [0.365, 0.2], [0.385, 0.45], [0.4, 0.55]],
      shafts: { lp: [-2.1, 0.45, 0.06], hp: [-1.5, 0.2, 0.12] },
    },
    splitterZ: null,
    tailCone: [0.5, 1.0, 0.24],
    ab: { z0: 0.55, z1: 2.6, R: 0.45, liner: 0.42 },
    nozzle: { hingeR: 0.43, throat0: 0.285, primary: 0.3, divergent: 0, flaps: 14 },
    mounts: [-1.1, 0.4],
    flanges: [-2.2, -1.6, -0.95, -0.82, 0.05, 0.55, 1.4, 2.55],
  },
};

/**
 * Değişken lüle: menteşeli birincil (yakınsak) ve ikincil (ıraksak) yaprak
 * halkası. `set(area, abLevel)` boğaz alanı oranına göre yaprakları döndürür.
 */
function buildNozzle(materials, z0, n) {
  const group = new THREE.Group();
  group.name = 'variable-nozzle';
  const primaries = [];
  const secondaries = [];
  const width = (2 * Math.PI * n.hingeR) / n.flaps;
  // Yaprak: hafif kavisli plaka (dış yüz koyu, iç yüz seramik)
  const plate = (len, w, mat) => {
    const geo = new THREE.BoxGeometry(w * 1.04, 0.012, len);
    geo.translate(0, 0, len / 2);
    return new THREE.Mesh(geo, mat);
  };
  for (let pass = 0; pass < 2; pass++) {
    // pass 0: yaprak, pass 1: aradaki sızdırmazlık yaprağı (biraz içte)
    const phase = pass === 0 ? 0 : Math.PI / n.flaps;
    for (let i = 0; i < n.flaps; i++) {
      const spoke = new THREE.Group();
      spoke.rotation.z = phase + (i / n.flaps) * Math.PI * 2;
      const hinge = new THREE.Group();
      hinge.position.set(0, n.hingeR - pass * 0.012, z0);
      const p = plate(n.primary, width * (pass ? 0.7 : 1), pass ? materials.nozzleCeramic : materials.nozzleFlap);
      hinge.add(p);
      primaries.push(hinge);
      if (n.divergent > 0) {
        const joint = new THREE.Group();
        joint.position.z = n.primary;
        joint.add(plate(n.divergent, width * (pass ? 0.72 : 1.06), pass ? materials.nozzleCeramic : materials.nozzleFlap));
        hinge.add(joint);
        secondaries.push(joint);
      }
      spoke.add(hinge);
      group.add(spoke);
    }
  }
  // Aktüatörler (sabit, lüle kasnağına bağlı)
  const act = new THREE.CylinderGeometry(0.016, 0.016, 0.28, 10);
  act.rotateX(Math.PI / 2);
  act.translate(0, n.hingeR + 0.05, z0 - 0.05);
  group.add(radialInstances(act, materials.machinery, 6, 0, 0, { phase: 0.26 }));
  // Kasnak halkası
  const ring = new THREE.Mesh(new THREE.TorusGeometry(n.hingeR + 0.02, 0.028, 12, 96), materials.nozzleFlap);
  ring.position.z = z0;
  group.add(ring);

  let exitZ = z0 + n.primary + n.divergent;
  let exitR = n.throat0;
  const set = (area, abLevel = 0) => {
    const rt = n.throat0 * Math.sqrt(Math.max(0.6, area));
    const tp = Math.asin(THREE.MathUtils.clamp((n.hingeR - rt) / n.primary, -0.95, 0.95));
    for (const h of primaries) h.rotation.x = tp;
    let re = rt;
    if (n.divergent > 0) {
      re = rt * (1.12 + 0.14 * abLevel);
      const td = -Math.asin(THREE.MathUtils.clamp((re - rt) / n.divergent, -0.95, 0.95));
      for (const j of secondaries) j.rotation.x = td - tp;
    }
    exitR = re;
    exitZ = z0 + n.primary * Math.cos(tp) + (n.divergent > 0 ? n.divergent * Math.cos(Math.asin((re - rt) / n.divergent)) : 0);
  };
  set(1, 0);
  return {
    group,
    set,
    get exitZ() {
      return exitZ;
    },
    get exitR() {
      return exitR;
    },
  };
}

export function buildBareJet(materials, kind) {
  const v = VARIANTS[kind];
  const group = new THREE.Group();
  group.name = kind;

  const gas = buildGasPath(materials, v.gas);
  group.add(gas.group);
  const { lpSpool, hpSpool } = gas;

  /* ---------------- bellmouth + ön çerçeve ---------------- */
  const t = v.throat;
  const z = v.intakeZ;
  const bell = smoothProfile(
    [
      [t, z + 0.02],
      [t + 0.005, z - 0.14],
      [t + 0.035, z - 0.32],
      [t + 0.11, z - 0.47],
      [t + 0.23, z - 0.54],
      [t + 0.34, z - 0.52],
      [t + 0.38, z - 0.45],
      [t + 0.36, z - 0.4],
    ],
    90,
  );
  const bellmouth = new THREE.Mesh(latheFromProfile(bell, 160), materials.polishedLip);
  bellmouth.name = 'bellmouth';
  group.add(tagPart(bellmouth, 'inlet'));

  // Burun konisi (sabit, ön çerçeveye bağlı) + giriş kılavuz kanatları
  const nose = smoothProfile(
    [
      [0.002, z - v.noseLen],
      [0.06, z - v.noseLen * 0.85],
      [0.12, z - v.noseLen * 0.45],
      [0.165, z - 0.02],
      [0.17, z + 0.12],
    ],
    60,
  );
  group.add(tagPart(new THREE.Mesh(latheFromProfile(nose, 96), materials.spinner), 'spinner'));
  const igv = bladeRow(
    createStageBladeGeometry(0.165, t, {
      sections: 6,
      samples: 20,
      chord: [0.1, 0.09],
      twist: [deg(8), deg(4)],
      thickness: [0.12, 0.1],
      camber: [0.04, 0.03],
    }),
    materials.superalloy,
    v.igv,
    { z: z + 0.06 },
  );
  group.add(tagPart(igv, 'inlet'));

  /* ---------------- dış gövde ---------------- */
  const R = v.R;
  const ab = v.ab;
  const shellPts = [
    [t + 0.01, z + 0.02],
    [R, z + 0.1],
    [R, ab.z0 - 0.02],
  ];
  const shell = new THREE.Mesh(latheFromProfile(shellPts.map(([r, zz]) => new THREE.Vector2(r, zz)), 128), materials.engineCase);
  shell.name = 'engine-case';
  group.add(tagPart(shell, 'fanCase'));

  // Baypas ayırıcısı (turbofan) / çekirdek iç duvarı
  if (v.splitterZ !== null) {
    const split = new THREE.Mesh(
      latheFromProfile(smoothProfile([[0.36, v.splitterZ], [0.375, v.splitterZ + 0.1], [0.36, 0.9]], 40), 96),
      materials.hubMetal,
    );
    group.add(tagPart(split, 'bypassDuct'));
  }

  // Flanşlar ve cıvata halkaları
  for (const fz of v.flanges) {
    const r = fz >= ab.z0 ? ab.R : R;
    const fl = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.012, 8, 128), materials.machinery);
    fl.position.z = fz;
    group.add(tagPart(fl, 'fanCase'));
    const bolt = new THREE.CylinderGeometry(0.007, 0.007, 0.03, 6);
    bolt.rotateX(Math.PI / 2);
    group.add(tagPart(radialInstances(bolt, materials.machinery, 48, r + 0.016, fz), 'fanCase'));
  }

  // Egzoz: türbin arka çerçevesi + kuyruk konisi
  const [tc0, tc1, tcR] = v.tailCone;
  const cone = new THREE.Mesh(
    latheFromProfile(smoothProfile([[tcR, tc0], [tcR * 0.8, tc0 + (tc1 - tc0) * 0.45], [0.02, tc1]], 40), 64),
    materials.sooted,
  );
  group.add(tagPart(cone, 'exhaust'));
  const strut = new THREE.BoxGeometry(0.018, ab.liner - tcR, 0.16);
  strut.translate(0, (ab.liner + tcR) / 2, 0);
  group.add(tagPart(radialInstances(strut, materials.sooted, 6, 0, tc0 + 0.08, { phase: 0.3 }), 'exhaust'));

  /* ---------------- art yakıcı ---------------- */
  const abShell = new THREE.Mesh(
    latheFromProfile(
      [new THREE.Vector2(R, ab.z0 - 0.03), new THREE.Vector2(ab.R, ab.z0 + 0.12), new THREE.Vector2(ab.R, ab.z1)],
      128,
    ),
    materials.abDuct,
  );
  abShell.name = 'afterburner-duct';
  group.add(tagPart(abShell, 'afterburner'));
  const liner = new THREE.Mesh(
    latheFromProfile([new THREE.Vector2(ab.liner, ab.z0 + 0.05), new THREE.Vector2(ab.liner, ab.z1)], 96),
    materials.abLiner,
  );
  liner.name = 'afterburner-liner';
  group.add(tagPart(liner, 'afterburner'));
  // Yakıt püskürtme halkaları ve V-oluklu alev tutucular
  const sprayZ = ab.z0 + 0.12;
  for (const r of [ab.liner * 0.5, ab.liner * 0.78]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 96), materials.brassFitting);
    ring.position.z = sprayZ;
    group.add(tagPart(ring, 'afterburner'));
  }
  const holderZ = ab.z0 + 0.42;
  for (const r of [ab.liner * 0.42, ab.liner * 0.66, ab.liner * 0.88]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 3, 96), materials.flameHolder);
    ring.rotation.z = Math.PI / 6;
    ring.position.z = holderZ;
    group.add(tagPart(ring, 'afterburner'));
  }
  const gutter = new THREE.BoxGeometry(0.03, ab.liner * 0.6, 0.03);
  gutter.translate(0, ab.liner * 0.6, 0);
  group.add(tagPart(radialInstances(gutter, materials.flameHolder, 10, 0, holderZ), 'afterburner'));

  /* ---------------- değişken lüle ---------------- */
  const nozzle = buildNozzle(materials, ab.z1, v.nozzle);
  group.add(tagPart(nozzle.group, 'nozzle'));

  /* ---------------- dış tesisat ---------------- */
  // Aksesuar dişli kutusu (alt tarafta) ve pompalar
  const gbZ0 = z + 0.55;
  const gbLen = 1.0;
  const gb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, gbLen), materials.machinery);
  gb.position.set(0, -R - 0.12, gbZ0 + gbLen / 2);
  group.add(tagPart(gb, 'gearbox'));
  const pumpGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 18);
  [
    [-0.12, gbZ0 + 0.18],
    [0.12, gbZ0 + 0.4],
    [-0.1, gbZ0 + 0.7],
    [0.11, gbZ0 + 0.85],
  ].forEach(([x, pz], i) => {
    const pump = new THREE.Mesh(pumpGeo, i % 2 ? materials.brassFitting : materials.engineCase);
    pump.position.set(x, -R - 0.26, pz);
    group.add(tagPart(pump, 'gearbox'));
  });
  // Dişli kutusunu gövdeye bağlayan kule mili muhafazası
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), materials.machinery);
  tower.position.set(0, -R - 0.03, gbZ0 + 0.3);
  group.add(tagPart(tower, 'gearbox'));

  // Borular: yakıt manifoldu, yağ hatları, sensör kablo demetleri
  const pipes = [];
  const along = (a, r, z0, z1, wob, rad, mat) => {
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const zz = z0 + ((z1 - z0) * k) / 8;
      const aa = a + wob * Math.sin(k * 1.7);
      pts.push([Math.cos(aa) * r, Math.sin(aa) * r, zz]);
    }
    const m = new THREE.Mesh(pipeAlong(pts, rad, 8), mat);
    pipes.push(m);
    group.add(tagPart(m, 'gearbox'));
  };
  along(deg(-60), R + 0.035, z + 0.3, ab.z0 + 0.4, 0.05, 0.014, materials.engineCase);
  along(deg(-120), R + 0.03, z + 0.4, 0.6, 0.04, 0.011, materials.brassFitting);
  along(deg(-30), R + 0.05, z + 0.8, ab.z1 - 0.2, 0.03, 0.018, materials.engineCase);
  along(deg(-150), R + 0.045, z + 0.5, ab.z0 + 0.8, 0.06, 0.01, materials.hose);
  along(deg(30), R + 0.03, z + 0.2, ab.z0, 0.08, 0.009, materials.hose);
  along(deg(150), R + 0.03, z + 0.6, ab.z0 + 0.2, 0.08, 0.009, materials.hose);
  // Yanma odası çevresindeki yakıt manifoldu halkası
  const cbz = (v.gas.combustor.z0 + v.gas.combustor.z1) / 2 - 0.1;
  const manifold = new THREE.Mesh(new THREE.TorusGeometry(R + 0.04, 0.012, 8, 96), materials.engineCase);
  manifold.position.z = cbz;
  group.add(tagPart(manifold, 'gearbox'));
  const feed = new THREE.CylinderGeometry(0.007, 0.007, 0.05, 6);
  feed.translate(0, R + 0.02, 0);
  group.add(tagPart(radialInstances(feed, materials.engineCase, v.gas.combustor.injectors, 0, cbz), 'gearbox'));
  // Art yakıcı yakıt hattı
  along(deg(-90) + 0.35, ab.R + 0.03, ab.z0 - 0.3, ab.z0 + 0.14, 0.02, 0.016, materials.engineCase);

  /* ---------------- test standı askısı ---------------- */
  const yoke = buildStandYoke(materials, { mounts: v.mounts, engineR: R });
  group.add(tagPart(yoke, 'stand'));

  return {
    group,
    lpSpool,
    hpSpool,
    nozzle,
    intake: { z: z - 0.1, radius: t },
    exhaust: {
      get z() {
        return nozzle.exitZ;
      },
      get radius() {
        return nozzle.exitR;
      },
    },
    abZ: holderZ,
    abR: ab.liner,
  };
}
