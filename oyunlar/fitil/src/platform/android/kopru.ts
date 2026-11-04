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
import { reklamIzniCoz, type ReklamIzni } from '../reklamIzni';
import type { Reklam } from './reklam';
import type { SatinAlma } from './satin';

const reklamYeriMi = (yer: unknown): boolean => yer === 'can' || yer === 'hamle' || yer === 'sandik';

/** İzin yeni verildiyse ilk reklamın yüklenmesi için beklenen en uzun süre (ms). */
export const ILK_YUKLEME_BEKLEME_MS = 10_000;

/** (YASAL-UYUM §2) Reklam izninin deposu: cihazda okunur/yazılır (`platform/reklamIzni.ts`). */
export interface IzinDeposu {
  oku(): ReklamIzni | null;
  yaz(i: ReklamIzni): void;
}

export function gelirKoprusu(reklam: Pick<Reklam, 'hazirMi' | 'goster' | 'baslat' | 'durdur' | 'hazirBekle'>, satin: SatinAlma, izin: IzinDeposu): AndroidGelirKoprusu {
  return {
    reklamHazir(yer) {
      try {
        if (!reklamYeriMi(yer)) return false;
        const i = izin.oku();
        // Henüz sorulmadı: düğme görünür, ilk dokunuşta izin sorulur (SDK o ana dek başlamaz).
        if (i === null) return true;
        return i.izin && reklam.hazirMi();
      } catch {
        return false;
      }
    },
    async reklamGoster(yer) {
      if (!reklamYeriMi(yer)) return 'hata' satisfies ReklamSonucu;
      try {
        if (izin.oku()?.izin !== true) return 'yok' satisfies ReklamSonucu;
        if (!reklam.hazirMi() && !(await reklam.hazirBekle(ILK_YUKLEME_BEKLEME_MS))) return 'yok' satisfies ReklamSonucu;
        return await reklam.goster();
      } catch {
        return 'hata' satisfies ReklamSonucu;
      }
    },
    reklamIzni() {
      const i = izin.oku();
      return i ? JSON.stringify(i) : '';
    },
    reklamIzniVer(json) {
      const i = reklamIzniCoz(json);
      if (!i) return;
      izin.yaz(i);
      if (i.izin) void reklam.baslat();
      else reklam.durdur();
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
