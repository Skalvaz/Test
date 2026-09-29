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
import { smoothProfile, latheFromProfile, bladeRow, radialInstances, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';
import { buildGasPath } from './gaspath.js';
import { buildStandYoke } from './stand.js';
import { createBlurDiscTexture } from '../materials/textures.js';
import {
  radiusProfile,
  hugPipe,
  harness,
  vsvStage,
  vsvActuator,
  fuelManifold,
  igniters,
  borescopePorts,
  accessoryGearbox,
  oilTank,
  controlUnit,
} from './externals.js';

const deg = THREE.MathUtils.degToRad;

/** İki varyantın ölçüleri (metre, motor ekseni Z, +Z egzoz yönü). */
const VARIANTS = {
  militaryTurbofan: {
    R: 0.5,
    throat: 0.465,
    intakeZ: -2.2,
    noseLen: 0.36,
    igv: 0,
    gas: {
      lpc: { part: 'fan', stages: 3, z0: -2.02, z1: -1.62, hub: [0.19, 0.26], tip: [0.46, 0.43], blades: [28, 46], firstMaterial: 'titanium', firstChord: 1.25 },
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
    // Dış gövde: fan gövdesi biraz daha geniş, sonra baypas kanalı
    shell: [[0.505, -2.08], [0.515, -1.95], [0.515, -1.55], [0.5, -1.45], [0.5, 0.98]],
  },
  turbojet: {
    R: 0.43,
    throat: 0.4,
    intakeZ: -2.2,
    noseLen: 0.3,
    igv: 6,
    gas: {
      lpc: { part: 'booster', stages: 3, z0: -2.05, z1: -1.62, hub: [0.14, 0.2], tip: [0.395, 0.36], blades: [24, 40], firstMaterial: 'titanium', firstChord: 1.15 },
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
    // Kompresör gövdesi, yanma odası bölümünde şişkin gövde, türbin
    shell: [[0.43, -2.08], [0.43, -1.0], [0.465, -0.88], [0.465, -0.02], [0.44, 0.14], [0.44, 0.53]],
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
  // Burun konisi giriş kılavuz kanatlarının göbeğidir ve DÖNMEZ; dönen
  // izlenimi vermesin diye sarmal işaretsiz, düz boyalı
  group.add(tagPart(new THREE.Mesh(latheFromProfile(nose, 96), materials.nozzleFlap), 'spinner'));
  // Ön çerçeve: turbojette birkaç kalın dikme (yağ/hava hatları içinden
  // geçer); modern askeri turbofanda giriş kılavuz kanadı yok, fan doğrudan görünür
  if (v.igv > 0) {
    const strutGeo = createStageBladeGeometry(0.165, t, {
      sections: 4,
      samples: 16,
      chord: [0.16, 0.14],
      twist: [0, 0],
      thickness: [0.22, 0.2],
      camber: [0, 0],
    });
    group.add(tagPart(bladeRow(strutGeo, materials.engineCase, v.igv, { z: z + 0.04, phase: Math.PI / v.igv }), 'inlet'));
  }

  // İlk rotor kademesinin hareket bulanıklığı diski (yüksek devirde)
  const lpc = v.gas.lpc;
  const blurMat = new THREE.MeshBasicMaterial({
    map: createBlurDiscTexture(512, lpc.blades[0]),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const blurDisc = new THREE.Mesh(new THREE.RingGeometry(lpc.hub[0], lpc.tip[0], 64, 1), blurMat);
  blurDisc.position.z = lpc.z0 - 0.02;
  blurDisc.visible = false;
  group.add(blurDisc);

  /* ---------------- dış gövde ---------------- */
  const R = v.R;
  const ab = v.ab;
  const shellPts = [[t + 0.01, z + 0.02], ...v.shell];
  const shell = new THREE.Mesh(latheFromProfile(shellPts.map(([r, zz]) => new THREE.Vector2(r, zz)), 128), materials.engineCase);
  // Dış donanımın izleyeceği yüzey: gövde + art yakıcı kanalı
  const prof = radiusProfile([...v.shell, [ab.R, ab.z0 + 0.12], [ab.R, ab.z1]]);
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
    const r = prof(fz);
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
  };
  const B = -Math.PI / 2; // alt
  const cb = v.gas.combustor;
  const cbz = (cb.z0 + cb.z1) / 2;
  const turbojet = kind === 'turbojet';

  // Değişken stator kanadı halkaları (turbojette kompresör gövdesi dışarıda)
  if (turbojet) {
    const zs = [-1.96, -1.82, -1.68, -1.4, -1.27, -1.14];
    zs.forEach((zz, i) => vsvStage(group, prof, zz, 36 + i * 4, mats, i < 3 ? 'booster' : 'hpc'));
    vsvActuator(group, prof, zs, 0.25, mats, 'hpc');
    vsvActuator(group, prof, zs, Math.PI - 0.25, mats, 'hpc');
  } else {
    // Fan gövdesinde ön kademe VSV'leri
    const zs = [-1.98, -1.84];
    zs.forEach((zz) => vsvStage(group, prof, zz, 32, mats, 'fan'));
    vsvActuator(group, prof, zs, 0.3, mats, 'fan');
  }

  // Yakıt manifoldu + pigtail'ler, ateşleyiciler
  fuelManifold(group, prof, cb.z0 + 0.08, cb.injectors, mats, 'gearbox');
  igniters(group, prof, cbz, [B - 0.75, B + 0.75], cbz + 0.45, mats, 'gearbox');
  borescopePorts(group, prof, [cb.z0 - 0.25, cbz, v.gas.hpt.z0, v.gas.lpt.z0], 0.35, mats);

  // Aksesuar dişli kutusu (alt tarafta, gövde eğrisini izler)
  const gbZ0 = turbojet ? z + 0.2 : z + 0.5;
  const gbLen = turbojet ? 0.95 : 1.05;
  accessoryGearbox(
    group,
    prof,
    {
      z0: gbZ0,
      len: gbLen,
      arc: 1.15,
      depth: 0.13,
      accessories: [
        { da: -0.32, z: gbZ0 + 0.2, r: 0.07, h: 0.16, fins: true, mat: 'cast' }, // jeneratör
        { da: 0.3, z: gbZ0 + 0.25, r: 0.06, h: 0.14, mat: 'metal' }, // yakıt pompası
        { da: 0, z: gbZ0 + gbLen * 0.62, r: 0.085, h: 0.12, fins: true, mat: 'cast' }, // hava türbinli marş
        { da: -0.34, z: gbZ0 + gbLen * 0.8, r: 0.05, h: 0.12, mat: 'anodized' }, // hidrolik pompa
        { da: 0.34, z: gbZ0 + gbLen * 0.82, r: 0.045, h: 0.1, mat: 'metal' }, // yağ pompası
      ],
    },
    mats,
  );
  oilTank(group, prof, { a: -0.25, z: gbZ0 + 0.3 }, mats);
  controlUnit(group, prof, { a: Math.PI + 0.3, z: gbZ0 + 0.35 }, mats);

  // Borular: gövdeyi izler, kelepçelerle bağlanır
  const pipe = (a0, a1, z0, z1, rad, mat, gap = 0.012) =>
    hugPipe(group, prof, { a0, a1, z0, z1, rad, gap, mat, clampMat: materials.machinery });
  // Yakıt besleme: pompa → manifold
  pipe(B + 0.3, B + 0.55, gbZ0 + 0.3, cb.z0 + 0.03, 0.013, materials.engineCase);
  // Yağ hatları: tank → yataklar (ön ve arka)
  pipe(-0.25, -0.05, gbZ0 + 0.1, z + 0.25, 0.009, materials.brassFitting, 0.01);
  pipe(-0.3, -0.55, gbZ0 + 0.5, v.gas.lpt.z0 + 0.1, 0.009, materials.brassFitting, 0.01);
  // Kompresör bleed havası: kalın kanal
  pipe(Math.PI - 0.35, Math.PI - 0.15, v.gas.hpc.z1 - 0.05, cbz + 0.6, 0.028, materials.engineCase, 0.018);
  // Art yakıcı yakıt hattı: dişli kutusu → püskürtme halkaları
  pipe(B - 0.5, B - 0.3, gbZ0 + 0.6, ab.z0 + 0.14, 0.015, materials.engineCase, 0.014);
  // Kablo demetleri: kontrol ünitesinden sensörlere
  harness(group, prof, { a0: Math.PI + 0.25, a1: Math.PI + 0.55, z0: z + 0.25, z1: ab.z0 - 0.05, mat: materials.hose, clampMat: materials.machinery });
  harness(group, prof, { a0: Math.PI + 0.4, a1: 0.15, z0: gbZ0 + 0.5, z1: ab.z1 - 0.2, gap: 0.02, count: 2, mat: materials.hose, clampMat: materials.machinery });
  // Art yakıcı püskürtme halkası besleme rakorları
  const feed = new THREE.CylinderGeometry(0.012, 0.012, 0.035, 8);
  feed.translate(0, ab.R + 0.015, 0);
  group.add(tagPart(radialInstances(feed, materials.machinery, 6, 0, ab.z0 + 0.14, { phase: 0.4 }), 'afterburner'));

  /* ---------------- test standı askısı ---------------- */
  const yoke = buildStandYoke(materials, { mounts: v.mounts, engineR: R });
  group.add(tagPart(yoke, 'stand'));

  return {
    group,
    lpSpool,
    hpSpool,
    nozzle,
    blurDisc,
    blurMat,
    bladeCount: lpc.blades[0],
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
