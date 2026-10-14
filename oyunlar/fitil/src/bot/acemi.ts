/**
 * Acemi botu (GDD §16.5): adaylar arasından uzunluk² ağırlığıyla rastgele
 * seçer; %20 olasılıkla rastgele 3–4'lük bir yol seçer; Körük'ü dolar
 * dolmaz rastgele bir merkeze kullanır. Bütün rastgelelik bot RNG'sinden
 * (durum karması ^ bot tohumu), gerçek dolum akışını görmez.
 *
 * Çift dokunuş: özel taşlar 3 uzunluklu yol ağırlığıyla (9) aday sayılır
 * (§16.5'te Acemi için belirtilmemiş; P4a yorumu).
 */
import { rngInt } from '../core/index';
import type { Hamle, Konum, OyunDurumu } from '../core/index';
import { adaylariUret, tahtaBilgi } from './adaylar';
import { botTohumlari, fitilHamlesi, korukDolu, ozelTaslar, type BotSecenek } from './ortak';

/**
 * Boşta ipucu (§15): "Acemi botun en iyi adayı" — Acemi'nin ağırlığı
 * uzunluk² olduğundan en uzun aday (eşitlikte üretim sırası), halka değil.
 * Aday yoksa null (yalnız özel taş varsa uygulama çift dokunuş gösterebilir).
 */
export function acemiEnIyiAday(d: OyunDurumu, botTohumu = 0, izin: BotSecenek['izin'] = null): Konum[] | null {
  const b = tahtaBilgi(d, izin ?? null);
  const adaylar = adaylariUret(b, botTohumlari(d, botTohumu).siralama);
  let en: number[] | null = null;
  for (const a of adaylar) if (!a.halka && (!en || a.yol.length > en.length)) en = a.yol;
  return en ? en.map((i) => ({ x: i % d.w, y: Math.floor(i / d.w) })) : null;
}

export function acemiSec(d: OyunDurumu, botTohumu: number, s: BotSecenek = {}): Hamle {
  const t = botTohumlari(d, botTohumu);
  const r = t.siralama;
  if (korukDolu(d)) {
    const hucreler: number[] = [];
    for (let i = 0; i < d.hucreler.length; i++) if (!d.hucreler[i].delik) hucreler.push(i);
    const i = hucreler[rngInt(r, hucreler.length)];
    return { tur: 'koruk', merkez: { x: i % d.w, y: Math.floor(i / d.w) } };
  }
  const b = tahtaBilgi(d, s.izin ?? null);
  const adaylar = adaylariUret(b, r, s.adaySiniri);
  const ozeller = ozelTaslar(b);
  if (adaylar.length === 0 && ozeller.length === 0) {
    if (s.izin) return acemiSec(d, botTohumu, { ...s, izin: null });
    throw new Error(`acemi: geçerli hamle bulunamadı (bölüm ${d.bolumId})`);
  }
  if (adaylar.length > 0 && rngInt(r, 100) < 20) {
    const kisa = adaylar.filter((a) => a.yol.length <= 4);
    if (kisa.length > 0) {
      const a = kisa[rngInt(r, kisa.length)];
      return fitilHamlesi(d.w, a.yol, a.halka);
    }
  }
  let toplam = 0;
  for (const a of adaylar) toplam += a.yol.length * a.yol.length;
  toplam += 9 * ozeller.length;
  let k = rngInt(r, toplam);
  for (const a of adaylar) {
    k -= a.yol.length * a.yol.length;
    if (k < 0) return fitilHamlesi(d.w, a.yol, a.halka);
  }
  const i = ozeller[Math.min(ozeller.length - 1, Math.floor(Math.max(0, k) / 9))];
  return { tur: 'ciftDokunus', hucre: { x: i % d.w, y: Math.floor(i / d.w) } };
}
