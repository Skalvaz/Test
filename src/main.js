/**
 * Hiper gerçekçi turbofan — uygulama girişi.
 *
 * Akış: renderer → malzemeler (prosedürel dokular) → ortam (gökyüzü + IBL)
 * → motor geometrisi → post-process zinciri → arayüz → çizim döngüsü.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials, applyClipping } from './materials/library.js';
import { createEnvironment } from './core/environment.js';
import { createComposer } from './core/postfx.js';
import { buildEngine } from './engine/index.js';
import { createHud, createStats } from './ui/hud.js';
import { createGui, CAMERA_VIEWS } from './ui/gui.js';

const container = document.getElementById('app');
const loader = document.getElementById('loading');
const loaderText = document.getElementById('loading-text');

const step = (text) =>
  new Promise((resolve) => {
    loaderText.textContent = text;
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

async function init() {
  /* ---------------- renderer ---------------- */
  const renderer = new THREE.WebGLRenderer({
    antialias: false, // kenar yumuşatma SMAA ile yapılır
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true, // ekran görüntüsü alabilmek için
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    32,
    window.innerWidth / window.innerHeight,
    0.1,
    3000,
  );
  camera.position.set(6.4, 1.9, -6.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 2.2;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.86;
  controls.target.set(0, 0, 0.25);
  controls.update();

  await step('Yüzey dokuları üretiliyor…');
  const materials = createMaterials(renderer);

  await step('Gökyüzü ve ortam haritası hesaplanıyor…');
  const env = createEnvironment(renderer, scene, materials);

  await step('Fan kanatları ve çekirdek modelleniyor…');
  const engine = buildEngine(materials);
  scene.add(engine.root);

  await step('Görüntü işleme zinciri kuruluyor…');
  const fx = createComposer(renderer, scene, camera);

  /* ---------------- kesit (cutaway) ---------------- */
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const clipState = { enabled: false, offset: 0 };

  function setCutaway(enabled) {
    clipState.enabled = enabled;
    applyClipping(materials, enabled ? [clipPlane] : []);
  }
  setCutaway(false);

  /* ---------------- kamera geçişleri ---------------- */
  const camAnim = {
    active: false,
    t: 0,
    duration: 1.5,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  };

  function goToView(name, immediate = false) {
    const view = CAMERA_VIEWS[name];
    if (!view) return;
    if (immediate) {
      camera.position.set(...view.position);
      controls.target.set(...view.target);
      camAnim.active = false;
      if (view.fov) {
        camera.fov = view.fov;
        camera.updateProjectionMatrix();
      }
      if (typeof view.cutaway === 'boolean') setCutaway(view.cutaway);
      controls.update();
      return;
    }
    camAnim.fromPos.copy(camera.position);
    camAnim.toPos.set(...view.position);
    camAnim.fromTarget.copy(controls.target);
    camAnim.toTarget.set(...view.target);
    camAnim.t = 0;
    camAnim.active = true;
    if (view.fov) {
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
    }
    if (typeof view.cutaway === 'boolean') setCutaway(view.cutaway);
  }

  /* ---------------- arayüz ---------------- */
  const hud = createHud(container);
  const stats = createStats(container, renderer);

  const app = {
    renderer, scene, camera, controls, materials, env, engine, fx,
    clipState, setCutaway, goToView,
    options: {
      autoRotate: false,
      autoRotateSpeed: 0.35,
      plume: true,
      pylon: true,
      wing: false,
      hud: true,
      haze: 1.0,
    },
    screenshot,
  };
  window.__engineApp = app;

  createGui(app);

  /* ---------------- ekran görüntüsü ---------------- */
  function screenshot() {
    renderer.domElement.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `turbofan-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  /* ---------------- yeniden boyutlandırma ---------------- */
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    fx.composer.setSize(w, h);
    fx.grade.uniforms.uAspect.value = w / h;
  }
  window.addEventListener('resize', onResize);

  /* ---------------- ısı kırılması konumu ---------------- */
  const nozzlePoint = new THREE.Vector3();
  const plumePoint = new THREE.Vector3();

  function updateHaze(dt) {
    nozzlePoint.set(0, 0, 3.35).project(camera);
    plumePoint.set(0, 0, 9.5).project(camera);

    fx.grade.uniforms.uHazeA.value.set(
      nozzlePoint.x * 0.5 + 0.5,
      nozzlePoint.y * 0.5 + 0.5,
    );
    fx.grade.uniforms.uHazeB.value.set(
      plumePoint.x * 0.5 + 0.5,
      plumePoint.y * 0.5 + 0.5,
    );

    // Egzoz kameraya ne kadar yakınsa kırılma o kadar geniş görünür
    const dist = camera.position.distanceTo(new THREE.Vector3(0, 0, 4.5));
    fx.grade.uniforms.uHazeWidth.value = THREE.MathUtils.clamp(1.3 / dist, 0.04, 0.24);

    const thrust = engine.state.n1;
    fx.grade.uniforms.uHaze.value =
      app.options.haze * THREE.MathUtils.smoothstep(thrust, 0.2, 0.95);
    fx.grade.uniforms.uTime.value += dt;
  }

  /* ---------------- döngü ---------------- */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    if (camAnim.active) {
      camAnim.t += dt / camAnim.duration;
      const k = THREE.MathUtils.smootherstep(Math.min(camAnim.t, 1), 0, 1);
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
      controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
      if (camAnim.t >= 1) camAnim.active = false;
    }

    controls.autoRotate = app.options.autoRotate && !camAnim.active;
    controls.autoRotateSpeed = app.options.autoRotateSpeed;
    controls.update();

    clipPlane.constant = clipState.offset;

    engine.update(dt);
    updateHaze(dt);

    if (app.options.hud) hud.update(engine.telemetry());

    fx.composer.render(dt);
    stats.update();
  }

  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 700);
  animate();
}

init().catch((err) => {
  console.error(err);
  loaderText.textContent = `Hata: ${err.message}`;
});
