/**
 * Düğme bulanık testi (M5a P4b, docs/M5A-SPEC.md §7.1): her aile için
 * tohumlu rastgele TEMEL düğme kümeleri. Sonuç ya tipli Türkçe hata
 * (GraphError | FlowpathError | DesignError) ya geçerli motor olmalı; NaN,
 * TypeError ya da undefined erişimi kabul edilmez. Geçerli motorlar
 * `trim(0, 30)` ile yanıp rölantiye oturmalı.
 *
 * Aile başına ayrı test dosyası (fuzz/*.test.ts): vitest dosyaları
 * paralel koşturur, trim (~0,3 s) çok sayıda olduğu için. Tam küme yalnız
 * `npm run test:fuzz` ile (aşağıda `FUZZ_FULL`).
 */

import { describe, expect, it } from 'vitest';
import { DesignError } from '../../sim/design';
import { EngineSim } from '../../sim/engineSim';
import { TEMPLATES } from '../catalog';
import { FlowpathError } from '../flowpath';
import { buildEngine, GraphError, type BuiltEngine } from '../graph';
import { buildChecked, clampEngineKnob, ENGINE_KNOBS, knobCtx } from '../knobs';
import type { TemplateId } from '../templates';
import type { EngineGraph } from '../types';
import { layoutNotReady } from '../layouts/index';

/** Şablonu var ve yerleşimi hazır aile (P5–P7 birleşene dek bazıları atlanır) */
export function familyReady(id: TemplateId): boolean {
  const g = TEMPLATES[id];
  return !!g && layoutNotReady(g) === null;
}

export interface FuzzResult {
  family: TemplateId;
  total: number;
  valid: number;
  /** Tipli hata mesajı → sayı */
  errors: Record<string, number>;
  /** Tipsiz hata ya da NaN (olmamalı) */
  bad: string[];
  /** Rölantiye oturan geçerli motor sayısı ve oturmayanların özeti */
  idle: number;
  notIdle: string[];
}

/** Tohumlu rastgele sayı (mulberry32) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

/** Atölye tabanı: şablon, kind'sız ve ops'suz (çalışabilirlik şablondan ölçeklenir) */
function workshopBase(g: EngineGraph): EngineGraph {
  const c = structuredClone(g);
  delete c.kind;
  delete c.ops;
  return c;
}

/** Rastgele temel düğme kümesi (log ölçekte log-düzgün) */
export function randomBasic(base: EngineGraph, r: () => number): EngineGraph {
  const ctx = knobCtx(base);
  let g = base;
  for (const k of ENGINE_KNOBS) {
    if (k.level !== 'basic') continue;
    const range = k.range(ctx);
    if (!range || k.get(base) === undefined) continue;
    const u = r();
    const v = k.scale === 'log' ? range[0] * Math.pow(range[1] / range[0], u) : range[0] + u * (range[1] - range[0]);
    g = k.set(g, clampEngineKnob(k, v, ctx));
  }
  return g;
}

export function fuzzFamily(id: TemplateId, n = 200, seed = 20261009, o: { trim?: boolean } = {}): FuzzResult {
  const tmpl = TEMPLATES[id]!;
  const ref: BuiltEngine = buildEngine(tmpl);
  const base = workshopBase(tmpl);
  const r = rng(seed);
  const res: FuzzResult = { family: id, total: n, valid: 0, errors: {}, bad: [], idle: 0, notIdle: [] };
  for (let i = 0; i < n; i++) {
    const g = randomBasic(base, r);
    let b: BuiltEngine;
    try {
      b = buildChecked(g, { reference: ref });
    } catch (e) {
      const typed = e instanceof GraphError || e instanceof FlowpathError || e instanceof DesignError;
      const msg = e instanceof Error ? e.message : String(e);
      if (!typed || !TURKISH.test(msg) || /undefined|NaN/.test(msg)) res.bad.push(`${i}: ${String(e)}`);
      else {
        // Sayıları atıp mesaj kalıbına göre say
        const key = msg.replace(/[\d.,]+/g, '#');
        res.errors[key] = (res.errors[key] ?? 0) + 1;
      }
      continue;
    }
    res.valid++;
    if (o.trim === false) continue;
    const sim = new EngineSim(b.design);
    sim.trim(0, 30);
    // Rölanti: yanıyor, N2 rölanti sınırının altında asılı değil (§2.11
    // idleTrim: N2 ≥ idleN2 − 0,03) ve oturmuş (2 s daha: N2 değişmiyor)
    const n2 = sim.N2;
    for (let s = 0; s < 120; s++) sim.step(1 / 60);
    const idleN2 = sim.limits.idleN2;
    if (sim.lit && Number.isFinite(sim.N1) && n2 >= idleN2 - 0.03 && Math.abs(sim.N2 - n2) < 0.01) res.idle++;
    else res.notIdle.push(`${i}: lit=${sim.lit} N2=${n2.toFixed(3)}→${sim.N2.toFixed(3)} (rölanti ${idleN2}) W=${g.massFlow.toFixed(1)}`);
  }
  return res;
}

/**
 * Tam bulanık test (aile başına 200 küme, §7.1 kabulü) yalnız
 * `npm run test:fuzz` (`vitest run --mode fuzz src/design/fuzz`) ile koşar:
 * dört-yedi ağır dosya varsayılan takımda CPU'yu doldurup başka dosyaların
 * 5 s'lik testlerini zaman aşımına düşürüyordu. Varsayılan `npm test`'te
 * aile başına aynı tohumdan küçük bir duman kümesi koşar (birkaç saniye).
 */
export const FUZZ_FULL = import.meta.env.MODE === 'fuzz';
/** Varsayılan takımdaki duman kümesi büyüklüğü */
export const FUZZ_SMOKE_N = 20;

/** Aile için bulanık test bloğu (aile başına ayrı dosyadan çağrılır) */
export function defineFuzz(id: TemplateId, n = 200): void {
  const full = FUZZ_FULL;
  const count = full ? n : FUZZ_SMOKE_N;
  describe.skipIf(!familyReady(id))(`bulanık test: ${id}`, () => {
    it(`${count} rastgele temel düğme kümesi: tipli hata ya da çalışan motor${full ? '' : ' (duman; tamamı npm run test:fuzz)'}`, () => {
      const r = fuzzFamily(id, count);
      // Tipsiz hata, NaN ya da undefined erişimi yok
      expect(r.bad).toEqual([]);
      // Geçerli oran ≥ %70 (değilse §2.10 aralıkları daraltılır); dumanda en az bir geçerli motor
      if (full) expect(r.valid / r.total, JSON.stringify(r.errors)).toBeGreaterThanOrEqual(0.7);
      else expect(r.valid, JSON.stringify(r.errors)).toBeGreaterThan(0);
      // Geçerlilerin ≥ %90'ı trim(0, 30) ile yanar ve rölantiye oturur
      expect(r.idle / r.valid, r.notIdle.slice(0, 5).join(' | ')).toBeGreaterThanOrEqual(0.9);
    }, full ? 600_000 : 120_000);
  });
}
