import { describe, expect, it } from 'vitest';
import { garantiUygula } from './garanti';
import { bolumuYukle, gruplariBul, hamleUygula, hazirCiftSayisi, hazirHamleler, karisimHamleleri, onizle, onizleDetay, olumluHamleler } from './index';
import type { BolumVerisi, OyunDurumu } from './types';
import { rngInt } from './rng';
import { kur, rastgeleBolum, rastgeleHamle } from './testAraclari';
import b001 from '../levels/veri/b001.json';

const b1 = b001 as unknown as BolumVerisi;

/** Rastgele oyunlardan durum örnekleri. */
function durumlar(oyun: number, adim: number, ek: (v: BolumVerisi) => BolumVerisi = (v) => v): OyunDurumu[] {
  const out: OyunDurumu[] = [];
  for (let k = 0; k < oyun; k++) {
    const r = { rng: (k * 0x9e3779b1 + 77) >>> 0 };
    const v = ek(rastgeleBolum(r, 8000 + k));
    let d = bolumuYukle(v, 0);
    for (let a = 0; a < adim && !d.bitti; a++) {
      out.push(d);
      const h = rastgeleHamle(d, r);
      if (!h) break;
      d = hamleUygula(d, h).durum;
    }
  }
  return out;
}

describe('hazır hamle sayımı (§4.7)', () => {
  it('hızlı sayım = önizlemenin ilk adım grupları (hamle hamle eşdeğer)', () => {
    let hamle = 0;
    let hazir = 0;
    for (const d of durumlar(60, 12)) {
      const h = new Set(hazirHamleler(d).map((m) => `${m.k}>${m.e}`));
      for (const m of karisimHamleleri(d)) {
        const hm = { tur: 'surukle' as const, kaynak: { x: m.k % d.w, y: Math.floor(m.k / d.w) }, hedef: { x: m.e % d.w, y: Math.floor(m.e / d.w) } };
        const o = onizle(d, hm);
        expect(o.gecerli).toBe(true);
        expect(h.has(`${m.k}>${m.e}`), JSON.stringify(hm)).toBe(o.gruplar.length > 0);
        hamle++;
        if (o.gruplar.length) hazir++;
      }
    }
    expect(hamle).toBeGreaterThan(3000);
    expect(hazir).toBeGreaterThan(300);
  });

  it('olumluHamleler: temizlenene göre azalan, eşitlikte indeks; özel sürükleme yok', () => {
    for (const d of durumlar(10, 8)) {
      const l = olumluHamleler(d);
      expect(l.length).toBe(hazirHamleler(d).length);
      for (let i = 1; i < l.length; i++) expect(l[i - 1].temizlenen).toBeGreaterThanOrEqual(l[i].temizlenen);
      // temizlenen damla sayısıdır (aynı hücre farklı adımlarda iki kez sayılır);
      // önizlemenin `temizlenecek` listesi eşsiz hücrelerdir.
      for (const o of l) {
        expect(o.temizlenen).toBe(onizleDetay(d, o.hamle)!.olaylar.filter((x) => x.tur === 'temizlendi').length);
        expect(o.temizlenen).toBeGreaterThanOrEqual(onizle(d, o.hamle).temizlenecek.length);
      }
    }
  });
});

describe('garanti (§4.7, K3)', () => {
  it('grup doğurmaz, hazır sayısını artırır, belirlenimli', () => {
    // Hazır çift yok: Turuncu ikilisinin yanında Sarı. (2,2) Kırmızı olursa
    // aşağı, (3,3) Kırmızı olursa sola karışım Turuncu üçlüsü kurar.
    const satir = ['4 4 4 4 4', '4 4 4 4 4', '4 4 4 4 4', '3 3 2 4 4'];
    const d = kur(satir);
    expect(hazirCiftSayisi(d)).toBe(0);
    const r = { rng: 12345 };
    const adaylar = [12, 18, 13, 14];
    expect(garantiUygula(d, adaylar, r, [20, 20, 20, 11, 11, 11], 2)).toBe(true);
    expect(gruplariBul(d)).toEqual([]);
    expect(hazirCiftSayisi(d)).toBe(2);
    expect(r.rng).not.toBe(12345);
    const d2 = kur(satir);
    garantiUygula(d2, adaylar, { rng: 12345 }, [20, 20, 20, 11, 11, 11], 2);
    expect(JSON.stringify(d2.hucreler)).toBe(JSON.stringify(d.hucreler));
  });

  it('ağırlığı 0 olan renk seçilmez; garanti 0 hiçbir şeyi değiştirmez', () => {
    const d = kur(['4 4 4 4', '4 4 4 4', '3 3 4 4']);
    const once = JSON.stringify(d.hucreler);
    expect(garantiUygula(d, [8, 9, 10], { rng: 1 }, [20, 20, 20, 11, 11, 11], 0)).toBe(false);
    expect(JSON.stringify(d.hucreler)).toBe(once);
    garantiUygula(d, [10, 11, 6, 7], { rng: 1 }, [10, 10, 0, 0, 0, 0], 3);
    for (const c of d.hucreler) expect([1, 2, 3, 4]).toContain((c.icerik as { damla: { renk: number } }).damla.renk);
  });

  it('ilk tahta: bölüm 1 garanti 3 → en az 3 hazır çift, her denemede aynı', () => {
    const d = bolumuYukle(b1, 0);
    expect(hazirCiftSayisi(d)).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(bolumuYukle(b1, 4).hucreler)).toBe(JSON.stringify(d.hucreler));
  });

  it('7×9 D3: garanti 2 ile hamle sonrası durumların ≥ %90ında ≥ 2 hazır; garanti 0 belirgin düşük', () => {
    const olc = (garanti: number): number => {
      let iyi = 0;
      let n = 0;
      for (let k = 0; k < 25; k++) {
        const v: BolumVerisi = { ...b1, id: 500 + k, w: 7, h: 9, tohum: 1000 + k, dogum: [20, 20, 20, 11, 11, 11], garanti, hamle: 25, duzen: Array(9).fill('. . . . . . .'), zorunluIlkHamle: undefined, hedefler: [{ tur: 'puan', puan: 1e9 }] };
        let d = bolumuYukle(v, 0);
        const r = { rng: k + 1 };
        for (let a = 0; a < 25 && !d.bitti; a++) {
          const l = olumluHamleler(d);
          const h = l.length && rngInt(r, 10) < 7 ? l[rngInt(r, l.length)].hamle : rastgeleHamle(d, r)!;
          d = hamleUygula(d, h).durum;
          n++;
          if (hazirCiftSayisi(d) >= 2) iyi++;
        }
      }
      return iyi / n;
    };
    const g2 = olc(2);
    const g0 = olc(0);
    expect(g2).toBeGreaterThanOrEqual(0.9);
    expect(g2 - g0).toBeGreaterThan(0.15);
  }, 60_000);
});
