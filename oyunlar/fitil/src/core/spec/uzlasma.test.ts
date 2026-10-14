/**
 * Uzlaştırma kararları: GDD'nin belirsiz ya da çelişkili olduğu, çekirdek ile
 * şartname testlerinin ilk turda bilerek sınamadığı noktalar. Her test
 * seçilen okumayı sabitler; gerekçe test adında ve yorumda § ile yazılı.
 */
import { describe, expect, it } from 'vitest';
import { finalGosterisi, hamleHatasi, HamleHatasi, kilitliMi, onizle, rngInt, yolDogrula } from '../index';
import { cift, fitil, hucrede, kalip, kibrit, koruk, kur, patlamaAt, sec, uygula, yol } from './kur';

const BOS = ['. . . . .', '. . . . .', '. . . . .', '. . . . .'];
const UC = '0,5 1,5 2,5';

describe('uzlaştırma: puan', () => {
  it('§5 / §7.1 is temizleme toplam +30 (tek puanEklendi; §7.1 "kat 20 + kalkınca 50" uygulanmaz)', () => {
    // §5 tablosu is için özel değeri (+30) verir, §7.1 genel engel satırı
    // 20 + 50 = 70 yazar. Sözleşme sabiti (PUAN.isTemizle = 30) ve §5'in
    // öğeye özgü değeri esas alındı; tasarımcı onayı açık konu.
    const d = kur({ tahta: [...BOS, '. I . . .', 'R R R . .'] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(hucrede(olaylar, 'isTemizlendi', 1, 4)).toHaveLength(1);
    const isPuani = sec(olaylar, 'puanEklendi').filter((p) => p.hucre?.x === 1 && p.hucre?.y === 4);
    expect(isPuani).toMatchObject([{ miktar: 30, neden: 'diger' }]);
    expect(durum.puan).toBe(10 + 20 + 30 + 30);
  });

  it('§3.7 / §7.1 / §6.9 çift dokunulan özel taş: nesil 0, neden vurus, 15 puan ve R\'ye girer (fitil düğümü değil)', () => {
    const d = kur({ tahta: [...BOS, '. . . . .', '_ _ R- _ _'] });
    const { olaylar } = uygula(d, cift(2, 5));
    expect(patlamaAt(olaylar, 2, 5)).toMatchObject({ t: 0, neden: 'vurus', nesil: 0, puan: 15, ozel: 'roket', k: 0 });
    // Roket yatayda boş hücrelere vurur: R yalnız taşın kendisi.
    expect(sec(olaylar, 'reaksiyon')).toMatchObject([{ boyut: 1 }]);
  });

  it('§7.3 / §7.2 final reaksiyonu bonus almaz (kademe null) ve istatistiğe girmez', () => {
    const d = kur({ tahta: [...BOS, '. . . . .', 'R R R . .'], hamle: 12, hedefler: [{ tur: 'topla', renk: 0, adet: 3 }] });
    const kazanc = uygula(d, fitil(UC)).durum;
    const f = finalGosterisi(kazanc);
    expect(sec(f.olaylar, 'reaksiyon')).toMatchObject([{ kademe: null }]);
    expect(sec(f.olaylar, 'puanEklendi').filter((p) => p.neden === 'reaksiyon')).toEqual([]);
    expect(f.durum.istatistik.reaksiyonlar).toEqual(kazanc.istatistik.reaksiyonlar);
  });
});

describe('uzlaştırma: geçerlilik', () => {
  it('§3.4 kafesli özel taş kilidi açmaz ve çift dokunulamaz (kafes taşı sabitler, §2.2)', () => {
    // Desen: hiçbir 8-komşu aynı renk değil; tek özel taş kafesli.
    const d = kur({ tahta: ['R A Z G', 'Z G R A', 'R A Z G', 'Z G R A', 'R A C:Z- G'] });
    expect(kilitliMi(d)).toBe(true);
    expect(hamleHatasi(d, cift(2, 4))).toBe('ozelDegil');
    expect(() => uygula(d, cift(2, 4))).toThrow(HamleHatasi);
  });

  it('§3.4 + §3.3.7 caprazSiniri 1 iken yalnız çaprazla bağlı 3\'lü bileşen kilidi açmaz (oynanabilir yol yok)', () => {
    // (0,0)–(1,1)–(2,0) mor: bağlı 3'lü bileşen ama her yolu 2 çapraz adım.
    // §3.4'ün bileşen testi bunu kilitsiz sayar; sınır 1'de hamle yoktur.
    // Uzlaştırma: kilitliMi etkin çapraz sınırını gözetir (yoksa karıştırma
    // hiç yapılmaz ve oyun takılır).
    const tahta = ['M A M G', 'Z M R A', 'R A Z G', 'Z G R A'];
    expect(kilitliMi(kur({ tahta }))).toBe(false);
    expect(kilitliMi(kur({ tahta, kurallar: { caprazSiniri: 1 } }))).toBe(true);
    expect(kilitliMi(kur({ tahta, kurallar: { caprazSiniri: 2 } }))).toBe(false);
    // Bir dik adım eklenince (1,0) mor → (0,0)–(1,0)–(1,1) tek çaprazla geçerli.
    const acik = kur({ tahta: ['M M M G', 'Z M R A', 'R A Z G', 'Z G R A'], kurallar: { caprazSiniri: 1 } });
    expect(kilitliMi(acik)).toBe(false);
    expect(kilitliMi(kur({ tahta: ['M R M G', 'Z M R A', 'R A Z G', 'Z G R A'], kurallar: { caprazSiniri: 0 } }))).toBe(true);
  });

  it('§3.4 + §3.3.7 yalnizHalka ile caprazSiniri: döngünün yol adımları da sınırı aşmamalı', () => {
    // Mor elmas (1,0)–(0,1)–(1,2)–(2,1): bütün adımları çapraz; başka 4'lü döngü yok.
    const tahta = ['R M Z G', 'M G M A', 'R M Z G', 'Z G R A'];
    const elmas = yol('1,0 0,1 1,2 2,1');
    expect(kilitliMi(kur({ tahta, kurallar: { yalnizHalka: true } }))).toBe(false);
    const sinirli = kur({ tahta, kurallar: { yalnizHalka: true, caprazSiniri: 2 } });
    expect(yolDogrula(sinirli, elmas, true)).toBe('capraz');
    expect(kilitliMi(sinirli)).toBe(true);
    const genis = kur({ tahta, kurallar: { yalnizHalka: true, caprazSiniri: 3 } });
    expect(yolDogrula(genis, elmas, true)).toBeNull();
    expect(kilitliMi(genis)).toBe(false);
  });

  it('§3.3.4 geçersiz halka (|P| < 4 ya da son düğüm başa komşu değil) "komsu" hatası verir', () => {
    const d = kur({ tahta: [...BOS, 'R R . . .', 'R R R R .'] });
    expect(yolDogrula(d, yol('0,4 1,4 0,5'), true)).toBe('komsu');
    expect(yolDogrula(d, yol('0,5 1,5 2,5 3,5'), true)).toBe('komsu');
    expect(yolDogrula(d, yol('0,4 1,4 1,5 0,5'), true)).toBeNull();
  });

  it('§16.2 bozuk girdi (tamsayı olmayan konum) fırlatmadan reddedilir', () => {
    const d = kur({ tahta: [...BOS, '. . . . .', 'R R R . .'] });
    const bozuk = [{ x: 0.5, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }];
    expect(yolDogrula(d, bozuk, false)).toBe('zincirlenemez');
    expect(() => onizle(d, bozuk, false)).not.toThrow();
    expect(() => uygula(d, { tur: 'fitil', yol: bozuk, halka: false })).toThrow(HamleHatasi);
  });

  it('§9 bölüm başına en fazla 1 güçlendirici: ikinci kibrit/kalıp HamleHatasi (Geri Sar uygulamada)', () => {
    const d = kur({ tahta: [...BOS, '. G . . .', 'R R R . .'] });
    const bir = uygula(d, kibrit(4, 0)).durum;
    expect(bir.istatistik.guclendirici).toBe(1);
    expect(hamleHatasi(bir, kalip(1, 4, 0))).toBe('guclendiriciSiniri');
    expect(() => uygula(bir, kibrit(1, 4))).toThrow(HamleHatasi);
  });

  it('§6 körük merkezi tahta içinde ve delik olmayan bir hücre olmalı; dolu değilken kullanılamaz', () => {
    const d = kur({ tahta: [...BOS, '# . . . .', 'R R R . .'], korukKapasitesi: 3, korukDolum: 3 });
    expect(hamleHatasi(d, koruk(0, 4))).toBe('konum');
    expect(hamleHatasi(d, koruk(5, 0))).toBe('konum');
    expect(hamleHatasi(d, koruk(1, 4))).toBeNull();
    const yari = kur({ tahta: [...BOS, '. . . . .', 'R R R . .'], korukKapasitesi: 3, korukDolum: 2 });
    expect(hamleHatasi(yari, koruk(1, 4))).toBe('korukDoluDegil');
  });
});

describe('§16.3 RNG tüketim sırası', () => {
  it('§16.3 dolum (soldan sağa sütun) → is yayılması: aynı akıştan, bu sırayla', () => {
    // Kızıl üçlü alt satırda patlar: 0, 1, 2. sütunlara birer kapsül doğar
    // (3 çekim, ağırlıklar eşit → rngInt(5)). (4,0)'daki is temizlenmez;
    // adaylar (y, x) sırasıyla (3,0) ve (4,1) → rngInt(2) dördüncü çekimdir.
    const d = kur({
      tahta: ['. . . . I', '. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R R . .'],
      renkSayisi: 5,
      dolum: 4,
      dogumAgirliklari: [1, 1, 1, 1, 1],
    });
    const akis = { rng: d.rng };
    const renkler = [rngInt(akis, 5), rngInt(akis, 5), rngInt(akis, 5)];
    const isHucresi = [{ x: 3, y: 0 }, { x: 4, y: 1 }][rngInt(akis, 2)];
    const { olaylar, durum } = uygula(d, fitil(UC));
    const [y] = sec(olaylar, 'yercekimi');
    expect(y.doganlar.map((g) => [g.hucre.x, g.hucre.y, g.icerik.tur === 'kapsul' ? g.icerik.renk : -9])).toEqual([
      [0, 0, renkler[0]],
      [1, 0, renkler[1]],
      [2, 0, renkler[2]],
    ]);
    expect(sec(olaylar, 'isYayildi')).toMatchObject([{ hucre: isHucresi }]);
    expect(durum.rng).toBe(akis.rng);
  });
});
