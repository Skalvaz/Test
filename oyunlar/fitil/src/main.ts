/**
 * FİTİL önyükleme (P5). claude.ai görüntüleyicisinin canlı güncelleme
 * kancasıyla başlar (`bootWithHot`): sayfa yeni sürümle yeniden yüklenirse
 * süren bölüm anlık görüntüden sürdürülür. Bağımsız dosyada (file://)
 * doğrudan başlar.
 *
 * Android derlemesinde (`vite build --mode android`, docs/ANDROID.md §2) önce
 * `platform/android` dinamik içe aktarılır ve `androidKur()` beklenir
 * (`window.FitilYerel` uygulama kurulmadan hazır olmalı: `gelirSaglayici()`
 * sayfa başına bir kez seçer). Web derlemelerinde `import.meta.env.MODE`
 * derleme anında sabittir; Android dalı ölü kod olarak atılır.
 */
import './style.css';
import { yaziTipiniGom } from './ui/yazitipi';
import { bootWithHot } from './platform/hot';
import { Uygulama, type SicakVeri } from './app/uygulama';
import { DIL } from './platform/dil';

declare global {
  interface Window {
    __fitil?: Record<string, unknown>;
    /** Paket çalıştı: index.html'deki yedek ekran ("oyun açılamadı") gösterilmez. */
    __fitilAcildi?: boolean;
  }
}

window.__fitilAcildi = true;
// Dil: CSS büyük harfi (i → İ / I) ve ekran okuyucu için.
document.documentElement.lang = DIL;

// Gömülü yazı tipi ilk çizimden önce (GDD §13.5: çalışma anında ağ isteği yok).
yaziTipiniGom();

let uygulama: Uygulama | null = null;

function baslat(): void {
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
}

/**
 * Köprü kurulamadıysa açılış perdesini doğrudan yerel köprüyle kaldırır.
 * Perdeyi kaldıran `perdeKur` köprü modülünün içinde; modül yüklenemediyse
 * oyun perdenin arkasında görünmez kalırdı (yerel süre sınırı da 8 sn sonra
 * kaldırır, capacitor.config.ts). Capacitor'ün sayfaya enjekte ettiği
 * `nativePromise` eklenti modülünü içe aktarmadan çağrılır.
 */
function perdeyiYerelKaldir(): void {
  try {
    const cap = (window as { Capacitor?: { nativePromise?: (eklenti: string, yontem: string, secenek: object) => Promise<unknown> } }).Capacitor;
    void cap?.nativePromise?.('SplashScreen', 'hide', {})?.catch(() => undefined);
  } catch {
    /* köprü yok: yerel süre sınırı perdeyi kaldırır */
  }
}

/** Android: yerel köprüyü kur, sonra başlat. Kurulum hatası oyunu durdurmaz (köprüsüz başlar). */
async function androidIleBaslat(): Promise<void> {
  try {
    const { androidKur } = await import('./platform/android/index');
    await androidKur();
  } catch (e) {
    console.error('[fitil] Android kurulumu başarısız', e);
    perdeyiYerelKaldir();
  }
  baslat();
}

// Üst düzey await yok: tek dosya kipi IIFE'dir.
if (import.meta.env.MODE === 'android') void androidIleBaslat();
else baslat();
