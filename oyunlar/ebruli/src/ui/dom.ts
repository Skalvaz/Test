/**
 * Küçük DOM yardımcıları. Dışarıdan gelen metin YALNIZ `textContent` ile
 * yazılır; `innerHTML` yalnız modülün kendi SVG işaretlemesi içindir.
 */
export type Cocuk = Node | string | number | null | undefined | false | Cocuk[];

export interface Ozellikler {
  /** class adı. */
  s?: string;
  /** textContent. */
  t?: string;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
  css?: Record<string, string>;
  [ad: string]: unknown;
}

function cocukEkle(e: Element, c: Cocuk): void {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) {
    for (const x of c) cocukEkle(e, x);
    return;
  }
  e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
}

export function h<K extends keyof HTMLElementTagNameMap>(etiket: K, oz?: Ozellikler | null, ...cocuklar: Cocuk[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiket);
  if (oz) {
    for (const [ad, deger] of Object.entries(oz)) {
      if (deger === undefined || deger === null || deger === false) continue;
      if (ad === 's') e.className = String(deger);
      else if (ad === 't') e.textContent = String(deger);
      else if (ad === 'on') {
        for (const [olay, fn] of Object.entries(deger as Record<string, (e: Event) => void>)) e.addEventListener(olay, fn);
      } else if (ad === 'css') {
        for (const [k, v] of Object.entries(deger as Record<string, string>)) e.style.setProperty(k, v);
      } else if (deger === true) e.setAttribute(ad, '');
      else e.setAttribute(ad, String(deger));
    }
  }
  for (const c of cocuklar) cocukEkle(e, c);
  return e;
}

let sablon: HTMLTemplateElement | null = null;

/** Modülün kendi SVG işaretlemesinden öğe. */
export function svg(isaretleme: string): SVGSVGElement {
  if (!sablon) sablon = document.createElement('template');
  sablon.innerHTML = isaretleme.trim();
  const e = sablon.content.firstElementChild as SVGSVGElement;
  sablon.content.removeChild(e);
  return e;
}

export const bekle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const kare = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

/** Sayıyı sayarak artır (puan); hareketi azaltta anında. */
export function sayarakYaz(el: HTMLElement, hedef: number, sure: number, bicim: (n: number) => string, azalt: boolean): Promise<void> {
  if (azalt || sure <= 0) {
    el.textContent = bicim(hedef);
    return Promise.resolve();
  }
  return new Promise((r) => {
    const t0 = performance.now();
    const adim = (t: number): void => {
      const u = Math.min(1, (t - t0) / sure);
      const e = 1 - Math.pow(1 - u, 3);
      el.textContent = bicim(hedef * e);
      if (u < 1) requestAnimationFrame(adim);
      else r();
    };
    requestAnimationFrame(adim);
  });
}
