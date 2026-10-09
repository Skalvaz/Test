/**
 * Çıplak motor yerleşimi (test hücresi): turbojet ve düşük baypaslı karışık
 * akışlı turbofan, art yakıcılı ya da art yakıcısız. engine/barejet.js girdisi.
 *
 * Art yakıcılı motorda türbinin arkasında art yakıcı kanalı ve değişken
 * kesitli lüle vardır. Art yakıcısız (kuru) motorda kısa bir jet borusu ve
 * sabit yakınsak lüle (J57, JT8D çekirdeği, Spey gibi): jet borusu LPT
 * çıkışından lüleye uzanır, lüle ağzı tasarım noktası alanından
 * (karışık akışta ortak lüle alanı A9mix).
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
/** Art yakıcısız (kuru) dal: sabit lüle, jet borusu (M5a P5) */
export const READY_DRY = true;

/** Değişken lüle boğazı akış katsayısı (etkin / geometrik alan) */
const NOZZLE_CD = 0.77;
/** Sabit lüle konisinin yarı açısı: yakınsak lülelerde 10–15° */
const FIXED_NOZZLE_HALF_ANGLE = (14 * Math.PI) / 180;
/** Sabit lüle et kalınlığı [m] (inconel sac, kütle) */
const FIXED_NOZZLE_T = 0.003;

/** Art yakıcısız motorun sabit yakınsak lülesi: jet borusu ucundan lüle ağzına koni */
export interface FixedNozzleGeometry {
  kind: 'fixed';
  z0: number;
  z1: number;
  /** Giriş (jet borusu) iç yarıçapı */
  r0: number;
  /** Lüle ağzı yarıçapı √(A9/π) */
  rExit: number;
}

/**
 * Art yakıcılı motorun değişken kesitli lülesi (yakınsak ya da yakınsak-
 * ıraksak, engine/nozzle.js buildNozzle). `kind` altın yerleşim testi
 * değişmesin diye yazılmaz: `kind !== 'fixed'` değişken lüle demektir.
 */
export interface VariableNozzleGeometry {
  kind?: 'variable';
  hingeR: number;
  throat0: number;
  primary: number;
  /** 0: yakınsak; > 0: yakınsak-ıraksak */
  divergent: number;
  flaps: number;
}

export type BareNozzleGeometry = FixedNozzleGeometry | VariableNozzleGeometry;

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
  /** Art yakıcı kanalı; art yakıcısız motorda null */
  ab: { z0: number; z1: number; R: number; liner: number } | null;
  /**
   * Jet borusu (yalnız art yakıcısız motorda): LPT çıkışından lüleye, boy
   * 1,2·r. Art yakıcılı motorda jet borusu art yakıcı kanalının kendisidir.
   */
  jetPipe?: { z0: number; z1: number; r: number };
  nozzle: BareNozzleGeometry;
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

/** Lüle ağzı ekseni ve yarıçapı (tasarım noktası, kuru) */
export function nozzleExit(n: BareNozzleGeometry, z0: number): { z: number; radius: number } {
  return n.kind === 'fixed' ? { z: n.z1, radius: n.rExit } : { z: z0 + n.primary + n.divergent, radius: n.throat0 };
}

function bareJetLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): BareJetLayout {
  const st = (id: StationId) => sized.point.stations[id];
  const inlet = moduleOf<InletModule>(graph, 'inlet')!;
  const fan = moduleOf<CompressorModule>(graph, 'fan');
  const frontMod = (fan ?? moduleOf<CompressorModule>(graph, 'lpc'))!;
  const hpcMod = moduleOf<CompressorModule>(graph, 'hpc')!;
  const abMod = moduleOf<AfterburnerModule>(graph, 'afterburner');
  const noz = moduleOf<NozzleModule>(graph, 'nozzle')!;
  const lpc = gp.front;
  if (!lpc) throw new FlowpathError('Çıplak motor LP milinin ilk kompresörünü (fan ya da LPC) ister.', 'lpLoad.required', 'lpc');
  const { hpc, hpt, lpt } = gp;
  const { z0: cz0, z1: cz1, rOut } = gp.combustor;
  const bypass = !!fan && (fan.bypassRatio ?? 0) > 0;

  // --- türbin çıkış çerçevesi ve kuyruk konisi ---
  const coneR = lpt.hub[1] - 0.015;
  const coneZ0 = lpt.z1 + 0.12;
  const tailCone: [number, number, number] = [coneZ0, coneZ0 + 2.4 * coneR, coneR];

  // --- gövde ---
  const turbTip = Math.max(hpt.tip[0], lpt.tip[1]);
  let shell: [number, number][];
  let R: number;
  let splitterZ: number | null = null;
  if (bypass) {
    // Baypas kanalı: çekirdek gövdesinin dışında, verilen Mach'ta
    const bp = graph.bypassDuct ?? { dp: 0, mach: 0.15 };
    const aBp = annulusArea(st('13'), bp.mach, AIR);
    const splitR = Math.max(hpc.tip[0], rOut) + 0.04;
    // Dış kabuk türbin gövdesini de sarar: düşük BPR'de (atölyede 0,1–0,35)
    // çekirdek büyür, LPT ucu baypas alanından çıkan yarıçapı aşabiliyordu
    // (jet borusu ve karıştırıcı türbin çıkışından dar kalıyordu). Şablonlarda
    // alan koşulu baskın, R değişmez.
    R = Math.max(Math.sqrt(splitR * splitR + aBp / Math.PI), lpt.tip[1] + 0.05);
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

  // --- egzoz: art yakıcı + değişken lüle ya da jet borusu + sabit lüle ---
  let ab: BareJetLayout['ab'] = null;
  let jetPipe: BareJetLayout['jetPipe'];
  let nozzle: BareNozzleGeometry;
  // Egzoz bölümünün başı ve sonu (flanşlar, dış zarf)
  const exZ0 = coneZ0 + 0.05;
  let exZ1: number;
  let exR: number;
  if (abMod) {
    // Jet borusu: kuru art yakıcıda karışmış akış (istasyon 7)
    // Gömlek türbin çıkış kanalından dar olamaz (düşük BPR'de Mach'tan çıkan
    // yarıçap LPT ucunun altında kalıyordu; gaz yolu içe basamak yapardı)
    const liner = Math.max(Math.sqrt(annulusArea(st('7'), abMod.mach, GAS) / Math.PI), lpt.tip[1] + 0.01);
    exZ1 = exZ0 + abMod.lengthDiameter * 2 * liner;
    exR = liner + 0.03;
    ab = { z0: exZ0, z1: exZ1, R: exR, liner };
    // Lüle boğazı: kuru tasarım noktası etkin alanından; geometrik boğaz
    // akış katsayısı kadar (~0,77) büyüktür
    const A8 = sized.ref.A8dry > 0 ? sized.ref.A8dry : sized.ref.A9;
    nozzle = {
      hingeR: liner + 0.01,
      throat0: Math.sqrt(A8 / Math.PI / NOZZLE_CD),
      primary: 0.3,
      divergent: noz.style === 'cd' ? 0.34 : 0,
      flaps: noz.flaps ?? 14,
    };
  } else {
    // Jet borusu iç yarıçapı: turbojette LPT çıkış kanalı, karışık akışta
    // baypas kanalının dış duvarı (iki akış ortak boruda karışır); hiçbir
    // zaman türbin çıkış kanalından dar değil
    const r = Math.max(bypass ? R - 0.03 : 0, lpt.tip[1] + 0.01);
    exZ1 = exZ0 + 1.2 * r;
    exR = r + 0.03;
    jetPipe = { z0: exZ0, z1: exZ1, r };
    // Lüle ağzı tasarım noktası alanından: karışık akışta ortak lüle (A9mix,
    // P1); simülasyon henüz ayrık hesaplıyorsa iki lülenin toplamı
    const A9 = bypass ? (sized.ref.A9mix ?? sized.ref.A9 + (sized.ref.A19 || 0)) : sized.ref.A9;
    const rExit = Math.sqrt(A9 / Math.PI);
    // Koni ~14° yarı açıyla daralır; kuyruk konisinin ucu lüle içinde kalır
    const len = Math.max((r - rExit) / Math.tan(FIXED_NOZZLE_HALF_ANGLE), tailCone[1] + 0.1 * r - exZ1, 0.45 * r);
    nozzle = { kind: 'fixed', z0: exZ1, z1: exZ1 + len, r0: r, rExit };
  }

  // Yanma odası bölümü gövdesi (HPC çıkışından HPT girişine)
  const casing: [number, number][] = [
    [hpc.tip[1] + 0.04, hpc.z1 - 0.02],
    [rOut + 0.01, cz0 + 0.02],
    [rOut + 0.01, cz1],
    [hpt.tip[0] + 0.005, hpt.z0 + 0.04],
    [lpt.tip[1] + 0.02, lpt.z1 + 0.17],
  ];

  // Flanşlar: modül sınırlarında (art yakıcıda kanalın ortası da; kuru
  // motorda jet borusu ↔ lüle flanşı)
  const flanges = [INTAKE_Z, mid(lpc.z1, hpc.z0), hpc.z1 + 0.07, cz0 + 0.02, mid(cz1, hpt.z0) + 0.04, exZ0];
  if (abMod) flanges.push(mid(exZ0, exZ1), exZ1 - 0.05);
  else flanges.push(exZ1);
  if (fan) flanges.splice(1, 1, lpc.z1 + 0.1);

  // VSV halkaları (dış donanım): kompresörlerin ön stator sıraları. Baypaslı
  // motorda HPC baypas kanalının altında kalır, halkaları dışarıdan görünmez
  const vsv: BareJetLayout['vsv'] = [];
  const outer: [RowGeometry, CompressorModule, string][] = [[lpc, frontMod, fan ? 'fan' : 'booster']];
  if (!bypass) outer.push([hpc, hpcMod, 'hpc']);
  for (const [row, mod, part] of outer) {
    const n = Math.min(mod.vsv ?? 0, row.stages);
    if (n > 0) vsv.push({ z: Array.from({ length: n }, (_, i) => row.z0 + (i + 0.5) * row.pitch * 0.62), part });
  }

  // Lobe'lu karıştırıcı: çekirdek/baypas sınırında; lobe tepeleri (r + amp)
  // egzoz kanalının (jet borusu ya da art yakıcı gömleği) ve kabuğun içinde
  // kalır. Genlik negatif olursa lobe'lar ters dönerdi (düşük BPR)
  const mixMod = moduleOf<MixerModule>(graph, 'mixer');
  const mixWall = Math.min(R, jetPipe?.r ?? ab?.liner ?? R);
  const mixR = Math.min(lpt.tip[1] + 0.03, mixWall - 0.01);
  const mixer =
    mixMod?.style === 'lobed'
      ? { lobes: mixMod.lobes ?? 12, z0: lpt.z1 + 0.06, z1: coneZ0 + 0.3, r: mixR, amp: Math.max(0, Math.min(0.4 * (R - mixR), 0.8 * (mixWall - mixR))) }
      : undefined;

  // Motor kartı alanları: askı noktaları stand askısıyla aynı yerde, zarf
  // gövde + art yakıcı kanalı (ya da jet borusu) + lüle
  const standZ: [number, number] = [mid(hpc.z0, hpc.z1), lpt.z1 + 0.05];
  const exit = nozzleExit(nozzle, exZ1);
  const throat = lpc.tip[0] + 0.005;
  // Bellmouth dudağı giriş boğazıyla orantılı (barejet.js ile aynı oran)
  const sc = throat / (fan ? REF_THROAT.fan : REF_THROAT.lpc);
  const bell = { r: 0.38 * sc, z: 0.45 * sc };
  const outerProfile = envelopeOf(
    [[throat + bell.r, INTAKE_Z - bell.z]],
    shell,
    nozzle.kind === 'fixed'
      ? [
          [exR, exZ0 + 0.12],
          [exR, exZ1],
          [nozzle.rExit + FIXED_NOZZLE_T + 0.004, nozzle.z1],
        ]
      : [
          [exR, exZ0 + 0.12],
          [exR, exZ1],
          [nozzle.hingeR, exit.z],
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
    ab,
    jetPipe,
    nozzle,
    standZ,
    flanges,
    shell,
    vsv,
    mounts,
    outerProfile,
    intake: { z: INTAKE_Z - 0.1, radius: throat, y: 0 },
    exhaustExit: exit,
  };
}

/**
 * Bugünkü şablonların giriş boğazı yarıçapı [m] (LPC'li turbojet, fanlı
 * askeri turbofan). Gaz yolundan gelmeyen sabit ölçülü parçalar (bellmouth,
 * burun, giriş dikmeleri, aksesuarlar; engine/barejet.js) bu tabana
 * oranlanır: şablonlarda ölçek 1, görüntü aynı.
 */
export const REF_THROAT = { lpc: 0.39992, fan: 0.46491 };

/** Çıplak motor: yerleşim + gaz yolu dışı kütle kalemleri + ölçüler */
export function bareLayout(graph: EngineGraph, sized: SizedEngine, gp: GasPath): LayoutResult {
  const L = bareJetLayout(graph, sized, gp);
  const front = gp.front!;
  const frontMod = (moduleOf<CompressorModule>(graph, 'fan') ?? moduleOf<CompressorModule>(graph, 'lpc'))!;
  const n = L.nozzle;
  const extra: Record<string, number> = { casing: shellMass(L.R, L.tailCone[0] - L.intakeZ, SHELL_T.casing, RHO.ti) };
  let length: number;
  // bareJetLayout art yakıcıyla her zaman değişken, art yakıcısız her zaman
  // sabit lüle üretir (art yakıcısız değişken lüleyi graph.ts kuralı
  // `nozzle.variableNeedsAb` daha önce reddeder)
  if (n.kind === 'fixed') {
    // Art yakıcı kalemi yok; jet borusu gövde sacı kalınlığında, sabit lüle ince inconel koni
    const p = L.jetPipe!;
    extra.jetPipe = shellMass(p.r, p.z1 - p.z0, SHELL_T.casing, RHO.ni);
    extra.nozzle = shellMass(n.r0, n.z1 - n.z0, FIXED_NOZZLE_T, RHO.ni);
    length = n.z1 - INTAKE_Z;
  } else {
    const ab = L.ab!;
    extra.afterburner = shellMass(ab.R, ab.z1 - ab.z0, SHELL_T.afterburner, RHO.ni);
    // Yapraklar + contalar + senkron halka + aktüatörler
    extra.nozzle = shellMass(n.hingeR, n.primary + n.divergent, SHELL_T.nozzle, RHO.ni) * 1.3;
    length = ab.z1 + n.primary + n.divergent - INTAKE_Z;
  }
  return {
    layout: L,
    shaftLen: { lp: L.gas.shafts.lp[1] - L.gas.shafts.lp[0], hp: L.gas.shafts.hp[1] - L.gas.shafts.hp[0] },
    extra,
    diameter: 2 * front.tip[0],
    length,
    lpTipMach: tipMachRel(sized.point.stations['2'], frontMod.mach[0], front.uTip, AIR),
  };
}
