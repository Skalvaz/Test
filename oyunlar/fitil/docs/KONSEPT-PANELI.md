# FİTİL — konsept paneli kaydı

Dört konsept ajanı farklı açılardan öneri yazdı, üç hakem puanladı (yenilik ×1,2, bağımlılık ×1,5, netlik ×1,2, uygulanabilirlik ×1,0, görsel ×0,8).

| Konsept | Açı | Oy | Ağırlıklı puan |
|---|---|---|---|
| FİTİL | his | 3 | 48.2 |
| Rüzgâr Eken | tema | 0 | 42.4 |
| Ebruli | mekanik | 0 | 41.5 |
| Usturlap | dongu | 0 | 40.7 |

## Ebruli — Ham boyaları karıştır, aynı renkleri buluştur, kendi ebru tablonu kâğıda al.

Ebruli'de hazır şekerlerin yerini değiştirmezsin: ham boyaları birbirine sürükleyip yeni renkler yaratır, aynı renkleri buluşturup su yüzeyinden kâğıda geçirirsin. Her bölümün sonunda yalnız senin hamlelerinden doğan, bir daha aynısı çıkmayacak bir ebru tablosu defterine eklenir.

**Çekirdek mekanik:** OYUNCUYA TEK CÜMLE: "İki ham boyayı birbirine sürükle, yeni renk olsun. Aynı yeni renkten 3 damla birbirine değince kâğıda geçer."  1) TAHTA Varsayılan 7 sütun × 9 satır (en fazla 8×10). Bölümün maskesi açık ve kapalı hücreleri belirler. Yerçekimi aşağı doğrudur. Her hücrenin üç katmanı vardır: - zemin: Kâğıt 0–2, Desen isteği, Yağ - içerik: boş, damla ya da sabit engel - damla bilgisi: tür, renk, kalıcı kimlik (id)  2) RENK KODU (3 bit) - Kırmızı = 1, Sarı = 2, Mavi = 4. Bunlar ham boyalardır. - Turuncu = 3, Mor = 5, Yeşil = 6. Bunlar karışık renklerdir. - Mürekkep = 7.  3) HAMLE Bir damlayı yatay ya da dikey komşusuna sürükle. Dokun-dokun da olur: önce seç, sonra komşuya dokun. Sürüklenen kaynak a, bırakılan hedef b'dir. - (a & b) == 0 ise boyalar KARIŞIR:   - hedefin rengi a | b olur,   - kaynak hücre boşalır,   - hamle sayacı 1 azalır. - (a & b) != 0 ise hamle geçersizdir: aynı renk, ortak bileşen, karışık+karışık ya da Mürekkep. Damla titrer, hamle harcanmaz. - Kaynak ya da hedef özel taşsa bu kural yerine özel etkileşim tablosu geçer (bkz. özeller). - Yağlı hücredeki damla ne kaynak ne hedef olabilir.  Bu kuraldan çıkan geçerli karışımlar (her iki yönde): - K+S → Turuncu, K+M …

## Rüzgâr Eken — Rüzgâr eken, bahar biçer.

Kuruyan bir vadide küçük bir rüzgâr ruhusun: avucundaki tohumu bir sıraya üfle, sıra kaysın, öbür uçtan havalanan tohum avucuna konsun; aynı türden üç tohum yan yana gelince filizlenir ve çatlak toprak yeşerir. Rüzgâr nereye eserse her şey oraya savrulduğu için zinciri sen yönlendirirsin; her üfleme yeni bir kombo fırsatı, her bölüm vadiye biraz daha bahar getirir.

**Çekirdek mekanik:** TEK CÜMLELİK KURAL: Avucundaki tohumu bir satırın ya da sütunun ucundan içeri üfle. Sıra bir hücre kayar ve öbür uçtan düşen tohum avucuna konar. Aynı türden 3 veya daha fazla tohum yatay ya da dikey hizalanınca filizlenir (temizlenir).  DURUM - Izgara G: varsayılan 7 sütun × 9 satır; delikli şekiller olabilir. - Her hücrede tek parça bulunur:   - Tohum {tür 0..5, özel: yok | Kanatlı | Kozalak}   - Karahindiba   - Arı   - Engel {çalı(can) | yabani ot | ağ(içinde tohum)}   - Kaya - Ayrı bir katman olarak toprak[h] ∈ {0 yeşil, 1 çorak, 2 taşlı}. - Avuç: 1 parça. - Kese: 1 yuva, bölüm 9'da açılır. Avuç ile kese arasında takas hamle harcamaz. - Rüzgâr yönü r ∈ {K, G, D, B} (esiş yönü). - RNG: mulberry32, iki ayrı akış (dolum ve çevre). - Kalan hamle sayısı.  HAMLE = ÜFLEME (kenar e, hat indeksi i) 1) Hat: e kenarındaki i. hücreden karşı kenara giden hücre dizisi. Sabit hücreler (kaya, çalı, yabani ot, ağlı tohum) hattı bölümlere ayırır. Yalnızca kenardan ilk sabit hücreye kadarki bölüm etkilenir. Üç durumda bu üfleme yasaktır: ilk hücre sabitse, o kenar hücresinde çit varsa veya bölüm uzunluğu 0 ise. 2) Bölümdeki tüm parçalar 1 hücre içeri kayar. Avuçtaki parça kenar hücresine girer. B …

## Usturlap — Halkaları çevir, yıldızları hizala, sönen gökyüzünü yeniden yak.

Usturlap'ta taşları takas etmezsin: pirinç bir usturlabın halkalarını kasa şifresi çevirir gibi döndürür, renkli yıldızları aynı ışına hizalarsın; merkeze düşen yıldızlar da zincirleme patlamalar kurar. Her bölüm sönmüş gökyüzüne bir yıldızı geri asar; can yok, bekleme yok, yalnızca "bir tur daha çevireyim" hissi var.

**Çekirdek mekanik:** TAHTA: R halka (3–5) × S ışın (8–12, çift sayı). Hücre (r,s) ile gösterilir: r=0 en iç halka, r=R-1 dış kenar. s mod S alınır, yani halkalar çevrimseldir. Merkez bir hücre değil, Çekirdek'tir. - Hücre özelliği: normal | boşluk (tahtada yok) | çapalı. - Hücre içeriği: renkli taş (renk 0..C-1, C=3–6) | özel taş | engel taşı | gök cismi (Ay/Güneş/Gezegen) | göktaşı. - Hücreye bağlı katman: bulutsu (0–2).  HAMLE = BİR HALKAYI ÇEVİRMEK - Oyuncu bir halkaya dokunup açısal olarak sürükler; fare de aynı şekilde çalışır. Halka parmağı 1:1 takip eder, bırakınca en yakın adıma oturur. - k ∈ {1..S-1}, saat yönü pozitif. k kaç olursa olsun bu 1 hamle sayılır. - Hareketli hücreler: halkadaki boşluk ya da çapalı olmayan hücreler, s sırasıyla. İçerik bu listede k konum kaydırılır. Çapalı taşlar yerinde kalır, diğerleri onların üzerinden atlar. - Bağlı halkalar (ileri bölümlerde): A'yı k çevirmek, B'yi aynı anda −k çevirir. - Geçerlilik: döndürmeden sonra en az bir eşleşme ya da Tutulma oluşmalı. Oluşmazsa halka yaylanarak geri döner ve hamle harcanmaz. - Canlı önizleme: sürükleme sırasında her adımda, o konumda oluşacak doğrudan eşleşmeler parlar. Kaskadlar önizlemede gösterilmez.  EŞLEŞME: aynı r …

## FİTİL — Bir çizgi çek, geceyi tutuştur.

Parmağınla aynı renkteki barut kapsüllerini tek bir fitille birleştir, bırak ve alevin yol boyunca hızlanarak koştuğunu, her patlamada müziğin bir nota yükseldiğini dinle. Patlayan her kapsül komşularını ısıtır, üç kez ısınan kendiliğinden patlar; doğru yere çekilmiş tek bir çizgi bütün sandığı gökyüzünü dolduran bir zincirleme havai fişek şovuna çevirir.

**Çekirdek mekanik:** TAHTA: W×H kare ızgara. Varsayılan 7 sütun × 9 satırdır; 5×6 ile 8×10 arasında değişir, '#' boşluk hücreleriyle şekilli de olabilir. Her hücrede en fazla bir İÇERİK ve bir ZEMİN katmanı bulunur. - İçerik: kapsül {renk 0..5, ısı 0..2, özel: yok | roket(yön 0..7) | kasımpatı | yıldız}, fener ya da sabit engel. - Zemin: aydınlatma döşemesi ya da barut izi. - Hareketli içerik: kapsül, ıslak kapsül, fener. Sabit içerik: kaya, kafes, su kovası, dev fişek, is.  HAMLE = FİTİL ÇİZMEK (tek parmak, sürükle-bırak): 1) Parmak bir kapsüle basınca yol P=[c0] başlar. Yalnızca ilk pointerId izlenir. 2) Parmak son hücrenin 8 komşusundan (dik + çapraz) birinin merkezindeki 0,42·hücre yarıçaplı daireye girerse ve o hücre zincirlenebilir, aynı renkte (yıldız topu jokerdir, her renge uyar) ve P'de değilse P'ye eklenir. İç daire testi köşelerden geçen çapraz hareketlerde yanlış dik komşu seçilmesini önler. Parmak son düğümden 0,6 hücre uzaklaşıp hiçbir daireye girmezse, açıca en yakın 8-komşu uygunsa ona yapışır. 3) Sondan bir önceki düğüme dönmek son düğümü siler (geri alma). 4) |P| ≥ 4 iken son düğüm P[0]'a komşuysa ve parmak P[0]'a girerse yol HALKA olur. Halka kapanınca yeni düğüm eklenemez; geri alm …

## Hakem notları

### oyuncu (kazanan: FİTİL)

KAZANAN: FİTİL. Bağımlılık ve netlik ölçütlerinde açık ara önde. Çekirdeği bir cümle; ısı mekaniği değişken ama hak edilmiş büyük ödüller üretiyor; his tasarımı telefonda bırakılmayacak kadar olgun. Aşağıdaki aşılar, Two Dots tanıdıklığını kırmak ve uzun döngüyü güçlendirmek için.

EBRULİ'DEN
1) Hamlelerden üretilen tablo: Her bölüm sonunda, o bölümdeki gerçek patlama günlüğünden (x, y, renk, nesil, özel tür) belirlenimli olarak bir 'Gece Kartpostalı' çizilsin. Fener Koyu'nun gökyüzünde oyuncunun reaksiyonları havai fişek izleri olarak kalsın. Saklanan şey görüntü değil sıkıştırılmış günlük (~0,5–1 KB) olsun. Nadirlik ustalığa bağlansın: Sade, Parlak (halka ya da 3★), Şaheser (Büyük Final ya da 40+ reaksiyon). Fişek Defteri böylece hazır desenlerin yanında kişisel bir galeri de olur.
2) Desen hedefi: 'Aydınlat' döşemeleri bir motif biçiminde dizilsin (lale, fener, kayık, cami silueti). Tamamlanınca motif kasaba haritasında ışıklı bir tabela ya da çelenk olarak asılı kalsın. Bu hem hedef çeşidi hem kalıcı görsel ödül olur.
3) Belirlenimli 'yardım' düğmesi: Kilitlenmeye yakın tahtada, o turda doğan kapsüller aynı RNG akışından en fazla n kez yeniden çekilsin. Böylece 3+ uzunlukta zincir bulunur. Hile değil, bölüm verisindeki açık bir zorluk düğmesi.
4) Kural motiften öğrenilsin: Isı halkalarının yanında, her rengin şekil motifi küçük ikonlarda ve hedef sayaçlarında da aynı kalsın. Renk körü oyuncu baştan açık palet seçebilsin.

RÜZGÂR EKEN'DEN
5) Bölüm içinde kalıcı dönüşüm: Patlayan hücrenin zemini sönük tahtadan ışıklı tahtaya dairesel bir maskeyle dönüşsün. Bölüm sonunda sandık 'aydınlanmış' görünsün; çatlak toprağın çayıra dönmesinin karşılığı.
6) Haber verilen çevre olayı: 'Deniz rüzgârı' ya da 'çisenti' bir hamle önceden kenarda titreyen geri sayımla uyarsın, sonra bir sütunu soğutsun (ısı −1) ya da ıslatsın. Oyuncu bunu planlayabilir, bazen de lehine kullanabilir.
7) Sonraki bölümü merak ettirmek: Kazanma ekranında 'Sıradaki: Fener!' gibi bir tanıtım çıksın. Ayrıca 'Kıvılcım Serisi' olsun: üç bölümü üst üste ilk denemede kazanan, sonrakine sandıkta hazır bir roketle başlasın. Kaybetmek yalnız seriyi sıfırlasın, ceza olmasın.
8) Dürüst bot ölçümü: Bot gerçek dolum akışını görmesin, kendi örnek RNG'siyle tahmin etsin. Zorluk bantları böylece insanın yaşadığına yakın olur.

USTURLAP'TAN
9) 'Bu hamle kazandırırdı': Kaybedince bot bir hamle ileri baksın; kazandıracak bir fitil varsa hayalet bir çizgi olarak tahtada gösterilsin. Yarım kalan sayaç da gösterilsin ('3 kızıl kaldı, %92'). Yakın kaçış öğrenmeye dönüşür.
10) Yakın kaçış metriği CI'da: Kayıpların en az %30'unda hedefin en az %80'ine ulaşılması bölüm doğrulayıcısına eklensin. Bu yalnız tasarımla sağlansın, dolum hilesiyle değil.
11) İlk tahta sabit, dolum her denemede farklı (tohum = bölümTohumu ⊕ denemeNo). Plan öğrenilebilir olur, her deneme taze kalır.
12) Oyuncunun zamanladığı ara ödül: Gökyüzüne uçan kıvılcımlar bir 'Şenlik Göstergesi' doldursun. Dolunca oyuncu dilediği an, hamle harcamadan tek bir 'Gök Fişeği' atabilsin (örneğin seçilen 3×3 alana +1 ısı). Hamle değil zamanlama kararı olur; gökyüzü bağı süs olmaktan çıkıp oynanışa girer.
13) Günlük paylaşım: Wordle tarzı, sunucusuz paylaşılabilir bir metin ızgarası (hamle, en büyük reaksiyon, yıldız). Seri kaçırılınca sıfırlanmasın, bir basamak düşsün.
14) Gönüllü rehber: Aynı bölümde 4 başarısızlıktan sonra '+5 hamle, en fazla 1★' seçeneği sunulsun. Takılma duvarı olmaz, ustalık değeri de korunur.
15) Mahalle tamamlanınca kısa bir efsane ya da kültür kartı açılsın (Usturlap'ın takımyıldız efsaneleri gibi). Örneğin İskele'nin hikâyesi ya da gerçek bir Türk şenlik geleneği.

KAZANANA AYAR NOTLARI (aşı değil, risk düzeltmesi)
- 1. bölümde ısının tadı verilsin: önceden ısı 2'de tek bir kapsül ve kendiliğinden patlama. Two Dots'tan fark ilk 20 saniyede hissedilir.
- 8-yön bağlantıda bileşenler büyür. Temel renk sayısı 5 olsun; 4 renk yalnız öğretim bölümlerinde kalsın. Bot raporuna 'ortanca zincir uzunluğu' ve 'Yıldız Topu sıklığı' bantları eklensin.
- Kaçak reaksiyona karşı tahta genelinde ortalama ısı izlensin; bölüm doğrulayıcısı reaksiyon boyutu yüzdeliklerini (medyan 0–3, p90 ≈ 12) denetlesin.

### tasarimci (kazanan: FİTİL)

KAZANAN: FİTİL. Gerekçe: dört konseptin içinde 'kolay öğrenilir' (çiz-bırak) ile 'zor ustalaşılır' (kalıcı ısı, şekil, nişan) arasındaki makası en geniş açan, büyük kaskat anını oyuncunun hak ettiği bir ödüle çeviren tek konsept. Ebruli daha özgün ama bilişsel yükü ve 'yardım' bağımlılığı riskli; Rüzgâr Eken fazla cömert (32 üflemenin ~14'ü anında eşleşme) ve yön değişen yerçekimi okunurluğu bozuyor; Usturlap'ta geçerli konum oranı ~%40 olduğu için önizleme ile 'çevir, parlayanı bırak' taramasına dönüşüyor.

ÖNCE KAZANANIN KENDİ AYARI (hızlı simülasyondan):
- Varsayılan ısı eşiği 4 olsun (eşik 3 ile medyan 5 / p90 18 ısı patlaması, hedefin üstünde; eşik 4'te 2 / 9 / 18). Eşik 3 'Kuru Gece' gibi bayram bölümlerine, eşik 2 yalnız şov anlarına kalsın. Alternatif düğme: ısı tavanı (en fazla 2 kalıcı ısı) ya da her N hamlede 1 ısı soğuması.
- Özel taş eşikleri yükseltilsin ya da renk sayısına bağlansın (öneri 6 / 9 / 12; 6 renkte en uzun yol medyanı 6, 4 renkte 9 çıkıyor, mevcut 5/7/10 ile neredeyse her hamle özel taş üretir).
- CI bant denetimine 'reaksiyon boyutu dağılımı' ölçütü zaten var; bunu halka/U/özel taş açıkken de koştur.

EBRULİ'DEN:
1) Oynanıştan üretilen tablo: bölüm sonunda patlama günlüğünden (x, y, renk, nesil, özel tür) belirlenimli olarak çizilen bir 'Gece Tablosu' (kasaba silüeti üstünde o bölümün havai fişek kompozisyonu). Görüntü değil yalnız günlük saklanır, istenince yeniden çizilir. Nadirlik ustalığa bağlansın: Sade / Zarif (3 yıldız ya da halka) / Şaheser (Büyük Final ya da tek hamlede 30+ reaksiyon). Fişek Defteri'nin sandık şansı yerine ya da yanında bu 'hak edilmiş' koleksiyon dursun.
2) Desen hedefi: belirli hücreler belirli bir rengin patlamasını ister; hepsi yanınca tahtada bir motif (fener, lale, yıldız) ışıkla çizilmiş olur. 'Aydınlat' hedefinin renkli, görsel olarak tatmin eden bir türevi.
3) Doğum ağırlığı düğmesi: 'Kehribar az geliyor' gibi kıt renk bölümleri; zincir uzunluğunu ve dolayısıyla özel taş üretimini bölüm bazında ayarlamanın en temiz yolu.
4) Renk + iç motif ikili kodlaması ve döteranopi ekran görüntüsü denetimi.
5) Ebru Şöleni ile Final Gösterisi zaten örtüşüyor; ek olarak 'kurulum hamlesi bile ödüllüdür' ilkesini ısı nabzıyla (ısınan komşu anında turuncu nabız) vurgula.

RÜZGÂR EKEN'DEN:
1) Bölüm sırasında kalıcı dönüşüm: aydınlatılan döşemeler bölüm boyunca kalıcı fener ışığına döner, tahta bölüm sonunda ışıklı bir mozaik olur (çatlak toprak → çayır karşılığı).
2) Telgraflanmış çevre olayı: kenarda geri sayan 'Rüzgâr' oku; 0'a inince bir satıra +1 ısı üfler. Bir hamle önceden titrer; bazen tehlike (kova yanındaki planı bozar), bazen fırsat. Öngörülebilir baskı, tam ısı sistemiyle uyumlu.
3) 'Sıradaki: Dev Fişek!' gibi bir sonraki bölümün yeniliğini gösteren Sonraki düğmesi (merak kancası).
4) Akış serisi: üç bölümü ilk denemede kazanan sonraki bölüme hazır bir roketle başlar; kaybetmek yalnız seriyi sıfırlar, ceza yok.
5) İsteğe bağlı 'Cep' yuvası (kese karşılığı): oluşan bir özel taşı tahtadan cebe almak ve sonra istenen hücreye bırakmak 1 hamle. Ustalık için ikinci bir karar katmanı; geç bölümlerde açılır.
6) '%92 tamamlandı' çubuğu ve 1 saniyenin altında yeniden deneme.

USTURLAP'TAN:
1) Dürüst yakın kaçış metriği bot doğrulamasına girsin: kayıpların en az %30'unda hedefin %80'ine ulaşılmalı, yalnız tasarımla, dolum hilesiyle değil.
2) 'Bu hamle kazandırırdı': kaybedince bot son durumda kazandıracak yolu tahtada fitil hayaletiyle gösterir; başarısızlık öğrenmeye döner.
3) İlk tahta her bölümde sabit (öğrenilebilir plan), dolum tohumu = bölümTohumu ⊕ denemeNo (her deneme taze).
4) Güneş Çekirdeği karşılığı 'Körük Göstergesi': zincir dışı (ısıyla) patlamalar bir göstergeyi doldurur; dolunca oyuncu dilediği an, hamle harcamadan seçtiği 3x3 alana +1 ısı verir. Ne zaman kullanılacağı gerçek bir zamanlama kararı ve ısı sistemini ödüllendirir.
5) Günün Şenliği için sunucusuz paylaşılabilir metin ızgarası (hamle, yıldız, en büyük reaksiyon) ve 'kaçırılan gün seriyi sıfırlamaz, 1 basamak düşürür' kuralı.
6) Aynı bölümde 4 başarısızlıktan sonra gönüllü 'Usta Eli': +5 hamle, en fazla 1 yıldız; zorluk asla gizlice ayarlanmaz.
7) Klavye erişilebilirliği: ok tuşlarıyla imleç, boşlukla düğüm ekleme, Enter ile ateşleme (masaüstü ve erişilebilirlik için).

### muhendis (kazanan: FİTİL)

KAZANAN: FİTİL (4)

Seçim gerekçesi: En yüksek netlik ve his puanı FİTİL'de. Çekirdek fark (kalıcı ısı ile planlanan zincirleme reaksiyon) okunur kalıyor. Gece ve havai fişek teması prosedürel Canvas 2D için en verimli görsel. Kare ızgara ajan ekibi için en az riskli çizim ve girdi yüzeyi. Aşağıdaki aşılar zayıf noktalarını (Two Dots benzerliği, şansa dayalı sandık, sığ orta döngü kararı) kapatmaya yönelik.

EBRULİ'DEN (1)
1) Oynanıştan üretilen tablo: \"Şenlik Fotoğrafı\". Sandığın şans ödülünün yerine ya da yanına, bölümün patlama günlüğünden (x, y, renk, nesil, özel tür) belirlenimli olarak çizilen bir uzun pozlama gece fotoğrafı konur. Parçacık izleri, roket çizgileri, kasımpatı halkaları ve büyük finalde kasaba silueti kullanılır. Günlük sıkıştırılıp kaydedilir (~1 KB), görüntü saklanmaz, istendiğinde yeniden çizilir. Nadirlik ustalığa bağlanır, şansa değil: Sade → Parlak (3★ ya da 25+ reaksiyon) → Şaheser (Büyük Final ya da 40+ ŞENLİK). Fişek Defteri böylece oyuncunun kendi tablolarıyla dolar.
2) Desen hedefi: \"Işık Deseni\". Belirli döşemeler belirli bir renkte patlama ister. Hepsi yanınca bir motif (fener, lale, kayık) tamamlanır ve mahallenin haritasındaki binaya işlenir. Bu, \"Aydınlat\" hedefine renk boyutu ekler; zincir rengini seçmeyi stratejik yapar.
3) Bölüm verisinde \"yardım n\" düğmesi, yalnız erken bölümlerde ve açık bir parametre olarak kullanılır: kilitlenmeye yakın tahtada doğan kapsüller aynı akıştan en fazla n kez yeniden çekilir. Böylece öğretim bölümlerindeki bot ≥%95 bandı dolum hilesi gizlenmeden tutar. 20'den sonra 0 olur.
4) \"Kurulum hamlesi bile küçük ödül\" ilkesi: kısa ama ısı bırakan bir zincir de görünür ödül vermeli. Isınan kapsüllere küçük bir nota ve köz parıltısı eklenir, oyuncu \"hazırlık\" yaptığını duyar.

RÜZGÂR EKEN'DEN (2)
5) Telegraflı çevre olayı: \"Çisenti\" (ya da \"Deniz Meltemi\"). Kenarda geri sayan bir bulut vardır; sayaç 0'a inince bir satırın ya da sütunun ısısını 0'a indirir, bir hamle önceden titrer. Isı stratejisine öngörülebilir bir karşı baskı ekler (doğa esintisinin FİTİL karşılığı); oyuncu \"önce bu satırı ateşle\" kararını verir.
6) Akış serisi: \"Şenlik Coşkusu\". Üst üste 3 bölümü ilk denemede kazanan, sonraki bölüme ısı 2'de bir roketle başlar. Kaybetmek yalnız seriyi sıfırlar, ceza yoktur.
7) Kazanma ekranında merak kancası: \"Sonraki: Dev Fişek!\" ile bir sonraki yeniliğin küçük bir önizlemesi gösterilir.
8) Dürüst bot ölçümü: Usta bot gerçek dolum akışını görmez, adayları kendi örnek RNG'siyle değerlendirir. Böylece yıldız eşikleri ve bantlar insan deneyimine daha yakın çıkar.
9) 40. bölümden sonra \"Sonsuz Şenlik\": üreteç ve tarayıcı içi bot süzmesi (en fazla 50 deneme), yalnız hedef bandına düşen bölümleri yayınlar. Aynı boru hattı Günün Şenliği'ni de besler.
10) Kalıcı görsel dönüşüm: aydınlatılan döşemeler bölüm boyunca sönmeyen sıcak bir ışıkla kalır, bölüm sonunda sandık tamamen ışıl ışıl olur (çatlak toprak → çayır hissinin karşılığı).

USTURLAP'TAN (3)
11) Bölüm ortası karar: \"Kıvılcım Kazanı\" (Güneş Çekirdeği). Isıyla patlayan her kapsül kazanı doldurur. Dolunca oyuncu dilediği an dokunur (hamle sayılmaz) ve seçtiği 3×3 alana +1 ısı verir ya da rastgele 2 kapsülü kasımpatıya çevirir. Ne zaman kullanılacağı gerçek bir seçimdir.
12) Dürüst yakın kaçış analizi: kaybedince 1 hamle ileri bakan bot gerçekten kazandıracak bir çizgi varsa onu tahtada hayalet fitil olarak oynatır (\"Bu çizgi kazandırırdı\"). Başarısızlık öğrenmeye döner. CI'ya yakın kaçış ölçütü eklenir: kayıpların ≥%30'unda hedefin ≥%80'i tamamlanmış olmalı, yalnız tasarımla sağlanmalı.
13) Gönüllü \"Kıvılcım Usta'nın Eli\": aynı bölümde 4 başarısızlıktan sonra +5 hamle sunulur, en fazla 1★ verir. Can duvarı olmadan takılmayı önler.
14) İlk tahta bölüm başına sabit, dolum tohumu = bölümTohumu ⊕ denemeNo (FİTİL'de zaten var). Bunu oyuncuya açıkça \"plan öğrenilebilir, her deneme taze\" diye hissettirmek ve Pusula benzeri, RNG anlık görüntülü bir \"geri al\" aracını (yalnız oyunla kazanılır, Usta rozetini kapatır) eklemek.
15) Paylaşılabilir günlük sonuç metni: emoji yerine ▲ ● gibi karakterlerle zincir, hamle ve yıldız ızgarası, sunucusuz. Ayrıca klavyeyle erişilebilirlik: ok tuşlarıyla yol çizme ve Enter ile ateşleme.

KAZANANA ÖNERİLEN DÜZELTMELER
- Uzun zincir enflasyonunu kısmak için renk sayısı ve eşik verisiyle dengelenir. Gerekirse öğretimden sonra çapraz bağlantı, yolda en fazla k çapraz adımla sınırlanır.
- Kural zamanlama sabitleri (t_k, 90 ms, 25 ms/mesafe) sunum hızından ayrı tutulur: çekirdekte \"tik\" birimiyle tanımlanır, çizici ölçekler. Böylece animasyon hızlandırma kuralları değiştirmez.
- Sandıktaki %60 güçlendirici payı düşürülür; birincil ödül ustalığa bağlı tablo ve desenler olur.
