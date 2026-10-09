/**
 * Atölye 3B kaplama matematiği (M5a P9): meridyen düzlemi, setViewOffset'li
 * izdüşümde ekran ↔ dünya, sürükleme doğrusu; tutamaç, hayalet, zarf ve
 * ölçek figürünün saf yardımcıları. (Tarayıcıdaki uçtan uca denetim:
 * gerçek WebGL çizimindeki işaretin bildirilen ekran pikselinde olması,
 * P9 raporu.)
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { basisQuaternion, dragAlong, meridianBasis, rayFromScreen, toScreen, worldPerPixel } from './overlay3d';
import { clampTarget, handleOpacity, keyStep, DIM_OPACITY } from './Handles';
import { outlineSegments } from './Ghost';
import { boxEdges } from './EnvelopeBox';
import { figureShapes, FIGURE_HEIGHT } from './ScaleFigure';

const RECT = { left: 0, top: 0, width: 1440, height: 810 };

/** CameraRig.applyOffset ile aynı: paneller için kaydırılmış/uzaklaştırılmış izdüşüm */
function rigCamera(pos: [number, number, number], target: [number, number, number], insets = { left: 384, right: 356, top: 52, bottom: 0 }) {
  const cam = new THREE.PerspectiveCamera(22, RECT.width / RECT.height, 0.1, 1000);
  cam.position.set(...pos);
  cam.lookAt(...target);
  const w = RECT.width;
  const h = RECT.height;
  const sx = (insets.left - insets.right) / 2;
  const sy = (insets.bottom - insets.top) / 2;
  const freeW = Math.max(w - insets.left - insets.right, w * 0.3);
  const freeH = Math.max(h - insets.top - insets.bottom, h * 0.3);
  const k = THREE.MathUtils.clamp(Math.sqrt((w * h) / (freeW * freeH)), 1, 1.8);
  cam.setViewOffset(w, h, w / 2 - (w / 2 + sx) * k, h / 2 - (h / 2 - sy) * k, w * k, h * k);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}

describe('meridyen düzlemi', () => {
  it('yandan bakışta u yukarı (+Y); ters yandan da ekranda yukarı', () => {
    const a = meridianBasis(rigCamera([12.5, 0.7, 1.3], [0, 0, 1.3]), null);
    expect(a.y).toBeGreaterThan(0.99);
    const b = meridianBasis(rigCamera([-12.5, 0.7, 1.3], [0, 0, 1.3]), null);
    expect(b.y).toBeGreaterThan(0.99);
  });

  it('kesit açıkken u kesit düzleminde (normaline dik) ve ekranda yukarı', () => {
    const cam = rigCamera([8.6, 1.4, 1.3], [0, 0, 1.5]);
    const a = 0.3;
    const plane = new THREE.Plane(new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0), 0);
    const u = meridianBasis(cam, plane);
    expect(Math.abs(u.dot(plane.normal))).toBeLessThan(1e-9);
    expect(u.dot(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1))).toBeGreaterThan(0);
  });

  it('basisQuaternion +Y eksenini u yönüne döndürür', () => {
    const u = new THREE.Vector3(-0.6, 0.8, 0);
    const q = basisQuaternion(u);
    const y = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    expect(y.distanceTo(u)).toBeLessThan(1e-9);
  });
});

describe('setViewOffset dahil ekran ↔ dünya', () => {
  const cam = rigCamera([12.5, 0.7, 1.3], [0, 0, 1.3]);

  it('ekran pikselinden ışın dünya noktasından geçer (gidiş-dönüş < 0,01 px)', () => {
    for (const p of [new THREE.Vector3(0, 0.6, -1.4), new THREE.Vector3(0, 0.3, 2.2), new THREE.Vector3(0.2, -0.4, 0)]) {
      const s = toScreen(cam, p, RECT);
      expect(s.inFront).toBe(true);
      const ray = rayFromScreen(cam, s.x, s.y, RECT);
      expect(ray.distanceToPoint(p)).toBeLessThan(1e-4);
    }
  });

  it('kaydırılmış izdüşüm: panellerin ortasındaki hedef serbest alanın ortasına düşer', () => {
    const s = toScreen(cam, new THREE.Vector3(0, 0, 1.3), RECT);
    // Serbest alan: x 384…1084 (orta 734), y 52…810 (orta 431)
    expect(s.x).toBeCloseTo(734, 0);
    expect(s.y).toBeCloseTo(431, 0);
  });

  it('worldPerPixel: 14 piksellik dünya boyu ekranda 14 piksel', () => {
    const p = new THREE.Vector3(0, 0.5, 0);
    const d = 14 * worldPerPixel(cam, p, RECT.height);
    const a = toScreen(cam, p, RECT);
    const b = toScreen(cam, p.clone().add(new THREE.Vector3(0, d, 0)), RECT);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(14, 0);
  });

  it('sürükleme: imlecin altındaki doğru noktası (radyal ve eksenel)', () => {
    const z = 0.4;
    const u = new THREE.Vector3(0, 1, 0);
    const target = new THREE.Vector3(0, 0.83, z);
    const s = toScreen(cam, target, RECT);
    const t = dragAlong(rayFromScreen(cam, s.x, s.y, RECT), new THREE.Vector3(0, 0, z), u);
    expect(t).toBeCloseTo(0.83, 5);
    const s2 = toScreen(cam, new THREE.Vector3(0, 0.5, 1.9), RECT);
    const t2 = dragAlong(rayFromScreen(cam, s2.x, s2.y, RECT), new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0, 1));
    expect(t2).toBeCloseTo(1.9, 5);
  });

  it('bakış doğrultusuna paralel doğruda çözüm yok (null)', () => {
    const ray = new THREE.Ray(new THREE.Vector3(0, 0, -5), new THREE.Vector3(0, 0, 1));
    expect(dragAlong(ray, new THREE.Vector3(), new THREE.Vector3(0, 0, 1))).toBeNull();
  });
});

describe('tutamaç yardımcıları', () => {
  const spec = { range: { lo: 1, hi: 2 }, snaps: [1, 1.25, 1.5, 1.75, 2] };
  it('sınıra kırpar, çentiğe yapıştırır', () => {
    expect(clampTarget(spec, 0.2)).toBe(1);
    expect(clampTarget(spec, 9)).toBe(2);
    expect(clampTarget(spec, 1.4)).toBe(1.5);
    expect(clampTarget(spec, 1.4, false)).toBe(1.4);
  });
  it('seçili modülün tutamacı opak, diğeri sönük; seçim yoksa hepsi opak', () => {
    expect(handleOpacity({ id: 'length:hpc', group: 'hpc' }, 'hpc')).toBe(1);
    expect(handleOpacity({ id: 'frontTip', group: 'engine' }, 'hpc')).toBe(DIM_OPACITY);
    expect(handleOpacity({ id: 'frontTip', group: 'engine' }, 'fan')).toBe(1);
    expect(handleOpacity({ id: 'nozzleExit', group: 'nozzle' }, null)).toBe(1);
  });
  it('klavye adımı: eksenelde bir kademe, radyalde aralığın 1/40ı', () => {
    expect(keyStep({ axis: 'axial', ...spec })).toBeCloseTo(0.25);
    expect(keyStep({ axis: 'radial', range: { lo: 0.4, hi: 0.8 } })).toBeCloseTo(0.01);
  });
});

describe('hayalet, zarf kutusu, ölçek figürü', () => {
  it('siluet çizgisi eksenin iki yanına (±r) parça çifti olur', () => {
    const seg = outlineSegments([
      [
        { z: 0, r: 0.5 },
        { z: 1, r: 0.4 },
      ],
    ]);
    expect(seg).toEqual([0, 0.5, 0, 0, 0.4, 1, 0, -0.5, 0, 0, -0.4, 1]);
  });
  it('zarf kutusu 12 kenar: 4 boyuna + 2×4 uç', () => {
    const e = boxEdges({ z0: -1, z1: 3, half: 0.45 });
    expect(e.long.length / 6).toBe(4);
    expect(e.ends.length / 6).toBe(8);
    expect(Math.max(...e.long.filter((_, i) => i % 3 === 2))).toBe(3);
  });
  it('figür 1,8 m boyunda, ayakları y = 0, iki yanı simetrik', () => {
    const g = new THREE.ShapeGeometry(figureShapes(), 4);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    expect(bb.min.y).toBeCloseTo(0, 6);
    expect(bb.max.y).toBeCloseTo(FIGURE_HEIGHT, 2);
    expect(bb.max.x).toBeCloseTo(-bb.min.x, 6);
    expect(bb.max.x * 2).toBeGreaterThan(0.45);
    expect(bb.max.x * 2).toBeLessThan(0.55);
  });
});
