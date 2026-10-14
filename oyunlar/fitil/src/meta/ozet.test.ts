import { describe, expect, it } from 'vitest';
import { bolumuYukle } from '../core/bolumYukle';
import type { BolumVerisi, Olay } from '../core/types';
import b001 from '../levels/veri/b001.json';
import {
  nadirlikHesapla,
  nadirlikAdi,
  patlamaKaydi,
  seyrelt,
  tabloCoz,
  tabloKaydiCoz,
  tabloKaydiPaketle,
  tabloKayitlari,
  tabloKodla,
  tabloSec,
  tabloTohumu,
  tabloUret,
} from './galeri';
import { tabloKoduGecerli } from './kayit';
import { olaylardanOzet, ozetBaslat, ozetFinal, ozetHamle } from './ozet';
import { TABLO_BOSLUK } from './sabitler';
import { O } from './_test/yardimci';

describe('olay özeti', () => {
  it('fitil hamlesi: zincir, halka, renk, ısı, nesil, R', () => {
    const olaylar: Olay[] = [
      O.fitil([[0, 5], [1, 5], [2, 5], [3, 5]], true, 0),
      O.patlama(0, 5, 0, { k: 1 }),
      O.patlama(1, 5, 0, { k: 2, t: 103 }),
      O.patlama(2, 5, 0, { k: 3, t: 199 }),
      O.patlama(3, 5, 0, { k: 4, t: 288 }),
      O.patlama(1, 4, 1, { t: 193, neden: 'isi', nesil: 1 }),
      O.patlama(1, 3, 3, { t: 283, neden: 'isi', nesil: 2 }),
      O.patlama(2, 3, -1, { t: 300, neden: 'vurus', nesil: 2, ozel: 'yildiz' }),
      O.reaksiyon(3, 290),
    ];
    const oz = ozetHamle(ozetBaslat(), olaylar);
    expect(oz.enUzunZincir).toBe(4);
    expect(oz.halka).toBe(1);
    expect(oz.renkPatlama).toEqual([4, 1, 0, 1, 0, 0]);
    expect(oz.yildizPatlama).toBe(1);
    expect(oz.toplamPatlama).toBe(7);
    expect(oz.isiPatlamasi).toBe(2);
    expect(oz.enCokNesil).toBe(2);
    expect(oz.reaksiyonlar).toEqual([3]);
    expect(oz.oyuncuHamlesi).toBe(1);
    expect(oz.enBuyukReaksiyon).toBe(3);
    expect(oz.tablo.reaksiyonlar.length).toBe(1);
    expect(oz.tablo.reaksiyonlar[0].kayitlar.length).toBe(7);
  });

  it('R olayı yoksa fitil dışı patlamalardan sayılır; girdi değişmez', () => {
    const o0 = ozetBaslat();
    const o1 = ozetHamle(o0, [O.fitil([[0, 0], [1, 0], [2, 0]]), O.patlama(0, 0, 0, { k: 1 }), O.patlama(0, 1, 0), O.patlama(1, 1, 0)]);
    expect(o1.reaksiyonlar).toEqual([2]);
    expect(o0.reaksiyonlar).toEqual([]);
    expect(o0.toplamPatlama).toBe(0);
  });

  it('eylem türleri: çift dokunuş hamle sayılır, körük ve güçlendirici sayılmaz', () => {
    let oz = ozetBaslat();
    oz = ozetHamle(oz, [O.ozel(2, 2, 'roket', 0), O.patlama(2, 2, 0, { ozel: 'roket' })]);
    oz = ozetHamle(oz, [O.koruk(), O.patlama(3, 3, 0, { neden: 'isi', nesil: 1 }), O.reaksiyon(12)]);
    oz = ozetHamle(oz, [{ t: 0, tur: 'guclendirici', guc: 'kibrit', hucre: { x: 1, y: 1 } }, O.patlama(1, 1, 2, { neden: 'kibrit' })]);
    expect(oz.oyuncuHamlesi).toBe(1);
    expect(oz.reaksiyonlar.length).toBe(1);
    expect(oz.korukKullanim).toBe(1);
    expect(oz.korukEnBuyukR).toBe(12);
    expect(oz.roketAtesi).toBe(1);
    expect(oz.eylem).toBe(3);
  });

  it('çapraz roket atfı: yalnız eksen üstünde ve tam T + 25·d anında', () => {
    // ↘ (eksen 3) roket (2,2)'de t=100: (3,3) t=125, (4,4) t=150, (1,1) t=125
    const olaylar: Olay[] = [
      O.ozel(2, 2, 'roket', 3, 100),
      O.kafes(3, 3, 125),
      O.engel(4, 4, 'kaya', 0, 150),
      O.kafes(1, 1, 125),
      O.kafes(5, 5, 160), // zaman tutmuyor (175 olmalı)
      O.kafes(2, 3, 125), // eksen dışı
      O.isTemiz(0, 0, 150),
      O.devDoldu(6, 6, 200),
    ];
    const oz = ozetHamle(ozetBaslat(), olaylar);
    expect(oz.caprazRoketKafes).toBe(2);
    expect(oz.caprazRoketEngel).toBe(5);
    // ↗ (eksen 2): (x+1, y−1)
    const oz2 = ozetHamle(ozetBaslat(), [O.ozel(2, 2, 'roket', 2, 0), O.kafes(3, 1, 25), O.kafes(1, 3, 25), O.kafes(3, 3, 25)]);
    expect(oz2.caprazRoketKafes).toBe(2);
    // Düz roket sayılmaz
    const oz3 = ozetHamle(ozetBaslat(), [O.ozel(2, 2, 'roket', 0, 0), O.kafes(3, 2, 25)]);
    expect(oz3.caprazRoketKafes).toBe(0);
  });

  it('barut iziyle dev fişek: iz hücresinde ya da dik komşusunda, önce yanmış iz', () => {
    const oz = ozetHamle(ozetBaslat(), [
      O.iz(0, 0, 0),
      O.iz(1, 0, 60),
      O.devFisek(1, 1, 300), // (1,0) dik komşu
      O.devFisek(5, 5, 400), // izden uzak
      O.iz(3, 3, 500),
      O.devFisek(3, 4, 450), // iz sonra yandı
    ]);
    expect(oz.devFisekAtesi).toBe(3);
    expect(oz.izliDevFisek).toBe(1);
  });

  it('Sar ve Pişir: yolun 3 düğümü kafesin dik komşusu ve kafes ısındı (durumdan)', () => {
    const d = bolumuYukle(b001 as unknown as BolumVerisi, 0);
    d.hucreler[2 * d.w + 1].kafes = true; // (1,2)
    const yol: [number, number][] = [[0, 2], [0, 3], [1, 3], [2, 3], [2, 2]];
    const oz = ozetHamle(ozetBaslat(), [O.fitil(yol), O.isindi(1, 2, 100), O.isindi(1, 2, 200), O.isindi(1, 2, 300)], { onceki: d });
    expect(oz.sarVePisir).toBe(true);
    // Isınmadıysa (kalkan) sayılmaz
    const oz2 = ozetHamle(ozetBaslat(), [O.fitil(yol)], { onceki: d });
    expect(oz2.sarVePisir).toBe(false);
    // Durum yoksa kırılan kafeslerden
    const oz3 = ozetHamle(ozetBaslat(), [O.fitil(yol), O.kafes(1, 2, 400)]);
    expect(oz3.sarVePisir).toBe(true);
    // İki komşu yetmez
    const oz4 = ozetHamle(ozetBaslat(), [O.fitil([[0, 2], [0, 3], [1, 3]]), O.kafes(1, 2, 400)]);
    expect(oz4.sarVePisir).toBe(false);
  });

  it('kombinasyon, döşeme, fener, kaya, en büyük 3 reaksiyon segmenti', () => {
    let oz = ozetBaslat();
    const R = [2, 30, 5, 18, 30, 1];
    R.forEach((r, i) => {
      const ol: Olay[] = [O.fitil([[0, 0], [1, 0], [2, 0]])];
      for (let j = 0; j < r; j++) ol.push(O.patlama(j % 7, (j / 7) | 0, j % 5, { t: 100 + j * 10, neden: 'isi', nesil: 1 }));
      ol.push(O.reaksiyon(r));
      if (i === 1) ol.push(O.kombo('buyukFinal'), O.doseme(1, 1), O.fener(), O.engel(2, 2, 'kaya', 1), O.engel(2, 2, 'kaya', 0));
      oz = ozetHamle(oz, ol);
    });
    expect(oz.kombolar).toEqual(['buyukFinal']);
    expect(oz.dosemeAydinlanan).toBe(1);
    expect(oz.fenerToplanan).toBe(1);
    expect(oz.engelHasar).toBe(2);
    expect(oz.kayaYokEdilen).toBe(1);
    expect(oz.tablo.reaksiyonlar.map((s) => s.boyut)).toEqual([30, 30, 18]);
    expect(oz.tablo.reaksiyonlar.map((s) => s.sira)).toEqual([2, 5, 4]); // eşitlikte erken gelen önde
    expect(oz.reaksiyonlar).toEqual(R);
  });

  it('olaylardanOzet eylem eylem işlemekle aynı', () => {
    const a: Olay[] = [O.fitil([[0, 0], [1, 0], [2, 0]]), O.patlama(0, 0, 1, { k: 1 }), O.reaksiyon(0)];
    const b: Olay[] = [O.koruk(), O.patlama(3, 3, 2, { neden: 'isi', nesil: 1 }), O.reaksiyon(1)];
    const f: Olay[] = [O.final(2), O.ozel(1, 1, 'roket', 1, 0)];
    expect(olaylardanOzet([a, b], f)).toEqual(ozetFinal(ozetHamle(ozetHamle(ozetBaslat(), a), b), f));
  });

  it('final: roket ve patlama sayılır, tek hamle rekoruna girmez', () => {
    let oz = ozetHamle(ozetBaslat(), [O.fitil([[0, 0], [1, 0], [2, 0]]), O.reaksiyon(4)]);
    const fin: Olay[] = [O.final(6)];
    for (let i = 0; i < 6; i++) fin.push(O.ozel(i, 1, 'roket', (i % 4) as 0 | 1 | 2 | 3, i * 120), O.patlama(i, 1, 1, { t: i * 120, neden: 'final', ozel: 'roket' }));
    for (let i = 0; i < 40; i++) fin.push(O.patlama(i % 7, 2 + (i % 5), i % 5, { t: 800 + i * 5, neden: 'vurus' }));
    fin.push(O.reaksiyon(46));
    oz = ozetFinal(oz, fin);
    expect(oz.finalRoket).toBe(6);
    expect(oz.finalPatlama).toBe(46);
    expect(oz.enBuyukReaksiyon).toBe(4);
    expect(oz.reaksiyonlar).toEqual([4]);
    expect(oz.tablo.final.length).toBe(46);
  });
});

describe('Gece Tablosu kaydı (32 bit)', () => {
  it('bit yerleşimi: x 0–3, y 4–7, renk 8–10, nesil 11–14, özel 15–17, t/10 18–31', () => {
    const n = tabloKaydiPaketle({ x: 7, y: 9, renk: 5, nesil: 3, ozel: 2, t: 1234 });
    expect(n & 15).toBe(7);
    expect((n >>> 4) & 15).toBe(9);
    expect((n >>> 8) & 7).toBe(5);
    expect((n >>> 11) & 15).toBe(3);
    expect((n >>> 15) & 7).toBe(2);
    expect(n >>> 18).toBe(1234);
    // src/render/tablo.ts ile aynı formül
    const render = (k: { x: number; y: number; renk: number; nesil: number; ozel: number; t: number }) =>
      ((k.x & 15) | ((k.y & 15) << 4) | ((k.renk < 0 ? 7 : k.renk & 7) << 8) | ((k.nesil & 15) << 11) | ((k.ozel & 7) << 15) | ((Math.min(16383, Math.max(0, k.t)) & 16383) << 18)) >>> 0;
    for (const k of [{ x: 0, y: 0, renk: 0, nesil: 0, ozel: 0, t: 0 }, { x: 15, y: 15, renk: -1, nesil: 15, ozel: 3, t: 16383 }, { x: 3, y: 8, renk: 4, nesil: 1, ozel: 1, t: 77 }]) {
      expect(tabloKaydiPaketle(k)).toBe(render(k));
    }
  });

  it('gidiş-dönüş, yıldız topu 7, taşan değerler kırpılır', () => {
    for (let i = 0; i < 500; i++) {
      const k = { x: i % 8, y: i % 10, renk: i % 6, nesil: i % 16, ozel: i % 4, t: (i * 97) % 16384 };
      expect(tabloKaydiCoz(tabloKaydiPaketle(k))).toEqual(k);
    }
    expect(tabloKaydiCoz(tabloKaydiPaketle({ x: 1, y: 1, renk: -1, nesil: 40, ozel: 3, t: 99999 }))).toEqual({ x: 1, y: 1, renk: 7, nesil: 15, ozel: 3, t: 16383 });
    expect(tabloKaydiCoz(patlamaKaydi({ hucre: { x: 2, y: 3 }, renk: 4, nesil: 2, ozel: 'kasimpati' }, 1259))).toEqual({ x: 2, y: 3, renk: 4, nesil: 2, ozel: 2, t: 125 });
  });

  it('base64: 250 kayıt ≈ 1,3 KB; bozuk kod reddedilir', () => {
    const kayitlar = Array.from({ length: 250 }, (_, i) => tabloKaydiPaketle({ x: i % 8, y: i % 10, renk: i % 6, nesil: i % 4, ozel: i % 4, t: i * 7 }));
    const kod = tabloKodla(kayitlar);
    expect(kod.length).toBeGreaterThan(1300);
    expect(kod.length).toBeLessThan(1400);
    expect(tabloKoduGecerli(kod)).toBe(true);
    expect(tabloCoz(kod)).toEqual(kayitlar);
    expect(tabloKayitlari(kod)![10]).toEqual(tabloKaydiCoz(kayitlar[10]));
    expect(tabloCoz('abc')).toBeNull();
    expect(tabloCoz(tabloKodla([...kayitlar, 1]))).toBeNull(); // 251 > sınır
    expect(tabloCoz(Buffer.from([1, 2, 3]).toString('base64'))).toBeNull();
  });

  it('seçim: reaksiyonlar sırayla, aralarda boşluk; final en sonda; ≤ 250', () => {
    const seg = (sira: number, boyut: number, n: number, sure: number) => ({ sira, boyut, sure, kayitlar: Array.from({ length: n }, (_, i) => tabloKaydiPaketle({ x: i % 8, y: 0, renk: 0, nesil: 1, ozel: 0, t: (i * sure) / n / 10 })) });
    const h = { reaksiyonlar: [seg(5, 30, 40, 900), seg(2, 20, 30, 600)], final: Array.from({ length: 50 }, (_, i) => tabloKaydiPaketle({ x: 0, y: 1, renk: 1, nesil: 0, ozel: 1, t: i * 12 })), finalSure: 600 };
    const s = tabloSec(h).map(tabloKaydiCoz);
    expect(s.length).toBe(120);
    // Önce 2. hamlenin segmenti (sira 2), sonra 5.
    expect(s[0].t).toBe(0);
    expect(s[30].t).toBe(Math.floor((600 + TABLO_BOSLUK) / 10));
    expect(s[70].t).toBe(Math.floor((600 + TABLO_BOSLUK + 900 + TABLO_BOSLUK) / 10));
    for (let i = 1; i < s.length; i++) expect(s[i].t).toBeGreaterThanOrEqual(s[i - 1].t);
    // Taşma: 3 × 80 reaksiyon + 300 final → 250; reaksiyonlara ≥ 150
    const buyuk = { reaksiyonlar: [seg(1, 50, 80, 2000), seg(2, 40, 80, 2000), seg(3, 30, 80, 2000)], final: Array.from({ length: 300 }, (_, i) => tabloKaydiPaketle({ x: 0, y: 0, renk: 2, nesil: 0, ozel: 0, t: i })), finalSure: 3000 };
    const t = tabloSec(buyuk);
    expect(t.length).toBe(250);
    expect(t.filter((n) => tabloKaydiCoz(n).renk === 2).length).toBe(100);
    // Final azsa reaksiyonlar daha çok yer alır (230 + 20)
    const az = tabloSec({ ...buyuk, final: buyuk.final.slice(0, 20) });
    expect(az.length).toBe(250);
    expect(az.filter((n) => tabloKaydiCoz(n).renk === 2).length).toBe(20);
  });

  it('seyrelt eşit aralıklı ve belirlenimli', () => {
    expect(seyrelt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5)).toEqual([0, 2, 4, 6, 8]);
    expect(seyrelt([1, 2], 5)).toEqual([1, 2]);
  });

  it('nadirlik (§10.3)', () => {
    const n = (yildiz: number, R: number, halka: number, bf = false) => nadirlikHesapla({ yildiz, enBuyukReaksiyon: R, halka, buyukFinal: bf });
    expect(n(1, 10, 0)).toBe(0);
    expect(n(2, 24, 1)).toBe(0);
    expect(n(3, 0, 0)).toBe(1);
    expect(n(1, 25, 0)).toBe(1);
    expect(n(1, 0, 2)).toBe(1);
    expect(n(1, 40, 0)).toBe(2);
    expect(n(1, 0, 0, true)).toBe(2);
    expect([0, 1, 2].map((x) => nadirlikAdi(x as 0 | 1 | 2))).toEqual(['Sade', 'Parlak', 'Şaheser']);
  });

  it('tablo üretimi ve çizici tohumu', () => {
    expect(tabloUret({ reaksiyonlar: [], final: [], finalSure: 0 }, 0)).toBeNull();
    const t = tabloUret({ reaksiyonlar: [], final: [tabloKaydiPaketle({ x: 1, y: 1, renk: 1, nesil: 0, ozel: 0, t: 0 })], finalSure: 0 }, 1)!;
    expect(t.kayitSayisi).toBe(1);
    expect(t.nadirlik).toBe(1);
    expect(tabloTohumu(12)).toBe(12);
    expect(tabloTohumu(20261014, 20261014)).not.toBe(tabloTohumu(20261014));
  });
});
