/**
 * Yanma odası (M2; kutu ve kutu-halka M4c/M5a): halka (annular), kutu (can)
 * ve kutu-halka (canAnnular).
 *
 * Halka:
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
 * Kutu: her kutu kendi basınç kabında (gömlek + kap), kısa geçiş kanalı
 * ortak NGV halkasına iner; dış ortak kasa yalnız bölümü kapatan ince
 * bir kabuktur. Kutu-halka: kutular ortak halka kasanın içinde durur,
 * kendi kapları yoktur; gömlek kısa, her kutunun uzun geçiş parçası
 * daireden halka dilimine dönüşür ve komşularıyla NGV'de ortak çıkış
 * halkasını oluşturur (J57, JT8D, sanayi gaz türbinleri).
 *
 * Bütün dönel parçalar kapalı katılardır (kesitte dolu). Oda kendi giriş
 * düzlemine (z0) göre yerel eksende üretilir ve artımlı üretimde yeniden
 * kullanılır (buildCache.reuse): yalnız eksenel kayan oda yeniden üretilmez.
 */

import * as THREE from 'three';
import { tagPart } from './geom.js';
import { mergeStatic } from './stages.js';
import { revolve, roundPoly } from './revolve.js';
import { bladeQuality } from './blades.js';
import { linerUniforms } from '../materials/engine';
import { addPatch, clonePatched } from '../materials/weathering';
import { keyOf, reuse } from './buildCache.js';

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
 * Gömlek shader'ının geometri uniform'ları (tek motor sahnede: paylaşılan).
 * Oda yeniden kullanılsa da her kurulumda yazılır.
 */
function setLinerUniforms(c) {
  const h = c.rOut - c.rIn;
  linerUniforms.uZ0.value = c.zDome;
  linerUniforms.uZ1.value = c.z1;
  if (c.cans) {
    // Delik deseni kutunun kendi çevresine göre. Kutu gömleği kendi ekseninde
    // kurulur ve alev hep içtedir: alev tarafı her yerde eksene bakan yüz
    // (uRMid = 0). Kutu yarıçapı (rc) verildiğinde kubbe ve daralan çıkışta
    // (yerel yarıçap < rc) gömleğin DIŞ yüzü parlıyordu. Motor ekseni
    // çerçevesindeki geçiş parçaları alev tarafını öznitelikle bildirir
    // (gasSideMaterial).
    const rc = h / 2;
    linerUniforms.uRMid.value = 0;
    linerUniforms.uN.value = 6;
    linerUniforms.uScale.value = (2 * rc) / 0.2;
  } else {
    linerUniforms.uRMid.value = (c.rIn + c.rOut) / 2;
    linerUniforms.uN.value = c.injectors;
    linerUniforms.uScale.value = h / 0.2;
  }
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
 *   cans?        kutu sayısı (kutu ve kutu-halka)
 *   style?       'can' | 'canAnnular' (kutu sayısı varken; yoksa 'can')
 * }
 */
export function buildCombustor(materials, c) {
  // Yerel eksen: oda giriş düzlemi z = 0
  const dz = c.z0;
  const local = { ...c, z0: 0, zDome: c.zDome - dz, z1: c.z1 - dz, caseAt: (z) => c.caseAt(z + dz) };
  setLinerUniforms(local);
  // Anahtar bütün girdileri içerir: gövde iç yarıçapı örneklenir (enjektör
  // flanşları ve bujiler ona oturur)
  const L = local.z1;
  const caseAt = Array.from({ length: 16 }, (_, i) => local.caseAt(-0.3 * L + (1.3 * L * i) / 15));
  const key = keyOf('combustor', {
    style: c.cans ? (c.style ?? 'can') : 'annular',
    cans: c.cans ?? 0,
    zDome: local.zDome,
    z1: local.z1,
    r: [c.rIn, c.rOut, c.inHub, c.inTip, c.exHub, c.exTip],
    injectors: c.injectors,
    caseAt,
  });
  const group = reuse(key, () => buildCombustorLocal(materials, local));
  group.position.z = dz;
  return group;
}

function buildCombustorLocal(materials, c) {
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
  // Enjektör/swirler çıkışları ve alev bölgesi (kesitte yakıt sisi ve alev).
  // DİKKAT: bu noktalar ve flameZone'un z'leri oda grubunun YEREL ekseninde
  // (giriş düzlemi z = 0; grup buildCombustor'da z0'a taşınır), model
  // uzayında değil. Tüketici `matrixWorld` ile dönüştürür; flameZone'dan
  // yalnız farklar (h, z1 − zDome) mutlak z'siz kullanılabilir
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
 * Kutu (can) ve kutu-halka gömlekleri: her kutu kendi ekseni etrafında
 * dönel bir gömlek (kubbe, soğutma halkalı gövde, daralan çıkış), örnekleme
 * ile ortalama yarıçapta çevreye dizilir. Gömlek shader'ı yerel konumu
 * kullandığından delik deseni her kutunun kendi çevresine oturur. Komşu
 * kutular ateşleme geçiş borularıyla bağlıdır (bir kutuda tutuşan alev
 * diğerlerine geçer).
 *
 *   kutu        her kutunun gömleğini saran kendi basınç kabı; kutu
 *               çıkışları kısa bir halka geçiş kanalıyla NGV'ye iner
 *   kutu-halka  kap yok (ortak halka kasa); gömlek kısa, her kutunun uzun
 *               geçiş parçası daireden halka dilimine dönüşür ve NGV
 *               girişinde komşularıyla ortak çıkış halkasını oluşturur
 */
function canLiners(group, materials, c, { liner, metal, low, tw }) {
  const part = 'combustor';
  const N = c.cans;
  const shared = c.style === 'canAnnular';
  const rc = (c.rOut - c.rIn) / 2;
  const mid = (c.rIn + c.rOut) / 2;
  const L = c.z1 - c.zDome;
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
  // Gövde: kubbeden açılır, düz, çıkışa daralır (bindirme basamakları).
  // Kutu-halkada gömlek kısa: odanın son üçte biri geçiş parçasıdır
  const zEnd = c.z1 - L * (shared ? 0.36 : 0.16);
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
  if (!shared) {
    // Dış kutu muhafazası (gömleği saran basınç kabı): kesitte görünür ince kabuk
    const caseR = (z) => {
      const t = (z - (c.zDome - L * 0.08)) / (zEnd - (c.zDome - L * 0.08));
      return lerp(rc * 0.75, rc * 1.16, smooth(Math.min(1, t * 3))) - rc * 0.08 * smooth(Math.max(0, t - 0.8) / 0.2);
    };
    group.add(atCan(revolve(shell(caseR, c.zDome - L * 0.08, zEnd, Math.max(0.003, rc * 0.025), low ? 12 : 24, 1), { segments: sg, smooth: 50 }), metal));
  }
  // Ateşleme geçiş boruları: komşu kutuların arasında, kubbeye yakın
  const half = Math.PI / N;
  const chord = 2 * mid * Math.sin(half);
  const tubeLen = Math.max(0.01, chord - 2 * rc * 0.92);
  const tube = new THREE.CylinderGeometry(rc * 0.09, rc * 0.09, tubeLen, low ? 8 : 14);
  tube.rotateZ(Math.PI / 2);
  tube.translate(0, mid * Math.cos(half), c.zDome + L * 0.3);
  group.add(atCanRing(tube, metal, N, half, part));
  if (shared) {
    // Geçiş parçaları: kutu çıkışından (gömleğin üstüne binerek) NGV girişine
    const zt0 = zEnd - L * 0.05;
    const wall = Math.max(0.003, rc * 0.03);
    const tp = transitionPiece(c, { mid, a0: rc * 0.78 + tw + wall, z0: zt0, z1: c.z1, N, t: wall, nu: low ? 10 : 20, nt: low ? 24 : 48 });
    group.add(atCanRing(tp, gasSideMaterial(liner), N, 0, part));
  } else {
    // Geçiş kanalı: kutu çıkışlarından NGV halkasına (iç ve dış duvar). Motor
    // ekseni çerçevesinde: alev tarafı öznitelikle (iç duvarda dışa bakan yüz)
    const zt0 = zEnd - L * 0.04;
    const wall = Math.max(0.004, rc * 0.03);
    const outerT = (z) => lerp(mid + rc * 0.8, c.exTip + tw, smooth((z - zt0) / (c.z1 - zt0)));
    const innerT = (z) => lerp(mid - rc * 0.8, c.exHub - tw, smooth((z - zt0) / (c.z1 - zt0)));
    const duct = (center, side) => {
      const m = solid(shell(center, zt0, c.z1, wall, 12, side), gasSideMaterial(liner), part, mid + side * rc, 50);
      // Gaz tarafı: dış duvarda iç yüz (r = outerT), iç duvarda dış yüz (r = innerT)
      markGasSide(m.geometry, (r, z) => side * (r - center(z)) < wall / 2);
      return m;
    };
    group.add(duct(outerT, 1), duct(innerT, -1));
  }
  // Swirler kapları: her kutunun kubbesinde
  const cupR = rc * 0.32;
  const cupL = cupR * 0.9;
  const cup = new THREE.CylinderGeometry(cupR, cupR * 1.08, cupL, low ? 10 : 20, 1, true);
  cup.rotateX(Math.PI / 2);
  cup.translate(0, mid, c.zDome - cupL / 2);
  group.add(atCanRing(cup, metal, N, 0, part));
  return {
    // Bujiler gömleğe iner: kutu-halkada kap yok, gömleğin dışı
    outerR: () => mid + rc * (shared ? 1.0 : 1.16),
    dR0: mid - rc * 0.75,
    dR1: mid + rc * 0.75,
    cowlLen: L * 0.12,
    cupR,
    cupL,
  };
}

/**
 * Kutu-halka geçiş parçası: kutu çıkışındaki daireden (yarıçap a0, eksen
 * ortalama yarıçapta) NGV girişindeki halka dilimine (göbek–uç, ~2π/N açı)
 * yumuşak geçen kalınlıklı kabuk. Kesit süperelips: üs 2'den (daire) 10'a
 * (köşeleri yuvarlak dikdörtgen). Kapalı katı (dış + iç yüzey + iki uç
 * halkası): kesitte dolu görünür. Geometri +Y ekseninde tek kutu için;
 * örnekleme ile çevreye dizilir.
 */
function transitionPiece(c, { mid, a0, z0, z1, N, t, nu, nt }) {
  const rcE = (c.exHub + c.exTip) / 2;
  const aE = (c.exTip - c.exHub) / 2 + t;
  // Komşu parçalarla aralarında ince bir yarık kalır (gerçekte yan contalar)
  const bE = (Math.PI / N) * 0.97 * rcE;
  const P = [];
  const UV = [];
  const section = (u, off) => {
    const k = smooth(u);
    const rcU = lerp(mid, rcE, k);
    const a = lerp(a0, aE, k) - off;
    const b = lerp(a0, bE, k) - off;
    const p = lerp(2, 10, Math.pow(k, 0.7));
    const z = lerp(z0, z1, u);
    for (let j = 0; j < nt; j++) {
      const th = (j / nt) * Math.PI * 2;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const X = a * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / p);
      const Y = b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p);
      const r = rcU + X;
      const phi = Y / rcU;
      P.push(r * Math.sin(phi), r * Math.cos(phi), z);
      UV.push(j / nt, u);
    }
  };
  for (let i = 0; i <= nu; i++) section(i / nu, 0);
  for (let i = 0; i <= nu; i++) section(i / nu, t);
  const outer = (i, j) => i * nt + (j % nt);
  const inner = (i, j) => (nu + 1) * nt + i * nt + (j % nt);
  const I = [];
  // a=(i,j) b=(i,j+1) c=(i+1,j) d=(i+1,j+1); flip: normal (c−a)×(b−a)
  const quad = (a, b, cc, d, flip) => (flip ? I.push(a, cc, b, b, cc, d) : I.push(a, b, cc, b, d, cc));
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nt; j++) {
      quad(outer(i, j), outer(i, j + 1), outer(i + 1, j), outer(i + 1, j + 1), true); // dışa
      quad(inner(i, j), inner(i, j + 1), inner(i + 1, j), inner(i + 1, j + 1), false); // boşluğa
    }
  }
  for (let j = 0; j < nt; j++) {
    quad(outer(0, j), outer(0, j + 1), inner(0, j), inner(0, j + 1), false); // −z
    quad(outer(nu, j), outer(nu, j + 1), inner(nu, j), inner(nu, j + 1), true); // +z
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  // Alev tarafı: boşluğa bakan iç yüzey (ikinci köşe takımı); dış yüzey
  // iç kasadaki soğuk kompresör havasına bakar
  const gas = new Float32Array(P.length / 3);
  gas.fill(1, (nu + 1) * nt);
  g.setAttribute('gasSide', new THREE.BufferAttribute(gas, 1));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/** Gömlek shader'ına alev (gaz) tarafını bildiren köşe özniteliği: isGas(r, z) */
function markGasSide(geo, isGas) {
  const p = geo.attributes.position;
  const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = isGas(Math.hypot(p.getX(i), p.getY(i)), p.getZ(i)) ? 1 : 0;
  geo.setAttribute('gasSide', new THREE.BufferAttribute(a, 1));
  return geo;
}

const gasSideCache = new WeakMap();

/**
 * Gömlek malzemesinin alev tarafını köşe özniteliğinden (`gasSide`) alan
 * kopyası. Gömlek shader'ı (materials/engine.ts linerSurface) alev tarafını
 * yerel konum ve normalden kestirir: halka gömlekte ve kendi ekseninde
 * kurulan kutu gömleğinde doğru, ama motor ekseni çerçevesinde kurulan
 * kutu geçiş parçalarında ve kanallarında ters yüzü (iç kasaya bakan soğuk
 * yüzü) parlatıyordu. Adı aynı (`combustorGlow`): görsel T4 parlaması
 * (engine/visual.ts) bunu da sürer. Kütüphane malzemesi başına bir kopya.
 */
function gasSideMaterial(liner) {
  let m = gasSideCache.get(liner);
  if (m) return m;
  m = clonePatched(liner);
  addPatch(m, 'liner-gas-side', (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float gasSide;\nvarying float vLGas;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLGas = gasSide;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLGas;')
      .replace(/float lFlame = [^;]*;/, 'float lFlame = step(0.5, vLGas);');
  });
  gasSideCache.set(liner, m);
  return m;
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
