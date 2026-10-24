/**
 * Otomatik çalıştırma sırası (Dalga 0'da App'ten ayrıldı; sahibi 1B):
 * APU BLEED + ateşleme + marş açılır, N2 yakıt eşiğinin 2 puan üstünde
 * yakıt verilir, motor rölantiye oturunca BLEED ve ateşleme kapanır. Marş
 * kapanıp motor yanmadan N2 düşerse sıra bırakılır.
 *
 * 1B (F-05/F-06…) ıslak/sıcak çalıştırmada kesme mantığını buraya ekler.
 * Her adım `onStep` ile bildirilir; App bunu oyun olayına çevirir
 * (`autoStartFuel`, `autoStartDone`, `autoStartAbort`; src/app/events.ts).
 */

import type { EngineSim } from './engineSim';

export type AutoStartStep = 'fuel' | 'done' | 'abort';

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
  update(sim: EngineSim, onStep?: (s: AutoStartStep) => void) {
    if (!this.active) return;
    const c = sim.controls;
    const L = sim.limits;
    if (!c.fuelRun && sim.N2 >= L.fuelOnMinN2 + 0.02) {
      c.fuelRun = true;
      onStep?.('fuel');
    }
    if (sim.phase === 'running' && sim.N2 > L.idleN2 - 0.02) {
      c.apuBleed = false;
      c.ignition = false;
      this.active = false;
      onStep?.('done');
    }
    if (!c.starter && !sim.lit && sim.N2 < 0.3) {
      const was = this.active;
      this.active = false;
      if (was) onStep?.('abort');
    }
  }
}
