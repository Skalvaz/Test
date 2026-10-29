/**
 * (CAN-REKLAM §6, G3) Arayüzün DOM'suz parçaları: geri sayım biçimi, harita
 * "aynı model" denetiminin can hapını dışarıda bırakması, Kaybettin'de
 * Ücretsiz tekrar notunun ("Can derdi yok…") ne zaman kalktığı, Türkçe metinlerin
 * şartnameyle birebirliği.
 */
import { describe, expect, it } from 'vitest';
import { M, MC, URUN_METINLERI, geriSayim } from './metinler';
import { ayniHarita } from './harita/harita';
import { kaybettinGelirli } from './ekranlar/kaybettin';
import { URUN_IDLERI } from '../platform/gelir';
import { GUCLENDIRICI_PAKETI, CAN_ENCOK } from '../meta/can';
import type { HaritaVM, KaybettinVM } from './tipler';

describe('geri sayım metni', () => {
  it('dakika:saniye, saniye yukarı yuvarlanır', () => {
    expect(geriSayim((12 * 60 + 31) * 1000)).toBe('12:31');
    expect(geriSayim((12 * 60 + 30) * 1000 + 1)).toBe('12:31');
    expect(geriSayim(30 * 60 * 1000)).toBe('30:00');
    expect(geriSayim(65_000)).toBe('1:05');
    expect(geriSayim(1)).toBe('0:01');
    expect(geriSayim(0)).toBe('0:00');
    expect(geriSayim(-5000)).toBe('0:00');
    expect(geriSayim((3600 + 5 * 60 + 9) * 1000)).toBe('1:05:09');
  });
});

const harita = (o: Partial<HaritaVM> = {}): HaritaVM => ({
  toplamYildiz: 12,
  bolumler: [{ id: 1, yildiz: 3, durum: 'acik' }],
  ustalar: [],
  motifler: [],
  seri: { gun: 2, basamak: null },
  gunluk: { acik: false, tamam: 0, toplam: 3, acilisBolumu: 14 },
  ...o,
});

describe('harita: aynı model denetimi can hapını saymaz (§13 karar 9)', () => {
  it('yalnız can değişince aynı harita (yeniden çizilmez)', () => {
    expect(ayniHarita(harita({ can: { sayi: 3, enCok: 5, sonrakiMs: 1000 } }), harita({ can: { sayi: 2, enCok: 5, sonrakiMs: 9000 } }))).toBe(true);
    expect(ayniHarita(harita(), harita({ can: null }))).toBe(true);
  });
  it('başka alan değişince farklı', () => {
    expect(ayniHarita(harita({ can: { sayi: 3, enCok: 5, sonrakiMs: 1000 } }), harita({ toplamYildiz: 13, can: { sayi: 3, enCok: 5, sonrakiMs: 1000 } }))).toBe(false);
  });
});

describe('Kaybettin: sağlayıcı varken ücretsiz tekrar notu çıkmaz', () => {
  const kb = (o: Partial<KaybettinVM> = {}): KaybettinVM => ({ bolumId: 9, bolumAdi: 'x', yuzde: 0.5, enZorHedef: null, hayalet: 'yok', ustaEli: false, coskuSifirlandi: false, ...o });
  it('alanlar yoksa (sağlayıcı yok) not kalır', () => {
    expect(kaybettinGelirli(kb())).toBe(false);
    expect(kaybettinGelirli(kb({ can: null, reklamHamle: null, canBitti: false }))).toBe(false);
  });
  it('can, reklam, can bitti ya da gelirVar varsa not kalkar', () => {
    expect(kaybettinGelirli(kb({ can: { kalan: 3 } }))).toBe(true);
    expect(kaybettinGelirli(kb({ reklamHamle: { kart: false } }))).toBe(true);
    expect(kaybettinGelirli(kb({ canBitti: true }))).toBe(true);
    expect(kaybettinGelirli(kb({ gelirVar: true }))).toBe(true);
  });
});

describe('Türkçe metinler şartnameyle birebir (CAN-REKLAM §6)', () => {
  const duz = (s: string) => s.replace(/ /g, ' ');
  it('can paneli, Kaybettin, çıkış onayı', () => {
    expect(MC.canlarBitti).toBe('Canların bitti');
    expect(MC.canlarDurum(3, 5)).toBe('Canlar 3/5');
    expect(MC.sonrakiCan).toBe('Sonraki can');
    expect(`${MC.reklamIzle} · ${MC.artiBirCan}`).toBe('Reklam izle · +1 can');
    expect(MC.hakKaldi(2)).toBe('2 hak kaldı');
    expect(MC.yarinYine).toBe('Yarın yine');
    expect(MC.ucretsizBirCan).toBe('Ücretsiz +1 can');
    expect(`${MC.canlariDoldur} · ₺29,99`).toBe('Canları doldur · ₺29,99');
    expect(MC.bekle).toBe('Bekle');
    expect(MC.kayipCan(3)).toBe('−1 can · 3 kaldı');
    expect(MC.canBitti).toBe('Can bitti');
    expect(MC.ucretsizBesHamle).toBe('Ücretsiz +5 hamle');
    expect(duz(MC.cikisMetni)).toBe('Bölümden çıkarsan 1 can gider.');
    expect(MC.cik).toBe('Çık');
    expect(MC.sendeVar).toBe('Sende var');
    expect(MC.stokDolu).toBe('Stok dolu');
    expect(MC.geriYukle).toBe('Satın alımları geri yükle');
  });
  it('Hakkında: sağlayıcı yokken metin aynen, varken can cümlesi', () => {
    expect(M.hakkindaMetin).toBe('Fener Koyu’nun Işık Şenliği’ni yeniden yak. Can yok, bekleme yok, mağaza yok.');
    expect(M.hakkindaMetinGelir).toBe('Fener Koyu’nun Işık Şenliği’ni yeniden yak. Her 30 dakikada 1 can dolar. Reklam sen istemezsen çıkmaz.');
  });
  it('ürün adları her ürün için var; paket açıklaması GUCLENDIRICI_PAKETI ile tutarlı', () => {
    for (const id of URUN_IDLERI) {
      expect(URUN_METINLERI[id].ad.length).toBeGreaterThan(2);
      expect(URUN_METINLERI[id].aciklama.length).toBeGreaterThan(2);
    }
    expect(URUN_METINLERI.can_doldur).toEqual({ ad: 'Canları doldur', aciklama: `Canlar hemen ${CAN_ENCOK}’e dolar` });
    const p = GUCLENDIRICI_PAKETI;
    expect(URUN_METINLERI.guclendirici_paketi).toEqual({ ad: 'Güçlendirici paketi', aciklama: `${p.kibrit} Kibrit, ${p.kalip} Fişek Kalıbı, ${p.geriSar} Geri Sar` });
    expect(URUN_METINLERI.usta_karti).toEqual({ ad: 'Usta kartı', aciklama: 'Reklamlı ödüller reklamsız gelir' });
  });
});
