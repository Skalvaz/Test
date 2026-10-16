import { describe, expect, it } from 'vitest';
import type { TemizlikKaydi } from '../core/types';
import { bolumuYukle, gecerliHamleler, hamleUygula } from '../core/index';
import { BOLUMLER } from '../levels/index';
import {
  bolumAcik,
  bolumBitti,
  bolumKaydi,
  denemeBaslat,
  gunlukCoz,
  gunlukCozGuvenli,
  gunlukKodla,
  ilerlemePuani,
  ilerlemeSifirla,
  ilkOturum,
  kayitGoc,
  siradakiBolum,
  sonAcikBolum,
  tabloSakla,
  toplamYildiz,
  ustaEliOnerilir,
  varsayilanKayit,
  type TabloKaydi,
} from './index';

const tablo = (puan: number): TabloKaydi => ({ tohum: 7, gunluk: gunlukKodla([]), nadirlik: 0, teknikler: ['battal'], yildiz: 1, puan });

describe('kayıt şeması ve göç (§13.7)', () => {
  it('bozuk ya da boş girdi varsayılana döner', () => {
    const v = varsayilanKayit();
    for (const x of [null, undefined, 3, 'x', [], { surum: 99 }]) expect(kayitGoc(x)).toEqual(v);
  });

  it('alanları temizler ve sınırlar', () => {
    const k = kayitGoc({
      surum: 1,
      bolumler: { '1': { yildiz: 7, enIyi: -5, deneme: 2.4, basarisizSeri: 'x', tablo: { tohum: 5, gunluk: 'bozuk' } }, abc: { yildiz: 2 }, '3': { yildiz: 2 } },
      ogretim: { gorulenBalonlar: ['a', 'a', 3, 'b'] },
      ayarlar: { sfx: 4, muzik: -1, hiz: 2, palet: 'renkKoru', tarifSeridi: 'her', hareketiAzalt: 'evet' },
      istatistik: { oynanan: 3 },
    });
    expect(k.bolumler['1']).toEqual({ yildiz: 3, enIyi: 0, deneme: 2, basarisizSeri: 0, kazanildi: true, tablo: null });
    expect(k.bolumler.abc).toBeUndefined();
    expect(k.bolumler['3'].kazanildi).toBe(true);
    expect(k.ogretim.gorulenBalonlar).toEqual(['a', 'b']);
    expect(k.ayarlar).toMatchObject({ sfx: 1, muzik: 0, hiz: 1, palet: 'renkKoru', tarifSeridi: 'her', hareketiAzalt: null });
    expect(k.istatistik).toEqual({ oynanan: 3, kazanilan: 0, enUzunKaskat: 0, lale: 0 });
  });

  it('JSON gidiş-dönüşü kaydı değiştirmez', () => {
    let k = varsayilanKayit();
    k = bolumBitti(k, { id: 1, kazanc: true, puan: 3000, yildiz: 2, tablo: tablo(3000) });
    expect(kayitGoc(JSON.parse(JSON.stringify(k)))).toEqual(k);
  });
});

describe('temizlik günlüğü sıkıştırma (§9.1)', () => {
  it('gerçek oyun günlüğü birebir geri döner, kayıt başına 6 bayt', () => {
    for (const v of BOLUMLER.slice(0, 6)) {
      let d = bolumuYukle(v, 3);
      for (let i = 0; i < 12 && !d.bitti; i++) {
        const l = gecerliHamleler(d);
        d = hamleUygula(d, l[(i * 7) % l.length]).durum;
      }
      const s = gunlukKodla(d.gunluk);
      expect(s[0]).toBe('b');
      expect(gunlukCoz(s)).toEqual(d.gunluk);
      expect(Math.ceil((d.gunluk.length * 6) / 3) * 4 + 1).toBe(s.length);
    }
  });

  it('şölen (hamle −1) ve yönler korunur; sığmayan değer JSON yedeğine düşer', () => {
    const l: TemizlikKaydi[] = [
      { hamle: -1, k: 2, tur: 'tarak', x10: 30, y10: 85, renk: 3, boyut: 7, yon: 'dikey' },
      { hamle: 4, k: 1, tur: 'grup', x10: 0, y10: 0, renk: 5, boyut: 3 },
      { hamle: 9, k: 3, tur: 'birlesim', x10: 60, y10: 10, renk: 0, boyut: 40, yon: 'yatay' },
    ];
    expect(gunlukCoz(gunlukKodla(l))).toEqual(l);
    const uzun = [{ ...l[1], k: 40 }];
    const s = gunlukKodla(uzun);
    expect(s[0]).toBe('j');
    expect(gunlukCoz(s)).toEqual(uzun);
    expect(gunlukCozGuvenli('b$$')).toBeNull();
    expect(gunlukCozGuvenli('zzz')).toBeNull();
  });
});

describe('ilerleme (§12.3)', () => {
  it('kilitler: yalnız bir önceki kazanılınca açılır', () => {
    let k = varsayilanKayit();
    expect(bolumAcik(k, 1)).toBe(true);
    expect(bolumAcik(k, 2)).toBe(false);
    expect(ilkOturum(k)).toBe(true);
    k = bolumBitti(k, { id: 1, kazanc: false, puan: 100, yildiz: 0 });
    expect(bolumAcik(k, 2)).toBe(false);
    k = bolumBitti(k, { id: 1, kazanc: true, puan: 2000, yildiz: 1, tablo: tablo(2000) });
    expect(bolumAcik(k, 2)).toBe(true);
    expect(ilkOturum(k)).toBe(false);
    expect(sonAcikBolum(k)).toBe(2);
    expect(siradakiBolum(k)).toBe(2);
    expect(bolumAcik(k, 21)).toBe(false);
  });

  it('yıldız ve en iyi puan yalnız büyür; ilk tablo kendiliğinden, sonrakiler seçimle', () => {
    let k = varsayilanKayit();
    k = bolumBitti(k, { id: 1, kazanc: true, puan: 3000, yildiz: 3, tablo: tablo(3000) });
    k = bolumBitti(k, { id: 1, kazanc: true, puan: 2000, yildiz: 1, tablo: tablo(2000) });
    const b = bolumKaydi(k, 1);
    expect(b.yildiz).toBe(3);
    expect(b.enIyi).toBe(3000);
    expect(b.tablo?.puan).toBe(3000);
    k = tabloSakla(k, 1, tablo(2000));
    expect(bolumKaydi(k, 1).tablo?.puan).toBe(2000);
    expect(toplamYildiz(k)).toBe(3);
    expect(ilerlemePuani(k)).toBe(3002);
  });

  it('deneme numarası ve ardışık kayıp (Usta\'nın Eli, K16)', () => {
    let k = varsayilanKayit();
    const a = denemeBaslat(k, 4);
    expect(a.denemeNo).toBe(0);
    k = a.kayit;
    expect(denemeBaslat(k, 4).denemeNo).toBe(1);
    for (let i = 0; i < 2; i++) k = bolumBitti(k, { id: 4, kazanc: false, puan: 0, yildiz: 0 });
    expect(ustaEliOnerilir(k, 4)).toBe(false);
    k = bolumBitti(k, { id: 4, kazanc: false, puan: 0, yildiz: 0 });
    expect(ustaEliOnerilir(k, 4)).toBe(true);
    k = bolumBitti(k, { id: 4, kazanc: true, puan: 10, yildiz: 1 });
    expect(bolumKaydi(k, 4).basarisizSeri).toBe(0);
  });

  it('işlevler girdiyi değiştirmez; sıfırlama ayarları korur', () => {
    const k = Object.freeze(varsayilanKayit());
    const y = bolumBitti(k, { id: 1, kazanc: true, puan: 1, yildiz: 1 });
    expect(k.bolumler['1']).toBeUndefined();
    const z = ilerlemeSifirla({ ...y, ayarlar: { ...y.ayarlar, palet: 'renkKoru' } }, varsayilanKayit());
    expect(z.bolumler).toEqual({});
    expect(z.ayarlar.palet).toBe('renkKoru');
  });
});
