/**
 * Günün Şenliği (§10.5) ve Sonsuz Şenlik (§10.7) üreticisi: belirlenimlilik,
 * parametre aralıkları, yalnız 1–15. bölüm öğeleri, zaman dilimli sürüm.
 */
import { describe, expect, it } from 'vitest';
import type { BolumVerisi } from '../core/types';
import { bolumDogrula } from './dogrulayici';
import { GUNLUK_ZORLUK, adayBolum, gunlukBolum, gunlukUret, sonsuzBolum, sonsuzZorluk, tarihTohumu, zamanDilimli } from './uretici';

const IZINLI_SIMGE = new Set(['.', 'C', 'W', 'K1', 'K2', 'K3']);

function gunlukKurallari(v: BolumVerisi): void {
  expect(v.tur).toBe('gunluk');
  expect(v.w).toBe(7);
  expect([8, 9]).toContain(v.h);
  expect(v.renkSayisi).toBe(5);
  expect(v.esik).toBe(4);
  expect(v.hamle).toBeGreaterThanOrEqual(20);
  expect(v.hamle).toBeLessThanOrEqual(25);
  expect(v.yardim).toBe(0);
  expect(v.hedefler.length).toBeGreaterThanOrEqual(1);
  expect(v.hedefler.length).toBeLessThanOrEqual(2);
  for (const h of v.hedefler) expect(['topla', 'kafes', 'aydinlat', 'kaya']).toContain(h.tur);
  for (const s of v.duzen.join(' ').split(/\s+/)) expect(IZINLI_SIMGE.has(s), s).toBe(true);
  for (const [, , kat] of v.zemin?.dosemeler ?? []) expect(kat).toBe(1);
  expect(v.zemin?.desen).toBeUndefined();
  expect(v.zemin?.barutIzleri).toBeUndefined();
  expect(v.korukKapasitesi ?? 0).toBe(0);
  expect(v.havaOlaylari).toBeUndefined();
  expect(bolumDogrula(v)).toEqual([]);
  expect(v.yildizEsikleri[0]).toBeLessThanOrEqual(v.yildizEsikleri[1]);
}

describe('Günün Şenliği (§10.5)', () => {
  it('tarih tohumu yyyymmdd', () => {
    expect(tarihTohumu(2026, 10, 14)).toBe(20261014);
  });

  it('aynı tarih aynı bölüm (bot süzmesi dahil), kurallara uygun', { timeout: 120_000 }, () => {
    const a = gunlukBolum(20261014);
    const b = gunlukBolum(20261014);
    expect(b).toEqual(a);
    expect(a.id).toBe(20261014);
    gunlukKurallari(a);
  });

  it('ardışık günler farklı bölüm', { timeout: 120_000 }, () => {
    const a = gunlukBolum(20261014);
    const b = gunlukBolum(20261015);
    expect(b.duzen.join('|') + JSON.stringify(b.hedefler) + b.tohum).not.toBe(a.duzen.join('|') + JSON.stringify(a.hedefler) + a.tohum);
  });

  it('aday bölümler belirlenimli ve çoğu statik olarak geçerli', () => {
    let gecerli = 0;
    for (let k = 0; k < 60; k++) {
      const v = adayBolum(1000 + k, 20261014, 'gunluk', GUNLUK_ZORLUK);
      expect(adayBolum(1000 + k, 20261014, 'gunluk', GUNLUK_ZORLUK)).toEqual(v);
      if (bolumDogrula(v).length === 0) gecerli++;
    }
    expect(gecerli).toBeGreaterThanOrEqual(50);
  });

  it('zaman dilimli çalıştırma aynı bölümü verir ve sırayı bırakır', { timeout: 120_000 }, async () => {
    let saat = 0;
    let bekleme = 0;
    const v = await zamanDilimli(gunlukUret(20261014), {
      simdi: () => (saat += 1),
      bekle: async () => {
        bekleme++;
      },
      butceMs: 50,
    });
    expect(bekleme).toBeGreaterThan(1);
    expect(v).toEqual(gunlukBolum(20261014));
  });
});

describe('Sonsuz Şenlik (§10.7)', () => {
  it('aynı n aynı bölüm; id ve tohum 1 000 000 + n', { timeout: 120_000 }, () => {
    const a = sonsuzBolum(3, { kosu: 6, adaySayisi: 10 });
    expect(sonsuzBolum(3, { kosu: 6, adaySayisi: 10 })).toEqual(a);
    expect(a.id).toBe(1_000_003);
    expect(a.tur).toBe('sonsuz');
    expect(bolumDogrula(a)).toEqual([]);
  });

  it('zorluk n ile artar: hamle, renk, kat, bant (§10.7)', () => {
    expect(sonsuzZorluk(1).renk).toBe(5);
    expect(sonsuzZorluk(25).renk).toBe(6);
    expect(sonsuzZorluk(35).hamleUst).toBeLessThan(sonsuzZorluk(5).hamleUst);
    expect(sonsuzZorluk(15).dosemeKat2).toBe(true);
    expect(sonsuzZorluk(40).bant[0]).toBeLessThan(sonsuzZorluk(1).bant[0]);
    expect(sonsuzZorluk(500).hamleAlt).toBeGreaterThanOrEqual(16);
    const l = Array.from({ length: 12 }, (_, k) => adayBolum(5000 + k, 1_000_025, 'sonsuz', sonsuzZorluk(25)));
    expect(l.every((v) => v.renkSayisi === 6 && v.hamle <= sonsuzZorluk(25).hamleUst)).toBe(true);
  });
});
