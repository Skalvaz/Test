/**
 * Çizerken önizleme (§3.9). Yalnız ilk dalga: yol düğümlerinin kendi
 * patlamalarından gelecek ısı (halkada +2). Dönüşecek son düğüm patlamaz,
 * ısı vermez. Kalkan dikkate alınır; yol düğümleri (planlı) ısı almaz.
 * Maliyet O(|yol|) (etki alanları en fazla tahta boyu). Kısmi yol
 * (çizim sürerken) hata fırlatmaz; `gecerli` false döner.
 */
import { DIK } from './tahta';
import { komboHucreleri, komboTuru, etkiHucreleri } from './ozel';
import { enCokRenk, eksenBul, ozelTuruBul, yolDogrula, zincirRengi } from './yol';
import type { Eksen, Konum, Onizleme, OyunDurumu, OzelTur } from './types';

function kalkanMi(d: OyunDurumu, x: number, y: number): boolean {
  for (const k of DIK) {
    const nx = x + k.x;
    const ny = y + k.y;
    if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) continue;
    const h = d.hucreler[ny * d.w + nx];
    if (!h.delik && h.icerik?.tur === 'kova') return true;
  }
  return false;
}

function konum(d: OyunDurumu, i: number): Konum {
  const x = i % d.w;
  return { x, y: (i - x) / d.w };
}

export function onizle(d: OyunDurumu, yol: readonly Konum[], halka: boolean): Onizleme {
  const n = yol.length;
  const gecerli = yolDogrula(d, yol, halka) === null;
  const renk = zincirRengi(d, yol);
  const etkinRenk = renk === -1 ? enCokRenk(d) : renk;

  // Yoldaki geçerli hücreler.
  const P: number[] = [];
  const yolda = new Set<number>();
  for (const p of yol) {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= d.w || p.y >= d.h) continue;
    const i = p.y * d.w + p.x;
    if (d.hucreler[i].delik || yolda.has(i)) continue;
    P.push(i);
    yolda.add(i);
  }

  // Özel taş hayaleti (§4.1).
  let ozelHayalet: Onizleme['ozelHayalet'] = null;
  if (!halka && n >= 2 && P.length === n) {
    const son = d.hucreler[P[n - 1]].icerik;
    if (son?.tur === 'kapsul' && son.ozel === 'yok') {
      const tur = ozelTuruBul(d.ozelEsikleri, n);
      if (tur !== 'yok') ozelHayalet = { hucre: { x: yol[n - 1].x, y: yol[n - 1].y }, ozel: tur, eksen: eksenBul(yol[n - 2], yol[n - 1]) };
    }
  }
  const donusum = ozelHayalet ? P[P.length - 1] : -1;

  // İlk dalga ısısı.
  const carpan = halka ? 2 : 1;
  const artis = new Map<number, number>();
  for (const i of P) {
    if (i === donusum) continue;
    const x = i % d.w;
    const y = (i - x) / d.w;
    for (const k of DIK) {
      const nx = x + k.x;
      const ny = y + k.y;
      if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) continue;
      const m = ny * d.w + nx;
      if (yolda.has(m)) continue;
      const h = d.hucreler[m];
      if (h.delik || h.icerik?.tur !== 'kapsul') continue;
      if (kalkanMi(d, nx, ny)) continue;
      artis.set(m, (artis.get(m) ?? 0) + carpan);
    }
  }
  const isinacaklar: Onizleme['isinacaklar'] = [];
  const esikHucreler: Konum[] = [];
  for (const [m, a] of artis) {
    isinacaklar.push({ hucre: konum(d, m), artis: a });
    const ic = d.hucreler[m].icerik;
    if (ic?.tur === 'kapsul' && ic.isi + a >= d.esik) esikHucreler.push(konum(d, m));
  }

  // Yoldaki mevcut özel taşlar: ilk ikisi birleşir, diğerleri kendi etkisi.
  const ozeller: { i: number; ozel: OzelTur; eksen: Eksen }[] = [];
  for (const i of P) {
    if (i === donusum) continue;
    const ic = d.hucreler[i].icerik;
    if (ic?.tur === 'kapsul' && ic.ozel !== 'yok') ozeller.push({ i, ozel: ic.ozel, eksen: ic.eksen });
  }
  const etkiAlanlari: Onizleme['etkiAlanlari'] = [];
  let kombo: Onizleme['kombo'] = null;
  let bas = 0;
  if (ozeller.length >= 2) {
    const [s1, s2] = ozeller;
    kombo = komboTuru(s1.ozel, s2.ozel);
    if (kombo) {
      const rokEksen = s1.ozel === 'roket' ? s1.eksen : s2.eksen;
      etkiAlanlari.push({ kaynak: konum(d, s2.i), hucreler: komboHucreleri(d, s2.i, kombo, rokEksen, etkinRenk, yolda).map((j) => konum(d, j)) });
    }
    bas = 2;
  }
  for (let k = bas; k < ozeller.length; k++) {
    const o = ozeller[k];
    etkiAlanlari.push({ kaynak: konum(d, o.i), hucreler: etkiHucreleri(d, o.i, o.ozel, o.eksen, etkinRenk, yolda).map((j) => konum(d, j)) });
  }

  return { gecerli, renk, esikHucreler, isinacaklar, ozelHayalet, etkiAlanlari, kombo };
}
