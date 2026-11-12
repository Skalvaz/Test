# LODOS — çalışma notları

Turbofan'dan, FİTİL'den ve EBRULİ'den BAĞIMSIZ küçük oyun: 1-bit piksel
sanatlı gece balıkçılığı. Canvas 2D + TypeScript + Vite, bağımlılık yok
(yazı tipi, sprite, ses hepsi kodda). Kök CLAUDE.md'deki turbofan maddeleri
burada geçerli değil; dil kuralı geçerli: kullanıcıyla, kod yorumlarında ve
commit mesajlarında Türkçe. Arayüz metinleri BÜYÜK HARF Türkçe.

Esin: kullanıcının beğendiği 1-bit noktalı taramalı, ip fizikli, piksel
balonlu bir oyun videosu. O oyunun kopyası DEĞİL: konu, karakterler, çizimler
ve kurallar özgün. Tarzı koru, başka oyunun varlığını taklit etme.

Yayın: https://claude.ai/artifact/PF8aiYSTHRz4WvAoqGQtHQ (`npm run build:single`
→ `dist-single/artifact.html` aynı yolla yeniden yayınlanır; yetenek yok,
rekor yalnız cihazda `localStorage`). Sayfa kuralı gereği yanlarda en az
16 px boşluk var; tuval `#app` kutusunun iç ölçüsüne göre boyutlanır.

## Komutlar (bu klasörde)

```powershell
npm ci
npm run dev                 # http://localhost:5173
npm test                    # vitest (simülasyon + bot)
npm run typecheck
npm run build:single        # → lodos.html + dist-single/artifact.html
node scripts/shot.mjs <url> <png> [w] [h] [js]      # L = window.__lodos
node scripts/kayit.mjs <url> <klasör> [başlangıç-sn] [süre-sn] [fps]   # bot + kare kaydı
```

## Kod haritası

- `src/tuval.ts` — 1-bit kare tamponu. Her şey 0–255 gri yazılır; `sun()`
  32×32 mavi gürültü eşiğiyle tek bite indirir (noktalı tarama). Ayrı vurgu
  katmanı (kehribar). Sprite çizimi (`ciz`: çevirme, 90° döndürme, sütun
  kaydırma, 1 piksel siyah hale), piksel yazı (5 piksel, Türkçe büyük harf).
- `src/sprite.ts` — ASCII'den sprite'lar (`#` mürekkep, `_` siyah, `+` gri,
  `*` vurgu). Balıklar sağa bakar, kuyruk solda.
- `src/dunya.ts` — simülasyon (çizim/ses bilmez): dalga, tekne, misina
  (verlet, 16 düğüm), balık durum makinesi (yuz/ilgi/olta/kac/ucus), besin
  zinciri (`uygunYem`: sıra farkı 1–2), gerilim ve kopma, denizanası, hava
  evreleri, şimşek, ipuçları. Tohumlu RNG, sabit 1/60 s adım; olanlar
  `olaylar` kuyruğunda.
- `src/sahne.ts` — çizim: gök (ay, üç kademeli bulut, şafak), ufuk, deniz
  (ışık hüzmeleri), dip (katman çizgileri, gömüler), canlılar, tekne, yağmur,
  balonlar, HUD, başlık, sonuç. Yalnız görsel şeyler (yağmur, martı) burada.
- `src/ses.ts` — WebAudio ile üretilen sesler. `src/main.ts` — döngü, girdi,
  `window.__lodos` kancası (`dondur`, `ilerlet(sn)`, `parmak`, `basla`, `ciz`).

## Kurallar ve tuzaklar

- Okunacak yazı ve sprite hep ton 255: ara tonlar taranır, yazı okunmaz olur.
  Ara ton yalnız doku içindir (bulut, su, ışık, sis).
- Mantıksal genişlik `G = 180`; yükseklik ekran oranından (290–429). Yerleşim
  sabitleri mantıksal pikseldir.
- Dünya `DUNYA_G = 540`; sığ sol, derin sağ. Balıklar sağda `SAG_SINIR`'da
  döner: olta ucu teknenin solunda, dünyanın sağ ucuna yetişmez.
- Tek gezen balıkta hedef hız yön güncellendikten SONRA hesaplanır (yoksa
  kenarda dönemez, takılır; bot testi yakaladı).
- vitest `console.log` göstermez; ayıklama için `scripts/*.tmp.test.ts`
  içinde dosyaya yaz, işin bitince sil.
- Bot (test ve `kayit.mjs`) gecede ≈ 150–300 lira yapar; denge değişirse
  `dunya.test.ts` eşiklerine bak.

## Sıradaki fikirler

Martı kancadaki balığı çalsın; vapur dalgası; gece seçimi (dolunay, sis);
yeni türler (kalkan, ahtapot); skor tablosu (sayfa yeteneği db + user).
