/**
 * Çıplak motor yerleşimi (test hücresi): turbojet ve art yakıcılı düşük
 * baypaslı turbofan. engine/barejet.js girdisi.
 *
 * READY: art yakıcılı dal hazır; art yakıcısız (kuru) dal M5a P5'te
 * (sabit yakınsak lüle, jet borusu, AB kalemsiz kütle).
 */

import { AIR, GAS } from '../../sim/gas';
import type { SizedEngine, StationId } from '../../sim/design';
import type { MountPoint } from '../card';
import {
  FlowpathError,
  INTAKE_Z,
  RHO,
  SHELL_T,
  annulusArea,
  envelopeOf,
  mid,
  moduleOf,
  profileAt,
  shellMass,
  tipMachRel,
  type CombustorGeometry,
  type GasPath,
  type RowGeometry,
} from '../flowpath';
import type { AfterburnerModule, CompressorModule, EngineGraph, InletModule, MixerModule, NozzleModule } from '../types';
import type { LayoutResult } from './index';

/** Art yakıcılı dal hazır */
export const READY = true;
/** Art yakıcısız (kuru) dal: P5 */
export const READY_DRY = false;

/** Değişken lüle boğazı akış katsayısı (etkin / geometrik alan) */
const NOZZLE_CD = 0.77;

/** engine/barejet.js girdisi */
export interface BareJetLayout {
  style: 'bare';
  R: number;
  throat: number;
  intakeZ: number;
  noseLen: number;
  igv: number;
  gas: {
    lpc: RowGeometry & { part: string; firstMaterial?: string; firstChord?: number };
    hpc: RowGeometry;
    combustor: CombustorGeometry;
    hpt: RowGeometry;
    lpt: RowGeometry;
    casing: [number, number][];
    shafts: { lp: [number, number, number]; hp: [number, number, number] };
  };
  splitterZ: number | null;
  tailCone: [number, number, number];
  ab: { z0: number; z1: number; R: number; liner: number };
  nozzle: { hingeR: number; throat0: number; primary: number; divergent: number; flaps: number };
  /** Test standı askı noktaları (eksenel konum): ön ve arka */
  standZ: [number, number];
  flanges: number[];
  shell: [number, number][];
  /** Değişken stator halkalarının eksenel konumları (dış donanım) */
  vsv: { z: number[]; part: string }[];
  /** Lobe'lu karıştırıcı: LPT çıkışında çekirdek/baypas sınırında */
  mixer?: { lobes: number; z0: number; z1: number; r: number; amp: number };
  /** Gövde bağlantıları (motor kartı): kompresör ön çerçevesi + türbin çıkış çerçevesi */
  mounts: MountPoint[];
  /** Dış zarf [z, r], z artan */
  outerProfile: [number, number][];
  /** Hava girişi (efektler, kart) */
  intake: { z: number; radius: number; y: number };
  /** Lüle ağzı, tasarım noktası (kuru) */
  exhaustExit: { z: number; radius: number };
}

function bareJetLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): BareJetLayout {
  const st = (id: StationId) => sized.point.stations[id];
  const inlet = moduleOf<InletModule>(graph, 'inlet')!;
  const fan = moduleOf<CompressorModule>(graph, 'fan');
  const frontMod = (fan ?? moduleOf<CompressorModule>(graph, 'lpc'))!;
  const hpcMod = moduleOf<CompressorModule>(graph, 'hpc')!;
  const ab = moduleOf<AfterburnerModule>(graph, 'afterburner');
  const noz = moduleOf<NozzleModule>(graph, 'nozzle')!;
  const lpc = gp.front;
  if (!lpc) throw new FlowpathError('Çıplak motor LP milinin ilk kompresörünü (fan ya da LPC) ister.', 'lpLoad.required', 'lpc');
  const { hpc, hpt, lpt } = gp;
  const { z0: cz0, z1: cz1, rOut } = gp.combustor;

  // --- egzoz ve art yakıcı ---
  const coneR = lpt.hub[1] - 0.015;
  const coneZ0 = lpt.z1 + 0.12;
  const tailCone: [number, number, number] = [coneZ0, coneZ0 + 2.4 * coneR, coneR];
  // Jet borusu: kuru art yakıcıda karışmış akış (istasyon 7)
  const liner = ab ? Math.sqrt(annulusArea(st('7'), ab.mach, GAS) / Math.PI) : lpt.tip[1];
  const abZ0 = coneZ0 + 0.05;
  const abZ1 = abZ0 + (ab ? ab.lengthDiameter * 2 * liner : 0.6);
  // Lüle boğazı: kuru tasarım noktası etkin alanından; geometrik boğaz
  // akış katsayısı kadar (~0,77) büyüktür
  const A8 = sized.ref.A8dry > 0 ? sized.ref.A8dry : sized.ref.A9;
  const nozzle = {
    hingeR: liner + 0.01,
    throat0: Math.sqrt(A8 / Math.PI / NOZZLE_CD),
    primary: 0.3,
    divergent: noz.style === 'cd' ? 0.34 : 0,
    flaps: noz.flaps ?? 14,
  };

  // --- gövde ---
  const turbTip = Math.max(hpt.tip[0], lpt.tip[1]);
  let shell: [number, number][];
  let R: number;
  let splitterZ: number | null = null;
  if (fan && (fan.bypassRatio ?? 0) > 0) {
    // Baypas kanalı: çekirdek gövdesinin dışında, verilen Mach'ta
    const bypass = graph.bypassDuct ?? { dp: 0, mach: 0.15 };
    const aBp = annulusArea(st('13'), bypass.mach, AIR);
    const splitR = Math.max(hpc.tip[0], rOut) + 0.04;
    R = Math.sqrt(splitR * splitR + aBp / Math.PI);
    const fanR = lpc.tip[0] + 0.055;
    splitterZ = lpc.z1 + 0.12;
    shell = [
      [Math.max(R, fanR - 0.01), INTAKE_Z + 0.12],
      [fanR, lpc.z0 + 0.07],
      [fanR, lpc.z1 + 0.07],
      [R, lpc.z1 + 0.17],
      [R, coneZ0],
    ];
  } else {
    R = Math.max(lpc.tip[0], hpc.tip[0]) + 0.035;
    const combR = rOut + 0.105;
    const turbR = turbTip + 0.06;
    shell = [
      [R, INTAKE_Z + 0.12],
      [R, hpc.z1 + 0.02],
      [combR, cz0 - 0.06],
      [combR, cz1 - 0.02],
      [turbR, hpt.z0 - 0.02],
      [turbR, lpt.z1 + 0.15],
    ];
  }

  // Yanma odası bölümü gövdesi (HPC çıkışından HPT girişine)
  const casing: [number, number][] = [
    [hpc.tip[1] + 0.04, hpc.z1 - 0.02],
    [rOut + 0.01, cz0 + 0.02],
    [rOut + 0.01, cz1],
    [hpt.tip[0] + 0.005, hpt.z0 + 0.04],
    [lpt.tip[1] + 0.02, lpt.z1 + 0.17],
  ];

  // Flanşlar: modül sınırlarında
  const flanges = [INTAKE_Z, mid(lpc.z1, hpc.z0), hpc.z1 + 0.07, cz0 + 0.02, mid(cz1, hpt.z0) + 0.04, abZ0, mid(abZ0, abZ1), abZ1 - 0.05];
  if (fan) flanges.splice(1, 1, lpc.z1 + 0.1);

  // VSV halkaları (dış donanım): kompresörlerin ön stator sıraları. Baypaslı
  // motorda HPC baypas kanalının altında kalır, halkaları dışarıdan görünmez
  const vsv: BareJetLayout['vsv'] = [];
  const outer: [RowGeometry, CompressorModule, string][] = [[lpc, frontMod, fan ? 'fan' : 'booster']];
  if (!fan || !(fan.bypassRatio! > 0)) outer.push([hpc, hpcMod, 'hpc']);
  for (const [row, mod, part] of outer) {
    const n = Math.min(mod.vsv ?? 0, row.stages);
    if (n > 0) vsv.push({ z: Array.from({ length: n }, (_, i) => row.z0 + (i + 0.5) * row.pitch * 0.62), part });
  }

  const mixMod = moduleOf<MixerModule>(graph, 'mixer');
  const mixer =
    mixMod?.style === 'lobed'
      ? { lobes: mixMod.lobes ?? 12, z0: lpt.z1 + 0.06, z1: coneZ0 + 0.3, r: lpt.tip[1] + 0.03, amp: 0.4 * (R - lpt.tip[1] - 0.03) }
      : undefined;

  // Motor kartı alanları (P0 yaklaşık; P5 kesinleştirir): askı noktaları
  // stand askısıyla aynı yerde, zarf gövde + art yakıcı kanalı + lüle
  const standZ: [number, number] = [mid(hpc.z0, hpc.z1), lpt.z1 + 0.05];
  const abR = liner + 0.03;
  const exitZ = abZ1 + nozzle.primary + nozzle.divergent;
  const throat = lpc.tip[0] + 0.005;
  const outerProfile = envelopeOf(
    [[throat + 0.38, INTAKE_Z - 0.45]],
    shell,
    [
      [abR, abZ0 + 0.12],
      [abR, abZ1],
      [nozzle.hingeR, exitZ],
    ],
  );
  const mounts: MountPoint[] = standZ.map((z, i) => ({
    id: i === 0 ? 'front' : 'rear',
    z,
    r: profileAt(shell, z),
    angle: 0,
    type: 'trunnion',
  }));

  return {
    style: 'bare',
    mixer,
    R,
    throat,
    intakeZ: INTAKE_Z,
    noseLen: inlet.noseLength * lpc.tip[0],
    igv: inlet.struts,
    gas: {
      lpc: { ...lpc, part: fan ? 'fan' : 'booster', firstMaterial: frontMod.firstMaterial, firstChord: frontMod.firstChord },
      hpc,
      combustor: gp.combustor,
      hpt,
      lpt,
      casing,
      shafts: { lp: [INTAKE_Z + 0.1, coneZ0 - 0.05, gp.shafts.lp], hp: [hpc.z0 - 0.08, hpt.z1 + 0.05, gp.shafts.hp] },
    },
    splitterZ,
    tailCone,
    ab: { z0: abZ0, z1: abZ1, R: abR, liner },
    nozzle,
    standZ,
    flanges,
    shell,
    vsv,
    mounts,
    outerProfile,
    intake: { z: INTAKE_Z - 0.1, radius: throat, y: 0 },
    exhaustExit: { z: exitZ, radius: nozzle.throat0 },
  };
}

/** Çıplak motor: yerleşim + gaz yolu dışı kütle kalemleri + ölçüler */
export function bareLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): LayoutResult {
  const L = bareJetLayout(graph, sized, gp);
  const front = gp.front!;
  const frontMod = (moduleOf<CompressorModule>(graph, 'fan') ?? moduleOf<CompressorModule>(graph, 'lpc'))!;
  return {
    layout: L,
    shaftLen: { lp: L.gas.shafts.lp[1] - L.gas.shafts.lp[0], hp: L.gas.shafts.hp[1] - L.gas.shafts.hp[0] },
    extra: {
      casing: shellMass(L.R, L.tailCone[0] - L.intakeZ, SHELL_T.casing, RHO.ti),
      afterburner: shellMass(L.ab.R, L.ab.z1 - L.ab.z0, SHELL_T.afterburner, RHO.ni),
      // Yapraklar + contalar + senkron halka + aktüatörler
      nozzle: shellMass(L.nozzle.hingeR, L.nozzle.primary + L.nozzle.divergent, SHELL_T.nozzle, RHO.ni) * 1.3,
    },
    diameter: 2 * front.tip[0],
    length: L.ab.z1 + L.nozzle.primary + L.nozzle.divergent - INTAKE_Z,
    lpTipMach: tipMachRel(sized.point.stations['2'], frontMod.mach[0], front.uTip, AIR),
  };
}
