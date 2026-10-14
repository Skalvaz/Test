/**
 * GEÇİCİ (yalnız geliştirme vitrini): çekirdek `hamleUygula` henüz stub
 * olduğundan, inandırıcı bir oyunun olay listelerini tohumlu üretir ve meta
 * özetinden geçirir. Entegrasyonda silinir; gerçek olaylar çekirdekten gelir.
 */
import { rngSonraki } from '../../core/rng';
import type { BolumIstatistigi, Eksen, KomboTuru, Olay, OzelTur } from '../../core/types';
import { ozetBaslat, ozetFinal, ozetHamle } from '../ozet';
import type { OyunOzeti } from '../ozet';

export interface SahteOyun {
  ozet: OyunOzeti;
  istatistik: BolumIstatistigi;
  puan: number;
  kalanHamle: number;
  toplamHamle: number;
}

export function sahteOyun(tohum: number, s: { kazandi: boolean; yildiz: number; w?: number; h?: number; renk?: number; hamle?: number; cosku?: boolean }): SahteOyun {
  const r = { rng: tohum >>> 0 };
  const u = () => rngSonraki(r) / 4294967296;
  const n = (m: number) => Math.floor(u() * m);
  const W = s.w ?? 7;
  const H = s.h ?? 9;
  const renkSayisi = s.renk ?? 5;
  const toplam = s.hamle ?? 22;
  const kullanilan = s.kazandi ? Math.max(6, toplam - (s.yildiz >= 3 ? 7 + n(6) : s.yildiz === 2 ? 3 + n(4) : n(3))) : toplam;
  let oz = ozetBaslat();
  let puan = 0;
  for (let i = 0; i < kullanilan; i++) {
    const ol: Olay[] = [];
    const L = u() < 0.08 ? 9 + n(5) : 3 + n(5);
    const renk = n(renkSayisi);
    const halka = L >= 4 && u() < 0.08;
    let x = n(W);
    let y = n(H);
    const yol: { x: number; y: number }[] = [];
    for (let k = 0; k < L; k++) {
      yol.push({ x, y });
      x = Math.min(W - 1, Math.max(0, x + n(3) - 1));
      y = Math.min(H - 1, Math.max(0, y + n(3) - 1));
    }
    ol.push({ t: 0, tur: 'fitilBasladi', yol, halka, renk });
    let t = 0;
    yol.forEach((p, k) => {
      if (k > 0) t += Math.max(35, 110 - 7 * k);
      ol.push({ t, tur: 'patlama', hucre: p, renk, neden: 'fitil', nesil: 0, puan: 10 * (k + 1), ozel: 'yok', k: k + 1 });
      puan += 10 * (k + 1);
    });
    // Kalın kuyruklu reaksiyon (§11 #4): çoğu küçük, arada büyük.
    const R = Math.min(48, Math.floor(-Math.log(1 - u() * 0.995) * (halka ? 7 : 3.4)));
    let zaman = t + 90;
    for (let j = 0; j < R; j++) {
      const nesil = 1 + Math.min(5, Math.floor(j / 6) + n(2));
      const ozel: OzelTur = u() < 0.06 ? 'roket' : u() < 0.03 ? 'kasimpati' : 'yok';
      const h = { x: n(W), y: n(H) };
      if (ozel !== 'yok') {
        ol.push({ t: zaman, tur: 'ozelTetiklendi', hucre: h, ozel, eksen: n(4) as Eksen });
        if (u() < 0.4) ol.push({ t: zaman + 25, tur: 'kafesKirildi', hucre: { x: Math.min(W - 1, h.x + 1), y: Math.max(0, h.y - 1) } });
      }
      ol.push({ t: zaman, tur: 'patlama', hucre: h, renk: u() < 0.04 ? -1 : n(renkSayisi), neden: ozel === 'yok' ? 'isi' : 'vurus', nesil, puan: 20 * nesil, ozel, k: 0 });
      if (u() < 0.1) ol.push({ t: zaman, tur: 'dosemeAydinlandi', hucre: h, kalan: 0 });
      puan += 20 * nesil;
      zaman += 30 + n(70);
    }
    if (R >= 12 && u() < 0.35) {
      const kombolar: KomboTuru[] = ['yildizHatti', 'kalinRoket', 'devKasimpati', 'roketYagmuru', 'bahce', 'buyukFinal'];
      const kombo = kombolar[Math.min(5, Math.floor(u() * u() * 6))];
      ol.push({ t: zaman, tur: 'kombinasyon', hucre: yol[yol.length - 1], kombo });
      puan += 400;
    }
    ol.push({ t: zaman, tur: 'reaksiyon', boyut: R, zirveT: zaman / 2, merkez: yol[0], kombo: false, kademe: null });
    ol.sort((a, b) => a.t - b.t);
    puan += R >= 40 ? 1200 : R >= 25 ? 600 : R >= 15 ? 300 : R >= 8 ? 100 : 0;
    oz = ozetHamle(oz, ol);
  }
  const kalan = toplam - kullanilan;
  if (s.kazandi) {
    const fin: Olay[] = [{ t: 0, tur: 'finalBasladi', kalanHamle: kalan }];
    for (let i = 0; i < kalan; i++) {
      const h = { x: n(W), y: n(H) };
      const eksen = n(4) as Eksen;
      const t0 = 120 * i;
      fin.push({ t: t0, tur: 'ozelTetiklendi', hucre: h, ozel: 'roket', eksen });
      fin.push({ t: t0, tur: 'patlama', hucre: h, renk: n(renkSayisi), neden: 'final', nesil: 0, puan: 15, ozel: 'roket', k: 0 });
      const d = [
        [1, 0],
        [0, 1],
        [1, -1],
        [1, 1],
      ][eksen];
      for (let a = 1; a < 7; a++) {
        for (const sg of [-1, 1]) {
          const px = h.x + sg * d[0] * a;
          const py = h.y + sg * d[1] * a;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          fin.push({ t: t0 + 25 * a, tur: 'patlama', hucre: { x: px, y: py }, renk: n(renkSayisi), neden: 'vurus', nesil: 0, puan: 15, ozel: 'yok', k: 0 });
          puan += 15;
        }
      }
    }
    fin.sort((a, b) => a.t - b.t);
    oz = ozetFinal(oz, fin);
    puan += 100 * kalan;
  }
  const ist: BolumIstatistigi = {
    enUzunZincir: oz.enUzunZincir,
    enBuyukReaksiyon: oz.enBuyukReaksiyon,
    halkaSayisi: oz.halka,
    toplamPatlama: oz.toplamPatlama,
    isiPatlamasi: oz.isiPatlamasi,
    enCokNesil: oz.enCokNesil,
    roket: oz.roketAtesi,
    kasimpati: oz.kasimpatiAtesi,
    yildiz: oz.yildizAtesi,
    kombinasyon: oz.kombolar.length,
    reaksiyonlar: [...oz.reaksiyonlar],
    korukKullanim: 0,
    kafesKirilan: oz.kafesKirilan,
    kayaKirilan: 0,
    fenerToplanan: 0,
    devFisekAtesi: 0,
    guclendirici: 0,
    ustaEli: false,
  };
  return { ozet: oz, istatistik: ist, puan, kalanHamle: kalan, toplamHamle: toplam };
}
