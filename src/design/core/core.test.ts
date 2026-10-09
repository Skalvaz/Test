import { describe, expect, it } from 'vitest';
import { canonicalJson, fnv1a64 } from './doc';
import { resolveVariant, type Family } from './family';
import { clampKnob, getPath, setPath, type KnobDef } from './knob';
import { evaluateRules, type Rule } from './rules';

describe('kanonik JSON ve özet', () => {
  it('FNV-1a 64 bilinen değerler', () => {
    expect(fnv1a64('')).toBe(BigInt('0xcbf29ce484222325').toString(36));
    expect(fnv1a64('a')).toBe(BigInt('0xaf63dc4c8601ec8c').toString(36));
    expect(fnv1a64('foobar')).toBe(BigInt('0x85944171f73967e8').toString(36));
    // UTF-8 baytları üzerinde
    expect(fnv1a64('ş')).not.toBe(fnv1a64('s'));
  });

  it('anahtar sırası, sayılar, undefined, NFC', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: -0 }] })).toBe('{"a":[2,{"c":0}],"b":1}');
    expect(canonicalJson(0.1 + 0.2)).toBe('0.3');
    expect(canonicalJson(1234567.89)).toBe('1234568');
    expect(canonicalJson('ş')).toBe(canonicalJson('ş'));
    expect(() => canonicalJson({ x: NaN })).toThrow();
    expect(() => canonicalJson([Infinity])).toThrow();
  });

  it('order: modül dizisi tip sırasında, anahtarlar verilen sırada', () => {
    const order = { modules: ['inlet', 'hpc', 'nozzle'], meta: ['z', 'a'] };
    const a = canonicalJson({ modules: [{ type: 'nozzle' }, { type: 'inlet' }, { type: 'hpc' }], meta: { a: 1, z: 2, m: 3 } }, { order });
    expect(a).toBe('{"meta":{"z":2,"a":1,"m":3},"modules":[{"type":"inlet"},{"type":"hpc"},{"type":"nozzle"}]}');
  });
});

describe('düğme yardımcıları', () => {
  const model = { hpc: { pr: 10, mach: [0.4, 0.2] }, name: 'x' };
  const knob: KnobDef<typeof model, { hi: number }> = {
    id: 'hpc.pr',
    path: ['hpc', 'pr'],
    group: 'hpc',
    label: 'PR',
    explain: '',
    unit: '',
    type: 'number',
    range: (c) => [2, c.hi],
    step: 0.1,
    level: 'basic',
    scope: 'variant',
    preview: 'exact',
    get: (m) => getPath(m, ['hpc', 'pr']) as number,
    set: (m, v) => setPath(m, ['hpc', 'pr'], v),
  };

  it('setPath girdiyi değiştirmez, yolu kopyalar, diğer dalları paylaşır', () => {
    const m2 = setPath(model, ['hpc', 'mach', 1], 0.25);
    expect(model.hpc.mach[1]).toBe(0.2);
    expect(m2.hpc.mach).toEqual([0.4, 0.25]);
    expect(m2.name).toBe('x');
    expect(getPath(m2, ['hpc', 'mach', 1])).toBe(0.25);
    expect(getPath(m2, ['yok', 'x'])).toBeUndefined();
    expect(setPath({}, ['a', 0, 'b'], 1)).toEqual({ a: [{ b: 1 }] });
  });

  it('clampKnob tipe ve aralığa kırpar', () => {
    expect(clampKnob(knob, 30, { hi: 25 })).toBe(25);
    expect(clampKnob(knob, 'abc', { hi: 25 })).toBe(2);
    expect(clampKnob({ ...knob, type: 'int', range: () => [6, 16] }, 7.6, { hi: 0 })).toBe(8);
    expect(clampKnob({ ...knob, type: 'enum', options: ['a', 'b'] }, 'c', { hi: 0 })).toBe('a');
    expect(clampKnob({ ...knob, type: 'bool' }, 'true', { hi: 0 })).toBe(true);
  });

  it('resolveVariant: taban klonu + zarf + aralık', () => {
    const fam: Family<typeof model, unknown> = {
      id: 'f',
      code: 'AT-1',
      name: 'Aile',
      base: model,
      envelope: { 'hpc.pr': [8, 12] },
      variants: [{ id: 'v1', name: 'AT-1/1', nameLocked: false, values: { 'hpc.pr': 20, 'yok.knob': 1 } }],
      active: 'v1',
      origin: { from: 'template' },
    };
    const m = resolveVariant(fam, 'v1', new Map([['hpc.pr', knob]]), { hi: 25 });
    expect(m.hpc.pr).toBe(12);
    expect(model.hpc.pr).toBe(10);
    expect(() => resolveVariant(fam, 'yok', new Map(), {})).toThrow();
  });
});

describe('kurallar', () => {
  const rule = (id: string, dir: Rule<number>['dir'], lims: ReturnType<Rule<number>['limits']>, infoOnly = false): Rule<number> => ({
    id,
    group: 'g',
    metric: (v) => v,
    dir,
    limits: () => lims,
    unit: '',
    digits: 2,
    title: (v) => `${id} ${v}`,
    text: (v, lim) => `${v} > ${lim}`,
    fix: '',
    tags: () => [],
    knobs: [],
    infoOnly,
  });

  it('önem ve sıralama', () => {
    const rules = [rule('b', 'above', { caution: 1, warning: 2 }), rule('a', 'above', { caution: 1 }), rule('c', 'below', { caution: 5 }), rule('i', 'above', { caution: 0 }, true)];
    const f = evaluateRules(rules, 3);
    expect(f.map((x) => [x.id, x.severity, x.limit])).toEqual([
      ['b', 'warning', 2],
      ['a', 'caution', 1],
      ['c', 'caution', 5],
      ['i', 'info', 0],
    ]);
  });

  it('aralık dışı (outside)', () => {
    const r = rule('m', 'outside', { caution: [0.92, 1.12], warning: [0.85, 1.2] });
    expect(evaluateRules([r], 1)).toEqual([]);
    expect(evaluateRules([r], 0.9)[0].severity).toBe('caution');
    expect(evaluateRules([r], 1.3)[0]).toMatchObject({ severity: 'warning', limit: 1.2 });
  });
});
