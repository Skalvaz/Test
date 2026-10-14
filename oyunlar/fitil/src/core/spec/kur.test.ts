/**
 * Kurucunun (spec/kur.ts) kendisi ve §8.1 bölüm yükleme sözleşmesi.
 * Bunlar P0 başvuru yükleyicisiyle yeşil olmalı.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, durumKarmasi } from '../index';
import { cheb, fitilZamanlari, hucreAt, ic, kur, kurBolum, reaksiyonBonusu, yol } from './kur';

const ORNEK = [
  'R A Z G M',
  'C:R W:G F I #',
  'K1 K2 K3 S S1',
  'D D4 R3 G| *',
  'R- Z/ A\\ M@ P',
  '. . . . .',
];

describe('§8.1 kurucu: mini dil → BolumVerisi', () => {
  it('§8.1 duzen simgeleri ve sabitKapsuller her hücreyi belirler', () => {
    const v = kurBolum({ tahta: ORNEK });
    expect(v.w).toBe(5);
    expect(v.h).toBe(6);
    expect(v.duzen[1]).toBe('C W F I #');
    expect(v.duzen[2]).toBe('K1 K2 K3 S S1');
    expect(v.duzen[3]).toBe('D D4 . . .');
    expect(v.dogumAgirliklari).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it('§8.1 yükleyici (bolumuYukle) kurucunun çizdiği tahtayı birebir üretir', () => {
    const v = kurBolum({ tahta: ORNEK });
    const yuklenen = bolumuYukle(v, 0);
    const beklenen = kur({ tahta: ORNEK });
    for (let i = 0; i < yuklenen.hucreler.length; i++) {
      expect(yuklenen.hucreler[i], `hücre ${i}`).toEqual(beklenen.hucreler[i]);
    }
  });

  it('§2.3 kapsül simgeleri: renk, ısı, özel, eksen', () => {
    const d = kur({ tahta: ORNEK });
    expect(ic(d, 0, 0)).toEqual({ tur: 'kapsul', renk: 0, isi: 0, ozel: 'yok', eksen: 0 });
    expect(ic(d, 2, 3)).toMatchObject({ tur: 'kapsul', renk: 0, isi: 3, ozel: 'yok' });
    expect(ic(d, 3, 3)).toMatchObject({ renk: 3, ozel: 'roket', eksen: 1 });
    expect(ic(d, 4, 3)).toMatchObject({ renk: -1, ozel: 'yildiz' });
    expect(ic(d, 0, 4)).toMatchObject({ ozel: 'roket', eksen: 0 });
    expect(ic(d, 1, 4)).toMatchObject({ ozel: 'roket', eksen: 2 });
    expect(ic(d, 2, 4)).toMatchObject({ ozel: 'roket', eksen: 3 });
    expect(ic(d, 3, 4)).toMatchObject({ ozel: 'kasimpati' });
    expect(ic(d, 0, 5)).toMatchObject({ renk: 5, ozel: 'yok' });
  });

  it('§2.2 engel simgeleri: kafes, ıslak, fener, is, delik, kaya, kova, dev fişek', () => {
    const d = kur({ tahta: ORNEK });
    expect(hucreAt(d, 0, 1)).toMatchObject({ kafes: true, icerik: { tur: 'kapsul', renk: 0 } });
    expect(ic(d, 1, 1)).toEqual({ tur: 'islak', renk: 3 });
    expect(ic(d, 2, 1)).toEqual({ tur: 'fener' });
    expect(ic(d, 3, 1)).toEqual({ tur: 'is' });
    expect(hucreAt(d, 4, 1)).toMatchObject({ delik: true, icerik: null });
    expect(ic(d, 0, 2)).toEqual({ tur: 'kaya', kat: 1 });
    expect(ic(d, 2, 2)).toEqual({ tur: 'kaya', kat: 3 });
    expect(ic(d, 3, 2)).toEqual({ tur: 'kova', kat: 2 });
    expect(ic(d, 4, 2)).toEqual({ tur: 'kova', kat: 1 });
    expect(ic(d, 0, 3)).toEqual({ tur: 'devFisek', dolum: 0, kapasite: 5 });
    expect(ic(d, 1, 3)).toEqual({ tur: 'devFisek', dolum: 0, kapasite: 4 });
  });

  it('§8.1 zemin: döşeme, desen ve barut izi sırası', () => {
    const d = kur({
      tahta: ['R R R R R', 'R R R R R', 'G G G G G', 'G G G G G', 'A A A A A', 'A A A A A'],
      zemin: ['2 1 . . .', 'dR . . . .', 'i2 i1 i0 . .', '. . . . j0', '. . . . j1', '1+dG . . . .'],
    });
    expect(hucreAt(d, 0, 0).doseme).toBe(2);
    expect(hucreAt(d, 1, 0).doseme).toBe(1);
    expect(hucreAt(d, 0, 1).desenRengi).toBe(0);
    expect(hucreAt(d, 0, 5)).toMatchObject({ doseme: 1, desenRengi: 3, desenBoyali: false });
    expect(d.izler).toHaveLength(2);
    expect(d.izler[0].hucreler).toEqual([2 * 5 + 2, 2 * 5 + 1, 2 * 5 + 0]);
    expect(d.izler[0].yandi).toEqual([false, false, false]);
    expect(d.izler[1].hucreler).toEqual([3 * 5 + 4, 4 * 5 + 4]);
    expect(hucreAt(d, 1, 2).izIndeksi).toBe(0);
    expect(hucreAt(d, 4, 4).izIndeksi).toBe(1);
  });

  it('§8.1 D<n>:<m> dev fişek dolumu ve _ boş hücre yüklemeden sonra yazılır', () => {
    const d = kur({ tahta: ['D3:2 _ R R R', 'R R R R R', 'R R R R R', 'R R R R R', 'R R R R R', 'R R R R R'] });
    expect(ic(d, 0, 0)).toEqual({ tur: 'devFisek', dolum: 2, kapasite: 3 });
    expect(ic(d, 1, 0)).toBeNull();
  });

  it('§8.1 aynı veri ve deneme aynı durum karmasını verir (belirlenimlilik)', () => {
    const a = kur({ tahta: ORNEK });
    const b = kur({ tahta: ORNEK });
    expect(durumKarmasi(a)).toBe(durumKarmasi(b));
    expect(durumKarmasi(kur({ tahta: ORNEK, denemeNo: 1 }))).not.toBe(durumKarmasi(a));
  });
});

describe('kurucu yardımcıları', () => {
  it('§3.5.1 fitilZamanlari GDD örnekleriyle uyumlu (6 → …445, 10 → 675)', () => {
    expect(fitilZamanlari(6)).toEqual([0, 103, 199, 288, 370, 445]);
    expect(fitilZamanlari(10)[9]).toBe(675);
    expect(fitilZamanlari(13).slice(10)).toEqual([715, 750, 785]);
  });

  it('§7.2 reaksiyonBonusu kademeleri', () => {
    expect(reaksiyonBonusu(7).bonus).toBe(0);
    expect(reaksiyonBonusu(8)).toEqual({ kademe: 'guzel', bonus: 100 });
    expect(reaksiyonBonusu(15).bonus).toBe(300);
    expect(reaksiyonBonusu(25).bonus).toBe(600);
    expect(reaksiyonBonusu(40).bonus).toBe(1200);
  });

  it('yol ve cheb ayrıştırıcıları', () => {
    expect(yol('0,5 1,4 2,3')).toEqual([{ x: 0, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 3 }]);
    expect(cheb({ x: 0, y: 0 }, { x: 2, y: -1 })).toBe(2);
  });
});
