import { describe, expect, it } from 'vitest';
import { MILITARY_TURBOFAN, TURBOJET, sizeEngine, type EngineDesign } from '../sim/design';
import { EngineSim } from '../sim/engineSim';
import { AIR, GAS } from '../sim/gas';
import { flowFunction, machFromFlow } from './flowpath';
import { buildEngine, GraphError, validateGraph } from './graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOJET_GRAPH } from './templates';
import type { EngineGraph } from './types';

/** M4 öncesi elle ölçülendirilmiş modeller (engine/barejet.js VARIANTS) */
const OLD = {
  turbojet: {
    R: 0.43,
    throat: 0.4,
    lpc: { stages: 3, z0: -2.05, z1: -1.62, hub: [0.14, 0.2], tip: [0.395, 0.36], blades: [24, 40] },
    hpc: { stages: 3, z0: -1.42, z1: -1.02, hub: [0.21, 0.25], tip: [0.35, 0.33], blades: [42, 52] },
    combustor: { z0: -0.82, z1: 0.0, rIn: 0.2, rOut: 0.36 },
    hpt: { stages: 1, z0: 0.16, hub: [0.26], tip: [0.36], blades: [58] },
    lpt: { stages: 1, z0: 0.38, hub: [0.26], tip: [0.38], blades: [64] },
    ab: { z0: 0.55, z1: 2.6, liner: 0.42 },
    throat0: 0.285,
  },
  militaryTurbofan: {
    R: 0.5,
    throat: 0.465,
    lpc: { stages: 3, z0: -2.02, z1: -1.62, hub: [0.19, 0.26], tip: [0.46, 0.43], blades: [28, 46] },
    hpc: { stages: 10, z0: -1.32, z1: -0.36, hub: [0.2, 0.27], tip: [0.335, 0.3], blades: [40, 72] },
    combustor: { z0: -0.2, z1: 0.32, rIn: 0.2, rOut: 0.33 },
    hpt: { stages: 1, z0: 0.46, hub: [0.25], tip: [0.335], blades: [62] },
    lpt: { stages: 2, z0: 0.64, z1: 0.84, hub: [0.23, 0.23], tip: [0.37, 0.4], blades: [70, 76] },
    ab: { z0: 1.0, z1: 2.55, liner: 0.47 },
    throat0: 0.305,
  },
};

/** ±%5 (küçük değerlerde 1 cm mutlak pay) */
function near(actual: number, expected: number, label: string) {
  const tol = Math.max(0.05 * Math.abs(expected), 0.01);
  expect(Math.abs(actual - expected), `${label}: ${actual.toFixed(3)} ≠ ${expected}`).toBeLessThanOrEqual(tol);
}
const nearCount = (a: number, e: number, label: string) =>
  expect(Math.abs(a - e), `${label}: ${a} ≠ ${e}`).toBeLessThanOrEqual(Math.max(1, Math.round(0.05 * e)));

describe('akış fonksiyonu', () => {
  it('Mach 1 en büyük, tersi tutarlı', () => {
    for (const g of [AIR, GAS]) {
      expect(flowFunction(1, g)).toBeGreaterThan(flowFunction(0.9, g));
      for (const M of [0.1, 0.3, 0.6, 0.9]) expect(machFromFlow(flowFunction(M, g), g)).toBeCloseTo(M, 4);
    }
  });
});

describe.each([
  ['turbojet', TURBOJET_GRAPH, TURBOJET],
  ['militaryTurbofan', MILITARY_TURBOFAN_GRAPH, MILITARY_TURBOFAN],
] as [keyof typeof OLD, EngineGraph, EngineDesign][])('%s şablonu', (kind, graph, catalog) => {
  const built = buildEngine(graph);
  const L = built.flowpath.layout;
  const old = OLD[kind];

  it('termodinamik katalogdaki motorla aynı', () => {
    const ref = sizeEngine(catalog).point;
    const p = built.sized.point;
    expect(p.thrust / ref.thrust).toBeCloseTo(1, 4);
    expect(p.thrustWet / ref.thrustWet).toBeCloseTo(1, 4);
    expect(p.wf / ref.wf).toBeCloseTo(1, 4);
    // Devirler uç hızından türetildi: eski değerlerin ±%1'i
    expect(built.design.n1Rpm / catalog.n1Rpm).toBeCloseTo(1, 2);
    expect(built.design.n2Rpm / catalog.n2Rpm).toBeCloseTo(1, 2);
    near(built.design.fanDiameter, catalog.fanDiameter, 'fan çapı');
  });

  it('kademe sayıları aynı', () => {
    expect(L.gas.lpc.stages).toBe(old.lpc.stages);
    expect(L.gas.hpc.stages).toBe(old.hpc.stages);
    expect(L.gas.hpt.stages).toBe(old.hpt.stages);
    expect(L.gas.lpt.stages).toBe(old.lpt.stages);
  });

  it('ana ölçüler ±%5', () => {
    near(L.R, old.R, 'R');
    near(L.throat, old.throat, 'boğaz');
    for (const k of ['lpc', 'hpc', 'hpt', 'lpt'] as const) {
      const a = L.gas[k];
      const o = old[k] as { z0: number; z1?: number; hub: number[]; tip: number[]; blades: number[] };
      near(a.z0, o.z0, `${k}.z0`);
      if (o.z1 !== undefined) near(a.z1, o.z1, `${k}.z1`);
      o.hub.forEach((h, i) => near(a.hub[i], h, `${k}.hub[${i}]`));
      o.tip.forEach((t, i) => near(a.tip[i], t, `${k}.tip[${i}]`));
      o.blades.forEach((b, i) => nearCount(a.blades[i], b, `${k}.blades[${i}]`));
    }
    const c = L.gas.combustor;
    for (const f of ['z0', 'z1', 'rIn', 'rOut'] as const) near(c[f], old.combustor[f], `combustor.${f}`);
    for (const f of ['z0', 'z1', 'liner'] as const) near(L.ab[f], old.ab[f], `ab.${f}`);
    near(L.nozzle.throat0, old.throat0, 'lüle boğazı');
  });
});

describe('geçerlilik kuralları', () => {
  const without = (g: EngineGraph, type: string): EngineGraph => ({ ...g, modules: g.modules.filter((m) => m.type !== type) });
  it('eksik zorunlu modül', () => {
    expect(() => validateGraph(without(TURBOJET_GRAPH, 'combustor'))).toThrow(GraphError);
  });
  it('baypas karıştırılmadan art yakıcıya giremez', () => {
    expect(() => validateGraph(without(MILITARY_TURBOFAN_GRAPH, 'mixer'))).toThrow(GraphError);
  });
  it('karıştırıcı baypas ister', () => {
    const mods = [...TURBOJET_GRAPH.modules];
    mods.splice(mods.findIndex((m) => m.type === 'afterburner'), 0, { type: 'mixer', loss: 0.01 });
    expect(() => validateGraph({ ...TURBOJET_GRAPH, modules: mods })).toThrow(/baypas/);
  });
  it('sıra yanlış', () => {
    const mods = [...TURBOJET_GRAPH.modules];
    const i = mods.findIndex((m) => m.type === 'hpt');
    [mods[i], mods[i + 1]] = [mods[i + 1], mods[i]];
    expect(() => validateGraph({ ...TURBOJET_GRAPH, modules: mods })).toThrow(/sırası/);
  });
});

describe('simülasyonda', () => {
  it.each([TURBOJET_GRAPH, MILITARY_TURBOFAN_GRAPH])('$kind çalıştırılıp tam güce dengelenir', (g) => {
    const b = buildEngine(g);
    const sim = new EngineSim(b.design);
    sim.trim(1, 30);
    const s = sim.snapshot();
    expect(s.lit).toBe(true);
    expect(s.N1).toBeGreaterThan(0.95);
    expect(s.cycle.netThrust / b.sized.point.thrust).toBeGreaterThan(0.9);
  });
});

describe('fizik tutarlılığı', () => {
  it('kütle akışı artınca kanal büyür, devir düşer', () => {
    const big = buildEngine({ ...TURBOJET_GRAPH, massFlow: 66 * 1.5 });
    const base = buildEngine(TURBOJET_GRAPH);
    // Aynı Mach ve göbek/uç oranında yarıçap √W ile ölçeklenir
    expect(big.flowpath.layout.gas.lpc.tip[0] / base.flowpath.layout.gas.lpc.tip[0]).toBeCloseTo(Math.sqrt(1.5), 3);
    expect(big.design.n1Rpm).toBeLessThan(base.design.n1Rpm);
  });
  it('daha yüksek basınç oranı daha çok HPC kademesi ister', () => {
    const g = structuredClone(MILITARY_TURBOFAN_GRAPH);
    const hpc = g.modules.find((m) => m.type === 'hpc') as { pr: number };
    hpc.pr = 14;
    expect(buildEngine(g).flowpath.layout.gas.hpc.stages).toBeGreaterThan(10);
  });
  it('uç bağıl Mach ve AN² makul', () => {
    for (const g of [TURBOJET_GRAPH, MILITARY_TURBOFAN_GRAPH]) {
      const m = buildEngine(g).flowpath.metrics;
      expect(m.tipMachRel.lp).toBeGreaterThan(1);
      expect(m.tipMachRel.lp).toBeLessThan(1.8);
      // Türbin AN² sınırı ~5·10⁷ m²·rpm² mertebesinde
      expect(m.an2.hpt).toBeLessThan(6e7);
    }
  });
  it('kütle ve itki/ağırlık motor sınıfına uygun', () => {
    // J79 sınıfı turbojet ~1,7 t, T/W 4,6; F110 sınıfı ~1,8 t, T/W 7,3
    for (const [g, lo, hi] of [
      [TURBOJET_GRAPH, 1200, 1800],
      [MILITARY_TURBOFAN_GRAPH, 1500, 2300],
    ] as [EngineGraph, number, number][]) {
      const b = buildEngine(g);
      const m = b.flowpath.metrics.mass.total;
      expect(m).toBeGreaterThan(lo);
      expect(m).toBeLessThan(hi);
      const tw = b.sized.point.thrustWet / 9.81 / m;
      expect(tw).toBeGreaterThan(3.5);
      expect(tw).toBeLessThan(8.5);
    }
  });
});
