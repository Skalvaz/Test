/**
 * Dalga 0 sözleşmeleri (kamera ve ışık): görüntü alanının güvenli
 * dikdörtgeni ve projeksiyon kaydırması (camera/viewport.ts), ışık takımı
 * (core/lightRig.ts) ve pozlama (core/exposure.ts). Değerler bugünkü
 * davranışın aynısıdır; değiştiren paket (1G, 2A, 2B, 2E) testi günceller.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { safeRect, setActiveViewport, Viewport } from './viewport';
import { CELL_LIGHTS, cellLightLevel, LIGHT_SLOTS, LightRig } from '../../core/lightRig';
import { CELL_EXPOSURE, cellExposure, hdriExposure } from '../../core/exposure';

describe('görüntü alanı', () => {
  it('güvenli dikdörtgen kenar boşluklarını çıkarır; kayıt yoksa bütün pencere', () => {
    const v = new Viewport();
    v.setSize(1280, 720);
    v.setInsets({ left: 332, right: 312, top: 52, bottom: 212 });
    expect(v.safeRect()).toEqual({ x: 332, y: 52, width: 636, height: 456 });
    setActiveViewport(v);
    expect(safeRect()).toEqual(v.safeRect());
    setActiveViewport(null);
    expect(safeRect().x).toBe(0);
  });

  it('projeksiyon kaydırması eski formülle aynı (paneller arası merkez, en çok 1,8 kat)', () => {
    const v = new Viewport();
    const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
    v.setSize(1440, 810);
    v.setInsets({ left: 384, right: 356, top: 52, bottom: 226 });
    v.apply(cam, true);
    const k = Math.min(1.8, Math.sqrt((1440 * 810) / ((1440 - 384 - 356) * (810 - 52 - 226))));
    expect(cam.view!.width).toBeCloseTo(1440 * k, 6);
    expect(cam.view!.offsetX).toBeCloseTo(720 - (720 + (384 - 356) / 2) * k, 6);
  });
});

describe('ışık takımı ve pozlama', () => {
  function rig() {
    return new LightRig({
      sun: new THREE.DirectionalLight(),
      ambient: new THREE.HemisphereLight(),
      keyPanel: new THREE.RectAreaLight(),
      rimPanel: new THREE.RectAreaLight(),
      rampA: new THREE.PointLight(),
      rampB: new THREE.PointLight(),
      cutFill: new THREE.PointLight(),
    });
  }

  it('sabit yuvalar; ön ayar yalnız verilen alanları yazar; sayı değişmez', () => {
    const r = rig();
    expect(r.slots).toEqual([...LIGHT_SLOTS]);
    r.setIntensity('rampA', 320);
    r.apply(CELL_LIGHTS);
    expect(r.intensity('sun')).toBe(2.4);
    expect(r.intensity('keyPanel')).toBe(2.2);
    expect(r.intensity('rampA')).toBe(320);
    expect((r.get('sun') as THREE.DirectionalLight).target.position.toArray()).toEqual([0, 0, 0.3]);
    r.apply(cellLightLevel(0));
    expect(r.snapshot()).toMatchObject({ sun: 0, keyPanel: 0, rimPanel: 0, ambient: 0.015 });
    expect(r.count).toBe(7);
    expect(() => r.add('sun', new THREE.DirectionalLight())).toThrow();
  });

  it('pozlama: hücre 0,95, karanlıkta göz uyumu, HDRI sınırları', () => {
    expect(cellExposure(1)).toBe(CELL_EXPOSURE);
    expect(cellExposure(0)).toBe(0.95 * (1 + 0.6 * (1 - 0)));
    expect(cellExposure(0.35)).toBe(0.95 * (1 + 0.6 * (1 - 0.35)));
    expect(hdriExposure(0.2, 1e-9)).toBe(8);
    expect(hdriExposure(0.2, 100)).toBe(0.05);
  });
});
