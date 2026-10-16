import { describe, expect, it } from 'vitest';
import { HamleHatasiIstisnasi, durumKarmasi, hamleUygula, onizle, SABIT } from './index';
import type { Olay } from './types';
import { derinDondur, H, kur, tahtaMetni } from './testAraclari';

const tur = <T extends Olay['tur']>(ol: Olay[], t: T) => ol.filter((o) => o.tur === t) as Extract<Olay, { tur: T }>[];

describe('karışım (§3.1, §3.3, §4.2)', () => {
  it('yatay karışım → Turuncu üçlüsü: olay sırası, zamanlar, puan, son tahta', () => {
    const d = kur(['4 4 4 4', '4 4 4 4', '3 3 2 1']);
    const r = hamleUygula(d, H(3, 2, 2, 2));
    const ol = r.olaylar;
    expect(ol[0]).toEqual({ t: 0, tur: 'karisti', kaynak: { x: 3, y: 2 }, hedef: { x: 2, y: 2 }, a: 1, b: 2, sonuc: 3, yeniId: 13 });
    // Tur 1: dolumsuz düşme (kaynak sütunu iner) t = 220, grup → adım 1.
    expect(ol[1]).toMatchObject({ t: 220, tur: 'yercekimi', doganlar: [] });
    expect(ol[2]).toMatchObject({ t: 520, tur: 'eslesti', renk: 3, k: 1, hucreler: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }], merkez: { x: 1, y: 2 } });
    const tm = tur(ol, 'temizlendi');
    expect(tm.map((o) => [o.t, o.hucre.x, o.neden, o.k, o.puan])).toEqual([
      [640, 0, 'grup', 1, 30],
      [640, 1, 'grup', 1, 30],
      [640, 2, 'grup', 1, 30],
    ]);
    // Tur 2: düşme + dolum tek olay (t = 640 + 250).
    const yc = tur(ol, 'yercekimi');
    expect(yc).toHaveLength(2);
    expect(yc[1].t).toBe(890);
    expect(yc[1].doganlar.map((g) => g.hucre)).toEqual([0, 1, 2, 3].map((x) => ({ x, y: 0 })));
    expect(r.durum.puan).toBe(90);
    expect(tahtaMetni(r.durum)).toEqual(['1 1 1 1', '4 4 4 4', '4 4 4 4']);
    expect(ol[ol.length - 1]).toMatchObject({ tur: 'hamleOzeti', temizlenen: 3, kaskat: 1, eslesme: true, merkez: { x: 1, y: 2 } });
    expect(r.durum.kalanHamle).toBe(d.kalanHamle - 1);
    expect(r.durum.hamleNo).toBe(1);
    expect(r.durum.istatistik).toMatchObject({ eslesenHamle: 1, enUzunKaskat: 1, enBuyukGrup: 3, temizlenenDamla: 3 });
    expect(r.durum.gunluk).toEqual([{ hamle: 0, k: 1, tur: 'grup', x10: 10, y10: 20, renk: 3, boyut: 3 }]);
  });

  it('yön kuralı (§3.4): yukarı sürüklemede sonuç boşalan kaynağa düşer', () => {
    const d = kur(['4 4 4', '4 2 4', '3 1 3']);
    expect(onizle(d, H(1, 2, 1, 1))).toMatchObject({ gecerli: true, sonuc: 3, sonucHucre: { x: 1, y: 2 } });
    const r = hamleUygula(d, H(1, 2, 1, 1));
    expect(tur(r.olaylar, 'eslesti')[0].hucreler).toEqual([{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }]);
  });

  it('yön kuralı: aşağı sürüklemede sonuç yerinde kalır, üstündeki sütun iner', () => {
    const d = kur(['4 5 4', '4 1 4', '3 2 3']);
    expect(onizle(d, H(1, 1, 1, 2))).toMatchObject({ sonuc: 3, sonucHucre: { x: 1, y: 2 } });
    const r = hamleUygula(d, H(1, 1, 1, 2));
    expect(tur(r.olaylar, 'yercekimi')[0].dusenler).toEqual([{ den: { x: 1, y: 0 }, e: { x: 1, y: 1 } }]);
  });

  it('eşleşmeyen karışım kurulum hamlesidir: yalnız kaynak sütunu iner ve dolar', () => {
    const d = kur(['4 4 4', '4 1 4', '6 2 4'], { dogum: [0, 1, 0, 0, 0, 0] });
    const r = hamleUygula(d, H(1, 1, 1, 2));
    expect(tahtaMetni(r.durum)).toEqual(['4 2 4', '4 4 4', '6 3 4']);
    expect(tur(r.olaylar, 'yercekimi')).toHaveLength(1);
    expect(r.olaylar[r.olaylar.length - 1]).toMatchObject({ tur: 'hamleOzeti', temizlenen: 0, kaskat: 0, eslesme: false });
  });

  it('Mürekkep karışımı yalnız kural açıkken (K1); sonuç Mürekkep özel taşı', () => {
    const kapali = kur(['4 4 4', '3 4 4']);
    expect(() => hamleUygula(kapali, H(1, 1, 0, 1))).toThrow(HamleHatasiIstisnasi);
    const d = kur(['4 4 4', '3 4 4'], { murekkep: true });
    const r = hamleUygula(d, H(1, 1, 0, 1));
    expect(r.olaylar[0]).toMatchObject({ tur: 'karisti', a: 4, b: 3, sonuc: 7 });
    expect(tahtaMetni(r.durum)[1].split(' ')[0]).toBe('7');
    expect(r.durum.istatistik.murekkep).toBe(1);
  });

  it('geçersiz hamle fırlatır, hamle harcamaz', () => {
    const d = kur(['4 4 4', '1 1 3']);
    for (const h of [H(0, 1, 1, 1), H(1, 1, 2, 1), H(0, 0, 2, 0), H(0, 0, 0, 3)]) expect(() => hamleUygula(d, h)).toThrow(HamleHatasiIstisnasi);
    expect(d.kalanHamle).toBe(30);
    expect(onizle(d, H(0, 1, 1, 1))).toMatchObject({ gecerli: false, hata: 'ayniRenk', temizlenecek: [] });
  });

  it('girdiyi değiştirmez (derin dondurulmuş durum) ve belirlenimlidir', () => {
    const d = derinDondur(kur(['4 4 4 4', '4 4 4 4', '3 3 2 1'], { dogum: [20, 20, 20, 11, 11, 11], garanti: 2 }));
    const a = hamleUygula(d, H(3, 2, 2, 2));
    const b = hamleUygula(d, H(3, 2, 2, 2));
    expect(durumKarmasi(a.durum)).toBe(durumKarmasi(b.durum));
    expect(JSON.stringify(a.olaylar)).toBe(JSON.stringify(b.olaylar));
    expect(onizle(d, H(3, 2, 2, 2)).gecerli).toBe(true);
  });

  it('olaylar t sırasında; hamleOzeti son olay; kaskat ≥ 2 kademeleri', () => {
    // Kaskat: sol sütundaki dikey Turuncu üçlüsü temizlenince sütun 3 iner,
    // (0,1)'deki Mor iki Mor'un yanına düşer → ikinci adım.
    const d = kur(['4 4 4 4', '5 4 4 4', '3 5 4 4', '3 5 4 4', '2 1 4 4']);
    const r = hamleUygula(d, H(1, 4, 0, 4));
    let t = 0;
    for (const o of r.olaylar) {
      expect(o.t).toBeGreaterThanOrEqual(t);
      t = o.t;
    }
    const k = tur(r.olaylar, 'kaskat');
    expect(k).toEqual([{ t: expect.any(Number), tur: 'kaskat', k: 2, kademe: 'guzel' }]);
    const tm = tur(r.olaylar, 'temizlendi');
    expect(tm.filter((o) => o.k === 2).map((o) => o.puan)).toEqual([60, 60, 60]);
    expect(r.durum.puan).toBe(90 + 180);
    expect(r.durum.istatistik.enUzunKaskat).toBe(2);
    expect(r.olaylar[r.olaylar.length - 1]).toMatchObject({ tur: 'hamleOzeti', kaskat: 2, temizlenen: 6 });
    expect(SABIT.ZAMAN.toplanma).toBe(120);
  });
});
