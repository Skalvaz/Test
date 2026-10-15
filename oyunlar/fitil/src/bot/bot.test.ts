/**
 * Bot (GDD §16.5): belirlenimlilik, aday kuralları, dürüst değerlendirme,
 * "Bu çizgi kazandırırdı", ölçütler.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, durumKarmasi, hamleUygula, yolDogrula } from '../core/index';
import type { BolumVerisi, OyunDurumu } from '../core/index';
import { bolum as testBolumu, kur } from '../core/testAraclari';
import { bolumGetir } from '../levels/index';
import { SINIR, adaylariUret, sonEksen, tahtaBilgi } from './adaylar';
import { acemiEnIyiAday, acemiSec } from './acemi';
import { kazandiranBul } from './kazandiranBul';
import { olcumHesapla, olcutHatalari, yildizEsikleriK24, yildizEsikleriOgretim, yuzdelik } from './olcut';
import { botTohumlari, botTohumuTuret, degerV, korukMerkezi } from './ortak';
import { oyunAdimlari, oyunOyna } from './simulasyon';
import { ustaKarar, ustaSec } from './usta';

const b = (id: number): BolumVerisi => bolumGetir(id)!;

/** Durumu derin dondur (hamleUygula / bot girdiyi değiştirmemeli). */
function dondur<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) dondur(v);
    Object.freeze(o);
  }
  return o;
}

describe('belirlenimlilik', () => {
  it('Usta: aynı (bölüm, tohum) aynı oyun', () => {
    for (const [id, t] of [
      [1, 0],
      [5, 3],
      [10, 7],
    ]) {
      const a = oyunOyna(b(id), t, 'usta');
      const c = oyunOyna(b(id), t, 'usta');
      expect(c).toEqual(a);
    }
  });

  it('Acemi: aynı (bölüm, tohum) aynı oyun', () => {
    expect(oyunOyna(b(6), 11, 'acemi')).toEqual(oyunOyna(b(6), 11, 'acemi'));
  });

  it('farklı tohum farklı oyun (dolum akışı ve bot tohumu)', () => {
    const a = oyunOyna(b(7), 1, 'usta');
    const c = oyunOyna(b(7), 2, 'usta');
    expect([a.puan, a.reaksiyonlar]).not.toEqual([c.puan, c.reaksiyonlar]);
  });

  it('bot kararı girdiyi değiştirmez', () => {
    const d = dondur(bolumuYukle(b(10), 0));
    const k = durumKarmasi(d);
    expect(() => ustaSec(d, 123)).not.toThrow();
    expect(() => acemiSec(d, 123)).not.toThrow();
    expect(durumKarmasi(d)).toBe(k);
  });

  it('üretici sürüm (yield) ile düz sürüm aynı sonucu verir', () => {
    const g = oyunAdimlari(b(8), 4, 'usta');
    let r = g.next();
    let adim = 0;
    while (!r.done) {
      adim++;
      r = g.next();
    }
    expect(adim).toBeGreaterThan(3);
    expect(r.value).toEqual(oyunOyna(b(8), 4, 'usta'));
  });
});

describe('aday üretimi (§16.5 adım 1–4)', () => {
  it('her aday geçerli yol, ≤ 2000, yinelenen yok', () => {
    for (const id of [1, 6, 9, 10]) {
      const d = bolumuYukle(b(id), 0);
      const tb = tahtaBilgi(d);
      const adaylar = adaylariUret(tb, { rng: 1 });
      expect(adaylar.length).toBeGreaterThan(10);
      expect(adaylar.length).toBeLessThanOrEqual(SINIR.toplam);
      const anahtar = new Set<string>();
      for (const a of adaylar) {
        const yol = a.yol.map((i) => ({ x: i % d.w, y: Math.floor(i / d.w) }));
        expect(yolDogrula(d, yol, a.halka), `bölüm ${id} ${JSON.stringify(yol)}`).toBeNull();
        const n = a.yol.length;
        const k = `${[...a.yol].sort((x, y) => x - y).join(',')}|${a.halka || n < 6 ? '' : `${a.yol[n - 1]}:${sonEksen(d.w, a.yol[n - 2], a.yol[n - 1])}`}|${a.halka}`;
        expect(anahtar.has(k)).toBe(false);
        anahtar.add(k);
      }
    }
  });

  it('halkalar (2×2 ve DFS) ve roket nişan varyantları bulunur', () => {
    // 2×2 kehribar kare (bölüm 8) halka adayı olmalı.
    const d = bolumuYukle(b(8), 0);
    const adaylar = adaylariUret(tahtaBilgi(d), { rng: 5 });
    const kare = [5 * 7 + 1, 5 * 7 + 2, 6 * 7 + 1, 6 * 7 + 2].sort((x, y) => x - y).join(',');
    expect(adaylar.some((a) => a.halka && [...a.yol].sort((x, y) => x - y).join(',') === kare)).toBe(true);
    // Bölüm 5: 6'lık zümrüt yol çaprazda biten varyantıyla (eksen 2) bulunur.
    const d5 = bolumuYukle(b(5), 0);
    const a5 = adaylariUret(tahtaBilgi(d5), { rng: 9 });
    expect(a5.some((a) => !a.halka && a.yol.length >= 6 && a.yol[a.yol.length - 1] === 2 * 7 + 5 && sonEksen(7, a.yol[a.yol.length - 2], a.yol[a.yol.length - 1]) === 2)).toBe(true);
  });

  it('zorunlu ilk hamle: adaylar yalnız izinli hücrelerden', () => {
    const v = b(2);
    const d = bolumuYukle(v, 0);
    const izin = new Set(v.zorunluIlkHamle!.map(([x, y]) => y * d.w + x));
    const adaylar = adaylariUret(tahtaBilgi(d, v.zorunluIlkHamle!), { rng: 3 });
    expect(adaylar.length).toBeGreaterThan(0);
    for (const a of adaylar) for (const i of a.yol) expect(izin.has(i)).toBe(true);
    // Usta ilk hamlede kısıta uyar.
    const h = ustaSec(d, 1, { izin: v.zorunluIlkHamle! });
    expect(h.tur).toBe('fitil');
    if (h.tur === 'fitil') for (const p of h.yol) expect(izin.has(p.y * d.w + p.x)).toBe(true);
  });

  it('yalnizHalka: yalnız halka adayları; dortKomsu: çapraz adım yok', () => {
    const halkali = { ...b(102), taslak: false };
    const d = bolumuYukle(halkali, 0);
    const a = adaylariUret(tahtaBilgi(d), { rng: 2 });
    expect(a.every((x) => x.halka)).toBe(true);
    const d4 = bolumuYukle(b(103), 0);
    for (const x of adaylariUret(tahtaBilgi(d4), { rng: 2 })) {
      for (let k = 1; k < x.yol.length; k++) {
        const p = x.yol[k - 1];
        const q = x.yol[k];
        expect(Math.abs((p % 7) - (q % 7)) + Math.abs(Math.floor(p / 7) - Math.floor(q / 7))).toBe(1);
      }
    }
  });

  it('caprazSiniri: yollar sınırı aşmaz', () => {
    const d = bolumuYukle({ ...b(10), kurallar: { caprazSiniri: 1 } }, 0);
    for (const a of adaylariUret(tahtaBilgi(d), { rng: 4 })) {
      let c = 0;
      for (let k = 1; k < a.yol.length; k++) if (a.yol[k - 1] % 7 !== a.yol[k] % 7 && Math.floor(a.yol[k - 1] / 7) !== Math.floor(a.yol[k] / 7)) c++;
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

describe('dürüst değerlendirme ve V (§16.5)', () => {
  it('değerlendirme RNG’si mulberry32(durumKarmasi ^ botTohumu), gerçek RNG değil', () => {
    const d = bolumuYukle(b(7), 3);
    const t = botTohumlari(d, 77);
    expect(t.karma).toBe(durumKarmasi(d));
    expect(t.degerlendirme).not.toBe(d.rng);
    expect(botTohumlari(d, 77)).toEqual(t);
  });

  it('kazandıran hamle her zaman seçilir', () => {
    // Tek renk tahta; hedef 3 kapsül: her yol kazandırır, Usta kazanmalı.
    const d = kur(['M M M', 'R G Z', 'G Z R', 'Z R G', 'R G Z', 'G Z R'], { hedefler: [{ tur: 'topla', renk: 4, adet: 3 }], hamle: 5 });
    const k = ustaKarar(d, 1);
    const r = hamleUygula(d, k.hamle);
    expect(r.durum.bitti).toBe('kazanc');
  });

  it('V: hamleler bitip kazanç yoksa ceza', () => {
    const d = kur(['M M M M', 'R G Z R', 'G Z R G', 'Z R G Z', 'R G Z R', 'G Z R G'], { hedefler: [{ tur: 'topla', renk: 0, adet: 99 }], hamle: 1 });
    const r = hamleUygula(d, { tur: 'fitil', yol: [0, 1, 2].map((x) => ({ x, y: 0 })), halka: false });
    expect(r.durum.bitti).toBe('kayip');
    const sonraki: OyunDurumu = { ...r.durum, bitti: null, kalanHamle: 1 };
    expect(degerV(d, r.durum)).toBeLessThan(degerV(d, sonraki) - 250);
  });

  it('Körük merkezi en çok eşik hücresi üretir', () => {
    const d = kur(['R G Z R G', 'G R3 G Z R', 'Z G3 R3 G Z', 'R Z G R G', 'G R Z G R', 'Z G R Z G'], { korukKapasitesi: 5 });
    expect(korukMerkezi(tahtaBilgi(d))).toEqual({ x: 1, y: 1 });
  });
});

describe('Bu çizgi kazandırırdı (kazandiranBul)', () => {
  it('son hamleden önceki durumda kazandıran yolu bulur, yoksa null', () => {
    // Bölüm 1, kalan 1 hamle; hedefe 5 kapsül kaldı: 5'lik bir zincir kazandırır.
    const d0 = bolumuYukle(b(1), 0);
    const d: OyunDurumu = { ...d0, kalanHamle: 1, hedefler: d0.hedefler.map((h) => ({ ...h, ilerleme: h.gerekli - 5 })) };
    const y = kazandiranBul(d, { butce: 400 });
    expect(y).not.toBeNull();
    expect(hamleUygula(d, { tur: 'fitil', yol: y!.yol, halka: y!.halka }).durum.bitti).toBe('kazanc');
    // Hedefe 40 kaldıysa tek hamlede kazanılamaz.
    const imkansiz: OyunDurumu = { ...d0, kalanHamle: 1, hedefler: d0.hedefler.map((h) => ({ ...h, gerekli: 40 })) };
    expect(kazandiranBul(imkansiz, { butce: 50 })).toBeNull();
    // Bitmiş oyunda arama yok.
    expect(kazandiranBul({ ...d, bitti: 'kayip' })).toBeNull();
  });
});

describe('boşta ipucu (§15)', () => {
  it('Acemi’nin en iyi adayı: en uzun geçerli yol, belirlenimli', () => {
    const d = bolumuYukle(b(6), 0);
    const yol = acemiEnIyiAday(d, 3);
    expect(yol).not.toBeNull();
    expect(yolDogrula(d, yol!, false)).toBeNull();
    expect(acemiEnIyiAday(d, 3)).toEqual(yol);
    const enUzun = Math.max(...adaylariUret(tahtaBilgi(d), botTohumlari(d, 3).siralama).filter((a) => !a.halka).map((a) => a.yol.length));
    expect(yol!.length).toBe(enUzun);
  });
});

describe('ölçütler (§16.5)', () => {
  it('yüzdelik (en yakın sıra)', () => {
    const a = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(yuzdelik(a, 50)).toBe(50);
    expect(yuzdelik(a, 90)).toBe(90);
    expect(yuzdelik(a, 99)).toBe(99);
    expect(yuzdelik([], 50)).toBe(0);
  });

  // 10 Usta oyunu tek başına ~2 sn; tam koşuda (50 dosya paralel) yük altında 5 sn'yi aşabiliyor.
  it('bant ve reaksiyon ölçütleri hata verir', { timeout: 30_000 }, () => {
    const v = testBolumu(['R G Z', 'G Z R', 'Z R G', 'R G Z', 'G Z R', 'Z R G'], { botBandi: [45, 55] });
    const sonuc = Array.from({ length: 10 }, (_, k) => oyunOyna(v, k, 'usta'));
    const o = olcumHesapla(v, sonuc);
    const h = olcutHatalari(v, { ...o, kazanmaOrani: 90, rP99: 50 });
    expect(h.some((m) => m.includes('bant'))).toBe(true);
    expect(h.some((m) => m.includes('p99'))).toBe(true);
  });

  it('öğretim yıldız eşiği önerisi (K22): 2★ Acemi p40 / Usta p15, 3★ Acemi p85 ile Usta p50 arası', () => {
    const dizi = (a: number, b: number): number[] => Array.from({ length: 100 }, (_, i) => a + ((b - a) * i) / 99);
    // Acemi 2000–3000 (p40 ≈ 2400, p85 ≈ 2850), Usta 2600–3400 (p15 ≈ 2720, p50 ≈ 2990).
    expect(yildizEsikleriOgretim(dizi(2600, 3400), dizi(2000, 3000))).toEqual([2300, 2900]);
    // Acemi Usta'dan çok puan topluyorsa (Usta erken bitirir): 3★ = Usta p50, 2★ ≤ 3★.
    const [iki, uc] = yildizEsikleriOgretim(dizi(4000, 4600), dizi(5000, 7000));
    expect(uc).toBe(4200);
    expect(iki).toBeLessThanOrEqual(uc);
    expect(iki).toBe(4000);
  });

  it('K24 eşikleri: 2★ = min(Usta p50, Acemi p50), 3★ = Usta p85', () => {
    const dizi = (a: number, b: number): number[] => Array.from({ length: 100 }, (_, i) => a + ((b - a) * i) / 99);
    // Usta 8000–12000 (p50 ≈ 9980, p85 ≈ 11390), Acemi 6000–8000 (p50 ≈ 6990).
    expect(yildizEsikleriK24(dizi(8000, 12000), dizi(6000, 8000))).toEqual([6900, 11300]);
    // Acemi Usta'dan çok puanlıysa 2★ = Usta p50 (§7.4 ile aynı).
    expect(yildizEsikleriK24(dizi(8000, 12000), dizi(11000, 13000))).toEqual([9900, 11300]);
    // Acemi kazancı yoksa §7.4'e düşer.
    expect(yildizEsikleriK24(dizi(8000, 12000), [])).toEqual([9900, 11300]);
  });

  it('bot tohumu tohumdan türetilir ve tohumla değişir', () => {
    expect(botTohumuTuret(5)).toBe(botTohumuTuret(5));
    expect(botTohumuTuret(5)).not.toBe(botTohumuTuret(6));
  });
});
