/**
 * Bölüm listesi ve statik doğrulayıcı (GDD §16.5, §8.1). Bütün bölümler —
 * taslaklar dahil — statik kurallardan geçmeli.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { BolumVerisi } from '../core/types';
import { BOLUMLER, TUM_BOLUMLER, USTA_BOLUMLERI, bolumGetir } from './index';
import { bolumDogrula } from './dogrulayici';

const VERI = fileURLToPath(new URL('./veri/', import.meta.url));

describe('bölüm listesi (levels/index.ts)', () => {
  it('40 ana bölüm sırayla 1..40, 8 Usta bölümü 101..108', () => {
    expect(BOLUMLER.map((v) => v.id)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(USTA_BOLUMLERI.map((v) => v.id)).toEqual([101, 102, 103, 104, 105, 106, 107, 108]);
    expect(USTA_BOLUMLERI.every((v) => v.tur === 'usta')).toBe(true);
    expect(bolumGetir(7)?.ad).toBe('Islak Barut');
    expect(bolumGetir(104)?.id).toBe(104);
    expect(bolumGetir(41)).toBeUndefined();
  });

  it('veri/ klasöründeki her JSON listede ve dosya adı id ile uyumlu', () => {
    const dosyalar = readdirSync(VERI).filter((f) => f.endsWith('.json')).sort();
    expect(dosyalar).toHaveLength(TUM_BOLUMLER.length);
    for (const f of dosyalar) {
      const v = JSON.parse(readFileSync(VERI + f, 'utf8')) as BolumVerisi;
      const ad = v.id > 100 ? `u${v.id}.json` : `b${String(v.id).padStart(3, '0')}.json`;
      expect(f).toBe(ad);
      expect(bolumGetir(v.id)).toEqual(v);
    }
  });

  it('bölüm 1–10 tasarlandı (taslak değil), sabit tablo değerleri (§8.3)', () => {
    const tablo: [number, number, number, number][] = [
      // id, w, h, renkSayisi
      [1, 5, 6, 3],
      [2, 6, 7, 4],
      [3, 6, 8, 4],
      [4, 7, 8, 4],
      [5, 7, 8, 4],
      [6, 7, 8, 5],
      [7, 7, 9, 5],
      [8, 7, 8, 5],
      [9, 7, 9, 5],
      [10, 7, 9, 5],
    ];
    for (const [id, w, h, r] of tablo) {
      const v = bolumGetir(id)!;
      expect(v.taslak, `bölüm ${id}`).toBeFalsy();
      expect([v.w, v.h, v.renkSayisi, v.esik], `bölüm ${id}`).toEqual([w, h, r, 4]);
    }
    // §4.1 özel eşikleri: 1 → kapalı, 2–5 → roket, 6–11 → roket + kasımpatı.
    expect(bolumGetir(1)!.ozelEsikleri).toEqual([0, 0, 0]);
    for (const id of [2, 3, 4, 5]) expect(bolumGetir(id)!.ozelEsikleri).toEqual([6, 0, 0]);
    for (const id of [6, 7, 8, 9, 10]) expect(bolumGetir(id)!.ozelEsikleri).toEqual([6, 9, 0]);
    // §15: yumuşak zorunlu ilk hamle yalnız 1 ve 2.
    expect(TUM_BOLUMLER.filter((v) => v.zorunluIlkHamle?.length).map((v) => v.id)).toEqual([1, 2]);
  });
});

describe('statik doğrulayıcı (§16.5)', () => {
  // K21 (24 Ekim 2026) kararını henüz karşılamayan, ürün sahibi kararı
  // bekleyen bölümler: yalnız beklenen K21 hatasını verir. Bölüm
  // düzeltilince bu test kırılır; o zaman girdiyi sil (bölüm "temiz" olur).
  const K21_BEKLEYEN = new Map<number, string>([[10, 'caprazSiniri tanımlı']]);
  for (const v of TUM_BOLUMLER) {
    const bekleyen = K21_BEKLEYEN.get(v.id);
    if (bekleyen) {
      it(`bölüm ${v.id} "${v.ad}": yalnız K21 hatası (karar bekliyor)`, () => {
        const h = bolumDogrula(v);
        expect(h).toHaveLength(1);
        expect(h[0]).toContain(bekleyen);
      });
      continue;
    }
    it(`bölüm ${v.id}${v.taslak ? ' (taslak)' : ''} "${v.ad}" temiz`, () => {
      expect(bolumDogrula(v)).toEqual([]);
    });
  }

  // Taban: bölüm 10, K21 karar bekleyen gizli çapraz sınırı olmadan.
  const b10 = bolumGetir(10)!;
  const kurallarB10 = { ...b10.kurallar };
  delete kurallarB10.caprazSiniri;
  const taban: BolumVerisi = { ...b10, kurallar: kurallarB10 };
  const bozuk = (ek: Partial<BolumVerisi>): string[] => bolumDogrula({ ...taban, ...ek });
  const icerir = (h: string[], parca: string): boolean => h.some((m) => m.includes(parca));

  it('aralıklar: boyut, eşik, renk, hamle, yardım', () => {
    expect(icerir(bozuk({ w: 9 }), 'w 5..8')).toBe(true);
    expect(icerir(bozuk({ esik: 2 }), 'eşik')).toBe(true);
    expect(icerir(bozuk({ renkSayisi: 7 }), 'renkSayisi')).toBe(true);
    expect(icerir(bozuk({ hamle: 31 }), 'hamle')).toBe(true);
    expect(icerir(bolumDogrula({ ...bolumGetir(22)!, yardim: 1 }), 'yardım > 0')).toBe(true);
    expect(bolumDogrula({ ...bolumGetir(101)!, esik: 2 })).toEqual([]);
  });

  it('simge ve satır uzunluğu', () => {
    const duzen = [...taban.duzen];
    duzen[0] = '. . . X . . .';
    expect(icerir(bozuk({ duzen }), 'bilinmeyen simge')).toBe(true);
    duzen[0] = '. . . . . .';
    expect(icerir(bozuk({ duzen }), 'simge, w=7')).toBe(true);
  });

  it('döşeme ve desen yalnız kapsül hücrelerinde; desen rengi < renkSayısı', () => {
    const duzen = [...taban.duzen];
    duzen[6] = 'K1 . . . . . .';
    expect(icerir(bozuk({ duzen }), 'döşeme kapsül hücresinde değil (0,6)')).toBe(true);
    const zemin = { desen: { motif: 'lale' as const, hucreler: [[0, 0, 5]] as [number, number, number][] } };
    expect(icerir(bozuk({ zemin }), 'desen rengi 5')).toBe(true);
  });

  it('hedefin nesnesi tahtada olmalı', () => {
    expect(icerir(bolumDogrula({ ...bolumGetir(6)!, hedefler: [{ tur: 'kafes' }] }), 'kafes hedefi')).toBe(true);
    expect(icerir(bolumDogrula({ ...bolumGetir(6)!, hedefler: [{ tur: 'kaya' }] }), 'kaya hedefi')).toBe(true);
    expect(icerir(bolumDogrula({ ...bolumGetir(6)!, hedefler: [{ tur: 'fener', adet: 1 }] }), 'fener hedefi')).toBe(true);
    expect(icerir(bolumDogrula({ ...bolumGetir(6)!, hedefler: [{ tur: 'topla', renk: 5, adet: 3 }] }), 'topla rengi')).toBe(true);
    expect(icerir(bolumDogrula({ ...bolumGetir(6)!, hedefler: [{ tur: 'puan', puan: 100 }] }), 'puan hedefi yalnız')).toBe(true);
  });

  it('fener çıkışlarına ulaşılabilir (§5)', () => {
    const v = bolumGetir(11)!;
    expect(bolumDogrula(v)).toEqual([]);
    expect(icerir(bolumDogrula({ ...v, cikislar: [0, 1, 3, 5, 6] }), 'çıkışa ulaşamaz')).toBe(true);
    expect(icerir(bolumDogrula({ ...v, cikislar: [0, 1, 2, 3, 4, 5] }), 'fener doğabilen sütun 6')).toBe(true);
  });

  it('barut izi 8-komşu ve tek kez', () => {
    const v = bolumGetir(21)!;
    const iz = v.zemin!.barutIzleri!;
    expect(icerir(bolumDogrula({ ...v, zemin: { ...v.zemin, barutIzleri: [[[0, 0], [2, 0]]] } }), '8-komşu değil')).toBe(true);
    expect(icerir(bolumDogrula({ ...v, zemin: { ...v.zemin, barutIzleri: [iz[0], iz[0]] } }), 'birden çok kez')).toBe(true);
  });

  it('başlangıç tahtası kilitsiz: yükleyici karıştırırsa hata', () => {
    // 5×6 tek tip satranç tahtası: her renk yalnız tek tek hücrelerde → kilitli.
    const duzen = Array.from({ length: 6 }, () => '. . . . .');
    const sabit: NonNullable<BolumVerisi['sabitKapsuller']> = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 5; x++) sabit.push({ x, y, renk: (x + 2 * y) % 5 });
    const v: BolumVerisi = { ...bolumGetir(1)!, renkSayisi: 5, duzen, sabitKapsuller: sabit, zorunluIlkHamle: undefined, ipuclari: undefined };
    const h = bolumDogrula(v);
    expect(icerir(h, 'karıştırdı'), h.join('; ')).toBe(true);
  });

  it('zorunlu ilk hamle hücrelerinde ≥ 3 düğümlü yol olmalı', () => {
    const v = bolumGetir(1)!;
    expect(icerir(bolumDogrula({ ...v, zorunluIlkHamle: [[0, 5], [1, 5]] }), 'zorunluIlkHamle')).toBe(true);
  });

  it('bant %35 altına inemez, yıldız eşikleri sıralı', () => {
    expect(icerir(bozuk({ botBandi: [30, 50] }), "%35'in altında")).toBe(true);
    expect(icerir(bozuk({ yildizEsikleri: [5000, 4000] }), 'yildizEsikleri')).toBe(true);
  });

  it('K21: ana ve Usta bölümlerinde gizli çapraz sınırı yok (24 Ekim 2026)', () => {
    expect(bozuk({})).toEqual([]);
    for (const c of [0, 1, 2, 6, null]) {
      const h = bozuk({ kurallar: { caprazSiniri: c } });
      expect(icerir(h, 'caprazSiniri tanımlı'), `caprazSiniri ${c}`).toBe(true);
      expect(icerir(h, 'oyuncuya görünmeyen kural; ürün sahibi kararı 24 Ekim 2026'), `caprazSiniri ${c}`).toBe(true);
    }
    // Görünür yedek düğme soğuma serbest.
    expect(bozuk({ kurallar: { soguma: 3 } })).toEqual([]);
    // Usta bölümünde de yasak (Usta kuralları açık kalır).
    const u = bolumGetir(104)!;
    expect(bolumDogrula(u)).toEqual([]);
    expect(icerir(bolumDogrula({ ...u, kurallar: { ...u.kurallar, caprazSiniri: 2 } }), 'caprazSiniri tanımlı')).toBe(true);
    expect(bolumDogrula({ ...bolumGetir(102)! })).toEqual([]);
  });

  it('K21: özel taş eşikleri yalnız 0 ya da standart 6 / 9 / 12', () => {
    for (const oz of [[6, 0, 0], [6, 9, 0], [6, 9, 12], [0, 9, 12], [6, 0, 12], [0, 0, 12]] as [number, number, number][])
      expect(icerir(bozuk({ ozelEsikleri: oz }), 'ozelEsikleri'), String(oz)).toBe(false);
    const yanlis: [[number, number, number], string][] = [
      [[7, 9, 12], 'ozelEsikleri[0] 7: yalnız 0 ya da 6'],
      [[6, 11, 14], 'ozelEsikleri[1] 11: yalnız 0 ya da 9'],
      [[6, 9, 13], 'ozelEsikleri[2] 13: yalnız 0 ya da 12'],
      [[5, 0, 0], 'ozelEsikleri[0] 5'],
      [[0, 6, 0], 'ozelEsikleri[1] 6'],
      [[9, 12, 0], 'ozelEsikleri[0] 9'],
    ];
    for (const [oz, parca] of yanlis) {
      const h = bozuk({ ozelEsikleri: oz });
      expect(icerir(h, parca), `${oz}: ${h.join('; ')}`).toBe(true);
      expect(icerir(h, 'oyuncuya görünmeyen kural'), String(oz)).toBe(true);
    }
    // [6, 11, 14] iki öğede de hata verir.
    expect(bozuk({ ozelEsikleri: [6, 11, 14] }).filter((m) => m.includes('ozelEsikleri[')).length).toBe(2);
    expect(icerir(bolumDogrula({ ...bolumGetir(105)!, ozelEsikleri: [6, 9, 14] }), 'ozelEsikleri[2] 14')).toBe(true);
  });

  it('K21 günlük ve sonsuz üretimine uygulanmaz (şema ve bot desteği kalır)', () => {
    // yardım 0: günlük/sonsuzda yardım > 0 hatası denetimi erken bitirmesin.
    for (const ek of [{ tur: 'gunluk' as const, id: 20261024 }, { tur: 'sonsuz' as const, id: 1_000_001 }]) {
      const temel = { ...ek, yardim: 0, muhurler: undefined };
      expect(bozuk(temel), ek.tur).toEqual([]);
      expect(bozuk({ ...temel, kurallar: { caprazSiniri: 2 } }), ek.tur).toEqual([]);
      expect(bozuk({ ...temel, ozelEsikleri: [7, 10, 14] }), ek.tur).toEqual([]);
    }
  });

  it('eşik kuralı (K24) yalnız k24 ve elle eşikle birlikte değil', () => {
    expect(bozuk({ esikKurali: 'k24', elleEsik: undefined })).toEqual([]);
    expect(icerir(bozuk({ esikKurali: 'k25' as 'k24' }), 'esikKurali')).toBe(true);
    expect(icerir(bozuk({ esikKurali: 'k24', elleEsik: true }), 'elleEsik')).toBe(true);
  });
});
