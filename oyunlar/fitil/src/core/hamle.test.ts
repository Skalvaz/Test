/** hamleUygula sözleşmesi: doğrulama, saflık, hamle maliyetleri, güçlendiriciler (§3.1, §9, §16.2). */
import { describe, expect, it } from 'vitest';
import { hamleHatasi, hamleUygula, ustaEliUygula } from './hamle';
import { durumKarmasi, yildizHesapla, yolDogrula, zincirRengi } from './index';
import { derinDondur, desen, fitil, halka, icerik, kur, sec, yol } from './testAraclari';

describe('yol doğrulama (§3.3)', () => {
  const d = kur(['R R * G', 'A R Z G', 'R A Z G']);

  it('8-komşu, en az 3, tekrar yok, renk', () => {
    expect(yolDogrula(d, yol([0, 0], [1, 0], [1, 1]), false)).toBeNull();
    expect(yolDogrula(d, yol([0, 0], [1, 1], [0, 2]), false)).toBeNull(); // çapraz
    expect(yolDogrula(d, yol([0, 0], [1, 0]), false)).toBe('kisa');
    expect(yolDogrula(d, yol([0, 0], [1, 0], [0, 0]), false)).toBe('tekrar');
    expect(yolDogrula(d, yol([0, 0], [1, 1], [2, 1]), false)).toBe('renk');
    expect(yolDogrula(d, yol([0, 0], [1, 0], [0, 2]), false)).toBe('komsu');
    expect(yolDogrula(d, yol([0, 0], [1, 0], [5, 0]), false)).toBe('zincirlenemez');
  });

  it('joker zincir rengi: ilk joker olmayan; hepsi joker → −1', () => {
    expect(zincirRengi(d, yol([2, 0], [1, 0], [1, 1]))).toBe(0);
    expect(yolDogrula(d, yol([2, 0], [1, 0], [1, 1]), false)).toBeNull();
    expect(yolDogrula(d, yol([1, 1], [2, 0], [3, 1]), false)).toBe('renk');
    expect(zincirRengi(kur(['* * * A', 'R G Z A']), yol([0, 0], [1, 0], [2, 0]))).toBe(-1);
  });

  it('halka |P| ≥ 4 ve son düğüm ilke komşu; dortKomsu; caprazSiniri; yalnizHalka', () => {
    const h = kur(['R R A', 'R R Z', 'A Z G']);
    expect(yolDogrula(h, yol([0, 0], [1, 0], [1, 1], [0, 1]), true)).toBeNull();
    expect(yolDogrula(h, yol([0, 0], [1, 0], [1, 1]), true)).toBe('komsu');
    const dk = kur(['R A A', 'A R Z', 'A Z R', 'R R R'], { kurallar: { dortKomsu: true } });
    expect(yolDogrula(dk, yol([0, 0], [1, 1], [2, 2]), false)).toBe('komsu');
    const cs = kur(['R A A', 'A R Z', 'A Z R', 'R R R'], { kurallar: { caprazSiniri: 1 } });
    expect(yolDogrula(cs, yol([0, 0], [1, 1], [2, 2]), false)).toBe('capraz');
    const yh = kur(['R R A', 'R R Z', 'A Z G'], { kurallar: { yalnizHalka: true } });
    expect(yolDogrula(yh, yol([0, 0], [1, 0], [1, 1]), false)).toBe('halkaGerekli');
  });
});

describe('hamleUygula doğrulama ve saflık', () => {
  it('girdiyi değiştirmez (Object.freeze)', () => {
    const d = derinDondur(kur(['A A3 A', 'R R R', 'G G G', 'Z Z Z'], { korukKapasitesi: 1 }));
    const karma = durumKarmasi(d);
    const r = hamleUygula(d, derinDondur(fitil([0, 1], [1, 1], [2, 1])));
    expect(durumKarmasi(d)).toBe(karma);
    expect(r.durum).not.toBe(d);
    expect(Object.isFrozen(r.durum)).toBe(false);
  });

  it('geçersiz hamle hata fırlatır', () => {
    const d = kur(['A Rr0 A', 'R R R', 'G cGk G']);
    expect(() => hamleUygula(d, fitil([0, 1], [1, 1]))).toThrow(/kisa/);
    expect(hamleHatasi(d, { tur: 'ciftDokunus', hucre: { x: 0, y: 0 } })).toBe('ozelDegil');
    expect(hamleHatasi(d, { tur: 'ciftDokunus', hucre: { x: 1, y: 2 } })).toBe('ozelDegil'); // kafesli
    expect(hamleHatasi(d, { tur: 'ciftDokunus', hucre: { x: 9, y: 0 } })).toBe('konum');
    expect(hamleHatasi(d, { tur: 'kalip', hucre: { x: 1, y: 0 }, eksen: 0 })).toBe('duzKapsulDegil');
    expect(hamleHatasi(d, { tur: 'kalip', hucre: { x: 1, y: 2 }, eksen: 0 })).toBe('duzKapsulDegil');
    expect(hamleHatasi(d, { tur: 'kibrit', hucre: { x: 0, y: 9 } })).toBe('konum');
    expect(hamleHatasi(d, { tur: 'koruk', merkez: { x: 0, y: 0 } })).toBe('korukKapali');
    expect(hamleHatasi(d, { tur: 'ciftDokunus', hucre: { x: 1, y: 0 } })).toBeNull();
    const delikli = kur(['A # A', 'R R R']);
    expect(hamleHatasi(delikli, { tur: 'kibrit', hucre: { x: 1, y: 0 } })).toBe('konum');
  });

  it('maliyetler: fitil ve çift dokunuş 1 hamle; körük, kibrit, kalıp 0', () => {
    const d = kur(['A Rr0 A G', 'R R R Z', 'G Z G A']);
    expect(hamleUygula(d, fitil([0, 1], [1, 1], [2, 1])).durum.kalanHamle).toBe(29);
    expect(hamleUygula(d, { tur: 'ciftDokunus', hucre: { x: 1, y: 0 } }).durum.kalanHamle).toBe(29);
    expect(hamleUygula(d, { tur: 'kibrit', hucre: { x: 0, y: 0 } }).durum.kalanHamle).toBe(30);
    expect(hamleUygula(d, { tur: 'kalip', hucre: { x: 0, y: 0 }, eksen: 2 }).durum.kalanHamle).toBe(30);
  });

  it('kalıp: düz kapsül rokete döner (ısı korunur), ateşlemez; güçlendirici sayılır', () => {
    const d = kur(['A2 Z A G', 'R R R Z', 'G Z G A']);
    const r = hamleUygula(d, { tur: 'kalip', hucre: { x: 0, y: 0 }, eksen: 3 });
    expect(icerik(r.durum, 0, 0)).toEqual({ tur: 'kapsul', renk: 1, isi: 2, ozel: 'roket', eksen: 3 });
    expect(sec(r.olaylar, 'ozelOlustu')).toEqual([{ t: 0, tur: 'ozelOlustu', hucre: { x: 0, y: 0 }, ozel: 'roket', eksen: 3, renk: 1, isi: 2 }]);
    expect(sec(r.olaylar, 'patlama')).toHaveLength(0);
    expect(r.durum.istatistik.guclendirici).toBe(1);
    expect(r.durum.istatistik.roket).toBe(0);
    expect(() => hamleUygula(r.durum, { tur: 'kibrit', hucre: { x: 1, y: 0 } })).toThrow(/guclendiriciSiniri/);
  });

  it('her eylem tam bir reaksiyon olayıyla biter; kalıp R = 0', () => {
    const d = kur(['A2 Z A G', 'R R R Z', 'G Z G A']);
    const r = hamleUygula(d, { tur: 'kalip', hucre: { x: 0, y: 0 }, eksen: 3 });
    expect(r.olaylar[r.olaylar.length - 1]).toMatchObject({ tur: 'reaksiyon', boyut: 0, kademe: null, kombo: false });
  });

  it('çift dokunulan taş R\'ye girer (fitil düğümü değil); istatistik reaksiyonlar', () => {
    const d = kur(desen(5, 5, { '2,2': 'Rr0' }));
    const r = hamleUygula(d, { tur: 'ciftDokunus', hucre: { x: 2, y: 2 } });
    expect(sec(r.olaylar, 'reaksiyon')[0].boyut).toBe(5);
    expect(r.durum.istatistik.reaksiyonlar).toEqual([5]);
  });

  it('halka hamlesi geçerli ve halka hedefini sayar', () => {
    const d = kur(['R R A', 'R R Z', 'A Z G'], { kurallar: { yalnizHalka: true } });
    expect(() => hamleUygula(d, fitil([0, 0], [1, 0], [1, 1]))).toThrow(/halkaGerekli/);
    expect(hamleUygula(d, halka([0, 0], [1, 0], [1, 1], [0, 1])).durum.istatistik.halkaSayisi).toBe(1);
  });
});

describe('Kıvılcım Usta\'nın Eli (K16)', () => {
  it('kayıptan sonra +5 hamle, bitti sıfırlanır, en fazla 1★; denemede bir kez', () => {
    const d = kur(['A G A Z', 'R R R Z', 'G A G Z'], { hamle: 1, hedefler: [{ tur: 'topla', renk: 'hepsi', adet: 6 }] });
    const k = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(k.durum.bitti).toBe('kayip');
    expect(() => ustaEliUygula(d)).toThrow(/kaybedilmedi/);
    const u = ustaEliUygula(k.durum);
    expect(u.durum).toMatchObject({ kalanHamle: 5, bitti: null });
    expect(u.durum.istatistik.ustaEli).toBe(true);
    // Üst sıra dolumla M M M oldu.
    const son = hamleUygula(u.durum, fitil([0, 0], [1, 0], [2, 0]));
    expect(son.durum.bitti).toBe('kazanc');
    expect(yildizHesapla(son.durum, { yildizEsikleri: [0, 0] })).toBe(1);
  });
});
