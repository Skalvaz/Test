import { describe, expect, it } from 'vitest';
import {
  BolumHatasi,
  bolumuYukle,
  damla,
  durumKarmasi,
  gecerliHamleVar,
  gecerliHedefler,
  gruplariBul,
  hamleHatasi,
  ilerlemeYuzdesi,
  karisimSonucu,
  yildizHesapla,
} from './index';
import type { BolumVerisi, OyunDurumu } from './types';
import b001 from '../levels/veri/b001.json';

const b1 = b001 as unknown as BolumVerisi;

function hucreRengi(d: OyunDurumu, x: number, y: number): number | null {
  const dm = damla(d.hucreler[y * d.w + x]);
  return dm ? dm.renk : null;
}

describe('karisimSonucu (§3.3, K1)', () => {
  it('ham + ham = karışık (her iki yön)', () => {
    expect(karisimSonucu(1, 2, false)).toEqual({ sonuc: 3 });
    expect(karisimSonucu(2, 1, false)).toEqual({ sonuc: 3 });
    expect(karisimSonucu(1, 4, false)).toEqual({ sonuc: 5 });
    expect(karisimSonucu(4, 2, false)).toEqual({ sonuc: 6 });
  });
  it('geçersizler', () => {
    expect(karisimSonucu(1, 1, true)).toEqual({ hata: 'ayniRenk' });
    expect(karisimSonucu(3, 1, true)).toEqual({ hata: 'ortakBilesen' });
    expect(karisimSonucu(3, 5, true)).toEqual({ hata: 'karisikKarisik' });
    expect(karisimSonucu(7, 1, true)).toEqual({ hata: 'karismaz' });
  });
  it('Mürekkep yalnız kural açıkken', () => {
    expect(karisimSonucu(3, 4, false)).toEqual({ hata: 'murekkepKapali' });
    expect(karisimSonucu(3, 4, true)).toEqual({ sonuc: 7 });
    expect(karisimSonucu(2, 5, true)).toEqual({ sonuc: 7 });
    expect(karisimSonucu(6, 1, true)).toEqual({ sonuc: 7 });
  });
});

describe('bolumuYukle (P0 başvuru, §15.1)', () => {
  it('bölüm 1: boyut, sabit damlalar, hedef, kurallar', () => {
    const d = bolumuYukle(b1, 0);
    expect(d.w).toBe(5);
    expect(d.h).toBe(6);
    expect(d.hucreler).toHaveLength(30);
    expect(hucreRengi(d, 0, 5)).toBe(3);
    expect(hucreRengi(d, 1, 5)).toBe(3);
    expect(hucreRengi(d, 2, 5)).toBe(2);
    expect(hucreRengi(d, 3, 5)).toBe(1);
    expect(d.hedefler[0]).toMatchObject({ ilerleme: 0, gerekli: 10, tamam: false });
    expect(d.kurallar).toEqual({ murekkep: false, garanti: 3, ozelEsikleri: [4, 5, 6] });
    expect(d.kalanHamle).toBe(12);
    expect(ilerlemeYuzdesi(d)).toBe(0);
  });

  it('ilk tahta grupsuz, oynanabilir, yalnız izinli renkler', () => {
    const d = bolumuYukle(b1, 0);
    expect(gruplariBul(d)).toEqual([]);
    expect(gecerliHamleVar(d)).toBe(true);
    for (let i = 0; i < d.hucreler.length; i++) {
      const dm = damla(d.hucreler[i]);
      expect(dm).not.toBeNull();
      expect([1, 2, 3]).toContain(dm!.renk);
    }
  });

  it('kimlikler eşsiz, okuma sırasıyla; sonrakiId sonrası', () => {
    const d = bolumuYukle(b1, 0);
    const idler = d.hucreler.map((h) => damla(h)!.id);
    expect(idler).toEqual(idler.map((_, i) => i + 1));
    expect(d.sonrakiId).toBe(31);
  });

  it('ilk tahta denemeden bağımsız; oyun akışı tohumu farklı; belirlenimli', () => {
    const a = bolumuYukle(b1, 0);
    const b = bolumuYukle(b1, 1);
    expect(JSON.stringify(a.hucreler)).toBe(JSON.stringify(b.hucreler));
    expect(a.rng).not.toBe(b.rng);
    expect(durumKarmasi(a)).toBe(durumKarmasi(bolumuYukle(b1, 0)));
  });

  it('zorunlu ilk hamle geçerli ve bir Turuncu üçlüsü kurar', () => {
    const d = bolumuYukle(b1, 0);
    const h = { tur: 'surukle' as const, kaynak: { x: 3, y: 5 }, hedef: { x: 2, y: 5 } };
    expect(hamleHatasi(d, h)).toBeNull();
    expect(gecerliHedefler(d, { x: 3, y: 5 })).toContainEqual({ x: 2, y: 5 });
  });

  it('zemin, mermer, özel taş ve delik', () => {
    const v: BolumVerisi = {
      ...b1,
      id: 900,
      w: 4,
      h: 4,
      dogum: [20, 20, 20, 11, 11, 11],
      duzen: ['. . . .', '. X2 . .', '. . # .', '. . . .'],
      ozeller: [{ x: 0, y: 3, ozel: 'tarak', renk: 5, yon: 'dikey' }, { x: 3, y: 3, ozel: 'lale' }],
      zemin: { kagit: [[0, 0, 2], [1, 0, 1]], yag: [[3, 0]], desen: { motif: 'lale', hucreler: [[2, 3, 6]] } },
      hedefler: [{ tur: 'kagit' }, { tur: 'desen', motif: 'lale' }],
      zorunluIlkHamle: undefined,
    };
    const d = bolumuYukle(v, 0);
    expect(d.hucreler[1 * 4 + 1].icerik).toEqual({ tur: 'mermer', can: 2 });
    expect(d.hucreler[2 * 4 + 2].delik).toBe(true);
    expect(d.hucreler[2 * 4 + 2].icerik).toBeNull();
    expect(damla(d.hucreler[3 * 4 + 0])).toMatchObject({ ozel: 'tarak', renk: 5, yon: 'dikey' });
    expect(damla(d.hucreler[3 * 4 + 3])).toMatchObject({ ozel: 'lale', renk: 0 });
    expect(d.hucreler[0].kagit).toBe(2);
    expect(d.hucreler[3].yag).toBe(true);
    expect(d.hucreler[3 * 4 + 2].desen).toBe(6);
    expect(d.hedefler.map((h) => h.gerekli)).toEqual([3, 1]);
    // Yağlı hücredeki damla karışıma katılamaz.
    expect(hamleHatasi(d, { tur: 'surukle', kaynak: { x: 3, y: 0 }, hedef: { x: 2, y: 0 } })).toBe('yag');
    // Mermere sürüklenemez.
    expect(hamleHatasi(d, { tur: 'surukle', kaynak: { x: 1, y: 0 }, hedef: { x: 1, y: 1 } })).toBe('mermer');
    // Özel taşa dokunan sürükleme her zaman geçerli.
    expect(hamleHatasi(d, { tur: 'surukle', kaynak: { x: 0, y: 3 }, hedef: { x: 1, y: 3 } })).toBeNull();
    expect(hamleHatasi(d, { tur: 'surukle', kaynak: { x: 2, y: 3 }, hedef: { x: 3, y: 3 } })).toBeNull();
  });

  it('hatalı veri BolumHatasi fırlatır', () => {
    expect(() => bolumuYukle({ ...b1, duzen: b1.duzen.slice(1) }, 0)).toThrow(BolumHatasi);
    expect(() => bolumuYukle({ ...b1, duzen: [...b1.duzen.slice(0, 5), '3 3 3 1 .'] }, 0)).toThrow(/sabit damlalar/);
    expect(() => bolumuYukle({ ...b1, duzen: [...b1.duzen.slice(0, 5), '3 3 Q 1 .'] }, 0)).toThrow(/bilinmeyen simge/);
    expect(() => bolumuYukle({ ...b1, garanti: 4 }, 0)).toThrow(/garanti/);
    expect(() => bolumuYukle({ ...b1, zemin: { desen: { motif: 'lale', hucreler: [[0, 0, 1 as 3]] } } }, 0)).toThrow(/karışık/);
  });

  it('geçersiz hamle nedenleri (§3.3)', () => {
    const d = bolumuYukle(b1, 0);
    const s = (kx: number, ky: number, ex: number, ey: number) => hamleHatasi(d, { tur: 'surukle', kaynak: { x: kx, y: ky }, hedef: { x: ex, y: ey } });
    expect(s(0, 5, 2, 5)).toBe('komsuDegil');
    expect(s(0, 5, 1, 5)).toBe('ayniRenk');
    expect(s(1, 5, 2, 5)).toBe('ortakBilesen');
    expect(s(4, 5, 5, 5)).toBe('konum');
    expect(hamleHatasi({ ...d, kalanHamle: 0 }, { tur: 'surukle', kaynak: { x: 3, y: 5 }, hedef: { x: 2, y: 5 } })).toBe('hamleYok');
  });

  it('yıldız: hedef + eşikler; Usta Eli en fazla 1★', () => {
    const d = bolumuYukle(b1, 0);
    expect(yildizHesapla(d, b1)).toBe(0);
    // Eşikler bölüm verisinden (P2 kalibrasyonu değiştirebilir).
    const [y2, y3] = b1.yildizEsikleri;
    const k: OyunDurumu = { ...d, bitti: 'kazanc', puan: y3 };
    expect(yildizHesapla(k, b1)).toBe(3);
    expect(yildizHesapla({ ...k, puan: y2 }, b1)).toBe(2);
    expect(yildizHesapla({ ...k, puan: y2 - 1 }, b1)).toBe(1);
    expect(yildizHesapla({ ...k, istatistik: { ...k.istatistik, ustaEli: true } }, b1)).toBe(1);
  });
});
