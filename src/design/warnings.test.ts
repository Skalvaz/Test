/**
 * M5a P3: sonuç özeti, öğretici uyarılar, hata çevirisi ve sözlük.
 *
 * Şablon testi: yedi aile şablonunda caution/warning 0 (§4). Henüz olmayan
 * ya da fiziğe uydurulmamış şablon (P2 turboprop/turbofan, P5–P7 yeni
 * aileler) o şablon birleşene kadar atlanır; "uydurulmuş" ölçütü §4'teki
 * hedef düğmelerdir, uyarıların kendisi değil.
 */

import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../game/glossary';
import { LESSONS } from '../game/lessons/index';
import { DesignError } from '../sim/design';
import { EngineSim } from '../sim/engineSim';
import { TEMPLATES } from './catalog';
import type { Finding } from './core/rules';
import { GraphError } from './errors';
import { evaluate, isEvaluation, type Evaluation } from './evaluate';
import { FlowpathError } from './flowpath';
import { buildEngine } from './graph';
import { layoutNotReady } from './layouts/index';
import { diffSummary, explainDelta, fmtNum, summarize } from './summary';
import { TECH_MODERN } from './tech';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH, type TemplateId } from './templates';
import type { CombustorModule, CompressorModule, EngineGraph, TurbineModule } from './types';
import {
  evaluateOperability,
  evaluateWarnings,
  NonFiniteDesignError,
  OPERABILITY_RULES,
  translateError,
  WARNING_RULES,
  type DesignGoal,
  type WarnCtx,
} from './warnings';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const mod = <T>(g: EngineGraph, type: string) => g.modules.find((m) => m.type === type) as T;

/** Düğme kimliğiyle değer yazar (klon): 'hpc.pr', 'hpt.mach.1', 'engine.massFlow' */
function setKnob(g: EngineGraph, id: string, v: unknown): EngineGraph {
  const c = structuredClone(g);
  const [m, ...path] = id.split('.');
  let o: Record<string, unknown> = m === 'engine' ? (c as unknown as Record<string, unknown>) : (c.modules.find((x) => x.type === m) as unknown as Record<string, unknown>);
  for (let i = 0; i < path.length - 1; i++) o = o[path[i]] as Record<string, unknown>;
  o[path[path.length - 1]] = v;
  return c;
}

function ev(g: EngineGraph, goal?: DesignGoal): Evaluation {
  const r = evaluate(g, { goal });
  if (!isEvaluation(r)) throw new Error(`beklenmeyen hata: ${r.error.raw}`);
  return r;
}

const serious = (f: Finding[]) => f.filter((x) => x.severity !== 'info');
const ids = (f: Finding[]) => f.map((x) => `${x.severity}:${x.id}`);

/** Bugünkü (uydurulmamış) turboprop: §4.1 "Bugün" sütunu. P2 şablonu değiştirse de sonda sabit kalır. */
function legacyTurboprop(): EngineGraph {
  const g = structuredClone(TURBOPROP_GRAPH);
  Object.assign(mod<CompressorModule>(g, 'hpc'), { tipSpeed: 624, mach: [0.252, 0.144], hubTip: 0.5, taper: 0.85, loading: 0.253 });
  mod<CompressorModule>(g, 'hpc').centrifugal = { workFraction: 0.45, loading: 0.72, diffuserRatio: 1.608, gap: 1.143 };
  Object.assign(mod<CombustorModule>(g, 'combustor'), { refVelocity: 8.29, lengthHeight: 3.333 });
  Object.assign(mod<TurbineModule>(g, 'hpt'), { mach: [0.0464, 0.152], hubTip: 0.682, taper: 1, loading: 1.478 });
  Object.assign(mod<TurbineModule>(g, 'lpt'), { tipSpeed: 491, mach: [0.129, 0.271], hubTip: 0.652, taper: 1.13, loading: 0.879 });
  return g;
}

/* ------------------------------------------------------------------ */
/* Şablonlar uyarısız                                                  */
/* ------------------------------------------------------------------ */

/** §4 uydurma hedefleri (P2): uydurulmamış şablonda test atlanır */
const FITTED: Partial<Record<TemplateId, (g: EngineGraph) => boolean>> = {
  turbofan: (g) => mod<CombustorModule>(g, 'combustor').refVelocity >= 18 && mod<TurbineModule>(g, 'hpt').mach[0] >= 0.1,
  turboprop: (g) => (mod<CompressorModule>(g, 'hpc').tipSpeed ?? 999) <= 480,
};

/**
 * Bilinen açık işler: şablonun bugün aştığı eşik (kullanıcı kararı bekliyor,
 * eşik gevşetilmez). militaryTurbofan: karıştırıcıda P19t/P5t 0,69 (warning).
 * Çevrim karışma düzleminde dengesiz; düzeltmek MTF şablonunu (FPR/BPR/T4)
 * değiştirir, altın test ise MTF'nin değişmemesini istiyor.
 */
const OPEN: Partial<Record<TemplateId, string[]>> = {
  militaryTurbofan: ['mixerPR'],
};

const ALL: TemplateId[] = ['turbojet', 'turbojetDry', 'militaryTurbofan', 'turbofanMixed', 'turbofan', 'turboprop', 'turboshaft'];
const ready = (id: TemplateId) => {
  const g = TEMPLATES[id];
  return !!g && layoutNotReady(g) === null && (FITTED[id]?.(g) ?? true);
};

describe('şablonlar uyarısız (caution/warning 0)', () => {
  for (const id of ALL) {
    it.skipIf(!ready(id))(`${id}: tasarım noktası uyarısı yok`, () => {
      const r = ev(TEMPLATES[id]!);
      const open = OPEN[id] ?? [];
      expect(ids(serious(r.findings).filter((f) => !open.includes(f.id)))).toEqual([]);
    });
    it.skipIf(!ready(id))(`${id}: rölanti ve tam güç trim'i uyarısız`, () => {
      expect(ids(serious(evaluateOperability(buildEngine(TEMPLATES[id]!))))).toEqual([]);
    });
  }
  it.todo('militaryTurbofan: karıştırıcı dengesi (mixerPR 0,69) — şablon kararı bekliyor');
});

/* ------------------------------------------------------------------ */
/* Sondalar: her uyarı kimliğini tetikleyen bir grafik                 */
/* ------------------------------------------------------------------ */

interface Probe {
  name: string;
  graph: () => EngineGraph;
  /** Beklenen kimlik ve en az önem */
  expect: { id: string; severity: 'info' | 'caution' | 'warning' }[];
  goal?: DesignGoal;
  /** "Düzelt" önerisi uygulanınca bulgu kalkmalı */
  remedy?: boolean;
  /** Tek düğmeyle kurulabilir düzeltmesi olmayan bulgular (öneri gösterilmez) */
  noRemedy?: string[];
}

const TF = TURBOFAN_GRAPH;
const PROBES: Probe[] = [
  { name: 'TF fan.tipSpeed 560', graph: () => setKnob(TF, 'fan.tipSpeed', 560), expect: [{ id: 'fanTipMach', severity: 'caution' }], remedy: true },
  { name: 'TJ lpc.tipSpeed 560', graph: () => setKnob(TURBOJET_GRAPH, 'lpc.tipSpeed', 560), expect: [{ id: 'frontTipMach', severity: 'caution' }], remedy: true },
  { name: 'MTF fan.tipSpeed 560', graph: () => setKnob(MILITARY_TURBOFAN_GRAPH, 'fan.tipSpeed', 560), expect: [{ id: 'frontTipMach', severity: 'caution' }], remedy: true },
  {
    name: 'bugünkü TP',
    graph: legacyTurboprop,
    expect: [
      { id: 'hpcTipMach', severity: 'warning' },
      { id: 'an2Hpt', severity: 'warning' },
      { id: 'an2Lpt', severity: 'warning' },
      { id: 'combustorVelLow', severity: 'warning' },
      { id: 'axialTipSpeed', severity: 'caution' },
      { id: 'hptInletMach', severity: 'caution' },
    ],
    remedy: true,
    // Giriş Mach'ını tek başına artırmak HPT çıkış kanalını kapatır (uydurmada hubTip de değişir)
    noRemedy: ['hptInletMach'],
  },
  { name: 'TP propeller.rpm 1500', graph: () => setKnob(TURBOPROP_GRAPH, 'propeller.rpm', 1500), expect: [{ id: 'propTipMach', severity: 'warning' }], remedy: true },
  { name: 'TF hpc.tipSpeed 640', graph: () => setKnob(TF, 'hpc.tipSpeed', 640), expect: [{ id: 'axialTipSpeed', severity: 'caution' }], remedy: true },
  {
    name: 'TP hpc.centrifugal.workFraction 0,75',
    graph: () => setKnob(TURBOPROP_GRAPH, 'hpc.centrifugal.workFraction', 0.75),
    expect: [{ id: 'impellerTipSpeed', severity: 'caution' }],
    remedy: true,
  },
  { name: 'TF T4 1780', graph: () => setKnob(TF, 'combustor.tit', 1780), expect: [{ id: 'egtMargin', severity: 'caution' }, { id: 't4', severity: 'caution' }], remedy: true },
  { name: 'TF HPC PR 19', graph: () => setKnob(TF, 'hpc.pr', 19), expect: [{ id: 't3', severity: 'caution' }], remedy: true },
  { name: 'TF W ×0,1', graph: () => setKnob(TF, 'engine.massFlow', TF.massFlow * 0.1), expect: [{ id: 'hpcExitBlade', severity: 'caution' }] },
  { name: 'TF BPR 10', graph: () => setKnob(TF, 'fan.bypassRatio', 10), expect: [{ id: 'lptStages', severity: 'caution' }], remedy: true },
  { name: 'TJ refVelocity 55', graph: () => setKnob(TURBOJET_GRAPH, 'combustor.refVelocity', 55), expect: [{ id: 'combustorVelHigh', severity: 'caution' }], remedy: true },
  { name: 'TJ hpc.loading 0,8', graph: () => setKnob(TURBOJET_GRAPH, 'hpc.loading', 0.8), expect: [{ id: 'hpcLoading', severity: 'caution' }], remedy: true },
  { name: 'TF lpc.loading 1,5', graph: () => setKnob(TF, 'lpc.loading', 1.5), expect: [{ id: 'boosterLoading', severity: 'warning' }], remedy: true },
  { name: 'TF lpt.loading 4,5', graph: () => setKnob(TF, 'lpt.loading', 4.5), expect: [{ id: 'turbineLoading', severity: 'warning' }], remedy: true },
  { name: 'MTF fan.pr 2,5', graph: () => setKnob(MILITARY_TURBOFAN_GRAPH, 'fan.pr', 2.5), expect: [{ id: 'mixerPR', severity: 'warning' }], remedy: true },
  {
    name: 'TJ görev zarfı 0,5 m',
    graph: () => TURBOJET_GRAPH,
    goal: { id: 't', title: 't', brief: '', require: { diameterMax: 0.5 } },
    expect: [{ id: 'envelope', severity: 'caution' }],
  },
  { name: 'TJ W 4 kg/s', graph: () => setKnob(TURBOJET_GRAPH, 'engine.massFlow', 4), expect: [{ id: 'smallEngine', severity: 'info' }] },
  { name: 'TF chevron', graph: () => TF, expect: [{ id: 'chevronCost', severity: 'info' }] },
];

const RANK = { info: 0, caution: 1, warning: 2 } as const;

describe('sondalar: her uyarı bir grafikle tetiklenir', () => {
  it.each(PROBES.map((p) => [p.name, p] as const))('%s', (_n, p) => {
    const g = p.graph();
    const r = ev(g, p.goal);
    for (const e of p.expect) {
      const f = r.findings.find((x) => x.id === e.id);
      expect(f, `${e.id} bekleniyordu: ${ids(r.findings)}`).toBeDefined();
      expect(RANK[f!.severity]).toBeGreaterThanOrEqual(RANK[e.severity]);
      expect(f!.title.length).toBeGreaterThan(3);
      expect(f!.text.length).toBeGreaterThan(20);
      // Düğmeler motorda var olan modüllere ait
      for (const k of f!.knobs) expect(k.split('.')[0] === 'engine' || g.modules.some((m) => m.type === k.split('.')[0])).toBe(true);
      if (!p.remedy) continue;
      if (p.noRemedy?.includes(e.id)) {
        expect(f!.remedy).toBeUndefined();
        continue;
      }
      // "Düzelt": önerilen değer uygulanınca o bulgu kalkar
      expect(f!.remedy, `${e.id} için Düzelt`).toBeDefined();
      const fixed = ev(setKnob(g, f!.remedy!.knob, f!.remedy!.value), p.goal);
      expect(ids(fixed.findings.filter((x) => x.id === e.id))).toEqual([]);
    }
  });

  it('bugünkü TP: HPC Mrel ve HPT AN² sayıları §4.1 ile aynı', () => {
    const s = ev(legacyTurboprop()).summary;
    expect(s.rows.hpc!.mrelTip).toBeCloseTo(1.86, 1);
    expect(s.rows.hpt!.an2! / 1e7).toBeCloseTo(7.22, 1);
  });

  it('frontTipMach Düzelt düğmesi motora göre: TJ lpc, MTF fan', () => {
    const tj = ev(setKnob(TURBOJET_GRAPH, 'lpc.tipSpeed', 560)).findings.find((f) => f.id === 'frontTipMach')!;
    expect(tj.knobs).toEqual(['lpc.tipSpeed']);
    expect(tj.remedy!.knob).toBe('lpc.tipSpeed');
    expect(tj.tags).toEqual(['booster']);
    expect(tj.group).toBe('lpc');
    const mtf = ev(setKnob(MILITARY_TURBOFAN_GRAPH, 'fan.tipSpeed', 560)).findings.find((f) => f.id === 'frontTipMach')!;
    expect(mtf.knobs).toEqual(['fan.tipSpeed']);
    expect(mtf.group).toBe('fan');
  });

  it('remedies: false pahalı Düzelt hesabını atlar', () => {
    const b = buildEngine(setKnob(TF, 'combustor.tit', 1780));
    const ctx: WarnCtx = { graph: b.graph, built: b, s: summarize(b), tech: TECH_MODERN };
    const f = evaluateWarnings(ctx, { remedies: false }).find((x) => x.id === 'egtMargin')!;
    expect(f).toBeDefined();
    expect(f.remedy).toBeUndefined();
  });

  it('çalışabilirlik sondaları: surge payı, rölanti, tam güç', () => {
    const tj = structuredClone(TURBOJET_GRAPH);
    tj.ops = { ...tj.ops, hpcMap: { ...tj.ops!.hpcMap!, surgePRFactor: 1.0 } };
    expect(evaluateOperability(buildEngine(tj)).find((f) => f.id === 'surgeMargin')?.severity).toBe('caution');

    const lean = structuredClone(TF);
    lean.ops = { ...lean.ops, limits: { ...lean.ops!.limits!, leanBlowoutFar: 0.03 } };
    expect(ids(evaluateOperability(buildEngine(lean)))).toContain('warning:idleTrim');

    const hot = structuredClone(TF);
    hot.ops = { ...hot.ops, limits: { ...hot.ops!.limits!, egtAmber: 900 } };
    const f = evaluateOperability(buildEngine(hot));
    expect(ids(f)).toContain('caution:fullTrim');
    expect(f.find((x) => x.id === 'fullTrim')!.title).toContain('EGT');
  });

  it('her uyarı kimliğinin bir sondası var', () => {
    const probed = new Set([...PROBES.flatMap((p) => p.expect.map((e) => e.id)), 'surgeMargin', 'idleTrim', 'fullTrim']);
    for (const r of [...WARNING_RULES, ...OPERABILITY_RULES]) expect(probed.has(r.id), r.id).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Hız                                                                 */
/* ------------------------------------------------------------------ */

describe('hız', () => {
  /**
   * 100 tekrar (5 × 20) [ms/çağrı]: en iyi dilimin ortalaması. Paralel
   * çalışan başka işler (CPU %100) tek tek çağrıları kesintiye uğratır.
   */
  function timeWarnings(g: EngineGraph, remedies: boolean): number {
    const b = buildEngine(g);
    const ctx: WarnCtx = { graph: g, built: b, s: summarize(b), tech: TECH_MODERN };
    for (let i = 0; i < 10; i++) evaluateWarnings(ctx, { remedies }); // ısınma
    let best = Infinity;
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) evaluateWarnings(ctx, { remedies });
      best = Math.min(best, (performance.now() - t0) / 20);
    }
    return best;
  }

  it('evaluateWarnings ≤ 2 ms (100 tekrar): şablonlar ve tek uyarılı sonda, Düzelt dahil', () => {
    for (const g of [TURBOJET_GRAPH, MILITARY_TURBOFAN_GRAPH, TURBOPROP_GRAPH, TF, setKnob(TF, 'combustor.tit', 1780), setKnob(TF, 'fan.tipSpeed', 560)]) {
      expect(timeWarnings(g, true)).toBeLessThan(2);
    }
  });

  it('evaluateWarnings ≤ 2 ms (100 tekrar): altı uyarılı bugünkü TP, taslak ve Düzelt dahil', () => {
    expect(timeWarnings(legacyTurboprop(), false)).toBeLessThan(2);
    expect(timeWarnings(legacyTurboprop(), true)).toBeLessThan(2);
  });

  it('evaluateOperability ≤ 30 ms; yavaş (yüklü) makinede yalnız en az adımlar', () => {
    const b = buildEngine(TF);
    const time = (f: () => void) => {
      const t0 = performance.now();
      f();
      return performance.now() - t0;
    };
    // Ölçümler iç içe: paralel işlerin yük sıçraması ikisini birlikte etkiler
    const op: number[] = [];
    const minSteps: number[] = [];
    for (let i = 0; i < 6; i++) {
      op.push(time(() => evaluateOperability(b)));
      // Bu makinede 1 benzetim saniyesi (en az adım: rölanti 0,5 s + tam güç 0,5 s)
      minSteps.push(time(() => new EngineSim(b.design).trim(1, 1)));
    }
    expect(Math.min(...op)).toBeLessThan(Math.max(32, 1.25 * Math.max(...minSteps) + 3));
  });
});

/* ------------------------------------------------------------------ */
/* Özet                                                                */
/* ------------------------------------------------------------------ */

describe('sonuç özeti', () => {
  it('turbofan: itki, TSFC, kademe etiketi, kütle', () => {
    const b = buildEngine(TF);
    const s = summarize(b);
    expect(s.output).toBe('thrust');
    expect(s.thrust).toBe(b.sized.point.thrust);
    expect(s.tsfc).toBeCloseTo((b.sized.point.wf / b.sized.point.thrust) * 1e6, 6);
    expect(s.stagesLabel).toBe('1+3 · 9 · 2+6');
    expect(s.mass).toBe(b.flowpath.metrics.mass.total);
    expect(Object.values(s.massParts).reduce((a, c) => a + c, 0)).toBeCloseTo(s.mass, 6);
    expect(s.thrustToWeight).toBeCloseTo(s.thrust / (s.mass * 9.80665), 6);
    expect(s.bpr).toBe(9);
    expect(s.fpr).toBe(1.55);
    expect(s.velocityRatio).toBeGreaterThan(0.6);
    expect(s.velocityRatio).toBeLessThan(1);
    expect(s.mixerPR).toBeUndefined();
    expect(s.egtMargin).toBeCloseTo(b.design.limits.egtAmber - (b.sized.point.stations['45'].T - 273.15), 6);
    // Ağırlık merkezi motorun içinde, fan ağır olduğu için ortanın önünde
    const L = b.flowpath.layout;
    expect(s.cgZ).toBeGreaterThan(L.intake.z);
    expect(s.cgZ).toBeLessThan(L.exhaustExit.z);
  });

  it('art yakıcılı motor: yaş itki ve T/W azami itkiyle; karıştırıcı PR', () => {
    const s = summarize(buildEngine(MILITARY_TURBOFAN_GRAPH));
    expect(s.thrustWet).toBeGreaterThan(s.thrust);
    expect(s.thrustToWeight).toBeCloseTo(s.thrustWet! / (s.mass * 9.80665), 6);
    expect(s.mixerPR).toBeGreaterThan(0.5);
    expect(s.stagesLabel).toBe('3 · 10 · 1+2');
  });

  it('turboprop: mil gücü, SFC, devir oranı, pervane itkisi', () => {
    const b = buildEngine(TURBOPROP_GRAPH);
    const s = summarize(b);
    expect(s.output).toBe('propeller');
    expect(s.shaftPower).toBe(b.sized.ref.shaftPower);
    expect(s.sfc).toBeGreaterThan(200);
    expect(s.sfc).toBeLessThan(400);
    expect(s.tsfc).toBeUndefined();
    expect(s.powerToWeight).toBeCloseTo(s.shaftPower! / 1000 / s.mass, 6);
    expect(s.gearRatio).toBeCloseTo(b.flowpath.rpm.lp / mod<{ rpm: number }>(TURBOPROP_GRAPH, 'propeller').rpm, 6);
    // Durağan pervane itkisi jet artığından çok büyük
    expect(s.thrust).toBeGreaterThan(10 * b.sized.point.thrust);
    expect(s.stagesLabel).toMatch(/\+çark · 1\+\d$/);
    expect(s.impellerUTip).toBeGreaterThan(300);
  });

  it('kütle ağırlık merkezleri: her kalemin merkezi var, toplam ağırlıklı ortalama', () => {
    for (const g of [TURBOJET_GRAPH, MILITARY_TURBOFAN_GRAPH, TURBOPROP_GRAPH, TF]) {
      const m = buildEngine(g).flowpath.metrics.mass;
      expect(Object.keys(m.centroids).sort()).toEqual(Object.keys(m.parts).sort());
      const cg = Object.keys(m.parts).reduce((a, k) => a + m.parts[k] * m.centroids[k], 0) / m.total;
      expect(cg).toBeCloseTo(m.cgZ, 6);
    }
  });

  it('diffSummary ve explainDelta: HPC basınç oranı artışı', () => {
    const a = summarize(buildEngine(TF));
    const b = summarize(buildEngine(setKnob(TF, 'hpc.pr', 19)));
    const d = diffSummary(a, b);
    const tsfc = d.find((x) => x.key === 'tsfc')!;
    expect(tsfc.abs).toBeLessThan(0);
    expect(tsfc.better).toBe(true);
    expect(tsfc.text).toMatch(/^TSFC −\d+,\d %$/);
    const mass = d.find((x) => x.key === 'mass')!;
    expect(mass.better).toBe(mass.abs < 0);
    expect(d.find((x) => x.key === 'diameter')?.better ?? null).toBeNull();
    expect(diffSummary(a, a)).toEqual([]);
    const why = explainDelta(a, b);
    expect(why.some((x) => /^HPC \d+ → \d+ kademe$/.test(x))).toBe(true);
    expect(why.some((x) => / kg$/.test(x))).toBe(true);
  });

  it('tr-TR sayılar', () => {
    expect(fmtNum(1.6213, 2)).toBe('1,62');
    expect(fmtNum(1220)).toBe('1.220');
    expect(fmtNum(-0.0001, 1)).toBe('0,0');
  });
});

/* ------------------------------------------------------------------ */
/* Hata çevirisi                                                       */
/* ------------------------------------------------------------------ */

describe('translateError', () => {
  it('GraphError: metin aynen, modül ve düğmeler', () => {
    const t = translateError(new GraphError('Karıştırıcı baypas akışı ister.', 'mixer.bypass', 'mixer', ['fan.bypassRatio']));
    expect(t).toMatchObject({ source: 'graph', group: 'mixer', knobs: ['fan.bypassRatio'], text: 'Karıştırıcı baypas akışı ister.' });
  });

  it('FlowpathError: kod ve sayılardan (metin ayrıştırılmaz)', () => {
    const a = translateError(new FlowpathError('x', 'annulus.closed', 'hpt', ['hpt.taper', 'hpt.mach.1']));
    expect(a.text).toBe("HPT çıkışında kanal kapanıyor: uç çok daralıyor ya da çıkış Mach'ı çok düşük.");
    expect(a.knobs).toEqual(['hpt.taper', 'hpt.mach.1']);
    const c = translateError(new FlowpathError('x', 'combustor.cansFit', 'combustor', ['combustor.cans'], { cans: 14, canDiameter: 0.2 }));
    expect(c.text).toBe('14 kutu çevreye sığmıyor: kutu sayısını azalt ya da referans hızı artır.');
  });

  it.each([
    ['Çekirdek lülesinde genişleyecek basınç kalmıyor (P5 ≤ P0).', 'Çekirdekte genişleyecek basınç kalmadı'],
    ['LP türbini fanı çeviremiyor.', 'LPT’nin çekebileceği iş'],
    ['HP türbini gereken işi çıkaramıyor.', 'HPT kompresörü çeviremiyor'],
    ['Güç türbinine genişleyecek basınç kalmıyor.', 'Güç türbinine genişleyecek basınç kalmadı'],
    ['T4, kompresör çıkış sıcaklığından düşük: yakıt gerekmez.', 'Yanma odası çıkışı girişinden soğuk olamaz'],
  ])('DesignError: %s', (raw, text) => {
    const t = translateError(new DesignError(raw));
    expect(t.source).toBe('design');
    expect(t.text.startsWith(text)).toBe(true);
    expect(t.raw).toBe(raw);
    expect(t.knobs.length).toBeGreaterThan(0);
  });

  it('NaN ve bilinmeyen hata', () => {
    expect(translateError(new NonFiniteDesignError('itki')).title).toBe('Tasarım noktası çözülemedi');
    expect(translateError('tuhaf').raw).toBe('tuhaf');
  });

  it('evaluate: beklenen hatayı öğretir, motorda olmayan düğmeyi ayıklar', () => {
    // TJ'de fan yok: P5 ≤ P0 hatası fan düğmelerini göstermez
    const r = evaluate(setKnob(TURBOJET_GRAPH, 'lpc.pr', 30));
    expect(isEvaluation(r)).toBe(false);
    if (isEvaluation(r)) return;
    expect(r.error.source).toBe('design');
    expect(r.error.knobs.some((k) => k.startsWith('fan.'))).toBe(false);
    // Grafik kuralı
    const g = evaluate({ ...structuredClone(TF), modules: TF.modules.filter((m) => m.type !== 'hpc') });
    expect(!isEvaluation(g) && g.error.source).toBe('graph');
  });

  it('evaluate: program hatası gizlenmez', () => {
    expect(() => evaluate(null as unknown as EngineGraph)).toThrow(TypeError);
  });
});

/* ------------------------------------------------------------------ */
/* Sözlük ve ders bağlantıları                                         */
/* ------------------------------------------------------------------ */

describe('sözlük tutarlılığı', () => {
  const glossary = new Set(GLOSSARY.map((e) => e.id));
  const lessons = new Set(LESSONS.map((l) => l.id));

  it('kimlikler tekil', () => {
    expect(glossary.size).toBe(GLOSSARY.length);
  });

  it('§6.8 yeni girdiler var', () => {
    for (const id of ['tipMach', 'an2', 'tit', 'egtMargin', 'stageLoading', 'refVelocity', 'mixer', 'chevron', 'thrustWeight', 'specificThrust', 'shaftPower', 'turboshaft']) {
      expect(glossary.has(id), id).toBe(true);
    }
  });

  it('her kuralın sözlük ve ders kimliği var', () => {
    for (const r of [...WARNING_RULES, ...OPERABILITY_RULES]) {
      if (r.glossary) expect(glossary.has(r.glossary), `${r.id} → ${r.glossary}`).toBe(true);
      if (r.lesson) expect(lessons.has(r.lesson), `${r.id} → ${r.lesson}`).toBe(true);
    }
  });

  it('hata çevirisinin sözlük kimlikleri var', () => {
    const errs = [
      new DesignError('P5 ≤ P0'),
      new DesignError('LP türbini fanı çeviremiyor.'),
      new DesignError('HP türbini gereken işi çıkaramıyor.'),
      new DesignError('Güç türbinine genişleyecek basınç kalmıyor.'),
      new DesignError('T4, kompresör çıkış sıcaklığından düşük'),
      new FlowpathError('x', 'annulus.closed', 'hpc'),
      new FlowpathError('x', 'combustor.cansFit', 'combustor', [], { cans: 9 }),
    ];
    for (const e of errs) {
      const t = translateError(e);
      if (t.glossary) expect(glossary.has(t.glossary), t.glossary).toBe(true);
    }
  });
});
