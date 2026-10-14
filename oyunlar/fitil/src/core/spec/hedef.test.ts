/**
 * §6 bölüm hedefleri (her türün ilerleme sayımı), ilerleme yüzdesi ve
 * Körük Göstergesi (§6 "Körük", §3.5.4 adım 5, §0 K7).
 * Fener / aydınlat / desen / dev fişek / is hedefleri engel.test.ts'de de sınanır.
 */
import { describe, expect, it } from 'vitest';
import { ilerlemeYuzdesi } from '../index';
import type { HedefDurumu } from '../index';
import { fitil, hucrede, ic, koruk, kur, patlamaAt, sec, uygula } from './kur';

const UC = '0,5 1,5 2,5';
const BOS4 = ['. . . . .', '. . . . .', '. . . . .', '. . . . .'];

describe('§6 hedef ilerleme sayımı', () => {
  it('§6.1 topla (renk): patlayan her o renk kapsül +1; hedefIlerledi olayı', () => {
    const d = kur({ tahta: [...BOS4, '. . . . .', 'R R R . .'], hedefler: [{ tur: 'topla', renk: 0, adet: 50 }] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 3, gerekli: 50, tamam: false });
    const h = sec(olaylar, 'hedefIlerledi').filter((o) => o.indeks === 0);
    expect(Math.max(...h.map((o) => o.deger))).toBe(3);
  });

  it("§6.1 topla: yıldız topu yalnız 'hepsi' sayacına girer; vuruşla patlayanlar sayılır", () => {
    const d = kur({
      esik: 5,
      tahta: ['R . . . R . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R * . . . .'],
      hedefler: [
        { tur: 'topla', renk: 0, adet: 50 },
        { tur: 'topla', renk: 'hepsi', adet: 50 },
      ],
    });
    const { durum } = uygula(d, fitil(UC));
    expect(durum.hedefler[0].ilerleme).toBe(4);
    expect(durum.hedefler[1].ilerleme).toBe(5);
  });

  it('§6.1 topla: ısı patlaması sayılır, dönüşüm sayılmaz', () => {
    const d = kur({
      tahta: ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. G3 . . . . .', 'R R R R R R .'],
      hedefler: [
        { tur: 'topla', renk: 0, adet: 50 },
        { tur: 'topla', renk: 3, adet: 50 },
      ],
    });
    const { durum } = uygula(d, fitil('0,5 1,5 2,5 3,5 4,5 5,5'));
    expect(durum.hedefler[0].ilerleme).toBe(5);
    expect(durum.hedefler[1].ilerleme).toBe(1);
  });

  it('§6.2 kafes: kırılan kafes sayısı / başlangıçtaki kafesler', () => {
    const d = kur({ tahta: ['. . . . C:A', ...BOS4.slice(1), '. C:G3 . . .', 'R R R . .'], hedefler: [{ tur: 'kafes' }] });
    expect(d.hedefler[0]).toMatchObject({ ilerleme: 0, gerekli: 2 });
    const { durum } = uygula(d, fitil(UC));
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2, tamam: false });
  });

  it('§6.3 kaya: yok edilen kaya sayısı (kat düşmesi sayılmaz)', () => {
    const d = kur({ tahta: [...BOS4, 'K1 . K2 . .', 'R R R . .'], hedefler: [{ tur: 'kaya' }] });
    expect(d.hedefler[0]).toMatchObject({ ilerleme: 0, gerekli: 2 });
    const { durum } = uygula(d, fitil(UC));
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
  });

  it('§6.9 zincirleme: tek hamlede R ≥ eşik reaksiyon (R = fitil düğümü olmayan kapsül patlamaları)', () => {
    // Dikey roket (2,9) yolun son düğümü: sütun 2'nin 9 hücresini vurur → R = 9.
    const satir = '. . . . .';
    const d = kur({
      tahta: [...Array(9).fill(satir), 'R R R| . .'],
      hedefler: [
        { tur: 'zincirleme', esik: 8, adet: 2 },
        { tur: 'zincirleme', esik: 10, adet: 1 },
      ],
    });
    const { olaylar, durum } = uygula(d, fitil('0,9 1,9 2,9'));
    expect(sec(olaylar, 'reaksiyon')).toMatchObject([{ boyut: 9 }]);
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
    expect(durum.hedefler[1]).toMatchObject({ ilerleme: 0, gerekli: 1 });
  });

  it('§6.10 halka: bırakılan geçerli halkalar sayılır, düz yol sayılmaz', () => {
    const d = kur({ tahta: [...BOS4, 'R R R . .', 'R R R . .'], hedefler: [{ tur: 'halka', adet: 2 }] });
    const duz = uygula(d, fitil(UC));
    expect(duz.durum.hedefler[0].ilerleme).toBe(0);
    const halka = uygula(d, fitil('0,4 1,4 1,5 0,5', true));
    expect(halka.durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
  });

  it('§6.11 puan: ilerleme bölüm puanıdır', () => {
    const d = kur({ tahta: [...BOS4, '. . . . .', 'R R R . .'], hedefler: [{ tur: 'puan', puan: 1000 }] });
    const { durum } = uygula(d, fitil(UC));
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 60, gerekli: 1000, tamam: false });
  });

  it('§6 hedef tamamlanınca tamam bayrağı (ilerleme = gerekli)', () => {
    const d = kur({ tahta: [...BOS4, '. . . . .', 'R R R . .'], hedefler: [{ tur: 'topla', renk: 0, adet: 3 }] });
    const { durum } = uygula(d, fitil(UC));
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 3, gerekli: 3, tamam: true });
  });
});

describe('§6 ilerleme yüzdesi', () => {
  it('§6 %İ = ortalama(min(1, ilerleme/hedef)) — taşan hedef 1 sayılır', () => {
    const d = kur({ tahta: [...BOS4, '. . . . .', 'R R R . .'] });
    const h = (ilerleme: number, gerekli: number): HedefDurumu => ({ hedef: { tur: 'topla', renk: 0, adet: gerekli }, ilerleme, gerekli, tamam: ilerleme >= gerekli });
    d.hedefler = [h(3, 6), h(10, 5)];
    expect(ilerlemeYuzdesi(d)).toBeCloseTo(0.75, 10);
    d.hedefler = [h(1, 4), h(0, 4), h(4, 4)];
    expect(ilerlemeYuzdesi(d)).toBeCloseTo((0.25 + 0 + 1) / 3, 10);
  });

  it('§6 başlangıçta ilerleme yüzdesi 0', () => {
    const d = kur({ tahta: [...BOS4, '. C:A . . .', 'R R R . .'], hedefler: [{ tur: 'topla', renk: 0, adet: 6 }, { tur: 'kafes' }, { tur: 'halka', adet: 1 }] });
    expect(ilerlemeYuzdesi(d)).toBe(0);
  });

  it('§6 hamle sonrası ilerleme yüzdesi hedef ilerlemesini izler', () => {
    const d = kur({ tahta: [...BOS4, '. . . . .', 'R R R . .'], hedefler: [{ tur: 'topla', renk: 0, adet: 6 }, { tur: 'halka', adet: 1 }] });
    const { durum } = uygula(d, fitil(UC));
    expect(ilerlemeYuzdesi(durum)).toBeCloseTo(0.25, 10);
  });
});

describe('§6 Körük Göstergesi', () => {
  // Yol (0,5)(1,5)(2,5); (1,4) G3 → ısı patlaması (nesil 1), (1,3) G3 → ısı patlaması (nesil 2).
  const IKI_ISI = ['. . . . .', '. . . . .', '. . . . .', '. G3 . . .', 'K3 G3 K3 . .', 'R R R K3 .'];

  it('§6 / §3.5.4.5 her ISI patlaması körüğü +1 doldurur', () => {
    const { durum } = uygula(kur({ tahta: IKI_ISI, korukKapasitesi: 20 }), fitil(UC));
    expect(durum.korukDolum).toBe(2);
  });

  it('§6 taşan dolum kaybolur (kapasitede durur)', () => {
    const { durum } = uygula(kur({ tahta: IKI_ISI, korukKapasitesi: 1 }), fitil(UC));
    expect(durum.korukDolum).toBe(1);
  });

  it('§6 kapasite 0 = körük kapalı, dolmaz', () => {
    const { durum } = uygula(kur({ tahta: IKI_ISI, korukKapasitesi: 0 }), fitil(UC));
    expect(durum.korukDolum).toBe(0);
  });

  // Merkez (2,2): 3×3 alanda (1,1) G3, (3,1) ıslak, (3,3) kaya; is (4,5) yanında düz aday (3,5).
  const KORUK = ['. . . . .', '. G3 G W:G .', '. G G G .', '. G G K1 .', '. . . . K3', '. . . G I'];
  const kurKoruk = () =>
    kur({
      tahta: KORUK,
      korukKapasitesi: 3,
      korukDolum: 3,
      hamle: 20,
      havaOlaylari: [{ tur: 'meltem', eksen: 'satir', hatlar: [0], periyot: 3, baslangic: 2 }],
    });

  it('§6 körük: Chebyshev ≤ 1 ısınabilir kapsüllere t = 0\'da +1; eşiğe ulaşan t = 90\'da nesil 1 patlar', () => {
    const { olaylar } = uygula(kurKoruk(), koruk(2, 2));
    expect(sec(olaylar, 'korukKullanildi')).toMatchObject([{ merkez: { x: 2, y: 2 } }]);
    for (const [x, y] of [
      [2, 1],
      [1, 2],
      [2, 2],
      [3, 2],
      [1, 3],
      [2, 3],
    ]) {
      expect(hucrede(olaylar, 'isindi', x, y)[0], `${x},${y}`).toMatchObject({ t: 0, isi: 1 });
    }
    expect(hucrede(olaylar, 'isindi', 1, 1)[0]).toMatchObject({ t: 0 });
    expect(patlamaAt(olaylar, 1, 1)).toMatchObject({ t: 90, neden: 'isi', nesil: 1, puan: 20 });
  });

  it('§6 körük ısısı patlama değildir: engele hasar vermez, ıslağı kurutmaz', () => {
    const { olaylar, durum } = uygula(kurKoruk(), koruk(2, 2));
    expect(hucrede(olaylar, 'engelHasar', 3, 3)).toEqual([]);
    expect(hucrede(olaylar, 'kurudu', 3, 1)).toEqual([]);
    expect(hucrede(olaylar, 'isindi', 3, 1)).toEqual([]);
    expect(ic(durum, 3, 3)).toEqual({ tur: 'kaya', kat: 1 });
  });

  it('§6 / §3.1 körük hamle harcamaz; is yayılması ve hava olayları uygulanmaz; dolum sıfırlanıp yeni ısı patlamalarıyla dolar', () => {
    const d = kurKoruk();
    const { olaylar, durum } = uygula(d, koruk(2, 2));
    expect(durum.kalanHamle).toBe(20);
    expect(sec(olaylar, 'isYayildi')).toEqual([]);
    expect(ic(durum, 3, 5)).toMatchObject({ tur: 'kapsul', renk: 3 });
    expect(sec(olaylar, 'havaOlayi')).toEqual([]);
    expect(durum.havaOlaylari[0].sayac).toBe(2);
    // §6 "Dolum 0 olur" + §3.5.4.5 bu eylemdeki 1 ısı patlaması → 1
    expect(durum.korukDolum).toBe(1);
    expect(durum.puan).toBe(20);
  });

  it('§6 körük tahta kenarında: yalnız tahta içindeki hücreler ısınır', () => {
    const d = kur({ tahta: [...BOS4, '. . . . .', '. . . . .'], korukKapasitesi: 2, korukDolum: 2 });
    const { olaylar } = uygula(d, koruk(0, 0));
    const t0 = sec(olaylar, 'isindi').filter((o) => o.t === 0);
    expect(t0.map((o) => `${o.hucre.x},${o.hucre.y}`).sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });
});
