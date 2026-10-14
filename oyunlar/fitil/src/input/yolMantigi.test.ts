import { describe, expect, it } from 'vitest';
import { bolumuYukle, yolDogrula } from '../core/index';
import type { BolumVerisi, Konum, Kurallar, OyunDurumu, Renk } from '../core/types';
import b001 from '../levels/veri/b001.json';
import {
  CiftDokunusTakibi,
  ISABET_YARICAPI,
  YAPISMA_UZAKLIGI,
  boslukAdimi,
  eklenebilir,
  geriAlAdimi,
  hucreAnahtari,
  imlecBaslangici,
  imlecTasi,
  noktadakiHucre,
  yolAdimi,
  yolBaslat,
  yolSurukle,
  type Nokta,
  type YolAdimSonucu,
  type YolDurumu,
  type YolKisiti,
} from './yolMantigi';

/**
 * Test tahtası: her satır boşlukla ayrılmış simgeler.
 *  R A Z G M  düz kapsül (renk 0..4)   *  yıldız topu (joker)
 *  R^         roket (renk R)           CR kafesli kızıl
 *  WR         ıslak (kızıl)            F  fener   K kaya   #  delik
 */
function tahta(satirlar: string[], kurallar: Kurallar = {}): OyunDurumu {
  const h = satirlar.length;
  const simgeler = satirlar.map((s) => s.trim().split(/\s+/));
  const w = simgeler[0].length;
  const v: BolumVerisi = {
    id: 900,
    ad: 'test',
    mahalle: 0,
    tur: 'normal',
    w,
    h,
    renkSayisi: 5,
    esik: 4,
    hamle: 20,
    tohum: 7,
    yardim: 0,
    ozelEsikleri: [6, 9, 12],
    hedefler: [{ tur: 'puan', puan: 1 }],
    duzen: simgeler.map((r) => r.map((s) => (s === '#' ? '#' : '.')).join(' ')),
    kurallar,
    botBandi: [0, 100],
    yildizEsikleri: [1, 2],
  };
  const d = bolumuYukle(v, 0);
  const renk = (c: string) => 'RAZGM'.indexOf(c) as Renk;
  simgeler.forEach((r, y) =>
    r.forEach((s, x) => {
      const hc = d.hucreler[y * w + x];
      if (s === '#') return;
      hc.kafes = false;
      if (s === '*') hc.icerik = { tur: 'kapsul', renk: -1, isi: 0, ozel: 'yildiz', eksen: 0 };
      else if (s === 'F') hc.icerik = { tur: 'fener' };
      else if (s === 'K') hc.icerik = { tur: 'kaya', kat: 1 };
      else if (s[0] === 'W') hc.icerik = { tur: 'islak', renk: renk(s[1]) as Renk };
      else if (s[0] === 'C') {
        hc.kafes = true;
        hc.icerik = { tur: 'kapsul', renk: renk(s[1]), isi: 0, ozel: 'yok', eksen: 0 };
      } else hc.icerik = { tur: 'kapsul', renk: renk(s[0]), isi: 0, ozel: s[1] === '^' ? 'roket' : 'yok', eksen: 0 };
    }),
  );
  return d;
}

/** Hücre merkezi (hücre biriminde). */
const m = (x: number, y: number): Nokta => ({ x: x + 0.5, y: y + 0.5 });
const K = (x: number, y: number): Konum => ({ x, y });

/** Bas, noktalardan sürükle; son durum ve bütün değişimler. */
function ciz(d: OyunDurumu, noktalar: Nokta[], kisit: YolKisiti = {}): { durum: YolDurumu; adimlar: YolAdimSonucu[] } {
  const bas = yolBaslat(d, noktalar[0], kisit);
  if (!bas) return { durum: { yol: [], halka: false }, adimlar: [] };
  let durum: YolDurumu = bas;
  const adimlar: YolAdimSonucu[] = [bas];
  for (let i = 1; i < noktalar.length; i++) {
    const r = yolSurukle(d, durum, noktalar[i - 1], noktalar[i], kisit);
    durum = r.durum;
    adimlar.push(...r.adimlar);
  }
  return { durum, adimlar };
}

const yolStr = (y: readonly Konum[]) => y.map((p) => `${p.x},${p.y}`).join(' ');

describe('yolMantigi — başlatma (§3.3.1, §3.2)', () => {
  const d = tahta([
    'R  CR WR F',
    'R^ *  K  A',
  ]);
  it('zincirlenebilir kapsülde başlar; kafes/ıslak/fener/kaya başlatmaz', () => {
    expect(yolBaslat(d, m(0, 0))?.yol).toEqual([K(0, 0)]);
    expect(yolBaslat(d, m(1, 0))).toBeNull(); // kafesli
    expect(yolBaslat(d, m(2, 0))).toBeNull(); // ıslak
    expect(yolBaslat(d, m(3, 0))).toBeNull(); // fener
    expect(yolBaslat(d, m(2, 1))).toBeNull(); // kaya
    expect(yolBaslat(d, m(0, 1))?.yol).toEqual([K(0, 1)]); // özel taş
    expect(yolBaslat(d, m(1, 1))?.yol).toEqual([K(1, 1)]); // joker
  });
  it('hücrenin herhangi bir yerine basmak yeter; tahta dışı ve delik null', () => {
    expect(yolBaslat(d, { x: 0.02, y: 0.97 })?.yol).toEqual([K(0, 0)]);
    expect(yolBaslat(d, { x: -0.1, y: 0.5 })).toBeNull();
    const dd = tahta(['# R R']);
    expect(yolBaslat(dd, m(0, 0))).toBeNull();
    expect(noktadakiHucre(dd, m(0, 0))).toBeNull();
  });
  it('zorunlu küme: yalnız kümedeki hücrelerden başlar', () => {
    const z: YolKisiti = { zorunlu: new Set([hucreAnahtari(0, 1)]) };
    expect(yolBaslat(d, m(0, 0), z)).toBeNull();
    expect(yolBaslat(d, m(0, 1), z)?.degisim).toBe('basladi');
  });
});

describe('yolMantigi — ekleme ve isabet dairesi (§3.3.2)', () => {
  const d = tahta([
    'R R R R R R',
    'A A A A A A',
  ]);
  it('düz sürükleme sırayla ekler; her ekleme ayrı değişim', () => {
    const r = ciz(d, [m(0, 0), m(1, 0), m(2, 0), m(3, 0)]);
    expect(yolStr(r.durum.yol)).toBe('0,0 1,0 2,0 3,0');
    expect(r.adimlar.map((a) => a.degisim)).toEqual(['basladi', 'eklendi', 'eklendi', 'eklendi']);
    expect(r.adimlar.map((a) => a.yol.length)).toEqual([1, 2, 3, 4]);
  });
  it('0,42 hücre yarıçap sınırı: 0,43 dışarıda, 0,41 içeride (yapışma eşiğinin altında)', () => {
    const bas = yolBaslat(d, m(0, 0))!;
    // (1,0) merkezine 0,43 uzaklık = (0,0) merkezinden 0,57 → daire dışında ve yapışma eşiğinin altında.
    const dis = yolAdimi(d, bas, { x: 1.5 - 0.43, y: 0.5 });
    expect(dis.degisim).toBeNull();
    const ic = yolAdimi(d, bas, { x: 1.5 - 0.41, y: 0.5 });
    expect(ic.degisim).toBe('eklendi');
    expect(ISABET_YARICAPI).toBe(0.42);
  });
  it('renk uymayan komşu eklenmez', () => {
    const r = ciz(d, [m(0, 0), m(0, 1), m(1, 1)]);
    expect(yolStr(r.durum.yol)).toBe('0,0');
  });
  it('hızlı kaydırma: tek olayda 5 hücre atlansa da hepsi eklenir', () => {
    const bas = yolBaslat(d, m(0, 0))!;
    const r = yolSurukle(d, bas, m(0, 0), m(5, 0));
    expect(yolStr(r.durum.yol)).toBe('0,0 1,0 2,0 3,0 4,0 5,0');
    expect(r.adimlar).toHaveLength(5);
  });
  it('hızlı çapraz kaydırma (tek olay) de atlamaz', () => {
    const dz = tahta([
      'G A G A G',
      'A G A G A',
    ]);
    const bas = yolBaslat(dz, m(0, 0))!;
    const r = yolSurukle(dz, bas, m(0, 0), m(1, 1));
    const r2 = yolSurukle(dz, r.durum, m(1, 1), m(2, 0));
    expect(yolStr(r2.durum.yol)).toBe('0,0 1,1 2,0');
  });
});

describe('yolMantigi — çapraz köşe geçişi ve yapışma (§3.3.2)', () => {
  it('köşeden geçen çapraz hareket dik komşulara takılmaz (hepsi aynı renk)', () => {
    const d = tahta([
      'R R R',
      'R R R',
      'R R R',
    ]);
    const r = ciz(d, [m(0, 0), m(1, 1), m(2, 2)]);
    expect(yolStr(r.durum.yol)).toBe('0,0 1,1 2,2');
  });
  it('çapraz zikzak (bölüm 2 deseni): 6 gök kapsül', () => {
    const d = tahta([
      'R G A G G G',
      'G Z G R G G',
    ]);
    const nokta = [m(0, 1), m(1, 0), m(2, 1), m(3, 0), m(4, 1), m(5, 1)];
    const r = ciz(d, nokta);
    expect(yolStr(r.durum.yol)).toBe('0,1 1,0 2,1 3,0 4,1 5,1');
    expect(yolDogrula(d, r.durum.yol, false)).toBeNull();
  });
  it('yapışma: 0,6 hücre ötede, daire dışında, en yakın yön ≤ 22,5° ise eklenir', () => {
    const d = tahta([
      'R R R',
      'R R R',
      'R R R',
    ]);
    const bas = yolBaslat(d, m(1, 1))!;
    const uz = YAPISMA_UZAKLIGI + 0.02;
    const yonlu = (derece: number): Nokta => {
      const a = (derece * Math.PI) / 180;
      return { x: 1.5 + uz * Math.cos(a), y: 1.5 + uz * Math.sin(a) };
    };
    // 0° → sağ (2,1); 30° (y aşağı) → sağ-alt çapraz (2,2); 60° → çapraz; 80° → alt (1,2).
    expect(yolAdimi(d, bas, yonlu(0)).yol[1]).toEqual(K(2, 1));
    expect(yolAdimi(d, bas, yonlu(20)).yol[1]).toEqual(K(2, 1));
    expect(yolAdimi(d, bas, yonlu(30)).yol[1]).toEqual(K(2, 2));
    expect(yolAdimi(d, bas, yonlu(60)).yol[1]).toEqual(K(2, 2));
    expect(yolAdimi(d, bas, yonlu(80)).yol[1]).toEqual(K(1, 2));
    expect(yolAdimi(d, bas, yonlu(-135)).yol[1]).toEqual(K(0, 0));
    // 0,6'nın altında yapışma yok.
    const yakin = { x: 1.5 + 0.55 * Math.cos(Math.PI / 4), y: 1.5 + 0.55 * Math.sin(Math.PI / 4) };
    expect(yolAdimi(d, bas, yakin).degisim).toBeNull();
  });
  it('yapışma uygun olmayan hücreye eklemez, başka yöne de kaçmaz', () => {
    const d = tahta([
      'R R A',
      'R R R',
      'R R R',
    ]);
    const bas = yolBaslat(d, m(1, 1))!;
    // Sağ-üst (2,0) kehribar: −45° yönünde yapışma yok.
    const p = { x: 1.5 + 0.65 * Math.cos(-Math.PI / 4), y: 1.5 + 0.65 * Math.sin(-Math.PI / 4) };
    expect(yolAdimi(d, bas, p).degisim).toBeNull();
  });
  it('dortKomsu: çapraz eklenmez, 30° yapışma da olmaz (en yakın dik yön 30° > 22,5°)', () => {
    const d = tahta(
      [
        'R R R',
        'R R R',
        'R R R',
      ],
      { dortKomsu: true },
    );
    const r = ciz(d, [m(0, 0), m(1, 1), m(2, 2)]);
    expect(yolStr(r.durum.yol)).toBe('0,0');
    const bas = yolBaslat(d, m(1, 1))!;
    const a = (30 * Math.PI) / 180;
    expect(yolAdimi(d, bas, { x: 1.5 + 0.65 * Math.cos(a), y: 1.5 + 0.65 * Math.sin(a) }).degisim).toBeNull();
    const b = (15 * Math.PI) / 180;
    expect(yolAdimi(d, bas, { x: 1.5 + 0.65 * Math.cos(b), y: 1.5 + 0.65 * Math.sin(b) }).yol[1]).toEqual(K(2, 1));
    // Dik yolla L çizilir.
    expect(yolStr(ciz(d, [m(0, 0), m(1, 0), m(1, 1), m(2, 1)]).durum.yol)).toBe('0,0 1,0 1,1 2,1');
  });
  it('caprazSiniri 1: ikinci çapraz adım eklenmez', () => {
    const d = tahta(
      [
        'G A G A G',
        'A G A G A',
      ],
      { caprazSiniri: 1 },
    );
    const r = ciz(d, [m(0, 0), m(1, 1), m(2, 0), m(3, 1)]);
    expect(yolStr(r.durum.yol)).toBe('0,0 1,1');
    expect(eklenebilir(d, [K(0, 0), K(1, 1)], K(2, 0))).toBe(false);
  });
});

describe('yolMantigi — geri alma (§3.3.3)', () => {
  const d = tahta([
    'R R R R R',
    'R R R R R',
  ]);
  it("P[n−2]'nin dairesine dönmek son düğümü siler, tekrar ilerlemek geri ekler", () => {
    const r = ciz(d, [m(0, 0), m(1, 0), m(2, 0), m(3, 0), m(2, 0), m(1, 0)]);
    expect(yolStr(r.durum.yol)).toBe('0,0 1,0');
    expect(r.adimlar.slice(-2).map((a) => a.degisim)).toEqual(['geriAlindi', 'geriAlindi']);
    const r2 = yolSurukle(d, r.durum, m(1, 0), m(3, 0));
    expect(yolStr(r2.durum.yol)).toBe('0,0 1,0 2,0 3,0');
  });
  it('geri alınan hücre başka yoldan yeniden kullanılabilir', () => {
    const r = ciz(d, [m(0, 0), m(1, 0), m(2, 0), m(1, 0), m(1, 1), m(2, 0)]);
    expect(yolStr(r.durum.yol)).toBe('0,0 1,0 1,1 2,0');
  });
  it('ilk düğüm geri alınmaz (|P| = 1 ise değişim yok)', () => {
    const bas = yolBaslat(d, m(0, 0))!;
    expect(yolAdimi(d, bas, m(0, 0)).degisim).toBeNull();
  });
});

describe('yolMantigi — halka (§3.3.4)', () => {
  const d = tahta([
    'A A R R',
    'A A R R',
    'R R R R',
  ]);
  it('2×2 kare: P[0] dairesine dönünce halka kapanır', () => {
    const r = ciz(d, [m(0, 0), m(1, 0), m(1, 1), m(0, 1), m(0, 0)]);
    expect(r.durum.halka).toBe(true);
    expect(r.durum.yol).toHaveLength(4);
    expect(r.adimlar.at(-1)?.degisim).toBe('halkaKapandi');
    expect(yolDogrula(d, r.durum.yol, true)).toBeNull();
  });
  it('halka kapalıyken ekleme ve geri alma yok; P[n−1] dairesine dönmek açar', () => {
    const r = ciz(d, [m(0, 0), m(1, 0), m(1, 1), m(0, 1), m(0, 0)]);
    // P[0]'dan P[1]'in dairesine git: halka kapalı, değişim yok.
    const r2 = yolSurukle(d, r.durum, m(0, 0), m(1, 0));
    expect(r2.durum.halka).toBe(true);
    expect(r2.adimlar).toHaveLength(0);
    // P[n−1] = (0,1) dairesine dön: halka açılır.
    const r3 = yolSurukle(d, r2.durum, m(1, 0), m(0, 1));
    expect(r3.adimlar.map((a) => a.degisim)).toEqual(['halkaAcildi']);
    expect(r3.durum.halka).toBe(false);
    // Açıldıktan sonra P[n−2] = (1,1) dairesi geri alır.
    const r4 = yolSurukle(d, r3.durum, m(0, 1), m(1, 1));
    expect(r4.adimlar.map((a) => a.degisim)).toEqual(['geriAlindi']);
  });
  it('|P| = 3 iken P[0] dairesine girmek halka yapmaz', () => {
    const r = ciz(d, [m(0, 0), m(1, 0), m(1, 1), m(0, 0)]);
    expect(r.durum.halka).toBe(false);
    expect(yolStr(r.durum.yol)).toBe('0,0 1,0 1,1');
  });
  it('son düğüm P[0]a komşu değilse halka yok', () => {
    const dd = tahta([
      'R R R R',
      'A A A R',
      'R R R R',
    ]);
    // (0,0)→(1,0)→(2,0)→(3,0)→(3,1): son (3,1), P[0] (0,0) komşu değil.
    const r = ciz(dd, [m(0, 0), m(1, 0), m(2, 0), m(3, 0), m(3, 1), m(0, 0)]);
    expect(r.durum.halka).toBe(false);
  });
});

describe('yolMantigi — joker (yıldız topu) rengi (§3.3.1)', () => {
  it('jokerle başlayan yol ilk joker olmayan kapsülün rengine kilitlenir', () => {
    const d = tahta([
      '* R A',
      'A R A',
    ]);
    const r = ciz(d, [m(0, 0), m(1, 0), m(2, 0)]);
    expect(yolStr(r.durum.yol)).toBe('0,0 1,0'); // R'den sonra A eklenmez
    const r2 = ciz(d, [m(0, 0), m(0, 1), m(1, 0)]);
    expect(yolStr(r2.durum.yol)).toBe('0,0 0,1'); // A'dan sonra R eklenmez
  });
  it('geri alma jokere dönünce renk yeniden serbest', () => {
    const d = tahta([
      '* R A',
      'A R A',
    ]);
    const r = ciz(d, [m(0, 0), m(1, 0), m(0, 0)]);
    expect(yolStr(r.durum.yol)).toBe('0,0');
    expect(eklenebilir(d, r.durum.yol, K(0, 1))).toBe(true);
    expect(eklenebilir(d, r.durum.yol, K(1, 0))).toBe(true);
  });
  it('joker her renge uyar: R * R ve A * A zinciri, iki joker art arda', () => {
    const d = tahta([
      'R * * R',
      'A A A A',
    ]);
    expect(yolStr(ciz(d, [m(0, 0), m(1, 0), m(2, 0), m(3, 0)]).durum.yol)).toBe('0,0 1,0 2,0 3,0');
    expect(yolStr(ciz(d, [m(0, 1), m(1, 0), m(2, 0), m(3, 1)]).durum.yol)).toBe('0,1 1,0 2,0 3,1');
  });
});

describe('yolMantigi — zincirlenemez öğeler (§3.2)', () => {
  it('kafes, ıslak, fener, kaya ve delik zincire katılamaz', () => {
    const d = tahta([
      'R CR R',
      'R WR R',
      'R F  R',
      'R K  R',
      'R #  R',
    ]);
    for (let y = 0; y < 5; y++) {
      const r = ciz(d, [m(0, y), m(1, y), m(2, y)]);
      expect(yolStr(r.durum.yol)).toBe(`0,${y}`);
    }
    // Delikten çapraz geçiş: (0,4) → (1,3)? kaya; zincir yok.
    expect(eklenebilir(d, [K(0, 0)], K(1, 0))).toBe(false);
  });
  it('zorunlu küme dışına uzatılamaz (§15 yorumu)', () => {
    const d = bolumuYukle(b001 as unknown as BolumVerisi, 0);
    const zor = (b001 as unknown as BolumVerisi).zorunluIlkHamle!;
    const kisit: YolKisiti = { zorunlu: new Set(zor.map(([x, y]) => hucreAnahtari(x, y))) };
    const r = ciz(d, [m(0, 5), m(1, 5), m(2, 5), m(3, 5)], kisit);
    expect(yolStr(r.durum.yol)).toBe('0,5 1,5 2,5 3,5');
    expect(yolDogrula(d, r.durum.yol, false)).toBeNull();
    // (4,4) kızıl yapılsa bile kümede değil: kısıtsız eklenir, kısıtla eklenmez.
    d.hucreler[4 * d.w + 4].icerik = { tur: 'kapsul', renk: 0, isi: 0, ozel: 'yok', eksen: 0 };
    expect(eklenebilir(d, r.durum.yol, K(4, 4))).toBe(true);
    expect(eklenebilir(d, r.durum.yol, K(4, 4), kisit)).toBe(false);
    expect(yolStr(yolSurukle(d, r.durum, m(3, 5), m(4, 4), kisit).durum.yol)).toBe('0,5 1,5 2,5 3,5');
    expect(yolBaslat(d, m(0, 4), kisit)).toBeNull();
  });
});

describe('yolMantigi — klavye (§13.7)', () => {
  const d = tahta([
    'A A R R',
    'A A R #',
    'R R R R',
  ]);
  it('Boşluk: başlatır, imlece uzatır, P[n−2]de geri alır, P[0]da halka kapatır/açar', () => {
    let s: YolDurumu | null = null;
    const bas = (x: number, y: number) => {
      const r = boslukAdimi(d, s, K(x, y));
      if (r) s = r;
      return r?.degisim ?? null;
    };
    expect(bas(0, 0)).toBe('basladi');
    expect(bas(1, 0)).toBe('eklendi');
    expect(bas(3, 2)).toBeNull(); // komşu değil
    expect(bas(2, 0)).toBeNull(); // renk uymaz
    expect(bas(1, 1)).toBe('eklendi');
    expect(bas(0, 1)).toBe('eklendi');
    expect(bas(0, 0)).toBe('halkaKapandi');
    expect(bas(1, 1)).toBeNull(); // halka kapalı
    expect(bas(0, 1)).toBe('halkaAcildi');
    expect(bas(1, 1)).toBe('geriAlindi');
    expect(s!.yol).toHaveLength(3);
  });
  it('Backspace: halkayı açar, sonra siler; tek düğümde null', () => {
    const halkali: YolDurumu = { yol: [K(0, 0), K(1, 0), K(1, 1), K(0, 1)], halka: true };
    expect(geriAlAdimi(halkali)?.degisim).toBe('halkaAcildi');
    expect(geriAlAdimi({ yol: halkali.yol, halka: false })?.yol).toHaveLength(3);
    expect(geriAlAdimi({ yol: [K(0, 0)], halka: false })).toBeNull();
  });
  it('imleç delikleri atlar, tahtadan çıkmaz; başlangıç merkeze yakın', () => {
    expect(imlecTasi(d, K(2, 1), 1, 0)).toEqual(K(2, 1)); // (3,1) delik, ötesi tahta dışı
    expect(imlecTasi(d, K(3, 0), 0, 1)).toEqual(K(3, 2)); // delik atlanır
    expect(imlecTasi(d, K(0, 0), -1, -1)).toEqual(K(0, 0));
    expect(imlecTasi(d, K(1, 1), 1, 1)).toEqual(K(2, 2));
    expect(imlecBaslangici(d, null, null)).toEqual(K(1, 1));
    expect(imlecBaslangici(d, [K(0, 0), K(1, 0)], null)).toEqual(K(1, 0));
  });
});

describe('CiftDokunusTakibi (§3.3)', () => {
  it('aynı hücreye 300 ms içinde ikinci dokunuş çifttir', () => {
    const t = new CiftDokunusTakibi();
    expect(t.dokunus(K(1, 1), 0, 80, 0.05)).toBe('ilk');
    expect(t.dokunus(K(1, 1), 300, 360, 0.1)).toBe('cift');
    // Çiftten sonra üçüncü dokunuş yeniden "ilk".
    expect(t.dokunus(K(1, 1), 400, 450, 0)).toBe('ilk');
  });
  it('geç kalan, başka hücre ya da hareketli dokunuş çift değildir', () => {
    const t = new CiftDokunusTakibi();
    t.dokunus(K(1, 1), 0, 80, 0);
    expect(t.dokunus(K(1, 1), 381, 420, 0)).toBe('ilk'); // 301 ms boşluk
    expect(t.dokunus(K(2, 1), 500, 520, 0)).toBe('ilk');
    expect(t.dokunus(K(2, 1), 600, 620, 0.31)).toBe('yok');
    expect(t.dokunus(K(2, 1), 700, 720, 0)).toBe('ilk');
  });
});
