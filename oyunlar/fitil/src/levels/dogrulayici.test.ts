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
  for (const v of TUM_BOLUMLER) {
    it(`bölüm ${v.id}${v.taslak ? ' (taslak)' : ''} "${v.ad}" temiz`, () => {
      expect(bolumDogrula(v)).toEqual([]);
    });
  }

  const taban = bolumGetir(10)!;
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

  it('eşik kuralı (K24) yalnız k24 ve elle eşikle birlikte değil', () => {
    expect(bozuk({ esikKurali: 'k24', elleEsik: undefined })).toEqual([]);
    expect(icerir(bozuk({ esikKurali: 'k25' as 'k24' }), 'esikKurali')).toBe(true);
    expect(icerir(bozuk({ esikKurali: 'k24', elleEsik: true }), 'elleEsik')).toBe(true);
  });
});
