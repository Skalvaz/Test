/**
 * §3.5.3 vuruş tablosu (bağlayıcı) — her satırın "Bitişik patlama" ve
 * "Vuruş" sütunları ayrı ayrı; "Isı alır mı" sütunu da sınanır.
 *
 * Bitişik düzeneği: yol (0,5)(1,5)(2,5); hedef (1,4) yalnız (1,5)'e
 * (t = 103) dik komşu.
 * Vuruş düzeneği: dikey roket (1,5) çift dokunuşla t = 0'da patlar; (1,4)
 * ve (1,2) fener (vuruştan etkilenmez, ara yalıtıcı), hedef (1,3) d = 2 →
 * t = 50'de yalnız VURUŞ alır (dik komşularında patlama yok).
 */
import { describe, expect, it } from 'vitest';
import type { Konum, Olay } from '../index';
import { cift, fitil, hucreAt, hucrede, ic, kur, patlamaAt, sec, uygula } from './kur';

const UC = '0,5 1,5 2,5';
const bitisik = (hedef: string) => ['. . . . .', '. . . . .', '. . . . .', '. . . . .', `. ${hedef} . . .`, 'R R R . .'];
const vurus = (hedef: string, sol = '.', sag = '.') => ['. . . . .', '. . . . .', '. F . . .', `${sol} ${hedef} ${sag} . .`, '. F . . .', '. R| . . .'];

/** (x, y) hücresini konu alan bütün olaylar (yerçekimi gibi hücresiz olaylar hariç). */
function hucreOlaylari(ol: readonly Olay[], x: number, y: number): Olay[] {
  return ol.filter((o) => {
    const h = (o as { hucre?: Konum }).hucre;
    return !!h && h.x === x && h.y === y;
  });
}

const bitisikUygula = (hedef: string, cikislar?: number[]) => uygula(kur({ tahta: bitisik(hedef), cikislar }), fitil(UC));
const vurusUygula = (hedef: string, cikislar?: number[]) => uygula(kur({ tahta: vurus(hedef), cikislar }), cift(1, 5));

describe('§3.5.3 vuruş tablosu — Kapsül', () => {
  it('§3.5.3 kapsül / bitişik: etki yok, yalnız ısı (+1)', () => {
    const { olaylar } = bitisikUygula('G');
    expect(hucrede(olaylar, 'isindi', 1, 4)).toMatchObject([{ t: 103, isi: 1 }]);
    expect(patlamaAt(olaylar, 1, 4)).toBeUndefined();
  });

  it('§3.5.3 kapsül / vuruş: patlar (vuruş, 15 puan, etkinin nesli 0)', () => {
    const { olaylar } = vurusUygula('G');
    expect(patlamaAt(olaylar, 1, 3)).toMatchObject({ t: 50, neden: 'vurus', nesil: 0, puan: 15, renk: 3, k: 0 });
  });
});

describe('§3.5.3 vuruş tablosu — Kafesli kapsül', () => {
  it('§3.5.3 kafesli / bitişik: etki yok, yalnız ısı; kafes kalır', () => {
    const { olaylar, durum } = bitisikUygula('C:G');
    expect(hucrede(olaylar, 'isindi', 1, 4)).toMatchObject([{ t: 103, isi: 1 }]);
    expect(hucrede(olaylar, 'kafesKirildi', 1, 4)).toEqual([]);
    expect(patlamaAt(olaylar, 1, 4)).toBeUndefined();
    // kafesli kapsül sabittir (§2.4): yerinde kalır.
    expect(hucreAt(durum, 1, 4)).toMatchObject({ kafes: true, icerik: { tur: 'kapsul', renk: 3, isi: 1 } });
  });

  it('§3.5.3 kafesli / vuruş: kafes kırılır, kapsül patlar', () => {
    const { olaylar } = vurusUygula('C:G');
    expect(hucrede(olaylar, 'kafesKirildi', 1, 3)).toMatchObject([{ t: 50 }]);
    expect(patlamaAt(olaylar, 1, 3)).toMatchObject({ t: 50, neden: 'vurus', renk: 3 });
  });

  it('§3.5.3 kafesli / ısı: eşikte kafes kırılır ve kapsül patlar (t + 90)', () => {
    const { olaylar } = bitisikUygula('C:G3');
    expect(hucrede(olaylar, 'isindi', 1, 4)).toMatchObject([{ t: 103 }]);
    expect(hucrede(olaylar, 'kafesKirildi', 1, 4)).toMatchObject([{ t: 193 }]);
    expect(patlamaAt(olaylar, 1, 4)).toMatchObject({ t: 193, neden: 'isi', nesil: 1 });
  });
});

describe('§3.5.3 vuruş tablosu — Islak barut', () => {
  it('§3.5.3 ıslak / bitişik: kurur → aynı renk kapsül, ısı 0; ısı almaz (ısı adımı hasardan önce)', () => {
    // §3.5.2 PATLAT sırası: 5. ısı yayılımı, 6. bitişik hasar → kuruma ısıdan sonra olur,
    // kuruyan kapsül o patlamadan ısı almaz.
    const { olaylar, durum } = bitisikUygula('W:G');
    expect(hucrede(olaylar, 'kurudu', 1, 4)).toMatchObject([{ t: 103, renk: 3 }]);
    expect(hucrede(olaylar, 'isindi', 1, 4)).toEqual([]);
    expect(patlamaAt(olaylar, 1, 4)).toBeUndefined();
    // kuruyan kapsül hareketlidir: altındaki (1,5) boşalınca oraya düşer.
    expect(ic(durum, 1, 5)).toMatchObject({ tur: 'kapsul', renk: 3, isi: 0, ozel: 'yok' });
  });

  it('§3.5.3 ıslak / vuruş: kurur, patlamaz', () => {
    const { olaylar, durum } = vurusUygula('W:G', []);
    expect(hucrede(olaylar, 'kurudu', 1, 3)).toMatchObject([{ t: 50, renk: 3 }]);
    expect(patlamaAt(olaylar, 1, 3)).toBeUndefined();
    // sütun 1: fener(4), kuru G(3), fener(2) aşağı sıkışır → G (1,4)'te.
    expect(ic(durum, 1, 4)).toMatchObject({ tur: 'kapsul', renk: 3, isi: 0 });
  });

  it('§6.1 kuruma TOPLA hedefine sayılmaz', () => {
    const d = kur({ tahta: bitisik('W:G'), hedefler: [{ tur: 'topla', renk: 3, adet: 5 }] });
    const { durum } = uygula(d, fitil(UC));
    expect(durum.hedefler[0].ilerleme).toBe(0);
  });
});

describe('§3.5.3 vuruş tablosu — Fener', () => {
  it('§3.5.3 fener / bitişik: hiçbir etki yok, ısı almaz', () => {
    const { olaylar, durum } = bitisikUygula('F', []);
    expect(hucreOlaylari(olaylar, 1, 4)).toEqual([]);
    expect(ic(durum, 1, 5)).toEqual({ tur: 'fener' });
  });

  it('§3.5.3 fener / vuruş: hiçbir etki yok, roket üzerinden geçer', () => {
    const { olaylar } = vurusUygula('F', []);
    expect(hucreOlaylari(olaylar, 1, 3)).toEqual([]);
    expect(patlamaAt(olaylar, 1, 1)).toMatchObject({ t: 100, neden: 'vurus' });
  });
});

describe('§3.5.3 vuruş tablosu — Kaya ve Kova', () => {
  it.each([
    ['K2', 'kaya', 1],
    ['K1', 'kaya', 0],
    ['S', 'kova', 1],
    ['S1', 'kova', 0],
  ] as const)('§3.5.3 %s / bitişik: −1 kat (%s, kalan %i), ısı almaz', (simge, engel, kalan) => {
    const { olaylar, durum } = bitisikUygula(simge);
    expect(hucrede(olaylar, 'engelHasar', 1, 4)).toEqual([{ t: 103, tur: 'engelHasar', hucre: { x: 1, y: 4 }, engel, kalan }]);
    expect(hucrede(olaylar, 'isindi', 1, 4)).toEqual([]);
    if (kalan > 0) expect(ic(durum, 1, 4)).toEqual({ tur: engel, kat: kalan });
    else expect(durum.hucreler.some((c) => c.icerik?.tur === engel)).toBe(false);
  });

  it.each([
    ['K2', 'kaya', 1],
    ['K1', 'kaya', 0],
    ['S', 'kova', 1],
    ['S1', 'kova', 0],
  ] as const)('§3.5.3 %s / vuruş: −1 kat (%s, kalan %i)', (simge, engel, kalan) => {
    const { olaylar } = vurusUygula(simge, []);
    expect(hucrede(olaylar, 'engelHasar', 1, 3)).toEqual([{ t: 50, tur: 'engelHasar', hucre: { x: 1, y: 3 }, engel, kalan }]);
  });

  it('§3.5.3 engel vuruşu komşulara yayılmaz (ısı ya da bitişik hasar yok)', () => {
    const d = kur({ tahta: vurus('K2', 'I', 'G'), cikislar: [] });
    const { olaylar } = uygula(d, cift(1, 5));
    expect(hucrede(olaylar, 'engelHasar', 1, 3)).toMatchObject([{ t: 50, kalan: 1 }]);
    expect(hucreOlaylari(olaylar, 0, 3)).toEqual([]);
    expect(hucreOlaylari(olaylar, 2, 3)).toEqual([]);
  });

  it('§3.5.3 kova kalkanı yalnız ısıyı keser: kovaya komşu kapsül vuruşla patlar', () => {
    const d = kur({ tahta: vurus('G', 'S'), cikislar: [] });
    const { olaylar } = uygula(d, cift(1, 5));
    expect(patlamaAt(olaylar, 1, 3)).toMatchObject({ t: 50, neden: 'vurus' });
  });
});

describe('§3.5.3 vuruş tablosu — Dev fişek ve İs', () => {
  it('§3.5.3 dev fişek / bitişik: +1 dolum, ısı almaz', () => {
    const { olaylar, durum } = bitisikUygula('D');
    expect(hucrede(olaylar, 'devFisekDoldu', 1, 4)).toEqual([{ t: 103, tur: 'devFisekDoldu', hucre: { x: 1, y: 4 }, dolum: 1, kapasite: 5 }]);
    expect(hucrede(olaylar, 'isindi', 1, 4)).toEqual([]);
    expect(ic(durum, 1, 4)).toEqual({ tur: 'devFisek', dolum: 1, kapasite: 5 });
  });

  it('§3.5.3 dev fişek / vuruş: +1 dolum', () => {
    const { olaylar } = vurusUygula('D', []);
    expect(hucrede(olaylar, 'devFisekDoldu', 1, 3)).toMatchObject([{ t: 50, dolum: 1, kapasite: 5 }]);
  });

  it('§3.5.3 is / bitişik: temizlenir, ısı almaz', () => {
    const { olaylar, durum } = bitisikUygula('I');
    expect(hucrede(olaylar, 'isTemizlendi', 1, 4)).toMatchObject([{ t: 103 }]);
    expect(hucrede(olaylar, 'isindi', 1, 4)).toEqual([]);
    expect(durum.hucreler.some((c) => c.icerik?.tur === 'is')).toBe(false);
  });

  it('§3.5.3 is / vuruş: temizlenir', () => {
    const { olaylar } = vurusUygula('I', []);
    expect(hucrede(olaylar, 'isTemizlendi', 1, 3)).toMatchObject([{ t: 50 }]);
  });
});

describe('§3.5.3 vuruş tablosu — Boş / delik', () => {
  it('§3.5.3 delik / bitişik: hiçbir olay yok', () => {
    const { olaylar } = bitisikUygula('#');
    expect(hucreOlaylari(olaylar, 1, 4)).toEqual([]);
  });

  it('§3.5.3 delik / vuruş: olay yok, roket deliği atlayıp sürer (d geometrik)', () => {
    // §4.2 belirsiz: delikten sonraki hücrenin d'si geometrik uzaklık diye okundu.
    const { olaylar } = vurusUygula('#', []);
    expect(hucreOlaylari(olaylar, 1, 3)).toEqual([]);
    expect(patlamaAt(olaylar, 1, 1)).toMatchObject({ t: 100, neden: 'vurus' });
    expect(patlamaAt(olaylar, 1, 0)).toMatchObject({ t: 125, neden: 'vurus' });
  });
});

describe('§3.5.3 vuruş kuralları', () => {
  it('§3.5.3 vuruşla patlayan kapsül vuruşu yapan etkinin neslini alır (ısıyla tetiklenen roket → nesil 1)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. G3| . . .', 'R R R . .'] });
    const { olaylar } = uygula(d, fitil(UC));
    expect(patlamaAt(olaylar, 1, 4)).toMatchObject({ t: 193, neden: 'isi', nesil: 1, ozel: 'roket' });
    expect(hucrede(olaylar, 'ozelTetiklendi', 1, 4)).toMatchObject([{ t: 193, ozel: 'roket', eksen: 1 }]);
    expect(patlamaAt(olaylar, 1, 3)).toMatchObject({ t: 218, neden: 'vurus', nesil: 1, puan: 15 });
    expect(patlamaAt(olaylar, 1, 0)).toMatchObject({ t: 293, neden: 'vurus', nesil: 1 });
  });

  it('§3.5.3 yalnız kapsül patlamaları komşu ısıtır: bitişik engel hasarı ısı üretmez', () => {
    const { olaylar } = bitisikUygula('K2');
    // (1,3) yalnız kayaya dik komşu; kaya hasarı yayılmaz.
    expect(hucrede(olaylar, 'isindi', 1, 3)).toEqual([]);
    expect(sec(olaylar, 'patlama')).toHaveLength(3);
  });
});
