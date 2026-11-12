/**
 * Simülasyon denetimleri: oyun bozulmadan döner, aynı tohum aynı sonucu
 * verir, basit bir pilot birkaç dalga dayanır, hiç oynamayan kaybeder.
 */
import { describe, expect, it } from 'vitest';
import { Dunya } from './dunya';

const ADIM = 1 / 60;

/** scripts/kayit.mjs'teki pilotla aynı mantık. */
function pilot(d: Dunya): void {
  const h = d.heli;
  let on = 1e9;
  for (const s of d.askerler) if (!s.dost && s.x < on) on = s.x;
  for (const a of d.araclar) if (a.x < on) on = a.x;
  let tx = Math.max(170, Math.min(385, (on < 1e8 ? on : 300) - 50));
  let ty = d.zemin - 88 + Math.sin(d.zaman * 1.7) * 28;
  for (const f of d.flaklar) {
    if (Math.hypot(f.x - h.x, f.y - h.y) < 40) {
      tx += h.x < f.x ? -50 : 50;
      ty += h.y < f.y ? -30 : 30;
    }
  }
  for (const m of d.mermiler) {
    if (m.tip < 2) continue;
    const dx = h.x - m.x;
    const dy = h.y - m.y;
    if (Math.hypot(dx, dy) < 60 && dx * m.vx + dy * m.vy > 0) ty += dy > 0 ? 26 : -26;
  }
  d.surukle((tx - h.hx) * 0.2, (ty - h.hy) * 0.2);
}

function oyna(tohum: number, oyuncu: (d: Dunya) => void, enCok = 400): Dunya {
  const d = new Dunya(566, tohum);
  d.basla();
  for (let i = 0; i < enCok / ADIM && !d.bitti; i++) {
    oyuncu(d);
    d.adim(ADIM);
    d.olaylar.length = 0;
    if (i % 300 === 0) {
      expect(Number.isFinite(d.heli.x + d.heli.y)).toBe(true);
      for (const s of d.askerler) expect(Number.isFinite(s.x + s.y)).toBe(true);
      for (const b of d.bezler) expect(Number.isFinite(b.x[0] + b.y[0])).toBe(true);
      expect(d.parcalar.length).toBeLessThan(1000);
    }
  }
  return d;
}

describe('BARUT simülasyonu', () => {
  it('basit pilot birkaç dalga dayanır, sonunda oyun biter', () => {
    for (const tohum of [1, 2, 3]) {
      const d = oyna(tohum, pilot);
      expect(d.bitti, `tohum ${tohum}`).toBe(true);
      expect(d.dalga, `tohum ${tohum} dalga`).toBeGreaterThanOrEqual(3);
      expect(d.olu.piyade).toBeGreaterThan(40);
      expect(d.skor).toBeGreaterThan(800);
    }
  });

  it('aynı tohum aynı oyunu verir', () => {
    const a = oyna(42, pilot);
    const b = oyna(42, pilot);
    expect(a.skor).toBe(b.skor);
    expect(a.olu).toEqual(b.olu);
    expect(a.zaman).toBe(b.zaman);
  });

  it('hiç oynamayan kaybeder', () => {
    const d = oyna(5, () => {});
    expect(d.bitti).toBe(true);
    expect(d.bitisNeden).not.toBe('');
  });

  it('patlama zemini oyar ama siperin altını oymaz', () => {
    const d = new Dunya(566, 9);
    d.basla();
    const once = d.yerY(400);
    const siper = d.yerY(100);
    d.patlat(400, once - 2, 24, true, 3);
    d.patlat(100, siper - 2, 24, true, 3);
    expect(d.yerY(400)).toBeGreaterThan(once);
    expect(d.yerY(100)).toBe(siper);
  });
});
