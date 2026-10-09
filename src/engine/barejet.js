/**
 * Çıplak (kaportasız) jet motorları: turbojet ve düşük baypaslı karışık
 * akışlı turbofan, art yakıcılı ya da art yakıcısız.
 *
 * Bu motorlar test hücresinde gövdesiz çalıştırılır: önde havayı düzgün
 * alan bir "bellmouth", dışarıda borular, kablo demetleri, aksesuar dişli
 * kutusu. Art yakıcılı motorda arkada art yakıcı kanalı ve menteşeli
 * yapraklardan oluşan değişken yakınsak-ıraksak lüle; yapraklar
 * simülasyonun lüle alanını izler (rölantide açık, MIL'de kapalı, art
 * yakıcıda tamamen açık). Art yakıcısız motorda kısa jet borusu ve sabit
 * yakınsak lüle.
 *
 * Gaz yolundan gelmeyen sabit ölçülü parçalar (bellmouth, burun, giriş
 * dikmeleri, ayırıcı, aksesuarlar) ön sıranın giriş boğazına oranlanır;
 * oranlar bugünkü şablonlardan (turbojet / askeri turbofan), şablonlarda
 * görüntü aynı kalır.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, thickLathe, bladeRow, radialInstances, tagPart } from './geom.js';
import { createStageBladeGeometry } from './airfoil.js';
import { buildGasPath } from './gaspath.js';
import { buildFixedNozzle, buildNozzle } from './nozzle.js';
import { lobedMixer } from './mixer.js';
import { REF_THROAT } from '../design/layouts/bare';
import { profileAt } from '../design/flowpath';
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
 * Baypas ayırıcısının profili (Vector2 [r, z], z artan): ayırıcı dudağından
 * yanma odası çıkışına. Ön kısım fan çıkışında çekirdek girişini ayıran
 * sabit yarıçaplı sac; yanma odası bölümünde gövdenin (gaspath.js caseAt,
 * 8 mm et) dışında kalır ve odanın çıkışında gövdeye oturur. Türbin
 * bölümünde baypas kanalının iç duvarı türbin gövdesinin kendisidir
 * (F100/Spey gibi): eski profil karışma düzlemine dek sabit ~0,33 m'de
 * uzanıyor, LPT kanatlarının ve türbin gövdesinin içinden geçiyordu.
 *
 * @param v  BareJetLayout (splitterZ null değil)
 * @param s  sabit ölçülü parçaların ölçeği (şablonda 1)
 */
export function splitterProfile(v, s) {
  const cb = v.gas.combustor;
  const splitR = Math.max(v.gas.hpc.tip[0], cb.rOut) + 0.04;
  const lip = 0.015 * s;
  const z0 = v.splitterZ;
  const z1 = Math.max(cb.z1, z0 + 0.2 * s);
  // Yanma odası gövdesinin dış yüzü (kasa gaz yolu profilinden ya da
  // gömleğin 3 cm dışından, hangisi büyükse; + et)
  const caseZ0 = v.gas.casing[0][1];
  const caseOut = (z) => Math.max(profileAt(v.gas.casing, z), cb.rOut + 0.03) + 0.008;
  const land = Math.min(0.1 * s, (z1 - z0) * 0.15);
  const n = 60;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    // Dudak: ilk 0,1·s'de içe kıvrık
    let r = splitR - lip * (1 - THREE.MathUtils.smoothstep(z, z0, z0 + 0.1 * s));
    if (z >= caseZ0) {
      const c = caseOut(z);
      // Gövdenin 12 mm dışında; son `land` boyunca gövdeye iner (2 mm)
      r = THREE.MathUtils.lerp(Math.max(r, c + 0.012), c + 0.002, THREE.MathUtils.smoothstep(z, z1 - land, z1));
    }
    pts.push(new THREE.Vector2(r, z));
  }
  return pts;
}

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
  // Dış donanım düzeni: LP milinde LPC (turbojet) ya da fan
  const turbojet = traits.lpLoad === 'lpc';
  // Sabit ölçülü parçaların ölçeği (şablonda 1); aksesuarlar daha dar aralıkta
  const s = v.throat / (turbojet ? REF_THROAT.lpc : REF_THROAT.fan);
  const sa = THREE.MathUtils.clamp(s, 0.4, 2);
  const ab = v.ab;
  const fixed = v.nozzle.kind === 'fixed';
  // Egzoz bölümü (art yakıcı kanalı ya da jet borusu): başı, sonu, dış yarıçapı, gaz duvarı
  const ex = ab ? { z0: ab.z0, z1: ab.z1, R: ab.R, wall: ab.liner } : { z0: v.jetPipe.z0, z1: v.jetPipe.z1, R: v.jetPipe.r + 0.03, wall: v.jetPipe.r };

  const gas = buildGasPath(materials, v.gas);
  group.add(gas.group);
  const { lpSpool, hpSpool } = gas;

  /* ---------------- bellmouth + ön çerçeve ---------------- */
  const t = v.throat;
  const z = v.intakeZ;
  const bell = smoothProfile(
    [
      [0, 0.02],
      [0.005, -0.14],
      [0.035, -0.32],
      [0.11, -0.47],
      [0.23, -0.54],
      [0.34, -0.52],
      [0.38, -0.45],
      [0.36, -0.4],
    ].map(([dr, dz]) => [t + dr * s, z + dz * s]),
    90,
  );
  const bellmouth = new THREE.Mesh(thickLathe(bell, 160, Math.max(0.005, 0.012 * s), 'out'), materials.polishedLip);
  bellmouth.name = 'bellmouth';
  group.add(tagPart(bellmouth, 'inlet'));

  // Burun konisi (sabit, ön çerçeveye bağlı) + giriş kılavuz kanatları
  const nose = smoothProfile(
    [
      [0.002, z - v.noseLen],
      [0.06 * s, z - v.noseLen * 0.85],
      [0.12 * s, z - v.noseLen * 0.45],
      [0.165 * s, z - 0.02 * s],
      [0.17 * s, z + 0.12 * s],
    ],
    60,
  );
  // Burun konisi giriş kılavuz kanatlarının göbeğidir ve DÖNMEZ; dönen
  // izlenimi vermesin diye sarmal işaretsiz, düz boyalı
  group.add(tagPart(new THREE.Mesh(thickLathe(nose, 96, 0.008, 'in'), materials.nozzleFlap), 'spinner'));
  // Ön çerçeve: turbojette birkaç kalın dikme (yağ/hava hatları içinden
  // geçer); modern askeri turbofanda giriş kılavuz kanadı yok, fan doğrudan görünür
  if (v.igv > 0) {
    const strutGeo = createStageBladeGeometry(0.165 * s, t, {
      sections: 4,
      samples: 16,
      chord: [0.16 * s, 0.14 * s],
      twist: [0, 0],
      thickness: [0.22, 0.2],
      camber: [0, 0],
    });
    group.add(tagPart(bladeRow(strutGeo, materials.engineCase, v.igv, { z: z + 0.04 * s, phase: Math.PI / v.igv }), 'inlet'));
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
  const shellPts = [[t + 0.01, z + 0.02], ...v.shell];
  const shell = new THREE.Mesh(thickLathe(shellPts.map(([r, zz]) => new THREE.Vector2(r, zz)), 128, 0.01, 'in'), materials.engineCase);
  // Dış donanımın izleyeceği yüzey: gövde + art yakıcı kanalı (ya da jet borusu)
  const prof = radiusProfile([...v.shell, [ex.R, ex.z0 + 0.12], [ex.R, ex.z1]]);
  shell.name = 'engine-case';
  group.add(tagPart(shell, 'fanCase'));

  // Baypas ayırıcısı (turbofan): çekirdek ile baypas kanalını ayıran sac
  if (v.splitterZ !== null) {
    const split = new THREE.Mesh(latheFromProfile(splitterProfile(v, s), 96), materials.hubMetal);
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
  const strut = new THREE.BoxGeometry(0.018, ex.wall - tcR, 0.16);
  strut.translate(0, (ex.wall + tcR) / 2, 0);
  group.add(tagPart(radialInstances(strut, materials.sooted, 6, 0, tc0 + 0.08, { phase: 0.3 }), 'exhaust'));

  /* ---------------- lobe'lu karıştırıcı ---------------- */
  // Çiçek biçimli ince sac: lobe'lar sıcak çekirdek akışını dışa, soğuk
  // baypas akışını içe taşıyarak iki akışı iç içe geçirir. Genlik girişte
  // sıfırdan çıkışta en büyüğe büyür.
  if (v.mixer) group.add(tagPart(lobedMixer(v.mixer), 'exhaust'));

  /* ---------------- art yakıcı ya da jet borusu ---------------- */
  let holderZ = null;
  if (ab) {
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
    holderZ = ab.z0 + 0.42;
    for (const r of [ab.liner * 0.42, ab.liner * 0.66, ab.liner * 0.88]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 3, 96), materials.flameHolder);
      ring.rotation.z = Math.PI / 6;
      ring.position.z = holderZ;
      group.add(tagPart(ring, 'afterburner'));
    }
    const gutter = new THREE.BoxGeometry(0.03, ab.liner * 0.6, 0.03);
    gutter.translate(0, ab.liner * 0.6, 0);
    group.add(tagPart(radialInstances(gutter, materials.flameHolder, 10, 0, holderZ), 'afterburner'));
  } else {
    // Jet borusu: türbin çıkış çerçevesinden lüle flanşına; dışta ısı
    // renklenmesi, içte kurum (kesitte görünür)
    const jp = v.jetPipe;
    const r0 = v.shell[v.shell.length - 1][0];
    const pipe = new THREE.Mesh(
      thickLathe(
        [new THREE.Vector2(r0, jp.z0 - 0.03), new THREE.Vector2(ex.R, jp.z0 + 0.12), new THREE.Vector2(ex.R, jp.z1)],
        128,
        0.01,
        'out',
      ),
      materials.abDuct,
    );
    pipe.name = 'jet-pipe';
    group.add(tagPart(pipe, 'exhaust'));
    const pipeIn = new THREE.Mesh(
      thickLathe([new THREE.Vector2(jp.r, jp.z0 + 0.05), new THREE.Vector2(jp.r, jp.z1)], 96, 0.006, 'out'),
      materials.sooted,
    );
    pipeIn.name = 'jet-pipe-liner';
    group.add(tagPart(pipeIn, 'exhaust'));
  }

  /* ---------------- lüle: değişken (art yakıcı) ya da sabit ---------------- */
  const nozzle = fixed ? buildFixedNozzle(materials, v.nozzle) : buildNozzle(materials, ab.z1, v.nozzle);
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

  // Aksesuar dişli kutusu (alt tarafta, gövde eğrisini izler); boyları ve
  // aksesuarlar motor ölçeğiyle (şablonda bugünkü ölçüler)
  const gbZ0 = z + (turbojet ? 0.2 : 0.5) * sa;
  const gbLen = (turbojet ? 0.95 : 1.05) * sa;
  accessoryGearbox(
    group,
    prof,
    {
      z0: gbZ0,
      len: gbLen,
      arc: 1.15,
      depth: 0.13 * sa,
      accessories: [
        { kind: 'generator', da: -0.32, z: gbZ0 + 0.2 * sa, r: 0.07 * sa, h: 0.16 * sa },
        { kind: 'pump', da: 0.3, z: gbZ0 + 0.25 * sa, r: 0.06 * sa, h: 0.14 * sa, yaw: Math.PI / 2 }, // yakıt pompası
        { kind: 'starter', da: 0, z: gbZ0 + gbLen * 0.62, r: 0.075 * sa, h: 0.13 * sa }, // hava türbinli marş
        { kind: 'hydPump', da: -0.34, z: gbZ0 + gbLen * 0.8, r: 0.05 * sa, h: 0.12 * sa, yaw: Math.PI }, // hidrolik pompa
        { kind: 'oilPump', da: 0.34, z: gbZ0 + gbLen * 0.82, r: 0.045 * sa, h: 0.1 * sa }, // yağ pompası
      ],
    },
    mats,
  );
  oilTank(group, prof, { a: -0.25, z: gbZ0 + 0.3 * sa, r: 0.075 * sa, len: 0.34 * sa }, mats);
  controlUnit(group, prof, { a: Math.PI + 0.3, z: gbZ0 + 0.35 * sa, w: 0.22 * sa, h: 0.08 * sa, d: 0.3 * sa }, mats);

  // Borular: gövdeyi izler, kelepçelerle bağlanır
  const pipe = (a0, a1, z0, z1, rad, mat, gap = 0.012) => hugPipe(group, prof, { a0, a1, z0, z1, rad, gap, mat, kit });
  // Yakıt besleme: pompa → manifold
  pipe(B + 0.3, B + 0.55, gbZ0 + 0.3 * sa, cb.z0 + 0.03, 0.013 * sa, materials.engineCase);
  // Yağ hatları: tank → yataklar (ön ve arka)
  pipe(-0.25, -0.05, gbZ0 + 0.1 * sa, z + 0.25 * sa, 0.009 * sa, materials.brassFitting, 0.01);
  pipe(-0.3, -0.55, gbZ0 + 0.5 * sa, v.gas.lpt.z0 + 0.1, 0.009 * sa, materials.brassFitting, 0.01);
  // Kompresör bleed havası: kalın kanal
  pipe(Math.PI - 0.35, Math.PI - 0.15, v.gas.hpc.z1 - 0.05, cbz + 0.6 * sa, 0.028 * sa, materials.engineCase, 0.018);
  // Art yakıcı yakıt hattı: dişli kutusu → püskürtme halkaları
  if (ab) pipe(B - 0.5, B - 0.3, gbZ0 + 0.6 * sa, ab.z0 + 0.14, 0.015 * sa, materials.engineCase, 0.014);
  // Kablo demetleri: kontrol ünitesinden sensörlere
  harness(group, prof, { a0: Math.PI + 0.25, a1: Math.PI + 0.55, z0: z + 0.25 * sa, z1: ex.z0 - 0.05, mat: materials.hose, kit });
  harness(group, prof, { a0: Math.PI + 0.4, a1: 0.15, z0: gbZ0 + 0.5 * sa, z1: ex.z1 - 0.2, gap: 0.02, count: 2, mat: materials.hose, kit });
  // Art yakıcı püskürtme halkası besleme rakorları
  if (ab) for (let i = 0; i < 6; i++) kit.at('bNut', 0.4 + (i / 6) * Math.PI * 2, prof(ab.z0 + 0.14), ab.z0 + 0.14, {}, 'afterburner');
  // Egzoz sıcaklık sondaları (türbin çıkışı çevresinde), kaldırma kulakları
  probes(prof, v.gas.lpt.z1 + 0.14, 8, { kit }, 0.2, 'lpt');
  // Arka kulak egzoz bölümünün üstünde kalır: küçük kuru motorda jet borusu
  // kısa (1,2·r), kulak lüle konisinin üstünde havada asılı kalmasın
  liftLugs(prof, [z + 0.35 * sa, Math.min(ex.z0 + 0.3 * sa, ex.z1 - 0.05)], { kit });

  group.add(kit.build());

  /* ---------------- test standı askısı ---------------- */
  const yoke = buildStandYoke(materials, { mounts: v.standZ, engineR: R });
  group.add(tagPart(yoke, 'stand'));

  return {
    group,
    lpSpool,
    hpSpool,
    // Sabit lülede hareketli parça yok
    nozzle: fixed ? undefined : nozzle,
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
    abZ: ab ? holderZ : undefined,
    abR: ab ? ab.liner : undefined,
  };
}
