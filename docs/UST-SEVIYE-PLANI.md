# Turbofan Akademi — üst seviye planı (eleştirmen düzeltmesiyle son hal)

*Sekiz uzman denetiminin (grafik, sanat, arayüz, oynanış, fizik, ses, teknik, rakip) sentezi, yaratıcı yönetmen eleştirisinden geçmiş son hali · 24.10.2026 · dal `claude/hyperrealistic-jet-engine-xlf5ck`. Kanıt galerisi: `capture-output/denetim/GALERI.md`. Bu belge yalnız plandır; `src/` altında değişiklik yapılmadı.*

Emek ölçeği (ajan-gün): **S** ≤ 1 gün · **M** 2–4 gün · **L** 1–2 hafta · **XL** 2 haftadan uzun. L ve XL paketler, her biri tek iş akışı oturumuna sığan ve kendi ara commit'i olan adımlara bölünür.

---

## 0. Eleştirmen notları: ne değişti

1. **Plan ilk iki dalga boyunca oyuncuya neredeyse hiç "vay" göstermiyordu.** Eski takvimde "ilk 10 dakika" anlarından V1 Dalga 2'de, V2/V5/V7/V8/V10 Dalga 3'te, V3/V4/V9 ise Dalga 4'te geliyordu. K1 önerisi de "Dalga 1–2 önce" olduğu için kullanıcı haftalarca yalnız altyapı görecekti. Artık **her dalga en az iki görünür vay anı teslim eder** (§3.3 "vay takvimi"). Dalga 1'e yeni bir **1I "Tam güç tekmesi"** paketi eklendi: fan ve pervane bulanıklığı + trauma sarsıntısı, hiçbir bağımlılığı yok. Art yakıcı ve gece (eski 4A) **Dalga 3'e (3G)** çekildi. Kullanıcının kalite çıtası War Thunder/DCS efektleri olduğu için kahraman efekti en sona bırakılamaz.
2. **"İlk 10 dakika" tablosu gerçek bir oyuncu yolu değildi.** Varsayılan motor art yakıcısız sivil turbofan, varsayılan ortam test hücresi; buna rağmen 1:30'da "gece art yakıcısı" yazıyordu. V8 de Dalga 4'te gelen tezgâh sahnesine bağlıydı. Bölüm 3 baştan yazıldı: somut bir ilk oturum rotası, her an için ölçüt ve "hangi dalgadan sonra var" sütunu. Yeni **V0 "kendi elinle ilk çalıştırma"** eklendi (soğuk açılış etkileşimli hale geldi: oyuncu ilk 20 s içinde marşa kendisi basar). Yeni **O-26 vitrin senaryoları** da eklendi: mevcut 16 kayıt sahnesi (`scripts/capture/scenes/*.json`: ab, rain, shutdown, surge…) tek tıklık oyuncu senaryolarına dönüşür ve gece art yakıcısına bir tıkla ulaşılır.
3. **Dalgalar çakışmasız değildi.** Bulunan dokuz çakışma ya da ters bağımlılık: (a) 2E ve 2F aynı dalgada `CameraRig.ts`'e dokunuyordu, 3A ve 3D de öyle (planın kendi risk tablosu "farklı dalgalarda" diyordu). (b) 2C, 2B'nin ışık takımına ve 2A'nın HDR'ına bağlı olduğu halde onlarla aynı dalgadaydı. (c) 2A'nın EV100 pozlaması 2B'nin sahibi olduğu `environment.js`'te duruyordu. (d) 1A (ilerleme, `main.ts`) ile 1C (`index.html`, yükleme görseli) aynı yükleme ekranını paylaşıyordu. (e) `sim.snapshot()` gövdesinin sahibi yoktu: 3D buna muhtaçtı, Dalga 3'te `engineSim`'in sahibi ise 3F'ydi. (f) 1B çalıştırma zamanlamasını değiştirirken 1G oynanış testini, 1E de audio-golden'ı eski zamanlamalarla yazıyordu. (g) O-03'ün dönem kilitleri M5c'ye (Dalga 4) bağlıydı ama 3C'deydi. (h) G-08 dudağa anizotropi ekliyor, T-11 anizotropiyi kaldırıyordu. (i) 3D ile art yakıcı paketi aynı `src/effects/**` dosyalarını paylaşıyordu. Çözümler: Dalga 0'da CameraRig, pozlama ve ışık takımı sözleşmesi bölünür; 2C, Blender varlık hattı (2C) ve çalışma anı entegrasyonu (3H) olarak ikiye ayrılır; snapshot gövdesi 2H'ye verilir; testler sabit süre yerine sim olaylarını bekler (T-20); paket içi birleşme sırası yazılı hale getirilir.
4. **Atlanan bakış açıları eklendi.** *Mobil:* `src/` altında hiç dokunma işleme yok (touchstart/pointerType/matchMedia/maxTouchPoints aramaları boş). Oysa paylaşım bağlantıları büyük ölçüde WhatsApp üzerinden telefonda açılacak. Yeni A-22 (dokunmatik + telefonda "motor kartı + 3B görüntüleyici") ve karar K8 eklendi. *Çok oyunculu paylaşım:* sunucusuz "meydan okuma bağlantısı" (O-27). *Uçuş testi:* O-18'deki "silüet + sayı kartı" vay sayılmaz; yerine **uçan test yatağı** (O-28, GE ve P&W'nin uçan test uçakları gibi) Faz 4'ün ilk adımı olarak kondu. *Yayın:* fragman, açılış sayfası, basın kiti, İngilizce arayüz ve insan oyun testi için yeni **Dalga Y** eklendi. *Duraklatma ve gamepad:* kodda ikisi de yok; duraklatma (A-21) Dalga 1'e, gamepad ve titreşim (A-23) 3D'ye girdi.
5. **Uzman raporlarında olup plana girmeyen bulgular eklendi.** Sanatın "nemli ortamda giriş zemin girdabı ve egzoz arkasında toz/su" önerisi kataloğa hiç girmemişti; G-20 olarak eklendi ve V2'nin parçası oldu. Sanatın fotoğraf kipi için önerdiği "Teknik çizim" ön ayarı, oyunun imza kimliğinin (bölüm 2) kendisi olduğu halde atlanmıştı; **K-10 canlı teknik çizim kipi** olarak birinci sınıf özelliğe yükseltildi. Grafiğin atlas saçağı teşhisi (WebP 4:2:0, ada payı) ile planın "mor noktalar NaN'dan" teşhisi birbirine karıştırılmıştı. 1A artık yalnız NaN = 0 sözü veriyor, kalan saçaklar 2C'nin ölçütü.
6. **Kabul ölçütleri ölçülebilir hale getirildi.** "Farkı açıkça gösterir", "kullanılmış makine", "altın saat okunur", "fan kompozit görünür" gibi ifadeler sayısal vekillerle değiştirildi. Bunun için Dalga 0'da yeni bir **`scripts/visual-metrics.mjs`** (T-19) kuruluyor: vitrin kadraj setine ROI maskeleri, NaN sayısı, kırpılan piksel oranı, ROI ton ortalaması, parlaklık histogramı, ön plan SSIM'i (ısı pusu sızıntısı) ve fan diskinde polar FFT. "Vay" için ayrıca iki insan ölçütü eklendi: küçük resim testi (320 px'te 3 s) ve 5 kişilik ilk oturum testi (O-29).
7. **Faz 4 uyumluluğu karara bağlandı.** Gölgede "kahraman gölgesi ya da CSM" seçeneği kapatıldı ve **CSM** seçildi; 30–70 m'lik uçaklarda motor ölçekli kahraman gölgesi işe yaramaz. Uzamsal ses N yayıcılı kuruluyor (çok motorlu uçak). Paylaşım şeması `kind: "engine" | "aircraft"` alanıyla başlıyor.
8. **Tek sıcaklık rampası kuralına istisnalar yazıldı.** Plan aynı anda "tek rampa", FLIR için demir yayı ve renk körlüğü için cividis istiyordu. Artık rampa tek ve globaldir; CVD kipi rampayı her yerde birlikte değiştirir; FLIR kipi aynı rampayı kullanır, demir yayı ise fotoğraf kipinde isteğe bağlı bir ön ayardır.
9. **Kararlar zamanlandı.** K2/K3/K7 (kimlik, kesit, logo yönü) Dalga 1 başlamadan yanıtlanmak zorunda, çünkü 1C ve 1F bunları uyguluyor. K1'in metni kendi içinde çelişiyordu ("M5b + Dalga 3 birlikte" ile "Dalga 4 = M5b" aynı anda); netleştirildi. Paket portları M5a'nın `518n` düzeniyle çakışmayan `52WN` biçimine geçti.

*Kaynak notu:* Eleştirmene grafik ve sanat raporları tam, arayüz raporu kısmen ulaştı. Oynanış, fizik, ses, teknik ve rakip bulguları yalnız bu planın sentezi üzerinden değerlendirildi; ham raporlarla çapraz kontrol edilmedi. Kod tabanında eleştirmenin kendi doğruladığı gözlemler: dokunma, duraklatma ve gamepad işleme yok; 16 kayıt sahnesi `setup` JS metniyle durum kuruyor; F-21'in yanlış etiketleri `src/app/workshop/StartScreen.ts:21-24` ve `src/design/architecture.ts:1060-1100`'de.

---

## 1. Yönetici özeti

### Bugünkü hal

| Uzman | Puan | Tek cümlelik teşhis |
|---|---|---|
| Grafik | 5 | Altyapı iddialı (raymarch alev, Cycles hücre, GTAO, AgX), ama zincirin temel kararları (LDR bloom, derinliksiz pus, ışıksız hücre, krom malzemeler) kareyi "temiz CG ürün görseli"nde bırakıyor. |
| Sanat | 5 | Dört ayrı görsel dil konuşuluyor; logo yok, yazı tipleri hiç yüklenmiyor, tam güç rölantiden ayırt edilmiyor. |
| Arayüz | 6 | Aviyonik temel tutarlı, atölyenin baloncuk ve hayalet dili güçlü; ama ölçek, uyarı hiyerarşisi ve ucuz hatalar ("null", 13 px yıldız, duraklatma yok) var. |
| Oynanış | 5 | Mükemmel bir etkileşimli ders kitabı ama oyun değil: geri dönmek için neden, hedef, ödül ya da paylaşım yok. |
| Fizik | 6 | Tasarım noktası sayıları gerçekle uyumlu; tasarım dışı ve geçici rejimde (surge payı, rüzgârlanma, ısıl kütle, T4 tavanı) uzmanı kaybettiren hatalar var. |
| Ses | 3,5 | Fizik iskeleti var (BPF = N1 × kanat), ama miks sessiz ve sıkışık; uzamsallık, ortam akustiği ve arayüz sesi yok. |
| Teknik | 4 | Simülasyon ucuz (%0,8). Shader yönetimi ve çizim hattı ise israf: yanlış varyant ön-derleme, 43–67 s donma, 1552 çizim çağrısı. |
| Rakip | 6 | Pazarda birebir rakip yok. İçerik 8, gösterilebilirlik 3. |
| **Ortalama** | **≈ 5,1** | **İçerik dünya standardında; sunum, erişim ve oyunlaştırma çok gerisinde.** |

Not: Galerideki "Ölçülen 0,0 kN" şeridi gerçek bir hata değil. Kayıt kancası `App.advance()` panelleri güncellemiyor; gerçek zamanlı oyunda şerit doğru çalışıyor (oynanış ve arayüz uzmanı doğruladı). Kancaya `update()` eklenmeli (1G).

### En büyük 6 zayıflık

1. **İlk izlenim donuk ve uzun.** Menü 10,2 s'de 3B sahnesiz açılıyor, ilk tam kare 16,7 s'de geliyor. Öğleye ilk geçişte ana iş parçacığı 43–67 s kilitleniyor ve ekranda hiçbir gösterge yok. Kök neden: ön-derleme yanlış shader varyantını derliyor (238/238 program kullanılmıyor), PMREM boyutları da tutarsız (teknik, grafik, sanat, rakip).
2. **Görüntü zinciri "vay" demeye izin vermiyor.** Bloom ton eşlemeden sonra çalışıp enerjiyi 1,0'da kırpıyor. Isı pusu ön planı da büküyor; test hücresi ışıksız (art yakıcı odayı aydınlatamıyor); dudak ve fan krom ayna gibi. Gren negatif renk üretiyor, SMAA bunu NaN'a çevirip siyah/mor noktalar çıkarıyor. Pişmiş atlasta ayrıca WebP ve ada payı kaynaklı renk saçakları var (grafik, sanat, teknik).
3. **Oyun döngüsü yok.** Kalıcı ilerleme yalnız 7 dersin yıldızından ibaret. Atölyede ödülsüz 3 görev var. Tasarla → test et döngüsü her yinelemede ~45 s bekletiyor. Duraklatma, anlık tekrar ve olay kamerası yok (oynanış, rakip, arayüz).
4. **Yayılma ve erişim kanalı yok.** Fotoğraf kipi, klip, paylaşım kodu yok; tasarımlar yalnız localStorage'da. Dokunma desteği yok ve telefonda açılan bir bağlantı bugün kullanılamaz. İngilizce arayüz yok, web sürümü yok, fragman ya da tanıtım sayfası yok (rakip, eleştirmen).
5. **Ses oyunun en zayıf katmanı.** Rölanti −38 LUFS, mono, tek noktadan çalıyor. Baskın tını, fiziksel karşılığı olmayan 9×N2 üçgen dalga. Art yakıcı MIL'den yalnız +3 LU yüksek. Surge enerjisinin %87'si 150 Hz'in altında (dizüstü hoparlöründe kayboluyor). Anahtar, CAS ve arayüz tamamen sessiz (ses).
6. **Uzmanın güvenini kıran fizik ve içerik hataları.** Surge payı rölantiye doğru artıyor. Çalıştırmada N1 sıfır kalıyor ve ders 2 bunu doğruymuş gibi öğretiyor. Surge'de T4 2900 K'e çıkıyor. Düz derecelendirme ve ısıl kütle yok. Şablon kartları yanlış motor sınıfı gösteriyor (319 kN'a "CFM56-7"). Ders metinlerinde yanlışlar var (ders 3, 4, 6, 7) (fizik, rakip).

### En büyük 6 fırsat

1. **Veri zaten her karede hesaplanıyor.** β, N2c, prSurge, istasyon T/P ve eksenel hızlar canlı kompresör haritasına, kesitte akan gaza, sıcaklık alanlı kızıllığa, FLIR kipine ve canlı teknik çizim kipine doğrudan dönüşebilir. Bu, hiçbir rakibin yapamadığı "fiziği görünür kılma" anıdır.
2. **Belirlenimli simülasyon** (`fixedDt`, `advance`) olay kamerasını, anlık tekrarı, ağır çekimi, kare düşmesiz klibi ve **fragmanı** neredeyse bedavaya getirir.
3. **Ölçülmüş ucuz kazançlar.** Üç küçük düzeltmeyle CPU kare süresi 9,37 → 5,52 ms oldu (−%41, görüntü aynı). Tek satırlık kırpmayla NaN 0'a indi. Doğru RT ile ön-derleme ve tek PMREM boyutu ortam geçişini saniyelere indirir. Kazanılan bütçe HDR bloom, CSM gölge ve hacimsel efektlere gider.
4. **İmza kimlik.** "Teknik çizim + müze kesiti" dili: tek sıcaklık rampası, istasyon çizgisi motifi, blueprint tezgâhı ve canlı teknik çizim kipi. DCS bütçesiyle fotogerçekçilikte yarışmadan ayırt edici ve paylaşılabilir bir görüntü verir.
5. **Hazır vitrin malzemesi.** 16 kayıt sahnesi ortamı, motoru, kamerayı ve sim durumunu zaten kuruyor. Bunlar tek tıklık oyuncu senaryolarına (gece art yakıcı, yağmurda turboprop, kapatmada soğuma, surge) ve fragman çekimlerine dönüşebilir.
6. **Atölye Sprocket'in ötesine ve Faz 4'e uzanabilir.** Hızlı test ve kabul testi, sipariş panosu, "tasarımını dinle" (fan ucu Mach 1'i geçince buzz-saw), meydan okuma bağlantısı ve uçan test yatağıyla atölye bağımlılık yapan bir döngüye ve uçak tasarımına köprüye dönüşür. Ayrıca EASA Part-66 Modül 15 eğitim pazarında boşluk var; Türkçe içerik de hazır.

---

## 2. Görsel kimlik ve hedef his

### Kuzey yıldızı

> **"Gerçek bir motor test tesisinde, gece yarısı, bir mühendisin masasındaki teknik çizim canlanıyor."**
> Sahne fotogerçekçi ve ağırdır: beton, çelik, kurum, kor metal, gerçek ses. Oyunun imzası ise gerçekçiliğin üstüne binen *teknik çizim katmanıdır*: istasyon numaraları, ince kılavuz çizgileri, tek bir soğuktan sıcağa renk rampası, blueprint ızgarası ve tek tuşla açılan canlı teknik çizim kipi. Oyuncu her karede iki şeyi birlikte görür: **makinenin ağırlığını ve fiziğin kendisini.** Rölanti sakin ve mavi-gridir. Kalkış gücü kamerayı titretir, sesi gövdede hissettirir, ısı pusuyla havayı büker; nemli havada girişte yerden bir yoğuşma hortumu kalkar. Art yakıcı odayı turuncuya boyar. Kesit, havanın soğuktan akkora yolculuğunu gösterir. Hedef his: *War Thunder hangarının ağırlığı + DCS'in iç detayı + Forza Vista'nın vitrin kamerası + Animagraffs'ın açıklayıcılığı.*

### Somut kararlar

| Alan | Karar |
|---|---|
| **Anlam renkleri** (yalnız durum) | normal `#E8EEF4` · iyi `#3DDC84` · dikkat `#FFB020` · limit `#FF4D3D` · hedef `#FF5CF0` · etkileşim `#2EE6D6` (yalnız tıklanabilir ve seçili öğe; bugün her yerde kullanıldığı için anlamını kaybediyor) |
| **Tek sıcaklık rampası** | 288 K `#5B8DB8` → 600 K `#9DB4C0` → 900 K `#F2C14E` → 1200 K `#F08A24` → 1500 K `#E2471B` → 1800 K+ `#FFE8C2`. İstasyon şeması, T–s gradyanı, 3B akış, kesit ısı katmanı, FLIR kipi ve teknik çizim kipi bunu paylaşır. 3B kızıllığın kendisi fiziksel kara cisim (Planck LUT) olarak kalır; rampa onun arayüzdeki karşılığıdır. **İstisnalar yalnız şunlardır:** (1) CVD kipi rampayı *her yerde birlikte* cividis benzeri bir rampayla değiştirir; (2) demir yayı (ironbow) yalnız fotoğraf kipinde isteğe bağlı bir ön ayardır. Başka hiçbir bileşen kendi sıcaklık skalasını tanımlamaz. |
| **Modül renkleri** (soluk, çelik tonlu) | Fan/LPC `#7FA7C9` · HPC `#5E86B5` · Yanma `#C7794A` · HPT `#B8573E` · LPT `#9C6B4E` · Lüle `#8E8E96` · Dış donanım `#6F7A85` · Gövde `#4F5862`. Kütle şeridi, röntgen vurgusu ve müze kesiti bunları kullanır. Tek kaynak `src/ui/palette.ts` ve CSS değişkenleri; tuval çizimleri de buradan okur. |
| **Kesit kapağı** | Varsayılan: açık sıcak gri `#C9CED3`, 45° ekran uzayı tarama ve 1 px koyu kenar (teknik çizim geleneği). Kırmızı ve turuncu yalnız ısıya kalır. "Isı katmanı" açıkken kapak simülasyondaki yerel gaz sıcaklığıyla boyanır (karar K3). |
| **Tipografi** | Gömülü woff2 (Latin + Latin Ext-A, toplam ~150 KB): başlık **Barlow Condensed 600**, BÜYÜK HARF, +0,04em · arayüz **Inter** 400/500/600, `tnum` · veri ve EICAS **B612 Mono** (Türkçe glifler doğrulanmalı, eksikse JetBrains Mono 500). Ölçek 11/12/13/14/16/20/28/56. |
| **Işık** | HDR zinciri ve EV100 ile fiziksel pozlama (öğle ~15, kapalı ~12, gün batımı ~10,5). Ortam başına LUT. Gün batımı: anahtar ışık `#FFB36B`, 4–8° yükseklik, uzun gölge; HDRI motoru yandan kenar ışığıyla aydınlatacak şekilde döndürülür. Gece: sodyum `#FFB870` ve LED `#DDE6FF` projektörler, karenin %60–70'i karanlık; gökyüzü `#05070C` → `#0F1A2B` gradyan, yıldız ve ay. Hücre: üstten-önden 4300 K anahtar, kontrol odasından soğuk kenar ışığı. **Işık takımı sabit sayıdadır, ışıklar şiddetle açılıp kapanır** (derleme için şart; sözleşme Dalga 0'da). |
| **Malzeme dili** | "Kullanılmış makine." Her yerde `envMapIntensity = 1`. Dudak fırçalanmış alüminyum (pürüzlülük 0,28–0,35, çevresel anizotropi, erozyon bandı); bu, anizotropinin sahnedeki **tek** kullanımıdır (T-11 bütçesi). Yüksek BPR fanı koyu kompozit + titanyum hücum kenarı. Kaportada panel başına ton farkı ve akış yönünde kir. Tapa ve çekirdek lülesinde is. |
| **Kamera dili** | Menüde orbit yok, küratörlü vitrin var: alçak üç çeyrek, tele (fov 20–24), Catmull-Rom yolunda dolly. Giriş merkezi ~(0,66W; 0,45H), üstte en az %8 boşluk; pylon ve sehpa kadraj kenarına teğet kesilmez. Olaylarda kesme ve ağır çekim. Sarsıntı "trauma" modeliyle çalışır, ağırlığı dönmededir (ayarlardan kapatılabilir). |
| **Arayüz dili** | "Aviyonik cam + teknik çizim": 4 px köşe, 1 px çizgi, odaktaki panelde köşe işaretleri, başlıklarda istasyon tik motifi. EICAS içe gömük saf siyah `#000` ekran ve `#1A1F25` çerçeve. Özel kaydırıcılar (gaz kolu başlığı gibi dikdörtgen tutamaç). Bildirimler motorun güvenli dikdörtgenine girmez. Dokunmatik ekranda hedefler en az 44 px. |
| **Hareket dili** | Üzerine gelme 120 ms · panel 220 ms · ekran 420 ms · `cubic-bezier(0.2, 0.8, 0.2, 1)`. Paneller 12 px kayarak gelir; ana değerlerde 250 ms sayaç animasyonu; `prefers-reduced-motion` desteklenir. |
| **Marka** | Önerilen işaret: önden görülen 18 süpürme kanatlı fan diski. İmza öğesi: istasyon çizgisi (2 · 25 · 3 · 4 · 45 · 5 · 9 tikleri, soğuktan sıcağa). Yükleme çubuğu, ders ilerlemesi, sekme alt çizgileri ve favicon bundan türer. Önerilen şemsiye: "AKADEMİ", altında "Turbofan", Faz 4'te "Uçak". **Ad ve işaret kullanıcı kararıdır (K7):** 1C üç SVG aday üretir, kullanıcı seçer. |
| **Canlı teknik çizim kipi** (imza) | Tek tuşla (T) ya da fotoğraf kipinden: çalışan motor, derinlik ve normal kenarlarından çıkarılmış 1 px çizgilerle, kesit taramasıyla ve canlı istasyon etiketleriyle blueprint zemin üzerinde çizilir. Renk yalnız sıcaklık rampasından gelir. Oyunun kimliğini tek karede anlatan görüntü budur (K-10). |
| **Atölye** | Ayrı "Tasarım tezgâhı" sahnesi: lacivert stüdyo `#0B1622`, sonsuz siklorama, blueprint ızgarası (1 m çizgi `#2EE6D6` %18, 0,1 m çizgi %6), 3B ölçü çizgileri, kil/blueprint görünümü. |

**Referanslar:** DCS (iç modül detayı, kokpit), War Thunder (hangar ışığı, X-ray/hit-cam, test sürüşü, fotoğraf kipi), MSFS (pozlama, drone kamera), Forza Vista / GT Scapes (vitrin çekimleri), Sprocket ve Automation (tasarım masası), GasTurb (harita ve çalışma hattı), Animagraffs ve üretici kesit posterleri (teknik illüstrasyon), Ciechanowski (etkileşimli anlatım), Boeing 777/787 EICAS (N1 komut sektörü, master caution), GE/P&W uçan test yatakları (Faz 4 köprüsü). Sanat kararları tek sayfalık `docs/ART.md`'de toplanır (1C).

---

## 3. "Vay" anları: ilk oturum yolu

### 3.1 Rota (yeni bir oyuncu, ilk açılış)

0:00 soğuk açılış (oyuncu marşa kendisi basar) → 0:30 menü vitrini → 0:45 "İlk dersine başla" (birincil kart) → Ders 1 anatomi → Ders 2 çalıştırma ve gaz kolu → ders sonu ödül ekranı "Önerilen: Vitrin senaryosu — Gece art yakıcı" kartını gösterir → tek tıkla askerî TF + gece + yandan kamera → atölyede "fanı büyüt, dinle, ilk ateş" görevi → fotoğraf ve paylaşım. Surge (Ders 5), kuş çarpması (Ders 7) ve FLIR ilk oturumun devamında gelir; ödül ekranı ve vitrin senaryoları oyuncuyu bunlara yönlendirir.

### 3.2 Anlar

| # | Zaman / yer | An | Nasıl yapılır | Ölçüt | Var olduğu dalga | Bağımlılık |
|---|---|---|---|---|---|---|
| V1 | 0:00 · ilk açılış | **Etkileşimli soğuk açılış.** Karanlık hücrede tavan projektörleri 0,25 s arayla "tunk" sesiyle yanar. Kamera giriş makrosundan üç çeyreğe kayar. Kontrol panelinde **MARŞ** düğmesi nabız gibi yanar ve oyuncu basar: spool-up, light-off'ta 0,4 s'lik kesit flaşı, N1 rölantiye oturur, "AKADEMİ" harf harf gelir. Derleme, oyuncu basana kadar ve spool-up sırasında perdelenir. Sonraki açılışlarda 2 s'lik kısa sürüm oynar. | Intro durum makinesi, sabit ışık takımının şiddetleri, `camera/shots.ts` yolu, ses logosu; menü `envPending` false olana kadar bekler | Tıklamadan ilk anlamlı kareye (ilk lamba) ≤ 2 s. Sekans boyunca en uzun görev ≤ 100 ms. Tamamı ≤ 15 s ve her an atlanabilir. İkinci açılış ≤ 2 s. Oyuncu marşa basmazsa 8 s sonra kendisi başlar. | 2 (ışık ve kamera); 3H sonrası hücre ışığıyla yeniden ayar | 1A, 1C, 2F, 2G |
| V0 | ~3:00 · Ders 2 | **Kendi elinle ilk çalıştırma.** Korumalı yakıt anahtarının kapağı kalkar ("klik"). Marş ıslığı ve APU bleed "şşş" duyulur. N1 gerçekten dönmeye başlar. Light-off'ta "vuff" sesi gelir, EGT iğnesi zıplar, kamera hafifçe "nefes alır". | S-11 sesleri, A-19 korumalı anahtar, F-05 N1 dönüşü, 1I sarsıntısı | N2 %25'te N1 %5–8. Light-off ile ses tepesi arasında ≤ 100 ms. Light-off sesi motorlamaya göre ≥ +8 LU (audio-golden "start"). | 2 (1B + 2G + 2E) | 1B, 2E, 2G |
| V2 | ~4:30 · Ders 2 sonu | **"Gaz kolunu it (W)" tekmesi.** Fan keskin kanatlardan bulanık diske geçer. Isı pusu jetin arkasını büker, ön plan keskin kalır. Kamera ve ses gövdeyi titretir. Nemli havada girişin önünde yerden kıvrılan yoğuşma hortumu, egzozun arkasında toz ya da su kalkar. | Fan/pervane bulanıklığı + trauma sarsıntısı (1I), derinlikli pus (2A), uzamsal jet gürültüsü (2G), giriş girdabı (G-20) | %100 N1'de fan diski ROI'sinde kanat frekansındaki açısal güç rölantiye göre ≥ %70 düşük. Pus açık/kapalı arasında ön plan maskesi SSIM ≥ 0,98. Tam güç −18 ± 2 LUFS. Nem ≥ 0,8 ve h/D eşiğinin altında girdap görünür, kuru havada görünmez. | 1 (bulanıklık + sarsıntı) · 2 (pus + ses) · 3 (girdap) | 1I, 2A, 2G, 3G |
| V3 | ~6:00 · vitrin senaryosu | **Gece art yakıcısı.** Tutuşmada "BUM", zonlar tek tek duyulur. Mach elmasları sim'den gelen aralıkla sarı-beyaz parlar, aralarda karanlık bölgeler kalır. Alev duvarı ve zemini turuncuya boyar ve zeminde yansır. *Not: WT/DCS'te bu bir beklentidir, sürpriz değil; ama yoksa oyun "eksik" okunur.* | HDR bloom (2A), yeniden yazılmış alev ve gece (3G), ışık haritalı hücre (3H), AB sesleri (2G); senaryo kartı (O-26) | Alev gövdesi ROI ton ortalaması 20–45° (HSV). Elmas tepe/ara parlaklık oranı ≥ 2. AB açık/kapalı arasında duvar ROI'si parlaklığı ≥ +%40. Gece karesinde piksellerin ≥ %60'ı L < 0,1. AB − MIL ≥ +6 LU (arkada). | 3 | 2A, 2G, 3G, 3H, O-26 |
| V7 | ~7:30 · atölye | **Sürükle ve dinle.** Fan çapı büyür, kademeler kayarak yerine oturur ve "tık" sesi gelir. "Dinle" düğmesine basınca fan ucu Mach 1'i geçtiği anda buzz-saw belirir. | Prosedürel arayüz sesleri, voiceTargets ön dinlemesi, PeriodicWave buzz-saw | Buzz-saw yalnız Mrel > 1,0'da (birim test). Ön dinleme ≤ 3 s'de başlar. HPC BPF tasarımın kanat sayısını izler. | 3 | 1E, 3E |
| V8 | ~8:30 · atölye → hücre | **İlk ateş.** Hücre içi sürümde motor sehpaya oturur, döner ikaz lambası yanar, geri sayım başlar, kabul testi otomatik koşar. "İLK ATEŞ" damgası çıkar ve test raporu kartı geçti/kaldı sonucunu gösterir. Vinçle tezgâhtan indirme sürümü 4C'den sonra gelir. | Hızlı test + kabul testi protokolü, geçiş sinematiği, seyir defteri | Atölyeden ilk ölçülen değere ≤ 5 s (hızlı test). Kabul testi ≤ 20 s. Geçiş sinematiği ≤ 4 s ve atlanabilir. | 1 (hızlı test) · 3 (sinematik) · 4 (vinç) | 1H, 3E, 4C |
| V10 | ~9:30 · her yerde | **Fotoğraf ve paylaşım.** P tuşu zamanı dondurur. Alan derinliği ve "Müze kesiti / Gece testi / Teknik çizim / 1958 arşiv" ön ayarları gelir. 2× PNG ve QR'lı motor posteri üretilir. `#m=` bağlantısı arkadaşın tarayıcısında motoru doğrudan atölyede, telefonda ise motor kartı + 3B görüntüleyicide açar. | Fotoğraf kipi, TRAA birikimi, paylaşım kodu, teknik föy, telefon görüntüleyicisi | P'den donmaya ≤ 1 kare. 4× PNG ≤ 3 s. Bağlantı ≤ 600 karakter. Bağlantı başka bir masaüstü tarayıcıda ve bir Android telefonda açılır. | 3 | 2A, 3A, 3B |
| V11 | ilk oturum · her yerde | **Canlı teknik çizim kipi.** T tuşuna basınca çalışan motor bir anda blueprint'e döner: 1 px kenar çizgileri, kesit taraması, istasyonlarda canlı T/P etiketleri. Gaz kolunu ittikçe rampa renkleri akar. | Derinlik/normal kenar geçişi, tarama, etiket katmanı (K-10) | Kip geçişi ≤ 1 kare. Ek maliyet ≤ 2 ms. Etiketlerdeki değerler sim'le aynı (test). Küçük resim testinde "teknik çizim" olarak okunur. | 3 | 2A, 3A |
| V5 | Ders 5 | **Surge olay kamerası.** Canlı haritada çalışma noktası surge hattını aşar. PiP'te kesit-çekirdek 0,25× hızda tekrar oynar, keskin bir patlama ve "huff" duyulur, master warning yanar, gamepad titrer. | Canlı harita, olay kamerası + halka tampon, surge sesi, master caution | Olaydan master warning'e ≤ 100 ms, PiP açılışına ≤ 0,5 s. Harita noktası hattı aşar (test). Surge ses enerjisinin 150 Hz altındaki payı ≤ %50. | 3 | 2E, 2H, 3D |
| V6 | Ders 7 | **Kuş çarpması ve boroskop.** Girişte tüy ve parça patlaması, bükülen kanat ucu, 1×N1 dengesizlik uğultusu ve yörüngesel kamera salınımı. Ardından boroskopla motorun içine girilip hasarlı kanat bulunur. | Particles, kanat başına vertex büküm, leke maskesi, ses; Picker tabanlı boroskop | Fan ROI'sinde hasarlı kanat görülür (önce/sonra). EICAS'ta 1×N1 titreşimi yükselir. Boroskopta hasar ≤ 60 s'de bulunabilir (oynanış testi). | 3 (görsel) · 4 (boroskop) | 3D, 4F |
| V9 | vitrin senaryosu "Soğuma" | **Termal kamera (FLIR).** Tam güçten kapatınca sıcak noktalar görünür. Kızıllık fiziksel sırayla söner: önce ince kanatlar, en son disk ve gövde. Soğuyan metal "tink" sesleri çıkarır. | Shader'da T(z) alanı, ısıl kütle (sim), Planck LUT, Poisson tink | Kanat τ ≈ 3 s, disk/gövde τ ≈ 60 s (sim ölçümü). Kapatmadan 60 s sonra EGT > 150 °C. Gece kesitinde kızıllık ROI'sinde eksenel gradyan var. | 4 | 1B, 4B |
| V4 | Ders 1 (4B sonrası) | **Havanın yolculuğu.** Kesit açılır; akış parçacıkları soğuk turkuazdan akkora renk değiştirerek gaz yolundan akar. Kamera girişten lüleye tek planda uçar ve her istasyonda canlı değerleri gösterir ("HPC çıkışı: 38 bar, 820 K"). 4B gelince soğuk açılışın kamera yolu bu uçuşla değiştirilir. | flowpath istasyonlarından meridyen akım çizgileri, InstancedMesh, CatmullRom kamera, kapakta ısı katmanı | Uçuş ≤ 20 s. Etiket değerleri sim'le ±%1. Baypas ROI'si soğuk renkte, çekirdek sıcak. Surge'de ters akış görünür. | 4 | 4B |
| V12 | Faz 4 köprüsü | **Uçan test yatağı.** Oyuncunun motoru, dört motorlu jenerik bir test uçağının iç pylonuna takılır (GE ve P&W'nin uçan test yatakları gibi). Kalkış, tırmanma, 10,7 km'de seyir, motoru kapatıp rüzgârlanma ve relight yapılır. | Havaalanı + CSM, F-04 rüzgârlanma ve relight, motor kartı (M5c) | M0,8 / 10,7 km'de rüzgârlanma N1 %20–35. Relight zarfı içinde motor yeniden yanar. Bir test uçuşu ≤ 3 dk. | 4 | F-04, M5c, T-08 |

### 3.3 Vay takvimi (her dalga en az iki görünür an teslim eder)

| Dalgadan sonra | Kullanıcının göreceği yeni anlar |
|---|---|
| 1 | Tam güç tekmesi (fan diski + sarsıntı, V2'nin ilk yarısı). Gri taramalı müze kesiti. Yeni yazı tipleri, logo ve yükleme ekranı. 5 s'lik hızlı test (V8'in ilk yarısı). Donmayan ortam geçişleri. |
| 2 | Etkileşimli soğuk açılış (V1). Kendi elinle çalıştırma (V0). HDR'da hale veren kızıllık. Altın saatli gün batımı. Vitrin menüsü ve senaryo kartları. Canlı kompresör haritası. Uzamsal ses. |
| 3 | Gece art yakıcısı (V3). Surge olay kamerası (V5). Kuş çarpması (V6). Dinle (V7). İlk ateş (V8). Fotoğraf ve paylaşım (V10). Teknik çizim kipi (V11). Giriş girdabı. |
| Y | 60–90 s'lik fragman ve tanıtım sayfası. |
| 4 | Havanın yolculuğu (V4). FLIR (V9). Boroskop. Kanat kopması testi. Uçan test yatağı (V12). Tasarım tezgâhı. |

### 3.4 Vay ölçütü protokolü

- **Nesnel:** her an için §3.2'deki ölçüt `scripts/visual-metrics.mjs` (T-19), `audio-golden` ya da sim testiyle ölçülür. Ölçümü geçmeyen an "var" sayılmaz.
- **Küçük resim testi:** vitrin karesi 320 px'e küçültülür. Motorun durumu (rölanti, tam güç ya da AB) ve ortam 3 s'de doğru söylenebilmelidir (kullanıcı ve bir tanıdık).
- **İnsan ilk oturum testi (O-29):** Dalga 2 sonrasında ve Dalga Y öncesinde, oyunu hiç görmemiş 5 kişi. Ölçülenler: ilk çalıştırmaya kadar geçen süre, kendiliğinden tepki verilen ilk an (gözlemci notu), bırakma noktası, 1–10 puan. Hedef: ortalama ≥ 8; 5 kişiden 4'ü ilk 2 dakikada kendiliğinden bir tepki verir.

---

## 4. Bulgu kataloğu (tekilleştirilmiş)

Uzman kısaltmaları: **Gr** grafik · **Sn** sanat · **Ar** arayüz · **Oy** oynanış · **Fz** fizik · **Ss** ses · **Tk** teknik · **Rk** rakip · **El** eleştirmen. Etki: ÇY çok yüksek · Y yüksek · O orta · D düşük. "Paket" sütunu bölüm 5'teki dalga paketidir. Eleştirmen düzeltmesiyle değişen satırlar **(✎)**, yeni satırlar **(+)** ile işaretlidir.

### 4.1 Performans ve teknik (T)

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| T-01 | Ön-derleme RT bağlı değilken çağrılıyor, ekran varyantı derleniyor (238/238 kullanılmıyor) → `setRenderTarget(composer.readBuffer)` ile `compileAsync`, ortamın son hali kurulduktan sonra; gölge için ısınma karesi; "kullanılmayan program oranı" ölçüsü | ÇY | S | — | Tk, Gr | 1A |
| T-02 | Öğle geçişi 43–67 s ana iş parçacığı kilidi; PMREM 512 ile yakalama 256 farklı boyutta olduğu için çift varyant → tek boyut (256), sıra: durum → `compileAsync` → yakalama → kare; derleme sürerken eski ortamı çizip 0,4 s çapraz geçiş; "Gökyüzü hazırlanıyor %62" göstergesi | ÇY | M | T-01 | Tk, Gr | 1A |
| T-03 | Her ortam ilk açılışta yeniden derleniyor → Dalga 0 sözleşmesine göre sabit ışık takımı (şiddetle aç/kapa), menüde `requestIdleCallback` ile bütün durumları ısıt; ardından gerçek zamanlı "Saat" kaydırıcısı | Y | M | T-01, T-02, Dalga 0 | Tk | 2B |
| T-04 ✎ | Yüklemenin 6 s'si gereksiz havaalanı; menü 10,2 s, ilk kare 16,7 s → havaalanını ilk kareden sonra boşta yükle, yükleme ekranını ilk tam kareye bağla, ağırlıklı ilerleme **olayı** (`loadProgress`) yay; çizimi 1C yapar. Hedef: canlı menü ~4 s | ÇY | M | T-01 | Tk, Sn, Ar, Rk | 1A |
| T-05 ✎ | Grade'deki gren negatif renk üretiyor → SMAA NaN (karede 1 857–3 887 piksel), siyah/mor noktalar → `max(color,0)`; sıra Output → bloom → SMAA → film (gren, vinyet); hata ayıklamada NaN bekçisi. **Atlastaki renk saçakları ve tırtıklı AUGMENTER ayrı bir kökten (WebP 4:2:0, ada payı) gelir: G-07, 2C** | Y | S | — | Tk, Gr, Sn | 1A |
| T-06 | GTAO yüzünden gölge haritası karede iki kez çiziliyor (832 çizim) → `shadowMap.autoUpdate=false` + kare başına `needsUpdate` | Y | S | — | Tk | 1A |
| T-07 | Jeneratör camındaki transmission her kare sahneyi yeniden çizdiriyor (%18 CPU) → yükleyicide transmission söken adım + varlık hattı uyarısı | Y | S | — | Tk | 1A |
| T-08 ✎ | ±120 m'lik tek 4096 gölge haritası (~6 cm/teksel, sapma 7 cm), statik gölge her kare yeniden çiziliyor → **CSM 3 kademe** (0–6 / 6–35 / 35–250 m; uzak kademe önbellekli, yalnız güneş ya da sahne değişince çizilir), kademe başına sapma; isteğe bağlı PCSS. Kahraman gölgesi seçeneği Faz 4 uçakları (30–70 m) için yetersiz olduğundan elendi | Y | M | T-06 | Gr, Tk, El | 2B |
| T-09 | GTAO sahneyi baştan çiziyor (%24,8 CPU) ve son renge çarpılıyor (emisyonu ve pişmiş ışığı karartıyor) → derinlikten normal / MRT, yarım çözünürlük, AO yalnız dolaylı ışığa (onBeforeCompile); pişmiş ve emisyonlu malzemelere noAO | Y | M | 2A HDR | Gr, Tk | 2A |
| T-10 | Havaalanında 540 görünür ağ, 1552 çizim → malzeme başına BatchedMesh / merge, `matrixAutoUpdate=false`, kaporta içindeki kademeleri gizle, mesafeye göre LOD. Hedef öğle ≤ 400 çizim | O | M | T-06/07 | Tk, Gr | 2B |
| T-11 ✎ | 478 program, malzeme başına benzersiz yama anahtarları → sayısal sabitleri uniform'a taşı, görünmeyen iridescence ve anizotropiyi kaldır (**tek istisna: G-08'in dudak malzemesi**), havaalanını MeshStandard "uber" malzemelere indir | Y | M | — | Gr, Tk | 2B |
| T-12 ✎ | FPS sınırı, pil kipi, dinamik çözünürlük yok; ilk ziyaretçiye donanımdan bağımsız "orta" → 60 FPS sınırı, 30 FPS pil kipi, durağan menü ve atölyede çizmeme, otomatik kademe seçimi (dokunmatik/telefonda en düşük kademe), yüksekte 1,25–1,5 render ölçeği, `preserveDrawingBuffer` kayıt bayrağına bağlansın. **Referans zayıf donanım ölçümü:** dizüstünün tümleşik GPU'su (Windows grafik tercihini kullanıcı değiştirir) ve bir Android telefon | Y | M | 1A | Tk, Gr, El | 2B |
| T-13 | Bağlam kaybından sonra yansımalar geri gelmiyor, genel hata yakalayıcı yok → `webglcontextrestored`'da `applyEnvironment`, kare gövdesine try/catch + güvenli kip, tanılama kartı | O | S | — | Tk | 1A |
| T-14 | Tahmini doku belleği ~790 MB (RGBA8) → KTX2 (ETC1S/UASTC), 4K prosedürel kaporta dokuları çevrimdışı | O | L | — | Tk | 4E |
| T-15 | `testcell.glb` sıkıştırılmamış (−1,1 MB mümkün); web sürümü yok → meshopt; GitHub Pages / itch.io sürümü, service worker önbelleği, isteğe bağlı "hücre-lite" tek dosya | Y (dağıtım) | S | K6 kararı | Tk, Rk | 2C (meshopt) / 3B (web) |
| T-16 | Kare bütçesi görünmüyor → `?perf=1` HUD'u (geçiş başına çizim, program, CPU/GPU ms, en uzun görev, NaN) + `scripts/perf-smoke.mjs` bütçe betiği | O (temel) | S | — | Tk | 0 / 1A |
| T-17 | App.ts 1936 satırlık tanrı sınıfı; render katmanı tipsiz ve testsiz; 13 ölü export → RenderPipeline / EnvironmentManager / ModeController / UiShell ayrımı, `@ts-check` + JSDoc, ölü export'ları sil | O | L | — | Tk | 0 (iskelet) + 2B |
| T-18 | Faz 4 öncesi WebGPURenderer + TSL denemesi (derleme, CPU, compute parçacık) | D | 1–2 gün deneme | — | Tk | 4F |
| T-19 + | Görsel kabul ölçülemiyor → `scripts/visual-metrics.mjs`: vitrin kadraj setine ROI maskeleri (dudak, fan diski, alev gövdesi, duvar, ön plan, kesit kapağı), NaN sayısı, kırpılmış piksel oranı, ROI ton/doygunluk ortalaması, parlaklık histogramı, ROI SSIM, polar FFT; JSON çıktı ve önce/sonra farkı | Y (temel) | S–M | — | El | 0 |
| T-20 + | Oynanış testi, kayıt sahneleri ve audio-golden sabit sürelere bağlı (light-off ~25,1 s gibi); 1B ve 2H kalibrasyonu bunları sessizce kırar → `waitFor(event)` yardımcıları (`lightoff`, `idle`, `surge`…) ve sahnelerde olay tabanlı bekleme | Y (temel) | S | `onSimEvent` | El | 0 |

### 4.2 Grafik (G)

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| G-01 | Bloom LDR'de, ton eşlemeden sonra → HalfFloat RenderPass, ön pozlama, fiziksel mip zinciri bloom (6 seviye, ~0,04), ardından AgX → grade → SMAA | ÇY | M | T-05 | Gr, Sn | 2A |
| G-02 | Pozlama gökyüzü ortalamasından; gün batımı ve yağmur karanlık, öğle soluk → ön ayar başına EV100, log ortalamayla göz uyumu (±1,5 EV), ortam başına LUT (LUTPass), gün batımında HDRI dönüşü | Y | S–M | G-01, Dalga 0 (`exposure.ts`) | Gr, Sn | 2A |
| G-03 | Isı pusu derinlik bilmiyor (merdiven ve lüle dudağı eriyor) → depthTexture, ışın–koni kesişimiyle yol boyu, sızma önleme; ileride derinlik testli ayrı distortion tamponu | Y | M | G-01 | Gr, Sn | 2A |
| G-04 ✎ | Art yakıcı pembe palet, düz silindir, zayıf elmaslar → T(z,r) alanı, kara cisim + alev tutucu yakınında mavi, Beer–Lambert soğurma, Prandtl–Meyer şok hücreleri (karanlık aralar), yarım çözünürlük + derinlikle yumuşak geçiş; güçlü ve kırpışan abLight | ÇY | L | G-01, G-03 | Gr, Sn | **3G** |
| G-05 ✎ | Test hücresi ışıksız (MeshBasic), zeminde yansıma yok → Blender'da pişmiş ışığı ayrı lightMap'e, albedoyu ayrı dokuya ayır (2C); çalışma anında MeshStandard + lightMap, epoksi zemin (0,25–0,4), düzlemsel yansıtıcı, kutu projeksiyonlu küp harita (3H) | ÇY | L | Dalga 0 ışık sözleşmesi, 2A | Gr, Sn | **2C + 3H** |
| G-06 | Augmenter tüpünün gövdesi arka yüz ayıklanıyor (`side` kopyalanmıyor) → `mat.side = src.side`; iç yüzde kurum ve delikli detuner sacı | Y | S | — | Gr, Sn | 1F (+2C) |
| G-07 | Pişmiş atlasta renk saçakları ve tırtıklı yazı → grup ve texel yoğunluğuna göre bölme, ada payı ≥ 2 × pişirme payı, kayıpsız WebP/KTX2; yazılar MSDF ya da geometri | Y | M | T-05 önce (NaN payı ayrılsın) | Gr, Sn | 2C |
| G-08 ✎ | Dudak ve fan krom ayna, `envMapIntensity` > 1 → hepsi 1; dudak fırçalanmış Al + anizotropi (sahnedeki tek anizotropi, T-11) + erozyon; yüksek BPR fan kompozit + Ti hücum kenarı (malzeme `src/materials/engine.ts:335`, `fan.js`'e dokunmadan); speküler kenar yumuşatma (Tokuyoshi–Kaplanyan) | ÇY | S | — | Gr, Sn | 1F |
| G-09 | Termal kızıllık parça başına tek düz renk → shader'da istasyon T'lerinden T(z), parça başına termal kütle, Planck LUT, FLIR kipi | Y | M | F-10, G-01 | Gr, Sn, Fz | 4B |
| G-10 ✎ | Dönen fan ve pervane keskin, bulanıklık diski kanat sırasının içinde → önce kapsama oranlı analitik disk + kanat soldurma (1I); ekran uzayı dönme bulanıklığı ve "stroboskop / yuvarlanan perde" anahtarı 2A'dan sonra (3D) | Y | M | — | Gr, Sn, Oy | **1I** (+3D) |
| G-11 ✎ | Gece gökyüzü siyah, sahne düz aydınlık → gece HDRI ya da yıldız + ay + ufuk, sodyum/LED projektörler (1–2 gölgeli, ışık takımının parçası), dolgu kapalı, hacimsel koniler, engel lambası | Y | M | G-01/02, T-03 | Gr, Sn | **3G** |
| G-12 | Kesit kapağı tekdüze kırmızı, termal kızıllıkla aynı rengi konuşuyor → gri tarama varsayılan; ısı katmanı G-09 alanından | Y | S | K3 | Gr, Sn | 1F (+4B) |
| G-13 | Kesitte havanın yolu görünmüyor → akış görünümü: meridyen akım çizgileri, renk = T, hız = eksenel hız, surge'de ters akış | ÇY | L | G-12 | Sn, Gr, Rk, Oy | 4B |
| G-14 | Chevron'lar "yırtık kâğıt" (iki bant çakışıyor, pürüzsüz normaller); lüle ağzı tırtıklı → tek kalınlıklı bant, keskin dişler, flat normal, lüle kenar halkası | O | S | — | Gr, Sn | 1F |
| G-15 | Kir, aşınma ve ürün gerçekliği yok (kutu stand, düzenli panel ızgarası, plastik tapa) → trim sheet + eğrilik maskeli yıpranma, I-profil stand, is gradyanları; "RES" ve ayna yazı decal'ları düzeltilsin | Y | L | G-08 | Gr, Sn | 4E |
| G-16 ✎ | Parçacıklar ışıksız, sert kesişimli; is izi damga gibi → yumuşak parçacık (derinlik), sargı ışık / 6 yönlü lightmap, kir haritası RT | O | M | G-03 depth | Gr | **3G** |
| G-17 | Yağmur çizgileri 3–5 kat uzun, sıçrama yok, motor ıslanmıyor → v × perde boyu, ileri saçılma, sıçrama, ıslak motor varyantı, çatı örtme; vorteksin yağmuru yutması (G-20 ile ortak alan) | O | M | G-20 | Gr | 4E |
| G-18 | Islak zemin tek 256 px'lik probu yansıtıyor → düzlemsel yansıtıcı (G-05 ile ortak) ya da zemin SSR | O | M | G-05 | Gr | 4E |
| G-19 | AA yalnız SMAA; DPR 1'de süper örnekleme yok → durağan kamerada TRAA birikimi, render ölçeği seçeneği | O | S–M | T-05 | Gr, Tk | 2A |
| G-20 + | Tam güçte giriş ve egzoz çevreyle etkileşmiyor → **giriş zemin girdabı**: kütle debisi, giriş merkezinin yüksekliği/çap oranı ve rüzgâr hızıyla oluşma ölçütü; nemli havada yoğuşma hortumu, kuru havada toz; egzoz arkasında zeminden kalkan toz ya da su sıçraması. Veri zaten var (`weather.humidity`, kütle debisi, Vj) | Y | M | G-16 parçacık ışığı | Sn (+Gr) | 3G |

### 4.3 Sanat ve kimlik (K)

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| K-01 | Inter/JetBrains Mono tanımlı ama yüklenmiyor; ekranda Segoe UI ve Consolas var → woff2 gömülü üç aile, tip ölçeği, EICAS tuvali aynı mono aile | Y | S | — | Sn | 1C |
| K-02 ✎ | Logo yok, yükleme ekranı boş → **üç SVG logo adayı, kullanıcı seçer (kapı)**; ardından 16/24/64 px ve tek renk sürümleri; yükleme ekranı 1A'nın `loadProgress` olayını çizer, meridyen kendini çizer, "Biliyor muydun?" notları | Y | M | K-01, K7 | Sn, Ar | 1C |
| K-03 ✎ | Renk dili dağınık (gökkuşağı istasyonlar, her yerde camgöbeği, kütle şeridinde anlam renkleri) → `palette.ts` + CSS değişkenleri (bölüm 2), rampa istisnaları yazılı; panel estetiği (4 px köşe, 1 px çizgi, özel kaydırıcılar) | Y | M | — | Sn, Ar | 1C |
| K-04 ✎ | Test hücresi kimliksiz gri bir kutu → koyu beton, delikli akustik panel, sıcak ışıklı kontrol odası camı, çalışırken dönen amber ikaz lambaları, hacimsel tavan lambaları. Geometri ve pişirme 2C'de, dinamik lambalar 3H'de | Y | L | G-05 | Sn, Gr | 2C + 3H |
| K-05 | Menü kamerası başıboş dönüyor (kırpık motor, öne geçen sehpa, arkadan egzoz) → 4 çekimli küratörlü vitrin dizisi, kompozisyon kuralları, menüde sehpa gizli ya da inceltilmiş | Y | M | Dalga 0 (`camera/shots.ts`) | Sn, Rk | 2F |
| K-06 | Müze kesiti + patlatılmış görünüm + teknik çizim kılavuz etiketleri (M5b'deki patlatılmış görünüm ve istasyon renkleri buraya bağlanır) | ÇY | L | G-12, G-13 | Sn, Rk | 4B |
| K-07 | Atölyenin kendi sahnesi yok → blueprint "tasarım tezgâhı" sahnesi, 3B ölçü çizgileri, kil/blueprint görünümü, şablon karuseli | ÇY | L | K-03 | Sn, Rk | 4C |
| K-08 | Sanat kararları yazılı değil → `docs/ART.md` (palet, tipografi, ışık reçeteleri, kamera kuralları, referans panosu) | O (temel) | S | — | Sn, Rk | 1C |
| K-09 | Hareket dili yok (paneller `display:none` ile anında açılıp kapanıyor) → süreler, easing, kamera uçuşuyla eşzamanlı panel girişleri, sayaç animasyonu | O | S | K-03 | Sn, Ar | 1C (+2E) |
| K-10 + | İmza kimlik ("teknik çizim") yalnız arayüzde var, 3B'de yok → **canlı teknik çizim kipi**: derinlik ve normal kenar çıkarımı (1 px), kesit taraması, canlı istasyon etiketleri, blueprint zemin, renk yalnız sıcaklık rampasından; T tuşuyla oyunda ve fotoğraf kipinde ön ayar | ÇY | M | 2A (derinlik dokusu), G-12, K-03 | Sn (fotoğraf ön ayarı olarak önerdi), El | 3A |

### 4.4 Menü ve arayüz (A)

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| A-01 | Bilgi bankasında 14/34 girdide "null" yazıyor (`Menus.ts:125`) → `filter(Boolean)`; ardından arama, kategoriler, "3B'de göster", ilgili ders | Y | S (+M) | — | Ar, Sn | 1D |
| A-02 | Ders sonu yıldızları 13 px (CSS çakışması), ödül anı yok, eski UYARI ekranda kalıyor → `.result-stars .stars{font-size:inherit}`, `toasts.clear()`, birincil "Sonraki ders" / "Vitrin senaryosu" / "Atölyede tasarla" eylemi; tam ödül ekranı 3C'de | Y | S | — | Ar, Sn, Oy, Rk | 1D |
| A-03 | Uyarı hiyerarşisi yok: UYARI ile BİLGİ aynı kanalda, ikisi de 4,2 s'de soluyor → MASTER WARNING/CAUTION (yanıp söner, onay ister), sol altta simülasyon saatli olay günlüğü, otomatik çalıştırma için tek ilerleme hapı, `role=alert`, bildirimler motorun güvenli dikdörtgenine girmez | ÇY | M | — | Ar, Sn, Oy | 1D (temel) + 2E |
| A-04 | Paneller ekranın ~%55–60'ını kaplıyor → kokpit dock (28 px sekmeye katlanır), çalıştırma paneli rölantide tek satırlık şeride döner, odak kipi (gaz > 0,8), sinema kipi, `setViewOffset` motoru ortalar, düzen saklanır | Y | M | Dalga 0 (`camera/viewport.ts`) | Ar, Sn, Oy | 2E |
| A-05 | Arayüz ölçeklenmiyor (1440p'de küçük; 8,5–10,5 px etiketler) → `--ui: clamp(0.85, 100vh/900, 1.6)`, rem, container query, Ayarlar'da %80–150; 1920 ve 2560 referans kareleri | Y | M | K-03 | Ar | 2E |
| A-06 | EICAS'ta N1 komut sektörü, amber bant ve TO referansı yok; CAS'ta TR/EN karışık; SM ve itki kokpit göstergesi gibi duruyor → 777 düzeni, ENG FAIL / ENG EGT EXCD gibi İngilizce CAS + Türkçe açıklama, advisory amber, SEC ENG sayfası (E), EGT aşım hafızası; SM, β, T4, P3 ve itki test konsoluna (F-14 ile) | Y | M | K4 | Ar, Fz, Sn | 2E |
| A-07 | Ana menü hiyerarşisiz; atölye en altta; "Devam et" yok → Devam et kartı, Akademi + Atölye birincil, Test hücresi ikincil, vitrin senaryoları şeridi, Bilgi bankası ve Ayarlar metin bağlantısı; kart üzerine gelince 3B tepki; motor parçası simgeleri | Y | M | K-01/03 | Sn, Ar, Oy, Rk | 2F |
| A-08 | Atölye başlangıcı: 7. kart kesik, siluetler ortak ölçekte değil, birim yok, koçluk balonu modalın üstünde → ≥1280 px'te 4 sütun / hangar şeridi, ortak ölçekli küçük görüntüler + 1,8 m insan silueti, birimler (g/kN·s, g/kW·h), karmaşıklık etiketi | Y | M | — | Ar, Oy, Fz | 1G |
| A-09 | Koçluk balonları hiçbir şeyi göstermiyor (`data-where` kuralı yok) → ankrajlı spot ışığı, "hayalet el" sürükleme animasyonu, eylemle ilerleme, aşamaya bağlı diziler | Y | M | — | Ar, Oy | 1G (aşama) + 3E |
| A-10 | Doğrudan düzenleme dört özdeş noktadan ibaret → yön glifleri, Alt ile adlar; yeni tutamaçlar (yanma odası, HPT/LPT kademe, BPR, AB boyu, lüle boğazı); dik yan görünüm "çizim masası"; satır içi düğme paneli; kaydırıcı ile 3B arasında çift yönlü vurgu (= M5b) | ÇY | XL | K-07 | Ar, Sn | 4C |
| A-11 | Sonuç paneli: kırmızı uyarı kaydırmanın altında, sınır çubuklarının yönü tutarsız, kütle açıklaması eksik, kaydırma işareti satıra biniyor → durum çipi, uyarı üstte, "sınıra kullanım %" normalleştirmesi, sekmeler, tam kütle açıklaması | Y | M | — | Ar | 1G (işaret) + 3E |
| A-12 | Ad alanı ile seri kodu çelişiyor, kod itkiyle kendiliğinden değişiyor → oyuncunun adı birincil, seri kodu ikincil ve ad verildikten sonra donar; hücre seçici tasarım adını gösterir | O | S | — | Ar, Oy | 1G |
| A-13 | Ondalık ayırıcı ve birimler kipten kipe değişiyor; İngilizceye hazırlık yok → tek `fmt` modülü (tr-TR; EICAS bilinçli olarak noktalı), birim sistemi, tr/en dize tablosu | O | M | K4 | Ar | 2E |
| A-14 | Ayarlar: çift ses kontrolü, yanlış kısayol listesi (1–7 yazıyor, kod 1–8; B ve atölye tuşları yok) → sekmeli ayarlar, tek dB sürgüsü + bus sürgüleri, tuş tablosundan üretilen bağlama duyarlı "?" kaplaması | O | S | 1E API | Ar, Ss | 1D |
| A-15 | Erişilebilirlik ve renk körlüğü: yalnız kırmızı/yeşil kodlama, reduced-motion yok, `aria-valuenow` güncellenmiyor → biçim + renk (▲/▼, tarama), CVD kipi rampayı global değiştirir (bölüm 2), EICAS canlı bölgesi, okunacak metinlerde `user-select`, CDP görme bozukluğu emülasyonuyla kayıt | O | S | K-03 | Ar | 2E |
| A-16 | Ders paneli metin duvarı, 3B işaret yok, "Geri" düğmesi yok → adım başına en çok 3 cümle + katlanır "Neden?", 3B kılavuz etiketleri, Geri düğmesi, pasif Devam'da "2 hedef kaldı" | Y | M | K-06 etiketleri | Ar, Oy | 3C |
| A-17 | Test hücresi sol paneli tek uzun kaydırma; arızalar ekranın altında → sekmeler (Motor / Koşullar / Arızalar / Görünüm), arıza senaryo kartları, siluetli motor seçici | O | S | — | Ar | 3F |
| A-18 | T–s'de istasyon etiketleri üst üste biniyor → çakışma önleyici, üzerine gelince değerler ve süreç adı, şemada ve 3B'de eşzamanlı vurgu | O | S | F-11 aynı dosya | Ar | 2H |
| A-19 | Gaz kolu ve anahtarlarda fiziksel his yok → ışıklı basmalı butonlar, iki aşamalı korumalı yakıt anahtarı, kademede takılma ve ses, AB "kapısı" | O | M | S-15 | Ar | 2E |
| A-20 | Mimari kartları metin ağırlıklı → meridyen silueti, üzerine gelince 3B hayalet önizleme, 0,6 s dönüşüm animasyonu | O | M | — | Ar | 3E |
| A-21 + | Duraklatma yok (kodda pause yok); büyük anlar kaçıyor → Boşluk ile duraklat (sim zamanı durur, ses kısılır, kamera serbest), nokta ile tek adım; anlık tekrar ve PiP O-09'da | Y | S | kanca isteği | Ar, El | 1D |
| A-22 + | Dokunma desteği hiç yok (`src/`'de touchstart / pointerType / matchMedia / maxTouchPoints aramaları boş), oysa paylaşım bağlantılarının çoğu telefonda açılacak → dokunmatik yörünge ve kıstırma, dokunmatik gaz kolu, ≥ 44 px hedefler, otomatik en düşük kademe; dar ekranda "motor kartı + 3B görüntüleyici" kipi (paylaşım bağlantısının telefon yüzü); tam atölye masaüstünde kalır | ÇY (yayılma) | M | T-12, O-14 | El | 3B (+Y-04) |
| A-23 + | Gamepad ve titreşim yok → tetikle gaz kolu, düğmeyle kesit ve fotoğraf; surge, kuş çarpması ve light-off'ta Gamepad API titreşimi (telefonda `navigator.vibrate`); ayardan kapatılabilir | O | S | O-10 | El | 3D |

### 4.5 Oynanış ve ilerleme (O)

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| O-01 | Tasarla → test et döngüsü 40,7 s + dengelenme ≈ 45–50 s → "Hızlı test" (`sim.trim`, 2–3 s'lik kamera geçişi) + "Kabul testi" (4× protokol, itki/TSFC/EGT payı/ivmelenme kaydı) + test raporu kartı | ÇY | S | — | Oy | 1H |
| O-02 | Atölye görevleri bir açılır listeye gömülü, ödülsüz, test hücresiyle bağsız → başlangıçta "Sipariş panosu": 15–25 sözleşme, EnvelopeBox hayalet kutu, iki aşamalı doğrulama (tasarım + kabul testi), bronz/gümüş/altın, yerel en iyi; haftalık tohumlu sipariş | ÇY | L | O-01 | Oy, Rk | 3C |
| O-03 ✎ | Kalıcı ilerleme yok → isteğe bağlı kariyer (Stajyer → Baş tasarımcı), `career:v1` şeması; Serbest kip açık kalır. **Dönem kilitleri (1950 TJ → 2015 CMC/dişli fan) M5c dönem verisine bağlı olduğu için 4D'de eklenir** | ÇY | L | O-02; dönemler için M5c | Oy | 3C (rütbe) + 4D (dönem) |
| O-04 | Başarım yok, 19 olay türü boşa gidiyor → 30–40 başarım (bir kısmı gizli), menüde vitrin | Y | S | — | Oy | 3C |
| O-05 | Ders yolu dağınık (ders 6 ders 5'ten sonra), yalnız yolcu TF dersi var → üç bölüm (Temel / Operasyon / Tasarım), checkride sınavı, önerilen sonraki ders, küçük görüntülü kartlar; yeni dersler: art yakıcı, turboprop beta, turboşaft, "Atölye 101" | Y | L | F-04, F-17 | Oy, Ar | 3C + 4D |
| O-06 | Yıldızlar ustalığı ölçmüyor, ders 7 kaybedilemiyor → ders başına simülasyon metrikleri (tepe EGT, kurtarma süresi), eşikler, kişisel rekor; "Test raporu" biçimli sonuç ekranı (telemetri grafiği, öğrendiklerin) | Y | M | A-02 | Oy, Rk | 3C |
| O-07 | Ders 1'in ilk 6 adımı okuma → "havanın yolculuğu" raylı kesit uçuşu + küçük etkileşimler, alt yazı en çok 2 cümle | Y | L | G-13 | Oy, Rk | 4B |
| O-08 | Test hücresi oyun alanı değil → FAR/CS-33 esinli test kartları + "Arıza avı" (gizli arıza, EICAS'tan teşhis, süre/hasar/doğruluk puanı, günün arızası) | ÇY | M | F-16 | Oy, Fz | 3F |
| O-09 ✎ | Büyük anlar ekranın kenarında kalıyor → 10 s halka tampon + anlık tekrar; olay kamerası PiP'i (0,25× yeniden oynatma); isteğe bağlı sinematik anlar. Duraklatma A-21'e taşındı | Y | L | 2H `snapshot/restore` gövdesi | Oy, Ar, Rk | 3D |
| O-10 ✎ | Kamera sarsıntısı beyaz gürültü, yalnız konum → trauma² modeli, 2–3 oktav gürültü, dönme ağırlıklı, itki × yakınlık gürlemesi, ayar kaydırıcısı (1I); olay darbeleri ve 1×N1 yörüngesi (3D) | Y | S | Dalga 0 (`camera/shake.ts`) | Oy | **1I** + 3D |
| O-11 | Kuş çarpması ve hasarın görsel karşılığı yok → tüy/parça patlaması, kanat ucu bükümü, leke maskesi, türbin hasarında kıvılcım; boroskop mini oyunu | Y | M (+L) | — | Oy, Rk | 3D + 4F |
| O-12 | Fotoğraf kipi yok → P: simülasyonu dondur, serbest kamera, 14–200 mm, bokeh DOF (tıkla-odakla), pozlama/LUT ön ayarları (Müze kesiti, Gece testi, Teknik çizim K-10, 1958 arşiv, demir yayı FLIR), 2×/4× PNG, motor kartı + QR çerçevesi | ÇY | M | G-01, G-19 | Rk, Sn, Gr, Oy | 3A |
| O-13 | Klip ve GIF kaydı yok → MediaRecorder ile 15 s halka tampon, olay tostu ("Bu anı kaydet?"); belirlenimli yeniden çizimle 60 fps / ağır çekim klip | ÇY | M | O-09 | Rk | 3A |
| O-14 ✎ | Paylaşım yok (tasarım localStorage'da, dosya 27,8 MiB) → deflate + base64url kod, `#m=` bağlantısı, şema sürümü ve **`kind: "engine" \| "aircraft"`** alanı (Faz 4), göç testleri, teknik föy/poster (SVG/PNG); M5b'nin paylaşım kodu bu biçimde tanımlansın | ÇY | M | T-15 web | Rk, Oy, El | 3B |
| O-15 | Menü statik, oyuncunun motorları görünmüyor → "Hangar" ekranı, menünün kahraman motoru son tasarım, ara sıra "attract" döngüsü | Y | M | A-07 | Oy | 2F (menü) + 3C (Hangar) |
| O-16 ✎ | Atölyeden hücreye geçiş ve ilk ateşleme sıradan geçiyor → hücre içi sinematik (sehpaya oturma, ikaz lambası, geri sayım, "İLK ATEŞ" damgası, seyir defteri) 3E'de; tezgâhtan vinçle indirme 4C'den sonra | Y | M | O-01; vinç için K-07 | Oy, El | 3E (+4C) |
| O-17 | Kişiselleştirme yok → kaplama sekmesi (renk, aile logosu çıkartması, seri levhası) | O | M | — | Oy | 4C |
| O-18 ✎ | Motorun uçakta ne işe yaradığı görünmüyor → **O-28'e birleştirildi.** Yalnız silüet ve sayı kartı (kalkış mesafesi, Breguet menzili) bir vay anı değil; motor kartının sayısal kısmı M5c'de kalır | — | — | — | Oy, Rk, El | → O-28 |
| O-19 | Ders ve atölye bağı zayıf, bağlantılar alakasız derslere gidiyor → atölye içinde güdümlü tasarım dersleri, uyarılarda 30 s'lik mikro anlatım | O | M | — | Oy | 3E |
| O-20 | Tasarımın gerçek dünyadaki yeri görünmüyor → 50–80 gerçek motorluk veri dosyası (kaynaklı), T/W–TSFC saçılım grafiği, "en yakın üç motor", model doğrulama sayfası | Y | M | F-21 | Rk, Fz | 3E |
| O-21 | Deney defteri yok → "Ölçüm al", otomatik taramalar (itki–N1, TSFC–irtifa, EGT–dış sıcaklık), CSV/PNG dışa aktarım | Y | M | — | Rk | 3F |
| O-22 | Eğitim pazarı fırsatı → Part-66 M15 etiketleri, sınav kipi, yazdırılabilir özet, öğretmen paketi | Y | M | O-05, Y-03 | Rk | 4F |
| O-23 | Yüksek hızlı kamera kipi yok → 1/20× ve 1/50×, zaman kodu, "2000 fps" etiketi | O | S | O-09 | Rk | 3A |
| O-24 | AR ve dışa aktarım yok → WebXR immersive-ar (gerçek ölçek), GLB/STL dışa aktarım | D | M | A-22 | Rk | 4F (en son, kesilebilir) |
| O-25 | Arızalar gösterişsiz → kanat kopması testi (muhafaza kütlesine bağlı sonuç, ağır çekim) + sıcak çalıştırmada kuyruktan alev şöleni (M6'dan öne çekilir). Gerçek kanat kopması test videoları geniş kitlelerce bilindiği için yüksek paylaşım potansiyeli var | ÇY | XL | O-09, O-11 | Rk | 4F |
| O-26 + | Oyuncu en etkileyici sahnelere ancak menüleri kurcalayarak ulaşıyor → **vitrin senaryoları**: 16 kayıt sahnesi (`scripts/capture/scenes/*.json`: ab, rain, shutdown, surge, steam, soot, m5a-*…) zaten ortam, motor, kamera ve sim durumunu kuruyor. Bunları tek tıklık oyuncu kartlarına çevir (menüde şerit, test hücresinde sekme, ders sonu önerisi). `setup` JS metinleri bildirimsel veriye çevrilir (üretimde eval yok); aynı veri fragman çekimlerini de besler | Y | S–M | T-20 | El | 2F |
| O-27 + | Paylaşım tek yönlü → **meydan okuma bağlantısı** (sunucusuz, asenkron çok oyunculu): `#m=` + hedef sözleşme + gönderenin kabul testi sonucu. Alıcı atölyede gönderenin motorunu hayalet meridyen olarak üstte görür; kendi kabul testinden sonra "sen / arkadaşın" kıyas kartı çıkar ve geri gönderilebilir. Haftalık tohumlu siparişle aynı tohum kullanılır | Y | M | O-14, O-02 | El | 3B |
| O-28 + | Faz 4'e köprü yok → **uçan test yatağı**: oyuncunun motoru dört motorlu jenerik bir test uçağının iç pylonuna takılır (gerçek uçan test yatakları gibi). Kalkış, tırmanma, seyir, motoru kapatıp rüzgârlanma ve relight testi; sonuç motor kartına yazılır. Faz 4 uçak tasarımının ilk oynanabilir adımı | ÇY | L | F-04, M5c motor kartı, T-08 CSM | El (O-18'in yerine) | 4F |
| O-29 + | "Millet inanamasın" ölçülmüyor → **insan ilk oturum testi**: 5 yeni oyuncu, sesli düşünme, ilk çalıştırmaya süre, ilk kendiliğinden tepki, bırakma noktası, 1–10 puan; Dalga 2 sonrası ve Dalga Y öncesi. Kullanıcı düzenler, ajanlar protokolü ve not şablonunu hazırlar | ÇY (doğrulama) | S | — | El | kapı (2 ve Y) |

### 4.6 Fizik ve eğitim (F)

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| F-01 | HPC surge payı rölantiye doğru artıyor (%34 → %57) → kademe yığılması terimi, handling bleed (N2c < ~%80), VSV programı. Hedef: tasarımda %20–25; rölantide bleed kapalıyken %0–5, açıkken %15–20 | ÇY | L | — | Fz | 2H |
| F-02 | Ders 5'te "kompresör haritası" adımında harita yok → canlı harita paneli: hız hatları, surge hattı, verim adaları, çalışma hattı, solan iz; fan sekmesi. Aynı bileşen M5b atölye grafiklerinde kullanılır | ÇY | M | F-01 | Fz | 2H |
| F-03 | Atölyedeki VSV düğmesi plasebo; HPC haritası tasarımdan bağımsız → hız hattı çöküşü kademe başı PR ve kademe sayısından türesin, VSV ve bleed bunu bedelli telafi etsin, yeni uyarı ("tek milde PR 12, VSV yok") | ÇY | L | F-01 | Fz | 2H |
| F-04 ✎ | Rüzgârlanma ve relight yok (M0,8'de N1 %2); LBO sabit FAR → ram akışı, rüzgârlanma torku, yükleme parametresine bağlı LBO ve ateşleme, relight zarfı, "seyirde alev sönmesi" dersi. **O-28 uçan test yatağının ön koşulu** | ÇY | L | F-05 | Fz | 4D |
| F-05 | Çalıştırmada N1 light-off'a kadar sıfır; ders 2 bunu doğruymuş gibi öğretiyor → LPT'nin çekirdek akışından aldığı tork, statik/dinamik sürtünme ayrımı; "N1 dönüşünü doğrula" adımı ve "sıkışmış N1" arızası | Y | M | — | Fz | 1B |
| F-06 | TJ ve askerî TF'de LP rölantisi %18–21; LPC akış eşleşmesi yok; limitler bütün tiplere kopya → LPC harita + akış eşleşmesi, N1/N2 oranı 0,6–0,8, tipe göre limitler | Y | M | — | Fz | 1B |
| F-07 | Surge'de T4 2900 K, EGT 1886 °C → FAR'a bağlı cp(T), ayrışma tavanı (~2300–2400 K), zengin sönme, surge'de yanma verimi çöküşü; EGT sıçraması +100–300 °C | Y | M | — | Fz | 1B |
| F-08 | Tek tip surge → durum makinesi: pop / tekrarlayan / kilitli (rotating) stall; ders 5'e teşhis görevi | Y | M | F-01, F-02 | Fz | 2H |
| F-09 | Düz derecelendirme yok (ISA+15'te EGT sınırlayıcı devrede) → TO/MCT/CLB derecelendirmesi, köşe sıcaklığı, köşede 50–80 K EGT payı, FLEX kalkışı; ders 6 metni ve EGT payı tanımı düzeltilsin | Y | M | — | Fz | 2H |
| F-10 | Kapatmada EGT 5 s'de ortama iniyor → toplu ısıl kapasiteler (τ 10–120 s), EGT probu metal ve gazı karışık okur; sıcak yeniden çalıştırma, bükülmüş rotor, soğuma rölantisi; görsel kızıllık için ortak kaynak | Y | M | — | Fz | 1B |
| F-11 | T–s termodinamik olarak tutarsız (izobarlar, 3→4 kiriş, AB'de istasyon 7 yok, kapanış yok, birim yok) → tek referanslı entropi, bölüm başına izobar, politropik ara noktalar, 9→0 kesikli kapanış, alan gölgesi | Y | M | — | Fz | 2H |
| F-12 | Ders 3: "T4 hem güçlü hem verimli" yanılgısı; η görünmüyor → metin düzeltmesi (1B), enerji akışı Sankey'i, canlı η_ısıl / η_itki / η_toplam, "tahmin et → dene" adımı | O | M | — | Fz | 1B (metin) + 4D |
| F-13 | Ders 4: %95 N1 %95 itki sanılıyor; uçuş rölantisi yok → itkiden ölçüm, metin düzeltmesi; yaklaşma rölantisi 4D'de | O | S | — | Fz | 1B |
| F-14 | SM ve itki EICAS'ta kokpit göstergesi gibi → kokpit/test konsolu ayrımı, EPR, ayrı N1/N2 titreşimi (A-06 ile) | O | S | — | Fz, Ar | 2E |
| F-15 | Soğutma havası ve müşteri bleed'i yok; T4 bedava → basit soğutma modeli (istasyon 41), PACK/ANTI-ICE anahtarları, "T4 ↑ → soğutma ↑ → TSFC optimumu" eğrisi (M5c'nin soğutması öne alınır) | Y | M | — | Fz | 4D |
| F-16 | Arıza seti dar → arıza kütüphanesi: yağ basıncı, yangın, sensör sapması, yakıt filtresi, takılı VSV, açık bleed, LP mil kopması, su/kül yutma, kuyruk borusu yangını; TP/TS kuş çarpması etkisi; zaman-sıcaklık aşım eğrisi; EGT payı trendi ve su yıkama | Y | L | — | Fz, Oy | 3F |
| F-17 | Pervane: sabit verim 0,85; tüy, beta ve ters hatve yok → CT/CP(J, β), uç Mach düzeltmesi, kondisyon kolu, otomatik tüy, NTS | Y | L | — | Fz | 4D |
| F-18 | TP/TS: tork sınırı yok, soğuk günde güç düşüyor → PLA → tork hedefi, min-seçim (TQ/ITT/NG/NP), "TQ LIM" etiketi, OEI derecelendirmesi | O | M | F-17 | Fz | 4D |
| F-19 | Otomatik çalıştırmada iptal mantığı yok; EGT tepesi erken; bütün tiplerde APU bleed → Wf/P3 programı, iptal ve yeniden deneme, tipe göre marş sistemi | O | M | — | Fz | 1B |
| F-20 | Ders 7 uçuş ilkesine ters bir alışkanlık öğretiyor → yer testi bağlamına çek; uçuş senaryosu Faz 4'e (O-28) | O | S | — | Fz | 1B |
| F-21 | Şablon kartlarındaki gerçek motor sınıfları ölçekle çelişiyor (319 kN'a "CFM56-7", 49 kN'a "J85", 145 kN'a "TFE731"; `StartScreen.ts:21-24`, `architecture.ts:1060-1100`) → etiketleri düzelt (GEnx/Trent 1000; J57/Avon; CFM56-5C/JT8D-200; F100/F110), birimler, ±%30 testi | O | S | — | Fz, Rk, Ar | 1G |
| F-22 | Rölanti EGT'si düşük (255 °C) → (N_c, β) üzerinde 2B verim adaları, aksesuar yükü; hedef ~400 °C, FF kalkışın ~%6–8'i | O | M | F-02 verisi | Fz | 2H |
| F-23 | Art yakıcı geçişleri ideal → A8 aktüatör gecikmesi, fan çalışma hattı döngüsü, sert ateşleme ve fan stall, sönme zarfı, AB dersi | O | M | F-02 | Fz | 4D |

### 4.7 Ses (S)

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| S-01 | Tek master ve "yapıştırıcı" kompresör; rölanti −38 LUFS → bus ağacı (motor yakın/uzak, olay, ortam, arayüz, müzik) + AudioWorklet tepe sınırlayıcı (−1 dBTP). Hedefler: rölanti −28, tam güç −18, AB −13 LUFS; bilinçli ducking | ÇY | M | — | Ss | 1E |
| S-02 | Sekme gizlenince ses son seviyede donup çalmaya devam ediyor → `visibilitychange` ile kısma + `suspend`/`resume` | Y | S | — | Ss | 1E |
| S-03 | Fiziksel olmayan 9×N2 üçgen dalga tınıyı ele geçiriyor; HPC 38 kanatla sabit kodlu, TP'de 18,8 kHz → whine2'yi kaldır, kanat sayısı tasarımdan, kademe BPF + 2×BPF, dar bant "tümsek", hafif FM, 14 kHz üstünü yumuşak kıs | ÇY | M | — | Ss | 1E |
| S-04 | Buzz-saw yalnız çift mertebeli düzenli testere → PeriodicWave ile tasarımdan tohumlanmış düzensiz mertebeler, uç Mach 1,0–1,15'te giriş, yalnız ön yay | Y | S | — | Ss | 1E |
| S-05 | Jet gürültüsü Lighthill/Strouhal'a uymuyor; ön/arka fark 3,5 dB → iki kaynaklı model (f_p ≈ 0,1·Vj/Dj ve 0,2·Vj/Dj), Vj ölçeklemesi, θ yönsellik tablosu, jet kaynağı lülenin 5–10 Dj arkasında | Y | M | S-06 | Ss | 2G |
| S-06 ✎ | Uzamsallık yok (mono, tek nokta) → motor başına üç yayıcı (giriş, çekirdek, egzoz), **N motorlu mimari** (Faz 4 çok motorlu uçak ve O-28), PannerNode, kulaklıkta HRTF, dinleyici kameraya bağlı | ÇY | M | S-01 | Ss, El | 2G |
| S-07 | Mesafe modeli bütün aralıkta 6 dB → ters mesafe yasası, hava soğurması alçak geçireni, yankı payı, yayılma gecikmesi | Y | S | S-06 | Ss | 2G |
| S-08 | Ortam akustiği yok → prosedürel dürtü yanıtı (hücre RT60 ~1,5 s, augmenter tarak süzgeci), hangar "slap" yankısı, yağmur/rüzgâr/jeneratör yatakları | Y | M | S-01 | Ss | 2G |
| S-09 | Zemin yansıması yok → her yayıcıya gecikmeli ikinci yol (tarak süzgeci, kamera hareketinde doğal flanş) | O | S | S-06 | Ss | 2G |
| S-10 | Art yakıcı ve surge sönük → tutuşma "BUM"u, zon darbeleri, AudioWorklet çatırtısı (Poisson N-dalgası, arka yay); surge N-dalgası + "huff", 4 varyant sırayla, `s.surging` boyunca tonların çökmesi | ÇY | M | S-01 | Ss | 2G |
| S-11 ✎ | Çalıştırma ve kapatma dizisi zayıf (marş saf sinüs; rölanti motorlamadan sessiz) → APU bleed "şşş", hava türbinli marş ıslığı, kavrama "klonk"u ve serbest sönüm, light-off "vuff"u (V0 ve V1'in sesi); kapatmada iç çekiş, rüzgârlanma ve termal "tink" | Y | M | S-01 | Ss | 2G |
| S-12 | Kuş çarpması ve hasar duyulmuyor → tok darbe + inharmonik metal çınlaması + kırıntı tıkırtısı; dengesizlik uğultusu ve "vuv-vuv" genlik modülasyonu | O | M | S-01 | Ss | 2G |
| S-13 | Sabit durumda ses ±0,3 LU, tek 4 s döngü → katman başına yavaş rastgele modülasyon (OU/Perlin), asal süreli tamponlar | O | S | — | Ss | 1E |
| S-14 | Turboşaft delici saf ton kümesi; turboprop 120 Hz'de kalıyor → redüktör diş geçişi, darbe dizili pal geçişi, uç girdabı bandı | O | M | S-03 | Ss | 2G |
| S-15 | Kokpit, CAS ve arayüz tamamen sessiz → prosedürel anahtar tıkı, kertik sesi, master caution çanı, uyarı tonu, yangın zili (sustur düğmesiyle), önem düzeyine göre earcon, ders başarı sesi | Y | S | S-01 | Ss, Rk | 2G |
| S-16 | Sessiz açılış, ilk tıklamada ani drone, müzik yok → 2 s'lik açılma, ses logosu (spool-up), BPF'ye akortlu ambient pad (derste ve atölyede kısılır, ayrı sürgü) | Y | M | S-01 | Ss | 2G |
| S-17 | Atölye sessiz → "Dinle" (voiceTargets ile 3 s ön dinleme, A/B karşılaştırma), sürüklemede tık, modül oturunca "tunk", sınır geçişinde yumuşak ton | Y | M | S-03, S-04 | Ss, Rk | 3E |
| S-18 | Kesitte "akustik röntgen" fırsatı kullanılmıyor → parça üzerine gelince o katman solo çalar ve etiket çıkar ("22 × 2 550/60 = 935 Hz"), canlı spektrogram, kesitte boğuk "içeriden" perspektif | Y | M | S-06 | Ss | 4B |
| S-19 | Sürgü doğrusal, tek bus, hoparlör profili yok → dB sürgüsü, bus sürgüleri, çıkış profili (dizüstünde ve telefonda psikoakustik bas) | Y | S | S-01 | Ss | 1E (API) + 1D (arayüz) |
| S-20 | Olay zamanlayıcıları gerçek zamana bağlı (¼×'te ateşleyici gerçek hızda tıklıyor) → simülasyon saati, isteğe bağlı ağır çekim sunumu | D | S | — | Ss | 1E |
| S-21 | Ses için regresyon testi yok → `scripts/audio-golden.mjs` (8 senaryo: LUFS aralığı, tepe < −1 dBTP, ton belirginliği < 25 dB, 150 Hz altı enerji payı; senaryolar olay tabanlı bekler, T-20) + F9 katman ölçeri | O (temel) | S | T-20 | Ss | 1E |

### 4.8 Yayın (Y) +

| Kimlik | Sorun → öneri | Etki | Emek | Bağımlılık | Uzman | Paket |
|---|---|---|---|---|---|---|
| Y-01 | "Millet inanamasın" için gösterilecek bir film yok → 60–90 s'lik fragman: belirlenimli kayıtla 60 fps, ses dahil (OfflineAudioContext ya da MediaRecorder ile ses izi), vitrin senaryolarından (O-26) kurgulanır. Yapı: soğuk açılış → tekme → gece AB → teknik çizim kipi → atölye → meydan okuma bağlantısı | ÇY | M | 3A, 3G, 2G, O-26 | El | Y |
| Y-02 | Tanıtım yüzeyi yok → açılış sayfası (web sürümünün kökü), itch.io sayfası, basın kiti (logo, 10 kare, 3 GIF, TR/EN kısa metin) | Y | S | K6, Y-01 | El, Rk | Y |
| Y-03 | Dünya kitlesi Türkçe arayüzü okuyamıyor → İngilizce arayüz, ders metinleri ve bilgi bankası (A-13'ün dize tablosu üzerine); Türkçe varsayılan kalır | Y | M | A-13, K4 | El | Y |
| Y-04 | Telefonda ilk izlenim doğrulanmamış → A-22 cilası, düşük kademe ölçümü (bir Android telefon), telefonda paylaşım bağlantısı akışı uçtan uca | Y | S–M | A-22, T-12 | El | Y |
| Y-05 | README vitrin değil → hero GIF, "ilk 10 dakika" anlatımı, teknik çizim karesi, fragman bağlantısı | O | S | Y-01 | El | Y |

**Uzmanlar arası çelişkilerin çözümü:**
- Kesit kapağında grafik canlı sıcaklık renklerini, sanat gri taramayı istedi. Çözüm: gri tarama varsayılan, ısı katmanı anahtarlı (K3).
- Gece için grafik daha çok gölgeli spot istedi, teknik sabit ışık sayısı istedi. Çözüm: sabit ışık takımı, şiddetle açma/kapama ve ön-ısıtma. Gece projektörleri bu takımın parçası olur. Sözleşme Dalga 0'da, uygulama 2B'de, gece görünümü 3G'de (T-03 → G-11).
- Grafik AO'yu malzeme içinde, teknik yarım çözünürlükte istedi. İkisi T-09'da birleşti.
- Grafik ışık haritalı hücreyi (MeshStandard) istedi; bunun derleme ve piksel maliyeti ancak sabit ışık takımıyla bütçede kalır. Bu yüzden 3H, Dalga 0'ın ışık takımı sözleşmesini ve 2B'nin uygulamasını kullanır.
- **(+)** Grafik dudağa anizotropi ekliyor (G-08), teknik görünmeyen anizotropiyi kaldırıyor (T-11). Çözüm: dudak tek istisna; perf-smoke program bütçesi içinde kalmak zorunda.
- **(+)** Sıcaklık için üç ayrı palet önerildi (tek rampa, FLIR demir yayı, CVD cividis). Çözüm: bölüm 2'deki istisna kuralı.
- **(+)** Gölgede kahraman gölgesi ile CSM arasında seçim yapılmamıştı. Çözüm: CSM (Faz 4).

---

## 5. Dalga planı

**Çalışma yöntemi (M5a'dakiyle aynı, eklemelerle):**
- Paketler ayrı worktree'lerde (`.claude/worktrees/`) `vitrin/*` dallarına commit eder; entegratör ana kopyada **yazılı birleşme sırasıyla** birleştirir (her dalga tablosunun altında).
- Her dalgadan sonra genel kontrol + `/code-review high`, ardından commit ve push.
- Her paket kapanışında: `npm run typecheck`, `npm test`, vitrin setiyle önce/sonra kayıt, `visual-metrics` (Dalga 0'dan sonra), `perf-smoke` (1A'dan sonra) ve `audio-golden` (1E'den sonra). Fark seçilmeyen karşılaştırma README'ye konmaz.
- L ve XL paketler, her biri tek iş akışı oturumuna sığan, kendi ara commit'i ve kabul ölçütü olan adımlara bölünür.
- İş akışı başlatmadan önce `get_usage` bakılır; 5 saatlik kullanım ≥ %80 ise yeni dalga başlatılmaz. Referans ölçüm: 12 ajanlık bir dalga ≈ 5 saatlik sınırın %27'si; 9 paketlik Dalga 1 için ≈ %20–25 beklenir.
- **Portlar:** `52WN` (W dalga, N paketin dalgadaki sırası; 1A → 5211, 2H → 5227, 3H → 5238), önizleme `42WN`. 5173/4173 ana kopyada, 518n/418n M5a'da kalır.

**Ortak sahiplik kuralları:**
- `src/app/App.ts`'e paketler dokunmaz. Gereken bağlama 1–3 satırlık "kanca isteği" olarak paket notuna yazılır, entegratör ekler.
- `styles.css` Dalga 0'da bileşen dosyalarına bölünür. Her paket yalnız kendi CSS dosyasını değiştirir.
- `src/sim/engineSim.ts`'in bir dalgada tek sahibi vardır: Dalga 1'de 1B, Dalga 2'de 2H, Dalga 3'te 3F, Dalga 4'te 4D.
- **(+)** `CameraRig.ts` Dalga 0'da bölünür: `camera/viewport.ts` (setViewOffset, safeRect) · `camera/shots.ts` (vitrin ve sinematik yollar) · `camera/shake.ts` · `camera/freecam.ts`. Her alt modülün bir dalgada tek sahibi vardır.
- **(+)** Pozlama `environment.js`'ten `src/core/exposure.ts`'e, ışık takımı `src/core/lightRig.ts` sözleşmesine Dalga 0'da taşınır. Böylece 2A (pozlama) ile 2B (ortam) aynı dosyaya dokunmaz.
- **(+)** `EngineEffects.js` olay merkezidir; sahibi olmayan paketler yeni efektlerini ayrı dosyada yazar (`src/effects/Debris.ts` gibi) ve bağlamayı kanca isteğiyle yaptırır.
- **(+)** Testler, kayıt sahneleri ve audio-golden sabit süre değil sim olayı bekler (T-20). Kalibrasyonu değiştiren paket (1B, 2H, 4D) kendi dalgasında **en son** birleşir ve CLAUDE.md'deki "Öğrenilenler" zamanlamalarını günceller.

### Dalga 0: sözleşmeler (entegratör, ~1 gün, tek ajan)

**Başlamadan önce yanıtlanacak kararlar:** K0, K1, K2, K3, K7 (bölüm 6).

- `styles.css` → `src/styles/{tokens,base,menu,cockpit,eicas,toasts,lesson,workshop,loader}.css`. Görüntü değişmez; piksel karşılaştırmasıyla doğrulanır.
- App.ts'ten `RenderPipeline`, `EnvironmentManager` ve `ModeController` iskeletlerini davranış değiştirmeden çıkar (T-17'nin ilk adımı).
- `CameraRig.ts` alt modüllere, pozlama `exposure.ts`'e bölünür; `lightRig.ts` sözleşmesi yazılır (sabit ışık sayısı, şiddet API'si, ortam başına ön ayar). Davranış değişmez.
- `sim.snapshot()/restore()` imzası (gövde 2H'de), `onSimEvent` olay sözleşmesi, `waitFor(event)` test yardımcıları (T-20); oynanış testi ve kayıt sahneleri olay beklemeye geçirilir.
- Yükleme sözleşmesi: 1A `loadProgress` olayını yayar, 1C bunu çizer; `index.html` loader iskeletinin sahibi 1C'dir.
- **Vitrin kadraj seti:** `scripts/capture/scenes/vitrin/` altında 12 sahne (galerideki 010, 314, 322, 326, 352, 353, 360, 401, 404, 405, 411, 511 kadrajları; ayrıca 1280×720 ve 2560×1440 sürümleri), her biri ROI maskeleriyle. Bundan sonraki bütün önce/sonra karşılaştırmaları bu seti kullanır.
- `scripts/perf-smoke.mjs` ve `scripts/visual-metrics.mjs` (T-19) iskeletleri; çizim çağrıları, program sayısı, uzun görevler ve NaN için WebGL sarmalayıcısı; bugünkü değerlerle referans JSON.

### Dalga 1: temeller, ucuz kazançlar ve ilk tekme (9 paket, paralel)

| Paket | Kapsam | Sahip dosyalar | Kabul ölçütleri | Emek |
|---|---|---|---|---|
| **1A Render hattı ve yükleme** | T-01, T-02, T-04, T-05, T-06, T-07, T-13, T-16 (HUD) | `src/core/postfx.js`, `src/core/environment.js`, `src/app/render/*` (Dalga 0 iskeleti), `src/main.ts`, `src/core/afProps.ts`, `src/core/cellProps.ts`, `scripts/perf-smoke.mjs` | Soğuk profilde canlı menü ≤ 5 s, ilk tam kare ≤ 6 s (bugün 16,7). Öğleye soğuk geçişte en uzun görev ≤ 200 ms, toplam ≤ 15 s (bugün 76–99 s). Kullanılmayan program oranı < %10. NaN 0 (bütün vitrin seti). Öğlede CPU kare süresi ≤ 6 ms (bugün 9,4). Bağlam kaybından sonra yansımalar geri gelir. Vitrin setinde NaN pikselleri dışındaki ROI SSIM ≥ 0,99 (görüntü değişmez). `loadProgress` olayı yayılır (test). Atlas saçakları bu paketin ölçütü değildir (2C) | M+ |
| **1B Fizik düzeltmeleri I** | F-05, F-06, F-07, F-10, F-19 + ders metinleri F-12 (yalnız metin), F-13, F-20; ders 2'ye "N1 dönüşünü doğrula" | `src/sim/{engineSim,cycle,gas,design}.ts`, `src/game/lessons/{l2-start,l3-brayton,l4-fadec,l7-birdstrike}.ts`, otomatik çalıştırma mantığı yeni `src/sim/autostart.ts`'e (bağlama entegratörde) | Geçici sim betiğiyle: surge'de T4 ≤ 2400 K, EGT sıçraması +100–300 °C. Kapatmadan 60 s sonra EGT > 150 °C. N2 %25'te N1 %5–8. TJ rölantisinde N1/N2 0,6–0,8. Otomatik çalıştırma ıslak/sıcak çalıştırmada keser. Şablonlarda tasarım noktası ±%1 içinde ve uyarısız (kalibrasyon testleri). Testler yeşil. Ders akışları 7/7. Olay tabanlı kayıt sahneleri ve oynanış testi değişmeden geçer. CLAUDE.md zamanlamaları güncellenir. **Dalgada en son birleşir** | L |
| **1C Kimlik çekirdeği** | K-01, K-02, K-03, K-08, K-09 (CSS düzeyi), yükleme ekranı görseli, favicon | `src/styles/{tokens,base,loader}.css`, `index.html`, `src/ui/palette.ts` (yeni), `src/assets/fonts/`, `docs/ART.md` | **Kapı:** üç logo adayı kullanıcıya sunulur, kullanıcı seçer. `document.fonts.check` üç aile için true; Türkçe glif satırı (ĞÜŞİÖÇ ğüşıöç) kareyle doğrulanır, ekranda yedek font yok. `build:single` dosyayı en çok +200 KB büyütür. Logo 16 px'te kullanıcı tarafından tanınır. Yükleme ekranı `loadProgress`'i çizer. Tuval çizimleri renkleri `palette.ts`'ten okur (grep testi: tuval dosyalarında sabit renk kodu yok). Menü/hücre/atölye önce/sonra kareleri | M |
| **1D Menü ve geri bildirim düzeltmeleri** | A-01, A-02 (düzeltme), A-03'ün temeli (önem düzeyine göre süre, simülasyon saati, `role=alert`, güvenli dikdörtgen dışı konum), A-14, **A-21 duraklatma**, S-19'un arayüz kısmı | `src/ui/{Menus,Toasts,LessonPanel}.ts`, `src/styles/{menu,toasts}.css`, `src/ui/keys.ts` (yeni tuş tablosu); duraklatma için kanca isteği | Bilgi bankasında "null" 0. Sonuç yıldızları ≥ 42 px. Ders sonunda bildirim kalmaz. Kısayol listesi tuş tablosundan üretilir (test). 4× otomatik çalıştırmada motorun güvenli dikdörtgeninde bildirim yok (`camera/viewport.ts` safeRect ile ölçülür). UYARI'lar yeni kart çıkana kadar kalır. Boşluk ile duraklatınca sim zamanı ilerlemez ve ses kısılır (test); nokta tuşu tek adım ilerletir | S–M |
| **1E Ses temeli** | S-01, S-02, S-03, S-04, S-13, S-19 (API), S-20, S-21 | `src/audio/**` (EngineAudio modüllere bölünür), `scripts/audio-golden.mjs` | audio-golden: rölanti −28 ± 2, tam güç −18 ± 2 LUFS. Tepe < −1 dBTP. Tek ton belirginliği < 25 dB. 14 kHz üstünde ton yok. Sekme gizlenince 300 ms içinde sessizlik. HPC BPF tasarımın kanat sayısını izler (test). Spektrogram önce/sonra README'ye. Kullanıcı kulak onayı (WAV + spektrogram; ses ajanlarca dinlenemediği için zorunlu) | M |
| **1F Malzeme ve siluet düzeltmeleri** | G-06, G-08, G-12 (gri tarama), G-14, speküler AA | `src/materials/{library.js,engine.ts}`, `src/engine/{nacelle.js,core.js}` (chevron), `src/core/testCell.ts` (yalnız `side`). `fan.js`'e dokunmaz (1I'nın) | 010/401/405'te dudak ROI'sinde L ≥ 0,98 piksel oranı bugünkünün ≤ %50'si. Fan ROI'sinde speküler tepe pikselleri ≤ %2 (yüksek BPR kompozit) ya da saten Ti. 400 yakınlaştırmasında augmenter ROI'sinde arka duvar derzleri görünmez. Chevron siluetinde çift diş yok (010, x≈720). 326'da kesit kapağı ROI doygunluğu ≤ 0,1 (nötr gri) ve kızıllık ROI'sinden ayrışır. Program sayısı artmaz (perf-smoke) | S–M |
| **1G M5a kapanışı (P11) + atölye küçük açıkları** | P11'in tamamı: oynanış testi §8 atölye bölümü (`lpc.tipSpeed` 560 aralık dışı, başka sonda seçilecek), `smoke-families`, `bench-rebuild --family`, README/ROADMAP/ATOLYE/CLAUDE.md (kod haritası), önce/sonra, `build:single`. Ayrıca A-08 (4 sütun, birimler, koçluk z-index), A-09 (aşama başına diziler), A-11 (kaydırma işareti), A-12, F-21, ölçek figürü safeRect, `advance()` panel güncellemesi (kanca isteği) | `scripts/{playtest,smoke-families,bench-rebuild}.mjs`, belgeler, `src/app/workshop/{StartScreen,Coachmarks,ResultsPanel,ScaleFigure}.ts`, `src/design/architecture.ts` (yalnız örnek listeleri), `src/styles/workshop.css`, `src/app/camera/viewport.ts` (safeRect) | Oynanış testi atölyede sıfırdan bir motor tasarlayıp hücrede çalıştırır, hatasız. 7 aile × 3 yanma odası smoke'u `pageerror` 0. 1280×720'de 7. kart tam görünür ve ipucu örtmez. Küçük turboşaftta ölçek figürü kadraja sığar. Kart etiketleri ±%30 testinden geçer. ROADMAP'te M5a ✅. `turbofan.html` üretilir | M |
| **1H Hızlı test ve kabul testi** | O-01 (+ test raporu kartı) | `src/workshop/testing.ts`, `src/app/workshop/cellCompare.ts`, yeni `src/app/workshop/TestReport.ts` | Atölyeden ölçülen ilk değere ≤ 5 s (bugün ~45–50 s). Kabul testi protokolü gerçek zamanda ≤ 20 s'de biter; ölçülen ile tasarım arasındaki fark ve geçti/kaldı gösterilir. Oynanış testine adım eklenir | S–M |
| **1I Tam güç tekmesi (+)** | G-10 (kapsama oranlı analitik disk + kanat soldurma; fan ve pervane), O-10 (trauma sarsıntısı, ayar kaydırıcısı), eğitim için "stroboskop" anahtarı | `src/engine/{fan.js,turboprop.js}`, `src/engine/visual.ts` (yalnız dönme bölümü), `src/app/camera/shake.ts` | %100 N1'de fan diski ROI'sinde kanat frekansındaki açısal güç rölantiye göre ≥ %70 düşük (322); pervane için aynı ölçüt (411). Stroboskop açıkken kanatlar donar. Sarsıntı genliği itkiyle monotondur ve ayardan sıfırlanabilir. Kare süresi en çok +0,3 ms. Önce/sonra GIF (rölanti → tam güç) | M |

**Birleşme sırası:** 1A → 1F → 1C → 1D → 1I → 1E → 1H → 1G → 1B.

### Dalga 2: büyük görsel zincir, arayüz kabuğu, ses II, harita (7 paket)

**Başlamadan önce:** K4 ve K8 yanıtlanır.

| Paket | Kapsam | Sahip dosyalar | Kabul ölçütleri | Emek |
|---|---|---|---|---|
| **2A HDR ve post** | G-01, G-02, G-03, G-19, T-09 | `src/core/postfx.js`, `src/core/post/*` (yeni), `src/core/exposure.ts` | 352/353/360'ta alev ve kızıllık maskesinin 20 px dışındaki halkada ortalama parlaklık ≥ +%15. Beyaz kaporta ROI'sinde kırpılmış piksel (≥ 0,99) oranı ≤ %1. 353'te merdiven ve korkuluk maskesinde pus açık/kapalı arasında SSIM ≥ 0,98. Gün batımı karesinde anahtar ışık yönünde gölge boyu ≥ 3 × nesne yüksekliği ve ortalama ton sıcak (öğleye göre ≥ +15°). Öğle ve yağmurda histogram ortası bugünküne göre yukarı. GTAO maliyeti ≤ 1 ms CPU. Toplam kare süresi en çok +1,5 ms. Derinlik dokusu diğer paketlere açılır (K-10, G-16) | L |
| **2B Gölge, sahne ve ışık takımı** | T-03 (lightRig uygulaması), T-08 (CSM), T-10, T-11, T-12, T-17 (devam) | `src/core/environment.js`, `src/core/lightRig.ts`, `src/core/airfield.ts`, `blender/airfield.py`, `src/app/render/quality.ts` | Öğle ≤ 400 çizim, ≤ 150 program. Her ortama geçiş (ilk dahil, ön-ısıtmadan sonra) ≤ 0,5 s. Stand gölgesinde g01 → g02 benzeri keskinlik (kenar genişliği ölçümü). 60 FPS sınırı ve pil kipi çalışır. "Saat" kaydırıcısı öğleden geceye derlemesiz geçer (program sayısı sabit). Tümleşik GPU'da 1080p "orta" ≥ 30 FPS (kullanıcı GPU tercihini değiştirdikten sonra ölçülür) | L |
| **2C Hücre varlık hattı (Blender) (✎)** | G-07, K-04 geometrisi (beton, akustik panel, kontrol odası camı, katı augmenter tüpü), G-06 iç yüz (kurum, detuner sacı), lightMap ve albedonun ayrı pişirilmesi, T-15 meshopt | `blender/testcell.py`, `src/assets/testcell*` (çalışma anı kodu 3H'nin) | Atlas yakınlaştırmasında ince geometri kenarlarında kroma saçağı yok (ROI kroma ölçümü). AUGMENTER yazısı her kamera mesafesinde keskin (MSDF ya da geometri). Işık haritası ve albedo ayrı dokular. glb boyutu ≤ bugünkü. Blender pişirme süresi kaydedilir. Geçici yükleyiciyle hücre bugünkü MeshBasic yoluyla görsel olarak aynı ya da daha iyi | M–L |
| **2E Arayüz kabuğu ve EICAS** | A-03 (master caution, olay günlüğü, ilerleme hapı), A-04, A-05, A-06, A-13, A-15, A-19, F-14, K-09 (panel geçişleri) | `src/ui/{Eicas,Cockpit,SandboxPanel,FlightControls,dom}.ts`, yeni `src/ui/{EventLog,MasterCaution,fmt}.ts`, `src/styles/{cockpit,eicas}.css`, `src/app/camera/viewport.ts` | 1280×720'de motor alanı ekranın ≥ %55'i (bugün ~%32). 2560×1440 referans karesinde etiketler ≥ 12 px ve ölü alan yok. Surge'de master warning yanar ve onaylanana kadar kalır. CAS İngilizce, üzerine gelince Türkçe. Sayı biçimi tek modülden (test). CVD emülasyon kareleri. Reduced-motion desteği. Korumalı yakıt anahtarı ve gaz kolu kertikleri | L |
| **2F Menü vitrini, soğuk açılış ve senaryolar** | K-05, A-07, V1 (etkileşimli soğuk açılış), O-15'in menü kısmı (kahraman motor = son tasarım), **O-26 vitrin senaryoları** | `src/ui/Menus.ts` (1D'den sonra), yeni `src/app/{Intro,Showcase}.ts`, yeni `src/game/scenarios/**` (bildirimsel senaryo verisi), `src/styles/menu.css`, `src/app/camera/shots.ts` | V1 ölçütleri (§3.2). Menü kadrajı kompozisyon kurallarına uyar: giriş merkezi (0,66W; 0,45H) ± 5 %, üstte ≥ %8 boşluk; 4 çekim, her ortamda kare. Atölye birincil kart. "Devam et" son etkinliği açar. En az 6 vitrin senaryosu tek tıkla ≤ 3 s'de (ön-ısıtılmış ortamda) kurulur; senaryo verisinde eval yok. Kullanıcı önce/sonra GIF'iyle onaylar | M–L |
| **2G Ses II: uzamsal, ortam, olaylar** | S-05 ~ S-12, S-14, S-15, S-16 | `src/audio/**` | audio-golden: AB − MIL ≥ +6 LU (arkada). Surge enerjisinin 150 Hz altındaki payı ≤ %50. 8,5 → 17 m'de fark ≈ 6 dB. Hücre ile apron arasında RT60 farkı ölçülür. Kamera döndükçe fan tonu girişte kalır. N motorlu yayıcı mimarisi (iki motorlu sahne testi). Anahtar, kertik ve CAS sesleri. Light-off sesi motorlamaya göre ≥ +8 LU (V0). Kullanıcı kulak onayı | L |
| **2H Fizik II: harita, derecelendirme, snapshot** | F-01, F-02, F-03, F-08, F-09, F-11, F-22, A-18, **`sim.snapshot()/restore()` gövdesi** | `src/sim/{maps,cycle,engineSim}.ts`, `src/design/operability.ts`, `src/design/knobs.ts` (VSV/bleed), yeni `src/ui/{CompressorMap,CycleDiagram}.ts`, `src/game/lessons/{l5-surge,l6-altitude}.ts` | SM tasarımda %20–25; rölantide bleed kapalıyken %0–5, açıkken %15–20. Ders 5 adım 1'de harita görünür, surge'de nokta hattı aşar. VSV düğmesi SM'yi değiştirir (test). ISA+15'te EGT sınırlayıcı devrede değil ve köşede EGT payı 50–80 K. T–s'de 9 noktası P0 izobarının üstünde, AB'de istasyon 7 var. Rölanti EGT'si ~400 °C. Şablonlar uyarısız. Fuzz 7/7. snapshot → 10 s ilerlet → restore → 10 s ilerlet bit düzeyinde aynı durumu verir (test). **Dalgada en son birleşir** | L–XL |

**Birleşme sırası:** 2A → 2B → 2C → 2E → 2F → 2G → 2H. **Dalga sonrası kapı:** O-29 insan ilk oturum testi (birinci tur).

### Dalga 3: oynanış döngüsü, paylaşım ve kahraman efektleri (8 paket)

| Paket | Kapsam | Sahip dosyalar | Kabul ölçütleri | Emek |
|---|---|---|---|---|
| **3A Fotoğraf, klip, teknik çizim kipi** | O-12, O-13, O-23, **K-10** | yeni `src/app/photo/**`, yeni `src/core/post/blueprint.ts`, `src/app/camera/freecam.ts` | P tuşu simülasyonu birebir dondurur (snapshot karşılaştırması). DOF tıklanan noktaya odaklanır. 4× PNG ≤ 3 s'de üretilir. Son 15 s klibi indirilebilir. Belirlenimli yeniden çizimle 60 fps ağır çekim klip. Teknik çizim kipi V11 ölçütleri. README'ye 3 poster karesi | M–L |
| **3B Paylaşım, meydan okuma, telefon görüntüleyicisi** | O-14, **O-27**, **A-22**, T-15 (web sürümü), poster/QR | yeni `src/workshop/{share,challenge}.ts`, `src/workshop/store.ts` (göç), yeni `src/app/workshop/Sheet.ts`, yeni `src/app/viewer/**` (telefon kipi), dağıtım betiği | Motor kodu ≤ 600 karakter. `#m=` bağlantısı hem `turbofan.html`'de hem web'de motoru atölyede açar. Telefonda (dar ekran + dokunma) motor kartı + 3B görüntüleyici açılır; dokunmatik yörünge ve kıstırma çalışır. Meydan okuma bağlantısı hayalet meridyen ve kıyas kartı üretir. v1 → v2 göç testleri. Föy A4 SVG/PNG. Web sürümü kullanıcı onayıyla yayımlanır (K6) | M–L |
| **3C Kariyer, siparişler, ödül** | O-02, O-03 (rütbeler; dönem kilitleri 4D'de), O-04, O-06, A-02 (tam ödül ekranı), O-05 (yapı), O-15 (Hangar), A-16 | `src/game/{progress,LessonRunner}.ts` → `career.ts`, `src/workshop/goals.ts` → `contracts.ts`, `src/app/workshop/{GoalCard,EnvelopeBox}.ts`, yeni `src/ui/{Hangar,Results}.ts`, `src/game/lessons/index.ts`, `src/ui/LessonPanel.ts` | 15+ sözleşme, her birinde 3 madalya eşiği. Kabul testi sözleşmeyi doğrular. 30+ başarım `onSimEvent`'ten tetiklenir (test). Ders sonuç ekranında telemetri grafiği, metrik çubukları ve "önerilen sonraki" kartı (ders ya da vitrin senaryosu). `career:v1` kaydı. Oynanış testinde bir sözleşme altın alınır | L |
| **3D Olay anları** | O-09, O-10 (olay darbeleri), O-11 (görsel), G-10 (ekran uzayı dönme bulanıklığı, isteğe bağlı), **A-23**, V2'nin sarsıntı/ses birleşimi | yeni `src/app/Replay.ts`, `src/app/camera/shake.ts`, yeni `src/effects/{Debris,Feathers}.ts` (bağlama kanca isteğiyle), `src/engine/visual.ts` (yalnız hasar bükümü), yeni `src/input/gamepad.ts` | 10 s halka tampon ve anlık tekrar. Surge, kuş çarpması ve light-off'ta PiP olay kamerası ≤ 0,5 s'de açılır (2H snapshot'ıyla; `engineSim`'e dokunmaz). Kuş çarpmasında fan ROI'sinde görünür hasar. Gamepad tetiği gaz kolunu sürer, olaylarda titreşim; ayardan kapatılır. Kare süresi en çok +1 ms | L |
| **3E Atölye hissi** | S-17, A-09 (ankrajlı spot), A-11, A-20, O-16 (hücre içi sürüm), O-19, O-20, kademe ekleme animasyonları | `src/app/workshop/{Coachmarks,ResultsPanel,ArchitectureCards,Handles(yalnız geri bildirim)}.ts`, yeni `src/audio/preview.ts`, yeni `src/app/workshop/{WorldChart,FirstFire}.ts`, `src/data/engines.json` (kaynaklı) | V7 ve V8 ölçütleri (§3.2). Koçluk balonu hedef modülü vurgular (ankraj testi). Sonuç panelinde durum çipi. Gerçek motor saçılım grafiği (50+ motor, her satırda kaynak). GIF önce/sonra | L |
| **3F Test hücresi oyunu** | O-08, F-16, O-21, A-17 | yeni `src/game/testcards/**`, yeni `src/sim/faults.ts` + `engineSim` kancaları (Dalga 3'te engineSim'in sahibi), `src/ui/SandboxPanel.ts`, yeni `src/ui/Notebook.ts` | 5 test kartı (33.73 ivmelenme vb.) ölçülür ve madalya verir. Arıza avında 8+ arıza, teşhis ve puan. Deney defteri 3 tarama yapar ve CSV verir. Oynanış testinde bir arıza avı tamamlanır. **Dalgada en son birleşir** | L |
| **3G Art yakıcı, gece, atmosfer (✎ eski 4A)** | G-04, G-11, G-16, **G-20**, V3 (görsel kısmı) | `src/effects/{AfterburnerFlame,EngineEffects,Particles}.js`, yeni `src/effects/InletVortex.ts`, `src/core/environment.js` (gece ön ayarı), `src/core/airfield.ts` (projektörler) | 352/353/601'de V3 görsel ölçütleri (ton 20–45°, elmas/ara ≥ 2, lüle yakınında mavi). Gece karesinde piksellerin ≥ %60'ı L < 0,1; gökyüzünde yıldız, ay ve ufuk parıltısı. Nem ≥ 0,8'de giriş girdabı görünür, kuruda görünmez (iki kare). Parçacıkların zemin kesişimi yumuşak. Kare süresi ≤ +1,5 ms (yarım çözünürlük). Program sayısı bütçe içinde | L |
| **3H Hücre ışığı entegrasyonu (+)** | G-05 (çalışma anı: MeshStandard + lightMap, epoksi zemin, düzlemsel yansıtıcı, kutu projeksiyonlu küp harita), K-04 (dönen amber lambalar, hacimsel tavan konileri), abLight'ın odaya düşmesi | `src/core/{testCell,cellProps}.ts` | AB açık/kapalı arasında duvar ROI parlaklığı ≥ +%40, zemin ROI'sinde alevin yansıması görülür (352/353). Pişmiş ışık ve dinamik ışık toplanır (light-off ve surge parlaması da odaya düşer). Hücre derlemesi ≤ +%20. V1 ışık sekansı yeni hücreyle yeniden ayarlanır | M–L |

**Birleşme sırası:** 3H → 3G → 3A → 3D → 3E → 3C → 3B → 3F.

### Dalga Y: yayın (Dalga 3'ten sonra, ~1 hafta, 3–4 paket)

| Paket | Kapsam | Kabul ölçütleri | Emek |
|---|---|---|---|
| **Y1 Fragman ve vitrin** | Y-01, Y-05 | 60–90 s, 60 fps, ses dahil, kare düşmesiz (belirlenimli kayıt). Kullanıcı onayı. README'de hero GIF | M |
| **Y2 Dil** | Y-03 | Arayüz, dersler ve bilgi bankası İngilizce; eksik dize testi 0; Türkçe varsayılan | M |
| **Y3 Telefon ve dağıtım** | Y-04, Y-02 | Bir Android telefonda paylaşım bağlantısı uçtan uca çalışır. Açılış sayfası ve basın kiti hazır. **Yayın kamuya açık bir adımdır; her yayın kullanıcıdan ayrıca onay alır (K6)** | S–M |
| **Kapı** | O-29 ikinci tur | Ortalama ≥ 8/10; 5 kişiden 4'ü ilk 2 dakikada kendiliğinden tepki verir; bırakma noktaları düzeltilir | S |

### Dalga 4: imza görseller ve derin içerik (M5b / M5c ile birleşir)

| Paket | Kapsam | Sahip dosyalar | Kabul ölçütleri | Emek |
|---|---|---|---|---|
| **4B Termal alan, akış, müze kesiti** | G-09, G-12 (ısı katmanı), G-13, K-06 (= M5b patlatılmış görünüm + istasyon renkleri), O-07, S-18, V4, V9 | `src/engine/visual.ts`, `src/materials/engine.ts`, yeni `src/effects/FlowView.ts`, yeni `src/engine/explode.ts`, `src/game/lessons/l1-anatomy.ts`, `src/app/camera/shots.ts` (V4 yolu) | V4 ve V9 ölçütleri (§3.2). FLIR kipi. Patlatılmış görünüm ≤ 0,8 s. Ders 1 açılışı kamera uçuşuyla. Akustik röntgen. Soğuk açılışın kamera yolu "havanın yolculuğu"na geçer | XL |
| **4C Tasarım tezgâhı ve tutamaçlar (= M5b)** | K-07, A-10, O-17, O-16 (vinç sürümü) | `src/app/workshop/{Handles,overlay3d,Ghost,KnobField}.ts`, `src/design/handles.ts`, yeni `src/app/workshop/Bench.ts` | Ayrı blueprint sahnesi. 8+ tutamaç. Yan görünüm çizim masası. Satır içi düğme paneli. Kaplama sekmesi. Vinçle tezgâhtan sehpaya geçiş ≤ 4 s. M5b kabul ölçütleri | XL |
| **4D Fizik III (= M5c'nin bir kısmı)** | F-04, F-12 (Sankey), F-15, F-17, F-18, F-23, O-05 (yeni dersler: relight, art yakıcı, turboprop), O-03 dönem kilitleri | `src/sim/**`, yeni dersler, `src/game/career.ts` (yalnız dönemler) | M0,8 / 10,7 km'de rüzgârlanma N1 %20–35 ve relight zarfı. Pervane tüye alınır. Tork sınırı. AB'de A8 gecikmesi ve fan stall. 3 yeni ders oynanış testinde. Dönem kilitleri kariyerde çalışır, Serbest kipte açık | XL |
| **4E Malzeme gerçekliği ve hava** | G-15, G-17, G-18, T-14 | `src/materials/weathering.ts`, `blender/trim_sheet.py`, `src/engine/stand.js`, `src/core/rain.ts`, varlık hattı | Stand, kaporta ve tapa önce/sonra: ROI pürüzlülük varyansı ve ton varyansı bugünküne göre ≥ 2 kat (düzgün ızgara yok). Yağmurda sıçrama ve ıslak motor. Birikintide motor yansır. VRAM ÷4 (ölçülür) | L |
| **4F Köprüler ve deneyler** | **O-28 uçan test yatağı**, O-11 (boroskop), O-25 (kanat kopması), O-22, O-24 (en son, kesilebilir), T-18 | yeni modüller (`src/app/borescope/`, `src/flighttest/`, `src/xr/`) | V12 ve V6 (boroskop) ölçütleri. Kanat kopması testi ağır çekimde muhafaza sonucunu gösterir. Part-66 etiketleri. WebGPU deneme raporu (karar belgesi) | XL |

**Sıra mantığı:** Dalga 0 sözleşmeleri ve ölçüm araçlarını kurar. Dalga 1 bütün ölçümlerin ve kayıtların hızını artırır (derleme düzeltmesi kayıt süresini de kısaltır), en ucuz görünür kazançları ve ilk "tekmeyi" verir. Dalga 2 vay anlarının teknik zeminini (HDR, ışık, ses, harita) ve ilk izlenimi (soğuk açılış, vitrin) kurar. Dalga 3 oyunu, paylaşımı ve kahraman efektini (art yakıcı) getirir. Dalga Y oyunu dünyaya gösterir. Dalga 4 M5b/M5c ile birlikte yürür ve Faz 4'e köprü kurar.

**Kritik yol (dalga başına en uzun paket):** 1B (L) · 2H (L–XL) · 3C/3D/3F/3G (L) · Y1/Y2 (M) · 4B/4C/4D (XL).

**Bütçe kesilirse en küçük "paylaşılabilir sürüm":** Dalga 0 + Dalga 1 + 2A + 2F + 3A + 3G + 3H + Y1. Bu kesim yükleme, kimlik, tekme, HDR, soğuk açılış, vitrin senaryoları, gece art yakıcısı, fotoğraf/teknik çizim kipi ve fragmanı içerir.

---

## 6. Kullanıcıya sorulacak kararlar

**Zamanlama:** K0, K1, K2, K3 ve K7 Dalga 0 başlamadan; K4 ve K8 Dalga 2 başlamadan; K5 Dalga 3 başlamadan; K6 ve K9 Dalga Y başlamadan yanıtlanır.

| # | Karar | Seçenekler | Önerilen varsayılan |
|---|---|---|---|
| K0 | **M5a'dan bekleyen iki karar** | (1) Karışık TF'de lüle ağzı tutamacı: kilitli kalsın (M5b `nozzleAreaFactor`) / açılsın · (2) Kuru TJ kütle ölçütü: "aynı çekirdekte" (−317 kg, model doğru) / başka bir ölçüt | (1) kilitli · (2) "aynı çekirdekte". 1G bunlarla kapanır. Ayrıca raporlanacaklar: kuru TJ yalnız ~131 kg hafif (AB kalemi 237 kg); TP'de "+2 kademe" ters eşleme sapması. |
| K1 | **Sıralama:** vitrin dalgaları M5b'den önce mi? | (a) Dalga 0–1–2–3, ardından Y (yayın), sonra Dalga 4 = M5b (4B patlatılmış görünüm ve istasyon renkleri + 4C tutamaçlar ve tezgâh) ve M5c'nin bir kısmı (4D) · (b) önce M5b/M5c bitsin, cila sonra · (c) her dalgada yarı yarıya | **(a).** Derleme ve ölçüm düzeltmeleri sonraki her işi hızlandırır; M5a P11 1G'de kapanır. Yayını M5b'den önce yapmak oyunu bugünkü atölyeyle tanıtır, M5b ikinci bir duyuru fırsatı olur. |
| K2 | **Görsel kimlik yönü** | (a) "Teknik çizim + müze kesiti" imzası + fotogerçekçi sahne · (b) saf fotogerçekçilik, DCS ile doğrudan yarış · (c) stilize/düz gölgeli | **(a).** Ayırt edici ve paylaşılabilir; bütçe gerçekçi. Canlı teknik çizim kipi (K-10) bu kararın vitrini olur. |
| K3 | **Kesit kapağı rengi** | (a) açık gri tarama + isteğe bağlı ısı katmanı · (b) bugünkü kırmızı · (c) müze sarısı `#E3C14B` | **(a)** |
| K4 | **CAS dili ve yerelleştirme** | (a) gerçek İngilizce CAS + Türkçe açıklama; arayüz Türkçe, dize tablosu 2E'de · (b) her şey Türkçe · (c) dil seçilebilir (tr/en) | **(a)**; İngilizce arayüz **Dalga Y'de** (yayından önce şart) |
| K5 | **İlerleme ve kilitler** | (a) isteğe bağlı kariyer, "Serbest" kipte her şey açık · (b) zorunlu ilerleme (dönemler kilitli) · (c) kariyer yok, yalnız başarım ve madalya | **(a)**; dönem kilitleri 4D'de gelir |
| K6 | **Dağıtım** | (a) GitHub Pages web sürümü + tek dosya devam (paylaşım bağlantıları web'e gider) · (b) yalnız tek dosya · (c) itch.io (HTML5) · (d) a + c | **(d).** Yayımlama kamuya açık bir adım olduğu için her yayın ayrıca onaylanır. |
| K7 (+) | **Marka adı ve işaret** | (a) "AKADEMİ" şemsiyesi, altında "Turbofan", Faz 4'te "Uçak" · (b) "Turbofan Akademi" tek ad, Faz 4'te yeniden düşünülür · (c) yeni bir ad | **(a).** 1C üç logo adayı sunar, kullanıcı seçer. |
| K8 (+) | **Telefon kapsamı** | (a) masaüstü öncelikli; telefonda motor kartı + 3B görüntüleyici + dokunmatik yörünge, tam atölye masaüstünde · (b) tam mobil oyun · (c) telefonda yalnız "masaüstünde aç" mesajı | **(a).** Paylaşım bağlantılarının çoğu telefonda açılacak; (c) ilk izlenimi öldürür, (b) bütçeyi aşar. |
| K9 (+) | **İnsan oyun testi** | (a) kullanıcı + 4 tanıdık, Dalga 2 sonrası ve Y öncesi · (b) yalnız kullanıcı · (c) yok | **(a).** "Millet 'çok iyi' desin" hedefinin tek doğrudan ölçüsü budur. |

---

## 7. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| **Shader derleme bütçesi yeniden şişer.** HDR, MeshStandard'lı hücre, yeni malzemeler, teknik çizim kipi ve TRAA, ANGLE D3D11'de derleme süresini 1A öncesine geri götürebilir. | İlk izlenim yeniden bozulur | `perf-smoke` her paketin kabulünde zorunlu (≤ 150 program, en uzun görev ≤ 200 ms). Sabit ışık takımı sözleşmesi. Yama sabitleri uniform'da. Anizotropi tek malzemede. |
| **Kalibrasyon kayması.** 1B, 2H ve 4D şablonların sim davranışını değiştirir: surge kolaylaşır, rölanti EGT'si yükselir, ders 5'in "yakıt ×11" adımı gereksizleşir, ders zamanlamaları kayar (CLAUDE.md'deki light-off ~25 s gibi). | Testler, ders akışları, kayıt sahneleri ve senaryolar bozulur | Olay tabanlı bekleme (T-20). Kalibrasyonu değiştiren paket dalgada en son birleşir. Kalibrasyon testleri ve snapshot'lar, ders akışı testi 7/7, CLAUDE.md "Öğrenilenler" güncellenir. Model çelişirse kullanıcıya sorulur (CLAUDE.md kuralı). |
| **Birleştirme çakışmaları** (App.ts, styles.css, engineSim.ts, CameraRig, environment.js, EngineEffects) | Entegrasyon gecikir | Dalga 0 bölmeleri (CSS, CameraRig alt modülleri, exposure, lightRig). Kanca istekleri yalnız entegratörden. Dalga başına tek engineSim sahibi. Yazılı birleşme sırası. |
| **Vay gecikmesi.** Altyapı ağırlıklı dalgalar kullanıcının motivasyonunu ve "görmeden inanmam" çıtasını zorlar. | Plan yarıda bırakılır | Vay takvimi (§3.3): her dalga en az iki görünür an teslim eder; her dalga sonunda önce/sonra GIF seti. |
| **Ölçüme uyan ama insanı etkilemeyen sonuç.** ROI metrikleri geçer, kare yine sıradan görünür. | "Çok iyi" denmez | Küçük resim testi ve O-29 insan testi kapıları; kullanıcı onayı her görsel paketin son adımı. |
| **Kullanım sınırı.** 7–9 paketlik dalga ≈ 5 saatlik sınırın %20–30'u; Dalga 2, 3 ve 4 L–XL. | Dalgalar yarıda kalır | Her dalga öncesi `get_usage`, ≥ %80'de durulur. L/XL paketler oturuma sığan ara commit'lere bölünür. `resumeFromRunId`; değilse mevcut worktree'lerde devam. |
| **Ses dinlenemiyor.** Ajanlar sesi yalnız ölçümle değerlendirebilir. | Ölçüme uyan ama kulağa kötü gelen ses | Her ses paketinde kullanıcı kulak onayı (WAV + spektrogram). audio-golden eşikleri. |
| **Donanım çeşitliliği.** Her şey RTX 4070'te ölçüldü. | Zayıf GPU'da, iGPU'da ve telefonda kare kaybı ya da çökme | 2B'de otomatik kalite kademesi ve tümleşik GPU ölçümü; Y3'te gerçek telefon testi; swiftshader duman testi; pil kipi. |
| **Telefonda ilk izlenim.** Paylaşım bağlantılarının çoğu telefonda açılır; bugün dokunma desteği yok. | Yayılma kanalı en zayıf noktasında kırılır | K8 (a), A-22, Y-04; telefonda tam oyun yerine güçlü bir görüntüleyici. |
| **Blender pişirme hattı.** 2C Cycles pişirmesi uzun sürer ve makinede Blender 4.5 gerektirir. | 2C gecikir, hücre entegrasyonu (3H) kayar | 2C yalnız varlık işi; pişirme süresi kaydedilir, düşük örnekli ön izleme pişirmesiyle başlanır. 3H bir dalga sonra gelir. |
| **Faz 4'te yeniden iş.** Motor ölçekli kararlar (kahraman gölgesi, tek motorlu ses, yalnız motor paylaşım şeması) uçak sahnesinde çöker. | Faz 4 başında tekrar yazım | CSM, N yayıcılı ses, `kind` alanlı paylaşım şeması şimdiden; O-28 köprüsü. |
| **Tek dosya boyutu** (fontlar, LUT'lar, yeni dokular, IR) | E-postayla ve WhatsApp'la dağıtım zorlaşır | Hedef ≤ 30 MiB. IR ve gürültü prosedürel. KTX2 ve meshopt. İsteğe bağlı "hücre-lite". Web sürümü asıl paylaşım yolu. |
| **Kapsam şişmesi** (~135 madde) | "Mükemmel" hiç bitmez | Her dalga kendi başına yayımlanabilir. Vay anları (bölüm 3) öncelik listesidir. En küçük paylaşılabilir sürüm tanımlı (§5). O-24 AR ve T-18 kesilebilir. XL işler M5b/M5c takvimine bağlıdır. |
| **Görsel doğrulama maliyeti** | Kayıtlar uzun sürer; README'ye fark seçilmeyen kareler girer | 1A derleme süresini kısaltır. Vitrin kadraj seti sabit. Fark seçilmeyen karşılaştırma README'ye konmaz (kullanıcı kuralı). |
| **Tarayıcı API'si uyumu** (MediaRecorder MP4, WebXR, CompressionStream, AudioWorklet, Gamepad titreşimi) | Bazı özellikler bazı tarayıcılarda yok | Özellik algılama ve WebM/PNG yedekleri. AR yalnız Android Chrome olarak etiketlenir. Titreşim isteğe bağlı. |
| **Erişilebilirlik ve güvenlik** (sarsıntı, flaşlar, master warning yanıp sönmesi, light-off kesit flaşı) | Rahatsızlık, ışığa duyarlı epilepsi | Ayarlarda kapatma; `prefers-reduced-motion`; yanıp sönme ≤ 3 Hz; soğuk açılışta flaş reduced-motion'da kapalı. |
| **"Gerçek fizik" iddiası beklenti yaratır.** Doğrulama sayfası, gerçek motor kıyası ve uçan test yatağı yanlışları görünür kılar. | Uzman eleştirisi | Önce 1B ve 2H, sonra O-20 ve O-28. Sapmalar "model sınırları" bölümünde açıkça yazılır. Gerçek motor verisinde her satıra kaynak. |
| **Yayın ve kamuya açıklık** | İstenmeyen yayın, geri alınması zor | Her yayın (web, itch.io, fragman) kullanıcının ayrı onayıyla. Basın kitinde yalnız özgün içerik. |
| **Lisans ve telif** | Varlıklar ya da fontlar sorun çıkarır | Fontlar OFL, HDRI CC0 (Poly Haven), sesler prosedürel; referans görsel ya da ses kopyalanmaz. Logo özgün tasarım. Gerçek motor adları yalnız sınıf etiketi olarak; üretici logosu kullanılmaz. |
