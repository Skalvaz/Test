/**
 * Hayalet meridyen (M5a §6.7, P9): sürüklerken (tutamaç ya da kaydırıcı)
 * motorun yarı kesit çizgileri. Başlangıç şekli gri ve sabit, yeni şekil
 * `--accent` kesikli; ikisi de meridyen düzleminde, eksenin iki yanında
 * (±u) çizilir. Taslak 3B model kısmayla gecikse de hayalet her
 * değerlendirmede (< 0,5 ms, design/outline.ts) güncel şekli gösterir.
 *
 * ## Kurulum ve kullanım (P10)
 *
 * ```ts
 * const ghost = new DesignGhost(this.scene);
 * // Tutamaçlar: WorkshopHandles'a { ghost } verilir; begin/update/end ve
 * // setBasis'i tutamaçlar çağırır.
 * // Kaydırıcı (KnobField) sürüklemesi: input başında
 * ghost.begin(store.state.last.built);
 * // her input'tan sonra (mağaza aboneliğinde)
 * ghost.update(store.state.last.built);
 * // change'de
 * ghost.end();
 * // tutamaçsız kullanımda kare başına meridyen yönü:
 * ghost.setBasis(meridianBasis(camera, cutPlane));   // overlay3d.ts
 * ```
 *
 * Kamu API'si: `begin(b)`, `update(b)`, `end()`, `setBasis(u)`,
 * `active` (çiziliyor mu), `dispose()`. Hiçbiri sahneyi ya da mağazayı
 * değiştirmez; yalnız kendi grubunu (`group`, sahneye eklenir).
 */

import * as THREE from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import type { BuiltEngine } from '../../design/graph';
import { meridionalOutline, outlineBounds, type OutlinePoint } from '../../design/outline';
import { basisQuaternion, cssColor, lineMaterial, lineSegments, markOverlay, setSegments, syncResolution } from './overlay3d';

/** Siluet çizgilerini ±u (yerel ±Y) parçalarına çevirir: [x,y,z, x,y,z, …] */
export function outlineSegments(lines: OutlinePoint[][]): number[] {
  const out: number[] = [];
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1];
      const b = l[i];
      out.push(0, a.r, a.z, 0, b.r, b.z);
      out.push(0, -a.r, a.z, 0, -b.r, b.z);
    }
  }
  return out;
}

export class DesignGhost {
  readonly group = new THREE.Group();
  private start: LineSegments2;
  private next: LineSegments2;
  private mats: LineMaterial[];
  private q = new THREE.Quaternion();
  private startRev: string | null = null;
  private nextRev: string | null = null;
  private resW = 0;
  private resH = 0;

  constructor(private scene: THREE.Scene) {
    this.group.name = 'workshopGhost';
    // Başlangıç: koyu sabit çizgi (gümüş gövdede ve açık hücre duvarında okunur);
    // yeni şekil: kesikli vurgu rengi
    const startMat = lineMaterial({ color: cssColor('--panel-solid', '#0c1118'), width: 2, opacity: 0.7 });
    const nextMat = lineMaterial({ color: cssColor('--accent', '#2ee6d6'), width: 2.5, dashed: true, dash: 0.06, gap: 0.04 });
    this.mats = [startMat, nextMat];
    this.start = lineSegments([], startMat);
    this.next = lineSegments([], nextMat);
    this.group.add(this.start, this.next);
    markOverlay(this.group);
    // Yeni şekil başlangıcın üstünde
    this.next.renderOrder = 992;
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Çiziliyor mu (begin ile end arası) */
  get active(): boolean {
    return this.group.visible;
  }

  /** Sürüklemenin başı: başlangıç şekli sabitlenir */
  begin(b: BuiltEngine): void {
    this.scaleDashes(b);
    if (this.startRev !== b.rev) {
      setSegments(this.start, outlineSegments(meridionalOutline(b)));
      this.startRev = b.rev;
    }
    setSegments(this.next, []);
    this.nextRev = null;
    this.group.visible = true;
  }

  /** Yeni şekil (her değerlendirmede); begin olmadan çağrılırsa yok sayılır */
  update(b: BuiltEngine): void {
    if (!this.group.visible || this.nextRev === b.rev) return;
    // Başlangıçla aynı tasarım: yalnız gri şekil
    setSegments(this.next, b.rev === this.startRev ? [] : outlineSegments(meridionalOutline(b)));
    this.nextRev = b.rev;
  }

  /** Sürükleme bitti: hayalet kalkar (3B model yeni şekli gösterir) */
  end(): void {
    this.group.visible = false;
  }

  /**
   * Meridyen düzleminin yukarı yönü (overlay3d.meridianBasis); tutamaçlar
   * her karede verir. Çizgi kalınlığı için tuval boyu da güncellenir.
   */
  setBasis(u: THREE.Vector3, viewport?: { width: number; height: number }): void {
    this.group.quaternion.copy(basisQuaternion(u, this.q));
    const w = viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1);
    const hh = viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 1);
    if (w !== this.resW || hh !== this.resH) {
      syncResolution(this.mats, w, hh);
      this.resW = w;
      this.resH = hh;
    }
  }

  /** Kesik boyu motor boyuna oranlı (küçük turboşaftta da, büyük turbofanda da okunur) */
  private scaleDashes(b: BuiltEngine): void {
    const bb = outlineBounds(meridionalOutline(b));
    const L = Math.max(bb.z1 - bb.z0, 0.5);
    const m = this.mats[1];
    m.dashSize = 0.012 * L;
    m.gapSize = 0.008 * L;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.start.geometry.dispose();
    this.next.geometry.dispose();
    for (const m of this.mats) m.dispose();
  }
}
