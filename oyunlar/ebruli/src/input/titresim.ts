/**
 * Titreşim eşlemesi (GDD §10.1): olay → `navigator.vibrate` deseni. Uygulama
 * `cizici.olayDinle(o => { const d = titresimDeseni(o); if (d) buzz(d); })`
 * ile bağlar (src/platform/haptics.ts; ayardan kapatılır). Saf, testli.
 *
 *  - karışım 8 ms · eşleşme 12 ms · özel taş (oluşum ya da ateşleme) 20 ms ·
 *    birleşim [20, 30, 40]; bir oynatmada aynı tür arka arkaya titretmesin
 *    diye eşleşme yalnız adımın ilk grubunda (aynı t'deki ilk `eslesti`).
 */
import type { Olay } from '../core/types';

export function titresimDeseni(o: Olay, oncekiEslestiT: number | null = null): number | number[] | null {
  switch (o.tur) {
    case 'karisti':
      return 8;
    case 'eslesti':
      return oncekiEslestiT === o.t ? null : 12;
    case 'ozelOlustu':
    case 'ozelTetiklendi':
      return 20;
    case 'birlesim':
      return [20, 30, 40];
    default:
      return null;
  }
}
