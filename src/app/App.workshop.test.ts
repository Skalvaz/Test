/**
 * M5a dalga 2 inceleme bulguları (uygulama grubu): App'in atölye kipi
 * kararları. DOM'suz yarım kurulum (Object.create): yalnız sınanan
 * yöntemlerin dokunduğu alanlar taklit; mağaza gerçek (FAKE_DEPS).
 *
 * - #6/#22: sürüklerken Esc sürüklemeyi iptal eder, menüye çıkılmaz;
 *   sürüklerken Ctrl+Z çalışmaz.
 * - #12: Ctrl+Z/Y yalnız düzenleme evresinde.
 * - #11: atölyeden çıkınca aynı tasarım yeniden sahneye konur.
 * - #13: 3B üretimi atarsa mağaza/kullanıcı olayı atmaz; sim sahnedeki modele döner.
 * - #14: tam ayrıntı yayını, App'in kurduğu aynı modeli yeniden üretmez.
 * - Mod değişince önceki modun bildirimleri temizlenir.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { builtFor, setSlotBuilt, setSlotGraph, TEMPLATES } from '../design/catalog';
import { buildEngine, type BuiltEngine } from '../design/graph';
import { WorkshopStore } from '../workshop/store';
import { FAKE_DEPS, memoryStorage } from '../workshop/testing';
import { Toasts } from '../ui/Toasts';
import { App } from './App';

// Özel alanlara erişim: yarım kurulum taklitleri
type AnyApp = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Rig {
  app: AnyApp;
  store: WorkshopStore;
  applied: { b: BuiltEngine; detail: unknown }[];
  toasts: string[];
  handles: { dragging: string | null; onKey: () => boolean; setVisible: ReturnType<typeof vi.fn>; cancel?: ReturnType<typeof vi.fn> };
  order: string[];
}

/** Atölye kipinde yarım kurulmuş App */
function rig(o: { cancel?: boolean } = {}): Rig {
  const app = Object.create(App.prototype) as AnyApp;
  const applied: Rig['applied'] = [];
  const toasts: string[] = [];
  const order: string[] = [];
  const store = new WorkshopStore({ onBuilt: (b, d) => app.onWorkshopBuilt(b, d), storage: memoryStorage(), deps: FAKE_DEPS });
  const handles: Rig['handles'] = {
    dragging: null,
    onKey: () => false,
    setVisible: vi.fn((v: boolean) => {
      order.push(`handles.setVisible(${v})`);
      // Gerçek tutamaç gibi: gizlenince yarım sürükleme başlangıca döner
      if (!v && handles.dragging) {
        handles.dragging = null;
        store.dragHandle('frontTip' as never, 0, 'end');
      }
    }),
  };
  if (o.cancel) handles.cancel = vi.fn(() => (handles.dragging = null));
  const realFlush = store.flush.bind(store);
  store.flush = () => {
    order.push('store.flush');
    realFlush();
  };
  Object.assign(app, {
    mode: 'workshop',
    overlay: null,
    wsStore: store,
    wsHandles: handles,
    wsLeaving: false,
    wsFailedRev: null,
    wsBuildMs: 0,
    wsFigure: null,
    wsBox: null,
    wsGhost: null,
    wsHover: null,
    wsViewBase: null,
    wsMirrored: null,
    frameHooks: new Set(),
    picker: { priority: undefined, showLabels: false },
    rig: { overrides: {} },
    renderer: { domElement: {} },
    slot: 'turbofan',
    visual: { slot: 'turbofan', source: { built: undefined } },
    visualEffects: true,
    visualDraft: false,
    toasts: { show: (t: string) => toasts.push(t), clear: () => toasts.splice(0) },
    applyDesign: vi.fn((slot: string, b: BuiltEngine, detail: unknown) => {
      applied.push({ b, detail });
      // Sahne: atölye modeli (efektsiz); taslak kalite 'low' değilse taslak
      app.slot = slot;
      app.visual = { slot, source: { built: b } };
      app.visualEffects = false;
      app.visualDraft = detail === 'draft';
    }),
    placeWorkshopHelpers: vi.fn(),
    reframeWorkshop: vi.fn(),
    refreshWorkshop: vi.fn(),
    showMenu: vi.fn(),
    setCutaway: vi.fn(),
    toggleMute: vi.fn(),
  });
  // document.body.classList (leaveWorkshop)
  (globalThis as unknown as { document: unknown }).document = { body: { classList: { remove() {}, add() {}, toggle() {} } } };
  return { app, store, applied, toasts, handles, order };
}

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, target: null, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...mods }) as unknown as KeyboardEvent;

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { document?: unknown }).document;
  setSlotGraph('workshop', null);
});

describe('#6/#22 sürüklerken Esc', () => {
  it('tutamaç cancel() varsa sürükleme iptal edilir, menüye çıkılmaz', () => {
    const r = rig({ cancel: true });
    r.handles.dragging = 'frontTip';
    const e = key('Escape');
    r.app.onKey(e);
    expect(r.handles.cancel).toHaveBeenCalledTimes(1);
    expect(r.app.showMenu).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(r.app.mode).toBe('workshop');
  });

  it('cancel() yoksa gizle-göster ile iptal; atölyede kalınır', () => {
    const r = rig();
    r.store.startFromTemplate('turbojet');
    r.handles.dragging = 'frontTip';
    r.app.onKey(key('Escape'));
    expect(r.handles.setVisible).toHaveBeenCalledWith(false);
    expect(r.handles.dragging).toBe(null);
    expect(r.app.refreshWorkshop).toHaveBeenCalled();
    expect(r.app.showMenu).not.toHaveBeenCalled();
  });

  it('sürüklerken Ctrl+Z geri almaz, açı tuşları çalışmaz', () => {
    const r = rig({ cancel: true });
    r.store.startFromTemplate('turbojet');
    r.store.setKnob('hpc.pr', 9, 'change');
    const undo = vi.spyOn(r.store, 'undo');
    r.handles.dragging = 'frontTip';
    r.app.onKey(key('z', { ctrlKey: true }));
    r.app.onKey(key('c'));
    expect(undo).not.toHaveBeenCalled();
    expect(r.app.setCutaway).not.toHaveBeenCalled();
    // Sürükleme yokken Esc: seçim yoksa menü (eski davranış)
    r.handles.dragging = null;
    r.app.onKey(key('Escape'));
    expect(r.app.showMenu).toHaveBeenCalledTimes(1);
  });

  it('çıkışta önce sürükleme iptali, sonra yayın; modeller kurulmaz, tutamaç yeniden açılmaz', () => {
    vi.useFakeTimers();
    const r = rig();
    r.store.startFromTemplate('turbojet');
    r.store.flush();
    r.applied.length = 0;
    r.order.length = 0;
    r.handles.dragging = 'frontTip';
    r.app.leaveWorkshop();
    expect(r.order).toEqual(['handles.setVisible(false)', 'store.flush']);
    expect(r.applied).toEqual([]);
    expect(r.app.refreshWorkshop).not.toHaveBeenCalled();
    expect(r.app.wsLeaving).toBe(false);
  });
});

describe('#12 Ctrl+Z yalnız düzenleme evresinde', () => {
  it('sihirbazda Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z mağazaya gitmez; düzenlemede gider', () => {
    const r = rig();
    r.store.startFromTemplate('turbojet');
    r.store.setKnob('hpc.pr', 9, 'change');
    r.store.startWizard();
    const undo = vi.spyOn(r.store, 'undo');
    const redo = vi.spyOn(r.store, 'redo');
    r.app.onKey(key('z', { ctrlKey: true }));
    r.app.onKey(key('y', { ctrlKey: true }));
    r.app.onKey(key('Z', { ctrlKey: true, shiftKey: true }));
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    r.store.wizardFinish();
    r.app.onKey(key('z', { ctrlKey: true }));
    expect(undo).toHaveBeenCalledTimes(1);
  });
});

describe('#11 atölyeye dönüşte yeniden yayın', () => {
  it('çıkıp aynı şablonu yeniden açınca model yeniden sahneye konur', () => {
    vi.useFakeTimers();
    const r = rig();
    r.store.startFromTemplate('turbofan');
    r.store.flush();
    expect(r.applied.map((x) => x.detail)).toEqual(['draft', 'full']);
    // Esc → menü: katalog motoru sahnede
    r.app.leaveWorkshop();
    r.app.mode = 'menu';
    r.app.visual = { slot: 'turbofan', source: { built: undefined } };
    r.app.slot = 'turbofan';
    r.applied.length = 0;
    // Menü → Atölye → aynı şablon (AT-2): imza aynı
    r.app.mode = 'workshop';
    r.store.startFromTemplate('turbofan');
    r.store.flush();
    expect(r.applied.map((x) => x.detail)).toEqual(['draft', 'full']);
    expect(r.app.visual.source.built).toBe(r.store.state.last.built);
  });

  it('atölye dışında yayın sahneye konmaz ve gösterilmiş sayılmaz', () => {
    vi.useFakeTimers();
    const r = rig();
    r.app.mode = 'sandbox';
    r.store.startFromTemplate('turbojet');
    r.store.flush();
    expect(r.applied).toEqual([]);
    r.app.mode = 'workshop';
    r.store.setGoal(null);
    r.store.flush();
    expect(r.applied.map((x) => x.detail)).toEqual(['draft', 'full']);
  });
});

describe('#13 3B üretimi atarsa', () => {
  it('onWorkshopBuilt atmaz, false döner, bildirim tasarım başına bir kez', () => {
    vi.useFakeTimers();
    const r = rig();
    r.app.applyDesign = vi.fn(() => {
      throw new RangeError('disk ters döndü');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => r.store.startFromTemplate('turbojet')).not.toThrow();
    expect(() => r.store.flush()).not.toThrow();
    expect(r.toasts.filter((t) => t.includes('3B modeli kurulamadı'))).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    // Aynı tasarım yeniden denenir (gösterilmiş sayılmadı)
    expect((r.app.applyDesign as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2])).toEqual(['draft', 'full']);
    warn.mockRestore();
  });

  it('applyDesign: model kurulamazsa yuva ve simülasyon sahnedeki modelin tasarımına döner', () => {
    const app = Object.create(App.prototype) as AnyApp;
    const shown = buildEngine(TEMPLATES.turbojet!);
    const next = buildEngine(TEMPLATES.turbofan!);
    setSlotBuilt('workshop', shown);
    const designs: unknown[] = [];
    Object.assign(app, {
      slot: 'workshop',
      visual: { slot: 'workshop', source: { built: shown } },
      sim: { lit: false, controls: { throttle: 0 }, eng: { design: shown.design }, setDesign: (d: unknown) => designs.push(d), trim: () => {} },
      sandboxPanel: { refreshEngine: () => {} },
      fullDetailTimer: undefined,
      rebuildVisual: () => {
        throw new RangeError('disk ters döndü');
      },
    });
    expect(() => App.prototype.applyDesign.call(app, 'workshop', next, 'draft', { effects: false })).toThrow(RangeError);
    expect(builtFor('workshop')).toBe(shown);
    expect(designs.at(-1)).toBe(shown.design);
  });

  /** applyDesign için yarım App: rebuildVisual taklidi installVisual gibi taslak bayrağını yazar */
  function designRig(shown: BuiltEngine, rebuild: (slot: string, opts: { draft?: boolean }) => void) {
    const app = Object.create(App.prototype) as AnyApp;
    setSlotBuilt('workshop', shown);
    Object.assign(app, {
      slot: 'workshop',
      visual: { slot: 'workshop', source: { built: shown } },
      visualDraft: true,
      sim: { lit: false, controls: { throttle: 0 }, eng: { design: shown.design }, setDesign() {}, trim() {} },
      sandboxPanel: { refreshEngine: () => {} },
      fullDetailTimer: undefined,
      rebuildVisual: (slot: string, opts: { draft?: boolean } = {}) => {
        rebuild(slot, opts);
        app.visual = { slot, source: { built: builtFor(slot as never) } };
        app.visualDraft = !!opts.draft;
      },
    });
    return app;
  }

  it('model kurulamazsa sahnedeki önceki taslak yine tam ayrıntıya geçer', () => {
    vi.useFakeTimers();
    const shown = buildEngine(TEMPLATES.turbojet!);
    const next = buildEngine(TEMPLATES.turbofan!);
    const full: unknown[] = [];
    const app = designRig(shown, (slot, opts) => {
      if (opts.draft) throw new RangeError('disk ters döndü');
      full.push(builtFor(slot as never));
    });
    expect(() => App.prototype.applyDesign.call(app, 'workshop', next, 'draft', { effects: false })).toThrow(RangeError);
    vi.advanceTimersByTime(300);
    expect(full).toEqual([shown]);
    expect(app.visualDraft).toBe(false);
  });

  it('tam ayrıntı zamanlayıcısında üretim atarsa hata taşmaz, taslak kalır', () => {
    vi.useFakeTimers();
    const shown = buildEngine(TEMPLATES.turbojet!);
    const next = buildEngine(TEMPLATES.turbofan!);
    const app = designRig(shown, (_slot, opts) => {
      if (!opts.draft) throw new RangeError('tam ayrıntıda disk ters döndü');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    App.prototype.applyDesign.call(app, 'workshop', next, 'draft', { effects: false });
    expect(() => vi.advanceTimersByTime(300)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    expect(app.visualDraft).toBe(true);
    expect(app.visual.source.built).toBe(next);
    warn.mockRestore();
  });
});

describe('bildirim temizliği', () => {
  it('Toasts.clear tekrar eleme belleğini de sıfırlar (aynı mesaj hemen yeniden gösterilir)', () => {
    const t = Object.create(Toasts.prototype) as AnyApp;
    const removed = vi.fn();
    Object.assign(t, { el: { replaceChildren: removed }, recent: new Map([['Test hücresi: motor rölantide.', performance.now()]]) });
    t.clear();
    expect(removed).toHaveBeenCalledTimes(1);
    expect(t.recent.size).toBe(0);
  });
});

describe('#14 tam ayrıntı iki kez üretilmez', () => {
  it("App'in zamanlayıcısı tam modeli kurduysa mağazanın 'full' yayını yeniden üretmez", () => {
    vi.useFakeTimers();
    const r = rig();
    r.store.startFromTemplate('turbojet');
    expect(r.applied.map((x) => x.detail)).toEqual(['draft']);
    // App fullDetailTimer: aynı modelin tam ayrıntısı sahnede
    r.app.visualDraft = false;
    vi.advanceTimersByTime(300);
    expect(r.applied.map((x) => x.detail)).toEqual(['draft']);
    expect(r.app.reframeWorkshop).toHaveBeenCalled();
  });

  it("taslak hâlâ sahnedeyse 'full' yayını tam modeli kurar", () => {
    vi.useFakeTimers();
    const r = rig();
    r.store.startFromTemplate('turbojet');
    vi.advanceTimersByTime(300);
    expect(r.applied.map((x) => x.detail)).toEqual(['draft', 'full']);
  });
});

describe('mod değişince bildirimler temizlenir', () => {
  it('test hücresinden atölyeye/menüye dönünce eski bildirimler kalkar; ders sonu bildirimi kalır', () => {
    const r = rig();
    r.toasts.push('Test hücresi: motor rölantide.');
    r.app.mode = 'sandbox';
    // openWorkshop'un dokunduğu her şey taklit
    Object.assign(r.app, {
      audio: { resume() {} },
      closeOverlay() {},
      catalogSlot: 'turbofan',
      cockpit: { flash() {} },
      sim: { reset() {} },
      envName: 'Test hücresi',
      cutaway: false,
      mirrorWorkshopViews() {},
      enterWorkshopScene() {},
      refreshChrome() {},
      openWorkshopStart() {},
      publishWorkshop() {},
    });
    r.app.rig = { go() {}, overrides: {} };
    r.app.openWorkshop();
    expect(r.toasts).toEqual([]);
    // Ders bitti, atölyeye dönüş: bildirim mod değişiminden sonra yazılır
    r.app.mode = 'lesson';
    r.app.returnTo = 'workshop';
    r.toasts.push('Ders bilgisi');
    vi.stubGlobal('localStorage', memoryStorage());
    r.app.finishLesson({ lesson: { id: 'x', title: 'Ders 1' }, stars: 3 });
    vi.unstubAllGlobals();
    expect(r.toasts).toEqual(['Ders 1 tamamlandı. Atölyeye dönüldü.']);
  });
});
