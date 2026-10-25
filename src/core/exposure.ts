/**
 * Pozlama (Dalga 0'da environment.js ve App'ten ayrıldı): ton eşlemenin
 * pozlamasının (`renderer.toneMappingExposure`) tek yazıcısı. Bugün ortam
 * başına el ayarlı/gökyüzünden hesaplanan çarpan. Sahibi 2A: EV100 ile
 * fiziksel pozlama (öğle ~15, kapalı ~12, gün batımı ~10,5) ve ortam başına
 * LUT buraya gelir; 2B (ortam) bu dosyaya dokunmaz, buradan çağırır.
 *
 * Bugünkü değerler: hücre 0,95 (ışık kısılınca göz uyumu: × (1 + 0,6·(1−k))),
 * öğle ~0,42, kapalı ~0,19, gün batımı ~0,18 (HDRI anahtar parlaklığından),
 * gece 1,05 (prosedürel gökyüzü ön ayarı).
 */

import * as THREE from 'three';

/** Test hücresinin (tam ışık) pozlaması */
export const CELL_EXPOSURE = 0.95;

/** Pozlamayı yazar (bütün yazımlar buradan geçer) */
export function setExposure(renderer: THREE.WebGLRenderer, value: number) {
  renderer.toneMappingExposure = value;
}

export function getExposure(renderer: THREE.WebGLRenderer): number {
  return renderer.toneMappingExposure;
}

/**
 * HDRI gökyüzünün pozlaması: gökyüzü ortalamasını hedef parlaklığa (ön
 * ayarın `key` değeri) getirir.
 */
export function hdriExposure(key: number, skyMean: number): number {
  return THREE.MathUtils.clamp(key / Math.max(skyMean, 1e-4), 0.05, 8);
}

/** Hücre ışık seviyesine göre pozlama (karanlıkta göz uyumu) */
export function cellExposure(level: number): number {
  const k = Math.max(0, Math.min(1, level));
  return CELL_EXPOSURE * (1 + 0.6 * (1 - k));
}
