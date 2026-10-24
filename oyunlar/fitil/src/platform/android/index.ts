/**
 * Android (Capacitor) önyüklemesi — aşama 3, `docs/ANDROID.md` §3.
 *
 * Yalnız `vite build --mode android` derlemesinde `main.ts` bu modülü dinamik
 * içe aktarır ve oyun başlamadan önce `androidKur()`'u bekler. Web
 * derlemelerinde (`build`, `build:single`) dal ölü koddur; bu dosya ve
 * Capacitor eklentileri pakete girmez.
 *
 * A1: boş iskelet. A2 burada `window.FitilYerel`'i (gelir köprüsü
 * `AndroidGelirKoprusu`, `olay`) kurar; onay (UMP), reklam ön yüklemesi, geri
 * tuşu, yaşam döngüsü ve açılış perdesi de buradan bağlanır. Eklentiler:
 * `@capacitor/core` (`Capacitor`, `SystemBars`), `@capacitor/app` (`App`),
 * `@capacitor/splash-screen` (`SplashScreen`), `@capacitor-community/admob`
 * (`AdMob`), `@capgo/native-purchases` (`NativePurchases`). Ödüllü birim
 * kimliği `import.meta.env.VITE_ADMOB_ODULLU` (`.env.android`). Hata oyunu
 * durdurmamalı: `main.ts` reddi yakalar ve oyunu köprüsüz başlatır.
 */
export async function androidKur(): Promise<void> {
  // A2 dolduracak.
}
