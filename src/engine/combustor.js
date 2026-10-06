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

  let outerR;
  let dR0;
  let dR1;
  let cowlLen;
  let cupR;
  let cupL;
  if (c.cans) {
    ({ outerR, dR0, dR1, cowlLen, cupR, cupL } = canLiners(group, materials, c, { liner, metal, low, tw }));
  } else {
    /* ---------------- gömlekler (basamaklı soğutma halkaları) ---------------- */
    const rings = low ? 0 : 5;
    const step = h * 0.018;
    // Dış gömlek merkez çizgisi: kubbeden yükselir, düz, çıkışa daralır
    outerR = (z) => {
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
    dR0 = c.rIn + h * 0.14 - tw;
    dR1 = c.rOut - h * 0.14 + tw;
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
    cowlLen = L * 0.2;
    for (const s of [1, -1]) {
      const r0 = s > 0 ? dR1 : dR0;
      const lip = (z) => {
        const u = (c.zDome - z) / cowlLen; // 0 kubbe → 1 dudak ucu
        return r0 - s * h * 0.22 * Math.sin(Math.min(1, u) * Math.PI * 0.5) * 0.9;
      };
      group.add(solid(shell(lip, c.zDome - cowlLen, c.zDome, s * Math.max(0.003, h * 0.016), 16, 1), metal, part, r0));
    }

    /* ---------------- swirler kapları + venturi ---------------- */
    cupR = Math.min(h * 0.22, (Math.PI * mid) / N * 0.55);
    cupL = cupR * 0.9;
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
    const ign = c.cans ? [(2 * Math.PI) / c.cans, -(2 * Math.PI) / c.cans] : [0.55, -0.55];
    for (const a of ign) {
      const m = new THREE.Mesh(g, steel);
      m.rotation.z = a;
      group.add(tagPart(m, part));
    }
    // Efektler için: buji uçlarının gömlek içindeki konumu
    const rt = outerR(zi) - 0.012;
    group.userData.igniters = ign.map((a) => [-Math.sin(a) * rt, Math.cos(a) * rt, zi]);
  }
  // Enjektör/swirler çıkışları ve alev bölgesi (kesitte yakıt sisi ve alev)
  group.userData.injectors = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    return [Math.sin(a) * mid, Math.cos(a) * mid, c.zDome + 0.004];
  });
  group.userData.flameZone = { zDome: c.zDome, z1: c.z1, mid, h };

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

/**
 * Kutu (can) gömlekleri: her kutu kendi ekseni etrafında dönel bir gömlek
 * (kubbe, soğutma halkalı gövde, daralan çıkış), örnekleme ile ortalama
 * yarıçapta çevreye dizilir. Gömlek shader'ı yerel konumu kullandığından
 * delik deseni her kutunun kendi çevresine oturur. Komşu kutular ateşleme
 * geçiş borularıyla bağlıdır (bir kutuda tutuşan alev diğerlerine geçer);
 * kutu çıkışları geçiş kanalıyla NGV halkasına iner.
 */
function canLiners(group, materials, c, { liner, metal, low, tw }) {
  const part = 'combustor';
  const N = c.cans;
  const rc = (c.rOut - c.rIn) / 2;
  const mid = (c.rIn + c.rOut) / 2;
  const L = c.z1 - c.zDome;
  // Gömlek deseni kutunun kendi çevresine göre
  linerUniforms.uRMid.value = rc;
  linerUniforms.uN.value = 6;
  linerUniforms.uScale.value = (2 * rc) / 0.2;
  const atCan = (geo, mat, phase = 0) => {
    const m = new THREE.InstancedMesh(geo, mat, N);
    const R = new THREE.Matrix4();
    const T = new THREE.Matrix4().makeTranslation(0, mid, 0);
    for (let i = 0; i < N; i++) {
      R.makeRotationZ(-(phase + (i / N) * Math.PI * 2));
      m.setMatrixAt(i, R.clone().multiply(T));
    }
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = false;
    return tagPart(m, part);
  };
  const sg = low ? 20 : 36;
  // Gövde: kubbeden açılır, düz, çıkışa daralır (bindirme basamakları)
  const zEnd = c.z1 - L * 0.16;
  const rings = low ? 0 : 4;
  const canR = (z) => {
    const t = (z - c.zDome) / (zEnd - c.zDome);
    const base = t < 0.18 ? lerp(rc * 0.55, rc, smooth(t / 0.18)) : t < 0.7 ? rc : lerp(rc, rc * 0.78, smooth((t - 0.7) / 0.3));
    const k = rings ? (t * (rings + 1)) % 1 : 0.5;
    return base + (rings && t > 0.1 && t < 0.9 ? rc * 0.03 * (k - 0.5) : 0);
  };
  group.add(atCan(revolve(shell(canR, c.zDome, zEnd, tw, low ? 16 : 40, 1), { segments: sg, smooth: 50 }), liner));
  // Kubbe kapağı
  const dt = Math.max(0.004, rc * 0.04);
  group.add(atCan(revolve(roundPoly([[rc * 0.56, c.zDome - dt], [rc * 0.56, c.zDome + 0.002], [rc * 0.2, c.zDome + 0.002], [rc * 0.2, c.zDome - dt]], 0.0015, 1), { segments: sg }), metal));
  // Dış kutu muhafazası (gömleği saran basınç kabı): kesitte görünür ince kabuk
  const caseR = (z) => {
    const t = (z - (c.zDome - L * 0.08)) / (zEnd - (c.zDome - L * 0.08));
    return lerp(rc * 0.75, rc * 1.16, smooth(Math.min(1, t * 3))) - rc * 0.08 * smooth(Math.max(0, t - 0.8) / 0.2);
  };
  group.add(atCan(revolve(shell(caseR, c.zDome - L * 0.08, zEnd, Math.max(0.003, rc * 0.025), low ? 12 : 24, 1), { segments: sg, smooth: 50 }), metal));
  // Ateşleme geçiş boruları: komşu kutuların arasında, kubbeye yakın
  const half = Math.PI / N;
  const chord = 2 * mid * Math.sin(half);
  const tubeLen = Math.max(0.01, chord - 2 * rc * 0.92);
  const tube = new THREE.CylinderGeometry(rc * 0.09, rc * 0.09, tubeLen, low ? 8 : 14);
  tube.rotateZ(Math.PI / 2);
  tube.translate(0, mid * Math.cos(half), c.zDome + L * 0.3);
  group.add(atCanRing(tube, metal, N, half, part));
  // Geçiş kanalı: kutu çıkışlarından NGV halkasına (iç ve dış duvar)
  const zt0 = zEnd - L * 0.04;
  const wall = Math.max(0.004, rc * 0.03);
  const outerT = (z) => lerp(mid + rc * 0.8, c.exTip + tw, smooth((z - zt0) / (c.z1 - zt0)));
  const innerT = (z) => lerp(mid - rc * 0.8, c.exHub - tw, smooth((z - zt0) / (c.z1 - zt0)));
  group.add(solid(shell(outerT, zt0, c.z1, wall, 12, 1), liner, part, mid + rc, 50));
  group.add(solid(shell(innerT, zt0, c.z1, wall, 12, -1), liner, part, mid - rc, 50));
  // Swirler kapları: her kutunun kubbesinde
  const cupR = rc * 0.32;
  const cupL = cupR * 0.9;
  const cup = new THREE.CylinderGeometry(cupR, cupR * 1.08, cupL, low ? 10 : 20, 1, true);
  cup.rotateX(Math.PI / 2);
  cup.translate(0, mid, c.zDome - cupL / 2);
  group.add(atCanRing(cup, metal, N, 0, part));
  return {
    outerR: () => mid + rc * 1.16,
    dR0: mid - rc * 0.75,
    dR1: mid + rc * 0.75,
    cowlLen: L * 0.12,
    cupR,
    cupL,
  };
}

/** Motor ekseni etrafında örnekli yerleşim (geometri zaten +Y yarıçapında) */
function atCanRing(geo, mat, count, phase, part) {
  return ring(geo, mat, count, phase, part);
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
