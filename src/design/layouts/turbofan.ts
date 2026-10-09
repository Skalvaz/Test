/**
 * Kaportalı turbofan yerleşimi (yüksek baypas, ayrık akış). engine/core.js,
 * fan.js, nacelle.js, pylon.js girdisi.
 *
 * READY: ayrık akışlı dal hazır; karışık akışlı (uzun kanallı, ortak lüleli)
 * dal M5a P6'da.
 */

import { AIR } from '../../sim/gas';
import type { SizedEngine } from '../../sim/design';
import type { MountPoint } from '../card';
import {
  FlowpathError,
  RHO,
  SHELL_T,
  envelopeOf,
  moduleOf,
  profileAt,
  shellMass,
  tipMachRel,
  type CombustorGeometry,
  type GasPath,
  type RowGeometry,
} from '../flowpath';
import type { CompressorModule, EngineGraph, NozzleModule } from '../types';
import type { LayoutResult } from './index';

/** Ayrık akışlı dal hazır */
export const READY = true;
/** Karışık akışlı dal: P6 */
export const READY_MIXED = false;

/** M4 öncesi elle modellenmiş turbofanın fan uç yarıçapı: fan/kaporta/pilon şekilleri buna göre ölçeklenir */
export const TF_REF_FAN_TIP = 1.386;
/** Lüle akış katsayıları (etkin / geometrik alan): baypas ve çekirdek */
const CD_BYPASS = 0.89;
const CD_CORE = 0.97;

/** engine/core.js, fan.js, nacelle.js, pylon.js girdisi */
export interface TurbofanLayout {
  style: 'nacelle';
  /** Fan, kaporta ve pilonun ölçeği (fan ucu / M4 öncesi model) */
  s: number;
  fan: RowGeometry;
  booster: RowGeometry;
  hpc: RowGeometry;
  hpt: RowGeometry;
  lpt: RowGeometry;
  combustor: CombustorGeometry;
  shafts: { lp: [number, number, number]; hp: [number, number, number] };
  /** Ayırıcı burnu ve çekirdek kaportası profili [r, z] (lüle başına kadar) */
  splitter: { z: number; r: number };
  coreCowl: [number, number][];
  /** Baypas lülesi ağzı: z, çekirdek kaportası ve kaporta iç duvarı yarıçapları */
  bypassExit: { z: number; rCore: number; rDuct: number };
  /** Çekirdek lülesi: başı ve ağzı; egzoz konisi profili [r, z] */
  coreNozzle: { z0: number; r0: number; z1: number; r1: number };
  plug: [number, number][];
  /** Türbin arka çerçevesi ve egzoz kanalı iç duvarı */
  rearFrame: { z: number; hub: number; tip: number };
  exhaustDuct: [number, number][];
  /** Fan çıkış yönlendiricileri ve çerçeve kolları */
  ogv: { z: number; hub: number; tip: number };
  struts: { z: number; hub: number; tip: number };
  intake: { z: number; radius: number; y: number };
  /** Çekirdek lülesi ağzı (egzoz akışı ve efektler) */
  exhaustExit: { z: number; radius: number };
  /** Lüle arka kenarlarındaki chevron sayıları (0: düz kenar) */
  chevrons: { core: number; bypass: number };
  /** Gövde bağlantıları (motor kartı): fan kasası üstü + türbin arka çerçevesi */
  mounts: MountPoint[];
  /** Dış zarf [z, r], z artan (kaporta + çekirdek kaportası + koni) */
  outerProfile: [number, number][];
}

/**
 * Kaportanın dış profili [r, z]: nacelle.js dudak ve dış kaporta noktaları
 * (fan ucu 1,386 m ölçeğinde, model grubu koordinatı). Arka kısmın baypas
 * ağzına göre kayması (nacelle.js `aft`) P0'da yok sayılır; P6 kesinleştirir.
 */
const NACELLE_OUTER: [number, number][] = [
  [1.512, -2.243],
  [1.672, -2.06],
  [1.742, -1.72],
  [1.784, -1.1],
  [1.755, 0.05],
  [1.638, 1.0],
  [1.516, 1.52],
];

function turbofanLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): TurbofanLayout {
  const noz = moduleOf<NozzleModule>(graph, 'nozzle')!;
  const fan = gp.front;
  const booster = gp.booster;
  const { hpc, hpt, lpt, combustor: cb } = gp;
  if (!fan) throw new FlowpathError('Kaportalı turbofan fan ister.', 'inlet.nacelle', 'fan');
  if (!booster) throw new FlowpathError('Kaportalı turbofan şimdilik booster (LPC) ister.', 'inlet.nacelleBooster', 'lpc');
  const s = fan.tip[0] / TF_REF_FAN_TIP;
  const fanZ = fan.z0;

  // Çekirdek kaportası: iç parçaların zarfı + boşluk (aksesuar, boru, bleed payı)
  const zS = fanZ + 0.3 * s;
  const rS = booster.tip[0] + 0.058;
  const rMax = Math.max(booster.tip[1] + 0.2, hpc.tip[0] + 0.31, cb.rOut + 0.32, lpt.tip[1] + 0.1);
  const zLip = lpt.z1 + 0.52;
  // Egzoz konisi: taban LPT çıkış göbeğinde; M4 öncesi modelin ojiv
  // profili (taban 0,4 m, boy 1,2 m) taban yarıçapıyla orantılı ölçeklenir
  const plugBase = lpt.hub[1] - 0.01;
  const k = plugBase / 0.4;
  const pz0 = lpt.z1 + 0.19;
  const plug: [number, number][] = (
    [
      [1, 0],
      [0.993, 0.11],
      [0.96, 0.26],
      [0.88, 0.45],
      [0.75, 0.66],
      [0.58, 0.855],
      [0.395, 1.015],
      [0.215, 1.125],
      [0.075, 1.182],
      [0, 1.205],
    ] as [number, number][]
  ).map(([r, dz]) => [plugBase * r, pz0 + dz * k]);
  // Çekirdek lülesi ağzı: ağızdaki koni yarıçapının dışında, A9 kadar
  const r1 = Math.sqrt(profileAt(plug, zLip) ** 2 + sized.ref.A9 / CD_CORE / Math.PI);
  const zN0 = lpt.z1 + 0.22;
  const rN0 = Math.max(r1 + 0.065, lpt.tip[1] + 0.05);
  const cowl: [number, number][] = [
    [rS, zS],
    [rS + 0.35 * (rMax - rS), zS + 0.13],
    [rS + 0.75 * (rMax - rS), booster.z1 - 0.1],
    [rMax * 0.99, hpc.z0 + 0.1],
    [rMax, (hpc.z1 + cb.z0) / 2],
    [rMax * 0.985, cb.z1],
    [Math.max(rMax * 0.94, lpt.tip[1] + 0.12), hpt.z1 + 0.1],
    [Math.max(rN0 + 0.05, lpt.tip[1] + 0.08), lpt.z1 - 0.05],
    [rN0, zN0],
  ];
  // Baypas lülesi: kaporta iç duvarı, ağızdaki çekirdek kaportasından A19 kadar dışarıda
  const bz = fanZ + 1.8 * s;
  const rCore = profileAt(cowl, bz);
  const rDuct = Math.sqrt(rCore ** 2 + sized.ref.A19 / CD_BYPASS / Math.PI);
  const ductR = lpt.tip[1] + 0.046;
  const exhaustDuct: [number, number][] = [
    [ductR, lpt.z1 + 0.065],
    [ductR - 0.016, lpt.z1 + 0.15],
    [(ductR + r1) / 2 + 0.01, lpt.z1 + 0.28],
    [r1 + 0.01, lpt.z1 + 0.42],
    [r1, zLip],
  ];
  const ogvZ = fanZ + 0.48 * s;
  const strutZ = booster.z1;
  const rearZ = lpt.z1 + 0.16;

  // Motor kartı alanları (P0 yaklaşık; P6 kesinleştirir)
  const nacOuter = NACELLE_OUTER.map(([r, z]): [number, number] => [r * s, fanZ + 0.28 * s + z * s]);
  const nacEnd = nacOuter[nacOuter.length - 1][1];
  const outerProfile = envelopeOf(
    nacOuter,
    cowl.filter(([, z]) => z > nacEnd),
    plug.filter(([, z]) => z > zN0),
  );
  const mounts: MountPoint[] = [
    { id: 'front', z: fanZ + 0.55 * s, r: profileAt(nacOuter, fanZ + 0.55 * s), angle: 0, type: 'pylon' },
    { id: 'rear', z: rearZ, r: profileAt(cowl, rearZ), angle: 0, type: 'pylon' },
  ];

  return {
    style: 'nacelle',
    s,
    fan,
    booster,
    hpc,
    hpt,
    lpt,
    combustor: cb,
    shafts: {
      lp: [fanZ - 1.27 * s, lpt.z1 + 0.21, gp.shafts.lp],
      hp: [hpc.z0 - 0.13, hpt.z0 - 0.05, gp.shafts.hp],
    },
    splitter: { z: zS, r: rS },
    coreCowl: cowl,
    bypassExit: { z: bz, rCore, rDuct },
    coreNozzle: { z0: zN0, r0: rN0, z1: zLip, r1 },
    plug,
    rearFrame: { z: rearZ, hub: plugBase, tip: ductR },
    exhaustDuct,
    ogv: { z: ogvZ, hub: profileAt(cowl, ogvZ) + 0.014, tip: 1.392 * s },
    struts: { z: strutZ, hub: profileAt(cowl, strutZ) - 0.02, tip: 1.39 * s },
    intake: { z: fanZ - 1.97 * s, radius: 1.1 * s, y: 0 },
    exhaustExit: { z: zLip - 0.01, radius: r1 - 0.09 },
    chevrons: { core: noz.chevrons?.core ?? 0, bypass: noz.chevrons?.bypass ?? 0 },
    mounts,
    outerProfile,
  };
}

/** Kaportalı turbofan: yerleşim + fan, muhafaza, gövde ve egzoz kütlesi + ölçüler */
export function nacelleLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): LayoutResult {
  const L = turbofanLayout(graph, sized, gp);
  const f = L.fan;
  const frontMod = (moduleOf<CompressorModule>(graph, 'fan') ?? moduleOf<CompressorModule>(graph, 'lpc'))!;
  return {
    layout: L,
    shaftLen: { lp: L.shafts.lp[1] - L.shafts.lp[0], hp: L.shafts.hp[1] - L.shafts.hp[0] },
    extra: {
      // Fan: kanatlar + disk (dolu oran düşük: geniş kordlu ama ince kanatlar)
      fan: Math.PI * f.tip[0] ** 2 * f.pitch * 0.055 * RHO.ti,
      // Fan muhafazası (kanat kopması muhafazası, kevlar sargılı)
      fanCase: shellMass(f.tip[0] + 0.06, 0.75 * L.s, 0.012, 2000),
      casing: shellMass(L.hpc.tip[0] + 0.05, L.lpt.z1 - L.hpc.z0, SHELL_T.casing, RHO.ti),
      exhaust:
        shellMass(L.coreNozzle.r0, L.coreNozzle.z1 - L.coreNozzle.z0 + 0.3, 0.004, RHO.ni) +
        shellMass(L.rearFrame.hub, L.plug[L.plug.length - 1][1] - L.plug[0][1], 0.003, RHO.ni),
    },
    diameter: 2 * f.tip[0],
    length: L.plug[L.plug.length - 1][1] - L.intake.z,
    lpTipMach: tipMachRel(sized.point.stations['2'], frontMod.mach[0], f.uTip, AIR),
  };
}
