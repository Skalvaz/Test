# EBRULİ — çalışma notları

Turbofan'dan ve FİTİL'den BAĞIMSIZ bir alt proje: ebru temalı eşleştirmeli
bulmaca, **deneme sürümü** (20 bölüm, 2 atölye). Asıl ürün FİTİL'dir
(`oyunlar/fitil`, ona DOKUNMA; örnek olarak okunabilir). Canvas 2D + DOM +
TypeScript + Vite, kendi package.json'ı. Kök CLAUDE.md'deki turbofan maddeleri
burada geçerli değil; dil ve commit kuralları geçerli: kullanıcıyla, kod
yorumlarında, commit mesajlarında ve arayüz metinlerinde Türkçe. Emoji yok;
ikonlar satır içi SVG.

- Tasarım belgesi: `docs/GDD.md` (bağlayıcı; § numaralarıyla atıf yap). §0
  karar günlüğü ve kural simülasyonu: kuralı değiştirmeden önce oku.
- Sözleşmeler: `src/core/types.ts` (durum, damla, olaylar, önizleme, bölüm
  verisi), `src/core/index.ts` (çekirdek API; P0'da `hamleUygula`, `onizle`,
  `olumluHamleler`, `ebruSoleni`, `ustaEliUygula`, `olayUygula`, `gorselFark`
  taslak → P1), `src/app/sozlesme.ts` (OyunCizici, SurukleGirdi, SesMotoru,
  TabloCizici), `src/app/katalog.ts` (renkler, motifler, atölyeler, teknikler).
  Var olan alanın anlamını değiştirme; alan eklemek serbest.

## Kural özeti (GDD §0, §3, §4)

- Renk kodu 3 bit: ham K 1, S 2, M 4; karışık T 3, Mo 5, Y 6; Mürekkep 7.
  Hamle: komşuya sürükle; **ham + farklı ham = karışık** hedefte doğar, kaynak
  boşalır, sütun iner. Yalnız karışık renkler 3+ grupla eşleşir.
- K1: karışık + eksik ham → Mürekkep yalnız `murekkep: true` bölümlerde (11+).
- K2: doğum `[20, 20, 20, 11, 11, 11]` (karışık ≈ %35). K3: **garanti** (öğretim
  3, normal 2, zor 1): son dolumda doğanların rengi, en az `garanti` hazır
  karışım çifti kalacak biçimde doğmadan önce seçilir.
- Çözümleme: yerçekimi (dolumsuz) → eşleşme → temizlik; grup kalmayınca dolum
  (+ garanti). Bu yüzden önizleme (doğumsuz çözüm) hamlenin ilk dolumdan
  önceki kısmıyla BİREBİR aynıdır (P1 testi).
- Özel taşlar 4 Tarak / 5 Girdap (baklava r2) / 6 Lale; Mürekkep; 10 birleşim.

## Komutlar (proje klasöründe: `oyunlar/ebruli`)

```powershell
npm ci                      # yeni worktree'de ilk iş (node_modules izlenmez)
npm run dev                 # http://localhost:5173 (telefondan aynı ağda IP:5173)
npm test                    # vitest
npm run typecheck
npm run build:single        # → ebruli.html + dist-single/artifact.html
node scripts/shot.mjs <url> <png> [w] [h] [bekleme-ms] [js]   # ekran görüntüsü (varsayılan 390×844)
npm run oynanis -- file:///…/ebruli.html playtest-output [telefon|kucuk|masaustu]
# P2 gelince:
npm run bot -- --bolum 5 --tohum 200 --bot usta
npm run dogrula             # bölüm doğrulama (bot bantları, GDD §14)
npm run kalibre -- --bolum 6
```

Komutlar Windows PowerShell'de de çalışmalı: npm betiklerinde `VAR=1 komut`
gibi POSIX sözdizimi kullanma. Bot koşularında en fazla 2 işçi (4 çekirdek).

## Modüller ve sınırlar (GDD §13.1)

- `src/core/` — saf kurallar. DOM, `Date`, `performance`, `Math.random`,
  ondalık sabit yok; zaman birimi tik; RNG `OyunDurumu.rng` (mulberry32).
  `hamleUygula` girdiyi değiştirmez. Çizici olayları `olayUygula` ile uygular,
  `gorselFark` ile eşitler; `oynatici.test.ts` bulanık testi zorunlu (GDD §13.2).
- `src/levels/veri/bNNN.json` — bölümler (şema GDD §15.1, plan §15.2).
- `src/bot/` — Acemi/Usta (GDD §14), `sim-cli.ts` (tsx).
- `src/render/` — tek tuval sahnesi; `damla.ts` başvuru çizim tarifi (§11.3).
  `shadowBlur` yasak (parıltı gradyan/sprite'tan), DPR ≤ 2, kare başına bellek
  ayırma yok, offscreen önbellek (anahtar: hücre × DPR × palet × motif).
- `src/tablo/` — ebru tablosu (§9): temizlik günlüğünden belirlenimli.
- `src/audio/` — WebAudio sentezi; `synth.ts`, `havuz.ts`, `gurultu.ts` taban
  (FİTİL'den), `sesMotoru.ts` P5.
- `src/input/` — `SurukleGirdi` (pointer, dokun-dokun, klavye).
- `src/ui/` — DOM ekranları; `yazitipi.ts` (Cormorant Garamond 700 + Alegreya
  Sans 500/800, FontFace'e ikili veri).
- `src/platform/` — SaveStore (bulut/tarayıcı/bellek), hot, haptics, görsel RNG.
- `src/app/` — `iskelet.ts` (P0 geçici sahne; P7 siler), P7: `uygulama.ts`,
  `oturum.ts`, test kancası `window.__ebruli` (GDD §13.6).

## Hedef ortam (oyuncu telefondan, WhatsApp'tan gelen claude.ai bağlantısıyla açar)

- Android'de dosya Chrome'da da açılır; iPhone'da dosya ÇALIŞMAZ (yalnız
  bağlantı). `index.html`'deki betiksiz yedek ekran (`#jsyok`) bunu anlatır;
  yayın bağlantısı belli olunca iPhone paragrafına eklenmeli.
- Sayfa çerçevesinde `alert/confirm/prompt`, indirme, `window.open` YOK; harici
  ağ isteği yok (her şey prosedürel ve gömülü). `touch-action: none`, güvenli
  alan payları, ses ilk dokunuştan sonra, `localStorage` her erişimde try/catch.
- İlk dokunuşta donma olmasın: açılış ekranı beklerken ilk bölüm
  `cizici.onIsit` ile önden pişer; yeniden boyutlanmada anahtarlı önbellek.

## Doğrulama

- "Çalışıyor" demeden önce telefon görünümünde (360×640, 390×844) ve
  1280×800'de ekran görüntüsü al ve kareye bak (`scripts/shot.mjs`,
  `scripts/oynanis.mjs`). Linux bulut ortamında Chromium `/opt/pw-browsers/chromium`.
- Kurallar için vitest; bölümler için bot (`npm run dogrula`, GDD §14.4 bantları:
  öğretim Acemi ≥ %95, tanıtım ≥ %40, normal ≥ %25, zor ≥ %10, rahatlama ≥ %60).
- Sık commit at (oturum limiti riski).

## Deneyerek bulundu (P0 kural simülasyonu, GDD §0.1)

- Konseptin saf kuralı (karışık doğum %0) açgözlü botta hamlelerin yalnız
  %22'sinde eşleşiyor; durumların %85'inde hazır hamle yok. Konseptin
  "yardım n" yeniden çekimi bunu kurtarmıyor (%36–84 başarısız).
- Garanti 2 ile 0 hazırlı durum %1–2, ≥ 2 hazır %93–97, Acemi eşleşmesi %76.
- Yayılma (ham kümesi bütünüyle karışır), kümeli doğum ve ham eşleşmesi
  denendi, reddedildi (tablo GDD §0.1). Lale (6+) doğal oyunda çok nadir
  (< 0,01/hamle): Lale bölümleri kurgulu açılışla gelir.
- Prototip ve ham çıktılar: `dev/kural-sim/` (çekirdekten bağımsız, özel
  taşları basitleştirilmiş; `npx tsx dev/kural-sim/tarama4.ts 150 a`, bir
  yapılandırma ≈ 1–3 dk; `t1-temel.txt` yarıda kesildi). Bölüm ayarı için
  değil, kural kıyası için; bağlayıcı ölçüm P1 çekirdeği + P2 botuyla yapılır.
