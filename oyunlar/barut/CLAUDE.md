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
- `src/dekor.ts` — açılışta bir kez boyanan dekor: uzak katman (iki sıra
  soluk yapı, düzenli pencere ızgarası), orta katman (üç cephe tarzı:
  apartman, iş hanı, eski taş bina; balkon, yangın merdiveni, çatı panosu,
  top deliği, yangın izi) ve yıkılabilir binaların derisi (`binaDerisi(tur)`:
  ev 72×60, dükkân 72×42, atölye 84×48 piksel; 0 saydam, 1 mürekkep).
- `src/ses.ts` — WebAudio sesleri. `src/main.ts` — döngü, göreli sürükleme,
  `window.__barut` (`dondur`, `ilerlet(sn)`, `basla`, `ciz`, `dunya`).

## İki cephe (Kasım 2026, kullanıcı kararı)

Siper dünyanın ortasında (`SIPER_X = 480`, ön kenarlar ± `SIPER_YARI = 60`),
dünya `DUNYA_G = 960` birim; düşman iki kenardan girer. Playtest'in en büyük
bulgusu buydu: tek cephede helikopter sürenin %86'sında aynı noktada duruyordu.
Bot şimdi sürenin ~%50'sini her cephede geçiriyor.

- Bir birliğin yanı konumundan okunur: `yanOf(x)` (+1 sağ, sola yürür; −1
  sol, sağa yürür), `onMesafe(x)` (siperin o yandaki ön kenarına uzaklık).
  Siperi kimse geçemediği için yan değişmez; ayrı alan tutulmaz. Yeni yönlü
  kod yazarken `x -= …` YAZMA: `gid = -yanOf(x)` ile çarp. Aracın `dur`u
  mutlak x'tir (`on + yan * uzaklık`); "varmadı mı" = `(x - dur) * yan > 0`.
- Dalgalar (`kuyruk: {tip, yan}`): 1. sağdan, 2. soldan; 3. ve 4. dalga iki
  YARI (önce bir yan, bitince öbürü); 5. dalgadan sonra 6–10'luk öbekler
  hâlinde yan değiştirir. Her yan değişiminde doğum durur (5 sn, 5. dalgadan
  sonra 3 sn) ve `cephe` olayıyla "ŞİMDİ SOLDAN!" duyurulur. Kullanıcı ilk
  sürümde (3. dalgadan itibaren 4–8'lik öbeklerle sürekli yan değişimi)
  "ikisine de yetişmek zor, 2. levelda bile zorlandım" dedi.
- CEPHE GEÇİŞİ: kenardaki ok artık düğme (`cepheDugme`, çerçeveli; çizim ve
  dokunma aynı yeri kullanır). Dokununca `cepheyeGit(yan)`: helikopter o
  cephedeki en ilerideki düşmanın 45 birim gerisine (siperden en çok 300)
  kendiliğinden uçar: hedef 470/sn kayar, en yüksek hız 480, biraz yükselir,
  arkasında hız çizgileri; kamera ve `kam.oran` geçişte hızlanır. ~500
  birim ≈ 1,5 sn. İlk 0,25 sn'den sonra sürüklemek iptal eder. Klavyede Q/E.
  Asıl yorucu olan cepheler arası yolu parmakla sürüklemekti.
- Üs simetrik: ortada kule (nöbetçi iki yana ateş eder), her duvarda iki
  tüfekçi + bir makineli yuvası (`kadro`: dx, rol, yükseklik, baktığı yan),
  subay ortada. Ön geçiş `P(px, w)` ile sol yana aynalanır. Siperin önündeki
  ilk ~100 birimde süs yok (araç ve asker orada durur, karışmasın).
- Kamera: helikopter siperin sağındaysa ekranın sol %36'sında, solundaysa
  sağ %36'sında (`kam.oran`); geçiş helikopterin KONUMUNA bağlı ve yavaş
  (saniyede 0,09). Yöne bağlı öne atlama yine YOK. Roket menzili 172 → 150
  (ekranda kalsın). Kamera iki kenardaki doğum şeridini (44 birim) göstermez.
- `cepheHud()` / `cepheBilgi(yan)`: ekran dışındaki düşmanlar için o kenarda
  düğme (ok + sayı); en yakını sipere 130'dan yakınsa kırmızı yanıp söner. Uçak uyarısı geldiği
  kenarda (`jetUyariYan`). Köprücü ve bekleme sayaçları cephe başına
  (`kopruSayac[2]`, `askerBekliyor[2]`); köprü `kok` ucundan açılır.
- Cip HMMWV çizgisinde; oranlar kullanıcının gönderdiği yan görünüşten
  (kopya değil, hatlar): tavandan kuyruğa UZUN eğik arka, düz tavanda kapak,
  dik ön cam, alçalan uzun kaput, iki kapı (üstte koyu cam, altta çapraz
  baskı), gövdenin altına taşan iri tırtıllı tekerler (teker merkezi eşik
  hizasında), düz tavanlı çamurluk boşlukları, kuyrukta uzun kamçı anten,
  önde turuncu arkada kırmızı lamba (vurgu katmanı), iri köşeli kamuflaj
  lekeleri. Nişancı tavandaki kapaktan belden yukarı görünür. Kabinin önü
  DİK (yandan cam görünmez), hemen önünde uzun çerçeveli ayna; kaput kabine
  cam alt hizasında bağlanır, yanında girintili koyu panel + kayış, üstünde
  kaldırma halkası (kullanıcı: "ön cam kısmı olmamış": ayna öne yapışık koyu
  bir bloktu, kaput alçaktı). Anten tavanı 17 piksel aşar: araç `JEEP_ANTEN`
  satır aşağıda çizilir, bağlantı noktaları buna göre.
- Makineli cip (`T_JEEP`): hızlı (58), 3 can; sipere 50–90 birim sokulup
  5'lik seri atar (seri başı 2,5 hasar), helikopter 135 içindeyse ona döner.
  Oyuncu öbür cephedeyken geri dönmeye zorlar; 3. dalgadan sonra gelir.
  Mürettebat ve namlu çizimde eklenir (hurdada görünmesinler); `yuk = 2`
  vurulunca savrulan iki kişidir. `piyadeMi()` üst sınırlıdır: yeni araç
  tipi eklerken `>= T_MAKINELI` gibi açık uçlu koşul YAZMA (cip piyade
  sanılıp asker olarak doğuyordu).
- Kenar itme 230/sn (cepheler arası ~500 birim; parmak kenardayken geçiş
  ≈ 2 sn).

## Hangar ve ilerleme (Kasım 2026, kullanıcı fikri)

"Dandik helikopterle başlayalım (7,62'lik minigun), roketleri, tanksavar ve
hava füzelerini açarız, ek zırh takarız, sonra bir sonraki helikoptere
geçeriz; en sonda dikey kalkışlı jet. İlerleme tablosu için War Thunder'ı
kullanabilirsin." Yapı araştırma ağacından esinli; adlar, sayılar ve ekran
bize ait (o oyunun arayüzü, adları, varlıkları kopyalanmaz).

- `src/hangar.ts`: `HELILER` (hat), geliştirmeler (`ModTanim.uygula`), kayıt
  (`localStorage` `barut.hangar.v1`: `ap`, `sahip`, `secili`, `mod`; bozuk
  kayıt ayıklanır), `donanimKur(kayit)` → `Donanim`. `src/hangarEkran.ts`:
  ekran; çizerken dokunma bölgelerini döndürür (çizim ve dokunma aynı sayılar).
- Simülasyon yalnız `Donanim`ı bilir (`Dunya` kurucusunun 3. değişkeni):
  `tur` (görünüş), `can`, `hiz`, `zirh` (kurşun hasarını azaltır), `topAra`,
  `topArac`, `topTank`, `roket` (0: yok), `atgm`, `aam`, `bomba`.
  `VARSAYILAN_DONANIM` = geliştirmesiz ağır saldırı = ESKİ DENGE; testler ve
  botlar bunu kullanır, sayıları değiştirme.
- AP = skor / 8, oyun bitince eklenir. Hat: KEŞİF (Alouette III çizgisinde;
  minigun piyadeyi biçer, tanka işlemez; roketi yok; 65 can, 2 bomba) →
  [SALDIRI: yakında] → AĞIR SALDIRI (AH-64 çizgisinde, 3500 AP) → [DİKEY
  KALKIŞLI JET: yakında]. Keşif geliştirmeleri: roket yuvası 250, çift şerit
  300, motor 350, bomba askısı 400, ek zırh 450. Ağır saldırı: tanksavar füze
  900 (`M_ATGM`: yalnız araca, tankı tek atar, 4,5 sn), hava füzesi 900
  (`M_AAM`: 240 menzil, 5 sn), zırh delici 700, motor 600, ek zırh 800.
- Bot ölçümü (6 tohum, ort.): çıplak keşif hep 3. dalgada düşer, 170 AP/oyun;
  tam keşif 3.–7. dalga, 640 AP; çıplak ağır 4.–7., 900 AP; tam ağır 5.–10.,
  2200 AP. Ağır saldırıya ≈ 10–15 oyun. Yeni helikopter ya da geliştirme
  ekleyince bu tabloyu yeniden ölç.
- Yeni helikopter eklemek: `sprite.ts`'te sprite + `*_N` + hurda,
  `sahne.ts` `HELI_CIZIM`e satır (sıra = `Donanim.tur`), `hangarEkran.ts`
  `SPR`, `hangar.ts` `HELILER`de `yakinda`yı kaldır. Sprite için kullanıcıdan
  örnek iste: gözle çizilenler iki kez beğenilmedi.
- Akış: başlıkta ve sonuç ekranında HANGAR düğmesi (`hangarDugme`); başlığın
  başka yerine dokunmak oyunu başlatır. Deneme: `scripts` yok, geçici
  Playwright betiğiyle `localStorage`a kayıt yazıp dokunarak denendi.

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
  yakın"): oyuncu helikopteri AH-64 çizgisinde; oranlar kullanıcının
  gönderdiği piksel örnekten ("bire bir kopyalama, hatlar ve oranlar böyle"):
  uzun ALÇAK gövde, uzunluğun üçte biri kadar ince ve hafif yükselen bom,
  burna yakın DÜZ TAVANLI iki panelli koyu kabin, hemen arkasında ince direk
  ve küçük iki kademeli kubbe, kabinle aynı yükseklikte motor kaportası,
  düz karın, burun altında uzun namlulu top, önde ana teker, kuyruk ucunda
  uzun dikmeli teker, geriye yatık dar dikme. İlk denemem kısa ve tombuldu;
  ikincide bom gövdenin ÜSTÜNDEN çıkıyordu ve karın basamakla bitiyordu
  (kullanıcı: "alt arka kısmı olmamış"). Doğrusu: motorun arkasında sırt
  alçalır, karın yükselir, ikisi orta-alt hizadaki boma kavuşur; kuyruk
  tekeri bom ucundan inen dolu bir dikmededir, yatay denge alçaktadır.
  ÖLÇEREK ÇİZ: örnekteki noktaların (x, y) değerlerini sprite ölçeğine çevir,
  8 kat büyütüp örnekle yan yana bak; göz kararı iki kez tutmadı. Mi-24, T-72,
  ZSU-23-4, Ural, HMMWV, MiG-21, C-130. İşaret, bayrak, ülke YOK. Bağlantı noktaları
  `*_N` sabitlerinde (`ox, oy`, `direk`, `namlu`, `kule`…); sprite'ı
  değiştirince onları da güncelle.
- Araçlar zemine oturur: `durus()` ön/arka temas noktasından eğim ve taban
  verir, gövde `cizDon` ile yatar, kule gövdeye 1 piksel biner (boşluk
  kalmasın), namlu dengelidir (dünya açısında kalır; simülasyondaki atış
  yönüyle aynı olsun diye).
- Kamera: ±16 birimlik serbest kuşak; helikopterin ekrandaki yeri için "İki
  cephe" bölümüne bak. Yöne göre öne atlama YOK (sürüklerken helikopteri
  ekranda geri kaydırıp "takılıyor" hissi veriyordu).
- Sürükleme: yatay kazanç parmak hızıyla 1,35 → 2,6 arası (fare ivmesi),
  dikey 1,25 sabit; parmak ekran kenarındaysa helikopter gitmeye devam eder.
- Kan izi zamanla kurur ve silinir (`kanSayac`); taze parlak, eski koyu.
- OKUNABİLİRLİK KURALI: mürekkep siyahı yalnız hareketli birliklerindir
  (asker, araç, mermi). Dekor (sokak döküntüsü, ağaç, dikenli tel, ot) gri
  tonlarla ve koyu gri kenarla çizilir (`kenar(T1)`; gövde T3/T5, ışık T5/B,
  gölge T2). Dekor siyah olunca askerler arada kayboluyordu. T4 gövde arka
  plan binalarıyla (170) aynı tonda kaybolur, kullanma.
- Sabit süs sprite'larında alt orta yere oturur (`w >> 1, h - 1`); lamba
  ayna alınabildiği için kaidesi (8, 67)'de. Kalın parça `Boya.kal()` ile
  çizilir, `kenar()`dan sonra ışık/gölge çizgisi eklenir; ince sürgün
  kenardan SONRA tek piksel çizilir (kenarlı ince çizgi 3 piksel kalın ve
  kapkara oluyor; ağacın tacı ilk denemede koyu bir yumaktı).
- Hurdalar `hurda()` ile sağlam sprite'tan türetilir (`SPR_H_*`): kül grisi
  gövde, koyu gri çizgi, isabet çevresinde is, köşeli delik (`acik` olan
  silueti koparır). Eskiden düz siyah siluetti (`koyu = 255`). Sprite'ı
  değiştirince delik yerlerine de bak.
- Piyade çeşitleri (`T_TUFEK`, `T_ROKET`, `T_MAKINELI`, `T_NISANCI`,
  `T_SUBAY`; `piyadeMi()`): makineli yavaş yürür, yüzüstü yatıp 4'lük seri
  atar; keskin nişancı uzakta diz çöker, 1 sn lazerle nişan alıp hızlı tek
  mermi atar (9 can); subay ölünce çevresindekiler panikler. `kilik` tohumu
  görünüşü seçer (başlık, çanta, atkı, boy farkı, süngü); davranışı
  etkilemez. Çizim: `adam()` → `sapka()`, `canta()`, `silah()`, `yuzustu()`.
- Üs (`siper()`): arka geçişte bayrak, çadır, cephanelik, telsiz direği,
  kütük çatılı sığınak, gözetleme kulesi; ön geçişte kule korkuluğu ve HER
  İKİ YANDA makineli yuvası, iki sıra kum torbası duvarı, dikenli tel. Hasar
  eşikleri 66 / 50 / 33 / 0. Dostların görevi `rol`: 0 duvarda tüfekçi,
  1 ağır makineli (6'lık seri), 2 kule nöbetçisi (`yukseklik` 44), 3 subay
  (dürbün, ateş etmez, helikopteri izler). Dalga arasında sevinirler.
- Dost askerler (kullanıcı: "base'deki askerler kötü duruyor"): duvardaki
  tüfekçiler atış basamağında durur (`yukseklik` 6), göğüsten yukarısı kum
  torbalarının üstünde kalır; eskiden yalnız miğferleri görünüyordu. Açık
  renkli yelek + başın üst yarısını örten açık miğfer (geniş kenarlı miğfer
  mantar gibi duruyordu), kalın bacak. Makineli ve subay çizimi `yon`a göre
  aynalanır (iki cepheden sonra sol yuvadaki makineli ters duruyordu).
  Düşman bacağı İNCE kalır: kalabalıkta kalın bacak yumak oluyor (denendi).
  Sağ yanda büyük komuta çadırı askerlerin arkasında fon olur.
- Kenara `GIRIS` (62) biriminden yakın düşman hedef alınmaz, vurulmaz
  (`sahnede()`); helikopter kenarlara `HELI_KENAR` (96) biriminden fazla
  yaklaşamaz (kullanıcı: "sağa sola daha çok gidilebilsin"; eskiden 215).
  Tek cephedeyken sınır pusuyu önlüyordu; iki cephede bir kenarda beklemek
  öbür cepheyi boş bırakır, sınır gevşetilebildi.
- Dizi üstünde geriye doğru dönerken `patlat`/`siperHasar` başka elemanları
  silebilir: döngü başında `if (!s) continue` koruması var, kaldırma. Aynı
  hata gömülerde de çıktı (mayın patlarken krater başka gömüleri çıkarıyor);
  oynanış testi yakaladı, testi var.
- Zemin `yuk * 0,70`'te: toprak kesiti ekranın alt %30'u (kullanıcı isteği:
  derinlik artsın). Krater derinliği `zemin + 11` ile sınırlı; yalnız `kazi`
  patlamaları (oyuncu bombası, mayın) `zemin + 88`'e kadar oyar. Gömüler
  11–75 birim derinde; sığ olanı 1–2 bomba açar.
- Araçlar ve düşman askerleri `yolY()` üstünde yürür (zemin ya da köprü).
  ASKERLER DE `engel()` kuralına uyar (kullanıcı: "askerler çukurdan
  geçebiliyorsa köprünün mantığı yok"): derin çukurun başında dururlar
  (`engelli`; kılığa göre kenardan 0–28 birim geride, üst üste binmesinler),
  oradan ateş edebilirler, köprücüyü onlar da çağırır. Panikleyen ve yanan
  asker çukur kenarında geri döner. Çukur dibinde duvara dayanan asker
  köprücü çağırmaz (yoksa sonsuz köprücü gelirdi). Altı 7 birimden çok
  oyulan sabit süs yok olur (çukurun içinde asılı kalıyordu).
  `engel()`: 16 birim ileride 14'ten derin iniş (ve varılan yer `zemin + 18`
  altındaysa: leş yığınının öbür yüzü çukur sayılmaz, köprü çağırmaz) ya da
  34'ten yüksek duvar varsa araç durur (`engelli`). Tek bomba çukuru geçilir, üst üste
  bombalanan geçilmez. Bekleyen varsa 16 sn'de bir köprücü (`T_KOPRUCU`)
  gelir, çukur başında 2 sn'de köprü serer (`kopruKur`, en çok ~110 birim).
  Köprü 7 can; patlamayla çöker, üstündeki araç ve askerler ölür.
  Çukur başında kalan kamyon askerlerini indirir; menzildeki tank ateş eder.
- Yıkılabilir binalar (`binalar`, hücre `HUCRE = 4` birim): patlama
  `r*0,45+2` yarıçapındaki hücreleri siler, üsttekiler sütun sütun aşağı
  düşüp moloza döner. İçindeki askerler ayakta kalan pencerelerden ateş
  eder; hücrelerin %45'inden azı kalınca savrulup ölürler, %50 ihtimalle
  sandık düşer. Roketler içi dolu binayı kendiliğinden hedef alır; roket ve
  bomba hücrelere çarpar, top mermisi geçer.
- Binalar BOŞ başlar (kullanıcı: "sahadan gelen askerler binaya girsin de
  öyle yıkılsın"). `binayaGir()`: koşan tüfekçi ya da makineli kapının
  (`kapi`) önünden geçerken %45 ihtimalle girer (kılığından, bina başına bir
  karar); en çok 3 kişi, bina %60'tan çok ayaktaysa ve atış penceresi
  kaldıysa. İçeridekiler `dusmanSayisi()`na sayılır: dolu bina yıkılmadan
  dalga bitmez (70 sn sınırı hariç). Çatının üstünde kişi sayısı kadar
  yanıp sönen kırmızı `!` çıkar.
- USTALAR (kullanıcı fikri: "adamlar gelip binaları onarsa, tatlı
  animasyonla"): dalga bitince `ustaGonder()` her cephede, içinde düşman
  olmayan hasarlı bina varsa (sipere en yakını) üsten iki usta çıkarır ve
  arayı 9 sn'ye uzatır. Ustalar `askerler` içinde dosttur: `rol` 4 duvarcı
  (tuğla dolu el arabası iter), 5 merdivenli (merdiveni omzunda taşır);
  `hedef` bina sırası, `seri` durum (0 gidiyor, 1 çalışıyor, 2 dönüyor,
  3 kaçıyor). Çalışırken `onarimT` biriktirirler; `onar()` önce temelin
  altındaki zemini `kot0`a getirir (çukur dolar), sonra `sablon`a göre
  alttan üste hücre koyar (hücre yukarıdan düşüp oturur, toz + kıvılcım +
  `tak` sesi). İki usta yıkık bir evi ≈ 6 sn'de bitirir. 80 birim içinde
  düşman askeri (95'te araç) görünce elleri havada üsse kaçarlar; düşman
  patlaması öldürür, oyuncunun bombası dokunmaz. Onarılan binaya düşman
  yeniden girebilir. Çizim `usta()`, `elArabasi()`, `merdiven()`.
- Bina = şablon + deri. `dunya.ts` `binaKur(x, tur, asker)` hücre ızgarasını
  (boş köşeler, atış pencereleri) kurar, `dekor.ts` aynı ölçüde cepheyi
  boyar (hücre başına 6 piksel); birini değiştirince ötekini de değiştir.
  Ayakta duran hücre derinin kendi parçasını basar, yerinden oynayan moloza
  döner; kırık kenar girintili, altından tuğla görünür. Deri tonları
  `duzle()` ile düz kademelere oturtulur (ara ton küçük cephede
  karıncalanıyor). Temelin altı kurulurken düzlenir (`duzlestir`); sonradan
  zemini 2,5 birimden çok oynayan sütun tümüyle moloza döner, yoksa cephe
  dilim dilim kayıyordu.
- Sabit süsler (`susler()`) zeminden ÖNCE çizilir: toprak üstlerine boyandığı
  için gömülen kısım kırpılır. Geniş olan iki temas noktasına göre yatar,
  dik olan ayak izinin en alçak noktasına oturur; araba yerleri (`PARK_X`)
  düzlenir ve düzde döndürülmeden basılır (döndürme ince çizgiyi bozar).
  Kullanıcı yamaçta yarısı havada duran arabayı ekran görüntüsüyle yakaladı.
- TASARIM ÇITASI (kullanıcı, Kasım 2026): "evler daha kaliteli ve uğraşılmış
  olsun, bu bütün tasarımlar için geçerli." Düz kutu + rastgele nokta kabul
  değil: her nesnenin parçaları (çatı, saçak, doğrama, denizlik, tabela…)
  ayrı düşünülür ve 6–8 kat büyütülmüş kırpmayla denetlenir. Ekran görüntüsünü
  tam sayı katıyla büyüt (görüntü alanı 360 genişlikte): 390'da tuval
  kesirli ölçeklenir ve düz ton taranmış gibi görünür.
- Gömüler (`gomuler`): her kraterden sonra `gomuKontrol` bakar; üstü 5
  piksele inen mayının fitili yanar (0,4 sn), sandık fırlar. Top ve roket
  düşmana nişan aldığı için toprağı yalnız bomba bilerek kazar.
- Bomba YALNIZ sağ alttaki düğmeyle (`bombaDugme`; çizim ve dokunma aynı
  yeri kullanır) ya da klavyede boşluk / B. Ekrana kısa dokunuş ve ikinci
  parmak kaldırıldı: kullanıcı istemeden bomba atıyordu.
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
- ÇÖZÜLDÜ (iki cephe, yukarıda): oyun tek noktada oynanıyordu. Helikopter sürenin %86'sında
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
   Tasarım çıtası turu: evler ve arka plan ✅, sokak süsleri (ağaç, lamba,
   bariyer, levha, variller, yıkık duvar, tank engeli) ve hurdalar ✅;
   kalan: üs, toprak altı, parçacıklar (duman, patlama), HUD.
2. ✅ (çoğu) **Tabya ve bina:** yıkılabilir, içinden ateş edilen küçük
   binalar; köprücü zırhlı ve köprü; derin zemin; makineli, nişancı, subay.
   ✅ İki cephe ve makineli cip. Kalan: arka plan binalarının
   pencerelerinden nişancılar, hasar alan araçtan sağ atlayan askerler.
   ✅ Ustalar, cephe geçiş düğmesi.
3. **Saçmalık başlasın:** üst üste binip dev çöp adam olan askerler (her
   parçası ayrı bez bebek; vuruldukça dökülür; oyunun imzası), lazerli
   asker, helikopteri lazerle vuran UFO.
4. **Gelişim:** ✅ hangar (AP, helikopter hattı, geliştirmeler; keşif ve
   ağır saldırı). Kalan: ara basamak saldırı helikopteri (AH-1 çizgisi) ve
   dikey kalkışlı jet (sprite için örnek iste), ısı fişeği / duman gibi
   savunma geliştirmeleri, destek helikopteri, paraşütle inen DOST takviye,
   10–20 dalgada bir mutasyon patronu.
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
