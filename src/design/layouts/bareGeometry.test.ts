/**
 * Çıplak motor yerleşiminin geometri tutarlılığı (dalga 1 inceleme
 * düzeltmeleri): düşük BPR'li karışık akışlı turbofanda gaz yolu türbin
 * çıkışında içe basamak yapmaz, kabuk türbini sarar, lobe'lu karıştırıcı
 * kanalın içinde kalır; kuru motorun jet borusu ve sabit lülesi kütle
 * merkezine kendi yerlerinde girer.
 */

import { describe, expect, it } from 'vitest';
import { massCentroidZ } from '../card';
import type { BareJetLayout } from '../flowpath';
import { buildEngine } from '../graph';
import { MILITARY_TURBOFAN_GRAPH } from '../templates';
import { TURBOJET_DRY_GRAPH } from '../turbojetDry';
import type { CompressorModule, EngineGraph, MixerModule, NozzleModule } from '../types';

/** Askeri TF'den türetilmiş çeşit: BPR, kuru (art yakıcısız, sabit lüle), lobe'lu karıştırıcı */
function variant(bpr: number, o: { dry: boolean; lobed: boolean }): EngineGraph {
  const g = structuredClone(MILITARY_TURBOFAN_GRAPH);
  if (o.dry) {
    g.modules = g.modules.filter((m) => m.type !== 'afterburner');
    const n = g.modules.find((m) => m.type === 'nozzle') as NozzleModule;
    n.style = 'fixed';
    delete n.flaps;
  }
  const fan = g.modules.find((m) => m.type === 'fan') as CompressorModule;
  fan.bypassRatio = bpr;
  // Şablonun FPR'ı (4,3) BPR ≳ 0,8'de LPT'yi mile sığmayacak kadar
  // genişletir (layouts/bare.ts checkLptDisk); yüksek BPR'da fiziksel FPR
  if (bpr > 0.8) fan.pr = 3;
  if (o.lobed) {
    const mx = g.modules.find((m) => m.type === 'mixer') as MixerModule;
    mx.style = 'lobed';
    mx.lobes = 14;
  }
  return g;
}

describe('düşük BPR karışık akışlı çıplak turbofan (inceleme #15)', () => {
  // Atölye aralığı 0,1–1,5; BPR > 0,8 FPR 3 ile (şablon FPR'ında LPT diski sığmaz, ayrı tipli hata)
  const cases = [0.1, 0.2, 0.3, 0.55, 1.0, 1.5].flatMap((bpr) =>
    [true, false].flatMap((dry) => [true, false].map((lobed) => [bpr, dry, lobed] as const)),
  );

  it.each(cases)('BPR %s · kuru %s · lobe %s: kanal türbin çıkışından dar değil, kabuk türbini sarar', (bpr, dry, lobed) => {
    const L = buildEngine(variant(bpr, { dry, lobed })).flowpath.layout as BareJetLayout;
    const tip = L.gas.lpt.tip[1];
    const caseEnd = L.gas.casing[L.gas.casing.length - 1][0];
    // Dış kabuk türbin gövdesinin dışında
    expect(L.R).toBeGreaterThanOrEqual(tip + 0.05 - 1e-12);
    expect(L.R).toBeGreaterThan(caseEnd);
    // Egzoz kanalının iç duvarı türbin çıkış ucunun dışında (içe basamak yok)
    const wall = dry ? L.jetPipe!.r : L.ab!.liner;
    expect(wall).toBeGreaterThanOrEqual(tip + 0.01 - 1e-12);
    if (dry) expect(L.jetPipe!.r).toBeLessThan(L.R);
    if (lobed) {
      const m = L.mixer!;
      expect(m.amp).toBeGreaterThan(0);
      // Lobe tepesi kanal duvarının, çukuru türbin ucunun hemen altının içinde
      expect(m.r + m.amp).toBeLessThan(wall);
      expect(m.r + m.amp).toBeLessThan(L.R);
      expect(m.r - m.amp).toBeGreaterThan(L.gas.lpt.hub[1]);
    } else expect(L.mixer).toBeUndefined();
  });
});

describe('kuru motor kütle merkezleri (inceleme #24)', () => {
  it('jet borusu ve sabit lüle kendi boylarının ortasında; ağırlık merkezi tutarlı', () => {
    const b = buildEngine(TURBOJET_DRY_GRAPH);
    const L = b.flowpath.layout as BareJetLayout;
    const m = b.flowpath.metrics.mass;
    const n = L.nozzle;
    if (n.kind !== 'fixed' || !L.jetPipe) throw new Error('sabit lüle ve jet borusu bekleniyordu');
    expect(m.centroids.jetPipe).toBeCloseTo((L.jetPipe.z0 + L.jetPipe.z1) / 2, 9);
    expect(m.centroids.nozzle).toBeCloseTo((n.z0 + n.z1) / 2, 9);
    // Ağırlık merkezi kalemlerin kütle ağırlıklı ortalaması; kart aynı değeri gösterir
    let mz = 0;
    for (const [k, kg] of Object.entries(m.parts)) mz += kg * m.centroids[k];
    expect(m.cgZ).toBeCloseTo(mz / m.total, 9);
    expect(massCentroidZ(b)).toBeCloseTo(m.cgZ, 9);
  });

  it('art yakıcılı şablonda lüle kalemi değişmedi (art yakıcı çıkışı ile lüle ağzı arası)', () => {
    const b = buildEngine(MILITARY_TURBOFAN_GRAPH);
    const L = b.flowpath.layout as BareJetLayout;
    expect(b.flowpath.metrics.mass.centroids.nozzle).toBeCloseTo((L.ab!.z1 + L.exhaustExit.z) / 2, 9);
  });
});
