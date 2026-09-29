/**
 * Parçacık sistemi: kameraya dönük dörtgenler (billboard), örneklemeli
 * (instanced) tek çizim çağrısı. Simülasyon CPU'da, ölü parçacıklar
 * takas-silme ile dizinin sonuna atılır; yalnız canlılar çizilir.
 *
 * İki karışım kipi: "smoke" (normal karışım — duman, buhar, toz, yoğuşma)
 * ve "glow" (toplamalı — alev, kıvılcım). Her parçacık serbest hareket eder
 * (sürükleme, kaldırma kuvveti, yerçekimi, zemin çarpışması) ya da bir
 * girdap ekseni etrafında döner (giriş vorteksi).
 */

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iColor;
  attribute vec2 iSizeRot;
  attribute float iSeed;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vSeed;
  varying float vNear;
  varying vec3 vLit;
  uniform vec3 uGlowPos;
  uniform vec3 uGlowColor;
  uniform float uGlowRadius;
  void main() {
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    // Yakındaki alevin dumanı aydınlatması (art yakıcı, torching)
    vec3 dg = iPos - uGlowPos;
    vLit = uGlowColor * exp(-dot(dg, dg) / (uGlowRadius * uGlowRadius));
    // Kameraya çok yakın parçacıklar solar: aksi halde tek bir duman
    // bulutu bütün ekranı kaplar
    vNear = smoothstep(0.3, 1.2 + iSizeRot.x * 1.5, -mv.z);
    float c = cos(iSizeRot.y);
    float s = sin(iSizeRot.y);
    vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    mv.xy += q * iSizeRot.x;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vColor = iColor;
    vSeed = iSeed;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uNoise;
  uniform float uGlow;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vSeed;
  varying float vNear;
  varying vec3 vLit;
  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float soft = 1.0 - smoothstep(0.35, 1.0, r);
    // Kabarık duman dokusu: iki ölçekte gürültü
    vec2 nuv = vUv * 0.55 + vec2(vSeed, vSeed * 1.7);
    float n = texture2D(uNoise, nuv).r * 0.65 + texture2D(uNoise, nuv * 2.3).g * 0.35;
    float shape = mix(soft * smoothstep(0.25, 0.75, n + 0.35 * soft), soft * soft, uGlow);
    float a = vColor.a * shape * vNear;
    if (a < 0.003) discard;
    if (uGlow > 0.5) {
      gl_FragColor = vec4(vColor.rgb * a, 1.0);
    } else {
      gl_FragColor = vec4(vColor.rgb + vLit, a);
    }
  }
`;

/** Parçacık kaydı alanları (yapı-dizisi yerine düz Float32Array'ler). */
const F = {
  x: 0, y: 1, z: 2,
  vx: 3, vy: 4, vz: 5,
  age: 6, life: 7,
  s0: 8, s1: 9,
  rot: 10, spin: 11,
  r: 12, g: 13, b: 14, a: 15,
  drag: 16, lift: 17, grav: 18,
  fadeIn: 19,
  // Girdap kipi: 0 serbest, 1 vorteks
  mode: 20,
  u: 21, theta: 22, omega: 23, rho: 24,
  seed: 25,
};
const STRIDE = 26;

export class ParticleSystem {
  /**
   * @param {'smoke'|'glow'} kind
   * @param {THREE.Texture} noise
   * @param {number} max
   */
  constructor(kind, noise, max = 3000) {
    this.max = max;
    this.count = 0;
    this.data = new Float32Array(max * STRIDE);
    this.floorY = -Infinity;
    /** Girdap ekseni: tabandan (A) girişe (B) */
    this.vortexA = new THREE.Vector3();
    this.vortexB = new THREE.Vector3();

    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.iColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.iSizeRot = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
    this.iSeed = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    for (const a of [this.iPos, this.iColor, this.iSizeRot, this.iSeed]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos);
    geo.setAttribute('iColor', this.iColor);
    geo.setAttribute('iSizeRot', this.iSizeRot);
    geo.setAttribute('iSeed', this.iSeed);
    geo.instanceCount = 0;
    this.geometry = geo;

    const glow = kind === 'glow';
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uNoise: { value: noise },
        uGlow: { value: glow ? 1 : 0 },
        uGlowPos: { value: new THREE.Vector3() },
        uGlowColor: { value: new THREE.Color(0, 0, 0) },
        uGlowRadius: { value: 2.5 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = glow ? 6 : 4;
    this.mesh.name = `particles-${kind}`;
  }

  /**
   * Yeni parçacık. Eksik alanlar varsayılanlarla dolar.
   * @param {object} p { pos:[x,y,z], vel:[x,y,z], life, size:[s0,s1], color:[r,g,b,a],
   *   drag, lift, grav, spin, fadeIn, vortex:{omega, rho, theta} }
   */
  emit(p) {
    if (this.count >= this.max) return;
    const o = this.count * STRIDE;
    const d = this.data;
    this.count++;
    d[o + F.x] = p.pos[0];
    d[o + F.y] = p.pos[1];
    d[o + F.z] = p.pos[2];
    d[o + F.vx] = p.vel?.[0] ?? 0;
    d[o + F.vy] = p.vel?.[1] ?? 0;
    d[o + F.vz] = p.vel?.[2] ?? 0;
    d[o + F.age] = 0;
    d[o + F.life] = p.life ?? 1;
    d[o + F.s0] = p.size?.[0] ?? 0.2;
    d[o + F.s1] = p.size?.[1] ?? d[o + F.s0];
    d[o + F.rot] = Math.random() * Math.PI * 2;
    d[o + F.spin] = p.spin ?? (Math.random() - 0.5) * 1.2;
    d[o + F.r] = p.color[0];
    d[o + F.g] = p.color[1];
    d[o + F.b] = p.color[2];
    d[o + F.a] = p.color[3] ?? 1;
    d[o + F.drag] = p.drag ?? 0.6;
    d[o + F.lift] = p.lift ?? 0;
    d[o + F.grav] = p.grav ?? 0;
    d[o + F.fadeIn] = p.fadeIn ?? 0.02;
    d[o + F.seed] = Math.random();
    if (p.vortex) {
      d[o + F.mode] = 1;
      d[o + F.u] = 0;
      d[o + F.theta] = p.vortex.theta ?? Math.random() * Math.PI * 2;
      d[o + F.omega] = p.vortex.omega;
      d[o + F.rho] = p.vortex.rho;
    } else {
      d[o + F.mode] = 0;
    }
  }

  update(dt) {
    const d = this.data;
    const A = this.vortexA;
    const B = this.vortexB;
    let i = 0;
    while (i < this.count) {
      const o = i * STRIDE;
      d[o + F.age] += dt;
      if (d[o + F.age] >= d[o + F.life]) {
        // takas-silme
        const last = (this.count - 1) * STRIDE;
        if (last !== o) d.copyWithin(o, last, last + STRIDE);
        this.count--;
        continue;
      }
      if (d[o + F.mode] === 1) {
        // Yerden girişe kıvrılan girdap: eksen boyunca ilerler, yukarı
        // çıktıkça daralır ve hızlanır
        const u = Math.min(1, d[o + F.u] + dt * (0.55 + 1.6 * d[o + F.u]));
        d[o + F.u] = u;
        d[o + F.theta] += d[o + F.omega] * (1 + 2.5 * u) * dt;
        const rho = d[o + F.rho] * (1 - 0.8 * u);
        const k = Math.pow(u, 0.75);
        d[o + F.x] = A.x + (B.x - A.x) * k + rho * Math.cos(d[o + F.theta]);
        d[o + F.y] = A.y + (B.y - A.y) * k;
        d[o + F.z] = A.z + (B.z - A.z) * u * u + rho * Math.sin(d[o + F.theta]);
        if (u >= 1) d[o + F.age] = d[o + F.life];
      } else {
        const damp = Math.exp(-d[o + F.drag] * dt);
        d[o + F.vx] *= damp;
        d[o + F.vy] = d[o + F.vy] * damp + (d[o + F.lift] - d[o + F.grav]) * dt;
        d[o + F.vz] *= damp;
        d[o + F.x] += d[o + F.vx] * dt;
        d[o + F.y] += d[o + F.vy] * dt;
        d[o + F.z] += d[o + F.vz] * dt;
        if (d[o + F.y] < this.floorY) {
          d[o + F.y] = this.floorY;
          d[o + F.vy] = Math.abs(d[o + F.vy]) * 0.25;
          d[o + F.vx] *= 0.7;
          d[o + F.vz] *= 0.7;
        }
      }
      d[o + F.rot] += d[o + F.spin] * dt;
      i++;
    }

    // GPU tamponlarını doldur
    const pos = this.iPos.array;
    const col = this.iColor.array;
    const sr = this.iSizeRot.array;
    const sd = this.iSeed.array;
    for (let j = 0; j < this.count; j++) {
      const o = j * STRIDE;
      const t = d[o + F.age] / d[o + F.life];
      const fi = d[o + F.fadeIn];
      const alpha = d[o + F.a] * Math.min(1, t / Math.max(fi, 1e-3)) * (1 - t) * (1 - t);
      pos[j * 3] = d[o + F.x];
      pos[j * 3 + 1] = d[o + F.y];
      pos[j * 3 + 2] = d[o + F.z];
      col[j * 4] = d[o + F.r];
      col[j * 4 + 1] = d[o + F.g];
      col[j * 4 + 2] = d[o + F.b];
      col[j * 4 + 3] = alpha;
      sr[j * 2] = d[o + F.s0] + (d[o + F.s1] - d[o + F.s0]) * Math.sqrt(t);
      sr[j * 2 + 1] = d[o + F.rot];
      sd[j] = d[o + F.seed];
    }
    this.geometry.instanceCount = this.count;
    for (const a of [this.iPos, this.iColor, this.iSizeRot, this.iSeed]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * a.itemSize);
      a.needsUpdate = true;
    }
  }

  clear() {
    this.count = 0;
    this.geometry.instanceCount = 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
