# FİTİL — çalışma notları

Turbofan'dan BAĞIMSIZ bir alt proje: eşleştirmeli bulmaca oyunu (Canvas 2D +
DOM + TypeScript + Vite). Kök CLAUDE.md'deki turbofan maddeleri (motor,
three.js, kayıt sahneleri, M5a) burada geçerli DEĞİL; dil ve commit kuralları
geçerli: kullanıcıyla, kod yorumlarında ve commit mesajlarında Türkçe.

- Tasarım belgesi: `docs/GDD.md` (bağlayıcı; § numaralarıyla atıf yap).
- Kancalar (Bölüm Mühürleri + Kasaba İşleri, kandil, kayıt şeması 3):
  `docs/KANCALAR.md` (GDD eki; §A–§F). Kod: `src/meta/muhur.ts` (koşul dili,
  değerlendirme), `src/meta/kasaba.ts` (türetilmiş kandil, işler),
  `KASABA_ISLERI` (`src/app/katalog.ts`), mühür verisi `bNNN.json`
  `"muhurler"`. Mühür ölçümü: `npm run bot -- --muhur` (`src/bot/muhurOlcum.ts`;
  aşağıda), ekonomi: `scripts/kanca/kasaba-ekonomi.py`. Kandil bakiyesi
  SAKLANMAZ, türetilir; mühür koşulları final gösterisini saymaz.
- Kasaba ekonomisi ve kayıt: `kandilKazanimi` (önceki → yeni döküm farkı,
  `Odul kandil` için), `kancaBirlestir` (bulut + tarayıcı: seçilen kayda
  öbüründen mühür maskeleri VEYA, eksik işler kurallar/bütçeyle, günlük
  kandil gün kümesi birleşimi); `SaveStore` `merge`/`tooNew` + `pickMerged`
  (anahtar sırasından bağımsız), yeni şemalı kayıtta salt okunur depo, eski
  sekmenin şema 2 yazımında açılışta yedekten tamamlama (KANCALAR §D.7),
  `Kayitci.bulutUygula` iki yönde birleştirir. Gerçek şema 2 kayıt örnekleri
  `src/meta/_test/kayitlar/` (yayındaki `fitil.html` @5c88078 botla oynanıp
  localStorage'dan alındı); göç testleri `kayitOrnekleri.test.ts`.
- Harita süsleri: `src/ui/harita/susler.ts` (dışa açık), `susIlkel.ts`
  (fener, bayrak, alev, ışık; `Cizim` toplayıcı), `isCizimleri.ts` (48 iş).
  Yerleşim (Ekim 2026, kullanıcı "yerleşim daha iyi olmalı" dedi): her iş
  sahnede gerçek bir şeye oturur ya da asılır (teras, bina kapısı/cephesi/
  çatısı, saçak, deniz); düğüm, yıldız, mahalle şeridi, Usta rozeti ve
  tabelayla çakışmaz, yolun üstüne dolu parça koymaz; ilk düğümle şerit
  arası boş kalır (eski "giriş yuvası" kaldırıldı). Kapı/kemer işleri bina
  kapılarında; İskele'nin kemer, kayık fenerleri ve deniz feneri alt payda
  (katman `kiyi`, alt payın SVG'sine yolun üstüne). Denetim:
  `node scripts/kasaba-yerlesim.mjs http://localhost:5173 <klasör> 390 844`
  (ve 360 640): çakışma 0 olmalı; kaplamalı görüntüye bak. Düğüm lambasından
  karşı kenara "cep ipi" (fener/flama dizisi); canlı ipler tablette
  `.f-harita-bolge { overflow-x: clip }` ile kesilir. Katalog `yer` =
  `isCapasi` (test; İskele kıyı işleri alt payda). İş başına en çok 1 canlı öğe (`Cizim.canliSiniri`;
  mahalle ≤ 6, ip + fenerler tek öğe skewX ile sallanır); fazlası durağan
  yedekle çizilir. Yeni iş `harita(vm)` önceki modelde yoksa kutlanır (1–2
  iş; toplu değişiklikte yok), mahalle 6/6 olduysa `senlik(m)`;
  `Arayuz.haritaKutlamasi()` bitince Defter kartı. Önizleme:
  `dev/kasaba.html?mahalle=0..7&isler=bos|yarim|tam|<n>|<id,…>&kutla=<id>&senlik=<m>&temiz=1&sancak=1|yarim&az=1`.
  Süssüz `bolgeCiz` çıktısı eskisiyle birebir (test). Önizlemeler
  (`src/ui/harita/onizleme.ts`): Kasaba panelinde her işin haritadaki
  küçük resmi (gizli kaynakta `sahneParcalari` + `<use>`, işin katmanları
  terasların arasına girer; kırpma işin kutusundan 4:3, kimliğe göre
  önbellekli), kasaba kartı kapağında süslenmiş mahallenin kartpostalı (en
  çok çapayı içine alan bant). İskele tabelası haritada HTML; önizlemede
  `tabelaSvg`.
- Menü düzeni "Liste" (Ekim 2026, kullanıcı seçti; her yaş okusun): en küçük
  yazı ~16 px, önemli satır 18–22 px. Bölüm kartı: ad + hedefler büyük yazılı
  liste (ikon + metin, hamle ve kurallar aynı listede) + tek satır "Mühürler
  1/3" + [Oyna] (mahalle çipi, yıldız/en iyi, tablo, yeni öğe, Coşku kartı
  YOK; mühür görev metinleri Duraklat'ta, ilk mühürlü kartta `MK.muhurKart`
  balonu). Kazandın: kurdele, tek satır bölüm, yıldız, mühür, puan, en çok iki
  haber, ödül satırları (kandil, güçlendirici, "Sandığı aç"), yuvarlak Tekrar +
  Devam; tablo kutusu ve tanıtım balonları yok. HUD hamle yuvarlağında yalnız
  sayı. Kullanıcı yazı kalabalığına ve küçük yazıya duyarlı: yeni metin
  eklerken kısa tut, satır sayısını artırma.
- Dil (Ekim 2026): Türkçe + İngilizce. `src/platform/dil.ts`: sayfa dili
  açılışta BİR KEZ (`?dil=tr|en`, cihazda `fitil-dil`; yoksa kaydı olan eski
  oyuncu Türkçe, yeni oyuncu cihaz dili; ilk karar yazılır) ve sayfa boyunca
  sabit; Ayarlar > Görünüm > Dil değişince kayıt hemen yazılır, sayfa yeniden
  yüklenir. Metinler yerinde `t('Türkçe', 'English')` (işlev de olur), sayı
  ve tarih `YEREL`, büyük harf `buyukHarf`. Türkçe çıktı birebir korunur
  (testler). Bölüm metinleri `src/levels/metin.en.json` (`levels/metin.ts`),
  mühürler `muhurMetniEn` (≤ 29 karakter), üretilen Günün/Sonsuz adı ana
  iş parçacığında (`uretim.ts` `adla`). Terim sözlüğü: Fener Koyu → Lantern
  Cove, İskele/Çarşı/Liman/Saat Kulesi/Bahçeler/Tepe/Fabrika/Kale → Pier/
  Bazaar/Harbor/Clock Tower/Gardens/Hilltop/Factory/Castle, kandil → lamp,
  mühür → seal (Apprentice/Journeyman/Master), Kıvılcım Usta → Master Spark,
  Coşku Serisi → Cheer Streak, Fener Nöbeti → Lantern Watch. Yeni metin
  eklerken iki dili birlikte yaz. Denetim: `src/dil/*.test.ts` (İngilizce
  tablolarda Türkçe harf yok) ve `node scripts/dil-tara.mjs <url> <klasör>`
  (60 ekran, `?gelir=sahte` katmanları dahil; 0 kalıntı olmalı). Playwright araçları `locale: 'tr-TR'` ile
  açılır (yoksa cihaz dili İngilizce sayılır).
- Yayın ve gelir (Ekim 2026 kararı): `docs/YAYIN.md` — Android (Play Store),
  yumuşak can + yalnız istekle ödüllü reklam + küçük satın alma; claude.ai/tek
  dosya sürümünde yok. Ölçüm: `src/platform/olcum.ts` (kişisel veri yok, ağ
  isteği yok; yerel halka günlük `fitil.olcum.v1`, Android'de
  `window.FitilYerel.olay` köprüsü), olay sözlüğü `docs/OLCUM.md`, test kancası
  `__fitil.olcum()` (olaylar + özet: bölüm hunisi, ilk oturum, günler).
  Ayarlar > Oyun özeti (Hakkında'nın üstü): ölçümün ömür boyu toplamlarından
  (`olcum.toplam()`; halka günlük dolsa da doğru) ekran görüntüsü için özet
  (`app/oyunOzeti.ts`, `ui/ekranlar/oyunOzeti.ts`; buluta gitmez, aile
  testinde oyuncu görüntüyü gönderir; OLCUM.md sonu). `sure` etkin süredir
  (arka plan, Duraklat, mola düşülür; `Oturum.olcumDurak`).
  İlk dakikalar denetimi: `node scripts/ilk-dakikalar.mjs <url> <klasör> [son]`
  (yeni oyuncu, gerçek hız; araya giren her balon/modal/bant metni, kelime,
  süre tahmini → `rapor.md`). Sonuçlar `docs/YAYIN.md` "Aşama 1 denetimi".
- Can + reklam + satın alma (aşama 2, `docs/CAN-REKLAM.md`; §13 sözleşme ve
  G4 notu): yalnız gelir sağlayıcısı varken (`platform/gelir.ts`
  `gelirSaglayici()`; Android köprüsü `window.FitilYerel.gelir`, web'de
  deneme `?gelir=sahte` ya da cihazda `localStorage` `fitil.gelir` =
  `sahte`; `?reklam=hizli|yok|hata`, `?satin=iptal|hata`, `?gelir=yok`).
  Yoksa (claude.ai, `fitil.html`) can, reklam, Mağaza ve gelir ölçümü yok.
  Kayıt mantığı `meta/can.ts` (saf; `simdi` duvar saati, `bugun` yyyymmdd;
  `k.can`/`k.gelir` olmayabilir), sahte sağlayıcı `platform/gelirSahte.ts`,
  ekranlar `ui/ekranlar/can.ts`, `magaza.ts` (önizleme `dev/arayuz.html?ekran=can|magaza|kaybettin&v=…`),
  akış `app/gelirAkisi.ts` (`Uygulama.gelir`, oturuma `gelir`). Test
  kancası `__fitil.gelir()`, `__fitil.canAyarla(n)`; oynanış profili
  `gelir` (yalnız adıyla; §11 adımları), gelirsiz profiller can hapı/Mağaza/
  reklam düğmesi YOK denetler.
- Android (aşama 3, `docs/ANDROID.md`): kipler — web `build` / `build:single`
  (Capacitor kodu GİRMEZ; `fitil.html`'de `Capacitor`, `admob` geçmemeli),
  Android `npm run build:android` (`--mode android` → `dist-android/` + `cap sync
  android`; `main.ts` `platform/android/index.ts` `androidKur()`'u bekler).
  Köprü `src/platform/android/`: `index.ts` (`window.FitilYerel` eşzamanlı:
  `gelir`, `olay` boş (Firebase ertelendi), `gizlilik`, `hazir`), `reklam.ts`
  (UMP onay → initialize → ödüllü ön yükleme; sonuç olaylardan), `satin.ts`
  (Play Billing tek kuyrukta, elle tüket/onayla), `kopru.ts` (JSON biçimi),
  `yasam.ts` (açılış perdesi, geri tuşu, appStateChange). Uygulama tarafı
  Capacitor'süz `platform/yerel.ts` (`fitil-geri`/`fitil-yasam` olayları,
  `yerelHazir`, `gizlilikSecenekleri`). Testler eklentileri `vi.mock` ile
  taklit eder. Kimlikler: geliştirmede Google TEST (`.env.android`); gerçekleri
  git'e girmeyen `android/local.properties` `ADMOB_APP_ID` ve
  `.env.android.local` `VITE_ADMOB_ODULLU`. Bu ortamda APK derlenmez;
  `npm run build:android` sonrası `npx vite preview --mode android` köprüyü
  eklentilerin web yedekleriyle açar (A4'te denendi: hata yok; AdMob yedeği
  onay "gerekli" der → Ayarlar'da gizlilik satırı görünür, kapanış olayı
  olmadığı için reklam 60 sn sonra `odul`; fatura yok → Mağaza "Şu an yok";
  native-purchases yedeği her çağrıda `console.error` yazar, beklenen).
  Köprünün dinleyicileri tarayıcıda `Capacitor.Plugins.App.notifyListeners
  ('backButton' | 'appStateChange', …)` ile tetiklenebilir.
- Android simgesi, açılış perdesi ve Play görselleri (aşama 3, `docs/ANDROID.md`
  §4): kaynak `magaza/kaynak/*.svg`, üretim `node scripts/magaza-gorselleri.mjs`
  (`simge`, `play`, `ekran <url> [tr|en] [sahne,…]`, `onizleme <klasör>`);
  çıktılar `android/app/src/main/res/` ve `magaza/play/`. Ürün sahibinin
  Play Console/AdMob rehberi `docs/PLAY-KONSOL.md`, gizlilik `docs/gizlilik.html`.
- Görsel dil: mevcut tasarım (gece kasabası, ahşap HUD, parlak kapsüller)
  korunur. Kullanıcı "Kibrit Kutusu" (matbaa baskısı) ve "Kesme Kâğıt"
  (origami) yönlerini reddetti, mevcut hâli daha güzel buldu (`docs/tasarim/`).
  İyileştirme mevcut dilin içinde, öğe öğe yapılır.
- Sözleşmeler: `src/core/types.ts` (durum, olaylar, bölüm verisi),
  `src/core/index.ts` (çekirdek API), `src/app/sozlesme.ts` (çizici, girdi, ses).
  Sözleşmede var olan bir alanın anlamını değiştirme; alan eklemek serbest.

## Komutlar (proje klasöründe: `oyunlar/fitil`)

```powershell
npm ci                      # yeni worktree'de ilk iş (node_modules izlenmez)
npm run dev                 # http://localhost:5173 (telefondan aynı ağda IP:5173)
npm test                    # vitest
npm run typecheck
npm run build:single        # → fitil.html + dist-single/artifact.html
npm run build:android       # → dist-android/ + cap sync android (docs/ANDROID.md §2; APK Android Studio'da)
npm run bot -- --bolum 12 --tohum 200 --bot usta
npm run dogrula             # bölüm doğrulama (bot bantları)
npm run dogrula -- --bolum 11-15 --tohum 30          # --tohum: tohum SAYISI
npm run dogrula -- --dosya deneme/ --tohum 30        # varyant JSON'ları (klasör ya da dosya)
npm run kalibre -- --bolum 12                        # 500 tohum, yildizEsikleri yazar, hamle önerir
npm run kalibre -- --bolum 6-25 --kural k24          # K24 eşikleri (+500 Acemi), "esikKurali": "k24" yazar
npm run bot -- --dagilim --bolum 1-12 --tohum 100 --acemi-tohum 60   # Usta+Acemi kazanma, 1/2/3★, puan yüzdelikleri, K22 önerisi
npm run bot -- --muhur --bolum 6-40 --tohum 150 --acemi-tohum 300 --bas 2000   # mühür oranları, bant, eşik önerisi (2 işçi)
npm run bot -- --muhur --bolum 22 --katalog          # + bölüme uyan aday mühürlerin eşik tablosu (--aday DOSYA: ek koşullar)
node scripts/shot.mjs <url> <png> [w] [h] [bekleme-ms] [js]   # telefon görünümü (390×844)
npm run oynanis -- http://127.0.0.1:5185/ playtest-output [telefon|masaustu|kucuk]   # tam akış duman testi
npm run oynanis -- http://127.0.0.1:5185/ playtest-output goc,goc600   # şema 2 kaydının göçü + kasaba + mühür (390×700, 375×600)
npm run oynanis -- http://127.0.0.1:5185/ playtest-output gelir         # can + reklam + Mağaza (?gelir=sahte&reklam=hizli, CAN-REKLAM §11)
```

Oynanış testi (`scripts/oynanis.mjs`) dev sunucusuna ya da `file://…/fitil.html`'e
karşı koşar: açılış → bölüm 1 (zorunlu ilk hamle gerçek dokunmatik sürüklemeyle)
→ bot ile 1–6 ve 10 → kazandın/kaybettin (Tekrar dene < 1 sn ölçülür) → harita →
ayarlar → defter → Günün Şenliği (14'ten önce kilit metni; 11–14 `kayitYama` ile
kazanılınca açılır); pageerror/console.error başarısızlıktır.
Meta açılışları (Ekim 2026, GDD K25): Günün Şenliği 14. bölümden sonra
(`GUNLUK_ACILIS_BOLUMU`), Usta n = 15·n★ VE 12. bölüm (`USTA_ACILIS_BOLUMU`,
`ustaKilidi`/`ustaAcikMi`); eski kayıt koruması `gunlukGecmisiVar` (görev günü,
sonuç, istatistik; Fener Nöbeti sayılmaz) ve oynanmış Usta kaydı. Göç yok;
eski kuralla açılıp oynanmamış Usta 12'ye dek yeniden kilitlenir (K25). Görev
17'nin (Günün Şenliği'ni kazan) kapısı günlüğün kendisi (`acilis: 1`).
Kanca adımları: 3. bölümden sonra ilk kandil balonu → Kasaba paneli → ilk iş
(kıvılcım, ışıklar, sakin); 6. bölüm Kazandın'da mühür tanıtımı; 7. bölüm
kartında mühür bloğu, oyunda rozet ve "tuttu" uçuşu. `goc`/`goc600` profilleri
(yalnız adıyla seçilince koşar) yayındaki şema 2 sürümünün localStorage'ını
(`src/meta/_test/kayitlar/`) sayfa açılmadan kurar: göç denetimi (yıldız,
rozet, koleksiyon, istatistik aynen; mühür geriye dönük yok) → "Fener Koyu seni
bekliyordu" → İskele'nin 6 işi (şenlik + kasaba kartı) → mühürlü sıradaki bölüm
→ `kayitYama` ile şema 2 kaydı.
Test kancası `window.__fitil`: `durum()`, `bolum()`, `ekran()`, `bolumAc(id)`,
`botHamle('usta'|'acemi')`, `hizli(on)`, `kayit()`, `kayitYama({...})` (eski
şemalı tam kayıt `{ surum: 2, … }` verilirse gerçek göç + onarım yolundan geçer),
`ac('gunluk'|'defter'|'ayarlar'|'istatistik'|'nasil'|'sonsuz'|'kasaba'|'oyunOzeti')`, `geometri()`, `ogretim()`,
`cizici()` (çizici: `dev.dondur(true)` + `dev.ilerle(ms)` ile kare dondurulur; özel
yöntemler JS'ten çağrılır, ör. `gokFisegi()`, `gokKivilcimi(x, y, renk)`,
`devFisekFirlat({x, y})` — fişek ekran görüntüleri için).

## Bölüm tasarımı (bot ve doğrulayıcı)

- Bölüm listesi `src/levels/index.ts` (elle içe aktarım; DOKUNMA). Taslak
  bölümler `"taslak": true` taşır: statik doğrulamadan geçer, bot ölçütleri
  `dogrula`'da atlanır (`--taslaklar` ile koşar). Bölümü tasarlayan yalnız
  kendi `veri/bNNN.json`'unu değiştirir ve `taslak`'ı siler.
- Ayar sırası: önce 30 tohumla dene, sonra 100 tohumla onayla, en sonda
  `kalibre` (yıldız eşikleri). 30 tohumda kazanma oranı ±%10 oynar.
- Ölçütler `src/bot/olcut.ts` (§16.5): bant, yakın kaçış, R medyan/p90/p99,
  zincir medyanı, özel sıklığı, ısı, süre 60–180 sn. Öğretimde dağılım
  ölçütleri muaf (gerekçe dosyada).
- Büyük reaksiyonlar neredeyse hep özel taş ateşlemesinden gelir; p90/p99
  aşılırsa K21 yedek düğmesi `kurallar.soguma` (6, 9, 10: 3; 8: 4),
  uzun zincir/roket fazlaysa `caprazSiniri`. Tohum değişince kazanma oranı
  %15'e kadar oynar; yükleyici ilk tahtayı karıştırırsa doğrulayıcı hata verir.
- Usta ağırlıkları `src/bot/agirliklar.json` (GDD değerlerinden sapma ve
  gerekçesi dosyada). Ağırlık değişirse bütün bölümler yeniden doğrulanmalı.
- İlk oturum (GDD K22, K23, K24): öğretimin (1–5) yıldız eşikleri elle
  (`"elleEsik": true`; `kalibre` yazmaz). 1–3 (ilk izlenim) `--dagilim`'in
  "İlk izl." sütunundan (2★ Acemi kazanç p20, 3★ Acemi p70 ile Usta p50
  ortası; `--tohum 100 --acemi-tohum 200`), 4–5 "K22 öneri" sütunundan.
  6–25 K24 eşikli (`"esikKurali": "k24"`: 2★ = min(Usta p50, Acemi kazanç
  p50), 3★ = Usta p85; `kalibre` bayraklı bölümde Acemi'yi de
  oynatıp yazar, yeni bölüme `--kural k24`). 6–25 Acemi botuna göre ayarlı
  (Acemi ölçümü 60 tohum): tanıtımda Acemi ≥ %30 (Usta [92, 100]), normal
  (22–24) ≥ %20 (Usta [85, 100]), zor ≥ %8 ve Usta [60, 85] (Bölüm 10: ≥ %15,
  [70, 85]; 20, 25: [65, 85]), rahatlama ≥ %60. `dogrula` öğretim ve
  tanıtımda Acemi'yi de ölçer (< %30 uyarı); normal/zor/rahatlamada
  `--acemi --acemi-tohum 60` ile ölç. 26–30 de Acemi'ye göre ayarlı ve K24
  eşikli (Ekim 2026; eskiden Acemi 27 %13, 28 %11, 29 %32, 30 %3): 27 hamle
  26, 28 hamle 25 + Körük 14, 29 hamle 24 + 40/40, 30 dev fişek 2 + desen
  hücrelerine ön ısı 2 + doğum [5,5,3,3,3,3] + `ozelEsikleri` [6,9,13]; Usta
  bantları yeni kurala çekildi (normal [85,100], zor [60,85]). Ölçüm (0–99 ve
  5000+): Acemi 26 ~%50, 27 ~%40, 28 ~%36, 29 ~%90, 30 ~%13; Usta 30 %77–88.
  Mühürler yeniden ölçüldü (2000+, 6000+ hepsi bantta). 31–40 Acemi'ye göre
  ölçülmedi.
- Deneyerek bulundu (30): desen hedefinde Acemi'yi yükselten tek düğme desen
  hücrelerine ön ısı (2); doğumu hedef renklerine kaydırmak ([5,5,2,…])
  Acemi'yi artırır ama reaksiyon p90'ı 15–19'a, yıldız özelini %9'a çıkarır;
  `ozelEsikleri` 13 yıldızı keser ama Usta'yı düşürür, ön ısıyla birlikte
  dengeler. Hamle azaltmak dev fişek 2'de Usta'yı neredeyse değiştirmez.
- Deneyerek bulundu: `soguma` Acemi'yi en çok cezalandıran düğmedir (ısı
  şansını siler); kaldırmak Acemi'yi 3–5 kat artırır ama reaksiyon p90'ı 14'ü
  aşar. Süre ≥ 60 sn ≈ Usta'nın ≥ 15 hamlede kazanması: hedef adedini çok
  düşürmek süreyi bozar, hamle eklemek (≤ 30) bozmaz. Acemi kenar ve köşe
  hücrelerini (az komşu, az aday) seyrek patlatır: kenar/alt köşe döşemeleri
  ve köşeye yakın kafesler onu en çok tıkayan hedeflerdir (sönmeyen döşeme
  ısı haritasıyla görüldü); halka ve fener hedeflerini de neredeyse hiç
  kovalamaz (amaç körü), bu yüzden bu hedeflerde adet düşük tutulur.
- Deneyerek bulundu (13–19): Acemi orta satırları (8×9'da 4–5) en hızlı
  temizler; üst ve alt sıralar ~1,4 kat yavaş. Hedef türüne göre Acemi/Usta
  hamle oranı: kaya ~3, `topla` hepsi ~1,6, fener (ısısız) Acemi'de neredeyse
  hiç biter. Fener + kaya zorunda Acemi'ye şans veren tek düzen: fenerlerin
  altındaki sıralar ön ısılı (2) ve `soguma` kapalı (her soğuma Acemi'yi
  sıfırlar); `caprazSiniri` 2 Usta'yı Acemi'den çok yavaşlatır. Kaya
  çıkarınca reaksiyon p90 artar (kaya ısıyı keser). Dev fişeği yukarı
  taşımak p90'ı 18–22'ye çıkarır; bunun yerine "M dev fişekten N'si" hedefi.
  Bayramda düşük Körük kapasitesi (12) Acemi'yi en çok yükselten düğme;
  ama bayramda uzun oynayan Acemi Usta'dan çok puan toplar (b19 Acemi
  kazançlarının ~%89'u 3★: K24'ün 3★ = Usta p85'i orada iyi oyunu ayırmaz).
  Varyant ölçümünde Acemi'yi 120+ tohumla ölç: hamle değişince oyunlar
  bağımsız örneklere döner, 60 tohumda ±%5 oynar.
- Deneyerek bulundu (20–25): barut izini Acemi'nin yakamadığı kenar/köşe
  döşemelerinden geçirmek yeni öğeyi hedefin merkezine koyar (b21). Bir
  bölümde `soguma` 3, Acemi'yi %5–28'e düşürürken `caprazSiniri` 3 reaksiyon
  p90'ını Acemi'yi ezmeden sınırlar. Acemi'de sağ–sol asimetrisi var (sağ
  kenar hedefleri daha sık kalır; bot artefaktı). Zor bölümde Acemi p50'si
  (K24 2★) için 60 tohum yetmez (~6 kazanç): 200+ tohum. b24, b25'te Acemi
  kazanç p50'si Usta p50'sinden yüksek (geç kazanıp çok puan toplar).
- Bağımsız denetim (tohum 3000+, 300 tohum): zor bölümde Usta oranı tohum
  kümesine göre ±5 puan oynar (b25: 0–99 %78, 3000+ %87, 5000+ %86, 7000+
  %79, kalibre 0–499 %80; birleşik ~%82, Acemi ~%10); sınırda karar vermeden 2–3
  bağımsız küme birleştir. `caprazSiniri` mutlak puanda Usta'yı çok düşürür ama oranca
  Acemi'yi daha çok düşürür (b25 `caprazSiniri` 2: Usta 86 → 63, Acemi 10 → 4;
  b14 3 → 2: Acemi 49 → 35); zorda Usta–Acemi bağını gevşetmez. b25'te 4
  yerine 3 fener: 24 hamlede Acemi +1,5 puan (Usta aynı), 25 hamlede Acemi
  +6 ama Usta ~%86 (değiştirilmedi). b14 reaksiyon p90'ı tohum kümesine göre
  13–15 (sınır 14). Acemi kazanç puanları dar dağılır (p40–p50 arası
  150–300 puan): K24'ün 2★'ı (Acemi p50) bağımsız tohumlarda Acemi
  kazançlarının %38–64'ünü en az 2★ yapar.

## Kanca arayüzü (Mühürler + Kasaba; docs/KANCALAR.md §C)

- Ortak bileşenler `src/ui/kanca.ts` (mühür satırları, HUD rozeti `MuhurRozeti`,
  `muhurUcur`, kandil hapı, `kandilUcur`), stil `src/ui/stil/kanca.css`, ikonlar
  `muhurSvg`/`kandilSvg` (`ikonlar.ts`, gradyanlar `ftl-mum`, `ftl-kil`),
  metinler `MK` (`metinler.ts`). Panel `src/ui/ekranlar/kasaba.ts`
  (`ui.kasaba(vm)`); harita: Kasaba düğmesi, kıvılcımlar, `haritaBalonu`.
- Görünüm modelleri `app/gorunum.ts`: `muhurVMleri` (yalnız 6. bölüm kazanıldıysa
  ve mühürlü ana bölümde; `oz` verilirse anlık durum), `kazandinKancalari`,
  `kasabaVM`, `kasabaKartlari`. Oturum: eylem sonu `muhurUcuslari` (yeni 'tuttu' +
  kayıtta basılı değil → uçuş); HUD rozeti ayrı özetten (`ozHud`: oynatma bitip
  uçuş başlayınca ilerler; Duraklat `oz` ile sonraki durumu gösterir);
  `ui.muhurTuttu(liste, kaynak)` noktaları önce "uçuşta" işaretler, Geri Sar /
  Eli / çıkış `muhurUcuslariniIptal` (damga, ses, etiket yok); kayıpta uçuş yok.
  Kazançta mühürler final ÖNCESİ durum ve finalsiz özetle değerlendirilir.
  Uygulama: `kasabaAkisi` (Yap → kayıt → harita kutlaması → 6/6 ise kasaba
  kartı; kandil sıradaki işe yetiyorsa panel kendiliğinden yeniden açılır),
  `haritaBalonu` (kasaba-ilk / hoşgeldin / sancak-ilk / Kandil yetti; ipucu
  ancak balon gösterilince "görüldü"; sancak balonu haritayı sancağa kaydırır
  ve `.f-harita-icerik` içinde durur; balon çıkan dönüşte oto-kart atlanır).
- Dikkat: `.f-sonda` (güvenli alan ölçüm sondası) global sınıf: durum sınıflarını
  önekle (`f-mr-*`). Harita aynı modelle yeniden çağrılırsa yeniden çizilmez
  (kutlama/sakin balonu kesilmesin). Yeni işin ışıkları `--kd` gecikmesiyle
  kıvılcımlar varınca yanar.
- Önizleme: `dev/arayuz.html?ekran=bolumOncesi&v=m|mi`, `hud&v=muhur`, `ucus`,
  `duraklat&v=m`, `kazandin&v=m|mt|mk|me` (mk: kalabalık ilk mühürlü kazanç,
  me: Usta'nın Eli), `kasaba[&ogretim=1]`, `haritaBalon`,
  `kasabaKarti&m=0`, `harita&kasaba=1|bos|yok`.

## Bölüm Mühürleri (K5 ölçümü; docs/KANCALAR.md §A.5, §A.7, KA13–KA15)

- Mühür yalnız bölüm JSON'unun `muhurler` alanıdır; doğrulayıcı biçimi ve
  bölüm içeriğiyle uyumu denetler (`bolumMuhurDogrula`, `bolumMuhurUyumu`:
  ölçünün nesnesi tahtada, süzgeçsiz R/nesil `"sans": true`, aynı ölçüde
  eşik Çırak < Kalfa < Usta, metin ≤ 34). Bölüm ayarı değişirse mühürleri
  `npm run bot -- --muhur --bolum N` ile yeniden ölç.
- Eşiği TEK tohum kümesinde bant kenarında seçme: P0'ın 2000+ kümesinde
  %23–25 seçilen 16 Usta mühürünün 8'i bağımsız 5000+ kümesinde %27–35
  çıktı (bant 8–25). İki kümeyi birleştir (`--json` raporundaki `dagilim`'lar
  toplanabilir; her eşiğin oranı yeniden oynatmadan hesaplanır), iç
  pencerede seç (Çırak A ≥ 48 / yedek U ≥ 90, Kalfa 36–54, Usta 11–20),
  üçüncü kümeyle onayla. Tam ölçüm 35 bölüm × 450 oyun ≈ 13 dk (2 işçi).
- Eşik adımları (Usta kazançlarında): kalan hamle +1 ≈ −10 puan; R +1 ≈
  −1…−6; "tek hamlede N döşeme/desen/is" Usta için basamak (%100 → %0–20:
  ilk tahta sabit, açılış hamlesi her tohumda aynı) — yalnız Çırak'ta kullan.
- Kısıt mühürü (`enCok`) kısıtlı botla ölçülür; doğal oran yanıltır
  ("Hiç 3'lük zincir" doğal %23, kısıtlı %100; "Körüksüz" kısıtlı %71–100).
- Acemi uzun oynar: oyun boyu biriken sayaçlarda ("5 roket yap", "N özel taş
  ateşle") Acemi oranı Usta'nınkinden yüksek; halka sayısı ve zincir boyunda
  bot amaç körüdür (insan için daha kolay).

Komutlar Windows PowerShell'de de çalışmalı: npm betiklerinde `VAR=1 komut`
gibi POSIX sözdizimi kullanma.

## Modüller ve sınırlar

- `src/core/` — saf kurallar. DOM, `Date`, `performance`, `Math.random`,
  kayan nokta sabiti yok; zaman birimi tik. `hamleUygula` girdiyi değiştirmez.
  API, olay sözlüğü, zamanlama ve görsel tahta: `src/core/README.md`
  (çizici olayları `olayUygula` ile uygular, `gorselFark` ile eşitler).
- `src/levels/` — bölüm JSON'ları (`veri/bNNN.json`), doğrulayıcı, günlük üretici.
- `src/bot/` — Acemi/Usta bot, `sim-cli.ts` (tsx ile Node'da).
- `src/render/` — tek tuval sahnesi (`OyunCizici`), sprite önbelleği, parçacık
  havuzu, olay oynatıcı, kamera. `shadowBlur` yasak (parıltı sprite'tan).
  Dikeyde üst bandın çoğunu DOM HUD kaplar: gök fişekleri görünür şeritte
  (`gorunurGok`: HUD'un ölçülen alt kenarı → tahta üstü) patlar; HUD bandına
  taşan kısım (gök parçacıkları, kovanlar, kartlara uçan kıvılcımlar, kart
  patlamaları) HUD'un üstündeki küçük ikinci tuvalde (`fisekPerdesi.ts`,
  arayüzün `f-fisek-katman`ı, z 25: HUD'un üstü, balon/bant/modalların altı)
  çizilir, ana tuvalde o banda kırpılır.
- `src/audio/` — WebAudio sentezi (`SesMotoru`); `src/audio/synth.ts` taban.
- `src/input/` — `YolCizici` (pointer + klavye).
- `src/ui/` — DOM ekranları ve HUD; metinler `src/ui/metinler.ts`.
- `src/meta/` — kayıt şeması ve ilerleme mantığı (saf, testli).
- `src/platform/` — RNG (görsel), kayıt deposu (bulut/tarayıcı/bellek),
  titreşim, canlı güncelleme kancası.
- `src/app/` — oyun akışı (P5): `uygulama.ts` (ekran akışı, harita döngüsü,
  günlük/sonsuz, ayarlar, test kancası), `oturum.ts` (bölüm içi döngü: girdi →
  önizleme → hamle → oynatma → HUD; final, kazandın/kaybettin, hayalet fitil,
  Usta'nın Eli, güçlendiriciler, Körük, öğretim balonları/el/boşta ipucu),
  `gorunum.ts` (meta → arayüz VM eşlemeleri, testli), `kayitci.ts` (SaveStore +
  yedek döndürme + bulut), `uretim.ts` (günlük/sonsuz üretimi Web Worker'da —
  `uretimIsci.ts`, `?worker&inline`; CSP engellerse ana iş parçacığında zaman
  dilimli — + önbellek). Reaksiyon yazısı ve "Şenlik başlıyor!" yalnız tuvalde
  çizilir. Açılış ekranı beklerken ilk bölüm `cizici.onIsit` ile önden pişer.

## Hedef ortam (oyuncu telefondan, WhatsApp'tan gelen bağlantıyla açar)

- Dikey telefon öncelikli: tasarım 390×844, alt sınır 360×640; masaüstünde
  fare + klavye. Tüm düğmeler alt bantta, başparmakla erişilebilir.
- claude.ai sayfa çerçevesinde çalışır: `alert/confirm/prompt` YOK (onayı
  sayfa içinde yap), indirme bağlantısı yok, `window.open` yok, harici
  görsel/ses/fetch yok. Her şey prosedürel; "Nunito" (değişken, Ekim 2026'da Baloo 2
  yerine; okunaklılık + yuvarlak hat) `src/ui/yazitipi.ts` ile
  gömülü (FontFace'e ikili veri: CSP font-src'ye takılmaz, ağ isteği yok).
- WhatsApp içi tarayıcı (Android Custom Tab, iOS Safari görünümü): ses yalnız
  ilk dokunuştan sonra; `localStorage` her erişimde try/catch; güvenli alan
  (`env(safe-area-inset-*)`) payları; `touch-action: none`; çift dokunma
  yakınlaştırması ve metin seçimi kapalı; tam ekran isteğe bağlı.
- 60 fps hedef; DPR en fazla 2; kare başına bellek ayırma yok.
- Tuvalde `desynchronized: true` KULLANMA: Android Chrome'da tek tamponlu ekran
  katmanı olur, her karede baştan çizilen sahne tablette boştayken titriyordu
  (annenin tableti, iki oyunda da). Boşta görünen her geçiş yumuşak olmalı:
  otomatik kalite parıltıyı `pariltiA` ile soldurur, deniz fazı donar, boşta
  ipucu dalgası 2,2 sn'de bir (3 geçişten sonra aralıklı), dolu körük nabzı 1 sn.
  Boşta ölçüm aracı: `node scripts/titreme.mjs <url> <klasör> tablet-dikey
  --bekle 12` (tuval boyutlanması, RO, kalite geçişi, piksel sıçraması, CSS
  animasyonları; gerçek donanımdaki ön tampon yırtılmasını ölçemez).

## Doğrulama

- Görsel iddiayı telefon görünümünde ekran görüntüsüyle doğrula
  (`scripts/shot.mjs`); "çalışıyor" demeden önce kareye bak.
- Kurallar için vitest; bölümler için bot (`npm run dogrula`).
- Linux bulut ortamında Chromium `/opt/pw-browsers/chromium` (betik kendisi bulur).
