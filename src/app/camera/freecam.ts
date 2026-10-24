/**
 * Serbest kamera (Dalga 0'da CameraRig'den ayrıldı): fareyle yörünge,
 * yakınlaşma, otomatik dönüş ve kapalı alan sınırı. Sahibi: Dalga 3'te 3A
 * (fotoğraf kipi: serbest uçuş, alan derinliği odağı).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Oyunun yörünge kontrolü (sönümlü, yerin altına inmez) */
export function createOrbit(camera: THREE.PerspectiveCamera, dom: HTMLElement, position: [number, number, number], target: [number, number, number]): OrbitControls {
  camera.position.set(...position);
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.2;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.86;
  controls.target.set(...target);
  controls.update();
  return controls;
}

/** Kare başı yörünge adımı: çekim geçişi sürerken otomatik dönüş durur */
export function stepOrbit(controls: OrbitControls, autoRotate: boolean, shotActive: boolean) {
  controls.autoRotate = autoRotate && !shotActive;
  controls.autoRotateSpeed = 0.35;
  controls.update();
}

/** Kamerayı kapalı alanın (test hücresi) içinde tutar */
export function clampToBounds(camera: THREE.Camera, bounds: THREE.Box3 | null) {
  if (bounds) camera.position.clamp(bounds.min, bounds.max);
}
