/**
 * Ebruli önyükleme. claude.ai görüntüleyicisinin canlı güncelleme kancasıyla
 * başlar (`bootWithHot`); bağımsız dosyada (file://) doğrudan başlar.
 * Test kancası `window.__ebruli` (kısa adı `__ebru`), GDD §13.6.
 */
import './style.css';
import { yaziTipiniGom } from './ui/yazitipi';
import { bootWithHot } from './platform/hot';
import { Uygulama } from './app/uygulama';

declare global {
  interface Window {
    /** Test kancası (scripts/oynanis.mjs; GDD §13.6). */
    __ebruli?: Record<string, unknown>;
    __ebru?: Record<string, unknown>;
    /** Paket çalıştı: index.html'deki yedek ekran gösterilmez. */
    __ebruliAcildi?: boolean;
  }
}

window.__ebruliAcildi = true;

// Gömülü yazı tipi ilk çizimden önce (GDD §11.5: çalışma anında ağ isteği yok).
const yaziHazir = yaziTipiniGom();

let uygulama: Uygulama | null = null;

bootWithHot(
  () => {
    const host = document.getElementById('app');
    if (!host || uygulama) return;
    uygulama = new Uygulama(host);
    const kanca = uygulama.testKancasi(yaziHazir);
    window.__ebruli = kanca;
    window.__ebru = kanca;
    void uygulama.baslat();
  },
  () => uygulama?.anlik() ?? {},
);
