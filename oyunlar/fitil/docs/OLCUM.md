# FİTİL — Ölçüm (olay sözlüğü)

`docs/YAYIN.md` aşama 1. Kod: `src/platform/olcum.ts` (günlük + özet),
olayları yazan yerler `src/app/uygulama.ts` ve `src/app/oturum.ts`.

## İlke

- **Kişisel veri yok:** kimlik, cihaz bilgisi, konum, serbest metin yok. Her
  olayda yalnız: ad, zaman, kurulumdan bu yana gün (`g`), oturum sırası (`o`)
  ve aşağıdaki özellikler.
- **Ağ isteği yok:** web ve claude.ai sürümünde olaylar yalnız cihazda
  (`localStorage` `fitil.olcum.v1`, son 600 olay). Android sürümünde aynı
  olaylar `window.FitilYerel.olay(ad, json)` köprüsüyle Firebase Analytics'e
  gider (aşama 3; Play Console'da veri güvenliği formu buna göre doldurulur).
- Ölçüm oyunu asla durdurmaz (her depo/köprü hatası yutulur).

## Olaylar

| Olay | Ne zaman | Özellikler |
|---|---|---|
| `oturum_basla` | Sayfa/uygulama açıldı | `dil`, `surum`, `ana` (açık en yüksek ana bölüm) |
| `ekran` | Ekran değişti | `ad` (acilis, harita, oyun, kazandin, kaybettin, kasaba, ayarlar…) |
| `bolum_basla` | Bölüm başladı | `id`, `tur` (ana, usta, gunluk, sonsuz), `deneme` (0 = ilk deneme) |
| `bolum_bitti` | Kazanç, kayıp ya da çıkış | `id`, `tur`, `sonuc` (kazanc, kayip, cikis), `yildiz`, `kalan` (hamle), `hamle` (yapılan), `sure` (etkin sn: sayfa arka plandayken, Duraklat'ta ve mola kartında geçen süre sayılmaz), `deneme`, `eli` (Usta'nın Eli) |
| `guclendirici` | Güçlendirici kullanıldı | `id` (kibrit, kalip, geriSar), `bolum` |
| `kasaba_is` | Kasaba işi yapıldı | `id` |
| `dil` | Dil değiştirildi | `d` |

### Aşama 2: can, ödüllü reklam, satın alma (`docs/CAN-REKLAM.md` §8)

Yalnız gelir sağlayıcısı varken (Android, deneme `?gelir=sahte`) yazılır.
Türler `src/platform/olcum.ts` (`OlcumGelirOzellikleri`, `OlcumGelirOlayi`,
`OLCUM_GELIR_OLAYLARI`); tür denetimli kısa yol `gelirOlayi(ad, p)`. Jeton,
fiyat ve tutar ölçüme YAZILMAZ.

| Olay | Ne zaman | Özellikler |
|---|---|---|
| `can_harcandi` | Kayıpta ya da onaylı çıkışta 1 can düştü | `neden` (kayip, cikis), `kalan` (düşüşten sonraki can), `bolum` |
| `can_bitti` | Can 0'a indi ya da 0 canla bölüm başlatılmak istendi | `bolum` |
| `can_doldu` | Can arttı | `neden` (zaman, reklam, satin, iade) |
| `reklam_teklif` | Reklam (ya da Usta kartı) düğmesi gösterildi | `yer` (can, hamle) |
| `reklam_sonuc` | Reklam bitti ya da Usta kartıyla ödül verildi | `yer`, `sonuc` (odul, iptal, yok, hata), `kart` (Usta kartı) |
| `satin_alma` | Satın alma adımı | `urun` (can_doldur, guclendirici_paketi, usta_karti), `durum` (basla, basarili, iptal, beklemede, hata, geri_yukle) |

`bolum_bitti`'ye reklamla +5 hamle devamında `reklam: true` eklenir (Usta'nın
Eli `eli`'den ayrı). Geri yüklemede her kalıcı ürün için bir `satin_alma`
(`durum: geri_yukle`).

## Göstergeler (özet: `olcumOzeti`, test kancası `__fitil.olcum()`)

- Bölüm hunisi: bölüm başına başlama, kazanç, kayıp, çıkış, ilk kazanca kadar
  deneme, ortalama süre. Terk noktası = kazanılmadan bırakılan en çok bölüm.
- İlk oturum: varılan en yüksek ana bölüm (hedef ≥ 5), ilk açılıştan 5.
  bölümün kazancına kadar süre.
- Geri gelme: oyuncunun açtığı günler (`gunler`: 0, 1, … → D1/D7).
- `bolum_basla` olup `bolum_bitti`'si olmayan deneme: uygulama bölümün
  ortasında kapatıldı (terk).
- Oynanış testi (`scripts/oynanis.mjs`, telefon) günlüğü ve özeti
  `<çıktı>/telefon/olcum.json`'a yazar; bölüm olayları yoksa başarısız.

## Oyun özeti ekranı (Ayarlar > Oyun özeti)

Aile testi için: claude.ai sayfasında dışarıdan gelen ziyaretçi veritabanına
yazamadığından özet buluta GİTMEZ; oyuncu ekranı açar, görüntüsünü gönderir.
Kod: `src/app/oyunOzeti.ts` (`oyunOzetiVM(toplam, simdi, ilk, enYuksek)`, saf, testli),
ekran `src/ui/ekranlar/oyunOzeti.ts`, önizleme
`dev/arayuz.html?ekran=oyunOzeti[&v=bos|az]`, test kancası
`__fitil.ac('oyunOzeti')` (Ayarlar + üstünde özet). Açılınca `ekran` olayı
`ad: oyunOzeti`.

- Sayılar ömür boyu: halka günlük (600 olay; deneme başına ~7 olay) birkaç
  günde dolar, bu yüzden ölçüm her olayda `toplamaEkle` ile toplamları
  günceller ve günlükle birlikte saklar (`olcum.toplam()`; toplamsız eski
  kayıtta günlükte kalan olaylardan kurulur). Bir denemenin süresi en çok
  15 dk sayılır (`DENEME_SURE_SINIRI`).
- Üst kutular: ilk açılış (`olcum.ilkAcilis()`; takvim günüyle "Bugün", "Dün",
  "N gün önce"), oturum (en büyük `o`), oynanan gün (ayrı yerel takvim günü,
  `yerelGun`; `g` 24 saatlik dilimdir), en yüksek kazanılan ana bölüm
  (kayıttan, `kazanilanEnYuksek`), oyun süresi (`bolum_bitti.sure` toplamı),
  sürüm + dil.
- Tablo: yalnız ana bölümler (`tur` 'ana'), en son oynanan 8 (özet 360×640'ta
  tek ekrana sığar), numara sırasıyla. Deneme = `bolum_basla` (başlangıcı günlükten düşmüş bitiş de
  sayılır), Kayıp, Bırakma = `cikis` + bitmeden kapatılan deneme (ardından
  yeni deneme ya da oturum geldi; günlüğün sonunda süren deneme sayılmaz),
  Süre = biten denemelerin ortalaması (m:ss). Yıldız: bölüm kazanıldı. En
  çok kayıp + bırakma olan satır vurgulu (eşitlikte en son oynanan); ikisi
  ekran okuyucuya satır başlığındaki gizli metinle söylenir.
