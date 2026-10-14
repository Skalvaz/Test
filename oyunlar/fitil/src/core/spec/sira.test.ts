/**
 * §3.5.4 hamle sonu sırası ve olay zamanlaması, bölüm sonu (kazanç/kayıp),
 * §16.4 değişmezler: girdi değişmez (Object.freeze), belirlenimlilik,
 * bulanık oyun özellikleri.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, durumKarmasi, kilitliMi } from '../index';
import type { BolumVerisi, Hamle, OyunDurumu } from '../index';
import b001 from '../../levels/veri/b001.json';
import { adayYol, cift, derinDondur, fitil, kapsulSayisi, koruk, kur, patlamaHaritasi, sec, tAzalmayan, uygula } from './kur';

const UC = '0,5 1,5 2,5';
const BOS = ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .'];
const ilkIndeks = (ol: { tur: string }[], tur: string) => ol.findIndex((o) => o.tur === tur);

describe('§3.5.4 hamle sonu sırası', () => {
  it('§3.5.4 sıra: yerçekimi → fener toplama → is yayılması → hava olayı → reaksiyon', () => {
    const d = kur({
      tahta: ['. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .', '. F . . . K3', 'R R R . G I'],
      havaOlaylari: [{ tur: 'meltem', eksen: 'satir', hatlar: [3], periyot: 4, baslangic: 1 }],
    });
    const { olaylar } = uygula(d, fitil(UC));
    const y = ilkIndeks(olaylar, 'yercekimi');
    const f = ilkIndeks(olaylar, 'fenerToplandi');
    const i = ilkIndeks(olaylar, 'isYayildi');
    const h = ilkIndeks(olaylar, 'havaOlayi');
    const r = ilkIndeks(olaylar, 'reaksiyon');
    expect(y).toBeGreaterThanOrEqual(0);
    expect(f).toBeGreaterThan(y);
    expect(i).toBeGreaterThan(f);
    expect(h).toBeGreaterThan(i);
    expect(r).toBeGreaterThan(h);
    expect(sec(olaylar, 'reaksiyon')).toHaveLength(1);
    expect(tAzalmayan(olaylar)).toBe(true);
    // bütün patlamalar kuyruk içinde, ilk yerçekiminden önce
    const sonPatlama = olaylar.map((o) => o.tur).lastIndexOf('patlama');
    expect(sonPatlama).toBeLessThan(y);
    expect(olaylar[f].t).toBeGreaterThanOrEqual(olaylar[y].t);
  });

  it.each<[string, string[], Hamle]>([
    ['3 düğüm', [...BOS, 'R R R . .'], fitil(UC)],
    ['halka', [...BOS.slice(1), 'R R . . .', 'R R . . .'], fitil('0,4 1,4 1,5 0,5', true)],
    ['roket çift dokunuş', [...BOS, '. . R- . .'], cift(2, 5)],
    ['kasımpatı çift dokunuş', [...BOS.slice(0, 2), '. . R@ . .', ...BOS.slice(2)], cift(2, 2)],
    ['yıldız topu', [...BOS, 'R R * R R'], fitil(UC)],
  ])('§12.4 / types.ts olaylar t\'ye göre azalmayan sırada (%s)', (_ad, tahta, hamle) => {
    const { olaylar } = uygula(kur({ tahta }), hamle);
    expect(olaylar.length).toBeGreaterThan(0);
    expect(tAzalmayan(olaylar)).toBe(true);
    expect(olaylar[0].t).toBe(0);
  });

  it('§3.5.4.6 bütün hedefler tamamsa bitti = kazanc ve bolumBitti olayı', () => {
    const d = kur({ tahta: [...BOS, 'R R R . .'], hedefler: [{ tur: 'topla', renk: 0, adet: 3 }] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(durum.bitti).toBe('kazanc');
    expect(sec(olaylar, 'bolumBitti')).toMatchObject([{ sonuc: 'kazanc' }]);
  });

  it('§3.5.4.6 hedef tamam değil ve kalan hamle 0 → bitti = kayip', () => {
    const d = kur({ tahta: [...BOS, 'R R R . .'], hamle: 1, hedefler: [{ tur: 'topla', renk: 0, adet: 30 }] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(durum.kalanHamle).toBe(0);
    expect(durum.bitti).toBe('kayip');
    expect(sec(olaylar, 'bolumBitti')).toMatchObject([{ sonuc: 'kayip' }]);
  });

  it('§3.5.4.6 son hamlede hedef tamamlanırsa kazanç (kayıptan önce denetlenir)', () => {
    const d = kur({ tahta: [...BOS, 'R R R . .'], hamle: 1, hedefler: [{ tur: 'topla', renk: 0, adet: 3 }] });
    const { durum } = uygula(d, fitil(UC));
    expect(durum.bitti).toBe('kazanc');
  });

  it('§3.5.4 bölüm sürerken bolumBitti olayı yok, bitti null', () => {
    const { olaylar, durum } = uygula(kur({ tahta: [...BOS, 'R R R . .'] }), fitil(UC));
    expect(durum.bitti).toBeNull();
    expect(sec(olaylar, 'bolumBitti')).toEqual([]);
  });

  it('§3.1 fitil ve çift dokunuş 1 hamle harcar', () => {
    const d = kur({ tahta: [...BOS, 'R R R- . .'], hamle: 7 });
    expect(uygula(d, fitil(UC)).durum.kalanHamle).toBe(6);
    expect(uygula(d, cift(2, 5)).durum.kalanHamle).toBe(6);
  });
});

describe('§16.4 değişmezler', () => {
  const HAMLELER: [string, () => OyunDurumu, Hamle][] = [
    ['fitil', () => kur({ tahta: [...BOS, 'R R R . .'] }), fitil(UC)],
    ['halka', () => kur({ tahta: [...BOS.slice(1), 'R R . . .', 'R R . . .'] }), fitil('0,4 1,4 1,5 0,5', true)],
    ['çift dokunuş', () => kur({ tahta: [...BOS, '. . R@ . .'] }), cift(2, 5)],
    ['körük', () => kur({ tahta: [...BOS, 'R R R . .'], korukKapasitesi: 3, korukDolum: 3 }), koruk(2, 2)],
  ];

  it.each(HAMLELER)('§3.5 / §16.4 hamleUygula girdiyi değiştirmez (derin Object.freeze, %s)', (_ad, yap, hamle) => {
    const d = yap();
    const once = JSON.stringify(d);
    const hOnce = JSON.stringify(hamle);
    const sonuc = uygula(derinDondur(d), derinDondur(hamle));
    expect(JSON.stringify(d)).toBe(once);
    expect(JSON.stringify(hamle)).toBe(hOnce);
    expect(sonuc.durum).not.toBe(d);
  });

  it.each(HAMLELER)('§16.3 belirlenimlilik: aynı girdi aynı durumKarmasi ve aynı olaylar (%s)', (_ad, yap, hamle) => {
    const a = uygula(yap(), hamle);
    const b = uygula(yap(), hamle);
    expect(durumKarmasi(a.durum)).toBe(durumKarmasi(b.durum));
    expect(JSON.stringify(a.olaylar)).toBe(JSON.stringify(b.olaylar));
  });

  it('§0 K15 çözümleme denemeden bağımsızdır: farklı denemede yerçekimine kadarki olaylar aynı', () => {
    const tahta = [...BOS, 'R R R . .'];
    const a = uygula(kur({ tahta, denemeNo: 0, renkSayisi: 5, dogumAgirliklari: [1, 1, 1, 1, 1] }), fitil(UC));
    const b = uygula(kur({ tahta, denemeNo: 3, renkSayisi: 5, dogumAgirliklari: [1, 1, 1, 1, 1] }), fitil(UC));
    const kes = (ol: typeof a.olaylar) => JSON.stringify(ol.slice(0, ilkIndeks(ol, 'yercekimi')));
    expect(kes(a.olaylar)).toBe(kes(b.olaylar));
  });

  /** Engel ve zemin çeşitliliği olan 7×9 bulanık tahta. */
  const BULANIK = {
    tahta: [
      'R A Z G M R A',
      'Z G C:M R A Z G',
      'G M R W:A Z G M',
      'K1 R A Z G I R',
      'A Z G M R A Z',
      'M R S1 A Z G M',
      'R A Z G # R A',
      'Z G M R A K2 G',
      'G D3 R A Z G F',
    ],
    zemin: [
      '. . . . . . .',
      '. . . . . . .',
      '. 1 1 . . . .',
      '. . . . dR . .',
      'i0 i1 i2 . . . .',
      '. . . . . . .',
      '. . . . . 2 .',
      '. . . . . . .',
      '. . . . . . .',
    ],
    renkSayisi: 5,
    dogumAgirliklari: [1, 1, 1, 1, 1],
    hamle: 30,
    korukKapasitesi: 5,
    havaOlaylari: [{ tur: 'meltem' as const, eksen: 'satir' as const, hatlar: [2, 6], periyot: 3, baslangic: 2 }],
  };

  it.each([
    ['bölüm 1', 1],
    ['bölüm 1', 2],
    ['bulanık 7×9', 3],
    ['bulanık 7×9', 4],
  ])('§16.4 özellikler (%s, tohum %i): tek patlama/hücre, t sırası, dolu yuvalar, kapsül korunumu, kilitsizlik', (ad, tohum) => {
    let d: OyunDurumu = ad === 'bölüm 1' ? bolumuYukle(b001 as unknown as BolumVerisi, tohum) : kur({ ...BULANIK, denemeNo: tohum });
    let oynanan = 0;
    for (let n = 0; n < 12 && d.bitti === null; n++) {
      const yolu = adayYol(d, tohum * 31 + n);
      if (!yolu) break;
      oynanan++;
      const once = d;
      const { durum, olaylar } = uygula(once, { tur: 'fitil', yol: yolu, halka: false });
      expect(() => patlamaHaritasi(olaylar)).not.toThrow();
      expect(tAzalmayan(olaylar)).toBe(true);
      expect(durum.kalanHamle).toBe(once.kalanHamle - 1);
      expect(durum.hucreler.every((c) => c.delik || c.icerik !== null)).toBe(true);
      if (durum.bitti === null) expect(kilitliMi(durum)).toBe(false);
      // kapsül korunumu: sonra = önce − patlayan + doğan + kuruyan − ise dönen
      const dogan = sec(olaylar, 'yercekimi')
        .flatMap((y) => y.doganlar)
        .filter((g) => g.icerik.tur === 'kapsul').length;
      const beklenen = kapsulSayisi(once) - sec(olaylar, 'patlama').length + dogan + sec(olaylar, 'kurudu').length - sec(olaylar, 'isYayildi').length;
      expect(kapsulSayisi(durum)).toBe(beklenen);
      // belirlenimlilik
      expect(durumKarmasi(uygula(once, { tur: 'fitil', yol: yolu, halka: false }).durum)).toBe(durumKarmasi(durum));
      d = durum;
    }
    expect(oynanan).toBeGreaterThan(0);
  });
});
