/**
 * Atölyenin 3B kaplama yardımcıları (M5a P9): tutamaçlar (Handles.ts),
 * hayalet (Ghost.ts), ölçek figürü (ScaleFigure.ts) ve zarf kutusu
 * (EnvelopeBox.ts) ortak kullanır.
 *
 * Kaplamalar motorun üstüne çizilir: derinlik sınaması ve yazımı yok,
 * saydam geçişte yüksek `renderOrder` ile en son. `userData.noClip`
 * (kesit kırpması yok), GTAO ön geçişi saydam/derinliksiz nesneleri zaten
 * atlar (postfx.js). Işın seçimine (Picker.pickables) hiç girmezler.
 *
 * Meridyen düzlemi: motor ekseni +Z, akış +Z yönünde; tutamaç ve hayalet,
 * eksenden geçen ve kameraya en çok bakan düzlemde çizilir. Düzlemdeki
 * "yukarı" yarıçap yönü `u` (meridianBasis): kesit açıkken kesit
 * düzleminde (kesilen yüzün tam üstünde), kapalıyken kameranın yanal
 * doğrultusuna dik; ekranda hep yukarı bakar.
 */

import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

/** Kaplamaların çizim sırası (motor ve efektlerden sonra) */
export const OVERLAY_ORDER = 990;

const Z = new THREE.Vector3(0, 0, 1);

/** styles.css değişkeninden renk (tarayıcı dışında ya da boşsa yedek) */
export function cssColor(name: string, fallback: string): THREE.Color {
  let v = '';
  try {
    if (typeof document !== 'undefined') v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    v = '';
  }
  const c = new THREE.Color();
  try {
    c.setStyle(v || fallback);
  } catch {
    c.setStyle(fallback);
  }
  return c;
}

/** Nesneyi (ve alt ağacını) kaplama olarak işaretler */
export function markOverlay(o: THREE.Object3D, order = OVERLAY_ORDER): void {
  o.traverse((c) => {
    c.userData.noClip = true;
    c.userData.noAO = true;
    c.renderOrder = order;
    c.frustumCulled = false;
    c.castShadow = false;
    c.receiveShadow = false;
  });
}

export interface LineStyle {
  color: THREE.ColorRepresentation;
  /** Çizgi kalınlığı [CSS piksel] */
  width: number;
  opacity?: number;
  dashed?: boolean;
  /** Kesik ve boşluk boyu [dünya birimi] */
  dash?: number;
  gap?: number;
  /** true: motorun arkasında kalan kısım gizlenir (zarf kutusu); varsayılan false (kaplama) */
  depthTest?: boolean;
}

/** Ekranda sabit kalınlıklı (piksel) çizgi malzemesi (varsayılan derinliksiz kaplama) */
export function lineMaterial(s: LineStyle): LineMaterial {
  const m = new LineMaterial({
    color: s.color,
    linewidth: s.width,
    worldUnits: false,
    dashed: !!s.dashed,
    dashSize: s.dash ?? 0.05,
    gapSize: s.gap ?? 0.03,
    transparent: true,
    opacity: s.opacity ?? 1,
    depthTest: !!s.depthTest,
    depthWrite: false,
  });
  m.toneMapped = false;
  return m;
}

/** Düz dizi [x0,y0,z0, x1,y1,z1, …] çiftlerinden kalın çizgi parçaları */
export function lineSegments(positions: number[], mat: LineMaterial): LineSegments2 {
  const obj = new LineSegments2(new LineSegmentsGeometry(), mat);
  setSegments(obj, positions);
  markOverlay(obj);
  return obj;
}

/**
 * Parçaları değiştirir: yeni geometri kurulur, eskisi GPU'dan bırakılır
 * (setPositions eski tamponları atmadan yenisini bağlardı). Boş dizi
 * nesneyi gizler.
 */
export function setSegments(obj: LineSegments2, positions: number[]): void {
  const old = obj.geometry;
  const g = new LineSegmentsGeometry();
  obj.visible = positions.length >= 6;
  g.setPositions(positions.length >= 6 ? positions : [0, 0, 0, 0, 0, 0]);
  obj.geometry = g;
  if ((obj.material as LineMaterial).dashed) obj.computeLineDistances();
  old.dispose();
}

/** LineMaterial'ların piksel çözünürlüğü (her karede; pencere boyu değişebilir) */
export function syncResolution(mats: Iterable<LineMaterial>, w: number, h: number): void {
  for (const m of mats) if (m.resolution.x !== w || m.resolution.y !== h) m.resolution.set(w, h);
}

/**
 * Meridyen düzleminin "yukarı" yarıçap yönü u (XY düzleminde, birim).
 * Kesit açıkken u kesit düzlemindedir (kesit eksenden geçer); kapalıyken
 * kameradan eksene bakışa diktir (siluetin üst kenarı). Kameranın ekran
 * yukarısına bakacak biçimde yönlenir: yukarı sürüklemek yarıçapı büyütür.
 */
export function meridianBasis(camera: THREE.Camera, cut: THREE.Plane | null, out = new THREE.Vector3()): THREE.Vector3 {
  const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  if (cut && Math.abs(cut.normal.z) < 0.9) {
    // Kesit düzlemi z ekseninden geçer: normaline ve z'ye dik doğrultu
    out.crossVectors(Z, cut.normal);
  } else {
    const p = camera.position;
    const len = Math.hypot(p.x, p.y);
    if (len > 1e-3) out.set(-p.y / len, p.x / len, 0);
    else out.set(camUp.x, camUp.y, 0);
  }
  out.z = 0;
  if (out.lengthSq() < 1e-12) out.set(0, 1, 0);
  out.normalize();
  if (out.dot(camUp) < 0) out.negate();
  return out;
}

/** +Y'yi u'ya taşıyan, z ekseni etrafında dönme (yerel meridyen çerçevesi) */
export function basisQuaternion(u: THREE.Vector3, out = new THREE.Quaternion()): THREE.Quaternion {
  return out.setFromAxisAngle(Z, Math.atan2(-u.x, u.y));
}

/**
 * Bir dünya noktasında 1 ekran pikselinin dünya boyu. setViewOffset
 * (paneller için kaydırılmış/yakınlaştırılmış izdüşüm) projectionMatrix'e
 * dahildir; `viewportHeight` tuvalin CSS yüksekliği.
 */
export function worldPerPixel(camera: THREE.PerspectiveCamera, point: THREE.Vector3, viewportHeight: number): number {
  const v = point.clone().applyMatrix4(camera.matrixWorldInverse);
  const depth = Math.max(-v.z, 1e-4);
  const p5 = camera.projectionMatrix.elements[5];
  return (2 * depth) / (p5 * Math.max(viewportHeight, 1));
}

/** Dünya noktasının tuval içi CSS piksel konumu (setViewOffset dahil) ve kameranın önünde mi */
export function toScreen(
  camera: THREE.Camera,
  point: THREE.Vector3,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number; inFront: boolean } {
  const v = point.clone().applyMatrix4(camera.matrixWorldInverse);
  const p = point.clone().project(camera);
  return {
    x: rect.left + ((p.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - p.y) / 2) * rect.height,
    inFront: v.z < 0,
  };
}

/** Tuval pikselinden dünya ışını (setViewOffset dahil) */
export function rayFromScreen(
  camera: THREE.Camera,
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
  out = new THREE.Ray(),
): THREE.Ray {
  const rc = new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
  return out.copy(rc.ray);
}

/**
 * Işının bir doğruya en yakın noktasının doğru parametresi: sürükleme,
 * doğruyu içeren ve kameraya en çok bakan düzlemde yapılır (doğrunun
 * kendisi bakış doğrultusuna paralel değilse hiç bozulmaz). Döner: t
 * (nokta = origin + t·dir) ya da çözümsüzse null.
 */
export function dragAlong(ray: THREE.Ray, origin: THREE.Vector3, dir: THREE.Vector3): number | null {
  const d = dir.clone().normalize();
  // Düzlem normali: bakış doğrultusunun doğruya dik bileşeni
  const n = ray.direction.clone().addScaledVector(d, -ray.direction.dot(d));
  if (n.lengthSq() < 1e-10) return null;
  n.normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, origin);
  const hit = ray.intersectPlane(plane, new THREE.Vector3());
  if (!hit) return null;
  return hit.sub(origin).dot(d);
}
