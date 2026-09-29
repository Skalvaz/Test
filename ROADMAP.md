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

Sınırlar: görsel gerçekçilik boyuttan önce gelir (M1.5'ten sonra tek HTML
~45 MB). Gerekirse büyük varlıklar isteğe bağlı ayrı paket dosyasına alınır. Mobil/zayıf GPU için düşük kalite
seviyesi korunur.

#### M1 — Varlık hattı ve kit-bash kütüphanesi ✅
- ✅ `blender/kit_parts.py`: 31 dış donanım parçası, 3 detay seviyesi, tek
  glb (nicemleme + meshopt, 0,8 MB); kodda `KitBatch` ile yerleştirilir,
  InstancedMesh ile çizilir (`src/engine/kit.js`)
- ✅ `blender/trim_sheet.py`: kaynak dikişi, tırtıl, perçin/vida sırası,
  soğutma panjuru, 8 etiket (normal + ORM + albedo)
- ✅ `blender/materials.py`: dikişsiz döküm, işlenmiş metal, boya dokuları
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

#### M2 — Model yükseltmesi (mevcut motorlar)
- Fan ve kompresör kanatları: kök (dovetail) ve platform, uç aşınması,
  ön kenar erozyonu, titanyum ısıl renk; blisk (askeri) / ayrı kanat (yolcu)
- Türbin: termal bariyer kaplamalı kanatlar, soğutma delikleri (normal harita),
  kanat uçlarında kızıl-mor ısı tonu
- Yanma odası: gömlek soğutma delikleri, dönen girdap yakıcılar (swirler)
- Lüle: değişken lüle yaprakları gerçek üst üste binen kanatçıklar + hidrolik
  aktüatörler, lüle açılıp kapanırken hareket eder
- Kesit: kesik yüzeyleri dolu çizme (stencil "cap"), kesik kenarında ince
  kırmızı işaret şeridi (teknik çizim gibi)
- **Bitti sayılır:** her motor için önce/sonra render seti; performans düşük
  kalitede ≥ 30 fps (entegre GPU)

#### M3 — Efekt yükseltmesi
- Art yakıcı: kademeli yanma (zon 1→5 sırayla tutuşur), lüle yapraklarının
  açılmasıyla senkron; hafif titreşen Mach diskleri; sıcak gaz kırılması
  alevin çevresinde güçlü
- Egzoz: ısı pusu (heat haze) ekranda daha doğru hacim, kurum birikimi
  (egzoz arkası zeminde zamanla kararma)
- Çalıştırma: yakıt püskürme sisi, ilk ateşlemede kıvılcım, soğuk günde
  beyaz buhar; kapatmada soğuyan türbinin kızıllığının sönmesi
- Hava: nemli havada giriş dudağında ve pervane uçlarında yoğuşma halkaları,
  yağmur/gece ayarı
- Surge: girişten geri tepen alev + basınç dalgası (ekran sarsıntısı + ses)
- **Bitti sayılır:** her efekt için kısa video/GIF karşılaştırması

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
- Mevcut dört motor bu sistemle yeniden üretilir ve görsel olarak eskisiyle
  aynı ya da daha iyi olmalıdır (regresyon testi = ekran görüntüsü karşılaştırma)
- Yeni hesaplar: kütle (malzeme × hacim), maliyet, kanat ucu Mach, disk
  gerilmesi (AN²), türbin soğutma havası, gürültü (jet hızı + fan ucu),
  NOx (T3/T4)
- **Bitti sayılır:** 4 motor yeni üreticide, simülasyon testleri geçiyor,
  parametre değişikliği < 150 ms'de modeli yeniden üretiyor

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
