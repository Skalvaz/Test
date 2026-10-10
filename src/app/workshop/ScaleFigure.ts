/**
 * Ölçek figürü (M5a §6.7, P9): motorun önünde zeminde duran 1,8 m'lik insan
 * silueti ve "1,8 m" etiketi. Öğrenci motorun gerçek boyunu sezsin: 66 kg/s'lik
 * turbojet bir insan boyundadır, 470 kg/s'lik turbofanın fanı iki insan
 * boyunu aşar.
 *
 * Sahnede sıradan bir nesnedir (motorun arkasında kalırsa örtülür) ama
 * kesitte kırpılmaz (`userData.noClip`), gölge atmaz ve ışın seçimine
 * girmez. Silüet her karede dikey eksen etrafında kameraya döner.
 *
 * ## Kurulum ve kullanım (P10)
 *
 * ```ts
 * const figure = new ScaleFigure(this.scene);
 * figure.place(built, this.floorY);     // her onBuilt'te (motor boyu değişir)
 * this.frameHooks.add(() => figure.frame(this.rig.camera));
 * figure.setVisible(showScale);         // Görünüm menüsü: "Ölçek figürü"
 * // çıkışta: figure.dispose();
 * ```
 *
 * Kamu API'si: `place(b, floorY)`, `frame(camera)`, `setVisible(v)`,
 * `visible`, `position` (salt okunur), `dispose()`.
 */

import * as THREE from 'three';
import type { BuiltEngine } from '../../design/graph';
import { meridionalOutline, outlineBounds } from '../../design/outline';
import { cssColor } from './overlay3d';

/** Figür boyu [m] */
export const FIGURE_HEIGHT = 1.8;

/**
 * Sağ yarı silüet (x ≥ 0), baştan ayağa; boy 1,8 m'ye göre [m]. Önden
 * görünüş: omuz genişliği 0,48 m, kollar yanda, bacaklar hafif açık.
 */
const HALF: [number, number][] = [
  [0.046, 1.58],
  [0.056, 1.505],
  [0.16, 1.475],
  [0.215, 1.44],
  [0.238, 1.36],
  [0.245, 1.18],
  [0.238, 0.98],
  [0.232, 0.88],
  [0.245, 0.8],
  [0.222, 0.735],
  [0.198, 0.76],
  [0.196, 0.88],
  [0.19, 1.02],
  [0.185, 1.18],
  [0.172, 1.27],
  [0.158, 1.16],
  [0.145, 1.04],
  [0.16, 0.93],
  [0.158, 0.7],
  [0.135, 0.5],
  [0.13, 0.33],
  [0.1, 0.09],
  [0.13, 0.02],
  [0.125, 0],
  [0.035, 0],
  [0.04, 0.09],
  [0.045, 0.3],
  [0.04, 0.5],
  [0.03, 0.75],
];
const HEAD = { y: 1.692, r: 0.108 };

/** Silüet şekilleri (gövde + baş), yerel: ayaklar y = 0'da, yüz +Z'ye */
export function figureShapes(height = FIGURE_HEIGHT): THREE.Shape[] {
  const k = height / FIGURE_HEIGHT;
  const body = new THREE.Shape();
  const right = HALF.map(([x, y]) => new THREE.Vector2(x * k, y * k));
  const left = HALF.map(([x, y]) => new THREE.Vector2(-x * k, y * k));
  // Saat yönünün tersine: kasıktan sağ bacak iç yüzü → ayak → sağ dış yan →
  // kol → boyun → sol yan (baştan aşağı) → sol bacak iç yüzü → kasık
  body.moveTo(0, 0.84 * k);
  const ccw = [...[...right].reverse(), new THREE.Vector2(0, 1.582 * k), ...left];
  for (const p of ccw) body.lineTo(p.x, p.y);
  body.closePath();
  const head = new THREE.Shape();
  head.absarc(0, HEAD.y * k, HEAD.r * k, 0, Math.PI * 2, false);
  return [body, head];
}

/** "1,8 m" etiketi (tuval dokusu) */
function labelSprite(text: string, color: THREE.Color): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const g = c.getContext('2d');
  if (!g) return null;
  g.font = '600 26px Inter, "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(6, 9, 13, 0.85)';
  g.strokeText(text, 64, 25);
  g.fillStyle = `#${color.getHexString()}`;
  g.fillText(text, 64, 25);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  mat.toneMapped = false;
  const s = new THREE.Sprite(mat);
  s.scale.set(0.42, 0.158, 1);
  return s;
}

export class ScaleFigure {
  readonly group = new THREE.Group();
  private body: THREE.Mesh;
  private label: THREE.Sprite | null;
  private geo: THREE.ShapeGeometry;
  private mat: THREE.MeshBasicMaterial;
  private on = true;
  private placed = false;

  constructor(private scene: THREE.Scene) {
    this.group.name = 'scaleFigure';
    this.geo = new THREE.ShapeGeometry(figureShapes(), 6);
    this.mat = new THREE.MeshBasicMaterial({
      color: cssColor('--muted', '#7b8a99'),
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.body = new THREE.Mesh(this.geo, this.mat);
    this.body.name = 'scaleFigureBody';
    this.group.add(this.body);
    this.label = labelSprite('1,8 m', cssColor('--ink', '#e8eef4'));
    if (this.label) {
      // Başın yanında (üstünde motorun altına girip örtülürdü)
      this.label.position.set(0.42, FIGURE_HEIGHT - 0.12, 0);
      this.group.add(this.label);
    }
    // Zemindeki nesne: derinlik sınaması açık (motor önündeyse örter), kesit yok
    this.group.traverse((o) => {
      o.userData.noClip = true;
      o.userData.noAO = true;
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.group.visible = false;
    scene.add(this.group);
  }

  get visible(): boolean {
    return this.on;
  }

  /** Dünya konumu (ayak ortası) */
  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /**
   * Zemine, motor ekseninin tam altına (x = 0) ve motorun ön dörtte birine
   * yerleştirir: eksenle aynı derinlikte durduğu için yandan bakışta boyu
   * motorla birebir kıyaslanır (perspektif farkı yok) ve gövdeyi örtmez
   * (başı motorun altında kalır). Yakın açılarda zemin kadraj dışında
   * kalabilir; üç çeyrek açılarda ve geniş kadrajda görünür.
   */
  place(b: BuiltEngine, floorY: number): void {
    const bb = outlineBounds(meridionalOutline(b));
    const z0 = Number.isFinite(bb.z0) ? bb.z0 : -1;
    const z1 = Number.isFinite(bb.z1) ? bb.z1 : 1;
    this.group.position.set(0, floorY, z0 + 0.25 * (z1 - z0));
    this.placed = true;
    this.group.visible = this.on;
  }

  /** Kare başına: silüet dikey eksen etrafında kameraya döner */
  frame(camera: THREE.Camera): void {
    if (!this.group.visible) return;
    const p = this.group.position;
    this.group.rotation.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z), 0);
  }

  setVisible(v: boolean): void {
    this.on = v;
    this.group.visible = v && this.placed;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.geo.dispose();
    this.mat.dispose();
    if (this.label) {
      (this.label.material as THREE.SpriteMaterial).map?.dispose();
      this.label.material.dispose();
    }
  }
}
