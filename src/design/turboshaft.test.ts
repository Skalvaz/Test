/**
 * M5a P7: turboşaft şablonu (T700-GE-701C sınıfı), yerleşimi ve test
 * hücresi davranışı (docs/M5A-SPEC.md §3.5, §4.3, §7.1 P7).
 */

import { describe, expect, it } from 'vitest';
import { ENGINE_CATALOG, sizeEngine } from '../sim/design';
import { EngineSim, type SimEventType } from '../sim/engineSim';
import { cycleRows } from '../ui/CycleDiagram';
import { fakeArchitectureOf, fakeSummarize } from '../workshop/testing';
import { buildEngineCard } from './card';
import { builtFor, TEMPLATES } from './catalog';
import { solveMassFlow } from './defaults';
import { familyToDoc } from './engineDoc';
import { evaluate, isEvaluation } from './evaluate';
import { SHAFT_Z } from './flowpath';
import { buildEngine, toEngineDesign } from './graph';
import { summarize } from './summary';
import { TURBOPROP_GRAPH } from './templates';
import type { EngineGraph, InletModule, ShaftModule } from './types';
import { evaluateOperability } from './warnings';

const TS = TEMPLATES.turboshaft!;
const mod = <T extends { type: string }>(g: EngineGraph, t: T['type']) => g.modules.find((m) => m.type === t) as unknown as T;

/** Ağır (sim koşan) testlerin süre sınırı */
const HEAVY = 120_000;

describe('turboşaft şablonu: §4.3 bandı (T700-GE-701C)', () => {
  const b = buildEngine(TS);
  const s = summarize(b);

  it('mil gücü 1,2–1,6 MW, SFC 260–330 g/(kW·h), kütle 150–320 kg, güç/ağırlık 5–8 kW/kg', () => {
    expect(s.output).toBe('shaft');
    expect(s.shaftPower!).toBeGreaterThan(1.2e6);
    expect(s.shaftPower!).toBeLessThan(1.6e6);
    expect(s.sfc!).toBeGreaterThan(260);
    expect(s.sfc!).toBeLessThan(330);
    expect(s.mass).toBeGreaterThan(150);
    expect(s.mass).toBeLessThan(320);
    expect(s.powerToWeight!).toBeGreaterThan(5);
    expect(s.powerToWeight!).toBeLessThan(8);
    // Turboşaftta itki ve TSFC anlamsız: özet TSFC vermez, itki egzoz artığı
    expect(s.tsfc).toBeUndefined();
    expect(s.thrust).toBeLessThan(2e3);
  });

  it('çıkış 20 900 rpm: güç türbini doğrudan tahrik (devir farkı < %5, redüktör yok)', () => {
    const L = b.flowpath.layout;
    if (L.style !== 'turboshaft') throw new Error('yerleşim');
    expect(L.output.rpm).toBe(20900);
    expect(Math.abs(b.flowpath.rpm.lp / 20900 - 1)).toBeLessThan(0.05);
    expect(L.output.reduction).toBe(false);
    expect(s.gearRatio!).toBeCloseTo(b.flowpath.rpm.lp / 20900, 9);
    expect(b.flowpath.metrics.mass.parts.gearbox).toBeUndefined();
  });

  it('kademeler T700 gibi: 5 eksenel + çark, 2 HPT, 2 güç türbini; son eksenel kanat ≥ 12,5 mm', () => {
    const gp = b.flowpath.gas;
    expect(gp.front).toBeUndefined();
    expect(gp.hpc.stages).toBe(5);
    expect(gp.centrifugal).toBeDefined();
    expect(gp.hpt.stages).toBe(2);
    expect(gp.lpt.stages).toBe(2);
    expect(b.flowpath.metrics.hpcExitBladeMm).toBeGreaterThanOrEqual(12.5);
    expect(s.stagesLabel).toBe('5+çark · 2+2');
  });

  it('uyarı ve çalışabilirlik bulgusu yok (caution/warning 0)', () => {
    const ev = evaluate(TS);
    expect(isEvaluation(ev)).toBe(true);
    if (!isEvaluation(ev)) return;
    expect(ev.findings.filter((f) => f.severity !== 'info').map((f) => f.id)).toEqual([]);
    expect(evaluateOperability(b).filter((f) => f.severity !== 'info').map((f) => f.id)).toEqual([]);
  });

  it('katalogda: tip turboshaft, önden görünen kademe HPC (fanBlades = hpc.blades[0])', () => {
    expect(b.design.kind).toBe('turboshaft');
    expect(b.traits).toMatchObject({ layout: 'turboshaft', output: 'shaft', lpLoad: 'shaft', centrifugal: true, nozzle: 'stub' });
    expect(b.design.fanBlades).toBe(b.flowpath.gas.hpc.blades[0]);
    expect(ENGINE_CATALOG.turboshaft).toBe(builtFor('turboshaft')!.design);
    expect(b.design.shaft).toEqual({ rpm: 20900, nozzlePR: 1.05, transmissionEff: 0.985 });
    expect(b.design.prop).toBeUndefined();
  });
});

describe('turboşaft yerleşimi', () => {
  const b = buildEngine(TS);
  const L = b.flowpath.layout;
  if (L.style !== 'turboshaft') throw new Error('yerleşim');

  it('eksenel sıra: flanş → mil gövdesi → halka giriş → HPC → … → egzoz', () => {
    const gp = b.flowpath.gas;
    const shaft = mod<ShaftModule>(TS, 'shaft');
    expect(L.output.z).toBe(SHAFT_Z);
    expect(L.inlet.z0).toBeCloseTo(SHAFT_Z + shaft.gearboxLength, 12);
    expect(L.inlet.z1).toBeCloseTo(gp.hpc.z0, 12);
    expect(gp.hpc.z0).toBeGreaterThan(L.inlet.z0);
    expect(gp.combustor.z0).toBeGreaterThan(gp.centrifugal!.z);
    expect(gp.lpt.z0).toBeGreaterThan(gp.hpt.z1);
    expect(L.exhaustExit.z).toBeGreaterThan(gp.lpt.z1);
    // Giriş ağzı: merkez gövde çıkış milinin flanşını sarar, dış duvar HPC ucundan geniş
    expect(L.inlet.rInner).toBeGreaterThan(L.output.flangeR);
    expect(L.inlet.rOuter).toBeGreaterThan(gp.hpc.tip[0]);
    expect(L.inlet.separator).toBe(true);
    expect(L.intake).toEqual({ z: L.inlet.z0, radius: L.inlet.rOuter, y: 0 });
    expect(b.flowpath.metrics.length).toBeCloseTo(L.exhaustExit.z - SHAFT_Z, 12);
  });

  it('bağlantılar: çıkış flanşı + ön/arka trunnion; dış zarf z artan, çap zarftan', () => {
    expect(L.mounts.map((m) => m.id)).toEqual(['output', 'front', 'rear']);
    expect(L.mounts[0]).toMatchObject({ type: 'flange', z: SHAFT_Z, r: L.output.flangeR });
    for (let i = 1; i < L.outerProfile.length; i++) expect(L.outerProfile[i][0]).toBeGreaterThan(L.outerProfile[i - 1][0]);
    const maxR = Math.max(...L.outerProfile.map(([, r]) => r));
    expect(b.flowpath.metrics.diameter).toBeCloseTo(2 * maxR, 12);
    expect(L.engineR).toBeGreaterThanOrEqual(maxR - 1e-9);
    // Çıkış mili yarıçapı torkun küp kökü ile
    const torque = b.sized.ref.outputPower / ((20900 * 2 * Math.PI) / 60);
    expect(L.output.radius).toBeCloseTo(0.00305 * Math.cbrt(torque), 9);
  });

  it('çıkış devri güç türbininden %5 farklıysa redüktör takılır: kütle ve gövde büyür', () => {
    const g = structuredClone(TS);
    mod<ShaftModule>(g, 'shaft').rpm = 6000;
    const r = buildEngine(g);
    const Lr = r.flowpath.layout;
    if (Lr.style !== 'turboshaft') throw new Error('yerleşim');
    expect(Lr.output.reduction).toBe(true);
    expect(Lr.output.gearRatio).toBeCloseTo(r.flowpath.rpm.lp / 6000, 9);
    expect(Lr.housing.gearboxR).toBeGreaterThan(Lr.housing.r);
    // Redüktör kütlesi tork ile (8,5 kg / kN·m); düşük devirde tork büyük
    const torqueKNm = (r.sized.ref.outputPower / ((6000 * 2 * Math.PI) / 60)) * 1e-3;
    expect(r.flowpath.metrics.mass.parts.gearbox).toBeCloseTo(8.5 * torqueKNm, 6);
    expect(r.flowpath.metrics.mass.total).toBeGreaterThan(b.flowpath.metrics.mass.total);
    // Çevrim değişmez: devir oranı yalnız redüktörü değiştirir
    expect(r.sized.ref.outputPower).toBe(b.sized.ref.outputPower);
  });

  it('redüktör gövdesi halka girişin merkez gövdesinin içinde kalır (ağız açık)', () => {
    const cases: [number, boolean][] = [[3000, false], [6000, false], [20900, true]];
    for (const [rpm, red] of cases) {
      const g = structuredClone(TS);
      const sh = mod<ShaftModule>(g, 'shaft');
      sh.rpm = rpm;
      sh.reduction = red;
      const Lr = buildEngine(g).flowpath.layout;
      if (Lr.style !== 'turboshaft') throw new Error('yerleşim');
      expect(Lr.output.reduction).toBe(true);
      expect(Lr.housing.gearboxR).toBeLessThan(Lr.inlet.rInner);
      expect(Lr.inlet.rOuter).toBeGreaterThan(Lr.inlet.rInner);
    }
  });

  it('inlet.length uç değerlerinde z sırası: gövde ağzın önüne taşmaz, çerçeve rotora girmez; kuyruk konisi monoton', () => {
    for (const len of [0, 0.3, 0.79, 2]) {
      const g = structuredClone(TS);
      mod<InletModule>(g, 'inlet').length = len;
      const r = buildEngine(g);
      const Lr = r.flowpath.layout;
      if (Lr.style !== 'turboshaft') throw new Error('yerleşim');
      expect(Lr.gg.case[0][1]).toBeGreaterThanOrEqual(Lr.inlet.z0 - 1e-12);
      for (let i = 1; i < Lr.gg.case.length; i++) expect(Lr.gg.case[i][1]).toBeGreaterThan(Lr.gg.case[i - 1][1]);
      expect(Lr.inlet.z1).toBeLessThanOrEqual(r.flowpath.gas.hpc.z0 + 1e-12);
      expect(Lr.inlet.z1 - Lr.inlet.z0).toBeGreaterThanOrEqual(0.04 * Lr.k - 1e-12);
      const ex = Lr.gg.exhaust;
      const mid = 0.5 * (ex.z0 + ex.coneZ1);
      expect(ex.z0 - 0.03 * Lr.k).toBeLessThan(mid);
      expect(mid).toBeLessThan(ex.coneZ1);
    }
  });

  it('turboprop gaz jeneratörü aynı ortak koddan, ölçek 1 (altın sayılar golden.test.ts)', () => {
    const tp = buildEngine(TURBOPROP_GRAPH).flowpath.layout;
    if (tp.style !== 'turboprop') throw new Error('yerleşim');
    expect(tp.exhaust.z1 - tp.gas.lpt.z1).toBeCloseTo(0.72, 12);
    expect(tp.engineR - Math.max(...tp.case.map(([r]) => r))).toBeCloseTo(0.05, 12);
  });
});

describe('çıkış gücü tek tanım: ref.outputPower (×transmissionEff)', () => {
  const b = buildEngine(TS);
  const P = b.sized.ref.outputPower;

  it('özet, taklit özet, motor kartı ve hava akışı çözücüsü aynı gücü kullanır', () => {
    expect(P).toBeCloseTo(b.sized.ref.shaftPower * 0.985, 6);
    expect(summarize(b).shaftPower).toBe(P);
    expect(fakeSummarize(b).shaftPower).toBe(P);
    const doc = familyToDoc({
      id: 'f_0000000007',
      code: 'AT-7',
      name: 'AT-7 Turboşaft',
      base: TS,
      envelope: {},
      variants: [{ id: 'v_00000001', name: 'AT-7/14', nameLocked: false, values: {} }],
      active: 'v_00000001',
      origin: { from: 'template', template: 'turboshaft' },
    });
    const card = buildEngineCard(doc, 'v_00000001', b, { archKey: (x) => JSON.stringify(fakeArchitectureOf(x.graph)) });
    expect(card.ratings.takeoff.shaftPower).toBe(P);
    expect(card.ratings.takeoff.sfc).toBeCloseTo(summarize(b).sfc!, 9);
    expect(card.dims.outputShaft).toMatchObject({ z: SHAFT_Z, rpm: 20900, drive: 'front' });
    // Şablonun kendi gücünü hedefleyen çözücü şablonun hava akışını bulur
    expect(solveMassFlow(TS, { shaftPower: P })).toBeCloseTo(TS.massFlow, 3);
    const W = solveMassFlow(TS, { shaftPower: 1.2e6 });
    expect(sizeEngine(toEngineDesign({ ...TS, massFlow: W })).ref.outputPower / 1.2e6).toBeCloseTo(1, 2);
  });
});

describe('turboşaft test hücresinde (dinamometre)', () => {
  /** App.beginAutoStart / updateAutoStart sırası */
  function autoStart() {
    const sim = new EngineSim(builtFor('turboshaft')!.design);
    const seen: SimEventType[] = [];
    const at: Partial<Record<SimEventType, number>> = {};
    sim.on((e) => {
      seen.push(e.type);
      at[e.type] ??= e.time;
    });
    Object.assign(sim.controls, { apuBleed: true, starter: true, ignition: true });
    let peakEgt = -99;
    let peakN1 = 0;
    for (let t = 0; t < 70; t += 1 / 60) {
      const c = sim.controls;
      if (!c.fuelRun && sim.N2 >= sim.limits.fuelOnMinN2 + 0.02) c.fuelRun = true;
      if (sim.phase === 'running' && sim.N2 > sim.limits.idleN2 - 0.02) {
        c.apuBleed = false;
        c.ignition = false;
      }
      peakEgt = Math.max(peakEgt, sim.egtSensor);
      peakN1 = Math.max(peakN1, sim.N1);
      sim.step(1 / 60);
    }
    return { sim, seen, at, peakEgt, peakN1 };
  }

  it('otomatik çalıştırma: light-off 20–40 s, rölanti 60 s içinde, sıcak çalıştırma yok', () => {
    const r = autoStart();
    expect(r.at.lightoff!).toBeGreaterThan(20);
    expect(r.at.lightoff!).toBeLessThan(40);
    expect(r.at.idle!).toBeLessThan(60);
    expect(r.seen).not.toContain('hotStart');
    expect(r.seen).not.toContain('hungStart');
    expect(r.peakEgt).toBeLessThan(r.sim.limits.egtStart);
  }, HEAVY);

  it('gaz adımı ve kesme: NP aşımı yok, NP %100 ±%2, güç tasarımın ≥ %95i', () => {
    const r = autoStart();
    const sim = r.sim;
    const ref = sim.eng.ref;
    let peakN1 = r.peakN1;
    sim.controls.throttle = 1;
    for (let t = 0; t < 12; t += 1 / 60) {
      sim.step(1 / 60);
      peakN1 = Math.max(peakN1, sim.N1);
    }
    const full = sim.snapshot();
    expect(Math.abs(full.N1 - 1)).toBeLessThan(0.02);
    expect(full.shaftPower / ref.outputPower).toBeGreaterThan(0.95);
    expect(full.egtLimited).toBe(false);
    sim.controls.throttle = 0;
    for (let t = 0; t < 12; t += 1 / 60) {
      sim.step(1 / 60);
      peakN1 = Math.max(peakN1, sim.N1);
    }
    sim.controls.throttle = 1;
    for (let t = 0; t < 12; t += 1 / 60) {
      sim.step(1 / 60);
      peakN1 = Math.max(peakN1, sim.N1);
    }
    expect(r.seen).not.toContain('n1Overspeed');
    expect(r.seen).not.toContain('surge');
    // NP kırmızı çizgisi helikopter geçici sınırı (%107); tepe ondan en az %2 aşağıda
    expect(sim.limits.n1Redline).toBeCloseTo(1.07, 9);
    expect(peakN1).toBeLessThan(sim.limits.n1Redline - 0.02);
    expect(sim.surgeCount).toBe(0);
  }, HEAVY);

  it('rölanti ve tam güç trim: yanıyor, rölantide N2 sınırda, tam güçte NP %100', () => {
    const sim = new EngineSim(builtFor('turboshaft')!.design);
    sim.trim(0, 30);
    expect(sim.lit).toBe(true);
    expect(sim.N2).toBeGreaterThan(sim.limits.idleN2 - 0.02);
    sim.trim(1, 30);
    expect(Math.abs(sim.N1 - 1)).toBeLessThan(0.02);
    const s = sim.snapshot();
    expect(s.shaftPower / sim.eng.ref.outputPower).toBeGreaterThan(0.95);
    // Snapshot: TSFC yok (0), SFC çıkış gücüne göre; çevrim diyagramı g/(kW·h) yazar
    expect(s.tsfc).toBe(0);
    expect(s.sfc).toBeCloseTo(s.wf / s.shaftPower, 12);
    const rows = Object.fromEntries(cycleRows(s, { output: 'shaft', afterburner: false, exhaust: 'single' }, false));
    expect(rows['Özgül yakıt tüketimi']).toMatch(/g\/kW·h$/);
    expect(Number.parseFloat(rows['Özgül yakıt tüketimi'])).toBeGreaterThan(250);
    expect(Number.parseFloat(rows['Özgül yakıt tüketimi'])).toBeLessThan(340);
  });
});
