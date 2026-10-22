/**
 * Ebruli katalogu (P0, GDD §1, §2.3, §9, §11): renkler, motifler, atölyeler, ebru
 * tablosu teknikleri. Çizici, ses, arayüz ve tablo bu sabitleri paylaşır;
 * çekirdek yalnız renk KODLARINI bilir (src/core/types.ts `Renk`).
 *
 * Renk kodu 3 bittir: Kırmızı 1, Sarı 2, Mavi 4 (ham boyalar); Turuncu 3,
 * Mor 5, Yeşil 6 (karışık renkler); Mürekkep 7. Karışım bit VEYA'dır.
 */
import { t } from '../platform/dil';
import type { Renk, OzelTur, Teknik } from '../core/types';
import { fnv1a } from '../core/rng';

export type Motif = 'nokta' | 'halka' | 'dalga';

export interface RenkTanimi {
  kod: Renk;
  /** Arayüzde görünen ad. */
  ad: string;
  /** Ebru boyası adı (tablo künyesi, "Nasıl oynanır"). */
  ebruAdi: string;
  /** Ham boya mı (karışabilir, eşleşmez). */
  ham: boolean;
  /** Karışık renkse iki ebeveyni (ham kodlar). */
  ebeveyn: readonly [Renk, Renk] | null;
  /** Renk körlüğü motifleri: ham bir motif, karışık iki ebeveynin motifi (§11.2). */
  motifler: readonly Motif[];
  /** Standart palet [ana, açık, koyu] (koyu su üstünde). */
  standart: readonly [string, string, string];
  /** Renk körü paleti (Okabe–Ito uyarlaması) [ana, açık, koyu]. */
  renkKoru: readonly [string, string, string];
  /**
   * Ses (§10.3): Re hicaz dizisinde derece (0 D4, 1 E♭4, 2 F♯4, 3 G4, 4 A4,
   * 5 B♭4, 6 C5, 7 D5; −7 = D3). Renk notaları konsonanstır (K18).
   */
  derece: number;
}

export const RENK_TANIMLARI: Readonly<Record<Renk, RenkTanimi>> = {
  1: { kod: 1, ad: t('Kırmızı', 'Red'), ebruAdi: 'lal', ham: true, ebeveyn: null, motifler: ['nokta'], standart: ['#D6423A', '#F29A8E', '#7E1D1A'], renkKoru: ['#D55E00', '#F2A36B', '#7A3600'], derece: 0 },
  2: { kod: 2, ad: t('Sarı', 'Yellow'), ebruAdi: 'zerrin', ham: true, ebeveyn: null, motifler: ['halka'], standart: ['#F0C23B', '#FBE7A1', '#8A6A10'], renkKoru: ['#F0E442', '#FBF5B0', '#8A8212'], derece: 2 },
  4: { kod: 4, ad: t('Mavi', 'Blue'), ebruAdi: 'çivit', ham: true, ebeveyn: null, motifler: ['dalga'], standart: ['#4A86D4', '#A9C8F0', '#1D3F73'], renkKoru: ['#0072B2', '#7FB8DC', '#003E61'], derece: 4 },
  3: { kod: 3, ad: t('Turuncu', 'Orange'), ebruAdi: 'nar çiçeği', ham: false, ebeveyn: [1, 2], motifler: ['nokta', 'halka'], standart: ['#EE7F2D', '#F9C08F', '#8A3F0C'], renkKoru: ['#E69F00', '#F5CF7A', '#7D5600'], derece: 3 },
  5: { kod: 5, ad: t('Mor', 'Purple'), ebruAdi: 'menekşe', ham: false, ebeveyn: [1, 4], motifler: ['nokta', 'dalga'], standart: ['#9A5CC6', '#D3B3EA', '#4B2468'], renkKoru: ['#CC79A7', '#EBC0D8', '#6E3A57'], derece: 5 },
  6: { kod: 6, ad: t('Yeşil', 'Green'), ebruAdi: 'zümrüt', ham: false, ebeveyn: [2, 4], motifler: ['halka', 'dalga'], standart: ['#3FA86B', '#A6DDBC', '#175C36'], renkKoru: ['#009E73', '#7FD1B9', '#00553E'], derece: 6 },
  7: { kod: 7, ad: t('Mürekkep', 'Ink'), ebruAdi: 'is mürekkebi', ham: false, ebeveyn: null, motifler: ['nokta', 'halka', 'dalga'], standart: ['#1A1714', '#4A4038', '#000000'], renkKoru: ['#1A1714', '#5A5048', '#000000'], derece: -7 },
};

/** Ham boyalar ve karışık renkler (sıra: arayüz, tarif şeridi). */
export const HAM_RENKLER: readonly Renk[] = [1, 2, 4];
export const KARISIK_RENKLER: readonly Renk[] = [3, 5, 6];

/** Tarif şeridi (§11.6): ham + ham = karışık. */
export const TARIFLER: readonly { a: Renk; b: Renk; sonuc: Renk }[] = [
  { a: 1, b: 2, sonuc: 3 },
  { a: 1, b: 4, sonuc: 5 },
  { a: 2, b: 4, sonuc: 6 },
];

/** Genel palet (CSS belirteçleriyle aynı; tuval çizimi için). */
export const PALET = {
  suUst: '#0B2B2E',
  suAlt: '#0A1E33',
  suParilti: '#1F4D4F',
  kagit: '#F3E9D2',
  kagitGolge: '#E4D5B4',
  kagitKenar: '#CDB892',
  murekkep: '#1E1A16',
  murekkepIkincil: '#5A4E3F',
  altin: '#C9A227',
  altinAcik: '#E8CD6A',
  altinKoyu: '#8A6D12',
  cevizKoyu: '#3B2416',
  ceviz: '#5A3A22',
  cevizDamar: '#7A5233',
  uyari: '#B8322A',
  basari: '#2F7D4F',
  /** Mermer engeli [ana, damar]. */
  mermer: ['#D9D4CB', '#9C958A'],
  /** Yağ lekesi (zemin) — gökkuşağı yanardöner film tabanı. */
  yag: '#2A2F1E',
} as const;

/** Özel taş görünür adları ve ebru karşılıkları (§5). */
export const OZEL_TANIMLARI: Readonly<Record<Exclude<OzelTur, 'yok'>, { ad: string; ebru: string; aciklama: string }>> = {
  tarak: { ad: t('Tarak', 'Comb'), ebru: 'taraklı ebru', aciklama: t('4 damla: satırı ya da sütunu tarar.', '4 drops: combs a row or a column.') },
  girdap: { ad: t('Girdap', 'Swirl'), ebru: 'bülbül yuvası', aciklama: t('5–6 damla: çevresini yutar.', '5–6 drops: swallows its surroundings.') },
  lale: { ad: t('Lale', 'Tulip'), ebru: 'lale ebrusu', aciklama: t('7+ damla: bir rengin hepsini kaldırır.', '7+ drops: lifts every drop of one color.') },
  murekkep: { ad: t('Mürekkep', 'Ink'), ebru: 'is serpintisi', aciklama: t('Yanında eşleşme olunca patlar.', 'Pops when a match happens next to it.') },
};

export type AtolyeId = 'uskudar' | 'bursa';

export interface Atolye {
  id: AtolyeId;
  ad: string;
  /** Harita alt başlığı. */
  altBaslik: string;
  /** Bölüm aralığı (dahil). */
  bolumler: readonly [number, number];
  /** Su tonu [üst, alt, parıltı]. */
  su: readonly [string, string, string];
  /** Atölyenin imza çiçeği (desen hedefi motifi, tablo). */
  cicek: 'lale' | 'karanfil';
  /** Ortam sesi karakteri (§10.4). */
  ortam: 'liman' | 'han';
}

export const ATOLYELER: readonly Atolye[] = [
  { id: 'uskudar', ad: 'Üsküdar', altBaslik: t('Lale atölyesi', 'Tulip workshop'), bolumler: [1, 10], su: ['#0B2B2E', '#0A1E33', '#1F4D4F'], cicek: 'lale', ortam: 'liman' },
  { id: 'bursa', ad: 'Bursa', altBaslik: t('İpek hanında karanfil', 'Carnations at the silk inn'), bolumler: [11, 20], su: ['#14262E', '#1B1530', '#3A3350'], cicek: 'karanfil', ortam: 'han' },
];

export interface TeknikTanimi {
  id: Teknik;
  ad: string;
  /** Galeri kartı açıklaması (tek satır). */
  aciklama: string;
  /** Hangi koşulda tabloya girer (§9.2; bilgi amaçlı, karar `src/tablo`'da). */
  kosul: string;
}

/** Ebru tablosu teknikleri (§9.2). Gerçek ebru türleri; tamamı prosedürel. */
export const TEKNIKLER: readonly TeknikTanimi[] = [
  { id: 'battal', ad: t('Battal ebru', 'Battal marbling'), aciklama: t('Serpilmiş boya halkaları; ebrunun temeli.', 'Scattered rings of paint; the base of marbling.'), kosul: 'her tablo (taban katman)' },
  { id: 'gelgit', ad: t('Gelgit ebru', 'Gel-git marbling'), aciklama: t('Biz ile ileri geri çekilmiş dalgalar.', 'Waves drawn back and forth with a stylus.'), kosul: 'uzun kaskat (k ≥ 3)' },
  { id: 'tarakli', ad: t('Taraklı ebru', 'Combed marbling'), aciklama: t('Tarakla taranmış ince dalgalı çizgiler.', 'Fine wavy lines drawn with a comb.'), kosul: 'Tarak ateşlendi' },
  { id: 'sal', ad: t('Şal ebru', 'Shawl marbling'), aciklama: t('Gelgitin üstünden geçen tarak: şal deseni.', 'A comb pulled over gel-git: the shawl pattern.'), kosul: 'gelgit ve taraklı aynı tabloda' },
  { id: 'bulbulYuvasi', ad: t('Bülbül yuvası', 'Nightingale’s nest'), aciklama: t('Biz ile çevrilmiş sarmal yuvalar.', 'Spiral nests turned with a stylus.'), kosul: 'Girdap ateşlendi' },
  { id: 'cicek', ad: t('Çiçek ebrusu', 'Flower marbling'), aciklama: t('Atölyenin çiçeği: lale ya da karanfil.', 'The workshop’s flower: tulip or carnation.'), kosul: 'Lale ya da desen hedefi' },
];

/** Tablo nadirliği (§9.4). */
export const NADIRLIK = t(['Sade', 'Zarif', 'Şaheser'] as const, ['Plain', 'Elegant', 'Masterpiece'] as const);

/** Ebru tablosu tohumu (§9.3): aynı bölüm, deneme ve puan → aynı tablo. */
export function tabloTohumu(bolumId: number, denemeNo: number, puan: number): number {
  return fnv1a(`ebruli|${bolumId}|${denemeNo}|${puan}`);
}
