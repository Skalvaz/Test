/**
 * `window.FitilYerel.gelir` (docs/CAN-REKLAM.md §5.1, `AndroidGelirKoprusu`):
 * reklam ve satın alma modüllerini sarmalayıcının (`platform/gelir.ts`
 * `androidSaglayici`) beklediği biçime çevirir. JSON dönen yöntemler
 * `JSON.stringify` eder: `urunler` → `Urun[]`, `satinAl` →
 * `SatinAlmaSonucu`, `bekleyenler` → `{ urun, jeton }[]`, `geriYukle` →
 * `UrunId[]` (mağazaya ulaşılamazsa REDDEDER: sarmalayıcı "yapılamadı" der).
 * `reklamHazir` eşzamanlıdır ve fırlatmaz; `reklamGoster` ve `satinAl`
 * reddetmez.
 */
import { urunIdMi, type AndroidGelirKoprusu, type ReklamSonucu, type SatinAlmaSonucu } from '../gelir';
import type { Reklam } from './reklam';
import type { SatinAlma } from './satin';

const reklamYeriMi = (yer: unknown): boolean => yer === 'can' || yer === 'hamle' || yer === 'sandik';

export function gelirKoprusu(reklam: Pick<Reklam, 'hazirMi' | 'goster'>, satin: SatinAlma): AndroidGelirKoprusu {
  return {
    reklamHazir(yer) {
      try {
        return reklamYeriMi(yer) && reklam.hazirMi();
      } catch {
        return false;
      }
    },
    async reklamGoster(yer) {
      if (!reklamYeriMi(yer)) return 'hata' satisfies ReklamSonucu;
      try {
        return await reklam.goster();
      } catch {
        return 'hata' satisfies ReklamSonucu;
      }
    },
    async urunler() {
      return JSON.stringify(await satin.urunler());
    },
    async satinAl(id) {
      let r: SatinAlmaSonucu = { durum: 'hata' };
      if (urunIdMi(id)) {
        try {
          r = await satin.satinAl(id);
        } catch {
          r = { durum: 'hata' };
        }
      }
      return JSON.stringify(r);
    },
    tamamla: (jeton) => satin.tamamla(jeton),
    async bekleyenler() {
      return JSON.stringify(await satin.bekleyenler());
    },
    async geriYukle() {
      return JSON.stringify(await satin.geriYukle());
    },
  };
}
