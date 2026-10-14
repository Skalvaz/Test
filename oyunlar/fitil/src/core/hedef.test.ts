/** Hedefler (§6), puanlama (§7.1–§7.2), yıldızlar (§7.4), reaksiyon olayı, bölüm sonu. */
import { describe, expect, it } from 'vitest';
import { hamleUygula } from './hamle';
import { ilerlemeYuzdesi } from './index';
import { patlamaPuani, reaksiyonKademesi, yildizHesapla } from './puan';
import { fitil, kur, sec } from './testAraclari';

describe('hedef ilerleme sayımı (§6)', () => {
  it('topla: renk eşleşmesi; yıldız topu yalnız "hepsi"; dönüşüm sayılmaz', () => {
    const d = kur(['R R * R R R G', 'A Z A Z A Z A'], {
      hedefler: [
        { tur: 'topla', renk: 'hepsi', adet: 50 },
        { tur: 'topla', renk: 0, adet: 50 },
        { tur: 'topla', renk: 1, adet: 50 },
      ],
    });
    const r = hamleUygula(d, fitil([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]));
    // 6 düğüm: 5 patlar (2 R + yıldız + 2 R), son düğüm rokete döner. Yıldız R'leri vurur (planlı olmayan yok).
    expect(r.durum.hedefler.map((h) => h.ilerleme)).toEqual([5, 4, 0]);
  });

  it('hedef tamamlanınca tamam; ilerleme gerekli ile sınırlı; hepsi tamamsa kazanç', () => {
    const d = kur(['A G A Z', 'R R R Z', 'G A G Z'], { hedefler: [{ tur: 'topla', renk: 0, adet: 2 }] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 2, gerekli: 2, tamam: true });
    expect(r.durum.bitti).toBe('kazanc');
    expect(sec(r.olaylar, 'bolumBitti')).toEqual([expect.objectContaining({ sonuc: 'kazanc' })]);
    expect(sec(r.olaylar, 'hedefIlerledi').map((o) => [o.deger, o.tamam])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(() => hamleUygula(r.durum, fitil([0, 1], [1, 1], [2, 1]))).toThrow(/bitti/);
  });

  it('kalan hamle 0 ve hedef eksikse kayıp; karıştırma yapılmaz', () => {
    const d = kur(['A G A Z', 'R R R Z', 'G A G Z'], { hamle: 1 });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(r.durum.bitti).toBe('kayip');
    expect(sec(r.olaylar, 'bolumBitti')).toEqual([expect.objectContaining({ sonuc: 'kayip' })]);
  });

  it('zincirleme: R = fitil düğümü olmayan kapsül patlamaları ≥ eşik', () => {
    const d = kur(['A G3 A', 'G A3 G', 'R R R', 'Z A Z'], { hedefler: [{ tur: 'zincirleme', esik: 2, adet: 2 }] });
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
    const d3 = kur(['A G3 A', 'G A3 G', 'R R R', 'Z A Z'], { hedefler: [{ tur: 'zincirleme', esik: 3, adet: 1 }] });
    expect(hamleUygula(d3, fitil([0, 2], [1, 2], [2, 2])).durum.hedefler[0].ilerleme).toBe(0);
  });

  it('desen: desen renginde ya da yıldız topu patlayınca boyanır (+40)', () => {
    const d = kur(['A G A Z', 'R R * Z', 'G A G Z'], {
      zemin: { desen: { motif: 'lale', hucreler: [[0, 1, 0], [1, 1, 2], [2, 1, 3]] } },
      hedefler: [{ tur: 'desen', motif: 'lale' }],
    });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'desenBoyandi').map((o) => [o.hucre.x, o.renk])).toEqual([
      [0, 0],
      [2, 3],
    ]);
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 2, gerekli: 3 });
    expect(r.durum.hucreler[1 * 4 + 1].desenBoyali).toBe(false);
  });

  it('aydınlat: döşeme katı başına −1 (+20); kat toplamı', () => {
    const d = kur(['A G A Z', 'R R R Z', 'G A G Z'], { zemin: { dosemeler: [[0, 1, 2], [1, 1, 1]] }, hedefler: [{ tur: 'aydinlat' }] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'dosemeAydinlandi').map((o) => [o.hucre.x, o.kalan])).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 2, gerekli: 3 });
    expect(r.durum.puan).toBe(60 + 40);
  });

  it('puan hedefi ve ilerleme yüzdesi', () => {
    const d = kur(['A G A Z', 'R R R Z', 'G A G Z'], { hedefler: [{ tur: 'puan', puan: 120 }] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 60, gerekli: 120 });
    expect(ilerlemeYuzdesi(r.durum)).toBe(0.5);
  });
});

describe('puanlama (§7)', () => {
  it('taban puanlar', () => {
    expect(patlamaPuani('fitil', 0, 6)).toBe(60);
    expect(patlamaPuani('isi', 3, 0)).toBe(60);
    for (const n of ['vurus', 'iz', 'devFisek', 'final', 'kibrit'] as const) expect(patlamaPuani(n, 2, 0)).toBe(15);
  });

  it('reaksiyon bonusu: yalnız en yüksek kademe', () => {
    expect(reaksiyonKademesi(7)).toBeNull();
    expect(reaksiyonKademesi(8)).toEqual({ kademe: 'guzel', bonus: 100 });
    expect(reaksiyonKademesi(14)).toEqual({ kademe: 'guzel', bonus: 100 });
    expect(reaksiyonKademesi(15)).toEqual({ kademe: 'harika', bonus: 300 });
    expect(reaksiyonKademesi(25)).toEqual({ kademe: 'muhtesem', bonus: 600 });
    expect(reaksiyonKademesi(40)).toEqual({ kademe: 'senlik', bonus: 1200 });
    expect(reaksiyonKademesi(99)).toEqual({ kademe: 'senlik', bonus: 1200 });
  });

  it('R = 14 → "güzel" +100; reaksiyon olayı boyut, kademe, zirve', () => {
    const d = kur(['G3 G3 G3 G3 G3 G3 G3', 'A3 A3 A3 A3 A3 A3 A3', 'R R R R R R R', 'Z A Z A Z A Z'], { ozelEsikleri: [0, 0, 0] });
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]));
    const reak = sec(r.olaylar, 'reaksiyon');
    expect(reak).toHaveLength(1);
    expect(reak[0]).toMatchObject({ boyut: 14, kademe: 'guzel', kombo: false });
    expect(sec(r.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ neden: 'reaksiyon', miktar: 100, kademe: 'guzel' }));
    // Puan: düğümler 5·7·8 = 280; ısı patlamaları 20·nesil (A sırası yatayda da
    // birbirini ısıtır, nesil yükselir); bonus 100.
    const p = sec(r.olaylar, 'patlama');
    expect(p.filter((o) => o.neden === 'fitil').reduce((s, o) => s + o.puan, 0)).toBe(280);
    for (const o of p.filter((o) => o.neden === 'isi')) expect(o.puan).toBe(20 * o.nesil);
    expect(r.durum.puan).toBe(p.reduce((s, o) => s + o.puan, 0) + 100);
    expect(r.durum.istatistik.enBuyukReaksiyon).toBe(14);
    expect(r.durum.istatistik.reaksiyonlar).toEqual([14]);
    expect(r.durum.istatistik.toplamPatlama).toBe(21);
    expect(r.durum.istatistik.enUzunZincir).toBe(7);
    expect(reak[0].zirveT % 90).toBe(45);
  });

  it('puan tutarlılığı: Δpuan = Σ patlama.puan + Σ puanEklendi', () => {
    const d = kur(['K1 cG I A', 'R R R wZ', 'A Z A G'], { zemin: { dosemeler: [[0, 1, 1]] } });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    const toplam = sec(r.olaylar, 'patlama').reduce((s, o) => s + o.puan, 0) + sec(r.olaylar, 'puanEklendi').reduce((s, o) => s + o.miktar, 0);
    expect(r.durum.puan - d.puan).toBe(toplam);
  });
});

describe('yıldızlar (§7.4)', () => {
  const kazan = () => {
    const d = kur(['A G A Z', 'R R R Z', 'G A G Z'], { hedefler: [{ tur: 'topla', renk: 0, adet: 3 }] });
    return hamleUygula(d, fitil([0, 1], [1, 1], [2, 1])).durum;
  };

  it('1★ hedefler; 2★ ≥ p50; 3★ ≥ p85; kaybedince 0', () => {
    const d = kazan();
    expect(d.puan).toBe(60);
    expect(yildizHesapla(d, { yildizEsikleri: [100, 200] })).toBe(1);
    expect(yildizHesapla(d, { yildizEsikleri: [60, 200] })).toBe(2);
    expect(yildizHesapla(d, { yildizEsikleri: [50, 60] })).toBe(3);
    expect(yildizHesapla({ ...d, bitti: 'kayip' }, { yildizEsikleri: [0, 0] })).toBe(0);
  });

  it('güçlendirici → en fazla 2★; Kıvılcım Usta\'nın Eli → en fazla 1★', () => {
    const d = kazan();
    expect(yildizHesapla({ ...d, istatistik: { ...d.istatistik, guclendirici: 1 } }, { yildizEsikleri: [0, 0] })).toBe(2);
    expect(yildizHesapla({ ...d, istatistik: { ...d.istatistik, ustaEli: true } }, { yildizEsikleri: [0, 0] })).toBe(1);
  });
});
