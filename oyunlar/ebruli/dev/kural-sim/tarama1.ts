/** Tarama 1: konsept kuralı, karışık doğum oranı × yardım × bot. */
import type { Ayar } from './model';
import { rapor, topla } from './kos';

const N = Number(process.argv[2] ?? 150);
const satirlar: string[] = [];
const yaz = (s: string) => {
  satirlar.push(s);
  console.log(s);
};

function dogum(karisikOran: number, hamlar = [1, 1, 1], karisiklar = [1, 1, 1]): number[] {
  // toplam 1000 ölçeğinde tamsayı ağırlık
  const ham = Math.round((1000 * (1 - karisikOran)) / hamlar.filter(Boolean).length);
  const kar = karisiklar.filter(Boolean).length ? Math.round((1000 * karisikOran) / karisiklar.filter(Boolean).length) : 0;
  return [...hamlar.map((x) => (x ? ham : 0)), ...karisiklar.map((x) => (x ? kar : 0))];
}

const kip = process.argv[3] ?? 'temel';

if (kip === 'temel') {
  for (const murekkep of [true, false]) {
    for (const oran of [0, 0.2, 0.3, 0.4, 0.5]) {
      for (const yrd of [0, 3]) {
        const ay: Ayar = { w: 7, h: 9, dogum: dogum(oran), murekkepKarisim: murekkep, yardim: yrd };
        for (const bot of ['rastgele', 'acemi', 'acgozlu', 'usta'] as const) {
          const o = topla(ay, bot, bot === 'usta' ? Math.max(20, N / 3) : N);
          yaz(rapor(`mrk=${murekkep ? 1 : 0} kar=${oran} yrd=${yrd} ${bot}`, o));
        }
      }
    }
  }
}
if (kip === 'kucuk') {
  // öğretim tahtaları: yalnız K+S (Turuncu) ve 3 ham
  for (const [w, h] of [[5, 6], [6, 7], [7, 9]] as const) {
    for (const oran of [0.2, 0.3, 0.4]) {
      const ay: Ayar = { w, h, dogum: dogum(oran, [1, 1, 0], [1, 0, 0]), murekkepKarisim: true, yardim: 0 };
      for (const bot of ['rastgele', 'acemi', 'acgozlu'] as const) yaz(rapor(`${w}x${h} KS kar=${oran} ${bot}`, topla(ay, bot, N)));
    }
  }
}
if (kip === 'ham') {
  // karşılaştırma: ham renkler de eşleşseydi
  for (const oran of [0.3]) {
    const ay: Ayar = { w: 7, h: 9, dogum: dogum(oran), murekkepKarisim: true, yardim: 0, hamEslesir: true };
    for (const bot of ['rastgele', 'acemi', 'acgozlu'] as const) yaz(rapor(`HAM EŞLEŞİR kar=${oran} ${bot}`, topla(ay, bot, N)));
  }
}
