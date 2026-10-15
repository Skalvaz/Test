/**
 * Ses gösterisi ve ölçüm için örnek olaylar: her olay türünden bir tane,
 * bilinçli sessizler ayrı. dev/ses.html, `olcum.ts` ve `ses.test.ts` paylaşır.
 */
import type { Olay, OlayTuru } from '../core/types';

const k = (x: number, y: number) => ({ x, y });

export const ORNEK_OLAYLAR: Partial<Record<OlayTuru, Olay>> = {
  karisti: { t: 0, tur: 'karisti', kaynak: k(2, 5), hedef: k(3, 5), a: 1, b: 2, sonuc: 3, yeniId: 99 },
  ozelSuruklendi: { t: 0, tur: 'ozelSuruklendi', kaynak: k(2, 5), hedef: k(3, 5), ozel: 'tarak', tasindi: true },
  temizlendi: { t: 0, tur: 'temizlendi', hucre: k(3, 5), id: 9, renk: 5, ozel: 'yok', neden: 'grup', k: 1, puan: 30 },
  ozelOlustu: { t: 0, tur: 'ozelOlustu', hucre: k(3, 6), damla: { id: 100, renk: 6, ozel: 'tarak', yon: 'yatay' } },
  ozelTetiklendi: { t: 0, tur: 'ozelTetiklendi', hucre: k(3, 6), ozel: 'tarak', yon: 'yatay', alan: [k(0, 6), k(1, 6)] },
  birlesim: { t: 0, tur: 'birlesim', hucre: k(3, 4), kombo: 'tarakGirdap', alan: [k(3, 4)] },
  donustu: { t: 0, tur: 'donustu', hucre: k(1, 1), damla: { id: 5, renk: 3, ozel: 'tarak', yon: 'dikey' } },
  mermerHasar: { t: 0, tur: 'mermerHasar', hucre: k(4, 2), kalan: 0 },
  kagitAlindi: { t: 0, tur: 'kagitAlindi', hucre: k(2, 7), kalan: 0, renk: 3 },
  yagKalkti: { t: 0, tur: 'yagKalkti', hucre: k(5, 3) },
  desenBoyandi: { t: 0, tur: 'desenBoyandi', hucre: k(1, 3), renk: 5 },
  kaskat: { t: 0, tur: 'kaskat', k: 3, kademe: 'nefis' },
  yercekimi: { t: 0, tur: 'yercekimi', dusenler: [{ den: k(2, 3), e: k(2, 5) }], doganlar: [] },
  karistirma: { t: 0, tur: 'karistirma', esleme: [{ den: k(0, 0), e: k(1, 0) }] },
  hedefIlerledi: { t: 0, tur: 'hedefIlerledi', indeks: 0, deger: 5, tamam: false },
  solenBasladi: { t: 0, tur: 'solenBasladi', kalanHamle: 5 },
  bolumBitti: { t: 0, tur: 'bolumBitti', sonuc: 'kazanc' },
};

/** Bilinçli olarak ses üretmeyen olaylar. */
export const SESSIZ_OLAYLAR: Olay[] = [
  { t: 0, tur: 'eslesti', renk: 3, hucreler: [k(0, 0), k(1, 0), k(2, 0)], k: 1, merkez: k(1, 0) },
  { t: 0, tur: 'puanEklendi', miktar: 200, neden: 'ozel', hucre: k(1, 1) },
  { t: 0, tur: 'hamleOzeti', temizlenen: 3, kaskat: 1, eslesme: true, merkez: k(1, 0) },
  { t: 0, tur: 'bolumBitti', sonuc: 'kayip' },
];

/** Aynı türün çeşitleri (özel taşlar, kaskat merdiveni, renkler). */
export const OLAY_CESITLERI: { ad: string; olay: Olay }[] = [
  ...(['girdap', 'lale', 'murekkep'] as const).map((oz) => ({ ad: `özel · ${oz}`, olay: { t: 0, tur: 'ozelTetiklendi', hucre: k(3, 4), ozel: oz, yon: 'yatay', alan: [k(3, 4)] } as Olay })),
  ...[2, 4, 5, 8, 9].map((n) => ({ ad: `kaskat · k=${n}`, olay: { t: 0, tur: 'kaskat', k: n, kademe: n >= 5 ? 'saheser' : 'guzel' } as Olay })),
  ...([3, 5, 6, 7] as const).map((r) => ({ ad: `temizlendi · renk ${r}`, olay: { t: 0, tur: 'temizlendi', hucre: k(r, 4), id: 1, renk: r, ozel: 'yok', neden: r === 7 ? 'murekkep' : 'grup', k: 1, puan: 30 } as Olay })),
  { ad: 'karışım · Mürekkep (Mor + Sarı)', olay: { t: 0, tur: 'karisti', kaynak: k(2, 5), hedef: k(3, 5), a: 5, b: 2, sonuc: 7, yeniId: 98 } },
  { ad: 'hedef tamam', olay: { t: 0, tur: 'hedefIlerledi', indeks: 0, deger: 10, tamam: true } },
];

/** Bir eşleşme hamlesinin olay dizisi (karışım → toplanma → üç koparma → düşme), ms. */
export function hamleGosterisi(): Olay[] {
  return [
    { t: 0, tur: 'karisti', kaynak: k(3, 5), hedef: k(2, 5), a: 1, b: 2, sonuc: 3, yeniId: 50 },
    { t: 220, tur: 'yercekimi', dusenler: [{ den: k(3, 4), e: k(3, 5) }], doganlar: [] },
    { t: 520, tur: 'eslesti', renk: 3, hucreler: [k(0, 5), k(1, 5), k(2, 5)], k: 1, merkez: k(1, 5) },
    { t: 640, tur: 'temizlendi', hucre: k(0, 5), id: 1, renk: 3, ozel: 'yok', neden: 'grup', k: 1, puan: 30 },
    { t: 640, tur: 'temizlendi', hucre: k(1, 5), id: 2, renk: 3, ozel: 'yok', neden: 'grup', k: 1, puan: 30 },
    { t: 640, tur: 'temizlendi', hucre: k(2, 5), id: 50, renk: 3, ozel: 'yok', neden: 'grup', k: 1, puan: 30 },
    { t: 640, tur: 'hedefIlerledi', indeks: 0, deger: 3, tamam: false },
    { t: 890, tur: 'yercekimi', dusenler: [{ den: k(0, 4), e: k(0, 5) }], doganlar: [{ hucre: k(0, 0), damla: { id: 60, renk: 1, ozel: 'yok', yon: 'yatay' }, sanalY: -1 }] },
    { t: 1190, tur: 'kaskat', k: 2, kademe: 'guzel' },
    { t: 1190, tur: 'eslesti', renk: 6, hucreler: [k(4, 3), k(4, 4), k(4, 5), k(4, 6)], k: 2, merkez: k(4, 4) },
    { t: 1310, tur: 'temizlendi', hucre: k(4, 3), id: 7, renk: 6, ozel: 'yok', neden: 'grup', k: 2, puan: 60 },
    { t: 1310, tur: 'temizlendi', hucre: k(4, 4), id: 8, renk: 6, ozel: 'yok', neden: 'grup', k: 2, puan: 60 },
    { t: 1310, tur: 'temizlendi', hucre: k(4, 6), id: 10, renk: 6, ozel: 'yok', neden: 'grup', k: 2, puan: 60 },
    { t: 1310, tur: 'ozelOlustu', hucre: k(4, 5), damla: { id: 70, renk: 6, ozel: 'tarak', yon: 'dikey' } },
    { t: 1560, tur: 'hamleOzeti', temizlenen: 7, kaskat: 2, eslesme: true, merkez: k(2, 5) },
  ];
}
