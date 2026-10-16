/**
 * Mühür ön ölçümü (docs/KANCALAR.md §A.5, §A.7): bölümlerin bölüm JSON'undaki
 * mühürlerinin Usta ve Acemi botun KAZANDIĞI oyunlardaki oranları.
 *
 *   npx tsx scripts/kanca/muhur-olc.ts <ilk> <son> [ustaTohum=150] [acemiTohum=300] [bas=2000]
 *
 * Tek iş parçacığıdır; 35 bölüm × 450 oyun ≈ 40 dk. Paralel için aralıkları
 * bölüp ayrı süreçlerde koşun. Kalibrasyon paketi (K5) bunu sim-cli
 * `--muhur` kipine taşır.
 */
import { BOLUMLER } from '../../src/levels/index';
import { oyunOyna } from '../../src/bot/simulasyon';
import { ozetBaslat, ozetHamle } from '../../src/meta/ozet';
import type { OyunOzeti } from '../../src/meta/ozet';
import { muhurleriDegerlendir, muhurMetni } from '../../src/meta/muhur';

const [ilk, son, ustaN = '150', acemiN = '300', bas = '2000'] = process.argv.slice(2);
const KADEME = ['Ç', 'K', 'U'];

for (let id = +ilk; id <= +son; id++) {
  const v = BOLUMLER[id - 1];
  if (!v?.muhurler) continue;
  const sonuc: Record<'usta' | 'acemi', { oyun: number; kazanc: number; muhur: number[] }> = {
    usta: { oyun: 0, kazanc: 0, muhur: [0, 0, 0] },
    acemi: { oyun: 0, kazanc: 0, muhur: [0, 0, 0] },
  };
  for (const [bot, n] of [['usta', +ustaN], ['acemi', +acemiN]] as const) {
    for (let s = +bas; s < +bas + n; s++) {
      let oz: OyunOzeti = ozetBaslat();
      let kalan = 0;
      const o = oyunOyna(v, s, bot, {
        kayit: (k) => {
          oz = ozetHamle(oz, k.olaylar, { hamle: k.hamle, onceki: k.d });
          kalan = k.sonraki.kalanHamle;
        },
      });
      sonuc[bot].oyun++;
      if (!o.kazandi) continue;
      sonuc[bot].kazanc++;
      const m = muhurleriDegerlendir(v, { hamleIzleri: oz.hamleIzleri, kazandi: true, kalanHamle: kalan, ustaEli: false, guclendirici: 0 });
      m.forEach((b, i) => (sonuc[bot].muhur[i] += b ? 1 : 0));
    }
  }
  const yuzde = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}` : '—');
  console.log(`${id} ${v.ad}: kazanç U ${yuzde(sonuc.usta.kazanc, sonuc.usta.oyun)} / A ${yuzde(sonuc.acemi.kazanc, sonuc.acemi.oyun)}`);
  v.muhurler.forEach((k, i) => {
    console.log(`  ${KADEME[i]} ${muhurMetni(k).padEnd(36)} U ${yuzde(sonuc.usta.muhur[i], sonuc.usta.kazanc).padStart(3)}  A ${yuzde(sonuc.acemi.muhur[i], sonuc.acemi.kazanc).padStart(3)} (A kazanç ${sonuc.acemi.kazanc})`);
  });
}
