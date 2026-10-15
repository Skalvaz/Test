/**
 * Ekranların ortak parçaları: düğmeler, yıldız sırası, hedef simgesi,
 * kâğıt kart, tablo küçük resmi.
 */
import { h, svg } from '../dom';
import { IKON, KARANFIL, LALE, YILDIZ_BOS, YILDIZ_DOLU } from '../ikonlar';
import { damlaResmi, desenResmi, img, kagitResmi } from '../gorsel';
import type { HedefVM } from '../tipler';
import { renkAdi, sayi } from '../metinler';

export type DugmeTuru = 'ana' | 'ikincil' | 'hayalet' | 'yuvarlak';

export interface DugmeSecenek {
  tur?: DugmeTuru;
  ikon?: keyof typeof IKON;
  /** Erişilebilir ad (yalnız ikonlu düğmede). */
  ad?: string;
  sinif?: string;
  on: () => void;
}

/** Düğme: dokunuşta hafif ses ve titreşim `Baglam`dan (arayuz.ts) gelir. */
export function dugme(metin: string, s: DugmeSecenek): HTMLButtonElement {
  const b = h('button', { s: `e-dugme e-${s.tur ?? 'ana'}${s.sinif ? ' ' + s.sinif : ''}`, type: 'button', 'aria-label': s.ad ?? (metin || undefined) });
  if (s.ikon) b.appendChild(svg(IKON[s.ikon]));
  if (metin) b.appendChild(h('span', { t: metin }));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    dugmeSesi();
    s.on();
  });
  return b;
}

let dugmeSesi: () => void = () => {};
export function dugmeSesiAyarla(fn: () => void): void {
  dugmeSesi = fn;
}

export function yildizSirasi(n: number, sinif = 'e-yildizlar'): HTMLElement {
  const k = h('div', { s: sinif, 'aria-label': `${n} yıldız` });
  for (let i = 0; i < 3; i++) {
    const y = svg(i < n ? YILDIZ_DOLU : YILDIZ_BOS);
    y.classList.add(i < n ? 'dolu' : 'bos');
    k.appendChild(y);
  }
  return k;
}

/** Hedef simgesi (renk damlası / kâğıt / desen motifi / puan mührü). */
export function hedefIkonu(hd: HedefVM, boyut: number): HTMLElement {
  const kap = h('span', { s: 'e-hedef-ikon', css: { width: `${boyut}px`, height: `${boyut}px` } });
  if (hd.tur === 'topla' && hd.renk) kap.appendChild(img(damlaResmi(hd.renk, boyut), boyut, '', renkAdi(hd.renk)));
  else if (hd.tur === 'kagit') kap.appendChild(img(kagitResmi(boyut), boyut, '', 'kâğıt'));
  else if (hd.tur === 'desen') {
    const m = svg(hd.motif === 'karanfil' ? KARANFIL : LALE);
    m.classList.add('e-motif');
    kap.appendChild(m);
  } else {
    const s = svg(YILDIZ_DOLU);
    s.classList.add('e-puan-ikon');
    kap.appendChild(s);
  }
  return kap;
}

/** Hedefin kalan miktarı (kart sayısı). */
export function hedefKalan(hd: HedefVM): number {
  return Math.max(0, hd.gerekli - hd.ilerleme);
}

export function hedefMetni(hd: HedefVM): string {
  switch (hd.tur) {
    case 'topla':
      return `${hd.gerekli} ${renkAdi(hd.renk ?? 0)} topla`;
    case 'kagit':
      return 'Bütün kâğıtları al';
    case 'desen':
      return hd.motif === 'karanfil' ? 'Karanfil desenini boya' : 'Lale desenini boya';
    case 'puan':
      return `${sayi(hd.gerekli)} puan`;
  }
}

/** Kâğıt kart kabı (krem ahar, altın kenar, ceviz halka). */
export function kart(sinif: string, ...cocuk: (Node | null | false)[]): HTMLElement {
  return h('div', { s: `e-kart ${sinif}` }, ...cocuk);
}

/** Tablo küçük resmi: tuvali aynı boyda bir <canvas>'a kopyalar (aynı tuval iki yerde duramaz). */
export function tabloResmi(ciz: (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas, w: number, hh: number, sinif = 'e-tablo'): HTMLCanvasElement {
  const kaynak = ciz(w, hh);
  const t = h('canvas', { s: sinif });
  t.width = kaynak.width;
  t.height = kaynak.height;
  t.style.width = `${w}px`;
  t.style.height = `${hh}px`;
  t.getContext('2d')?.drawImage(kaynak as CanvasImageSource, 0, 0);
  return t;
}

/** Desen simgesi (bölüm öncesi "yeni" kartı). */
export function desenOrnegi(boyut: number): HTMLElement {
  return img(desenResmi(boyut, 5, false), boyut);
}
