/**
 * Bölüm ölçütleri (GDD §14.4, FİTİL dersi 4). Saf: oyun sonuçlarından bölüm
 * ölçümü, bant hataları ve yıldız eşikleri.
 *
 * Bantlar (tür → Acemi alt sınırı, Usta bandı):
 *   öğretim ≥ %95 [98, 100] · tanıtım ≥ %40 [92, 100] · normal ≥ %25
 *   [85, 100] · zor ≥ %10 [60, 85] · rahatlama ≥ %60 [95, 100].
 * Bölüm verisindeki `botBandi` / `acemiAlt` bağlayıcıdır (tablo varsayılan).
 * Ek ölçütler (Usta): hamle öncesi ≥ 2 hazır ≥ %90, 0 hazır ≤ %3; Acemi
 * eşleşen hamle ≥ %60; Tarak ≤ 0,35/hamle; kaskat medyanı ≤ 1; tahmini süre
 * (Usta hamle medyanı × 3,5 sn) 45–150 sn; yakın kaçış: kayıpların ≥ %30'unda ilerleme
 * ≥ 0,8. Öğretimde (kısa, kurgulu) süre alt sınırı ve yakın kaçış uyarıdır.
 */
import type { BolumVerisi } from '../core/index';
import type { OyunSonucu } from './simulasyon';

export const BANTLAR: Record<BolumVerisi['tur'], { acemi: number; usta: [number, number] }> = {
  ogretim: { acemi: 95, usta: [98, 100] },
  tanitim: { acemi: 40, usta: [92, 100] },
  normal: { acemi: 25, usta: [85, 100] },
  zor: { acemi: 10, usta: [60, 85] },
  rahatlama: { acemi: 60, usta: [95, 100] },
};

/** Usta tahmini süre bandı (sn; hamle × 3,5 sn medyanı). */
export const SURE_ALT = 45;
export const SURE_UST = 150;

export interface BolumOlcumu {
  bolumId: number;
  tur: BolumVerisi['tur'];
  taslak: boolean;
  /** Usta koşu sayısı ve kazanma oranı (%). */
  ustaKosu: number;
  ustaKazanma: number;
  /** Acemi koşu sayısı ve kazanma oranı (%); ölçülmediyse null. */
  acemiKosu: number;
  acemiKazanma: number | null;
  /** Usta kayıplarının ilerlemesi ≥ 0,8 olan payı (%); kayıp yoksa null. */
  yakinKacis: number | null;
  /** Usta hamle öncesi durumlarında ≥ 2 hazır ve 0 hazır oranları (%). */
  hazir2: number;
  hazir0: number;
  /** Acemi eşleşen hamle oranı (%); Acemi yoksa null. */
  acemiEslesme: number | null;
  ustaEslesme: number;
  /** Usta hamle başına üretim (tarak, girdap, lale). */
  tarakHamle: number;
  girdapHamle: number;
  laleHamle: number;
  kaskatMedyan: number;
  /** Usta tahmini süre medyanı (sn). */
  sureSn: number;
  /** Kazanılan Usta oyunlarının puan yüzdelikleri (şölen dahil). */
  ustaP15: number;
  ustaP50: number;
  ustaP85: number;
  /** Kazanılan Acemi oyunlarının puan yüzdelikleri. */
  acemiP40: number;
  acemiP50: number;
  acemiP85: number;
  /** Kazanılan Usta oyunlarında hamle medyanı. */
  hamleMedyan: number;
  /** Yıldız dağılımı (0–3) yüzde olarak, mevcut eşiklerle. */
  ustaYildiz: [number, number, number, number];
  acemiYildiz: [number, number, number, number];
  garantiHamle: number;
}

/** En yakın sıra yüzdeliği (p ∈ [0, 100]); boş dizide 0. */
export function yuzdelik(sirali: readonly number[], p: number): number {
  if (sirali.length === 0) return 0;
  const k = Math.min(sirali.length - 1, Math.max(0, Math.ceil((p / 100) * sirali.length) - 1));
  return sirali[k];
}

const sirala = (a: number[]): number[] => a.slice().sort((x, y) => x - y);
const oran = (a: number, b: number): number => (b > 0 ? (100 * a) / b : 0);

function yildizDagilimi(l: readonly OyunSonucu[]): [number, number, number, number] {
  const s: [number, number, number, number] = [0, 0, 0, 0];
  for (const x of l) s[x.yildiz]++;
  return s.map((x) => oran(x, l.length)) as [number, number, number, number];
}

export function olcumHesapla(v: BolumVerisi, usta: readonly OyunSonucu[], acemi: readonly OyunSonucu[] = []): BolumOlcumu {
  const uk = usta.filter((s) => s.kazandi);
  const ak = acemi.filter((s) => s.kazandi);
  const kayip = usta.filter((s) => !s.kazandi);
  const top = (l: readonly OyunSonucu[], f: (s: OyunSonucu) => number): number => l.reduce((t, s) => t + f(s), 0);
  const uHamle = top(usta, (s) => s.hamle) || 1;
  const uPuan = sirala(uk.map((s) => s.puan));
  const aPuan = sirala(ak.map((s) => s.puan));
  return {
    bolumId: v.id,
    tur: v.tur,
    taslak: !!v.taslak,
    ustaKosu: usta.length,
    ustaKazanma: oran(uk.length, usta.length),
    acemiKosu: acemi.length,
    acemiKazanma: acemi.length ? oran(ak.length, acemi.length) : null,
    yakinKacis: kayip.length ? oran(kayip.filter((s) => s.ilerleme >= 0.8).length, kayip.length) : null,
    hazir2: oran(top(usta, (s) => s.hazir2), top(usta, (s) => s.durum)),
    hazir0: oran(top(usta, (s) => s.hazir0), top(usta, (s) => s.durum)),
    acemiEslesme: acemi.length ? oran(top(acemi, (s) => s.eslesenHamle), top(acemi, (s) => s.hamle)) : null,
    ustaEslesme: oran(top(usta, (s) => s.eslesenHamle), uHamle),
    tarakHamle: top(usta, (s) => s.tarak) / uHamle,
    girdapHamle: top(usta, (s) => s.girdap) / uHamle,
    laleHamle: top(usta, (s) => s.lale) / uHamle,
    kaskatMedyan: yuzdelik(sirala(usta.flatMap((s) => s.kaskatlar)), 50),
    sureSn: yuzdelik(sirala(usta.map((s) => s.sureMs / 1000)), 50),
    ustaP15: yuzdelik(uPuan, 15),
    ustaP50: yuzdelik(uPuan, 50),
    ustaP85: yuzdelik(uPuan, 85),
    acemiP40: yuzdelik(aPuan, 40),
    acemiP50: yuzdelik(aPuan, 50),
    acemiP85: yuzdelik(aPuan, 85),
    hamleMedyan: yuzdelik(sirala(uk.map((s) => s.hamle)), 50),
    ustaYildiz: yildizDagilimi(usta),
    acemiYildiz: yildizDagilimi(acemi),
    garantiHamle: top(usta, (s) => s.garantiKullanimi) / uHamle,
  };
}

const yuz = (x: number): number => Math.floor(x / 100) * 100;

/**
 * K13 yıldız eşikleri (FİTİL K24): 2★ = min(Usta p50, Acemi kazanç p50),
 * 3★ = Usta p85; kazanılan oyunların puanı (şölen dahil), aşağı 100'e.
 * Acemi hiç kazanmadıysa 2★ = Usta p50.
 */
export function yildizEsikleriK13(o: BolumOlcumu): [number, number] {
  const iki = o.acemiKazanma ? Math.min(o.ustaP50, o.acemiP50) : o.ustaP50;
  return [yuz(iki), yuz(Math.max(o.ustaP85, iki))];
}

/** Öğretim önerisi (§14.4, elleEsik): 2★ ≈ Acemi kazanç p40, 3★ ≈ Usta p50. */
export function yildizEsikleriOgretim(o: BolumOlcumu): [number, number] {
  const iki = o.acemiKazanma ? o.acemiP40 : o.ustaP15;
  return [yuz(iki), yuz(Math.max(o.ustaP50, iki))];
}

/**
 * Ölçüt hataları (§14.4–§14.5). Boş dizi = geçti. `uyarilar` ölçüm dışı
 * izlenenleri toplar.
 */
export function olcutHatalari(v: BolumVerisi, o: BolumOlcumu, uyarilar: string[] = []): string[] {
  const h: string[] = [];
  const bant = v.botBandi ?? BANTLAR[v.tur].usta;
  const acemiAlt = v.acemiAlt ?? BANTLAR[v.tur].acemi;
  const ogretim = v.tur === 'ogretim';
  if (o.ustaKazanma < bant[0] || o.ustaKazanma > bant[1]) h.push(`Usta %${o.ustaKazanma.toFixed(0)} bant [${bant[0]}, ${bant[1]}] dışında`);
  if (o.ustaKosu >= 100 && o.ustaKazanma === 0) h.push('100 tohumda hiç Usta kazancı yok');
  if (o.acemiKazanma !== null && o.acemiKazanma < acemiAlt) h.push(`Acemi %${o.acemiKazanma.toFixed(0)} < alt sınır %${acemiAlt}`);
  if (o.hazir2 < 90) h.push(`≥ 2 hazır %${o.hazir2.toFixed(0)} < %90`);
  if (o.hazir0 > 3) h.push(`0 hazır %${o.hazir0.toFixed(1)} > %3`);
  if (o.acemiEslesme !== null && o.acemiEslesme < 60) h.push(`Acemi eşleşen hamle %${o.acemiEslesme.toFixed(0)} < %60`);
  if (o.tarakHamle > 0.35) h.push(`Tarak ${o.tarakHamle.toFixed(2)}/hamle > 0,35`);
  if (o.kaskatMedyan > 1) h.push(`kaskat medyanı ${o.kaskatMedyan} > 1`);
  if (o.sureSn > SURE_UST) h.push(`süre ${o.sureSn.toFixed(0)} sn > ${SURE_UST}`);
  if (o.sureSn < SURE_ALT) (ogretim ? uyarilar : h).push(`süre ${o.sureSn.toFixed(0)} sn < ${SURE_ALT}`);
  if (o.yakinKacis !== null && o.yakinKacis < 30) (ogretim ? uyarilar : h).push(`yakın kaçış %${o.yakinKacis.toFixed(0)} < %30`);
  const [y2, y3] = v.yildizEsikleri;
  if (!(y2 > 0 && y3 >= y2)) h.push(`yıldız eşikleri [${y2}, ${y3}] geçersiz`);
  return h;
}
