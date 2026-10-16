import { describe, expect, it } from 'vitest';
import { hamleHatasi, hamleUygula, komboTuru, onizle } from './index';
import type { KomboTuru, Konum, Olay } from './types';
import { H, kur, tahtaMetni } from './testAraclari';

const tur = <T extends Olay['tur']>(ol: Olay[], t: T) => ol.filter((o) => o.tur === t) as Extract<Olay, { tur: T }>[];
const kume = (l: Konum[]) => l.map((p) => `${p.x},${p.y}`).sort();

describe('özel taş üretimi (§5.1, K7)', () => {
  it('4 → Tarak: karışımla doğan damlanın hücresinde; enine geniş → yatay; +200', () => {
    const d = kur(['4 4 4 4', '4 4 1 4', '3 3 2 3']);
    const r = hamleUygula(d, H(2, 1, 2, 2));
    expect(tur(r.olaylar, 'ozelOlustu')).toEqual([{ t: 640, tur: 'ozelOlustu', hucre: { x: 2, y: 2 }, damla: { id: 14, renk: 3, ozel: 'tarak', yon: 'yatay' } }]);
    expect(tur(r.olaylar, 'puanEklendi').find((o) => o.neden === 'ozel')).toMatchObject({ miktar: 200, hucre: { x: 2, y: 2 } });
    expect(r.durum.puan).toBe(4 * 30 + 200);
    expect(tahtaMetni(r.durum)).toEqual(['1 1 1 1', '4 4 4 4', '4 4 T3 4']);
    expect(r.durum.istatistik.tarak).toBe(1);
  });

  it('5 → Girdap: yeni damla grupta yoksa en alt satırın en solu', () => {
    // Mavi (2,2) Sarı'ya iner → Yeşil (grup dışı); sütun inince Turuncu beşlisi.
    const d = kur(['4 4 4 4 4', '4 4 3 4 4', '3 3 4 3 3', '4 4 2 4 4']);
    const r = hamleUygula(d, H(2, 2, 2, 3));
    expect(tur(r.olaylar, 'ozelOlustu')[0]).toMatchObject({ hucre: { x: 0, y: 2 }, damla: { renk: 3, ozel: 'girdap' } });
    expect(r.durum.puan).toBe(5 * 30 + 400);
  });

  it('6 → Lale (renksiz); büyük olan kazanır', () => {
    const d = kur(['4 4 4 4', '4 4 1 4', '3 3 2 3', '4 4 3 4', '4 4 3 4']);
    const r = hamleUygula(d, H(2, 1, 2, 2));
    const oz = tur(r.olaylar, 'ozelOlustu');
    expect(oz).toHaveLength(1);
    expect(oz[0]).toMatchObject({ hucre: { x: 2, y: 2 }, damla: { renk: 0, ozel: 'lale' } });
    expect(r.durum.puan).toBe(6 * 30 + 800);
  });

  it('2×2 tarak hamlenin yönünü alır (dikey sürükleme → dikey); boyuna uzun → dikey', () => {
    const d = kur(['4 4 3 4', '4 3 1 4', '4 3 2 4']);
    const r = hamleUygula(d, H(2, 1, 2, 2));
    expect(tur(r.olaylar, 'ozelOlustu')[0]).toMatchObject({ hucre: { x: 2, y: 2 }, damla: { ozel: 'tarak', yon: 'dikey' } });
    const d2 = kur(['4 4 4', '4 1 4', '4 2 4', '4 3 4', '4 3 4', '4 3 4']);
    expect(hamleHatasi(d2, H(1, 1, 1, 2))).toBeNull();
    const r2 = hamleUygula(d2, H(1, 1, 1, 2));
    expect(tur(r2.olaylar, 'ozelOlustu')[0]).toMatchObject({ damla: { ozel: 'tarak', yon: 'dikey' } });
  });

  it('önizleme özel taş hayaletini gösterir (§3.5)', () => {
    const d = kur(['4 4 4 4', '4 4 1 4', '3 3 2 3']);
    expect(onizle(d, H(2, 1, 2, 2)).ozelHayalet).toEqual({ hucre: { x: 2, y: 2 }, ozel: 'tarak', yon: 'yatay', renk: 3 });
  });
});

describe('özel sürükleme (§5.3, K9)', () => {
  it('Tarak → komşu: taş hedefe kayar, hedef damla temizlenir, orada satırı tarar', () => {
    const d = kur(['4 4 4 4', '2 T3 1 4', '4 4 4 4'], { hedefler: [{ tur: 'topla', renk: 3, adet: 5 }] });
    const r = hamleUygula(d, H(1, 1, 2, 1));
    const ol = r.olaylar;
    expect(ol[0]).toEqual({ t: 0, tur: 'ozelSuruklendi', kaynak: { x: 1, y: 1 }, hedef: { x: 2, y: 1 }, ozel: 'tarak', tasindi: true, ters: false, damla: { id: 6, renk: 3, ozel: 'tarak', yon: 'yatay' } });
    // Taşınan Turuncu tarak "renk topla"ya sayılır.
    expect(ol[1]).toEqual({ t: 0, tur: 'hedefIlerledi', indeks: 0, deger: 1, tamam: false });
    const tm = tur(ol, 'temizlendi');
    expect(tm.map((o) => [o.t, o.hucre.x, o.hucre.y, o.neden, o.puan])).toEqual([
      [120, 2, 1, 'tarak', 20],
      [145, 3, 1, 'tarak', 20],
      [170, 0, 1, 'tarak', 20],
    ]);
    expect(tur(ol, 'ozelTetiklendi')).toEqual([{ t: 120, tur: 'ozelTetiklendi', hucre: { x: 2, y: 1 }, ozel: 'tarak', yon: 'yatay', alan: [0, 1, 2, 3].map((x) => ({ x, y: 1 })).sort((a, b) => Math.abs(a.x - 2) - Math.abs(b.x - 2) || a.x - b.x) }]);
    expect(r.durum.puan).toBe(60);
    expect(ol[ol.length - 1]).toMatchObject({ tur: 'hamleOzeti', temizlenen: 4 });
    expect(r.durum.gunluk[0]).toEqual({ hamle: 0, k: 1, tur: 'tarak', x10: 20, y10: 10, renk: 3, boyut: 2, yon: 'yatay' });
  });

  it('Lale → komşu: yerinde açılır, hedefin rengini temizler; ters: kaynağın rengi', () => {
    const d = kur(['4 1 4 1', '1 L 2 4', '4 1 4 2']);
    const r = hamleUygula(d, H(1, 1, 2, 1));
    expect(r.olaylar[0]).toMatchObject({ tur: 'ozelSuruklendi', ozel: 'lale', tasindi: false, ters: false });
    const tm = tur(r.olaylar, 'temizlendi');
    expect(tm.map((o) => [o.t, o.hucre.x, o.hucre.y, o.ozel, o.neden])).toEqual([
      [120, 1, 1, 'lale', 'lale'],
      [420, 2, 1, 'yok', 'lale'],
      [450, 3, 2, 'yok', 'lale'],
    ]);
    expect(tur(r.olaylar, 'ozelTetiklendi')[0]).toMatchObject({ hucre: { x: 1, y: 1 }, ozel: 'lale', hedefRenk: 2 });
    const t = hamleUygula(d, H(2, 1, 1, 1));
    expect(t.olaylar[0]).toMatchObject({ tur: 'ozelSuruklendi', ozel: 'lale', tasindi: false, ters: true });
    expect(kume(tur(t.olaylar, 'temizlendi').map((o) => o.hucre))).toEqual(kume([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 2 }]));
    const k = hamleUygula(d, H(1, 2, 1, 1)); // Kırmızı → Lale
    expect(tur(k.olaylar, 'ozelTetiklendi')[0].hedefRenk).toBe(1);
    expect(tur(k.olaylar, 'temizlendi')).toHaveLength(1 + 4);
  });

  it('Mürekkep → komşu: yerinde 3×3 patlar (15 puan), engel −1', () => {
    const d = kur(['1 2 1 2', '2 7 1 2', '1 X2 1 2', '4 4 4 4']);
    const r = hamleUygula(d, H(1, 1, 2, 1));
    const tm = tur(r.olaylar, 'temizlendi');
    expect(tm.every((o) => o.neden === 'murekkep' && o.puan === 15)).toBe(true);
    expect(kume(tm.map((o) => o.hucre))).toEqual(kume([0, 1, 2].flatMap((x) => [0, 1, 2].map((y) => ({ x, y }))).filter((p) => !(p.x === 1 && p.y === 2))));
    expect(tur(r.olaylar, 'mermerHasar')).toEqual([{ t: 120, tur: 'mermerHasar', hucre: { x: 1, y: 2 }, kalan: 1 }]);
    expect(r.durum.puan).toBe(8 * 15 + 40);
  });

  it('düz → Girdap (ters): girdap yerinde baklavayı yutar; kaynak alandaysa o da gider', () => {
    const d = kur(['4 4 4 4 4', '4 4 1 4 4', '4 1 G6 2 4', '4 4 1 4 4', '4 4 4 4 4']);
    const r = hamleUygula(d, H(3, 2, 2, 2));
    expect(r.olaylar[0]).toMatchObject({ tur: 'ozelSuruklendi', ozel: 'girdap', tasindi: false, ters: true });
    const tm = tur(r.olaylar, 'temizlendi');
    expect(tm).toHaveLength(13);
    expect(tm[0]).toMatchObject({ t: 120, hucre: { x: 2, y: 2 }, ozel: 'girdap', neden: 'girdap' });
    expect(tm.slice(1).every((o) => o.t === 240)).toBe(true);
  });

  it('zincir: alandaki özel taş kalkar ve +150 tik sonra kendi etkisiyle ateşlenir', () => {
    const d = kur(['4 4 4 4 4', '2 T5 1 T6d 4', '4 4 4 4 4', '4 4 4 4 4']);
    const r = hamleUygula(d, H(1, 1, 2, 1));
    const te = tur(r.olaylar, 'ozelTetiklendi');
    expect(te.map((o) => [o.t, o.hucre.x, o.ozel, o.yon])).toEqual([
      [120, 2, 'tarak', 'yatay'],
      [295, 3, 'tarak', 'dikey'],
    ]);
    const ikinci = tur(r.olaylar, 'temizlendi').filter((o) => o.hucre.x === 3 && o.hucre.y !== 1);
    expect(ikinci.map((o) => o.t)).toEqual([320, 320, 345]);
    expect(r.durum.gunluk.map((g) => g.tur)).toEqual(['tarak', 'tarak']);
  });

  it('gruptaki Tarak grup temizlenince kendi hücresinde ateşlenir', () => {
    const d = kur(['4 4 4 4', '4 4 1 4', 'T3 3 2 4', '4 4 4 4']);
    const r = hamleUygula(d, H(2, 1, 2, 2));
    const tm = tur(r.olaylar, 'temizlendi');
    expect(tm.slice(0, 3).map((o) => [o.hucre.x, o.ozel, o.neden])).toEqual([
      [0, 'tarak', 'grup'],
      [1, 'yok', 'grup'],
      [2, 'yok', 'grup'],
    ]);
    expect(tur(r.olaylar, 'ozelTetiklendi')[0]).toMatchObject({ t: 640 + 150, hucre: { x: 0, y: 2 }, ozel: 'tarak' });
    expect(tm.find((o) => o.hucre.x === 3 && o.hucre.y === 2)).toMatchObject({ neden: 'tarak', t: 790 + 75 });
  });

  it('gruba komşu Mürekkep patlar (§4.4 adım 5)', () => {
    const d = kur(['4 4 4 4', '4 4 1 4', '3 3 2 7', '4 4 4 4']);
    const r = hamleUygula(d, H(2, 1, 2, 2));
    const m = tur(r.olaylar, 'ozelTetiklendi');
    expect(m).toEqual([expect.objectContaining({ t: 790, hucre: { x: 3, y: 2 }, ozel: 'murekkep' })]);
    expect(tur(r.olaylar, 'temizlendi').filter((o) => o.neden === 'murekkep')).toHaveLength(5);
    expect(r.durum.puan).toBe(90 + 75);
  });

  it('yağlı hücredeki özel taş sürüklenemez', () => {
    const d = kur(['4 4 4 4', '2 T3 1 4'], { zemin: { yag: [[1, 1]] } });
    expect(hamleHatasi(d, H(1, 1, 2, 1))).toBe('yag');
    expect(hamleHatasi(d, H(0, 1, 1, 1))).toBe('yag');
  });
});

describe('birleşimler (§5.4)', () => {
  // 7×7 tahta, ham Kırmızı/Mavi dama; kaynak (2,3) → hedef (3,3).
  const zemin = (a: string, b: string, ek: Record<string, string> = {}) => {
    const s: string[] = [];
    for (let y = 0; y < 7; y++) {
      const r: string[] = [];
      for (let x = 0; x < 7; x++) r.push(ek[`${x},${y}`] ?? (x === 2 && y === 3 ? a : x === 3 && y === 3 ? b : (x + y) % 2 ? '1' : '4'));
      s.push(r.join(' '));
    }
    return s;
  };
  const durum: [string, string, KomboTuru, number, number][] = [
    ['T5', 'T6d', 'tarakTarak', 13, 300],
    ['T5', 'G6', 'tarakGirdap', 33, 300],
    ['G5', 'G6', 'girdapGirdap', 37, 300],
    ['7', 'T6', 'murekkepTarak', 21, 300],
    ['G5', '7', 'murekkepGirdap', 25, 300],
    ['7', '7', 'murekkepMurekkep', 25, 300],
    ['L', 'L', 'laleLale', 49, 600],
    ['7', 'L', 'murekkepLale', 47, 600],
  ];
  for (const [a, b, kombo, alan, bonus] of durum)
    it(`${a} + ${b} → ${kombo}: alan ${alan}, +${bonus}`, () => {
      expect(komboTuru(a.startsWith('T') ? 'tarak' : a.startsWith('G') ? 'girdap' : a === 'L' ? 'lale' : 'murekkep', b.startsWith('T') ? 'tarak' : b.startsWith('G') ? 'girdap' : b === 'L' ? 'lale' : 'murekkep')).toBe(kombo);
      const d = kur(zemin(a, b));
      const r = hamleUygula(d, H(2, 3, 3, 3));
      expect(r.olaylar[0]).toMatchObject({ tur: 'ozelSuruklendi', tasindi: true });
      const bl = tur(r.olaylar, 'birlesim');
      expect(bl).toHaveLength(1);
      expect(bl[0]).toMatchObject({ t: 120, hucre: { x: 3, y: 3 }, kombo });
      expect(bl[0].alan).toHaveLength(alan);
      expect(tur(r.olaylar, 'puanEklendi').filter((o) => o.neden === 'ozel').map((o) => o.miktar)).toEqual([bonus]);
      // Hedefteki taş birleşime girer.
      expect(tur(r.olaylar, 'temizlendi')[0]).toMatchObject({ t: 120, hucre: { x: 3, y: 3 }, neden: 'birlesim' });
      expect(r.durum.istatistik.birlesim).toBe(1);
    });

  it('Tarak + Lale: tarağın rengindeki bütün damlalar tarağa döner, 80 tik arayla ateşlenir', () => {
    const d = kur(zemin('T5', 'L', { '0,0': '5', '6,6': '5', '0,6': '5' }));
    const r = hamleUygula(d, H(2, 3, 3, 3));
    const bl = tur(r.olaylar, 'birlesim')[0];
    expect(bl.kombo).toBe('laleTarak');
    expect(kume(bl.alan)).toEqual(kume([{ x: 0, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }]));
    const dn = tur(r.olaylar, 'donustu');
    expect(dn.map((o) => [o.damla.ozel, o.damla.yon, o.damla.renk])).toEqual([
      ['tarak', 'yatay', 5],
      ['tarak', 'dikey', 5],
      ['tarak', 'yatay', 5],
    ]);
    const te = tur(r.olaylar, 'ozelTetiklendi');
    expect(te.slice(0, 3).map((o) => o.t)).toEqual([120 + 450, 120 + 530, 120 + 610]);
  });

  it('Girdap + Lale: girdabın rengi girdaplara döner', () => {
    const d = kur(zemin('L', 'G6', { '0,0': '6', '6,6': '6' }));
    const r = hamleUygula(d, H(2, 3, 3, 3));
    expect(tur(r.olaylar, 'birlesim')[0].kombo).toBe('laleGirdap');
    expect(tur(r.olaylar, 'donustu').map((o) => o.damla.ozel)).toEqual(['girdap', 'girdap']);
    expect(tur(r.olaylar, 'ozelTetiklendi').filter((o) => o.ozel === 'girdap').length).toBeGreaterThanOrEqual(2);
  });

  it('Mürekkep + Tarak: kalın tarak tarağın yönünde (dikey → 3 sütun)', () => {
    const d = kur(zemin('7', 'T6d'));
    const bl = tur(hamleUygula(d, H(2, 3, 3, 3)).olaylar, 'birlesim')[0];
    expect(new Set(bl.alan.map((p) => p.x))).toEqual(new Set([2, 3, 4]));
    expect(bl.alan).toHaveLength(21);
  });

  it('Lale + Lale bütün tahtada engellere −1', () => {
    const d = kur(zemin('L', 'L', { '0,0': 'X2', '6,0': 'X1' }));
    const r = hamleUygula(d, H(2, 3, 3, 3));
    // Eşit uzaklıkta küçük indeks önce.
    expect(tur(r.olaylar, 'mermerHasar').map((o) => [o.hucre.x, o.kalan])).toEqual([
      [0, 1],
      [6, 0],
    ]);
    expect(r.durum.gunluk.find((g) => g.tur === 'birlesim')).toMatchObject({ x10: 30, y10: 30, boyut: 45 }); // 49 − 2 taş − 2 mermer
  });

  it('önizleme birleşim adını ve etki alanını verir', () => {
    const d = kur(zemin('T5', 'T6d'));
    const o = onizle(d, H(2, 3, 3, 3));
    expect(o.kombo).toBe('tarakTarak');
    expect(o.etkiAlani).toHaveLength(13);
    expect(o.sonuc).toBeNull();
  });
});
