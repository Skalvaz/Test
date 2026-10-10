/**
 * M5a P7: turboşaftın çevrim diyagramı SFC satırı (katman kuralı §2.1:
 * ui testi design/ altında değil burada).
 */

import { describe, expect, it } from 'vitest';
import { builtFor } from '../design/catalog';
import { EngineSim } from '../sim/engineSim';
import { cycleRows } from './CycleDiagram';

describe('turboşaft çevrim diyagramı', () => {
  it('SFC satırı g/(kW·h), T700 bandında', () => {
    const sim = new EngineSim(builtFor('turboshaft')!.design);
    sim.trim(0, 30);
    sim.trim(1, 30);
    const s = sim.snapshot();
    const rows = Object.fromEntries(cycleRows(s, { output: 'shaft', afterburner: false, exhaust: 'single' }, false));
    expect(rows['Özgül yakıt tüketimi']).toMatch(/g\/kW·h$/);
    expect(Number.parseFloat(rows['Özgül yakıt tüketimi'])).toBeGreaterThan(250);
    expect(Number.parseFloat(rows['Özgül yakıt tüketimi'])).toBeLessThan(340);
  }, 120_000);
});
