# BARUT — çalışma notları

Turbofan'dan, FİTİL'den, EBRULİ'den ve LODOS'tan BAĞIMSIZ küçük oyun:
çöp adamlı, yıkımlı helikopter savaşı. Canvas 2D + TypeScript + Vite,
bağımlılık yok (yazı tipi, sprite, ses hepsi kodda; altyapı LODOS'tan).
Dil kuralı geçerli: kullanıcıyla, kod yorumlarında ve commit mesajlarında
Türkçe. Arayüz metinleri BÜYÜK HARF Türkçe.

Esin: kullanıcının beğendiği taramalı, gündüz, yıkımlı çöp adam oyunu
videosu. O oyunun kopyası DEĞİL: konu, çizimler ve kurallar özgün; ortam
kurgusal, gerçek ülke/ordu/bayrak yok. Tarzı koru, başka oyunu taklit etme.

Kullanıcı geri bildirimi (Kasım 2026, LODOS için): "kalite düşük, piksel
sayısı az, göz yoruyor". Bu yüzden burada açık zemin, düz tonlar, ince
tarama ve daha yüksek çözünürlük var. Siyah zemine seyrek beyaz nokta
(gürültülü tarama) YAPMA.

Yayın: https://claude.ai/artifact/EWcMNfL86UpbVwS6N42QeM (`npm run build:single`
→ `dist-single/artifact.html` aynı yolla yeniden yayınlanır; yetenek yok,
rekor yalnız cihazda `localStorage`).

## Komutlar (bu klasörde)

```powershell
npm ci
npm run dev                 # http://localhost:5173
npm test                    # vitest (simülasyon + bot pilot)
npm run typecheck
npm run build:single        # → barut.html + dist-single/artifact.html
node scripts/shot.mjs <url> <png> [w] [h] [js]      # L = window.__barut
node scripts/kayit.mjs <url> <klasör> [başlangıç-sn] [süre-sn] [fps]
node scripts/oynanis.mjs <url> <klasör> [en-çok-sn] [kazanç] [kenar-itme 0|1]   # gerçek girdiyle, gerçek zamanda
```

## Kod haritası

- `src/tuval.ts` — açıklık tamponu (0 mürekkep … 255 kâğıt) + vurgu katmanı
  (kan, ateş, kuru kan, akkor). `sun()` 7 gri kademeye indirir; ara değerler
  komşu iki kademe arasında Bayer 4×4 ile taranır. Kademelere denk gelen
  değerler (0, 42, 85, 128, 170, 213, 255) DÜZ görünür; düz yüzeylerde
  bunları kullan, ara değerleri yalnız geçiş ve duman için. `leke()` yarı
  saydam duman/toz, `cizDon()` döndürülmüş sprite.
- `src/sprite.ts` — sprite'lar `Boya` ile çizilir (çokgen `p`, kutu `k`,
  daire `o`, çizgi `c`, nokta `n`, `teker`); gövde düz tonlarla boyanır,
  `kenar()` siluete 1 piksel mürekkep çeker, ince ayrıntı (cam, panel
  çizgisi, perçin) kenardan SONRA eklenir. Hepsi sağa bakar. Her sprite'ın
  dönme merkezi ve bağlantı noktaları (direk ucu, namlu) yorumunda yazılı;
  `sahne.ts`'teki `cizDon`/`yerel` çağrıları bu sayılara bağlı.
- `src/dunya.ts` — simülasyon: helikopter (yay-sönüm, otomatik top + roket),
  askerler (koş/nişan/panik/yanıyor), araçlar (tank, uçaksavar, kamyon),
  hava (düşman helikopteri, jet, dost nakliye), mermiler, `patlat()` (hasar,
  krater, panik, zincirleme), bez bebek (7 nokta verlet, kopabilen bağlar),
  parçalar, dalgalar. Tohumlu RNG, sabit 1/60 s adım, `olaylar` kuyruğu.
- `src/sahne.ts` — çizim, `K = 1,5` katı çözünürlükte (ekran `EK = 360`
  piksel). Simülasyon dünya biriminde kalır; dünya → ekran yalnız `X()` ve
  `Y()` ile. Açılışta üretilenler: uzak katman (soluk şehir), orta katman
  (pencereli, balkonlu, top yemiş binalar), toprak dokusu (dünyaya sabit:
  katmanlar, taşlar, kökler, boru, kemikler). Çöp adamlar kodla çizilir
  (`adam`: iki parçalı uzuv, miğfer, sırt çantası). HUD ekran pikselinde.
- `src/ses.ts` — WebAudio sesleri. `src/main.ts` — döngü, göreli sürükleme,
  `window.__barut` (`dondur`, `ilerlet(sn)`, `basla`, `ciz`, `dunya`).

## Kurallar ve tuzaklar

- Dünya genişliği `G = 240` birim; çizim `K = 1,5` ile 360 piksel
  (telefonda piksel başı ≈ 1 CSS pikseli). Kullanıcı "daha detaylı" isteyince
  simülasyona dokunmadan yalnız çizim ölçeklendi. Dünyayı 360 birim yapmak
  denendi: birimler küçücük kaldı. Yazı ölçeği HUD'da 3.
- Kamera pikseli kare başına BİR kez yuvarlanır (`kam`); her şey
  `round(wx*K) - kam` ile çizilir, yoksa kayarken nesneler birbirine göre
  titrer. Zemin sütunları `yer[]` arasında doğrusal ara değer alır.
- Ufkun altı koyu toprakla doldurulur: derin çukurun içinden gök (beyaz)
  görünmesin (kullanıcı ekran görüntüsüyle yakaladı).
- Sandık halatla alınır: helikopter üstündeyse (yatay < 30, 150'ye kadar
  aşağıda) sandık yukarı çekilir. Çukura inmek gerekmez; helikopterin inme
  sınırı çukur dibine yetmiyordu.
- Uyuyan bez bebek altı oyulunca uyanır (`krater` içinde); 7 sn yatınca ya
  da sayı 30'u geçince `yigin()` ile zemine karışır ve araziyi yükseltir
  (`les[]` doku izi). Hurda 15 sn sonra aynı şekilde. Kullanıcı isteği:
  "cesetler birikse dağ olsa".
- Modeller gerçek araç siluetlerinden esinli (kullanıcı isteği: "olabildiğince
  yakın"): T129/A129 çizgisinde saldırı helikopteri, Mi-24, T-72, ZSU-23-4,
  Ural, MiG-21, C-130. İşaret, bayrak, ülke YOK. Bağlantı noktaları
  `*_N` sabitlerinde (`ox, oy`, `direk`, `namlu`, `kule`…); sprite'ı
  değiştirince onları da güncelle.
- Araçlar zemine oturur: `durus()` ön/arka temas noktasından eğim ve taban
  verir, gövde `cizDon` ile yatar, kule gövdeye 1 piksel biner (boşluk
  kalmasın), namlu dengelidir (dünya açısında kalır; simülasyondaki atış
  yönüyle aynı olsun diye).
- Kamera: helikopter ekranın sol %30'unda, ±16 birimlik serbest kuşakla.
  Yöne göre öne atlama YOK (sürüklerken helikopteri ekranda geri kaydırıp
  "takılıyor" hissi veriyordu). Ortaya almak da olmaz: düşmanın %64'ü ekran
  dışında ölüyordu (playtest).
- Sürükleme: yatay kazanç parmak hızıyla 1,35 → 2,6 arası (fare ivmesi),
  dikey 1,25 sabit; parmak ekran kenarındaysa helikopter gitmeye devam eder.
- Kan izi zamanla kurur ve silinir (`kanSayac`); taze parlak, eski koyu.
- OKUNABİLİRLİK KURALI: mürekkep siyahı yalnız hareketli birliklerindir
  (asker, araç, mermi). Dekor (sokak döküntüsü, ağaç, dikenli tel, ot) gri
  tonlarla ve koyu gri kenarla çizilir (`kenar(T2)`). Dekor siyah olunca
  askerler arada kayboluyordu.
- Piyade çeşitleri (`T_TUFEK`, `T_ROKET`, `T_MAKINELI`, `T_NISANCI`,
  `T_SUBAY`; `piyadeMi()`): makineli yavaş yürür, yüzüstü yatıp 4'lük seri
  atar; keskin nişancı uzakta diz çöker, 1 sn lazerle nişan alıp hızlı tek
  mermi atar (9 can); subay ölünce çevresindekiler panikler. `kilik` tohumu
  görünüşü seçer (başlık, çanta, atkı, boy farkı, süngü); davranışı
  etkilemez. Çizim: `adam()` → `sapka()`, `canta()`, `silah()`, `yuzustu()`.
- Üs (`siper()`): arka geçişte bayrak, çadır, cephanelik, telsiz direği,
  kütük çatılı sığınak, gözetleme kulesi; ön geçişte kule korkuluğu,
  makineli yuvası, iki sıra kum torbası duvarı, dikenli tel. Hasar
  eşikleri 66 / 50 / 33 / 0. Dostların görevi `rol`: 0 duvarda tüfekçi,
  1 ağır makineli (6'lık seri), 2 kule nöbetçisi (`yukseklik` 44), 3 subay
  (dürbün, ateş etmez). Dalga arasında sevinirler.
- `GIRIS_X`'in sağındaki düşman hedef alınmaz, vurulmaz; helikopter
  `HELI_SAG`'dan öteye geçemez. Yoksa oyuncu doğum noktasında pusu kurar ve
  ekranda hiç kalabalık oluşmaz (bot kaydı gösterdi).
- Dizi üstünde geriye doğru dönerken `patlat`/`siperHasar` başka elemanları
  silebilir: döngü başında `if (!s) continue` koruması var, kaldırma.
- Krater derinliği `zemin + 11` ile sınırlı; aynı yere düşen patlamalar
  çukuru sonsuza kadar derinleştirmesin. Yalnız `kazi` patlamaları (oyuncu
  bombası, mayın) `zemin + 38`'e kadar oyar; gömüler 11–29 piksel derinde.
- Gömüler (`gomuler`): her kraterden sonra `gomuKontrol` bakar; üstü 5
  piksele inen mayının fitili yanar (0,4 sn), sandık fırlar. Top ve roket
  düşmana nişan aldığı için toprağı yalnız bomba bilerek kazar.
- Bomba girdisi üç yoldan: düğme (`bombaDugme`, çizim ve dokunma aynı yeri
  kullanır), sürüklemeden kısa dokunuş (< 240 ms, < 5 piksel), sürüklerken
  ikinci parmak. Oyunu başlatan ilk dokunuş bomba saymaz (`ipucuT > 0,4`).
- Bot pilot ≈ 2–3 dakikada 5.–6. dalgada düşer (≈ 4000–9000 puan). Dengeyi
  değiştirince `kayit.mjs` özetine ve `dunya.test.ts` eşiklerine bak.
- vitest `console.log` göstermez; ayıklama için `scripts/*.tmp.test.ts`
  içinde dosyaya yaz, işin bitince sil.

## Playtest (Kasım 2026, `scripts/oynanis.mjs`, 3 el)

Betik oyunu gerçek fare/dokunma olaylarıyla gerçek zamanda oynar, 2 sn'de
bir kare ve yarım saniyede bir ölçüm alır. Elle oynamanın yerini tutmaz
(his ölçülmez) ama girdi yolunu, kareleri ve sayıları gösterir.

- İyi: 60 fps; dalga başı 25–30 sn; bot 5.–7. dalgada düşüyor; hasar
  çeşitli (tank topu ve RPG asıl öldürücü, kurşun küçük); sandıklar
  alınıyor; parmağı kaldırıp yeniden sürükleme gerekmiyor.
- Düzeltildi: düşman ekran dışında ölüyordu (kamera); bütün zemin kırmızı
  oluyordu (kan kuruyor); leş yığını 150 sn'de tavana vuruyordu (yavaşladı).
- AÇIK, en önemlisi: oyun tek noktada oynanıyor. Helikopter sürenin %86'sında
  sağ sınırda (`HELI_SAG`) duruyor, düşman hep aynı yerde ölüyor, ekrandaki
  görüntü hiç değişmiyor, siper ilk dalgalarda hiç tehlikeye girmiyor.
  Öneri: siperi dünyanın ortasına al, düşman iki yandan gelsin (iki cephe);
  ya da düşmanı helikopterin arkasına indiren paraşütçüler.
- AÇIK: ekranın üst %45'i hep boş gök. Yüksek binalardaki nişancılar
  (paket 2) ve hava hedefleri burayı kullanmalı.
- AÇIK: bot bombayı az kullanıyor; insanın ne yaptığı bilinmiyor.

## Yol haritası (kullanıcı kararları bana bıraktı, Kasım 2026)

Kaynak: kullanıcının kız arkadaşının el yazısı notları + benim önerilerim.
Hedef: ücretsiz Android oyunu (FİTİL'deki Capacitor yolu), belki sonra PC.
Oyunun kimliği: normal savaş olarak başlar, dalga ilerledikçe saçmalaşır.
Paketler birer oturumluk; kullanım sınırı yüzünden teker teker.

1. ✅ **Toprak ve bomba:** elle bomba, gömülü mayın ve sandık, üç süreli
   güçlendirme (çift top, hız, bomba yağmuru), araçlardan ödül düşmesi.
2. **Tabya ve bina:** tuğla tuğla yıkılan, üstü kapalı, içinde asker olan
   ve ateş eden tabya; arka plan binalarının pencerelerinden nişancılar;
   hızlı makineli jeep; hasar alan araçtan sağ atlayıp dağılan askerler;
   yıkılan yapılardan güçlendirme.
3. **Saçmalık başlasın:** üst üste binip dev çöp adam olan askerler (her
   parçası ayrı bez bebek; vuruldukça dökülür; oyunun imzası), lazerli
   asker, helikopteri lazerle vuran UFO.
4. **Gelişim:** birkaç dalgada bir üç seçenekten biri, destek helikopteri,
   paraşütle inen DOST takviye, 10–20 dalgada bir mutasyon patronu.
5. Android paketi (Capacitor), kansız mod düğmesi.

Yorum kararları: "silahsız kaçışanlar" hedef değil moral bozukluğu (silahını
atıp kaçar, top ateş etmez, puan yok). Notlardaki "HPC" güçlendirme kutusu
diye okundu.

## Diğer fikirler

Kanca (halatla sandık/enkaz/asker taşıma; LODOS'un ip fiziği), günün görevi
(aynı tohum + skor tablosu, sayfa yeteneği db + user), büyük patlamada ağır
çekim ve paylaşılacak "en iyi an" karesi, askerlere isim ve rütbe, gerçek
ses tasarımı, yeni bölgeler (köprü, liman). Sedyeyle ceset toplayan
sıhhiyeler (kullanıcı fikri; top onlara ateş etmez).
