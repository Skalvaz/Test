/**
 * Dev ve test için örnek bölümler (gerçek bölüm verisi P2'de): bütün
 * öğeleri (özel taşlar, kâğıt, mermer, yağ, desen, delik) tek teknede
 * gösteren "vitrin" ve sade bir 7×9.
 */
import type { BolumVerisi } from '../../core/types';

const temel = {
  botBandi: [85, 100] as [number, number],
  acemiAlt: 25,
  yildizEsikleri: [2000, 3000] as [number, number],
  taslak: true,
};

export const VITRIN: BolumVerisi = {
  ...temel,
  id: 901,
  ad: 'Vitrin',
  atolye: 'uskudar',
  tur: 'normal',
  w: 7,
  h: 9,
  hamle: 30,
  tohum: 4242,
  dogum: [20, 20, 20, 11, 11, 11],
  garanti: 2,
  murekkep: true,
  hedefler: [
    { tur: 'topla', renk: 5, adet: 20 },
    { tur: 'kagit' },
  ],
  duzen: [
    '. . . . . . .',
    '. . . . . . .',
    '. . X2 . X1 . .',
    '. . . . . . .',
    '. . . 7 . . .',
    '. . 1 . . . .',
    '5 5 4 5 . . .',
    '. . . . . 3 .',
    '# . . . . . #',
  ],
  ozeller: [
    { x: 0, y: 7, ozel: 'tarak', renk: 6, yon: 'yatay' },
    { x: 1, y: 7, ozel: 'girdap', renk: 3 },
    { x: 6, y: 6, ozel: 'lale' },
    { x: 5, y: 5, ozel: 'tarak', renk: 5, yon: 'dikey' },
  ],
  zemin: {
    kagit: [
      [1, 6, 1],
      [2, 6, 2],
      [3, 6, 1],
      [2, 7, 1],
      [3, 7, 2],
      [4, 7, 1],
    ],
    yag: [
      [5, 3],
      [6, 3],
    ],
    desen: {
      motif: 'lale',
      hucreler: [
        [1, 3, 5],
        [2, 3, 5],
        [1, 4, 5],
        [1, 5, 6],
      ],
    },
  },
};

export const SADE: BolumVerisi = {
  ...temel,
  id: 902,
  ad: 'Sade',
  atolye: 'bursa',
  tur: 'normal',
  w: 7,
  h: 9,
  hamle: 25,
  tohum: 777,
  dogum: [20, 20, 20, 11, 11, 11],
  garanti: 2,
  murekkep: false,
  hedefler: [
    { tur: 'topla', renk: 3, adet: 15 },
    { tur: 'topla', renk: 6, adet: 15 },
  ],
  duzen: Array.from({ length: 9 }, () => '. . . . . . .'),
};
