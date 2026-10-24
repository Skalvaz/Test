/**
 * Çekimler (Dalga 0'da CameraRig'den ayrıldı): hazır açılar, motor tipine
 * ve tasarım boyutuna göre açı takımları, kapalı alana sığdırma ve açılar
 * arası yumuşak geçiş. Sahibi: Dalga 2'de 2F (vitrin çekimleri, soğuk açılış
 * yolu), Dalga 4'te 4B (V4 kamera uçuşu).
 *
 * Kayıt sahneleri ve dersler elle ayarlı açılara (VIEWS, KIND_VIEWS)
 * dayanır: değerleri değiştiren paket vitrin setini yeniden kaydeder.
 */

import * as THREE from 'three';
import type { VisualSource } from '../../engine/models';
import type { EngineKind } from '../../sim';

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
  // Turboşaft: elle ayarlı açı yok; viewsFor yerleşimden çerçeveler
  // (frameDesign). Bu satır yalnız doğrudan okuyanlar için geri düşüş
  turboshaft: BARE,
};

/** Açıları elle ayarlanmış sunum tipleri (kayıt sahneleri bunlara dayanır) */
const TUNED: ReadonlySet<EngineKind> = new Set<EngineKind>(['turbofan', 'militaryTurbofan', 'turbojet', 'turboprop']);

/** Motorun kamera çerçevesi: boy, en büyük çap ve eksenel orta nokta [m] */
export interface DesignFrame {
  length: number;
  diameter: number;
  zMid: number;
}

/**
 * Yerleşimden çerçeve: dış zarfın (`outerProfile`) eksenel uçları ve en
 * büyük yarıçapı; pervaneli motorda pervane çapı da (metrics.diameter).
 * Zarf yoksa giriş ve çıkış ağızları.
 */
export function frameOf(src: Pick<VisualSource, 'layout' | 'built'>): DesignFrame {
  const L = src.layout;
  const prof = L.outerProfile ?? [];
  let z0 = L.intake.z;
  let z1 = L.exhaustExit.z;
  let r = Math.max(L.intake.radius, L.exhaustExit.radius);
  if (prof.length >= 2) {
    z0 = Math.min(z0, prof[0][0]);
    z1 = Math.max(z1, prof[prof.length - 1][0]);
    for (const [, pr] of prof) r = Math.max(r, pr);
  }
  const diameter = Math.max(2 * r, src.built.flowpath.metrics.diameter);
  return { length: Math.max(z1 - z0, 0.1), diameter, zMid: (z0 + z1) / 2 };
}

/** Çerçeveye sığdırma uzaklığının ölçüsü (§6.7): boy ya da çap baskın */
const frameSize = (m: DesignFrame) => Math.max(m.length * 0.62, m.diameter * 1.35);

export type ViewSet = Partial<Record<ViewName, CameraView>>;

/**
 * Açı takımını bir motordan ötekine taşır: hedefler eksenel orta noktaya
 * göre, kamera hedefe göre çerçeve ölçüsü oranında ölçeklenir (bakış yönü
 * ve görüş açısı korunur). Verilmeyen açılar VIEWS'ten alınıp taşınır.
 */
export function scaleViews(views: ViewSet, from: DesignFrame, to: DesignFrame): ViewSet {
  const k = frameSize(to) / frameSize(from);
  const out: ViewSet = {};
  for (const name of Object.keys(VIEWS) as ViewName[]) {
    if (name === 'menu') continue;
    const v: CameraView = views[name] ?? VIEWS[name];
    const t: [number, number, number] = [v.target[0] * k, v.target[1] * k, to.zMid + (v.target[2] - from.zMid) * k];
    const p: [number, number, number] = [
      t[0] + (v.position[0] - v.target[0]) * k,
      t[1] + (v.position[1] - v.target[1]) * k,
      t[2] + (v.position[2] - v.target[2]) * k,
    ];
    out[name] = { ...v, position: p, target: t };
  }
  return out;
}

/** BARE açılarının ayarlandığı motorun (TJ şablonu) çerçevesi */
const BARE_FRAME: DesignFrame = { length: 5.549, diameter: 1.56, zMid: 0.1245 };

/**
 * Elle ayarlı açısı olmayan motor için çerçeve (turboşaft; atölyede yeni
 * sunum tipi). Kaportasız turbojet açıları (BARE) TJ şablonunun
 * çerçevesinden (boy 5,55 m, çap 1,56 m, orta z 0,12) bu motora taşınır.
 */
export function frameDesign(m: DesignFrame): ViewSet {
  return scaleViews(BARE, BARE_FRAME, m);
}

/**
 * Görsel kaynağın kamera açıları. Şablon yuvalarında (kind yuvası, elle
 * ayarlı tip) KIND_VIEWS aynen: kayıt sahneleri ve dersler bozulmaz. Atölye
 * yuvasında aynı sunum tipinin açıları şablon motorundan (`reference`) bu
 * tasarımın boyutuna ölçeklenir; elle ayarlı açısı olmayan tip (turboşaft)
 * yerleşimden çerçevelenir.
 */
export function viewsFor(
  src: Pick<VisualSource, 'slot' | 'traits' | 'layout' | 'built'>,
  reference?: Pick<VisualSource, 'layout' | 'built'>,
  fit?: ViewFit,
): ViewSet {
  const kind = src.traits.presentation;
  const fitted = (v: ViewSet) => (fit ? fitViews(v, fit) : v);
  if (!TUNED.has(kind)) return fitted(frameDesign(frameOf(src)));
  if (src.slot !== 'workshop' || !reference) return KIND_VIEWS[kind];
  return fitted(scaleViews(KIND_VIEWS[kind], frameOf(reference), frameOf(src)));
}

/** Kameranın çıkamayacağı kutu (test hücresi) ve yörünge kontrolünün en uzak mesafesi */
export interface ViewFit {
  bounds: THREE.Box3;
  maxDistance: number;
}

/**
 * Ölçeklenmiş açıyı kapalı alana sığdırır: kamera kutunun dışına ya da
 * yörünge sınırının ötesine düşüyorsa bakış doğrultusunda hedefe yaklaşır
 * ve görüş açısı aynı oranda genişler (motor ekranda aynı boyda kalır;
 * büyük motor hücrede geniş açıyla çekilir). En çok 70°.
 */
export function fitViews(views: ViewSet, fit: ViewFit): ViewSet {
  const out: ViewSet = {};
  const margin = 0.3;
  const box = fit.bounds.clone().expandByScalar(-margin);
  for (const name of Object.keys(views) as ViewName[]) {
    const v = views[name]!;
    const t = new THREE.Vector3(...v.target);
    const p = new THREE.Vector3(...v.position);
    const dir = p.clone().sub(t);
    const d = dir.length();
    let s = Math.min(1, (fit.maxDistance - margin) / Math.max(d, 1e-6));
    // Hedeften kameraya ışın kutudan nerede çıkar (hedef kutunun içinde)
    if (box.containsPoint(t)) {
      for (const ax of ['x', 'y', 'z'] as const) {
        const lim = dir[ax] > 0 ? box.max[ax] : box.min[ax];
        if (Math.abs(dir[ax]) > 1e-9) s = Math.min(s, Math.max(0.05, (lim - t[ax]) / dir[ax]));
      }
    }
    if (s >= 0.999) {
      out[name] = v;
      continue;
    }
    const half = THREE.MathUtils.degToRad(v.fov / 2);
    const fov = Math.min(70, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(half) / s)));
    out[name] = { ...v, position: t.clone().addScaledVector(dir, s).toArray() as [number, number, number], fov };
  }
  return out;
}

/** Süren çekim geçişinin durumu (kayıt betikleri `rig.anim.active = false` ile keser) */
export interface ShotState {
  active: boolean;
  t: number;
  duration: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromFov: number;
  toFov: number;
}

/**
 * İki kadraj arası yumuşak geçiş (smootherstep, 1,4 s). 2F'nin vitrin
 * yolları (Catmull-Rom dolly) aynı arayüzle buraya eklenir.
 */
export class ShotPlayer {
  readonly state: ShotState = {
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

  get active(): boolean {
    return this.state.active;
  }

  /** Geçiş başlatır: başlangıç kameranın şu anki konumu, hedefi ve açısı */
  start(camera: THREE.PerspectiveCamera, target: THREE.Vector3, toPos: THREE.Vector3, toTarget: THREE.Vector3, toFov: number) {
    const a = this.state;
    a.fromPos.copy(camera.position);
    a.toPos.copy(toPos);
    a.fromTarget.copy(target);
    a.toTarget.copy(toTarget);
    a.fromFov = camera.fov;
    a.toFov = toFov;
    a.t = 0;
    a.active = true;
  }

  stop() {
    this.state.active = false;
  }

  /** Bir adım: kamera konumu, hedef ve görüş açısı ara değere */
  step(dt: number, camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
    const a = this.state;
    if (!a.active) return;
    a.t += dt / a.duration;
    const k = THREE.MathUtils.smootherstep(Math.min(a.t, 1), 0, 1);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    target.lerpVectors(a.fromTarget, a.toTarget, k);
    camera.fov = THREE.MathUtils.lerp(a.fromFov, a.toFov, k);
    if (a.t >= 1) a.active = false;
  }
}
