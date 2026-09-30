/**
 * Havaalanının çevresindeki arazi: düz hava üssü bölgesi, dışarıda hafif
 * dalgalı tarlalar ve tepeler, 4–9 km'de sisle birleşen dağ silueti.
 *
 * Ağ çalışma zamanında üretilir (indirilecek bayt yok): kutupsal ızgara,
 * merkezde sık, uzakta seyrek halkalar. Yüzey çimen taramasıdır (uv1 metre);
 * tarla deseni, çitlik sınırları ve uzak renk birleşimi shader'da dünya
 * konumundan hesaplanır. Yükseklik fonksiyonu (heightAt) ağaç ve donanım
 * yerleşiminde de kullanılır.
 */

import * as THREE from 'three';
import { scanParams } from '../materials/scans.js';

export const GROUND_Y = -2.4;
/** Arazi düz bölgede kaplamaların biraz altında kalır (üst üste binme yok) */
const TERRAIN_DROP = 0.05;

/** Hava üssünün düz bölgesi: dikdörtgenler birleşimi (x0, x1, z0, z1) */
export const FLAT_ZONE: [number, number, number, number][] = [
  [-150, 200, -440, 120], // teknik alan + kara tarafı + dış yol
  [-1340, 1340, 110, 235], // pist şeridi
];

function rectDist(x: number, z: number, r: [number, number, number, number]) {
  const dx = Math.max(r[0] - x, 0, x - r[1]);
  const dz = Math.max(r[2] - z, 0, z - r[3]);
  return Math.hypot(dx, dz);
}

export function zoneDistance(x: number, z: number) {
  let d = Infinity;
  for (const r of FLAT_ZONE) d = Math.min(d, rectDist(x, z, r));
  return d;
}

/* Değer gürültüsü (tohumlu, tekrarlanabilir) */
function hash2(ix: number, iz: number) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, z: number, oct = 4) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f + i * 17.3, z * f - i * 9.1);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Arazi yüksekliği (dünya y) */
export function heightAt(x: number, z: number) {
  const d = zoneDistance(x, z);
  const r = Math.hypot(x, z);
  const rise = smooth(30, 900, d);
  // Tarla dalgaları + tepeler
  const hills = (fbm(x / 700, z / 700) - 0.35) * 70 + (fbm(x / 180, z / 180, 3) - 0.5) * 6;
  // Uzak dağ silsilesi: kuzey ve batıda yüksek, doğuda alçak
  const ang = Math.atan2(z, x);
  const range = 0.55 + 0.45 * Math.sin(ang * 1.3 + 0.8);
  const ridge = 1 - Math.abs(fbm(x / 2600, z / 2600, 5) * 2 - 1);
  const mountains = smooth(3200, 6800, r) * (220 + 620 * ridge * ridge) * range;
  return GROUND_Y - TERRAIN_DROP + rise * Math.max(hills, -4) + mountains;
}

/** Arazi malzemesi: çimen taraması + tarla deseni + uzak renk birleşimi */
function terrainMaterial(scans: Record<string, any> | null, noise: THREE.Texture) {
  const s = scans?.grass;
  const mat = new THREE.MeshStandardMaterial(
    s ? (scanParams(s, { color: 0xffffff, rough: 1.1, ao: 0.4 }) as THREE.MeshStandardMaterialParameters) : { color: 0x4d6b2e, roughness: 0.95 },
  );
  mat.name = 'terrain';
  const zones = FLAT_ZONE.map((r) => new THREE.Vector4(...r));
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMacro = { value: noise };
    sh.uniforms.uZones = { value: zones };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldT;\nvarying vec3 vWorldNT;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldT = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNT = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldT;
        varying vec3 vWorldNT;
        uniform sampler2D uMacro;
        uniform vec4 uZones[${zones.length}];
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float zoneDist(vec2 p) {
          float d = 1e9;
          for (int i = 0; i < ${zones.length}; i++) {
            vec4 r = uZones[i];
            vec2 q = max(max(vec2(r.x, r.z) - p, p - vec2(r.y, r.w)), 0.0);
            d = min(d, length(q));
          }
          return d;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec2 p = vWorldT.xz;
          float dist = length(vWorldT - cameraPosition);
          // Tarama fazla doygun: Anadolu çayırı gibi daha soluk, sarımsı
          float luma = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(vec3(luma), diffuseColor.rgb, 0.62) * vec3(1.06, 1.0, 0.9);
          // Uzakta döşeme tekrarı görünmesin: taramanın ortalama rengine yaklaş
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.33, 0.17), smoothstep(250.0, 1400.0, dist) * 0.8);
          float mA = texture2D(uMacro, p * 0.0021).r;
          float mB = texture2D(uMacro, p * 0.013 + 0.37).g;
          diffuseColor.rgb *= mix(0.72, 1.12, mA * 0.6 + mB * 0.4);
          // Tarla deseni: döndürülmüş ızgara, sıra kaydırmalı parseller
          float zd = zoneDist(p);
          vec2 q = mat2(0.956, -0.292, 0.292, 0.956) * p;
          vec2 cellSize = vec2(210.0, 130.0);
          float row = floor(q.y / cellSize.y);
          q.x += tHash(vec2(row, 3.1)) * cellSize.x;
          vec2 cell = floor(q / cellSize);
          vec2 f = fract(q / cellSize);
          float h = tHash(cell);
          vec3 tint = h < 0.35 ? vec3(1.0, 1.0, 1.0)
                    : h < 0.6 ? vec3(1.32, 1.12, 0.62)   // kuru ekin / anız
                    : h < 0.78 ? vec3(0.85, 0.66, 0.46)  // sürülmüş toprak
                    : h < 0.9 ? vec3(0.78, 0.98, 0.7)    // koyu yeşil
                    : vec3(1.15, 1.05, 0.8);
          // Sürülmüş tarlalarda sıra çizgileri
          float rows = h >= 0.6 && h < 0.78 ? 0.85 + 0.15 * sin(q.x * 2.4) : 1.0;
          // Parsel kenarı: çitlik / toprak yol (koyu)
          vec2 e = min(f, 1.0 - f) * cellSize;
          float edge = 1.0 - smoothstep(1.5, 5.0, min(e.x, e.y));
          float fieldMix = smoothstep(120.0, 400.0, zd);
          vec3 fieldCol = tint * rows * mix(1.0, 0.62, edge);
          // Hava üssü içi: biçilmiş, yer yer kurumuş çimen
          float dry = smoothstep(0.3, 0.65, texture2D(uMacro, p * 0.0043 + 0.61).b * 0.7 + mB * 0.3);
          vec3 baseCol = mix(vec3(1.02, 1.02, 0.8), vec3(1.4, 1.18, 0.66), dry);
          diffuseColor.rgb *= mix(baseCol, fieldCol, fieldMix);
          // Dağ yamaçları: kayalık / çalılık (yüksekliğe göre)
          // Dağ yamaçları: ormanlık (koyu yeşil) ve kayalık/çalılık (kahve-gri) lekeler
          float alt = smoothstep(30.0, 300.0, vWorldT.y);
          float forest = smoothstep(0.45, 0.6, texture2D(uMacro, p * 0.00055 + 0.2).g * 0.6 + texture2D(uMacro, p * 0.0023).r * 0.4);
          float rock = smoothstep(0.55, 0.75, texture2D(uMacro, p * 0.0011 + 0.7).b);
          vec3 slope = mix(vec3(0.36, 0.33, 0.25), vec3(0.12, 0.17, 0.09), forest);
          slope = mix(slope, vec3(0.45, 0.42, 0.38), rock * (1.0 - forest));
          // Yamaç eğimi: dik yüzler daha koyu (vadi gölgesi hissi)
          float steep = 1.0 - clamp(normalize(vWorldNT).y * 1.2, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, slope * (0.85 + 0.3 * mA) * (1.0 - 0.25 * steep), alt * 0.92);
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'terrain-v1';
  return mat;
}

export function buildTerrain(scans: Record<string, any> | null, noise: THREE.Texture) {
  const RINGS = 120;
  const SEGS = 220;
  const RMAX = 9500;
  const pos: number[] = [];
  const uv: number[] = [];
  pos.push(0, heightAt(0, 0), 0);
  uv.push(0, 0);
  for (let k = 1; k <= RINGS; k++) {
    const t = k / RINGS;
    const r = RMAX * (0.02 * t + 0.98 * t * t * t);
    for (let i = 0; i < SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2 + (k % 2) * (Math.PI / SEGS);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos.push(x, heightAt(x, z), z);
      uv.push(x, z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < SEGS; i++) idx.push(0, 1 + ((i + 1) % SEGS), 1 + i);
  for (let k = 1; k < RINGS; k++) {
    const a0 = 1 + (k - 1) * SEGS;
    const b0 = 1 + k * SEGS;
    for (let i = 0; i < SEGS; i++) {
      const i1 = (i + 1) % SEGS;
      idx.push(a0 + i, a0 + i1, b0 + i1, a0 + i, b0 + i1, b0 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, terrainMaterial(scans, noise));
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  // Gölge kamerası dar; arazi gölge atmaz
  mesh.castShadow = false;
  return mesh;
}

/**
 * Uzak köyler: tepelere serpilmiş beyaz badanalı, kiremit çatılı evler.
 * Sisle birleşir; ölçek ve yaşanmışlık hissi verir. İki InstancedMesh
 * (duvar kutusu + beşik çatı), kümeler tohumlu.
 */
export function buildVillages() {
  const walls = new THREE.BoxGeometry(1, 1, 1);
  walls.translate(0, 0.5, 0);
  const roof = new THREE.CylinderGeometry(0.72, 0.72, 1, 3, 1);
  roof.rotateZ(Math.PI / 2);
  roof.rotateX(Math.PI / 6);
  roof.scale(1.08, 0.55, 1);
  roof.translate(0, 0.02, 0);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe4ddd0, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xa44c32, roughness: 0.8 });
  let seed = 777;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const houses: THREE.Matrix4[] = [];
  const roofs: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let v = 0; v < 9; v++) {
    const r = 1300 + rnd() * 3200;
    const a = rnd() * Math.PI * 2;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    if (zoneDistance(cx, cz) < 500) continue;
    const n = 18 + Math.floor(rnd() * 40);
    const street = rnd() * Math.PI;
    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(rnd()) * (90 + n * 2.5);
      const t = rnd() * Math.PI * 2;
      const x = cx + Math.cos(t) * d;
      const z = cz + Math.sin(t) * d;
      const w = 7 + rnd() * 6;
      const l = 8 + rnd() * 8;
      const h = rnd() < 0.3 ? 6 : 3.2;
      const rot = street + (rnd() < 0.5 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.3;
      q.setFromAxisAngle(up, rot);
      const y = heightAt(x, z) - 0.5;
      houses.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h + 0.5, l)));
      roofs.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + h + 0.5, z), q, new THREE.Vector3(w, 2.2, l)));
      colors.push(new THREE.Color().setHSL(0.03 + rnd() * 0.03, 0.45, 0.3 + rnd() * 0.12));
    }
  }
  const g = new THREE.Group();
  g.name = 'villages';
  const hm = new THREE.InstancedMesh(walls, wallMat, houses.length);
  const rm = new THREE.InstancedMesh(roof, roofMat, roofs.length);
  houses.forEach((m, i) => hm.setMatrixAt(i, m));
  roofs.forEach((m, i) => {
    rm.setMatrixAt(i, m);
    rm.setColorAt(i, colors[i]);
  });
  hm.frustumCulled = rm.frustumCulled = false;
  hm.userData.noAO = rm.userData.noAO = true;
  g.add(hm, rm);
  return g;
}
