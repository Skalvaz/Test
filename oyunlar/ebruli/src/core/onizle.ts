/**
 * Önizleme (GDD §3.5, K8) ve hazır hamleler (§4.7, §12.4, §14).
 *
 * `onizle` hamleyi durumun kopyasında DOĞUMSUZ çözer (dolum yapılmaz, RNG
 * tüketilmez) — `hamleUygula` ile aynı kod yolu; bu yüzden hamlenin ilk
 * dolumdan önceki kısmıyla birebir aynıdır (temizlenen hücreler, gruplar,
 * özel taş hayaleti). Durumu değiştirmez; geçersiz hamlede fırlatmaz.
 */
import { Baglam } from './baglam';
import { eylemVeCozum, hamleHatasi } from './hamle';
import { hazirHamleler } from './hazir';
import { durumKopyala } from './tahta';
import type { Hamle, Konum, Olay, OlumluHamle, Onizleme, OyunDurumu, OzelTur, Renk, Yon } from './types';

/** Önizlemenin ayrıntısı (botlar ve testler için). */
export interface OnizlemeDetayi {
  onizleme: Onizleme;
  /** Doğumsuz çözümden sonraki durum (boşluklar boş). */
  durum: OyunDurumu;
  olaylar: Olay[];
  /** Doğumsuz çözümün puan artışı. */
  puanArtisi: number;
  /** Üretilen özel taşlar. */
  uretilen: { tarak: number; girdap: number; lale: number };
  /** Karışım Mürekkep üretti mi. */
  murekkepUretti: boolean;
  /** Temizlenen damla sayısı (taşınıp tüketilen özel taş dahil). */
  temizlenen: number;
}

const GUC: Record<OzelTur, number> = { yok: 0, tarak: 1, girdap: 2, lale: 3, murekkep: 0 };

function gecersiz(hata: Onizleme['hata']): Onizleme {
  return { gecerli: false, hata, sonuc: null, sonucHucre: null, gruplar: [], temizlenecek: [], ozelHayalet: null, etkiAlani: [], kombo: null, hedefArtisi: [] };
}

/** Geçerli hamlenin doğumsuz çözümü; geçersizse null. */
export function onizleDetay(d0: OyunDurumu, h: Hamle): OnizlemeDetayi | null {
  if (hamleHatasi(d0, h)) return null;
  const d = durumKopyala(d0);
  const c = new Baglam(d, true, d0.hamleNo);
  eylemVeCozum(c, h);
  const olaylar = c.olaylar;

  let sonuc: Renk | null = null;
  let sonucHucre: Konum | null = null;
  const gruplar: Onizleme['gruplar'] = [];
  const temizlenecek: Konum[] = [];
  let ozelHayalet: Onizleme['ozelHayalet'] = null;
  let etkiAlani: Konum[] = [];
  let kombo: Onizleme['kombo'] = null;
  const uretilen = { tarak: 0, girdap: 0, lale: 0 };
  let murekkepUretti = false;
  let ilkAdim = true;
  let ilkYercekimi = true;
  let alanAlindi = false;
  const gorulen = new Set<number>();
  for (const o of olaylar) {
    switch (o.tur) {
      case 'karisti':
        sonuc = o.sonuc;
        sonucHucre = { ...o.hedef };
        murekkepUretti = o.sonuc === 7;
        break;
      case 'yercekimi':
        if (ilkYercekimi && sonucHucre) {
          const m = o.dusenler.find((x) => x.den.x === sonucHucre!.x && x.den.y === sonucHucre!.y);
          if (m) sonucHucre = { ...m.e };
        }
        ilkYercekimi = false;
        break;
      case 'kaskat':
        ilkAdim = false;
        break;
      case 'eslesti':
        if (o.k === 1) gruplar.push({ renk: o.renk, hucreler: o.hucreler.map((p) => ({ ...p })) });
        break;
      case 'temizlendi': {
        const a = o.hucre.y * d.w + o.hucre.x;
        if (!gorulen.has(a)) {
          gorulen.add(a);
          temizlenecek.push({ ...o.hucre });
        }
        break;
      }
      case 'ozelOlustu': {
        const oz = o.damla.ozel as 'tarak' | 'girdap' | 'lale';
        uretilen[oz]++;
        if (ilkAdim && (!ozelHayalet || GUC[oz] > GUC[ozelHayalet.ozel]))
          ozelHayalet = { hucre: { ...o.hucre }, ozel: oz, yon: o.damla.yon as Yon, renk: o.damla.renk };
        break;
      }
      case 'ozelTetiklendi':
        if (!alanAlindi && sonuc === null) {
          etkiAlani = o.alan.map((p) => ({ ...p }));
          alanAlindi = true;
        }
        break;
      case 'birlesim':
        if (!alanAlindi) {
          etkiAlani = o.alan.map((p) => ({ ...p }));
          alanAlindi = true;
        }
        if (kombo === null) kombo = o.kombo;
        break;
      default:
        break;
    }
  }
  const hedefArtisi = d.hedefler.map((x, k) => x.ilerleme - d0.hedefler[k].ilerleme);
  const onizleme: Onizleme = {
    gecerli: true,
    hata: null,
    sonuc,
    sonucHucre,
    gruplar,
    temizlenecek,
    ozelHayalet,
    etkiAlani,
    kombo,
    hedefArtisi,
  };
  return { onizleme, durum: d, olaylar, puanArtisi: d.puan - d0.puan, uretilen, murekkepUretti, temizlenen: c.temizlenen };
}

/** Sürüklerken önizleme (§3.5): doğumsuz çözüm; geçersizde `gecerli: false`. */
export function onizle(d: OyunDurumu, h: Hamle): Onizleme {
  const hata = hamleHatasi(d, h);
  if (hata) return gecersiz(hata);
  return onizleDetay(d, h)!.onizleme;
}

/**
 * Hazır (olumlu) hamleler (§4.7): önizlemede ilk adımda en az bir grup
 * eşleşen geçerli KARIŞIM hamleleri; doğumsuz çözümde temizlenen damla
 * sayısına göre azalan, eşitlikte (kaynak indeksi, hedef indeksi) artan.
 * Özel taş sürüklemeleri listede yoktur. Bölüm bittiyse ya da hamle
 * kalmadıysa boş.
 */
export function olumluHamleler(d: OyunDurumu): OlumluHamle[] {
  if (d.bitti || d.kalanHamle <= 0) return [];
  const w = d.w;
  const K = (i: number): Konum => ({ x: i % w, y: (i - (i % w)) / w });
  const l = hazirHamleler(d).map((m) => {
    const hamle: Hamle = { tur: 'surukle', kaynak: K(m.k), hedef: K(m.e) };
    return { hamle, temizlenen: onizleDetay(d, hamle)!.temizlenen, k: m.k, e: m.e };
  });
  l.sort((a, b) => b.temizlenen - a.temizlenen || a.k - b.k || a.e - b.e);
  return l.map(({ hamle, temizlenen }) => ({ hamle, temizlenen }));
}
