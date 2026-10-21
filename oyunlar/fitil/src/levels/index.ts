/**
 * Bölüm listesi (GDD §8.3, §10.2). JSON'lar AÇIKÇA içe aktarılır (tek
 * dosya derlemesine gömülsün, §16.8). Henüz tasarlanmamış bölümler
 * `"taslak": true` ile geçerli birer yer tutucudur; bölümü tasarlayan ajan
 * yalnız kendi `veri/*.json` dosyasını değiştirir, bu dosyaya dokunmaz.
 */
import type { BolumVerisi } from '../core/types';
import { bolumMetniUygula } from './metin';
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
import b021 from './veri/b021.json';
import b022 from './veri/b022.json';
import b023 from './veri/b023.json';
import b024 from './veri/b024.json';
import b025 from './veri/b025.json';
import b026 from './veri/b026.json';
import b027 from './veri/b027.json';
import b028 from './veri/b028.json';
import b029 from './veri/b029.json';
import b030 from './veri/b030.json';
import b031 from './veri/b031.json';
import b032 from './veri/b032.json';
import b033 from './veri/b033.json';
import b034 from './veri/b034.json';
import b035 from './veri/b035.json';
import b036 from './veri/b036.json';
import b037 from './veri/b037.json';
import b038 from './veri/b038.json';
import b039 from './veri/b039.json';
import b040 from './veri/b040.json';
import u101 from './veri/u101.json';
import u102 from './veri/u102.json';
import u103 from './veri/u103.json';
import u104 from './veri/u104.json';
import u105 from './veri/u105.json';
import u106 from './veri/u106.json';
import u107 from './veri/u107.json';
import u108 from './veri/u108.json';

// Sayfa İngilizceyse ad, tanıtım ve ipuçları `metin.en.json`'dan (src/levels/metin.ts).
const bv = (v: unknown): BolumVerisi => bolumMetniUygula(v as BolumVerisi);

/** Ana yol: 40 bölüm, id 1..40 (indeks = id − 1). */
export const BOLUMLER: readonly BolumVerisi[] = [
  b001, b002, b003, b004, b005, b006, b007, b008, b009, b010,
  b011, b012, b013, b014, b015, b016, b017, b018, b019, b020,
  b021, b022, b023, b024, b025, b026, b027, b028, b029, b030,
  b031, b032, b033, b034, b035, b036, b037, b038, b039, b040,
].map(bv);

/** Usta Bölümleri U1..U8: id 101..108 (§10.2). */
export const USTA_BOLUMLERI: readonly BolumVerisi[] = [u101, u102, u103, u104, u105, u106, u107, u108].map(bv);

/** Bütün sabit bölümler (ana + Usta). */
export const TUM_BOLUMLER: readonly BolumVerisi[] = [...BOLUMLER, ...USTA_BOLUMLERI];

const SOZLUK = new Map<number, BolumVerisi>(TUM_BOLUMLER.map((v) => [v.id, v]));

/** id ile bölüm (1..40, 101..108); yoksa undefined. */
export function bolumGetir(id: number): BolumVerisi | undefined {
  return SOZLUK.get(id);
}
