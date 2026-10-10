/**
 * M5a P0 sözleşme testleri: türetilmiş motor tipi, grafik kuralları,
 * yuvalar ve yerleşim kayıt defteri.
 */

import { describe, expect, it } from 'vitest';
import { ENGINE_CATALOG, type EngineKind } from '../sim/design';
import { builtFor, designFor, ENGINE_GRAPHS, overrideGraph, setSlotBuilt, setSlotGraph, TEMPLATES } from './catalog';
import { evaluate, isEvaluation } from './evaluate';
import { FlowpathError } from './flowpath';
import { buildEngine, checkGraph, GRAPH_RULES, GraphError, isBuiltEngine, toEngineDesign, validateGraph } from './graph';
import { LAYOUT_READY, LAYOUTS } from './layouts/index';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import { deriveTraits, layoutStyleOf, presentationKind, traitsFromDesign } from './traits';
import type { CombustorModule, CompressorModule, EngineGraph, EngineModule, InletModule, NozzleModule, ShaftModule } from './types';

const TEMPLATE_GRAPHS: [EngineKind, EngineGraph][] = [
  ['turbojet', TURBOJET_GRAPH],
  ['militaryTurbofan', MILITARY_TURBOFAN_GRAPH],
  ['turboprop', TURBOPROP_GRAPH],
  ['turbofan', TURBOFAN_GRAPH],
];

/** Klonlayıp bir modülü değiştirir */
function tweak<T extends EngineModule>(g: EngineGraph, type: T['type'], f: (m: T) => void): EngineGraph {
  const c = structuredClone(g);
  f(c.modules.find((m) => m.type === type) as T);
  return c;
}
const without = (g: EngineGraph, ...types: string[]): EngineGraph => ({ ...structuredClone(g), modules: g.modules.filter((m) => !types.includes(m.type)).map((m) => structuredClone(m)) });
/** Modülü akış sırasındaki yerine ekler */
function withModule(g: EngineGraph, m: EngineModule, before: EngineModule['type']): EngineGraph {
  const c = structuredClone(g);
  c.modules.splice(c.modules.findIndex((x) => x.type === before), 0, structuredClone(m));
  return c;
}
const mod = <T extends EngineModule>(g: EngineGraph, type: T['type']) => g.modules.find((m) => m.type === type) as T;

/** TP'den turboşaft grafiği (yerleşimi P7'de) */
function turboshaftGraph(drive: 'front' | 'rear' = 'front'): EngineGraph {
  const g = without(TURBOPROP_GRAPH, 'propeller');
  const shaft: ShaftModule = { type: 'shaft', rpm: 20900, drive, reduction: false, transmissionEff: 0.985, gearboxLength: 0.35 };
  g.modules.unshift(shaft);
  mod<InletModule>(g, 'inlet').style = 'annular';
  delete g.kind;
  return g;
}

describe('türetilmiş motor tipi', () => {
  it.each(TEMPLATE_GRAPHS)('%s: presentationKind şablonun etiketiyle aynı', (kind, g) => {
    const t = deriveTraits(g);
    expect(t.presentation).toBe(kind);
    expect(presentationKind(t)).toBe(g.kind);
    expect(buildEngine(g).design.kind).toBe(kind);
  });

  it.each(TEMPLATE_GRAPHS)('%s: traitsFromDesign(katalog) = deriveTraits(şablon)', (kind, g) => {
    expect(traitsFromDesign(ENGINE_CATALOG[kind])).toEqual(deriveTraits(g));
    expect(traitsFromDesign(buildEngine(g).design)).toEqual(deriveTraits(g));
  });

  it('karışık kaportalı turbofan (BPR 1,2): traitsFromDesign = deriveTraits', () => {
    const g = withModule(TURBOFAN_GRAPH, { type: 'mixer', loss: 0.015, style: 'lobed', lobes: 18 }, 'nozzle');
    const n = mod<NozzleModule>(g, 'nozzle');
    n.style = 'fixed';
    delete n.chevrons;
    mod<CompressorModule>(g, 'fan').bypassRatio = 1.2;
    expect(checkGraph(g)).toBeNull();
    const t = deriveTraits(g);
    expect(t).toMatchObject({ layout: 'nacelle', presentation: 'turbofan', exhaust: 'mixed', installed: true });
    // Tasarım yolu (toEngineDesign): yerleşimi P6'da, boyutlandırma gerekmez
    expect(traitsFromDesign(toEngineDesign(g))).toEqual(t);
  });

  it('yerleşim stilleri ve ayırt edici alanlar', () => {
    expect(TEMPLATE_GRAPHS.map(([, g]) => layoutStyleOf(g))).toEqual(['bare', 'bare', 'turboprop', 'nacelle']);
    const tj = deriveTraits(TURBOJET_GRAPH);
    expect(tj).toMatchObject({ lpLoad: 'lpc', smoky: true, afterburner: true, nozzle: 'convergent', variableNozzle: true, exhaust: 'single' });
    expect(deriveTraits(MILITARY_TURBOFAN_GRAPH)).toMatchObject({ lpLoad: 'fan', booster: false, exhaust: 'mixed', nozzle: 'cd', smoky: false });
    expect(deriveTraits(TURBOFAN_GRAPH)).toMatchObject({ booster: true, exhaust: 'separate', installed: true });
    expect(deriveTraits(TURBOPROP_GRAPH)).toMatchObject({ output: 'propeller', centrifugal: true, nozzle: 'stub' });
    // Kuru turbojet turbojet, turboşaft turboshaft sunumunu kullanır
    const dry = tweak<NozzleModule>(without(TURBOJET_GRAPH, 'afterburner'), 'nozzle', (n) => (n.style = 'fixed'));
    expect(deriveTraits(dry)).toMatchObject({ presentation: 'turbojet', afterburner: false, variableNozzle: false });
    expect(deriveTraits(turboshaftGraph())).toMatchObject({ presentation: 'turboshaft', layout: 'turboshaft', output: 'shaft', lpLoad: 'shaft' });
  });
});

describe('grafik kuralları (GRAPH_RULES)', () => {
  it('kural kimlikleri tekil, şablonlar geçerli', () => {
    const ids = GRAPH_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, g] of TEMPLATE_GRAPHS) expect(checkGraph(g)).toBeNull();
  });

  /** Her yeni ya da değişen kural için onu ihlal eden bir grafik */
  const cases: [string, EngineGraph, RegExp][] = [
    ['lpLoad.exclusive', withModule(TURBOPROP_GRAPH, mod(TURBOFAN_GRAPH, 'fan'), 'hpc'), /çıkış mili ve fan aynı motorda olamaz/],
    ['lpLoad.freeTurbineLpc', withModule(TURBOPROP_GRAPH, mod(TURBOJET_GRAPH, 'lpc'), 'hpc'), /Serbest güç türbininin milinde kompresör yok/],
    ['lpLoad.required', without(TURBOJET_GRAPH, 'lpc'), /pervane ya da çıkış mili gerekli/],
    ['nozzle.stubNeeded', tweak<NozzleModule>(TURBOPROP_GRAPH, 'nozzle', (n) => (n.style = 'fixed')), /Pervaneli ya da çıkış milli motorun egzozu kısa bir borudur/],
    ['nozzle.stubUse', tweak<NozzleModule>(TURBOJET_GRAPH, 'nozzle', (n) => (n.style = 'stub')), /yalnız pervaneli ya da çıkış milli motorda/],
    ['nozzle.variableNeedsAb', without(TURBOJET_GRAPH, 'afterburner'), /Art yakıcısız motor sabit yakınsak lüle kullanır/],
    ['nozzle.fixedWithAb', tweak<NozzleModule>(TURBOJET_GRAPH, 'nozzle', (n) => (n.style = 'fixed')), /Art yakıcı değişken kesitli lüle ister/],
    ['inlet.annular', tweak<InletModule>(TURBOJET_GRAPH, 'inlet', (i) => (i.style = 'annular')), /Halka giriş turboşaftın/],
    [
      'nozzle.separateNacelle',
      tweak<CompressorModule>(tweak<InletModule>(TURBOFAN_GRAPH, 'inlet', (i) => (i.style = 'bellmouth')), 'fan', (f) => (f.bypassRatio = 1.2)),
      /Ayrık akışlı lüle kaportalı turbofan içindir/,
    ],
    ['inlet.propChin', tweak<InletModule>(TURBOPROP_GRAPH, 'inlet', (i) => (i.style = 'bellmouth')), /çene girişinden alır/],
    ['inlet.shaftAnnular', tweak<InletModule>(turboshaftGraph(), 'inlet', (i) => (i.style = 'bellmouth')), /turboşaft halka giriş ister/],
    ['inlet.nacelle', tweak<CompressorModule>(TURBOFAN_GRAPH, 'fan', (f) => (f.bypassRatio = 0.8)), /Kaportalı yerleşim fanlı motor içindir/],
    ['inlet.nacelleBooster', without(TURBOFAN_GRAPH, 'lpc'), /booster \(LPC\) ister/],
    ['hpc.centrifugalNeeded', tweak<CompressorModule>(TURBOPROP_GRAPH, 'hpc', (h) => delete h.centrifugal), /santrifüj son kademe ister/],
    [
      'hpc.centrifugalOnly',
      tweak<CompressorModule>(TURBOJET_GRAPH, 'hpc', (h) => (h.centrifugal = { ...mod<CompressorModule>(TURBOPROP_GRAPH, 'hpc').centrifugal! })),
      /Santrifüj son kademe şimdilik serbest türbinli motorlarda/,
    ],
    ['combustor.cans', tweak<CombustorModule>(TURBOJET_GRAPH, 'combustor', (c) => Object.assign(c, { style: 'canAnnular', cans: 4 })), /6–16 kutu ister/],
    ['shaft.rear', turboshaftGraph('rear'), /Arkadan çıkışlı mil M5b'de/],
    ['bare.bpr', tweak<CompressorModule>(MILITARY_TURBOFAN_GRAPH, 'fan', (f) => (f.bypassRatio = 2)), /Çıplak karışık akışlı motor düşük baypas içindir/],
  ];

  it.each(cases)('%s', (id, g, msg) => {
    const e = checkGraph(g);
    expect(e).toBeInstanceOf(GraphError);
    expect(e!.ruleId).toBe(id);
    expect(e!.message).toMatch(msg);
    expect(() => validateGraph(g)).toThrow(msg);
    const rule = GRAPH_RULES.find((r) => r.id === id)!;
    expect(e!.group).toBe(rule.group);
    expect(e!.knobs).toEqual(rule.knobs ?? []);
  });

  it('kutu yanma odası: kutu sayısı tamsayı ve verilmiş olmalı', () => {
    const noCans = tweak<CombustorModule>(TURBOJET_GRAPH, 'combustor', (c) => (c.style = 'can'));
    expect(checkGraph(noCans)?.ruleId).toBe('combustor.cans');
    const frac = tweak<CombustorModule>(TURBOJET_GRAPH, 'combustor', (c) => Object.assign(c, { style: 'can', cans: 8.5 }));
    expect(checkGraph(frac)?.knobs).toEqual(['combustor.cans']);
  });

  it('yapı kuralları dinamik mesajla', () => {
    const dup = withModule(TURBOJET_GRAPH, mod(TURBOJET_GRAPH, 'hpc'), 'hpc');
    expect(checkGraph(dup)).toMatchObject({ ruleId: 'structure.unique', message: '"hpc" modülü birden fazla.' });
    expect(checkGraph(without(TURBOJET_GRAPH, 'combustor'))?.ruleId).toBe('structure.required.combustor');
  });
});

describe('hazır olmayan yerleşimler tipli hata verir', () => {
  it('art yakıcısız çıplak motor (P5: hazır, kurulur)', () => {
    const dry = tweak<NozzleModule>(without(TURBOJET_GRAPH, 'afterburner'), 'nozzle', (n) => (n.style = 'fixed'));
    validateGraph(dry); // eski "bellmouth" kuralı kalktı
    expect(buildEngine(dry).flowpath.layout).toMatchObject({ style: 'bare', ab: null, nozzle: { kind: 'fixed' } });
  });

  it('karışık akışlı kaportalı turbofan (P6)', () => {
    const g = withModule(TURBOFAN_GRAPH, { type: 'mixer', loss: 0.015, style: 'lobed', lobes: 18 }, 'nozzle');
    const n = mod<NozzleModule>(g, 'nozzle');
    n.style = 'fixed';
    delete n.chevrons;
    validateGraph(g);
    // P6: uzun kanallı kaporta, karıştırıcı ve ortak lüle
    expect(buildEngine(g).flowpath.layout).toMatchObject({ style: 'nacelle', mixed: { mixer: { style: 'lobed', lobes: 18 } } });
  });

  it('turboşaft (P7)', () => {
    const g = turboshaftGraph();
    validateGraph(g);
    expect(() => buildEngine(g)).toThrow(FlowpathError);
    expect(() => buildEngine(g)).toThrow(/Turboşaft yerleşimi henüz yok/);
    expect(LAYOUT_READY).toEqual({ bare: true, nacelle: true, turboprop: true, turboshaft: false });
    expect(Object.keys(LAYOUTS).sort()).toEqual(['bare', 'nacelle', 'turboprop', 'turboshaft']);
  });
});

describe('yerleşim ortak alanları', () => {
  it.each(TEMPLATE_GRAPHS)('%s: style, mounts ≥ 2, dış zarf z artan, giriş/lüle ağzı', (_kind, g) => {
    const b = buildEngine(g);
    const L = b.flowpath.layout;
    expect(L.style).toBe(b.traits.layout);
    expect(L.mounts.length).toBeGreaterThanOrEqual(2);
    for (const m of L.mounts) for (const v of [m.z, m.r, m.angle]) expect(Number.isFinite(v)).toBe(true);
    expect(L.outerProfile.length).toBeGreaterThan(3);
    for (let i = 1; i < L.outerProfile.length; i++) expect(L.outerProfile[i][0]).toBeGreaterThan(L.outerProfile[i - 1][0]);
    for (const v of [L.intake.z, L.intake.radius, L.intake.y, L.exhaustExit.z, L.exhaustExit.radius]) expect(Number.isFinite(v)).toBe(true);
    expect(L.exhaustExit.z).toBeGreaterThan(L.intake.z);
  });
});

describe('yuvalar ve inşa', () => {
  it('BuiltEngine traits, rev, graph taşır; rev kararlı ve tasarımı ayırt eder', () => {
    const a = buildEngine(TURBOJET_GRAPH);
    expect(a.graph).toBe(TURBOJET_GRAPH);
    expect(a.traits).toEqual(deriveTraits(TURBOJET_GRAPH));
    expect(a.rev).toMatch(/^r[0-9a-z]+$/);
    expect(buildEngine(structuredClone(TURBOJET_GRAPH)).rev).toBe(a.rev);
    // kind etiketi ve modül dizisinin sırası rev'i değiştirmez
    const { kind: _k, ...noKind } = structuredClone(TURBOJET_GRAPH);
    expect(buildEngine(noKind).rev).toBe(a.rev);
    expect(buildEngine({ ...TURBOJET_GRAPH, massFlow: 70 }).rev).not.toBe(a.rev);
  });

  it('şablonlar katalogda; turboşaft henüz yok ve tipli hata verir', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(['militaryTurbofan', 'turbofan', 'turbofanMixed', 'turbojet', 'turbojetDry', 'turboprop']);
    expect(Object.keys(ENGINE_GRAPHS).sort()).toEqual(['militaryTurbofan', 'turbofan', 'turbojet', 'turboprop']);
    expect(builtFor('turboshaft')).toBeUndefined();
    expect(() => designFor('turboshaft')).toThrow(GraphError);
    expect(() => designFor('workshop')).toThrow(/Atölye yuvası boş/);
  });

  it('atölye yuvası kind yuvalarını ezmez; null şablona döner', () => {
    const tf = designFor('turbofan');
    const g = tweak<CompressorModule>(TURBOFAN_GRAPH, 'hpc', (h) => (h.pr = 17));
    const w = setSlotGraph('workshop', g)!;
    expect(builtFor('workshop')).toBe(w);
    expect(designFor('turbofan')).toBe(tf);
    expect(w.rev).not.toBe(builtFor('turbofan')!.rev);
    // Geçersiz grafik atar, eski yuva kalır
    expect(() => setSlotGraph('workshop', without(g, 'combustor'))).toThrow(GraphError);
    expect(builtFor('workshop')).toBe(w);
    expect(setSlotGraph('workshop', null)).toBeUndefined();
    expect(builtFor('workshop')).toBeUndefined();
    // Kayıt kancası uyumu: kind yuvası değişir, null şablona döner
    const o = overrideGraph('turbofan', g)!;
    expect(designFor('turbofan')).toBe(o.design);
    overrideGraph('turbofan', null);
    expect(builtFor('turbofan')!.rev).toBe(buildEngine(TURBOFAN_GRAPH).rev);
  });
});

describe('yuvaya hazır motor ve seçenekler', () => {
  it('setSlotBuilt mağazanın ürettiği nesneyi yeniden üretmeden yazar', () => {
    const g = structuredClone(TURBOFAN_GRAPH);
    g.massFlow = 900;
    const b = buildEngine(g, { reference: buildEngine(TURBOFAN_GRAPH), stageHysteresis: 0.03 });
    expect(isBuiltEngine(b)).toBe(true);
    expect(isBuiltEngine(g)).toBe(false);
    expect(setSlotBuilt('workshop', b)).toBe(b);
    expect(builtFor('workshop')).toBe(b);
    expect(designFor('workshop')).toBe(b.design);
    setSlotGraph('workshop', null);
    expect(builtFor('workshop')).toBeUndefined();
  });

  it('referanslı atölye grafiği (ops yok) seçeneklerle üretilir, referanssız tipli hata', () => {
    const { ops: _ops, ...g } = structuredClone(TURBOJET_GRAPH);
    expect(() => buildEngine(g)).toThrow(GraphError);
    const ref = buildEngine(TURBOJET_GRAPH);
    expect(buildEngine(g, { reference: ref }).design.inertia).toEqual(ref.design.inertia);
  });

  it('aksesuar gücü: düzeltme > çekirdek akışıyla ölçek > grafik; boyutlandırmadan önce', () => {
    const ref = buildEngine(TURBOFAN_GRAPH);
    // Şablonun kendisine uygulanınca oran tam 1
    expect(buildEngine(TURBOFAN_GRAPH, { reference: ref }).design.accessoryPower).toBe(ref.design.accessoryPower);
    const big = structuredClone(TURBOFAN_GRAPH);
    big.massFlow *= 2;
    const b = buildEngine(big, { reference: ref });
    expect(b.design.accessoryPower / ref.design.accessoryPower).toBeCloseTo(2, 12);
    // Tasarım noktasına girdi: boyutlandırılmış motor aynı değeri kullanır
    expect(b.sized.design.accessoryPower).toBe(b.design.accessoryPower);
    // Referanssız: grafiğin kendi değeri; ×[0,3, 3] kırpma
    expect(buildEngine(big).design.accessoryPower).toBe(TURBOFAN_GRAPH.accessoryPower);
    const huge = structuredClone(TURBOFAN_GRAPH);
    huge.massFlow *= 10;
    expect(buildEngine(huge, { reference: ref }).design.accessoryPower).toBeCloseTo(3 * ref.design.accessoryPower, 6);
    // Uzman düzeltmesi önce gelir
    big.ops = { ...big.ops, accessoryPower: 123e3 };
    expect(buildEngine(big, { reference: ref }).design.accessoryPower).toBe(123e3);
  });
});

describe('FlowpathError yapısal alanlar', () => {
  it('kutu sığmıyor: kod, modül, düğmeler, sayılar', () => {
    const g = tweak<CombustorModule>(TURBOJET_GRAPH, 'combustor', (c) => Object.assign(c, { style: 'can', cans: 16, refVelocity: 5 }));
    let e: unknown;
    try {
      buildEngine(g);
    } catch (x) {
      e = x;
    }
    expect(e).toBeInstanceOf(FlowpathError);
    const f = e as FlowpathError;
    expect(f).toMatchObject({ name: 'FlowpathError', code: 'combustor.cansFit', group: 'combustor' });
    expect(f.knobs).toContain('combustor.cans');
    expect(f.data?.cans).toBe(16);
  });

  it('hazır olmayan yerleşim: layout.notReady', () => {
    expect(() => buildEngine(turboshaftGraph())).toThrow(expect.objectContaining({ code: 'layout.notReady', name: 'FlowpathError' }));
  });

  // Gerileme: evaluate'in kademe tavanı denetimi gaz yolunu buildEngine'den
  // önce kuruyordu; hazır olmayan yerleşimde "HPC konumlanamıyor" dönüyordu
  it.skipIf(LAYOUT_READY.turboshaft)('hazır olmayan yerleşim: evaluate de layout.notReady çevirisini döndürür', () => {
    const ts = turboshaftGraph();
    // Atölye yolu: aile tabanı (kind ve ops atılır) + turboprop referansı
    const base = structuredClone(ts);
    delete base.kind;
    delete base.ops;
    for (const r of [evaluate(ts), evaluate(base, { reference: buildEngine(TURBOPROP_GRAPH) })]) {
      expect(isEvaluation(r)).toBe(false);
      if (isEvaluation(r)) continue;
      expect(r.error).toMatchObject({ title: 'Bu mimari yakında', source: 'flowpath' });
      expect(r.error.raw).toMatch(/yerleşimi henüz yok/);
    }
  });
});

