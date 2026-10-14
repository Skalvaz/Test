/**
 * Yönetmen kamerası ve sarsıntı (GDD §12.1).
 *
 *  - Travma modeli: kayma 10 px × travma², yön 2B Perlin (25 Hz); dönme
 *    ±1,2° × travma²; travma saniyede 1,6 azalır; üst sınır 1.
 *  - Yönetmen: zaman ölçeği 80 ms'de 0,3'e (outCubic), 450 ms bekler, 250 ms'de
 *    1'e (inOutCubic); aynı sürede ağırlık merkezine 1,04× yakınlaşma.
 *    "Hareketi azalt": ölçek 0,6, bekleme 150 ms, yakınlaşma ve sarsıntı yok.
 *  - Hit-stop: görsel donma (özel 50 ms, kombinasyon 80 ms).
 *  - Tam ekran flaş: saniyede en fazla 3, alfa ≤ 0,35.
 */
import { inOutCubic, outCubic, perlin1 } from './matematik';

export const YAVAS_IN_MS = 80;
export const YAVAS_BEKLE_MS = 450;
export const YAVAS_CIK_MS = 250;

export class Kamera {
  travma = 0;
  hareketiAzalt = false;
  /** Gerçek zaman (ms) — sarsıntı gürültüsü için. */
  private saat = 0;
  /** Hit-stop kalan gerçek ms. */
  private donma = 0;
  /** Yönetmen evresi: −1 kapalı; ≥ 0 geçen gerçek ms. */
  private yonetmen = -1;
  private yBekle = YAVAS_BEKLE_MS;
  private yOlcek = 0.3;
  private yZoom = 1.04;
  /** Yakınlaşma odağı (ekran px). */
  odakX = 0;
  odakY = 0;
  /** Hesaplanan değerler (her karede). */
  zamanOlcegi = 1;
  zoom = 1;
  kx = 0;
  ky = 0;
  aci = 0;
  /** Tam ekran flaş alfası. */
  flas = 0;
  private flasHiz = 0;
  private flasZaman = new Float64Array(3);
  private flasSira = 0;
  /** Yavaş çekim değişim dinleyicisi. */
  dinle: (yavas: boolean) => void = () => {};
  private yavasBildirildi = false;

  sars(miktar: number): void {
    if (this.hareketiAzalt) return;
    this.travma = Math.min(1, this.travma + miktar);
  }

  hitStop(ms: number): void {
    this.donma = Math.max(this.donma, ms);
  }

  /** Yönetmen kamerasını başlat; odak ekran koordinatıdır. */
  yonet(odakX: number, odakY: number): void {
    this.odakX = odakX;
    this.odakY = odakY;
    this.yonetmen = 0;
    this.yBekle = this.hareketiAzalt ? 150 : YAVAS_BEKLE_MS;
    this.yOlcek = this.hareketiAzalt ? 0.6 : 0.3;
    this.yZoom = this.hareketiAzalt ? 1 : 1.04;
    if (!this.yavasBildirildi) {
      this.yavasBildirildi = true;
      this.dinle(true);
    }
  }

  yonetmenAcik(): boolean {
    return this.yonetmen >= 0;
  }

  /** Flaş iste; saniyede 3'ü aşarsa reddedilir. */
  flasIste(alfa: number, sureMs: number): boolean {
    const eski = this.flasZaman[this.flasSira];
    if (eski > 0 && this.saat - eski < 1000) return false;
    this.flasZaman[this.flasSira] = this.saat || 1;
    this.flasSira = (this.flasSira + 1) % 3;
    const a = Math.min(0.35, this.hareketiAzalt ? alfa * 0.5 : alfa);
    this.flas = Math.max(this.flas, a);
    this.flasHiz = a / Math.max(16, sureMs);
    return true;
  }

  /** Oynatma bitince ya da sahne değişince. */
  sifirla(): void {
    this.travma = 0;
    this.donma = 0;
    this.flas = 0;
    if (this.yonetmen >= 0) this.bitir();
    this.zamanOlcegi = 1;
    this.zoom = 1;
  }

  private bitir(): void {
    this.yonetmen = -1;
    if (this.yavasBildirildi) {
      this.yavasBildirildi = false;
      this.dinle(false);
    }
  }

  /** Gerçek zamanla ilerlet; `zamanOlcegi` sonraki oyun dt çarpanıdır. */
  guncelle(gercekMs: number): void {
    this.saat += gercekMs;
    const sn = gercekMs / 1000;
    this.travma = Math.max(0, this.travma - 1.6 * sn);
    if (this.flas > 0) this.flas = Math.max(0, this.flas - this.flasHiz * gercekMs);

    let olcek = 1;
    let zoom = 1;
    if (this.yonetmen >= 0) {
      this.yonetmen += gercekMs;
      const t = this.yonetmen;
      const bekle = this.yBekle;
      let k: number;
      if (t < YAVAS_IN_MS) k = outCubic(t / YAVAS_IN_MS);
      else if (t < YAVAS_IN_MS + bekle) k = 1;
      else if (t < YAVAS_IN_MS + bekle + YAVAS_CIK_MS) k = 1 - inOutCubic((t - YAVAS_IN_MS - bekle) / YAVAS_CIK_MS);
      else {
        k = 0;
        this.bitir();
      }
      olcek = 1 + (this.yOlcek - 1) * k;
      zoom = 1 + (this.yZoom - 1) * k;
    }
    if (this.donma > 0) {
      this.donma = Math.max(0, this.donma - gercekMs);
      olcek = 0;
    }
    this.zamanOlcegi = olcek;
    this.zoom = zoom;

    const t2 = this.hareketiAzalt ? 0 : this.travma * this.travma;
    const f = (this.saat / 1000) * 25;
    this.kx = 10 * t2 * perlin1(f, 1);
    this.ky = 10 * t2 * perlin1(f, 2);
    this.aci = ((1.2 * Math.PI) / 180) * t2 * perlin1(f, 3);
  }
}
