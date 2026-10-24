/**
 * Görüntü alanı (Dalga 0'da CameraRig'den ayrıldı): arayüz panellerinin
 * kapladığı kenar boşlukları, projeksiyonun panellerin kapatmadığı alanın
 * ortasına kaydırılması (setViewOffset) ve motorun güvenli dikdörtgeni.
 * Sahibi: Dalga 1'de 1G (safeRect: ölçek figürü, 1D bildirim konumu ölçer),
 * Dalga 2'de 2E (motor alanı ≥ %55).
 *
 * `safeRect()` modül düzeyinde de okunur (Toasts gibi App'e bağlı olmayan
 * bileşenler): etkin görüntü alanı CameraRig kurulunca kaydolur.
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

export class Viewport {
  private insets: ScreenInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  private size = { w: 1, h: 1 };
  private currentOffset = new THREE.Vector3(0, 0, 1);

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
}

let active: Viewport | null = null;

/** Etkin görüntü alanını kaydeder (CameraRig kurulurken) */
export function setActiveViewport(v: Viewport | null) {
  active = v;
}

/** Etkin görüntü alanının güvenli dikdörtgeni; kayıt yoksa bütün pencere */
export function safeRect(): ScreenRect {
  if (active) return active.safeRect();
  const w = typeof window !== 'undefined' ? window.innerWidth : 0;
  const h = typeof window !== 'undefined' ? window.innerHeight : 0;
  return { x: 0, y: 0, width: w, height: h };
}
