/**
 * Çalışabilirlik ölçeklemesi (M5a P1, docs/M5A-SPEC.md §2.8): atalet rotor
 * ataletiyle, marş torku HP ataleti × devirle; şablonun kendisinde kimlik;
 * ölçeklenmiş motorlar (×0,3 / ×3 hava akışı) çalışır ve tam güce çıkar.
 */

import { describe, expect, it } from 'vitest';
import { sizeEngine, type EngineDesign } from '../sim/design';
import { EngineSim, type SimEventType } from '../sim/engineSim';
import { TEMPLATES } from './catalog';
import { computeGasPath } from './flowpath';
import { buildEngine, toEngineDesign, type BuiltEngine } from './graph';
import { layoutNotReady } from './layouts/index';
import { deriveOperability, opsOf, rotorInertia } from './operability';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import type { EngineGraph, NozzleModule, Operability } from './types';

/**
 * Ağır (sim koşan) testlerin süre sınırı. Testteki sınır CLI/config
 * `testTimeout`'unu ezer: yük altında (CPU %100) bir koşu ~65 s sürebiliyor.
 */
const HEAVY = 120_000;

const TEMPLATE_GRAPHS: [string, EngineGraph][] = [
  ['turbojet', TURBOJET_GRAPH],
  ['militaryTurbofan', MILITARY_TURBOFAN_GRAPH],
  ['turboprop', TURBOPROP_GRAPH],
  ['turbofan', TURBOFAN_GRAPH],
];

/** Şablonun çalışabilirliksiz kopyası (atölye grafiği gibi) */
function withoutOps(g: EngineGraph, massScale = 1): EngineGraph {
  const c = structuredClone(g);
  delete c.ops;
  delete c.kind;
  c.massFlow *= massScale;
  return c;
}

/** Bütün sayısal alanların bağıl farkı (en büyük) */
function maxRelDiff(a: Operability, b: Operability): number {
  let m = 0;
  const walk = (x: unknown, y: unknown) => {
    if (typeof x === 'number' && typeof y === 'number') m = Math.max(m, Math.abs(x - y) / Math.max(Math.abs(y), 1e-300));
    else if (x && typeof x === 'object') for (const k of Object.keys(x)) walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]);
  };
  walk(a, b);
  return m;
}

describe('deriveOperability', () => {
  it.each(TEMPLATE_GRAPHS)('%s: şablonun kendisine uygulanınca kimlik (< 1e-12)', (_k, g) => {
    const ref = buildEngine(g);
    const refOps = opsOf(ref.design);
    // Doğrudan: referansın kendi gaz yolu ve kütlesiyle
    const direct = deriveOperability(withoutOps(g), ref, ref, refOps);
    expect(maxRelDiff(direct, refOps)).toBeLessThan(1e-12);
    // buildEngine yoluyla: ops'suz grafik + şablon referansı
    const b = buildEngine(withoutOps(g), { reference: ref });
    expect(maxRelDiff(opsOf(b.design), refOps)).toBeLessThan(1e-12);
    expect(b.design.accessoryPower).toBe(ref.design.accessoryPower);
  });

  it('g.ops alan alan üstüne yazar; limitler ve harita referanstan aynen', () => {
    const ref = buildEngine(TURBOJET_GRAPH);
    const g = withoutOps(TURBOJET_GRAPH, 2);
    const limits = { ...ref.design.limits, egtAmber: 840 };
    g.ops = { limits };
    const b = buildEngine(g, { reference: ref });
    expect(b.design.limits).toEqual(limits);
    expect(b.design.hpcMap).toEqual(ref.design.hpcMap);
    // Atalet ölçeklendi (verilmedi), marşın diğer alanları referanstan
    expect(b.design.inertia.hp).toBeGreaterThan(ref.design.inertia.hp * 2);
    expect(b.design.start.starterFadeN2).toBe(ref.design.start.starterFadeN2);
    expect(b.design.start.farHigh).toBe(ref.design.start.farHigh);
  });

  it('şablon klonu (ops referansla aynı) ölçeklenir; yalnız farklı alt alan uzman düzeltmesidir', () => {
    // Atölye şablondan başlarken grafik ops'u aynen taşır: miras sayılmalı
    const ref = buildEngine(TURBOFAN_GRAPH);
    const clone = structuredClone(TURBOFAN_GRAPH);
    delete clone.kind;
    clone.massFlow *= 3;
    const scaled = buildEngine(withoutOps(TURBOFAN_GRAPH, 3), { reference: ref }).design;
    const b = buildEngine(clone, { reference: ref }).design;
    expect(b.inertia).toEqual(scaled.inertia);
    expect(b.start).toEqual(scaled.start);
    expect(b.inertia.hp).toBeGreaterThan(ref.design.inertia.hp * 5);
    expect(b.start.starterTorque).toBeGreaterThan(ref.design.start.starterTorque * 5);
    // Uzman düzeltmesi (referanstan farklı alt alan) üstüne yazar, diğeri ölçekli kalır
    clone.ops = { ...clone.ops, start: { ...clone.ops!.start!, starterTorque: 1234 } };
    const own = buildEngine(clone, { reference: ref }).design;
    expect(own.start.starterTorque).toBe(1234);
    expect(own.inertia).toEqual(scaled.inertia);
    // Şablonun kendisi (ops'lu) referansıyla: kimlik
    expect(maxRelDiff(opsOf(buildEngine(TURBOFAN_GRAPH, { reference: ref }).design), opsOf(ref.design))).toBeLessThan(1e-12);
  });

  it('atalet geometrik ölçekle ~W^2,5 büyür; marş torku I·ω ile, sınırlar içinde', () => {
    const ref = buildEngine(TURBOJET_GRAPH);
    const big = buildEngine(withoutOps(TURBOJET_GRAPH, 2), { reference: ref }).design;
    const small = buildEngine(withoutOps(TURBOJET_GRAPH, 0.5), { reference: ref }).design;
    // Benzer motorda kütle ∝ W^1,5, yarıçap² ∝ W
    for (const s of ['lp', 'hp'] as const) {
      expect(big.inertia[s] / ref.design.inertia[s]).toBeGreaterThan(2 ** 2.3);
      expect(big.inertia[s] / ref.design.inertia[s]).toBeLessThan(2 ** 2.7);
      expect(small.inertia[s] / ref.design.inertia[s]).toBeLessThan(0.5 ** 2.3);
    }
    // τ ∝ I·ω (marşın ivmelendirme süresi korunur)
    const k = (d: EngineDesign) => d.start.starterTorque / ((d.inertia.hp * d.n2Rpm) / (ref.design.inertia.hp * ref.design.n2Rpm));
    expect(k(big)).toBeCloseTo(ref.design.start.starterTorque, 6);
    expect(k(small)).toBeCloseTo(ref.design.start.starterTorque, 6);
    // Çok küçük motorda kırpılır (×0,25)
    const tiny = buildEngine(withoutOps(TURBOJET_GRAPH, 0.15), { reference: ref }).design;
    expect(tiny.start.starterTorque).toBeCloseTo(0.25 * ref.design.start.starterTorque, 9);
  });

  it('pervane LP ataletine redüktör oranının karesiyle girer', () => {
    const tp = buildEngine(TURBOPROP_GRAPH);
    const { gas, metrics } = tp.flowpath;
    const rotorsOnly = rotorInertia(gas, 'lp', metrics.mass);
    expect(rotorsOnly).toBeGreaterThan(0);
    // Pervane çapı %25 büyük (kütle ∝ D², atalet ∝ D⁴): LP ataleti büyür, HP değişmez
    const g = withoutOps(TURBOPROP_GRAPH);
    (g.modules.find((m) => m.type === 'propeller') as { diameter: number }).diameter *= 1.25;
    const b = buildEngine(g, { reference: tp });
    expect(b.design.inertia.lp).toBeGreaterThan(tp.design.inertia.lp * 1.5);
    expect(b.design.inertia.hp).toBeCloseTo(tp.design.inertia.hp, 9);
  });
});

/* ------------------------------------------------------------------ */
/* Ölçeklenmiş art yakıcısız turbojet                                  */
/* ------------------------------------------------------------------ */

const rpmOf = (w: number) => (w * 60) / (2 * Math.PI);

/**
 * Kuru turbojet: P5 şablonu varsa o; yoksa TJ − art yakıcı, sabit yakınsak
 * lüle (döner parçaları TJ ile aynı).
 */
function dryTurbojet(): EngineGraph {
  if (TEMPLATES.turbojetDry) return TEMPLATES.turbojetDry;
  const g = withoutOps(TURBOJET_GRAPH);
  g.ops = structuredClone(TURBOJET_GRAPH.ops);
  g.modules = g.modules.filter((m) => m.type !== 'afterburner');
  const n = g.modules.find((m) => m.type === 'nozzle') as NozzleModule;
  Object.assign(n, { style: 'fixed', cv: 0.98 });
  delete n.flaps;
  return g;
}

/**
 * Ölçeklenmiş kuru turbojetin tasarımı, aile şablonu referansıyla. Kuru
 * çıplak yerleşim (P5) gelene dek çalışabilirlik, döner parçaları aynı
 * olan art yakıcılı eşdeğerden türetilir ve devirler gaz yolundan alınır.
 */
function scaledDry(k: number): EngineDesign {
  const base = dryTurbojet();
  const g = withoutOps(base, k);
  if (!layoutNotReady(g)) return buildEngine(g, { reference: buildEngine(base) }).design;
  const refTJ: BuiltEngine = buildEngine(TURBOJET_GRAPH);
  g.ops = opsOf(buildEngine(withoutOps(TURBOJET_GRAPH, k), { reference: refTJ }).design);
  const d = toEngineDesign(g, { reference: refTJ });
  const gp = computeGasPath(g, sizeEngine(d));
  return { ...d, n1Rpm: rpmOf(gp.omega.lp), n2Rpm: rpmOf(gp.omega.hp) };
}

describe('ölçeklenmiş kuru turbojet (×0,3 / ×1 / ×3 hava akışı)', () => {
  it.each([0.3, 1, 3])('×%s: 60 s içinde rölanti, sıcak çalıştırma yok, 10 s içinde tam güç', (k) => {
    const d = scaledDry(k);
    expect(d.afterburner).toBeUndefined();
    const sim = new EngineSim(d);
    const seen: SimEventType[] = [];
    let idleAt = -1;
    sim.on((e) => {
      seen.push(e.type);
      if (e.type === 'idle' && idleAt < 0) idleAt = e.time;
    });
    // Normal prosedür (App otomatik çalıştırmasıyla aynı)
    Object.assign(sim.controls, { apuBleed: true, starter: true, ignition: true });
    let peakEgt = -99;
    for (let t = 0; t < 60; t += 1 / 60) {
      if (!sim.controls.fuelRun && sim.N2 >= sim.limits.fuelOnMinN2 + 0.02) sim.controls.fuelRun = true;
      sim.step(1 / 60);
      peakEgt = Math.max(peakEgt, sim.egtSensor);
    }
    expect(seen).toContain('lightoff');
    expect(idleAt).toBeGreaterThan(0);
    expect(idleAt).toBeLessThan(60);
    expect(seen).not.toContain('hotStart');
    expect(seen).not.toContain('hungStart');
    expect(peakEgt).toBeLessThan(sim.limits.egtStart);
    // Rölantiden tam güce: 10 s içinde N1 %97 ve itki tasarımın %95'i
    sim.controls.ignition = false;
    sim.controls.throttle = 1;
    const F = sizeEngine(d).point.thrust;
    let tFull = -1;
    for (let t = 0; t < 10 && tFull < 0; t += 1 / 60) {
      sim.step(1 / 60);
      if (sim.N1 > 0.97 && sim.snapshot().thrust > 0.95 * F) tFull = t;
    }
    expect(tFull).toBeGreaterThan(0);
    expect(sim.surgeCount).toBe(0);
    expect(seen).not.toContain('egtRedline');
  }, HEAVY);

  // Alt kırpma (×0,25) fanlı motor için gerekli: kırpılmamış oran (~0,09)
  // ×0,3 turbofanda sürüklemeyi yenemez, light-off olmaz (operability.ts)
  it('×0,3 turbofan (alt kırpmada): 60 s içinde rölanti, sıcak çalıştırma yok', () => {
    const ref = buildEngine(TURBOFAN_GRAPH);
    const d = buildEngine(withoutOps(TURBOFAN_GRAPH, 0.3), { reference: ref }).design;
    expect(d.start.starterTorque).toBeCloseTo(0.25 * ref.design.start.starterTorque, 9);
    const sim = new EngineSim(d);
    const seen: SimEventType[] = [];
    sim.on((e) => seen.push(e.type));
    Object.assign(sim.controls, { apuBleed: true, starter: true, ignition: true });
    for (let t = 0; t < 60; t += 1 / 60) {
      if (!sim.controls.fuelRun && sim.N2 >= sim.limits.fuelOnMinN2 + 0.02) sim.controls.fuelRun = true;
      sim.step(1 / 60);
    }
    expect(seen).toContain('lightoff');
    expect(seen).toContain('idle');
    expect(seen).not.toContain('hotStart');
    expect(seen).not.toContain('hungStart');
  }, HEAVY);
});
