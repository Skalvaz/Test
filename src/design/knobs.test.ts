/**
 * M5a P4b: düğme kataloğu. Kimlikler, okuma/yazma, aralıklar, aralık
 * uçlarında tipli hata, çözülebilir aralık ve duyarlılık.
 */

import { describe, expect, it } from 'vitest';
import { DesignError } from '../sim/design';
import { fakeDiff, fakeSummarize, fakeTranslate, rng } from '../workshop/testing';
import { FlowpathError } from './flowpath';
import { buildEngine, GraphError } from './graph';
import {
  clampEngineKnob,
  ENGINE_KNOBS,
  feasibleRange,
  KNOB_ALIASES,
  KNOB_IDS,
  KNOB_MAP,
  knobById,
  knobCtx,
  knobRange,
  sensitivity,
  stepValue,
} from './knobs';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import type { EngineGraph } from './types';

const TEMPLATES: [string, EngineGraph][] = [
  ['turbojet', TURBOJET_GRAPH],
  ['militaryTurbofan', MILITARY_TURBOFAN_GRAPH],
  ['turboprop', TURBOPROP_GRAPH],
  ['turbofan', TURBOFAN_GRAPH],
];

const typed = (e: unknown) => e instanceof GraphError || e instanceof FlowpathError || e instanceof DesignError;

describe('düğme kataloğu', () => {
  it('her kimlik bir kez, KNOB_IDS ile aynı sırada; tanımlar dolu', () => {
    expect(ENGINE_KNOBS.map((k) => k.id)).toEqual([...KNOB_IDS]);
    expect(new Set(KNOB_IDS).size).toBe(KNOB_IDS.length);
    expect(KNOB_MAP.size).toBe(KNOB_IDS.length);
    expect(KNOB_ALIASES).toEqual({});
    for (const k of ENGINE_KNOBS) {
      expect(k.label.length, k.id).toBeGreaterThan(2);
      expect(k.explain.length, k.id).toBeGreaterThan(10);
      expect(k.step, k.id).toBeGreaterThan(0);
      expect(k.path[0], k.id).toBe(k.id.split('.')[0]);
      expect(['basic', 'expert']).toContain(k.level);
    }
    // §2.10: temel düğmeler B tablosundakiler, kimliği belgeye yazılan ad
    expect(ENGINE_KNOBS.filter((k) => k.level === 'basic').map((k) => k.id)).toEqual(KNOB_IDS.slice(0, 18));
  });

  it('kapsam: varyant düğmeleri yalnız itki sınıfı ayarları', () => {
    expect(ENGINE_KNOBS.filter((k) => k.scope === 'variant').map((k) => k.id)).toEqual([
      'fan.pr',
      'fan.bypassRatio',
      'lpc.pr',
      'hpc.pr',
      'combustor.tit',
      'afterburner.t7Max',
      'propeller.rpm',
    ]);
  });

  it.each(TEMPLATES)('%s: düğmeler bağlama göre var/yok; şablon değerleri aralık içinde', (_k, g) => {
    const ctx = knobCtx(g);
    let shown = 0;
    for (const k of ENGINE_KNOBS) {
      const r = k.range(ctx);
      const v = k.get(g);
      if (!r) continue;
      if (v === undefined) continue;
      shown++;
      expect(typeof v, k.id).toBe('number');
      expect(v as number, `${k.id} alt`).toBeGreaterThanOrEqual(r[0]);
      expect(v as number, `${k.id} üst`).toBeLessThanOrEqual(r[1]);
    }
    expect(shown).toBeGreaterThan(40);
    // Temel düğmelerden en çok ~8–9'u bir motorda görünür
    const basic = ENGINE_KNOBS.filter((k) => k.level === 'basic' && k.range(ctx) && k.get(g) !== undefined);
    expect(basic.length).toBeLessThanOrEqual(10);
  });

  it('bağlama özgü aralıklar (§2.10)', () => {
    const tf = knobCtx(TURBOFAN_GRAPH);
    const mtf = knobCtx(MILITARY_TURBOFAN_GRAPH);
    const tj = knobCtx(TURBOJET_GRAPH);
    const tp = knobCtx(TURBOPROP_GRAPH);
    // Bulanık testten sonra daraltılan aralıklar (§2.10 tablosundaki kalın değerler)
    expect(knobRange('fan.pr', tf.traits)).toEqual([1.4, 1.8]);
    expect(knobRange('fan.pr', mtf.traits)).toEqual([1.8, 4.5]);
    expect(knobRange('fan.bypassRatio', tf.traits)).toEqual([3, 11]);
    expect(knobRange('fan.bypassRatio', mtf.traits)).toEqual([0.1, 1.5]);
    expect(knobRange('lpc.pr', tj.traits)).toEqual([2.2, 5]);
    expect(knobRange('lpc.pr', tf.traits)).toEqual([1.1, 2.5]);
    expect(knobRange('lpc.pr', mtf.traits)).toBeNull();
    expect(knobRange('hpc.pr', tj.traits)).toEqual([2, 6]);
    expect(knobRange('hpc.pr', mtf.traits)).toEqual([4, 12]);
    expect(knobRange('hpc.pr', tf.traits)).toEqual([8, 25]);
    expect(knobRange('hpc.pr', tp.traits)).toEqual([6, 20]);
    expect(knobRange('combustor.tit', tf.traits)).toEqual([1500, 1900]);
    expect(knobRange('combustor.tit', mtf.traits)).toEqual([1300, 1900]);
    expect(knobRange('combustor.tit', tp.traits)).toEqual([1150, 1750]);
    expect(knobRange('engine.massFlow', tf.traits)).toEqual([150, 1500]);
    expect(knobRange('engine.massFlow', tp.traits)).toEqual([3, 30]);
    expect(knobRange('lpc.tipSpeed', tj.traits)).toEqual([300, 520]);
    expect(knobRange('lpc.tipSpeed', tf.traits)).toBeNull();
    expect(knobRange('nozzle.chevrons.bypass', tf.traits)).toEqual([0, 24]);
    expect(knobRange('nozzle.chevrons.bypass', tj.traits)).toBeNull();
    expect(knobRange('combustor.tit', tj.traits)).toEqual([1050, 1650]);
    // fan.hubTip M5a'da gizli
    expect(knobRange('fan.hubTip', tf.traits)).toBeNull();
  });

  it.each(TEMPLATES)('%s: get(set(g, v)) === clamp(v); set saf (girdi değişmez)', (_k, g) => {
    const ctx = knobCtx(g);
    const before = JSON.stringify(g);
    const r = rng(7);
    for (const k of ENGINE_KNOBS) {
      const range = k.range(ctx);
      if (!range || k.get(g) === undefined) continue;
      const span = range[1] - range[0];
      for (const v of [range[0] - span, range[0], range[1], range[1] + 2 * span, range[0] + r() * span, range[0] + r() * span, 'x']) {
        const c = clampEngineKnob(k, v as number, ctx);
        const out = k.set(g, c);
        expect(k.get(out), `${k.id} ← ${String(v)}`).toBe(c);
        expect(c as number).toBeGreaterThanOrEqual(range[0]);
        expect(c as number).toBeLessThanOrEqual(range[1]);
        if (k.type === 'int') expect(Number.isInteger(c)).toBe(true);
      }
    }
    expect(JSON.stringify(g)).toBe(before);
  });

  it('chevron: 0 ya da 8–24, çift', () => {
    const k = knobById('nozzle.chevrons.bypass')!;
    const ctx = knobCtx(TURBOFAN_GRAPH);
    expect([0, 2, 3, 4, 5, 8, 13, 24, 30].map((v) => clampEngineKnob(k, v, ctx))).toEqual([0, 0, 0, 8, 8, 8, 14, 24, 24]);
  });

  it('motor düzeyi düğmeler: hava akışı, aksesuar gücü (ops düzeltmesi), baypas kanalı', () => {
    const g = structuredClone(TURBOFAN_GRAPH);
    const mf = knobById('engine.massFlow')!;
    expect(mf.get(g)).toBe(1150);
    expect(mf.set(g, 900).massFlow).toBe(900);
    const acc = knobById('engine.accessoryPower')!;
    expect(acc.get(g)).toBe(350e3);
    const g2 = acc.set(g, 200e3);
    expect(g2.ops?.accessoryPower).toBe(200e3);
    expect(g2.ops?.inertia).toEqual(g.ops?.inertia);
    expect(g2.accessoryPower).toBe(350e3);
    expect(buildEngine(g2).design.accessoryPower).toBe(200e3);
    expect(knobById('bypassDuct.mach')!.set(g, 0.4).bypassDuct?.mach).toBe(0.4);
  });

  it('bağlamın mimarisi tembel: okunmadıkça architecture.ts çağrılmaz', () => {
    expect(() => knobCtx(TURBOJET_GRAPH)).not.toThrow();
    const ctx = knobCtx(TURBOJET_GRAPH, { arch: { output: 'thrust' } as never });
    expect(ctx.arch.output).toBe('thrust');
  });

  it('adım: log ölçekte görece, aralık sonunda geri', () => {
    const ctx = knobCtx(TURBOFAN_GRAPH);
    const mf = knobById('engine.massFlow')!;
    expect(stepValue(mf, 1000, ctx)).toBeCloseTo(1010, 9);
    expect(stepValue(mf, 1500, ctx)).toBeCloseTo(1485, 9);
    expect(stepValue(knobById('hpc.pr')!, 16.5, ctx)).toBeCloseTo(16.6, 9);
  });
});

describe('aralık uçlarında şablon kurulur ya da tipli hata verir', () => {
  it.each(TEMPLATES)('%s', (_k, g) => {
    const ctx = knobCtx(g);
    let ok = 0;
    let failed = 0;
    for (const k of ENGINE_KNOBS) {
      const r = k.range(ctx);
      if (!r || k.get(g) === undefined) continue;
      for (const v of r) {
        try {
          const b = buildEngine(k.set(g, clampEngineKnob(k, v, ctx)));
          for (const x of [b.sized.point.thrust, b.flowpath.metrics.mass.total, b.flowpath.metrics.diameter, b.flowpath.metrics.length]) {
            expect(Number.isFinite(x), `${k.id}=${v}`).toBe(true);
          }
          ok++;
        } catch (e) {
          expect(typed(e), `${k.id}=${v}: ${String(e)}`).toBe(true);
          expect((e as Error).message.length).toBeGreaterThan(10);
          failed++;
        }
      }
    }
    expect(ok).toBeGreaterThan(failed);
  });
});

describe('çözülebilir aralık ve duyarlılık', () => {
  it("TF: fan.pr üst sınırı 1,58–1,70, nedeni 'P5 ≤ P0'", () => {
    const k = knobById('fan.pr')!;
    const f = feasibleRange(TURBOFAN_GRAPH, k, knobCtx(TURBOFAN_GRAPH), { translate: fakeTranslate });
    expect(f.hi).toBeGreaterThanOrEqual(1.58);
    expect(f.hi).toBeLessThanOrEqual(1.7);
    expect(f.hiReason?.raw).toMatch(/P5/);
    // Alt uç: aralık fan çıkış kanalının kapandığı yerin hemen üstünde
    // (1,4) kesildi; aralığın altında kanal kapanır (düşük basınçta yoğunluk
    // az, alan büyük)
    expect(f.lo).toBe(1.4);
    expect(f.loReason).toBeUndefined();
    let below: unknown;
    try {
      buildEngine(k.set(TURBOFAN_GRAPH, 1.35));
    } catch (e) {
      below = e;
    }
    expect(below).toBeInstanceOf(FlowpathError);
    expect(fakeTranslate(below)).toMatchObject({ source: 'flowpath', group: 'fan' });
    // Sınırın hemen altı kurulur, üstü kurulmaz
    expect(() => buildEngine(k.set(TURBOFAN_GRAPH, f.hi))).not.toThrow();
    expect(() => buildEngine(k.set(TURBOFAN_GRAPH, f.hi + 0.01))).toThrow(DesignError);
  });

  it('tamsayı düğme ve geçersiz başlangıç', () => {
    const cans = knobById('combustor.cans')!;
    const g = structuredClone(TURBOJET_GRAPH);
    const c = g.modules.find((m) => m.type === 'combustor')!;
    Object.assign(c, { style: 'can', cans: 8 });
    const f = feasibleRange(g, cans, knobCtx(g), { translate: fakeTranslate });
    expect(Number.isInteger(f.lo) && Number.isInteger(f.hi)).toBe(true);
    expect(f.lo).toBeGreaterThanOrEqual(6);
    expect(f.hi).toBeLessThanOrEqual(16);
    // Geçersiz başlangıç: aralık o değere çöker, iki neden de aynı hata
    const bad = knobById('fan.pr')!.set(TURBOFAN_GRAPH, 1.9);
    const fb = feasibleRange(bad, knobById('combustor.tit')!, knobCtx(bad), { translate: fakeTranslate });
    expect(fb.lo).toBe(fb.hi);
    expect(fb.hiReason?.raw).toMatch(/P5/);
  });

  it('duyarlılık: +1 adımın etkisi (taklit özetle)', () => {
    const d = sensitivity(TURBOFAN_GRAPH, knobById('combustor.tit')!, knobCtx(TURBOFAN_GRAPH), { summarize: fakeSummarize, diff: fakeDiff });
    const thrust = d.find((x) => x.key === 'thrust')!;
    expect(thrust.abs).toBeGreaterThan(0);
    expect(thrust.better).toBe(true);
    // Uygulanamayan düğme: boş
    expect(sensitivity(TURBOJET_GRAPH, knobById('fan.pr')!, knobCtx(TURBOJET_GRAPH), { summarize: fakeSummarize, diff: fakeDiff })).toEqual([]);
  });
});
