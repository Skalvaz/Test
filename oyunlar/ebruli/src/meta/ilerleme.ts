/**
 * İlerleme kuralları (GDD §12.3, §13.7): bölüm kilitleri, yıldızlar, en iyi
 * puan, ardışık kayıp (Usta'nın Eli), galeri tablosu seçimi. Saf: her işlev
 * yeni bir `Kayit` döndürür, girdiyi değiştirmez.
 */
import { bosBolumKaydi, type Ayarlar, type BolumKaydi, type Kayit, type TabloKaydi, type Yildiz } from './kayit';

/** Deneme sürümünün bölüm sayısı. */
export const BOLUM_SAYISI = 20;
/** Usta'nın Eli bu kadar ardışık kayıptan sonra önerilir (K16). */
export const USTA_ELI_SERI = 3;

const kopya = (k: Kayit): Kayit => ({
  ...k,
  bolumler: { ...k.bolumler },
  ogretim: { gorulenBalonlar: [...k.ogretim.gorulenBalonlar] },
  ayarlar: { ...k.ayarlar },
  istatistik: { ...k.istatistik },
});

export function bolumKaydi(k: Kayit, id: number): BolumKaydi {
  return k.bolumler[String(id)] ?? bosBolumKaydi();
}

/** Bölüm açık mı: 1 her zaman; diğerleri bir öncekinin kazanılmasıyla (yıldız kapısı yok). */
export function bolumAcik(k: Kayit, id: number): boolean {
  if (id < 1 || id > BOLUM_SAYISI) return false;
  return id === 1 || bolumKaydi(k, id - 1).kazanildi;
}

/** Açık en büyük bölüm (haritanın kendiliğinden kaydığı yer). */
export function sonAcikBolum(k: Kayit): number {
  let s = 1;
  for (let id = 2; id <= BOLUM_SAYISI; id++) if (bolumAcik(k, id)) s = id;
  return s;
}

/** Kazanılmamış ilk açık bölüm (yoksa son açık). "Sıradaki" bölüm. */
export function siradakiBolum(k: Kayit): number {
  for (let id = 1; id <= BOLUM_SAYISI; id++) if (bolumAcik(k, id) && !bolumKaydi(k, id).kazanildi) return id;
  return sonAcikBolum(k);
}

export function toplamYildiz(k: Kayit): number {
  let s = 0;
  for (const b of Object.values(k.bolumler)) s += b.yildiz;
  return s;
}

export function acikBolumSayisi(k: Kayit): number {
  let s = 0;
  for (let id = 1; id <= BOLUM_SAYISI; id++) if (bolumAcik(k, id)) s++;
  return s;
}

/** SaveStore karşılaştırması (§13.7): toplam yıldız × 1000 + açılan bölüm. */
export function ilerlemePuani(k: Kayit): number {
  return toplamYildiz(k) * 1000 + acikBolumSayisi(k);
}

/** İlk açılış mı: Bölüm 1 hiç kazanılmadıysa açılış doğrudan Bölüm 1'e gider (K12). */
export function ilkOturum(k: Kayit): boolean {
  return !bolumKaydi(k, 1).kazanildi;
}

/** Yeni deneme başladı: `denemeNo` = önceki deneme sayısı. */
export function denemeBaslat(k: Kayit, id: number): { kayit: Kayit; denemeNo: number } {
  const y = kopya(k);
  const b = { ...bolumKaydi(k, id) };
  const denemeNo = b.deneme;
  b.deneme++;
  y.bolumler[String(id)] = b;
  y.istatistik.oynanan++;
  return { kayit: y, denemeNo };
}

export interface BolumSonucu {
  id: number;
  kazanc: boolean;
  puan: number;
  yildiz: Yildiz;
  /** Bu oyundaki en uzun kaskat ve Lale sayısı (istatistik). */
  kaskat?: number;
  lale?: number;
  /** Kazançta bu oyunun tablosu. */
  tablo?: TabloKaydi | null;
}

/**
 * Bölüm bitti. Kazançta yıldız/en iyi puan büyür, ardışık kayıp sıfırlanır;
 * galeride tablo yoksa yeni tablo hemen girer (varsa oyuncu seçer:
 * `tabloSakla`). Kayıpta ardışık kayıp artar.
 */
export function bolumBitti(k: Kayit, s: BolumSonucu): Kayit {
  const y = kopya(k);
  const b = { ...bolumKaydi(k, s.id) };
  if (s.kazanc) {
    b.kazanildi = true;
    b.yildiz = Math.max(b.yildiz, s.yildiz, 1) as Yildiz;
    b.enIyi = Math.max(b.enIyi, s.puan);
    b.basarisizSeri = 0;
    if (!b.tablo && s.tablo) b.tablo = s.tablo;
    y.istatistik.kazanilan++;
  } else {
    b.basarisizSeri++;
  }
  y.istatistik.enUzunKaskat = Math.max(y.istatistik.enUzunKaskat, s.kaskat ?? 0);
  y.istatistik.lale += s.lale ?? 0;
  y.bolumler[String(s.id)] = b;
  return y;
}

/** Galeride bölümün tablosunu değiştir ("Bunu sakla"). */
export function tabloSakla(k: Kayit, id: number, t: TabloKaydi): Kayit {
  const y = kopya(k);
  y.bolumler[String(id)] = { ...bolumKaydi(k, id), tablo: t };
  return y;
}

/** Usta'nın Eli önerilsin mi (bu kayıp dahil ardışık kayıp ≥ 3). */
export function ustaEliOnerilir(k: Kayit, id: number): boolean {
  return bolumKaydi(k, id).basarisizSeri >= USTA_ELI_SERI;
}

export function balonGoruldu(k: Kayit, anahtar: string): Kayit {
  if (k.ogretim.gorulenBalonlar.includes(anahtar)) return k;
  const y = kopya(k);
  y.ogretim.gorulenBalonlar.push(anahtar);
  return y;
}

export function ayarDegistir(k: Kayit, yama: Partial<Ayarlar>): Kayit {
  const y = kopya(k);
  y.ayarlar = { ...y.ayarlar, ...yama };
  return y;
}

export function devamiGoruldu(k: Kayit): Kayit {
  const y = kopya(k);
  y.devamiGoruldu = true;
  return y;
}

/** İlerlemeyi sıfırla: ayarlar korunur. */
export function ilerlemeSifirla(k: Kayit, bos: Kayit): Kayit {
  return { ...bos, ayarlar: { ...k.ayarlar } };
}
