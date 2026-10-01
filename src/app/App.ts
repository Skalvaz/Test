/**
 * Uygulama çekirdeği: renderer, sahne, simülasyon, ses ve arayüzü bir araya
 * getirir; modlar (menü / ders / test hücresi) arasında geçişi yönetir.
 */

import * as THREE from 'three';
import { EngineAudio } from '../audio/EngineAudio';
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
import { setCutPlane } from '../materials/engine';
import { Rain } from '../core/rain';
import { updateWeather, weather, wetUniforms } from '../core/weather';
import { loadScans } from '../materials/scans.js';
import { loadPanelDetails } from '../materials/textures.js';
import { ENGINE_CATALOG, EngineSim, type EngineKind, type SimEvent } from '../sim';
import { Cockpit, type SwitchId } from '../ui/Cockpit';
import { CycleDiagram } from '../ui/CycleDiagram';
import { h, icon } from '../ui/dom';
import { Eicas } from '../ui/Eicas';
import { LessonPanel } from '../ui/LessonPanel';
import { glossaryModal, lessonSelect, mainMenu, resultModal, settingsModal } from '../ui/Menus';
import { SandboxPanel } from '../ui/SandboxPanel';
import { Toasts } from '../ui/Toasts';
import { CameraRig, KIND_VIEWS, VIEWS, type ViewName } from './CameraRig';
import { Picker } from './Picker';

type Mode = 'menu' | 'lesson' | 'sandbox';

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
  visual!: EngineVisual;
  audio = new EngineAudio();
  mode: Mode = 'menu';
  timeScale = 1;

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
  /** Kesit görünümünde iç kısmı aydınlatan, kameraya bağlı dolgu ışığı */
  private cutFill = new THREE.PointLight(0xfff4e8, 0, 14, 1.6);
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
    setKitQuality(this.settings.quality);
    setBladeQuality(this.settings.quality);
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
    this.visual = new EngineVisual(materials, this.sim.kind);
    this.scene.add(this.visual.root);
    this.scene.add(this.cutFill);
    this.scene.add(this.rain.mesh);

    await step(onProgress, 'Termodinamik model dengeleniyor…');
    this.sim.trim(0);
    this.sim.on((e) => this.onSimEvent(e));

    await step(onProgress, 'Görüntü işleme zinciri kuruluyor…');
    this.fx = createComposer(renderer, this.scene, this.rig.camera);

    this.picker = new Picker(renderer.domElement, this.rig.camera, this.visual);
    this.cockpit?.setEngineKind(this.sim.kind);
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
    this.lessonPanel.onExit = () => this.showMenu();

    this.cockpit.setEngineKind(this.sim.kind);
    this.sandboxPanel = new SandboxPanel(this.sim, () => this.visual, {
      autoStart: () => this.beginAutoStart(),
      onEngine: (kind) => this.setEngine(kind, true),
      onLights: (level) => this.setLights(level),
      onTimeScale: (v) => {
        this.timeScale = v;
      },
      onExit: () => this.showMenu(),
    });

    document.body.append(
      this.topbar,
      this.consoleEl,
      this.diagram.el,
      this.lessonPanel.el,
      this.sandboxPanel.el,
      this.toasts.el,
    );
  }

  private setVisible(el: HTMLElement, v: boolean) {
    el.classList.toggle('hidden', !v);
  }

  private layout() {
    const W = window.innerWidth;
    const css = getComputedStyle(document.documentElement);
    const px = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
    const leftOpen = this.mode !== 'menu' && W > 720;
    const rightOpen = this.diagramVisible && this.mode !== 'menu' && W > 1000;
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
    this.cutBtn.classList.toggle('active', this.cutaway);
    this.diagBtn.classList.toggle('active', this.diagramVisible);
    this.soundBtn.replaceChildren(icon(this.audio.muted ? 'mute' : 'sound'));
    this.modeChip.textContent = m === 'lesson' ? 'Ders' : m === 'sandbox' ? 'Test hücresi' : '';
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
    this.cutFill.intensity = on ? 5 : 0;
    this.cutBtn?.classList.toggle('active', on);
  }

  /**
   * Kesit düzlemi motor ekseninden geçer ve kameraya bakan yarıyı kaldırır;
   * böylece motorun etrafında dönerken iç kısım her açıdan görünür.
   */
  private aimCutaway() {
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
    // Dolgu ışığı kameranın biraz önünde, kesit düzlemine yakın
    this.cutFill.position.copy(c);
  }

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

  startLesson(lesson: Lesson) {
    this.closeOverlay();
    // Dersler yüksek baypaslı turbofan üzerine yazıldı
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

  openSandbox() {
    this.audio.resume();
    this.closeOverlay();
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
    this.toasts.show('Test hücresi: motor rölantide. Soldaki panelden koşulları ve arızaları değiştirebilirsin.', 'info', 5500);
  }

  /**
   * Başka bir motor tipine geçer: simülasyonu yeniden boyutlandırır, 3B modeli
   * değiştirir, gaz kolu kademelerini ve kesit durumunu yeniden kurar.
   * `idle` ile yeni motor rölantide çalışır halde gelir.
   */
  setEngine(kind: EngineKind, idle: boolean) {
    if (this.sim.kind === kind && this.visual.kind === kind) return;
    this.sim.setDesign(ENGINE_CATALOG[kind]);
    if (idle) this.sim.trim(0, 30);
    this.autoStart = false;
    this.rebuildVisual(kind);
    this.cockpit.setEngineKind(kind);
    this.setCutaway(this.cutaway);
    this.stickyHighlight = null;
    this.stepHighlight = null;
    this.applyKindViews(kind);
    // Yeni motor farklı boyda: motora bağlı bir yakın açıdaysak yeniden kadrajla
    const cur = this.rig.current;
    if (this.mode !== 'menu' && cur !== 'menu' && (KIND_VIEWS[kind][cur] || cur === 'fan' || cur === 'inlet')) this.rig.go(cur);
  }

  /** 3B motor modelini (aynı ya da yeni tip) yeniden üretir */
  private rebuildVisual(kind: EngineKind = this.visual.kind) {
    this.scene.remove(this.visual.root);
    this.visual.dispose();
    this.visual = new EngineVisual(this.materials, kind);
    this.visual.setGround(this.floorY, this.envName === TEST_CELL);
    this.scene.add(this.visual.root);
    this.picker.visual = this.visual;
    if (this.cutaway) this.setCutaway(true);
  }

  /** Kamera açılarını ve seçicideki adları motor tipine göre günceller */
  private applyKindViews(kind: EngineKind) {
    this.rig.overrides = KIND_VIEWS[kind];
    const names = (Object.keys(VIEWS) as ViewName[]).filter((v) => v !== 'menu');
    names.forEach((v, i) => {
      const opt = this.viewSelect.options[i];
      if (opt) opt.text = `${i + 1} · ${(KIND_VIEWS[kind][v] ?? VIEWS[v]).label}`;
    });
  }

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
            setKitQuality(q);
            setBladeQuality(q);
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
    else if (k === 'h') document.body.classList.toggle('ui-hidden');
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
      this.sim.eng.design.fanBlades,
      this.sim.eng.design.fanDiameter,
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
    this.updateHaze(snap, dt);
    if (!this.envPending) this.fx.composer.render(dt);
    this.framesRendered++;
  }

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
