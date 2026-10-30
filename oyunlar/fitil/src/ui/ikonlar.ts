/**
 * Satır içi SVG ikonlar (emoji yok). İki aile:
 *  - Çizgi ikonlar (24×24, `currentColor`, pirinç rengi CSS'ten): düğmeler.
 *  - Resimli ikonlar: kapsüller (§2.3 siluetleri, §13.2 cam dolgu), hedefler,
 *    ödüller, rozetler, yıldızlar ve Kıvılcım Usta.
 * Ortak gradyanlar belgeye bir kez eklenen gizli <svg><defs>'tedir
 * (`tanimlariKur`); palet değişince kapsül gradyanları güncellenir.
 */
import { svg, tekilKimlik } from './dom';
import { KAPSUL_RENKLERI } from '../app/katalog';
import { t as tt } from '../platform/dil';
import type { HedefVM, OdulVM, Palet, RozetId } from './tipler';
import type { Motif } from '../core/types';
import type { DesenId, FitilId, GuclendiriciId } from '../app/katalog';

// ───────────────────────── Çizgi ikonlar ─────────────────────────

function disli(): string {
  const n = 8;
  const pts: string[] = [];
  for (let i = 0; i < n * 4; i++) {
    const a = (i / (n * 4)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 4 === 1 || i % 4 === 2 ? 9.6 : 7.4;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<path d="M${pts.join('L')}Z"/><circle cx="12" cy="12" r="3.1"/>`;
}

const CIZGI = {
  duraklat: '<rect x="6.2" y="5" width="4" height="14" rx="1.6" fill="currentColor" stroke="none"/><rect x="13.8" y="5" width="4" height="14" rx="1.6" fill="currentColor" stroke="none"/>',
  oynat: '<path d="M8 5.2v13.6l11-6.8z" fill="currentColor"/>',
  kibrit: '<path d="M4.5 19.5 14.2 9.8"/><ellipse cx="15.8" cy="8.2" rx="2.7" ry="2" transform="rotate(-45 15.8 8.2)" fill="currentColor" stroke="none"/><path d="M18.6 2.6c.4 1.5 2 2.1 1.9 3.9a2.3 2.3 0 0 1-3.9 1.4"/>',
  kalip: '<path d="M12 2.8c2.3 1.7 3.3 4.2 3.3 7.1v5H8.7v-5c0-2.9 1-5.4 3.3-7.1z"/><circle cx="12" cy="9.3" r="1.5"/><path d="M8.7 12.2 6.2 14.8v2.7l2.5-1.2M15.3 12.2l2.5 2.6v2.7l-2.5-1.2M10.4 17.6 12 21.2l1.6-3.6"/>',
  geriSar: '<path d="M4.6 12.4a7.6 7.6 0 1 0 2.4-5.9"/><path d="M4.2 3.8v4.6h4.6"/><path d="M13.2 9.2v5.6M9.6 12h0" /><path d="M15.4 9.4l-3.6 2.6 3.6 2.6z" fill="currentColor" stroke-width="1.4"/>',
  koruk: '<path d="M4.2 8.3 13 6.1c3-.7 5.4 1.3 5.4 3.4v5c0 2.1-2.4 4.1-5.4 3.4l-8.8-2.2z"/><path d="M18.4 12h3.3M7.6 7.6v8.8M10.8 6.9v10.2"/><path d="M4.2 8.3 2 6.8M4.2 15.7 2 17.2"/>',
  yildiz: '<path d="M12 3.1l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  yildizDolu: '<path d="M12 3.1l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor"/>',
  alev: '<path d="M12 21.2c-3.9 0-6.6-2.7-6.6-6.3 0-3.9 3.3-5.7 3.9-10 2.4 1.4 3.5 3.5 3.6 5.4.9-.7 1.5-1.9 1.6-3.4 2.7 2 4.1 4.8 4.1 8 0 3.6-2.7 6.3-6.6 6.3z"/><path d="M12 21.2c-1.6 0-2.7-1.1-2.7-2.6 0-1.7 1.4-2.4 2.1-4 1.9 1.1 3.3 2.3 3.3 4 0 1.5-1.1 2.6-2.7 2.6z" fill="currentColor" stroke="none"/>',
  defter: '<path d="M12 6.4C10 4.9 7 4.5 3.4 4.9v13.3c3.6-.4 6.6 0 8.6 1.5 2-1.5 5-1.9 8.6-1.5V4.9C17 4.5 14 4.9 12 6.4z"/><path d="M12 6.4v13.3"/>',
  ayar: disli(),
  takvim: '<rect x="3.4" y="5" width="17.2" height="15.6" rx="2.6"/><path d="M3.4 10h17.2M8 3v4M16 3v4"/><rect x="7" y="13" width="3.2" height="3" rx=".6" fill="currentColor" stroke="none"/>',
  paylas: '<path d="M12 14.8V3.6M7.4 8 12 3.6 16.6 8"/><path d="M5 12.6v5.9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.9"/>',
  ses: '<path d="M3.8 9.4h3.6L12 5.4v13.2l-4.6-4H3.8z" fill="currentColor" stroke-width="1.6"/><path d="M15.4 9a4.2 4.2 0 0 1 0 6M18 6.4a7.8 7.8 0 0 1 0 11.2"/>',
  muzik: '<path d="M9 18V6.2l10.2-2.1v11.8"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="16.7" cy="15.9" r="2.6"/>',
  titresim: '<rect x="8" y="4" width="8" height="16" rx="2.2"/><path d="M4.6 9v6M19.4 9v6M2 10.6v2.8M22 10.6v2.8"/>',
  kilit: '<rect x="5" y="10.4" width="14" height="10.2" rx="2.6" fill="currentColor" fill-opacity=".18"/><path d="M8 10.4V8a4 4 0 0 1 8 0v2.4"/><path d="M12 14.4v2.4"/>',
  geri: '<path d="M15 4.8 7.8 12 15 19.2"/>',
  ileri: '<path d="M9 4.8 16.2 12 9 19.2"/>',
  kapat: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
  kopyala: '<rect x="8.5" y="8.5" width="11.6" height="11.6" rx="2.6"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  soru: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.9-2.6 2.2-2.6 4"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>',
  kupa: '<path d="M7.4 4h9.2v5.2a4.6 4.6 0 0 1-9.2 0z"/><path d="M7.4 6H4.6a3 3 0 0 0 3.2 4M16.6 6h2.8a3 3 0 0 1-3.2 4M12 13.8v3"/><path d="M8.6 20.4h6.8M9.6 16.8h4.8v3.6H9.6z"/>',
  sandik: '<rect x="3.4" y="9.6" width="17.2" height="10" rx="1.6"/><path d="M3.4 9.6c0-3 2-5 4-5h9.2c2 0 4 2 4 5M3.4 13h17.2"/><rect x="10.4" y="11.4" width="3.2" height="3.8" rx=".8" fill="currentColor" stroke="none"/>',
  tik: '<path d="M4.8 12.6l4.6 4.6L19.2 7.4"/>',
  harita: '<path d="M9 4.4 3.4 6.4v13.2L9 17.6l6 2 5.6-2V4.4l-5.6 2z"/><path d="M9 4.4v13.2M15 6.4v13.2"/>',
  tekrar: '<path d="M19.4 12.2A7.4 7.4 0 1 1 17.2 6.8"/><path d="M19.8 3.4v4.6h-4.6"/>',
  goz: '<path d="M2.4 12S6 5.4 12 5.4 21.6 12 21.6 12 18 18.6 12 18.6 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3.1"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  el: '<path d="M8 12.6V5.6a1.5 1.5 0 0 1 3 0V11M11 10.6V4.2a1.5 1.5 0 0 1 3 0v6.6M14 10.8V6.2a1.5 1.5 0 0 1 3 0v7.2c0 4.3-2.6 7.6-6.6 7.6-2.6 0-4.1-1.2-5.5-3.4l-2.5-3.9a1.5 1.5 0 0 1 2.5-1.7L8 14.4"/>',
  hareket: '<path d="M3 8.4c3-3 6 3 9 0s6 3 9 0M3 15.6c3-3 6 3 9 0s6 3 9 0"/>',
  hiz: '<path d="M4.6 6 10.6 12l-6 6M12.6 6l6 6-6 6"/>',
  dil: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.4 3.4 5.4 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.4-3.4-8.6s1-6.2 3.4-8.6z"/>',
  palet: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.4 0 1.9-1.2 1.2-2.3-.7-1.2-.1-2.8 1.5-2.8h2.2a3.7 3.7 0 0 0 3.7-3.7C20.6 7.2 16.8 3.4 12 3.4z"/><circle cx="7.6" cy="11.2" r="1.3" fill="currentColor" stroke="none"/><circle cx="10.4" cy="7.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.1" cy="7.8" r="1.3" fill="currentColor" stroke="none"/>',
  ipucu: '<path d="M9 17.4h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
  saat: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5l3.6 2.2"/>',
  anahtar: '<circle cx="7.8" cy="12" r="4"/><path d="M11.8 12h9.2M18.2 12v3.2M15.4 12v2.2"/>',
  uyari: '<path d="M12 3.8 2.6 19.8h18.8z"/><path d="M12 9.8v4.8"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>',
  bilgi: '<circle cx="12" cy="12" r="9"/><path d="M12 10.8v6"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/>',
  fener: '<path d="M9 4.6h6M12 2.6v2M8.4 5.2h7.2l1.2 3.2v8l-1.2 2.8H8.4l-1.2-2.8v-8z"/><path d="M7.2 8.4h9.6M7.2 16.4h9.6M12 8.4v8"/>',
  ortam: '<path d="M2.6 9.6c2.2-2.2 4.2 2.2 6.4 0s4.2 2.2 6.4 0 4.2 2.2 6.4 0M2.6 15c2.2-2.2 4.2 2.2 6.4 0s4.2 2.2 6.4 0 4.2 2.2 6.4 0"/>',
  toz: '<path d="M10 2.6c.7 4.4 2.2 5.9 6.6 6.6-4.4.7-5.9 2.2-6.6 6.6-.7-4.4-2.2-5.9-6.6-6.6 4.4-.7 5.9-2.2 6.6-6.6z" fill="currentColor" stroke-width="1.2"/><path d="M18 13.6c.4 2.4 1.2 3.2 3.6 3.6-2.4.4-3.2 1.2-3.6 3.6-.4-2.4-1.2-3.2-3.6-3.6 2.4-.4 3.2-1.2 3.6-3.6z" fill="currentColor" stroke-width="1"/>',
  arsiv: '<rect x="3.4" y="4" width="17.2" height="4.6" rx="1.2"/><path d="M5 8.6v9.8A1.6 1.6 0 0 0 6.6 20h10.8a1.6 1.6 0 0 0 1.6-1.6V8.6M10 12.4h4"/>',
  sil: '<path d="M4.4 7h15.2M9.4 7V4.4h5.2V7M6.4 7l1 13h9.2l1-13"/>',
  indir: '<path d="M12 3.8v11.4M7.4 10.6 12 15.2l4.6-4.6M5 20h14"/>',
  yukle: '<path d="M12 15.6V4.2M7.4 8.8 12 4.2l4.6 4.6M5 20h14"/>',
  istatistik: '<path d="M4.4 20V11M9.4 20V5M14.4 20v-6.4M19.4 20V8.4M2.6 20.2h18.8"/>',
  /** Oyun özeti: sade çizgi grafik (eksen + yükselen çizgi). */
  grafik: '<path d="M3.4 3.6v16.8h17.2"/><path d="M6.6 15.6l3.8-4.4 3.2 2.8 5.6-6.6"/><circle cx="10.4" cy="11.2" r="1.3" fill="currentColor" stroke="none"/><circle cx="13.6" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="19.2" cy="7.4" r="1.3" fill="currentColor" stroke="none"/>',
  rozet: '<circle cx="12" cy="9.4" r="5.8"/><path d="M8.6 14.2 7 21l5-2.6 5 2.6-1.6-6.8"/>',
  hamle: '<path d="M5 18.6c3.4-1.2 4.4-5.4 7-7.4s6-1 7.4-4.8"/><circle cx="5" cy="18.6" r="1.8" fill="currentColor"/><circle cx="19.4" cy="6.4" r="1.8" fill="currentColor"/>',
  roket: '<path d="M12 2.8c2.3 1.7 3.3 4.2 3.3 7.1v5H8.7v-5c0-2.9 1-5.4 3.3-7.1z"/><path d="M8.7 12.2 6.2 14.8v2.7l2.5-1.2M15.3 12.2l2.5 2.6v2.7l-2.5-1.2M10.4 17.6 12 21.2l1.6-3.6"/>',
  dalga: '<path d="M2.6 12c2.2-3 4.2 3 6.4 0s4.2 3 6.4 0 4.2 3 6.4 0"/>',
  kalp: '<path d="M12 20.2s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.6c0 5.6-7.6 10.2-7.6 10.2z"/>',
  zincir: '<path d="M9.6 14.4 14.4 9.6"/><path d="M11 6.6l1.4-1.4a4 4 0 0 1 5.6 5.6L16.6 12.2M13 17.4l-1.4 1.4a4 4 0 0 1-5.6-5.6l1.4-1.4"/>',
  halka: '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="4.4" r="2" fill="currentColor"/><circle cx="19.6" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19.6" r="2" fill="currentColor"/><circle cx="4.4" cy="12" r="2" fill="currentColor"/>',
  patlama: '<path d="M12 2.6v4.2M12 17.2v4.2M2.6 12h4.2M17.2 12h4.2M5.4 5.4l3 3M15.6 15.6l3 3M18.6 5.4l-3 3M8.4 15.6l-3 3"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
  kum: '<path d="M6.4 3.4h11.2M6.4 20.6h11.2M7.6 3.4c0 4.6 4.4 5.6 4.4 8.6s-4.4 4-4.4 8.6M16.4 3.4c0 4.6-4.4 5.6-4.4 8.6s4.4 4 4.4 8.6"/>',
  sapka: '<path d="M3.4 15.4c3.2-1.6 14-1.6 17.2 0M6.4 14.8 7.6 7.4c.3-1.8 8.5-1.8 8.8 0l1.2 7.4"/><path d="M3.4 15.4c0 1.8 17.2 1.8 17.2 0"/>',
  cerceve: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="1.4"/><rect x="6.8" y="6.8" width="10.4" height="10.4"/><path d="M8.6 15.2l2.4-3 1.8 2 1.6-1.6 1.6 2.6"/>',
  kafes: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.3 4v16M14.7 4v16M4 12h16"/>',
  deniz: '<path d="M12 2.6v2.4M9 6h6l-1 12h-4z"/><path d="M8.4 10h7.2M7.6 14h8.8M3 20.6c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"/>',
  /** (CAN-REKLAM §6) Can: kıvrılan fitil, ucunda dört köşeli kıvılcım. */
  fitil: '<path d="M4.4 20.2c-.6-3.6 1.6-5.2 4-5.6s4.4-1.8 4.4-4.4 1.6-3.8 3.6-4.2"/><path d="M18.4 2.4l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9z" fill="currentColor" stroke-width="1.2"/>',
  /** (CAN-REKLAM §3) Ödüllü reklam: ekran + oynat üçgeni. */
  reklam: '<rect x="2.8" y="4.2" width="18.4" height="13.4" rx="3"/><path d="M10.2 8.1v5.6l4.8-2.8z" fill="currentColor" stroke-width="1.4"/><path d="M8.4 20.6h7.2"/>',
  /** (CAN-REKLAM §4) Mağaza: alışveriş çantası. */
  canta: '<path d="M5 8.2h14l-1.1 12.2H6.1z"/><path d="M9 10.6V7a3 3 0 0 1 6 0v3.6"/>',
} as const;

export type IkonAdi = keyof typeof CIZGI;

/** Çizgi ikon (24×24, `currentColor`). */
export function ikon(ad: IkonAdi, sinif = ''): SVGSVGElement {
  return svg(
    `<svg class="f-ikon ${sinif}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${CIZGI[ad]}</svg>`,
  );
}

/** Çizgi ikonun iç işaretlemesi (rozet madalyonu gibi bileşik çizimler için). */
export function ikonIci(ad: IkonAdi): string {
  return CIZGI[ad];
}

// ─────────────────────── Ortak gradyanlar ───────────────────────

const TANIM_ID = 'ftl-tanimlar';

function karistir(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

/** Palete göre kapsül renkleri [açık, ana, koyu]. */
export function kapsulRenkleri(renk: number, palet: Palet): [string, string, string] {
  const k = KAPSUL_RENKLERI[renk] ?? KAPSUL_RENKLERI[0];
  if (palet === 'renkKoru') return [karistir(k.renkKoru, '#ffffff', 0.55), k.renkKoru, karistir(k.renkKoru, '#000000', 0.5)];
  return [k.acik, k.ana, k.koyu];
}

/** Belgeye ortak <defs>'i bir kez ekler; palet değişince kapsül gradyanlarını günceller. */
export function tanimlariKur(palet: Palet): void {
  if (typeof document === 'undefined') return;
  let kok: Element | null = document.getElementById(TANIM_ID);
  if (!kok) {
    const kapsuller = KAPSUL_RENKLERI.map(
      (_, i) =>
        `<radialGradient id="ftl-k${i}" cx=".36" cy=".3" r=".78"><stop offset="0" /><stop offset=".45" /><stop offset="1" /></radialGradient>`,
    ).join('');
    const e = svg(`<svg id="${TANIM_ID}" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>
      ${kapsuller}
      <radialGradient id="ftl-ic" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="ftl-pirinc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE3A0"/><stop offset=".35" stop-color="#F2C66D"/><stop offset=".7" stop-color="#D9A441"/><stop offset="1" stop-color="#9A5A22"/></linearGradient>
      <linearGradient id="ftl-pirinc-y" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE7AE"/><stop offset=".5" stop-color="#D9A441"/><stop offset="1" stop-color="#8A4E1C"/></linearGradient>
      <radialGradient id="ftl-koz" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF4C2" stop-opacity=".95"/><stop offset=".35" stop-color="#FFB020" stop-opacity=".6"/><stop offset="1" stop-color="#FF7A1A" stop-opacity="0"/></radialGradient>
      <radialGradient id="ftl-isik" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFC86B" stop-opacity=".9"/><stop offset="1" stop-color="#FFC86B" stop-opacity="0"/></radialGradient>
      <linearGradient id="ftl-altin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4C2"/><stop offset=".4" stop-color="#FFD15C"/><stop offset=".75" stop-color="#F29A1E"/><stop offset="1" stop-color="#B8642E"/></linearGradient>
      <linearGradient id="ftl-kaya" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#7A7482"/><stop offset=".5" stop-color="#5A5560"/><stop offset="1" stop-color="#2E2A33"/></linearGradient>
      <linearGradient id="ftl-kirmizi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A1C1C"/><stop offset=".45" stop-color="#FF4D4D"/><stop offset="1" stop-color="#8A1C1C"/></linearGradient>
      <linearGradient id="ftl-fener" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B8381C"/><stop offset=".5" stop-color="#FFB45A"/><stop offset="1" stop-color="#B8381C"/></linearGradient>
      <linearGradient id="ftl-ahsap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A4428"/><stop offset="1" stop-color="#3A2416"/></linearGradient>
      <radialGradient id="ftl-yuva" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#160E08"/><stop offset="1" stop-color="#2E1E12"/></radialGradient>
      <pattern id="ftl-ip" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(52)"><rect width="5" height="5" fill="#9A6A36"/><rect width="2.2" height="5" fill="#D9A86A"/></pattern>
      <pattern id="ftl-ip-sonuk" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(52)"><rect width="5" height="5" fill="#4E464C"/><rect width="2.2" height="5" fill="#77707A"/></pattern>
      <radialGradient id="ftl-mum" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#F0614A"/><stop offset=".45" stop-color="#C4261C"/><stop offset="1" stop-color="#6E0B0B"/></radialGradient>
      <linearGradient id="ftl-kil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8955A"/><stop offset=".55" stop-color="#B85A2A"/><stop offset="1" stop-color="#6A2E14"/></linearGradient>
    </defs></svg>`);
    document.body.appendChild(e);
    kok = e;
  }
  KAPSUL_RENKLERI.forEach((_, i) => {
    const g = kok!.querySelector(`#ftl-k${i}`);
    if (!g) return;
    const [a, n, k] = kapsulRenkleri(i, palet);
    const s = g.querySelectorAll('stop');
    s[0].setAttribute('stop-color', a);
    s[1].setAttribute('stop-color', n);
    s[2].setAttribute('stop-color', k);
  });
}

// ─────────────────────────── Kapsüller ───────────────────────────

const f = (n: number) => n.toFixed(2);

function cokgen(n: number, r: number, aci0: number, dy = 0): string {
  const p: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = aci0 + (i / n) * Math.PI * 2;
    p.push(`${f(r * Math.cos(a))} ${f(r * Math.sin(a) + dy)}`);
  }
  return `M${p.join('L')}Z`;
}

function yildizYolu(dis: number, ic: number, dy = 0, kose = 5): string {
  const p: string[] = [];
  for (let i = 0; i < kose * 2; i++) {
    const r = i % 2 === 0 ? dis : ic;
    const a = -Math.PI / 2 + (i / (kose * 2)) * Math.PI * 2;
    p.push(`${f(r * Math.cos(a))} ${f(r * Math.sin(a) + dy)}`);
  }
  return `M${p.join('L')}Z`;
}

/** §13.2 gövde siluetleri (merkez 0,0; r gövde yarıçapı). */
export function kapsulYolu(renk: number, r: number): string {
  switch (renk) {
    case 1:
      return yildizYolu(1.08 * r, 0.56 * r, 0.06 * r);
    case 2: {
      const dy = 0.14 * r;
      return `M0 ${f(-1.25 * r + dy)}Q${f(0.92 * r)} ${f(-0.42 * r + dy)} ${f(r)} ${f(dy)}A${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(dy)}Q${f(-0.92 * r)} ${f(-0.42 * r + dy)} 0 ${f(-1.25 * r + dy)}Z`;
    }
    case 3:
      return `M0 ${f(-1.05 * r)}L${f(0.85 * r)} 0L0 ${f(1.05 * r)}L${f(-0.85 * r)} 0Z`;
    case 4:
      return cokgen(6, 1.02 * r, 0);
    case 5:
      return cokgen(3, 1.15 * r, -Math.PI / 2, 0.16 * r);
    default:
      return `M${f(-r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  }
}

/** Kapsül çizimi (<g> işaretlemesi). renk −1 = yıldız topu (joker). */
export function kapsulIsaretleme(renk: number, r: number, palet: Palet, x = 0, y = 0): string {
  if (renk < 0) {
    return `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r)}" fill="#F4F0FF" stroke="#8C7CF0" stroke-width="${f(r * 0.12)}"/>
      <circle r="${f(r * 0.72)}" fill="none" stroke="url(#ftl-altin)" stroke-width="${f(r * 0.2)}" opacity=".7"/>
      <path d="${yildizYolu(r * 0.6, r * 0.18, 0, 6)}" fill="#fff"/></g>`;
  }
  const [, , koyu] = kapsulRenkleri(renk, palet);
  const yk = palet === 'yuksekKontrast';
  const sw = yk ? r * 0.26 : r * 0.12;
  const ic = yk ? `<path d="${kapsulYolu(renk, r * 0.34)}" fill="#fff"/>` : '';
  return `<g transform="translate(${f(x)} ${f(y)})"><path d="${kapsulYolu(renk, r)}" fill="url(#ftl-k${renk})" stroke="${yk ? '#000' : koyu}" stroke-width="${f(sw)}" stroke-linejoin="round"/>
    <ellipse cx="0" cy="${f(-0.05 * r)}" rx="${f(0.55 * r)}" ry="${f(0.5 * r)}" fill="url(#ftl-ic)"/>
    <ellipse cx="${f(-0.34 * r)}" cy="${f(-0.42 * r)}" rx="${f(0.42 * r)}" ry="${f(0.2 * r)}" fill="#fff" opacity=".6" transform="rotate(-30 ${f(-0.34 * r)} ${f(-0.42 * r)})"/>${ic}</g>`;
}

export function kapsulSvg(renk: number, palet: Palet, sinif = ''): SVGSVGElement {
  return svg(`<svg class="f-resim ${sinif}" viewBox="-24 -24 48 48" aria-hidden="true">${kapsulIsaretleme(renk, 15, palet)}</svg>`);
}

// ─────────────────────────── Hedef ikonları ───────────────────────────

const MOTIF_YOLLARI: Record<Motif, { yol: string; renk: string }> = {
  lale: { yol: 'M0 14V-1M0 6c-5-1-8-4-9-8M0 6c5-1 8-4 9-8M-7-13c0 7 3 11 7 11s7-4 7-11c-2.4 1.6-4.2 2.6-7 0-2.8 2.6-4.6 1.6-7 0z', renk: '#FF5FB4' },
  kayik: { yol: 'M-14 4h28l-5 7h-18zM0 4v-17l9 13H0M0-13l-7 9h7', renk: '#3AA8FF' },
  mart: { yol: 'M-15-1c4-5 9-5 15 2 6-7 11-7 15-2M-4 8c3 2 5 2 8 0', renk: '#FFF3D6' },
  fener: { yol: 'M-4 14h8M-3 14l-1-18h8l-1 18M-6-4h12M-4-4l4-8 4 8M0-12v-3M-9-9l-4-2M9-9l4-2', renk: '#FFB020' },
  carkifelek: { yol: 'M0 0c0-6 4-10 9-10-1 5-4 9-9 10zM0 0c6 0 10 4 10 9-5-1-9-4-10-9zM0 0c0 6-4 10-9 10 1-5 4-9 9-10zM0 0c-6 0-10-4-10-9 5 1 9 4 10 9z', renk: '#2EE07A' },
  burc: { yol: 'M-9 14v-18h18v18zM-9-4v-6h4v3h3v-3h4v3h3v-3h4v6M-3 14v-7a3 3 0 0 1 6 0v7', renk: '#D9A441' },
};

export function motifIsaretleme(m: Motif, olcek = 1, parlak = true): string {
  const { yol, renk } = MOTIF_YOLLARI[m];
  const s = `transform="scale(${olcek})"`;
  return `<g ${s} fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${parlak ? `<path d="${yol}" stroke="${renk}" stroke-width="5" opacity=".28"/>` : ''}
    <path d="${yol}" stroke="${parlak ? renk : '#6A5A70'}" stroke-width="2.2"/>
    ${parlak ? `<path d="${yol}" stroke="#fff" stroke-width=".8" opacity=".7"/>` : ''}</g>`;
}

function hedefIsaretleme(h: HedefVM, palet: Palet): string {
  switch (h.tur) {
    case 'topla':
      if (h.renk === 'hepsi' || h.renk === undefined)
        return kapsulIsaretleme(3, 8.5, palet, 0, -8) + kapsulIsaretleme(0, 8.5, palet, -9, 7) + kapsulIsaretleme(1, 8.5, palet, 9.5, 7);
      return kapsulIsaretleme(h.renk, 15, palet);
    case 'kafes':
      return `${kapsulIsaretleme(1, 12, palet)}
        <rect x="-16" y="-16" width="32" height="32" rx="6" fill="none" stroke="#3A1E08" stroke-width="5"/>
        <rect x="-16" y="-16" width="32" height="32" rx="6" fill="none" stroke="url(#ftl-pirinc)" stroke-width="3"/>
        <path d="M-6-16v32M6-16v32M-16 0h32" stroke="#3A1E08" stroke-width="4.4"/>
        <path d="M-6-16v32M6-16v32M-16 0h32" stroke="url(#ftl-pirinc)" stroke-width="2.6"/>
        <circle cx="-15" cy="-15" r="2.4" fill="#FFE3A0"/><circle cx="15" cy="-15" r="2.4" fill="#FFE3A0"/><circle cx="-15" cy="15" r="2.4" fill="#D9A441"/><circle cx="15" cy="15" r="2.4" fill="#D9A441"/>`;
    case 'kaya':
      return `<path d="M-15 6-12-8-3-15 9-13 16-3 13 11 1 16-11 13z" fill="url(#ftl-kaya)" stroke="#1E1A22" stroke-width="2" stroke-linejoin="round"/>
        <path d="M-12-8-3-15 9-13 4-6-6-4z" fill="#9A94A4" opacity=".55"/>
        <path d="M-2 -4 1 3-3 8M1 3l6 2" fill="none" stroke="#1E1A22" stroke-width="1.6" stroke-linecap="round"/>`;
    case 'fener':
      return `<circle r="22" fill="url(#ftl-koz)" opacity=".55"/>
        <path d="M0-21v4" stroke="#D9A441" stroke-width="2"/>
        <rect x="-6.5" y="-17.5" width="13" height="4.5" rx="1.5" fill="url(#ftl-pirinc)"/>
        <ellipse cx="0" cy="0" rx="12" ry="13.5" fill="url(#ftl-fener)" stroke="#7A2A10" stroke-width="1.4"/>
        <path d="M0-13.5v27M-6-12.4c-2.8 7-2.8 17.8 0 24.8M6-12.4c2.8 7 2.8 17.8 0 24.8" fill="none" stroke="#7A2A10" stroke-width="1.1" opacity=".7"/>
        <ellipse cx="-3.5" cy="-5" rx="3" ry="6" fill="#FFF4C2" opacity=".55"/>
        <rect x="-6.5" y="13" width="13" height="4.5" rx="1.5" fill="url(#ftl-pirinc)"/>
        <path d="M0 17.5v4" stroke="#D9A441" stroke-width="2" stroke-linecap="round"/>`;
    case 'aydinlat':
      // Yanan döşeme: sıcak turuncu zemin, açık merkez ışığı, parıltı; köşeler koyu kontürlü
      // (eski koyu kare + sönük ışık HUD'da seçilmiyordu, Ekim 2026).
      return `<rect x="-17" y="-17" width="34" height="34" rx="5" fill="#3A2410" stroke="#120A04" stroke-width="2"/>
        <rect x="-14" y="-14" width="28" height="28" rx="3" fill="#E8862E"/>
        <rect x="-14" y="-14" width="28" height="28" rx="3" fill="url(#ftl-isik)"/>
        <circle r="8" fill="#FFF1C4" opacity=".75"/>
        <path d="M0-10.5 2.4-2.4 10.5 0 2.4 2.4 0 10.5-2.4 2.4-10.5 0-2.4-2.4z" fill="#FFFBEA"/>
        <path d="M-17-9v-8h8M17-9v-8H9M-17 9v8h8M17 9v8H9" fill="none" stroke="#2A1206" stroke-width="5.4" stroke-linejoin="round"/>
        <path d="M-17-9v-8h8M17-9v-8H9M-17 9v8h8M17 9v8H9" fill="none" stroke="url(#ftl-pirinc)" stroke-width="3.2" stroke-linejoin="round"/>`;
    case 'desen':
      return `<rect x="-17" y="-17" width="34" height="34" rx="6" fill="#1A1028" stroke="#0A0612" stroke-width="2"/>
        ${motifIsaretleme(h.motif ?? 'lale', 0.95)}`;
    case 'devFisek':
      return `<circle cx="0" cy="-17" r="7" fill="url(#ftl-koz)"/>
        <path d="M0-10c0-4 3-5 2-8" fill="none" stroke="#6A4428" stroke-width="2" stroke-linecap="round"/>
        <path d="M-8-9 0-14l8 5z" fill="url(#ftl-altin)" stroke="#7A3E1C" stroke-width="1.2" stroke-linejoin="round"/>
        <rect x="-10" y="-9" width="20" height="26" rx="3.5" fill="url(#ftl-kirmizi)" stroke="#5A0E0E" stroke-width="1.4"/>
        <rect x="-10" y="-3" width="20" height="4" fill="url(#ftl-altin)"/><rect x="-10" y="8" width="20" height="4" fill="url(#ftl-altin)"/>
        <rect x="-6" y="-7" width="3" height="22" rx="1.5" fill="#fff" opacity=".28"/>`;
    case 'is':
      return `<g fill="#2A2630" stroke="#55505E" stroke-width="1.6"><circle cx="-8" cy="4" r="9"/><circle cx="8" cy="3" r="9.5"/><circle cx="0" cy="-5" r="11"/><circle cx="1" cy="8" r="8"/></g>
        <g fill="#2A2630"><circle cx="-8" cy="4" r="7.8"/><circle cx="8" cy="3" r="8.3"/><circle cx="0" cy="-5" r="9.8"/><circle cx="1" cy="8" r="6.8"/></g>
        <circle cx="-4" cy="-7" r="3" fill="#4A4452"/><circle cx="-6" cy="6" r="1.6" fill="#FF7A1A"/><circle cx="7" cy="5" r="1.2" fill="#FF9A3C"/>`;
    case 'zincirleme':
      return `<path d="${yildizYolu(19, 11, 0, 12)}" fill="url(#ftl-altin)" stroke="#8A4E1C" stroke-width="1.6" stroke-linejoin="round"/>
        <circle r="10.5" fill="#5A2410"/>
        <text x="0" y="4.6" text-anchor="middle" font-size="${(h.esik ?? 15) >= 100 ? 9 : 12.5}" font-weight="800" fill="#FFF4C2" font-family="inherit">${Number(h.esik ?? 15)}+</text>`;
    case 'halka':
      return `<circle r="13" fill="none" stroke="#FFB020" stroke-width="7" opacity=".3"/>
        <circle r="13" fill="none" stroke="url(#ftl-altin)" stroke-width="3.6"/>
        ${kapsulIsaretleme(1, 6, palet, 0, -13)}${kapsulIsaretleme(1, 6, palet, 13, 0)}${kapsulIsaretleme(1, 6, palet, 0, 13)}${kapsulIsaretleme(1, 6, palet, -13, 0)}`;
    case 'puan':
      return `<path d="${yildizYolu(18, 8.4, 1.5)}" fill="url(#ftl-altin)" stroke="#8A4E1C" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M-5-6 0-15 3-7z" fill="#fff" opacity=".55"/>`;
  }
}

export function hedefIkonu(h: HedefVM, palet: Palet, sinif = ''): SVGSVGElement {
  return svg(`<svg class="f-resim ${sinif}" viewBox="-24 -24 48 48" aria-hidden="true">${hedefIsaretleme(h, palet)}</svg>`);
}

// ─────────────────────────── Yıldızlar ───────────────────────────

/** Büyük derecelendirme yıldızı: dolu (altın) ya da boş yuva. */
export function yildizSvg(dolu: boolean, sinif = ''): SVGSVGElement {
  const yol = yildizYolu(21, 10.5, 1.6);
  return svg(`<svg class="f-yildiz ${dolu ? 'f-dolu' : ''} ${sinif}" viewBox="-24 -24 48 48" aria-hidden="true">
    <path d="${yol}" fill="#160C06" stroke="#0A0502" stroke-width="5" stroke-linejoin="round" transform="translate(0 1.5)"/>
    <path class="f-yildiz-yuva" d="${yol}" fill="#2A1A10" stroke="#5A3A20" stroke-width="2.4" stroke-linejoin="round"/>
    <g class="f-yildiz-altin"><path d="${yol}" fill="url(#ftl-altin)" stroke="#8A4E1C" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M-6.5-7.5 0-19 3.4-8.4z" fill="#FFFBEA" opacity=".75"/><path d="M-17-5.6-6.6-7.2-9.8-2z" fill="#FFF4C2" opacity=".4"/></g></svg>`);
}

/** Küçük yıldız (harita, listeler). */
export function kucukYildiz(dolu: boolean): SVGSVGElement {
  const yol = yildizYolu(11, 5.4, 0.8);
  return svg(`<svg class="f-kyildiz ${dolu ? 'f-dolu' : ''}" viewBox="-12 -12 24 24" aria-hidden="true">
    <path d="${yol}" fill="${dolu ? 'url(#ftl-altin)' : '#2A1A10'}" stroke="${dolu ? '#7A3E1C' : '#4A3220'}" stroke-width="1.8" stroke-linejoin="round"/></svg>`);
}

// ─────────────────────────── Ödüller ───────────────────────────

function madalyon(ic: string, renk = '#D9A441'): string {
  return `<circle r="22" fill="#2A1A10" stroke="url(#ftl-pirinc)" stroke-width="3"/><circle r="18" fill="none" stroke="${renk}" stroke-opacity=".25" stroke-width="1.2"/>${ic}`;
}

export function guclendiriciIsaretleme(id: GuclendiriciId): string {
  switch (id) {
    case 'kibrit':
      return `<circle cx="7" cy="-12" r="9" fill="url(#ftl-koz)"/>
        <path d="M-12 14 4-2" stroke="#E8C690" stroke-width="5" stroke-linecap="round"/><path d="M-12 14 4-2" stroke="#B88A50" stroke-width="1.6" stroke-linecap="round" transform="translate(1 1)" opacity=".6"/>
        <ellipse cx="6.2" cy="-4.2" rx="5.4" ry="4" transform="rotate(-45 6.2 -4.2)" fill="#D8322A" stroke="#6A0E0A" stroke-width="1.2"/>
        <path d="M8-8c-1-4 2-6 1-10 4 2 6 5 4 9-1 2-3 2-5 1z" fill="#FFB020" stroke="#FF7A1A" stroke-width="1"/>`;
    case 'kalip':
      return `<path d="M0-18c5 3.6 7 8.6 7 14.6V8H-7V-3.4C-7-9.4-5-14.4 0-18z" fill="url(#ftl-kirmizi)" stroke="#5A0E0E" stroke-width="1.4"/>
        <path d="M-7 1-12 7v6l5-2.6M7 1l5 6v6l-5-2.6" fill="url(#ftl-pirinc)" stroke="#7A3E1C" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="0" cy="-6" r="3.4" fill="#B5E0FF" stroke="url(#ftl-pirinc)" stroke-width="1.6"/>
        <path d="M-4 8 0 17 4 8z" fill="#FFB020"/><path d="M-2 8 0 13 2 8z" fill="#FFF4C2"/>`;
    case 'geriSar':
      return `<path d="M-11 2a11 11 0 1 0 3.4-8.6" fill="none" stroke="#3AA8FF" stroke-width="7" stroke-linecap="round" opacity=".25"/>
        <path d="M-11 2a11 11 0 1 0 3.4-8.6" fill="none" stroke="#B5E0FF" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M-12.6-12.6v8.2h8.2z" fill="#B5E0FF" stroke="#B5E0FF" stroke-width="2" stroke-linejoin="round"/>
        <path d="M4-5v10L-3 0z" fill="url(#ftl-pirinc)"/>`;
  }
}

function ipSarmal(): string {
  let d = 'M0 0';
  for (let i = 1; i <= 40; i++) {
    const a = i * 0.42;
    const r = 2 + i * 0.36;
    d += `L${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;
  }
  return `<path d="${d}" fill="none" stroke="#3A2416" stroke-width="6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#ftl-ip)" stroke-width="4" stroke-linecap="round"/>`;
}

function tozIsaretleme(): string {
  const p = (x: number, y: number, r: number, c: string) =>
    `<path d="M${x} ${y - r}C${x + r * 0.16} ${y - r * 0.16} ${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y}C${x + r * 0.16} ${y + r * 0.16} ${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r}C${x - r * 0.16} ${y + r * 0.16} ${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y}C${x - r * 0.16} ${y - r * 0.16} ${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}z" fill="${c}"/>`;
  return `<circle r="16" fill="#B266FF" opacity=".18"/>${p(-3, -3, 13, '#E3C7FF')}${p(9, 8, 7, '#FFE08A')}${p(-10, 10, 5, '#FFF3D6')}`;
}

export function odulIkonu(o: OdulVM): SVGSVGElement {
  let ic = '';
  switch (o.tur) {
    case 'guclendirici':
      ic = madalyon(guclendiriciIsaretleme(o.id));
      break;
    case 'desenParcasi':
      ic = madalyon(`<g transform="scale(.48)">${desenIsaretleme(o.id, '#FFB020', '#FF5FB4')}</g>`, '#FF5FB4');
      break;
    case 'fitilParcasi':
      ic = madalyon(ipSarmal());
      break;
    case 'toz':
      ic = madalyon(tozIsaretleme(), '#B266FF');
      break;
    case 'sandik':
      ic = madalyon(`<g transform="scale(.55) translate(0 4)">${sandikIsaretleme('normal', false)}</g>`);
      break;
  }
  return svg(`<svg class="f-resim" viewBox="-24 -24 48 48" aria-hidden="true">${ic}</svg>`);
}

// ─────────────────────────── Sandık ───────────────────────────

/** Sandık (merkez 0,0, yaklaşık 64 genişlik). acik: kapak kalkık. */
export function sandikIsaretleme(tur: 'normal' | 'parlak', acik: boolean): string {
  const govde = tur === 'parlak' ? 'url(#ftl-altin)' : 'url(#ftl-ahsap)';
  const serit = tur === 'parlak' ? '#FFF4C2' : 'url(#ftl-pirinc)';
  const kapak = acik
    ? `<g class="f-sandik-kapak" transform="translate(0 -6) rotate(-16 -30 -8)">
        <path d="M-30 0v-10c0-9 8-14 30-14s30 5 30 14V0z" fill="${govde}" stroke="#2A1408" stroke-width="2"/>
        <path d="M-10-24v24M10-24v24" stroke="${serit}" stroke-width="5"/></g>`
    : `<g class="f-sandik-kapak"><path d="M-30-8v-10c0-9 8-14 30-14s30 5 30 14v10z" fill="${govde}" stroke="#2A1408" stroke-width="2"/>
        <path d="M-10-32v24M10-32v24" stroke="${serit}" stroke-width="5"/><path d="M-27-20c6-6 48-6 54 0" stroke="#fff" stroke-opacity=".18" stroke-width="2" fill="none"/></g>`;
  const isik = acik ? `<ellipse cx="0" cy="-8" rx="26" ry="7" fill="#FFF4C2"/><ellipse cx="0" cy="-8" rx="36" ry="14" fill="url(#ftl-koz)"/>` : '';
  return `<ellipse cx="0" cy="22" rx="34" ry="6" fill="#000" opacity=".35"/>
    <rect x="-30" y="-8" width="60" height="30" rx="4" fill="${govde}" stroke="#2A1408" stroke-width="2"/>
    <path d="M-30 0h60" stroke="#2A1408" stroke-width="1.4" opacity=".6"/>
    <path d="M-10-8v30M10-8v30" stroke="${serit}" stroke-width="5"/>
    ${isik}${kapak}
    <rect x="-6" y="${acik ? -6 : -12}" width="12" height="13" rx="2.5" fill="url(#ftl-pirinc)" stroke="#5A2A10" stroke-width="1.4"/>
    <circle cx="0" cy="${acik ? 0 : -6}" r="2" fill="#2A1408"/>`;
}

export function sandikSvg(tur: 'normal' | 'parlak', acik: boolean): SVGSVGElement {
  return svg(`<svg class="f-sandik-svg" viewBox="-40 -48 80 76" aria-hidden="true">${sandikIsaretleme(tur, acik)}</svg>`);
}

// ─────────────────────────── Desenler ───────────────────────────

/**
 * Havai fişek deseni küçük çizimi (§10.3 yayılma türleri). Merkez 0,0,
 * yarıçap ~36. Belirlenimli (rastgelelik yok).
 */
export function desenIsaretleme(id: DesenId, r1: string, r2: string): string {
  const nok: string[] = [];
  const cizgi: string[] = [];
  const nokta = (x: number, y: number, r = 2.2, c = r1) => nok.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}"/>`);
  const isin = (x1: number, y1: number, x2: number, y2: number, c = r1, w = 1.4) =>
    cizgi.push(`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity=".55"/>`);
  const egriC = (d: string, c = r1, w = 1.6) => cizgi.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity=".6"/>`);
  const kure = (n: number, r: number, ic: number, c = r1, cap = 2.2) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      isin(Math.cos(a) * ic, Math.sin(a) * ic, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, c);
      nokta(Math.cos(a) * r, Math.sin(a) * r, cap, c);
    }
  };
  const egriNoktalar = (n: number, fn: (t: number) => [number, number], c = r1, cap = 2) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = fn((i / n) * Math.PI * 2);
      nokta(x, y, cap, c);
    }
  };
  switch (id) {
    case 'kasimpati':
      kure(20, 32, 4);
      kure(10, 16, 2, r2, 1.6);
      break;
    case 'palmiye':
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + ((i - 3) / 7) * Math.PI * 1.7;
        const x = Math.cos(a) * 30;
        const y = Math.sin(a) * 26;
        egriC(`M0 0Q${f(x * 0.7)} ${f(y * 0.9 - 6)} ${f(x)} ${f(y + 10)}`, r1, 3.2);
        nokta(x, y + 10, 2.6);
      }
      break;
    case 'sogut':
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const x = Math.cos(a) * 22;
        const y = Math.sin(a) * 16 - 6;
        egriC(`M0 -4Q${f(x)} ${f(y - 4)} ${f(x * 1.2)} ${f(y + 20)}`, r1, 1.2);
      }
      break;
    case 'halka':
      egriNoktalar(28, (t) => [Math.cos(t) * 30, Math.sin(t) * 30], r1, 2.4);
      break;
    case 'ciftHalka':
      egriNoktalar(26, (t) => [Math.cos(t) * 32, Math.sin(t) * 32], r1, 2.2);
      egriNoktalar(16, (t) => [Math.cos(t) * 18, Math.sin(t) * 18], r2, 2);
      break;
    case 'kalp':
      egriNoktalar(30, (t) => [16 * Math.pow(Math.sin(t), 3) * 1.9, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 1.9 - 3], r2, 2.3);
      break;
    case 'spiral':
      for (let k = 0; k < 2; k++)
        for (let i = 0; i < 18; i++) {
          const t = i / 18;
          const a = t * Math.PI * 2.4 + k * Math.PI;
          nokta(Math.cos(a) * (4 + t * 30), Math.sin(a) * (4 + t * 30), 1.2 + t * 1.6, k ? r2 : r1);
        }
      break;
    case 'yildiz': {
      const p: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 13 : 32;
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        p.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      for (let i = 0; i < 10; i++) {
        const [ax, ay] = p[i];
        const [bx, by] = p[(i + 1) % 10];
        for (let j = 0; j < 3; j++) nokta(ax + ((bx - ax) * j) / 3, ay + ((by - ay) * j) / 3, 2.1);
      }
      break;
    }
    case 'selale':
      for (let i = 0; i < 11; i++) {
        const x = -30 + i * 6;
        const y = -18 + Math.abs(x) * 0.25;
        isin(0, -10, x, y, r1, 1.2);
        egriC(`M${f(x)} ${f(y)}Q${f(x * 1.05)} ${f(y + 18)} ${f(x * 1.1)} ${f(y + 42)}`, r2, 1.1);
      }
      break;
    case 'marti':
      egriNoktalar(26, (t) => {
        const u = t / Math.PI - 1;
        return [u * 32, -Math.abs(Math.sin(u * Math.PI * 1)) * 14 + Math.abs(u) * 4];
      }, r1, 2.2);
      break;
    case 'lale':
      egriNoktalar(30, (t) => {
        const x = Math.sin(t) * 20;
        const y = -Math.cos(t) * 18 - (Math.abs(Math.sin(t * 1.5)) < 0.3 ? 8 : 0);
        return [x, y - 4];
      }, r2, 2.2);
      for (let i = 0; i < 6; i++) nokta(0, 12 + i * 4, 1.6, '#2EE07A');
      break;
    case 'karanfil':
      for (let i = 0; i < 40; i++) {
        const a = i * 2.4;
        const r = 14 + ((i * 7) % 13) * 1.4;
        isin(0, 0, Math.cos(a) * r, Math.sin(a) * r, i % 2 ? r1 : r2, 0.9);
        nokta(Math.cos(a) * r, Math.sin(a) * r, 1.4, i % 2 ? r1 : r2);
      }
      break;
    case 'papatya':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        egriC(`M${f(Math.cos(a) * 8)} ${f(Math.sin(a) * 8)}L${f(Math.cos(a) * 30)} ${f(Math.sin(a) * 30)}`, '#FFF3D6', 3.4);
      }
      egriNoktalar(10, (t) => [Math.cos(t) * 5, Math.sin(t) * 5], r1, 2.4);
      break;
    case 'kuyrukluYildiz':
      egriC('M-30 26Q-6 12 14-12', r2, 5);
      egriC('M-30 26Q-6 12 14-12', '#FFF3D6', 1.6);
      nokta(15, -13, 6, '#FFF4C2');
      nokta(15, -13, 9, r1);
      break;
    case 'carkifelek':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = a + 0.9;
        egriC(`M0 0Q${f(Math.cos(a) * 26)} ${f(Math.sin(a) * 26)} ${f(Math.cos(b) * 30)} ${f(Math.sin(b) * 30)}`, i % 2 ? r1 : r2, 2.6);
        nokta(Math.cos(b) * 30, Math.sin(b) * 30, 2.4, i % 2 ? r1 : r2);
      }
      break;
    case 'atesBocegi':
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39996;
        const r = 6 + ((i * 11) % 27);
        nokta(Math.cos(a) * r, Math.sin(a) * r, 1.4 + (i % 3) * 0.6, i % 4 ? '#E8FF8A' : r1);
      }
      break;
    case 'gul':
      for (const [r, c] of [[30, r2], [20, r1], [10, r2]] as [number, string][]) egriNoktalar(Math.round(r * 0.8), (t) => [Math.cos(t) * r, Math.sin(t) * r], c, 2);
      break;
    case 'yagmur':
      for (let i = 0; i < 9; i++) {
        const x = -28 + i * 7;
        const y = -26 + (i % 3) * 6;
        egriC(`M${x} ${y}L${x - 3} ${y + 40}`, i % 2 ? r1 : '#B5E0FF', 1.4);
        nokta(x, y, 2);
      }
      break;
    case 'tac':
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (i / 12) * Math.PI;
        isin(0, 10, Math.cos(a) * 32, Math.sin(a) * 32 + 10);
        nokta(Math.cos(a) * 34, Math.sin(a) * 34 + 10, 2.4, i % 2 ? r1 : r2);
      }
      break;
    case 'hilal':
      egriNoktalar(30, (t) => {
        const u = t / 2 - Math.PI / 2;
        return [Math.cos(u) * 28 - 4, Math.sin(u) * 28];
      }, r1, 2.4);
      egriNoktalar(20, (t) => {
        const u = t / 2 - Math.PI / 2;
        return [Math.cos(u) * 18 + 2, Math.sin(u) * 22];
      }, r2, 1.8);
      break;
    case 'dalga':
      egriNoktalar(30, (t) => {
        const u = t / Math.PI - 1;
        return [u * 32, Math.sin(u * Math.PI * 2) * 14];
      }, r1, 2.4);
      break;
    case 'kelebek':
      egriNoktalar(44, (t) => {
        const r = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) + Math.pow(Math.sin(t / 12), 5);
        return [Math.sin(t) * r * 7.5, -Math.cos(t) * r * 7.5 + 4];
      }, r2, 1.8);
      break;
    case 'fenerAlayi':
      for (let k = 0; k < 5; k++) {
        const cx = -28 + k * 14;
        const cy = -6 + (k % 2) * 12;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          nokta(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 1.3, k % 2 ? r2 : r1);
        }
        nokta(cx, cy, 1.8, '#FFF4C2');
      }
      break;
    case 'saat':
      egriNoktalar(24, (t) => [Math.cos(t) * 30, Math.sin(t) * 30], r1, 2);
      egriC('M0 0L0-20', '#FFF3D6', 2.6);
      egriC('M0 0L13 7', '#FFF3D6', 2.6);
      nokta(0, 0, 2.6, r2);
      break;
  }
  return `<g>${cizgi.join('')}${nok.join('')}</g>`;
}

export function desenSvg(id: DesenId, acik: boolean, renk = 0): SVGSVGElement {
  const r1 = acik ? ['#FFB020', '#FF5FB4', '#3AA8FF', '#2EE07A', '#B266FF', '#FF4D4D'][renk % 6] : '#5A4A60';
  const r2 = acik ? ['#FFF4C2', '#FFE08A', '#B5E0FF', '#A8FFD0', '#E3C7FF', '#FFB3A8'][renk % 6] : '#4A3E52';
  return svg(`<svg class="f-desen-svg" viewBox="-40 -40 80 80" aria-hidden="true">
    ${acik ? `<circle r="36" fill="url(#ftl-koz)" opacity=".18"/>` : ''}${desenIsaretleme(id, r1, r2)}</svg>`);
}

// ─────────────────────────── Fitil görünümü ───────────────────────────

const FITIL_RENKLERI: Record<FitilId, [string, string, string]> = {
  kenevir: ['#9A6A36', '#D9A86A', '#FFB020'],
  altinTel: ['#B8862E', '#FFE08A', '#FFF4C2'],
  simsek: ['#2A5AA8', '#B5E0FF', '#FFFFFF'],
  gokkusagi: ['#FF4D4D', '#3AA8FF', '#FFB020'],
  atesBocegi: ['#3A5A22', '#E8FF8A', '#E8FF8A'],
  laleDali: ['#8A1F5A', '#FF5FB4', '#2EE07A'],
  denizKopugu: ['#0F4A80', '#A8FFF0', '#FFFFFF'],
  ejderKuyrugu: ['#7A1A0E', '#FF7A1A', '#FFF4C2'],
  denizFeneri: ['#3A2416', '#FFF3D6', '#FFC86B'],
};

/** Fitil (ip) önizlemesi: dalgalı örgü + alev başı. */
export function fitilSvg(id: FitilId, acik: boolean): SVGSVGElement {
  const [a, b, c] = acik ? FITIL_RENKLERI[id] : ['#3A3040', '#4A4052', '#4A4052'];
  const d = 'M6 30C20 10 34 10 48 22S76 36 90 18';
  const gok = id === 'gokkusagi' && acik;
  return svg(tekilKimlik(`<svg class="f-fitil-svg" viewBox="0 0 100 44" aria-hidden="true">
    ${gok ? '<defs><linearGradient id="ftl-gk" x1="0" x2="1"><stop offset="0" stop-color="#FF4D4D"/><stop offset=".25" stop-color="#FFB020"/><stop offset=".5" stop-color="#2EE07A"/><stop offset=".75" stop-color="#3AA8FF"/><stop offset="1" stop-color="#B266FF"/></linearGradient></defs>' : ''}
    <path d="${d}" fill="none" stroke="#120A05" stroke-width="9" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${gok ? 'url(#ftl-gk)' : a}" stroke-width="6.4" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${b}" stroke-width="6.4" stroke-dasharray="2.4 3.2" stroke-linecap="butt" opacity=".75"/>
    ${acik ? `<circle cx="90" cy="18" r="9" fill="url(#ftl-koz)"/><circle cx="90" cy="18" r="3" fill="${c}"/>` : ''}</svg>`, ['ftl-gk']));
}

// ─────────────────────────── Rozetler ───────────────────────────

const ROZET_GORUNUM: Record<RozetId, { ikon: IkonAdi; renk: string; metin?: string }> = {
  ilkKivilcim: { ikon: 'alev', renk: '#FF7A1A' },
  caprazNisanci: { ikon: 'roket', renk: '#3AA8FF' },
  sarVePisir: { ikon: 'kafes', renk: '#D9A441' },
  halkaci: { ikon: 'halka', renk: '#FFB020' },
  otuzluk: { ikon: 'patlama', renk: '#FF9A3C', metin: '30' },
  senlik: { ikon: 'patlama', renk: '#FF5FB4', metin: '40' },
  ucuncuKusak: { ikon: 'dalga', renk: '#FF7A1A', metin: '3' },
  buyukFinal: { ikon: 'patlama', renk: '#FFF4C2' },
  roketYagmuru: { ikon: 'roket', renk: '#FF4D4D' },
  kilpayi: { ikon: 'kum', renk: '#CDB89A' },
  tutumlu: { ikon: 'hamle', renk: '#7CFFB2', metin: '10' },
  ustaCirak: { ikon: 'sapka', renk: '#B266FF' },
  saheser: { ikon: 'cerceve', renk: '#FFD15C' },
  defterci: { ikon: 'defter', renk: '#2EE07A' },
  nobetci: { ikon: 'fener', renk: '#FFB020' },
  denizFeneri: { ikon: 'deniz', renk: '#B5E0FF' },
  korukcu: { ikon: 'koruk', renk: '#FF7A1A' },
  domino: { ikon: 'zincir', renk: '#E8631C' },
};

export function rozetSvg(id: RozetId, acik: boolean): SVGSVGElement {
  const g = ROZET_GORUNUM[id];
  const ic = CIZGI[g.ikon];
  const renk = acik ? g.renk : '#4A3E52';
  const yazi = g.metin
    ? `<text x="0" y="17" text-anchor="middle" font-size="11" font-weight="800" fill="${acik ? '#FFF4C2' : '#6A5E72'}" font-family="inherit">${g.metin}</text>`
    : '';
  return svg(`<svg class="f-rozet-svg ${acik ? 'f-acik' : ''}" viewBox="-32 -32 64 64" aria-hidden="true">
    <path d="M-14 18-20 31-10 27-6 33 0 20M14 18l6 13-10-4-4 6L0 20" fill="${acik ? '#B8381C' : '#2A2230'}" stroke="${acik ? '#5A140A' : '#1A1420'}" stroke-width="1.4" stroke-linejoin="round"/>
    <circle r="25" fill="${acik ? 'url(#ftl-pirinc-y)' : '#2A2230'}" stroke="${acik ? '#7A3E1C' : '#1A1420'}" stroke-width="2"/>
    <circle r="19.5" fill="${acik ? '#2A1408' : '#1A1420'}" stroke="${acik ? '#FFE3A0' : '#3A3040'}" stroke-opacity=".5" stroke-width="1.2"/>
    ${acik ? `<circle r="19" fill="${g.renk}" opacity=".14"/>` : ''}
    <g transform="translate(-11 ${g.metin ? -15 : -11}) scale(.92)" fill="none" stroke="${renk}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ic}</g>${yazi}</svg>`);
}

// ─────────────────────────── Kıvılcım Usta ───────────────────────────

/** Kıvılcım Usta portresi (yaşlı fişekçi: kasket, gür beyaz bıyık). */
export function ustaSvg(sinif = ''): SVGSVGElement {
  return svg(tekilKimlik(`<svg class="f-usta ${sinif}" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="31" fill="#2A1A10"/>
    <circle cx="32" cy="32" r="29.5" fill="none" stroke="url(#ftl-pirinc)" stroke-width="3"/>
    <clipPath id="ftl-usta-kirp"><circle cx="32" cy="32" r="28"/></clipPath>
    <g clip-path="url(#ftl-usta-kirp)">
      <rect width="64" height="64" fill="#3B2A5A"/>
      <circle cx="32" cy="66" r="26" fill="#7A3E1C"/>
      <path d="M14 66c2-10 9-14 18-14s16 4 18 14z" fill="#8A2412"/>
      <path d="M26 52l6 6 6-6" fill="none" stroke="#F2C66D" stroke-width="2"/>
      <circle cx="17" cy="35" r="4" fill="#E8A87F"/><circle cx="47" cy="35" r="4" fill="#E8A87F"/>
      <ellipse cx="32" cy="35" rx="15" ry="16" fill="#F2C29B"/>
      <ellipse cx="22.5" cy="40" rx="3.6" ry="2.6" fill="#FF8A7A" opacity=".45"/><ellipse cx="41.5" cy="40" rx="3.6" ry="2.6" fill="#FF8A7A" opacity=".45"/>
      <path d="M20.5 29.5c2-2.6 6-3 8-1M43.5 29.5c-2-2.6-6-3-8-1" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="25.5" cy="33.5" rx="1.9" ry="2.3" fill="#2A1408"/><ellipse cx="38.5" cy="33.5" rx="1.9" ry="2.3" fill="#2A1408"/>
      <circle cx="26.1" cy="32.8" r=".7" fill="#fff"/><circle cx="39.1" cy="32.8" r=".7" fill="#fff"/>
      <ellipse cx="32" cy="39" rx="3.2" ry="2.8" fill="#E0937A"/>
      <path d="M32 42c-3-2.6-8-3-11.5-.5-2.2 1.6-4.2 1.2-5-.6.2 3.6 3.6 6 7.6 5.2 3.4-.6 6.2-2 8.9-4.1 2.7 2.1 5.5 3.5 8.9 4.1 4 .8 7.4-1.6 7.6-5.2-.8 1.8-2.8 2.2-5 .6C40 39 35 39.4 32 42z" fill="#FFFFFF" stroke="#D8D0C6" stroke-width=".8"/>
      <path d="M29 47.5c1.8 1 4.2 1 6 0" fill="none" stroke="#9A4A3A" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M15.5 27c0-10 7.5-15 16.5-15s16.5 5 16.5 15c-5-2.4-11-3.4-16.5-3.4S20.5 24.6 15.5 27z" fill="#8A1C1C"/>
      <path d="M13 28c6-3.6 13-4.6 19-4.6s13 1 19 4.6c-1 1.6-2 2-3 1.6-5-2-10.5-2.6-16-2.6s-11 .6-16 2.6c-1 .4-2-.2-3-1.6z" fill="#5A0E0E"/>
      <path d="M25 15.4c3-2 11-2 14 0" fill="none" stroke="#B8381C" stroke-width="1.4"/>
      <circle cx="32" cy="18.5" r="3.2" fill="url(#ftl-pirinc)" stroke="#7A3E1C" stroke-width=".8"/>
      <path d="M44 13l2-4M47 15l4-2M46 10l1-1" stroke="#FFB020" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="45.5" cy="12" r="1.6" fill="#FFF4C2"/>
    </g></svg>`, ['ftl-usta-kirp']));
}

/** Bayrak/şerit ikonu yerine kullanılan alev rozeti (Fener Nöbeti). */
export function alevSvg(sinif = ''): SVGSVGElement {
  return svg(`<svg class="f-alev ${sinif}" viewBox="-12 -14 24 28" aria-hidden="true">
    <path d="M0 13c-6 0-9.5-4-9.5-9 0-6 5-8.5 6-15 3.6 2 5.2 5 5.4 8 1.4-1 2.2-2.8 2.4-5 4 3 5.7 7 5.7 11.8 0 5.2-4 9.2-10 9.2z" fill="url(#ftl-altin)" stroke="#B8381C" stroke-width="1.2"/>
    <path d="M0 13c-2.6 0-4.4-1.8-4.4-4.2 0-2.6 2.2-3.8 3.2-6.4 3 1.6 5.4 3.6 5.4 6.4 0 2.4-1.8 4.2-4.2 4.2z" fill="#FFF4C2"/></svg>`);
}

// ─────────────────────── Kancalar: mühür ve kandil ───────────────────────

/** Mum mühürün dalgalı kenarı (merkez 0,0; r ≈ 13). */
const MUM_YOLU = (() => {
  const p: string[] = [];
  const n = 48;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 13 + 0.9 * Math.sin(a * 7 + 0.6) + 0.5 * Math.sin(a * 11 + 2.1);
    p.push(`${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`);
  }
  return `M${p.join('L')}Z`;
})();

/** Kademe harfi: Çırak/Kalfa/Usta → Ç/K/U; İngilizcede Apprentice/Journeyman/Master → A/J/M. */
const KADEME_HARFI: Record<string, string> = tt({ cirak: 'Ç', kalfa: 'K', usta: 'U' }, { cirak: 'A', kalfa: 'J', usta: 'M' });

/**
 * Mum mühür (KANCALAR §C.2): basılı = kırmızı mum + kabartma kademe harfi
 * (Ç/K/U); basılmamış = kesik çerçeve ve sönük harf. viewBox −16..16.
 */
export function muhurIsaretleme(kademe: string, basili: boolean): string {
  const harf = KADEME_HARFI[kademe] ?? '?';
  if (!basili)
    return `<circle r="12.4" fill="rgba(0,0,0,.28)" stroke="#E8CFA8" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="3.2 2.6"/>
      <text y="5" text-anchor="middle" font-size="14" font-weight="800" fill="#E8CFA8" fill-opacity=".38" font-family="'Nunito',system-ui,sans-serif">${harf}</text>`;
  return `<path d="${MUM_YOLU}" fill="#3A0606" transform="translate(.6 1.4)"/>
    <path d="${MUM_YOLU}" fill="url(#ftl-mum)"/>
    <circle r="9.4" fill="none" stroke="#7A0E0E" stroke-width="1.4" opacity=".75"/>
    <circle r="9.4" fill="none" stroke="#FF9A84" stroke-width=".7" opacity=".45" transform="translate(-.5 -.6)"/>
    <text y="5.6" text-anchor="middle" font-size="13.5" font-weight="800" fill="#FF9A84" fill-opacity=".55" font-family="'Nunito',system-ui,sans-serif" transform="translate(-.6 -.7)">${harf}</text>
    <text y="5.6" text-anchor="middle" font-size="13.5" font-weight="800" fill="#5A0808" font-family="'Nunito',system-ui,sans-serif">${harf}</text>
    <ellipse cx="-5" cy="-7" rx="3.4" ry="1.6" fill="#FFD2C4" opacity=".45" transform="rotate(-30 -5 -7)"/>`;
}

export function muhurSvg(kademe: string, basili: boolean, sinif = ''): SVGSVGElement {
  return svg(`<svg class="f-muhur-svg${basili ? ' f-basili' : ''} ${sinif}" viewBox="-16 -16 32 32" aria-hidden="true">${muhurIsaretleme(kademe, basili)}</svg>`);
}

/**
 * Pişmiş toprak kandil (KANCALAR §B.1): kayık biçimli gövde, solda emzikte
 * küçük alev; yıldız ve tozdan ayrı siluet. viewBox −16..16 × −16..12.
 */
export function kandilIsaretleme(yanik = true): string {
  return `${yanik ? '<circle cx="-11" cy="-6" r="9" fill="url(#ftl-koz)" opacity=".85"/>' : ''}
    <path d="M-14.5-1.6C-12-3.4-8.8-4-4.6-4.2 1.4-4.6 8.4-4.2 11.6-1.8c1.4 1 1.6 2.6.6 4C9.6 5.8 4.2 7.4-1 7.4-6.6 7.4-10.4 5.2-12.6 2.2c-.6-.9-1.2-2-1.9-3.8z" fill="#3A1A08" transform="translate(0 1.2)"/>
    <path d="M-14.5-1.6C-12-3.4-8.8-4-4.6-4.2 1.4-4.6 8.4-4.2 11.6-1.8c1.4 1 1.6 2.6.6 4C9.6 5.8 4.2 7.4-1 7.4-6.6 7.4-10.4 5.2-12.6 2.2c-.6-.9-1.2-2-1.9-3.8z" fill="url(#ftl-kil)" stroke="#5A260E" stroke-width="1"/>
    <ellipse cx="1.4" cy="-2.6" rx="4.2" ry="1.5" fill="#4A1E0A"/>
    <path d="M11.4-1.2c2.8-.6 4.4 1.2 3.4 3.2-.7 1.4-2.2 1.6-3.4 1.2" fill="none" stroke="#8A3E18" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M-9 2.6c3 1.8 8 2.2 13 .6" fill="none" stroke="#F2B07A" stroke-width=".9" stroke-linecap="round" opacity=".55"/>
    ${yanik ? '<path d="M-12.6-4.2c-2.2-1.4-2.4-4.6.2-8.8.6 2.4 2.6 3.4 2.4 5.6-.1 1.8-1.2 3.2-2.6 3.2z" fill="url(#ftl-altin)" stroke="#B8381C" stroke-width=".7"/><path d="M-12.4-5c-.8-.6-.8-2 .2-3.4.4 1 1 1.6.9 2.4-.1.6-.5 1-1.1 1z" fill="#FFF4C2"/>' : ''}`;
}

export function kandilSvg(sinif = '', yanik = true): SVGSVGElement {
  return svg(`<svg class="f-kandil-svg ${sinif}" viewBox="-16 -15 32 24" aria-hidden="true">${kandilIsaretleme(yanik)}</svg>`);
}

// ─────────────────────── Can, reklam, Mağaza (CAN-REKLAM §6) ───────────────────────

/** Fitil ipinin yolu (viewBox −16..16): sol alttan yumuşak bir kavisle sağ üstte kıvılcıma varır. */
const FITIL_YOLU = 'M-12 11.4C-7.6 11.6-6.4 6.6-4 3.4S1.8-1.6 4-4.8 6-7.6 6.6-8.2';

/**
 * Can simgesi (kalp yerine kıvılcımlı fitil; oyunun dili): örgülü ip
 * (`ftl-ip`) + ucunda köz ve dört köşeli kıvılcım. `yanik` false: harcanmış
 * can (gri örgü `ftl-ip-sonuk`, kömürleşmiş uç, ince duman). viewBox −16..16.
 */
export function fitilCanIsaretleme(yanik = true): string {
  if (!yanik)
    return `<path d="${FITIL_YOLU}" fill="none" stroke="#161014" stroke-width="6.4" stroke-linecap="round"/>
      <path d="${FITIL_YOLU}" fill="none" stroke="url(#ftl-ip-sonuk)" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M4.6-5.6 6.6-8.2" stroke="#0E0A0C" stroke-width="4.8" stroke-linecap="round"/>
      <path d="M7.6-11.4c-1.6-1.8.8-2.8-.4-4.6M10.2-10.2c-1.2-1.4.6-2.2-.2-3.6" fill="none" stroke="#A89EB0" stroke-width="1" stroke-linecap="round" opacity=".7"/>`;
  return `<circle cx="7.4" cy="-8.6" r="8.6" fill="url(#ftl-koz)"/>
    <path d="${FITIL_YOLU}" fill="none" stroke="#2A1408" stroke-width="6.4" stroke-linecap="round"/>
    <path d="${FITIL_YOLU}" fill="none" stroke="url(#ftl-ip)" stroke-width="4.2" stroke-linecap="round"/>
    <circle cx="6.6" cy="-8.2" r="2.8" fill="#FF7A1A"/>
    <path d="M7.6-17 9.1-10.6l6.4 1.6-6.4 1.6-1.5 6.4L6.1-7.4-.3-9l6.4-1.6z" fill="#FFF4C2" stroke="#FFB020" stroke-width=".9" stroke-linejoin="round"/>
    <circle cx="13.8" cy="-1.6" r="1.2" fill="#FFD15C"/><circle cx="1.2" cy="-14.8" r="1" fill="#FFD15C"/>`;
}

export function fitilCanSvg(sinif = '', yanik = true): SVGSVGElement {
  return svg(`<svg class="f-fitil-can${yanik ? '' : ' f-sonuk'} ${sinif}" viewBox="-16 -17 32 32" aria-hidden="true">${fitilCanIsaretleme(yanik)}</svg>`);
}

/** Mağaza ürün resmi (madalyon, viewBox −24..24): başlangıç ve büyük paket, can doldur, güçlendirici paketi, Usta kartı. */
export function urunSvg(id: 'baslangic_paketi' | 'can_doldur' | 'guclendirici_paketi' | 'buyuk_paket' | 'usta_karti'): SVGSVGElement {
  let ic = '';
  switch (id) {
    case 'baslangic_paketi':
      // Kurdeleli hediye kutusu (yeşil kurdele: "bir kez" teklifi öbür paketlerden ayrılsın).
      ic = madalyon(
        `<rect x="-13" y="-3" width="26" height="16" rx="2.4" fill="url(#ftl-kirmizi)" stroke="#5A0E0E" stroke-width="1.3"/>
        <rect x="-15" y="-9" width="30" height="7.5" rx="2" fill="#C8281C" stroke="#5A0E0E" stroke-width="1.3"/>
        <rect x="-3" y="-9" width="6" height="22" fill="#4ED894" stroke="#0E5A34" stroke-width="1"/>
        <path d="M0-9c-3-6-11-7-10-2 1 3 6 3 10 2zM0-9c3-6 11-7 10-2-1 3-6 3-10 2z" fill="#7CFFB2" stroke="#0E5A34" stroke-width="1.2" stroke-linejoin="round"/>
        <rect x="-11" y="-1" width="3" height="12" rx="1.5" fill="#fff" opacity=".22"/>`,
        '#7CFFB2',
      );
      break;
    case 'buyuk_paket':
      ic = madalyon(
        `<g transform="translate(-9.4 5.2) scale(.56)">${guclendiriciIsaretleme('kibrit')}</g>
        <g transform="translate(9.4 5.2) scale(.56)">${guclendiriciIsaretleme('geriSar')}</g>
        <g transform="translate(0 -6.2) scale(.6)">${guclendiriciIsaretleme('kalip')}</g>
        <circle cx="13" cy="-12" r="5.6" fill="#E8862E" stroke="#5A2A08" stroke-width="1.2"/>
        <path d="M13-14.6v5.2M10.4-12h5.2" stroke="#FFF4C2" stroke-width="1.8" stroke-linecap="round"/>`,
        '#FFB04A',
      );
      break;
    case 'can_doldur':
      ic = madalyon(`<g transform="translate(-.4 1.6) scale(1.06)">${fitilCanIsaretleme(true)}</g>`, '#FF9A3C');
      break;
    case 'guclendirici_paketi':
      ic = madalyon(
        `<g transform="translate(-7.8 5.6) scale(.5)">${guclendiriciIsaretleme('kibrit')}</g>
        <g transform="translate(8 5.6) scale(.5)">${guclendiriciIsaretleme('geriSar')}</g>
        <g transform="translate(0 -6.6) scale(.52)">${guclendiriciIsaretleme('kalip')}</g>`,
      );
      break;
    case 'usta_karti':
      ic = madalyon(
        `<g transform="rotate(-8)"><rect x="-10.5" y="-14" width="21" height="28" rx="3.4" fill="url(#ftl-altin)" stroke="#7A3E1C" stroke-width="1.4"/>
        <rect x="-7.6" y="-11" width="15.2" height="22" rx="2" fill="none" stroke="#9A5A22" stroke-width=".9" opacity=".7"/>
        <path d="M-7 1c0-6.4 3.2-9.2 7-9.2S7-5.4 7 1c-2.2-1-4.6-1.4-7-1.4S-4.8 0-7 1z" fill="#8A1C1C"/>
        <path d="M-8.4 1.8c2.6-1.4 5.6-2 8.4-2s5.8.6 8.4 2c-.4.8-.9 1-1.4.8-2.2-.9-4.6-1.2-7-1.2s-4.8.3-7 1.2c-.5.2-1-.1-1.4-.8z" fill="#5A0E0E"/>
        <circle cx="0" cy="-5.2" r="1.7" fill="url(#ftl-pirinc)"/>
        <path d="M0 4.4l1.2 3 3 .4-2.3 2 .7 3L0 11.2l-2.6 1.6.7-3-2.3-2 3-.4z" fill="#FFF4C2" stroke="#B8642E" stroke-width=".6"/></g>`,
        '#FFD15C',
      );
      break;
  }
  return svg(`<svg class="f-resim f-urun-svg" viewBox="-24 -24 48 48" aria-hidden="true">${ic}</svg>`);
}
