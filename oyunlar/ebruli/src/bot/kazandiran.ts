/**
 * "Bu hamle kazandırırdı" (GDD §12.3 #7): kaybettin ekranında, son hamle
 * öncesi tahtada en fazla 2 hamle derinlikli arama. Bütçe zaman değil
 * düğüm sayısıdır (belirlenimli; 7×9'da varsayılan 300 düğüm ≈ 300 ms'nin
 * altı). Adaylar Usta'nın doğumsuz ön değerlendirmesine (hedef ilerlemesi)
 * göre sıralanır.
 *
 * Varsayılan olarak GERÇEK durumla çözer (oyun bitti; hayalet doğru olsun):
 * dönen hamle o tahtada gerçekten kazandırır. `durust: true` ile dolum akışı
 * botun değerlendirme tohumuyla değiştirilir.
 */
import { gecerliHamleler, hamleUygula, ilerlemeYuzdesi, onizleDetay } from '../core/index';
import type { Hamle, OyunDurumu } from '../core/index';
import { botTohumlari } from './ortak';

export interface KazandiranSecenek {
  /** En fazla çözülecek hamle (düğüm). */
  enFazlaDugum?: number;
  /** Derinlik (1–2). */
  derinlik?: number;
  /** Dolum akışını bot tohumuyla değiştir. */
  durust?: boolean;
  botTohumu?: number;
}

function sirali(d: OyunDurumu): Hamle[] {
  const i0 = ilerlemeYuzdesi(d);
  return gecerliHamleler(d)
    .map((h, k) => {
      const o = onizleDetay(d, h);
      return { h, k, v: o ? ilerlemeYuzdesi(o.durum) - i0 : -1 };
    })
    .sort((a, b) => b.v - a.v || a.k - b.k)
    .map((x) => x.h);
}

/** Kazandıran ilk hamle (yoksa null). */
export function kazandiranBul(d: OyunDurumu, s: KazandiranSecenek = {}): Hamle | null {
  if (d.bitti || d.kalanHamle <= 0) return null;
  const butce = { kalan: s.enFazlaDugum ?? 300 };
  const derinlik = Math.max(1, Math.min(2, s.derinlik ?? 2, d.kalanHamle));
  const kok: OyunDurumu = s.durust ? { ...d, rng: botTohumlari(d, s.botTohumu ?? 0).degerlendirme } : d;
  const ara = (x: OyunDurumu, kalan: number): boolean => {
    for (const h of sirali(x)) {
      if (butce.kalan-- <= 0) return false;
      const r = hamleUygula(x, h).durum;
      if (r.bitti === 'kazanc') return true;
      if (kalan > 1 && !r.bitti && ara(r, kalan - 1)) return true;
    }
    return false;
  };
  for (const h of sirali(kok)) {
    if (butce.kalan-- <= 0) return null;
    const r = hamleUygula(kok, h).durum;
    if (r.bitti === 'kazanc') return h;
    if (derinlik > 1 && !r.bitti && ara(r, derinlik - 1)) return h;
  }
  return null;
}
