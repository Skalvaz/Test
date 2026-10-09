/**
 * Kamera: hazır açılar, yumuşak geçişler, sarsıntı ve arayüz paneline göre
 * projeksiyon kaydırma (motor, panellerin kapatmadığı alanın ortasında kalır).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { VisualSource } from '../engine/models';
import type { EngineKind } from '../sim';

export interface CameraView {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  cutaway?: boolean;
}

export const VIEWS = {
  front: { label: 'Üç çeyrek ön', position: [6.4, 1.9, -6.6], target: [0, 0, 0.25], fov: 32 },
  inlet: { label: 'Hava girişi', position: [1.7, 0.3, -5.6], target: [0, 0, -1.3], fov: 38 },
  fan: { label: 'Fan yakın', position: [1.05, 0.42, -3.05], target: [0.12, 0.18, -0.55], fov: 40 },
  side: { label: 'Yan profil', position: [12.5, 0.7, 1.3], target: [0, 0, 1.3], fov: 22 },
  exhaust: { label: 'Egzoz', position: [4.9, 1.05, 8.6], target: [0, 0, 3.4], fov: 30 },
  top: { label: 'Üstten', position: [4.6, 5.4, -4.2], target: [0, 0.6, 0.2], fov: 30 },
  cutaway: { label: 'Kesit', position: [8.6, 1.4, 1.3], target: [0, 0, 1.5], fov: 28, cutaway: true },
  cutawayCore: { label: 'Kesit — çekirdek', position: [4.6, 0.9, 1.9], target: [0, 0, 2.05], fov: 30, cutaway: true },
  menu: { label: 'Menü', position: [7.4, 1.4, -5.2], target: [-1.6, 0.2, 0.6], fov: 30 },
} satisfies Record<string, CameraView>;

export type ViewName = keyof typeof VIEWS;

/**
 * Motor tipine göre kamera açıları. Kaportasız motorlar yolcu turbofanından
 * çok daha ince (R ≈ 0.5 m) ve ön yüzleri daha öndedir; turboprobun girişi
 * pervanenin altındadır. Verilmeyen açılar VIEWS'ten gelir.
 */
const BARE: Partial<Record<ViewName, CameraView>> = {
  inlet: { label: 'Hava girişi', position: [1.25, 0.4, -4.6], target: [0, 0, -2.0], fov: 36 },
  fan: { label: 'Kompresör yakın', position: [0.3, 0.18, -2.75], target: [0.02, 0.02, -1.95], fov: 44 },
  side: { label: 'Yan profil', position: [11, 0.6, 0.3], target: [0, 0, 0.3], fov: 22 },
  exhaust: { label: 'Egzoz', position: [2.6, 0.6, 5.6], target: [0, 0, 2.4], fov: 30 },
  cutaway: { label: 'Kesit', position: [6.8, 1.0, 0.2], target: [0, 0, 0.2], fov: 30, cutaway: true },
  cutawayCore: { label: 'Kesit — çekirdek', position: [3.0, 0.6, 0.2], target: [0, 0, 0.0], fov: 32, cutaway: true },
};
export const KIND_VIEWS: Record<EngineKind, Partial<Record<ViewName, CameraView>>> = {
  turbofan: {},
  militaryTurbofan: BARE,
  turbojet: BARE,
  turboprop: {
    ...BARE,
    inlet: { label: 'Hava girişi', position: [1.7, -1.05, -0.9], target: [0, -0.62, -1.65], fov: 38 },
    fan: { label: 'Pervane ve redüktör', position: [2.2, 0.7, -4.4], target: [0, 0, -1.8], fov: 36 },
    exhaust: { label: 'Egzoz', position: [2.2, 0.5, 4.4], target: [0, 0, 1.4], fov: 30 },
    cutawayCore: { label: 'Kesit — çekirdek', position: [3.0, 0.6, -0.5], target: [0, 0, -0.3], fov: 32, cutaway: true },
  },
  // Turboşaft: elle ayarlı açı yok; viewsFor yerleşimden çerçeveler
  // (frameDesign). Bu satır yalnız doğrudan okuyanlar için geri düşüş
  turboshaft: BARE,
};

/** Açıları elle ayarlanmış sunum tipleri (kayıt sahneleri bunlara dayanır) */
const TUNED: ReadonlySet<EngineKind> = new Set<EngineKind>(['turbofan', 'militaryTurbofan', 'turbojet', 'turboprop']);

/** Motorun kamera çerçevesi: boy, en büyük çap ve eksenel orta nokta [m] */
export interface DesignFrame {
  length: number;
  diameter: number;
  zMid: number;
}

/**
 * Yerleşimden çerçeve: dış zarfın (`outerProfile`) eksenel uçları ve en
 * büyük yarıçapı; pervaneli motorda pervane çapı da (metrics.diameter).
 * Zarf yoksa giriş ve çıkış ağızları.
 */
export function frameOf(src: Pick<VisualSource, 'layout' | 'built'>): DesignFrame {
  const L = src.layout;
  const prof = L.outerProfile ?? [];
  let z0 = L.intake.z;
  let z1 = L.exhaustExit.z;
  let r = Math.max(L.intake.radius, L.exhaustExit.radius);
  if (prof.length >= 2) {
    z0 = Math.min(z0, prof[0][0]);
    z1 = Math.max(z1, prof[prof.length - 1][0]);
    for (const [, pr] of prof) r = Math.max(r, pr);
  }
  const diameter = Math.max(2 * r, src.built.flowpath.metrics.diameter);
  return { length: Math.max(z1 - z0, 0.1), diameter, zMid: (z0 + z1) / 2 };
}

/** Çerçeveye sığdırma uzaklığının ölçüsü (§6.7): boy ya da çap baskın */
const frameSize = (m: DesignFrame) => Math.max(m.length * 0.62, m.diameter * 1.35);

type ViewSet = Partial<Record<ViewName, CameraView>>;

/**
 * Açı takımını bir motordan ötekine taşır: hedefler eksenel orta noktaya
 * göre, kamera hedefe göre çerçeve ölçüsü oranında ölçeklenir (bakış yönü
 * ve görüş açısı korunur). Verilmeyen açılar VIEWS'ten alınıp taşınır.
 */
export function scaleViews(views: ViewSet, from: DesignFrame, to: DesignFrame): ViewSet {
  const k = frameSize(to) / frameSize(from);
  const out: ViewSet = {};
  for (const name of Object.keys(VIEWS) as ViewName[]) {
    if (name === 'menu') continue;
    const v: CameraView = views[name] ?? VIEWS[name];
    const t: [number, number, number] = [v.target[0] * k, v.target[1] * k, to.zMid + (v.target[2] - from.zMid) * k];
    const p: [number, number, number] = [
      t[0] + (v.position[0] - v.target[0]) * k,
      t[1] + (v.position[1] - v.target[1]) * k,
      t[2] + (v.position[2] - v.target[2]) * k,
    ];
    out[name] = { ...v, position: p, target: t };
  }
  return out;
}

/** BARE açılarının ayarlandığı motorun (TJ şablonu) çerçevesi */
const BARE_FRAME: DesignFrame = { length: 5.549, diameter: 1.56, zMid: 0.1245 };

/**
 * Elle ayarlı açısı olmayan motor için çerçeve (turboşaft; atölyede yeni
 * sunum tipi). Kaportasız turbojet açıları (BARE) TJ şablonunun
 * çerçevesinden (boy 5,55 m, çap 1,56 m, orta z 0,12) bu motora taşınır.
 */
export function frameDesign(m: DesignFrame): ViewSet {
  return scaleViews(BARE, BARE_FRAME, m);
}

/**
 * Görsel kaynağın kamera açıları. Şablon yuvalarında (kind yuvası, elle
 * ayarlı tip) KIND_VIEWS aynen: kayıt sahneleri ve dersler bozulmaz. Atölye
 * yuvasında aynı sunum tipinin açıları şablon motorundan (`reference`) bu
 * tasarımın boyutuna ölçeklenir; elle ayarlı açısı olmayan tip (turboşaft)
 * yerleşimden çerçevelenir.
 */
export function viewsFor(
  src: Pick<VisualSource, 'slot' | 'traits' | 'layout' | 'built'>,
  reference?: Pick<VisualSource, 'layout' | 'built'>,
  fit?: ViewFit,
): ViewSet {
  const kind = src.traits.presentation;
  const fitted = (v: ViewSet) => (fit ? fitViews(v, fit) : v);
  if (!TUNED.has(kind)) return fitted(frameDesign(frameOf(src)));
  if (src.slot !== 'workshop' || !reference) return KIND_VIEWS[kind];
  return fitted(scaleViews(KIND_VIEWS[kind], frameOf(reference), frameOf(src)));
}

/** Kameranın çıkamayacağı kutu (test hücresi) ve yörünge kontrolünün en uzak mesafesi */
export interface ViewFit {
  bounds: THREE.Box3;
  maxDistance: number;
}

/**
 * Ölçeklenmiş açıyı kapalı alana sığdırır: kamera kutunun dışına ya da
 * yörünge sınırının ötesine düşüyorsa bakış doğrultusunda hedefe yaklaşır
 * ve görüş açısı aynı oranda genişler (motor ekranda aynı boyda kalır;
 * büyük motor hücrede geniş açıyla çekilir). En çok 70°.
 */
export function fitViews(views: ViewSet, fit: ViewFit): ViewSet {
  const out: ViewSet = {};
  const margin = 0.3;
  const box = fit.bounds.clone().expandByScalar(-margin);
  for (const name of Object.keys(views) as ViewName[]) {
    const v = views[name]!;
    const t = new THREE.Vector3(...v.target);
    const p = new THREE.Vector3(...v.position);
    const dir = p.clone().sub(t);
    const d = dir.length();
    let s = Math.min(1, (fit.maxDistance - margin) / Math.max(d, 1e-6));
    // Hedeften kameraya ışın kutudan nerede çıkar (hedef kutunun içinde)
    if (box.containsPoint(t)) {
      for (const ax of ['x', 'y', 'z'] as const) {
        const lim = dir[ax] > 0 ? box.max[ax] : box.min[ax];
        if (Math.abs(dir[ax]) > 1e-9) s = Math.min(s, Math.max(0.05, (lim - t[ax]) / dir[ax]));
      }
    }
    if (s >= 0.999) {
      out[name] = v;
      continue;
    }
    const half = THREE.MathUtils.degToRad(v.fov / 2);
    const fov = Math.min(70, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(half) / s)));
    out[name] = { ...v, position: t.clone().addScaledVector(dir, s).toArray() as [number, number, number], fov };
  }
  return out;
}

export interface ScreenInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  autoRotate = false;
  /** Kapalı ortamda (test hücresi) kameranın çıkamayacağı sınırlar */
  bounds: THREE.Box3 | null = null;
  onCutaway?: (on: boolean) => void;
  current: ViewName = 'front';
  /** Seçili motor tipi için açı düzeltmeleri */
  overrides: Partial<Record<ViewName, CameraView>> = {};

  private anim = {
    active: false,
    t: 0,
    duration: 1.4,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    fromFov: 32,
    toFov: 32,
  };
  private shakeOffset = new THREE.Vector3();
  private insets: ScreenInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  private size = { w: 1, h: 1 };
  private currentOffset = new THREE.Vector3(0, 0, 1);

  constructor(dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 14000);
    this.camera.position.set(...VIEWS.front.position);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.86;
    this.controls.target.set(...VIEWS.front.target);
    this.controls.update();
  }

  resize(w: number, h: number) {
    this.size = { w, h };
    this.camera.aspect = w / h;
    this.applyOffset(true);
  }

  /** Görünür 3B alanını daraltan panellerin kapladığı kenar boşlukları (px). */
  setInsets(insets: ScreenInsets) {
    this.insets = insets;
  }

  /**
   * Projeksiyonu, panellerin kapatmadığı alanın merkezine kaydırır ve alan
   * küçüldükçe hafifçe uzaklaştırır (motor paneller arasına sığsın).
   */
  private applyOffset(immediate = false) {
    const { w, h } = this.size;
    const { left, right, top, bottom } = this.insets;
    const sx = (left - right) / 2;
    const sy = (bottom - top) / 2;
    const freeW = Math.max(w - left - right, w * 0.3);
    const freeH = Math.max(h - top - bottom, h * 0.3);
    const zoom = THREE.MathUtils.clamp(Math.sqrt((w * h) / (freeW * freeH)), 1, 1.8);
    const target = new THREE.Vector3(sx, sy, zoom);
    if (immediate) this.currentOffset.copy(target);
    else this.currentOffset.lerp(target, 0.08);
    const { x: ox, y: oy, z: k } = this.currentOffset;
    // Pencere, tam görüntünün k katı büyüklüğünde; merkez (w/2 + ox, h/2 − oy)'ye düşer
    const x0 = w / 2 - (w / 2 + ox) * k;
    const y0 = h / 2 - (h / 2 - oy) * k;
    this.camera.setViewOffset(w, h, x0, y0, w * k, h * k);
    this.camera.updateProjectionMatrix();
  }

  go(name: ViewName, immediate = false) {
    const v: CameraView = this.overrides[name] ?? VIEWS[name];
    this.current = name;
    if (typeof v.cutaway === 'boolean' || name !== 'menu') this.onCutaway?.(!!v.cutaway);
    if (immediate) {
      this.camera.position.set(...v.position);
      this.controls.target.set(...v.target);
      this.camera.fov = v.fov;
      this.anim.active = false;
      this.applyOffset(true);
      this.controls.update();
      return;
    }
    const a = this.anim;
    a.fromPos.copy(this.camera.position);
    a.toPos.set(...v.position);
    a.fromTarget.copy(this.controls.target);
    a.toTarget.set(...v.target);
    a.fromFov = this.camera.fov;
    a.toFov = v.fov;
    a.t = 0;
    a.active = true;
  }

  /**
   * Bir noktaya yaklaş: bakış yönü korunur, kamera noktaya `dist` kadar
   * yaklaşır (bounds varsa sınır içinde kalır).
   */
  focusOn(point: THREE.Vector3, dist = 1.6) {
    const a = this.anim;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    a.fromPos.copy(this.camera.position);
    a.toPos.copy(point).addScaledVector(dir, Math.max(dist, this.controls.minDistance + 0.05));
    if (this.bounds) this.bounds.clampPoint(a.toPos, a.toPos);
    a.fromTarget.copy(this.controls.target);
    a.toTarget.copy(point);
    a.fromFov = this.camera.fov;
    a.toFov = 34;
    a.t = 0;
    a.active = true;
  }

  get animating() {
    return this.anim.active;
  }

  update(dt: number, shake: number) {
    const a = this.anim;
    // Sarsıntıyı geri al (kontroller temiz konumla çalışsın)
    this.camera.position.sub(this.shakeOffset);

    if (a.active) {
      a.t += dt / a.duration;
      const k = THREE.MathUtils.smootherstep(Math.min(a.t, 1), 0, 1);
      this.camera.position.lerpVectors(a.fromPos, a.toPos, k);
      this.controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
      this.camera.fov = THREE.MathUtils.lerp(a.fromFov, a.toFov, k);
      if (a.t >= 1) a.active = false;
    }
    this.controls.autoRotate = this.autoRotate && !a.active;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.update();
    if (this.bounds) this.camera.position.clamp(this.bounds.min, this.bounds.max);
    this.applyOffset();

    if (shake > 0.001) {
      const s = shake * 0.035;
      this.shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }
    this.camera.position.add(this.shakeOffset);
  }
}
