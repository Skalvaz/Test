/** Tarama 2: sadeleştirme adayları. */
import type { Ayar } from './model';
import { rapor, topla } from './kos';

const N = Number(process.argv[2] ?? 120);
const kip = process.argv[3] ?? 'a';

function dogum(karisikOran: number, hamlar = [1, 1, 1], karisiklar = [1, 1, 1]): number[] {
  const ham = Math.round((1000 * (1 - karisikOran)) / hamlar.filter(Boolean).length);
  const kar = karisiklar.filter(Boolean).length ? Math.round((1000 * karisikOran) / karisiklar.filter(Boolean).length) : 0;
  return [...hamlar.map((x) => (x ? ham : 0)), ...karisiklar.map((x) => (x ? kar : 0))];
}

const botlar = ['rastgele', 'acemi', 'acgozlu'] as const;
function kos(ad: string, ay: Ayar) {
  for (const bot of botlar) console.log(rapor(`${ad} ${bot}`, topla(ay, bot, N)));
}

if (kip === 'a') {
  // Konsept kuralı + kümeli doğum
  for (const mrk of [true, false])
    for (const kar of [0.35, 0.45])
      for (const kume of [0, 250, 400]) kos(`R1 mrk=${+mrk} kar=${kar} küme=${kume}`, { w: 7, h: 9, dogum: dogum(kar), murekkepKarisim: mrk, yardim: 0, kume });
}
if (kip === 'b') {
  // Yayılma
  for (const mrk of [true, false])
    for (const kar of [0, 0.15, 0.25])
      for (const oz of [[4, 5, 7], [5, 7, 9]] as [number, number, number][])
        kos(`R2 yay mrk=${+mrk} kar=${kar} özel=${oz.join('/')}`, { w: 7, h: 9, dogum: dogum(kar), murekkepKarisim: mrk, yardim: 0, yayilma: true, ozelEsik: oz });
}
