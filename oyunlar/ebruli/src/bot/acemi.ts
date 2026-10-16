/**
 * Acemi botu (GDD §14.2): gündelik oyuncu vekili — önizlemeyi gören,
 * hedefe bakmayan oyuncu (amaca kör). Bütün zarlar botun kendi RNG'sinden.
 *  1. Tahtada özel taş varsa %50 olasılıkla özel taşa dokunan rastgele bir
 *     hamle.
 *  2. Değilse, hazır (olumlu) hamle varsa %70 olasılıkla onlardan biri
 *     (tekdüze).
 *  3. Değilse rastgele geçerli hamle.
 * Usta'nın Eli'ni kullanmaz.
 */
import { gecerliHamleler, hazirHamleler, rngInt } from '../core/index';
import type { Hamle, OyunDurumu } from '../core/index';
import { botTohumlari, ozelHamleMi, type BotSecenek } from './ortak';

export function acemiSec(d: OyunDurumu, botTohumu: number, s: BotSecenek = {}): Hamle {
  if (s.izin) return s.izin;
  const r = botTohumlari(d, botTohumu).secim;
  const tum = gecerliHamleler(d);
  if (tum.length === 0) throw new Error(`acemi: geçerli hamle yok (bölüm ${d.bolumId}, hamle ${d.hamleNo})`);
  const ozelli = tum.filter((h) => ozelHamleMi(d, h));
  if (ozelli.length && rngInt(r, 100) < 50) return ozelli[rngInt(r, ozelli.length)];
  const hazir = hazirHamleler(d);
  if (hazir.length && rngInt(r, 100) < 70) {
    const m = hazir[rngInt(r, hazir.length)];
    return { tur: 'surukle', kaynak: { x: m.k % d.w, y: Math.floor(m.k / d.w) }, hedef: { x: m.e % d.w, y: Math.floor(m.e / d.w) } };
  }
  return tum[rngInt(r, tum.length)];
}
