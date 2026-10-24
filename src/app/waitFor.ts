/**
 * Olay bekleme yardımcıları (Dalga 0, T-20): testler, kayıt sahneleri ve
 * oynanış testi sabit süre ("light-off ~25,1 s") yerine olay ya da koşul
 * bekler; 1B/2H kalibrasyonu zamanlamaları değiştirince sessizce kırılmaz.
 *
 *   app.advanceUntil('lightoff', 40)          // tarayıcıda (App test kancası)
 *   app.advanceUntil(() => app.sim.N1 > 0.95)
 *   waitForSim(sim, 'idle', { maxSeconds: 90 }) // vitest, yalnız EngineSim
 *
 * Adım adım ilerletir, her adımdan sonra sınar; olay geldiği adımın sonunda
 * durur. Süre dolarsa `ok: false` döner (atmaz): çağıran kendi mesajını yazar.
 */

import type { EngineSim, SimEvent, SimEventType } from '../sim';
import type { GameEvent, GameEventType } from './events';

export type WaitTarget<T extends string = GameEventType> = T | (() => boolean);

export interface WaitResult<E = GameEvent> {
  ok: boolean;
  /** Geçen simülasyon süresi [s] */
  seconds: number;
  /** Beklenen olay (koşul hedefinde null) */
  event: E | null;
}

export interface AdvanceUntilOptions<E extends { type: string }> {
  /** Bir adım ilerlet */
  step: (dt: number) => void;
  /** Olay akışına abone ol; dönen işlev aboneliği kaldırır */
  subscribe: (fn: (e: E) => void) => () => void;
  target: WaitTarget<E['type']>;
  maxSeconds?: number;
  dt?: number;
}

export function advanceUntil<E extends { type: string } = GameEvent>(o: AdvanceUntilOptions<E>): WaitResult<E> {
  const dt = o.dt ?? 1 / 30;
  const max = o.maxSeconds ?? 120;
  const pred = typeof o.target === 'function' ? o.target : null;
  let hit: E | null = null;
  const off = pred ? () => {} : o.subscribe((e) => {
    if (!hit && e.type === o.target) hit = e;
  });
  try {
    if (pred?.()) return { ok: true, seconds: 0, event: null };
    let t = 0;
    while (t < max - 1e-9) {
      o.step(dt);
      t += dt;
      if (hit || pred?.()) return { ok: true, seconds: t, event: hit };
    }
    return { ok: false, seconds: t, event: null };
  } finally {
    off();
  }
}

/**
 * Yalnız EngineSim ile (DOM'suz testler): olay ya da koşul gelene kadar
 * `sim.step`. `before` her adımdan önce (ör. otomatik çalıştırma), `after`
 * her adımdan sonra çağrılır.
 */
export function waitForSim(
  sim: EngineSim,
  target: SimEventType | ((sim: EngineSim) => boolean),
  opts: { maxSeconds?: number; dt?: number; after?: (sim: EngineSim, dt: number) => void } = {},
): WaitResult<SimEvent> {
  return advanceUntil<SimEvent>({
    step: (dt) => {
      sim.step(dt);
      opts.after?.(sim, dt);
    },
    subscribe: (fn) => sim.on(fn),
    target: typeof target === 'function' ? () => target(sim) : target,
    maxSeconds: opts.maxSeconds,
    dt: opts.dt ?? 1 / 60,
  });
}

