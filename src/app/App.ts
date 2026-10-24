/**
 * Uygulama çekirdeği: renderer, sahne, simülasyon, ses ve arayüzü bir araya
 * getirir; modlar (menü / ders / test hücresi) arasında geçişi yönetir.
 */

import * as THREE from 'three';
import { EngineAudio, type AudioEngine } from '../audio/EngineAudio';
import { CELL_BOUNDS } from '../core/testCell';
import { EngineVisual, type PartId } from '../engine/visual';
import { LessonRunner, type LessonResult } from '../game/LessonRunner';
import { LESSONS } from '../game/lessons';
import type { Lesson, StepUi } from '../game/lessons/types';
import { PARTS } from '../game/parts';
import { loadProgress, loadSettings, saveLessonResult, saveSettings, type Settings } from '../game/progress';
import { createMaterials } from '../materials/library.js';
import { loadKit, setKitQuality } from '../engine/kit.js';
import { setBladeQuality } from '../engine/blades.js';
import { retainDetails, setDetailTag } from '../engine/buildCache.js';
import { builtFor, designFor, setSlotBuilt, setSlotGraph, type SlotId } from '../design/catalog';
import { focusOnCanvas, keyOwnedByTarget, plainKey } from './workshop/keys';
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
import { getExposure } from '../core/exposure';
import { Rain } from '../core/rain';
import { updateWeather } from '../core/weather';
import { loadScans } from '../materials/scans.js';
import { loadPanelDetails } from '../materials/textures.js';
import { EngineSim, type SimEvent } from '../sim';
import { AutoStart, type AutoStartStep } from '../sim/autostart';
import { EventBus, type AppEventType, type GameEventListener, type GameEventType } from './events';
import { advanceUntil, type WaitResult, type WaitTarget } from './waitFor';
import { Cockpit, type SwitchId } from '../ui/Cockpit';
import { CycleDiagram } from '../ui/CycleDiagram';
import { h, icon } from '../ui/dom';
import { Eicas } from '../ui/Eicas';
import { LessonPanel } from '../ui/LessonPanel';
import { glossaryModal, lessonSelect, mainMenu, resultModal, settingsModal } from '../ui/Menus';
import { SandboxPanel } from '../ui/SandboxPanel';
import { Toasts } from '../ui/Toasts';
import { CameraRig, VIEWS, viewsFor, type CameraView, type ViewName } from './CameraRig';
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
import { RenderPipeline, type PostFx } from './render/RenderPipeline';
import { EnvironmentManager, TEST_CELL, type LoadStep } from './render/EnvironmentManager';
import { QUALITY } from './render/quality';
import { ModeController, type Mode } from './modes/ModeController';
import { emitLoadProgress, type LoadStage } from './loadProgress';

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
/** Otomatik çalıştırma adımı → oyun olayı */
const AUTOSTART_EVENTS: Record<AutoStartStep, [AppEventType, string]> = {
  fuel: ['autoStartFuel', 'Otomatik çalıştırma: yakıt verildi.'],
  done: ['autoStartDone', 'Otomatik çalıştırma bitti: APU BLEED ve ateşleme kapandı.'],
  abort: ['autoStartAbort', 'Otomatik çalıştırma bırakıldı: motor yanmadı.'],
};
/** Uyarıdaki "Parçayı göster" vurgusunun süresi [ms] */
const WS_SHOW_PART_MS = 2500;

/** Yükleme aşaması: metin + loadProgress olayı, sonra iki kare bekler (ekran güncellensin) */
const step = (onText: (t: string) => void, text: string, stage: LoadStage) =>
  new Promise<void>((resolve) => {
    onText(text);
    emitLoadProgress(stage, text);
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

export class App {
  renderer!: THREE.WebGLRenderer;
  /** Çizim hattı: renderer, post zinciri, kalite, ön-derleme (src/app/render) */
  pipeline!: RenderPipeline;
  /** Ortamlar: gökyüzü/ışık, test hücresi, havaalanı, geçişler (src/app/render) */
  environment!: EnvironmentManager;
  /** Kip ve kip değişimi bildirimi (`modes.onChange`) */
  readonly modes = new ModeController('menu');
  scene = new THREE.Scene();
  rig!: CameraRig;
  sim = new EngineSim();
  /** Simülasyondaki ve sahnedeki motorun yuvası (kind yuvası ya da 'workshop') */
  slot: SlotId = 'turbofan';
  visual!: EngineVisual;
  audio = new EngineAudio();
  get mode(): Mode {
    return this.modes.current;
  }
  set mode(m: Mode) {
    this.modes.set(m);
  }
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
  /** wsHover'ın kurulduğu andaki seçim ve bitiş zamanı (kısa süreli vurgu) */
  private wsHoverSel: string | null = null;
  private wsHoverUntil = Infinity;
  /** Atölyeden ya da test edilen tasarımdan çıkınca dönülecek katalog yuvası */
  private catalogSlot: Exclude<SlotId, 'workshop'> = 'turbofan';
  /** Açık atölye başlangıç ekranı (Esc ile kapanınca tasarım sahneye konur) */
  private wsStartEl: HTMLElement | null = null;
  /** Ders bitince/çıkınca dönülecek mod */
  private returnTo: 'workshop' | null = null;
  private wsHook = (dt: number) => this.workshopFrame(dt);

  private materials!: ReturnType<typeof createMaterials>;
  /** Post zinciri (pipeline.fx; kayıt betikleri `app.fx` okur) */
  private fx!: PostFx;
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
  get lightLevel(): number {
    return this.environment.lightLevel;
  }
  private cutaway = false;
  private lastZoneEvents = 0;
  private rain = new Rain();
  private diagramVisible = false;
  private consoleVisible = false;
  private pickMode = false;
  private stickyHighlight: PartId | null = null;
  private stepHighlight: PartId | null = null;
  /** Otomatik çalıştırma sırası (src/sim/autostart.ts) */
  private autoStarter = new AutoStart();
  /** Otomatik çalıştırma sürüyor mu (kayıt betikleri `app.autoStart = false` ile keser) */
  get autoStart(): boolean {
    return this.autoStarter.active;
  }
  set autoStart(v: boolean) {
    this.autoStarter.active = v;
  }
  /** Oyun olayı akışı: sim olayları + uygulama olayları (`onSimEvent`) */
  private bus = new EventBus();
  private settings: Settings;
  /**
   * Ortam değişiminde yeni shader'lar derlenirken true: bu sürede kare
   * çizilmez, ekranda önceki kare kalır (EnvironmentManager.pending).
   */
  get envPending(): boolean {
    return this.environment?.pending ?? false;
  }
  /** Ortam derleme sıra numarası (kayıt araçları artışını bekler) */
  get envSerial(): number {
    return this.environment?.serial ?? 0;
  }
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
  }

  /**
   * Yükler ve ilk kareyi ister. İlerleme `loadProgress` olayıyla yayılır
   * (src/app/loadProgress.ts; yükleme ekranı onu çizer); `onProgress`
   * yalnız metni isteyenler için.
   */
  async init(onProgress: (t: string) => void = () => {}) {
    /* ---------------- renderer ---------------- */
    this.pipeline = new RenderPipeline(this.container);
    const renderer = this.pipeline.renderer;
    this.renderer = renderer;

    this.rig = new CameraRig(renderer.domElement);
    this.rig.onCutaway = (on) => this.setCutaway(on);
    this.environment = new EnvironmentManager(
      {
        scene: this.scene,
        renderer,
        rig: this.rig,
        visualRoot: () => this.visual.root,
        setGround: (y, inCell) => this.visual.setGround(y, inCell),
        setAoScale: (inCell) => this.pipeline.setAoScale(inCell),
        compile: () => this.pipeline.compile(this.scene, this.rig.camera),
      },
      this.settings.environment,
    );
    const loadStep: LoadStep = (stage, label) => step(onProgress, label, stage);

    await step(onProgress, 'Yüzey dokuları üretiliyor…', 'textures');
    const details = await loadPanelDetails().catch((err) => {
      console.error('Panel detay dokuları yüklenemedi', err);
      return null;
    });
    await step(onProgress, 'Donanım parçaları yükleniyor…', 'kit');
    setDetail(this.settings.quality);
    const kitTex = await loadKit(renderer).catch((err) => {
      console.error('Kit parçaları yüklenemedi', err);
      return null;
    });
    await step(onProgress, 'Malzeme taramaları yükleniyor…', 'scans');
    const scans = await loadScans(renderer).catch((err) => {
      console.error('Malzeme taramaları yüklenemedi', err);
      return null;
    });
    const materials = createMaterials(renderer, details, kitTex, scans);
    this.materials = materials;

    await step(onProgress, 'Gökyüzü ve ortam ışığı hesaplanıyor…', 'environment');
    this.environment.create(materials);
    this.environment.lights.add('cutFill', this.cutFill);

    await this.environment.loadCell(loadStep);
    await this.environment.loadAirfield(loadStep, scans, this.rig.camera);

    await step(onProgress, 'Motor geometrisi oluşturuluyor…', 'engine');
    this.visual = new EngineVisual(materials, visualSourceFor(this.slot));
    this.scene.add(this.visual.root);
    this.scene.add(this.cutFill);
    this.scene.add(this.rain.mesh);

    await step(onProgress, 'Termodinamik model dengeleniyor…', 'sim');
    this.sim.trim(0);
    this.sim.on((e) => this.handleSimEvent(e));

    await step(onProgress, 'Görüntü işleme zinciri kuruluyor…', 'post');
    this.fx = this.pipeline.createPost(this.scene, this.rig.camera);

    this.picker = new Picker(renderer.domElement, this.rig.camera, this.visual);
    this.picker.onPick = (p) => this.onPick(p);
    this.picker.onHover = (p) => this.onHover(p);
    this.picker.onFocus = (p, point) => {
      if (this.mode === 'menu' || (this.runner && this.pickMode)) return;
      this.stickyHighlight = p;
      this.rig.focusOn(point);
    };

    this.buildUi();
    this.applyEnvironment(this.environment.name);
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
    emitLoadProgress('ready', 'Hazır');
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
      // Katalog motoru seçmek atölye tasarımından çıkar (§6.9)
      onEngine: (slot) => {
        this.source = 'catalog';
        if (slot !== 'workshop') this.catalogSlot = slot;
        this.setEngine(slot, true);
      },
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
      onHighlight: (tags, transient) => {
        this.wsHover = tags ? (tags as PartId[]) : null;
        // Uyarıdaki "Parçayı göster" kalıcı olmasın: süre dolunca ya da
        // seçim değişince seçili modülün vurgusu geri gelir
        this.wsHoverSel = this.wsStore.state.selected;
        this.wsHoverUntil = tags && transient ? performance.now() + WS_SHOW_PART_MS : Infinity;
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
        // Ayrıntılı bildirim (mimari değişiminin notları) okunacak kadar kalır; açıkken kapanmaz
        const ms = Math.min(12000, Math.max(4500, 55 * s.notice.text.length + (s.notice.detail ? 3000 : 0)));
        this.toasts.show(s.notice.text, 'info', ms, s.notice.detail);
      }
      this.refreshWorkshop();
    });
    // Görünüm: ölçek figürü anahtarı (§6.7)
    const figBtn = h('button', {
      class: 'btn small ghost active',
      text: '1,8 m',
      title: 'Ölçek figürü (1,8 m insan silueti)',
      attrs: { type: 'button', 'aria-pressed': 'true' },
      on: {
        click: () => {
          this.wsShowFigure = !this.wsShowFigure;
          figBtn.classList.toggle('active', this.wsShowFigure);
          figBtn.setAttribute('aria-pressed', String(this.wsShowFigure));
          this.wsFigure?.setVisible(this.wsShowFigure);
        },
      },
    });
    this.wsPanel.toolbar.append(figBtn);
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
  private wsShowFigure = true;

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
    this.cutFill.intensity = App.CUT_FILL / Math.max(getExposure(this.renderer), 0.05);
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

  /**
   * Mod değişti: önceki modun bildirimleri (test hücresinin sim olayları,
   * "motor rölantide" ipucu) yeni modda ekranda kalmasın.
   */
  private clearToasts() {
    this.toasts.clear();
  }

  showMenu(first = false) {
    if (this.mode === 'workshop') this.leaveWorkshop();
    if (this.mode !== 'menu') this.clearToasts();
    this.returnTo = null;
    this.leaveWorkshopSlot();
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
    this.clearToasts();
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
      // Önce mod (dersin bildirimleri temizlenir), sonra dönüş bildirimi
      this.openWorkshop({ resume: true });
      this.toasts.show(`${r.lesson.title} tamamlandı. Atölyeye dönüldü.`, 'info', 4000);
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
    this.clearToasts();
    this.returnTo = null;
    if (opts.from !== 'workshop') this.leaveWorkshopSlot();
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
    if (this.slot !== 'workshop') this.catalogSlot = this.slot;
    const wasWorkshop = this.mode === 'workshop';
    if (!wasWorkshop) this.clearToasts();
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
    if (!this.environment.inCell && this.environment.cell) this.applyEnvironment(TEST_CELL);
    const cut = this.cutaway;
    this.mirrorWorkshopViews();
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
    const close = () => this.closeWorkshopStart();
    const el = startScreen({
        hasSaved: store.state.project.families.length > 0 || store.hasSaved(),
        onResume: () => {
          this.closeOverlay();
          if (store.state.project.families.length && store.state.phase !== 'start') {
            if (store.state.phase === 'wizard') store.resume();
            this.publishWorkshop();
          } else if (!store.resume()) this.toasts.show('Kayıt okunamadı: yeni bir tasarıma başla.', 'caution');
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
      });
    this.openOverlay(el);
    this.wsStartEl = el;
  }

  /**
   * Başlangıç ekranı kapandı (X ya da Esc): proje yoksa menüye; varsa
   * (edit/sihirbaz) atölye tasarımı sahneye konur — menüden yeniden
   * girilince sahnede katalog motoru duruyordu.
   */
  private closeWorkshopStart() {
    this.closeOverlay();
    const store = this.wsStore;
    const ph = store.state.phase;
    if (ph === 'start') {
      this.showMenu();
      return;
    }
    if (ph === 'testing') store.setTesting(false);
    this.source = 'workshop';
    this.publishWorkshop();
    this.refreshChrome();
    this.refreshWorkshop();
  }

  /** Mağazanın son geçerli tasarımını sahneye koyar (dönüşte); zaten sahnedeyse yeniden kurmaz */
  private publishWorkshop() {
    const last = this.wsStore.state.last;
    if (!last) return;
    if (this.workshopOnScene(last.built)) {
      this.placeWorkshopHelpers();
      return;
    }
    try {
      this.applyDesign('workshop', last.built, 'full', { effects: false });
    } catch (err) {
      console.warn('Atölye tasarımı kurulamadı', err);
    }
    this.placeWorkshopHelpers();
  }

  /** Bu tasarımın atölye modeli (efektsiz, tam ayrıntı) zaten sahnede mi */
  private workshopOnScene(b: BuiltEngine): boolean {
    return this.slot === 'workshop' && this.visual.slot === 'workshop' && this.visual.source.built === b && !this.visualEffects && !this.visualDraft;
  }

  /**
   * Mağaza yeni tasarım üretti: 3B model (taslak/tam), ölçek figürü, zarf.
   * false: model sahneye konmadı (atölye dışında ya da üretim başarısız);
   * mağaza tasarımı gösterilmiş saymaz, sonraki yayında yeniden dener.
   */
  private onWorkshopBuilt(b: BuiltEngine, detail: 'draft' | 'full'): boolean {
    // Çıkış sırasında (leaveWorkshop) yayınlanan model kurulmaz: hemen katalog motoru gelir
    if (this.mode !== 'workshop' || this.wsLeaving) return false;
    this.source = 'workshop';
    // Taslaktan sonra App'in tam ayrıntı zamanlayıcısı (applyDesign) aynı
    // modeli mağazanınkinden önce kurar: tam ayrıntı yayını ikinci kez üretmez
    if (detail === 'full' && this.workshopOnScene(b)) {
      this.placeWorkshopHelpers();
      this.reframeWorkshop();
      return true;
    }
    const t0 = performance.now();
    try {
      this.applyDesign('workshop', b, detail, { effects: false });
    } catch (err) {
      // Değerlendirmeden geçen ama prosedürel modeli kurulamayan tasarım:
      // sayılar geçerli, sahnede önceki model kalır (applyDesign simülasyonu ona döndürür)
      console.warn('Atölye tasarımının 3B modeli kurulamadı', err);
      if (this.wsFailedRev !== b.rev) {
        this.wsFailedRev = b.rev;
        this.toasts.show('Bu tasarımın 3B modeli kurulamadı: sayılar geçerli, sahnede önceki model duruyor.', 'caution', 6000);
      }
      return false;
    }
    this.wsFailedRev = null;
    this.wsBuildMs = performance.now() - t0;
    this.placeWorkshopHelpers();
    if (detail === 'full') this.reframeWorkshop();
    return true;
  }
  private wsBuildMs = 0;
  /** 3B modeli kurulamayan son tasarım (bildirim bir kez) */
  private wsFailedRev: string | null = null;
  /** leaveWorkshop sürüyor: mağaza yayınları sahneye konmaz, paneller yenilenmez */
  private wsLeaving = false;
  /** Son çerçevelenen motor ölçüleri (§6.7: boy/çap %15'ten çok değişince yeniden çerçeve) */
  private wsFramed: { length: number; diameter: number } | null = null;

  private reframeWorkshop(force = false) {
    const s = this.wsStore.state;
    const sm = s.last?.summary;
    if (!sm || s.dragging || this.wsHandles?.dragging) return;
    const f = this.wsFramed;
    const moved = !f || Math.abs(sm.length / f.length - 1) > 0.15 || Math.abs(sm.diameter / f.diameter - 1) > 0.15;
    if (!moved && !force) return;
    this.wsFramed = { length: sm.length, diameter: sm.diameter };
    // Açılar applyEngineUi'de yeni motora göre (aynalı) kuruldu; geçerli açıya uç
    const cut = this.cutaway;
    const cur = this.rig.current === 'menu' ? 'front' : this.rig.current;
    this.rig.go(cur);
    this.setCutaway(cut);
  }

  private placeWorkshopHelpers() {
    const last = this.wsStore.state.last;
    if (!last) return;
    this.wsFigure?.place(last.built, this.environment.floorY);
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
    this.wsFigure.setVisible(this.wsShowFigure);
    this.picker.priority = (x, y) => this.mode === 'workshop' && this.wsHandles?.hitTest(x, y) != null;
    this.frameHooks.add(this.wsHook);
  }

  /**
   * Atölye açıları: her açı x'te aynalanır (kamera motorun öbür yanında),
   * böylece akış (+z) ekranda soldan sağa akar; sağa sürüklemek kompresörü
   * uzatır. Menü açısı aynalanmaz. Çıkışta özgün açılar geri gelir.
   */
  private mirrorWorkshopViews() {
    if (this.rig.overrides === this.wsMirrored) return;
    const base = this.rig.overrides;
    const out: Partial<Record<ViewName, CameraView>> = { menu: base.menu };
    for (const v of Object.keys(VIEWS) as ViewName[]) {
      if (v === 'menu') continue;
      const s: CameraView = base[v] ?? (VIEWS[v] as CameraView);
      out[v] = { ...s, position: [-s.position[0], s.position[1], s.position[2]], target: [-s.target[0], s.target[1], s.target[2]] };
    }
    this.wsViewBase = base;
    this.wsMirrored = out;
    this.rig.overrides = out;
  }
  private wsViewBase: Partial<Record<ViewName, CameraView>> | null = null;
  private wsMirrored: Partial<Record<ViewName, CameraView>> | null = null;

  /**
   * Sahnede/simülasyonda atölye yuvası kaldıysa (atölyenin efektsiz modeli
   * ya da test edilen tasarım) katalog motoruna dönülür: menü arka planı
   * ve menüden açılan test hücresi efektli katalog motoruyla çalışır,
   * seçici gerçek yuvayı gösterir (§6.9 yalıtım). Atölye tasarımı test
   * hücresinde "Atölye tasarımı" düğmesiyle yeniden kurulur.
   */
  private leaveWorkshopSlot() {
    if (this.slot !== 'workshop' && this.visual.slot !== 'workshop') return;
    this.source = 'catalog';
    try {
      this.setEngine(this.catalogSlot, false);
    } catch (err) {
      console.warn('Katalog motoruna dönülemedi', err);
    }
  }

  /**
   * Atölyeden çıkış: kaplamalar gizlenir, otomatik kayıt mağazada. Önce
   * yarım tutamaç sürüklemesi iptal edilir, sonra bekleyen yayınlar
   * boşaltılır; ikisi de mağazaya yazar ama model kurulmaz (çıkışta
   * katalog motoru gelir) ve iç içe abone tutamaçları yeniden açmaz.
   * Sahnedeki model bundan sonra mağazanın bildiği model değildir.
   */
  private leaveWorkshop() {
    if (this.wsViewBase && this.rig.overrides === this.wsMirrored) this.rig.overrides = this.wsViewBase;
    this.wsMirrored = null;
    this.flushWorkshopQuiet(() => this.wsHandles?.setVisible(false));
    this.wsStore.invalidateShown();
    this.frameHooks.delete(this.wsHook);
    this.wsFigure?.setVisible(false);
    this.wsBox?.set(null, null);
    this.wsGhost?.end();
    this.picker.priority = undefined;
    this.picker.showLabels = true;
    this.wsHover = null;
    document.body.classList.remove('mode-workshop');
  }

  /**
   * Süren tutamaç sürüklemesini iptal eder: tasarım başlangıç değerine
   * döner, atölyede kalınır. Tutamaç grubunun `cancel()`'ı varsa o; yoksa
   * gizle-göster (setVisible(false) yarım sürüklemeyi geri alır).
   */
  private cancelHandleDrag() {
    const hd = this.wsHandles as (WorkshopHandles & { cancel?: () => void }) | null;
    if (!hd?.dragging) return;
    if (typeof hd.cancel === 'function') hd.cancel();
    else hd.setVisible(false);
    this.refreshWorkshop();
  }

  /**
   * Mağazanın bekleyen taslak/tam yayınını (ve çalışabilirlik bulgularını)
   * hemen işler, ama modeli sahneye kurmadan: atölyeden çıkarken ya da test
   * hücresine geçerken o model hemen başkasıyla değişir. `before` aynı
   * sessiz pencerede çalışır (sürükleme iptali).
   */
  private flushWorkshopQuiet(before?: () => void) {
    const was = this.wsLeaving;
    this.wsLeaving = true;
    try {
      before?.();
      this.wsStore.flush();
    } finally {
      this.wsLeaving = was;
    }
  }

  private workshopFrame(_dt: number) {
    if (this.mode !== 'workshop') return;
    this.wsHandles?.frame();
    if (this.wsFigure) this.wsFigure.frame(this.rig.camera);
    this.wsBox?.frame(this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);
  }

  /** Paneller ve vurgu (mağaza değişince ve 0,2 s'de bir) */
  private refreshWorkshop() {
    if (this.mode !== 'workshop' || this.wsLeaving) return;
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
    if (!store.state.last || store.state.phase === 'start' || store.state.phase === 'wizard') {
      this.toasts.show('Önce atölyede bir tasarım oluştur.', 'info');
      return;
    }
    // Bekleyen yayın (çalışabilirlik bulguları dahil) işlenir; model aşağıda efektlerle kurulur
    this.flushWorkshopQuiet();
    const last = store.state.last;
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
        // Yeniden çerçeveleme uçuşu bitsin: tutamaçların ekran konumu sabit olsun
        while (app.rig.animating && performance.now() - t0 < 5000) await new Promise((r) => requestAnimationFrame(() => r(null)));
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
    // Model kurulamazsa yuva ve simülasyon sahnedeki modelin tasarımına döner
    // (sayılar başka, görsel başka motoru göstermesin); hata yine atılır
    const shown = this.visual.slot === slot ? this.visual.source.built : prev;
    this.sim.setDesign(built.design);
    if (lit) this.sim.trim(throttle, 10);
    this.sandboxPanel.refreshEngine();
    clearTimeout(this.fullDetailTimer);
    // Sahnede taslak varsa 250 ms sonra tam ayrıntı (yalnız o yuvanın taslağı
    // hâlâ sahnedeyse). Zamanlayıcıdan hata taşmaz: tam ayrıntı kurulamazsa taslak kalır
    const armFullDetail = () => {
      if (!this.visualDraft) return;
      this.fullDetailTimer = setTimeout(() => {
        if (this.visual.slot !== slot || !this.visualDraft) return;
        try {
          this.rebuildVisual(slot);
        } catch (err) {
          console.warn('Tam ayrıntılı model kurulamadı; taslak sahnede kalıyor', err);
        }
      }, 250);
    };
    try {
      this.rebuildVisual(slot, { effects, draft });
    } catch (err) {
      if (shown) {
        setSlotBuilt(slot, shown);
        this.sim.setDesign(shown.design);
        if (lit) this.sim.trim(throttle, 10);
        this.sandboxPanel.refreshEngine();
      }
      // Sahnedeki (önceki) taslak yine tam ayrıntıya geçer; yoksa bir sonraki
      // geçerli değişikliğe kadar düşük ayrıntıda kalırdı
      armFullDetail();
      throw err;
    }
    armFullDetail();
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
    // Aynı yuvanın yeniden kurulumu (taslak/tam ayrıntı): görsel durum sürer;
    // kare kancasında kurulan taslak update görmeden çizilir, pal açısı ve
    // lüle ilk karede de doğru olsun (dt 0: hiçbir şey ilerlemez)
    if (this.visual.slot === next.slot) {
      next.carryFrom(this.visual);
      next.update(this.sim.snapshot(), 0);
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
    this.visual.setGround(this.environment.floorY, this.environment.inCell);
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
    // Atölyede açılar aynalanır: akış ekranda soldan sağa (tutamaç sürüklemesi sezgisel)
    if (this.mode === 'workshop') this.mirrorWorkshopViews();
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
        this.environment.names(),
        this.environment.name,
        {
          onQuality: (q) => {
            this.settings.quality = q;
            this.applyQuality(q);
            saveSettings(this.settings);
            // Kit parçalarının detay seviyesi değişti: model yeniden üretilir.
            // Önbellek yalnız yeni kaliteyi ve taslağı tutar (bırakılan
            // kalitenin son nesli bellekte kalmasın)
            retainDetails([q, 'low']);
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

  /**
   * Ortamı değiştirir (EnvironmentManager.apply). Kayıt ve ölçüm betikleri
   * çağırır; derleme bitene kadar `envPending` true kalır.
   */
  applyEnvironment(name: string) {
    this.environment.apply(name);
  }

  /** Hücre ışıklarını kısar ya da kapatır (1 açık, 0.35 loş, 0 gece) */
  setLights(level: number) {
    this.environment.setLights(level);
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
    if (this.mode === 'workshop') {
      // Atölyede tıklama modülü seçer (nabızlı küme vurgusu, sol panel bölümü)
      const s = this.wsStore.state;
      if (s.phase !== 'edit' || !s.last) return;
      this.wsStore.select(moduleOfPart(part as PartTag, s.last.built.traits ?? deriveTraits(s.last.graph)));
      return;
    }
    this.stickyHighlight = this.stickyHighlight === part ? null : part;
  }

  /** Atölye vurgusu: sonuç panelinden (çubuk/uyarı) gelen parçalar, yoksa seçili modül */
  private workshopHighlight(): PartId[] | PartId | null {
    const s = this.wsStore.state;
    if (this.wsHover && (performance.now() > this.wsHoverUntil || s.selected !== this.wsHoverSel)) this.wsHover = null;
    if (this.wsHover?.length) return this.wsHover;
    if (s.selected && s.last) return partsOfModule(s.selected, s.last.built.traits ?? deriveTraits(s.last.graph)) as PartId[];
    return this.hoverPart;
  }

  private hoverPart: PartId | null = null;
  private onHover(part: PartId | null) {
    this.hoverPart = part;
  }

  /* ================================================================ */
  /* Simülasyon olayları                                              */
  /* ================================================================ */

  /**
   * Oyun olaylarını dinler: simülasyon olayları (surge, lightoff, idle…) ve
   * uygulama olayları (autoStartFuel, autoStartDone…; src/app/events.ts).
   * Dalga 1+ paketleri App.ts'e dokunmadan bağlanır; dönen işlev aboneliği
   * kaldırır.
   */
  onSimEvent(fn: GameEventListener): () => void {
    return this.bus.on(fn);
  }

  private handleSimEvent(e: SimEvent) {
    this.runner?.onEvent(e);
    this.bus.emit(e);
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
    if (!this.autoStarter.begin(this.sim)) {
      this.toasts.show('Motor zaten çalışıyor.', 'info');
      return;
    }
    this.emitAppEvent('autoStartBegin', 'Otomatik çalıştırma başladı.');
    this.toasts.show('Otomatik çalıştırma: APU BLEED, ateşleme ve marş açıldı; %22 N2\'de yakıt verilecek.', 'info', 5000);
  }

  private updateAutoStart() {
    this.autoStarter.update(this.sim, (s) => this.emitAppEvent(...AUTOSTART_EVENTS[s]));
  }

  /** Uygulama olayı (simülasyon saatiyle) */
  private emitAppEvent(type: AppEventType, message: string) {
    this.bus.emit({ type, time: this.sim.time, severity: 'info', message });
  }

  /* ================================================================ */
  /* Girdi                                                            */
  /* ================================================================ */

  private onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    // Tutamaç sürüklenirken: Esc yalnız sürüklemeyi iptal eder (menüye
    // çıkılmaz, tasarım başlangıç değerine döner); öbür kısayollar (geri al,
    // açı, kesit) hareketin ortasında çalışmaz
    if (this.mode === 'workshop' && !this.overlay && this.wsHandles?.dragging) {
      if (e.key === 'Escape') this.cancelHandleDrag();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Metin kutusu/açılır liste tuşları kendisinin (Esc odağı bırakır);
    // kaydırıcıda yalnız gezinme tuşları (keys.ts)
    if (target && keyOwnedByTarget(target as HTMLInputElement, e.key)) {
      if (e.key === 'Escape') target.blur();
      return;
    }
    if (e.key === 'Escape') {
      if (this.overlay && this.mode === 'workshop' && this.overlay === this.wsStartEl) this.closeWorkshopStart();
      else if (this.overlay && this.mode !== 'menu') this.closeOverlay();
      // Atölyede önce seçim kalkar, sonra menü (otomatik kayıt: onay yok)
      else if (this.mode === 'workshop' && this.wsStore.state.selected) this.wsStore.select(null);
      // Atölyeden açılan dersten çıkış atölyeye döner (§6.8)
      else if (this.mode === 'lesson' && this.returnTo === 'workshop') this.openWorkshop({ resume: true });
      else if (this.mode !== 'menu') this.showMenu();
      return;
    }
    if (this.mode === 'menu' || this.overlay) return;
    const k = e.key.toLowerCase();
    const plain = plainKey(e);
    if (this.mode === 'workshop') {
      const onCanvas = focusOnCanvas(target, document.body, this.renderer.domElement);
      // Gaz kolu tuşları (W/S, PgUp/PgDn, B, oklar) simülasyona gitmez.
      // Tutamaç okları yalnız odak tuvaldeyken (panel düğmesindeyken değil)
      if (onCanvas && this.wsHandles?.onKey(e)) {
        e.preventDefault();
        return;
      }
      const store = this.wsStore;
      // Geri al yalnız düzenleme evresinde (sihirbazda geçmiş eski ailenin;
      // araç çubuğunun düğmeleri de yalnız orada görünür)
      const editing = store.state.phase === 'edit';
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        if (!editing) return;
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
        if (!editing) return;
        store.redo();
      }
      // Değiştiricili tuşlar (Ctrl+C kopyalama…) tarayıcının
      else if (!plain) return;
      else if (k === 'u') store.setExpert(!store.state.project.expert);
      // Tab yalnız odak tuvaldeyken modül gezintisi; panelde klavye gezintisi kalır
      else if (e.key === 'Tab') {
        if (!onCanvas) return;
        this.wsPanel.nextModule(e.shiftKey ? -1 : 1);
      } else if (k === 'c') this.setCutaway(!this.cutaway);
      else if (k === 'm') this.toggleMute();
      else if (k === 'h') {
        document.body.classList.toggle('ui-hidden');
        this.layout();
      } else if (/^[1-8]$/.test(k)) {
        const views = (Object.keys(VIEWS) as ViewName[]).filter((v) => v !== 'menu');
        const v = views[Number(k) - 1];
        if (v) {
          const cut = this.cutaway;
          this.rig.go(v);
          this.setCutaway(cut);
          this.viewSelect.value = v;
        }
      } else return;
      e.preventDefault();
      return;
    }
    // Değiştiricili tuşlar (Ctrl+C, Ctrl+W…) tarayıcının
    if (!plain) return;
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
    this.pipeline.applyQuality(QUALITY[q], this.environment.env.sun);
    this.rain.setDensity(q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1);
    this.resize();
  }

  private resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.pipeline.resize(w, hgt);
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
    for (let t = 0; t < seconds; t += dt) this.advanceStep(dt);
    this.afterAdvance();
  }

  /**
   * Test kancası (T-20): `advance` gibi ilerletir, ama sabit süre yerine
   * olay ya da koşul gelene kadar: `app.advanceUntil('lightoff', 40)`,
   * `app.advanceUntil(() => app.sim.N1 > 0.95)`. Olay geldiği adımın
   * sonunda durur; süre dolarsa `ok: false` (src/app/waitFor.ts).
   */
  advanceUntil(target: WaitTarget<GameEventType>, maxSeconds = 120, dt = 1 / 30): WaitResult {
    const r = advanceUntil({ step: (d) => this.advanceStep(d), subscribe: (fn) => this.bus.on(fn), target, maxSeconds, dt });
    this.afterAdvance();
    return r;
  }

  /** advance'ın bir adımı (çizimsiz) */
  private advanceStep(dt: number) {
    this.sim.step(dt * (this.mode === 'sandbox' ? this.timeScale : 1));
    this.updateAutoStart();
    const snap = this.sim.snapshot();
    this.visual.update(snap, dt, this.rig.camera);
    this.runner?.update(dt, snap);
    this.rig.update(dt, 0);
    if (this.cutaway) this.aimCutaway();
  }

  /** İleri sarmanın sonunda kokpit ve diyagram güncel değerleri gösterir */
  private afterAdvance() {
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
    if (this.mode === 'workshop') this.visual.highlight(this.workshopHighlight());
    else this.visual.highlight(hl);

    if (this.mode !== 'menu') {
      if (this.consoleVisible) {
        this.cockpit.update(snap);
        this.eicas.draw(snap, dt);
      }
      if (this.diagramVisible) this.diagram.update(snap, dt);
      if (this.runner) this.cockpit.flash(this.runner.flash(snap));
      if (this.mode === 'workshop') {
        this.wsAcc += dt;
        if (this.wsAcc > 0.2) {
          this.wsAcc = 0;
          this.refreshWorkshop();
          // Yasak bölgeler boşta (sürükleme ve bekleyen üretim yokken)
          if (this.wsStore.idle) this.wsPanel.updateFeasible();
        }
      }
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
    this.environment.update(dt);
    this.rig.update(dt, this.visual.shake);
    updateWeather(simDt);
    this.rain.update(simDt, this.rig.camera, this.environment.floorY);
    if (this.cutaway) this.aimCutaway();
    for (const f of this.frameHooks) f(dt);
    this.pipeline.updateHaze(snap, this.rig.camera, this.visual.exhaustExit, dt);
    if (!this.envPending) {
      this.pipeline.render(dt);
      if (!this.firstFrameDone) {
        this.firstFrameDone = true;
        emitLoadProgress('firstFrame', 'İlk kare çizildi');
      }
      // Yeni model çizildi: eski modeller artık güvenle atılabilir
      if (this.disposeQueue.length) for (const v of this.disposeQueue.splice(0)) v.dispose();
    }
    this.framesRendered++;
  }
  private disposeQueue: EngineVisual[] = [];
  /** İlk tam kare çizildi mi (loadProgress 'firstFrame' bir kez) */
  private firstFrameDone = false;
}
