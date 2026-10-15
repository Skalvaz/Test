# FİTİL — çalışma notları

Turbofan'dan BAĞIMSIZ bir alt proje: eşleştirmeli bulmaca oyunu (Canvas 2D +
DOM + TypeScript + Vite). Kök CLAUDE.md'deki turbofan maddeleri (motor,
three.js, kayıt sahneleri, M5a) burada geçerli DEĞİL; dil ve commit kuralları
geçerli: kullanıcıyla, kod yorumlarında ve commit mesajlarında Türkçe.

- Tasarım belgesi: `docs/GDD.md` (bağlayıcı; § numaralarıyla atıf yap).
- Sözleşmeler: `src/core/types.ts` (durum, olaylar, bölüm verisi),
  `src/core/index.ts` (çekirdek API), `src/app/sozlesme.ts` (çizici, girdi, ses).
  Sözleşmede var olan bir alanın anlamını değiştirme; alan eklemek serbest.

## Komutlar (proje klasöründe: `oyunlar/fitil`)

```powershell
npm ci                      # yeni worktree'de ilk iş (node_modules izlenmez)
npm run dev                 # http://localhost:5173 (telefondan aynı ağda IP:5173)
npm test                    # vitest
npm run typecheck
npm run build:single        # → fitil.html + dist-single/artifact.html
npm run bot -- --bolum 12 --tohum 200 --bot usta
npm run dogrula             # bölüm doğrulama (bot bantları)
npm run dogrula -- --bolum 11-15 --tohum 30          # --tohum: tohum SAYISI
npm run dogrula -- --dosya deneme/ --tohum 30        # varyant JSON'ları (klasör ya da dosya)
npm run kalibre -- --bolum 12                        # 500 tohum, yildizEsikleri yazar, hamle önerir
npm run kalibre -- --bolum 6-19 --kural k24          # K24 eşikleri (+500 Acemi), "esikKurali": "k24" yazar
npm run bot -- --dagilim --bolum 1-12 --tohum 100 --acemi-tohum 60   # Usta+Acemi kazanma, 1/2/3★, puan yüzdelikleri, K22 önerisi
node scripts/shot.mjs <url> <png> [w] [h] [bekleme-ms] [js]   # telefon görünümü (390×844)
npm run oynanis -- http://127.0.0.1:5185/ playtest-output [telefon|masaustu|kucuk]   # tam akış duman testi
```

Oynanış testi (`scripts/oynanis.mjs`) dev sunucusuna ya da `file://…/fitil.html`'e
karşı koşar: açılış → bölüm 1 (zorunlu ilk hamle gerçek dokunmatik sürüklemeyle)
→ bot ile 1–6 ve 10 → kazandın/kaybettin (Tekrar dene < 1 sn ölçülür) → harita →
ayarlar → defter → Günün Şenliği; pageerror/console.error başarısızlıktır.
Test kancası `window.__fitil`: `durum()`, `bolum()`, `ekran()`, `bolumAc(id)`,
`botHamle('usta'|'acemi')`, `hizli(on)`, `kayit()`, `kayitYama({...})`,
`ac('gunluk'|'defter'|'ayarlar'|'istatistik'|'nasil'|'sonsuz')`, `geometri()`, `ogretim()`.

## Bölüm tasarımı (bot ve doğrulayıcı)

- Bölüm listesi `src/levels/index.ts` (elle içe aktarım; DOKUNMA). Taslak
  bölümler `"taslak": true` taşır: statik doğrulamadan geçer, bot ölçütleri
  `dogrula`'da atlanır (`--taslaklar` ile koşar). Bölümü tasarlayan yalnız
  kendi `veri/bNNN.json`'unu değiştirir ve `taslak`'ı siler.
- Ayar sırası: önce 30 tohumla dene, sonra 100 tohumla onayla, en sonda
  `kalibre` (yıldız eşikleri). 30 tohumda kazanma oranı ±%10 oynar.
- Ölçütler `src/bot/olcut.ts` (§16.5): bant, yakın kaçış, R medyan/p90/p99,
  zincir medyanı, özel sıklığı, ısı, süre 60–180 sn. Öğretimde dağılım
  ölçütleri muaf (gerekçe dosyada).
- Büyük reaksiyonlar neredeyse hep özel taş ateşlemesinden gelir; p90/p99
  aşılırsa K21 yedek düğmesi `kurallar.soguma` (6, 9, 10: 3; 8: 4),
  uzun zincir/roket fazlaysa `caprazSiniri`. Tohum değişince kazanma oranı
  %15'e kadar oynar; yükleyici ilk tahtayı karıştırırsa doğrulayıcı hata verir.
- Usta ağırlıkları `src/bot/agirliklar.json` (GDD değerlerinden sapma ve
  gerekçesi dosyada). Ağırlık değişirse bütün bölümler yeniden doğrulanmalı.
- İlk oturum (GDD K22, K23, K24): öğretimin (1–5) yıldız eşikleri elle
  (`"elleEsik": true`; `kalibre` yazmaz, eşikler `--dagilim`'in "K22 önerisi"
  sütunundan). 6–25 K24 eşikli (`"esikKurali": "k24"`: 2★ = min(Usta p50,
  Acemi kazanç p50), 3★ = Usta p85; `kalibre` bayraklı bölümde Acemi'yi de
  oynatıp yazar, yeni bölüme `--kural k24`). 6–19 Acemi botuna göre ayarlı
  (Acemi ölçümü 60 tohum): tanıtımda Acemi ≥ %30 (Usta [92, 100]), zor ≥ %8
  ve Usta [60, 85] (Bölüm 10: ≥ %15, [70, 85]), rahatlama ≥ %60. `dogrula` öğretim ve
  tanıtımda Acemi'yi de ölçer (< %30 uyarı); zor/rahatlamada
  `--acemi --acemi-tohum 60` ile ölç.
- Deneyerek bulundu: `soguma` Acemi'yi en çok cezalandıran düğmedir (ısı
  şansını siler); kaldırmak Acemi'yi 3–5 kat artırır ama reaksiyon p90'ı 14'ü
  aşar. Süre ≥ 60 sn ≈ Usta'nın ≥ 15 hamlede kazanması: hedef adedini çok
  düşürmek süreyi bozar, hamle eklemek (≤ 30) bozmaz. Acemi kenar ve köşe
  hücrelerini (az komşu, az aday) seyrek patlatır: kenar/alt köşe döşemeleri
  ve köşeye yakın kafesler onu en çok tıkayan hedeflerdir (sönmeyen döşeme
  ısı haritasıyla görüldü); halka ve fener hedeflerini de neredeyse hiç
  kovalamaz (amaç körü), bu yüzden bu hedeflerde adet düşük tutulur.
- Deneyerek bulundu (13–19): Acemi orta satırları (8×9'da 4–5) en hızlı
  temizler; üst ve alt sıralar ~1,4 kat yavaş. Hedef türüne göre Acemi/Usta
  hamle oranı: kaya ~3, `topla` hepsi ~1,6, fener (ısısız) Acemi'de neredeyse
  hiç biter. Fener + kaya zorunda Acemi'ye şans veren tek düzen: fenerlerin
  altındaki sıralar ön ısılı (2) ve `soguma` kapalı (her soğuma Acemi'yi
  sıfırlar); `caprazSiniri` 2 Usta'yı Acemi'den çok yavaşlatır. Kaya
  çıkarınca reaksiyon p90 artar (kaya ısıyı keser). Dev fişeği yukarı
  taşımak p90'ı 18–22'ye çıkarır; bunun yerine "M dev fişekten N'si" hedefi.
  Bayramda düşük Körük kapasitesi (12) Acemi'yi en çok yükselten düğme;
  ama bayramda uzun oynayan Acemi Usta'dan çok puan toplar (b19 Acemi
  kazançlarının ~%89'u 3★: K24'ün 3★ = Usta p85'i orada iyi oyunu ayırmaz).
  Varyant ölçümünde Acemi'yi 120+ tohumla ölç: hamle değişince oyunlar
  bağımsız örneklere döner, 60 tohumda ±%5 oynar.

Komutlar Windows PowerShell'de de çalışmalı: npm betiklerinde `VAR=1 komut`
gibi POSIX sözdizimi kullanma.

## Modüller ve sınırlar

- `src/core/` — saf kurallar. DOM, `Date`, `performance`, `Math.random`,
  kayan nokta sabiti yok; zaman birimi tik. `hamleUygula` girdiyi değiştirmez.
  API, olay sözlüğü, zamanlama ve görsel tahta: `src/core/README.md`
  (çizici olayları `olayUygula` ile uygular, `gorselFark` ile eşitler).
- `src/levels/` — bölüm JSON'ları (`veri/bNNN.json`), doğrulayıcı, günlük üretici.
- `src/bot/` — Acemi/Usta bot, `sim-cli.ts` (tsx ile Node'da).
- `src/render/` — tek tuval sahnesi (`OyunCizici`), sprite önbelleği, parçacık
  havuzu, olay oynatıcı, kamera. `shadowBlur` yasak (parıltı sprite'tan).
- `src/audio/` — WebAudio sentezi (`SesMotoru`); `src/audio/synth.ts` taban.
- `src/input/` — `YolCizici` (pointer + klavye).
- `src/ui/` — DOM ekranları ve HUD; metinler `src/ui/metinler.ts`.
- `src/meta/` — kayıt şeması ve ilerleme mantığı (saf, testli).
- `src/platform/` — RNG (görsel), kayıt deposu (bulut/tarayıcı/bellek),
  titreşim, canlı güncelleme kancası.
- `src/app/` — oyun akışı (P5): `uygulama.ts` (ekran akışı, harita döngüsü,
  günlük/sonsuz, ayarlar, test kancası), `oturum.ts` (bölüm içi döngü: girdi →
  önizleme → hamle → oynatma → HUD; final, kazandın/kaybettin, hayalet fitil,
  Usta'nın Eli, güçlendiriciler, Körük, öğretim balonları/el/boşta ipucu),
  `gorunum.ts` (meta → arayüz VM eşlemeleri, testli), `kayitci.ts` (SaveStore +
  yedek döndürme + bulut), `uretim.ts` (günlük/sonsuz üretimi Web Worker'da —
  `uretimIsci.ts`, `?worker&inline`; CSP engellerse ana iş parçacığında zaman
  dilimli — + önbellek). Reaksiyon yazısı ve "Şenlik başlıyor!" yalnız tuvalde
  çizilir. Açılış ekranı beklerken ilk bölüm `cizici.onIsit` ile önden pişer.

## Hedef ortam (oyuncu telefondan, WhatsApp'tan gelen bağlantıyla açar)

- Dikey telefon öncelikli: tasarım 390×844, alt sınır 360×640; masaüstünde
  fare + klavye. Tüm düğmeler alt bantta, başparmakla erişilebilir.
- claude.ai sayfa çerçevesinde çalışır: `alert/confirm/prompt` YOK (onayı
  sayfa içinde yap), indirme bağlantısı yok, `window.open` yok, harici
  görsel/ses/fetch yok. Her şey prosedürel; "Baloo 2" `src/ui/yazitipi.ts` ile
  gömülü (FontFace'e ikili veri: CSP font-src'ye takılmaz, ağ isteği yok).
- WhatsApp içi tarayıcı (Android Custom Tab, iOS Safari görünümü): ses yalnız
  ilk dokunuştan sonra; `localStorage` her erişimde try/catch; güvenli alan
  (`env(safe-area-inset-*)`) payları; `touch-action: none`; çift dokunma
  yakınlaştırması ve metin seçimi kapalı; tam ekran isteğe bağlı.
- 60 fps hedef; DPR en fazla 2; kare başına bellek ayırma yok.

## Doğrulama

- Görsel iddiayı telefon görünümünde ekran görüntüsüyle doğrula
  (`scripts/shot.mjs`); "çalışıyor" demeden önce kareye bak.
- Kurallar için vitest; bölümler için bot (`npm run dogrula`).
- Linux bulut ortamında Chromium `/opt/pw-browsers/chromium` (betik kendisi bulur).
