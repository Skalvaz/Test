/**
 * Bölüm doğrulama ölçütleri (GDD §16.5 "Bot ölçütleri", §8.2, §8.3 sonu).
 * Saf: oyun sonuçlarından bölüm ölçümü ve ölçüt hataları.
 */
import type { BolumVerisi } from '../core/index';
import type { OyunSonucu } from './simulasyon';

export interface BolumOlcumu {
  bolumId: number;
  tur: BolumVerisi['tur'];
  taslak: boolean;
  kosu: number;
  kazanc: number;
  /** Usta kazanma oranı (%). */
  kazanmaOrani: number;
  kayip: number;
  /** Kayıpların ilerlemesi ≥ 0,8 olan payı (%); kayıp yoksa null. */
  yakinKacis: number | null;
  rMedyan: number;
  rP90: number;
  rP99: number;
  zincirMedyan: number;
  /** Oyuncu hamlesi başına oluşan özel taş (%). */
  roketOrani: number;
  kasimpatiOrani: number;
  yildizOrani: number;
  /** Hamle sonu ortalama ısı (ısı/kapsül) ve sınırı 0,3·eşik. */
  ortalamaIsi: number;
  isiSiniri: number;
  /** Tahmini süre medyanı (sn). */
  sureSn: number;
  /** Kazanılan oyunların puan medyanı ve 85. yüzdeliği (final dahil). */
  puanP50: number;
  puanP85: number;
  /** Kazanılan oyunlarda kullanılan hamle medyanı. */
  hamleMedyan: number;
  /** Acemi kazanma oranı (%), ölçüldüyse. */
  acemiOrani: number | null;
}

/** En yakın sıra yüzdeliği (p ∈ [0, 100]); boş dizide 0. */
export function yuzdelik(sirali: readonly number[], p: number): number {
  if (sirali.length === 0) return 0;
  const k = Math.min(sirali.length - 1, Math.max(0, Math.ceil((p / 100) * sirali.length) - 1));
  return sirali[k];
}

function sirala(a: number[]): number[] {
  return a.slice().sort((x, y) => x - y);
}

export function olcumHesapla(v: BolumVerisi, usta: readonly OyunSonucu[], acemi: readonly OyunSonucu[] = []): BolumOlcumu {
  const kazananlar = usta.filter((s) => s.kazandi);
  const kayiplar = usta.filter((s) => !s.kazandi);
  const R = sirala(usta.flatMap((s) => s.reaksiyonlar));
  const zincir = sirala(usta.flatMap((s) => s.zincirler));
  const hamle = usta.reduce((t, s) => t + s.hamle, 0) || 1;
  const isiT = usta.reduce((t, s) => t + s.isiToplam, 0);
  const isiN = usta.reduce((t, s) => t + s.isiSayi, 0) || 1;
  const puan = sirala(kazananlar.map((s) => s.puan));
  const n = usta.length || 1;
  return {
    bolumId: v.id,
    tur: v.tur,
    taslak: !!v.taslak,
    kosu: usta.length,
    kazanc: kazananlar.length,
    kazanmaOrani: (100 * kazananlar.length) / n,
    kayip: kayiplar.length,
    yakinKacis: kayiplar.length ? (100 * kayiplar.filter((s) => s.ilerleme >= 0.8).length) / kayiplar.length : null,
    rMedyan: yuzdelik(R, 50),
    rP90: yuzdelik(R, 90),
    rP99: yuzdelik(R, 99),
    zincirMedyan: yuzdelik(zincir, 50),
    roketOrani: (100 * usta.reduce((t, s) => t + s.roket, 0)) / hamle,
    kasimpatiOrani: (100 * usta.reduce((t, s) => t + s.kasimpati, 0)) / hamle,
    yildizOrani: (100 * usta.reduce((t, s) => t + s.yildiz, 0)) / hamle,
    ortalamaIsi: isiT / isiN,
    isiSiniri: 0.3 * v.esik,
    sureSn: yuzdelik(sirala(usta.map((s) => s.sureMs / 1000)), 50),
    puanP50: yuzdelik(puan, 50),
    puanP85: yuzdelik(puan, 85),
    hamleMedyan: yuzdelik(sirala(kazananlar.map((s) => s.hamle)), 50),
    acemiOrani: acemi.length ? (100 * acemi.filter((s) => s.kazandi).length) / acemi.length : null,
  };
}

/** Kalibrasyon (§7.4): kazanılan oyunların p50 ve p85 puanı, aşağı 100'e yuvarlanmış. */
export function yildizEsikleriHesapla(o: BolumOlcumu): [number, number] {
  return [Math.floor(o.puanP50 / 100) * 100, Math.floor(o.puanP85 / 100) * 100];
}

/**
 * Öğretim eşik önerisi (GDD K22, `elleEsik` bölümleri): makul oynayan (Acemi
 * medyanı civarı) çoğunlukla 2★, iyi oynayan (Usta medyanı) 3★ alsın.
 *  - 2★ = min(Acemi p40, Usta p15): Acemi'nin ~%60'ı, Usta'nın ~%85'i en az 2★.
 *  - 3★ = min(Usta p50, (Acemi p85 + Usta p50) / 2): Acemi p85 ile Usta p50
 *    arasının ortası; Acemi p85 Usta p50'yi aşıyorsa (kısa öğretimde Usta
 *    erken bitirip daha az puan toplar) Usta p50.
 * Girdiler kazanılan oyunların SIRALI puanları; aşağı 100'e yuvarlanır.
 */
export function yildizEsikleriOgretim(ustaPuan: readonly number[], acemiPuan: readonly number[]): [number, number] {
  const yuvarla = (x: number): number => Math.floor(x / 100) * 100;
  const u50 = yuzdelik(ustaPuan, 50);
  const uc = Math.min(u50, (yuzdelik(acemiPuan, 85) + u50) / 2);
  const iki = Math.min(yuzdelik(acemiPuan, 40), yuzdelik(ustaPuan, 15), uc);
  return [yuvarla(iki), yuvarla(uc)];
}

/**
 * K24 eşikleri (GDD K24, `esikKurali: 'k24'` bölümleri, 6–25): gündelik
 * oyuncunun ortalama galibiyeti 2★ getirsin, 3★ iyi oyunun ödülü kalsın.
 *  - 2★ = min(Usta p50, Acemi kazançlarının p50'si): Acemi kazançlarının
 *    yarısı, Usta'nın en az yarısı 2★.
 *  - 3★ = Usta p85 (§7.4'teki gibi).
 * Acemi hiç kazanmadıysa 2★ = Usta p50 (§7.4'e düşer). Girdiler kazanılan
 * oyunların SIRALI puanları; aşağı 100'e yuvarlanır.
 */
export function yildizEsikleriK24(ustaPuan: readonly number[], acemiPuan: readonly number[]): [number, number] {
  const yuvarla = (x: number): number => Math.floor(x / 100) * 100;
  const u50 = yuzdelik(ustaPuan, 50);
  const uc = yuzdelik(ustaPuan, 85);
  const iki = acemiPuan.length ? Math.min(u50, yuzdelik(acemiPuan, 50)) : u50;
  return [yuvarla(iki), yuvarla(uc)];
}

/**
 * Ölçüt hataları (§16.5). Boş dizi = geçti. `uyarilar` ölçüm dışı
 * izlenenleri toplar (Acemi oranı: öğretimde ≥ %80, tanıtımda ≥ %30 — K22).
 *
 * P4a yorumları:
 *  - Özel taş sıklığı ölçütü tanıtım ve öğretim bölümlerinde uygulanmaz
 *    (§16.5 "tanıtım bölümleri hariç"; öğretim de yeni taşı tanıtır).
 *  - Öğretim bölümlerinde (§15 sabit senaryoları: 3–4 renk, 5×6–7×8 tahta)
 *    şu dağılım ölçütleri raporlanır ama başarısızlık sayılmaz: tahmini süre
 *    alt sınırı (60 sn; Usta bot öğretimi 3–6 hamlede bitirir), reaksiyon
 *    medyanı ve p90 bandı, zincir medyanı (3–4 renkte bileşenler büyük,
 *    açgözlü Usta 8–9'luk zincir çizer). p99 ≤ 35, ısı ve süre üst sınırı
 *    öğretimde de geçerlidir.
 *  - Usta ve günlük bölümlerin bantları kendi verisinden okunur.
 */
export function olcutHatalari(v: BolumVerisi, o: BolumOlcumu, uyarilar: string[] = []): string[] {
  const h: string[] = [];
  const [min, max] = v.botBandi;
  if (o.kazanmaOrani < min || o.kazanmaOrani > max) h.push(`kazanma %${o.kazanmaOrani.toFixed(0)} bant [${min}, ${max}] dışında`);
  if (o.kazanc < 1) h.push('hiç kazanç yok');
  if (o.kazanmaOrani < 35) h.push(`kazanma %${o.kazanmaOrani.toFixed(0)} < %35`);
  if (o.yakinKacis !== null && o.yakinKacis < 30) h.push(`yakın kaçış %${o.yakinKacis.toFixed(0)} < %30`);
  const ogretim = v.tur === 'ogretim';
  if (!v.bayram) {
    if (o.rMedyan > 3 && !ogretim) h.push(`reaksiyon medyanı ${o.rMedyan} > 3`);
    if ((o.rP90 < 6 || o.rP90 > 14) && !ogretim) h.push(`reaksiyon p90 ${o.rP90} ∉ [6, 14]`);
    if (o.rP99 > 35) h.push(`reaksiyon p99 ${o.rP99} > 35`);
  }
  if ((o.zincirMedyan < 4 || o.zincirMedyan > 7) && !ogretim) h.push(`zincir medyanı ${o.zincirMedyan} ∉ [4, 7]`);
  if (v.tur !== 'tanitim' && v.tur !== 'ogretim') {
    if (o.roketOrani > 35) h.push(`roket %${o.roketOrani.toFixed(0)} > %35`);
    if (o.kasimpatiOrani > 15) h.push(`kasımpatı %${o.kasimpatiOrani.toFixed(0)} > %15`);
    if (o.yildizOrani > 6) h.push(`yıldız %${o.yildizOrani.toFixed(1)} > %6`);
  }
  if (o.ortalamaIsi > o.isiSiniri) h.push(`ortalama ısı ${o.ortalamaIsi.toFixed(2)} > ${o.isiSiniri.toFixed(2)}`);
  if (o.sureSn > 180) h.push(`süre ${o.sureSn.toFixed(0)} sn > 180`);
  if (o.sureSn < 60 && !ogretim) h.push(`süre ${o.sureSn.toFixed(0)} sn < 60`);
  if (o.acemiOrani !== null && v.tur === 'ogretim' && o.acemiOrani < 80) uyarilar.push(`Acemi %${o.acemiOrani.toFixed(0)} < %80 (öğretim)`);
  // İzleme (K22, ilk oturum tutunması): tanıtımda gündelik oyuncu vekili Acemi en az %30 kazanmalı.
  if (o.acemiOrani !== null && v.tur === 'tanitim' && o.acemiOrani < 30) uyarilar.push(`Acemi %${o.acemiOrani.toFixed(0)} < %30 (tanıtım)`);
  return h;
}
