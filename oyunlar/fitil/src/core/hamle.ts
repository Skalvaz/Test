/**
 * hamleUygula (§3.5, §16.2): saf; girdiyi DEĞİŞTİRMEZ (önce derin kopya).
 * Geçersiz hamlede `HamleHatasi` fırlatır (uygulama önceden doğrular;
 * `hamleHatasi` ile fırlatmadan sorulabilir).
 */
import { cozumOlustur, ekle, kon, puanEkle, type Cozum } from './baglam';
import { isYayil } from './engel';
import { havaUygula, sogumaUygula } from './hava';
import { hedefArtir, hedefSay, hepsiTamam, puanHedefi } from './hedef';
import { karistir } from './karistir';
import { kilitliMi } from './kilit';
import { reaksiyonKademesi } from './puan';
import { cozumle, isit } from './resolve';
import { FENER_TUR_SINIRI, FITIL_EN_KISA, FITIL_HIZLANMA, FITIL_ILK_ARALIK, PUAN, USTA_ELI_HAMLE } from './sabitler';
import { durumKopyala } from './tahta';
import { enCokRenk, eksenBul, ozelTuruBul, yolDogrula, zincirRengi } from './yol';
import { fenerTopla, yercekimiTuru } from './yercekimi';
import type { Hamle, HamleSonucu, Konum, OyunDurumu, ReaksiyonKademesi } from './types';

export class HamleHatasi extends Error {}

/** Bölüm başına en fazla 1 güçlendirici (§9). */
export const GUCLENDIRICI_SINIRI = 1;

function gecerliKonum(d: OyunDurumu, p: Konum): boolean {
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < d.w && p.y < d.h && !d.hucreler[p.y * d.w + p.x].delik;
}

/** Hamle geçersizse nedeni, geçerliyse null. */
export function hamleHatasi(d: OyunDurumu, h: Hamle): string | null {
  if (d.bitti) return 'bitti';
  switch (h.tur) {
    case 'fitil': {
      if (d.kalanHamle <= 0) return 'hamleYok';
      return yolDogrula(d, h.yol, h.halka);
    }
    case 'ciftDokunus': {
      if (d.kalanHamle <= 0) return 'hamleYok';
      if (!gecerliKonum(d, h.hucre)) return 'konum';
      const c = d.hucreler[h.hucre.y * d.w + h.hucre.x];
      if (c.kafes || c.icerik?.tur !== 'kapsul' || c.icerik.ozel === 'yok') return 'ozelDegil';
      return null;
    }
    case 'koruk': {
      if (d.korukKapasite <= 0) return 'korukKapali';
      if (d.korukDolum < d.korukKapasite) return 'korukDoluDegil';
      if (!gecerliKonum(d, h.merkez)) return 'konum';
      return null;
    }
    case 'kibrit': {
      if (d.istatistik.guclendirici >= GUCLENDIRICI_SINIRI) return 'guclendiriciSiniri';
      if (!gecerliKonum(d, h.hucre)) return 'konum';
      return null;
    }
    case 'kalip': {
      if (d.istatistik.guclendirici >= GUCLENDIRICI_SINIRI) return 'guclendiriciSiniri';
      if (!gecerliKonum(d, h.hucre)) return 'konum';
      if (!(h.eksen === 0 || h.eksen === 1 || h.eksen === 2 || h.eksen === 3)) return 'eksen';
      const c = d.hucreler[h.hucre.y * d.w + h.hucre.x];
      if (c.kafes || c.icerik?.tur !== 'kapsul' || c.icerik.ozel !== 'yok' || c.icerik.renk < 0) return 'duzKapsulDegil';
      return null;
    }
  }
  return 'tur';
}

export function hamleUygula(d0: OyunDurumu, h: Hamle): HamleSonucu {
  const hata = hamleHatasi(d0, h);
  if (hata) throw new HamleHatasi(`geçersiz hamle (${h.tur}): ${hata}`);
  const d = durumKopyala(d0);
  const c = cozumOlustur(d);
  switch (h.tur) {
    case 'fitil':
      fitilKur(c, h.yol, h.halka);
      break;
    case 'ciftDokunus': {
      // §3.1: özel taşı tek başına ateşler (1 hamle; t = 0, g = 0).
      d.kalanHamle--;
      d.hamleNo++;
      const i = h.hucre.y * d.w + h.hucre.x;
      c.planli[i] = 1;
      ekle(c, 0, i, 'TETIK', { nesil: 0, neden: 'vurus' });
      break;
    }
    case 'koruk': {
      // §6 Körük Göstergesi (GDD §3.1 "§6.10" diye atıflar; §6.10 halka hedefidir): Chebyshev ≤ 1 ısınabilir kapsüllere t = 0'da +1 (kalkan geçerli); dolum 0.
      d.korukDolum = 0;
      d.istatistik.korukKullanim++;
      c.olaylar.push({ t: 0, tur: 'korukKullanildi', merkez: { x: h.merkez.x, y: h.merkez.y } });
      for (let y = h.merkez.y - 1; y <= h.merkez.y + 1; y++) {
        for (let x = h.merkez.x - 1; x <= h.merkez.x + 1; x++) {
          if (x < 0 || y < 0 || x >= d.w || y >= d.h) continue;
          isit(c, y * d.w + x, 1, 0, 0);
        }
      }
      break;
    }
    case 'kibrit': {
      // §9: seçilen hücreye t = 0'da 0. nesil vuruş.
      d.istatistik.guclendirici++;
      c.olaylar.push({ t: 0, tur: 'guclendirici', guc: 'kibrit', hucre: { x: h.hucre.x, y: h.hucre.y } });
      ekle(c, 0, h.hucre.y * d.w + h.hucre.x, 'VURUS', { nesil: 0, neden: 'kibrit' });
      break;
    }
    case 'kalip': {
      // §9: düz kapsül rokete döner (ısı korunur); ateşlemez.
      d.istatistik.guclendirici++;
      const i = h.hucre.y * d.w + h.hucre.x;
      const ic = d.hucreler[i].icerik;
      c.olaylar.push({ t: 0, tur: 'guclendirici', guc: 'kalip', hucre: { x: h.hucre.x, y: h.hucre.y } });
      if (ic?.tur === 'kapsul') {
        ic.ozel = 'roket';
        ic.eksen = h.eksen;
        c.olaylar.push({ t: 0, tur: 'ozelOlustu', hucre: kon(d, i), ozel: 'roket', eksen: h.eksen, renk: ic.renk, isi: ic.isi });
      }
      break;
    }
  }
  cozumle(c);
  hamleSonu(c, h.tur);
  return { durum: d, olaylar: c.olaylar };
}

/** Fitil hamlesi kuyruğu (§3.5.1). */
function fitilKur(c: Cozum, yol: readonly Konum[], halka: boolean): void {
  const d = c.d;
  const n = yol.length;
  const P = yol.map((p) => p.y * d.w + p.x);
  let renk = zincirRengi(d, yol);
  // §3.3.1: P'nin tamamı jokerse renk, bırakma anında tahtada en çok bulunan renk.
  if (renk === -1) renk = enCokRenk(d);
  c.zincirVar = true;
  c.zincirRengi = renk;
  const carpan = halka ? 2 : 1;

  // Dönüşüm (§4.1): halka değil, n eşiği geçti, son düğüm özel değil.
  const son = d.hucreler[P[n - 1]].icerik;
  const donusumTuru = !halka && son?.tur === 'kapsul' && son.ozel === 'yok' ? ozelTuruBul(d.ozelEsikleri, n) : 'yok';
  const donusum = donusumTuru !== 'yok' ? P[n - 1] : -1;
  const eksen = eksenBul(yol[n - 2], yol[n - 1]);

  // Kombo (§4.4): yoldaki (dönüşüm hariç) ilk iki özel taş.
  let s1 = -1;
  let s2 = -1;
  for (const i of P) {
    if (i === donusum) continue;
    const ic = d.hucreler[i].icerik;
    if (ic?.tur !== 'kapsul' || ic.ozel === 'yok') continue;
    if (s1 < 0) s1 = i;
    else if (s2 < 0) s2 = i;
  }
  if (s2 < 0) s1 = -1;

  d.kalanHamle--;
  d.hamleNo++;
  const ist = d.istatistik;
  if (n > ist.enUzunZincir) ist.enUzunZincir = n;
  c.olaylar.push({ t: 0, tur: 'fitilBasladi', yol: yol.map((p) => ({ x: p.x, y: p.y })), halka, renk });
  if (halka) {
    ist.halkaSayisi++;
    puanEkle(c, 0, PUAN.halka, 'halka', P[0]);
    hedefSay(c, 'halka', 0);
  }

  let t = 0;
  for (let k = 0; k < n; k++) {
    if (k > 0) t += Math.max(FITIL_EN_KISA, FITIL_ILK_ARALIK - FITIL_HIZLANMA * k);
    const i = P[k];
    c.planli[i] = 1;
    if (i === donusum) ekle(c, t, i, 'DONUSUM', { k: k + 1, ozel: donusumTuru, eksen });
    else ekle(c, t, i, 'FITIL', { k: k + 1, nesil: 0, isiMiktari: carpan, yukle: i === s1, kombo: i === s2 });
  }
}

/** En çok patlamanın düştüğü 90 tiklik pencere; ortası ve ağırlık merkezi (§12.1). */
function zirve(c: Cozum): { zirveT: number; merkez: Konum } {
  const p = c.patlamalar;
  if (p.length === 0) return { zirveT: 0, merkez: { x: (c.d.w - 1) >> 1, y: (c.d.h - 1) >> 1 } };
  const PENCERE = 90;
  const sayac = new Map<number, number>();
  let enW = 0;
  let enN = -1;
  for (let k = 0; k < p.length; k += 3) {
    const w = Math.floor(p[k] / PENCERE);
    const n = (sayac.get(w) ?? 0) + 1;
    sayac.set(w, n);
  }
  for (const [w, n] of sayac) if (n > enN || (n === enN && w < enW)) {
    enN = n;
    enW = w;
  }
  let sx = 0;
  let sy = 0;
  for (let k = 0; k < p.length; k += 3) {
    if (Math.floor(p[k] / PENCERE) !== enW) continue;
    sx += p[k + 1];
    sy += p[k + 2];
  }
  // Yuvarlanmış tamsayı ağırlık merkezi.
  const yuvarla = (s: number): number => Math.floor((2 * s + enN) / (2 * enN));
  return { zirveT: enW * PENCERE + (PENCERE >> 1), merkez: { x: yuvarla(sx), y: yuvarla(sy) } };
}

/** `reaksiyon` olayı (§3.5.4 adım 8). */
export function reaksiyonYaz(c: Cozum, t: number, kademe: ReaksiyonKademesi | null): void {
  const z = zirve(c);
  c.olaylar.push({ t, tur: 'reaksiyon', boyut: c.R, zirveT: z.zirveT, merkez: z.merkez, kombo: c.kombo, kademe });
}

/** Kuyruk boşalınca (§3.5.4). */
export function hamleSonu(c: Cozum, tur: Hamle['tur']): void {
  const d = c.d;
  const oyuncu = tur === 'fitil' || tur === 'ciftDokunus';
  let t = c.saat;

  // 1–2. Yerçekimi ve doldurma; fener toplama (en fazla 10 tur).
  t = yercekimiTuru(c, t);
  for (let n = 0; n < FENER_TUR_SINIRI; n++) {
    if (!fenerTopla(c, t)) break;
    t = yercekimiTuru(c, t);
  }

  // 3–4. İs yayılması, hava olayları ve soğuma (yalnız fitil / çift dokunuş).
  if (oyuncu) {
    isYayil(c, t);
    havaUygula(c, t);
    sogumaUygula(c, t);
  }

  // 5. Körük: bu eylemdeki ISI patlaması kadar dolum (kapasitede durur).
  if (d.korukKapasite > 0 && c.isiPatlamasi > 0) {
    const yeni = Math.min(d.korukKapasite, d.korukDolum + c.isiPatlamasi);
    if (yeni !== d.korukDolum) {
      d.korukDolum = yeni;
      c.olaylar.push({ t, tur: 'korukDoldu', dolum: yeni, kapasite: d.korukKapasite });
    }
  }

  // Reaksiyon (R kuyrukta kesinleşti): bonus yalnız en yüksek kademe (§7.2),
  // istatistik, zincirleme hedefi (§6.9).
  const R = c.R;
  const ist = d.istatistik;
  if (oyuncu) ist.reaksiyonlar.push(R);
  if (R > ist.enBuyukReaksiyon) ist.enBuyukReaksiyon = R;
  const kad = reaksiyonKademesi(R);
  if (kad) {
    d.puan += kad.bonus;
    c.olaylar.push({ t, tur: 'puanEklendi', miktar: kad.bonus, neden: 'reaksiyon', kademe: kad.kademe });
  }
  const hs = d.hedefler;
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k].hedef;
    if (h.tur === 'zincirleme' && R >= h.esik) hedefArtir(c, k, 1, t);
  }
  puanHedefi(c, t);

  // 6. Hedef kontrolü.
  if (hepsiTamam(d)) d.bitti = 'kazanc';
  else if (d.kalanHamle <= 0) d.bitti = 'kayip';
  if (d.bitti) c.olaylar.push({ t, tur: 'bolumBitti', sonuc: d.bitti });

  // 7. Kilitlenme → karıştırma (§3.8).
  if (!d.bitti && kilitliMi(d)) karistirmaYaz(c, t);

  // 8. Reaksiyon olayı.
  reaksiyonYaz(c, t, kad ? kad.kademe : null);
}

/**
 * Kıvılcım Usta'nın Eli (K16, §14): kaybedilen bölümde +5 hamle ile devam
 * (denemede bir kez; en fazla 1★, `yildizHesapla`). Kayıpta karıştırma
 * yapılmadığından (§3.5.4 adım 7) tahta kilitliyse burada karıştırılır.
 */
export function ustaEliUygula(d0: OyunDurumu): HamleSonucu {
  if (d0.bitti !== 'kayip') throw new HamleHatasi('ustaEli: bölüm kaybedilmedi');
  if (d0.istatistik.ustaEli) throw new HamleHatasi('ustaEli: bu denemede kullanıldı');
  const d = durumKopyala(d0);
  const c = cozumOlustur(d);
  d.kalanHamle += USTA_ELI_HAMLE;
  d.bitti = null;
  d.istatistik.ustaEli = true;
  if (kilitliMi(d)) karistirmaYaz(c, 0);
  return { durum: d, olaylar: c.olaylar };
}

/** Karıştır ve olaylarını yaz (eşleme + yeniden renk; son çare roketi ozelOlustu). */
export function karistirmaYaz(c: Cozum, t: number): void {
  const d = c.d;
  const s = karistir(d);
  c.olaylar.push({ t, tur: 'karistirma', esleme: s.esleme, yenidenRenk: s.yenidenRenk });
  if (s.roket) {
    const ic = d.hucreler[s.roket.y * d.w + s.roket.x].icerik;
    if (ic?.tur === 'kapsul') c.olaylar.push({ t, tur: 'ozelOlustu', hucre: { ...s.roket }, ozel: 'roket', eksen: 0, renk: ic.renk, isi: ic.isi });
  }
}
