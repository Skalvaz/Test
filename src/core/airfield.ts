/**
 * Havaalanı ortamı (blender/airfield.py): apron, motor çalıştırma alanı,
 * jet egzozu saptırma duvarı, hangarlar, kule, taksi yolu ve pist.
 *
 * Geometri Blender'da kodla üretilir; yüzeyler gerçek taramalardır
 * (ambientCG, CC0) ve metre ölçekli ikinci UV kanalına (uv1) bağlanır.
 * Büyük zeminlerde döşeme tekrarını gizlemek için malzemelere düşük
 * frekanslı bir renk/pürüzlülük varyasyonu eklenir (100 m ölçeğinde).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import airfieldUrl from '../assets/airfield.glb?url';
import { scanParams } from '../materials/scans.js';

type Scans = Record<string, Parameters<typeof scanParams>[0]>;

export interface Airfield {
  root: THREE.Group;
  /** Gece: lambalar yanar */
  setNight(on: boolean): void;
  floorY: number;
}

/** Döşeme tekrarını kıran makro varyasyon (renk ve pürüzlülük) */
function macroVariation(mat: THREE.MeshStandardMaterial, noise: THREE.Texture, scale = 0.02, amount = 0.28) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMacro = { value: noise };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMacro;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          float mA = texture2D(uMacro, vMapUv * ${scale.toFixed(4)}).r;
          float mB = texture2D(uMacro, vMapUv * ${(scale * 3.7).toFixed(4)} + 0.37).g;
          float macro = mix(1.0 - ${amount.toFixed(2)}, 1.0 + ${(amount * 0.5).toFixed(2)}, mA * 0.65 + mB * 0.35);
          diffuseColor.rgb *= macro;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => `macro-${scale}-${amount}`;
}

const TAXI_STAIN_X = 48;

/** Apron'da yağ lekeleri ve lastik izleri (rastgele ama sabit tohumlu) */
function buildStains(floorY: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // Düzensiz leke: üst üste binen yarı saydam daireler
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const r = 12 + rnd() * 50;
    const x = 128 + (rnd() - 0.5) * 120;
    const y = 128 + (rnd() - 0.5) * 120;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,0.07)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0x15120e, transparent: true, depthWrite: false, roughness: 0.35, metalness: 0 });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  // Lekeler motor alanında ve hangar önündeki park pozisyonlarında toplanır
  const spots: [number, number, number][] = [
    [0, 0, 7], [0, 6, 5], [-1, -4, 4], // motor alanı (x, z, yayılma)
    [-34, -30, 6], [-34, 12, 6], // park pozisyonları
    [TAXI_STAIN_X, -10, 4],
  ];
  const n = 36;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const [cx, cz, spread] = spots[i % spots.length];
    const x = cx + (rnd() - 0.5) * 2 * spread;
    const z = cz + (rnd() - 0.5) * 2 * spread;
    const s = 1.2 + rnd() * 2.8;
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, floorY + 0.006, z), q, new THREE.Vector3(s, 1, s * (0.6 + rnd() * 0.8)));
    mesh.setMatrixAt(i, m);
  }
  mesh.receiveShadow = true;
  mesh.name = 'apron-stains';
  return mesh;
}

/** Ufuktaki ağaç sırası: basit gövde + taç, sisle birleşir */
function buildTreeLine(floorY: number) {
  const group = new THREE.Group();
  group.name = 'tree-line';
  let seed = 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f4222, roughness: 0.95, flatShading: true });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1, 5);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b3026, roughness: 1 });
  const n = 900;
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, n);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    // Pist yönünde (z ≈ 170) ağaç yok: pist ekseni boyunca açıklık
    let r = 520 + rnd() * 420;
    const x = Math.cos(a) * r;
    let z = Math.sin(a) * r;
    if (Math.abs(z - 170) < 120 && Math.abs(x) < 1300) z += Math.sign(z - 170 || 1) * 160;
    r = Math.hypot(x, z);
    const h = 8 + rnd() * 12;
    const w = h * (0.35 + rnd() * 0.2);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    m.compose(new THREE.Vector3(x, floorY + h * 0.62, z), q, new THREE.Vector3(w, h * 0.45, w));
    crowns.setMatrixAt(i, m);
    col.setHSL(0.24 + rnd() * 0.06, 0.35, 0.16 + rnd() * 0.08);
    crowns.setColorAt(i, col);
    m.compose(new THREE.Vector3(x, floorY, z), q, new THREE.Vector3(1, h * 0.4, 1));
    trunks.setMatrixAt(i, m);
  }
  group.add(crowns, trunks);
  return group;
}

export async function loadAirfield(scans: Scans | null, noise: THREE.Texture): Promise<Airfield> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(airfieldUrl);
  const root = new THREE.Group();
  root.name = 'airfield';
  root.add(gltf.scene);

  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ envMapIntensity: 1, ...o });
  const scan = (name: string, o: Record<string, unknown>, fallback: THREE.MeshStandardMaterialParameters, macro = 0) => {
    const s = scans?.[name];
    const m = s ? std(scanParams(s, o) as THREE.MeshStandardMaterialParameters) : std(fallback);
    if (s && macro > 0) macroVariation(m, noise, 0.02, macro);
    return m;
  };
  const lamps: THREE.MeshStandardMaterial[] = [];
  const lamp = (color: number) => {
    const m = std({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: 0.2, roughness: 0.4 });
    lamps.push(m);
    return m;
  };
  const mats: Record<string, THREE.Material> = {
    grass: scan('grass', { color: 0xffffff, rough: 1.1 }, { color: 0x4d6b2e, roughness: 0.95 }, 0.35),
    apron: scan('apron', { color: 0x9d9c97, ao: 0.5 }, { color: 0x9d9c97, roughness: 0.85 }, 0.3),
    hangar_floor: scan('apron', { color: 0x6e6d69 }, { color: 0x6e6d69, roughness: 0.8 }),
    concrete: scan('apron', { color: 0xa9a7a0 }, { color: 0xa9a7a0, roughness: 0.85 }),
    asphalt: scan('asphalt', { color: 0x9a9a9a }, { color: 0x3a3a3a, roughness: 0.9 }, 0.25),
    taxiway: scan('taxiway', { color: 0xffffff }, { color: 0x404040, roughness: 0.9 }, 0.25),
    gravel: scan('gravel', { color: 0xc8c4bc }, { color: 0x8a857c, roughness: 0.95 }),
    // Boyalı oluklu sac (hangar): açık gri, yarı metalik
    corrugated: scan('corrugated', { color: 0xaeb3b6, metal: 0.35, rough: 1.3 }, { color: 0xaeb3b6, metalness: 0.35, roughness: 0.55 }),
    shutter: scan('shutter', { color: 0x8f989e, metal: 0.4, rough: 1.2 }, { color: 0x8f989e, metalness: 0.4, roughness: 0.5 }),
    // Blast duvarı: yıpranmış galvaniz oluklu levha
    galv: scan('corrugated', { color: 0x6e7378, metal: 0.45, rough: 1.3 }, { color: 0x6e7378, metalness: 0.45, roughness: 0.55 }),
    steel: scan('brushed', { color: 0x777c80 }, { color: 0x777c80, metalness: 1, roughness: 0.4 }),
    steel_dark: scan('paint', { color: 0x3a3f44 }, { color: 0x3a3f44, metalness: 0.4, roughness: 0.6 }),
    // İç yüzler dış yüzlerle aynı yerde ve ters yönlü: yalnız ön yüz çizilir
    interior: std({ color: 0x2a2c2e, metalness: 0.3, roughness: 0.8 }),
    joint: std({ color: 0x3b3a37, roughness: 0.95 }),
    rubber_marks: std({ color: 0x151515, roughness: 0.9, transparent: true, opacity: 0.55 }),
    paint_yellow: scan('apron', { color: 0xc9981e, rough: 0.9 }, { color: 0xc9981e, roughness: 0.7 }),
    paint_white: scan('apron', { color: 0xcfcfca, rough: 0.9 }, { color: 0xcfcfca, roughness: 0.7 }),
    paint_red: scan('apron', { color: 0x9a3a2e, rough: 0.9 }, { color: 0x9a3a2e, roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0d1418, metalness: 0.1, roughness: 0.05, envMapIntensity: 1.6 }),
    lamp_white: lamp(0xfff4e0),
    lamp_warm: lamp(0xffd9a0),
    light_white: lamp(0xfff2d8),
    light_blue: lamp(0x3d7bff),
    light_red: lamp(0xff2a1a),
  };
  for (const [name, m] of Object.entries(mats)) m.name = `af_${name}`;

  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.Material;
    const key = src.name.replace(/\.\d+$/, '');
    mesh.material = mats[key] ?? mats.concrete;
    src.dispose();
    mesh.receiveShadow = true;
    // Zemin gölge atmaz; binalar ve duvar atar
    mesh.castShadow = !/ground|markings|txt/i.test(mesh.name);
  });

  // Apron ışık direklerinin gece ışığı (4 spot)
  const spots: THREE.SpotLight[] = [];
  const floorY = -2.4;
  for (const [x, z] of [[-66, -56], [66, -56], [-66, 36], [66, 36]] as const) {
    const s = new THREE.SpotLight(0xfff0dc, 0, 120, 0.75, 0.6, 1.2);
    s.position.set(x, floorY + 21.8, z);
    s.target.position.set(x * 0.25, floorY, z * 0.25);
    root.add(s, s.target);
    spots.push(s);
  }

  root.add(buildStains(floorY), buildTreeLine(floorY));

  return {
    root,
    floorY,
    setNight(on: boolean) {
      for (const m of lamps) m.emissiveIntensity = on ? 6 : 0.2;
      for (const s of spots) s.intensity = on ? 2200 : 0;
    },
  };
}
