/**
 * Halka (annular) yanma odası (M2).
 *
 *   difüzör       HPC çıkışından genişleyen ön difüzör kanalı (iç/dış duvar)
 *   ön kaporta    kubbenin önünde, difüzör havasını gömleklerin iç ve dış
 *                 tarafına bölen iki dudak
 *   kubbe         gömlekleri önde birleştiren perde; her enjektör için bir
 *                 swirler kabı (radyal kanatçıklı halka + venturi)
 *   gömlekler     iç ve dış gömlek: bindirmeli soğutma halkaları (basamaklı
 *                 profil), birincil ve seyreltme delikleri (shader'da gerçek
 *                 açıklık), efüzyon delikleri, alev tarafında kor parlaması
 *   enjektörler   gövdeden inen yakıt enjektörü sapları, flanş ve uç
 *   ateşleyiciler iki buji: gövdeden dış gömleğe
 *   iç kasa       gömleklerin altında HPC iç duvarından NGV desteğine
 *
 * Bütün dönel parçalar kapalı katılardır (kesitte dolu).
 */

import * as THREE from 'three';
import { tagPart } from './geom.js';
import { mergeStatic } from './stages.js';
import { revolve, roundPoly } from './revolve.js';
import { bladeQuality } from './blades.js';
import { linerUniforms } from '../materials/engine';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function segs(r) {
  const q = bladeQuality();
  const base = q === 'low' ? 56 : q === 'medium' ? 88 : 120;
  return Math.round(base * Math.min(1.4, Math.max(0.6, r / 0.4)));
}

function solid(profile, mat, part, r = 0.4, smoothDeg = 30) {
  const m = new THREE.Mesh(revolve(profile, { segments: segs(r), smooth: smoothDeg }), mat);
  m.castShadow = false;
  return tagPart(m, part);
}

/** Merkez çizgisi c(z) etrafında t kalınlıklı kapalı kabuk (profil noktaları) */
function shell(center, z0, z1, t, n = 24, side = 1) {
  const a = [];
  const b = [];
  for (let i = 0; i <= n; i++) {
    const z = lerp(z0, z1, i / n);
    const r = center(z);
    a.push([r, z]);
    b.push([r + t * side, z]);
  }
  return [...a, ...b.reverse()];
}

/** Örnekli parça yerleşimi: geometri +Y yarıçapında, θ etrafında */
function ring(geo, mat, count, phase, part) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  const M = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    M.makeRotationZ(-(phase + (i / count) * Math.PI * 2));
    m.setMatrixAt(i, M);
  }
  m.instanceMatrix.needsUpdate = true;
  return tagPart(m, part);
}

/**
 * @param materials kütüphane
 * @param c {
 *   z0      difüzör başlangıcı (HPC çıkışı)
 *   zDome   kubbe ekseni
 *   z1      gömlek çıkışı (NGV girişi)
 *   rIn, rOut   gömleklerin en iç/dış yarıçapı
 *   inHub, inTip  difüzör girişinde gaz yolu (HPC çıkış kanatları)
 *   exHub, exTip  NGV girişinde gaz yolu
 *   caseAt(z)    dış gövde iç yarıçapı (enjektör saplarının başladığı yer)
 *   injectors    enjektör sayısı
 * }
 */
export function buildCombustor(materials, c) {
  const part = 'combustor';
  const group = new THREE.Group();
  group.name = 'combustor';
  const low = bladeQuality() === 'low';
  const liner = materials.combustorGlow;
  const metal = materials.combustorMetal ?? materials.superalloy;
  const steel = materials.nozzleMetal ?? materials.machinery;
  const h = c.rOut - c.rIn;
  const mid = (c.rIn + c.rOut) / 2;
  const L = c.z1 - c.zDome;
  const tw = Math.max(0.0025, h * 0.014); // gömlek et kalınlığı
  const N = c.injectors;

  // Gömlek shader'ı için geometri (tek motor sahnede: paylaşılan uniform'lar)
  linerUniforms.uRMid.value = mid;
  linerUniforms.uZ0.value = c.zDome;
  linerUniforms.uZ1.value = c.z1;
  linerUniforms.uN.value = N;
  linerUniforms.uScale.value = h / 0.2;

  /* ---------------- gömlekler (basamaklı soğutma halkaları) ---------------- */
  const rings = low ? 0 : 5;
  const step = h * 0.018;
  // Dış gömlek merkez çizgisi: kubbeden yükselir, düz, çıkışa daralır
  const outerR = (z) => {
    const t = (z - c.zDome) / L;
    const base = t < 0.22 ? lerp(c.rOut - h * 0.14, c.rOut, smooth(t / 0.22)) : t < 0.62 ? c.rOut : lerp(c.rOut, c.exTip + tw * 1.2, smooth((t - 0.62) / 0.38));
    // bindirme basamakları: her halka önünde içe küçük bir sıçrama
    const k = rings ? (t * (rings + 1)) % 1 : 0.5;
    return base + (rings && t > 0.08 && t < 0.9 ? step * (k - 0.5) : 0);
  };
  const innerR = (z) => {
    const t = (z - c.zDome) / L;
    const base = t < 0.22 ? lerp(c.rIn + h * 0.14, c.rIn, smooth(t / 0.22)) : t < 0.6 ? c.rIn : lerp(c.rIn, c.exHub - tw * 1.2, smooth((t - 0.6) / 0.4));
    const k = rings ? (t * (rings + 1)) % 1 : 0.5;
    return base - (rings && t > 0.08 && t < 0.9 ? step * (k - 0.5) : 0);
  };
  const nL = low ? 20 : bladeQuality() === 'medium' ? 42 : 60;
  group.add(solid(shell(outerR, c.zDome, c.z1, tw, nL, 1), liner, part, c.rOut, 50));
  group.add(solid(shell(innerR, c.zDome, c.z1, tw, nL, -1), liner, part, c.rIn, 50));

  /* ---------------- kubbe (perde) ---------------- */
  const dR0 = c.rIn + h * 0.14 - tw;
  const dR1 = c.rOut - h * 0.14 + tw;
  const dt = Math.max(0.004, h * 0.03);
  group.add(
    solid(
      roundPoly(
        [
          [dR1, c.zDome - dt],
          [dR1, c.zDome + 0.002],
          [dR0, c.zDome + 0.002],
          [dR0, c.zDome - dt],
        ],
        0.0015,
        1,
      ),
      metal,
      part,
      mid,
    ),
  );

  /* ---------------- ön kaporta (iki dudak) ---------------- */
  const cowlLen = L * 0.2;
  for (const s of [1, -1]) {
    const r0 = s > 0 ? dR1 : dR0;
    const lip = (z) => {
      const u = (c.zDome - z) / cowlLen; // 0 kubbe → 1 dudak ucu
      return r0 - s * h * 0.22 * Math.sin(Math.min(1, u) * Math.PI * 0.5) * 0.9;
    };
    group.add(solid(shell(lip, c.zDome - cowlLen, c.zDome, s * Math.max(0.003, h * 0.016), 16, 1), metal, part, r0));
  }

  /* ---------------- swirler kapları + venturi ---------------- */
  const cupR = Math.min(h * 0.22, (Math.PI * mid) / N * 0.55);
  const cupL = cupR * 0.9;
  {
    // kap: kısa silindirik halka (+Z yönünde), kubbenin önünde
    const cup = new THREE.CylinderGeometry(cupR, cupR * 1.08, cupL, low ? 10 : 20, 1, true);
    cup.rotateX(Math.PI / 2);
    cup.translate(0, mid, c.zDome - cupL / 2);
    const cupIn = new THREE.CylinderGeometry(cupR * 0.62, cupR * 0.45, cupL * 1.1, low ? 8 : 16, 1, true);
    cupIn.rotateX(Math.PI / 2);
    cupIn.translate(0, mid, c.zDome - cupL * 0.45);
    group.add(ring(cup, metal, N, 0, part), ring(cupIn, metal, N, 0, part));
    if (!low) {
      // radyal swirler kanatçıkları
      const nv = 10;
      const vane = new THREE.BoxGeometry(cupR * 0.08, cupR * 0.42, cupL * 0.55);
      vane.rotateZ(0.5);
      const vanes = [];
      for (let k = 0; k < nv; k++) {
        const g = vane.clone();
        const a = (k / nv) * Math.PI * 2;
        g.translate(0, cupR * 0.8, 0);
        g.rotateZ(a);
        g.translate(0, mid, c.zDome - cupL * 0.55);
        vanes.push(g);
      }
      const merged = mergeBoxes(vanes);
      group.add(ring(merged, metal, N, 0, part));
    }
  }

  /* ---------------- yakıt enjektörleri ---------------- */
  {
    const zc = c.zDome - cupL * 1.05;
    const rCase = c.caseAt(zc - cowlLen * 0.6);
    const stemTop = rCase + 0.035;
    const stemBot = mid + cupR * 0.2;
    const zs = zc - cowlLen * 0.55;
    const stemLen = stemTop - stemBot;
    const stemR = Math.max(0.006, cupR * 0.22);
    const parts = [];
    // sap (yarıçap boyunca), gövdeye doğru hafif geriye eğimli
    const stem = new THREE.CylinderGeometry(stemR * 0.8, stemR, stemLen, low ? 6 : 12);
    stem.translate(0, stemBot + stemLen / 2, zs);
    parts.push(stem);
    // dirsek: sap ucundan kabın eksenine uzanan kısa kol
    const arm = new THREE.CylinderGeometry(stemR * 0.7, stemR * 0.7, Math.abs(zc - zs) + stemR, low ? 6 : 12);
    arm.rotateX(Math.PI / 2);
    arm.translate(0, mid, (zc + zs) / 2);
    parts.push(arm);
    // uç (nozzle tip) ve ısı kalkanı
    const tip = new THREE.CylinderGeometry(stemR * 0.55, stemR * 0.85, cupL * 0.5, low ? 8 : 16);
    tip.rotateX(Math.PI / 2);
    tip.translate(0, mid, zc + cupL * 0.3);
    parts.push(tip);
    // gövde üstündeki montaj flanşı ve yakıt bağlantısı
    const flange = new THREE.CylinderGeometry(stemR * 2.4, stemR * 2.4, 0.008, low ? 8 : 16);
    flange.translate(0, rCase + 0.012, zs);
    parts.push(flange);
    const fitting = new THREE.CylinderGeometry(stemR * 0.9, stemR * 0.9, 0.03, 8);
    fitting.rotateX(Math.PI / 2);
    fitting.translate(0, stemTop - 0.006, zs - 0.015);
    parts.push(fitting);
    group.add(ring(mergeBoxes(parts), steel, N, 0, part));
  }

  /* ---------------- ateşleyiciler (2 buji) ---------------- */
  {
    const zi = c.zDome + L * 0.26;
    const rTop = c.caseAt(zi) + 0.03;
    const rBot = outerR(zi) + tw;
    const plug = new THREE.CylinderGeometry(0.008, 0.01, rTop - rBot, 12);
    plug.translate(0, (rTop + rBot) / 2, zi);
    const boss = new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12);
    boss.translate(0, c.caseAt(zi) + 0.014, zi);
    const g = mergeBoxes([plug, boss]);
    for (const a of [0.55, -0.55]) {
      const m = new THREE.Mesh(g, steel);
      m.rotation.z = a;
      group.add(tagPart(m, part));
    }
  }

  /* ---------------- difüzör ve iç kasa ---------------- */
  {
    const zA = c.z0;
    const zB = c.zDome - cowlLen * 1.05;
    const wallT = Math.max(0.005, h * 0.03);
    // ön difüzör: HPC çıkışından kaportaya genişleyen kanal
    const dOut = (z) => lerp(c.inTip + 0.002, dR1 - h * 0.05, smooth((z - zA) / (zB - zA)));
    const dIn = (z) => lerp(c.inHub - 0.002, dR0 + h * 0.05, smooth((z - zA) / (zB - zA)));
    group.add(solid(shell(dOut, zA, zB, wallT, 16, 1), metal, part, c.inTip));
    group.add(solid(shell(dIn, zA, zB, wallT, 16, -1), metal, part, c.inHub));
    // iç kasa: difüzör iç duvarından NGV iç desteğine, gömleğin altında
    const caseIn = (z) => {
      const t = (z - zB) / (c.z1 + 0.01 - zB);
      return lerp(dIn(zB) - wallT, c.exHub - h * 0.22, smooth(t)) - h * 0.12 * Math.sin(Math.PI * t);
    };
    group.add(solid(shell(caseIn, zB, c.z1 + 0.01, -Math.max(0.006, h * 0.035), 24, 1), metal, part, c.rIn));
  }

  mergeStatic(group);
  return group;
}

/** Aynı nitelik kümesine sahip geometrileri (indeksli/indekssiz) birleştirir */
function mergeBoxes(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const pos = [];
  const nor = [];
  const uv = [];
  for (const g of list) {
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
