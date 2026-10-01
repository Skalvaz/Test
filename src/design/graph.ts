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
import type {
  AfterburnerModule,
  CombustorModule,
  CompressorModule,
  EngineGraph,
  EngineModule,
  MixerModule,
  NozzleModule,
  TurbineModule,
} from './types';

export class GraphError extends Error {}

/** Akış yönünde modül sırası (aynı sırada birden çok modül olamaz) */
const ORDER: EngineModule['type'][] = ['inlet', 'fan', 'lpc', 'hpc', 'combustor', 'hpt', 'lpt', 'mixer', 'afterburner', 'nozzle'];

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
  if (!has('fan') && !has('lpc')) throw new GraphError('LP milini çevirecek bir fan ya da alçak basınç kompresörü gerekli.');
  const fan = g.modules.find((m) => m.type === 'fan') as CompressorModule | undefined;
  const bpr = fan?.bypassRatio ?? 0;
  if (has('mixer') && bpr <= 0) throw new GraphError('Karıştırıcı baypas akışı ister: fanın baypas oranı sıfır.');
  if (bpr > 0 && !has('mixer')) throw new GraphError('Ayrık akışlı (karıştırıcısız) baypas lülesi M4b ile gelecek.');
  if (has('afterburner') && bpr > 0 && !has('mixer')) {
    throw new GraphError('Art yakıcı tek bir jet borusu ister: baypas akışı önce karıştırılmalı.');
  }
  const ab = g.modules.find((m) => m.type === 'afterburner');
  const noz = g.modules.find((m) => m.type === 'nozzle') as NozzleModule | undefined;
  if (!ab && noz?.style === 'cd') throw new GraphError('Yakınsak-ıraksak lüle M4a\'da yalnız art yakıcıyla (değişken kesit) birlikte.');
  if (!ab) throw new GraphError('Art yakıcısız çıplak motor M4b ile gelecek.');
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
  const front = (fan ?? lpc)!;
  const booster = fan ? lpc : undefined;
  return {
    kind: g.kind,
    name: g.name,
    summary: g.summary,
    massFlow: g.massFlow,
    bypassRatio: fan?.bypassRatio ?? 0,
    fanPR: front.pr,
    fanHubPRFraction: fan?.hubPRFraction ?? 1,
    boosterPR: booster?.pr ?? 1,
    hpcPR: hpc.pr,
    tit: comb.tit,
    eff: {
      fan: front.eff,
      booster: booster?.eff ?? 0.9,
      hpc: hpc.eff,
      hpt: hpt.eff,
      lpt: lpt.eff,
      combustor: comb.eff,
      mech: g.mechEff,
    },
    combustorDP: comb.dp,
    bypassDuctDP: g.bypassDuct?.dp ?? 0,
    nozzleCv: noz.cv,
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
      ? { t7Max: ab.t7Max, eta: ab.eta, dpDry: ab.dpDry, dpLit: ab.dpLit, mixerLoss: mixer?.loss ?? 0 }
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
  const lpc = flowpath.layout.gas.lpc;
  const design: EngineDesign = {
    ...cycle,
    n1Rpm: flowpath.rpm.lp,
    n2Rpm: flowpath.rpm.hp,
    fanDiameter: 2 * lpc.tip[0],
    fanBlades: lpc.blades[0],
  };
  return { design, sized: sizeEngine(design), flowpath };
}
