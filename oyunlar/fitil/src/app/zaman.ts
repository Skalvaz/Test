/**
 * Uygulamanın zaman ve rastgelelik kaynakları. Çekirdek ve meta saftır
 * (Date/Math.random kullanmaz); bütün dış girdiler buradan gelir.
 */
import { tarihYyyymmdd } from '../meta';

/** Yerel takvim günü yyyymmdd (Günün Şenliği tohumu, §10.5). */
export function bugun(): number {
  const d = new Date();
  return tarihYyyymmdd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Duvar saati (epoch ms): kayda yazılan zamanlar için (can dolumu,
 * CAN-REKLAM §2). `simdi()` sayfa başına sıfırlanan monoton saattir, kayda yazılmaz.
 */
export function duvarSaati(): number {
  return Date.now();
}

/** Monoton ms saati. */
export function simdi(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * İlk açılış tohumu (`kayitTohumu`) ve ilerlemeyi sıfırlama: bu projede
 * crypto/Math.random'ın serbest olduğu TEK yer (sandık RNG'si kayıtta
 * tohumlanır, yeniden yükleme sonucu değiştirmez — §10.4).
 */
export function rastgeleTohum(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  } catch {
    return Math.floor(Math.random() * 4294967296) >>> 0;
  }
}

export function bekle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bir sonraki kare (sekme gizliyse kare gelene kadar bekler). */
export function kareBekle(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
