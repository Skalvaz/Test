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

/**
 * Son karedeki sonlu olmayan ve negatif pikseller (NaN bekçisi, T-05).
 * `runs`: kötü piksellerin görüntü sırasındaki (sol üstten, satır satır)
 * [başlangıç, uzunluk] dizileri; vitrin kaydı maske PNG'si yazar.
 */
export interface NonFiniteProbe {
  nan: number;
  inf: number;
  neg: number;
  w: number;
  h: number;
  /** Yarım kayan nokta okundu (sürücü FLOAT okumayı reddetti) */
  half: boolean;
  runs?: [number, number][];
}

/** Isı pusu için lülenin ekran izdüşümü (EngineVisual.exhaustExit) */
export interface HazeSource {
  z: number;
  radius: number;
}

export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  /** Post-process zinciri (createPost'tan sonra) */
  fx!: PostFx;
  /**
   * WebGL bağlamı geri gelince (kanca; App ortamı yeniden kurar). Bugün
   * çağrılmıyor: `webglcontextrestored` dinleyicisini 1A ekler (T-13).
   */
  onContextRestored?: () => void;

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
   * Post zincirinin birikimli saatlerini sıfırlar (gren, ısı pusu gürültüsü).
   * Belirlenimli kayıt sahne başında çağırır (scripts/capture/vitrin.mjs):
   * 1A/2A geçişleri yeniden düzenleyince yeni saatleri de buraya ekler.
   */
  resetClocks() {
    this.fx.grade.uniforms.uTime.value = 0;
  }

  /**
   * NaN bekçisi (T-05; sözleşme, sahibi 1A): son kareyi ekrana değil kayan
   * noktalı hedefe yeniden çizer ve sonlu olmayan/negatif pikselleri sayar.
   * Sim ilerlemez (yalnız post zinciri); tuvaldeki kare değişmez. Zincir
   * yeniden düzenlenince (T-05: SMAA → gren sırası) bu yöntem son geçişin
   * çıktısını okumaya devam etmelidir; vitrin kaydı yalnız bunu çağırır.
   */
  probeNonFinite(opts: { runs?: boolean } = {}): NonFiniteProbe {
    const comp = this.fx.composer;
    const r = this.renderer;
    const gl = r.getContext() as WebGL2RenderingContext;
    comp.renderToScreen = false;
    try {
      comp.render(0);
    } finally {
      comp.renderToScreen = true;
    }
    const rt = comp.readBuffer;
    const w = rt.width;
    const h = rt.height;
    r.setRenderTarget(rt);
    let buf: Float32Array | Uint16Array = new Float32Array(w * h * 4);
    let half = false;
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, buf);
    if (gl.getError() !== gl.NO_ERROR) {
      buf = new Uint16Array(w * h * 4);
      half = true;
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.HALF_FLOAT, buf);
    }
    r.setRenderTarget(null);
    let nan = 0;
    let inf = 0;
    let neg = 0;
    const runs: [number, number][] = [];
    // GL satırları alttan üste: görüntü sırası için ters gezilir
    for (let yi = 0; yi < h; yi++) {
      const y = h - 1 - yi;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let bn = false;
        let bi = false;
        let bg = false;
        for (let c = 0; c < 3; c++) {
          const k = i * 4 + c;
          if (half) {
            const v = buf[k];
            if ((v & 0x7c00) === 0x7c00) {
              if (v & 0x03ff) bn = true;
              else bi = true;
            } else if (v & 0x8000 && v & 0x7fff) bg = true;
          } else {
            const v = buf[k];
            if (v !== v) bn = true;
            else if (!Number.isFinite(v)) bi = true;
            else if (v < 0) bg = true;
          }
        }
        if (bn) nan++;
        if (bi) inf++;
        if (bg) neg++;
        if (opts.runs && (bn || bi || bg)) {
          const p = yi * w + x;
          const lastRun = runs[runs.length - 1];
          if (lastRun && lastRun[0] + lastRun[1] === p) lastRun[1]++;
          else runs.push([p, 1]);
        }
      }
    }
    return { nan, inf, neg, w, h, half, ...(opts.runs ? { runs } : {}) };
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
