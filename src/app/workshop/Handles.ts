/**
 * Atölyenin 3B tutamaçları (M5a §6.7, P9): ön uç (fan/kompresör ucu ya da
 * pervane ucu), kompresör boyu (kademeye yapışır) ve lüle ağzı. Sprocket
 * kıvamında doğrudan düzenleme: noktayı tut, sürükle; sayılar, hayalet
 * meridyen ve taslak 3B model sürüklerken güncellenir.
 *
 * ## Kurulum (P10, App atölyeye girerken)
 *
 * ```ts
 * const ghost = new DesignGhost(this.scene);
 * const handles = new WorkshopHandles(
 *   {
 *     camera: this.rig.camera,
 *     dom: this.renderer.domElement,
 *     controls: this.rig.controls,
 *     cutPlane: () => (this.cutaway ? this.clipPlane : null),
 *   },
 *   store,                      // WorkshopStore (src/workshop/store.ts)
 *   { ghost, onDrag: (id) => { this.reframeHold = id !== null; } },
 * );
 * this.picker.priority = (x, y) => handles.hitTest(x, y) !== null;
 * this.frameHooks.add(handles.frame);          // her kare, çizimden önce
 * // çıkışta: this.frameHooks.delete(handles.frame); handles.dispose(); ghost.dispose();
 * ```
 *
 * Bağımlılıklar: sahne (yalnız kurulum imzası için; tutamaçlar sahneye
 * nesne eklemez, `visual.root` yeniden üretimlerinden bağımsızdır), kamera
 * (setViewOffset'li izdüşüm dahil), tuval (konum ve boy), yörünge kontrolü
 * (sürüklerken kapatılır), kesit düzlemi (açıkken tutamaçlar kesit
 * yüzünün tam üstünde durur) ve mağaza.
 *
 * ## Görünüm
 *
 * Tutamaçlar tuvalin üstünde bir kaplamadır (`.ws-handles` katmanı):
 * noktalar DOM öğesi (`[data-handle="<HandleId>"]`), kılavuz (kesikli eksen
 * çizgisi, kademe çentikleri, sınırın kırmızı yasak kısmı) SVG. Konumlar her
 * karede tasarımın 3B noktalarından izdüşümle (setViewOffset dahil)
 * yazılır. Böylece ekranda tam 14 px (üzerinde ve sürüklerken 18 px), renk
 * tam `--accent` (`--handle` tanımlıysa o): sahnedeki 3B nesneler ton
 * eşleme (AgX), bloom ve renk düzeltmesinden geçip solardı; kesitte
 * kırpılmaz, ışın seçimine girmez, panellerin altında kalır (z-index).
 * Motorun önünde çizilirler (gövde içindeki HPC tutamacı kesit kapalıyken
 * de tutulabilir). Seçili modülün tutamaçları opak, diğerleri %35 (seçim
 * yoksa hepsi opak); kilitli tutamaç gri, üzerine gelince nedeni okunur.
 *
 * ## Mağazayla akış (WorkshopStore'un mevcut API'si, değişiklik yok)
 *
 * - Konumlar `store.handles()`'tan (HandleSpec: dünya yarıçapı/z, sınır
 *   `range`, kademe çentikleri `snaps`, kilit nedeni `blocked`, bağlı
 *   düğme). Mağaza değişince (`subscribe`) yeniden okunur; sürüklerken
 *   mağaza sınırları sabit tutar.
 * - Basış: `store.dragHandle(id, başlangıç, 'start')` — kıyas noktası
 *   (`state.compare`) ve geri al mührü burada kurulur.
 * - Hareket: işaretçi olayları birleştirilir, karede en çok bir kez
 *   `store.dragHandle(id, hedef, 'move')` (input aşaması: sayılar her olayda,
 *   taslak 3B mağazanın kısmasıyla `onBuilt('draft')`).
 * - Bırakış: `store.dragHandle(id, son hedef, 'end')` (change aşaması:
 *   taslak hemen, 250 ms sonra tam ayrıntı; tek geri al adımı).
 * - Klavye: odaktaki tutamaç (Tab ile ya da son dokunulan) ←/→ ya da ↑/↓
 *   bir adım (eksenelde bir kademe), Shift ¼ adım; her basış tek
 *   `dragHandle(…, 'end')` (tek geri al adımı).
 * Hedef birimi tutamaç eksenine göre: radyal → yarıçap [m], eksenel → z [m].
 * Sürükleme düzlemi, tutamacın doğrusunu içeren ve kameraya en çok bakan
 * düzlemdir (overlay3d.dragAlong): yandan bakışta eksenden geçen düzlem.
 *
 * ## Kamu API'si
 *
 * - `frame()` (bağlı ok fonksiyonu): kare başına konum, boy, opaklık,
 *   kılavuz, okuma kartı (`.ws-readout`: geometri · sonuç deltası · neden).
 * - `handles()`: §6.10 test kancası biçimi
 *   `{ id, world, screen, axis, blocked }[]` (screen: istemci CSS pikseli,
 *   `page.mouse` ile doğrudan kullanılır; ekranda görünmeyenler yok).
 * - `hitTest(x, y)`: istemci pikselinde tutamaç kimliği ya da null
 *   (Picker.priority bununla bağlanır: tutamacın üzerinde parça seçilmez).
 * - `dragging`: sürüklenen tutamaç; `focused`: klavye odağı.
 * - `setVisible(v)`: test hücresinde/sihirbazda gizle.
 * - `onKey(e)`: App.onKey'den de çağrılabilir (odak tuvaldeyken); true
 *   dönerse olay tüketildi.
 * - `layer`: kaplamanın DOM katmanı (noktalar + SVG kılavuz).
 * - `dispose()`: grup sahneden, DOM katmanı ve okuma kartı kalkar.
 */

import * as THREE from 'three';
import { nozzleExplain, type HandleId } from '../../design/handles';
import { knobById } from '../../design/knobs';
import { diffSummary, explainDelta, fmtNum } from '../../design/summary';
import type { DesignSummary } from '../../design/summary';
import type { HandleSpec, WorkshopState } from '../../workshop/store';
import { h } from '../../ui/dom';
import type { DesignGhost } from './Ghost';
import { dragAlong, meridianBasis, rayFromScreen, toScreen } from './overlay3d';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** §6.10 test kancası satırı */
export interface HandleScreen {
  id: HandleId;
  world: [number, number, number];
  screen: [number, number];
  axis: 'radial' | 'axial';
  blocked: string | null;
}

/** App'in sağladıkları */
export interface HandleHost {
  camera: THREE.PerspectiveCamera;
  /** Tuval (renderer.domElement) */
  dom: HTMLElement;
  /** Yörünge kontrolü: sürüklerken kapatılır */
  controls: { enabled: boolean };
  /** Kesit düzlemi; kesit kapalıyken null */
  cutPlane(): THREE.Plane | null;
}

/** Mağazanın kullanılan yüzü (WorkshopStore bunu karşılar) */
export interface HandleStore {
  readonly state: Readonly<WorkshopState>;
  handles(): HandleSpec[];
  dragHandle(id: HandleId, target: number, phase: 'start' | 'move' | 'end'): void;
  subscribe(fn: (s: WorkshopState) => void): () => void;
}

export interface HandleOptions {
  /** Sürüklerken başlangıç/yeni meridyeni çizer (Ghost.ts) */
  ghost?: DesignGhost;
  /** Sürükleme başladı (id) / bitti (null): App otomatik yeniden çerçevelemeyi tutar */
  onDrag?(id: HandleId | null): void;
  /** Nokta katmanının ve okuma kartının ekleneceği öğe (varsayılan document.body) */
  parent?: HTMLElement;
}

/** Ekrandaki boy [CSS px] (§6.7); CSS'teki .ws-handle ile aynı */
export const HANDLE_PX = 14;
export const HANDLE_HOVER_PX = 18;
/** Seçili modül dışındaki tutamaçların opaklığı */
export const DIM_OPACITY = 0.35;
/** İsabet yarıçapı [px]: görünen boyun biraz dışı da tutar (CSS ::before ile aynı) */
export const HIT_PX = 12;

/** Tutamacın ilgili olduğu modüller (seçiliyse opak) */
export function handleModules(spec: Pick<HandleSpec, 'id' | 'group'>): string[] {
  switch (spec.id) {
    case 'frontTip':
      return ['engine', 'inlet', 'fan', 'lpc'];
    case 'propTip':
      return ['propeller', 'engine'];
    case 'nozzleExit':
      return ['nozzle', 'mixer', 'afterburner', 'engine'];
    default:
      return [spec.group];
  }
}

/** Seçime göre opaklık: seçim yoksa hepsi opak */
export function handleOpacity(spec: Pick<HandleSpec, 'id' | 'group'>, selected: string | null): number {
  return !selected || handleModules(spec).includes(selected) ? 1 : DIM_OPACITY;
}

/** Hedefi sınıra kırpar; `snap` iken eksenel tutamaçta en yakın kademe çentiğine yapıştırır */
export function clampTarget(spec: Pick<HandleSpec, 'range' | 'snaps'>, v: number, snap = true): number {
  const lo = Math.min(spec.range.lo, spec.range.hi);
  const hi = Math.max(spec.range.lo, spec.range.hi);
  let x = Math.min(hi, Math.max(lo, v));
  if (snap && spec.snaps?.length) {
    let best = spec.snaps[0];
    for (const s of spec.snaps) if (Math.abs(s - x) < Math.abs(best - x)) best = s;
    x = best;
  }
  return x;
}

/** Tutamacın meridyendeki değeri (radyal: yarıçap, eksenel: z); mağaza dünyası [0, r, z] */
const valueOf = (s: HandleSpec) => (s.axis === 'radial' ? s.world[1] : s.world[2]);

/** Klavye adımı: eksenelde bir kademe, radyalde sınır aralığının 1/40'ı */
export function keyStep(spec: Pick<HandleSpec, 'axis' | 'range' | 'snaps'>): number {
  if (spec.axis === 'axial' && spec.snaps && spec.snaps.length > 1) return Math.abs(spec.snaps[1] - spec.snaps[0]);
  return Math.max(Math.abs(spec.range.hi - spec.range.lo) / 40, 1e-3);
}

/** Okumanın kompresör adı */
const ROW_NAME: Partial<Record<HandleId, string>> = { 'length:hpc': 'HPC', 'length:fan': 'Fan' };

interface Item {
  spec: HandleSpec;
  el: HTMLDivElement;
  world: THREE.Vector3;
  screen: { x: number; y: number; visible: boolean };
}

export class WorkshopHandles {
  /** Kaplamanın DOM katmanı: tutamaç noktaları ve SVG kılavuz */
  readonly layer: HTMLDivElement;
  /** Sürüklenen tutamaç */
  dragging: HandleId | null = null;
  /** Klavye odağı (son üzerine gelinen/sürüklenen ya da Tab ile odaklanan) */
  focused: HandleId | null = null;
  private hovered: HandleId | null = null;
  private visible = true;
  private items: Item[] = [];
  private specs: HandleSpec[] = [];
  private unsub: () => void;
  private lastState: Readonly<WorkshopState> | null = null;
  // Sürükleme
  private pending: number | null = null;
  private sent: number | null = null;
  private dragValue = 0;
  private dragStart = 0;
  private dragStartCoupled: number | null = null;
  private dragRows: { n0?: number } = {};
  private pointerId: number | null = null;
  private controlsWere = true;
  // Meridyen düzleminin yukarı yönü
  private u = new THREE.Vector3(0, 1, 0);
  // Kılavuz (SVG): izinli kısım kesikli, yasak kısım kırmızı, kademe çentikleri
  private svg: SVGSVGElement;
  private guideOk: SVGPathElement;
  private guideBad: SVGPathElement;
  private guideTicks: SVGPathElement;
  private readout: HTMLElement;
  private readLines: HTMLElement[];
  private rect = { left: 0, top: 0, width: 1, height: 1 };

  constructor(
    private host: HandleHost,
    private store: HandleStore,
    private opts: HandleOptions = {},
  ) {
    const path = (cls: string) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('class', cls);
      return p;
    };
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'ws-guide hidden');
    this.guideBad = path('ws-guide-bad');
    this.guideOk = path('ws-guide-ok');
    this.guideTicks = path('ws-guide-ticks');
    this.svg.append(this.guideBad, this.guideOk, this.guideTicks);
    const parent = opts.parent ?? document.body;
    this.layer = h('div', { class: 'ws-handles', attrs: { 'aria-label': 'Tasarım tutamaçları' } }, [this.svg]);
    this.readLines = [h('b'), h('p'), h('p')];
    this.readout = h('div', { class: 'part-tip ws-readout hidden', attrs: { 'aria-live': 'polite' } }, this.readLines);
    parent.append(this.layer, this.readout);

    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    this.unsub = store.subscribe((s) => this.onState(s));
    this.sync();
  }

  /* ---------------------------------------------------------------- */
  /* Mağaza                                                           */
  /* ---------------------------------------------------------------- */

  private onState(s: Readonly<WorkshopState>): void {
    const prev = this.lastState;
    this.lastState = s;
    if (!prev || prev.last !== s.last || prev.phase !== s.phase || prev.lastFor !== s.lastFor || prev.dragging !== s.dragging) this.sync();
    if (this.dragging && prev?.last !== s.last && s.last) this.opts.ghost?.update(s.last.built);
  }

  /** Tutamaçları mağazadan yeniden okur (mağaza değişince kendiliğinden çağrılır) */
  sync(): void {
    let specs: HandleSpec[] = [];
    try {
      specs = this.store.handles();
    } catch {
      specs = [];
    }
    this.specs = specs;
    // Kimlikler aynıysa öğeler yeniden kullanılır (odak ve üzerine gelme korunur)
    const same = specs.length === this.items.length && specs.every((s, i) => this.items[i].spec.id === s.id);
    if (!same) {
      for (const it of this.items) it.el.remove();
      this.items = specs.map((spec) => this.makeItem(spec));
    } else specs.forEach((s, i) => (this.items[i].spec = s));
    for (const it of this.items) {
      const s = it.spec;
      it.el.title = s.blocked ?? s.label;
      it.el.setAttribute('aria-label', s.label);
      it.el.classList.toggle('is-blocked', !!s.blocked);
      it.el.setAttribute('aria-disabled', String(!!s.blocked));
    }
    if (this.dragging && !specs.some((s) => s.id === this.dragging)) this.cancelDrag();
    if (this.focused && !specs.some((s) => s.id === this.focused)) this.focused = null;
    if (this.hovered && !specs.some((s) => s.id === this.hovered)) this.hovered = null;
  }

  private makeItem(spec: HandleSpec): Item {
    const el = h('div', {
      class: 'ws-handle',
      attrs: { 'data-handle': spec.id, 'data-axis': spec.axis, role: 'slider', tabindex: '0' },
    });
    el.addEventListener('pointerdown', (e) => this.onDown(e, spec.id));
    el.addEventListener('pointerenter', () => this.setHovered(spec.id));
    el.addEventListener('pointerleave', () => {
      if (this.hovered === spec.id && !this.dragging) this.setHovered(null);
    });
    el.addEventListener('focus', () => (this.focused = spec.id));
    el.addEventListener('keydown', (e) => {
      this.focused = spec.id;
      this.onKey(e);
    });
    this.layer.append(el);
    return { spec, el, world: new THREE.Vector3(), screen: { x: 0, y: 0, visible: false } };
  }

  private setHovered(id: HandleId | null): void {
    this.hovered = id;
    if (id) this.focused = id;
  }

  /* ---------------------------------------------------------------- */
  /* Kare                                                             */
  /* ---------------------------------------------------------------- */

  /** Kare başına (App.frameHooks): konum, opaklık, kılavuz, okuma */
  readonly frame = (): void => {
    const cam = this.host.camera;
    cam.updateMatrixWorld();
    const r = this.host.dom.getBoundingClientRect();
    this.rect = { left: r.left, top: r.top, width: Math.max(r.width, 1), height: Math.max(r.height, 1) };
    meridianBasis(cam, this.host.cutPlane(), this.u);
    this.opts.ghost?.setBasis(this.u, this.rect);

    // Birleştirilmiş sürükleme hedefi: karede en çok bir kez mağazaya
    if (this.dragging && this.pending !== null && this.pending !== this.sent) {
      this.sent = this.pending;
      this.store.dragHandle(this.dragging, this.pending, 'move');
    }

    const s = this.store.state;
    const show = this.visible && s.phase === 'edit' && this.items.length > 0;
    this.layer.classList.toggle('hidden', !show);
    const selected = s.selected;
    const R = this.rect;
    for (const it of this.items) {
      const spec = it.spec;
      let rr = spec.world[1];
      let zz = spec.world[2];
      if (spec.id === this.dragging) {
        if (spec.axis === 'radial') rr = this.dragValue;
        else zz = this.dragValue;
      }
      it.world.copy(this.u).multiplyScalar(rr);
      it.world.z = zz;
      const sc = toScreen(cam, it.world, R);
      const onCanvas = sc.inFront && sc.x >= R.left && sc.x <= R.left + R.width && sc.y >= R.top && sc.y <= R.top + R.height;
      it.screen = { x: sc.x, y: sc.y, visible: show && onCanvas };
      const el = it.el;
      el.style.transform = `translate(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px)`;
      el.classList.toggle('hidden', !onCanvas);
      el.classList.toggle('is-dim', handleOpacity(spec, selected) < 1);
      el.classList.toggle('is-active', spec.id === this.hovered || spec.id === this.dragging);
      el.classList.toggle('is-dragging', spec.id === this.dragging);
      el.classList.toggle('is-focused', spec.id === this.focused);
      el.setAttribute('aria-valuenow', (spec.axis === 'radial' ? rr : zz).toFixed(3));
    }
    this.updateGuide(show);
    this.updateReadout();
  };

  /**
   * Etkin (üzerine gelinen ya da sürüklenen) tutamacın kılavuzu: tutamaç
   * doğrusu boyunca izinli kısım kesikli `--accent`, sınır dışı kısım
   * kırmızı (`range()`'in yasak kısmı), eksenelde kademe çentikleri.
   */
  private updateGuide(show: boolean): void {
    const id = this.dragging ?? this.hovered ?? null;
    const it = id ? this.items.find((x) => x.spec.id === id) : undefined;
    this.svg.classList.toggle('hidden', !it || !show);
    if (!it || !show) return;
    const s = it.spec;
    const cam = this.host.camera;
    const R = this.rect;
    const lo = Math.min(s.range.lo, s.range.hi);
    const hi = Math.max(s.range.lo, s.range.hi);
    const span = Math.max(hi - lo, 0.05);
    const ext = 0.35 * span;
    const a0 = s.axis === 'radial' ? Math.max(0, lo - ext) : lo - ext;
    const a1 = hi + ext;
    // Doğru üzerindeki nokta: radyalde z sabit, eksenelde r sabit (meridyen düzleminde)
    const at = (v: number, dr = 0) => {
      const w = s.axis === 'radial' ? this.u.clone().multiplyScalar(v).setZ(s.world[2]) : this.u.clone().multiplyScalar(s.world[1] + dr).setZ(v);
      const p = toScreen(cam, w, R);
      return `${(p.x - R.left).toFixed(1)} ${(p.y - R.top).toFixed(1)}`;
    };
    const seg = (a: number, b: number) => (Math.abs(b - a) > 1e-6 ? `M${at(a)}L${at(b)}` : '');
    this.guideOk.setAttribute('d', s.blocked ? '' : seg(lo, hi));
    this.guideBad.setAttribute('d', s.blocked ? seg(a0, a1) : seg(a0, lo) + seg(hi, a1));
    // Kademe çentikleri: eksene dik kısa çizgiler (meridyen düzleminde radyal)
    const gaps = Math.max((s.snaps?.length ?? 1) - 1, 1);
    const tick = Math.max(0.22 * (span / gaps), 0.02);
    let ticks = '';
    if (s.axis === 'axial') for (const z of s.snaps ?? []) ticks += `M${at(z, -tick)}L${at(z, tick)}`;
    this.guideTicks.setAttribute('d', ticks);
  }
  /* ---------------------------------------------------------------- */
  /* Okuma kartı (.ws-readout): geometri · sonuç deltası · neden        */
  /* ---------------------------------------------------------------- */

  private updateReadout(): void {
    const id = this.dragging ?? this.hovered;
    const it = id ? this.items.find((x) => x.spec.id === id) : undefined;
    if (!it || !it.screen.visible) {
      this.readout.classList.add('hidden');
      return;
    }
    const lines = this.readoutText(it.spec);
    lines.forEach((t, i) => {
      if (this.readLines[i].textContent !== t) this.readLines[i].textContent = t;
      this.readLines[i].classList.toggle('hidden', !t);
    });
    this.readout.style.left = `${Math.min(it.screen.x + 6, window.innerWidth - 360)}px`;
    this.readout.style.top = `${Math.max(it.screen.y, 40)}px`;
    this.readout.classList.remove('hidden');
  }

  /** Okuma kartının üç satırı (boş satır gizlenir): geometri · sonuç deltası · neden zinciri */
  readoutText(spec: HandleSpec): [string, string, string] {
    const s = this.store.state;
    if (!this.dragging) {
      if (spec.blocked) return [spec.label, spec.blocked, ''];
      return [spec.label, spec.axis === 'radial' ? 'Sürükle: yarıçap · ok tuşları: adım' : 'Sürükle: kademe kademe · ok tuşları: bir kademe', ''];
    }
    const sum: DesignSummary | undefined = s.last?.summary;
    const cmp = s.compare;
    let geo = spec.label;
    if (spec.id === 'nozzleExit' && this.dragStartCoupled !== null && s.last) {
      const now = Number(knobById(spec.coupled)?.get(s.last.graph));
      if (Number.isFinite(now)) geo = nozzleExplain(spec.coupled, this.dragStartCoupled, now);
    } else if (spec.axis === 'radial') {
      const what = spec.id === 'propTip' ? 'Pervane çapı' : 'Ön uç çapı';
      geo = `${what} ${fmtNum(2 * this.dragStart, 2)} → ${fmtNum(2 * this.dragValue, 2)} m`;
      if (spec.id === 'frontTip' && s.last) geo += ` · hava ${fmtNum(s.last.graph.massFlow, 1)} kg/s`;
    } else if (sum) {
      const n = this.rowStages(spec.id, sum);
      const name = ROW_NAME[spec.id] ?? (sum.rows.booster ? 'Booster' : 'LPC');
      if (n !== undefined && this.dragRows.n0 !== undefined) geo = `${name} ${this.dragRows.n0} → ${n} kademe`;
    }
    const deltas = sum && cmp ? diffSummary(cmp, sum).slice(0, 3).map((d) => d.text).join(' · ') : '';
    const why = sum && cmp ? explainDelta(cmp, sum).slice(0, 3).join(' · ') : '';
    return [geo, deltas || 'Sonuçta değişiklik yok', why];
  }

  private rowStages(id: HandleId, sum: DesignSummary): number | undefined {
    if (id === 'length:hpc') return sum.rows.hpc?.stages;
    if (id === 'length:fan') return sum.rows.front?.stages;
    return (sum.rows.booster ?? sum.rows.front)?.stages;
  }

  /* ---------------------------------------------------------------- */
  /* İşaretçi                                                         */
  /* ---------------------------------------------------------------- */

  /** İstemci pikselinde tutamaç (görünür ve en yakın), yoksa null */
  hitTest(x: number, y: number): HandleId | null {
    let best: Item | null = null;
    let bd = HIT_PX;
    for (const it of this.items) {
      if (!it.screen.visible) continue;
      const d = Math.hypot(it.screen.x - x, it.screen.y - y);
      if (d <= bd) {
        bd = d;
        best = it;
      }
    }
    return best?.spec.id ?? null;
  }

  /** İşaretçinin tutamaç doğrusundaki karşılığı (sınıra kırpılmış, sürekli) */
  private targetAt(spec: HandleSpec, x: number, y: number): number | null {
    const ray = rayFromScreen(this.host.camera, x, y, this.rect);
    const t =
      spec.axis === 'radial'
        ? dragAlong(ray, new THREE.Vector3(0, 0, spec.world[2]), this.u)
        : dragAlong(ray, this.u.clone().multiplyScalar(spec.world[1]), new THREE.Vector3(0, 0, 1));
    if (t === null || !Number.isFinite(t)) return null;
    // Eksenelde çentik değil sürekli hedef: mağaza kademeye yuvarlar (n' = 1 + round)
    return clampTarget(spec, t, false);
  }

  private onDown(e: PointerEvent, id: HandleId): void {
    if (e.button !== 0 || this.dragging || !this.visible) return;
    const spec = this.specs.find((s) => s.id === id);
    if (!spec) return;
    e.preventDefault();
    e.stopPropagation();
    const r = this.host.dom.getBoundingClientRect();
    this.rect = { left: r.left, top: r.top, width: Math.max(r.width, 1), height: Math.max(r.height, 1) };
    this.focused = id;
    const item = this.items.find((x) => x.spec.id === id);
    item?.el.focus({ preventScroll: true });
    // Kilitli tutamaç: neden okumada kalır, sürükleme yok
    if (spec.blocked) return;
    try {
      item?.el.setPointerCapture(e.pointerId);
    } catch {
      /* yakalama yoksa pencere dinleyicisi yeter */
    }
    // Yörünge kontrolü olay almaz (nokta tuvalin üstünde) ama klavye/teker için kapatılır
    this.controlsWere = this.host.controls.enabled;
    this.host.controls.enabled = false;
    this.pointerId = e.pointerId;
    this.dragging = id;
    this.dragStart = this.dragValue = valueOf(spec);
    this.pending = this.sent = null;
    const last = this.store.state.last;
    const v = last ? Number(knobById(spec.coupled)?.get(last.graph)) : NaN;
    this.dragStartCoupled = Number.isFinite(v) ? v : null;
    this.dragRows = { n0: last ? this.rowStages(id, last.summary) : undefined };
    this.store.dragHandle(id, this.dragStart, 'start');
    if (this.store.state.last) this.opts.ghost?.begin(this.store.state.last.built);
    document.body.classList.add('ws-grabbing');
    this.opts.onDrag?.(id);
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const spec = this.specs.find((s) => s.id === this.dragging);
    if (!spec) return;
    const t = this.targetAt(spec, e.clientX, e.clientY);
    if (t === null) return;
    this.dragValue = spec.axis === 'axial' ? clampTarget(spec, t, true) : t;
    this.pending = t;
  };

  private onUp = (e: PointerEvent): void => {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;
    const id = this.dragging;
    if (!id) return;
    const spec = this.specs.find((s) => s.id === id);
    const t = spec && e.type === 'pointerup' ? this.targetAt(spec, e.clientX, e.clientY) : null;
    const target = t ?? this.pending ?? this.dragValue;
    this.finishDrag(() => this.store.dragHandle(id, target, 'end'));
  };

  private finishDrag(commit: (() => void) | null): void {
    const was = this.dragging;
    const item = this.items.find((x) => x.spec.id === was);
    try {
      if (this.pointerId !== null) item?.el.releasePointerCapture(this.pointerId);
    } catch {
      /* yakalanmamıştı */
    }
    this.pointerId = null;
    this.dragging = null;
    this.pending = this.sent = null;
    this.host.controls.enabled = this.controlsWere;
    document.body.classList.remove('ws-grabbing');
    this.opts.ghost?.end();
    // Mağaza 'end'de değerlendirir; tutamaçlar yeni konumdan okunur (sync)
    commit?.();
    if (was) this.opts.onDrag?.(null);
  }

  private cancelDrag(): void {
    const id = this.dragging;
    if (!id) return;
    const v = this.dragValue;
    this.finishDrag(() => this.store.dragHandle(id, v, 'end'));
  }

  /* ---------------------------------------------------------------- */
  /* Klavye, görünürlük, test kancası                                   */
  /* ---------------------------------------------------------------- */

  /** Odaktaki tutamacı oklarla oynatır (Shift ¼ adım). true: olay tüketildi */
  onKey(e: KeyboardEvent): boolean {
    if (!this.visible || this.dragging || !this.focused || this.store.state.phase !== 'edit') return false;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return false;
    const spec = this.specs.find((s) => s.id === this.focused);
    if (!spec || spec.blocked) return false;
    const step = keyStep(spec) * (e.shiftKey ? 0.25 : 1);
    const target = clampTarget(spec, valueOf(spec) + dir * step, false);
    e.preventDefault();
    e.stopPropagation();
    this.store.dragHandle(spec.id, target, 'end');
    return true;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) {
      this.cancelDrag();
      this.hovered = null;
      this.readout.classList.add('hidden');
      this.layer.classList.add('hidden');
    }
  }

  /** §6.10: `__app.workshop.handles()` (ekranda görünenler) */
  handles(): HandleScreen[] {
    return this.items
      .filter((it) => it.screen.visible)
      .map((it) => ({
        id: it.spec.id,
        world: it.world.toArray() as [number, number, number],
        screen: [Math.round(it.screen.x * 10) / 10, Math.round(it.screen.y * 10) / 10] as [number, number],
        axis: it.spec.axis,
        blocked: it.spec.blocked,
      }));
  }

  dispose(): void {
    this.cancelDrag();
    this.unsub();
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.layer.remove();
    this.readout.remove();
  }
}
