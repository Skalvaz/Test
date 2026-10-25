/**
 * CSS sırası denetimi (Dalga 0 bölmesinden sonra): bileşen dosyaları
 * `index.css` sırasıyla birleşir; aynı özgüllükteki iki kuralda sonraki
 * kazanır. Bölme bir kuralın kazananını değiştirebilir (Dalga 0 denetimi:
 * manuel yakıt kaydırıcısı camgöbeğinden kehribara döndü). Bu test küçük
 * bir kademe (cascade) hesaplayıcısıyla bilinen hassas öğelerin değerini
 * sınar; yeni bir sıra bağımlılığı bulunca buraya bir satır eklenir.
 *
 * Hesaplayıcı bilerek basittir: yalnız en üst düzey kurallar (@media
 * içi sayılmaz), soy ve çocuk birleştiricileri, etiket/sınıf/kimlik/öznitelik
 * seçicileri; durum sözde sınıfları (:hover…) ve sözde öğeler eşleşmez.
 */

import { describe, expect, it } from 'vitest';
import indexCss from './index.css?raw';

const files = import.meta.glob('./*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

interface Rule {
  selector: string;
  decls: Map<string, { value: string; important: boolean }>;
  order: number;
  file: string;
}

/** Yorumları at, en üst düzey kuralları sırayla çıkar (@-blokları atlanır) */
function parseRules(css: string, file: string, start: number): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  let i = 0;
  let order = start;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const head = src.slice(i, open).trim();
    // Eşleşen kapanış (iç içe bloklar)
    let depth = 1;
    let j = open + 1;
    for (; j < src.length && depth; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
    }
    const body = src.slice(open + 1, j - 1);
    // @import satırları başlığın önünde kalabilir: son ';' sonrası seçicidir
    const sel = head.slice(head.lastIndexOf(';') + 1).trim();
    if (sel && !sel.startsWith('@')) {
      const decls = new Map<string, { value: string; important: boolean }>();
      for (const d of body.split(';')) {
        const k = d.indexOf(':');
        if (k < 0) continue;
        const prop = d.slice(0, k).trim().toLowerCase();
        let value = d.slice(k + 1).trim();
        const important = /!important\s*$/i.test(value);
        value = value.replace(/\s*!important\s*$/i, '');
        if (prop) decls.set(prop, { value, important });
      }
      for (const s of splitTop(sel, ',')) out.push({ selector: s.trim(), decls, order: order++, file });
    }
    i = j;
  }
  return out;
}

/** Parantez dışındaki ayırıcıya göre böl */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === sep && !depth) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Bütün bileşen dosyaları index.css'teki @import sırasıyla */
function allRules(): Rule[] {
  const order = [...indexCss.matchAll(/@import\s+['"]\.\/([\w-]+\.css)['"]/g)].map((m) => m[1]);
  const rules: Rule[] = [];
  for (const f of order) {
    const css = files[`./${f}`];
    if (css === undefined) throw new Error(`index.css içe aktarıyor ama dosya yok: ${f}`);
    rules.push(...parseRules(css, f, rules.length));
  }
  return rules;
}

/** Öğe tanımı (sayfadaki DOM'un özeti) */
interface El {
  tag: string;
  classes?: string[];
  id?: string;
  attrs?: Record<string, string>;
}

interface Compound {
  tag: string | null;
  ids: string[];
  classes: string[];
  attrs: [string, string | null][];
  /** Değerlendirilemeyen sözde sınıf ya da sözde öğe: eşleşmez */
  unknown: boolean;
  nots: Compound[];
}

function parseCompound(s: string): Compound {
  const c: Compound = { tag: null, ids: [], classes: [], attrs: [], unknown: false, nots: [] };
  const re = /^([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:\s*=\s*(['"]?)([^'"\]]*)\5)?\]|::?([\w-]+)(\(([^)]*)\))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) c.tag = m[1] === '*' ? null : m[1].toLowerCase();
    else if (m[2]) c.ids.push(m[2]);
    else if (m[3]) c.classes.push(m[3]);
    else if (m[4]) c.attrs.push([m[4], m[6] ?? null]);
    else if (m[7]) {
      if (m[7] === 'not' && m[9]) c.nots.push(parseCompound(m[9]));
      else if (m[7] !== 'root') c.unknown = true;
    }
  }
  return c;
}

/** Seçici → birleşik parçalar ve birleştiriciler (soldan sağa) */
function parseSelector(sel: string): { parts: Compound[]; combs: string[] } | null {
  const tokens = sel.replace(/\s*([>+~])\s*/g, ' $1 ').trim().split(/\s+/);
  const parts: Compound[] = [];
  const combs: string[] = [];
  let pending = ' ';
  for (const t of tokens) {
    if (t === '>' || t === '+' || t === '~') {
      pending = t;
      continue;
    }
    if (parts.length) combs.push(pending);
    parts.push(parseCompound(t));
    pending = ' ';
  }
  // Kardeş birleştiricileri bu hesaplayıcıda yok
  if (combs.some((c) => c === '+' || c === '~')) return null;
  return { parts, combs };
}

function matchCompound(c: Compound, el: El): boolean {
  if (c.unknown) return false;
  if (c.tag && c.tag !== el.tag) return false;
  if (c.ids.some((i) => i !== el.id)) return false;
  if (c.classes.some((k) => !(el.classes ?? []).includes(k))) return false;
  for (const [a, v] of c.attrs) {
    const have = el.attrs?.[a];
    if (have === undefined) return false;
    if (v !== null && have !== v) return false;
  }
  return !c.nots.some((n) => matchCompound(n, el));
}

/** chain: kökten hedefe öğeler (son öğe hedef) */
function matches(sel: string, chain: El[]): boolean {
  const p = parseSelector(sel);
  if (!p) return false;
  const { parts, combs } = p;
  const go = (pi: number, ei: number): boolean => {
    if (!matchCompound(parts[pi], chain[ei])) return false;
    if (pi === 0) return true;
    if (combs[pi - 1] === '>') return ei > 0 && go(pi - 1, ei - 1);
    for (let k = ei - 1; k >= 0; k--) if (go(pi - 1, k)) return true;
    return false;
  };
  return go(parts.length - 1, chain.length - 1);
}

function specificity(sel: string): [number, number, number] {
  let a = 0;
  let b = 0;
  let c = 0;
  const p = parseSelector(sel);
  for (const part of p?.parts ?? []) {
    a += part.ids.length;
    b += part.classes.length + part.attrs.length + part.nots.reduce((s, n) => s + n.classes.length + n.attrs.length, 0);
    if (part.tag) c++;
  }
  // Sözde sınıflar (b) ve sözde öğeler (c): kaba sayım
  b += (sel.match(/(^|[^:]):(?!not\()[\w-]+/g) ?? []).length;
  c += (sel.match(/::[\w-]+/g) ?? []).length;
  return [a, b, c];
}

/** Hedef öğedeki özelliğin kademeden gelen değeri ve kuralı */
function cascaded(rules: Rule[], chain: El[], prop: string): { value: string; rule: Rule } | null {
  let best: { rule: Rule; spec: [number, number, number]; imp: boolean } | null = null;
  for (const r of rules) {
    const d = r.decls.get(prop);
    if (!d || !matches(r.selector, chain)) continue;
    const spec = specificity(r.selector);
    const better =
      !best ||
      (d.important && !best.imp) ||
      (d.important === best.imp &&
        (spec[0] - best.spec[0] || spec[1] - best.spec[1] || spec[2] - best.spec[2] || r.order - best.rule.order) > 0);
    if (better) best = { rule: r, spec, imp: d.important };
  }
  return best ? { value: best.rule.decls.get(prop)!.value, rule: best.rule } : null;
}

describe('CSS sırası (index.css)', () => {
  const rules = allRules();
  const body: El = { tag: 'body' };

  it('her bileşen dosyası index.css\'ten yüklenir', () => {
    const imported = new Set([...indexCss.matchAll(/@import\s+['"]\.\/([\w-]+\.css)['"]/g)].map((m) => m[1]));
    const all = Object.keys(files)
      .map((f) => f.slice(2))
      .filter((f) => f !== 'index.css');
    expect(all.filter((f) => !imported.has(f))).toEqual([]);
  });

  it('manuel yakıt kaydırıcısı Dalga 0 öncesindeki gibi camgöbeği (base.css range kuralı kazanır)', () => {
    const chain: El[] = [
      body,
      { tag: 'div', classes: ['console'] },
      { tag: 'div', classes: ['manual-fuel'] },
      { tag: 'input', attrs: { type: 'range' } },
    ];
    const r = cascaded(rules, chain, 'accent-color');
    expect(r?.value).toBe('var(--accent)');
    expect(r?.rule.file).toBe('base.css');
    // Satırın kendi düzeni değişmedi
    expect(cascaded(rules, chain, 'flex')?.value).toBe('1');
  });

  it('test hücresinin motor özeti 12 px (cockpit.css, lesson.css\'ten sonra)', () => {
    const chain: El[] = [body, { tag: 'aside' }, { tag: 'p', classes: ['step-body', 'engine-summary'] }];
    const r = cascaded(rules, chain, 'font-size');
    expect(r?.value).toBe('12px');
    expect(r?.rule.file).toBe('cockpit.css');
  });

  it('hesaplayıcı: özgüllük ve sıra', () => {
    expect(specificity(".manual-fuel input")).toEqual([0, 1, 1]);
    expect(specificity("input[type='range']")).toEqual([0, 1, 1]);
    expect(specificity('#a .b:hover::before')).toEqual([1, 2, 1]);
    expect(matches('.a > .b', [body, { tag: 'div', classes: ['a'] }, { tag: 'p', classes: ['b'] }])).toBe(true);
    expect(matches('.a > .b', [body, { tag: 'div', classes: ['a'] }, { tag: 'div' }, { tag: 'p', classes: ['b'] }])).toBe(false);
    expect(matches('.b:not(.c)', [body, { tag: 'p', classes: ['b', 'c'] }])).toBe(false);
    expect(matches('.b:hover', [body, { tag: 'p', classes: ['b'] }])).toBe(false);
  });
});
