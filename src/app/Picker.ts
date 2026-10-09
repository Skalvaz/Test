/**
 * 3B parça seçici: fare altındaki motor parçasını bulur, bilgi etiketi
 * gösterir ve tıklamayı bildirir. Kesit modunda kırpılmış taraftaki
 * yüzeyler atlanır (ışın izleme kırpma düzlemlerini kendisi bilmez).
 *
 * Atölye (M5a §6.7) iki kanca kullanır:
 * - `exclude(obj, part)`: true dönen isabetler atlanır, ışın arkasındaki
 *   parçaya geçer (ör. seçilemeyen stand/pilon; modülsüz parçalar).
 * - `priority(x, y)`: imleç altında öncelikli bir etkileşim (tutamaç) varsa
 *   true. O zaman parça üzerine gelme, tıklama ve çift tıklama bildirilmez;
 *   basış tutamaçta başladıysa bırakış da (sürükleme bitişi) tıklama sayılmaz.
 *   Tıklama/sürükleme ayrımı (6 px / 600 ms) aynen korunur.
 */

import * as THREE from 'three';
import type { EngineVisual, PartId } from '../engine/visual';
import { partInfo } from '../game/parts';
import { h } from '../ui/dom';

export class Picker {
  enabled = true;
  /** Ders seçme görevi sırasında etiket gösterilmesin (cevabı ele vermesin) */
  showLabels = true;
  onPick?: (part: PartId) => void;
  onHover?: (part: PartId | null) => void;
  /** Çift tıklama: tıklanan yüzey noktası (kamerayı oraya odaklamak için) */
  onFocus?: (part: PartId, point: THREE.Vector3) => void;
  private lastPoint = new THREE.Vector3();

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private tip = h('div', { class: 'part-tip hidden' });
  private hovered: PartId | null = null;
  private lastMove = 0;
  private pending: PointerEvent | null = null;
  private down = { x: 0, y: 0, t: 0 };
  /** Son basış öncelikli etkileşimde (tutamaç) başladı: bırakış tıklama değil */
  private claimed = false;
  clipPlanes: THREE.Plane[] = [];
  /** Işın izlemede atlanacak isabetler (atölye: modülsüz parçalar) */
  exclude?: (obj: THREE.Object3D, part: PartId) => boolean;
  /** İmleç altında öncelikli etkileşim (atölye tutamacı) var mı (istemci pikseli) */
  priority?: (clientX: number, clientY: number) => boolean;

  constructor(
    private dom: HTMLElement,
    private camera: THREE.Camera,
    public visual: EngineVisual,
  ) {
    document.body.append(this.tip);
    dom.addEventListener('pointermove', (e) => {
      this.pending = e;
    });
    dom.addEventListener('pointerleave', () => {
      this.pending = null;
      this.setHover(null, null);
    });
    dom.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.claimed = !!this.priority?.(e.clientX, e.clientY);
      this.tip.classList.add('hidden');
    });
    dom.addEventListener('pointerup', (e) => {
      // Sürükleme (kamera döndürme ya da tutamaç) tıklama sayılmaz
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      if (!this.enabled || this.claimed || moved > 6 || performance.now() - this.down.t > 600) return;
      const part = this.hit(e);
      if (part) this.onPick?.(part);
    });
    dom.addEventListener('dblclick', (e) => {
      if (!this.enabled || this.priority?.(e.clientX, e.clientY)) return;
      const part = this.hit(e);
      if (part) this.onFocus?.(part, this.lastPoint.clone());
    });
  }

  private hit(e: MouseEvent): PartId | null {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.visual.pickables, false);
    for (const hit of hits) {
      if (!hit.object.visible || !isVisibleInTree(hit.object)) continue;
      if (this.clipPlanes.some((p) => p.distanceToPoint(hit.point) < 0)) continue;
      const part = this.visual.partOf(hit.object);
      if (part && part !== 'wing' && !this.exclude?.(hit.object, part)) {
        this.lastPoint.copy(hit.point);
        return part;
      }
    }
    return null;
  }

  private setHover(part: PartId | null, e: PointerEvent | null) {
    if (part !== this.hovered) {
      this.hovered = part;
      this.onHover?.(part);
    }
    if (!part || !e || !this.showLabels) {
      this.tip.classList.add('hidden');
      return;
    }
    // Kart motorun türetilmiş tipinden: sunum tipi + mimariye bağlı parçalar
    const info = partInfo(part, this.visual.source.traits);
    this.tip.replaceChildren(h('b', { text: info.name }), h('p', { text: info.short }));
    this.tip.style.left = `${Math.min(e.clientX, window.innerWidth - 320)}px`;
    this.tip.style.top = `${Math.min(e.clientY, window.innerHeight - 140)}px`;
    this.tip.classList.remove('hidden');
  }

  /** Her karede çağrılır; ışın izleme ~15 Hz ile sınırlıdır. */
  update() {
    if (!this.enabled || !this.pending) return;
    const now = performance.now();
    if (now - this.lastMove < 66) return;
    this.lastMove = now;
    const e = this.pending;
    this.pending = null;
    // Basılıyken (kamera döndürme, tutamaç sürükleme) ya da tutamaç
    // üzerindeyken parça vurgulanmaz: tutamacın önceliği var
    if (e.buttons || this.priority?.(e.clientX, e.clientY)) {
      this.setHover(null, null);
      return;
    }
    this.setHover(this.hit(e), e);
  }

  hideTip() {
    this.tip.classList.add('hidden');
  }
}

function isVisibleInTree(o: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}
