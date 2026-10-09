import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, MILITARY_TURBOFAN, TURBOJET, TURBOPROP, sizeEngine, type EngineDesign } from '../sim/design';
import { EngineSim } from '../sim/engineSim';
import { AIR, GAS } from '../sim/gas';
import { flowFunction, machFromFlow, profileAt, type BareJetLayout, type TurbofanLayout, type TurbopropLayout } from './flowpath';
import { buildEngine, GraphError, validateGraph } from './graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import { CHEVRON_CV_LOSS, type CombustorModule, type EngineGraph, type MixerModule, type NozzleModule } from './types';

/**
 * Ölçü referansları. Turbojet: M4 öncesi elle ölçülendirilmiş model
 * (engine/barejet.js VARIANTS). Askeri turbofan: M5a'da karıştırıcı basınç
 * dengesine uyduruldu (fan PR 3,1 → 4,3, BPR 0,68 → 0,55); çekirdek ~%10
 * inceldi, kademe sayıları aynı. Eski model: R 0,5; HPC uç 0,335/0,3;
 * HPT uç 0,335; yanma odası 0,2–0,33; art yakıcı 1,0–2,55.
 */
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
    R: 0.437,
    throat: 0.465,
    lpc: { stages: 3, z0: -2.02, z1: -1.665, hub: [0.19, 0.31], tip: [0.46, 0.43], blades: [28, 70] },
    hpc: { stages: 10, z0: -1.397, z1: -0.527, hub: [0.181, 0.245], tip: [0.304, 0.272], blades: [40, 72] },
    combustor: { z0: -0.382, z1: 0.128, rIn: 0.17, rOut: 0.298 },
    hpt: { stages: 1, z0: 0.262, hub: [0.22], tip: [0.295], blades: [62] },
    lpt: { stages: 2, z0: 0.428, z1: 0.613, hub: [0.216, 0.22], tip: [0.347, 0.375], blades: [70, 79] },
    ab: { z0: 0.783, z1: 2.257, liner: 0.447 },
    throat0: 0.289,
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

  if (kind === 'militaryTurbofan') {
    it('karıştırıcıda basınçlar dengeli (M5a uydurması)', () => {
      // P19t/P5t caution bandı [0,92, 1,12]; her uçtan ≥ %4 pay
      const st = built.sized.point.stations;
      const ratio = (st['13'].P * (1 - built.design.bypassDuctDP)) / st['5'].P;
      expect(ratio).toBeGreaterThanOrEqual(0.92 * 1.04);
      expect(ratio).toBeLessThanOrEqual(1.12 / 1.04);
      // Kuru itki ve TSFC M4 şablonundan ±%4 (80,9 kN, 22,19 g/(kN·s))
      const p = built.sized.point;
      expect(Math.abs(p.thrust / 80930 - 1)).toBeLessThan(0.04);
      expect(Math.abs((p.wf / p.thrust) * 1e6 / 22.19 - 1)).toBeLessThan(0.04);
    });
  }

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
  const mod = <T>(type: string) => TURBOPROP_GRAPH.modules.find((m) => m.type === type) as T;
  /**
   * M5a: fiziğe uydurulmuş gaz jeneratörünün ölçüleri (regresyon bekçisi).
   * M4'teki "eski model ±%5" bloğu kalktı: o model HPC ucu Mach 1,86, HPT
   * AN² 7,2e7 ve 8 m/s'lik yanma odasıyla fizikle çelişiyordu.
   */
  const REF_TP = {
    hpc: { stages: 5, z0: -0.72, z1: -0.329, hub: [0.068, 0.081], tip: [0.151, 0.129], blades: [23, 21] },
    combustor: { z0: -0.078, z1: 0.287, rIn: 0.133, rOut: 0.194 },
    hpt: { stages: 1, z0: 0.344, hub: [0.14], tip: [0.175], blades: [75] },
    lpt: { stages: 2, z0: 0.491, z1: 0.622, hub: [0.15, 0.185], tip: [0.23, 0.26], blades: [52, 92] },
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

  it('gaz jeneratörü fiziksel (M5a uydurması)', () => {
    const m = built.flowpath.metrics;
    const gas = L.gas;
    // HPC ilk kademe bağıl uç Mach'ı: caution 1,55'ten ≥ %4 pay
    expect(m.tipMachRel.hp).toBeLessThanOrEqual(1.49);
    // Disk/kanat gerilmesi: AN² caution 4,2e7'den ≥ %4 pay
    expect(m.an2.hpt).toBeLessThanOrEqual(4.03e7);
    expect(m.an2.lpt).toBeLessThanOrEqual(4.03e7);
    // Yanma odası referans hızı gerçek halka odalar gibi, HPT girişi boğulmaya yakın değil ama ölü de değil
    const comb = mod<CombustorModule>('combustor');
    expect(comb.refVelocity).toBeGreaterThanOrEqual(18);
    expect(comb.refVelocity).toBeLessThanOrEqual(25);
    expect(mod<{ mach: number[] }>('hpt').mach[0]).toBeGreaterThanOrEqual(0.1);
    // Eksenel kademe ≤ 6 (santrifüj işin çoğunu yapar), çark ucu titanyum sınırının altında
    expect(gas.hpc.stages).toBeLessThanOrEqual(6);
    expect(gas.centrifugal.uTip).toBeLessThanOrEqual(595);
    // Eksenel uç hızları (kompresör ve türbin) 600 m/s caution'dan ≥ %4 pay
    for (const row of [gas.hpc, gas.hpt, gas.lpt]) expect(row.uTip).toBeLessThanOrEqual(600 / 1.04);
    // Son eksenel HPC kanadı küçük motor sınırının (12 mm) üstünde
    expect((gas.hpc.tip[1] - gas.hpc.hub[1]) * 1000).toBeGreaterThan(12.5);
  });

  it('ölçüler yeni referansın ±%5\'i', () => {
    for (const k of ['hpc', 'hpt', 'lpt'] as const) {
      const a = L.gas[k];
      const o = REF_TP[k] as { stages: number; z0: number; z1?: number; hub: number[]; tip: number[]; blades: number[] };
      expect(a.stages).toBe(o.stages);
      near(a.z0, o.z0, `${k}.z0`);
      if (o.z1 !== undefined) near(a.z1, o.z1, `${k}.z1`);
      o.hub.forEach((h, i) => near(a.hub[i], h, `${k}.hub[${i}]`));
      o.tip.forEach((t, i) => near(a.tip[i], t, `${k}.tip[${i}]`));
      o.blades.forEach((b, i) => nearCount(a.blades[i], b, `${k}.blades[${i}]`));
    }
    for (const f of ['z0', 'z1', 'rIn', 'rOut'] as const) near(L.gas.combustor[f], REF_TP.combustor[f], `combustor.${f}`);
    near(L.gas.centrifugal.rd, 0.302, 'difüzör');
    near(L.gas.centrifugal.z, -0.217, 'çark z');
    near(L.exhaust.radius, 0.27, 'egzoz ağzı');
    // Çene girişi ağzı giriş akışından (M4 öncesi modelin elipsi ~0,18 m eş daire)
    near(L.intake.radius, 0.174, 'giriş ağzı');
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
    // M5a: fiziğe uyduruldu (HPT girişi Mach 0,10, yanma odası 20 m/s); eski model 0,49 / 0,54
    near(L.hpt.tip[0], 0.473, 'hpt ucu');
    near(L.combustor.rOut, 0.507, 'yanma odası');
  });

  it('HPT ve yanma odası fiziksel (M5a uydurması)', () => {
    const m = built.flowpath.metrics;
    const comb = TURBOFAN_GRAPH.modules.find((x) => x.type === 'combustor') as CombustorModule;
    const hpt = TURBOFAN_GRAPH.modules.find((x) => x.type === 'hpt') as { mach: number[] };
    expect(hpt.mach[0]).toBeGreaterThanOrEqual(0.1);
    expect(comb.refVelocity).toBeGreaterThanOrEqual(18);
    expect(comb.refVelocity).toBeLessThanOrEqual(25);
    expect(m.an2.hpt).toBeLessThanOrEqual(4.03e7);
    near(m.an2.hpt / 1e7, 2.27, 'HPT AN² [1e7]');
    // T3: 1000 K caution'dan ≥ %4 pay (HPC PR 16,5 → 16,3)
    expect(s['3'].T).toBeLessThanOrEqual(1000 / 1.04);
    // Devirler değişmez: N2 HPC uç hızından
    expect(built.design.n2Rpm / DEFAULT_DESIGN.n2Rpm).toBeCloseTo(1, 2);
  });

  it('türbin geçiş kanalı yumuşak, baypas ağzı çekirdek lülesinden önde', () => {
    // core.js ölçüleri: kanal HPT son rotorunun 0,3 aralık arkasından LPT ilk
    // NGV'sinin önüne (0,5 aralık + 0,75 × 0,36 aralık eksenel kord) uzanır
    const itd0 = L.hpt.z1 + 0.3 * L.hpt.pitch;
    const itd1 = L.lpt.z0 - (0.5 + 0.75 * 0.36) * L.lpt.pitch;
    const climb = Math.max(L.lpt.hub[0] - L.hpt.hub[1], L.lpt.tip[0] - L.hpt.tip[1]);
    expect(itd1 - itd0).toBeGreaterThanOrEqual(1.2 * climb);
    // Baypas lülesi ağzı çekirdek kaportası profilinin içinde kalır (profileAt dışarıda sabitlenir)
    expect(L.bypassExit.z).toBeLessThan(L.coreNozzle.z0);
    expect(L.bypassExit.z).toBeGreaterThan(L.coreCowl[0][1]);
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
