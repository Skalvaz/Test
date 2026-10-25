/**
 * Tuval ve SVG çizimlerinin renk ve yazı tipi paleti (K-01, K-03; sahibi
 * 1C). Tuval CSS değişkeni okuyamaz: renkler burada, CSS'teki belirteçlerle
 * (src/styles/tokens.css) aynı değerde tutulur. EICAS, çevrim diyagramı,
 * ölçek figürü ve kütle şeridi renklerini ve yazı tiplerini yalnız buradan
 * okur (palette.test.ts: bu dosyalarda sabit renk kodu ve yazı tipi adı
 * yoktur). Dalga 0'da taşındı; değerler bugünkü görüntünün aynısıdır.
 */

/** Ana renkler (tokens.css ile aynı) */
export const COLOR = {
  ink: '#e8eef4',
  muted: '#7b8a99',
  accent: '#2ee6d6',
  amber: '#ffb020',
  red: '#ff4d3d',
  green: '#3ddc84',
  magenta: '#ff5cf0',
  /** Yanma (T–s diyagramında 3 → 4) */
  burn: '#ff7a2a',
} as const;

/** Tuval yazı tipleri (1C K-01: üç gömülü aile gelince buradan değişir) */
export const FONT = {
  /** Gösterge ve diyagram yazıları */
  mono: 'ui-monospace, monospace',
  /** Büyük sayısal okumalar (EICAS kutuları, CAS) */
  monoDigits: "ui-monospace, 'SF Mono', Consolas, monospace",
  /** 3B etiketler (ölçek figürü) */
  ui: 'Inter, "Segoe UI", Arial, sans-serif',
} as const;

/** EICAS göstergeleri (aviyonik renk kodları) */
export const EICAS = {
  white: '#eef2f6',
  dim: 'rgba(238,242,246,0.28)',
  fill: 'rgba(238,242,246,0.13)',
  amber: COLOR.amber,
  red: COLOR.red,
  magenta: COLOR.magenta,
  cyan: COLOR.accent,
  green: COLOR.green,
  label: '#8a99a8',
  /** Kadran dolgusu: limit aşımı / dikkat */
  arcOver: 'rgba(255,77,61,0.22)',
  arcCaution: 'rgba(255,176,32,0.18)',
  /** Sayı kutusu: limit aşımı / olağan */
  boxOver: 'rgba(255,77,61,0.18)',
  box: 'rgba(0,0,0,0.35)',
  /** Ayırıcı çizgiler */
  rule: 'rgba(160,185,210,0.14)',
  /** CAS uyarı satırı zemini */
  warningRow: 'rgba(255,77,61,0.18)',
} as const;

/** Çevrim diyagramı (istasyon şeması ve T–s) */
export const DIAGRAM = {
  axisDash: 'rgba(200,220,240,0.35)',
  regionStroke: 'rgba(10,14,20,0.9)',
  regionHover: COLOR.accent,
  markerFill: '#0b1017',
  markerStroke: 'rgba(230,240,250,0.7)',
  markerText: COLOR.ink,
  axis: 'rgba(160,185,210,0.25)',
  grid: 'rgba(160,185,210,0.07)',
  label: COLOR.muted,
  isobarP0: 'rgba(120,170,230,0.45)',
  isobarP3: 'rgba(255,176,32,0.45)',
  bypass: 'rgba(80,170,255,0.8)',
  compression: COLOR.accent,
  combustion: COLOR.burn,
  expansion: COLOR.amber,
  pointLabel: COLOR.ink,
} as const;

/**
 * Sıcaklık rampası [K, RGB]: soğuk mavi → camgöbeği → sarı → turuncu →
 * kırmızı (istasyon renkleri; rampa istisnası, plan bölüm 2).
 */
export const TEMP_RAMP: readonly (readonly [number, readonly [number, number, number]])[] = [
  [250, [40, 90, 190]],
  [330, [40, 170, 200]],
  [500, [110, 200, 150]],
  [750, [235, 205, 70]],
  [1100, [245, 130, 40]],
  [1500, [235, 60, 40]],
  [1900, [255, 220, 200]],
];

/** RGB üçlüsünden CSS renk metni (`rgb(r,g,b)`) */
export const rgbText = (c: readonly number[]): string => `rgb(${c.join(',')})`;

/** Ölçek figürü (3B etiket ve siluet) */
export const FIGURE = {
  labelStroke: 'rgba(6, 9, 13, 0.85)',
  /** CSS değişkeni okunamazsa yedekler */
  muted: COLOR.muted,
  ink: COLOR.ink,
} as const;

/** Kütle şeridi kalemleri (ResultsPanel; K-03 "anlam renkleri" 1C'de) */
export const MASS_COLORS: readonly string[] = ['#2ee6d6', '#3d9bff', '#8b7bff', '#ff5cf0', '#ff7a45', '#ffb020', '#d9e36b', '#3ddc84', '#7b8a99', '#c47bff', '#4fd1ff', '#ff4d3d'];
