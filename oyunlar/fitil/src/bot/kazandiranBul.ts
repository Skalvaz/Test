/**
 * "Bu çizgi kazandırırdı" (GDD §11 kanca 12, §14 Kaybettin ekranı, K14):
 * kayıptan önceki son durumda (son hamleden önce) kazandıran bir fitil yolu
 * arar. Sınırlı bütçe: adaylar (adaylar.ts) ucuz puana göre sıralanır, en
 * fazla `butce` tanesi tam `hamleUygula` ile çözülür; ilk kazandıran döner.
 *
 * Botun dürüst değerlendirmesinin tersine burada GERÇEK durum (gerçek RNG)
 * kullanılır: gösterilen çizgi, o anki dolum akışıyla gerçekten kazandırırdı
 * (oyun bittiği için bilgi sızıntısı yoktur). Körük ve güçlendiriciler
 * denenmez; hayalet fitil yalnız yol gösterir (§14).
 *
 * Tarayıcıda Worker içinde ya da zaman dilimli çalışsın diye `kazandiranAra`
 * üretici fonksiyondur: her tam çözümden sonra `yield` eder.
 */
import { hamleUygula } from '../core/index';
import type { Konum, OyunDurumu } from '../core/index';
import { adaylariUret, enIyiler, tahtaBilgi, ucuzBaglam, ucuzPuanla } from './adaylar';
import { botTohumlari, fitilHamlesi } from './ortak';

export interface KazandiranSecenek {
  /** En fazla tam çözüm (varsayılan 300). */
  butce?: number;
  /** Aday sıralaması için bot tohumu (varsayılan 0). */
  tohum?: number;
}

export interface KazandiranYol {
  yol: Konum[];
  halka: boolean;
}

export function* kazandiranAra(d: OyunDurumu, s: KazandiranSecenek = {}): Generator<number, KazandiranYol | null, void> {
  if (d.bitti || d.kalanHamle <= 0) return null;
  const butce = s.butce ?? 300;
  const b = tahtaBilgi(d);
  const adaylar = adaylariUret(b, botTohumlari(d, s.tohum ?? 0).siralama);
  ucuzPuanla(ucuzBaglam(b), adaylar);
  const sirali = enIyiler(adaylar, Math.min(butce, adaylar.length));
  let n = 0;
  for (const a of sirali) {
    const h = fitilHamlesi(d.w, a.yol, a.halka);
    let sonuc;
    try {
      sonuc = hamleUygula(d, h);
    } catch {
      continue;
    }
    n++;
    if (sonuc.durum.bitti === 'kazanc') return { yol: h.tur === 'fitil' ? h.yol : [], halka: a.halka };
    yield n;
  }
  return null;
}

/** Eşzamanlı sürüm (Worker ya da Node). */
export function kazandiranBul(d: OyunDurumu, s: KazandiranSecenek = {}): KazandiranYol | null {
  const g = kazandiranAra(d, s);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}
