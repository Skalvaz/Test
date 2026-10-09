/**
 * M5a P7: taklit özet turboşaftta gerçek özetle aynı çıkış gücünü verir
 * (katman kuralı §2.1: workshop testi design/ altında değil burada).
 */

import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../design/catalog';
import { buildEngine } from '../design/graph';
import { summarize } from '../design/summary';
import { fakeArchitectureOf, fakeSummarize } from './testing';

describe('turboşaft taklit özet', () => {
  it('çıkış gücü ref.outputPower (özetle aynı); mimari mil çıkışlı', () => {
    const b = buildEngine(TEMPLATES.turboshaft!);
    expect(fakeSummarize(b).shaftPower).toBe(b.sized.ref.outputPower);
    expect(fakeSummarize(b).shaftPower).toBe(summarize(b).shaftPower);
    expect(fakeArchitectureOf(TEMPLATES.turboshaft!)).toMatchObject({ output: 'shaft', lpLoad: 'shaft', centrifugal: true });
  });
});
