import { describe, expect, it } from 'vitest';
import { bolumuYukle, hamleHatasi, hamleUygula } from '../core/index';
import type { BolumVerisi, OyunDurumu } from '../core/index';
import { H, kur, rastgeleBolum, rastgeleHamle } from '../core/testAraclari';
import { acemiSec, BANTLAR, kazandiranBul, olcumHesapla, olcutHatalari, oyunOyna, ustaKarar, ustaSec, yildizEsikleriK13, yildizEsikleriOgretim, yuzdelik } from './index';
import type { OyunSonucu } from './index';
import b001 from '../levels/veri/b001.json';

const b1 = b001 as unknown as BolumVerisi;

function durumlar(n: number): OyunDurumu[] {
  const out: OyunDurumu[] = [];
  for (let k = 0; k < n; k++) {
    const r = { rng: k * 7919 + 3 };
    let d = bolumuYukle(rastgeleBolum(r, 6000 + k), 0);
    for (let a = 0; a < 6 && !d.bitti; a++) {
      out.push(d);
      const h = rastgeleHamle(d, r);
      if (!h) break;
      d = hamleUygula(d, h).durum;
    }
  }
  return out;
}

describe('botlar (§14)', () => {
  it('her zaman geçerli hamle seçer; aynı durum + tohum → aynı hamle', () => {
    for (const d of durumlar(25)) {
      const a = acemiSec(d, 11);
      const u = ustaSec(d, 11);
      expect(hamleHatasi(d, a)).toBeNull();
      expect(hamleHatasi(d, u)).toBeNull();
      expect(acemiSec(d, 11)).toEqual(a);
      expect(ustaSec(d, 11)).toEqual(u);
    }
  });

  it('Usta hedefi tamamlayan hamleyi seçer; zorunlu ilk hamleye uyar', () => {
    const d = kur(['1 2 4 1 2', '4 1 2 4 1', '3 3 2 1 4'], { hedefler: [{ tur: 'topla', renk: 3, adet: 3 }], dogum: [20, 20, 20, 0, 0, 0] });
    const k = ustaKarar(d, 5);
    expect(k.hamle).toEqual(H(3, 2, 2, 2));
    expect(k.V).toBeGreaterThan(900);
    const izin = H(0, 0, 1, 0);
    expect(ustaSec(d, 5, { izin })).toEqual(izin);
    expect(acemiSec(d, 5, { izin })).toEqual(izin);
  });

  it('Acemi amaca kördür ama hazır hamleleri çoğunlukla bulur (§14.2)', () => {
    let hazir = 0;
    let n = 0;
    for (const d of durumlar(30)) {
      const h = acemiSec(d, 3);
      n++;
      const s = hamleUygula(d, h);
      const oz = s.olaylar[s.olaylar.length - 1];
      if (oz.tur === 'hamleOzeti' && oz.eslesme) hazir++;
    }
    expect(hazir / n).toBeGreaterThan(0.4);
  });

  it('oyunOyna: bölüm 1 belirlenimli; Usta ve Acemi kazanır, şölen puanı eklenir', () => {
    const a = oyunOyna(b1, 3, 'usta');
    expect(oyunOyna(b1, 3, 'usta')).toEqual(a);
    expect(a.kazandi).toBe(true);
    expect(a.puan).toBeGreaterThan(a.puanSolenOncesi);
    expect(a.yildiz).toBeGreaterThanOrEqual(1);
    expect(oyunOyna(b1, 3, 'acemi').kazandi).toBe(true);
    expect(a.durum).toBe(a.hamle);
  });

  it('kazandiranBul: son hamlede kazandıran hamleyi bulur, yoksa null', () => {
    const d = kur(['1 2 4 1 2', '4 1 2 4 1', '3 3 2 1 4'], { hamle: 1, hedefler: [{ tur: 'topla', renk: 3, adet: 3 }], dogum: [20, 20, 20, 0, 0, 0] });
    const h = kazandiranBul(d)!;
    expect(hamleUygula(d, h).durum.bitti).toBe('kazanc');
    const z = kur(['1 2 4 1 2', '4 1 2 4 1', '3 4 2 1 4'], { hamle: 1, hedefler: [{ tur: 'topla', renk: 3, adet: 3 }], dogum: [20, 20, 20, 0, 0, 0] });
    expect(kazandiranBul(z)).toBeNull();
  });
});

describe('ölçütler ve yıldızlar (§14.4, K13)', () => {
  const sonuc = (kazandi: boolean, puan: number, ek: Partial<OyunSonucu> = {}): OyunSonucu => ({
    bolumId: 1, tohum: 0, bot: 'usta', kazandi, puan, puanSolenOncesi: puan, yildiz: 1, hamle: 20, ilerleme: kazandi ? 1 : 0.9,
    eslesenHamle: 15, durum: 20, hazir2: 19, hazir0: 0, tarak: 3, girdap: 0, lale: 0, murekkep: 0, birlesim: 0, kaskatlar: Array(20).fill(1),
    garantiKullanimi: 4, karistirma: 0, sureMs: 70_000, ...ek,
  });

  it('yüzdelik en yakın sıra', () => {
    expect(yuzdelik([1, 2, 3, 4], 50)).toBe(2);
    expect(yuzdelik([1, 2, 3, 4], 85)).toBe(4);
    expect(yuzdelik([], 50)).toBe(0);
  });

  it('K13: 2★ = min(Usta p50, Acemi kazanç p50), 3★ = Usta p85, aşağı 100', () => {
    const usta = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000].map((p) => sonuc(true, p + 55));
    const acemi = [500, 1500, 2500, 3500].map((p) => sonuc(true, p + 99, { bot: 'acemi' }));
    const o = olcumHesapla(b1, usta, acemi);
    expect(o.ustaP50).toBe(5055);
    expect(o.ustaP85).toBe(9055);
    expect(o.acemiP50).toBe(1599);
    expect(yildizEsikleriK13(o)).toEqual([1500, 9000]);
    expect(yildizEsikleriOgretim(o)).toEqual([1500, 5000]);
    // Acemi hiç kazanmadıysa 2★ = Usta p50.
    expect(yildizEsikleriK13(olcumHesapla(b1, usta, [sonuc(false, 10)]))).toEqual([5000, 9000]);
  });

  it('bant ve ek ölçüt hataları', () => {
    const v: BolumVerisi = { ...b1, tur: 'normal', botBandi: BANTLAR.normal.usta, acemiAlt: BANTLAR.normal.acemi };
    const iyi = olcumHesapla(v, Array.from({ length: 20 }, (_, k) => sonuc(k < 18, 3000)), Array.from({ length: 20 }, (_, k) => sonuc(k < 8, 2000, { bot: 'acemi' })));
    expect(olcutHatalari(v, iyi)).toEqual([]);
    const kotu = olcumHesapla(v, Array.from({ length: 20 }, (_, k) => sonuc(k < 10, 3000, { hazir2: 10, tarak: 9 })), [sonuc(false, 0, { bot: 'acemi', eslesenHamle: 5 })]);
    const h = olcutHatalari(v, kotu);
    expect(h.some((x) => x.startsWith('Usta %50'))).toBe(true);
    expect(h.some((x) => x.startsWith('Acemi %0'))).toBe(true);
    expect(h.some((x) => x.startsWith('≥ 2 hazır'))).toBe(true);
    expect(h.some((x) => x.startsWith('Acemi eşleşen'))).toBe(true);
    expect(h.some((x) => x.startsWith('Tarak'))).toBe(true);
  });
});
