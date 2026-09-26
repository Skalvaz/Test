/**
 * Geometri yardımcıları.
 *
 * Koordinat sistemi (sahne genelinde geçerli):
 *   +Z  → arka / egzoz yönü
 *   -Z  → ön / hava girişi
 *   +Y  → yukarı (pilon yönü)
 *   X   → teğetsel
 * Motor ekseni Z'dir; bütün dönel parçalar Z ekseni etrafında döner.
 */

import * as THREE from 'three';

/**
 * Kontrol noktalarından yumuşak bir profil eğrisi örnekler.
 * @param {Array<[number,number]>} points [yarıçap, eksenel konum] çiftleri
 * @param {number} divisions çıktı örnek sayısı
 */
export function smoothProfile(points, divisions = 160) {
  const vecs = points.map(([r, z]) => new THREE.Vector2(r, z));
  const curve = new THREE.SplineCurve(vecs);
  const sampled = curve.getPoints(divisions);
  // Catmull-Rom, sıfıra yaklaşan yarıçaplarda negatife taşabilir; bu da
  // lathe gövdesinde iç içe geçmiş, tırtıklı yüzeylere yol açar.
  for (const p of sampled) p.x = Math.max(p.x, 0);
  return sampled;
}

/**
 * Profil noktalarını Z ekseni etrafında döndürerek gövde üretir.
 * LatheGeometry Y ekseni etrafında çalıştığı için sonuç X ekseninde
 * +90° döndürülür.
 */
export function latheFromProfile(profile, segments = 256, phiStart = 0, phiLength = Math.PI * 2) {
  const geo = new THREE.LatheGeometry(profile, segments, phiStart, phiLength);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Basit halka (disk) — iki yarıçap arasında, sabit eksenel konumda. */
export function annulusGeometry(inner, outer, z, segments = 128, flip = false) {
  const geo = new THREE.RingGeometry(inner, outer, segments, 1);
  if (flip) geo.rotateY(Math.PI);
  geo.translate(0, 0, z);
  return geo;
}

/** Eksenel konumu z olan, [r0,z0]→[r1,z1] profilli ince kabuk (koni kesiti). */
export function conicShell(r0, z0, r1, z1, segments = 128, thickness = 0) {
  const pts = thickness
    ? [
        new THREE.Vector2(r0, z0),
        new THREE.Vector2(r1, z1),
        new THREE.Vector2(r1 - thickness, z1),
        new THREE.Vector2(r0 - thickness, z0),
        new THREE.Vector2(r0, z0),
      ]
    : [new THREE.Vector2(r0, z0), new THREE.Vector2(r1, z1)];
  return latheFromProfile(pts, segments);
}

/**
 * Bir halka üzerinde eşit aralıklı kopyalar üretir (cıvata, kilit, enjektör…).
 * @returns {THREE.InstancedMesh}
 */
export function radialInstances(geometry, material, count, radius, z, opts = {}) {
  const { tiltToAxis = true, phase = 0, extraRotation = null, scale = 1 } = opts;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const s = new THREE.Vector3(scale, scale, scale);
  const euler = new THREE.Euler();

  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    pos.set(Math.cos(a) * radius, Math.sin(a) * radius, z);
    if (tiltToAxis) {
      euler.set(0, 0, a);
    } else {
      euler.set(0, 0, 0);
    }
    q.setFromEuler(euler);
    if (extraRotation) {
      const q2 = new THREE.Quaternion().setFromEuler(extraRotation);
      q.multiply(q2);
    }
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Kanat/kanatçık dizisini tek InstancedMesh içinde üretir. */
export function bladeRow(geometry, material, count, opts = {}) {
  const { phase = 0, z = 0, pitch = 0, scale = 1 } = opts;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const s = new THREE.Vector3(scale, scale, scale);

  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    pos.set(0, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
    if (pitch) {
      q2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pitch);
      q.multiply(q2);
    }
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Torus tabanlı kablo/hortum demeti — motor dışı tesisat detayı için. */
export function pipeAlong(points, radius = 0.02, radialSegments = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, radialSegments, false);
}

/**
 * Bir nesneyi (ve alt nesnelerini) bir motor parçası kimliğiyle etiketler.
 * Etiket; ders içinde parça seçme, vurgulama ve bilgi kartları için kullanılır.
 */
export function tagPart(obj, part) {
  obj.traverse((o) => {
    o.userData.part = part;
  });
  return obj;
}
