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

      // Mavi-mor öz (lüle ağzı yakını, ince)
      float core = (1.0 - smoothstep(0.0, uR0 * 0.75, r)) * (1.0 - smoothstep(0.0, 0.22, s));

      // Şok elmasları: Mach disklerinde parlak, konik uzantılı hücreler
      float zd = z / uSpacing - 0.55;
      float k = floor(zd + 0.5);
      float f = zd - k;
      // Elmas: eksen boyunca sivri uçlu, ortası (Mach diski) en geniş hücre
      float cellR = uR0 * 0.55 * max(0.0, 1.0 - 2.4 * abs(f));
      // cellR = 0 iken smoothstep tanımsızdır: hücre dışını açıkça sıfırla
      float diamond = cellR > 0.002
        ? (1.0 - smoothstep(cellR * 0.78, cellR, r)) * mix(0.35, 1.0, smoothstep(0.42, 0.0, abs(f)))
        : 0.0;
      diamond *= step(0.0, k) * exp(-k * 0.42) * uDiamonds;

      vec3 hot = mix(vec3(1.0, 0.26, 0.04), vec3(1.0, 0.52, 0.12), edge);
      vec3 tailCol = vec3(0.85, 0.16, 0.03);
      vec3 bodyCol = mix(hot, tailCol, smoothstep(0.3, 0.9, s));
      vec3 coreCol = vec3(0.55, 0.42, 1.0);
      vec3 diaCol = mix(vec3(1.0, 0.7, 0.4), vec3(1.0, 0.56, 0.7), lvl);

      acc += (bodyCol * body * (1.0 + 2.4 * lvl) + coreCol * core * 1.8 + diaCol * diamond * 4.0) * dt;
      t += dt;
    }
    // Titreşim: yanma kararsızlığı
    float flick = 0.85 + 0.3 * vnoise(vec3(uTime * 9.0, 0.0, 0.0));
    vec3 col = acc * (flick * (0.1 + 0.3 * pow(lvl, 0.7)) + uPop * 1.2) / uR0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class AfterburnerFlame {
  constructor() {
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
  update(dt, camera, level, exitZ, r0, mach) {
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
    u.uSpacing.value = Math.max(0.55 * 2 * r0, 1.22 * 2 * r0 * Math.sqrt(Math.max(mach * mach - 1, 0.25)));
    u.uDiamonds.value = THREE.MathUtils.smoothstep(level, 0.15, 0.6);
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

  /** Art yakıcı tutuşması: kısa bir parlama */
  trigger() {
    this.pop = 1;
  }
}
