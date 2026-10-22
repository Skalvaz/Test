# FİTİL — Aşama 2 şartnamesi: can, ödüllü reklam, küçük satın alma

`docs/YAYIN.md` aşama 2. Ürün sahibinin kararı (22 Ekim 2026): Android
sürümünde can sistemi + yalnız istekle ödüllü reklam + küçük satın alma.
Bu aşama bütün akışları **sağlayıcıdan bağımsız** kurar ve web'de **sahte
sağlayıcıyla** (`?gelir=sahte`) dener; gerçek AdMob + Play Billing köprüsü
aşama 3'tür (Capacitor).

## 1. Kapsam ve ilkeler

- **Can yalnız gelir sağlayıcısı varken vardır** (Android uygulaması, deneme
  için `?gelir=sahte`). claude.ai sayfası ve tek dosya `fitil.html`'de
  sağlayıcı yok: can, reklam, mağaza ve ilgili her öğe görünmez; oyun bugünkü
  gibidir (GDD §10.8 "yoktur" orada geçerli kalır).
- Yasaklar (GDD §11, YAYIN.md): zorunlu ara reklam, afiş reklam, süreli FOMO
  ("1 saat kaldı!"), can dolunca bildirim, gizli dinamik zorluk, şans kutusu
  satışı, satın almadan bitirilemeyen bölüm. Reklam düğmesi yalnız reklam
  hazırken görünür; oyuncu her zaman "Bekle" diyebilir.
- Gündelik oyuncu hiç reklam izlemeden ve satın almadan ilerleyebilmeli:
  canlar cömert, dolum hızlı, öğretim ve İskele ücretsiz, kazanç can yemez.
- Kasaba, kandil, mühür ekonomisi değişmez; reklam/satın alma kandil vermez.

## 2. Can kuralları

| Kural | Değer (varsayılan, §9) |
|---|---|
| En çok can | 5 (C2) |
| Dolum | can < 5 iken her 30 dk'da +1 (C2) |
| Can harcayan bölüm | ana bölüm ≥ 6 ve Usta Bölümleri (C3) |
| Ücretsiz | öğretim + İskele (1–5), Günün Şenliği, Sonsuz Şenlik (C3) |
| Kayıp | 1 can gider (C4) |
| Bölüm ortasında çıkış / yeniden başla (≥ 1 hamle) | 1 can gider, önce onay (C4) |
| Kazanç | can gitmez |
| Devam edip kazanmak (Usta'nın Eli ya da reklamla +5) | kayıpta giden can geri gelir (C4) |
| 0 can | bölüm başlamaz, Tekrar dene yerine "Can bitti" paneli (C5) |

Ayrıntılar:

- **Dolum zamanı** `can.dolumBasi` (ms): can < 5 olduğu an başlar; her
  `CAN_DOLUM_MS` geçişinde +1 ve `dolumBasi` ileri kayar; 5'e varınca
  `null`. Hesap tembeldir (`canDurumu(k, simdi)` okurken uygular), saat geri
  giderse (simdi < dolumBasi) `dolumBasi = simdi` (eksi süre yok, ceza yok).
- **Kayıp anında düşer** (çökme/kapatma güvenli): `kayip()` sonucu kaydederken
  `canHarca` uygulanır, Kaybettin "−1 can · 3 can kaldı" gösterir. Aynı
  denemede devam (Eli ya da reklam) sonrası ikinci kayıp yeniden düşürmez;
  devamdan sonra kazanç `canIade` ile 1 geri verir (5'i aşmaz).
- **Çıkış:** Duraklat > Haritaya dön / Yeniden başla, hamle yapıldıysa ve
  bölüm can harcıyorsa önce sayfa içi onay ("Bölümden çıkarsan 1 can gider.
  Çık / Vazgeç"); onaylanınca düşer. Uygulama bölüm ortasında kapanırsa can
  düşmez (terk; ölçüm bunu ayrıca görür).
- **Tavan aşımı:** satın alma ve reklam canı 5'i aşmaz (dolu iken reklamla can
  teklif edilmez; "Canları doldur" 5'te gizli).

## 3. Ödüllü reklam

İki yer, ikisi de yalnız oyuncu isteyince:

1. **Can bitti → "Reklam izle: +1 can"** (C6): günde 3 kez (yerel takvim günü,
   `can.reklamGun` + `can.reklamSayisi`), can < 5 iken. Panel kalan hakkı
   gösterir ("2 hak kaldı"), hak bitince düğme yerine "Yarın yine" yazar.
2. **Kaybettin → "+5 hamle (reklam)"** (C7): denemede bir kez. Usta'nın Eli
   sunuluyorsa (4+ ardışık başarısızlık) yalnız ücretsiz Eli görünür, reklam
   teklifi yok. Kurallar Eli ile aynı (`ustaEliUygula`): en çok 1★, mühür
   basılmaz; HUD ve Kazandın bunu Eli gibi gösterir. Günün Şenliği'nde
   sunulmaz (Eli gibi; paylaşım ızgarası adil kalsın), Sonsuz Şenlik'te
   sunulur. Ölçümde `bolum_bitti`'ye `reklam: true` eklenir (Eli'den ayrılsın).

Sonuçlar: `odul` → ödül hemen verilir ve kayıt hemen yazılır; `iptal` (oyuncu
reklamı erken kapattı) → ödül yok, panel yerinde kalır; `yok` / `hata` →
"Şu an reklam yok" bildirimi, düğme gizlenir. Reklam açıkken oyun sesi kısılır,
çizici durur (`cizici.dev.dondur`).

**Usta kartı** sahibi (§4) reklam düğmelerinin yerinde aynı ödülü reklamsız
alır ("+1 can", "+5 hamle"), aynı günlük ve deneme sınırlarıyla.

## 4. Küçük satın alma

| Ürün (`UrunId`) | Tür | İçerik | Fiyat önerisi (Play Console'da yerel) |
|---|---|---|---|
| `can_doldur` | tüketilir | canları 5'e doldurur | $0.99 |
| `guclendirici_paketi` | tüketilir | 3 Kibrit + 2 Fişek Kalıbı + 2 Geri Sar | $1.99 |
| `usta_karti` | kalıcı | ödüllü reklamların ödülü reklamsız | $4.99 |

- Fiyat metni her zaman mağazadan gelir (`Urun.fiyat`, yerel biçimli); kodda
  fiyat yazılmaz.
- **Güçlendirici paketi:** satın alınan stok, güçlendirici henüz açılmamış
  olsa da stokta kalır (toza dönmez; `guclendiriciVer_yerinde`'nin
  "açılmamış → toz" kuralı yalnız oyun içi hediyeler için). Stok sınırı
  (`GUCLENDIRICI_STOK_SINIRI`) satın almada da geçerli; sınırı aşacaksa paket
  düğmesi "Stok dolu" der ve satılmaz.
- **Çifte verme koruması:** başarılı satın alma jetonu `gelir.jetonlar`'a
  (son 50) yazılır; aynı jeton ikinci kez ödül vermez. Ödül önce kayda yazılır,
  sonra `tamamla(jeton)` (tüketme/onaylama) çağrılır; açılışta tamamlanmamış
  satın almalar `bekleyenler()` ile yeniden işlenir.
- **Geri yükleme:** Mağaza'da "Satın alımları geri yükle" → `geriYukle()`
  kalıcı ürünleri (`usta_karti`) verir.
- Mağaza'ya giriş: Ayarlar'da "Mağaza" satırı ve Can bitti paneli. Haritada
  ayrı mağaza düğmesi yok (ilk mahallelerde satış baskısı olmasın); can hapına
  dokununca Can bitti/can paneli açılır.

## 5. Sağlayıcı arayüzü (`src/platform/gelir.ts`)

```ts
export type ReklamYeri = 'can' | 'hamle';
export type ReklamSonucu = 'odul' | 'iptal' | 'yok' | 'hata';
export type UrunId = 'can_doldur' | 'guclendirici_paketi' | 'usta_karti';
export interface Urun { id: UrunId; fiyat: string; }
export type SatinAlmaSonucu =
  | { durum: 'basarili'; urun: UrunId; jeton: string }
  | { durum: 'iptal' | 'beklemede' | 'hata' };
export interface GelirSaglayici {
  readonly ad: 'sahte' | 'android';
  reklamHazir(yer: ReklamYeri): boolean;
  reklamGoster(yer: ReklamYeri): Promise<ReklamSonucu>;
  urunler(): Promise<Urun[]>;
  satinAl(id: UrunId): Promise<SatinAlmaSonucu>;
  tamamla(jeton: string): Promise<void>;
  bekleyenler(): Promise<{ urun: UrunId; jeton: string }[]>;
  geriYukle(): Promise<UrunId[]>;
}
/** Sağlayıcı yoksa null: can sistemi ve bütün gelir arayüzü kapalı. */
export function gelirSaglayici(): GelirSaglayici | null;
```

- Seçim: `window.FitilYerel?.gelir` varsa Android köprüsü (aşama 3; bu
  aşamada yalnız arayüz ve köprü sözleşmesi, `docs/CAN-REKLAM.md` §5.1);
  `?gelir=sahte` (ya da `localStorage` `fitil.gelir` = `sahte`, test için)
  sahte sağlayıcı; aksi halde `null`.
- **Sahte sağlayıcı:** reklam = tam ekran DOM katmanı ("Deneme reklamı",
  5 sn geri sayım, sonra "Ödülü al"; erken "Kapat" = `iptal`), fiyatlar
  "₺29,99 / ₺59,99 / ₺149,99", satın alma sayfa içi onay kartıyla anında
  `basarili`. Test anahtarları: `?reklam=yok|hata|hizli` (hızlı: 300 ms),
  `?satin=iptal|hata`.
- 5.1 **Android köprü sözleşmesi** (aşama 3 Capacitor eklentisi uygular):
  `window.FitilYerel.gelir = { reklamHazir(yer): boolean, reklamGoster(yer):
  Promise<string>, urunler(): Promise<string /*JSON*/>, satinAl(id):
  Promise<string /*JSON*/>, tamamla(jeton): Promise<void>, bekleyenler():
  Promise<string>, geriYukle(): Promise<string> }`; köprü sarmalayıcısı JSON
  çözer, beklenmeyen değerde `hata` döner, hiçbir durumda oyunu durdurmaz.

## 6. Arayüz ("Liste" okunaklılığı; metin kısa, iki dil)

- **Can hapı** (harita üst çubuğu, sol, yıldızın yanında; yalnız can varken):
  kalp yerine **kıvılcımlı fitil** simgesi (oyunun dili; ikonlar.ts'e SVG) +
  sayı; can < 5 iken altında "12:31" (sonraki can). Dokununca can paneli.
- **Can paneli / Can bitti** (`src/ui/ekranlar/can.ts`, modal): başlık
  "Canların bitti" ya da "Canlar 3/5"; büyük sayaç "Sonraki can 12:31"
  (canlı); satırlar: [Reklam izle · +1 can] (hak varsa ve reklam hazırsa;
  "2 hak kaldı"), [Canları doldur · ₺29,99] (can < 5 ise), [Bekle] (kapatır).
  Usta kartı sahibinde reklam satırı "Ücretsiz +1 can".
- **Kaybettin:** başlık altına tek satır "−1 can · 3 kaldı" (yalnız can
  harcayan bölümde); Usta'nın Eli yoksa "+5 hamle" düğmesi (reklam simgeli;
  Usta kartıyla simgesiz). 0 can kaldıysa "Tekrar dene" yerine "Can bitti"
  (paneli açar). Satır sayısı en çok bir artar.
- **Duraklat çıkış onayı:** sayfa içi kart ("Bölümden çıkarsan 1 can gider."
  [Çık] [Vazgeç]); yalnız gerektiğinde.
- **Mağaza** (`src/ui/ekranlar/magaza.ts`, Ayarlar > Mağaza): üç ürün
  satırı (simge, ad, tek satır açıklama, fiyat düğmesi), altta "Satın
  alımları geri yükle". Usta kartı alınmışsa satırı "Sende var" der.
- **Sahte reklam katmanı** sağlayıcının içindedir (arayüz değil); görünüşü
  sade, "DENEME" etiketli.
- **Hakkında metni** bugün "Can yok, bekleme yok, mağaza yok." diyor:
  sağlayıcı varken bu cümle yerine "Canlar 30 dakikada dolar; reklam yalnız
  sen isteyince." (iki dil) gösterilir; sağlayıcı yokken metin aynen kalır.

## 7. Kayıt (`src/meta/kayit.ts`)

Şema 3 kalır (`KAYIT_SURUMU` değişmez): yeni alanlar isteğe bağlı, onarım
varsayılanla doldurur, eski sürüm bilinmeyen alanı korur ya da yok sayar
(P1 doğrular; bulut kaydı için `kancaBirlestir` yeni alanları seçilen kayıttan
alır).

```ts
can?: { sayi: number; dolumBasi: number | null; reklamGun: number; reklamSayisi: number };
gelir?: { ustaKarti: boolean; jetonlar: string[] };
```

Varsayılan: `{ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 }`,
`{ ustaKarti: false, jetonlar: [] }`. Kayıtla oynayan saf işlevler
`src/meta/can.ts`'te (§10 G1).

## 8. Ölçüm (`docs/OLCUM.md`'ye eklenecek olaylar)

| Olay | Özellikler |
|---|---|
| `can_harcandi` | `neden` (kayip, cikis), `kalan`, `bolum` |
| `can_bitti` | `bolum` |
| `can_doldu` | `neden` (zaman, reklam, satin, iade) |
| `reklam_teklif` | `yer` (can, hamle) |
| `reklam_sonuc` | `yer`, `sonuc` (odul, iptal, yok, hata), `kart` (Usta kartı) |
| `satin_alma` | `urun`, `durum` (basla, basarili, iptal, beklemede, hata, geri_yukle) |

## 9. Varsayılanlar (ürün sahibi değiştirebilir; sabitler `src/meta/can.ts`)

- **C1** Can yalnız sağlayıcı varken (Android, `?gelir=sahte`); web/claude.ai'de yok.
- **C2** En çok 5 can; 30 dk'da 1.
- **C3** Ücretsiz: 1–5, Günün Şenliği, Sonsuz Şenlik. Harcayan: ana ≥ 6, Usta.
- **C4** Kayıpta anında −1; devamla kazanınca iade; bölüm ortasında çıkış −1 (onaylı).
- **C5** 0 canda bölüm başlamaz; Can bitti paneli.
- **C6** Reklamla +1 can: günde 3.
- **C7** Kaybedince reklamla +5 hamle: denemede bir kez, Eli kurallarıyla (1★, mühür yok); Eli sunuluyorsa reklam yok.
- **C8** Ürünler: can doldur, güçlendirici paketi (3/2/2), Usta kartı.
- **C9** Usta kartı: reklamlı ödüller reklamsız, aynı sınırlarla.
- **C10** Fiyat önerileri $0.99 / $1.99 / $4.99 (mağaza yerel fiyatı gösterir).
- **C11** Afiş ve ara reklam yok; can bildirimi yok.
- **C12** Haritada mağaza düğmesi yok; giriş Ayarlar ve Can paneli.
- **C13** Satın alınan güçlendirici açılmamışsa da stokta bekler.

## 10. İş paketleri

- **G0 Sözleşme ve iskelet** (entegratör): bu belge; `src/meta/can.ts`
  imzaları + sabitler (gövde `throw`), `src/platform/gelir.ts` türleri +
  `gelirSaglayici()` (null), `Kayit` alanları, `src/ui/tipler.ts` VM türleri
  (`CanVM`, `MagazaVM`, `KaybettinVM` ekleri), olay adları.
- **G1 Meta (saf, testli):** `can.ts` gövdeleri (`canDurumu`, `canGerekirMi`,
  `canHarca`, `canIade`, `canEkle`, `canDoldur`, `reklamCanHakki`,
  `reklamCanKullan`, `satinAlmaUygula(k, urun, jeton)` jeton korumalı,
  `guclendiriciPaketiSigar`), kayıt onarımı ve `kancaBirlestir`, testler
  (dolum sınırları, saat geri, gün değişimi, tavan, jeton tekrarı, paket stok
  sınırı, onarım, eski kayıt).
- **G2 Sağlayıcı:** `gelir.ts` seçim, sahte sağlayıcı (reklam katmanı, sahte
  mağaza, test anahtarları), Android köprü sarmalayıcısı (JSON, hata yutma),
  ölçüm olayları, testler (jsdom yoksa saf kısımlar).
- **G3 Arayüz:** can hapı, can paneli, Kaybettin ekleri, çıkış onayı, Mağaza,
  Ayarlar satırı; `dev/arayuz.html` önizlemeleri (`?ekran=can&v=bitti|kalan|kart`,
  `magaza`, `kaybettin&v=can|can0|reklam`); iki dil; 390×844, 360×640.
- **G4 Akış:** `uygulama.ts` (sağlayıcı kurulumu, bölüm başlatma kapısı,
  can paneli, Mağaza, satın alma işleme + `bekleyenler` açılışta, can hapı
  zamanlayıcısı yalnız harita açıkken), `oturum.ts` (kayıpta harca, devamda
  iade, reklamla +5, çıkış onayı), test kancası (`__fitil.gelir()` durum,
  `__fitil.canAyarla(n)`), `scripts/oynanis.mjs` yeni profil `gelir`
  (`?gelir=sahte&reklam=hizli`, §11), web/claude.ai'de hiçbir şeyin
  görünmediği denetimi (mevcut profiller).

## 11. Oynanış senaryosu (`oynanis.mjs` profil `gelir`, 390×844)

1. `?gelir=sahte&reklam=hizli` ile aç; `kayitYama` ile 8 bölüm kazanılmış kayıt.
2. Haritada can hapı "5". Bölüm 9'u kaybet (bot) → Kaybettin "−1 can · 4 kaldı".
3. "+5 hamle" → sahte reklam → oyun 5 hamleyle sürer; kazanırsa can 5'e döner.
4. `canAyarla(1)`; kaybet → "Can bitti" düğmesi → panel: sonraki can sayacı,
   "Reklam izle" → can 1; üç reklamdan sonra "Yarın yine".
5. Ayarlar > Mağaza → "Canları doldur" → sahte onay → can 5; güçlendirici
   paketi → stok +3/+2/+2; Usta kartı → reklam satırları "Ücretsiz".
6. Duraklat (≥ 1 hamle) > Haritaya dön → onay kartı → Çık → can −1.
7. `?gelir` olmadan aç: can hapı, Mağaza, reklam düğmeleri YOK (mevcut
   profiller de bunu denetler).
8. Ölçüm günlüğünde §8 olayları var. pageerror/console.error yok.

## 12. Doğrulama

`npx tsc --noEmit -p .`, `npx vitest run`, `node scripts/oynanis.mjs <url>
<klasör> telefon` (web: gelir yok) ve `gelir` profili, `node scripts/dil-tara.mjs`
(`?gelir=sahte` ekranları dahil, 0 kalıntı), 390×844 ve 360×640 ekran
görüntüleri (can paneli, Kaybettin, Mağaza, harita hapı).

## 13. Sözleşme (G0)

Derlenen iskelet: imzalar ve JSDoc bağlayıcı, gövdeler `throw` (G1
`meta/can.ts`, G3 `Arayuz`). Var olan bir adın anlamını değiştirme; eklemek
serbest.

### Dosyalar ve dışa açık adlar

- **`src/meta/can.ts`** (G1; `meta/index.ts` dışa aktarır: `meta.canDurumu` …)
  - Sabitler: `CAN_ENCOK` 5, `CAN_DOLUM_MS` 30 dk, `CAN_UCRETSIZ_SON_BOLUM` 5,
    `REKLAM_CAN_GUNLUK` 3, `GUCLENDIRICI_PAKETI` {kibrit 3, kalip 2, geriSar 2},
    `JETON_SINIRI` 50.
  - Türler: `CanKaydi`, `GelirKaydi` (§7), `CanDurumu` {sayi, enCok, sonrakiMs},
    `CanHarcamaNedeni` ('kayip' | 'cikis'), `SatinAlmaUygulamasi` {kayit, verildi, tekrar}.
  - Gövdeli: `varsayilanCan()`, `varsayilanGelir()`.
  - G1: `canDurumu(k, simdi)`, `canGerekirMi(v: {tur, id})`, `canTazele(k, simdi)`,
    `canHarca(k, simdi, neden)`, `canIade(k, simdi)`, `canEkle(k, simdi, n)`,
    `canDoldur(k, simdi)`, `reklamCanHakki(k, bugun)`, `reklamCanKullan(k, simdi, bugun)`,
    `paketSigarMi(k)` (§10'daki `guclendiriciPaketiSigar`),
    `satinAlmaUygula(k, urun, jeton, simdi)`, `geriYuklemeUygula(k, urunler)`.
- **`src/meta/kayit.ts`**: `Kayit.can?: CanKaydi`, `Kayit.gelir?: GelirKaydi`
  (şema 3, `KAYIT_SURUMU` aynı). `kayitOnar` bugün bu alanları DÜŞÜRÜR (yeni
  kayıttan kurar): onarımı, `kancaBirlestir`'i ve testlerini G1 ekler.
- **`src/platform/gelir.ts`** (G2): §5 türleri birebir (`ReklamYeri`,
  `ReklamSonucu`, `UrunId`, `Urun`, `SatinAlmaSonucu`, `GelirSaglayici`),
  `URUN_IDLERI` (Mağaza sırası), `URUN_TURLERI` (tuketilir/kalici),
  `AndroidGelirKoprusu` (§5.1), `gelirSaglayici()` (G0: hep null).
- **`src/platform/olcum.ts`**: `Window.FitilYerel.gelir?: AndroidGelirKoprusu`;
  §8: `OlcumGelirOzellikleri`, `OlcumGelirOlayi`, `OLCUM_GELIR_OLAYLARI`,
  `gelirOlayi(ad, p)` (tür denetimli `olcum.olay`). Sözlük `docs/OLCUM.md`.
- **`src/ui/tipler.ts`** (G3 çizer, G4 doldurur): `CanSayaciVM` {sayi, enCok,
  sonrakiMs}, `CanVM` (+ tur, reklam, doldur), `CanPaneliSecimi`,
  `MagazaUrunVM`, `MagazaVM`, `MagazaSecimi`; `HaritaVM.can?`,
  `HaritaSecimi` + `{ tur: 'can' }`; `KaybettinVM.can?` / `reklamHamle?` /
  `canBitti?`; `KaybettinSecimi` + 'reklamHamle' | 'canBitti'.
- **`src/ui/ekranlar/ayarlar.ts`**: `AyarlarEk.magazaAc?`, `AyarlarEk.gelirVar?`
  (`Arayuz.ayarlar` ikisini de geçirir).
- **`src/ui/arayuz.ts`** (G3): `canPaneli(vm, tazele?)`, `magaza(vm, tazele?)`,
  `cikisOnayi(neden = 'harita')`, `haritaCanGuncelle(can)`.
- **`src/app/zaman.ts`**: `duvarSaati()` (epoch ms; can işlevlerinin `simdi`'si).

### Kararlar

1. **Zaman:** `simdi` duvar saati (`Date.now()`, epoch ms): uygulama
   `app/zaman.ts` `duvarSaati()` verir. `zaman.ts` `simdi()` (performance.now,
   sayfa başına sıfırlanır) KULLANILMAZ: `dolumBasi` kayda yazılır.
2. **Gün:** reklam hakkının günü yerel takvim günü `yyyymmdd`
   (`zaman.bugun()`, Günün Şenliği ile aynı), parametreyle gelir; meta `Date`
   kullanmaz. Bu yüzden `reklamCanHakki(k, bugun)` ve `reklamCanKullan(k,
   simdi, bugun)` (G0 iş tanımındaki `(k, simdi)`'den sapma); `reklamGun` yyyymmdd.
3. **Kayıt işlevleri** girdiyi değiştirmez; değişiklik yoksa aynı nesne,
   varsa yeni kopya (`yeni !== eski` → kaydet). Alan yoksa varsayılan sayılır.
   Her biri önce tembel dolumu uygular.
4. **`canTazele`** (iş tanımına ek): tembel dolumu ve saat geri düzeltmesini
   kayda yazar; açılışta ve harita zamanlayıcısında (`can_doldu` zaman).
5. **`reklamCanHakki`** can doluluğuna bakmaz (bugün kalan hak). Arayüz:
   `CanVM.reklam` null = can dolu (satır yok); hak 0 = "Yarın yine"; hak > 0
   ama hazır değil = satır gizli; Usta kartı aynı hakkı kullanır (C9).
6. **Satın alma:** `verildi` → kaydı yaz, SONRA `tamamla(jeton)`; `tekrar`
   → ödül yok, yine `tamamla`; ikisi de false (paket sığmıyor ya da boş jeton)
   → `tamamla` yok, satın alma `bekleyenler()`'de kalır. Dolu canla
   `can_doldur` yine verildi sayılır (ödeme alınmıştır). Geri yükleme
   jetonsuzdur: `geriYuklemeUygula` yalnız kalıcı ürünü verir.
7. **Modal davranışı:** can paneli ve Mağaza **seçimde kapanır**; uygulama
   işleyip yeni modelle yeniden açar (döngü, `kasabaAkisi` gibi). 1 sn içinde
   yeniden açılışta giriş animasyonu yok ("panel yerinde kalır"). `tazele`
   açıkken saniyede bir çağrılır (sayaç, reklam hazır, fiyatların gelişi).
   Sahte reklam ve sahte satın alma onayı sağlayıcının kendi katmanıdır (G2),
   panel kapalıyken görünür.
8. **Çıkış onayı:** Duraklat kapandıktan sonra `cikisOnayi('harita' |
   'yeniden')`; false → uygulama Duraklat'ı yeniden açar.
9. **Can hapı:** `HaritaVM.can` ilk çizim; canlı sayaç `haritaCanGuncelle`
   (haritayı yeniden çizmez). `harita(vm)`'in "aynı model" denetimi `can`'ı
   dışarıda bırakır (G3).
10. **Mağaza durumu:** 'stokDolu' paket için "Stok dolu", `can_doldur` için
    "Canların dolu"; 'yok' mağaza ürünü sunmuyor. Ürün ad/açıklama metinleri
    G3'ün `metinler.ts`'inde (iki dil); G4 `MagazaVM`'i oradan doldurur.
11. **Sağlayıcı:** `gelirSaglayici()` sayfa başına bir kez seçer, hep aynı
    örneği döndürür; null iken can, reklam, Mağaza ve gelir ölçüm olayları yok.

### Ürün sahibine (uygulanmadı, rapor)

- C8 + stok sınırı 3: paketteki 3 Kibrit yalnız Kibrit stoğu 0 iken sığar
  (Kalıp ve Geri Sar ≤ 1); paket çoğu zaman "Stok dolu" görünebilir.
- §7 "`kancaBirlestir` yeni alanları seçilen kayıttan alır": öbür kayıttaki
  Usta kartı ve jetonlar düşebilir (Android'de bulut yok; geri yükleme kartı
  kurtarır). Öneri: `ustaKarti` VEYA, jetonlar birleşimi.
