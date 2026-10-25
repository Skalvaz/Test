/**
 * Işık takımı sözleşmesi (Dalga 0; uygulama 2B / T-03).
 *
 * **Kural: sahnedeki ışıkların sayısı ve türü sabittir.** three.js ışık
 * sayısı ya da türü değişince bütün malzemeleri yeniden derler (ortam
 * geçişindeki 20–60 s'lik donmanın bir kısmı budur). Ortamlar ışık eklemez,
 * çıkarmaz, görünürlüğünü değiştirmez; yalnız şiddet, renk ve konum yazar.
 * Kapalı ışık = şiddet 0. Yeni bir ışık gerekiyorsa yuvası buraya eklenir ve
 * her ortamın ön ayarı onu (gerekirse 0 ile) tanımlar.
 *
 * Bugünkü takım (createEnvironment + App):
 *   sun       DirectionalLight, gölgeli (hücre: tavan anahtar ışığı)
 *   ambient   HemisphereLight
 *   keyPanel  RectAreaLight (stüdyo anahtar paneli)
 *   rimPanel  RectAreaLight (kenar paneli)
 *   rampA/B   PointLight (gece apron lambaları; gündüz 0)
 *   cutFill   PointLight (kesit dolgu ışığı, kameraya bağlı; App yazar)
 * **Bugün sabit olmayanlar (2B kapatır):** havaalanı projektörleri
 * (airfield.ts `spots`, SpotLight) ve hücre donanımının ışıkları kökün
 * görünürlüğüyle sahneye girip çıkar; art yakıcı ışığı (EngineEffects)
 * modelle birlikte kurulur.
 *
 * Şiddet API'si: `setIntensity(yuva, değer)`, `apply(önAyar)`; ortam başına
 * ön ayarlar `LIGHT_PRESETS`'te (hücre bugün elle; havaalanı ön ayarları
 * gökyüzü HDRI'sından hesaplanır, environment.js `setHdri`).
 */

import * as THREE from 'three';

export const LIGHT_SLOTS = ['sun', 'ambient', 'keyPanel', 'rimPanel', 'rampA', 'rampB', 'cutFill'] as const;
export type LightSlot = (typeof LIGHT_SLOTS)[number];

type Vec3 = readonly [number, number, number];

/** Bir yuvanın ön ayarı: verilen alanlar yazılır, verilmeyenler korunur */
export interface LightState {
  intensity?: number;
  color?: number;
  position?: Vec3;
  /** Yönlü ışığın hedefi (sun.target) */
  target?: Vec3;
  /** Alan ışığının bakış noktası (position'dan sonra uygulanır) */
  lookAt?: Vec3;
}

export type LightPreset = Partial<Record<LightSlot, LightState>>;

/** Hücrenin tam ışıklı ön ayarı (tavan armatür sırasının altı, hafif önden) */
export const CELL_LIGHTS: LightPreset = {
  sun: { color: 0xfff3e6, intensity: 2.4, position: [2.5, 14, -3.5], target: [0, 0, 0.3] },
  ambient: { intensity: 0.12 },
  keyPanel: { color: 0xf2f5ff, intensity: 2.2, position: [-4.5, 7.6, -1.5], lookAt: [0, 0, 0.3] },
  rimPanel: { color: 0xfff0e0, intensity: 1.6, position: [4.5, 7.6, 3], lookAt: [0, 0, 0.5] },
};

/** Ortam başına ön ayarlar (2B: havaalanı, gece, gün batımı buraya; "Saat" kaydırıcısı bunlar arasında karışım) */
export const LIGHT_PRESETS: Record<string, LightPreset> = {
  'Test hücresi': CELL_LIGHTS,
};

/** Hücre ışık seviyesi (1 açık … 0 gece): pişmiş ışığa uyan şiddetler */
export function cellLightLevel(level: number): LightPreset {
  const k = Math.max(0, Math.min(1, level));
  return {
    sun: { intensity: 2.4 * k },
    keyPanel: { intensity: 2.2 * k },
    rimPanel: { intensity: 1.6 * k },
    ambient: { intensity: 0.12 * k + 0.015 },
  };
}

export class LightRig {
  private lights = new Map<LightSlot, THREE.Light>();

  constructor(lights: Partial<Record<LightSlot, THREE.Light>> = {}) {
    for (const [slot, light] of Object.entries(lights) as [LightSlot, THREE.Light][]) this.add(slot, light);
  }

  /** Yuvaya ışık bağlar (kurulumda bir kez; sonradan sayı değişmez) */
  add(slot: LightSlot, light: THREE.Light) {
    if (this.lights.has(slot)) throw new Error(`Işık yuvası zaten dolu: ${slot}`);
    this.lights.set(slot, light);
  }

  get(slot: LightSlot): THREE.Light | undefined {
    return this.lights.get(slot);
  }

  /** Bağlı yuvalar (sabit sıra) */
  get slots(): LightSlot[] {
    return LIGHT_SLOTS.filter((s) => this.lights.has(s));
  }

  /** Işık sayısı: ortam geçişlerinde değişmemelidir */
  get count(): number {
    return this.lights.size;
  }

  setIntensity(slot: LightSlot, value: number) {
    const l = this.lights.get(slot);
    if (l) l.intensity = value;
  }

  intensity(slot: LightSlot): number {
    return this.lights.get(slot)?.intensity ?? 0;
  }

  /** Ön ayarı uygular (yalnız verilen alanlar; konumdan sonra bakış) */
  apply(preset: LightPreset) {
    for (const slot of LIGHT_SLOTS) {
      const s = preset[slot];
      const l = this.lights.get(slot);
      if (!s || !l) continue;
      if (s.color !== undefined) l.color.setHex(s.color);
      if (s.intensity !== undefined) l.intensity = s.intensity;
      if (s.position) l.position.set(...s.position);
      if (s.target && (l as THREE.DirectionalLight).target) (l as THREE.DirectionalLight).target.position.set(...s.target);
      if (s.lookAt) l.lookAt(...s.lookAt);
    }
  }

  /** Bütün yuvaların şiddeti (ölçüm ve testler) */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.slots.map((s) => [s, this.intensity(s)]));
  }
}
