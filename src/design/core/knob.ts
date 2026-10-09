/**
 * Ortak çekirdek (Faz 4 ile paylaşılır): düğme tanımı ve model yolu
 * yardımcıları. Motor bilgisi, three.js ve DOM YOK; hiçbir şeyi içe aktarmaz.
 *
 * Bir "model" (motor grafiği, ileride uçak gövdesi) düz JS nesnesidir;
 * düğme onu saf fonksiyonlarla okur ve klonlayarak yazar.
 */

export type KnobValue = number | string | boolean;
export type Unit = '' | 'kg/s' | 'K' | 'm/s' | 'm' | 'kg' | 'W' | 'rpm' | 'Pa' | 'mm' | '%' | 'adet';

export interface KnobDef<TModel, TCtx = unknown> {
  /** Kararlı kimlik ('hpc.pr'). Belgeye yazılır; ASLA yeniden adlandırılmaz (gerekirse KNOB_ALIASES). */
  id: string;
  /** Model içindeki yol: ['hpc','mach',0]. İlk öğe modül tipi, 'engine' ya da 'bypassDuct'. */
  path: readonly (string | number)[];
  /** Panel bölümü: 'hpc' */
  group: string;
  label: string;
  /** Tek cümle, öğretici */
  explain: string;
  unit: Unit;
  type: 'number' | 'int' | 'enum' | 'bool';
  options?: readonly string[];
  /** Bu bağlamdaki aralık; null: düğme bu bağlamda yok */
  range(ctx: TCtx): [number, number] | null;
  step: number;
  scale?: 'lin' | 'log';
  /** Gösterim dönüşümü: W → kW, K → °C */
  display?: { unit: string; factor: number; offset?: number; digits: number };
  level: 'basic' | 'expert';
  scope: 'family' | 'variant';
  /** 3B'de görünür etkisi: approx = model kısmen gösterir (ör. fan.hubTip) */
  preview: 'exact' | 'approx' | 'none';
  glossary?: string;
  lesson?: string;
  /** M5c dönem anahtarı */
  techLimit?: string;
  get(m: TModel): KnobValue | undefined;
  /** Saf: klon döndürür, girdiyi değiştirmez */
  set(m: TModel, v: KnobValue): TModel;
}

/**
 * Değeri düğmenin tipine ve bağlamdaki aralığına kırpar. Sayısal düğmede
 * sayıya çevrilemeyen değer alt uca, tamsayı düğmede en yakın tamsayıya
 * gider; seçenek dışı enum ilk seçeneğe döner.
 */
export function clampKnob<T, C>(k: KnobDef<T, C>, v: KnobValue, ctx: C): KnobValue {
  switch (k.type) {
    case 'bool':
      return v === true || v === 'true' || v === 1;
    case 'enum': {
      const s = String(v);
      const opts = k.options ?? [];
      return opts.includes(s) || opts.length === 0 ? s : opts[0];
    }
    default: {
      const r = k.range(ctx);
      let n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) n = r ? r[0] : 0;
      if (k.type === 'int') n = Math.round(n);
      if (r) n = Math.min(r[1], Math.max(r[0], n));
      // Tamsayı aralığı kesirli uçlarla verilmişse kırpma sonrası yeniden yuvarla
      if (k.type === 'int' && r) n = Math.min(Math.floor(r[1]), Math.max(Math.ceil(r[0]), n));
      return n;
    }
  }
}

/** Yol üzerindeki değeri okur; yol kopuksa undefined */
export function getPath(obj: unknown, path: readonly (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/**
 * Yapısal kopya ile yazar: yol üzerindeki her nesne/dizi kopyalanır, geri
 * kalan dallar paylaşılır (girdi değişmez). Eksik ara düğümler sonraki
 * anahtar sayıysa dizi, değilse nesne olarak oluşturulur.
 */
export function setPath<T>(obj: T, path: readonly (string | number)[], v: unknown): T {
  if (path.length === 0) return v as T;
  const [key, ...rest] = path;
  const src = obj as unknown;
  let copy: Record<string | number, unknown>;
  if (Array.isArray(src)) copy = src.slice() as unknown as Record<number, unknown>;
  else if (src !== null && typeof src === 'object') copy = { ...(src as Record<string, unknown>) };
  else copy = (typeof key === 'number' ? [] : {}) as Record<string | number, unknown>;
  const child = copy[key];
  const nextChild = rest.length === 0 ? v : setPath(child ?? (typeof rest[0] === 'number' ? [] : {}), rest, v);
  copy[key] = nextChild;
  return copy as unknown as T;
}
