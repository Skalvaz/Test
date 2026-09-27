/**
 * Motor test hücresi ortamı.
 *
 * Geometri ve ışık Blender'da üretilir (blender/testcell.py): Cycles global
 * aydınlatması doku haritalarına pişirilmiştir. Burada:
 *  - pişirilmiş yüzeyler aydınlatmasız (MeshBasicMaterial) gösterilir,
 *  - armatür, gün ışığı ve monitör yüzeyleri parlak yapılır (bloom yakalar),
 *  - hücrenin kendisinden bir küp ortam haritası üretilir: motorun metal
 *    yüzeyleri gökyüzü değil, içinde bulunduğu odayı yansıtır,
 *  - motorun keskin gölgesi için zemine görünmez bir gölge yakalayıcı konur
 *    (yumuşak ortam gölgesi zaten pişirilmiştir).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import cellUrl from '../assets/testcell.glb?url';

/** Blender betiğindeki --exposure'ın tersi: pişirilen değerler 0.5 ile ölçeklenir. */
const BAKE_GAIN = 2.0;
const FLOOR_Y = -3.35;

export const CELL_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-12.9, FLOOR_Y + 0.25, -21.2),
  new THREE.Vector3(12.9, 10.8, 15.2),
);

export interface TestCell {
  root: THREE.Group;
  envMap: THREE.Texture;
  shadowCatcher: THREE.Mesh;
}

export async function loadTestCell(renderer: THREE.WebGLRenderer): Promise<TestCell> {
  const gltf = await new GLTFLoader().loadAsync(cellUrl);
  const root = new THREE.Group();
  root.name = 'test-cell';
  root.add(gltf.scene);

  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    const name = src.name ?? '';
    let mat: THREE.Material;
    if (name.startsWith('EMIT')) {
      // Parlayan yüzey: yayım rengi × şiddet, tonemap sonrası bloom eşiğini aşar
      const c = src.emissive.clone().multiplyScalar(Math.max(1, src.emissiveIntensity) * 1.4);
      mat = new THREE.MeshBasicMaterial({ color: c, fog: false });
    } else if (name.startsWith('GLASS')) {
      mat = new THREE.MeshPhysicalMaterial({
        color: 0x0b1318,
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.45,
        envMapIntensity: 1.6,
      });
    } else {
      const map = src.map;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(BAKE_GAIN, BAKE_GAIN, BAKE_GAIN), fog: false });
    }
    src.dispose();
    mesh.material = mat;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

  // Motorun keskin gölgesini alan görünmez zemin
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 36),
    new THREE.ShadowMaterial({ opacity: 0.38 }),
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.set(0, FLOOR_Y + 0.006, -2);
  shadowCatcher.receiveShadow = true;
  root.add(shadowCatcher);

  // Hücreden ortam haritası (motor henüz sahnede değilken, motorun konumundan)
  const temp = new THREE.Scene();
  temp.add(root);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(temp, 0.02, 0.1, 80, { size: 256, position: new THREE.Vector3(3.5, 0.5, -1.5) });
  pmrem.dispose();
  temp.remove(root);

  return { root, envMap: rt.texture, shadowCatcher };
}
