/** Vuruş tablosu (§3.5.3) her satır; engeller ve çevre öğeleri (§5). */
import { describe, expect, it } from 'vitest';
import { hamleUygula } from './hamle';
import { rngSonraki } from './rng';
import { fitil, icerik, kur, patlamaZamani, sec } from './testAraclari';
import type { Hamle } from './types';

const kibrit = (x: number, y: number): Hamle => ({ tur: 'kibrit', hucre: { x, y } });

describe('vuruş tablosu: bitişik patlama', () => {
  it('kapsül: yalnız ısı (patlamaz)', () => {
    const d = kur(['A G A', 'R R R', 'Z A Z']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(Object.keys(patlamaZamani(r.olaylar)).sort()).toEqual(['0,1', '1,1', '2,1']);
  });

  it('kafesli kapsül: yalnız ısı, kafes kalır', () => {
    const d = kur(['A cG A', 'R R R', 'Z A Z']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'kafesKirildi')).toHaveLength(0);
    expect(sec(r.olaylar, 'isindi').find((o) => o.hucre.x === 1 && o.hucre.y === 0)).toMatchObject({ isi: 1 });
    expect(r.durum.hucreler[1].kafes).toBe(true);
  });

  it('ıslak: kurur (aynı renk, ısı 0), ısınmaz, hedefe sayılmaz', () => {
    const d = kur(['A wZ A', 'R R R', 'G A G'], { hedefler: [{ tur: 'topla', renk: 'hepsi', adet: 99 }, { tur: 'topla', renk: 2, adet: 9 }] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'kurudu')).toEqual([{ t: 103, tur: 'kurudu', hucre: { x: 1, y: 0 }, renk: 2 }]);
    expect(sec(r.olaylar, 'isindi').some((o) => o.hucre.x === 1 && o.hucre.y === 0)).toBe(false);
    // Kuruyan Z (1,1)'e düştü.
    expect(icerik(r.durum, 1, 1)).toEqual({ tur: 'kapsul', renk: 2, isi: 0, ozel: 'yok', eksen: 0 });
    expect(r.durum.hedefler[0].ilerleme).toBe(3);
    expect(r.durum.hedefler[1].ilerleme).toBe(0);
  });

  it('fener: etkilenmez, ısınmaz', () => {
    const d = kur(['A F A', 'R R R', 'G A G'], { cikislar: [] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    const fenerOlay = r.olaylar.filter((o) => 'hucre' in o && o.hucre && o.tur !== 'patlama' && o.hucre.x === 1 && o.hucre.y === 0);
    expect(fenerOlay).toHaveLength(0);
    expect(icerik(r.durum, 1, 1)).toEqual({ tur: 'fener' });
  });

  it('kaya: −1 kat (20); 0\'da kalkar (+50), kaya hedefi', () => {
    const d = kur(['K2 K1 A', 'R R R', 'G A G'], { hedefler: [{ tur: 'kaya' }] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'engelHasar')).toEqual([
      { t: 0, tur: 'engelHasar', hucre: { x: 0, y: 0 }, engel: 'kaya', kalan: 1 },
      { t: 103, tur: 'engelHasar', hucre: { x: 1, y: 0 }, engel: 'kaya', kalan: 0 },
    ]);
    expect(r.durum.puan).toBe(10 + 20 + 30 + 20 + 20 + 50);
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2, tamam: false });
    expect(r.durum.istatistik.kayaKirilan).toBe(1);
    expect(icerik(r.durum, 0, 0)).toEqual({ tur: 'kaya', kat: 1 });
  });

  it('kova: −1 kat; kalkınca +50', () => {
    const d = kur(['S1 A G', 'R R R', 'G A G']);
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'engelHasar')).toEqual([{ t: 0, tur: 'engelHasar', hucre: { x: 0, y: 0 }, engel: 'kova', kalan: 0 }]);
    expect(r.durum.puan).toBe(60 + 20 + 50);
  });

  it('dev fişek: +1 dolum; dolunca t + 150 fırlar, üstü t + 150 + 30·Δy vuruş, +300', () => {
    const d = kur(['A Z A', 'G A G', 'R D2 R', 'R R R'], { hedefler: [{ tur: 'devFisek', adet: 2 }] });
    const r = hamleUygula(d, fitil([0, 2], [0, 3], [1, 3], [2, 3], [2, 2]));
    expect(sec(r.olaylar, 'devFisekDoldu').map((o) => [o.t, o.dolum, o.kapasite])).toEqual([
      [0, 1, 2],
      [199, 2, 2],
    ]);
    expect(sec(r.olaylar, 'devFisekFirladi')).toEqual([{ t: 349, tur: 'devFisekFirladi', hucre: { x: 1, y: 2 } }]);
    const z = patlamaZamani(r.olaylar);
    expect(z['1,1']).toBe(379);
    expect(z['1,0']).toBe(409);
    expect(sec(r.olaylar, 'patlama').find((o) => o.hucre.x === 1 && o.hucre.y === 0)).toMatchObject({ neden: 'devFisek', puan: 15 });
    expect(sec(r.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ t: 349, miktar: 300 }));
    expect(r.durum.hedefler[0].ilerleme).toBe(1);
    expect(r.durum.istatistik.devFisekAtesi).toBe(1);
  });

  it('is: temizlenir (+30), is hedefi', () => {
    const d = kur(['I A G', 'R R R', 'G A G'], { hedefler: [{ tur: 'is' }] });
    const r = hamleUygula(d, fitil([0, 1], [1, 1], [2, 1]));
    expect(sec(r.olaylar, 'isTemizlendi')).toEqual([{ t: 0, tur: 'isTemizlendi', hucre: { x: 0, y: 0 } }]);
    expect(sec(r.olaylar, 'isYayildi')).toHaveLength(0);
    expect(r.durum.puan).toBe(60 + 30);
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 1, tamam: true });
  });
});

describe('vuruş tablosu: vuruş (kibrit, t = 0, nesil 0)', () => {
  const tahta = (hucre: string) => kur([`${hucre} A G`, 'R R R', 'G Z A'], { cikislar: [] });

  it('kapsül patlar (15, neden kibrit); hamle harcanmaz', () => {
    const d = tahta('Z');
    const r = hamleUygula(d, kibrit(0, 0));
    expect(sec(r.olaylar, 'guclendirici')).toEqual([{ t: 0, tur: 'guclendirici', guc: 'kibrit', hucre: { x: 0, y: 0 } }]);
    expect(sec(r.olaylar, 'patlama')[0]).toMatchObject({ t: 0, neden: 'kibrit', nesil: 0, puan: 15 });
    expect(r.durum.kalanHamle).toBe(d.kalanHamle);
    expect(r.durum.istatistik.guclendirici).toBe(1);
  });

  it('kafesli: kafes kırılır, kapsül patlar', () => {
    const r = hamleUygula(tahta('cZ'), kibrit(0, 0));
    expect(sec(r.olaylar, 'kafesKirildi')).toHaveLength(1);
    expect(patlamaZamani(r.olaylar)['0,0']).toBe(0);
  });

  it('ıslak kurur', () => {
    const r = hamleUygula(tahta('wZ'), kibrit(0, 0));
    expect(sec(r.olaylar, 'kurudu')).toEqual([{ t: 0, tur: 'kurudu', hucre: { x: 0, y: 0 }, renk: 2 }]);
    expect(sec(r.olaylar, 'patlama')).toHaveLength(0);
  });

  it('fener etkilenmez', () => {
    const d = tahta('F');
    const r = hamleUygula(d, kibrit(0, 0));
    expect(icerik(r.durum, 0, 0)).toEqual({ tur: 'fener' });
    expect(r.olaylar.filter((o) => o.tur !== 'guclendirici' && o.tur !== 'reaksiyon')).toHaveLength(0);
  });

  it('kaya, kova −1 kat; dev fişek +1; is temizlenir; boş hücre etkisiz', () => {
    expect(sec(hamleUygula(tahta('K3'), kibrit(0, 0)).olaylar, 'engelHasar')[0]).toMatchObject({ engel: 'kaya', kalan: 2 });
    expect(sec(hamleUygula(tahta('S'), kibrit(0, 0)).olaylar, 'engelHasar')[0]).toMatchObject({ engel: 'kova', kalan: 1 });
    expect(sec(hamleUygula(tahta('D'), kibrit(0, 0)).olaylar, 'devFisekDoldu')[0]).toMatchObject({ dolum: 1, kapasite: 5 });
    expect(sec(hamleUygula(tahta('I'), kibrit(0, 0)).olaylar, 'isTemizlendi')).toHaveLength(1);
  });

  it('kibrit özel taşı tetikler; ikinci güçlendirici kullanılamaz', () => {
    const d = kur(['Zr0 A G Z', 'R R R A', 'G Z A G']);
    const r = hamleUygula(d, kibrit(0, 0));
    expect(sec(r.olaylar, 'ozelTetiklendi')[0]).toMatchObject({ t: 0, ozel: 'roket' });
    expect(patlamaZamani(r.olaylar)['3,0']).toBe(75);
    expect(() => hamleUygula(r.durum, kibrit(1, 1))).toThrow(/guclendiriciSiniri/);
  });
});

describe('barut izi (§5)', () => {
  const izli = (ust: string) =>
    kur([ust, 'Z A R G Z', 'G Z R A G'], { zemin: { barutIzleri: [[[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]] } });

  it('iz hücresinde patlama → iki yöne 60 tik/adım VURUS, her hücre bir kez', () => {
    const d = izli('A G R Z A');
    const r = hamleUygula(d, fitil([2, 0], [2, 1], [2, 2]));
    expect(sec(r.olaylar, 'izYandi').map((o) => `${o.hucre.x}@${o.t}`)).toEqual(['2@0', '1@60', '3@60', '0@120', '4@120']);
    const z = patlamaZamani(r.olaylar);
    expect([z['1,0'], z['3,0'], z['0,0'], z['4,0']]).toEqual([60, 60, 120, 120]);
    expect(sec(r.olaylar, 'patlama').find((o) => o.hucre.x === 0 && o.hucre.y === 0)).toMatchObject({ neden: 'iz', puan: 15 });
    expect(r.durum.izler[0].yandi).toEqual([true, true, true, true, true]);
  });

  it('iz engele vuruş verir; engel üstündeki iz hücresine vuruş izi tutuşturur', () => {
    const d = izli('A G R Z K2');
    const r = hamleUygula(d, fitil([2, 0], [2, 1], [2, 2]));
    // (3,0) iz patlaması (60) kayaya bitişik hasar, sonra iz vuruşu (120).
    expect(sec(r.olaylar, 'engelHasar').map((o) => [o.t, o.kalan])).toEqual([
      [60, 1],
      [120, 0],
    ]);
    const k = hamleUygula(d, kibrit(4, 0));
    expect(sec(k.olaylar, 'izYandi').map((o) => `${o.hucre.x}@${o.t}`)).toEqual(['4@0', '3@60', '2@120', '1@180', '0@240']);
  });

  it('yanmış iz bir daha yanmaz', () => {
    const d = izli('A G R Z A');
    const r = hamleUygula(d, fitil([2, 0], [2, 1], [2, 2]));
    const r2 = hamleUygula(r.durum, kibrit(0, 0));
    expect(sec(r2.olaylar, 'izYandi')).toHaveLength(0);
  });
});

describe('is yayılması (§5)', () => {
  it('hiç is temizlenmediyse ise dik komşu düz kapsüllerden biri ise döner; is hedefi gerekli +1', () => {
    const d = kur(['I A G Z', 'G Z A G', 'R R R A'], { hedefler: [{ tur: 'is' }] });
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    const y = sec(r.olaylar, 'isYayildi');
    expect(y).toHaveLength(1);
    expect(['1,0', '0,1']).toContain(`${y[0].hucre.x},${y[0].hucre.y}`);
    expect(icerik(r.durum, y[0].hucre.x, y[0].hucre.y)).toEqual({ tur: 'is' });
    expect(r.durum.hedefler[0]).toMatchObject({ ilerleme: 0, gerekli: 2, tamam: false });
    expect(sec(r.olaylar, 'hedefIlerledi')).toContainEqual(expect.objectContaining({ indeks: 0, gerekli: 2, tamam: false }));
  });

  it('özel ve kafesli kapsüller ise dönmez', () => {
    // Zincir 2–3. sütunlarda: 0–1. sütunlar kaymaz, isin komşuları roket ve kafesli kalır.
    const d = kur(['I Ar0 G Z', 'cG Z A G', 'Z G R A', 'A Z R R']);
    const r = hamleUygula(d, fitil([2, 2], [2, 3], [3, 3]));
    expect(sec(r.olaylar, 'isYayildi')).toHaveLength(0);
  });

  it('körük, kibrit ve kalıp eylemlerinde yayılmaz', () => {
    const d = kur(['I A G Z', 'G Z A G', 'R R R A']);
    const r = hamleUygula(d, kibrit(3, 0));
    expect(sec(r.olaylar, 'isYayildi')).toHaveLength(0);
  });

  it('RNG yalnız aday varken tüketilir (tüketim sırası §16.3)', () => {
    const d = kur(['I A G Z', 'G Z A G', 'R R R A']);
    const r = hamleUygula(d, fitil([0, 2], [1, 2], [2, 2]));
    // 3 dolum + 1 is seçimi.
    const s = { rng: d.rng };
    for (let k = 0; k < 4; k++) rngSonraki(s);
    expect(r.durum.rng).toBe(s.rng);
  });
});
