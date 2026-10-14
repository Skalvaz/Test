/**
 * §4.1 özel taş oluşumu, §4.2 etkiler (hücre kümeleri ve zamanları),
 * §4.3 tetiklenme yolları.
 */
import { describe, expect, it } from 'vitest';
import type { Eksen } from '../index';
import { anahtar, cift, fitil, fitilZamanlari, hucrede, ic, konumlar, kur, patlamaAt, patlamaHaritasi, sec, uygula, yol } from './kur';

const ALTI = ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R R R R R G'];
const ALTI_YOL = '0,5 1,5 2,5 3,5 4,5 5,5';

describe('§4.1 özel taş oluşumu', () => {
  it('§4.1 6 düğüm, son segment yatay → son düğüm roket (eksen 0), patlamaz, ısı 0', () => {
    const { olaylar, durum } = uygula(kur({ tahta: ALTI }), fitil(ALTI_YOL));
    expect(sec(olaylar, 'ozelOlustu')).toMatchObject([{ t: 445, hucre: { x: 5, y: 5 }, ozel: 'roket', eksen: 0, renk: 0 }]);
    expect(patlamaAt(olaylar, 5, 5)).toBeUndefined();
    expect(sec(olaylar, 'patlama')).toHaveLength(5);
    expect(sec(olaylar, 'dugumYandi').map((o) => o.k)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ic(durum, 5, 5)).toEqual({ tur: 'kapsul', renk: 0, isi: 0, ozel: 'roket', eksen: 0 });
  });

  const EKSEN_TAHTASI = ['. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R R R R R .', 'R R R R R R .', 'R R R R R R .'];
  it.each([
    ['5,4', 0, 'dy = 0'],
    ['4,5', 1, 'dx = 0 (aşağı)'],
    ['4,3', 1, 'dx = 0 (yukarı)'],
    ['5,3', 2, 'dx·dy < 0 (↗)'],
    ['3,5', 2, 'dx·dy < 0 (↙)'],
    ['5,5', 3, 'dx·dy > 0 (↘)'],
    ['3,3', 3, 'dx·dy > 0 (↖)'],
  ] as const)('§2.3 roket ekseni son segmentten: son düğüm %s → eksen %i (%s)', (son, eksen, _aciklama) => {
    const { olaylar } = uygula(kur({ tahta: EKSEN_TAHTASI }), fitil(`0,4 1,4 2,4 3,4 4,4 ${son}`));
    const [x, y] = son.split(',').map(Number);
    expect(sec(olaylar, 'ozelOlustu')).toMatchObject([{ hucre: { x, y }, ozel: 'roket', eksen }]);
  });

  const UZUN = ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R R R R R R', 'R R R R R R R'];
  const UZUN_YOL = yol('0,5 1,5 2,5 3,5 4,5 5,5 6,5 6,4 5,4 4,4 3,4 2,4');
  const uzunYol = (n: number) => UZUN_YOL.slice(0, n).map(anahtar).join(' ');

  it.each([
    [8, 'roket'],
    [9, 'kasimpati'],
    [11, 'kasimpati'],
    [12, 'yildiz'],
  ] as const)('§4.1 %i düğüm → %s (eşikler 6/9/12)', (n, ozel) => {
    const { olaylar, durum } = uygula(kur({ tahta: UZUN }), fitil(uzunYol(n)));
    const son = UZUN_YOL[n - 1];
    const t = fitilZamanlari(n)[n - 1];
    expect(sec(olaylar, 'ozelOlustu')).toMatchObject([{ t, hucre: son, ozel }]);
    expect(sec(olaylar, 'patlama')).toHaveLength(n - 1);
    // dönüşen taş hareketlidir: altındaki (x,5) patladığı için oraya düşer.
    expect(ic(durum, son.x, 5)).toMatchObject({ tur: 'kapsul', ozel, isi: 0, renk: ozel === 'yildiz' ? -1 : 0 });
  });

  it('§4.1 ozelEsikleri [0,0,0] (bölüm 1): 12 düğümde bile dönüşüm yok, 12 patlama', () => {
    const { olaylar } = uygula(kur({ tahta: UZUN, ozelEsikleri: [0, 0, 0] }), fitil(uzunYol(12)));
    expect(sec(olaylar, 'ozelOlustu')).toEqual([]);
    expect(sec(olaylar, 'patlama')).toHaveLength(12);
    expect(patlamaAt(olaylar, 2, 4)).toMatchObject({ t: 750, neden: 'fitil', k: 12 });
  });

  it('§4.1 0 değeri o türü kapatır: [6,0,0]\'da 9 düğüm roket, [6,9,0]\'da 12 düğüm kasımpatı', () => {
    // §4.1 belirsiz: kapalı türün aralığında, açık en yüksek eşiğin türü oluşur diye okundu
    // (bölüm 2–5'te uzun zincir roket verir; daha uzun zincir daha az ödül almaz).
    const a = uygula(kur({ tahta: UZUN, ozelEsikleri: [6, 0, 0] }), fitil(uzunYol(9)));
    expect(sec(a.olaylar, 'ozelOlustu')).toMatchObject([{ ozel: 'roket' }]);
    const b = uygula(kur({ tahta: UZUN, ozelEsikleri: [6, 9, 0] }), fitil(uzunYol(12)));
    expect(sec(b.olaylar, 'ozelOlustu')).toMatchObject([{ ozel: 'kasimpati' }]);
  });

  it('§4.1 halka özel taş üretmez (6 düğümlü halka: 6 patlama)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R R . .', 'R R R . .'] });
    const { olaylar } = uygula(d, fitil('0,4 1,4 2,4 2,5 1,5 0,5', true));
    expect(sec(olaylar, 'ozelOlustu')).toEqual([]);
    expect(sec(olaylar, 'patlama')).toHaveLength(6);
  });

  it('§4.1 son düğüm zaten özelse dönüşüm yok; taş normal biçimde tetiklenir', () => {
    const tahta = [...ALTI.slice(0, 5), 'R R R R R R| G'];
    const { olaylar } = uygula(kur({ tahta }), fitil(ALTI_YOL));
    expect(sec(olaylar, 'ozelOlustu')).toEqual([]);
    expect(patlamaAt(olaylar, 5, 5)).toMatchObject({ t: 445, neden: 'fitil', k: 6, ozel: 'roket' });
    expect(hucrede(olaylar, 'ozelTetiklendi', 5, 5)).toMatchObject([{ t: 445, ozel: 'roket', eksen: 1 }]);
    [470, 495, 520, 545, 570].forEach((t, i) => {
      expect(patlamaAt(olaylar, 5, 4 - i)).toMatchObject({ t, neden: 'vurus' });
    });
  });

  it('§3.5.2 DONUSUM ısı vermez, hasar vermez, döşemeyi söndürmez, hedefe sayılmaz; ısısı 0 olur', () => {
    const d = kur({
      tahta: ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . G3 .', 'R R R R R R2 K1'],
      zemin: ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . 1 .'],
      hedefler: [{ tur: 'topla', renk: 0, adet: 50 }, { tur: 'aydinlat' }],
    });
    const { olaylar, durum } = uygula(d, fitil(ALTI_YOL));
    expect(hucrede(olaylar, 'isindi', 5, 4)).toEqual([]);
    expect(patlamaAt(olaylar, 5, 4)).toBeUndefined();
    expect(hucrede(olaylar, 'engelHasar', 6, 5)).toEqual([]);
    expect(hucrede(olaylar, 'dosemeAydinlandi', 5, 5)).toEqual([]);
    expect(durum.hedefler[0].ilerleme).toBe(5);
    expect(durum.hedefler[1]).toMatchObject({ ilerleme: 0, gerekli: 1 });
    expect(ic(durum, 5, 5)).toMatchObject({ ozel: 'roket', isi: 0 });
    expect(ic(durum, 5, 4)).toMatchObject({ renk: 3, isi: 3 });
    expect(ic(durum, 6, 5)).toEqual({ tur: 'kaya', kat: 1 });
  });

  it('§3.5.2 DONUSUM patladi sayılır: aynı hamlede sonraki ısı patlaması ona ısı veremez', () => {
    // (4,4) t=370'te eşiğe → 460'ta patlar → (5,4) 550'de patlar ve yeni rokete komşu.
    const d = kur({ tahta: ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . G3 G3 .', 'R R R R R R .'] });
    const { olaylar, durum } = uygula(d, fitil(ALTI_YOL));
    expect(patlamaAt(olaylar, 4, 4)).toMatchObject({ t: 460, nesil: 1 });
    expect(patlamaAt(olaylar, 5, 4)).toMatchObject({ t: 550, nesil: 2 });
    expect(hucrede(olaylar, 'isindi', 5, 5)).toEqual([]);
    expect(patlamaAt(olaylar, 5, 5)).toBeUndefined();
    expect(ic(durum, 5, 5)).toMatchObject({ ozel: 'roket', isi: 0 });
  });
});

// ── §4.2 etkiler ────────────────────────────────────────────────────────

/** 7×7 dolgu tahtası; (3,3) merkezde `merkez` simgesi, isteğe bağlı ek hücreler. */
function yediTahta(merkez: string, ek: Record<string, string> = {}): string[] {
  return Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => ek[`${x},${y}`] ?? (x === 3 && y === 3 ? merkez : '.')).join(' '),
  );
}

const ROKET_VURUSLARI: Record<Eksen, Record<string, number>> = {
  0: { '2,3': 25, '4,3': 25, '1,3': 50, '5,3': 50, '0,3': 75, '6,3': 75 },
  1: { '3,2': 25, '3,4': 25, '3,1': 50, '3,5': 50, '3,0': 75, '3,6': 75 },
  2: { '4,2': 25, '2,4': 25, '5,1': 50, '1,5': 50, '6,0': 75, '0,6': 75 },
  3: { '4,4': 25, '2,2': 25, '5,5': 50, '1,1': 50, '6,6': 75, '0,0': 75 },
};
const EKSEN_SIMGE = ['R-', 'R|', 'R/', 'R\\'];

describe('§4.2 etkiler', () => {
  it.each([0, 1, 2, 3] as const)('§4.2 roket eksen %i: iki yönde kenara dek, d. hücre T + 25·d anında VURUŞ', (eksen) => {
    const { olaylar } = uygula(kur({ tahta: yediTahta(EKSEN_SIMGE[eksen]) }), cift(3, 3));
    expect(hucrede(olaylar, 'ozelTetiklendi', 3, 3)).toMatchObject([{ t: 0, ozel: 'roket', eksen }]);
    const m = patlamaHaritasi(olaylar);
    const beklenen = ROKET_VURUSLARI[eksen];
    expect([...m.keys()].sort()).toEqual([...Object.keys(beklenen), '3,3'].sort());
    for (const [k, t] of Object.entries(beklenen)) {
      expect(m.get(k), k).toMatchObject({ t, neden: 'vurus', nesil: 0, puan: 15 });
    }
    expect(m.get('3,3')).toMatchObject({ t: 0, nesil: 0, ozel: 'roket' });
  });

  it('§4.2 roket delikleri atlar, d geometrik uzaklıktır (delikten sonraki hücre T + 75)', () => {
    // §4.2 belirsiz: "Delikler atlanır" — delik VURUŞ almaz ama roket üzerinden sabit hızla
    // geçer (§2.1 "roket üzerinden geçer"), d sayılmaya devam eder diye okundu.
    const { olaylar } = uygula(kur({ tahta: yediTahta('R-', { '5,3': '#' }) }), cift(3, 3));
    const m = patlamaHaritasi(olaylar);
    expect(m.has('5,3')).toBe(false);
    expect(m.get('4,3')).toMatchObject({ t: 25 });
    expect(m.get('6,3')).toMatchObject({ t: 75, neden: 'vurus' });
  });

  it('§4.2 roket engele hasar verir ve yoluna devam eder', () => {
    // (1,3) K3: t=25 bitişik ((2,3) patladı), t=50 vuruş, t=75 bitişik ((0,3) patladı).
    const { olaylar, durum } = uygula(kur({ tahta: yediTahta('R-', { '1,3': 'K3' }) }), cift(3, 3));
    expect(hucrede(olaylar, 'engelHasar', 1, 3)).toMatchObject([
      { t: 25, engel: 'kaya', kalan: 2 },
      { t: 50, engel: 'kaya', kalan: 1 },
      { t: 75, engel: 'kaya', kalan: 0 },
    ]);
    expect(patlamaAt(olaylar, 0, 3)).toMatchObject({ t: 75, neden: 'vurus' });
    expect(durum.hucreler.some((c) => c.icerik?.tur === 'kaya')).toBe(false);
  });

  it('§4.2 kasımpatı: Chebyshev 1 halkasındaki 8 hücre T + 30 VURUŞ, başka patlama yok', () => {
    const { olaylar } = uygula(kur({ tahta: yediTahta('R@') }), cift(3, 3));
    const m = patlamaHaritasi(olaylar);
    const halka1 = konumlar({ w: 7, h: 7 }).filter((p) => Math.max(Math.abs(p.x - 3), Math.abs(p.y - 3)) === 1);
    expect(halka1).toHaveLength(8);
    expect([...m.keys()].sort()).toEqual([...halka1.map(anahtar), '3,3'].sort());
    for (const p of halka1) expect(m.get(anahtar(p))).toMatchObject({ t: 30, neden: 'vurus', nesil: 0, puan: 15 });
    expect(hucrede(olaylar, 'ozelTetiklendi', 3, 3)).toMatchObject([{ t: 0, ozel: 'kasimpati' }]);
  });

  it('§4.2 kasımpatı: Chebyshev 2 halkasındaki 16 hücre T + 60 ISI_DALGASI (+1 ısı)', () => {
    const { olaylar } = uygula(kur({ tahta: yediTahta('R@') }), cift(3, 3));
    const halka2 = konumlar({ w: 7, h: 7 }).filter((p) => Math.max(Math.abs(p.x - 3), Math.abs(p.y - 3)) === 2);
    expect(halka2).toHaveLength(16);
    for (const p of halka2) {
      expect(hucrede(olaylar, 'isindi', p.x, p.y).some((o) => o.t === 60), anahtar(p)).toBe(true);
    }
    // köşe (5,5): yalnız dalgadan +1; kenar ortası (5,3): (4,3) t=30 + dalga → 2
    expect(hucrede(olaylar, 'isindi', 5, 5)).toMatchObject([{ t: 60, isi: 1 }]);
    expect(hucrede(olaylar, 'isindi', 5, 3)).toMatchObject([{ t: 30, isi: 1 }, { t: 60, isi: 2 }]);
  });

  it('§4.2 kasımpatı ısı dalgası engellere hasar vermez', () => {
    // (5,5) halka 2 köşesi: dik komşularında patlama yok, yalnız dalga gelir.
    const { olaylar, durum } = uygula(kur({ tahta: yediTahta('R@', { '5,5': 'K1' }) }), cift(3, 3));
    expect(hucrede(olaylar, 'engelHasar', 5, 5)).toEqual([]);
    expect(ic(durum, 5, 5)).toEqual({ tur: 'kaya', kat: 1 });
  });

  it('§4.2 kasımpatı ısı dalgasında kalkan geçerlidir', () => {
    // (6,3) kova → (5,3) kalkanlı: ne (4,3) patlamasından ne dalgadan ısı alır.
    const { olaylar } = uygula(kur({ tahta: yediTahta('R@', { '6,3': 'S' }) }), cift(3, 3));
    expect(hucrede(olaylar, 'isindi', 5, 3)).toEqual([]);
  });

  it('§4.2 yıldız topu: hedef renkteki planlı olmayan kapsüller (dx²+dy², y, x) sırasıyla T + 20·(i+1) (kafesli dahil)', () => {
    const d = kur({
      esik: 5,
      tahta: [
        'R . . . . . .',
        '. . . R . . .',
        '. . . . R . .',
        '. R . * . C:R .',
        '. . R R . . .',
        '. . . R . . .',
        '. . . . . . .',
      ],
    });
    const { olaylar } = uygula(d, fitil('3,5 3,4 3,3'));
    expect(hucrede(olaylar, 'ozelTetiklendi', 3, 3)).toMatchObject([{ t: 199, ozel: 'yildiz', hedefRenk: 0 }]);
    const sira = ['4,2', '2,4', '3,1', '1,3', '5,3', '0,0'];
    const m = patlamaHaritasi(olaylar);
    sira.forEach((k, i) => expect(m.get(k), k).toMatchObject({ t: 199 + 20 * (i + 1), neden: 'vurus', renk: 0 }));
    expect(hucrede(olaylar, 'kafesKirildi', 5, 3)).toMatchObject([{ t: 299 }]);
    expect(m.size).toBe(9);
  });

  it('§4.2 yıldız topu zincir dışından tetiklenince hedef renk o hamlenin zincir rengidir', () => {
    const d = kur({
      esik: 5,
      tahta: ['G R R R R R G', 'R R R R R R R', 'R R R R R R R', 'R R R R R R R', 'R R R R R R R', 'G G G- . * . .'],
    });
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5'));
    expect(hucrede(olaylar, 'ozelTetiklendi', 4, 5)).toMatchObject([{ t: 249, ozel: 'yildiz', hedefRenk: 3 }]);
    expect(patlamaAt(olaylar, 4, 5)).toMatchObject({ t: 249, neden: 'vurus', nesil: 0 });
    // (6,0): 2²+5² = 29 < (0,0): 4²+5² = 41
    expect(patlamaAt(olaylar, 6, 0)).toMatchObject({ t: 269, renk: 3 });
    expect(patlamaAt(olaylar, 0, 0)).toMatchObject({ t: 289, renk: 3 });
  });

  /** 5×6: (2,2) yıldız, (4,5) kaya; kalan 28 hücrenin ilk `g` tanesi gök, gerisi kehribar. */
  function cogunlukTahtasi(g: number): string[] {
    let n = 0;
    return Array.from({ length: 6 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => {
        if (x === 2 && y === 2) return '*';
        if (x === 4 && y === 5) return 'K3';
        return n++ < g ? 'G' : 'A';
      }).join(' '),
    );
  }

  it.each([
    [15, 3, 15, 'gök çoğunlukta'],
    [14, 1, 14, 'eşitlik → küçük indeks (kehribar)'],
  ])('§4.2 yıldız topu çift dokunuşta tahtada en çok bulunan renge gider (%i gök → %i, %s)', (g, hedef, adet) => {
    const { olaylar } = uygula(kur({ esik: 5, tahta: cogunlukTahtasi(g) }), cift(2, 2));
    expect(hucrede(olaylar, 'ozelTetiklendi', 2, 2)).toMatchObject([{ t: 0, ozel: 'yildiz', hedefRenk: hedef }]);
    expect(sec(olaylar, 'patlama').filter((p) => p.renk === hedef)).toHaveLength(adet);
  });
});

// ── §4.3 tetiklenme ─────────────────────────────────────────────────────

describe('§4.3 tetiklenme yolları', () => {
  it('§4.3.4 çift dokunuş: 1 hamle, t = 0, nesil 0', () => {
    const d = kur({ tahta: yediTahta('R-'), hamle: 10 });
    const { olaylar, durum } = uygula(d, cift(3, 3));
    expect(durum.kalanHamle).toBe(9);
    expect(patlamaAt(olaylar, 3, 3)).toMatchObject({ t: 0, nesil: 0 });
    expect(Math.min(...olaylar.map((o) => o.t))).toBe(0);
  });

  it('§4.3.2 ısısı eşiğe ulaşan özel taş tetiklenir (özel taşlar da ısınır)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. G3@ . . .', 'R R R . .'] });
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5'));
    expect(hucrede(olaylar, 'ozelTetiklendi', 1, 4)).toMatchObject([{ t: 193, ozel: 'kasimpati' }]);
    expect(patlamaAt(olaylar, 1, 3)).toMatchObject({ t: 223, neden: 'vurus', nesil: 1 });
  });

  it('§4.3 zincir dışındaki tetiklemeler birleşmez, her biri kendi etkisini uygular', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R R- G| G|'] });
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5'));
    expect(sec(olaylar, 'kombinasyon')).toEqual([]);
    expect(sec(olaylar, 'ozelTetiklendi').map((o) => [anahtar(o.hucre), o.t])).toEqual([
      ['2,5', 199],
      ['3,5', 224],
      ['4,5', 249],
    ]);
    expect(patlamaAt(olaylar, 3, 4)).toMatchObject({ t: 249, neden: 'vurus' });
    expect(patlamaAt(olaylar, 4, 4)).toMatchObject({ t: 274, neden: 'vurus' });
  });
});

