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
import noonRgb from '../assets/hdri/kloofendal_48d_partly_cloudy_puresky_rgb.webp?url';
import noonL from '../assets/hdri/kloofendal_48d_partly_cloudy_puresky_l.webp?url';
import overcastRgb from '../assets/hdri/overcast_soil_puresky_rgb.webp?url';
import overcastL from '../assets/hdri/overcast_soil_puresky_l.webp?url';
import sunsetRgb from '../assets/hdri/industrial_sunset_puresky_rgb.webp?url';
import sunsetL from '../assets/hdri/industrial_sunset_puresky_l.webp?url';
import hdriManifest from '../assets/hdri/manifest.json';

/**
 * RGB + log parlaklık kodlu HDR'yi (scripts/fetch-assets.mjs → encodeHdr)
 * kayan noktalı DataTexture'a çözer: hdr = srgb⁻¹(rgb) · 2^L.
 * Görüntüler renk yönetimi uygulanmadan okunur (değerler veri gibi).
 */
async function loadEncodedHdr(rgbUrl, lUrl) {
  const [minL, maxL] = hdriManifest[0].lRange;
  const read = async (url) => {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    bmp.close();
    return g.getImageData(0, 0, c.width, c.height);
  };
  const [rgb, lum] = await Promise.all([read(rgbUrl), read(lUrl)]);
  const W = rgb.width;
  const H = rgb.height;
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    lin[i] = x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }
  const scale = new Float32Array(256);
  for (let i = 0; i < 256; i++) scale[i] = 2 ** (minL + (i / 255) * (maxL - minL));
  const data = new Float32Array(W * H * 4);
  const a = rgb.data;
  const l = lum.data;
  for (let i = 0; i < W * H; i++) {
    const k = scale[l[i * 4]];
    data[i * 4] = lin[a[i * 4]] * k;
    data[i * 4 + 1] = lin[a[i * 4 + 1]] * k;
    data[i * 4 + 2] = lin[a[i * 4 + 2]] * k;
    data[i * 4 + 3] = 1;
  }
  // Half-float: çoğu mobil GPU 32 bit float dokuyu doğrusal filtreleyemez
  const half = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(data[i], 65000));
  const tex = new THREE.DataTexture(half, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  // HDRLoader ile aynı düzen: satırlar üstten başlar
  tex.flipY = true;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, raw: { data, width: W, height: H } };
}

/**
 * Havaalanı gökyüzleri (Poly Haven "puresky" HDRI, CC0): fotoğrafta yalnız
 * gökyüzü vardır; ufkun altı oyunun 3B havaalanıdır (core/airfield.ts).
 * Güneş yönü/rengi ve pozlama HDRI'dan hesaplanır; sis rengi ufuktan alınır.
 *  rotation: gökyüzünün dikey eksen etrafında dönüşü (güneşi motorun
 *            yanına/önüne getirmek için)
 *  key:      hedef ortalama parlaklık (pozlama = key / gökyüzü ortalaması)
 *  fog:      sis yoğunluğu (ufuktaki zemin/gökyüzü birleşimini yumuşatır)
 */
export const HDRI_PRESETS = {
  'Havaalanı — öğle': { url: [noonRgb, noonL], rotation: 150, key: 0.2, sunScale: 1.25, fog: 0.00028 },
  'Havaalanı — kapalı': { url: [overcastRgb, overcastL], rotation: 0, key: 0.24, sunScale: 0.5, fog: 0.0009 },
  'Havaalanı — gün batımı': { url: [sunsetRgb, sunsetL], rotation: 200, key: 0.17, sunScale: 1.1, fog: 0.00036 },
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
    fogDensity: 0.0035,
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

  /* ---------------- gökyüzü HDRI'ları ---------------- */
  const hdrCache = new Map();
  let hdriRT = null;
  let hdriToken = 0;
  let hdriActive = false;

  /**
   * En parlak bölgeden güneş yönü/rengi, ortalamadan pozlama, ufuk
   * bandından sis rengi. Veri 8×8 bloklara indirgenir.
   */
  function analyse(raw) {
    const { data, width: W, height: H } = raw;
    const B = 8;
    let best = -1;
    let bi = 0;
    let bj = 0;
    let sum = 0;
    let wsum = 0;
    const bc = [0, 0, 0];
    const hz = [0, 0, 0];
    let hn = 0;
    for (let j = 0; j < H / 2; j += B) {
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
        sum += Math.min(lum, 50) * w;
        wsum += w;
        if (lum > best) {
          best = lum;
          bi = i;
          bj = j;
          bc[0] = r;
          bc[1] = g;
          bc[2] = b;
        }
        // Ufuk bandı (ufkun 2–6° üstü): sis rengi
        if (j > H * 0.45 && j < H * 0.49) {
          hz[0] += r / (B * B);
          hz[1] += g / (B * B);
          hz[2] += b / (B * B);
          hn++;
        }
      }
    }
    const u = (bi + B / 2) / W;
    const v = 1 - (bj + B / 2) / H;
    const phi = (u - 0.5) * 2 * Math.PI;
    const theta = (v - 0.5) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
    const m = Math.max(bc[0], bc[1], bc[2]) || 1;
    return {
      dir,
      color: new THREE.Color(bc[0] / m, bc[1] / m, bc[2] / m),
      peak: best,
      mean: sum / wsum,
      horizon: new THREE.Color(hz[0] / hn, hz[1] / hn, hz[2] / hn),
    };
  }

  async function loadHdri(name) {
    if (hdrCache.has(name)) return hdrCache.get(name);
    const p = HDRI_PRESETS[name];
    const { tex, raw } = await loadEncodedHdr(...p.url);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const entry = { tex, info: analyse(raw) };
    hdrCache.set(name, entry);
    return entry;
  }

  function clearHdri() {
    hdriToken++;
    hdriActive = false;
    scene.backgroundRotation.set(0, 0, 0);
    // Test hücresi ölçüsünde gölge kamerası
    setShadowRange(9, 60);
  }

  function setShadowRange(half, far) {
    const c = sun.shadow.camera;
    if (c.right === half && c.far === far) return;
    c.left = -half;
    c.right = half;
    c.top = half;
    c.bottom = -half;
    c.far = far;
    c.updateProjectionMatrix();
    // Sapma derinlik aralığına göre: ~5 cm; normal sapması doku pikseline göre
    sun.shadow.bias = -0.05 / far;
    sun.shadow.normalBias = Math.max(0.035, (half / 60) * 0.035);
  }

  /**
   * Gökyüzü HDRI'sı: arka plan + güneş + pozlama + sis. Yansıma haritası
   * önce yalnız gökyüzünden üretilir; `captureEnvironment` sonra 3B
   * havaalanını da içeren tam ortamı yakalar.
   */
  async function setHdri(name) {
    const p = HDRI_PRESETS[name];
    if (!p) return false;
    const token = ++hdriToken;
    const { tex, info } = await loadHdri(name);
    if (token !== hdriToken) return false; // bu arada başka ortam seçildi
    hdriActive = true;
    const rot = THREE.MathUtils.degToRad(p.rotation);
    scene.background = tex;
    scene.backgroundRotation.set(0, rot, 0);
    scene.backgroundBlurriness = 0;
    if (hdriRT) hdriRT.dispose();
    hdriRT = pmrem.fromEquirectangular(tex);
    scene.environment = hdriRT.texture;
    scene.environmentRotation.set(0, rot, 0);
    sky.visible = false;
    ground.visible = false;
    // Pozlama: gökyüzü ortalamasını hedef parlaklığa getir
    const exposure = THREE.MathUtils.clamp(p.key / Math.max(info.mean, 1e-4), 0.05, 8);
    renderer.toneMappingExposure = exposure;
    // Sis: ufuk rengi (pozlamadan bağımsız doğrusal renk)
    scene.fog.color.copy(info.horizon);
    scene.fog.density = p.fog;
    // Güneş: HDRI'nın en parlak bölgesinden (dönüşle birlikte)
    const d = info.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    d.y = Math.max(d.y, 0.06);
    d.normalize();
    sun.visible = true;
    sun.position.copy(d).multiplyScalar(320);
    sun.target.position.set(0, 0, 0);
    sun.color.copy(info.color);
    // Güneş/gökyüzü aydınlık oranı R: açık havada ~4, kapalı havada <1.
    // three.js'de yönlü ışık ışıması I·albedo/π, gökyüzününki ≈ albedo·ortalama;
    // bu yüzden I = π · R · ortalama (ortalama = key / pozlama)
    const contrast = Math.log10(info.peak / info.mean + 1);
    const R = THREE.MathUtils.clamp(contrast * p.sunScale, 0.25, 5);
    sun.intensity = (Math.PI * R * p.key) / exposure;
    sun.shadow.radius = contrast < 1.2 ? 12 : 3;
    // Hangarlar, kule, binalar ve saptırma duvarı da gölge atsın
    // (±120 m; 4096 dokuda ~6 cm/piksel, yumuşak PCF ile)
    setShadowRange(120, 640);
    ambient.intensity = 0;
    keyPanel.intensity = 0;
    rimPanel.intensity = 0;
    rampLightA.intensity = 0;
    rampLightB.intensity = 0;
    return true;
  }

  /**
   * Tam ortam yakalama: gökyüzü + 3B çevre (motor gizli) → PMREM.
   * Motorun gövdesinde hangarlar, apron ve blast duvarı yansır.
   */
  function captureEnvironment(hide = []) {
    const was = hide.map((o) => o.visible);
    for (const o of hide) o.visible = false;
    const rt = pmrem.fromScene(scene, 0, 0.1, 60000, { size: 256, position: new THREE.Vector3(0, 0.6, 0) });
    hide.forEach((o, i) => (o.visible = was[i]));
    if (hdriRT) hdriRT.dispose();
    hdriRT = rt;
    scene.environment = rt.texture;
    // Yakalanan küp zaten dünya eksenlerinde
    scene.environmentRotation.set(0, 0, 0);
  }

  /* ---------------- sunum ---------------- */
  const params = { ...PRESETS['Altın saat'], name: 'Altın saat' };

  function refresh() {
    clearHdri();
    sun.shadow.radius = 3;
    setShadowRange(20, 90);
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

  return { sky, sun, ambient, ground, params, refresh, setPreset, setHdri, clearHdri, captureEnvironment, keyPanel, rimPanel, isHdri: () => hdriActive };
}
