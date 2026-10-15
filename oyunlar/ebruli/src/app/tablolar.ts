/**
 * Kayıttaki tablodan (tohum + sıkıştırılmış günlük) tablo isteği: galeri,
 * harita şeridi, bölüm öncesi küçük resmi ve deneme sonu mozaiği aynı
 * belirlenimli tabloyu yeniden çizer (GDD §9.1, §9.4).
 */
import type { BolumVerisi } from '../core/types';
import type { TabloIstegi } from './sozlesme';
import { gunlukCozGuvenli, type TabloKaydi } from '../meta/index';

const onbellek = new Map<string, TabloIstegi>();

export function tabloIstegi(v: BolumVerisi, t: TabloKaydi): TabloIstegi {
  const a = `${v.id}|${t.tohum}|${t.gunluk.length}|${t.gunluk.slice(-24)}`;
  const o = onbellek.get(a);
  if (o) return o;
  const istek: TabloIstegi = { bolumId: v.id, atolye: v.atolye, tohum: t.tohum, gunluk: gunlukCozGuvenli(t.gunluk) ?? [], w: v.w, h: v.h, yildiz: t.yildiz };
  if (t.motif) istek.motif = t.motif;
  if (onbellek.size > 60) onbellek.clear();
  onbellek.set(a, istek);
  return istek;
}
