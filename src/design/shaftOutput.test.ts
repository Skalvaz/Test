import { describe, expect, it } from 'vitest';
import { ENGINE_CATALOG, EngineSim, sizeEngine, type EngineDesign } from '../sim';
import { cycleRows } from '../ui/CycleDiagram';
import { builtFor } from './catalog';
import { toEngineDesign, type BuiltEngine } from './graph';
import { summarize } from './summary';
import { TURBOPROP_GRAPH } from './templates';
import { deriveTraits } from './traits';
import type { EngineGraph, InletModule, NozzleModule, ShaftModule } from './types';

/*
 * Turboşaft çıkış gücü ve özgül yakıt tüketimi (inceleme bulguları 17, 18).
 * Turboşaft şablonu ve yerleşimi P7'de: o gelene dek TP çekirdekli deneme
 * turboşaftı (sim.test.ts ile aynı yol). Turboşaftın ürünü mil gücüdür:
 * verimi SFC g/(kW·h) ile ölçülür, TSFC (itkiye göre) anlamsızdır; çıkış
 * flanşındaki güç, güç türbini gücünün aktarma verimi (transmissionEff) katıdır.
 */

const HEAVY = 120_000;

function turboshaftGraph(transmissionEff = 0.985): EngineGraph {
  const g = structuredClone(TURBOPROP_GRAPH);
  delete g.kind;
  g.name = 'TS (TP çekirdekli deneme turboşaftı)';
  g.modules = g.modules.filter((m) => m.type !== 'propeller');
  const shaft: ShaftModule = { type: 'shaft', rpm: 20900, drive: 'front', reduction: false, transmissionEff, gearboxLength: 0.35 };
  g.modules.unshift(shaft);
  (g.modules.find((m) => m.type === 'inlet') as InletModule).style = 'annular';
  (g.modules.find((m) => m.type === 'nozzle') as NozzleModule).pressureRatio = 1.05;
  return g;
}

/** Yerleşimi henüz olmayan turboşaft: devirler aynı çekirdekli turboproptan */
function turboshaftDesign(transmissionEff?: number): EngineDesign {
  const tp = ENGINE_CATALOG.turboprop;
  return { ...toEngineDesign(turboshaftGraph(transmissionEff)), n1Rpm: tp.n1Rpm, n2Rpm: tp.n2Rpm };
}

/**
 * summarize için turboşaft: gaz yolu metrikleri (kütle, sıralar) TP
 * şablonundan, tasarım/boyutlandırma/tip turboşafttan. Özetin güç ve yakıt
 * alanları yalnız ikincilerden okunur.
 */
function turboshaftBuilt(transmissionEff?: number): BuiltEngine {
  const tp = builtFor('turboprop')!;
  const graph = turboshaftGraph(transmissionEff);
  const design = turboshaftDesign(transmissionEff);
  return { ...tp, graph, design, sized: sizeEngine(design), traits: deriveTraits(graph) };
}

describe('turboşaft çıkış gücü: aktarma verimi (bulgu 18)', () => {
  it('ref.outputPower = güç türbini gücü × transmissionEff; güç türbini gücü değişmez', () => {
    const lo = sizeEngine(turboshaftDesign(0.97)).ref;
    const hi = sizeEngine(turboshaftDesign(0.995)).ref;
    expect(lo.shaftPower).toBeGreaterThan(1e6);
    // Dinamometrenin emdiği (güç türbininin ürettiği) güç verimden bağımsız
    expect(hi.shaftPower).toBe(lo.shaftPower);
    expect(lo.outputPower).toBeCloseTo(lo.shaftPower * 0.97, 6);
    expect(hi.outputPower).toBeCloseTo(hi.shaftPower * 0.995, 6);
  });

  it('turbopropta ve jet motorlarında çıkış gücü tanımı değişmez', () => {
    const tp = sizeEngine(ENGINE_CATALOG.turboprop).ref;
    expect(tp.outputPower).toBe(tp.shaftPower);
    expect(sizeEngine(ENGINE_CATALOG.turbojet).ref.outputPower).toBe(0);
  });

  it('sonuç özeti: mil gücü çıkış flanşında, SFC ona göre; düğme sonucu değiştirir', () => {
    const lo = summarize(turboshaftBuilt(0.97));
    const hi = summarize(turboshaftBuilt(0.995));
    const ref = turboshaftBuilt(0.97).sized.ref;
    expect(lo.output).toBe('shaft');
    expect(lo.shaftPower).toBeCloseTo(ref.outputPower, 6);
    expect(lo.sfc).toBeCloseTo((turboshaftBuilt(0.97).sized.point.wf / ref.outputPower) * 3.6e9, 6);
    expect(hi.shaftPower! / lo.shaftPower!).toBeCloseTo(0.995 / 0.97, 6);
    expect(hi.sfc!).toBeLessThan(lo.sfc!);
    expect(lo.tsfc).toBeUndefined();
    // Turbopropta özet eskisi gibi güç türbini gücü (= çıkış)
    const tp = builtFor('turboprop')!;
    expect(summarize(tp).shaftPower).toBe(tp.sized.ref.shaftPower);
  });

  it(
    'simülasyon: anlık mil gücü çıkış flanşında, tork ve güç oranı tutarlı',
    () => {
      const d = turboshaftDesign(0.97);
      const sim = new EngineSim(d);
      sim.trim(1, 30);
      const s = sim.snapshot();
      const ref = sim.eng.ref;
      expect(s.shaftPower).toBeCloseTo(sim.propPower * 0.97, 3);
      expect(s.shaftPower / ref.outputPower).toBeGreaterThan(0.8);
      expect(s.thrustFrac).toBeCloseTo(s.shaftPower / ref.outputPower, 9);
      expect(s.torque).toBeCloseTo(s.shaftPower / ref.outputPower / s.N1, 9);
    },
    HEAVY,
  );
});

describe('turboşaft özgül yakıt tüketimi (bulgu 17)', () => {
  it(
    'TSFC yok (0), SFC g/(kW·h) çıkış gücüne göre; çevrim panelinde SFC',
    () => {
      const d = turboshaftDesign();
      const sim = new EngineSim(d);
      const traits = deriveTraits(turboshaftGraph());
      for (const throttle of [1, 0]) {
        sim.trim(throttle, 30);
        const s = sim.snapshot();
        // Egzoz artığı itkisi eski eşiğin (100 N) üstünde: eski kod TSFC
        // diye yakıtı bu küçük itkiye bölüyordu (150–250 g/(kN·s))
        expect(s.thrust).toBeGreaterThan(100);
        expect(s.tsfc).toBe(0);
        expect(s.sfc).toBeCloseTo(s.wf / s.shaftPower, 12);
        const row = cycleRows(s, traits, false).find((r) => r[0] === 'Özgül yakıt tüketimi')!;
        expect(row[1]).toMatch(/ g\/kW·h$/);
        if (throttle === 1) {
          // T700 sınıfı küçük turboşaft bandı (glossary: ~270–320)
          expect(s.sfc * 3.6e9).toBeGreaterThan(230);
          expect(s.sfc * 3.6e9).toBeLessThan(340);
          expect(row[1]).toBe(`${(s.sfc * 3.6e9).toFixed(0)} g/kW·h`);
        }
      }
    },
    HEAVY,
  );

  it(
    'turboprop ve turbojet: TSFC eskisi gibi (itkiye göre), panelde g/kN·s',
    () => {
      const tp = new EngineSim(ENGINE_CATALOG.turboprop);
      tp.trim(1, 30);
      const s = tp.snapshot();
      expect(s.tsfc).toBeCloseTo(s.wf / s.thrust, 12);
      expect(s.sfc).toBeCloseTo(s.wf / s.shaftPower, 12);
      const tpRow = cycleRows(s, builtFor('turboprop')!.traits, false).find((r) => r[0] === 'Özgül yakıt tüketimi')!;
      expect(tpRow[1]).toMatch(/ g\/kN·s$/);
      const tj = new EngineSim(ENGINE_CATALOG.turbojet);
      tj.trim(1, 30);
      const j = tj.snapshot();
      expect(j.tsfc).toBeCloseTo(j.wf / j.thrust, 12);
      expect(j.sfc).toBe(0);
    },
    HEAVY,
  );
});
