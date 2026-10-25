# Referans ölçümler (Dalga 0)

Dalga 0 başlamadan önceki kodun (`e5690e9`) değerleri. Sonraki paketler kendi
ölçümlerini bunlarla kıyaslar; bir paket bilerek değiştirdiğinde dosyayı
yeniler ve commit mesajında söyler.

| Dosya | Üreten | İçerik |
|---|---|---|
| `visual-metrics.json` | `node scripts/visual-metrics.mjs capture-output/vitrin/once --out …` | Vitrin setinin (12 sahne + varyantlar, 1280×720 ve 2560×1440) kare ve ROI ölçümleri: NaN, kırpılma, parlaklık, ton, histogram, fan/pervane FFT |
| `perf-smoke.json` | `node scripts/perf-smoke.mjs http://localhost:4202/ --out …` (`e5690e9` yapısı, `vite preview`) | Soğuk profil, yüksek kalite, 1440×810: yükleme, ortam geçişleri, kare CPU süresi (200 kare × 3 pencere, en düşük p50), çizim çağrısı, program sayıları |

Makine: RTX 4070 Laptop, ANGLE D3D11 (Windows). Başka makinede mutlak
değerler farklıdır; kıyas aynı makinede yapılır.

**Gürültü:** vitrin kareleri aynı koddan iki kayıtta piksel piksel aynıdır
(SSIM 1,000; arayüz kümesinde 700×900 ve 960×600'de koşudan koşuya ≤ 46
pikselde ≤ 2/255 oynama). NaN sayısı (kayan noktalı okuma) koşudan koşuya
±%3 oynar. perf-smoke'ta çizim çağrısı ve program sayıları aynı ölçüm
yöntemiyle belirlenimlidir (ölçüm penceresi değişince değişir: 300 kareden
3 × 200 kareye geçince hücrede 277 → 278 çizim, 61 → 62 program; referans
bu yüzden yeni yöntemle yenilendi). Kare CPU süresi aynı kodda koşudan koşuya
%3–6, gün içinde (dizüstünün ısıl durumu) %20–30 oynar: ilk referansta öğle
8,7 ms, aynı kodun saatler sonraki koşusunda 10,4 ms. Kare süresi kapısı bu
yüzden iki yapıyı sırayla dönüşümlü koşup (önce, sonra, önce, sonra)
medyanları kıyaslamaktır:

```powershell
foreach ($i in 1..2) { foreach ($p in @(@('once',4202),@('sonra',4201))) {
  node scripts/perf-smoke.mjs "http://localhost:$($p[1])/" --out "capture-output/perf/$($p[0])-$i.json" } }
node scripts/perf-compare.mjs --once capture-output/perf/once-1.json,capture-output/perf/once-2.json --sonra capture-output/perf/sonra-1.json,capture-output/perf/sonra-2.json
```

Tek koşunun `--compare` kapısı yalnız sayımlar içindir (kare süresi orada
bilgi amaçlı; `--gate-frame` ile kapıya girer). `perf-smoke`'un yığın değeri
GC zamanına bağlıdır (aynı kodda %10 oynar); zorla GC sonrası iki yapı
0,2 MB içinde aynıydı.
