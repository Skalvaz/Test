/**
 * Test hücresinin gerçek donanımı: Poly Haven'dan (CC0) fotogrametri/PBR
 * modeller — alet sandığı ve arabası, kaynak arabası, el arabası, raf,
 * varil, yangın tüpleri, elektrik panosu, tavan vinci.
 *
 * Hücrenin kendisi pişirilmiş ışıkla çizilir (MeshBasicMaterial); bu modeller
 * ise hücrenin ortam haritasıyla ve sahne ışıklarıyla gerçek zamanlı
 * aydınlanır. Pişirilmiş gölgeleri olmadığından altlarına yumuşak bir temas
 * gölgesi konur (zemine oturduklarını hissettirir).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const urls = import.meta.glob('../assets/props/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const url = (id: string) => urls[`../assets/props/${id}.glb`];

const FLOOR = -3.35;
const WALL_X = 13.5;

interface Placement {
  id: string;
  pos: [number, number, number];
  /** Dikey eksen etrafında dönüş (derece) */
  rot?: number;
  scale?: number;
  /** Temas gölgesi boyutu (m); 0 = yok (duvara/tavana asılı) */
  shadow?: number;
  /** Altındaki modelin üst yüzeyine otur (y aşağı ışınla bulunur) */
  sitOn?: boolean;
}

const PLACEMENTS: Placement[] = [
  // Sol platformun yanında alet arabası, üstünde alet sandığı
  { id: 'tool_cart', pos: [-4.4, FLOOR, 0.9], rot: 75, shadow: 1.5 },
  // (sitOn olanlar, oturdukları modelden sonra gelmeli)
  { id: 'industrial_storage_cart', pos: [-11.9, FLOOR, 7.9], rot: 90, shadow: 1.8 },
  { id: 'metal_tool_chest', pos: [-11.9, FLOOR + 3, 7.75], rot: 90, shadow: 0, sitOn: true },
  // Sağ tarafta kaynak arabası ve raf
  { id: 'portable_welding_cart', pos: [10.6, FLOOR, 5.2], rot: -40, shadow: 1.1 },
  { id: 'steel_frame_shelves_01', pos: [WALL_X - 0.4, FLOOR, -6.5], rot: -90, scale: 0.1, shadow: 1.4 },
  { id: 'hand_truck', pos: [WALL_X - 0.55, FLOOR, 10.6], rot: -100, shadow: 0.8 },
  // Hava girişi tarafında yağ varilleri
  { id: 'barrel_03', pos: [11.6, FLOOR, -14.6], rot: 10, shadow: 0.9 },
  { id: 'barrel_03', pos: [12.3, FLOOR, -15.4], rot: 70, shadow: 0.9 },
  { id: 'barrel_03', pos: [11.4, FLOOR, -15.5], rot: 140, shadow: 0.9 },
  // Yangın tüpleri (dört köşe)
  { id: 'korean_fire_extinguisher_01', pos: [-(WALL_X - 0.3), FLOOR, -15], rot: 90, shadow: 0.45 },
  { id: 'korean_fire_extinguisher_01', pos: [WALL_X - 0.3, FLOOR, -15], rot: -90, shadow: 0.45 },
  { id: 'korean_fire_extinguisher_01', pos: [-(WALL_X - 0.3), FLOOR, 11], rot: 90, shadow: 0.45 },
  { id: 'korean_fire_extinguisher_01', pos: [WALL_X - 0.3, FLOOR, 11], rot: -90, shadow: 0.45 },
  // Sağ duvarda elektrik panoları
  { id: 'power_box_01', pos: [WALL_X - 0.02, FLOOR + 1.6, 2.4], rot: -90, shadow: 0 },
  { id: 'power_box_01', pos: [WALL_X - 0.02, FLOOR + 1.6, 3.1], rot: -90, shadow: 0 },
];

/** Tavan vinci: egzoz tarafında, tavandan asılı iki yol kirişi üzerinde */
const CRANE_Z = 9.0;
const CRANE_TOP = 10.75;

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadCellProps(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'cell-props';
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const ids = [...new Set([...PLACEMENTS.map((p) => p.id), 'overhead_crane'])];
  const models = new Map<string, THREE.Object3D>();
  await Promise.all(
    ids.map(async (id) => {
      const u = url(id);
      if (!u) return;
      const gltf = await loader.loadAsync(u);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
      });
      models.set(id, gltf.scene);
    }),
  );

  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false });
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  const deg = THREE.MathUtils.degToRad;
  const ray = new THREE.Raycaster();
  for (const p of PLACEMENTS) {
    const src = models.get(p.id);
    if (!src) continue;
    const obj = src.clone();
    obj.position.set(...p.pos);
    if (p.sitOn) {
      // Alttaki yüzey tel ızgara olabilir: taban alanına 5×5 ışın atılır,
      // en yüksek çarpışma oturma yüksekliğidir
      group.updateMatrixWorld(true);
      const r = 0.25;
      let top = -Infinity;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          ray.set(new THREE.Vector3(p.pos[0] + (i * r) / 2, p.pos[1], p.pos[2] + (j * r) / 2), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObjects(group.children, true)[0];
          if (hit) top = Math.max(top, hit.point.y);
        }
      }
      obj.position.y = Number.isFinite(top) ? top + 0.002 : FLOOR;
    }
    obj.rotation.y = deg(p.rot ?? 0);
    obj.scale.setScalar(p.scale ?? 1);
    group.add(obj);
    if (p.shadow) {
      const blob = new THREE.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.scale.setScalar(p.shadow);
      blob.position.set(p.pos[0], FLOOR + 0.004, p.pos[2]);
      blob.renderOrder = 1;
      group.add(blob);
    }
  }

  // Tavan vinci + yol kirişleri
  const crane = models.get('overhead_crane');
  if (crane) {
    const box = new THREE.Box3().setFromObject(crane);
    const c = crane.clone();
    c.position.set(0, CRANE_TOP - box.max.y, CRANE_Z);
    group.add(c);
    const span = box.max.x - box.min.x;
    const steel = new THREE.MeshStandardMaterial({ color: 0xc99a1f, metalness: 0.3, roughness: 0.55 });
    for (const sx of [-1, 1]) {
      const x = sx * (span / 2 - 0.1);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 14), steel);
      rail.position.set(x, CRANE_TOP - 0.2, CRANE_Z - 2);
      rail.castShadow = true;
      group.add(rail);
      for (const z of [CRANE_Z - 8, CRANE_Z - 2, CRANE_Z + 4.5]) {
        const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), steel);
        hanger.position.set(x, CRANE_TOP + 0.4, z);
        group.add(hanger);
      }
    }
  }
  return group;
}
