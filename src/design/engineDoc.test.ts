/**
 * M5a P4b: kararlı belge biçimi (§2.14). Gidiş-dönüş aynı dizge ve rev;
 * anahtar/modül sırasından bağımsız rev; ext ve bilinmeyen alanlar
 * korunur; yeni sürüm reddedilir; eski düğme adları okunur.
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { Family } from './core/family';
import {
  familyFromDoc,
  familyToDoc,
  graphRev,
  newDocId,
  parseDoc,
  parseProjectDoc,
  resolveFamilyVariant,
  serializeDoc,
  serializeProjectDoc,
  variantRev,
  type EngineDocV1,
} from './engineDoc';
import { buildEngine } from './graph';
import { TEMPLATES } from './catalog';
import { KNOB_ALIASES, knobById, knobCtx } from './knobs';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
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

/** Nesnenin anahtarlarını ters sıraya dizer (derin) */
function reverseKeys<T>(x: T): T {
  if (Array.isArray(x)) return x.map(reverseKeys) as T;
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, reverseKeys(v)])) as T;
  return x;
}

afterEach(() => {
  for (const k of Object.keys(KNOB_ALIASES)) delete KNOB_ALIASES[k];
});

describe('motor belgesi', () => {
  it('kimlikler: f_ + 10, v_ + 8 Crockford base32', () => {
    expect(newDocId('f_')).toMatch(/^f_[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(newDocId('v_')).toMatch(/^v_[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(newDocId('f_')).not.toBe(newDocId('f_'));
  });

  it('serialize → parse → serialize aynı dizge, aynı rev', () => {
    const doc = familyToDoc(family(TURBOJET_GRAPH, { 'combustor.tit': 1300, 'hpc.pr': 3.1 }), { ext: { not: 'kalır' } });
    const s1 = serializeDoc(doc);
    const p = parseDoc(s1);
    expect(p.errors).toEqual([]);
    expect(p.notes).toEqual([]);
    const s2 = serializeDoc(p.doc!);
    expect(s2).toBe(s1);
    expect(variantRev(p.doc!, 'v_BBBBBBBB')).toBe(variantRev(doc, 'v_BBBBBBBB'));
    expect(variantRev(doc, 'v_BBBBBBBB')).not.toBe(variantRev(doc, 'v_AAAAAAAA'));
    // kind yazılmaz; base tam grafik
    expect(s1).not.toMatch(/"kind"/);
    expect(p.doc!.family.base.modules.length).toBe(TURBOJET_GRAPH.modules.length);
  });

  it('varyant rev = çözülmüş grafiğin rev’i (üretimdeki rev)', () => {
    const f = family(TURBOJET_GRAPH, { 'combustor.tit': 1300 });
    const doc = familyToDoc(f);
    const g = resolveFamilyVariant(f, 'v_BBBBBBBB');
    expect(g.name).toBe('Sıcak');
    expect(variantRev(doc, 'v_BBBBBBBB')).toBe(graphRev(g));
    expect(buildEngine(g).rev).toBe(graphRev(g));
  });

  it('karışık anahtar ve modül sırasında rev ve dizge kararlı', () => {
    const g = structuredClone(MILITARY_TURBOFAN_GRAPH);
    const shuffled = reverseKeys(g);
    shuffled.modules = [...shuffled.modules].reverse();
    expect(graphRev(shuffled)).toBe(graphRev(g));
    const doc = familyToDoc(family(g));
    const docS = reverseKeys(doc);
    docS.family.base.modules = [...docS.family.base.modules].reverse();
    expect(serializeDoc(docS)).toBe(serializeDoc(doc));
  });

  it('tabanla aynı varyant değeri yazılmaz; nameLocked yalnız true', () => {
    const doc = familyToDoc(family(TURBOJET_GRAPH, { 'hpc.pr': 2.9, 'combustor.tit': 1300 }));
    expect(doc.variants[1].values).toEqual({ 'combustor.tit': 1300 });
    expect('nameLocked' in doc.variants[0]).toBe(false);
    expect(doc.variants[1].nameLocked).toBe(true);
  });

  it('ext ve bilinmeyen üst düzey alanlar okunur ve geri yazılır', () => {
    const doc = { ...familyToDoc(family(TURBOJET_GRAPH), { ext: { plane: { pylon: 'sol' } } }), gelecek: { x: 1 } } as EngineDocV1;
    const s = serializeDoc(doc);
    const p = parseDoc(s);
    expect(p.errors).toEqual([]);
    expect(p.doc!.ext).toEqual({ plane: { pylon: 'sol' } });
    expect((p.doc as unknown as { gelecek: unknown }).gelecek).toEqual({ x: 1 });
    expect(serializeDoc(p.doc!)).toBe(s);
    // Aile yan bilgisi üzerinden de korunur
    const { family: f, extras } = familyFromDoc(p.doc!);
    expect(serializeDoc(familyToDoc(f, extras))).toBe(s);
  });

  it('v:2 reddedilir; biçim, JSON ve boyut denetimi', () => {
    const doc = familyToDoc(family(TURBOJET_GRAPH));
    const v2 = parseDoc(JSON.stringify({ ...doc, v: 2 }));
    expect(v2.doc).toBeUndefined();
    expect(v2.errors[0]).toMatch(/Daha yeni sürümle kaydedilmiş \(v2\)/);
    expect(parseDoc('{"format":"başka"}').errors[0]).toMatch(/motor belgesi değil/);
    expect(parseDoc('{').errors[0]).toMatch(/JSON/);
    const big = { ...doc, ext: { dolgu: 'x'.repeat(70 * 1024) } };
    expect(parseDoc(JSON.stringify(big)).errors[0]).toMatch(/çok büyük/);
  });

  it('eski düğme adı (KNOB_ALIASES) okunur', () => {
    KNOB_ALIASES['hpc.basincOrani'] = 'hpc.pr';
    const doc = familyToDoc(family(TURBOJET_GRAPH));
    const raw = JSON.parse(serializeDoc(doc));
    raw.variants[1].values = { 'hpc.basincOrani': 3.1 };
    const p = parseDoc(JSON.stringify(raw));
    expect(p.errors).toEqual([]);
    expect(p.doc!.variants[1].values).toEqual({ 'hpc.pr': 3.1 });
    expect(p.notes.join(' ')).toMatch(/yeni adı "hpc.pr"/);
  });

  it('aralık dışı değer kırpılır, bilinmeyen düğme atlanır (notes); geçersiz grafik errors', () => {
    const raw = JSON.parse(serializeDoc(familyToDoc(family(TURBOJET_GRAPH))));
    raw.variants[1].values = { 'combustor.tit': 2500, 'yok.boyle': 1 };
    const p = parseDoc(JSON.stringify(raw));
    expect(p.errors).toEqual([]);
    expect(p.doc!.variants[1].values).toEqual({ 'combustor.tit': 1650 });
    expect(p.notes.join(' ')).toMatch(/aralık dışındaydı/);
    expect(p.notes.join(' ')).toMatch(/bilinmeyen düğme "yok.boyle"/);
    // Taban grafikte zorunlu modül yok → hata
    raw.family.base.modules = raw.family.base.modules.filter((m: { type: string }) => m.type !== 'combustor');
    const bad = parseDoc(JSON.stringify(raw));
    expect(bad.errors.join(' ')).toMatch(/Zorunlu modül eksik/);
  });

  // Gerileme: taban kırpılmıyordu; evaluate'in ağı içindeki uç birleşimler
  // (HPC ucu 100 m/s + HPT yüklemesi 0,05) ≈ 770 kademelik sıra kuruyordu
  it('aralık dışı taban değeri de kırpılır (notes); şablon tabanları değişmez', () => {
    const raw = JSON.parse(serializeDoc(familyToDoc(family(TURBOPROP_GRAPH))));
    const mod = (type: string) => raw.family.base.modules.find((m: { type: string }) => m.type === type);
    mod('hpc').tipSpeed = 100;
    mod('hpt').loading = 0.05;
    mod('lpt').loading = 0.05;
    const p = parseDoc(JSON.stringify(raw));
    expect(p.errors).toEqual([]);
    const notes = p.notes.filter((n) => n.startsWith('Taban:'));
    expect(notes.length).toBe(3);
    const ctx = knobCtx(p.doc!.family.base);
    for (const id of ['hpc.tipSpeed', 'hpt.loading', 'lpt.loading']) {
      const k = knobById(id)!;
      expect(k.get(p.doc!.family.base), id).toBe(k.range(ctx)![0]);
    }
    const gas = buildEngine(p.doc!.family.base).flowpath.gas;
    for (const row of [gas.hpc, gas.hpt, gas.lpt]) expect(row!.stages).toBeLessThan(40);
    // Şablon tabanları aralık içinde: okuma not düşmez, gidiş-dönüş aynı
    for (const [id, g] of Object.entries(TEMPLATES)) {
      if (!g) continue;
      const s = serializeDoc(familyToDoc(family(g)));
      const q = parseDoc(s);
      expect(q.notes.filter((n) => n.startsWith('Taban:')), id).toEqual([]);
      expect(serializeDoc(q.doc!), id).toBe(s);
    }
  });

  it('bozuk girdide atmaz: modül listesi, aile kodu, zarf, uzun ad', () => {
    const raw = () => JSON.parse(serializeDoc(familyToDoc(family(TURBOJET_GRAPH))));
    for (const modules of [[null], [1], ['x'], [{ type: 3 }]]) {
      const r = raw();
      r.family.base.modules = modules;
      let p: ReturnType<typeof parseDoc> | undefined;
      expect(() => (p = parseDoc(JSON.stringify(r))), JSON.stringify(modules)).not.toThrow();
      expect(p!.doc).toBeUndefined();
      expect(p!.errors[0]).toMatch(/modül listesi bozuk/);
    }
    // Proje belgesi de aile başına aynı denetimden geçer
    const r0 = raw();
    r0.family.base.modules = [null];
    const pp = parseProjectDoc(JSON.stringify({ format: 'tfa-workshop', v: 1, families: [r0], active: r0.family.id, expert: false }));
    expect(pp.errors.join(' ')).toMatch(/modül listesi bozuk/);
    // Aile kodu kalıbı
    const rc = raw();
    rc.family.code = '<img src=x onerror=alert(1)>';
    expect(parseDoc(JSON.stringify(rc)).errors[0]).toMatch(/Aile kodu geçersiz/);
    // Zarf: bilinmeyen düğme, aile kapsamlı düğme, sayı olmayan, ters ve sonsuz uçlar atılır
    const re = raw();
    re.family.envelope = { 'hpc.pr': [2.6, 3.2], 'combustor.tit': ['a', 'b'], 'fan.pr': [1, 2], 'lpc.tipSpeed': [300, 400], 'afterburner.t7Max': [2000, 1800], 'yok.boyle': [1, 2] };
    const pe = parseDoc(JSON.stringify(re));
    expect(pe.errors).toEqual([]);
    expect(pe.doc!.family.envelope).toEqual({ 'hpc.pr': [2.6, 3.2], 'fan.pr': [1, 2] });
    expect(pe.notes.filter((n) => /Zarfta/.test(n)).length).toBe(4);
    // Oyuncu metni: uzun ad kısaltılır; bildirimlere kısaltılmış girer
    const rn = raw();
    rn.variants[1].name = 'x'.repeat(200);
    rn.variants[1].values = { ['<b>' + 'y'.repeat(100)]: 1 };
    const pn = parseDoc(JSON.stringify(rn));
    expect(pn.doc!.variants[1].name.length).toBe(64);
    expect(Math.max(...pn.notes.map((n) => n.length))).toBeLessThan(140);
  });
});

describe('proje belgesi', () => {
  it('gidiş-dönüş ve etkin aile', () => {
    const a = familyToDoc(family(TURBOJET_GRAPH));
    const b = familyToDoc(family(TURBOFAN_GRAPH));
    const s = serializeProjectDoc({ format: 'tfa-workshop', v: 1, families: [a, b], active: b.family.id, expert: true, goal: 'regional' });
    const p = parseProjectDoc(s);
    expect(p.errors).toEqual([]);
    expect(serializeProjectDoc(p.doc!)).toBe(s);
    expect(p.doc!.active).toBe(b.family.id);
    expect(p.doc!.goal).toBe('regional');
    expect(parseProjectDoc(JSON.stringify({ ...JSON.parse(s), v: 2 })).errors[0]).toMatch(/v2/);
  });
});
