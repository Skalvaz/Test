/**
 * Küçük DOM yardımcıları. Görünüm modelinden gelen metinler YALNIZ
 * `textContent` ile yazılır; `innerHTML` yalnız modülün kendi SVG
 * işaretlemesi içindir (dışarıdan gelen metin girmez).
 */

export type Cocuk = Node | string | number | null | undefined | false | Cocuk[];

export interface Ozellikler {
  /** class adı (boşlukla ayrılmış). */
  s?: string;
  /** textContent. */
  t?: string;
  /** Olay dinleyicileri. */
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
  /** Satır içi stil (CSS özelliği → değer; `--degisken` de olur). */
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

/** HTML öğesi üretir: h('button', { s: 'f-dugme', t: 'Başla', on: { click } }). */
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

const sablon = typeof document !== 'undefined' ? document.createElement('template') : null;

/** Modülün kendi SVG işaretlemesinden öğe üretir. */
let kimlikSayaci = 0;

/**
 * (P5 düzeltmesi) SVG içindeki yerel kimlikleri (gradyan, clipPath) örneğe
 * özgü yapar. Aynı kimlik DOM'da birden çok kez olunca `url(#…)` İLK örneğe
 * çözülür; ilk örnek gizli bir ekrandaysa (harita `visibility:hidden`)
 * Chrome kırpmayı/dolguyu boş çizer (Kıvılcım Usta portresi boş daire kalıyordu).
 */
export function tekilKimlik(isaretleme: string, kimlikler: readonly string[]): string {
  const n = ++kimlikSayaci;
  let s = isaretleme;
  for (const k of kimlikler) s = s.split(`"${k}"`).join(`"${k}-${n}"`).split(`#${k})`).join(`#${k}-${n})`);
  return s;
}

export function svg(isaretleme: string): SVGSVGElement {
  sablon!.innerHTML = isaretleme.trim();
  const e = sablon!.content.firstElementChild as SVGSVGElement;
  sablon!.content.removeChild(e);
  return e;
}

export function bekle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bir sonraki çizim karesi (giriş animasyonu sınıfını eklemek için). */
export function kare(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/** Sistem "hareketi azalt" tercihi. */
export function sistemAzHareket(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Panoya kopyala; olmazsa false (çağıran metni seçili gösterir). */
export async function panoyaKopyala(metin: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(metin);
      return true;
    }
  } catch {
    /* izin yok ya da çerçeve engelledi */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = metin;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.('copy') ?? false;
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Metin kutusundaki bütün metni seç (kopyalama reddedilince). */
export function metniSec(e: HTMLTextAreaElement | HTMLInputElement): void {
  try {
    e.focus({ preventScroll: true });
    e.select();
    e.setSelectionRange(0, e.value.length);
  } catch {
    /* yok say */
  }
}

/** Eğriler (§12.1). */
export const egri = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

/**
 * Sayıyı rAF ile hedefe doğru sayar. Önceki sayımı iptal eder.
 * Dönen işlev sayımı durdurur.
 */
export function say(e: Element, bas: number, son: number, ms: number, bicim: (n: number) => string): () => void {
  let iptal = false;
  if (ms <= 0 || bas === son) {
    e.textContent = bicim(son);
    return () => {};
  }
  const t0 = performance.now();
  const adim = (t: number) => {
    if (iptal) return;
    const u = Math.min(1, (t - t0) / ms);
    e.textContent = bicim(bas + (son - bas) * egri.outCubic(u));
    if (u < 1) requestAnimationFrame(adim);
  };
  requestAnimationFrame(adim);
  return () => {
    iptal = true;
  };
}

/** Sınıfı kaldırıp yeniden ekleyerek CSS animasyonunu baştan oynatır. */
export function yenidenOynat(e: Element, sinif: string): void {
  e.classList.remove(sinif);
  void (e as HTMLElement).offsetWidth;
  e.classList.add(sinif);
}
