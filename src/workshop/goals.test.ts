/**
 * M5a P4b: görev kartı.
 */

import { describe, expect, it } from 'vitest';
import { buildEngine } from '../design/graph';
import { TURBOFAN_GRAPH, TURBOPROP_GRAPH } from '../design/templates';
import { checkGoal, goalById, GOALS } from './goals';
import { fakeSummarize } from './testing';

describe('görev kartı', () => {
  it('üç görev, kimlikler tekil', () => {
    expect(GOALS.map((g) => g.id)).toEqual(['missile', 'regional', 'helicopter']);
    expect(goalById('helicopter')!.require).toEqual({ shaftPowerMin: 1.2e6, massMax: 250 });
  });

  it('bölgesel jet: şablon turbofan itki ve TSFC ile geçer, uyarı varsa kalır', () => {
    const s = fakeSummarize(buildEngine(TURBOFAN_GRAPH));
    const ok = checkGoal(goalById('regional')!, s, []);
    expect(ok.rows.map((r) => r.label)).toEqual(['İtki', 'TSFC', 'Uyarı']);
    expect(ok.met).toBe(true);
    const warn = checkGoal(goalById('regional')!, s, [{ id: 't4', severity: 'warning', title: '', text: '', fix: '', group: 'combustor', tags: [], knobs: [] }]);
    expect(warn.met).toBe(false);
    expect(warn.rows.find((r) => r.label === 'Uyarı')!.text).toBe('1 uyarı');
    // Bilgi düzeyi uyarı sayılmaz
    expect(checkGoal(goalById('regional')!, s, [{ id: 'info.tw', severity: 'info', title: '', text: '', fix: '', group: 'engine', tags: [], knobs: [] }]).met).toBe(true);
  });

  it('füze ve helikopter: çap ve kütle satırları', () => {
    const tf = fakeSummarize(buildEngine(TURBOFAN_GRAPH));
    const m = checkGoal(goalById('missile')!, tf, []);
    expect(m.met).toBe(false);
    expect(m.rows.find((r) => r.label === 'Çap')!.ok).toBe(false);
    const tp = fakeSummarize(buildEngine(TURBOPROP_GRAPH));
    const h = checkGoal(goalById('helicopter')!, tp, []);
    expect(h.rows.find((r) => r.label === 'Mil gücü')!.ok).toBe(true);
    expect(h.rows.find((r) => r.label === 'Kütle')!.text).toMatch(/kg ≤ 250 kg/);
  });
});
