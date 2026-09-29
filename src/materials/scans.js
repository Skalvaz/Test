/**
 * Gerçek malzeme taramaları (ambientCG, CC0; bkz. scripts/fetch-assets.mjs).
 *
 * Taramalar ikinci UV kanalına (uv1) bağlanır. uv1 metre cinsindendir ve
 * model üretildikten sonra her geometriye eklenir (geom.js → ensureUV1):
 * silindirik gövdelerde çevre × eksen, diğerlerinde yüz normaline göre
 * izdüşüm. Böylece mevcut dokular (ısı renklenmesi, panel detayları,
 * kanat dokuları) kanal 0'da aynen kalır, tarama her yüzeyde gerçek
 * boyutunda görünür.
 */

import * as THREE from 'three';
import manifest from '../assets/scans/manifest.json';

const urls = import.meta.glob('../assets/scans/*.webp', { query: '?url', import: 'default', eager: true });

/**
 * @returns {Promise<Record<string, { color: THREE.Texture, normal: THREE.Texture, orm: THREE.Texture, meta: object }>>}
 */
export async function loadScans(renderer) {
  const loader = new THREE.TextureLoader();
  const aniso = renderer?.capabilities.getMaxAnisotropy() ?? 8;
  const load = async (name, map, srgb) => {
    const url = urls[`../assets/scans/${name}_${map}.webp`];
    const t = await loader.loadAsync(url);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.channel = 1;
    return t;
  };
  const out = {};
  await Promise.all(
    manifest.map(async (meta) => {
      const [color, normal, orm] = await Promise.all([
        load(meta.name, 'color', true),
        load(meta.name, 'normal', false),
        load(meta.name, 'orm', false),
      ]);
      for (const t of [color, normal, orm]) t.repeat.setScalar(1 / meta.size);
      out[meta.name] = { color, normal, orm, meta };
    }),
  );
  return out;
}

/**
 * Taramadan PBR malzeme parametreleri.
 * @param {object} scan loadScans çıktısındaki bir kayıt
 * @param {object} o
 *   color: hedef ortalama renk (tint taramalarında gri tonlama bununla çarpılır)
 *   metal: taramanın metallik haritası yoksa kullanılacak değer
 *   rough: pürüzlülük çarpanı (1 = tarama olduğu gibi)
 *   normal: normal haritası şiddeti
 *   useMap: false → yalnız normal/pürüzlülük (renk haritası başka iş görüyorsa)
 */
export function scanParams(scan, o = {}) {
  const { color = 0xffffff, metal = null, rough = 1, normal = 1, useMap = true, ao = 0.6 } = o;
  const p = {
    normalMap: scan.normal,
    normalScale: new THREE.Vector2(normal, normal),
    roughnessMap: scan.orm,
    roughness: rough,
    aoMap: scan.orm,
    aoMapIntensity: ao,
  };
  if (useMap) {
    p.map = scan.color;
    const c = new THREE.Color(color);
    // Gri tonlamalı taramanın doğrusal ortalaması 1'e çekilir: yüzeyin
    // ortalama rengi `color` olur, çizik ve lekeler etrafında dalgalanır
    if (scan.meta.kind === 'tint' && scan.meta.mean) c.multiplyScalar(1 / Math.max(scan.meta.mean, 0.05));
    p.color = c;
  } else {
    p.color = new THREE.Color(color);
  }
  if (scan.meta.hasMetal && metal === null) {
    p.metalnessMap = scan.orm;
    p.metalness = 1;
  } else {
    p.metalness = metal ?? 0;
  }
  return p;
}
