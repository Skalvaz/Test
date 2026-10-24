/**
 * Ölçüm araçlarının sözleşmesi (Dalga 0 kabul düzeltmeleri): visual-metrics
 * (kanat frekansı tepe fazlalığı, izdüşümlü rotor diski, dışlama, NaN maskesi,
 * yalnız rengi değişen kare, kapak maskesi) ve perf-compare beklenti
 * kuralları. Sentetik görüntülerle; kayıt gerekmez.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  dilate,
  diskProjector,
  luma,
  peakExcess,
  pixelDiff,
  polarFft,
  resolveMaskFrom,
  shapeTest,
  ssimByMask,
  ssimRgb,
} from './visual-metrics.mjs';
import { checkRule, compareRuns, parseRule } from './perf-compare.mjs';

/** w×h RGB görüntü; f(x, y) → [r, g, b] (0..1) */
function image(w, h, f) {
  const data = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(f(x + 0.5, y + 0.5), (y * w + x) * 3);
  return { w, h, data };
}

/** Elips halkada k kanatlı desen (+ isteğe bağlı dönmeyen m bileşeni) */
function bladeImage(k, { contrast = 0.4, staticM = 0, staticAmp = 0 } = {}) {
  const w = 320;
  const h = 240;
  return image(w, h, (x, y) => {
    const u = (x - 160) / 120;
    const v = (y - 120) / 100;
    const r = Math.hypot(u, v);
    const th = Math.atan2(v, u);
    const l = r > 0.3 && r < 0.98 ? 0.5 + contrast * Math.cos(k * th) + staticAmp * Math.cos(staticM * th) : 0.2;
    return [l, l, l];
  });
}
const RING = { type: 'ring', cx: 0.5, cy: 0.5, rx: 120 / 320, ry: 100 / 240, r0: 0.4, r1: 0.9 };

describe('kanat frekansı tepe fazlalığı (1I ölçütü)', () => {
  it('peakExcess: tepe − 5 × yan kutuların medyanı; düz spektrumda 0', () => {
    const P = new Float64Array(64).fill(1);
    expect(peakExcess(P, 22).excess).toBe(0);
    P[22] = 11;
    const r = peakExcess(P, 22);
    expect(r.floor).toBe(1);
    expect(r.excess).toBeCloseTo(10, 9);
  });

  it('keskin kanatlar büyük tepe; bulanık (düz) disk ~0; dönmeyen m=5 yapısı k tepesini değiştirmez', () => {
    const sharpF = polarFft(luma(bladeImage(22)), 320, 240, RING, 22);
    const blur = polarFft(luma(bladeImage(22, { contrast: 0 })), 320, 240, RING, 22);
    const withStatic = polarFft(luma(bladeImage(22, { staticM: 5, staticAmp: 0.2 })), 320, 240, RING, 22);
    expect(sharpF.peakK).toBeGreaterThan(0.03);
    expect(blur.peak).toBeLessThan(sharpF.peak * 1e-3);
    expect(withStatic.peakK / sharpF.peakK).toBeGreaterThan(0.97);
    expect(withStatic.peakK / sharpF.peakK).toBeLessThan(1.03);
    // Pervanede (k = 6) dönmeyen m = 5 yapısı ±2 kutunun içinde: tepe fazlalığı
    // onu ayıramaz; taban kare (kanatlar gizli) çıkarılınca kanat payı kalır
    const prop = polarFft(luma(bladeImage(6)), 320, 240, RING, 6);
    const both = polarFft(luma(bladeImage(6, { staticM: 5, staticAmp: 0.2 })), 320, 240, RING, 6);
    const base = polarFft(luma(bladeImage(6, { contrast: 0, staticM: 5, staticAmp: 0.2 })), 320, 240, RING, 6);
    expect(both.peakK).toBeGreaterThan(prop.peakK * 1.1);
    expect(Math.abs((both.peakK - base.peakK) / prop.peakK - 1)).toBeLessThan(0.05);
  });

  it('dışlanan bölge örneklenmez; boşluk kenarı yumuşatılır (tepe korunur, sızıntı yok)', () => {
    const L = luma(bladeImage(22));
    const full = polarFft(L, 320, 240, RING, 22);
    // Sağ üst çeyreği dışla (göbek / sehpa gibi)
    const exclude = [shapeTest({ type: 'rect', x0: 0.5, y0: 0, x1: 1, y1: 0.5 }, 320, 240)];
    const part = polarFft(L, 320, 240, RING, 22, { exclude });
    expect(part.valid).toBeLessThan(0.85);
    expect(part.valid).toBeGreaterThan(0.6);
    expect(part.peakK / full.peakK).toBeGreaterThan(0.6);
    expect(part.floorK).toBeLessThan(full.peakK * 0.01);
  });

  it('izdüşümlü disk: eksen dışı kamerada kanat aralığı eşit kalır (elips halka tepeyi yayar)', () => {
    const w = 320;
    const h = 240;
    const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    cam.position.set(1.6, 0.4, -3);
    cam.lookAt(0.15, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    // Disk düzleminde 22 kanatlı desen (z = 0, yarıçap 0,3..1)
    const img = image(w, h, (x, y) => {
      ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), cam);
      if (!ray.ray.intersectPlane(plane, hit)) return [0, 0, 0];
      const r = Math.hypot(hit.x, hit.y);
      const l = r > 0.3 && r < 1 ? 0.5 + 0.4 * Math.cos(22 * Math.atan2(hit.y, hit.x)) : 0.2;
      return [l, l, l];
    });
    const L = luma(img);
    const disk = { type: 'disk', center: [0, 0, 0], axis: [0, 0, 1], r0: 0.4, r1: 0.9 };
    const d = polarFft(L, w, h, disk, 22, { camera: cam });
    // Diskin izdüşüm merkezi ve kenarı (piksel)
    const proj = diskProjector(disk, cam, w, h);
    const [cx, cy] = proj(0, 0);
    const [ex] = proj(1, 0);
    const ring = { type: 'ring', cx: cx / w, cy: cy / h, rx: Math.abs(ex - cx) / w, ry: Math.abs(ex - cx) / h, r0: 0.4, r1: 0.9 };
    const e = polarFft(L, w, h, ring, 22);
    // Kuramsal tepe (0,4/2)² = 0,04: izdüşümlü disk ona yakın, daire halka altında
    expect(d.peakK).toBeGreaterThan(0.035);
    expect(d.peakK).toBeGreaterThan(1.15 * e.peakK);
  });
});

describe('kare karşılaştırma (yalnız renk, NaN maskesi)', () => {
  it('yalnız rengi değişen küçük bölge: parlaklık SSIM ~1, renk SSIM düşer, değişen piksel sayılır', () => {
    const amber = [255 / 255, 176 / 255, 32 / 255];
    const cyan = [46 / 255, 230 / 255, 214 / 255];
    const bg = [0.1, 0.12, 0.14];
    const a = image(96, 64, (x, y) => (x > 40 && x < 52 && y > 20 && y < 32 ? amber : bg));
    const b = image(96, 64, (x, y) => (x > 40 && x < 52 && y > 20 && y < 32 ? cyan : bg));
    const lumaSsim = ssimByMask(luma(a), luma(b), 96, 64, { kare: null }).kare;
    expect(lumaSsim).toBeGreaterThan(0.97);
    expect(ssimRgb(a, b)).toBeLessThan(lumaSsim - 0.05);
    expect(pixelDiff(a, b, null).changedPx).toBe(144);
    expect(pixelDiff(a, a, null).changedPx).toBe(0);
    // Gürültü tabanı (≤ 2/255) sayılmaz
    const n = image(96, 64, (x, y) => bg.map((v) => v + (((x + y) | 0) % 2 ? 2 / 255 : 0)));
    expect(pixelDiff(image(96, 64, () => bg), n, null).changedPx).toBe(0);
  });

  it('NaN maskesi 7×7 genişletilir; dışlanan piksel farka ve SSIM\'e girmez', () => {
    const w = 40;
    const h = 30;
    const m = new Uint8Array(w * h);
    m[15 * w + 20] = 1;
    const d = dilate(m, w, h, 3);
    expect(d.reduce((s, v) => s + v, 0)).toBe(49);
    const a = image(w, h, () => [0.3, 0.3, 0.3]);
    const b = image(w, h, (x, y) => ((x | 0) === 20 && (y | 0) === 15 ? [0, 0, 0] : [0.3, 0.3, 0.3]));
    expect(pixelDiff(a, b, null).changedPx).toBe(1);
    expect(pixelDiff(a, b, null, d).changedPx).toBe(0);
    expect(ssimByMask(luma(a), luma(b), w, h, { kare: null }, 7, d).kare).toBeCloseTo(1, 4);
    expect(ssimByMask(luma(a), luma(b), w, h, { kare: null }).kare).toBeLessThan(0.99);
  });

  it('kapak maskesi (maskFrom): anahtar renkli eşte yeşil ve farklı pikseller', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitrin-'));
    const w = 32;
    const h = 16;
    const capArea = (x, y) => x < 10 && y < 8;
    const normal = image(w, h, (x, y) => (capArea(x, y) ? [0.62, 0.1, 0.08] : [0.3, 0.32, 0.3]));
    const keyBuf = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) keyBuf.set(capArea(x + 0.5, y + 0.5) ? [10, 240, 12] : [77, 82, 77], (y * w + x) * 3);
    await sharp(keyBuf, { raw: { width: w, height: h, channels: 3 } }).png().toFile(path.join(dir, 'k.png'));
    const sh = await resolveMaskFrom({ type: 'maskFrom', frame: 'k' }, normal, dir, new Map());
    expect(sh.px).toBe(80);
    const test = shapeTest(sh, w, h);
    expect(test(2.5, 2.5)).toBe(true);
    expect(test(20.5, 2.5)).toBe(false);
    const none = await resolveMaskFrom({ type: 'maskFrom', frame: 'yok' }, normal, dir, new Map());
    expect(none.missing).toBe(true);
    expect(none.px).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('perf-compare beklenti kuralları', () => {
  it('kural sözdizimi', () => {
    expect(parseRule('=')).toEqual({ op: 'eq' });
    expect(parseRule('≤')).toEqual({ op: 'le' });
    expect(parseRule('≤ 6 ms')).toEqual({ op: 'leAbs', v: 6, rel: false });
    expect(parseRule('<= -10%')).toEqual({ op: 'leAbs', v: -10, rel: true });
    expect(parseRule('+0.3 ms')).toEqual({ op: 'plus', v: 0.3 });
    expect(parseRule('±5%')).toEqual({ op: 'tol', v: 0.05 });
    expect(() => parseRule('yaklaşık')).toThrow(/Anlaşılmayan/);
  });

  it('yön ve mutlak sınırlar', () => {
    expect(checkRule(parseRule('≤'), [534, 534], [480, 480])[0]).toBe(true);
    expect(checkRule(parseRule('='), [534, 534], [480, 480])[0]).toBe(false);
    expect(checkRule(parseRule('+0.3 ms'), [3.4, 3.5], [3.7, 3.8])[0]).toBe(true);
    expect(checkRule(parseRule('+0.3 ms'), [3.4, 3.5], [3.9, 3.8])[0]).toBe(false);
    expect(checkRule(parseRule('≤ 6 ms'), [10.4], [5.9])[0]).toBe(true);
    expect(checkRule(parseRule('≤ -10%'), [100], [89])[0]).toBe(true);
    expect(checkRule(parseRule('≤ -10%'), [100], [95])[0]).toBe(false);
  });

  it('varsayılan: sayımlar eşit, kare ±tol; beklenti bilerek değişeni geçirir; bilinmeyen anahtar düşer', () => {
    const run = (draws, cpu, prog) => ({ phases: { ogle: { frameCpuMs: { p50: cpu }, draws, programsUsedInFrame: 100, programsCompiled: prog } }, programs: { compiled: prog, unusedRatio: 0.5 }, load: { firstFrameMs: 20000 }, env: {}, errors: [] });
    const once = [run(1558, 10.4, 478), run(1558, 10.5, 478)];
    const sonra = [run(390, 5.8, 140), run(390, 5.9, 140)];
    expect(compareRuns(once, sonra).fail).toBeGreaterThan(0);
    const ok = compareRuns(once, sonra, { expect: { kurallar: { '*.draws': '≤', '*.programsCompiled': '≤', 'oturum.programsCompiled': '≤', 'ogle.frameCpuP50': '≤ 6 ms' } } });
    expect(ok.fail).toBe(0);
    const bad = compareRuns(once, sonra, { expect: { kurallar: { 'ogle.yok': '≤' } } });
    expect(bad.unknown).toEqual(['ogle.yok']);
    expect(bad.fail).toBeGreaterThan(0);
  });
});
