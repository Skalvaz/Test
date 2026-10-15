# EBRULİ çekirdeği (`src/core`)

Saf, belirlenimli kural motoru (GDD §3–§8, §13). DOM, `Date`, `performance`,
`Math.random` ve ondalık sabit yok; zaman birimi **tik** (normal hızda 1 tik =
1 ms); bütün rastgelelik `OyunDurumu.rng`'den (mulberry32). Diğer modüller
çekirdeğe **yalnız `index.ts`'ten** erişir. Tipler: `types.ts` (sözleşme).

## API

| İşlev | Ne yapar |
|---|---|
| `bolumuYukle(v, denemeNo)` | Başlangıç durumu. İlk tahta `v.tohum` akışından (her denemede aynı), ilk tahtaya garanti uygulanır; oyun akışı `oyunTohumu(tohum, denemeNo)`. Hatalı veride `BolumHatasi`. |
| `hamleHatasi(d, h)` | Geçersizlik nedeni (`HamleHatasi`) ya da `null` (§3.3). |
| `gecerliHedefler(d, kaynak)` | Kaynağın geçerli komşuları (K6: yalnız bunlar vurgulanır). |
| `gecerliHamleler(d)` | Bütün geçerli hamleler (karışım + özel taşa dokunan), kaynak indeksi sonra yukarı/sağ/aşağı/sol. |
| `hamleUygula(d, h)` | `{ durum, olaylar }`. Girdiyi **değiştirmez**; geçersizde `HamleHatasiIstisnasi`. |
| `onizle(d, h)` | Sürüklerken önizleme (§3.5): doğumsuz çözüm; `gecerli: false` ile fırlatmaz. < 0,05 ms (7×9). |
| `onizleDetay(d, h)` | Önizleme + doğumsuz sonraki durum, olaylar, puan artışı, üretilen özel taşlar (botlar). Geçersizde `null`. |
| `olumluHamleler(d)` | Hazır karışım hamleleri (ilk adımda grup), temizlenen damlaya göre azalan, eşitlikte (kaynak, hedef) indeksi. Boşta ipucu = `[0]` (§12.4). |
| `hazirHamleler(d)`, `hazirCiftSayisi(d)` | Hızlı hazır sayımı (indeksler / eşsiz çift sayısı); garanti ve botlar. |
| `ebruSoleni(d)` | Kazançtan sonra Ebru Şöleni (§8.3); `kalanHamle = 0`, `solenYapildi`; ikinci çağrı `EylemHatasi`. |
| `ustaEliUygula(d)` | Kayıptan sonra +5 hamle, `bitti = null`, en fazla 1★; ölü tahtada karıştırır. |
| `ilerlemeYuzdesi(d)`, `yildizHesapla(d, v)`, `durumKarmasi(d)` | HUD, yıldız, altın tekrar. |
| `gorselTahtaKur(d)`, `olayUygula(g, o, kati?)`, `olaylariUygula`, `gorselFark(g, d)` | Oynatıcı (aşağıda). |
| `karisimSonucu`, `gruplariBul`, `gecerliHamleVar`, `komboTuru`, `kaskatKademesi`, `ozelTuruBul` | Küçük saf kurallar. |
| `SABIT` | `PUAN`, `ZAMAN`, eşikler; ek zamanlar `OZEL_ZAMAN` (girdap hücresi +120, Lale açılışı 300, Lale birleşimi 80). |

Uygulama akışı: `d = bolumuYukle(v, deneme)` → sürüklerken `gecerliHedefler` +
`onizle` → bırakınca `hamleUygula` → çizici `oynat(d, olaylar, durum)` →
`d.bitti === 'kazanc'` ise `ebruSoleni(d)` ve yine `oynat`; `'kayip'` ise
kaybettin ekranı (3. ardışık kayıpta Usta'nın Eli).

## Çözümleme (§4.2) ve zaman çizelgesi (§4.9)

1. **Eylem** t = 0: `karisti` (sonra çözüm 220'de başlar) ya da `ozelSuruklendi`
   (taş ateşlemesi 120'de; bu ateşleme ve zinciri **adım 1**'dir, gruplar
   k = 2'den sayılır).
2. **Tur:** dolumsuz yerçekimi → grup varsa `yercekimi` (yalnız düşenler) +
   adım; yoksa **dolum** (doğum → yerçekimi, boş yuva kalmayana dek) → grup
   varsa adım, yoksa **garanti** (son dolumun doğanlarının rengi) ve döngü
   biter. Turun bütün düşenleri ve doğanları **tek** `yercekimi` olayıdır
   (`t`, sonraki aşama `t + 300`).
3. **Adım k** (t0): k ≥ 2 ise `kaskat`; her grup `eslesti` (t0); grup
   hücreleri `temizlendi` (t0 + 120) ve hemen ardından zemin olayları;
   `ozelOlustu` + `puanEklendi{ozel}`; gruba komşu mermer grup başına −1;
   gruptaki Tarak/Girdap ve gruba komşu Mürekkep **zaman sıralı kuyrukla**
   ateşlenir (kalkan taş +150 tik sonra). Adımın sonu: son olay + 250.
4. **Hamle sonu:** hedef ilerlemesi → `bolumBitti` (kazanç/kayıp) ya da ölü
   tahtada `karistirma` → `hamleOzeti` (her eylemin **son** olayı).

| Etki | Gecikme (ateşleme anından) | Animasyon süresi |
|---|---|---|
| Tarak (satır/sütun) | 25·d (d = merkeze uzaklık) | son hücre |
| Girdap (baklava, Manhattan ≤ 2) | 120 (hepsi) | 400 |
| Lale (rengin bütün damlaları) | 300 + 30·i (Manhattan sırası) | 300 + 30·n |
| Mürekkep (3×3) | 0 | 200 |
| Birleşim | +150, sonra türün gecikmesi; Lale birleşiminin taşları 300 + 80·i | |
| Şölen i. tarağı | 160·(i+1) | |

Olaylar `t`'ye göre **azalmayan** sıradadır; aynı t'dekiler listedeki sırayla
uygulanır. Sıra anlamlıdır: `temizlendi` → o hücrenin `kagitAlindi`,
`yagKalkti`, `desenBoyandi` (+ `puanEklendi`) → `hedefIlerledi`.
Hızlandırma (dokunma 2×, "Hızlı" 1,5×) yalnız çizicinin tik→ms ölçeğidir.

## Olay sözlüğü

| Olay | Ne zaman | Görsel tahta etkisi (`olayUygula`) |
|---|---|---|
| `karisti{kaynak, hedef, a, b, sonuc, yeniId}` | karışım eylemi | kaynak boşalır; hedef = `{yeniId, sonuc, sonuc===7 ? 'murekkep' : 'yok', 'yatay'}` |
| `ozelSuruklendi{kaynak, hedef, ozel, tasindi, ters, damla?}` | özel sürükleme eylemi | `tasindi`: kaynak boşalır (taş hedefe kayar ve **orada tüketilir**, `damla` taşın kendisi). Değilse (Lale/Mürekkep yerinde, `ters`) etki yok: taş ateşlenirken kendi `temizlendi`si ile kalkar. |
| `eslesti{renk, hucreler, k, merkez}` | adım başında her grup | yok (önkoşul: hücrelerde o renkte gruplanır damla) |
| `temizlendi{hucre, id, renk, ozel, neden, k, puan}` | grup, özel güç, Mürekkep, birleşim, şölen | hücre boşalır; puan += puan |
| `ozelOlustu{hucre, damla}` | 4/5/6'lık grup | boş hücreye özel taş |
| `ozelTetiklendi{hucre, ozel, yon, hedefRenk?, alan}` | taş ateşlenir | yok (taş önceden kalktı); `alan` canlandırma için |
| `birlesim{hucre, kombo, alan}` | özel + özel | yok |
| `donustu{hucre, damla}` | Lale birleşimi, şölen, karıştırmanın son çaresi | aynı kimlikli damla verilen damlaya döner |
| `mermerHasar{hucre, kalan}` | grup komşuluğu (grup başına), alan (adım başına bir) | can = kalan; 0 ise boşalır |
| `kagitAlindi{hucre, kalan, renk}` | kâğıtlı hücrede temizlik | kâğıt = kalan |
| `yagKalkti{hucre}` | yağlı hücrede temizlik | yağ = false |
| `desenBoyandi{hucre, renk}` | desen rengindeki damla temizlenince | boyalı = true |
| `kaskat{k, kademe}` | adım k ≥ 2 başı (guzel/nefis/harika/saheser) | yok |
| `yercekimi{dusenler, doganlar}` | tur sonu | bütün `den`ler okunur ve boşalır, `e`lere yazılır; doğanlar boş yuvalara (`sanalY` < 0: tahta üstü başlangıç satırı) |
| `karistirma{esleme}` | ölü tahta | eşleme aynı anda (permütasyon); son çarede boş + `donustu` |
| `hedefIlerledi{indeks, deger, tamam}` | ilerleten olayın hemen ardı; puan hedefi eylem sonunda | hedef = deger/tamam |
| `puanEklendi{miktar, neden, hucre?}` | özel üretimi, birleşim, engel, desen, şölen | puan += miktar |
| `solenBasladi{kalanHamle}` | şölen başı | yok |
| `hamleOzeti{temizlenen, kaskat, eslesme, merkez}` | her eylemin son olayı | yok |
| `bolumBitti{sonuc}` | hamle sonu | bitti = sonuc |

Δpuan = Σ `temizlendi.puan` + Σ `puanEklendi.miktar`. Grup damlası 30·k,
özel güç 20, Mürekkep 15, Tarak/Girdap/Lale üretimi 200/400/800, birleşim
+300 (Lale içeren +600), kâğıt katı 50, mermer canı 40, yağ 20, desen 100,
şölen kalan hamle başına 300.

## Çizici görsel tahtayı nasıl günceller

```ts
const g = gorselTahtaKur(d);              // bölüm başında
// oynatma: her olay zaman çizelgesinde gerçekleştiği anda
olayUygula(g, o, import.meta.env.DEV);    // katı kip: önkoşul ihlalinde OynaticiHatasi
// oynatma sonunda
const fark = gorselFark(g, sonraki);      // geliştirmede boş değilse console.error
```

- Görsel tahta **yalnız olaylarla** ilerler; bulanık test (`oynatici.test.ts`,
  300 rastgele oyun, 20 olay türünün ve 10 birleşimin hepsi) her eylemden sonra
  `gorselFark` boş olduğunu ve her olayın önkoşulunu bulduğunu doğrular.
- Olaylardan çıkmayanlar (HUD `sonraki`den okur): `kalanHamle` (hamle −1,
  Usta'nın Eli +5, şölen sonunda 0), Usta'nın Eli'nde `bitti = null` (uygulama
  görsel tahtada sıfırlar), istatistik, RNG, temizlik günlüğü.
- Canlandırma ipuçları: `temizlendi.ozel/renk` (sıçrama rengi), `eslesti.merkez`
  (damlaların aktığı hücre), `ozelTetiklendi.alan` (süpürme/çöküş),
  `ozelSuruklendi.damla` (kayan taşın çizimi), `yercekimi.doganlar[].sanalY`.

## Belirlenimlilik ve RNG sırası (§4.10)

Dolum (soldan sağa sütun, aşağıdan yukarı yuva) → garanti karıştırmaları
(yalnız son dolumda) → ölü tahta karıştırması → şölen seçimleri. Önizleme RNG
tüketmez. İlk tahta ayrı akış (`tohum`). `durumKarmasi` (FNV-1a) altın
tekrarlar içindir (`altin.test.ts`).

## Dosyalar

`hamle.ts` (geçerlilik, eylem, hamle sonu) · `cozum.ts` (tur döngüsü, temizlik
adımı) · `ozel.ts` (alanlar, kuyruk, birleşimler, özel sürükleme) ·
`yercekimi.ts` (düşme, çapraz kayma, dolum; tip dizilerinde, hızlı sayımla
ortak) · `baglam.ts` (olay listesi, adım tamponu, temizlik + zemin) ·
`hedef.ts` · `garanti.ts` · `hazir.ts` · `karistir.ts` · `onizle.ts` ·
`solen.ts` · `oynatici.ts` · `bolumYukle.ts` · `tahta.ts` · `rng.ts` ·
`sabitler.ts` · `testAraclari.ts` (yalnız testler).

## Ölçümler (7×9, D3, garanti 2; `npm run bot -- --olcum`)

`hamleUygula` ortanca 0,26 ms (p99 3,7 ms), `onizle` ortanca 0,016 ms,
`olumluHamleler` ortanca 0,36 ms. Bot (60 + 60 oyun, 25 hamle, 22 Mor):
hamle öncesi ≥ 2 hazır %98, 0 hazır %1,1, Acemi eşleşen hamle %70, garanti
hamlelerin %26'sında devrede, Tarak 0,18/hamle (GDD §0.1 ile uyumlu).
