/**
 * Değişken kesitli askeri lüle (M2).
 *
 * Her sektörde (n yaprak):
 *   yakınsak yaprak   menteşeli, kavisli plaka; dışta iki boyuna takviye
 *                     kaburgası, içte seramik kaplama
 *   yakınsak conta    iki yaprak arasındaki boşluğu içeriden kapatan dar
 *                     plaka (yaprakların altında, bindirmeli)
 *   ıraksak yaprak    boğazdaki menteşeden çıkışa (varsa), contasıyla
 *   dış yaprak        gövdeden çıkışa uzanan, pul gibi üst üste binen
 *                     dış kaplama yaprakları ("hindi tüyü")
 *   bağlantı kolu     senkron halkadan yakınsak yaprağın kam noktasına
 * ve gövdeye bağlı hidrolik aktüatörler: gövde (silindir) sabit, rod
 * senkron halkayı eksenel iter. Halka konumu, kol boyu sabit kalacak
 * şekilde yaprak açısından çözülür; bu yüzden lüle kapanırken halka
 * geriye kayar, rodlar uzar (gerçek mekanizma gibi).
 *
 * Bütün parçalar InstancedMesh; set() her karede örnek matrislerini
 * günceller (≈10 çizim çağrısı).
 */

import * as THREE from 'three';
import { smoothProfile, tagPart, thickLathe } from './geom.js';
import { revolve, roundPoly } from './revolve.js';

/**
 * Art yakıcısız motorun sabit yakınsak lülesi (M5a P5): jet borusu
 * flanşından lüle ağzına daralan tavlanmış inconel koni. Hareketli parça
 * yok (`set` yok): lüle alanı sabittir, motor tasarım noktasında boğulur.
 *
 *   gövde        kalınlıklı koni (kesitte et kalınlığı görünür); ağza
 *                yakın kısımda düzleşen profil (akış ağızda eksenel çıkar)
 *   iç kaplama   kurum tutmuş iç yüzey (sıcak gaz tarafı)
 *   ağız halkası ağzı rijitleştiren dolu kenar (bead)
 *   takviye      konik gövde üzerinde iki çevresel kaburga
 *
 * @param n { z0, z1, r0, rExit } (design/layouts/bare.ts FixedNozzleGeometry)
 * @returns {{ group, exitZ, exitR }}
 */
export function buildFixedNozzle(materials, n) {
  const group = new THREE.Group();
  group.name = 'fixed-nozzle';
  const { z0, z1, r0, rExit } = n;
  const L = z1 - z0;
  const t = Math.max(0.004, r0 * 0.012);
  const seg = Math.round(THREE.MathUtils.clamp(r0 * 320, 64, 160));
  // Profil: flanştan kısa silindir, sonra koni; son %15'te eksene paralel
  const at = (u) => {
    const s = THREE.MathUtils.smoothstep(u, 0.08, 0.88);
    return [r0 + (rExit - r0) * s, z0 + u * L];
  };
  const prof = smoothProfile([0, 0.06, 0.2, 0.4, 0.6, 0.8, 0.92, 1].map(at), 48);
  const shell = new THREE.Mesh(thickLathe(prof, seg, t, 'in'), materials.inconel ?? materials.nozzleFlap);
  shell.name = 'fixed-nozzle-shell';
  group.add(shell);
  // İç yüzey: kurum (kesitte ve ağızdan bakınca görünür)
  const inner = smoothProfile([0, 0.2, 0.5, 0.8, 1].map((u) => {
    const [r, z] = at(u);
    return [r - t - 0.0015, z];
  }), 40);
  const soot = new THREE.Mesh(thickLathe(inner, seg, 0.002, 'in'), materials.sooted ?? materials.nozzleFlap);
  soot.name = 'fixed-nozzle-liner';
  group.add(soot);
  // Ağız halkası (bead) ve takviye kaburgaları
  const ringMat = materials.nozzleMetal ?? materials.machinery;
  const bead = new THREE.Mesh(new THREE.TorusGeometry(rExit + t * 0.5, t * 1.1, 10, seg), ringMat);
  bead.position.z = z1 - t * 0.6;
  group.add(bead);
  for (const u of [0.32, 0.62]) {
    const [r, z] = at(u);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r + t * 0.6, t * 0.9, 8, seg), ringMat);
    rib.position.z = z;
    group.add(rib);
  }
  return { group: tagPart(group, 'nozzle'), exitZ: z1, exitR: rExit };
}

/**
 * Kavisli yaprak plakası: +Z boyunca 0 → len, genişlik w0 → w1 (daralan),
 * kesit yarıçapı rc etrafında yay, kalınlık t (içe doğru). Kapalı kutu.
 * ribs > 0 ise dış yüzde boyuna kaburgalar.
 */
function curvedPlate(len, w0, w1, t, rc, ribs = 0, segW = 6, segL = 8) {
  const P = [];
  const I = [];
  const UV = [];
  const grid = (rOff, flip) => {
    const base = P.length / 3;
    for (let j = 0; j <= segL; j++) {
      const v = j / segL;
      const w = w0 + (w1 - w0) * v;
      const half = w / 2 / rc; // yay yarı açısı
      for (let i = 0; i <= segW; i++) {
        const a = -half + (2 * half * i) / segW;
        const r = rc + rOff;
        P.push(Math.sin(a) * r, Math.cos(a) * r - rc, v * len);
        UV.push(i / segW, v);
      }
    }
    for (let j = 0; j < segL; j++) {
      for (let i = 0; i < segW; i++) {
        const a = base + j * (segW + 1) + i;
        const b = a + 1;
        const c = a + segW + 1;
        const d = c + 1;
        if (flip) I.push(a, b, c, b, d, c);
        else I.push(a, c, b, b, c, d);
      }
    }
    return base;
  };
  const top = grid(0, false);
  const bot = grid(-t, true);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals(); // yüzeyler yumuşak (kavis), kenarlar ayrı
  // kenarlar: kendi köşeleriyle (keskin), uzun kenarlar ve uçlar
  const E = [];
  const row = segW + 1;
  const v = (k) => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]];
  const quad = (a, b, c, d) => E.push(...v(a), ...v(b), ...v(c), ...v(c), ...v(b), ...v(d));
  for (let j = 0; j < segL; j++) {
    const a0 = top + j * row;
    const c0 = bot + j * row;
    quad(a0, c0, a0 + row, c0 + row); // i = 0 (−x)
    const a1 = a0 + segW;
    const c1 = c0 + segW;
    quad(a1, a1 + row, c1, c1 + row); // i = segW (+x)
  }
  for (let i = 0; i < segW; i++) {
    quad(top + i, top + i + 1, bot + i, bot + i + 1); // ön (−z)
    const aL = top + segL * row + i;
    const cL = bot + segL * row + i;
    quad(aL, cL, aL + 1, cL + 1); // arka (+z)
  }
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(E, 3));
  edges.computeVertexNormals();
  g = merge([g, edges]);
  if (ribs > 0) {
    const parts = [g];
    for (let k = 0; k < ribs; k++) {
      const x = ((k + 0.5) / ribs - 0.5) * Math.min(w0, w1) * 0.7;
      const rib = new THREE.BoxGeometry(t * 0.9, t * 1.6, len * 0.92).toNonIndexed();
      rib.translate(x, t * 0.7, len / 2);
      parts.push(rib);
    }
    g = merge(parts);
  }
  return g;
}

function merge(geos) {
  const pos = [];
  const nor = [];
  const uv = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array);
    else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

/**
 * @param n { hingeR, throat0, primary, divergent, flaps, actuators? }
 */
export function buildNozzle(materials, z0, n) {
  const group = new THREE.Group();
  group.name = 'variable-nozzle';
  const N = n.flaps;
  const flapMat = materials.nozzleFlap;
  const ceramic = materials.nozzleCeramic;
  const steel = materials.nozzleMetal ?? materials.machinery;
  const t = 0.01;
  const rtMin = n.throat0 * Math.sqrt(0.6);
  const rtMax = n.throat0 * 1.05;
  const reMax = rtMax * 1.3;
  const sector = (r) => (2 * Math.PI * r) / N;
  const hasDiv = n.divergent > 0;

  // --- geometriler ---
  const gPrim = curvedPlate(n.primary, sector(n.hingeR) * 0.94, sector(rtMin) * 0.94, t, n.hingeR, 2);
  const gPrimLiner = curvedPlate(n.primary * 0.96, sector(n.hingeR) * 0.9, sector(rtMin) * 0.9, 0.004, n.hingeR - t);
  gPrimLiner.translate(0, -t, n.primary * 0.02);
  const gSeal = curvedPlate(n.primary * 0.97, sector(n.hingeR) * 0.5, sector(rtMax) * 0.62, 0.006, n.hingeR - t - 0.004);
  const gDiv = hasDiv ? curvedPlate(n.divergent, sector(rtMin) * 0.94, sector(reMax) * 0.72, t, rtMin + 0.05, 2) : null;
  const gDivLiner = hasDiv ? curvedPlate(n.divergent * 0.97, sector(rtMin) * 0.9, sector(reMax) * 0.68, 0.004, rtMin + 0.04) : null;
  gDivLiner?.translate(0, -t, 0);
  const gDivSeal = hasDiv ? curvedPlate(n.divergent * 0.97, sector(rtMin) * 0.55, sector(reMax) * 0.62, 0.006, rtMin + 0.03) : null;
  gDivSeal?.translate(0, -t - 0.004, 0);
  // dış yaprak: menteşeden çıkışa, çıkışta biraz daralan pul
  const extR = n.hingeR + 0.05;
  const extZ = z0 + (hasDiv ? 0.13 : 0.05);
  const extLen = hasDiv ? n.primary + n.divergent - 0.1 : n.primary - 0.02;
  const gExt = curvedPlate(extLen, sector(extR) * 1.1, sector(hasDiv ? reMax + 0.05 : rtMax + 0.04) * 1.12, 0.007, extR, 1);
  // bağlantı kolu (boy 1, ölçeklenir) ve aktüatör parçaları
  const gLink = new THREE.BoxGeometry(0.014, 0.02, 1);
  gLink.translate(0, 0, 0.5);
  const nAct = n.actuators ?? 6;
  const Rr = n.hingeR + 0.035; // senkron halka yarıçapı
  const barrelLen = 0.24;
  const zBarrel = z0 - 0.4;
  const Ra = Rr + 0.03;
  const gBarrel = merge([
    new THREE.CylinderGeometry(0.024, 0.024, barrelLen, 16).rotateX(Math.PI / 2).translate(0, 0, barrelLen / 2),
    new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16).rotateX(Math.PI / 2).translate(0, 0, barrelLen - 0.01),
    new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16).rotateX(Math.PI / 2).translate(0, 0, 0.0125),
    // gövde ayağı (çatal) ve hidrolik bağlantı
    new THREE.BoxGeometry(0.03, Ra - Rr + 0.03, 0.04).translate(0, -(Ra - Rr) / 2 - 0.01, 0.01),
    new THREE.CylinderGeometry(0.007, 0.007, 0.05, 8).translate(0.02, 0.03, barrelLen * 0.3),
  ]);
  const gRod = new THREE.CylinderGeometry(0.01, 0.01, 1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const gClevis = new THREE.BoxGeometry(0.026, 0.035, 0.03);

  const inst = (geo, mat, count, name) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.name = name;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  const prim = inst(gPrim, flapMat, N, 'nozzle-primary');
  const primL = inst(gPrimLiner, ceramic, N, 'nozzle-primary-liner');
  const seal = inst(gSeal, ceramic, N, 'nozzle-seal');
  const div = hasDiv ? inst(gDiv, flapMat, N, 'nozzle-divergent') : null;
  const divL = hasDiv ? inst(gDivLiner, ceramic, N, 'nozzle-divergent-liner') : null;
  const divS = hasDiv ? inst(gDivSeal, ceramic, N, 'nozzle-divergent-seal') : null;
  const ext = inst(gExt, flapMat, N, 'nozzle-external');
  const link = inst(gLink, steel, N, 'nozzle-link');
  const barrel = inst(gBarrel, steel, nAct, 'nozzle-actuator');
  const rod = inst(gRod, materials.polishedLip ?? steel, nAct, 'nozzle-actuator-rod');
  const clevis = inst(gClevis, steel, nAct, 'nozzle-actuator-clevis');

  // Senkron halka: dikdörtgen kesitli kapalı halka (eksenel kayar)
  const syncRing = new THREE.Mesh(
    revolve(
      roundPoly(
        [
          [Rr - 0.012, -0.018],
          [Rr - 0.012, 0.018],
          [Rr + 0.012, 0.018],
          [Rr + 0.012, -0.018],
        ],
        0.003,
        1,
      ),
      { segments: 128 },
    ),
    steel,
  );
  syncRing.name = 'nozzle-sync-ring';
  group.add(syncRing);
  // Lüle kasnağı (menteşe halkası) ve dış yaprak menteşe halkası
  const hingeRing = new THREE.Mesh(
    revolve(
      roundPoly(
        [
          [n.hingeR - 0.005, z0 - 0.05],
          [n.hingeR - 0.005, z0 + 0.012],
          [extR + 0.012, extZ + 0.01],
          [extR + 0.012, z0 - 0.05],
        ],
        0.004,
        1,
      ),
      { segments: 128 },
    ),
    flapMat,
  );
  hingeRing.name = 'nozzle-hinge-ring';
  group.add(hingeRing);

  const M = new THREE.Matrix4();
  const R = new THREE.Matrix4();
  const T = new THREE.Matrix4();
  const X = new THREE.Matrix4();
  const S = new THREE.Matrix4();
  const at = (i, ph = 0) => R.makeRotationZ(-(ph + (i / N) * Math.PI * 2));

  let exitZ = z0 + n.primary + n.divergent;
  let exitR = n.throat0;
  const dCam = n.primary * 0.42;
  const linkLen = 0.17;

  const set = (area, abLevel = 0) => {
    const rt = n.throat0 * Math.sqrt(Math.max(0.6, area));
    const tp = Math.asin(THREE.MathUtils.clamp((n.hingeR - rt) / n.primary, -0.95, 0.95));
    let re = rt;
    let td = 0;
    if (hasDiv) {
      re = rt * (1.12 + 0.14 * abLevel);
      td = -Math.asin(THREE.MathUtils.clamp((re - rt) / n.divergent, -0.95, 0.95));
    }
    const zThroat = z0 + n.primary * Math.cos(tp);
    exitR = re;
    exitZ = zThroat + (hasDiv ? n.divergent * Math.cos(td) : 0);
    // Dış yaprak açısı: menteşeden çıkıştaki dış kenara
    const reOut = (hasDiv ? re : rt) + 0.03;
    const te = Math.asin(THREE.MathUtils.clamp((extR - reOut) / extLen, -0.95, 0.95));
    // Senkron halka: kol boyu sabit → halka z
    const by = n.hingeR - dCam * Math.sin(tp);
    const bz = z0 + dCam * Math.cos(tp);
    const zRing = bz - Math.sqrt(Math.max(1e-6, linkLen * linkLen - (Rr - by) * (Rr - by)));
    syncRing.position.z = zRing;
    const lk = Math.hypot(by - Rr, bz - zRing);
    const lphi = Math.atan2(-(by - Rr), bz - zRing);

    for (let i = 0; i < N; i++) {
      at(i);
      // yakınsak yaprak: R · T(hinge) · Rx(tp)
      const base = new THREE.Matrix4().multiplyMatrices(R, T.makeTranslation(0, n.hingeR, z0)).multiply(X.makeRotationX(tp));
      prim.setMatrixAt(i, base);
      primL.setMatrixAt(i, base);
      if (hasDiv) {
        const dm = base.clone().multiply(T.makeTranslation(0, 0, n.primary)).multiply(X.makeRotationX(td - tp));
        // ıraksak yaprak kendi kavis merkezine göre (rtMin + 0.05) üretildi
        div.setMatrixAt(i, dm);
        divL.setMatrixAt(i, dm);
      }
      // pul gibi bindirme: her dış yaprak kendi ekseni etrafında hafif yuvarlanır,
      // bir kenarı komşusunun üstüne biner
      M.multiplyMatrices(R, T.makeTranslation(0, extR, extZ)).multiply(X.makeRotationX(te)).multiply(S.makeRotationZ(0.045)).multiply(T.makeTranslation(0, 0.004, 0));
      ext.setMatrixAt(i, M);
      // kol: halkadan kam noktasına
      M.multiplyMatrices(R, T.makeTranslation(0, Rr, zRing)).multiply(X.makeRotationX(lphi)).multiply(S.makeScale(1, 1, lk));
      link.setMatrixAt(i, M);
      // contalar yaprak arasında (yarım adım)
      at(i, Math.PI / N);
      const sb = new THREE.Matrix4().multiplyMatrices(R, T.makeTranslation(0, n.hingeR - t, z0)).multiply(X.makeRotationX(tp));
      seal.setMatrixAt(i, sb);
      if (hasDiv) divS.setMatrixAt(i, sb.clone().multiply(T.makeTranslation(0, 0, n.primary)).multiply(X.makeRotationX(td - tp)));
    }
    // Aktüatörler: silindir sabit, rod halkaya uzanır
    const rodZ0 = zBarrel + barrelLen;
    const rodLen = Math.max(0.02, zRing - rodZ0);
    for (let k = 0; k < nAct; k++) {
      R.makeRotationZ(-((k + 0.5) / nAct) * Math.PI * 2 - 0.13);
      barrel.setMatrixAt(k, M.multiplyMatrices(R, T.makeTranslation(0, Ra, zBarrel)));
      rod.setMatrixAt(k, M.multiplyMatrices(R, T.makeTranslation(0, Ra, rodZ0)).multiply(S.makeScale(1, 1, rodLen)));
      clevis.setMatrixAt(k, M.multiplyMatrices(R, T.makeTranslation(0, Ra - 0.012, zRing)));
    }
    for (const m of [prim, primL, seal, div, divL, divS, ext, link, barrel, rod, clevis]) if (m) m.instanceMatrix.needsUpdate = true;
  };
  set(1, 0);
  return {
    group: tagPart(group, 'nozzle'),
    set,
    get exitZ() {
      return exitZ;
    },
    get exitR() {
      return exitR;
    },
  };
}
