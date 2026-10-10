/**
 * Ölçek figürü kadrajda kalır (M5a dalga 2 kontrolü): test hücresinde
 * zemin motorun ~3 m altında; eski yerleşim (zeminde, eksenin altında)
 * yan görünüşte kadrajın altında kalıyordu. Yeni yer kadraja (panellerin
 * bıraktığı alana) göre seçilir; motorun önüne çıkan figür derinlik
 * oranıyla küçülür, ekran boyu eksen düzlemindeki 1,8 m'lik figürle aynıdır.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  chooseFigureSpot,
  figureBaseline,
  figureNdcBox,
  FIGURE_HEIGHT,
  labelOnLeft,
  safeRect,
  ScaleFigure,
  type FigureEngine,
} from './ScaleFigure';

const W = 1280;
const H = 720;
/** Atölye panelleri (1280×720): sol 332, sağ 312, üst çubuk 52 px */
const INSETS = { left: 332, right: 312, top: 52, bottom: 0 };
/** Panellerin gerçekte bıraktığı alan, NDC */
const FREE = { x0: (2 * INSETS.left) / W - 1, x1: (2 * (W - INSETS.right)) / W - 1, y0: -1, y1: 1 - (2 * INSETS.top) / H };

/** CameraRig.applyOffset ile aynı kaydırılmış/uzaklaştırılmış izdüşüm */
function rigCamera(pos: [number, number, number], target: [number, number, number], fov: number) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 1000);
  cam.position.set(...pos);
  cam.lookAt(...target);
  const sx = (INSETS.left - INSETS.right) / 2;
  const sy = (INSETS.bottom - INSETS.top) / 2;
  const k = THREE.MathUtils.clamp(Math.sqrt((W * H) / ((W - INSETS.left - INSETS.right) * (H - INSETS.top - INSETS.bottom))), 1, 1.8);
  cam.setViewOffset(W, H, W / 2 - (W / 2 + sx) * k, H / 2 - (H / 2 - sy) * k, W * k, H * k);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

const inside = (b: { x0: number; x1: number; y0: number; y1: number } | null, r: typeof FREE) =>
  !!b && b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1;

/** Yolcu turbofanı (şablon): 7,3 m boy, 1,78 m en büyük yarıçap; hücre zemini −3,35 m */
const TF: FigureEngine = { z0: -2.243, z1: 5.061, r: 1.784 };
const FLOOR = -3.35;

describe('ölçek figürü: kadraj', () => {
  const side = rigCamera([-12.5, 0.7, 1.3], [0, 0, 1.3], 22);

  it('güvenli alan kestirimi panellerin bıraktığı alanın içinde', () => {
    const s = safeRect(side);
    expect(s.x0).toBeGreaterThanOrEqual(FREE.x0);
    expect(s.x1).toBeLessThanOrEqual(FREE.x1);
    expect(s.x1 - s.x0).toBeGreaterThan(0.7 * (FREE.x1 - FREE.x0));
  });

  it('kesit açısında eski yer (zemin, eksenin altı) kadraj dışı; yan görünüşte yeni yer panellerin arasında, tam', () => {
    const cut = rigCamera([-8.6, 1.4, 1.3], [0, 0, 1.5], 28);
    const old = figureNdcBox(cut, { x: 0, z: TF.z0 + 0.25 * (TF.z1 - TF.z0), scale: 1 }, FLOOR);
    expect(inside(old, FREE)).toBe(false);
    const base = figureBaseline(TF, FLOOR);
    expect(base).toBeCloseTo(-TF.r, 9);
    const spot = chooseFigureSpot(side, TF, base);
    const s = safeRect(side);
    expect(inside(figureNdcBox(side, spot, base, labelOnLeft(side, spot, base, s)), FREE)).toBe(true);
  });

  it('üç çeyrek ön ve kesit açılarında da tam kadrajda', () => {
    for (const [pos, tgt, fov] of [
      [[-6.4, 1.9, -6.6], [0, 0, 0.25], 32],
      [[-8.6, 1.4, 1.3], [0, 0, 1.5], 28],
    ] as [[number, number, number], [number, number, number], number][]) {
      const cam = rigCamera(pos, tgt, fov);
      const base = figureBaseline(TF, FLOOR);
      const spot = chooseFigureSpot(cam, TF, base);
      expect(inside(figureNdcBox(cam, spot, base, labelOnLeft(cam, spot, base, safeRect(cam))), FREE)).toBe(true);
    }
  });

  it('motorun önüne çıkan figür ekranda eksen düzlemindeki 1,8 m ile aynı boyda', () => {
    const base = figureBaseline(TF, FLOOR);
    const spot = chooseFigureSpot(side, TF, base);
    expect(spot.x).not.toBe(0); // bu kadrajda motor enine dolu: önde
    expect(spot.scale).toBeLessThan(1);
    const h = (z: number, x: number, sc: number) => {
      const a = new THREE.Vector3(x, base, z).project(side);
      const b = new THREE.Vector3(x, base + FIGURE_HEIGHT * sc, z).project(side);
      return b.y - a.y;
    };
    expect(h(spot.z, spot.x, spot.scale) / h(spot.z, 0, 1)).toBeCloseTo(1, 1);
  });

  it('sığan yer sürdükçe değişmez (yörüngede zıplamaz)', () => {
    const base = figureBaseline(TF, FLOOR);
    const a = chooseFigureSpot(side, TF, base);
    const b = chooseFigureSpot(side, TF, base, { ...a, z: a.z + 0.5 });
    expect(b.z).toBeCloseTo(a.z + 0.5, 9);
  });

  it('zemin motorun hemen altındaysa (taşıma standı) figür zeminde durur', () => {
    expect(figureBaseline(TF, -2.0)).toBe(-2.0);
    expect(figureBaseline(TF, FLOOR)).toBeCloseTo(-TF.r, 9);
  });
});

/** Motorun çevresinde dolaşan kameralar (yörünge, yakın çekim dahil) */
function* orbit(e: FigureEngine) {
  for (let az = 0; az < 360; az += 15)
    for (const el of [-10, 5, 15, 35])
      for (const [dist, fov] of [[2.5, 32], [6, 22], [9, 32], [14, 22]]) {
        const a = (az * Math.PI) / 180;
        const b = (el * Math.PI) / 180;
        const zc = (e.z0 + e.z1) / 2;
        yield rigCamera([dist * Math.cos(b) * Math.sin(a), dist * Math.sin(b), zc + dist * Math.cos(b) * Math.cos(a)], [0, 0, zc], fov);
      }
}

describe('ölçek figürü: zemin ve yer değişimi', () => {
  it('figür hiçbir açıda zeminin altına inmez (motorun altı yalnız zemin oraya inmiyorsa)', () => {
    // Hücre zemini yolcu turbofanının altından 1,57 m aşağıda: "motorun altı"
    // yeri (taban çizgisinin 1,95 m altı) zemine gömülürdü
    for (const [e, floor] of [
      [TF, FLOOR],
      [{ z0: -1, z1: 2.5, r: 0.45 }, FLOOR],
      [TF, -2.0],
    ] as [FigureEngine, number][]) {
      const eng = { ...e, floor };
      const base = figureBaseline(eng, floor);
      let lifted = 0;
      for (const cam of orbit(eng)) {
        const s = chooseFigureSpot(cam, eng, base, null, safeRect(cam));
        if (s.y !== undefined) lifted++;
        expect(s.y ?? base).toBeGreaterThanOrEqual(floor - 1e-9);
      }
      // Zemine ya da motorun altına inen yer gerçekten kullanılıyor (sınama boş değil)
      if (e === TF && floor === FLOOR) expect(lifted).toBeGreaterThan(0);
    }
  });

  it('kare kare dolaşırken figür seçilen yerde durur (yalnız ayak yüksekliği değişse de)', () => {
    const fig = new ScaleFigure(new THREE.Scene());
    const eng = { ...TF, floor: FLOOR };
    const base = figureBaseline(eng, FLOOR);
    Object.assign(fig as unknown as Record<string, unknown>, { eng, base, placed: true });
    fig.setVisible(true);
    let moved = 0;
    for (const cam of orbit(eng)) {
      fig.frame(cam);
      const s = fig.spotNow!;
      const p = fig.position;
      expect([p.x, p.y, p.z]).toEqual([s.x, s.y ?? base, s.z]);
      if (s.y !== undefined) moved++;
    }
    expect(moved).toBeGreaterThan(0);
    // Önceki yer taban çizgisinde, yeni yer aynı x, z'de zeminde: figür zemine iner
    const f = fig as unknown as { spot: unknown; moveTo(s: unknown): void };
    let sameXZ = 0;
    for (const e of [eng, { z0: -1, z1: 2.5, r: 0.45, floor: FLOOR }]) {
      const b = figureBaseline(e, FLOOR);
      Object.assign(fig as unknown as Record<string, unknown>, { eng: e, base: b });
      for (const cam of orbit(e)) {
        const s = chooseFigureSpot(cam, e, b, null, safeRect(cam));
        if (s.y === undefined || s.x !== 0) continue;
        const prev = { x: 0, z: s.z, scale: 1 };
        const want = chooseFigureSpot(cam, e, b, prev, safeRect(cam));
        if (want.y === undefined || want.z !== prev.z || want.x !== 0) continue;
        f.spot = prev;
        f.moveTo(prev);
        fig.frame(cam);
        sameXZ++;
        expect(fig.position.y).toBe(want.y);
        expect(fig.spotNow?.y).toBe(want.y);
      }
    }
    expect(sameXZ).toBeGreaterThan(0);
    fig.dispose();
  });
});
