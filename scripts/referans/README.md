# Referans ölçümler (Dalga 1 tabanı = Dalga 0 sonu)

Dalga 0 ve denetim düzeltmeleri bittikten sonraki yapının değerleri (25.10.2026).
Dalga 0 davranış ve görüntü değiştirmedi: bu yapı Dalga 0 öncesiyle (`e5690e9`)
vitrin setinde piksel piksel, perf sayımlarında birebir aynıdır; yalnız ölçüm
seti (yeni sahneler, ROI'ler, ölçüler) ve ölçüm yöntemi genişledi.

Dalga boyunca dondurulur: paketler bu dosyaları yeniden üretmez, kendi
ölçümlerini `capture-output/<paket>/` altında tutar. Entegratör her birleşmeden
sonra ana kopyada yeniler ve commit mesajında söyler (plan §5, ortak sahiplik
kuralları).

| Dosya | Üreten | İçerik |
|---|---|---|
| `visual-metrics.json` | `node scripts/visual-metrics.mjs capture-output/vitrin/dalga1-once --out …` | Vitrin setinin (17 sahne, varyantlarla boyut başına 22 kare; 1280×720 ve 2560×1440) kare ve ROI ölçümleri: NaN/sonsuz/negatif, kırpılma, parlaklık, ayrıntı (`hf`), ton, histogram, fan/pervane disk FFT (`peak`) |
| `perf-smoke.json` | `node scripts/perf-smoke.mjs <url> --load-runs 5 --out …` (`vite preview`) | Soğuk profil, yüksek kalite, 1440×810: yükleme (5 koşunun medyanı, en kötüsü, hepsi; aşama zamanları), ortam geçişleri, kare CPU süresi (200 kare × 3 pencere, en düşük p50), çizim çağrısı, program sayıları |
| `perf-smoke-ilk-ziyaret.json` | aynı, `--first-visit` | İlk ziyaretçi (ayar yok, oyunun varsayılan kalitesi); sayımlar yüksek kaliteyle aynı |
| `beklenti/<paket>.json` | elle (plan §5 Dalga 1) | Paketin bilerek değiştirdiği perf ölçülerinin yönü ve sınırı: `perf-compare --expect` (1A, 1F, 1I). Dosyası olmayan paket varsayılan kapıdan geçer (sayımlar eşit, kare ±%5) |

Kareler: `capture-output/vitrin/dalga1-once` (yerel, git dışında; aynı
komutla yeniden kaydedilir).

Makine: RTX 4070 Laptop, ANGLE D3D11 (Windows). Başka makinede mutlak
değerler farklıdır; kıyas aynı makinede yapılır.

**Gürültü ve kapılar.** Vitrin kareleri aynı koddan iki kayıtta 44 karenin
hepsinde piksel piksel aynıdır: değişmemesi gereken kareler
`--set vitrin --max-changed 0` ile kıyaslanır. Arayüz setinde (12 ekran × 4
boyut) bir kare koşudan koşuya en çok 141 pikselde oynar: kapı
`--set arayuz --gate 0.995 --max-changed 200`. Yalnız parlaklık SSIM'i yetmez:
Dalga 0'da rengi değişen manuel yakıt kaydırıcısı 598 piksel ve SSIM 0,999
veriyordu. NaN sayısı (kayan noktalı okuma) koşudan koşuya ±%3 oynar.

perf-smoke'ta çizim çağrısı ve program sayıları aynı ölçüm yöntemiyle
belirlenimlidir (ölçüm penceresi değişince değişir: 300 kareden 3 × 200 kareye
geçince hücrede 277 → 278 çizim, 61 → 62 program). Kare CPU süresi aynı kodda
koşudan koşuya %3–6, gün içinde (dizüstünün ısıl durumu) %20–30 oynar. Kare
süresi kapısı bu yüzden iki yapıyı sırayla dönüşümlü koşup (önce, sonra, önce,
sonra) medyanları kıyaslamaktır:

```powershell
foreach ($i in 1..2) { foreach ($p in @(@('once',4202),@('sonra',4201))) {
  node scripts/perf-smoke.mjs "http://localhost:$($p[1])/" --out "capture-output/perf/$($p[0])-$i.json" } }
node scripts/perf-compare.mjs --once capture-output/perf/once-1.json,capture-output/perf/once-2.json --sonra capture-output/perf/sonra-1.json,capture-output/perf/sonra-2.json --expect scripts/referans/beklenti/1A.json
```

Yükleme süreleri tek koşuda iki kat oynar: aynı kodda ilk kare 5 koşuda
14,3–25,6 s (sürücünün shader önbelleği profil dışında; "soğuk" = tarayıcı
soğuk). Yükleme ölçütleri bu yüzden `--load-runs 5` medyanıyla yazılır
(bugün yüksek kalitede hazır 8,7 s / ilk kare 25,1 s; ilk ziyarette 8,5 s /
25,1 s). Tek koşunun `--compare` kapısı yalnız sayımlar içindir (kare süresi
orada bilgi amaçlı; `--gate-frame` ile kapıya girer). `perf-smoke`'un yığın
değeri GC zamanına bağlıdır (aynı kodda %10 oynar).
