/**
 * Yüksek ayrıntılı kanat geometrisi (M2).
 *
 * Bir kanat dört bölgeden oluşur ve tek bir BufferGeometry'de birleştirilir:
 *
 *   1. Profil gövdesi (airfoil): kesit, kamber çizgisinin giriş/çıkış metal
 *      açılarıyla tanımlanır (φ(s) = β₁ → β₂). Böylece hem az dönüşlü
 *      kompresör kanatları (20–40°) hem de çok dönüşlü türbin kanatları
 *      (100°+) aynı üreticiden çıkar. Kalınlık kamber çizgisine dik uygulanır;
 *      hücum kenarı yuvarlak, firar kenarı sonlu kalınlıkta ve yuvarlatılmış.
 *      Kökte dolgu yarıçapı (fillet): kesit platforma doğru kalınlaşır.
 *   2. Platform: kanat aralığı genişliğinde, kademe halkasını kesintisiz
 *      döşeyen eğik (paralelkenar) plaka.
 *   3. Kök: kompresörde kırlangıç kuyruğu (dovetail), türbinde gövde (shank)
 *      + sızdırmazlık kanatçıkları + üç dişli çam ağacı (fir-tree). Diskin
 *      jantına gömülüdür; kesitte görünür.
 *   4. Uç: HP türbinde "squealer" cep (çevre duvarı + çukur taban), LP
 *      türbinde iki bıçak contalı Z-kilitli uç örtüsü (shroud), kompresörde
 *      hafif pahlı kare uç.
 *
 * Nitelikler:
 *   uv     u = profil çevresi (0 firar/emme → 0.5 hücum → 1 firar/basınç),
 *          v = açıklık (0 kök → 1 uç). Delik ve erozyon desenleri bunu kullanır.
 *   uv1    metre ölçekli (tarama dokuları için): u = yay uzunluğu, v = yarıçap
 *   aZone  0 = profil, 1 = platform/kök, 2 = uç ayrıntısı
 *
 * Yerel eksenler (bladeRow ile uyumlu): +Y radyal, +Z eksenel (egzoza),
 * +X teğetsel. Kanat, dönüş ekseni Z olan bir halkaya kopyalanır.
 */

import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const asFn = (v) => (typeof v === 'function' ? v : Array.isArray(v) ? (t) => lerp(v[0], v[1], t) : () => v);

/** Kalite seviyesine göre çözünürlük */
export const BLADE_LOD = {
  low: { sections: 0.5, samples: 0.5, roots: false },
  medium: { sections: 0.8, samples: 0.75, roots: true },
  high: { sections: 1, samples: 1, roots: true },
};
let lod = BLADE_LOD.high;
export function setBladeQuality(q) {
  lod = BLADE_LOD[q] ?? BLADE_LOD.high;
}

/**
 * 2B kesit: kamber çizgisi açılarla, kalınlık normal yönde.
 * Dönüş: [ [z, x] … ] kapalı kontur (firar → emme yüzü → hücum → basınç yüzü → firar)
 * ve her noktanın u koordinatı. z eksenel, x teğetsel; kord uzunluğu 1.
 *
 * @param n        yüz başına örnek (hücum kenarında kosinüs sıklaştırması)
 * @param b1, b2   giriş/çıkış metal açısı (rad, eksenel yönden teğetsel yöne)
 * @param tmax     en büyük kalınlık / kord
 * @param te       firar kenarı kalınlığı / kord
 * @param xt       en büyük kalınlığın kord üzerindeki konumu
 */
export function bladeSection(n, b1, b2, tmax, te = 0.012, xt = 0.35) {
  // Kamber çizgisi: açı s boyunca yumuşak geçişle değişir
  const M = 64;
  const cam = [[0, 0]];
  const ang = [];
  let z = 0;
  let x = 0;
  for (let i = 0; i <= M; i++) {
    const s = i / M;
    const w = s * s * (3 - 2 * s) * 0.35 + s * 0.65;
    ang.push(lerp(b1, b2, w));
    if (i > 0) {
      const a = (ang[i] + ang[i - 1]) / 2;
      z += Math.cos(a) / M;
      x += Math.sin(a) / M;
      cam.push([z, x]);
    }
  }
  // Kord uzunluğu 1'e ölçekle (LE → TE doğrusu)
  const L = Math.hypot(z, x);
  for (const p of cam) {
    p[0] /= L;
    p[1] /= L;
  }
  const at = (s) => {
    const f = s * M;
    const i = Math.min(M - 1, Math.floor(f));
    const k = f - i;
    return [lerp(cam[i][0], cam[i + 1][0], k), lerp(cam[i][1], cam[i + 1][1], k), lerp(ang[i], ang[i + 1], k)];
  };
  // Kalınlık dağılımı: hücumda sqrt ile yuvarlak, xt'de en kalın, firarda te
  const thick = (s) => {
    const a = Math.sqrt(Math.max(s, 0)) * (1 - s);
    const peak = Math.sqrt(xt) * (1 - xt);
    let t = (tmax * a) / peak;
    // en kalın noktadan sonra doğrusala yakın incelme
    if (s > xt) t = lerp(tmax, te, Math.pow((s - xt) / (1 - xt), 1.15));
    return Math.max(t, te * s);
  };
  const up = [];
  const lo = [];
  for (let i = 0; i <= n; i++) {
    const s = 0.5 * (1 - Math.cos((i / n) * Math.PI));
    const [cz, cx, a] = at(s);
    const h = thick(s) / 2;
    // normal (kamber çizgisine dik): (-sin a, cos a) → (z, x)
    const nz = -Math.sin(a);
    const nx = Math.cos(a);
    up.push([cz + nz * h, cx + nx * h]);
    lo.push([cz - nz * h, cx - nx * h]);
  }
  // Firar kenarı yuvarlatma: yarım daire
  const [tz, tx, ta] = at(1);
  const r = te / 2;
  const cap = [];
  const k = 4;
  for (let j = 1; j < k; j++) {
    const phi = Math.PI / 2 - (j / k) * Math.PI;
    cap.push([tz + Math.cos(ta) * Math.cos(phi) * r - Math.sin(ta) * Math.sin(phi) * r, tx + Math.sin(ta) * Math.cos(phi) * r + Math.cos(ta) * Math.sin(phi) * r]);
  }
  // Kontur: firar(emme) → hücum → firar(basınç) → firar yarım daire
  const pts = [];
  for (let i = n; i >= 0; i--) pts.push(up[i]);
  for (let i = 1; i <= n; i++) pts.push(lo[i]);
  for (const c of cap.reverse()) pts.push(c);
  // u: yay uzunluğuna göre (0 → 1)
  const us = [0];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    us.push(acc);
  }
  const perim = acc + Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  // hücum kenarı noktası u = 0.5 olsun: iki yarıyı ayrı ayrı normalle
  const le = n;
  const uu = us.map((s, i) => (i <= le ? (s / us[le]) * 0.5 : 0.5 + ((s - us[le]) / (perim - us[le])) * 0.5));
  return { pts, u: uu, le, perim };
}

/** Kapalı 2B çokgenin iç yöne ofseti (normaller boyunca, kalınlık sınırıyla) */
function insetContour(pts, w) {
  const n = pts.length;
  const out = [];
  // alan işareti (saat yönü)
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = pts[i];
    const [c, d] = pts[(i + 1) % n];
    area += a * d - b * c;
  }
  const s = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const [pz, px] = pts[(i - 1 + n) % n];
    const [nz, nx] = pts[(i + 1) % n];
    let tz = nz - pz;
    let tx = nx - px;
    const l = Math.hypot(tz, tx) || 1;
    tz /= l;
    tx /= l;
    // iç normal
    out.push([pts[i][0] - s * tx * w, pts[i][1] + s * tz * w]);
  }
  return out;
}

/**
 * Tam kanat: profil gövdesi + (isteğe bağlı) platform, kök ve uç ayrıntısı.
 *
 * opts:
 *   hub, tip           kök/uç yarıçapı (m)
 *   chord              kord (m): sayı, [kök, uç] ya da t → kord
 *   beta1, beta2       giriş/çıkış metal açısı (rad): sayı, [kök, uç] ya da fonksiyon
 *   tmax, te, xt       kalınlık parametreleri (kord oranı)
 *   sweep, lean        eksenel/teğetsel yığılma kayması (m), t → m
 *   sections, samples  çözünürlük (LOD ile ölçeklenir)
 *   count              kademedeki kanat sayısı (platform ve uç örtüsü genişliği)
 *   fillet             kök dolgu yüksekliği (açıklık oranı)
 *   platform           { depth, over } | null
 *   root               'dovetail' | 'firtree' | null
 *   tipType            'squealer' | 'shroud' | 'plain'
 *   rootDepth          kökün jant içindeki derinliği (m)
 */
export function createBlade(opts) {
  const {
    hub,
    tip,
    count = 40,
    fillet = 0.045,
    platform = { depth: 0.035, over: 0.12 },
    root = null,
    tipType = 'plain',
    rootDepth = null,
    tipRound = 0,
  } = opts;
  const fChord = asFn(opts.chord ?? 0.1);
  const fB1 = asFn(opts.beta1 ?? 0.6);
  const fB2 = asFn(opts.beta2 ?? 0.2);
  const fT = asFn(opts.tmax ?? 0.08);
  const fTe = asFn(opts.te ?? 0.012);
  const fXt = asFn(opts.xt ?? 0.38);
  const fSweep = asFn(opts.sweep ?? 0);
  const fLean = asFn(opts.lean ?? 0);
  const sections = Math.max(4, Math.round((opts.sections ?? 14) * lod.sections));
  const samples = Math.max(8, Math.round((opts.samples ?? 24) * lod.samples));
  const span = tip - hub;

  const P = [];
  const UV = [];
  const UV1 = [];
  const Z = [];
  const I = [];
  const push = (x, y, z, u, v, u1, v1, zone) => {
    P.push(x, y, z);
    UV.push(u, v);
    UV1.push(u1, v1);
    Z.push(zone);
    return P.length / 3 - 1;
  };

  // Açıklık dağılımı: kök ve uçta sık (dolgu ve uç ayrıntısı için)
  const ts = [];
  for (let j = 0; j < sections; j++) {
    const a = j / (sections - 1);
    ts.push(0.85 * (0.5 - 0.5 * Math.cos(a * Math.PI)) + 0.15 * a);
  }
  ts[0] = 0;
  ts[ts.length - 1] = 1;
  // Kökte dolgu için ek kesitler (0 < t < fillet)
  const extra = lod === BLADE_LOD.low ? [] : [fillet * 0.15, fillet * 0.4, fillet * 0.75];
  const tList = [...new Set([...ts, ...extra])].sort((a, b) => a - b);

  /** Dünya (yerel) konumu: kesit noktası (kz, kx) kord biriminde → (x, y, z) */
  const sectionAt = (t, inset = 0) => {
    const c = fChord(t);
    const r = lerp(hub, tip, t);
    const b1 = fB1(t);
    const b2 = fB2(t);
    // dolgu: kökte kalınlık ve kord büyür
    const fl = t < fillet ? Math.pow(1 - t / fillet, 2) : 0;
    const tm = fT(t) * (1 + 0.55 * fl);
    const sec = bladeSection(samples, b1, b2, tm, fTe(t) * (1 + 1.2 * fl), fXt(t));
    let pts = sec.pts;
    if (inset > 0) pts = insetContour(pts, inset / c);
    // yığılma: ağırlık merkezi yaklaşık kordun %40'ı; kamber çizgisi orta noktası
    let mz = 0;
    let mx = 0;
    for (const p of sec.pts) {
      mz += p[0];
      mx += p[1];
    }
    mz /= sec.pts.length;
    mx /= sec.pts.length;
    const cs = c * (1 + 0.07 * fl);
    const tipScale = tipRound > 0 && t > 1 - tipRound ? Math.sqrt(Math.max(0.05, 1 - Math.pow((t - (1 - tipRound)) / tipRound, 2))) : 1;
    const out = pts.map(([pz, px]) => {
      const z = (pz - mz) * cs * tipScale + fSweep(t);
      const x = (px - mx) * cs * tipScale + fLean(t);
      // silindirik yüzeye sar: teğetsel x → açı; bu sayede kanat halkaya oturur
      const th = x / r;
      return [Math.sin(th) * r, Math.cos(th) * r, z];
    });
    return { out, u: sec.u, perim: sec.perim * cs, r };
  };

  // --- profil gövdesi ---
  const rings = [];
  let ringSize = 0;
  for (const t of tList) {
    const s = sectionAt(t);
    ringSize = s.out.length;
    const idx = s.out.map(([x, y, z], i) => push(x, y, z, s.u[i], t, s.u[i] * s.perim, s.r, 0));
    rings.push(idx);
  }
  for (let j = 0; j < rings.length - 1; j++) {
    const a = rings[j];
    const b = rings[j + 1];
    for (let i = 0; i < ringSize; i++) {
      const i2 = (i + 1) % ringSize;
      I.push(a[i], b[i], a[i2], a[i2], b[i], b[i2]);
    }
  }

  // Kapak: basit yelpaze (kök, platformun altında kalır)
  const fan = (ring, flip, zone, center) => {
    let cx = 0, cy = 0, cz = 0;
    for (const k of ring) {
      cx += P[k * 3];
      cy += P[k * 3 + 1];
      cz += P[k * 3 + 2];
    }
    const n = ring.length;
    const c = center ?? push(cx / n, cy / n, cz / n, 0.5, zone === 2 ? 1 : 0, 0, 0, zone);
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      if (flip) I.push(c, ring[i2], ring[i]);
      else I.push(c, ring[i], ring[i2]);
    }
    return c;
  };
  fan(rings[0], false, 1);

  // --- uç ---
  const topRing = rings[rings.length - 1];
  if (tipType === 'squealer' && lod !== BLADE_LOD.low) {
    // çevre duvarı: dış konturdan içe ofset, çukur taban
    const wall = Math.max(0.0012, span * 0.018);
    const depth = Math.max(0.002, span * 0.03);
    const top = sectionAt(1, wall);
    const inner = top.out.map(([x, y, z], i) => push(x, y, z, top.u[i], 1, 0, 0, 2));
    // üst rim: dış → iç
    for (let i = 0; i < ringSize; i++) {
      const i2 = (i + 1) % ringSize;
      I.push(topRing[i], inner[i], topRing[i2], topRing[i2], inner[i], inner[i2]);
    }
    // iç duvar aşağı
    const floor = inner.map((k) => {
      const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
      const rr = Math.hypot(x, y);
      const f = (rr - depth) / rr;
      return push(x * f, y * f, z, UV[k * 2], 0.97, 0, 0, 2);
    });
    for (let i = 0; i < ringSize; i++) {
      const i2 = (i + 1) % ringSize;
      I.push(inner[i], floor[i], inner[i2], inner[i2], floor[i], floor[i2]);
    }
    fan(floor, true, 2);
  } else {
    fan(topRing, true, 2);
  }

  const rMid = (hub + tip) / 2;
  // Kanadın eksenel kapsamı (platform ve örtü boyutu için)
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const k of rings[0]) {
    zMin = Math.min(zMin, P[k * 3 + 2]);
    zMax = Math.max(zMax, P[k * 3 + 2]);
  }
  const pitchAng = (Math.PI * 2) / count;
  // Kök kesitinin kord doğrusu eğimi (hücum → firar): platform kenarları
  // buna paralel kayar, böylece eğik kanat izi platformun içinde kalır
  const rootSec = sectionAt(0);
  const leP = rootSec.out[samples];
  const teP = rootSec.out[0];
  const leX = Math.atan2(leP[0], leP[1]) * hub;
  const teX = Math.atan2(teP[0], teP[1]) * hub;
  const stagger = Math.atan2(teX - leX, teP[2] - leP[2]);
  const xMid = (leX + teX) / 2;

  /** Silindirik (θ, z) dörtgen plaka: r0 → r1 kalınlık; θ kenarları z ile kayar */
  const sectorPlate = (r0, r1, z0, z1, a0, a1, skew, zone, segs = 6) => {
    const base = [];
    const rows = [];
    for (const [r, face] of [[r1, 0], [r0, 1]]) {
      const row = [];
      for (let i = 0; i <= segs; i++) {
        const ta = i / segs;
        for (const [zz, sk] of [[z0, -skew], [z1, skew]]) {
          const a = lerp(a0, a1, ta) + sk / r;
          row.push(push(Math.sin(a) * r, Math.cos(a) * r, zz, ta, face, a * r, zz, zone));
        }
      }
      rows.push(row);
    }
    const [top, bot] = rows;
    for (let i = 0; i < segs; i++) {
      const a = 2 * i;
      const b = 2 * (i + 1);
      // üst yüz (dışa) ve alt yüz (içe)
      I.push(top[a], top[a + 1], top[b], top[b], top[a + 1], top[b + 1]);
      I.push(bot[a], bot[b], bot[a + 1], bot[b], bot[b + 1], bot[a + 1]);
      // ön (z0) ve arka (z1) kenarlar
      I.push(top[a], top[b], bot[a], bot[a], top[b], bot[b]);
      I.push(top[a + 1], bot[a + 1], top[b + 1], top[b + 1], bot[a + 1], bot[b + 1]);
    }
    // yan kenarlar (θ uçları)
    const e = 2 * segs;
    I.push(top[0], bot[0], top[1], top[1], bot[0], bot[1]);
    I.push(top[e], top[e + 1], bot[e], bot[e], top[e + 1], bot[e + 1]);
    base.push(top, bot);
    return base;
  };

  /** 2B (x teğetsel, y radyal) çokgeni z boyunca uzatır (kök profilleri) */
  const extrude = (poly, z0, z1, zone) => {
    const n = poly.length;
    const f = poly.map(([x, y]) => push(x, y, z0, 0, 0, x, z0, zone));
    const b = poly.map(([x, y]) => push(x, y, z1, 0, 0, x, z1, zone));
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      I.push(f[i], b[i], f[i2], f[i2], b[i], b[i2]);
    }
    // uç kapakları: dışbükey olmayan profiller (çam ağacı) için üçgenleme
    const tris = THREE.ShapeUtils.triangulateShape(poly.map(([x, y]) => new THREE.Vector2(x, y)), []);
    const ccw = !THREE.ShapeUtils.isClockWise(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const [a, b2, c] of tris) {
      if (ccw) {
        I.push(f[a], f[c], f[b2]);
        I.push(b[a], b[b2], b[c]);
      } else {
        I.push(f[a], f[b2], f[c]);
        I.push(b[a], b[c], b[b2]);
      }
    }
  };

  if (platform) {
    const over = (zMax - zMin) * platform.over;
    const pd = Math.max(0.002, span * platform.depth);
    const skew = (Math.tan(stagger) * (zMax - zMin + 2 * over)) / 2;
    const a0 = xMid / hub - pitchAng / 2;
    sectorPlate(hub - pd, hub, zMin - over, zMax + over, a0, a0 + pitchAng, skew, 1);

    if (root && lod.roots) {
      const rd = rootDepth ?? span * 0.45;
      const ax = (zMax - zMin) * 0.9;
      const zc = (zMin + zMax) / 2;
      const w = Math.min(hub * pitchAng * 0.55, (zMax - zMin) * 0.5);
      const yTop = hub - pd;
      if (root === 'dovetail') {
        // boyun + kırlangıç kuyruğu (x, y)
        const neck = w * 0.45;
        const foot = w * 0.95;
        const y1 = yTop - rd * 0.45;
        const y2 = yTop - rd;
        extrude(
          [
            [-neck, yTop + 0.0005],
            [-neck, y1],
            [-foot, y1 - (y1 - y2) * 0.45],
            [-foot * 0.8, y2],
            [foot * 0.8, y2],
            [foot, y1 - (y1 - y2) * 0.45],
            [neck, y1],
            [neck, yTop + 0.0005],
          ],
          zc - ax / 2,
          zc + ax / 2,
          1,
        );
      } else if (root === 'firtree') {
        // gövde (shank) + üç dişli çam ağacı
        const shankH = rd * 0.45;
        const sw = w * 0.32;
        const yS = yTop - shankH;
        const treeH = rd - shankH;
        const pts = [[-sw, yTop + 0.0005], [-sw, yS]];
        const teeth = 3;
        for (let k = 0; k < teeth; k++) {
          const f = 1 - k / (teeth + 0.5);
          const y0 = yS - (treeH * k) / teeth;
          const y1 = y0 - treeH / teeth;
          pts.push([-w * 0.62 * f - sw * 0.4, y0 - (y0 - y1) * 0.3], [-sw * f * 0.8, y0 - (y0 - y1) * 0.75]);
          if (k === teeth - 1) pts.push([-sw * 0.5, y1]);
        }
        const mirror = pts.slice().reverse().map(([x, y]) => [-x, y]);
        extrude([...pts, ...mirror], zc - ax / 2, zc + ax / 2, 1);
        // sızdırmazlık kanatçıkları (angel wings): gövdenin ön/arka yüzünde
        const wingY = yTop - shankH * 0.4;
        for (const s of [-1, 1]) {
          const zz = zc + s * ax * 0.5;
          extrude(
            [
              [-hub * pitchAng * 0.46, wingY + span * 0.01],
              [-hub * pitchAng * 0.46, wingY],
              [hub * pitchAng * 0.46, wingY],
              [hub * pitchAng * 0.46, wingY + span * 0.01],
            ],
            s < 0 ? zz - ax * 0.1 : zz,
            s < 0 ? zz : zz + ax * 0.1,
            1,
          );
        }
      }
    }
  }

  // LP türbin uç örtüsü: Z-kilit plaka + iki bıçak conta
  if (tipType === 'shroud') {
    const sh = Math.max(0.0015, span * 0.028);
    const over = (zMax - zMin) * 0.08;
    const skew = Math.tan(fB2(1)) * (zMax - zMin) * 0.2;
    sectorPlate(tip, tip + sh, zMin - over, zMax + over, -pitchAng / 2, pitchAng / 2, skew, 2);
    if (lod !== BLADE_LOD.low) {
      for (const f of [0.28, 0.72]) {
        const zz = lerp(zMin, zMax, f);
        sectorPlate(tip + sh, tip + sh + span * 0.07, zz - span * 0.006, zz + span * 0.006, -pitchAng / 2, pitchAng / 2, 0, 2, 4);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setAttribute('uv1', new THREE.Float32BufferAttribute(UV1, 2));
  geo.setAttribute('aZone', new THREE.Float32BufferAttribute(Z, 1));
  geo.setIndex(I);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.userData.bladeInfo = { hub, tip, zMin, zMax, rMid, count };
  return geo;
}
