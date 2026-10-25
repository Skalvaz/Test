/**
 * Simülasyon saati (Dalga 0 kanca noktası; duraklatma A-21 için 1D, sesin
 * kısılması S-19 için 1E kullanır). Kare süresini simülasyon adımına
 * çevirir: zaman ölçeği (test hücresindeki ¼×…4×), duraklatma ve
 * duraklatılmışken tek adım. Bugün kimse duraklatmaz: davranış eskisiyle
 * aynıdır (simDt = dt × ölçek).
 *
 * Duraklama yalnız simülasyon adımını keser; öbür saatler şöyle bağlıdır:
 * - Ders koşucusu (hedefler, ders süresi, "tut" sayaçları) simDt alır
 *   (App.simFrame): duraklamada durur.
 * - Görsel (dönme, ısıl, efektler) ve hava/yağmur simDt alır: donar.
 * - Ses: App `onChange`'i `audio.setPaused`'a bağlar (ses kısılır; 1E
 *   gövdeyi geliştirir).
 * - Kamera, ortam geçişi, post zinciri ve arayüz animasyonları gerçek dt
 *   alır: kamera serbest kalır.
 * - Bildirim süreleri (Toasts) bugün duvar saatiyle; 1D (A-03 "simülasyon
 *   saati") onları buna bağlar.
 *
 * 1D: Boşluk → `toggle()`, nokta → `stepOnce()` (tuş tablosu
 * `app.priorityKeyHooks` ile: odak bir düğmedeyken de çalışır).
 */

export class SimClock {
  private _paused = false;
  private pendingSteps = 0;
  private listeners = new Set<(paused: boolean) => void>();

  get paused(): boolean {
    return this._paused;
  }

  setPaused(on: boolean) {
    if (on === this._paused) return;
    this._paused = on;
    if (!on) this.pendingSteps = 0;
    for (const fn of this.listeners) {
      try {
        fn(on);
      } catch (err) {
        console.error('Saat dinleyicisi hata verdi', err);
      }
    }
  }

  toggle() {
    this.setPaused(!this._paused);
  }

  /** Duraklatılmışken bir sonraki karede bir adım ilerlet */
  stepOnce(n = 1) {
    if (this._paused) this.pendingSteps += n;
  }

  /**
   * Bu karenin simülasyon adımı [s]: duraklatılmışsa 0 (bekleyen tek adım
   * varsa bir kare süresi), değilse dt × ölçek.
   */
  simDt(dt: number, scale = 1): number {
    if (!this._paused) return dt * scale;
    if (this.pendingSteps > 0) {
      this.pendingSteps--;
      return dt * scale;
    }
    return 0;
  }

  /** Duraklatma değişimini dinler (ses, arayüz) */
  onChange(fn: (paused: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
