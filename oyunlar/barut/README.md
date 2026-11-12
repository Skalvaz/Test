# BARUT — siperi koru

Çöp adamlı, yıkımlı helikopter savaş oyunu. Taramalı piksel sanatı: açık
kâğıt zemin, 7 gri ton, kırmızı kan ve kehribar ateş.

![BARUT](docs/barut.gif)

## Nasıl oynanır

- **Sürükle:** helikopter parmağını izler (göreli; parmağın altında kalmaz).
- **Silahlar kendi ateş eder:** top en yakın hedefe, roketler araçlara ve
  kalabalık piyadeye. Yaklaştıkça top daha isabetli.
- **Amaç:** soldaki siperi dalga dalga gelen düşmana karşı korumak.
  Helikopter düşerse ya da siper düşerse oyun biter.
- Kırmızı kesik çizgi = tank sana nişan aldı; daralan halka = uçaksavar
  atışı geliyor; `< UÇAK` = bombardıman uçağı o yükseklikten geçecek.
- Dalga bitince hasarın varsa dost uçak paraşütle tamir sandığı atar.

Klavye: oklar / WASD, `M` ses.

## Çalıştırma

```powershell
npm ci
npm run dev            # http://localhost:5173
npm test
npm run typecheck
npm run build:single   # → barut.html (çift tıkla açılır) + dist-single/artifact.html
```

Görüntü ve kayıt (dev sunucusu açıkken):

```powershell
node scripts/shot.mjs http://localhost:5173/ kare.png 390 844 "L.basla(); L.ilerlet(5)"
node scripts/kayit.mjs http://localhost:5173/ kareler 30 16 20   # bot pilotla oynatır, kare kaydeder
```
