# Sahne kaydı ve önce/sonra GIF'leri

Oyundaki sahneleri kare kare, belirlenimli olarak kaydeder. Hızlı ya da yavaş
makinede aynı kareler çıkar: oyunun test kancası (`App.fixedDt`) her karede
simülasyonu tam `dt` kadar ilerletir ve kareyi yalnız istendiğinde çizer.
Ekran kartıyla bir kare milisaniyeler sürer. GPU'suz sunucuda yazılımsal
çizimle kare başına 20–30 saniye sürer.

## Kurulum (bir kez)

```sh
npm install
npx playwright install chromium
```

## Tek sahne

Dev sunucusunu başlatın (`npm run dev`), sonra başka bir terminalde:

```sh
node scripts/capture/record.mjs http://localhost:5173/ surge capture-output/after/surge --gif
```

İlk satır kullanılan çiziciyi yazar. Orada ekran kartınızın adı
(ör. `NVIDIA GeForce RTX 4070`) görünmeli. `SwiftShader` yazıyorsa
`--headed` ile pencereli kipte deneyin.

## Bütün sahneler

```sh
node scripts/capture/batch.mjs http://localhost:5173/ capture-output/after
node scripts/capture/batch.mjs http://localhost:5173/ capture-output/after ab surge rain
```

Toplu kayıt tarayıcıyı ve sayfayı **bir kez** açar, sahneleri aynı sayfada
art arda kaydeder. Her sahneden önce motor yeniden boyutlandırılır, rölantiye
dengelenir ve 3B model yeniden üretilir (sayfa yeni açılmış gibi; is, ısıl
kızıllık, parçacıklar taşınmaz). GIF'ler sonraki sahne kaydedilirken kodlanır.

Süre neredeyse tamamen ortam hazırlığındadır: bir ortam sayfada **ilk kez**
açılınca bütün malzemeler o ortamın ışık düzenine göre derlenir ve havaalanı
yansıma haritasına çizilir (RTX 4070, D3D11: öğle ~40 s, gece ~20 s, test
hücresi ~10 s). Aynı sayfada aynı ortama dönmek ~0,1 s sürer. Bu yüzden
sahne başına sayfa açmak (eski yöntem) her sahnede bu bedeli yeniden öder.

Tarayıcı profili kalıcıdır (`node_modules/.cache/capture-profile`, Vite'ın
izlemediği yer); Chrome'un GPU shader önbelleği kayıtlar arasında korunur.
`--fresh-profile` profili silip baştan başlar.

## Önce/sonra karşılaştırması

Eski sürümü ayrı bir klasöre alıp ikinci bir portta çalıştırın:

```sh
git worktree add ../turbofan-once <eski-commit>
cd ../turbofan-once
npm install
npx vite --port 5174
```

Kayıt kancası M3'ten (`8d937eb`) beri koddadır. Daha eski bir commit için
`src/app/App.ts` içindeki `fixedDt` / `pendingSteps` / `framesRendered`
bölümünü o sürüme kopyalayın.

```sh
node scripts/capture/batch.mjs http://localhost:5174/ capture-output/before
node scripts/capture/batch.mjs http://localhost:5173/ capture-output/after
node scripts/capture/compare.mjs capture-output/before/surge capture-output/after/surge capture-output/cmp_surge.gif "surge" 400 10
```

İş bitince: `git worktree remove ../turbofan-once`.

## Sahne tanımı (`scenes/*.json`)

| Alan | Anlamı |
| --- | --- |
| `kind` | motor: `turbofan`, `militaryTurbofan`, `turbojet`, `turboprop` |
| `env` | ortam adı (oyundaki menüdeki gibi, ör. `Havaalanı — gece`) |
| `quality` | `low` / `medium` / `high` |
| `w`, `h` | kare boyutu (piksel) |
| `cam`, `tgt`, `fov`, `cut` | kamera konumu, hedefi, görüş açısı, kesit (0/1) |
| `setup` | başlangıçta çalışan JS; `a` (App) ve `sim` kullanılabilir; nem için `window.__weather.humidity` |
| `frames`, `dt` | kare sayısı ve kare başına simülasyon süresi (s) |
| `actions` | `{ "kare-no": "js" }`: o karede çalışır (ör. yakıtı kesmek) |
| `skip` | baştan atlanacak (kaydedilmeyen) kare sayısı |

Seçenekler: `--headed` (pencereli), `--swiftshader` (yazılımsal çizim,
GPU'suz sunucu), `--fresh-profile` (shader önbelleğini sil). Başka bir Chromium için `CAPTURE_CHROMIUM` ortam
değişkenine yolunu yazın.

## Vitrin kadraj seti (Dalga 0, T-19)

Bundan sonraki bütün önce/sonra karşılaştırmaları bu seti kullanır:
`scenes/vitrin/` altında 12 sahne (galerideki 010, 314, 322, 326, 352, 353,
360, 401, 404, 405, 411, 511 kadrajları; 322 ve 411'de rölanti, 352'de kuru
varyant), her biri 1280×720 ve 2560×1440, ROI tanımlarıyla.

```sh
node scripts/capture/vitrin.mjs http://localhost:5201/ capture-output/vitrin/once            # vitrin seti
node scripts/capture/vitrin.mjs http://localhost:5201/ capture-output/vitrin/once --set hepsi # + arayüz seti
node scripts/visual-metrics.mjs capture-output/vitrin/sonra --compare capture-output/vitrin/once --gate 0.995
node scripts/visual-metrics.mjs capture-output/vitrin/once --overlay capture-output/vitrin/roi  # ROI'leri karede göster
```

Kayıt belirlenimlidir: sayfa açılır açılmaz App donar (kare yalnız
istenince), `Math.random` tohumlu, `performance.now` yalnız çizilen karelerle
ilerleyen sanal saat; ikisi de sahne başında sıfırlanır, ses kapalıdır. Aynı
koddan iki kayıt bütün karelerde piksel piksel aynıdır (SSIM 1,000). Yan
dosyadaki NaN sayısı (kayan noktalı okuma) koşudan koşuya ±%3 oynar; görüntü
oynamaz. Set hep `index.json` sırasıyla ve boyut başına yeni sayfada
kaydedilir (rüzgâr tulumu gibi kapalı saatler sıraya bağlı). `--only` yalnız
hata ayıklama içindir.

ROI şekilleri normalize koordinattadır (0..1, sol üst köşe): dikdörtgen
`[x0, y0, x1, y1]`, `{ "type": "poly", "pts": [[x, y], …] }`,
`{ "type": "ellipse", cx, cy, rx, ry, rot }` (rx genişliğin, ry yüksekliğin
oranı), `{ "type": "ring", …, r0, r1 }` (halka; `blades` alanı varsa polar
FFT), `exclude: [şekil, …]`. Arayüzün kadrajı değiştirdiği sahnelerde (menü,
atölye) `roiBySize["2560x1440"]` ayrı tanımlıdır.

`--set arayuz` menü, ders seçimi, bilgi bankası, ayarlar, ders 2, test
hücresi (açı 1 ve kesit), atölye başlangıç/düzenleme/mimari ekranlarını
1440×810, 1280×720, 960×600 ve 700×900'de kaydeder (CSS kırılım noktaları).
