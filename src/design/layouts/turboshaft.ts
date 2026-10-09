/**
 * Turboşaft yerleşimi (M5a P7): önden çıkışlı mil ve flanşı, halka giriş
 * (+ entegre parçacık ayırıcı), isteğe bağlı redüktör ve ortak gaz
 * jeneratörü (gasgen.ts). engine/turboshaft.js girdisi.
 *
 * Eksenel sıra (−z → +z): çıkış flanşı (SHAFT_Z) → mil gövdesi
 * (shaft.gearboxLength) → halka giriş çerçevesi (inlet.length × HPC uç
 * yarıçapı) → HPC eksenel kademeleri + çark → yanma odası → HPT → serbest
 * güç türbini → kısa egzoz borusu. T700 sınıfında güç türbini milin
 * içinden öne, çıkış flanşına uzanır.
 */

import { AIR } from '../../sim/gas';
import type { SizedEngine } from '../../sim/design';
import type { MountPoint } from '../card';
import { RHO, SHAFT_Z, SHELL_T, annulusArea, envelopeOf, moduleOf, profileAt, shellMass, type GasPath } from '../flowpath';
import type { EngineGraph, InletModule, ShaftModule } from '../types';
import { gasGenScale, gasGeneratorLayout, type GasGeneratorLayout } from './gasgen';
import type { LayoutResult } from './index';

export const READY = true;

/** Halka giriş ağzındaki eksenel Mach: ağız alanı giriş akışından */
export const INLET_MACH = 0.32;

/** Redüktörsüz sayılan devir farkı: |ω_güç türbini / ω_çıkış − 1| bunun altındaysa doğrudan tahrik */
export const DIRECT_DRIVE_TOL = 0.05;

/** Çıkış mili yarıçapı katsayısı [m / (N·m)^(1/3)]: LP mili ile aynı (flowpath.ts computeGasPath) */
const OUTPUT_SHAFT_K = 0.00305;

/** Redüktör kütlesi tork başına [kg / (kN·m)] (turboprop ile aynı bağıntı) */
const GEARBOX_KG_PER_KNM = 8.5;

/** Turboşaft egzoz borusu boyu (turbopropunkine göre, ölçekli): T700'ün egzozu kısa */
const EXHAUST_LENGTH = 0.55;

export interface TurboshaftLayout {
  style: 'turboshaft';
  gg: GasGeneratorLayout;
  /** Halka giriş çerçevesi (ön çerçeve, girdap kanatları, ayırıcı) */
  inlet: { z0: number; z1: number; rOuter: number; rInner: number; separator: boolean };
  /**
   * Çıkış mili: flanş düzlemi, mil yarıçapı, flanş yarıçapı, çıkış devri,
   * güç türbini / çıkış devir oranı. `reduction`: redüktör takılı mı
   * (grafikte istenmiş ya da devirler %5'ten çok farklı).
   */
  output: { z: number; radius: number; flangeR: number; rpm: number; gearRatio: number; reduction: boolean };
  /** Mil gövdesi (flanşın arkası → giriş merkez gövdesi) ve redüktör kutusu (varsa) */
  housing: { z0: number; z1: number; r: number; gearboxR: number };
  /** Sabit ölçülerin ölçeği (HPC göz yarıçapı / turboprop şablonununki) */
  k: number;
  /** Test standı askı noktaları (eksenel konum): ön çerçeve ve yanma odası arkası */
  standZ: [number, number];
  /** Gövdenin en büyük yarıçapı + pay (stand askısı) */
  engineR: number;
  intake: { z: number; radius: number; y: 0 };
  exhaustExit: { z: number; radius: number };
  /** Gövde bağlantıları: çıkış flanşı + ön ve arka trunnion */
  mounts: MountPoint[];
  /** Dış zarf [z, r], z artan */
  outerProfile: [number, number][];
}

function turboshaftGeometry(graph: EngineGraph, sized: SizedEngine, gp: GasPath): TurboshaftLayout {
  const shaft = moduleOf<ShaftModule>(graph, 'shaft')!;
  const inletMod = moduleOf<InletModule>(graph, 'inlet')!;
  const { hpc } = gp;
  const k = gasGenScale(gp);
  const gg = gasGeneratorLayout(graph, sized, gp, SHAFT_Z, { k, exhaustLength: EXHAUST_LENGTH });

  // Çıkış mili: yarıçap torkun küp kökü ile (P çıkış gücü, ω çıkış devri)
  const wOut = (shaft.rpm * 2 * Math.PI) / 60;
  const torque = Math.max(sized.ref.outputPower, 1) / wOut;
  const radius = OUTPUT_SHAFT_K * Math.cbrt(torque);
  const gearRatio = gp.omega.lp / wOut;
  const reduction = shaft.reduction || Math.abs(gearRatio - 1) > DIRECT_DRIVE_TOL;
  const flangeR = 2.6 * radius + 0.012 * k;

  // Halka giriş: merkez gövde HPC göbeğinden biraz büyük (mil gövdesini
  // sarar); dış yarıçap ağız alanından (giriş akışı, INLET_MACH)
  const z0 = SHAFT_Z + shaft.gearboxLength;
  const z1 = Math.max(hpc.z0, z0 + 0.04 * k);
  // Mil gövdesi önce: redüktör varsa planet takımını alacak kadar şişkin;
  // halka giriş merkez gövdesi onu sarar (Makila gibi ağız dışa kayar)
  const housingR = Math.max(radius * 1.9, flangeR * 0.85);
  const gearboxR = reduction ? housingR * 1.9 : housingR;
  const rInner = Math.max(hpc.hub[0] * 1.05, flangeR * 1.15, gearboxR * 1.05);
  const area = annulusArea(sized.point.stations['2'], INLET_MACH, AIR);
  const rOuter = Math.sqrt(area / Math.PI + rInner * rInner);
  const inlet = { z0, z1, rOuter, rInner, separator: inletMod.separator ?? false };

  // Mil gövdesi: flanşın hemen arkasından merkez gövdeye
  const housing = { z0: SHAFT_Z + 0.03 * k, z1: z0, r: housingR, gearboxR };

  // Askı noktaları: santrifüj difüzör gövdesi (en geniş yer) ve egzoz
  // çerçevesi; üstte aksesuar dişli kutusu olduğundan giriş çerçevesine değil
  const standZ: [number, number] = [gp.centrifugal!.z + 0.04 * k, gp.lpt.z1 + 0.05 * k];
  // Giriş çerçevesinin dış kasası (ayırıcı salyangozu dahil) gövdeden geniş olabilir
  const frameR = rOuter + 0.035 * k + (inlet.separator ? 0.03 * k : 0);
  const engineR = Math.max(gg.engineR, frameR + 0.05 * k);
  const outerProfile = envelopeOf(
    [
      [flangeR, SHAFT_Z],
      [housing.gearboxR, housing.z0 + 0.02 * k],
      [housing.gearboxR, z0 - 0.01 * k],
      [frameR, z0],
      [frameR, z1],
    ],
    gg.case,
    [[gg.exhaust.r0, gg.exhaust.z1]],
  );
  const mounts: MountPoint[] = [
    { id: 'output', z: SHAFT_Z, r: flangeR, angle: 0, type: 'flange' },
    { id: 'front', z: standZ[0], r: profileAt(gg.case, standZ[0]), angle: 0, type: 'trunnion' },
    { id: 'rear', z: standZ[1], r: profileAt(gg.case, standZ[1]), angle: 0, type: 'trunnion' },
  ];
  return {
    style: 'turboshaft',
    gg,
    inlet,
    output: { z: SHAFT_Z, radius, flangeR, rpm: shaft.rpm, gearRatio, reduction },
    housing,
    k,
    standZ,
    engineR,
    intake: { z: z0, radius: rOuter, y: 0 },
    exhaustExit: { z: gg.exhaust.z1, radius: gg.exhaust.radius },
    mounts,
    outerProfile,
  };
}

/** Turboşaft: yerleşim + gövde, giriş, çıkış mili, (redüktör), egzoz kütlesi + ölçüler */
export function turboshaftLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): LayoutResult {
  const L = turboshaftGeometry(graph, sized, gp);
  const { gg, inlet, output, housing } = L;
  const k = L.k;
  const wOut = (output.rpm * 2 * Math.PI) / 60;
  const torqueKNm = (Math.max(sized.ref.outputPower, 0) / wOut) * 1e-3;
  const inletLen = inlet.z1 - inlet.z0;
  const extra: Record<string, number> = {
    // Gaz jeneratörü gövdesi (turboprop ile aynı bağıntı)
    casing: shellMass(gg.engineR - 0.05 * k, gg.case[gg.case.length - 1][1] - gg.case[0][1], SHELL_T.casing, RHO.steel),
    // Ön çerçeve: dış ve iç (merkez gövde) cidar, girdap kanatları ve
    // ayırıcı salyangozu (dökme çelik/titanyum; kanatlar ≈ cidarların %30'u)
    inlet:
      1.3 *
      (shellMass(inlet.rOuter + 0.035 * k, inletLen, SHELL_T.casing, RHO.steel) +
        shellMass(inlet.rInner, inletLen, SHELL_T.casing, RHO.steel)) +
      (inlet.separator ? shellMass(inlet.rOuter + 0.05 * k, 0.6 * inletLen, 0.003, RHO.steel) : 0),
    // Çıkış mili flanşı (dolu disk) ve mil gövdesi
    outputShaft: Math.PI * output.flangeR ** 2 * 0.02 * k * RHO.steel + shellMass(housing.r, housing.z1 - housing.z0, SHELL_T.casing, RHO.steel),
    exhaust: shellMass(gg.exhaust.r0, gg.exhaust.z1 - gg.exhaust.z0, 0.002, RHO.ni),
    ...(output.reduction ? { gearbox: GEARBOX_KG_PER_KNM * torqueKNm } : {}),
  };
  const maxR = Math.max(...L.outerProfile.map(([, r]) => r));
  return {
    layout: L,
    shaftLen: { lp: gg.shafts.lp[1] - gg.shafts.lp[0], hp: gg.shafts.hp[1] - gg.shafts.hp[0] },
    extra,
    // Çap: dış zarfın en büyük çapı (fan/pervane yok)
    diameter: 2 * maxR,
    length: gg.exhaust.z1 - SHAFT_Z,
    // LP milinde kompresör yok (serbest güç türbini)
    lpTipMach: 0,
  };
}
