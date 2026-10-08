# Motor Atölyesi — tasarım belgesi (M5)

Amaç: oyuncunun kendi jet motorunu **mimarisinden** başlayarak tasarladığı,
her kararın fiziksel bedelini anında gördüğü ve tasarladığı motoru test
hücresinde çalıştırıp sonra (Faz 4) kendi uçağına taktığı bir atölye.
"Sprocket'in uçak versiyonu, motor mimarisi de üretilen daha ayrıntılı
hali."

## Referanslar ve aldıklarımız

| Oyun / araç | Ne yapıyor | Bizde karşılığı |
| --- | --- | --- |
| **Sprocket** (tank) | Şekil 3B'de yüz/kenar sürükleyerek; iç parçalar fiziksel yer kaplar; her kararın ağırlık/hacim bedeli; dönemler teknolojiyi sınırlar | 3B'de **tutamaçlarla doğrudan düzenleme**; parçalar gerçek boyutta (gövde içine sığmak zorunda); anlık ağırlık/boy/çap; teknoloji dönemleri |
| **Automation** (araba) | Motor **ailesi** (mimari: silindir düzeni, malzeme, kafa) + **varyantlar** (ayar); her seçenekte açık ödünleşim; güç eğrisi, güvenilirlik, maliyet, mühendislik süresi; yıl kilitleri; motor sonra araca takılır | **Aile** = mimari (mil sayısı, fan/pervane, kompresör tipleri, yanma odası, lüle…), **varyant** = itki sınıfı/ayar (gerçek motor aileleri gibi: CFM56-7B24/26/27); sonuç kartları; motor kartı uçağa takılır |
| **Flyout** (uçak) | Serbest gövde/kanat editörü, şekilden sürükleme; motorlar dişliyle pervaneye bağlanır; tasarla → uç → düzelt döngüsü | Faz 4'ün modeli; motor tarafında **motor kartı** (itki–Mach–irtifa, TSFC, kütle, boyut, bağlantı noktaları) uçak tasarımcısının girdisi |
| **GasTurb** (profesyonel) | Tasarım noktası çevrimi → parametrik taramalar (halı grafikleri) → Mach ve göbek/uç oranından kanal geometrisi → kütle → tasarım dışı | M4 mimarisi bu sırayı izliyor (doğrulandı); halı grafiği atölyenin "keşif" aracı olur |

## Tasarım katmanları

### 1. Mimari (aile)
Motorun iskeleti. Değiştirmek "yeni aile" demektir: geometri baştan
üretilir, varyantlar sıfırlanır.

- LP mili yükü: **fan** (baypas oranıyla) · **pervane + redüktör** · yok
  (yalnız LPC) — ileride **dişli fan** (GTF) ve **açık rotor**
- Kompresörler: booster var/yok · HPC eksenel / eksenel + santrifüj
- Yanma odası: halka · kutu · (ileride kutu-halka)
- Türbinler: HPT, LPT / serbest güç türbini (kademe sayıları fizikten)
- Egzoz: ayrık akış · karıştırıcı (düz/lobe'lu) · art yakıcı ·
  lüle (yakınsak / YI / kısa boru), chevron
- Kurulum: kaportalı (uçağa pilonla) · çıplak (test hücresi)
- İleride: **3 milli** (IP mil), değişken çevrim

Her seçenek bir **kart**: ne işe yarar, neyi kazandırır, neye mal olur,
hangi gerçek motorda var, ilgili ders. Geçersiz birleşim seçilemez; kural
mesajı nedenini öğretir (M4'teki `GraphError` metinleri).

### 2. Ayar (varyant)
Aynı ailenin farklı itki sınıfları. **Temel** düğmeler (öğrenci):

| Modül | Temel | Uzman (anahtarla açılır) |
| --- | --- | --- |
| Motor | hava akışı | — |
| Fan | basınç oranı, baypas oranı, uç hızı | eksenel Mach, göbek/uç, kademe yüklemesi, kanat katsayısı |
| LPC/HPC | basınç oranı | uç hızı, Mach, göbek/uç, daralma, ψ, kademe aralığı |
| Santrifüj | iş payı | çark yüklemesi, difüzör oranı |
| Yanma odası | T4, tip, kutu sayısı | referans hızı, boy oranı |
| Türbinler | — | Mach, göbek/uç, ψ, uç hızı (güç türbini) |
| Art yakıcı | T7 | jet borusu Mach, boy oranı |
| Lüle | chevron sayıları | hız katsayısı |

Kaydırıcının yanında anlık sonuç değişimi gösterilir (ör. "TSFC −%2,1,
kütle +84 kg").

### 3. Doğrudan düzenleme (Sprocket kıvamı)
3B modelde modüle tıklanır → seçilir, panelde düğmeleri açılır. Seçili
modülde **tutamaçlar** görünür; sürüklemek fiziksel bir düğmeyi değiştirir,
geri kalanı fizik hesaplar:

- Fan ucunu dışa çekmek → hava akışı (aynı Mach'ta) → itki, kütle, çap
- Modül sınırını eksen boyunca çekmek → kademe aralığı / boy
- HPC'yi uzatmak → daha çok kademe → basınç oranı artışı (aynı yüklemede)
- Lüle ağzı → lüle alanı (tasarım noktası kayar)
- Kaporta dış çizgisi (Faz 4'te sürükleme için önemli) serbest biçimli

Her tutamaç hareketi taslak ayrıntıda < 150 ms'de yeniden üretilir (M4c).
**Patlatılmış görünüm** modülleri eksen boyunca ayırır; **kesit** ve
**istasyon renkleri** (sıcaklık/basınç) her an açılabilir.

### 4. Sonuçlar ve sınırlar
Sağ panelde, Sprocket'in ağırlık/hacim ve Automation'ın sonuç kartları
gibi, her zaman görünür:

- İtki (kuru/art yakıcılı) ya da mil gücü · TSFC · kütle · itki/ağırlık
- Çap · boy · fan/pervane ucu Mach · türbin AN² · T4 payı
- Maliyet · gürültü · NOx · ömür/güvenilirlik (M5c)
- **Uyarılar** öğretir ve derse bağlanır: "fan ucu bağıl Mach 1,7 — şok
  kayıpları ve gürültü", "T4 malzeme sınırını aşıyor — soğutma havası ya da
  tek kristal kanat", "HPT AN² sınırda — disk patlama riski"

### 5. Teknoloji dönemleri
Automation'ın yılları, Sprocket'in dönemleri gibi: malzeme ve özellikler
döneme göre açılır, sınırları belirler (T4, uç hızı, AN², kademe
yüklemesi). Örn. 1950 turbojet → 1970 yüksek baypas → 1985 tek kristal
kanat → 2010 CMC, dişli fan. Veri modeli M5'te kurulur; ilerleme/kariyer
M6'da.

### 6. Test ve uçağa bağlantı
- **"Test hücresinde çalıştır"**: tasarım test hücresine gider; çalıştırma,
  gaz kolu, arızalar aynen çalışır (simülasyon zaten grafikten).
- **Motor kartı** (Faz 4 girdisi): itki–Mach–irtifa tablosu, TSFC, kütle,
  boyutlar, bağlantı noktaları, aile/varyant adı. Uçak tasarımcısı motorları
  bu kartlardan seçer (Automation'da motorun araca takılması gibi).

## Mimari kataloğu (M5)

Kullanıcı kararı (Ekim 2026): bugünkü dört motorun dışındaki bütün mantıklı
mimariler M5'e girer.

| Mimari | Gerçek örnek | Gerekenler |
| --- | --- | --- |
| Art yakıcısız çıplak motor (sabit yakınsak lüle) | J57, JT8D çekirdeği, füze motorları | yerleşim + sabit lüle; simülasyon hazır |
| Kaportalı karışık akışlı turbofan | CFM56-5C, iş jetleri (TFE731) | uzun kanallı kaporta + karıştırıcı; simülasyon hazır |
| Turboşaft (helikopter) | T700, Makila | güç türbini çıkış mili, pervanesiz; turboprop simülasyonundan |
| Çift santrifüj / ters akışlı yanma odası | PW100, PT6 | iki santrifüj kademe, ters akış yerleşimi |
| Kutu-halka yanma odası | JT9D öncesi, JT8D | kutular + ortak çıkış halkası |
| İtki çevirici | kaskad (CFM56), kapı tipi | kaporta modülü; simülasyonda ters itki (ders planlıydı) |
| Dişli fan (GTF) + değişken alanlı fan lülesi | PW1000G | fan redüktörü (turboprop dişlisinden), fan/LPT devir ayrımı |
| 3 milli motor | RR Trent, RB211 | IP mili: simülasyonda üçüncü mil dinamiği, EICAS, dersler |
| Açık rotor / propfan (karşı dönen) | GE36, CFM RISE | iki pervane dizisi, karşı dönen redüktör |
| Ramjet / değişken çevrim | — | uçuş hızı gerekir: Faz 4'te |

## Kilometre taşları

**M5a — Atölye çekirdeği**
Aile/varyant veri modeli, şablondan başlama, mimari kartları (geçerli
birleşimler), temel + uzman düğmeleri, canlı 3B (taslak/tam ayrıntı),
3B'de modül seçme ve **temel tutamaçlar** (fan/giriş ucu, kompresör boyu,
lüle ağzı), sonuç paneli ve öğretici uyarılar, motor tipinin modüllerden
türetilmesi, "test hücresinde çalıştır". Şablonlar fiziğe uydurulur (uyarı
vermez). Simülasyon değişikliği gerektirmeyen mimariler: art yakıcısız
çıplak motor, kaportalı karışık akışlı turbofan, turboşaft, kutu-halka.
Oynanış testi: sıfırdan bir motor tasarlayıp test hücresinde çalıştırır.

**M5b — Doğrudan düzenleme, keşif ve dişli fan**
Bütün tutamaçlar, patlatılmış görünüm, istasyon renkleri; grafikler
(kompresör haritası + çalışma hattı, itki–Mach–irtifa, T–s, halı grafiği,
A/B karşılaştırma); geri al/yinele, kaydet/yükle, paylaşım kodu. Dişli fan
+ değişken alanlı fan lülesi, itki çevirici, çift santrifüj / ters akışlı
yanma odası.

**M5c — Yeni hesaplar, dönemler, 3 mil ve ortam**
Maliyet, gürültü, NOx, soğutma havası, ömür; teknoloji dönemleri (veri +
sınırlar; kariyer M6'da); motor kartı; 3 milli motor; açık rotor; Blender
montaj hangarı.
