/**
 * Arayüz görünüm modelleri: uygulama (src/app) doldurur, ekranlar yalnız
 * okur. Arayüz çekirdeğe ve kayda dokunmaz; seçimleri Promise ile döndürür.
 */
import type { Motif, Renk } from '../core/types';
import type { AtolyeId } from '../app/katalog';
import type { Ayarlar } from '../meta/kayit';

export interface HedefVM {
  tur: 'topla' | 'kagit' | 'desen' | 'puan';
  renk?: Renk;
  motif?: Motif;
  gerekli: number;
  ilerleme: number;
  tamam: boolean;
}

export interface TarifVM {
  a: Renk;
  b: Renk;
  sonuc: Renk;
}

export interface HudVM {
  bolumId: number;
  ad: string;
  atolyeAd: string;
  hedefler: HedefVM[];
  kalanHamle: number;
  puan: number;
  esikler: [number, number];
  tarifler: TarifVM[];
  /** Tarif şeridi açık mı başlasın (bölüm 1–5 ya da ayar "her zaman"). */
  tarifAcik: boolean;
}

export interface HaritaBolumVM {
  id: number;
  ad: string;
  tur: string;
  acik: boolean;
  kazanildi: boolean;
  yildiz: number;
  siradaki: boolean;
  /** Düğüm damlasının rengi (renk kodu). */
  renk: Renk;
}

export interface HaritaAtolyeVM {
  id: AtolyeId;
  ad: string;
  altBaslik: string;
  cicek: 'lale' | 'karanfil';
  bolumler: HaritaBolumVM[];
  /** Atölyenin kazanılmış tabloları (küçük resim üreticisi). */
  tablolar: { id: number; ciz: (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas }[];
}

export interface HaritaVM {
  toplamYildiz: number;
  enCokYildiz: number;
  atolyeler: HaritaAtolyeVM[];
  /** Kendiliğinden kayılacak bölüm. */
  odak: number;
  /** Kartı kendiliğinden açılacak bölüm (bölüm kazanılınca sıradaki). */
  kartAc: number | null;
  devamiAcik: boolean;
}

export type HaritaSecimi = { tur: 'bolum'; id: number } | { tur: 'galeri' } | { tur: 'ayarlar' } | { tur: 'devami' } | { tur: 'nasil' };

export interface BolumOncesiVM {
  id: number;
  ad: string;
  atolyeAd: string;
  tur: string;
  hedefler: HedefVM[];
  hamle: number;
  enIyi: number;
  yildiz: number;
  yeni: { ad: string; metin: string; ikon: string } | null;
  tablo: ((w: number, h: number) => HTMLCanvasElement | OffscreenCanvas) | null;
}

export interface KazandinVM {
  ad: string;
  atolyeAd: string;
  bolumId: number;
  puan: number;
  yildiz: 0 | 1 | 2 | 3;
  nadirlik: 0 | 1 | 2;
  teknikler: string[];
  /** Galeride eski tablo var mı (varsa oyuncu seçer). */
  eskiTablo: ((w: number, h: number) => HTMLCanvasElement | OffscreenCanvas) | null;
  eskiPuan: number;
  /** "Sıradaki: Mavi boya!" */
  siradaki: string | null;
  ilkTablo: boolean;
  /** Tablo (tam boy tuval) ve kâğıt çekme sonundaki ekran yeri (devralma canlandırması). */
  tuval: HTMLCanvasElement | OffscreenCanvas;
  baslangic: { x: number; y: number; w: number; h: number } | null;
  ustaEli: boolean;
}

export type KazandinSecimi = { secim: 'devam' | 'tekrar'; tabloSakla: boolean };

export interface KaybettinVM {
  ad: string;
  yuzde: number;
  eksik: string;
  /** Yarım kalan tablo (soluk; ekran açıldıktan sonra çizilir). */
  yarimTablo: ((w: number, h: number) => HTMLCanvasElement | OffscreenCanvas) | null;
  ustaEli: boolean;
}

export type KaybettinSecimi = 'tekrar' | 'harita' | 'ustaEli';

export interface GaleriKartVM {
  id: number;
  ad: string;
  acik: boolean;
  kazanildi: boolean;
  yildiz: number;
  puan: number;
  nadirlik: number;
  teknikler: string[];
  renk: Renk;
  ciz: ((w: number, h: number) => HTMLCanvasElement | OffscreenCanvas) | null;
}

export interface GaleriVM {
  atolyeler: { id: AtolyeId; ad: string; kartlar: GaleriKartVM[] }[];
  baslangic: AtolyeId;
}

export type AyarlarVM = Ayarlar & { sistemAzHareket: boolean; kayitBellek: boolean };

export type DuraklatSecimi = 'devam' | 'yeniden' | 'ayarlar' | 'harita';

export interface DevamiVM {
  toplamYildiz: number;
  enCokYildiz: number;
  tablolar: { id: number; ciz: ((w: number, h: number) => HTMLCanvasElement | OffscreenCanvas) | null; renk: Renk }[];
}
