import { describe, expect, it } from 'vitest';
// Testte design/ kullanılır (sim/* design/'ı içe aktarmaz): grafikten
// üretilen tipler (turboşaft) katalogda catalog.ts ile kaydolur
import { TEMPLATES } from '../design/catalog';
import { computeGasPath } from '../design/flowpath';
import { buildEngine, toEngineDesign } from '../design/graph';
import { layoutNotReady } from '../design/layouts/index';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOPROP_GRAPH } from '../design/templates';
import type { CombustorModule, CompressorModule, EngineGraph, EngineModule, InletModule, NozzleModule } from '../design/types';
import { ambient, isaStatic } from './atmosphere';
import { computeCycle, surgeFuelFlow } from './cycle';
import { DEFAULT_DESIGN, ENGINE_CATALOG, MIXER_IMBALANCE_LOSS, registerCatalogDesign, sizeEngine, type EngineDesign, type EngineKind } from './design';
import { EngineSim, LIMITS, type SimEventType } from './engineSim';

/* ------------------------------------------------------------------ */
/* M5a tasarımları (grafikten)                                         */
/* ------------------------------------------------------------------ */

/**
 * Ağır (sim koşan) testlerin süre sınırı. Testteki sınır CLI/config
 * `testTimeout`'unu ezer: yük altında (CPU %100) bir koşu ~65 s sürebiliyor.
 */
const HEAVY = 120_000;

const rpmOf = (w: number) => (w * 60) / (2 * Math.PI);
const modOf = <T extends EngineModule>(g: EngineGraph, t: T['type']) => g.modules.find((m) => m.type === t) as T;

/**
 * Grafikten simülasyon tasarımı. Yerleşimi hazırsa buildEngine; değilse
 * (READY=false: kuru çıplak, karışık kaportalı, turboşaft yerleşimleri
 * P5–P7'de) çevrim + gaz yolundan mil devirleri (dinamik devirle ölçeklenir,
 * yer tutucu 10 000 rpm olmamalı). Turboşaftın gaz yolu yerleşimi (P7)
 * gelene dek devirler aynı çekirdekli turboproptan alınır.
 */
function designOf(g: EngineGraph): EngineDesign {
  if (!layoutNotReady(g)) return buildEngine(g).design;
  const d = toEngineDesign(g);
  let geo = g;
  if (g.modules.some((m) => m.type === 'shaft')) {
    geo = structuredClone(g);
    geo.modules[geo.modules.findIndex((m) => m.type === 'shaft')] = structuredClone(modOf(TURBOPROP_GRAPH, 'propeller'));
    modOf<InletModule>(geo, 'inlet').style = 'chin';
  }
  const gp = computeGasPath(geo, sizeEngine(toEngineDesign(geo)));
  return { ...d, n1Rpm: rpmOf(gp.omega.lp), n2Rpm: rpmOf(gp.omega.hp) };
}

/**
 * Kaportalı karışık akışlı turbofan (CFM56-5C sınıfı, §3.4): TF şablonu +
 * lobe'lu karıştırıcı + sabit yakınsak ortak lüle. P6 şablonu gelene dek.
 */
function mixedTurbofanGraph(): EngineGraph {
  const g = structuredClone(TURBOFAN_GRAPH);
  delete g.kind;
  g.massFlow = 465;
  Object.assign(modOf<CompressorModule>(g, 'fan'), { pr: 1.6, bypassRatio: 6.5 });
  modOf<CompressorModule>(g, 'lpc').pr = 1.9;
  modOf<CompressorModule>(g, 'hpc').pr = 12.5;
  modOf<CombustorModule>(g, 'combustor').tit = 1600;
  g.modules.splice(g.modules.findIndex((m) => m.type === 'nozzle'), 0, { type: 'mixer', loss: 0.01, style: 'lobed', lobes: 18 });
  const n = modOf<NozzleModule>(g, 'nozzle');
  Object.assign(n, { style: 'fixed', cv: 0.985 });
  delete n.chevrons;
  return g;
}

/**
 * Kuru düşük baypaslı karışık akışlı turbofan (Spey sınıfı, mimari 4): MTF − art
 * yakıcı. Fan PR 3,1 / BPR 0,68 sabit: P2 MTF şablonunu karıştırıcı dengesine
 * çekti (FPR 4,3, BPR 0,55); buradaki testler dengesizliği (P19t/P5 0,6…1,5)
 * BPR kaydırarak taradığından şablondan bağımsız bir tasarım ister.
 */
function dryLowBypassGraph(): EngineGraph {
  const g = structuredClone(MILITARY_TURBOFAN_GRAPH);
  delete g.kind;
  g.modules = g.modules.filter((m) => m.type !== 'afterburner');
  Object.assign(modOf<CompressorModule>(g, 'fan'), { pr: 3.1, bypassRatio: 0.68 });
  Object.assign(modOf<NozzleModule>(g, 'nozzle'), { style: 'fixed' });
  delete modOf<NozzleModule>(g, 'nozzle').flaps;
  return g;
}

/**
 * Turboşaft: P7 şablonu varsa o; yoksa TP çekirdeği + önden çıkışlı mil +
 * halka giriş (contracts.test.ts ile aynı yol), egzoz basınç oranı 1,05
 * (§3.5). Çalışabilirlik (marş, atalet) TP'nin.
 */
function turboshaftGraph(): EngineGraph {
  if (TEMPLATES.turboshaft) return TEMPLATES.turboshaft;
  const g = structuredClone(TURBOPROP_GRAPH);
  delete g.kind;
  g.name = 'TS (TP çekirdekli deneme turboşaftı)';
  g.modules = g.modules.filter((m) => m.type !== 'propeller');
  g.modules.unshift({ type: 'shaft', rpm: 20900, drive: 'front', reduction: false, transmissionEff: 0.985, gearboxLength: 0.35 });
  modOf<InletModule>(g, 'inlet').style = 'annular';
  modOf<NozzleModule>(g, 'nozzle').pressureRatio = 1.05;
  return g;
}

// Turboşaft katalogda yoksa (P7 şablonu gelene dek) deneme tasarımıyla
// kaydolur: tip testleri (KINDS) beş motoru da sınar
if (!('turboshaft' in ENGINE_CATALOG)) registerCatalogDesign('turboshaft', designOf(turboshaftGraph()));

function withEvents(sim: EngineSim) {
  const seen: SimEventType[] = [];
  sim.on((e) => seen.push(e.type));
  return seen;
}

function run(sim: EngineSim, seconds: number, each?: (t: number) => void) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    each?.(t);
    sim.step(1 / 60);
  }
}

describe('atmosfer', () => {
  it('ISA tropopoz değerleri', () => {
    const s = isaStatic(11000);
    expect(s.T).toBeCloseTo(216.65, 1);
    expect(s.P).toBeGreaterThan(22500);
    expect(s.P).toBeLessThan(22750);
  });

  it('ram etkisi toplam sıcaklığı ve basıncı artırır', () => {
    const a = ambient(10668, 0.8);
    expect(a.T2).toBeGreaterThan(a.T0);
    expect(a.P2).toBeGreaterThan(a.P0 * 1.4);
  });
});

describe('tasarım noktası', () => {
  const eng = sizeEngine(DEFAULT_DESIGN);

  it('bu sınıf bir turbofan için gerçekçi performans', () => {
    expect(eng.point.thrust / 1000).toBeGreaterThan(290);
    expect(eng.point.thrust / 1000).toBeLessThan(345);
    const tsfc = eng.point.tsfc * 1e6; // g/(kN·s)
    expect(tsfc).toBeGreaterThan(7.5);
    expect(tsfc).toBeLessThan(9.5);
    expect(eng.point.opr).toBeGreaterThan(40);
    expect(eng.point.opr).toBeLessThan(50);
  });

  it('tasarım dışı çözücü tasarım noktasında güç dengesini kurar', () => {
    const c = computeCycle({
      eng,
      amb: ambient(),
      N1: 1,
      N2: 1,
      wf: eng.point.wf,
      lit: true,
      surging: false,
    });
    const mech = DEFAULT_DESIGN.eff.mech;
    const hpImbalance = c.hptPower * mech - c.hpcPower - DEFAULT_DESIGN.accessoryPower;
    const lpImbalance = c.lptPower * mech - c.fanPower - c.boosterPower;
    expect(Math.abs(hpImbalance) / eng.ref.hpPower).toBeLessThan(1e-3);
    expect(Math.abs(lpImbalance) / eng.ref.lpPower).toBeLessThan(1e-3);
    expect(c.beta).toBeCloseTo(DEFAULT_DESIGN.hpcMap.betaDesign, 3);
    expect(c.netThrust).toBeCloseTo(eng.point.thrust, -2);
  });

  it('surge yakıtı tam surge hattına denk gelir', () => {
    const amb = ambient();
    const wfS = surgeFuelFlow(eng, amb, 0.6, 0.85);
    const below = computeCycle({ eng, amb, N1: 0.6, N2: 0.85, wf: wfS * 0.97, lit: true, surging: false });
    const above = computeCycle({ eng, amb, N1: 0.6, N2: 0.85, wf: wfS * 1.03, lit: true, surging: false });
    expect(below.surgeRequired).toBe(false);
    expect(above.surgeRequired).toBe(true);
  });
});

describe('çalıştırma sekansı', () => {
  it('normal prosedür: APU bleed → marş → %22 N2 yakıt → rölanti', () => {
    const sim = new EngineSim();
    const seen = withEvents(sim);
    Object.assign(sim.controls, { apuBleed: true, starter: true, ignition: true });
    let peakEgt = 0;
    run(sim, 90, () => {
      if (!sim.controls.fuelRun && sim.N2 >= 0.22) sim.controls.fuelRun = true;
      peakEgt = Math.max(peakEgt, sim.egtSensor);
    });
    expect(seen).toContain('lightoff');
    expect(seen).toContain('starterCutout');
    expect(seen).toContain('idle');
    expect(seen).not.toContain('hotStart');
    expect(peakEgt).toBeLessThan(LIMITS.egtStart);
    expect(sim.N1).toBeGreaterThan(0.18);
    expect(sim.N1).toBeLessThan(0.27);
    expect(sim.N2).toBeGreaterThan(0.6);
    expect(sim.N2).toBeLessThan(0.645);
    expect(sim.controls.starter).toBe(false);
  });

  it('APU bleed yoksa marş motoru dönmez', () => {
    const sim = new EngineSim();
    const seen = withEvents(sim);
    sim.controls.starter = true;
    run(sim, 10);
    expect(seen).toContain('noBleed');
    expect(sim.N2).toBe(0);
  });

  it('çok erken yakıt vermek sıcak çalıştırmaya yol açar', () => {
    const sim = new EngineSim();
    const seen = withEvents(sim);
    Object.assign(sim.controls, { apuBleed: true, starter: true, ignition: true });
    run(sim, 40, () => {
      if (!sim.controls.fuelRun && sim.N2 >= 0.08) sim.controls.fuelRun = true;
    });
    expect(seen).toContain('hotStart');
  });

  it('ateşleme olmadan yakıt: ıslak çalıştırma, sonra tutuşma (torching)', () => {
    const sim = new EngineSim();
    const seen = withEvents(sim);
    Object.assign(sim.controls, { apuBleed: true, starter: true, fuelRun: true });
    run(sim, 25);
    expect(seen).toContain('wetStart');
    expect(sim.lit).toBe(false);
    sim.controls.ignition = true;
    run(sim, 5);
    expect(seen).toContain('torching');
  });

  it('yakıt kesilince motor durur', () => {
    const sim = new EngineSim();
    sim.trim(0);
    const seen = withEvents(sim);
    sim.controls.fuelRun = false;
    run(sim, 30);
    expect(seen).toContain('shutdown');
    expect(seen).not.toContain('flameout');
    expect(sim.N2).toBeLessThan(0.25);
  });
});

describe('FADEC ve geçici rejim', () => {
  it('rölantiden kalkışa: %15→%95 itki ~5 s içinde, surge yok', () => {
    const sim = new EngineSim();
    sim.trim(1, 60);
    const fTo = sim.snapshot().thrust;
    sim.trim(0, 60);
    const fIdle = sim.snapshot().thrust;
    const seen = withEvents(sim);
    sim.controls.throttle = 1;
    let t15 = -1;
    let t95 = -1;
    let t = 0;
    run(sim, 15, () => {
      t += 1 / 60;
      const f = sim.snapshot().thrust;
      if (t15 < 0 && (f - fIdle) / (fTo - fIdle) > 0.15) t15 = t;
      if (t95 < 0 && f > 0.95 * fTo) t95 = t;
    });
    expect(seen).not.toContain('surge');
    expect(t95).toBeGreaterThan(0);
    expect(t95 - t15).toBeLessThan(5.5);
    expect(sim.N1).toBeLessThan(LIMITS.n1Redline);
  });

  it('manuel yakıtla ani artış kompresörü surge ettirir', () => {
    const sim = new EngineSim();
    sim.trim(0);
    const seen = withEvents(sim);
    sim.controls.fadec = 'manual';
    sim.controls.manualFuel = 1;
    run(sim, 3);
    expect(seen).toContain('surge');
  });

  it('uzun süreli aşırı sıcaklık türbine kalıcı hasar verir', () => {
    const sim = new EngineSim();
    sim.trim(0);
    const seen = withEvents(sim);
    sim.controls.fadec = 'manual';
    sim.controls.manualFuel = 1;
    run(sim, 8);
    expect(seen).toContain('turbineDamage');
    expect(sim.health.hptEta).toBeLessThan(1);
  });

  it('surge payı azalmış yıpranmış motor FADEC altında bile stall yapabilir', () => {
    const sim = new EngineSim();
    sim.health.hpcSurgeMargin = 0.3;
    sim.trim(0, 60);
    const seen = withEvents(sim);
    sim.controls.throttle = 1;
    run(sim, 8);
    expect(seen).toContain('surge');
  });

  it('sıcak günde FADEC EGT\'yi kırmızı çizginin altında tutar, itki düşer', () => {
    const sim = new EngineSim();
    sim.trim(1, 60);
    const fIsa = sim.snapshot().thrust;
    sim.setFlight({ isaDev: 30 }, true);
    sim.trim(1, 60);
    expect(sim.egtSensor).toBeLessThan(LIMITS.egtRedline);
    expect(sim.snapshot().thrust).toBeLessThan(fIsa * 0.92);
  });

  it('irtifada itki düşer, özgül yakıt tüketimi artar', () => {
    const sim = new EngineSim();
    sim.trim(1, 60);
    const sls = sim.snapshot();
    // Kademeli tırmanış: koşullar hedefe doğru ilerler, motor sönmemeli
    const seen = withEvents(sim);
    sim.setFlight({ altitude: 10668, mach: 0.8 });
    run(sim, 40);
    expect(sim.lit).toBe(true);
    expect(seen).not.toContain('flameout');
    sim.trim(1, 30);
    const cruise = sim.snapshot();
    expect(cruise.thrust / sls.thrust).toBeGreaterThan(0.12);
    expect(cruise.thrust / sls.thrust).toBeLessThan(0.3);
    expect(cruise.tsfc).toBeGreaterThan(sls.tsfc * 1.5);
  });
});

describe('motor tipleri', () => {
  const KINDS = Object.keys(ENGINE_CATALOG) as EngineKind[];

  /** Normal prosedürle çalıştırır; tepe EGT'yi ve olayları döndürür. */
  function start(kind: EngineKind) {
    const sim = new EngineSim(ENGINE_CATALOG[kind]);
    const seen = withEvents(sim);
    Object.assign(sim.controls, { apuBleed: true, starter: true, ignition: true });
    let peakEgt = -99;
    run(sim, 70, () => {
      if (!sim.controls.fuelRun && sim.N2 >= sim.limits.fuelOnMinN2 + 0.02) sim.controls.fuelRun = true;
      peakEgt = Math.max(peakEgt, sim.egtSensor);
    });
    sim.controls.ignition = false;
    return { sim, seen, peakEgt };
  }

  it.each(KINDS)('%s: tasarım noktası tutarlı ve kendi sınıfında gerçekçi', (kind) => {
    const e = sizeEngine(ENGINE_CATALOG[kind]);
    const expected: Record<EngineKind, [number, number]> = {
      turbofan: [280e3, 360e3],
      militaryTurbofan: [70e3, 95e3],
      turbojet: [35e3, 55e3],
      turboprop: [0.5e3, 5e3], // artık jet itkisi; asıl itki pervaneden
      turboshaft: [0, 2e3], // artık jet itkisi; güç çıkış milinden (M5a P7)
    };
    const [lo, hi] = expected[kind];
    expect(e.point.thrust).toBeGreaterThan(lo);
    expect(e.point.thrust).toBeLessThan(hi);
    // Tasarım dışı çözücü tasarım noktasını yeniden üretir
    const cyc = computeCycle({ eng: e, amb: ambient(0, 0, 0), N1: 1, N2: 1, wf: e.ref.Wf, lit: true, surging: false });
    expect(Math.abs(cyc.stations['4'].T - e.design.tit)).toBeLessThan(25);
    expect(cyc.surgeMargin).toBeGreaterThan(0.1);
  });

  it.each(KINDS)('%s: normal prosedürle rölantiye oturur, sıcak çalıştırma yok', (kind) => {
    const { sim, seen, peakEgt } = start(kind);
    expect(seen).toContain('lightoff');
    expect(seen).toContain('idle');
    expect(seen).not.toContain('hotStart');
    expect(peakEgt).toBeLessThan(sim.limits.egtStart);
    expect(sim.N2).toBeGreaterThan(sim.limits.idleN2 - 0.02);
    expect(sim.lit).toBe(true);
  });

  it.each(KINDS)('%s: tam güce 7 s içinde çıkar, surge ve EGT aşımı yok', (kind) => {
    const { sim, seen } = start(kind);
    sim.controls.throttle = 1;
    run(sim, 7);
    const s = sim.snapshot();
    expect(s.N2).toBeGreaterThan(0.95);
    expect(s.egt).toBeLessThan(sim.limits.egtRedline);
    expect(sim.surgeCount).toBe(0);
    expect(seen).not.toContain('egtRedline');
  });

  it.each(['militaryTurbofan', 'turbojet'] as EngineKind[])(
    '%s: art yakıcı itkiyi en az yüzde 40 artırır, lüle açılır, çekirdek etkilenmez',
    (kind) => {
      const { sim, seen } = start(kind);
      sim.controls.throttle = 1;
      run(sim, 12);
      const dry = sim.snapshot();
      sim.controls.reheat = 1;
      run(sim, 5);
      const wet = sim.snapshot();
      expect(seen).toContain('abLight');
      expect(wet.thrust / dry.thrust).toBeGreaterThan(1.4);
      expect(wet.nozzleArea).toBeGreaterThan(1.4);
      expect(Math.abs(wet.N1 - dry.N1)).toBeLessThan(0.01);
      expect(Math.abs(wet.egt - dry.egt)).toBeLessThan(10);
      // Art yakıcı gaz kolu MIL'den çekilince söner
      sim.controls.throttle = 0.8;
      run(sim, 1);
      expect(sim.abLit).toBe(false);
    },
  );

  it('turboprop: vali pervane devrini %100\'de tutar, itki gücün 2/3 kuvvetiyle ölçeklenir', () => {
    const { sim } = start('turboprop');
    sim.controls.throttle = 1;
    run(sim, 10);
    const hi = sim.snapshot();
    expect(Math.abs(hi.N1 - 1)).toBeLessThan(0.01);
    expect(hi.shaftPower).toBeGreaterThan(2.4e6);
    expect(hi.propThrust).toBeGreaterThan(35e3);
    expect(hi.propThrust).toBeLessThan(65e3);
    sim.controls.throttle = 0.5;
    run(sim, 10);
    const mid = sim.snapshot();
    expect(Math.abs(mid.N1 - 1)).toBeLessThan(0.02);
    expect(mid.shaftPower).toBeLessThan(hi.shaftPower * 0.85);
    // Momentum teorisi: T ∝ P^(2/3)
    const ratio = mid.propThrust / hi.propThrust;
    expect(Math.abs(ratio - (mid.shaftPower / hi.shaftPower) ** (2 / 3))).toBeLessThan(0.02);
  });

  it.each([30, 30 + 1 / 60])('turboproptan turbofana geçişte trim edilen motor sönmez (önceki trim %s s)', (secs) => {
    // reset() önbellekleri (pompalama yakıt sınırı vb.) sıfırlamalı: yoksa
    // turbopropun küçük sınırı turbofanın ilk adımında yakıtı keser
    const sim = new EngineSim(ENGINE_CATALOG.turboprop);
    sim.trim(0, secs);
    sim.setDesign(ENGINE_CATALOG.turbofan);
    sim.trim(0, 30);
    expect(sim.lit).toBe(true);
    expect(sim.N2).toBeGreaterThan(0.55);
  });

  it.each(Object.keys(ENGINE_CATALOG) as EngineKind[])(
    '%s: tamamen duran motora geçişte anlık görüntüde NaN olmaz',
    (kind) => {
      const sim = new EngineSim();
      sim.setDesign(ENGINE_CATALOG[kind]);
      run(sim, 0.5);
      const bad: string[] = [];
      const scan = (o: unknown, path: string) => {
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path + k);
          else if (v && typeof v === 'object') scan(v, `${path}${k}.`);
        }
      };
      scan(sim.snapshot(), '');
      expect(bad).toEqual([]);
    },
  );
});

describe('art yakıcısız karışık akış (M5a)', () => {
  const amb = ambient();
  const withEta = (d: EngineDesign, mixingEff: number, loss = d.mixer!.loss): EngineDesign => ({ ...d, mixer: { loss, mixingEff } });
  /** Karıştırıcıya giren baypas/çekirdek toplam basınç oranı P19t/P5 */
  const mixerPR = (d: EngineDesign) => {
    const s = sizeEngine(d).point.stations;
    return (s['13'].P * (1 - d.bypassDuctDP)) / s['5'].P;
  };
  /**
   * Baypas oranını P19t/P5 = target olacak şekilde ikiye bölme ile ayarlar:
   * BPR arttıkça LPT daha çok iş çeker, P5 düşer. Çekirdekte basınç kalmayan
   * (DesignError) nokta "P5 çok düşük" sayılır.
   */
  function balanced(d: EngineDesign, target = 1): EngineDesign {
    const ratio = (bpr: number) => {
      try {
        return mixerPR({ ...d, bypassRatio: bpr });
      } catch {
        return Infinity;
      }
    };
    let lo = 0.02;
    let hi = 15;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (ratio(m) < target) lo = m;
      else hi = m;
    }
    const bpr = (lo + hi) / 2;
    // Hedefe ulaşılamazsa ikiye bölme aralığın ucuna dayanır: sessizce yanlış
    // tasarımla sürmek yerine dur
    if (!(Math.abs(ratio(bpr) / target - 1) < 1e-3)) throw new Error(`balanced: P19t/P5 = ${target}, BPR [0,02; 15] içinde bulunamadı`);
    return { ...d, bypassRatio: bpr };
  }
  /** Karışma kazancı: aynı tasarımın ayrık akışlı lülelerine göre itki oranı − 1 */
  const gain = (d: EngineDesign, mixingEff: number, loss: number) =>
    sizeEngine(withEta(d, mixingEff, loss)).point.thrust / sizeEngine({ ...d, mixer: undefined }).point.thrust - 1;
  const designs: [string, EngineDesign][] = [
    ['kaportalı BPR 6,5', designOf(mixedTurbofanGraph())],
    ['çıplak BPR 0,68', designOf(dryLowBypassGraph())],
  ];

  it('grafikten: art yakıcısız karıştırıcı design.mixer olur, afterburner yok', () => {
    for (const [, d] of designs) {
      expect(d.afterburner).toBeUndefined();
      expect(d.mixer).toBeDefined();
      const e = sizeEngine(d);
      // Ortak sabit lüle tasarımda sabitlenir; 9 istasyonu ondan
      expect(e.ref.A9mix).toBeGreaterThan(0);
      expect(e.point.stations['9'].W).toBeCloseTo(e.point.stations['2'].W + e.point.wf, 6);
    }
    // Art yakıcılı motorda karışma afterburner'da kalır
    expect(buildEngine(MILITARY_TURBOFAN_GRAPH).design.mixer).toBeUndefined();
  });

  it.each(designs)('%s: itki ayrık jetler (η=0) ile tam karışım (η=1) arasında; aynı kayıpta lobe\'lu > düz', (_n, d0) => {
    for (const d of [d0, balanced(d0)]) {
      const F = (eta: number) => sizeEngine(withEta(d, eta)).point.thrust;
      const [sep, full, conf, lobed] = [F(0), F(1), F(0.85), F(0.97)];
      const lo = Math.min(sep, full);
      const hi = Math.max(sep, full);
      for (const f of [conf, lobed]) {
        expect(f).toBeGreaterThan(lo);
        expect(f).toBeLessThan(hi);
      }
    }
    // Basınçlar dengeliyken karışma kazanır: aynı kayıpta (şablon §3.4:
    // ikisi de 0,01) lobe'lu düzden iyi
    const b = balanced(d0);
    expect(sizeEngine(withEta(b, 0.97)).point.thrust).toBeGreaterThan(sizeEngine(withEta(b, 0.85)).point.thrust);
  });

  // Sihirbaz varsayılanları (§6.3: düz 0,01, lobe'lu 0,015) düşük baypasta
  // lobe'luyu öne koyar. Yüksek baypasta (BPR ~7) tam karışma kazancı ~%2,4
  // olduğundan η farkı (0,12) ancak ~0,0026 ek kaybı karşılar: orada lobe'lu
  // ancak kaybı ≤ ~0,012 iken düzden iyidir (entegratör notu, defaults.ts).
  it('düşük baypasta (BPR 0,68) sihirbaz kayıplarıyla da lobe\'lu > düz', () => {
    const b = balanced(designs[1][1]);
    expect(gain(b, 0.97, 0.015)).toBeGreaterThan(gain(b, 0.85, 0.01));
    const hb = balanced(designs[0][1]);
    expect(gain(hb, 0.97, 0.012)).toBeGreaterThan(gain(hb, 0.85, 0.01));
  });

  it.each(designs)('%s: karışma kazancı P19t ≈ P5\'te dengesiz karıştırıcıdakinden büyük', (_n, d0) => {
    expect(MIXER_IMBALANCE_LOSS).toBeGreaterThan(0);
    const eta = d0.mixer!.mixingEff;
    const loss = d0.mixer!.loss;
    const atBalance = gain(balanced(d0, 1), eta, loss);
    // Aynı tasarım ailesinde yalnız BPR ile P19t/P5 kaydırılır
    for (const r of [0.6, 1.5]) {
      const d = balanced(d0, r);
      expect(Math.abs(mixerPR(d) / r - 1)).toBeLessThan(1e-3);
      expect(gain(d, eta, loss)).toBeLessThan(atBalance);
    }
    // Dengede ek kayıp yok: kazanç pozitif
    expect(atBalance).toBeGreaterThan(0);
  });

  it.each(designs)('%s: P19t ≈ P5\'te karışma kazancı > 0 (ayrık akışlı lülelere göre)', (_n, d0) => {
    const b = balanced(d0);
    expect(Math.abs(mixerPR(b) - 1)).toBeLessThan(1e-6);
    // Kayıpsız karıştırıcı: η=0 ayrık akışlı motorun iki lülesini aynen verir
    const separate = sizeEngine({ ...b, mixer: undefined }).point.thrust;
    const noMix = sizeEngine(withEta(b, 0, 0)).point.thrust;
    expect(Math.abs(noMix / separate - 1)).toBeLessThan(1e-9);
    const mixed = sizeEngine(withEta(b, 1, 0)).point.thrust;
    expect(mixed).toBeGreaterThan(separate);
    // Kazanç yüksek baypasta daha büyük (yüzde birkaç), düşükte küçük
    expect(mixed / separate - 1).toBeLessThan(0.06);
  });

  it.each(designs)('%s: computeCycle(1, 1, Wf) tasarım itkisini yüzde 1, T4\'ü 25 K içinde verir', (_n, d) => {
    const e = sizeEngine(d);
    const c = computeCycle({ eng: e, amb, N1: 1, N2: 1, wf: e.ref.Wf, lit: true, surging: false });
    expect(Math.abs(c.netThrust / e.point.thrust - 1)).toBeLessThan(0.01);
    expect(Math.abs(c.stations['4'].T - d.tit)).toBeLessThan(25);
    expect(c.bypassThrust).toBe(0);
    expect(c.nozzleArea).toBe(1);
    expect(c.surgeMargin).toBeGreaterThan(0.1);
  });

  it.each(designs)('%s: rölanti ve 0,6 gaz trim\'i yakınsar, itki gazda monoton', (_n, d) => {
    const sim = new EngineSim(d);
    const settled = (throttle: number) => {
      sim.trim(throttle, 30);
      const a = { N1: sim.N1, N2: sim.N2 };
      run(sim, 5);
      expect(sim.lit).toBe(true);
      expect(Math.abs(sim.N1 - a.N1)).toBeLessThan(0.003);
      expect(Math.abs(sim.N2 - a.N2)).toBeLessThan(0.003);
      return sim.snapshot();
    };
    const idle = settled(0);
    expect(idle.N2).toBeGreaterThan(sim.limits.idleN2 - 0.02);
    expect(idle.thrust).toBeGreaterThan(0);
    const mid = settled(0.6);
    expect(mid.thrust).toBeGreaterThan(idle.thrust);
    expect(sim.surgeCount).toBe(0);
    // Gaz kolu boyunca itki kesin artan; tam güçte tasarım itkisi. Her
    // nokta soğuk motordan: trim önceki durumdan devam eder ve büyük
    // ataletli LP mili tam güçten 30 s'de rölantiye oturmaz (geçmişe bağlı)
    const thrusts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
      const s = new EngineSim(d);
      s.trim(t, 30);
      return s.snapshot().thrust;
    });
    for (let i = 1; i < thrusts.length; i++) expect(thrusts[i]).toBeGreaterThan(thrusts[i - 1]);
    expect(Math.abs(thrusts[5] / sizeEngine(d).point.thrust - 1)).toBeLessThan(0.02);
  }, HEAVY);
});

describe('turboşaft (M5a)', () => {
  const d = ENGINE_CATALOG.turboshaft;

  it('katalogda: çıkış mili var, pervane yok; tip testleri beş motoru sınar', () => {
    expect(d.shaft).toBeDefined();
    expect(d.prop).toBeUndefined();
    expect(Object.keys(ENGINE_CATALOG)).toContain('turboshaft');
    expect(sizeEngine(d).ref.shaftPower).toBeGreaterThan(0);
  });

  it('otomatik çalıştırma → tam güç: itki < 2 kN, mil gücü > %80, NP %100 ±%2', () => {
    const sim = new EngineSim(d);
    const seen = withEvents(sim);
    let lightoff = -1;
    sim.on((e) => {
      if (e.type === 'lightoff') lightoff = e.time;
    });
    // App.beginAutoStart / updateAutoStart ile aynı sıra
    Object.assign(sim.controls, { apuBleed: true, starter: true, ignition: true });
    let peakEgt = -99;
    run(sim, 60, () => {
      if (!sim.controls.fuelRun && sim.N2 >= sim.limits.fuelOnMinN2 + 0.02) sim.controls.fuelRun = true;
      peakEgt = Math.max(peakEgt, sim.egtSensor);
    });
    // Şartname (§7.1 P1) light-off 20–40 s ister; bunu turboşaft şablonunun
    // (P7) marş değerleri sağlar. Şablon gelene dek deneme turboşaftı TP'nin
    // marşını kullanır (light-off ~12 s): alt sınır yalnız şablonla zorlanır.
    expect(lightoff).toBeGreaterThan(TEMPLATES.turboshaft ? 20 : 5);
    expect(lightoff).toBeLessThan(40);
    expect(seen).toContain('idle');
    expect(seen).not.toContain('hotStart');
    expect(peakEgt).toBeLessThan(sim.limits.egtStart);
    sim.controls.ignition = false;
    sim.controls.throttle = 1;
    run(sim, 10);
    const s = sim.snapshot();
    const ref = sim.eng.ref;
    expect(Math.abs(s.thrust)).toBeLessThan(2e3);
    expect(s.propThrust).toBe(0);
    expect(s.shaftPower / ref.shaftPower).toBeGreaterThan(0.8);
    expect(Math.abs(s.N1 - 1)).toBeLessThan(0.02);
    expect(s.propRpm).toBeCloseTo(s.N1 * d.shaft!.rpm, 6);
    expect(s.thrustFrac).toBeCloseTo(s.shaftPower / ref.outputPower, 9);
    expect(sim.surgeCount).toBe(0);
    // Gaz kolu gaz jeneratörünü (gücü) belirler; vali NP'yi %100'de tutar
    sim.controls.throttle = 0.4;
    run(sim, 10);
    const part = sim.snapshot();
    expect(Math.abs(part.N1 - 1)).toBeLessThan(0.02);
    expect(part.N2).toBeLessThan(s.N2 - 0.02);
    expect(part.shaftPower).toBeLessThan(0.8 * s.shaftPower);
  }, HEAVY);

  it('trim: rölantide güç türbini dönüyor, tam güçte NP %100', () => {
    const sim = new EngineSim(d);
    sim.trim(0, 30);
    expect(sim.lit).toBe(true);
    expect(sim.N2).toBeGreaterThan(sim.limits.idleN2 - 0.02);
    sim.trim(1, 30);
    expect(Math.abs(sim.N1 - 1)).toBeLessThan(0.02);
    expect(sim.snapshot().shaftPower / sim.eng.ref.shaftPower).toBeGreaterThan(0.8);
  });
});
