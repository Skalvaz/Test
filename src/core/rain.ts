/**
 * Yağmur: kameranın çevresindeki bir kutuda sonsuz döngüyle düşen ince
 * çizgiler (tek örnekli çizim). Damla konumları dünyaya sabittir (kamera
 * dönünce yağmur onunla dönmez); kutu kameranın etrafında sarar. Zeminin
 * altında kalan parçalar atılır. Uzaktaki ve çok yakındaki çizgiler söner.
 */

import * as THREE from 'three';
import { weather } from './weather';

const vertexShader = /* glsl */ `
  attribute vec4 aSeed;
  uniform vec3 uCam;
  uniform vec3 uBox;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec2 uWind;
  varying float vAlong;
  varying float vAcross;
  varying float vFade;
  varying float vY;
  void main() {
    vec3 p;
    p.x = uCam.x + (fract(aSeed.x - uCam.x / uBox.x) - 0.5) * uBox.x;
    p.z = uCam.z + (fract(aSeed.z - uCam.z / uBox.z) - 0.5) * uBox.z;
    float fall = uTime * uSpeed * (0.85 + 0.3 * aSeed.w);
    p.y = uCam.y + (fract(aSeed.y - fall / uBox.y) - 0.5) * uBox.y;
    // rüzgâr: düşüş boyunca sürüklenme
    p.xz += uWind * (p.y - uCam.y) * -0.08;
    float len = 0.45 + 0.4 * aSeed.w;
    vec3 dir = normalize(vec3(uWind.x * 0.1, -1.0, uWind.y * 0.1));
    vec3 toCam = normalize(uCam - p);
    vec3 side = normalize(cross(dir, toCam));
    vec3 w = p + side * position.x * 0.014 - dir * position.y * len;
    vAlong = position.y;
    vAcross = position.x * 2.0;
    vY = w.y;
    float d = distance(uCam, p);
    vFade = smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, d));
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uFloor;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vAlong;
  varying float vAcross;
  varying float vFade;
  varying float vY;
  void main() {
    if (vY < uFloor) discard;
    float a = (1.0 - abs(vAcross)) * sin(vAlong * 3.14159) * vFade * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class Rain {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(count = 22000) {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = count;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uBox: { value: new THREE.Vector3(26, 14, 26) },
        uTime: { value: 0 },
        uSpeed: { value: 9 },
        uWind: { value: new THREE.Vector2(1.2, 0.4) },
        uFloor: { value: -2.4 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(0.78, 0.82, 0.88) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      // çizgi dörtgeni dünya uzayında kurulur; sarım yönü bakışa göre değişir
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.name = 'rain';
    this.mesh.visible = false;
    this.mesh.userData.noAO = true;
  }

  /** Kalite: düşükte daha az damla */
  setDensity(fraction: number) {
    const g = this.mesh.geometry as THREE.InstancedBufferGeometry;
    const max = (g.getAttribute('aSeed') as THREE.InstancedBufferAttribute).count;
    g.instanceCount = Math.round(max * THREE.MathUtils.clamp(fraction, 0.1, 1));
  }

  update(dt: number, camera: THREE.Camera, floorY: number, light = 1) {
    const r = weather.rain;
    this.mesh.visible = r > 0.01;
    if (!this.mesh.visible) return;
    const u = this.material.uniforms;
    u.uTime.value += dt;
    u.uCam.value.copy(camera.position);
    u.uFloor.value = floorY;
    u.uOpacity.value = 0.42 * r * light;
  }
}
