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
import { buildTerrain, buildVillages } from './terrain';
import { loadVegetation } from './vegetation';
import { loadAirfieldProps } from './afProps';

type Scans = Record<string, Parameters<typeof scanParams>[0]>;

export interface Airfield {
  root: THREE.Group;
  /** Gece: lambalar yanar */
  setNight(on: boolean): void;
  /** Radar anteni döner, rüzgâr tulumu dalgalanır */
  update(dt: number): void;
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


/**
 * Apron betonu: her 5 m'lik plaka biraz farklı tonda (farklı döküm
 * partileri), bazı plakalar yenilenmiş (açık), derz kenarlarında kir
 * birikir; üstüne düşük frekanslı makro varyasyon.
 */
function slabVariation(mat: THREE.MeshStandardMaterial, noise: THREE.Texture, scanSize: number, origin: [number, number]) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMacro = { value: noise };
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uMacro;
        float sHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
        {
          vec2 m = vMapUv * ${scanSize.toFixed(2)} - vec2(${origin[0].toFixed(2)}, ${origin[1].toFixed(2)});
          vec2 id = floor(m / 5.0);
          vec2 f = fract(m / 5.0) * 5.0;
          float h = sHash(id);
          float h2 = sHash(id + 17.0);
          float tone = 0.9 + 0.16 * h;
          if (h2 > 0.93) tone *= 1.12;       // yenilenmiş plaka
          if (h2 < 0.05) tone *= 0.86;       // eski, yağ emmiş plaka
          vec2 e = min(f, 5.0 - f);
          float edge = 1.0 - smoothstep(0.02, 0.35, min(e.x, e.y));
          float mA = texture2D(uMacro, m * 0.009).r;
          float mB = texture2D(uMacro, m * 0.041 + 0.37).g;
          diffuseColor.rgb *= tone * mix(0.8, 1.08, mA * 0.6 + mB * 0.4) * mix(1.0, 0.78, edge);
        }
        #endif`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        #ifdef USE_MAP
          roughnessFactor = clamp(roughnessFactor * (0.9 + 0.2 * sHash(floor((vMapUv * ${scanSize.toFixed(2)} - vec2(${origin[0].toFixed(2)}, ${origin[1].toFixed(2)})) / 5.0) + 5.0)), 0.0, 1.0);
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => `slab-${scanSize}-${origin.join(',')}`;
}

/** Işık direklerinin konumları (blender/airfield.py MASTS ile aynı) */
const MASTS: [number, number][] = [[-40, -57], [67, -57], [-40, 37], [67, 37], [10, -57]];

export async function loadAirfield(scans: Scans | null, noise: THREE.Texture, renderer: THREE.WebGLRenderer): Promise<Airfield> {
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
  const lamp = (color: number, day = 0.2) => {
    const m = std({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: day, roughness: 0.4 });
    m.userData.day = day;
    lamps.push(m);
    return m;
  };
  const apron = scan('apron', { color: 0x8c8b86, ao: 0.6 }, { color: 0x8c8b86, roughness: 0.85 });
  if (scans?.apron) slabVariation(apron, noise, (scans.apron as { meta: { size: number } }).meta.size, [-47, -60]);
  const paint = (color: number) => scan('apron', { color, rough: 0.85 }, { color, roughness: 0.7 });
  const mats: Record<string, THREE.Material> = {
    apron,
    hangar_floor: scan('smooth', { color: 0x7d807c, rough: 0.8, metal: 0 }, { color: 0x6e6d69, roughness: 0.5 }),
    concrete: scan('apron', { color: 0xa9a7a0 }, { color: 0xa9a7a0, roughness: 0.85 }, 0.2),
    asphalt: scan('asphalt', { color: 0x9a9a9a }, { color: 0x3a3a3a, roughness: 0.9 }, 0.25),
    road: scan('asphalt', { color: 0x8a8a8a }, { color: 0x3a3a3a, roughness: 0.9 }, 0.2),
    taxiway: scan('taxiway', { color: 0xffffff }, { color: 0x404040, roughness: 0.9 }, 0.25),
    gravel: scan('gravel', { color: 0xc8c4bc }, { color: 0x8a857c, roughness: 0.95 }),
    // Boyalı oluklu sac (hangar): açık gri, yarı metalik
    corrugated: scan('corrugated', { color: 0xaeb3b6, metal: 0.35, rough: 1.3 }, { color: 0xaeb3b6, metalness: 0.35, roughness: 0.55 }),
    shutter: scan('shutter', { color: 0x8f989e, metal: 0.4, rough: 1.2 }, { color: 0x8f989e, metalness: 0.4, roughness: 0.5 }),
    shutter_red: scan('shutter', { color: 0x9c2b22, metal: 0.3, rough: 1.2 }, { color: 0x9c2b22, metalness: 0.3, roughness: 0.5 }),
    // Blast duvarı, oluklar: yıpranmış galvaniz
    galv: scan('corrugated', { color: 0x7a7f84, metal: 0.55, rough: 1.2 }, { color: 0x6e7378, metalness: 0.45, roughness: 0.55 }),
    steel: scan('brushed', { color: 0x777c80 }, { color: 0x777c80, metalness: 1, roughness: 0.4 }),
    steel_dark: scan('paint', { color: 0x3a3f44 }, { color: 0x3a3f44, metalness: 0.4, roughness: 0.6 }),
    frame: scan('paint', { color: 0x4a4f53, rough: 0.8 }, { color: 0x4a4f53, metalness: 0.4, roughness: 0.5 }),
    door_paint: scan('paint', { color: 0x4d6272 }, { color: 0x4d6272, roughness: 0.5 }),
    tank_white: scan('paint', { color: 0xd9dbd6, rough: 0.9 }, { color: 0xd9dbd6, roughness: 0.5 }),
    // Prekast beton bina panelleri: açık bej boyalı
    wall_panel: scan('apron', { color: 0xc4bdae, rough: 1.0 }, { color: 0xc4bdae, roughness: 0.85 }, 0.15),
    roof: scan('asphalt', { color: 0x6a6a68 }, { color: 0x3a3a3a, roughness: 0.9 }),
    skylight: std({ color: 0xd6dbd4, roughness: 0.45, metalness: 0, emissive: new THREE.Color(0xfff0d0), emissiveIntensity: 0 }),
    // İç yüzler dış yüzlerle aynı yerde ve ters yönlü: yalnız ön yüz çizilir
    interior: scan('corrugated', { color: 0x585c5f, metal: 0.3, rough: 1.3 }, { color: 0x2a2c2e, metalness: 0.3, roughness: 0.8 }),
    joint: std({ color: 0x3b3a37, roughness: 0.95 }),
    grate: scan('dark', { color: 0x2c2e30, rough: 1.1 }, { color: 0x2c2e30, metalness: 0.6, roughness: 0.6 }),
    rubber: std({ color: 0x111111, roughness: 0.9 }),
    rubber_marks: std({ color: 0x151515, roughness: 0.9, transparent: true, opacity: 0.5, depthWrite: false }),
    paint_yellow: paint(0xc9981e),
    paint_white: paint(0xcfcfca),
    paint_red: paint(0x9a3a2e),
    paint_black: paint(0x1d1d1c),
    sign_white: std({ color: 0xe6e6e1, roughness: 0.5 }),
    sign_black: std({ color: 0x141414, roughness: 0.5 }),
    sign_red: std({ color: 0xa31d16, roughness: 0.5 }),
    windsock: std({ color: 0xe0561c, roughness: 0.8, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0d1418, metalness: 0.1, roughness: 0.05, envMapIntensity: 1.6 }),
    lamp_white: lamp(0xfff4e0),
    lamp_warm: lamp(0xffd9a0),
    light_white: lamp(0xfff2d8),
    light_blue: lamp(0x3d7bff),
    light_red: lamp(0xff2a1a, 1.5),
    light_green: lamp(0x2aff6a),
  };
  for (const [name, m] of Object.entries(mats)) m.name = `af_${name}`;
  const skylight = mats.skylight as THREE.MeshStandardMaterial;

  let antenna: THREE.Object3D | null = null;
  let sock: THREE.Object3D | null = null;
  gltf.scene.traverse((o) => {
    if (o.name === 'AF_radar_antenna') antenna = o;
    if (o.name === 'AF_windsock') sock = o;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.Material;
    const key = src.name.replace(/\.\d+$/, '');
    mesh.material = mats[key] ?? mats.concrete;
    src.dispose();
    mesh.receiveShadow = true;
    // Zemin gölge atmaz; binalar ve duvar atar
    mesh.castShadow = !/ground|markings|txt/i.test(mesh.name);
    // Boya ve derzler zemine yapışık (derinlik kaydırması malzemede)
    if (/markings|txt/i.test(mesh.name)) mesh.renderOrder = 1;
  });
  // Zemin çizimleri için derinlik kaydırması malzemeden verilir
  for (const k of ['paint_yellow', 'paint_white', 'paint_red', 'paint_black', 'joint', 'grate', 'rubber_marks', 'steel']) {
    const m = mats[k];
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -4;
  }
  // Zemin kaplamaları araziye göre öne
  for (const k of ['apron', 'concrete', 'asphalt', 'road', 'taxiway', 'gravel', 'hangar_floor']) {
    const m = mats[k];
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -2;
  }

  const floorY = -2.4;
  // Arazi, bitki örtüsü, donanım
  root.add(buildTerrain(scans, noise), buildVillages());
  const [veg, props] = await Promise.all([
    loadVegetation(renderer).catch((e) => {
      console.error('Bitki örtüsü yüklenemedi', e);
      return null;
    }),
    loadAirfieldProps().catch((e) => {
      console.error('Havaalanı donanımı yüklenemedi', e);
      return null;
    }),
  ]);
  if (veg) root.add(veg);
  if (props) root.add(props);

  // Apron ışık direklerinin gece ışığı (5 spot)
  const spots: THREE.SpotLight[] = [];
  for (const [x, z] of MASTS) {
    const s = new THREE.SpotLight(0xffe6c4, 0, 0, 0.95, 0.9, 2);
    s.position.set(x, floorY + 23.5, z);
    s.target.position.set(x * 0.35, floorY, -10 + (z + 10) * 0.35);
    root.add(s, s.target);
    spots.push(s);
  }

  root.add(buildStains(floorY));

  let t = 0;
  let night = false;
  return {
    root,
    floorY,
    setNight(on: boolean) {
      night = on;
      for (const m of lamps) m.emissiveIntensity = on ? 6 : (m.userData.day as number);
      skylight.emissiveIntensity = on ? 0.6 : 0;
      for (const s of spots) s.intensity = on ? 9000 : 0;
    },
    update(dt: number) {
      t += dt;
      if (antenna) (antenna as THREE.Object3D).rotation.y -= dt * ((2 * Math.PI) / 5);
      if (sock) {
        // Rüzgâr tulumu: batıdan esen rüzgârla doğuya uzanır, hafif sallanır
        const s = sock as THREE.Object3D;
        s.rotation.set(0, 0.35 + Math.sin(t * 0.7) * 0.12 + Math.sin(t * 2.3) * 0.04, -0.12 + Math.sin(t * 1.3) * 0.05);
      }
      void night;
    },
  };
}
