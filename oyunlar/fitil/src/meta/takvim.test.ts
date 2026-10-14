import { describe, expect, it } from 'vitest';
import { gunFarki, gunNo, gundenTarih, haftaGunu, haftaNo, tarihEkle, tarihGecerli, tarihMetni, tarihYyyymmdd } from './takvim';
import { base64Coz, base64Kodla, base64Metin, metinBase64, utf8Coz, utf8Kodla } from './kodlama';

describe('takvim (Date yok)', () => {
  it('çağ başı ve bilinen günler', () => {
    expect(gunNo(19700101)).toBe(0);
    expect(gunNo(19700102)).toBe(1);
    expect(gunNo(19691231)).toBe(-1);
    expect(gunNo(20000301) - gunNo(20000228)).toBe(2); // 2000 artık yıl
    expect(gunNo(19000301) - gunNo(19000228)).toBe(1); // 1900 artık değil
  });

  it('gidiş-dönüş 1900–2999 arası her 97. gün', () => {
    for (let n = gunNo(19000101); n < gunNo(29991231); n += 97) {
      const t = gundenTarih(n);
      expect(tarihGecerli(t)).toBe(true);
      expect(gunNo(t)).toBe(n);
    }
  });

  it('Date ile karşılaştırma (yalnız testte)', () => {
    for (let i = 0; i < 2000; i++) {
      const ms = Date.UTC(2020, 0, 1) + i * 86400000 * 3;
      const d = new Date(ms);
      const t = tarihYyyymmdd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      expect(gunNo(t)).toBe(Math.round(ms / 86400000));
      expect(haftaGunu(t)).toBe((d.getUTCDay() + 6) % 7);
    }
  });

  it('haftanın günü ve hafta sınırı (Pazartesi başlar)', () => {
    expect(haftaGunu(20261014)).toBe(2); // Çarşamba
    expect(haftaGunu(20261018)).toBe(6); // Pazar
    expect(haftaGunu(20261019)).toBe(0); // Pazartesi
    expect(haftaNo(20261018)).toBe(haftaNo(20261012));
    expect(haftaNo(20261019)).toBe(haftaNo(20261018) + 1);
  });

  it('ay ve yıl geçişleri', () => {
    expect(tarihEkle(20261031, 1)).toBe(20261101);
    expect(tarihEkle(20261231, 1)).toBe(20270101);
    expect(tarihEkle(20280228, 1)).toBe(20280229);
    expect(tarihEkle(20270228, 1)).toBe(20270301);
    expect(tarihEkle(20270101, -1)).toBe(20261231);
    expect(gunFarki(20261231, 20270101)).toBe(1);
  });

  it('geçerlilik', () => {
    expect(tarihGecerli(20261014)).toBe(true);
    expect(tarihGecerli(20260229)).toBe(false);
    expect(tarihGecerli(20280229)).toBe(true);
    expect(tarihGecerli(20261301)).toBe(false);
    expect(tarihGecerli(20261000)).toBe(false);
    expect(tarihGecerli(2026101)).toBe(false);
    expect(tarihGecerli('20261014')).toBe(false);
    expect(tarihGecerli(20261014.5)).toBe(false);
  });

  it('paylaşım biçimi 14.10.2026', () => {
    expect(tarihMetni(20261014)).toBe('14.10.2026');
    expect(tarihMetni(20270105)).toBe('05.01.2027');
  });
});

describe('kodlama', () => {
  it('UTF-8 base64 gidiş-dönüş (Türkçe ve simgeler)', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'FİTİL · Günün Şenliği', 'ğüşıöç İĞÜŞÖÇ ★☆●▲■', '{"x":"Çarkıfelek"}']) {
      expect(base64Metin(metinBase64(s))).toBe(s);
    }
  });

  it('standart base64 ile aynı çıktı (Buffer karşılaştırması)', () => {
    for (let n = 0; n < 40; n++) {
      const b = new Uint8Array(n).map((_, i) => (i * 37 + n * 11) & 255);
      expect(base64Kodla(b)).toBe(Buffer.from(b).toString('base64'));
      expect(Array.from(base64Coz(base64Kodla(b))!)).toEqual(Array.from(b));
    }
  });

  it('bozuk base64 reddedilir', () => {
    expect(base64Coz('abc')).toBeNull();
    expect(base64Coz('ab=c')).toBeNull();
    expect(base64Coz('a===')).toBeNull();
    expect(base64Coz('ab$d')).toBeNull();
    expect(base64Coz('ğğğğ')).toBeNull();
  });

  it('geçersiz UTF-8 null', () => {
    expect(utf8Coz(new Uint8Array([0xff, 0xfe]))).toBeNull();
    expect(utf8Coz(utf8Kodla('İ'))).toBe('İ');
  });
});
