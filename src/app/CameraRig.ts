/**
 * Kamera: hazır açılar, yumuşak geçişler, sarsıntı ve arayüz paneline göre
 * projeksiyon kaydırma (motor, panellerin kapatmadığı alanın ortasında kalır).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
  // Turboşaft: kaportasız küçük gaz jeneratörü (yer tutucu; M5a P8 yerleşimden hesaplar)
  turboshaft: BARE,
};

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
