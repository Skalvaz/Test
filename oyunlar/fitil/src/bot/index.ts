/**
 * Bot paketinin uygulamaya açık yüzü (GDD §16.5, §15 boşta ipucu, §11
 * kanca 12). sim-cli.ts yalnız Node'dadır; buradakiler saftır (tarayıcı ve
 * Web Worker).
 */
export { ustaKarar, ustaSec, type UstaKarar } from './usta';
export { acemiEnIyiAday, acemiSec } from './acemi';
export { kazandiranAra, kazandiranBul, type KazandiranSecenek, type KazandiranYol } from './kazandiranBul';
export { oyunAdimlari, oyunOyna, DUSUNME_MS, type OyunSecenek, type OyunSonucu } from './simulasyon';
export { olcumHesapla, olcutHatalari, yildizEsikleriHesapla, yildizEsikleriK24, yildizEsikleriIlkIzlenim, yildizEsikleriOgretim, yuzdelik, type BolumOlcumu } from './olcut';
export { AGIRLIKLAR, botTohumuTuret, degerV, type Agirliklar, type BotSecenek, type BotTuru } from './ortak';
