/**
 * Bölüm listesi (GDD §15.2) — elle içe aktarım; sıra = oyun sırası.
 *
 * Deneme sürümü 20 bölümdür: Üsküdar 1–10, Bursa 11–20. Bölüm tasarımcısı
 * (P2) yalnız `veri/bNNN.json` dosyalarını değiştirir; bu liste ve dosya
 * adları sabittir. Henüz ayarlanmamış bölüm `"taslak": true` taşır (statik
 * doğrulamadan geçer, bot bantları denetlenmez; GDD §15.2 planına göre
 * oynanabilir bir ilk sürümdür).
 */
import type { BolumVerisi } from '../core/types';
import b001 from './veri/b001.json';
import b002 from './veri/b002.json';
import b003 from './veri/b003.json';
import b004 from './veri/b004.json';
import b005 from './veri/b005.json';
import b006 from './veri/b006.json';
import b007 from './veri/b007.json';
import b008 from './veri/b008.json';
import b009 from './veri/b009.json';
import b010 from './veri/b010.json';
import b011 from './veri/b011.json';
import b012 from './veri/b012.json';
import b013 from './veri/b013.json';
import b014 from './veri/b014.json';
import b015 from './veri/b015.json';
import b016 from './veri/b016.json';
import b017 from './veri/b017.json';
import b018 from './veri/b018.json';
import b019 from './veri/b019.json';
import b020 from './veri/b020.json';

export const BOLUMLER: readonly BolumVerisi[] = [
  b001,
  b002,
  b003,
  b004,
  b005,
  b006,
  b007,
  b008,
  b009,
  b010,
  b011,
  b012,
  b013,
  b014,
  b015,
  b016,
  b017,
  b018,
  b019,
  b020,
] as unknown as BolumVerisi[];

/** Deneme sürümünün son bölümü (Bölüm 20 kazanılınca "Devamı yakında", §12.3). */
export const SON_BOLUM = 20;

export function bolumBul(id: number): BolumVerisi | undefined {
  return BOLUMLER.find((b) => b.id === id);
}
