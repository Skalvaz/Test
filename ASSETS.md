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
| Motor gövdeleri, kanatlar, gaz yolu, alev ve parçacık dokuları | `src/engine/*`, `src/materials/textures.js`, `src/effects/*` | Çalışma anında prosedürel |

Etiket metinleri (FUEL, OIL, HYDRAULIC, DANGER HIGH VOLTAGE, EEC/FADEC bilgi
plakası, NO STEP, LIFT POINT, FLOW) Blender'ın gömülü varsayılan yazı
tipiyle ("Bfont", Blender ile birlikte serbest lisansla dağıtılır) yazılıp
pişirilmiştir. Parça numaraları ve seri numaraları uydurmadır, gerçek bir
ürüne ait değildir.

## Dış kaynaklar (CC0)

Hepsi **CC0** (kamu malı eşdeğeri: atıf zorunlu değil, ticari kullanım
serbest). Yine de yazarları teşekkür amacıyla listelenir. İndirme ve
dönüştürme tekrar üretilebilir: `npm run assets:fetch`
(`scripts/fetch-assets.mjs`; ham dosyalar `build/dl/` altında önbelleklenir).

### HDRI ortamları — [Poly Haven](https://polyhaven.com)

2K Radiance HDR, "RGB + log parlaklık" olarak iki WebP'ye kodlanır
(6,5 MB → 0,6–1 MB; tarayıcıda half-float HDR'ye çözülür). Oyunda ortam ışığı + yansıma (PMREM) ve zemine yansıtılmış
arka plan (GroundedSkybox) olarak kullanılır; güneş yönü ve pozlama HDRI'dan
hesaplanır.

| Dosya | Kaynak | Yazar(lar) |
| --- | --- | --- |
| `src/assets/hdri/hangar_interior_2k.hdr` | [Hangar Interior](https://polyhaven.com/a/hangar_interior) | Dimitrios Savva, Jarod Guest |
| `src/assets/hdri/hanger_exterior_cloudy_2k.hdr` | [Hanger Exterior Cloudy](https://polyhaven.com/a/hanger_exterior_cloudy) | Dimitrios Savva, Jarod Guest |
| `src/assets/hdri/machine_shop_02_2k.hdr` | [Machine Shop 02](https://polyhaven.com/a/machine_shop_02) | Sergej Majboroda |

### Malzeme taramaları — [ambientCG](https://ambientcg.com)

Motor gövdesi 2K, diğerleri 1K/512 px WebP. "tint" türü taramalar gri tonlamaya çevrilip doğrusal
ortalaması 0,5'e normalize edilir (oyun kendi rengiyle çarpar); ORM dokusu
AO + pürüzlülük + metallik haritalarından paketlenir.

| Dosya | Kaynak | Kullanım |
| --- | --- | --- |
| `src/assets/scans/case_*.webp` | [Metal059B](https://ambientcg.com/view?id=Metal059B) | kaportasız motor gövdesi (titanyum/çelik) |
| `src/assets/scans/hot_*.webp` | [Metal063](https://ambientcg.com/view?id=Metal063) | sıcak bölge, egzoz, art yakıcı kanalı |
| `src/assets/scans/dark_*.webp` | [Metal046B](https://ambientcg.com/view?id=Metal046B) | lüle yaprakları, isli parçalar |
| `src/assets/scans/brushed_*.webp` | [Metal009](https://ambientcg.com/view?id=Metal009) | işlenmiş çelik (kit parçaları, flanşlar) |
| `src/assets/scans/polished_*.webp` | [Metal012](https://ambientcg.com/view?id=Metal012) | paslanmaz boru, tank |
| `src/assets/scans/smooth_*.webp` | [Metal032](https://ambientcg.com/view?id=Metal032) | eloksal, kaplamalı parçalar |
| `src/assets/scans/cast_*.webp` | [Metal041A](https://ambientcg.com/view?id=Metal041A) | döküm muhafazalar, dişli kutusu |
| `src/assets/scans/paint_*.webp` | [PaintedMetal004](https://ambientcg.com/view?id=PaintedMetal004) | boyalı kutular, stand, platformlar |
| `src/assets/scans/rubber_*.webp` | [Rubber004](https://ambientcg.com/view?id=Rubber004) | hortum, izolatör |

### 3B modeller — [Poly Haven](https://polyhaven.com)

glTF 1K → dokular WebP (512 px; uzaktan görülürler), vinçte üçgen sayısı %35'e indirilmiş, geometri meshopt ile sıkıştırılmış
glb. Test hücresinde gerçek zamanlı aydınlatılır (`src/core/cellProps.ts`).

| Dosya | Kaynak | Yazar(lar) |
| --- | --- | --- |
| `src/assets/props/metal_tool_chest.glb` | [Metal Tool Chest](https://polyhaven.com/a/metal_tool_chest) | Yann Kervran, John Hutcheson |
| `src/assets/props/tool_cart.glb` | [Tool Cart](https://polyhaven.com/a/tool_cart) | Savva Zakharov |
| `src/assets/props/portable_welding_cart.glb` | [Portable Welding Cart](https://polyhaven.com/a/portable_welding_cart) | Georgii Gorbunov |
| `src/assets/props/hand_truck.glb` | [Hand Truck](https://polyhaven.com/a/hand_truck) | Mutanzom3D |
| `src/assets/props/steel_frame_shelves_01.glb` | [Steel Frame Shelves 01](https://polyhaven.com/a/steel_frame_shelves_01) | James Ray Cock |
| `src/assets/props/korean_fire_extinguisher_01.glb` | [Korean Fire Extinguisher 01](https://polyhaven.com/a/korean_fire_extinguisher_01) | UM JOORIN |
| `src/assets/props/barrel_03.glb` | [Barrel 03](https://polyhaven.com/a/barrel_03) | Serhii Khromov |
| `src/assets/props/industrial_storage_cart.glb` | [Industrial Storage Cart](https://polyhaven.com/a/industrial_storage_cart) | Jule Bielitz |
| `src/assets/props/power_box_01.glb` | [Power Box 01](https://polyhaven.com/a/power_box_01) | Rico Cilliers, Yann Kervran |
| `src/assets/props/overhead_crane.glb` | [Overhead Crane](https://polyhaven.com/a/overhead_crane) | Timothy3D |

## Referanslar (varlık değil, yalnız bilgi)

Modeller genel mühendislik bilgisine ve kamuya açık belgelere göre
tasarlandı; herhangi bir üreticinin çizimi, ticari markası ya da logosu
kullanılmadı. Etiket renkleri boru tanımlama geleneğini izler (yakıt kırmızı,
yağ sarı-kahve, hidrolik mavi).

