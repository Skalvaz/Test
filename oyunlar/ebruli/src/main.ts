/**
 * Ebruli önyükleme. claude.ai görüntüleyicisinin canlı güncelleme kancasıyla
 * başlar (`bootWithHot`): sayfa yeni sürümle yeniden yüklenirse süren bölüm
 * anlık görüntüden sürdürülür (uygulama paketi `anlik()` sağlar). Bağımsız
 * dosyada (file://) doğrudan başlar.
 *
 * P0: uygulama paketi (src/app/uygulama.ts) gelene kadar `iskelet.ts`
 * sahnesi gösterilir; kanca, yazı tipi ve tek dosya derlemesi bu iskeletle
 * uçtan uca doğrulanır.
 */
import './style.css';
import { yaziTipiniGom } from './ui/yazitipi';
import { bootWithHot } from './platform/hot';
import { iskeletBaslat } from './app/iskelet';

declare global {
  interface Window {
    /** Test kancası (scripts/oynanis.mjs; GDD §13.6). */
    __ebruli?: Record<string, unknown>;
    /** Paket çalıştı: index.html'deki yedek ekran gösterilmez. */
    __ebruliAcildi?: boolean;
  }
}

window.__ebruliAcildi = true;

// Gömülü yazı tipi ilk çizimden önce (GDD §11.5: çalışma anında ağ isteği yok).
const yaziHazir = yaziTipiniGom();

let basladi = false;

bootWithHot(
  () => {
    const host = document.getElementById('app');
    if (!host || basladi) return;
    basladi = true;
    window.__ebruli = iskeletBaslat(host, yaziHazir);
  },
  () => ({}),
);
