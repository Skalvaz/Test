/** Tarama 4: seçilen kuralın onayı (K1–K3) ve özel eşikleri, öğretim tahtaları. */
import type { Ayar } from './model';
import { rapor, topla } from './kos';
const N = Number(process.argv[2] ?? 150);
const kip = process.argv[3] ?? 'a';
const D3: number[] = [20, 20, 20, 11, 11, 11];
const DKS: number[] = [32, 32, 0, 18, 0, 0];
if (kip === 'a') {
  for (const oz of [[4, 5, 7], [4, 5, 6]] as [number, number, number][]) {
    const ay: Ayar = { w: 7, h: 9, dogum: D3, murekkepKarisim: false, yardim: 0, garanti: 2, ozelEsik: oz };
    for (const b of ['rastgele', 'acemi', 'acgozlu'] as const) console.log(rapor(`SEÇ özel=${oz.join('/')} ${b}`, topla(ay, b, N)));
  }
  const ay: Ayar = { w: 7, h: 9, dogum: D3, murekkepKarisim: true, yardim: 0, garanti: 2, ozelEsik: [4, 5, 6] };
  for (const b of ['acemi', 'acgozlu'] as const) console.log(rapor(`SEÇ+mrk özel=4/5/6 ${b}`, topla(ay, b, N)));
  for (const g of [0, 1]) {
    const ay2: Ayar = { w: 7, h: 9, dogum: D3, murekkepKarisim: false, yardim: 0, garanti: g, ozelEsik: [4, 5, 6] };
    for (const b of ['acemi', 'acgozlu'] as const) console.log(rapor(`SEÇ gar=${g} ${b}`, topla(ay2, b, N)));
  }
}
if (kip === 'b') {
  for (const [w, h] of [[5, 6], [6, 7], [7, 9]] as const)
    for (const g of [2, 3]) {
      const ay: Ayar = { w, h, dogum: DKS, murekkepKarisim: false, yardim: 0, garanti: g, ozelEsik: [4, 5, 6] };
      for (const b of ['rastgele', 'acemi', 'acgozlu'] as const) console.log(rapor(`KS ${w}x${h} gar=${g} ${b}`, topla(ay, b, N)));
    }
  for (const g of [2, 3]) {
    const ay: Ayar = { w: 6, h: 7, dogum: D3, murekkepKarisim: false, yardim: 0, garanti: g, ozelEsik: [4, 5, 6] };
    for (const b of ['rastgele', 'acemi', 'acgozlu'] as const) console.log(rapor(`3R 6x7 gar=${g} ${b}`, topla(ay, b, N)));
  }
}
if (kip === 'c') {
  const ay: Ayar = { w: 7, h: 9, dogum: D3, murekkepKarisim: false, yardim: 0, garanti: 2, ozelEsik: [4, 5, 6] };
  console.log(rapor(`SEÇ usta`, topla(ay, 'usta', 40)));
}
