/**
 * Egzoz görselleri: sıcak gaz akışının hafif bulanık, kıvrımlı izi.
 *
 * Gerçek bir sivil turbofanda görünür alev yoktur; görünen tek şey sıcak
 * havanın kırılma indisini değiştirmesidir. Bu yüzden burada yoğun bir duman
 * yerine, gürültüyle modüle edilmiş çok düşük opaklıkta bir akış konisi
 * kullanılır — asıl kırılma etkisi post-process aşamasında uygulanır.
 */

import * as THREE from 'three';
import { createNoiseTexture } from '../materials/textures.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uThrust;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    float along = clamp(vUv.y, 0.0, 1.0);

    // Akış yönünde kayan iki katman: türbülans hissi
    vec2 uv1 = vec2(vUv.x * 3.0, vUv.y * 1.4 - uTime * (0.55 + uThrust * 0.9));
    vec2 uv2 = vec2(vUv.x * 5.0 + 0.37, vUv.y * 2.1 - uTime * (0.9 + uThrust * 1.4));
    float n = texture2D(uNoise, uv1).r * 0.6 + texture2D(uNoise, uv2).g * 0.4;

    // Lüle çıkışında yoğun, uzakta dağılan profil
    // Sivil bir turbofanda egzoz neredeyse görünmezdir: yalnızca lüle
    // çıkışında çok ince bir yoğunluk farkı okunur.
    float fade = smoothstep(0.0, 0.10, along) * (1.0 - smoothstep(0.18, 0.75, along));
    float turb = mix(0.35, 1.0, n);

    float alpha = fade * turb * uThrust * uThrust * 0.055;

    gl_FragColor = vec4(uColor * (0.75 + n * 0.35), alpha);
  }
`;

export function buildExhaustPlume() {
  const noise = createNoiseTexture(512, 404);

  // Lüle ağzında dar, akış aşağısında genişleyen koni.
  // CylinderGeometry'de "top" (+Y) rotateX(90°) sonrası +Z'ye, yani arkaya
  // bakar; bu yüzden dar uç radiusBottom olarak verilir.
  const length = 5.2;
  const geo = new THREE.CylinderGeometry(1.15, 0.62, length, 48, 28, true);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, 3.3 + length / 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noise },
      uTime: { value: 0 },
      uThrust: { value: 0.0 },
      uColor: { value: new THREE.Color(0x9aa3ad) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'exhaust-plume';
  mesh.frustumCulled = false;
  return { mesh, material };
}
