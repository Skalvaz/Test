/**
 * Modül grafiği → EngineDesign → tasarım noktası → gaz yolu geometrisi.
 *
 * Zincir:
 *   1. validateGraph: modül sırası ve birleşim kuralları (GRAPH_RULES)
 *   2. toEngineDesign: termodinamik düğmeler (geometri henüz yok)
 *   3. sizeEngine: tasarım noktası istasyonları (sim/design.ts)
 *   4. computeFlowpath: istasyonlardan geometri ve mil devirleri
 *   5. Devir/fan çapı/kanat sayısı tasarıma yazılır, motor yeniden
 *      boyutlandırılır (devir yalnız referans açısal hızları etkiler)
 *
 * Motor tipi (`design.kind`) grafikte saklanmaz, modüllerden türetilir
 * (traits.ts).
 */

import { sizeEngine, type EngineDesign, type SizedEngine } from '../sim/design';
import { graphRev } from './engineDoc';
import { GraphError } from './errors';
import { computeFlowpath, type Flowpath, type GasPath } from './flowpath';
import { assertLayoutReady } from './layouts/index';
import { deriveOperability, opsOf, resolveAccessoryPower, resolveOperability } from './operability';
import { deriveTraits, layoutStyleOf, type EngineTraits } from './traits';
import { CHEVRON_CV_LOSS, MIXING_EFF, MODULE_ORDER } from './types';
import type {
  AfterburnerModule,
  CombustorModule,
  CompressorModule,
  EngineGraph,
  EngineModule,
  InletModule,
  MixerModule,
  ModuleType,
  NozzleModule,
  PropellerModule,
  ShaftModule,
  TurbineModule,
} from './types';

export { GraphError };

/** Akış yönünde modül sırası (aynı sırada birden çok modül olamaz) */
export const ORDER = MODULE_ORDER;

/* ------------------------------------------------------------------ */
/* Kurallar                                                            */
/* ------------------------------------------------------------------ */

export interface GraphRule {
  id: string;
  group: ModuleType | 'engine';
  /** true: grafik bu kuralı İHLAL ediyor */
  test(g: EngineGraph): boolean;
  msg: string;
  /** Mesaj grafiğe bağlıysa (hangi modül vb.) */
  detail?(g: EngineGraph): string;
  knobs?: string[];
}

/** Kuralların ortak gözlemleri (grafik başına bir kez) */
interface Facts {
  types: ModuleType[];
  has(t: ModuleType): boolean;
  fan?: CompressorModule;
  hpc?: CompressorModule;
  comb?: CombustorModule;
  mixer?: MixerModule;
  noz?: NozzleModule;
  inlet?: InletModule;
  shaft?: ShaftModule;
  bpr: number;
  ab: boolean;
  /** Pervane ya da çıkış mili: serbest güç türbinli motor */
  freeTurbine: boolean;
}

/** checkGraph süresince hesaplanmış gözlemler (grafik yerinde değişebilir: önbellek kalıcı değil) */
let active: { g: EngineGraph; f: Facts } | null = null;

function facts(g: EngineGraph): Facts {
  if (active?.g === g) return active.f;
  const types = g.modules.map((m) => m.type);
  const has = (t: ModuleType) => types.includes(t);
  const find = <T extends EngineModule>(t: T['type']) => g.modules.find((m) => m.type === t) as T | undefined;
  const fan = find<CompressorModule>('fan');
  const f: Facts = {
    types,
    has,
    fan,
    hpc: find<CompressorModule>('hpc'),
    comb: find<CombustorModule>('combustor'),
    mixer: find<MixerModule>('mixer'),
    noz: find<NozzleModule>('nozzle'),
    inlet: find<InletModule>('inlet'),
    shaft: find<ShaftModule>('shaft'),
    bpr: fan?.bypassRatio ?? 0,
    ab: has('afterburner'),
    freeTurbine: has('propeller') || has('shaft'),
  };
  return f;
}

const REQUIRED = ['inlet', 'hpc', 'combustor', 'hpt', 'lpt', 'nozzle'] as const;

/**
 * Grafik kuralları, denetim sırasında. İlk ihlal GraphError olarak atılır.
 * Yapı kuralları (tekil modül, sıra, zorunlu modüller) öndedir: sonraki
 * kurallar zorunlu modüllerin var olduğunu varsayar.
 */
export const GRAPH_RULES: readonly GraphRule[] = [
  {
    id: 'structure.unique',
    group: 'engine',
    test: (g) => ORDER.some((t) => facts(g).types.filter((x) => x === t).length > 1),
    msg: 'Bir modül tipi motorda yalnız bir kez bulunabilir.',
    detail: (g) => `"${ORDER.find((t) => facts(g).types.filter((x) => x === t).length > 1)}" modülü birden fazla.`,
  },
  {
    id: 'structure.order',
    group: 'engine',
    test: (g) => facts(g).types.some((t, i, a) => i > 0 && ORDER.indexOf(t) < ORDER.indexOf(a[i - 1])),
    msg: 'Modül sırası yanlış: modüller akış yönünde dizilmeli.',
    detail: (g) => {
      const a = facts(g).types;
      const t = a.find((x, i) => i > 0 && ORDER.indexOf(x) < ORDER.indexOf(a[i - 1]));
      return `Modül sırası yanlış: "${t}" akış yönünde daha önce gelmeli.`;
    },
  },
  ...REQUIRED.map(
    (t): GraphRule => ({
      id: `structure.required.${t}`,
      group: t,
      test: (g) => !facts(g).has(t),
      msg: `Zorunlu modül eksik: "${t}".`,
    }),
  ),
  {
    id: 'lpLoad.exclusive',
    group: 'engine',
    test: (g) => ['propeller', 'shaft', 'fan'].filter((t) => facts(g).has(t as ModuleType)).length > 1,
    msg: 'Pervane, çıkış mili ve fan aynı motorda olamaz: üçü de LP milinin işini alır.',
  },
  {
    id: 'lpLoad.freeTurbineLpc',
    group: 'lpc',
    test: (g) => facts(g).freeTurbine && facts(g).has('lpc'),
    msg: 'Serbest güç türbininin milinde kompresör yok: LP mili gücü dışarı verir.',
  },
  {
    id: 'lpLoad.required',
    group: 'engine',
    test: (g) => !['fan', 'lpc', 'propeller', 'shaft'].some((t) => facts(g).has(t as ModuleType)),
    msg: 'LP milini yükleyecek bir fan, alçak basınç kompresörü, pervane ya da çıkış mili gerekli.',
  },
  {
    id: 'mixer.bypass',
    group: 'mixer',
    test: (g) => facts(g).has('mixer') && facts(g).bpr <= 0,
    msg: 'Karıştırıcı baypas akışı ister: fanın baypas oranı sıfır.',
    knobs: ['fan.bypassRatio'],
  },
  {
    id: 'afterburner.mixer',
    group: 'afterburner',
    test: (g) => facts(g).ab && facts(g).bpr > 0 && !facts(g).has('mixer'),
    msg: 'Art yakıcı tek bir jet borusu ister: baypas akışı önce karıştırılmalı.',
  },
  {
    id: 'nozzle.separateNeeded',
    group: 'nozzle',
    test: (g) => facts(g).bpr > 0 && !facts(g).has('mixer') && facts(g).noz!.style !== 'separate',
    msg: 'Karıştırılmayan baypas akışı ayrı bir baypas lülesi ister (ayrık akışlı lüle).',
  },
  {
    id: 'nozzle.separateUse',
    group: 'nozzle',
    test: (g) => facts(g).noz!.style === 'separate' && (facts(g).bpr <= 0 || facts(g).has('mixer')),
    msg: 'Ayrık akışlı lüle, karıştırılmayan bir baypas akışı ister.',
  },
  {
    id: 'nozzle.separateNacelle',
    group: 'nozzle',
    test: (g) => facts(g).noz!.style === 'separate' && facts(g).inlet!.style !== 'nacelle',
    msg: 'Ayrık akışlı lüle kaportalı turbofan içindir: çıplak motorda baypas akışı karıştırılır.',
    knobs: ['fan.bypassRatio'],
  },
  {
    id: 'nozzle.stubNeeded',
    group: 'nozzle',
    test: (g) => facts(g).freeTurbine && facts(g).noz!.style !== 'stub',
    msg: 'Pervaneli ya da çıkış milli motorun egzozu kısa bir borudur: gücün çoğu pervaneye ya da çıkış miline gider.',
  },
  {
    id: 'nozzle.chevron',
    group: 'nozzle',
    test: (g) => !!facts(g).noz!.chevrons && facts(g).noz!.style !== 'separate',
    msg: 'Chevron’lar şimdilik ayrık akışlı turbofan lülelerinde.',
    knobs: ['nozzle.chevrons.core', 'nozzle.chevrons.bypass'],
  },
  {
    id: 'nozzle.stubUse',
    group: 'nozzle',
    test: (g) => facts(g).noz!.style === 'stub' && !facts(g).freeTurbine,
    msg: 'Kısa egzoz borusu yalnız pervaneli ya da çıkış milli motorda: jet motoru itkisini lüleden alır.',
  },
  {
    id: 'nozzle.variableNeedsAb',
    group: 'nozzle',
    test: (g) => !facts(g).ab && (facts(g).noz!.style === 'cd' || facts(g).noz!.style === 'convergent'),
    msg: 'Art yakıcısız motor sabit yakınsak lüle kullanır: değişken kesit yalnız art yakıcı yanarken gerekir.',
  },
  {
    id: 'nozzle.fixedWithAb',
    group: 'nozzle',
    test: (g) => facts(g).ab && facts(g).noz!.style === 'fixed',
    msg: 'Art yakıcı değişken kesitli lüle ister: yanınca jet hacmi ~2 katına çıkar, lüle açılmazsa fan surge’e girer.',
  },
  {
    id: 'inlet.chin',
    group: 'inlet',
    test: (g) => facts(g).inlet!.style === 'chin' && !facts(g).has('propeller'),
    msg: 'Çene girişi pervaneli motorun dişli kutusunun altındadır.',
  },
  {
    id: 'inlet.annular',
    group: 'inlet',
    test: (g) => facts(g).inlet!.style === 'annular' && !facts(g).has('shaft'),
    msg: 'Halka giriş turboşaftın önden çıkışlı miline yer açar.',
  },
  {
    id: 'inlet.propChin',
    group: 'inlet',
    test: (g) => facts(g).has('propeller') && facts(g).inlet!.style !== 'chin',
    msg: 'Pervaneli motor havayı dişli kutusunun altındaki çene girişinden alır.',
  },
  {
    id: 'inlet.shaftAnnular',
    group: 'inlet',
    test: (g) => facts(g).has('shaft') && facts(g).inlet!.style !== 'annular',
    msg: 'Önden çıkışlı mil girişin ortasından geçer: turboşaft halka giriş ister.',
  },
  {
    id: 'inlet.nacelle',
    group: 'inlet',
    test: (g) => {
      const f = facts(g);
      if (f.inlet!.style !== 'nacelle') return false;
      const style = f.noz!.style;
      return !(f.fan && f.bpr >= 1 && !f.ab && (style === 'separate' || (f.has('mixer') && style === 'fixed')));
    },
    msg: 'Kaportalı yerleşim fanlı motor içindir (BPR ≥ 1): ya ayrık lüleli ya da uzun kanallı karışık akışlı olur; art yakıcılı kaportalı motor yok.',
    knobs: ['fan.bypassRatio'],
  },
  {
    id: 'inlet.nacelleBooster',
    group: 'lpc',
    test: (g) => facts(g).inlet!.style === 'nacelle' && !facts(g).has('lpc'),
    msg: 'Kaportalı turbofan şimdilik booster (LPC) ister.',
  },
  {
    id: 'hpc.centrifugalNeeded',
    group: 'hpc',
    test: (g) => facts(g).freeTurbine && !facts(g).hpc!.centrifugal,
    msg: 'Serbest türbinli gaz jeneratörü şimdilik santrifüj son kademe ister.',
  },
  {
    id: 'hpc.centrifugalOnly',
    group: 'hpc',
    test: (g) => !!facts(g).hpc!.centrifugal && !facts(g).freeTurbine,
    msg: 'Santrifüj son kademe şimdilik serbest türbinli motorlarda.',
  },
  {
    id: 'hpc.centrifugalFraction',
    group: 'hpc',
    test: (g) => {
      const c = facts(g).hpc!.centrifugal;
      return !!c && !(c.workFraction > 0 && c.workFraction < 1);
    },
    msg: 'Santrifüj kademenin iş payı 0 ile 1 arasında olmalı.',
    knobs: ['hpc.centrifugal.workFraction'],
  },
  {
    id: 'combustor.cans',
    group: 'combustor',
    test: (g) => {
      const c = facts(g).comb!;
      if (c.style === 'annular') return false;
      const n = c.cans;
      return !(n !== undefined && Number.isInteger(n) && n >= 6 && n <= 16);
    },
    msg: 'Kutu ve kutu-halka yanma odası 6–16 kutu ister.',
    knobs: ['combustor.cans'],
  },
  {
    id: 'shaft.rear',
    group: 'shaft',
    test: (g) => facts(g).shaft?.drive === 'rear',
    msg: "Arkadan çıkışlı mil M5b'de.",
  },
  {
    id: 'bare.bpr',
    group: 'fan',
    test: (g) => layoutStyleOf(g) === 'bare' && facts(g).bpr > 1.5,
    msg: 'Çıplak karışık akışlı motor düşük baypas içindir (BPR ≤ 1,5); yüksek baypas kaporta ister.',
    knobs: ['fan.bypassRatio'],
  },
  {
    id: 'mixer.lobes',
    group: 'mixer',
    test: (g) => facts(g).mixer?.style === 'lobed' && !((facts(g).mixer!.lobes ?? 0) >= 6),
    msg: "Lobe'lu karıştırıcı en az 6 lobe ister.",
    knobs: ['mixer.lobes'],
  },
];

/** İlk kural ihlali (yoksa null) */
export function checkGraph(g: EngineGraph): GraphError | null {
  active = { g, f: facts(g) };
  try {
    for (const r of GRAPH_RULES) {
      if (r.test(g)) return new GraphError(r.detail ? r.detail(g) : r.msg, r.id, r.group, [...(r.knobs ?? [])]);
    }
    return null;
  } finally {
    active = null;
  }
}

/** Kuralları denetler; ilk ihlalde öğretici bir mesajla GraphError atar. */
export function validateGraph(g: EngineGraph): void {
  const e = checkGraph(g);
  if (e) throw e;
}

function mod<T extends EngineModule>(g: EngineGraph, type: T['type']): T | undefined {
  return g.modules.find((m) => m.type === type) as T | undefined;
}

/* ------------------------------------------------------------------ */
/* Termodinamik tasarım                                                */
/* ------------------------------------------------------------------ */

/**
 * Termodinamik tasarım. Simülasyonda LP milinin ilk kompresörü "fan"dır:
 * fan yoksa LPC fan yerine geçer (baypassız iki milli turbojet).
 * Çalışabilirlik `g.ops`'tan (yoksa referans aileden, operability.ts).
 */
export function toEngineDesign(g: EngineGraph, opts: Pick<BuildOptions, 'reference'> = {}): EngineDesign {
  validateGraph(g);
  const traits = deriveTraits(g);
  const ops = resolveOperability(g, opts.reference);
  const fan = mod<CompressorModule>(g, 'fan');
  const lpc = mod<CompressorModule>(g, 'lpc');
  const hpc = mod<CompressorModule>(g, 'hpc')!;
  const comb = mod<CombustorModule>(g, 'combustor')!;
  const hpt = mod<TurbineModule>(g, 'hpt')!;
  const lpt = mod<TurbineModule>(g, 'lpt')!;
  const mixer = mod<MixerModule>(g, 'mixer');
  const ab = mod<AfterburnerModule>(g, 'afterburner');
  const noz = mod<NozzleModule>(g, 'nozzle')!;
  const prop = mod<PropellerModule>(g, 'propeller');
  const shaft = mod<ShaftModule>(g, 'shaft');
  // Simülasyonda LP milinin ilk kompresörü "fan"dır; serbest türbinli motorda yoktur
  const front = fan ?? lpc;
  const booster = fan ? lpc : undefined;
  return {
    kind: traits.presentation,
    name: g.name,
    summary: g.summary,
    massFlow: g.massFlow,
    bypassRatio: fan?.bypassRatio ?? 0,
    fanPR: front?.pr ?? 1,
    fanHubPRFraction: fan?.hubPRFraction ?? 1,
    boosterPR: booster?.pr ?? 1,
    hpcPR: hpc.pr,
    tit: comb.tit,
    eff: {
      fan: front?.eff ?? 0.9,
      booster: booster?.eff ?? 0.9,
      hpc: hpc.eff,
      hpt: hpt.eff,
      lpt: lpt.eff,
      combustor: comb.eff,
      mech: g.mechEff,
    },
    combustorDP: comb.dp,
    bypassDuctDP: g.bypassDuct?.dp ?? 0,
    // Chevron'lu her lüle itki katsayısından küçük bir pay götürür
    nozzleCv: noz.cv * (1 - CHEVRON_CV_LOSS * (((noz.chevrons?.core ?? 0) > 0 ? 1 : 0) + ((noz.chevrons?.bypass ?? 0) > 0 ? 1 : 0))),
    // Geometriden gelir (buildEngine doldurur)
    n1Rpm: 10000,
    n2Rpm: 10000,
    fanDiameter: 1,
    fanBlades: 20,
    inertia: ops.inertia,
    accessoryPower: resolveAccessoryPower(g, opts.reference),
    hpcMap: ops.hpcMap,
    limits: ops.limits,
    start: ops.start,
    afterburner: ab
      ? {
          t7Max: ab.t7Max,
          eta: ab.eta,
          dpDry: ab.dpDry,
          dpLit: ab.dpLit,
          mixerLoss: mixer?.loss ?? 0,
          mixingEff: mixer ? MIXING_EFF[mixer.style ?? 'confluent'] : undefined,
        }
      : undefined,
    prop: prop
      ? {
          diameter: prop.diameter,
          blades: prop.blades,
          rpm: prop.rpm,
          figureOfMerit: prop.figureOfMerit,
          efficiency: prop.efficiency,
          nozzlePR: noz.pressureRatio ?? 1.1,
        }
      : undefined,
    // Art yakıcısız karışık akış (art yakıcılıda karışma afterburner'da)
    mixer: mixer && !ab ? { loss: mixer.loss, mixingEff: MIXING_EFF[mixer.style ?? 'confluent'] } : undefined,
    shaft: shaft ? { rpm: shaft.rpm, nozzlePR: noz.pressureRatio ?? 1.1, transmissionEff: shaft.transmissionEff } : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* İnşa                                                                */
/* ------------------------------------------------------------------ */

export interface BuiltEngine {
  design: EngineDesign;
  sized: SizedEngine;
  flowpath: Flowpath;
  traits: EngineTraits;
  /** 'r' + fnv1a64(canonicalJson(graph)) — aynı tipte yeni tasarımı ayırt eder */
  rev: string;
  graph: EngineGraph;
}

/** Grafik mi üretilmiş motor mu (App.applyDesign ikisini de alır) */
export const isBuiltEngine = (x: EngineGraph | BuiltEngine): x is BuiltEngine => 'design' in x && 'flowpath' in x && 'rev' in x;

export interface BuildOptions {
  /** Ailenin şablonu: çalışabilirlik bundan ölçeklenir (operability.ts). Verilmezse g.ops aynen. */
  reference?: BuiltEngine;
  /** Kademe histerezisi: önceki gaz yolunun kademe sayılarını eşikte korur */
  previous?: GasPath;
  /** Varsayılan 0 (şablonlar, testler); atölye sürüklemede 0,03 */
  stageHysteresis?: number;
}

/** Grafikten boyutlandırılmış motor ve geometrisi. Geçersizse tipli hata atar. */
export function buildEngine(g: EngineGraph, opts: BuildOptions = {}): BuiltEngine {
  const cycle = toEngineDesign(g, opts);
  // Hazır olmayan yerleşimde boyutlandırmadan önce tipli hata
  assertLayoutReady(g);
  const traits = deriveTraits(g);
  const sized0 = sizeEngine(cycle);
  const flowpath = computeFlowpath(g, sized0, { previous: opts.previous, stageHysteresis: opts.stageHysteresis });
  const ops = opts.reference
    ? deriveOperability(g, { sized: sized0, flowpath, traits, graph: g }, opts.reference, opsOf(opts.reference.design))
    : undefined;
  // Serbest türbinli motorda "fan" pervanedir (ses ve EICAS bunu kullanır);
  // turboşaftta önden görünen kademe HPC'dir
  const prop = mod<PropellerModule>(g, 'propeller');
  const design: EngineDesign = {
    ...cycle,
    ...(ops ?? {}),
    n1Rpm: flowpath.rpm.lp,
    n2Rpm: flowpath.rpm.hp,
    fanDiameter: flowpath.metrics.diameter,
    fanBlades: prop ? prop.blades : (flowpath.gas.front ?? flowpath.gas.hpc).blades[0],
    // Turboşaft: çıkış devri yerleşimden (redüktörsüzde güç türbini devri)
    ...(cycle.shaft && flowpath.layout.style === 'turboshaft' ? { shaft: { ...cycle.shaft, rpm: flowpath.layout.output.rpm } } : {}),
  };
  return { design, sized: sizeEngine(design), flowpath, traits, rev: graphRev(g), graph: g };
}
