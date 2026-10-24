/**
 * Açılış perdesi, geri tuşu ve yaşam döngüsü — docs/ANDROID.md §3.
 *
 *  - Perde (`@capacitor/splash-screen`): uygulama açılış ekranını kurunca
 *    `FitilYerel.hazir()` → iki kare sonra (ekran çizilmiş olsun)
 *    `SplashScreen.hide()`. Uygulama hiç hazır demezse (başlatma hatası)
 *    `PERDE_EN_GEC_MS` sonra yine kalkar: oyuncu perdede kalmasın,
 *    index.html'in yedek ekranı görünsün. Aynı süre yerelde de var
 *    (`capacitor.config.ts` `launchAutoHide: true`, `launchShowDuration`):
 *    JS hiç çalışmazsa ya da bu modül yüklenemezse de perde kalkar.
 *  - Geri tuşu (`@capacitor/app` `backButton`; dinleyici varken Capacitor
 *    varsayılan davranışı kapatır): uygulama işlediyse (açık pencere Esc
 *    yolundan kapandı, oyun duraklatıldı; `platform/yerel.ts`) bir şey
 *    yapılmaz, işlemediyse (harita, açılış) `App.minimizeApp()` (çıkış onayı
 *    yok).
 *  - Yaşam döngüsü (`appStateChange`): uygulamaya `yasamBildir` (ses askıya,
 *    deneme süresi durur); ön plandan çıkınca ölçüm hemen yazılır
 *    (`visibilitychange` de yazıyorsa çift yazım zararsız).
 */
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { olcum } from '../olcum';
import { geriTusuBildir, yasamBildir } from '../yerel';

/** Uygulama hazır demese de perde bu kadar sonra kalkar (ms). */
export const PERDE_EN_GEC_MS = 8000;

export interface Perde {
  /** Uygulama açılış ekranını kurdu (birden çok çağrı zararsız). */
  hazir(): void;
  /** Perde kalkınca (ya da kaldırma denenince) çözülür; onay formu bundan sonra. */
  readonly kalkti: Promise<void>;
}

/** Bir sonraki kare (requestAnimationFrame yoksa ~16 ms). */
function kare(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fn());
  else setTimeout(fn, 16);
}

export function perdeKur(enGec = PERDE_EN_GEC_MS): Perde {
  let istendi = false;
  let coz: () => void = () => undefined;
  const kalkti = new Promise<void>((c) => (coz = c));
  const kaldir = () => {
    if (istendi) return;
    istendi = true;
    clearTimeout(sure);
    Promise.resolve()
      .then(() => SplashScreen.hide())
      .catch((e: unknown) => console.error('[fitil] açılış perdesi kaldırılamadı', e))
      .finally(() => coz());
  };
  const sure = setTimeout(kaldir, enGec);
  return {
    hazir: () => {
      if (istendi) return;
      // Açılış ekranı DOM'da; iki kare sonra çizilmiştir (perde kalkınca boş zemin görünmesin).
      kare(() => kare(kaldir));
    },
    kalkti,
  };
}

/** Geri tuşu ve yaşam döngüsü dinleyicileri. Hata reddedilir (çağıran günlüğe yazar; oyun sürer). */
export async function yasamKur(): Promise<void> {
  await App.addListener('backButton', () => {
    if (geriTusuBildir()) return;
    void App.minimizeApp().catch(() => undefined);
  });
  await App.addListener('appStateChange', (s) => {
    const aktif = s?.isActive === true;
    yasamBildir(aktif);
    if (!aktif) olcum.yaz();
  });
}
