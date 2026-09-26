/**
 * Görsel motor: prosedürel 3B model + simülasyon durumunun görselleştirilmesi.
 *
 * Simülasyon (src/sim) motorun ne yaptığını hesaplar; bu sınıf yalnızca onu
 * gösterir: mil dönüşleri, hareket bulanıklığı, yanma odası ve türbin ısıl
 * parlaması, egzoz akışı, surge/torching alevleri. Ayrıca ders sistemi için
 * parça etiketleri, vurgulama ve kesit kırpması sağlar.
 */

import * as THREE from 'three';
import type { SimSnapshot } from '../sim';
import { buildNacelle } from './nacelle.js';
import { buildFan } from './fan.js';
import { buildCore } from './core.js';
import { buildPylon } from './pylon.js';
import { buildExhaustPlume } from './exhaust.js';
import { createNoiseTexture } from '../materials/textures.js';
import type { createMaterials } from '../materials/library.js';

export type Materials = ReturnType<typeof createMaterials>;

export type PartId =
  | 'spinner'
  | 'inlet'
  | 'fan'
  | 'fanCase'
  | 'nacelle'
  | 'bypassDuct'
  | 'bypassNozzle'
  | 'ogv'
  | 'coreCowl'
  | 'casing'
  | 'booster'
  | 'hpc'
  | 'combustor'
  | 'hpt'
  | 'lpt'
  | 'shafts'
  | 'exhaust'
  | 'gearbox'
  | 'pylon'
  | 'wing';

type EmissiveMaterial = THREE.MeshStandardMaterial;

interface PartEntry {
  meshes: THREE.Object3D[];
  materials: Set<EmissiveMaterial>;
}

const RPM_TO_RAD = (Math.PI * 2) / 60;
const HIGHLIGHT = new THREE.Color(0x2ee6d6);

/* ------------------------------------------------------------------ */
/* Alev efekti (surge / torching)                                      */
/* ------------------------------------------------------------------ */

const flameVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flameFragment = /* glsl */ `
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uHot;
  uniform vec3 uCool;
  varying vec2 vUv;
  void main() {
    float along = vUv.y;
    float n = texture2D(uNoise, vec2(vUv.x * 3.0, along * 1.3 - uTime * 3.2)).r;
    float n2 = texture2D(uNoise, vec2(vUv.x * 5.0 + 0.3, along * 2.1 - uTime * 5.0)).g;
    float body = pow(1.0 - along, 1.35) * smoothstep(0.0, 0.08, along);
    float flick = mix(0.35, 1.25, n * 0.65 + n2 * 0.35);
    float a = clamp(body * flick * uIntensity, 0.0, 1.0);
    vec3 col = mix(uCool, uHot, pow(1.0 - along, 2.0) * (0.6 + 0.4 * n2));
    gl_FragColor = vec4(col * (1.2 + 2.2 * a), a);
  }
`;

class Flame {
  readonly mesh: THREE.Mesh;
  readonly light: THREE.PointLight;
  private material: THREE.ShaderMaterial;
  intensity = 0;
  private decay = 3;

  constructor(noise: THREE.Texture, radius: number, length: number, z: number, forward: boolean) {
    const geo = new THREE.ConeGeometry(radius, length, 40, 12, true);
    geo.translate(0, length / 2, 0);
    geo.rotateX(forward ? -Math.PI / 2 : Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uNoise: { value: noise },
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uHot: { value: new THREE.Color(1.0, 0.86, 0.55) },
        uCool: { value: new THREE.Color(1.0, 0.32, 0.06) },
      },
      vertexShader: flameVertex,
      fragmentShader: flameFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.z = z;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.light = new THREE.PointLight(0xff8a3a, 0, 14, 2);
    this.light.position.set(0, 0, z + (forward ? -0.8 : 0.8));
  }

  trigger(strength: number, decayPerSecond: number) {
    this.intensity = Math.max(this.intensity, strength);
    this.decay = decayPerSecond;
  }

  update(dt: number, time: number, sustain = 0) {
    this.intensity = Math.max(sustain, this.intensity - this.decay * dt);
    const on = this.intensity > 0.01;
    this.mesh.visible = on;
    this.material.uniforms.uIntensity.value = this.intensity;
    this.material.uniforms.uTime.value = time;
    this.mesh.scale.setScalar(0.7 + 0.5 * Math.min(1, this.intensity));
    this.light.intensity = on ? 120 * this.intensity : 0;
  }
}

/* ------------------------------------------------------------------ */

export class EngineVisual {
  readonly root = new THREE.Group();
  readonly pickables: THREE.Object3D[] = [];
  /** Motor dışı titreşim (kamera sarsıntısı için) 0..1 */
  shake = 0;
  /** Görsel devir ölçeği: gerçek devir göz için çok hızlıdır */
  spinScale = 0.055;
  motionBlur = true;

  private parts = new Map<PartId, PartEntry>();
  private fan: ReturnType<typeof buildFan>;
  private core: ReturnType<typeof buildCore>;
  private pylon: ReturnType<typeof buildPylon>;
  private plume: ReturnType<typeof buildExhaustPlume>;
  private exhaustFlame: Flame;
  private inletFlame: Flame;
  private lpAngle = 0;
  private hpAngle = 0;
  private highlighted: PartId | null = null;
  private time = 0;
  private lastSurgeCount = 0;

  constructor(materials: Materials) {
    this.root.name = 'turbofan';

    const nacelle = buildNacelle(materials);
    this.fan = buildFan(materials);
    this.core = buildCore(materials);
    this.pylon = buildPylon(materials);
    this.plume = buildExhaustPlume();

    // Fan rotoru LP milinin ön ucudur
    this.core.lpSpool.add(this.fan.group);
    this.root.add(nacelle, this.core.group, this.pylon.group, this.plume.mesh);

    const noise = createNoiseTexture(256, 1234);
    this.exhaustFlame = new Flame(noise, 0.5, 3.6, 3.35, false);
    this.inletFlame = new Flame(noise, 1.1, 2.4, -2.25, true);
    this.root.add(
      this.exhaustFlame.mesh,
      this.exhaustFlame.light,
      this.inletFlame.mesh,
      this.inletFlame.light,
    );

    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    for (const m of [this.plume.mesh, this.fan.blurDisc, this.exhaustFlame.mesh, this.inletFlame.mesh]) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
    // Motor içi küçük parçaların gölge atması hem pahalı hem de görünmez
    for (const p of ['booster', 'hpc', 'hpt', 'lpt', 'combustor', 'shafts', 'casing'] as PartId[]) {
      this.root.traverse((o) => {
        if (o.userData.part === p) o.castShadow = false;
      });
    }

    this.indexParts();
  }

  /** Parça başına malzeme klonları: bir parçayı vurgulamak diğerlerini etkilemesin. */
  private indexParts() {
    const cache = new Map<string, EmissiveMaterial>();
    this.root.traverse((o) => {
      const part = o.userData.part as PartId | undefined;
      const mesh = o as THREE.Mesh;
      if (!part || !mesh.isMesh) return;
      const entry = this.parts.get(part) ?? { meshes: [], materials: new Set() };
      this.parts.set(part, entry);
      entry.meshes.push(mesh);
      this.pickables.push(mesh);

      const src = mesh.material as EmissiveMaterial;
      if (!src || !('emissive' in src)) return;
      const key = `${part}|${src.uuid}`;
      let mat = cache.get(key);
      if (!mat) {
        mat = src.clone();
        mat.userData.baseEmissive = mat.emissive.clone();
        mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
        cache.set(key, mat);
        entry.materials.add(mat);
      }
      mesh.material = mat;
    });
  }

  get partIds(): PartId[] {
    return [...this.parts.keys()];
  }

  partOf(obj: THREE.Object3D | null | undefined): PartId | null {
    return (obj?.userData.part as PartId | undefined) ?? null;
  }

  /** Motorun (ve yalnız motorun) malzemelerine kırpma düzlemleri uygular. */
  setClipping(planes: THREE.Plane[]) {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        // Kesitte tek yüzlü katı parçalar (kutular, silindirler) içi boş
        // görünmesin: kırpma açıkken arka yüzler de çizilir ve seçilebilir.
        if (m.userData.baseSide === undefined) m.userData.baseSide = m.side;
        m.side = planes.length ? THREE.DoubleSide : m.userData.baseSide;
        m.clippingPlanes = planes;
        m.clipShadows = true;
        m.needsUpdate = true;
      }
    });
  }

  highlight(part: PartId | null) {
    if (this.highlighted && this.highlighted !== part) this.restore(this.highlighted);
    this.highlighted = part;
  }

  private restore(part: PartId) {
    for (const m of this.parts.get(part)?.materials ?? []) {
      m.emissive.copy(m.userData.baseEmissive);
      m.emissiveIntensity = m.userData.baseEmissiveIntensity;
    }
  }

  /**
   * Kapalı motorda hiç görünmeyen iç parçaları (kompresörler, yanma odası,
   * HP türbin, miller) gizler. ~1M üçgeni gölge, AO ve ana geçişten çıkarır.
   * LP türbin egzozdan görünebildiği için açık kalır.
   */
  setInteriorVisible(v: boolean) {
    for (const part of ['booster', 'hpc', 'combustor', 'hpt', 'shafts', 'casing', 'gearbox'] as PartId[]) {
      for (const m of this.parts.get(part)?.meshes ?? []) m.visible = v;
    }
  }

  setWingVisible(v: boolean) {
    this.pylon.wing.visible = v;
  }

  setPylonVisible(v: boolean) {
    this.pylon.group.visible = v;
  }

  setPlumeVisible(v: boolean) {
    this.plume.mesh.visible = v;
  }

  /* ---------------------------------------------------------------- */

  update(snap: SimSnapshot, dt: number) {
    this.time += dt;
    const cyc = snap.cycle;

    // Mil dönüşleri (gerçek devir × görsel ölçek)
    this.lpAngle += snap.n1Rpm * RPM_TO_RAD * this.spinScale * dt;
    this.hpAngle += snap.n2Rpm * RPM_TO_RAD * this.spinScale * 0.35 * dt;
    this.core.lpSpool.rotation.z = this.lpAngle;
    this.core.hpSpool.rotation.z = this.hpAngle;

    // Hareket bulanıklığı diski
    const blur = THREE.MathUtils.smoothstep(snap.N1, 0.3, 0.78);
    this.fan.blurDisc.visible = this.motionBlur && blur > 0.01;
    this.fan.blurMat.opacity = blur * 0.52;
    this.fan.blurDisc.rotation.z = this.lpAngle * 0.35;

    // Yanma odası parlaması (T4) ve aşırı ısınan türbin kanatları
    const t4 = cyc.stations['4'].T;
    const glow = snap.lit ? THREE.MathUtils.clamp((t4 - 650) / (1750 - 650), 0, 1) : 0;
    for (const m of this.parts.get('combustor')?.materials ?? []) {
      if (m.name !== 'combustorGlow') continue;
      m.emissiveIntensity = snap.lit ? 0.4 + glow * 4.2 : 0.02;
      m.emissive.setHSL(THREE.MathUtils.lerp(0.02, 0.11, glow), 1, THREE.MathUtils.lerp(0.3, 0.62, glow));
    }
    const overheat = THREE.MathUtils.clamp((snap.egtTrue - 1000) / 700, 0, 1);
    for (const part of ['hpt', 'lpt'] as PartId[]) {
      for (const m of this.parts.get(part)?.materials ?? []) {
        if (m.name !== 'superalloy') continue;
        m.emissive.setRGB(1, 0.22, 0.04);
        m.emissiveIntensity = overheat * (part === 'hpt' ? 3 : 2);
      }
    }

    // Egzoz akışı
    this.plume.material.uniforms.uTime.value += dt;
    this.plume.material.uniforms.uThrust.value = THREE.MathUtils.clamp(cyc.coreThrust / 45e3, 0, 1);

    // Surge: giriş ve egzozdan alev patlaması
    if (snap.surgeCount > this.lastSurgeCount) {
      this.inletFlame.trigger(1.0, 3.2);
      this.exhaustFlame.trigger(1.1, 2.6);
      this.shake = Math.max(this.shake, 1);
    }
    this.lastSurgeCount = snap.surgeCount;

    // Torching / sıcak çalıştırma: yanmamış yakıt egzozdan alev alır
    const torch = snap.lit && snap.N2 < 0.55
      ? THREE.MathUtils.clamp((snap.egtTrue - 900) / 600, 0, 1)
      : 0;
    this.inletFlame.update(dt, this.time);
    this.exhaustFlame.update(dt, this.time, torch * 0.9);

    // Sarsıntı: titreşim + surge
    const vib = THREE.MathUtils.clamp((snap.vibration - 1.2) / 3, 0, 1);
    this.shake = Math.max(vib * 0.35, this.shake - dt * 1.8);

    // Vurgulama (nabız)
    if (this.highlighted) {
      const pulse = 0.35 + 0.25 * Math.sin(this.time * 5);
      for (const m of this.parts.get(this.highlighted)?.materials ?? []) {
        m.emissive.copy(HIGHLIGHT);
        m.emissiveIntensity = pulse;
      }
    }
  }
}
