import { describe, expect, it } from 'vitest';
import { HamleHatasiIstisnasi, hamleUygula, ilerlemeYuzdesi, onizle } from './index';
import type { Olay } from './types';
import { H, kur } from './testAraclari';

const tur = <T extends Olay['tur']>(ol: Olay[], t: T) => ol.filter((o) => o.tur === t) as Extract<Olay, { tur: T }>[];
const UCLU = ['4 4 4 4', '4 4 4 4', '3 3 2 1'];

describe('hedefler (§7) ve bitiş (§4.2 adım 3)', () => {
  it('renk topla: her temizlenen o renkteki damla; tamamlanınca kazanç', () => {
    const d = kur(UCLU, { hedefler: [{ tur: 'topla', renk: 3, adet: 3 }] });
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(tur(r.olaylar, 'hedefIlerledi').map((o) => [o.deger, o.tamam])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    // Her hedefIlerledi kendi temizlendi'sinin ardında.
    const i = r.olaylar.findIndex((o) => o.tur === 'hedefIlerledi');
    expect(r.olaylar[i - 1].tur).toBe('temizlendi');
    const n = r.olaylar.length;
    expect(r.olaylar[n - 2]).toMatchObject({ tur: 'bolumBitti', sonuc: 'kazanc' });
    expect(r.durum.bitti).toBe('kazanc');
    expect(ilerlemeYuzdesi(r.durum)).toBe(1);
    expect(() => hamleUygula(r.durum, H(0, 0, 0, 1))).toThrow(HamleHatasiIstisnasi);
  });

  it('ilerleme gerekliyi aşmaz; tamamlanan hedef ilerlemez', () => {
    const d = kur(UCLU, { hedefler: [{ tur: 'topla', renk: 3, adet: 2 }, { tur: 'topla', renk: 5, adet: 4 }] });
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(tur(r.olaylar, 'hedefIlerledi')).toHaveLength(2);
    expect(r.durum.hedefler.map((h) => [h.ilerleme, h.tamam])).toEqual([
      [2, true],
      [0, false],
    ]);
    expect(r.durum.bitti).toBeNull();
    expect(ilerlemeYuzdesi(r.durum)).toBe(0.5);
  });

  it('kâğıda al: her alınan kat; desen: her boyanan hücre', () => {
    const d = kur(UCLU, {
      hedefler: [{ tur: 'kagit' }, { tur: 'desen', motif: 'lale' }],
      zemin: { kagit: [[0, 2, 2], [3, 0, 1]], desen: { motif: 'lale', hucreler: [[1, 2, 3], [2, 0, 6]] } },
    });
    expect(d.hedefler.map((h) => h.gerekli)).toEqual([3, 2]);
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(r.durum.hedefler.map((h) => h.ilerleme)).toEqual([1, 1]);
    expect(onizle(d, H(3, 2, 2, 2)).hedefArtisi).toEqual([1, 1]);
  });

  it('puan hedefi eylem sonunda bir kez güncellenir', () => {
    const d = kur(UCLU, { hedefler: [{ tur: 'topla', renk: 6, adet: 9 }, { tur: 'puan', puan: 50 }] });
    const r = hamleUygula(d, H(3, 2, 2, 2));
    const hi = tur(r.olaylar, 'hedefIlerledi');
    expect(hi).toEqual([{ t: expect.any(Number), tur: 'hedefIlerledi', indeks: 1, deger: 50, tamam: true }]);
  });

  it('hamle bitince kayıp; özetten önce bolumBitti', () => {
    const d = kur(UCLU, { hamle: 1, hedefler: [{ tur: 'topla', renk: 6, adet: 9 }] });
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(r.durum.bitti).toBe('kayip');
    expect(r.durum.kalanHamle).toBe(0);
    expect(r.olaylar.slice(-2).map((o) => o.tur)).toEqual(['bolumBitti', 'hamleOzeti']);
  });

  it('son hamle hedefi tamamlarsa kazanç (kayıp değil)', () => {
    const d = kur(UCLU, { hamle: 1, hedefler: [{ tur: 'topla', renk: 3, adet: 3 }] });
    expect(hamleUygula(d, H(3, 2, 2, 2)).durum.bitti).toBe('kazanc');
  });
});
