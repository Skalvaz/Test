/**
 * Usta botu (GDD §16.5): 1 hamle ileri bakış ve sezgisel değerlendirme.
 *
 *  - Körük doluysa en çok eşik hücresi üreten merkeze hemen kullanılır.
 *  - Adaylar üretilir (adaylar.ts), ucuz puanla en iyi 64'ü (hafif Usta:
 *    16) ve bütün çift dokunuşlar durumun kopyasında, dürüst RNG ile
 *    (`rng = mulberry32(durumKarmasi ^ botTohumu)`) tam `hamleUygula` ile
 *    çözülür; V formülü en yüksek olan seçilir (eşitlikte ilk).
 */
import { hamleUygula, ilerlemeYuzdesi } from '../core/index';
import type { Hamle, OyunDurumu } from '../core/index';
import { adaylariUret, enIyiler, tahtaBilgi, ucuzBaglam, ucuzPuanla } from './adaylar';
import { AGIRLIKLAR, botTohumlari, degerV, fitilHamlesi, korukDolu, korukMerkezi, ozelTaslar, type BotSecenek } from './ortak';

export interface UstaKarar {
  hamle: Hamle;
  V: number;
  /** Tam çözülen aday sayısı. */
  cozulen: number;
  /** Üretilen aday sayısı. */
  aday: number;
}

export function ustaKarar(d: OyunDurumu, botTohumu: number, s: BotSecenek = {}): UstaKarar {
  const W = s.agirlik ?? AGIRLIKLAR;
  const b = tahtaBilgi(d, s.izin ?? null);
  if (korukDolu(d)) return { hamle: { tur: 'koruk', merkez: korukMerkezi(b) }, V: 0, cozulen: 0, aday: 0 };

  const t = botTohumlari(d, botTohumu);
  const adaylar = adaylariUret(b, t.siralama, s.adaySiniri);
  ucuzPuanla(ucuzBaglam(b), adaylar, W.ucuz);
  const secilen = enIyiler(adaylar, s.tamCozum ?? 64);
  const hamleler: Hamle[] = secilen.map((a) => fitilHamlesi(d.w, a.yol, a.halka));
  for (const i of ozelTaslar(b)) hamleler.push({ tur: 'ciftDokunus', hucre: { x: i % d.w, y: Math.floor(i / d.w) } });

  // Dürüst kopya: gerçek RNG yerine değerlendirme tohumu.
  const kopya: OyunDurumu = { ...d, rng: t.degerlendirme };
  const i0 = ilerlemeYuzdesi(d);
  let en: Hamle | null = null;
  let enV = -Infinity;
  let cozulen = 0;
  for (const h of hamleler) {
    let sonuc;
    try {
      sonuc = hamleUygula(kopya, h);
    } catch {
      continue;
    }
    cozulen++;
    const V = degerV(d, sonuc.durum, W, i0);
    if (V > enV) {
      enV = V;
      en = h;
    }
  }
  if (!en) {
    // Kısıtlı ilk hamlede aday yoksa (doğrulayıcı bunu yakalar) serbest dene.
    if (s.izin) return ustaKarar(d, botTohumu, { ...s, izin: null });
    throw new Error(`usta: geçerli hamle bulunamadı (bölüm ${d.bolumId}, hamle ${d.hamleNo})`);
  }
  return { hamle: en, V: enV, cozulen, aday: adaylar.length };
}

export function ustaSec(d: OyunDurumu, botTohumu: number, s: BotSecenek = {}): Hamle {
  return ustaKarar(d, botTohumu, s).hamle;
}
