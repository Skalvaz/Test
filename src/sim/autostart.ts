/**
 * Otomatik çalıştırma sırası (Dalga 0'da App'ten ayrıldı; sahibi 1B):
 * APU BLEED + ateşleme + marş açılır, N2 yakıt eşiğinin 2 puan üstünde
 * yakıt verilir, motor rölantiye oturunca BLEED ve ateşleme kapanır. Marş
 * kapanıp motor yanmadan N2 düşerse sıra bırakılır.
 *
 * Her adım `onStep(adım, bilgi)` ile bildirilir; App bunu oyun olayına
 * çevirir (`autoStartFuel`, `autoStartDone`, `autoStartAbort`;
 * src/app/events.ts) ve iletiyi, önemi ve nedeni **bilgiden** alır: App'te
 * sabit metin yoktur. Adımlar sabittir; 1B (F-05/F-06…) ıslak/sıcak
 * çalıştırmada kesme mantığını buraya ekler ve yeni durumları `abort`
 * adımının nedeni olarak bildirir (`reason: 'hotStart'`, kendi iletisi ve
 * önemiyle). Yeni bir adım gerekirse App'teki eşleme için kanca isteği.
 */

import type { EngineSim, Severity } from './engineSim';

export type AutoStartStep = 'fuel' | 'done' | 'abort';

/**
 * Sıranın kesilme nedeni. Bugün yalnız `noLightoff`; 1B ıslak/sıcak/asılı
 * çalıştırmayı ekler (birleşime yeni ad eklemek App'e dokunmaz).
 */
export type AutoStartReason = 'noLightoff' | 'wetStart' | 'hotStart' | 'hungStart' | 'retry';

/** Adımın oyuncuya gösterilecek bilgisi (App olay iletisi ve bildirimi) */
export interface AutoStartInfo {
  /** Türkçe ileti (bildirim ve olay günlüğü) */
  message: string;
  /** Varsayılan 'info' (sıcak çalıştırma kesmesi 'warning' olabilir) */
  severity?: Severity;
  /** Yalnız `abort`: neden */
  reason?: AutoStartReason;
}

/** Bugünkü adım iletileri (Dalga 0'a kadar App'teydi) */
export const AUTOSTART_MESSAGES = {
  fuel: 'Otomatik çalıştırma: yakıt verildi.',
  done: 'Otomatik çalıştırma bitti: APU BLEED ve ateşleme kapandı.',
  noLightoff: 'Otomatik çalıştırma bırakıldı: motor yanmadı.',
} as const;

export class AutoStart {
  /** Sıra sürüyor mu (kayıt betikleri `app.autoStart = false` ile keser) */
  active = false;

  /**
   * Sırayı başlatır. Motor zaten yanıyorsa hiçbir şey yapmaz ve false döner
   * (önce `sim.reset()`).
   */
  begin(sim: EngineSim): boolean {
    if (sim.lit) return false;
    Object.assign(sim.controls, {
      apuBleed: true,
      ignition: true,
      starter: true,
      fuelRun: false,
      fadec: 'normal',
      throttle: 0,
    });
    this.active = true;
    return true;
  }

  /** Simülasyon adımından sonra çağrılır */
  update(sim: EngineSim, onStep?: (s: AutoStartStep, info: AutoStartInfo) => void) {
    if (!this.active) return;
    const c = sim.controls;
    const L = sim.limits;
    if (!c.fuelRun && sim.N2 >= L.fuelOnMinN2 + 0.02) {
      c.fuelRun = true;
      onStep?.('fuel', { message: AUTOSTART_MESSAGES.fuel });
    }
    if (sim.phase === 'running' && sim.N2 > L.idleN2 - 0.02) {
      c.apuBleed = false;
      c.ignition = false;
      this.active = false;
      onStep?.('done', { message: AUTOSTART_MESSAGES.done });
    }
    if (!c.starter && !sim.lit && sim.N2 < 0.3) {
      const was = this.active;
      this.active = false;
      if (was) onStep?.('abort', { message: AUTOSTART_MESSAGES.noLightoff, reason: 'noLightoff' });
    }
  }
}
