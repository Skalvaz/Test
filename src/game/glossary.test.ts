/**
 * Sözlük ve ders bağlantılarının tutarlılığı (M5a P3, §6.8). Uyarı kuralları
 * ve hata çevirisi design/'da; katman kuralı gereği (design/ game/'i içe
 * aktarmaz) bu test game/ tarafında durur.
 */

import { describe, expect, it } from 'vitest';
import { FlowpathError } from '../design/flowpath';
import { OPERABILITY_RULES, translateError, WARNING_RULES } from '../design/warnings';
import { DesignError } from '../sim/design';
import { GLOSSARY } from './glossary';
import { LESSONS } from './lessons/index';

describe('sözlük tutarlılığı', () => {
  const glossary = new Set(GLOSSARY.map((e) => e.id));
  const lessons = new Set(LESSONS.map((l) => l.id));

  it('kimlikler tekil', () => {
    expect(glossary.size).toBe(GLOSSARY.length);
  });

  it('§6.8 yeni girdiler var', () => {
    for (const id of ['tipMach', 'an2', 'tit', 'egtMargin', 'stageLoading', 'refVelocity', 'mixer', 'chevron', 'thrustWeight', 'specificThrust', 'shaftPower', 'turboshaft']) {
      expect(glossary.has(id), id).toBe(true);
    }
  });

  it('her kuralın sözlük ve ders kimliği var', () => {
    for (const r of [...WARNING_RULES, ...OPERABILITY_RULES]) {
      if (r.glossary) expect(glossary.has(r.glossary), `${r.id} → ${r.glossary}`).toBe(true);
      if (r.lesson) expect(lessons.has(r.lesson), `${r.id} → ${r.lesson}`).toBe(true);
    }
  });

  it('AN² birim çevirisi tutarlı: in² aralığı m² aralığının 1550 katı', () => {
    // Eskiden 6,5–7,7·10¹⁰ yazıyordu: alt uç 4,2·10⁷'nin (caution) karşılığı, metindeki 4'ün değil
    const body = GLOSSARY.find((e) => e.id === 'an2')!.body;
    const m = /~([\d,]+)–([\d,]+)·10⁷ m²·rpm² \(([\d,]+)–([\d,]+)·10¹⁰ in²·rpm²\)/.exec(body);
    expect(m, body).not.toBeNull();
    const [lo, hi, loIn, hiIn] = m!.slice(1).map((s) => Number(s.replace(',', '.')));
    const IN2_PER_M2 = 1 / 0.0254 ** 2;
    const toIn = (v: number) => Math.round((v * 1e7 * IN2_PER_M2) / 1e9) / 10; // ·10¹⁰, bir ondalık
    expect(loIn).toBe(toIn(lo));
    expect(hiIn).toBe(toIn(hi));
  });

  it('hata çevirisinin sözlük kimlikleri var', () => {
    const errs = [
      new DesignError('P5 ≤ P0'),
      new DesignError('LP türbini fanı çeviremiyor.'),
      new DesignError('HP türbini gereken işi çıkaramıyor.'),
      new DesignError('Güç türbinine genişleyecek basınç kalmıyor.'),
      new DesignError('T4, kompresör çıkış sıcaklığından düşük'),
      new FlowpathError('x', 'annulus.closed', 'hpc'),
      new FlowpathError('x', 'combustor.cansFit', 'combustor', [], { cans: 9 }),
      new FlowpathError('x', 'knob.range', 'hpc', ['hpc.mach.0']),
    ];
    for (const e of errs) {
      const t = translateError(e);
      if (t.glossary) expect(glossary.has(t.glossary), t.glossary).toBe(true);
    }
  });
});
