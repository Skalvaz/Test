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
| `bolum_bitti` | Kazanç, kayıp ya da çıkış | `id`, `tur`, `sonuc` (kazanc, kayip, cikis), `yildiz`, `kalan` (hamle), `hamle` (yapılan), `sure` (sn), `deneme`, `eli` (Usta'nın Eli) |
| `guclendirici` | Güçlendirici kullanıldı | `id` (kibrit, kalip, geriSar), `bolum` |
| `kasaba_is` | Kasaba işi yapıldı | `id` |
| `dil` | Dil değiştirildi | `d` |

Aşama 2'de eklenecek: `can_bitti`, `can_doldu`, `reklam_teklif`,
`reklam_izlendi`, `satin_alma_basla`, `satin_alma_bitti`.

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
Kod: `src/app/oyunOzeti.ts` (`oyunOzetiVM(olaylar, simdi, ilk)`, saf, testli),
ekran `src/ui/ekranlar/oyunOzeti.ts`, önizleme
`dev/arayuz.html?ekran=oyunOzeti[&v=bos|az]`, test kancası
`__fitil.ac('oyunOzeti')` (Ayarlar + üstünde özet). Açılınca `ekran` olayı
`ad: oyunOzeti`.

- Üst kutular: ilk açılış (`olcum.ilkAcilis()`; "Bugün", "Dün", "N gün önce"),
  oturum (en büyük `o`), oynanan gün (ayrı `g` sayısı), en yüksek kazanılan ana
  bölüm (kazanç olayları ve `oturum_basla.ana − 1`; halka günlük eski kazançları
  düşürse de doğru), oyun süresi (bütün `bolum_bitti.sure` toplamı), sürüm + dil.
- Tablo: yalnız ana bölümler (`tur` 'ana'), en son oynanan 12, numara
  sırasıyla. Deneme = `bolum_basla` (başlangıcı günlükten düşmüş bitiş de
  sayılır), Kayıp, Bırakma = `cikis` + bitmeden kapatılan deneme (ardından
  yeni deneme ya da oturum geldi; günlüğün sonunda süren deneme sayılmaz),
  Süre = biten denemelerin ortalaması (m:ss). Yıldız: bölüm kazanıldı. En
  çok kayıp + bırakma olan satır vurgulu (eşitlikte en son oynanan).
