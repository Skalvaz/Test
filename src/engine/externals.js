/**
 * Motor dış donanımı: kaportasız motorların gerçekçi görünmesini sağlayan
 * tesisat ve aksesuarlar.
 *
 * Her şey motor gövdesinin yarıçap profiline (r(z)) göre yerleştirilir:
 * borular gövdeyi belli bir aralıkla izler ve kelepçe/braketlerle bağlanır,
 * hiçbir parça havada durmaz ya da gövdenin içinden geçmez.
 *
 * Gerçek motorlardaki karşılıkları:
 *  - değişken stator kanadı (VSV) halkaları: gövde üzerindeki kol dizisi,
 *    kolları birlikte çeviren "unison" halka ve hidrolik aktüatör
 *  - yakıt manifoldu ve "pigtail" borular: her enjektöre giden S kıvrımlı hat
 *  - ateşleyici bujileri, yüksek gerilim kabloları ve uyarıcı kutusu
 *  - kablo demetleri: sıkı demetlenmiş, aralıklı kelepçeli kablolar
 *  - aksesuar dişli kutusu: gövdenin altına oturan, gövde eğrisini izleyen
 *    döküm alüminyum muhafaza; üzerinde pompalar, jeneratör, marş motoru
 *  - yağ tankı, motor kontrol ünitesi (FADEC), boroskop tapaları
 *
 * Küçük parçalar (kelepçe, rakor, aktüatör, ateşleyici, pompalar, tank,
 * kontrol ünitesi…) Blender'da modellenmiş kit kütüphanesinden gelir
 * (`mats.kit`, bkz. kit.js); burada yalnız yerleşimleri hesaplanır. Borular,
 * halkalar ve dişli kutusu muhafazası gövdeye göre şekillendiği için
 * prosedürel kalır.
 */

import * as THREE from 'three';
import { tagPart, boxUV } from './geom.js';
import { surface } from './kit.js';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Parçalı doğrusal yarıçap profili. pts: [[r, z], …] (z artan)
 * @returns {(z: number) => number}
 */
export function radiusProfile(pts) {
  return (z) => {
    if (z <= pts[0][1]) return pts[0][0];
    for (let i = 1; i < pts.length; i++) {
      if (z <= pts[i][1]) {
        const [r0, z0] = pts[i - 1];
        const [r1, z1] = pts[i];
        return lerp(r0, r1, (z - z0) / Math.max(z1 - z0, 1e-6));
      }
    }
    return pts[pts.length - 1][0];
  };
}

/** Silindirik koordinattan (açı, yarıçap, z) noktaya */
const polar = (a, r, z) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);

/**
 * Gövdeyi izleyen boru: açı a0'dan a1'e yumuşakça döner, gövde yüzeyinden
 * `gap` kadar yukarıda kalır; aralıklı kelepçe ve braketlerle bağlanır.
 */
export function hugPipe(group, prof, o) {
  const { a0, a1 = a0, z0, z1, rad = 0.012, gap = 0.012, mat, part = 'gearbox', clampEvery = 0.32 } = o;
  const n = Math.max(12, Math.round(Math.abs(z1 - z0) / 0.05));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const z = lerp(z0, z1, t);
    const a = lerp(a0, a1, smooth(t));
    pts.push(polar(a, prof(z) + gap + rad, z));
  }
  // Uçlar gövdeye dik kıvrılarak bir bağlantı rakoruna girer
  const first = pts[0];
  const last = pts[pts.length - 1];
  const inward = (p) => p.clone().setLength(Math.hypot(p.x, p.y) - gap - rad * 0.2).setZ(p.z);
  pts.unshift(inward(first));
  pts.push(inward(last));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, n * 3, rad, 10, false), mat);
  group.add(tagPart(mesh, part));
  const kit = o.noFittings ? null : o.kit;
  const k = rad / 0.012;
  // Rakorlar: boru gövdeye dik girer, B-somunlu bağlantı + kaynaklı pabuç
  for (const p of [first, last]) {
    const a = Math.atan2(p.y, p.x);
    kit?.add('bNut', surface(a, prof(p.z), p.z, { scale: k }), part);
  }
  // Kelepçeler: yastıklı P-kelepçe, gerekirse gövdeye inen ayak
  const count = Math.floor(Math.abs(z1 - z0) / clampEvery);
  const tip = new THREE.Vector3();
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const z = lerp(z0, z1, t);
    const a = lerp(a0, a1, smooth(t));
    const r = prof(z);
    const tangent = curve.getTangentAt(Math.min(0.999, t * (n / (n + 2)) + 1 / (n + 2)));
    // Yerel X = −teğet yön; yaw = boru doğrultusunun eksene göre açısı
    tip.set(Math.sin(a), -Math.cos(a), 0);
    const yaw = Math.atan2(tangent.dot(tip), tangent.z);
    kit?.add('pClamp', surface(a, r + gap + rad, z, { yaw, scale: k }), part);
    const h = gap + rad - 0.027 * k;
    if (h > 0.004) kit?.add('standoff', surface(a, r, z, { yaw, scale: [1, h / 0.03, 1] }), part);
  }
  return mesh;
}

/**
 * Kablo demeti: birbirine yakın 3–4 ince kablo, aralıklı siyah kelepçeler.
 */
export function harness(group, prof, o) {
  const { a0, a1 = a0, z0, z1, gap = 0.018, count = 3, mat, part = 'gearbox', kit } = o;
  const spread = 0.012;
  for (let c = 0; c < count; c++) {
    const da = ((c - (count - 1) / 2) * spread) / Math.max(prof(z0), 0.2);
    hugPipe(group, prof, {
      a0: a0 + da,
      a1: a1 + da,
      z0,
      z1,
      rad: 0.0055,
      gap: gap + (c % 2) * 0.006,
      mat,
      part,
      clampEvery: 99,
      noFittings: true,
    });
  }
  // Demet kelepçeleri (yastıklı bant, gövdeye cıvatalı)
  const n = Math.floor(Math.abs(z1 - z0) / 0.22);
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    const z = lerp(z0, z1, t);
    const a = lerp(a0, a1, smooth(t));
    kit?.add('harnessClamp', surface(a, prof(z) + gap + 0.006, z, { scale: [0.9, 0.9, 1] }), part);
  }
}

/**
 * Değişken stator kanadı (VSV) halkası: gövdede her kanat için bir yuva ve
 * kol, kolların uçlarını birleştiren halka, halkayı çeviren aktüatör.
 */
export function vsvStage(group, prof, z, count, mats, part = 'hpc') {
  const r = prof(z);
  // Her kanat mili için yuva + kol; kollar birleştirme halkasına uzanır
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    mats.kit?.at('vsvBoss', a, r, z, {}, part);
    mats.kit?.at('vsvLever', a, r + 0.0165, z, { yaw: 0.35 }, part);
  }
  // Unison halka
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.022, 0.0055, 6, 128), mats.ring);
  ring.position.z = z + 0.047;
  group.add(tagPart(ring, part));
}

/** VSV aktüatörü: gövdeye bağlı hidrolik silindir, rodu halkaları birleştiren kola */
export function vsvActuator(group, prof, zs, angle, mats, part = 'hpc') {
  const z0 = Math.min(...zs) - 0.12;
  const z1 = Math.max(...zs) + 0.1;
  const H = 0.07; // silindir ekseninin gövdeden yüksekliği
  const L = Math.min(0.32, (z1 - z0) * 0.45);
  const sz = L / 0.2;
  const cz = z0 + 0.03 + L / 2;
  const kit = mats.kit;
  kit?.at('actuator', angle, prof(cz) + H, cz, { scale: [1, 1, sz] }, part);
  kit?.at('actuatorRod', angle, prof(cz) + H, cz + L / 2 - 0.01, {}, part);
  // Muylu ayağı (silindirin arka ucu) ve rod ucunu taşıyan çatal
  const zt = cz - L / 2 + 0.018 * sz;
  kit?.at('mountFoot', angle, prof(zt), zt, { scale: [1.1, H / 0.045, 1] }, part);
  // Halkaları birleştiren "bellcrank" kiriş
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, z1 - z0), mats.lever);
  beam.position.copy(polar(angle + 0.12, prof((z0 + z1) / 2) + 0.035, (z0 + z1) / 2));
  beam.rotation.z = angle + 0.12 - Math.PI / 2;
  group.add(tagPart(beam, part));
  // Kiriş ayakları
  for (const zz of [z0 + 0.04, z1 - 0.04]) kit?.at('bracketL', angle + 0.12, prof(zz), zz - 0.028, { scale: [1, 0.85, 1] }, part);
}

/**
 * Yakıt manifoldu: yanma odası gövdesini saran halka ve her enjektöre
 * inen S kıvrımlı "pigtail" borular.
 */
export function fuelManifold(group, prof, z, count, mats, part = 'combustor') {
  const r = prof(z);
  const ringR = r + 0.055;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.011, 8, 160), mats.pipe);
  ring.position.z = z - 0.05;
  group.add(tagPart(ring, part));
  // Tek pigtail: halkadan çıkar, geri kıvrılır, enjektör rakoruna iner
  const pig = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, ringR, -0.05),
    new THREE.Vector3(0.01, ringR - 0.002, -0.02),
    new THREE.Vector3(-0.006, r + 0.05, 0.012),
    new THREE.Vector3(0, r + 0.034, 0.03),
  ]);
  const pigGeo = new THREE.TubeGeometry(pig, 16, 0.0045, 6, false);
  const pigs = new THREE.InstancedMesh(pigGeo, mats.pipe, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2);
    m.compose(new THREE.Vector3(0, 0, z), q, new THREE.Vector3(1, 1, 1));
    pigs.setMatrixAt(i, m);
    // Enjektör montaj flanşı (iki cıvatalı) — pigtail ucu rakoruna oturur
    mats.kit?.at('injectorFlange', a, r, z + 0.03, { yaw: Math.PI / 2 }, part);
  }
  group.add(tagPart(pigs, part));
  // Halkayı taşıyan braketler
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.1;
    mats.kit?.at('bracketL', a, r, z - 0.078, { scale: [1, 1.35, 1] }, part);
  }
}

/** Ateşleyici bujisi + yüksek gerilim kablosu + uyarıcı (exciter) kutusu */
export function igniters(group, prof, z, angles, boxZ, mats, part = 'combustor') {
  for (const a of angles) {
    const r = prof(z);
    mats.kit?.at('igniter', a, r, z, {}, part);
    // Uyarıcı kutusu (gövdenin yanında, yalıtımlı ayaklar üzerinde)
    const rb = prof(boxZ) + 0.047;
    mats.kit?.at('exciter', a + 0.35, rb, boxZ, {}, part);
    // Örgülü yüksek gerilim kablosu: bujiden kutunun ön konnektörüne
    const lead = new THREE.CatmullRomCurve3([
      polar(a, r + 0.096, z),
      polar(a + 0.06, r + 0.12, lerp(z, boxZ, 0.35)),
      polar(a + 0.3, rb + 0.01, boxZ - 0.12),
      polar(a + 0.35 + 0.02 / rb, rb, boxZ - 0.095),
    ]);
    group.add(tagPart(new THREE.Mesh(new THREE.TubeGeometry(lead, 28, 0.008, 8, false), mats.braid), part));
  }
}

/** Boroskop tapaları: gövde üzerinde altıgen başlı küçük tapalar */
export function borescopePorts(group, prof, zs, angle, mats, part = 'casing') {
  for (const z of zs) mats.kit?.at('borescope', angle, prof(z), z, {}, part === 'casing' ? 'fanCase' : part);
}

/**
 * Aksesuar dişli kutusu: gövdenin altına oturan, gövde eğrisini izleyen
 * muz biçimli döküm muhafaza ve üzerindeki aksesuarlar.
 */
export function accessoryGearbox(group, prof, o, mats, part = 'gearbox') {
  const { z0, len, arc = 1.1, depth = 0.14, center = -Math.PI / 2 } = o;
  const r = prof(z0 + len / 2) + 0.012;
  // Kesit: gövdeye paralel yay biçimli kutu (kısmi lathe)
  const shape = [
    new THREE.Vector2(r, z0 + 0.03),
    new THREE.Vector2(r + depth * 0.9, z0),
    new THREE.Vector2(r + depth, z0 + 0.05),
    new THREE.Vector2(r + depth, z0 + len - 0.05),
    new THREE.Vector2(r + depth * 0.9, z0 + len),
    new THREE.Vector2(r, z0 + len - 0.03),
  ];
  const geo = new THREE.LatheGeometry(shape, 40, 0, arc);
  geo.rotateX(Math.PI / 2);
  // LatheGeometry φ = 0 → +Z (dönüş sonrası −Y); merkezi istenen açıya getir
  geo.rotateZ(center + Math.PI / 2 - arc / 2);
  geo.computeVertexNormals();
  const housing = new THREE.Mesh(boxUV(geo), mats.castKit ?? mats.cast);
  group.add(tagPart(housing, part));
  // Yan kapaklar
  for (const e of [0, arc]) {
    const cap = new THREE.Mesh(boxUV(new THREE.BoxGeometry(0.012, depth, len * 0.96)), mats.castKit ?? mats.cast);
    const a = center - arc / 2 + e;
    cap.position.copy(polar(a, r + depth / 2, z0 + len / 2));
    cap.rotation.z = a - Math.PI / 2;
    group.add(tagPart(cap, part));
  }
  // Aksesuarlar: dişli kutusunun dış yüzüne radyal monte (kit parçaları;
  // nominal gövde R 0.06, boy 0.145 m)
  for (const acc of o.accessories ?? []) {
    const a = center + acc.da;
    const s = acc.r / 0.06;
    mats.kit?.at(acc.kind ?? 'pump', a, r + depth, acc.z, { scale: [s, acc.h / 0.145, s], yaw: acc.yaw ?? 0 }, part);
  }
  // Yağ filtresi ve tahliye valfi (kutunun yan yüzeyinde)
  mats.kit?.at('oilFilter', center + arc * 0.42, r + depth * 0.7, z0 + len * 0.45, { roll: 0.5 }, part);
  mats.kit?.at('drainValve', center, r + depth, z0 + len * 0.08, {}, part);
  // Kule mili muhafazası: dişli kutusunu gövdeye bağlar
  const tower = new THREE.Mesh(boxUV(new THREE.CylinderGeometry(0.03, 0.036, 0.06, 14)), mats.castKit ?? mats.cast);
  tower.position.copy(polar(center, r - 0.02, z0 + len * 0.3));
  tower.rotation.z = center - Math.PI / 2;
  group.add(tagPart(tower, part));
}

/** Yağ tankı: kayışlarla gövdeye bağlı, gözetleme camlı */
export function oilTank(group, prof, o, mats, part = 'gearbox') {
  const { a, z, len = 0.34, r = 0.075 } = o;
  const s = r / 0.075;
  // Kit tankının ayakları merkezin 105 mm altında gövdeye iner
  mats.kit?.at('oilTank', a, prof(z) + 0.105 * s, z, { scale: [s, s, len / 0.34] }, part);
}

/** Motor kontrol ünitesi (FADEC): kanatçıklı kutu, konnektörler, kablolar */
export function controlUnit(group, prof, o, mats, part = 'gearbox') {
  const { a, z, w = 0.22, h = 0.08, d = 0.3 } = o;
  const sy = h / 0.08;
  // Kit kutusunun yalıtım ayakları merkezin 58 mm altında
  mats.kit?.at('fadec', a, prof(z) + 0.058 * sy, z, { scale: [w / 0.22, sy, d / 0.3] }, part);
}

/**
 * Motor gövdesi üzerindeki küçük donanım: sıcaklık sondaları (türbin
 * çıkışı çevresinde), kaldırma kulakları, flanş cıvataları.
 */
export function probes(prof, z, count, mats, phase = 0.2, part = 'lpt') {
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    mats.kit?.at('probe', a, prof(z), z, {}, part);
  }
}

export function liftLugs(prof, zs, mats, angle = Math.PI / 2, part = 'fanCase') {
  for (const z of zs) mats.kit?.at('liftLug', angle, prof(z), z, {}, part);
}

/** Flanş cıvata halkası: önde cıvata başları, arkada somunlar */
export function flangeBolts(r, z, count, mats, thick = 0.012, part = 'fanCase') {
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI * 2;
    mats.kit?.at('flangeBolt', a, r, z - thick, { pitch: -Math.PI / 2 }, part);
    mats.kit?.at('flangeBolt', a, r, z + thick, { pitch: Math.PI / 2 }, part);
  }
}
