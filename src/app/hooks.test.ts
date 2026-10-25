/**
 * Dalga 0 kabul düzeltmeleri: Dalga 1 paketlerinin App.ts'e dokunmadan
 * kullanacağı kancalar (denetim bulguları).
 *  - Duraklatma: öncelikli tuş kancaları düğme odağında da çalışır, ders
 *    koşucusu simülasyon süresini alır, ses kısılır (1D, A-21).
 *  - Ses taslağı: setPaused, dB ve veri yolu imzaları (1D ↔ 1E).
 *  - Otomatik çalıştırma: ileti ve neden adımın bilgisinden (1B).
 *  - Yükleme: `__loadReady`, ready sonrası aşamalar (1A ↔ 1C, araçlar).
 *  - Sarsıntı girdisi (1I), ayar kayıt defteri (1I, 1D, 1E).
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, engineBox } from './App';
import { ModeController } from './modes/ModeController';
import { SimClock } from './simClock';
import { EngineAudio, dbToGain, gainToDb, masterTarget, MIN_DB } from '../audio/EngineAudio';
import { AutoStart, AUTOSTART_MESSAGES, type AutoStartInfo, type AutoStartStep } from '../sim/autostart';
import { EngineSim } from '../sim';
import { waitForSim } from './waitFor';
import { emitLoadProgress, isLoadReady, onLoadProgress, resetLoadProgress, type LoadProgress } from './loadProgress';
import { CameraShake } from './camera/shake';
import { isTextEntry } from './workshop/keys';
import {
  bindSettingsStore,
  clearSettingsRegistry,
  getSetting,
  registeredSettings,
  registerSetting,
  resetSetting,
  setSetting,
} from './settingsRegistry';
import { settingsModal } from '../ui/Menus';
import { asEl, FakeEvent, installFakeDom, type FakeEl } from './workshop/testDom';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyApp = Record<string, any>;

function keyEvent(key: string, target: unknown) {
  const ev = { key, target, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, prevented: false, preventDefault() {
    ev.prevented = true;
  }, stopPropagation() {} };
  return ev;
}

describe('duraklatma kancaları (1D, A-21)', () => {
  function keyApp(hook: (e: KeyboardEvent) => boolean) {
    const app = Object.create(App.prototype) as AnyApp;
    Object.assign(app, {
      modes: new ModeController('sandbox'),
      wsHandles: null,
      overlay: null,
      keyHooks: new Set(),
      priorityKeyHooks: new Set([hook]),
      swallowKeyUp: null,
    });
    return app;
  }

  it('Boşluk odak bir düğmedeyken de öncelikli kancaya gider; keyup da yutulur (düğme yeniden basılmaz)', () => {
    const seen: string[] = [];
    const app = keyApp((e) => {
      seen.push(e.key);
      return e.key === ' ';
    });
    for (const target of [{ tagName: 'BUTTON' }, { tagName: 'INPUT', type: 'checkbox' }, { tagName: 'INPUT', type: 'range' }, null]) {
      const down = keyEvent(' ', target);
      app.onKey(down);
      expect(down.prevented).toBe(true);
      const up = keyEvent(' ', target);
      app.onKeyUp(up);
      expect(up.prevented).toBe(true);
      // Sonraki keyup artık yutulmaz
      const up2 = keyEvent(' ', target);
      app.onKeyUp(up2);
      expect(up2.prevented).toBe(false);
    }
    expect(seen).toEqual([' ', ' ', ' ', ' ']);
  });

  it('metin girişinde öncelikli kanca çağrılmaz (yazılan boşluk kutunun)', () => {
    const hook = vi.fn(() => true);
    const app = keyApp(hook);
    for (const target of [{ tagName: 'INPUT', type: 'text' }, { tagName: 'INPUT', type: 'number' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }]) {
      const down = keyEvent(' ', target);
      app.onKey(down);
      expect(down.prevented).toBe(false);
    }
    expect(hook).not.toHaveBeenCalled();
    expect(isTextEntry({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextEntry({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(isTextEntry({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('duraklamada ders koşucusu ve sim 0 s ilerler; tek adım bir kare', () => {
    const app = Object.create(App.prototype) as AnyApp;
    const simSteps: number[] = [];
    const lessonSteps: number[] = [];
    Object.assign(app, {
      modes: new ModeController('lesson'),
      clock: new SimClock(),
      timeScale: 2,
      sim: { step: (d: number) => simSteps.push(d), snapshot: () => ({}) },
      autoStarter: { update: () => {} },
      visual: { update: () => {} },
      rig: { camera: new THREE.PerspectiveCamera() },
      runner: { update: (d: number) => lessonSteps.push(d) },
    });
    app.simFrame(1 / 60);
    app.clock.setPaused(true);
    app.simFrame(1 / 60);
    app.clock.stepOnce();
    app.simFrame(1 / 60);
    app.simFrame(1 / 60);
    // Derste zaman ölçeği 1 (yalnız test hücresinde ölçek)
    expect(simSteps).toEqual([1 / 60, 0, 1 / 60, 0]);
    expect(lessonSteps).toEqual(simSteps);
  });

  it('saat duraklayınca ses kısılır (App.wireClock → EngineAudio.setPaused)', () => {
    const app = Object.create(App.prototype) as AnyApp;
    Object.assign(app, { clock: new SimClock(), audio: new EngineAudio() });
    app.wireClock();
    app.audio.volume = 0.7;
    expect(app.audio.masterTarget).toBeCloseTo(0.63, 9);
    app.clock.toggle();
    expect(app.audio.paused).toBe(true);
    expect(app.audio.masterTarget).toBe(0);
    app.clock.toggle();
    expect(app.audio.masterTarget).toBeCloseTo(0.63, 9);
  });
});

describe('ses arayüzü taslağı (1D ↔ 1E)', () => {
  it('bugünkü kazanç aynı (ses düzeyi × 0,9); kapalı ya da duraklatılmış 0', () => {
    expect(masterTarget({ volume: 0.5, muted: false, paused: false })).toBe(0.45);
    expect(masterTarget({ volume: 0.5, muted: true, paused: false })).toBe(0);
    expect(masterTarget({ volume: 0.5, muted: false, paused: true })).toBe(0);
    expect(masterTarget({ volume: 0.5, muted: false, paused: false, busDb: { engine: -6 } })).toBeCloseTo(0.45 * 10 ** (-6 / 20), 9);
  });

  it('dB dönüşümü ve veri yolları', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(MIN_DB)).toBe(0);
    expect(gainToDb(0)).toBe(MIN_DB);
    expect(gainToDb(dbToGain(-12))).toBeCloseTo(-12, 9);
    const a = new EngineAudio();
    a.volumeDb = -6;
    expect(a.volume).toBeCloseTo(10 ** (-6 / 20), 9);
    expect(a.buses).toEqual(['engine', 'ui', 'ambience']);
    a.setBusDb('ui', -100);
    expect(a.busDb('ui')).toBe(MIN_DB);
  });
});

describe('otomatik çalıştırma bilgisi (1B)', () => {
  it('adımlar ileti taşır; App metni bilgiden alır; abort nedenli', () => {
    const sim = new EngineSim();
    const auto = new AutoStart();
    const got: [AutoStartStep, AutoStartInfo][] = [];
    auto.begin(sim);
    waitForSim(sim, () => !auto.active, { maxSeconds: 90, after: (s) => auto.update(s, (st, info) => got.push([st, info])) });
    expect(got.map(([s]) => s)).toEqual(['fuel', 'done']);
    expect(got[0][1].message).toBe(AUTOSTART_MESSAGES.fuel);
    const sim2 = new EngineSim();
    const a2 = new AutoStart();
    a2.begin(sim2);
    sim2.controls.starter = false;
    const ab: AutoStartInfo[] = [];
    waitForSim(sim2, () => !a2.active, { maxSeconds: 5, after: (s) => a2.update(s, (_st, info) => ab.push(info)) });
    expect(ab).toEqual([{ message: AUTOSTART_MESSAGES.noLightoff, reason: 'noLightoff' }]);
  });

  it('App olayı ileti, önem ve nedeni bilgiden yayar', () => {
    const app = Object.create(App.prototype) as AnyApp;
    const events: unknown[] = [];
    Object.assign(app, {
      sim: { time: 12.5 },
      bus: { emit: (e: unknown) => events.push(e) },
      autoStarter: { update: (_s: unknown, fn: (s: AutoStartStep, i: AutoStartInfo) => void) => fn('abort', { message: 'Sıcak çalıştırma: kesildi.', severity: 'warning', reason: 'hotStart' }) },
    });
    app.updateAutoStart();
    expect(events).toEqual([{ type: 'autoStartAbort', time: 12.5, severity: 'warning', message: 'Sıcak çalıştırma: kesildi.', reason: 'hotStart' }]);
  });
});

describe('yükleme hazır bayrağı (1A ↔ 1C, araçlar)', () => {
  afterEach(() => resetLoadProgress());

  it('ready sonrası aşamalar arka plan: fraction 1, done true; bayrak bir kez kalkar', () => {
    const g = globalThis as unknown as { window?: unknown };
    const prevWindow = g.window;
    const win = { __loadReady: undefined as boolean | undefined, dispatchEvent: () => true };
    g.window = win;
    try {
      resetLoadProgress();
      const got: LoadProgress[] = [];
      onLoadProgress((p) => got.push(p));
      emitLoadProgress('textures', 'x');
      expect(isLoadReady()).toBe(false);
      expect(win.__loadReady).toBe(false);
      emitLoadProgress('ready', 'Hazır');
      emitLoadProgress('airfield', 'Havaalanı (arka planda)');
      emitLoadProgress('firstFrame', 'İlk kare');
      expect(isLoadReady()).toBe(true);
      expect(win.__loadReady).toBe(true);
      expect(got.map((p) => [p.stage, p.fraction, p.done])).toEqual([
        ['textures', 0, false],
        ['ready', 1, true],
        ['airfield', 1, true],
        ['firstFrame', 1, true],
      ]);
    } finally {
      g.window = prevWindow;
    }
  });
});

describe('sarsıntı girdisi (1I)', () => {
  it('sayı ve girdi aynı kaymayı verir (Math.random sırası korunur); remove geri alır', () => {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(1, 2, 3);
    const q0 = cam.quaternion.clone();
    const sh = new CameraShake();
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.75);
    sh.apply(cam, { amount: 1, dt: 1 / 60, thrustFrac: 1, proximity: 0.5, impulse: 0 });
    expect(cam.position.x).toBeCloseTo(1 + 0.25 * 0.035, 12);
    expect(rnd).toHaveBeenCalledTimes(3);
    expect(sh.last.thrustFrac).toBe(1);
    sh.remove(cam);
    expect(cam.position.toArray()).toEqual([1, 2, 3]);
    expect(cam.quaternion.equals(q0)).toBe(true);
    sh.apply(cam, 0);
    expect(rnd).toHaveBeenCalledTimes(3);
    rnd.mockRestore();
  });
});

describe('ayar kayıt defteri', () => {
  afterEach(() => clearSettingsRegistry());

  it('kayıt, kalıcılık, kırpma, sıfırlama; App deposu bağlanınca kalıcı değer uygulanır', () => {
    const applied: number[] = [];
    const store: Record<string, unknown> = { 'camera.shake': 0.4, 'x.bozuk': 'metin' };
    const save = vi.fn();
    bindSettingsStore(store, save);
    const h = registerSetting({ key: 'camera.shake', label: 'Kamera sarsıntısı', tab: 'kamera', control: { type: 'range', min: 0, max: 1, step: 0.05 }, default: 1, apply: (v) => applied.push(v) });
    expect(h.get()).toBe(0.4);
    expect(applied).toEqual([0.4]);
    h.set(3);
    expect(store['camera.shake']).toBe(1);
    expect(save).toHaveBeenCalled();
    resetSetting('camera.shake');
    expect('camera.shake' in store).toBe(false);
    expect(getSetting('camera.shake')).toBe(1);
    expect(applied).toEqual([0.4, 1, 1]);
    // Türü uyuşmayan kalıcı değer → varsayılan
    registerSetting({ key: 'x.bozuk', label: 'b', tab: 'oynanis', control: { type: 'toggle' }, default: true });
    expect(getSetting('x.bozuk')).toBe(true);
    expect(() => registerSetting({ key: 'camera.shake', label: 'tekrar', tab: 'kamera', control: { type: 'toggle' }, default: true })).toThrow(/iki kez/);
    expect(() => registerSetting({ key: 'tekparca', label: 'x', tab: 'kamera', control: { type: 'toggle' }, default: true })).toThrow(/alan\.ad/);
    expect(registeredSettings('kamera').map((d) => d.key)).toEqual(['camera.shake']);
  });

  it('depo bağlanmadan ayarlanan değer bağlanınca depoya yazılır', () => {
    registerSetting({ key: 'audio.bus', label: 'x', tab: 'ses', control: { type: 'select', options: [['a', 'A'], ['b', 'B']] }, default: 'a' });
    setSetting('audio.bus', 'b');
    setSetting('audio.bus', 'yok');
    expect(getSetting('audio.bus')).toBe('a');
    setSetting('audio.bus', 'b');
    const store: Record<string, unknown> = {};
    bindSettingsStore(store, () => {});
    expect(store['audio.bus']).toBe('b');
  });

  it('Ayarlar penceresi kayıtlı ayarı sekme başlığıyla çizer; kayıt yoksa eskisi gibi', () => {
    const restore = installFakeDom();
    try {
      const current = { quality: 'high' as const, volume: 0.5, muted: false, environment: 'Test hücresi' };
      const cb = { onQuality: () => {}, onVolume: () => {}, onMute: () => {}, onEnvironment: () => {} };
      const count = (el: FakeEl, cls: string) => el.querySelectorAll(`.${cls}`).length;
      const plain = asEl(settingsModal(current, ['Test hücresi'], 'Test hücresi', cb, () => {}));
      const rows0 = count(plain, 'settings-row');
      registerSetting({ key: 'camera.shake', label: 'Kamera sarsıntısı', tab: 'kamera', control: { type: 'range', min: 0, max: 1, step: 0.05 }, default: 1 });
      const withReg = asEl(settingsModal(current, ['Test hücresi'], 'Test hücresi', cb, () => {}));
      expect(count(withReg, 'settings-row')).toBe(rows0 + 1);
      const labels = withReg.querySelectorAll('.section-label').map((e) => e.textContent);
      expect(labels).toContain('Kamera');
      const range = withReg.querySelectorAll('input').find((e) => e.getAttribute('aria-label') === 'Kamera sarsıntısı');
      expect(range).toBeTruthy();
      (range as unknown as { value: string }).value = '0.25';
      range!.dispatchEvent(new FakeEvent('input'));
      expect(getSetting('camera.shake')).toBe(0.25);
    } finally {
      restore();
    }
  });
});

describe('motorun ekran dikdörtgeni kutusu (1D, A-03)', () => {
  const part = (name: string, size: number, z: number, tag: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size));
    m.name = name;
    m.position.z = z;
    m.userData.part = tag;
    return m;
  };
  it('gizli parça (kanat kesiti) yalnız kesit kırpmasının kutusuna girer', () => {
    const root = new THREE.Group();
    root.add(part('fan-cowl', 2, 0, 'nacelle'));
    const wing = new THREE.Group();
    wing.visible = false;
    wing.add(part('wing', 6, 3, 'wing'));
    root.add(wing);
    root.add(part('stand', 8, 0, 'stand'));
    const all = engineBox(root);
    const shown = engineBox(root, { visibleOnly: true });
    expect(all.max.z).toBeCloseTo(6);
    expect(shown.min.toArray()).toEqual([-1, -1, -1]);
    expect(shown.max.toArray()).toEqual([1, 1, 1]);
  });
});