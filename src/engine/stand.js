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

/**
 * Yer taşıma standı (engine transportation cradle): test hücresi dışında
 * motor yerde duran tekerlekli bir şaseye oturur. Her bağlantı noktasında
 * motoru alttan saran bir beşik ve iki eğik ayak; ayaklar zemindeki boyuna
 * kirişlere iner, kirişlerin uçlarında döner tekerlekler.
 * @param {{ mounts: number[], engineR: number, floorY: number }} o
 */
export function buildGroundCradle(materials, { mounts, engineR, floorY }) {
  const group = new THREE.Group();
  group.name = 'ground-cradle';
  const paint = materials.kitPaint?.clone() ?? materials.standPaint.clone();
  paint.color.setHex(0x2f5d8c); // yer destek ekipmanı mavisi
  paint.userData.owned = true; // stand atılırken birlikte silinir
  const steel = materials.kitSteel ?? materials.machinery;
  const rubber = materials.kitRubber ?? materials.hose;
  const tube = (a, b, w, mat) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d.length(), w), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    group.add(m);
    return m;
  };
  const baseY = floorY + 0.16; // tekerlek yüksekliği
  const halfW = Math.max(0.45, engineR * 0.95);
  const z0 = Math.min(...mounts) - 0.35;
  const z1 = Math.max(...mounts) + 0.35;
  // Boyuna ve enine taban kirişleri
  for (const x of [-halfW, halfW]) tube(new THREE.Vector3(x, baseY, z0), new THREE.Vector3(x, baseY, z1), 0.1, paint);
  for (const z of [z0 + 0.05, z1 - 0.05]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.1, 0.1, 0.1), paint);
    b.position.set(0, baseY, z);
    group.add(b);
  }
  // Tekerlekler (döner kaster)
  for (const x of [-halfW, halfW]) {
    for (const z of [z0 + 0.05, z1 - 0.05]) {
      const fork = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.1), steel);
      fork.position.set(x, baseY - 0.08, z);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, floorY + 0.07, z);
      group.add(fork, wheel);
    }
  }
  // Her bağlantı noktasında beşik + ayaklar
  const saddleR = engineR + 0.035;
  for (const mz of mounts) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(saddleR, 0.035, 8, 40, Math.PI * 0.62), paint);
    arc.rotation.z = -Math.PI / 2 - Math.PI * 0.31;
    arc.position.z = mz;
    const pad = new THREE.Mesh(new THREE.TorusGeometry(engineR + 0.008, 0.012, 6, 40, Math.PI * 0.5), rubber);
    pad.rotation.z = -Math.PI / 2 - Math.PI * 0.25;
    pad.position.z = mz;
    group.add(arc, pad);
    for (const sx of [-1, 1]) {
      const a = -Math.PI / 2 + sx * Math.PI * 0.3;
      const top = new THREE.Vector3(Math.cos(a) * saddleR, Math.sin(a) * saddleR, mz);
      tube(top, new THREE.Vector3(sx * halfW, baseY + 0.05, mz), 0.08, paint);
    }
    // Orta dikme (beşiğin en alt noktası)
    tube(new THREE.Vector3(0, -saddleR, mz), new THREE.Vector3(0, baseY + 0.05, mz), 0.09, paint);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.1, 0.09, 0.09), paint);
    cross.position.set(0, baseY, mz);
    group.add(cross);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Pilonlu turbofan için açık hava test sehpası: motor pilonundan, iki
 * A-çerçeve ve boyuna kirişlerden oluşan çelik bir portala asılır (motor
 * yer testlerinde kullanılan itki çerçevesi). Ayaklar nasel çapının
 * dışında, geniş tabanlı; tabanda cıvatalı plakalar.
 */
export function buildPylonGantry(materials, { mounts, top, floorY, halfSpan = 2.1 }) {
  const group = new THREE.Group();
  group.name = 'pylon-gantry';
  // Sarı yer donanımı boyası: düz endüstriyel boya (tarama sarıda mermer gibi görünür)
  const paint = new THREE.MeshStandardMaterial({ color: 0xc2951f, roughness: 0.5, metalness: 0.15 });
  paint.userData.owned = true;
  const dark = materials.kitSteel ?? materials.machinery;
  const beam = (a, b, w, h, mat) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d.length(), h), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    group.add(m);
    return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const z0 = Math.min(...mounts) - 0.7;
  const z1 = Math.max(...mounts) + 0.7;
  const yTop = top + 0.14;
  const baseHalf = halfSpan + 0.55;
  for (const z of [z0, z1]) {
    // A-çerçeve: iki eğik ayak, üst başlık, orta yatay bağ
    for (const s of [-1, 1]) {
      beam(V(s * baseHalf, floorY + 0.03, z), V(s * halfSpan, yTop, z), 0.2, 0.2, paint);
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.55), dark);
      pl.position.set(s * baseHalf, floorY + 0.015, z);
      group.add(pl);
      for (const [bx, bz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6), dark);
        bolt.position.set(s * baseHalf + bx, floorY + 0.04, z + bz);
        group.add(bolt);
      }
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2 + 0.3, 0.3, 0.26), paint);
    head.position.set(0, yTop + 0.15, z);
    group.add(head);
    const mid = floorY + (yTop - floorY) * 0.42;
    const t = (mid - floorY) / (yTop - floorY);
    const xm = baseHalf + (halfSpan - baseHalf) * t;
    beam(V(-xm, mid, z), V(xm, mid, z), 0.12, 0.12, paint);
    beam(V(-xm, mid, z), V(0, yTop, z), 0.09, 0.09, paint);
    beam(V(xm, mid, z), V(0, yTop, z), 0.09, 0.09, paint);
  }
  // Boyuna kirişler (pilonu taşıyan) ve yan çaprazlar
  for (const x of [-0.32, 0.32]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, z1 - z0 + 0.26), paint);
    b.position.set(x, yTop - 0.02, (z0 + z1) / 2);
    group.add(b);
  }
  for (const s of [-1, 1]) {
    beam(V(s * halfSpan, yTop + 0.15, z0), V(s * halfSpan, yTop + 0.15, z1), 0.14, 0.14, paint);
    beam(V(s * baseHalf, floorY + 0.1, z0), V(s * (halfSpan + 0.25), yTop - 0.9, z1), 0.08, 0.08, paint);
  }
  // Pilon bağlantı bloğu
  for (const mz of mounts) {
    const blk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.4), dark);
    blk.position.set(0, top + 0.02, mz);
    group.add(blk);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
