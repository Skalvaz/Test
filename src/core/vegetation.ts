/**
 * Bitki örtüsü: Poly Haven ağaç/çalı/çim modellerinden pişirilmiş impostor
 * atlası (blender/impostors.py) ile kameraya dönen kartlar.
 *
 * Her örnek tek bir dörtgendir; köşeleri vertex shader'da düşey eksen
 * etrafında kameraya çevrilir (silindirik billboard). Atlasın normal
 * haritası sayesinde güneş tacın bir yanını aydınlatır. Gölge geçişinde
 * aynı kod ışık kamerasına döner: ağaçlar gerçek siluetleriyle gölge atar.
 *
 * Yerleşim tohumlu ve tekrarlanabilir: ormanlık tepeler, tarla kenarı ağaç
 * sıraları, hava üssü çevresinde tek tük ağaçlar, çimenlik alanlarda
 * çayır öbekleri (asfalt/beton üstüne düşmez).
 */

import * as THREE from 'three';
import colorUrl from '../assets/veg/veg_color.webp?url';
import normalUrl from '../assets/veg/veg_normal.webp?url';
import meta from '../assets/veg/meta.json';
import { fbm, heightAt, zoneDistance } from './terrain';

interface Tile {
  name: string;
  kind: 'tree' | 'conifer' | 'shrub' | 'grass';
  tile: [number, number];
  px: [number, number, number, number];
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** Kaplamalı alanlar (x0, x1, z0, z1): çimen öbeği ve ağaç buraya konmaz */
export const PAVED: [number, number, number, number][] = [
  [-102, 72, -62, 42], // apron + hangarlar + servis betonu
  [34, 62, 40, 150], // taksi yolu + omuzlar
  [-1265, 1265, 140, 200], // pist + omuzlar + dönüş cepleri
  [70, 152, -114, 40], // kara tarafı binaları, yollar, otopark
  [-102, 152, -114, -102], // güney servis yolu
  [130, 142, -420, -112], // dış yol
  [-36, 20, -101, -76], // yakıt sahası
  [-15, 15, 22, 34], // saptırma duvarı
  [150, 168, 84, 100], // radar
];

function paved(x: number, z: number, margin: number) {
  for (const r of PAVED) {
    if (x > r[0] - margin && x < r[1] + margin && z > r[2] - margin && z < r[3] + margin) return true;
  }
  return false;
}

function billboardMaterial(color: THREE.Texture, normal: THREE.Texture | null, depth = false, fade = 0) {
  const mat = depth
    ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: color, alphaTest: 0.5 })
    : new THREE.MeshStandardMaterial({
        map: color,
        normalMap: normal,
        normalScale: new THREE.Vector2(1, 1),
        alphaTest: 0.45,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
      });
  mat.onBeforeCompile = (sh) => {
    const basis = `
      attribute vec4 aTile;
      attribute vec4 aRect;
      vec3 bbCenter() { return (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; }
      vec3 bbForward(vec3 c) {
        vec3 d = cameraPosition - c;
        d.y = 0.0;
        return normalize(d + vec3(1e-4, 0.0, 0.0));
      }`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${basis}`);
    if (!depth) {
      sh.vertexShader = sh.vertexShader.replace(
        '#include <defaultnormal_vertex>',
        `vec3 bbF0 = bbForward(bbCenter());
        // Taç yaprakları çoğunlukla yukarı bakar: yüz normali kameraya ve yukarıya
        vec3 transformedNormal = normalize(mat3(viewMatrix) * normalize(bbF0 + vec3(0.0, 0.9, 0.0)));
        #ifdef USE_TANGENT
          vec3 transformedTangent = vec3(1.0, 0.0, 0.0);
        #endif`,
      );
      sh.vertexShader = sh.vertexShader.replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(bbWorld, 1.0);');
    }
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <begin_vertex>',
        `vec3 bbC = bbCenter();
        float bbS = length(instanceMatrix[0].xyz);
        vec3 bbF = bbForward(bbC);
        vec3 bbR = normalize(cross(vec3(0.0, 1.0, 0.0), bbF));
        ${
          fade > 0
            ? `// Çayır kartları: uzakta ve yukarıdan bakınca küçülerek kaybolur
          vec3 toC = cameraPosition - bbC;
          float elev = abs(toC.y) / max(length(toC), 1e-3);
          bbS *= (1.0 - smoothstep(0.45, 0.8, elev)) * (1.0 - smoothstep(${(fade * 0.6).toFixed(1)}, ${fade.toFixed(1)}, length(toC)));`
            : ''
        }
        vec3 bbWorld = bbC + bbR * (mix(aRect.x, aRect.y, uv.x) * bbS) + vec3(0.0, mix(aRect.z, aRect.w, uv.y) * bbS, 0.0);
        vec3 transformed = vec3(0.0);`,
      )
      .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(bbWorld, 1.0);\ngl_Position = projectionMatrix * mvPosition;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        #ifdef USE_MAP
          vMapUv = aTile.xy + uv * aTile.zw;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = aTile.xy + uv * aTile.zw;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => `billboard-${depth}-${fade}`;
  return mat;
}

interface Instance {
  tile: Tile;
  x: number;
  z: number;
  s: number;
  tint: number;
}

function buildBatch(list: Instance[], color: THREE.Texture, normal: THREE.Texture, shadows: boolean, cols: number, rows: number, size: number, fade = 0) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const n = list.length;
  const tile = new Float32Array(n * 4);
  const rect = new Float32Array(n * 4);
  const W = cols * size;
  const H = rows * size;
  list.forEach((it, i) => {
    const t = it.tile;
    const [x0, y0, x1, y1] = t.px;
    const [c, r] = t.tile;
    // Atlas satırları yukarıdan aşağı; doku v ekseni aşağıdan yukarı (flipY)
    tile.set([(c * size + x0) / W, 1 - (r * size + y1) / H, (x1 - x0) / W, (y1 - y0) / H], i * 4);
    rect.set([t.left, t.right, t.bottom - 0.05, t.top], i * 4);
  });
  geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 4));
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));
  const mesh = new THREE.InstancedMesh(geo, billboardMaterial(color, normal, false, fade), n);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  list.forEach((it, i) => {
    m.makeScale(it.s, it.s, it.s).setPosition(it.x, heightAt(it.x, it.z), it.z);
    mesh.setMatrixAt(i, m);
    col.setRGB(it.tint, it.tint * (0.97 + 0.06 * ((i * 7) % 5) / 5), it.tint * 0.95);
    mesh.setColorAt(i, col);
  });
  mesh.frustumCulled = false;
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  mesh.userData.noAO = true;
  if (shadows) mesh.customDepthMaterial = billboardMaterial(color, null, true);
  return mesh;
}

export async function loadVegetation(renderer: THREE.WebGLRenderer): Promise<THREE.Group> {
  const loader = new THREE.TextureLoader();
  const [color, normal] = await Promise.all([loader.loadAsync(colorUrl), loader.loadAsync(normalUrl)]);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  normal.colorSpace = THREE.NoColorSpace;
  const tiles = meta.tiles as unknown as Tile[];
  const byKind = (k: Tile['kind']) => tiles.filter((t) => t.kind === k);
  const trees = byKind('tree');
  const conifers = byKind('conifer');
  const shrubs = byKind('shrub');
  const grass = byKind('grass');
  // Atlas yükseklikleri farklı ölçeklerde; hedef yüksekliğe ölçekle
  const height = (t: Tile) => t.top - t.bottom;

  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length) % a.length];

  const big: Instance[] = [];
  const small: Instance[] = [];
  const addTree = (x: number, z: number, conifer: boolean, hTarget: number) => {
    const tile = conifer ? pick(conifers) : pick(trees);
    big.push({ tile, x, z, s: hTarget / height(tile), tint: 0.82 + rnd() * 0.3 });
  };

  // 1) Orman parçaları ve tepe ağaçları (gürültü maskesi)
  for (let i = 0; i < 26000 && big.length < 7000; i++) {
    const r = 180 + Math.pow(rnd(), 1.7) * 5200;
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (zoneDistance(x, z) < 60) continue;
    const forest = fbm(x / 420 + 11, z / 420 - 7, 3);
    if (forest < 0.56) continue;
    const conifer = fbm(x / 900 - 3, z / 900 + 5, 2) > 0.52;
    addTree(x, z, conifer, (conifer ? 12 : 8) + rnd() * 9);
  }
  // 2) Tarla kenarı ağaç sıraları (rüzgâr kıranlar)
  for (let k = 0; k < 40; k++) {
    const r = 350 + rnd() * 2600;
    const a = rnd() * Math.PI * 2;
    let x = Math.cos(a) * r;
    let z = Math.sin(a) * r;
    const dir = rnd() < 0.5 ? 0.3 : 0.3 + Math.PI / 2;
    const len = 120 + rnd() * 380;
    const poplar = rnd() < 0.5;
    for (let s = 0; s < len; s += 7 + rnd() * 5) {
      const px = x + Math.cos(dir) * s + (rnd() - 0.5) * 2;
      const pz = z + Math.sin(dir) * s + (rnd() - 0.5) * 2;
      if (zoneDistance(px, pz) < 40) continue;
      addTree(px, pz, poplar, (poplar ? 13 : 9) + rnd() * 5);
    }
    x += 0;
    z += 0;
  }
  // 3) Hava üssü çevresinde tek tük ağaç ve çalı (çit dışında)
  for (let i = 0; i < 1200; i++) {
    const x = -600 + rnd() * 1300;
    const z = -700 + rnd() * 1000;
    if (paved(x, z, 25) || zoneDistance(x, z) > 400) continue;
    if (x > -160 && x < 210 && z > -140 && z < 125) {
      // teknik alan içi: yalnız binaların yakınında birkaç çalı
      if (rnd() < 0.85) continue;
      if (paved(x, z, 4)) continue;
      const tile = pick(shrubs);
      small.push({ tile, x, z, s: (1.2 + rnd() * 0.8) / height(tile), tint: 0.85 + rnd() * 0.2 });
      continue;
    }
    if (z > 100 && z < 250) continue; // pist şeridi açık
    if (rnd() < 0.55) {
      const tile = pick(shrubs);
      small.push({ tile, x, z, s: (1.3 + rnd() * 1.4) / height(tile), tint: 0.85 + rnd() * 0.2 });
    } else addTree(x, z, rnd() < 0.3, 6 + rnd() * 8);
  }
  // 4) Çayır öbekleri: kaplamalı alanların dışında, kenarlarda daha sık
  for (let i = 0; i < 30000 && small.length < 9000; i++) {
    const x = -260 + rnd() * 520;
    const z = -260 + rnd() * 520;
    if (paved(x, z, 0.8)) continue;
    // kaplama kenarına yakın yerlerde sık (biçilmemiş şerit)
    const nearEdge = paved(x, z, 6);
    if (!nearEdge && rnd() < 0.6) continue;
    const tile = pick(grass);
    small.push({ tile, x, z, s: (0.45 + rnd() * 0.5) / height(tile), tint: 0.8 + rnd() * 0.35 });
  }

  const { cols, rows, tile: size } = meta as { cols: number; rows: number; tile: number };
  const group = new THREE.Group();
  group.name = 'vegetation';
  group.add(buildBatch(big, color, normal, true, cols, rows, size));
  group.add(buildBatch(small, color, normal, false, cols, rows, size, 260));
  return group;
}
