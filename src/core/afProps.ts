/**
 * Havaalanı donanımı: Poly Haven (CC0) modelleri — beton bariyerler, tel
 * çit, elektrik direkleri, jeneratör, kompresör, sandıklar, variller,
 * yangın musluğu, elektrik panoları, klimalar, örtülü araçlar — ve hücre
 * modellerinin (alet arabası, raflar…) açık hangar içinde yeniden kullanımı.
 *
 * Tekrarlanan modeller (bariyer, direk, çit) InstancedMesh ile çizilir.
 * Tel çit panelleri, Poly Haven çitinin tel malzemesiyle (alfa dokulu)
 * basit dörtgenlerden kurulur: 400+ panelin gerçek geometrisi milyonlarca
 * üçgen ederdi.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { heightAt } from './terrain';

const afUrls = import.meta.glob('../assets/afprops/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const cellUrls = import.meta.glob('../assets/props/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const urlOf = (id: string) => afUrls[`../assets/afprops/${id}.glb`] ?? cellUrls[`../assets/props/${id}.glb`];

const FLOOR = -2.4;
const deg = THREE.MathUtils.degToRad;

type P = [number, number]; // x, z
interface Item {
  id: string;
  at: P;
  rot?: number;
  y?: number; // zeminden yükseklik
  scale?: number;
  tilt?: [number, number]; // x, z ekseni etrafında eğim (derece)
}

/* ------------------------------------------------------------------ */
/* Yerleşim                                                            */
/* ------------------------------------------------------------------ */

const ITEMS: Item[] = [
  // Motor çalıştırma alanı çevresi: yer güç ünitesi, kompresör, alet arabası
  { id: 'portable_generator', at: [-10.6, -2.2], rot: 80 },
  { id: 'old_military_compressor', at: [-11.4, 3.2], rot: 90 },
  { id: 'tool_cart', at: [9.6, 1.6], rot: -100 },
  { id: 'korean_fire_extinguisher_01', at: [9.3, -6.6], rot: -60 },
  { id: 'korean_fire_extinguisher_01', at: [-9.4, -7.2], rot: 70 },
  { id: 'Barrel_01', at: [11.6, -10.0], rot: 10 },
  { id: 'Barrel_01', at: [12.2, -10.6], rot: 70 },
  { id: 'Barrel_01', at: [11.4, -10.95], rot: 150 },
  { id: 'wooden_military_crate', at: [-12.6, -8.0], rot: 10 },
  { id: 'wooden_military_crate', at: [-12.5, -8.05], rot: 12, y: 0.465 },
  { id: 'wooden_crate_01', at: [-12.3, -9.6], rot: -5 },
  { id: 'cardboard_box_01', at: [10.9, 4.7], rot: 20 },
  { id: 'cardboard_box_01', at: [11.3, 5.3], rot: 65 },
  { id: 'metal_jerrycan', at: [-10.0, -4.1], rot: 5 },
  { id: 'metal_jerrycan', at: [-10.25, -4.45], rot: 15 },
  { id: 'metal_jerrycan', at: [-9.75, -4.45], rot: -8 },
  { id: 'metal_tool_chest', at: [9.9, 2.1], rot: -95, y: 0.965 },
  // Rögar kapakları
  { id: 'water_manhole_cover', at: [21, -41] },
  { id: 'water_manhole_cover', at: [-31, 31] },
  { id: 'water_manhole_cover', at: [36, 22] },
  { id: 'water_manhole_cover', at: [3, -52] },
  { id: 'water_manhole_cover', at: [75.5, -30] },
  // Yangın musluğu
  { id: 'fire_hydrant', at: [-50.6, -56.5], rot: 90 },
  { id: 'fire_hydrant', at: [-50.6, 44.5], rot: 90 },
  { id: 'fire_hydrant', at: [80.5, -60.5], rot: -90 },
  { id: 'fire_hydrant', at: [80.5, 24], rot: -90 },
  { id: 'fire_hydrant', at: [-2, -75.5] },
  // Hangar dış duvarları: elektrik panoları, projektörler, çöp kutuları
  { id: 'utility_box_02', at: [-70, -52.75], rot: 180 },
  { id: 'utility_box_01', at: [-66.5, -52.75], rot: 180 },
  { id: 'utility_box_02', at: [-72, 40.75] },
  { id: 'security_light', at: [-55.5, -52.35], rot: 180, y: 5.2 },
  { id: 'security_light', at: [-80, -52.35], rot: 180, y: 5.2 },
  { id: 'security_light', at: [-55.5, 40.35], y: 5.2 },
  { id: 'security_light', at: [-80, 40.35], y: 5.2 },
  { id: 'metal_trash_can', at: [-60.5, -53.4], rot: 180 },
  { id: 'metal_trash_can', at: [79.6, -77.8], rot: -90 },
  { id: 'metal_trash_can', at: [80.8, -2.0], rot: -90 },
  { id: 'ladder_sectioned_01', at: [-75.5, 40.45], tilt: [-12, 0] },
  // Operasyon binası ve kule binası klimaları
  { id: 'exterior_aircon_unit', at: [120.45, -86], rot: 90, y: 0.05 },
  { id: 'exterior_aircon_unit', at: [120.45, -90], rot: 90, y: 0.05 },
  { id: 'exterior_aircon_unit', at: [120.45, -94], rot: 90, y: 3.9 },
  { id: 'exterior_aircon_unit', at: [114.5, -53.4], rot: 180, y: 0.05 },
  { id: 'exterior_aircon_unit', at: [110.5, -53.4], rot: 180, y: 3.9 },
  { id: 'utility_box_02', at: [100.4, -80.4] },
  // İtfaiye arkası: lastik yığını, variller
  { id: 'old_tyre', at: [105.2, -24.5], tilt: [90, 0] },
  { id: 'old_tyre', at: [105.25, -24.45], tilt: [90, 0], y: 0.165 },
  { id: 'old_tyre', at: [105.2, -24.55], tilt: [90, 0], y: 0.33 },
  { id: 'old_tyre', at: [105.1, -23.6], rot: 30 },
  { id: 'barrel_03', at: [105.4, -21.5] },
  { id: 'barrel_03', at: [105.5, -20.8], rot: 40 },
  // Açık hangar (A) içi: raflar, arabalar, sandıklar, variller
  { id: 'steel_frame_shelves_01', at: [-86.5, -51.35], scale: 0.1 },
  { id: 'steel_frame_shelves_01', at: [-85.3, -51.35], scale: 0.1 },
  { id: 'steel_frame_shelves_01', at: [-80.5, -51.35], scale: 0.1 },
  { id: 'steel_frame_shelves_01', at: [-79.3, -51.35], scale: 0.1 },
  { id: 'industrial_storage_cart', at: [-62, -46.5], rot: 30 },
  { id: 'tool_cart', at: [-64, -13.5], rot: 200 },
  { id: 'portable_welding_cart', at: [-70.5, -12.2], rot: 160 },
  { id: 'hand_truck', at: [-66.5, -50.8], rot: 10 },
  { id: 'metal_tool_chest', at: [-74.0, -51.2] },
  { id: 'barrel_03', at: [-84.2, -14.2] },
  { id: 'barrel_03', at: [-84.9, -14.8], rot: 50 },
  { id: 'barrel_03', at: [-84.1, -15.4], rot: 100 },
  { id: 'wooden_military_crate', at: [-82, -48.8], rot: 90 },
  { id: 'wooden_military_crate', at: [-82, -48.8], rot: 92, y: 0.465 },
  { id: 'wooden_military_crate', at: [-80.6, -48.8], rot: 88 },
  { id: 'korean_fire_extinguisher_01', at: [-53.2, -51.4], rot: 180 },
  { id: 'korean_fire_extinguisher_01', at: [-53.2, -8.6] },
  { id: 'portable_generator', at: [-58.5, -40], rot: 200 },
  { id: 'ladder_sectioned_01', at: [-68.5, -51.5], tilt: [-10, 0] },
];

/** Tekrarlanan modeller: InstancedMesh (x, z, dönüş°) */
function barrierRow(from: P, to: P, step: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const L = Math.hypot(dx, dz);
  const rot = (Math.atan2(dx, dz) * 180) / Math.PI - 90;
  for (let s = 0; s <= L; s += step) out.push([from[0] + (dx * s) / L, from[1] + (dz * s) / L, rot + (((s * 7.31) % 1) - 0.5) * 3]);
  return out;
}

/** Global Hawk yönü (model burnu yerel −z'de: +x'e çevir) ve takozlar */
const GH_YAW = -Math.PI / 2;
const GH_CHOCKS: P[] = [];

const CARS: [number, number, number][] = [
  [124.3, -97, 0], [129.5, -97, 2], [132.1, -97, -1], [140.0, -97, 1], [145.2, -97, 0],
  [126.9, -65, 180], [134.7, -65, 178], [137.3, -65, 181], [147.8, -65, 180],
];

/** Tel çit hattı: köşe noktaları (kapı boşlukları hat bölünerek bırakılır) */
const FENCE_LINES: P[][] = [
  [[-150, 110], [-150, -128], [128, -128]],
  [[144, -128], [200, -128], [200, 110]],
];

/** Elektrik hattı: direk noktaları */
const POWER_LINE: P[] = [
  ...Array.from({ length: 8 }, (_, i) => [-150 + i * 42, -140] as P),
  [146, -140],
  ...Array.from({ length: 7 }, (_, i) => [146, -182 - i * 42] as P),
];

/* ------------------------------------------------------------------ */

function normalize(src: THREE.Object3D) {
  // Taban merkezi orijine: x/z ortası, y en alt
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const g = new THREE.Group();
  src.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  g.add(src);
  g.updateMatrixWorld(true);
  return g;
}

/** Modelin tüm ağlarını, verilen dönüşümlerle tek tek InstancedMesh yapar */
function instanced(model: THREE.Object3D, mats: THREE.Matrix4[], shadow = true) {
  const out: THREE.InstancedMesh[] = [];
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    const im = new THREE.InstancedMesh(geo, m.material, mats.length);
    mats.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    out.push(im);
  });
  return out;
}

function trs(x: number, y: number, z: number, rotY: number, s = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(s, s, s),
  );
}

/** Trafik konisi (turuncu, iki yansıtıcı bant) */
function makeCone() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8561b, roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.3, metalness: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
  const seg = (y0: number, y1: number, r0: number, r1: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 20, 1, true), mat);
    m.position.y = (y0 + y1) / 2;
    m.castShadow = true;
    g.add(m);
  };
  const r = (y: number) => 0.14 - (0.12 * y) / 0.7;
  seg(0.03, 0.3, r(0.03), r(0.3), orange);
  seg(0.3, 0.4, r(0.3), r(0.4), white);
  seg(0.4, 0.48, r(0.4), r(0.48), orange);
  seg(0.48, 0.56, r(0.48), r(0.56), white);
  seg(0.56, 0.7, r(0.56), 0.018, orange);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.38), black);
  base.position.y = 0.015;
  base.castShadow = true;
  g.add(base);
  return g;
}

export async function loadAirfieldProps(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'airfield-props';
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const ids = [
    ...new Set([
      ...ITEMS.map((i) => i.id),
      'concrete_road_barrier',
      'concrete_road_barrier_02',
      'covered_car',
      'global_hawk',
      'modular_chainlink_fence',
      'modular_electricity_poles',
    ]),
  ];
  const raw = new Map<string, THREE.Object3D>();
  await Promise.all(
    ids.map(async (id) => {
      const u = urlOf(id);
      if (!u) return;
      const gltf = await loader.loadAsync(u);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
      });
      raw.set(id, gltf.scene);
    }),
  );
  const models = new Map<string, THREE.Object3D>();
  for (const [id, scene] of raw) {
    if (id !== 'modular_chainlink_fence' && id !== 'modular_electricity_poles') models.set(id, normalize(scene));
  }

  // Tek tek yerleşen modeller
  for (const it of ITEMS) {
    const src = models.get(it.id);
    if (!src) continue;
    const o = src.clone();
    const [x, z] = it.at;
    o.position.set(x, FLOOR + (it.y ?? 0), z);
    o.rotation.set(deg(it.tilt?.[0] ?? 0), deg(it.rot ?? 0), deg(it.tilt?.[1] ?? 0), 'YXZ');
    if (it.tilt?.[0] === 90) {
      // yatık lastik: kalınlığın yarısı kadar kaldır
      o.position.y += 0.3 - 0.08;
    }
    o.scale.setScalar(it.scale ?? 1);
    group.add(o);
  }

  // Konik bariyerler, koniler
  const cone = makeCone();
  for (const [x, z] of [
    [-9.2, -15.2], [9.2, -15.2], [-9.2, 17.2], [9.2, 17.2], [-4, -16.2], [0, -16.2], [4, -16.2],
    [-8.4, 21], [8.4, 21],
  ] as P[]) {
    const c = cone.clone();
    c.position.set(x, FLOOR, z);
    c.rotation.y = x * 1.7;
    group.add(c);
  }

  // Beton bariyerler: yakıt sahası önü, otopark kenarı, depolanmış yığın
  const b1 = models.get('concrete_road_barrier');
  const b2 = models.get('concrete_road_barrier_02');
  if (b1 && b2) {
    const rows = [
      ...barrierRow([-34, -74.5], [10, -74.5], 1.6),
      ...barrierRow([121.5, -60], [121.5, -100], 1.6),
      ...barrierRow([-8.5, -64.5], [8.5, -64.5], 1.6),
    ];
    const a: THREE.Matrix4[] = [];
    const b: THREE.Matrix4[] = [];
    rows.forEach(([x, z, r], i) => (i % 3 === 2 ? b : a).push(trs(x, FLOOR, z, deg(r))));
    // Hangar B köşesinde istif
    for (let k = 0; k < 6; k++) a.push(trs(-96 + (k % 3) * 1.65, FLOOR, 44.5 + Math.floor(k / 3) * 1.1, deg(90 * 0 + (k % 2) * 2)));
    group.add(...instanced(b1, a), ...instanced(b2, b));
  }

  // Hangar B önünde park etmiş RQ-4 Global Hawk (NASA 3D Resources, kamu malı;
  // amblemsiz, askeri açık gri). Burnu apron'a bakar, tekerleklerde takoz.
  const gh = models.get('global_hawk');
  if (gh) {
    const body = new THREE.MeshStandardMaterial({ color: 0xa3a8ac, roughness: 0.42, metalness: 0.08 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.35, metalness: 0.2 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
    gh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const n = (m.material as THREE.Material).name;
      m.material = n.includes('rubber') ? rubber : n.includes('dark') ? dark : body;
    });
    const plane = gh.clone();
    plane.scale.setScalar(0.85);
    plane.position.set(-33, FLOOR, 18);
    plane.rotation.y = GH_YAW;
    group.add(plane);
    const chockMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.7 });
    const chock = new THREE.BoxGeometry(0.25, 0.14, 0.5);
    for (const [x, z] of GH_CHOCKS) {
      const c = new THREE.Mesh(chock, chockMat);
      c.position.set(x, FLOOR + 0.07, z);
      c.castShadow = true;
      group.add(c);
    }
  }

  // Örtülü araçlar (otopark)
  const car = models.get('covered_car');
  if (car) group.add(...instanced(car, CARS.map(([x, z, r]) => trs(x, FLOOR, z, deg(r)))));

  // Tel çit: Poly Haven tel malzemesi + basit dikmeler
  const fenceScene = raw.get('modular_chainlink_fence');
  if (fenceScene) group.add(buildFence(fenceScene));

  // Elektrik hattı: Poly Haven direk takımları + sarkık teller
  const poles = raw.get('modular_electricity_poles');
  if (poles) group.add(buildPowerLine(poles));
  return group;
}

function buildFence(scene: THREE.Object3D) {
  const g = new THREE.Group();
  g.name = 'fence';
  let wireMat: THREE.MeshStandardMaterial | null = null;
  let postMat: THREE.Material | null = null;
  let uvPerM = 1;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (/wire/.test(mat.name) && !wireMat) {
      wireMat = mat.clone();
      // Tel dokusunun metre başına UV'si (panel genişliği boyunca)
      const p = m.geometry.getAttribute('position');
      const uv = m.geometry.getAttribute('uv');
      let x0 = Infinity, x1 = -Infinity, u0 = Infinity, u1 = -Infinity;
      for (let i = 0; i < p.count; i++) {
        x0 = Math.min(x0, p.getX(i));
        x1 = Math.max(x1, p.getX(i));
        u0 = Math.min(u0, uv.getX(i));
        u1 = Math.max(u1, uv.getX(i));
      }
      uvPerM = (u1 - u0) / Math.max(x1 - x0, 0.1);
    }
    if (/posts/.test(mat.name) && !postMat) postMat = mat;
  });
  if (!wireMat) return g;
  const wm = wireMat as THREE.MeshStandardMaterial;
  wm.transparent = false;
  wm.alphaTest = 0.5;
  wm.side = THREE.DoubleSide;
  if (wm.map) {
    wm.map.wrapS = wm.map.wrapT = THREE.RepeatWrapping;
  }
  const pm = postMat ?? new THREE.MeshStandardMaterial({ color: 0x8a8d8f, metalness: 0.8, roughness: 0.45 });
  const H = 2.2;
  const pos: number[] = [];
  const uvs: number[] = [];
  const postMats: THREE.Matrix4[] = [];
  const rails: [THREE.Vector3, THREE.Vector3][] = [];
  const wires: number[] = [];
  for (const line of FENCE_LINES) {
    for (let k = 0; k < line.length - 1; k++) {
      const [ax, az] = line[k];
      const [bx, bz] = line[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(L / 3);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        const y0 = heightAt(x0, z0) + 0.05;
        const y1 = heightAt(x1, z1) + 0.05;
        const u0 = L * t0 * uvPerM, u1 = L * t1 * uvPerM;
        const v = H * uvPerM;
        pos.push(x0, y0, z0, x1, y1, z1, x1, y1 + H, z1, x0, y0, z0, x1, y1 + H, z1, x0, y0 + H, z0);
        uvs.push(u0, 0, u1, 0, u1, v, u0, 0, u1, v, u0, v);
        postMats.push(new THREE.Matrix4().makeTranslation(x0, y0 - 0.05, z0));
      }
      const yA = heightAt(ax, az), yB = heightAt(bx, bz);
      rails.push([new THREE.Vector3(ax, yA + H + 0.02, az), new THREE.Vector3(bx, yB + H + 0.02, bz)]);
      // Dikenli tel: üstte üç sıra, dışa eğik kollar üzerinde
      const nx = (bz - az) / L, nz = -(bx - ax) / L;
      for (let w = 0; w < 3; w++) {
        const o = 0.12 + w * 0.13;
        wires.push(ax + nx * o, yA + H + 0.1 + w * 0.12, az + nz * o, bx + nx * o, yB + H + 0.1 + w * 0.12, bz + nz * o);
      }
    }
    const [lx, lz] = line[line.length - 1];
    postMats.push(new THREE.Matrix4().makeTranslation(lx, heightAt(lx, lz), lz));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, wm);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.noAO = true;
  g.add(mesh);
  // Dikmeler (üstte dışa eğik kol)
  const post = new THREE.CylinderGeometry(0.045, 0.045, H + 0.45, 8);
  post.translate(0, (H + 0.45) / 2, 0);
  const posts = new THREE.InstancedMesh(post, pm, postMats.length);
  postMats.forEach((m, i) => posts.setMatrixAt(i, m));
  posts.castShadow = true;
  g.add(posts);
  // Üst boru
  for (const [a, b] of rails) {
    const L = a.distanceTo(b);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 6), pm);
    r.position.copy(a).add(b).multiplyScalar(0.5);
    r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(r);
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x4a4c4e })));
  return g;
}

function buildPowerLine(scene: THREE.Object3D) {
  const g = new THREE.Group();
  g.name = 'power-line';
  scene.updateMatrixWorld(true);
  // Üç hazır direk takımı: preset_01/02/03 → her biri ayrı model
  const presets: THREE.Group[] = [];
  for (const p of ['preset_01_', 'preset_02_', 'preset_03_']) {
    const nodes = scene.children.filter((c) => c.name.startsWith(p));
    const pole = nodes.find((c) => c.name === `${p}pole`);
    if (!pole) continue;
    const grp = new THREE.Group();
    for (const n of nodes) {
      const c = n.clone();
      c.position.x -= pole.position.x;
      c.position.z -= pole.position.z;
      grp.add(c);
    }
    presets.push(grp);
  }
  if (!presets.length) return g;
  const perPreset: THREE.Matrix4[][] = presets.map(() => []);
  const tops: { p: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  POWER_LINE.forEach(([x, z], i) => {
    const [nx, nz] = POWER_LINE[Math.min(i + 1, POWER_LINE.length - 1)];
    const [px, pz] = POWER_LINE[Math.max(i - 1, 0)];
    const dx = nx - px, dz = nz - pz;
    const rot = Math.atan2(dx, dz);
    const y = heightAt(x, z) + 0.05;
    perPreset[i % presets.length].push(trs(x, y, z, rot + (i % 2) * Math.PI));
    // Travers (x ekseni) hat yönüne dik: dönüş sonrası yerel x
    const across = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
    tops.push({ p: new THREE.Vector3(x, y + 5.86, z), dir: across });
  });
  presets.forEach((pr, k) => {
    if (perPreset[k].length) g.add(...instanced(pr, perPreset[k]));
  });
  // Teller: katenerle sarkık, üç faz
  const pts: number[] = [];
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i], b = tops[i + 1];
    for (const off of [-0.52, 0, 0.52]) {
      const A = a.p.clone().addScaledVector(a.dir, off).setY(a.p.y + (off === 0 ? 0.12 : 0));
      const B = b.p.clone().addScaledVector(b.dir, off).setY(b.p.y + (off === 0 ? 0.12 : 0));
      const sag = 0.00035 * A.distanceTo(B) ** 2;
      const N = 12;
      for (let s = 0; s < N; s++) {
        const t0 = s / N, t1 = (s + 1) / N;
        const P0 = A.clone().lerp(B, t0);
        const P1 = A.clone().lerp(B, t1);
        P0.y -= sag * 4 * t0 * (1 - t0);
        P1.y -= sag * 4 * t1 * (1 - t1);
        pts.push(P0.x, P0.y, P0.z, P1.x, P1.y, P1.z);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2b2c })));
  return g;
}
