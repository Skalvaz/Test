/**
 * YALNIZ TESTLER İÇİN: henüz gövdesi başka pakette olan işlevlerin
 * (değerlendirme/özet P3, mimari P4a) sade taklitleri. Atölye mağazası
 * bunları `deps` ile alır; oyun gerçek modülleri kullanır. Taklitler
 * fiziği yeniden yazmaz: üretim buildEngine'dir, özet üretilmiş motordan
 * okunur, mimari türetilmiş tipten çıkarılır.
 */

import type { ArchChange, Architecture } from '../design/architecture';
import { TEMPLATES } from '../design/catalog';
import type { Evaluation } from '../design/evaluate';
import { FlowpathError } from '../design/flowpath';
import { GraphError, type BuildOptions, type BuiltEngine } from '../design/graph';
import { buildChecked } from '../design/knobs';
import type { DesignSummary, RowSummary, SummaryDelta } from '../design/summary';
import { deriveTraits } from '../design/traits';
import type { CombustorModule, EngineGraph, MixerModule, NozzleModule } from '../design/types';
import type { TeachingError } from '../design/warnings';
import type { WorkshopDeps } from './store';
import { familyBase } from './project';

export function fakeTranslate(e: unknown): TeachingError {
  const raw = e instanceof Error ? e.message : String(e);
  const source = e instanceof GraphError ? 'graph' : e instanceof FlowpathError ? 'flowpath' : 'design';
  const x = e as { knobs?: string[]; group?: string };
  return { title: 'Tasarım kurulamadı', text: raw, knobs: Array.isArray(x?.knobs) ? [...x.knobs] : [], source, group: x?.group, raw };
}

const rpmOf = (w: number) => (w * 60) / (2 * Math.PI);

export function fakeSummarize(b: BuiltEngine): DesignSummary {
  const p = b.sized.point;
  const st = p.stations;
  const m = b.flowpath.metrics;
  const g = b.flowpath.gas;
  const row = (r: typeof g.hpc | undefined, omega: number): RowSummary | undefined =>
    r && { stages: r.stages, uTip: r.uTip, uMean: r.uMean, loading: r.loading, hExitMm: (r.tip[1] - r.hub[1]) * 1e3, rpm: rpmOf(omega) };
  const shaftPower = b.sized.ref.shaftPower > 0 ? b.sized.ref.shaftPower : undefined;
  const output = b.traits.output;
  const comb = b.graph.modules.find((x) => x.type === 'combustor') as CombustorModule;
  return {
    output,
    thrust: p.thrust,
    thrustWet: p.thrustWet,
    shaftPower,
    tsfc: output === 'thrust' ? p.tsfc * 1e6 : undefined,
    sfc: shaftPower ? (p.wf / shaftPower) * 3.6e9 : undefined,
    mass: m.mass.total,
    massParts: { ...m.mass.parts },
    cgZ: 0,
    thrustToWeight: p.thrust / (m.mass.total * 9.80665),
    diameter: m.diameter,
    length: m.length,
    opr: p.opr,
    bpr: b.design.bypassRatio,
    fpr: b.traits.lpLoad === 'fan' ? b.design.fanPR : undefined,
    t3: st['3'].T,
    t4: st['4'].T,
    t45: st['45'].T,
    egtMargin: b.design.limits.egtAmber - (st['45'].T - 273.15),
    rpm: { lp: b.flowpath.rpm.lp, hp: b.flowpath.rpm.hp },
    rows: {
      front: row(g.front, g.omega.lp),
      booster: row(g.booster, g.omega.lp),
      hpc: row(g.hpc, g.omega.hp),
      hpt: row(g.hpt, g.omega.hp),
      lpt: row(g.lpt, g.omega.lp),
    },
    hptInletMach: 0.1,
    combustor: { style: comb.style, vref: comb.refVelocity, length: g.combustor.z1 - g.combustor.z0, height: g.combustor.rOut - g.combustor.rIn },
    stagesLabel: [g.front, g.booster, g.hpc, g.hpt, g.lpt].map((r) => r?.stages ?? 0).join('·'),
  };
}

export function fakeDiff(a: DesignSummary, b: DesignSummary): SummaryDelta[] {
  return (['thrust', 'mass', 'diameter', 'length'] as const).map((key) => ({
    key,
    abs: b[key] - a[key],
    rel: (b[key] - a[key]) / a[key],
    better: key === 'thrust' ? b[key] > a[key] : key === 'mass' ? b[key] < a[key] : null,
    text: key,
  }));
}

export function fakeEvaluate(g: EngineGraph, opts?: BuildOptions): Evaluation | { error: TeachingError } {
  let b: BuiltEngine;
  try {
    b = buildChecked(g, opts);
  } catch (e) {
    return { error: fakeTranslate(e) };
  }
  return { graph: g, built: b, summary: fakeSummarize(b), gauges: [], findings: [] };
}

export function fakeArchitectureOf(g: EngineGraph): Architecture {
  const t = deriveTraits(g);
  const mixer = g.modules.find((m) => m.type === 'mixer') as MixerModule | undefined;
  return {
    output: t.lpLoad === 'shaft' ? 'shaft' : 'thrust',
    lpLoad: t.lpLoad,
    booster: t.booster,
    centrifugal: t.centrifugal,
    combustor: t.combustor,
    exhaust: t.exhaust,
    mixer: mixer?.style ?? 'confluent',
    afterburner: t.afterburner,
    abNozzle: t.nozzle === 'cd' ? 'cd' : 'convergent',
    installation: t.installed ? 'nacelle' : 'bare',
  };
}

export function fakeResolveChange(a: Architecture, axis: keyof Architecture, value: unknown): ArchChange {
  if (axis === 'lpLoad' && value === 'gearedFan') return { blocked: "Dişli fan M5b'de." };
  return { arch: { ...a, [axis]: value } as Architecture, implied: [] };
}

/** Yalnız yanma odası stili ve art yakıcı lülesi dönüşümleri (testlerin kullandığı) */
export function fakeApplyArchitecture(seed: EngineGraph, next: Architecture): EngineGraph {
  const g = structuredClone(seed);
  const c = g.modules.find((m) => m.type === 'combustor') as CombustorModule;
  if (c.style !== next.combustor) {
    c.style = next.combustor;
    if (next.combustor === 'annular') delete c.cans;
    // Şablon TJ geometrisinde 8+ kutu çevreye sığmıyor (P5 kalibre eder): taklitte 6
    else c.cans = 6;
  }
  const n = g.modules.find((m) => m.type === 'nozzle') as NozzleModule;
  if (next.afterburner && (n.style === 'convergent' || n.style === 'cd')) n.style = next.abNozzle;
  return g;
}

/** Mimariye en yakın şablon (yerleşimi hazır olanlardan) */
export function fakeGraphFromArchitecture(a: Architecture, size: { massFlow: number; name: string }): EngineGraph {
  const id = a.lpLoad === 'propeller' ? 'turboprop' : a.lpLoad === 'fan' ? (a.installation === 'nacelle' ? 'turbofan' : 'militaryTurbofan') : 'turbojet';
  const g = familyBase(TEMPLATES[id]!);
  g.name = size.name;
  g.massFlow = size.massFlow;
  const c = g.modules.find((m) => m.type === 'combustor') as CombustorModule;
  c.style = a.combustor;
  if (a.combustor !== 'annular') c.cans = 6;
  return g;
}

/** İtki/güç hava akışıyla orantılı: üç düzeltme adımı */
export function fakeSolveMassFlow(g: EngineGraph, target: { thrust?: number; shaftPower?: number }): number {
  const id = deriveTraits(g).lpLoad === 'propeller' ? 'turboprop' : deriveTraits(g).lpLoad === 'fan' ? 'turbofan' : 'turbojet';
  const ref = buildChecked(TEMPLATES[id]!);
  let W = g.massFlow;
  for (let i = 0; i < 4; i++) {
    const b = buildChecked({ ...g, massFlow: W }, { reference: ref });
    const have = target.shaftPower !== undefined ? b.sized.ref.shaftPower : b.sized.point.thrust;
    const want = target.shaftPower ?? target.thrust ?? have;
    W *= want / have;
  }
  return W;
}

/** Testlerin mağazaya verdiği bağımlılıklar */
export const FAKE_DEPS: WorkshopDeps = {
  evaluate: fakeEvaluate,
  // Trim (~30 ms) taklitte yok: testler kendi bulgusunu verir
  evaluateOperability: () => [],
  translateError: fakeTranslate,
  summarize: fakeSummarize,
  diffSummary: fakeDiff,
  architectureOf: fakeArchitectureOf,
  resolveChange: fakeResolveChange,
  applyArchitecture: fakeApplyArchitecture,
  graphFromArchitecture: fakeGraphFromArchitecture,
  solveMassFlow: fakeSolveMassFlow,
};

/** Bellek içi Storage (otomatik kayıt testleri) */
export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** Tohumlu rastgele sayı (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
