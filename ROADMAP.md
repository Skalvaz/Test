# Yol haritası: Turbofan Akademi → uçak tasarım oyunu

Bu belge üç soruya cevap verir: **3B modeller Blender'da mı üretilmeli**, **hangi
teknolojide kalmalı**, ve **"Sprocket'in uçak versiyonu"na nasıl gidilir**.

## 1. Blender mı, prosedürel mi? — İkisi, farklı işler için

Hedef, oyuncunun kendi motorunu ve uçağını tasarlaması. Bu, motor geometrisinin
**parametrelerden çalışma anında üretilmesini** zorunlu kılıyor: oyuncu fan
çapını büyüttüğünde, kompresöre kademe eklediğinde ya da baypas oranını
değiştirdiğinde model anında yeniden oluşmalı. Blender'da elle modellenmiş bir
motor tek bir sabit tasarımdır; oyuncu onu değiştiremez.

| İş | Araç | Neden |
| --- | --- | --- |
| Motor ve uçak gövdesi (oyuncunun tasarladığı her şey) | **Kod — prosedürel** | Parametre değişince yeniden üretilmeli. Şu anki kanat profili (NACA) ve lathe üreticileri bunun temeli. |
| Sabit sahne varlıkları: test hücresi/hangar, iş platformları, aletler, kokpit | **Blender → glTF** | Tasarlanmazlar; elle modelleme daha hızlı ve daha zengin. |
| Yüzey detayı: perçin, panel, aşınma dokuları, "trim sheet"ler | **Blender / Substance → KTX2 doku** | Prosedürel geometriye uygulanır; görsel kaliteyi en çok artıran kalem. |
| Tanıtım görselleri, sinematikler | **Blender (Cycles)** | Çevrimdışı ışın izleme, gerçek zamanlıdan her zaman daha iyi görünür. |

Önerilen varlık hattı: Blender → glTF 2.0 (Meshopt sıkıştırma, KTX2/Basis
dokular) → three.js `GLTFLoader`. Tek dosya dağıtımı korunmak istenirse küçük
varlıklar HTML'e gömülebilir; büyük varlıklar için ayrı bir paket dosyası.

**Bu sürümdeki kalite açığının asıl sebebi geometri değil, yüzey detayı ve
ortamdır.** En yüksek getirili adımlar sırasıyla: (1) gerçekçi bir test hücresi
ortamı (Blender), (2) el yapımı detay dokuları, (3) HDRI ortam ışığı.

## 2. Teknoloji: web'de kal, masaüstüne paketle

- **Şimdilik TypeScript + three.js.** Tek HTML dosyası olarak WhatsApp'tan
  paylaşılabilmesi eğitim amacı için büyük avantaj. three.js r186'nın WebGPU
  renderer'ı ileride performans için hazır.
- **Steam/masaüstü için Tauri ya da Electron** ile aynı kod paketlenir.
- **Simülasyon çekirdeği (`src/sim/`) render motorundan tamamen bağımsız**, saf
  TypeScript ve testli. Proje Unity/Godot'a taşınmaya karar verirse bu kısım
  birebir C#/GDScript'e çevrilebilecek netlikte yazıldı; fizik ve kalibrasyon
  kaybolmaz.
- Tam bir uçuş simülasyonu (6 serbestlik dereceli uçuş dinamiği, çoklu uçak,
  büyük haritalar) hedeflenirse Godot/Unity yeniden değerlendirilmeli. Tasarım
  + test odaklı bir oyun için web yeterli.

## 3. Fazlar

### Faz 1 — Motor Akademisi ✅ (bu sürüm)
- Sıfır boyutlu, iki milli turbofan termodinamik modeli (kompresör haritası,
  türbin eşleşmesi, mil dinamiği, FADEC) — 16 birim testi
- 7 ders, test hücresi, EICAS, T–s diyagramı, prosedürel ses
- Otomatik oynanış testi (bütün dersler gerçek arayüz tıklamalarıyla)

### Faz 2 — İçerik ve cila (sürüyor)
- ✅ Blender test hücresi ortamı: kodla modellenir, Cycles ile ışık pişirilir,
  glTF olarak yüklenir; motorun yansıma haritası da hücreden alınır
  (`blender/testcell.py`)
- ✅ Panel detay dokuları (fan kaportası, çekirdek kaportası, pilon):
  yüksek poligonlu perçin/vida/kapak modelinden normal + ORM pişirme
  (`blender/panel_details.py`)
- Sıradaki varlıklar: fan kanadı aşınma dokusu, kontrol odası iç mekânı
  (kamera oraya girebilsin), KTX2 doku sıkıştırma
- Yeni dersler: itki çevirici, buz önleme ve bleed hava, yağ sistemi, uçuşta
  yeniden çalıştırma (windmilling relight), ateşleyici arızasıyla çalıştırma
- ✅ Motor tipleri: yolcu turbofanı, art yakıcılı askeri turbofan, turbojet,
  turboprop — aynı model, farklı tasarım; tipe göre EICAS ve gaz kolu
- ✅ Efektler: art yakıcı alevi ve şok elmasları, çalıştırma/surge/kapatma
  dumanı ve alevi, giriş girdabı, yoğuşma, zemin tozu, pervane uç izleri
- ✅ Kaportasız motorlara dış donanım (VSV, manifold, borular, kablo
  demetleri, aksesuar kutusu), turboprop planet redüktörü, stroboskopik
  dönüş düzeltmesi ve bulanıklık diskleri, kameraya göre dönen kesit,
  motor tipine göre alev renkleri, hücre ışıkları (gece modu), çift tıkla
  odaklanma
- Sıradaki: motor tiplerine özel dersler (art yakıcı kullanımı, turboprop
  pervane valisi ve beta aralığı), gece/nemli hava ayarı (yoğuşmayı artırır)
- İngilizce yerelleştirme, erişilebilirlik (klavye ile tam kontrol, renk körü paleti)
- Kaydedilmiş ses örnekleri + sentez karışımı

### Faz 3 — Görsel yükseltme + Motor Atölyesi (sıradaki)

Amaç: (1) mevcut dört motorun model ve efektlerini bir üst seviyeye taşımak,
(2) bunu yaparken **her parçayı atölyede yeniden kullanılabilir bir modül**
olarak kurmak, (3) oyuncunun kendi motorunu tasarlayıp test hücresinde
çalıştırabildiği **Motor Atölyesi**ni açmak. Görsel yükseltme ile atölye aynı
altyapıyı paylaşır; bu yüzden sıra önemlidir: önce varlık hattı ve modüler
üretici, sonra arayüz.

#### Varlık kaynakları ve kuralları

| Kaynak | Ne için | Nasıl |
| --- | --- | --- |
| **Blender (bpy 5.0, başsız)** | Kit-bash parça kütüphanesi (flanş, kelepçe, rakor, aktüatör, sensör, cıvata başı, braket), yüksek poligondan pişirilen normal/ORM dokuları, trim sheet'ler, atölye ortamı (montaj standı, taşıma arabası, vinç, alet tezgâhı), tanıtım renderleri | Her varlık `blender/*.py` betiğiyle koddan üretilir; elle tıklama yok, tekrar üretilebilir. Çıktı: glTF (Meshopt) + WebP/KTX2 |
| **İnternet (yalnız CC0 / kamu malı)** | HDRI ortamlar, taban malzeme taramaları (döküm, fırçalı metal, boya, beton), referans görseller | Poly Haven, ambientCG, NASA/FAA kamu belgeleri. Her dosyanın kaynağı ve lisansı `ASSETS.md`'ye yazılır |
| **Kod (prosedürel)** | Tasarlanabilen her şey: kanat profilleri, kademeler, kanallar, lüleler; çalışma anında dokular ve shader'lar | Parametre değişince anında yeniden üretilir |

Sınırlar: görsel gerçekçilik öncelikli, ama boyut gereksiz büyütülmez: HDRI'lar
"RGB + log parlaklık" WebP çiftine kodlanır (6,5 MB → <1 MB), taramalar yalnız
büyük yüzeylerde 2K, uzaktaki modellerde 512 px doku ve sadeleştirilmiş geometri.
Gerekirse büyük varlıklar isteğe bağlı ayrı paket dosyasına alınır. Mobil/zayıf GPU için düşük kalite
seviyesi korunur.

#### M1 — Varlık hattı ve kit-bash kütüphanesi ✅
- ✅ `blender/kit_parts.py`: 31 dış donanım parçası, 3 detay seviyesi, tek
  glb (nicemleme + meshopt, 0,8 MB); kodda `KitBatch` ile yerleştirilir,
  InstancedMesh ile çizilir (`src/engine/kit.js`)
- ✅ `blender/trim_sheet.py`: kaynak dikişi, tırtıl, perçin/vida sırası,
  soğutma panjuru, 8 etiket (normal + ORM + albedo)
- ✅ Dikişsiz döküm/metal/boya dokuları (Blender) — M1.5'te yerini gerçek taramalara bıraktı
- ✅ `ASSETS.md`: kaynak/lisans kaydı
- ✅ Prosedürel kelepçe/somun/aktüatör/kutu/pompa/tanklar kit parçalarıyla
  değiştirildi; flanş cıvataları, sondalar, kaldırma kulakları, yağ filtresi,
  tahliye valfi eklendi. Önce/sonra renderları README'de
- Ertelenen: KTX2 sıkıştırma (tek dosya paketine ~0,5 MB çözücü ekler).
  CC0 taramalar M1.5'te eklendi

#### M1.5 — Gerçek taramalar ve fotoğraf tabanlı ortamlar ✅
- ✅ `scripts/fetch-assets.mjs`: Poly Haven / ambientCG API'lerinden indirme,
  WebP/ORM dönüştürme, meshopt; kaynak ve yazarlar ASSETS.md'de
- ✅ 3 HDRI ortam (hangar, apron, makine atölyesi): zemine yansıtılmış arka
  plan, HDRI'dan güneş yönü/pozlama, yumuşak temas gölgeleri, yer taşıma standı
- ✅ 9 ambientCG taraması motor gövdelerine, sıcak bölgeye, lüleye, döküm
  muhafazalara, boyaya ve kit parçalarına (uv1, metre ölçeği)
- ✅ Test hücresine 10 Poly Haven modeli (vinç, alet arabası, kaynak arabası,
  raf, varil, yangın tüpü…); yer tutucular çıkarılıp hücre yeniden pişirildi
- ✅ Hata: GTAO ön-geçişi yarı saydam egzoz akışını katı yüzey sayıp
  arkasındaki görüntüyü bozuyordu

#### M1.6 — 3B havaalanı ortamı ✅
- ✅ Fotoğraf HDRI arka planları kaldırıldı: yalnız "pure sky" gökyüzü + 3B
  hava üssü (`blender/airfield.py`): apron, çalıştırma alanı, saptırma duvarı,
  kafes kirişli hangarlar, kule, operasyon binası, itfaiye, yakıt sahası,
  dönen radar, rüzgâr tulumu, ışık direkleri, tabelalar, pist
- ✅ Çalışma anında 9 km arazi (tarlalar, tepeler, dağlar, köyler), Poly Haven
  ağaçlarından impostor atlası (`blender/impostors.py`), çayır öbekleri
- ✅ 21 Poly Haven donanımı (çit, elektrik hattı, bariyer, jeneratör,
  kompresör, sandık, varil, araç…); açık hangar içi dolu
- ✅ Apron betonunda plaka başına ton farkı ve derz kiri; gece projektörleri;
  pilonlu turbofan için test sehpası; ortam değişiminde shader derleme kapısı

#### M2 — Model yükseltmesi (mevcut motorlar) ✅
- ✅ Yeni kanat üreteci (`src/engine/blades.js`): metal açılarından kamber
  çizgisi, yuvarlak hücum / sonlu firar kenarı, köke dolgu yarıçapı, kanat
  aralığı genişliğinde eğik platform, kompresörde kırlangıç kuyruğu, türbinde
  gövde + angel wing + üç dişli çam ağacı kök, HPT'de squealer uç cebi, LPT'de
  bıçak contalı uç örtüsü; kalite ayarına bağlı LOD
- ✅ Kademe üreteci (`src/engine/stages.js`): istasyon tablosundan rotor
  (kanat + dolgu yarıçaplı disk + ara kol + labirent conta dişleri + mil
  konileri) ve stator (kanatçık + iç bant + bal peteği conta yatağı, VSV mili,
  kolu ve birleştirme halkası, aşınabilir şeritli kalınlıklı gövde, flanş ve
  cıvatalar); dört motor da aynı üreteci kullanır. Askeri fan blisk
- ✅ Prosedürel yüzeyler (`src/materials/bladeShading.ts`): kompresörde hücum
  kenarı erozyonu, göbekte kir, arka kademelerde saman sarısı ısı rengi; HPT'de
  termal bariyer kaplama, duş başlığı + film soğutma delikleri, firar kenarı
  yarıkları, uçta kızıl-mor ısı tonu, kurum ve kaplama dökülmesi; LPT'de kademe
  ısısına göre ince oksit renkleri; disklerde torna izleri
- ✅ Yanma odası (`src/engine/combustor.js`): basamaklı soğutma halkalı
  gömlekler, shader'da gerçek açıklık olan birincil/seyreltme delikleri,
  efüzyon delikleri, alev tarafı parlaması, kubbe, swirler kapları, ön
  kaporta, enjektör sapları, bujiler, difüzör ve iç kasa
- ✅ Fan: geniş kordlu pala uçlu kanatlar, kırlangıç kök, kapalı disk profili
- ✅ Askeri lüle (`src/engine/nozzle.js`): kavisli yakınsak/ıraksak yapraklar
  ve contalar, pul gibi bindiren dış yapraklar, senkron halka, sabit boylu
  bağlantı kolları, hidrolik aktüatörler; lüle alanıyla birlikte hareket eder
- ✅ Kesit: kapalı katılarda arka yüz kapağı (müze kesitlerindeki gibi kırmızı
  boyalı kesik yüzey; ince duvarlarda ince kırmızı şerit); kanat dizileri
  bütün kalır; dış kabuklar kalınlıklı (iç yüzey yalnız kesitte çizilir);
  GTAO kesitte yalnız motor hacmini kırpar
- ✅ Önce/sonra render seti README'de. Düşük kalitede kare başına üçgen ve
  çizim çağrısı M2 öncesiyle aynı düzeyde (turbofan dış görünüm −%12 üçgen,
  askeri motorlarda −%20 çizim çağrısı, kesitte +%6–15 üçgen). Gerçek entegre
  GPU'da fps ölçümü bu ortamda yapılamadı (yazılım rasterleştirici)
- Ertelenen: kesit kapağında parça başına renk tonu; blisk/kanat için ayrı
  hasar (çentik, FOD) varyasyonları

#### M3 — Efekt yükseltmesi ✅
- ✅ Art yakıcı: 5 zon sırayla (≈0,4 s arayla) tutuşur — zon 1 çekirdekte,
  sonrakiler dışa doğru halkalar; gaz kolunun art yakıcı bölümü kaç zonun
  yanacağını belirler. Lüle yaprakları zonlarla birlikte açılır, her zon
  tutuşması kısa bir parlama ve darbe sesi verir. Mach diskleri aralık ve
  parlaklıkta titrer; lüle ağzında sarı-beyaz sıcak çekirdek
- ✅ Isı pusu: jetin ekrana izdüşen kesik konisi (lüle yarıçapından jet
  genişlemesine), akış aşağısında zayıflar, karışma katmanında daha
  dalgalı; art yakıcıda çok daha güçlü. Kamera arkasına düşen uç kırpılır
- ✅ Kurum: jetin zemine değdiği yerden başlayan iz; eski turbojet ve art
  yakıcı hızla, modern turbofan rölantide neredeyse hiç karartmaz
- ✅ Çalıştırma: kesitte bujilerin tıkırtılı kıvılcımı, tutuşmadan önce
  enjektörlerden yakıt sisi, yanarken swirler çıkışlarında mavi çekirdekli
  alev dilleri; soğuk ve nemli havada egzozda beyaz buhar
- ✅ Kapatma: metal sıcaklıkları gaz sıcaklığını ısınırken hızlı (≈5 s),
  soğurken yavaş (≈40 s) izler; türbin kanatları, egzoz konisi ve lüle iç
  yüzü kara cisim renginde kızarır ve kapatınca yavaşça söner
- ✅ Hava: test hücresi panelinde bağıl nem — giriş dudağı yoğuşması, yer
  girdabı, pervane ucu sarmalları ve surge halkası neme bağlı. "Havaalanı —
  yağmur" ortamı: çizgi yağmur, ıslanan zemin, su birikintileri ve damla
  halkaları, sıcak lülede buharlaşan damlalar. Gece ortamı M1.6'dan
- ✅ Surge: girişten öne tükürülen alev ve ardından duman, öne doğru genişleyen
  yoğuşma halkası (basınç dalgası), sert kamera sarsıntısı ve patlama sesi
- ✅ GIF karşılaştırmaları README'de (sabit adımlı kare yakalama kancası:
  `App.fixedDt` / `pendingSteps`)
- Düzeltilen: renk derecelendirmesinin S-eğrisi, bloom'un 1'i aştığı
  parlak yüzeylerde negatife dönüp siyah leke yapıyordu (M2 sonunda)

#### M4 — Modüler parametrik motor üretici (atölyenin motoru)
Bugün üç ayrı el yazımı üretici var (`core.js`+`fan.js`+`nacelle.js`,
`barejet.js`, `turboprop.js`). Bunlar tek bir **modül grafiği**ne dönüşür:

```
Giriş → [Fan | Pervane+redüktör] → [LPC] → HPC (eksenel / santrifüj)
      → Yanma odası (halka / kutu) → HPT → [LPT | güç türbini]
      → [Karıştırıcı] → [Art yakıcı] → Lüle (yakınsak / YI / chevron / ayrık akış)
      + Kaporta / çıplak gövde + dış donanım (otomatik yerleşir)
```
- Her modül: parametreler, akış istasyonları, bağlantı yarıçapları; komşusuna
  otomatik uyar (kanal geçişleri kendiliğinden yumuşatılır)
- `EngineDesign` modül grafiğinden türetilir; `sizeEngine()` her geçerli
  kombinasyonu boyutlandırır
- **Geometri fizikten türetilir** (kapsam gözden geçirmesi, Ekim 2026):
  kanal alanları kütle akışı ve eksenel Mach'tan, yarıçaplar göbek/uç
  oranından, kademe sayıları basınç oranı ve kademe yüklemesinden hesaplanır.
  Oyuncu az sayıda tasarım düğmesiyle oynar (göbek/uç oranı, eksenel Mach,
  kademe yüklemesi, uç hızı…). Bugünkü elle girilmiş ölçü tabloları
  (`barejet.js` `VARIANTS`, `turboprop.js`, `core.js`) kalkar
- Regresyon: her şablonun ana ölçüleri (fan/giriş çapı, toplam boy, kademe
  sayıları) bugünkünün ±%5'i içinde; ekran görüntüleri önce/sonra
  karşılaştırılır, görsel olarak aynı ya da daha iyi olmalı
- Yeni modül grafiği TypeScript'te; mevcut JS geometri yardımcıları
  (`stages.js`, `blades.js`, `combustor.js`, `nozzle.js`…) kullanılır
- Bugünkü yeniden üretim süresi (RTX 4070, yüksek kalite): turbofan 530 ms
  (3 M üçgen), askeri 212 ms, turbojet 183 ms, turboprop 224 ms

M4 üç adımda:

**M4a — Modül grafiği ve fizikten gaz yolu ✅**
- ✅ `src/design/`: modül tipleri (`types.ts`), sıra ve birleşim kuralları,
  grafik → `EngineDesign` → `sizeEngine()` (`graph.ts`); istasyonlardan
  kanal geometrisi, mil devirleri, kademe/kanat sayıları, eksenel yerleşim
  (`flowpath.ts`)
- ✅ Turbojet ve art yakıcılı askeri turbofan yeni üreticide
  (`templates.ts`, `catalog.ts`); `barejet.js`'teki elle girilmiş
  `VARIANTS` tablosu kalktı. Karıştırıcı modülü
- ✅ Kanat ucu bağıl Mach, türbin AN², kütle tahmini (turbojet 1,46 t,
  T/W 4,5; askeri 2,03 t, T/W 6,5); geçersiz grafiği öğretici mesajla
  reddeden denetimler
- ✅ 17 test: ölçüler eski modellerin ±%5'i, kademe sayıları aynı, itki ve
  yakıt katalogdaki motorla birebir, simülasyonda çalıştırma
- ✅ README'de parametrik varyant görseli (`renders/48-m4a-parametrik.jpg`).
  Önce/sonra ekran görüntüleri neredeyse aynı (hedef buydu), README'ye
  konmadı
- Not: askeri fanın kanat sayısı simülasyonda 36 → 28 (modelle aynı);
  fan kanat geçiş tonu biraz pesleşti. Devirler uç hızından türetildiği
  için ±%0,1 değişti
- Düzeltilen: arayüz gizliyken (H) kamera hâlâ panellere yer açıyordu

**M4b — Turboprop ve yüksek baypaslı turbofan**
- Pervane + redüktör, santrifüj HPC kademesi, serbest güç türbini
- Yüksek baypaslı fan, ayrık akışlı lüle, kaporta/pilon (`core.js`,
  `fan.js`, `nacelle.js` yeni sistemde yeniden yazılır)
- **Bitti sayılır:** dört motor yeni üreticide, eski üreticiler silinmiş

**M4c — Yeni modüller ve hız**
- Kutu (can) yanma odası, chevron lüle, ayrı karıştırıcı varyantları;
  bunların simülasyon karşılıkları (basınç kaybı, karışma verimi, gürültü
  için hazırlık)
- Artımlı yeniden üretim: yalnız değişen modül ve komşu geçişleri yeniden
  üretilir; kaydırıcı sürüklenirken düşük LOD önizleme
- **Bitti sayılır:** parametre değişikliği < 150 ms'de modeli yeniden
  üretiyor

Maliyet, gürültü (jet hızı + fan ucu), NOx (T3/T4) ve türbin soğutma havası
hesapları gösterilecekleri arayüzle birlikte M5'e alındı.

#### M5 — Motor Atölyesi arayüzü (v1)
Ekran düzeni:
```
┌──────────────┬───────────────────────────────┬──────────────────┐
│ Modül ağacı  │   3B motor (canlı)            │ Performans       │
│ + parametre  │   · patlatılmış görünüm       │ itki · TSFC      │
│   kaydırıcı  │   · kesit                     │ kütle · T/W      │
│              │   · istasyon renkleri         │ maliyet · gürültü│
│ Şablonlar    │                               │ ⚠ uyarılar       │
├──────────────┴───────────────────────────────┴──────────────────┤
│ Grafikler: kompresör haritası + çalışma hattı · itki–Mach–irtifa │
│            · T–s · tasarım A/B karşılaştırma                     │
└──────────────────────────────────────────────────────────────────┘
```
- Başlangıç şablonları: mevcut 4 motor
- Modül değiştirme (ör. lüleyi YI yap, art yakıcı ekle, santrifüj kademe),
  parametre kaydırıcıları, anında 3B güncelleme; **patlatılmış görünüm** ile
  modüller eksen boyunca ayrılır
- M4'ten ertelenen hesaplar: maliyet, gürültü, NOx, türbin soğutma havası
- Uyarılar öğretir: "fan ucu Mach 1,7 — gürültü ve verim kaybı", "T4
  malzeme sınırını aşıyor — soğutma havası ekle ya da tek kristal kanat seç";
  her uyarı ilgili derse bağlanır
- Geri al/yinele, kaydet/yükle (JSON dosyası + paylaşılabilir kısa kod)
- **"Test hücresinde çalıştır"**: tasarım mevcut test hücresine gider;
  çalıştırma, gaz kolu, arıza enjeksiyonu aynen çalışır
- Atölye ortamı: Blender'da üretilen montaj hangarı (M1 hattıyla)
- **Bitti sayılır:** otomatik oynanış testi atölyede sıfırdan bir motor
  tasarlayıp test hücresinde çalıştırıyor; hatasız

#### M6 — Sertifikasyon ve ilerleme (atölye v2)
- FAR/CS-33 esinli görevler: 5 s ivmelenme, kuş yutma, kanat kopması
  muhafazası, EGT payı, 150 saat dayanıklılık (hızlandırılmış)
- Müşteri istekleri (ör. "bölgesel jet için 90 kN, TSFC < 17 g/kN·s")
- Malzeme ve teknoloji kilitleri (tek kristal kanat, CMC, dişli fan)

### Faz 4 — Uçak tasarımı ("Sprocket'in uçak versiyonu")
- Parametrik gövde, kanat, kuyruk; iniş takımı
- Aerodinamik model: sürüklenme polarları, kaldırma, denge ve kontrol
- Kütle ve denge, yakıt hacmi
- Motor seçimi: Faz 3'te tasarlanan motor, uçağa takılır
- Görev analizi: menzil–faydalı yük diyagramı, kalkış mesafesi
- Uçuş testi: basitleştirilmiş uçuş dinamiği ile deneme uçuşları

### Faz 5 — Kampanya, ekonomi, topluluk
- Havayolu/askeri sözleşmeler (Sprocket'in kampanyasına benzer): gereksinimler,
  bütçe, teslim tarihi
- Tasarımları dosya olarak paylaşma, topluluk yarışmaları

## Açık teknik borç
- Render katmanındaki JS modüllerini TypeScript'e taşımak (`src/engine`, `src/core`, `src/materials`)
- Kesit görünümünde kesik yüzeyleri doldurmak (stencil ile "cap" çizimi)
- İç kademeler için LOD; zayıf GPU'larda kesit performansı
- Mobil/dokunmatik arayüz düzeni
