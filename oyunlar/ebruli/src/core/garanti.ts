/**
 * Garanti — akıllı yardım (GDD §4.7, K3).
 *
 * Son dolumdan sonra tahta grupsuzken hazır çift sayısı `garanti`'den
 * azsa, bu son dolumda doğan düz damlaların rengi (y azalan, x artan
 * sırada) yeniden seçilir: ağırlığı > 0 renkler `DOGUM_SIRASI`'nda,
 * Fisher–Yates ile `rngInt`'le karılır; grup doğurmayan ve hazır sayısını
 * artıran ilk renk tutulur. Oyuncu hiçbir damlanın renk değiştirdiğini
 * görmez: renkler `yercekimi.doganlar`'a yazılmadan önce seçilir.
 * Başarısızlık mümkündür; son çare yoktur.
 *
 * İlk tahtaya da aynı kural uygulanır (bolumuYukle; adaylar rastgele
 * hücreler, RNG ilk tahta akışı).
 */
import { rngInt } from './rng';
import { DOGUM_SIRASI } from './sabitler';
import { damla } from './tahta';
import { hazirCiftSayisi, hucredeGrupVar } from './hazir';
import type { OyunDurumu, Renk } from './types';

type GarantiTahtasi = Pick<OyunDurumu, 'w' | 'h' | 'hucreler' | 'kurallar'>;

/**
 * Adayların (hücre indeksleri; çağıran sıralar) rengini garanti için seçer.
 * Bir renk değiştiyse true.
 */
export function garantiUygula(
  d: GarantiTahtasi,
  adaylar: readonly number[],
  r: { rng: number },
  agirliklar: readonly number[],
  garanti: number,
): boolean {
  if (garanti <= 0 || adaylar.length === 0) return false;
  let hazir = hazirCiftSayisi(d);
  if (hazir >= garanti) return false;
  const izinli: Renk[] = [];
  for (let k = 0; k < DOGUM_SIRASI.length; k++) if (agirliklar[k] > 0) izinli.push(DOGUM_SIRASI[k]);
  let kullanildi = false;
  for (const i of adaylar) {
    const dm = damla(d.hucreler[i]);
    if (!dm || dm.ozel !== 'yok') continue;
    const renkler = izinli.slice();
    for (let k = renkler.length - 1; k > 0; k--) {
      const j = rngInt(r, k + 1);
      const g = renkler[k];
      renkler[k] = renkler[j];
      renkler[j] = g;
    }
    const eski = dm.renk;
    let bulundu = false;
    for (const renk of renkler) {
      if (renk === eski) continue;
      dm.renk = renk;
      if (hucredeGrupVar(d, i)) continue; // garanti asla grup doğurmaz
      const s = hazirCiftSayisi(d);
      if (s > hazir) {
        hazir = s;
        bulundu = true;
        break;
      }
    }
    if (!bulundu) dm.renk = eski;
    else kullanildi = true;
    if (hazir >= garanti) break;
  }
  return kullanildi;
}

/** Garanti aday sırası (§4.7): y azalan, x artan. */
export function garantiSirasi(w: number, hucreler: readonly number[]): number[] {
  return hucreler.slice().sort((a, b) => {
    const ya = (a - (a % w)) / w;
    const yb = (b - (b % w)) / w;
    return yb - ya || (a % w) - (b % w);
  });
}
