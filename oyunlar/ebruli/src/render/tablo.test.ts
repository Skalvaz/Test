/**
 * Ebru tablosu (GDD §9, §13.4 "Tablo"): aynı istek → aynı model (köşe
 * karması), köşe bütçesi, teknik ve nadirlik kuralları. Node'da tuval yok:
 * model ve plan saf olduğundan doğrudan sınanır.
 */
import { describe, expect, it } from 'vitest';
import type { TabloIstegi } from '../app/sozlesme';
import { EbruModeli, SINIR_SADE, SINIR_TAM } from './ebru';
import { ALAN, islemUygula, modelKur, tabloPlani } from './tablo';
import { ornekGunluk } from './dev/ornekGunluk';
import { tabloTohumu } from '../app/katalog';

const istek = (tohum: number, ayar: Parameters<typeof ornekGunluk>[1], ek: Partial<TabloIstegi> = {}): TabloIstegi => ({
  bolumId: 4,
  atolye: 'uskudar',
  tohum,
  gunluk: ornekGunluk(tohum ^ 0x55, ayar),
  w: 7,
  h: 9,
  yildiz: 2,
  ...ek,
});

describe('ebru modeli', () => {
  it('damla bırakma alanı korur: eski dairenin alanı değişmez', () => {
    const m = new EbruModeli();
    m.damla(100, 100, 30, '#ff0000', '#000');
    const alan = (k: Float32Array, n: number) => {
      let a = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        a += k[2 * i] * k[2 * j + 1] - k[2 * j] * k[2 * i + 1];
      }
      return Math.abs(a) / 2;
    };
    const once = alan(m.cokgenler[0].k, m.cokgenler[0].n);
    m.damla(170, 110, 25, '#00ff00', '#000');
    const sonra = alan(m.cokgenler[0].k, m.cokgenler[0].n);
    expect(Math.abs(sonra - once) / once).toBeLessThan(0.03);
    // Yeni damla eskinin içinde değil: eskinin hiçbir köşesi yeni dairenin içinde kalmaz.
    const k = m.cokgenler[0].k;
    for (let i = 0; i < m.cokgenler[0].n; i++) expect(Math.hypot(k[2 * i] - 170, k[2 * i + 1] - 110)).toBeGreaterThan(24.5);
  });

  it('yeniden örnekleme: kenarlar ≤ 6 px (çok parça sınırı içinde)', () => {
    const m = new EbruModeli();
    m.damla(200, 200, 40, '#123456', '#000');
    m.tarama(200, 200, 1, 0, 60, 12);
    const c = m.cokgenler[0];
    let enUzun = 0;
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n;
      enUzun = Math.max(enUzun, Math.hypot(c.k[2 * j] - c.k[2 * i], c.k[2 * j + 1] - c.k[2 * i + 1]));
    }
    expect(enUzun).toBeLessThanOrEqual(6.01);
  });
});

describe('tablo planı ve model', () => {
  it('aynı istek → aynı model (köşe karması); farklı tohum → farklı', () => {
    const a = istek(tabloTohumu(4, 0, 1800), { hamle: 16, tarak: 1, girdap: 1, kaskat: 1 });
    const k1 = modelKur(tabloPlani(a)).karma();
    const k2 = modelKur(tabloPlani(structuredClone(a))).karma();
    expect(k1).toBe(k2);
    const b = { ...a, tohum: a.tohum + 1 };
    expect(modelKur(tabloPlani(b)).karma()).not.toBe(k1);
  });

  it('parça parça uygulama (tabloCizParcali yolu) tam kurulumla aynı', () => {
    const plan = tabloPlani(istek(77, { hamle: 18, lale: true, murekkep: 2 }));
    const m = new EbruModeli(SINIR_TAM);
    for (const is of plan.islemler) islemUygula(m, is);
    expect(m.karma()).toBe(modelKur(plan).karma());
  });

  it('köşe bütçesi: tam ≤ 15 000 (+ son damlanın payı), sade ≤ 6 000 (+ pay)', () => {
    for (const t of [1, 2, 3]) {
      const plan = tabloPlani(istek(t * 101, { hamle: 26, tarak: 3, girdap: 2, kaskat: 2, lale: true, murekkep: 2, birlesim: true }));
      const tam = modelKur(plan);
      const sade = modelKur(plan, true);
      expect(tam.koseSayisi()).toBeLessThanOrEqual(SINIR_TAM.toplamMax * 1.15);
      expect(sade.koseSayisi()).toBeLessThanOrEqual(SINIR_SADE.toplamMax * 1.25);
      for (const c of tam.cokgenler) expect(c.n).toBeLessThanOrEqual(SINIR_TAM.cokgenMax + 64 * 8);
    }
  });

  it('teknikler günlükten: battal her zaman; gelgit k≥3; taraklı; şal = ikisi; bülbül yuvası; çiçek', () => {
    expect(tabloPlani(istek(5, { hamle: 10 })).teknikler).toEqual(['battal']);
    expect(tabloPlani(istek(5, { hamle: 12, kaskat: 1 })).teknikler).toEqual(['battal', 'gelgit']);
    expect(tabloPlani(istek(5, { hamle: 12, tarak: 1 })).teknikler).toEqual(['battal', 'tarakli']);
    expect(tabloPlani(istek(5, { hamle: 14, tarak: 1, kaskat: 1 })).teknikler).toEqual(['battal', 'gelgit', 'tarakli', 'sal']);
    expect(tabloPlani(istek(5, { hamle: 12, girdap: 1 })).teknikler).toContain('bulbulYuvasi');
    expect(tabloPlani(istek(5, { hamle: 12, lale: true })).teknikler).toContain('cicek');
    expect(tabloPlani(istek(5, { hamle: 12 }, { motif: 'karanfil' })).teknikler).toContain('cicek');
  });

  it('nadirlik (§9.4): Sade / Zarif (Lale, 3★, desen) / Şaheser (k≥5, Lale+Lale, 3★ + 3 teknik)', () => {
    expect(tabloPlani(istek(9, { hamle: 10 })).nadirlik).toBe(0);
    expect(tabloPlani(istek(9, { hamle: 10 }, { yildiz: 3 })).nadirlik).toBe(1);
    expect(tabloPlani(istek(9, { hamle: 10, lale: true })).nadirlik).toBeGreaterThanOrEqual(1);
    expect(tabloPlani(istek(9, { hamle: 10 }, { motif: 'lale' })).nadirlik).toBeGreaterThanOrEqual(1);
    expect(tabloPlani(istek(9, { hamle: 12, saheser: true })).nadirlik).toBe(2);
    expect(tabloPlani(istek(9, { hamle: 14, tarak: 1, kaskat: 1 }, { yildiz: 3 })).nadirlik).toBe(2);
  });

  it('künye: atölye · bölüm · baskın teknik', () => {
    expect(tabloPlani(istek(3, { hamle: 10 })).kunye).toBe('Üsküdar · Bölüm 4 · Battal ebru');
    expect(tabloPlani(istek(3, { hamle: 14, tarak: 1, kaskat: 1 }, { atolye: 'bursa', bolumId: 19 })).kunye).toBe('Bursa · Bölüm 19 · Şal ebru');
  });

  it('boş günlük de geçerli bir tablo üretir; bütün damlalar boyalı alana yakın', () => {
    const plan = tabloPlani({ bolumId: 1, atolye: 'uskudar', tohum: 1, gunluk: [], w: 5, h: 6, yildiz: 0 });
    const m = modelKur(plan);
    expect(m.cokgenler.length).toBeGreaterThan(50);
    for (const is of plan.islemler)
      if (is.t === 'damla') {
        expect(is.x).toBeGreaterThan(ALAN.x - 60);
        expect(is.x).toBeLessThan(ALAN.x + ALAN.w + 60);
      }
  });
});
