/**
 * Fan kademesi: burun konisi (spinner), fan diski, geniş kordlu titanyum
 * kanatlar ve yüksek devirde devreye giren hareket bulanıklığı diski.
 */

import * as THREE from 'three';
import { smoothProfile, latheFromProfile, bladeRow } from './geom.js';
import { createBladeGeometry } from './airfoil.js';
import { createBlurDiscTexture } from '../materials/textures.js';

export const FAN_BLADE_COUNT = 22;

export function buildFan(materials) {
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
  const spinner = new THREE.Mesh(latheFromProfile(spinnerProfile, 192), materials.spinner);
  spinner.name = 'spinner';
  spinner.castShadow = true;
  spinner.receiveShadow = true;
  group.add(spinner);

  /* ---------------- fan diski ve kanat platformları ---------------- */
  const platformProfile = smoothProfile(
    [
      [0.440, -0.560],
      [0.452, -0.470],
      [0.462, -0.300],
      [0.468, -0.120],
      [0.470, 0.020],
      [0.455, 0.080],
      [0.400, 0.105],
    ],
    70,
  );
  const platform = new THREE.Mesh(latheFromProfile(platformProfile, 192), materials.hubMetal);
  platform.name = 'fan-platform';
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);

  // Kanat kökü yuvaları arasındaki ayırıcı contalar
  const sealGeo = new THREE.BoxGeometry(0.035, 0.05, 0.62);
  const seals = bladeRow(sealGeo, materials.composite, FAN_BLADE_COUNT, {
    z: -0.28,
    phase: Math.PI / FAN_BLADE_COUNT,
  });
  // InstancedMesh yalnızca dönüş uygular; contaları yarıçapa taşımak için
  // geometriyi önceden ötelemek gerekir.
  sealGeo.translate(0, 0.462, 0);
  group.add(seals);

  /* ---------------- geniş kordlu fan kanatları ---------------- */
  const bladeGeo = createBladeGeometry({
    hubRadius: 0.455,
    tipRadius: 1.386,
    sections: 34,
    samples: 110,
    // Kord uç bölgesinde genişler (wide-chord tasarım)
    chord: (t) => 0.50 + 0.62 * Math.pow(t, 0.85),
    // Kökte yüksek burulma, uçta düşük — eksenel hız profiline uyum
    twist: (t) => THREE.MathUtils.degToRad(62 - 46 * Math.pow(t, 0.72)),
    thickness: (t) => 0.155 - 0.115 * Math.pow(t, 0.7),
    camber: (t) => 0.062 - 0.048 * t,
    // Pala ucu öne kıvrımlı "pala/scimitar" ok dağılımı
    sweep: (t) => 0.30 * t * t - 0.46 * Math.pow(t, 4.6),
    lean: (t) => 0.085 * Math.sin(Math.PI * t) - 0.03 * t,
    chordAnchor: 0.34,
    tipRound: 0.05,
  });

  const blades = bladeRow(bladeGeo, materials.titanium, FAN_BLADE_COUNT, { z: -0.28 });
  blades.name = 'fan-blades';
  group.add(blades);

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
