/**
 * Kademe üreticisi (M2): eksenel kompresör ve türbin modülleri.
 *
 * Her modül, gerçek bir motor kesitinde görülen parçaları istasyon
 * tablosundan üretir:
 *
 *   rotor   kanat halkası (blades.js: profil + platform + kök + uç),
 *           disk (jant, gövde/web, göbek/bore; dolgu yarıçaplı kapalı
 *           profil), diskleri birleştiren ara kollar (spacer arm) ve
 *           üzerlerindeki labirent conta dişleri, ön/arka mil konileri
 *   stator  kanatçık halkası, iç bant + bal peteği conta yatağı (dişlerin
 *           sürtündüğü yüzey), değişken statorlarda (VSV) mil, kol ve
 *           birleştirme (unison) halkası
 *   gövde   kalınlıklı kapalı kabuk (casing): rotor uçları üzerinde
 *           aşınabilir (abradable) şeritler, flanşlar ve cıvata halkaları
 *
 * Bütün dönel gövdeler kapalı profillerdir: kesit görünümünde katı
 * görünürler (stencil kapak) ve kalınlıkları okunur.
 *
 * Dönüş yönü sözleşmesi: bütün miller +Z etrafında aynı yönde döner;
 * kompresör rotorları pozitif, statorları negatif metal açılı, türbin
 * rotorları tersi. Böylece kesitte klasik "balıksırtı" deseni oluşur.
 */

import * as THREE from 'three';
import { createBlade, bladeQuality } from './blades.js';
import { bladeRow, tagPart } from './geom.js';
import { revolve, roundPoly } from './revolve.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lerp = (a, b, t) => a + (b - a) * t;
const deg = THREE.MathUtils.degToRad;
const pick = (m, ...names) => {
  for (const n of names) if (m[n]) return m[n];
  return null;
};

/** Dönel gövde çözünürlüğü (kaliteye göre) */
function segs(r) {
  const q = bladeQuality();
  const base = q === 'low' ? 56 : q === 'medium' ? 88 : 120;
  return Math.max(48, Math.round(base * Math.min(1.4, Math.max(0.6, r / 0.4))));
}

function solid(profile, mat, part, opts = {}) {
  const mesh = new THREE.Mesh(revolve(profile, { segments: segs(opts.r ?? 0.4), ...opts }), mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return tagPart(mesh, part);
}

/** Parçalı doğrusal f(z) (uçlarda sabit) */
function piecewise(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0]);
  return (z) => {
    if (z <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (z <= p[i][0]) return lerp(p[i - 1][1], p[i][1], (z - p[i - 1][0]) / (p[i][0] - p[i - 1][0]));
    }
    return p[p.length - 1][1];
  };
}

/**
 * Örnek rengi veri taşıyıcı (bladeShading.ts): r = kademe ısısı,
 * g = kanat başına rastgele, b = kademe konumu
 */
function bladeData(row, heat, t) {
  const c = new THREE.Color();
  let seed = Math.floor(heat * 977 + t * 131) + 1;
  for (let i = 0; i < row.count; i++) {
    seed = (seed * 16807) % 2147483647;
    c.setRGB(heat, (seed % 1000) / 1000, t);
    row.setColorAt(i, c);
  }
  row.instanceColor.needsUpdate = true;
  return row;
}

/* ------------------------------------------------------------------ */
/* Disk, kol, bant profilleri                                          */
/* ------------------------------------------------------------------ */

/**
 * Disk kesiti: jant (rimTop..rimBot, rimZ), gövde (web), göbek (bore).
 * Gövde jantta ince, göbeğe doğru kalınlaşır (gerilme dağılımı).
 */
const lowQ = () => bladeQuality() === 'low';

function diskProfile(d) {
  const { rimTop, rimBot, z0, z1, boreIn, boreOut, boreW, webRim, webBore, zc = (z0 + z1) / 2, fillet } = d;
  const pts = [
    [rimTop, z0],
    [rimTop, z1],
    [rimBot, z1],
    [rimBot, zc + webRim / 2],
    [boreOut, zc + webBore / 2],
    [boreOut, zc + boreW / 2],
    [boreIn, zc + boreW / 2],
    [boreIn, zc - boreW / 2],
    [boreOut, zc - boreW / 2],
    [boreOut, zc - webBore / 2],
    [rimBot, zc - webRim / 2],
    [rimBot, z0],
  ];
  const f = fillet ?? Math.min(z1 - z0, rimTop - rimBot) * 0.35;
  const b = f * 0.18; // dış köşelerde küçük pah
  if (lowQ()) return roundPoly(pts, [0, 0, 0, f, f, 0, 0, 0, 0, f, f, 0], 1);
  return roundPoly(pts, [0, 0, b, f, f, b, 0, 0, b, f, f, b], 2);
}

/**
 * Konik ara kol: (r0, z0) → (r1, z1), kalınlık t; üst yüzde labirent conta
 * dişleri (teeth: z listesi, h yükseklik).
 */
function armProfile(r0, z0, r1, z1, t, teeth = [], h = 0.004) {
  const top = (z) => lerp(r0, r1, (z - z0) / (z1 - z0));
  const pts = [
    [r0 - t, z0],
    [r1 - t, z1],
    [r1, z1],
  ];
  const w = h * 0.9;
  if (lowQ()) teeth = [];
  for (const zt of teeth.slice().sort((a, b) => b - a)) {
    const r = top(zt);
    pts.push([top(zt + w), zt + w], [r + h, zt + w * 0.18], [r + h, zt - w * 0.18], [top(zt - w), zt - w]);
  }
  pts.push([r0, z0]);
  return pts;
}

/**
 * Stator iç bandı: kanatçıkların oturduğu halka (hub), aşağı inen ayak ve
 * dişlerin sürtündüğü bal peteği yatağı (land).
 */
function innerBandProfile(hub, zb0, zb1, bt, landO, landI, zl0, zl1, legW) {
  const zm = (zb0 + zb1) / 2;
  const pts = [
    [hub, zb0],
    [hub, zb1],
    [hub - bt, zb1],
    [hub - bt, zm + legW / 2],
    [landO, zm + legW / 2],
    [landO, zl1],
    [landI, zl1],
    [landI, zl0],
    [landO, zl0],
    [landO, zm - legW / 2],
    [hub - bt, zm - legW / 2],
    [hub - bt, zb0],
  ];
  const f = Math.min(legW * 0.4, 0.004);
  if (lowQ()) return pts;
  return roundPoly(pts, [0.0006, 0.0006, 0.0006, f, f, 0.0005, 0.0003, 0.0003, 0.0005, f, f, 0.0006], 2);
}

/* ------------------------------------------------------------------ */
/* Küçük donanım: cıvata halkası                                       */
/* ------------------------------------------------------------------ */

const boltCache = new Map();
function boltGeo(size) {
  const key = size.toFixed(4);
  if (!boltCache.has(key)) {
    // altıgen baş + kısa gövde, +Z yönünde
    const head = new THREE.CylinderGeometry(size, size, size * 0.7, 6);
    head.rotateX(Math.PI / 2);
    head.translate(0, 0, size * 0.35);
    head.userData.shared = true;
    boltCache.set(key, head);
  }
  return boltCache.get(key);
}

/** z düzleminde r yarıçaplı cıvata halkası; face: +1 arkaya, −1 öne bakan baş */
export function boltRing(mat, r, z, count, size, face = 1, part = 'casing') {
  const geo = boltGeo(size);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, face);
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI * 2;
    p.set(Math.sin(a) * r, Math.cos(a) * r, z);
    e.set(0, 0, -a);
    q.setFromEuler(e);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return tagPart(mesh, part);
}

/* ------------------------------------------------------------------ */
/* Gövde (casing)                                                      */
/* ------------------------------------------------------------------ */

/**
 * İç yarıçap fonksiyonundan kalınlıklı gövde kabuğu. Flanşlar dışa taşan
 * halkalar; her flanşa iki yüzlü cıvata halkası eklenir.
 */
export function casingShell(mats, { inner, z0, z1, t = 0.008, flanges = [], part = 'casing', steps = 12, breaks = [], boltSize = 0.0045 }) {
  const group = new THREE.Group();
  const fh = t * 2.4; // flanş yüksekliği
  const fw = t * 0.9; // flanş yarı genişliği
  const zs = new Set();
  for (let i = 0; i <= steps; i++) zs.add(lerp(z0, z1, i / steps));
  for (const b of breaks) if (b > z0 && b < z1) zs.add(b);
  for (const f of flanges) for (const d of [-fw * 1.6, -fw, fw, fw * 1.6]) if (f + d > z0 && f + d < z1) zs.add(f + d);
  const zl = [...zs].sort((a, b) => a - b);
  const outer = (z) => {
    let r = inner(z) + t;
    for (const f of flanges) if (Math.abs(z - f) <= fw + 1e-6) r = Math.max(r, inner(f) + t + fh);
    return r;
  };
  const pts = [];
  for (const z of zl) pts.push([inner(z), z]);
  for (let i = zl.length - 1; i >= 0; i--) pts.push([outer(zl[i]), zl[i]]);
  group.add(solid(pts, mats.casing, part, { r: inner((z0 + z1) / 2), smooth: 25 }));
  for (const f of flanges) {
    if (f <= z0 || f >= z1) continue;
    const r = inner(f) + t + fh * 0.55;
    const n = Math.round((Math.PI * 2 * r) / 0.045);
    group.add(boltRing(mats.bolt, r, f - fw, n, boltSize, -1, part), boltRing(mats.bolt, r, f + fw, n, boltSize, 1, part));
  }
  return group;
}

/**
 * Gruptaki (iç içe dahil) örneksiz, statik ağları malzeme başına tek ağda
 * birleştirir: bir modül onlarca disk/kol/bant yerine birkaç çizim çağrısı.
 */
export function mergeStatic(group) {
  const byMat = new Map();
  const drop = [];
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const g = o.geometry;
    if (!g.index || !g.attributes.uv1 || g.userData.shared) return;
    const key = o.material.uuid;
    if (!byMat.has(key)) byMat.set(key, { mat: o.material, part: o.userData.part, geos: [] });
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    byMat.get(key).geos.push(m.equals(new THREE.Matrix4()) ? g : g.clone().applyMatrix4(m));
    drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  for (const { mat, part, geos } of byMat.values()) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(tagPart(mesh, part));
  }
}

/* ------------------------------------------------------------------ */
/* Kompresör                                                           */
/* ------------------------------------------------------------------ */

/**
 * @param materials  malzeme kütüphanesi
 * @param c {
 *   part, stages, z0, z1 (ilk/son rotor ekseni),
 *   hub:[a,b], tip:[a,b], blades:[a,b], vanes?:[a,b], chord?:[a,b]
 *   bore:[rIç, yükseklik]   disk göbeği
 *   blisk?                  kanat + disk tek parça (askeri fan/kompresör)
 *   igv?                    ilk rotordan önce giriş yönlendirici kanatları
 *   vsv?                    değişken stator sırası sayısı (IGV dahil)
 *   exitVanes?              son rotordan sonra çıkış kanatları (varsayılan var)
 *   firstMaterial?, bladeMat?, heat?:[a,b]
 *   casing?: { t, flanges:[z], clearance } | false
 *   cones?: { front:[r,z], aft:[r,z] }  mil konileri
 * }
 * @returns {{ rotor: Group, stator: Group, tipAt(z), hubAt(z), casingAt(z) }}
 */
export function compressorModule(materials, c) {
  const part = c.part ?? 'hpc';
  const rotor = new THREE.Group();
  rotor.name = `${part}-rotor`;
  const stator = new THREE.Group();
  stator.name = `${part}-stator`;
  const n = c.stages;
  const pitch = n > 1 ? (c.z1 - c.z0) / (n - 1) : c.pitch ?? 0.1;
  const clr = c.clearance ?? 0.0015;
  const heat = c.heat ?? (part === 'hpc' ? [0.08, 0.42] : [0, 0.05]);
  const mats = {
    blade: pick(materials, c.bladeMat, 'compBlade', 'hubMetal'),
    vane: pick(materials, 'compVane', 'superalloy'),
    disk: pick(materials, 'diskMetal', 'hubMetal'),
    casing: pick(materials, 'caseInner', 'superalloy'),
    seal: pick(materials, 'sealLand', 'superalloy'),
    bolt: pick(materials, 'boltSteel', 'machinery'),
    lever: pick(materials, 'machinery'),
  };

  // --- istasyonlar ---
  const S = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const hub = lerp(c.hub[0], c.hub[1], t);
    const tip = lerp(c.tip[0], c.tip[1], t);
    S.push({ i, t, z: c.z0 + pitch * i, hub, tip, span: tip - hub, count: Math.round(lerp(c.blades[0], c.blades[1], t)) });
  }
  const hubAt = piecewise(S.map((s) => [s.z, s.hub]));
  const tipAt = piecewise(S.map((s) => [s.z, s.tip]));
  // Aşınabilir şerit (0.0025) + boşluk: gövde iç yüzeyi
  const seal = 0.0025;
  const casingAt = (z) => tipAt(z) + clr + seal;

  // --- rotor kanatları ---
  for (const s of S) {
    const { t, hub, tip, span, count } = s;
    // Metal açıları: rotor ucu daha eğik, geri kademeler daha az dönüşlü
    const b1 = [deg(36 + 6 * t), deg(56 + 4 * t)];
    const b2 = [deg(12 + 8 * t), deg(36 + 8 * t)];
    const stagger = (b1[0] + b1[1] + b2[0] + b2[1]) / 4;
    // Eksenel yer: rotor aralığın ~%44'ü
    const axial = pitch * 0.44;
    const chordMax = axial / Math.cos(stagger);
    const ch = c.chord ? Math.min(lerp(c.chord[0], c.chord[1], t), chordMax) : chordMax;
    const first = i0(s) && c.firstChord ? c.firstChord : 1;
    const blisk = !!c.blisk;
    const opts = {
      hub,
      tip,
      count,
      chord: [ch * first, ch * first * 0.92],
      beta1: b1,
      beta2: b2,
      tmax: [0.085, 0.045],
      te: 0.012,
      xt: 0.42,
      sections: first > 1 ? 12 : 6,
      samples: first > 1 ? 24 : 13,
      fillet: blisk ? 0.07 : 0.05,
      root: blisk ? null : 'dovetail',
      platform: blisk ? null : { depth: Math.max(0.003, span * 0.03) / span, over: 0.12 },
      rootDepth: Math.max(0.012, span * 0.28),
      tipType: 'plain',
    };
    const geo = createBlade(opts);
    s.info = geo.userData.bladeInfo;
    s.axial = s.info.zMax - s.info.zMin;
    const mat = i0(s) && c.firstMaterial ? materials[c.firstMaterial] : mats.blade;
    const row = bladeRow(geo, mat, count, { z: s.z, phase: s.i * 0.07 });
    bladeData(row, lerp(heat[0], heat[1], t), t);
    row.name = `${part}-r${s.i + 1}`;
    rotor.add(tagPart(row, part));
  }
  function i0(s) {
    return s.i === 0;
  }

  // --- statorlar ---
  const vaneAt = [];
  if (c.igv) vaneAt.push({ z: S[0].z - pitch * 0.5, igv: true, k: 0 });
  for (let i = 0; i < n; i++) {
    if (i === n - 1 && c.exitVanes === false) break;
    vaneAt.push({ z: S[i].z + pitch * 0.5, k: vaneAt.length });
  }
  const vsv = c.vsv ?? 0;
  for (const v of vaneAt) {
    const t = n > 1 ? THREE.MathUtils.clamp((v.z - c.z0) / (c.z1 - c.z0), 0, 1) : 0;
    const hub = hubAt(v.z);
    const tip = casingAt(v.z);
    const span = tip - hub;
    const count = Math.round(lerp(...(c.vanes ?? [c.blades[0] * 1.15 + 4, c.blades[1] * 1.15 + 4]), t));
    const axial = pitch * 0.36;
    const b1 = v.igv ? [deg(0), deg(0)] : [deg(-44 + 4 * t), deg(-40 + 4 * t)];
    const b2 = v.igv ? [deg(-24), deg(-14)] : [deg(-6), deg(-2)];
    const stagger = Math.abs(b1[0] + b2[0]) / 2;
    const ch = axial / Math.cos(stagger);
    const geo = createBlade({
      hub: hub - 0.0015,
      tip: tip + 0.004,
      count,
      chord: [ch, ch * 0.95],
      beta1: b1,
      beta2: b2,
      tmax: v.igv ? [0.1, 0.08] : [0.075, 0.05],
      te: 0.012,
      xt: 0.4,
      sections: 5,
      samples: 11,
      fillet: 0.03,
      platform: null,
      root: null,
      tipType: 'plain',
    });
    const row = bladeRow(geo, mats.vane, count, { z: v.z, phase: 0.03 * v.k });
    bladeData(row, lerp(heat[0], heat[1], t), t);
    row.name = `${part}-s${v.k}`;
    stator.add(tagPart(row, part));
    v.hub = hub;
    v.tip = tip;
    v.axial = axial;
    v.count = count;
    v.span = span;
  }

  // --- diskler ---
  const [boreIn, boreH] = c.bore ?? [Math.max(0.05, c.hub[0] * 0.55), 0.03];
  const disks = [];
  for (const s of S) {
    const inf = s.info;
    const blisk = !!c.blisk;
    const rimTop = blisk ? s.hub : inf.platR;
    const rimBot = blisk ? s.hub - Math.max(0.014, s.span * 0.12) : inf.rootBottom - 0.005;
    const rz = blisk ? [inf.zMin - s.axial * 0.08, inf.zMax + s.axial * 0.08] : [inf.rootZ[0] + 0.0012, inf.rootZ[1] - 0.0012];
    const z0 = s.z + rz[0];
    const z1 = s.z + rz[1];
    const w = z1 - z0;
    const d = {
      rimTop,
      rimBot,
      z0,
      z1,
      boreIn,
      boreOut: boreIn + boreH,
      boreW: Math.max(w * 0.62, 0.02),
      webRim: Math.max(0.005, w * 0.16),
      webBore: Math.max(0.008, w * 0.3),
    };
    disks.push(d);
    const mesh = solid(diskProfile(d), mats.disk, part, { r: rimTop });
    mesh.name = `${part}-disk${s.i + 1}`;
    rotor.add(mesh);
  }

  // --- ara kollar + labirent dişleri, stator iç bantları ---
  const armR = (d, s) => Math.min(lerp(d.rimBot, d.rimTop, 0.35), s.hub - 0.016);
  for (let i = 0; i < n; i++) {
    const d0 = disks[i];
    const s0 = S[i];
    const v = vaneAt.find((vv) => !vv.igv && vv.z > s0.z && vv.z < s0.z + pitch);
    const next = i < n - 1 ? disks[i + 1] : null;
    const ra0 = armR(d0, s0);
    if (next) {
      const ra1 = armR(next, S[i + 1]);
      const teeth = v ? [v.z - v.axial * 0.28, v.z, v.z + v.axial * 0.28] : [];
      const arm = solid(armProfile(ra0, d0.z1 - 0.002, ra1, next.z0 + 0.002, 0.005, teeth), mats.disk, part, { r: ra0, smooth: 30 });
      arm.name = `${part}-spacer${i + 1}`;
      rotor.add(arm);
    }
    if (v) {
      const top = next ? lerp(ra0, armR(next, S[i + 1]), 0.5) : ra0;
      const landI = top + 0.004 + 0.0012;
      const landO = landI + 0.0045;
      const bt = Math.max(0.003, v.span * 0.02);
      const zb = v.axial * 0.62;
      if (v.hub - bt - landO > 0.001) {
        const band = solid(
          innerBandProfile(v.hub, v.z - zb, v.z + zb, bt, landO, landI, v.z - v.axial * 0.45, v.z + v.axial * 0.45, Math.max(0.004, v.axial * 0.14)),
          mats.seal,
          part,
          { r: v.hub },
        );
        band.name = `${part}-shroud${v.k}`;
        stator.add(band);
      }
    }
  }
  // IGV iç bandı: basit halka
  for (const v of vaneAt.filter((vv) => vv.igv)) {
    const bt = Math.max(0.004, v.span * 0.03);
    stator.add(
      solid(
        roundPoly([[v.hub, v.z - v.axial * 0.6], [v.hub, v.z + v.axial * 0.6], [v.hub - bt, v.z + v.axial * 0.6], [v.hub - bt, v.z - v.axial * 0.6]], 0.0008, 2),
        mats.seal,
        part,
        { r: v.hub },
      ),
    );
  }

  // --- mil konileri ---
  if (c.cones?.front) {
    const [r, z] = c.cones.front;
    const d = disks[0];
    const r0 = lerp(d.boreOut, d.rimBot, 0.55);
    rotor.add(solid(armProfile(r, z, r0, (d.z0 + d.z1) / 2, 0.006), mats.disk, part, { r: r0 }));
    rotor.add(solid(roundPoly([[r + 0.012, z - 0.012], [r + 0.012, z + 0.012], [r - 0.006, z + 0.012], [r - 0.006, z - 0.012]], 0.002, 2), mats.disk, part, { r }));
  }
  if (c.cones?.aft) {
    const [r, z] = c.cones.aft;
    const d = disks[n - 1];
    const r0 = lerp(d.boreOut, d.rimBot, 0.55);
    rotor.add(solid(armProfile(r0, (d.z0 + d.z1) / 2, r, z, 0.006), mats.disk, part, { r: r0 }));
  }

  // --- gövde ---
  const zFront = (vaneAt[0]?.z ?? S[0].z) - pitch * 0.45;
  const zBack = Math.max(S[n - 1].z, vaneAt[vaneAt.length - 1]?.z ?? 0) + pitch * 0.4;
  const extend = (z) => casingAt(THREE.MathUtils.clamp(z, S[0].z, S[n - 1].z));
  if (c.casing !== false) {
    const cs = c.casing ?? {};
    const shell = casingShell(mats, {
      inner: extend,
      z0: zFront,
      z1: zBack,
      steps: 4,
      breaks: S.map((s) => s.z),
      t: cs.t ?? 0.008,
      flanges: cs.flanges ?? [],
      part,
    });
    stator.add(shell);
    // Rotor uçlarının üzerindeki aşınabilir şeritler (gövdeye gömülü)
    for (const s of lowQ() ? [] : S) {
      const z0 = s.z + s.info.zMin - s.axial * 0.08;
      const z1 = s.z + s.info.zMax + s.axial * 0.08;
      const r0 = s.tip + clr;
      stator.add(solid([[r0, z0], [r0, z1], [r0 + seal + 0.001, z1], [r0 + seal + 0.001, z0]], mats.seal, part, { r: r0 }));
    }
    // --- değişken statorlar: mil, kol, birleştirme halkası ---
    const t = cs.t ?? 0.008;
    let k = 0;
    for (const v of vaneAt) {
      if (k++ >= vsv) break;
      const rOut = extend(v.z) + t;
      stator.add(vsvHardware(mats, v.z, rOut, v.count, part));
    }
  }

  mergeStatic(rotor);
  mergeStatic(stator);
  return { rotor, stator, tipAt, hubAt, casingAt: extend, zFront, zBack, stations: S, vanes: vaneAt };
}

/** VSV donanımı: her kanatçık mili için yuva + kol, kolları taşıyan halka */
function vsvHardware(mats, z, r, count, part) {
  const g = new THREE.Group();
  const boss = new THREE.CylinderGeometry(0.0045, 0.0055, 0.012, 8);
  boss.translate(0, r + 0.006, 0);
  const lever = new THREE.BoxGeometry(0.004, 0.0025, 0.03);
  lever.translate(0, r + 0.0135, 0.013);
  // Kol hafifçe açılı: kanat çevrildiğinde halka eksenel kayar
  lever.rotateY(0);
  const inst = (geo, mat) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    const M = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      M.makeRotationZ(-a).setPosition(0, 0, z);
      m.setMatrixAt(i, M);
    }
    m.instanceMatrix.needsUpdate = true;
    return tagPart(m, part);
  };
  g.add(inst(boss, mats.casing), inst(lever, mats.lever));
  const ring = solid(roundPoly([[r + 0.011, z + 0.024], [r + 0.011, z + 0.034], [r + 0.019, z + 0.034], [r + 0.019, z + 0.024]], 0.0015, 2), mats.lever, part, { r });
  g.add(ring);
  return g;
}

/* ------------------------------------------------------------------ */
/* Türbin                                                              */
/* ------------------------------------------------------------------ */

/**
 * @param c {
 *   part:'hpt'|'lpt', stages, z0, z1 (rotor eksenleri), pitch?,
 *   hub:[a,b], tip:[a,b], blades:[a,b], vanes?:[a,b],
 *   bore:[rIç, yükseklik], cooled?, shroud?, heat?:[a,b]
 *   casing?: { t, flanges }, cones?: { front:[r,z], aft:[r,z] }
 * }
 */
export function turbineModule(materials, c) {
  const part = c.part ?? 'hpt';
  const hp = part === 'hpt';
  const rotor = new THREE.Group();
  rotor.name = `${part}-rotor`;
  const stator = new THREE.Group();
  stator.name = `${part}-stator`;
  const n = c.stages;
  const pitch = n > 1 ? (c.z1 - c.z0) / (n - 1) : c.pitch ?? 0.16;
  const clr = c.clearance ?? 0.0015;
  const mats = {
    blade: pick(materials, hp ? 'hptBlade' : 'lptBlade', 'superalloy'),
    vane: pick(materials, hp ? 'hptVane' : 'lptVane', 'superalloy'),
    disk: pick(materials, 'turbineDisk', 'diskMetal', 'hubMetal'),
    casing: pick(materials, 'turbineCase', 'caseInner', 'superalloy'),
    seal: pick(materials, hp ? 'shroudCeramic' : 'sealLand', 'superalloy'),
    bolt: pick(materials, 'boltSteel', 'machinery'),
  };
  const shroud = c.shroud ?? !hp;
  const heat = c.heat ?? (hp ? [0.9, 0.8] : [0.62, 0.22]);

  const S = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const hub = lerp(c.hub[0], c.hub[1], t);
    const tip = lerp(c.tip[0], c.tip[1], t);
    S.push({ i, t, z: c.z0 + pitch * i, hub, tip, span: tip - hub, count: Math.round(lerp(c.blades[0], c.blades[1], t)) });
  }
  const hubAt = piecewise(S.map((s) => [s.z, s.hub]));
  const tipAt = piecewise(S.map((s) => [s.z, s.tip]));

  // --- rotor kanatları ---
  for (const s of S) {
    const { t, hub, tip, span, count } = s;
    const b1 = hp ? [deg(-44), deg(-32)] : [deg(-34 + 6 * t), deg(-22 + 6 * t)];
    const b2 = hp ? [deg(66), deg(62)] : [deg(60), deg(58)];
    const axial = pitch * (hp ? 0.4 : 0.38);
    // Yüksek dönüşlü türbin profilinde eksenel kord ≈ kord · cos(orta açı)
    const ch = axial / Math.cos((b1[0] + b2[0]) / 2) / 1.05;
    const geo = createBlade({
      hub,
      tip,
      count,
      chord: [ch, ch * 0.94],
      beta1: b1,
      beta2: b2,
      tmax: hp ? [0.3, 0.24] : [0.2, 0.13],
      te: hp ? 0.035 : 0.02,
      xt: hp ? 0.3 : 0.32,
      sections: hp ? 9 : 7,
      samples: hp ? 20 : 14,
      fillet: 0.05,
      root: 'firtree',
      tipType: shroud ? 'shroud' : 'squealer',
      platform: { depth: Math.max(0.004, span * (hp ? 0.04 : 0.03)) / span, over: 0.14 },
      rootDepth: Math.max(0.03, span * (hp ? 0.55 : 0.3)),
    });
    s.info = geo.userData.bladeInfo;
    s.axial = s.info.zMax - s.info.zMin;
    const row = bladeRow(geo, mats.blade, count, { z: s.z, phase: s.i * 0.05 });
    bladeData(row, lerp(heat[0], heat[1], t), t);
    row.name = `${part}-r${s.i + 1}`;
    rotor.add(tagPart(row, part));
  }

  // Gövde iç yüzeyi: rotor üstünde uç + boşluk + örtü/conta segmenti
  const shroudH = (s) => (shroud ? s.span * (0.028 + 0.07) + 0.002 : 0);
  const casingAt = piecewise(
    S.flatMap((s) => [
      [s.z - pitch * 0.5, s.tip + clr + shroudH(s) + 0.006],
      [s.z + pitch * 0.25, s.tip + clr + shroudH(s) + 0.006],
    ]),
  );

  // --- NGV (stator) sıraları: her rotorun önünde ---
  const vaneAt = S.map((s) => ({ z: s.z - pitch * 0.5, k: s.i, s }));
  for (const v of vaneAt) {
    const t = v.s.t;
    const hub = hubAt(v.z) - (v.k === 0 ? 0 : 0);
    const tip = casingAt(v.z);
    const span = tip - hub;
    const count = Math.round(lerp(...(c.vanes ?? [c.blades[0] * (hp ? 0.62 : 0.8), c.blades[1] * (hp ? 0.62 : 0.8)]), t));
    const axial = pitch * (hp ? 0.4 : 0.36);
    const b1 = hp ? [deg(4), deg(4)] : [deg(18), deg(14)];
    const b2 = hp ? [deg(-70), deg(-67)] : [deg(-60), deg(-56)];
    const ch = axial / Math.cos((b1[0] + b2[0]) / 2) / 1.05;
    const geo = createBlade({
      hub: hub - 0.002,
      tip: tip + 0.004,
      count,
      chord: [ch, ch],
      beta1: b1,
      beta2: b2,
      tmax: hp ? [0.34, 0.3] : [0.2, 0.16],
      te: hp ? 0.04 : 0.022,
      xt: 0.32,
      sections: hp ? 6 : 5,
      samples: hp ? 18 : 13,
      fillet: 0.03,
      platform: null,
      root: null,
      tipType: 'plain',
    });
    const row = bladeRow(geo, mats.vane, count, { z: v.z, phase: 0.02 * v.k });
    bladeData(row, Math.min(1, lerp(heat[0], heat[1], t) + 0.08), t);
    row.name = `${part}-n${v.k + 1}`;
    stator.add(tagPart(row, part));
    Object.assign(v, { hub, tip, span, axial, count });
  }

  // --- diskler ---
  const [boreIn, boreH] = c.bore ?? [Math.max(0.06, c.hub[0] * 0.5), hp ? 0.06 : 0.03];
  const disks = [];
  for (const s of S) {
    const inf = s.info;
    const z0 = s.z + inf.rootZ[0] + 0.001;
    const z1 = s.z + inf.rootZ[1] - 0.001;
    const w = z1 - z0;
    const d = {
      rimTop: inf.rootTop,
      rimBot: inf.rootBottom - Math.max(0.008, s.span * 0.05),
      z0,
      z1,
      boreIn,
      boreOut: boreIn + boreH,
      boreW: hp ? Math.max(w * 1.25, 0.05) : Math.max(w * 0.7, 0.025),
      webRim: Math.max(0.008, w * (hp ? 0.3 : 0.18)),
      webBore: Math.max(0.012, w * (hp ? 0.55 : 0.3)),
    };
    disks.push(d);
    const mesh = solid(diskProfile(d), mats.disk, part, { r: d.rimTop });
    mesh.name = `${part}-disk${s.i + 1}`;
    rotor.add(mesh);
    // Kök üstündeki bölmede (shank) ön/arka kapak plakaları (retainer)
    const pr = inf.platR;
    const plateTop = lerp(inf.rootTop, pr, 0.55);
    for (const [za, zb] of [
      [z0 - 0.004, z0 - 0.0012],
      [z1 + 0.0012, z1 + 0.004],
    ]) {
      rotor.add(solid(roundPoly([[plateTop, za], [plateTop, zb], [d.rimBot + 0.004, zb], [d.rimBot + 0.004, za]], 0.0008, 2), mats.disk, part, { r: plateTop }));
    }
  }

  // --- kollar + dişler + NGV iç bantları ---
  for (let i = 0; i < n; i++) {
    const d = disks[i];
    const armRad = lerp(d.rimBot, d.rimTop, 0.25);
    if (i < n - 1) {
      const dn = disks[i + 1];
      const v = vaneAt[i + 1];
      const ra1 = lerp(dn.rimBot, dn.rimTop, 0.25);
      const teeth = [v.z - v.axial * 0.3, v.z, v.z + v.axial * 0.3];
      rotor.add(solid(armProfile(armRad, d.z1 + 0.003, ra1, dn.z0 - 0.003, 0.007, teeth, 0.005), mats.disk, part, { r: armRad }));
      // cıvatalı flanş (LPT kolları ortada birleşir)
      if (!hp) {
        const zf = (d.z1 + dn.z0) / 2;
        const rf = lerp(armRad, ra1, 0.5);
        rotor.add(solid(roundPoly([[rf - 0.003, zf - 0.005], [rf - 0.003, zf + 0.005], [rf - 0.02, zf + 0.005], [rf - 0.02, zf - 0.005]], 0.001, 2), mats.disk, part, { r: rf }));
        rotor.add(boltRing(mats.bolt, rf - 0.012, zf + 0.005, Math.round((Math.PI * 2 * rf) / 0.03), 0.0035, 1, part));
      }
      const top = lerp(armRad, ra1, 0.5) + 0.005;
      const landI = top + 0.0015;
      const landO = landI + 0.006;
      const bt = Math.max(0.005, v.span * 0.035);
      if (v.hub - bt - landO > 0.002) {
        stator.add(
          solid(innerBandProfile(v.hub, v.z - v.axial * 0.62, v.z + v.axial * 0.62, bt, landO, landI, v.z - v.axial * 0.45, v.z + v.axial * 0.45, Math.max(0.006, v.axial * 0.16)), mats.seal, part, {
            r: v.hub,
          }),
        );
      }
    }
  }
  // İlk NGV iç bandı (yanma odası iç gömleğine bağlanan halka)
  {
    const v = vaneAt[0];
    const bt = Math.max(0.008, v.span * 0.06);
    stator.add(
      solid(
        roundPoly([[v.hub, v.z - v.axial * 0.62], [v.hub, v.z + v.axial * 0.62], [v.hub - bt, v.z + v.axial * 0.5], [v.hub - bt * 2.2, v.z - v.axial * 0.1], [v.hub - bt * 2.2, v.z - v.axial * 0.62]], 0.0015, 2),
        mats.seal,
        part,
        { r: v.hub },
      ),
    );
  }

  // --- mil konileri ---
  for (const [key, idx] of [
    ['front', 0],
    ['aft', n - 1],
  ]) {
    if (!c.cones?.[key]) continue;
    const [r, z] = c.cones[key];
    const d = disks[idx];
    const r0 = lerp(d.boreOut, d.rimBot, 0.5);
    const zc = (d.z0 + d.z1) / 2;
    const prof = key === 'front' ? armProfile(r, z, r0, zc, 0.007) : armProfile(r0, zc, r, z, 0.007);
    rotor.add(solid(prof, mats.disk, part, { r: r0 }));
    rotor.add(solid(roundPoly([[r + 0.014, z - 0.014], [r + 0.014, z + 0.014], [r - 0.004, z + 0.014], [r - 0.004, z - 0.014]], 0.002, 2), mats.disk, part, { r }));
  }

  // --- gövde + örtü segmentleri ---
  const zFront = c.casingFrom ?? vaneAt[0].z - vaneAt[0].axial * 0.75;
  const zBack = S[n - 1].z + pitch * 0.3;
  if (c.casing !== false) {
    const cs = c.casing ?? {};
    stator.add(casingShell(mats, { inner: casingAt, z0: zFront, z1: zBack, t: cs.t ?? 0.01, flanges: cs.flanges ?? [], part, steps: 4, breaks: S.flatMap((s) => [s.z - pitch * 0.5, s.z + pitch * 0.25]) }));
    for (const s of S) {
      const z0 = s.z + s.info.zMin - s.axial * 0.12;
      const z1 = s.z + s.info.zMax + s.axial * 0.12;
      const r0 = s.tip + clr + shroudH(s);
      const r1 = casingAt(s.z) + 0.001;
      stator.add(solid(roundPoly([[r0, z0], [r0, z1], [r1, z1], [r1, z0]], 0.0006, 1), mats.seal, part, { r: r0 }));
    }
  }

  mergeStatic(rotor);
  mergeStatic(stator);
  return { rotor, stator, tipAt, hubAt, casingAt, zFront, zBack, stations: S, vanes: vaneAt };
}
