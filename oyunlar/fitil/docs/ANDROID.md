# FİTİL — Aşama 3: Android paketleme (Capacitor)

`docs/YAYIN.md` aşama 3. Aynı web kodu Capacitor 8 sarmalayıcısında Android
uygulaması olur; aşama 2'nin sağlayıcı sözleşmesi (`docs/CAN-REKLAM.md` §5,
§5.1 `window.FitilYerel.gelir`) gerçek AdMob ödüllü reklamı ve Google Play
Billing ile doldurulur. claude.ai sayfası ve `fitil.html` değişmez (Capacitor
kodu web derlemesine GİRMEZ).

## 1. Kararlar (ürün sahibi değiştirebilir)

| # | Karar | Değer |
|---|---|---|
| A1 | Paket adı (applicationId) | `com.fenerkoyu.fitil` — **ilk yüklemeden sonra değişmez**; o zamana kadar tek yerden değişir (`capacitor.config.ts` + `android/app/build.gradle`) |
| A2 | Uygulama adı | "Fitil" (simge altında) |
| A3 | Capacitor | 8.5.3 (`@capacitor/core`, `cli`, `android`), `@capacitor/app` 8.1.2, `@capacitor/splash-screen` 8.0.2 |
| A4 | Reklam + onay | `@capacitor-community/admob` 8.2.1 (ödüllü reklam, UMP onay formu) |
| A5 | Satın alma | `@capgo/native-purchases` 8.9.2 (Play Billing 9.x; Play 31 Ağustos 2026'dan beri ≥ 8 istiyor) |
| A6 | Hedef SDK | Capacitor 8 varsayılanı (compile/target 36: Play 31 Ağustos 2026'dan beri API 36 istiyor), minSdk Capacitor varsayılanı |
| A7 | Reklam kimlikleri | Geliştirmede Google'ın herkese açık TEST kimlikleri (uygulama `ca-app-pub-3940256099942544~3347511713`, ödüllü `ca-app-pub-3940256099942544/5224354917`). Gerçek kimlikler depoya girmez: AdMob uygulama kimliği `android/gradle.properties`'te değil, git'e girmeyen `android/local.properties` → `manifestPlaceholders`; ödüllü birim kimliği `.env.android.local` (`VITE_ADMOB_ODULLU`). Yoksa test kimliği kullanılır. |
| A8 | Ölçüm (Firebase Analytics) | Ertelendi: Firebase projesi ve `google-services.json` olmadan eklenmez. Köprü `FitilYerel.olay` şimdilik olayı yalnız yerel günlükte bırakır; Oyun özeti Android'de de çalışır. |
| A9 | Hedef kitle | Önerilen Play "Hedef kitle": 13 yaş ve üstü (Aileler politikası ve çocuklara yönelik reklam kısıtları devreye girmez). AdMob isteğinde `tagForChildDirectedTreatment: false`, `maxAdContentRating: 'PG'` (aile dostu reklam). |
| A10 | Yön | Kilitlenmez (tablette yatay da çalışır; oyun yatay yerleşimi destekliyor). |

## 2. Derleme kipleri

- Web (değişmez): `npm run build:single` → `fitil.html`, `dist-single/artifact.html`.
- Android: `npm run build:android` → `vite build --mode android` (çıktı
  `dist-android/`, normal çok dosyalı derleme) + `npx cap sync android`.
  `import.meta.env.MODE === 'android'` iken `src/platform/android/` dinamik
  içe aktarılır ve `window.FitilYerel` kurulur; web derlemesinde bu dal ölü
  kod olarak atılır (denetim: `fitil.html` içinde `Capacitor` geçmez).
- Android projesi `oyunlar/fitil/android/` (git'te; derleme çıktıları ve
  `local.properties` hariç).
- A1 kurulumu: `npm run build:android` (Vite + `cap sync android`; ilk
  açılıştan önce de çalıştır: Cordova eklenti klasörü ve web varlıkları
  git'te değil), `npm run android:ac` (Android Studio'da açar). Ödüllü
  birim kimliği `.env.android` (test) / `.env.android.local` (gerçek);
  AdMob uygulama kimliği `android/local.properties` `ADMOB_APP_ID`
  (`app/build.gradle` → `manifestPlaceholders.admobAppId`). Capacitor CLI
  `capacitor.config.ts`'i TypeScript 7'de Node'un tür ayıklamasıyla okur:
  Node ≥ 22.18 gerekir.

## 3. Köprü (`src/platform/android/`)

- `FitilYerel.gelir` (`AndroidGelirKoprusu`, CAN-REKLAM §5.1):
  - Reklam: açılışta (onaydan sonra) ödüllü reklam önden yüklenir;
    `reklamHazir` yüklüyken true; gösterim sonrası yeniden yüklenir. Ödül
    olayı gelmeden kapanırsa `iptal`; yükleme/gösterim hatası `hata`;
    yüklü değilse `yok`.
  - Satın alma: `purchaseProduct({ productIdentifier, productType: inapp,
    autoAcknowledgePurchases: false })`; jeton = `purchaseToken`; oyun
    ödülü kayda yazdıktan sonra `tamamla(jeton)` → tüketilir ürün
    (`can_doldur`, `guclendirici_paketi`) `consumePurchase`, kalıcı
    (`usta_karti`) `acknowledgePurchase`. `bekleyenler()` onaylanmamış
    alımlar (`getPurchases`), `geriYukle()` `restorePurchases` + kalıcı
    sahiplik. Fiyatlar `getProducts` (yerel biçimli).
- Onay (UMP): açılışta `requestConsentInfo` → gerekiyorsa `showConsentForm`;
  sonra `initialize`. Gizlilik seçenekleri gerekiyorsa (`privacyOptions
  RequirementStatus`) Ayarlar'da "Reklam gizlilik seçenekleri" satırı.
- Geri tuşu: açık modal/ekran varsa Esc gibi kapatır; haritada boştaysa
  uygulamayı arka plana alır (çıkış onayı yok).
- Yaşam döngüsü: arka plana geçince ölçüm yazılır, ses durur (mevcut
  `visibilitychange` yolu çalışıyor mu denetlenir).
- Açılış perdesi (splash): koyu gece mavisi + simge; açılış ekranı hazır olunca gizlenir.
- Güvenli alan: Capacitor 8 SystemBars ayarı oyunun `env(safe-area-inset-*)`
  paylarıyla çift pay vermeyecek biçimde seçilir (gerekçe belgeye).
  **Karar (A1):** `capacitor.config.ts` → `SystemBars: { insetsHandling:
  'native', initialViewportFitValueHint: 'cover', style: 'DARK' }` +
  `MainActivity`'de `EdgeToEdge.enable` (saydam çubuk, açık simge).
  Gerekçe: oyun payları yalnız `env(safe-area-inset-*)`'ten alır
  (`ui/stil/temel.css` `--guv-*`, `gelirSahte.css`) ve `index.html`'de
  `viewport-fit=cover` var. WebView ≥ 140'ta `native` sayfayı kenardan
  kenara çizer, `env()` gerçek çubuk/çentik payını verir; daha eski
  WebView'da Capacitor WebView'ı çubukların içine yerleştirir ve `env()` 0
  olur. İki durumda da pay tek yerden gelir, çubuk içeriği örtmez.
  `css` (varsayılan) ek olarak `--safe-area-inset-*` yazar; oyun bunları
  okumadığı için gereksiz. `disable` eski WebView'da içeriği çubukların
  altına bırakırdı. Kenardan kenara çağrısı Android 15+'ta zaten zorunlu;
  7–14'te aynı görünüm için Capacitor belgesi önerir (Capacitor 9'da
  kendiliğinden). `style: 'DARK'`: gece zemininde açık renkli simgeler
  (cihaz açık temada da). Pencere ve açılış perdesi zemini `#0B1030`
  (`res/values/colors.xml` `fitil_gece`): eski WebView'da açıkta kalan
  şerit de gece mavisi. Doğrulama telefonda: çentikli/hareketli gezinmeli
  cihazda HUD ve alt düğmeler çubuklara binmemeli, aradaki boşluk tek kat.

## 4. Görseller ve mağaza

- Simge: gece mavisi zemin, kıvılcımlı fitil (oyunun can simgesiyle aynı
  dil); uyarlanabilir simge (ön + arka katman), `mipmap-*`, 512×512 Play simgesi.
- Öne çıkan görsel 1024×500; telefon ekran görüntüleri (TR ve EN, en az 4,
  1080×1920 dolayı), 7"/10" tablet görüntüleri isteğe bağlı.
- Üretim betiği `scripts/magaza-gorselleri.mjs` (Playwright; SVG'den PNG).

## 5. Belgeler

- Gizlilik politikası `docs/gizlilik.html` (TR + EN; AdMob reklam kimliği,
  Play Billing, oyun verisinin yalnız cihazda kaldığı, iletişim e-postası
  yer tutucu).
- `docs/PLAY-KONSOL.md`: ürün sahibinin adım adım listesi (PowerShell):
  Android Studio kurulumu, `npm run build:android`, telefonda çalıştırma,
  yükleme anahtarı (keytool) ve Play App Signing, iç test kanalı, uygulama
  içi ürünler (`can_doldur`, `guclendirici_paketi`, `usta_karti`), lisans
  test kullanıcıları, AdMob uygulama + ödüllü birim + gizlilik mesajları,
  Veri güvenliği formu yanıtları, içerik derecelendirmesi (IARC), hedef kitle.

## 6. Bu ortamın sınırı

Bulut ortamının ağ politikası `dl.google.com`'u engelliyor: Android SDK
burada indirilemez, APK burada derlenmez. Doğrulama: tsc, vitest (köprü
eklenti taklitleriyle), web derlemesinin değişmediği, `npx cap sync
android`'in geçtiği, Gradle dosyalarının elle denetimi. Asıl derleme ürün
sahibinin Windows makinesinde Android Studio ile (PLAY-KONSOL.md).
