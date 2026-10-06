/**
 * Fan kademesi: burun konisi (spinner), fan diski, geniş kordlu titanyum
 * kanatlar ve yüksek devirde devreye giren hareket bulanıklığı diski.
 */

import * as THREE from 'three';
import { smoothProfile, thickLathe, bladeRow, tagPart } from './geom.js';
import { createBlade } from './blades.js';
import { revolve, roundPoly } from './revolve.js';
import { createBlurDiscTexture } from '../materials/textures.js';

/**
 * Fan M4 öncesi modelin ölçülerinde (uç 1,386 m, rotor z −0,28) kurulur;
 * görsel model grubu fan ucu oranında ölçekler (visual.ts).
 */
export function buildFan(materials, FAN_BLADE_COUNT = 22) {
  const group = new THREE.Group();
  group.name = 'fan-rotor';

  /* ---------------- burun konisi: ojiv profil ---------------- */
  const spinnerProfile = smoothProfile(
    [
      [0.004, -1.640],
      [0.075, -1.575],
      [0.160, -1.455],
      [0.248, -1.290],
      [0.320, -1.100],
      [0.376, -0.900],
      [0.412, -0.740],
      [0.432, -0.640],
      [0.440, -0.560],
    ],
    110,
  );
  const spinner = new THREE.Mesh(thickLathe(spinnerProfile, 192, 0.012, 'in'), materials.spinner);
  spinner.name = 'spinner';
  spinner.castShadow = true;
  spinner.receiveShadow = true;
  group.add(tagPart(spinner, 'spinner'));

  /* ---------------- geniş kordlu fan kanatları ---------------- */
  // Kanat: hücumda yüksek, uçta düşük dönüşlü profil; pala (scimitar) ok
  // dağılımı ve uca doğru genişleyen kord. Kök: kırlangıç kuyruğu, kanatlar
  // arasında dolgu platformu (annulus filler).
  const deg = THREE.MathUtils.degToRad;
  const hub = 0.455;
  const tip = 1.386;
  const bladeGeo = createBlade({
    hub,
    tip,
    count: FAN_BLADE_COUNT,
    chord: (t) => 0.5 + 0.6 * Math.pow(t, 0.85),
    beta1: (t) => deg(44 + 22 * Math.pow(t, 0.8)),
    beta2: (t) => deg(8 + 50 * Math.pow(t, 1.15)),
    tmax: (t) => 0.1 - 0.072 * Math.pow(t, 0.6),
    te: 0.007,
    xt: 0.42,
    sweep: (t) => 0.3 * t * t - 0.46 * Math.pow(t, 4.6),
    lean: (t) => 0.085 * Math.sin(Math.PI * t) - 0.03 * t,
    sections: 30,
    samples: 56,
    fillet: 0.025,
    platform: { depth: 0.014 / (tip - hub), over: 0.04 },
    root: 'dovetail',
    rootDepth: 0.075,
    tipType: 'plain',
  });
  const info = bladeGeo.userData.bladeInfo;
  const blades = bladeRow(bladeGeo, materials.fanBlade ?? materials.titanium, FAN_BLADE_COUNT, { z: -0.28 });
  // Örnek verisi (bladeShading): ısı yok, kanat başına rastgele
  const c = new THREE.Color();
  for (let i = 0; i < FAN_BLADE_COUNT; i++) blades.setColorAt(i, c.setRGB(0, ((i * 0.618) % 1), 0));
  blades.name = 'fan-blades';
  group.add(tagPart(blades, 'fan'));

  /* ---------------- fan diski ---------------- */
  // Jant kırlangıç yuvalarını taşır; ince gövde LP mil göbeğine iner
  const rz0 = -0.28 + info.rootZ[0] + 0.004;
  const rz1 = -0.28 + info.rootZ[1] - 0.004;
  const rimTop = info.platR;
  const rimBot = info.rootBottom - 0.02;
  const zc = (rz0 + rz1) / 2;
  const w = rz1 - rz0;
  const disk = roundPoly(
    [
      [rimTop, rz0],
      [rimTop, rz1],
      [rimBot, rz1],
      [rimBot, zc + w * 0.09],
      [0.2, zc + w * 0.16],
      [0.2, zc + w * 0.34],
      [0.118, zc + w * 0.34],
      [0.118, zc - w * 0.3],
      [0.2, zc - w * 0.3],
      [0.2, zc - w * 0.16],
      [rimBot, zc - w * 0.09],
      [rimBot, rz0],
    ],
    [0.004, 0.004, 0.006, 0.05, 0.03, 0.004, 0.003, 0.003, 0.004, 0.03, 0.05, 0.006],
    3,
  );
  const diskMesh = new THREE.Mesh(revolve(disk, { segments: 144 }), materials.diskMetal ?? materials.hubMetal);
  diskMesh.name = 'fan-disk';
  group.add(tagPart(diskMesh, 'fan'));

  // Göbek kaplaması: spinner ile kanat platformları arasındaki kapalı
  // halka (ön) ve arka conta halkası
  const fairing = roundPoly(
    [
      [0.44, -0.56],
      [info.platR + 0.012, rz0 - 0.004],
      [info.platR - 0.02, rz0 - 0.004],
      [0.4, -0.56],
    ],
    0.004,
    2,
  );
  const fairingMesh = new THREE.Mesh(revolve(fairing, { segments: 160 }), materials.diskMetal ?? materials.hubMetal);
  group.add(tagPart(fairingMesh, 'fan'));
  const aftSeal = roundPoly(
    [
      [info.platR + 0.006, rz1 + 0.002],
      [0.452, 0.02],
      [0.41, 0.105],
      [0.39, 0.105],
      [info.platR - 0.03, rz1 + 0.002],
    ],
    0.004,
    2,
  );
  group.add(tagPart(new THREE.Mesh(revolve(aftSeal, { segments: 160 }), materials.diskMetal ?? materials.hubMetal), 'fan'));

  /* ---------------- hareket bulanıklığı diski ---------------- */
  const blurTex = createBlurDiscTexture(1024, FAN_BLADE_COUNT);
  const blurMat = new THREE.MeshBasicMaterial({
    map: blurTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: true,
  });
  const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(1.386, 96), blurMat);
  blurDisc.position.z = -0.20;
  blurDisc.name = 'fan-motion-blur';
  blurDisc.visible = false;
  group.add(blurDisc);

  return { group, blades, blurDisc, blurMat };
}
