/**
 * Sahne ortamı.
 *
 * Fotogerçekçiliğin büyük kısmı geometriden değil aydınlatmadan gelir.
 * Burada fiziksel gökyüzü modeli (Preetham) gerçek zamanlı olarak bir ortam
 * haritasına (PMREM) dönüştürülür; metal yüzeyler gökyüzünü ve zemini
 * gerçekten yansıtır. Ayrıca yönlü güneş ışığı (gölgeli) ve stüdyo tipi
 * dikdörtgen alan ışıkları uzun, inandırıcı parlama izleri üretir.
 */

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export const PRESETS = {
  'Altın saat': {
    elevation: 4.5,
    azimuth: 128,
    turbidity: 5.2,
    rayleigh: 2.6,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.86,
    sunColor: 0xffc48a,
    sunIntensity: 2.5,
    ambient: 0.28,
    exposure: 0.56,
    fog: 0x8c7a6a,
    fogDensity: 0.0055,
    fillColor: 0xbcd3ff,
    fillIntensity: 1.3,
  },
  'Öğle güneşi': {
    elevation: 58,
    azimuth: 152,
    turbidity: 3.0,
    rayleigh: 1.4,
    mieCoefficient: 0.004,
    mieDirectionalG: 0.8,
    sunColor: 0xfff3e2,
    sunIntensity: 3.6,
    ambient: 0.42,
    exposure: 0.42,
    fog: 0xa9c4dd,
    fogDensity: 0.0032,
    fillColor: 0xdce9ff,
    fillIntensity: 0.9,
  },
  'Kapalı hava': {
    elevation: 22,
    azimuth: 190,
    turbidity: 14.0,
    rayleigh: 0.6,
    mieCoefficient: 0.02,
    mieDirectionalG: 0.72,
    sunColor: 0xd7dde6,
    sunIntensity: 1.1,
    ambient: 0.70,
    exposure: 0.60,
    fog: 0xb6bfc9,
    fogDensity: 0.010,
    fillColor: 0xe6eef8,
    fillIntensity: 1.8,
  },
  'Gece apronu': {
    elevation: -3.2,
    azimuth: 210,
    turbidity: 8.0,
    rayleigh: 0.35,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.8,
    sunColor: 0x6d86b8,
    sunIntensity: 0.30,
    ambient: 0.10,
    exposure: 1.05,
    fog: 0x0a0e15,
    fogDensity: 0.02,
    fillColor: 0xffc98c,
    fillIntensity: 5.5,
  },
};

export function createEnvironment(renderer, scene, materials) {
  RectAreaLightUniformsLib.init();

  /* ---------------- gökyüzü ---------------- */
  const sky = new Sky();
  sky.scale.setScalar(45000);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const skyScene = new THREE.Scene();
  let envRT = null;

  /* ---------------- ışıklar ---------------- */
  const sun = new THREE.DirectionalLight(0xffffff, 4.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const ambient = new THREE.HemisphereLight(0xbcd8ff, 0x2b2b2b, 0.5);
  scene.add(ambient);

  // Stüdyo tipi yumuşak ışıklar: metalde uzun yansıma şeritleri
  const keyPanel = new THREE.RectAreaLight(0xffffff, 2.5, 9, 3.2);
  keyPanel.position.set(-6.5, 4.6, -3.2);
  keyPanel.lookAt(0, 0.2, 0);
  scene.add(keyPanel);

  const rimPanel = new THREE.RectAreaLight(0xcfe2ff, 2.0, 8, 2.6);
  rimPanel.position.set(6.0, 3.4, 3.6);
  rimPanel.lookAt(0, 0.1, 0.4);
  scene.add(rimPanel);

  // Gece modunda devreye giren apron aydınlatması
  const rampLightA = new THREE.PointLight(0xffb066, 0, 40, 2);
  rampLightA.position.set(-7, 6.5, -6);
  const rampLightB = new THREE.PointLight(0x9fc2ff, 0, 40, 2);
  rampLightB.position.set(8, 5.5, 5);
  scene.add(rampLightA, rampLightB);

  /* ---------------- zemin ---------------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 1, 1), materials.tarmac);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3.35;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.fog = new THREE.FogExp2(0x9fb2c4, 0.006);

  /* ---------------- sunum ---------------- */
  const params = { ...PRESETS['Altın saat'], name: 'Altın saat' };

  function refresh() {
    const u = sky.material.uniforms;
    u.turbidity.value = params.turbidity;
    u.rayleigh.value = params.rayleigh;
    u.mieCoefficient.value = params.mieCoefficient;
    u.mieDirectionalG.value = params.mieDirectionalG;

    const phi = THREE.MathUtils.degToRad(90 - params.elevation);
    const theta = THREE.MathUtils.degToRad(params.azimuth);
    const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sunPos);

    sun.position.copy(sunPos).multiplyScalar(25);
    sun.target.position.set(0, 0, 0);
    sun.color.setHex(params.sunColor);
    sun.intensity = params.sunIntensity;
    sun.visible = params.sunIntensity > 0.05;

    ambient.intensity = params.ambient;
    keyPanel.color.setHex(params.fillColor);
    keyPanel.intensity = params.fillIntensity;
    rimPanel.intensity = params.fillIntensity * 0.7;

    const night = params.elevation < 0;
    rampLightA.intensity = night ? 320 : 0;
    rampLightB.intensity = night ? 180 : 0;

    scene.fog.color.setHex(params.fog);
    scene.fog.density = params.fogDensity;
    renderer.toneMappingExposure = params.exposure;

    // Ortam haritasını yeniden üret
    if (envRT) envRT.dispose();
    skyScene.add(sky);
    envRT = pmrem.fromScene(skyScene);
    scene.add(sky);
    scene.environment = envRT.texture;
    scene.background = envRT.texture;
    scene.backgroundBlurriness = 0.0;
  }

  function setPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    Object.assign(params, preset, { name });
    refresh();
  }

  refresh();

  return { sky, sun, ambient, ground, params, refresh, setPreset, keyPanel, rimPanel };
}
