/**
 * Teknoloji sınırları (uyarı eşikleri). M5a'da tek dönem: 'modern'. M5c'de
 * dönemli sınırlar ('1955' | '1970' | '1985' | '2010') eklenir.
 *
 * Eşik kuralı (docs/M5A-SPEC.md §2.11): her eşik yedi şablonun ilgili en
 * kötü değerinden en az %4 uzaktadır; çelişirse şablon düzeltilir, eşik
 * gevşetilmez. Değerler §2.11 tablosundan; P3 denetler.
 */

/** Uyarı sınırı: caution (amber) ve isteğe bağlı warning (kırmızı) */
export type Lim = { caution: number; warning?: number };

export interface TechLimits {
  id: 'modern';
  year: number;
  /** T4 [K] */
  t4: Lim;
  /** T3 [K] */
  t3: Lim;
  /** EGT payı [K] (altında uyarı) */
  egtMargin: Lim;
  /** Uç bağıl Mach: fan (BPR ≥ 1), ilk LP kompresör (BPR < 1), HPC 1. kademe */
  tipMachRel: { fan: Lim; front: Lim; hpc: Lim };
  /** Durağan pervane ucu Mach'ı */
  propTipMach: Lim;
  /** Eksenel uç hızı ve santrifüj çark ucu [m/s] */
  axialUTip: Lim;
  impellerUTip: Lim;
  /** AN² [m²·rpm²] */
  an2: { hpt: Lim; lpt: Lim };
  /** Yanma odası referans hızı [m/s]: alt sınır, halka ve kutu üst sınırı */
  combustorVref: { low: Lim; highAnnular: Lim; highCan: Lim };
  /** HPT giriş eksenel Mach'ı (altında uyarı) */
  hptInletMach: Lim;
  /** Gerçek kademe yüklemesi ψ */
  loading: { hpc: Lim; booster: Lim; turbine: Lim };
  /** LPT kademe sayısı; son eksenel HPC kanat yüksekliği [mm] (altında uyarı) */
  lptStages: Lim;
  hpcExitBladeMm: Lim;
  /** Karıştırıcıda P19t/P5t aralığı */
  mixerPR: { caution: [number, number]; warning: [number, number] };
  /** Tasarım noktası surge payı (altında uyarı) */
  surgeMargin: Lim;
}

export const TECH_MODERN: TechLimits = {
  id: 'modern',
  year: 2010,
  t4: { caution: 1750, warning: 1900 },
  t3: { caution: 1000, warning: 1060 },
  egtMargin: { caution: 25, warning: 0 },
  tipMachRel: { fan: { caution: 1.5, warning: 1.7 }, front: { caution: 1.72, warning: 1.85 }, hpc: { caution: 1.55, warning: 1.7 } },
  propTipMach: { caution: 0.8, warning: 0.9 },
  axialUTip: { caution: 600, warning: 660 },
  impellerUTip: { caution: 620, warning: 680 },
  an2: { hpt: { caution: 4.2e7, warning: 5.0e7 }, lpt: { caution: 4.2e7, warning: 5.0e7 } },
  combustorVref: {
    low: { caution: 15, warning: 10 },
    highAnnular: { caution: 48, warning: 58 },
    highCan: { caution: 52, warning: 62 },
  },
  hptInletMach: { caution: 0.085 },
  loading: { hpc: { caution: 0.6, warning: 0.75 }, booster: { caution: 1.0, warning: 1.2 }, turbine: { caution: 3.2, warning: 3.8 } },
  lptStages: { caution: 7, warning: 9 },
  hpcExitBladeMm: { caution: 12, warning: 8 },
  mixerPR: { caution: [0.92, 1.12], warning: [0.85, 1.2] },
  surgeMargin: { caution: 0.12, warning: 0.08 },
};
