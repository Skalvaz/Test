/**
 * Modül grafiği → EngineDesign → tasarım noktası → gaz yolu geometrisi.
 *
 * Zincir:
 *   1. validateGraph: modül sırası ve birleşim kuralları
 *   2. toEngineDesign: termodinamik düğmeler (geometri henüz yok)
 *   3. sizeEngine: tasarım noktası istasyonları (sim/design.ts)
 *   4. computeFlowpath: istasyonlardan geometri ve mil devirleri
 *   5. Devir/fan çapı/kanat sayısı tasarıma yazılır, motor yeniden
 *      boyutlandırılır (devir yalnız referans açısal hızları etkiler)
 */

import { sizeEngine, type EngineDesign, type SizedEngine } from '../sim/design';
import { computeFlowpath, type Flowpath } from './flowpath';
import { CHEVRON_CV_LOSS, MIXING_EFF } from './types';
import type {
  AfterburnerModule,
  CombustorModule,
  CompressorModule,
  EngineGraph,
  EngineModule,
  InletModule,
  MixerModule,
  NozzleModule,
  PropellerModule,
  TurbineModule,
} from './types';

export class GraphError extends Error {}

/** Akış yönünde modül sırası (aynı sırada birden çok modül olamaz) */
const ORDER: EngineModule['type'][] = ['propeller', 'inlet', 'fan', 'lpc', 'hpc', 'combustor', 'hpt', 'lpt', 'mixer', 'afterburner', 'nozzle'];

/** Kuralları denetler; ilk ihlalde öğretici bir mesajla GraphError atar. */
export function validateGraph(g: EngineGraph): void {
  const types = g.modules.map((m) => m.type);
  const has = (t: EngineModule['type']) => types.includes(t);
  for (const t of ORDER) {
    if (types.filter((x) => x === t).length > 1) throw new GraphError(`"${t}" modülü birden fazla.`);
  }
  let last = -1;
  for (const t of types) {
    const i = ORDER.indexOf(t);
    if (i < last) throw new GraphError(`Modül sırası yanlış: "${t}" akış yönünde daha önce gelmeli.`);
    last = i;
  }
  for (const t of ['inlet', 'hpc', 'combustor', 'hpt', 'lpt', 'nozzle'] as const) {
    if (!has(t)) throw new GraphError(`Zorunlu modül eksik: "${t}".`);
  }
  const prop = has('propeller');
  if (prop && has('fan')) throw new GraphError('Pervane ile fan aynı motorda olamaz: ikisi de LP milinin işini alır.');
  if (!prop && !has('fan') && !has('lpc')) throw new GraphError('LP milini yükleyecek bir fan, alçak basınç kompresörü ya da pervane gerekli.');
  const fan = g.modules.find((m) => m.type === 'fan') as CompressorModule | undefined;
  const bpr = fan?.bypassRatio ?? 0;
  const ab = has('afterburner');
  const noz = g.modules.find((m) => m.type === 'nozzle') as NozzleModule;
  const inlet = g.modules.find((m) => m.type === 'inlet') as InletModule;
  if (has('mixer') && bpr <= 0) throw new GraphError('Karıştırıcı baypas akışı ister: fanın baypas oranı sıfır.');
  if (ab && bpr > 0 && !has('mixer')) {
    throw new GraphError('Art yakıcı tek bir jet borusu ister: baypas akışı önce karıştırılmalı.');
  }
  if (bpr > 0 && !has('mixer') && noz.style !== 'separate') throw new GraphError('Karıştırılmayan baypas akışı ayrı bir baypas lülesi ister (ayrık akışlı lüle).');
  if (noz.style === 'separate' && (bpr <= 0 || has('mixer'))) throw new GraphError('Ayrık akışlı lüle, karıştırılmayan bir baypas akışı ister.');
  if (prop && noz.style !== 'stub') throw new GraphError('Turboprop egzozu kısa bir borudur: itkinin çoğu pervaneden gelir.');
  if (noz.chevrons && noz.style !== 'separate') throw new GraphError('Chevron’lar şimdilik ayrık akışlı turbofan lülelerinde.');
  if (noz.style === 'stub' && !prop) throw new GraphError('Kısa egzoz borusu yalnız pervaneli motorda: jet motoru itkisini lüleden alır.');
  if ((noz.style === 'cd' || noz.style === 'convergent') && !ab) {
    throw new GraphError('Değişken kesitli lüle şimdilik yalnız art yakıcıyla birlikte.');
  }
  if (inlet.style === 'chin' && !prop) throw new GraphError('Çene girişi pervaneli motorun dişli kutusunun altındadır.');
  if (inlet.style === 'nacelle' && noz.style !== 'separate') throw new GraphError('Kaportalı giriş şimdilik ayrık akışlı turbofanda.');
  if (inlet.style === 'bellmouth' && !ab) throw new GraphError('Art yakıcısız çıplak motor henüz yok.');
  const hpc = g.modules.find((m) => m.type === 'hpc') as CompressorModule;
  const mixer = g.modules.find((m) => m.type === 'mixer') as MixerModule | undefined;
  if (mixer?.style === 'lobed' && !((mixer.lobes ?? 0) >= 6)) throw new GraphError("Lobe'lu karıştırıcı en az 6 lobe ister.");
  if (hpc.centrifugal && (hpc.centrifugal.workFraction <= 0 || hpc.centrifugal.workFraction >= 1)) {
    throw new GraphError('Santrifüj kademenin iş payı 0 ile 1 arasında olmalı.');
  }
}

function mod<T extends EngineModule>(g: EngineGraph, type: T['type']): T | undefined {
  return g.modules.find((m) => m.type === type) as T | undefined;
}

/**
 * Termodinamik tasarım. Simülasyonda LP milinin ilk kompresörü "fan"dır:
 * fan yoksa LPC fan yerine geçer (baypassız iki milli turbojet).
 */
export function toEngineDesign(g: EngineGraph): EngineDesign {
  validateGraph(g);
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
  // Simülasyonda LP milinin ilk kompresörü "fan"dır; pervaneli motorda yoktur
  const front = fan ?? lpc;
  const booster = fan ? lpc : undefined;
  return {
    kind: g.kind,
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
    inertia: { ...g.inertia },
    accessoryPower: g.accessoryPower,
    hpcMap: { ...g.hpcMap },
    limits: { ...g.limits },
    start: { ...g.start },
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
  };
}

export interface BuiltEngine {
  design: EngineDesign;
  sized: SizedEngine;
  flowpath: Flowpath;
}

/** Grafikten boyutlandırılmış motor ve geometrisi */
export function buildEngine(g: EngineGraph): BuiltEngine {
  const cycle = toEngineDesign(g);
  const flowpath = computeFlowpath(g, sizeEngine(cycle));
  // Pervaneli motorda "fan" pervanedir (ses ve EICAS bunu kullanır)
  const prop = mod<PropellerModule>(g, 'propeller');
  const design: EngineDesign = {
    ...cycle,
    n1Rpm: flowpath.rpm.lp,
    n2Rpm: flowpath.rpm.hp,
    fanDiameter: flowpath.metrics.diameter,
    fanBlades: prop ? prop.blades : flowpath.gas.front!.blades[0],
  };
  return { design, sized: sizeEngine(design), flowpath };
}
