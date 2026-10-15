/**
 * Usta botu (GDD §14.3): 1 hamle ileri bakan sezgisel.
 *
 *   V = 1000·Δ(hedef ilerleme oranı) + 0,05·Δpuan + 25·(üretilen özel:
 *       tarak 1, girdap 2, lale 4) + 4·min(6, sonraki hazır çift sayısı)
 *       + 6·[Mürekkep üretti ve Mürekkep hedefe yarar]
 *       − 300·[kazanç yokken kalanHamle = 0]
 *
 * İki aşama (§14.1): (1) bütün geçerli hamleler (özel taşa dokunanlar dahil)
 * `onizleDetay` ile DOĞUMSUZ değerlendirilir → V0 (hazır terimi hariç);
 * (2) V0'ı en yüksek `tamCozum` aday durumun kopyasında dürüst RNG ile
 * (`rng = mulberry32(durumKarmasi ^ botTohumu)`) `hamleUygula` ile tam
 * çözülür; Δ ilerleme/puan ve sonraki hazır çift dolumlu tahtadan. En
 * yüksek V; eşitlikte botun RNG'si. Gerçek dolum akışını görmez (K14).
 */
import { gecerliHamleler, hamleUygula, hazirCiftSayisi, ilerlemeYuzdesi, onizleDetay, rngInt } from '../core/index';
import type { Hamle, OyunDurumu } from '../core/index';
import { AGIRLIKLAR, botTohumlari, type Agirliklar, type BotSecenek } from './ortak';

export interface UstaKarar {
  hamle: Hamle;
  V: number;
  /** Değerlendirilen (doğumsuz) ve tam çözülen aday sayısı. */
  aday: number;
  cozulen: number;
}

/** Mürekkep bu bölümde işe yarar mı: tamamlanmamış kâğıt hedefi ya da tahtada mermer. */
function murekkepYarar(d: OyunDurumu): boolean {
  if (d.hedefler.some((h) => !h.tamam && h.hedef.tur === 'kagit')) return true;
  return d.hucreler.some((c) => c.icerik?.tur === 'mermer');
}

export function ustaKarar(d: OyunDurumu, botTohumu: number, s: BotSecenek = {}): UstaKarar {
  const W: Agirliklar = s.agirlik ?? AGIRLIKLAR;
  const hamleler = s.izin ? [s.izin] : gecerliHamleler(d);
  if (hamleler.length === 0) throw new Error(`usta: geçerli hamle yok (bölüm ${d.bolumId}, hamle ${d.hamleNo})`);
  const t = botTohumlari(d, botTohumu);
  const i0 = ilerlemeYuzdesi(d);
  const yarar = murekkepYarar(d);
  // (1) Doğumsuz ön değerlendirme.
  const adaylar: { h: Hamle; v0: number; ozel: number; murekkep: number; sira: number }[] = [];
  for (const h of hamleler) {
    const o = onizleDetay(d, h);
    if (!o) continue;
    const ozel = o.uretilen.tarak + 2 * o.uretilen.girdap + 4 * o.uretilen.lale;
    const murekkep = o.murekkepUretti && yarar ? 1 : 0;
    const v0 = W.hedef * (ilerlemeYuzdesi(o.durum) - i0) + W.puan * o.puanArtisi + W.ozel * ozel + W.murekkep * murekkep;
    adaylar.push({ h, v0, ozel, murekkep, sira: rngInt(t.secim, 1 << 30) });
  }
  adaylar.sort((a, b) => b.v0 - a.v0 || a.sira - b.sira);
  // (2) En iyi adayları dürüst RNG ile tam çöz.
  const kopya: OyunDurumu = { ...d, rng: t.degerlendirme };
  let en = adaylar[0];
  let enV = -Infinity;
  let enSira = Infinity;
  const n = Math.min(adaylar.length, Math.max(1, W.tamCozum));
  for (let k = 0; k < n; k++) {
    const a = adaylar[k];
    const s2 = hamleUygula(kopya, a.h).durum;
    let V = W.hedef * (ilerlemeYuzdesi(s2) - i0) + W.puan * (s2.puan - d.puan) + W.ozel * a.ozel + W.murekkep * a.murekkep;
    if (s2.bitti !== 'kazanc') V += W.hazir * Math.min(W.hazirTavan, hazirCiftSayisi(s2));
    if (s2.bitti === 'kayip') V -= W.sonHamle;
    if (V > enV || (V === enV && a.sira < enSira)) {
      enV = V;
      en = a;
      enSira = a.sira;
    }
  }
  return { hamle: en.h, V: enV, aday: adaylar.length, cozulen: n };
}

export function ustaSec(d: OyunDurumu, botTohumu: number, s: BotSecenek = {}): Hamle {
  return ustaKarar(d, botTohumu, s).hamle;
}
