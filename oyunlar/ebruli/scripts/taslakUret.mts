/**
 * Taslak bölümler (GDD §15.2) — P2 gelene kadar uygulamanın oynanabilir
 * içeriği. `taslak: true`; P2 bölüm tasarımcısı JSON'ların yerine kendi
 * dosyalarını koyar.
 *   npx tsx <bu dosya> <proje-kökü>
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KOK = process.argv[2];
const { bolumDogrula } = await import(join(KOK, 'src/levels/dogrulayici.ts'));

type V = Record<string, unknown>;
const D3 = [20, 20, 20, 11, 11, 11];
const DS = [30, 0, 30, 8, 16, 8];
const bant: Record<string, [[number, number], number]> = {
  ogretim: [[98, 100], 95],
  tanitim: [[92, 100], 40],
  normal: [[85, 100], 25],
  zor: [[60, 85], 10],
  rahatlama: [[95, 100], 60],
};
const bos = (w: number, h: number): string[] => Array.from({ length: h }, () => Array(w).fill('.').join(' '));
function duzen(w: number, h: number, sabit: Record<string, string>): string[] {
  const s = bos(w, h).map((r) => r.split(' '));
  for (const [k, v] of Object.entries(sabit)) {
    const [x, y] = k.split(',').map(Number);
    s[y][x] = v;
  }
  return s.map((r) => r.join(' '));
}
const kutu = (x0: number, y0: number, x1: number, y1: number, kat: 1 | 2): [number, number, 1 | 2][] => {
  const l: [number, number, 1 | 2][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) l.push([x, y, kat]);
  return l;
};

function b(id: number, ad: string, atolye: string, tur: string, w: number, h: number, hamle: number, ek: V): V {
  const [bb, aa] = bant[tur];
  return {
    id,
    ad,
    atolye,
    tur,
    w,
    h,
    hamle,
    tohum: 1000 + id,
    dogum: D3,
    garanti: tur === 'ogretim' ? 3 : tur === 'zor' ? 1 : 2,
    murekkep: id >= 11,
    hedefler: [],
    duzen: bos(w, h),
    botBandi: bb,
    acemiAlt: aa,
    yildizEsikleri: [3000, 4500],
    taslak: true,
    ...ek,
  };
}

const L: V[] = [
  b(2, 'Renk Çarkı', 'uskudar', 'ogretim', 6, 7, 15, {
    hedefler: [
      { tur: 'topla', renk: 5, adet: 6 },
      { tur: 'topla', renk: 6, adet: 6 },
    ],
    duzen: duzen(6, 7, { '4,5': '6', '5,5': '4', '0,6': '5', '1,6': '5', '2,6': '4', '3,6': '1', '4,6': '6', '5,6': '2' }),
    zorunluIlkHamle: { kaynak: [3, 6], hedef: [2, 6] },
    ipuclari: [
      { tetik: 'baslangic', metin: 'Mavi geldi: üç tarif, üç renk.', el: [[3, 6], [2, 6]] },
      { tetik: 'ilkHamleSonrasi', metin: 'Yeşil = Sarı + Mavi.', el: [[5, 5], [5, 6]] },
      { tetik: 'bosta5sn', metin: 'Parlayan damlayı komşusuna sürükle.' },
    ],
    sonrakiTanitim: 'Sıradaki: Tarak!',
    yildizEsikleri: [2400, 3600],
    elleEsik: true,
  }),
  b(3, 'Tarak', 'uskudar', 'ogretim', 6, 8, 16, {
    hedefler: [{ tur: 'topla', renk: 5, adet: 12 }],
    duzen: duzen(6, 8, { '2,6': '1', '0,7': '5', '1,7': '5', '2,7': '4', '3,7': '5' }),
    zorunluIlkHamle: { kaynak: [2, 6], hedef: [2, 7] },
    ipuclari: [
      { tetik: 'baslangic', metin: 'Dört damla: TARAK doğar.', el: [[2, 6], [2, 7]] },
      { tetik: 'ilkHamleSonrasi', metin: 'Boşalan yere üstteki kayar.' },
      { tetik: 'ozelOlusunca', metin: 'Tarağı bir komşuya sürükle.' },
      { tetik: 'bosta5sn', metin: 'Parlayan damlayı komşusuna sürükle.' },
    ],
    sonrakiTanitim: 'Sıradaki: Kâğıda al!',
    yildizEsikleri: [2600, 3800],
    elleEsik: true,
  }),
  b(4, 'Kâğıda Al', 'uskudar', 'tanitim', 7, 8, 24, {
    hedefler: [{ tur: 'kagit' }],
    zemin: { kagit: kutu(2, 3, 5, 5, 1) },
    ipuclari: [{ tetik: 'baslangic', metin: 'Kâğıdın üstünde eşleştir, boya kâğıda geçsin.' }],
    sonrakiTanitim: 'Sıradaki: Girdap!',
  }),
  b(5, 'Girdap', 'uskudar', 'tanitim', 7, 9, 18, {
    hedefler: [{ tur: 'topla', renk: 6, adet: 14 }],
    duzen: duzen(7, 9, { '1,8': '6', '2,8': '6', '3,8': '2', '4,8': '6', '5,8': '6', '3,7': '4' }),
    ipuclari: [{ tetik: 'baslangic', metin: 'Beş damla: GİRDAP. Çevresini yutar.', el: [[3, 7], [3, 8]] }],
    sonrakiTanitim: 'Sıradaki: İki kat kâğıt!',
  }),
  b(6, 'İki Kat', 'uskudar', 'zor', 7, 9, 28, {
    hedefler: [{ tur: 'kagit' }],
    zemin: { kagit: kutu(1, 7, 4, 8, 2) },
    sonrakiTanitim: 'Sıradaki: Lale!',
  }),
  b(7, 'Lale', 'uskudar', 'rahatlama', 7, 9, 18, {
    hedefler: [
      { tur: 'topla', renk: 3, adet: 14 },
      { tur: 'puan', puan: 3000 },
    ],
    duzen: duzen(7, 9, { '0,8': '3', '1,8': '3', '2,8': '1', '3,8': '3', '4,8': '3', '5,8': '5', '2,7': '2', '2,6': '3' }),
    ozeller: [{ x: 5, y: 8, ozel: 'tarak', renk: 5, yon: 'dikey' }],
    ipuclari: [
      { tetik: 'baslangic', metin: 'Altı damla: LALE. Bir rengin hepsini alır.', el: [[2, 7], [2, 8]] },
      { tetik: 'ozelOlusunca', metin: 'İki özel taşı birbirine sürükle!' },
    ],
    sonrakiTanitim: 'Sıradaki: Mermer!',
  }),
  b(8, 'Mermer', 'uskudar', 'tanitim', 7, 9, 28, {
    hedefler: [{ tur: 'kagit' }],
    duzen: duzen(7, 9, { '0,5': 'X1', '1,5': 'X1', '2,5': 'X1', '3,5': 'X1', '4,5': 'X1', '5,5': 'X1', '6,5': 'X1' }),
    zemin: { kagit: kutu(1, 7, 5, 8, 1) },
    ipuclari: [{ tetik: 'baslangic', metin: 'Mermer yanındaki eşleşmeyle çatlar.' }],
    sonrakiTanitim: 'Sıradaki: Lale deseni!',
  }),
  b(9, 'Lale Deseni', 'uskudar', 'tanitim', 7, 9, 32, {
    hedefler: [{ tur: 'desen', motif: 'lale' }],
    zemin: {
      desen: {
        motif: 'lale',
        hucreler: [[2, 4, 5], [3, 4, 5], [4, 4, 5], [3, 5, 6], [3, 6, 6]],
      },
    },
    ipuclari: [{ tetik: 'baslangic', metin: 'Her desen hücresi kendi rengini ister.' }],
    sonrakiTanitim: 'Sıradaki: Üsküdar finali!',
  }),
  b(10, 'Üsküdar Lalesi', 'uskudar', 'zor', 7, 9, 38, {
    hedefler: [{ tur: 'desen', motif: 'lale' }, { tur: 'kagit' }],
    duzen: duzen(7, 9, { '1,6': 'X2', '5,6': 'X2' }),
    zemin: {
      desen: {
        motif: 'lale',
        hucreler: [[2, 3, 5], [4, 3, 5], [2, 4, 5], [3, 4, 5], [4, 4, 5], [3, 5, 6], [3, 6, 6]],
      },
      kagit: [...kutu(0, 8, 6, 8, 1), [3, 7, 1]],
    },
    sonrakiTanitim: 'Sıradaki: Bursa!',
  }),
  b(11, 'Kara Mürekkep', 'bursa', 'tanitim', 7, 9, 26, {
    hedefler: [{ tur: 'kagit' }],
    duzen: duzen(7, 9, { '0,8': '3', '1,8': '4', '5,8': '7' }),
    zemin: { kagit: kutu(1, 6, 4, 8, 1) },
    ipuclari: [
      { tetik: 'baslangic', metin: 'Üç renk bir olunca: Mürekkep.', el: [[1, 8], [0, 8]] },
      { tetik: 'ilkHamleSonrasi', metin: 'Yanında eşleşme olunca patlar.' },
    ],
    sonrakiTanitim: 'Sıradaki: İpek yolu!',
  }),
  b(12, 'İpek Yolu', 'bursa', 'normal', 7, 9, 28, {
    hedefler: [{ tur: 'topla', renk: 3, adet: 15 }, { tur: 'kagit' }],
    zemin: { kagit: kutu(1, 7, 5, 8, 1) },
    sonrakiTanitim: 'Sıradaki: Yağ lekesi!',
  }),
  b(13, 'Yağ Lekesi', 'bursa', 'tanitim', 7, 9, 20, {
    hedefler: [{ tur: 'topla', renk: 6, adet: 15 }],
    zemin: {
      yag: [
        [2, 4],
        [3, 4],
        [4, 4],
        [2, 5],
        [3, 5],
        [4, 5],
        [3, 3],
        [3, 6],
      ],
    },
    ipuclari: [{ tetik: 'baslangic', metin: 'Yağlı damla karışmaz. Üstünü temizle.' }],
    sonrakiTanitim: 'Sıradaki: Sabun hanı!',
  }),
  b(14, 'Sabun Hanı', 'bursa', 'normal', 7, 9, 26, {
    hedefler: [{ tur: 'kagit' }],
    zemin: {
      kagit: [...kutu(2, 5, 4, 6, 1), ...kutu(1, 8, 4, 8, 1)],
      yag: [
        [2, 5],
        [3, 5],
        [4, 5],
        [2, 6],
        [3, 6],
        [4, 6],
      ],
    },
    sonrakiTanitim: 'Sıradaki: Koza!',
  }),
  b(15, 'Koza', 'bursa', 'zor', 7, 9, 30, {
    hedefler: [{ tur: 'kagit' }],
    duzen: duzen(7, 9, { '0,4': 'X2', '6,4': 'X2', '2,2': 'X2', '4,2': 'X2' }),
    zemin: {
      kagit: kutu(1, 6, 4, 8, 2),
      yag: [
        [2, 6],
        [3, 6],
        [5, 7],
        [5, 8],
        [0, 7],
        [0, 8],
      ],
    },
    sonrakiTanitim: 'Sıradaki: Sarı yağmıyor!',
  }),
  b(16, 'Sarı Yağmıyor', 'bursa', 'rahatlama', 7, 9, 20, {
    dogum: DS,
    hedefler: [{ tur: 'topla', renk: 5, adet: 18 }],
    ipuclari: [{ tetik: 'baslangic', metin: 'Sarı yağmıyor. Elindekini iyi kullan.' }],
    sonrakiTanitim: 'Sıradaki: Karanfil!',
  }),
  b(17, 'Karanfil', 'bursa', 'normal', 7, 9, 36, {
    hedefler: [{ tur: 'desen', motif: 'karanfil' }],
    duzen: duzen(7, 9, { '0,8': 'X1', '6,8': 'X1', '3,0': 'X1' }),
    zemin: {
      desen: {
        motif: 'karanfil',
        hucreler: [[2, 4, 3], [3, 4, 3], [4, 4, 3], [3, 5, 6], [3, 6, 6], [2, 6, 6]],
      },
    },
    sonrakiTanitim: 'Sıradaki: Usta işi!',
  }),
  b(18, 'Usta İşi', 'bursa', 'normal', 7, 9, 22, {
    hedefler: [
      { tur: 'topla', renk: 5, adet: 12 },
      { tur: 'topla', renk: 6, adet: 12 },
    ],
    duzen: duzen(7, 9, { '1,4': 'X1', '5,4': 'X1', '0,6': 'X1', '6,6': 'X1', '2,8': '5', '4,8': '6' }),
    ozeller: [
      { x: 2, y: 8, ozel: 'tarak', renk: 5, yon: 'yatay' },
      { x: 4, y: 8, ozel: 'girdap', renk: 6 },
    ],
    sonrakiTanitim: 'Sıradaki: Şal!',
  }),
  b(19, 'Şal', 'bursa', 'normal', 7, 9, 28, {
    hedefler: [{ tur: 'kagit' }],
    zemin: { kagit: kutu(1, 4, 5, 7, 1) },
    sonrakiTanitim: 'Sıradaki: Bursa finali!',
  }),
  b(20, 'Bursa Karanfili', 'bursa', 'zor', 7, 9, 40, {
    hedefler: [{ tur: 'desen', motif: 'karanfil' }, { tur: 'kagit' }],
    duzen: duzen(7, 9, { '0,5': 'X2', '6,5': 'X2', '3,8': 'X2' }),
    zemin: {
      desen: {
        motif: 'karanfil',
        hucreler: [[2, 3, 3], [3, 3, 3], [4, 3, 3], [3, 4, 3], [3, 5, 6], [3, 6, 6], [2, 6, 6], [4, 6, 6]],
      },
      kagit: [...kutu(0, 7, 2, 7, 1), ...kutu(4, 7, 6, 7, 1), [1, 8, 1], [5, 8, 1]],
      yag: [
        [1, 4],
        [5, 4],
        [1, 6],
        [5, 6],
      ],
    },
    sonrakiTanitim: 'Devamı yakında!',
  }),
];

let hata = 0;
for (const v of L) {
  const u: string[] = [];
  const h = bolumDogrula(v, u);
  const ad = `b${String(v.id).padStart(3, '0')}`;
  if (h.length) {
    hata++;
    console.log(`${ad} HATA: ${h.join(' | ')}`);
    continue;
  }
  if (u.length) console.log(`${ad} uyarı: ${u.join(' | ')}`);
  const yol = join(KOK, 'src/levels/veri', `${ad}.json`);
  if (existsSync(yol) && !process.argv.includes('--uzerine')) {
    console.log(`${ad} var, atlandı`);
    continue;
  }
  writeFileSync(yol, JSON.stringify(v, null, 2) + '\n');
  console.log(`${ad} yazıldı`);
}
process.exit(hata ? 1 : 0);
