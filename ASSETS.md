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
| `src/assets/airfield.glb` | `blender/airfield.py` → `scripts/pack-kit.mjs` | Havaalanı: apron, taksi yolu, pist, yollar, işaretler, iki hangar (kafes kemer kirişler, ışıklıklar, ofis katı), kule, operasyon binası, itfaiye, yakıt sahası, radar, rüzgâr tulumu, ışık direkleri, tabelalar |
| `src/assets/veg/veg_{color,normal}.webp` | `blender/impostors.py` | Bitki impostor atlası: Poly Haven ağaç/çalı/çim modellerinin yandan ortografik renderı (albedo × AO, teğet uzayı normal) |
| Arazi, tarlalar, köyler, tel çit panelleri, elektrik telleri, trafik konileri | `src/core/terrain.ts`, `src/core/afProps.ts` | Çalışma anında prosedürel |
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

### Gökyüzü HDRI'ları — [Poly Haven](https://polyhaven.com)

Yalnız "pure sky" türü (fotoğrafta zemin yok): ufkun altı oyunun 3B
havaalanıdır. 2K Radiance HDR, "RGB + log parlaklık" olarak iki WebP'ye
kodlanır (tarayıcıda half-float HDR'ye çözülür). Oyunda gökyüzü arka planı,
güneş yönü/rengi ve sis rengi buradan gelir; yansıma haritası gökyüzü +
havaalanı sahnesinden yakalanır.

| Dosya | Kaynak | Yazar(lar) |
| --- | --- | --- |
| `src/assets/hdri/kloofendal_48d_partly_cloudy_puresky_{rgb,l}.webp` | [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | Greg Zaal, Jarod Guest |
| `src/assets/hdri/overcast_soil_puresky_{rgb,l}.webp` | [Overcast Soil (Pure Sky)](https://polyhaven.com/a/overcast_soil_puresky) | Jarod Guest, Sergej Majboroda |
| `src/assets/hdri/industrial_sunset_puresky_{rgb,l}.webp` | [Industrial Sunset (Pure Sky)](https://polyhaven.com/a/industrial_sunset_puresky) | Jarod Guest, Sergej Majboroda |

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
| `src/assets/scans/apron_*.webp` | [Concrete047A](https://ambientcg.com/view?id=Concrete047A) | apron beton plakaları, bina panelleri |
| `src/assets/scans/asphalt_*.webp` | [Asphalt031](https://ambientcg.com/view?id=Asphalt031) | pist, yollar |
| `src/assets/scans/taxiway_*.webp` | [Road012A](https://ambientcg.com/view?id=Road012A) | taksi yolu |
| `src/assets/scans/grass_*.webp` | [Grass004](https://ambientcg.com/view?id=Grass004) | arazi, çayır |
| `src/assets/scans/gravel_*.webp` | [Gravel043](https://ambientcg.com/view?id=Gravel043) | omuzlar, çakıl şeritler |
| `src/assets/scans/corrugated_*.webp` | [CorrugatedSteel005](https://ambientcg.com/view?id=CorrugatedSteel005) | hangar duvar/çatısı, saptırma duvarı |
| `src/assets/scans/shutter_*.webp` | [CorrugatedSteel009](https://ambientcg.com/view?id=CorrugatedSteel009) | hangar ve itfaiye kapıları |

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

### Havaalanı donanımı — [Poly Haven](https://polyhaven.com)

glTF 1K → dokular WebP (512/256 px), üçgen sayısı azaltılmış (meshoptimizer),
nicemleme + meshopt sıkıştırma. Modüler setlerden yalnız kullanılan parçalar
alınır (çit: tel malzemesi, direk: üç hazır takım). Yerleşim:
`src/core/afProps.ts`; açık hangarın içinde hücre modelleri de kullanılır.

| Dosya | Kaynak | Yazar(lar) |
| --- | --- | --- |
| `src/assets/afprops/concrete_road_barrier.glb` | [Concrete Road Barrier](https://polyhaven.com/a/concrete_road_barrier) | Amal Kumar |
| `src/assets/afprops/concrete_road_barrier_02.glb` | [Concrete Road Barrier 02](https://polyhaven.com/a/concrete_road_barrier_02) | Amal Kumar |
| `src/assets/afprops/modular_chainlink_fence.glb` | [Modular Chainlink Fence](https://polyhaven.com/a/modular_chainlink_fence) | James Ray Cock, Amal Kumar |
| `src/assets/afprops/modular_electricity_poles.glb` | [Modular Electricity Poles](https://polyhaven.com/a/modular_electricity_poles) | James Ray Cock |
| `src/assets/afprops/portable_generator.glb` | [Portable Generator](https://polyhaven.com/a/portable_generator) | James Ray Cock |
| `src/assets/afprops/exterior_aircon_unit.glb` | [Exterior Aircon Unit](https://polyhaven.com/a/exterior_aircon_unit) | Monsta3D |
| `src/assets/afprops/utility_box_01.glb` | [Utility Box 01](https://polyhaven.com/a/utility_box_01) | James Ray Cock |
| `src/assets/afprops/utility_box_02.glb` | [Utility Box 02](https://polyhaven.com/a/utility_box_02) | James Ray Cock |
| `src/assets/afprops/fire_hydrant.glb` | [Fire Hydrant](https://polyhaven.com/a/fire_hydrant) | Gonçalo Felício |
| `src/assets/afprops/water_manhole_cover.glb` | [Water Manhole Cover](https://polyhaven.com/a/water_manhole_cover) | Raunox |
| `src/assets/afprops/metal_trash_can.glb` | [Metal Trash Can](https://polyhaven.com/a/metal_trash_can) | GurJas Studios |
| `src/assets/afprops/old_tyre.glb` | [Old Tyre](https://polyhaven.com/a/old_tyre) | MP |
| `src/assets/afprops/covered_car.glb` | [Covered Car](https://polyhaven.com/a/covered_car) | MP |
| `src/assets/afprops/wooden_crate_01.glb` | [Wooden Crate 01](https://polyhaven.com/a/wooden_crate_01) | James Ray Cock |
| `src/assets/afprops/wooden_military_crate.glb` | [Wooden Military Crate](https://polyhaven.com/a/wooden_military_crate) | Prabhjinder Singh |
| `src/assets/afprops/metal_jerrycan.glb` | [Metal Jerrycan](https://polyhaven.com/a/metal_jerrycan) | Sean Buckley |
| `src/assets/afprops/old_military_compressor.glb` | [Old Military Compressor](https://polyhaven.com/a/old_military_compressor) | Brian Speight |
| `src/assets/afprops/cardboard_box_01.glb` | [Cardboard Box 01](https://polyhaven.com/a/cardboard_box_01) | Rahul Chaudhary |
| `src/assets/afprops/Barrel_01.glb` | [Barrel_01](https://polyhaven.com/a/Barrel_01) | Jorge Camacho |
| `src/assets/afprops/ladder_sectioned_01.glb` | [Ladder Sectioned 01](https://polyhaven.com/a/ladder_sectioned_01) | MP |
| `src/assets/afprops/security_light.glb` | [Security Light](https://polyhaven.com/a/security_light) | Maximilian Schuster |

### Bitki impostorlarının kaynak modelleri — [Poly Haven](https://polyhaven.com)

Bu modeller oyuna dahil edilmez; `blender/impostors.py` ile yandan
renderlanıp atlasa (`src/assets/veg/`) pişirilir.

| Kaynak |
| --- |
| [Island Tree 01](https://polyhaven.com/a/island_tree_01) |
| [Island Tree 02](https://polyhaven.com/a/island_tree_02) |
| [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree) |
| [Tree Small 02](https://polyhaven.com/a/tree_small_02) |
| [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) |
| [Pine Tree 01](https://polyhaven.com/a/pine_tree_01) |
| [Shrub 02](https://polyhaven.com/a/shrub_02) |
| [Grass Medium 02](https://polyhaven.com/a/grass_medium_02) |

## Referanslar (varlık değil, yalnız bilgi)

Modeller genel mühendislik bilgisine ve kamuya açık belgelere göre
tasarlandı; herhangi bir üreticinin çizimi, ticari markası ya da logosu
kullanılmadı. Etiket renkleri boru tanımlama geleneğini izler (yakıt kırmızı,
yağ sarı-kahve, hidrolik mavi).

