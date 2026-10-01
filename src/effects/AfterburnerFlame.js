/**
 * Art yakıcı alevi: ışın yürütmeli (raymarch) hacimsel emisyon.
 *
 * Gerçek bir art yakıcı jetinde görülenler:
 *  - lüle ağzında mavi-mor, yarı saydam öz (hidrokarbon radikallerinin
 *    ışıması; yakıtça fakir bölge),
 *  - sarı-turuncu türbülanslı gövde, uca doğru kızıla dönen kuyruk,
 *  - aşırı/eksik genleşmiş süpersonik jette arka arkaya dizilen "şok
 *    elmasları" (Mach diskleri): sıkışan gaz yeniden ısınıp parlar.
 * Elmas aralığı Prandtl bağıntısıyla hesaplanır: Δz ≈ 1.22·D·√(M² − 1).
 *
 * Bir silindir vekil geometrinin arka yüzleri çizilir; her piksel kamera
 * ışınının silindirle kesiştiği aralıkta yoğunluk alanını örnekler. Böylece
 * kamera alevin içinde olsa bile doğru görünür.
 */

import * as THREE from 'three';

/**
 * Alev renk paletleri. Mavi-mor ışıma temiz yanan bölgedeki CH/C2
 * radikallerinin kemilüminesansıdır; sarı-turuncu ise akkor is
 * parçacıklarıdır. Modern, fakir karışımla yanan art yakıcılar mor-pembe,
 * eski turbojetlerin zengin yanması turuncu-sarı görünür.
 */
export const FLAME_STYLES = {
  clean: {
    hotA: [0.85, 0.3, 0.55],
    hotB: [1.0, 0.5, 0.35],
    tail: [0.7, 0.18, 0.12],
    core: [0.45, 0.4, 1.0],
    diaA: [1.0, 0.8, 0.6],
    diaB: [1.0, 0.72, 0.85],
    coreGain: 2.6,
  },
  sooty: {
    hotA: [1.0, 0.3, 0.04],
    hotB: [1.0, 0.62, 0.16],
    tail: [0.85, 0.2, 0.03],
    core: [0.6, 0.45, 0.9],
    diaA: [1.0, 0.78, 0.4],
    diaB: [1.0, 0.85, 0.5],
    coreGain: 1.0,
  },
};

const vertexShader = /* glsl */ `
  uniform vec3 uScale;
  varying vec3 vLocal;
  void main() {
    // Birim vekil silindir → metre cinsinden alev uzayı
    vLocal = position * uScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uLevel;
  uniform float uR0;
  uniform float uLen;
  uniform float uRmax;
  uniform float uSpacing;
  uniform float uDiamonds;
  uniform float uPop;
  uniform float uZones;
  uniform vec3 uHotA;
  uniform vec3 uHotB;
  uniform vec3 uTail;
  uniform vec3 uCore;
  uniform vec3 uDiaA;
  uniform vec3 uDiaB;
  uniform float uCoreGain;
  varying vec3 vLocal;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.15 * vnoise(p * 4.1 + 3.3);
  }

  void main() {
    vec3 ro = uCam;
    vec3 rd = normalize(vLocal - uCam);
    // Silindir (yarıçap uRmax, 0 ≤ z ≤ uLen) ile kesişim
    float a = dot(rd.xy, rd.xy);
    float b = 2.0 * dot(ro.xy, rd.xy);
    float c = dot(ro.xy, ro.xy) - uRmax * uRmax;
    float disc = b * b - 4.0 * a * c;
    if (disc < 0.0 || a < 1e-6) discard;
    float sq = sqrt(disc);
    float t0 = (-b - sq) / (2.0 * a);
    float t1 = (-b + sq) / (2.0 * a);
    float tz0 = (0.0 - ro.z) / rd.z;
    float tz1 = (uLen - ro.z) / rd.z;
    t0 = max(t0, min(tz0, tz1));
    t1 = min(t1, max(tz0, tz1));
    t0 = max(t0, 0.0);
    if (t1 <= t0) discard;

    const int STEPS = 40;
    float dt = (t1 - t0) / float(STEPS);
    float t = t0 + dt * hash(vec3(gl_FragCoord.xy, uTime));
    vec3 acc = vec3(0.0);
    float lvl = uLevel;
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * t;
      float z = p.z;
      float r = length(p.xy);
      float s = z / uLen;
      // Jet sınırı: lüleden sonra hafif genişler, uçta dağılır
      float R = uR0 * (0.92 + 0.3 * s);
      float turb = fbm(vec3(p.xy * 4.0 / uR0, z * 2.2 - uTime * 14.0));
      float edge = 1.0 - smoothstep(R * 0.1, R * (0.85 + 0.3 * turb), r);
      float tail = 1.0 - smoothstep(0.3 + 0.3 * turb, 1.0, s);
      // Türbülanslı yapı: alev homojen bir sis değil, akış yönünde uzayan dilimler
      float streak = fbm(vec3(atan(p.y, p.x) * 2.0, r * 6.0 / uR0, z * 0.9 - uTime * 10.0));
      float body = edge * tail * mix(0.25, 1.5, turb) * mix(0.5, 1.3, streak);
      // Kademeli yanma: zon 1 çekirdekte, sonraki zonlar dışa doğru halkalar.
      // Tutuşmuş zonların yarıçapına kadar alev; akış aşağısında karışır
      float zi = clamp(r / max(R, 1e-3), 0.0, 1.2) * 5.0;
      float zoneMask = clamp(uZones - zi + 0.6, 0.0, 1.0);
      zoneMask = mix(zoneMask, clamp(uZones / 5.0, 0.0, 1.0), smoothstep(0.08, 0.6, s));
      body *= zoneMask;

      // Mavi-mor öz (lüle ağzı yakını, ince)
      float core = (1.0 - smoothstep(0.0, uR0 * 0.75, r)) * (1.0 - smoothstep(0.0, 0.22, s)) * clamp(uZones, 0.0, 1.0);

      // Şok elmasları: Mach disklerinde parlak, konik uzantılı hücreler
      // Mach diskleri hafifçe titrer: jet basınç dalgalanması hücre
      // aralığını ve parlaklığını oynatır
      float jit = 1.0 + 0.025 * sin(uTime * 23.0) + 0.02 * (vnoise(vec3(uTime * 11.0, 1.7, 0.0)) - 0.5);
      float zd = z / (uSpacing * jit) - 0.55;
      float k = floor(zd + 0.5);
      float f = zd - k;
      // Elmas: eksen boyunca sivri uçlu, ortası (Mach diski) en geniş hücre
      float cellR = uR0 * 0.55 * max(0.0, 1.0 - 2.4 * abs(f));
      // cellR = 0 iken smoothstep tanımsızdır: hücre dışını açıkça sıfırla
      float diamond = cellR > 0.002
        ? (1.0 - smoothstep(cellR * 0.78, cellR, r)) * mix(0.35, 1.0, smoothstep(0.42, 0.0, abs(f)))
        : 0.0;
      diamond *= step(0.0, k) * exp(-k * 0.42) * uDiamonds;
      diamond *= 0.8 + 0.4 * vnoise(vec3(k * 3.1, uTime * 17.0, 2.3));

      vec3 hot = mix(uHotA, uHotB, edge);
      vec3 bodyCol = mix(hot, uTail, smoothstep(0.3, 0.9, s));
      vec3 coreCol = uCore;
      vec3 diaCol = mix(uDiaA, uDiaB, lvl);

      // Lüle çıkışındaki sıcak çekirdek: ilk ~1 çapta sarı-beyaz, hızla
      // pembe-turuncu gövdeye döner (tutuşmuş zonların içinde)
      float hotCore = (1.0 - smoothstep(0.0, R * 0.85, r)) * exp(-s * 7.0) * zoneMask * (0.6 + 0.6 * turb);
      acc += (bodyCol * body * (1.0 + 2.4 * lvl) + coreCol * core * uCoreGain + diaCol * diamond * 4.0 + vec3(1.0, 0.82, 0.55) * hotCore * 2.2) * dt;
      t += dt;
    }
    // Titreşim: yanma kararsızlığı
    float flick = 0.85 + 0.3 * vnoise(vec3(uTime * 9.0, 0.0, 0.0));
    vec3 col = acc * (flick * (0.2 + 0.5 * pow(lvl, 0.7)) + uPop * 0.5) / uR0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class AfterburnerFlame {
  constructor(style = 'clean') {
    const pal = FLAME_STYLES[style] ?? FLAME_STYLES.clean;
    const v3 = (a) => ({ value: new THREE.Vector3(...a) });
    this.rMax = 1;
    this.len = 1;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uScale: { value: new THREE.Vector3(1, 1, 1) },
        uTime: { value: 0 },
        uLevel: { value: 0 },
        uR0: { value: 0.3 },
        uLen: { value: 4 },
        uRmax: { value: 1 },
        uSpacing: { value: 0.8 },
        uDiamonds: { value: 1 },
        uPop: { value: 0 },
        uZones: { value: 5 },
        uHotA: v3(pal.hotA),
        uHotB: v3(pal.hotB),
        uTail: v3(pal.tail),
        uCore: v3(pal.core),
        uDiaA: v3(pal.diaA),
        uDiaB: v3(pal.diaB),
        uCoreGain: { value: pal.coreGain },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });
    // Birim silindir; ölçek her karede alev boyutuna göre ayarlanır
    const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, false);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0.5);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'afterburner-flame';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.pop = 0;
    this._inv = new THREE.Matrix4();
  }

  /**
   * @param {number} level art yakıcı yanma oranı 0..1
   * @param {number} exitZ lüle ağzı z
   * @param {number} r0 lüle çıkış yarıçapı
   * @param {number} mach jet çıkış Mach sayısı
   */
  update(dt, camera, level, exitZ, r0, mach, zones = 5) {
    const u = this.material.uniforms;
    this.pop = Math.max(0, this.pop - dt * 3);
    const on = level > 0.01 || this.pop > 0.01;
    this.mesh.visible = on;
    if (!on) return;
    const len = r0 * (6 + 11 * Math.pow(level, 0.8));
    const rMax = r0 * 1.5;
    u.uTime.value += dt;
    u.uLevel.value = level;
    u.uR0.value = r0;
    u.uLen.value = len;
    u.uRmax.value = rMax;
    u.uPop.value = this.pop;
    u.uZones.value = zones;
    u.uSpacing.value = Math.max(0.55 * 2 * r0, 1.22 * 2 * r0 * Math.sqrt(Math.max(mach * mach - 1, 0.25)));
    u.uDiamonds.value = THREE.MathUtils.smoothstep(level, 0.15, 0.6) * THREE.MathUtils.smoothstep(zones, 1.5, 4.5);
    // Vekil silindir: yerel uzayda birim ölçek, shader ölçeksiz koordinat ister
    this.mesh.position.set(0, 0, exitZ);
    this.mesh.scale.set(rMax, rMax, len);
    u.uScale.value.set(rMax, rMax, len);
    this.mesh.updateMatrixWorld();
    // Kamerayı alevin (ölçeksiz) yerel uzayına taşı
    this._inv.copy(this.mesh.parent.matrixWorld).invert();
    u.uCam.value.copy(camera.position).applyMatrix4(this._inv);
    u.uCam.value.z -= exitZ;
  }

  /** Art yakıcı tutuşması (ya da bir zonun tutuşması): kısa bir parlama */
  trigger(strength = 1) {
    this.pop = Math.max(this.pop, strength);
  }
}
