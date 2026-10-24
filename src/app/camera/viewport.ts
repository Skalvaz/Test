/**
 * Görüntü alanı (Dalga 0'da CameraRig'den ayrıldı): arayüz panellerinin
 * kapladığı kenar boşlukları, projeksiyonun panellerin kapatmadığı alanın
 * ortasına kaydırılması (setViewOffset) ve iki dikdörtgen:
 *
 * - `safeRect()`: panellerin kapatmadığı **serbest 3B alanı** (pencere −
 *   kenar boşlukları). Ölçek figürü ve 3B kaplamalar buraya sığmalıdır
 *   (1G). Bildirimler için ölçü DEĞİLDİR: panel sütunları dışında kalan
 *   her şey bu alandadır.
 * - `engineRect()`: **motorun ekrandaki dikdörtgeni** (motorun sınır
 *   kutusunun kamera izdüşümü, kare başına önbellekli). Bildirimler ve
 *   kaplamalar motoru örtmemelidir (A-03; 1D ölçütü bununla ölçülür).
 *
 * Sahibi: Dalga 1'de 1G (safeRect: ölçek figürü), Dalga 2'de 2E (motor
 * alanı ≥ %55). İkisi de modül düzeyinde okunur (Toasts gibi App'e bağlı
 * olmayan bileşenler): etkin görüntü alanı CameraRig kurulunca kaydolur.
 */

import * as THREE from 'three';

export interface ScreenInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Ekran dikdörtgeni [CSS px, sol üst köşe] */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Sınır kutusunun ekran dikdörtgeni [CSS px] (kameranın projeksiyonu
 * setViewOffset'i içerir: NDC tuvale eşlenir). Görüntüye kırpılır; kutu
 * kameranın arkasına taşıyorsa bütün görüntü (temkinli), tamamen dışarıdaysa
 * boş dikdörtgen döner.
 */
export function projectBox(camera: THREE.Camera, box: THREE.Box3, w: number, h: number): ScreenRect {
  if (box.isEmpty()) return { x: 0, y: 0, width: 0, height: 0 };
  camera.updateMatrixWorld();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    tmp.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    // Kameranın arkasındaki köşe: izdüşüm ters döner, bütün görüntü say
    tmpCam.copy(tmp).applyMatrix4(camera.matrixWorldInverse);
    if (tmpCam.z >= 0) return { x: 0, y: 0, width: w, height: h };
    tmp.project(camera);
    const sx = ((tmp.x + 1) / 2) * w;
    const sy = ((1 - tmp.y) / 2) * h;
    x0 = Math.min(x0, sx);
    x1 = Math.max(x1, sx);
    y0 = Math.min(y0, sy);
    y1 = Math.max(y1, sy);
  }
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(w, x1);
  y1 = Math.min(h, y1);
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}
const tmp = new THREE.Vector3();
const tmpCam = new THREE.Vector3();

export class Viewport {
  private insets: ScreenInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  private size = { w: 1, h: 1 };
  private currentOffset = new THREE.Vector3(0, 0, 1);
  private camera: THREE.Camera | null = null;
  private engineBounds: (() => THREE.Box3 | null) | null = null;
  private frame = 0;
  private engineCache: { frame: number; rect: ScreenRect | null } = { frame: -1, rect: null };

  /** Görünür 3B alanını daraltan panellerin kapladığı kenar boşlukları (px). */
  setInsets(insets: ScreenInsets) {
    this.insets = insets;
  }

  getInsets(): Readonly<ScreenInsets> {
    return this.insets;
  }

  setSize(w: number, h: number) {
    this.size = { w, h };
  }

  /**
   * Projeksiyonu, panellerin kapatmadığı alanın merkezine kaydırır ve alan
   * küçüldükçe hafifçe uzaklaştırır (motor paneller arasına sığsın).
   */
  apply(camera: THREE.PerspectiveCamera, immediate = false) {
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
    camera.setViewOffset(w, h, x0, y0, w * k, h * k);
    camera.updateProjectionMatrix();
  }

  /**
   * Panellerin kapatmadığı ekran dikdörtgeni (motorun güvenli alanı): bütün
   * görüntüden kenar boşlukları çıkarılır. Bildirimler ve kaplamalar buraya
   * girmemelidir (A-03); ölçek figürü buraya sığmalıdır (1G).
   */
  safeRect(): ScreenRect {
    const { w, h } = this.size;
    const { left, right, top, bottom } = this.insets;
    return { x: left, y: top, width: Math.max(0, w - left - right), height: Math.max(0, h - top - bottom) };
  }

  /** Motorun izdüşümü için kamera (CameraRig) ve sınır kutusu kaynağı (App) */
  setCamera(camera: THREE.Camera) {
    this.camera = camera;
  }
  setEngineBounds(fn: (() => THREE.Box3 | null) | null) {
    this.engineBounds = fn;
    this.engineCache.frame = -1;
  }

  /** Kare sonu (CameraRig.update): motor dikdörtgeni önbelleği bir sonraki okumada yenilenir */
  nextFrame() {
    this.frame++;
  }

  /**
   * Motorun ekrandaki dikdörtgeni [CSS px]; kamera ya da sınır kutusu yoksa
   * null. Kare başına bir kez hesaplanır (8 köşe izdüşümü).
   */
  engineRect(): ScreenRect | null {
    if (this.engineCache.frame === this.frame) return this.engineCache.rect;
    const box = this.engineBounds?.() ?? null;
    const rect = this.camera && box ? projectBox(this.camera, box, this.size.w, this.size.h) : null;
    this.engineCache = { frame: this.frame, rect };
    return rect;
  }
}

let active: Viewport | null = null;

/** Etkin görüntü alanını kaydeder (CameraRig kurulurken) */
export function setActiveViewport(v: Viewport | null) {
  active = v;
}

/** Etkin görüntü alanındaki motorun ekran dikdörtgeni; kayıt ya da motor yoksa null */
export function engineRect(): ScreenRect | null {
  return active?.engineRect() ?? null;
}

/** Etkin görüntü alanının güvenli dikdörtgeni; kayıt yoksa bütün pencere */
export function safeRect(): ScreenRect {
  if (active) return active.safeRect();
  const w = typeof window !== 'undefined' ? window.innerWidth : 0;
  const h = typeof window !== 'undefined' ? window.innerHeight : 0;
  return { x: 0, y: 0, width: w, height: h };
}
