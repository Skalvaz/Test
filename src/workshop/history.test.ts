/**
 * M5a P4b: geri al / yinele yığını (30 adım, input birleşmesi).
 */

import { describe, expect, it } from 'vitest';
import { EditHistory, HISTORY_LIMIT } from './history';

describe('geri al / yinele', () => {
  it('30 adım sınırı; geri al ve yinele sırası', () => {
    const h = new EditHistory<number>();
    let state = 0;
    for (let i = 1; i <= 35; i++) {
      h.push({ t: 'knob', id: `k${i % 2}`, value: i }, state, 'change');
      state = i;
    }
    expect(HISTORY_LIMIT).toBe(30);
    expect(h.size).toBe(30);
    const seen: number[] = [];
    let s: number | null;
    while ((s = h.undo(state)) !== null) {
      seen.push(s);
      state = s;
    }
    // En eski 5 düzenleme düştü: 34 → 5 arası geri alınır
    expect(seen[0]).toBe(34);
    expect(seen.at(-1)).toBe(5);
    expect(seen.length).toBe(30);
    expect(h.canUndo).toBe(false);
    for (let i = 0; i < 30; i++) state = h.redo(state)!;
    expect(state).toBe(35);
    expect(h.redo(state)).toBeNull();
  });

  it('input olayları tek kayıtta birleşir; change kapatır; başka hedef yeni kayıt', () => {
    const h = new EditHistory<string>();
    h.push({ t: 'knob', id: 'hpc.pr', value: 3 }, 'a', 'input');
    h.push({ t: 'knob', id: 'hpc.pr', value: 3.5 }, 'b', 'input');
    h.push({ t: 'knob', id: 'hpc.pr', value: 4 }, 'c', 'change');
    expect(h.size).toBe(1);
    expect(h.last).toEqual({ t: 'knob', id: 'hpc.pr', value: 4 });
    // Kapanmış kayda yeni input birleşmez
    h.push({ t: 'knob', id: 'hpc.pr', value: 5 }, 'd', 'input');
    expect(h.size).toBe(2);
    h.push({ t: 'handle', id: 'frontTip', target: 0.5 }, 'e', 'input');
    h.push({ t: 'handle', id: 'frontTip', target: 0.6 }, 'f', 'input');
    expect(h.size).toBe(3);
    expect(h.undo('g')).toBe('e');
    expect(h.undo('e')).toBe('d');
    expect(h.undo('d')).toBe('a');
  });

  it('yeni düzenleme yineleyi boşaltır; seal birleşmeyi keser', () => {
    const h = new EditHistory<number>();
    h.push({ t: 'knob', id: 'a', value: 1 }, 0, 'change');
    h.undo(1);
    expect(h.canRedo).toBe(true);
    h.push({ t: 'knob', id: 'b', value: 1 }, 0, 'input');
    expect(h.canRedo).toBe(false);
    h.seal();
    h.push({ t: 'knob', id: 'b', value: 2 }, 1, 'input');
    expect(h.size).toBe(2);
    h.clear();
    expect(h.canUndo || h.canRedo).toBe(false);
  });

  it('cancelOpen: süren hareket iz bırakmadan kalkar (yinele ve sınırdan düşen kayıtlar geri gelir)', () => {
    const h = new EditHistory<number>(2);
    h.push({ t: 'knob', id: 'a', value: 1 }, 0, 'change');
    h.push({ t: 'knob', id: 'b', value: 1 }, 1, 'change');
    h.push({ t: 'knob', id: 'c', value: 1 }, 2, 'change');
    h.undo(3);
    expect([h.size, h.canRedo]).toEqual([1, true]);
    const e = { t: 'handle', id: 'frontTip', target: 1 } as const;
    h.push(e, 2, 'input');
    h.push({ ...e, target: 2 }, 2, 'input');
    expect(h.canRedo).toBe(false);
    // Açık kayıt yoksa ya da başka hedefse null
    expect(h.cancelOpen({ ...e, id: 'nozzleExit' })).toBeNull();
    expect(h.cancelOpen(e)).toBe(2);
    expect([h.size, h.canRedo]).toEqual([1, true]);
    expect(h.redo(2)).toBe(3);
    // Kapanmış (bırakılmış) hareket iptal edilemez
    h.push(e, 3, 'input');
    h.push(e, 3, 'change');
    expect(h.cancelOpen(e)).toBeNull();
    h.push(e, 4, 'input');
    h.seal();
    expect(h.cancelOpen(e)).toBeNull();
  });

  it('cancelOpen: sınırı aşan açık kayıt düşürdüğü en eski kaydı geri koyar', () => {
    const h = new EditHistory<number>(2);
    h.push({ t: 'knob', id: 'a', value: 1 }, 0, 'change');
    h.push({ t: 'knob', id: 'b', value: 1 }, 1, 'change');
    const e = { t: 'handle', id: 'frontTip', target: 1 } as const;
    h.push(e, 2, 'input');
    expect(h.size).toBe(2);
    expect(h.cancelOpen(e)).toBe(2);
    expect(h.size).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBe(0);
  });
});
