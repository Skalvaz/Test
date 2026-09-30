/**
 * Kanat laboratuvarı (yalnız geliştirme): tek bir kanadı/kademeyi kontrollü
 * ışıkta render eder. URL: /lab/blades.html?obj=hpt&view=3q
 * Oyuna dahil edilmez (vite build yalnız index.html'i paketler).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadScans } from '../src/materials/scans.js';
import { loadPanelDetails } from '../src/materials/textures.js';
import { createMaterials } from '../src/materials/library.js';
import { LAB_OBJECTS } from './objects';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = Number(q.get('exp') ?? 1.1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202326);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;
const sun = new THREE.DirectionalLight(0xfff4e6, 2.6);
sun.position.set(3, 5, -2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -2;
sun.shadow.camera.right = sun.shadow.camera.top = 2;
scene.add(sun);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.005, 100);
const controls = new OrbitControls(camera, renderer.domElement);

(async () => {
  const details = await loadPanelDetails().catch(() => null);
  const scans = await loadScans(renderer).catch(() => null);
  const materials = createMaterials(renderer, details, null, scans);
  const name = q.get('obj') ?? 'hpt';
  const def = LAB_OBJECTS[name];
  const obj = def.build(materials, q);
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const view = (q.get('view') ?? def.view ?? '3q').split(',').map(Number);
  const dir = new THREE.Vector3(view[0] ?? 1, view[1] ?? 0.6, view[2] ?? -1).normalize();
  const dist = size * Number(q.get('dist') ?? def.dist ?? 1.2);
  camera.position.copy(c).addScaledVector(dir, dist);
  controls.target.copy(c);
  if (def.target) controls.target.set(...def.target);
  controls.update();
  let tris = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const g = m.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += n * ((m as THREE.InstancedMesh).count ?? 1);
  });
  document.getElementById('info')!.textContent = `${name}  üçgen: ${Math.round(tris).toLocaleString()}`;
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  (window as unknown as { __labReady: boolean }).__labReady = true;
})();
