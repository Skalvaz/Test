/**
 * Kararlı serileştirme biçimi (M5a): motor ailesi belgesi `EngineDocV1` ve
 * atölye projesi `WorkshopProjectDocV1` (docs/M5A-SPEC.md §2.14). Kanonik
 * kurallar design/core/doc.ts'te; `modules` dizisi MODULE_ORDER sırasında.
 *
 * Yazma: `base` tam grafiktir (şablona göre fark değil), `kind` yazılmaz;
 * varyant değerlerinden tabanla aynı olanlar atılır. Okuma: boyut sınırı,
 * biçim ve sürüm denetimi, göçler, düğme takma adları, aralık dışı değerin
 * kırpılması (`notes`), ardından grafik kuralları (`errors`). Bilinmeyen
 * üst düzey alanlar ve `ext` okunur ve aynen geri yazılır.
 */

import type { KnobValue } from './core/knob';
import { canonicalJson, fnv1a64, type Migrator } from './core/doc';
import { resolveVariant, type Family } from './core/family';
import { checkGraph } from './graph';
import { clampEngineKnob, knobById, knobCtx, KNOB_ALIASES, KNOB_MAP } from './knobs';
import { MODULE_ORDER, type EngineGraph } from './types';
import type { TemplateId } from './templates';

/** kind türetilir, yazılmaz */
export type GraphDoc = Omit<EngineGraph, 'kind'>;

export interface EngineDocV1 {
  format: 'tfa-engine';
  v: 1;
  family: {
    /** 'f_' + 10 karakter Crockford base32 (kalıcı) */
    id: string;
    code: string;
    name: string;
    /** TAM grafik: şablona göre fark DEĞİL (şablonlar yeniden kalibre edilebilir) */
    base: GraphDoc;
    envelope?: Record<string, [number, number]>;
    origin?: { from: 'template' | 'wizard' | 'import'; template?: TemplateId; app: string };
  };
  /** id: 'v_' + 8 karakter */
  variants: { id: string; name: string; nameLocked?: boolean; values: Record<string, KnobValue> }[];
  active: string;
  meta: { created: string; modified: string; author?: string; notes?: string; tech?: string };
  /** Bilinmeyen alanlar okunur ve geri yazılır */
  ext?: Record<string, unknown>;
}

export interface WorkshopProjectDocV1 {
  format: 'tfa-workshop';
  v: 1;
  families: EngineDocV1[];
  active: string;
  expert: boolean;
  goal?: string;
}

/** Kanonik sıralama: modül dizisi akış sırasında */
export const DOC_ORDER = { modules: MODULE_ORDER } as const;

/** Grafiğin kimliği: 'r' + fnv1a64(kanonik(grafik \ kind)). Aynı grafik, aynı rev. */
export function graphRev(g: EngineGraph): string {
  const doc: Partial<EngineGraph> = { ...g };
  delete doc.kind;
  return 'r' + fnv1a64(canonicalJson(doc, { order: DOC_ORDER }));
}

/** M5a'da boş */
export const MIGRATIONS: readonly Migrator[] = [];

/** Uygulama sürümü (belgenin `origin.app` alanı) */
export const APP_ID = 'turbofan-akademi/M5a';

/** Tek motor belgesinin boyut sınırı; proje belgesi en çok 8 aile taşır */
export const DOC_MAX_BYTES = 64 * 1024;
export const PROJECT_MAX_BYTES = 8 * DOC_MAX_BYTES;

/* ------------------------------------------------------------------ */
/* Kimlikler                                                           */
/* ------------------------------------------------------------------ */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 'f_' + 10 ya da 'v_' + 8 Crockford base32 karakter (kalıcı kimlik) */
export function newDocId(prefix: 'f_' | 'v_', n = prefix === 'f_' ? 10 : 8): string {
  const bytes = new Uint8Array(n);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = prefix;
  for (const b of bytes) s += CROCKFORD[b & 31];
  return s;
}

/* ------------------------------------------------------------------ */
/* Aile ↔ belge                                                        */
/* ------------------------------------------------------------------ */

/** Ailenin belge dışı alanları (atölye yan haritada tutar; gidiş-dönüşte korunur) */
export interface DocExtras {
  meta?: EngineDocV1['meta'];
  ext?: Record<string, unknown>;
  /** Bilinmeyen üst düzey alanlar */
  unknown?: Record<string, unknown>;
}

const now = () => new Date().toISOString();

/** Taban grafik, kind'sız ve derin kopya */
function graphDoc(g: EngineGraph): GraphDoc {
  const c = structuredClone(g);
  delete c.kind;
  return c;
}

export function familyToDoc(f: Family<EngineGraph, unknown>, extras: DocExtras = {}): EngineDocV1 {
  const meta = { ...(extras.meta ?? { created: now(), modified: now() }) };
  const doc: EngineDocV1 = {
    ...(extras.unknown ?? {}),
    format: 'tfa-engine',
    v: 1,
    family: {
      id: f.id,
      code: f.code,
      name: f.name,
      base: graphDoc(f.base),
      ...(Object.keys(f.envelope).length ? { envelope: structuredClone(f.envelope) } : {}),
      origin: { from: f.origin.from, ...(f.origin.template ? { template: f.origin.template as TemplateId } : {}), app: APP_ID },
    },
    variants: f.variants.map((v) => ({ id: v.id, name: v.name, ...(v.nameLocked ? { nameLocked: true } : {}), values: { ...v.values } })),
    active: f.active,
    meta,
    ...(extras.ext ? { ext: structuredClone(extras.ext) } : {}),
  };
  return normalizeDoc(doc);
}

const KNOWN_KEYS = new Set(['format', 'v', 'family', 'variants', 'active', 'meta', 'ext']);

export function familyFromDoc(d: EngineDocV1): { family: Family<EngineGraph, unknown>; extras: DocExtras } {
  const unknown: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (!KNOWN_KEYS.has(k)) unknown[k] = v;
  return {
    family: {
      id: d.family.id,
      code: d.family.code,
      name: d.family.name,
      base: structuredClone(d.family.base) as EngineGraph,
      envelope: structuredClone(d.family.envelope ?? {}),
      variants: d.variants.map((v) => ({ id: v.id, name: v.name, nameLocked: !!v.nameLocked, values: { ...v.values } })),
      active: d.active,
      origin: { from: d.family.origin?.from ?? 'import', template: d.family.origin?.template },
    },
    extras: {
      meta: { ...d.meta },
      ...(d.ext ? { ext: structuredClone(d.ext) } : {}),
      ...(Object.keys(unknown).length ? { unknown } : {}),
    },
  };
}

/** Kanonik sayı eşitliği (7 anlamlı basamak) */
const sameValue = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Number(a.toPrecision(7)) === Number(b.toPrecision(7)) : a === b;

/**
 * Belgeyi kanonik biçime getirir: tabanda kind yok; varyant değerlerinden
 * tabanla aynı olanlar atılır; nameLocked yalnız true iken yazılır.
 */
export function normalizeDoc(d: EngineDocV1): EngineDocV1 {
  const base = graphDoc(d.family.base as EngineGraph);
  return {
    ...d,
    family: { ...d.family, base },
    variants: d.variants.map((v) => {
      const values: Record<string, KnobValue> = {};
      for (const [id, val] of Object.entries(v.values)) {
        const k = knobById(id);
        if (k && sameValue(k.get(base), val)) continue;
        values[id] = val;
      }
      const { nameLocked, ...rest } = v;
      return { ...rest, ...(nameLocked ? { nameLocked: true } : {}), values };
    }),
  };
}

/** Kanonik JSON */
export function serializeDoc(d: EngineDocV1): string {
  return canonicalJson(normalizeDoc(d), { order: DOC_ORDER });
}

/** Varyantın çözülmüş grafiği (taban + değerler, zarfa ve aralığa kırpılmış; ad = varyant adı) */
export function resolveFamilyVariant(f: Family<EngineGraph, unknown>, variantId: string): EngineGraph {
  const v = f.variants.find((x) => x.id === variantId);
  const g = resolveVariant(f, variantId, KNOB_MAP, knobCtx(f.base));
  delete g.kind;
  if (v) g.name = v.name;
  return g;
}

export function variantRev(d: EngineDocV1, variantId: string): string {
  return graphRev(resolveFamilyVariant(familyFromDoc(d).family, variantId));
}

/* ------------------------------------------------------------------ */
/* Okuma                                                               */
/* ------------------------------------------------------------------ */

type Parsed<T> = { doc?: T; errors: string[]; notes: string[] };

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

function readJson(json: string, max: number, errors: string[]): unknown {
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > max) {
    errors.push(`Belge çok büyük (${Math.ceil(bytes / 1024)} KB; sınır ${max / 1024} KB).`);
    return undefined;
  }
  try {
    return JSON.parse(json);
  } catch {
    errors.push('Belge okunamadı: geçerli bir JSON değil.');
    return undefined;
  }
}

/** Sürüm denetimi ve göçler: v > 1 reddedilir, v < 1 MIGRATIONS ile yükseltilir */
function migrate(o: Record<string, unknown>, errors: string[], notes: string[]): Record<string, unknown> | undefined {
  let v = typeof o.v === 'number' ? o.v : NaN;
  if (!Number.isInteger(v) || v < 0) {
    errors.push('Belgenin sürümü (v) okunamadı.');
    return undefined;
  }
  if (v > 1) {
    errors.push(`Daha yeni sürümle kaydedilmiş (v${v}); bu sürüm v1 belgelerini okur.`);
    return undefined;
  }
  let doc: unknown = o;
  while (v < 1) {
    const m = MIGRATIONS.find((x) => x.from === v);
    if (!m) {
      errors.push(`Eski belge sürümü (v${v}) için göç yok.`);
      return undefined;
    }
    doc = m.migrate(doc);
    v++;
    notes.push(`Belge v${v - 1} → v${v} sürümüne yükseltildi.`);
  }
  return doc as Record<string, unknown>;
}

/** Aile kodu kalıbı ("AT-12") */
export const FAMILY_CODE = /^[A-Z]{1,4}-\d{1,4}$/;
/** Oyuncu metinlerinin (aile ve varyant adı) uzunluk sınırı */
export const NAME_MAX = 64;

/** Bildirime giren oyuncu metni: tek satır, kısaltılmış (arayüz yine textContent ile yazar) */
const quote = (x: string, n = 40) => {
  const t = x.replace(/[\u0000-\u001f\u007f]/g, ' ');
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Motor belgesi nesnesini denetler (proje belgesi de aile başına bunu
 * çağırır). Hiçbir girdide atmaz: beklenmedik bozulma da `errors`'a yazılır.
 */
export function parseDocObject(input: unknown): Parsed<EngineDocV1> {
  try {
    return parseDocObjectUnsafe(input);
  } catch (e) {
    return { errors: [`Belge okunamadı: ${quote(e instanceof Error ? e.message : String(e), 120)}`], notes: [] };
  }
}

function parseDocObjectUnsafe(input: unknown): Parsed<EngineDocV1> {
  const errors: string[] = [];
  const notes: string[] = [];
  if (!isObj(input) || input.format !== 'tfa-engine') {
    errors.push('Bu bir Turbofan Akademi motor belgesi değil.');
    return { errors, notes };
  }
  const o = migrate(input, errors, notes);
  if (!o) return { errors, notes };
  const fam = o.family;
  if (!isObj(fam) || typeof fam.id !== 'string' || typeof fam.code !== 'string' || typeof fam.name !== 'string' || !isObj(fam.base) || !Array.isArray(fam.base.modules)) {
    errors.push('Belgede aile bilgisi eksik (kimlik, kod, ad, taban grafik).');
    return { errors, notes };
  }
  // Modüller nesne ve tipli olmalı: düğme bağlamı (deriveTraits) grafik kurallarından önce okur
  if (!fam.base.modules.every((m) => isObj(m) && typeof m.type === 'string')) {
    errors.push('Taban grafik geçersiz: modül listesi bozuk.');
    return { errors, notes };
  }
  if (!FAMILY_CODE.test(fam.code)) {
    errors.push(`Aile kodu geçersiz ("${quote(fam.code, 16)}"; beklenen ör. "AT-1").`);
    return { errors, notes };
  }
  if (!Array.isArray(o.variants) || o.variants.length === 0) {
    errors.push('Belgede varyant yok.');
    return { errors, notes };
  }
  const famName = fam.name.length > NAME_MAX ? fam.name.slice(0, NAME_MAX) : fam.name;
  if (famName !== fam.name) notes.push('Aile adı çok uzundu, kısaltıldı.');
  const base = structuredClone(fam.base) as unknown as EngineGraph;
  if ('kind' in base) delete base.kind;
  const ctx = knobCtx(base);
  const variants: EngineDocV1['variants'] = [];
  for (const [i, raw] of o.variants.entries()) {
    if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') {
      errors.push(`${i + 1}. varyant okunamadı.`);
      continue;
    }
    const name = raw.name.length > NAME_MAX ? raw.name.slice(0, NAME_MAX) : raw.name;
    if (name !== raw.name) notes.push(`${i + 1}. varyantın adı çok uzundu, kısaltıldı.`);
    const vn = quote(name);
    const values: Record<string, KnobValue> = {};
    for (const [id0, val0] of Object.entries(isObj(raw.values) ? raw.values : {})) {
      let id = id0;
      if (!KNOB_MAP.has(id) && KNOB_ALIASES[id]) {
        id = KNOB_ALIASES[id];
        notes.push(`"${quote(id0)}" düğmesinin yeni adı "${id}".`);
      }
      const k = KNOB_MAP.get(id);
      if (!k) {
        notes.push(`"${vn}" varyantında bilinmeyen düğme "${quote(id0)}" atlandı.`);
        continue;
      }
      if (typeof val0 !== 'number' && typeof val0 !== 'string' && typeof val0 !== 'boolean') {
        notes.push(`"${vn}" varyantında "${id}" değeri okunamadı, atlandı.`);
        continue;
      }
      const val = k.range(ctx) ? clampEngineKnob(k, val0, ctx) : val0;
      if (!sameValue(val, val0)) notes.push(`"${vn}": ${k.label} aralık dışındaydı (${quote(String(val0), 16)} → ${String(val)}).`);
      values[id] = val;
    }
    variants.push({ id: raw.id, name, ...(raw.nameLocked === true ? { nameLocked: true } : {}), values });
  }
  if (!variants.length) return { errors, notes };
  let active = typeof o.active === 'string' ? o.active : '';
  if (!variants.some((v) => v.id === active)) {
    if (active) notes.push('Etkin varyant bulunamadı: ilk varyant seçildi.');
    active = variants[0].id;
  }
  const meta = isObj(o.meta) ? (o.meta as EngineDocV1['meta']) : { created: now(), modified: now() };
  const originRaw = isObj(fam.origin) ? fam.origin : undefined;
  const from = originRaw && ['template', 'wizard', 'import'].includes(originRaw.from as string) ? (originRaw.from as 'template' | 'wizard' | 'import') : 'import';
  const envelope = readEnvelope(fam.envelope, notes);
  const doc: EngineDocV1 = {
    ...o,
    format: 'tfa-engine',
    v: 1,
    family: {
      ...fam,
      id: fam.id,
      code: fam.code,
      name: famName,
      base,
      ...(envelope ? { envelope } : {}),
      origin: {
        from,
        ...(typeof originRaw?.template === 'string' ? { template: originRaw.template as TemplateId } : {}),
        app: typeof originRaw?.app === 'string' ? originRaw.app : APP_ID,
      },
    },
    variants,
    active,
    meta,
  };
  if (!isObj(o.meta)) notes.push('Belgede üst bilgi (meta) yoktu.');
  // Grafik kuralları: taban ve her varyant
  const fe = checkGraph(base);
  if (fe) errors.push(`Taban grafik geçersiz: ${fe.message}`);
  else {
    const { family } = familyFromDoc(doc);
    for (const v of variants) {
      const e = checkGraph(resolveFamilyVariant(family, v.id));
      if (e) errors.push(`"${v.name}" varyantı geçersiz: ${e.message}`);
    }
  }
  return { doc, errors, notes };
}

/**
 * Varyant zarfı: bilinen varyant düğmesi, iki sonlu uç, lo ≤ hi. Geçmeyen
 * girdi atılır ve `notes`'a yazılır (bozuk zarf kırpmada NaN üretirdi).
 */
function readEnvelope(raw: unknown, notes: string[]): Record<string, [number, number]> | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw)) {
    notes.push('Varyant zarfı okunamadı, atlandı.');
    return undefined;
  }
  const env: Record<string, [number, number]> = {};
  for (const [id0, e] of Object.entries(raw)) {
    const id = KNOB_MAP.has(id0) ? id0 : (KNOB_ALIASES[id0] ?? id0);
    const k = KNOB_MAP.get(id);
    const ok = k && k.scope === 'variant' && Array.isArray(e) && e.length === 2 && e.every((x) => typeof x === 'number' && Number.isFinite(x)) && e[0] <= e[1];
    if (ok) env[id] = [e[0], e[1]];
    else notes.push(`Zarfta "${quote(id0)}" girdisi geçersizdi, atlandı.`);
  }
  return Object.keys(env).length ? env : undefined;
}

export function parseDoc(json: string): Parsed<EngineDocV1> {
  const errors: string[] = [];
  const o = readJson(json, DOC_MAX_BYTES, errors);
  if (o === undefined) return { errors, notes: [] };
  return parseDocObject(o);
}

/* ------------------------------------------------------------------ */
/* Proje belgesi                                                       */
/* ------------------------------------------------------------------ */

export function serializeProjectDoc(p: WorkshopProjectDocV1): string {
  return canonicalJson({ ...p, families: p.families.map(normalizeDoc) }, { order: DOC_ORDER });
}

export function parseProjectDoc(json: string): Parsed<WorkshopProjectDocV1> {
  const errors: string[] = [];
  const notes: string[] = [];
  const o = readJson(json, PROJECT_MAX_BYTES, errors);
  if (o === undefined) return { errors, notes };
  if (!isObj(o) || o.format !== 'tfa-workshop') {
    errors.push('Bu bir Turbofan Akademi atölye belgesi değil.');
    return { errors, notes };
  }
  const p = migrate(o, errors, notes);
  if (!p) return { errors, notes };
  if (!Array.isArray(p.families) || p.families.length === 0) {
    errors.push('Atölye belgesinde aile yok.');
    return { errors, notes };
  }
  const families: EngineDocV1[] = [];
  for (const [i, f] of p.families.entries()) {
    const r = parseDocObject(f);
    errors.push(...r.errors.map((e) => `${i + 1}. aile: ${e}`));
    notes.push(...r.notes.map((n) => `${i + 1}. aile: ${n}`));
    if (r.doc) families.push(r.doc);
  }
  if (!families.length) return { errors, notes };
  let active = typeof p.active === 'string' ? p.active : '';
  if (!families.some((f) => f.family.id === active)) active = families[0].family.id;
  return {
    doc: {
      format: 'tfa-workshop',
      v: 1,
      families,
      active,
      expert: p.expert === true,
      ...(typeof p.goal === 'string' ? { goal: p.goal } : {}),
    },
    errors,
    notes,
  };
}
