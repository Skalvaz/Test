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
| `setup` | başlangıçta çalışan JS; `a` (App) ve `sim` kullanılabilir |
| `frames`, `dt` | kare sayısı ve kare başına simülasyon süresi (s) |
| `actions` | `{ "kare-no": "js" }`: o karede çalışır (ör. yakıtı kesmek) |
| `skip` | baştan atlanacak (kaydedilmeyen) kare sayısı |

Seçenekler: `--headed` (pencereli), `--swiftshader` (yazılımsal çizim,
GPU'suz sunucu). Başka bir Chromium için `CAPTURE_CHROMIUM` ortam
değişkenine yolunu yazın.
