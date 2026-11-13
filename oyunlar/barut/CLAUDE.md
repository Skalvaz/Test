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
  çukuru sonsuza kadar derinleştirmesin. Yalnız `kazi` patlamaları (oyuncu
  bombası, mayın) `zemin + 38`'e kadar oyar; gömüler 11–29 piksel derinde.
- Gömüler (`gomuler`): her kraterden sonra `gomuKontrol` bakar; üstü 5
  piksele inen mayının fitili yanar (0,4 sn), sandık fırlar. Top ve roket
  düşmana nişan aldığı için toprağı yalnız bomba bilerek kazar.
- Bomba girdisi üç yoldan: düğme (`bombaDugme`, çizim ve dokunma aynı yeri
  kullanır), sürüklemeden kısa dokunuş (< 240 ms, < 5 piksel), sürüklerken
  ikinci parmak. Oyunu başlatan ilk dokunuş bomba saymaz (`ipucuT > 0,4`).
- Bot pilot ≈ 2–2,5 dakikada 6. dalgada düşer (≈ 5500–6800 puan). Dengeyi
  değiştirince `kayit.mjs` özetine ve `dunya.test.ts` eşiklerine bak.
- vitest `console.log` göstermez; ayıklama için `scripts/*.tmp.test.ts`
  içinde dosyaya yaz, işin bitince sil.

## Yol haritası (kullanıcı kararları bana bıraktı, Kasım 2026)

Kaynak: kullanıcının kız arkadaşının el yazısı notları + benim önerilerim.
Hedef: ücretsiz Android oyunu (FİTİL'deki Capacitor yolu), belki sonra PC.
Oyunun kimliği: normal savaş olarak başlar, dalga ilerledikçe saçmalaşır.
Paketler birer oturumluk; kullanım sınırı yüzünden teker teker.

1. ✅ **Toprak ve bomba:** elle bomba, gömülü mayın ve sandık, üç süreli
   güçlendirme (çift top, hız, bomba yağmuru), araçlardan ödül düşmesi.
2. **Tabya ve bina:** tuğla tuğla yıkılan, üstü kapalı, içinde asker olan
   ve ateş eden tabya; arka plan binalarının pencerelerinden nişancılar;
   hızlı makineli jeep; hasar alan araçtan sağ atlayıp dağılan askerler;
   yıkılan yapılardan güçlendirme.
3. **Saçmalık başlasın:** üst üste binip dev çöp adam olan askerler (her
   parçası ayrı bez bebek; vuruldukça dökülür; oyunun imzası), lazerli
   asker, helikopteri lazerle vuran UFO.
4. **Gelişim:** birkaç dalgada bir üç seçenekten biri, destek helikopteri,
   paraşütle inen DOST takviye, 10–20 dalgada bir mutasyon patronu.
5. Android paketi (Capacitor), kansız mod düğmesi.

Yorum kararları: "silahsız kaçışanlar" hedef değil moral bozukluğu (silahını
atıp kaçar, top ateş etmez, puan yok). Notlardaki "HPC" güçlendirme kutusu
diye okundu.

## Diğer fikirler

Kanca (halatla sandık/enkaz/asker taşıma; LODOS'un ip fiziği), günün görevi
(aynı tohum + skor tablosu, sayfa yeteneği db + user), büyük patlamada ağır
çekim ve paylaşılacak "en iyi an" karesi, askerlere isim ve rütbe, gerçek
ses tasarımı, yeni bölgeler (köprü, liman).
