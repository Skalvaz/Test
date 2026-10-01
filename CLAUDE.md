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

## Kullanıcının tercihleri

- Kalite çıtası yüksek: referans War Thunder / DCS seviyesi efektler ve
  gerçek motor detayı. "Çok kaliteli yap" varsayılan beklenti.
- Her görsel değişikliği önce/sonra GIF ya da görüntüyle görmek istiyor.
- Kısa durum bilgisi sever; uzun işlerde ara ara ne yapıldığını söyle.
- Fark seçilmeyen bir karşılaştırmayı README'ye koyma; kadrajı düzelt.

## Öğrenilenler (deneyerek bulundu)

- Otomatik çalıştırma (`a.sim.reset(); a.beginAutoStart()`): yakıt ve
  ateşleme ~23,9 s'de açılır, light-off ~25,1 s, ateşleme ~40 s'de kapanır.
  Motor zaten çalışıyorsa `beginAutoStart` hiçbir şey yapmaz; önce `reset`.
- `a.advance(t)` 1/30 s adımlarla ilerletir; büyük adımlar zamanlamayı kaydırır.
- Yanma odası efekt noktaları (`combustor.userData.injectors/igniters`)
  model uzayında; kesitte yalnız kesit düzlemine yakın 1–2 enjektör görünür,
  bu yüzden alevler yoğun ve HDR parlak olmalı.
- Termal kızıllık ışıklı ortamda dışarıdan zor seçilir; gece + kesit kullan.
- İs izi (`effects.soot`) egzozun ~h/0,2 m arkasından başlar; kamera zemine
  ve egzoz arkasına bakmalı.
- Art yakıcıyı yandan çek (alev kameraya doğru gelmesin): örn. cam
  `[4.2, 0.5, 4.4]`, hedef `[0, -0.15, 4.6]`.
- Yağmur sahnesi: ortam `Havaalanı — yağmur`; M2'de bu ortam yok,
  karşılaştırmada M2 tarafı için `Havaalanı — kapalı` kullan.
- Kayıt sırasında `src/` dosyalarını düzenleme: Vite sayfayı yeniler ve kayıt
  bozulur. Ayar denemelerini ayrı worktree + ayrı portta yap.
- Kayıt süresi neredeyse tamamen shader derlemesi (ANGLE D3D11): bir ortam
  sayfada ilk açılınca öğle ~40 s, gece ~20 s (ışık sayısı değişir → her
  malzeme yeniden derlenir), hücre ~10 s; aynı sayfada tekrar ~0,1 s. Kare
  çizimi 5–10 ms, ekran görüntüsü ~150 ms. 7 sahne tek sayfada ~230 s
  (eskiden sahne başı sayfa ile ~11 dk). `vite preview` yalnız ~%10 hızlı.
- Kayıt tarayıcı profili proje içinde olmamalı: Vite izleyicisi Chrome'un
  kilitli dosyalarında `EBUSY` ile çöküp dev sunucusunu kapatır. Profil
  `node_modules/.cache/capture-profile`'da.
- `envPending` gökyüzü yüklenirken de true (önceden yalnız derleme sırasında);
  eski commit'lerde kayıt `envSerial` artışını bekleyerek doğru çalışır.
- Sahne `setup`'ında nem: `window.__weather.humidity` (derlenmiş sürümde de).
- PowerShell'de `node … | Select-Object -First N` boruyu kapatınca node 255
  ile çıkar; hata sanma.

## Sıradaki işler

1. Kapatma sonrası soğuma karşılaştırması: dış görünümde kızıllık seçilmiyor.
   Kesitte türbin + egzoz borusuna bakan yeni sahne (`scenes/shutdown.json`),
   M2 (`c7ac8e4` + kayıt kancası) ile karşılaştır, `renders/46-m3-shutdown.gif`.
2. Kesit görünümünde iç disk yüzlerinde aşırı parlak yansıma lekeleri var
   (M2'den beri; motor kapalıyken de görünüyor). Disk malzemesinin
   pürüzlülüğü / ortam yansıması incelenecek.
3. Ardından ROADMAP Faz 3'ün sıradaki kilometre taşı.
