/**
 * Uygulama çekirdeği: renderer, sahne, simülasyon, ses ve arayüzü bir araya
 * getirir; modlar (menü / ders / test hücresi) arasında geçişi yönetir.
 */

import * as THREE from 'three';
import { EngineAudio, type AudioEngine } from '../audio/EngineAudio';
import { createEnvironment, HDRI_PRESETS, PRESETS } from '../core/environment.js';
import { createComposer } from '../core/postfx.js';
import { CELL_BOUNDS, loadTestCell, setCellLights, type TestCell } from '../core/testCell';
import { loadCellProps } from '../core/cellProps';
import { loadAirfield, type Airfield } from '../core/airfield';
import { createNoiseTexture } from '../materials/textures.js';
import { EngineVisual, type PartId } from '../engine/visual';
import { LessonRunner, type LessonResult } from '../game/LessonRunner';
import { LESSONS } from '../game/lessons';
import type { Lesson, StepUi } from '../game/lessons/types';
import { PARTS } from '../game/parts';
import { loadProgress, loadSettings, saveLessonResult, saveSettings, type Settings } from '../game/progress';
import { createMaterials } from '../materials/library.js';
import { loadKit, setKitQuality } from '../engine/kit.js';
import { setBladeQuality } from '../engine/blades.js';
import { setDetailTag } from '../engine/buildCache.js';
import { builtFor, designFor, setSlotBuilt, setSlotGraph, type SlotId } from '../design/catalog';
import { isBuiltEngine, type BuildOptions, type BuiltEngine } from '../design/graph';
import type { EngineGraph } from '../design/types';
import { visualSourceFor, type VisualSource } from '../engine/models';

/** Model ayrıntı seviyesi: kit parçaları, kanat örneklemesi, önbellek etiketi */
function setDetail(q: Settings['quality']) {
  setKitQuality(q);
  setBladeQuality(q);
  setDetailTag(q);
}
import { setCutPlane } from '../materials/engine';
import { Rain } from '../core/rain';
import { updateWeather, weather, wetUniforms } from '../core/weather';
import { loadScans } from '../materials/scans.js';
import { loadPanelDetails } from '../materials/textures.js';
import { EngineSim, type SimEvent } from '../sim';
import { Cockpit, type SwitchId } from '../ui/Cockpit';
import { CycleDiagram } from '../ui/CycleDiagram';
import { h, icon } from '../ui/dom';
import { Eicas } from '../ui/Eicas';
import { LessonPanel } from '../ui/LessonPanel';
import { glossaryModal, lessonSelect, mainMenu, resultModal, settingsModal } from '../ui/Menus';
import { SandboxPanel } from '../ui/SandboxPanel';
import { Toasts } from '../ui/Toasts';
import { CameraRig, VIEWS, viewsFor, type ViewName } from './CameraRig';
import { needsReframe } from './reframe';
import { Picker } from './Picker';
import { WorkshopStore } from '../workshop/store';
import { moduleOfPart, partsOfModule, type PartTag } from '../design/partsMap';
import { deriveTraits } from '../design/traits';
import { WorkshopPanel } from './workshop/WorkshopPanel';
import { ResultsPanel } from './workshop/ResultsPanel';
import { Coachmarks } from './workshop/Coachmarks';
import { startScreen } from './workshop/StartScreen';
import { WorkshopHandles } from './workshop/Handles';
import { DesignGhost } from './workshop/Ghost';
import { ScaleFigure } from './workshop/ScaleFigure';
import { EnvelopeBox } from './workshop/EnvelopeBox';
import type { Evaluation } from '../design/evaluate';
import type { HandleScreen } from './workshop/Handles';

type Mode = 'menu' | 'lesson' | 'sandbox' | 'workshop';

/** Atölye test kancası (M5A-SPEC §6.10) */
export interface WorkshopHook {
  store: WorkshopStore;
  current(): Evaluation;
  handles(): HandleScreen[];
  readonly idle: boolean;
  readonly lastBuildMs: number;
  flush(): Promise<void>;
}

const ALL_SWITCHES: SwitchId[] = ['apuBleed', 'starter', 'ignition', 'fuelRun', 'fadec'];
const DEFAULT_SWITCHES: SwitchId[] = ['apuBleed', 'starter', 'ignition', 'fuelRun'];
const QUALITY = {
  low: { pixelRatio: 1, shadow: 1024, gtao: false, bloom: false },
  medium: { pixelRatio: 1.5, shadow: 2048, gtao: true, bloom: true },
  high: { pixelRatio: 2, shadow: 4096, gtao: true, bloom: true },
} as const;

/** Blender'da pişirilmiş kapalı test hücresi ortamının adı */
const TEST_CELL = 'Test hücresi';
const AIRFIELD_DEFAULT = 'Havaalanı — öğle';
const AIRFIELD_NIGHT = 'Havaalanı — gece';

const step = (onText: (t: string) => void, text: string) =>
  new Promise<void>((resolve) => {
    onText(text);
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

export class App {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig!: CameraRig;
  sim = new EngineSim();
  /** Simülasyondaki ve sahnedeki motorun yuvası (kind yuvası ya da 'workshop') */
  slot: SlotId = 'turbofan';
  visual!: EngineVisual;
  audio = new EngineAudio();
  mode: Mode = 'menu';
  /** Sahnedeki motorun kaynağı: katalog (kind yuvası) ya da atölye tasarımı */
  source: 'catalog' | 'workshop' = 'catalog';
  timeScale = 1;

  /* ---- Atölye (M5a P10) ---- */
  private wsStore!: WorkshopStore;
  private wsPanel!: WorkshopPanel;
  private wsResults!: ResultsPanel;
  private wsCoach!: Coachmarks;
  private wsHandles: WorkshopHandles | null = null;
  private wsGhost: DesignGhost | null = null;
  private wsFigure: ScaleFigure | null = null;
  private wsBox: EnvelopeBox | null = null;
  private wsAcc = 0;
  private wsHover: PartId[] | null = null;
  /** Ders bitince/çıkınca dönülecek mod */
  private returnTo: 'workshop' | null = null;
  private wsHook = (dt: number) => this.workshopFrame(dt);

  private env!: ReturnType<typeof createEnvironment>;
  private materials!: ReturnType<typeof createMaterials>;
  private cell: TestCell | null = null;
  private fx!: ReturnType<typeof createComposer>;
  private picker!: Picker;
  private cockpit!: Cockpit;
  private eicas!: Eicas;
  private diagram!: CycleDiagram;
  private toasts = new Toasts();
  private lessonPanel!: LessonPanel;
  private sandboxPanel!: SandboxPanel;
  private runner: LessonRunner | null = null;
  private currentLessonIndex = 0;

  private topbar!: HTMLElement;
  private modeChip!: HTMLSpanElement;
  private consoleEl!: HTMLElement;
  private overlay: HTMLElement | null = null;
  private viewSelect!: HTMLSelectElement;
  private cutBtn!: HTMLButtonElement;
  private diagBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;

  private clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  /**
   * Kesit görünümünde iç kısmı aydınlatan, kameraya bağlı dolgu ışığı.
   * Şiddeti pozlamaya bölünür: görünen parlaklığı her ortamda aynıdır
   * (sabit şiddette gece ~5 kat parlak, kapalı havada sönük kalıyordu).
   */
  private cutFill = new THREE.PointLight(0xfff4e8, 0, 14, 1.6);
  private static readonly CUT_FILL = 2;
  /** Test hücresi ışık seviyesi: 1 açık, 0.35 loş, 0 gece */
  lightLevel = 1;
  private cutaway = false;
  private lastZoneEvents = 0;
  private rain = new Rain();
  private diagramVisible = false;
  private consoleVisible = false;
  private pickMode = false;
  private stickyHighlight: PartId | null = null;
  private stepHighlight: PartId | null = null;
  private autoStart = false;
  private settings: Settings;
  private envName = TEST_CELL;
  private airfield: Airfield | null = null;
  /**
   * Ortam değişiminde yeni shader'lar derlenirken true: bu sürede kare
   * çizilmez, ekranda önceki kare kalır. (Paralel derlemede hazır olmayan
   * nesneler atlanır; yoksa bir an apron yerine altındaki çimen görünür.)
   */
  envPending = false;
  private envSerial = 0;
  /** Zemin yüksekliği (ortama bağlı; efektler kullanır) */
  private floorY = -3.35;
  private last = performance.now();
  private sandboxAcc = 0;

  constructor(private container: HTMLElement) {
    const s = loadSettings();
    this.settings = {
      quality: s.quality ?? 'medium',
      volume: s.volume ?? 0.7,
      muted: s.muted ?? false,
      environment: s.environment ?? TEST_CELL,
    };
    this.envName = this.settings.environment;
  }

  async init(onProgress: (t: string) => void) {
    /* ---------------- renderer ---------------- */
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
    this.container.append(renderer.domElement);
    this.renderer = renderer;

    this.rig = new CameraRig(renderer.domElement);
    this.rig.onCutaway = (on) => this.setCutaway(on);

    await step(onProgress, 'Yüzey dokuları üretiliyor…');
    const details = await loadPanelDetails().catch((err) => {
      console.error('Panel detay dokuları yüklenemedi', err);
      return null;
    });
    await step(onProgress, 'Donanım parçaları yükleniyor…');
    setDetail(this.settings.quality);
    const kitTex = await loadKit(renderer).catch((err) => {
      console.error('Kit parçaları yüklenemedi', err);
      return null;
    });
    await step(onProgress, 'Malzeme taramaları yükleniyor…');
    const scans = await loadScans(renderer).catch((err) => {
      console.error('Malzeme taramaları yüklenemedi', err);
      return null;
    });
    const materials = createMaterials(renderer, details, kitTex, scans);
    this.materials = materials;

    await step(onProgress, 'Gökyüzü ve ortam ışığı hesaplanıyor…');
    this.env = createEnvironment(renderer, this.scene, materials);

    await step(onProgress, 'Test hücresi yükleniyor…');
    try {
      this.cell = await loadTestCell(renderer);
      this.scene.add(this.cell.root);
      await step(onProgress, 'Hücre donanımı yükleniyor…');
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

    await step(onProgress, 'Havaalanı yükleniyor…');
    try {
      this.airfield = await loadAirfield(scans, createNoiseTexture(256, 4242), renderer);
      this.scene.add(this.airfield.root);
      // Shader'ları önceden derle: yoksa ilk karelerde apron çizilmez ve
      // altındaki çimen görünür (paralel derleme bitene kadar)
      await renderer.compileAsync(this.airfield.root, this.rig.camera, this.scene).catch(() => undefined);
      this.airfield.root.visible = false;
    } catch (err) {
      console.error('Havaalanı yüklenemedi, prosedürel zemin kullanılacak', err);
      this.airfield = null;
    }

    await step(onProgress, 'Motor geometrisi oluşturuluyor…');
    this.visual = new EngineVisual(materials, visualSourceFor(this.slot));
    this.scene.add(this.visual.root);
    this.scene.add(this.cutFill);
    this.scene.add(this.rain.mesh);

    await step(onProgress, 'Termodinamik model dengeleniyor…');
    this.sim.trim(0);
    this.sim.on((e) => this.onSimEvent(e));

    await step(onProgress, 'Görüntü işleme zinciri kuruluyor…');
    this.fx = createComposer(renderer, this.scene, this.rig.camera);

    this.picker = new Picker(renderer.domElement, this.rig.camera, this.visual);
    this.picker.onPick = (p) => this.onPick(p);
    this.picker.onHover = (p) => this.onHover(p);
    this.picker.onFocus = (p, point) => {
      if (this.mode === 'menu' || (this.runner && this.pickMode)) return;
      this.stickyHighlight = p;
      this.rig.focusOn(point);
    };

    this.buildUi();
    this.applyEnvironment(this.envName);
    this.applyQuality(this.settings.quality);
    this.audio.volume = this.settings.volume;
    this.audio.muted = this.settings.muted;

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    const unlock = () => this.audio.resume();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.resize();
    this.showMenu(true);
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  /* ================================================================ */
  /* Arayüz                                                           */
  /* ================================================================ */

  private buildUi() {
    const iconBtn = (name: Parameters<typeof icon>[0], title: string, fn: () => void) =>
      h('button', { class: 'btn ghost icon', title, attrs: { 'aria-label': title }, on: { click: fn } }, [icon(name)]);

    this.modeChip = h('span', { class: 'mode-chip' });
    this.viewSelect = h('select', {
      class: 'btn small',
      title: 'Kamera açısı',
      on: { change: () => this.rig.go(this.viewSelect.value as ViewName) },
    }, (Object.keys(VIEWS) as ViewName[])
      .filter((v) => v !== 'menu')
      .map((v, i) => h('option', { text: `${i + 1} · ${VIEWS[v].label}`, attrs: { value: v } })));
    this.cutBtn = iconBtn('cut', 'Kesit görünümü (C)', () => this.setCutaway(!this.cutaway));
    this.diagBtn = iconBtn('panel', 'Motorun içi paneli (D)', () => this.setDiagram(!this.diagramVisible));
    this.soundBtn = iconBtn('sound', 'Ses (M)', () => this.toggleMute());

    this.topbar = h('div', { class: 'topbar' }, [
      h('div', { class: 'brand' }, [
        h('span', { class: 'brand-mark', text: 'TURBOFAN' }),
        h('span', { class: 'brand-sub', text: 'Akademi' }),
      ]),
      this.modeChip,
      h('span', { class: 'spacer' }),
      h('div', { class: 'group' }, [
        this.viewSelect,
        this.cutBtn,
        this.diagBtn,
        this.soundBtn,
        iconBtn('info', 'Bilgi bankası', () => this.openGlossary()),
        iconBtn('gear', 'Ayarlar', () => this.openSettings()),
        iconBtn('menu', 'Ana menü (Esc)', () => this.showMenu()),
      ]),
    ]);

    this.cockpit = new Cockpit(this.sim, {
      onSwitch: () => this.audio.resume(),
    });
    this.eicas = new Eicas();
    this.consoleEl = h('div', { class: 'console' }, [this.cockpit.startPanel, this.eicas.el, this.cockpit.throttleEl]);

    this.diagram = new CycleDiagram({ onHoverPart: (p) => this.onHover(p) });

    this.lessonPanel = new LessonPanel(this.sim);
    this.lessonPanel.onExit = () => (this.returnTo === 'workshop' ? this.openWorkshop({ resume: true }) : this.showMenu());

    this.applyEngineUi(this.visual.source);
    this.sandboxPanel = new SandboxPanel(this.sim, () => this.visual, {
      autoStart: () => this.beginAutoStart(),
      onEngine: (slot) => this.setEngine(slot, true),
      onLights: (level) => this.setLights(level),
      onTimeScale: (v) => {
        this.timeScale = v;
      },
      onExit: () => this.showMenu(),
      onWorkshop: () => this.runWorkshopDesign(),
      onBackToWorkshop: () => this.openWorkshop({ resume: true }),
      workshopName: () => (this.wsStore.state.phase === 'start' ? null : this.workshopDesignName()),
      workshopExpected: () => this.wsStore.state.last?.summary ?? null,
    });

    // Atölye: mağaza (otomatik kayıt localStorage'da), paneller, koçluk
    this.wsStore = new WorkshopStore({ onBuilt: (b, detail) => this.onWorkshopBuilt(b, detail) });
    const openLesson = (id: string) => {
      const l = LESSONS.find((x) => x.id === id);
      if (l) this.startLesson(l, { returnTo: 'workshop' });
    };
    this.wsPanel = new WorkshopPanel(this.wsStore, {
      onExit: () => this.showMenu(),
      onNewFromTemplate: () => this.openWorkshopStart(),
      onWizardCancel: () => this.openWorkshopStart(),
      openLesson,
      openGlossary: (id) => this.openGlossary(id),
      onKnobDrag: (a) => {
        const last = this.wsStore.state.last;
        if (!this.wsGhost || !last) return;
        if (a) this.wsGhost.begin(last.built);
        else this.wsGhost.end();
      },
    });
    this.wsResults = new ResultsPanel(this.wsStore, {
      onRunInCell: () => this.runWorkshopDesign(),
      onHighlight: (tags) => {
        this.wsHover = tags ? (tags as PartId[]) : null;
      },
      openGlossary: (id) => this.openGlossary(id),
      openLesson,
    });
    this.wsCoach = new Coachmarks();
    this.wsStore.subscribe((s) => {
      if (this.mode !== 'workshop') return;
      // Kaydırıcı sürüklemesi: hayalet yeni şekli izler
      if (this.wsGhost?.active && s.last && !this.wsHandles?.dragging) this.wsGhost.update(s.last.built);
      if (s.notice && s.notice.seq !== this.wsNoticeSeq) {
        this.wsNoticeSeq = s.notice.seq;
        this.toasts.show(s.notice.text, 'info', 4500);
      }
      this.refreshWorkshop();
    });
    this.topbar.insertBefore(this.wsPanel.toolbar, this.topbar.querySelector('.spacer'));

    document.body.append(
      this.topbar,
      this.consoleEl,
      this.diagram.el,
      this.lessonPanel.el,
      this.sandboxPanel.el,
      this.wsPanel.el,
      this.wsResults.el,
      this.wsResults.summaryStrip,
      this.wsCoach.el,
      this.toasts.el,
    );
  }
  private wsNoticeSeq = 0;

  private setVisible(el: HTMLElement, v: boolean) {
    el.classList.toggle('hidden', !v);
  }

  private layout() {
    // Arayüz gizliyken (H) bütün ekran 3B görünümündür
    if (document.body.classList.contains('ui-hidden')) {
      this.rig.setInsets({ left: 0, right: 0, top: 0, bottom: 0 });
      return;
    }
    const W = window.innerWidth;
    const css = getComputedStyle(document.documentElement);
    const px = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
    const leftOpen = this.mode !== 'menu' && W > 720;
    const rightOpen = (this.diagramVisible || this.mode === 'workshop') && this.mode !== 'menu' && W > 1000;
    this.rig.setInsets({
      left: this.mode === 'menu' ? Math.min(620, W * 0.42) : leftOpen ? px('--left-w') + 12 : 0,
      right: rightOpen ? px('--right-w') + 12 : 0,
      top: this.mode === 'menu' ? 0 : px('--topbar-h'),
      bottom: this.consoleVisible && this.mode !== 'menu' ? px('--console-h') + 12 : 0,
    });
  }

  private refreshChrome() {
    const m = this.mode;
    this.setVisible(this.topbar, m !== 'menu');
    this.setVisible(this.consoleEl, m !== 'menu' && this.consoleVisible);
    this.consoleEl.classList.toggle('no-start', this.cockpit.visibleSwitchCount === 0);
    this.setVisible(this.diagram.el, m !== 'menu' && this.diagramVisible);
    this.setVisible(this.lessonPanel.el, m === 'lesson');
    this.setVisible(this.sandboxPanel.el, m === 'sandbox');
    const ws = m === 'workshop';
    document.body.classList.toggle('mode-workshop', ws);
    this.setVisible(this.wsPanel.el, ws);
    this.setVisible(this.wsResults.el, ws);
    this.setVisible(this.wsResults.summaryStrip, ws);
    this.setVisible(this.wsPanel.toolbar, ws && this.wsStore.state.phase === 'edit');
    this.diagBtn.classList.toggle('hidden', ws);
    if (!ws) this.wsCoach.el.classList.add('hidden');
    this.cutBtn.classList.toggle('active', this.cutaway);
    this.diagBtn.classList.toggle('active', this.diagramVisible);
    this.soundBtn.replaceChildren(icon(this.audio.muted ? 'mute' : 'sound'));
    this.modeChip.textContent = m === 'lesson' ? 'Ders' : m === 'sandbox' ? 'Test hücresi' : ws ? 'Atölye' : '';
    this.layout();
  }

  private setCutaway(on: boolean) {
    this.cutaway = on;
    const planes = on ? [this.clipPlane] : [];
    this.visual.setClipping(planes);
    this.visual.setInteriorVisible(on);
    setCutPlane(on ? this.clipPlane : null);
    // GTAO ön geçişi override malzemeyle çizer (malzeme kırpması yok): motor
    // kesilmemiş görünür, iç parçaların ortam kapanması dış kabuktan
    // hesaplanırdı. Kesit düzlemi yalnız motorun sınır kutusu içinde uygulanır
    // (clipIntersection): zemin ve ortam etkilenmez.
    const nm = this.fx.gtao.normalMaterial as THREE.MeshNormalMaterial;
    if (on) {
      // Sınır kutusu: motor parçaları (stand, egzoz akışı, parçacıklar hariç)
      const box = new THREE.Box3();
      this.visual.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !o.userData.noClip && o.userData.part && o.userData.part !== 'stand') box.expandByObject(m);
      });
      box.expandByScalar(0.05);
      nm.clippingPlanes = [
        this.clipPlane,
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.max.x),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.min.x),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.max.y),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), box.min.y),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.max.z),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), box.min.z),
      ];
      nm.clipIntersection = true;
      nm.side = THREE.DoubleSide;
    } else {
      nm.clippingPlanes = null;
      nm.clipIntersection = false;
      nm.side = THREE.FrontSide;
    }
    nm.needsUpdate = true;
    this.picker.clipPlanes = planes;
    if (on) this.aimCutaway();
    if (!on) this.cutFill.intensity = 0;
    this.cutBtn?.classList.toggle('active', on);
  }

  /**
   * Kesit düzlemi motor ekseninden geçer ve kameraya bakan yarıyı kaldırır;
   * böylece motorun etrafında dönerken iç kısım her açıdan görünür.
   */
  private aimCutaway() {
    this.cutFill.intensity = App.CUT_FILL / Math.max(this.renderer.toneMappingExposure, 0.05);
    const c = this.rig.camera.position;
    const len = Math.hypot(c.x, c.y);
    if (len < 0.3) return; // tam eksenden bakarken son yön korunur
    // Kamera yataya yakınken (±20°) düzlem dikey kalır: ders açılarında
    // kesit hep aynı yerden geçer ve alt/üst parçalar (dişli kutusu) açık
    // kalır; daha dik bakışlarda düzlem kamerayla birlikte döner
    const th = Math.atan2(c.y, c.x);
    const base = Math.abs(th) < Math.PI / 2 ? 0 : Math.sign(th || 1) * Math.PI;
    const d = th - base;
    const dz = THREE.MathUtils.degToRad(20);
    const a = base + Math.sign(d) * Math.max(0, Math.abs(d) - dz) * (Math.PI / 2 / (Math.PI / 2 - dz));
    this.clipPlane.normal.set(-Math.cos(a), -Math.sin(a), 0);
    setCutPlane(this.clipPlane);
    // Dolgu ışığı kameranın üstünde ve biraz yanında: kamerayla aynı yerde
    // olsaydı kameraya dönük her düz metal yüz (disk alınları) tam ayna
    // açısında kalır, flaş gibi beyaz leke yapardı
    const cam = this.rig.camera;
    const dist = c.distanceTo(this.rig.controls.target);
    this.cutFill.position
      .copy(c)
      .addScaledVector(this.tmpUp.setFromMatrixColumn(cam.matrixWorld, 1), 0.55 * dist)
      .addScaledVector(this.tmpRight.setFromMatrixColumn(cam.matrixWorld, 0), -0.3 * dist);
  }
  private tmpUp = new THREE.Vector3();
  private tmpRight = new THREE.Vector3();

  private setDiagram(on: boolean) {
    this.diagramVisible = on;
    this.refreshChrome();
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  private openOverlay(el: HTMLElement) {
    this.closeOverlay();
    this.overlay = el;
    document.body.append(el);
    this.picker.hideTip();
  }

  /* ================================================================ */
  /* Modlar                                                           */
  /* ================================================================ */

  showMenu(first = false) {
    if (this.mode === 'workshop') this.leaveWorkshop();
    this.returnTo = null;
    this.mode = 'menu';
    this.runner = null;
    this.timeScale = 1;
    this.autoStart = false;
    this.pickMode = false;
    this.picker.showLabels = true;
    this.stepHighlight = null;
    this.stickyHighlight = null;
    this.visual.highlight(null);
    this.cockpit.flash(null);
    // Menü arka planı: rölantide çalışan motor
    if (!first) {
      this.sim.setFlight({ altitude: 0, mach: 0, isaDev: 0 }, true);
      if (!this.sim.lit || this.sim.turbineDamaged || this.sim.fanDamage > 0) {
        this.sim.reset();
      }
      if (this.sim.controls.fadec === 'manual') this.sim.controls.fadec = 'normal';
      this.sim.trim(0, 8);
    }
    this.setCutaway(false);
    this.rig.go('menu', first);
    this.rig.autoRotate = true;
    this.refreshChrome();

    const progress = loadProgress();
    this.openOverlay(
      mainMenu(
        {
          onLessons: () => this.openLessons(),
          onSandbox: () => this.openSandbox(),
          onGlossary: () => this.openGlossary(),
          onSettings: () => this.openSettings(),
          onWorkshop: () => this.openWorkshop(),
        },
        progress,
        LESSONS.length,
      ),
    );
  }

  openLessons() {
    this.audio.resume();
    const back = () => (this.mode === 'menu' ? this.showMenu() : this.closeOverlay());
    this.openOverlay(lessonSelect(LESSONS, loadProgress(), (l) => this.startLesson(l), back));
  }

  startLesson(lesson: Lesson, opts: { returnTo?: 'workshop' } = {}) {
    this.closeOverlay();
    if (this.mode === 'workshop') this.leaveWorkshop();
    this.returnTo = opts.returnTo ?? null;
    this.source = 'catalog';
    // Dersler yüksek baypaslı turbofan üzerine yazıldı (kind yuvası: atölye tasarımı dersi etkilemez)
    this.setEngine('turbofan', false);
    this.mode = 'lesson';
    this.currentLessonIndex = LESSONS.indexOf(lesson);
    this.rig.autoRotate = false;
    this.timeScale = 1;
    this.autoStart = false;
    this.stickyHighlight = null;
    this.visual.highlight(null);
    this.consoleVisible = true;
    this.diagramVisible = false;
    for (const id of ALL_SWITCHES) this.cockpit.setSwitchVisible(id, DEFAULT_SWITCHES.includes(id));
    this.cockpit.lockThrottle(false);
    this.visual.setPylonVisible(true);
    this.visual.setWingVisible(false);

    this.runner = new LessonRunner(lesson, {
      sim: this.sim,
      applyStepUi: (ui) => this.applyStepUi(ui),
      setPickMode: (a) => this.setPickMode(a),
    });
    this.lessonPanel.attach(this.runner, this.currentLessonIndex + 1);
    this.runner.onChange = (v) => this.lessonPanel.render(v);
    this.runner.onFinish = (r) => this.finishLesson(r);
    this.runner.refresh();
    this.refreshChrome();
  }

  private finishLesson(r: LessonResult) {
    saveLessonResult(r.lesson.id, r.stars);
    const idx = LESSONS.indexOf(r.lesson);
    const hasNext = idx + 1 < LESSONS.length;
    // Atölyeden açılan ders bitince atölyeye dönülür
    if (this.returnTo === 'workshop') {
      this.toasts.show(`${r.lesson.title} tamamlandı. Atölyeye dönüldü.`, 'info', 4000);
      this.openWorkshop({ resume: true });
      return;
    }
    this.openOverlay(
      resultModal(r, hasNext, {
        next: () => this.startLesson(LESSONS[idx + 1]),
        retry: () => this.startLesson(r.lesson),
        list: () => this.showMenuThenLessons(),
      }),
    );
  }

  private showMenuThenLessons() {
    this.showMenu();
    this.openLessons();
  }

  openSandbox(opts: { from?: 'workshop' } = {}) {
    this.audio.resume();
    this.closeOverlay();
    if (this.mode === 'workshop') this.leaveWorkshop();
    this.returnTo = null;
    this.sandboxPanel.setWorkshop(opts.from === 'workshop');
    this.mode = 'sandbox';
    this.runner = null;
    this.rig.autoRotate = false;
    this.pickMode = false;
    this.picker.showLabels = true;
    this.stepHighlight = null;
    this.cockpit.flash(null);
    for (const id of ALL_SWITCHES) this.cockpit.setSwitchVisible(id, true);
    this.cockpit.lockThrottle(false);
    this.consoleVisible = true;
    this.diagramVisible = window.innerWidth > 1000;
    this.rig.go('front');
    this.refreshChrome();
    if (opts.from === 'workshop') this.toasts.show("Tasarımın test hücresinde. 'Otomatik çalıştır' ile başlat.", 'info', 5500);
    else this.toasts.show('Test hücresi: motor rölantide. Soldaki panelden koşulları ve arızaları değiştirebilirsin.', 'info', 5500);
  }

  /* ================================================================ */
  /* Motor tasarım atölyesi (M5a P10, M5A-SPEC §6)                    */
  /* ================================================================ */

  /**
   * Atölyeye girer (openSandbox kalıbı): gaz kolu yok, simülasyon soğuk,
   * ortam test hücresi, efektsiz model. `resume`: test hücresinden ya da
   * dersten dönüş (seçim, kıyas, sekme korunur); yoksa başlangıç ekranı.
   */
  openWorkshop(opts: { resume?: boolean } = {}) {
    this.audio.resume();
    this.closeOverlay();
    const wasWorkshop = this.mode === 'workshop';
    this.mode = 'workshop';
    this.runner = null;
    this.returnTo = null;
    this.rig.autoRotate = false;
    this.pickMode = false;
    this.picker.showLabels = false;
    this.stepHighlight = null;
    this.stickyHighlight = null;
    this.autoStart = false;
    this.timeScale = 1;
    this.cockpit.flash(null);
    this.consoleVisible = false;
    this.diagramVisible = false;
    this.sim.reset();
    if (this.envName !== TEST_CELL && this.cell) this.applyEnvironment(TEST_CELL);
    const cut = this.cutaway;
    if (!wasWorkshop) this.rig.go('front');
    // Atölyede kesit kullanıcı anahtarıdır: açı geçişi onu değiştirmez
    this.setCutaway(cut);
    this.enterWorkshopScene();
    const st = this.wsStore.state;
    if (st.phase === 'testing') this.wsStore.setTesting(false);
    if (opts.resume && (st.phase === 'edit' || st.phase === 'testing')) {
      this.source = 'workshop';
      this.publishWorkshop();
    } else if (st.phase === 'edit' && wasWorkshop) {
      this.publishWorkshop();
    } else {
      this.openWorkshopStart();
    }
    this.refreshChrome();
    this.refreshWorkshop();
  }

  /** Başlangıç ekranı (yeni aile/şablon) */
  private openWorkshopStart() {
    const store = this.wsStore;
    const close = () => {
      this.closeOverlay();
      // Proje yoksa atölye boş kalmaz: menüye dön
      if (store.state.phase === 'start') this.showMenu();
    };
    this.openOverlay(
      startScreen({
        hasSaved: store.state.project.families.length > 0 || store.hasSaved(),
        onResume: () => {
          this.closeOverlay();
          if (store.state.project.families.length && store.state.phase !== 'start') {
            if (store.state.phase === 'wizard') store.resume();
            this.publishWorkshop();
          } else if (!store.resume()) this.toasts.show('Kayıt okunamadı: yeni bir tasarıma başla.', 'warn');
          this.source = 'workshop';
          this.refreshChrome();
          this.refreshWorkshop();
        },
        onTemplate: (id) => {
          this.closeOverlay();
          this.source = 'workshop';
          store.startFromTemplate(id);
          this.wsPanel.setTab('tune');
          this.refreshChrome();
          this.refreshWorkshop();
        },
        onScratch: () => {
          this.closeOverlay();
          this.source = 'workshop';
          this.wsPanel.wizard.reset();
          store.startWizard();
          this.refreshChrome();
          this.refreshWorkshop();
        },
        onClose: close,
      }),
    );
  }

  /** Mağazanın son geçerli tasarımını sahneye koyar (dönüşte) */
  private publishWorkshop() {
    const last = this.wsStore.state.last;
    if (!last) return;
    try {
      this.applyDesign('workshop', last.built, 'full', { effects: false });
    } catch (err) {
      console.warn('Atölye tasarımı kurulamadı', err);
    }
    this.placeWorkshopHelpers();
  }

  /** Mağaza yeni tasarım üretti: 3B model (taslak/tam), ölçek figürü, zarf */
  private onWorkshopBuilt(b: BuiltEngine, detail: 'draft' | 'full') {
    if (this.mode !== 'workshop') return;
    this.source = 'workshop';
    const t0 = performance.now();
    this.applyDesign('workshop', b, detail, { effects: false });
    this.wsBuildMs = performance.now() - t0;
    this.placeWorkshopHelpers();
  }
  private wsBuildMs = 0;

  private placeWorkshopHelpers() {
    const last = this.wsStore.state.last;
    if (!last) return;
    this.wsFigure?.place(last.built, this.floorY);
    this.wsBox?.set(this.wsStore.state.project.goal?.require ?? null, last.built);
  }

  /** Tutamaçlar, hayalet, ölçek figürü ve zarf kutusu sahneye */
  private enterWorkshopScene() {
    if (!this.wsGhost) this.wsGhost = new DesignGhost(this.scene);
    if (!this.wsHandles) {
      this.wsHandles = new WorkshopHandles(
        {
          camera: this.rig.camera,
          dom: this.renderer.domElement,
          controls: this.rig.controls,
          cutPlane: () => (this.cutaway ? this.clipPlane : null),
        },
        this.wsStore,
        { ghost: this.wsGhost },
      );
    }
    if (!this.wsFigure) this.wsFigure = new ScaleFigure(this.scene);
    if (!this.wsBox) this.wsBox = new EnvelopeBox(this.scene);
    this.wsHandles.setVisible(true);
    this.wsFigure.setVisible(true);
    this.picker.priority = (x, y) => this.mode === 'workshop' && this.wsHandles?.hitTest(x, y) != null;
    this.frameHooks.add(this.wsHook);
  }

  /** Atölyeden çıkış: kaplamalar gizlenir, otomatik kayıt mağazada */
  private leaveWorkshop() {
    this.wsStore.flush();
    this.frameHooks.delete(this.wsHook);
    this.wsHandles?.setVisible(false);
    this.wsFigure?.setVisible(false);
    this.wsBox?.set(null, null);
    this.wsGhost?.end();
    this.picker.priority = undefined;
    this.picker.showLabels = true;
    this.wsHover = null;
    document.body.classList.remove('mode-workshop');
  }

  private workshopFrame(_dt: number) {
    if (this.mode !== 'workshop') return;
    this.wsHandles?.frame();
    if (this.wsFigure) this.wsFigure.frame(this.rig.camera);
    this.wsBox?.frame(this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);
  }

  /** Paneller ve vurgu (mağaza değişince ve 0,2 s'de bir) */
  private refreshWorkshop() {
    if (this.mode !== 'workshop') return;
    const s = this.wsStore.state;
    this.wsPanel.update(s);
    this.wsResults.update(s);
    this.wsCoach.update(s, !this.wsCoach.done);
    this.setVisible(this.wsPanel.toolbar, s.phase === 'edit');
    this.wsHandles?.setVisible(s.phase === 'edit');
    if (this.wsStore.state.project.goal !== this.wsGoalShown) {
      this.wsGoalShown = this.wsStore.state.project.goal;
      this.placeWorkshopHelpers();
    }
  }
  private wsGoalShown: unknown = undefined;

  /** Etkin atölye varyantının adı */
  private workshopDesignName(): string {
    const f = this.wsStore.activeFamily();
    return f?.variants.find((v) => v.id === f.active)?.name ?? this.wsStore.state.graph.name;
  }

  /**
   * "Test hücresinde çalıştır" (§6.9): atölye yuvasını tam ayrıntıyla ve
   * efektlerle kurar, motor soğuk; test hücresi şeridi geri dönüş ve
   * beklenen/ölçülen itkiyi gösterir.
   */
  runWorkshopDesign() {
    const store = this.wsStore;
    store.flush();
    const last = store.state.last;
    if (!last || store.state.phase === 'start' || store.state.phase === 'wizard') {
      this.toasts.show('Önce atölyede bir tasarım oluştur.', 'info');
      return;
    }
    clearTimeout(this.fullDetailTimer);
    // Yuvaya adıyla yazılır: test hücresinde ve simülasyonda varyant adı görünür
    const g = { ...last.graph, name: this.workshopDesignName() };
    try {
      setSlotGraph('workshop', g, store.buildOptions(last.graph));
    } catch {
      setSlotBuilt('workshop', last.built);
    }
    this.leaveWorkshop();
    this.mode = 'sandbox';
    this.setEngine('workshop', false, { effects: true });
    this.sim.reset();
    this.source = 'workshop';
    store.setTesting(true);
    this.openSandbox({ from: 'workshop' });
    this.sandboxPanel.refreshEngine();
  }

  /** Test kancası (§6.10): window.__app.workshop */
  get workshop(): WorkshopHook {
    const app = this;
    const store = this.wsStore;
    return {
      store,
      current: () => store.state.last,
      handles: () => app.wsHandles?.handles() ?? [],
      get idle() {
        return store.idle && !app.visualDraft;
      },
      get lastBuildMs() {
        return Math.max(store.lastBuildMs, app.wsBuildMs);
      },
      flush: async () => {
        store.flush();
        // Bekleyen tam ayrıntı modeli hemen
        if (app.visualDraft && app.visual.slot === 'workshop') {
          clearTimeout(app.fullDetailTimer);
          app.rebuildVisual('workshop');
        }
        const n = app.framesRendered;
        const t0 = performance.now();
        while (app.framesRendered <= n + 1 && performance.now() - t0 < 5000) await new Promise((r) => requestAnimationFrame(() => r(null)));
        app.refreshWorkshop();
      },
    };
  }

  /**
   * Başka bir motora (yuvaya) geçer: simülasyonu yeniden boyutlandırır, 3B
   * modeli değiştirir, gaz kolu kademelerini ve kesit durumunu yeniden
   * kurar. `idle` ile yeni motor rölantide çalışır halde gelir. Aynı yuvada
   * aynı tasarım (rev) aynı görsel seçeneklerle (efektler, tam ayrıntı)
   * zaten kuruluysa yeniden kurmaz; `idle` iken sönmüş motoru rölantiye
   * getirir. Yuvanın tasarımı yoksa ATAR ve hiçbir şey değişmez.
   */
  setEngine(slot: SlotId, idle: boolean, opts: { effects?: boolean } = {}) {
    const effects = opts.effects ?? true;
    // Bekleyen tam ayrıntı üretimi başka bir yuvanın modelini getirmesin
    clearTimeout(this.fullDetailTimer);
    if (
      this.slot === slot &&
      this.visual.slot === slot &&
      // rev yalnız grafiği tanır; aynı grafik başka seçeneklerle (kademe
      // histerezisi, referans) farklı motor olabilir: nesne kimliği
      this.visual.source.built === builtFor(slot) &&
      this.visualEffects === effects &&
      !this.visualDraft
    ) {
      if (idle && !this.sim.lit) {
        this.autoStart = false;
        this.sim.trim(0, 30);
      }
      return;
    }
    // Önce tasarım ve görsel kaynak: hata burada atılır, durum değişmez
    const design = designFor(slot);
    const src = visualSourceFor(slot);
    this.sim.setDesign(design);
    this.slot = slot;
    if (idle) this.sim.trim(0, 30);
    this.autoStart = false;
    // Arayüz (gaz kolu, EICAS, açılar) installVisual → applyEngineUi ile;
    // eski açı takımı yeniden kadraj kararı için (açıları değiştirir)
    const viewsBefore = this.rig.overrides;
    this.installVisual(src, { effects });
    this.setCutaway(this.cutaway);
    this.stickyHighlight = null;
    this.stepHighlight = null;
    this.sandboxPanel.refreshEngine();
    // Yeni motor farklı boyda: motora bağlı bir açıdaysak (eski ya da yeni
    // takımda) yeniden kadrajla
    const cur = this.rig.current;
    if (this.mode !== 'menu' && needsReframe(cur, viewsBefore, this.rig.overrides)) this.rig.go(cur);
  }

  /**
   * Atölye kancası: bir yuvanın tasarımını değiştirir, simülasyonu ve 3B
   * modeli yeniden kurar. Simülasyon başka yuvadaysa o yuvaya geçer
   * (setEngine, soğuk motor); aynı yuvada çalışan motor sönmez.
   *
   * `src`: modül grafiği (opts'taki BuildOptions ile üretilir), atölye
   * mağazasının zaten ürettiği BuiltEngine (yeniden üretilmeden yuvaya
   * yazılır: sayılar ve model aynı tasarımı gösterir) ya da null (kind
   * yuvası şablona döner, workshop boşalır).
   *
   * `detail` 'draft' (ya da true) iken (kaydırıcı sürüklenirken) model düşük
   * ayrıntıyla hemen üretilir; son değişiklikten 250 ms sonra seçili
   * kalitede yeniden üretilir. `opts.effects` false: parçacık/alev kapalı
   * (atölye); verilmezse yuvanın görseli neyse o kalır. Geçersiz grafikte
   * hata atar, eski tasarım kalır.
   */
  applyDesign(
    slot: SlotId,
    src: EngineGraph | BuiltEngine | null,
    detail: 'draft' | 'full' | boolean = 'full',
    opts: BuildOptions & { effects?: boolean } = {},
  ) {
    const { effects, ...build } = opts;
    const draft = detail === true || detail === 'draft';
    const prev = builtFor(slot);
    const built = src && isBuiltEngine(src) ? setSlotBuilt(slot, src) : setSlotGraph(slot, src, build);
    if (!built) return;
    // Simülasyon bu yuvada mı: App.slot ya da yuvanın önceki tasarımı
    // doğrudan sim.setDesign ile kurulmuş (CLAUDE.md kayıt tarifi)
    const onSlot = this.slot === slot || (prev !== undefined && this.sim.eng.design === prev.design);
    if (!onSlot) {
      // Simülasyon başka yuvada: model tek başına değişirse sahnedeki motor
      // başka motorun devir/EGT'siyle oynatılırdı. Bu yuvaya geçilir (soğuk).
      this.setEngine(slot, false, { effects: effects ?? true });
      return;
    }
    this.slot = slot;
    // Çalışan motor sönmesin: aynı gaz kolunda yeni tasarımla dengelenir
    const lit = this.sim.lit;
    const throttle = this.sim.controls.throttle;
    this.sim.setDesign(built.design);
    if (lit) this.sim.trim(throttle, 10);
    this.sandboxPanel.refreshEngine();
    clearTimeout(this.fullDetailTimer);
    this.rebuildVisual(slot, { effects, draft });
    if (this.visualDraft) {
      // Tam ayrıntı yalnız o yuvanın taslak modeli hâlâ sahnedeyse
      this.fullDetailTimer = setTimeout(() => {
        if (this.visual.slot === slot && this.visualDraft) this.rebuildVisual(slot);
      }, 250);
    }
  }
  private fullDetailTimer: ReturnType<typeof setTimeout> | undefined;
  /** Sahnedeki modelin seçenekleri (setEngine erken dönüşü ve yeniden üretim için) */
  private visualEffects = true;
  private visualDraft = false;

  /**
   * 3B motor modelini (aynı ya da başka yuva) yuvanın güncel tasarımından
   * yeniden üretir. Kayıt ve ölçüm betikleri de çağırır (`rebuildVisual(kind)`).
   * `effects` verilmezse aynı yuvada eski seçenek korunur, başka yuvada
   * açık; `draft` düşük ayrıntılı taslak üretir (kalite 'low' değilse).
   * Simülasyon zaten bu yuvanın tasarımındaysa (kayıt tarifi: sim.setDesign
   * + rebuildVisual) App.slot da bu yuvaya geçer.
   */
  rebuildVisual(slot: SlotId = this.visual.slot, opts: { effects?: boolean; draft?: boolean } = {}) {
    const src = visualSourceFor(slot);
    const effects = opts.effects ?? (slot === this.visual.slot ? this.visualEffects : true);
    this.installVisual(src, { effects, draft: opts.draft });
    if (slot !== this.slot && this.sim.eng.design === src.built.design) this.slot = slot;
  }

  /** Yeni modeli kurar, eskisini sahneden alıp atılmak üzere sıraya koyar */
  private installVisual(src: VisualSource, opts: { effects: boolean; draft?: boolean }) {
    const draft = !!opts.draft && this.settings.quality !== 'low';
    // Önce yeni model: üretim hata atarsa sahnede eski model kalır
    if (draft) setDetail('low');
    let next: EngineVisual;
    try {
      next = new EngineVisual(this.materials, src, { effects: opts.effects });
    } finally {
      if (draft) setDetail(this.settings.quality);
    }
    this.scene.remove(this.visual.root);
    // Eski model, yeni model en az bir kez çizildikten sonra atılır: parça
    // malzemesi klonları aynı shader programlarını paylaşır; önce atılırsa
    // programların kullanım sayısı sıfıra düşer, three.js onları siler ve
    // sonraki karede hepsini (turbofanda ~60 program) baştan derlerdi
    this.disposeQueue.push(this.visual);
    this.visual = next;
    this.visualEffects = opts.effects;
    this.visualDraft = draft;
    this.visual.setGround(this.floorY, this.envName === TEST_CELL);
    this.scene.add(this.visual.root);
    this.picker.visual = this.visual;
    if (this.cutaway) this.setCutaway(true);
    this.applyEngineUi(src);
  }

  /**
   * Arayüzü sahnedeki motorun türetilmiş tipine (traits) göre kurar: gaz
   * kolu kademeleri, EICAS ve diyagram düzeni, ses girdisi, kamera açıları
   * ve seçicideki adlar. Her model kurulumunda çağrılır (setEngine,
   * applyDesign, kayıt betiklerinin rebuildVisual'ı).
   */
  private applyEngineUi(src: VisualSource) {
    const t = src.traits;
    const d = src.built.design;
    this.cockpit.setEngine(d, t);
    this.eicas.setEngine(t);
    this.diagram.setEngine(t);
    // Ses: önden duyulan rotor tasarımdan; turboşaftta önde fan yok, HPC
    const gas = src.built.flowpath.gas;
    const shaft = t.output === 'shaft';
    this.audioEngine = {
      output: t.output,
      fanBlades: shaft ? gas.hpc.blades[0] : d.fanBlades,
      fanDiameter: shaft ? 2 * gas.hpc.tip[0] : d.fanDiameter,
      turbineBlades: gas.lpt.blades[1],
    };
    // Atölyede açılar aynı sunum tipinin şablon motorundan ölçeklenir ve
    // test hücresine sığdırılır (büyük motor: yakın kamera, geniş açı)
    const ref = src.slot === 'workshop' ? builtFor(t.presentation) : undefined;
    const views = viewsFor(src, ref && { layout: ref.flowpath.layout, built: ref }, { bounds: CELL_BOUNDS, maxDistance: 18 });
    this.rig.overrides = views;
    const names = (Object.keys(VIEWS) as ViewName[]).filter((v) => v !== 'menu');
    names.forEach((v, i) => {
      const opt = this.viewSelect.options[i];
      if (opt) opt.text = `${i + 1} · ${(views[v] ?? VIEWS[v]).label}`;
    });
  }
  /** Ses modelinin motor sabitleri (applyEngineUi kurar) */
  private audioEngine: AudioEngine = { output: 'thrust', fanBlades: 22, fanDiameter: 2.77 };

  openGlossary(id?: string) {
    this.openOverlay(glossaryModal(() => this.afterModal(), id));
  }

  openSettings() {
    this.openOverlay(
      settingsModal(
        this.settings,
        this.environmentNames(),
        this.envName,
        {
          onQuality: (q) => {
            this.settings.quality = q;
            this.applyQuality(q);
            saveSettings(this.settings);
            // Kit parçalarının detay seviyesi değişti: model yeniden üretilir
            setDetail(q);
            this.rebuildVisual();
          },
          onVolume: (v) => {
            this.settings.volume = v;
            this.audio.volume = v;
            saveSettings(this.settings);
          },
          onMute: (m) => {
            this.settings.muted = m;
            this.audio.muted = m;
            saveSettings(this.settings);
            this.refreshChrome();
          },
          onEnvironment: (name) => {
            this.applyEnvironment(name);
            this.settings.environment = name;
            saveSettings(this.settings);
          },
        },
        () => this.afterModal(),
      ),
    );
  }

  private environmentNames(): string[] {
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
  private applyEnvironment(name: string) {
    const env = this.env;
    const inCell = name === TEST_CELL && !!this.cell;
    const hasAirfield = !!this.airfield;
    const sky = !inCell && hasAirfield && name in HDRI_PRESETS;
    const night = !inCell && hasAirfield && name === AIRFIELD_NIGHT;
    const legacy = !inCell && !hasAirfield && name in PRESETS;
    this.envName = inCell || sky || night || legacy ? name : hasAirfield ? AIRFIELD_DEFAULT : 'Altın saat';
    // Yağmur yalnız açık havada ve yağmurlu ortamda
    weather.rain = sky ? ((HDRI_PRESETS as Record<string, { rain?: number }>)[this.envName]?.rain ?? 0) : 0;
    // Ortam seçilince zemin hemen o havaya uygun (ıslak/kuru) başlar
    wetUniforms.uWet.value = weather.rain;
    const outdoorAirfield = !inCell && hasAirfield;
    if (this.cell) this.cell.root.visible = inCell;
    if (this.airfield) {
      this.airfield.root.visible = outdoorAirfield;
      this.airfield.setNight(this.envName === AIRFIELD_NIGHT);
    }
    env.sky.visible = !inCell && !(outdoorAirfield && this.envName !== AIRFIELD_NIGHT);
    env.ground.visible = !inCell && !outdoorAirfield;
    this.rig.bounds = inCell ? CELL_BOUNDS : null;
    this.rig.controls.maxDistance = inCell ? 18 : 40;
    this.floorY = outdoorAirfield ? this.airfield!.floorY : -3.35;
    this.visual.setGround(this.floorY, inCell);
    // Ortam kapanması yarıçapı: hücrede motor ayrıntısı, dışarıda yapılar ve donanım
    this.fx?.gtao.updateGtaoMaterial({ radius: inCell ? 0.32 : 0.75, thickness: inCell ? 0.6 : 1.2 });
    const capture = () => env.captureEnvironment([this.visual.root]);
    if (outdoorAirfield && this.envName !== AIRFIELD_NIGHT) {
      this.scene.environmentIntensity = 1;
      // Gökyüzü yüklenirken de ortam hazır değil (yarım ortam çizilmesin;
      // kayıt araçları envPending'i bekler). Eski bir derlemenin bitişi
      // bayrağı erken indirmesin diye sıra numarası da ilerler.
      this.envSerial++;
      this.envPending = true;
      env
        .setHdri(this.envName)
        .then((ok: boolean) => {
          if (ok) capture();
          this.precompile();
        })
        .catch((err: unknown) => {
          console.error('Gökyüzü yüklenemedi', err);
          this.applyEnvironment(AIRFIELD_NIGHT);
        });
      return;
    }
    env.clearHdri();
    if (!inCell) {
      // Hücre ışığı kısılmışsa açık hava ortam ışığı etkilenmesin
      this.scene.environmentIntensity = 1;
      env.setPreset(this.envName === AIRFIELD_NIGHT ? 'Gece apronu' : this.envName);
      if (outdoorAirfield) capture();
      this.precompile();
      return;
    }
    const cell = this.cell!;
    this.scene.environment = cell.envMap;
    this.scene.background = new THREE.Color(0x040506);
    if (this.scene.fog) (this.scene.fog as THREE.FogExp2).density = 0;
    // Tavandaki armatür sırasının hemen altından, hafif önden gelen ana ışık (gölgeli)
    env.sun.visible = true;
    env.sun.color.setHex(0xfff3e6);
    env.sun.intensity = 2.4;
    env.sun.position.set(2.5, 14, -3.5);
    env.sun.target.position.set(0, 0, 0.3);
    env.ambient.intensity = 0.12;
    env.keyPanel.color.setHex(0xf2f5ff);
    env.keyPanel.intensity = 2.2;
    env.keyPanel.position.set(-4.5, 7.6, -1.5);
    env.keyPanel.lookAt(0, 0, 0.3);
    env.rimPanel.color.setHex(0xfff0e0);
    env.rimPanel.intensity = 1.6;
    env.rimPanel.position.set(4.5, 7.6, 3);
    env.rimPanel.lookAt(0, 0, 0.5);
    this.renderer.toneMappingExposure = 0.95;
    this.setLights(this.lightLevel);
    this.precompile();
  }

  /**
   * Hücre ışıklarını kısar ya da kapatır. Gece modunda motoru aydınlatan
   * yalnızca kendi kor parçaları, alevi ve kontrol odası ışığıdır.
   */
  setLights(level: number) {
    this.lightLevel = level;
    if (!this.cell || this.envName !== TEST_CELL) return;
    const env = this.env;
    const k = Math.max(0, Math.min(1, level));
    setCellLights(this.cell, k);
    env.sun.intensity = 2.4 * k;
    env.keyPanel.intensity = 2.2 * k;
    env.rimPanel.intensity = 1.6 * k;
    env.ambient.intensity = 0.12 * k + 0.015;
    this.scene.environmentIntensity = 0.06 + 0.94 * k;
    // Karanlıkta göz uyum sağlar: pozlama biraz artar
    this.renderer.toneMappingExposure = 0.95 * (1 + 0.6 * (1 - k));
  }

  private afterModal() {
    if (this.mode === 'menu') this.showMenu();
    else this.closeOverlay();
  }

  private toggleMute() {
    this.audio.resume();
    this.settings.muted = !this.audio.muted;
    this.audio.muted = this.settings.muted;
    saveSettings(this.settings);
    this.refreshChrome();
  }

  /* ================================================================ */
  /* Ders arayüzü bağlantıları                                        */
  /* ================================================================ */

  private applyStepUi(ui: StepUi | undefined) {
    const u = ui ?? {};
    if (u.cutaway !== undefined) this.setCutaway(u.cutaway);
    if (u.view) {
      this.rig.go(u.view);
      this.viewSelect.value = u.view;
    }
    this.stepHighlight = u.highlight ?? null;
    if (u.diagram !== undefined) this.diagramVisible = u.diagram;
    if (u.cockpit !== undefined) this.consoleVisible = u.cockpit;
    if (u.switches) {
      for (const id of ALL_SWITCHES) this.cockpit.setSwitchVisible(id, u.switches.includes(id));
    }
    this.cockpit.lockThrottle(!!u.throttleLocked);
    this.refreshChrome();
  }

  private setPickMode(active: boolean) {
    this.pickMode = active;
    this.picker.showLabels = !active;
    if (!active) this.stepHighlight = this.runner?.step.ui?.highlight ?? null;
  }

  private onPick(part: PartId) {
    if (this.runner && this.pickMode) {
      this.runner.pick(part, PARTS[part].name);
      return;
    }
    if (this.mode === 'menu') return;
    this.stickyHighlight = this.stickyHighlight === part ? null : part;
  }

  private hoverPart: PartId | null = null;
  private onHover(part: PartId | null) {
    this.hoverPart = part;
  }

  /* ================================================================ */
  /* Simülasyon olayları                                              */
  /* ================================================================ */

  private onSimEvent(e: SimEvent) {
    this.runner?.onEvent(e);
    if (e.type === 'surge') this.audio.bang(1);
    if (e.type === 'torching') this.audio.whoomp(1.2);
    if (e.type === 'lightoff') this.audio.whoomp(0.35);
    if (e.type === 'abLight') this.audio.whoomp(0.9);
    if (e.type === 'birdStrike') this.audio.bang(0.7);
    if (this.mode === 'menu') return;
    // Bilgi olayları derste panelde zaten anlatılıyor; uyarılar her zaman görünür
    if (e.severity === 'info' && this.mode === 'lesson' && e.type !== 'starterCutout') return;
    this.toasts.show(e.message, e.severity);
  }

  private beginAutoStart() {
    this.audio.resume();
    if (this.sim.lit) {
      this.toasts.show('Motor zaten çalışıyor.', 'info');
      return;
    }
    Object.assign(this.sim.controls, {
      apuBleed: true,
      ignition: true,
      starter: true,
      fuelRun: false,
      fadec: 'normal',
      throttle: 0,
    });
    this.autoStart = true;
    this.toasts.show('Otomatik çalıştırma: APU BLEED, ateşleme ve marş açıldı; %22 N2\'de yakıt verilecek.', 'info', 5000);
  }

  private updateAutoStart() {
    if (!this.autoStart) return;
    const c = this.sim.controls;
    const L = this.sim.limits;
    if (!c.fuelRun && this.sim.N2 >= L.fuelOnMinN2 + 0.02) c.fuelRun = true;
    if (this.sim.phase === 'running' && this.sim.N2 > L.idleN2 - 0.02) {
      c.apuBleed = false;
      c.ignition = false;
      this.autoStart = false;
    }
    if (!c.starter && !this.sim.lit && this.sim.N2 < 0.3) this.autoStart = false;
  }

  /* ================================================================ */
  /* Girdi                                                            */
  /* ================================================================ */

  private onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    if (e.key === 'Escape') {
      if (this.overlay && this.mode !== 'menu') this.closeOverlay();
      else if (this.mode !== 'menu') this.showMenu();
      return;
    }
    if (this.mode === 'menu' || this.overlay) return;
    const k = e.key.toLowerCase();
    const fine = e.shiftKey ? 0.005 : 0.02;
    if (k === 'w' || e.key === 'ArrowUp') this.cockpit.nudge(fine);
    else if (k === 's' || e.key === 'ArrowDown') this.cockpit.nudge(-fine);
    else if (e.key === 'PageUp') this.cockpit.setThrottleTo(1);
    else if (k === 'b') this.cockpit.setThrottleTo(this.sim.controls.reheat > 0 ? 1 : 1.3);
    else if (e.key === 'PageDown') this.cockpit.setThrottleTo(0);
    else if (k === 'c') this.setCutaway(!this.cutaway);
    else if (k === 'd') this.setDiagram(!this.diagramVisible);
    else if (k === 'm') this.toggleMute();
    else if (k === 'h') {
      document.body.classList.toggle('ui-hidden');
      this.layout();
    }
    else if (/^[1-8]$/.test(k)) {
      const views = (Object.keys(VIEWS) as ViewName[]).filter((v) => v !== 'menu');
      const v = views[Number(k) - 1];
      if (v) {
        this.rig.go(v);
        this.viewSelect.value = v;
      }
    } else return;
    e.preventDefault();
  }

  /* ================================================================ */
  /* Kalite ve boyut                                                  */
  /* ================================================================ */

  applyQuality(q: Settings['quality']) {
    const p = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
    const sun = this.env.sun;
    if (sun.shadow.mapSize.x !== p.shadow) {
      sun.shadow.mapSize.set(p.shadow, p.shadow);
      sun.shadow.map?.dispose();
      (sun.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    this.fx.gtao.enabled = p.gtao;
    this.rain.setDensity(q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1);
    this.fx.bloom.enabled = p.bloom;
    this.resize();
  }

  private resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.renderer.setSize(w, hgt);
    this.fx.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.fx.composer.setSize(w, hgt);
    this.fx.grade.uniforms.uAspect.value = w / hgt;
    this.rig.resize(w, hgt);
    this.layout();
  }

  /* ================================================================ */
  /* Döngü                                                            */
  /* ================================================================ */

  /**
   * Test kancası: çizim yapmadan simülasyonu ve ders mantığını ileri sarar.
   * Otomatik oynanış testleri yazılım rasterleştiricide saniyelerce süren
   * kareleri beklemeden ders akışlarını doğrulamak için kullanır.
   */
  advance(seconds: number, dt = 1 / 30) {
    for (let t = 0; t < seconds; t += dt) {
      this.sim.step(dt * (this.mode === 'sandbox' ? this.timeScale : 1));
      this.updateAutoStart();
      const snap = this.sim.snapshot();
      this.visual.update(snap, dt, this.rig.camera);
      this.runner?.update(dt, snap);
      this.rig.update(dt, 0);
      if (this.cutaway) this.aimCutaway();
    }
    const snap = this.sim.snapshot();
    if (this.consoleVisible) this.cockpit.update(snap);
    if (this.diagramVisible) this.diagram.update(snap, 0, true);
  }

  /**
   * Test kancası: sabit adımlı kare yakalama (GIF/video). fixedDt ayarlıyken
   * her kare simülasyonu tam fixedDt ilerletir ve yalnız pendingSteps > 0
   * iken çizilir; yazılım rasterleştiricide bile belirlenimli kayıt verir.
   */
  fixedDt: number | null = null;
  pendingSteps = 0;
  framesRendered = 0;
  /**
   * Kare kancaları (M5a P9): atölyenin 3B yardımcıları (tutamaçlar, hayalet,
   * ölçek figürü, zarf kutusu; src/app/workshop) kamera bu karenin son
   * konumundayken, çizimden hemen önce güncellenir. Atölye modu (P10)
   * girişte ekler, çıkışta siler.
   */
  readonly frameHooks = new Set<(dt: number) => void>();

  private frame(now: number) {
    requestAnimationFrame(this.frame);
    let dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (this.fixedDt !== null) {
      if (this.pendingSteps <= 0) return;
      this.pendingSteps--;
      dt = this.fixedDt;
    }
    const simDt = dt * (this.mode === 'sandbox' ? this.timeScale : 1);

    this.sim.step(simDt);
    this.updateAutoStart();
    const snap = this.sim.snapshot();

    this.visual.update(snap, simDt, this.rig.camera);
    this.runner?.update(dt, snap);

    // Vurgulama önceliği: seçme modunda fare altındaki parça, sonra ders, sonra kullanıcı seçimi
    const hl = this.pickMode
      ? this.hoverPart
      : this.hoverPart && this.diagramVisible && this.mode !== 'menu' && !this.stepHighlight
        ? this.hoverPart
        : this.stepHighlight ?? this.stickyHighlight;
    this.visual.highlight(hl);

    if (this.mode !== 'menu') {
      if (this.consoleVisible) {
        this.cockpit.update(snap);
        this.eicas.draw(snap, dt);
      }
      if (this.diagramVisible) this.diagram.update(snap, dt);
      if (this.runner) this.cockpit.flash(this.runner.flash(snap));
      if (this.mode === 'sandbox') {
        this.sandboxAcc += dt;
        if (this.sandboxAcc > 0.2) {
          this.sandboxAcc = 0;
          this.sandboxPanel.update();
        }
      }
    }

    // Ses: kamera önde mi arkada mı?
    const cam = this.rig.camera.position;
    const dist = cam.length();
    this.audio.update(
      snap,
      this.audioEngine,
      -cam.z / Math.max(dist, 1e-3),
      THREE.MathUtils.clamp(1 - (dist - 3) / 16, 0, 1),
      this.sim.eng.point.thrust,
    );

    // Art yakıcı zonlarının tutuşma darbeleri
    const ze = this.visual.abZoneEvents;
    if (ze > this.lastZoneEvents) this.audio.whoomp(0.28);
    this.lastZoneEvents = ze;

    this.picker.update();
    if (this.airfield?.root.visible) this.airfield.update(dt);
    this.rig.update(dt, this.visual.shake);
    updateWeather(simDt);
    this.rain.update(simDt, this.rig.camera, this.floorY);
    if (this.cutaway) this.aimCutaway();
    for (const f of this.frameHooks) f(dt);
    this.updateHaze(snap, dt);
    if (!this.envPending) {
      this.fx.composer.render(dt);
      // Yeni model çizildi: eski modeller artık güvenle atılabilir
      if (this.disposeQueue.length) for (const v of this.disposeQueue.splice(0)) v.dispose();
    }
    this.framesRendered++;
  }
  private disposeQueue: EngineVisual[] = [];

  /** Sahnedeki tüm görünür malzemeleri derler; bitene kadar çizim bekler */
  private precompile() {
    const serial = ++this.envSerial;
    this.envPending = true;
    const done = () => {
      if (serial === this.envSerial) this.envPending = false;
    };
    this.renderer.compileAsync(this.scene, this.rig.camera).then(done, done);
  }

  private updateHaze(snap: ReturnType<EngineSim['snapshot']>, dt: number) {
    const cam = this.rig.camera;
    const ex = this.visual.exhaustExit;
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
