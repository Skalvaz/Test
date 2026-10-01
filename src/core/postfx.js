/**
 * Post-process zinciri.
 *
 *   RenderPass → GTAO (temas gölgeleri) → Bloom → ton eşleme →
 *   kamera derecelendirmesi (ısı kırılması, renk sapması, vinyet, film grenli) → SMAA
 *
 * Sıcak egzozun arkasındaki görüntüyü kıvıran kırılma etkisi ekran uzayında
 * hesaplanır: lüle ağzı ve akış ucu her karede ekrana yansıtılır, aradaki
 * doğru parçasına olan uzaklık bir maske üretir ve o bölgede UV'ler gürültü
 * gradyanıyla kaydırılır. Gerçekte gördüğümüz "titreyen hava" tam olarak budur.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createNoiseTexture } from '../materials/textures.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNoise: { value: null },
    uTime: { value: 0 },
    uHaze: { value: 0.0 },
    uHazeA: { value: new THREE.Vector2(0.5, 0.5) },
    uHazeB: { value: new THREE.Vector2(0.8, 0.5) },
    /** Konik ısı pusu: uçlardaki ekran yarıçapları (yükseklik birimi) */
    uHazeWA: { value: 0.05 },
    uHazeWB: { value: 0.12 },
    uAspect: { value: 1.0 },
    uVignette: { value: 0.26 },
    uGrain: { value: 0.012 },
    uChroma: { value: 0.0004 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tNoise;
    uniform float uTime;
    uniform float uHaze;
    uniform vec2 uHazeA;
    uniform vec2 uHazeB;
    uniform float uHazeWA;
    uniform float uHazeWB;
    uniform float uAspect;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChroma;
    varying vec2 vUv;

    float segmentDist(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      return length(pa - ba * h);
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;

      /* --- sıcak egzoz kırılması ---
       * Maske jetin ekrana izdüşen hacmidir: lüle ağzında lüle yarıçapı,
       * akış aşağısında jet genişledikçe büyür (kesik koni). Sapma lüle
       * yakınında en güçlü, sıcak gaz çevreyle karıştıkça zayıflar; kenarda
       * türbülanslı karışma katmanı daha dalgalı. */
      if (uHaze > 0.001) {
        vec2 p = vec2(uv.x * uAspect, uv.y);
        vec2 a = vec2(uHazeA.x * uAspect, uHazeA.y);
        vec2 b = vec2(uHazeB.x * uAspect, uHazeB.y);
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        float d = length(pa - ba * h);
        float w = mix(uHazeWA, uHazeWB, h);
        float mask = 1.0 - smoothstep(w * 0.35, w, d);
        // lüle ağzının gerisinde (h = 0 ucunda) yuvarlak kapanış yok
        mask *= smoothstep(0.0, 0.04, dot(pa, ba) / max(length(ba), 1e-6) + w * 0.2);
        mask *= mix(1.0, 0.3, h);
        float shear = smoothstep(w * 0.3, w * 0.9, d);

        // İki farklı hızda kayan gürültü: yükselen sıcak hava
        vec2 n1 = texture2D(tNoise, uv * 2.6 + vec2(uTime * 0.05, -uTime * 0.28)).rg;
        vec2 n2 = texture2D(tNoise, uv * (5.3 + 4.0 * shear) - vec2(uTime * 0.09, uTime * 0.42)).gb;
        // Sapma miktarı ekran genişliğinin yüzde birinin altındadır. Daha
        // büyük değerler görüntüyü eritip geometri bozukmuş gibi gösterir.
        vec2 offset = ((n1 - 0.5) * 0.7 + (n2 - 0.5) * (0.3 + 0.4 * shear)) * mask * uHaze * 0.0075;
        uv += offset;
      }

      /* --- lensin renk sapması (kenarlara doğru artar) --- */
      vec2 center = uv - 0.5;
      float r2 = dot(center, center);
      vec2 caOffset = center * r2 * uChroma * 12.0;
      vec4 color;
      color.r = texture2D(tDiffuse, uv + caOffset).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - caOffset).b;
      color.a = 1.0;

      /* --- hafif S eğrisi: gölgeler derinleşir, orta tonlar canlanır ---
       * Eğri yalnız [0,1] aralığında tanımlı: bloom parlak yüzeyleri 1'in
       * üstüne taşır; x²(3−2x) 1,5'ten sonra negatife döner ve en parlak
       * noktalar siyah leke olurdu. Taşan kısım olduğu gibi eklenir. */
      vec3 cs = clamp(color.rgb, 0.0, 1.0);
      color.rgb = mix(color.rgb, cs * cs * (3.0 - 2.0 * cs) + (color.rgb - cs), 0.22);

      /* --- vinyet --- */
      float vig = 1.0 - uVignette * smoothstep(0.18, 0.95, length(center) * 1.42);
      color.rgb *= vig;

      /* --- sensör greni: karanlıkta daha belirgin --- */
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float grain = (hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5);
      color.rgb += grain * uGrain * mix(1.4, 0.35, lum);

      gl_FragColor = color;
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({
    radius: 0.32,
    distanceExponent: 1.6,
    thickness: 0.6,
    scale: 1.0,
    samples: 16,
    distanceFallOff: 1.0,
    screenSpaceRadius: false,
  });
  // Ortam kapanması yalnız katı yüzeylerden hesaplanmalı: yarı saydam egzoz
  // akışı, parçacıklar ve derinlik yazmayan arka planlar (HDRI kubbesi)
  // normal/derinlik ön-geçişine girerse arkalarındaki görüntüyü bozar
  const baseOverride = gtao._overrideVisibility.bind(gtao);
  gtao._overrideVisibility = function () {
    baseOverride();
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (!o.visible || !o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m.transparent || m.depthWrite === false) || o.userData.noAO) {
        o.visible = false;
        cache.push(o);
      }
    });
  };
  composer.addPass(gtao);

  // Ton eşleme önce uygulanır. Bloom doğrusal HDR tamponda çalıştırılırsa
  // güneş altındaki beyaz kaporta zaten 1.0'ın çok üstünde olduğu için eşik
  // ne olursa olsun bütün gövde parlar ve kare süte döner. Ton eşlemeden
  // sonra değerler 0..1 aralığındadır; eşik 1'e yakın tutulunca yalnızca
  // gerçek spekülerler ve kor halindeki yüzeyler taşar.
  const output = new OutputPass();
  composer.addPass(output);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.35, 0.94);
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  grade.uniforms.tNoise.value = createNoiseTexture(512, 7);
  grade.uniforms.uAspect.value = size.x / size.y;
  composer.addPass(grade);

  const smaa = new SMAAPass();
  composer.addPass(smaa);

  return { composer, renderPass, gtao, bloom, grade, smaa, output };
}
