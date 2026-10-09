/**
 * M5a inceleme düzeltmeleri: belge okuyucu kötü niyetli ya da bozuk girdiye
 * dayanıklı. Object.prototype adları (constructor, __proto__, toString),
 * sonsuz sayılar (JSON'da 1e999), yinelenen kimlikler, varyantta aile
 * kapsamlı düğme ve zarf dışı varyant değeri; sonda tohumlu bulanık test.
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { Family } from './core/family';
import {
  familyFromDoc,
  familyToDoc,
  newDocId,
  parseDoc,
  parseDocObject,
  parseProjectDoc,
  resolveFamilyVariant,
  serializeDoc,
  serializeProjectDoc,
} from './engineDoc';
import { KNOB_ALIASES, knobById } from './knobs';
import { TURBOFAN_GRAPH, TURBOJET_GRAPH } from './templates';
import type { EngineGraph } from './types';

function family(g: EngineGraph, values: Record<string, number> = {}): Family<EngineGraph, unknown> {
  return {
    id: newDocId('f_'),
    code: 'AT-3',
    name: 'AT-3 Deneme ailesi',
    base: structuredClone(g),
    envelope: { 'hpc.pr': [2.6, 3.2] },
    variants: [
      { id: 'v_AAAAAAAA', name: 'AT-3/45', nameLocked: false, values: {} },
      { id: 'v_BBBBBBBB', name: 'Sıcak', nameLocked: true, values },
    ],
    active: 'v_BBBBBBBB',
    origin: { from: 'template', template: 'turbojet' },
  };
}

/** Geçerli motor belgesi, JSON'dan okunmuş düz nesne olarak */
const raw = (g: EngineGraph = TURBOJET_GRAPH): any => JSON.parse(serializeDoc(familyToDoc(family(g))));

const PROTO_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__'];

afterEach(() => {
  for (const k of Object.keys(KNOB_ALIASES)) delete KNOB_ALIASES[k];
});

describe('Object.prototype adları (#2)', () => {
  it('origin.template yalnız bilinen şablon kimliği olabilir; değilse atılır ve not düşülür', () => {
    for (const t of [...PROTO_KEYS, 'yokBoyle', 42]) {
      const r = raw();
      r.family.origin.template = t;
      const p = parseDoc(JSON.stringify(r));
      expect(p.errors, String(t)).toEqual([]);
      expect(p.doc!.family.origin!.template, String(t)).toBeUndefined();
      if (typeof t === 'string') expect(p.notes.join(' '), t).toMatch(/şablon/);
      expect(familyFromDoc(p.doc!).family.origin.template).toBeUndefined();
    }
    const ok = raw();
    ok.family.origin.template = 'turbofanMixed';
    expect(parseDoc(JSON.stringify(ok)).doc!.family.origin!.template).toBe('turbofanMixed');
  });

  it('düğme ve zarf anahtarı olarak prototip adları bilinmeyen düğmedir (yerel kod notlara girmez)', () => {
    const r = raw();
    // JSON.parse "__proto__"yu öz alan olarak kurar (prototipi değiştirmez)
    const vals = JSON.parse('{' + PROTO_KEYS.map((k, i) => `"${k}": ${i + 1}`).join(',') + '}');
    r.variants[1].values = vals;
    r.family.envelope = JSON.parse('{' + PROTO_KEYS.map((k) => `"${k}": [1, 2]`).join(',') + '}');
    const p = parseDoc(JSON.stringify(r));
    expect(p.errors).toEqual([]);
    expect(p.doc!.variants[1].values).toEqual({});
    expect(p.doc!.family.envelope).toBeUndefined();
    const notes = p.notes.join('\n');
    expect(notes).not.toMatch(/native code|\[object/);
    expect(p.notes.filter((n) => /bilinmeyen düğme/.test(n)).length).toBe(PROTO_KEYS.length);
    for (const k of PROTO_KEYS) expect(knobById(k), k).toBeUndefined();
  });

  it('üst düzey "__proto__" Object.prototype\'u kirletmez ve atmaz', () => {
    const r = JSON.stringify(raw());
    const evil = r.replace(/^\{/, '{"__proto__":{"kirli":1,"format":"x"},');
    const p = parseDoc(evil);
    expect(p.errors).toEqual([]);
    expect(({} as Record<string, unknown>).kirli).toBeUndefined();
    expect(() => serializeDoc(p.doc!)).not.toThrow();
    expect(p.doc!.format).toBe('tfa-engine');
  });
});

describe('yinelenen kimlikler (#9)', () => {
  it('aynı kimlikli ikinci varyant yeni kimlik alır (not)', () => {
    const r = raw();
    r.variants[1] = { ...r.variants[0], name: 'kopya' };
    r.active = r.variants[0].id;
    const p = parseDoc(JSON.stringify(r));
    expect(p.errors).toEqual([]);
    const ids = p.doc!.variants.map((v) => v.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(r.variants[0].id);
    expect(ids[1]).toMatch(/^v_[0-9A-Z]{8}$/);
    expect(p.notes.join(' ')).toMatch(/kimli/);
    expect(p.doc!.active).toBe(r.variants[0].id);
  });

  it('proje belgesinde aynı kimlikli ikinci aile yeni kimlik alır (not)', () => {
    const a = familyToDoc(family(TURBOJET_GRAPH));
    const b = { ...familyToDoc(family(TURBOFAN_GRAPH)), family: { ...familyToDoc(family(TURBOFAN_GRAPH)).family, id: a.family.id } };
    const s = serializeProjectDoc({ format: 'tfa-workshop', v: 1, families: [a, b], active: a.family.id, expert: false });
    const p = parseProjectDoc(s);
    expect(p.errors).toEqual([]);
    const ids = p.doc!.families.map((f) => f.family.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(a.family.id);
    expect(p.doc!.active).toBe(a.family.id);
    expect(p.notes.join(' ')).toMatch(/kimli/);
  });
});

describe('sonsuz sayılar (#10)', () => {
  it('tabanda 1e999 (Infinity) hata; serileştirme hiç atmaz', () => {
    const r = JSON.stringify(raw()).replace('"modules":', '"zz":1e999,"modules":');
    const p = parseDoc(r);
    expect(p.doc).toBeUndefined();
    expect(p.errors.join(' ')).toMatch(/sonlu olmayan/);
    // Düğmeyle adreslenen taban değeri de
    const r2 = raw();
    const hpc = r2.family.base.modules.find((m: { type: string }) => m.type === 'hpc');
    hpc.pr = '__INF__';
    const p2 = parseDoc(JSON.stringify(r2).replace('"__INF__"', '-1e999'));
    expect(p2.errors.join(' ')).toMatch(/sonlu olmayan/);
  });

  it('nesne olarak verilen NaN da yakalanır; ext ve bilinmeyen alanlarda da', () => {
    const r = raw();
    r.family.base.massFlow = NaN;
    expect(parseDocObject(r).errors.join(' ')).toMatch(/sonlu olmayan/);
    const e = raw();
    e.ext = { a: [1, Infinity] };
    expect(parseDocObject(e).errors.join(' ')).toMatch(/sonlu olmayan/);
    const u = raw();
    u.gelecek = { x: -Infinity };
    expect(parseDocObject(u).errors.join(' ')).toMatch(/sonlu olmayan/);
    const m = raw();
    m.meta = { created: Infinity };
    expect(parseDocObject(m).errors.join(' ')).toMatch(/sonlu olmayan/);
  });

  it('varyant değerinde sonsuz sayı atlanır (not), belge serileşir', () => {
    const r = raw();
    r.variants[1].values = { 'combustor.tit': Infinity, 'hpc.pr': 3 };
    const p = parseDocObject(r);
    expect(p.errors).toEqual([]);
    expect(p.doc!.variants[1].values).toEqual({ 'hpc.pr': 3 });
    expect(() => serializeDoc(p.doc!)).not.toThrow();
  });
});

describe('varyantta aile kapsamlı düğme (#13)', () => {
  it('aile düğmesi varyanttan tabana taşınır (etkin varyantın değeri), not düşülür', () => {
    const r = raw();
    r.variants[0].values = { 'combustor.dp': 0.07 };
    r.variants[1].values = { 'combustor.dp': 0.05, 'combustor.tit': 1300 };
    const p = parseDoc(JSON.stringify(r));
    expect(p.errors).toEqual([]);
    for (const v of p.doc!.variants) expect(v.values['combustor.dp']).toBeUndefined();
    expect(p.doc!.variants[1].values).toEqual({ 'combustor.tit': 1300 });
    const dp = knobById('combustor.dp')!;
    // Etkin varyant (BBBB) 0,05
    expect(dp.get(p.doc!.family.base as EngineGraph)).toBe(0.05);
    expect(p.notes.join(' ')).toMatch(/aile düğmesi/);
    const { family: f } = familyFromDoc(p.doc!);
    for (const v of f.variants) expect(dp.get(resolveFamilyVariant(f, v.id))).toBe(0.05);
  });
});

describe('zarf dışı varyant değeri (#23)', () => {
  it('çok varyantlı belgede zarf dışı değer zarfa kırpılır ve not düşülür', () => {
    const r = raw();
    r.variants[1].values = { 'hpc.pr': 3.6 };
    const p = parseDoc(JSON.stringify(r));
    expect(p.errors).toEqual([]);
    expect(p.doc!.variants[1].values['hpc.pr']).toBe(3.2);
    expect(p.notes.join(' ')).toMatch(/zarf/i);
  });
});

/* ------------------------------------------------------------------ */
/* Bulanık test: geçerli belgeyi rastgele bozar                         */
/* ------------------------------------------------------------------ */

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOSTILE: unknown[] = [
  Infinity,
  -Infinity,
  NaN,
  null,
  undefined,
  -0,
  1e308,
  '',
  'constructor',
  '__proto__',
  'toString',
  'x'.repeat(300),
  [],
  {},
  [Infinity],
  { constructor: 1 },
  JSON.parse('{"__proto__":{"a":1}}'),
  true,
  0,
];

/** Belgedeki tüm (yol, kap) çiftleri */
function paths(x: unknown, out: { parent: Record<string, unknown> | unknown[]; key: string | number }[] = []) {
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      out.push({ parent: x as Record<string, unknown>, key: Array.isArray(x) ? Number(k) : k });
      paths(v, out);
    }
  }
  return out;
}

describe('bulanık: bozuk belge okuyucuyu ve serileştiriciyi çökertmez', () => {
  it('300 rastgele bozulma (tohumlu)', () => {
    const rand = mulberry(20261009);
    const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
    for (let i = 0; i < 300; i++) {
      const doc = raw(rand() < 0.5 ? TURBOJET_GRAPH : TURBOFAN_GRAPH);
      const n = 1 + Math.floor(rand() * 3);
      for (let j = 0; j < n; j++) {
        const all = paths(doc);
        const { parent, key } = pick(all);
        const op = rand();
        if (op < 0.6) (parent as Record<string, unknown>)[key as string] = structuredClone(pick(HOSTILE));
        else if (op < 0.8 && !Array.isArray(parent)) (parent as Record<string, unknown>)[pick(PROTO_KEYS)] = structuredClone(pick(HOSTILE));
        else if (Array.isArray(parent)) parent.push(structuredClone(parent[0]));
        else delete (parent as Record<string, unknown>)[key as string];
      }
      let p: ReturnType<typeof parseDocObject> | undefined;
      expect(() => (p = parseDocObject(doc)), `#${i}`).not.toThrow();
      if (!p!.doc) continue;
      const d = p!.doc;
      // Okunan belge her zaman serileşir ve yeniden okunur
      let s = '';
      expect(() => (s = serializeDoc(d)), `#${i} serialize`).not.toThrow();
      const again = parseDoc(s);
      expect(again.doc, `#${i} reparse`).toBeDefined();
      expect(new Set(d.variants.map((v) => v.id)).size).toBe(d.variants.length);
      expect(d.variants.some((v) => v.id === d.active)).toBe(true);
      const t = d.family.origin?.template;
      if (t !== undefined) expect(['turbojet', 'turbojetDry', 'militaryTurbofan', 'turbofanMixed', 'turbofan', 'turboprop', 'turboshaft']).toContain(t);
    }
    expect(({} as Record<string, unknown>).a).toBeUndefined();
  });
});
