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
node scripts/shot.mjs <url> <png> [w] [h] [bekleme-ms] [js]   # telefon görünümü (390×844)
```

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
- `src/app/` — oyun akışı, modülleri birbirine bağlar.

## Hedef ortam (oyuncu telefondan, WhatsApp'tan gelen bağlantıyla açar)

- Dikey telefon öncelikli: tasarım 390×844, alt sınır 360×640; masaüstünde
  fare + klavye. Tüm düğmeler alt bantta, başparmakla erişilebilir.
- claude.ai sayfa çerçevesinde çalışır: `alert/confirm/prompt` YOK (onayı
  sayfa içinde yap), indirme bağlantısı yok, `window.open` yok, harici
  görsel/ses/fetch yok (yalnız Google Fonts stil bağlantısı). Her şey prosedürel.
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
