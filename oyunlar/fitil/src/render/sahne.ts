/**
 * Çizici modüllerinin ortak durumu: geometri, sprite önbellekleri, parçacık
 * havuzu, kamera, görsel tahta, seçenekler ve dönüşümler. Modüller bunu
 * kurucuda alır; döngüsel bağımlılık olmaz.
 */
import type { CiziciSecenek, Dikdortgen, Palet } from '../app/sozlesme';
import type { Konum } from '../core/types';
import { Rng } from '../platform/rng';
import { Donusum } from './donusum';
import { GorselTahta } from './gorselTahta';
import { Kamera } from './kamera';
import { efektRenkleri, kapsulRenkleri, type KapsulRengi } from './palet';
import { ParcacikHavuzu } from './parcacik';
import { EngelSpritelari } from './sprite/engel';
import { KapsulSpritelari } from './sprite/kapsul';
import { PariltiSpritelari } from './sprite/parilti';

export interface SahneSecenek extends CiziciSecenek {
  /** Takılı havai fişek desenleri (gökte rastgele bunlardan). */
  desenler: readonly string[];
  /** Fitil görünümü (katalog FITILLER kimliği). */
  fitil: string;
}

export class Sahne {
  // --- Ekran ---
  ekranW = 1;
  ekranH = 1;
  dpr = 1;
  // --- Tahta geometrisi (CSS px) ---
  c = 48;
  gx = 0;
  gy = 0;
  /** Tahtaya ayrılan alan ve gök bandı. */
  alan: Dikdortgen = { x: 0, y: 0, w: 1, h: 1 };
  gokBandi: Dikdortgen = { x: 0, y: 0, w: 1, h: 1 };
  /** Çerçeve kalınlığı (px). */
  cerceve = 14;

  // --- Kaynaklar ---
  readonly kapsul = new KapsulSpritelari();
  readonly engel = new EngelSpritelari();
  readonly parilti = new PariltiSpritelari();
  renkler: string[] = efektRenkleri('standart');
  kapsulRenk: KapsulRengi[] = kapsulRenkleri('standart');
  readonly havuz = new ParcacikHavuzu();
  readonly rnd = new Rng(0xf171);
  readonly kamera = new Kamera();
  readonly tahta = new GorselTahta();

  secenek: SahneSecenek = {
    hareketiAzalt: false,
    hiz: 1,
    palet: 'standart',
    kalite: 'oto',
    desenler: ['kasimpati', 'palmiye', 'halka'],
    fitil: 'kenevir',
  };
  /** Otomatik kalitede parıltı katmanı açık mı. */
  parilti_ = true;

  // --- Zaman ---
  /** Gerçek zaman (ms; dondurulunca durur). */
  zaman = 0;
  /** Oyun zamanı (ms; yavaş çekim ve hızlandırma dahil). */
  oyunZamani = 0;
  /** Oynatma sürüyor mu (boşta nefes kapalı). */
  oynuyor = false;

  // --- Dönüşümler ---
  /** DPR × kamera (tahta katmanı). */
  readonly tTahta = new Donusum();
  /** DPR × kısmi sarsıntı (gök katmanı). */
  readonly tGok = new Donusum();
  /** Yalnız DPR (ekran katmanı). */
  readonly tEkran = new Donusum();

  // --- Önizleme bayrakları (yol katmanı yazar, tahta çizimi okur) ---
  titresim = new Float32Array(0);
  /** Hücre kararması (zorunlu vurgu): 0..1. */
  karartma = new Float32Array(0);

  /** Hücre merkezi (CSS px, tahta uzayı). */
  mx(x: number): number {
    return this.gx + (x + 0.5) * this.c;
  }
  my(y: number): number {
    return this.gy + (y + 0.5) * this.c;
  }

  /** Tahta uzayından ekrana (kamera dahil, DPR hariç). */
  ekrana(x: number, y: number, cikis: { x: number; y: number }): void {
    const t = this.tTahta;
    cikis.x = (t.a * x + t.c * y + t.e) / this.dpr;
    cikis.y = (t.b * x + t.d * y + t.f) / this.dpr;
  }

  /** Paleti ve hücre boyunu sprite'lara uygula. */
  kaynaklariHazirla(palet: Palet): void {
    const d = Math.min(2, this.dpr);
    this.kapsul.hazirla(this.c, d, palet);
    this.kapsulRenk = this.kapsul.renkler;
    this.engel.hazirla(this.c, d, this.kapsulRenk);
    this.renkler = efektRenkleri(palet);
    this.parilti.hazirla(d, this.renkler);
  }

  icinde(p: Konum): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.tahta.w && p.y < this.tahta.h;
  }
}
