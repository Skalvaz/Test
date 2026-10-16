# FİTİL — Kancalar: Bölüm Mühürleri ve Kasaba İşleri (şartname)

**Durum:** Uygulamaya hazır (P0: sözleşme kodu ve mühür verisi yazıldı; K5:
ölçüm aracı ve 105 mühürün kalibrasyonu tamam, §A.5).
**Bağlayıcılık:** GDD'ye ektir; GDD ile çelişen yerde bu belge geçerlidir ve
§ numarasıyla (KANCALAR §A.3 gibi) atıf yapılır.
**Kullanıcı kararları (2026-10-16):**
1. Bölüm görevleri = bölüm başına 3 MÜHÜR (Çırak / Kalfa / Usta).
2. Ödül = KOZMETİK (çatıda sancak, fitil görünümü parçaları) VE KASABAYI
   SÜSLEME (yıldız ve mühürlerden gelen KANDİL ile Fener Koyu'nu donatma).
3. Aile rekabeti şimdilik YOK.
Para, reklam, can duvarı yok; kandil satın alınmaz ve tekrar oynayarak
kasılamaz.

Bu belgede **U** = Usta bot, **A** = Acemi bot, oranlar o botun
**kazandığı** oyunlar içindedir (mühür yalnız kazançta basılır).

---

## 0. Karar günlüğü

| # | Karar | Gerekçe |
|---|---|---|
| KA1 | Mühür tanımları bölüm JSON'unda: `"muhurler": [Çırak, Kalfa, Usta]` (`BolumVerisi.muhurler`, tip `core/types.ts`). | Bölüm verisiyle birlikte taşınır, doğrulayıcı aynı yerde denetler, `kalibre` gibi metin tabanlı yazarlar alanı korur. Ayrı tablo, bölüm değişince eşleşmeyi koparırdı. |
| KA2 | Koşul dili = **ölçü + kapsam + eşik + süzgeç** (§A.3); ölçüler oyunun zaten ürettiği olaylardan eylem başına iz (`HamleIzi`) olarak toplanır. Final gösterisi sayılmaz. | Tek değerlendirici, her koşul botla ölçülebilir; final hamleye dönüştüğünden "3 roket ateşle" bedava olurdu. |
| KA3 | Mühür **yalnız kazanılan oyunda**, yıldızdan bağımsız; üçü ayrı denemelerde toplanır (3 bitlik maske); **Usta'nın Eli** ile kazanılan oyunda mühür yok; **güçlendirici serbest** (yıldız sınırı zaten var). | Kullanıcı kararı + panel önerisi. |
| KA4 | Mühürler 6. bölümün ilk kazancında tanıtılır; o oyunun sonucu geriye dönük değerlendirilir. **Göçte mühür geriye dönük verilmez.** | İlk mühür "bedava" gelir (sahiplenilmiş ilerleme); eski oyunların olayları saklı değil. |
| KA5 | Zorluk bantları bot kazançlarında: Çırak A ≥ %40 (A kazancı < 20 ise U ≥ %85), Kalfa U %30–60, Usta U %8–25; **şansa bağlı** (R, nesil) mühür bölüm başına ≤ 1 (`"sans": true`). | Kullanıcı kararı; Acemi 26+ bölümlerde nadiren kazanır, ölçülebilir yedek gerekir. |
| KA6 | **Kandil bakiyesi saklanmaz, türetilir:** yıldız·1 + mühür·1 + tamamlanan mahalle·3 + günlük kandil − harcanan. | Tekrar oynayarak kasılamaz (kaynaklar rekorlardır); bulut/tarayıcı birleşiminde ve göçte kaybolamaz; eski oyuncu "yıldız başına 1" başlangıç bakiyesini kendiliğinden alır. |
| KA7 | Günlük görevlerden kandil: **evet, günde en çok 1** (3/3 görev günü). | Günlük dönüşe küçük bir sebep, takılan oyuncuya yavaş ama kesin bir kaynak; günde 1 ile ana kaynakları gölgelemez. Sonsuz Şenlik ve günlük bölüm yıldızı kandil vermez. |
| KA8 | Kasaba **3. bölümün ilk kazancıyla** açılır; mahalleler **sırayla** süslenir (önceki mahallenin 6 işi bitmeli, mahallenin ilk bölümü haritada açık olmalı); mahalle içinde 5 iş serbest sırayla, 6. (taç) iş en son. | Öğretimin ortasında ilk kandil anı (1–2 bölümün yıldızı → 2–3 iş hemen); sıralı mahalle "hep yapılacak bir sonraki iş"i tek ve açık tutar; serbest sıra sahiplik hissi verir. |
| KA9 | 48 iş, toplam **186 kandil** (§B.3); tipik oyuncu (~2,2★/bölüm, mühürlerin %50'si) ~1,2 bölümde bir iş yapar ve mahalleyi haritada o mahalleyi bitirirken süsler; Kale'nin son işleri 40. bölümden sonra 3★/mühür avına çeker. | Ekonomi simülasyonu (§B.4). |
| KA10 | Mühür ödülü: 3/3 → çatıda mahalle renginde **sancak**; mahallede 5/10/15 mühürde o mahallenin **fitil görünümünün** sıradaki parçası (üçü de varsa 10 toz); her yeni mühür +1 kandil. | Kullanıcı kararı (kozmetik); var olan 7 sandık fitili yeniden kullanılır, yeni çizim gerekmez. |
| KA11 | `progressScore` + 5·mühür + 3·iş (en çok 669 < 1000 = bir yıldız). Eski kayıtta değer aynen kalır. | Bulut birleşiminde mühür/iş kaybolmasın; eski sürümün zarf puanıyla karşılaştırma bozulmasın. |
| KA12 | Arayüzde üst banda (HUD plakası, gök şeridi) HİÇBİR şey eklenmez; mühür rozeti Duraklat düğmesinde, Kasaba düğmesi alt bantta. | iPhone görüntüleyicisinde üst bant zaten dar (fişek şikâyeti). |
| KA13 | (K5) "Özel taş ateşle" patlayan özel taşı sayar: kombinasyona giren iki taş da ateşlenmiştir; "Çapraz roket ateşle" kombinasyona giren çapraz roketi de sayar (§A.4). | Oyuncunun gözüyle: 14. bölüm kombinasyonu öğretirken "Tek hamlede 3 özel taş ateşle" kombinasyonu 0 sayıyordu. |
| KA14 | (K5) Eşikler iki bağımsız tohum kümesinin birleşiminde (Usta 300 / Acemi 600 oyun) bandın İÇ penceresinde seçilir: Çırak Acemi ≥ 48 (yedek Usta ≥ 90), Kalfa Usta 36–54, Usta Usta 11–20; üçüncü bağımsız kümeyle onaylanır. | Tek kümede kenarda seçilen eşikler (P0: 13 Usta mühürü %23–25) bağımsız kümede 21 mühürü banda taşırdı; 150 oyunda oran ±3–4 puan oynar. |
| KA15 | (K5) Kısıt mühürü (`enCok`) 6–40'ta yok; koşul dili ve ölçüm aracı destekler. | Kısıtlı botla ölçülünce "Körük kullanmadan kazan" %71–100, "Hiç 3'lük zincir çizmeden kazan" %100: kısıtı bilen oyuncu için hiçbir bantta değil (P0 doğal oranla, kısıtı bilmeyen botla ölçmüştü). Körük'ün zorunlu olduğu bir bölümde yeniden denenebilir. |

---

## A. Bölüm Mühürleri

### A.1 Kurallar
- 6–40. bölümler × 3 = **105 mühür**. Öğretim (1–5), Usta Bölümleri, Günün
  Şenliği ve Sonsuz Şenlik mühürsüzdür (Usta Bölümleri sonra eklenebilir:
  doğrulayıcı şimdilik 41+ bölümde mühürü hata sayar).
- Mühür yalnız **kazanılan** oyunda basılır; yıldızdan bağımsızdır (1★
  kazançta da olur). Koşul tek oyun içinde ölçülür, oyunlar arasında birikmez.
- Basılan mühür kalıcıdır; üçü ayrı denemelerde toplanabilir.
- **Kıvılcım Usta'nın Eli** ile kazanılan oyunda mühür basılmaz.
- Güçlendirici kullanılabilir. "Tek hamle" (kapsam `hamle`) = tek oyuncu
  eylemi: fitil, çift dokunuş ya da Körük; Kibrit ve Kalıp eylemleri tek hamle
  sayılmaz (stoktaki güçlendirici "tek hamlede" mühürlerini bedavaya
  getirmesin), oyun toplamına girer. Yalnız Körük için `eylem: "koruk"`.
- **Geri Sar** özeti de geri alır: tutmuş görünen mühür geri dönebilir (HUD
  rozeti söner, ters uçuş yok).
- Final gösterisi mühür ölçülerine girmez; "kalan hamle" kazanç anındaki
  (final ÖNCESİ) değerdir.

### A.2 Tanıtım ve görünürlük
- Mühür arayüzü (bölüm öncesi satırları, HUD rozeti, Duraklat listesi) yalnız
  **6. bölüm kazanılmışsa** görünür.
- 6. bölümün ilk oyununda değerlendirme sessizce yapılır; kazanınca Kazandın
  ekranında "Yeni: Mühürler" tanıtımıyla tutan mühürler damgalanır (çoğu
  oyuncu Çırak'ı zaten tutturmuştur: ilk mühür bedava gelir).
- Göçle gelen eski oyuncu (6. bölümü önceden kazanmış): mühürler hemen
  görünür; ilk mühürlü bölüm öncesi kartında tanıtım balonu çıkar (§C.6).

### A.3 Koşul dili (JSON şeması)
Tip: `MuhurKosulu` (`src/core/types.ts`), değerlendirici `src/meta/muhur.ts`.

```jsonc
// bölüm JSON'u, en sonda: [Çırak, Kalfa, Usta]
"muhurler": [
  {"olcu": "R", "kapsam": "hamle", "enAz": 4, "halka": true},
  {"olcu": "halka", "kapsam": "oyun", "enAz": 3},
  {"olcu": "R", "kapsam": "hamle", "enAz": 14, "halka": true, "sans": true}
]
```

| Alan | Değer | Anlam |
|---|---|---|
| `olcu` | aşağıdaki tablo | Ne ölçülür. |
| `kapsam` | `oyun` · `hamle` · `son` | Oyun boyunca toplam · tek eylemde en büyük · kazanç anında. |
| `enAz` | tamsayı ≥ 1 | Değer ≥ enAz ise tutar. |
| `enCok` | tamsayı ≥ 0 | Değer ≤ enCok ise tutar (kısıt; yalnız `kapsam: "oyun"`; 0 = hiç). `enAz` ile `enCok`'tan **tam olarak biri** bulunur. |
| `renk` | 0..renkSayisi−1 | `patlama`: o renkte; `zincir`: o renk zincir. |
| `halka` | `true`/`false` | Yalnız halka (ya da halka olmayan) eylemler. |
| `eylem` | `fitil` · `ciftDokunus` · `koruk` | Yalnız o eylem türü (Körükle R gibi). |
| `ozel` | `roket` · `kasimpati` · `yildiz` | `olusum`, `ozelAtes` süzgeci. |
| `kombo` | 6 kombinasyondan biri | `kombo` süzgeci. |
| `sans` | `true` | Tasarımcı işareti: dolum/kaskad şansına bağlı. Bölüm başına ≤ 1. |
| `metin` | ≤ 34 karakter | Elle metin (yoksa `muhurMetni` üretir). |

| Ölçü | Kapsam | Kaynak (eylem izi) | Örnek metin |
|---|---|---|---|
| `patlama` | oyun, hamle | kapsül patlaması (renk süzgeciyle o renk) | "Tek hamlede 8 gül patlat" |
| `isiPatlamasi` | oyun, hamle | ısıyla patlayan | "30 kapsülü ısıyla patlat" |
| `halka` | oyun | çizilen halka | "3 halka çiz" |
| `olusum` | oyun | zincir dönüşümüyle oluşan özel taş (son düğüm, §4.1) | "2 yıldız topu yap" |
| `ozelAtes` | oyun, hamle | tetiklenen özel taş | "Tek hamlede 3 özel taş ateşle" |
| `caprazRoket` | oyun, hamle | ↗/↘ roket tetiklenmesi | "2 çapraz roket ateşle" |
| `kombo` | oyun, hamle | kombinasyon (türüyle) | "Bir kombinasyon yap" |
| `kafes` `kaya` `engelHasar` `doseme` `desen` `is` `fener` `devFisek` `kurutma` | oyun, hamle | engel/çevre olayları | "Tek hamlede 3 kaya yok et" |
| `izliDevFisek` | oyun, hamle | barut iziyle fırlayan dev fişek | "Barut iziyle dev fişek ateşle" |
| `caprazEngel` | oyun, hamle | çapraz roketin vurduğu engel | "Çapraz roketle bir engel vur" |
| `koruk` | oyun | Körük kullanımı (`enCok: 0` = Körüksüz) | "Körük kullanmadan kazan" |
| `guclendirici` | oyun | Kibrit/Kalıp/Geri Sar (istatistikten) | "Güçlendirici kullanmadan kazan" |
| `R` | hamle | tek eylemin reaksiyonu (fitil, çift dokunuş, Körük) | "Tek hamlede 25+ reaksiyon yap" |
| `nesil` | hamle | tek eylemdeki en yüksek nesil | "9. nesil bir patlama yap" |
| `zincir` | hamle | fitil düğüm sayısı (`halka` ile halka boyu) | "12+ düğümlü bir zincir çiz" |
| `kisaZincir` | oyun | ≤ 3 düğümlü fitil sayısı (kısıt) | "Hiç 3'lük zincir çizmeden kazan" |
| `kalanHamle` | son | kazanç anında kalan hamle | "8 hamle kala kazan" |

**Doğrulama** (`bolumMuhurDogrula`, `npm run dogrula` ve vitest): 6–40'ta tam 3
geçerli koşul; 1–5 ve 41+ bölümde yok; kapsam ölçüye uygun; süzgeç ölçüye
uygun; `sans` ≤ 1; aynı koşul iki kez yok; metin ≤ 34 karakter (360 px kartta
tek satır).

### A.4 Değerlendirme (sözleşme kodu hazır)
```ts
// src/meta/ozet.ts — her eylemde (zaten çağrılıyor):
oz = ozetHamle(oz, olaylar, { hamle, onceki });     // oz.hamleIzleri'ne 1 iz ekler
// src/meta/muhur.ts
const mo = muhurOzeti(oz, finalOncesiDurum);           // kazandi, kalanHamle, ustaEli, guclendirici
muhurleriDegerlendir(v, mo) → [cirak, kalfa, usta]     // kazanç ve Eli yoksa
muhurAnlik(v, mo) → ('tuttu'|'bekliyor'|'korunuyor'|'bozuldu'|'sonda')[]   // HUD
muhurBirlestir(eskiMaske, bu) → { maske, yeni }        // kayıt
muhurMetni(kosul) → "Halkayla 14+ reaksiyon yap"
```
`HamleIzi` (eylem başına): eylem türü, zincir/renk/halka, R, en yüksek nesil,
patlama ve renk dağılımı, ısı patlaması, zincir dönüşümü (`olusan`), patlayan
özel taşlar, çapraz roket, kombinasyonlar, kafes/kaya/engel/döşeme/desen/is/
fener/dev fişek/izli dev fişek/çapraz engel/kurutma. Atıflar özetle aynı
kuralla (çapraz roket: eksende tam T + 25·d; izli dev fişek: önce `izYandi`).

**Oyuncunun gözüyle sayım (K5 kararları):**
- "Özel taş ateşle" (`ozelAtes`) **patlayan** özel taşı sayar
  (`patlama.ozel`): kombinasyona giren iki taş da ateşlenmiş sayılır
  (yüklenen S1 ve S2 kendi `ozelTetiklendi` olayını yazmaz; eski sayım
  kombinasyonu 0 sayıyordu, 14. bölüm "Tek hamlede 3 özel taş ateşle"
  kombinasyonu öğretirken onu saymazdı).
- "Çapraz roket ateşle" (`caprazRoket`) kendi etkisiyle tetiklenen ↗/↘
  roketi ve kombinasyona giren çapraz roketi sayar (eksen eylem öncesi
  durumdan; `ozetHamle`'ye `onceki` verilmezse kombinasyondaki sayılmaz).
  "Çapraz roketle engel vur" yalnız kendi etkisiyle uçan çapraz roketi atar
  (kalın roket/yıldız hattı şeritleri sayılmaz).
- Doğrulama: `src/bot/muhurOlcum.test.ts` 18 bölümün Usta/Acemi oyunlarında
  ve 60 rastgele bölümde (Kibrit, Kalıp, Körük dahil) her izi çekirdeğin
  durum/istatistik farkından bağımsız hesaplananla karşılaştırır; koşul
  dilinin her ölçü × kapsam çifti bu bağımsız değerlerden yeniden toplanır;
  atıflı ölçüler hedefli tahtalarla sınanır.

**Oturumda (src/app/oturum.ts) yapılacak:** her eylemin oynatması bitince
`muhurAnlik` → HUD; kazançta final ÖNCESİ durumla `muhurleriDegerlendir` →
`BolumSonucGirdisi.muhurler`. Usta'nın Eli devamında özet sıfırlanır ve
`istatistik.ustaEli` true: mühür yok.

### A.5 105 mühür (bölüm JSON'larında yazılı; K5 kalibrasyonu)
**Ölçüm (K5, `npm run bot -- --muhur`):** üç bağımsız tohum kümesi, her biri
Usta 150 / Acemi 300 oyun: 2000–2449, 5000–5449, 8000–8449 (ayar ve
kalibre tohumlarından bağımsız); tabloda üçünün **birleşimi** (Usta 450 /
Acemi 900 oyun). "Kazanç U / A" = botların kazanma oranı (%). Hücrede mühürün
o botun KAZANÇLARINDAKİ oranı (%): Çırak'ta A ve U (Acemi kazancı < 20 ise
yalnız U: KA5 yedeği, bant U ≥ 85), Kalfa ve Usta'da U. "(şans)" = `sans:
true`. Eşikler ilk iki kümenin birleşiminden iç pencereyle seçildi (KA14);
üçüncü küme onaydır.

| Küme | Bantta | Payda (±5) | Bant dışı |
|---|---:|---:|---:|
| 2000+ | 105 | 0 | 0 |
| 5000+ | 104 | 1 (16 Çırak, Acemi %39) | 0 |
| 8000+ | 105 | 0 | 0 |
| **Birleşik** | **105** | 0 | 0 |

| # | Bölüm | Kazanç U / A | Çırak | Kalfa | Usta |
|---:|---|---|---|---|---|
| 6 | Kasımpatı | 100 / 58 | Bir kasımpatı yap · A 61 · U 100 | 3 kasımpatı yap · U 52 | 14 hamle kala kazan · U 14 |
| 7 | Islak Barut | 98 / 52 | Tek hamlede 3 ıslak barutu kurut · A 95 · U 87 | 11+ düğümlü bir zincir çiz · U 39 | 13+ düğümlü bir zincir çiz · U 15 |
| 8 | Halka | 100 / 36 | Halkayla 3+ reaksiyon yap · A 56 · U 68 | 3 halka çiz · U 44 | Halkayla 17+ reaksiyon yap (şans) · U 14 |
| 9 | Işıklı Sokak | 100 / 47 | Tek hamlede 4 döşeme aydınlat · A 79 · U 100 | 3 kasımpatı ateşle · U 47 | 9. nesil bir patlama yap (şans) · U 14 |
| 10 | Çarşı Gecesi | 77 / 18 | Tek hamlede 5 döşeme aydınlat · A 73 · U 100 | 9 hamle kala kazan · U 46 | Tek hamlede 27+ reaksiyon yap (şans) · U 18 |
| 11 | Fener Alayı | 99 / 59 | 3 fener indir · A 65 · U 78 | 4 özel taş ateşle · U 46 | 12+ düğümlü bir zincir çiz · U 18 |
| 12 | Yıldız Topu | 100 / 37 | Bir yıldız topu yap · A 75 · U 100 | 2 yıldız topu yap · U 42 | Tek hamlede 4 kafes kır · U 19 |
| 13 | Kayalık | 100 / 53 | Tek hamlede 3 kaya yok et · A 78 · U 80 | Bir yıldız topu yap · U 43 | 14+ düğümlü bir zincir çiz · U 19 |
| 14 | Çifte Roket | 100 / 52 | Bir kombinasyon yap · A 88 · U 100 | 5 roket yap · U 48 | Tek hamlede 3 özel taş ateşle · U 14 |
| 15 | Liman Fırtınası | 86 / 9 | Tek hamlede 4 kez engel vur · A 54 · U 54 | 8 hamle kala kazan · U 41 | Tek hamlede 3 kaya yok et · U 15 |
| 16 | Dev Fişek | 100 / 52 | 3 dev fişek ateşle · A 41 · U 70 | 2 kasımpatı yap · U 45 | Tek hamlede 2 dev fişek ateşle · U 19 |
| 17 | Körük | 100 / 42 | Körük'ü kullan · A 96 · U 100 | Körük'ü 3 kez kullan · U 42 | Körükle 7+ reaksiyon yap (şans) · U 15 |
| 18 | Su Kovası | 86 / 45 | Tek hamlede 2 kafes kır · A 72 · U 53 | 4 roket yap · U 48 | Körükle 21+ reaksiyon yap (şans) · U 17 |
| 19 | Kuru Gece | 100 / 81 | Körükle 18+ reaksiyon yap · A 89 · U 57 | 20 hamle kala kazan · U 48 | 6 halka çiz · U 13 |
| 20 | Gece Yarısı | 82 / 8 | Tek hamlede 2 kafes kır · A 95 · U 76 | Tek hamlede 2 dev fişek ateşle · U 33 | 7 hamle kala kazan · U 15 |
| 21 | Barut İzi | 100 / 55 | Tek hamlede 10 döşeme aydınlat · A 88 · U 100 | Körükle 24+ reaksiyon yap (şans) · U 41 | 4 halka çiz · U 14 |
| 22 | Altı Renk | 98 / 30 | 8+ düğümlü bir zincir çiz · A 51 · U 76 | Tek hamlede 6 mor patlat · U 44 | Tek hamlede 8 gül patlat · U 18 |
| 23 | Lale Tarhı | 93 / 33 | Tek hamlede 3 kaya yok et · A 57 · U 100 | 2 çapraz roket ateşle · U 52 | 12+ düğümlü bir zincir çiz · U 19 |
| 24 | Çift Kat | 100 / 36 | Tek hamlede 6 döşeme aydınlat · A 72 · U 96 | Halkayla 7+ reaksiyon yap · U 49 | Bir yıldız topu yap · U 19 |
| 25 | Bahçe Duvarı | 85 / 9 | Tek hamlede 2 kaya yok et · A 51 · U 53 | 8 hamle kala kazan · U 49 | 3 halka çiz · U 18 |
| 26 | Lale Deseni | 90 / 49 | Tek hamlede 5 desen karosu boya · A 73 · U 100 | 6 özel taş ateşle · U 43 | Tek hamlede 8 desen karosu boya · U 16 |
| 27 | Nemli Gece | 77 / 10 | Tek hamlede 2 kafes kır · A 86 · U 53 | 6. nesil bir patlama yap (şans) · U 37 | 6 hamle kala kazan · U 16 |
| 28 | Kova Bulmacası | 82 / 12 | Tek hamlede 2 kafes kır · A 99 · U 88 | Çapraz roketle bir engel vur · U 43 | Tek hamlede 3 kafes kır · U 13 |
| 29 | Meltem | 99 / 30 | Bir kasımpatı yap · A 77 · U 83 | 13+ düğümlü bir zincir çiz · U 44 | Tek hamlede 37+ reaksiyon yap (şans) · U 15 |
| 30 | Tepe Şenliği | 56 / 1 | Tek hamlede 9 desen karosu boya · U 100 | Tek hamlede 2 özel taş ateşle · U 52 | 12 hamle kala kazan · U 20 |
| 31 | İs | 90 / 3 | Tek hamlede 2 is temizle · A 100 · U 100 | 3 roket yap · U 54 | 11+ düğümlü bir zincir çiz · U 17 |
| 32 | Bacalar | 71 / 2 | Tek hamlede 6 is temizle · U 100 | Çapraz roketle bir engel vur · U 41 | Tek hamlede 2 dev fişek ateşle · U 17 |
| 33 | Çisenti | 82 / 3 | Tek hamlede 2 kafes kır · A 100 · U 93 | Halkayla 8+ reaksiyon yap · U 46 | 8 hamle kala kazan · U 17 |
| 34 | Kuru Gece II | 100 / 14 | Körükle 22+ reaksiyon yap · A 79 · U 61 | 4 halka çiz · U 44 | Tek hamlede 43+ reaksiyon yap (şans) · U 16 |
| 35 | Fabrika Yangını | 46 / 0 | Tek hamlede 4 is temizle · U 100 | Çapraz roketle bir engel vur · U 51 | 7 hamle kala kazan · U 15 |
| 36 | Kale Kapısı | 77 / 2 | Tek hamlede 2 kaya yok et · U 100 | Tek hamlede 3 kaya yok et · U 43 | Tek hamlede 6 kez engel vur · U 12 |
| 37 | Barut Deposu | 76 / 21 | Tek hamlede 2 dev fişek ateşle · A 64 · U 21 | 4 özel taş ateşle · U 43 | 9 hamle kala kazan · U 15 |
| 38 | Sur Feneri | 74 / 1 | Tek hamlede 2 kafes kır · U 92 | 4 roket yap · U 50 | Halkayla 12+ reaksiyon yap (şans) · U 16 |
| 39 | Arife | 97 / 3 | 7+ düğümlü bir zincir çiz · A 96 · U 94 | 4 halka çiz · U 44 | Halkayla 32+ reaksiyon yap (şans) · U 15 |
| 40 | Büyük Şenlik | 51 / 1 | Tek hamlede 11 desen karosu boya · U 100 | Tek hamlede 8 kez engel vur · U 45 | Tek hamlede 32+ reaksiyon yap (şans) · U 14 |

**Tasarım kuralları:**
- Her bölümün mühürleri o bölümün öğrettiği öğeye bağlıdır (6 kasımpatı, 7
  ıslak, 8 halka, 9–10 döşeme, 11 fener, 12 yıldız topu, 13 kaya, 14
  kombinasyon, 15 kaya/kova vuruşu, 16 dev fişek, 17 Körük, 18 kafes+kova,
  19 ve 34 bayramda Körük, 21 barut iziyle döşeme, 22 altı renk (mor, gül),
  26 desen, 28 kova+kafes ve çapraz roket, 31–32 is, 36 ve 40 sur kayaları,
  37 barut deposu dominosu: tek hamlede iki dev fişek); Kalfa ve Usta bir
  önceki dersi pekiştirebilir (13'te "Bir yıldız topu yap").
- Aynı ölçü iki kademedeyse eşik kademeyle artar (7: 11+ → 13+ zincir, 28: 2
  → 3 kafes, 36: 2 → 3 kaya); doğrulayıcı denetler.
- "Kalan hamle" (hızlı bitirme) 11 mühürde, çoğunlukla zor bölümlerde.
- Şansa bağlı (süzgeçsiz R, nesil; Körükle R'de tasarımcı işareti) bölüm
  başına en çok 1, Çırak'ta hiç.
- Botun **amaç körü** olduğu niyete bağlı koşullar (halka sayısı, zincir boyu,
  özel taş yapımı, "3 dev fişek ateşle") insan için daha kolaydır.
- **Tek hamle maksimumu tuzağı:** ilk tahta sabit olduğundan (K15) Usta botun
  ilk hamlesi tohumlar arasında aynıdır; "tek hamlede N desen/döşeme/is"
  ölçüleri Usta için çoğu kez %100 → %0–20 basamaklıdır. Bunlar Çırak'ta
  ("açılışı bul") kullanılır; tek istisna 26 Usta "Tek hamlede 8 desen
  karosu boya" (7: %100, 8: %16 — basamak bandın içine düşüyor).
- **Sınırda (gerekçeli):** 16 Çırak "3 dev fişek ateşle" Acemi %41 (kümeler
  40 / 39 / 44): hedef 3 dev fişekten 2'si, mühür üçüncüyü ister; Acemi onu
  hedeflemez, insan hedefleyebilir. 20 Kalfa "Tek hamlede 2 dev fişek
  ateşle" Usta %33 (37 / 31 / 33): bölümün öğesi, bandın içinde.

**K5'te değişenler (P0 tablosundan):** 42 mühür. P0 eşikleri tek kümede
(2000+) bant kenarında seçilmişti (16 Usta mühürü %23–25); bağımsız 5000+
kümesinde 21 mühür bant dışına ya da paya taştı. Eşik kaydırma (ör. 10 Usta
25+ → 27+ reaksiyon, 15 Kalfa 6 → 8 hamle kala, 18 Usta Körükle 17+ → 21+)
ve ölçü değiştirme (ör. 11 Kalfa "2 çapraz roket" → "4 özel taş ateşle",
22 Kalfa → "Tek hamlede 6 mor patlat", 28 Çırak ↔ Kalfa "Çapraz roketle bir
engel vur" Kalfa'ya). Ayrıntı git geçmişinde (`FİTİL K5:` işlemeleri).

**Kısıt mühürleri** (`enCok`, KA15): 6–40'ta yok. Kısıtlı botla ölçüldü:
"Körük kullanmadan kazan" 30. bölümde %71 (P0 ön ölçümünde diğer
bölümlerde %75–101), "Hiç 3'lük zincir çizmeden kazan" 29. bölümde %100
(doğal oran %23 yanıltıcıydı: kısıtı bilen oyuncu için neredeyse bedava).
Koşul dili ve ölçüm aracı kısıtı destekler.

### A.6 Ödüller
| Olay | Ödül | Görünüş |
|---|---|---|
| Her yeni mühür | +1 kandil (§B.2) | Kazandın kazanç şeridinde kandil çipi |
| Bölümün 3/3 mührü | Çatıda **sancak** (mahalle vurgu rengi) | Haritada binanın çatısında dalgalanan küçük bayrak (3★ çatı fişeğiyle birlikte: sancak çatının sol ucunda, fişek ortada) |
| Mahallede 5., 10., 15. mühür | Mahallenin fitil görünümünün sıradaki eksik parçası; üçü de varsa +10 toz (= seçilen 1 parça) | Kazandın duyuru çipi "Lale Dalı parçası (5 mühür)" |

Mahalle → fitil (`MUHUR_FITILLERI`): Çarşı Lale Dalı · Liman Deniz Köpüğü ·
Saat Kulesi Altın Tel · Bahçeler Ateş Böceği · Tepe Gökkuşağı · Fabrika Ejder
Kuyruğu · Kale Şimşek. Verilen basamaklar kayıtta `muhurOdulleri`
(`"carsi:5"`), ikinci kez verilmez. 15/15 mühürlü mahalle o fitili TAM verir.

### A.7 Kalibrasyon aracı (K5, `src/bot/muhurOlcum.ts` + sim-cli)
```powershell
npm run bot -- --muhur --bolum 6-40 --tohum 150 --acemi-tohum 300 --bas 2000 --json olcum.json
npm run bot -- --muhur --bolum 22 --katalog              # bölüme uyan aday mühürlerin eşik tablosu
npm run bot -- --muhur --bolum 22 --aday adaylar.json    # ek koşulların oranları (dizi ya da {"22": [...]})
npm run dogrula -- --bolum 6-40 --acemi                  # bant dışı mühürde UYARI (±5 puan)
```
- Her oyunda uygulamanın yaptığı gibi `ozetHamle(oz, olaylar, { hamle,
  onceki })` çağrılır; kazançlarda koşul DEĞERİ (`muhurDegeri`, eşikten
  bağımsız) toplanır, oran = koşulu tutan kazanç / kazanç.
- Kalıcı işçi havuzu, varsayılan **2 işçi** (`--isci`), bölüm bölüm (izler
  bölüm yazdırılınca atılır); 35 bölüm × (150 U + 300 A) ≈ 40 dk.
- Satır: `Ç metin  U x  A y  → oran (bant …) bantta|PAYDA (±5)|BANT DIŞI`;
  bant dışında `öneri: enAz N → U a A b` (Çırak: alt sınıra 5 puan pay
  bırakan en zor eşik; Kalfa ~%45, Usta ~%16 hedefli).
- **Kısıt mühürleri** (`enCok`): aynı tohumlarla kısıtlı bot da oynar
  (`OyunSecenek.kisit`: Körük sınırı → `BotSecenek.korukYok`; 3'lük zincir
  sınırı → `enKisaZincir: 4`, uygun aday yoksa süzgeç kalkar); oran =
  kısıtlı botun koşulu TUTAN kazancı / normal botun kazancı.
- `--katalog`: bölüm öğelerinden aday koşullar (`adayKatalogu`) ve her
  kademe için banda giren eşik (Usta/Acemi oranlarıyla); yeni bölüme mühür
  seçerken başlangıç noktası.
- `--dogrula` mühürlü bölümde işçiden mühür değerlerini de alır; Çırak
  yalnız Acemi ölçüldüyse (öğretim/tanıtım ya da `--acemi`), kısıt
  mühürleri yalnız `--muhur` ile denetlenir. Bölüm ayarı (hamle, eşik,
  düzen) değişirse o bölümün mühürleri yeniden ölçülür.

---

## B. Kasaba İşleri

### B.1 Kandil
Tek yeni birim. Satılmaz, harcanınca geri gelmez, yalnız Kasaba'da ve
Kazandın kazanç şeridinde görünür (toz ve parçayla karışmasın). İkon: inline
SVG pişmiş toprak kandil (kayık biçimli gövde, küçük alev); yıldız ve tozdan
ayrı siluet.

### B.2 Kaynaklar (türetilmiş bakiye)
| Kaynak | Kandil | Sınır |
|---|---|---|
| Her yeni yıldız (ana 1–40 ve Usta Bölümleri; yıldız rekoru artışı) | 1 | 120 + 24 |
| Her yeni mühür | 1 | 105 |
| Mahalle tamamlama (5 bölümü de kazanıldı) | 3 | 24 |
| Günün 3 görevinin üçü (parlak görev sandığıyla aynı anda) | 1 | günde 1 |
| Sonsuz Şenlik, günlük bölüm yıldızı | 0 | — |

`kandilDokumu(k)` = { yildiz, muhur, mahalle, gunluk, kazanilan, harcanan,
bakiye }. Tavan günlük hariç **273**; işlerin toplamı **186**: bütün kasaba
yalnız yıldızla (144) bitmez, mühür ya da Usta Bölümü gerekir.

### B.3 İş kataloğu (`KASABA_ISLERI`, `src/app/katalog.ts`)
Kurallar: kasaba 3. bölümün ilk kazancıyla açılır; mahalle m'nin işleri,
(m−1)'in 6 işi bittiğinde VE m'nin ilk bölümü açıkken açılır; ilk 5 iş
serbest sırayla, taç iş (6.) en son. Mahallenin 6/6'sı → "Mahalle şenliği" +
`kasaba:<mahalleId>` Defter kartı (§B.5).

| Mahalle (sakin) | 1 | 2 | 3 | 4 | 5 | Taç (6) | Toplam |
|---|---|---|---|---|---|---|---:|
| İskele (Kayıkçı Rıza) | Pruva fenerleri 1 | İskele bayrakları 2 | Fener dizisi 2 | Kandilli kemer 2 | Deniz feneri 3 | İskele tabelası 4 | 14 |
| Çarşı (Kandilci Nazlı) | Dükkân kandilleri 2 | Kemer çelengi 2 | Lale fenerleri 3 | Kubbe kandilleri 3 | Mahya yazısı 4 | Çarşı kapısı 4 | 18 |
| Liman (Kaptan Yakup) | Direk fenerleri 2 | Halat flamaları 3 | Vinç ışıkları 3 | Mendirek fenerleri 4 | Gemi donanması 4 | Liman kapısı 4 | 20 |
| Saat Kulesi (Saatçi Hüsnü Usta) | Sokak lambaları 3 | Kule çelengi 3 | Balkon fenerleri 3 | Çeşme ışıkları 4 | Aydınlık kadran 4 | Şenlik çanı 5 | 22 |
| Bahçeler (Bahçıvan Gülizar) | Çardak fenerleri 3 | Dilek ağacı 3 | Ateş böceği kavanozları 4 | Gül kemeri 4 | Yüzen kandiller 5 | Hıdırellez ateşi 5 | 24 |
| Tepe (Gökbilimci Ayşe) | Patika fenerleri 3 | Değirmen kanatları 4 | Rüzgâr flamaları 4 | Rasathane kubbesi 5 | Ateş çanakları 5 | Gök haritası 5 | 26 |
| Fabrika (Barutçu Kemal) | Atölye lambaları 4 | Depo kapısı 4 | Ray fenerleri 5 | Baca kıvılcımları 5 | Baca çelengi 5 | Şenlik düdüğü 5 | 28 |
| Kale (Sur Bekçisi Murat) | Sur kandilleri 4 | Burç bayrakları 5 | Kapı meşaleleri 5 | Mazgal fenerleri 6 | Donanma ışıkları 6 | Büyük burç ateşi 8 | 34 |

Her işin tek satır açıklaması, sakin sözü, çizim şablonu (`fenerDizisi`,
`flama`, `kandilDizisi`, `kemer`, `yapiIsigi`, `tabela`, `ates`, `parilti`)
ve çapası (`yer`, mahalle bölgesinin yerel koordinatı; çizim paketi ekran
görüntüsüyle ayarlar) katalogdadır. Var olan çizimler (İskele kayık fenerleri,
Çarşı'nın noktalı mahyası, yanan kadran) KALIR; işler üstüne ekler (eski
oyuncunun gördüğü hiçbir şey sönmez).

### B.4 Ekonomi simülasyonu
Model: oyuncu bölümleri sırayla bitirir; ilk kazançta yıldız (öğretim 1–3:
%15/60/25 1★/2★/3★, sonra profile göre), mühür olasılıkları, sonradan tekrar
(son 10 bölümden birinde +1★ ya da +1 mühür), Usta Bölümü (her 15★'da, %80
oynanır), günlük 3/3 (her 5 bölümde bir gün, 10'dan sonra). Kandil yeten en
ucuz açık iş hemen yapılır. 600 tohum.

| Profil | ★ / bölüm (40'ta, tekrarlarla) | İlk kazançta mühür (Ç/K/U) | Tekrar / bölüm | Günlük 3/3 | Toplam mühür (40'ta) |
|---|---|---|---|---|---|
| Gündelik | 1,80 | %55 / %15 / %3 | 0,15 | %30 | 28/105 (%27) |
| **Tipik** | **2,17** | %78 / %40 / %12 | 0,4 | %50 | **52/105 (%50)** |
| Usta | 2,62 | %90 / %55 / %20 | 0,6 | %70 | 68/105 (%65) |

**Tipik oyuncu:**

| Bölüm | Kazanılan kandil | Yapılan iş | Sıradaki işe eksik (ort.) | Bakiye (ort.) |
|---:|---:|---:|---:|---:|
| 3 | 7 | 3,5 | 2,0 | 0,6 |
| 4 | 9 | 4,2 | 2,2 | 1,0 |
| 5 | 14 | 5,7 | 1,6 | 1,2 |
| 6 | 17 | 7,4 | 1,8 | 0,6 |
| 8 | 25 | 9,9 | 2,4 | 1,4 |
| 10 | 36 | 13,1 | 2,0 | 1,0 |
| 12 | 43 | 15,3 | 2,4 | 1,4 |
| 15 | 58 | 19,7 | 2,3 | 1,1 |
| 20 | 81 | 25,7 | 2,3 | 1,5 |
| 25 | 104 | 31,2 | 2,6 | 1,5 |
| 30 | 127 | 36,3 | 2,7 | 1,8 |
| 35 | 149 | 41,1 | 2,9 | 1,8 |
| 40 | 172 | 45,5 | 3,6 | 2,5 |

İş yapılan bölümler arası ortalama **1,18** (p90 2): "1–2 bölümde bir iş" ✓.
Sıradaki işe hep **2–3 kandil** eksik (≈ bir bölüm): "hep yapılacak bir
sonraki iş" ✓. Mahalle 6/6 medyanı: İskele 5 · Çarşı 10 · Liman 15 · Saat
Kulesi 20 · Bahçeler 25 · Tepe 30 · Fabrika 36 · Kale 40'ta yalnız %3
(45,5/48 iş): kasaba haritayla birlikte, mahalleyi bitirdiği bölümde süslenir;
Kale'nin son 2–3 işi (~14 kandil) 40. bölümden sonra 3★ ve mühür avına çeker.

**Gündelik:** 40'ta 130 kandil, 37/48 iş, Tepe %86 (medyan 39), Fabrika ve
Kale açık; iş aralığı 1,32. **Usta:** 40'ta 214 kandil, 48/48 iş (Kale 35'te);
20'den sonra ilk işler mahalle açılır açılmaz biter ve 5–6 kandil birikim
olur: yeni mahalle açıldığında 2–3 işi birden yapar (birikimin anlamı), 40'ta
~28 kandil artar (Usta Bölümleri ve tekrarlar).

**Eski oyuncu (göç):** 20. bölümdeki ~45★ ve 4 tamamlanmış mahalle → **57
kandil**: ilk açılışta İskele, Çarşı ve Liman'ın tamamı (52) ve Saat
Kulesi'nin ilk işi hemen yapılabilir — "Fener Koyu seni bekliyordu" anı
(§C.6). Her Mahalle şenliği 6 sn ve atlanabilir; art arda üç şenlik
oyuncunun dokunuşuyla hızla geçilebilir.

Simülasyon betiği: `python3 scripts/kanca/kasaba-ekonomi.py` (maliyetler
betiğin başında; katalog değişince birlikte güncellenir ve bu tablo yeniden
üretilir).

### B.5 Kutlamalar
- **İş tamam:** süs belirir (§C.1 akışı), sakinin tek satır sözü 2,4 sn.
- **Mahalle şenliği (6/6):** var olan 6 sn'lik `mahalleSovu` bu mahallenin
  süsleri yanıp sönerek oynar (atlanabilir); ardından Defter kartı ekranı
  `kasaba:<mahalleId>` kartını gösterir (Ayarlar > Defter'den yeniden
  okunur). Fişekler görünür gök şeridinde (HUD yokken haritanın üst
  çubuğunun altında) patlar; 375×600'de ekran görüntüsüyle doğrulanır.
- **Kasaba kartları** (`KartTanimi.tur: 'kasaba'`, defter.ts'e eklenecek;
  en çok 4 cümle, sakinin mektubu):

| Kart | Başlık | Metin |
|---|---|---|
| `kasaba:iskele` | Kayıkçı Rıza'nın mektubu | Çırak, iskele yeniden ışıl ışıl. Kayıklar artık gece de yolunu buluyor, çocuklar fenerlerin altında oyun kuruyor. Deniz fenerinin döndüğünü gören balıkçılar sabaha kadar türkü söyledi. Babamın feneri sana emanet. |
| `kasaba:carsi` | Kandilci Nazlı'nın mektubu | Dükkânların kapısında kandiller yandığından beri çarşı gece de kapanmıyor. Mahyadaki ŞENLİK yazısını ta tepeden okuyorlarmış. Kandillerin mırıldandığı ezgiyi sen de duydun mu? Bu ışıklar senin elinden. |
| `kasaba:liman` | Kaptan Yakup'un mektubu | Gemim donandı, vinç bile bayramlık giydi. Mendirekteki fenerler yanınca uzak limanlardan selam geldi. Tayfalar "Fener Koyu yeniden uyandı" diyor. Bir gün seni de denize çıkarırım, çırak. |
| `kasaba:saatKulesi` | Saatçi Hüsnü Usta'nın mektubu | Kadran yeniden aydınlandı, akrep yerine oturdu. Şenlik çanı çaldığında meydandaki herkes saatini düzeltti. Kulenin her kandili bir saniye kadar değerli. Tam zamanında geldin, çırak. |
| `kasaba:bahceler` | Bahçıvan Gülizar'ın mektubu | Dut ağacındaki kurdeleler rüzgârda dilekleri fısıldıyor. Havuzdaki kandiller sabaha kadar süzüldü, ateş böcekleri de onlara eşlik etti. Hıdırellez ateşinin üstünden bütün mahalle atladı. Senin dileğin de kabul olsun. |
| `kasaba:tepe` | Gökbilimci Ayşe'nin mektubu | Rasathanenin kubbesinden gök iki kat parlak görünüyor. Değirmenin ışıklı kanatları yıldızlarla dans ediyor. Gök haritasına senin adını da ekledim: küçük ama parlak bir yıldız. Nevruz ateşi bu yıl en güzel burada yandı. |
| `kasaba:fabrika` | Barutçu Kemal'in mektubu | Bacalardan artık duman değil altın kıvılcım yükseliyor. Depo kapısındaki fenerler, sabrın ışıkla ödüllendiğini hatırlatıyor. Şenlik düdüğü öttüğünde bütün işçiler gökyüzüne baktı. Barut sabır ister; sen sabrettin. |
| `kasaba:kale` | Sur Bekçisi Murat'ın mektubu | Surlar yüz yıl sonra yeniden donandı. Burçtaki büyük ateşi uzak köylerden bile görmüşler. Bekçiliğimde ilk kez bütün gece hiç karanlık görmedim. Kıvılcım Usta'nın sözü yerine geldi, çırak: koy yeniden yandı. |

### B.6 Harita çizimi
- Yapılan işler mahallenin DURAĞAN SVG'sine (`bolgeCiz(m, …, isler)`) şablonla
  çizilir; yalnız salınan fener, titreyen alev ve dönen fener huzmesi canlı
  HTML katmanında (transform/opacity), görünmeyen mahallede
  IntersectionObserver ile durur (çatı fişeğiyle aynı düzen). Mahalle başına
  en çok 6 canlı öğe.
- Kilitli (sisli) mahallede iş çizilmez (zaten yapılamaz).
- Sancak (§A.6): 3/3 mühürlü binanın çatısında, mahalle vurgu renginde 10×14
  px üçgen bayrak (Kale kremi için koyu kontur), CSS ile hafif dalgalanır;
  dalgalanan sancaklar mahallenin canlı öğe bütçesinden (6) işlerden artanı
  kullanır, gerisi durağan çizilir (`sancakOgeleri`; tam süslü mahallede
  sancaklar durağan). Çatı fişekleri, yanık fitil yolunun akışı ve süslü
  şerit kenarı da görünmeyen mahallede durur (bölge kabı / gözcü).
- Mahalle şeridi: "★ 12/15" yanına mühür çipi "● 9/15" (İskele'de yok),
  6/6 süslenmiş mahallede şeridin kenarı ışıklı.
- **Uygulama (süs paketi, `src/ui/harita/susler.ts`):** her mahallede
  "giriş yuvası" (şeridin üstü, ortada: İskele kemeri, Çarşı kapısı, Liman
  kapısı, çeşme, gül kemeri, ateş çanakları, depo kapısı, kale kapısı),
  "cep ipleri" (düğüm lambasından karşı kenara fener/flama dizisi), bina
  süsleri ve arka plan simgeleri (kubbe, mahya, saat kulesi, tepe sırtı);
  taç işlerin bir kısmı mahallenin üst ortasında. "Canlı öğe" = bir HTML
  öğesi: iş başına 1 (ip + fenerleri tek öğe, skewX ile sallanır; Tepe'de
  iki değirmen için 2, Gök haritası durağan), ölçüm mahalle başına 5–6.
  Yapılmamış işler yalnız süslenen mahallede sönük "hayalet" çizilir.
  Katalog `yer` = çizimin çapası (`isCapasi`, test). Yeni iş, `harita(vm)`
  önceki modelde yoksa kutlanır (1–2 iş; toplu değişiklikte kutlama yok);
  6/6 olduysa ardından Mahalle şenliği; `Arayuz.haritaKutlamasi()` bitince
  uygulama Defter kartını açar.

---

## C. Ekranlar ve akışlar (390×700 öncelikli; 375×600 ve 360×640 sığar)

### C.1 Harita: Kasaba düğmesi ve paneli
**Alt bant** (kasaba açıkken): `[Kasaba]` + `[▶ Bölüm N]` aynı sırada.
- 390 px: Kasaba 136 px, Bölüm 206 px, ara 8, kenar 20. 360 px: 124 / 196.
  Kasaba açılmadan (1–3. bölüm) Bölüm düğmesi bugünkü gibi ortalı.
- Kasaba düğmesi: ikincil (ahşap) stil, 64 px yükseklik; kandil ikonu + sayı
  (tabular) + "Kasaba" etiketi. Yapılabilir iş varsa amber nokta + yumuşak
  parıltı (1,5 Hz; hareketi azaltta durağan nokta).
- "Kandil yetti" uyarısı (`kasabaUyarisi`): kazançtan sonra haritaya
  dönüldüğünde yapılabilir ve uyarılmamış iş varsa, o dönüşte **otomatik
  bölüm kartı bir kez atlanır** ve Kasaba düğmesinin üstünde Kıvılcım Usta
  balonu çıkar: "Kandil yetti: {iş adı} yapalım mı?" (3,5 sn ya da dokununca).
  Uyarı kayda yazılır (`kasabaUyarildi`), aynı iş için tekrarlanmaz. Bölüm N
  düğmesi her zaman çalışır.

**Kasaba paneli** (`ui.kasaba(vm: KasabaVM): Promise<KasabaSecimi>`):
alttan açılan çekmece, yükseklik min(%70, 520 px); 700'de 490 px.
1. Başlık (48 px): "Fener Koyu Kasabası" + kandil hapı (ikon + sayı) + [X] 44 px.
2. Mahalle sekmeleri (40 px): yatay kaydırılır; ad + "3/6"; sırası gelmemiş
   ya da sisli mahalle sönük ve kilitli; açılışta süslenen mahalle seçili.
3. Sakin satırı (32 px): "{Sakin}'nın işleri" + 6 bölmeli ilerleme çubuğu.
4. İş listesi: 6 kart × 56 px + 5 × 6 px = 366 px (başlık + sekme + sakin
   satırıyla 486 px: 700'de kaydırmasız sığması hedeflenir; 640'ta liste
   kaydırılır). Kart: 40×40 şablon ikonu · ad (16/800) · açıklama
   (13/700, tek satır, taşarsa üç nokta) · sağda durum:

| Durum | Sağ uç |
|---|---|
| yapildi | yeşil onay + "Yapıldı" |
| yapilabilir | birincil düğme "Yap · {maliyet}" (min 44 px) |
| yetersiz | sönük maliyet hapı + "{eksik} eksik" |
| tacKilitli | kilit + "Önce 5 işi bitir" |
| sirada | kilit + "Önce {önceki mahalle} süslensin" |
| haritaKilitli | kilit + "Bölüm {5m+1}'i aç" |

**"Yap" akışı:** `meta.kasabaIsYap` → kayıt → çekmece kapanır (240 ms) →
harita işin çapasına kayar (500 ms; hareketi azaltta anında) → Kasaba
düğmesinden çapaya min(maliyet, 6) kandil kıvılcımı uçar (Bezier 450 ms,
60 ms arayla) → süs belirir: ölçek 0,6 → 1 (`outBack` 400 ms) + ışık halkası
600 ms + 12 parıltı → ses `arayuz('kasaba')` (yeni: çan akoru + fener
tıkırtısı; yoksa `parca`) + titreşim 20 ms → sakin balonu (2,4 sn, çapanın
üstünde; bir bölüm düğümünü örterse çapanın altında) → kandil hapı aşağı
sayar. 6/6 ise ardından Mahalle şenliği ve Defter kartı (§B.5). Kandil
sıradaki işe de yetiyorsa panel kutlamadan ~350 ms sonra kendiliğinden
yeniden açılır (göçle 38–71 kandille gelen oyuncu her iş için Kasaba'ya
basmasın); oyuncu kutlamada haritada bir şey seçtiyse, paneli kapattıysa ya
da kandil yetmiyorsa haritada kalınır. Panel yüksekliği görüntü alanından
(`min(70dvh, 520px)`); 760 px altında kart 54 px, ara 4 px: 390×700'de altı
kart kaydırmasız.

### C.2 Bölüm öncesi kartı
Hedefler bloğundan sonra, hamle çipinden önce **MÜHÜRLER** bloğu (6–40,
mühürler görünürse):
- Etiket (12 px büyük harf) + 3 satır × 28 px: [22 px mum mühür: basılı =
  kırmızı mum + kabartma kademe harfi Ç/K/U, basılmamış = kesik çerçeve]
  [kademe "ÇIRAK" 12/800, 46 px] [koşul metni 14/700, tek satır].
- Toplam ~106 px. 700 ve altında sığması için: "Yeni öğe" kutusu tek satırlık
  çipe (28 px ikon + ad) küçülür; "En iyi" yıldız satırına taşınır. 390×700,
  375×600, 360×640'ta ekran görüntüsüyle doğrulanır; Başla/Geri yapışkan
  altta kalır.

### C.3 Oyun HUD'u: mühür rozeti ve uçuş
- Rozet: Duraklat düğmesinin (alt bant, solda, 56 px) sağ üst köşesine
  yapışık 38×16 px hap, içinde 3 nokta (8 px): basılı (önceki deneme) dolu
  kırmızı mum; bu denemede **tuttu** dolu + parıltı; bekliyor/sonda boş
  halka; korunuyor ince altın halka; bozuldu boş + gri çizgi. Üst banda hiçbir
  şey eklenmez.
- Uçuş: bir eylemin oynatması bitince `muhurAnlik` hesaplanır; durumu yeni
  **'tuttu'** olan ve kayıtta basılı OLMAYAN her mühür için reaksiyon
  merkezinde (yoksa tahta ortasında) 28 px mum mühür belirir (120 ms) →
  Bezier 600 ms `inOutCubic` ile rozetin noktasına uçar → nokta damgası
  (ölçek 1 → 1,4 → 1, yay) + ses `yildiz1` (kazanç 0,6) + titreşim 15 ms +
  rozetin üstünde 900 ms "Kalfa mührü!" etiketi (alt bantta). Hareketi
  azaltta uçuş yok, nokta anında dolar.
- Usta'nın Eli devamında üç nokta "bozuldu" olur (Duraklat'ta: "Usta'nın Eli
  ile mühür basılmaz").

### C.4 Duraklat
Hedeflerin altında 3 mühür satırı (C.2 düzeni) ve durum yazısı: "Tuttu —
kazanırsan basılır" · "Henüz değil" · "Şimdilik tutuyor" · "Bu denemede
bozuldu" · "Kazanınca ölçülür" · "Basılı".

### C.5 Kazandın
Sıra (GDD §14.6'ya ek): yıldızlar → **mühürler** → puan sayımı (eşzamanlı) →
**kazanç şeridi** → sandık / tablo → "Sıradaki".
- Mühür satırı yıldızların hemen altında (36 px): 3 mum mühür (32 px);
  önceden basılılar baştan sönük dolu, yeniler yıldız sonu + 200 ms'de 250 ms
  arayla damgalanır (ölçek 2,2 → 1 `outBack`, toz halkası, ses `yildiz2`
  perdesi düşük, titreşim 20 ms). 3/3 tamamlandıysa yanında "Sancak!" çipi.
- Kazanç şeridi = duyuru satırı; **ilk çip her zaman kandil**: "+N kandil"
  (onceki → yeni sayar), "+N daha"ya gömülmez. Sonra mühür parçası
  (öncelikli: o da gömülmez), "Kasabada yapılacak iş hazır!", diğer
  duyurular (700 ve altında kandil + öncelikliler + 1; öncelikli varsa o 1
  hakkı kullanır, gerisi "+N daha").
- Tanıtım (`muhurler.tanitim`): Kıvılcım Usta ipucu yıldızların altında:
  "Yeni: Mühürler! Her bölümde üç görev var; kazandığın oyunda tutanlar
  basılır." İpuçları kapalıysa ve bölüm öncesi `muhur-kart` görüldüyse (göçle
  gelen oyuncu) çıkmaz. Kasaba tanıtımı (`kandil.tanitim`): "Yıldızların
  kandile döndü!".
- Usta'nın Eli ile kazançta boş halkaların altında "Usta'nın Eli ile mühür
  basılmaz".
- 700'de sığması için sandık/tablo satırı %85 ölçeklenir (230 → 196 px);
  660 ve altında yıldızlar, tanıtım ipucu, sandık/tablo ve çipler bir kademe
  daha küçülür (360×640'ta tanıtım + kandil + iş hazır + sandık + tablo +
  "Sıradaki" kaydırmasız); 390×700, 375×600 ve 360×640'ta ekran görüntüsü.
  Ekran kapanınca uçan kandiller kalkar (sayaç sesi susar).

### C.6 Öğretim balonları (Kıvılcım Usta; `ipuclari.gorulen` kimlikleriyle bir kez)
| Kimlik | Ne zaman | Metin | Yer |
|---|---|---|---|
| `kasaba-ilk` | 3. bölümün ilk kazancından sonra haritada (oto-kart bu kez atlanır) | "Yıldızların kandile döndü! Kasabayı süsleyelim." | Kasaba düğmesi; panel açılınca ilk işin "Yap"ında el animasyonu |
| `kasaba-hosgeldin` | Göçten sonra ilk harita (kasaba açık, hiç iş yok) | "Fener Koyu seni bekliyordu: {N} kandilin var!" | Kasaba düğmesi |
| `muhur-tanitim` | Mühürlerin tanıtıldığı Kazandın | (C.5 metni) | Kazandın ipucu |
| `muhur-kart` | Mühürlü ilk bölüm öncesi kartı | "Mühürler bölümü başka bir yolla oynatır. Üçünü ayrı denemelerde toplayabilirsin." | Mühür bloğunun üstü |
| `muhur-hud` | İlk 'tuttu' uçuşu | "Mühür tuttu! Kazanırsan basılır." | Tahta üst kenarı (bugünkü balon yeri) |
| `sancak-ilk` | İlk sancaktan sonra harita (aynı dönüşte "Kandil yetti"den önce; o bir sonraki dönüşe kalır) | "Üç mühür: çatıya sancak!" | Sancağın üstü: harita önce sancağa kayar, balon harita içeriğinde durur (kaydırmayla gider), ok ucu bayrağın üstünde |

Haritadaki balonların ipucu kimliği ancak balon gerçekten gösterilince "görüldü" yazılır (harita kapandıysa ya da pencere açıldıysa harcanmaz).

Kaybettin ekranında mühürden söz edilmez (kayba odaklanmasın); kaybettiren son hamlede mühür uçuşu, sesi ve etiketi de çıkmaz.

### C.7 Metinler (`src/ui/metinler.ts`'e)
Kasaba, Fener Koyu Kasabası, Kandil, Yap, Yapıldı, "{n} eksik", "Önce 5 işi
bitir", "Önce {mahalle} süslensin", "Bölüm {n}'i aç", "Kandil yetti: {iş}
yapalım mı?", Mühürler, Çırak, Kalfa, Usta, "{Kademe} mührü!", "Sancak!",
"Mahalle şenliği", "+{n} kandil", "{fitil} parçası ({n} mühür)", C.4 durum
yazıları, C.6 balonları. Ekran okuyucu: rozet `aria-label="Mühürler: 2/3"`,
iş kartı "Pruva fenerleri, 1 kandil, yapılabilir".

### C.8 Ses ve titreşim
Yeni arayüz sesleri: `kasaba` (çan akoru C5-E5-G5 + 3 kısa tıkırtı),
`muhur` (90 Hz güm + çan G5; damga). Titreşim: mühür damgası 20 ms, uçuş
inişi 15 ms, iş tamam 20 ms, mahalle şenliği [30, 20, 60].

---

## D. Kayıt şeması (2 → 3)

### D.1 Yeni alanlar (`src/meta/kayit.ts`, `KAYIT_SURUMU = 3`)
```ts
BolumKaydi.muhur?: number        // 3 bitlik maske, yalnız kazanılmış 6–40
Kayit.kasaba: {
  isler: string[];               // yapılan işler (KASABA_ISLERI kimlikleri), sırayla
  gunlukKandil: number;          // 3/3 görev günlerinden kandil
  kandilGunleri?: number[];      // o günler (yyyymmdd, artan, ≤ 400; boşsa yok)
  uyarilan: string[];            // "Kandil yetti" uyarısı yapılmış işler
}
Kayit.muhurOdulleri: string[];   // verilmiş mühür parça basamakları ("carsi:5")
koleksiyon.kartlar += "kasaba:<mahalleId>"
```
Zarf sürümü (`ZARF_SURUMU = 1`) DEĞİŞMEZ (değişirse SaveStore eski kaydı okumaz).

### D.2 Göç 2 → 3 (`GOCLER[2]`, testli)
- `kasaba` boş, `muhurOdulleri` boş eklenir; başka hiçbir alan değişmez
  (test: göç sonrası eski alanlar birebir eşit; onarım 0 alan).
- Mühür geriye dönük verilmez (bölüm kayıtlarına `muhur` eklenmez).
- **Kandil başlangıç bakiyesi** türetmeyle gelir: kazanılmış her yıldız 1 +
  tamamlanmış her mahalle 3 (test: 12 bölüm × 2★ → 24 + 2·3 = 30 kandil).
  Mahalle bonusu eski oyuncuya da verilir: aynı ilerlemedeki yeni ve eski
  oyuncunun kandili eşit olsun.
- Zincir: 1 → 2 → 3 (GDD taslağı da taşınır, test).

### D.3 İlerleme puanı
`progressScore = yıldız·1000 + açık en yüksek (+ Sonsuz) + 5·mühür + 3·iş`.
Mühür + iş katkısı ≤ 669 < 1000: bir yıldızı geçemez. Eski kayıtta değer
şema 2 ile aynı (test) — bulutta eski sürümün yazdığı zarf puanıyla
karşılaştırma tutarlı kalır.

### D.4 `bolumSonucu` ek adımları (meta paketi)
1. **2b (bölüm kaydından sonra):** kazanç, ana, 6–40, `!ist.ustaEli`,
   `g.muhurler` varsa: `muhurBirlestir` → maske; yeni varsa ya da 6. bölümün
   ilk kazancıysa `Odul muhur { yeni, maske, tanitim: toplamMuhur(önceki) === 0 }`;
   maske bu kazançla 7 olduysa `Odul sancak`.
2. **2c:** mahallenin mühür sayısı 5/10/15 basamağını ilk kez geçtiyse ve
   `muhurOdulleri`'nde yoksa: `MUHUR_FITILLERI[m]`'nin en küçük eksik parçası
   koleksiyona; üçü de varsa +`TOZ_PARCA_BEDELI` toz; basamak kayda;
   `Odul muhurParcasi`.
3. **7b:** 3/3 görev parlak sandığı verildiği anda `gunlukKandilEkle`:
   `kasaba.gunlukKandil += 1` ve gün `kandilGunleri`'ne (aynı gün iki kez yok).
4. **11 (son):** `kandilDokumu(önceki).bakiye` ≠ yeni ise `Odul kandil
   { onceki, yeni, kaynak }` (kaynak = kazanılan farkının dökümü); kasaba bu
   kazançla açıldıysa `Odul kasabaAcildi { kandil }`.
Ödül sırası: yildiz → muhur → sancak → muhurParcasi → … mevcutlar … → kandil
→ kasabaAcildi (arayüz kandili şeridin başına alır).

### D.5 Onarım (`kayitOnar`, testli)
- `muhur`: 0..7 tamsayı; yalnız kazanılmış 6–40'ta kalır, aksi atılır.
- `kasaba.isler`: geçersiz/tekrar kimlik atılır; sıra kuralına aykırı (önceki
  mahalle bitmeden ya da taç erken) atılır; harcanan > kazanılan ise SON
  yapılan işlerden geri alınır.
- `muhurOdulleri`: `<mahalleId>:<5|10|15>`, İskele hariç, tekrarsız.
- Kart `kasaba:<mahalleId>` geçerli.
- `kandilGunleri`: geçerli, tekrarsız, artan, en çok 400 (en yeniler);
  `gunlukKandil` ∈ [gün sayısı, gün sayısı + 366] (tarihsiz kısım tavanlı:
  elle düzenlenmiş kayıt koduyla sınırsız kandil yok).

### D.6 Kayıt kodu ve önizleme
`FTL1:` kodu yeni alanları taşır (test: gidiş-dönüş eşit). İçe aktarma
önizlemesine (`KayitOnizleme`) `muhur`, `kasabaIs`, `kandil` eklendi; arayüz
satırı: "Mühür 23 · Kasaba 17/48 işi · 6 kandil".

### D.7 Birleştirme, ileri uyumluluk ve eski sekme (QA, testli: `app/kayitci.test.ts`)
- **Birleştirme** (`kancaBirlestir`, bulut + tarayıcı): mühür maskeleri VEYA;
  eksik işler kurallar/bütçeyle; günlük kandil = gün kümelerinin birleşimi +
  tarihsiz kısmın büyüğü (ayrı cihazda ayrı günlerde kazanılan kaybolmaz,
  ortak gün iki kez sayılmaz). Birleşim seçilenin (göç + onarım sonrası)
  aynısıysa seçilen ham veri döner; `pickMerged` anahtar sırasından bağımsız
  karşılaştırır (`kanonikJson`): yerel = bulut iken yeni zarf, "Bulut kaydı
  yüklendi" ve fazladan bulut yazımı yok.
- **İleri uyumluluk:** `kayitDeposuAyarlari().tooNew` (`surum` >
  `KAYIT_SURUMU`). Ana kayıt, buluttaki kayıt ya da yazmadan hemen önce
  tarayıcıdaki kayıt yeni bir şemadansa depo **salt okunur** olur (yerel ve
  bulut yazımı, yedek kaydırma yok); haritada "Oyunun yeni sürümü açıldı: bu
  sayfa ilerlemeni kaydetmiyor. Sayfayı yenile." Yeni şemalı veri birleştirilmez.
- **Eski sürümün açık sekmesi** (yayındaki şema 2 istemcisi) şema 3 kaydını
  bilmeden yazarsa: açılışta ana kayıt eski şemadan ve bir yedek (`yedek1`,
  `yedek2`) bu şemadansa yedeklerin mühürleri ve işleri `kancaBirlestir` ile
  geri eklenir ve yazılır. Ana kayıt bu şemadansa yedekler birleştirilmez
  (ilerlemeyi sıfırlama geri alınmasın). Bulut kaydı seçilse de yereldeki
  mühürler/işler eklenir (`bulutUygula`). Yayındaki eski istemcinin kendisi
  düzeltilemez: iki kaynağı birden ve yedekleri üç kez ezerse kayıp kalıcıdır.

---

## E. Uygulama paketleri ve kabul ölçütleri

| Paket | İçerik | Kabul |
|---|---|---|
| K1 Meta | §D.4 bolumSonucu adımları; defter.ts `kasaba` kart türü ve 8 kart; ipucu kimlikleri; testler | vitest: mühür birleşimi, sancak, parça basamakları (5/10/15, toz yedeği), günlük kandil, kandil ödülü, kasaba açılışı, Usta'nın Eli'nde mühür yok |
| K2 Oturum + HUD | oturum.ts: eylem sonu `muhurAnlik`, uçuş, rozet; kazançta `muhurler`; Duraklat listesi; Geri Sar | Telefon görünümünde uçuş ve rozet ekran görüntüsü (390×700); hareketi azalt |
| K3 Bölüm öncesi + Kazandın | C.2, C.5, tanıtım balonları | 390×700, 375×600, 360×640 ekran görüntüsü, Başla/Devam görünür |
| K4 Harita + Kasaba | alt bant düğmesi, panel (C.1), 8 çizim şablonu × 48 iş, sancak, şerit çipi, Mahalle şenliği, kasaba uyarısı ve oto-kart atlaması | Her mahalle 0/6 ve 6/6 ekran görüntüsü; panel 390×700'de kaydırmasız; eski Android kaydırma 60 fps (görünmeyen mahallede canlı öğe durur) |
| K5 Kalibrasyon | sim-cli `--muhur` (§A.7; `scripts/kanca/` betiklerinin işçili hâli), `dogrula` uyarısı | 105 mühür bantta ya da gerekçeli sapma notu; aile ile 2–3 insan oyunu (halka/zincir mühürleri). **Durum:** araç, statik kurallar ve 105/105 bant (üç bağımsız küme, §A.5) tamam; insan oyunu yapılmadı (aile denemesi bekliyor). |
| K6 Oynanış | `scripts/oynanis.mjs`'e: 3. bölüm sonrası Kasaba ilk iş, 6. bölüm mühür tanıtımı, bir mühür uçuşu, göçle gelen kayıt (`kayitYama` ile şema 2 kaydı) | pageerror yok; `build:single`; göçle yüklenen kayıtta yıldız/rozet/defter aynen |

Sıra: K1 → (K2, K3, K4 paralel) → K5 → K6.

**Durum (arayüz ve entegrasyon paketi):**
- K1 tamam: `bolumSonucu` 2b/2c/7b/11 (`ilerleme.ts`), `defter.ts` 8 kasaba
  kartı, `KANCA_IPUCU`, `muhurlerGorunur`; testler `kancaSonuc.test.ts`
  (mühür birleşimi ve tanıtımı, sancak bir kez, Usta'nın Eli/kayıp/öğretim/Usta
  Bölümü mühürsüz, ödül sırası, 5/10/15 parça ve toz yedeği, birleştirmeyle
  gelen mühürler sonraki kazançta, kandil ve kasaba açılışı) + günlük kandil
  (`ilerleme.test.ts`). Karar: kasaba açılmadan (1–2. bölüm) `kandil` ödülü
  çıkmaz; bakiye yine türetilir, 3. bölümde "Yıldızların kandile döndü!" 0'dan
  sayar.
- K2 tamam: Duraklat'a yapışık rozet (`MuhurRozeti`), eylem sonu uçuş (reaksiyon
  merkezi → nokta, damga, `muhur` sesi, 15 ms, "Kalfa mührü!"), ilk uçuşta
  `muhur-hud` balonu, Geri Sar rozeti geri alır, Usta'nın Eli'nde hepsi
  bozuldu; Duraklat'ta durum yazıları; kazançta final öncesi değerlendirme.
- K3 tamam: bölüm öncesi mühür bloğu (`muhur-kart` ipucu bir kez; ≤ 760 px'te
  "Yeni öğe" çipe küçülür, "En iyi" yıldız satırına taşınır, hedef kutuları
  yatay); Kazandın mühür satırı (önceden basılı sönük, yeniler 250 ms arayla
  damga + "YENİ", 3/3 "Sancak!"), tanıtım ipucu, kazanç şeridinin ilk çipi
  kandil (yıldız/mühür başına uçan kandil, sayaç önceki → yeni), "Kasabada
  yapılacak iş hazır!", mühür parçası duyurusu. Kandil varken şerit sandık ve
  tablodan önce (kısa ekranda düğmelerin arkasında kalmasın). 390×700 ve
  375×600 ekran görüntüleriyle denetlendi.
- K4 tamam: alt bantta Kasaba düğmesi (136/124 px, amber nokta + 1,5 Hz
  parıltı), alttan çekmece panel (sekmeler, sakin satırı, 6 iş kartı, durumlar,
  ilk işte el animasyonu), Yap akışı (kayıt → 240 ms → çapaya kayış →
  min(maliyet, 6) kıvılcım, sayaç aşağı sayar → ışıklar `--kd` gecikmesiyle →
  halka + parıltı + `kasaba` sesi + 20 ms → sakin balonu; 6/6'da şenlik ve
  kasaba kartı), haritada Kıvılcım Usta balonu (kasaba-ilk, kasaba-hosgeldin,
  "Kandil yetti", sancak-ilk; balonlu dönüşte oto-kart atlanır), Defter ve
  Ayarlar'da kasaba kartları.
- K6 tamam: `oynanis.mjs` telefon/masaüstü akışına ilk kandil, mühür
  tanıtımı ve mühür uçuşu; `goc` (390×700) ve `goc600` (375×600) profilleri
  yayındaki şema 2 sürümünün localStorage'ını kurup göçü, kasabayı, şenliği ve
  mühürlü bölümü dener; `kayitYama` eski şemalı kaydı göçle yükler.
  Koşu: telefon, masaüstü, küçük, goc, goc600 dev sunucusunda; küçük + goc
  `file://…/fitil.html`'de; küçük + goc600 claude.ai iskeletine sarılmış
  `dist-single/artifact.html`'de — hepsi pageerror/console.error olmadan geçti.
  Açık: 60 fps eski Android'de ölçülmedi (swiftshader); aile ile insan oyunu.

### Sözleşme kodu (P0, bu paket)
- `src/core/types.ts`: `MuhurKosulu`, `MuhurOlcusu`, `MuhurKapsami`,
  `MuhurEylemi`; `BolumVerisi.muhurler`.
- `src/meta/ozet.ts`: `HamleIzi`, `OyunOzeti.hamleIzleri` (final eklemez).
- `src/meta/muhur.ts`: koşul dili, `muhurOzeti`, `muhurDegeri`,
  `muhurleriDegerlendir`, `muhurAnlik`, maske yardımcıları, `muhurMetni`,
  `muhurKosuluDogrula`, `bolumMuhurDogrula`.
- `src/meta/kasaba.ts`: `KANDIL`, `kandilDokumu`, `kasabaIsDurumu`,
  `siradakiKasabaIsi`, `kasabaIsYap`, `kasabaUyarisi/Uyarildi`, `kasabaOnar`.
- `src/meta/kayit.ts`: şema 3, göç, onarım, `progressScore`, önizleme.
- `src/meta/ilerleme.ts`: `BolumSonucGirdisi.muhurler`, yeni `Odul` türleri
  (yalnız tip).
- `src/meta/harita.ts`: düğümde `muhur`/`sancak`, mahallede mühür/iş, kasaba.
- `src/ui/tipler.ts`: `MuhurVM`, `KasabaVM`, `KasabaIsVM`, `KasabaSecimi`, HUD,
  bölüm öncesi, Duraklat, Kazandın, harita alanları; `HaritaSecimi 'kasaba'`.
- `src/app/katalog.ts`: `KASABA_ISLERI` (48), `KASABA_SAKINLERI`,
  `MUHUR_FITILLERI`.
- `src/levels/veri/b006–b040.json`: `muhurler`; `dogrulayici.ts` denetler.
- Testler: `src/meta/kanca.test.ts`.
- Ölçüm: `npm run bot -- --muhur` (K5; ön ölçüm betikleri bununla değişti), `scripts/kanca/kasaba-ekonomi.py`.

---

## F. Riskler ve açık sorular
- **Mühür kovalarken kaybetmek** Coşku Serisi'ni bozar: bilinçli kabul (mühür
  isteğe bağlı; Kaybettin'de mühürden söz edilmez).
- **Bot amaç körü:** halka/zincir/özel taş mühürleri insan için daha kolay.
  K5'te aileyle denenip gerekirse eşik +1.
- **Üç birim karmaşası** (yıldız, toz, kandil): kandil yalnız Kasaba düğmesi,
  panel ve kazanç şeridinde; harita üst çubuğuna eklenmez.
- **Kazandın 700 px'te kalabalık:** mühür satırı yıldız bloğunda, kandil tek
  çip; sığmazsa sandık/tablo satırı küçülür (K3 ekran görüntüleri).
- **Harita performansı:** 48 süsün çoğu durağan SVG; canlı öğe mahalle başına
  ≤ 6 ve görünmezken durur.
- **Usta Bölümleri mühürü** ve "Mühürdar" rozeti (105/105) sonraki sürüm;
  `ROZET_IDLERI` yalnız eklenerek genişler.
