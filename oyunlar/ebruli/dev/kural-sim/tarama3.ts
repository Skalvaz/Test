/** Tarama 3: konsept kuralı + akıllı yardım (garanti) + karışık oranı. */
import type { Ayar } from './model';
import { rapor, topla } from './kos';
const N = Number(process.argv[2] ?? 100);
const kip = process.argv[3] ?? 'a';
function dogum(k: number, hamlar = [1, 1, 1], kar = [1, 1, 1]) {
  const h = Math.round((1000 * (1 - k)) / hamlar.filter(Boolean).length);
  const m = Math.round((1000 * k) / kar.filter(Boolean).length);
  return [...hamlar.map((x) => (x ? h : 0)), ...kar.map((x) => (x ? m : 0))];
}
const botlar = ['acemi', 'acgozlu'] as const;
if (kip === 'a') {
  for (const mrk of [true, false])
    for (const kar of [0.35, 0.45])
      for (const g of [0, 2, 3]) {
        const ay: Ayar = { w: 7, h: 9, dogum: dogum(kar), murekkepKarisim: mrk, yardim: 0, garanti: g };
        for (const b of botlar) console.log(rapor(`R3 mrk=${+mrk} kar=${kar} gar=${g} ${b}`, topla(ay, b, N)));
      }
}
if (kip === 'b') {
  for (const kar of [0.25, 0.35])
    for (const g of [0, 2, 3]) {
      const ay: Ayar = { w: 7, h: 9, dogum: dogum(kar, [1, 1, 0], [1, 0, 0]), murekkepKarisim: true, yardim: 0, garanti: g };
      for (const b of botlar) console.log(rapor(`R3-KS kar=${kar} gar=${g} ${b}`, topla(ay, b, N)));
    }
}
