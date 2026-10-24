/**
 * Çizim hattı (T-17 ilk adımı, Dalga 0): renderer, post-process zinciri,
 * kalite, boyut, shader ön-derlemesi ve ısı pusu uniform'ları. App.ts'ten
 * davranış değiştirmeden taşındı. Sahibi 1A (T-01 ön-derleme hedefi,
 * T-05 NaN, T-06 gölge güncellemesi, T-13 bağlam kaybı, T-16 ?perf=1
 * HUD'u bu sınıfa eklenir); post zincirinin içi 2A'nın (`src/core/postfx.js`,
 * `src/core/post/*`).
 *
 * App eski alanları korur (`app.renderer`, `app.fx`): kayıt ve ölçüm
 * betikleri bunlara erişir.
 */

import * as THREE from 'three';
import { createComposer } from '../../core/postfx.js';
import type { SimSnapshot } from '../../sim';
import type { QualityPreset } from './quality';

export type PostFx = ReturnType<typeof createComposer>;

/** Isı pusu için lülenin ekran izdüşümü (EngineVisual.exhaustExit) */
export interface HazeSource {
  z: number;
  radius: number;
}

export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  /** Post-process zinciri (createPost'tan sonra) */
  fx!: PostFx;

  constructor(container: HTMLElement) {
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      stencil: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = true;
    container.append(renderer.domElement);
    this.renderer = renderer;
  }

  /** Post-process zincirini kurar (sahne ve kamera hazır olunca) */
  createPost(scene: THREE.Scene, camera: THREE.Camera): PostFx {
    this.fx = createComposer(this.renderer, scene, camera);
    return this.fx;
  }

  /**
   * Kalite kademesi: piksel oranı, güneş gölge haritası, GTAO ve bloom.
   * Boyut değişikliği (piksel oranı) için ardından `resize` çağrılır.
   */
  applyQuality(p: QualityPreset, sun: THREE.DirectionalLight) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
    if (sun.shadow.mapSize.x !== p.shadow) {
      sun.shadow.mapSize.set(p.shadow, p.shadow);
      sun.shadow.map?.dispose();
      (sun.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    this.fx.gtao.enabled = p.gtao;
    this.fx.bloom.enabled = p.bloom;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h);
    this.fx.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.fx.composer.setSize(w, h);
    this.fx.grade.uniforms.uAspect.value = w / h;
  }

  /** Ortam kapanması yarıçapı: hücrede motor ayrıntısı, dışarıda yapılar ve donanım */
  setAoScale(inCell: boolean) {
    this.fx?.gtao.updateGtaoMaterial({ radius: inCell ? 0.32 : 0.75, thickness: inCell ? 0.6 : 1.2 });
  }

  /** Sahnedeki görünür malzemeleri paralel derler (ortam değişimi; bitene kadar çizim bekler) */
  compile(scene: THREE.Scene, camera: THREE.Camera): Promise<unknown> {
    return this.renderer.compileAsync(scene, camera);
  }

  /** Bir kare: bütün post zinciri ekrana */
  render(dt: number) {
    this.fx.composer.render(dt);
  }

  /**
   * Sıcak egzozun ekran uzayı kırılması: lüle ağzı ve sıcak jetin ucu her
   * karede ekrana yansıtılır; derecelendirme geçişi aradaki koniyi büker.
   */
  updateHaze(snap: SimSnapshot, cam: THREE.PerspectiveCamera, ex: HazeSource, dt: number) {
    const u = this.fx.grade.uniforms;
    // Sıcak jet boyu ve genişlemesi: kuru jet ~12 lüle yarıçapı, art
    // yakıcıda çok daha uzun; karışma katmanı ~0,1 eğimle genişler
    const len = ex.radius * (12 + 16 * snap.abLevel);
    const a = new THREE.Vector3(0, 0, ex.z);
    const b = new THREE.Vector3(0, 0, ex.z + len);
    // Kameranın arkasına düşen uç, izdüşüm ters dönmesin diye kırpılır
    const toCam = (v: THREE.Vector3) => v.clone().applyMatrix4(cam.matrixWorldInverse).z;
    const near = -cam.near * 4;
    if (toCam(a) > near) {
      u.uHaze.value = 0;
      u.uTime.value += dt;
      return;
    }
    const zb = toCam(b);
    if (zb > near) {
      const za = toCam(a);
      b.lerpVectors(a, b, (za - near) / (za - zb));
    }
    const rB = ex.radius * (1.15 + (0.1 * a.distanceTo(b)) / ex.radius / 1.2);
    const pxR = (r: number, v: THREE.Vector3) => r / (2 * Math.max(0.05, -toCam(v)) * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    u.uHazeWA.value = pxR(ex.radius * 1.15, a);
    u.uHazeWB.value = pxR(rB * (1 + 0.5 * snap.abLevel), b);
    const pa = a.clone().project(cam);
    const pb = b.clone().project(cam);
    u.uHazeA.value.set(pa.x * 0.5 + 0.5, pa.y * 0.5 + 0.5);
    u.uHazeB.value.set(pb.x * 0.5 + 0.5, pb.y * 0.5 + 0.5);
    const hot = snap.cycle.stations['7'].T - snap.amb.T0;
    // Art yakıcıda kırılma alevin çevresinde çok daha güçlü
    u.uHaze.value = snap.lit ? THREE.MathUtils.smoothstep(hot, 80, 480) + 1.1 * snap.abLevel : 0;
    u.uTime.value += dt;
  }
}
