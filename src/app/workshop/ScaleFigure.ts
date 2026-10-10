/**
 * Ölçek figürü (M5a §6.7, P9): motorun yanında duran 1,8 m'lik insan
 * silueti ve "1,8 m" etiketi. Öğrenci motorun gerçek boyunu sezsin: 66 kg/s'lik
 * turbojet bir insan boyundadır, 470 kg/s'lik turbofanın fanı iki insan
 * boyunu aşar.
 *
 * Boy karşılaştırma çizimlerindeki gibi figür motorla aynı taban
 * çizgisinde durur: motorun en alt noktası (zemin ondan en çok 0,5 m
 * aşağıdaysa zemin). Test hücresinde motor zeminden ~3 m yukarıda asılıdır;
 * zemindeki figür çoğu açıda kadrajın altında kalıyor, kalınca da motorla
 * kıyası zorlaşıyordu. Taban çizgisi ince kesikli bir çizgiyle motorun
 * altına uzanır.
 *
 * Yeri her karede kadraja göre seçilir (`chooseFigureSpot`): eksenin dikey
 * düzleminde (x = 0, yandan bakışta perspektif farkı yok) girişin önünde
 * ya da lülenin arkasında, panellerin bıraktığı görünür alana (`safeRect`)
 * tam sığan en yakın konum; motor kadrajı enine dolduruyorsa motorun önüne
 * çıkıp derinlik oranıyla küçülür (ekran boyu yine eksen düzlemindeki 1,8 m).
 * Sığan konum sürdükçe yer değişmez (yörüngede zıplamaz); hiçbiri sığmıyorsa
 * en az taşan seçilir.
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
 * Kamu API'si: `place(b, floorY)`, `frame(camera, safe?)`, `setVisible(v)`,
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

/** Etiketin yeri (yerel): başın yanında */
const LABEL_X = 0.42;
/** Kadraj sınamasında figürün yerel kutusu: omuzdan omuza ve etiket dahil [m] (etiket sağda) */
const BOX = { x0: -0.3, x1: LABEL_X + 0.23, y1: FIGURE_HEIGHT + 0.05 };

/** Etiket kadrajın ortasına bakan yanda: figür ekranın sağ yarısındaysa başın solunda */
export function labelOnLeft(camera: THREE.Camera, spot: { x: number; z: number; y?: number }, base: number, safe: NdcRect): boolean {
  const p = new THREE.Vector3(spot.x, (spot.y ?? base) + FIGURE_HEIGHT * 0.9, spot.z).project(camera);
  return p.x > (safe.x0 + safe.x1) / 2;
}
/** Motorun önüne çıkan figürün kadrajdaki en büyük boyu (güvenli alan yüksekliğine oranı) */
const FRONT_MAX_HEIGHT = 0.4;
/** Motorun önüne çıkan figürün opaklığı (arkasındaki motor, kesitte iç parçalar seçilsin) */
const FRONT_OPACITY = 0.55;
/** Figürün motoru bu orandan az örttüğü yer "açık" sayılır (engineCover) */
const CLEAR_COVER = 0.1;
/** Örten yerde kalma payı: daha az örten aday bu kadar iyi değilse yer değişmez */
const COVER_HYSTERESIS = 0.15;
/** Motorun altındaki figürün başı ile taban çizgisi arası [m] */
const UNDER_CLEARANCE = 0.15;
/** Zemin motorun altından en çok bu kadar aşağıdaysa figür zeminde durur [m] */
const FLOOR_SNAP = 0.5;

/** Motorun boy karşılaştırması için ölçüleri (meridyen sınırları) */
export interface FigureEngine {
  z0: number;
  z1: number;
  /** En büyük yarıçap [m] */
  r: number;
  /** Zemin yüksekliği [m]; motorun altından uzaksa figür zemine de inebilir */
  floor?: number;
}

/** Figürün taban çizgisi (ayak yüksekliği): motorun en altı ya da yakınsa zemin */
export function figureBaseline(e: FigureEngine, floorY: number): number {
  const bottom = -e.r;
  return Number.isFinite(floorY) && bottom - floorY <= FLOOR_SNAP ? floorY : bottom;
}

/** Ekran dikdörtgeni, NDC'de (−1..1; y yukarı) */
export interface NdcRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Panellerin bıraktığı görünür alanın kestirimi (NDC). CameraRig
 * setViewOffset ile tam görüntüyü boş alanın ortasına k kat küçültüp koyar;
 * k² = tuval alanı / boş alan. Paneller yanlarda olduğundan boş alanın
 * yüksekliği ≈ tuvalinki, genişliği ≈ w/k². Üstte araç çubuğu, altta kenar
 * için pay bırakılır. Kaydırma yoksa tuvalin tamamı (paylarla).
 */
export function safeRect(camera: THREE.PerspectiveCamera): NdcRect {
  const v = camera.view;
  const top = 0.86;
  const bottom = -0.9;
  if (!v || !v.enabled || v.fullWidth <= 0 || v.width <= 0) return { x0: -0.92, x1: 0.92, y0: bottom, y1: top };
  const k = v.width / v.fullWidth;
  const w = v.fullWidth;
  // Boş alanın merkezi (tuval pikseli) ve yarı genişliği
  const cx = (w / 2 - v.offsetX) / k;
  const half = (0.92 * w) / (2 * k * k);
  const toNdc = (x: number) => (2 * x) / w - 1;
  return { x0: toNdc(cx - half), x1: toNdc(cx + half), y0: bottom, y1: top };
}

/**
 * Figürün yeri: x yanal kayma (0: eksenin dikey düzleminde), z eksenel
 * konum, `scale` ölçek. Motorun önüne (kameraya doğru) kaydırılan figür
 * derinlik oranıyla küçültülür: ekranda eksen düzlemindeki 1,8 m'lik bir
 * insanla aynı boyda görünür, kıyas bozulmaz.
 */
export interface FigureSpot {
  x: number;
  z: number;
  scale: number;
  /** Ayak yüksekliği [m]: yalnız zemindeki adayda; yoksa taban çizgisi */
  y?: number;
}

/** Kameradan bakış derinliği (görüş uzayında −z) */
function depthOf(camera: THREE.Camera, x: number, y: number, z: number): number {
  return -new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse).z;
}

/** Figürün kameraya dönük kutusunun NDC sınırları; kameranın arkasındaysa null */
export function figureNdcBox(camera: THREE.Camera, spot: FigureSpot, base: number, left = false): NdcRect | null {
  const yaw = Math.atan2(camera.position.x - spot.x, camera.position.z - spot.z);
  const c = Math.cos(yaw) * spot.scale;
  const s = Math.sin(yaw) * spot.scale;
  const view = new THREE.Vector3();
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const feet = spot.y ?? base;
  for (const lx of left ? [-BOX.x1, -BOX.x0] : [BOX.x0, BOX.x1]) {
    for (const ly of [0, BOX.y1]) {
      // Yerel x ekseni dikey eksen etrafında yaw kadar dönük
      const p = new THREE.Vector3(spot.x + lx * c, feet + ly * spot.scale, spot.z - lx * s);
      view.copy(p).applyMatrix4(camera.matrixWorldInverse);
      if (view.z >= -1e-3) return null;
      p.project(camera);
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
  }
  return { x0, x1, y0, y1 };
}

/** Kutunun güvenli alandan taşması (NDC; 0: tamamen içinde) */
function overflow(b: NdcRect | null, s: NdcRect): number {
  if (!b) return Infinity;
  return Math.max(0, s.x0 - b.x0) + Math.max(0, b.x1 - s.x1) + Math.max(0, s.y0 - b.y0) + Math.max(0, b.y1 - s.y1);
}

/** Yanal kaymalı (ya da zemindeki) yerin ölçeği: eksen düzlemindeki figürle aynı ekran boyu */
function frontSpot(camera: THREE.Camera, x: number, z: number, base: number, y?: number): FigureSpot {
  const mid = (y ?? base) + FIGURE_HEIGHT / 2;
  const d0 = depthOf(camera, 0, mid, z);
  const d1 = depthOf(camera, x, mid, z);
  const scale = d0 > 1e-3 && d1 > 1e-3 ? d1 / d0 : 1;
  return y === undefined ? { x, z, scale } : { x, z, scale, y };
}

/** Kameradan geçen ışın (o + t·d, t > 0) motorun sınır silindirine değiyor mu (eksen z, yarıçap r) */
function rayHitsEngine(o: THREE.Vector3, dx: number, dy: number, dz: number, e: FigureEngine): boolean {
  let lo = 1e-6;
  let hi = Infinity;
  if (Math.abs(dz) < 1e-9) {
    if (o.z < e.z0 || o.z > e.z1) return false;
  } else {
    const a = (e.z0 - o.z) / dz;
    const b = (e.z1 - o.z) / dz;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
    if (lo > hi) return false;
  }
  const A = dx * dx + dy * dy;
  const B = 2 * (o.x * dx + o.y * dy);
  const C = o.x * o.x + o.y * o.y - e.r * e.r;
  if (A < 1e-12) return C <= 0;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return false;
  const q = Math.sqrt(disc);
  return Math.max(lo, (-B - q) / (2 * A)) <= Math.min(hi, (-B + q) / (2 * A));
}

/** Örtme sınaması için silüet noktaları (yerel x, y) [m]: bacaklar, gövde, omuzlar, baş */
const COVER_SAMPLES: [number, number][] = [];
for (const ly of [0.15, 0.55, 0.95, 1.35]) for (const lx of [-0.17, 0, 0.17]) COVER_SAMPLES.push([lx, ly]);
COVER_SAMPLES.push([0, 1.69]);

/**
 * Figürün ekranda motorla çakışan oranı (0..1): silüet noktalarından
 * kameraya giden ışınlardan motorun sınır silindirine değenlerin payı.
 * Motor figürün önünde de arkasında da olsa çakışma sayılır: figür motoru
 * (ve üstündeki tutamaçları) örter ya da motorun arkasında kaybolur.
 */
export function engineCover(camera: THREE.Camera, e: FigureEngine, spot: FigureSpot, base: number): number {
  const yaw = Math.atan2(camera.position.x - spot.x, camera.position.z - spot.z);
  const c = Math.cos(yaw) * spot.scale;
  const s = Math.sin(yaw) * spot.scale;
  const o = camera.position;
  const feet = spot.y ?? base;
  let hits = 0;
  for (const [lx, ly] of COVER_SAMPLES) {
    const px = spot.x + lx * c;
    const py = feet + ly * spot.scale;
    const pz = spot.z - lx * s;
    if (rayHitsEngine(o, px - o.x, py - o.y, pz - o.z, e)) hits++;
  }
  return hits / COVER_SAMPLES.length;
}

/**
 * Figürün yeri, öncelik sırasıyla:
 * 1. Eksen düzleminde girişin önü ya da lülenin arkası (aralık, ¾ açıda
 *    giriş elipsinin üstüne binmesin diye yarıçapla büyür), taban çizgisinde:
 *    güvenli alana tam sığan en yakın aday.
 * 2. Motoru örtmeyen (`engineCover` ≤ %10) bir yer: önce taban çizgisinde
 *    motorun önü (kameraya doğru) boyunca, sonra zemin (motorun altından
 *    uzaksa: eksen düzleminde motorun altı ya da önü). Öne kayan figür
 *    derinlik oranıyla küçülür (ekran boyu eksen düzlemindeki 1,8 m);
 *    taban çizgisindekiler yalnız kadrajda küçükken (`FRONT_MAX_HEIGHT`).
 * 3. Hiçbiri yoksa motorun önünde, kadrajda küçük ve motoru EN AZ örten yer
 *    (yarı saydam çizilir; DOM tutamaçları önde kalır).
 * Hiçbiri tam sığmazsa en az taşan. `current` hâlâ sığıyor ve sınıfı
 * geçerliyse o kalır (ölçeği kameraya göre yenilenir): yörüngede zıplamaz.
 * Yakın çekimde (kesit — çekirdek) figür kısmen kadraj dışında kalabilir:
 * motorun içini örtmesin.
 */
export function chooseFigureSpot(
  camera: THREE.PerspectiveCamera,
  e: FigureEngine,
  base: number,
  current?: FigureSpot | null,
  safe = safeRect(camera),
): FigureSpot {
  const box = (s: FigureSpot) => figureNdcBox(camera, s, base, labelOnLeft(camera, s, base, safe));
  const fits = (s: FigureSpot) => overflow(box(s), safe) === 0;
  const maxH = FRONT_MAX_HEIGHT * (safe.y1 - safe.y0);
  const small = (s: FigureSpot) => {
    const b = box(s);
    return !!b && b.y1 - b.y0 <= maxH;
  };
  const cover = (s: FigureSpot) => engineCover(camera, e, s, base);
  const side = camera.position.x < 0 ? -1 : 1;
  const xFront = side * (Math.max(e.r, 0) + 0.45);
  const floor = e.floor !== undefined && Number.isFinite(e.floor) && e.floor < base - 0.3 ? e.floor : undefined;
  // Motorun hemen altı: baş taban çizgisinin biraz altında (zemin görünmüyorsa)
  const under = base - FIGURE_HEIGHT - UNDER_CLEARANCE;
  // Önde aralık yarıçapla büyür (¾ açıda giriş elipsi); arkada lüle dar, az pay yeter
  const gap = 0.6 + 0.6 * Math.max(e.r, 0);
  const gapRear = 0.5 + 0.25 * Math.max(e.r, 0);

  // Önceki yer, ölçeği bu kameraya göre (kamera öbür yana geçtiyse ön yer de geçer)
  let cur: FigureSpot | null = null;
  if (current) {
    const lifted = current.y !== undefined;
    if (current.x === 0 && !lifted) cur = current;
    else if (!lifted || current.y === floor || current.y === under)
      cur = frontSpot(camera, current.x === 0 ? 0 : xFront, current.z, base, current.y);
    if (cur && !fits(cur)) cur = null;
    if (cur) {
      // Eksen düzlemi ya da motoru örtmeyen yer: kalır
      if (cur.x === 0 && !lifted) return cur;
      if (cover(cur) <= CLEAR_COVER && (lifted || small(cur))) return cur;
    }
  }

  let best: FigureSpot = { x: 0, z: e.z0 - gap, scale: 1 };
  let bestOver = Infinity;
  /** En az taşan adayı izler; true: tam sığıyor */
  const consider = (s: FigureSpot, b = box(s)) => {
    const o = overflow(b, safe);
    if (o < bestOver) {
      bestOver = o;
      best = s;
    }
    return o === 0;
  };
  // 1. Eksen düzlemi, taban çizgisi
  for (let i = 0; i < 16; i++) {
    for (const z of [e.z0 - gap - 0.4 * i, e.z1 + gapRear + 0.4 * i]) {
      const s = { x: 0, z, scale: 1 };
      if (consider(s)) return s;
    }
  }
  // 2. Motoru örtmeyen yer: taban çizgisinde önde, sonra zeminde, sonra
  // motorun hemen altında (eksen düzleminde: derinlik aynı, kıyas birebir)
  const zs: number[] = [];
  for (let z = e.z0 - gap; z <= e.z1 + gapRear + 1e-9; z += 0.5) zs.push(z);
  for (const z of zs) {
    const s = frontSpot(camera, xFront, z, base);
    if (small(s) && fits(s) && cover(s) <= CLEAR_COVER) return s;
  }
  for (const y of floor !== undefined && floor < under ? [floor, under] : [under]) {
    for (const x of [0, xFront]) {
      for (const z of zs) {
        const s = frontSpot(camera, x, z, base, y);
        if (fits(s) && cover(s) <= CLEAR_COVER) return s;
      }
    }
  }
  // 3. Motorun önünde, kadrajda küçük ve en az örten. Tam sığan yoksa en az
  // taşan (biraz taşan bir ön aday, panelin altında kalan eksen adayından iyidir)
  let pick: FigureSpot | null = null;
  let pickCover = Infinity;
  for (let z = e.z0 + 0.4; z <= e.z1 - 0.4; z += 0.5) {
    const s = frontSpot(camera, xFront, z, base);
    const b = box(s);
    if (!b || b.y1 - b.y0 > maxH) continue;
    if (!consider(s, b)) continue;
    const c = cover(s);
    if (c < pickCover - 1e-9) {
      pickCover = c;
      pick = s;
    }
  }
  if (pick) {
    // Örten yerde de zıplamasın: belirgin biçimde daha az örten aday yoksa kalır
    if (cur && cur.x !== 0 && cur.y === undefined && small(cur) && cover(cur) <= pickCover + COVER_HYSTERESIS) return cur;
    return pick;
  }
  return best;
}

export class ScaleFigure {
  readonly group = new THREE.Group();
  private body: THREE.Mesh;
  private label: THREE.Sprite | null;
  private geo: THREE.ShapeGeometry;
  private mat: THREE.MeshBasicMaterial;
  /** Silüet çevre çizgisi: beyaz kaporta ve koyu kesit önünde de seçilsin */
  private edgeMat: THREE.LineBasicMaterial;
  private edgeGeos: THREE.BufferGeometry[] = [];
  private muted = new THREE.Color();
  private dark = new THREE.Color(0x2a333d);
  /** Taban çizgisi: figürün ayağından motorun altı boyunca (kesikli) */
  private baseLine: THREE.Line;
  private on = true;
  private placed = false;
  private eng: FigureEngine = { z0: -1, z1: 1, r: 0.5 };
  private base = 0;
  private spot: FigureSpot | null = null;

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
    this.muted.copy(this.mat.color);
    this.body = new THREE.Mesh(this.geo, this.mat);
    this.edgeMat = new THREE.LineBasicMaterial({ color: cssColor('--ink', '#e8eef4'), transparent: true, opacity: 0.85, depthWrite: false });
    this.edgeMat.toneMapped = false;
    for (const sh of figureShapes()) {
      const g = new THREE.BufferGeometry().setFromPoints(sh.getPoints(12).map((v) => new THREE.Vector3(v.x, v.y, 0.002)));
      this.edgeGeos.push(g);
      const edge = new THREE.LineLoop(g, this.edgeMat);
      edge.raycast = () => {};
      this.group.add(edge);
    }
    this.body.name = 'scaleFigureBody';
    this.group.add(this.body);
    this.label = labelSprite('1,8 m', cssColor('--ink', '#e8eef4'));
    if (this.label) {
      // Başın yanında (üstünde motorun altına girip örtülürdü)
      this.label.position.set(LABEL_X, FIGURE_HEIGHT - 0.12, 0);
      this.group.add(this.label);
    }
    const lineMat = new THREE.LineDashedMaterial({
      color: cssColor('--muted', '#7b8a99'),
      transparent: true,
      opacity: 0.55,
      dashSize: 0.12,
      gapSize: 0.08,
      depthWrite: false,
    });
    lineMat.toneMapped = false;
    this.baseLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), lineMat);
    this.baseLine.name = 'scaleFigureBaseline';
    this.baseLine.raycast = () => {};
    // Sahnedeki nesne: derinlik sınaması açık (motor önündeyse örter), kesit yok
    for (const root of [this.group, this.baseLine]) {
      root.traverse((o) => {
        o.userData.noClip = true;
        o.userData.noAO = true;
        o.castShadow = false;
        o.receiveShadow = false;
      });
      root.visible = false;
      scene.add(root);
    }
  }

  get visible(): boolean {
    return this.on;
  }

  /** Dünya konumu (ayak ortası) */
  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /**
   * Motor ölçülerini alır: taban çizgisi motorun en altı (zemin yakınsa
   * zemin); z her karede kadraja göre seçilir (`frame`). İlk yer, bir kare
   * gelmeden de anlamlı olsun diye girişin önü.
   */
  place(b: BuiltEngine, floorY: number): void {
    const bb = outlineBounds(meridionalOutline(b));
    this.eng = {
      z0: Number.isFinite(bb.z0) ? bb.z0 : -1,
      z1: Number.isFinite(bb.z1) ? bb.z1 : 1,
      r: Number.isFinite(bb.r) && bb.r > 0 ? bb.r : 0.5,
      floor: floorY,
    };
    this.base = figureBaseline(this.eng, floorY);
    this.spot = null;
    this.moveTo({ x: 0, z: this.eng.z0 - (0.6 + 0.6 * this.eng.r), scale: 1 });
    this.placed = true;
    this.group.visible = this.baseLine.visible = this.on;
  }

  private moveTo(s: FigureSpot): void {
    const y = s.y ?? this.base;
    this.group.position.set(s.x, y, s.z);
    this.group.scale.setScalar(s.scale);
    // Taban çizgisi: figürden motorun öbür ucuna (motorun altı boyunca)
    const { z0, z1 } = this.eng;
    const a = s.z < z0 ? s.z : z0;
    const b = s.z > z1 ? s.z : z1;
    const pos = this.baseLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, s.x, y, a);
    pos.setXYZ(1, s.x, y, b);
    pos.needsUpdate = true;
    this.baseLine.geometry.computeBoundingSphere();
    this.baseLine.computeLineDistances();
  }

  /** Seçili yer (test kancası) */
  get spotNow(): Readonly<FigureSpot> | null {
    return this.spot;
  }

  /**
   * Kare başına: yer kadraja göre (`safe` verilmezse kameranın setViewOffset
   * kaydırmasından kestirilen boş alan), silüet dikey eksen etrafında kameraya döner.
   */
  frame(camera: THREE.Camera, safe?: NdcRect): void {
    if (!this.group.visible) return;
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const cam = camera as THREE.PerspectiveCamera;
      cam.updateMatrixWorld();
      const sr = safe ?? safeRect(cam);
      const s = chooseFigureSpot(cam, this.eng, this.base, this.spot, sr);
      const p = this.spot;
      if (!p || p.x !== s.x || p.z !== s.z || Math.abs(p.scale - s.scale) > 1e-4) {
        this.spot = s;
        this.moveTo(s);
      }
      // Etiket kadrajın ortasına bakan yanda (panelin altında kalmasın)
      if (this.label) this.label.position.x = labelOnLeft(cam, s, this.base, sr) ? -LABEL_X : LABEL_X;
      // Motoru örten figür daha saydam ve koyu (kesitte iç, beyaz kaportada
      // silüet seçilsin; çevre çizgisi açık renkte)
      const over = engineCover(cam, this.eng, s, this.base) > CLEAR_COVER;
      this.mat.opacity = over ? FRONT_OPACITY : 0.82;
      this.mat.color.copy(over ? this.dark : this.muted);
    }
    const p = this.group.position;
    this.group.rotation.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z), 0);
  }

  setVisible(v: boolean): void {
    this.on = v;
    this.group.visible = this.baseLine.visible = v && this.placed;
  }

  dispose(): void {
    this.scene.remove(this.group, this.baseLine);
    this.geo.dispose();
    this.mat.dispose();
    this.edgeMat.dispose();
    for (const g of this.edgeGeos) g.dispose();
    this.baseLine.geometry.dispose();
    (this.baseLine.material as THREE.Material).dispose();
    if (this.label) {
      (this.label.material as THREE.SpriteMaterial).map?.dispose();
      this.label.material.dispose();
    }
  }
}
