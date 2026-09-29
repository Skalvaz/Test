/**
 * Kit-bash parça kütüphanesi (Blender'da üretilir: blender/kit_parts.py).
 *
 * Motor dış donanımının küçük parçaları — kelepçe, rakor, aktüatör,
 * ateşleyici, pompa, sensör, etiket… — tek bir glb'den yüklenir. Motor
 * modelleri parçaları `KitBatch` ile yerleştirir; aynı parça (ve aynı malzeme
 * yuvası) bir InstancedMesh ile tek çizim çağrısında çizilir.
 *
 * Eksen kuralı (kit_parts.py ile aynı): parçanın kökü montaj yüzeyinde, +Y
 * yüzeyden dışarı, +Z motor ekseni boyunca. `surface()` bu çerçeveyi motor
 * gövdesinin (açı, yarıçap, z) noktasına oturtur.
 *
 * Her parçanın üç detay seviyesi vardır (L0/L1/L2); kalite ayarı hangisinin
 * kullanılacağını seçer.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { tagPart } from './geom.js';
import kitUrl from '../assets/kit.glb?url';
import trimAlbedoUrl from '../assets/trim_albedo.webp?url';
import trimNormalUrl from '../assets/trim_normal.webp?url';
import trimOrmUrl from '../assets/trim_orm.webp?url';
import castNUrl from '../assets/mat_cast_normal.webp?url';
import castOUrl from '../assets/mat_cast_orm.webp?url';
import machNUrl from '../assets/mat_machined_normal.webp?url';
import machOUrl from '../assets/mat_machined_orm.webp?url';
import paintNUrl from '../assets/mat_paint_normal.webp?url';
import paintOUrl from '../assets/mat_paint_orm.webp?url';

/** @type {Map<string, { geometry: THREE.BufferGeometry, slot: string }[][]> | null} */
let PARTS = null;
let lod = 0;

const QUALITY_LOD = { high: 0, medium: 1, low: 2 };

/** Kalite ayarına göre detay seviyesi (sonraki model üretiminde geçerli) */
export function setKitQuality(q) {
  lod = QUALITY_LOD[q] ?? 1;
}

export function kitLoaded() {
  return !!PARTS;
}

export function kitPartNames() {
  return PARTS ? [...PARTS.keys()] : [];
}

/**
 * glb'yi ve dokuları yükler. Dokular `createMaterials`'a verilir.
 * @returns {Promise<Record<string, THREE.Texture>>}
 */
export async function loadKit(renderer) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const tl = new THREE.TextureLoader();
  const aniso = renderer?.capabilities.getMaxAnisotropy() ?? 4;
  const tex = async (url, { srgb = false, clampV = false } = {}) => {
    const t = await tl.loadAsync(url);
    // glTF UV kuralı: v = 0 üst kenar
    t.flipY = false;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = clampV ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const [gltf, ...maps] = await Promise.all([
    loader.loadAsync(kitUrl),
    tex(trimAlbedoUrl, { srgb: true, clampV: true }),
    tex(trimNormalUrl, { clampV: true }),
    tex(trimOrmUrl, { clampV: true }),
    tex(castNUrl),
    tex(castOUrl),
    tex(machNUrl),
    tex(machOUrl),
    tex(paintNUrl),
    tex(paintOUrl),
  ]);
  const [trimAlbedo, trimNormal, trimOrm, castN, castO, machN, machO, paintN, paintO] = maps;

  PARTS = new Map();
  gltf.scene.traverse((o) => {
    const m = /^KIT_(\w+)_L(\d)$/.exec(o.name);
    if (!m) return;
    const [, name, l] = m;
    const prims = [];
    const collect = (mesh) => {
      mesh.geometry = toFloat(mesh.geometry);
      mesh.geometry.applyMatrix4(mesh.matrixWorld);
      prims.push({ geometry: mesh.geometry, slot: mesh.material.name });
    };
    o.updateMatrixWorld(true);
    if (o.isMesh) collect(o);
    else o.traverse((c) => c.isMesh && collect(c));
    if (!PARTS.has(name)) PARTS.set(name, []);
    PARTS.get(name)[Number(l)] = prims;
  });
  return { trimAlbedo, trimNormal, trimOrm, castN, castO, machN, machO, paintN, paintO };
}

/**
 * Nicemlenmiş (int16/int8, iç içe) köşe verisini düz Float32'ye çevirir:
 * dönüşüm uygulanabilsin ve örnekli çizimde hassasiyet kaybolmasın.
 */
function toFloat(geo) {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const n = attr.count;
    const size = attr.itemSize;
    const arr = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < size; k++) arr[i * size + k] = attr.getComponent(i, k);
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  if (geo.index) out.setIndex(Array.from(geo.index.array));
  // Bütün motor modelleri aynı geometriyi paylaşır: model atılırken silinmez
  out.userData.shared = true;
  return out;
}

/**
 * Kit malzeme yuvası → kütüphane malzemesi. Kütüphanede `kit*` adlı
 * malzemeler yoksa (dokular yüklenemediyse) yakın karşılıklar kullanılır.
 */
function slotMaterials(materials) {
  const m = materials;
  return {
    cast: m.kitCast ?? m.castAlu,
    iridite: m.kitIridite ?? m.castAlu,
    steel: m.kitSteel ?? m.machinery,
    ss: m.kitStainless ?? m.hubMetal,
    anodized: m.kitAnodized ?? m.anodized,
    gold: m.kitGold ?? m.brassFitting,
    paint: m.kitPaint ?? m.boxPaint,
    rubber: m.kitRubber ?? m.hose,
    glass: m.sightGlass,
    tank: m.kitTank ?? m.engineCase,
    red: m.kitRed ?? m.anodized,
    yellow: m.kitYellow ?? m.standPaint,
    weld: m.kitWeld ?? m.machinery,
    knurl: m.kitKnurl ?? m.machinery,
    rivet: m.kitTrimPaint ?? m.boxPaint,
    louver: m.kitTrimPaint ?? m.boxPaint,
    placard: m.kitPlacard ?? m.boxPaint,
  };
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Motor gövdesi üzerinde bir noktanın çerçevesi: yerel +Y radyal dışarı,
 * +Z eksen boyunca.
 * @param {number} a açı (rad, +X'ten)
 * @param {number} r yarıçap
 * @param {number} z eksenel konum
 * @param {{ yaw?: number, pitch?: number, roll?: number, scale?: number | [number, number, number] }} [o]
 *   yaw: yerel Y etrafında dönüş (parçayı yüzeyde çevirir), pitch: yerel X
 *   etrafında (eksene göre eğim), roll: yerel Z etrafında
 */
export function surface(a, r, z, o = {}) {
  const m = new THREE.Matrix4();
  _q.setFromAxisAngle(Z, a - Math.PI / 2);
  _e.set(o.pitch ?? 0, o.yaw ?? 0, o.roll ?? 0, 'YXZ');
  _q2.setFromEuler(_e);
  _q.multiply(_q2);
  const s = o.scale ?? 1;
  const sv = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
  m.compose(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z), _q, sv);
  return m;
}

/**
 * Bir motor modeli için yerleştirme toplayıcısı. `add` ile dönüşümler
 * birikir, `build` her (parça, malzeme yuvası, motor parçası) üçlüsü için
 * bir InstancedMesh üretir.
 */
export class KitBatch {
  constructor(materials) {
    this.slots = slotMaterials(materials);
    /** @type {Map<string, { name: string, part: string, matrices: THREE.Matrix4[] }>} */
    this.items = new Map();
  }

  /**
   * @param {string} name kit parça adı (kit_parts.py)
   * @param {THREE.Matrix4} matrix model uzayında dönüşüm
   * @param {string} [part] 3B seçim/vurgulama için motor parçası etiketi
   */
  add(name, matrix, part = 'gearbox') {
    if (!PARTS) return this;
    if (!PARTS.has(name)) {
      console.warn(`kit: bilinmeyen parça "${name}"`);
      return this;
    }
    const key = `${name}|${part}`;
    let it = this.items.get(key);
    if (!it) {
      it = { name, part, matrices: [] };
      this.items.set(key, it);
    }
    it.matrices.push(matrix.clone());
    return this;
  }

  /** Kısayol: gövde yüzeyine yerleştir */
  at(name, a, r, z, o = {}, part = 'gearbox') {
    return this.add(name, surface(a, r, z, o), part);
  }

  get count() {
    let n = 0;
    for (const it of this.items.values()) n += it.matrices.length;
    return n;
  }

  build() {
    const group = new THREE.Group();
    group.name = 'kit';
    if (!PARTS) return group;
    for (const it of this.items.values()) {
      const levels = PARTS.get(it.name);
      const prims = levels[Math.min(lod, levels.length - 1)] ?? levels[0];
      for (const { geometry, slot } of prims) {
        const mat = this.slots[slot] ?? this.slots.steel;
        const mesh = new THREE.InstancedMesh(geometry, mat, it.matrices.length);
        it.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.name = `kit-${it.name}-${slot}`;
        mesh.castShadow = slot !== 'placard';
        mesh.receiveShadow = true;
        group.add(tagPart(mesh, it.part));
      }
    }
    return group;
  }
}
