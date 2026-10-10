/**
 * Atölye arayüzü (M5a P10) inceleme bulgularının regresyon testleri: saf
 * karar işlevleri (test hücresi karşılaştırması, klavye odak kuralları,
 * aile sekmesi anahtarı, kütle kalemi → 3B parça, istasyon tablosu, sayı
 * kutusu ayrıştırma). DOM davranışları tarayıcıda ayrıca sınandı.
 */
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../design/catalog';
import { buildEngine } from '../../design/graph';
import { PART_TAGS } from '../../design/partsMap';
import { summarize } from '../../design/summary';
import type { TemplateId } from '../../design/templates';
import { cellCompare, type CellCompareInput } from './cellCompare';
import { focusOnCanvas, keyOwnedByTarget, plainKey } from './keys';
import { parseNumInput } from './KnobField';
import { massPartTags, stationRows } from './ResultsPanel';
import { familyViewKey } from './WorkshopPanel';

const ISA = { altitude: 0, mach: 0, isaDev: 0 };
const FULL = { throttle: 1, reheat: 0 };
const live = (o: Partial<CellCompareInput['live']> = {}): CellCompareInput['live'] => ({
  thrust: 0,
  shaftPower: 0,
  lit: true,
  egtLimited: false,
  N1: 1,
  n1Command: 1,
  ...o,
});

describe('test hücresi: beklenen / ölçülen (§6.9 madde 5)', () => {
  const jet = { output: 'thrust' as const, thrust: 96849, thrustWet: undefined, shaftPower: undefined };

  it('ölçülen canlı itkidir: tasarım noktasından %5 düşük canlı değer farkı gösterir', () => {
    const c = cellCompare({ expected: jet, live: live({ thrust: 96849 * 0.95 }), flight: ISA, controls: FULL, healthy: true });
    expect(c.got).toBeCloseTo(92.0, 0);
    expect(c.pct).toBeCloseTo(-5, 1);
    expect(c.off).toBe(true);
  });

  it('±%3 içinde uyumlu', () => {
    const c = cellCompare({ expected: jet, live: live({ thrust: 96566.76 }), flight: ISA, controls: FULL, healthy: true });
    expect(Math.abs(c.pct!)).toBeLessThan(1);
    expect(c.why).toContain('uyumlu');
  });

  it('10 km / M0,8 uçuşta yüzde verilmez: "ISA deniz seviyesinde" denir', () => {
    const c = cellCompare({ expected: jet, live: live({ thrust: 23786 }), flight: { altitude: 10000, mach: 0.8, isaDev: 0 }, controls: FULL, healthy: true });
    expect(c.pct).toBeNull();
    expect(c.got).toBeCloseTo(23.8, 1);
    expect(c.why).toContain('ISA deniz seviyesinde');
  });

  it('mil gücü ailesi canlı mil gücüyle kıyaslanır (0 / −%100 değil)', () => {
    const shaft = { output: 'shaft' as const, thrust: 900, thrustWet: undefined, shaftPower: 1.3e6 };
    const c = cellCompare({ expected: shaft, live: live({ shaftPower: 1.29e6, thrust: 900 }), flight: ISA, controls: FULL, healthy: true });
    expect(c.unit).toBe('kW');
    expect(c.got).toBeCloseTo(1290, 0);
    expect(c.pct!).toBeGreaterThan(-3);
  });

  it('motor sönük, gaz tam değil, EGT sınırlayıcı, dengelenmemiş: neden yazılır', () => {
    expect(cellCompare({ expected: jet, live: live({ lit: false }), flight: ISA, controls: FULL, healthy: true }).pct).toBeNull();
    expect(cellCompare({ expected: jet, live: live({ thrust: 5e4 }), flight: ISA, controls: { throttle: 0.5, reheat: 0 }, healthy: true }).why).toBe('tam güçte ölçülür');
    expect(cellCompare({ expected: jet, live: live({ thrust: 8e4, egtLimited: true }), flight: ISA, controls: FULL, healthy: true }).why).toContain('EGT');
    expect(cellCompare({ expected: jet, live: live({ thrust: 8e4, N1: 0.9 }), flight: ISA, controls: FULL, healthy: true }).why).toContain('dengelenmedi');
    expect(cellCompare({ expected: jet, live: live({ thrust: 8e4 }), flight: ISA, controls: FULL, healthy: false }).why).toContain('arıza');
  });

  it('art yakıcı yanarken ıslak itkiyle kıyaslanır', () => {
    const ab = { output: 'thrust' as const, thrust: 60e3, thrustWet: 95e3, shaftPower: undefined };
    const c = cellCompare({ expected: ab, live: live({ thrust: 94e3 }), flight: ISA, controls: { throttle: 1.3, reheat: 1 }, healthy: true });
    expect(c.want).toBeCloseTo(95, 5);
    expect(c.off).toBe(false);
  });
});

describe('klavye odak kuralları', () => {
  const range = { tagName: 'INPUT', type: 'range' };
  it('kaydırıcıda Ctrl+Z ve Esc atölyeye gider, oklar kaydırıcının', () => {
    expect(keyOwnedByTarget(range, 'z')).toBe(false);
    expect(keyOwnedByTarget(range, 'Escape')).toBe(false);
    expect(keyOwnedByTarget(range, 'ArrowDown')).toBe(true);
  });
  it('metin/sayı kutusu ve açılır liste bütün tuşları alır', () => {
    for (const t of [{ tagName: 'INPUT', type: 'number' }, { tagName: 'INPUT', type: 'text' }, { tagName: 'INPUT' }, { tagName: 'SELECT' }, { tagName: 'TEXTAREA' }]) {
      expect(keyOwnedByTarget(t, 'z')).toBe(true);
      expect(keyOwnedByTarget(t, 'Escape')).toBe(true);
    }
  });
  it('düğmede ok tuşu düğmenin değil (ama tutamaca da gitmez: odak tuvalde değil)', () => {
    const btn = { tagName: 'BUTTON' };
    expect(keyOwnedByTarget(btn, 'ArrowDown')).toBe(false);
    expect(keyOwnedByTarget(btn, ' ')).toBe(true);
    const body = {};
    const canvas = {};
    expect(focusOnCanvas(btn, body, canvas)).toBe(false);
    expect(focusOnCanvas(body, body, canvas)).toBe(true);
    expect(focusOnCanvas(canvas, body, canvas)).toBe(true);
  });
  it('Ctrl+C kısayol değil', () => {
    expect(plainKey({ ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
    expect(plainKey({ ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
  });
});

describe('aile sekmesi anahtarı', () => {
  const fam = (id: string, n: number) => ({ id, code: id.toUpperCase(), name: `${id} motor`, variants: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}` })) });
  const st = (families: ReturnType<typeof fam>[], active: string, goal?: string) =>
    ({ project: { families, activeFamily: active, expert: false, ...(goal ? { goal: { id: goal } } : {}) } }) as unknown as Parameters<typeof familyViewKey>[0];
  it('aynı durumda değişmez (0,2 s yenilemesi DOM kurmaz); aile/varyant/görev değişince değişir', () => {
    const a = st([fam('at-1', 1)], 'at-1');
    expect(familyViewKey(a)).toBe(familyViewKey(st([fam('at-1', 1)], 'at-1')));
    expect(familyViewKey(a)).not.toBe(familyViewKey(st([fam('at-1', 2)], 'at-1')));
    expect(familyViewKey(a)).not.toBe(familyViewKey(st([fam('at-1', 1), fam('at-2', 1)], 'at-2')));
    expect(familyViewKey(a)).not.toBe(familyViewKey(st([fam('at-1', 1)], 'at-1', 'bolgesel')));
  });
});

describe('şablonlar: kütle şeridi vurgusu ve istasyon tablosu', () => {
  const ids = (Object.keys(TEMPLATES) as TemplateId[]).filter((id) => {
    try {
      buildEngine(TEMPLATES[id]!);
      return true;
    } catch {
      return false;
    }
  });

  it('en az dört şablon kurulur', () => {
    expect(ids.length).toBeGreaterThanOrEqual(4);
  });

  it.each(ids)('%s: her kütle kalemi gerçek 3B parça etiketlerine eşlenir', (id) => {
    const b = buildEngine(TEMPLATES[id]!);
    const sm = summarize(b);
    for (const k of Object.keys(sm.massParts)) {
      const tags = massPartTags(k, b.traits);
      expect(tags.length, `${id}: ${k}`).toBeGreaterThan(0);
      for (const t of tags) expect(PART_TAGS).toContain(t);
    }
  });

  it.each(ids)('%s: istasyon tablosu 2, 3, 4, 5, 9 içerir; T, P, W sonlu', (id) => {
    const b = buildEngine(TEMPLATES[id]!);
    const rows = stationRows(b.sized.point.stations);
    const got = rows.map((r) => r.id);
    for (const s of ['2', '3', '4', '5', '9']) expect(got).toContain(s);
    for (const r of rows) expect(Number.isFinite(r.T + r.P + r.W)).toBe(true);
    // Baypassız motorda 13 yok
    if (b.design.bypassRatio === 0) expect(got).not.toContain('13');
  });
});

describe('sayı kutusu', () => {
  it('boş ve geçersiz girdi null (hareket kapanır, değer geri gelir)', () => {
    expect(parseNumInput('')).toBeNull();
    expect(parseNumInput('  ')).toBeNull();
    expect(parseNumInput('1e')).toBeNull();
    expect(parseNumInput('1,5')).toBe(1.5);
    expect(parseNumInput('1280')).toBe(1280);
  });
});
