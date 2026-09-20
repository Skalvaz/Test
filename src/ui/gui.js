/**
 * Kontrol paneli (lil-gui) ve hazır kamera açıları.
 */

import * as THREE from 'three';
import GUI from 'lil-gui';
import { PRESETS } from '../core/environment.js';

export const CAMERA_VIEWS = {
  'Üç çeyrek ön': { position: [6.4, 1.9, -6.6], target: [0, 0, 0.25], fov: 32, cutaway: false },
  'Hava girişi': { position: [1.7, 0.30, -5.6], target: [0, 0, -1.3], fov: 38, cutaway: false },
  'Fan detayı': { position: [1.05, 0.42, -3.05], target: [0.12, 0.18, -0.55], fov: 40, cutaway: false },
  'Yan profil': { position: [12.0, 0.7, 0.45], target: [0, 0, 0.45], fov: 22, cutaway: false },
  'Egzoz': { position: [4.9, 1.05, 7.6], target: [0, 0, 2.6], fov: 30, cutaway: false },
  'Üstten / pilon': { position: [4.6, 5.4, -4.2], target: [0, 0.6, 0.2], fov: 30, cutaway: false },
  'Kesit': { position: [7.8, 1.4, 0.7], target: [0, 0, 0.95], fov: 28, cutaway: true },
};

const TONE_MAPPINGS = {
  AgX: THREE.AgXToneMapping,
  'ACES Filmic': THREE.ACESFilmicToneMapping,
  Neutral: THREE.NeutralToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
};

export function createGui(app) {
  const { engine, env, fx, renderer, camera, options } = app;
  const gui = new GUI({ title: 'TURBOFAN · KONTROL' });
  gui.domElement.classList.add('engine-gui');

  /* ---------------- motor ---------------- */
  const fMotor = gui.addFolder('Motor');
  fMotor.add(engine.state, 'throttle', 0, 1, 0.001).name('Gaz kolu');
  fMotor.add(engine.state, 'running').name('Çalışıyor');
  fMotor.add(engine.state, 'spinScale', 0.005, 0.25, 0.005).name('Görsel devir ölçeği');
  fMotor.add(engine.state, 'motionBlur').name('Hareket bulanıklığı');

  const quick = {
    idle: () => { engine.state.running = true; engine.state.throttle = 0.0; },
    climb: () => { engine.state.running = true; engine.state.throttle = 0.62; },
    takeoff: () => { engine.state.running = true; engine.state.throttle = 1.0; },
    shutdown: () => { engine.state.running = false; engine.state.throttle = 0; },
  };
  fMotor.add(quick, 'idle').name('▸ Rölanti');
  fMotor.add(quick, 'climb').name('▸ Tırmanış gücü');
  fMotor.add(quick, 'takeoff').name('▸ Kalkış gücü');
  fMotor.add(quick, 'shutdown').name('▸ Motoru kes');
  fMotor.open();

  /* ---------------- kamera ---------------- */
  const fCam = gui.addFolder('Kamera');
  const camState = { view: 'Üç çeyrek ön' };
  fCam
    .add(camState, 'view', Object.keys(CAMERA_VIEWS))
    .name('Açı')
    .onChange((v) => app.goToView(v));
  fCam.add(options, 'autoRotate').name('Otomatik tur');
  fCam.add(options, 'autoRotateSpeed', 0.05, 2, 0.05).name('Tur hızı');
  fCam
    .add(camera, 'fov', 12, 75, 1)
    .name('Odak (FOV)')
    .onChange(() => camera.updateProjectionMatrix())
    .listen();

  /* ---------------- ortam ---------------- */
  const fEnv = gui.addFolder('Ortam ve ışık');
  const envState = { preset: 'Altın saat' };
  fEnv
    .add(envState, 'preset', Object.keys(PRESETS))
    .name('Hazır ortam')
    .onChange((v) => {
      env.setPreset(v);
      exposureCtrl.updateDisplay();
      elevationCtrl.updateDisplay();
      azimuthCtrl.updateDisplay();
    });
  const elevationCtrl = fEnv
    .add(env.params, 'elevation', -6, 88, 0.1)
    .name('Güneş yüksekliği')
    .onChange(() => env.refresh());
  const azimuthCtrl = fEnv
    .add(env.params, 'azimuth', 0, 360, 1)
    .name('Güneş azimutu')
    .onChange(() => env.refresh());
  fEnv
    .add(env.params, 'turbidity', 1, 20, 0.1)
    .name('Atmosfer bulanıklığı')
    .onChange(() => env.refresh());
  const exposureCtrl = fEnv
    .add(env.params, 'exposure', 0.15, 2.0, 0.01)
    .name('Pozlama')
    .onChange((v) => { renderer.toneMappingExposure = v; });
  const toneState = { mode: 'AgX' };
  fEnv
    .add(toneState, 'mode', Object.keys(TONE_MAPPINGS))
    .name('Ton eşleme')
    .onChange((v) => {
      renderer.toneMapping = TONE_MAPPINGS[v];
      app.scene.traverse((o) => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => (m.needsUpdate = true));
        }
      });
    });
  fEnv.add(env.ground, 'visible').name('Zemin');

  /* ---------------- görünüm ---------------- */
  const fView = gui.addFolder('Görünüm');
  const viewState = { cutaway: false };
  fView
    .add(viewState, 'cutaway')
    .name('Kesit görünümü')
    .onChange((v) => app.setCutaway(v));
  fView
    .add(app.clipState, 'offset', -1.6, 1.6, 0.01)
    .name('Kesit düzlemi');
  fView
    .add(options, 'pylon')
    .name('Pilon')
    .onChange((v) => (engine.parts.pylon.group.visible = v));
  fView
    .add(options, 'wing')
    .name('Kanat kökü')
    .onChange((v) => (engine.parts.pylon.wing.visible = v));
  fView
    .add(options, 'plume')
    .name('Egzoz akışı')
    .onChange((v) => (engine.parts.plume.mesh.visible = v));
  fView.add(options, 'hud').name('Telemetri paneli').onChange((v) => {
    document.querySelector('.hud').style.display = v ? '' : 'none';
  });

  /* ---------------- görüntü işleme ---------------- */
  const fFx = gui.addFolder('Görüntü işleme');
  fFx.add(fx.bloom, 'strength', 0, 1.5, 0.01).name('Bloom');
  fFx.add(fx.bloom, 'threshold', 0.5, 1.0, 0.005).name('Bloom eşiği');
  fFx.add(fx.bloom, 'radius', 0, 1.5, 0.01).name('Bloom yarıçapı');
  fFx.add(fx.gtao, 'enabled').name('Ortam kapanımı (AO)');
  fFx.add(fx.gtao, 'blendIntensity', 0, 1.5, 0.01).name('AO şiddeti');
  fFx.add(options, 'haze', 0, 3, 0.05).name('Isı kırılması');
  fFx.add(fx.grade.uniforms.uGrain, 'value', 0, 0.12, 0.001).name('Film greni');
  fFx.add(fx.grade.uniforms.uVignette, 'value', 0, 1, 0.01).name('Vinyet');
  fFx.add(fx.grade.uniforms.uChroma, 'value', 0, 0.006, 0.0001).name('Renk sapması');
  fFx.add(fx.smaa, 'enabled').name('Kenar yumuşatma');

  gui.add({ shot: () => app.screenshot() }, 'shot').name('📷 Ekran görüntüsü al');

  return gui;
}
