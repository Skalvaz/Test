import { describe, expect, it } from 'vitest';
import { ambient, isaStatic } from './atmosphere';
import { computeCycle, surgeFuelFlow } from './cycle';
import { DEFAULT_DESIGN, sizeEngine } from './design';
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
