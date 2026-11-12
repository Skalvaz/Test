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
```

## Kod haritası

- `src/tuval.ts` — açıklık tamponu (0 mürekkep … 255 kâğıt) + vurgu katmanı
  (kan, ateş, kuru kan, akkor). `sun()` 7 gri kademeye indirir; ara değerler
  komşu iki kademe arasında Bayer 4×4 ile taranır. Kademelere denk gelen
  değerler (0, 42, 85, 128, 170, 213, 255) DÜZ görünür; düz yüzeylerde
  bunları kullan, ara değerleri yalnız geçiş ve duman için. `leke()` yarı
  saydam duman/toz, `cizDon()` döndürülmüş sprite.
- `src/sprite.ts` — ASCII sprite'lar (`#` mürekkep, `x` koyu, `+` orta,
  `-` açık, `o` beyaz, `r` kan, `*` ateş). Hepsi sağa bakar.
- `src/dunya.ts` — simülasyon: helikopter (yay-sönüm, otomatik top + roket),
  askerler (koş/nişan/panik/yanıyor), araçlar (tank, uçaksavar, kamyon),
  hava (düşman helikopteri, jet, dost nakliye), mermiler, `patlat()` (hasar,
  krater, panik, zincirleme), bez bebek (7 nokta verlet, kopabilen bağlar),
  parçalar, dalgalar. Tohumlu RNG, sabit 1/60 s adım, `olaylar` kuyruğu.
- `src/sahne.ts` — çizim: açılışta üretilen uzak/orta katman (harabe
  binalar), zemin (kan ve is izleri), siper, çöp adamlar (kodla), araçlar,
  mermiler, patlamalar, HUD, başlık, sonuç.
- `src/ses.ts` — WebAudio sesleri. `src/main.ts` — döngü, göreli sürükleme,
  `window.__barut` (`dondur`, `ilerlet(sn)`, `basla`, `ciz`, `dunya`).

## Kurallar ve tuzaklar

- Mantıksal genişlik `G = 240` (telefonda piksel başı ≈ 1,5 CSS pikseli).
  360 denendi: birimler çok küçük kaldı. Yazı ölçeği varsayılan 2.
- `GIRIS_X`'in sağındaki düşman hedef alınmaz, vurulmaz; helikopter
  `HELI_SAG`'dan öteye geçemez. Yoksa oyuncu doğum noktasında pusu kurar ve
  ekranda hiç kalabalık oluşmaz (bot kaydı gösterdi).
- Dizi üstünde geriye doğru dönerken `patlat`/`siperHasar` başka elemanları
  silebilir: döngü başında `if (!s) continue` koruması var, kaldırma.
- Krater derinliği `zemin + 11` ile sınırlı; aynı yere düşen patlamalar
  çukuru sonsuza kadar derinleştirmesin.
- Bot pilot ≈ 2 dakikada 5.–6. dalgada düşer (≈ 3500–5500 puan). Dengeyi
  değiştirince `kayit.mjs` özetine ve `dunya.test.ts` eşiklerine bak.
- vitest `console.log` göstermez; ayıklama için `scripts/*.tmp.test.ts`
  içinde dosyaya yaz, işin bitince sil.

## Sıradaki fikirler

Elle ateşlenen özel silah (hava saldırısı çağır); dost piyade ve dost tank;
yıkılabilen ön plan binaları; patron dalga (zırhlı tren / dev tank); skor
tablosu (sayfa yeteneği db + user); yeni bölgeler (köprü, liman).
