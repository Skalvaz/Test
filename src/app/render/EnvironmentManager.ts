/**
 * Ortam yöneticisi (T-17 ilk adımı, Dalga 0): gökyüzü/ışık ortamı, test
 * hücresi ve havaalanı yüklemesi, ortam geçişi, hücre ışık seviyesi ve
 * geçiş sonrası shader ön-derlemesi. App.ts'ten davranış değiştirmeden
 * taşındı. Sahibi 1A (T-02 geçiş sırası, T-04 havaalanını ilk kareden sonra
 * yükleme); ışık takımı ve pozlamanın kendisi `src/core/lightRig.ts` ve
 * `src/core/exposure.ts`'tedir (2B, 2A).
 *
 * App eski adları korur (`app.applyEnvironment`, `app.setLights`,
 * `app.envPending`, `app.envSerial`): kayıt ve ölçüm betikleri kullanır.
 */

import * as THREE from 'three';
import { createEnvironment, HDRI_PRESETS, PRESETS } from '../../core/environment.js';
import { CELL_BOUNDS, loadTestCell, setCellLights, type TestCell } from '../../core/testCell';
import { loadCellProps } from '../../core/cellProps';
import { loadAirfield, type Airfield } from '../../core/airfield';
import { createNoiseTexture } from '../../materials/textures.js';
import { weather, wetUniforms } from '../../core/weather';
import type { createMaterials } from '../../materials/library.js';
import type { CameraRig } from '../CameraRig';
import { CELL_LIGHTS, cellLightLevel, LightRig } from '../../core/lightRig';
import { CELL_EXPOSURE, cellExposure, setExposure } from '../../core/exposure';

/** Blender'da pişirilmiş kapalı test hücresi ortamının adı */
export const TEST_CELL = 'Test hücresi';
export const AIRFIELD_DEFAULT = 'Havaalanı — öğle';
export const AIRFIELD_NIGHT = 'Havaalanı — gece';

export type SceneEnvironment = ReturnType<typeof createEnvironment>;
type Materials = ReturnType<typeof createMaterials>;

/** Ortamın dokunduğu App parçaları */
export interface EnvironmentHost {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly rig: CameraRig;
  /** Sahnedeki motorun kökü (yansıma yakalamasında gizlenir) */
  visualRoot(): THREE.Object3D;
  /** Motorun zemini ve gölge düzlemi (EngineVisual.setGround) */
  setGround(floorY: number, inCell: boolean): void;
  /** Ortam kapanması yarıçapı (RenderPipeline.setAoScale) */
  setAoScale(inCell: boolean): void;
  /** Bütün sahneyi derler (RenderPipeline.compile) */
  compile(): Promise<unknown>;
}

/** İlerleme adımı (App.init'in yükleme metni) */
export type LoadStep = (stage: 'cell' | 'cellProps' | 'airfield', label: string) => Promise<void>;

export class EnvironmentManager {
  env!: SceneEnvironment;
  /** Sabit ışık takımı (src/core/lightRig.ts); App kesit dolgu ışığını ekler */
  lights!: LightRig;
  cell: TestCell | null = null;
  airfield: Airfield | null = null;
  /** Seçili ortamın adı */
  name: string;
  /** Zemin yüksekliği (ortama bağlı; efektler kullanır) */
  floorY = -3.35;
  /** Test hücresi ışık seviyesi: 1 açık, 0.35 loş, 0 gece */
  lightLevel = 1;
  /**
   * Ortam değişiminde yeni shader'lar derlenirken true: bu sürede kare
   * çizilmez, ekranda önceki kare kalır. (Paralel derlemede hazır olmayan
   * nesneler atlanır; yoksa bir an apron yerine altındaki çimen görünür.)
   */
  pending = false;
  /** Her derleme başlangıcında artar: eski bir derlemenin bitişi bayrağı erken indirmesin */
  serial = 0;

  constructor(
    private host: EnvironmentHost,
    initial: string,
  ) {
    this.name = initial;
  }

  /** Gökyüzü, ışıklar ve prosedürel zemin */
  create(materials: Materials) {
    const env = createEnvironment(this.host.renderer, this.host.scene, materials);
    this.env = env;
    this.lights = new LightRig({
      sun: env.sun,
      ambient: env.ambient,
      keyPanel: env.keyPanel,
      rimPanel: env.rimPanel,
      rampA: env.rampLightA,
      rampB: env.rampLightB,
    });
  }

  /**
   * Bütün ortam varlıkları (App.init çağırır): hücre, donanımı, havaalanı.
   * Sıra ve erteleme bu sınıfındır (1A, T-04: havaalanı ilk kareden sonra).
   */
  async load(step: LoadStep, scans: Parameters<typeof loadAirfield>[0], camera: THREE.Camera) {
    await this.loadCell(step);
    await this.loadAirfield(step, scans, camera);
  }

  /** Test hücresi ve hücre donanımı (yüklenemezse açık hava kullanılır) */
  async loadCell(step: LoadStep) {
    await step('cell', 'Test hücresi yükleniyor…');
    try {
      this.cell = await loadTestCell(this.host.renderer);
      this.host.scene.add(this.cell.root);
      await step('cellProps', 'Hücre donanımı yükleniyor…');
      // Gerçek modeller (Poly Haven): yüklenemezse hücre yine çalışır
      const props = await loadCellProps().catch((err) => {
        console.error('Hücre modelleri yüklenemedi', err);
        return null;
      });
      if (props) this.cell.root.add(props);
    } catch (err) {
      console.error('Test hücresi yüklenemedi, açık hava ortamı kullanılacak', err);
      this.cell = null;
    }
  }

  /** 3B havaalanı (yüklenemezse prosedürel zemin) */
  async loadAirfield(step: LoadStep, scans: Parameters<typeof loadAirfield>[0], camera: THREE.Camera) {
    await step('airfield', 'Havaalanı yükleniyor…');
    try {
      this.airfield = await loadAirfield(scans, createNoiseTexture(256, 4242), this.host.renderer);
      this.host.scene.add(this.airfield.root);
      // Shader'ları önceden derle: yoksa ilk karelerde apron çizilmez ve
      // altındaki çimen görünür (paralel derleme bitene kadar)
      await this.host.renderer.compileAsync(this.airfield.root, camera, this.host.scene).catch(() => undefined);
      this.airfield.root.visible = false;
    } catch (err) {
      console.error('Havaalanı yüklenemedi, prosedürel zemin kullanılacak', err);
      this.airfield = null;
    }
  }

  get inCell(): boolean {
    return this.name === TEST_CELL;
  }

  /** Ayarlar menüsündeki ortam adları */
  names(): string[] {
    const outdoor = this.airfield ? [...Object.keys(HDRI_PRESETS), AIRFIELD_NIGHT] : Object.keys(PRESETS);
    return [...(this.cell ? [TEST_CELL] : []), ...outdoor];
  }

  /**
   * Ortamı değiştirir. Test hücresinde gökyüzü, zemin ve sis kapanır; motoru
   * aydınlatan çalışma zamanı ışıkları hücrenin pişirilmiş ışığına uyacak
   * şekilde tavan armatürlerinin altına taşınır; yansımalar hücreden gelir.
   * Havaalanında gökyüzü HDRI'dan (gece: fiziksel gökyüzü modeli), zemin ve
   * binalar 3B'dir; yansıma haritası gökyüzü + havaalanından yakalanır.
   */
  apply(name: string) {
    const env = this.env;
    const host = this.host;
    const scene = host.scene;
    const inCell = name === TEST_CELL && !!this.cell;
    const hasAirfield = !!this.airfield;
    const sky = !inCell && hasAirfield && name in HDRI_PRESETS;
    const night = !inCell && hasAirfield && name === AIRFIELD_NIGHT;
    const legacy = !inCell && !hasAirfield && name in PRESETS;
    this.name = inCell || sky || night || legacy ? name : hasAirfield ? AIRFIELD_DEFAULT : 'Altın saat';
    // Yağmur yalnız açık havada ve yağmurlu ortamda
    weather.rain = sky ? ((HDRI_PRESETS as Record<string, { rain?: number }>)[this.name]?.rain ?? 0) : 0;
    // Ortam seçilince zemin hemen o havaya uygun (ıslak/kuru) başlar
    wetUniforms.uWet.value = weather.rain;
    const outdoorAirfield = !inCell && hasAirfield;
    if (this.cell) this.cell.root.visible = inCell;
    if (this.airfield) {
      this.airfield.root.visible = outdoorAirfield;
      this.airfield.setNight(this.name === AIRFIELD_NIGHT);
    }
    env.sky.visible = !inCell && !(outdoorAirfield && this.name !== AIRFIELD_NIGHT);
    env.ground.visible = !inCell && !outdoorAirfield;
    host.rig.bounds = inCell ? CELL_BOUNDS : null;
    host.rig.controls.maxDistance = inCell ? 18 : 40;
    this.floorY = outdoorAirfield ? this.airfield!.floorY : -3.35;
    host.setGround(this.floorY, inCell);
    host.setAoScale(inCell);
    const capture = () => env.captureEnvironment([host.visualRoot()]);
    if (outdoorAirfield && this.name !== AIRFIELD_NIGHT) {
      scene.environmentIntensity = 1;
      // Gökyüzü yüklenirken de ortam hazır değil (yarım ortam çizilmesin;
      // kayıt araçları envPending'i bekler). Eski bir derlemenin bitişi
      // bayrağı erken indirmesin diye sıra numarası da ilerler.
      this.serial++;
      this.pending = true;
      env
        .setHdri(this.name)
        .then((ok: boolean) => {
          if (ok) capture();
          this.precompile();
        })
        .catch((err: unknown) => {
          console.error('Gökyüzü yüklenemedi', err);
          this.apply(AIRFIELD_NIGHT);
        });
      return;
    }
    env.clearHdri();
    if (!inCell) {
      // Hücre ışığı kısılmışsa açık hava ortam ışığı etkilenmesin
      scene.environmentIntensity = 1;
      env.setPreset(this.name === AIRFIELD_NIGHT ? 'Gece apronu' : this.name);
      if (outdoorAirfield) capture();
      this.precompile();
      return;
    }
    const cell = this.cell!;
    scene.environment = cell.envMap;
    scene.background = new THREE.Color(0x040506);
    if (scene.fog) (scene.fog as THREE.FogExp2).density = 0;
    // Tavandaki armatür sırasının hemen altından, hafif önden gelen ana ışık (gölgeli)
    env.sun.visible = true;
    this.lights.apply(CELL_LIGHTS);
    setExposure(host.renderer, CELL_EXPOSURE);
    this.setLights(this.lightLevel);
    this.precompile();
  }

  /**
   * Hücre ışıklarını kısar ya da kapatır. Gece modunda motoru aydınlatan
   * yalnızca kendi kor parçaları, alevi ve kontrol odası ışığıdır.
   */
  setLights(level: number) {
    this.lightLevel = level;
    if (!this.cell || this.name !== TEST_CELL) return;
    const k = Math.max(0, Math.min(1, level));
    setCellLights(this.cell, k);
    this.lights.apply(cellLightLevel(k));
    this.host.scene.environmentIntensity = 0.06 + 0.94 * k;
    // Karanlıkta göz uyum sağlar: pozlama biraz artar
    setExposure(this.host.renderer, cellExposure(k));
  }

  /** Sahnedeki tüm görünür malzemeleri derler; bitene kadar çizim bekler */
  precompile() {
    const serial = ++this.serial;
    this.pending = true;
    const done = () => {
      if (serial === this.serial) this.pending = false;
    };
    this.host.compile().then(done, done);
  }

  /** Kare başı: havaalanı animasyonları (anten, rüzgâr tulumu) */
  update(dt: number) {
    if (this.airfield?.root.visible) this.airfield.update(dt);
  }
}
