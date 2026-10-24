/**
 * Kamera: hazır açılar, yumuşak geçişler, sarsıntı ve arayüz paneline göre
 * projeksiyon kaydırma (motor, panellerin kapatmadığı alanın ortasında kalır).
 *
 * Dalga 0'dan beri ince kabuk: işin kendisi `camera/` alt modüllerindedir,
 * her birinin bir dalgada tek sahibi vardır (docs/UST-SEVIYE-PLANI.md §5):
 *   camera/viewport.ts  setViewOffset, güvenli dikdörtgen (1G, 2E)
 *   camera/shots.ts     açı takımları ve geçişler (2F, 4B)
 *   camera/shake.ts     sarsıntı (1I, 3D)
 *   camera/freecam.ts   yörünge / serbest kamera (3A)
 * Açılar ve yardımcılar buradan da dışa verilir (eski içe aktarmalar).
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clampToBounds, createOrbit, stepOrbit } from './camera/freecam';
import { CameraShake, type ShakeInput } from './camera/shake';
import { ShotPlayer, VIEWS, type CameraView, type ShotState, type ViewName } from './camera/shots';
import { setActiveViewport, Viewport, type ScreenInsets, type ScreenRect } from './camera/viewport';

export {
  VIEWS,
  KIND_VIEWS,
  frameOf,
  scaleViews,
  frameDesign,
  viewsFor,
  fitViews,
  type CameraView,
  type ViewName,
  type DesignFrame,
  type ViewFit,
  type ViewSet,
} from './camera/shots';
export type { ScreenInsets, ScreenRect } from './camera/viewport';
export type { ShakeInput } from './camera/shake';

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
  readonly viewport = new Viewport();
  readonly shots = new ShotPlayer();
  readonly shake = new CameraShake();
  private tmpPos = new THREE.Vector3();
  private tmpTarget = new THREE.Vector3();

  constructor(dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 14000);
    this.controls = createOrbit(this.camera, dom, VIEWS.front.position, VIEWS.front.target);
    this.viewport.setCamera(this.camera);
    setActiveViewport(this.viewport);
  }

  /** Süren geçişin durumu (kayıt betikleri `anim.active = false` ile keser) */
  get anim(): ShotState {
    return this.shots.state;
  }

  resize(w: number, h: number) {
    this.viewport.setSize(w, h);
    this.camera.aspect = w / h;
    this.viewport.apply(this.camera, true);
  }

  /** Görünür 3B alanını daraltan panellerin kapladığı kenar boşlukları (px). */
  setInsets(insets: ScreenInsets) {
    this.viewport.setInsets(insets);
  }

  /** Panellerin kapatmadığı ekran dikdörtgeni (serbest 3B alanı; camera/viewport.ts) */
  safeRect(): ScreenRect {
    return this.viewport.safeRect();
  }

  /** Motorun ekrandaki dikdörtgeni (bildirimler bunu örtmez; camera/viewport.ts) */
  engineRect(): ScreenRect | null {
    return this.viewport.engineRect();
  }

  go(name: ViewName, immediate = false) {
    const v: CameraView = this.overrides[name] ?? VIEWS[name];
    this.current = name;
    if (typeof v.cutaway === 'boolean' || name !== 'menu') this.onCutaway?.(!!v.cutaway);
    if (immediate) {
      this.camera.position.set(...v.position);
      this.controls.target.set(...v.target);
      this.camera.fov = v.fov;
      this.shots.stop();
      this.viewport.apply(this.camera, true);
      this.controls.update();
      return;
    }
    this.shots.start(this.camera, this.controls.target, this.tmpPos.set(...v.position), this.tmpTarget.set(...v.target), v.fov);
  }

  /**
   * Bir noktaya yaklaş: bakış yönü korunur, kamera noktaya `dist` kadar
   * yaklaşır (bounds varsa sınır içinde kalır).
   */
  focusOn(point: THREE.Vector3, dist = 1.6) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const to = this.tmpPos.copy(point).addScaledVector(dir, Math.max(dist, this.controls.minDistance + 0.05));
    if (this.bounds) this.bounds.clampPoint(to, to);
    this.shots.start(this.camera, this.controls.target, to, this.tmpTarget.copy(point), 34);
  }

  get animating() {
    return this.shots.active;
  }

  /**
   * Kare güncellemesi. `shake`: sarsıntı girdisi (App her kare doldurur:
   * genlik, dt, itki oranı, yakınlık, darbe; camera/shake.ts) ya da yalnız
   * genlik (ileri sarma: 0). Dalga 1'de bu yöntemin sahibi 1I'dir (O-10).
   */
  update(dt: number, shake: number | ShakeInput) {
    // Sarsıntıyı geri al (kontroller temiz konumla çalışsın)
    this.shake.remove(this.camera);
    this.shots.step(dt, this.camera, this.controls.target);
    stepOrbit(this.controls, this.autoRotate, this.shots.active);
    clampToBounds(this.camera, this.bounds);
    this.viewport.apply(this.camera);
    this.shake.apply(this.camera, shake);
    this.viewport.nextFrame();
  }
}
