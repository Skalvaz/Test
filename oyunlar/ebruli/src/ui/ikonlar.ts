/**
 * Satır içi SVG ikonlar (emoji yok). Çizgi ikonlar 24×24, `currentColor`;
 * süs motifleri (lale, karanfil, rumi, şehir siluetleri) kendi viewBox'larıyla.
 */
import { svg } from './dom';

const C = (ic: string, ek = ''): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${ek}>${ic}</svg>`;

export const IKON = {
  duraklat: C('<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>'),
  oynat: C('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>'),
  geri: C('<path d="M15 5l-7 7 7 7"/>'),
  kapat: C('<path d="M6 6l12 12M18 6L6 18"/>'),
  yeniden: C('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4.2h4.2"/>'),
  ayarlar: C('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
  galeri: C('<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M7.5 16c1.6-3.2 3.2-1 4.6-3.6S15 9.5 16.5 8"/><circle cx="9" cy="8.5" r="1.6"/>'),
  harita: C('<path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>'),
  soru: C('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  kilit: C('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  ses: C('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  muzik: C('<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>'),
  dalga: C('<path d="M3 9c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 4.3-2 5 0"/><path d="M3 15c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 4.3-2 5 0"/>'),
  titresim: C('<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 9v6M19.5 9v6"/>'),
  hareket: C('<path d="M4 12h10M4 7h6M4 17h8"/><path d="M17 8l4 4-4 4"/>'),
  hiz: C('<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>'),
  palet: C('<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 1.9-1 1.5-2.1-.5-1.3.4-2.4 1.8-2.4H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.2 16.7 3.5 12 3.5z"/><circle cx="8" cy="10.5" r="1.2" fill="currentColor"/><circle cx="11.5" cy="7.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="9" r="1.2" fill="currentColor"/>'),
  motif: C('<circle cx="7" cy="8" r="1.8" fill="currentColor"/><circle cx="17" cy="8" r="3"/><path d="M4 17c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.8 0 3.2-1.4 4.8 0"/>'),
  ipucu: C('<path d="M9 17h6M10 20h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.6.5 1 1.1 1 1.8v.2h4.4v-.2c0-.7.4-1.3 1-1.8A5.5 5.5 0 0 0 12 3.5z"/>'),
  tarif: C('<circle cx="5.5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M15.5 10.5h2M15.5 13.5h2"/><circle cx="20" cy="12" r="1.6" fill="currentColor"/>'),
  bilgi: C('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.7" r=".7" fill="currentColor"/>'),
  sil: C('<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>'),
  tik: C('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  ok: C('<path d="M5 12h13M13 6l6 6-6 6"/>'),
  el: C('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.8-2.4L4.4 15a1.5 1.5 0 0 1 2.4-1.8L9 15.5"/>'),
};

/** Dolu yıldız (altın) ve boş yıldız (kontur). */
export const YILDIZ_DOLU =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.75 5.95 6.5.75-4.83 4.42 1.33 6.42L12 16.9l-5.75 3.24 1.33-6.42L2.75 9.3l6.5-.75z" fill="currentColor" stroke="rgba(60,40,8,.55)" stroke-width=".9" stroke-linejoin="round"/></svg>';
export const YILDIZ_BOS =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.75 5.95 6.5.75-4.83 4.42 1.33 6.42L12 16.9l-5.75 3.24 1.33-6.42L2.75 9.3l6.5-.75z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/** Lale (Üsküdar) — çini üslubu, altın kontur. */
export const LALE =
  '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M24 62V30" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M24 50c-6-1-11-6-12-12 6 1 11 5 12 12zM24 44c5-1 9-5 10-10-5 1-9 4-10 10z" fill="var(--yaprak, #3FA86B)" stroke="currentColor" stroke-width="1.2"/><path d="M24 31c-8 0-12-8-11-17 3 3 6 4 8 4-1-5 0-10 3-15 3 5 4 10 3 15 2 0 5-1 8-4 1 9-3 17-11 17z" fill="var(--tac, #D6423A)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M24 30c-2-4-2-10 0-16M24 30c2-4 2-10 0-16" stroke="currentColor" stroke-width=".9" fill="none" opacity=".7"/></svg>';

/** Karanfil (Bursa). */
export const KARANFIL =
  '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M24 62V30" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M24 52c-5-1-9-5-10-10 5 1 9 4 10 10zM24 46c4-1 8-4 9-9-4 1-8 4-9 9z" fill="var(--yaprak, #3FA86B)" stroke="currentColor" stroke-width="1.2"/><path d="M15 26l-1-5 3 1-1-5 3 2 1-5 2 4 2-5 2 5 2-4 1 5 3-2-1 5 3-1-1 5c-2 4-6 6-9 6s-7-2-9-6z" fill="var(--tac, #9A5CC6)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M19 30c2 1 3 1 5 1s3 0 5-1l-2 3h-6z" fill="var(--yaprak, #3FA86B)" stroke="currentColor" stroke-width="1"/></svg>';

/** Rumi kıvrımlı süs çizgisi (başlık altı). */
export const RUMI =
  '<svg viewBox="0 0 160 16" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4 8h52M104 8h52"/><path d="M80 2c-6 0-9 3-9 6s3 6 6 6 4-2 3-4M80 2c6 0 9 3 9 6s-3 6-6 6-4-2-3-4"/><path d="M71 8c-5 0-8-3-13-3M89 8c5 0 8-3 13-3"/></g><circle cx="80" cy="8" r="1.6" fill="currentColor"/></svg>';

/** Sekiz köşeli yıldız (köşe süsü). */
export const SEKIZ_YILDIZ =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="var(--dolgu, #5A3A22)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14"/><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)"/></g><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>';

/** Gelecek atölyelerin siluetleri (Devamı yakında). */
export const SILUET = {
  kapadokya:
    '<svg viewBox="0 0 120 64" aria-hidden="true"><g fill="currentColor"><path d="M8 64c2-14 4-22 8-30 2-4 6-4 8 0 4 8 6 16 8 30z"/><ellipse cx="20" cy="31" rx="6" ry="3.4"/><path d="M34 64c2-10 4-18 7-24 2-3 5-3 7 0 3 6 5 14 6 24z"/><ellipse cx="44" cy="38" rx="5" ry="3"/><path d="M60 64c1-16 4-28 8-36 2-3 5-3 7 0 4 8 6 20 7 36z"/><ellipse cx="71" cy="27" rx="6" ry="3.6"/><path d="M86 64c2-8 4-14 7-18 2-2 4-2 6 0 3 4 5 10 6 18z"/><circle cx="102" cy="12" r="8"/><path d="M98 19l2 6h4l2-6" /><rect x="99.5" y="25" width="5" height="3.5" rx=".8"/></g></svg>',
  ege:
    '<svg viewBox="0 0 120 64" aria-hidden="true"><g fill="currentColor"><path d="M14 22h44l-22-12z"/><rect x="14" y="22" width="44" height="4"/><rect x="17" y="28" width="5" height="26"/><rect x="27" y="28" width="5" height="26"/><rect x="38" y="28" width="5" height="26"/><rect x="49" y="28" width="5" height="26"/><rect x="12" y="54" width="48" height="4"/><path d="M74 46c4-8 10-12 18-12 6 0 10 3 12 8-6-3-12-2-16 2 6 0 10 2 12 6z"/><path d="M68 64c6-4 12-4 18 0s12 4 18 0 10-4 16-1v1z"/><circle cx="96" cy="14" r="5"/></g></svg>',
  saray:
    '<svg viewBox="0 0 120 64" aria-hidden="true"><g fill="currentColor"><rect x="10" y="20" width="3.4" height="40"/><path d="M11.7 8l2.4 12h-4.8z"/><rect x="106.6" y="20" width="3.4" height="40"/><path d="M108.3 8l2.4 12h-4.8z"/><path d="M36 44c0-14 10-24 24-24s24 10 24 24z"/><rect x="58.6" y="12" width="2.8" height="9"/><circle cx="60" cy="11" r="2"/><path d="M22 52c0-8 5-13 12-13s12 5 12 13zM74 52c0-8 5-13 12-13s12 5 12 13z"/><rect x="18" y="50" width="84" height="12"/></g></svg>',
};

export function ikon(ad: keyof typeof IKON): SVGSVGElement {
  return svg(IKON[ad]);
}

export function yildizIkonu(dolu: boolean): SVGSVGElement {
  return svg(dolu ? YILDIZ_DOLU : YILDIZ_BOS);
}
