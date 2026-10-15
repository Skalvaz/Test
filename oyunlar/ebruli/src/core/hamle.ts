/**
 * Hamle (GDD §3, §4.1–§4.2): geçerlilik, eylem ve hamle sonu.
 *
 * `hamleUygula(d, h) → { durum, olaylar }` girdiyi değiştirmez (derin kopya);
 * aynı (durum, hamle) aynı sonucu verir; bütün rastgelelik `d.rng`'den.
 * Olay sırası: eylem (t = 0: `karisti` ya da `ozelSuruklendi`) → çözümleme
 * (yerçekimi, eşleşme, temizlik, özel zincir, dolum, garanti) → hedef
 * ilerlemesi → (bitişte) `bolumBitti` ya da (ölü tahtada) `karistirma` →
 * `hamleOzeti` (her eylemin SON olayı).
 */
import { Baglam, yuvarlaBol } from './baglam';
import { cozumDongusu } from './cozum';
import { hedeflerTamam, hedefleriIsle } from './hedef';
import { oluysaKaristir } from './karistir';
import { ozelEylem } from './ozel';
import { ZAMAN } from './sabitler';
import { DIK, damla, durumKopyala, icinde, karisimSonucu } from './tahta';
import type { Hamle, HamleHatasi, HamleSonucu, Konum, OyunDurumu, Renk } from './types';

export class HamleHatasiIstisnasi extends Error {
  constructor(readonly neden: HamleHatasi) {
    super(`geçersiz hamle: ${neden}`);
  }
}

/**
 * Hamle geçersizse nedeni, geçerliyse null (§3.3). Geçersiz hamle hamle
 * harcamaz; girdi katmanı damlayı titretir.
 */
export function hamleHatasi(d: OyunDurumu, h: Hamle): HamleHatasi | null {
  if (d.bitti) return 'bitti';
  if (d.kalanHamle <= 0) return 'hamleYok';
  const { kaynak: k, hedef: e } = h;
  if (!icinde(d, k.x, k.y) || !icinde(d, e.x, e.y)) return 'konum';
  if (Math.abs(k.x - e.x) + Math.abs(k.y - e.y) !== 1) return 'komsuDegil';
  const hk = d.hucreler[k.y * d.w + k.x];
  const he = d.hucreler[e.y * d.w + e.x];
  if (hk.icerik?.tur === 'mermer' || he.icerik?.tur === 'mermer') return 'mermer';
  const a = damla(hk);
  const b = damla(he);
  if (!a || !b) return 'bos';
  if (hk.yag || he.yag) return 'yag';
  // Özel taşa dokunan her sürükleme geçerlidir (§5.3): özel kaynak hedefte ya
  // da yerinde ateşlenir; düz damla özel taşa sürüklenirse özel taş YERİNDE
  // ateşlenir; özel + özel birleşimdir.
  if (a.ozel !== 'yok' || b.ozel !== 'yok') return null;
  const s = karisimSonucu(a.renk as Renk, b.renk as Renk, d.kurallar.murekkep);
  return 'hata' in s ? s.hata : null;
}

/** Kaynaktaki damlanın geçerli hedefleri (K6: yalnız bunlar vurgulanır). */
export function gecerliHedefler(d: OyunDurumu, kaynak: Konum): Konum[] {
  const out: Konum[] = [];
  for (const o of DIK) {
    const hedef = { x: kaynak.x + o.x, y: kaynak.y + o.y };
    if (hamleHatasi(d, { tur: 'surukle', kaynak, hedef }) === null) out.push(hedef);
  }
  return out;
}

/**
 * Eylem (§4.2 adım 1) ve çözümleme döngüsü. Çağıran geçerliliği denetler.
 * Hem `hamleUygula` hem önizleme (`dogumsuz`) bunu kullanır.
 */
export function eylemVeCozum(c: Baglam, h: Hamle): void {
  const d = c.d;
  d.hamleNo++;
  d.kalanHamle--;
  c.hamleYonu = h.kaynak.y === h.hedef.y ? 'yatay' : 'dikey';
  const ki = h.kaynak.y * d.w + h.kaynak.x;
  const ei = h.hedef.y * d.w + h.hedef.x;
  const a = damla(d.hucreler[ki])!;
  const b = damla(d.hucreler[ei])!;
  if (a.ozel === 'yok' && b.ozel === 'yok') {
    const s = karisimSonucu(a.renk as Renk, b.renk as Renk, d.kurallar.murekkep);
    if (!('sonuc' in s)) throw new HamleHatasiIstisnasi(s.hata);
    const yeniId = d.sonrakiId++;
    c.ekle(0, { tur: 'karisti', kaynak: h.kaynak, hedef: h.hedef, a: a.renk as Renk, b: b.renk as Renk, sonuc: s.sonuc, yeniId });
    d.hucreler[ki].icerik = null;
    d.hucreler[ei].icerik = { tur: 'damla', damla: { id: yeniId, renk: s.sonuc, ozel: s.sonuc === 7 ? 'murekkep' : 'yok', yon: 'yatay' } };
    if (s.sonuc === 7 && !c.dogumsuz) d.istatistik.murekkep++;
    c.yeniId = yeniId;
    c.t = ZAMAN.karisim;
    cozumDongusu(c, 1);
  } else {
    ozelEylem(c, h);
    cozumDongusu(c, 2);
  }
  c.olaylar = hedefleriIsle(d, c.olaylar);
}

/**
 * Eylem sonu (§4.2 adım 3): bitiş, ölü tahta, istatistik ve `hamleOzeti`.
 * `oyuncuHamlesi`: bitiş denetlenir ve eşleşen hamle sayılır (şölende
 * yalnız özet).
 */
export function eylemSonu(c: Baglam, h: Hamle | null, oyuncuHamlesi: boolean): HamleSonucu {
  const d = c.d;
  const tSon = Math.max(c.t, c.olaylar.length ? c.olaylar[c.olaylar.length - 1].t : 0);
  c.t = tSon;
  if (oyuncuHamlesi) {
    if (hedeflerTamam(d)) {
      d.bitti = 'kazanc';
      c.ekle(tSon, { tur: 'bolumBitti', sonuc: 'kazanc' });
    } else if (d.kalanHamle <= 0) {
      d.bitti = 'kayip';
      c.ekle(tSon, { tur: 'bolumBitti', sonuc: 'kayip' });
    }
  }
  if (!d.bitti) oluysaKaristir(c);
  if (c.eslesme && oyuncuHamlesi) d.istatistik.eslesenHamle++;
  if (c.enBuyukK > d.istatistik.enUzunKaskat) d.istatistik.enUzunKaskat = c.enBuyukK;
  const n = c.temizlenen;
  const merkez = n > 0 ? { x: yuvarlaBol(c.sx, n), y: yuvarlaBol(c.sy, n) } : h ? { ...h.hedef } : { x: (d.w - (d.w % 2)) / 2, y: (d.h - (d.h % 2)) / 2 };
  c.ekle(tSon, { tur: 'hamleOzeti', temizlenen: n, kaskat: c.enBuyukK, eslesme: c.eslesme, merkez });
  return { durum: d, olaylar: c.olaylar };
}

/**
 * Hamleyi çözer → `{ durum, olaylar }` (§4). Girdiyi DEĞİŞTİRMEZ; geçersiz
 * hamlede `HamleHatasiIstisnasi` fırlatır.
 */
export function hamleUygula(d0: OyunDurumu, h: Hamle): HamleSonucu {
  const hata = hamleHatasi(d0, h);
  if (hata) throw new HamleHatasiIstisnasi(hata);
  const d = durumKopyala(d0);
  const c = new Baglam(d, false, d0.hamleNo);
  eylemVeCozum(c, h);
  return eylemSonu(c, h, true);
}
