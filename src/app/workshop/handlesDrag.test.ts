/**
 * Tutamaç sürüklemesi (M5a dalga 2 incelemesi #4, #5 ve duyarlılık):
 * tıklama tasarıma dokunmaz, tutma kayması sıçratmaz, radyal kazanç
 * sınırlı ve Shift ince ayar; bırakış kaybolunca (düğmesiz hareket, odak
 * kaybı, yakalama düşmesi) sürükleme geri alınır, ara değer işlenmez.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD_PX,
  DragGesture,
  FINE_GAIN,
  RADIAL_REL_PER_PX,
  WorkshopHandles,
  dragGain,
} from './Handles';

type Call = [string, number, string];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

const RANGE = { lo: 0.15, hi: 0.69 };

describe('DragGesture: göreli sürükleme', () => {
  it('eşiğin altında kıpırdayan basış tıklamadır: değer değişmez', () => {
    const g = new DragGesture('frontTip', 0.4, 100, 100, 0.47, 1, RANGE);
    expect(g.move(101, 98, 0.49, false)).toBe(null);
    expect(g.live).toBe(false);
    expect(g.value).toBe(0.4);
  });

  it('tutma kayması değere geçmez: merkezin 7 px üstünden basıp 10 px sürüklemek yalnız 10 px kadar değiştirir', () => {
    // Basış doğruda 0,47'ye düşüyor (merkez 0,40); 10 px yukarı → 0,52
    const g = new DragGesture('frontTip', 0.4, 100, 93, 0.47, 1, RANGE);
    expect(g.move(100, 83, 0.52, false)).toBe('start');
    expect(g.value).toBeCloseTo(0.45, 9); // 0,52 değil
    expect(g.move(100, 80, 0.535, false)).toBe('move');
    expect(g.value).toBeCloseTo(0.465, 9);
  });

  it('kazanç ve Shift ince ayarı; sınıra kırpılır, geri dönüş hemen tepki verir', () => {
    const g = new DragGesture('frontTip', 0.4, 0, 0, 0.4, 0.5, RANGE);
    g.move(0, -10, 0.5, false); // Δt 0,1 × 0,5
    expect(g.value).toBeCloseTo(0.45, 9);
    g.move(0, -20, 0.6, true); // Shift: × ¼
    expect(g.value).toBeCloseTo(0.45 + 0.1 * 0.5 * FINE_GAIN, 9);
    g.move(0, -400, 5, false); // sınırın çok ötesi
    expect(g.value).toBe(RANGE.hi);
    g.move(0, -390, 4.9, false); // geri dönüş: ölü bölge yok
    expect(g.value).toBeCloseTo(RANGE.hi - 0.05, 9);
  });

  it('çözümsüz doğru (null t) değeri bozmaz', () => {
    const g = new DragGesture('length:hpc', 1, 0, 0, null, 1, { lo: 0, hi: 3 });
    expect(g.move(10, 0, null, false)).toBe('start');
    expect(g.value).toBe(1);
    g.move(20, 0, 1.2, false); // ilk geçerli t yalnız referans olur
    expect(g.value).toBe(1);
    g.move(30, 0, 1.3, false);
    expect(g.value).toBeCloseTo(1.1, 9);
  });
});

describe('dragGain: radyal duyarlılık', () => {
  it('¾ açıda turbojet (1 px ≈ 9,3 mm, uç 0,395 m): 40 px çapı ≤ ×1,17 büyütür (eskiden ×1,74)', () => {
    const upp = 0.0093;
    const g = dragGain('radial', 0.395, upp);
    expect(g).toBeLessThan(1);
    const r1 = 0.395 + 40 * upp * g;
    expect(r1 / 0.395).toBeCloseTo(1 + 40 * RADIAL_REL_PER_PX, 9);
    expect(r1 / 0.395).toBeLessThan(1.17);
    // Shift ile ¼
    expect(0.395 + 40 * upp * g * FINE_GAIN).toBeLessThan(0.395 * 1.05);
  });

  it("kazanç 1'i aşmaz (tutamaç imleçten öne geçmez); eksenel tutamaç 1:1", () => {
    expect(dragGain('radial', 1.4, 1e-5)).toBe(1);
    expect(dragGain('axial', 0.4, 0.01)).toBe(1);
    expect(dragGain('radial', 0.4, Infinity)).toBe(1);
  });
});

/** DOM'suz yarım kurulum: basılmış (eşik geçilmemiş) tutamaç */
function pressed(live = false) {
  const calls: Call[] = [];
  const cls = { add() {}, remove() {} };
  (globalThis as unknown as { document: unknown }).document = { body: { classList: cls } };
  const o = Object.create(WorkshopHandles.prototype) as Loose;
  const g = new DragGesture('frontTip', 0.4, 100, 93, 0.47, 1, RANGE);
  if (live) g.move(100, 80, 0.5, false);
  Object.assign(o, {
    dragging: 'frontTip',
    dragStart: 0.4,
    dragValue: g.value,
    pending: live ? g.value : null,
    sent: null,
    pointerId: 7,
    gesture: g,
    line: { origin: null, dir: null },
    specs: [{ id: 'frontTip', axis: 'radial', range: RANGE, world: [0, 0.4, -2], coupled: 'engine.massFlow', snaps: undefined }],
    items: [],
    controlsWere: true,
    host: { controls: { enabled: false } },
    opts: {},
    readout: { classList: cls },
    layer: { classList: cls },
    store: { state: { last: null }, dragHandle: (id: string, v: number, ph: string) => calls.push([id, v, ph]) },
  });
  // İzdüşüm yerine sabit doğru: y pikseli → t (1 px = 0,01 m yukarı)
  o.paramAt = (_line: unknown, _x: number, y: number) => 0.4 + (93 - y) * 0.01 + 0.07;
  return { h: o, calls };
}

const ev = (type: string, x: number, y: number, buttons: number, extra: Record<string, unknown> = {}) =>
  ({ type, pointerId: 7, clientX: x, clientY: y, buttons, shiftKey: false, ...extra }) as unknown as PointerEvent;

describe('WorkshopHandles: tıklama, bırakış kaybı, iptal', () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('#4: tutamaca yalnız tıklamak tasarıma dokunmaz (mağazaya hiçbir çağrı yok)', () => {
    const { h, calls } = pressed();
    h.pointerMove(ev('pointermove', 101, 94, 1));
    h.pointerUp(ev('pointerup', 101, 94, 0));
    expect(calls).toEqual([]);
    expect(h.dragging).toBe(null);
    expect(h.host.controls.enabled).toBe(true);
  });

  it('#4: eşiği geçen ilk hareket sıçramaz; bırakış göreli değeri işler', () => {
    const { h, calls } = pressed();
    h.pointerMove(ev('pointermove', 100, 93 - DRAG_THRESHOLD_PX - 2, 1));
    expect(calls).toEqual([['frontTip', 0.4, 'start']]);
    expect(h.dragValue).toBeCloseTo(0.4 + (DRAG_THRESHOLD_PX + 2) * 0.01, 9);
    h.pointerUp(ev('pointerup', 100, 83, 0));
    expect(calls.at(-1)?.[2]).toBe('end');
    expect(calls.at(-1)?.[1]).toBeCloseTo(0.5, 9); // 0,57 (imlecin doğrudaki mutlak karşılığı) değil
  });

  it('#5: düğmesi bırakılmış fare hareketi (kayıp pointerup) sürüklemeyi geri alır, ara değer işlenmez', () => {
    const { h, calls } = pressed(true);
    h.pointerMove(ev('pointermove', 100, 40, 0));
    expect(calls).toEqual([['frontTip', 0.4, 'end']]);
    expect(h.dragging).toBe(null);
    // Sonraki rastgele tıklamanın bırakışı hiçbir şey işlemez
    h.pointerUp(ev('pointerup', 300, 300, 0));
    expect(calls.length).toBe(1);
  });

  it('#5: pencere odağı gidince geri alınır; sürüklerken bağlam menüsü engellenir', () => {
    const { h, calls } = pressed(true);
    let prevented = false;
    h.contextMenu({ preventDefault: () => (prevented = true) } as unknown as Event);
    expect(prevented).toBe(true);
    h.cancelDrag();
    expect(calls).toEqual([['frontTip', 0.4, 'end']]);
    prevented = false;
    h.contextMenu({ preventDefault: () => (prevented = true) } as unknown as Event);
    expect(prevented).toBe(false);
  });

  it('#5: yakalama bırakışsız düşünce (lostpointercapture) iptal; dinleyiciler kurulur ve atılır', () => {
    const src = WorkshopHandles.toString();
    expect(src).toMatch(/addEventListener\(["']lostpointercapture["']/);
    expect(src).toMatch(/addEventListener\(["']blur["'], this\.onBlur\)/);
    expect(src).toMatch(/removeEventListener\(["']blur["'], this\.onBlur\)/);
    expect(src).toMatch(/addEventListener\(["']contextmenu["'], this\.onContextMenu, true\)/);
    expect(src).toMatch(/removeEventListener\(["']contextmenu["'], this\.onContextMenu, true\)/);
  });

  it('cancel(): Esc için; sürükleme yoksa false, eşik geçilmemişse mağazaya bir şey gitmez', () => {
    const a = pressed();
    expect(a.h.cancel()).toBe(true);
    expect(a.calls).toEqual([]);
    expect(a.h.cancel()).toBe(false);
    const b = pressed(true);
    let stopped = 0;
    const key = { key: 'Escape', preventDefault() {}, stopPropagation: () => stopped++ } as unknown as KeyboardEvent;
    expect(b.h.onKey(key)).toBe(true);
    expect(stopped).toBe(1);
    expect(b.calls).toEqual([['frontTip', 0.4, 'end']]);
  });
});
