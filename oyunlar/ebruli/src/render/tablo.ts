/** Ebru tablosu (P4) — geçici taslak; tam uygulama bu dosyada gelir. */
import type { TabloCizici, TabloIstegi, TabloSonucu } from '../app/sozlesme';
import { tuvalOlustur } from './tuval';

export function tabloCiziciOlustur(): TabloCizici {
  const ciz = (_i: TabloIstegi, b = { w: 512, h: 768 }): TabloSonucu => {
    const { tuval, ctx } = tuvalOlustur(b.w, b.h);
    ctx.fillStyle = '#F3E9D2';
    ctx.fillRect(0, 0, b.w, b.h);
    return { tuval, teknikler: ['battal'], nadirlik: 0 };
  };
  return {
    tabloCiz: ciz,
    tabloCizParcali: async (i, b) => ciz(i, b),
    kucukResim: (i, w, h) => ciz(i, { w, h }).tuval,
  };
}
