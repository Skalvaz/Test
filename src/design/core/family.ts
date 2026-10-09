/**
 * Ortak çekirdek: aile ve varyant. Aile = mimari + donanım (tam model) +
 * varyant zarfı; varyant = zarf içindeki ayar farkları (itki sınıfı, T4,
 * BPR…). Gerçek örnek: CFM56-7B24/26/27 aynı ailenin varyantlarıdır.
 */

import { clampKnob, type KnobDef, type KnobValue } from './knob';

export interface Variant {
  id: string;
  name: string;
  /** Ad elle değiştirildi: otomatik "AT-1/45" adı artık yazılmaz */
  nameLocked: boolean;
  /** Tabandan farklı varyant düğmeleri (kimlik → değer) */
  values: Record<string, KnobValue>;
}

export interface Family<TModel, TArch> {
  id: string;
  code: string;
  name: string;
  /** TAM model (şablona referans değil) */
  base: TModel;
  /** Varyant düğmelerinin aile içi aralığı */
  envelope: Record<string, [number, number]>;
  /** ≥ 1 */
  variants: Variant[];
  active: string;
  origin: { from: 'template' | 'wizard' | 'import'; template?: string };
  /** Mimari saklanmaz; architectureOf(base) ile türetilir. Tip yalnız Faz 4 genelliği için. */
  _arch?: TArch;
}

/**
 * Varyantın çözülmüş modeli. Sıra: base klonu → her değer önce zarfa, sonra
 * düğme aralığına kırpılır → düğmeyle yazılır. Bilinmeyen kimlikler atlanır
 * (belge okuyucu onları `notes`'a yazar).
 */
export function resolveVariant<T>(
  f: Family<T, unknown>,
  variantId: string,
  knobs: ReadonlyMap<string, KnobDef<T, any>>,
  ctx: unknown,
): T {
  const v = f.variants.find((x) => x.id === variantId);
  if (!v) throw new Error(`Varyant bulunamadı: ${variantId}`);
  let m = structuredClone(f.base);
  for (const id of Object.keys(v.values).sort()) {
    const k = knobs.get(id);
    if (!k) continue;
    let val = v.values[id];
    const env = f.envelope[id];
    if (env && typeof val === 'number') val = Math.min(env[1], Math.max(env[0], val));
    m = k.set(m, clampKnob(k, val, ctx));
  }
  return m;
}
