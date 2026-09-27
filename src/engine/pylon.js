/**
 * Pilon ve kanat bağlantısı.
 *
 * Pilon, kanat profili loft üreticisiyle çıkarılır: açıklık yukarı doğru,
 * kord eksenel. Böylece gerçek bir akım hattı kesiti elde edilir.
 */

import * as THREE from 'three';
import { airfoilSection, createBladeGeometry } from './airfoil.js';
import { arcLengthU, tagPart } from './geom.js';

export function buildPylon(materials) {
  const group = new THREE.Group();
  group.name = 'pylon';

  const pylonGeo = createBladeGeometry({
    hubRadius: 1.52,
    tipRadius: 3.05,
    sections: 22,
    samples: 64,
    chord: (t) => 3.05 - 0.75 * t,
    twist: () => 0,
    thickness: (t) => 0.135 - 0.03 * t,
    camber: () => 0,
    sweep: (t) => -0.18 * t - 0.12 * t * t,
    lean: () => 0,
    chordAnchor: 0.42,
    tipRound: 0.02,
  });
  // u: firar kenarı → hücum kenarı → firar kenarı; pişirilmiş panel dokusu
  // metre ölçeğinde olduğu için yay uzunluğuna göre dağıtılır
  arcLengthU(pylonGeo, airfoilSection(64, 0.1, 0).length, 22);
  const pylon = new THREE.Mesh(pylonGeo, materials.pylonDetail);
  pylon.name = 'pylon-strut';
  pylon.castShadow = true;
  pylon.receiveShadow = true;
  pylon.position.z = 0.05;
  group.add(pylon);

  // Motor bağlantı mahmuzları (ön ve arka mount)
  const mountGeo = new THREE.BoxGeometry(0.42, 0.20, 0.22);
  [-0.55, 1.25].forEach((z) => {
    const mount = new THREE.Mesh(mountGeo, materials.machinery);
    mount.position.set(0, 1.62, z);
    mount.castShadow = true;
    group.add(mount);
  });

  const linkGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.46, 12);
  [[-0.18, -0.55], [0.18, -0.55], [-0.20, 1.25], [0.20, 1.25]].forEach(([x, z]) => {
    const link = new THREE.Mesh(linkGeo, materials.machinery);
    link.position.set(x, 1.48, z);
    link.rotation.z = x > 0 ? 0.22 : -0.22;
    group.add(link);
  });

  /* ---------------- kanat kökü (isteğe bağlı) ---------------- */
  const wing = new THREE.Group();
  wing.name = 'wing-stub';

  const wingGeo = createBladeGeometry({
    hubRadius: 0.0,
    tipRadius: 4.2,
    sections: 14,
    samples: 60,
    chord: (t) => 5.4 - 1.5 * t,
    twist: () => 0,
    thickness: (t) => 0.125 - 0.02 * t,
    camber: (t) => 0.022 - 0.006 * t,
    sweep: (t) => 1.55 * t,
    lean: () => 0,
    chordAnchor: 0.35,
    tipRound: 0.04,
  });
  const wingMesh = new THREE.Mesh(wingGeo, materials.pylonSkin);
  // Açıklığı +Y'den +X'e çevir, ardından dihedral ver
  wingMesh.rotation.z = -Math.PI / 2;
  wingMesh.position.set(0, 3.15, 0.35);
  wingMesh.castShadow = true;
  wingMesh.receiveShadow = true;
  wing.add(wingMesh);

  const wingMirror = wingMesh.clone();
  wingMirror.rotation.z = Math.PI / 2;
  wing.add(wingMirror);

  wing.visible = false;
  group.add(wing);

  tagPart(group, 'pylon');
  tagPart(wing, 'wing');
  return { group, wing };
}
