/**
 * M5a P4a: mimari, dönüşüm tablosu ve mimariden grafik (docs/M5A-SPEC.md
 * §2.4). Geçerli mimari kümesi (§2.4 tablosu × yanma odası × karıştırıcı)
 * kurulur ve otomatik çalıştırılır; yerleşimi henüz olmayan mimariler
 * (layouts READY=false: kuru dal P5, karışık kaportalı dal P6, turboşaft
 * P7) atlanır ve o paketler bayrağı açınca kendiliğinden koşar.
 */

import { describe, expect, it } from 'vitest';
import { DesignError, sizeEngine } from '../sim/design';
import { EngineSim, type SimEventType } from '../sim/engineSim';
import {
  applyArchitecture,
  applyArchitectureReport,
  ARCH_OPTIONS,
  archKey,
  architectureOf,
  checkArchitecture,
  normalizeArchitecture,
  resolveChange,
  type Architecture,
} from './architecture';
import { TEMPLATES } from './catalog';
import {
  CAN_FIT_VREF_MAX,
  DEFAULT_MODULES,
  donorFor,
  familyOf,
  fanRangeFor,
  fitCans,
  graphFromArchitecture,
  graphSkeleton,
  massFlowRangeFor,
  nextFitVelocity,
  referenceFor,
  setMassFlow,
  solveMassFlow,
  templateGraph,
} from './defaults';
import { evaluate } from './evaluate';
import { computeGasPath, FlowpathError } from './flowpath';
import { buildEngine, checkGraph, GRAPH_RULES, GraphError, toEngineDesign, type BuiltEngine } from './graph';
import { ENGINE_KNOBS, knobCtx, knobRange } from './knobs';
import { layoutNotReady } from './layouts/index';
import type { TemplateId } from './templates';
import { deriveTraits } from './traits';
import type { CombustorModule, CombustorStyle, CompressorModule, EngineGraph, MixerModule, NozzleModule } from './types';
import { WARNING_RULES } from './warnings';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const TJ: Architecture = {
  output: 'thrust',
  lpLoad: 'lpc',
  booster: false,
  centrifugal: false,
  combustor: 'annular',
  exhaust: 'single',
  mixer: 'confluent',
  afterburner: true,
  abNozzle: 'convergent',
  installation: 'bare',
};
const MTF: Architecture = { ...TJ, lpLoad: 'fan', exhaust: 'mixed', abNozzle: 'cd' };
const TF: Architecture = { ...TJ, lpLoad: 'fan', booster: true, exhaust: 'separate', afterburner: false, installation: 'nacelle' };
const TP: Architecture = { ...TJ, lpLoad: 'propeller', centrifugal: true, afterburner: false };
const TS: Architecture = { ...TP, lpLoad: 'shaft', output: 'shaft' };

const COMBUSTORS: CombustorStyle[] = ['annular', 'can', 'canAnnular'];
const MIXERS = ['confluent', 'lobed'] as const;

const AB_NOZZLES = ['convergent', 'cd'] as const;

/**
 * §2.4 geçerli mimari kümesi: her satır × yanma odası (3) × karıştırıcı
 * stili (karışıkta 2). Art yakıcılı satırlarda (1, 3) iki değişken lüle
 * de, satır 3–4'te booster'lı ve booster'sız.
 */
function validSet(): [string, Architecture][] {
  const out: Architecture[] = [];
  for (const combustor of COMBUSTORS) {
    // 1: J79 (bugünkü TJ) · 2: J57 kuru
    for (const abNozzle of AB_NOZZLES) out.push({ ...TJ, combustor, abNozzle });
    out.push({ ...TJ, combustor, afterburner: false });
    // 3: F100 (bugünkü MTF; TJ'den fana geçişte yakınsak lüle korunur) · 4: Spey (kuru düşük baypas)
    for (const booster of [false, true]) {
      for (const mixer of MIXERS) {
        for (const abNozzle of AB_NOZZLES) out.push({ ...MTF, combustor, booster, mixer, abNozzle });
        out.push({ ...MTF, combustor, booster, mixer, afterburner: false });
      }
    }
    // 5: CFM56-7 (bugünkü TF) · 6: CFM56-5C
    out.push({ ...TF, combustor });
    for (const mixer of MIXERS) out.push({ ...TF, combustor, exhaust: 'mixed', mixer });
    // 7: PW150 (bugünkü TP) · 8: T700
    out.push({ ...TP, combustor });
    out.push({ ...TS, combustor });
  }
  return out.map((a) => [archKey(a), a]);
}

const VALID = validSet();

/** Simülasyonlu ve döngülü testlerin süre sınırı (makine yükünde 5 s yetmeyebilir) */
const SLOW = 60_000;

/** Yerleşimi hazır değil mi (P5/P6/P7 bayrağı açınca false olur) */
const notReady = (a: Architecture) => checkArchitecture(a) instanceof FlowpathError;

/** Hazır olanlar koşar; olmayanlar vitest özetinde "atlandı" görünür */
const VALID_READY = VALID.filter(([, a]) => !notReady(a));
const VALID_NOT_READY = VALID.filter(([, a]) => notReady(a));

/** Bütün eksen değerleri (kartlar, tam uzay taraması) */
const AXIS_VALUES: { [K in keyof Architecture]: readonly Architecture[K][] } = {
  output: ['thrust', 'shaft'],
  lpLoad: ['lpc', 'fan', 'propeller', 'shaft'],
  booster: [true, false],
  centrifugal: [true, false],
  combustor: COMBUSTORS,
  exhaust: ['single', 'separate', 'mixed'],
  mixer: MIXERS,
  afterburner: [true, false],
  abNozzle: AB_NOZZLES,
  installation: ['bare', 'nacelle'],
};

/** Eksenlerin bütün birleşimleri, normalleştirilmiş ve tekil (anahtar → mimari) */
function fullSpace(): Map<string, Architecture> {
  let all: Partial<Architecture>[] = [{}];
  for (const [axis, values] of Object.entries(AXIS_VALUES)) all = all.flatMap((p) => values.map((v) => ({ ...p, [axis]: v })));
  const out = new Map<string, Architecture>();
  for (const a of all) {
    const n = normalizeArchitecture(a as Architecture);
    out.set(archKey(n), n);
  }
  return out;
}

/** Mimariden grafik + referanslı üretim (atölyenin yaptığı) */
function buildArch(a: Architecture, massFlow?: number): { g: EngineGraph; b: BuiltEngine } {
  const g = graphFromArchitecture(a, { massFlow: massFlow ?? templateGraph(familyOf(a)).massFlow, name: 'Deneme' });
  return { g, b: buildEngine(g, { reference: referenceFor(a) }) };
}

/** Grafik referanssız kurulamıyorsa (ops yok) ailenin referansıyla */
const buildAny = (g: EngineGraph) => buildEngine(g, g.ops?.inertia ? {} : { reference: referenceFor(architectureOf(g)) });

const mod = <T extends { type: string }>(g: EngineGraph, type: T['type']) => g.modules.find((m) => m.type === type) as T | undefined;
const coreFlow = (g: EngineGraph) => g.massFlow / (1 + (mod<CompressorModule>(g, 'fan')?.bypassRatio ?? 0));

/**
 * Sihirbazın ölçütü (üretilen grafik uyarısız) kart yolunda da: atölyenin
 * referansıyla değerlendirme hatasız, caution/warning yok, EGT payı > 0.
 */
function expectWorkable(g: EngineGraph, label: string): void {
  const ev = evaluate(g, { reference: referenceFor(architectureOf(g)) });
  expect('error' in ev ? ev.error.title : null, label).toBeNull();
  if ('error' in ev) return;
  expect(ev.findings.filter((f) => f.severity !== 'info').map((f) => `${f.id}: ${f.title}`), label).toEqual([]);
  expect(ev.summary.egtMargin, `${label}: EGT payı`).toBeGreaterThan(0);
}

/** Bütün sayısal düğmeler grafiğin aralığında (knobs.ts tek kaynak; panel aralık dışı değer göstermez) */
function expectInKnobRanges(g: EngineGraph, label = ''): void {
  const ctx = knobCtx(g);
  for (const k of ENGINE_KNOBS) {
    const v = k.get(g);
    const r = k.range(ctx);
    if (typeof v !== 'number' || !r || (k.type !== 'number' && k.type !== 'int')) continue;
    expect(v, `${label} ${k.id} ∉ [${r[0]}, ${r[1]}]`).toBeGreaterThanOrEqual(r[0] - 1e-9);
    expect(v, `${label} ${k.id} ∉ [${r[0]}, ${r[1]}]`).toBeLessThanOrEqual(r[1] + 1e-9);
  }
}

/**
 * Otomatik çalıştırma (App.beginAutoStart / updateAutoStart ile aynı):
 * APU bleed + ateşleme + marş, %fuelOnMinN2+2'de yakıt, rölantide bleed ve
 * ateşleme kapanır. Sonra tam gaz. 1/30 s adım (App.advance).
 */
function autoStart(b: BuiltEngine, idleWindow = 60, fullWindow = 10) {
  const sim = new EngineSim(b.design);
  const seen: SimEventType[] = [];
  sim.on((e) => seen.push(e.type));
  Object.assign(sim.controls, { apuBleed: true, ignition: true, starter: true, fuelRun: false, fadec: 'normal', throttle: 0 });
  const dt = 1 / 30;
  let tIdle = -1;
  let peakEgt = -99;
  for (let t = 0; t < idleWindow && tIdle < 0; t += dt) {
    const c = sim.controls;
    if (!c.fuelRun && sim.N2 >= sim.limits.fuelOnMinN2 + 0.02) c.fuelRun = true;
    sim.step(dt);
    peakEgt = Math.max(peakEgt, sim.egtSensor);
    if (sim.phase === 'running' && sim.N2 > sim.limits.idleN2 - 0.02) {
      tIdle = t;
      c.apuBleed = false;
      c.ignition = false;
    }
  }
  const idle = { N2: sim.N2, lit: sim.lit };
  sim.controls.throttle = 1;
  let tFull = -1;
  for (let t = 0; t < fullWindow && tFull < 0; t += dt) {
    sim.step(dt);
    if (sim.N2 > 0.95) tFull = t;
  }
  return { sim, seen, tIdle, tFull, peakEgt, idle };
}

/* ------------------------------------------------------------------ */
/* Grafik → mimari                                                     */
/* ------------------------------------------------------------------ */

describe('architectureOf ve archKey', () => {
  const cases: [TemplateId, Architecture, string][] = [
    ['turbojet', TJ, 'lpc|cf0|ann|sgl|ab:convergent|bare'],
    ['militaryTurbofan', MTF, 'fan|cf0|ann|mix:confluent|ab:cd|bare'],
    ['turbofan', TF, 'fan+b|cf0|ann|sep|dry|nac'],
    ['turboprop', TP, 'propeller|cf1|ann|sgl|dry|bare'],
  ];
  it.each(cases)('%s şablonunun mimarisi', (id, a, key) => {
    expect(architectureOf(TEMPLATES[id]!)).toEqual(normalizeArchitecture(a));
    expect(archKey(architectureOf(TEMPLATES[id]!))).toBe(key);
  });

  it('anahtar şartnamedeki biçimde', () => {
    expect(archKey({ ...TF, exhaust: 'mixed', mixer: 'lobed' })).toBe('fan+b|cf0|ann|mix:lobed|dry|nac');
    expect(archKey({ ...TS, combustor: 'canAnnular' })).toBe('shaft|cf1|cna|sgl|dry|bare');
  });

  it('anlamsız eksenler normalleşir: anahtar onları görmez', () => {
    // Karışık olmayan egzozda karıştırıcı stili, art yakıcısızda lüle, pervanede kurulum
    expect(archKey({ ...TF, mixer: 'lobed' })).toBe(archKey(TF));
    expect(archKey({ ...TF, abNozzle: 'cd' })).toBe(archKey(TF));
    expect(archKey({ ...TP, installation: 'nacelle', booster: true, exhaust: 'mixed' })).toBe(archKey(TP));
    expect(normalizeArchitecture({ ...TJ, output: 'shaft' }).output).toBe('thrust');
    expect(normalizeArchitecture({ ...TP, lpLoad: 'shaft' }).output).toBe('shaft');
  });

  it('tüm geçerli küme ayrı anahtarlar verir', () => {
    expect(new Set(VALID.map(([k]) => k)).size).toBe(VALID.length);
    expect(VALID.length).toBeGreaterThanOrEqual(40);
  });
});

/* ------------------------------------------------------------------ */
/* Mimariden grafik                                                    */
/* ------------------------------------------------------------------ */

describe('graphFromArchitecture', () => {
  it.each(['turbojet', 'militaryTurbofan', 'turbofan', 'turboprop'] as TemplateId[])(
    '%s: şablonun kendi mimarisinde şablonun aynısı (ad, özet, tip ve ops dışında)',
    (id) => {
      const t = TEMPLATES[id]!;
      const a = architectureOf(t);
      const g = graphFromArchitecture(a, { massFlow: t.massFlow, name: t.name });
      expect(g.kind).toBeUndefined();
      expect(g.ops).toBeUndefined();
      expect(g.modules).toEqual(t.modules);
      expect(g.bypassDuct).toEqual(t.bypassDuct);
      // Referans = şablon: çalışabilirlik ve aksesuar gücü (çekirdek oranı 1) aynı → aynı motor
      const b = buildEngine(g, { reference: referenceFor(a) });
      const ref = buildEngine(t);
      expect(b.sized.point.thrust).toBeCloseTo(ref.sized.point.thrust, 6);
      expect(b.flowpath.metrics.mass.total).toBeCloseTo(ref.flowpath.metrics.mass.total, 6);
      expect(b.design.inertia).toEqual(ref.design.inertia);
      expect(b.design.limits).toEqual(ref.design.limits);
    },
  );

  it.each(VALID)('%s: iskelet kurallardan geçer, mimarisi korunur', (_k, a) => {
    const g = graphFromArchitecture(a, { massFlow: templateGraph(familyOf(a)).massFlow, name: 'x' });
    expect(checkGraph(g)).toBeNull();
    expect(architectureOf(g)).toEqual(normalizeArchitecture(a));
    expect(deriveTraits(g).combustor).toBe(a.combustor);
    // Kutu sayısı çevreye sığacak kadar (6–16)
    const c = mod<CombustorModule>(g, 'combustor')!;
    if (c.style !== 'annular') expect(c.cans).toBeGreaterThanOrEqual(6);
  });

  it('yanma odası stil varsayılanları (§2.4)', () => {
    const can = mod<CombustorModule>(graphSkeleton({ ...TF, combustor: 'can' }, { massFlow: 1150, name: '' }), 'combustor')!;
    const cna = mod<CombustorModule>(graphSkeleton({ ...TF, combustor: 'canAnnular' }, { massFlow: 1150, name: '' }), 'combustor')!;
    expect([can.cans, can.dp]).toEqual([10, 0.06]);
    expect([cna.cans, cna.dp]).toEqual([8, 0.05]);
    expect(can.refVelocity).toBeGreaterThanOrEqual(25);
    const back = mod<CombustorModule>(applyArchitecture(graphSkeleton({ ...TJ, combustor: 'can' }, { massFlow: 66, name: '' }), TJ), 'combustor')!;
    expect(back.cans).toBeUndefined();
    expect(back.dp).toBe(DEFAULT_MODULES.combustor.annular.dp);
    expect(back.refVelocity).toBeGreaterThanOrEqual(20);
    expect(back.refVelocity).toBeLessThanOrEqual(43);
  });

  it('küçük yarıçaplı motorda kutu sayısı sığana dek azalır', () => {
    // TJ'de 10 kutu (19 cm) 0,28 m ortalama yarıçapın çevresine sığmaz
    expect(() => buildEngine(graphSkeleton({ ...TJ, combustor: 'can' }, { massFlow: 66, name: '' }), { reference: referenceFor(TJ) })).toThrow(/sığmıyor/);
    const { g, b } = buildArch({ ...TJ, combustor: 'can' });
    expect(mod<CombustorModule>(g, 'combustor')!.cans).toBeLessThan(10);
    expect(b.flowpath.gas.combustor.cans).toBe(mod<CombustorModule>(g, 'combustor')!.cans);
  });

  it('modül bağışçıları', () => {
    expect(donorFor('afterburner', MTF)).toBe('MTF');
    expect(donorFor('afterburner', TJ)).toBe('TJ');
    expect(donorFor('lpc', TF)).toBe('TF');
    expect(donorFor('lpc', { ...TF, exhaust: 'mixed' })).toBe('TFM');
    expect(donorFor('lpc', TJ)).toBe('TJ');
    expect(donorFor('lpc', { ...TJ, afterburner: false })).toBe('TJD');
    expect(donorFor('mixer', { ...TF, exhaust: 'mixed' })).toBe('TFM');
    expect(donorFor('hpc', TS)).toBe('TS');
    expect(donorFor('propeller', TP)).toBe('TP');
    expect(familyOf({ ...MTF, afterburner: false })).toBe('militaryTurbofan');
  });

  it('çıplak fanlı motora booster: düşük basınç oranı, HPC aynı (HP işi ve EGT payı korunur)', () => {
    const g0 = graphFromArchitecture(MTF, { massFlow: 112, name: '' });
    const g1 = graphFromArchitecture({ ...MTF, booster: true }, { massFlow: 112, name: '' });
    expect(mod<CompressorModule>(g1, 'lpc')!.pr).toBe(DEFAULT_MODULES.bareBoosterPR);
    expect(mod<CompressorModule>(g1, 'lpc')!.tipSpeed).toBeUndefined();
    expect(mod<CompressorModule>(g1, 'hpc')!.pr).toBe(mod<CompressorModule>(g0, 'hpc')!.pr);
    const b0 = buildEngine(g0, { reference: referenceFor(MTF) });
    const b1 = buildEngine(g1, { reference: referenceFor(MTF) });
    // Booster LP işini artırır, HP işi aynı: T45 (EGT) yükselmez
    expect(b1.sized.point.stations['45'].T).toBeLessThanOrEqual(b0.sized.point.stations['45'].T + 1);
    expect(b1.sized.point.opr).toBeCloseTo(b0.sized.point.opr * DEFAULT_MODULES.bareBoosterPR, 6);
  });

  it('pervane akışla büyür, uç hızı sabit kalır', () => {
    const g = graphFromArchitecture(TP, { massFlow: 9.5 * 1.5, name: '' });
    const p0 = mod<{ type: 'propeller'; diameter: number; rpm: number }>(TEMPLATES.turboprop!, 'propeller')!;
    const p = mod<{ type: 'propeller'; diameter: number; rpm: number }>(g, 'propeller')!;
    expect(p.diameter).toBeCloseTo(Math.min(5, p0.diameter * Math.sqrt(1.5)), 9);
    expect(p.diameter * p.rpm).toBeCloseTo(p0.diameter * p0.rpm, 6);
  });
});

/* ------------------------------------------------------------------ */
/* Geçerli küme: kurulur ve çalışır                                    */
/* ------------------------------------------------------------------ */

describe('geçerli mimari kümesi (§2.4): kurulur, otomatik çalıştırılır', () => {
  it('kümeyi checkArchitecture belirler: kabul edilen (ya da yalnız yerleşimi bekleyen) her mimari kümede, tersi de', () => {
    const accepted = [...fullSpace()]
      .filter(([, a]) => {
        const e = checkArchitecture(a);
        return e === null || (e instanceof FlowpathError && e.code === 'layout.notReady');
      })
      .map(([k]) => k);
    expect(new Set(accepted)).toEqual(new Set(VALID.map(([k]) => k)));
  });

  it('yerleşimi hazır olmayanlar (P5/P6/P7) tipli hata verir, grafikleri kurallardan geçer', () => {
    for (const [, a] of VALID_NOT_READY) {
      // Kart "yakında": FlowpathError layout.notReady
      expect((checkArchitecture(a) as FlowpathError).code).toBe('layout.notReady');
      expect(checkGraph(graphFromArchitecture(a, { massFlow: templateGraph(familyOf(a)).massFlow, name: '' }))).toBeNull();
    }
  });

  // Yerleşimi hazır olmayanlar vitest özetinde "atlandı" görünür; bayrak açılınca koşar
  if (VALID_NOT_READY.length) it.skip.each(VALID_NOT_READY)('%s (yerleşim hazır değil)', () => {});

  it.each(VALID_READY)('%s', (key, a) => {
    expect(checkArchitecture(a)).toBeNull();
    const { g, b } = buildArch(a);
    expect(b.traits.layout).toBe(deriveTraits(g).layout);
    expect(archKey(architectureOf(b.graph))).toBe(key);
    for (const v of [b.sized.point.thrust, b.flowpath.metrics.mass.total, b.flowpath.metrics.length, b.design.n1Rpm, b.design.n2Rpm]) expect(Number.isFinite(v)).toBe(true);
    expect(b.flowpath.metrics.mass.total).toBeGreaterThan(0);

    const r = autoStart(b);
    expect(r.seen).toContain('lightoff');
    expect(r.seen).toContain('idle');
    expect(r.seen).not.toContain('hotStart');
    expect(r.seen).not.toContain('hungStart');
    expect(r.peakEgt).toBeLessThan(r.sim.limits.egtStart);
    expect(r.tIdle).toBeGreaterThan(0);
    expect(r.tIdle).toBeLessThan(60);
    expect(r.idle.lit).toBe(true);
    // Tam güç 10 s içinde; surge ve EGT aşımı yok
    expect(r.tFull).toBeGreaterThanOrEqual(0);
    expect(r.sim.surgeCount).toBe(0);
    expect(r.seen).not.toContain('surge');
    expect(r.seen).not.toContain('egtRedline');
    expect(r.sim.turbineDamaged).toBe(false);
  }, SLOW);

  it.skipIf(!WARNING_RULES.length).each(VALID_READY)('%s: üretilen grafik uyarısız (caution/warning 0)', (_k, a) => {
    const g = graphFromArchitecture(a, { massFlow: templateGraph(familyOf(a)).massFlow, name: 'x' });
    const ev = evaluate(g, { reference: referenceFor(a) });
    expect('error' in ev ? ev.error : null).toBeNull();
    if ('error' in ev) return;
    const bad = ev.findings.filter((f) => f.severity !== 'info').map((f) => `${f.id}: ${f.title}`);
    expect(bad).toEqual([]);
  }, SLOW);
});

/* ------------------------------------------------------------------ */
/* Geçersiz birleşimler                                                */
/* ------------------------------------------------------------------ */

const msgOf = (id: string) => GRAPH_RULES.find((r) => r.id === id)!.msg;

describe('geçersiz birleşimler beklenen GraphError metnini verir', () => {
  const cases: [string, Architecture, string][] = [
    ['baypassız motorda karıştırıcı', { ...TJ, exhaust: 'mixed' }, 'mixer.bypass'],
    ['baypassız motorda ayrık lüle', { ...TJ, afterburner: false, exhaust: 'separate' }, 'nozzle.separateUse'],
    ['fanlı motorda tek jet', { ...MTF, afterburner: false, exhaust: 'single' }, 'nozzle.separateNeeded'],
    ['çıplak motorda ayrık lüle', { ...TF, installation: 'bare' }, 'nozzle.separateNacelle'],
    ['ayrık akışta art yakıcı', { ...MTF, exhaust: 'separate' }, 'afterburner.mixer'],
    ['kaportalı art yakıcılı motor', { ...MTF, booster: true, installation: 'nacelle' }, 'inlet.nacelle'],
    ['kaportalı turbojet', { ...TJ, afterburner: false, installation: 'nacelle' }, 'inlet.nacelle'],
    ['booster\'sız kaportalı turbofan', { ...TF, booster: false }, 'inlet.nacelleBooster'],
    ['santrifüjsüz turboprop', { ...TP, centrifugal: false }, 'hpc.centrifugalNeeded'],
    ['santrifüjsüz turboşaft', { ...TS, centrifugal: false }, 'hpc.centrifugalNeeded'],
    ['santrifüjlü turbofan', { ...TF, centrifugal: true }, 'hpc.centrifugalOnly'],
    ['santrifüjlü turbojet', { ...TJ, centrifugal: true }, 'hpc.centrifugalOnly'],
  ];
  it.each(cases)('%s', (_name, a, ruleId) => {
    const g = graphFromArchitecture(a, { massFlow: templateGraph(familyOf(a)).massFlow, name: '' });
    let err: unknown;
    try {
      buildEngine(g, { reference: referenceFor(a) });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GraphError);
    expect((err as GraphError).ruleId).toBe(ruleId);
    expect((err as GraphError).message).toBe(msgOf(ruleId));
    const c = checkArchitecture(a);
    expect(c).toBeInstanceOf(GraphError);
    expect(c!.message).toBe(msgOf(ruleId));
  });

  it('serbest türbinli motorda art yakıcı: yerel kural', () => {
    for (const a of [TP, TS]) {
      const e = checkArchitecture({ ...a, afterburner: true });
      expect(e).toBeInstanceOf(GraphError);
      expect((e as GraphError).ruleId).toBe('arch.freeTurbineAb');
    }
  });
});

/* ------------------------------------------------------------------ */
/* resolveChange ve kartlar                                            */
/* ------------------------------------------------------------------ */

type Ok = { arch: Architecture; implied: { axis: keyof Architecture; from: unknown; to: unknown; reason: string }[] };
const ok = (r: ReturnType<typeof resolveChange>): Ok => {
  if ('blocked' in r) throw new Error(`beklenmeyen kilit: ${r.blocked}`);
  return r;
};
const impliedAxes = (r: Ok) => Object.fromEntries(r.implied.map((i) => [i.axis, i.to]));

describe('resolveChange: zorunlu eşlik edenler ve kilit', () => {
  it('turbojet → fan: çıplak karışık akış (askeri TF), art yakıcı kalır', () => {
    const r = ok(resolveChange(TJ, 'lpLoad', 'fan'));
    // Değişken lüle seçimi (yakınsak) kullanıcınındır: korunur
    expect(r.arch).toEqual(normalizeArchitecture({ ...MTF, abNozzle: 'convergent' }));
    expect(impliedAxes(r)).toEqual({ exhaust: 'mixed' });
    expect(r.implied.find((i) => i.axis === 'exhaust')).toMatchObject({ from: 'single', to: 'mixed' });
    expect(r.implied.every((i) => i.reason.length > 0)).toBe(true);
  });

  it('turbofan → pervane: santrifüj, tek egzoz, booster yok', () => {
    const r = ok(resolveChange(TF, 'lpLoad', 'propeller'));
    expect(r.arch).toEqual(normalizeArchitecture(TP));
    expect(impliedAxes(r)).toMatchObject({ centrifugal: true, exhaust: 'single', booster: false, installation: 'bare' });
  });

  it('çıkış mili: hem çıkış hem LP yükü', () => {
    // Hazır olmayan yerleşimde (turboşaft P7, kuru turbojet P5) kilit metni yerleşiminki ("yakında")
    const expectArch = (r: ReturnType<typeof resolveChange>, want: Architecture) => {
      if ('blocked' in r) expect(r.blocked).toBe(checkArchitecture(want)!.message);
      else expect(r.arch).toEqual(normalizeArchitecture(want));
    };
    expectArch(resolveChange(TP, 'output', 'shaft'), TS);
    expectArch(resolveChange(TP, 'lpLoad', 'shaft'), TS);
    expectArch(resolveChange(TS, 'output', 'thrust'), { ...TJ, afterburner: false });
    expectArch(resolveChange({ ...TS, afterburner: true }, 'output', 'thrust'), TJ);
  });

  it('askeri TF → ayrık akış: kaporta, booster, art yakıcı kapanır (CFM56-7)', () => {
    const r = ok(resolveChange(MTF, 'exhaust', 'separate'));
    expect(r.arch).toEqual(normalizeArchitecture(TF));
    expect(impliedAxes(r)).toMatchObject({ installation: 'nacelle', booster: true, afterburner: false });
  });

  it('turbofan → art yakıcı: çıplak, karışık, YI lüle', () => {
    const r = ok(resolveChange(TF, 'afterburner', true));
    expect(r.arch).toEqual(normalizeArchitecture({ ...MTF, booster: true }));
    expect(impliedAxes(r)).toMatchObject({ installation: 'bare', exhaust: 'mixed', abNozzle: 'cd' });
  });

  it('kullanıcının seçtiği eksen geri çevrilmez: art yakıcısız motorda yakınsak lüle → art yakıcı açılır', () => {
    const r = ok(resolveChange({ ...MTF, afterburner: false, exhaust: 'mixed' }, 'abNozzle', 'convergent'));
    expect(r.arch.afterburner).toBe(true);
    expect(r.arch.abNozzle).toBe('convergent');
  });

  it('karıştırıcı stili karışık akışı getirir', () => {
    const r = resolveChange(TF, 'mixer', 'lobed');
    if ('blocked' in r) expect(r.blocked).toBe(checkArchitecture({ ...TF, exhaust: 'mixed', mixer: 'lobed' })!.message);
    else expect(r.arch).toMatchObject({ exhaust: 'mixed', mixer: 'lobed' });
  });

  const blockedCases: [string, Architecture, keyof Architecture, unknown, string][] = [
    ['turbojette karıştırıcı', TJ, 'exhaust', 'mixed', msgOf('mixer.bypass')],
    ['turbojette kaporta', TJ, 'installation', 'nacelle', msgOf('inlet.nacelle')],
    ['turbopropta kaporta', TP, 'installation', 'nacelle', msgOf('inlet.nacelle')],
    ['kaportalı TF\'de booster\'ı kaldırmak', TF, 'booster', false, msgOf('inlet.nacelleBooster')],
    ['turbofanda santrifüj', TF, 'centrifugal', true, msgOf('hpc.centrifugalOnly')],
    ['turbopropta eksenel HPC', TP, 'centrifugal', false, msgOf('hpc.centrifugalNeeded')],
    ['turboprop art yakıcı', TP, 'afterburner', true, checkArchitecture({ ...TP, afterburner: true })!.message],
    ['turbojette booster', TJ, 'booster', true, 'Booster fanın arkasındaki alçak basınç kompresörüdür: önce LP yükü olarak fanı seç.'],
    ['dişli fan', TF, 'lpLoad', 'gearedFan', "Dişli fan M5b'de."],
    ['açık rotor', TF, 'lpLoad', 'openRotor', "Açık rotor M5c'de."],
  ];
  it.each(blockedCases)('kilitli: %s', (_n, a, axis, value, msg) => {
    expect(resolveChange(a, axis, value)).toEqual({ blocked: msg });
  });

  it('bilinmeyen seçenek kilitli', () => {
    expect('blocked' in resolveChange(TJ, 'combustor', 'pulse')).toBe(true);
  });
});

describe('ARCH_OPTIONS (mimari kartları)', () => {
  const LESSONS = ['anatomy', 'brayton', 'fadec', 'surge', 'start', 'altitude', 'birdstrike'];

  it('seçenekler tekil, kartlar dolu, ders bağlantıları var olan dersler', () => {
    const keys = ARCH_OPTIONS.map((o) => `${o.axis}:${String(o.value)}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const o of ARCH_OPTIONS) {
      for (const f of ['title', 'does', 'gains', 'costs', 'examples'] as const) expect(o.card[f].length).toBeGreaterThan(2);
      if (o.card.lesson) expect(LESSONS).toContain(o.card.lesson);
    }
    // Her eksenin her değeri için bir kart (sihirbaz ve Mimari sekmesi)
    const axisValues: Record<keyof Architecture, readonly (string | boolean)[]> = {
      output: ['thrust', 'shaft'],
      lpLoad: ['lpc', 'fan', 'propeller', 'shaft'],
      booster: [true, false],
      centrifugal: [true, false],
      combustor: COMBUSTORS,
      exhaust: ['single', 'separate', 'mixed'],
      mixer: MIXERS,
      afterburner: [true, false],
      abNozzle: ['convergent', 'cd'],
      installation: ['bare', 'nacelle'],
    };
    for (const [axis, values] of Object.entries(axisValues)) for (const v of values) expect(keys).toContain(`${axis}:${String(v)}`);
  });

  it.each([TJ, MTF, TF, TP, TS].map((a) => [archKey(a), a] as [string, Architecture]))(
    '%s: açık kart seçilince seçim tutar, implies ve blocked resolveChange ile tutarlı',
    (_k, a) => {
      for (const o of ARCH_OPTIONS) {
        const why = o.blocked(a);
        const r = resolveChange(a, o.axis, o.value);
        if (why) {
          expect(r).toEqual({ blocked: why });
          expect(o.implies(a)).toEqual({});
          continue;
        }
        const arch = ok(r).arch;
        expect(arch[o.axis]).toBe(o.value);
        expect(checkArchitecture(arch)).toBeNull();
        expect({ ...normalizeArchitecture(a), [o.axis]: o.value, ...o.implies(a) }).toEqual(arch);
      }
    },
    SLOW,
  );
});

/* ------------------------------------------------------------------ */
/* applyArchitecture                                                   */
/* ------------------------------------------------------------------ */

/** Tohumlu sözde rastgele (mulberry32) */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('applyArchitecture', () => {
  it.each(['turbojet', 'militaryTurbofan', 'turbofan', 'turboprop'] as TemplateId[])('%s: aynı mimari → modüller aynı', (id) => {
    const t = TEMPLATES[id]!;
    const g = applyArchitecture(t, architectureOf(t));
    expect(g.modules).toEqual(t.modules);
    expect(g.ops).toEqual(t.ops);
    expect(g.kind).toBeUndefined();
  });

  it('kurulum değişince fan, fan kanalı ve LPT ailenin; çekirdek akışı korunur; aile değişince ops atılır', () => {
    // Kaportalı → çıplak: yolcu fanı (BPR 9) yerine askeri TF fanı, booster düşük PR'lı
    const mtf = TEMPLATES.militaryTurbofan!;
    const { graph: g, notes: gn } = applyArchitectureReport(TEMPLATES.turbofan!, normalizeArchitecture({ ...TF, installation: 'bare', exhaust: 'mixed' }));
    expect(mod(g, 'fan')).toEqual(mod(mtf, 'fan'));
    expect(mod(g, 'lpt')).toEqual(mod(mtf, 'lpt'));
    expect(g.bypassDuct).toEqual(mtf.bypassDuct);
    expect(mod<CompressorModule>(g, 'lpc')!.pr).toBe(DEFAULT_MODULES.bareBoosterPR);
    expect(coreFlow(g)).toBeCloseTo(coreFlow(TEMPLATES.turbofan!), 9);
    expect(gn.map((n) => n.knob)).toEqual(expect.arrayContaining(['fan.pr', 'fan.bypassRatio', 'lpc.pr']));
    expect(g.ops).toBeUndefined();
    expect(mod<MixerModule>(g, 'mixer')).toBeDefined();
    expect(mod<NozzleModule>(g, 'nozzle')!.style).toBe('fixed');
    expect(mod<NozzleModule>(g, 'nozzle')!.chevrons).toBeUndefined();
    // Çıplak → kaportalı (bulgu #7): askeri fanı (PR 4,3, BPR 0,55) kaportalı
    // aralığa kırpmak motoru sıcak çalıştırıyordu (EGT payı −54 K, fan PR 2 ∉
    // 1,4–1,8, BPR 1 ∉ 3–11, akış 144,5 ∉ 150–1500); fan yolcu TF'ninki
    const { graph: h, notes } = applyArchitectureReport(mtf, ok(resolveChange(MTF, 'exhaust', 'separate')).arch);
    const tf = TEMPLATES.turbofan!;
    expect(mod<CompressorModule>(h, 'fan')!.pr).toBe(mod<CompressorModule>(tf, 'fan')!.pr);
    expect(mod<CompressorModule>(h, 'fan')!.bypassRatio).toBe(mod<CompressorModule>(tf, 'fan')!.bypassRatio);
    expect(mod<CompressorModule>(h, 'lpc')!.pr).toBe(mod<CompressorModule>(tf, 'lpc')!.pr);
    expect(coreFlow(h)).toBeCloseTo(coreFlow(mtf), 9);
    expect(notes.map((n) => n.knob)).toEqual(expect.arrayContaining(['fan.pr', 'fan.bypassRatio']));
    expectInKnobRanges(h);
    expectWorkable(h, 'MTF → ayrık');
    // Aynı ailede (yanma odası stili) ops kalır
    expect(applyArchitecture(TEMPLATES.turbojet!, { ...TJ, combustor: 'canAnnular' }).ops).toEqual(TEMPLATES.turbojet!.ops);
  });

  it('LP yükü değişimi: çekirdek akışı korunur, LPC ↔ fan uç hızı taşınır', () => {
    const tj = TEMPLATES.turbojet!;
    const g = applyArchitecture(tj, ok(resolveChange(TJ, 'lpLoad', 'fan')).arch);
    expect(coreFlow(g)).toBeCloseTo(coreFlow(tj), 9);
    expect(mod<CompressorModule>(g, 'fan')!.tipSpeed).toBe(mod<CompressorModule>(tj, 'lpc')!.tipSpeed);
    expect(g.name).toBe(tj.name);
    const back = applyArchitecture(g, TJ);
    expect(coreFlow(back)).toBeCloseTo(coreFlow(tj), 9);
    expect(mod<CompressorModule>(back, 'lpc')!.tipSpeed).toBe(mod<CompressorModule>(g, 'fan')!.tipSpeed);
    // Yeni fanın baypas oranı bağışçınınki (sihirbazla aynı; §2.4'ün 0,6'sı
    // P2'nin kalibre fanıyla karıştırıcıda mixerPR uyarısı veriyordu)
    expect(mod<CompressorModule>(g, 'fan')!.bypassRatio).toBe(mod<CompressorModule>(TEMPLATES.militaryTurbofan!, 'fan')!.bypassRatio);
    // Turbofan → turboprop: çekirdek akışı (115 kg/s) ailenin aralığına (§2.10 TP 3–30) kırpılır, notta
    const { graph: tp, notes } = applyArchitectureReport(TEMPLATES.turbofan!, normalizeArchitecture(TP));
    expect(tp.massFlow).toBe(massFlowRangeFor(TP)[1]);
    expect(notes.find((n) => n.knob === 'engine.massFlow')).toMatchObject({ to: massFlowRangeFor(TP)[1] });
    expect(notes.find((n) => n.knob === 'engine.massFlow')!.from).toBeCloseTo(coreFlow(TEMPLATES.turbofan!), 9);
    expect(architectureOf(tp)).toEqual(normalizeArchitecture(TP));
    expect(Number.isFinite(buildAny(tp).sized.point.thrust)).toBe(true);
  });

  it('LP yükü değişiminde ortak düğmeler (T4, HPC PR, verimler) seed\'den taşınır ya da değişimi notta bildirilir', () => {
    const KNOBS: [string, (g: EngineGraph) => number | undefined][] = [
      ['combustor.tit', (g) => mod<CombustorModule>(g, 'combustor')?.tit],
      ['hpc.pr', (g) => mod<CompressorModule>(g, 'hpc')?.pr],
      ['hpc.eff', (g) => mod<CompressorModule>(g, 'hpc')?.eff],
    ];
    const check = (seed: EngineGraph, next: Architecture) => {
      const { graph, notes } = applyArchitectureReport(seed, next);
      for (const [id, get] of KNOBS) {
        const was = get(seed)!;
        const now = get(graph)!;
        if (now !== was) expect(notes.find((n) => n.knob === id), `${id}: ${was} → ${now} bildirilmedi`).toMatchObject({ from: was, to: now });
      }
      return graph;
    };
    // TJ → fan → TJ: taşınan düğmeler dönüşte aynı. T4 taşınamayabilir: P2'nin
    // askeri TF fanı (PR 4,3) TJ'nin 1230 K'iyle döndürülemez (P5 ≤ P0). HPC
    // PR'ı (2,9) aralığa (4–12) kırpılsa da ailenin T4'üyle EGT payı negatif
    // (bulgu #1: −127 K, redline): ailenin değeri kalır, not düşülür (check)
    const tj = TEMPLATES.turbojet!;
    const fan = check(tj, ok(resolveChange(TJ, 'lpLoad', 'fan')).arch);
    expectWorkable(fan, 'TJ → fan');
    const back = check(fan, TJ);
    for (const [, get] of KNOBS) if (get(fan) === get(tj)) expect(get(back)).toBe(get(tj));
    expect(Number.isFinite(buildAny(fan).sized.point.thrust)).toBe(true);
    // Aralık dışı değer (turboprop HPC PR ≥ 6) kırpılır ve bildirilir
    check(tj, normalizeArchitecture(TP));
    check(TEMPLATES.turbofan!, normalizeArchitecture(TP));
    check(TEMPLATES.turboprop!, normalizeArchitecture(MTF));
    check(TEMPLATES.turboprop!, normalizeArchitecture(TJ));
  });

  it('karıştırıcı: mimari kartından ve sihirbazdan aynı modül (kalibre kayıp)', () => {
    const a = normalizeArchitecture({ ...TF, exhaust: 'mixed', mixer: 'lobed' });
    const viaCard = mod<MixerModule>(applyArchitecture(TEMPLATES.turbofan!, a), 'mixer');
    const viaWizard = mod<MixerModule>(graphFromArchitecture(a, { massFlow: 465, name: '' }), 'mixer');
    expect(viaCard).toEqual(viaWizard);
  });

  it('kutu yanma odalı çıplak fanlı motora booster: kutular yeniden sığdırılır', () => {
    for (const combustor of ['can', 'canAnnular'] as const) {
      const g0 = applyArchitecture(TEMPLATES.militaryTurbofan!, { ...MTF, combustor });
      const g = applyArchitecture(g0, { ...MTF, combustor, booster: true });
      expect(mod<CompressorModule>(g, 'lpc')).toBeDefined();
      expect(Number.isFinite(buildAny(g).sized.point.thrust)).toBe(true);
    }
  });

  it('ardışık uygulamada architectureOf ile tutarlı, hazır yerleşimde kurulur (tohumlu rastgele yürüyüş, 20 × 60 adım)', () => {
    const templates: TemplateId[] = ['turbojet', 'militaryTurbofan', 'turbofan', 'turboprop'];
    const starts = Array.from({ length: 20 }, (_, i) => templates[i % templates.length]);
    let built = 0;
    for (const [i, id] of starts.entries()) {
      const rand = rng(1000 + i);
      let g = TEMPLATES[id]!;
      let a = architectureOf(g);
      for (let step = 0; step < 60; step++) {
        const open = ARCH_OPTIONS.filter((o) => a[o.axis] !== o.value && !o.blocked(a));
        const o = open[Math.floor(rand() * open.length)];
        const next = ok(resolveChange(a, o.axis, o.value)).arch;
        const core0 = coreFlow(g);
        const sameLp = next.lpLoad === a.lpLoad;
        g = applyArchitecture(g, next);
        a = architectureOf(g);
        expect(a, `${id} adım ${step}: ${o.axis}=${String(o.value)}`).toEqual(next);
        expect(checkGraph(g)).toBeNull();
        if (sameLp) expect(coreFlow(g)).toBeCloseTo(core0, 6);
        if (!layoutNotReady(g)) {
          let b: BuiltEngine;
          try {
            b = buildAny(g);
          } catch (e) {
            throw new Error(`${id} tohum ${1000 + i} adım ${step}: ${o.axis}=${String(o.value)} → ${archKey(a)} kurulamadı: ${(e as Error).message}`);
          }
          expect(Number.isFinite(b.sized.point.thrust)).toBe(true);
          built++;
        }
      }
    }
    expect(built).toBeGreaterThan(300);
  }, SLOW);
});

/* ------------------------------------------------------------------ */
/* Kart yolu: sihirbazla aynı ölçüt (inceleme 1: #1, #6, #7, #8, #21)  */
/* ------------------------------------------------------------------ */

/** Her şablondan her açık mimari kartı (tek adım; yerleşimi hazır olanlar) */
const CARD_CASES: [string, TemplateId, Architecture][] = (Object.keys(TEMPLATES) as TemplateId[]).flatMap((id) => {
  const a = architectureOf(TEMPLATES[id]!);
  return ARCH_OPTIONS.filter((o) => a[o.axis] !== o.value && !o.blocked(a)).flatMap((o): [string, TemplateId, Architecture][] => {
    const r = resolveChange(a, o.axis, o.value);
    return 'blocked' in r || notReady(r.arch) ? [] : [[`${id}: ${o.axis}=${String(o.value)}`, id, r.arch]];
  });
});

describe('kart yolu: sihirbaz gibi uyarısız, EGT payı pozitif, düğmeler aralıkta', () => {
  it('kart kümesi dolu (LP yükü, kurulum ve yanma odası geçişleri dahil)', () => {
    expect(CARD_CASES.length).toBeGreaterThanOrEqual(30);
    expect(CARD_CASES.some(([k]) => k.includes('lpLoad='))).toBe(true);
    expect(CARD_CASES.some(([k]) => k.includes('installation=') || k.includes('exhaust=separate'))).toBe(true);
  });

  it.skipIf(!WARNING_RULES.length).each(CARD_CASES)('%s', (label, id, next) => {
    const { graph, notes } = applyArchitectureReport(TEMPLATES[id]!, next);
    expect(archKey(architectureOf(graph))).toBe(archKey(next));
    expectWorkable(graph, label);
    expectInKnobRanges(graph, label);
    // Değişen her taşınan düğme notta (kaynak değer seed'inki)
    for (const n of notes) expect(Number.isFinite(n.from) && Number.isFinite(n.to) && n.reason.length > 0, `${label}: ${n.knob}`).toBe(true);
  }, SLOW);

  it('#1: J79 → fan: HPC PR (2,9) ve T4 sihirbazınki gibi, otomatik çalıştırmada rölanti ve tam güç (redline yok)', () => {
    const tj = TEMPLATES.turbojet!;
    const { graph, notes } = applyArchitectureReport(tj, ok(resolveChange(TJ, 'lpLoad', 'fan')).arch);
    const wiz = graphFromArchitecture(architectureOf(graph), { massFlow: templateGraph('militaryTurbofan').massFlow, name: '' });
    expect(mod<CompressorModule>(graph, 'hpc')!.pr).toBe(mod<CompressorModule>(wiz, 'hpc')!.pr);
    expect(mod<CombustorModule>(graph, 'combustor')!.tit).toBe(mod<CombustorModule>(wiz, 'combustor')!.tit);
    // Not seed'in değerinden ailenin değerine; neden uyarının başlığı
    expect(notes.find((n) => n.knob === 'hpc.pr')).toMatchObject({ from: 2.9, to: mod<CompressorModule>(wiz, 'hpc')!.pr });
    const r = autoStart(buildAny(graph));
    expect(r.tIdle).toBeGreaterThan(0);
    expect(r.tFull).toBeGreaterThanOrEqual(0);
    expect(r.seen).not.toContain('egtRedline');
    expect(r.seen).not.toContain('hotStart');
  }, SLOW);

  it('#1: HPC PR serbest türbinli motorla taşınmaz (anlamı toplam basınç oranı), notta', () => {
    for (const [seed, next] of [
      [TEMPLATES.turbofan!, TP],
      [TEMPLATES.turboprop!, TJ],
    ] as const) {
      const { graph, notes } = applyArchitectureReport(seed, normalizeArchitecture(next));
      const wiz = graphFromArchitecture(architectureOf(graph), { massFlow: graph.massFlow, name: '' });
      expect(mod<CompressorModule>(graph, 'hpc')!.pr).toBe(mod<CompressorModule>(wiz, 'hpc')!.pr);
      expect(notes.find((n) => n.knob === 'hpc.pr')?.reason).toMatch(/anlamı/);
    }
  });

  it('#6: taşınan düğmeler yeni ailenin knobs.ts aralığına kırpılır ve notta (MTF → turbojet: HPC PR 8,2 ∉ 2–6, T4 1670 ∉ 1050–1650)', () => {
    const mtf = TEMPLATES.militaryTurbofan!;
    const { graph, notes } = applyArchitectureReport(mtf, ok(resolveChange(MTF, 'lpLoad', 'lpc')).arch);
    const t = deriveTraits(graph);
    const [, prHi] = knobRange('hpc.pr', t)!;
    const [, titHi] = knobRange('combustor.tit', t)!;
    expect(mod<CompressorModule>(graph, 'hpc')!.pr).toBeLessThanOrEqual(prHi);
    expect(mod<CombustorModule>(graph, 'combustor')!.tit).toBeLessThanOrEqual(titHi);
    expect(notes.find((n) => n.knob === 'hpc.pr')).toMatchObject({ from: 8.2 });
    expect(notes.find((n) => n.knob === 'combustor.tit')).toMatchObject({ from: mod<CombustorModule>(mtf, 'combustor')!.tit });
    expectInKnobRanges(graph);
    // Kutu sayısı da düğmenin aralığında (knobs.ts 6–10; eski taşıma 6–16)
    const can = applyArchitecture(TEMPLATES.turbojetDry!, { ...normalizeArchitecture({ ...TJ, afterburner: false }), combustor: 'can' });
    const c14 = structuredClone(can);
    mod<CombustorModule>(c14, 'combustor')!.cans = 14;
    const back = applyArchitectureReport(c14, ok(resolveChange(architectureOf(c14), 'lpLoad', 'fan')).arch);
    expectInKnobRanges(back.graph, 'kutu');
  });

  it('#7: fan aralıkları knobs.ts ile aynı (tek kaynak)', () => {
    for (const a of [MTF, TF, normalizeArchitecture({ ...TF, exhaust: 'mixed', mixer: 'lobed' })]) {
      const t = deriveTraits(templateGraph(familyOf(a)));
      expect(fanRangeFor(a)).toEqual({ pr: knobRange('fan.pr', t), bpr: knobRange('fan.bypassRatio', t) });
      expect(massFlowRangeFor(a)).toEqual(knobRange('engine.massFlow', t));
    }
    expect(fanRangeFor(TJ)).toBeUndefined();
  });

  it('#8: aynı LP yükünde BPR değişimiyle akış yeni ailenin aralığına kırpılır ve notta', () => {
    // 250 kg/s askeri TF (aralığın üst ucu) → ayrık akış: çekirdek korunursa 1613 ∉ 150–1500
    const big = setMassFlow(structuredClone(TEMPLATES.militaryTurbofan!), 250, 0);
    const { graph, notes } = applyArchitectureReport(big, ok(resolveChange(MTF, 'exhaust', 'separate')).arch);
    const [, hi] = massFlowRangeFor(TF);
    expect(graph.massFlow).toBe(hi);
    const n = notes.find((x) => x.knob === 'engine.massFlow')!;
    expect(n.to).toBe(hi);
    expect(n.from).toBeCloseTo(coreFlow(big) * (1 + mod<CompressorModule>(graph, 'fan')!.bypassRatio!), 6);
    expectInKnobRanges(graph);
  });

  it('#21: kutu sığdırma her adımda ilerler, 0 ve 0,04 m/s referans hızda döngü biter', () => {
    for (const v of [-1, 0, 0.04, 0.049, 1, 25, 49.99, Number.NaN]) {
      const n = nextFitVelocity(v);
      expect(n).toBeGreaterThan(Number.isFinite(v) && v > 0 ? v : 0);
      expect(n).toBeLessThanOrEqual(CAN_FIT_VREF_MAX);
    }
    for (const vref of [0, 0.04]) {
      const g = structuredClone(TEMPLATES.turbojetDry!);
      const c = mod<CombustorModule>(g, 'combustor')!;
      c.cans = 6;
      // Sonsuz döngü eşzamanlı: vitest süre sınırı kesemez, yazım sayısı keser
      let v = vref;
      let writes = 0;
      Object.defineProperty(c, 'refVelocity', {
        get: () => v,
        set: (x: number) => {
          if (++writes > 1000) throw new Error(`fitCans ilerlemiyor (v=${v})`);
          v = x;
        },
        enumerable: true,
        configurable: true,
      });
      fitCans(g);
      expect(v).toBeGreaterThan(vref);
      expect(() => computeGasPath(g, sizeEngine(toEngineDesign(g)))).not.toThrow();
    }
    // Dosyadan gelen 0 m/s'lik kutu-halka yanma odalı motorda mimari kartı sayfayı dondurmaz
    const doc = structuredClone(TEMPLATES.turbojetDry!);
    mod<CombustorModule>(doc, 'combustor')!.refVelocity = 0;
    const { graph, notes } = applyArchitectureReport(doc, normalizeArchitecture({ ...TJ, combustor: 'canAnnular' }));
    expect(mod<CombustorModule>(graph, 'combustor')!.refVelocity).toBeGreaterThan(0);
    expect(notes.find((n) => n.knob === 'combustor.refVelocity')).toMatchObject({ from: 0 });
    expect(Number.isFinite(buildAny(graph).sized.point.thrust)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* solveMassFlow                                                       */
/* ------------------------------------------------------------------ */

/** Tasarım noktası itkisi / mil gücü (yerleşimsiz; atölyenin referansıyla) */
function measure(g: EngineGraph, a: Architecture) {
  const s = sizeEngine(toEngineDesign(g, { reference: referenceFor(a) }));
  return { thrust: s.point.thrust, shaftPower: s.ref.outputPower };
}

/** Çıkış mili gücü simülasyonda modelleniyor mu (P1) */
const shaftPowerModeled = (() => {
  try {
    return measure(graphSkeleton(TS, { massFlow: 4.5, name: '' }), TS).shaftPower > 0;
  } catch {
    return false;
  }
})();

describe('solveMassFlow: hedef itki / güç ±%1', () => {
  const thrustCases: [string, Architecture, number][] = [
    ['sihirbaz: kuru kutu-halka turbojet 30 kN', { ...TJ, afterburner: false, combustor: 'canAnnular' }, 30e3],
    ['turbojet 20 kN', TJ, 20e3],
    ['turbojet 90 kN', TJ, 90e3],
    ['askeri TF 60 kN', MTF, 60e3],
    ['askeri TF booster’lı 120 kN', { ...MTF, booster: true }, 120e3],
    ['kuru düşük baypas 45 kN', { ...MTF, afterburner: false }, 45e3],
    ['turbofan 120 kN', TF, 120e3],
    ['karışık kaportalı 140 kN', { ...TF, exhaust: 'mixed', mixer: 'lobed' }, 140e3],
  ];
  it.each(thrustCases)('%s', (_n, a, thrust) => {
    const g0 = graphFromArchitecture(a, { massFlow: templateGraph(familyOf(a)).massFlow, name: '' });
    const W = solveMassFlow(g0, { thrust });
    const g = graphFromArchitecture(a, { massFlow: W, name: '' });
    expect(Math.abs(measure(g, a).thrust / thrust - 1)).toBeLessThan(0.01);
    if (!notReady(a)) {
      const b = buildEngine(g, { reference: referenceFor(a) });
      expect(Math.abs(b.sized.point.thrust / thrust - 1)).toBeLessThan(0.01);
    }
  });

  it('turboprop 1,5 MW mil gücü', () => {
    const g0 = graphFromArchitecture(TP, { massFlow: 9.5, name: '' });
    const W = solveMassFlow(g0, { shaftPower: 1.5e6 });
    const b = buildEngine(graphFromArchitecture(TP, { massFlow: W, name: '' }), { reference: referenceFor(TP) });
    expect(Math.abs(b.sized.ref.outputPower / 1.5e6 - 1)).toBeLessThan(0.01);
  });

  it.skipIf(!shaftPowerModeled)('turboşaft 1,4 MW mil gücü', () => {
    const g0 = graphFromArchitecture(TS, { massFlow: 4.5, name: '' });
    const W = solveMassFlow(g0, { shaftPower: 1.4e6 });
    expect(Math.abs(measure(graphFromArchitecture(TS, { massFlow: W, name: '' }), TS).shaftPower / 1.4e6 - 1)).toBeLessThan(0.01);
  });

  // Ölçekli motorun çalıştırılması atalet ve marş torkunun ölçeklenmesini
  // ister (P1 deriveOperability). P0 kimlik taslağında 120 kN'lik TF
  // rölantiye 77 s'de çıkar: P1 birleşince kendiliğinden koşar.
  const opsScaled = (() => {
    const W = massFlowRangeFor(TJ)[0] * 3;
    return buildArch(TJ, W).b.design.inertia.hp !== referenceFor(TJ).design.inertia.hp;
  })();
  it.skipIf(!opsScaled)('sihirbaz hedefinde kurulan motor otomatik çalıştırmada rölantiye ve tam güce çıkar', () => {
    for (const [a, thrust] of [
      [TJ, 30e3],
      [MTF, 60e3],
      [TF, 120e3],
    ] as [Architecture, number][]) {
      const W = solveMassFlow(graphFromArchitecture(a, { massFlow: 1, name: '' }), { thrust });
      const { b } = buildArch(a, W);
      const r = autoStart(b);
      expect(r.seen).not.toContain('hotStart');
      expect(r.tIdle).toBeGreaterThan(0);
      expect(r.tFull).toBeGreaterThanOrEqual(0);
      expect(r.sim.surgeCount).toBe(0);
    }
  }, SLOW);

  it('aralık dışı hedef aralığın ucunu verir', () => {
    const g = graphFromArchitecture(TJ, { massFlow: 66, name: '' });
    expect(solveMassFlow(g, { thrust: 1e9 })).toBe(massFlowRangeFor(TJ)[1]);
    expect(solveMassFlow(g, { thrust: 1 })).toBe(massFlowRangeFor(TJ)[0]);
  });

  it('ölçülemeyen hedef sessizce aralığın ucunu vermez: tipli hata', () => {
    // Turbojette mil gücü yok
    expect(() => solveMassFlow(graphFromArchitecture(TJ, { massFlow: 66, name: '' }), { shaftPower: 1e6 })).toThrow(DesignError);
    // Geçersiz grafik GraphError olarak çağırana gider
    const bad = graphFromArchitecture({ ...TJ, exhaust: 'mixed' }, { massFlow: 66, name: '' });
    expect(() => solveMassFlow(bad, { thrust: 30e3 })).toThrow(GraphError);
    // Mil gücü henüz modellenmeyen turboşaftta (P1 öncesi) DesignError
    if (!shaftPowerModeled) expect(() => solveMassFlow(graphFromArchitecture(TS, { massFlow: 4.5, name: '' }), { shaftPower: 1.4e6 })).toThrow(DesignError);
  });

  it('şablon (ops tam) referanssız çözülür ve kendi itkisini verir', () => {
    const t = TEMPLATES.turbojet!;
    const F = buildEngine(t).sized.point.thrust;
    expect(solveMassFlow(t, { thrust: F })).toBeCloseTo(t.massFlow, 4);
  });
});
