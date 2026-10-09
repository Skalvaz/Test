/**
 * Serbest türbinli motorların ortak gaz jeneratörü yerleşimi (turboprop ve
 * turboşaft): eksenel + santrifüj HPC, yanma odası, HPT, serbest güç
 * türbini, gövde ve kısa egzoz borusu. engine/gaspath.js girdisi `gas`.
 */

import { GAS } from '../../sim/gas';
import type { SizedEngine } from '../../sim/design';
import { FlowpathError, annulusArea, moduleOf, type CentrifugalGeometry, type CombustorGeometry, type GasPath, type RowGeometry } from '../flowpath';
import type { EngineGraph, NozzleModule } from '../types';

export const READY = true;

export interface GasGeneratorLayout {
  /** engine/gaspath.js girdisi */
  gas: {
    hpc: RowGeometry;
    centrifugal: CentrifugalGeometry;
    combustor: CombustorGeometry;
    hpt: RowGeometry;
    lpt: RowGeometry;
    casing: [number, number][];
    shafts: { lp: [number, number, number]; hp: [number, number, number] };
  };
  /** Dış gövde profili [r, z] */
  case: [number, number][];
  /** Gövdenin en büyük yarıçapı + pay (stand askısı) */
  engineR: number;
  /** Mil uçları ve yarıçapları (= gas.shafts) */
  shafts: { lp: [number, number, number]; hp: [number, number, number] };
  /** Jet borusu: başı, ağzı, baş ve ağız yarıçapı; kuyruk konisi */
  exhaust: { z0: number; z1: number; r0: number; radius: number; coneR: number; coneZ1: number };
}

/**
 * Ölçek çapası: turboprop şablonunun HPC göz (ilk kademe uç) yarıçapı [m].
 * Gövde payları, flanş ve egzoz boyları bu motorda elle ölçülmüş metre
 * değerleridir; başka boyutta gaz jeneratörü (turboşaft) bunları göz
 * yarıçapı oranında ölçekler (`gasGenScale`). Turbopropta ölçek 1: yerleşim
 * ve altın sayılar değişmez.
 */
export const TP_EYE_R = 0.1513;

/** Gaz jeneratörünün sabit ölçülerinin ölçeği (HPC göz yarıçapı / turboprop şablonununki) */
export const gasGenScale = (gp: GasPath) => gp.hpc.tip[0] / TP_EYE_R;

/** Gaz jeneratörü seçenekleri (turbopropta ikisi de 1) */
export interface GasGenOptions {
  /** Sabit payların ölçeği (varsayılan 1: turboprop) */
  k?: number;
  /** Egzoz borusu boyu katı (varsayılan 1) */
  exhaustLength?: number;
  /** Gövde ön ucunun en küçük z'si (turboşaftta halka giriş ağzı: gövde ağzın önüne taşmaz) */
  caseZ0Min?: number;
}

/**
 * Gaz jeneratörü. `lpShaftZ0`: LP milinin ön ucu (turbopropta redüktör
 * güneş dişlisi, turboşaftta çıkış flanşı).
 */
export function gasGeneratorLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath, lpShaftZ0: number, o: GasGenOptions = {}): GasGeneratorLayout {
  const noz = moduleOf<NozzleModule>(graph, 'nozzle')!;
  const { hpc, hpt, lpt, combustor: cb } = gp;
  const cen = gp.centrifugal;
  if (!cen) throw new FlowpathError('Serbest türbinli gaz jeneratörü şimdilik santrifüj son kademe ister.', 'hpc.centrifugalNeeded', 'hpc');
  const rd = cen.rd;
  // k = 1'de çarpımlar birebir (turboprop bayt düzeyinde aynı kalır)
  const k = o.k ?? 1;
  const ek = k * (o.exhaustLength ?? 1);
  // Egzoz borusu ağzı: güç türbini çıkışı (istasyon 5), ağız Mach'ında
  const exitR = Math.sqrt(annulusArea(sized.point.stations['5'], noz.exitMach ?? 0.3, GAS) / Math.PI);
  const exhaust = {
    z0: lpt.z1 + 0.08 * k,
    z1: lpt.z1 + 0.72 * ek,
    r0: lpt.tip[1] + 0.04 * k,
    radius: exitR,
    coneR: lpt.hub[1],
    coneZ1: lpt.z1 + 0.52 * ek,
  };
  const casePts: [number, number][] = [
    [hpc.tip[0] + 0.1 * k, hpc.z0 - 0.12 * k],
    [hpc.tip[0] + 0.12 * k, hpc.z0 + 0.12 * k],
    [hpc.tip[1] + 0.13 * k, hpc.z1],
    [rd + 0.1 * k, cen.z + 0.04 * k],
    [cb.rOut + 0.11 * k, cb.z1 - 0.06 * k],
    [hpt.tip[0] + 0.11 * k, hpt.z0 + 0.06 * k],
    [lpt.tip[1] + 0.06 * k, lpt.z1 + 0.1 * k],
  ];
  if (o.caseZ0Min !== undefined) {
    // Ön uç ağza kırpılır; ikinci nokta en az 2 cm·k arkada kalır (profil z artan)
    casePts[0][1] = Math.max(casePts[0][1], o.caseZ0Min);
    casePts[1][1] = Math.max(casePts[1][1], casePts[0][1] + 0.02 * k);
  }
  const shafts = {
    lp: [lpShaftZ0, lpt.z1 + 0.05 * k, gp.shafts.lp] as [number, number, number],
    hp: [hpc.z0 - 0.06 * k, hpt.z1 + 0.04 * k, gp.shafts.hp] as [number, number, number],
  };
  return {
    gas: {
      hpc,
      centrifugal: cen,
      combustor: cb,
      hpt,
      lpt,
      casing: [
        [hpc.tip[0] + 0.01 * k, hpc.z0 - 0.06 * k],
        [hpc.tip[1] + 0.01 * k, hpc.z1],
        [rd + 0.02 * k, cen.z + 0.09 * k],
        [cb.rOut + 0.02 * k, cb.z1 - 0.01 * k],
        [hpt.tip[0] + 0.01 * k, hpt.z0],
        [lpt.tip[1] + 0.01 * k, lpt.z1 + 0.05 * k],
      ],
      shafts,
    },
    case: casePts,
    engineR: Math.max(...casePts.map((p) => p[0])) + 0.05 * k,
    shafts,
    exhaust,
  };
}
