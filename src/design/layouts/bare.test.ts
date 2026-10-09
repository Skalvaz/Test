/**
 * Art yakıcısız çıplak motor ve kutu-halka yanma odası (M5a P5).
 *
 * Kuru turbojet şablonu gerçek motor bandında (docs/M5A-SPEC.md §4.3,
 * J57-P-43 / J79 kuru), yerleşimi tutarlı (jet borusu, sabit lüle, kütle)
 * ve normal çalıştırmada rölantiye oturur. Yanma odası stili her aileye
 * diktir: üç stil de dört şablonda kurulur.
 */

import { describe, expect, it } from 'vitest';
import { EngineSim, type SimEventType } from '../../sim/engineSim';
import { TEMPLATES } from '../catalog';
import { INTAKE_Z, type BareJetLayout } from '../flowpath';
import { buildEngine } from '../graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_DRY_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from '../templates';
import { deriveTraits } from '../traits';
import type { CombustorModule, CombustorStyle, EngineGraph, EngineModule, NozzleModule } from '../types';
import { LAYOUT_READY, layoutNotReady } from './index';

const G = 9.80665;

/** Klonlayıp bir modülü değiştirir */
function tweak<T extends EngineModule>(g: EngineGraph, type: T['type'], f: (m: T) => void): EngineGraph {
  const c = structuredClone(g);
  f(c.modules.find((m) => m.type === type) as T);
  return c;
}
/** Art yakıcıyı çıkarıp lüleyi sabit yapar (aynı çekirdek) */
const dryOf = (g: EngineGraph) =>
  tweak<NozzleModule>({ ...structuredClone(g), modules: g.modules.filter((m) => m.type !== 'afterburner').map((m) => structuredClone(m)) }, 'nozzle', (n) => {
    n.style = 'fixed';
    delete n.flaps;
  });

const layoutOf = (g: EngineGraph) => buildEngine(g).flowpath.layout as BareJetLayout;

describe('kuru turbojet şablonu (§4.3: J57-P-43 / J79 kuru)', () => {
  const b = buildEngine(TURBOJET_DRY_GRAPH);
  const p = b.sized.point;
  const m = b.flowpath.metrics;

  it('katalogda; türetilmiş tip turbojet, art yakıcısız, sabit lüle, kutu-halka', () => {
    expect(TEMPLATES.turbojetDry).toBe(TURBOJET_DRY_GRAPH);
    expect(deriveTraits(TURBOJET_DRY_GRAPH)).toMatchObject({
      presentation: 'turbojet',
      layout: 'bare',
      lpLoad: 'lpc',
      afterburner: false,
      nozzle: 'fixed',
      variableNozzle: false,
      combustor: 'canAnnular',
      exhaust: 'single',
    });
    expect(b.design.afterburner).toBeUndefined();
  });

  it('itki 45–55 kN, TSFC 21–26 g/(kN·s), OPR 9–13, kütle 1000–1500 kg, T/W 3,5–5', () => {
    const tsfc = (p.wf / p.thrust) * 1e6;
    const tw = p.thrust / (m.mass.total * G);
    expect(p.thrust / 1000).toBeGreaterThan(45);
    expect(p.thrust / 1000).toBeLessThan(55);
    expect(tsfc).toBeGreaterThan(21);
    expect(tsfc).toBeLessThan(26);
    expect(p.opr).toBeGreaterThan(9);
    expect(p.opr).toBeLessThan(13);
    expect(m.mass.total).toBeGreaterThan(1000);
    expect(m.mass.total).toBeLessThan(1500);
    expect(tw).toBeGreaterThan(3.5);
    expect(tw).toBeLessThan(5);
  });

  it('şablon eşiklerin (TECH_MODERN) en az %4 içinde', () => {
    const gp = b.flowpath.gas;
    const t45 = p.stations['45'].T;
    expect(b.design.limits.egtAmber - (t45 - 273.15)).toBeGreaterThan(35);
    expect(p.stations['3'].T).toBeLessThan(1000 / 1.04);
    expect(m.tipMachRel.lp).toBeLessThan(1.72 / 1.04);
    expect(m.tipMachRel.hp).toBeLessThan(1.55 / 1.04);
    expect(Math.max(m.an2.hpt, m.an2.lpt)).toBeLessThan(4.2e7 / 1.04);
    expect(gp.hpc.loading).toBeLessThan(0.6 / 1.04);
    expect(Math.max(gp.hpt.loading, gp.lpt.loading)).toBeLessThan(3.2 / 1.04);
    expect((gp.hpc.tip[1] - gp.hpc.hub[1]) * 1000).toBeGreaterThan(12 * 1.04);
    const vref = (TURBOJET_DRY_GRAPH.modules.find((x) => x.type === 'combustor') as CombustorModule).refVelocity;
    expect(vref).toBeLessThan(52 / 1.04);
    expect(vref).toBeGreaterThan(15 * 1.04);
  });

  it('normal çalıştırma: marş → yakıt → light-off → rölanti, sıcak çalıştırma yok; 10 s içinde tam güç', () => {
    const sim = new EngineSim(b.design);
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
    expect(sim.lit).toBe(true);
    expect(sim.N2).toBeGreaterThan(sim.limits.idleN2 - 0.03);
    sim.controls.throttle = 1;
    for (let t = 0; t < 10; t += 1 / 60) sim.step(1 / 60);
    expect(sim.N1).toBeGreaterThan(0.95);
    expect(sim.snapshot().cycle.netThrust / p.thrust).toBeGreaterThan(0.97);
    expect(sim.snapshot().cycle.netThrust / p.thrust).toBeLessThan(1.03);
    expect(sim.surgeCount).toBe(0);
  }, 30000);
});

describe('art yakıcısız çıplak yerleşim', () => {
  it('kuru dal hazır', () => {
    expect(LAYOUT_READY.bare).toBe(true);
    expect(layoutNotReady(TURBOJET_DRY_GRAPH)).toBeNull();
  });

  it('jet borusu (boy 1,2·r), sabit lüle ağzı √(A9/π), kuyruk konisi lüle içinde', () => {
    const b = buildEngine(TURBOJET_DRY_GRAPH);
    const L = b.flowpath.layout as BareJetLayout;
    const n = L.nozzle;
    if (n.kind !== 'fixed' || !L.jetPipe) throw new Error('sabit lüle ve jet borusu bekleniyordu');
    expect(L.ab).toBeNull();
    expect(L.jetPipe.z1 - L.jetPipe.z0).toBeCloseTo(1.2 * L.jetPipe.r, 9);
    expect(L.jetPipe.r).toBeCloseTo(L.gas.lpt.tip[1] + 0.01, 9);
    expect(n.z0).toBe(L.jetPipe.z1);
    expect(n.r0).toBe(L.jetPipe.r);
    expect(n.rExit).toBeCloseTo(Math.sqrt(b.sized.ref.A9 / Math.PI), 9);
    expect(n.rExit).toBeLessThan(n.r0);
    // Koni yarı açısı en çok ~14°
    expect((n.r0 - n.rExit) / (n.z1 - n.z0)).toBeLessThanOrEqual(Math.tan((14 * Math.PI) / 180) + 1e-9);
    expect(n.z1).toBeGreaterThan(L.tailCone[1]);
    expect(L.exhaustExit).toEqual({ z: n.z1, radius: n.rExit });
    expect(b.flowpath.metrics.length).toBeCloseTo(n.z1 - INTAKE_Z, 9);
    // Dış zarf z'de artan, lüle ağzında biter
    const env = L.outerProfile;
    for (let i = 1; i < env.length; i++) expect(env[i][0]).toBeGreaterThan(env[i - 1][0]);
    expect(env[env.length - 1][0]).toBeCloseTo(n.z1, 9);
    expect(L.mounts.length).toBeGreaterThanOrEqual(2);
    // Flanşlar: jet borusu başı ve lüle flanşı
    expect(L.flanges).toContain(L.jetPipe.z0);
    expect(L.flanges).toContain(L.jetPipe.z1);
  });

  it('kütle: art yakıcıyı çıkarmak kütleyi en az art yakıcı kalemi kadar düşürür (aynı çekirdek)', () => {
    const tj = buildEngine(TURBOJET_GRAPH).flowpath.metrics.mass;
    const dry = buildEngine(dryOf(TURBOJET_GRAPH)).flowpath.metrics.mass;
    expect(tj.parts.afterburner).toBeGreaterThan(100);
    expect(dry.parts.afterburner).toBeUndefined();
    expect(dry.parts.jetPipe).toBeGreaterThan(0);
    expect(dry.parts.nozzle).toBeLessThan(tj.parts.nozzle);
    expect(tj.total - dry.total).toBeGreaterThanOrEqual(tj.parts.afterburner);
    // Kuru şablon da TJ'den hafif
    expect(buildEngine(TURBOJET_DRY_GRAPH).flowpath.metrics.mass.total).toBeLessThan(tj.total);
  });

  it('art yakıcılı şablonların yerleşimi değişmez (değişken lüle, art yakıcı kanalı)', () => {
    for (const g of [TURBOJET_GRAPH, MILITARY_TURBOFAN_GRAPH]) {
      const L = layoutOf(g);
      expect(L.ab).not.toBeNull();
      expect(L.jetPipe).toBeUndefined();
      expect(L.nozzle.kind).toBeUndefined();
    }
  });

  it('karışık akışlı kuru çıplak turbofan (Spey sınıfı): ortak jet borusu ve lüle', () => {
    const g = dryOf(MILITARY_TURBOFAN_GRAPH);
    const b = buildEngine(g);
    const L = b.flowpath.layout as BareJetLayout;
    expect(deriveTraits(g)).toMatchObject({ layout: 'bare', exhaust: 'mixed', afterburner: false, nozzle: 'fixed' });
    if (L.nozzle.kind !== 'fixed' || !L.jetPipe) throw new Error('sabit lüle bekleniyordu');
    expect(L.jetPipe.r).toBeCloseTo(L.R - 0.03, 9);
    const r = b.sized.ref;
    const A = r.A9mix ?? r.A9 + r.A19;
    expect(L.nozzle.rExit).toBeCloseTo(Math.sqrt(A / Math.PI), 9);
    expect(b.flowpath.metrics.mass.parts.afterburner).toBeUndefined();
  });

  it('uç hava akışlarında (10 ve 200 kg/s) kurulur, ölçüler sonlu ve oranlı', () => {
    const throats: number[] = [];
    for (const massFlow of [10, 200]) {
      const b = buildEngine({ ...TURBOJET_DRY_GRAPH, massFlow });
      const L = b.flowpath.layout as BareJetLayout;
      if (L.nozzle.kind !== 'fixed') throw new Error('sabit lüle bekleniyordu');
      for (const v of [L.throat, L.nozzle.rExit, L.nozzle.z1, b.flowpath.metrics.mass.total]) expect(Number.isFinite(v)).toBe(true);
      expect(L.nozzle.z1).toBeGreaterThan(L.tailCone[1]);
      // Bellmouth dış zarfı boğazla orantılı (0,38 m / 0,4 m)
      expect(L.outerProfile[0][1] / L.throat).toBeCloseTo(1 + 0.38 / 0.39992, 6);
      throats.push(L.throat);
    }
    expect(throats[1] / throats[0]).toBeGreaterThan(4);
  });
});

describe('yanma odası stili her aileye dik (§3.3)', () => {
  const styled = (g: EngineGraph, style: CombustorStyle, o: { vref?: number; cans?: number } = {}) =>
    tweak<CombustorModule>(g, 'combustor', (c) => {
      c.style = style;
      if (style === 'annular') delete c.cans;
      else {
        // Dönüşüm tablosu (§2.4): kutu 10, kutu-halka 8; ref. hız ≥ 25 m/s
        c.cans = o.cans ?? c.cans ?? (style === 'can' ? 10 : 8);
        c.refVelocity = o.vref ?? Math.max(c.refVelocity, 25);
        c.dp = style === 'can' ? 0.06 : 0.05;
      }
    });
  /**
   * Kutular çevreye sığmazsa tipli hata (combustor.cansFit). Öğrencinin
   * yapacağı gibi önce referans hız 5 m/s adımlarla artırılır (kutu
   * incelir; kutu üst sınırı 52 m/s'nin altında kalır), yetmezse kutu
   * sayısı azaltılır. Küçük ortalama yarıçaplı motorlarda (TJ, MTF) §2.4
   * varsayılanı (10 kutu, 25 m/s) sığmaz.
   */
  function buildStyled(g: EngineGraph, style: CombustorStyle) {
    if (style === 'annular') return buildEngine(styled(g, style));
    const v0 = Math.max((g.modules.find((m) => m.type === 'combustor') as CombustorModule).refVelocity, 25);
    for (const cans of style === 'can' ? [10, 8, 6] : [8, 6]) {
      for (let v = v0; v < 52; v += 5) {
        try {
          return buildEngine(styled(g, style, { vref: v, cans }));
        } catch (e) {
          expect(e).toMatchObject({ name: 'FlowpathError', code: 'combustor.cansFit', group: 'combustor' });
        }
      }
    }
    throw new Error('kutular hiçbir ayarda sığmadı');
  }
  const families: [string, EngineGraph][] = [
    ['turbojet', TURBOJET_GRAPH],
    ['turbojetDry', TURBOJET_DRY_GRAPH],
    ['militaryTurbofan', MILITARY_TURBOFAN_GRAPH],
    ['turboprop', TURBOPROP_GRAPH],
    ['turbofan', TURBOFAN_GRAPH],
  ];
  const cases = families.flatMap(([name, g]) => (['annular', 'can', 'canAnnular'] as const).map((s) => [name, s, g] as const));

  it.each(cases)('%s · %s kurulur; yerleşim stili ve kutu yarıçapı taşır', (_name, style, g) => {
    const b = buildStyled(g, style);
    const c = b.flowpath.gas.combustor;
    expect(b.traits.combustor).toBe(style);
    if (style === 'annular') {
      expect(c.cans).toBeUndefined();
      expect(c.style).toBeUndefined();
      expect(c.canR).toBeUndefined();
    } else {
      expect(c.style).toBe(style);
      expect(c.injectors).toBe(c.cans);
      expect(c.canR).toBeCloseTo((c.rOut - c.rIn) / 2, 12);
      // Kutular çevreye sığar
      expect(c.cans! * 2 * c.canR! * 1.08).toBeLessThanOrEqual(2 * Math.PI * ((c.rIn + c.rOut) / 2) + 1e-9);
    }
  });
});
