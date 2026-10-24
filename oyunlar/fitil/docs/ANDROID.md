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
| A7 | Reklam kimlikleri | Geliştirmede Google'ın herkese açık TEST kimlikleri (uygulama `ca-app-pub-3940256099942544~3347511713`, ödüllü `ca-app-pub-3940256099942544/5224354917`). Gerçek kimlikler depoya girmez: AdMob uygulama kimliği `android/gradle.properties`'te değil, git'e girmeyen `android/local.properties` → `manifestPlaceholders`; ödüllü birim kimliği `.env.android.local` (`VITE_ADMOB_ODULLU`). Yoksa test kimliği kullanılır; yayın derlemesi (`bundleRelease`/`assembleRelease`) ise test ya da farklı hesaplı kimlikle DURUR (`app/build.gradle` `fitilReklamKimligiDenetimi`; bilerek: `-PfitilTestReklam`). |
| A8 | Ölçüm (Firebase Analytics) | Ertelendi: Firebase projesi ve `google-services.json` olmadan eklenmez. Köprü `FitilYerel.olay` şimdilik olayı yalnız yerel günlükte bırakır; Oyun özeti Android'de de çalışır. |
| A9 | Hedef kitle | Önerilen Play "Hedef kitle": 13 yaş ve üstü (Aileler politikası ve çocuklara yönelik reklam kısıtları devreye girmez). AdMob isteğinde `tagForChildDirectedTreatment: false`, `maxAdContentRating: MaxAdContentRating.ParentalGuidance` (aile dostu reklam; eklenti `'ParentalGuidance'` metnini Google'ın `MAX_AD_CONTENT_RATING_PG`'sine çevirir, düz `'PG'` tanınmaz ve sınırsız kalırdı). |
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
    `reklamHazir` yüklüyken true; reklam ekranı kapanınca yeniden yüklenir. Ödül
    olayı gelmeden kapanırsa `iptal`; yükleme/gösterim hatası `hata`;
    yüklü değilse `yok`.
  - Satın alma: `purchaseProduct({ productIdentifier, productType: inapp,
    autoAcknowledgePurchases: false })`; jeton = `purchaseToken`; oyun
    ödülü kayda yazdıktan sonra `tamamla(jeton)` → tüketilir ürün
    (`can_doldur`, `guclendirici_paketi`) `consumePurchase`, kalıcı
    (`usta_karti`) `acknowledgePurchase`. `bekleyenler()` tamamlanmamış
    alımlar (`getPurchases`: tüketilir üründe tüketilmemiş, kalıcıda
    onaylanmamış; aşağıda "A2 uygulaması"), `geriYukle()` kalıcı sahiplik
    (`getPurchases`). Fiyatlar `getProducts` (yerel biçimli).
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
- **A2 uygulaması** (`src/platform/android/`; uygulama tarafı Capacitor'süz
  `src/platform/yerel.ts`):
  - `androidKur` `window.FitilYerel`'i (`gelir`, `olay`, `gizlilik`,
    `hazir`) eşzamanlı kurar ve hemen döner; onay, reklam ve dinleyiciler
    arkada. Hata oyunu durdurmaz.
  - Reklam (`reklam.ts`): eklentinin `showRewardVideoAd`'i yalnız ödülde
    çözülür (ödülsüz kapanışta hiç, gösterim hatasında da reddetmez); sonuç
    `Rewarded` / `Dismissed` / `FailedToShow` olaylarından: ödül + kapanış
    `odul`, ödülsüz kapanış 1 sn payla `iptal`, gösterim hatası `hata`;
    ödül gelip kapanış 60 sn gelmezse yine `odul`. Yeni reklam ancak reklam
    ekranı kapanınca yüklenir (kapanış olayı hiç gelmezse 10 dk sonra):
    eklenti reklamı birim kimliği anahtarıyla saklar, gösterilen reklam
    kapanınca o anahtarı siler; ekran açıkken yüklenen yeni reklam silinirdi.
    Yükleme hatasında 30 sn, 2 dk, 5 dk (sonra 5 dk) yeniden deneme; yüklü
    reklam 55 dk'dan eskiyse yenilenir. `initialize`: çocuk/rıza yaşı
    etiketleri false, `maxAdContentRating: ParentalGuidance` (A9), test
    cihazı kaydı yok. Onay formu açılış perdesi kalktıktan sonra;
    `requestConsentInfo` / form hatası ya da `canRequestAds` false → bu
    oturumda reklam yok (`yok`).
  - Satın alma (`satin.ts`): eklentinin her çağrısı yeni BillingClient
    kurup öncekini kapattığı için bütün çağrılar tek kuyrukta (yanıtsız
    çağrıda süre sınırıyla ilerler). `autoFinishTransactions: false`
    (`capacitor.config.ts` + açılışta `configure`): yoksa `restorePurchases`
    ödülü verilmemiş alımları da onaylardı. Bekleyen = SATIN ALINDI
    durumunda, tüketilir üründe tüketilmemiş (onaylı olsa da), kalıcıda
    onaylanmamış; ödemesi bekleyen ("2") verilmez. `ITEM_ALREADY_OWNED`
    (ör. yeniden kurulumdan sonra Usta kartı) mağazadaki alımla `basarili`
    döner (jeton çifte vermeyi önler); aynı ürünün ödemesi bekleyen alımı
    varsa `beklemede`. Fatura desteklenmiyorsa `urunler` boş. `geriYukle`
    yalnız `getPurchases` (eklentinin `restorePurchases`'ı elle tamamlama
    kipinde iş yapmaz, yalnız ayrı bağlantıyla kuyruğu uzatırdı). Sarmalayıcı
    (`platform/gelir.ts`) `bekleyenler` ve `geriYukle` için 60 sn bekler
    (`KOPRU_SURELERI.sorgu`): kuyrukta önde bir iş (açılışta fiyatlar, iş
    başına en çok 30 sn) + kendisi. Bekleyen alımlar açılışta VE uygulama
    ön plana dönünce sorulur (`GelirAkisi.onPlanaDondu`; satın alma akışı
    sürerken değil): gecikmeli ödeme uygulama arkadayken tamamlanabilir,
    köprü Play bağlantısını her çağrıdan sonra kapattığı için dinleyen yok.
  - Geri tuşu: açık pencere → Esc yolu (`document`'a kabarmadan gönderilir;
    tahtanın klavye girdisi Esc'i tüketmesin), oyunda Duraklat, harita ve
    açılışta `App.minimizeApp()`. Yaşam döngüsü: `appStateChange` → ölçüm
    yazılır, uygulamaya `fitil-yasam` (ses askıya, deneme süresi ve mola
    durur; `visibilitychange` ile birlikte zararsız).
  - Açılış perdesi: açılış ekranı DOM'a girince `yerelHazir()` → iki kare
    sonra `SplashScreen.hide()`; uygulama hazır demezse 8 sn sonra. Yerel
    yedek: `capacitor.config.ts` `launchAutoHide: true`, `launchShowDuration:
    8000` (JS hiç çalışmazsa, ör. eski WebView paketi ayrıştıramazsa, perde
    yine kalkar; erken `hide()` yerel zamanlayıcıyı bekletmez). Köprü modülü
    yüklenemezse `main.ts` perdeyi `Capacitor.nativePromise('SplashScreen',
    'hide')` ile hemen kaldırır, oyun köprüsüz başlar.
  - Yedekleme: `AndroidManifest.xml` `allowBackup="false"`. WebView verisi
    (ilerleme, satın alma jetonları, ölçüm günlüğü) Google Drive yedeğine
    gitmez, uygulama kaldırılınca silinir (gizlilik politikası §3 böyle
    söyler; PLAY-KONSOL §7'deki "sil, kur, geri yükle" denemesi de ancak
    böyle anlamlı). Android 12+ kullanıcının başlattığı cihazdan cihaza
    aktarım yine çalışır (oyuncunun yeni telefonu).
  - Gizlilik politikası uygulamanın içinde (Play Kullanıcı Verileri
    politikası): köprü `docs/gizlilik.html`'i pakete gömer
    (`FitilYerel.politika`); Ayarlar > Hakkında > "Gizlilik politikası"
    oyuncunun dilindeki bölümü modalda gösterir (`ui/ekranlar/politika.ts`;
    dış bağlantılar sistem tarayıcısında). Web'de satır yok.
  - Ayarlar "Reklam gizlilik seçenekleri" (Mağaza'nın altında) yalnız UMP
    `privacyOptionsRequirementStatus` REQUIRED iken; `showPrivacyOptionsForm`.

## 4. Görseller ve mağaza

- Simge: gece mavisi zemin, kıvılcımlı fitil (oyunun can simgesiyle aynı
  dil); uyarlanabilir simge (ön + arka katman), `mipmap-*`, 512×512 Play simgesi.
- Öne çıkan görsel 1024×500; telefon ekran görüntüleri (TR ve EN, en az 4,
  1080×1920 dolayı), 7"/10" tablet görüntüleri isteğe bağlı.
- Üretim betiği `scripts/magaza-gorselleri.mjs` (Playwright; SVG'den PNG).

**A3 uygulaması (24 Ekim 2026):**

- Kaynaklar `magaza/kaynak/`: `simge-arka.svg` (gece göğü #0B1030 →
  #2A1450, kıvılcımın altında sıcak ışık, seyrek yıldız), `simge-on.svg`
  (örgülü ip yumuşak S ile yükselir, ucu kömürleşir; köz, krem dört köşeli
  kıvılcım, fişek gibi saçılan ışınlar; can simgesi `fitilCanIsaretleme`
  dili), `simge-tekrenk.svg` (Android 13+ temalı simge), `one-cikan.svg`
  (1024×500; açılış logosu, slogan, yanan fitille bağlı kapsüller, havai
  fişekler, açılış ekranının kasabası; `.tr`/`.en` grupları, İngilizcede
  noktasız "FITIL"). `simge-tam.svg` katmanlardan ÜRETİLİR (elle düzenlenmez).
  Ön katmanın en uzak parçası merkezden 32,9 dp (güvenli daire 33 dp):
  başlatıcı maskeleri ve açılış perdesinin 2/3 dairesi hiçbir şeyi kesmez.
- `node scripts/magaza-gorselleri.mjs` (sunucusuz): `mipmap-*/`
  `ic_launcher_background|foreground|monochrome.png` (108 dp),
  `ic_launcher.png` (API 24–25: 48 dp'de 2 dp pay, yuvarlak kare),
  `ic_launcher_round.png` (daire), `mipmap-anydpi-v26/ic_launcher(_round).xml`
  (arka + ön + tek renk), `drawable-*/splash_simge.png` (288 dp),
  `drawable(-port|-land)-*/splash.png` (şablon boyutları; düz gece mavisi +
  ortada ön katman, kısa kenarın %80'i tuval), `magaza/play/simge-512.png`
  (32 bit RGBA, alfa her yerde 255: Play simge şartı "32-bit PNG (with
  alpha)"; Chromium opak karede alfayı attığı için tuvalden yeniden
  kodlanır), `one-cikan-1024x500(_en).png` (24 bit RGB). Capacitor
  şablonunun kullanılmayan simge parçaları (yeşil ızgara, robot,
  `values/ic_launcher_background.xml`) silinir.
- **Açılış perdesi kararı:** `Theme.SplashScreen` (core-splashscreen 1.2.0)
  `windowSplashScreenAnimatedIcon` verilmezse genel Android simgesini
  (`sym_def_app_icon`) koyar (AAR'ın `values.xml`'i incelendi; uyumluluk
  yolu API 24–30'da da aynı özniteliği okur). Bu yüzden açılış temasına
  `windowSplashScreenAnimatedIcon = @drawable/splash_simge` eklendi; her
  API'de görünüm aynı: düz #0B1030 + kıvılcımlı fitil. Temanın
  `android:background`'ı `@drawable/splash` yerine `@color/fitil_gece`: tam
  ekran bitmap API 24–30'da ekran oranına göre gerilirdi. `splash.png`
  yalnız eklentinin eski yolu ve `SplashScreen.show()` için;
  `capacitor.config.ts` `androidScaleType: 'CENTER_CROP'` (varsayılan
  FIT_XY simgeyi basardı).
- Telefon ekran görüntüleri: `node scripts/magaza-gorselleri.mjs ekran <url>
  [tr|en] [sahne,…]` (dev sunucusu; 360×640, DPR 3 → 1080×1920, RGB).
  Altı sahne, her biri temiz bağlamda, `?gelir=sahte` (can hapı Android'deki
  gibi görünür) ve `kayitYama` ile: açılış, öğretim (el ipucu sürüklemenin
  ortasında dondurulur), büyük reaksiyon (16. bölüm, Usta botu; ilk
  "Muhteşem!"/"ŞENLİK!" anında dondurulup oyun zamanı 620 ms ilerletilir:
  yazının yayı oturmuş, solmamış), süslü kasaba haritası (13 bölüm, 16 iş),
  Kazandın (9. bölüm ilk kazanç, 3★ gelene dek kayıttaki deneme sayısıyla
  tahta tohumu değiştirilir), Kasaba paneli.
- Denetim: `node scripts/magaza-gorselleri.mjs onizleme <klasör>` (simge
  dört maske × dört boy, temalı simge, Android 12 perde benzetimi).

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
- A3 (24 Ekim 2026): ikisi de yazıldı. Gizlilik politikası yürürlük tarihi
  24 Ekim 2026; yer tutucular `[Geliştirici adı]` ve `iletisim@ornek.com`
  yayından önce değişir, sayfa herkese açık bir adreste yayımlanır
  (PLAY-KONSOL.md §9). Politika bugünkü durumu anlatır (analitik SDK'sı yok);
  AdMob'un açılışta reklamı önden yüklediği ve UMP'nin her açılışta, her
  ülkede Google'a sorduğu da yazılı (§4; A4 incelemesinde eklendi). Metin
  pakete de gömülür (Ayarlar > Hakkında, §3); yer tutucu e-posta kalırsa
  yayın derlemesi durur. PLAY-KONSOL.md mağaza metinleri: TR kısa 78 / tam
  1377, EN kısa 77 / tam 1487 karakter.

## 6. Bu ortamın sınırı

Bulut ortamının ağ politikası `dl.google.com`'u engelliyor: Android SDK
burada indirilemez, APK burada derlenmez. Doğrulama: tsc, vitest (köprü
eklenti taklitleriyle), web derlemesinin değişmediği, `npx cap sync
android`'in geçtiği, Gradle dosyalarının elle denetimi. Asıl derleme ürün
sahibinin Windows makinesinde Android Studio ile (PLAY-KONSOL.md).

**A4 birleştirme ve denetim (24 Ekim 2026, dal `fitil/a4-android`):** A2
(köprü) ve A3 (görseller, belgeler) A1 üstünde birleşti; tek çakışma
`CLAUDE.md` notlarıydı. Denetlenen: tsc, vitest, `build:android` (+ `cap
sync`: 4 eklenti), `build:single` çıktısında Capacitor/AdMob/
native-purchases izi yok (yalnız Capacitor'süz `FitilYerel?.` okumaları),
web oynanış testi (`telefon`, `gelir`) değişmedi, web kipinde Capacitor
modülü hiç istenmiyor. Köprü tarayıcıda (`vite preview --mode android`,
eklentilerin web yedekleri) hatasız: `FitilYerel` kuruluyor, geri tuşu
(açılış/harita işlenmez, oyunda Duraklat, pencere kapanır), yaşam olayı,
Ayarlar gizlilik satırı ve Mağaza ("Şu an yok") çalışıyor. Elle okunan
Android dosyaları tutarlı: `namespace`/`applicationId`/test paket adı
`com.fenerkoyu.fitil`, `manifestPlaceholders.admobAppId` ↔ manifest
`APPLICATION_ID` meta-data, `mipmap-anydpi-v26` XML'lerinin andığı üç
katman her yoğunlukta var (108 dp; API 24–25 simgesi 48 dp), `splash_simge`
(288 dp) ve şablon boyutlu `splash.png`'ler, silinen şablon kaynaklarına
atıf kalmadı; `node scripts/magaza-gorselleri.mjs` birleşik dalda aynı
dosyaları baytı baytına yeniden üretiyor. Gradle/aapt2 bu ortamda
koşmadığı için kaynak derlemesi ilk kez Android Studio'da sınanır.

**A4 inceleme düzeltmeleri (24 Ekim 2026):** 13 bulgu doğrulandı ve
düzeltildi: açılış perdesinin yerel süre sınırı ve köprüsüz başlangıçta
perdenin kaldırılması (§3), reklam ekranı kapanmadan yeni reklam
yüklenmemesi, `geriYukle`'den `restorePurchases`'ın çıkması ve sarmalayıcı
sorgu süresinin kuyrukla uyumu, bekleyen ödemede `ITEM_ALREADY_OWNED` →
`beklemede`, ön plana dönüşte bekleyen alımların sorulması, uygulama içi
gizlilik politikası, `allowBackup="false"`, politikada UMP isteği, yayın
derlemesinin test kimliği/yer tutucu denetimi (§1 A7), Play simgesinin 32
bit RGBA olması (§4), PLAY-KONSOL'a ödeme profili (§6) ve AdMob'un mağaza
bağlantısı + incelemesi (§8 adım 9). Bu bulut ortamında `/opt/android-sdk` ve
Gradle önbelleği var: `ANDROID_HOME` = `/opt/android-sdk` iken `android`
klasöründe `./gradlew --offline :app:fitilReklamKimligiDenetimi` (ve
`bundleRelease --dry-run` ile görev sırası) denendi; test kimlikleriyle durur, `-PfitilTestReklam`
ile uyarıp geçer, aynı yayıncılı gerçek biçimli kimliklerle geçer, farklı
yayıncıda durur. Paket derlemesi (assemble/bundle) denenmedi.
