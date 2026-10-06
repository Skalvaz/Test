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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  const geo = fastLathe(profile, segments, phiStart, phiLength);
  // Normaller profilden analitik (dikişte de pürüzsüz); computeVertexNormals
  // yeniden üretim süresinin üçte birini alıyordu. Yalnız yön, üçgen
  // sarımıyla tutarlı olmalı (dış = sarım).
  alignNormalsToWinding(geo);
  return geo;
}

/**
 * THREE.LatheGeometry + rotateX(π/2) ile aynı köşe düzeni, UV ve üçgenler;
 * ama doğrudan motor ekseninde (z) ve tipli dizilerle kurulur (Y ekseninde
 * kurup bütün köşeleri döndürmek artımlı üretimde pahalıydı). Gerçek
 * malzeme taramaları için uv1 (metre) de burada yazılır.
 */
function fastLathe(points, segments, phiStart, phiLength) {
  const n = points.length;
  const cols = segments + 1;
  const nv = cols * n;
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const uv1 = new Float32Array(nv * 2);
  // Meridyen normalleri (r, z): komşu kenar normallerinin ortalaması
  const nr = new Float64Array(n);
  const nz = new Float64Array(n);
  let pr = 0;
  let pz = 0;
  for (let j = 0; j < n; j++) {
    let x = 0;
    let y = 0;
    if (j < n - 1) {
      const dx = points[j + 1].x - points[j].x;
      const dy = points[j + 1].y - points[j].y;
      x = dy + (j > 0 ? pr : 0);
      y = -dx + (j > 0 ? pz : 0);
      pr = dy;
      pz = -dx;
    } else {
      x = pr;
      y = pz;
    }
    const l = Math.hypot(x, y) || 1;
    nr[j] = x / l;
    nz[j] = y / l;
  }
  const TAU = Math.PI * 2;
  let v = 0;
  for (let i = 0; i < cols; i++) {
    const phi = phiStart + (i / segments) * phiLength;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    const u = i / segments;
    for (let j = 0; j < n; j++) {
      const r = points[j].x;
      const z = points[j].y;
      // LatheGeometry (r·sinφ, z, r·cosφ) → X ekseninde +90° → (r·sinφ, −r·cosφ, z)
      pos[v * 3] = r * s;
      pos[v * 3 + 1] = -r * c;
      pos[v * 3 + 2] = z;
      nrm[v * 3] = nr[j] * s;
      nrm[v * 3 + 1] = -nr[j] * c;
      nrm[v * 3 + 2] = nz[j];
      uv[v * 2] = u;
      uv[v * 2 + 1] = j / (n - 1);
      uv1[v * 2] = u * TAU * Math.abs(r);
      uv1[v * 2 + 1] = z;
      v++;
    }
  }
  const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(segments * (n - 1) * 6);
  let k = 0;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = j + i * n;
      const b = a + n;
      const cc = a + n + 1;
      const d = a + 1;
      idx[k++] = a;
      idx[k++] = b;
      idx[k++] = d;
      idx[k++] = cc;
      idx[k++] = d;
      idx[k++] = b;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  let rMax = 0;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const p of points) {
    rMax = Math.max(rMax, p.x);
    zMin = Math.min(zMin, p.y);
    zMax = Math.max(zMax, p.y);
  }
  const hz = (zMax - zMin) / 2;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, zMin + hz), Math.hypot(rMax, hz));
  return g;
}

/** Köşe normallerini ilk dejenere olmayan üçgenin sarım yönüne göre çevirir */
function alignNormalsToWinding(geo) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const idx = geo.index.array;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(pos, idx[i]);
    b.fromBufferAttribute(pos, idx[i + 1]);
    c.fromBufferAttribute(pos, idx[i + 2]);
    const f = c.sub(b).cross(a.sub(b));
    if (f.lengthSq() < 1e-14) continue;
    const vn = b.fromBufferAttribute(nrm, idx[i]);
    if (f.dot(vn) < 0) {
      const arr = nrm.array;
      for (let k = 0; k < arr.length; k++) arr[k] = -arr[k];
    }
    return;
  }
}

/**
 * Lathe gövdesinin v koordinatını profil boyunca yay uzunluğuna göre yeniden
 * dağıtır. LatheGeometry v'yi nokta indeksine göre verir; spline örnekleri
 * eşit aralıklı olmadığından doku eksen boyunca yer yer gerilir, perçinler
 * elipsleşirdi. Pişirilmiş detay haritaları metre ölçeğinde olduğu için
 * v = s / L gerekir.
 */
export function arcLengthV(geometry, profile) {
  const n = profile.length;
  const cum = new Float32Array(n);
  for (let j = 1; j < n; j++) cum[j] = cum[j - 1] + profile[j].distanceTo(profile[j - 1]);
  const total = cum[n - 1] || 1;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, cum[i % n] / total);
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Kesit halkalarından örülmüş gövdelerde (kanat/pilon loft'u) u koordinatını
 * her kesitin çevresi boyunca yay uzunluğuna göre yeniden dağıtır. Profil
 * noktaları hücum kenarında sıklaştığı için indeks tabanlı u orada dokuyu
 * sıkıştırırdı. İlk `rings × ringSize` köşe halkalardır; sonrakiler (uç
 * kapakları) olduğu gibi kalır.
 */
export function arcLengthU(geometry, ringSize, rings) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const cum = new Float32Array(ringSize);
  for (let r = 0; r < rings; r++) {
    const base = r * ringSize;
    for (let i = 1; i < ringSize; i++) {
      a.fromBufferAttribute(pos, base + i - 1);
      b.fromBufferAttribute(pos, base + i);
      cum[i] = cum[i - 1] + a.distanceTo(b);
    }
    const total = cum[ringSize - 1] || 1;
    for (let i = 0; i < ringSize; i++) uv.setX(base + i, cum[i] / total);
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Kalınlıklı dönel kabuk: profilin döndürülmüş yüzeyi + t kadar ötelenmiş
 * ikinci yüzey + iki uç halkası → kapalı katı. Kesit görünümünde kabuk
 * duvarı dolu (kapaklı) görünür; ince açık yüzeyler "kâğıt" gibi durur.
 *
 * Dış yüzey LatheGeometry ile aynıdır (UV ve pişirilmiş detay haritaları
 * korunur). `side` ötelemenin yönü: 'in' (eksene doğru), 'out' (dışa) ya
 * da katının içinde kalan bir [r, z] noktası.
 */
export function thickLathe(profile, segments, t, side = 'in', opts = {}) {
  const pts = profile.map((p) => (p.isVector2 ? p : new THREE.Vector2(p[0], p[1])));
  const outer = latheFromProfile(pts, segments);
  if (opts.arcV) arcLengthV(outer, pts);
  const n = pts.length;
  // Profil normalleri (r, z): dış yüzey normalinden (φ = 0 sütunu)
  const nrm = outer.attributes.normal;
  const n2 = [];
  for (let j = 0; j < n; j++) n2.push([-nrm.getY(j), nrm.getZ(j)]);
  let sgn;
  if (Array.isArray(side)) {
    const m = Math.floor(n / 2);
    const d = [side[0] - pts[m].x, side[1] - pts[m].y];
    sgn = d[0] * n2[m][0] + d[1] * n2[m][1] >= 0 ? 1 : -1;
  } else {
    let s = 0;
    for (const v of n2) s += v[0];
    sgn = (side === 'out' ? 1 : -1) * (s >= 0 ? 1 : -1);
  }
  const off = pts.map((p, j) => new THREE.Vector2(Math.max(0, p.x + sgn * t * n2[j][0]), p.y + sgn * t * n2[j][1]));
  // İç yüzey yalnız kesitte görünür: profil seyreltilir (uçlar korunur)
  const step = Math.max(1, Math.round(n / 48));
  const offS = off.filter((_, j) => j % step === 0 || j === n - 1);
  const inner = latheFromProfile(offS, segments);
  const flip = (g) => {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    const a = g.attributes.normal.array;
    for (let i = 0; i < a.length; i++) a[i] = -a[i];
  };
  // Katının dış normali: dış yüzeyde −sgn·n, iç yüzeyde +sgn·n
  if (sgn > 0) flip(outer);
  if (sgn < 0) flip(inner);
  const cap = (a, b, outDir) => {
    const g = latheFromProfile([a, b], segments);
    const gn = g.attributes.normal;
    if (-gn.getY(0) * outDir[0] + gn.getZ(0) * outDir[1] < 0) flip(g);
    return g;
  };
  const d0 = [pts[0].x - pts[1].x, pts[0].y - pts[1].y];
  const d1 = [pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y];
  const parts = [outer, inner, cap(pts[0], off[0], d0), cap(pts[n - 1], off[n - 1], d1)];
  const merged = mergeGeometries(parts, false);
  // Dış yüzey ilk sırada: kesit kapalıyken yalnız o çizilir (drawRange),
  // iç yüzey ve uç halkaları kesitte açılır (bkz. visual.setClipping)
  merged.userData.outerCount = outer.index.count;
  merged.setDrawRange(0, outer.index.count);
  // uv1 (metre): LatheGeometry kuralıyla (ensureUV1 bu türü tanımaz)
  const pos = merged.attributes.position;
  const uv = merged.attributes.uv;
  const u1 = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    u1[i * 2] = uv.getX(i) * Math.PI * 2 * Math.hypot(pos.getX(i), pos.getY(i));
    u1[i * 2 + 1] = pos.getZ(i);
  }
  merged.setAttribute('uv1', new THREE.BufferAttribute(u1, 2));
  return merged;
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

/**
 * Dünya ölçekli üç düzlemli UV (kit malzemelerinin döşenen dokuları için:
 * 1 UV birimi = `scale` metre). Yüz normalinin baskın eksenine göre izdüşüm.
 */
export function boxUV(geometry, scale = 0.15) {
  // Dikişte UV kopabilsin diye indekssiz (köşe normalleri korunur)
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const fn = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    fn.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const ax = Math.abs(fn.x) > Math.abs(fn.y) ? (Math.abs(fn.x) > Math.abs(fn.z) ? 0 : 2) : Math.abs(fn.y) > Math.abs(fn.z) ? 1 : 2;
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(i + k);
      const y = pos.getY(i + k);
      const z = pos.getZ(i + k);
      const [u, v] = ax === 0 ? [z, y] : ax === 1 ? [x, z] : [x, y];
      uv[(i + k) * 2] = u / scale;
      uv[(i + k) * 2 + 1] = v / scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * Metre ölçekli ikinci UV kanalı (uv1) — gerçek malzeme taramaları için
 * (bkz. materials/scans.js). Geometri tipine göre:
 *  - Lathe (eksen z; latheFromProfile): u = çevre boyunca yay, v = z
 *  - Silindir (eksen y): u = çevre, v = y
 *  - Torus: u = büyük çember, v = boru çevresi
 *  - Boru (TubeGeometry): u = yol uzunluğu, v = boru çevresi
 *  - diğerleri: köşe normaline göre üç düzlemli izdüşüm
 * Aynı geometri birden çok ağda kullanılabileceği için bir kez hesaplanır.
 */
export function ensureUV1(geometry) {
  if (!geometry || geometry.attributes.uv1 || !geometry.attributes.position) return;
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const nrm = geometry.attributes.normal;
  const n = pos.count;
  const out = new Float32Array(n * 2);
  const type = geometry.type;
  const p = geometry.parameters ?? {};
  const TAU = Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u;
    let v;
    if (uv && type === 'LatheGeometry') {
      u = uv.getX(i) * TAU * Math.hypot(x, y);
      v = z;
    } else if (uv && type === 'CylinderGeometry') {
      u = uv.getX(i) * TAU * Math.hypot(x, z);
      v = y;
    } else if (uv && type === 'TorusGeometry') {
      u = uv.getX(i) * (p.arc ?? TAU) * (p.radius ?? 1);
      v = uv.getY(i) * TAU * (p.tube ?? 0.1);
    } else if (uv && type === 'TubeGeometry') {
      u = uv.getX(i) * (p.path?.getLength?.() ?? 1);
      v = uv.getY(i) * TAU * (p.radius ?? 0.01);
    } else {
      const ax = nrm ? Math.abs(nrm.getX(i)) : 0;
      const ay = nrm ? Math.abs(nrm.getY(i)) : 1;
      const az = nrm ? Math.abs(nrm.getZ(i)) : 0;
      if (ax >= ay && ax >= az) [u, v] = [z, y];
      else if (ay >= az) [u, v] = [x, z];
      else [u, v] = [x, y];
    }
    out[i * 2] = u;
    out[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv1', new THREE.BufferAttribute(out, 2));
}
