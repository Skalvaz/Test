# FİTİL — Oyun Tasarım Belgesi (GDD) v1.0

**Durum:** Uygulamaya hazır  
**Platform:** Tek dosya HTML. Canvas 2D ve DOM arayüz, TypeScript, Vite + vite-plugin-singlefile.  
**Dil:** Türkçe  
**Hedef:** Telefonda dikey dokunmatik oyun, masaüstünde fare ve klavye; 60 fps.

> Belgede iki tür sayı var. **Kural sabitleri** (çekirdek, testli, değişmez) ile **ayar başlangıç değerleri** (bölüm verisinde durur, bot kalibrasyonu ±%20 oynatabilir) ayrı tutulur. Bölüm verisindeki hamle sayıları ve yıldız eşikleri başlangıç değeridir; bağlayıcı olan, bölümün hedef bot bandıdır.

---

## 0. Hakem notlarından gelen tasarım kararları (karar günlüğü)

Kazanan konseptten saptığımız ya da üstüne eklediğimiz noktalar şunlar. Programcının "neden böyle" sorusuna cevap verir.

| # | Karar | Kaynak / gerekçe |
|---|---|---|
| K1 | **Varsayılan ısı eşiği 4.** Eşik veride 3–5 arasında; 2 yalnız Usta Bölümü ve şov içindir. Isı 0–3 arasında görünür. "Kızgın" durum = eşik−1. | Tasarımcı simülasyonu: eşik 3'te hamle başına ısı patlaması medyan 5 / p90 18 çıktı (hedefin üstünde). Eşik 4'te 2 / 9 / 18. |
| K2 | Isı göstergesi **eşiğe göre**: kapsülün çevresinde eşik−1 adet köz yuvası vardır. Kızgın kapsül her eşikte aynı görünür ("bir dokunuş kaldı"). | Eşik bölüme göre değişse de görsel dil aynı kalır. |
| K3 | **Özel taş eşikleri 6 / 9 / 12** (roket / kasımpatı / yıldız topu). | 8-komşulukta en uzun yol medyanı 6 renkte 6, 4 renkte 9. 5/7/10 eşiğiyle neredeyse her hamle özel taş üretiyordu. |
| K4 | **Temel renk sayısı 5.** 4 renk yalnız öğretimde (1–5) ve 12. bölümde (24 Ekim 2026'dan beri 12 de 5 renk, K21). 6 renk 22. bölümden sonra. | 8-yönlü bileşenler büyüyor. |
| K5 | 1. bölümde **ısı tadı**: önceden kızgın tek bir kapsül kendiliğinden patlar. | Two Dots farkı ilk 20 saniyede hissedilsin. |
| K6 | Kural zamanları **tik** birimindedir (1 tik = normal hızda 1 ms). Çizici ölçekler, hızlandırma kuralı değiştirmez. | Mühendis hakemi. |
| K7 | **Körük Göstergesi:** ısı patlamaları doldurur. Dolunca oyuncu hamle harcamadan seçtiği 3×3 alana +1 ısı verir. | Usturlap'ın Güneş Çekirdeği (üç hakem). |
| K8 | **Gece Tablosu:** bölümün patlama günlüğünden belirlenimli çizilen kişisel tablo. Nadirliği ustalığa bağlıdır. | Ebruli aşısı (üç hakem). |
| K9 | **Işık Deseni** hedefi: renkli döşemeler bir motif oluşturur, motif haritaya asılır. | Ebruli aşısı. |
| K10 | **Yardım n** düğmesi yalnız 1–20. bölümlerde açık ve belgelidir. Kilitlenmeye yakın tahtada doğan kapsüller aynı akıştan en fazla n kez yeniden çekilir. | Ebruli aşısı, mühendis sınırlaması. |
| K11 | **Hava olayları:** Meltem (satırı kızdırır, tutuşturmaz) ve Çisenti (satırın ısısını sıfırlar). Bir hamle önceden haber verilir. | Rüzgâr Eken aşısı. |
| K12 | Patlayan hücrenin zemini bölüm boyunca **ışıklı kalır**. Bölüm sonunda sandık ışıl ışıl olur. | Rüzgâr Eken aşısı. |
| K13 | "Sıradaki: X!" tanıtımı ve **Coşku Serisi** (3 ilk deneme kazancı → sonraki bölüme hazır roketle başlanır). | Rüzgâr Eken aşısı. |
| K14 | **Dürüst bot:** gerçek dolum akışını görmez. **"Bu çizgi kazandırırdı"** gösterimi. CI'da **yakın kaçış ölçütü**. | Usturlap ve Rüzgâr Eken aşıları. |
| K15 | İlk tahta bölüm başına sabittir; dolum her denemede taze gelir. | Usturlap aşısı. |
| K16 | 4 başarısızlıktan sonra gönüllü **Kıvılcım Usta'nın Eli** (+5 hamle, en fazla 1★). | Usturlap aşısı. |
| K17 | Günlük **paylaşım ızgarası**. Kaçırılan gün seriyi sıfırlamaz, **bir basamak düşürür**. | Usturlap aşısı. |
| K18 | Mahalle tamamlanınca **Fener Koyu Defteri** kültür kartı açılır. | Usturlap aşısı. |
| K19 | Sandıkta güçlendirici payı %35'e indi. Birincil ödül desen, tablo ve motiflerdir. | Mühendis hakemi. |
| K20 | Klavye ile tam oynanabilirlik. | Tasarımcı ve mühendis hakemleri. |
| K21 | **Görünmeyen kural yok (24 Ekim 2026, ürün sahibi kararı).** Ana (1–40) ve Usta bölümlerinde `kurallar.caprazSiniri` tanımlanamaz; `ozelEsikleri`'nin her öğesi ya 0 (tür kapalı) ya da standart değerdir (sırasıyla 6 / 9 / 12, K3). Doğrulayıcı ikisini de hata sayar (`npm run dogrula`, vitest). Şema, çekirdek ve bot desteği kalır (testler, deneme varyantları); günlük ve sonsuz üretimi denetimin dışındadır. Denge yalnız görünür düğmelerle kurulur: renk sayısı ve doğum ağırlıkları, hamle, hedef adedi, Körük ve dev fişek kapasitesi, ön ısı, ilk tahta tohumu, düzen, özel türü 0 ile kapatmak ve yedek düğme `soguma` (ısı düşüşü tahtada görünür). **Gizli çapraz sınırı kaldırılıp yeniden dengelenen bölümler:** 12 (4 → 5 renk; K4'ün 12 istisnası kalktı), 14 (`soguma` 2 → 1, +1 kaya), 15 (hamle 23, doğum [4,4,4,3,3]), 17 (6 renk [8,8,8,8,8,1], `soguma` 4, Körük 14), 19 (6 renk [4,4,4,4,4,1]), 20 (yalnız sınır kalktı), 21 (ilk tahta tohumu, Körük 16), 26 (yıldız topu kapalı [6,9,0], hamle 30, Körük 8, doğum [5,2,5,2,2], ön ısı; Usta bandı [92,100]), 30 (yıldız topu kapalı, eskiden [6,9,13]; tohum, Körük 12), 37 (6 renk, dev fişek kapasitesi 7, hamle 25), 40 (`soguma` 2, açılıştaki sabit kapsül kalktı, fener hedefi 3 → 2, Körük 14), U4 (6 renk, hamle 22), U5 (6 renk, hamle 25), U8 (hamle 25). 10 (5 renkte ~70 varyant bandı tutmadı: 6 renk [4,4,4,4,3,3], hamle 22, kafes ön ısısı 1; §8.3 tablosunda 6 renk). Eski K21: yedek düğmeler (`caprazSiniri`, `soguma`) ilk 40 bölümde kapalı, bant tutmazsa açılır. | Çapraz sınırı ve standart dışı özel eşikler oyuncuya hiçbir yerde gösterilmiyordu: oyuncu öğrendiği kuralın (8 yönde serbest yol, 6 / 9 / 12'de özel taş) bölüme göre sessizce değiştiğini göremez. Eski gerekçe (kaçak reaksiyon, uzun zincir) görünür düğmelerle karşılandı. |
| K22 | **Öğretim (1–5) yıldız eşikleri gündelik oyuncuya göre, elle** (§7.4'ten sapma). 4–5: 2★ = min(Acemi p40, Usta p15), 3★ = min(Usta p50, Acemi p85 ile Usta p50'nin ortası) (`yildizEsikleriOgretim`, `--dagilim` "K22 öneri" sütunu). **İlk izlenim (1–3, revizyon):** 2★ = Acemi kazançlarının p20'si, 3★ = Acemi p70 ile Usta p50'nin ortası (`yildizEsikleriIlkIzlenim`, "İlk izl." sütunu; Usta 100 + Acemi 200 tohumla ölçüldü): 1 [1900, 2400], 2 [3200, 4000], 3 [2900, 3400] (önce [2000, 2500], [3500, 4000], [3100, 3500]); Acemi kazançlarının 1★/2★/3★ payı 1: 13/66/22, 2: 14/51/35, 3: 17/54/30 (önce 27/62/12, 31/34/35, 33/46/22). Kazançların puanı, aşağı 100'e yuvarlanır. Bölüm verisinde `elleEsik: true`; `npm run kalibre` bu eşikleri yazmaz. 6–25 K24'e, 26. bölümden sonrası §7.4'e uyar. | Usta p50/p85 eşikleriyle makul oynayan oyuncu öğretimde çoğunlukla 1★ alıyordu (Bölüm 1'de Acemi kazançlarının %95'i). İlk izlenim revizyonu: gerçek bir gündelik oyuncu bölüm 1'i 1.845 puanla bitirip 1★ aldı (eski 2★ 2.000; 1.845 Acemi kazançlarının ~p9'u, yeni 1.900 ile de 1★ — Acemi'den zayıf ilk oyuncuyu 2★'a almak için ~1.800 gerekir). Hedef: ilk bölümlerde galibiyetlerin ~%80'i en az 2★, 3★ erişilebilir ama iyi oyunun ödülü. |
| K23 | **İlk oturum ayarı (6–12) Acemi botuna göre:** tanıtımda Acemi ≥ %35 (izleme uyarısı < %30), Usta bandı [92, 100]; Bölüm 10 (zor) Usta [70, 85], Acemi ≥ %15 — testere dişi korunur. Araçlar: hamle (≤ 30), hedef adedi, yardım 3, ön ısı, `soguma` (`caprazSiniri` de vardı; K21 ile kalktı); yeni öğe korunur. §8.2 bantlarından ve §8.3 tablosunun H/Y/hedef değerlerinden sapar. 13–19 K24 ile aynı yöntemle ayarlandı. | Öğretimden hemen sonra Acemi kazanma oranı 0'a düşüyordu (b6, b8–b12: 0/40; Usta %86–92). Gündelik oyuncu ilk 10 dakikada kaçmasın. |
| K24 | **Yıldız eşikleri (6–25) gündelik oyuncuya göre:** 2★ = min(Usta p50, Acemi kazançlarının p50'si), 3★ = Usta p85 (§7.4'ün 3★'ı); kazançların puanı, aşağı 100'e yuvarlanır (`yildizEsikleriK24`). Bölüm verisinde `esikKurali: "k24"`; `npm run kalibre -- --kural k24` 500 tohum Usta + 500 tohum Acemi ile yazar ve bayrağı ekler, bayraklı bölümde düz `npm run kalibre` de K24'ü uygular; `--dagilim` "K24 önerisi" sütununu gösterir. 1–5 K22'de kalır. **İlk oturum ayarı 13–25'e uzatıldı** (K23 yöntemi, Acemi 60 tohum; zor bölümlerde 200 bağımsız tohumla da): tanıtımda Acemi ≥ %30 (Usta [92, 100]), normal (22–24) Acemi ≥ %20 (Usta [85, 100]), zor (15, 20, 25) Acemi ≥ %8 ve Usta [60, 85] (20, 25: [65, 85]), rahatlama (19) Acemi ≥ %60; yeni öğe hedefte kalır. Bölüm 15 yeniden yerleşti (K2/K3 dalgakıran duvarı, 3 fener üstte, ön ısılı alt sıralar, `soguma` kapalı, `caprazSiniri` 2, K21 ile kalktı); 16'da hedef 3 dev fişekten 2'si; 20'de `soguma` kalktı; 21'de iki S barut izi kenar/köşe döşemelerinden geçer (+50 kızıl hedefi süre için, `caprazSiniri` 3, K21 ile kalktı); 23'te kayalar köşe ceplerinden içe alındı; 24'te döşemeler bir satır aşağı kaydı; 25'te köşe/kenar döşemeleri kalktı (aydınlat 28), fenerler duvar uçlarının üstünde. §8.3 tablosunun H/Y/hedef/şekil değerlerinden sapar. Bağımsız denetim (tohum 3000+, 300 tohum) hedefleri onayladı; 26–30 henüz ayarlanmadı (Acemi 27–30'da %3–32). | §7.4'ün Usta p50 2★'ı gündelik oyuncunun galibiyetlerini neredeyse hep 1★'da bırakıyordu (6–12'de Acemi kazançlarının %82–100'ü 1★). Bağımsız denetim 12 → 13'te Acemi uçurumu buldu (b12 ~%38 → b13 %2–5, b14 %2, b15 %0, b19 %3; 20–25'te %0–20). Hedef: ortalama galibiyet 2★, 3★ iyi oyunun ödülü. |
| K25 | **Meta tanıtımları yayıldı (22 Ekim 2026, ilk oturum denetimi):** Günün Şenliği ve günlük görevler 10. değil **14. bölümün** ilk kazancıyla açılır (`GUNLUK_ACILIS_BOLUMU`). Usta Bölümleri yıldız eşiğine ek olarak **12. bölüm kazanılmadan açılmaz** (`USTA_ACILIS_BOLUMU`; U*n* açık ⇔ ana ★ ≥ 15·*n* ve 12 kazanıldı); 12'nin kazancında yıldızı zaten yeten Ustalar birlikte açılır. Haritada kilitli Usta etiketi yıldız eksikse "★15", yalnız bölüm kapısı kaldıysa "12. bölümden sonra". **Eski kayıt koruması** (göç yok): günlük geçmişi olan (görev günü/görevler, günlük sonucu, ilk kazanç ya da günlük kazanç istatistiği; Fener Nöbeti sayılmaz) kayıtta günlük açık kalır; bir Usta Bölümü oynamış kayıtta kapı geçilmiş sayılır. | `docs/YAYIN.md` "Aşama 1 denetimi": bölüm 5–10'da yedi meta sistem üst üste geliyordu (kandil + Kasaba 3, sandık + defter 5, Kibrit + mühürler 6, mühür anlatımı 7, Usta 8, Günün Şenliği 10). Aile oyuncuları 10+ bölümde: oynanmış sistem (günlük geçmişi, oynanmış Usta) geri kapanmasın. Bilinen bedel (kayıtta iz yok, göç yok): eski kuralla 15/30★'da açılıp hiç oynanmamış U1/U2 12 kazanılana dek yeniden kilitlenir, 12'nin kazancında "Usta Bölümü n açıldı" duyurusu ikinci kez çıkar. |

Kapsam dışı (sonraki sürüm): Cep yuvası, sunucu veritabanı, çok oyunculu mod, harici ses ve görsel dosyası.

---

## 1. Kimlik

- **Ad:** FİTİL
- **Slogan:** *Bir çizgi çek, geceyi tutuştur.*
- **Özet:** Fener Koyu'nun yıllık Işık Şenliği, yaşlı fişekçi Kıvılcım Usta emekli olunca sönmüş. Oyuncu onun çırağıdır. Parmağıyla aynı renkteki barut kapsüllerini, çapraz dahil 8 yönde tek bir fitille birleştirir ve bırakır. Alev yol boyunca hızlanarak koşar, her patlamada müzik bir nota yükselir. Patlayan her kapsül dik komşularını ısıtır. Isı kalıcı ve görünürdür; eşiğe ulaşan kapsül kendiliğinden patlar. Doğru yere çekilmiş tek bir çizgi bütün sandığı zincirleme bir havai fişek şovuna çevirir. Can, bekleme, mağaza yoktur. Tekrar denemek her zaman anında ve ücretsizdir.

### 1.1 Candy Crush'tan farklar

1. **Hamle takas değil, çizimdir.** İki taş yer değiştirmez; aynı renkleri 8 yönde bir fitille bağlarsın. Tek hamlede 3 ile 20'den fazla kapsül patlar.
2. **Zincirleme reaksiyonun kaynağı ısıdır, şans değil.** Otomatik eşleşme yoktur, düşen taşlar kendiliğinden patlamaz. Kaskadı yalnızca birikmiş, görünür ısı üretir. Oyuncu "bu hamle ısıt, sonrakinde tutuştur" diye plan yapar.
3. **Çizdiğin şekil tahtaya etki eder.** U ile saran zincir bir hücreyi 3 kez ısıtır. Halka kapatmak zincirin bütün patlamalarına +2 ısı verir.
4. **Nişan çizimle alınır.** Roketin eksenini son vuruşun yönü belirler; çapraz roket de vardır.
5. **Engeller ısıyla konuşur.** Kafes yalnız ısıyla ya da özel taşla açılır, kova ısıyı keser, dev fişek dolup fırlar, barut izi domino gibi yanar.
6. **Bölüm içi zamanlama kararı:** Körük Göstergesi dolduğunda ne zaman kullanacağına oyuncu karar verir.
7. **Ödül kişiseldir:** Her bölüm, oyuncunun kendi patlamalarından çizilen bir Gece Tablosu bırakır.
8. **İş modeli (Ekim 2026 kararı, `docs/YAYIN.md`):** Android sürümünde yumuşak can + yalnız istekle ödüllü reklam + küçük satın alma; sahte kıtlık, süreli baskı ve zorunlu ara reklam yok. claude.ai/tek dosya sürümünde can, reklam, satın alma yok.

---

## 2. Izgara ve öğeler

### 2.1 Geometri
- Kare ızgara, W sütun × H satır. **Varsayılan 7×9**, izin verilen aralık 5×6 ile 8×10.
- Koordinatlar: `x` soldan 0..W−1, `y` yukarıdan 0..H−1. Doğrusal indeks `i = y·W + x`.
- **Komşuluk:** zincir için 8-komşu (dik ve çapraz). Isı, engel hasarı ve kova kalkanı için 4-komşu (yalnız dik).
- Tahta şekli `#` (delik) hücreleriyle verilir. Delik hiçbir katmana sahip değildir, yerçekimi onu atlar, roket üzerinden geçer.

### 2.2 Hücre katmanları
Her hücrede 1 İÇERİK, isteğe bağlı 1 KAFES örtüsü ve 1 ZEMİN katmanı bulunur.

| Katman | Değerler |
|---|---|
| İçerik (hareketli) | `kapsul`, `islak` (ıslak barut), `fener` |
| İçerik (sabit) | `kaya` (1–3 kat), `kova` (1–2 kat), `devFisek` (dolum 0..N), `is` (1 kat) |
| Örtü | `kafes`: yalnız kapsülün üstüne konur, kapsülü sabitler |
| Zemin | `doseme` (0–2 kat), `desen` (renk 0–5 ya da −1, boyalı mı), `iz` (barut izi indeksi ya da −1) |
| Görsel (çekirdekte tutulur) | `isikIzi`: bu bölümde bu hücrede patlama oldu mu |

### 2.3 Kapsül
`{ renk: 0..5 | −1 (yıldız topu), isi: 0..eşik−1, ozel: yok | roket | kasimpati | yildiz, eksen: 0..3 }`

| Renk # | Ad | Renk | Gövde silueti |
|---|---|---|---|
| 0 | Kızıl | #FF4D4D | Daire |
| 1 | Kehribar | #FFB020 | 5 köşeli yıldız (yuvarlak köşeli) |
| 2 | Zümrüt | #2EE07A | Damla (ucu yukarıda) |
| 3 | Gök | #3AA8FF | Elmas |
| 4 | Mor | #B266FF | Altıgen |
| 5 | Gül | #FF5FB4 | Üçgen (ucu yukarıda, yuvarlak köşeli) |

Bölümde `renkSayisi = n` ise 0..n−1 renkleri kullanılır.

**Roket ekseni:** 0 = yatay (—), 1 = dikey (|), 2 = çapraz ↗ (x+1, y−1 yönü), 3 = çapraz ↘ (x+1, y+1 yönü). Son segmentin (dx, dy) değerinden şöyle çıkar: dy = 0 → 0; dx = 0 → 1; dx·dy < 0 → 2; dx·dy > 0 → 3.

### 2.4 Hareketli ve sabit
- **Hareketli:** kapsül (kafessiz), ıslak, fener. Düşer, karıştırmada yer değiştirebilir (fener ve ıslak karıştırılmaz).
- **Sabit:** kaya, kova, dev fişek, is ve kafesli kapsül. Düşmez; hareketli içerik bunların "arkasından geçer" (bkz. §3.6).

---

## 3. Hamle ve "eşleşme" kuralları

### 3.1 Hamle türleri
| Tür | Maliyet | Açıklama |
|---|---|---|
| `fitil` | 1 hamle | Geçerli bir yol çizip bırakmak |
| `ciftDokunus` | 1 hamle | Özel taşa 300 ms içinde iki kez dokunmak; taşı tek başına ateşler |
| `koruk` | 0 | Dolu Körük Göstergesini bir merkeze uygulamak (§6.10) |
| `kibrit`, `kalip`, `geriSar` | 0 | Güçlendiriciler (§9) |

### 3.2 Zincirlenebilir hücre
Bir hücre zincire şu durumda katılabilir: içerik kapsüldür, kafes **yoktur** ve kapsülün rengi zincir rengine eşittir **ya da** kapsül yıldız topudur (joker). Islak, fener, kafesli kapsül ve sabit engeller zincire katılamaz.

### 3.3 Yol oluşturma (girdi katmanı, çekirdek doğrular)
1. **Başlangıç.** Yalnız ilk `pointerId` izlenir. Parmak zincirlenebilir bir kapsüle basınca `P = [c0]` olur. Zincir rengi, P'deki ilk joker olmayan kapsülün rengidir. P'nin tamamı jokerse renk, bırakma anında tahtada en çok bulunan renktir (eşitlikte küçük indeks kazanır).
2. **Ekleme.** İşaretçi, son düğümün 8 komşusundan birinin merkezindeki **0,42·hücre** yarıçaplı daireye girerse ve o hücre zincirlenebilir, renge uygun ve P'de değilse P'ye eklenir.
   - Hızlı kaydırmada atlanan hücre olmasın diye önceki ve şimdiki işaretçi konumu arası **0,25 hücre** adımlarla örneklenir ve her örnek ayrı işlenir.
   - **Yapışma:** İşaretçi son düğümden **0,6 hücre** uzaklaşmış ama hiçbir daireye girmemişse, son düğümden işaretçiye giden vektöre açıca en yakın 8-komşu bulunur. Açı farkı ≤ 22,5° ise ve hücre uygunsa eklenir.
3. **Geri alma.** İşaretçi P[n−2]'nin dairesine girerse son düğüm silinir.
4. **Halka.** |P| ≥ 4 iken son düğüm P[0]'a 8-komşuysa ve işaretçi P[0]'ın dairesine girerse yol **halka** olur. Halka kapanınca düğüm eklenemez. P[n−1]'in dairesine geri dönmek halkayı açar.
5. **Bırakma.** |P| ≥ 3 ise (Usta kuralı `yalnizHalka` açıksa ayrıca halka olmalı) hamle geçerlidir; kalan hamle 1 düşer. |P| < 3 ise iptal edilir: hamle harcanmaz, ceza yoktur, hafif bir "fıs" sesi çalar. `pointercancel` da iptaldir.
6. Kesişen çapraz segmentler serbesttir.
7. **Yedek düğme `caprazSiniri`** (varsayılan `null`): sayıysa, yoldaki çapraz adım sayısı bu değeri aşamaz. Oyuncuya görünmediği için ana ve Usta bölümlerinde yasak (K21, 24 Ekim 2026); şemada, çekirdekte ve botta kalır.

**Çift dokunuş:** Aynı özel taşa 300 ms içinde, ≤ 0,3 hücre hareketle iki dokunuş. İlk dokunuşta "Ateşlemek için tekrar dokun" ipucu çıkar (bu ipucu 3 kez gösterildikten sonra bir daha çıkmaz).

### 3.4 "Eşleşme" kavramı ve kilitlenme algılama
FİTİL'de eşleşme, oyuncunun çizdiği geçerli yoldur; tahtada kendiliğinden eşleşme **aranmaz**. Algılama gereken tek yer kilitlenme testidir:

```
kilitliMi(d):
  tahtada özel taş varsa → false   (çift dokunuş her zaman geçerli hamledir)
  her renk c ∈ 0..n−1 için:
     G_c = {renk = c olan zincirlenebilir kapsüller} ∪ {yıldız topları}
     G_c üzerinde 8-komşulukla bağlı bileşenleri bul (BFS)
     boyutu ≥ 3 olan bileşen varsa → false
  → true
```
Bağlı ve en az 3 düğümlü her grafikte 3 düğümlü bir basit yol bulunur, bu yüzden test O(hücre) sürede yeter. `yalnizHalka` kuralında ayrıca en az bir 4'lü döngü aranır: her düğümden derinlik 3'e kadar DFS, başa dönüş varsa döngü vardır.

### 3.5 Çözümleme (resolve): ayrık olay simülasyonu
`hamleUygula(durum, hamle) → { durum', olaylar[] }` saf bir fonksiyondur. Yalnız tamsayı aritmetiği kullanır; `Math.random` ve `Date` yasaktır.

**Kuyruk:** min-yığın, anahtar `(t, y, x, sıra)`. `t` tik, `sıra` ekleme sayacıdır. Aynı anda olan patlamalar önce satıra (yukarıdan aşağı), sonra sütuna (soldan sağa), sonra eklenme sırasına göre işlenir. "Aynı anda birden çok eşleşme" sorusunun cevabı budur: hepsi bu sırayla işlenir ve sonuç tamamen belirlenimlidir.

**Bayraklar** (hamle başına sıfırlanır): `planli[i]`, `patladi[i]`, `kalkan[i]` (hamle başında herhangi bir kovaya dik komşu olan hücreler).

**İlke — ilk plan kazanır:** Bir hücre bir hamlede en fazla bir kez patlama için kuyruğa girer. Zaten `planli` olan bir hücreye yeni patlama planlanmaz. Bu sayede her hamle en fazla W·H patlamayla biter (sonlanma garantisi).

#### 3.5.1 Fitil hamlesi
```
n = |P|; renk = zincirRengi(P); carpan = halka ? 2 : 1
donusum = (!halka && n ≥ esikRoket && P[n−1] özel değil) ? P[n−1] : yok
kombo = P içindeki (dönüşüm hariç) ilk iki özel taş → (S1, S2) ya da yok
t = 0
for k = 0..n−1:
   if k > 0: t += max(35, 110 − 7·k)        // fitil hızlanır
   planli[P[k]] = true
   if P[k] == donusum: push(t, P[k], DONUSUM)
   else:               push(t, P[k], FITIL{k: k+1, nesil: 0, isiMiktari: carpan,
                                         yukle: P[k]==S1, kombo: P[k]==S2})
```
Örnek süreler: 6 düğüm 0→103→199→288→370→445 tik; 10 düğüm toplam 675 tik.

#### 3.5.2 Olay işleme
```
pop e; if patladi[e.hucre] ve e bir patlama türüyse: atla
FITIL / ISI / VURUS / IZ / DEVFISEK / FINAL:
   hücre içeriğine göre §3.5.3 (vuruş tablosu)
   içerik kapsülse → PATLAT(e)
DONUSUM: hücredeki kapsül özel taşa döner (tür n'ye göre, eksen son segmentten),
   isi = 0, patladi = true. Isı vermez, hasar vermez, sayılmaz.
ISI_DALGASI: hedef hücreye ISIT(+1) (patlama değildir)
IZ_ILERLE: barut izi adımı (§5)
DEVFISEK_ATES: dev fişek fırlar (§5)
```

**PATLAT(e)** (hücrede bir kapsül tahtadan ayrılırken):
1. `patladi = true`. Puan eklenir (§7). TOPLA hedefi renk sayacı +1 (yıldız topu yalnız "hepsi" sayacına girer). `isikIzi = true`.
2. Hücrede kafes varsa kırılır (`kafesKirildi`).
3. Zemin: döşeme kat −1; desen hücresi boyalı değilse ve (renk = desen rengi ya da patlayan kapsül yıldız topu) ise boyanır; iz hücresiyse ve yanmamışsa iz tutuşur.
4. Özel taşsa:
   - `e.yukle` ise etkisi bekletilir (`yuklendi` olayı).
   - `e.kombo` ise birleşik etki uygulanır (§4.4).
   - Diğer durumda kendi etkisi uygulanır (§4.2).
5. **Isı yayılımı:** 4 dik komşu `m` için `ISIT(m, miktar = e.isiMiktari ?? 1, kaynakNesil = e.nesil, t)`.
6. **Bitişik hasar:** 4 dik komşudaki sabit ve özel içeriğe bitişik etki uygulanır (vuruş tablosu "Bitişik" sütunu).
7. İçerik `null` olur.

**ISIT(m, miktar, g, t):**
```
m ısınabilir değilse (kafesli/kafessiz kapsül değilse) → çık
kalkan[m] ya da planli[m] ya da patladi[m] → çık
isi[m] += miktar; olay 'isindi'
isi[m] ≥ esik ise: planli[m] = true; push(t + 90, m, ISI{nesil: g+1, isiMiktari: 1})
```
Isıyla patlayan kapsül komşularına her zaman +1 verir. +2'yi yalnız halka zincirinin kendi düğümleri verir.

#### 3.5.3 Vuruş tablosu (bağlayıcı)
"Bitişik" = 4-komşuda bir kapsül patladı. "Vuruş" = özel etki, barut izi, dev fişek ya da final roketi hücreyi hedefledi.

| İçerik | Bitişik patlama | Vuruş | Isı alır mı |
|---|---|---|---|
| Kapsül | Etki yok (yalnız ısı) | Patlar | Evet |
| Kafesli kapsül | Etki yok (yalnız ısı) | Kafes kırılır, kapsül patlar | Evet; eşikte kafes kırılır ve kapsül patlar |
| Islak | Kurur → kapsül {aynı renk, ısı 0} | Kurur | Hayır |
| Fener | — | — | Hayır |
| Kaya | −1 kat (0'da kalkar) | −1 kat | Hayır |
| Kova | −1 kat | −1 kat | Hayır (kalkan verir) |
| Dev fişek | +1 dolum | +1 dolum | Hayır |
| İs | Temizlenir | Temizlenir | Hayır |
| Boş / delik | — | — | — |

- Yalnız **kapsül patlamaları** komşu ısıtır ve bitişik hasar verir. Engel vuruşu komşulara yayılmaz.
- Planlı bir kapsüle gelen vuruş yok sayılır (ilk plan kazanır). Planlı olmayan kapsüle gelen vuruş, o anki zaman ve vuruşu yapan etkinin nesliyle patlama olarak işlenir.

#### 3.5.4 Kuyruk boşalınca (hamle sonu sırası)
1. **Yerçekimi ve doldurma** (§3.6).
2. **Fener toplama:** çıkış yuvasındaki fenerler toplanır. Toplanan olduysa 1. adıma dönülür (en fazla 10 tur).
3. **İs yayılması** (yalnız `fitil` / `ciftDokunus` hamlelerinde): bu hamlede hiç is temizlenmediyse ve tahtada is varsa yayılır (§5).
4. **Hava olayları** (yalnız `fitil` / `ciftDokunus`): sayaçlar −1, sıfıra inen tetiklenir (§5).
5. **Körük:** bu eylemdeki ISI patlaması sayısı kadar dolum (kapasitede durur).
6. **Hedef kontrolü:** hepsi tamamsa `bitti = kazanc` → Final Gösterisi (§7.3). Değilse ve kalan hamle = 0 ise `bitti = kayip`.
7. **Kilitlenme:** bölüm bitmediyse ve `kilitliMi` doğruysa karıştırma yapılır (§3.8).
8. İstatistik olayı `reaksiyon` yazılır (§12.4).

### 3.6 Yerçekimi ve doldurma
- **Yön aşağıdır.** Sütunlar soldan sağa işlenir.
- Her sütun için yuva listesi `S` aşağıdan yukarıya, delik ve sabit hücreler (kaya, kova, dev fişek, is, kafesli kapsül) atlanarak oluşturulur.
- `S`'deki hareketli içerikler sıraları korunarak `S`'nin başına (aşağıya) sıkışır. Sabit hücrelerin "arkasından geçerler".
- `S`'nin üstte kalan boş yuvaları aşağıdan yukarıya, oyun RNG'siyle doldurulur: `renk = agirlikliSec(dogumAgirliklari)`. Yeni kapsülün ısısı 0'dır.
- **Fener doğumu:** `fenerDogum.kalan > 0` ve sahadaki fener < `sahadaEnFazla` ise, bu turda dolum alan sütunlar arasından `rngInt(sütunSayısı)` ile bir sütun seçilir ve o sütunun en üst dolum yuvasına kapsül yerine fener konur. Tur başına en fazla 1 fener doğar.
- **Yardım n** (`yardim`, yalnız 1–20. bölümler): Doldurmadan sonra tahtada boyutu ≥ 4 olan zincirlenebilir aynı renk bileşen yoksa, bu turda doğan kapsüller aynı sırayla ve aynı RNG akışından yeniden çekilir. En fazla n kez. Çekilen değer akışta tüketilmiş sayılır, böylece belirlenimlilik korunur.
- Olay: `yercekimi { dusenler[{den, e}], doganlar[{hucre, icerik, sanalY}] }`. `sanalY` canlandırma için tahta üstündeki başlangıç satırıdır (−1, −2…).

### 3.7 Kaskad (zincirleme)
FİTİL'de kaskad yalnız ısıdan ve özel etkilerden gelir. **Düşen taşlar asla kendiliğinden patlamaz.** Zincirleme reaksiyon tümüyle §3.5'teki kuyruk içinde çözülür; yerçekimi yalnız kuyruk boşaldıktan sonra bir kez çalışır.

**Nesil:** fitil düğümleri ve çift dokunulan özel taş 0. nesildir. Isıyla patlayan kapsül, onu eşiğe taşıyan patlamanın nesli +1'dir. Özel etkiyle patlayanlar etkiyi tetikleyen patlamanın neslini alır.

### 3.8 Karıştırma
Konumlar: kafessiz kapsül (özel dahil) bulunan hücreler; içerikleri ısıları ve özellikleriyle birlikte Fisher–Yates ile oyun RNG'sinden karıştırılır. Fener ve ıslak yerinde kalır.
1. Sonuç kilitliyse en fazla 20 kez tekrarlanır.
2. Hâlâ kilitliyse düz kapsüller (y, x) sırasıyla dolaşılır ve rengi `rngInt(n)` ile yeniden çekilir (ısı korunur). Kilit kalkınca durulur.

Olay `karistirma { esleme[] }` yazılır; ekranda "Sandık sallanıyor…" çıkar. Hamle harcanmaz.

### 3.9 Çizerken önizleme
`onizle(durum, P, halka) → { esikHucreler[], ozelHayalet?, etkiAlanlari[] }`
- **esikHucreler:** Yalnız yol düğümlerinin patlamalarından gelecek ısı (halkada +2) eklendiğinde eşiğe ulaşacak, yol dışındaki ısınabilir hücreler. Kalkan dikkate alınır. Yalnız ilk dalga hesaplanır; ikinci ve sonraki dalgalar gösterilmez, sürpriz korunur.
- **ozelHayalet:** dönüşüm oluşacaksa tür ve eksen.
- **etkiAlanlari:** yoldaki mevcut özel taşların etki hücreleri (kesik çizgiyle gösterilir).
- Maliyet O(|P|). Her `pointermove` örneğinde çağrılır.

---

## 4. Özel taşlar

### 4.1 Oluşum
Halka olmayan, geçerli bir zincirde son düğüm patlamaz, zincir renginde özel taşa dönüşür (ısı 0). Son düğüm zaten özel taşsa dönüşüm olmaz; o taş normal biçimde tetiklenir.

| Uzunluk n | Özel taş | Varsayılan eşik (`ozelEsikleri`) |
|---|---|---|
| 6–8 | ROKET (eksen = son segment) | 6 |
| 9–11 | KASIMPATI | 9 |
| ≥ 12 | YILDIZ TOPU (renksiz joker, `renk = −1`) | 12 |

`ozelEsikleri: [r, k, y]` alanında 0 değeri o türü kapatır. Bölüm 1'de `[0,0,0]`, 2–5'te `[6,0,0]`, 6–11'de `[6,9,0]`, 12'den sonra `[6,9,12]`. Ana ve Usta bölümlerinde her öğe ya 0 ya da tablodaki standart eşiktir; başka değer oyuncuya görünmeyen kural sayılır (K21, 24 Ekim 2026).

**Halka** bir taş değil, bir çizim biçimidir: özel taş oluşturmaz, zincirin bütün düğüm patlamaları komşularına +2 ısı verir. +100 puan getirir ve HALKA hedefini sayar.

### 4.2 Etkiler (T = tetiklenme anı, g = nesil)
- **ROKET (eksen a):** a ekseninin iki yönünde, d = 1, 2, … tahta kenarına kadar her hücreye `push(T + 25·d, VURUS{g})`. Delikler atlanır. Engeller hasar alır ve roket yoluna devam eder.
- **KASIMPATI:**
  - Chebyshev uzaklığı 1 olan 8 hücreye `push(T + 30, VURUS{g})`.
  - Uzaklığı 2 olan 16 hücreye `push(T + 60, ISI_DALGASI)`: ısınabilir hücreye +1 ısı (kalkan ve planlı kuralı geçerli). Engellere hasar vermez.
- **YILDIZ TOPU (hedef renk c):** Kafesli dahil, rengi c olan ve planlı olmayan bütün kapsüller `(dx²+dy², y, x)` sırasına dizilir. i. hücre `T + 20·(i+1)` anında VURUS alır. Hedef renk şöyle belirlenir:
  - zincirdeyse zincir rengi;
  - zincir dışından tetiklendiyse o hamlenin zincir rengi;
  - hamle zincir değilse (çift dokunuş, kibrit, körük, final) tahtada en çok bulunan renk (eşitlikte küçük indeks).

### 4.3 Tetiklenme yolları ve sırası
1. Aynı renk bir zincire katılır ve fitil ona ulaşır.
2. Isısı eşiğe ulaşır (özel taşlar da ısınır).
3. Bir vuruş hücresine gelir.
4. Çift dokunulur (1 hamle; t = 0, g = 0).

Tetiklenme anında görsel olarak 50 ms durma (hit-stop) olur; bu yalnız görseldir, kural zamanını etkilemez. Zincir dışındaki tetiklemeler birleşmez; her biri kendi etkisini uygular.

### 4.4 Kombinasyonlar (yalnız aynı zincirde)
Yol sırasında karşılaşılan **ilk iki** mevcut özel taş (S1, S2) birleşir.
- Fitil S1'e varınca S1 normal bir düğüm gibi patlar (sayılır, ısıtır, puan alır), ama etkisi yüklenir: taş havalanıp fitili izler.
- Fitil S2'ye varınca S2 patlar ve birleşik etki **S2 hücresinde** T anında başlar.
- Yoldaki üçüncü ve sonraki özel taşlar ayrı ayrı tetiklenir.

| Çift | Ad | Etki |
|---|---|---|
| Roket + Roket | YILDIZ HATTI | S2'den 4 eksenin hepsi (8 yön), her hücre T + 25·d anında VURUS |
| Roket + Kasımpatı | KALIN ROKET | Roketin ekseninde 3 hücre genişliğinde şerit. Yatayda y−1, y, y+1 satırları; dikeyde x−1, x, x+1 sütunları; çaprazda (x−1, y), (x, y), (x+1, y) noktalarından geçen üç paralel çapraz. Her hücre T + 25·d anında (d = eksen boyunca uzaklık) VURUS |
| Kasımpatı + Kasımpatı | DEV KASIMPATI | Chebyshev ≤ 2 hücreler T + 30·d anında VURUS; d = 3 halkasına T + 90 anında +1 ısı |
| Yıldız + Roket | ROKET YAĞMURU | Zincir rengindeki planlı olmayan bütün kapsüller (y, x) sırasıyla rokete döner, i. roketin ekseni i mod 4. i. roket T + 40·(i+1) anında tetiklenir (kendi hücresi patlar ve roket etkisi işler) |
| Yıldız + Kasımpatı | BAHÇE | Zincir rengindeki bütün kapsüller kasımpatıya döner; uzaklık sırasıyla T + 40·(i+1) anında tetiklenir |
| Yıldız + Yıldız | BÜYÜK FİNAL | Delik dışındaki bütün hücreler S2'den Chebyshev halkaları halinde, T + 40·d anında VURUS alır. Engeller 1 hasar alır |

Aynı türün kendisiyle birleşimi tabloda yer alır; toplam 6 çift. Joker (yıldız topu) olan çiftlerde "zincir rengi" §4.2'deki kurala uyar.

---

## 5. Engeller ve çevre öğeleri

| Öğe | Kod | Katman | Hareket | Zincir | Isı | Hasar / davranış | Tanıtım |
|---|---|---|---|---|---|---|---|
| Kafes | `C` | 1 | Sabit (kapsülü tutar) | Hayır | Kapsül ısınır | Eşikte ya da vuruşla kapsülüyle birlikte patlar. Bitişik patlama yalnız ısıtır | 4 |
| Islak barut | `W` | 1 | Hareketli | Hayır | Hayır | Bitişik patlama ya da vuruş → normal kapsül (ısı 0). Hedefe sayılmaz | 7 |
| Fener | `F` | — | Hareketli | Hayır | Hayır | Hiçbir şeyden etkilenmez. Çıkış yuvasına ulaşınca toplanır (+200) | 11 |
| Kaya | `K1..K3` | 1–3 | Sabit | — | Hayır | Bitişik patlama ve vuruş başına −1 kat. Kat başına 20 puan, yok oluşta +50 | 13 (1 kat), 15 (2–3 kat) |
| Dev fişek | `D` / `D4` | Dolum 0/N (N varsayılan 5) | Sabit | — | Hayır | Bitişik patlama ve vuruş başına +1. N'ye ulaşınca t + 150'de fırlar: üstündeki hücreler y' < y için t + 150 + 30·(y−y') anında VURUS alır, sonra dev fişek kalkar (+300) | 16 |
| Su kovası | `S` / `S1` | 2 (ya da 1) | Sabit | — | Hayır | Kaya gibi kırılır. **Kalkan:** hamle başında bir kovaya dik komşu olan hücreler o hamle boyunca hiçbir kaynaktan ısı alamaz | 18 |
| Barut izi | zemin | — | — | — | — | Sıralı hücre dizisi (ardışık hücreler 8-komşu). İz hücresinde patlama ya da vuruş olursa iz o indeksten iki yöne, adım başına 60 tik ilerleyerek yanar ve her iz hücresine VURUS verir. Her hücre bir kez yanar | 21 |
| Delik | `#` | — | — | — | — | Tahta şekli. Yerçekimi atlar, roket üzerinden geçer | 23 |
| Döşeme (2 kat) | zemin | 1–2 | — | — | — | Hücresindeki her kapsül patlaması −1 kat | 9 (1 kat), 24 (2 kat) |
| Desen döşemesi | zemin | 1 | — | — | — | Hücresinde desen renginde (ya da yıldız topu) kapsül patlayınca kalıcı olarak boyanır | 26 |
| İs | `I` | 1 | Sabit | — | Hayır | Bitişik patlama ya da vuruş temizler (+30). **Yayılma:** hamlede hiç is temizlenmediyse, ise dik komşu düz kapsüller (özel olmayan, kafessiz) (y, x) sırasına dizilir ve `rngInt` ile biri ise döner (ısısı kaybolur). Hamle başına en fazla 1 | 31 |
| Hava olayı: Meltem | veri | Sayaç | — | — | — | Periyot sonunda bir satırdaki ısınabilir kapsüllere +1 ısı verir, ama en fazla eşik−1'e kadar. **Tutuşturmaz.** Kalkan geçerlidir | 29 |
| Hava olayı: Çisenti | veri | Sayaç | — | — | — | Periyot sonunda bir satırdaki bütün kapsüllerin ısısını 0 yapar | 33 |

**Hava olayı verisi:** `{ tur: 'meltem'|'cisenti', eksen: 'satir'|'sutun', hatlar: [3, 5, 1], periyot: 4, baslangic: 4 }`.
- Sayaç her `fitil` / `ciftDokunus` hamlesi sonunda −1 iner. 0'da sıradaki hat tetiklenir (`hatlar` döngüsel kullanılır) ve sayaç `periyot` değerine döner.
- Sayaç 1 olduğunda o hat **titrer**: kenarda bulut ya da rüzgâr ikonu ve kesik çizgili bir şerit görünür. Oyuncu bir hamle önceden haberdar olur.

**Fener çıkışı:** `cikislar` alanı (varsayılan: bütün sütunlar). Çıkış yuvası, sütunun deliksiz en alt hücresidir. Fener ancak o hücreye ulaşırsa toplanır. Hücrede sabit engel varsa fener, engel yok olana kadar toplanamaz. Doğrulayıcı, kırılabilir engeller kalkınca her fenerin bir çıkışa ulaşabildiğini statik olarak denetler.

**Yedek düğme `soguma`** (varsayılan 0 = kapalı): k > 0 ise her k hamlede bir, tahtadaki bütün ısılar 1 azalır.

---

## 6. Bölüm hedefleri

Bölümde en fazla 3 hedef bulunur. Her bölümde ayrıca puan yıldızları vardır.

| # | Tür (`tur`) | Tanım | İlerleme sayımı |
|---|---|---|---|
| 6.1 | `topla` `{renk: 0..5 \| 'hepsi', adet}` | Belirtilen renkte N kapsül patlat | Nasıl patladığı fark etmez. Dönüşüm ve kuruma sayılmaz. Yıldız topu yalnız 'hepsi' sayacına girer |
| 6.2 | `kafes` | Bütün kafesleri kır | Kalan kafes sayısı |
| 6.3 | `kaya` | Bütün kayaları yok et | Kalan kaya sayısı. HUD'da kat toplamı küçük yazılır |
| 6.4 | `fener {adet}` | N feneri indir | Toplanan / N |
| 6.5 | `aydinlat` | Bütün döşemeleri söndür (aydınlat) | Kalan kat toplamı |
| 6.6 | `desen {motif}` | Işık Deseni: bütün desen hücrelerini boya | Boyalı / toplam. Tamamlanınca motif haritaya asılır |
| 6.7 | `devFisek {adet}` | N dev fişeği ateşle | Ateşlenen / N |
| 6.8 | `is` | Bütün is hücrelerini temizle | Kalan is. Yayılmayla artabilir |
| 6.9 | `zincirleme {esik, adet}` | Tek hamlede R ≥ eşik reaksiyonu N kez yap | R = o hamlede fitil düğümü olmayan kapsül patlamaları |
| 6.10 | `halka {adet}` | N halka çiz | Bırakılan geçerli halkalar |
| 6.11 | `puan {puan}` | Puana ulaş (yalnız öğretim ve Usta) | Puan |

**İlerleme yüzdesi** (kayıp ekranı ve yakın kaçış için): `%İ = ortalama(min(1, ilerleme_i / hedef_i))`. Kayıp ekranında en düşük ilerlemeli hedefin kalanı gösterilir ("3 kızıl kaldı").

**Körük Göstergesi** bir hedef değil, bölüm aracıdır.
- Kapasite `korukKapasitesi` (0 = kapalı; 17. bölümde 15, sonrasında varsayılan 20).
- Her ISI patlaması +1 doldurur. Taşan dolum kaybolur.
- Doluyken oyuncu hamleler arasında göstergeye dokunur, sonra bir merkez hücre seçer (seçim iptal edilebilir).
- Etkisi: Chebyshev ≤ 1 olan ısınabilir kapsüllere t = 0'da +1 ısı. Eşiğe ulaşanlar t = 90'da 1. nesil olarak patlar ve çözümleme olağan biçimde sürer. Dolum 0 olur.
- Hamle harcamaz. Hamle sonu adımlarından 3. (is) ve 4. (hava) uygulanmaz.

---

## 7. Puanlama

### 7.1 Taban puanlar
| Olay | Puan |
|---|---|
| Fitil düğümü, k. sırada (1'den başlar) | 10·k (n düğüm toplamı 5·n·(n+1): 6 düğüm → 210, 12 düğüm → 780) |
| Isı patlaması, nesil g ≥ 1 | 20·g |
| Vuruşla patlayan kapsül (özel, iz, dev fişek, final) | 15 |
| Özel taş oluşumu | Roket 60, Kasımpatı 120, Yıldız topu 200 |
| Kombinasyon | Yıldız Hattı 300, Kalın Roket 300, Dev Kasımpatı 400, Roket Yağmuru 600, Bahçe 600, Büyük Final 1000 |
| Halka kapatma | 100 |
| Engel katı | 20 / kat; kaya, kova ya da is tamamen kalkınca +50 |
| Kafes kırılması | 50 |
| Döşeme katı | 20 |
| Desen hücresi boyanması | 40 |
| Fener toplama | 200 |
| Dev fişek ateşlenmesi | 300 |

### 7.2 Zincir ve kombo çarpanları
- **Zincir içi:** düğüm sırası k doğrusal artar, toplam karesel büyür. Uzun zincir ödüllenir.
- **Isı kaskadı:** nesil g, patlama puanını çarpar (20·g).
- **Reaksiyon bonusu** (hamle başına R): R ≥ 8 → +100 "Güzel!", R ≥ 15 → +300 "Harika!", R ≥ 25 → +600 "Muhteşem!", R ≥ 40 → +1200 "ŞENLİK!" (yalnız en yüksek kademe verilir).

### 7.3 Final Gösterisi (bölüm sonu bonusu)
Kazanınca kalan hamle sayısı m olsun.
1. i = 0..m−1 için düz kapsüller (y, x) sırasına dizilir. `rngInt` ile biri seçilir, `rngInt(4)` eksenli rokete döner ve t = 120·i anında tetiklenir. Kuyruk olağan biçimde çözülür.
2. Yerçekimi ve doldurma çalışır.
3. Tahtadaki bütün özel taşlar (y, x) sırasıyla 80 tik arayla tetiklenir. Yeni özel taş kalmayana kadar en fazla 5 tur tekrarlanır.
4. Kalan her hamle için ayrıca +100.

Bütün patlamalar §7.1'e göre puanlanır. Oyuncu dokunarak gösteriyi 4× hızlandırabilir; sonuç değişmez.

### 7.4 Yıldızlar
- **1★:** bütün hedefler tamam.
- **2★ / 3★:** Usta botun 500 tohumluk kalibrasyonunda **kazandığı** oyunların (final dahil) puan dağılımının **medyanı** ve **85. yüzdeliği**, aşağı doğru 100'e yuvarlanır. Bölüm verisinde `yildizEsikleri: [p50, p85]` olarak durur ve `npm run kalibre` ile üretilir. İstisnalar: öğretim bölümleri (1–5) gündelik oyuncuya göre elle seçilir (K22, `elleEsik`); 6–25'te 2★ = min(Usta p50, Acemi kazançlarının p50'si), 3★ yine Usta p85 (K24, `esikKurali: "k24"`, `npm run kalibre -- --kural k24`).
- Bölümde güçlendirici kullanılmışsa en fazla 2★ alınır. "Kıvılcım Usta'nın Eli" kullanılmışsa en fazla 1★.

---

## 8. Bölüm veri biçimi ve ilk 40 bölüm

### 8.1 JSON şeması
Anahtarlar ASCII'dir. Türkçe karakterli anahtar kullanılmaz, böylece kod ergonomisi ve sıkıştırma güvenli kalır.

```ts
interface BolumVerisi {
  id: number;                    // 1..40, Usta: 101..108, gunluk: yyyymmdd
  ad: string;                    // "İlk Kıvılcım"
  mahalle: 0..7;
  tur: 'ogretim'|'tanitim'|'normal'|'zor'|'rahatlama'|'final'|'usta'|'gunluk';
  w: number; h: number;          // 5..8, 6..10
  renkSayisi: 3..6;
  esik: 2..5;                    // varsayılan 4
  hamle: 12..30;
  tohum: number;                 // uint32, ilk tahta
  yardim: 0..3;                  // yalnız id ≤ 20 için > 0
  ozelEsikleri: [number, number, number];   // varsayılan [6,9,12]
  dogumAgirliklari?: number[];   // renk başına tamsayı ağırlık, varsayılan eşit
  hedefler: Hedef[];             // 1..3
  duzen: string[];               // H satır, her satırda boşlukla ayrılmış W simge
  sabitKapsuller?: { x:number; y:number; renk:number; ozel?:'roket'|'kasimpati'|'yildiz'; eksen?:0|1|2|3; isi?:number }[];
  onIsi?: [x:number, y:number, isi:number][];
  zemin?: {
    dosemeler?: [x:number, y:number, kat:1|2][];
    desen?: { motif: 'lale'|'kayik'|'mart'|'fener'|'carkifelek'|'burc'; hucreler: [x:number, y:number, renk:number][] };
    barutIzleri?: [x:number, y:number][][];
  };
  fenerDogum?: { kalan: number; sahadaEnFazla: number };
  cikislar?: number[];           // fener çıkış sütunları
  devFisekKapasite?: number;     // varsayılan 5
  havaOlaylari?: { tur:'meltem'|'cisenti'; eksen:'satir'|'sutun'; hatlar:number[]; periyot:number; baslangic:number }[];
  korukKapasitesi?: number;      // 0 = kapalı
  kurallar?: { dortKomsu?: boolean; yalnizHalka?: boolean; gizliIsi?: boolean; caprazSiniri?: number|null; soguma?: number };
  bayram?: boolean;              // reaksiyon üst bandından muaf
  botBandi: [min:number, max:number];   // Usta kazanma oranı (%)
  yildizEsikleri: [number, number];     // kalibrasyon çıktısı
  elleEsik?: boolean;            // K22: eşikler elle (öğretim); kalibre yazmaz
  esikKurali?: 'k24';            // K24: 2★ = min(Usta p50, Acemi p50), 3★ = Usta p85 (6–25)
  ipuclari?: { tetik:'baslangic'|'ilkHamleSonrasi'|'bosta5sn'|'kisaYol'|'kazanc'; metin:string; el?: [x:number,y:number][] }[];
  sonrakiTanitim?: string;       // "Sıradaki: Fener!"
}
```

**`duzen` simgeleri** (her hücre bir simge, aralarında tek boşluk):

| Simge | Anlam |
|---|---|
| `.` | Rastgele kapsül (renk ve özellik `sabitKapsuller` ile ezilebilir) |
| `#` | Delik |
| `K1` `K2` `K3` | Kaya (kat) |
| `S` / `S1` | Kova (2 / 1 kat) |
| `D` / `D4` | Dev fişek (varsayılan kapasite / 4) |
| `C` | Kafesli kapsül (renk rastgele ya da `sabitKapsuller`'den) |
| `W` | Islak barut (renk rastgele ya da `sabitKapsuller`'den) |
| `F` | Fener |
| `I` | İs |

**İlk tahta üretimi** (yalnız `tohum` akışı; her denemede aynıdır):
1. `.`, `C` ve `W` hücreleri satır satır, soldan sağa ağırlıklı renkle doldurulur.
2. Seçilen renk 8-komşulukta boyutu 10'dan büyük bir bileşen yaratıyorsa renk en fazla 5 kez yeniden çekilir.
3. `sabitKapsuller` ve `onIsi` uygulanır.
4. Tahta kilitliyse karıştırma yapılır (yine `tohum` akışından).

**Oyun akışı tohumu:** `oyunTohumu = mulberry32(tohum ^ Math.imul(denemeNo + 1, 0x9E3779B9))()`. Dolum, karıştırma, is yayılması ve final bu akıştan beslenir. Plan öğrenilebilir, her deneme tazedir.

**Örnek (Bölüm 10, "Çarşı Gecesi"):**
```json
{
  "id": 10, "ad": "Çarşı Gecesi", "mahalle": 1, "tur": "zor",
  "w": 7, "h": 9, "renkSayisi": 5, "esik": 4, "hamle": 24, "tohum": 1938274011,
  "yardim": 2, "ozelEsikleri": [6, 9, 0],
  "hedefler": [ { "tur": "aydinlat" }, { "tur": "kafes" } ],
  "duzen": [
    ". . . . . . .",
    ". C . . . C .",
    ". . . . . . .",
    ". . . C . . .",
    ". . . . . . .",
    ". C . . . C .",
    ". . . . . . .",
    ". . . . . . .",
    ". . . . . . ."
  ],
  "zemin": { "dosemeler": [[0,6,1],[1,6,1],[2,6,1],[3,6,1],[4,6,1],[5,6,1],[6,6,1],
                           [0,7,1],[1,7,1],[2,7,1],[3,7,1],[4,7,1],[5,7,1],[6,7,1],
                           [0,8,1],[1,8,1],[2,8,1],[3,8,1],[4,8,1],[5,8,1],[6,8,1],
                           [2,2,1],[3,2,1],[4,2,1],[2,4,1],[3,4,1],[4,4,1],[3,3,1],
                           [1,3,1],[5,3,1]] },
  "onIsi": [[1,1,1],[5,1,1],[3,3,2],[1,5,1],[5,5,1]],
  "botBandi": [45, 55],
  "yildizEsikleri": [5200, 7400],
  "sonrakiTanitim": "Sıradaki: Fener Alayı!"
}
```

### 8.2 Tür bantları (Usta bot kazanma oranı)
| Tür | Bant | Not |
|---|---|---|
| Öğretim (1–5) | ≥ %92–98 | Acemi bot ≥ %80 |
| Tanıtım | %85–95 | Yeni öğenin ilk bölümü |
| Normal | %65–85 | |
| Zor (her mahallenin 5.'si) | %45–55 | |
| Rahatlama | ≥ %90 | `bayram: true` olabilir |
| Final (40) | %40–50 | |

Hiçbir bölüm %35'in altına inemez. 100 tohumda en az 1 kazanç zorunludur.

### 8.3 İlk 40 bölüm planı
Sütunlar: **R** renk sayısı, **E** eşik, **H** hamle, **Y** yardım, **Bot** Usta kazanma hedefi (%).

**Mahalle 1 — İSKELE** (ahşap iskele, kayıklar; gökyüzü teması "Ay Işığı")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | İlk Kıvılcım | 5×6 düz. Alt sırada 4 kızıl, üstünde 1 kızgın kehribar | 3 | 4 | 12 | 3 | 25 kapsül (hepsi) | Çizim, bırakma, ısı tadı; özel kapalı | Ö | ≥98 |
| 2 | Çapraz Yol | 6×7. Altta 6'lık gök zikzak, son adımı yatay | 4 | 4 | 15 | 3 | 15 gök + 15 kızıl | Çapraz bağlantı, roket | Ö | ≥97 |
| 3 | Isınma | 6×8. Ortada kızgın sıra, altında 4 kehribar | 4 | 4 | 15 | 3 | 35 kapsül | Isı kuralı, kızgınlık, kalıcı ısı | Ö | ≥97 |
| 4 | Sar ve Pişir | 7×8. 3 kafes (ön ısı 1), her birinin çevresinde aynı renk U | 4 | 4 | 18 | 3 | 3 kafes | Kafes, U ile sarma | Ö | ≥95 |
| 5 | Nişan | 7×8. Bir köşegen üstünde 4 kafes, 6'lık zümrüt yol köşegende bitiyor | 4 | 4 | 20 | 3 | 4 kafes | Çapraz roket nişanı; yıldızlar, final, ilk sandık | Ö | ≥92 |

**Mahalle 2 — ÇARŞI** (kubbeler, kandiller; "Lale Moru")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | Kasımpatı | 7×8. Sabit 9'luk zümrüt yılan | 5 | 4 | 20 | 2 | 30 zümrüt + 30 mor | Kasımpatı (9) | T | 90–95 |
| 7 | Islak Barut | 7×9. Ortada 14 ıslak kapsül bloğu | 5 | 4 | 22 | 2 | 35 kızıl + 30 gök | Islak barut | T | 85–95 |
| 8 | Halka | 7×8. İki adet 2×2 kehribar kare hazır | 5 | 4 | 20 | 2 | 4 halka + 30 kehribar | Halka (+2 ısı) | T | 85–95 |
| 9 | Işıklı Sokak | 7×9. Döşemeler bir "sokak" çizer (dikey şerit ve kavşak) | 5 | 4 | 22 | 2 | 26 döşeme | Döşeme / AYDINLAT | T | 85–95 |
| 10 | Çarşı Gecesi | 7×9. Alt 3 satır döşeme, ortada artı biçimli döşeme, 5 kafes | 6 (K21) | 4 | 24 | 2 | Aydınlat 30 + 5 kafes | — | Z | 45–55 |

**Mahalle 3 — LİMAN** (vinçler, gemiler; "Deniz Mavisi")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 11 | Fener Alayı | 7×9. Üstte 2 fener; `fenerDogum {kalan:1, sahadaEnFazla:2}` | 5 | 4 | 20 | 1 | 3 fener | Fener | T | 85–95 |
| 12 | Yıldız Topu | 8×9. Sabit 12'lik gök yolu | 4 | 4 | 20 | 1 | 40 kızıl + 40 gök | Yıldız topu (12) | T | 90–95 |
| 13 | Kayalık | 7×9. Ortada 14 tek katlı kaya kümesi | 5 | 4 | 22 | 1 | Bütün kayalar | Kaya (1 kat) | T | 85–95 |
| 14 | Çifte Roket | 7×9. Yan yana iki kızıl roket ve iki kızıl kapsül, 10 kaya (1–2 kat) | 5 | 4 | 20 | 1 | Bütün kayalar | Kombinasyon öğretimi | T | 85–95 |
| 15 | Liman Fırtınası | 8×9. 12 kaya (2–3 kat) fenerlerin yolunu kesiyor | 5 | 4 | 25 | 1 | Bütün kayalar + 3 fener | — | Z | 45–55 |

**Mahalle 4 — SAAT KULESİ** (kule, kadran; "Bakır Saat")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 16 | Dev Fişek | 7×9. Alt sırada 3 dev fişek (N=5) | 5 | 4 | 22 | 1 | 3 dev fişek | Dev fişek | T | 85–95 |
| 17 | Körük | 7×9. Tahtanın %30'u ön ısılı (1–2), Körük kapasitesi 15 | 5 | 4 | 22 | 1 | 50 kehribar + 40 mor | Körük Göstergesi, ön ısı | T | 85–95 |
| 18 | Su Kovası | 7×9. 6 kafes, her birinin yanında 1 kova | 5 | 4 | 24 | 1 | 6 kafes | Su kovası | T | 80–90 |
| 19 | Kuru Gece | 8×9 düz | 5 | 3 | 20 | 1 | Zincirleme: 3 kez 15+ | Eşik 3 bayramı, `bayram` | R | ≥90 |
| 20 | Gece Yarısı | 8×9. Saat kadranı biçiminde kafes halkası, 4 dev fişek | 5 | 4 | 25 | 1 | 4 dev fişek + 8 kafes | — | Z | 45–55 |

**Mahalle 5 — BAHÇELER** (çardak, ateş böcekleri; "Ateş Böceği")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 21 | Barut İzi | 7×9. İki S biçimli iz döşemelerden geçiyor | 5 | 4 | 22 | 0 | 30 döşeme | Barut izi | T | 85–95 |
| 22 | Altı Renk | 7×9 düz | 6 | 4 | 25 | 0 | 35 zümrüt + 35 gül + 20 mor | 6 renk | N | 70–80 |
| 23 | Lale Tarhı | 8×9 lale biçimli (12 delik) | 5 | 4 | 22 | 0 | 40 gül + 8 kaya | Delikli tahta | N | 70–80 |
| 24 | Çift Kat | 7×9. 28 döşemenin 14'ü 2 katlı | 5 | 4 | 24 | 0 | 28 döşeme | 2 katlı döşeme | N | 65–80 |
| 25 | Bahçe Duvarı | 8×9. Duvar gibi kaya şeridi, arkasında 2 katlı döşeme | 6 | 4 | 26 | 0 | 30 döşeme + 4 fener | — | Z | 45–55 |

**Mahalle 6 — TEPE** (yel değirmeni, rasathane; "Yıldız Yağmuru")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 26 | Lale Deseni | 7×9. 18 desen hücresi: 10 gül taç, 8 zümrüt sap | 5 | 4 | 24 | 0 | Desen: Lale | Işık Deseni | T | 85–90 |
| 27 | Nemli Gece | 7×9. 6 kafes | 5 | 5 | 22 | 0 | 50 gök + 6 kafes | Eşik 5 (4 köz yuvası) | N | 65–80 |
| 28 | Kova Bulmacası | 8×9. 8 kafes, kovalar ısı yolunu kesiyor | 5 | 4 | 25 | 0 | 8 kafes | Kova + kafes birlikte | N | 65–80 |
| 29 | Meltem | 7×9. Meltem: satırlar [6, 3, 7], periyot 3 | 5 | 4 | 20 | 0 | 50 kızıl + 50 kehribar | Meltem (yardımcı) | R | ≥90 |
| 30 | Tepe Şenliği | 8×10. 20 hücreli kayık deseni, 3 dev fişek | 6 | 4 | 28 | 0 | Desen: Kayık + 3 dev fişek | — | Z | 45–55 |

**Mahalle 7 — FABRİKA** (bacalar, barut deposu; "Kızıl Duman")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 31 | İs | 7×9. Ortada 12 is | 5 | 4 | 22 | 0 | Bütün is | İs | T | 85–90 |
| 32 | Bacalar | 8×9. 16 is "baca" sütunlarında, 3 dev fişek | 5 | 4 | 25 | 0 | Bütün is + 3 dev fişek | — | N | 65–80 |
| 33 | Çisenti | 7×9. Çisenti: satırlar [4, 2, 6], periyot 4 | 5 | 4 | 22 | 0 | 8 kafes + 20 döşeme | Çisenti | T | 80–90 |
| 34 | Kuru Gece II | 8×9 düz | 5 | 3 | 18 | 0 | Zincirleme: 2 kez 25+ | `bayram` | R | ≥90 |
| 35 | Fabrika Yangını | 8×10. 14 is, 8 kaya (2–3 kat), Çisenti periyot 3 | 6 | 4 | 24 | 0 | Bütün is + bütün kayalar | Dar hamle bütçesi | Z | 45–55 |

**Mahalle 8 — KALE** (surlar, burçlar; "Altın Şafak")

| # | Ad | Izgara / şekil fikri | R | E | H | Y | Hedef | Yeni öğe | Tür | Bot |
|---|---|---|---|---|---|---|---|---|---|---|
| 36 | Kale Kapısı | 8×10. Kemer biçimli 16 kaya (1–3 kat) | 5 | 4 | 26 | 0 | Bütün kayalar + 4 fener | Karışık | N | 65–80 |
| 37 | Barut Deposu | 8×10. Barut izleri 5 dev fişeği zincirleme bağlıyor | 5 | 4 | 26 | 0 | 5 dev fişek | Domino düzeneği | N | 65–80 |
| 38 | Sur Feneri | 8×10 sur biçimli (8 delik). 22 hücreli fener deseni, 6 kafes | 6 | 4 | 26 | 0 | Desen: Fener + 6 kafes | — | N | 60–75 |
| 39 | Arife | 8×9 düz | 5 | 3 | 20 | 0 | Zincirleme: 2 kez 30+ ve 40 hepsi | `bayram` | R | ≥90 |
| 40 | Büyük Şenlik | 8×10. 24 hücreli çarkıfelek deseni, 10 kaya, 3 fener; final sonunda mahalle şovu | 6 | 4 | 30 | 0 | Desen + kayalar + 3 fener | Büyük final | F | 40–50 |

Bölüm süresi kontrolü: Botun hamle başına 3 sn düşünme varsayımı ve olayların canlandırma süresi toplamı **60–180 sn** aralığında olmalıdır.

---

## 9. Güçlendiriciler

- Yalnız oynayarak kazanılır, **asla satılmaz**. Her türden en fazla 3 stoklanır.
- Bölüm başına en fazla 1 güçlendirici kullanılabilir; kullanılırsa bölüm en fazla 2★ verir.

| Ad | Açılış | Etki | Hamle |
|---|---|---|---|
| **KİBRİT** | 7. bölüm (hediye 2 adet) | Seçilen hücreye t = 0'da 0. nesil vuruş: kapsül patlar (ısı kuralı işler), özel taş tetiklenir, engel 1 hasar alır, ıslak kurur | 0 |
| **FİŞEK KALIBI** | 12. bölüm (hediye 1) | Seçilen düz kapsülü rokete çevirir; oyuncu ekseni sürükleyerek seçer (4 eksen, canlı ok). Ateşlemez | 0 |
| **GERİ SAR** | 20. bölüm (hediye 1) | Son hamleyi tamamen geri alır: tahta, RNG durumu, hedefler, puan, Körük. Yalnız son eylem bir hamleyse kullanılabilir. RNG de geri alındığı için aynı yolu tekrar çizmek aynı sonucu verir; güçlendirici şans değil düzeltme hakkıdır | 0 (hamleyi iade eder) |

**Kazanım yolları:**
- Sandıkların %35'i (stoğu en düşük güçlendirici verilir; bütün stoklar doluysa 2 toz verilir).
- Günlük görevler.
- Mahalle tamamlama (her türden 1).
- Fener Nöbeti basamakları (Meşale: 1 Kibrit, Fener: her türden 1).
- Bazı rozetler.

---

## 10. Meta ilerleme

### 10.1 Harita: Fener Koyu
- Dikey kaydırılır, aşağıdan yukarıya ilerlenir. **8 mahalle × 5 bölüm = 40 bölüm.** Mahalleler arasında küçük deniz feneri düğümleri olarak 8 **Usta Bölümü** durur.
- Kasaba silueti tohumlu üretimle çizilir. Her bölüm bir binadır:
  - 1★ pencerelerin 1/3'ü, 2★ 2/3'ü, 3★ hepsi yanar.
  - 3★ binanın çatısında sürekli dönen küçük bir havai fişek kalır.
- Işık Deseni motifleri (lale, kayık, fener, çarkıfelek) tamamlandığında ilgili mahallede ışıklı tabela ya da çelenk olarak asılı kalır.
- **Kilit doğrusaldır:** bir bölümü kazanmak sonrakini açar. Yıldızlar ana yolu asla kilitlemez.
- **Mahalle tamamlanınca:**
  - 6 sn'lik bir şov oynar (toplanan bütün desenler patlar, atlanabilir).
  - Mahallenin gökyüzü teması açılır.
  - Fener Koyu Defteri kartı açılır.
  - Her türden 1 güçlendirici verilir.

| Mahalle | Görsel tema (siluet, vurgu rengi) | Gökyüzü teması | Defter kartı |
|---|---|---|---|
| İskele | Ahşap iskele, kayıklar; #3AA8FF | Ay Işığı (#0B1030→#1E2A5A) | Fener alayı geleneği |
| Çarşı | Kubbeler, kemerler; #B266FF | Lale Moru (#1A0F33→#3A1A5C) | Mahya: minareler arasına gerilen ışık yazıları |
| Liman | Vinçler, gemi direkleri; #2EE07A | Deniz Mavisi (#081A2E→#123A4F) | Liman gecelerinde kayık fenerleri |
| Saat Kulesi | Kule, kadran; #D9A441 | Bakır Saat (#1A1020→#4A2A1A) | Kasaba saat kulelerinin hikâyesi |
| Bahçeler | Çardaklar, ağaçlar; #FFB020 | Ateş Böceği (#0A1A12→#1F3A22) | Hıdırellez ateşi ve dilek ağaçları |
| Tepe | Yel değirmeni, rasathane; #FF5FB4 | Yıldız Yağmuru (#0B0B2A→#2A1450) | Nevruz ateşi |
| Fabrika | Bacalar, depo; #FF4D4D | Kızıl Duman (#1A0A0A→#4A1A14) | Osmanlı baruthaneleri |
| Kale | Surlar, burçlar; #FFF3D6 | Altın Şafak (#1A1030→#5A3A1A) | "Donanma" şenlikleri: şehri ışıklarla süsleme ve fişek gösterileri |

Kartlar en fazla 4 cümlelik, kısa kültür notlarıdır; Ayarlar > Defter'den yeniden okunabilir.

### 10.2 Yıldızlar ve Usta Bölümleri
- Toplam 120★. Her 15★ bir Usta Bölümü açar (U1…U8), ama hiçbiri **12. bölüm kazanılmadan** açılmaz (K25; 12'nin kazancında yıldızı yeten Ustalar birlikte açılır: çoğu oyuncuda yalnız U1, U2 ~14. bölümde, usta profilinde çoğu zaman U1 + U2 — `kasaba-ekonomi.py`, 12'de ortalama ana ★ gündelik 22, tipik 26, usta 31). Bunlar bonustur, ana yolu kilitlemez.
- Kilitli Usta düğümü: yıldız eksikse "★15", yıldız yetiyor da 12 kazanılmadıysa "12. bölümden sonra"; dokununca "15 yıldızda açılır" / "12. bölümden sonra açılır" / ikisi de eksikse "30 yıldız ve 12. bölüm gerekir".
- Eski kayıt: bir Usta Bölümü oynamış oyuncuda 12. bölüm kapısı geçilmiş sayılır (yıldızı yeten bütün Ustalar açık). Eski kuralla açılıp hiç oynanmamış Usta, 12 kazanılana dek yeniden kilitlenir (K25, bilinen bedel).

| Usta | Kural | Açılış |
|---|---|---|
| U1 Kuru Barut | Eşik 2, 12 hamle, puan hedefi (şov) | 15★ |
| U2 Yalnız Halka | `yalnizHalka`: yalnız halkalar geçerli hamledir | 30★ |
| U3 Dört Yön | `dortKomsu`: çapraz bağlantı yok | 45★ |
| U4 Gizli Isı | `gizliIsi`: yalnız kızgın kapsüller görünür | 60★ |
| U5 Domino | Barut izi bulmacası, 8 hamle | 75★ |
| U6 Dev Sandık | 8×10, 6 renk, 3 hedef | 90★ |
| U7 Çisenti Fırtınası | 2 Çisenti, periyot 2 | 105★ |
| U8 Kıvılcım Usta'nın Sınavı | Bütün öğeler, 30 hamle | 120★ |

### 10.3 Koleksiyon: Fişek Defteri
- **24 havai fişek deseni**, her biri 3 parça (toplam 72 parça). Kasımpatı, Palmiye ve Halka baştan açıktır. Desenler oyun içi gökyüzünde, harita şovlarında ve final gösterisinde kullanılır; oyuncu en fazla 6 deseni "takar".

  Desen tarifi: `{ parcacik, yayilma, hiz[px/s], omur[ms], iz, yercekimi, renk }`.

  | Desen | Yayılma | Parçacık | İz |
  |---|---|---|---|
  | Kasımpatı | Küre (eşit açılar) | 120 | Orta |
  | Palmiye | 7 kalın kol | 70 | Uzun |
  | Söğüt | Küre, düşük hız, yüksek yerçekimi | 90 | Çok uzun |
  | Halka | Tek hızlı çember | 64 | Kısa |
  | Çift Halka | İki hızlı çember | 96 | Kısa |
  | Kalp | Kalp eğrisi örnekleme | 80 | Kısa |
  | Spiral | Açıya zamanla ofset | 72 | Orta |
  | Yıldız | 5 kollu çokgen | 75 | Kısa |
  | Şelale | Yatay yay + yerçekimi | 110 | Çok uzun |
  | Martı | Martı çokgeni örnekleme | 60 | Kısa |
  | Lale | Lale çokgeni | 70 | Kısa |
  | Karanfil | Sık küre + titreşim | 140 | Kısa |
  | Papatya | 12 kol + merkez | 100 | Kısa |
  | Kuyruklu Yıldız | Tek parlak baş + iz | 30 | Uzun |
  | Çarkıfelek | Dönen 6 kol | 90 | Orta |
  | Ateş Böceği | Yavaş, yanıp sönen | 50 | Yok |
  | Gül | İç içe 3 çember | 100 | Kısa |
  | Yağmur | Aşağı akan çizgiler | 80 | Uzun |
  | Taç | Yarım küre yukarı | 70 | Orta |
  | Hilal | Hilal çokgeni | 60 | Kısa |
  | Dalga | Sinüs çizgisi | 64 | Orta |
  | Kelebek | Kelebek eğrisi | 90 | Kısa |
  | Fener Alayı | Sıralı küçük patlamalar | 5×20 | Kısa |
  | Saat | Kadran + akrep çizgisi | 72 | Kısa |

- **8 fitil görünümü** (3'er parça): Kenevir İp (varsayılan), Altın Tel, Şimşek, Gökkuşağı, Ateş Böceği, Lale Dalı, Deniz Köpüğü, Ejder Kuyruğu.
- **8 gökyüzü teması:** mahallelerden gelir.
- **Gece Tabloları (galeri):**
  - Her bölümün en iyi tablosu saklanır; oyuncu yenisiyle değiştirmeyi seçebilir.
  - **Nadirlik ustalığa bağlıdır:** Sade (kazanç); Parlak (3★ ya da tek hamlede R ≥ 25 ya da 2+ halka); Şaheser (Büyük Final ya da tek hamlede R ≥ 40).
  - Saklanan şey görüntü değil, en büyük 3 reaksiyon ve final gösterisinden en fazla 250 patlama kaydıdır. Her kayıt 32 bit: x 4, y 4, renk 3, nesil 4, özel 3, t/10 14 bit. Base64 halinde yaklaşık 1,3 KB tutar.
  - Tablo belirlenimli olarak yeniden çizilir (§13.6).
- **Işık Deseni motifleri:** 4 motif (Lale 26, Kayık 30, Fener 38, Çarkıfelek 40). Bunlara Usta Bölümü motifleri eklenir.
- **Efsane kartları:** 8 adet (mahalle başına 1).

### 10.4 Sandık
- **Ne zaman açılır:**
  - (a) bir bölümün ilk kazancında;
  - (b) bölümün yıldız rekoru arttığında (artan her yıldız için 1);
  - (c) her günlük görevde;
  - (d) Günün Şenliği'nin ilk kazancında, günde 1.
- **Normal sandık:** %35 güçlendirici, %50 desen parçası, %15 fitil görünümü parçası.
- **Parlak sandık:** 3★ alındığında ya da 3 günlük görevin üçü de tamamlandığında açılır. İki ayrı çekiliş yapılır.
- **Parça seçimi:** %80 olasılıkla sahip olunmayan parçalar arasından, %20 olasılıkla bütün parçalar arasından tekdüze seçilir. Tekrar eden parça 3 kıvılcım tozu verir. **10 toz = seçilen 1 parça.**
- **Kötü şans koruması:** üst üste 3 sandıkta parça çıkmazsa 4. sandık garanti parça verir.
- 5. bölümün ilk sandığı garanti olarak Kasımpatı desenine parça verir; Fişek Defteri böylece tanıtılır.
- **Sandık RNG'si:** `mulberry32(kayitTohumu ^ sandikSayaci)`. Sayaç kayıtta tutulur, bu yüzden yeniden yükleyerek sonucu değiştirmek mümkün olmaz.

### 10.5 Günlük: Günün Şenliği
- 14. bölümden sonra açılır (K25; Ekim 2026'ya dek 10). Günlük geçmişi olan eski kayıtta 14'ten önce de açık kalır.
- **Tohum** = yerel tarih `yyyymmdd`, örneğin 20261014. Herkeste aynı tahta çıkar.
- **Üretici:**
  - Parametre aralığı: w 7, h 8–9, renk 5, eşik 4, hamle 20–25.
  - Hedefler 1–2 tane; topla, kafes, aydınlat ve kaya hedeflerinden seçilir.
  - Yalnız 1–15. bölümlerde tanıtılmış öğeler kullanılır.
  - Web Worker içinde bot süzmesi yapılır: tohum, tohum+1, … en fazla 50 aday denenir. Her aday için hafif Usta botuyla 12 koşu yapılır (64 aday, 16 tam çözümleme). Kazanma oranı %55–85 bandına giren ilk aday seçilir. Algoritma belirlenimli olduğu için her cihazda aynı bölüm çıkar.
- **Kurallar:**
  - Sınırsız deneme yapılabilir; en iyi skor kaydedilir.
  - Yalnız ilk kazanç sandık verir.
  - Dünün ve önceki 6 günün bölümleri arşivden oynanabilir (sandık vermez). Kaçırma kaygısı yoktur.
- **Paylaşım metni** (sunucusuz, panoya kopyalanır, emoji kullanılmaz):
  ```
  FİTİL · Günün Şenliği 14.10.2026
  ★★☆  18/22 hamle  En büyük: 27
  ●●▲●■▲●●▲▲●■●▲●●▲▲
  ```
  Her hamle bir simgedir: ● R < 8, ▲ 8 ≤ R < 15, ■ R ≥ 15.
- **3 günlük görev**, aşağıdaki 20 şablonluk havuzdan `mulberry32(yyyymmdd)` ile seçilir. Her görev 1 sandık verir.
  1. 2 halka çiz
  2. Tek hamlede 15+ reaksiyon yap
  3. 50 gök patlat (renk tohumdan)
  4. 3 roket ateşle
  5. 1 kasımpatı ateşle
  6. Bir kombinasyon yap
  7. 5 kafes kır
  8. 20 döşeme aydınlat
  9. 3 bölümü kazan
  10. Bir bölümü 3★ ile bitir
  11. 12+ düğümlü bir zincir çiz
  12. Körük'ü 2 kez kullan
  13. Çapraz roketle 2 engel vur
  14. 10 kayayı kır
  15. 2 fener indir
  16. Final gösterisinde 5+ roket ateşle
  17. Günün Şenliği'ni kazan
  18. 2. nesil bir patlama yap
  19. 30 kapsülü ısıyla patlat
  20. Bir bölümü ilk denemede kazan
- **Fener Nöbeti (seri):** ardışık oyun günleri sayılır (günde en az 1 bölüm ya da Günün Şenliği).
  - Basamaklar: Kıvılcım (1), Çıra (3), Meşale (7), Fener (14), Deniz Feneri (30).
  - Haftada 1 kaçırılan gün otomatik affedilir.
  - Daha fazla kaçırma seriyi **sıfırlamaz**; seri bir alt basamağın başlangıç değerine düşer (örneğin 12 → 3).
  - Uyarı, bildirim ya da ceza yoktur.
  - Basamak ilk kez geçildiğinde: Çıra → 1 sandık; Meşale → 1 Kibrit + 1 sandık; Fener → her güçlendiriciden 1; Deniz Feneri → "Deniz Feneri" fitil görünümü (tam).

### 10.6 Başarımlar (rozetler)
| Rozet | Koşul |
|---|---|
| İlk Kıvılcım | 1. bölümü kazan |
| Çapraz Nişancı | Çapraz roketle 3 kafes kır (tek oyunda) |
| Sar ve Pişir | Tek zincirle bir kafesi 3 komşusundan ısıt |
| Halkacı | Toplam 50 halka |
| Otuzluk | Tek hamlede R ≥ 30 |
| ŞENLİK! | Tek hamlede R ≥ 40 |
| Üçüncü Kuşak | Bir hamlede 3. nesil patlama |
| Büyük Final | Yıldız + Yıldız kombinasyonu |
| Roket Yağmuru | Yıldız + Roket kombinasyonu |
| Kılpayı | Son hamlede kazan |
| Tutumlu | 10+ hamle kalarak kazan |
| Usta Çırak | Bir mahallenin tamamında 3★ |
| Şaheser | İlk Şaheser tablo |
| Defterci | 12 desen tamamla |
| Nöbetçi | Fener Nöbeti 7 |
| Deniz Feneri | Fener Nöbeti 30 |
| Körükçü | Körükle 10+ reaksiyon |
| Domino | Barut iziyle 3 dev fişek ateşle |

**İstatistik sayfası:** en uzun zincir, en büyük reaksiyon, toplam halka, toplam patlama, en çok nesil, en iyi günlük skor, bölüm başına en iyi skor.

### 10.7 Sonsuz Şenlik
- 40. bölümden sonra açılır.
- Bölüm `n` için tohum `1_000_000 + n` olur. Zorluk n ile yavaşça artar (hamle −1/10 bölüm, kat ve renk artışı).
- Günlük ile aynı üretici ve süzme hattı kullanılır. Oyuncu oynarken bir sonraki bölüm arka planda üretilir.

### 10.8 Can sistemi
**YOKTUR.** Kaybetmenin tek sonucu Coşku Serisi'nin sıfırlanmasıdır. Tekrar dene düğmesi 1 sn'den kısa sürede yeni denemeyi başlatır.

**Karar (22 Ekim 2026):** Android sürümünde can sistemi + ödüllü reklam + küçük satın alma gelir (`docs/YAYIN.md` aşama 2–3). Yukarıdaki "yoktur" claude.ai/tek dosya sürümü için geçerli kalır. Taslak ilkeler:
- **Yer:** claude.ai sayfası ve tek dosya `fitil.html` reklam ağı taşıyamaz; ödüllü reklam için mağaza uygulaması gerekir (ör. Android sarmalayıcı + AdMob). Gelir modeli o sürümle gelir.
- **Yumuşak can:** cömert sayı (ör. 5), hızlı dolum; ilk mahallelerde (öğretim, İskele) can harcanmaz; kazanılan bölüm can harcamaz.
- **Ödüllü reklam yalnız oyuncu isteyince:** kaybedince "+5 hamle için reklam izle" (bölüm başına bir kez), can bitince "reklamla 1 can"; zorunlu ara reklam yok.
- **Kasaba bağı:** kandil ve kasaba işleri reklamsız kazanılır; reklam yalnız hızlandırır. Gündelik oyuncu hiç reklam izlemeden de ilerleyebilmeli.

**Aşama 2 uygulandı (Ekim 2026, sahte sağlayıcı):** kurallar ve ekranlar `docs/CAN-REKLAM.md` (5 can, 30 dk'da 1; 1–5, Günün Şenliği ve Sonsuz Şenlik ücretsiz; kayıpta ve onaylı çıkışta −1, devamla kazanınca iade; reklamla +1 can günde 3, kaybedince reklamla +5 hamle denemede bir kez, Eli kurallarıyla; Mağaza: canları doldur, güçlendirici paketi, Usta kartı). Yalnız gelir sağlayıcısı varken (Android köprüsü; web'de deneme için `?gelir=sahte`); claude.ai ve `fitil.html`'de sağlayıcı yok, yukarıdaki "YOKTUR" aynen geçerli. Gerçek AdMob + Play Billing köprüsü aşama 3.

---

## 11. Bağımlılık kancaları ve uygulama yerleri

Hepsi sağlıklı döngü kancalarıdır. **Yasak desenler:** sahte kıtlık, süreli FOMO, bildirim baskısı, gizli dinamik zorluk, şans kutusu satışı, zorunlu ara reklam, satın almadan bitirilemeyen bölüm. (Ekim 2026'ya kadar can, bekleme ve mağaza da yasaktı; Android sürümü için yumuşak can + istekle ödüllü reklam + küçük satın alma kararı alındı, `docs/YAYIN.md`.)

| # | Kanca | Döngü | Uygulama yeri |
|---|---|---|---|
| 1 | Müzikal fitil: her düğüm pentatonik bir nota yükselir, bırakınca alev aynı notaları hızlanarak çalar | Kısa | `audio/fitilSesi.ts`, `input/yolCizici.ts` |
| 2 | Önizleme gerilimi: eşiğe ulaşacaklar titrer, özel taş hayaleti ve canlı roket oku görünür | Kısa | `core/onizle.ts`, `render/onizlemeKatmani.ts` |
| 3 | Kızgın kapsüller kıvılcım saçar ("bir dokunuş kaldı") | Kısa | `render/sprite/kapsul.ts` |
| 4 | Kalın kuyruklu reaksiyon dağılımı (hak edilmiş değişken ödül) | Kısa | `core/resolve.ts`, CI reaksiyon bantları |
| 5 | Yönetmen kamerası: zirvede yavaş çekim ve punch-zoom | Kısa | `render/kamera.ts` (`reaksiyon` olayı) |
| 6 | Kurulum hamlesi de ödül: ısınan kapsülde turuncu nabız ve minik nota | Kısa | `render/oynatici.ts` (`isindi`) |
| 7 | Körük Göstergesi: zamanlaması oyuncuya ait ara ödül | Orta | `core/koruk.ts`, `ui/hud/koruk.ts` |
| 8 | Hedef sayacına uçan kıvılcımlar, sayaç zıplaması | Orta | `render/hedefUcus.ts`, `ui/hud/hedefler.ts` |
| 9 | Son hamle gerilimi: nabız ve "Son hamle!" | Orta | `ui/hud/hamle.ts`, `audio/kalpAtisi.ts` |
| 10 | Final gösterisi (hamle tasarrufu ödülü) | Orta | `core/final.ts`, `render/final.ts` |
| 11 | Yakın kaçış ekranı: "%92 — 3 kızıl kaldı" | Orta | `ui/ekran/kaybettin.ts` |
| 12 | "Bu çizgi kazandırırdı" hayalet fitili | Orta | `bot/kazandiranBul.ts` (Worker), `ui/ekran/kaybettin.ts` |
| 13 | Anında tekrar (< 1 sn) | Orta | `app/oyunAkisi.ts` |
| 14 | Sandık ve kötü şans koruması | Orta | `meta/sandik.ts` |
| 15 | Gece Tablosu (kişisel, nadirliği ustalığa bağlı) | Orta ve uzun | `meta/galeri.ts`, `render/tablo.ts` |
| 16 | "Sıradaki: X!" merak kancası | Orta | `ui/ekran/kazandin.ts` |
| 17 | Coşku Serisi: 3 ilk deneme kazancı → hazır roket | Orta | `meta/cosku.ts`, `core/bolumYukle.ts` |
| 18 | Testere dişi zorluk: zor bölümden sonra rahatlama | Orta | Bölüm verisi |
| 19 | İlk tahta sabit, dolum taze | Orta | `core/rng.ts`, `core/bolumYukle.ts` |
| 20 | Kasaba haritası ışıkları, 3★ çatı fişeği | Uzun | `ui/harita/` |
| 21 | Işık Deseni motifleri haritada | Uzun | `ui/harita/motifler.ts` |
| 22 | Fişek Defteri, kişisel gökyüzü | Uzun | `meta/defter.ts`, `render/gokyuzu.ts` |
| 23 | Günün Şenliği ve paylaşım ızgarası | Uzun | `meta/gunluk.ts`, `levels/uretici.ts` |
| 24 | Fener Nöbeti (cezasız seri) | Uzun | `meta/seri.ts` |
| 25 | Günlük görevler | Uzun | `meta/gorevler.ts` |
| 26 | Rekorlar ve "YENİ REKOR!" | Uzun | `meta/istatistik.ts` |
| 27 | Usta Bölümleri (15★'da bir, 12. bölümden sonra) | Uzun | `ui/harita/`, bölüm verisi |
| 28 | Rozetler | Uzun | `meta/rozetler.ts` |
| 29 | Efsane ve kültür kartları | Uzun | `meta/defter.ts` |
| 30 | Sağlık: 45 dk sonra "Kıvılcım Usta: Biraz mola?" balonu (kapatılabilir, ayardan 30/45/60/kapalı) | — | `app/molaZamanlayici.ts` |
| 31 | Gönüllü "Kıvılcım Usta'nın Eli" (4 başarısızlıktan sonra) | Orta | `ui/ekran/kaybettin.ts` |

---

## 12. Hissiyat (juice)

### 12.1 Genel parametreler
- **Easing tanımları:**
  - `outCubic`
  - `outBack(s = 1,70158)`
  - `inQuad`
  - `inOutCubic`
  - `yay(k = 400, c = 18, m = 1)` (yarı-örtük Euler, dt ≤ 1/120 s)
- **Tik → ms:** normal hızda 1×. Çözümleme sırasında dokunmak 2× yapar. Ayarlarda "Hızlı" seçeneği 1,5×'tir. Yavaş çekim zaman ölçeğiyle çarpılır.
- **Ekran sarsıntısı (travma modeli):**
  - Fitil patlaması +0,06, zincir dışı patlama +0,10 travma ekler.
  - Roket +0,25, kasımpatı +0,35, yıldız +0,30, kombinasyon +0,5, Büyük Final +0,8.
  - Üst sınır 1. Kayma = 10 px × travma², yön 2B Perlin gürültüsü (frekans 25 Hz). Dönme ±1,2° × travma².
  - Travma saniyede 1,6 azalır. "Hareketi azalt" açıkken sarsıntı 0'dır.
- **Yönetmen kamerası:** R > 12 ya da kombinasyon varsa çalışır.
  - Zirve = olayların 90 tiklik pencerelere bölündüğü dağılımda en çok patlamanın düştüğü pencere.
  - Zaman ölçeği 80 ms'de 0,3'e iner (`outCubic`), 450 ms bekler, 250 ms'de 1'e döner (`inOutCubic`).
  - Aynı sürede kamera ağırlık merkezine 1,04× yakınlaşır.
  - Ses ana yolu alçak geçiren filtreden geçer: 1,2 kHz'e iner, çıkışta 18 kHz'e açılır.
  - "Hareketi azalt": ölçek 0,6, bekleme 150 ms, yakınlaşma yok.
- **Hit-stop (görsel donma):** özel tetiklenme 50 ms, kombinasyon 80 ms.
- **Tam ekran flaş:** saniyede en fazla 3 kez. Alfa 0,35'i geçmez.
- **Titreşim** (`navigator.vibrate`; destek yoksa sessizce atlanır, ayardan kapatılır): düğüm 5 ms, özel 20 ms, büyük reaksiyon [30, 20, 60], halka 15 ms.

### 12.2 Olay tablosu
| Olay | Animasyon (ms, easing) | Parçacık | Ses | Sarsıntı |
|---|---|---|---|---|
| Düğüm eklendi | Ölçek 1→1,25→1,1 (`yay` k400 c18); fitil merkeze yaylı yapışır; fitil kalınlığı 4 + 0,6·n px (en fazla 12); 7+ düğümde beyaz-sıcak | Parmak ucunda köz, 30/sn | "Çıt": nota k (§12.3), sinüs + üçgen, A2 D60 | — |
| Geri alma | Ölçek 1,1→1, 120 `outCubic` | — | "Fıs": gürültü, bant geçiren 1,5 kHz Q1, 60 ms, kazanç 0,15; ardından bir alt nota | — |
| Özel eşiği geçildi (6/9/12) | Hayalet 120 ms solarak belirir; roket oku 80 ms'de döner | 6 altın kıvılcım | FM çan: taşıyıcı nota, oran 3,5, indeks 2→0, 600 ms | — |
| Halka kapandı | Halka boyunca ışık turu 250 ms; fitil gül-altın parlar | 12 kıvılcım halka üstünde | İki nota (k, k+2), FM çan | — |
| Zincir uzaması | Vinyet alfası min(0,35; 0,025·n) | — | — | — |
| Bırakma / tutuşma | Fitil başı alevi yol boyunca kural zamanıyla koşar | Alev başı 40/sn iz | Gürültü, bant geçiren 3→6 kHz süpürme, 200 ms | — |
| Fitil patlaması | 2 kare beyaz çekirdek (r 0,6 hücre); ezilme 80 ms (x 1,3, y 0,7) ve kaybolma; şok halkası r 0→0,9 hücre, 220 `outCubic`, kalınlık 3→0 px | 14–18 renkli parçacık: hız 120–260 px/s, ömür 450–700 ms, sürtünme 2,5, yerçekimi 300 px/s²; 1 kıvılcım göğe (Bezier, 700 ms) | "Pop": sinüs + üçgen, nota k, 80 ms'de ×0,9439 perde düşüşü, A2 D120; artı gürültü 30 ms, bant geçiren 2 kHz | +0,06 |
| Isındı | Turuncu nabız halkası ölçek 1→1,15→1, 160 ms; köz yuvası 120 ms'de dolar | 2 köz | Sinüs 2 kHz, 15 ms, kazanç 0,05 (15 ms içinde birleşir) | — |
| Kızgın oldu | Beyaz-sıcak çekirdek 150 ms'de belirir | Köz yayıcısı 6/sn | Cızırtı: gürültü, yüksek geçiren 5 kHz, 120 ms | — |
| Isı patlaması | Fitil patlaması gibi, renk %20 daha sıcak | 16 parçacık + 4 köz | Pop (nota dalga ile yükselir) + "güm": sinüs 55 Hz, A5 D180 | +0,10 |
| Roket | Fırlatma flaşı; baş kural zamanıyla ilerler (25 tik/hücre); ardıl görüntü izi 300 ms | Baş 60/sn kıvılcım, kenarda 10 parçalık sıçrama | Tıslama: sinüs 800→2400 Hz, 400 ms, vibrato 12 Hz ±30 sent, yüksek geçiren 3 kHz gürültüyle; kenarda "çat": gürültü 40 ms + kare 220 Hz, 30 ms | +0,25 |
| Kasımpatı | Hit-stop 50; halka biçimli patlama; 60 ms'de bozulma halkası r 2,5 hücre, 300 ms | 24 radyal + 16 köz | Alçak geçiren 4000→300 Hz süpürmeli gürültü, 400 ms + sinüs 70 Hz güm + FM çan | +0,35 |
| Yıldız topu | Hit-stop 50; her hedefe 20 ms arayla ışın | Hedef başına 6 gökkuşağı kıvılcımı | Pırıltı: akor tonlarında 6 sinüs, ±7 sent, 30 ms aralı, 900 ms sönüm | +0,30 |
| Yüklenme (kombo) | Taş 0,3 hücre havalanır, fitili 120 ms gecikmeyle izler, dönerek parlar | İz | Yükselen sinüs 300→900 Hz, 300 ms | — |
| Kombinasyon | Hit-stop 80; tam ekran beyaz alfa 0,35, 120 ms | 40 parçalık patlama | Bum: sinüs 45 Hz, 400 ms + gürültü 600 ms, alçak geçiren 800 Hz | +0,5 |
| Büyük Final | Halka halka flaş, 8 halka | Halka başına 30 | Bum + akor arpeji | +0,8 |
| Kaya hasarı | Çatlak çizgisi belirir, 6 gri kırıntı | 6 | "Tok": gürültü, alçak geçiren 800 Hz, 60 ms + sinüs 140 Hz, 50 ms | +0,03 |
| Kafes kırıldı | 4 pirinç çubuk döner ve düşer, 500 ms | 4 + 6 kıvılcım | Metal "çın": FM oran 1,4, 2,4 kHz, 200 ms | +0,05 |
| Kova hasarı | Su sıçraması | 10 mavi damla | Gürültü, bant geçiren 1 kHz, aşağı süpürme, 150 ms | +0,03 |
| İs temizlendi | Duman bulutu 300 ms'de solar | 8 gri | Yumuşak gürültü, 120 ms | — |
| Islak kurudu | Buhar | 6 beyaz | Cızırtı, 100 ms | — |
| Döşeme aydınlandı | Dairesel maske 0→1, 300 `outCubic`, sıcak ışık #FFC86B | 4 altın | Yumuşak çan, nota k+5, kazanç 0,1 | — |
| Desen boyandı | Renkli parıltı; motif çizgi segmenti çizilir | 6 renkli | Marimba: üçgen, nota, A1 D250 | — |
| Barut izi | Kıvılcım iz boyunca 60 tik/adım koşar | Adım başına 5 | Çıtırtı: rastgele 4 ms tıklar, 20/sn | — |
| Dev fişek doldu (+1) | Gösterge tıkırdar, ölçek 1→1,1→1, 120 ms | — | Tık, 1,5 kHz | — |
| Dev fişek fırladı | 150 ms titreme, yukarı iz, gökte büyük desen | 80 + gök deseni | Uğultu 150 ms, ıslık, bum | +0,4 |
| Düşme | Süre 90·√d ms (`inQuad`), iniş ezilmesi 1→0,9→1, 80 ms | — | Sütun başına tık (birleşik) | — |
| Doğum | Tahta üstünden düşer (aynı eğri) | — | — | — |
| Fener toplandı | Fener HUD sayacına süzülür, 600 `inOutCubic` | Altın iz | 3 notalı çan arpeji | — |
| Karıştırma | Kapsüller kalkar, Bezier yollarla yer değiştirir, 500 `inOutCubic`; "Sandık sallanıyor…" | — | Dönen gürültü süpürmesi | +0,1 |
| Hedef sayacı | Kıvılcım Bezier 450 ms; sayaç 1→1,25→1, 150 ms | — | Tık (birleşik) | — |
| Hedef tamamlandı | Onay işareti `outBack` 250 ms | 10 altın | Çan akoru | — |
| Reaksiyon yazısı (8/15/25/40) | Ölçek 0→1,3→1 (`yay` k300 c14); harfler sinüsle dalgalanır; 700 ms kalır, 250 ms'de solar | Yazı çevresinde 20 kıvılcım | Kademeye göre yükselen arpej | — |
| Körük doldu | Gösterge nabız atar (1,5 Hz), parıltı turu | — | Körük nefesi: gürültü, bant geçiren 600 Hz, 400 ms | — |
| Körük kullanıldı | 3×3 alana sıcak hava dalgası, 300 ms | 20 köz | Nefes + yükselen nota | +0,1 |
| Son 5 hamle | Hamle sayacı turuncu nabız atar | — | — | — |
| Son hamle | "Son hamle!" bandı, 900 ms | — | Kalp atışı: sinüs 50 Hz, iki vuruş 120 ms arayla, 900 ms'de bir | — |
| Kazandın | "Şenlik başlıyor!", ardından final gösterisi; yıldızlar 300 ms arayla mühürlenir | Göğe havai fişekler | Arpej C5-E5-G5-C6-E6 (90 ms) + çan akoru; yıldız damgası: 90 Hz güm + çan (G5, C6, E6) | — |
| Kaybettin | Tahta 400 ms'de kararır | — | E5→C5 iki yumuşak sinüs, her biri 300 ms | — |
| Boşta | Kapsüller nefes alır (±%2, 0,3 Hz); 5 sn sonra iyi bir zincirde parıltı dalgası gezer, 1200 ms döngü | Sıcak kapsüllerden köz | — | — |

### 12.3 Ses tasarımı (WebAudio, tamamen sentez)
- **Pentatonik dizi** (k. düğüm → indeks min(k−1, 10)):

  C5 523,25 · D5 587,33 · E5 659,26 · G5 783,99 · A5 880,00 · C6 1046,50 · D6 1174,66 · E6 1318,51 · G6 1567,98 · A6 1760,00 · C7 2093,00 Hz

  11. düğümden sonra perde C7'de kalır ve bir oktav üstte kazancı 0,15 olan parıltı katmanı eklenir.
- **Isı dalgaları** fitilin son notasından devam eder: w. dalga → indeks min(son + w, 10).
- **Yönlendirme:** sesler `sfx` (0,8), `muzik` (0,35) ve `ortam` (0,25) yollarından ana yola gider.
- **Ana yol:** DynamicsCompressor (eşik −18 dB, diz 12, oran 4, atak 3 ms, bırakma 150 ms) → çıkış.
- **Yankı:** ConvolverNode. Dürtü yanıtı 1,8 sn'lik stereo gürültüdür, `exp(−t/0,45)` ile söner. Islak payı 0,18.
- **Ses havuzu:** en fazla 24 ses; en eski ses çalınır. 15 ms içinde gelen aynı tür pop'lar birleşir: mevcut sesin kazancı +%20 artar (en fazla 1,6×).
- **Ortam:**
  - Kalabalık uğultusu: pembe gürültü, bant geçiren 400 Hz Q0,5, kazanç 0,02, LFO 0,1 Hz ±%30.
  - Deniz: kahverengi gürültü, alçak geçiren 500 Hz, kazanç LFO'su 0,08 Hz.
- **Müzik (isteğe bağlı):** üretken pentatonik ped.
  - İki testere dalga (±6 sent) → alçak geçiren 900 Hz → kazanç 0,05.
  - Akor her 8 sn'de değişir (I–vi–IV–V pentatonik kökleri).
  - Kısma (ducking): büyük olaylarda 0,02'ye iner, 600 ms'de döner.
- AudioContext ilk dokunuşta `resume()` edilir. Sekme gizlenince `suspend()`. Ses yoksa oyun sessizce çalışır.
- Gürültü tamponları (beyaz, pembe, kahverengi; 2 sn) açılışta bir kez üretilir.

### 12.4 Olaydan ses ve görüntüye bağlama
Çizici, kuralların zaman damgalı olay listesini oynatır. Ses de aynı zaman çizelgesine bağlıdır: her olayın `t` değeri `AudioContext.currentTime` üzerinden zamanlanır (en fazla 30 ms ileri planlama).

---

## 13. Görsel kimlik

### 13.1 Palet (hex)
| Kullanım | Renk |
|---|---|
| Gökyüzü üst / alt | #0B1030 / #2A1450 |
| Deniz | #0A0E26 → #1B1040; yansıma şeritleri gökyüzünün alfa 0,25'i |
| Ahşap koyu / orta / damar | #24160D / #3A2416 / #4E321F |
| Hücre yuvası | #160E08 → #24160D (radyal) |
| Işıklı yuva (ışık izi) | #3B2A12 + altın radyal alfa 0,25 |
| Pirinç / açık pirinç | #D9A441 / #F2C66D |
| Bakır / koyu bakır | #B8642E / #7A3E1C |
| Krem metin / ikincil | #FFF3D6 / #CDB89A |
| Köz / ısı halkası / beyaz-sıcak | #FF7A1A / #FF9A3C / #FFF4C2 |
| Uyarı / başarı | #FF5A3C / #7CFFB2 |

**Kapsül renkleri:**

| Kapsül | Ana | Açık | Koyu |
|---|---|---|---|
| Kızıl | #FF4D4D | #FFB3A8 | #8A1C1C |
| Kehribar | #FFB020 | #FFE08A | #8A5A00 |
| Zümrüt | #2EE07A | #A8FFD0 | #0E6B37 |
| Gök | #3AA8FF | #B5E0FF | #0F4A80 |
| Mor | #B266FF | #E3C7FF | #4E1F8A |
| Gül | #FF5FB4 | #FFC2E3 | #8A1F5A |

**Renk körü paleti (Ayarlar, baştan açık):** Okabe–Ito uyarlaması — #E8631C, #F0C419, #1BB38A, #6CC6F5, #8C7CF0, #E07BC0. Bunun yanında Yüksek Kontrast seçeneği vardır: şekil konturu 3 px, iç simge beyaz.

### 13.2 Kapsül çizim tarifi
Sprite önbelleğine bir kez çizilir; boyut ve DPR'ye göre yeniden üretilir. Hücre boyu c, gövde yarıçapı r = 0,40c.
1. **Dış parıltı** (`lighter`): radyal gradyan, ana renk alfa 0,35 → 0, yarıçap 0,62c.
2. **Gövde yolu (siluet):**
   - Daire: r.
   - Yıldız: 5 köşe, dış 1,05r, iç 0,55r, köşe yuvarlama 0,12r.
   - Damla: alt yarım daire r, tepe noktası (0, −1,25r), Bezier kontrolü (±0,9r, −0,4r).
   - Elmas: genişlik 1,7r, yükseklik 2,1r, köşe yuvarlama 0,1r.
   - Altıgen: düz üst, köşe yarıçapı 1,02r.
   - Üçgen: eşkenar, ucu yukarıda, çevrel yarıçap 1,15r, köşe yuvarlama 0,15r.
3. **Cam dolgu:** radyal gradyan, merkez (−0,3r, −0,35r); duraklar 0: açık, 0,45: ana, 1: koyu.
4. **İç ışık:** merkezde radyal gradyan, beyaz alfa 0,25, yarıçap 0,5r.
5. **Yansıma:** sol üstte beyaz elips (0,45r × 0,22r), −30°, alfa 0,55.
6. **Kontur:** koyu renk, 1,5 px. Gri tonlamada siluet tek başına ayırt edilir.
7. **Isı (eşiğe göre) köz yuvaları:** E−1 adet yay, yarıçap 0,47c, çizgi kalınlığı 0,06c.
   - Her yay (360/(E−1) − 14)° uzunlukta, tepe noktasından saat yönünde başlar.
   - Boş yuva #FFFFFF alfa 0,12; dolu yuva #FF9A3C (`lighter`).
   - Isı > 0 ise 1,5 Hz ±%2 nabız.
8. **Kızgın** (ısı = E−1): beyaz-sıcak çekirdek (radyal #FFF4C2 alfa 0,7, r 0,45r), 3 Hz ±%4 nabız, ±1 px titreme, köz yayıcısı 6/sn. `gizliIsi` kuralında boş yuvalar çizilmez.
9. **Özel taşlar:**
   - Roket: eksen boyunca çift başlı pirinç ok (uzunluk 1,5r) ve iki küçük kanatçık.
   - Kasımpatı: gövde içinde 8 yapraklı krem yıldız deseni, 0,4 Hz dönüş.
   - Yıldız topu: renksiz inci cam; konik gökkuşağı gradyanı 0,2 Hz döner; 6 köşeli beyaz pırıltı.
10. **Islak:** doygunluk %40, parıltı yok, üstte 3 mavi damla.
11. **Kafes:** pirinç çubuklar (3 dikey, 1 yatay, 0,07c kalınlık), köşe perçinleri.

**Engeller:**
- Kaya: gri taş (#5A5560 → #2E2A33). Kat sayısı = çatlak sayısı (0/1/2) ve üst üste taş katmanı.
- Kova: ahşap kova, su seviyesi kat ile değişir, çevresinde soluk mavi kalkan çerçevesi (alfa 0,25).
- Dev fişek: kırmızı-altın silindir; dolum göstergesi N parçalı halka.
- Fener: kâğıt fener, sıcak sarı, 0,5 Hz salınım.
- İs: siyah bulut (gürültülü kenar), hafif kıpırtı.
- Barut izi: zeminde koyu gri örgülü ip; ardışık hücre merkezlerini birleştirir.
- Döşeme: koyu karo + pirinç köşeler; 2 kat çift çerçeve; aydınlanınca sıcak ışık.
- Desen döşemesi: istediği rengin silik silueti.

### 13.3 Fitil çizimi
- İki sinüs ofsetli çizgi (genlik 0,12·kalınlık, dalga boyu 10 px) açık ve koyu sırayla çizilerek örgülü ip izlenimi verilir.
- Üstüne `lighter` ile parıltı geçilir. Renk zincir rengidir; 7+ düğümde #FFF4C2'ye karışır.
- Halkada gül-altın gradyan kullanılır.
- Fitil görünümleri yalnız bu katmanı değiştirir.

### 13.4 Arka plan ve sandık
- **Gökyüzü:** dikey gradyan. 3 katman yıldız tozu (tohumlu 120/80/40 nokta, 0,05–0,2 Hz parıltı). Hepsi offscreen katmana pişirilir.
- **Kasaba silueti:** ekranın üst %10–20'si. Tohumlu bina dizisi: genişlik 18–40 px, yükseklik 30–90 px; çatı türleri düz, beşik, kubbe ve kule. Pencereler 4×6 px; yanık pencere #FFC86B.
- **Deniz:** alt kenar. Gökyüzünün dikey yansıması; 6 sinüs şerit, 0,3 Hz.
- **Sandık (tahta çerçevesi):**
  - Koyu ahşap damar: yatay şeritler, `sin(y·0,15 + gürültü(x)·3)` değeriyle ton değişimi.
  - 14 px pirinç köşe plakaları; kenar boyunca hücre başına 1 perçin.
  - Yuvalar içe gömülü, 2 px iç gölge çizgisi.
  - Bölüm boyunca patlama olan yuvalar kalıcı ışık iziyle parlar.

### 13.5 Yazı tipleri
- **Google Fonts: "Baloo 2"** (SIL OFL), ağırlık 700 ve 800, Latin + Latin Extended alt kümesi (ğ ş ı İ ç ö ü). Derleme sırasında woff2 olarak indirilir ve base64 ile tek dosyaya gömülür (yaklaşık 60 KB). Çalışma anında ağ isteği yapılmaz.
- **Ekim 2026 değişikliği:** yazı tipi **Nunito** (SIL OFL, değişken ağırlık 200–1000, Latin + Latin Extended, `@fontsource-variable/nunito`). Baloo 2, Nunito, Fredoka, M PLUS Rounded 1c ve Sniglet oyun ekranlarında karşılaştırıldı: Nunito okunaklılık (x-yüksekliği ~0,48, açık harf biçimleri, küçük satırlarda net) ile yuvarlak, sıcak hattı en iyi dengeleyen; M PLUS daha okunaklı ama geniş (satır kayar), Fredoka 700'de sıkışık, Sniglet 800'de topak.
- **Yedek yığın:** `ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`.
- **Boyutlar:** hamle sayısı 28/800; hedef sayısı 18/800; balon 16/700; düğme 18/800; gövde metni 15/700; reaksiyon yazısı 44–64/800. Sayılar tabular (`font-variant-numeric: tabular-nums`).

### 13.6 Gece Tablosu çizimi
- 512×768 offscreen tuval: mahalle gökyüzü ve silueti.
- Her kayıt bir havai fişek izine dönüşür:
  - Konum: tahta x → tuval x (%10–90), tahta y → yükseklik (alt satırlar alçakta).
  - Yarıçap 18 + 10·nesil.
  - Renk kapsül rengi.
  - Desen özel türüne göre: roket → çizgi, kasımpatı → küre, yıldız → gökkuşağı halka.
- Uzun pozlama etkisi `lighter` katmanında, alfa 0,08–0,2 çizgilerle verilir. Parçacık sapmaları `mulberry32(bolumId ^ gunlukKarmasi)` ile üretilir, bu yüzden tablo belirlenimlidir.
- Nadirlik çerçevesi: Sade ahşap, Parlak pirinç, Şaheser altın varak ve ışık süzmesi.

### 13.7 Yerleşim
**Dikey telefon** (referans 390×844 CSS px; tasarım alt sınırı 360×640):
- Üst bant 0–%20: gökyüzü ve kasaba. HUD yalnız okunur.
  - Solda en fazla 3 hedef kartı (64×48).
  - Ortada hamle dairesi (56 px).
  - Sağda puan ve 3 yıldız işaretli çubuk (120×40).
  - Göğe uçan kıvılcımlar ve havai fişekler bu bantta patlar. HUD plakası bandın üst kısmını kapladığından (claude.ai görüntüleyicisinde ~390×700'de bandın ~%55'i) merkezler **görünür gök şeridine** (HUD'un ölçülen alt kenarı → ufuk/sandık üstü) düşer, patlama ölçeği şeride göre ayarlanır (yarıçap ≈ 1,7 × şerit, en az 105 px). Patlamanın HUD'a taşan üst kısmı HUD'un üstündeki **fişek katmanında** (ikinci, bant boyunda tuval; `pointer-events: none`; üstte %60, sınırda tam opak) çizilir: HUD kısa süre okunur kalır, balon/bant/modallar fişeklerin üstündedir. Hedef kartlarına uçan kıvılcımlar ve kart patlamaları da bu katmanda kartların üstünde görünür.
- Tahta %20–%86: `hucre = floor(min((G − 32)/w, (0,66·Y − 24)/h, 64))`. Alt sınır 40 px; altına düşerse üst bant %14'e iner. Tahta yatayda ortalanır, 16 px kenar boşluğu bırakılır.
- **Tablet ek (Ekim 2026):** kısa kenarı ≥ 600 px olan ekranda (tablet, masaüstü) üst sınır 64 yerine **96** (`hucreSiniri`, `ui/yerlesim.ts`; çizici aynı kuralı kullanır). 64'te 10" tablette tahta ekranın ortasında küçük kalıyordu. Telefon değişmez.
- Alt çubuk %86–%100 (güvenli alan payı dahil), bütün düğmeler burada:
  - [Duraklat] solda.
  - [Kibrit] [Kalıp] [Geri Sar] ortada, 56×56.
  - [Körük] sağda, 72 px daire.
- `touch-action: none`; tuvalde `setPointerCapture`. Sayfa kaydırması ve yakınlaştırma kapalıdır.

**Masaüstü ve yatay** (en/boy oranı > 0,75):
- Tahta solda %62'lik alanda ortalanır, `hucre = min(64, (Y − 160 − 32)/h)` (tablet ekiyle sınır 96; −32 çerçeve payı: büyük hücrede çerçeve üstteki kasaba şeridine binmesin).
- Sağda 320 px panel: hedefler, hamle, puan, güçlendiriciler, Körük.
- Gökyüzü ve kasaba tam arka planda; kasaba üstte. Gök fişekleri panelin solundaki gökte patlar.

**Klavye:**
- Ok tuşları imleci dik yönde taşır; Q/E/Z/C ya da numpad 7/9/1/3 çapraz taşır.
- Boşluk tuşu imleçteki hücreden yol başlatır ya da yolu imlece uzatır.
- Backspace geri alır. Enter bırakır (ateşler). Esc iptal eder. D tuşu imleçteki özel taşı ateşler (çift dokunuşun karşılığı).
- K tuşu Körük'ü açar; 1/2/3 tuşları güçlendiricileri seçer.
- Odak halkası 3 px krem çizgidir.

---

## 14. Ekranlar

Arayüz katmanı DOM üzerindedir: menüler, HUD ve balonlar. Tahta, gökyüzü ve efektler Canvas'ta çizilir. Bütün metinler `src/ui/metinler.ts` sözlüğünde durur.

1. **Açılış:** FİTİL logosu (ip harfler tutuşur, 1,2 sn) → "Dokun ve başla" (bu dokunuş AudioContext'i açar).
2. **Harita (ana ekran):**
   - Fener Koyu dikey kaydırılır; son açık bölüme otomatik kayar.
   - Üstte: toplam ★, Fener Nöbeti alevi, günlük görev rozeti.
   - Altta: [Günün Şenliği] [Fişek Defteri] [İstatistik/Rozetler] [Ayarlar].
3. **Bölüm öncesi kartı:**
   - Bölüm adı, mahalle, hedef ikonları ve sayıları, hamle sayısı.
   - Eşik varsayılan değilse bilgi: "Kuru Gece: barut 3 ısıda tutuşur".
   - Yeni öğe varsa küçük animasyonlu önizleme.
   - En iyi skor, yıldızlar, tablo küçük resmi. Coşku Serisi aktifse "Hazır roketle başlıyorsun!".
   - Düğmeler: [Başla] ve [Geri].
4. **Oyun HUD'u:** §13.7. Kıvılcım Usta balonu tahtanın üst kenarında, tek satır, dokununca kapanır.
5. **Duraklat:** [Devam] [Yeniden başla] [Ayarlar] [Haritaya dön]. Yeniden başlamak yeni deneme sayılır ve Coşku Serisi'ni bozar.
6. **Kazandın:**
   1. Final gösterisi.
   2. Yıldızlar mühürlenir ("YENİ REKOR!" kutlamasıyla birlikte).
   3. Puan sayılarak artar.
   4. Sandık açılır (dokun-aç).
   5. Gece Tablosu önizlemesi ve nadirlik etiketi ([Sakla] / [Eskisini koru]).
   6. "Sıradaki: X!" tanıtımı.
   - Düğmeler: [Devam] (büyük) ve [Tekrar oyna].
7. **Kaybettin:**
   - "%92 — 3 kızıl kaldı" çubuğu.
   - Bulunursa "Bu çizgi kazandırırdı" hayalet fitili: son hamle öncesi tahtada 2 kez oynatılır, [Tekrar izle].
   - **[Tekrar dene]** büyük düğme, 1 sn'den kısa sürede yeni deneme. [Haritaya dön].
   - Aynı bölümde 4. ve sonraki başarısızlıklarda ek düğme: **"Kıvılcım Usta'nın Eli: +5 hamle ile devam et (en fazla 1★)"**. Ücretsizdir ve her denemede bir kez kullanılabilir.
8. **Ayarlar:**
   - Efekt sesi (kaydırıcı), müzik (kaydırıcı), ortam sesi (aç/kapat), titreşim.
   - Hareketi azalt (`prefers-reduced-motion` ile otomatik açılır), animasyon hızı (Normal / Hızlı).
   - Renk paleti (Standart / Renk körü / Yüksek kontrast).
   - İpuçları (aç/kapat ve "Balonları yeniden izle").
   - Mola hatırlatıcısı (30 / 45 / 60 / kapalı).
   - Kayıt kodu: [Dışa aktar] [İçe aktar]. İlerlemeyi sıfırla (iki aşamalı onay).
   - Defter kartları, Hakkında.
9. **Nasıl oynanır:** 6 animasyonlu kart: Çiz ve bırak · Çapraz ve halka · Isı ve kızgınlık · Özel taşlar (6/9/12) · Kombinasyonlar · Engeller (açılmış olanlar).
10. **Fişek Defteri:** sekmeler Desenler · Fitiller · Gökyüzü · Tablolar · Motifler · Defter. Toz miktarı ve [Toz harca] düğmesi.
11. **Günün Şenliği:** bugünün tahtası küçük resmi, en iyi skor, görevler, seri, [Oyna] [Paylaş] [Arşiv].
12. **İstatistik ve Rozetler.**

---

## 15. Öğretim (ilk 5 bölüm)

**İlke:** Her bölüm tek kavram öğretir. Metin tek satırdır ve el animasyonuyla gösterilir.
- **Yumuşak zorunlu ilk hamle** (bölüm 1 ve 2): ilk hamlede yalnız vurgulanan kapsüllerden yol başlatılabilir; diğerleri kararır. Vurgulu küme içindeki her geçerli yol kabul edilir; rota kilitli değildir.
- **Bölüm 3–5:** yönlendirmelidir (vurgu ve el), zorunlu değildir.
- Bölüm 1–4'te **yardım 3**.

Gösterim: R Kızıl, A Kehribar, Z Zümrüt, G Gök; `³` ısı 3 (eşik 4'te kızgın), `²` ısı 2; `.` rastgele.

**Bölüm 1 — İlk Kıvılcım** (5×6, 3 renk, eşik 4, 12 hamle, hedef 25 kapsül, özel kapalı)
```
y0  .  .  .  .  .
y1  .  .  .  .  .
y2  .  .  .  .  .
y3  .  .  .  .  .
y4  Z  A³ Z  .  .
y5  R  R  R  R  Z
```
1. Saydam el animasyonu (0,5,y5)→(3,5) çizer. Balon: **"Aynı renkleri parmağınla birleştir, bırak."**
2. Fitil koşar. (1,5) patlayınca A³ +1 alır ve 90 ms sonra kendiliğinden patlar; yavaş çekim zorlanır.
3. İlk hamleden sonra balon: **"Kızgın kapsüller yanındaki patlamayla tutuşur!"**
4. Oyuncu 2 düğümde bırakırsa: **"En az 3."**
5. Oyuncu 3 sn tereddüt ederse el animasyonu geri gider (geri almayı gösterir).

**Bölüm 2 — Çapraz Yol** (6×7, 4 renk, 15 hamle, 15 gök + 15 kızıl, `ozelEsikleri [6,0,0]`)
```
y5  R  G  A  G  G  G
y6  G  Z  G  R  G  G
```
1. Yumuşak zorunlu: yalnız gök kapsüller vurgulanır. El (0,6)→(1,5)→(2,6)→(3,5)→(4,6)→(5,6) yolunu çizer.
2. Balon: **"Çapraz da olur. 6 ve üstü = ROKET!"** 6. düğümde roket hayaleti (yatay eksen) görünür.
3. Sonraki hamlede (4,5)→(5,5) ve roket birlikte parlar. Balon: **"Roketi bir zincire kat, ateşlensin."**

**Bölüm 3 — Isınma** (6×8, 4 renk, 15 hamle, 35 kapsül)
```
y3  .  Z² R² Z² G² .
y4  .  R³ Z³ G³ Z³ .
y5  .  A  A  A  A  .
```
1. Balon: **"Patlayan kapsül komşusunu ısıtır. Kızgın olan bir ısı daha alınca PATLAR."**
2. Kehribar dizisi çizilince y4 sırası birer birer tutuşur, y3 sırası kızgın hale gelir. Senaryo yavaş çekimi ve "Harika!" yazısı çıkar (`senaryo.ilkReaksiyonVurgusu`).
3. Ardından balon: **"Isı kalıcıdır. Kızgınlara bir dokunuş yeter."**

**Bölüm 4 — Sar ve Pişir** (7×8, 4 renk, 18 hamle, 3 kafes)
- Kafesler (1,2), (5,2), (3,5); her birinde ön ısı 1.
- U yolları:
  - Z: (0,2)(0,3)(1,3)(2,3)(2,2)
  - G: (4,2)(4,3)(5,3)(6,3)(6,2)
  - R: (2,5)(2,6)(3,6)(4,6)(4,5)
- Her U 3 dik komşuyu kapsar: +3 ısı → kafes eşiğe ulaşır.
- Balon: **"Kafesler yalnız ısıyla açılır. Etrafını sar!"** Çizim sırasında kafes titrer (önizleme).

**Bölüm 5 — Nişan** (7×8, 4 renk, 20 hamle, 4 kafes)
- Kafesler x+y = 7 köşegeninde: (1,6), (2,5), (3,4), (4,3).
- Sabit Z yolu: (3,0)(4,0)(5,0)(6,0)(6,1)(5,2). Son segment ↙ olduğu için roket ekseni ↗/↙ olur ve köşegeni tarar.
- El animasyonu yoktur. Tek balon: **"Fitili çaprazda bitir, roket çapraz uçar."**
- Kazanınca:
  - **"Yıldızlar puanından gelir."** (yıldız çubuğu tanıtılır)
  - **"Kalan hamlelerin rokete döner!"** (final gösterisi)
  - İlk sandık açılır, Kasımpatı parçası garanti çıkar.

**Sonraki tanıtım balonları** (ilk hamlede gösterilir, gerekirse el animasyonuyla):

| Bölüm | Balon |
|---|---|
| 6 | "9 ve üstü = KASIMPATI. Etrafını da ısıtır." |
| 7 | "Islak barut zincire girmez. Yanında patlat, kurusun." |
| 8 | "Başladığın yere dön: HALKA! Isısı iki kat." |
| 9 | "Döşemelerin üstünde patlat, sokak aydınlansın." |
| 11 | "Feneri en alt sıraya indir." |
| 12 | "12 ve üstü = YILDIZ TOPU. Her renge uyar." |
| 13 | "Kayalar yanındaki patlamayla ufalanır." |
| 14 | "İki özel taşı aynı fitile kat: birleşirler!" |
| 16 | "Dev fişeği yanında patlatarak doldur." |
| 17 | "Isıyla patlayanlar Körük'ü doldurur. Dolunca dokun, nereyi istersen ısıt." |
| 18 | "Kova yanındakileri ısıtmaz. Önce kovayı kır." |
| 21 | "Barut izine değen patlama bütün izi tutuşturur." |
| 26 | "Desendeki her karo kendi renginin patlamasını ister." |
| 29 | "Meltem satırı kızdırır. Sırasını bekle!" |
| 31 | "İs yayılır! Her hamle birini temizle." |
| 33 | "Çisenti satırı söndürür. Önce orayı ateşle." |

Bütün balonlar Ayarlar > İpuçları altında yeniden izlenebilir.

**Boşta ipucu:** 5 sn hareketsizlikte Acemi botun en iyi adayı üzerinde bir parıltı dalgası gezer (ayardan kapatılabilir).

**Coşku Serisi:** üst üste 3 bölümü ilk denemede kazanan oyuncu, sonraki bölüme tahta merkezine en yakın düz kapsül (y, x eşitliğinde küçük olan) yatay roket olarak başlar. Kaybetmek seriyi sıfırlar; başka ceza yoktur.

---

## 16. Teknik notlar

### 16.1 Mimari ve modüller
```
src/core/     saf TS, DOM yok, testli
  types.ts        (sözleşme: OyunDurumu, Hucre, Icerik, Hamle, Olay, BolumVerisi)
  rng.ts          bolumYukle.ts   yol.ts (doğrulama, zincir rengi)
  resolve.ts      ozel.ts         engel.ts   yercekimi.ts
  kilit.ts        karistir.ts     hedef.ts   puan.ts
  onizle.ts       final.ts        koruk.ts   hava.ts
src/bot/      adaylar.ts  acemi.ts  usta.ts  kazandiranBul.ts  sim-cli.ts (node, worker_threads)
src/levels/   veri/*.json  dogrulayici.ts  uretici.ts (günlük ve sonsuz)
src/render/   katmanlar.ts  sprite/  parcacik.ts (havuz 800)  oynatici.ts (olay → zaman çizelgesi)
              kamera.ts  gokyuzu.ts  tablo.ts  onizlemeKatmani.ts
src/audio/    motor.ts  sesler.ts  muzik.ts
src/input/    yolCizici.ts  klavye.ts
src/ui/       ekranlar/  hud/  harita/  metinler.ts
src/meta/     kayit.ts  sandik.ts  gunluk.ts  seri.ts  rozetler.ts  galeri.ts  istatistik.ts  cosku.ts
```
**Kural:** Çizici, ses ve arayüz yalnız `Olay[]` tüketir; çekirdeğe yazmaz. Çizici kendi "görsel tahtasını" olaylarla günceller. Geliştirme kipinde çözümleme sonunda bu tahta çekirdeğin `durum'` değeriyle karşılaştırılır.

### 16.2 Sözleşme özeti
```ts
type Renk = 0|1|2|3|4|5; type Eksen = 0|1|2|3; type Konum = { x: number; y: number };
type Icerik =
 | { tur:'kapsul'; renk: Renk | -1; isi: number; ozel:'yok'|'roket'|'kasimpati'|'yildiz'; eksen: Eksen }
 | { tur:'islak'; renk: Renk } | { tur:'fener' }
 | { tur:'kaya'; kat: 1|2|3 } | { tur:'kova'; kat: 1|2 }
 | { tur:'devFisek'; dolum: number; kapasite: number } | { tur:'is' };
interface Hucre { delik:boolean; icerik:Icerik|null; kafes:boolean; doseme:0|1|2;
  desenRengi:number; desenBoyali:boolean; izIndeksi:number; isikIzi:boolean }
interface OyunDurumu { w:number; h:number; hucreler:Hucre[]; esik:number; renkSayisi:number;
  ozelEsikleri:[number,number,number]; dogumAgirliklari:number[]; yardim:number;
  kalanHamle:number; puan:number; hedefler:HedefDurumu[]; korukDolum:number; korukKapasite:number;
  rng:number /* mulberry32 iç durumu */; hamleNo:number; izler:{hucreler:number[]; yandi:boolean[]}[];
  havaOlaylari:HavaDurumu[]; fenerDogum:{kalan:number; sahadaEnFazla:number}|null; cikislar:number[];
  kurallar:Kurallar; istatistik:BolumIstatistigi; bitti:null|'kazanc'|'kayip' }
type Hamle = { tur:'fitil'; yol:Konum[]; halka:boolean } | { tur:'ciftDokunus'; hucre:Konum }
 | { tur:'koruk'; merkez:Konum } | { tur:'kibrit'; hucre:Konum } | { tur:'kalip'; hucre:Konum; eksen:Eksen };
type Olay = { t:number } & (
 | { tur:'fitilBasladi'; yol:Konum[]; halka:boolean; renk:number }
 | { tur:'dugumYandi'; hucre:Konum; k:number }
 | { tur:'patlama'; hucre:Konum; renk:number; neden:'fitil'|'isi'|'vurus'|'iz'|'devFisek'|'final'|'kibrit'; nesil:number; puan:number }
 | { tur:'isindi'; hucre:Konum; isi:number; kizgin:boolean }
 | { tur:'ozelOlustu'; hucre:Konum; ozel:string; eksen?:Eksen }
 | { tur:'ozelTetiklendi'; hucre:Konum; ozel:string; hedefRenk?:number }
 | { tur:'yuklendi'; hucre:Konum } | { tur:'kombinasyon'; hucre:Konum; kombo:string }
 | { tur:'isiDalgasi'; merkez:Konum; yaricap:number }
 | { tur:'engelHasar'; hucre:Konum; engel:string; kalan:number } | { tur:'kafesKirildi'; hucre:Konum }
 | { tur:'kurudu'; hucre:Konum } | { tur:'dosemeAydinlandi'; hucre:Konum; kalan:number }
 | { tur:'desenBoyandi'; hucre:Konum } | { tur:'izYandi'; hucre:Konum }
 | { tur:'devFisekDoldu'; hucre:Konum; dolum:number } | { tur:'devFisekFirladi'; hucre:Konum }
 | { tur:'isTemizlendi'; hucre:Konum } | { tur:'isYayildi'; hucre:Konum }
 | { tur:'yercekimi'; dusenler:{den:Konum; e:Konum}[]; doganlar:{hucre:Konum; icerik:Icerik; sanalY:number}[] }
 | { tur:'fenerToplandi'; hucre:Konum } | { tur:'havaOlayi'; olay:'meltem'|'cisenti'; hat:number; uyari:boolean }
 | { tur:'karistirma'; esleme:{den:Konum; e:Konum}[] } | { tur:'hedefIlerledi'; indeks:number; deger:number }
 | { tur:'korukDoldu' } | { tur:'reaksiyon'; boyut:number; zirveT:number; merkez:Konum; kombo:boolean }
 | { tur:'bolumBitti'; sonuc:'kazanc'|'kayip' } );

bolumuYukle(v: BolumVerisi, denemeNo: number, secenek?: { cosku?: boolean }): OyunDurumu
yolDogrula(d: OyunDurumu, yol: Konum[], halka: boolean): null | 'kisa'|'renk'|'komsu'|'tekrar'|'halkaGerekli'
onizle(d: OyunDurumu, yol: Konum[], halka: boolean): Onizleme
hamleUygula(d: OyunDurumu, h: Hamle): { durum: OyunDurumu; olaylar: Olay[] }   // girdiyi değiştirmez
finalGosterisi(d: OyunDurumu): { durum: OyunDurumu; olaylar: Olay[] }
kilitliMi(d: OyunDurumu): boolean
ilerlemeYuzdesi(d: OyunDurumu): number
durumKarmasi(d: OyunDurumu): number   // FNV-1a 32 bit, testler için
```

### 16.3 Belirlenimlilik
- **RNG:**
  ```ts
  export function rngSonraki(d:{rng:number}): number { // uint32
    d.rng = (d.rng + 0x6D2B79F5) >>> 0; let t = d.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0; }
  export const rngInt = (d:{rng:number}, n:number) => Math.floor((rngSonraki(d) * n) / 4294967296);
  ```
  `rngSonraki(d) · n < 2⁵³` ve ikinin kuvvetine bölme kesin olduğu için sonuç her platformda aynıdır. Ağırlıklı seçim tamsayı ağırlıkların kümülatif toplamıyla yapılır.
- **Tüketim sırası sabittir:** dolum (soldan sağa sütun, aşağıdan yukarı yuva) → fener doğumu → yardım yeniden çekimleri → is yayılması → karıştırma → final.
- **Lint (yalnız `src/core`):**
  - `no-restricted-globals`: `Date`, `performance`.
  - `no-restricted-properties`: `Math.random`.
  - `no-restricted-syntax`: ondalık sayı sabitleri (`Literal[raw=/\./]`).
- Çekirdekte zaman birimi tiktir; ms sabitleri yalnız çizicide bulunur.

### 16.4 Testler (vitest)
- **Birim testleri:**
  - yol doğrulama (8-komşu, geri alma, halka ≥ 4, joker rengi);
  - fitil zamanları (6 düğüm → 0, 103, 199, 288, 370, 445);
  - ısı kuralı (+1 / +2, kalkan, planlı hücre ısı almaz, eşik 2–5, nesil);
  - her özel etkinin hücre kümesi; 6 kombinasyon; üçüncü özel taşın ayrı tetiklenmesi;
  - vuruş tablosunun her satırı; yerçekiminin sabitlerin arkasından geçişi; fener çıkışı;
  - is yayılması; Meltem tavanı ve Çisenti; Körük;
  - kilitlenme testi ve karıştırmanın sonlanması; puan tablosu; Final Gösterisi.
- **Altın tekrarlar:** (bölüm, deneme, hamle dizisi) → beklenen `durumKarmasi` ve olay listesi anlık görüntüsü. Bölüm başına en az 1 tekrar.
- **Özellik ve bulanık testler** (10 000 rastgele oyun):
  - hiçbir hücre bir hamlede iki kez patlamaz;
  - çözümleme sonlanır;
  - hamle sonunda delik olmayan her hareketli yuva doludur;
  - kapsül sayısı korunur (patlayan + dönüşen + kalan = önceki + doğan);
  - aynı girdi aynı karmayı verir;
  - karıştırma sonrası tahta kilitli değildir;
  - `hamleUygula` girdiyi değiştirmez (`Object.freeze` ile test edilir).

### 16.5 Bot ve bölüm doğrulama
**Aday üretimi** (hamle başına):
1. Renk bileşenleri bulunur.
2. Boyutu ≥ 3 olan her bileşende bot RNG'siyle sıralanmış tohumlu DFS yapılır; uzunluğu ≥ 3 olan her ön ek aday olur. Bileşen başına en fazla 300 aday ve 5000 DFS düğümü.
3. Şablonlar eklenir:
   - (a) her başlangıçtan Warnsdorff açgözlü en uzun yol (en iyi 10);
   - (b) hedef hücrelerin (kafes, kızgın, döşeme, desen, engel) en az 2 dik komşusunu içeren yollar;
   - (c) 2×2 halkalar ve DFS ile bulunan 4–8 düğümlü halkalar;
   - (d) uzunluğu ≥ 6 olan yolların farklı son adımlı varyantları (roket nişanı).
4. Yinelenenler `(düğüm kümesi, son düğüm, son eksen, halka)` anahtarıyla elenir. Toplam en fazla 2000 aday.
5. Ucuz puan (önizleme ilk dalgası, hedef hücreleri, uzunluk, özel taş) ile en iyi 64 aday seçilir. Bu adaylar tam `hamleUygula` ile çözülür ve özel taşlar için çift dokunuş da değerlendirilir.

**Dürüst değerlendirme:** Bot adayları durumun bir kopyasında, `rng = mulberry32(durumKarmasi ^ botTohumu)` ile değerlendirir; gerçek dolum akışını görmez. Seçilen hamle gerçek durumda oynanır.

**Usta botu** (1 hamle ileri bakış ve sezgisel değerlendirme):
`V = 1000·Δ(hedef ilerleme oranı) + 0,02·Δpuan + 40·(kızgın kapsül sayısı) + 15·(ısı toplamı / kapsül) + 80·(sahadaki özel taşlar) − 300·[kazanç yokken kalan hamle = 0]`

Ağırlıklar `bot/agirliklar.json` dosyasındadır. Körük, doluysa en çok eşik hücresi üreten merkeze hemen kullanılır.

**Acemi botu:** adaylar arasından uzunluk² ağırlığıyla rastgele seçer. %20 olasılıkla rastgele 3–4'lük bir yol seçer. Körük'ü dolar dolmaz rastgele bir merkeze kullanır.

**CLI:**
- `npm run bot -- --bolum 12 --tohum 200 --bot usta`
- `npm run dogrula` (CI): bölüm başına 100 tohum, `worker_threads`, 40 bölüm toplamda 5 dakikadan kısa sürer.
- `npm run kalibre`: 500 tohum; `yildizEsikleri` değerini yazar ve hamle sayısı önerir. `--kural k24` (ya da bölümde `esikKurali: "k24"`): Acemi'yi de 500 tohum oynatır ve K24 eşiklerini yazar.

**Doğrulayıcı (CI başarısız sayar):**
- **Statik:** boyut, eşik ve renk aralıkları; simge geçerliliği; döşeme ve desen yalnız kapsül hücrelerinde; hedefin nesnesi tahtada var; fener çıkışlarına ulaşılabilir; barut izi komşuluğu; desen renkleri < renkSayısı; başlangıç tahtası kilitsiz; `yardim > 0` yalnız id ≤ 20; ana ve Usta bölümlerinde `caprazSiniri` yok, `ozelEsikleri` yalnız 0 ya da 6 / 9 / 12 (K21).
- **Bot ölçütleri:**
  - Usta kazanma oranı `botBandi` içinde; 100 tohumda en az 1 kazanç; hiçbir bölüm %35'in altında değil.
  - **Yakın kaçış:** kayıpların ≥ %30'unda `ilerlemeYuzdesi ≥ 0,8`. Yalnız tasarımla sağlanır, dolum hilesi kullanılmaz.
  - **Reaksiyon dağılımı** (`bayram` değilse): medyan 0–3, p90 6–14, p99 ≤ 35.
  - Usta'nın seçtiği zincir uzunluğunun medyanı 4–7.
  - Özel taş sıklığı (tanıtım bölümleri hariç): roket ≤ hamlelerin %35'i, kasımpatı ≤ %15, yıldız ≤ %6.
  - Hamle sonu ortalama ısı ≤ 0,3·eşik.
  - Tahmini süre 60–180 sn.
- **Ölçüm dışı:** Acemi kazanma oranı raporlanır ve izlenir (öğretimde ≥ %80, tanıtımda ≥ %30 — K23; uyarı, başarısızlık değil). İlk oturum hedefleri (K23, K24; `--acemi --acemi-tohum 60` ile ölçülür): normal ≥ %20, zor ≥ %8 (Bölüm 10 ≥ %15), rahatlama ≥ %60.

### 16.6 Performans (60 fps)
- **Katmanlar:**
  - (1) arka plan, kasaba ve deniz offscreen'de tutulur; yalnız yeniden boyutlandırma ve tema değişiminde çizilir. Deniz dalgası ucuz bir şerit kaydırmadır.
  - (2) sandık çerçevesi ve yuvalar offscreen'de.
  - (3) dinamik katman: ışık izi, kapsüller, fitil, efektler (`lighter`).
  - (4) DOM HUD.
- `shadowBlur` **yasaktır**. Parıltılar sprite önbelleğinden gelir: (6 renk × düz/roket/kasımpatı) + yıldız + ıslak + engeller + köz yuvası ve kızgın katmanları. Roket oku döndürülerek çizilir. `OffscreenCanvas` yoksa `document.createElement('canvas')` kullanılır.
- Parçacık havuzu 800, kare başına bellek ayırma yoktur. DPR en fazla 2.
- **Otomatik kalite:**
  - 30 karelik ortalama > 20 ms ise parçacıklar ×0,5, parıltı katmanı kapanır, deniz durağanlaşır.
  - 120 kare boyunca < 12 ms ise kalite geri yükselir.
- Önizleme O(|P|), kilitlenme testi O(hücre). `hamleUygula` hedefi 7×9 için < 1 ms (ortanca).

### 16.7 Kayıt
- **Anahtar:** `localStorage['fitil.kayit.v1']`; yedekler `…v1.yedek1` ve `…v1.yedek2` (son 2 başarılı yazım).
- **Şema:**
  ```json
  { "surum": 1, "kayitTohumu": 0, "bolumler": { "1": { "yildiz": 3, "enIyi": 6200, "deneme": 2, "basarisizSeri": 0, "tablo": "base64…", "nadirlik": 1 } },
    "koleksiyon": { "parcalar": [], "takili": [], "fitil": "kenevir", "gokyuzu": "ayIsigi", "motifler": [], "kartlar": [] },
    "toz": 0, "guclendiriciler": { "kibrit": 2, "kalip": 0, "geriSar": 0 },
    "sandik": { "sayac": 0, "parcasizSeri": 0 },
    "gunluk": { "tarih": 20261014, "gorevler": [], "enIyi": {}, "seri": 0, "affedilenHafta": 0, "sonGun": 20261013 },
    "cosku": 0, "rekorlar": {}, "rozetler": [], "istatistik": {}, "ayarlar": {} }
  ```
- Bölüm sonunda ve ayar değişince 500 ms gecikmeli yazılır. Bütün okuma ve yazmalar `try/catch` içindedir.
- Depolama yoksa (gizli mod) bellek içi kayda dönülür ve tek seferlik bir bilgi balonu gösterilir.
- Bozuk JSON'da yedeklere sırayla dönülür. Sürüm göç fonksiyonları birim testlidir.
- **Kayıt kodu:** `FTL1:` + base64(JSON) + 4 haneli sağlama. İçe aktarımda önizleme gösterilir ve onay istenir.
- İleride sunucu veritabanına aynı şemayla geçilebilir.

### 16.8 Derleme
- Vite ve vite-plugin-singlefile ile tek `fitil.html` üretilir. Bölüm JSON'ları ve yazı tipi gömülüdür, harici istek yoktur. Hedef boyut < 1 MB.
- `npm run typecheck`, `npm test`, `npm run dogrula`, `npm run build:single`.

### 16.9 Ajan ekibi iş paketleri
**P0 (sözleşme):** `types.ts`, olay listesi, fonksiyon imzaları, bölüm şeması, lint kuralları.

**Paralel paketler:**
- (a) core + vitest
- (b) bölüm verisi + doğrulayıcı + üretici
- (c) bot + CLI
- (d) çizici + olay oynatıcı + sprite'lar
- (e) ses
- (f) girdi + arayüz
- (g) meta + kayıt

**Teslim sırası:**
- **Faz A:** çekirdek kurallar, 3 özel taş, halka, kombinasyonlar; kafes, ıslak, kaya, döşeme; 1–10, 12–14. bölümler; temel arayüz ve ses.
- **Faz B:** fener, dev fişek, kova, barut izi, is, delik, desen, hava olayları, Körük; kalan bölümler; final gösterisi cilası.
- **Faz C:** Gece Tablosu, Fişek Defteri, sandık, günlük, seri, rozetler, Usta bölümleri, Sonsuz Şenlik.

Şema baştan bütün türleri tanımlar.