/**
 * Motor kartı (Faz 4 temeli, arayüzü M5c): uçak tasarımcısının motor
 * hakkında bildiği her şey. Kural (kalıcı): Faz 4 yalnız `EngineCard` okur;
 * kartı gömülü kopya + `rev` ile saklar (docs/M5A-SPEC.md §2.15).
 */

import type { EngineKind } from '../sim/design';
import { archKey, architectureOf } from './architecture';
import type { EngineDocV1 } from './engineDoc';
import type { BuiltEngine } from './graph';
import type { ShaftModule } from './types';

/** Gövdeye bağlantı noktası (yerleşimler `mounts` alanında taşır) */
export interface MountPoint {
  id: 'front' | 'rear' | 'thrust' | 'output';
  z: number;
  r: number;
  /** rad, 0 = +Y (üst) */
  angle: number;
  type: 'pylon' | 'trunnion' | 'flange' | 'gearbox';
}

export interface RatingPoint {
  thrust: number;
  /** Çıkış gücü [W] (turboşaftta ×transmissionEff; summary.ts ile aynı tanım) */
  shaftPower?: number;
  fuelFlow: number;
  /** İtkiye göre yakıt tüketimi [kg/(N·s)]; mil motorunda anlamsız (itki yalnız egzoz artığı) */
  tsfc: number;
  /** Mil motorunda güce göre yakıt tüketimi [g/(kW·h)] (M5a P7) */
  sfc?: number;
  airflow: number;
  egt: number;
}

export interface EngineCard {
  format: 'tfa-engine-card';
  v: 1;
  ref: { familyId: string; variantId: string; rev: string; family: string; variant: string };
  presentation: EngineKind;
  archKey: string;
  output: 'thrust' | 'propeller' | 'shaft';
  afterburner: boolean;
  bypassRatio: number;
  dims: {
    length: number;
    maxRadius: number;
    intake: { z: number; radius: number; y: number };
    exhaust: { z: number; radius: number };
    /** Dış zarf [z, r], z artan */
    envelope: [number, number][];
    propDiameter?: number;
    outputShaft?: { z: number; radius: number; rpm: number; drive: 'front' | 'rear' };
  };
  mass: { dry: number; cgZ: number };
  mounts: MountPoint[];
  ratings: { takeoff: RatingPoint; maxAB?: RatingPoint };
  spools: { lpRpm: number; hpRpm: number };
  installation: { bleedMax: number; powerOfftake: number };
  /** M5c */
  deck?: unknown;
  noise?: unknown;
  emissions?: unknown;
  cost?: unknown;
  life?: unknown;
}

/** Müşteri havası (bleed) üst sınırı: çekirdek akışının payı */
const BLEED_MAX_FRACTION = 0.05;

/**
 * Ağırlık merkezinin eksenel konumu. Kütle dökümü parça başına ağırlık
 * merkezi taşıyorsa (`mass.centroids`, P3) onu, yoksa gaz yolu sıralarının
 * ortasından yaklaşık değeri kullanır (gövde, dış donanım: zarfın ortası).
 */
export function massCentroidZ(b: BuiltEngine): number {
  const mass = b.flowpath.metrics.mass as { total: number; parts: Record<string, number>; centroids?: Record<string, number> };
  const g = b.flowpath.gas;
  const env = b.flowpath.layout.outerProfile;
  const zMid = env.length ? (env[0][0] + env[env.length - 1][0]) / 2 : 0;
  const rowMid = (r?: { z0: number; z1: number }) => (r ? (r.z0 + r.z1) / 2 : undefined);
  const approx: Record<string, number | undefined> = {
    lpc: rowMid(g.front),
    fan: rowMid(g.front),
    booster: rowMid(g.booster),
    hpc: rowMid(g.hpc),
    combustor: rowMid(g.combustor),
    hpt: rowMid(g.hpt),
    lpt: rowMid(g.lpt),
  };
  let m = 0;
  let mz = 0;
  for (const [part, kg] of Object.entries(mass.parts)) {
    if (!(kg > 0)) continue;
    const z = mass.centroids?.[part] ?? approx[part] ?? zMid;
    m += kg;
    mz += kg * z;
  }
  return m > 0 ? mz / m : zMid;
}

/** Aile gruplama anahtarı (architecture.ts); testler kendi işlevini verebilir */
export interface CardOptions {
  archKey?: (b: BuiltEngine) => string;
}

export function buildEngineCard(doc: EngineDocV1, variantId: string, b: BuiltEngine, opts: CardOptions = {}): EngineCard {
  const d = b.design;
  const p = b.sized.point;
  const ref = b.sized.ref;
  const L = b.flowpath.layout;
  const t = b.traits;
  const variant = doc.variants.find((v) => v.id === variantId);
  const shaft = b.graph.modules.find((m) => m.type === 'shaft') as ShaftModule | undefined;
  const egt = p.stations['45'].T - 273.15;
  // Çıkış gücü (turboşaftta aktarma kaybı sonrası): özetle aynı tanım
  const shaftPower = ref.outputPower > 0 ? ref.outputPower : undefined;
  const takeoff: RatingPoint = {
    thrust: p.thrust,
    ...(shaftPower !== undefined ? { shaftPower, sfc: (p.wf / shaftPower) * 3.6e9 } : {}),
    fuelFlow: p.wf,
    tsfc: p.tsfc,
    airflow: d.massFlow,
    egt,
  };
  const envelope = L.outerProfile.map(([z, r]) => [z, r] as [number, number]);
  const outputShaft =
    shaft && L.style === 'turboshaft'
      ? { z: L.output.z, radius: L.output.radius, rpm: L.output.rpm, drive: shaft.drive }
      : shaft
        ? { z: L.intake.z, radius: b.flowpath.gas.shafts.lp, rpm: shaft.rpm, drive: shaft.drive }
        : undefined;
  return {
    format: 'tfa-engine-card',
    v: 1,
    ref: { familyId: doc.family.id, variantId, rev: b.rev, family: doc.family.name, variant: variant?.name ?? variantId },
    presentation: t.presentation,
    archKey: (opts.archKey ?? ((x: BuiltEngine) => archKey(architectureOf(x.graph))))(b),
    output: t.output,
    afterburner: t.afterburner,
    bypassRatio: t.bpr,
    dims: {
      length: b.flowpath.metrics.length,
      maxRadius: Math.max(...envelope.map(([, r]) => r), b.flowpath.metrics.diameter / 2),
      intake: { ...L.intake },
      exhaust: { ...L.exhaustExit },
      envelope,
      ...(L.style === 'turboprop' ? { propDiameter: 2 * L.prop.radius } : {}),
      ...(outputShaft ? { outputShaft } : {}),
    },
    mass: { dry: b.flowpath.metrics.mass.total, cgZ: massCentroidZ(b) },
    mounts: L.mounts.map((m) => ({ ...m })),
    ratings: {
      takeoff,
      ...(d.afterburner ? { maxAB: { ...takeoff, thrust: p.thrustWet, fuelFlow: p.wf + ref.wfAbMax, tsfc: (p.wf + ref.wfAbMax) / Math.max(p.thrustWet, 1) } } : {}),
    },
    spools: { lpRpm: b.flowpath.rpm.lp, hpRpm: b.flowpath.rpm.hp },
    installation: { bleedMax: BLEED_MAX_FRACTION * ref.coreFlow, powerOfftake: d.accessoryPower },
  };
}
