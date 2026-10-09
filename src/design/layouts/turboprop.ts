/**
 * Turboprop yerleşimi: pervane + redüksiyon dişli kutusu + ortak gaz
 * jeneratörü (gasgen.ts). engine/turboprop.js girdisi.
 */

import { AIR } from '../../sim/gas';
import type { SizedEngine } from '../../sim/design';
import type { MountPoint } from '../card';
import { PROP_Z, RHO, SHELL_T, envelopeOf, mid, moduleOf, profileAt, shellMass, type GasPath } from '../flowpath';
import type { EngineGraph, PropellerModule } from '../types';
import { gasGeneratorLayout, type GasGeneratorLayout } from './gasgen';
import type { LayoutResult } from './index';

export const READY = true;

/** engine/turboprop.js girdisi */
export interface TurbopropLayout {
  style: 'turboprop';
  prop: { z: number; radius: number; blades: number; gearRatio: number };
  /** Redüksiyon dişli kutusu gövdesinin eksenel uçları */
  gearbox: { z0: number; z1: number };
  /** engine/gaspath.js girdisi */
  gas: GasGeneratorLayout['gas'];
  /** Dış gövde profili [r, z] */
  case: [number, number][];
  /** Jet borusu: başı, ağzı, baş ve ağız yarıçapı; kuyruk konisi */
  exhaust: GasGeneratorLayout['exhaust'];
  /** Test standı askı noktaları (eksenel konum): redüktör arkası ve yanma odası */
  standZ: [number, number];
  engineR: number;
  /** Gövde bağlantıları (motor kartı): redüktör flanşı + arka trunnion */
  mounts: MountPoint[];
  /** Dış zarf [z, r], z artan (spinner + redüktör + gövde + egzoz) */
  outerProfile: [number, number][];
  /** Çene girişi ağzı (pervane altında, y < 0) */
  intake: { z: number; radius: number; y: number };
  exhaustExit: { z: number; radius: number };
}

function turbopropLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): TurbopropLayout {
  const prop = moduleOf<PropellerModule>(graph, 'propeller')!;
  const { hpc } = gp;
  const gg = gasGeneratorLayout(graph, sized, gp, PROP_Z + 0.38);
  const gearbox = { z0: PROP_Z + 0.28, z1: hpc.z0 - 0.1 };
  const standZ: [number, number] = [mid(PROP_Z + 0.28, hpc.z0 - 0.1) + 0.06, gp.combustor.z1 - 0.11];
  // Motor kartı alanları (P0 yaklaşık; P7 kesinleştirir): spinner ve redüktör
  // turboprop.js ölçülerinden
  const outerProfile = envelopeOf(
    [
      [0.002, PROP_Z - 0.54],
      [0.305, PROP_Z - 0.1],
      [0.335, PROP_Z + 0.3],
      [0.33, gearbox.z1],
    ],
    gg.case,
    [[gg.exhaust.r0, gg.exhaust.z1]],
  );
  const mounts: MountPoint[] = [
    { id: 'front', z: standZ[0], r: 0.33, angle: 0, type: 'gearbox' },
    { id: 'rear', z: standZ[1], r: profileAt(gg.case, standZ[1]), angle: 0, type: 'trunnion' },
  ];
  return {
    style: 'turboprop',
    prop: { z: PROP_Z, radius: prop.diameter / 2, blades: prop.blades, gearRatio: gp.omega.lp / ((prop.rpm * 2 * Math.PI) / 60) },
    gearbox,
    gas: gg.gas,
    case: gg.case,
    exhaust: gg.exhaust,
    standZ,
    engineR: gg.engineR,
    mounts,
    outerProfile,
    // turboprop.js modeliyle aynı: HPC girişinin 0,9 m önünde, pervane altında
    intake: { z: hpc.z0 - 0.9, radius: 0.2, y: -0.62 },
    exhaustExit: { z: gg.exhaust.z1, radius: gg.exhaust.radius },
  };
}

/** Turboprop: yerleşim + gövde, redüktör, pervane, egzoz kütlesi + ölçüler */
export function turbopropLayoutFn(graph: EngineGraph, sized: SizedEngine, gp: GasPath): LayoutResult {
  const L = turbopropLayout(graph, sized, gp);
  const prop = moduleOf<PropellerModule>(graph, 'propeller')!;
  // Redüktör kütlesi pervane torkuyla (≈ 8,5 kg / kN·m), kompozit pervane ≈ 14 kg/m² × D²
  const propOmega = (prop.rpm * 2 * Math.PI) / 60;
  const propTorque = (sized.ref.shaftPower / propOmega) * 1e-3;
  return {
    layout: L,
    shaftLen: { lp: L.gas.shafts.lp[1] - L.gas.shafts.lp[0], hp: L.gas.shafts.hp[1] - L.gas.shafts.hp[0] },
    extra: {
      casing: shellMass(L.engineR - 0.05, L.case[L.case.length - 1][1] - L.case[0][1], SHELL_T.casing, RHO.steel),
      gearbox: 8.5 * propTorque,
      propeller: 14 * prop.diameter ** 2,
      exhaust: shellMass(L.exhaust.r0, L.exhaust.z1 - L.exhaust.z0, 0.002, RHO.ni),
    },
    diameter: prop.diameter,
    length: L.exhaust.z1 - (PROP_Z - 0.54),
    // Durağan pervane ucu Mach'ı
    lpTipMach: (propOmega * L.prop.radius) / Math.sqrt(AIR.gamma * AIR.R * sized.point.stations['0'].T),
  };
}
