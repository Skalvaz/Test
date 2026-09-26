/**
 * Kanat (airfoil) geometrisi üretimi.
 *
 * Kanatlar NACA 4-haneli kalınlık dağılımı + dairesel kamber çizgisi ile
 * kesit kesit üretilir, ardından kanat boyunca burulma (twist), ok açısı
 * (sweep), yana yatma (lean) ve kord/kalınlık değişimi uygulanarak loft edilir.
 *
 * Yerel eksen düzeni:
 *   +Y → kanat açıklığı (radyal, kökten uca)
 *   +Z → eksenel (kord yönü referansı)
 *   +X → teğetsel (kalınlık yönü referansı)
 */

import * as THREE from 'three';

/** NACA 4-haneli kalınlık dağılımı (kapalı arka kenar katsayısı ile). */
function thicknessDist(x, t) {
  return (
    (t / 0.2) *
    (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x)
  );
}

/** Kamber çizgisi ve eğimi. */
function camberLine(x, m, p) {
  if (m === 0) return [0, 0];
  if (x < p) {
    const yc = (m / (p * p)) * (2 * p * x - x * x);
    const dy = ((2 * m) / (p * p)) * (p - x);
    return [yc, dy];
  }
  const q = 1 - p;
  const yc = (m / (q * q)) * (1 - 2 * p + 2 * p * x - x * x);
  const dy = ((2 * m) / (q * q)) * (p - x);
  return [yc, dy];
}

/**
 * Kapalı kesit konturu üretir: arka kenardan üst yüzey boyunca hücum kenarına,
 * oradan alt yüzeyden arka kenara. Kosinüs aralığı sayesinde hücum kenarında
 * örnek yoğunluğu yüksektir (keskin ışık yansıması için).
 */
export function airfoilSection(samples, thickness, camber, camberPos = 0.4) {
  const n = Math.max(8, Math.floor(samples / 2));
  const upper = [];
  const lower = [];
  for (let i = 0; i <= n; i++) {
    const beta = (i / n) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta)); // 0 → 1, uçlarda sık
    const yt = thicknessDist(x, thickness);
    const [yc, dy] = camberLine(x, camber, camberPos);
    const theta = Math.atan(dy);
    upper.push([x - yt * Math.sin(theta), yc + yt * Math.cos(theta)]);
    lower.push([x + yt * Math.sin(theta), yc - yt * Math.cos(theta)]);
  }
  // Arka kenar → üst → hücum kenarı → alt → arka kenar (kapalı döngü)
  const contour = [];
  for (let i = n; i >= 0; i--) contour.push(upper[i]);
  for (let i = 1; i <= n; i++) contour.push(lower[i]);
  return contour;
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Loft ile kanat gövdesi üretir.
 *
 * Bütün dağılım parametreleri t ∈ [0,1] (kök→uç) alan fonksiyonlar veya
 * [kökDeğeri, uçDeğeri] çiftleri olabilir.
 */
export function createBladeGeometry(opts = {}) {
  const {
    hubRadius = 0.35,
    tipRadius = 1.6,
    sections = 26,
    samples = 90,
    chord = [0.55, 0.95],
    twist = [THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(14)],
    thickness = [0.14, 0.035],
    camber = [0.055, 0.015],
    sweep = (t) => -0.35 * Math.pow(t, 2.2) + 0.12 * Math.pow(t, 6), // geriye ok + uçta öne kıvrım
    lean = (t) => 0.06 * Math.sin(t * Math.PI),
    chordAnchor = 0.35,
    tipRound = 0.06,
  } = opts;

  const asFn = (v) => (typeof v === 'function' ? v : (t) => lerp(v[0], v[1], t));
  const fChord = asFn(chord);
  const fTwist = asFn(twist);
  const fThick = asFn(thickness);
  const fCamber = asFn(camber);
  const fSweep = asFn(sweep);
  const fLean = asFn(lean);

  const contourCache = [];
  const positions = [];
  const uvs = [];
  const indices = [];

  const ring = airfoilSection(samples, 0.1, 0).length; // kontur nokta sayısı

  for (let j = 0; j < sections; j++) {
    const t = j / (sections - 1);
    const r = lerp(hubRadius, tipRadius, t);
    const c = fChord(t);
    const tw = fTwist(t);
    const th = fThick(t);
    const cb = fCamber(t);
    const sw = fSweep(t);
    const ln = fLean(t);

    // Uçta kanat profilini hafifçe küçültüp yuvarlatarak keskin köşe bırakmayız
    const tipScale = t > 1 - tipRound ? Math.sqrt(Math.max(0, 1 - Math.pow((t - (1 - tipRound)) / tipRound, 2))) : 1;

    const contour = airfoilSection(samples, th, cb);
    contourCache.push(contour);

    const cosT = Math.cos(tw);
    const sinT = Math.sin(tw);

    for (let i = 0; i < contour.length; i++) {
      const [cx, cy] = contour[i];
      const pz = (cx - chordAnchor) * c * tipScale;
      const px = cy * c * tipScale;
      const z = pz * cosT - px * sinT + sw;
      const x = pz * sinT + px * cosT + ln;
      positions.push(x, r, z);
      uvs.push(i / (contour.length - 1), t);
    }
  }

  const perRing = contourCache[0].length;
  for (let j = 0; j < sections - 1; j++) {
    for (let i = 0; i < perRing; i++) {
      const i2 = (i + 1) % perRing;
      const a = j * perRing + i;
      const b = j * perRing + i2;
      const c = (j + 1) * perRing + i;
      const d = (j + 1) * perRing + i2;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Kök ve uç kapakları
  const capCenter = (jIndex) => {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < perRing; i++) {
      cx += positions[(jIndex * perRing + i) * 3];
      cy += positions[(jIndex * perRing + i) * 3 + 1];
      cz += positions[(jIndex * perRing + i) * 3 + 2];
    }
    return [cx / perRing, cy / perRing, cz / perRing];
  };

  const addCap = (jIndex, reverse) => {
    const [cx, cy, cz] = capCenter(jIndex);
    const centerIndex = positions.length / 3;
    positions.push(cx, cy, cz);
    uvs.push(0.5, jIndex === 0 ? 0 : 1);
    for (let i = 0; i < perRing; i++) {
      const i2 = (i + 1) % perRing;
      const a = jIndex * perRing + i;
      const b = jIndex * perRing + i2;
      if (reverse) indices.push(centerIndex, b, a);
      else indices.push(centerIndex, a, b);
    }
  };
  addCap(0, true);
  addCap(sections - 1, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Kompresör / türbin gibi kısa kanatlar için pratik sarmalayıcı.
 */
export function createStageBladeGeometry(hubR, tipR, opts = {}) {
  return createBladeGeometry({
    hubRadius: hubR,
    tipRadius: tipR,
    sections: opts.sections ?? 7,
    samples: opts.samples ?? 26,
    chord: opts.chord ?? [0.2, 0.17],
    twist: opts.twist ?? [THREE.MathUtils.degToRad(48), THREE.MathUtils.degToRad(22)],
    thickness: opts.thickness ?? [0.12, 0.07],
    camber: opts.camber ?? [0.06, 0.04],
    sweep: opts.sweep ?? ((t) => -0.02 * t),
    lean: opts.lean ?? (() => 0),
    tipRound: 0.12,
  });
}
