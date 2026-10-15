/**
 * Bölüm listesi (GDD §15.2) — elle içe aktarım. P2 (bölüm tasarımı) yeni
 * bölümü `veri/bNNN.json` olarak ekler ve buraya bir satır yazar; plan
 * dışındaki bölümler `taslak: true` taşır.
 */
import type { BolumVerisi } from '../core/types';
import b001 from './veri/b001.json';

export const BOLUMLER: readonly BolumVerisi[] = [b001 as unknown as BolumVerisi];

/** Deneme sürümünün son bölümü (Bölüm 20 kazanılınca "Devamı yakında", §12.3). */
export const SON_BOLUM = 20;

export function bolumBul(id: number): BolumVerisi | undefined {
  return BOLUMLER.find((b) => b.id === id);
}
