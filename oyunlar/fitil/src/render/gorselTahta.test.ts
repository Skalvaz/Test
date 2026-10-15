/**
 * Görsel tahta: olaylar uygulanınca `sonraki` durumla eşit olmalı (§16.1).
 * Olaylar geçici sahte üreticiden (dev/sahteOlaylar.ts) gelir; gerçek
 * çekirdek bağlanınca aynı test altın tekrarlarla da koşturulabilir.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from '../core/bolumYukle';
import type { BolumVerisi, Hamle, Olay, OyunDurumu } from '../core/types';
import { finalGosterisi, hamleUygula, ustaEliUygula } from '../core/index';
import { rngInt } from '../core/rng';
import { rastgeleBolum, rastgeleHamle } from '../core/testAraclari';
import { GorselTahta, DUSME_MS, INIS_MS } from './gorselTahta';
import { sahteFinal, sahteHamle } from './dev/sahteOlaylar';
import { BUYUK_YOL, ZENGIN } from './dev/zenginTahta';
import b001 from '../levels/veri/b001.json';

function oynat(d: OyunDurumu, h: Hamle | 'final'): { g: GorselTahta; sonraki: OyunDurumu } {
  const g = new GorselTahta();
  g.kur(d);
  const r = h === 'final' ? sahteFinal(d) : sahteHamle(d, h);
  for (const o of r.olaylar) g.uygula(o);
  return { g, sonraki: r.durum };
}

describe('GorselTahta olaylarla sonraki duruma ulaşır', () => {
  const zengin = () => bolumuYukle(structuredClone(ZENGIN), 0);
  const durumlar: [string, () => OyunDurumu, Hamle | 'final'][] = [
    ['büyük zincir (fitil + ısı + roket + kasımpatı + yerçekimi)', zengin, { tur: 'fitil', yol: BUYUK_YOL, halka: false }],
    ['çift dokunuş roket', zengin, { tur: 'ciftDokunus', hucre: { x: 2, y: 4 } }],
    ['çift dokunuş kasımpatı', zengin, { tur: 'ciftDokunus', hucre: { x: 5, y: 4 } }],
    ['çift dokunuş yıldız topu', zengin, { tur: 'ciftDokunus', hucre: { x: 3, y: 7 } }],
    ['kibrit barut izi', zengin, { tur: 'kibrit', hucre: { x: 1, y: 3 } }],
    ['körük', zengin, { tur: 'koruk', merkez: { x: 3, y: 5 } }],
    ['final gösterisi', zengin, 'final'],
    ['bölüm 1 ısı tadı', () => bolumuYukle(b001 as unknown as BolumVerisi, 0), { tur: 'fitil', yol: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }], halka: false }],
  ];
  for (const [ad, kur, h] of durumlar) {
    it(ad, () => {
      const { g, sonraki } = oynat(kur(), h);
      expect(g.farklar(sonraki)).toEqual([]);
    });
  }

  it('kombinasyon (roket + kasımpatı) ve halka', () => {
    const d = zengin();
    const k = (renk: number, ozel: 'yok' | 'kasimpati' = 'yok') => ({ tur: 'kapsul' as const, renk: renk as 0, isi: 0, ozel, eksen: 0 as const });
    d.hucreler[4 * 7 + 3].icerik = k(2);
    d.hucreler[4 * 7 + 4].icerik = k(2);
    d.hucreler[4 * 7 + 5].icerik = k(2, 'kasimpati');
    const r = sahteHamle(d, { tur: 'fitil', yol: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }], halka: false });
    expect(r.olaylar.some((o) => o.tur === 'kombinasyon' && o.kombo === 'kalinRoket')).toBe(true);
    const g = new GorselTahta();
    g.kur(d);
    for (const o of r.olaylar) g.uygula(o);
    expect(g.farklar(r.durum)).toEqual([]);
  });

  it('art arda hamleler boyunca eşit kalır', () => {
    let d = zengin();
    const g = new GorselTahta();
    g.kur(d);
    const hamleler: Hamle[] = [
      { tur: 'fitil', yol: BUYUK_YOL, halka: false },
      { tur: 'kibrit', hucre: { x: 3, y: 3 } },
      { tur: 'kibrit', hucre: { x: 0, y: 8 } },
    ];
    for (const h of hamleler) {
      const r = sahteHamle(d, h);
      for (const o of r.olaylar) g.uygula(o);
      expect(g.farklar(r.durum)).toEqual([]);
      d = r.durum;
    }
  });
});

describe('GorselTahta canlandırma', () => {
  it('düşme 90·√d ms sürer, ardından 80 ms iniş ezilmesi', () => {
    const d = bolumuYukle(structuredClone(ZENGIN), 0);
    const g = new GorselTahta();
    g.kur(d);
    // (0,6)'yı boşalt ve üstündekini 1 hücre düşür.
    g.uygula({ t: 0, tur: 'patlama', hucre: { x: 0, y: 6 }, renk: 0, neden: 'fitil', nesil: 0, puan: 10, ozel: 'yok', k: 1 });
    g.uygula({ t: 0, tur: 'yercekimi', dusenler: [{ den: { x: 0, y: 5 }, e: { x: 0, y: 6 } }], doganlar: [] });
    const h = g.hucre({ x: 0, y: 6 })!;
    expect(h.oy).toBeCloseTo(-1);
    expect(g.hareketVar()).toBe(true);
    g.guncelle(DUSME_MS / 2);
    expect(h.oy).toBeCloseTo(-(1 - 0.25), 5); // inQuad: yarı sürede %25 yol
    g.guncelle(DUSME_MS / 2 + 1);
    expect(h.oy).toBe(0);
    expect(h.inis).toBeGreaterThanOrEqual(0);
    g.guncelle(INIS_MS + 1);
    expect(g.hareketVar()).toBe(false);
  });

  it('doğanlar tahta üstünden (sanalY) düşer', () => {
    const d = bolumuYukle(structuredClone(ZENGIN), 0);
    const g = new GorselTahta();
    g.kur(d);
    g.uygula({ t: 0, tur: 'yercekimi', dusenler: [], doganlar: [{ hucre: { x: 2, y: 0 }, icerik: { tur: 'kapsul', renk: 1, isi: 0, ozel: 'yok', eksen: 0 }, sanalY: -2 }] });
    const h = g.hucre({ x: 2, y: 0 })!;
    expect(h.oy).toBeCloseTo(-2);
    expect(h.hSure).toBeCloseTo(DUSME_MS * Math.SQRT2);
  });

  it('ısı yuvası 120 ms\'de dolar, kızgın çekirdek 150 ms\'de belirir', () => {
    const d = bolumuYukle(structuredClone(ZENGIN), 0);
    const g = new GorselTahta();
    g.kur(d);
    const p = { x: 2, y: 5 }; // ısı 2
    g.uygula({ t: 0, tur: 'isindi', hucre: p, isi: 3, kizgin: true });
    const h = g.hucre(p)!;
    expect(h.nabiz).toBe(0);
    g.guncelle(60);
    expect(h.isiGorunen).toBeCloseTo(2.5);
    expect(h.kizgin).toBeCloseTo(0.4);
    g.guncelle(100);
    expect(h.isiGorunen).toBe(3);
    expect(h.kizgin).toBe(1);
  });

  it('karıştırma içerikleri takas eder ve Bezier yolunda canlandırır', () => {
    const d = bolumuYukle(structuredClone(ZENGIN), 0);
    const g = new GorselTahta();
    g.kur(d);
    const a = structuredClone(g.hucre({ x: 1, y: 2 })!.icerik);
    const b = structuredClone(g.hucre({ x: 2, y: 2 })!.icerik);
    g.uygula({ t: 0, tur: 'karistirma', esleme: [{ den: { x: 1, y: 2 }, e: { x: 2, y: 2 } }, { den: { x: 2, y: 2 }, e: { x: 1, y: 2 } }], yenidenRenk: [] });
    expect(g.hucre({ x: 2, y: 2 })!.icerik).toEqual(a);
    expect(g.hucre({ x: 1, y: 2 })!.icerik).toEqual(b);
    expect(g.hucre({ x: 2, y: 2 })!.hTur).toBe(2);
    g.guncelle(501);
    expect(g.hareketVar()).toBe(false);
  });

  it('fark varsa farklar() bildirir, esitle() düzeltir', () => {
    const d = bolumuYukle(structuredClone(ZENGIN), 0);
    const g = new GorselTahta();
    g.kur(d);
    const d2 = structuredClone(d);
    d2.hucreler[0].icerik = null;
    expect(g.farklar(d2).length).toBe(1);
    g.esitle(d2);
    expect(g.farklar(d2)).toEqual([]);
  });
});

describe('gerçek çekirdekle bulanık tutarlılık (§16.1)', () => {
  it('rastgele bölüm ve eylemler (kalıp, kombinasyon, final, Usta\'nın Eli dahil): her eylemden sonra fark yok', () => {
    let eylem = 0;
    let kalip = 0;
    for (let oyun = 0; oyun < 60; oyun++) {
      const r = { rng: (oyun * 0x85ebca6b + 0x1234567) >>> 0 };
      const v = rastgeleBolum(r, 7000 + oyun);
      let d = bolumuYukle(v, rngInt(r, 3));
      const g = new GorselTahta();
      g.kur(d);
      const uygula = (s: { olaylar: Olay[]; durum: OyunDurumu }, ad: string) => {
        for (const o of s.olaylar) g.uygula(o);
        expect(g.farklar(s.durum), `oyun ${oyun} ${ad}`).toEqual([]);
        eylem++;
      };
      let eli = true;
      for (let adim = 0; adim < 40; adim++) {
        if (d.bitti === 'kayip' && eli && !d.istatistik.ustaEli) {
          eli = false;
          const u = ustaEliUygula(d);
          uygula(u, 'ustaEli');
          d = u.durum;
        }
        if (d.bitti) break;
        const h = rastgeleHamle(d, r);
        if (!h) break;
        if (h.tur === 'kalip') kalip++;
        const s = hamleUygula(d, h);
        uygula(s, `adım ${adim} ${h.tur}`);
        d = s.durum;
      }
      if (d.bitti === 'kazanc') uygula(finalGosterisi(d), 'final');
    }
    expect(eylem).toBeGreaterThan(300);
    expect(kalip).toBeGreaterThan(0);
  });
});
