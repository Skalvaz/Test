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
 */

import * as THREE from 'three';
import { tagPart } from './geom.js';

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
  const { a0, a1 = a0, z0, z1, rad = 0.012, gap = 0.012, mat, clampMat, part = 'gearbox', clampEvery = 0.32 } = o;
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
  // Rakorlar (altıgen somun) iki uçta
  const nut = new THREE.CylinderGeometry(rad * 1.8, rad * 1.8, rad * 2.4, 6);
  for (const p of [first, last]) {
    const m = new THREE.Mesh(nut, clampMat ?? mat);
    m.position.copy(p).setLength(Math.hypot(p.x, p.y) - gap * 0.5).setZ(p.z);
    m.lookAt(0, 0, p.z);
    m.rotateX(Math.PI / 2);
    group.add(tagPart(m, part));
  }
  // Kelepçe: boruyu saran bant + gövdeye inen braket
  const count = Math.floor(Math.abs(z1 - z0) / clampEvery);
  const band = new THREE.TorusGeometry(rad * 1.35, rad * 0.35, 6, 12);
  for (let k = 1; k <= count; k++) {
    const t = k / (count + 1);
    const z = lerp(z0, z1, t);
    const a = lerp(a0, a1, smooth(t));
    const r = prof(z);
    const tangent = curve.getTangentAt(Math.min(0.999, (k / (count + 1)) * (n / (n + 2)) + 1 / (n + 2)));
    const c = new THREE.Mesh(band, clampMat ?? mat);
    c.position.copy(polar(a, r + gap + rad, z));
    c.lookAt(c.position.clone().add(tangent));
    group.add(tagPart(c, part));
    const br = new THREE.Mesh(new THREE.BoxGeometry(rad * 1.2, gap + rad, rad * 1.4), clampMat ?? mat);
    br.position.copy(polar(a, r + (gap + rad) * 0.5, z));
    br.rotation.z = a - Math.PI / 2;
    group.add(tagPart(br, part));
  }
  return mesh;
}

/**
 * Kablo demeti: birbirine yakın 3–4 ince kablo, aralıklı siyah kelepçeler.
 */
export function harness(group, prof, o) {
  const { a0, a1 = a0, z0, z1, gap = 0.018, count = 3, mat, clampMat, part = 'gearbox' } = o;
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
      clampMat: mat,
      part,
      clampEvery: 99,
    });
  }
  // Demet kelepçeleri
  const n = Math.floor(Math.abs(z1 - z0) / 0.22);
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    const z = lerp(z0, z1, t);
    const a = lerp(a0, a1, smooth(t));
    const cl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.018), clampMat);
    cl.position.copy(polar(a, prof(z) + gap + 0.006, z));
    cl.rotation.z = a - Math.PI / 2;
    group.add(tagPart(cl, part));
  }
}

/**
 * Değişken stator kanadı (VSV) halkası: gövdede her kanat için bir yuva ve
 * kol, kolların uçlarını birleştiren halka, halkayı çeviren aktüatör.
 */
export function vsvStage(group, prof, z, count, mats, part = 'hpc') {
  const r = prof(z);
  // Kanat mili yuvaları (gövde üzerinde)
  const boss = new THREE.CylinderGeometry(0.009, 0.011, 0.016, 8);
  boss.translate(0, r + 0.008, 0);
  const bosses = new THREE.InstancedMesh(boss, mats.metal, count);
  // Kollar: yuvadan halkaya eğik uzanır
  const lever = new THREE.BoxGeometry(0.008, 0.005, 0.05);
  lever.translate(0, r + 0.02, 0.022);
  const levers = new THREE.InstancedMesh(lever, mats.lever, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
    m.compose(new THREE.Vector3(0, 0, z), q, new THREE.Vector3(1, 1, 1));
    bosses.setMatrixAt(i, m);
    const q2 = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.35));
    m.compose(new THREE.Vector3(0, 0, z), q2, new THREE.Vector3(1, 1, 1));
    levers.setMatrixAt(i, m);
  }
  group.add(tagPart(bosses, part), tagPart(levers, part));
  // Unison halka
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.024, 0.0055, 6, 128), mats.ring);
  ring.position.z = z + 0.045;
  group.add(tagPart(ring, part));
}

/** VSV aktüatörü: gövdeye bağlı hidrolik silindir, rodu halkaları birleştiren kola */
export function vsvActuator(group, prof, zs, angle, mats, part = 'hpc') {
  const z0 = Math.min(...zs) - 0.12;
  const z1 = Math.max(...zs) + 0.1;
  const r = prof((z0 + z1) / 2) + 0.07;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, (z1 - z0) * 0.55, 16), mats.metal);
  body.rotation.x = Math.PI / 2;
  body.position.copy(polar(angle, r, z0 + (z1 - z0) * 0.3));
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, (z1 - z0) * 0.5, 8), mats.ring);
  rod.rotation.x = Math.PI / 2;
  rod.position.copy(polar(angle, r, z0 + (z1 - z0) * 0.72));
  // Halkaları birleştiren "bellcrank" kiriş
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, z1 - z0), mats.lever);
  beam.position.copy(polar(angle + 0.12, prof((z0 + z1) / 2) + 0.035, (z0 + z1) / 2));
  group.add(tagPart(body, part), tagPart(rod, part), tagPart(beam, part));
  // Montaj ayakları
  for (const zz of [z0 + 0.05, z0 + (z1 - z0) * 0.55]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), mats.metal);
    foot.position.copy(polar(angle, prof(zz) + 0.03, zz));
    foot.rotation.z = angle - Math.PI / 2;
    group.add(tagPart(foot, part));
  }
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
  // Tek pigtail: halkadan çıkar, geri kıvrılır, enjektör flanşına iner
  const pig = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, ringR, -0.05),
    new THREE.Vector3(0.01, ringR - 0.004, -0.015),
    new THREE.Vector3(-0.008, r + 0.03, 0.01),
    new THREE.Vector3(0, r + 0.012, 0.03),
  ]);
  const pigGeo = new THREE.TubeGeometry(pig, 16, 0.0045, 6, false);
  const pigs = new THREE.InstancedMesh(pigGeo, mats.pipe, count);
  const flange = new THREE.CylinderGeometry(0.018, 0.02, 0.014, 10);
  flange.translate(0, r + 0.006, 0.03);
  const flanges = new THREE.InstancedMesh(flange, mats.metal, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ((i + 0.5) / count) * Math.PI * 2);
    m.compose(new THREE.Vector3(0, 0, z), q, new THREE.Vector3(1, 1, 1));
    pigs.setMatrixAt(i, m);
    flanges.setMatrixAt(i, m);
  }
  group.add(tagPart(pigs, part), tagPart(flanges, part));
  // Halkayı taşıyan braketler
  const br = new THREE.BoxGeometry(0.012, 0.05, 0.02);
  br.translate(0, r + 0.028, -0.05);
  const brackets = new THREE.InstancedMesh(br, mats.metal, 8);
  for (let i = 0; i < 8; i++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i / 8) * Math.PI * 2 + 0.1);
    m.compose(new THREE.Vector3(0, 0, z), q, new THREE.Vector3(1, 1, 1));
    brackets.setMatrixAt(i, m);
  }
  group.add(tagPart(brackets, part));
}

/** Ateşleyici bujisi + yüksek gerilim kablosu + uyarıcı (exciter) kutusu */
export function igniters(group, prof, z, angles, boxZ, mats, part = 'combustor') {
  for (const a of angles) {
    const r = prof(z);
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.07, 12), mats.metal);
    plug.position.copy(polar(a, r + 0.035, z));
    plug.rotation.z = a - Math.PI / 2;
    group.add(tagPart(plug, part));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 12), mats.anodized);
    cap.position.copy(polar(a, r + 0.075, z));
    cap.rotation.z = a - Math.PI / 2;
    group.add(tagPart(cap, part));
    // Uyarıcı kutusu (gövdenin yanında, braketli)
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.16), mats.box);
    const rb = prof(boxZ) + 0.06;
    box.position.copy(polar(a + 0.35, rb, boxZ));
    box.rotation.z = a + 0.35 - Math.PI / 2;
    group.add(tagPart(box, part));
    // Örgülü yüksek gerilim kablosu
    const lead = new THREE.CatmullRomCurve3([
      polar(a, r + 0.09, z),
      polar(a + 0.15, r + 0.11, lerp(z, boxZ, 0.4)),
      polar(a + 0.33, rb + 0.02, boxZ - 0.07),
    ]);
    group.add(tagPart(new THREE.Mesh(new THREE.TubeGeometry(lead, 24, 0.009, 8, false), mats.braid), part));
  }
}

/** Boroskop tapaları: gövde üzerinde altıgen başlı küçük tapalar */
export function borescopePorts(group, prof, zs, angle, mats, part = 'casing') {
  for (const z of zs) {
    const r = prof(z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 6), mats.metal);
    p.position.copy(polar(angle, r + 0.008, z));
    p.rotation.z = angle - Math.PI / 2;
    group.add(tagPart(p, part === 'casing' ? 'fanCase' : part));
  }
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
  const housing = new THREE.Mesh(geo, mats.cast);
  group.add(tagPart(housing, part));
  // Yan kapaklar
  for (const e of [0, arc]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.012, depth, len * 0.96), mats.cast);
    const a = center - arc / 2 + e;
    cap.position.copy(polar(a, r + depth / 2, z0 + len / 2));
    cap.rotation.z = a - Math.PI / 2;
    group.add(tagPart(cap, part));
  }
  // Aksesuarlar: dişli kutusunun dış yüzüne radyal monte
  const list = o.accessories ?? [];
  for (const acc of list) {
    const a = center + acc.da;
    const base = polar(a, r + depth, acc.z);
    const body = new THREE.Group();
    body.position.copy(base);
    body.rotation.z = a - Math.PI / 2;
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(acc.r * 1.15, acc.r * 1.15, 0.015, 20), mats.metal);
    flange.position.y = 0.008;
    const can = new THREE.Mesh(new THREE.CylinderGeometry(acc.r, acc.r * 0.94, acc.h, 24), acc.mat ? mats[acc.mat] : mats.cast);
    can.position.y = 0.015 + acc.h / 2;
    body.add(flange, can);
    // Soğutma kanatçıkları (jeneratör/marş motoru)
    if (acc.fins) {
      for (let k = 0; k < 5; k++) {
        const fin = new THREE.Mesh(new THREE.TorusGeometry(acc.r * 1.02, 0.004, 4, 24), mats.cast);
        fin.rotation.x = Math.PI / 2;
        fin.position.y = 0.03 + (k / 5) * acc.h * 0.8;
        body.add(fin);
      }
    }
    // Uç kapak ve bağlantı
    const endCap = new THREE.Mesh(new THREE.CylinderGeometry(acc.r * 0.55, acc.r * 0.7, 0.03, 16), mats.metal);
    endCap.position.y = 0.015 + acc.h + 0.015;
    body.add(endCap);
    group.add(tagPart(body, part));
  }
  // Kule mili muhafazası: dişli kutusunu gövdeye bağlar
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.06, 14), mats.cast);
  tower.position.copy(polar(center, r - 0.02, z0 + len * 0.3));
  tower.rotation.z = center - Math.PI / 2;
  group.add(tagPart(tower, part));
}

/** Yağ tankı: kayışlarla gövdeye bağlı, gözetleme camlı */
export function oilTank(group, prof, o, mats, part = 'gearbox') {
  const { a, z, len = 0.34, r = 0.075 } = o;
  const rr = prof(z) + r + 0.03;
  const tank = new THREE.Group();
  tank.position.copy(polar(a, rr, z));
  tank.rotation.z = a - Math.PI / 2;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mats.tank);
  body.rotation.x = Math.PI / 2;
  tank.add(body);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), mats.glass);
  glass.position.set(r * 0.72, 0, 0);
  glass.rotation.z = Math.PI / 2;
  tank.add(glass);
  const filler = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), mats.anodized);
  filler.position.set(0, r + 0.01, -len * 0.3);
  tank.add(filler);
  for (const dz of [-len * 0.3, len * 0.3]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(r + 0.003, 0.005, 6, 24), mats.metal);
    strap.position.z = dz;
    tank.add(strap);
  }
  group.add(tagPart(tank, part));
}

/** Motor kontrol ünitesi (FADEC): kanatçıklı kutu, konnektörler, kablolar */
export function controlUnit(group, prof, o, mats, part = 'gearbox') {
  const { a, z, w = 0.22, h = 0.08, d = 0.3 } = o;
  const r = prof(z) + h / 2 + 0.03;
  const unit = new THREE.Group();
  unit.position.copy(polar(a, r, z));
  unit.rotation.z = a - Math.PI / 2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.box);
  unit.add(box);
  for (let k = 0; k < 7; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.012, 0.006), mats.box);
    fin.position.set(0, h / 2 + 0.006, -d / 2 + 0.03 + (k * (d - 0.06)) / 6);
    unit.add(fin);
  }
  for (let k = 0; k < 4; k++) {
    const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), mats.anodized);
    conn.rotation.x = Math.PI / 2;
    conn.position.set(-w / 2 + 0.035 + k * ((w - 0.07) / 3), 0, d / 2 + 0.014);
    unit.add(conn);
  }
  // Titreşim sönümleyici ayaklar
  for (const [x, zz] of [[-w / 2 + 0.02, -d / 2 + 0.03], [w / 2 - 0.02, -d / 2 + 0.03], [-w / 2 + 0.02, d / 2 - 0.03], [w / 2 - 0.02, d / 2 - 0.03]]) {
    const iso = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), mats.rubber);
    iso.position.set(x, -h / 2 - 0.012, zz);
    unit.add(iso);
  }
  group.add(tagPart(unit, part));
}
