/**
 * Simülasyon denetimleri: bir gece baştan sona bozulmadan döner, aynı tohum
 * aynı sonucu verir, basit bir oyuncu balık tutabilir.
 */
import { describe, expect, it } from 'vitest';
import { Dunya, G, N_IP, SURE, TUR, type Girdi } from './dunya';

const ADIM = 1 / 60;

/** scripts/kayit.mjs'teki botla aynı mantık. */
function bot(d: Dunya, g: Girdi): void {
  const yem = d.kancadaki;
  const yemSira = yem ? TUR[yem.tur].sira : 0;
  const hedefSira = d.t < 25 ? 2 : d.t < 60 ? 3 : d.t < 85 ? 4 : 5;
  let en = null;
  let enUz = 1e9;
  for (const b of d.baliklar) {
    if (b.durum !== 'yuz' && b.durum !== 'ilgi') continue;
    const s = TUR[b.tur].sira;
    const fark = s - yemSira;
    if (s === 0 || fark < 1 || fark > 2) continue;
    const uz = Math.hypot(b.x - d.kancaX, (b.y - d.kancaY) * 0.7);
    if (uz < enUz) {
      enUz = uz;
      en = b;
    }
  }
  if (yem) {
    if (TUR[yem.tur].agirlik >= 0.4 && yem.cirp > 0) {
      g.basili = true;
      g.x = d.kancaX;
      g.y = d.kancaY + 2;
      return;
    }
    if (yemSira >= hedefSira || yemSira === 0) {
      g.basili = false;
      return;
    }
  }
  if (!en) {
    // Uygun av yok: yem varsa sar, yoksa bekle.
    g.basili = false;
    return;
  }
  g.basili = true;
  g.x = Math.max(d.kam.x + 8, Math.min(d.kam.x + G - 8, en.x + en.vx * 0.5));
  g.y = en.y + 1;
}

function gece(tohum: number, oyuncu: (d: Dunya, g: Girdi) => void): Dunya {
  const d = new Dunya(390, tohum);
  const g: Girdi = { basili: false, x: 0, y: 0 };
  d.basla();
  for (let i = 0; i < (SURE + 2) / ADIM; i++) {
    oyuncu(d, g);
    d.adim(ADIM, g);
    d.olaylar.length = 0;
    if (i % 600 === 0) {
      for (let k = 0; k < N_IP; k++) {
        expect(Number.isFinite(d.ipX[k])).toBe(true);
        expect(Number.isFinite(d.ipY[k])).toBe(true);
      }
      for (const b of d.baliklar) expect(Number.isFinite(b.x + b.y)).toBe(true);
    }
  }
  return d;
}

describe('LODOS simülasyonu', () => {
  it('gece baştan sona döner ve şafakta biter', () => {
    const d = gece(7, (dd, g) => {
      // Rastgele gezinen parmak
      g.basili = Math.sin(dd.zaman * 0.9) > -0.3;
      g.x = dd.kam.x + 90 + Math.sin(dd.zaman * 0.37) * 80;
      g.y = dd.deniz + 60 + Math.sin(dd.zaman * 0.61) * 80;
    });
    expect(d.bitti).toBe(true);
    expect(d.t).toBeGreaterThanOrEqual(SURE);
    expect(d.tekne.x).toBeGreaterThan(0);
  });

  it('aynı tohum aynı geceyi verir', () => {
    const a = gece(42, bot);
    const b = gece(42, bot);
    expect(a.para).toBe(b.para);
    expect(a.yakalanan).toEqual(b.yakalanan);
  });

  it('basit bir oyuncu balık tutar ve zincir kurar', () => {
    let toplam = 0;
    let zincir = 0;
    for (const tohum of [1, 2, 3]) {
      const d = gece(tohum, bot);
      toplam += d.para;
      zincir = Math.max(zincir, d.enZincir);
      expect(d.para).toBeGreaterThan(10);
    }
    expect(toplam, `toplam ${toplam}`).toBeGreaterThan(200);
    expect(zincir).toBeGreaterThanOrEqual(2);
  });

  it('hiç dokunmayan oyuncu hiçbir şey tutmaz, hiçbir şey koparmaz', () => {
    const d = gece(5, (_d, g) => {
      g.basili = false;
    });
    expect(d.para).toBe(0);
    expect(d.kopan).toBe(0);
  });
});
