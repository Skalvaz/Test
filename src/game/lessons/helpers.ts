/** Derslerde ortak motor hazırlıkları. */

import type { EngineSim } from '../../sim';

export const pct = (v: number) => `%${(v * 100).toFixed(0)}`;

/** Soğuk, durmuş motor; uçuş koşulları deniz seviyesi ISA. */
export function coldEngine(sim: EngineSim) {
  sim.setFlight({ altitude: 0, mach: 0, isaDev: 0 }, true);
  sim.reset();
}

/** Rölantide çalışan motor. */
export function idleEngine(sim: EngineSim) {
  sim.setFlight({ altitude: 0, mach: 0, isaDev: 0 }, true);
  sim.reset();
  sim.trim(0);
}

/** Verilen gaz kolunda dengelenmiş çalışan motor. */
export function runningAt(sim: EngineSim, throttle: number) {
  sim.setFlight({ altitude: 0, mach: 0, isaDev: 0 }, true);
  sim.reset();
  sim.trim(throttle, 50);
}
