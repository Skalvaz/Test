/**
 * Bot paketinin uygulamaya açık yüzü (GDD §14, §12.3 #7 "Bu hamle
 * kazandırırdı", §12.4 boşta ipucu). sim-cli.ts yalnız Node'dadır;
 * buradakiler saftır (tarayıcı ve Web Worker).
 */
export { ustaKarar, ustaSec, type UstaKarar } from './usta';
export { acemiSec } from './acemi';
export { kazandiranBul, type KazandiranSecenek } from './kazandiran';
export { oyunAdimlari, oyunOyna, HAMLE_SURESI_MS, type OyunSecenek, type OyunSonucu } from './simulasyon';
export { BANTLAR, olcumHesapla, olcutHatalari, yildizEsikleriK13, yildizEsikleriOgretim, yuzdelik, type BolumOlcumu } from './olcut';
export { AGIRLIKLAR, botTohumlari, botTohumuTuret, zorunluHamle, type Agirliklar, type BotSecenek, type BotTuru } from './ortak';
