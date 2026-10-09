/**
 * Ortak çekirdek: eşik kuralları ve bulgular (uyarı listesi). Kural bir
 * ölçü (metric) ile sınırlarını (limits) karşılaştırır; aşılırsa öğretici
 * bir bulgu (Finding) üretir. Motor bilgisi yok.
 */

import type { KnobValue, Unit } from './knob';

/** Önem: Toasts ile ortak */
export type Severity = 'info' | 'caution' | 'warning';

export interface Finding {
  id: string;
  severity: Severity;
  value?: number;
  limit?: number;
  unit?: Unit;
  /** 'HPC ilk kademe uç bağıl Mach 1,62' */
  title: string;
  /** Neden + bedel, öğretici */
  text: string;
  /** İnsan dili öneri */
  fix: string;
  /** Modül */
  group: string;
  /** Vurgulanacak parçalar (PartTag) */
  tags: string[];
  /** Panelde işaretlenecek düğmeler */
  knobs: string[];
  glossary?: string;
  lesson?: string;
  /** Önerilen düzeltme: bağlı düğmenin eşiği %2 içeride bırakan değeri */
  remedy?: { knob: string; value: KnobValue; label: string };
}

type Limit = number | [number, number];

export interface Rule<TCtx> {
  id: string;
  group: string;
  applies?(ctx: TCtx): boolean;
  metric(ctx: TCtx): number | undefined;
  dir: 'above' | 'below' | 'outside';
  limits(ctx: TCtx): { caution: Limit; warning?: Limit };
  unit: Unit;
  digits: number;
  title(v: number, ctx: TCtx): string;
  text(v: number, lim: number, ctx: TCtx): string;
  fix: string;
  tags(ctx: TCtx): string[];
  knobs: string[];
  glossary?: string;
  lesson?: string;
  /** Yalnız gri ipucu üretir (caution/warning sayılmaz) */
  infoOnly?: boolean;
  /** Pahalıysa yalnız tam üretimde çağrılır (evaluateRules `remedies: false`) */
  remedy?(ctx: TCtx): Finding['remedy'];
}

const RANK: Record<Severity, number> = { warning: 0, caution: 1, info: 2 };

/**
 * Sınırı aşıp aşmadığını ve aşılan sınırı döndürür. 'outside' için aralığın
 * yakın ucu döner; sayı verilmişse ±sayı gibi davranmaz, tek uçlu sayılır.
 */
function crossed(v: number, dir: Rule<unknown>['dir'], lim: Limit | undefined): number | null {
  if (lim === undefined) return null;
  if (dir === 'outside') {
    const [lo, hi] = Array.isArray(lim) ? lim : [-Infinity, lim];
    if (v < lo) return lo;
    if (v > hi) return hi;
    return null;
  }
  const l = Array.isArray(lim) ? (dir === 'above' ? lim[1] : lim[0]) : lim;
  if (dir === 'above' ? v > l : v < l) return l;
  return null;
}

/** Kuralları değerlendirir; bulgular önem (warning → info), sonra kimlik sırasında */
export function evaluateRules<T>(rules: readonly Rule<T>[], ctx: T, opts: { remedies?: boolean } = {}): Finding[] {
  const out: Finding[] = [];
  for (const r of rules) {
    if (r.applies && !r.applies(ctx)) continue;
    const v = r.metric(ctx);
    if (v === undefined || !Number.isFinite(v)) continue;
    const lims = r.limits(ctx);
    const w = crossed(v, r.dir, lims.warning);
    const c = w === null ? crossed(v, r.dir, lims.caution) : null;
    const lim = w ?? c;
    if (lim === null) continue;
    const severity: Severity = r.infoOnly ? 'info' : w !== null ? 'warning' : 'caution';
    out.push({
      id: r.id,
      severity,
      value: v,
      limit: lim,
      unit: r.unit,
      title: r.title(v, ctx),
      text: r.text(v, lim, ctx),
      fix: r.fix,
      group: r.group,
      tags: r.tags(ctx),
      knobs: [...r.knobs],
      glossary: r.glossary,
      lesson: r.lesson,
      remedy: opts.remedies !== false && r.remedy ? r.remedy(ctx) : undefined,
    });
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
