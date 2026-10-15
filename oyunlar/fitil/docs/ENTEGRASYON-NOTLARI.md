# FİTİL — entegrasyon notları (paket ajanlarının dönüşleri)

Bu belge P5 entegrasyonu için paketlerin API özetlerini, sapmalarını ve açık işlerini toplar. Kaynak: iş akışı dönüşleri (kelimesi kelimesine).

## P2a çizici (src/render)

### API

**Kurulum:**
```ts
import { oyunCiziciOlustur } from './render/oyunCizici';
const stage = new Stage(host, 2);
const cizici = oyunCiziciOlustur(stage, { palet, hareketiAzalt, hiz, kalite, desenler, fitil });
```
- Dönen nesne `OyunCizici & { dev: CiziciDev }`. Kurulumda ayrıca `gelistirme?: boolean` verilebilir; varsayılanı `import.meta.env.DEV`.
- `hareketiAzalt` verilmezse `prefers-reduced-motion` okunuyor.

**Bağlama sırası:**
1. `cizici.alanAyarla(tahtaAlani, gokBandi)` — §13.7; çağrılmazsa çizici varsayılan yerleşimi kendisi kuruyor.
2. `cizici.bolumKur(durum, bolumVerisi)`.
3. `cizici.hedefKonumlari([...kart merkezleri, CSS px])` — HUD kartları yerleşince.
4. `cizici.olayDinle(o => { ses.olay(o); hud... })`.
5. `cizici.kameraDinle(y => ses.yavasCekim(y))`.
6. Her karede `cizici.kare(dtMs)`.
7. Hamle sonrası: `await cizici.oynat(onceki, olaylar, sonraki)`.
8. Dokununca `cizici.hizlandir(2)`, finalde `hizlandir(4)`.

**Girdi tarafı:** `yolGoster(yol, halka, renk, onizle(...))`, `parmak(p | null)`, `vurgula(hucreler, 'zorunlu' | 'ipucu' | 'secim')`, `elGoster(yol)`, `hayaletFitil(yol, halka)`, `geometri()`. Ayrıca `havaiFisek(x, y, renk, desen?)`, `secenekAyarla({...})`, `yokEt()`.

**Bildirim zamanlaması:**
- Olaylar görsel zamanında bildiriliyor.
- `hedefIlerledi` istisna: kıvılcım hedef kartına vardığında bildiriliyor (450 ms; fener için 600 ms, fener uçuşuyla).
- Oynatma kesilirse önce yoldaki bildirimler, sonra yalnız durum taşıyan olaylar (hedef, puan, körük, reaksiyon, bölüm bitti, final) bildiriliyor.

**Sözleşmeye eklediklerim (`src/app/sozlesme.ts`, mevcut alanların anlamı değişmedi):**
- `CiziciSecenek.desenler?: readonly string[]` — takılı havai fişek desenleri.
- `CiziciSecenek.fitil?: string` — fitil görünümü (FitilId).
- `OyunCizici.yonetmenZorla?()` — öğretimdeki zorla yavaş çekim için.
- `OyunCizici.karart?(alfa)` — panel arkasında tahtayı karartır.
- `OyunCizici.fisekDinle?(fn)` — gökteki patlama sesi için.

**Gece Tablosu:**
```ts
tabloCiz(kayitlar, mahalleIndeksi, nadirlik, genislik = 512, yukseklik = 768, tohum?): HTMLCanvasElement
```
- `kayitlar`: `TabloKaydi[]` ya da paketlenmiş 32 bit sayılar.
- `nadirlik`: `'sade' | 'parlak' | 'saheser'` ya da `0 | 1 | 2`.
- Yardımcılar: `kayitPaketle`, `kayitCoz`; test edilebilir saf plan `tabloPlani`.

**Diğer dışa açılanlar:** `DESEN_TARIFLERI` / `desenTarifi(id)`, `GorselTahta` (DOM'suz; `uygula`, `farklar`, `esitle`).

**Geliştirme sayfası:** `npx vite --port P` ile açıp `/dev/cizici.html` adresine git.
- `?senaryo=` değerleri: `buyuk`, `roket`, `kasimpati`, `yildiz`, `kombo`, `halka`, `final`, `karistir`, `hava`, `devfisek`, `iz`, `kazanc`, `kayip`, `b1`.
- Diğer parametreler: `?cizim=6`, `?palet=renkKoru`, `?fisek=izgara&sayfa=0..2`, `?tablo=1`, `?vurgu=zorunlu|ipucu|secim`, `?el=1`, `?hayalet=1`, `?tahta=b1`, `?mahalle=0..7`, `?azalt=1`, `?dpr=3`.
- Kancalar: `__cizici.senaryo(ad)`, `cizim(n)`, `canliCizim()`, `dev.ilerle(ms)`, `dev.dondur(true)`, `olc(n)`.

### Sapmalar / yorum kararları

1. `hedefIlerledi` bildirimi olay anında değil, kıvılcım hedef kartına vardığında yapılıyor (450 ms; fener hedefinde fener uçuşu 600 ms). Gerekçe: §12.2'deki "Hedef sayacı: Kıvılcım Bezier 450 ms; sayaç zıplaması" ve §11'deki 8 numaralı kanca. Uçuşta bildirim bekleyen kıvılcım varken oynatma sözü çözülmüyor.
2. Kıvılcımın hangi patlamadan çıkacağı, aynı tikteki en son sahiplenilmemiş kaynak olaydan seçiliyor (patlama, kafes kırılması, döşeme vb.). Bu yalnız görsel bir eşleştirme; çekirdek olay sırasını değiştirirse eşleşme kayabilir.
3. "6 renk × 6 siluet" ifadesini renk başına kendi silueti olarak yorumladım (§2.3). Renk körü paletinde de siluet aynı kalıyor; 36 kombinasyon üretmedim.
4. Fitil iplik genliği: spec 0,12·kalınlık diyor. Bunu ipliğin merkez kayması olarak aldım ve iplik yarı genişliğini ekledim (~0,25·kalınlık), dalga boyunu da kalın fitilde biraz uzattım; 0,12 tek başına örgü gibi okunmuyordu. Kenevir ipte zincir rengi %38 kenevir bejine karışıyor; yoksa aynı renkli kapsülün üstünde ip kayboluyordu.
5. Kaya: kat sayısı kadar üst üste taş çiziliyor, çatlak sayısı 3 − kat. Yani katı azaldıkça daha çatlak görünüyor; ısıdaki "bir dokunuş kaldı" diliyle aynı.
6. `gizliIsi` kuralında boş yuvalar ve ara ısılar gizli; yalnız kızgın kapsülde dolu yaylar ve çekirdek görünüyor (§10.2'deki U4 "yalnız kızgın kapsüller görünür" yorumu).
7. Havai fişeklerin kendisi kasaba siluetinin önünde, gök ışığı arkasında çiziliyor. Telefonda gök bandı dar ve HUD kartları üstünde; fişek görünür kalsın diye. Patlama yükseklikleri gök bandının %36–78'i.
8. Başka kararlar:
   - "Şenlik başlıyor!" yazısını `finalBasladi` olayında tuvalde çiziyorum; arayüz de çizerse çift olur.
   - Pirinç köşe plakaları 14 px değil, 14 + 0,6·çerçeve; çerçeve 10–16 px olduğu için orantılı tuttum.
   - Konik gökkuşağı `createConicGradient` yerine 72 HSL dilimle pişiriliyor (eski Safari uyumu).
   - `tabloCiz`'e isteğe bağlı 6. parametre `tohum` ekledim; verilmezse kayıtların karmasından türetiliyor.
   - Dönüşümler sahnenin gerçek DPR'ı ile; DPR ≤ 2 sınırı offscreen ve sprite çözünürlüğüne uygulanıyor, sahne DPR'ını uygulama `Stage` ile seçiyor.
   - Desen ızgarası tek ekranda üç sayfa halinde (`?sayfa=0..2`): 800'lük havuza 24 desen birden sığmıyor.

### Açık işler

1. **Performans ölçümü gerçek telefonda yapılmadı.** Bu VM'de GPU yok. SwiftShader (GPU emülasyonu) ile havai fişekli ağır sahnelerde ara sıra saniyeler süren kare donmaları ölçtüm. Aynı yük yazılım 2D tuvalle donmasız çalışıyor; kareler ortalama 20–40 ms (boşta ~20, büyük zincir ~26, final ~40 ms), en kötü kare ~180–280 ms. Donmalar kodda değil emülatörde gibi görünüyor ama bunu ancak gerçek telefon gösterir; telefonda kare süresinin ölçülmesi gerekiyor. Ağır sahnede havuz 800'e doluyor, sonradan gelen parçacıklar sessizce atlanıyor.
2. **Gerçek çekirdekle sınanmadı.** `sahteOlaylar.ts` geçici. `hamleUygula`, `onizle` ve `finalGosterisi` gelince geliştirme sayfası ve `gorselTahta.test.ts` gerçek çekirdeğe çevrilmeli.
   - Çekirdeğin `ozelTetiklendi` ile özel taşın `patlama` olayını hangi sırayla yazdığına göre roket ve kombinasyon rengi, eksen önbelleğinden (`sonIcerik`) okunuyor.
   - `isindi.isi` eşiği aşabilir; çizici eşik−1'de kesiyor.
3. **Sözleşmede adı geçen ama çizicide görüntüsü olmayan olaylar:** `korukDoldu`, son 5 / son hamle ve yıldız damgası HUD işi; çizici bunlar için yalnız dinleyiciyi çağırıyor.
4. **Uygulamaya kalan bağlantılar:** `main.ts` hâlâ P0 yer tutucusu. Çiziciyi bağlamak, `fisekDinle` ile sesi bağlamak ve titreşimi `olayDinle` üzerinden çalmak uygulamanın (P5) işi.
5. **Sandık yeniden pişirme maliyeti:** Çerçevenin ahşap damarı her `bolumKur` ve yeniden boyutlanmada piksel piksel hesaplanıyor (DPR 2'de ~0,9 M piksel). Telefonda tarayıcı çubuğu sık açılıp kapanırsa takılma yapabilir; gerekirse düşük çözünürlükte pişirip büyütülebilir.
6. **Elde test edilmeyenler:** Fitil görünümleri yalnız renk parametresi olarak var, `kenevir` dışındakileri tek tek denemedim. `hava` senaryosunda Meltem ve Çisenti uyarı görsellerine bakıldı (kesik çizgili şerit, kenarda bulut / rüzgâr ikonu). Asıl tetiklenme anını (süpürme şeridi ve parçacıklar) ayrıca çekmedim.

## P2b ses + girdi (src/audio, src/input)

### API

SES
- import { sesMotoruOlustur } from 'src/audio/sesMotoru'.
- const ses = sesMotoruOlustur();
  - Dönen nesne SesMotoru sözleşmesine ek olarak şunları içerir: tahtaBoyutu(w, h), baglam, etkinSes(), cozumleyici().
  - İsteğe bağlı seçenekler: { baglam?: BaseAudioContext (ölçüm/test), tohum?: number, hata?: (e) => void }.
- Bağlama (wiring):
  - İlk kullanıcı dokunuşunda ("Dokun ve başla"): ses.ac(). Sonraki dokunuşlarda yeniden çağırmak zararsız.
  - bolumKur'da: ses.tahtaBoyutu(d.w, d.h). Stereo konum ve roketin kenara çarpma ("çat") zamanlaması buna dayanır; çağrılmazsa 7×9 varsayılır.
  - Çizici olayları ses motoruna: cizici.olayDinle(o => ses.olay(o)).
  - Yavaş çekim: cizici.kameraDinle(y => ses.yavasCekim(y)).
  - Sekme: document visibilitychange → ses.askiya(document.hidden). Motor bunu ayrıca kendisi de dinliyor.
  - Ayarlar: ses.ayarla({ sfx, muzik, ortam, sessiz }), ses.ortam(acik), ses.muzik(acik).
- Çizim sesleri (her biri yolDegisti'nin degisim parametresinden çağrılır):
  - 'eklendi' → ses.dugumEklendi(yol.length)
  - 'geriAlindi' → ses.geriAlindi(yol.length). k, geri almadan sonraki uzunluktur; "bir alt nota" bu düğümün notasıdır.
  - 'halkaKapandi' → ses.halkaKapandi(yol.length)
  - önizlemede özel taş hayaleti ilk belirdiğinde → ses.ozelEsigi(tur)
  - birakildi ve |yol| < 3 → ses.iptal()
  - geçerli bırakma → ses.tutusma(). fitilBasladi olayıyla çift çalmaz (120 ms içindeki ikinci çağrı yutulur).
- Arayüz sesleri: ses.arayuz('kazandin' | 'kaybettin' | 'yildiz1..3' | 'sonHamle' | ...).
  - 'kaybettin'i arayüz ekranla birlikte çalar; bolumBitti kayıp olayı bilerek sessizdir.
  - 'sonHamle' tek kalp atışı döngüsüdür (iki vuruş); arayüz 900 ms'de bir yineler.

GİRDİ
- import { yolCiziciOlustur } from 'src/input/yolCizici'.
- const yc = yolCiziciOlustur({ hedef, geometri, durum, geriCagirim });
  - hedef: tuvalin üstündeki katman. touch-action ve diğer stiller otomatik uygulanır.
  - geometri(): hedefin sol üst köşesine göre CSS piksel.
  - durum(): OyunDurumu, ya da girdi kapalıysa null.
- Geri çağırımlar:
  - yolDegisti(yol, halka, degisim): her değişim ayrı bir çağrıdır; hızlı kaydırmada atlanan hücreler de tek tek bildirilir.
  - birakildi, iptal, ciftDokunus, ozelDokunus?, hucreSecildi, parmak, dokunuldu?, imlecDegisti?.
- Kontrol: yc.kipAyarla('cizim' | 'secim' | 'kapali'), yc.zorunluAyarla(hucreler | null), yc.imlec(), yc.yokEt().
- Davranış notları:
  - Özel taşa sürüklemesiz dokunuş birakildi/iptal ÇAĞIRMAZ: önce yolDegisti([], false, 'temizlendi'), ardından ozelDokunus (ilk dokunuş) ya da ciftDokunus (300 ms içinde ikinci dokunuş).
  - Düz kapsüle dokunuş |yol| = 1 ile birakildi olarak gelir; uygulama "fıs" çalar.
  - Kip değişince süren yol iptal() ile biter.
- Saf mantık (bot, öğretici, testler için): src/input/yolMantigi.ts.
  - yolBaslat, yolAdimi, yolSurukle, eklenebilir, boslukAdimi, geriAlAdimi, CiftDokunusTakibi.
  - Koordinatlar hücre birimindedir; hücre merkezi (x + 0,5, y + 0,5).

ÖLÇÜM
- dev/ses.html sayfasında "Ölç" düğmesi.
- Ya da: node scripts/shot.mjs http://localhost:PORT/dev/ses.html out.png 390 844 1500 "window.__olc()" (sonuçlar konsola yazılır).

### Sapmalar / yorum kararları

YORUM KARARLARI (şartname belirsizdi; en makul okumayla karar verildi, kodda yorum olarak da yazılı)

Girdi:
1. Zorunlu ilk hamle (§15): "vurgulu küme içindeki her geçerli yol" ifadesi, kısıt açıkken yolun kümenin dışına da uzatılamayacağı biçiminde yorumlandı. Sözleşmenin metni yalnız "başlatılabilir" diyordu.
2. Yapışma: "hiçbir daireye girmemiş" = son düğümün komşularından hiçbirinin dairesinde değil (uygun olsun olmasın). Tam 22,5° sınırında eşit açılı iki yön varsa uygun olan seçiliyor. Bir örnek değişime yol açtıysa aynı örnek en fazla 3 kez yeniden işleniyor.
3. Çift dokunuş:
   - "300 ms" ilk dokunuşun bırakılması ile ikincinin basılması arasındaki boşluk olarak ölçülüyor.
   - "≤ 0,3 hücre hareket" her dokunuşun kendi hareketi için uygulanıyor; iki dokunuşun aynı hücrede olması isteniyor.
   - Özel taşa sürüklemesiz dokunuş birakildi/iptal çağırmıyor; yol yolDegisti([], false, 'temizlendi') ile siliniyor.
4. 'secim' kipinde parmağın KALKTIĞI hücre seçiliyor; parmak tahtadan kaydırılarak seçim iptal edilebiliyor.
5. Klavye:
   - Boşluk yolu yalnız komşu imlece uzatıyor. İmleç P[n−2]'deyse geri alıyor; P[0]'daysa halkayı kapatıyor; halka kapalıyken P[n−1]'deyse halkayı açıyor.
   - Backspace tek düğümde iptal ediyor.
   - Q/E/Z/C yazılan harfe göre; numpad konuma (code) göre.
   - K ve 1/2/3 kısayolları arayüze bırakıldı (girdi modülü dinlemiyor).

Ses:
6. Parıltı katmanı görev metnine uyularak k ≥ 11'de açılıyor. GDD "11. düğümden sonra" diyor; k ≥ 12 diye de okunabilirdi.
7. Isındı sesi "2 kHz" yerine dizinin tepesi C7 = 2093 Hz: armonik uyum için.
8. ozelEsigi taşıyıcı notası, varsayılan eşik düğümünün notası (6/9/12 → C6/G6/C7). Bölümde eşikler farklıysa bu nota eşiği izlemez.
9. dosemeAydinlandi'deki "nota k+5" ve desen marimbası, olayda k bilgisi olmadığı için son çalınan pop notasına göre hesaplanıyor (+5 / +2).
10. Vuruş/iz/final pop'ları hücre konumuna göre pentatonik çeşitleniyor.
11. Kalabalık uğultusunun 0,02 kazancı, normalize edilmiş gürültü tamponu için ×4 düzeltildi. Deniz kazancı ölçümle 0,045'e ayarlandı (ortamın toplam RMS'i yaklaşık −41 dBFS).
12. Yankı dönüşüne 6,5 kHz alçak geçiren ve 140 Hz yüksek geçiren eklendi (dürtü yanıtının kendisi şartnamedeki gibi). Çanlarda ses başına ek yankı gönderimi var. Müzik yankısı 0,18×1,6.
13. Çıkışa yumuşak kırpıcı eklendi: |x| ≤ 0,8 doğrusal, üstü tanh ile en fazla 0,95.
14. "Güm"ler 50 ms içinde birleşiyor; şartname yalnız pop için 15 ms diyordu. Kaskadda ses çamurlaşmasın diye.
15. Yerçekiminde aynı anda oturan sütunların tıkları 15 ms kuralıyla birleşiyor (ilk sütunun stereo konumuyla).
16. Bilinçli sessizlikler:
   - isiDegisti;
   - puanEklendi reaksiyon/diger: reaksiyon arpeji `reaksiyon` olayında;
   - bolumBitti kayıp: 'kaybettin' sesini arayüz çalıyor.
   - bolumBitti kazançta yalnız kalabalık tezahüratı çalıyor; kazandın arpeji arayüzün.
17. dugumYandi kısa bir fitil çıtırtısı çalıyor; nota aynı anki fitil patlamasında. Sonuçta bırakınca aynı notalar hızlanarak çalıyor (§11 kanca 1).
18. synth.ts olduğu gibi bırakıldı; yeni motor ona bağımlı değil.

Dosya kapsamı:
19. Görev "yalnız src/audio, src/input, dev/ses.html, dev/girdi.html, sozlesme.ts" dediği için Playwright doğrulama betiği repoya konmadı; scratchpad'de duruyor.
20. Ölçüm dev sayfasının içinde (window.__olc) ve mevcut scripts/shot.mjs ile çalıştırılıyor.

### Açık işler

1. src/audio/gosteri.ts GEÇİCİ sahte olay üreticisi; çekirdekteki hamleUygula (P1) gelince gerçek olaylarla değiştirilip silinebilir. olcum.ts ve dev/ses.html ona bağımlı.
2. Entegratör (P5) için bağlama işleri:
   - ses.tahtaBoyutu(w, h) bolumKur'da çağrılmalı.
   - Çizim sesleri yolDegisti'nin degisim parametresinden çalınmalı (bkz. api).
   - yc.imlec()/imlecDegisti çiziciye bağlanmalı. OyunCizici'de imleç (3 px krem odak halkası) için ayrı bir yöntem yok; ya vurgula ile ya da yeni bir alanla çözülmeli.
3. Roketin kenar "çat" zamanlaması yalnız yavaş çekim ölçeğini biliyor. Çizici dokunuşla 2× ya da finalde 4× hızlandığında çat birkaç on ms geç kalabilir. Gerekirse SesMotoru'na bir zamanOlcegi(k) alanı eklenebilir.
4. sonHamle kalp atışı tek döngü (iki vuruş); arayüzün 900 ms'de bir yinelemesi gerekiyor.
5. Sesler kulakla dinlenemedi (headless ortam). Kalite tasarım ve ölçümle (tepe/RMS hiyerarşisi, kırpılma yok, gerçek AudioContext'in headless Chrome'da hatasız çalışması) doğrulandı. Gerçek telefonda, özellikle iOS'ta, dinleme testi önerilir.
6. iOS sessiz anahtarı: audioSession 'ambient' iOS 17+ Safari'de anahtara uyuyor; daha eski iOS'ta WebAudio'nun sessiz anahtarda susması tarayıcıya bağlı. Hata verilmiyor.
7. Gerçek girdi doğrulama betiği scripts/ altına taşınmak istenirse: /tmp/claude-0/-home-user-Test/d90fdeed-f0c6-50b9-8c33-71be21ef8737/scratchpad/girdi-dogrula.mjs (Playwright yolu bu worktree'nin node_modules'una sabitli; taşırken düzeltilmeli).
8. Kullanıcı kararı bekleyen konu yok.

## P3a arayüz (src/ui)

### API

```ts
import { Arayuz } from './ui/arayuz';
const ui = new Arayuz({
  kok: document.getElementById('app')!,
  ses,                      // Pick<SesMotoru,'arayuz'>
  titresim: buzz,
  palet, hareketiAzalt,
  geri: { ... },            // Partial<ArayuzGeriCagirim>
  klavyeKisayollari?,       // varsayılan true
  guvenliAlan?,             // test için
});
```

**Ekranlar** (seçimi Promise ile döndürür; `ekranlariKapat()` çağrılırsa "geri" anlamındaki seçenekle çözülür):
- `acilis(ilkDokunus?) → void`. `ilkDokunus` dokunma olayının içinde, eşzamanlı çağrılır; `ses.ac()` buraya konmalı.
- `harita(vm) → HaritaSecimi`: `{tur: 'bolum'|'usta'|'gunluk'|'defter'|'istatistik'|'ayarlar'|'nasil'|'kapandi'}`. HUD'u gizler. Aynı harita yeni modelle tekrar çağrılınca yeniden çizilir; şimdiki bölüm bir ilerlediyse fitil yanarak ilerler. `haritaGizle()`.
- `bolumOncesi(vm) → 'basla'|'geri'`
- `duraklat(vm) → 'devam'|'yeniden'|'ayarlar'|'harita'`
- `kazandin(vm, {tablo?: HTMLCanvasElement}) → 'devam'|'tekrar'`
- `kaybettin(vm) → 'tekrar'|'harita'|'ustaEli'|'hayalet'`. `'hayalet'` dönünce kart kapanır; hayalet tahtada 2 kez oynatılır, ardından kart `hayalet: 'izlendi'` ile yeniden açılır.
- `ayarlar(vm, {nasilAc?, defterKartiAc?}) → void`
- `nasilOynanir({acikEngeller}) → void`
- `defter(vm) → void`
- `defterKarti({mahalle, oduller}) → void`
- `gunluk(vm, {kucukResim?}) → {tur:'oyna', tarih} | {tur:'geri'}`
- `istatistik(vm, sekme?) → void`
- `mola() → 'mola'|'devam'`
- `sandikAc(sandik, baslik?) → void`
- `ekranlariKapat()`

**HUD:**
- `hudKur(vm)` haritayı gizler. `hudGuncelle(vm)` farkı canlandırır; tahta boyutu değişirse yerleşim dinleyicilerini çağırır. `hudGizle()`.
- `hedefSayaci(i, deger = ilerleme, tamam, gerekli?)`
- `hamleSayaci(kalan)`: son 5'te nabız, 1'de bant ve `ses.arayuz('sonHamle')`.
- `puan(p)`, `korukGostergesi(dolum, kapasite)`
- `secimKipi(metin | null, kaynak?)`
- `balon(metin, sure?) → Promise<void>` (dokununca kapanır), `balonKapat()`
- `toast(metin)`, `bant(metin, 'kizil'|'altin')`, `reaksiyonYazisi(kademe)`

**Yerleşim:**
- `tahtaAlani() → {tahta, gokBandi}`: doğrudan `cizici.alanAyarla(tahta, gokBandi)`'ya verilir.
- `yerlesim()`: `kip`, `hucre` (§13.7 formülü), ortalanmış `tahta`, `panel` vb.
- `yerlesimDinle(fn) → abonelikten çıkma işlevi`
- `hedefKartKonumlari()`: kök öğeye göre CSS px → `cizici.hedefKonumlari()`.
- `secenekAyarla({palet, hareketiAzalt})`, `geriCagirimAyarla()`, `yokEt()`
- Saf işlevler de dışa açık: `yerlesimHesapla(W, H, tw, th, guvenli)`, `paylasimMetni(p)`.

**Geri çağırımlar** (`ArayuzGeriCagirim`, hepsi isteğe bağlı):
- Oyun: `duraklatIstendi`, `guclendiriciSecildi(id)`, `korukSecildi`, `secimIptal`
- Ayarlar: `ayarDegisti(partial)`, `balonlariSifirla`
- Kayıt: `kayitKodu()`, `kayitOnizle(kod)`, `kayitYukle(kod)`, `ilerlemeyiSifirla`
- Tablo: `tabloKarari(bolumId, sakla)` (yalnız eski tablo varken çağrılır), `tabloTuvali(bolumId)`
- Defter: `desenTak`, `fitilSec`, `gokyuzuSec`, `tozHarca`. Yeni `DefterVM` dönerse sayfa tazelenir.

**Görünüm modelleri** (`src/ui/tipler.ts`, düz veri): `HedefVM`, `HudVM`, `HaritaVM`, `BolumOncesiVM`, `KazandinVM` (`SandikVM`/`OdulVM`), `KaybettinVM`, `DuraklatVM`, `AyarlarVM`, `DefterVM`, `GunlukVM` (`PaylasimVM`), `IstatistikVM`, `DefterKartiVM`, `NasilVM`.

**Notlar:**
- Metinler `src/ui/metinler.ts`'te. Yardımcılar: `kalanMetni`, `hedefMetni`, `gorevMetni` (20 görev şablonu), `esikBilgisi`, `sayi`, `yuzde`, `tarihKisa`.
- Arayüz düğme tıklarında `ses.arayuz('dugme')`'yi kendisi çalar. Yıldız mühürleri, sandık, kazandın/kaybettin, hedef tamam, Körük doldu ve son hamle seslerini de olayla aynı anda kendisi tetikler.
- Önizleme: `dev/arayuz.html?ekran=<ad>`. Ek parametreler: `&v`, `&w`/`&h`, `&simdiki`, `&yeni=1`, `&palet`, `&az=1`, `&guvenli=47,0,34,0`, `&sekme`.

### Sapmalar / yorum kararları

- **Üst HUD dizilimi (§13.7):** GDD'deki "solda 3 adet 64 px kart + ortada 56 px daire + sağda 120 px çubuk" 360–390 px genişliğe sığmıyor (yaklaşık 428 px gerekiyor). Bu yüzden ızgara `1fr 68px 1fr` oldu: hamle madalyonu tam ortada, hedef kartları en fazla 64 px ve yeri yetmezse daralıyor (44–64 px), puan çubuğu sağ sütunu dolduruyor.
- **Puan çubuğundaki ★1 işareti:** 1★ puandan değil "bütün hedefler tamam"dan geldiği için ★1 işareti çubuğun başında sabit duruyor ve hedefler bitince yanıyor; ★2 ve ★3 `yildizEsikleri` noktalarında. Çubuğun tavanı 3★ eşiğinin 1,12 katı. Güçlendirici ya da Usta'nın Eli kullanıldıysa ulaşılamayan yıldızlar soluk gösteriliyor.
- **Yatay/masaüstü tahta alanı:** GDD "tahta solda %62'lik alanda" diyor; ben sağ panelin solunda kalan alanın tamamını kullandım (1280'de 928 px, %62 ise 793 px olurdu). Üstte ve altta 80 px pay korundu (Y − 160); yalnız Y < 480 olan yatay telefonda pay orantılı küçülüyor.
- **Hedef sayaçları:** HUD her hedef türünde kalanı gösteriyor (gerekli − ilerleme); GDD fener, dev fişek ve desen için "toplanan/N" diyor. Bölüm öncesi kartı ise gereken toplamı yazıyor.
- **Görünür ek öğeler:**
  - Haritada büyük "Bölüm N" hızlı oyna düğmesi ve üst çubukta "?" (Nasıl oynanır) düğmesi.
  - Kazandın'da ekran 1–3 yıldıza göre "Tamam!/Harika!/Muhteşem!" başlığı alıyor.
  - Kaybettin başlığı ilerlemeye göre değişiyor: Çok yaklaştın / Az kaldı / Bir daha dene.
- **Gece Tablosu seçimi:** kullanıcı Sakla / Eskisini koru'dan birini seçmezse nadirliği yüksek olan tablo saklanıyor; `tabloKarari` yalnız eski tablo varken çağrılıyor.
- **Sandık sonuçları:** sandıkların içeriğini entegratör önceden hesaplayıp `KazandinVM.sandiklar` ile veriyor; arayüz yalnız açılışı canlandırıyor.
- **İlerlemeyi sıfırla:** iki aşamalı onayın ikinci aşamasında "Evet, hepsini sil" düğmesi yanlış dokunmaya karşı yaklaşık 1,8 sn geri sayımdan sonra etkinleşiyor.
- **Ek alanlar:**
  - `OdulVM` içinde `'sandik'` türü var.
  - Sözleşme dosyalarına dokunulmadı.
- **Yazı tipi:** §13.5 derlemede base64 gömülmesini istiyor. Bu paket dev sayfasında ve `index.html`'de Google Fonts bağlantısını kullanıyor; gömme `build:single` aşamasının işi.

### Açık işler

- **`main.ts` bağlanmadı:** `src/main.ts` henüz arayüzü kullanmıyor; Arayuz'u oyun akışına entegratör bağlayacak.
- **Kısayol çakışması:** HUD K/1/2/3/P tuşlarını dinliyor. Girdi modülü (P2) de dinlerse çift tetiklenir; o durumda `klavyeKisayollari: false` verilmeli. Esc yalnız modal açıkken arayüze ait.
- **Reaksiyon yazısı kimde:** `reaksiyonYazisi` DOM'da çiziliyor (yazı tipi tam). Çizici de tuvalde aynı yazıyı çizecekse tek bir yer seçilmeli. Çevresindeki 20 kıvılcım tuvalin işi.
- **Hayalet fitil akışı:** `kaybettin` `'hayalet'` döndürünce kart kapanıyor. Hayaleti tahtada iki kez oynatmak (`cizici.hayaletFitil`) ve kartı `hayalet: 'izlendi'` ile yeniden açmak entegratörün işi.
- **Haritanın boyutu:** 8 mahallede yaklaşık 5000 DOM/SVG öğesi var. Kurulum 27 ms, ilk kare 63 ms (masaüstü headless). Durağan çizim mahalle başına ayrı SVG'de; canlı animasyonlar görünmeyen mahallelerde duruyor. Gerçek düşük seviye telefonda kaydırma akıcılığı ölçülmedi.
- **Görsel kalıntılar:**
  - Uzun pencere görüntüsünde harita mahalle sınırlarında hafif renk geçiş bantları görülüyor (ör. İskele denizi ile gök arasında).
  - 1280×800'de üst ve alt kasaba payı tahtanın üstünde boş kalıyor; gökyüzünü çizici dolduracak.
- **Dışarıdan gelmesi gereken görseller:**
  - Gece Tablosu tuvalleri `tabloTuvali` / `kazandin(…, {tablo})` ile verilmeli; verilmezse yer tutucu çizim çıkıyor.
  - Günün Şenliği'nin gerçek tahta küçük resmi `gunluk(…, {kucukResim})` ile verilmeli; verilmezse tarihten üretilen süs tahta çıkıyor.
- **Kültür kartı metinleri:** 8 defter kartı metni bu pakette yazıldı. Gerçek bilgiler (fener alayı, mahya, Hıdırellez, Nevruz, baruthaneler, donanma) genel kaynaklara dayanıyor; her kartın son cümlesi oyun dünyasına ait kurgu. İçerik gözden geçirmesi önerilir.
- **Mobil cihazda denenmedi:** Gerçek iOS ve Android WhatsApp içi tarayıcıda denenmedi; güvenli alan paylarıyla ve dokunmatik kipte yalnız emüle edildi.

## P3b meta (src/meta)

### API

İçe aktarma: `import * as meta from '../meta'` (`src/meta/index.ts` hepsini dışa açar).

**Açılış**
- `const depo = new SaveStore<Kayit>(kayitDeposuAyarlari())`
- `const { kayit } = kayitYukle([depo.loadLocal()?.data, yedek1, yedek2], ilkTohum)` — göç ve onarım burada yapılır; ilk açılış tohumu uygulamadan gelir.
- `kayit = gunGiris(kayit, bugunYyyymmdd).kayit` — günlük görevleri tazeler.
- `haritaVerisi(kayit, { ayar?, motifBolumleri? })` → `HaritaVerisi`: `dugumler` (`bolum`/`usta`; durum, yıldız, `pencere` 0..1, `pencerePay`, `catiFisegi`, `siradaki`, `tohum`), `mahalleler`, `gunluk`, `sonsuz`, `cosku`, `anaYildiz`/`enFazlaYildiz`.
- Tarih için `tarihYyyymmdd(y, ay, gün)`.

**Bölüm akışı**
- `bolumuYukle(v, siradakiDenemeNo(k, id), { cosku: coskuAktif(k) })`
- Her eylemden sonra `oz = ozetHamle(oz, olaylar, { hamle, onceki })`; kazanınca `oz = ozetFinal(oz, finalOlaylari)`. Başlangıç `ozetBaslat()`. Geri Sar'da bir önceki `oz` geri konur.
- Yıldız: `yildizHesapla(puan, v.yildizEsikleri, d.istatistik)`.
- `bolumSonucu(kayit, { bolumId, kazandi, puan, yildiz, istatistik, olaylarOzeti, deneme, tarih, kalanHamle, toplamHamle, motif? }, ayar?)` → `{ kayit, oduller: Odul[], ozet }`.
  - Odul türleri: yildiz, yeniRekor, bolumAcildi, ustaAcildi, gunlukAcildi, sonsuzAcildi, guclendiriciAcildi, guclendirici, mahalleTamam, efsane, motif, sandik, sandikBekliyor, tablo, rozet, cosku, gorev, seri, seriBasamagi, fitil, ustaEli.
  - Sandıklar burada açılır; arayüzdeki "dokun-aç" yalnız canlandırmadır.
- Kaybettin ekranı: `ustaEliSunulur(k, id)`.
- Eli ile devam eden oyunun sonucu `istatistik.ustaEli = true` ile bildirilir; yeni deneme sayılmaz.
- Yeniden başlatma kayıp olarak bildirilir.
- Güçlendirici kullanımı: `guclendiriciKullan(k, 'kibrit')` (stok yoksa null).

**Ekranlar**
- Defter: `desenDurumlari`, `fitilDurumlari`, `gokyuzuDurumlari`, `motifDurumlari`, `kartDurumlari`, `KARTLAR`, `tabloListesi`, `defterOzeti`, `desenTak`, `desenCikar`, `takiliAyarla`, `fitilSec`, `gokyuzuSec`, `tozlaParcaAl`.
- Rozetler: `rozetDurumlari`.
- Günlük:
  - görevler: `gorevMetni`
  - paylaşım: `paylasimMetni(tarih, k.gunluk.enIyi[t])`
  - arşiv: `arsivGunleri`, `bolumAcikMi(k, id, bugun)`
  - Fener Nöbeti: `sonrakiBasamak(seri)` → `{ ad, yonelme, kalan }`, `SERI_BASAMAKLARI`
- Gece Tablosu: `tabloCoz(kod)` paketli sayıları verir, doğrudan `render/tablo.ts` `kayitCoz` ile uyumlu; `tabloKayitlari`; `tabloTohumu(bolumId, gunlukTarih?)`.
- Ayarlar ve kayıt:
  - `ayarDegistir`, `ipucuGoruldu`, `ipuclariniSifirla`, `ciftDokunusIpucuGoster`/`Say`, `ilerlemeyiSifirla(k, yeniTohum)`
  - `kayitKoduUret(k, { tablolarHaric? })`
  - `kayitKoduCoz(kod)` → `{ tamam, kayit, onizleme, onarilan }` ya da `{ tamam: false, hata, mesaj }`
- Mola: `molaBaslat`, `molaIlerle(d, simdiMs, { dakika, gorunur })` → `{ durum, goster }`, `molaKapat`, `molayaKalan`, `MOLA_METNI`.

**Bölüm sayısı farklıysa** `MetaAyar` (`anaBolumSayisi`, `bolumPerMahalle`, `ustaIdleri`, `ustaYildizAdimi`) her fonksiyona isteğe bağlı son parametre olarak verilir.

### Sapmalar / yorum kararları

GDD yorumları ve sapmalar (her biri kodda yorum olarak da yazılı):

1. **Kayıt şeması sürüm 2.** Sürüm 1, GDD §16.7'deki taslak şemadır; 1→2 göçü yazılı ve testli.
   - `gunluk.enIyi` artık sayı değil, paylaşım verisini tutan nesne.
   - Yeni alanlar: `hediyeler`, `sandik.kasimpatiVerildi` ve `sandik.bekleyen`, `koleksiyon.gokyuzuler`, `ipuclari`, `sonsuzEnYuksek`, `gunluk.ucGorevSandigi`/`ilkKazanc`/`enUzunSeri`/`basamakOdulu`, bölüm kaydında `kazanc`.
   - Parça kimliği biçimi: `d:<desen>:<0..2>` / `f:<fitil>:<0..2>`. Ateş Böceği hem desen hem fitil olduğu için önek şart.
   - Kartlar `defter:<mahalle>` / `efsane:<mahalle>` olarak tutuluyor.
2. **Kasımpatı baştan açık ama 2/3 parçayla başlıyor;** 3. parça 5. bölümün garanti sandığından geliyor. Böylece "baştan açık" ile "5. bölüm garanti Kasımpatı parçası" birlikte anlam kazanıyor. Palmiye ve Halka tam.
3. **Yıldız sandıkları:** İlk kazanç sandığı 1. yıldızı karşılıyor; 2. ve 3. yıldız ayrı sandık, 3. yıldızınki parlak. İlk kazançta 3★ almak da sonradan yükseltmek de toplam 3 sandık verir; hemen 3★ almak cezalandırılmıyor. Görevlerde 3/3 olunca sonuncu görevin sandığı, günlükte 3★ ile ilk kazanç sandığı parlak oluyor (ek sandık değil, yerine).
4. **1–4. bölümler sandık vermez;** sandık sistemi 5. bölümle tanıtılıyor (§15). Sistem açılmadan kazanılan Fener Nöbeti sandıkları bekletiliyor ve 5. bölümde Kasımpatı sandığından sonra açılıyor.
5. **Güçlendirici kuralları:**
   - "Açılış 7. bölüm" = 7. bölümde kullanılabilir, yani 6. bölüm kazanılınca açılır ve hediye o an verilir.
   - Sandık, mahalle, seri ve rozet ödüllerinde açılmamış ya da stoğu dolu güçlendirici adet başına 2 toza dönüyor. Bu, sandığın "stok doluysa 2 toz" kuralının genellemesi.
6. **Kötü şans koruması:** Tekrar eden (toza dönen) parça da "parça çıktı" sayılıyor (literal okuma). Garanti çekilişi sahip olunmayan parça seçiyor; kategoride eksik kalmadıysa öbür kategoriye geçiyor.
7. **Günlük görevler** 10. bölüm kazanılınca açılıyor (Günün Şenliği ile birlikte). Şablonlar `mulberry32(yyyymmdd)` ile karıştırılıyor ve oyuncunun ulaştığı bölümde yapılabilir olan ilk 3'ü alınıyor; aynı ilerlemedeki herkes aynı görevleri görüyor. "10 kaya kır" tamamen yok edilen kayayı sayıyor; "3 bölüm kazan" tekrar oynanışları da sayıyor.
8. **Fener Nöbeti:**
   - Her affedilmeyen kaçırılan gün bir basamak düşürüyor (K17 "kaçırılan gün bir basamak düşürür"); geri dönülen gün düşen değere dahil (12→3).
   - Haftalar Pazartesi başlıyor; kazanç ya da kayıp, oynanan her gün sayılıyor.
   - Seri, günlük açılmadan da (1. bölümden itibaren) sayılıyor.
9. **Coşku Serisi:** "İlk deneme" = bölümün ilk kez oynanışı (deneme sayacı 0). Eski bölümü yeniden kazanmak seriyi değiştirmiyor; Günün Şenliği seriyi etkilemiyor; kayıp ve yeniden başlatma sıfırlıyor. Seri ≥3 sürdükçe sonraki bölümler hazır roketle başlıyor.
10. **Rozetler:**
    - Domino ve Çapraz Nişancı tek oyunda sayılıyor.
    - Defterci, baştan açık üç desen dışında 12 desen istiyor.
    - "Bazı rozetler" güçlendirici veriyor: Halkacı ve Usta Çırak birer Kibrit, Otuzluk ve Domino birer Fişek Kalıbı, ŞENLİK! bir Geri Sar.
11. **Efsane kartları** mahallenin 5 bölümü de 3★ olunca açılıyor. Kart metinleri yazıldı: 8 gerçek kültür notu ve 8 Fener Koyu efsanesi (kurgu), her biri ≤4 cümle.
12. **"YENİ REKOR!"** bölüm puanında, günlükte o günün kazancında ve tek hamle rekorlarında (R, zincir, nesil) veriliyor; bölümler arası en yüksek puan sessiz tutuluyor. Rekor tablosu kazançta otomatik saklanıyor; daha nadirse değiştiriliyor, değilse eski korunuyor ve arayüz [Sakla] sunabilir.
13. **Gece Tablosu bit yerleşimi** `src/render/tablo.ts` ile birebir aynı tutuldu. Final gösterisinin R değeri tek hamle rekorlarına girmiyor.
14. **Kayıt kodu** varsayılan olarak tabloları içeriyor (17 tabloda ~14,6 bin karakter); `tablolarHaric` seçeneği kodu kısaltıyor.
15. **Klasör dışı dosya ve DOM:** "Yalnız src/meta" kuralına tek istisna, görsel doğrulama için eklenen `dev/meta.html`. Diğer paketlerin düzenine uyarak DOM kodu `src/meta/dev/` altında (vitrin + geçici sahte olay üretici); entegrasyonda silinebilir.
16. `katalog.ts` ve sözleşme dosyalarına dokunulmadı.

### Açık işler

1. **Ekonomi (sahte oyunla ölçüldü):** GDD sandık haklarıyla ileri senaryoda (40 bölüm ve Usta'ların çoğu 3★, neredeyse her gün oynama) 162 sandık açıldı. 93 toplanabilir parçanın tamamı 40. bölümden önce bitiyor, toz 364'e birikiyor. 17. bölümde (orta senaryo) 40 sandık ve 101 parçadan 38'i var. Toz için son oyunda bir harcama yeri ya da yıldız sandığı oranında ayar gerekebilir; kullanıcı kararı.
2. **Gerçek olaylarla bağlama:** Çekirdekte `hamleUygula` hâlâ stub; özet gerçek olaylarla değil sözleşmeye göre elle kurulan olaylarla test edildi. P1 bittiğinde iki atıf kontrol edilmeli: çapraz roket atfı tam T+25·d zamanlamasına, barut izi atfı ise iz–dev fişek komşuluğuna dayanıyor.
3. **Uygulamanın yapması gerekenler:**
   - Çekirdek `BolumIstatistigi.roket` vb. sayaçların anlamı (oluşum mu ateşleme mi) belirsiz; meta olay özetini esas alıp en büyüğünü kullanıyor.
   - Tablo için "[Sakla]" seçimi `bolumler[id].tablo`/`nadirlik` ataması olarak yapılmalı; ayrı bir `tabloSakla` fonksiyonu eklenebilir.
   - Desen hedefli bölümün motifi `bolumSonucu`'ya `motif` olarak geçirilmeli.
   - Kayıt yazımında 500 ms gecikme ve yedek anahtarlarına (`KAYIT_YEDEK_ANAHTARLARI`) yazma uygulama/platform işi. SaveStore yedekleri yazmıyor; meta yalnız okuma sırasını (`kayitYukle`) sağlıyor.
4. **Kullanıcıya doğrulatmak iyi olur:** Mahya, Abdülhamid dönemi saat kuleleri, Bakırköy/Azadlı baruthaneleri, Hıdırellez ve Nevruz için UNESCO notları gibi gerçek bilgi içeren 8 kültür kartı metni.
5. `dev/meta.html` ve `src/meta/dev/` geçici; entegrasyon sonrası silinebilir. `src/meta/_test/yardimci.ts` yalnız testlerde kullanılıyor.

## P1 çekirdek

### Özet

GDD §3–§7 ve §16.2–§16.4 `oyunlar/fitil/src/core/` altında tümüyle uygulandı. Push yapılmadı.

- Dosyalar (§16.1 düzeninde): yigin.ts (anahtarı (t, y, x, sıra) olan min-yığın), yol.ts (doğrulama, zincir rengi, eksen, özel tür, en çok bulunan renk; P0'daki index.ts işlevleri buraya taşındı ve index'ten yeniden dışa aktarılıyor), baglam.ts (çözüm bağlamı, planli/patladi/kalkan bayrakları), resolve.ts (PATLAT, ISIT, vuruş, DONUSUM, iz adımı, dev fişek ateşi, kuyruk döngüsü), ozel.ts (roket, kasımpatı, yıldız topu, 6 kombinasyon, önizleme için hücre kümeleri), engel.ts (vuruş tablosunun kapsül dışı satırları, iz tutuşması, is yayılması), yercekimi.ts (sabitlerin arkasından geçiş, dolum, fener doğumu, yardım n, fener toplama), kilit.ts (bilesenVar, yalnizHalka için 4'lü döngü DFS), karistir.ts (§3.8, kesin sonlanır), hedef.ts, puan.ts (patlamaPuani, reaksiyonKademesi, yildizHesapla), hava.ts (meltem, çisenti, soğuma), hamle.ts (hamleUygula, hamleHatasi, HamleHatasi, körük, hamle sonu sırası §3.5.4, reaksiyon olayı, ustaEliUygula), final.ts (finalGosterisi), onizle.ts.
- hamleUygula saf çalışır: önce derin kopya alır, geçersiz hamlede `HamleHatasi` fırlatır. Desteklenen hamleler: fitil, ciftDokunus, koruk, kibrit, kalip.
- Fitil zamanları: 6 düğüm 0/103/199/288/370/445, 10 düğüm toplam 675.
- Kurallar: ilk plan kazanır; nesil kuralları; kalkan; eşikler 2–5.
- Olaylar t'ye göre azalmayan sırada. Yerçekimi kuyruk boşalınca gelir, sonraki aşamalar YERCEKIMI_PAYI sonra başlar. Her durum değişikliğinin bir olayı var; bulanık test, görsel tahtayı yalnız olaylardan kurup sonraki durumla (hücreler, puan, körük, hedefler, izler) her hamlede eşitliyor.
- bolumuYukle: adım 4 artık §3.8 karıştırmasını ilk tahta akışından kullanıyor. Hedef başlangıç durumu hedef.ts'e taşındı.
- BolumIstatistigi'nin bütün alanları güncelleniyor.
- Belirlenimlilik: çekirdek kodda Math.random, Date, performance ya da ondalık sabit yok (grep ile denetlendi).
- Ek yardımcılar: `ustaEliUygula` (K16: +5 hamle, bitti sıfırlanır, tahta kilitliyse karıştırılır), `hamleHatasi`, `testAraclari.ts` (yalnız testler kullanıyor: kompakt tahta kurucu, olaylardan görsel tahta kuran model, rastgele bölüm/hamle üreticisi, belirlenimli hamle seçici).

### Sapmalar

Sözleşme ekleri (types.ts'te yalnız isteğe bağlı alanlar; var olan alanların anlamı değişmedi):
- `OyunDurumu.finalYapildi?` (final iki kez çalışmasın diye).
- `ozelOlustu.isi?` (dönüşümde 0, kalıp/kombinasyon/finalde korunur).
- `hedefIlerledi.gerekli?` (is yayılınca artar).
- `puanEklendi.hucre?` (puanın kaynak hücresi).
- `korukDoldu` için açıklama eklendi: dolum her arttığında yazılır; gösterge `dolum === kapasite` iken dolu sayılır.
- sabitler.ts'e `USTA_ELI_HAMLE = 5` eklendi.

Yorum kararları (her biri kodda § atfıyla yazılı):
1. Patlama dışı puanlar (engel, kafes, döşeme, desen, oluşum, kombinasyon, fener, dev fişek, halka, reaksiyon, kalan hamle) ayrı `puanEklendi` olaylarıyla gelir; `patlama.puan` yalnız taban puandır. Toplam: Δpuan = Σpatlama.puan + ΣpuanEklendi.
2. İs temizleme +30 verildi (§5 ve sabitler.PUAN.isTemizle). §7.1'deki "kat 20 + kalkınca 50" (toplam 70) ile çelişiyor.
3. Çift dokunulan taş `neden: 'vurus'` ile patlar, 15 puan alır ve R'ye girer, çünkü fitil düğümü değil.
4. Hedef ilerlemesi `gerekli` ile sınırlanır.
5. `isindi.isi` sınırlanmaz (eşiği aşabilir); `kizgin = isi ≥ eşik−1`.
6. Yalnız joker zincirde zincir rengi bırakma anındaki en çok bulunan renktir. `fitilBasladi.renk` bu etkin rengi taşır; `onizle.renk` ise −1 kalır.
7. Kapalı bir özel tür eşiği bir alt türe düşer (ör. [6,9,0] ve n=12 → kasımpatı).
8. Roket yağmuru ve bahçe, zincir rengindeki kafesli kapsülleri ve var olan özel taşları da dönüştürür.
9. Kalın roketin çapraz hatları tahta dışındaki taban noktasından sonra tahtaya girebilir; bu yüzden tahta dışı hücreler atlanır, tarama durmaz.
10. İz tutuşturan hücreye ikinci vuruş verilmez. Planlı kapsüle gelen vuruş izi de tutuşturmaz (kapsül patlayınca tutuşur).
11. Dev fişek fırlama anında (t+150) kalkar; doluyken gelen ek dolum yok sayılır.
12. Fener toplama ve ardından gelen yerçekimi aynı t'dedir, sonraki aşamalar +YERCEKIMI_PAYI. Hiçbir şey düşmediyse `yercekimi` olayı yazılmaz ve pay eklenmez.
13. Yardım n her doldurma turunda en fazla n kez yeniden çeker.
14. Meltem, hamle başındaki kalkanı kullanır. Soğuma her k. fitil/çift dokunuş hamlesinde, hava olaylarından sonra çalışır.
15. Körük (kalkan geçerli) kendi ISI patlamalarıyla göstergeyi yeniden doldurabilir. Merkez tahta içinde ve delik olmayan bir hücre olmalı.
16. Reaksiyon bonusu ve zincirleme hedefi bütün eylemlere uygulanır (final hariç). `istatistik.reaksiyonlar` yalnız hamle harcayan eylemleri (fitil, çift dokunuş) kaydeder. Final reaksiyonu istatistiğe girmez, bonus almaz (`kademe: null`), ama `reaksiyon` olayı yazılır.
17. `istatistik.roket/kasimpati/yildiz` yalnız dönüşümle oluşanları sayar (kalıp ve kombinasyon dönüşümleri hariç).
18. `finalGosterisi` ayrı çağrılır (hamleUygula yalnız `bolumBitti{kazanc}` yazar). Final roketlerinin seçimi baştan yapılır ve roketler t=0'da belirir. Final roketlerinin vuruşları `neden: 'final'` taşır. Özel turlar kafesli özel taşları da tetikler. Final sonunda `kalanHamle = 0`; final fener toplamaz.
19. Güçlendirici sınırı (bölüm başına 1, §9) çekirdekte uygulanır: ikinci kibrit/kalıp hata fırlatır. Geri Sar uygulamada kalır.
20. Karıştırmaya §3.8'de olmayan bir son çare eklendi: yeniden renklendirmeden sonra tahta hâlâ kilitliyse RNG kullanmadan ilk uygun 3'lü komşu küme (yalnizHalka kuralında 2×2) boyanır; o da yoksa ilk kafessiz kapsül yatay rokete döner. Bu yalnız engelle dolu, kapsülü çok az tahtalarda devreye girer.
21. `zirveT` ve `merkez` tamsayıdır (ağırlık merkezi yuvarlanır). Hiç patlama yoksa merkez tahtanın ortasıdır.
22. `yalnizHalka` kilit testinde, GDD'deki gibi yalnız 4'lü döngü aranır.

### Açık işler

- İs puanı çelişkisi (§5'te +30, §7.1'de 20+50): sabitlerdeki 30 kullanıldı. Tasarımcı onayı gerekiyor; şartname testlerini yazan ajan farklı bekleyebilir.
- `korukDoldu` adı "doldu" diyor ama her artışta yazılıyor. Çizici `dolum === kapasite` ile tam dolu kutlamasını ayırt etmeli.
- Geri Sar uygulama tarafında: durum ve RNG anlık görüntüsüne dönülür, `istatistik.guclendirici` dönüşten sonra uygulama tarafından artırılmalı, yoksa güçlendirici sınırı aşılır. `zorunluIlkHamle` (§15) de çekirdekte değil, girdi/uygulama denetler.
- Çekirdekteki lint kuralları (§16.3) eslint ile yapılandırılmamış; denetim grep ile yapıldı. `testAraclari.ts` src/core altında ama yalnız testler kullanıyor.
- `kilitliMi`'nin yalnizHalka dalı O(hücre·renk·8³) (~1 ms); yalnız Usta bölümlerinde çalışır.
- Bulanık testte 6 kombinasyonun kalın roket dışındaki 5'i çıktı; kalın roket birim testlerle (yatay ve çapraz) denetleniyor.
- `src/core/spec/*.test.ts` (paralel ajan) ile birleştirince beklenti farkı çıkabilecek yerler: is puanı, çift dokunuşun puanı ve R'ye girmesi, güçlendirici sınırının çekirdekte uygulanması, puanın `puanEklendi` ile ayrıştırılması.
- Altın anlık görüntüler bir kural bilerek değiştirildiğinde `npx vitest run -u` ile güncellenip fark gözden geçirilmeli.

## P1 şartname testleri

### Özet

- `oyunlar/fitil/src/core/spec/` altına 13 dosya ekledim: 12 test dosyası ve 1 yardımcı. 270 test ve 3 todo var. Her test adı bir GDD §'üne atıf yapıyor. Testler yalnız `src/core/index.ts` API'sini kullanıyor; sözleşme dosyalarına dokunmadım.
- `spec/kur.ts` (kurucu): ASCII mini dili `BolumVerisi`'ne çeviriyor. Renkler R A Z G M P, yıldız topu `*`. Renkten sonra rakam ısıyı, `- | / \` roket eksenini (0..3), `@` kasımpatıyı verir. Diğer simgeler: `.` dolum renginde kapsül, `C:x` kafesli kapsül, `W:x` ıslak barut, `F` fener, `I` is, `#` delik, `_` boş hücre, `K1..3` kaya, `S`/`S1` kova, `D`/`Dn`/`Dn:m` dev fişek.
  - Her kapsül `sabitKapsuller` ile kuruluyor; dolum `dogumAgirliklari` ile tek renge zorlanıyor (varsayılan Gül).
  - Zemin katmanı `1`/`2` döşeme, `dR` desen, `i<n>`/`j<n>` barut izi sırası; hava olayları, körük, çıkışlar, kurallar ve fener doğumu seçenek olarak veriliyor.
  - `kur()` yüklemeden sonra içerik katmanını çizimden yeniden yazıyor; kilitli tahtalar da birebir kuruluyor. Olay süzgeçleri, derin dondurma (`Object.freeze`) ve bulanık oyun için `adayYol` da bu dosyada.
- Dosyalar ve kapsadıkları bölümler:
  - `kur.test`: §8.1 yükleme tutarlılığı.
  - `yol.test`: §3.3 (8-komşu, çapraz, tekrar, renk, joker zincir rengi, halka ≥4, yalnizHalka, caprazSiniri, dortKomsu) ve §3.4.
  - `fitil.test`: §3.5.1 zamanlar (0,103,199,288,370,445; 675; alt sınır 35), halka çarpanı, bölüm 1'deki ısı tadı (K5); §3.5.2 ısı (+1/+2, eşik 2–5, nesil, kalkan, planlı hücre, ilk plan kazanır).
  - `vurus.test`: §3.5.3 tablonun her satırı, bitişik ve vuruş sütunları ayrı.
  - `ozel.test`: §4.1 (4 eksen durumu, 6/9/12, 0 eşiği, halka, son düğüm zaten özelse, dönüşen düğüm), §4.2 hücre kümeleri ve zamanları, yıldız topu sırası ve hedef rengi, §4.3.
  - `kombo.test`: §4.4 altı kombinasyon, S1'in yüklenmesi, üçüncü özelin ayrı tetiklenmesi, kombinasyon puanları.
  - `engel.test`: §5 (fener çıkışı, kaya katları, dev fişek, is temizleme/yayılma, barut izi, döşeme, desen, meltem tavanı, çisenti, sayaç ve uyarı).
  - `yercekimi.test`: §3.6 (sabit/kafes/deliğin arkasından geçiş, sanalY, dolum RNG sırası, fener doğumu), §3.7, §3.8.
  - `hedef.test`: §6 her hedef türü, ilerlemeYuzdesi, Körük.
  - `puan.test`: §7.1 tablosu, §7.2 bonus kademelerinin sınırları (7…45).
  - `final.test`: §7.3.
  - `sira.test`: §3.5.4 adım sırası, bolumBitti, değişmezler, bulanık özellikler.
  - `onizle.test`: §3.9. `guclendirici.test`: §9.
- Kendi tahta hesabımı sınamak için karalama dizininde, depoya işlemediğim, GDD'yi kendi okuduğum hâliyle bir başvuru simülatörü yazdım. `index.ts`'i ona geçici olarak bağladım; 284 testten 282'si geçti, kalan 2'si aşağıdaki yalnizHalka testleri. Sonra `index.ts`'i `git checkout` ile geri aldım.
- Testlerin sapma yakaladığını görmek için simülatöre 70 bilinçli hata soktum; hepsi en az bir testi kırmızıya çevirdi. Yakalanmayan iki hatayı (bahçe ve roket yağmurunda sıralama) testteki hedef konumlarını değiştirerek kapattım.

### Sapmalar

Sözleşme dosyalarına dokunmadım, alan da eklemedim. Belirsiz kurallarda şu okumaları yaptım; hepsi test yorumlarında §'e atıfla yazılı:
1. §4.1 `[6,0,0]` ile 9 düğüm roket olur; `[6,9,0]` ile 12 düğüm kasımpatı olur (açık olan en yüksek eşiğin türü).
2. §4.2 roket delikten sonra da d'yi geometrik uzaklıkla sayar (delikten sonraki hücre T+75).
3. §4.4 kalın roket:
   - S2'nin tam üstü ve altı (d=0) için zaman T..T+25 aralığında kabul edildi.
   - Çapraz şerit, tahta boyunca x+y ∈ {5,6,7} olan üç tam çizgi sayıldı.
4. §4.4 bahçe, yıldız topuyla aynı (dx²+dy², y, x) sırasını kullanır. Testteki hedeflerde Chebyshev ve Öklid sırası aynı çıkıyor.
5. §3.6 sanalY: en alta inecek doğan, değeri sıfıra en yakın olandır. Kesin değerler sınanmıyor.
6. §16.3 dolum: renk = `rngInt(toplam)` ile kümülatif seçim. Bu tahtada akıştan tam 3 çekim tüketilir (yardım, fener, is ve karıştırma yok).
7. §6 Körük kullanıldıktan sonra dolum, o eylemdeki ısı patlaması sayısı olur (önce 0, sonra §3.5.4 adım 5).
8. §3.5.2 PATLAT'ta ısı adımı (5) hasar adımından (6) önce gelir; bu yüzden ıslak barut kurusa da o patlamadan ısı almaz.
9. §3.3.1 tamamı joker yolda `fitilBasladi.renk` çoğunluk rengidir; `onizle.renk` ise types.ts gereği −1'dir.
10. §6.8 'is' hedefinde yayılma `gerekli`'yi artırır (types.ts HedefDurumu belgesi).
11. §5 hava uyarısı, sayaç 1'e indiği hamlenin sonunda `uyari:true` olayıyla verilir.
12. Görev "§6.10 körük" diyordu; GDD'de §6.10 halka hedefi olduğu için körük testlerine "§6 Körük" diye atıf yaptım.
Bilerek sınamadıklarım:
- İs temizleme puanı: §5'te +30, §7.1'de 20/kat + 50 yazıyor; çelişkili.
- Çift dokunulan taşın R'ye ve puana katkısı.
- Kafesli özel taşın kilit testindeki durumu.
- Geçersiz halka için hata kodu (yalnız null olmadığı sınanıyor).
§7.4 `yildizHesapla` API'si olmadığı için yıldız testleri `it.todo` olarak duruyor.

### Açık işler

- P1 (çekirdek) için 1: `kilitliMi` `yalnizHalka` kuralında 4'lü döngü aramıyor (P0 kodundaki "döngü araması P1'de" notu). `yol.test.ts`'teki iki test bu yüzden kırmızı: döngüsüz ≥3 bileşen ve üçgen. GDD §3.4'e göre ikisinin de kilitli sayılması gerekiyor.
- P1 için 2: §7.4 `yildizHesapla` API'si index.ts'e eklenince `puan.test.ts`'teki 3 todo'nun yazılması gerekiyor.
- Entegratör için: §5 is temizleme puanında (+30 mi, 20/kat + 50 mi) karar verilmeli. `sabitler.ts` şu an 30 diyor; test yok.
- P1 için 3: final gösterisi testi `hamleUygula` kazanınca finali kendisi oynatmaz varsayımıyla yazıldı; final ayrı `finalGosterisi` ile çağrılıyor (GDD §16.2).
- Kırmızı testler P1 gelene kadar `npx vitest run` çıkış kodunu sıfırdan farklı tutar. CI'da bilinen kırmızı olarak işaretlenmeli ya da P1 birleşimine dek ayrı tutulmalı.
- Başvuru simülatörü ve mutasyon betikleri yalnız karalama dizininde: `/tmp/claude-0/-home-user-Test/d90fdeed-f0c6-50b9-8c33-71be21ef8737/scratchpad/ref/`. Depoya işlenmedi; P1 için bağlayıcı değil.
- Önemli dosyalar:
  - `/home/user/Test/.claude/worktrees/wf_74377c46-e0f-2/oyunlar/fitil/src/core/spec/kur.ts`
  - aynı dizindeki 12 test dosyası: `kur`, `yol`, `fitil`, `vurus`, `ozel`, `kombo`, `engel`, `yercekimi`, `hedef`, `puan`, `final`, `sira`, `onizle` ve `guclendirici` adlı `.test.ts` dosyaları.

## P1 uzlaştırma

### Özet

- Önce çekirdek dalını (60ae8eb, fast-forward), sonra şartname testleri dalını (0551521) birleştirdim. Birleşme commit'i b445c20, çakışma çıkmadı. Birleşmeden hemen sonra şartname testlerinin hepsi geçiyordu (422 test ve 3 todo), bu yüzden test ya da çekirdek düzeltmesi gerekmedi. Uzlaştırmayı çekirdeği eleştirel okuyarak ve bulanık testlerle araştırarak yaptım.
- Gerçek bir hata buldum ve düzelttim (`src/core/kilit.ts`). `caprazSiniri` 0 ya da 1 iken `kilitliMi`, yalnız çaprazla bağlı 3'lü bir bileşeni (örneğin (0,0)–(1,1)–(2,0)) kilitsiz sayıyordu. Tahtada geçerli hamle kalmıyor ama karıştırma da yapılmıyordu, oyun takılıyordu (2000 oyunluk araştırmada oyun 623). Artık `ucluYolVar` var: her 3'lü yolun bir orta düğümü olduğu için orta düğümün dik ve çapraz komşu sayısıyla çapraz sınırına uyan bir yol aranıyor. `yalnizHalka` kuralında `halkaVar` da döngünün yol adımlarındaki çaprazları sınırlıyor. Düzeltmeyi geçici olarak geri aldığımda yeni oynatıcı testi hatayı oyun 125'te yakaladı.
- Sağlamlık: `tahta.hucre()` ve `onizle` tamsayı olmayan bir konumda artık fırlatmıyor. `yolDogrula` böyle yolu 'zincirlenemez' ile reddediyor, `hamleUygula` da `HamleHatasi` fırlatıyor.
- Yeni `src/core/oynatici.ts`, `index.ts`'ten dışa aktarılıyor: `gorselTahtaKur`, `olayUygula`, `olaylariUygula`, `gorselFark`, `OynaticiHatasi`. Çizicinin görsel tahtası için saf bir indirgeyici. Katı kipte her olayın önkoşulunu denetliyor: patlayan hücrede aynı renk ve özellikte kapsül var mı, kayanın katı `kalan + 1` mi, dev fişek dolumu bir mi arttı, düşen içerik hareketli ve hedef yuva boş mu, karıştırılan hücreler kafessiz kapsül mü.
- Yeni `src/core/oynatici.test.ts`: 300 rastgele oyun (FUZZ_N ile ölçekleniyor). Görsel tahta yalnız bölüm başındaki durumdan kuruluyor ve oyun boyunca hiç eşitlenmeden yalnız olaylarla ilerliyor: fitil, çift dokunuş, körük, kibrit, kalıp, Usta'nın Eli ve final. Her eylemden sonra bütün katmanlar karşılaştırılıyor: içerik, ısı, özel, eksen, kafes, döşeme, desen, iz, ışık izi, puan, körük, hedefler, bitiş. Ayrıca şunlar denetleniyor: ısı patlaması eşiği geçiren `isindi`den tam 90 tik sonra geliyor; eylem sonunda bekleyen patlama yok; `reaksiyon` her eylemin son olayı; bitmemiş tahtada her zaman bir hamle var; 32 olay türünün hepsi en az bir kez oynatılıyor.
- Yeni `src/core/spec/uzlasma.test.ts`: belirsiz okumaları sabitleyen testler. Bunlar is temizleme +30, çift dokunulan taşın puanı ve R'ye girmesi, kafesli özel taş, geçersiz halkanın hata kodu, güçlendirici sınırı, körük merkezi, final reaksiyonu, `caprazSiniri` kilidi (`yalnizHalka` ile birlikte de) ve §16.3 RNG sırası (dolumdan sonra is yayılması, aynı akıştan).
- `spec/puan.test.ts`: §7.4'teki üç `it.todo`, `yildizHesapla` ile gerçek teste çevrildi (dört test).
- `testAraclari.ts`: rastgele denemeler hamle bulamazsa belirlenimli bir 3'lü yol aranıyor; eskiden 2000 oyunun 19'u bu yüzden erken bitiyordu.
- `src/core/README.md`: API ve tipik uygulama akışı, zamanlama tablosu, olay sözlüğü (32 olay: ne zaman, hangi alanlarla, görsel tahtaya etkisi), çizicinin görsel tahtayı nasıl güncelleyeceği, RNG sırası, uzlaştırma kararları ve testler. `oyunlar/fitil/CLAUDE.md`'ye README'ye işaret eden bir satır eklendi.
- Körük atıfları `§6.10` yerine `§6 Körük Göstergesi` oldu (`hamle.ts`, `baglam.ts`, `types.ts` yorumu, `hava.test.ts`). GDD'nin §3.1 tablosundaki atıf da hatalı; §6.10 halka hedefi.

### Sapmalar

Uzlaştırma kararları (şartname testlerinin hiçbiri kırmızı değildi; test silinmedi, atlanmadı):
1. Çekirdek düzeltmesi, §3.4 + §3.3.7: `kilitliMi` etkin çapraz sınırını gözetiyor. §3.4'ün sözde kodu `caprazSiniri`'yi anmıyor, ama testin amacı "geçerli hamle yok mu" sorusunu cevaplamak; GDD de `yalnizHalka` için testi kurala göre genişletiyor. Sınır 0/1'de `ucluYolVar`, `yalnizHalka`'da adım sınırlı `halkaVar` kullanılıyor. Sınır null ya da ≥ 2 iken davranış değişmedi; altın anlık görüntüler de değişmedi.
2. Çekirdek sağlamlığı: `hucre()` ve `onizle` tamsayı olmayan konumda fırlatmıyor (sözleşme dışı girdi). Anlam değişikliği yok.
3. Testte değişiklik: §7.4'teki üç `it.todo` gerçek teste dönüştü, çünkü `yildizHesapla` artık API'de.
4. Sabitlenen okumalar (çekirdeğin seçimi korundu, `spec/uzlasma.test.ts` ile kayda geçti):
   - İs temizleme toplam +30 (§5 ve `PUAN.isTemizle`); §7.1'deki "20 + 50" uygulanmıyor.
   - Çift dokunulan taş nesil 0, `neden: 'vurus'`, 15 puan alıyor ve R'ye giriyor.
   - Kafesli özel taş kilidi açmıyor ve çift dokunulamıyor.
   - Geçersiz halka `'komsu'` hatası veriyor.
   - İkinci güçlendirici `HamleHatasi` fırlatıyor.
   - Körük merkezi delik olmayan bir hücre olmalı.
   - Final reaksiyonu bonus almıyor ve istatistiğe girmiyor.
5. Sözleşme ekleri (yalnız ekleme): `index.ts` artık `oynatici.ts` API'sini (`gorselTahtaKur`, `olayUygula`, `olaylariUygula`, `gorselFark`, `OynaticiHatasi`, `GorselTahta` tipi) dışa aktarıyor. `types.ts`'te yalnız `korukDoldu` yorumundaki § atfı düzeltildi; alan ya da anlam değişmedi.
6. Oynatıcı tasarım kararı: `kalanHamle` ve Usta'nın Eli'ndeki `bitti = null` sıfırlaması olaylardan çıkmıyor; uygulama gönderdiği eylemi biliyor, bunu README'ye yazdım. Yeni olay türü eklemedim.
7. Çekirdek ajanının 22 yorum kararını GDD'ye karşı tek tek gözden geçirdim, hepsini koruyorum (kalın roket d = 0, roket yağmuru var olan özel taşları da çeviriyor, final roketleri baştan seçiliyor, karıştırmanın son çaresi vb.).

### Açık işler

- İs puanı çelişkisi (§5'te +30, §7.1'de 20 + 50 = 70) için tasarımcı onayı gerekiyor; şimdilik 30 kullanılıyor ve `uzlasma.test.ts` bunu sabitliyor.
- Geri Sar uygulama tarafında. Önceki durum kopyasına dönülünce `istatistik.guclendirici` uygulamada artırılmalı, yoksa güçlendirici sınırı aşılır (README'de yazılı). `zorunluIlkHamle` (§15) girdi katmanında denetlenmeli.
- Çizici paketi (render) `olayUygula`yı doğrudan kullanabilir. Geliştirme kipinde `gorselFark` ile eşitleme önerilir; üretimde katı kip kapalı tutulmalı (fırlatmasın).
- `korukDoldu` her artışta yazılıyor; "doldu" kutlaması `dolum === kapasite` ile ayırt edilmeli (README'de yazılı).
- §16.3 lint kuralları hâlâ eslint ile yapılandırılmadı; grep denetimi temiz (yalnız yorumlarda geçiyor).
- `yalnizHalka`'da kilitli tahta karıştırması en kötü durumda yaklaşık 100 ms sürebilir (her yeniden renklendirmede `halkaVar` çağrılıyor); yalnız Usta bölümlerini etkiler, telefonda ölçülmeli.
- Altın anlık görüntüler bu turda değişmedi. Bir kural bilerek değişirse `npx vitest run -u` ile güncellenip fark gözden geçirilmeli.
- Dosyalar: `oyunlar/fitil/src/core/{oynatici.ts, oynatici.test.ts, README.md, kilit.ts}`, `oyunlar/fitil/src/core/spec/{uzlasma.test.ts, puan.test.ts}`.

## P4a bot + doğrulayıcı + bölüm 1–10

### Özet

Çekirdek dalı (worktree-wf_74377c46-e0f-3) birleştirildi; iki commit atıldı: c18f46e (ara) ve 6bdddaa (son).

- src/bot/ (§16.5):
  - adaylar.ts: aday üretimi. Adımlar: renk bileşenleri; bot RNG'siyle tohumlu DFS (bileşen başına ≤300 aday / 5000 düğüm, başlangıç başına pay); 4–8'lik DFS halkaları; Warnsdorff en uzun 10 yol ve özel taş eşiklerindeki ön ekleri; hedef sarma şablonları (kafes/kızgın/engel komşularını en kısa yollarla bağlar; döşeme/desen için zemin öncelikli açgözlü yol); 2×2 halkalar; roket nişan varyantları; Zobrist anahtarla yinelenen eleme; toplam ≤2000 aday. Ucuz puan (ilk dalga ısı, hedef hücreleri, uzunluk, özel taş) ile en iyi K aday seçilir. caprazSiniri, dortKomsu, yalnizHalka ve zorunluIlkHamle kısıtına uyar.
  - usta.ts: Körük doluysa en çok eşik hücresi üreten merkeze hemen kullanılır. En iyi 64 aday ve bütün çift dokunuşlar kopyada tam hamleUygula ile çözülür, V formülüyle seçim yapılır.
  - acemi.ts: uzunluk² ağırlıklı seçim, %20 olasılıkla 3–4'lük yol, rastgele Körük; boşta ipucu için acemiEnIyiAday.
  - ortak.ts: dürüst değerlendirme. Kopyanın RNG'si mulberry32(durumKarmasi ^ botTohumu); V formülü; agirliklar.json.
  - kazandiranBul.ts: "Bu çizgi kazandırırdı". Gerçek RNG ile, bütçe 300 tam çözüm; üretici (yield eden) sürümü de var.
  - simulasyon.ts: belirlenimli oyun döngüsü (üretici + düz sürüm) ve ölçüm kaydı.
  - olcut.ts: §16.5 ölçütleri.
  - index.ts: uygulamaya açık API.
- src/bot/sim-cli.ts:
  - `--bolum N --tohum K --bot usta|acemi`: hamle hamle döküm.
  - `--dogrula`: worker_threads, en fazla 3 işçi. İşçi, tsx/esm/api'yi kaydedip import.meta.url'yi içe aktaran bir eval betiğiyle başlar; Windows'ta da çalışır.
  - `--kalibre`: 500 tohum, yildizEsikleri'ni yazar (yalnız o satırı değiştirir), uzatılmış koşulardan hamle eğrisi ve öneri verir.
  - Ek: `--dosya` (index'e girmeden varyant JSON'u ya da klasörü dener), `--taslaklar`, `--json`, `--isci`, `--bas`.
  - Tablo sütunları: kazanma, yakın kaçış, R medyan/p90/p99, zincir medyanı, roket/kasımpatı/yıldız %, ortalama ısı / sınır, tahmini süre, Acemi oranı, puan p50/p85.
- src/levels/:
  - index.ts: 48 JSON açıkça içe aktarılır; BOLUMLER, USTA_BOLUMLERI, TUM_BOLUMLER, bolumGetir.
  - Taslaklar: b011–b040 ve u101–u108, §8.3 ve §10.2 tablolarına göre geçerli yer tutucular (`"taslak": true`).
  - dogrulayici.ts: statik kurallar. Başlangıç kilidi yükleyicinin karıştırıp karıştırmadığına bakılarak tespit edilir.
  - uretici.ts: Günün Şenliği ve Sonsuz Şenlik. Belirlenimli; hafif Usta (64 aday / 16 tam çözüm) ile 12 koşuluk süzme, %55–85 bandı; gunlukUret/sonsuzUret üretici fonksiyonları, zamanDilimli yardımcısı.
- Bölüm 1–10 GDD §8.3 ve §15'e göre tasarlandı:
  - Sabit kapsüller, zorunluIlkHamle (1–2), ipuçları ve el yolları, kazanç balonları (5).
  - Bölüm 3'te senaryo.ilkReaksiyonVurgusu.
  - Bölüm 10 GDD §8.1 örneğinden türetildi.
  - Hepsi botla ayarlandı; yıldız eşikleri 500 tohumla kalibre edildi. b001'de yalnız yildizEsikleri değişti.
- CLAUDE.md'ye bölüm tasarımı ve doğrulama notları eklendi.
- Testler: dogrulayici.test.ts (48 bölümün hepsi statik temiz, liste ve dosya tutarlılığı, negatif kurallar), bot.test.ts (belirlenimlilik, aday kuralları, dürüstlük, kazandiranBul, ipucu, ölçütler), uretici.test.ts (aynı tarih aynı bölüm, ardışık günler farklı, kurallar, zaman dilimli sürüm, sonsuz zorluk).

### Sapmalar

- Sözleşme ekleri (types.ts, BolumVerisi):
  - `taslak?: boolean`
  - `senaryo?: { ilkReaksiyonVurgusu?: boolean }` — §15, bölüm 3.
  - Var olan alanların anlamı değişmedi.
- Bot ağırlıkları (agirliklar.json; GDD §16.5 değerlerinden sapma):
  - GDD değerleri: kizgin 40, isiOrtalama 15, ozel 80. Bunlarla bot özel taş ve kızgın kapsül biriktiriyordu; reaksiyon p99 ≤ 35 neredeyse her bölümde aşılıyordu.
  - Roket sıklığı ozel ağırlığına bağlı: 15 → %41, 6 → yaklaşık %30 (ölçüt ≤ %35).
  - Yeni değerler: kizgin 8, isiOrtalama 6, ozel 6.
  - Eklenen terim: `kazanc` 5000 (kazandıran hamle her zaman seçilsin). V formülünün yapısı aynı.
- Ölçüt yorumları (olcut.ts):
  - Öğretim bölümlerinde şunlar muaf: zincir medyanı, R medyan/p90 bandı, 60 sn alt sınırı. §15'in 3–4 renkli küçük tahtaları açgözlü Usta'ya 8–11'lik zincirler çizdiriyor ve oyun 3–6 hamlede bitiyor.
  - Özel taş sıklığı öğretim ve tanıtımda uygulanmıyor.
  - Süre medyan üzerinden ölçülüyor; Körük eylemi de 3 sn düşünme sayılıyor.
- K21 yedek düğmeleri açıldı (§0: bantlar tutmazsa açılır):
  - `kurallar.soguma`: bölüm 6, 9 ve 10'da 3; bölüm 8'de 4.
  - Büyük reaksiyonların neredeyse tamamı ısınmış tahtada ateşlenen özel taşlardan geliyor; ayrıca bölüm 9'da oyunlar 60 sn'den kısa sürüyordu.
- Bölüm ayarları (GDD başlangıç değerlerine göre):
  - Bölüm 6: 22 hamle, 36 zümrüt + 36 mor.
  - Bölüm 7: 23 hamle, 38 kızıl + 34 gök.
  - Bölüm 8: 20 hamle, 5 halka + 40 kehribar. Hedefler +%25/+%33, ±%20'nin üstünde; amaç süre ≥ 60 sn.
  - Bölüm 9: 31 döşemeli, 1 hücre genişliğinde "sokak" ağı, kavşaklarda iki kafesli fener (C), 21 hamle.
  - Bölüm 10: 20 hamle (−%17); §8.1 örneğindeki onIsi kaldırıldı.
  - Öğretim bölümlerinde GDD hamle sayıları korundu; kalibrasyon 7–12 hamle öneriyor.
- Zorunlu ilk hamle (§15): bot yalnız vurgulu hücrelerdeki yolları dener ("vurgulu küme içindeki her geçerli yol").
- Doğrulayıcı yorumları:
  - Eşik 2 ve hamle < 12 yalnız Usta bölümlerinde (U5 Domino 8 hamle).
  - puan hedefi yalnız öğretim ve Usta bölümlerinde.
  - Fener doğumu varsa dolum alan her sütun çıkış olmalı.
  - İlk tahtayı yükleyicinin karıştırması hata sayılır.
- Üretici:
  - k. adayın tohumu mulberry32(tarih ^ (k+1)·φ). §10.5'in düz "tohum, tohum+1" dizisinde ardışık günler aynı bölümü üretiyordu.
  - Yalnız 1–15. bölüm öğeleri: kafes, ıslak, tek katlı döşeme, kaya 1–3 kat. Fener, Körük ve kova kullanılmıyor.
  - Yıldız eşikleri 12 süzme koşusundan hesaplanıyor.
  - Banda giren aday yoksa banda en yakın aday seçiliyor.
  - Sonsuz Şenlik zorluk eğrisi P4a yorumu: hamle −1/10 bölüm, 20'den sonra 6 renk, 10'dan sonra 2 katlı döşeme, kaya katları artar, bant her 10 bölümde 1 puan aşağı kayar.
- Aday eleme anahtarı: özel taş oluşturmayan yollarda ve halkalarda son düğüm ve eksen anahtara girmiyor (ters çevrilmiş eş yollar eleniyor).
- kazandiranBul gerçek RNG'yi kullanıyor (oyun bittiği için sızıntı yok); Körük ve güçlendirici denemiyor.
- CLI'da `--tohum K`, `--dogrula` ve `--kalibre` kiplerinde tohum SAYISI anlamına geliyor; ilk tohum `--bas` ile veriliyor.

### Açık işler

- Taslak 11–40 ve U1–U8 yalnız statik olarak geçerli. Taslaklar dahil 100 tohumluk koşuda bant dışı olanlar:
  - Kazanma çok düşük: 23 (%24), 26 (%8), 27 (%18), 28 (%14), 29 (%44), 30 (%3), 38 (%0), 40 (%2), 105 (%5).
  - Kazanma çok yüksek: 12, 13, 14, 19, 22, 24, 35, 37 ve Usta 101–104.
  - Yakın kaçış %0: 11, 16, 39, 105 (fener ve dev fişek hedefleri).
  - Bölüm 12'nin sabit 12'lik gök yolu yıldız topunu %30'a çıkarıyor.
  - Sonraki ajanlar `--dosya` ile varyant deneyip yalnız kendi JSON'larını değiştirmeli ve taslak bayrağını silmeli.
- GDD tutarsızlığı: bölüm 23'ün hedefi "40 gül" (renk 5) 6 renk istiyor, oysa §8.3'te R = 5. Taslakta renkSayisi 6 yapıldı; tasarımcı karar vermeli.
- Usta ağırlıkları değişirse bütün bölümler yeniden doğrulanmalı ve kalibre edilmeli.
- Soğuma (6, 8, 9, 10) arayüzde oyuncuya anlatılmalı (isiDegisti olayları geliyor). Bölüm 9'daki kafesli fenerler için ek bir ipucu balonu düşünülebilir.
- 100 tohumda kenara yakın bölümler: 8 (%86; 500 tohumda %89) ve 6 (500 tohumda %94; bant 90–95). Bot değişikliklerinde ilk bunlar kayabilir.
- Uygulama tarafı yapılmadı:
  - kisaYol, ilkHamleSonrasi ve kazanc ipuçlarının gösterimi.
  - El yolunun hamleden önce yolDogrula ile denetlenmesi (bölüm 2'nin ikinci el yolu yerçekimi sonrası koordinatlarla yazıldı).
  - zorunluIlkHamle'nin girdi katmanında uygulanması.
  - kazandiranAra ve gunlukUret'in Worker ya da zamanDilimli ile bağlanması.
- Push yapılmadı.


## P5 entegrasyon (src/app, src/main.ts)

### Akış
- Açılış ("Dokun ve başla" sesi açar) → **ilk açılışta doğrudan Bölüm 1** (bölüm
  öncesi kartı atlanır; K5: oyunun farkı ilk 20 saniyede hissedilsin). Harita ilk
  kazancın ödülüdür: fitil 2. bölüme yanar, ~1,5 sn sonra sıradaki bölümün kartı
  kendiliğinden açılır (yalnız ilerleme sınırındaki bölüm için; eski bölüm
  tekrarında açılmaz). Sonraki açılışlarda açılış → harita.
- Bölüm: kart → oyun → Kazandın (Devam → harita / Tekrar oyna) ya da Kaybettin
  (Tekrar dene ~0,4 sn, Haritaya dön, hayalet, Usta'nın Eli). Duraklat: devam /
  yeniden (hamle yapıldıysa kayıp sayılır) / ayarlar / harita (hamle yapıldıysa kayıp).
- Kazanç: Final Gösterisi önce HESAPLANIR ve sonuç kaydedilir, sonra oynatılır
  (final sırasında sayfa kapansa da kazanç kaybolmaz). Bölümü bitiren oynatma ve
  final duraklatılamaz.
- Mahalle tamamlanınca 6 sn'lik gök şovu (dokunuş atlar) + Fener Koyu Defteri kartı.
- Günün Şenliği / Sonsuz Şenlik: `levels/uretici` üreticisi rAF dilimleriyle
  sürülür (bekleme kartında 34 ms/kare, arka planda 7 ms/kare; oynatma ve çizim
  sırasında durur). Sonuç `fitil.uretim.<id>` anahtarında önbelleklenir. Bekleme
  kartı kapatılabilir; üretim arka planda sürer. Harita açılınca bugünün tahtası
  ve sıradaki sonsuz bölüm arka planda hazırlanır.
- Kayıt: `fitil.kayit.v1` (GDD §16.7; meta `KAYIT_ANAHTARI`), yazımdan önce
  yedek döndürme (`…yedek1/2`), 500 ms gecikmeli, sekme gizlenince hemen.
  `connectRemote()` bulut daha ilerideyse yükler ve haritayı tazeler.

### Sözleşme/modül ekleri (eklemeli)
- `OyunCizici`: `imlecGoster(h)` (klavye imleci, 3 px krem halka), `kutla(kademe)`
  (öğretimde zorla "Harika!"), `CiziciSecenek.gokyuzu` (Defter'de seçilen kişisel
  gökyüzü; Ay Işığı = mahallenin teması). `OyunCiziciTam` bu ekleri zorunlu tutar.
- `SesMotoru.uzakFisek(pan, guc)`: gökteki havai fişeklerin boğuk patlaması
  (`fisekDinle`'ye bağlı).
- Arayüz: `bekleme(metin, alt, iptal)` (üretim ilerleme kartı), `eksenSec(merkez,
  hucre)` (Fişek Kalıbı: 4 yön düğmesi), `modalAcik`, `HaritaVM.sonsuz` +
  `HaritaSecimi {tur:'sonsuz'}` (40 bitince büyük düğme "Sonsuz Şenlik N"),
  `KazandinVM.duyurular` (rozet, açılış, görev çipleri — tost yığını yerine).
- Arayüz düzeltmeleri: SVG yerel kimlikleri örneğe özgü (`tekilKimlik`): gizli
  haritadaki ilk portre yüzünden balonlardaki Kıvılcım Usta boş daire
  çiziliyordu. Yatay kısa ekranda (≤ 520 px) HUD paneli sıkışır ve kayar.

### Kararlar
- Reaksiyon yazısı ve "Şenlik başlıyor!" yalnız tuvalde (olay anında,
  kıvılcımlarla); `ui.reaksiyonYazisi`/`ui.bant('Şenlik…')` kullanılmıyor.
  "Son hamle!" bandı HUD'un. Son hamlede kalp atışı 900 ms'de bir yinelenir.
- Kısayol çakışması: HUD K/1/2/3/P (document), girdi oklar/QEZC/Boşluk/Enter/
  Backspace/Esc/D (window). Girdi kipi oturum durumundan türer; menü, oynatma ve
  sonuç ekranlarında girdi 'kapali' (modal açıkken tuşlar tahtaya gitmez).
- Öğretim balonları: 'ogretim' bölümlerinde her denemede, diğerlerinde bir kez
  (kayıtta `b<id>:<tetik>:<i>`). El yolu `yolDogrula` ile denetlenir (geçersizse
  gösterilmez); çizim başlayınca gizlenir, vazgeçilirse geri gelir. 5 sn boşta
  Acemi botun en iyi adayında parıltı (el açıkken değil). 5. bölümün iki kazanç
  balonundan sonuncusu final sırasında, ilki Kazandın kartında.
- Hayalet fitil: son hamle öncesi durumda `kazandiranAra` (300 tam çözüm) en fazla
  1,2 sn zaman dilimli; bulunamazsa düğme yok.
- Fişek Kalıbı ekseni sürükleme yerine 4 düğmeyle seçilir (dokunmatikte kesin).
- Ayarlar > İpuçları kapalı → balon, el ve boşta ipucu yok (zorunlu ilk hamle kural
  olarak kalır).

### Açık işler / bilinenler
- Gerçek telefonda (iOS/Android WhatsApp içi tarayıcı) denenmedi; ses kulakla
  dinlenmedi. Üretim süresi telefonda ölçülmedi (masaüstü Node: 1–22 sn; işçide
  ana iş parçacığına yük değil).
- Günlük görevler 10. bölüm kazancıyla açılınca o oyunun ilerlemesi yeni
  görevlere sayılıyor (meta `bolumSonucu` sırası); ilk günden 3/3 + 3 sandık gelebilir.
- Roket "çat" sesi 2×/4× hızlandırmada birkaç on ms geç kalabilir (P2b notu).

## Düzeltme turu (üç doğrulayıcının bulguları)

### Kararlar ve sapmalar
- **İlk dokunuş:** dokunuşta yalnız AudioContext kurulur/sürdürülür; gürültü
  tamponları ve yankı dürtüsü sonra, her biri ayrı görevde (boşta). İlk bölümün
  sprite, gök ve sandık pişirmeleri açılış ekranı beklerken `cizici.onIsit` ile
  parça parça yapılır. `gurultu2` kapanış ayırmıyor (sandık damarı 5–10 kat hızlı).
  Sandık ve gök aynı girdide yeniden pişmez (Tekrar dene, yeniden boyutlanma).
- **Üretim (§10.5):** Web Worker (`uretimIsci.ts`, Vite `?worker&inline`; tek
  dosyada Blob URL). İşçi kurulamazsa (CSP `script-src` Blob'u engelliyorsa
  konsola bir CSP satırı düşer) ana iş parçacığında tahminli bütçeyle sürer ve
  oyun ekranında durur. İşçi varsa günlük tahta 7. bölümden itibaren önden
  hazırlanır. Erken eleme: banda giremeyecek aday kalan koşuları oynamaz
  (bant içi seçim değişmez; yalnız hiçbir aday banda girmezse yedek seçimi
  olası en iyi orana göre). Önbellek günlük 8 / sonsuz 4 ayrı sınırla.
- **Otomatik kalite (§16.6):** ölçüt kare aralığı, eşik ekran tazelemesine göre
  (60 Hz'de 30 kare ort. > ~22 ms → düşük); yükseltme aralık tazelemeye
  yetişip JS iş süresi aralığın yarısından azsa, oynatma yokken; gereken iyi
  pencere her yükseltmede ikiye katlanır. Tek tük >100 ms takılmalar (art arda
  en çok 2) ve pişirme sonrası 30 kare ölçülmez; sürekli uzun kareler (yavaş
  cihaz) 250 ms'ye kırpılıp sayılır, yoksa kalite hiç düşmezdi.
- **Yazı tipi (§13.5):** Google Fonts bağlantısı kaldırıldı; "Baloo 2" 700/800
  Latin + Latin Ext (`@fontsource/baloo-2`) JS'e gömülü, FontFace'e ikili veri
  olarak verilir (CSP font-src data: yazı tipini reddetse de yüklenir).
- **Coşku Serisi:** hazır roket öğretim bölümlerinde (1–5) verilmez (§15 tek
  kavram; b5 çapraz roket nişanını öğretir); seri sayacı öğretimde de ilerler,
  roket 6. bölümde gelir. Tutumlu ve Üçüncü Kuşak öğretim oyunlarında sayılmaz.
- **Usta'nın Eli devamı:** meta, devam sonucunda özeti istatistikle
  tamamlamaz ve oyun sayısını artırmaz; Eli ile kazanılırsa sayılmış kayıp
  kazanca döner. Uygulama Eli sonrası özeti sıfırlar.
- **Günün Şenliği denemesi:** `siradakiDenemeNo` günlükte `gunluk.enIyi[t].deneme`
  okur (K15: her deneme taze dolum).
- **Kazandın:** öğretim balonu yıldızların altında, "Sıradaki" duyurulardan önce,
  duyurular önem sırasıyla (küçük ekranda 1, değilse 3 + "+N daha"). 1★ başlığı
  "Başardın!". Mahalle kartı yalnız gerçekten verilen güçlendiricileri ve toplam
  tozu gösterir.
- **Mahalle şovu:** tahta çizilmez (`cizici.sov`), gök ekranın %60'ına açılır,
  3–5'li salvolar + final salvosu, mahalle adı altın şeritte.
- **Bildirimler:** oyun ekranında gök bandında (tahtayı örtmez); hareketi
  azaltta transform'suz ortalanır; bellek kaydı uyarısı yalnız haritada, bir kez.
- **Bulut:** bağlantı kurucuda başlar; ilk açılış kararı en fazla 1,5 sn bekler;
  oturum sürerken gelen bulut kaydı harita dönüşünde uygulanır ve yerele yazılır.
- **Yatay telefon (yükseklik ≤ 480):** kartlar iki sütun, düğmeler kaydırmadan
  görünür; oyun balonu tahtanın solundaki boşluğu da kullanır (3 satır).
- **Öğretim:** bölüm 1'de 3 sn tereddütte el sona varıp bir düğüm geri döner
  (geri alma, §15 adım 5); "En az 3." kapanınca ana talimat döner; zorunlu
  küme dışına basış fıs + titreşim + vurgu/el yeniden. Balon ve el duraklat
  ya da çizim sırasında açılmaz; duraklat açık balonu kapatır, Devam geri getirir.

### Açık kalanlar
- Kalibrasyon (26–40, Usta yer tutucu eşikleri), öğretim sonrası zorluk duvarı
  (b6–b12 Acemi %0) ve ilk bölümlerin 1★ eşikleri bölüm verisi işi (JSON'a
  dokunulmadı); b023 ipucundaki yazım hatası ("Tarhtaki") da öyle.
- claude.ai'nin gerçek CSP'si Blob işçiye izin vermiyorsa üretim ana iş
  parçacığına düşer (doğrulandı: sandbox + katı CSP'de Günün Şenliği ~10 sn).
- "Bu çizgi kazandırırdı" kazandıran çizgi yoksa çıkmaz (isteğe bağlı "en çok
  ilerleten çizgi" eklenmedi). Boşta kare başına ~200 B ayırma kaldı.
