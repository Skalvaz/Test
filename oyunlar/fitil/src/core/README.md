# FİTİL çekirdeği (`src/core`)

Saf kurallar motoru: GDD §3–§7 ve §16.2–§16.4. DOM, `Date`, `performance`,
`Math.random` ve ondalık sabit yoktur; zaman birimi **tik**tir (normal hızda
1 tik = 1 ms, ölçeklemeyi çizici yapar). Bütün dış erişim `index.ts`
üzerindendir. Bağlayıcı belge `docs/GDD.md`; aşağıdaki § numaraları oraya
atıftır.

## API

| İşlev | Ne yapar |
|---|---|
| `bolumuYukle(v, denemeNo, {cosku?})` | Bölüm verisinden başlangıç durumu (§8.1). İlk tahta `tohum` akışından (her denemede aynı), oyun RNG'si `oyunTohumu(tohum, denemeNo)` (her deneme taze). Kilitliyse §3.8 karıştırması yine `tohum` akışından. |
| `yolDogrula(d, yol, halka)` | Bırakılan yol geçerli mi (§3.3): `null` ya da `'kisa' \| 'renk' \| 'komsu' \| 'tekrar' \| 'halkaGerekli' \| 'capraz' \| 'zincirlenemez'`. Geçersiz halka `'komsu'` döner. |
| `onizle(d, yol, halka)` | Çizerken önizleme (§3.9): eşiğe ulaşacak hücreler (yalnız ilk dalga), ısınacaklar, özel taş hayaleti, etki alanları, kombinasyon. Kısmi yolda fırlatmaz. |
| `hamleHatasi(d, h)` | Hamle geçersizse neden (`'bitti'`, `'hamleYok'`, yol hataları, `'ozelDegil'`, `'korukKapali'`, `'korukDoluDegil'`, `'konum'`, `'guclendiriciSiniri'`, `'duzKapsulDegil'`, `'eksen'`), geçerliyse `null`. |
| `hamleUygula(d, h)` | Eylemi çözer → `{ durum, olaylar }`. Girdiyi değiştirmez (derin kopya). Geçersiz hamlede `HamleHatasi` fırlatır. Hamleler: `fitil`, `ciftDokunus` (1 hamle), `koruk`, `kibrit`, `kalip` (0 hamle). |
| `finalGosterisi(d)` | Kazançtan sonra uygulama ayrıca çağırır (§7.3). `hamleUygula` yalnız `bolumBitti{kazanc}` yazar. İkinci kez çağrılırsa fırlatır (`finalYapildi`). Sonunda `kalanHamle = 0`. |
| `ustaEliUygula(d)` | Kıvılcım Usta'nın Eli (K16): kayıp durumdan +5 hamleyle devam, `bitti = null`, denemede bir kez. Tahta kilitliyse karıştırır. |
| `kilitliMi(d)` | §3.4 kilitlenme testi (özel taş varsa false; `yalnizHalka`'da 4'lü döngü; `caprazSiniri` 0/1'de sınıra uyan 3'lü yol). |
| `ilerlemeYuzdesi(d)`, `yildizHesapla(d, bolum)` | §6 yüzde; §7.4 yıldız (güçlendirici → en fazla 2★, Usta'nın Eli → en fazla 1★). |
| `durumKarmasi(d)` | FNV-1a 32 bit; altın tekrarlar ve bot için. |
| `gorselTahtaKur`, `olayUygula`, `olaylariUygula`, `gorselFark` | Olaylardan görsel tahta (aşağıda). Çizicinin başvuru indirgeyicisi. |
| Yardımcılar | `zincirRengi`, `eksenBul`, `ozelTuruBul`, `enCokRenk`, `komboTuru`, `patlamaPuani`, `reaksiyonKademesi`, `rngSonraki`/`rngInt`/`oyunTohumu`, `SABIT` (bütün kural sabitleri). |

### Tipik akış (uygulama)

1. `d = bolumuYukle(v, denemeNo)`; çizici `bolumKur(d)`.
2. Çizim sırasında her örnekte `onizle(d, yol, halka)`.
3. Bırakınca `hamleHatasi`; `null` ise `{durum, olaylar} = hamleUygula(d, h)`,
   çizici `oynat(d, olaylar, durum)`; `d = durum`.
4. `d.bitti === 'kazanc'` → `finalGosterisi(d)` ve yine `oynat`. `'kayip'` →
   kaybettin ekranı; Usta'nın Eli seçilirse `ustaEliUygula(d)`.
5. Geri Sar (§9) uygulamadadır: son hamleden önceki durumun kopyasına dönülür
   (RNG dahil) ve kopyada `istatistik.guclendirici` 1 artırılır; yoksa
   güçlendirici sınırı (bölüm başına 1, çekirdek denetler) aşılabilir.
   `zorunluIlkHamle` (§15) girdi katmanında denetlenir.

## Zamanlama (tik)

- Fitil (§3.5.1): `t₀ = 0`, `t_k = t_{k−1} + max(35, 110 − 7·k)` (k 0 tabanlı).
  6 düğüm: 0, 103, 199, 288, 370, 445; 10 düğüm toplam 675.
- Isı patlaması: eşiği geçiren `isindi`den **90** sonra, nesil g+1.
- Roket: hücre başına **25** (d geometrik uzaklık, delikler atlanır ama sayılır).
- Kasımpatı: komşu vuruşu **+30**, ısı dalgası (r = 2) **+60**.
- Yıldız topu: i. hedef **+20·(i+1)**.
- Kombinasyon: yıldız hattı ve kalın roket 25·d; dev kasımpatı 30·d, ısı
  halkası (r = 3) +90; roket yağmuru / bahçe i. taş **+40·(i+1)**; büyük final
  40·d (Chebyshev).
- Barut izi: adım başına **60**. Dev fişek: dolduğu andan **+150**'de fırlar,
  üstündeki hücreler +150 + **30**·(y − y′).
- Final (§7.3): i. roket **120·i**; özel taş turlarında j. taş **+80·j**.
- **Hamle sonu:** kuyruk boşalınca saat = son olayın t'si. Yerçekimi o anda
  yazılır; bir şey düştü ya da doğduysa sonraki aşamalar (fener toplama, is,
  hava, körük, hedef, karıştırma, reaksiyon) **`YERCEKIMI_PAYI` = 350** tik
  sonra gelir, çizici düşmeyi canlandırabilsin. Fener toplanırsa yeni
  yerçekimi aynı anda ve +350 sonra devam edilir (en fazla 10 tur).
- Olaylar `t`'ye göre **azalmayan** sıradadır; aynı `t`'deki olaylar listedeki
  sırayla uygulanır (sıra anlamlıdır: önce `patlama`, sonra onun kafes, zemin,
  özel etki, komşu ısısı ve bitişik hasar olayları).

## Olay sözlüğü

Her olayın `t` alanı vardır. "Tahta" sütunu, `olayUygula`nın görsel tahtaya
yaptığı değişikliktir (— = yalnız görsel/işitsel).

| Olay | Ne zaman | Alanlar | Tahta |
|---|---|---|---|
| `fitilBasladi` | Fitil hamlesinin ilk olayı, t = 0 | `yol`, `halka`, `renk` (etkin zincir rengi; tamamı jokerse bırakma anındaki en çok renk) | — |
| `dugumYandi` | Alev k. düğüme ulaştı (dönüşen son düğüm dahil) | `hucre`, `k` (1 tabanlı) | — |
| `patlama` | Kapsül tahtadan ayrılıyor (PATLAT) | `hucre`, `renk`, `ozel`, `neden` (`fitil`, `isi`, `vurus`, `iz`, `devFisek`, `final`, `kibrit`), `nesil`, `puan` (taban puan), `k` (fitil düğümüyse sıra, yoksa 0) | içerik boşalır, `isikIzi` yanar, puan += `puan` |
| `kafesKirildi` | Patlayan kapsülün kafesi | `hucre` | kafes kalkar |
| `dosemeAydinlandi` | Patlamanın hücresindeki döşeme −1 | `hucre`, `kalan` | `doseme = kalan` |
| `desenBoyandi` | Desen renginde (ya da yıldız topu) patlama | `hucre`, `renk` | `desenBoyali` |
| `izYandi` | Barut izi hücresi tutuştu ya da iz ilerledi (ilerlemede ardından o hücreye vuruş) | `hucre` | o iz hücresi yandı |
| `ozelTetiklendi` | Patlayan özel taş kendi etkisini başlattı (patlamasının hemen ardından) | `hucre`, `ozel`, `eksen`, `hedefRenk?` (yıldız topu) | — |
| `yuklendi` | Kombinasyonun S1'i: patladı, etkisi bekletiliyor | `hucre`, `ozel` | — |
| `kombinasyon` | S2 patladı, birleşik etki S2'de başlıyor | `hucre`, `kombo` | — |
| `ozelOlustu` | Kapsül özel taşa döndü: dönüşüm (son düğüm, `isi` 0), kalıp (t = 0), roket yağmuru / bahçe (T), final roketleri (t = 0), karıştırma son çaresi | `hucre`, `ozel`, `eksen`, `renk`, `isi` | içerik o özel taş (kafes korunur) |
| `isindi` | ISIT: patlama komşusu, kasımpatı dalgası, körük | `hucre`, `isi` (yeni; eşiği aşabilir), `kizgin` (`isi ≥ eşik−1`) | ısı = `isi`; `isi ≥ eşik` ise 90 sonra `patlama{isi}` gelir |
| `isiDegisti` | Doğrudan ısı ataması: meltem, çisenti, soğuma (hamle sonu) | `hucre`, `isi` | ısı = `isi` |
| `isiDalgasi` | Kasımpatı (r 2) / dev kasımpatı (r 3) ısı dalgası anı | `merkez`, `yaricap` | — |
| `engelHasar` | Kaya/kova bitişik patlama ya da vuruşla −1 kat | `hucre`, `engel`, `kalan` | `kalan` 0 → içerik boşalır, değilse kat |
| `kurudu` | Islak barut bitişik patlama/vuruşla kurudu | `hucre`, `renk` | düz kapsül {renk, ısı 0} |
| `devFisekDoldu` | Dev fişek +1 (her artışta) | `hucre`, `dolum`, `kapasite` | dolum |
| `devFisekFirladi` | Dolu dev fişek fırladı (+150) | `hucre` | içerik boşalır |
| `isTemizlendi` | İs bitişik patlama/vuruşla temizlendi | `hucre` | içerik boşalır |
| `isYayildi` | Hamle sonu is yayılması (§5) | `hucre` | içerik `is` |
| `yercekimi` | Hamle sonu her yerçekimi turu (bir şey olduysa) | `dusenler[{den, e}]`, `doganlar[{hucre, icerik, sanalY}]` (`sanalY` −1, −2… tahta üstü başlangıç satırı; en alta inen −1) | önce bütün `den`ler okunup boşaltılır, sonra `e`lere yazılır; doğanlar boş yuvalara |
| `fenerToplandi` | Çıkış yuvasındaki fener (hamle sonu) | `hucre` | içerik boşalır |
| `havaOlayi` | `uyari: false`: hat tetiklendi (ardından `isiDegisti`ler); `uyari: true`: sayaç 1, hat sonraki hamlede tetiklenecek (titreme) | `olay`, `eksen`, `hat`, `uyari` | — |
| `karistirma` | Kilitlenme (§3.8), hamle sonu ya da Usta'nın Eli | `esleme[{den, e}]` (permütasyon), `yenidenRenk[{hucre, renk}]` | eşleme aynı anda uygulanır, sonra yeniden renkler |
| `hedefIlerledi` | Hedef ilerlemesi ya da `gerekli` değişti | `indeks`, `deger`, `tamam`, `gerekli` | hedef durumu |
| `puanEklendi` | Patlama dışı puan | `miktar`, `neden` (`halka`, `reaksiyon`, `kalanHamle`, `diger`), `kademe?`, `hucre?` (kaynak) | puan += `miktar` |
| `korukDoldu` | Hamle sonu (adım 5), dolum her arttığında | `dolum`, `kapasite` | körük dolumu; `dolum === kapasite` → "doldu" kutlaması |
| `korukKullanildi` | Körük eylemi, t = 0 | `merkez` | dolum 0 |
| `guclendirici` | Kibrit/kalıp eylemi, t = 0 | `guc`, `hucre` | — |
| `finalBasladi` | Final Gösterisi'nin ilk olayı | `kalanHamle` | — |
| `bolumBitti` | Hamle sonu hedef kontrolü (§3.5.4 adım 6) | `sonuc` | bitiş |
| `reaksiyon` | **Her eylemin son olayı** (Usta'nın Eli hariç) | `boyut` (R), `zirveT`, `merkez`, `kombo`, `kademe` | — |

Puan: bir eylemde Δpuan = Σ `patlama.puan` + Σ `puanEklendi.miktar`.
`patlama.puan` taban puandır (§7.1: fitil 10·k, ısı 20·g, vuruş 15); engel,
kafes, döşeme, desen, özel taş oluşumu, kombinasyon, fener, dev fişek, halka,
reaksiyon bonusu ve kalan hamle ayrı `puanEklendi` olaylarıdır.

## Çizicinin görsel tahtası

§16.1: çizici çekirdeğe yazmaz, kendi tahtasını yalnız olaylarla günceller.
`oynatici.ts` bunun başvuru indirgeyicisidir:

```ts
const g = gorselTahtaKur(onceki);            // bölüm başı ya da eşitleme
for (const o of olaylar) {                    // her olay, zaman çizelgesinde t anına gelince
  olayUygula(g, o, gelistirmeKipi);           // katı kipte önkoşul ihlali → OynaticiHatasi
  // … o olayın canlandırması/sesi (olayDinle)
}
if (gelistirmeKipi) console.assert(gorselFark(g, sonraki).length === 0);
```

- Önkoşullar (katı kip): patlayan hücrede aynı renk/özel kapsül; hasar alan
  engelin katı `kalan + 1`; dev fişek dolumu bir artar; düşen içerik hareketli
  ve hedef yuva boş; karıştırılan hücreler kafessiz kapsül; vb. Yani olayı
  canlandırmak için gereken kaynak bilgi her zaman görsel tahtadadır.
- Olaylardan çıkmayanlar: `kalanHamle` (uygulama hamleyi bilir: fitil ve çift
  dokunuş −1, Usta'nın Eli +5 ve `bitti = null`, final sonunda 0), istatistik,
  RNG, hava sayaçları, fener doğum sayacı. HUD bunları `sonraki`den okur.
- `oynatici.test.ts`: 300 rastgele oyunda görsel tahta yalnız bölüm başından
  kurulur, oyun boyunca hiç eşitlenmeden olaylarla ilerler ve her eylemden
  sonra `gorselFark` boştur; bütün olay türleri en az bir kez oynatılır.

## Belirlenimlilik ve RNG (§16.3)

- mulberry32, durum `OyunDurumu.rng` (uint32). `rngInt(n) = ⌊r·n / 2³²⌋`;
  ağırlıklı seçim tamsayı kümülatif toplamla.
- Tüketim sırası: her yerçekimi turunda dolum (soldan sağa sütun, aşağıdan
  yukarı yuva) → fener doğumu → yardım yeniden çekimleri; sonra is yayılması
  → karıştırma; final ayrı eylemde (roket seçimi: hücre, sonra eksen; ardından
  yerçekimi turları).
- Kuyruk anahtarı `(t, y, x, sıra)`; "ilk plan kazanır": bir hücre bir
  eylemde en fazla bir kez planlanır ve patlar (final turlarında her
  yerçekiminden sonra bayraklar yenilenir).

## Uzlaştırma kararları (çekirdek ↔ şartname testleri)

GDD'nin belirsiz/çelişkili yerlerinde seçilen okumalar kodda § atfıyla
yazılıdır; başlıcaları `spec/uzlasma.test.ts` ile sabitlendi:

- İs temizleme toplam **+30** (§5, `PUAN.isTemizle`); §7.1'deki "20 + 50"
  uygulanmaz (tasarımcı onayı açık).
- Çift dokunulan özel taş: nesil 0, `neden: 'vurus'`, 15 puan, R'ye girer.
- Kafesli özel taş çift dokunulamaz ve kilidi açmaz.
- `kilitliMi`, `caprazSiniri` 0/1 iken sınıra uyan bir 3'lü yol arar
  (§3.4'ün bileşen testi yalnız çaprazla bağlı üçlüyü kilitsiz sayıp oyunu
  takılı bırakıyordu; `yalnizHalka`'da döngünün yol adımları da sınırlanır).
- Güçlendirici sınırı (bölüm başına 1) çekirdekte; Geri Sar uygulamada.
- Körük merkezi tahta içinde, delik olmayan hücre; körük ve güçlendiriciler de
  reaksiyon bonusu ve zincirleme hedefi alır, final almaz.
- Karıştırmanın §3.8'de olmayan son çaresi (RNG'siz boyama, o da yoksa roket)
  sonlanmayı ve kilitsizliği garanti eder.

## Testler

- `spec/*.test.ts`: GDD şartname testleri (yalnız `index.ts` API'si; test
  adları § atıflı; kurucu `spec/kur.ts` mini dili).
- `*.test.ts` (kök): birim testleri, `bulanik.test.ts` (FUZZ_N, varsayılan
  300) ve `oynatici.test.ts` (FUZZ_N ile ölçeklenir), `altin.test.ts` (anlık
  görüntü; kural bilerek değişince `npx vitest run -u` ve farkı incele).
- Linux'ta `FUZZ_N=3000 npx vitest run`; PowerShell'de
  `$env:FUZZ_N=3000; npx vitest run`.
