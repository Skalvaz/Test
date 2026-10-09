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
import { smoothProfile, latheFromProfile, thickLathe, bladeRow, radialInstances, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';
import { buildGasPath } from './gaspath.js';
import { buildNozzle } from './nozzle.js';
import { lobedMixer } from './mixer.js';
import { buildStandYoke } from './stand.js';
import { createBlurDiscTexture } from '../materials/textures.js';
import { KitBatch } from './kit.js';
import {
  radiusProfile,
  flangeBolts,
  probes,
  liftLugs,
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

/**
 * @param src  görsel kaynak (engine/models.ts `VisualSource`): `src.layout`
 *             gaz yolu yerleşimi, design/flowpath.ts `BareJetLayout`
 *             (modül grafiğinden fizikle hesaplanır; metre, motor ekseni Z,
 *             +Z egzoz yönü); `src.traits` dış donanım düzeni için
 */
export function buildBareJet(materials, src) {
  const v = src.layout;
  const traits = src.traits;
  const group = new THREE.Group();
  group.name = traits.presentation;

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
  const bellmouth = new THREE.Mesh(thickLathe(bell, 160, 0.012, 'out'), materials.polishedLip);
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
  group.add(tagPart(new THREE.Mesh(thickLathe(nose, 96, 0.008, 'in'), materials.nozzleFlap), 'spinner'));
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
  const shell = new THREE.Mesh(thickLathe(shellPts.map(([r, zz]) => new THREE.Vector2(r, zz)), 128, 0.01, 'in'), materials.engineCase);
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

  // Kit parçaları (Blender'da modellenmiş dış donanım, bkz. kit.js)
  const kit = new KitBatch(materials);

  // Flanşlar ve cıvata halkaları
  for (const fz of v.flanges) {
    const r = prof(fz);
    const fl = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.012, 8, 128), materials.kitSteel ?? materials.machinery);
    fl.position.z = fz;
    group.add(tagPart(fl, 'fanCase'));
    flangeBolts(r + 0.016, fz, 48, { kit }, 0.011);
  }

  // Egzoz: türbin arka çerçevesi + kuyruk konisi
  const [tc0, tc1, tcR] = v.tailCone;
  const cone = new THREE.Mesh(
    thickLathe(smoothProfile([[tcR, tc0], [tcR * 0.8, tc0 + (tc1 - tc0) * 0.45], [0.02, tc1]], 40), 64, 0.008, 'in'),
    materials.sooted,
  );
  group.add(tagPart(cone, 'exhaust'));
  const strut = new THREE.BoxGeometry(0.018, ab.liner - tcR, 0.16);
  strut.translate(0, (ab.liner + tcR) / 2, 0);
  group.add(tagPart(radialInstances(strut, materials.sooted, 6, 0, tc0 + 0.08, { phase: 0.3 }), 'exhaust'));

  /* ---------------- lobe'lu karıştırıcı ---------------- */
  // Çiçek biçimli ince sac: lobe'lar sıcak çekirdek akışını dışa, soğuk
  // baypas akışını içe taşıyarak iki akışı iç içe geçirir. Genlik girişte
  // sıfırdan çıkışta en büyüğe büyür.
  if (v.mixer) group.add(tagPart(lobedMixer(v.mixer), 'exhaust'));

  /* ---------------- art yakıcı ---------------- */
  const abShell = new THREE.Mesh(
    thickLathe(
      [new THREE.Vector2(R, ab.z0 - 0.03), new THREE.Vector2(ab.R, ab.z0 + 0.12), new THREE.Vector2(ab.R, ab.z1)],
      128,
      0.01,
      'out',
    ),
    materials.abDuct,
  );
  abShell.name = 'afterburner-duct';
  group.add(tagPart(abShell, 'afterburner'));
  const liner = new THREE.Mesh(
    thickLathe([new THREE.Vector2(ab.liner, ab.z0 + 0.05), new THREE.Vector2(ab.liner, ab.z1)], 96, 0.006, 'out'),
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
    castKit: materials.kitCast,
    kit,
  };
  const B = -Math.PI / 2; // alt
  const cb = v.gas.combustor;
  const cbz = (cb.z0 + cb.z1) / 2;
  const turbojet = traits.presentation === 'turbojet';

  // Değişken stator kanadı halkaları: kompresör gövdesi dışarıdaysa (turbojet)
  // bütün VSV sıraları, baypaslı motorda yalnız fan gövdesindekiler
  const vsvZ = v.vsv.flatMap((s) => s.z);
  let k = 0;
  for (const s of v.vsv) for (const zz of s.z) vsvStage(group, prof, zz, s.part === 'fan' ? 32 : 36 + 4 * k++, mats, s.part);
  if (vsvZ.length) {
    const fanOnly = v.vsv.every((s) => s.part === 'fan');
    if (fanOnly) vsvActuator(group, prof, vsvZ, 0.3, mats, 'fan');
    else {
      vsvActuator(group, prof, vsvZ, 0.25, mats, 'hpc');
      vsvActuator(group, prof, vsvZ, Math.PI - 0.25, mats, 'hpc');
    }
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
        { kind: 'generator', da: -0.32, z: gbZ0 + 0.2, r: 0.07, h: 0.16 },
        { kind: 'pump', da: 0.3, z: gbZ0 + 0.25, r: 0.06, h: 0.14, yaw: Math.PI / 2 }, // yakıt pompası
        { kind: 'starter', da: 0, z: gbZ0 + gbLen * 0.62, r: 0.075, h: 0.13 }, // hava türbinli marş
        { kind: 'hydPump', da: -0.34, z: gbZ0 + gbLen * 0.8, r: 0.05, h: 0.12, yaw: Math.PI }, // hidrolik pompa
        { kind: 'oilPump', da: 0.34, z: gbZ0 + gbLen * 0.82, r: 0.045, h: 0.1 }, // yağ pompası
      ],
    },
    mats,
  );
  oilTank(group, prof, { a: -0.25, z: gbZ0 + 0.3 }, mats);
  controlUnit(group, prof, { a: Math.PI + 0.3, z: gbZ0 + 0.35 }, mats);

  // Borular: gövdeyi izler, kelepçelerle bağlanır
  const pipe = (a0, a1, z0, z1, rad, mat, gap = 0.012) => hugPipe(group, prof, { a0, a1, z0, z1, rad, gap, mat, kit });
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
  harness(group, prof, { a0: Math.PI + 0.25, a1: Math.PI + 0.55, z0: z + 0.25, z1: ab.z0 - 0.05, mat: materials.hose, kit });
  harness(group, prof, { a0: Math.PI + 0.4, a1: 0.15, z0: gbZ0 + 0.5, z1: ab.z1 - 0.2, gap: 0.02, count: 2, mat: materials.hose, kit });
  // Art yakıcı püskürtme halkası besleme rakorları
  for (let i = 0; i < 6; i++) kit.at('bNut', 0.4 + (i / 6) * Math.PI * 2, prof(ab.z0 + 0.14), ab.z0 + 0.14, {}, 'afterburner');
  // Egzoz sıcaklık sondaları (türbin çıkışı çevresinde), kaldırma kulakları
  probes(prof, v.gas.lpt.z1 + 0.14, 8, { kit }, 0.2, 'lpt');
  liftLugs(prof, [z + 0.35, ab.z0 + 0.3], { kit });

  group.add(kit.build());

  /* ---------------- test standı askısı ---------------- */
  const yoke = buildStandYoke(materials, { mounts: v.standZ, engineR: R });
  group.add(tagPart(yoke, 'stand'));

  return {
    group,
    lpSpool,
    hpSpool,
    nozzle,
    blurDisc,
    blurMat,
    bladeCount: lpc.blades[0],
    stand: { yoke, mounts: v.standZ, engineR: R },
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
