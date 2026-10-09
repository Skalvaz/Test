/**
 * Çalışabilirlik (atalet, kompresör haritası, limitler, marş sistemi):
 * geometriden henüz türetilmeyen alanlar (docs/M5A-SPEC.md §2.8).
 *
 * Şablonlar bunları `graph.ops` içinde tam verir. Atölye grafiklerinde
 * `ops` yok ya da kısmidir: ailenin şablonundan (referans) ölçeklenir.
 *
 * Ölçekleme (P1): atalet rotor ataletiyle (Σ m·r², rotorInertia), marş
 * torku HP ataleti × devirle; harita, limitler ve marşın diğer alanları
 * referanstan aynen; `g.ops` alan alan üstüne yazar. Şablonun kendisine
 * uygulanınca bütün oranlar 1. Aksesuar gücü tasarım noktasına girdiği
 * için ayrı ve boyutlandırmadan önce çözülür (resolveAccessoryPower).
 */

import type { EngineDesign } from '../sim/design';
import { GraphError } from './errors';
import type { BuiltEngine } from './graph';
import { meanR, RHO, type GasPath, type MassBreakdown, type RowGeometry } from './flowpath';
import type { EngineGraph, Operability, PropellerModule } from './types';

/** Tasarımın çalışabilirlik alanları (kopya) */
export function opsOf(d: EngineDesign): Operability {
  return { inertia: { ...d.inertia }, hpcMap: { ...d.hpcMap }, limits: { ...d.limits }, start: { ...d.start } };
}

/**
 * Grafiğin taslak çalışabilirliği: referans (varsa) + `g.ops`. Eksik alan
 * kalırsa öğretici GraphError (referanssız atölye grafiği).
 */
export function resolveOperability(g: EngineGraph, ref?: BuiltEngine): Operability {
  const base: Partial<Operability> = ref ? opsOf(ref.design) : {};
  const o = { ...base, ...g.ops };
  if (!o.inertia || !o.hpcMap || !o.limits || !o.start) {
    throw new GraphError(
      'Çalışabilirlik alanları (atalet, kompresör haritası, limitler, marş) eksik: aile şablonu referans verilmeli.',
      'engine.ops',
      'engine',
    );
  }
  return { inertia: { ...o.inertia }, hpcMap: { ...o.hpcMap }, limits: { ...o.limits }, start: { ...o.start } };
}

/**
 * Marş torku ölçeğinin sınırları. Şartname (§2.8) ×[0,25, 4] diyordu; ama
 * mil sürüklemesi (kompresör, aksesuar) ∝ W^1,5 büyür ve ×3 hava akışında
 * gereken oran ~9'dur: 4'te kırpılan marş sürüklemeyi zor yener, motor 60
 * s'de rölantiye çıkamaz. Üst sınır 10, düğme aralığının üst ucunu (~×3)
 * karşılar.
 */
const STARTER_CLAMP: [number, number] = [0.25, 10];

/** Mil ataletleri ölçüsü (J) bir motor için: rotorlar + (LP'de) pervane */
function spoolJ(b: Pick<BuiltEngine, 'flowpath' | 'graph'>): { lp: number; hp: number } {
  const { gas, metrics } = b.flowpath;
  return {
    lp: rotorInertia(gas, 'lp', metrics.mass) + propJ(b.graph, gas, metrics.mass),
    hp: rotorInertia(gas, 'hp', metrics.mass),
  };
}

/**
 * Pervanenin güç türbini miline indirgenmiş ataleti: palleri kökten uca
 * düzgün çubuk sayar (J = m·R²/3), redüktör oranının karesiyle bölünür
 * (J_mil = J_pervane·(ω_pervane/ω_mil)²). Pervanesiz motorda 0.
 */
function propJ(g: EngineGraph, gas: GasPath, mass: MassBreakdown): number {
  const prop = g.modules.find((m) => m.type === 'propeller') as PropellerModule | undefined;
  if (!prop) return 0;
  const m = mass.parts.propeller ?? 14 * prop.diameter ** 2;
  const ratio = (prop.rpm * 2 * Math.PI) / 60 / gas.omega.lp;
  return ((m * (prop.diameter / 2) ** 2) / 3) * ratio * ratio;
}

/**
 * Referans aileye (şablona) göre ölçeklenmiş çalışabilirlik (§2.8):
 *  - Atalet: I_s = I_s,ref · J_s / J_s,ref (J: rotorInertia, LP'de + pervane)
 *  - Marş torku: τ = τ_ref · (I_hp/I_hp,ref) · (n2/n2_ref), STARTER_CLAMP
 *    (marşın ivmelendirme süresi I·ω/τ korunur)
 *  - Kompresör haritası, limitler (EGT malzeme sınırıdır, kaydırılmaz),
 *    marşın diğer alanları: referanstan aynen
 *  - `g.ops` alan alan üstüne yazar (şablon ya da uzman düzeltmesi)
 * Şablonun kendisine (ops'suz) uygulanınca bütün oranlar tam 1: aynı
 * hesap aynı sayıları verir. Aksesuar gücü ayrı: resolveAccessoryPower.
 */
export function deriveOperability(
  g: EngineGraph,
  b: Omit<BuiltEngine, 'design' | 'rev'>,
  ref: BuiltEngine,
  refOps: Operability,
): Operability {
  const j = spoolJ(b);
  const j0 = spoolJ(ref);
  const inertia = {
    lp: refOps.inertia.lp * (j.lp / j0.lp),
    hp: refOps.inertia.hp * (j.hp / j0.hp),
  };
  const kStart = (inertia.hp / refOps.inertia.hp) * (b.flowpath.rpm.hp / ref.flowpath.rpm.hp);
  const start = {
    ...refOps.start,
    starterTorque: refOps.start.starterTorque * Math.min(STARTER_CLAMP[1], Math.max(STARTER_CLAMP[0], kStart)),
  };
  const o: Operability = { inertia, hpcMap: { ...refOps.hpcMap }, limits: { ...refOps.limits }, start };
  // Grafiğin kendi alanları (verilmiş olanlar) üstüne yazar
  for (const [k, v] of Object.entries(g.ops ?? {}) as [keyof Operability, unknown][]) {
    if (v !== undefined) (o as unknown as Record<string, unknown>)[k] = typeof v === 'object' && v ? { ...v } : v;
  }
  return o;
}

/** Aksesuar gücü ölçeğinin sınırları (§2.8) */
const ACCESSORY_CLAMP: [number, number] = [0.3, 3];

/** Çekirdek (HPC girişi, istasyon 25) akışı: grafikten, boyutlandırmadan önce */
const coreFlow = (g: EngineGraph) => {
  const fan = g.modules.find((m) => m.type === 'fan') as { bypassRatio?: number } | undefined;
  return g.massFlow / (1 + (fan?.bypassRatio ?? 0));
};

/**
 * Aksesuar gücü [W]: `g.ops.accessoryPower` (uzman düzeltmesi) >
 * referanstan ölçek `P_ref·W25/W25,ref` (×[0,3, 3]) > `g.accessoryPower`.
 * Tasarım noktasına (HPT işi) girdiği için toEngineDesign'da, yani
 * boyutlandırmadan önce çözülür. Şablonun kendisine uygulanınca oran 1.
 */
export function resolveAccessoryPower(g: EngineGraph, ref?: BuiltEngine): number {
  const own = g.ops?.accessoryPower;
  if (own !== undefined) return own;
  if (!ref) return g.accessoryPower;
  const k = coreFlow(g) / coreFlow(ref.graph);
  return ref.design.accessoryPower * Math.min(ACCESSORY_CLAMP[1], Math.max(ACCESSORY_CLAMP[0], k));
}

/** Modül kütlesinin dönen (rotor: kanat + disk) payı; kalanı stator ve kasa */
const ROTOR_SHARE = 0.5;
/** Santrifüj çark kütlesi: flowpath.ts estimateMass ile aynı bağıntı (dolu titanyum disk) */
const impellerMass = (r1: number) => Math.PI * r1 ** 2 * 0.12 * 0.3 * RHO.ti;

/** Sıranın ortalama yarıçapı (giriş ve çıkış ortalamalarının ortalaması) */
const rowR = (row: RowGeometry) => (meanR(row, 0) + meanR(row, 1)) / 2;

/**
 * Bir milin rotor atalet ölçüsü J = Σ m_rotor·r_ort² [kg·m²]. Mutlak
 * atalet değil ölçek ölçüsüdür: deriveOperability yalnız referansa oranını
 * kullanır (şablonların el yazımı ataletleri korunur).
 *  - Rotor payı modül kütlesinin ROTOR_SHARE'i, sıranın ortalama yarıçapında
 *  - LP: LP milinin ilk kompresörü (fan ya da LPC) + booster + LPT + LP mili
 *  - HP: HPC eksenel kademeleri + santrifüj çark (dolu disk, J = m·r²/2) +
 *    HPT + HP mili
 *  - Miller ince cidarlı boru (J = m·r²); kütle kaleminde iki mil birlikte
 *    olduğundan eşit boy varsayımıyla cidar kesitine (r²·t) göre bölünür
 * Pervane (LP'ye redüktörle bağlı) deriveOperability'de eklenir.
 */
export function rotorInertia(gas: GasPath, spool: 'lp' | 'hp', mass: MassBreakdown): number {
  const p = mass.parts;
  const rotor = (m: number | undefined, row: RowGeometry | undefined) => (m && row ? ROTOR_SHARE * m * rowR(row) ** 2 : 0);
  // Miller: flowpath.ts cidar kalınlıkları LP %15, HP %6 (yarıçapın)
  const { lp: rl, hp: rh } = gas.shafts;
  const wl = rl ** 2 * 0.15;
  const wh = rh ** 2 * 0.06;
  const shaftMass = (p.shafts ?? 0) * (spool === 'lp' ? wl : wh) / (wl + wh);
  const shaftJ = shaftMass * (spool === 'lp' ? rl : rh) ** 2;
  if (spool === 'lp') {
    // Geniş fan kendi kalemiyle ('fan'), fansız motorda ilk kompresör 'lpc'
    return rotor(p.fan ?? p.lpc, gas.front) + rotor(p.booster, gas.booster) + rotor(p.lpt, gas.lpt) + shaftJ;
  }
  let hpc = rotor(p.hpc, gas.hpc);
  if (gas.centrifugal && p.hpc) {
    const mi = Math.min(p.hpc, impellerMass(gas.centrifugal.r1));
    hpc = rotor(p.hpc - mi, gas.hpc) + (ROTOR_SHARE * mi * gas.centrifugal.r1 ** 2) / 2;
  }
  return hpc + rotor(p.hpt, gas.hpt) + shaftJ;
}
