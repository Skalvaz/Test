/**
 * Hedef ilerlemesi (GDD §7). Eylemin olay listesi (zaman sıralı) bittikten
 * sonra tek geçişte işlenir: ilerleten her olayın HEMEN ARDINA
 * `hedefIlerledi` eklenir. Böylece adım tamponunun zaman sıralaması
 * hedef sayaçlarını karıştırmaz (değer listede hep artan).
 *
 *  - topla: temizlenen o renkteki her damla (o renkteki Tarak/Girdap dahil)
 *    ve sürüklenip tüketilen o renkteki Tarak/Girdap (`ozelSuruklendi{tasindi}`).
 *  - kagit: her `kagitAlindi` +1. desen: her `desenBoyandi` +1.
 *  - puan: eylem sonunda min(puan, gerekli) (bir kez).
 * İlerleme `gerekli`yi aşmaz; tamamlanan hedef artık ilerlemez.
 */
import type { HedefDurumu, Olay, OyunDurumu } from './types';

function ilerlet(h: HedefDurumu, miktar: number): boolean {
  if (h.tamam || miktar <= 0) return false;
  h.ilerleme = Math.min(h.gerekli, h.ilerleme + miktar);
  h.tamam = h.ilerleme >= h.gerekli;
  return true;
}

export function hedefleriIsle(d: OyunDurumu, olaylar: readonly Olay[]): Olay[] {
  const out: Olay[] = [];
  const yaz = (t: number, k: number): void => {
    const h = d.hedefler[k];
    out.push({ t, tur: 'hedefIlerledi', indeks: k, deger: h.ilerleme, tamam: h.tamam });
  };
  for (const o of olaylar) {
    out.push(o);
    let renk = -1;
    if (o.tur === 'temizlendi') renk = o.renk;
    else if (o.tur === 'ozelSuruklendi' && o.tasindi && o.damla) renk = o.damla.renk;
    d.hedefler.forEach((h, k) => {
      const g = h.hedef;
      let artti = false;
      if (g.tur === 'topla' && renk === g.renk) artti = ilerlet(h, 1);
      else if (g.tur === 'kagit' && o.tur === 'kagitAlindi') artti = ilerlet(h, 1);
      else if (g.tur === 'desen' && o.tur === 'desenBoyandi') artti = ilerlet(h, 1);
      if (artti) yaz(o.t, k);
    });
  }
  const tSon = out.length ? out[out.length - 1].t : 0;
  d.hedefler.forEach((h, k) => {
    if (h.hedef.tur !== 'puan' || h.tamam) return;
    const v = Math.min(h.gerekli, d.puan);
    if (v === h.ilerleme) return;
    h.ilerleme = v;
    h.tamam = v >= h.gerekli;
    yaz(tSon, k);
  });
  return out;
}

export function hedeflerTamam(d: OyunDurumu): boolean {
  return d.hedefler.length > 0 && d.hedefler.every((h) => h.tamam);
}
