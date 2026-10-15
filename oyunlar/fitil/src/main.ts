/**
 * FİTİL önyükleme (P5). claude.ai görüntüleyicisinin canlı güncelleme
 * kancasıyla başlar (`bootWithHot`): sayfa yeni sürümle yeniden yüklenirse
 * süren bölüm anlık görüntüden sürdürülür. Bağımsız dosyada (file://)
 * doğrudan başlar.
 */
import './style.css';
import { yaziTipiniGom } from './ui/yazitipi';
import { bootWithHot } from './platform/hot';
import { Uygulama, type SicakVeri } from './app/uygulama';

declare global {
  interface Window {
    __fitil?: Record<string, unknown>;
  }
}

// Gömülü yazı tipi ilk çizimden önce (GDD §13.5: çalışma anında ağ isteği yok).
yaziTipiniGom();

let uygulama: Uygulama | null = null;

bootWithHot(
  (veri) => {
    const host = document.getElementById('app');
    if (!host || uygulama) return;
    uygulama = new Uygulama(host);
    window.__fitil = uygulama.testKancasi();
    const sicak = (veri && typeof veri === 'object' ? veri : {}) as SicakVeri;
    void uygulama.calistir(sicak).catch((e) => {
      console.error('[fitil] akış hatası', e);
    });
  },
  () => uygulama?.anlik() ?? {},
);
