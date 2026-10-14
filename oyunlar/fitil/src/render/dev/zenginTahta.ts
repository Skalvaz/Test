/**
 * Geliştirme sayfası için elle kurulmuş zengin tahta: her içerik türü
 * (kapsül, ıslak, fener, kaya 1–3, kova 1–2, dev fişek, is, kafes), ısılar
 * (0–3, kızgın), özel taşlar (roket ↔ ve ↗, kasımpatı, yıldız topu), zemin
 * (döşeme 1–2 kat, desen hücreleri, barut izi) ve delikler.
 *
 * "buyuk" senaryosu için yerleşim: alt sırada 5 kızıl fitil yolu; üstünde
 * kızgın kapsüller → ısı zinciri → ısıyla tutuşan roket (satır 4) →
 * kasımpatı → yerçekimi.
 */
import type { BolumVerisi, Konum } from '../../core/types';

export const ZENGIN: BolumVerisi = {
  id: 9001,
  ad: 'Atölye Tezgâhı',
  mahalle: 1,
  tur: 'normal',
  w: 7,
  h: 9,
  renkSayisi: 5,
  esik: 4,
  hamle: 20,
  tohum: 424242,
  yardim: 0,
  ozelEsikleri: [6, 9, 12],
  hedefler: [{ tur: 'topla', renk: 0, adet: 30 }, { tur: 'kafes' }, { tur: 'aydinlat' }],
  duzen: [
    'K3 . . D . S1 .',
    '. S . . . C .',
    '. . . I . . F',
    'W . . . . . K1',
    '. . . . . . .',
    '. . . . C . .',
    '. . . . . . .',
    '# . . . . K2 #',
    '# . . . . . #',
  ],
  sabitKapsuller: [
    // Fitil yolu (kızıl) — satır 6
    { x: 0, y: 6, renk: 0 },
    { x: 1, y: 6, renk: 0 },
    { x: 2, y: 6, renk: 0 },
    { x: 3, y: 6, renk: 0 },
    { x: 4, y: 6, renk: 0 },
    { x: 5, y: 6, renk: 0 },
    // Isı zinciri — satır 5
    { x: 0, y: 5, renk: 2, isi: 1 },
    { x: 1, y: 5, renk: 1, isi: 3 },
    { x: 2, y: 5, renk: 3, isi: 2 },
    { x: 3, y: 5, renk: 4, isi: 3 },
    { x: 4, y: 5, renk: 2, isi: 2 },
    { x: 5, y: 5, renk: 1 },
    { x: 6, y: 5, renk: 3, isi: 1 },
    // Roket (yatay, kızgın) ve kasımpatı — satır 4
    { x: 0, y: 4, renk: 4 },
    { x: 1, y: 4, renk: 3, isi: 1 },
    { x: 2, y: 4, renk: 2, ozel: 'roket', eksen: 0, isi: 3 },
    { x: 3, y: 4, renk: 1 },
    { x: 4, y: 4, renk: 4, isi: 2 },
    { x: 5, y: 4, renk: 1, ozel: 'kasimpati' },
    { x: 6, y: 4, renk: 2 },
    // Diğer özel taşlar
    { x: 3, y: 7, renk: -1, ozel: 'yildiz' },
    { x: 5, y: 8, renk: 3, ozel: 'roket', eksen: 2 },
    { x: 4, y: 2, renk: 5 },
    { x: 1, y: 7, renk: 5, isi: 2 },
    { x: 2, y: 8, renk: 1, isi: 1 },
  ],
  zemin: {
    dosemeler: [
      [1, 8, 2],
      [2, 8, 2],
      [3, 8, 1],
      [4, 8, 1],
      [1, 7, 1],
      [2, 7, 1],
      [4, 7, 2],
      [0, 6, 1],
      [1, 6, 1],
    ],
    desen: {
      motif: 'lale',
      hucreler: [
        [2, 1, 4],
        [3, 1, 4],
        [4, 1, 4],
        [2, 2, 3],
        [4, 3, 2],
      ],
    },
    barutIzleri: [
      [
        [1, 3],
        [2, 3],
        [3, 4],
        [4, 3],
        [5, 3],
      ],
    ],
  },
  botBandi: [65, 85],
  yildizEsikleri: [3000, 5000],
};

/** "buyuk" senaryosunun fitil yolu (5 kızıl, satır 6). */
export const BUYUK_YOL: Konum[] = [
  { x: 0, y: 6 },
  { x: 1, y: 6 },
  { x: 2, y: 6 },
  { x: 3, y: 6 },
  { x: 4, y: 6 },
];

/** Çizim önizlemesi: 6 kızıl düğüm (roket hayaleti). */
export const ONIZLEME_YOL: Konum[] = [
  { x: 0, y: 6 },
  { x: 1, y: 6 },
  { x: 2, y: 6 },
  { x: 3, y: 6 },
  { x: 4, y: 6 },
  { x: 5, y: 6 },
];
