/**
 * Test standı askısı: kaportasız motorları hücrenin itki ölçüm çerçevesine
 * asan çelik kiriş ve bağlantı levhaları. Kirişin üstü, yük hücresine bağlı
 * canlı çerçevenin adaptörüne (y ≈ 3.3) oturur.
 */

import * as THREE from 'three';

const BEAM_Y = 3.08;

/**
 * @param {{ mounts: number[], engineR: number }} opts mounts: askı bağlantı
 *   noktalarının z konumları; engineR: motor dış yarıçapı
 */
export function buildStandYoke(materials, { mounts, engineR }) {
  const group = new THREE.Group();
  group.name = 'stand-yoke';
  const z0 = Math.min(...mounts) - 0.25;
  const z1 = Math.max(...mounts) + 0.25;

  // Üst kiriş (I-profil: iki başlık + gövde)
  const len = z1 - z0;
  const cz = (z0 + z1) / 2;
  for (const dy of [0.11, -0.11]) {
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, len), materials.standPaint);
    flange.position.set(0, BEAM_Y + dy, cz);
    group.add(flange);
  }
  const web = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, len), materials.standPaint);
  web.position.set(0, BEAM_Y, cz);
  group.add(web);
  // Adaptör bloğu (canlı çerçeveye)
  const adapter = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.5), materials.machinery);
  adapter.position.set(0, BEAM_Y + 0.19, cz);
  group.add(adapter);

  // Askı levhaları ve motor bağlantı yastıkları
  const top = BEAM_Y - 0.12;
  const bottom = engineR + 0.04;
  for (const mz of mounts) {
    for (const x of [-0.13, 0.13]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, top - bottom, 0.22), materials.standPaint);
      plate.position.set(x, (top + bottom) / 2, mz);
      group.add(plate);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 16), materials.machinery);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, bottom + 0.05, mz);
    group.add(pin);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.18), materials.machinery);
    pad.position.set(0, engineR + 0.02, mz);
    group.add(pad);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
