/**
 * Çözümleme döngüsü (GDD §4.2–§4.4).
 *
 * Tur: (a) dolumsuz yerçekimi → (b) eşleşme; grup yoksa dolum (doğum +
 * yerçekimi); dolumdan sonra da grup yoksa bu son dolumdur → garanti →
 * döngü biter. Turun düşenleri ve doğanları tek `yercekimi` olayıdır.
 * (c) temizlik adımı (bütün gruplar aynı anda; k ≥ 2 ise `kaskat`).
 *
 * Önizleme kipinde (`dogumsuz`) dolum yapılmaz: grup kalmayınca döngü
 * biter. Oyuncunun hamlesinin belirlenimli zinciri ilk dolumdan önce
 * tamamlandığı için önizleme, hamlenin ilk dolumdan önceki kısmıyla
 * BİREBİR aynıdır.
 */
import { Baglam, yuvarlaBol } from './baglam';
import { garantiSirasi, garantiUygula } from './garanti';
import { ozelTuruBul, uretimPuani, zincireEkle, kuyruguIsle } from './ozel';
import { KASKAT_SINIRI, ZAMAN } from './sabitler';
import { DIK, damla, gruplariBul } from './tahta';
import type { Damla, KarisikRenk, KaskatKademesi, OzelTur, Yon } from './types';
import { YerTuru } from './yercekimi';

export function kaskatKademesi(k: number): KaskatKademesi | null {
  if (k < 2) return null;
  if (k === 2) return 'guzel';
  if (k === 3) return 'nefis';
  if (k === 4) return 'harika';
  return 'saheser';
}

/** Turun yerçekimi olayını yazar (boş değilse) ve zamanı ilerletir. */
function yercekimiYaz(c: Baglam, tur: YerTuru): void {
  const o = tur.olay(c.t);
  if (!o) return;
  c.olaylar.push(o);
  c.t += ZAMAN.yercekimi;
}

/** Döngüyü `k0` adımından çalıştırır (karışımdan sonra 1, özel sürüklemeden sonra 2). */
export function cozumDongusu(c: Baglam, k0: number): void {
  const d = c.d;
  for (let k = k0; ; k++) {
    const tur = new YerTuru(d);
    tur.dus();
    let gruplar = gruplariBul(d);
    if (gruplar.length === 0) {
      if (c.dogumsuz) {
        yercekimiYaz(c, tur);
        return;
      }
      tur.doldur();
      gruplar = gruplariBul(d);
      if (gruplar.length === 0) {
        if (tur.dogan.size > 0) {
          const adaylar = garantiSirasi(d.w, [...tur.dogan.values()].map((g) => g.e));
          if (garantiUygula(d, adaylar, d, d.dogumAgirliklari, d.kurallar.garanti)) d.istatistik.garantiKullanimi++;
        }
        yercekimiYaz(c, tur);
        return;
      }
    }
    yercekimiYaz(c, tur);
    if (k > KASKAT_SINIRI) return;
    grupAdimi(c, gruplar, k);
  }
}

interface GrupPlani {
  renk: KarisikRenk;
  hucreler: number[];
  ozel: OzelTur;
  /** Özel taşın yeri (özel yoksa -1). */
  yer: number;
  yon: Yon;
  merkez: number;
}

/** Grubun ağırlık merkezine en yakın hücresi (eşitlikte küçük indeks). */
function merkezHucre(w: number, hucreler: number[]): number {
  let sx = 0;
  let sy = 0;
  for (const i of hucreler) {
    sx += i % w;
    sy += (i - (i % w)) / w;
  }
  const n = hucreler.length;
  let en = hucreler[0];
  let enU = Infinity;
  for (const i of hucreler) {
    const x = i % w;
    const y = (i - x) / w;
    const u = (x * n - sx) * (x * n - sx) + (y * n - sy) * (y * n - sy);
    if (u < enU) {
      enU = u;
      en = i;
    }
  }
  return en;
}

function grupPlani(c: Baglam, g: { renk: KarisikRenk; hucreler: number[] }, k: number): GrupPlani {
  const d = c.d;
  const w = d.w;
  const ozel = ozelTuruBul(d.kurallar.ozelEsikleri, g.hucreler.length);
  let yer = -1;
  let yon: Yon = 'yatay';
  if (ozel !== 'yok') {
    // §5.1: bu hamlenin karışımıyla doğan damla grupta ise onun hücresi;
    // yoksa grubun en alt satırındaki en soldaki hücre.
    if (c.yeniId !== null) for (const i of g.hucreler) if (damla(d.hucreler[i])?.id === c.yeniId) yer = i;
    if (yer < 0) {
      let enY = -1;
      for (const i of g.hucreler) {
        const y = (i - (i % w)) / w;
        if (y > enY || (y === enY && i % w < yer % w)) {
          enY = y;
          yer = i;
        }
      }
    }
    if (ozel === 'tarak') {
      let x0 = w;
      let x1 = -1;
      let y0 = d.h;
      let y1 = -1;
      for (const i of g.hucreler) {
        const x = i % w;
        const y = (i - x) / w;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const en = x1 - x0;
      const boy = y1 - y0;
      yon = en > boy ? 'yatay' : boy > en ? 'dikey' : k === 1 ? c.hamleYonu : 'yatay';
    }
  }
  return { renk: g.renk, hucreler: g.hucreler, ozel, yer, yon, merkez: yer >= 0 ? yer : merkezHucre(w, g.hucreler) };
}

/** Temizlik adımı (§4.4). */
export function grupAdimi(c: Baglam, gruplar: { renk: KarisikRenk; hucreler: number[] }[], k: number): void {
  const d = c.d;
  const w = d.w;
  c.adimBasla(k);
  const t0 = c.t;
  if (k >= 2) c.ekle(t0, { tur: 'kaskat', k, kademe: kaskatKademesi(k) });
  c.eslesme = true;
  if (k > c.enBuyukK) c.enBuyukK = k;
  const planlar = gruplar.map((g) => grupPlani(c, g, k));
  // 1. eslesti (aynı t).
  for (const p of planlar) c.ekle(t0, { tur: 'eslesti', renk: p.renk, hucreler: p.hucreler.map((i) => c.K(i)), k, merkez: c.K(p.merkez) });
  const tc = t0 + ZAMAN.toplanma;
  // 2. grup hücreleri + zemin; gruptaki Tarak/Girdap zincire.
  for (const p of planlar)
    for (const i of p.hucreler) {
      const dm = c.temizle(i, 'grup', tc);
      if (dm && (dm.ozel === 'tarak' || dm.ozel === 'girdap')) zincireEkle(c, i, dm, tc + ZAMAN.zincir);
    }
  // 3. özel taş üretimi.
  for (const p of planlar) {
    if (p.ozel === 'yok') continue;
    const dm: Damla = { id: d.sonrakiId++, renk: p.ozel === 'lale' ? 0 : p.renk, ozel: p.ozel, yon: p.ozel === 'tarak' ? p.yon : 'yatay' };
    d.hucreler[p.yer].icerik = { tur: 'damla', damla: dm };
    const hp = c.K(p.yer);
    c.ekle(tc, { tur: 'ozelOlustu', hucre: hp, damla: { ...dm } });
    c.puanEkle(tc, uretimPuani(p.ozel), 'ozel', hp);
    if (!c.dogumsuz) {
      if (p.ozel === 'tarak') d.istatistik.tarak++;
      else if (p.ozel === 'girdap') d.istatistik.girdap++;
      else d.istatistik.lale++;
    }
  }
  // 5–6. gruba komşu Mürekkep patlar; komşu mermer grup başına −1.
  const murekkepler = new Set<number>();
  for (const p of planlar) {
    const mermerler = new Set<number>();
    for (const i of p.hucreler) {
      const x = i % w;
      const y = (i - x) / w;
      for (const o of DIK) {
        const xx = x + o.x;
        const yy = y + o.y;
        if (xx < 0 || yy < 0 || xx >= w || yy >= d.h) continue;
        const j = yy * w + xx;
        const ic = d.hucreler[j].icerik;
        if (ic?.tur === 'mermer') mermerler.add(j);
        else if (ic?.tur === 'damla' && ic.damla.ozel === 'murekkep') murekkepler.add(j);
      }
    }
    for (const j of [...mermerler].sort((a, b) => a - b)) c.mermerVur(j, tc, false);
  }
  for (const j of [...murekkepler].sort((a, b) => a - b)) {
    const dm = damla(d.hucreler[j]);
    if (!dm || dm.ozel !== 'murekkep') continue;
    c.kuyrugaEkle({ hucre: j, ozel: 'murekkep', renk: 7, yon: dm.yon, id: dm.id, t: tc + ZAMAN.zincir, kaldir: 'murekkep', neden: 'murekkep' });
  }
  // Günlük + istatistik.
  for (const p of planlar) {
    let sx = 0;
    let sy = 0;
    for (const i of p.hucreler) {
      sx += i % w;
      sy += (i - (i % w)) / w;
    }
    const n = p.hucreler.length;
    c.gunlukEkle('grup', yuvarlaBol(sx * 10, n), yuvarlaBol(sy * 10, n), p.renk, n);
    if (!c.dogumsuz && n > d.istatistik.enBuyukGrup) d.istatistik.enBuyukGrup = n;
  }
  // 4. zincir (BFS).
  kuyruguIsle(c);
  c.adimBitir();
}
