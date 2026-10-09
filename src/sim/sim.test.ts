import { describe, expect, it } from 'vitest';
import { ambient, isaStatic } from './atmosphere';
import { computeCycle, surgeFuelFlow } from './cycle';
import { DEFAULT_DESIGN, ENGINE_CATALOG, sizeEngine, type EngineKind } from './design';
import { EngineSim, LIMITS, type SimEventType } from './engineSim';

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
    '%s: art yakıcı itkiyi ≥%%40 artırır, lüle açılır, çekirdek etkilenmez',
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
