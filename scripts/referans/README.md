# Referans ölçümler (Dalga 0)

Dalga 0 başlamadan önceki kodun (`e5690e9`) değerleri. Sonraki paketler kendi
ölçümlerini bunlarla kıyaslar; bir paket bilerek değiştirdiğinde dosyayı
yeniler ve commit mesajında söyler.

| Dosya | Üreten | İçerik |
|---|---|---|
| `visual-metrics.json` | `node scripts/visual-metrics.mjs capture-output/vitrin/once --out …` | Vitrin setinin (12 sahne + varyantlar, 1280×720 ve 2560×1440) kare ve ROI ölçümleri: NaN, kırpılma, parlaklık, ton, histogram, fan/pervane FFT |
| `perf-smoke.json` | `node scripts/perf-smoke.mjs http://localhost:4201/ --out …` | Soğuk profil, yüksek kalite, 1440×810, `vite preview`: yükleme, ortam geçişleri, kare CPU süresi, çizim çağrısı, program sayıları |

Makine: RTX 4070 Laptop, ANGLE D3D11 (Windows). Başka makinede mutlak
değerler farklıdır; kıyas aynı makinede yapılır.

**Gürültü:** vitrin kareleri aynı koddan iki kayıtta piksel piksel aynıdır
(SSIM 1,000). NaN sayısı (kayan noktalı okuma) koşudan koşuya ±%3 oynar.
perf-smoke'ta çizim çağrısı ve program sayıları belirlenimlidir; kare CPU
süresi hücrede ±%3, havaalanında (GPU'ya bağlı, dizüstünün ısıl durumu)
arka arkaya iki soğuk koşuda %27–30 oynadı. Kare süresi kıyası bu yüzden iki
yapıyı sırayla dönüşümlü koşarak (önce, sonra, önce, sonra; `--warm`) ve
medyanları karşılaştırarak yapılır; tek koşunun ±%5 kapısı yalnız sayımlar
için bağlayıcıdır.
