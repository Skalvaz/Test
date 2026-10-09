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
 * Gaz jeneratörü. `lpShaftZ0`: LP milinin ön ucu (turbopropta redüktör
 * güneş dişlisi, turboşaftta çıkış flanşı).
 */
export function gasGeneratorLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath, lpShaftZ0: number): GasGeneratorLayout {
  const noz = moduleOf<NozzleModule>(graph, 'nozzle')!;
  const { hpc, hpt, lpt, combustor: cb } = gp;
  const cen = gp.centrifugal;
  if (!cen) throw new FlowpathError('Serbest türbinli gaz jeneratörü şimdilik santrifüj son kademe ister.', 'hpc.centrifugalNeeded', 'hpc');
  const rd = cen.rd;
  // Egzoz borusu ağzı: güç türbini çıkışı (istasyon 5), ağız Mach'ında
  const exitR = Math.sqrt(annulusArea(sized.point.stations['5'], noz.exitMach ?? 0.3, GAS) / Math.PI);
  const exhaust = {
    z0: lpt.z1 + 0.08,
    z1: lpt.z1 + 0.72,
    r0: lpt.tip[1] + 0.04,
    radius: exitR,
    coneR: lpt.hub[1],
    coneZ1: lpt.z1 + 0.52,
  };
  const casePts: [number, number][] = [
    [hpc.tip[0] + 0.1, hpc.z0 - 0.12],
    [hpc.tip[0] + 0.12, hpc.z0 + 0.12],
    [hpc.tip[1] + 0.13, hpc.z1],
    [rd + 0.1, cen.z + 0.04],
    [cb.rOut + 0.11, cb.z1 - 0.06],
    [hpt.tip[0] + 0.11, hpt.z0 + 0.06],
    [lpt.tip[1] + 0.06, lpt.z1 + 0.1],
  ];
  const shafts = { lp: [lpShaftZ0, lpt.z1 + 0.05, gp.shafts.lp] as [number, number, number], hp: [hpc.z0 - 0.06, hpt.z1 + 0.04, gp.shafts.hp] as [number, number, number] };
  return {
    gas: {
      hpc,
      centrifugal: cen,
      combustor: cb,
      hpt,
      lpt,
      casing: [
        [hpc.tip[0] + 0.01, hpc.z0 - 0.06],
        [hpc.tip[1] + 0.01, hpc.z1],
        [rd + 0.02, cen.z + 0.09],
        [cb.rOut + 0.02, cb.z1 - 0.01],
        [hpt.tip[0] + 0.01, hpt.z0],
        [lpt.tip[1] + 0.01, lpt.z1 + 0.05],
      ],
      shafts,
    },
    case: casePts,
    engineR: Math.max(...casePts.map((p) => p[0])) + 0.05,
    shafts,
    exhaust,
  };
}
