# Varlık kaydı

Projedeki her 3B model ve dokunun kaynağı, üretim yöntemi ve lisansı burada
tutulur. Kural: **yalnız kendi ürettiğimiz ya da CC0 / kamu malı** varlıklar
kullanılır; dışarıdan gelen her dosya kaynağıyla birlikte buraya yazılır.

## Kendi ürettiklerimiz (kodla, yeniden üretilebilir)

Hepsi bu deponun lisansı altındadır. Blender betikleri başsız çalışır
(`bpy` Python paketi); elle düzenlenmiş `.blend` dosyası yoktur.

| Dosya | Üreten | Yöntem |
| --- | --- | --- |
| `src/assets/testcell.glb` | `blender/testcell.py` | Motor test hücresi modeli, Cycles ile ışık pişirme |
| `src/assets/{nacelle,core,pylon}_{normal,orm}.webp` | `blender/panel_details.py` | Perçin/panel/kapak detayı, yüksek poligondan pişirme |
| `src/assets/kit.glb` | `blender/kit_parts.py` → `scripts/pack-kit.mjs` | 31 dış donanım parçası × 3 detay seviyesi (L0 ≈ 19 k, L1 ≈ 11,5 k, L2 ≈ 6 k üçgen toplam); nicemleme + meshopt sıkıştırma |
| `src/assets/trim_{albedo,normal,orm}.webp` | `blender/trim_sheet.py` | Trim sheet: kaynak dikişi, tırtıl, perçin sırası, panjur, 8 etiket; yüksek poligondan pişirme |
| `src/assets/mat_{cast,machined,paint}_{normal,orm}.webp` | `blender/materials.py` | Dikişsiz malzeme dokuları (4B gürültü tor eşlemesi), Cycles ile pişirme |
| Motor gövdeleri, kanatlar, gaz yolu, alev ve parçacık dokuları | `src/engine/*`, `src/materials/textures.js`, `src/effects/*` | Çalışma anında prosedürel |

Etiket metinleri (FUEL, OIL, HYDRAULIC, DANGER HIGH VOLTAGE, EEC/FADEC bilgi
plakası, NO STEP, LIFT POINT, FLOW) Blender'ın gömülü varsayılan yazı
tipiyle ("Bfont", Blender ile birlikte serbest lisansla dağıtılır) yazılıp
pişirilmiştir. Parça numaraları ve seri numaraları uydurmadır, gerçek bir
ürüne ait değildir.

## Dış kaynaklar (CC0 / kamu malı)

Henüz yok. Planlanan kaynaklar (her biri CC0):

- [Poly Haven](https://polyhaven.com) — HDRI ortam haritaları, malzeme taramaları
- [ambientCG](https://ambientcg.com) — malzeme taramaları

Not: bu geliştirme ortamının ağ ayarı şu an `polyhaven.com` ve `ambientcg.com`
alan adlarına izin vermiyor; M1'deki malzeme dokuları bu yüzden Blender'da
prosedürel olarak üretildi. Erişim açılırsa taramalar eklenip bu tabloya
yazılacak.

## Referanslar (varlık değil, yalnız bilgi)

Modeller genel mühendislik bilgisine ve kamuya açık belgelere göre
tasarlandı; herhangi bir üreticinin çizimi, ticari markası ya da logosu
kullanılmadı. Etiket renkleri boru tanımlama geleneğini izler (yakıt kırmızı,
yağ sarı-kahve, hidrolik mavi).
