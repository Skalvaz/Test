/**
 * Oyun olayı sözleşmesi (Dalga 0, T-20): simülasyon olayları (EngineSim,
 * `SimEventType`) ve uygulamanın kendi olayları (otomatik çalıştırma
 * adımları) tek akışta. Paketler App.ts'e dokunmadan dinler:
 *
 *   const off = app.onSimEvent((e) => { if (e.type === 'surge') … });
 *
 * Kullananlar: 3C başarımlar, 3D olay kamerası ve anlık tekrar, 2G olay
 * sesleri, testler ve kayıt sahneleri (`app.advanceUntil('lightoff')`).
 * Olay, simülasyon adımının içinde (sim.step sırasında) gelir; dinleyici
 * ağır iş yapmamalı, sahneyi değiştirmemelidir (bir sonraki kareye ertele).
 * Atılan hata akışı kesmez (konsola yazılır).
 */

import type { Severity, SimEvent, SimEventType } from '../sim';

/** Uygulama düzeyi olaylar (simülasyonun bilmediği adımlar) */
export type AppEventType =
  /** Otomatik çalıştırma başladı (APU BLEED, ateşleme, marş açık) */
  | 'autoStartBegin'
  /** Otomatik çalıştırma yakıtı açtı (N2 ≥ yakıt eşiği; bugün ~23,9 s) */
  | 'autoStartFuel'
  /** Otomatik çalıştırma bitti: rölanti, APU BLEED ve ateşleme kapandı (~40 s) */
  | 'autoStartDone'
  /** Otomatik çalıştırma yarıda kaldı; neden `reason`'da (bugün yalnız `noLightoff`: marş kapandı, motor yanmadı) */
  | 'autoStartAbort';

export interface AppEvent {
  type: AppEventType;
  /** Simülasyon zamanı [s] */
  time: number;
  severity: Severity;
  message: string;
  /**
   * Olayın nedeni (otomatik çalıştırmada `AutoStartReason`: 'noLightoff',
   * 1B'nin 'wetStart' / 'hotStart' …); yoksa undefined
   */
  reason?: string;
}

export type GameEvent = SimEvent | AppEvent;
export type GameEventType = SimEventType | AppEventType;

export type GameEventListener = (e: GameEvent) => void;

/** Basit olay akışı: sırayla ve yalıtılmış dinleyiciler */
export class EventBus {
  private listeners = new Set<GameEventListener>();

  on(fn: GameEventListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e: GameEvent) {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch (err) {
        console.error('Olay dinleyicisi hata verdi', e.type, err);
      }
    }
  }

  get size(): number {
    return this.listeners.size;
  }
}
