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

### Faz 2 — İçerik ve cila
- Blender test hücresi ortamı, detay dokuları, HDRI
- Yeni dersler: itki çevirici, buz önleme ve bleed hava, yağ sistemi, uçuşta
  yeniden çalıştırma (windmilling relight), ateşleyici arızasıyla çalıştırma
- Turbojet / turboprop / turbofan karşılaştırması (aynı model, farklı tasarım)
- İngilizce yerelleştirme, erişilebilirlik (klavye ile tam kontrol, renk körü paleti)
- Kaydedilmiş ses örnekleri + sentez karışımı

### Faz 3 — Motor tasarım atölyesi
Kodda temeli hazır: `EngineDesign` → `sizeEngine()` tasarım noktasını
boyutlandırıyor ve tasarım dışı model bununla çalışıyor.
- Tasarım parametreleri: fan çapı ve kanat sayısı, BPR, fan/HPC basınç
  oranları, kademe sayıları, T4, malzeme seçimi
- Parametrik geometri: parametreler değiştikçe 3B model yeniden üretilir
- Kısıtlar: kütle, maliyet, gürültü, NOx, kanat ucu hızı, disk gerilmesi,
  türbin soğutma havası
- Sertifikasyon görevleri (FAR/CS-33 esinli): kuş yutma, kanat kopması
  muhafazası, 5 s ivmelenme, EGT payı, dayanıklılık testi

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
