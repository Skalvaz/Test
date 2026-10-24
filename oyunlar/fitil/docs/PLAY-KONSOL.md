# FİTİL — Android Studio, Play Console ve AdMob rehberi

Ürün sahibi için adım adım liste (docs/ANDROID.md §5). Komutlar **Windows
PowerShell** içindir; depo klasöründe `oyunlar\fitil` altında çalıştırılır.
Kararlar: ANDROID.md §1 (A1–A10); ürünler ve fiyat önerileri: CAN-REKLAM.md
§4.

> Konsol ekranlarının adları ve sırası Google tarafından sık değişir. Bu
> belgede adı geçen bir menüyü bulamazsan konsolun arama kutusuna yaz.
> Politikaya ilişkin maddeleri (veri güvenliği, test şartları) göndermeden
> önce Google'ın güncel sayfasıyla karşılaştır.

## 1. Kurulum (bir kez)

1. **Node.js ≥ 22.18** (capacitor.config.ts bunu ister): `node -v` ile bak.
2. **Android Studio**: <https://developer.android.com/studio> adresinden en
   güncel kararlı sürümü kur. İlk açılışta "Standard" kurulumu seç; Android
   SDK, platform araçları ve gömülü Java (JBR) birlikte gelir.
3. Android Studio > **SDK Manager** > *SDK Platforms*: **Android 16 (API 36)**
   kurulu olsun (projenin compile/target SDK'sı 36). *SDK Tools*: Android SDK
   Build-Tools, Platform-Tools.
4. `npm run android:ac` Android Studio'yu bulamazsa, oturum için yolunu ver:

   ```powershell
   $env:CAPACITOR_ANDROID_STUDIO_PATH = 'C:\Program Files\Android\Android Studio\bin\studio64.exe'
   ```

## 2. Projeyi hazırla ve telefonda çalıştır

```powershell
cd C:\yol\Test\oyunlar\fitil      # deponun bulunduğu yer
npm ci                            # bağımlılıklar (ilk kez ve package-lock değişince)
npm run build:android             # Vite (dist-android) + cap sync android
npm run android:ac                # android\ klasörünü Android Studio'da açar
```

- `build:android` her web kodu değişikliğinden sonra yeniden çalıştırılır
  (web varlıkları ve Cordova eklenti klasörü git'te değil).
- Android Studio ilk açılışta Gradle eşitlemesi yapar (birkaç dakika). Hata
  verirse *File > Sync Project with Gradle Files*.

**Telefonda çalıştırma (USB hata ayıklama):**

1. Telefonda *Ayarlar > Telefon hakkında > Yapım numarası*'na 7 kez dokun
   (geliştirici seçenekleri açılır).
2. *Ayarlar > Sistem > Geliştirici seçenekleri > USB hata ayıklama*'yı aç.
3. Telefonu USB ile bağla, telefondaki "USB hata ayıklamaya izin ver"
   sorusuna **İzin ver** de.
4. Android Studio'da üstteki cihaz listesinden telefonu seç, **Run ▶**.

**İlk denemede bak:**

- Açılış perdesi gece mavisi, ortada kıvılcımlı fitil; sonra oyunun açılış ekranı.
- Haritada can hapı (fitil simgesi + sayı); 6. bölümden itibaren kaybedince can düşer.
- "Reklam izle" düğmesine basınca **deneme reklamı** açılır (köşesinde
  "Test Ad" yazar). Gerçek kimlikler girilmedikçe uygulama Google'ın herkese
  açık deneme kimliklerini kullanır (A7); bu normaldir.
- Satın alma ve fiyatlar, uygulama Play Console'a yüklenip ürünler
  oluşturulana kadar çalışmaz (§6, §7).
- Çentikli / hareketli gezinmeli telefonda HUD ve alt düğmeler çubukların
  altına girmemeli (ANDROID.md §3).
- Geri tuşu: açık pencereyi kapatır, oyunda Duraklat'ı açar; haritada ve
  açılış ekranında uygulamayı arka plana alır (çıkış onayı yok).

## 3. Yükleme anahtarı (upload key) ve Play App Signing

Play'e gönderilen paket **yükleme anahtarıyla** imzalanır; uygulamanın asıl
imza anahtarını Google saklar (**Play App Signing**, yeni uygulamalarda
zorunlu ve kendiliğinden açık).

```powershell
New-Item -ItemType Directory -Force "$HOME\fitil-anahtar" | Out-Null
& 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe' -genkeypair -v `
  -keystore "$HOME\fitil-anahtar\fitil-yukleme.jks" -alias fitil-yukleme `
  -keyalg RSA -keysize 2048 -validity 10000
```

- keytool parola, ad ve kurum sorar; parolayı bir parola yöneticisine yaz.
- **Anahtarı depoya koyma.** Depo dışında dursun (yukarıdaki klasör);
  `.gitignore` `*.jks` ve `*.keystore`'u zaten dışarıda bırakır.
- **Yedekle:** `.jks` dosyasını ve parolasını en az iki ayrı yerde sakla
  (ör. şifreli USB bellek + parola yöneticisinin dosya eki). Yükleme
  anahtarı kaybolursa Play Console'dan sıfırlama istenebilir ama günler sürer.

**İmzalı paket (AAB) üretme:**

1. Sürümü artır: `android\app\build.gradle` içinde `versionCode` (her
   yüklemede +1) ve `versionName` (ör. "1.0.1").
2. `npm run build:android` (gerçek reklam kimlikleri girildiyse, §8, önce onlar).
3. Android Studio: *Build > Generate Signed App Bundle or APK… > Android App
   Bundle* > anahtar dosyası `fitil-yukleme.jks`, takma ad `fitil-yukleme` >
   *release* > *Create*.
4. Çıktı: `android\app\release\app-release.aab` (git'e girmez).

**Yayın denetimi:** release derlemesi (`bundleRelease`, `assembleRelease`)
şu durumlarda **durur** ve nedenini yazar: AdMob uygulama kimliği ya da
ödüllü birim Google'ın test kimliği (§8 adım 3 yapılmamış), ikisi farklı
AdMob hesabının, gizlilik politikasında yer tutucu e-posta kalmış (§9).
AdMob kurulmadan önceki **ilk iç test paketi** (§5–§7 için) bilerek test
kimlikleriyle üretilir: Android Studio'da *Settings > Build, Execution,
Deployment > Compiler > Command-line Options* alanına `-PfitilTestReklam`
yaz, paketi üret, sonra alanı **boşalt** (ya da PowerShell'de
`cd android; .\gradlew bundleRelease -PfitilTestReklam`). Üretime giden
pakette bu bayrak olmaz.

## 4. Play Console: uygulamayı oluştur

<https://play.google.com/console> > **Uygulama oluştur**:

- Uygulama adı: **Fitil** · Varsayılan dil: **Türkçe – tr-TR** · Uygulama
  mı oyun mu: **Oyun** · Ücretsiz mi ücretli mi: **Ücretsiz** (uygulama içi
  satın alma ücretsiz uygulamada olur; ücretsiz sonradan ücretliye çevrilemez).
- **Paket adı uyarısı (A1):** paket adı ilk yüklenen AAB'den gelir:
  `com.fenerkoyu.fitil`. **İlk yüklemeden sonra hiçbir zaman değişmez.**
  Değiştirmek istiyorsan ilk yüklemeden ÖNCE `capacitor.config.ts` (`appId`)
  ve `android\app\build.gradle` (`namespace`, `applicationId`) birlikte
  değiştirilir.

## 5. İç test kanalı

1. *Test et ve yayınla > Test > Dahili test* > **Yeni sürüm oluştur** > AAB'yi
   yükle > sürüm notu > kaydet ve yayınla (inceleme genelde kısa sürer).
2. *Test kullanıcıları*: bir e-posta listesi oluştur (aile, tanıdıklar; Google
   hesaplarının Gmail adresleri).
3. Katılım bağlantısını (opt-in) test kullanıcılarına gönder; bağlantıdan
   "Test kullanıcısı ol" deyip Play Store'dan kurarlar.

> **Yeni kişisel hesap şartı:** 13 Kasım 2023'ten sonra açılmış kişisel
> geliştirici hesaplarında, üretime çıkmadan önce **kapalı testte en az 12
> test kullanıcısının 14 gün boyunca** katılmış olması istenir. Hesabın bu
> kapsamdaysa konsolun ana sayfası bunu gösterir; YAYIN.md aşama 4'teki
> kapalı test bu süreye denk getirilebilir.

## 6. Uygulama içi ürünler

İki ön koşul:

1. **Ödeme profili (satıcı hesabı):** Play Console > *Ayarlar > Ödeme
   profili* (ya da *Para kazanma kurulumu*) > ödeme profili oluştur ya da
   var olanı bağla: yasal ad, adres, banka hesabı, vergi bilgileri. Profil
   bağlanmadan konsol ücretli ürün oluşturmaya izin vermez. Google'ın
   doğrulaması birkaç gün sürebilir; erken başla. (AdMob'un ödeme profili
   ayrıdır, §8 adım 8.)
2. Faturalandırma kitaplığını içeren bir AAB herhangi bir kanala yüklenmiş
   olmalı (§5).

Sonra *Para kazanma > Ürünler > Uygulama içi ürünler* (yeni konsolda
"Tek seferlik ürünler"):

| Ürün kimliği (kodla aynı) | Ad (TR / EN) | Açıklama (TR / EN) | Önerilen fiyat |
|---|---|---|---|
| `can_doldur` | Canları doldur / Refill lives | Canlar hemen 5'e dolar / Lives refill to 5 at once | 0,99 USD |
| `guclendirici_paketi` | Güçlendirici paketi / Booster pack | 3 Kibrit, 2 Fişek Kalıbı, 2 Geri Sar / 3 Matches, 2 Rocket Molds, 2 Undos | 1,99 USD |
| `usta_karti` | Usta kartı / Master's Card | Reklamlı ödüller reklamsız gelir / Ad rewards without the ads | 4,99 USD |

- Ürün kimliği sonradan değişmez ve koddaki adla birebir aynı olmalı.
- **Tüketilir / kalıcı ayrımı konsolda seçilmez, kod yapar:** `can_doldur` ve
  `guclendirici_paketi` her alımdan sonra tüketilir (tekrar alınabilir);
  `usta_karti` yalnız onaylanır (kalıcıdır, "Satın alımları geri yükle" ile
  yeni cihaza gelir).
- Fiyatı USD girip "yerel fiyatlara dönüştür" de; Türkiye fiyatını istersen
  elle düzelt. Oyun fiyat yazısını her zaman mağazadan alır.
- Her ürünü **Etkin** yap.

## 7. Lisans test kullanıcıları (para ödemeden satın alma denemesi)

1. Play Console ana menü > *Ayarlar > Lisans testi*: test edecek Gmail
   adreslerini ekle, lisans yanıtı **RESPOND_NORMALLY**.
2. Aynı hesaplar iç test listesinde olsun ve uygulamayı **katılım
   bağlantısından Play Store ile** kursun (en sağlam yol).
3. Satın alma penceresinde "Test kartı, her zaman onaylar" seçeneği görünür;
   para çekilmez. "Test kartı, her zaman reddeder" ile hata yolu da denenir.
4. Dene: üç ürünü al; tüketilir ürün tekrar alınabilmeli; Usta kartıyla
   reklamlı ödül reklamsız gelmeli; uygulamayı silip kurunca Mağaza >
   "Satın alımları geri yükle" Usta kartını geri getirmeli (Android
   yedeklemesi kapalı, ANDROID.md §3: silince kayıt da gider, kart yalnız
   geri yüklemeyle gelir).

## 8. AdMob

<https://admob.google.com>:

1. **Uygulama ekle** > Android > (Play'de yayımlandıysa mağazadan seç, henüz
   değilse "listelenmemiş" olarak ekle; o zaman adım 9 yayından sonra
   zorunlu) > ad: Fitil. Çıkan **uygulama kimliği**:
   `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`.
2. **Reklam birimi ekle** > **Ödüllü** > ad: "Fitil ödüllü". Ödül ayarı
   önemli değil (oyun ödülü kendisi verir). Çıkan **birim kimliği**:
   `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`.
3. Gerçek kimlikleri **depoya girmeyen** iki dosyaya yaz (A7):

   ```powershell
   # AdMob uygulama kimliği → android\local.properties (Android Studio sdk.dir'i de buraya yazar; üzerine yazma, ekle)
   Add-Content -Path android\local.properties -Value 'ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY'
   # Ödüllü birim kimliği → .env.android.local (Vite yalnız android kipinde okur)
   Set-Content -Path .env.android.local -Value 'VITE_ADMOB_ODULLU=ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ'
   npm run build:android
   ```

   Dosyalar yoksa uygulama deneme kimliklerini kullanır (hata ayıklama
   derlemesinde; yayın derlemesi durur, §3). İkisi de `.gitignore`'da;
   commit'e girmediğini `git status` ile doğrula.
4. **Test cihazı:** gerçek kimliklerle geliştirirken kendi telefonunu
   *Ayarlar > Test cihazları*'na ekle (telefonun reklam kimliği: *Ayarlar >
   Google > Reklamlar*). Kendi gerçek reklamına dokunmak hesabı askıya
   aldırabilir.
5. **Gizlilik ve mesajlaşma** > *Avrupa yönetmelikleri* (GDPR) > mesaj
   oluştur: uygulama Fitil, dil Türkçe + İngilizce, "Yönet" seçeneği açık,
   gizlilik politikası URL'si (§9). Yayımla. Form yalnız AEA, Birleşik
   Krallık ve İsviçre'deki oyunculara gösterilir; oyun ilk açılışta UMP ile
   sorar ve gerekirse Ayarlar'da "Reklam gizlilik seçenekleri" satırını açar.
6. **Engelleme denetimleri > Reklam içeriği derecelendirmesi:** en çok **PG**
   (oyun istekte de PG gönderir, A9). Hassas kategorilerde kumar, alkol vb.
   kapalı kalsın.
7. **app-ads.txt:** Play mağaza girişinde bir geliştirici web sitesi
   verirsen, AdMob'un gösterdiği satırı o sitenin kökünde `app-ads.txt`
   dosyasına koy (reklam doluluğunu korur).
8. Ödeme almak için *Ödemeler* bölümünde ödeme profilini tamamla.
9. **Mağazaya bağla ve incelemeyi bekle** (uygulama "listelenmemiş"
   eklendiyse): Fitil Play'de herkese görününce (üretim ya da açık test)
   AdMob > *Uygulamalar > Fitil > Uygulama ayarları > Uygulama mağazası
   ayrıntıları* > **Ekle** > Google Play'de Fitil'i seç. AdMob ardından
   uygulamayı inceler; durum **Hazır** olana dek reklam sunumu sınırlıdır.
   Bu adım atlanırsa gerçek oyuncularda ödüllü reklam yüklenmez: "Reklam
   izle" düğmesi görünmez ya da "Şu an reklam yok" çıkar (+1 can ve +5
   hamle ödülleri çalışmaz). Durumu AdMob ana sayfasındaki uyarılardan izle.

## 9. Gizlilik politikası URL'si

Play ve AdMob, **herkese açık** bir gizlilik politikası adresi ister.

1. `docs\gizlilik.html` içinde iki yer tutucuyu değiştir: `[Geliştirici adı]`
   ve `iletisim@ornek.com` (Türkçe ve İngilizce bölümlerde; bul-değiştir).
2. Sayfayı giriş gerektirmeyen, kalıcı bir adreste yayımla (ör. kendi alan
   adın ya da herkese açık bir GitHub Pages deposu). Tek dosyadır, dış kaynak
   yüklemez.
3. Adresi Play Console *Uygulama içeriği > Gizlilik politikası* alanına ve
   AdMob GDPR mesajına yaz.
4. **Uygulamanın içinde:** Play, politikanın uygulamada da yayımlanmasını
   ister. `docs\gizlilik.html` pakete gömülür ve oyunda *Ayarlar > Hakkında
   > Gizlilik politikası*'nda açılır (ağ gerekmez). Yer tutucuları
   değiştirdikten sonra `npm run build:android` çalıştır; yer tutucu kalırsa
   yayın derlemesi durur (§3). Politikayı her değiştirdiğinde yayımlanan
   sayfayı da aynı dosyayla güncelle.
5. Politika bugünkü durumu anlatır: oyunda hesap ve sunucu yok, ilerleme ve
   ölçüm günlüğü yalnız cihazda (Android yedeklemesi kapalı), AdMob ve Play
   Billing Google'ın politikalarıyla; UMP onay isteği her açılışta her
   ülkede gider. Oyuna veri toplayan yeni bir şey eklenirse (ör. analitik
   SDK'sı) politika ve Veri güvenliği formu birlikte güncellenir.

## 10. Uygulama içeriği beyanları (Play Console > Politika > Uygulama içeriği)

### 10.1 Reklamlar

"Uygulamanız reklam içeriyor mu?" → **Evet** (ödüllü reklam).

### 10.2 Reklam kimliği

AD_ID izni var (A1). "Reklam kimliği kullanıyor musunuz?" → **Evet**;
amaçlar: **Reklamcılık veya pazarlama**, **Analiz** (reklam ölçümü),
**Sahtekarlığı önleme, güvenlik ve uyumluluk** (Google Mobile Ads SDK'sının
kullanımları).

### 10.3 Uygulama erişimi

"Tüm işlevler özel erişim olmadan kullanılabilir" (hesap, giriş yok).

### 10.4 Hedef kitle ve içerik (A9)

- Hedef yaş grupları: **13–15, 16–17, 18 ve üzeri**. 13 yaş altı seçilmez.
- Gerekçe: 13 yaş altı seçilirse uygulama **Aileler politikasına** girer
  (çocuklara uygun reklam düzeni, ek denetimler). Fitil her yaştan
  yetişkinin (aile içi) oynadığı sakin bir bulmaca; reklam yalnız istekle ve
  ödüllü, satın alma ekranında baskı yok. AdMob isteklerinde
  `tagForChildDirectedTreatment: false` ve en çok PG içerik
  (`MaxAdContentRating.ParentalGuidance`).
- "Uygulamanız istemeden çocukların ilgisini çekebilir mi?" sorusunu dürüst
  yanıtla: renkli ve sevimli görseller nedeniyle Google inceleme sonrası
  "çocuklara da hitap ediyor" diyebilir. O durumda iki yol var: mağaza
  metnini ve görselleri yetişkin/aile oyuncusuna göre netleştirmek ya da
  Aileler politikasına uymak (çocuklara yönelik reklam ayarı, Aileler
  programına uygun reklam SDK'sı ayarları). Karar ürün sahibinin.

### 10.5 İçerik derecelendirmesi (IARC anketi)

E-posta + kategori **Oyun**. Önerilen yanıtlar:

| Soru | Yanıt | Not |
|---|---|---|
| Şiddet | Hayır | Patlamalar renkli kapsüllerin havai fişek gibi açılması; kimse zarar görmez |
| Korku, korkutucu içerik | Hayır | |
| Cinsellik, çıplaklık | Hayır | |
| Küfür, kaba dil, kaba mizah | Hayır | |
| Uyuşturucu, alkol, tütün | Hayır | |
| Kumar (gerçek ya da benzetim) | Hayır | Sandıklar oyunla kazanılır, parayla satılmaz |
| Rastgele öğe satın alma (ganimet kutusu) | Hayır | Satılan ürünlerin içeriği sabit (§6) |
| Kullanıcılar etkileşir / iletişim kurar | Hayır | Sohbet, kullanıcı içeriği yok |
| Kullanıcının konumunu paylaşır | Hayır | |
| Dijital ürün satın alma | **Evet** | Uygulama içi satın alma |
| Sınırsız internet erişimi (tarayıcı vb.) | Hayır | |

Beklenen sonuç: PEGI 3, ESRB Everyone, USK 0 ve "Uygulama İçi Satın Alma"
bildirimi.

### 10.6 Veri güvenliği formu (önerilen yanıtlar — doğrula)

Fitil'in kendisi veri toplamaz ve göndermez; formda beyan edilen veriler
**Google Mobile Ads SDK'sının (AdMob)** topladıklarıdır. Google'ın güncel
listesini mutlaka buradan kontrol et ve formu ona göre doldur:
<https://developers.google.com/admob/android/privacy/play-data-disclosure>
(UMP onay SDK'sı için de aynı sitede açıklama var).

- "Uygulamanız gerekli kullanıcı veri türlerini topluyor ya da paylaşıyor mu?"
  → **Evet** (reklam SDK'sı nedeniyle).
- "Toplanan tüm veriler aktarım sırasında şifreleniyor mu?" → **Evet**.
- "Kullanıcılar verilerinin silinmesini isteyebilir mi?" → hesap ve sunucu
  yok; cihazdaki oyun verisi uygulama verisi temizlenince silinir, reklam
  kimliği Android ayarlarından sıfırlanır/silinir. Google'ın güncel
  seçeneklerine göre yanıtla (gizlilik politikası §3, §4 ile tutarlı).
- Veri türleri (AdMob açıklamasına göre; "toplanan" mı "paylaşılan" mı
  olduğunu Google'ın sayfasından birebir al):

  | Veri türü | Amaç (AdMob) |
  |---|---|
  | Konum > **Yaklaşık konum** (IP adresinden) | Reklamcılık, analiz, sahtekarlığı önleme |
  | Uygulama etkinliği > **Uygulama etkileşimleri** (reklam gösterimi, dokunma) | Reklamcılık, analiz, sahtekarlığı önleme |
  | Uygulama bilgileri ve performans > **Kilitlenme günlükleri**, **Tanılama** | Analiz, sahtekarlığı önleme |
  | Cihaz veya diğer kimlikler > **Cihaz ya da diğer kimlikler** (reklam kimliği, uygulama grubu kimliği) | Reklamcılık, analiz, sahtekarlığı önleme |

- Beyan **edilmeyenler:** satın alma geçmişi ve ölçüm günlüğü cihazdan
  çıkmaz; Play Billing ödemesini Google Play işler (uygulama toplamaz). Ad,
  e-posta, kişiler, fotoğraf, ses, dosya, tam konum yok.

### 10.7 Diğer beyanlar

Devlet uygulaması, finansal özellikler, sağlık, haber: **Hayır**.

## 11. Mağaza girişi

*Büyüme > Mağazadaki varlık > Ana mağaza girişi*. Türkçe varsayılan;
**İngilizce (ABD) – en-US** çevirisini *Çeviri ekle* ile ekle.

- Uygulama kategorisi: **Oyun > Bulmaca**. Etiketler: bulmaca, eşleştirme.
- İletişim e-postası (herkese görünür): yer tutucu yerine gerçek adres.
- Görseller (`magaza\play\`; yeniden üretim §12):

  | Alan | Türkçe giriş | İngilizce giriş |
  |---|---|---|
  | Uygulama simgesi (512×512, 32 bit PNG, alfa kanallı ama saydam piksel yok) | `simge-512.png` | aynı dosya |
  | Öne çıkan görsel (1024×500) | `one-cikan-1024x500.png` | `one-cikan-1024x500_en.png` |
  | Telefon ekran görüntüleri (1080×1920) | `ekran-tr-01.png` … `ekran-tr-06.png` | `ekran-en-01.png` … `ekran-en-06.png` |

  Kareler: açılış, öğretim (el ipucu), büyük reaksiyon ("ŞENLİK!"), süslü
  kasaba haritası, Kazandın (3★ + mühürler), Kasaba paneli. Tablet
  görüntüleri isteğe bağlı (ANDROID.md §4).

### Türkçe metinler

**Uygulama adı (≤ 30):** Fitil

**Kısa açıklama (≤ 80):**

> Aynı renkleri bir çizgiyle bağla, fitili tutuştur, geceyi fişeklerle aydınlat.

**Tam açıklama (≤ 4000):**

> Fitil, Fener Koyu'nda geçen sakin bir eşleştirme bulmacası. Parmağınla aynı renkteki kapsülleri tek bir çizgiyle bağla; fitil tutuşsun, kapsüller havai fişek gibi patlasın. Isı biriktir, zincirleri büyüt, geceyi tutuştur.
>
> NASIL OYNANIR
> • Aynı renkten en az üç kapsülü bir çizgiyle bağla ve bırak.
> • Uzun zincirler özel taş verir: 6'lık zincir Roket, 9'luk Kasımpatı, 12'lik Yıldız topu.
> • Dev fişekleri doldur, Körük'le istediğin yeri ısıt, hedefleri hamlelerin bitmeden tamamla.
>
> NE VAR?
> • 8 mahallede 40 bölüm: İskele'den Kale'ye ve 8 Usta Bölümü.
> • Kasabayı süsle: bölümlerden kazandığın kandillerle 48 süsleme (fenerler, bayraklar, deniz feneri…).
> • Bölüm Mühürleri: bölümlerde Çırak, Kalfa ve Usta görevleri.
> • Günün Şenliği ve Sonsuz Şenlik; Fişek Defteri'nde desen ve fitil koleksiyonu.
> • Renk körü paleti ve yüksek kontrast seçeneği. Türkçe ve İngilizce.
> • İnternetsiz oynanır (reklam ve satın alma için bağlantı gerekir).
>
> ADİL OYUN
> • Reklam yalnız sen isteyince: +1 can ya da +5 hamle için. Zorunlu ara reklam ve afiş yok.
> • 5 can; her 30 dakikada 1 can dolar. İlk 5 bölüm, Günün Şenliği ve Sonsuz Şenlik can harcamaz; kazandığın bölüm can yemez.
> • Bütün bölümler reklam izlemeden ve satın almadan bitirilebilir.
> • Küçük satın almalar: canları doldur, güçlendirici paketi, Usta kartı (ödüllü reklamların ödülü reklamsız gelir).
>
> Hesap yok; ilerlemen cihazında kalır.

### İngilizce metinler (en-US)

**App name (≤ 30):** Fitil

**Short description (≤ 80):**

> Link same-colored capsules, light the fuse and fill the night with fireworks.

**Full description (≤ 4000):**

> Fitil is a calm matching puzzle set in Lantern Cove. Link capsules of the same color with a single line of your finger; the fuse catches and the capsules burst like fireworks. Build up heat, grow your chains and light up the night.
>
> HOW TO PLAY
> • Link three or more capsules of the same color with one line, then let go.
> • Long chains make special stones: a chain of 6 makes a Rocket, 9 a Chrysanthemum, 12 a Star Ball.
> • Fill Giant Fireworks, heat any spot with the Bellows, and clear your goals before you run out of moves.
>
> WHAT'S INSIDE
> • 40 levels across 8 neighborhoods, from the Pier to the Castle, plus 8 Master levels.
> • Decorate the town: spend the lamps you earn in levels on 48 decorations (lanterns, flags, a lighthouse…).
> • Level Seals: Apprentice, Journeyman and Master tasks in levels.
> • Daily Festival and Endless Festival; collect patterns and fuses in the Firework Album.
> • Colorblind palette and a high-contrast option. English and Turkish.
> • Play offline (ads and purchases need a connection).
>
> FAIR PLAY
> • Ads only when you ask: for +1 life or +5 moves. No forced interstitials, no banners.
> • 5 lives; one life refills every 30 minutes. The first 5 levels, the Daily Festival and the Endless Festival cost no lives, and a level you win costs none.
> • Every level can be finished without watching ads or paying.
> • Small purchases: refill lives, a booster pack, and the Master's Card (rewards from ads without the ads).
>
> No account; your progress stays on your device.

## 12. Görselleri yeniden üretme

Kaynaklar `magaza\kaynak\*.svg` (simge katmanları, tek renk katman, öne
çıkan görsel). Betik: `scripts\magaza-gorselleri.mjs` (Playwright Chromium).

```powershell
npx playwright install chromium                      # bir kez (betiğin tarayıcısı)
node scripts/magaza-gorselleri.mjs                   # Android simgeleri + açılış perdesi + Play simgesi/öne çıkan görsel
node scripts/magaza-gorselleri.mjs onizleme $env:TEMP\fitil-onizleme   # maskeli simge + Android 12 perde denetimi
# Ekran görüntüleri: önce ayrı bir pencerede `npm run dev`
node scripts/magaza-gorselleri.mjs ekran http://localhost:5173/          # TR + EN, 6'şar kare
node scripts/magaza-gorselleri.mjs ekran http://localhost:5173/ en kazandin   # tek dil / tek sahne
```

Her PNG'ye üretimden sonra göz at (simge küçük boyda okunuyor mu, kare
geçiş anında mı).

## 13. Yayın öncesi kontrol listesi

- [ ] Ödeme profili (satıcı hesabı) Play Console'a bağlı (§6).
- [ ] Gerçek AdMob kimlikleri `android\local.properties` ve `.env.android.local`'da; `git status` temiz.
- [ ] `versionCode` artırıldı; `npm run build:android`; imzalı AAB `-PfitilTestReklam` OLMADAN üretildi (yayın denetimi geçti, §3).
- [ ] Gizlilik politikası yayında; yer tutucular değişti; URL Play ve AdMob'da; oyunda Ayarlar > Hakkında > Gizlilik politikası açılıyor.
- [ ] Uygulama içerik beyanları (reklamlar, reklam kimliği, hedef kitle 13+, IARC, veri güvenliği) tamam.
- [ ] Üç ürün etkin; lisans testçisiyle satın alma ve geri yükleme denendi.
- [ ] GDPR mesajı yayında; AEA dışında da reklam açılıyor.
- [ ] Yayından sonra: AdMob uygulaması Google Play girişine bağlandı ve durumu **Hazır** (§8 adım 9).
- [ ] İç testte en az bir cihazda: açılış perdesi, güvenli alan, geri tuşu, ses, reklam, satın alma.
- [ ] Mağaza girişi TR + EN metinler ve görseller yüklendi.
