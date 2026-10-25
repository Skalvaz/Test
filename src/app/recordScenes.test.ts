/**
 * Kayıt sahneleri (scripts/capture/scenes) olay ya da koşul bekler (T-20);
 * önce/sonra kıyası için iki şart: (1) advanceUntil olmayan eski commit'lerde
 * de çalışır (korumalı), (2) bugünkü kalibrasyonda Dalga 0 öncesindeki sabit
 * süreli kurulumla aynı adımda durur (kareler birebir eşleşir).
 *
 * Kurulum metni sayfadakiyle aynı biçimde çalıştırılır (`a` App'in sahte
 * eşi, `sim` EngineSim); App.advanceStep gibi her adımda sim.step ve
 * otomatik çalıştırma. Kalibrasyonu değiştiren paket (1B, 2H) eşiği yeniden
 * seçer ya da kayma kaydını commit mesajına yazar.
 */

import { describe, expect, it } from 'vitest';
import startRaw from '../../scripts/capture/scenes/start.json?raw';
import { EngineSim } from '../sim';
import { AutoStart } from '../sim/autostart';
import { designFor } from '../design/catalog';
import { advanceUntil } from './waitFor';

interface FakeApp {
  sim: EngineSim;
  beginAutoStart(): void;
  advance(seconds: number): void;
  advanceUntil?: (pred: () => boolean, max?: number) => { ok: boolean; seconds: number };
}

/** Kurulumu çalıştırır; atılan adım sayısını döndürür */
function runSetup(setup: string, withAdvanceUntil: boolean): { steps: number; sim: EngineSim } {
  const sim = new EngineSim();
  sim.setDesign(designFor('turbofan'));
  sim.trim(0, 30);
  const auto = new AutoStart();
  const dt = 1 / 30;
  let steps = 0;
  const step = (d: number) => {
    sim.step(d);
    auto.update(sim);
    steps++;
  };
  const a: FakeApp = {
    sim,
    beginAutoStart: () => {
      auto.begin(sim);
    },
    // App.advance ile aynı döngü (kayan noktalı birikim dahil)
    advance: (seconds) => {
      for (let t = 0; t < seconds; t += dt) step(dt);
    },
  };
  if (withAdvanceUntil) {
    a.advanceUntil = (pred, max = 120) => advanceUntil({ step, subscribe: () => () => {}, target: pred, maxSeconds: max, dt });
  }
  new Function('a', 'sim', setup)(a, sim);
  return { steps, sim };
}

describe('kayıt sahnesi start.json', () => {
  const scene = JSON.parse(startRaw) as { setup: string };

  it('advanceUntil yoksa (eski commit) sabit süreyle çalışır', () => {
    expect(() => runSetup(scene.setup, false)).not.toThrow();
    expect(runSetup(scene.setup, false).steps).toBe(615);
  });

  it('bugünkü kalibrasyonda Dalga 0 öncesindeki a.advance(20.5) ile aynı adımda durur (615 = 20,5 s)', () => {
    const now = runSetup(scene.setup, true);
    const old = runSetup('a.sim.reset(); a.beginAutoStart(); a.advance(20.5);', true);
    expect(old.steps).toBe(615);
    expect(now.steps).toBe(old.steps);
    expect(now.sim.N2).toBe(old.sim.N2);
    // Yakıt henüz verilmedi: kare yakıttan hemen önceki an
    expect(now.sim.controls.fuelRun).toBe(false);
  });
});
