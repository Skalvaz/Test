/**
 * Hedef zarf kutusu (M5a §2.13, §6.7, P9): görev kartının çap ve boy
 * sınırı (`DesignGoal.require.diameterMax / lengthMax`) motorun çevresinde
 * tel kafes kutu olarak çizilir. Sprocket'teki "gövdeye sığ" kısıtının
 * tohumu (Faz 4'te gövde yuvası olur).
 *
 * Kutu giriş ağzından başlar (motorun en önü), kesiti çap × çap karedir.
 * Motor sığıyorsa kenarlar `--green`, taşıyorsa `--red`; yalnız bir sınır
 * verilmişse öteki boyut motorun kendi ölçüsüdür ve o kenarlar sönük çizilir.
 * Sınırı aşan yönde motorun ucu kısa kırmızı işaretle gösterilir.
 *
 * Kenarlar iki kez çizilir: görünen kısım derinlik sınamalı ve belirgin,
 * motorun arkasında/içinde kalan kısım sönük kesikli (röntgen): kutunun
 * önü/arkası okunur, motordan küçük kutu da kaybolmaz. Kesitte kırpılmaz.
 *
 * ## Kurulum ve kullanım (P10)
 *
 * ```ts
 * const box = new EnvelopeBox(this.scene);
 * // görev ya da tasarım değişince (store aboneliği / onBuilt):
 * box.set(store.state.project.goal?.require ?? null, store.state.last.built);
 * // her kare (çizgi kalınlığı tuval boyuna bağlı):
 * box.frame(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
 * // çıkışta: box.dispose();
 * ```
 *
 * Kamu API'si: `set(req, built)`, `fits` (son durum: sığıyor mu, null =
 * görev yok), `frame(w, h)`, `dispose()`.
 */

import * as THREE from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import type { BuiltEngine } from '../../design/graph';
import { meridionalOutline, outlineBounds } from '../../design/outline';
import { cssColor, lineMaterial, lineSegments, setSegments, syncResolution } from './overlay3d';

export interface EnvelopeReq {
  diameterMax?: number;
  lengthMax?: number;
}

export interface EnvelopeState {
  /** Kutu: z aralığı ve kare kesitin yarı kenarı */
  z0: number;
  z1: number;
  half: number;
  /** Motorun ölçüleri (siluetten) */
  length: number;
  diameter: number;
  fitsDiameter: boolean;
  fitsLength: boolean;
}

/** Görev sınırı ve motor ölçülerinden kutu (sınırı olmayan boyut motorunki) */
export function envelopeOf(req: EnvelopeReq, b: BuiltEngine): EnvelopeState {
  const bb = outlineBounds(meridionalOutline(b));
  const length = bb.z1 - bb.z0;
  const diameter = 2 * bb.r;
  const D = req.diameterMax ?? diameter;
  const L = req.lengthMax ?? length;
  return {
    z0: bb.z0,
    z1: bb.z0 + L,
    half: D / 2,
    length,
    diameter,
    fitsDiameter: req.diameterMax === undefined || diameter <= req.diameterMax + 1e-9,
    fitsLength: req.lengthMax === undefined || length <= req.lengthMax + 1e-9,
  };
}

/** Kutunun 12 kenarı: [boyuna 4 kenar, ön kare, arka kare] (dizi çiftleri) */
export function boxEdges(e: Pick<EnvelopeState, 'z0' | 'z1' | 'half'>): { long: number[]; ends: number[] } {
  const s = e.half;
  const corners: [number, number][] = [
    [s, s],
    [-s, s],
    [-s, -s],
    [s, -s],
  ];
  const long: number[] = [];
  const ends: number[] = [];
  corners.forEach(([x, y], i) => {
    const [x2, y2] = corners[(i + 1) % 4];
    long.push(x, y, e.z0, x, y, e.z1);
    ends.push(x, y, e.z0, x2, y2, e.z0, x, y, e.z1, x2, y2, e.z1);
  });
  return { long, ends };
}

export class EnvelopeBox {
  readonly group = new THREE.Group();
  /** Son durum (null: görev sınırı yok, kutu gizli) */
  state: EnvelopeState | null = null;
  private long: LineSegments2;
  private ends: LineSegments2;
  private hidden: LineSegments2;
  private over: LineSegments2;
  private mats: LineMaterial[];
  private green = cssColor('--green', '#3ddc84');
  private red = cssColor('--red', '#ff4d3d');

  constructor(private scene: THREE.Scene) {
    this.group.name = 'envelopeBox';
    const longMat = lineMaterial({ color: this.green, width: 2, opacity: 0.85, depthTest: true, dashed: true, dash: 0.12, gap: 0.08 });
    const endMat = lineMaterial({ color: this.green, width: 2, opacity: 0.85, depthTest: true });
    const hiddenMat = lineMaterial({ color: this.green, width: 1.5, opacity: 0.3, dashed: true, dash: 0.05, gap: 0.05 });
    const overMat = lineMaterial({ color: this.red, width: 3, opacity: 0.95 });
    this.mats = [longMat, endMat, hiddenMat, overMat];
    this.long = lineSegments([], longMat);
    this.ends = lineSegments([], endMat);
    this.hidden = lineSegments([], hiddenMat);
    this.over = lineSegments([], overMat);
    // Derinlik sınamalı kenarlar motorla birlikte; röntgen ve taşma işareti üstte
    this.long.renderOrder = this.ends.renderOrder = 10;
    this.group.add(this.hidden, this.long, this.ends, this.over);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Sığıyor mu (null: görev sınırı yok) */
  get fits(): boolean | null {
    return this.state ? this.state.fitsDiameter && this.state.fitsLength : null;
  }

  /** Görev sınırı (null ya da boş: kutu gizlenir) ve motor */
  set(req: EnvelopeReq | null | undefined, b: BuiltEngine | null | undefined): void {
    if (!req || !b || (req.diameterMax === undefined && req.lengthMax === undefined)) {
      this.state = null;
      this.group.visible = false;
      return;
    }
    const e = envelopeOf(req, b);
    this.state = e;
    const ok = e.fitsDiameter && e.fitsLength;
    const col = ok ? this.green : this.red;
    for (const m of this.mats.slice(0, 3)) m.color.copy(col);
    // Sınırı olmayan boyutun kenarları sönük
    this.mats[0].opacity = req.lengthMax === undefined ? 0.35 : 0.85;
    this.mats[1].opacity = req.diameterMax === undefined ? 0.35 : 0.85;
    const { long, ends } = boxEdges(e);
    const dash = Math.max(e.z1 - e.z0, 0.5);
    this.mats[0].dashSize = 0.03 * dash;
    this.mats[0].gapSize = 0.02 * dash;
    this.mats[2].dashSize = this.mats[2].gapSize = 0.012 * dash;
    setSegments(this.long, long);
    setSegments(this.ends, ends);
    setSegments(this.hidden, [...long, ...ends]);
    // Taşma işaretleri: boyda motor ucundan kutu sonuna, çapta motor yarıçapında dikey çizgi
    const over: number[] = [];
    if (!e.fitsLength) over.push(0, 0, e.z1, 0, 0, e.z0 + e.length);
    if (!e.fitsDiameter) {
      const r = e.diameter / 2;
      const z = (e.z0 + Math.min(e.z1, e.z0 + e.length)) / 2;
      over.push(0, e.half, z, 0, r, z, 0, -e.half, z, 0, -r, z);
    }
    setSegments(this.over, over);
    this.group.visible = true;
  }

  /** Kare başına: çizgi kalınlığının piksel çözünürlüğü */
  frame(width: number, height: number): void {
    if (this.group.visible) syncResolution(this.mats, width, height);
  }

  dispose(): void {
    this.scene.remove(this.group);
    for (const o of [this.long, this.ends, this.hidden, this.over]) o.geometry.dispose();
    for (const m of this.mats) m.dispose();
  }
}
