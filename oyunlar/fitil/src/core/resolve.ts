/**
 * Ayrık olay simülasyonu (§3.5): kuyruk döngüsü, PATLAT, ISIT, vuruş tablosu.
 *
 * İlke "ilk plan kazanır": bir hücre bir eylemde en fazla bir kez patlama
 * için planlanır (`planli`), en fazla bir kez patlar (`patladi`). Böylece
 * her çözümleme en fazla W·H patlamayla biter.
 */
import { ekle, kon, puanEkle, type Cozum, type KuyrukOgesi } from './baglam';
import { engelEtki, izTutustur } from './engel';
import { hedefSay, toplaSay } from './hedef';
import { komboEtki, ozelEtki } from './ozel';
import { patlamaPuani } from './puan';
import { DEV_FISEK_ADIM, ISI_GECIKME, IZ_ADIM, PUAN } from './sabitler';
import type { PatlamaNedeni } from './types';

/**
 * ISIT(m, miktar, g, t) (§3.5.2): yalnız kapsül (kafesli dahil, özel taş
 * dahil) ısınır; kalkan, planlı ya da patlamış hücre ısı almaz. Eşiğe
 * ulaşan t + 90'da g + 1. nesil ISI patlaması olarak planlanır.
 */
export function isit(c: Cozum, m: number, miktar: number, g: number, t: number): void {
  const d = c.d;
  const h = d.hucreler[m];
  const ic = h.icerik;
  if (h.delik || !ic || ic.tur !== 'kapsul') return;
  if (c.kalkan[m] || c.planli[m] || c.patladi[m]) return;
  ic.isi += miktar;
  c.olaylar.push({ t, tur: 'isindi', hucre: kon(d, m), isi: ic.isi, kizgin: ic.isi >= d.esik - 1 });
  if (ic.isi >= d.esik) {
    c.planli[m] = 1;
    ekle(c, t + ISI_GECIKME, m, 'ISI', { nesil: g + 1, isiMiktari: 1 });
  }
}

/**
 * PATLAT (§3.5.2): hücredeki kapsül tahtadan ayrılır. Puan, TOPLA sayacı,
 * ışık izi, kafes, zemin (döşeme, desen, iz), özel etki, dik komşulara ısı
 * ve bitişik hasar; sonra içerik null.
 */
export function patlat(
  c: Cozum,
  i: number,
  t: number,
  neden: PatlamaNedeni,
  nesil: number,
  isiMiktari: number,
  k: number,
  yukle: boolean,
  kombo: boolean,
): void {
  const d = c.d;
  const h = d.hucreler[i];
  const ic = h.icerik;
  if (!ic || ic.tur !== 'kapsul') return;
  c.patladi[i] = 1;
  c.planli[i] = 1;
  const x = i % d.w;
  const y = (i - x) / d.w;

  // 1. Puan, sayaçlar, ışık izi.
  const puan = patlamaPuani(neden, nesil, k);
  d.puan += puan;
  c.olaylar.push({ t, tur: 'patlama', hucre: { x, y }, renk: ic.renk, neden, nesil, puan, ozel: ic.ozel, k });
  const ist = d.istatistik;
  ist.toplamPatlama++;
  if (nesil > ist.enCokNesil) ist.enCokNesil = nesil;
  if (neden === 'isi') {
    ist.isiPatlamasi++;
    c.isiPatlamasi++;
  }
  if (neden !== 'fitil') c.R++;
  c.patlamalar.push(t, x, y);
  toplaSay(c, ic.renk, t);
  h.isikIzi = true;

  // 2. Kafes kırılır.
  if (h.kafes) {
    h.kafes = false;
    c.olaylar.push({ t, tur: 'kafesKirildi', hucre: { x, y } });
    puanEkle(c, t, PUAN.kafes, 'diger', i);
    ist.kafesKirilan++;
    hedefSay(c, 'kafes', t);
  }

  // 3. Zemin: döşeme, desen, barut izi.
  if (h.doseme > 0) {
    h.doseme = (h.doseme - 1) as 0 | 1;
    c.olaylar.push({ t, tur: 'dosemeAydinlandi', hucre: { x, y }, kalan: h.doseme });
    puanEkle(c, t, PUAN.doseme, 'diger', i);
    hedefSay(c, 'aydinlat', t);
  }
  if (h.desenRengi >= 0 && !h.desenBoyali && (ic.renk === h.desenRengi || ic.renk === -1)) {
    h.desenBoyali = true;
    c.olaylar.push({ t, tur: 'desenBoyandi', hucre: { x, y }, renk: h.desenRengi });
    puanEkle(c, t, PUAN.desen, 'diger', i);
    hedefSay(c, 'desen', t);
  }
  if (h.izIndeksi >= 0) izTutustur(c, i, t, nesil);

  // 4. Özel taş: S1 yüklenir, S2 birleşik etki, diğerleri kendi etkisi.
  if (ic.ozel !== 'yok') {
    const vurusNedeni: PatlamaNedeni = neden === 'final' ? 'final' : 'vurus';
    if (yukle) {
      c.yuklu = { ozel: ic.ozel, eksen: ic.eksen };
      c.olaylar.push({ t, tur: 'yuklendi', hucre: { x, y }, ozel: ic.ozel });
    } else if (kombo && c.yuklu) {
      komboEtki(c, i, c.yuklu, { ozel: ic.ozel, eksen: ic.eksen }, t, nesil, vurusNedeni);
      c.yuklu = null;
    } else {
      ozelEtki(c, i, ic.ozel, ic.eksen, t, nesil, vurusNedeni);
    }
  }

  // 5. Isı yayılımı (4 dik komşu), 6. bitişik hasar (kapsül dışı içerik).
  const sol = x > 0;
  const sag = x < d.w - 1;
  const ust = y > 0;
  const alt = y < d.h - 1;
  if (ust) isit(c, i - d.w, isiMiktari, nesil, t);
  if (sag) isit(c, i + 1, isiMiktari, nesil, t);
  if (alt) isit(c, i + d.w, isiMiktari, nesil, t);
  if (sol) isit(c, i - 1, isiMiktari, nesil, t);
  if (ust) engelEtki(c, i - d.w, t, nesil);
  if (sag) engelEtki(c, i + 1, t, nesil);
  if (alt) engelEtki(c, i + d.w, t, nesil);
  if (sol) engelEtki(c, i - 1, t, nesil);

  // 7. İçerik boşalır.
  h.icerik = null;
}

/**
 * Vuruş (§3.5.3): kapsül patlar (planlıysa yok sayılır, ilk plan kazanır);
 * kapsül dışı içerik vuruş sütununa göre etkilenir; iz hücresi tutuşur.
 */
export function vurus(c: Cozum, i: number, t: number, g: number, neden: PatlamaNedeni): void {
  const h = c.d.hucreler[i];
  if (h.delik || c.patladi[i]) return;
  const ic = h.icerik;
  if (ic && ic.tur === 'kapsul') {
    if (c.planli[i]) return;
    patlat(c, i, t, neden, g, 1, 0, false, false);
    return;
  }
  if (ic) engelEtki(c, i, t, g);
  if (h.izIndeksi >= 0) izTutustur(c, i, t, g);
}

/** DONUSUM (§3.5.2): son düğüm özel taşa döner; ısı 0, patlamış sayılır, ısı/hasar/sayım yok. */
function donusum(c: Cozum, o: KuyrukOgesi): void {
  const d = c.d;
  const h = d.hucreler[o.i];
  const ic = h.icerik;
  const ozel = o.ozel;
  c.olaylar.push({ t: o.t, tur: 'dugumYandi', hucre: kon(d, o.i), k: o.k });
  if (!ic || ic.tur !== 'kapsul' || ozel === 'yok') return;
  ic.ozel = ozel;
  ic.renk = ozel === 'yildiz' ? -1 : (c.zincirRengi as typeof ic.renk);
  ic.isi = 0;
  ic.eksen = o.eksen;
  c.patladi[o.i] = 1;
  c.olaylar.push({ t: o.t, tur: 'ozelOlustu', hucre: kon(d, o.i), ozel, eksen: ic.eksen, renk: ic.renk, isi: 0 });
  puanEkle(c, o.t, PUAN.olusum[ozel], 'diger', o.i);
  d.istatistik[ozel]++;
}

/** Barut izi adımı (§5): yanmamış hücre yanar, VURUS alır, iz aynı yönde sürer. */
function izIlerle(c: Cozum, o: KuyrukOgesi): void {
  const d = c.d;
  const iz = d.izler[o.iz];
  if (!iz || iz.yandi[o.izSira]) return;
  iz.yandi[o.izSira] = true;
  c.olaylar.push({ t: o.t, tur: 'izYandi', hucre: kon(d, o.i) });
  vurus(c, o.i, o.t, o.nesil, 'iz');
  const j = o.izSira + o.yon;
  if (j >= 0 && j < iz.hucreler.length) ekle(c, o.t + IZ_ADIM, iz.hucreler[j], 'IZ_ILERLE', { iz: o.iz, izSira: j, yon: o.yon, nesil: o.nesil });
}

/**
 * Dev fişek fırlar (§5): kalkar (+300, hedef), üstündeki hücreler y' < y için
 * T + 30·(y − y') anında VURUS alır (T = dolum + 150). Delikler atlanır.
 */
function devFisekAtes(c: Cozum, o: KuyrukOgesi): void {
  const d = c.d;
  const h = d.hucreler[o.i];
  if (h.icerik?.tur !== 'devFisek') return;
  h.icerik = null;
  c.olaylar.push({ t: o.t, tur: 'devFisekFirladi', hucre: kon(d, o.i) });
  puanEkle(c, o.t, PUAN.devFisek, 'diger', o.i);
  d.istatistik.devFisekAtesi++;
  hedefSay(c, 'devFisek', o.t);
  for (let yy = o.y - 1; yy >= 0; yy--) {
    const j = yy * d.w + o.x;
    if (d.hucreler[j].delik) continue;
    ekle(c, o.t + DEV_FISEK_ADIM * (o.y - yy), j, 'VURUS', { nesil: o.nesil, neden: 'devFisek' });
  }
}

/** Kuyruk boşalana kadar çöz (§3.5.2). */
export function cozumle(c: Cozum): void {
  for (;;) {
    const o = c.yigin.al();
    if (!o) break;
    if (o.t > c.saat) c.saat = o.t;
    switch (o.tur) {
      case 'FITIL':
        if (c.patladi[o.i]) break;
        c.olaylar.push({ t: o.t, tur: 'dugumYandi', hucre: kon(c.d, o.i), k: o.k });
        patlat(c, o.i, o.t, 'fitil', 0, o.isiMiktari, o.k, o.yukle, o.kombo);
        break;
      case 'DONUSUM':
        donusum(c, o);
        break;
      case 'ISI':
        if (c.patladi[o.i]) break;
        patlat(c, o.i, o.t, 'isi', o.nesil, 1, 0, false, false);
        break;
      case 'TETIK':
        if (c.patladi[o.i]) break;
        patlat(c, o.i, o.t, o.neden, o.nesil, 1, 0, false, false);
        break;
      case 'VURUS':
        vurus(c, o.i, o.t, o.nesil, o.neden);
        break;
      case 'ISI_DALGASI':
        isit(c, o.i, 1, o.nesil, o.t);
        break;
      case 'DALGA':
        c.olaylar.push({ t: o.t, tur: 'isiDalgasi', merkez: kon(c.d, o.i), yaricap: o.yaricap });
        break;
      case 'IZ_ILERLE':
        izIlerle(c, o);
        break;
      case 'DEVFISEK_ATES':
        devFisekAtes(c, o);
        break;
    }
  }
}
