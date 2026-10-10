/**
 * Düğme aralığı taraması, 3B model DAHİL (M5a bakım, dalga 1 açığı): askeri
 * TF türevinde fan.bypassRatio 1,2'de tasarım kuruluyor ama 3B LPT diski
 * göbek mile inince ters dönüyor, üretici RangeError ("Invalid typed array
 * length") atıyordu; bulanık test 3B'yi kurmadığı için görmedi. Burada her
 * ailenin her TEMEL düğmesi aralığın iki ucunda ve içinde (tek tek) taranır;
 * geçerli tasarımın tam 3B modeli node'da kurulur. Sonuç ya tipli öğretici
 * hata ya da kurulmuş model olmalı: TypeError/RangeError yok.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../design/catalog';
import { evaluate } from '../design/evaluate';
import { buildEngine } from '../design/graph';
import { clampEngineKnob, ENGINE_KNOBS, knobCtx } from '../design/knobs';
import type { TemplateId } from '../design/templates';
import type { CompressorModule, EngineGraph, NozzleModule } from '../design/types';
import { MODEL_BUILDERS, type Materials } from './models';

// Tarayıcısız ortamda tuval (bulanıklık diski dokusu): her çağrıyı yutan sahte nesne
const sink: unknown = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : sink),
  apply: () => sink,
});
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => sink }) };

/** Kütüphane yerine: her ada kendi adını taşıyan düz malzeme */
function namedMaterials(): Materials {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  return new Proxy({} as Materials, {
    get: (_t, k) => {
      if (typeof k !== 'string') return undefined;
      let m = cache.get(k);
      if (!m) cache.set(k, (m = Object.assign(new THREE.MeshStandardMaterial(), { name: k })));
      return m;
    },
  });
}
const MATS = namedMaterials();

/** Tasarım + 3B: 'ok', tipli hatanın başlığı ya da (olmamalı) tipsiz hata */
function tryBuild(g: EngineGraph, reference: ReturnType<typeof buildEngine>, model = true): { ok: true } | { typed: string; raw: string } | { untyped: string } {
  try {
    const e = evaluate(g, { reference, remedies: false });
    if ('error' in e) return { typed: e.error.title, raw: e.error.raw };
    const b = e.built;
    if (model) MODEL_BUILDERS[b.traits.layout](MATS, { slot: 'workshop', built: b, layout: b.flowpath.layout, traits: b.traits });
    return { ok: true };
  } catch (err) {
    return { untyped: `${(err as Error).name}: ${(err as Error).message}` };
  }
}

const FAMILIES = (Object.keys(TEMPLATES) as TemplateId[]).filter((id) => TEMPLATES[id]);

/**
 * Tasarım her noktada; 3B (nokta başına 0,1–0,5 s, varsayılan takımda
 * başka dosyaların 5 s'lik testlerini zaman aşımına düşürmesin diye):
 * çıplak motorlarda (sorunun yerleşimi) aralık uçlarında, kaportalı ve
 * pervaneli modellerde hava akışı uçlarında (boyut uçları). Bütün ailelerde bütün temel düğmelerin 3B
 * taraması (21 nokta) bir kez elle koşuldu: tipsiz hata yalnız bu açık.
 */
describe('temel düğme taraması (3B dahil): tipli hata ya da kurulmuş model', () => {
  it.each(FAMILIES)('%s: her temel düğme uçlarda ve içinde', (id) => {
    const base = TEMPLATES[id]!;
    const bare = buildEngine(base).traits.layout === 'bare';
    const reference = buildEngine(base);
    const ctx = knobCtx(base);
    const bad: string[] = [];
    let built = 0;
    for (const k of ENGINE_KNOBS) {
      if (k.level !== 'basic' || (k.type !== 'number' && k.type !== 'int')) continue;
      const r = k.range(ctx);
      if (!r || k.get(base) === undefined) continue;
      const N = 4;
      for (let i = 0; i <= N; i++) {
        const v = k.scale === 'log' ? r[0] * Math.pow(r[1] / r[0], i / N) : r[0] + ((r[1] - r[0]) * i) / N;
        const end = i === 0 || i === N;
        const model = bare ? end : k.id === 'engine.massFlow' && end;
        const res = tryBuild(k.set(base, clampEngineKnob(k, v, ctx)), reference, model);
        if ('untyped' in res) bad.push(`${k.id}=${v}: ${res.untyped}`);
        if ('ok' in res) built++;
      }
    }
    expect(bad).toEqual([]);
    expect(built).toBeGreaterThan(0);
  }, 60_000);
});

/** Askeri TF türevi: art yakıcılı ya da kuru (Spey sınıfı), verilen FPR ve BPR */
function mtf(bpr: number, fpr: number, dry: boolean): EngineGraph {
  const g = structuredClone(TEMPLATES.militaryTurbofan!);
  if (dry) {
    g.modules = g.modules.filter((m) => m.type !== 'afterburner');
    const n = g.modules.find((m) => m.type === 'nozzle') as NozzleModule;
    n.style = 'fixed';
    delete n.flaps;
  }
  const fan = g.modules.find((m) => m.type === 'fan') as CompressorModule;
  fan.pr = fpr;
  fan.bypassRatio = bpr;
  return g;
}

describe('askeri TF türevi: baypas oranı 0,1–1,5 (adım 0,05)', () => {
  const reference = buildEngine(TEMPLATES.militaryTurbofan!);
  const BPRS = Array.from({ length: 29 }, (_, i) => Math.round((0.1 + 0.05 * i) * 100) / 100);

  it.each([
    ['art yakıcılı', false],
    ['kuru', true],
  ] as const)('%s, şablon FPR 4,3: sınıra dek kurulur, ötesi tipli öğretici hata (1,2 dahil)', (_n, dry) => {
    const fpr = (TEMPLATES.militaryTurbofan!.modules.find((m) => m.type === 'fan') as CompressorModule).pr;
    const out = BPRS.map((b) => [b, tryBuild(mtf(b, fpr, dry), reference)] as const);
    expect(out.filter(([, r]) => 'untyped' in r)).toEqual([]);
    // Geçerli bölge şablonun BPR'ını (0,55) içerir ve bitişiktir; sınırın
    // ötesi LPT diski / LPT kanalı hatası (BPR 1,2 eskiden RangeError'dı)
    const ok = out.filter(([, r]) => 'ok' in r).map(([b]) => b);
    expect(ok).toContain(0.55);
    const hi = Math.max(...ok);
    for (const [b, r] of out) {
      if (b <= hi) expect('ok' in r, `BPR ${b}`).toBe(true);
      else expect('typed' in r && /LPT (diski mile sığmıyor|kanalı kapanıyor)/.test(r.typed), `BPR ${b}: ${JSON.stringify(r)}`).toBe(true);
    }
    expect(hi).toBeGreaterThanOrEqual(0.75);
    expect(hi).toBeLessThan(1.2);
  }, 60_000);

  it('sınır FPR’ye bağlı: düşük FPR’de bütün aralık (1,5’e dek) kurulur — aralık daraltılmaz', () => {
    for (const fpr of [2.2, 2.6]) {
      for (const dry of [false, true]) {
        // Tasarım her noktada, 3B en büyük BPR'da
        const bad = BPRS.map((b) => [b, tryBuild(mtf(b, fpr, dry), reference, b === 1.5)] as const).filter(([, r]) => !('ok' in r));
        expect(bad, `FPR ${fpr}${dry ? ' kuru' : ''}`).toEqual([]);
      }
    }
  }, 60_000);

  it('BPR 1,2 öğretici hata: göbek ve mil ölçüsü, BPR/FPR ve LPT düğmeleri', () => {
    const e = evaluate(mtf(1.2, 4.3, false), { reference, remedies: false });
    if (!('error' in e)) throw new Error('hata bekleniyordu');
    expect(e.error.title).toBe('LPT diski mile sığmıyor');
    expect(e.error.text).toMatch(/BPR ya da FPR/);
    expect(e.error.text).toMatch(/\d+,\d cm/);
    expect(e.error.knobs).toEqual(['fan.bypassRatio', 'fan.pr', 'lpt.taper', 'lpt.mach.1']);
    expect(e.error.source).toBe('flowpath');
  });
});
