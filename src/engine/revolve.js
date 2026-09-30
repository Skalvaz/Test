/**
 * Kapalı (katı) dönel gövdeler: disk, ara halka, gövde (casing), bant.
 *
 * LatheGeometry profil boyunca bütün normalleri ortalar; keskin köşeli bir
 * disk kesiti (jant, gövde, flanş) yuvarlak, "şişirilmiş" görünür. Burada
 * profil kenar kenar döndürülür ve komşu kenarlar arasındaki açı eşiği
 * aşarsa köşe bölünür (Blender'daki "auto smooth" gibi).
 *
 * Profiller [r, z] çiftleridir; kapalı profil katı bir hacim sınırlar ve
 * kesit görünümünde (stencil kapak) dolu görünür. Köşe yuvarlatma için
 * roundPoly kullanılır: dolgu (fillet) yarıçapları gerçek disklerdeki gibi
 * gerilme yığılmasını önleyen yumuşak geçişleri verir.
 *
 * Nitelikler:
 *   uv    u = θ / 2π (çevresel), v = profil yay uzunluğu oranı
 *         Anizotropik (fırçalanmış) malzemelerde teğet u yönündedir:
 *         torna izleri çevresel görünür.
 *   uv1   metre ölçekli: u = θ·r, v = yay uzunluğu (tarama dokuları)
 */

import * as THREE from 'three';

/**
 * Çokgen köşelerini yuvarlatır.
 * @param pts   [[r, z], …] (kapalı ise son nokta ilkini tekrar etmez)
 * @param rad   köşe yarıçapı: sayı ya da köşe başına dizi (0 = keskin)
 * @param segs  köşe başına ara nokta
 */
export function roundPoly(pts, rad, segs = 3, closed = true) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Array.isArray(rad) ? rad[i] ?? 0 : rad;
    if (r <= 0 || (!closed && (i === 0 || i === n - 1))) {
      out.push(pts[i]);
      continue;
    }
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const da = [a[0] - p[0], a[1] - p[1]];
    const db = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(...da);
    const lb = Math.hypot(...db);
    // kenarın yarısından fazlası tüketilmesin
    const k = Math.min(r, la * 0.45, lb * 0.45);
    const s = [p[0] + (da[0] / la) * k, p[1] + (da[1] / la) * k];
    const e = [p[0] + (db[0] / lb) * k, p[1] + (db[1] / lb) * k];
    // ikinci derece Bezier (köşe noktası kontrol noktası); küçük pahlar tek adım
    const sg = k < 0.0025 ? 1 : segs;
    for (let j = 0; j <= sg + 1; j++) {
      const t = j / (sg + 1);
      const u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]]);
    }
  }
  return out;
}

/**
 * Profili Z ekseni etrafında döndürür.
 * @param profile  [[r, z], …]
 * @param opts     segments, closed (katı), smooth (derece: bu açıdan küçük
 *                 kırılmalar yumuşak), phi0/phiLen (kısmi dönüş)
 */
export function revolve(profile, opts = {}) {
  const { segments = 128, closed = true, smooth = 32, phi0 = 0, phiLen = Math.PI * 2 } = opts;
  let pts = profile.map((p) => [Math.max(0, p[0]), p[1]]);
  // Kapalı profil: saat yönünün tersine (r yatay, z dikey) çevir; dış normal
  // kenar yönünün sağında kalır
  if (closed) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = pts[i];
      const [c, d] = pts[(i + 1) % pts.length];
      area += a * d - b * c;
    }
    if (area < 0) pts = pts.slice().reverse();
  }
  const n = pts.length;
  const edges = closed ? n : n - 1;
  // Kenar normalleri (r, z düzleminde): yön (dr, dz) → normal (dz, -dr)
  const en = [];
  const len = [];
  for (let i = 0; i < edges; i++) {
    const [r0, z0] = pts[i];
    const [r1, z1] = pts[(i + 1) % n];
    const l = Math.hypot(r1 - r0, z1 - z0) || 1e-9;
    en.push([(z1 - z0) / l, -(r1 - r0) / l]);
    len.push(l);
  }
  const cosLim = Math.cos(THREE.MathUtils.degToRad(smooth));
  const vNormal = (i, end) => {
    // kenar i'nin başı (end=0) ya da sonu (end=1) için normal
    const e = en[i];
    const j = end ? i + 1 : i - 1;
    if (!closed && (j < 0 || j >= edges)) return e;
    const o = en[(j + edges) % edges];
    if (e[0] * o[0] + e[1] * o[1] < cosLim) return e;
    const m = [e[0] + o[0], e[1] + o[1]];
    const l = Math.hypot(...m) || 1;
    return [m[0] / l, m[1] / l];
  };
  let total = 0;
  const s0 = [];
  for (let i = 0; i < edges; i++) {
    s0.push(total);
    total += len[i];
  }

  const P = [];
  const N = [];
  const UV = [];
  const UV1 = [];
  const I = [];
  const cols = segments + 1;
  for (let i = 0; i < edges; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const na = vNormal(i, 0);
    const nb = vNormal(i, 1);
    const base = P.length / 3;
    for (let j = 0; j <= segments; j++) {
      const th = phi0 + (j / segments) * phiLen;
      const s = Math.sin(th);
      const c = Math.cos(th);
      for (const [p, nn, sv] of [
        [a, na, s0[i]],
        [b, nb, s0[i] + len[i]],
      ]) {
        P.push(s * p[0], c * p[0], p[1]);
        N.push(s * nn[0], c * nn[0], nn[1]);
        UV.push(j / segments, sv / total);
        UV1.push((th - phi0) * p[0], sv);
      }
    }
    for (let j = 0; j < segments; j++) {
      const A0 = base + j * 2;
      const B0 = A0 + 1;
      const A1 = base + ((j + 1) % cols) * 2;
      const B1 = A1 + 1;
      I.push(A0, B0, A1, A1, B0, B1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(UV1, 2));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}

/** Birden çok geometriyi (aynı nitelik kümesi) tek geometride birleştirir. */
export function mergeGeos(geos) {
  const names = Object.keys(geos[0].attributes);
  const out = new THREE.BufferGeometry();
  let offset = 0;
  const idx = [];
  const data = Object.fromEntries(names.map((k) => [k, []]));
  for (const g of geos) {
    for (const k of names) for (const v of g.attributes[k].array) data[k].push(v);
    const gi = g.index ? g.index.array : [...Array(g.attributes.position.count).keys()];
    for (const v of gi) idx.push(v + offset);
    offset += g.attributes.position.count;
  }
  for (const k of names) out.setAttribute(k, new THREE.Float32BufferAttribute(data[k], geos[0].attributes[k].itemSize));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}
