/** Hava olayları (§5): Meltem tavanı, Çisenti, uyarı, döngüsel hatlar; soğuma (K21); Körük (§6.10). */
import { describe, expect, it } from 'vitest';
import { hamleUygula } from './hamle';
import { fitil, icerik, kur, patlamaZamani, sec } from './testAraclari';
import type { HavaOlayiVerisi } from './types';

const tahta = ['A0 Z G R', 'Z2 A Z R', 'G3 Z A R'];
const zincir = fitil([3, 0], [3, 1], [3, 2]);
const hava = (o: Partial<HavaOlayiVerisi>): HavaOlayiVerisi => ({ tur: 'meltem', eksen: 'sutun', hatlar: [0], periyot: 3, baslangic: 1, ...o });

describe('Meltem ve Çisenti', () => {
  it('Meltem: +1 ama en fazla eşik−1; tutuşturmaz', () => {
    const d = kur(tahta, { havaOlaylari: [hava({})] });
    const r = hamleUygula(d, zincir);
    expect(sec(r.olaylar, 'havaOlayi')).toEqual([{ t: 549, tur: 'havaOlayi', olay: 'meltem', eksen: 'sutun', hat: 0, uyari: false }]);
    expect(sec(r.olaylar, 'isiDegisti').map((o) => [o.hucre.x, o.hucre.y, o.isi])).toEqual([
      [0, 0, 1],
      [0, 1, 3],
    ]);
    expect(icerik(r.durum, 0, 2)).toMatchObject({ isi: 3 });
    expect(sec(r.olaylar, 'patlama')).toHaveLength(3);
    expect(r.durum.havaOlaylari[0]).toMatchObject({ sayac: 3, sira: 0 });
  });

  it('Meltem kalkanı dikkate alır (hamle başı kovaya dik komşu)', () => {
    const d = kur(['A0 S G R', 'Z2 A Z R', 'G3 Z A R'], { havaOlaylari: [hava({})] });
    const r = hamleUygula(d, zincir);
    expect(sec(r.olaylar, 'isiDegisti').map((o) => [o.hucre.x, o.hucre.y])).toEqual([[0, 1]]);
  });

  it('Çisenti: hattaki bütün kapsüllerin ısısı 0', () => {
    const d = kur(tahta, { havaOlaylari: [hava({ tur: 'cisenti' })] });
    const r = hamleUygula(d, zincir);
    expect(sec(r.olaylar, 'isiDegisti').map((o) => [o.hucre.x, o.hucre.y, o.isi])).toEqual([
      [0, 1, 0],
      [0, 2, 0],
    ]);
  });

  it('sayaç 1 olduğunda sıradaki hat için uyarı; hatlar döngüsel; satır ekseni', () => {
    const d = kur(['A Z G R', 'Z A Z R', 'G Z A R'], { havaOlaylari: [hava({ eksen: 'satir', hatlar: [2, 0], periyot: 2, baslangic: 2 })] });
    const r1 = hamleUygula(d, zincir);
    expect(sec(r1.olaylar, 'havaOlayi')).toEqual([expect.objectContaining({ uyari: true, hat: 2, olay: 'meltem', eksen: 'satir' })]);
    expect(r1.durum.havaOlaylari[0].sayac).toBe(1);
    const r2 = hamleUygula(r1.durum, fitil([3, 0], [3, 1], [3, 2]));
    const h2 = sec(r2.olaylar, 'havaOlayi');
    expect(h2.map((o) => [o.hat, o.uyari])).toEqual([[2, false]]);
    expect(r2.durum.havaOlaylari[0]).toMatchObject({ sayac: 2, sira: 1 });
  });

  it('soğuma: her k hamlede bir bütün ısılar −1', () => {
    const d = kur(tahta, { kurallar: { soguma: 1 } });
    const r = hamleUygula(d, zincir);
    expect(icerik(r.durum, 0, 1)).toMatchObject({ isi: 1 });
    expect(icerik(r.durum, 0, 2)).toMatchObject({ isi: 2 });
    expect(sec(r.olaylar, 'isiDegisti').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Körük (§6.10)', () => {
  const korukTahta = ['A3 Z G', 'Z A2 Z', 'G Z A3', 'R R R'];

  it('dolu körük: Chebyshev ≤ 1 ısınabilir kapsüllere t = 0 +1; eşiktekiler t = 90\'da 1. nesil; hamle harcanmaz', () => {
    const d = kur(korukTahta, { korukKapasitesi: 2, havaOlaylari: [hava({ baslangic: 1 })] });
    d.korukDolum = 2;
    const r = hamleUygula(d, { tur: 'koruk', merkez: { x: 1, y: 1 } });
    expect(r.olaylar[0]).toEqual({ t: 0, tur: 'korukKullanildi', merkez: { x: 1, y: 1 } });
    expect(sec(r.olaylar, 'isindi').filter((o) => o.t === 0)).toHaveLength(9);
    const p = sec(r.olaylar, 'patlama');
    expect(p.map((o) => [o.hucre.x, o.hucre.y, o.t, o.nesil, o.neden])).toEqual([
      [0, 0, 90, 1, 'isi'],
      [2, 2, 90, 1, 'isi'],
    ]);
    expect(r.durum.kalanHamle).toBe(d.kalanHamle);
    expect(r.durum.istatistik.korukKullanim).toBe(1);
    // Bu eylemin ISI patlamaları körüğü yeniden doldurur.
    expect(sec(r.olaylar, 'korukDoldu')).toEqual([expect.objectContaining({ dolum: 2, kapasite: 2 })]);
    // Körükte hava ve is adımları uygulanmaz.
    expect(sec(r.olaylar, 'havaOlayi')).toHaveLength(0);
    expect(r.durum.havaOlaylari[0].sayac).toBe(1);
  });

  it('körük kalkanı dikkate alır', () => {
    const d = kur(['A3 S G', 'Z A2 Z', 'G Z A3', 'R R R'], { korukKapasitesi: 1 });
    d.korukDolum = 1;
    const r = hamleUygula(d, { tur: 'koruk', merkez: { x: 1, y: 1 } });
    expect(patlamaZamani(r.olaylar)['0,0']).toBeUndefined();
    expect(patlamaZamani(r.olaylar)['2,2']).toBe(90);
  });

  it('ISI patlamaları körüğü doldurur (kapasitede durur); dolu değilse ya da kapalıysa kullanılamaz', () => {
    const d = kur(['A3 Z A3', 'R R R', 'G Z G'], { korukKapasitesi: 1 });
    expect(() => hamleUygula(d, { tur: 'koruk', merkez: { x: 1, y: 1 } })).toThrow(/korukDoluDegil/);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(r.durum.korukDolum).toBe(1);
    expect(sec(r.olaylar, 'korukDoldu')).toEqual([expect.objectContaining({ dolum: 1, kapasite: 1 })]);
    const kapali = kur(['A3 Z A3', 'R R R', 'G Z G']);
    expect(() => hamleUygula(kapali, { tur: 'koruk', merkez: { x: 1, y: 1 } })).toThrow(/korukKapali/);
    expect(hamleUygula(kapali, fitil([0, 1], [1, 1], [2, 1])).durum.korukDolum).toBe(0);
  });
});
