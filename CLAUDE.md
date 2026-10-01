# Turbofan Akademi — çalışma notları

Gerçek termodinamik modelle çalışan jet motoru eğitim oyunu: three.js (r186)
+ TypeScript + Vite. Yol haritası `ROADMAP.md`'de (Faz 3 kilometre taşları
M1…), varlık kaynakları `ASSETS.md`'de.

## Kurallar

- Kullanıcıyla Türkçe konuş. Kod yorumları ve commit mesajları da Türkçe.
- Çalışma dalı: `claude/hyperrealistic-jet-engine-xlf5ck`. İstenmedikçe PR açma.
- Her kilometre taşının sonunda: `npm run typecheck`, `npm test`,
  önce/sonra karşılaştırması (`scripts/capture`), README'ye görseller,
  ROADMAP'te ✅, `npm run build:single` ile `turbofan.html`, commit + push.
- Görsel iddiaları ekran görüntüsüyle doğrula; "çalışıyor" demeden önce kareye bak.
- Geliştirme makinesi Windows + RTX 4070 (dizüstü). PowerShell komutları yaz;
  POSIX'e özgü sözdizimi (`VAR=1 komut`, `&` ile arka plan) kullanma.

## Komutlar

```powershell
npm run dev                 # http://localhost:5173
npm test                    # vitest (simülasyon)
npm run typecheck
npm run build:single        # → turbofan.html (tek dosya, çift tıkla açılır)
npm run capture -- http://localhost:5173/ capture-output/after surge rain
npm run capture:compare -- capture-output/before/surge capture-output/after/surge cmp.gif "surge"
node scripts/playtest.mjs playtest-output   # vite preview --port 4173 açıkken
```

Önce/sonra için eski commit'i `git worktree add ../turbofan-once <commit>` ile
ayrı klasörde ikinci portta çalıştır (`scripts/capture/README.md`).

## Kod haritası

- `src/sim/` — termodinamik çevrim ve motor tipleri (testli).
- `src/app/App.ts` — ana döngü; test kancaları: `advance(s)`, `fixedDt` /
  `pendingSteps` / `framesRendered` (belirlenimli kare kaydı), `window.__app`.
- `src/engine/visual.ts` — modeli simülasyona bağlar: lüle, termal kızıllık
  (`thermal` + `glow()`), yanma odası noktaları, surge.
- `src/engine/*.js` — prosedürel motor parçaları (stages, combustor, nozzle…).
- `src/effects/` — `EngineEffects.js` (parçacıklar, is izi, şok halkası,
  yanma odası efektleri), `AfterburnerFlame.js` (raymarch alev, 5 zon),
  `Particles.js`.
- `src/core/` — ortam/HDRI (`environment.js`), havaalanı, `postfx.js` (ısı
  pusu), `weather.ts` (nem/yağmur durumu), `rain.ts`.
- `src/materials/` — shader yamaları (`addPatch`), yıpranma, ıslak zemin.
- `blender/` — varlıkları kodla üreten Blender betikleri (bpy 4.5).

## Bilinen tuzaklar

- GLSL'de `flat` gibi ayrılmış sözcükler değişken adı olamaz.
- Dünya uzayında dönen dörtgenler `side: THREE.DoubleSide` ister.
- Parçacıklar kameraya yakınken solar (`vNear`); kesit gibi yakın
  görünümlerde alfa/parlaklığı buna göre ayarla.
- `vite.config.js` değişince dev sunucusu yeniden başlar; süren kayıt bozulur.

## Sıradaki işler

1. Kayıt hızlandırma: `scripts/capture/batch.mjs` her sahnede tarayıcıyı ve
   sayfayı yeniden açıyor (sahne başı ~2–3 dk yükleme). Tek sayfada sırayla
   kaydet; kaydı `vite preview` (derlenmiş) üzerinden almayı dene.
2. Kapatma sonrası soğuma karşılaştırması: dış görünümde kızıllık seçilmiyor.
   Kesitte türbin + egzoz borusuna bakan yeni sahne (`scenes/shutdown.json`),
   M2 (`c7ac8e4` + kayıt kancası) ile karşılaştır, `renders/46-m3-shutdown.gif`.
3. Kesit görünümünde iç disk yüzlerinde aşırı parlak yansıma lekeleri var
   (M2'den beri; motor kapalıyken de görünüyor). Disk malzemesinin
   pürüzlülüğü / ortam yansıması incelenecek.
4. Ardından ROADMAP Faz 3'ün sıradaki kilometre taşı.
