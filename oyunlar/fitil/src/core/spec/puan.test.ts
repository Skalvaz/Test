/**
 * §7.1 taban puanlar, §7.2 reaksiyon bonusu (yalnız en yüksek kademe).
 * §7.4 yıldızlar: yildizHesapla API'si P1'e bağlı — bkz. en alttaki todo.
 */
import { describe, expect, it } from 'vitest';
import { fitil, kur, reaksiyonBonusu, sec, uygula } from './kur';

const UC = '0,5 1,5 2,5';
const BOS = ['. . . . .', '. . . . .', '. . . . .', '. . . . .'];

describe('§7.1 taban puanlar', () => {
  it('§7.1 fitil düğümü 10·k: 6 düğüm toplamı 5·n·(n+1) = 210 (özel kapalı)', () => {
    const d = kur({ tahta: ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R R R R R G'], ozelEsikleri: [0, 0, 0] });
    const { olaylar, durum } = uygula(d, fitil('0,5 1,5 2,5 3,5 4,5 5,5'));
    expect(sec(olaylar, 'patlama').map((p) => p.puan)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(durum.puan).toBe(210);
  });

  const UZUN = ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R R R R R R', 'R R R R R R R'];
  const UZUN_YOL = ['0,5', '1,5', '2,5', '3,5', '4,5', '5,5', '6,5', '6,4', '5,4', '4,4', '3,4', '2,4'];

  it('§7.1 12 düğüm toplamı 780 (özel kapalı)', () => {
    const { durum } = uygula(kur({ tahta: UZUN, ozelEsikleri: [0, 0, 0] }), fitil(UZUN_YOL.join(' ')));
    expect(durum.puan).toBe(780);
  });

  it.each([
    [6, 'roket', 5 * 5 * 6 + 60],
    [9, 'kasimpati', 5 * 8 * 9 + 120],
    [12, 'yildiz', 5 * 11 * 12 + 200],
  ] as const)('§7.1 %i düğüm → %s oluşumu: patlayan düğümler + oluşum puanı = %i', (n, ozel, beklenen) => {
    const { olaylar, durum } = uygula(kur({ tahta: UZUN }), fitil(UZUN_YOL.slice(0, n).join(' ')));
    expect(sec(olaylar, 'ozelOlustu')).toMatchObject([{ ozel }]);
    expect(durum.puan).toBe(beklenen);
  });

  it('§7.1 ısı patlaması 20·g (nesil 1 → 20, nesil 2 → 40)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. G3 . . .', '. G3 . . .', 'R R R . .'] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    const isi = sec(olaylar, 'patlama').filter((p) => p.neden === 'isi');
    expect(isi.map((p) => [p.nesil, p.puan])).toEqual([
      [1, 20],
      [2, 40],
    ]);
    expect(durum.puan).toBe(60 + 20 + 40);
  });

  it('§7.1 halka kapatma +100 (puanEklendi neden halka)', () => {
    const d = kur({ tahta: [...BOS, 'R R . . .', 'R R . . .'] });
    const { olaylar, durum } = uygula(d, fitil('0,4 1,4 1,5 0,5', true));
    expect(sec(olaylar, 'puanEklendi').filter((p) => p.neden === 'halka')).toMatchObject([{ miktar: 100 }]);
    expect(durum.puan).toBe(10 + 20 + 30 + 40 + 100);
  });

  const bitisik = (hedef: string) => [...BOS, `. ${hedef} . . .`, 'R R R . .'];
  it.each([
    ['kaya 1 kat hasar (K2)', bitisik('K2'), undefined, 60 + 20],
    ['kaya yok oluşu (K1: 20 + 50)', bitisik('K1'), undefined, 60 + 20 + 50],
    ['kova 1 kat hasar (S)', bitisik('S'), undefined, 60 + 20],
    ['kova yok oluşu (S1: 20 + 50)', bitisik('S1'), undefined, 60 + 20 + 50],
    ['kafes kırılması (ısı patlaması 20 + kafes 50)', bitisik('C:G3'), undefined, 60 + 20 + 50],
    ['döşeme katı (2 × 20)', [...BOS, '. . . . .', 'R R R . .'], [...BOS, '. . . . .', '1 2 . . .'], 60 + 40],
    ['desen boyanması (2 × 40)', [...BOS, '. . . . .', 'R R R . .'], [...BOS, '. . . . .', 'dR dR . . .'], 60 + 80],
    ['fener toplama (200)', bitisik('F'), undefined, 60 + 200],
  ])('§7.1 %s', (_ad, tahta, zemin, beklenen) => {
    const { durum } = uygula(kur({ tahta, zemin }), fitil(UC));
    expect(durum.puan).toBe(beklenen);
  });

  it('§7.1 dev fişek ateşlenmesi 300 + vuruşla patlayanlar 15\'er', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', 'R . . . .', 'R . . . .', 'R D2:1 . . .'] });
    const { durum } = uygula(d, fitil('0,5 0,4 0,3'));
    expect(durum.puan).toBe(60 + 5 * 15 + 300);
  });
});

/**
 * 8×6 tahta: yol (0,5) R → (1,5) R → (2,5) yıldız topu. Zincir rengi kızıl;
 * yıldız topu bütün diğer kızılları vurur → R = ek kızıl sayısı. Eşik 5:
 * hiçbir hücre 4'ten fazla komşu patlaması görmez, ısı patlaması karışmaz.
 */
function reaksiyonTahtasi(R: number): string[] {
  let kalan = R;
  const h: string[][] = Array.from({ length: 6 }, () => Array(8).fill(''));
  for (let y = 5; y >= 0; y--) {
    for (let x = 0; x < 8; x++) {
      if (y === 5 && x <= 1) h[y][x] = 'R';
      else if (y === 5 && x === 2) h[y][x] = '*';
      else if (kalan > 0) {
        h[y][x] = 'R';
        kalan--;
      } else h[y][x] = (x + y) % 2 ? 'G' : 'A';
    }
  }
  return h.map((r) => r.join(' '));
}

describe('§7.2 reaksiyon bonusu', () => {
  it.each([7, 8, 14, 15, 24, 25, 39, 40, 45])('§7.2 R = %i: yalnız en yüksek kademe verilir', (R) => {
    const { olaylar, durum } = uygula(kur({ esik: 5, tahta: reaksiyonTahtasi(R) }), fitil(UC));
    const { kademe, bonus } = reaksiyonBonusu(R);
    expect(sec(olaylar, 'reaksiyon')).toMatchObject([{ boyut: R, kademe, kombo: false }]);
    const rp = sec(olaylar, 'puanEklendi').filter((p) => p.neden === 'reaksiyon');
    if (bonus > 0) expect(rp).toMatchObject([{ miktar: bonus, kademe }]);
    else expect(rp).toEqual([]);
    expect(durum.puan).toBe(60 + 15 * R + bonus);
  });

  it('§7.2 / §6.9 R yalnız fitil düğümü olmayan KAPSÜL patlamalarını sayar (engel hasarı sayılmaz)', () => {
    const d = kur({ tahta: [...BOS, 'K3 K3 K3 . .', 'R R R . .'] });
    const { olaylar } = uygula(d, fitil(UC));
    expect(sec(olaylar, 'reaksiyon')).toMatchObject([{ boyut: 0, kademe: null }]);
  });

  it('§16.2 istatistik: hamlenin reaksiyon boyutu kaydedilir', () => {
    const { durum } = uygula(kur({ esik: 5, tahta: reaksiyonTahtasi(9) }), fitil(UC));
    expect(durum.istatistik.reaksiyonlar).toEqual([9]);
    expect(durum.istatistik.enBuyukReaksiyon).toBe(9);
  });
});

describe('§7.4 yıldızlar', () => {
  // §7.4 yıldız sınırları (güçlendirici → en fazla 2★, Kıvılcım Usta'nın Eli → en fazla 1★)
  // yildizHesapla API'si P1'e bağlı; çekirdek index.ts'te henüz yok.
  it.todo('§7.4 güçlendirici kullanılırsa en fazla 2★ (yildizHesapla P1)');
  it.todo("§7.4 Kıvılcım Usta'nın Eli kullanılırsa en fazla 1★ (yildizHesapla P1)");
  it.todo('§7.4 hedefler tamam değilse 0★, tamamsa en az 1★ (yildizHesapla P1)');
});
