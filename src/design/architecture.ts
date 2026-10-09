/**
 * Motor mimarisi (M5a): sihirbazın ve mimari kartlarının eksenleri. Mimari
 * saklanmaz; grafikten `architectureOf` ile türetilir. Mimari değişimi
 * grafiğe `applyArchitecture` dönüşüm tablosuyla uygulanır
 * (docs/M5A-SPEC.md §2.4).
 *
 * P0: yalnız sözleşme (tipler ve imzalar). Gövdeleri P4a yazar.
 */

import type { CombustorStyle, EngineGraph } from './types';

/** LP milini ne çeviriyor: alçak basınç kompresörü, fan, pervane ya da çıkış mili */
export type LpLoad = 'lpc' | 'fan' | 'propeller' | 'shaft';

export interface Architecture {
  /** Sihirbazın 1. sorusu; pervane 'shaft' çıkışlı sayılmaz (itki + mil) */
  output: 'thrust' | 'shaft';
  lpLoad: LpLoad;
  /** Yalnız lpLoad 'fan' */
  booster: boolean;
  /** HPC son kademe santrifüj */
  centrifugal: boolean;
  combustor: CombustorStyle;
  exhaust: 'single' | 'separate' | 'mixed';
  /** exhaust 'mixed' iken anlamlı */
  mixer: 'confluent' | 'lobed';
  afterburner: boolean;
  /** Art yakıcı varken değişken lüle */
  abNozzle: 'convergent' | 'cd';
  /** prop/shaft'ta yok sayılır */
  installation: 'bare' | 'nacelle';
}

export interface ArchCard {
  title: string;
  does: string;
  gains: string;
  costs: string;
  examples: string;
  lesson?: string;
  glossary?: string;
}

export interface ArchOption {
  axis: keyof Architecture;
  value: string | boolean;
  card: ArchCard;
  /** Zorunlu eşlik eden değişiklikler (kartta "Şunlar da değişir: …") */
  implies(a: Architecture): Partial<Architecture>;
  /** Hâlâ geçersizse GRAPH_RULES metni (kart kilitli, nedeni öğretir); M5b/M5c ise o metin */
  blocked(a: Architecture): string | null;
}

export type ArchChange =
  | { arch: Architecture; implied: { axis: keyof Architecture; from: unknown; to: unknown; reason: string }[] }
  | { blocked: string };

/** Mimari kartları (P4a doldurur) */
export const ARCH_OPTIONS: readonly ArchOption[] = [];

const todo = (): never => {
  throw new Error('P4a: mimari dönüşümleri henüz yok.');
};

export function architectureOf(_g: EngineGraph): Architecture {
  return todo();
}

/** Aile gruplama anahtarı: 'fan+b|cf0|ann|mix:lobed|dry|nac' */
export function archKey(_a: Architecture): string {
  return todo();
}

export function resolveChange(_a: Architecture, _axis: keyof Architecture, _value: unknown): ArchChange {
  return todo();
}

/**
 * Mimariye uygun grafik: modül ekler/çıkarır, ortak düğmeleri `seed`den
 * taşır. Çekirdek akışı korunur: massFlow' = massFlow·(1+bpr')/(1+bpr).
 */
export function applyArchitecture(_seed: EngineGraph, _next: Architecture): EngineGraph {
  return todo();
}
