# EBRULİ — Oyun Tasarım Belgesi (GDD) v1.0 — DENEME SÜRÜMÜ

**Durum:** Uygulamaya hazır (P0 sözleşmesi `src/core/types.ts`, `src/core/index.ts`, `src/app/sozlesme.ts` ile birlikte bağlayıcı)
**Platform:** Tek dosya HTML. Canvas 2D + DOM arayüz, TypeScript, Vite 8 (IIFE tek dosya kipi).
**Dil:** Türkçe. **Hedef:** Telefonda dikey dokunmatik oyun (claude.ai bağlantısı, WhatsApp'tan); masaüstünde fare ve klavye; 60 fps.
**Kapsam:** 20 bölümlük deneme (2 atölye × 10). Asıl ürün FİTİL'dir; Ebruli dar kapsamlı, yüksek cilalı bir denemedir.

> Belgede iki tür sayı var. **Kural sabitleri** (çekirdek, testli; `src/core/sabitler.ts`) ile **ayar başlangıç değerleri** (bölüm verisinde durur, bot kalibrasyonu ±%20 oynatabilir) ayrı tutulur. Bölüm tablosundaki hamle, hedef adedi ve yıldız eşikleri başlangıç değeridir; bağlayıcı olan bölümün bot bandıdır (§14.4).

---

## 0. Karar günlüğü ve kural simülasyonu

Konsept (Ebruli, konsept paneli) ve üç hakemin ortak eleştirisi: *netlik 5–5,5/10; "hangi rengi nerede yaratayım" yükü ağır; tempo gizli "yardım"a bağımlı.* Kuralı yazmadan önce bir TS prototipiyle ölçtük (7×9, 25 hamle, 120–150 oyun/yapılandırma, toplam ~150 bin tahta durumu; botlar §14 ile aynı mantıkta; Acemi = önizlemeyi gören gündelik oyuncu vekili).

### 0.1 Ölçümler

"Hazır" = önizlemede (doğumsuz) en az bir grup eşleştiren karışım hamlesi; sayı eşsiz hücre çiftidir. Değerler Acemi / Açgözlü bot.

| Yapılandırma | Eşleşen hamle | 0 hazırlı durum | ≥ 2 hazırlı durum | Ort. hazır | Geçerli hamle | Not |
|---|---|---|---|---|---|---|
| Konsept, karışık doğum %0, yardım 3 | %21 / %21 | %79 / %85 | %9 / %5 | 0,4 / 0,3 | 129 | yardımın yeniden çekimi %78–84 başarısız |
| Konsept, karışık %20, yardım 0 | %47 / %51 | %46 / %59 | %34 / %21 | 1,5 / 1,0 | 117 | Usta %63 |
| Konsept, karışık %20, yardım 3 | %53 / %58 | %35 / %48 | %37 / %25 | 1,7 / 1,2 | 117 | |
| Konsept, karışık %30, yardım 0 | %60 / %66 | %29 / %42 | %51 / %37 | 2,8 / 2,0 | 109 | |
| Konsept, karışık %45 (≈ konseptin önerisi) | %76 / %86 | %8 / %20 | %82 / %64 | 5,5 / 4,1 | 92 / 100 | oyuncunun yarattığı grubun payı %31 |
| Mürekkep karışımı kapalı, %35, garanti 0 | %67 / %71 | %15 / %32 | %68 / %47 | 3,5 / 2,3 | 68 / 75 | |
| **SEÇİLEN: K1 + K2 + K3 (garanti 2)** | **%76 / %98** | **%1 / %2** | **%97 / %93** | **4,5 / 4,0** | **68 / 82** | Usta %98; yaratılan grup payı **%58**; garanti hamlelerin %25 / %49'unda devrede |
| Seçilen, garanti 3 (öğretim) | %77 / %98 | %1 / %2 | %97 / %95 | 5,1 / 4,8 | 69 / 82 | ≥ 3 hazır %93 / %89 |
| Seçilen + Mürekkep açık (Bölüm 11+) | %77 / %97 | %1 / %3 | %97 / %93 | 5,1 / 4,3 | 102 / 110 | hamlelerin %11 / %7'si Mürekkep yapar |
| Seçilen, garanti 1 (zor) | %75 / %95 | %2 / %6 | %72 / %54 | 3,9 / 2,9 | 70 / 84 | |
| 2 renk (K+S), 5×6, garanti 3 (Bölüm 1) | %74 / %86 | %9 / %15 | %86 / %80 | 4,0 / 3,5 | 33 / 37 | ilk tahta elle kurulur |
| Reddedildi: yayılma (ham kümesinin tamamı karışır) | %85–92 / %100 | %0 | %100 | 20–50 | 58–128 | açgözlü 15–24 damla/hamle, Lale 0,3–0,55/hamle: bulmaca kaybolur |
| Reddedildi: kümeli doğum (‰250–400) | −2…−12 puan | daha kötü | daha kötü | — | — | ham çiftleri çoğaltır, işe yaramaz |
| Reddedildi: ham renkler de eşleşir | %92 / %100 | %0 | %100 | 14 | 80 | 18–47 damla/hamle; Candy Crush'a döner, "yarat" kimliği kaybolur |

Rastgele bot (önizlemesiz, kör oyuncu): konseptte (%30–45 karışık) %22–32, seçilende %34. Ölü tahta (hiç geçerli hamle yok) hiçbir yapılandırmada görülmedi (ham boyalar bol); karıştırma kuralı yine de vardır (§4.8). Özel taş sıklığı (seçilen, Usta): Tarak 0,21, Girdap 0,03, Lale < 0,01 hamle başına.

### 0.2 Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| K1 | **Tek kural: "ham + ham = karışık".** Üç tarif (K+S=Turuncu, K+M=Mor, S+M=Yeşil). Konseptteki *karışık + eksik ham = Mürekkep* karışımı varsayılan **kapalı**; Bölüm 11'de tanıtılır ve oradan sonra açıktır (`murekkep: true`). Kapalıyken o hamle hiç gösterilmez. | Eşleşme oranını değiştirmeden geçerli hamle sayısını 103 → 68'e indirir (taranacak seçenek −%34). Rastgele oynayan, hamlelerinin %33–38'inde istemeden Mürekkep yapıyordu (tahtayı eşleşmez damlayla tıkıyor). |
| K2 | **Hazır karışık renkler de doğar:** varsayılan doğum ağırlıkları `[K, S, M, T, Mo, Y] = [20, 20, 20, 11, 11, 11]` (karışık payı ≈ %35). | Açgözlü botla %0'da hamlelerin %22'si, %20'de %51'i eşleşiyor. %35 eşleşmeyi taşırken grupların çoğunu hâlâ oyuncunun yarattığı damla kurar (%58; %45 karışıkta %40–46'ya düşer). Hakemlerin "RNG oyuncunun yerine eşleştiriyor" kaygısının dengesi. |
| K3 | **Garanti (akıllı yardım)** konseptin "yardım n: doğanları n kez yeniden çek" kuralının yerine: hamle sonunda tahtada en az `garanti` hazır karışım çifti olsun diye **son dolumda doğan damlaların rengi doğmadan önce** belirlenimli seçilir (§4.7). Öğretim 3, tanıtım/normal/rahatlama 2, zor 1. Oyuncuya açıkça söylenir ("Tekne cömerttir: her zaman hazır bir karışım vardır"). | Yeniden çekim, hazır hamle yokken %36–84 başarısız. Garanti 0 hazırlı durumu %32 → %2'ye indirir; ≥ 2 hazır %93–97. Hedef "her hamlede 2–3 bariz iyi hamle, %60+ eşleşme" tutuyor (Acemi %76). Dürüst: oyuncu hiçbir damlanın renk değiştirdiğini görmez, bot dolumu görmez (K14). |
| K4 | Yayılma, kümeli doğum ve ham eşleşmesi **reddedildi** (§0.1). | Ölçüm. |
| K5 | **Yön kuralı korunur:** sonuç hedefte oluşur, kaynak boşalır, kaynağın üstündeki sütun bir hücre iner. Önizleme bunu gösterir: sonuç damlasının düşeceği hücre ve kayacak sütunda soluk oklar. | Konseptin özgün fiili; önizlemeyle okunur. |
| K6 | **Geçersiz hamleler hiç gösterilmez.** Bir damlaya basınca yalnız geçerli komşular hafifçe şişer. Geçersiz bırakma ücretsizdir (3 titreme). | Hakem: "oyuncu ne yapacağını bilemeyebilir". |
| K7 | **Özel taş eşikleri 4 / 5 / 6** (Tarak / Girdap / Lale; konsept 4 / 5–6 / 7+). Girdap **baklava** alanını (|dx|+|dy| ≤ 2, 13 hücre) yutar; konseptin 5×5 halka döndürmesi kaldırıldı. | 7+ grup ölçümde hiç oluşmadı; 6 ile ara sıra. Halka döndürme okunmuyor ve çekirdeği şişiriyor (hakem). |
| K8 | **Önizleme baştan açık:** sürüklerken sonuç rengi hayaleti, eşleşecek gruplar (altın nabız), özel taş hayaleti, etki alanı ve hedef kartı nabzı (§3.5). | Konseptin "aha" anı; yükün çoğunu gözden alır. |
| K9 | **Özel taşa dokunan her sürükleme geçerlidir** (iki yönde de). Düz damla özel taşa sürüklenirse özel taş yerinde ateşlenir. | Gündelik oyuncu "ters yöne" çekince bir şey olmaması kafa karıştırıyordu. |
| K10 | **Dar kapsam:** 4 hedef türü (renk topla, kâğıda al, desen, puan) ve 3 engel (Kâğıt zemini, Mermer, Yağ). Küf, Altın varak, Akıntı, biçimli tekne (maske dışında) yok. | Deneme sürümü: dar kapsam, yüksek cila. |
| K11 | **İmza ödülü: Ebru tablosu** temizlik günlüğünden belirlenimli; 6 gerçek ebru tekniği (battal, gelgit, taraklı, şal, bülbül yuvası, çiçek). Nadirlik ustalığa bağlı. | Konseptin en güçlü fikri (üç hakem). |
| K12 | **İlk izlenim:** açılış → doğrudan Bölüm 1 öğretimi (el + tek satırlık Usta balonu + zorunlu ilk hamle). İlk 3 bölüm cömert (Acemi ≥ %95). | FİTİL dersi: gerçek gündelik oyuncu Bölüm 1'i bot tahmininin altında bitirdi. |
| K13 | **Yıldızlar:** 2★ = min(Usta p50, Acemi kazanç p50), 3★ = Usta p85, aşağı 100'e yuvarlanır; öğretimde elle cömert eşik. | FİTİL K22/K24 dersi. |
| K14 | **Dürüst bot:** gerçek dolum akışını görmez; bölümü bot bantları belirler. | FİTİL K14. |
| K15 | İlk tahta bölüm başına sabittir; dolum her denemede taze gelir. | FİTİL K15. |
| K16 | Aynı bölümde 3 ardışık kayıptan sonra gönüllü **Usta'nın Eli** (+5 hamle, en fazla 1★). | FİTİL K16. |
| K17 | **Renk motifleri varsayılan açık** (nokta, halka, dalga; karışık iki ebeveyninin motifini taşır). Ayrıca renk körü paleti. | Motif tarifi de öğretir; erişilebilirlik kilitli değil. |
| K18 | **Ses:** gündelik sesler Re (D) üzerinde konsonans (D–F♯–A–G); **hicaz** rengi (E♭–F♯ artık ikilisi) yalnız kaskat merdiveninde ve kazanma ney motifinde. | "Kulak tırmalamasın"; hicaz büyük anlara saklanır. |

**Kapsam dışı (deneme):** günlük bulmaca, sandık, güçlendirici mağazası, koleksiyon ekonomisi, rütbeler, kozmetik paletler (renk körü paleti hariç), Usta modu, 3–5. atölyeler (Kapadokya, Ege, Saray yalnız "Devamı yakında" ekranında adıyla), sunucu, can sistemi.

---

## 1. Kimlik

- **Ad:** Ebruli. **Slogan:** *Ham boyaları karıştır, aynı renkleri buluştur, kendi ebru tablonu kâğıda al.*
- **Özet:** Oyuncu bir ebru atölyesinde çıraktır. Tahta bir ebru teknesidir: koyu deniz yeşili ile lacivert arası, hafif dalgalanan su. Taşlar suyun üstünde yüzen boya damlalarıdır. İki **ham boyayı** (Kırmızı, Sarı, Mavi) birbirine sürükleyince **karışık renk** (Turuncu, Mor, Yeşil) doğar. Aynı karışık renkten 3 damla birbirine değince boya suya açılır ve kâğıda geçer. Her bölümün sonunda kâğıt suya serilip kaldırılır: oyuncunun o bölümdeki eşleşmelerinden üretilen, bir daha aynısı çıkmayacak bir **ebru tablosu** galeriye girer.
- **Tek cümle (oyuncuya):** "İki boyayı birbirine sürükle, yeni renk olsun. Aynı yeni renkten 3 damla değince kâğıda geçer."
- **Rehber:** yüzü gösterilmeyen kurgusal bir **Usta**; yalnız eli (fırça tutan, saydam) ve tek satırlık sözleri görünür. Gerçek bir kişiyi temsil etmez.

### 1.1 Candy Crush'tan farklar
1. **Hamle takas değil, karışımdır.** İki damla tek damlaya döner, kaynak boşalır, sütun iner. Eşleşmeyen karışım da yeni bir renk yaratır (kurulum hamlesi).
2. **Eşleşen renkler çoğunlukla yaratılır.** Ham boyalar malzemedir, eşleşmez; yalnız karışık renkler eşleşir.
3. **Yön anlamlıdır.** A'yı B'ye sürüklemek ile B'yi A'ya sürüklemek farklı sonuç verir; önizleme gösterir.
4. **Doğum ağırlıkları bulmaca düğmesidir** ("Sarı yağmıyor": Turuncu ve Yeşil kıtlaşır).
5. **Desen hedefi:** belirli hücreler belirli karışık rengi ister; oyuncu tekneye lale ya da karanfil boyar.
6. **Ödül kişiseldir:** her bölüm oyuncunun hamlelerinden çizilen bir ebru tablosu bırakır.
7. Can, bekleme, mağaza, satın alma yoktur. Tekrar denemek anında ve ücretsizdir.

---

## 2. Tahta ve öğeler

### 2.1 Geometri
- Varsayılan 7 sütun × 9 satır; aralık 4–8 × 4–10 (öğretim 5×6, 6×7, 6×8). x soldan 0..w−1, y yukarıdan 0..h−1, i = y·w + x.
- Komşuluk yalnız **yatay/dikey** (4 komşu). Yerçekimi aşağı.
- `#` (delik) hücreler teknenin dışındadır: çizilmez, damla almaz, yerçekiminde mermer gibi engeldir.

### 2.2 Hücre katmanları
| Katman | Alan | Değer |
|---|---|---|
| Delik | `delik` | true ise başka katman yok |
| Zemin: kâğıt | `kagit` | 0, 1, 2 kat (§6.1) |
| Zemin: yağ | `yag` | true/false (§6.3) |
| Zemin: desen | `desen`, `desenBoyali` | istenen karışık renk 3/5/6 ya da 0 (§7.3) |
| İçerik | `icerik` | `null` (boş), `{tur:'damla', damla}`, `{tur:'mermer', can 1–3}` |

### 2.3 Damla ve renk kodu (3 bit)
| Kod | Ad | Ebru adı | Tür | Motif | Eşleşir mi |
|---|---|---|---|---|---|
| 1 | Kırmızı | lal | ham | nokta | hayır |
| 2 | Sarı | zerrin | ham | halka | hayır |
| 4 | Mavi | çivit | ham | dalga | hayır |
| 3 | Turuncu | nar çiçeği | karışık (1+2) | nokta + halka | evet |
| 5 | Mor | menekşe | karışık (1+4) | nokta + dalga | evet |
| 6 | Yeşil | zümrüt | karışık (2+4) | halka + dalga | evet |
| 7 | Mürekkep | is mürekkebi | özel taş (§5.5) | üçü birden (altın) | hayır |

Damla `{ id, renk, ozel, yon }`: `id` bölüm içinde kalıcıdır (karışımla ya da doğumla doğan damla yeni `id` alır); çizici animasyon eşlemesi için kullanır. Özel taşlar: Tarak, Girdap (karışık rengini taşır, o rengin gruplarına katılır), Lale (renk 0), Mürekkep (renk 7).

### 2.4 Hareketli ve sabit
- **Hareketli:** bütün damlalar (özel taşlar dahil) düşer.
- **Sabit:** mermer düşmez; altındaki boşluk çapraz kaymayla dolar (§4.5). Zemin katmanları hücreye aittir, damlayla birlikte düşmez.

---

## 3. Hamle

### 3.1 Kural (bağlayıcı)
Oyuncu bir damlayı yatay ya da dikey komşusuna sürükler: kaynak `a`, hedef `b`. Bir hamle her zaman tek ve kalıcıdır; geçersiz hamle hamle harcamaz.

### 3.2 Girdi
- **Pointer Events**, yalnız ilk `pointerId`. Damlaya basınca damla 1,08× kalkar, geçerli komşuları hafifçe şişer (K6).
- Hareket **12 px**'i geçince baskın eksen yönü belirler; hedef o yöndeki komşudur. Parmak hedefin üstündeyken önizleme gösterilir (§3.5). Bırakınca hamle.
- **Dokun-dokun:** bir damlaya dokun (seçili kalır), sonra geçerli bir komşuya dokun. Başka yere dokunmak seçimi kaldırır.
- **Masaüstü:** fare sürükleme ya da dokun-dokun. **Klavye:** oklar imleci taşır; Enter/Boşluk seçer; seçiliyken ok tuşu o yöndeki hamleyi yapar; Esc bırakır. Odak halkası 3 px altın.
- Telefonda hücre ≈ 48 px (390 px genişlikte 7 sütun → 50 px).

### 3.3 Geçerlilik tablosu (`hamleHatasi`, `karisimSonucu`)
| Kaynak `a` | Hedef `b` | Sonuç | Hata kodu |
|---|---|---|---|
| ham | farklı ham | hedef `a\|b` (karışık) olur, kaynak boşalır | — |
| karışık | eksik ham (ya da tersi) | hedef Mürekkep (7) olur — **yalnız `murekkep: true`** | kapalıysa `murekkepKapali` |
| aynı renk | | geçersiz | `ayniRenk` |
| ortak bileşen (ör. Turuncu + Kırmızı) | | geçersiz | `ortakBilesen` |
| karışık | karışık | geçersiz | `karisikKarisik` |
| Mürekkep (düz olarak) | | — (özel taş kuralı geçer) | |
| özel taş | herhangi bir damla | ateşleme ya da birleşim (§5.3) | — |
| düz damla | özel taş | özel taş yerinde ateşlenir (K9) | — |
| yağlı hücredeki damla | — | ne kaynak ne hedef olabilir | `yag` |
| mermer / boş / delik | — | geçersiz | `mermer` / `bos` / `konum` |
| komşu değil | — | geçersiz | `komsuDegil` |
| bölüm bitti / hamle yok | — | geçersiz | `bitti` / `hamleYok` |

### 3.4 Yön ve kaynak sütunu
Sonuç **hedef hücrede** oluşur, kaynak hücre boşalır, ardından yerçekimi işler (§4.5). Sonuçları:
- Yatay hamle: kaynak sütunu bir iner, en üstte yeni damla doğar.
- Hedef kaynağın **üstündeyse** (yukarı sürükleme): sonuç damlası boşalan kaynağa düşer; sonuç `sonucHucre` = kaynak.
- Hedef kaynağın **altındaysa** (aşağı sürükleme): sonuç yerinde kalır, üstündeki sütun bir iner.

### 3.5 Önizleme (`onizle`, K8)
Parmak geçerli bir hedefin üstündeyken çekirdek hamleyi **doğumsuz** çözer (dolum yapılmaz, boş hücreler boş kalır) ve döndürür:
- `sonuc`, `sonucHucre`: sonuç renginin hayaleti (hedef damlanın halkaları sonuç rengine döner; damla 1,1× şişer) ve düşeceği hücre.
- `gruplar`: ilk adımda eşleşecek gruplar → altın kontur, 2 Hz nabız.
- `temizlenecek`: kaskat ve özel dahil bütün temizlenecekler → alfa 0,35 soluk işaret.
- `ozelHayalet`: grup özel taş üretecekse taşın hayaleti (alfa 0,6).
- `etkiAlani`, `kombo`: özel sürüklemede alan (kesik altın çizgi) ve birleşim adı.
- `hedefArtisi`: hedef kartı bu hamleyle ilerleyecekse kart nabız atar.
- Kayacak sütunda soluk aşağı oklar (alfa 0,35; öğretimde 0,7).
Önizleme saftır, durumu değiştirmez, kısmi sürüklemede fırlatmaz. Bütçe < 1 ms (7×9).

---

## 4. Çözümleme döngüsü

### 4.1 Saf fonksiyon
`hamleUygula(d, h) → { durum, olaylar }`: girdiyi değiştirmez (derin kopya), aynı (durum, hamle) aynı sonucu verir. Bütün rastgelelik `d.rng` (mulberry32) akışından gelir. Geçersiz hamlede `HamleHatasiIstisnasi` fırlatır.

### 4.2 Adımlar
1. **Eylem** (t = 0): karışım (`karisti`) ya da özel sürükleme (`ozelSuruklendi`, §5.3). `hamleNo++`, `kalanHamle−−`.
2. **Döngü** (k = 1'den; en fazla `KASKAT_SINIRI` = 50 tur):
   a. **Yerçekimi** (§4.5): düşme ve çapraz kayma, **dolum yok**.
   b. **Eşleşme** (§4.3): grup varsa → c. Grup yoksa → **dolum** (§4.6): boş yuvalar doğumla dolar. Dolumdan sonra grup yoksa bu son dolumdur → **garanti** (§4.7) doğanların rengini seçer, döngü biter. Dolumdan sonra grup varsa → c. Turun düşenleri ve doğanları tek bir `yercekimi` olayında yazılır (garanti renkleri dahil); hiçbir şey düşmediyse ve doğmadıysa olay yok.
   c. **Temizleme** (§4.4) — bütün gruplar aynı anda. k ≥ 2 ise adımın başında `kaskat` olayı. k++ ve a'ya dön.
   Sonuç: oyuncunun hamlesinin belirlenimli zinciri (dolumsuz kaskatlar dahil) önce biter, doğan damlaların getirdiği eşleşmeler sonra gelir. Bu yüzden **önizleme tam doğrudur**: `onizle(d, h).temizlenecek` = hamlede ilk dolumdan önce temizlenen hücreler (P1 testi).
3. **Hamle sonu** sırası: (i) hedef kontrolü → bütün hedefler tamamsa `bolumBitti{kazanc}`; değilse `kalanHamle = 0` → `bolumBitti{kayip}`; (ii) bitmediyse ölü tahta testi (§4.8) → `karistirma`; (iii) son olay `hamleOzeti`.

### 4.3 Eşleşme
- Yalnız **karışık renkler** (3, 5, 6) eşleşir. Aynı karışık renkten yatay/dikey bağlı **en az 3** damlalık her bileşen (flood-fill) bir gruptur.
- Tarak ve Girdap kendi renklerinin grubuna katılır. Ham boya, Lale ve Mürekkep katılmaz.
- Gruplar en küçük hücre indeksine göre sıralanır (belirlenimlilik).

### 4.4 Temizleme sırası (bir adım içinde)
1. Her grup için `eslesti` (aynı t).
2. Grup hücreleri `temizlendi{neden:'grup'}`; her temizlenen hücre için hemen ardından zemin olayları: `kagitAlindi`, `yagKalkti`, `desenBoyandi` (renk uyuyorsa), `hedefIlerledi`.
3. **Özel taş üretimi** (§5.1): `ozelOlustu` + `puanEklendi{ozel}`.
4. Gruptaki Tarak/Girdap'lar ve alanlara giren özel taşlar **BFS kuyruğuyla** ateşlenir (`ozelTetiklendi`, katman başına +150 tik). Bir hücre bir adımda yalnız bir kez temizlenir ("ilk plan kazanır").
5. **Mürekkep:** temizlenen bir grup hücresinin yatay/dikey komşusundaki Mürekkep patlar (3×3); alanlara giren Mürekkep de patlar. Zincirlenir.
6. **Engel hasarı:** mermer, yatay/dikey komşusunda temizlenen **her grup için** −1 can (aynı grup birden çok komşu hücreyle değse de bir kez); özel alanına ya da Mürekkep patlamasına giren mermer −1 (adım başına en fazla 1 alan hasarı).

### 4.5 Yerçekimi (çapraz kaymalı)
Değişiklik kalmayana kadar tekrarlanır:
1. **Düz düşme:** her sütunda alttan yukarı, damlalar ilk boş hücreye iner; mermer ve delik engeldir (üstündeki parça ayrı bölümdür).
2. **Çapraz kayma:** alttan yukarı, soldan sağa taranan her boş hücre, düz yoldan beslenemiyorsa (üstü engel ya da üstündeki parçada damla yok ve o parça doğum yeri değil) önce **sol-üst**, sonra **sağ-üst** çaprazdaki damlayı alır (o damla kendi sütununda aşağı düşemiyorsa).
Dolum (§4.6) yalnız **y = 0** satırındaki açık hücrelerden yapılır; üstü mermer/delikle kapalı parçalar dolumla değil kaymayla beslenir. Dolumdan sonra yerçekimi yeniden işler (doğanlar da düşer ve kayar).
`yercekimi.dusenler` her damlanın turdaki ilk ve son konumunu verir (çapraz dahil); `doganlar` doğanların tam damlasını ve `sanalY` (−1, −2…: tahta üstündeki başlangıç satırı) taşır.

### 4.6 Dolum
Her doğan damla için `agirlikliSec(rng, dogum)` → `DOGUM_SIRASI = [1, 2, 4, 3, 5, 6]`. Sıra: soldan sağa sütun, her sütunda aşağıdan yukarı yuva. Ağırlığı 0 olan renk hiç doğmaz.

### 4.7 Garanti (akıllı yardım, K3)
Son dolumdan sonra tahta grupsuzsa (döngü bitecekken) ve hazır çift sayısı `garanti`'den azsa:
```
adaylar = bu son dolumda doğan düz damlalar, (y azalan, x artan) sırada
hazir = hazirCiftSayisi(d)                       // olumluHamleler'in eşsiz hücre çiftleri
for c in adaylar:
  renkler = ağırlığı > 0 renkler (DOGUM_SIRASI), Fisher–Yates ile rngInt'le karılmış
  for r in renkler, r ≠ c.renk:
    c.renk = r
    if gruplariBul(d) boş değilse: devam              // garanti asla grup doğurmaz
    if hazirCiftSayisi(d) > hazir: hazir artar; bu rengi tut; dur
  bulunamazsa eski renge dön
  if hazir ≥ garanti: dur
```
- Renk değişimi `yercekimi.doganlar`'a yazılmadan önce yapılır: oyuncu hiçbir damlanın renk değiştirdiğini görmez. Başarısızlık mümkündür (ölçüm: 0 hazırlı durum %1–2); son çare yoktur.
- Kullanıldıysa `istatistik.garantiKullanimi++`.
- İlk tahtaya da aynı kural rastgele hücrelerle uygulanır (P1; `bolumuYukle`).
- Performans: hazır sayımı yerel güncellenir (değişen hücreye Manhattan ≤ 3 olan hamleler yeniden değerlendirilir). Bütçe: ortanca < 2 ms, p99 < 8 ms (masaüstü).

### 4.8 Ölü tahta ve karıştırma
Hamle sonunda hiç geçerli hamle yoksa (`gecerliHamleVar` false): bütün **düz, yağsız** damlalar rng ile karıştırılır (Fisher–Yates); grup oluşturan ya da yine geçerli hamle vermeyen permütasyon reddedilir (en fazla 100 deneme). 100 denemede bulunamazsa son çare: düz damlaların ilki, komşusuyla karışabilecek bir ham renge (DOGUM_SIRASI'nda ilk uygun) boyanır. Olay `karistirma{esleme}`; çizici "Tekne çalkalanıyor…" yazısıyla 500 ms canlandırır.

### 4.9 Zamanlama (tik; 1 tik = normal hızda 1 ms)
| Aşama | Tik |
|---|---|
| Karışım (`karisti` → çözüm başlangıcı) | 220 |
| Özel sürükleme kayması | 120 |
| Yerçekimi turu (`yercekimi` → sonraki aşama) | 300 |
| Toplanma (`eslesti` → `temizlendi`) | 120 |
| Yayılma (son temizlik → sonraki adım) | 250 |
| Tarak: hücre başına (merkezden uzaklık d) | 25·d |
| Girdap çöküşü | 400 (hücreler +120'de) |
| Lale: i. hedef damla (uzaklık sırası) | 300 + 30·i |
| Mürekkep patlaması | 200 |
| BFS zincir katmanı | +150 |
| Birleşim (çizici %40 hızda oynatır) | +150 |
| Ebru Şöleni: i. tarak | 160·i |
Olaylar `t`'ye göre azalmayan sıradadır; aynı t'dekiler listedeki sırayla uygulanır (sıra anlamlıdır: önce `temizlendi`, sonra o hücrenin zemin ve hedef olayları). Dokunmak oynatmayı 2×, ayarlardaki "Hızlı" 1,5× hızlandırır; kural değişmez.

### 4.10 RNG tüketim sırası
dolum (her dolumda; soldan sağa sütun, aşağıdan yukarı yuva) → garanti karıştırmaları (yalnız son dolumda) → ölü tahta karıştırması → Ebru Şöleni seçimleri. İlk tahta ayrı akıştır (`tohum`); oyun akışı `oyunTohumu(tohum, denemeNo)`.

---

## 5. Özel taşlar

### 5.1 Oluşum
| Grup boyu | Özel taş | Görünüm (§11.3) |
|---|---|---|
| 4 | **Tarak** (grubun rengi). Sınır kutusu enine genişse **yatay** (satırı tarar), boyuna uzunsa **dikey** (sütunu tarar); 2×2'de hamlenin yönü (kaskatta yatay). | damla üstünde 7 dişli altın tarak |
| 5 | **Girdap** (grubun rengi) | üç kollu altın sarmal, 0,3 Hz döner |
| 6+ | **Lale** (renksiz, renk 0) | krem yanardöner lale silueti, altın kontur |
- **Yer:** grupta bu hamlenin karışımıyla doğan damla (yeniId) varsa onun hücresi; yoksa grubun **en alt satırındaki en soldaki** hücresi.
- Bir grup tek özel taş üretir; büyük olan kazanır (Lale > Girdap > Tarak). Özel taşın hücresindeki grup damlası temizlenir, taş o hücreye yazılır.
- Üretim bonusu: Tarak 200, Girdap 400, Lale 800 puan.

### 5.2 Etkiler
| Taş | Alan | Not |
|---|---|---|
| Tarak yatay / dikey | bütün satır / sütun | engeller −1, delikler atlanır |
| Girdap | baklava |dx|+|dy| ≤ 2 (13 hücre) | |
| Lale | hedef rengin **bütün** damlaları (ham dahil) | ham boyayı silmenin yollarından biri |
| Mürekkep | 3×3 | ham dahil her şey, engeller −1 |
Özel güçle temizlenen damla 20 puan (Mürekkep 15). Alana giren Lale, tahtada en bol rengi (eşitlikte `DOGUM_SIRASI`) temizler; alana giren Tarak/Girdap/Mürekkep kendi etkisini başlatır (BFS).

### 5.3 Tetikleme (K9)
| Durum | Ne olur |
|---|---|
| Tarak/Girdap bir grupla temizlendi | kendi hücresinde ateşlenir |
| Tarak/Girdap → komşu damla | taş hedefe kayar (`tasindi: true`), hedefteki damla temizlenir, taş orada ateşlenir; kaynak boşalır (1 hamle) |
| Lale → komşu damla | Lale yerinde açılır; hedefin rengi temizlenir (1 hamle) |
| Mürekkep → komşu | yerinde patlar (1 hamle) |
| Düz damla → özel taş | özel taş **yerinde** ateşlenir; Lale kaynağın rengini alır; kaynak damla alanda değilse kalır (1 hamle) |
| Özel → özel | birleşim, hedef hücrede (§5.4) (1 hamle) |
| Yağlı hücredeki özel taş | sürüklenemez; grup/alanla ateşlenir |

### 5.4 Birleşimler (özel taşı özel taşa sürükle; etki hedefte)
| | Tarak | Girdap | Lale | Mürekkep |
|---|---|---|---|---|
| **Tarak** | Artı: satır + sütun | 3 satır + 3 sütun | Tarak'ın rengindeki bütün damlalar tarağa döner (yön sırayla yatay/dikey), 80 tik arayla ateşlenir | Kalın tarak: tarağın yönünde 3 hat |
| **Girdap** | | Büyük baklava |dx|+|dy| ≤ 4 | Girdap'ın rengindeki bütün damlalar girdaba döner, ateşlenir | Baklava |dx|+|dy| ≤ 3 |
| **Lale** | | | Bütün tahta (engeller −1) | Bütün ham boyalar (1, 2, 4) silinir, ardından kaskat |
| **Mürekkep** | | | | 5×5 patlama |
Dönüşümler `donustu` olayıyla yazılır; birleşim `birlesim{kombo, alan}`; puan: birleşim alanındaki damla 20, ek `puanEklendi{ozel}` 300 (Lale içerenler 600).

### 5.5 Mürekkep (bölüm 11'den sonra)
- **Oluşum:** `murekkep: true` bölümlerde karışık + eksik ham (her iki yön): sonuç hedefte Mürekkep (renk 7, `ozel: 'murekkep'`). Bölüm verisinde `7` simgesiyle de konabilir.
- Eşleşmez, karışmaz. **Komşusunda (yatay/dikey) bir grup temizlenince** 3×3 patlar; bir alana girince patlar; sürüklenince ya da üstüne sürüklenince yerinde patlar.
- Usta sözü: "Üç renk bir olunca: Mürekkep." / "Yanında eşleşme olunca patlar."

---

## 6. Engeller (deneme: 3 tür)

### 6.1 Kâğıt (zemin, 1–2 kat) — "kâğıda al"
- Hücrenin altında, suda bekleyen ebru kâğıdı. Üstündeki damla **herhangi bir yolla** (grup, özel, Mürekkep, Lale) temizlenince boyası kâğıda geçer: 1 kat alınır (`kagitAlindi{kalan, renk}`; 50 puan).
- Kat 2 → 1: üst kâğıt boyanıp uçar (HUD'a), alttaki kalır. Kat 1 → 0: kâğıt uçar.
- Mermerin altında kâğıt olabilir; mermer kırılınca açığa çıkar ama mermerin kırılması kâğıt almaz.

### 6.2 Mermer (sabit, 1–3 can)
- Düşmez, karışmaz, sürüklenemez. Komşusunda grup temizlenince grup başına −1; alana/patlamaya girince −1 (§4.4). Can başına 40 puan. 0 olunca kalkar, yerine yerçekimiyle damla gelir.
- Görünüm: beyaz-gri damarlı mermer; can sayısı = katman çizgisi (3/2/1), her hasarda çatlak.

### 6.3 Yağ (zemin)
- Yağlı hücredeki damla **karışıma katılamaz** (ne kaynak ne hedef); ama düşebilir, gruplara katılabilir, özel güçle temizlenebilir.
- Üstündeki damla herhangi bir yolla temizlenince yağ kalkar (`yagKalkti`, 20 puan).
- Strateji: yağın üstünü bir grupla ya da özel güçle temizlemek, ya da yağın üstüne karışık damla düşürüp eşleştirmek. Karışımı hedef alan tek engel (ebrudaki "yağ boyayı iter" gerçeği).

---

## 7. Hedefler (deneme: 4 tür)

Bir bölümde 1–2 hedef; hamle 12–26. Bir bölüm 1–3 dakika sürer.

### 7.1 Renk topla — `{tur:'topla', renk: 3|5|6, adet}`
Grupla, özel güçle, Mürekkeple ya da Lale ile temizlenen o renkte **her damla** sayılır (o renkteki Tarak/Girdap dahil). Damla Bezier eğrisiyle hedef kartına uçar.

### 7.2 Kâğıda al — `{tur:'kagit'}`
`gerekli` = başlangıçtaki toplam kat sayısı; her `kagitAlindi` +1.

### 7.3 Desen — `{tur:'desen', motif:'lale'|'karanfil'}`
- Bazı hücreler belirli bir karışık rengi ister; suyun altında o rengin silik çizgisiyle (motif parçası) gösterilir.
- O hücrede **o renkte** bir damla herhangi bir yolla temizlenince hücre kalıcı olarak boyanır (`desenBoyandi`, 100 puan). Başka renk boyamaz.
- Bütün desen hücreleri boyanınca motif tamamlanır; motif bölüm tablosuna çiçek ebrusu olarak girer (§9.2).

### 7.4 Puan — `{tur:'puan', puan}`
Yalnız ikinci hedef olarak (rahatlama bölümleri). `gerekli` = puan.

Hedef kartı: 64×52 kâğıt kart; ikon (renk damlası / kâğıt / motif / mühür), kalan sayı 18/800. Tamamlanınca altın onay mühürü.

---

## 8. Puan, kaskat, şölen, yıldız

### 8.1 Taban puanlar (`PUAN`)
| Kaynak | Puan |
|---|---|
| Grup damlası | 30 × k (k kaskat adımı, 1'den) |
| Özel güçle temizlenen damla | 20 |
| Mürekkep patlamasıyla temizlenen damla | 15 |
| Tarak / Girdap / Lale üretimi | 200 / 400 / 800 |
| Birleşim | +300 (Lale içerirse +600) |
| Kâğıt katı | 50 |
| Mermer canı | 40 |
| Yağ | 20 |
| Desen hücresi | 100 |
| Ebru Şöleni: kalan hamle başına | 300 (+ tarakların damla puanı) |
Bir eylemde Δpuan = Σ `temizlendi.puan` + Σ `puanEklendi.miktar`.

### 8.2 Kaskat kademeleri
k = 2 **"Güzel"**, 3 **"Nefis"**, 4 **"Harika"**, 5+ **"Şaheser!"** (`kaskat.kademe`). İri Cormorant yazı, mürekkep sıçraması gibi kabarır. Nota hicaz merdiveninde k. basamak (§10.3).

### 8.3 Ebru Şöleni (kazanınca)
Uygulama `ebruSoleni(d)` çağırır: "Ebru Şöleni!" yazısı; kalan her hamle için (en fazla 15; fazlası yalnız puan) rng ile seçilen düz **karışık** damla tarağa döner (`donustu`; yön sırayla yatay/dikey) ve 160·i tikte ateşlenir; ardından normal çözümleme. Kalan hamle başına +300. Sonunda `kalanHamle = 0`, `solenYapildi = true`; ikinci çağrı fırlatır. Karışık damla yoksa ham damla seçilir.

### 8.4 Yıldızlar ve Usta'nın Eli
- 1★ = bütün hedefler; 2★ / 3★ = `yildizEsikleri` puan eşikleri (K13; §14.4). Öğretimde `elleEsik: true`.
- **Usta'nın Eli** (K16): aynı bölümde 3. ardışık kayıptan sonra kaybettin ekranında: "Usta'nın Eli: +5 hamleyle devam et (en fazla 1★)". Ücretsiz, denemede bir kez. `ustaEliUygula(d)`: `kalanHamle += 5`, `bitti = null`, `istatistik.ustaEli = true`; tahta ölüyse karıştırır.

---

## 9. Ebru tablosu (imza ödülü, K11)

### 9.1 Temizlik günlüğü
Çekirdek her grup, özel ateşleme, birleşim ve Mürekkep patlaması için `d.gunluk`'a bir `TemizlikKaydi` ekler: `{hamle, k, tur, x10, y10, renk, boyut, yon?}` (x10/y10 = ağırlık merkezi ×10, tamsayı). Tipik bölüm 60–120 kayıt. Kayıt, tablo için **tek** girdidir: görüntü saklanmaz, istendiğinde `tabloCiz(istek)` belirlenimli yeniden çizer (aynı günlük + tohum → piksel piksel aynı tablo). Kayıtta sıkıştırılmış hali: kayıt başına 6 bayt (hamle 1, k·tur 1, x10 1, y10 1, renk·yön 1, boyut 1) → base64 ≈ 0,5–1 KB/bölüm.

### 9.2 Teknikler (gerçek ebru türleri; tamamı prosedürel)
| Teknik | Gerçek karşılığı | Tetik (günlükte) | Uygulama (§9.3 işlemleri) |
|---|---|---|---|
| **Battal** | serpilmiş boya halkaları, ebrunun temeli | her `grup` kaydı (taban) | grup başına bir damla bırakma (r = 22·√boyut px, 512 px genişlikte) |
| **Gelgit** | biz ile ileri geri çekilmiş dalgalar | bir hamlede k ≥ 3 | o hamlenin damlalarından sonra dikey ileri-geri çizgiler: 48 px arayla, z = 40 px, ℓ = 20 px, yön her çizgide ters |
| **Taraklı** | tarakla taranmış ince dalgalı çizgiler | her `tarak` kaydı (bölüm başına en fazla 3) | tarağın yönünde paralel tarama: 16 px arayla, z = 24 px, ℓ = 10 px |
| **Şal** | gelgit üstüne tarak + dalgalı geçiş | gelgit ve taraklı aynı tabloda | son tarağın ardından dik yönde sinüs tarama: z = 18 px, dalga boyu 96 px, genlik 20 px |
| **Bülbül yuvası** | biz ile çevrilmiş sarmal yuvalar | her `girdap` kaydı | merkezde girdap dönüşümü: θ(d) = 2,6·e^(−d/40) radyan |
| **Çiçek ebrusu** | lale / karanfil (Necmeddin Okyay geleneği) | `lale` kaydı ya da desen hedefi tamamlandı | atölyenin çiçeği tablonun alt üçte birinde (§9.3) |
| (Mürekkep) | is serpintisi | her `murekkep` kaydı | merkez çevresine 5–9 küçük siyah damla (r 6–10 px) |

### 9.3 Algoritma
- **Tuval:** 512×768 CSS px (2:3, ebru kâğıdı oranı), DPR ≤ 2; OffscreenCanvas yoksa `document.createElement('canvas')`. Zemin aharlı kâğıt #F3E9D2 + belirlenimli lif dokusu (tohumlu 600 kısa çizgi, alfa 0,04).
- **Model:** çokgen listesi (her boya lekesi bir çokgen, `Float32Array` köşeler, renk). Eşleme: tahta x → tuval %8–92, tahta y → tuval %8–80; rng(tohum) ile ±12 px sapma.
- **Damla bırakma** (merkez c, yarıçap r): bütün eski köşeler `p' = c + (p−c)·√(1 + r²/|p−c|²)` ile itilir; yeni çokgen 64 köşeli daire.
- **Tarama (tine)** (L doğrusu, birim yön m, normal n): `p' = p + z·u^(|(p−L)·n| / ℓ)·m`, u = 0,5.
- **Girdap:** merkeze uzaklık d, açı θ(d) kadar döndürme.
- **Lale (çiçek):** merkez c: 1 büyük damla (r 34, Mor ya da günlükteki en bol karışık renk), iki yanında 2 küçük (r 18) → c'den yukarı tek tarama (z 60, ℓ 14) → taç; yeşil sap: 6 küçük damla (r 7) aşağı dizilir, aşağı tarama (z 30). **Karanfil:** 1 damla (r 30) + kenarında 10 küçük damla (r 8) → her biri dışa doğru kısa tarama (z 16, ℓ 6): tırtıklı taç; sap lale gibi.
- **Yeniden örnekleme** (her işlemden sonra): kenar > 6 px ise ortadan böl; < 1,5 px ise birleştir. Çokgen başına ≤ 600, toplam ≤ 15 000 köşe; aşılırsa en eski çokgenler dondurulur (örnekleme dışı).
- **Çizim:** çokgenler oluşum sırasıyla `fill` (nonzero); üstte kâğıt dokusu `multiply` alfa 0,12; ince altın çerçeve; alt kenarda künye (Alegreya Sans 500, 13 px, #5A4E3F): "Üsküdar · Bölüm 4 · Taraklı ebru".
- **Belirlenimlilik:** RNG yalnız `mulberry32(tohum)`; `Math.random` yok. Tohum = `fnv1a("ebruli|" + bolumId + "|" + denemeNo + "|" + puan)`.
- **Bütçe:** orta telefonda ≤ 150 ms; kâğıt çekme animasyonunun (1,8 sn) arkasında, kare başına 8 ms dilimlerle (üreteç fonksiyon). Zayıf cihazda (ilk karede > 20 ms) sade mod: 32 köşeli daire, toplam ≤ 6 000 köşe.
- **Sudaki canlı iz** (oyun sırasında): her `grup` kaydı su katmanına (offscreen) tahta konumunda tek bir soluk halka damgası basar (alfa 0,06, r 0,8 hücre); bölüm boyunca birikir — tablonun silik ön izlemesi.

### 9.4 Nadirlik ve galeri
| Nadirlik | Koşul | Görünüm |
|---|---|---|
| Sade | varsayılan | ince altın çerçeve |
| Zarif | Lale kullanıldı **ya da** 3★ **ya da** desen tamamlandı | çift altın çerçeve + köşelerde rumi |
| Şaheser | Lale+Lale birleşimi **ya da** k ≥ 5 kaskat **ya da** (3★ ve ≥ 3 farklı teknik) | Zarif + altın varak tozu (tohumlu 140 altın pul) |
- **Galeri:** her bölümün en iyi tablosu (oyuncu seçer: [Bunu sakla] / [Eskisini koru]); 20 kart, 4 sütun; kart dokununca tam boy + teknik künyesi. Kilitli kartlar suda silik damla. Küçük resimler (128×192) önbellekli; anahtar `bolumId|tohum|boyut|DPR`.

### 9.5 Kâğıt çekme anı
Kazanınca şölenden sonra: tahta kararır (alfa 0,55, 400 ms) → krem kâğıt üstten suya serilir (600 ms, `outCubic`; su halkaları kenarından açılır) → 1,8 sn'de kaldırılır (köşeden tutulup kalkar, `inOutCubic`, 3° dönme) ve tablo büyür → yıldız mühürleri basılır.

---

## 10. His ve ses

### 10.1 Genel parametreler
- **Easing:** `outCubic`, `outBack(s = 1,70158)`, `inQuad`, `inOutCubic`, `yay(k = 380, c = 20, m = 1)` (yarı-örtük Euler, dt ≤ 1/120 s).
- **Tik → ms:** normal 1×; çözümleme sırasında dokunmak 2×; "Hızlı" 1,5×; birleşimde 0,15 sn %40 hız.
- **Ekran sarsıntısı:** yalnız Mürekkep (3 px), Girdap (4 px), birleşim (6 px): 150 ms, sönümlü sinüs 30 Hz. "Hareketi azalt" (ya da `prefers-reduced-motion`) → 0.
- **Titreşim** (`navigator.vibrate`, ayardan kapatılır): karışım 8 ms, eşleşme 12 ms, özel 20 ms, birleşim [20, 30, 40].
- **Parçacık havuzu:** en fazla 400; kare başına bellek ayırma yok. Düşük kalitede ×0,5.
- **Tam ekran flaş:** saniyede en fazla 2; alfa ≤ 0,25.

### 10.2 Olay tablosu
| Olay | Canlandırma (ms, easing) | Parçacık | Ses (§10.3) | Sarsıntı |
|---|---|---|---|---|
| Damla tutuldu | 1→1,08 ölçek, 90 `outBack`; geçerli komşular 1→1,06 nabız 1,5 Hz | — | yumuşak "tık": sinüs 1,6 kHz, 12 ms, 0,05 | — |
| Sürükleme | kaynak parmağa doğru 1,3 kata kadar uzar (iki daire + kavisli boyun, metaball) | — | — | — |
| Geçerli hedefe girdi (önizleme) | hedef halkaları 120 ms'de sonuç rengine döner; gruplar altın nabız 2 Hz | 3 damlacık | sonuç renginin notası, sinüs, 40 ms, 0,06 | — |
| Geçersiz bırakma | kaynak 3 kez titrer (±3 px, 180 ms) | — | boğuk tık: üçgen 180 Hz, 50 ms, alçak geçiren 600 Hz | — |
| **Karışım** (`karisti`) | 220 ms: iki renk dönen konik gradyanla dolanır; sonuç `outBack` ile 1,15×'e zıplar; kaynak hücrede su halkası | 8 damlacık (iki rengin karışımı) | bant geçiren gürültü süpürmesi 400→1600 Hz, 180 ms + iki sinüs a ve b notasından sonuç notasına kayar | — |
| Mürekkep oluştu | damla 300 ms'de koyulaşır, 1,2 Hz nabız | 6 is zerresi | alçak "lop": sinüs 110→80 Hz, 160 ms | — |
| **Eşleşme** (`eslesti`) | 120 ms grup damlaları merkeze akar (`inQuad`) | — | — | — |
| **Temizlendi** | 250 ms halka halka suya yayılır (ebru damlası açılımı: 3 halka r 0→0,9 hücre, alfa 0,8→0) | 6–10 damlacık/damla: hız 80–180 px/s, ömür 400–650 ms, sürtünme 3 | ud koparma (Karplus–Strong), rengin notası, 15 ms içinde gelenler birleşir | — |
| Toplanan damla → hedef | Bezier 400 ms `inOutCubic`; kart sayacı 1→1,2→1 | iz 4 | kart "tık" (birleşik) | — |
| Kaskat yazısı (k ≥ 2) | ölçek 0→1,25→1 (`yay`), 700 ms kalır, 250 ms'de solar; mürekkep sıçraması | 16 damlacık | hicaz merdiveninde k. basamak, ud + oktav üstü yumuşak çan | — |
| Özel oluştu | taş 160 ms'de belirir (`outBack`), altın parıltı turu | 10 altın | FM çan: nota, oran 3,5, indeks 2→0, 500 ms | — |
| **Tarak** | dişler 25 tik/hücre süpürür; suda sinüs ofsetli dalgalı iz (600 ms solar) | hücre başına 4 | süpürme: gürültü bant geçiren 2→5 kHz, 300 ms + "şıngır" (6 tel, 25 ms arayla) | — |
| **Girdap** | baklava 400 ms'de merkeze çöker (kutup koordinatında dönerek); suda sarmal iz | 24 sarmal | alçak geçiren 3000→300 Hz süpürmeli gürültü 400 ms + sinüs 70 Hz güm | 4 px |
| **Lale** | taç yaprakları açılır (200 ms); her hedef damlaya 30 tik arayla bir yaprak fırlar; toplu patlama | hedef başına 6 | pırıltı: D akor tonları, 6 sinüs ±7 sent, 30 ms aralı, 900 ms | — |
| **Mürekkep** | siyah sıçrama 3×3, 200 ms | 20 is zerresi | "güm": sinüs 55 Hz, 220 ms + kahverengi gürültü 300 ms | 3 px |
| **Birleşim** | 150 ms %40 hız, ardından patlama; tam ekran beyaz alfa 0,2 | 40 | bum: sinüs 45 Hz 400 ms + gürültü 600 ms (alçak geçiren 800 Hz) + çan | 6 px |
| Mermer hasarı | çatlak çizgisi; can 0'da parçalara ayrılır (500 ms) | 6 beyaz kırıntı | "tok": gürültü alçak geçiren 900 Hz 60 ms + sinüs 160 Hz 50 ms | — |
| Kâğıt alındı | boyalı kâğıt köşeden kalkar, HUD'a uçar (500 ms); kat 2'de alttaki kalır | 4 krem lif | kâğıt hışırtısı: gürültü yüksek geçiren 3 kHz, 120 ms | — |
| Yağ kalktı | yanardöner film 300 ms'de dağılır | 6 yanardöner | ıslak "fıs": gürültü bant 1,2 kHz, 100 ms | — |
| Desen boyandı | motif parçası rengiyle dolar (300 ms, dairesel maske) | 6 renkli | marimba: üçgen, nota, A1 D250 | — |
| Düşme | süre 90·√d ms `inQuad`, iniş ezilmesi 1→0,92→1 (80 ms) | — | sütun başına çok hafif "plop" (birleşik) | — |
| Doğum | tahta üstünden düşer (aynı eğri), 60 ms alfa girişi | — | — | — |
| Karıştırma | damlalar kalkar, Bezier yollarla yer değiştirir 500 `inOutCubic`; "Tekne çalkalanıyor…" | — | dönen su gürültüsü | — |
| Hedef tamam | kart altın mühürle damgalanır (`outBack` 250) | 10 altın | çan akoru (D–F♯–A) | — |
| Son 3 hamle | hamle mührü kırmızımsı nabız 1,5 Hz | — | — | — |
| Son hamle kazandırdı | 0,3 sn kare donması ("kıl payı") | — | — | — |
| **Ebru Şöleni** | "Ebru Şöleni!" yazısı; taraklar 160 ms arayla ateşlenir | tarak gibi | hızlanan ud arpeji | — |
| **Kazandın** | kâğıt çekme (§9.5); yıldızlar 300 ms arayla mühür gibi basılır | altın varak tozu | ney motifi (§10.3) + her yıldızda "dum" (sinüs 90 Hz) + çan | — |
| Kaybettin | tahta 400 ms'de kararır; yarım tablo soluk | — | iki yumuşak sinüs A4→F♯4, her biri 300 ms | — |
| Boşta (5 sn) | ipucu: hazır bir hamlenin iki damlası nabız atar + hayalet ok; damlalar ±%2 nefes alır (0,3 Hz) | — | — | — |

### 10.3 Ses dili (WebAudio, tamamen sentez; ses dosyası yok)
- **Renk notaları (Re üzerinde, konsonans):** Kırmızı D4 (293,66 Hz), Sarı F♯4 (369,99), Mavi A4 (440,00), Turuncu G4 (392,00), Mor B♭4 (466,16), Yeşil C5 (523,25), Mürekkep D3 (146,83). (`katalog.ts` `derece`: hicaz dizisinde 0 D, 1 E♭, 2 F♯, 3 G, 4 A, 5 B♭, 6 C, 7 D5; Mürekkep −7.)
- **Kaskat merdiveni (hicaz):** D4 E♭4 F♯4 G4 A4 B♭4 C5 D5; k. kaskat → basamak min(k−1, 7); 8+ D5'te kalır, üstüne oktav parıltısı (0,15). Hicazın artık ikilisi (E♭–F♯) yalnız burada duyulur (K18).
- **Ud koparma:** Karplus–Strong, açılışta (ilk dokunuştan sonra, boşta dilimlerle) 8 nota × 2 oktav, 1,2 sn AudioBuffer olarak önceden hesaplanır; süzgeç 0,996, gövde rezonansı (tepe süzgeç 220 Hz Q2 +4 dB). Hazır olmadan çalınırsa üçgen + üstel sönüm yedeği.
- **Ney nefesi (kazanınca):** A4→D5 (portamento 120 ms) sinüs + %30 üçgen; nefes: gürültü bant geçiren 1,2 kHz Q0,8 (kazanç 0,25×); vibrato 5 Hz ±15 sent (300 ms'den sonra); atak 180 ms, toplam 1,6 sn; yankı ıslak 0,3.
- **Yollar (FİTİL `sesMotoru` yapısı):** sfx 0,8 · müzik 0,3 · ortam 0,25 → ana → alçak geçiren (18 kHz) → DynamicsCompressor (−18 dB, diz 12, oran 4, 3 ms, 150 ms) → çıkış → yumuşak kırpıcı. Yankı: Convolver, 1,6 sn dürtü `exp(−t/0,4)`, ıslak 0,18.
- **Ses havuzu:** en fazla 24; doluysa en eski çalınır; 15 ms içindeki aynı tür sesler birleşir (+%20, en fazla 1,6×).
- **iOS kilidi:** `ac()` ilk dokunuşta AudioContext kurar, `resume()` ve tek örnekli sessiz tampon çalar; iOS 17+ `navigator.audioSession.type = 'ambient'`. Sekme gizlenince `suspend()`. Bağlam çalışmıyorsa ses planlanmaz.

### 10.4 Ortam ve müzik
- **Su:** kahverengi gürültü, alçak geçiren 400 Hz, kazanç 0,03, LFO 0,1 Hz ±%30; 2–6 sn aralı tek damla "plip"i (sinüs 1,6–2,4 kHz → ×0,6, 40 ms, 0,04).
- **Üsküdar (liman):** su + çok uzak, alçak dalga şırıltısı (pembe gürültü bant 300 Hz, LFO 0,07 Hz).
- **Bursa (han):** su + şadırvan şırıltısı (beyaz gürültü bant geçiren 2,5 kHz Q3, hızlı rastgele kazanç 8–14 Hz, 0,015).
- **Müzik (isteğe bağlı, varsayılan açık, düşük):** her 6–10 sn'de bir, D dronu (sinüs D2 + D3, 0,02) üstünde ud koparmalarıyla 3–5 notalık pentatonik cümle (D F G A C); büyük olaylarda 0,01'e kısılır, 600 ms'de döner.

---

## 11. Görsel kimlik

### 11.1 Palet
| Kullanım | Renk |
|---|---|
| Su üst / alt / parıltı (Üsküdar) | #0B2B2E / #0A1E33 / #1F4D4F |
| Su (Bursa) | #14262E / #1B1530 / #3A3350 |
| Kâğıt (ahar) / gölge / kenar | #F3E9D2 / #E4D5B4 / #CDB892 |
| Mürekkep yazı / ikincil | #1E1A16 / #5A4E3F |
| Altın varak / açık / koyu | #C9A227 / #E8CD6A / #8A6D12 |
| Ceviz koyu / orta / damar | #3B2416 / #5A3A22 / #7A5233 |
| Uyarı / başarı | #B8322A / #2F7D4F |
| Mermer / damar | #D9D4CB / #9C958A |

**Damla renkleri** (standart; renk körü paleti Okabe–Ito uyarlaması `katalog.ts`'de):

| Renk | Ana | Açık | Koyu |
|---|---|---|---|
| Kırmızı | #D6423A | #F29A8E | #7E1D1A |
| Sarı | #F0C23B | #FBE7A1 | #8A6A10 |
| Mavi | #4A86D4 | #A9C8F0 | #1D3F73 |
| Turuncu | #EE7F2D | #F9C08F | #8A3F0C |
| Mor | #9A5CC6 | #D3B3EA | #4B2468 |
| Yeşil | #3FA86B | #A6DDBC | #175C36 |
| Mürekkep | #1A1714 | #4A4038 | #000000 |

### 11.2 Motifler (renk körlüğü, K17)
Kırmızı **nokta**, Sarı **halka**, Mavi **dalga**. Karışık renk iki ebeveyninin motifini birlikte taşır: Turuncu = halka içinde nokta; Mor = dalga üstünde nokta; Yeşil = dalgayı kesen halka. Mürekkep üçünü altın renkte taşır. Motif tarifi de öğretir ("halka + nokta = Turuncu"). Ham damlada motif koyu (#1E1A16 alfa 0,62), karışıkta krem (alfa 0,92). Ayarlardan kapatılabilir.

### 11.3 Damla çizim tarifi (`src/render/damla.ts` başvuru)
Sprite önbelleğine bir kez çizilir (renk × tür × hücre boyu × DPR × palet); `shadowBlur` YASAK.
- **Ham damla** (r = 0,40 hücre): suya yayılan hale (radyal, ana alfa 0,25 → 0, 0,56 hücre) → gövde (radyal gradyan: merkez (−0,28r, −0,32r), açık → ana %60 → koyu) → **tek** ince halka (0,74r, krem alfa 0,42) → motif → mat yansıma (alfa 0,22).
- **Karışık damla** (r = 0,43 hücre): daha güçlü hale (alfa 0,4, 0,64 hücre) → gövde (ana %45'te) → **üç** halka (0,86r krem 0,7; 0,70r koyu; 0,56r krem 0,45) → iki motif → parlak yansıma (alfa 0,5) → sağ üstte **altın dört uçlu pırıltı** ("bu eşleşir" işareti).
- **Mürekkep:** #1A1714 gövde, altın kenar halkası (0,93r, kalınlık 0,09r), üç motif altın, 1,2 Hz nabız.
- **Tarak:** karışık damla + üstünde yönüne dik 7 dişli altın tarak (diş 0,08r, aralık 0,22r) ve yön oku. **Girdap:** üç kollu altın sarmal, 0,3 Hz döner. **Lale:** krem yanardöner gövde (konik gradyan 0,15 Hz döner, alfa 0,5), altın lale silueti.
- **Engeller:** Mermer: beyaz-gri, tohumlu 3 damar (Bezier), can = yatay katman çizgisi sayısı. Yağ: hücre zemini koyulaşır (#2A2F1E alfa 0,4) + yanardöner film (konik gradyan, alfa 0,25, 0,1 Hz döner). Kâğıt: suyun altında krem kare (hücrenin %86'sı, alfa 0,85), tırtıklı kenar; 2 kat = 3 px kaydırılmış ikinci yaprak. Desen: istenen rengin motif parçası kesik çizgiyle (alfa 0,5); boyanınca dolu ve ebru dokulu.

### 11.4 Tekne, su, çerçeve
- **Su:** bütün tuvali kaplar (atölye tonu, dikey gradyan). Üstünde offscreen'e pişmiş 256×256 tohumlu dalga dokusu yavaş kayar (alfa 0,08). Sudaki canlı iz katmanı (§9.3).
- **Çerçeve (ceviz tekne kenarı):** 14 px ceviz (yatay damar `sin(y·0,15 + gürültü(x)·3)`), içte 2 px altın çizgi; köşelerde kodla çizilen **sekiz köşeli yıldız** (iki iç içe kare, 45°; altın kontur, ceviz dolgu); her kenarın ortasında basit **rumi** kıvrımı (iki Bezier, altın). Hepsi offscreen'e pişer, yalnız yeniden boyutlanmada çizilir.
- **Hücre yuvası:** çizilmez (su süreklidir); yalnız ızgara çok hafif nokta (alfa 0,06) ile ima edilir.

### 11.5 Yazı tipleri
- **Cormorant Garamond 700** (başlıklar, bölüm adları, kaskat ve kutlama yazıları; yalnız ≥ 22 px) + **Alegreya Sans 500 / 800** (arayüz, düğmeler, sayılar, balonlar). Google Fonts / @fontsource, SIL OFL; Latin + Latin Extended (ğ ş ı İ ç ö ü); woff2 base64 gömülü ve **FontFace'e ikili veri** olarak verilir (CSP `font-src data:`'yı reddeder; ağ isteği yok). Toplam ≈ 132 KB.
- Yedek: başlık `"Iowan Old Style", "Palatino Linotype", Georgia, serif`; gövde `"Segoe UI", system-ui, sans-serif`.
- Boyutlar: hamle mührü 30/800; hedef sayısı 18/800; balon 16/500; düğme 18/800; gövde 15/500; ekran başlığı 34–44 Cormorant; kaskat yazısı 48–64 Cormorant. Sayılar `lining-nums tabular-nums`.

### 11.6 Yerleşim
**Dikey telefon** (tasarım 390×844, alt sınır 360×640):
- Üst bant 0–%14 (güvenli alan payı dahil): krem kâğıt şerit; solda en fazla 2 hedef kartı (64×52), ortada hamle mührü (56 px altın kenarlı daire), sağda puan + 3 yıldız işaretli çubuk (110×36).
- **Tarif şeridi** %14–%18: üç küçük çip ("● + ○ = ◉", renkli damlalarla); yalnız bölümde doğan ham renklerin tarifleri. Bölüm 1–5'te sürekli; sonra katlanır (dokununca açılır). Ayar: "Tarif şeridi: Her zaman / İlk bölümlerde".
- Tahta %18–%88: `hucre = floor(min((G − 32)/w, (0,68·Y − 24)/h, 64))`; alt sınır 40 px (altına düşerse tarif şeridi gizlenir). Yatayda ortalı.
- Usta balonu tahtanın üst kenarına yapışık (tek satır, kâğıt şerit, dokununca kapanır).
- Alt bant %88–%100: [Duraklat] solda (48 px); orta boş (güçlendirici yok).
- `touch-action: none`; tuvalde `setPointerCapture`; sayfa kaydırma/yakınlaştırma kapalı.

**Masaüstü / yatay** (en/boy > 0,75): tahta solda %62'lik alanda, `hucre = min(64, (Y − 140)/h)`; sağda 300 px kâğıt panel: hedefler, hamle, puan, tarif şeridi, duraklat. Su tam arka planda.

---

## 12. Öğretim ve ekranlar

### 12.1 Öğretim (Bölüm 1–3)
İlke: kelime değil el. Her balon ≤ 6 kelime, tek satır. Önizleme baştan açık. 1–3'te `garanti 3`; kaybedilmesi neredeyse imkânsız (Acemi ≥ %95). Gösterim: 1 K, 2 S, 4 M, 3 T, 5 Mo, 6 Y; `.` rastgele.

**Bölüm 1 — İlk Damla** (5×6, yalnız K ve S, 12 hamle, hedef 10 Turuncu; `b001.json`)
```
y4  1  2  1  .  .
y5  3  3  2  1  .
```
1. Açılıştan doğrudan buraya (ilk kez). Saydam el (3,5) Kırmızıyı (2,5) Sarıya sürükler, döngüde. Balon: **"Kırmızıyı sarıya sürükle."** Zorunlu ilk hamle: yalnız bu (diğer damlalar %45 kararır).
2. Parmak hedefe gelince önizleme: Sarının halkaları Turuncuya döner, üç Turuncu altın nabız atar.
3. Bırakınca üç Turuncu suya açılır, kâğıda uçar. Balon: **"Aynı renkten 3'ü değince kâğıda geçer!"**
4. 5 sn boşta: hazır bir hamlenin iki damlası nabız + hayalet ok. Balon: "Parlayan damlayı komşusuna sürükle."
5. Kazanınca Ebru Şöleni, ilk kâğıt çekme: **"Bu tablo senin. Galerine eklendi."** → "Sıradaki: Mavi boya!"

**Bölüm 2 — Renk Çarkı** (6×7, K S M, 15 hamle, 6 Mor + 6 Yeşil)
```
y5  .  .  .  .  6  4
y6  5  5  4  1  6  2
```
1. Tarif şeridi açılır (3 çip sırayla parlar). Balon: **"Mavi geldi: üç tarif, üç renk."** Zorunlu ilk hamle: (3,6) Kırmızı → (2,6) Mavi = Mor üçlüsü.
2. Oyuncu aynı renge bırakırsa (geçerli hedef olmadığı için şişmemişti): damla titrer, ilk seferde balon **"Aynı renk karışmaz."**
3. İkinci hamle önerisi (zorunlu değil, el): (5,5) Mavi → (5,6) Sarı (aşağı) → Yeşil üçlüsü. Balon: **"Yeşil = Sarı + Mavi."**

**Bölüm 3 — Tarak** (6×8, K S M, 16 hamle, 12 Mor)
```
y6  .  .  1  .  .  .
y7  5  5  4  5  .  .
```
1. Balon: **"Dört damla: TARAK doğar."** El: (2,6) Kırmızı → (2,7) Mavi (aşağı). Önizlemede 4 Mor + yatay tarak hayaleti; sütun 2'de soluk aşağı oklar.
2. Hamleden sonra balon: **"Boşalan yere üstteki kayar."** (oklar 1 sn görünür)
3. Tarak doğunca: **"Tarağı bir komşuya sürükle."** (el tarağı sağa sürükler, döngü)

### 12.2 Tanıtım balonları (yeni öğenin ilk bölümü; kurgulu açılış, sonra serbest)
| Bölüm | Öğe | Balon |
|---|---|---|
| 4 | Kâğıt | "Kâğıdın üstünde eşleştir, boya kâğıda geçsin." |
| 5 | Girdap | "Beş damla: GİRDAP. Çevresini yutar." |
| 7 | Lale + birleşim | "Altı damla: LALE. Bir rengin hepsini alır." · Lale doğunca: "İki özel taşı birbirine sürükle!" |
| 8 | Mermer | "Mermer yanındaki eşleşmeyle çatlar." |
| 9 | Desen | "Her desen hücresi kendi rengini ister." |
| 11 | Mürekkep | "Üç renk bir olunca: Mürekkep." · ilk Mürekkepten sonra: "Yanında eşleşme olunca patlar." |
| 13 | Yağ | "Yağlı damla karışmaz. Üstünü temizle." |
| 16 | Kıt renk | "Sarı yağmıyor. Elindekini iyi kullan." |
Bütün balonlar Ayarlar > "Nasıl oynanır"dan yeniden izlenebilir; görülen balonlar kayıtta.

### 12.3 Ekranlar
Arayüz DOM'dadır (krem kâğıt kartlar, ceviz düğmeler, altın kenar); tahta, su ve efektler tuvalde. Metinler `src/ui/metinler.ts`. `alert/confirm/prompt` YOK; onaylar sayfa içi kartla.
1. **Açılış:** "Ebruli" yazısı suya damlayan boyadan açılır (Cormorant, 1,2 sn: damla → halkalar → harfler); altında "Dokun ve başla" (bu dokunuş sesi açar). Açılış beklerken ilk bölüm `cizici.onIsit` ile önden pişer. İlk kez: doğrudan Bölüm 1. Sonra: atölye haritası.
2. **Atölye haritası (ana ekran):** dikey kaydırılan kâğıt rulo; iki sayfa: **Üsküdar** (lale; su tonu deniz yeşili) ve **Bursa** (karanfil; mor-lacivert). Bölümler bir mermer yol boyunca suya damlamış boya noktalarıdır (açık: renkli + yıldızlar; sıradaki: nabız; kilitli: silik). Sayfa başında atölye adı (Cormorant 36) + çiçek motifi + o atölyenin tablo şeridi. En altta kilitli **"Devamı yakında"** sayfası (Kapadokya · Ege · Saray silüetleri). Üstte toplam ★; altta [Galeri] [Ayarlar]. Son açık bölüme otomatik kayar. Yıldız kapısı yoktur.
3. **Bölüm öncesi kartı:** ad, atölye, hedef ikonları ve sayıları, hamle, yeni öğe önizlemesi (küçük canlandırma), en iyi puan, yıldızlar, tablo küçük resmi. [Başla] [Geri].
4. **HUD:** §11.6.
5. **Duraklat:** [Devam] [Yeniden başla] [Ayarlar] [Haritaya dön].
6. **Kazandın:** şölen → kâğıt çekme (§9.5) → yıldız mühürleri → puan sayarak artar → nadirlik etiketi ("Zarif") → [Bunu sakla] / [Eskisini koru] (ilk tabloda yok) → "Sıradaki: X!" → [Devam] (büyük) [Tekrar oyna].
7. **Kaybettin (yakın kaçış):** "%92 — 2 Mor eksikti" çubuğu; yarım kalan tablo soluk gösterilir (Zeigarnik); bulunursa "Bu hamle kazandırırdı" hayaleti (son hamle öncesi tahtada Usta botunun 2 hamle derinlikli araması, ≤ 300 ms bütçe) 2 kez oynatılır. **[Tekrar dene]** büyük düğme, < 1 sn'de yeni deneme. [Haritaya dön]. 3. ardışık kayıptan sonra Usta'nın Eli (§8.4).
8. **Galeri:** §9.4. Üstte "Ebru Defteri", atölye sekmeleri.
9. **Ayarlar:** efekt sesi (kaydırıcı), müzik (kaydırıcı), ortam (aç/kapat), titreşim, hareketi azalt (`prefers-reduced-motion` ile otomatik), hız (Normal/Hızlı), palet (Standart/Renk körü), motifler (aç/kapat), tarif şeridi (Her zaman/İlk bölümlerde), ipuçları (aç/kapat), [Nasıl oynanır], ilerlemeyi sıfırla (iki aşamalı sayfa içi onay), Hakkında (yazı tipi lisansları, "Usta kurgusaldır").
10. **Nasıl oynanır:** 5 canlandırmalı kart: Karıştır (ham + ham) · Eşleştir (3 karışık) · Yön (kaynak boşalır, sütun kayar) · Özel taşlar (4/5/6, Mürekkep) · Engeller (açılmış olanlar). Altta: "Tekne cömerttir: her zaman hazır bir karışım vardır."
11. **Deneme sonu — "Devamı yakında":** Bölüm 20 kazanılınca bir kez otomatik (sonra haritadan): 20 tablonun mozaiği (galeriden), toplam ★, "Kapadokya, Ege ve Saray atölyeleri hazırlanıyor." [Galeriyi aç] [Haritaya dön]. Kilitli üç atölye silüeti hafif su dalgasıyla.

### 12.4 Boşta ipucu
5 sn hareketsizlikte (ayardan kapatılabilir): `olumluHamleler(d)`'in ilk adayı (temizlenene göre) — kaynak ve hedef damla 1,5 Hz nabız + aralarında hayalet ok; 2,5 sn sonra söner, 5 sn'de bir yinelenir. Öğretimde 3 sn.

---

## 13. Teknik notlar

### 13.1 Mimari ve modüller
```
src/core/     saf TS, DOM yok, testli — types.ts (sözleşme), index.ts (API), rng.ts,
              sabitler.ts, tahta.ts (karışım tablosu, grup, geçerli hamle), bolumYukle.ts,
              P1: hamle.ts, cozum.ts, yercekimi.ts, ozel.ts, engel.ts, hedef.ts, garanti.ts,
              karistir.ts, onizle.ts, solen.ts, oynatici.ts (olaylardan görsel tahta)
src/bot/      acemi.ts, usta.ts, simulasyon.ts, olcut.ts, sim-cli.ts (Node, worker_threads ≤ 2)
src/levels/   veri/bNNN.json (20), index.ts (elle içe aktarım), dogrulayici.ts
src/render/   stage.ts, damla.ts (başvuru tarif), sprite önbelleği, su.ts, cerceve.ts,
              oynatici (olay → zaman çizelgesi), parcacik.ts (havuz 400), onizleme katmanı
src/tablo/    ebru.ts (§9.3 algoritma), teknikler.ts, tablo.ts (TabloCizici), sikistir.ts
src/audio/    synth.ts, havuz.ts, gurultu.ts (taban), ud.ts (Karplus–Strong), sesMotoru.ts
src/input/    surukle.ts (SurukleGirdi: pointer + dokun-dokun + klavye)
src/ui/       ekranlar/, hud.ts, harita.ts, metinler.ts, yazitipi.ts, stil/
src/meta/     kayit.ts (şema + göç), ilerleme.ts, galeri.ts (saf, testli)
src/platform/ storage.ts (SaveStore), hot.ts, haptics.ts, rng.ts (görsel)
src/app/      sozlesme.ts, katalog.ts, uygulama.ts (ekran akışı), oturum.ts (bölüm içi döngü)
```
**Kural:** çizici, ses, arayüz ve tablo yalnız `Olay[]` ve `TemizlikKaydi[]` tüketir; çekirdeğe yazmaz.

### 13.2 Sözleşme ve görsel tahta (FİTİL dersi 1)
- Tipler: `src/core/types.ts`; API: `src/core/index.ts`; ön yüz: `src/app/sozlesme.ts`. Var olan alanın anlamı değişmez; alan eklemek serbest.
- Çizici kendi **görsel tahtasını** yalnız olaylarla günceller (`olayUygula`); oynatma sonunda `sonraki` ile eşitler; geliştirme kipinde `gorselFark(g, sonraki)` boş değilse `console.error`.
- **P1 zorunlu testi (altın değerinde):** `oynatici.test.ts` — 300 rastgele oyun (`FUZZ_N` ile ölçeklenir): görsel tahta yalnız bölüm başından kurulur, oyun boyunca hiç eşitlenmeden olaylarla ilerler; her eylemden sonra `gorselFark` boş; katı kipte her olayın önkoşulu denetlenir (temizlenen hücrede o id/renk/özel; düşen damla hareketli ve hedef yuva boş; vb.); bütün olay türleri en az bir kez oynatılır.
- Olaylardan çıkmayanlar: `kalanHamle` (uygulama bilir: hamle −1, Usta'nın Eli +5, şölen sonunda 0), istatistik, RNG, günlük. HUD bunları `sonraki`den okur.

### 13.3 Belirlenimlilik
- RNG: mulberry32 (`rngSonraki`, `rngInt(n) = ⌊r·n/2³²⌋`, `agirlikliSec` tamsayı kümülatif). Durum `OyunDurumu.rng`.
- Çekirdekte `Date`, `performance`, `Math.random`, ondalık sabit yok; zaman birimi tik. Tablo ve görsel rastgelelik ayrı (`platform/rng.ts` sfc32 ya da tablo tohumu).
- `durumKarmasi` (FNV-1a) altın tekrarlar için.

### 13.4 Testler (vitest)
- **Birim:** karışım tablosu (her çift, iki yön, `murekkep` açık/kapalı); grup bulma; yerçekimi (mermer altı çapraz kayma, delik); özel taş yeri, önceliği, yönü; her özel etkinin hücre kümesi; 10 birleşim; Mürekkep tetikleri; engel hasarı (grup başına bir, alan başına bir); kâğıt/yağ/desen; hedefler; puan tablosu; garanti (grup doğurmaz, sayıyı artırır, belirlenimli); karıştırma sonlanır ve ölü değil; şölen; Usta'nın Eli; önizleme = hamlenin ilk dolumdan önceki kısmı (temizlenen hücreler ve `ozelHayalet` birebir).
- **Altın tekrarlar:** (bölüm, deneme, hamle dizisi) → `durumKarmasi` ve olay listesi anlık görüntüsü; bölüm başına ≥ 1.
- **Özellik / bulanık** (varsayılan 300, `FUZZ_N`): hücre bir adımda iki kez temizlenmez; çözümleme sonlanır (≤ 50 kaskat); hamle sonunda delik/mermer dışı her hücre dolu ve grupsuz; damla sayısı korunur (önce + doğan − temizlenen = sonra); aynı girdi aynı karma; `hamleUygula` girdiyi değiştirmez (`Object.freeze`); hamle sayacı yalnız geçerli hamlede düşer; görsel tahta eşitliği (§13.2).
- **Tablo:** aynı istek → aynı piksel karması (node-canvas yoksa çokgen köşe karması); köşe sınırları.

### 13.5 Performans (60 fps)
- Katmanlar: (1) su + çerçeve offscreen (yeniden boyutlanma ve atölye değişiminde), su dokusu kaydırma; (2) zemin katmanı (kâğıt/yağ/desen) offscreen, olayda yeniden; (3) dinamik: damlalar (sprite), önizleme, parçacıklar (`lighter`), yazılar; (4) DOM HUD.
- `shadowBlur` yasak; parıltı sprite'tan. DPR ≤ 2. Kare başına bellek ayırma yok (havuzlar).
- **Önbellek anahtarı:** hücre boyu × DPR × palet × motif; yeniden boyutlanmada anahtar değişince yeniden pişer (FİTİL dersi 3).
- **İlk dokunuşta donma yok:** açılış ekranı beklerken `onIsit(bolum1)` sprite'ları ve su dokusunu pişirir; ud tamponları ilk dokunuştan sonra `requestIdleCallback`/zaman dilimiyle.
- Otomatik kalite: 30 kare ortalaması > 20 ms → parçacık ×0,5, su dokusu durağan; 120 kare < 12 ms → geri.
- `hamleUygula` (7×9) ortanca < 2 ms (garanti dahil), `onizle` < 1 ms.

### 13.6 Hedef ortam ve test kancası (FİTİL dersi 2–3)
- Oyuncu telefondan, WhatsApp'tan gelen **claude.ai bağlantısıyla** açar. Android'de `ebruli.html` dosyası Chrome'da da açılır; iPhone'da dosya ÇALIŞMAZ (yalnız bağlantı). `index.html`'deki betiksiz yedek ekran (`#jsyok`, 5 sn) bunu anlatır.
- Sayfa çerçevesinde `alert/confirm/prompt`, indirme, `window.open` yok; harici ağ isteği yok (her şey prosedürel ve gömülü).
- `touch-action: none`; güvenli alan payları (`env(safe-area-inset-*)`); ses ilk dokunuştan sonra; `localStorage` her erişimde try/catch; çift dokunma yakınlaştırması ve metin seçimi kapalı.
- **Test kancası `window.__ebruli`** (P0: `ekran()`, `boyut()`, `yaziHazir()`; uygulama paketi ekler): `durum()`, `bolum()`, `bolumAc(id)`, `botHamle('usta'|'acemi')`, `hizli(on)`, `kayit()`, `kayitYama({...})`, `ac('harita'|'galeri'|'ayarlar'|'nasil'|'devami')`, `geometri()`, `ogretim()`.
- `scripts/oynanis.mjs`: açılış → Bölüm 1 (zorunlu ilk hamle GERÇEK dokunmatik sürüklemeyle) → bot ile 1–3, 5, 10 → kazandın (kâğıt çekme, tablo) / kaybettin (Tekrar dene < 1 sn) → harita → galeri → ayarlar → nasıl oynanır → deneme sonu; profiller telefon 390×844, küçük 360×640, masaüstü 1280×800; `pageerror`/`console.error` başarısızlıktır.

### 13.7 Kayıt
- `SaveStore` (bulut `db` + `user` → tarayıcı → bellek); anahtar `ebruli.kayit.v1`; sürümlü şema + göç fonksiyonu (testli).
```json
{ "surum": 1,
  "bolumler": { "1": { "yildiz": 3, "enIyi": 2150, "deneme": 2, "basarisizSeri": 0,
                       "tablo": { "tohum": 0, "gunluk": "base64…", "nadirlik": 1, "teknikler": ["battal"] } } },
  "ogretim": { "gorulenBalonlar": [] }, "devamiGoruldu": false,
  "ayarlar": { "sfx": 0.8, "muzik": 0.3, "ortam": true, "titresim": true, "hareketiAzalt": false,
               "hiz": 1, "palet": "standart", "motifler": true, "tarifSeridi": "ilk", "ipuclari": true },
  "istatistik": { "oynanan": 0, "kazanilan": 0, "enUzunKaskat": 0, "lale": 0 } }
```
- Bölüm sonunda ve ayar değişince 500 ms gecikmeli yazılır. Depolama yoksa bellek içi kayıt + tek seferlik bilgi balonu.
- `progressScore` = toplam yıldız × 1000 + açılan bölüm.

### 13.8 Derleme
- `npm run build:single` → `ebruli.html` (bağımsız, çift tıkla) + `dist-single/artifact.html` (claude.ai sayfası gövdesi: doctype/head/body yok, `<title>` ilk 8 KB'ta). Hedef boyut < 1,2 MB (yazı tipleri ≈ 180 KB base64).
- `npm run typecheck`, `npm test`, `npm run dogrula`, `npm run build:single`; görsel iddia için `scripts/shot.mjs` ile 360×640, 390×844, 1280×800 ekran görüntüsü.

---

## 14. Bot ve ölçütler

### 14.1 Aday üretimi
Bütün geçerli hamleler (7×9'da ≈ 70–110; özel taşa dokunanlar dahil), her biri `onizle` ile (doğumsuz) değerlendirilir. **Dürüst değerlendirme:** botun ileri bakışı durumun kopyasında `rng = mulberry32(durumKarmasi ^ botTohumu)` ile; gerçek dolum akışını görmez. Seçilen hamle gerçek durumda oynanır.

### 14.2 Acemi (gündelik oyuncu vekili; amaca kör)
Önizlemeyi gören, hedefe bakmayan oyuncu (simülasyondaki "acemi" ile aynı; §0.1 değerleri buradan):
1. Tahtada özel taş varsa %50 olasılıkla rastgele bir özel taşa dokunan hamle.
2. Değilse, `olumluHamleler` boş değilse %70 olasılıkla onlardan biri (tekdüze).
3. Değilse rastgele geçerli hamle.
Usta'nın Eli'ni kullanmaz.

### 14.3 Usta (1 hamle ileri bakan sezgisel)
`V = 1000·Δ(hedef ilerleme oranı) + 0,05·Δpuan + 25·(üretilen özel: tarak 1, girdap 2, lale 4) + 4·min(6, sonraki hazır çift sayısı) + 6·[Mürekkep üretti ve Mürekkep hedefe yarar] − 300·[kazanç yokken kalanHamle = 0]`; en yüksek V, eşitlikte bot RNG'si. Ağırlıklar `src/bot/agirliklar.json`. (Simülasyonda bu yapıdaki Usta seçilen kuralda hamlelerin %98'inde eşleşti; özel 0,24/hamle.)

### 14.4 Bantlar ve yıldız kalibrasyonu (FİTİL dersi 4)
| Tür | Acemi kazanma (alt sınır) | Usta kazanma bandı |
|---|---|---|
| öğretim (1–3) | ≥ %95 | [98, 100] |
| tanıtım | ≥ %40 | [92, 100] |
| normal | ≥ %25 | [85, 100] |
| zor ★ | ≥ %10 | [60, 85] |
| rahatlama | ≥ %60 | [95, 100] |
- Ölçüm: Usta 100 tohum (onay), Acemi 120 tohum (60 tohumda ±%5 oynar); zor bölümde Acemi p50 için 200+ tohum. Bot koşularında en fazla **2 işçi** (makinede 4 çekirdek).
- **Yıldızlar (K13):** 2★ = min(Usta p50, Acemi kazanç p50), 3★ = Usta p85; kazançların puanı, aşağı 100'e yuvarlanır (`npm run kalibre`, 500 + 500 tohum). Öğretimde elle: 2★ ≈ Acemi kazanç p40, 3★ ≈ Usta p50 (`elleEsik: true`).
- **Ek ölçütler (doğrulayıcı):** Usta öncesi durumlarda ≥ 2 hazır oranı ≥ %90, 0 hazır ≤ %3; Acemi eşleşen hamle ≥ %60; Tarak ≤ 0,35/hamle; kaskat medyanı ≤ 1; tahmini süre (hamle × 3,5 sn) 60–180 sn; **yakın kaçış:** kayıpların ≥ %30'unda `ilerlemeYuzdesi ≥ 0,8` (yalnız tasarımla, dolum hilesi yok).

### 14.5 Doğrulayıcı (CI)
- **Statik:** boyut ve aralıklar; simge geçerliliği; zemin katmanları delikte değil; yağ/desen mermerin altında değil; desen renkleri karışık ve bölümde doğabilir (ebeveynlerinin ağırlığı > 0); hedefin nesnesi tahtada var; başlangıç tahtası grupsuz ve geçerli hamleli; `garanti` 0–3; `murekkep` yalnız id ≥ 11 (tanıtım hariç); `zorunluIlkHamle` geçerli ve hazır.
- **Bot:** §14.4 bantları; 100 tohumda en az 1 Usta kazancı.
- CLI: `npm run bot -- --bolum 5 --tohum 200 --bot usta`, `npm run dogrula [-- --bolum 4-10 --tohum 30]`, `npm run kalibre -- --bolum 6`.

---

## 15. Bölümler

### 15.1 Veri şeması ve ilk tahta
Bölüm verisi `BolumVerisi` (`src/core/types.ts`); JSON anahtarları ASCII. Düzen simgeleri: `.` rastgele damla · `#` delik · `1 2 4 3 5 6 7` sabit düz damla · `X1 X2 X3` mermer. Zemin: `zemin.kagit [[x,y,kat]]`, `zemin.yag [[x,y]]`, `zemin.desen {motif, hucreler [[x,y,renk]]}`. Özel taşlar `ozeller [{x,y,ozel,renk?,yon?}]` (hücre düzende damla taşımalı).
**İlk tahta (`bolumuYukle`):** yalnız `tohum` akışından; rastgele hücreler okuma sırasında; grup varsa grubun ilk rastgele hücresi yeniden çekilir (≤ 400 tur); yalnız sabitlerden grup tasarım hatasıdır; geçerli hamle yoksa rastgeleler yeniden (≤ 50); P1: garanti (§4.7). Kimlikler okuma sırasıyla 1'den. Oyun akışı `oyunTohumu(tohum, denemeNo)`.

### 15.2 20 bölümlük plan (başlangıç değerleri)
Doğum: **D2** = [32, 32, 0, 18, 0, 0] (yalnız K, S, T) · **D3** = [20, 20, 20, 11, 11, 11] · **D-S** = [30, 0, 30, 8, 16, 8] (Sarı yağmıyor). G = garanti, M = Mürekkep karışımı.

**Üsküdar — Lale atölyesi** (su: deniz yeşili; ortam: liman)
| # | Ad | Tür | Boyut | Hamle | Doğum | G | M | Hedef | Yeni / düzen |
|---|---|---|---|---|---|---|---|---|---|
| 1 | İlk Damla | öğretim | 5×6 | 12 | D2 | 3 | – | 10 Turuncu | karışım (§12.1) |
| 2 | Renk Çarkı | öğretim | 6×7 | 15 | D3 | 3 | – | 6 Mor + 6 Yeşil | Mavi, tarif şeridi |
| 3 | Tarak | öğretim | 6×8 | 16 | D3 | 3 | – | 12 Mor | Tarak, yön |
| 4 | Kâğıda Al | tanıtım | 7×8 | 18 | D3 | 2 | – | kâğıt (12 hücre × 1 kat, orta 4×3) | Kâğıt |
| 5 | Girdap | tanıtım | 7×9 | 18 | D3 | 2 | – | 14 Yeşil | Girdap (kurgulu: `6 6 . 6 6` + altta Sarı/Mavi) |
| 6 | İki Kat ★ | zor | 7×9 | 22 | D3 | 1 | – | kâğıt (16 hücre × 2 kat, alt yarı) | testere dişi |
| 7 | Lale | rahatlama | 7×9 | 18 | D3 | 2 | – | 20 Turuncu + puan 3000 | Lale (kurgulu 6'lı) + yanında Tarak → ilk birleşim |
| 8 | Mermer | tanıtım | 7×9 | 20 | D3 | 2 | – | kâğıt (10 hücre, alt 2 sıra) | Mermer X1 × 7 (y = 5 sırası) |
| 9 | Lale Deseni | tanıtım | 7×9 | 20 | D3 | 2 | – | desen lale (9 hücre: Mor taç 5, Yeşil sap 4) | Desen |
| 10 | Üsküdar Lalesi ★ | zor | 7×9 | 25 | D3 | 1 | – | desen lale (13 hücre) + kâğıt (8 × 1) | Mermer X2 × 2; atölye finali |

**Bursa — İpek hanında karanfil** (su: mor-lacivert; ortam: han)
| # | Ad | Tür | Boyut | Hamle | Doğum | G | M | Hedef | Yeni / düzen |
|---|---|---|---|---|---|---|---|---|---|
| 11 | Kara Mürekkep | tanıtım | 7×9 | 20 | D3 | 2 | ✓ | kâğıt (12 × 1) | Mürekkep (kurgulu: Turuncu yanında Mavi; hazır `7`) |
| 12 | İpek Yolu | normal | 7×9 | 22 | D3 | 2 | ✓ | 15 Turuncu + kâğıt (10 × 1) | |
| 13 | Yağ Lekesi | tanıtım | 7×9 | 20 | D3 | 2 | ✓ | 15 Yeşil | Yağ (8 hücre, orta) |
| 14 | Sabun Hanı | normal | 7×9 | 22 | D3 | 2 | ✓ | kâğıt (10 × 1, yağın altında 6'sı) | |
| 15 | Koza ★ | zor | 7×9 | 24 | D3 | 1 | ✓ | kâğıt (12 × 2) | Mermer X2 × 4 + yağ 6 |
| 16 | Sarı Yağmıyor | rahatlama | 7×9 | 20 | D-S | 2 | ✓ | 18 Mor | kıt renk |
| 17 | Karanfil | normal | 7×9 | 22 | D3 | 2 | ✓ | desen karanfil (12: Turuncu taç 7, Yeşil sap 5) | Mermer X1 × 3 |
| 18 | Usta İşi | normal | 7×9 | 22 | D3 | 2 | ✓ | 12 Mor + 12 Yeşil | Mermer X1 × 4, kurgulu Tarak + Girdap |
| 19 | Şal | normal | 7×9 | 24 | D3 | 2 | ✓ | kâğıt (20 × 1) | geniş kâğıt alanı (Tarak dostu) |
| 20 | Bursa Karanfili ★ | zor | 7×9 | 26 | D3 | 1 | ✓ | desen karanfil (14) + kâğıt (8 × 1) | Mermer X2 × 3 + yağ 4; deneme finali → "Devamı yakında" |

- Testere dişi: 1–3 kolay → 4–5 tanıtım → **6 zor** → 7 rahatlama → 8–9 tanıtım → **10 zor** → 11 tanıtım → 12 normal → 13 tanıtım → 14 normal → **15 zor** → 16 rahatlama → 17–19 normal → **20 zor**.
- Ölçek notu (simülasyon, 7×9, garanti 2): Acemi hamle başına renk başına ≈ 0,9 karışık damla toplar (Usta ≈ 1,2–1,3); 2 renkli (D2) tahtada Turuncu ≈ 2,4 (Usta ≈ 3,2). Hedef adetleri buna göre ilk değerdir; P2 botla ayarlar.
- Her yeni öğenin ilk bölümü kurgulu bir açılışla gösterir (`duzen` + `ozeller`), sonra serbest bırakır. Zor bölüm yeni öğe tanıtmaz.

---

## 16. İş paketleri (ajan ekibi)

**P0 (bitti):** sözleşme (`types.ts`, `index.ts`, `sozlesme.ts`, `katalog.ts`), iskelet ve altyapı, `bolumuYukle` + testi, `b001.json`, bu belge.

**Dalga 1 (paralel):**
- **P1 Çekirdek:** `hamleUygula`, çözümleme, yerçekimi, özel taşlar + birleşimler, Mürekkep, engeller, hedefler, puan, garanti, karıştırma, şölen, Usta'nın Eli, `onizle`, `olumluHamleler`, oynatıcı (`olayUygula`, `gorselFark`) + bulanık testi + altın tekrarlar; ilk tahtaya garanti.
- **P3 Çizici:** sahne (su, çerçeve, zemin), sprite önbelleği (§11.3), olay oynatıcı (§4.9 zaman çizelgesi), sürükleme/önizleme katmanı, el, parçacıklar, kaskat yazıları, kâğıt çekme; P1 gelene kadar sahte olay listeleriyle (`src/render/dev/`).
- **P4 Tablo:** §9 algoritması, teknikler, nadirlik, galeri küçük resimleri, sıkıştırma; sahte günlüklerle.
- **P5 Ses:** §10.3–10.4 (`sesMotoru.ts`, `ud.ts`), olay → ses eşlemesi; testler (çevrimdışı bağlam, kırpıcı).
- **P6a Girdi:** `SurukleGirdi` (12 px eşik, baskın eksen, dokun-dokun, klavye), testli saf mantık.

**Dalga 2:**
- **P2 Bot + bölümler:** Acemi/Usta, `sim-cli`, doğrulayıcı, 20 bölüm verisi, kalibrasyon (yıldız eşikleri).
- **P6b Arayüz:** ekranlar (§12.3), HUD, harita, galeri, ayarlar, nasıl oynanır, deneme sonu; metinler.
- **P7 Uygulama + meta (entegratör):** `uygulama.ts`, `oturum.ts` (öğretim, boşta ipucu, yakın kaçış, Usta'nın Eli), kayıt şeması + göç, test kancası, `oynanis.mjs` tam akış.

**Dalga 3:** cila turu (telefon 360×640 / 390×844 / 1280×800 ekran görüntüleriyle), oynanış testi, `build:single`, yayın.
