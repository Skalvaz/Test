/**
 * Görsel motor: prosedürel 3B model + simülasyon durumunun görselleştirilmesi.
 *
 * Simülasyon (src/sim) motorun ne yaptığını hesaplar; bu sınıf yalnızca onu
 * gösterir: mil dönüşleri, hareket bulanıklığı, yanma odası ve türbin ısıl
 * parlaması, egzoz akışı, surge/torching alevleri. Ayrıca ders sistemi için
 * parça etiketleri, vurgulama ve kesit kırpması sağlar.
 */

import * as THREE from 'three';
import type { EngineKind, SimSnapshot } from '../sim';
import { buildNacelle } from './nacelle.js';
import { buildBareJet } from './barejet.js';
import { buildTurboprop } from './turboprop.js';
import { buildFan } from './fan.js';
import { buildCore } from './core.js';
import { buildPylon } from './pylon.js';
import { buildExhaustPlume } from './exhaust.js';
import { createNoiseTexture } from '../materials/textures.js';
import { EngineEffects } from '../effects/EngineEffects.js';
import { buildGroundCradle, buildPylonGantry } from './stand.js';
import { tagPart, ensureUV1 } from './geom.js';
import { clonePatched } from '../materials/weathering';
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
  | 'wing'
  | 'afterburner'
  | 'nozzle'
  | 'propeller'
  | 'stand';

type EmissiveMaterial = THREE.MeshStandardMaterial;

interface PartEntry {
  meshes: THREE.Object3D[];
  materials: Set<EmissiveMaterial>;
}

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
    // Alevin kendisini parçacıklar çizer (EngineEffects); bu koni yalnız
    // çevreyi aydınlatan ışık kaynağı olarak kalır
    this.mesh.visible = false;
    this.material.uniforms.uIntensity.value = this.intensity;
    this.material.uniforms.uTime.value = time;
    this.mesh.scale.setScalar(0.7 + 0.5 * Math.min(1, this.intensity));
    this.light.intensity = on ? 120 * this.intensity : 0;
  }
}

/* ------------------------------------------------------------------ */

/** Motor tipinden bağımsız görsel model arayüzü */
interface EngineModel {
  group: THREE.Group;
  lpSpool: THREE.Object3D;
  hpSpool: THREE.Object3D;
  blurDisc?: THREE.Mesh;
  blurMat?: THREE.MeshBasicMaterial;
  /** Önden görünen rotor kademesinin kanat sayısı (stroboskop sınırı için) */
  bladeCount?: number;
  /** Kaportasız motorlar: hücre askısı ve yer standı için bağlantı noktaları */
  stand?: { yoke: THREE.Object3D; mounts: number[]; engineR: number };
  /** Turboprop: pervane grubu ve pal açısı */
  propeller?: THREE.Object3D;
  setPitch?: (load: number, feather: number) => void;
  /** Art yakıcılı motorlar: değişken lüle */
  nozzle?: { set(area: number, abLevel: number): void };
  wing?: THREE.Object3D;
  mount?: THREE.Object3D;
  intake: { z: number; radius: number; y?: number };
  exhaust: { z: number; radius: number };
  /** Modele özel ek animasyon (ör. planet dişliler) */
  tick?: (lpAngle: number, propAngle: number) => void;
}

function buildTurbofanModel(materials: Materials): EngineModel {
  const group = new THREE.Group();
  const nacelle = buildNacelle(materials);
  const fan = buildFan(materials);
  const core = buildCore(materials);
  const pylon = buildPylon(materials);
  // Fan rotoru LP milinin ön ucudur
  core.lpSpool.add(fan.group);
  group.add(nacelle, core.group, pylon.group);
  return {
    group,
    lpSpool: core.lpSpool,
    hpSpool: core.hpSpool,
    blurDisc: fan.blurDisc,
    blurMat: fan.blurMat,
    bladeCount: 22,
    wing: pylon.wing,
    mount: pylon.group,
    intake: { z: -2.25, radius: 1.1 },
    exhaust: { z: 3.35, radius: 0.5 },
  };
}

export class EngineVisual {
  readonly root = new THREE.Group();
  readonly pickables: THREE.Object3D[] = [];
  readonly kind: EngineKind;
  /** Motor dışı titreşim (kamera sarsıntısı için) 0..1 */
  shake = 0;
  /** Görsel devir ölçeği: gerçek devir göz için çok hızlıdır */
  spinScale = 0.055;
  motionBlur = true;

  private parts = new Map<PartId, PartEntry>();
  private model: EngineModel;
  private plume: ReturnType<typeof buildExhaustPlume>;
  private exhaustFlame: Flame;
  readonly effects: EngineEffects;
  private inletFlame: Flame;
  private lpAngle = 0;
  private hpAngle = 0;
  private propAngle = 0;
  private nozzleArea = 1.4;
  private plumeBaseRadius: number;
  private highlighted: PartId | null = null;
  private time = 0;
  private lastSurgeCount = 0;

  private materials: Materials;

  constructor(materials: Materials, kind: EngineKind = 'turbofan') {
    this.materials = materials;
    this.kind = kind;
    this.root.name = kind;
    this.model =
      kind === 'turbofan'
        ? buildTurbofanModel(materials)
        : kind === 'turboprop'
          ? (buildTurboprop(materials) as unknown as EngineModel)
          : (buildBareJet(materials, kind) as unknown as EngineModel);
    const ex = this.model.exhaust;
    this.plume = buildExhaustPlume(ex.radius, ex.z);
    this.plumeBaseRadius = ex.radius;
    this.root.add(this.model.group, this.plume.mesh);

    const noise = createNoiseTexture(256, 1234);
    const inl = this.model.intake;
    this.exhaustFlame = new Flame(noise, ex.radius, kind === 'turbofan' ? 3.6 : 2.6, ex.z + 0.05, false);
    this.inletFlame = new Flame(noise, inl.radius, kind === 'turbofan' ? 2.4 : 1.4, inl.z, true);
    this.inletFlame.mesh.position.y = inl.y ?? 0;
    this.inletFlame.light.position.y = inl.y ?? 0;
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

    // Efektler (parçacıklar, art yakıcı alevi) gölge almaz ve seçilemez;
    // parça indekslemesinden sonra eklenmeleri için burada kurulur
    const prop = kind === 'turboprop' ? { z: -2.08, radius: 1.965, blades: 6 } : undefined;
    this.effects = new EngineEffects(
      { kind, intake: this.model.intake, exhaust: this.model.exhaust, prop },
      createNoiseTexture(256, 777),
    );
    const noShadow = [this.plume.mesh, this.exhaustFlame.mesh, this.inletFlame.mesh];
    if (this.model.blurDisc) noShadow.push(this.model.blurDisc);
    for (const m of noShadow) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
    // Motor içi küçük parçaların gölge atması hem pahalı hem de görünmez
    for (const p of ['booster', 'hpc', 'hpt', 'lpt', 'combustor', 'shafts', 'casing'] as PartId[]) {
      this.root.traverse((o) => {
        if (o.userData.part === p) o.castShadow = false;
      });
    }

    // Gerçek malzeme taramaları için metre ölçekli ikinci UV
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) ensureUV1(mesh.geometry);
    });
    this.indexParts();
    for (const m of [this.plume.mesh, this.exhaustFlame.mesh, this.inletFlame.mesh]) m.userData.noClip = true;
    this.effects.group.traverse((o) => (o.userData.noClip = true));
    this.root.add(this.effects.group);
  }

  private cradle: THREE.Object3D | null = null;

  /**
   * Zemin ve taşıyıcı: test hücresinde motor itki çerçevesine asılıdır;
   * başka ortamlarda yerdeki tekerlekli taşıma standına oturur.
   */
  setGround(floorY: number, inCell: boolean) {
    this.effects.setFloor(floorY);
    const st = this.model.stand;
    if (!st && !this.model.mount) return;
    if (st) st.yoke.visible = inCell;
    if (this.cradle) {
      this.model.group.remove(this.cradle);
      this.cradle.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mat = m.material as THREE.Material;
        if (mat.userData.owned) mat.dispose();
      });
      this.cradle = null;
    }
    if (!inCell) {
      const cradle = tagPart(
        st
          ? buildGroundCradle(this.materials, { mounts: st.mounts, engineR: st.engineR, floorY })
          : // Pilonlu turbofan: pilondan asılı portal sehpa
            buildPylonGantry(this.materials, { mounts: [-0.55, 1.25], top: 1.72, floorY }),
        'stand',
      );
      cradle.traverse((o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) ensureUV1(mesh.geometry);
      });
      this.model.group.add(cradle);
      this.cradle = cradle;
    }
  }

  /** Lüle ağzı (efektler için): z konumu ve yarıçap */
  get exhaustExit(): { z: number; radius: number } {
    return { z: this.model.exhaust.z, radius: this.model.exhaust.radius };
  }

  get intake(): { z: number; radius: number; y: number } {
    const i = this.model.intake;
    return { z: i.z, radius: i.radius, y: i.y ?? 0 };
  }

  /** Sahneden çıkarılırken GPU kaynaklarını bırakır (malzeme klonları, geometri). */
  dispose() {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.userData.shared) geos.add(mesh.geometry);
      const m = mesh.material;
      for (const mm of Array.isArray(m) ? m : [m]) if (mm.userData.baseEmissive) mats.add(mm);
    });
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    this.plume.material.dispose();
    this.effects.dispose();
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
        mat = clonePatched(src);
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
      // Stand askısı, egzoz/alev hacimleri ve parçacıklar kesilmez: yarım
      // kalan alev ya da havada asılı yarım kiriş yanlış görünür
      if (o.userData.part === 'stand' || o.userData.noClip) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        // Kesitte tek yüzlü katı parçalar (kutular, silindirler) içi boş
        // görünmesin: kırpma açıkken arka yüzler de çizilir ve seçilebilir.
        if (m.userData.baseSide === undefined) m.userData.baseSide = m.side;
        m.side = planes.length ? THREE.DoubleSide : m.userData.baseSide;
        // Kanat dizileri kırpılmaz: örnek bazında bütün kalır/kalkar (engine.ts)
        m.clippingPlanes = m.userData.wholeCut ? [] : planes;
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
    // Kaportasız motorlarda dişli kutusu ve tesisat dışarıdadır, hep görünür
    // ve girişten ilk kompresör kademeleri görünür
    const interior: PartId[] = ['hpc', 'combustor', 'hpt', 'shafts', 'casing'];
    if (this.kind === 'turbofan') interior.push('gearbox', 'booster');
    for (const part of interior) {
      for (const m of this.parts.get(part)?.meshes ?? []) m.visible = v;
    }
  }

  setWingVisible(v: boolean) {
    if (this.model.wing) this.model.wing.visible = v;
  }

  setPylonVisible(v: boolean) {
    if (this.model.mount) this.model.mount.visible = v;
  }

  setPlumeVisible(v: boolean) {
    this.plume.mesh.visible = v;
  }

  /* ---------------------------------------------------------------- */

  update(snap: SimSnapshot, dt: number, camera?: THREE.Camera) {
    this.time += dt;
    const cyc = snap.cycle;

    // Mil dönüşleri. Ekran kare hızı sınırlı olduğundan hızlı dönen bir
    // kanat dizisi her karede kanat aralığından fazla ilerlerse göz onu
    // duruyor ya da geri dönüyor sanır (vagon tekerleği / stroboskop etkisi).
    // Kamera da gerçekte böyle görür; oyunlardaki çözüm: görünür adımı kanat
    // aralığının bir kesriyle sınırla, hızı hareket bulanıklığı diskiyle ver.
    const m = this.model;
    // Görünür açısal hız: devirle orantılı, tasarım devrinde kare başına
    // kanat aralığının ~%30'u (60 fps'te). Düşük kare hızında da bu sınır
    // aşılmaz; daha fazlası bulanıklık diskiyle anlatılır.
    const cap = (blades: number) => (0.3 * Math.PI * 2) / blades / Math.max(dt, 1 / 240);
    const visual = (blades: number, frac: number) =>
      Math.min(((0.3 * Math.PI * 2) / blades) * 60 * Math.pow(Math.max(frac, 0), 1.2), cap(blades));
    const lpBlades = m.bladeCount ?? 30;
    this.lpAngle += visual(lpBlades, snap.N1) * dt;
    this.hpAngle += visual(40, snap.N2) * dt;
    m.lpSpool.rotation.z = this.lpAngle;
    m.hpSpool.rotation.z = this.hpAngle;

    // Pervane: kendi devrinde (redüksiyon dişlisi sonrası) ve pal açısı
    let blurSpeed = snap.N1;
    if (m.propeller) {
      this.propAngle += visual(6, snap.propRpm / 1200) * dt;
      m.propeller.rotation.z = this.propAngle;
      const feather = !snap.lit && snap.N1 < 0.35 ? 1 - snap.N1 / 0.35 : 0;
      m.setPitch?.(snap.propPitch, feather);
      blurSpeed = snap.propRpm / 1200;
    }

    m.tick?.(this.lpAngle, this.propAngle);

    // Hareket bulanıklığı diski
    if (m.blurDisc && m.blurMat) {
      const blur = this.motionBlur ? THREE.MathUtils.smoothstep(blurSpeed, 0.25, 0.7) : 0;
      m.blurDisc.visible = blur > 0.01;
      m.blurMat.opacity = blur * (m.propeller ? 0.95 : 0.85);
      m.blurDisc.rotation.z = (m.propeller ? this.propAngle : this.lpAngle) * 0.35;
    }

    // Değişken lüle: hidrolik aktüatör hızıyla izler
    if (m.nozzle) {
      this.nozzleArea += (snap.nozzleArea - this.nozzleArea) * Math.min(1, dt * 4);
      m.nozzle.set(this.nozzleArea, snap.abLevel);
      this.plume.mesh.scale.setScalar(this.model.exhaust.radius / this.plumeBaseRadius);
      this.plume.mesh.position.z = this.model.exhaust.z - 0.05;
    }

    // Jet borusu sıcaklığı: art yakıcı yanmasa da eski turbojetin kuyruk
    // konisi ve lülesi yüksek güçte donuk kızıl kor gibi görünür
    const hot = THREE.MathUtils.smoothstep(cyc.stations['7'].T, 820, 1250);
    if (this.highlighted !== 'exhaust') {
      for (const mat of this.parts.get('exhaust')?.materials ?? []) {
        if (mat.name !== 'sooted') continue;
        mat.emissive.setRGB(1, 0.22, 0.04);
        mat.emissiveIntensity = hot * 1.4 + snap.abLevel * 0.6;
      }
    }

    // Art yakıcı gömleği, alev tutucular ve seramik lüle iç yüzü kor olur
    const ab = snap.abLevel;
    for (const part of ['afterburner', 'nozzle'] as PartId[]) {
      if (part === this.highlighted) continue;
      for (const mat of this.parts.get(part)?.materials ?? []) {
        if (mat.name === 'abLiner') mat.emissiveIntensity = ab * 0.9 + hot * 0.15;
        else if (mat.name === 'flameHolder') mat.emissiveIntensity = ab * 2.2 + hot * 0.4;
        else if (mat.name === 'nozzleCeramic') mat.emissiveIntensity = ab * 0.55 + hot * 0.35;
      }
    }

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
        if (!['superalloy', 'hptBlade', 'hptVane', 'lptBlade', 'lptVane'].includes(m.name)) continue;
        m.emissive.setRGB(1, 0.22, 0.04);
        m.emissiveIntensity = overheat * (part === 'hpt' ? 3 : 2);
      }
    }

    // Egzoz akışı
    this.plume.material.uniforms.uTime.value += dt;
    this.plume.material.uniforms.uThrust.value = THREE.MathUtils.clamp(
      cyc.coreThrust / (this.kind === 'turbofan' ? 45e3 : 60e3),
      0,
      1,
    );

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
    if (camera) this.effects.update(snap, dt, camera, this.propAngle);
  }
}
