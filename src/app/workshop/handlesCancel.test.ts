/**
 * Tutamaç sürüklemesinin iptali (M5a P9 denetim düzeltmesi): pointercancel,
 * gizleme ve atma yarım kalan sürüklemeyi başlangıç değerine döndürür;
 * kullanıcının bırakmadığı ara değer tasarıma işlenmez.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { DragGesture, WorkshopHandles } from './Handles';

type Call = [string, number, string];

/** DOM'suz yarım kurulum: yalnız sürükleme durumu ve mağaza */
function dragging() {
  const calls: Call[] = [];
  const cls = { add() {}, remove() {} };
  (globalThis as unknown as { document: unknown }).document = { body: { classList: cls } };
  const o = Object.create(WorkshopHandles.prototype) as Record<string, unknown>;
  Object.assign(o, {
    dragging: 'frontTip',
    dragStart: 0.5,
    dragValue: 0.62,
    pending: 0.64,
    sent: 0.6,
    pointerId: 7,
    // Eşiği geçmiş (mağazaya 'start' gitmiş) sürükleme
    gesture: Object.assign(new DragGesture('frontTip', 0.5, 0, 0, 0, 1, { lo: 0, hi: 2 }), { live: true }),
    items: [],
    controlsWere: true,
    host: { controls: { enabled: false } },
    opts: {},
    readout: { classList: cls },
    layer: { classList: cls },
    store: { dragHandle: (id: string, v: number, ph: string) => calls.push([id, v, ph]),
      cancelDrag: (id: string) => calls.push([id, NaN, 'cancel']),
    },
  });
  return { h: o as unknown as WorkshopHandles & Record<string, unknown>, calls };
}

describe('tutamaç: yarım sürükleme iptali', () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('gizlenince başlangıç değerine döner, ara değer işlenmez', () => {
    const { h, calls } = dragging();
    h.setVisible(false);
    expect(calls).toEqual([['frontTip', NaN, 'cancel']]);
    expect((h as unknown as { dragging: unknown }).dragging).toBe(null);
    expect((h as unknown as { host: { controls: { enabled: boolean } } }).host.controls.enabled).toBe(true);
  });

  it('atılınca da başlangıca döner (cancelDrag)', () => {
    const { h, calls } = dragging();
    (h as unknown as { cancelDrag(): void }).cancelDrag();
    expect(calls).toEqual([['frontTip', NaN, 'cancel']]);
    // İkinci çağrı bir şey yapmaz
    (h as unknown as { cancelDrag(): void }).cancelDrag();
    expect(calls.length).toBe(1);
  });

  it('pointercancel bırakış gibi işlenmez: onCancel başlangıca döner', () => {
    // onCancel örnek alanı (ok işlevi): gerçek kurucuyu çağırmadan sınıftan al
    const src = WorkshopHandles.toString();
    expect(src).toMatch(/addEventListener\(["']pointercancel["'], this\.onCancel\)/);
    expect(src).not.toMatch(/addEventListener\(["']pointercancel["'], this\.onUp\)/);
  });
});
