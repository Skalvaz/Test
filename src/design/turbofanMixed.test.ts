/**
 * Kaportalı karışık akışlı turbofan (M5a P6, docs/M5A-SPEC.md §3.4, §4.3,
 * §7.1 P6 kabulü): ortak lüle alanı, uzun kanal geometrisi, ayrık akışlı
 * eşine göre kütle ve TSFC, CFM56-5C4 bandı, uyarısızlık, çalıştırma ve
 * karıştırıcı varsayılanları.
 */

import { describe, expect, it } from 'vitest';
import { EngineSim, type SimEventType } from '../sim/engineSim';
import type { Architecture } from './architecture';
import { TEMPLATES } from './catalog';
import { DEFAULT_MODULES, graphFromArchitecture, referenceFor } from './defaults';
import { evaluate } from './evaluate';
import { FlowpathError, profileAt, type TurbofanLayout } from './flowpath';
import { buildEngine, type BuiltEngine } from './graph';
import { LOCKED, nozzleAnchor, nozzleCoupling, nozzleRange, rebuilderFor } from './inverse';
import { MIXING_DUCT_LD, PLUG_PROTRUSION } from './layouts/turbofan';
import { TURBOFAN_GRAPH } from './templates';
import { TURBOFAN_MIXED_GRAPH } from './turbofanMixed';
import type { EngineGraph, MixerModule, NozzleModule } from './types';
import { evaluateOperability } from './warnings';

const TFM = TURBOFAN_MIXED_GRAPH;
const built = buildEngine(TFM);
const L = built.flowpath.layout as TurbofanLayout;
const M = L.mixed!;
const lerpZ = (a: number, b: number, u: number) => a + (b - a) * u;

/** Aynı gaz yolu, ayrık akışlı egzoz (karıştırıcı yok, ayrık lüle, aynı cv) */
function separateTwin(g: EngineGraph): EngineGraph {
  const s = structuredClone(g);
  s.modules = s.modules.filter((m) => m.type !== 'mixer');
  const i = s.modules.findIndex((m) => m.type === 'nozzle');
  s.modules[i] = { type: 'nozzle', style: 'separate', cv: (s.modules[i] as NozzleModule).cv };
  return s;
}

/** Karıştırıcı stili ve kaybı değişmiş kopya */
function withMixer(g: EngineGraph, m: MixerModule): EngineGraph {
  const c = structuredClone(g);
  c.modules = c.modules.map((x) => (x.type === 'mixer' ? structuredClone(m) : x));
  return c;
}

describe('şablon ve katalog', () => {
  it('TEMPLATES.turbofanMixed kayıtlı; kaportalı, karışık akışlı, lobe’lu, sabit lüleli', () => {
    expect(TEMPLATES.turbofanMixed).toBe(TFM);
    expect(built.traits).toMatchObject({ layout: 'nacelle', exhaust: 'mixed', afterburner: false, nozzle: 'fixed', presentation: 'turbofan' });
    expect(M.mixer).toMatchObject({ style: 'lobed', lobes: 18 });
    // Art yakıcısız karışma: sim'de design.mixer (afterburner değil)
    expect(built.design.mixer).toEqual({ loss: DEFAULT_MODULES.mixer.lobed.loss, mixingEff: 0.97 });
    expect(built.design.afterburner).toBeUndefined();
  });
});

describe('lüle alanı ve uzun kanal geometrisi', () => {
  it('ortak lüle ağzının halka alanı A9mix ile ±%3; kanal boyu 1,6 × ağız yarıçapı', () => {
    const A9mix = built.sized.ref.A9mix!;
    expect(A9mix).toBeGreaterThan(0);
    const area = Math.PI * (M.nozzle.rExit ** 2 - M.plugExitR ** 2);
    expect(Math.abs(area / A9mix - 1)).toBeLessThan(0.03);
    expect(M.nozzle.z1 - M.nozzle.z0).toBeCloseTo(MIXING_DUCT_LD * M.nozzle.rExit, 9);
    // Egzoz ağzı (efektler, tutamaç) ortak lüle ağzıdır
    expect(L.exhaustExit).toEqual({ z: M.nozzle.z1, radius: M.nozzle.rExit });
    // Koni ağızdan çıkar (CFM56-5C): ağızda koni yarıçapı > 0
    expect(M.plugExitR).toBeGreaterThan(0);
    expect(L.plug[L.plug.length - 1][1]).toBeGreaterThan(M.nozzle.z1);
  });

  it('koni ucu ortak lüle ağzından 0,7 ağız yarıçapı çıkar (koni ve ağız birlikte yakınsar)', () => {
    const tip = L.plug[L.plug.length - 1][1];
    expect((tip - M.nozzle.z1) / M.nozzle.rExit).toBeCloseTo(PLUG_PROTRUSION, 2);
    expect(Math.PI * (M.nozzle.rExit ** 2 - M.plugExitR ** 2) / built.sized.ref.A9mix!).toBeCloseTo(1, 3);
  });

  it('düğme aralığının uçlarında (BPR 1/7, hava akışı 50/600) ya fan kanalı açık ya da öğretici FlowpathError', () => {
    const fanOf = (g: EngineGraph) => g.modules.find((m) => m.type === 'fan') as { bypassRatio: number; pr: number };
    const cases: [string, (g: EngineGraph) => void][] = [
      ['BPR 1', (g) => (fanOf(g).bypassRatio = 1)],
      ['BPR 2', (g) => (fanOf(g).bypassRatio = 2)],
      ['BPR 7', (g) => (fanOf(g).bypassRatio = 7)],
      ['W 50', (g) => (g.massFlow = 50)],
      ['W 100', (g) => (g.massFlow = 100)],
      ['W 600', (g) => (g.massFlow = 600)],
      ['fan.pr 1,4 + BPR 3', (g) => Object.assign(fanOf(g), { pr: 1.4, bypassRatio: 3 })],
    ];
    const closed: string[] = [];
    for (const [label, f] of cases) {
      const g = structuredClone(TFM);
      f(g);
      let b: BuiltEngine;
      try {
        b = buildEngine(g);
      } catch (e) {
        // Düşük fan PR'sinde karışma basıncı da düşük: ortak lüle ağzı kanaldan geniş (engine/turbofanMixedFit.test.ts)
        if ((e as FlowpathError).code === 'mixer.nozzle' && label.startsWith('fan.pr')) continue;
        expect((e as FlowpathError).code, label).toBe('bypassDuct.closed');
        expect((e as FlowpathError).knobs).toEqual(['fan.bypassRatio', 'engine.massFlow']);
        closed.push(label);
        continue;
      }
      const l = b.flowpath.layout as TurbofanLayout;
      // Kurulduysa OGV ve destek kanatları pozitif açıklıklı, kanal duvarı çekirdeğin dışında
      expect(l.ogv.tip - l.ogv.hub, label).toBeGreaterThan(0.03);
      expect(l.struts.tip - l.struts.hub, label).toBeGreaterThan(0.03);
      const m = l.mixed!;
      for (let i = 0; i <= 50; i++) {
        const z = lerpZ(m.duct[0][1], m.mixer.z0, i / 50);
        expect(profileAt(m.duct, z) - profileAt(l.coreCowl, z), `${label} z ${z.toFixed(2)}`).toBeGreaterThan(0.02);
      }
    }
    // Ölçüm (P6 denetimi): çekirdek mutlak paylı, kanal fan oranında → BPR ≤ 2
    // kapanır. Entegrasyon (dalga 2): küçük hava akışında kaporta payları
    // daraltıldığı için W 50/100 artık kurulur (düğme aralığı BPR 2,5–7)
    expect(closed).toEqual(expect.arrayContaining(['BPR 1', 'BPR 2']));
    for (const ok of ['BPR 7', 'W 50', 'W 100', 'W 600']) expect(closed).not.toContain(ok);
  });

  it('karışma basıncı yetersizken (A9mix NaN) TypeError yerine öğretici FlowpathError', () => {
    const g = structuredClone(TFM);
    g.modules = g.modules.map((m) => (m.type === 'fan' ? { ...m, pr: 1.3 } : m));
    expect(() => buildEngine(g)).toThrow(expect.objectContaining({ name: 'FlowpathError', code: 'mixer.area' }));
  });

  it('kaporta iç duvarı her z’de çekirdek kaportasının, karıştırıcının ve koninin dışında; dış yüzey iç duvarın dışında', () => {
    const z0 = M.duct[0][1];
    const z1 = M.nozzle.z1;
    const mx = M.mixer;
    let n = 0;
    for (let i = 0; i <= 400; i++) {
      const z = z0 + ((z1 - z0) * i) / 400;
      const wall = profileAt(M.duct, z);
      // İç sınır: çekirdek kaportası (karıştırıcıya dek), lobe tepeleri, koni
      const inner = z < mx.z0 ? profileAt(L.coreCowl, z) : z <= mx.z1 ? mx.r + mx.amp : profileAt(L.plug, z);
      expect(wall - inner, `z ${z.toFixed(3)}`).toBeGreaterThan(0.02);
      expect(profileAt(M.outer, z) - wall, `dış z ${z.toFixed(3)}`).toBeGreaterThan(0.01);
      n++;
    }
    expect(n).toBe(401);
    // Kaporta fan kaportasının bittiği yerden (referans z 0,55) başlar: çekirdek kaportası onun içinde başlar
    expect(z0).toBeLessThan(L.coreCowl[L.coreCowl.length - 1][1]);
  });

  it('karıştırıcı LPT çıkışında, çekirdek kaportasının arka kenarında; lobe çukurları koniye değmez', () => {
    const mx = M.mixer;
    expect(mx.z0).toBeGreaterThan(L.lpt.z1);
    expect(mx.z0).toBeCloseTo(L.coreCowl[L.coreCowl.length - 1][1], 9);
    expect(mx.amp).toBeGreaterThan(0.05);
    expect(mx.r - mx.amp).toBeGreaterThan(profileAt(L.plug, mx.z1) + 0.02);
    expect(mx.r + mx.amp).toBeLessThan(M.ductEnd.r - 0.05);
    // Ortak lüle yakınsak: karıştırma düzleminden ağza daralır
    expect(M.nozzle.rExit).toBeLessThan(M.ductEnd.r);
    for (let i = 1; i < M.duct.length; i++) if (M.duct[i - 1][1] >= mx.z1 - 1e-9) expect(M.duct[i][0]).toBeLessThanOrEqual(M.duct[i - 1][0] + 1e-9);
  });

  it('dış zarf z’de artan; boy ortak lülenin ya da koninin ucuna kadar', () => {
    const env = L.outerProfile;
    for (let i = 1; i < env.length; i++) expect(env[i][0]).toBeGreaterThan(env[i - 1][0]);
    expect(built.flowpath.metrics.length).toBeCloseTo(Math.max(L.plug[L.plug.length - 1][1], M.nozzle.z1) - L.intake.z, 9);
    expect(L.mounts.length).toBeGreaterThanOrEqual(2);
  });

  it('ayrık akışlı yerleşim değişmez: mixed alanı yok', () => {
    expect((buildEngine(TURBOFAN_GRAPH).flowpath.layout as TurbofanLayout).mixed).toBeUndefined();
  });
});

describe('ayrık akışlı eşine göre (aynı hava akışı ve gaz yolu)', () => {
  const sep = buildEngine(separateTwin(TFM));
  it('daha ağır (karıştırıcı + ortak lüle + uzun koni), TSFC %1–3 iyi', () => {
    expect(sep.traits.exhaust).toBe('separate');
    expect(sep.sized.point.stations['2'].W).toBe(built.sized.point.stations['2'].W);
    const dm = built.flowpath.metrics.mass.total - sep.flowpath.metrics.mass.total;
    expect(dm).toBeGreaterThan(50);
    const gain = 1 - built.sized.point.tsfc / sep.sized.point.tsfc;
    expect(gain).toBeGreaterThan(0.01);
    expect(gain).toBeLessThan(0.03);
    // Aynı yakıtla daha çok itki: karışma kazancı
    expect(built.sized.point.wf).toBeCloseTo(sep.sized.point.wf, 9);
    expect(built.sized.point.thrust).toBeGreaterThan(sep.sized.point.thrust);
  });
});

describe('§4.3 bandı (CFM56-5C4, ISA SLS kalkış)', () => {
  const ev = evaluate(TFM);
  if ('error' in ev) throw new Error(ev.error.title);
  const s = ev.summary;
  it.each([
    ['itki [kN]', s.thrust / 1e3, 130, 170],
    ['BPR', s.bpr, 6, 7],
    ['OPR', s.opr, 28, 38],
    ['TSFC [g/(kN·s)]', s.tsfc!, 8.5, 11],
    ['fan çapı [m]', s.diameter, 1.75, 1.95],
    ['kütle [kg]', s.mass, 2300, 3600],
    ['P19t/P5t', s.mixerPR!, 0.98, 1.06],
  ])('%s', (_n, v, lo, hi) => {
    expect(v).toBeGreaterThanOrEqual(lo);
    expect(v).toBeLessThanOrEqual(hi);
  });

  it('gerçek motorun kademe sayıları: 1+4 · 9 · 1+5', () => {
    expect(s.stagesLabel).toBe('1+4 · 9 · 1+5');
  });

  it('uyarı yok (tasarım noktası, rölanti ve tam güç trim’i)', () => {
    expect(ev.findings.filter((f) => f.severity !== 'info').map((f) => f.id)).toEqual([]);
    expect(evaluateOperability(built).filter((f) => f.severity !== 'info').map((f) => f.id)).toEqual([]);
  });

  it('fan ucu bağıl Mach’ı caution eşiğinden (1,50) en az %4 uzak', () => {
    expect(s.rows.front!.mrelTip!).toBeLessThan(1.5 / 1.04);
  });
});

describe('lüle ağzı tutamacı (§6.7: karışık → BPR)', () => {
  /**
   * Toplam hava akışı sabitken ortak lüle alanı BPR'ye göre tasarım
   * noktasında en küçüktür: akışlar eşit basınçta buluşunca (P19t ≈ P5)
   * karışma kaybı en az, karışmış akışın basıncı en yüksek, alan en küçük.
   * BPR 1 → 6,5 iken ağız 0,93 → 0,72 m daralır, 7'de yeniden açılır. Eşleme
   * tekdüze olmadığından tutamaç §6.7 kuralıyla kilitli görünür (neden metni
   * T4'e / basınç oranlarına yönlendirir). Askeri TF'de (BPR 0,55) eşleme
   * tekdüze, tutamaç açık (inverse.test.ts).
   */
  it('ortak lüle ağzına bağlı; BPR eşlemesi tasarım noktasında en küçükten geçer → kilitli', () => {
    const g = structuredClone(TFM);
    delete g.ops;
    const b = buildEngine(g, { reference: built });
    expect(nozzleCoupling(b.traits)).toBe('fan.bypassRatio');
    expect(nozzleAnchor(b)).toEqual({ z: M.nozzle.z1, r: M.nozzle.rExit });
    const r = (bpr: number) => {
      const c = structuredClone(g);
      c.modules = c.modules.map((m) => (m.type === 'fan' ? { ...m, bypassRatio: bpr } : m));
      return nozzleAnchor(rebuilderFor(b)(c)).r;
    };
    expect(r(4)).toBeGreaterThan(r(6.5));
    expect(r(7)).toBeGreaterThan(r(6.5));
    expect(nozzleRange(g, b).blocked).toBe(LOCKED);
  });
});

describe('çalıştırma', () => {
  it('otomatik çalıştırmada 60 s içinde rölanti (sıcak/asılı çalıştırma yok), 10 s içinde tam güç; tam güçte tasarım itkisi', () => {
    const r = autoStart(built);
    expect(r.seen).toContain('lightoff');
    expect(r.seen).not.toContain('hotStart');
    expect(r.seen).not.toContain('hungStart');
    expect(r.tIdle).toBeGreaterThan(0);
    expect(r.tIdle).toBeLessThan(60);
    expect(r.tFull).toBeGreaterThanOrEqual(0);
    expect(r.sim.surgeCount).toBe(0);
    expect(r.sim.turbineDamaged).toBe(false);
    for (let i = 0; i < 30 * 20; i++) r.sim.step(1 / 30);
    expect(Math.abs(r.sim.snapshot().thrust / built.sized.point.thrust - 1)).toBeLessThan(0.03);
  }, 60_000);
});

describe('karıştırıcı varsayılanları (§6.3, defaults.ts): lobe’lu düzden iyi', () => {
  it('şablonda: sihirbaz kayıplarıyla lobe’lu > düz; eski 0,015 ile değil (yüksek baypasta başa baş ~0,0126)', () => {
    const F = (m: MixerModule) => buildEngine(withMixer(TFM, m)).sized.point.thrust;
    const lobed = F(DEFAULT_MODULES.mixer.lobed);
    const conf = F(DEFAULT_MODULES.mixer.confluent);
    expect(lobed).toBeGreaterThan(conf);
    expect(F({ ...DEFAULT_MODULES.mixer.lobed, loss: 0.015 })).toBeLessThan(conf);
  });

  const arch = (o: Partial<Architecture>): Architecture => ({
    output: 'thrust',
    lpLoad: 'fan',
    booster: true,
    centrifugal: false,
    combustor: 'annular',
    exhaust: 'mixed',
    mixer: 'lobed',
    afterburner: false,
    abNozzle: 'convergent',
    installation: 'nacelle',
    ...o,
  });
  it.each([
    ['kaportalı (BPR 6,5)', arch({})],
    ['çıplak kuru (Spey sınıfı)', arch({ booster: false, installation: 'bare' })],
  ])('sihirbazın grafiği, %s: lobe’lu itki > düz itki', (_n, a) => {
    const F = (mixer: 'lobed' | 'confluent') => {
      const g = graphFromArchitecture({ ...a, mixer }, { massFlow: a.installation === 'nacelle' ? 465 : 112, name: '' });
      return buildEngine(g, { reference: referenceFor({ ...a, mixer }) }).sized.point.thrust;
    };
    expect(F('lobed')).toBeGreaterThan(F('confluent'));
  });
});

/** Otomatik çalıştırma (App.beginAutoStart ile aynı sıra; architecture.test.ts) */
function autoStart(b: BuiltEngine) {
  const sim = new EngineSim(b.design);
  const seen: SimEventType[] = [];
  sim.on((e) => seen.push(e.type));
  Object.assign(sim.controls, { apuBleed: true, ignition: true, starter: true, fuelRun: false, fadec: 'normal', throttle: 0 });
  const dt = 1 / 30;
  let tIdle = -1;
  for (let t = 0; t < 60 && tIdle < 0; t += dt) {
    const c = sim.controls;
    if (!c.fuelRun && sim.N2 >= sim.limits.fuelOnMinN2 + 0.02) c.fuelRun = true;
    sim.step(dt);
    if (sim.phase === 'running' && sim.N2 > sim.limits.idleN2 - 0.02) {
      tIdle = t;
      c.apuBleed = false;
      c.ignition = false;
    }
  }
  sim.controls.throttle = 1;
  let tFull = -1;
  for (let t = 0; t < 10 && tFull < 0; t += dt) {
    sim.step(dt);
    if (sim.N2 > 0.95) tFull = t;
  }
  return { sim, seen, tIdle, tFull };
}
