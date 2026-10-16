/**
 * Bölüm sonucunun şema 3 adımları (docs/KANCALAR.md §D.4): mühür birleşimi,
 * tanıtım, sancak, mahalle mühür parçaları (5/10/15, toz yedeği), Usta'nın
 * Eli'nde mühür yok, kandil kazanımı ve kasabanın açılışı.
 */
import { describe, expect, it } from 'vitest';
import { MUHUR_FITILLERI } from '../app/katalog';
import { bolumSonucu } from './ilerleme';
import type { Odul } from './ilerleme';
import { kandilBakiyesi } from './kasaba';
import { parcaId } from './kayit';
import type { Kayit } from './kayit';
import { TOZ_PARCA_BEDELI } from './sabitler';
import { bosIst, ilerlet, kazan, kaybet } from './_test/yardimci';

const tur = <T extends Odul['tur']>(o: readonly Odul[], t: T) => o.filter((x): x is Extract<Odul, { tur: T }> => x.tur === t);

const HEPSI = [true, true, true] as const;
const YOK = [false, false, false] as const;

describe('bölüm sonucu: mühürler (§D.4 2b)', () => {
  it('6. bölümün ilk kazancı mühürleri tanıtır (tutan yoksa da); maske kayda yazılır', () => {
    const k = ilerlet(5, 2);
    const r = kazan(k, 6, 2, { muhurler: YOK });
    expect(tur(r.oduller, 'muhur')).toEqual([{ tur: 'muhur', bolumId: 6, yeni: [], maske: 0, tanitim: true }]);
    expect(r.kayit.bolumler['6'].muhur).toBeUndefined();
    const r2 = kazan(k, 6, 2, { muhurler: [true, false, false] });
    expect(tur(r2.oduller, 'muhur')).toEqual([{ tur: 'muhur', bolumId: 6, yeni: ['cirak'], maske: 1, tanitim: true }]);
    expect(r2.kayit.bolumler['6'].muhur).toBe(1);
    // Sonraki bölümde tanıtım yok; maske birleşir.
    const r3 = kazan(r2.kayit, 7, 2, { muhurler: [true, true, false] });
    expect(tur(r3.oduller, 'muhur')[0]).toMatchObject({ yeni: ['cirak', 'kalfa'], maske: 3, tanitim: false });
  });

  it('üçü ayrı denemelerde toplanır; tamamlanınca bir kez sancak', () => {
    let k = ilerlet(7, 2);
    let r = kazan(k, 7, 2, { muhurler: [false, true, false] });
    expect(tur(r.oduller, 'sancak')).toEqual([]);
    k = r.kayit;
    r = kazan(k, 7, 2, { muhurler: [true, false, true] });
    expect(tur(r.oduller, 'muhur')[0]).toMatchObject({ yeni: ['cirak', 'usta'], maske: 7 });
    expect(tur(r.oduller, 'sancak')).toEqual([{ tur: 'sancak', bolumId: 7, mahalle: 1 }]);
    k = r.kayit;
    r = kazan(k, 7, 3, { muhurler: HEPSI });
    expect(tur(r.oduller, 'muhur')).toEqual([]);
    expect(tur(r.oduller, 'sancak')).toEqual([]);
  });

  it("Usta'nın Eli, kayıp, öğretim ve Usta Bölümü mühür basmaz", () => {
    const k = ilerlet(8, 2);
    expect(kazan(k, 8, 1, { muhurler: HEPSI, ist: { ustaEli: true } }).kayit.bolumler['8'].muhur).toBeUndefined();
    expect(kaybet(k, 8, { muhurler: HEPSI }).kayit.bolumler['8'].muhur).toBeUndefined();
    expect(kazan(k, 3, 2, { muhurler: HEPSI }).kayit.bolumler['3'].muhur).toBeUndefined();
    const u = bolumSonucu(k, { bolumId: 101, kazandi: true, puan: 1000, yildiz: 1, istatistik: bosIst(), muhurler: HEPSI });
    expect(u.kayit.bolumler['101']?.muhur).toBeUndefined();
    expect(tur(u.oduller, 'muhur')).toEqual([]);
  });

  it('ödül sırası: yıldız → mühür → sancak → mühür parçası … kandil (sonda)', () => {
    const k = ilerlet(9, 3);
    for (const id of [6, 7, 8]) k.bolumler[String(id)].muhur = 3; // 6 mühür, parça 5'te verilmemiş
    k.bolumler['9'].yildiz = 1;
    const r = kazan(k, 9, 3, { muhurler: HEPSI });
    const sira = r.oduller.map((o) => o.tur).filter((t) => ['yildiz', 'muhur', 'sancak', 'muhurParcasi', 'kandil'].includes(t));
    expect(sira).toEqual(['yildiz', 'muhur', 'sancak', 'muhurParcasi', 'kandil']);
    expect(r.oduller[r.oduller.length - 1].tur).toBe('kandil');
  });
});

describe('bölüm sonucu: mahalle mühür parçaları (§D.4 2c)', () => {
  const fitil = MUHUR_FITILLERI[1]!;
  function carsi(maskeler: number[]): Kayit {
    const k = ilerlet(10, 2);
    // Sandıktan gelmiş olabilecek parçalar silinir (sıradaki eksik parça belirli olsun).
    k.koleksiyon.parcalar = k.koleksiyon.parcalar.filter((p) => !p.startsWith(`f:${fitil}:`));
    maskeler.forEach((m, i) => {
      if (m) k.bolumler[String(6 + i)].muhur = m;
    });
    return k;
  }

  it('5., 10. ve 15. mühürde sıradaki eksik fitil parçası; basamak bir kez', () => {
    // 4 mühür + bu kazançta 1 → 5
    let r = kazan(carsi([3, 3, 0, 0, 0]), 10, 2, { muhurler: [true, false, false] });
    expect(tur(r.oduller, 'muhurParcasi')).toEqual([{ tur: 'muhurParcasi', mahalle: 1, esik: 5, fitil, parca: parcaId('fitil', fitil, 0), toz: 0 }]);
    expect(r.kayit.muhurOdulleri).toEqual(['carsi:5']);
    expect(r.kayit.koleksiyon.parcalar).toContain(parcaId('fitil', fitil, 0));
    // Tekrar kazanç (yeni mühür yok): basamak yeniden verilmez.
    r = kazan(r.kayit, 10, 2, { muhurler: [true, false, false] });
    expect(tur(r.oduller, 'muhurParcasi')).toEqual([]);
    // 15/15: 10 ve 15 birlikte (iki parça).
    const k = r.kayit;
    for (let id = 6; id <= 9; id++) k.bolumler[String(id)].muhur = 7;
    r = kazan(k, 10, 2, { muhurler: HEPSI });
    expect(tur(r.oduller, 'muhurParcasi').map((o) => [o.esik, o.parca])).toEqual([
      [10, parcaId('fitil', fitil, 1)],
      [15, parcaId('fitil', fitil, 2)],
    ]);
    expect(r.kayit.muhurOdulleri).toEqual(['carsi:5', 'carsi:10', 'carsi:15']);
  });

  it('parçaların hepsi varsa toz verilir', () => {
    const k = carsi([3, 3, 0, 0, 0]);
    for (let i = 0; i < 3; i++) k.koleksiyon.parcalar.push(parcaId('fitil', fitil, i));
    const toz = k.toz;
    const r = kazan(k, 10, 2, { muhurler: [true, false, false] });
    expect(tur(r.oduller, 'muhurParcasi')).toEqual([{ tur: 'muhurParcasi', mahalle: 1, esik: 5, fitil, parca: null, toz: TOZ_PARCA_BEDELI }]);
    expect(r.kayit.toz).toBe(toz + TOZ_PARCA_BEDELI);
  });

  it('birleştirmeyle gelen mühürler sonraki kazançta sayılır (kendini onarır)', () => {
    const k = carsi([7, 0, 0, 0, 0]);
    k.bolumler['7'].muhur = 3; // 5 mühür, ödül yok
    const r = kazan(k, 8, 2, { muhurler: YOK });
    expect(tur(r.oduller, 'muhurParcasi').map((o) => o.esik)).toEqual([5]);
  });
});

describe('bölüm sonucu: kandil ve kasaba (§D.4 11)', () => {
  it('1–2. bölümde kandil ödülü yok; 3. bölüm kasabayı açar', () => {
    let k = ilerlet(2, 2);
    expect(tur(kazan(ilerlet(1, 2), 2, 2).oduller, 'kandil')).toEqual([]);
    const r = kazan(k, 3, 3);
    expect(tur(r.oduller, 'kandil')).toEqual([{ tur: 'kandil', onceki: 4, yeni: 7, kaynak: { yildiz: 3, muhur: 0, mahalle: 0, gunluk: 0 } }]);
    expect(tur(r.oduller, 'kasabaAcildi')).toEqual([{ tur: 'kasabaAcildi', kandil: 7 }]);
    expect(r.oduller.slice(-2).map((o) => o.tur)).toEqual(['kandil', 'kasabaAcildi']);
    k = r.kayit;
    // Aynı yıldızla tekrar: kandil yok (kasılamaz).
    expect(tur(kazan(k, 3, 3).oduller, 'kandil')).toEqual([]);
    // Yıldız artışı: +1.
    const r2 = kazan(k, 2, 3);
    expect(tur(r2.oduller, 'kandil')[0]).toMatchObject({ onceki: 7, yeni: 8, kaynak: { yildiz: 1 } });
    expect(tur(r2.oduller, 'kasabaAcildi')).toEqual([]);
  });

  it('mühür ve mahalle tamamlama kandil verir', () => {
    const k = ilerlet(9, 2);
    const once = kandilBakiyesi(k);
    const r = kazan(k, 10, 2, { muhurler: [true, true, false] });
    // 2 yıldız + 2 mühür + Çarşı tamam (3)
    expect(tur(r.oduller, 'kandil')[0]).toMatchObject({ onceki: once, yeni: once + 7, kaynak: { yildiz: 2, muhur: 2, mahalle: 3, gunluk: 0 } });
  });
});
