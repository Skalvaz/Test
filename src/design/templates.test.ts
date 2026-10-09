import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, MILITARY_TURBOFAN, TURBOJET, TURBOPROP, sizeEngine, type EngineDesign } from '../sim/design';
import { EngineSim } from '../sim/engineSim';
import { AIR, GAS } from '../sim/gas';
import { flowFunction, machFromFlow, profileAt, type BareJetLayout, type TurbofanLayout, type TurbopropLayout } from './flowpath';
import { buildEngine, GraphError, validateGraph } from './graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import { CHEVRON_CV_LOSS, type CombustorModule, type EngineGraph, type MixerModule, type NozzleModule } from './types';

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
  const L = built.flowpath.layout as BareJetLayout;
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
    // Art yakıcılı şablon: art yakıcı kanalı ve değişken lüle var (M5a P5: tipte isteğe bağlı)
    if (!L.ab || L.nozzle.kind === 'fixed') throw new Error('turbojet şablonu art yakıcılı olmalı');
    for (const f of ['z0', 'z1', 'liner'] as const) near(L.ab[f], old.ab[f], `ab.${f}`);
    near(L.nozzle.throat0, old.throat0, 'lüle boğazı');
  });
});

describe('turboprop şablonu', () => {
  const built = buildEngine(TURBOPROP_GRAPH);
  const L = built.flowpath.layout as TurbopropLayout;
  /** M4 öncesi elle ölçülendirilmiş model (engine/turboprop.js) */
  const OLD_TP = {
    hpc: { stages: 4, z0: -0.72, z1: -0.3, hub: [0.1, 0.13], tip: [0.2, 0.17], blades: [26, 36] },
    combustor: { z0: 0.06, z1: 0.46, rIn: 0.14, rOut: 0.26 },
    hpt: { stages: 1, z0: 0.56, hub: [0.15], tip: [0.22], blades: [44] },
    lpt: { stages: 2, z0: 0.74, z1: 0.9, hub: [0.15, 0.15], tip: [0.23, 0.26], blades: [52, 58] },
  };

  it('termodinamik katalogdaki motorla aynı', () => {
    const ref = sizeEngine(TURBOPROP).point;
    const p = built.sized.point;
    expect(p.thrust / ref.thrust).toBeCloseTo(1, 4);
    expect(built.sized.ref.shaftPower / sizeEngine(TURBOPROP).ref.shaftPower).toBeCloseTo(1, 4);
    expect(built.design.n1Rpm / TURBOPROP.n1Rpm).toBeCloseTo(1, 2);
    expect(built.design.n2Rpm / TURBOPROP.n2Rpm).toBeCloseTo(1, 2);
    expect(built.design.fanDiameter).toBe(TURBOPROP.fanDiameter);
    expect(built.design.fanBlades).toBe(TURBOPROP.fanBlades);
    // Pervane redüktörü: güç türbini / pervane devri
    expect(L.prop.gearRatio).toBeCloseTo(TURBOPROP.n1Rpm / 1200, 0);
  });

  it('ölçüler ±%5, santrifüj çark fiziksel', () => {
    for (const k of ['hpc', 'hpt', 'lpt'] as const) {
      const a = L.gas[k];
      const o = OLD_TP[k] as { stages: number; z0: number; z1?: number; hub: number[]; tip: number[]; blades: number[] };
      expect(a.stages).toBe(o.stages);
      near(a.z0, o.z0, `${k}.z0`);
      if (o.z1 !== undefined) near(a.z1, o.z1, `${k}.z1`);
      o.hub.forEach((h, i) => near(a.hub[i], h, `${k}.hub[${i}]`));
      o.tip.forEach((t, i) => near(a.tip[i], t, `${k}.tip[${i}]`));
      o.blades.forEach((b, i) => nearCount(a.blades[i], b, `${k}.blades[${i}]`));
    }
    for (const f of ['z0', 'z1', 'rIn', 'rOut'] as const) near(L.gas.combustor[f], OLD_TP.combustor[f], `combustor.${f}`);
    // Difüzör eski çark çapında; çark ucu titanyum sınırının (~600 m/s) altında
    near(L.gas.centrifugal.rd, 0.26, 'difüzör');
    near(L.gas.centrifugal.z, -0.14, 'çark z');
    expect(L.gas.centrifugal.uTip).toBeLessThan(600);
    near(L.exhaust.radius, 0.27, 'egzoz ağzı');
  });

  it('simülasyonda çalıştırılıp tam güce dengelenir', () => {
    const sim = new EngineSim(built.design);
    sim.trim(1, 30);
    const s = sim.snapshot();
    expect(s.lit).toBe(true);
    expect(s.N2).toBeGreaterThan(0.9);
    expect(sim.propPower / built.sized.ref.shaftPower).toBeGreaterThan(0.8);
  });

  it('kütle sınıfına uygun', () => {
    // PW127 sınıfı ~480 kg (pervanesiz) + pervane ~200 kg
    const m = built.flowpath.metrics.mass;
    expect(m.total).toBeGreaterThan(450);
    expect(m.total).toBeLessThan(1100);
    expect(built.flowpath.metrics.tipMachRel.lp).toBeGreaterThan(0.6);
    expect(built.flowpath.metrics.tipMachRel.lp).toBeLessThan(0.9);
  });
});

describe('yüksek baypaslı turbofan şablonu', () => {
  const built = buildEngine(TURBOFAN_GRAPH);
  const L = built.flowpath.layout as TurbofanLayout;
  const s = built.sized.point.stations;

  it('termodinamik katalogdaki motorla aynı', () => {
    const ref = sizeEngine(DEFAULT_DESIGN);
    expect(built.sized.point.thrust / ref.point.thrust).toBeCloseTo(1, 4);
    expect(built.sized.point.wf / ref.point.wf).toBeCloseTo(1, 4);
    expect(built.design.n1Rpm / DEFAULT_DESIGN.n1Rpm).toBeCloseTo(1, 2);
    expect(built.design.n2Rpm / DEFAULT_DESIGN.n2Rpm).toBeCloseTo(1, 2);
    near(built.design.fanDiameter, DEFAULT_DESIGN.fanDiameter, 'fan çapı');
    expect(built.design.fanBlades).toBe(DEFAULT_DESIGN.fanBlades);
  });

  it('fan ve HPC eski modelin ±%5\'i, kademe sayıları', () => {
    near(L.fan.tip[0], 1.386, 'fan ucu');
    near(L.fan.hub[0], 0.455, 'fan göbeği');
    near(L.fan.z0, -0.28, 'fan z');
    expect(L.s).toBeCloseTo(1, 2);
    expect([L.fan.stages, L.booster.stages, L.hpc.stages, L.hpt.stages, L.lpt.stages]).toEqual([1, 3, 9, 2, 6]);
    near(L.hpc.tip[0], 0.522, 'hpc ucu');
    near(L.hpc.hub[1], 0.404, 'hpc çıkış göbeği');
    near(L.hpt.tip[0], 0.49, 'hpt ucu');
    near(L.combustor.rOut, 0.54, 'yanma odası');
  });

  it('booster ve LPT fiziksel (eski model fizikle çelişiyordu)', () => {
    // Booster boğulmuyor, LPT yüklemesi doğrudan tahrikli motor aralığında
    const m = TURBOFAN_GRAPH.modules.find((x) => x.type === 'lpc') as { mach: number[] };
    expect(m.mach[0]).toBeLessThan(0.6);
    expect(L.booster.loading).toBeLessThan(1);
    expect(L.lpt.loading).toBeGreaterThan(2);
    expect(L.lpt.loading).toBeLessThan(3.2);
    // LPT halkası HPT'nin dışında: geçiş kanalı dışa açılır
    expect(L.lpt.hub[0]).toBeGreaterThan(L.hpt.hub[1]);
  });

  it('lüle ağızları termodinamik alanlarla tutarlı', () => {
    const aBy = Math.PI * (L.bypassExit.rDuct ** 2 - L.bypassExit.rCore ** 2);
    expect(built.sized.ref.A19 / aBy).toBeCloseTo(0.89, 2);
    const plugR = profileAt(L.plug, L.coreNozzle.z1);
    const aCore = Math.PI * (L.coreNozzle.r1 ** 2 - plugR ** 2);
    expect(built.sized.ref.A9 / aCore).toBeCloseTo(0.97, 2);
    // Baypas kanalı eski kaporta iç duvarına yakın (±%5)
    near(L.bypassExit.rDuct, 1.344, 'kaporta iç duvarı');
    // Çekirdek kaportası her yerde iç parçaların dışında
    for (const [row, k] of [[L.booster, 'booster'], [L.hpc, 'hpc'], [L.lpt, 'lpt']] as const) {
      for (const z of [row.z0, row.z1]) expect(profileAt(L.coreCowl, z), k).toBeGreaterThan(Math.max(...row.tip) + 0.03);
    }
    expect(s['5'].W).toBeGreaterThan(0);
  });

  it('kütle sınıfına uygun ve simülasyonda çalışır', () => {
    // GEnx-1B sınıfı (2,82 m fan, ~330 kN): ~5,8 t
    const m = built.flowpath.metrics.mass.total;
    expect(m).toBeGreaterThan(5000);
    expect(m).toBeLessThan(7000);
    const sim = new EngineSim(built.design);
    sim.trim(1, 30);
    expect(sim.snapshot().N1).toBeGreaterThan(0.95);
  });
});

describe('M4c modülleri', () => {
  const tweak = <T extends { type: string }>(g: EngineGraph, type: T['type'], f: (m: T) => void): EngineGraph => {
    const c = structuredClone(g);
    f(c.modules.find((m) => m.type === type) as unknown as T);
    return c;
  };

  it('kutu yanma odası: toplam alan korunur, kutular çevreye dizilir', () => {
    const g = tweak<CombustorModule>(TURBOJET_GRAPH, 'combustor', (m) => Object.assign(m, { style: 'can', cans: 8, refVelocity: 55 }));
    const b = buildEngine(g);
    const cb = b.flowpath.gas.combustor;
    expect(cb.cans).toBe(8);
    expect(cb.injectors).toBe(8);
    const rc = (cb.rOut - cb.rIn) / 2;
    const s3 = b.sized.point.stations['3'];
    const area = s3.W / ((s3.P / (AIR.R * s3.T)) * 55);
    expect((8 * Math.PI * rc * rc) / area).toBeCloseTo(1, 4);
    // Termodinamik yalnız basınç kaybıyla değişir: aynı dp → aynı itki
    expect(b.sized.point.thrust / buildEngine(TURBOJET_GRAPH).sized.point.thrust).toBeCloseTo(1, 6);
  });

  it('sığmayan kutu sayısı öğretici hatayla reddedilir', () => {
    const g = tweak<CombustorModule>(TURBOJET_GRAPH, 'combustor', (m) => Object.assign(m, { style: 'can', cans: 12 }));
    expect(() => buildEngine(g)).toThrow(/sığmıyor/);
  });

  it("chevron'lu lüle itkiden küçük bir pay götürür", () => {
    const base = buildEngine(TURBOFAN_GRAPH);
    const both = buildEngine(tweak<NozzleModule>(TURBOFAN_GRAPH, 'nozzle', (m) => (m.chevrons = { core: 20, bypass: 18 })));
    const none = buildEngine(tweak<NozzleModule>(TURBOFAN_GRAPH, 'nozzle', (m) => (m.chevrons = { core: 0, bypass: 0 })));
    // Kayıplar toplanır: iki chevron'lu lüle (1 − 2L), şablon (1 − L)
    expect(both.design.nozzleCv / base.design.nozzleCv).toBeCloseTo((1 - 2 * CHEVRON_CV_LOSS) / (1 - CHEVRON_CV_LOSS), 6);
    expect(none.design.nozzleCv / base.design.nozzleCv).toBeCloseTo(1 / (1 - CHEVRON_CV_LOSS), 6);
    expect(both.sized.point.thrust).toBeLessThan(base.sized.point.thrust);
    expect((both.flowpath.layout as TurbofanLayout).chevrons).toEqual({ core: 20, bypass: 18 });
    expect(() => validateGraph(tweak<NozzleModule>(TURBOJET_GRAPH, 'nozzle', (m) => (m.chevrons = { core: 12 })))).toThrow(GraphError);
  });

  it("lobe'lu karıştırıcı daha iyi karıştırır ama ek kayıp getirir", () => {
    const conf = buildEngine(MILITARY_TURBOFAN_GRAPH);
    const lobedSameLoss = buildEngine(tweak<MixerModule>(MILITARY_TURBOFAN_GRAPH, 'mixer', (m) => Object.assign(m, { style: 'lobed', lobes: 14 })));
    const lobed = buildEngine(tweak<MixerModule>(MILITARY_TURBOFAN_GRAPH, 'mixer', (m) => Object.assign(m, { style: 'lobed', lobes: 14, loss: 0.015 })));
    expect(lobedSameLoss.design.afterburner!.mixingEff).toBeGreaterThan(conf.design.afterburner!.mixingEff!);
    // Aynı kayıpta daha çok kuru itki; art yakıcıda karışma zaten tam
    expect(lobedSameLoss.sized.point.thrust).toBeGreaterThan(conf.sized.point.thrust);
    expect(lobedSameLoss.sized.point.thrustWet).toBeCloseTo(conf.sized.point.thrustWet, 0);
    // Düşük baypasta kazanç küçük: ek %0,5 kayıp onu yer (gerçek askeri motorlar düz karıştırıcı kullanır)
    expect(lobed.sized.point.thrust).toBeLessThan(lobedSameLoss.sized.point.thrust);
    expect((lobed.flowpath.layout as BareJetLayout).mixer?.lobes).toBe(14);
    expect(() => validateGraph(tweak<MixerModule>(MILITARY_TURBOFAN_GRAPH, 'mixer', (m) => Object.assign(m, { style: 'lobed', lobes: 3 })))).toThrow(GraphError);
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
    expect(big.flowpath.gas.front!.tip[0] / base.flowpath.gas.front!.tip[0]).toBeCloseTo(Math.sqrt(1.5), 3);
    expect(big.design.n1Rpm).toBeLessThan(base.design.n1Rpm);
  });
  it('daha yüksek basınç oranı daha çok HPC kademesi ister', () => {
    const g = structuredClone(MILITARY_TURBOFAN_GRAPH);
    const hpc = g.modules.find((m) => m.type === 'hpc') as { pr: number };
    hpc.pr = 14;
    expect(buildEngine(g).flowpath.gas.hpc.stages).toBeGreaterThan(10);
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
