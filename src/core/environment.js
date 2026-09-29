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
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import hangarUrl from '../assets/hdri/hangar_interior_2k.hdr?url';
import apronUrl from '../assets/hdri/hanger_exterior_cloudy_2k.hdr?url';
import workshopUrl from '../assets/hdri/machine_shop_02_2k.hdr?url';

/** Motor ve efektlerin varsaydığı zemin yüksekliği (test hücresiyle aynı) */
const GROUND_Y = -3.35;

/**
 * Fotoğraf tabanlı ortamlar (Poly Haven HDRI, CC0). Görüntü zemine
 * yansıtılır (GroundedSkybox): motor fotoğraftaki zeminin üstünde durur.
 * Güneş yönü, rengi ve pozlama HDRI'nın kendisinden hesaplanır.
 *  floor:    zemin yüksekliği (m). Fotoğraf yaklaşık motor ekseni
 *            yüksekliğinden çekilmiş sayılır (GroundedSkybox height =
 *            −floor): kamera motor çevresinde dolaşırken zemin projeksiyonu
 *            bozulmaz. Test hücresindeki −3.35 m burada fazla yüksek kalır.
 *  rotation: HDRI'nın dikey eksen etrafında dönüşü (motoru ilginç bir
 *            arka plana bakacak şekilde yerleştirmek için)
 *  key:      hedef ortalama parlaklık (pozlama = key / HDRI ortalaması)
 */
export const HDRI_PRESETS = {
  Hangar: { url: hangarUrl, floor: -2.4, radius: 60, rotation: 200, key: 0.5, sunScale: 1.0 },
  'Apron (bulutlu)': { url: apronUrl, floor: -2.4, radius: 120, rotation: 100, key: 0.5, sunScale: 0.6 },
  'Motor atölyesi': { url: workshopUrl, floor: -2.4, radius: 50, rotation: 140, key: 0.36, sunScale: 0.8 },
};

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

  // HDRI ortamlarında motorun gölgesini alan görünmez zemin
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = GROUND_Y + 0.01;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.visible = false;
  scene.add(shadowCatcher);

  /* ---------------- HDRI ortamları ---------------- */
  const hdrCache = new Map();
  let skybox = null;
  let hdriRT = null;
  let hdriToken = 0;

  /**
   * En parlak bölgeden güneş yönü/rengi ve ortalama parlaklıktan pozlama.
   * Veri 8×8 bloklara indirgenir (tek piksel parlamalarını yok sayar).
   */
  function analyse(tex) {
    const { data, width: W, height: H } = tex.image;
    const B = 8;
    let best = -1;
    let bi = 0;
    let bj = 0;
    let sum = 0;
    let wsum = 0;
    const bc = [0, 0, 0];
    for (let j = 0; j < H; j += B) {
      // Enlem ağırlığı (kutuplar küçük alan)
      const lat = ((j + B / 2) / H - 0.5) * Math.PI;
      const w = Math.cos(lat);
      for (let i = 0; i < W; i += B) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let y = j; y < Math.min(H, j + B); y++) {
          for (let x = i; x < Math.min(W, i + B); x++) {
            const k = (y * W + x) * 4;
            r += data[k];
            g += data[k + 1];
            b += data[k + 2];
          }
        }
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / (B * B);
        sum += lum * w;
        wsum += w;
        // Güneş adayı: ufkun üstünde
        if (j < H / 2 && lum > best) {
          best = lum;
          bi = i;
          bj = j;
          bc[0] = r;
          bc[1] = g;
          bc[2] = b;
        }
      }
    }
    const u = (bi + B / 2) / W;
    const v = 1 - (bj + B / 2) / H;
    const phi = (u - 0.5) * 2 * Math.PI;
    const theta = (v - 0.5) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
    const m = Math.max(bc[0], bc[1], bc[2]) || 1;
    return { dir, color: new THREE.Color(bc[0] / m, bc[1] / m, bc[2] / m), peak: best, mean: sum / wsum };
  }

  async function loadHdri(name) {
    if (hdrCache.has(name)) return hdrCache.get(name);
    const p = HDRI_PRESETS[name];
    const tex = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(p.url);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const info = analyse(tex);
    const entry = { tex, info };
    hdrCache.set(name, entry);
    return entry;
  }

  function clearHdri() {
    hdriToken++;
    if (skybox) {
      scene.remove(skybox);
      skybox.geometry.dispose();
      skybox.material.dispose();
      skybox = null;
    }
    shadowCatcher.visible = false;
  }

  /** Fotoğraf tabanlı ortam: HDRI ışığı, yansımalar, zemine yansıtılmış arka plan */
  async function setHdri(name) {
    const p = HDRI_PRESETS[name];
    if (!p) return false;
    const token = ++hdriToken;
    const { tex, info } = await loadHdri(name);
    if (token !== hdriToken) return false; // bu arada başka ortam seçildi
    if (skybox) {
      scene.remove(skybox);
      skybox.geometry.dispose();
      skybox.material.dispose();
    }
    const rot = THREE.MathUtils.degToRad(p.rotation);
    skybox = new GroundedSkybox(tex, -p.floor, p.radius);
    skybox.position.y = 0;
    skybox.rotation.y = rot;
    scene.add(skybox);
    if (hdriRT) hdriRT.dispose();
    hdriRT = pmrem.fromEquirectangular(tex);
    scene.environment = hdriRT.texture;
    scene.environmentRotation.set(0, rot, 0);
    scene.background = null;
    sky.visible = false;
    ground.visible = false;
    shadowCatcher.visible = true;
    shadowCatcher.position.y = p.floor + 0.01;
    scene.fog.density = 0;
    // Pozlama: ortalama parlaklığı orta griye getir
    renderer.toneMappingExposure = THREE.MathUtils.clamp(p.key / Math.max(info.mean, 1e-4), 0.05, 8);
    // Güneş: HDRI'nın en parlak bölgesinden (ortam dönüşüyle birlikte)
    const d = info.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    // Çok alçak güneş upuzun gölgeler çizer; iç mekânda ışık zaten yukarıdan
    d.y = Math.max(d.y, 0.45);
    d.normalize();
    sun.visible = true;
    sun.position.copy(d).multiplyScalar(25);
    sun.target.position.set(0, 0, 0);
    sun.color.copy(info.color);
    // Güneşin gücü tepe/ortalama oranıyla ölçeklenir (bulutlu havada zayıf gölge)
    sun.intensity = THREE.MathUtils.clamp(Math.log10(info.peak / info.mean + 1) * p.sunScale, 0.3, 2.6);
    // Dağınık ışıkta (bulutlu hava) gölge hem soluk hem yumuşak
    // İç mekânda ışık büyük kapı/pencerelerden gelir: gölge hep yumuşak
    shadowCatcher.material.opacity = THREE.MathUtils.clamp(0.1 + sun.intensity * 0.14, 0.15, 0.38);
    sun.shadow.radius = 10;
    ambient.intensity = 0.05;
    keyPanel.intensity = 0;
    rimPanel.intensity = 0;
    rampLightA.intensity = 0;
    rampLightB.intensity = 0;
    return true;
  }

  /* ---------------- sunum ---------------- */
  const params = { ...PRESETS['Altın saat'], name: 'Altın saat' };

  function refresh() {
    clearHdri();
    sun.shadow.radius = 3;
    scene.environmentRotation.set(0, 0, 0);
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

  return { sky, sun, ambient, ground, params, refresh, setPreset, setHdri, clearHdri, keyPanel, rimPanel, shadowCatcher };
}
