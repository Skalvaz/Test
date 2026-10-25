/**
 * Kimlik çekirdeği sözleşmesi (K-01, K-03; 1C): tuval ve SVG çizen
 * dosyalar renk ve yazı tipini yalnız palette.ts'ten okur; bileşen
 * CSS'lerinde sabit renk kodu ve px köşe yarıçapı yoktur (hepsi
 * tokens.css'te). Böylece 1C kimliği yalnız tokens.css ve palette.ts'i
 * değiştirerek uygular.
 */
import { describe, expect, it } from 'vitest';
import eicas from './Eicas.ts?raw';
import cycle from './CycleDiagram.ts?raw';
import figure from '../app/workshop/ScaleFigure.ts?raw';
import results from '../app/workshop/ResultsPanel.ts?raw';
import { COLOR, MASS_COLORS, TEMP_RAMP } from './palette';

const css = import.meta.glob('../styles/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Yorumları at (açıklamalarda renk adı geçebilir) */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/;
const FONT_LITERAL = /ui-monospace|Segoe UI|Consolas|JetBrains|\bInter\b/;

describe('tuval paleti (palette.ts)', () => {
  const files = { 'Eicas.ts': eicas, 'CycleDiagram.ts': cycle, 'ScaleFigure.ts': figure, 'ResultsPanel.ts': results };
  for (const [name, src] of Object.entries(files)) {
    it(`${name}: sabit renk kodu ve yazı tipi adı yok`, () => {
      const lines = code(src)
        .split('\n')
        .filter((l) => COLOR_LITERAL.test(l) || FONT_LITERAL.test(l));
      expect(lines).toEqual([]);
    });
  }

  it('değerler CSS belirteçleriyle aynı', () => {
    const tokens = css['../styles/tokens.css'];
    for (const [name, v] of [['ink', COLOR.ink], ['muted', COLOR.muted], ['accent', COLOR.accent], ['amber', COLOR.amber], ['red', COLOR.red], ['green', COLOR.green], ['magenta', COLOR.magenta]]) {
      expect(tokens).toContain(`--${name}: ${v};`);
    }
    expect(MASS_COLORS).toHaveLength(12);
    expect(TEMP_RAMP.map(([t]) => t)).toEqual([250, 330, 500, 750, 1100, 1500, 1900]);
  });
});

describe('bileşen CSS belirteçleri (tokens.css)', () => {
  for (const [f, src] of Object.entries(css)) {
    if (f.endsWith('tokens.css') || f.endsWith('index.css')) continue;
    it(`${f.slice(10)}: sabit renk kodu, px köşe yarıçapı ve 1px çizgi yok`, () => {
      const lines = code(src)
        .split('\n')
        .filter((l) => COLOR_LITERAL.test(l) || /border-radius:[^;}]*\d+px/.test(l) || /border(-\w+)?:\s*1px/.test(l));
      expect(lines).toEqual([]);
    });
  }

  // Hareket dili (K-09): geçiş ve animasyon süreleri ile eğrileri tokens.css'te
  // (loader.css 1C'nin kendi dosyası, yükleme animasyonları orada kalır)
  for (const [f, src] of Object.entries(css)) {
    if (f.endsWith('tokens.css') || f.endsWith('index.css') || f.endsWith('loader.css')) continue;
    it(`${f.slice(10)}: geçiş ve animasyonda sabit süre ya da eğri yok`, () => {
      const lines = code(src)
        .split('\n')
        .filter((l) => /(transition|animation)(-duration|-timing-function)?\s*:/.test(l))
        .filter((l) => /\d(\.\d+)?m?s\b|\b(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier)\b/.test(l.replace(/var\(--[\w-]+\)/g, '')));
      expect(lines).toEqual([]);
    });
  }
});
