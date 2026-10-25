/**
 * Dalga 0 sözleşmeleri: olay akışı ve olay bekleme (T-20), otomatik
 * çalıştırma sırası, sim durumu yakalama imzası (gövde 2H), kip
 * denetleyicisi, simülasyon saati, yükleme olayı. Dalga 1 paketleri bu
 * API'lere dayanır. (Kamera ve ışık: camera/camera.test.ts)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngineSim, type SimEvent } from '../sim';
import { AutoStart, type AutoStartStep } from '../sim/autostart';
import { EventBus, type GameEvent } from './events';
import { advanceUntil, waitForSim } from './waitFor';
import { ModeController } from './modes/ModeController';
import { SimClock } from './simClock';
import { emitLoadProgress, LOAD_WEIGHTS, onLoadProgress, resetLoadProgress, stageFraction, type LoadProgress } from './loadProgress';

describe('olay bekleme (T-20)', () => {
  /** Otomatik çalıştırma App'teki gibi: her sim adımından sonra */
  function autoRig() {
    const sim = new EngineSim();
    const auto = new AutoStart();
    const steps: AutoStartStep[] = [];
    const after = (s: EngineSim) => auto.update(s, (x) => steps.push(x));
    return { sim, auto, steps, after };
  }

  it('otomatik çalıştırma: yakıt → light-off → rölanti → sıra biter (süre değil olay)', () => {
    const { sim, auto, steps, after } = autoRig();
    expect(auto.begin(sim)).toBe(true);
    const lo = waitForSim(sim, 'lightoff', { maxSeconds: 90, after });
    expect(lo.ok).toBe(true);
    expect(lo.event?.type).toBe('lightoff');
    expect(steps).toEqual(['fuel']);
    expect(sim.lit).toBe(true);
    const idle = waitForSim(sim, 'idle', { maxSeconds: 90, after });
    expect(idle.ok).toBe(true);
    const done = waitForSim(sim, () => !auto.active, { maxSeconds: 90, after });
    expect(done.ok).toBe(true);
    expect(steps).toEqual(['fuel', 'done']);
    expect(sim.controls.apuBleed).toBe(false);
    expect(sim.controls.ignition).toBe(false);
  });

  it('motor yanıyorsa otomatik çalıştırma başlamaz', () => {
    const { sim, auto } = autoRig();
    sim.trim(0, 5);
    expect(auto.begin(sim)).toBe(false);
    expect(auto.active).toBe(false);
  });

  it('marş kapanıp motor yanmazsa sıra bırakılır (abort bir kez)', () => {
    const { sim, auto, steps, after } = autoRig();
    auto.begin(sim);
    sim.controls.starter = false;
    waitForSim(sim, () => !auto.active, { maxSeconds: 5, after });
    expect(auto.active).toBe(false);
    expect(steps).toEqual(['abort']);
  });

  it('süre dolarsa ok false döner (atmaz); koşul baştan doğruysa 0 s', () => {
    const sim = new EngineSim();
    const r = waitForSim(sim, 'surge', { maxSeconds: 0.5 });
    expect(r.ok).toBe(false);
    expect(r.event).toBe(null);
    expect(r.seconds).toBeGreaterThanOrEqual(0.5 - 1e-6);
    expect(waitForSim(sim, () => true).seconds).toBe(0);
  });

  it('advanceUntil: olay geldiği adımda durur, abonelik bırakılır', () => {
    const bus = new EventBus();
    let t = 0;
    const r = advanceUntil<GameEvent>({
      step: (dt) => {
        t += dt;
        if (t > 1) bus.emit({ type: 'autoStartFuel', time: t, severity: 'info', message: '' });
      },
      subscribe: (fn) => bus.on(fn),
      target: 'autoStartFuel',
      dt: 0.25,
    });
    expect(r.ok).toBe(true);
    expect(r.seconds).toBeCloseTo(1.25, 9);
    expect(bus.size).toBe(0);
  });

  it('olay akışı: dinleyici hatası öbürlerini kesmez, abonelik kaldırılır', () => {
    const bus = new EventBus();
    const got: string[] = [];
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.on(() => {
      throw new Error('x');
    });
    const off = bus.on((e) => got.push(e.type));
    const e: SimEvent = { type: 'surge', time: 0, severity: 'warning', message: '' };
    bus.emit(e);
    off();
    bus.emit(e);
    expect(got).toEqual(['surge']);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('sim durumu yakalama (imza Dalga 0, gövde 2H)', () => {
  it('captureState / restore var ve gövde gelene kadar açıkça atar', () => {
    const sim = new EngineSim();
    expect(typeof sim.captureState).toBe('function');
    expect(typeof sim.restore).toBe('function');
    expect(() => sim.captureState()).toThrow(/2H/);
    expect(() => sim.restore({ version: 1, kind: 'turbofan', time: 0 })).toThrow(/2H/);
  });
});

describe('kip denetleyicisi', () => {
  it('değişimi bildirir, aynı kip sessiz, dinleyici hatası yalıtılır', () => {
    const m = new ModeController('menu');
    const seen: string[] = [];
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.onChange(() => {
      throw new Error('x');
    });
    const off = m.onChange(({ from, to }) => seen.push(`${from}>${to}`));
    m.set('sandbox');
    m.set('sandbox');
    m.set('workshop');
    off();
    m.set('menu');
    expect(seen).toEqual(['menu>sandbox', 'sandbox>workshop']);
    expect(m.current).toBe('menu');
    err.mockRestore();
  });
});

describe('simülasyon saati', () => {
  it('duraklatılmamışken dt × ölçek (eski davranış); duraklatınca 0, tek adım bir kare', () => {
    const c = new SimClock();
    expect(c.simDt(1 / 60, 2)).toBe((1 / 60) * 2);
    const seen: boolean[] = [];
    c.onChange((p) => seen.push(p));
    c.toggle();
    expect(c.simDt(1 / 60)).toBe(0);
    c.stepOnce();
    expect(c.simDt(1 / 60)).toBe(1 / 60);
    expect(c.simDt(1 / 60)).toBe(0);
    c.setPaused(false);
    expect(seen).toEqual([true, false]);
  });
});

describe('yükleme olayı', () => {
  afterEach(() => resetLoadProgress());

  it('ağırlıklar toplamı 1, ilerleme azalmaz, ready = 1', () => {
    const sum = Object.values(LOAD_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    const stages = Object.keys(LOAD_WEIGHTS) as (keyof typeof LOAD_WEIGHTS)[];
    let prev = -1;
    for (const s of stages) {
      expect(stageFraction(s)).toBeGreaterThan(prev);
      prev = stageFraction(s);
    }
    expect(stageFraction('ready')).toBe(1);
  });

  it('dinleyiciler sırayla alır, son olay geç abone olana da gelir', () => {
    const got: LoadProgress[] = [];
    onLoadProgress((p) => got.push(p));
    emitLoadProgress('textures', 'Yüzey dokuları üretiliyor…');
    emitLoadProgress('airfield', 'Havaalanı yükleniyor…');
    emitLoadProgress('ready', 'Hazır');
    expect(got.map((p) => p.stage)).toEqual(['textures', 'airfield', 'ready']);
    expect(got[2].done).toBe(true);
    expect(got[1].fraction).toBeGreaterThan(got[0].fraction);
    const late: LoadProgress[] = [];
    onLoadProgress((p) => late.push(p));
    expect(late.map((p) => p.stage)).toEqual(['ready']);
  });
});
