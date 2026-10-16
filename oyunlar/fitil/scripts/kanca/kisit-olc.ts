/**
 * Kısıt mühürü ölçümü (docs/KANCALAR.md §A.5): Körük kapalıyken
 * (`korukKapasitesi` 0) Usta botun kazanma oranı / normal kazanma oranı.
 *
 *   npx tsx scripts/kanca/kisit-olc.ts <bölümler virgüllü> [tohum=100] [bas=2000]
 */
import { BOLUMLER } from '../../src/levels/index';
import { oyunOyna } from '../../src/bot/simulasyon';

const [liste, n = '100', bas = '2000'] = process.argv.slice(2);
for (const id of liste.split(',').map(Number)) {
  const v = BOLUMLER[id - 1];
  const kisitli = { ...v, korukKapasitesi: 0 };
  let normal = 0;
  let kisit = 0;
  for (let s = +bas; s < +bas + +n; s++) {
    if (oyunOyna(v, s, 'usta').kazandi) normal++;
    if (oyunOyna(kisitli, s, 'usta').kazandi) kisit++;
  }
  console.log(`${id} ${v.ad}: Körüklü ${normal}/${n}, Körüksüz ${kisit}/${n} → oran %${Math.round((100 * kisit) / Math.max(1, normal))}`);
}
