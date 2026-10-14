/**
 * §3.5.1 fitil hamlesi zamanları ve §3.5.2 ısı kuralı (ISIT), §3.7 nesil.
 * hamleUygula P1'de yazılacak; bu testler o zamana dek kırmızıdır.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from '../index';
import type { BolumVerisi } from '../index';
import b001 from '../../levels/veri/b001.json';
import { cift, fitil, fitilZamanlari, hucrede, ic, kur, patlamaAt, patlamaHaritasi, sec, uygula, yol } from './kur';

const KAPALI: [number, number, number] = [0, 0, 0];

const ALTI = ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R R R R R G'];
const ALTI_YOL = '0,5 1,5 2,5 3,5 4,5 5,5';

describe('§3.5.1 fitil zamanları', () => {
  it('§3.5.1 6 düğüm: dugumYandi t = 0, 103, 199, 288, 370, 445 (k 1 tabanlı)', () => {
    const { olaylar } = uygula(kur({ tahta: ALTI, ozelEsikleri: KAPALI }), fitil(ALTI_YOL));
    const dy = sec(olaylar, 'dugumYandi');
    expect(dy.map((o) => o.t)).toEqual([0, 103, 199, 288, 370, 445]);
    expect(dy.map((o) => o.k)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(dy.map((o) => o.hucre)).toEqual(yol(ALTI_YOL));
  });

  it('§3.5.1 6 düğüm: her düğüm kendi anında fitil patlaması (nesil 0, k, puan 10·k)', () => {
    const { olaylar } = uygula(kur({ tahta: ALTI, ozelEsikleri: KAPALI }), fitil(ALTI_YOL));
    const zaman = [0, 103, 199, 288, 370, 445];
    yol(ALTI_YOL).forEach((p, i) => {
      expect(patlamaAt(olaylar, p.x, p.y), `düğüm ${i + 1}`).toMatchObject({
        t: zaman[i],
        neden: 'fitil',
        nesil: 0,
        k: i + 1,
        renk: 0,
        ozel: 'yok',
        puan: 10 * (i + 1),
      });
    });
    expect(sec(olaylar, 'patlama')).toHaveLength(6);
  });

  it('§3.5.1 fitilBasladi t = 0 anında yol, halka ve zincir rengiyle', () => {
    const { olaylar } = uygula(kur({ tahta: ALTI, ozelEsikleri: KAPALI }), fitil(ALTI_YOL));
    expect(sec(olaylar, 'fitilBasladi')).toEqual([{ t: 0, tur: 'fitilBasladi', yol: yol(ALTI_YOL), halka: false, renk: 0 }]);
  });

  it('§3.5.1 10 düğüm: son düğüm t = 675', () => {
    const d = kur({
      tahta: ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . R R R', 'R R R R R R R'],
      ozelEsikleri: KAPALI,
    });
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5 3,5 4,5 5,5 6,5 6,4 5,4 4,4'));
    const t = sec(olaylar, 'dugumYandi').map((o) => o.t);
    expect(t).toEqual([0, 103, 199, 288, 370, 445, 513, 574, 628, 675]);
    expect(patlamaAt(olaylar, 4, 4)?.t).toBe(675);
  });

  it('§3.5.1 fitil hızlanması alt sınırı 35 tik (13 düğüm: …675, 715, 750, 785)', () => {
    const d = kur({
      tahta: ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. R R R R R R', 'R R R R R R R'],
      ozelEsikleri: KAPALI,
    });
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5 3,5 4,5 5,5 6,5 6,4 5,4 4,4 3,4 2,4 1,4'));
    expect(sec(olaylar, 'dugumYandi').map((o) => o.t)).toEqual(fitilZamanlari(13));
    expect(sec(olaylar, 'dugumYandi').map((o) => o.t).slice(9)).toEqual([675, 715, 750, 785]);
  });

  it('§3.5.1 halka: zamanlar aynı formül, çarpan 2 → yol dışı dik komşulara +2 ısı', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R . . .', 'R R . . .'] });
    const { olaylar } = uygula(d, fitil('0,4 1,4 1,5 0,5', true));
    expect(sec(olaylar, 'dugumYandi').map((o) => o.t)).toEqual([0, 103, 199, 288]);
    expect(sec(olaylar, 'patlama').map((o) => o.k).sort()).toEqual([1, 2, 3, 4]);
    expect(hucrede(olaylar, 'isindi', 0, 3)).toEqual([{ t: 0, tur: 'isindi', hucre: { x: 0, y: 3 }, isi: 2, kizgin: false }]);
    expect(hucrede(olaylar, 'isindi', 1, 3)).toMatchObject([{ t: 103, isi: 2 }]);
    expect(hucrede(olaylar, 'isindi', 2, 4)).toMatchObject([{ t: 103, isi: 2 }]);
    expect(hucrede(olaylar, 'isindi', 2, 5)).toMatchObject([{ t: 199, isi: 2 }]);
    expect(sec(olaylar, 'fitilBasladi')[0]).toMatchObject({ halka: true });
  });

  it('§3.3.1 tamamı joker yolda zincir rengi bırakma anında tahtada en çok bulunan renktir', () => {
    // 25 gök, 2 kehribar; yol üç yıldız topu: S1+S2 büyük final, üçüncüsü ayrı tetiklenir (§4.4).
    // §3.3.1: fitilBasladi.renk hamlenin zincir rengidir (çoğunluk rengi); önizlemede ise
    // types.ts Onizleme.renk belgesi gereği −1 beklenir (onizle.test.ts).
    const d = kur({ esik: 5, tahta: ['G G G G G', 'G G G G G', 'G G G G G', 'G G G G G', 'G G G G G', '* * * A A'] });
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5'));
    expect(sec(olaylar, 'fitilBasladi')).toMatchObject([{ renk: 3 }]);
    expect(hucrede(olaylar, 'ozelTetiklendi', 2, 5)).toMatchObject([{ t: 199, ozel: 'yildiz', hedefRenk: 3 }]);
  });

  it('§3.5.2 PATLAT: patlayan hücrenin zemini ışıklı kalır (isikIzi), patlamayan hücreninki kalmaz (§0 K12)', () => {
    const { durum } = uygula(kur({ tahta: ALTI, ozelEsikleri: KAPALI }), fitil(ALTI_YOL));
    for (const p of yol(ALTI_YOL)) expect(durum.hucreler[p.y * 7 + p.x].isikIzi, `${p.x},${p.y}`).toBe(true);
    expect(durum.hucreler[5 * 7 + 6].isikIzi).toBe(false);
    expect(durum.hucreler[4 * 7 + 0].isikIzi).toBe(false);
  });

  it('§3.5.1 / §0 K5 bölüm 1: (1,5) patlayınca kızgın A³ +1 alır ve 90 tik sonra (t = 193) patlar', () => {
    const d = bolumuYukle(b001 as unknown as BolumVerisi, 0);
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5 3,5'));
    expect(hucrede(olaylar, 'isindi', 1, 4)).toMatchObject([{ t: 103 }]);
    expect(patlamaAt(olaylar, 1, 4)).toMatchObject({ t: 193, neden: 'isi', nesil: 1, renk: 1, puan: 20, k: 0 });
  });
});

// ── §3.5.2 ISIT ─────────────────────────────────────────────────────────

/** Yol (0,5)(1,5)(2,5); X = (1,4) yalnız (1,5)'e (t = 103) dik komşu; diğer komşuları kaya. */
const isiTahtasi = (x: string, ust = '.') => ['. . . . .', '. . . . .', '. . . . .', `. ${ust === '.' ? 'K3' : ust} . . .`, `K3 ${x} K3 . .`, 'R R R K3 .'];
const UC = '0,5 1,5 2,5';

describe('§3.5.2 ısı kuralı (ISIT)', () => {
  it('§3.5.2 komşu patlama +1 ısı verir; isindi kaynağın anında, kızgın = eşik−1', () => {
    const { olaylar } = uygula(kur({ tahta: isiTahtasi('G') }), fitil(UC));
    expect(hucrede(olaylar, 'isindi', 1, 4)).toEqual([{ t: 103, tur: 'isindi', hucre: { x: 1, y: 4 }, isi: 1, kizgin: false }]);
    const { olaylar: o2 } = uygula(kur({ tahta: isiTahtasi('G2') }), fitil(UC));
    expect(hucrede(o2, 'isindi', 1, 4)).toEqual([{ t: 103, tur: 'isindi', hucre: { x: 1, y: 4 }, isi: 3, kizgin: true }]);
  });

  it.each([2, 3, 4, 5])('§3.5.2 eşik %i: ısısı eşik−1 olan kapsül +1 ile t+90 anında ısı patlaması (nesil 1, 20 puan)', (esik) => {
    const { olaylar } = uygula(kur({ tahta: isiTahtasi(`G${esik - 1}`), esik }), fitil(UC));
    expect(hucrede(olaylar, 'isindi', 1, 4)).toMatchObject([{ t: 103 }]);
    expect(patlamaAt(olaylar, 1, 4)).toMatchObject({ t: 193, neden: 'isi', nesil: 1, renk: 3, puan: 20, k: 0 });
    expect(sec(olaylar, 'patlama')).toHaveLength(4);
  });

  it('§3.5.2 eşiğe ulaşmayan ısı kalıcıdır (düştükten sonra da korunur)', () => {
    const { olaylar, durum } = uygula(kur({ tahta: isiTahtasi('G2') }), fitil(UC));
    expect(patlamaAt(olaylar, 1, 4)).toBeUndefined();
    // X (1,4) altındaki (1,5) patladı → X (1,5)'e düşer; (1,3) kayası atlanır.
    expect(ic(durum, 1, 5)).toMatchObject({ tur: 'kapsul', renk: 3, isi: 3 });
  });

  it('§3.7 nesil: ısı patlamasının patlattığı kapsül nesil 2 (40 puan), t = 193 + 90', () => {
    const { olaylar } = uygula(kur({ tahta: isiTahtasi('G3', 'G3') }), fitil(UC));
    expect(patlamaAt(olaylar, 1, 4)).toMatchObject({ t: 193, neden: 'isi', nesil: 1, puan: 20 });
    expect(hucrede(olaylar, 'isindi', 1, 3)).toMatchObject([{ t: 193 }]);
    expect(patlamaAt(olaylar, 1, 3)).toMatchObject({ t: 283, neden: 'isi', nesil: 2, puan: 40 });
  });

  it('§3.5 kalkan: hamle başında kovaya dik komşu kapsül hiçbir kaynaktan ısı almaz', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. K3 . . .', 'S G3 . . .', 'R R R K3 .'] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(hucrede(olaylar, 'isindi', 1, 4)).toEqual([]);
    expect(patlamaAt(olaylar, 1, 4)).toBeUndefined();
    expect(hucrede(olaylar, 'engelHasar', 0, 4)).toMatchObject([{ t: 0, engel: 'kova', kalan: 1 }]);
    expect(ic(durum, 1, 5)).toMatchObject({ renk: 3, isi: 3 });
  });

  it('§3.5 kalkan hamle başında hesaplanır: kova aynı hamlede kırılsa da kalkan sürer', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. K3 . . .', 'S1 G3 . . .', 'R R R K3 .'] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(hucrede(olaylar, 'engelHasar', 0, 4)).toMatchObject([{ t: 0, engel: 'kova', kalan: 0 }]);
    expect(hucrede(olaylar, 'isindi', 1, 4)).toEqual([]);
    expect(patlamaAt(olaylar, 1, 4)).toBeUndefined();
    expect(ic(durum, 1, 5)).toMatchObject({ renk: 3, isi: 3 });
  });

  it('§3.5.2 planlı hücre ısı almaz: eşiğe ulaşıp planlanan kapsüle sonraki düğüm ısı vermez', () => {
    // X (3,5): (2,5) t=199 ile eşiğe ulaşır (patlama 289); (3,4) t=288'de X'e komşu ama X planlı.
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . R .', 'R R R G3 .'] });
    const { olaylar } = uygula(d, fitil('0,5 1,5 2,5 3,4'));
    expect(hucrede(olaylar, 'isindi', 3, 5)).toMatchObject([{ t: 199 }]);
    expect(patlamaAt(olaylar, 3, 5)).toMatchObject({ t: 289, neden: 'isi', nesil: 1 });
  });

  it('§3.5.2 fitil düğümleri (planlı/patlamış) birbirinden ısı almaz', () => {
    const { olaylar } = uygula(kur({ tahta: ALTI, ozelEsikleri: KAPALI }), fitil(ALTI_YOL));
    for (const p of yol(ALTI_YOL)) expect(hucrede(olaylar, 'isindi', p.x, p.y), `${p.x},${p.y}`).toEqual([]);
  });

  it('§3.5.2 ısı patlaması komşulara her zaman +1 verir (+2 yalnız halka düğümlerinden)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R K3 . .', 'R R G2 G .'] });
    const { olaylar } = uygula(d, fitil('0,4 1,4 1,5 0,5', true));
    expect(hucrede(olaylar, 'isindi', 2, 5)).toMatchObject([{ t: 199 }]);
    expect(patlamaAt(olaylar, 2, 5)).toMatchObject({ t: 289, neden: 'isi', nesil: 1 });
    expect(hucrede(olaylar, 'isindi', 3, 5)).toEqual([{ t: 289, tur: 'isindi', hucre: { x: 3, y: 5 }, isi: 1, kizgin: false }]);
  });

  it('§3.5 ilk plan kazanır: ısıyla planlanan kapsüle gelen roket vuruşu yok sayılır, bir kez patlar', () => {
    // Roket (1,5) t=0 patlar, X (2,5)'i eşiğe taşır (planlı, t=90); roket vuruşu t=25'te X'e gelir → yok sayılır.
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', '. R- G3 . .'] });
    const { olaylar } = uygula(d, cift(1, 5));
    const m = patlamaHaritasi(olaylar); // iki kez patlayan hücre varsa hata verir
    expect(m.get('2,5')).toMatchObject({ t: 90, neden: 'isi', nesil: 1 });
    expect(m.get('0,5')).toMatchObject({ t: 25, neden: 'vurus' });
    expect(m.get('3,5')).toMatchObject({ t: 50, neden: 'vurus' });
    expect(m.get('4,5')).toMatchObject({ t: 75, neden: 'vurus' });
  });
});
