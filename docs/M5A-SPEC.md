# M5a — Motor Atölyesi çekirdeği: uygulama şartnamesi

Durum: onaya hazır taslak (Ekim 2026). Temel: `docs/ATOLYE.md`, `ROADMAP.md`
(M4, M5), üç rakip tasarım ve iki yargıç değerlendirmesi. Satır numaraları
HEAD `f5bde91`'e göre. Bu belge yazılırken kaynak dosyalara dokunulmadı.

**Kazanan tasarım:** Tasarım 1, "öğrenci deneyimi önce" (iki yargıç da
seçti). Arayüz, Sprocket hissi, tutamaçlar, uyarılar ve test hücresi akışı
ondan alındı. Tasarım 2'den motor bilgisi içermeyen ortak çekirdek
(`design/core`), aile/varyant kapsamı ve zarf, kararlı belge biçimi, motor
kartı iskeleti, ayrı `MixerSpec`/`ShaftOutputSpec` ve mimari dönüşüm tablosu
eklendi. Tasarım 3'ten altın sayı testi, bulanık test, yerleşim/model kayıt
defteri, saf `WorkshopStore`, `flush()` kancası, `evaluateOperability`,
"eşik şablondan ≥ %4 uzak" kuralı ve iş paketi düzeni eklendi.

Kullanıcıya sorulacak kararlar §9.2'de. Onay gelene kadar her biri için
buradaki **varsayılan** geçerli; paketler varsayılanla ilerler.

---

## 1. Kapsam ve bitti ölçütü

### 1.1 M5a'ya girenler

1. **Aile/varyant veri modeli.** Aile = mimari + donanım (kanal, kademe,
   kasa) + varyant zarfı. Varyant = zarf içinde itki sınıfı/ayar (PR, T4,
   BPR). Automation'daki gibi; gerçek örnek CFM56-7B24/26/27.
2. **Başlangıç:** şablondan (7 aile), sıfırdan (6 adımlı mimari sihirbazı),
   ya da otomatik kayıttan devam.
3. **Mimari kartları:** eksen başına kart, geçerli birleşimler, kilitli
   kartta neden, bağımlı değişikliklerin önizlemesi, canlı bedel önizlemesi.
4. **Dört yeni mimari:** art yakıcısız çıplak motor (sabit yakınsak lüle),
   kaportalı karışık akışlı turbofan, turboşaft, kutu-halka yanma odası
   (her aileye dik seçenek).
5. **Temel + uzman düğmeleri.** `input` olayı taslak, `change` olayı tam
   ayrıntı üretir; yasak bölge, değişim çipi, duyarlılık ipucu.
6. **3B'de modül seçme ve üç temel tutamaç:** ön uç (fan/giriş ucu ya da
   pervane ucu), kompresör boyu, lüle ağzı. Hayalet meridyen çizgisi ve
   ölçek figürü.
7. **Sonuç paneli:** itki/güç, TSFC/SFC, kütle, T/W, çap × boy, sınır
   çubukları, kütle şeridi, öğretici uyarılar (Göster / Sözlük / Ders /
   Düzelt), ayrıntı tablosu.
8. **Motor tipinin modüllerden türetilmesi:** `EngineTraits` +
   `presentationKind`. Görsel model seçimi yerleşim stilinden.
9. **Ayrı `workshop` tasarım yuvası.** Dersler, kayıt sahneleri ve test
   hücresi katalogu oyuncunun tasarımından etkilenmez.
10. **"Test hücresinde çalıştır" ve geri dönüş;** beklenen/ölçülen kartı.
11. **Şablonların fiziğe uydurulması:** turboprop çekirdeği, turbofan
    HPT/yanma odası. Yedi şablonun hiçbiri caution/warning vermez.
12. **Faz 4 temeli (yalnız veri, arayüz yok):** `design/core` jenerikleri,
    `EngineDocV1` kanonik biçimi ve `graphRev`, `EngineCard` iskeleti,
    yerleşimlerde `mounts`/`outerProfile`, kütlede ağırlık merkezi.
13. **Küçük ekler (yargıç eksiklerinden):** son 30 adımlık bellek içi geri
    al/yinele, kademe sayısı histerezisi, kurulum zarfı (hedef kutusu),
    üç görevlik "Görev kartı" (§9.2 S7 ile kesilebilir).

### 1.2 M5a'ya girmeyenler

- **M5b:** diğer tutamaçlar (modül sınırı, kaporta çizgisi), patlatılmış
  görünüm, istasyon renkleri, grafikler (harita, T–s, halı), A/B
  karşılaştırma, kaydet/yükle arayüzü, paylaşım kodu arayüzü, "tasarım
  noktası kayar" lüle trimi (`nozzleAreaFactor`), çalışırken canlı ayar,
  dişli fan, itki çevirici, çift santrifüj, arkadan çıkışlı mil, parametrik
  fan göbeği (`fan.js`).
- **M5c:** dönemli sınırlar (`TechLimits` iskeleti M5a'da), soğutma havası,
  ölçek etkisi (verim ↔ boyut), maliyet, gürültü dB, NOx, ömür, motor kartı
  arayüzü ve performans tablosu (deck), 3 mil, açık rotor, hangar.
- Dar ekran ≤ 720 px ve dokunmatik sürükleme (açık teknik borç).

### 1.3 Bitti ölçütü (ölçülebilir)

`node scripts/playtest.mjs` (swiftshader, 1440×810, `QUALITY=low`) içinde
yeni `workshop` bölümü §8'deki senaryoyu baştan sona hatasız koşar:

1. Menüden atölyeye girer, **sihirbazla sıfırdan** art yakıcısız,
   kutu-halka yanma odalı, çıplak tek akışlı bir motor tasarlar (30 kN).
2. Üç temel tutamacı sürükler; her birinin beklenen fiziksel sonucu
   denetlenir.
3. Düğme değiştirir, bir uyarıyı bilerek tetikler, "Düzelt" ile kaldırır.
4. Ad verir, test hücresine geçer: otomatik çalıştırma → light-off →
   rölanti → tam güç. `surgeCount === 0`, `turbineDamaged === false`,
   `egtLimited === false`, tam güçte itki tasarım değerinin ±%3'ünde.
5. Atölyeye döner; karışık akışlı turbofan ve turboşaft ailelerini kurar
   (uyarı 0, hata 0).
6. Bir ders açar; dersin şablon turbofanla açıldığını doğrular.
7. `pageerror` ve konsol hatası sıfır. Aynı koşuda mevcut 7 ders ve
   `sandbox` bölümü de geçer.

Ek olarak: `npm run typecheck`, `npm test` yeşil; CLAUDE.md'deki kilometre
taşı kapanış adımları (önce/sonra, README, ROADMAP ✅, `build:single`,
commit + push) yapılmış.

---

## 2. Veri modeli

### 2.1 Katmanlar ve bağımlılık kuralı

```
src/design/core/      Faz 4 ile ORTAK. Motor bilgisi yok, three.js yok, DOM yok.
  knob.ts  rules.ts  family.ts  handle.ts  edit.ts  doc.ts
src/design/           Motor uzmanlığı. sim/* ve design/core içe aktarır.
  types.ts architecture.ts defaults.ts traits.ts graph.ts flowpath.ts
  layouts/{index,bare,turbofan,turboprop,turboshaft,gasgen}.ts
  operability.ts knobs.ts inverse.ts handles.ts tech.ts warnings.ts
  summary.ts evaluate.ts engineDoc.ts card.ts partsMap.ts outline.ts
  templates.ts catalog.ts
src/workshop/         Saf TS durum: store, proje, geri al. three.js ve DOM yok.
  store.ts project.ts history.ts goals.ts
src/app/workshop/     three.js/DOM: paneller, tutamaçlar, hayalet, ölçek figürü.
src/engine/           Üreticiler; models.ts kayıt defteri.
```

- `design/core` hiçbir şeyi içe aktarmaz.
- `design/*` yalnız `sim/*` ve `design/core`'u içe aktarır. `PartId`
  `engine/visual.ts`'te kalır; `partsMap.ts` aynı dizgeleri `PartTag`
  tipiyle yineler, `visual.ts`'te `type _Check = PartId extends PartTag ? …`
  derleme denetimi ayrışmayı yakalar.
- `sim/*` `design/*`'i içe aktarmaz. Simülasyon `kind`'a göre dallanmaz;
  yalnız `afterburner`, `mixer`, `prop`, `shaft` alanlarını okur.
- `src/workshop/*` vitest'te sınanır.

### 2.2 Ortak çekirdek (`src/design/core`) — Faz 4 temeli

```ts
// core/knob.ts
export type KnobValue = number | string | boolean;
export type Unit = '' | 'kg/s' | 'K' | 'm/s' | 'm' | 'kg' | 'W' | 'rpm' | 'Pa' | 'mm' | '%' | 'adet';
export interface KnobDef<TModel, TCtx = unknown> {
  /** Kararlı kimlik ('hpc.pr'). Belgeye yazılır; ASLA yeniden adlandırılmaz (gerekirse KNOB_ALIASES). */
  id: string;
  /** Model içindeki yol: ['hpc','mach',0]. İlk öğe modül tipi, 'engine' ya da 'bypassDuct'. */
  path: readonly (string | number)[];
  group: string;                       // panel bölümü: 'hpc'
  label: string;
  explain: string;                     // tek cümle, öğretici
  unit: Unit;
  type: 'number' | 'int' | 'enum' | 'bool';
  options?: readonly string[];
  range(ctx: TCtx): [number, number] | null;   // null: bu bağlamda yok
  step: number;
  scale?: 'lin' | 'log';
  display?: { unit: string; factor: number; offset?: number; digits: number }; // W → kW, K → °C
  level: 'basic' | 'expert';
  scope: 'family' | 'variant';
  /** 3B'de görünür etkisi: approx = model kısmen gösterir (ör. fan.hubTip) */
  preview: 'exact' | 'approx' | 'none';
  glossary?: string;
  lesson?: string;
  techLimit?: string;                  // M5c dönem anahtarı
  get(m: TModel): KnobValue | undefined;
  set(m: TModel, v: KnobValue): TModel;          // saf: klon döndürür
}
export function clampKnob<T, C>(k: KnobDef<T, C>, v: KnobValue, ctx: C): KnobValue;
export function getPath(obj: unknown, path: readonly (string | number)[]): unknown;
export function setPath<T>(obj: T, path: readonly (string | number)[], v: unknown): T; // yapısal kopya

// core/rules.ts
export type Severity = 'info' | 'caution' | 'warning';     // Toasts ile ortak
export interface Finding {
  id: string; severity: Severity;
  value?: number; limit?: number; unit?: Unit;
  title: string;          // 'HPC ilk kademe uç bağıl Mach 1,62'
  text: string;           // neden + bedel, öğretici
  fix: string;            // insan dili öneri
  group: string;          // modül
  tags: string[];         // vurgulanacak parçalar (PartTag)
  knobs: string[];        // panelde işaretlenecek düğmeler
  glossary?: string; lesson?: string;
  /** Önerilen düzeltme: bağlı düğmenin eşiği %2 içeride bırakan değeri */
  remedy?: { knob: string; value: KnobValue; label: string };
}
export interface Rule<TCtx> {
  id: string; group: string;
  applies?(ctx: TCtx): boolean;
  metric(ctx: TCtx): number | undefined;
  dir: 'above' | 'below' | 'outside';
  limits(ctx: TCtx): { caution: number | [number, number]; warning?: number | [number, number] };
  unit: Unit; digits: number;
  title(v: number, ctx: TCtx): string;
  text(v: number, lim: number, ctx: TCtx): string;
  fix: string; tags(ctx: TCtx): string[]; knobs: string[];
  glossary?: string; lesson?: string;
  infoOnly?: boolean;
  remedy?(ctx: TCtx): Finding['remedy'];   // pahalıysa yalnız tam üretimde çağrılır
}
export function evaluateRules<T>(rules: readonly Rule<T>[], ctx: T): Finding[]; // önem, sonra id sıralı

// core/family.ts
export interface Variant { id: string; name: string; nameLocked: boolean; values: Record<string, KnobValue> }
export interface Family<TModel, TArch> {
  id: string; code: string; name: string;
  base: TModel;                                  // TAM model (şablona referans değil)
  envelope: Record<string, [number, number]>;    // varyant düğmelerinin aile içi aralığı
  variants: Variant[];                           // ≥ 1
  active: string;
  origin: { from: 'template' | 'wizard' | 'import'; template?: string };
  /** Mimari saklanmaz; architectureOf(base) ile türetilir. Tip yalnız Faz 4 genelliği için. */
  _arch?: TArch;
}
export function resolveVariant<T>(f: Family<T, unknown>, variantId: string,
  knobs: ReadonlyMap<string, KnobDef<T, any>>, ctx: unknown): T;
// sıra: base klonu → values (önce zarfa, sonra düğme aralığına kırpılır) → set

// core/handle.ts
export interface HandleDef<TModel, TBuilt, TCtx = unknown> {
  id: string; group: string; axis: 'radial' | 'axial';
  label: string;
  available(ctx: TCtx): boolean;
  blockedReason?(m: TModel, b: TBuilt): string | null;
  anchor(b: TBuilt): { z: number; r: number } | null;  // dünya: +Z akış, r XY'de (x=0, y=+r)
  /** Sürükleme sınırı (dünya biriminde) ve neden metinleri */
  range(m: TModel, b: TBuilt): { lo: number; hi: number; loReason?: string; hiReason?: string };
  coupled: string;                                       // bağlı düğme kimliği
  solve(m: TModel, b: TBuilt, target: number): { model: TModel; snapped: number };
  snaps?(m: TModel, b: TBuilt): number[];                // kademe çentikleri
}

// core/edit.ts — M5a'da geri al/yinele yığını
export type Edit =
  | { t: 'knob'; id: string; value: KnobValue; variant?: string }
  | { t: 'arch'; option: string; value: string | boolean }
  | { t: 'handle'; id: string; target: number }
  | { t: 'variant'; op: 'add' | 'dup' | 'remove' | 'rename' | 'select'; id: string; name?: string }
  | { t: 'family'; op: 'new' | 'select' | 'rename'; id: string; name?: string };

// core/doc.ts
export function canonicalJson(v: unknown, opts?: { order?: Record<string, readonly string[]> }): string;
export function fnv1a64(s: string): string;                // base36
export interface Migrator { from: number; migrate(doc: unknown): unknown }
```

Kanonik JSON kuralları: nesne anahtarları sıralı (dizi `order` verilmişse o
sıra); sayılar `Number(x.toPrecision(7))`, `-0 → 0`; NaN/∞ hata; `undefined`
atılır; dizgeler NFC.

### 2.3 Motor grafiği değişiklikleri (`src/design/types.ts`)

```ts
export type CombustorStyle = 'annular' | 'can' | 'canAnnular';
export type NozzleStyle = 'fixed' | 'convergent' | 'cd' | 'stub' | 'separate';
export type InletStyle = 'bellmouth' | 'chin' | 'nacelle' | 'annular';

export interface InletModule { type: 'inlet'; style: InletStyle; length: number; noseLength: number; struts: number;
  /** annular (turboşaft): entegre parçacık ayırıcı. M5a: yalnız görsel. */
  separator?: boolean }

/** YENİ: serbest güç türbininin çıkış mili (turboşaft). Akış dışı modül. */
export interface ShaftModule {
  type: 'shaft';
  rpm: number;              // %100 NP'de çıkış devri [rpm]
  drive: 'front' | 'rear';  // M5a: yalnız 'front' (kural)
  reduction: boolean;       // |ω_pt/ω_çıkış − 1| > 0,05 ise zorunlu (kural)
  transmissionEff: number;  // 0,97–0,995
  gearboxLength: number;    // çıkış flanşından HPC girişine [m]
}

export interface CombustorModule { /* mevcut alanlar */ style: CombustorStyle; cans?: number }
export interface NozzleModule    { /* mevcut alanlar */ style: NozzleStyle }
export interface MixerModule     { /* mevcut: loss, style, lobes */ }

export type EngineModule = PropellerModule | ShaftModule | InletModule | CompressorModule
  | CombustorModule | TurbineModule | MixerModule | AfterburnerModule | NozzleModule;
export type ModuleType = EngineModule['type'];

/** Geometriden henüz türetilmeyen çalışabilirlik alanları */
export interface Operability {
  inertia: { lp: number; hp: number };
  hpcMap: CompressorMapShape;
  limits: EngineLimits;
  start: StartSystem;
}

export interface EngineGraph {
  /** ARTIK TÜRETİLMİŞ: şablonlarda etiket olarak kalır, buildEngine okumaz. Belgeye yazılmaz. */
  kind?: EngineKind;
  name: string; summary: string;
  massFlow: number; modules: EngineModule[];
  mechEff: number; accessoryPower: number;
  bypassDuct?: { dp: number; mach: number };
  /** Şablonlarda tam verilir (bugünkü değerler, davranış aynı). Atölye
   *  grafiklerinde yok ya da kısmi: operability.ts aile şablonundan ölçekler. */
  ops?: Partial<Operability>;
  // inertia/hpcMap/limits/start: bugünkü üst düzey alanlar ops'a taşınır
  // (templates.ts mekanik taşıma; golden test bunu korur)
}
```

`ORDER` (graph.ts:32): `['propeller','shaft','inlet','fan','lpc','hpc','combustor','hpt','lpt','mixer','afterburner','nozzle']`.

`blisk` düğmesi okunmuyor (`gaspath.js:46` sabit kodlu): M5a'da katalogdan
çıkar, tipte `@deprecated` kalır.

### 2.4 Mimari ve grafik dönüşümleri (`src/design/architecture.ts`, `defaults.ts`)

```ts
export type LpLoad = 'lpc' | 'fan' | 'propeller' | 'shaft';
export interface Architecture {
  output: 'thrust' | 'shaft';            // sihirbazın 1. sorusu; propeller 'shaft' çıkışlı sayılmaz (itki+mil)
  lpLoad: LpLoad;
  booster: boolean;                      // yalnız lpLoad 'fan'
  centrifugal: boolean;                  // HPC son kademe santrifüj
  combustor: CombustorStyle;
  exhaust: 'single' | 'separate' | 'mixed';
  mixer: 'confluent' | 'lobed';          // exhaust 'mixed' iken anlamlı
  afterburner: boolean;
  abNozzle: 'convergent' | 'cd';         // AB varken değişken lüle
  installation: 'bare' | 'nacelle';      // prop/shaft'ta yok sayılır
}
export function architectureOf(g: EngineGraph): Architecture;
export function archKey(a: Architecture): string;   // 'fan+b|cf0|ann|mix:lobed|dry|nac' (aile gruplama)

export interface ArchCard {
  title: string; does: string; gains: string; costs: string;
  examples: string; lesson?: string; glossary?: string;
}
export interface ArchOption {
  axis: keyof Architecture; value: string | boolean;
  card: ArchCard;
  /** Zorunlu eşlik eden değişiklikler (kartta "Şunlar da değişir: …") */
  implies(a: Architecture): Partial<Architecture>;
  /** Hâlâ geçersizse GRAPH_RULES metni (kart kilitli, nedeni öğretir); M5b/M5c ise o metin */
  blocked(a: Architecture): string | null;
}
export const ARCH_OPTIONS: readonly ArchOption[];
export function resolveChange(a: Architecture, axis: keyof Architecture, value: unknown):
  | { arch: Architecture; implied: { axis: keyof Architecture; from: unknown; to: unknown; reason: string }[] }
  | { blocked: string };
/** Mimariye uygun grafik: modül ekler/çıkarır, ortak düğmeleri `seed`den taşır.
 *  Çekirdek akışı korunur: massFlow' = massFlow·(1+bpr')/(1+bpr). */
export function applyArchitecture(seed: EngineGraph, next: Architecture): EngineGraph;
// defaults.ts
export type Donor = 'TJ' | 'MTF' | 'TF' | 'TP' | 'TS' | 'TJD' | 'TFM';
export function donorFor(m: ModuleType, a: Architecture): Donor;
export function graphFromArchitecture(a: Architecture, size: { massFlow: number; name: string }): EngineGraph;
/** Hedef itki [N] ya da mil gücü [W] için hava akışı: 30 adımlı ikiye bölme, log uzayında */
export function solveMassFlow(g: EngineGraph, target: { thrust?: number; shaftPower?: number }): number;
```

Bağışçı modüller kalibrasyondan (§4) **sonraki** şablon değerlerini kullanır;
bu yüzden üretilen her mimari uyarısız başlar (test §7 P4a).

**Dönüşüm tablosu** (`applyArchitecture`):

| Değişim | Eklenen | Çıkarılan | Dönüştürülen | Eşlik eden (implies) |
|---|---|---|---|---|
| lpLoad `lpc→fan` | `fan` (BPR: bare 0,6 / nacelle 6) | `lpc` (booster kapalıysa) | `massFlow ×(1+bpr)`; fan `tipSpeed` = eski LPC'nin | exhaust: bare→`mixed`, nacelle→`separate`; `bypassDuct` bağışçıdan |
| lpLoad `fan→lpc` | `lpc` (TJ bağışçısı) | `fan`, `mixer`, `bypassDuct` | `massFlow /(1+bpr)` | exhaust `single`; installation `bare` |
| lpLoad `→propeller` | `propeller` | `fan`, `lpc`, `mixer`, `afterburner`, `bypassDuct` | inlet `chin`, nozzle `stub`, `lpt.tipSpeed` bağışçıdan | centrifugal açık |
| lpLoad `→shaft` | `shaft` | (propeller ile aynı) | inlet `annular`, nozzle `stub` | centrifugal açık, output `shaft` |
| booster aç/kapa | `lpc` (TF bağışçısı, `gap 1.421`) / — | — / `lpc` | `fan.hubPRFraction` korunur | — |
| centrifugal aç/kapa | `hpc.centrifugal` (TP bağışçısı) / — | — | `hpc.tipSpeed` bağışçıdan | — |
| combustor stili | — | — | `style`; `cans` (can 10, canAnnular 8); `dp` (annular .04 / canAnnular .05 / can .06); `refVelocity` (annular 20–43 korunur, can/canAnnular ≥ 25) | — |
| exhaust `separate→mixed` | `mixer` (arch.mixer; lobed 18 lobe) | `nozzle.chevrons` | nozzle `separate→fixed` | — |
| exhaust `mixed→separate` | — | `mixer` | nozzle `→separate` | AB kapalı, installation `nacelle` |
| AB aç | `afterburner` (bpr>0: MTF, değilse TJ bağışçısı) | — | nozzle `fixed→abNozzle` | bpr>0 ise exhaust `mixed`; installation `bare` |
| AB kapa | — | `afterburner` | nozzle `→fixed` (`cv .98`) | — |
| installation `bare→nacelle` | — | — | inlet `nacelle` | booster açık, AB kapalı, BPR ≥ 1 |
| installation `nacelle→bare` | — | — | inlet `bellmouth` | exhaust `separate→mixed`, BPR ≤ 1,5 |

**Geçerli mimari kümesi (M5a).** Her satır × yanma odası (3) × karıştırıcı
stili (mixed ise 2) `architecture.test.ts`'te kurulur ve çalıştırılır
(≈ 40 grafik).

| # | lpLoad | booster | exhaust | AB | installation | Örnek | Durum |
|---|---|---|---|---|---|---|---|
| 1 | lpc | – | single | ✓ conv/cd | bare | J79 (bugünkü TJ) | var |
| 2 | lpc | – | single | – fixed | bare | J57, JT8D çekirdeği | **yeni** |
| 3 | fan | –/✓ | mixed | ✓ | bare | F100 (bugünkü MTF) | var |
| 4 | fan | –/✓ | mixed | – fixed | bare | Spey (kuru düşük baypas) | **yeni** |
| 5 | fan | ✓ | separate | – | nacelle | CFM56-7 (bugünkü TF) | var |
| 6 | fan | ✓ | mixed | – fixed | nacelle | CFM56-5C, TFE731 | **yeni** |
| 7 | propeller | – | single (stub) | – | – | PW150 (bugünkü TP) | var |
| 8 | shaft | – | single (stub) | – | – | T700, Makila | **yeni** |

### 2.5 Grafik kuralları (`graph.ts` → `GRAPH_RULES` tablosu)

```ts
export interface GraphRule { id: string; group: ModuleType | 'engine'; test(g: EngineGraph): boolean; msg: string; knobs?: string[] }
export const GRAPH_RULES: readonly GraphRule[];
export class GraphError extends Error { readonly ruleId: string; readonly group: string; readonly knobs: string[] }
```

Değişen ve eklenen kurallar (diğerleri aynen kalır):

| Bugün | M5a | Mesaj |
|---|---|---|
| 51 pervane+fan | `propeller`, `shaft`, `fan` birbirini dışlar; `propeller\|shaft` varsa `lpc` yasak | "Serbest güç türbininin milinde kompresör yok: LP mili gücü dışarı verir." |
| 52 LP yükü | `fan \|\| lpc \|\| propeller \|\| shaft` | (metin `çıkış mili` eklenerek) |
| 64/66 stub | `stub ⇔ (propeller \|\| shaft)` | mevcut metinler, "pervane ya da çıkış mili" |
| 67-68 değişken lüle | korunur | — |
| yeni | `fixed && afterburner` | "Art yakıcı değişken kesitli lüle ister: yanınca jet hacmi ~2 katına çıkar, lüle açılmazsa fan surge'e girer." |
| yeni | `!afterburner && (convergent\|cd)` | "Art yakıcısız motor sabit yakınsak lüle kullanır: değişken kesit yalnız art yakıcı yanarken gerekir." |
| 70 chin | korunur | — |
| yeni | `annular` giriş yalnız `shaft` ile | "Halka giriş turboşaftın önden çıkışlı miline yer açar." |
| 71 nacelle | `nacelle` → `fan && bpr ≥ 1 && !afterburner && (separate \|\| (mixer && fixed))` | "Kaportalı yerleşim fanlı motor içindir (BPR ≥ 1): ya ayrık lüleli ya da uzun kanallı karışık akışlı olur; art yakıcılı kaportalı motor yok." |
| 72 bellmouth | **kalkar** | — |
| flowpath 596 | GraphError'a taşınır | "Kaportalı turbofan şimdilik booster (LPC) ister." |
| flowpath 488 | `(propeller\|shaft) && !hpc.centrifugal` | "Serbest türbinli gaz jeneratörü şimdilik santrifüj son kademe ister." |
| yeni | `hpc.centrifugal && !(propeller\|shaft)` | "Santrifüj son kademe şimdilik serbest türbinli motorlarda." |
| yeni | `style ≠ annular` → `cans ∈ [6,16]`, tamsayı | "Kutu ve kutu-halka yanma odası 6–16 kutu ister." |
| yeni | `shaft.drive === 'rear'` | "Arkadan çıkışlı mil M5b'de." |
| yeni | `bare && bpr > 1.5` | "Çıplak karışık akışlı motor düşük baypas içindir (BPR ≤ 1,5); yüksek baypas kaporta ister." |
| 65 chevron | korunur | — |
| yeni | `separate && inlet ≠ nacelle` (`nozzle.separateNacelle`) | "Ayrık akışlı lüle kaportalı turbofan içindir: çıplak motorda baypas akışı karıştırılır." |
| yeni | `propeller && inlet ≠ chin` (`inlet.propChin`) | "Pervaneli motor havayı dişli kutusunun altındaki çene girişinden alır." |
| yeni | `shaft && inlet ≠ annular` (`inlet.shaftAnnular`) | "Önden çıkışlı mil girişin ortasından geçer: turboşaft halka giriş ister." |

`FlowpathError` de `GraphError` gibi yapısaldır: `code` (`annulus.closed`,
`combustor.cansFit`, `tipSpeed.missing`, `layout.notReady`, …), `group`
(modül), `knobs`, `data` (mesajdaki sayılar, ör. `{cans, canDiameter}`).
Öğretici çeviri (P3) metni ayrıştırmaz.

`shaft.reduction === false` iken devir tutarlılığı `flowpath` aşamasında
denetlenir (güç türbini devri orada belli): `FlowpathError("Redüktörsüz
çıkış mili güç türbini devrinde döner: …")`.

### 2.6 Türetilmiş motor tipi (`src/design/traits.ts`)

```ts
export type LayoutStyle = 'bare' | 'nacelle' | 'turboprop' | 'turboshaft';
export interface EngineTraits {
  layout: LayoutStyle;
  lpLoad: LpLoad;
  output: 'thrust' | 'propeller' | 'shaft';
  booster: boolean; centrifugal: boolean;
  bpr: number; bypass: boolean;                // bpr > 0
  exhaust: 'single' | 'separate' | 'mixed';
  afterburner: boolean;
  nozzle: NozzleStyle; variableNozzle: boolean; // convergent | cd
  combustor: CombustorStyle;
  installed: boolean;                           // nacelle
  /** İsli alev/kurum: M5a lpLoad==='lpc' && bpr===0 (M5c: dönem/T4) */
  smoky: boolean;
  /** Arayüz tablolarının anahtarı */
  presentation: EngineKind;
}
export function layoutStyleOf(g: EngineGraph): LayoutStyle;
//  propeller → turboprop; shaft → turboshaft; inlet nacelle → nacelle; diğer → bare
//  (flowpath.ts:803'teki nozzle.style==='separate' seçiminin yerine)
export function deriveTraits(g: EngineGraph): EngineTraits;
export function presentationKind(t: Omit<EngineTraits, 'presentation'>): EngineKind;
//  propeller → 'turboprop'; shaft → 'turboshaft'; nacelle → 'turbofan';
//  bpr > 0 → 'militaryTurbofan'; diğer → 'turbojet'
/** Grafiksiz katalog tasarımları için geri düşüş */
export function traitsFromDesign(d: EngineDesign): EngineTraits;
```

`EngineKind` 5 değerli olur: `'turbofan'|'militaryTurbofan'|'turbojet'|'turboprop'|'turboshaft'`
(§9.2 S3). `Record<EngineKind, …>` tablolarının eksiği tip denetimiyle
bulunur. Yalnız turboşaft yeni bir sunum tipidir; kuru turbojet `turbojet`,
karışık kaportalı turbofan `turbofan` sunumunu kullanır ve farkları
`traits` taşır.

**Sim katmanı traits'i görmez.** Arayüz ve görsel `traits`'i `App`'ten alır
(`builtFor(slot).traits` ya da katalog için `traitsFromDesign`).

### 2.7 Yuvalar ve inşa (`catalog.ts`, `graph.ts`)

```ts
export type SlotId = EngineKind | 'workshop';
export interface BuiltEngine {
  design: EngineDesign; sized: SizedEngine; flowpath: Flowpath;
  traits: EngineTraits;
  /** 'r' + fnv1a64(canonicalJson(graph)) — aynı tipte yeni tasarımı ayırt eder */
  rev: string;
  graph: EngineGraph;
}
export interface BuildOptions {
  /** Ailenin şablonu: çalışabilirlik bundan ölçeklenir (operability.ts). Verilmezse g.ops aynen. */
  reference?: BuiltEngine;
  /** Kademe histerezisi: önceki gaz yolunun kademe sayılarını eşikte korur */
  previous?: GasPath; stageHysteresis?: number;   // varsayılan 0 (şablonlar, testler)
}
export function buildEngine(g: EngineGraph, opts?: BuildOptions): BuiltEngine;

export function builtFor(slot: SlotId): BuiltEngine | undefined;
export function designFor(slot: SlotId): EngineDesign;           // eski engineDesign(kind)
export function layoutFor(slot: SlotId): EngineLayout | undefined;
/** null: kind yuvasında şablona döner, workshop'ta boşaltır. Geçersizse ATAR, eski yuva kalır. */
export function setSlotGraph(slot: SlotId, g: EngineGraph | null, opts?: BuildOptions): BuiltEngine | undefined;
/** Kayıt kancası uyumu (CLAUDE.md tarifi): yalnız kind yuvaları */
export const overrideGraph: (kind: EngineKind, g: EngineGraph | null) => BuiltEngine | undefined;
/** Mağazanın (kendi seçenekleriyle) ürettiği motoru yeniden üretmeden yuvaya yazar */
export function setSlotBuilt(slot: SlotId, b: BuiltEngine): BuiltEngine;
export const TEMPLATES: Record<TemplateId, EngineGraph>;     // 7 aile şablonu
```

- `graph.ts:105`: `design.kind = traits.presentation`.
- `graph.ts:178`: `fanBlades = prop ? prop.blades : (gas.front ?? gas.hpc).blades[0]`.
- `toEngineDesign`: `mixer && !afterburner` → `design.mixer`; `shaft` →
  `design.shaft`; `ops` → `operability.ts`.
- Kademe histerezisi (`sizeRow`, flowpath.ts:94-128): `x = dh/(ψ·U²)`,
  `n = ceil(x)`. `previous` verilmişse ve `n ≠ n_prev` iken
  `|x − round(x)| < stageHysteresis` ise `n = n_prev` (sınırda titreme
  yok). Atölye sürüklemede `0.03` geçer; `change`/tam üretimde 0.

### 2.8 Çalışabilirlik (`src/design/operability.ts`)

```ts
export function deriveOperability(g: EngineGraph, b: Omit<BuiltEngine, 'design' | 'rev'>,
  ref: BuiltEngine, refOps: Operability): Operability;
export function rotorInertia(gas: GasPath, spool: 'lp' | 'hp', mass: MassBreakdown): number; // Σ m_rotor·r_ort²
```

- Referans: ailenin şablonu (`Family.origin.template`; sihirbazda donör).
  Şablonun kendisine uygulanınca bütün oranlar 1 (test: fark < 1e-12).
- **Atalet:** `I_s = I_s,ref · J_s/J_s,ref`; rotor payı modül kütlesinin
  0,5'i; LP: fan/lpc/booster + lpt + LP mili (+ pervane `propJ`); HP:
  hpc (+çark) + hpt + HP mili.
- **Marş torku:** `τ = τ_ref · (I_hp/I_hp,ref) · (n2Rpm/n2Rpm,ref)`,
  ×[0,25, 4] kırpılır (ivmelenme süresi I·ω/τ korunur).
- **Aksesuar gücü:** `P = P_ref · W25/W25,ref`, ×[0,3, 3] (W25 =
  `massFlow/(1+bpr)`, grafikten). Tasarım noktasına (HPT işi) girdiği için
  `resolveAccessoryPower(g, ref)` ile `toEngineDesign`'da, yani
  boyutlandırmadan **önce** çözülür (P0'da yazıldı). Öncelik:
  `g.ops.accessoryPower` (uzman düzeltmesi, `Operability.accessoryPower?`)
  > referanstan ölçek > `g.accessoryPower` (taban/şablon değeri).
- **Limitler:** EGT sınırları (°C) **malzeme sınırıdır, kaydırılmaz**;
  aileden aynen alınır (Tasarım 2'deki ΔT5 kaydırması reddedildi: EGT payı
  uyarısını anlamsızlaştırıyordu). `n1/n2Redline`, `idleN2`,
  `starterCutout`, `starterFadeN2`, `fuelOnMinN2`, FAR alanları ve `hpcMap`
  referanstan kopyalanır.
- **FADEC yakıt programları** zaten ölçekten bağımsız: `wfMax = r.Wf·1,15`,
  ivmelenme `0,82·surgeWf`, yavaşlama `1,6·leanBlowoutFar·W3`
  (engineSim.ts:593-621), FAR penceresi boyutsuz. Ek ölçekleme gerekmez;
  bulanık test (§7 P4b) bunu doğrular.
- `g.ops` alanları alan alan üstüne yazar (şablonlar, uzman düzeltmesi).
- Şablon `n2Rpm` değişirse (turboprop, §4) el yazımı katalogda
  `inertia.hp ·= (n2_eski/n2_yeni)²` (dönme enerjisi ve marş süresi korunur).

### 2.9 Simülasyon değişiklikleri (`src/sim`, §9.2 S1 onayına bağlı)

```ts
// sim/design.ts
export interface MixerSpec { loss: number; mixingEff: number }
export interface ShaftOutputSpec { rpm: number; nozzlePR: number; transmissionEff: number }
export interface EngineDesign { /* … */ mixer?: MixerSpec; shaft?: ShaftOutputSpec }
export interface EngineReference { /* … */ A9mix?: number }
```

- **Karışık akış (art yakıcısız):** `sizeEngine` (design.ts:529) `if
  (d.afterburner) {…} else if (d.mixer) {…}`: `mixStreams(W4,T5,P5,W13,T13,P19t,loss)`
  → `convergentNozzle(mix.P, mix.T)` (sabit yakınsak ortak lüle, basınç
  itkisi dahil) → `A9mix = mix.W / massFlux`; itki `mixedJetThrust(…,
  mixingEff, …, jet: 'convergent')`; `st7 = mix`. `cycle.ts:342` aynı dal
  (`nozzleArea = 1`, `mixedBypass = 0`). Art yakıcılı dalın kodu **taşınmaz**
  (altın test bayt düzeyinde korur).
- **Bilinen basitleştirme:** tasarım dışı P5 eşleşmesi sanal çekirdek A9 ile
  (AB'li motordaki gibi); `A9mix` kısıtı uygulanmaz. Karışma düzleminde
  `P19t/P5t` dengesi tasarım kısıtı değil, uyarı + "Düzelt" (fan PR
  ikiye bölmesi) ile sağlanır (§2.11). Ders metinleri "ideal karışma"
  demez.
- **Turboşaft:** `gasGen = !!(d.prop || d.shaft)` (engineSim.ts:641);
  `:840` N1 başlangıcı `(d.prop || d.shaft) ? 0.9 : 0.22`; `sizeEngine:497`
  `const out = d.prop ?? d.shaft; P5 = P0·out.nozzlePR`.
  `updatePropeller` (engineSim.ts:744) → `updateLoad`: yük `d.prop ?? d.shaft`.
  Turboşaftta yük **test hücresi su freni (dinamometre)**: vali NP'yi %100'de
  tutacak şekilde emilen gücü ayarlar (pervanedeki hatve valisinin aynısı,
  `P_abs = k·σ·n³`, k valiyle), gaz kolu gaz jeneratörü devrini (gücü)
  belirler. İtki yalnız `d.prop` varken; turboşaftta jet artık itkisi yalnız
  `nozzlePR`'den. `:892-898` `propRpm/torque` `d.prop ?? d.shaft`;
  `thrustFrac` turboşaftta `power/ref.shaftPower`.
- `EngineKind` 5 değer; `ENGINE_CATALOG.turboshaft` grafikten üretilir
  (`TURBOSHAFT` el yazımı değil: `buildEngine(TEMPLATES.turboshaft).design`;
  döngüsel import olmaması için `sim.test.ts` turboşaftı `design/` üzerinden
  sınar ve `ENGINE_CATALOG`'a `catalog.ts` başlangıçta kaydeder —
  `registerCatalogDesign(kind, d)`).

### 2.10 Düğme kataloğu (`src/design/knobs.ts`)

```ts
export interface KnobCtx { arch: Architecture; traits: EngineTraits; tech: TechLimits; family?: Family<EngineGraph, Architecture> }
export type EngineKnob = KnobDef<EngineGraph, KnobCtx>;
export const ENGINE_KNOBS: readonly EngineKnob[];
export type KnobId = (typeof ENGINE_KNOBS)[number]['id'];   // as const ile literal birleşim
export const KNOB_ALIASES: Record<string, KnobId>;           // M5a'da boş
/** Çözülebilir aralık: [lo,hi] içinde build'in başarılı olduğu bölge (12 adımlı ikiye bölme × 2 uç) */
export function feasibleRange(g: EngineGraph, k: EngineKnob, ctx: KnobCtx):
  { lo: number; hi: number; loReason?: TeachingError; hiReason?: TeachingError };
/** +1 adımın etkisi (ipucu): sonlu fark */
export function sensitivity(g: EngineGraph, k: EngineKnob, ctx: KnobCtx): SummaryDelta[];
```

Kimlik biçimi `<modül>.<alan>[.<alt>]`; motor düzeyi `engine.*`, baypas
kanalı `bypassDuct.*`. Modül tipi grafikte tekil olduğu için adres dizi
sırasına bağlı değil. Aralık sütununda "a / b" bare/TJ bağlamı / nacelle
bağlamıdır. Kaydırıcı aralıkları **başlangıç** önerisidir; P4b'nin bulanık
testi geçerli oranı < %70 olan aralıkları daraltır ve son değerleri bu
tabloya geri yazar.

**Temel düğmeler (B):**

| KnobId | Etiket | Birim (gösterim) | Aralık | Adım | Kapsam | Koşul | Bir cümle |
|---|---|---|---|---|---|---|---|
| `engine.massFlow` (log) | Hava akışı | kg/s | TJ/TJD 10–200 · MTF 30–250 · TF 150–1500 · TFM 50–600 · TP 3–30 · TS 1,5–15 | %1 | aile | – | "Motorun yuttuğu hava: itki onunla, çap karekökü ile büyür." |
| `fan.pr` | Fan basınç oranı | – | 1,8–4,5 / 1,3–2,0 (TFM 1,4–2,4) | 0,01 | varyant | fan | "Baypas jetini hızlandırır; LPT'den daha çok iş ister." |
| `fan.bypassRatio` | Baypas oranı | – | 0,1–1,5 / 1–12 (TFM 1–7) | 0,05 | varyant | fan | "Çekirdeğin yanından geçen hava: TSFC düşer, çap ve LPT büyür." |
| `fan.tipSpeed` | Fan uç hızı | m/s | 300–560 | 1 | aile | fan | "Hızlı fan daha az LPT kademesi ister ama uçta şok yapar." |
| `lpc.pr` | LPC / booster PR | – | LPC 1,5–5 · booster 1,1–2,5 | 0,01 | varyant | lpc | |
| `lpc.tipSpeed` | LPC uç hızı | m/s | 300–520 | 1 | aile | lpc ön (TJ) | |
| `hpc.pr` | HPC basınç oranı | – | 2–25 (TP/TS toplam 6–20) | 0,1 | varyant | – | "OPR artar → TSFC düşer; kademe, T3 ve kütle artar." |
| `hpc.centrifugal.workFraction` | Santrifüj iş payı | % | 0,2–0,8 | 0,01 | aile | centrifugal | "İşin ne kadarını çark yapar: eksenel kademe azalır, çap büyür." |
| `combustor.tit` | T4 | K (°C da) | 1000–1900 | 5 | varyant | – | "Sıcak türbin girişi: itki artar; EGT payı ve kanat ömrü azalır." |
| `combustor.cans` | Kutu sayısı | adet | 6–16 | 1 | aile | can/canAnnular | |
| `mixer.lobes` | Lobe sayısı | adet | 6–24 | 1 | aile | lobed | |
| `afterburner.t7Max` | Art yakıcı T7 | K | 1600–2200 | 10 | varyant | AB | |
| `nozzle.chevrons.core` / `.bypass` | Chevron | adet | 0, 8–24 | 2 | aile | separate | "Her chevron'lu lüle itkiden %0,25 alır, jet sesini azaltır (dB M5c)." |
| `propeller.diameter` | Pervane çapı | m | 1,5–5 | 0,01 | aile | prop | |
| `propeller.blades` | Pal sayısı | adet | 2–8 | 1 | aile | prop | |
| `propeller.rpm` | Pervane devri | rpm | 900–2000 | 10 | varyant | prop | |
| `shaft.rpm` | Çıkış devri | rpm | 3000–30000 | 50 | aile | shaft | "Yalnız redüktör oranını değiştirir; güç türbini devri uç hızından gelir." |

T4 üst sınırı M5a'da **1900 K**: soğutma havası modeli yok, çevrim yüksek
T4'ün kazancını abartır (M5c'de dönem + soğutma ile açılır). Bir ailede en
çok ~8 temel düğme görünür.

**Uzman düğmeler (E):**

| Grup | KnobId (aralık) |
|---|---|
| engine | `engine.accessoryPower` (0–600 kW; `ops.accessoryPower`'a yazar, §2.8), `engine.mechEff` (0,97–0,995), `bypassDuct.dp` (0,005–0,05), `bypassDuct.mach` (0,3–0,55) |
| inlet | `inlet.length` (0–2), `inlet.noseLength` (0–1,2), `inlet.struts` (0–12) |
| fan/lpc/hpc | `.eff` (0,80–0,94), `.mach.0` (0,35–0,70), `.mach.1` (0,10–0,50), `.hubTip` (0,25–0,85), `.taper` (0,8–1,05), `.loading` (0,2–1,0; booster ≤ 1,2), `.pitchSpan` (0,4–2,5), `.bladeK.0/.1` (0,8–4,5), `.gap` (0,5–3), `.vsv` (0–6; lpc/hpc), `hpc.tipSpeed` (350–650), `fan.hubPRFraction` (0,6–1,0; `preview:'none'`). `fan.hubTip` **M5a'da gizli** (model fan göbeğini göstermez; M5b) |
| centrifugal | `hpc.centrifugal.loading` (0,55–0,85), `.diffuserRatio` (1,3–2,0), `.gap` (0,5–2) |
| combustor | `.refVelocity` (5–60 m/s), `.lengthHeight` (1,5–8), `.dp` (0,02–0,08), `.eff` (0,97–0,999), `.injectors` (6–40), `.meanShift` (−0,1–0,1 m), `.gap` (0,5–3) |
| hpt/lpt | `.eff` (0,82–0,94), `.mach.0` (0,05–0,35), `.mach.1` (0,15–0,55), `.hubTip` (0,5–0,92), `.taper` (0,9–1,3), `.loading` (0,8–3,5), `.pitchSpan`, `.bladeK.*`, `.gap`; `lpt.tipSpeed` (300–550; serbest türbin) |
| mixer | `mixer.loss` (0,005–0,03) |
| afterburner | `.mach` (0,15–0,30), `.lengthDiameter` (1,2–3), `.eta` (0,8–0,95), `.dpDry` (0,02–0,06), `.dpLit` (0,04–0,10) |
| nozzle | `.cv` (0,95–0,995), `.flaps` (8–24), `.exitMach` (0,08–0,5; stub), `.pressureRatio` (1,02–1,3; stub) |
| propeller/shaft | `propeller.figureOfMerit` (0,6–0,8), `.efficiency` (0,75–0,9), `.gearboxLength` (0,8–2); `shaft.transmissionEff` (0,97–0,995), `shaft.gearboxLength` (0,2–1,5) |

**Kapsam kuralı (aile/varyant):** `scope:'family'` düğmesi değişince ailenin
`base`'i değişir ve bütün varyantlar etkilenir; birden çok varyant varsa
satır içi onay ("3 varyantı da etkiler"). `scope:'variant'` düğmesi
yalnız etkin varyantın `values`'ına yazılır ve aile **zarfı** içinde kırpılır.
Zarf varsayılanı: `base` değerinin ±%15'i (PR için ±%10) ile düğme
aralığının kesişimi. Zarf dışına sürüklemede kaydırıcı zarfta durur, bilgi:
"Bu fark yeni bir aile ister: 'Aileyi çoğalt'". Zarf düzenleme arayüzü M5b.

### 2.11 Uyarı kuralları (`tech.ts`, `warnings.ts`)

```ts
type Lim = { caution: number; warning?: number };
export interface TechLimits {
  id: 'modern'; year: number;     // M5c: '1955' | '1970' | '1985' | '2010'
  t4: Lim; t3: Lim; egtMargin: Lim;
  tipMachRel: { fan: Lim; front: Lim; hpc: Lim }; propTipMach: Lim;
  axialUTip: Lim; impellerUTip: Lim;
  an2: { hpt: Lim; lpt: Lim };
  combustorVref: { low: Lim; highAnnular: Lim; highCan: Lim }; hptInletMach: Lim;
  loading: { hpc: Lim; booster: Lim; turbine: Lim };
  lptStages: Lim; hpcExitBladeMm: Lim;
  mixerPR: { caution: [number, number]; warning: [number, number] };
  surgeMargin: Lim;
}
export const TECH_MODERN: TechLimits;
export interface WarnCtx { graph: EngineGraph; built: BuiltEngine; s: DesignSummary; tech: TechLimits; goal?: DesignGoal }
export type WarningId = string;   // aşağıdaki tablodaki kimlikler
export const WARNING_RULES: readonly Rule<WarnCtx>[];
export function evaluateWarnings(ctx: WarnCtx): Finding[];                       // < 2 ms, taslakta da
export function evaluateOperability(b: BuiltEngine): Finding[];                  // trim; yalnız tam üretimde, boşta
export interface TeachingError { title: string; text: string; knobs: string[]; glossary?: string;
  source: 'graph' | 'flowpath' | 'design'; group?: string; raw: string }
export function translateError(e: unknown): TeachingError;
```

**Eşik kuralı:** her eşik, yedi şablonun ilgili en kötü değerinden en az %4
uzaktadır (pay yönünde). Mutlak paylı ölçülerde (EGT payı) şablon ≥
caution + 10 K. Eşikler önce fizikten (literatür), sonra bu kurala karşı
denetlenir; çelişirse **şablon** düzeltilir, eşik gevşetilmez (TP için
Tasarım 1'in "eşiği 1,55'e çek" önerisi reddedildi).

| Id | Ölçü | Yön | Caution / Warning | Şablon en kötü (uydurulmuş) | Parça · sözlük · ders · Düzelt |
|---|---|---|---|---|---|
| `fanTipMach` | fan Mrel (BPR ≥ 1) | > | 1,50 / 1,70 | TF 1,31 | fan · `tipMach` · `birdstrike` · `fan.tipSpeed` |
| `frontTipMach` | ilk LP kompresör Mrel (BPR < 1) | > | 1,72 / 1,85 | MTF 1,64 | fan/booster · `tipMach` · `surge` · `lpc.tipSpeed` |
| `hpcTipMach` | HPC 1. kademe Mrel | > | 1,55 / 1,70 | TF 1,40; TP ≤ 1,49 (hedef) | hpc · `tipMach` · `surge` · `hpc.tipSpeed` |
| `propTipMach` | durağan pervane ucu Mach | > | 0,80 / 0,90 | TP 0,73 | propeller · `tipMach` · `altitude` · `propeller.rpm` |
| `axialTipSpeed` | eksenel uç hızı | > | 600 / 660 m/s | TF HPC 552 | ilgili sıra · – · `birdstrike` · `<m>.tipSpeed` |
| `impellerTipSpeed` | çark ucu | > | 620 / 680 m/s | TP ≤ 595 (hedef) | hpc · – · – · `hpc.centrifugal.workFraction` |
| `an2Hpt` / `an2Lpt` | AN² [m²·rpm²] | > | 4,2e7 / 5,0e7 | MTF LPT 3,64e7; TP ≤ 4,0e7 (hedef) | hpt/lpt · `an2` · – · `<t>.mach.1` |
| `t4` | T4 | > | 1750 / 1900 K | TF 1680 | hpt, combustor · `tit` · `brayton` · `combustor.tit` |
| `t3` | T3 | > | 1000 / 1060 K | TF 962 | hpc · `opr` · `brayton` · `hpc.pr` |
| `egtMargin` | `limits.egtAmber − (T45,tasarım − 273,15)` [K] | < | 25 / 0 | ölçülür; ≥ 35 olmalı | lpt · `egt` · `fadec` · `combustor.tit` |
| `hpcExitBlade` | son **eksenel** HPC kanat yüksekliği | < | 12 / 8 mm | TS ≥ 12,5 (hedef) | hpc · `stageLoading` · – · mimari: santrifüj |
| `combustorVelLow` | ref. hız | < | 15 / 10 m/s | TF/TP 20 | combustor · `refVelocity` · – · `combustor.refVelocity` |
| `combustorVelHigh` | ref. hız | > | halka 48 / 58; kutu, kutu-halka 52 / 62 | TJ 43,4 | combustor · `flameout` · `start` · aynı |
| `hptInletMach` | `hpt.mach[0]` | < | 0,085 / – | TF/TP 0,10 | hpt · – · – · `hpt.mach.0` |
| `hpcLoading` | gerçek ψ (eksenel) | > | 0,60 / 0,75 | TJ 0,534 | hpc · `stageLoading` · `surge` · `hpc.pr` |
| `boosterLoading` | gerçek ψ | > | 1,00 / 1,20 | TF 0,90 | booster · `stageLoading` |
| `turbineLoading` | gerçek ψ (hpt/lpt) | > | 3,2 / 3,8 | TF LPT 3,0 | hpt/lpt · `stageLoading` |
| `lptStages` | LPT kademe sayısı | > | 7 / 9 | TF 6 | lpt · `bpr` · – · `fan.tipSpeed` |
| `mixerPR` | P19t/P5t (karıştırıcıda) | dışında | [0,92, 1,12] / [0,85, 1,20] | ölçülür (MTF, TFM) | mixer · `mixer` · – · `fan.pr` (ikiye bölme → 1,02) |
| `surgeMargin` | tasarım noktası surge payı (trim) | < | 0,12 / 0,08 | ölçülür (katalogda > 0,1 → P3 kesinleştirir) | hpc · `surgeMargin` · `surge` |
| `idleTrim` | rölanti trim'i yanmıyor ya da N2 < idleN2 − 0,03 | – | – / warning | – | combustor · `hungStart` · `start` |
| `fullTrim` | tam güçte N1 < 0,95 ya da EGT sınırlayıcı | – | caution | – | lpt · `fadec` · `fadec` |
| `envelope` | hedef zarf (çap/boy) aşımı | > | caution | – (yalnız görev/hedef varken) | engine · – · – |
| `smallEngine` | W < 5 kg/s ve eksenel HPC | info | – | – | "Küçük motorda Reynolds ve uç boşluğu verimi düşürür; model ölçek etkisini M5c'de hesaplayacak." |
| `chevronCost` | chevron > 0 | info | – | – | nozzle · `chevron` |
| `info.tw`, `info.specificThrust`, `info.velRatio` | T/W, özgül itki, V19/V9 | info | – | – | sonuç paneli (uyarı listesine girmez) |

AN² eşikleri literatürle uyumlu: 4,2e7 m²·rpm² ≈ 6,5e10 in²·rpm² (ileri
disk), 5,0e7 ≈ 7,75e10. EGT `limits.egtAmber` °C'dir; EGT istasyonu
simülasyonda **45**'tir (engineSim.ts:846), tasarım noktası ISA deniz
seviyesi statik, `sized.point.stations['45'].T` [K]. `info` düzeyi gri
"ipucu"; "şablon uyarı vermez" ölçütünde yalnız caution ve warning sayılır.

**Metinler** (örnekler; tamamı P3'te, Türkçe, sayılar `tr-TR` virgüllü):
- `fanTipMach`: "Fan ucu bağıl Mach {v}: uçta şok dalgaları verimi düşürür ve kalkışta 'testere' sesi (buzz-saw) yapar. Uç hızını düşür."
- `hpcTipMach`: "HPC ilk kademesi Mach {v}: kısa kanatlarda şok kaybı büyük. Uç hızını düşür ya da santrifüje daha çok iş ver."
- `an2Hpt`: "HPT AN² {v}: diskteki merkezkaç gerilmesi kanat alanı × devir² ile artar; sınırı aşan disk patlar. Çıkış Mach'ını artır (kısa kanat) ya da devri düşür."
- `t4`: "T4 {v} K: kanatlar tek kristal alaşımın sınırında. Gerçek motor kompresörden %15–20 soğutma havası alır (M5c'de hesaplanacak)."
- `egtMargin`: "EGT payı {v} K: kalkış gücünde türbin çıkışı sürekli sınırın üstünde. Test hücresinde FADEC itkiyi kısacak. Yeni motorda 40–60 K bırakılır."
- `hpcExitBlade`: "HPC son kanadı {v} mm: uç boşluğu kanat boyuna oranla büyür, verim düşer. Küçük motorlar bu yüzden santrifüj son kademe kullanır."
- `mixerPR`: "Karıştırıcıda baypas/çekirdek basınç oranı {v}: akışlar eşit basınçta buluşmazsa karışma kaybı büyür ve biri ötekini tıkar. 'Düzelt' fan basınç oranını dengeler."

**Hata çevirisi** (`translateError`):

| Ham hata | Öğretici metin | Önerilen düğmeler |
|---|---|---|
| `P5 ≤ P0` (design.ts:511) | "Çekirdekte genişleyecek basınç kalmadı: türbin bütün basıncı fanı çevirmeye harcıyor. BPR ya da FPR'yi düşür, T4'ü artır." | fan.bypassRatio, fan.pr, combustor.tit |
| LPT fanı çeviremiyor (507) | "LPT'nin çekebileceği iş fanın istediğinden az." | aynı |
| HPT işi çıkaramıyor (485) | "HPT kompresörü çeviremiyor: T4 çok düşük ya da HPC basınç oranı çok yüksek." | combustor.tit, hpc.pr |
| güç türbinine basınç kalmıyor (499) | "Güç türbinine genişleyecek basınç kalmadı: gaz jeneratörü kendi kompresörünü zor çeviriyor." | combustor.tit, hpc.pr |
| T4 < T3 (478) | "Yanma odası çıkışı girişinden soğuk olamaz: T4'ü artır ya da OPR'yi düşür." | combustor.tit, hpc.pr |
| kanal sığmıyor (flowpath 108) | "{modül} çıkışında kanal kapanıyor: uç çok daralıyor ya da çıkış Mach'ı çok düşük." | `<m>.taper`, `<m>.mach.1` |
| kutu sığmıyor (272) | "{n} kutu çevreye sığmıyor: kutu sayısını azalt ya da referans hızı artır." | combustor.cans |
| NaN/∞ itki, kütle | "Tasarım noktası çözülemedi: değerler fiziksel aralığın dışında." | son değişen düğme |
| GraphError | metin aynen (zaten öğretici), `group` ve `knobs` panele bağlanır | kuraldaki |

### 2.12 Sonuç özeti (`summary.ts`, `evaluate.ts`)

```ts
export interface RowSummary { stages: number; uTip: number; uMean: number; loading: number;
  hExitMm: number; rpm: number; mrelTip?: number; an2?: number }
export interface DesignSummary {
  output: 'thrust' | 'propeller' | 'shaft';
  thrust: number; thrustWet?: number; shaftPower?: number;     // N, N, W
  tsfc?: number;   // g/(kN·s)
  sfc?: number;    // g/(kW·h)
  mass: number; massParts: Record<string, number>; cgZ: number;
  thrustToWeight?: number; powerToWeight?: number; specificThrust?: number;
  diameter: number; length: number;
  opr: number; bpr: number; fpr?: number;
  t3: number; t4: number; t45: number; egtMargin: number;
  rpm: { lp: number; hp: number }; gearRatio?: number;
  rows: Partial<Record<'front' | 'booster' | 'hpc' | 'hpt' | 'lpt', RowSummary>>;
  impellerUTip?: number; hptInletMach: number;
  combustor: { style: CombustorStyle; vref: number; length: number; height: number; cans?: number };
  mixerPR?: number; velocityRatio?: number;
  stagesLabel: string;   // "1+3 · 9 · 2+6"
}
export interface SummaryDelta { key: keyof DesignSummary | string; abs: number; rel: number; better: boolean | null; text: string }
export interface LimitGauge { id: string; label: string; unit: string; value: number;
  caution: number; warning?: number; dir: 'above' | 'below'; parts: string[]; glossary?: string }
export interface Evaluation { graph: EngineGraph; built: BuiltEngine; summary: DesignSummary;
  gauges: LimitGauge[]; findings: Finding[] }
export function summarize(b: BuiltEngine): DesignSummary;
export function evaluate(g: EngineGraph, opts?: BuildOptions): Evaluation | { error: TeachingError };
export function diffSummary(a: DesignSummary, b: DesignSummary): SummaryDelta[];
/** Neden zinciri: en büyük 3 kütle katkısı, kademe ve devir değişimleri */
export function explainDelta(a: DesignSummary, b: DesignSummary): string[];
```

`FlowMetrics` (flowpath.ts:747-760) genişler: `rows` (uTip, uMean,
loading, stages, hExit), `impellerUTip`, `hptInletMach`, `combustor`
boyutları, `gearRatio`, `hpcExitBladeMm`, `mass.centroids`. `estimateMass`
(709-731) parça başına eksenel ağırlık merkezi döndürür.

### 2.13 Atölye durumu (`src/workshop/store.ts`, `project.ts`, `history.ts`, `goals.ts`)

```ts
export type TemplateId = 'turbojet' | 'turbojetDry' | 'militaryTurbofan' | 'turbofanMixed'
                       | 'turbofan' | 'turboprop' | 'turboshaft';
export type EngineFamily = Family<EngineGraph, Architecture>;
export interface WorkshopProject {
  families: EngineFamily[];     // en çok 8 (M5a)
  activeFamily: string;
  expert: boolean;
  baseline?: { familyId: string; variantId: string; graph: EngineGraph };  // kıyas noktası
  goal?: DesignGoal;
}
export type ModuleRef = ModuleType | 'engine';
export type HandleId = 'frontTip' | 'propTip' | 'length:fan' | 'length:lpc' | 'length:hpc' | 'nozzleExit';

export interface WorkshopState {
  project: WorkshopProject;
  graph: EngineGraph;                 // çözülmüş etkin varyant (geçersiz olabilir)
  last: Evaluation;                   // son geçerli
  error: TeachingError | null;
  selected: ModuleRef | null;
  compare: DesignSummary;             // delta çiplerinin kıyas noktası
  phase: 'start' | 'wizard' | 'edit' | 'testing';
  dragging: HandleId | KnobId | null;
  canUndo: boolean; canRedo: boolean;
}

export class WorkshopStore {
  constructor(o: { onBuilt(b: BuiltEngine, detail: 'draft' | 'full'): void; now?: () => number; storage?: Storage | null });
  readonly state: Readonly<WorkshopState>;
  subscribe(fn: (s: WorkshopState) => void): () => void;
  // başlangıç
  startFromTemplate(id: TemplateId): void;
  startWizard(): void;
  wizardChoose(axis: keyof Architecture | 'output', value: unknown): void;
  wizardSize(target: { thrust?: number; shaftPower?: number }): void;
  wizardFinish(): void;
  resume(): boolean;                                 // otomatik kayıttan
  // düzenleme (her biri Edit üretir, geri al yığınına girer; input aşaması birleşir)
  apply(e: Edit, phase?: 'input' | 'change'): void;
  setKnob(id: KnobId, v: KnobValue, phase: 'input' | 'change'): void;
  setArchitecture(axis: keyof Architecture, value: unknown): void;   // yeni aile açar
  dragHandle(id: HandleId, target: number, phase: 'start' | 'move' | 'end'): void;
  setName(name: string): void;
  select(m: ModuleRef | null): void;
  setExpert(on: boolean): void;
  addVariant(): void; selectVariant(id: string): void; selectFamily(id: string): void;
  pinBaseline(): void;
  applyRemedy(f: Finding): void;
  revertToLastGood(): void; resetToTemplate(): void;
  undo(): void; redo(): void;                        // son 30 Edit, bellekte
  handles(): HandleSpec[];                           // dünya konumlarıyla
  exportDoc(): string; importDoc(json: string): { errors: string[]; notes: string[] };
}
```

- Store **saf TS**'tir. 3B ve simülasyona dokunan tek nokta `onBuilt`'tir;
  App bunu `applyDesign('workshop', …)` ile bağlar.
- Beklenen hatalar (`GraphError | FlowpathError | DesignError`, NaN/∞)
  **yakalanır, `state.error`'a yazılır; asla `console.error` çağrılmaz**
  (oynanış testi konsol hatasını başarısızlık sayar). Kod incelemesi
  maddesi; `store.test.ts` `console.error`'u casusla sıfır kez doğrular.
- **Kısma:** `input` aşamasında sayılar her olayda (rAF ile birleşik) tam
  fizikle hesaplanır; `onBuilt('draft')` en çok `1/(son üretim süresi + 16
  ms)` sıklıkta ve aynı anda tek iş. `change` ve tutamaç `end`'de hemen
  taslak, 250 ms sonra tam (mevcut `fullDetailTimer`).
- **Otomatik kayıt:** `localStorage['turbofan-akademi:workshop:v1']` =
  `WorkshopProjectDocV1` (try/catch; okunamazsa sessizce boş başlar). Yalnız
  "Devam et" kolaylığı; kaydet/yükle arayüzü M5b.
- **Mimari değişimi** (`setArchitecture`) **yeni aile** açar: kod `AT-n`,
  grafik `applyArchitecture(new, activeVariant.graph)`; eski aile listede
  kalır (yıkıcı onay yok). Bildirim: "Yeni aile AT-2 açıldı; AT-1 duruyor."
- **Varyant adı** `${code}/${round(itki kN)}`; mil gücünde
  `${code}/${round(P/100 kW)}`; ad elle değişince kilitlenir. En çok 4 varyant.

```ts
// goals.ts — Görev kartı (kesilebilir, §9.2 S7)
export interface DesignGoal {
  id: string; title: string; brief: string;
  require: { thrustMin?: number; shaftPowerMin?: number; tsfcMax?: number; sfcMax?: number;
             massMax?: number; diameterMax?: number; lengthMax?: number; noWarnings?: boolean };
  hint?: string; lesson?: string;
}
export const GOALS: readonly DesignGoal[];   // 3 görev: "Füze motoru" (çap ≤ 0,5 m, 4 kN),
                                             // "Bölgesel jet" (≥ 80 kN, TSFC ≤ 11), "Helikopter" (≥ 1,2 MW, ≤ 250 kg)
export function checkGoal(g: DesignGoal, s: DesignSummary, f: Finding[]): { met: boolean; rows: { label: string; ok: boolean; text: string }[] };
```

Hedef zarf (`diameterMax`, `lengthMax`) 3B'de tel kafes kutu olarak çizilir
(Sprocket'in "gövdeye sığ" kısıtının tohumu; Faz 4'te gövde yuvası olur).

### 2.14 Kararlı serileştirme biçimi (`src/design/engineDoc.ts`)

```ts
export type GraphDoc = Omit<EngineGraph, 'kind'>;     // kind türetilir, yazılmaz
export interface EngineDocV1 {
  format: 'tfa-engine'; v: 1;
  family: {
    id: string;                    // 'f_' + 10 karakter Crockford base32 (kalıcı)
    code: string; name: string;
    base: GraphDoc;                // TAM grafik: şablona göre fark DEĞİL (şablonlar yeniden kalibre edilebilir)
    envelope?: Record<string, [number, number]>;
    origin?: { from: 'template' | 'wizard' | 'import'; template?: TemplateId; app: string };
  };
  variants: { id: string /* 'v_' + 8 */; name: string; nameLocked?: boolean; values: Record<string, KnobValue> }[];
  active: string;
  meta: { created: string; modified: string; author?: string; notes?: string; tech?: string };
  ext?: Record<string, unknown>;   // bilinmeyen alanlar okunur ve geri yazılır
}
export interface WorkshopProjectDocV1 { format: 'tfa-workshop'; v: 1; families: EngineDocV1[]; active: string; expert: boolean; goal?: string }
export function serializeDoc(d: EngineDocV1): string;           // kanonik JSON
export function parseDoc(json: string): { doc?: EngineDocV1; errors: string[]; notes: string[] };
export function graphRev(g: EngineGraph): string;               // 'r' + fnv1a64(canonical(g \ kind))
export function variantRev(d: EngineDocV1, variantId: string): string;
export const MIGRATIONS: readonly Migrator[];                   // M5a'da boş
// M5b: toShareCode/fromShareCode = 'TFA1.' + base64url(deflate-raw(json)) (CompressionStream)
```

Kanonik kurallar §2.2'deki gibi; `modules` dizisi `ORDER` sırasında; varyant
`values` anahtarları sıralı, `base` ile aynı değer yazılmaz. Okuma: `v > 1`
→ "Daha yeni sürümle kaydedilmiş"; `v < 1` → `MIGRATIONS`; `KNOB_ALIASES`;
aralık dışı değer kırpılır ve `notes`'a yazılır; ardından `validateGraph`,
hata varsa `errors`. Boyut sınırı 64 KB.

### 2.15 Motor kartı taslağı (`src/design/card.ts`; arayüz M5c)

```ts
export interface MountPoint { id: 'front' | 'rear' | 'thrust' | 'output'; z: number; r: number;
  angle: number /* rad, 0 = +Y */; type: 'pylon' | 'trunnion' | 'flange' | 'gearbox' }
export interface RatingPoint { thrust: number; shaftPower?: number; fuelFlow: number; tsfc: number; airflow: number; egt: number }
export interface EngineCard {
  format: 'tfa-engine-card'; v: 1;
  ref: { familyId: string; variantId: string; rev: string; family: string; variant: string };
  presentation: EngineKind; archKey: string;
  output: 'thrust' | 'propeller' | 'shaft'; afterburner: boolean; bypassRatio: number;
  dims: { length: number; maxRadius: number;
    intake: { z: number; radius: number; y: number }; exhaust: { z: number; radius: number };
    envelope: [number, number][];                 // dış zarf [z, r], z artan
    propDiameter?: number;
    outputShaft?: { z: number; radius: number; rpm: number; drive: 'front' | 'rear' } };
  mass: { dry: number; cgZ: number };
  mounts: MountPoint[];
  ratings: { takeoff: RatingPoint; maxAB?: RatingPoint };
  spools: { lpRpm: number; hpRpm: number };
  installation: { bleedMax: number; powerOfftake: number };
  deck?: unknown; noise?: unknown; emissions?: unknown; cost?: unknown; life?: unknown;  // M5c
}
export function buildEngineCard(doc: EngineDocV1, variantId: string, b: BuiltEngine): EngineCard;
```

Her `*Layout` iki alan kazanır: `mounts: MountPoint[]` ve
`outerProfile: [number, number][]`. Bağlantılar: nacelle → fan kasası üstü
`fan.z0 + 0,55s` + türbin arka çerçevesi; bare → kompresör ön çerçevesi +
türbin çıkış çerçevesi; turboprop → redüktör flanşları; turboşaft → çıkış
flanşı + arka trunnion'lar. Kural (kalıcı): Faz 4 uçak tasarımcısı yalnız
`EngineCard` okur; kartı gömülü kopya + `rev` ile saklar.

---

## 3. Yeni mimariler

### 3.1 Ortak ön koşul: yerleşim ve model kayıt defteri

- `flowpath.ts` mekanik olarak bölünür (davranış aynı; altın test korur):
  `flowpath.ts` ortak (akış fonksiyonu, `sizeRow`, `computeGasPath`,
  `estimateMass`, metrics, `computeFlowpath`, eski adların re-export'u);
  `layouts/bare.ts`, `layouts/turbofan.ts`, `layouts/turboprop.ts`,
  `layouts/gasgen.ts` (TP/TS ortak gaz jeneratörü), `layouts/turboshaft.ts`.
- `layouts/index.ts`: `export const LAYOUTS: Record<LayoutStyle, LayoutFn>`;
  her dosya `export const READY: boolean` taşır. Hazır olmayan yerleşim
  `FlowpathError('… yerleşimi henüz yok')` atar; ilgili mimari kartı
  "yakında" rozetiyle seçilemez. M5a sonunda bütün `READY = true`.
- `computeFlowpath` seçimi `layoutStyleOf(g)` ile (flowpath.ts:786, 803,
  819 dalları kalkar). `!` ile null varsayımları (342, 818, 831) dar tipli
  switch ve `front ?? hpc` ile kapanır.
- `EngineLayout = BareJetLayout | TurbofanLayout | TurbopropLayout | TurboshaftLayout`;
  hepsi `style`, `mounts`, `outerProfile`, `intake`, `exhaustExit` taşır.
- `src/engine/models.ts`:
  ```ts
  export interface VisualSource { slot: SlotId; built: BuiltEngine; layout: EngineLayout; traits: EngineTraits }
  export type ModelBuilder = (materials: Materials, src: VisualSource) => EngineModel;
  export const MODEL_BUILDERS: Record<LayoutStyle, ModelBuilder>;
  ```
  `EngineModel` arayüzü `visual.ts`'ten buraya taşınır; `outputShaft?:
  Object3D`, `mixer?: Object3D` eklenir. JS üreticileri için `models.d.ts`
  dönüş tipini bildirir (`as unknown as` kalkar).
- `EngineVisual` constructor'ı: `(materials, src: VisualSource, opts?: { effects?: boolean })`.
  `visual.ts:251-255` `MODEL_BUILDERS[src.traits.layout]` olur.
- Yeni `PartId`'ler: `mixer`, `outputShaft`, `engineCase` (çıplak/TP
  gövdesi bugün `fanCase`), `accessories` (bugün `gearbox`). Şablonlarda
  yeniden etiketleme görsel değişiklik yapmaz; `parts.ts`'e kart metinleri.

### 3.2 Art yakıcısız çıplak motor (`turbojetDry`, mimari 2 ve 4)

**Grafik** (TJ şablonundan; J57/J79-kuru sınıfı):

```ts
{ name: 'AT-1 Sade turbojet', massFlow: 66, modules: [
  inlet{bellmouth, .38, .76, 6}, lpc{TJ ile aynı}, hpc{TJ ile aynı},
  combustor{style:'canAnnular', cans: 8, tit 1230, dp .05, refVelocity 35, lengthHeight 4.5, …},
  hpt{TJ}, lpt{TJ}, nozzle{style:'fixed', cv .98} ] }
```

**Akış yolu** (`layouts/bare.ts`):

```ts
export interface FixedNozzleGeometry { kind: 'fixed'; z0: number; z1: number; r0: number; rExit: number }  // rExit = √(A9/π)
export interface VariableNozzleGeometry { kind: 'variable'; style: 'convergent' | 'cd'; hingeR: number; throat0: number; primary: number; divergent: number; flaps: number }
export interface BareJetLayout { style: 'bare'; /* mevcut */
  ab: { R: number; z0: number; z1: number; liner: number } | null;   // AB yoksa null (bugün 0,6 m sahte kanal, :351-353)
  jetPipe: { z0: number; z1: number; r: number };                    // LPT çıkışı → lüle; boy 1,2·r
  nozzle: FixedNozzleGeometry | VariableNozzleGeometry;
  mixer: { z0: number; z1: number; r: number; amp: number; lobes: number; style: 'confluent' | 'lobed' } | null;
  mounts: MountPoint[]; outerProfile: [number, number][] }
```

- Kütle (825-830): `afterburner` kalemi yalnız `ab` varken; sabit lüle
  `shellMass(r0, z1−z0, 0,003, RHO.ni)`.
- Karışık kuru düşük baypas (mimari 4): ortak lüle `A9mix`'ten (§2.9).

**3B** (`barejet.js`, `nozzle.js`):
- `:211-245` (AB kabuğu, gömlek, püskürtme halkaları, alev tutucular)
  `if (v.ab)` içine; AB'ye bağlı ögeler koşullu: `:169` `prof`, `:325` AB
  yakıt hattı, `:327-328` kablo uçları, `:330` bNut, `:333` kaldırma kulağı,
  `:359-360` `abZ/abR`.
- `:248` → `v.nozzle.kind === 'fixed' ? buildFixedNozzle(materials, v.nozzle) : buildNozzle(...)`.
  `buildFixedNozzle` (nozzle.js, inconel `thickLathe` konisi) `{ group,
  exitZ, exitR }` döndürür, `set` yok; dönüşte `nozzle: undefined`.
- `kind` parametresi (`:93/95/270`) kalkar: `src.traits.lpLoad === 'lpc'`.
- Ölçeklenmeyen sabitler ön sıra uç yarıçapına oranlanır (oranlar bugünkü
  TJ'den, şablonda görüntü aynı): `:104-116` bellmouth (+0,38 m), `:122-131`
  burun (r 0,165–0,17), `:138` IGV göbeği, `:176` ayırıcı (0,36/0,375, z 0,9),
  `:292-293` aksesuar boyları.
- Görsel/sim: `nozzleSchedule` AB yoksa 1 (engineSim.ts:908), değişiklik yok.

### 3.3 Kutu-halka yanma odası (her aileye dik)

- Tip: `style: 'canAnnular'`; `CombustorGeometry` `style` ve `canR` kazanır.
- `flowpath.ts:268-275` kutu hesabı ve sığma denetimi `style !== 'annular'`
  için çalışır; toplam alan referans hızdan.
- Fizik: varsayılan `dp` stile göre (§2.4); başka sim değişikliği yok.
- 3B (`combustor.js canLiners`, 287-359): `canAnnular` iken kutu başı basınç
  kabı (324-328) çizilmez, ortak kasa kalır (`gaspath.js:153-166`,
  `core.js:182-187`); geçiş kanalı (338-343) uzar ve ortak çıkış halkasına
  bağlanır. Gerçek `can`'de her kutu kendi kabını alır, ortak kasa incelir.
- `buildCombustor` `reuse` ile sarılır (anahtar: stil, kutu sayısı, rMean,
  H, boy, enjektör, ayrıntı).
- M5b notu: `linerUniforms` (94-98) modül düzeyinde tek motor varsayıyor.

### 3.4 Kaportalı karışık akışlı turbofan (`turbofanMixed`, mimari 6)

**Grafik** (TF bağışçısı; CFM56-5C4 sınıfı; P6 kalibre eder, §4.3):

```ts
massFlow 465, inlet{nacelle}, fan{pr 1.6, bypassRatio 6.5, tipSpeed 430, …},
lpc{pr 1.9}, hpc{pr 12.5}, combustor{annular, tit 1600, refVelocity 20, lengthHeight 2.6},
hpt{TF uydurulmuş}, lpt, mixer{style:'lobed', lobes 18, loss .01},
nozzle{style:'fixed', cv .985}, bypassDuct{dp .02, mach .45}
```

**Akış yolu** (`layouts/turbofan.ts`):

```ts
export interface TurbofanLayout { style: 'nacelle'; /* fan, booster, hpc, …, s */
  exhaust:
    | { kind: 'separate'; coreNozzle: …; bypassExit: …; plug: [number, number][] }   // bugünkü alanlar
    | { kind: 'mixed'; mixer: { z0: number; z1: number; r: number; amp: number; lobes: number; style: 'confluent' | 'lobed' };
        ductEnd: { z: number; r: number }; nozzle: { z0: number; z1: number; r0: number; rExit: number };
        plug: [number, number][] };
  nacelle: { endZ: number; exitR: number; outerProfile: [number, number][] };
  mounts: MountPoint[]; }
```

- Karıştırıcı LPT çıkışında (formül `bareJetLayout:425` ile aynı);
  `rExit = √(A9mix/π)`; `nacelle.endZ = mixer.z1 + 1,6·rExit`.
- Çekirdek kaportası karıştırıcıda biter; ayrık baypas lülesi yok.
- Test: kaporta iç duvarı her z'de çekirdek kaportasının dışında.

**3B:**
- `nacelle.js:67`: `dims.endZ` (referans koordinat, bugün 1,52) ve
  `dims.exitR` parametreleri; z > 0,55 kısmı yeni uca doğrusal uzar;
  chevron (159-174) ve `nozzleRing` (177) yeni uçta. Reuse anahtarı
  (`visual.ts:187`) `endZ`, `exitR` içerir.
- `core.js:300-352`: `mixed` dalında `primaryNozzle` yerine karıştırıcı;
  konik kısalır, çekirdek chevron'u yok.
- `lobedMixer` `barejet.js:45-91`'den `src/engine/mixer.js`'e taşınır;
  **yamasız iki yüzlü yeni malzeme** (CLAUDE.md: capify yaması kesitte arka
  yüzleri kırmızı boyar). `mixer` PartId.
- `visual.ts:buildTurbofanModel` (181-213) `exhaust` değerini
  `L.exhaust.nozzle`'dan alır.

### 3.5 Turboşaft (`turboshaft`, mimari 8)

**Grafik** (T700-GE-701C sınıfı; P7 kalibre eder, §4.3):

```ts
massFlow 4.5, shaft{rpm 20900, drive 'front', reduction false, transmissionEff .985, gearboxLength .35},
inlet{style 'annular', separator true, length .3, struts 0},
hpc{pr 17, tipSpeed 440, mach[.45,.25], hubTip .5, centrifugal{workFraction .45, loading .72, diffuserRatio 1.6, gap 1.1}},
combustor{annular, tit 1500, refVelocity 20, lengthHeight 5},
hpt{mach[.10,.30], hubTip .85, loading 1.6},     // 2 kademe hedefi
lpt{tipSpeed 420, mach[.15,.32]},                // serbest güç türbini, 2 kademe
nozzle{style 'stub', exitMach .15, pressureRatio 1.05, cv .97}
```

**Akış yolu:**
- `computeGasPath:250` `else if (prop || shaft)`: HPC `z = SHAFT_Z +
  shaft.gearboxLength + inlet.length·tip`.
- `layouts/gasgen.ts`: `GasGeneratorLayout { gas, case, engineR, shafts, exhaust }`
  `turbopropLayout` ve `turboshaftLayout` tarafından paylaşılır.
- ```ts
  export interface TurboshaftLayout { style: 'turboshaft'; gg: GasGeneratorLayout;
    inlet: { z0: number; z1: number; rOuter: number; rInner: number; separator: boolean };
    output: { z: number; radius: number; flangeR: number; rpm: number; gearRatio: number; reduction: boolean };
    intake: { z: number; radius: number; y: 0 }; exhaustExit: { z: number; radius: number };
    mounts: MountPoint[]; outerProfile: [number, number][] }
  ```
- Çıkış mili çapı `∛(P/ω_çıkış)`; kütle: çıkış mili + (redüktör varsa)
  `8,5 kg/(kN·m)` tork bağıntısı.

**3B:**
- `turboprop.js:247-350` → `src/engine/gasgen.js:buildGasGenerator`
  (gaz yolu, gövde, flanşlar, egzoz, tesisat, stand).
- Yeni `src/engine/turboshaft.js`: halka giriş + ayırıcı, çıkış mili + ön
  flanş, isteğe bağlı redüktör (planet takımı turboprop.js:213-245), pervane/
  çene S-kanalı/`setPitch` yok; `bladeCount = hpc.blades[0]`; `outputShaft`
  ve `engineCase` PartId'leri.
- `visual.ts:523-530`: `m.propeller` yoksa bulanıklık N1'den (güç türbini).

**Test hücresi ve arayüz** (P8):
- Kokpit: `DETENTS.turboshaft` = rölanti / uçuş (gaz jeneratörü gücü), AB
  ve beta yok.
- EICAS: TRQ %, NP, NG (N2), ITT (T45), SHP satırları; "N1" yerine NP.
- Ses: fan tonu ve buzz-saw **kapalı**; çekirdek ıslığı + güç türbini;
  `App.ts:1051-1058` ses girdisi `hpc.blades[0]`, `2·hpc.tip[0]`.
- Efekt: girdap ve dudak buharı yok (`lpLoad ∈ {propeller, shaft}`).
- CycleDiagram: mil gücü satırı (`output !== 'thrust'`).

---

## 4. Şablonların fiziğe uydurulması

Kural: uydurmadan sonra yedi şablonda caution/warning sayısı **0**, her
eşikten ≥ %4 pay. Değerler harita ölçümlerinden; P2 betikle ince ayar yapar
ve **son değerleri bu tabloya işler**.

### 4.1 Turboprop (çekirdek)

| Düğme | Bugün | Hedef aralık (başlangıç) | **Son (P2)** | Gerekçe |
|---|---|---|---|---|
| `hpc.tipSpeed` | 624 | 460–480 (470) | 470 | Mrel 1,86 → ≤ 1,49 |
| `hpc.mach` / `hubTip` | [.252,.144] / .5 | [.45,.25] / .45 | [.45,.25] / .45 | kanal küçülür |
| `hpc.loading` / `pitchSpan` | .253 / 2 | — | .30 / 1,5 | P2 eki: 6 → 5 eksenel kademe (T700 gibi), gaz jeneratörü kısalır |
| `hpc.centrifugal.workFraction` | .45 | .55–.65 (.6) | .6 | eksenel kademe ≤ 6 (8 kademe gerçekçi değil); çark ucu ≤ 595 |
| `hpt.mach` / `hubTip` / `loading` | [.0464,.152] / .682 / 1.478 | [.10–.12, .30] / .85 / 1,6–1,8 | [.11,.30] / **.80** / 1,8 | AN² 7,22e7 → ≤ 4,0e7; giriş Mach ≥ 0,1. Göbek/uç .85'te HPT ucu 618 m/s (> 600 eksenel uç hızı caution); .80'de 543 m/s, tek kademe ψ 1,74 |
| `combustor.refVelocity` / `lengthHeight` | 8,29 / 3,33 | 20 / ~6 | 20 / 6 | H 0,12 → 0,061 m, oda boyu 0,365 m |
| `lpt.mach[1]`, `lpt.tipSpeed` | .271, 491 | .35–.42, 450–480 | .38, 470 | LPT AN² 5,87e7 → 4,00e7 (çelişki yok, S4 durması gerekmedi) |

Ölçülen sonuç (P2, `golden.test.ts`): HPC Mrel 1,479; HPT AN² 3,78e7, LPT
3,998e7; çark ucu 583 m/s; HPC 5 eksenel kademe (son kanat 47 mm), HPT 1,
LPT 2; HPT ucu 543 m/s; kütle 958 → 861 kg; boy 4,24 → 3,96 m; N1 20 376 →
19 504 rpm, N2 29 770 → 29 669 rpm. Katalog: `TURBOPROP.n1Rpm` 19 500,
`n2Rpm` 29 700, `inertia` {lp .328, hp .352} (ikisi de `(n_eski/n_yeni)²`),
`start.starterTorque` 34,1 (§2.8 marş torku bağıntısı: marş süresi aynı).
Çene girişi ağzı `layouts/turboprop.ts INTAKE_MACH` = 0,25'te giriş
akışından (şablonda eş daire 0,174 m; eski sabit 0,2).

Sonuç hedefleri: HPC Mrel ≤ 1,49; HPT ve LPT AN² ≤ 4,03e7; yanma odası 20
m/s; HPT giriş Mach ≥ 0,10; kütle 450–1100 kg; N2 değişirse
`TURBOPROP.n2Rpm` (design.ts:360) ölçülen değere, `inertia.hp ·=
(n2_eski/n2_yeni)²`. LPT AN² hedefi ancak HPC/turbin devri çok düşerse
tutmuyorsa P2 durur ve sorar (§9.2 S4).

**Görsel etki:** gaz jeneratörü belirgin küçülür ve kısalır (H ~1/3, HPT
yarıçapı ~yarı). Sabit ölçülü parçalar çapalanır: plenum ve S-kanal ucu
(`turboprop.js:278-305`) kompresör gözüne (`hpc.tip[0]`, `hpc.z0`);
aksesuarlar (`:336-343`) `engineR`'ye; `intake` (`:380`) gerçek giriş
yarıçapından. Redüktör/spinner (127-244) pervane redüktörü olarak kalır
(gerçekte de iridir). Kamera `KIND_VIEWS.turboprop.exhaust` (hedef z 1,4)
yerleşimden yeniden hesaplanır.

### 4.2 Turbofan (HPT ve yanma odası)

| Düğme | Bugün | Hedef | Ölçülen sonuç |
|---|---|---|---|
| `hpt.mach` / `hubTip` / `taper` | [.0433,.1643] / .7184 / 1.027 | [.10,.30] / .88 / 1.0 | 2 kademe, uç .473, AN² 2,27e7 (P2 ölçümü aynı) |
| `combustor.refVelocity` / `lengthHeight` | 11,84 / 1,571 | 20 / 2,6 | `rOut` .54 → **.507** (P2 ölçümü; .497 tahmindi) |
| `hpt.bladeK` (P2 eki) | [3.235, 3.645] | — | [2.25, 3]: kanat sayısı 159/121 → 111/99 (gerçekçi katılık) |
| `lpt.gap` (P2 eki) | 1,8 | — | 2,4: ITD boyu 0,118 → 0,203 m ≥ 1,2 × tırmanış (0,159 m) |

| `hpc.pr` (P3 bulgusu) | 16,5 | T3 ≤ 960 K | 16,3: T3 962 → 958 K (1000 K caution'dan pay %3,8 → %4,3); OPR 46,3 → 45,8; `DEFAULT_DESIGN.hpcPR` aynı |

P2 sonucu: kütle 5899 → 5644 kg, boy 7,38 → 7,31 m; itki +%0,2 (318,7 →
319,2 kN), yakıt +%0,4, TSFC +%0,2, devirler aynı. T4 1680 K caution
1750'den %4,2 pay (değişmedi).

### 4.2b Askeri turbofan (karıştırıcı dengesi, P3 bulgusu)

P3 ölçümü: karıştırıcıda P19t/P5t = 0,69 → `mixerPR` warning (bant [0,92,
1,12]). S5 uyarınca eşik gevşetilmez, şablon uydurulur (§4.4'teki "MTF
satırları değişmemeli" kuralı bu yüzden kalktı).

| Düğme | Bugün | Son (P2) | Gerekçe |
|---|---|---|---|
| `fan.pr` / `bypassRatio` | 3,1 / 0,68 | 4,3 / 0,55 | baypas basıncı ↑, LPT işi ↑ → P5 ↓: P19t/P5t 0,69 → 0,983 (pay %6,8). F100-PW-229: FPR 3,8, BPR 0,36, OPR 32 |
| `fan.loading` | 0,309 | 0,40 | 3 kademede PR 4,3 (kademe başı ~1,63) |
| `hpc.loading` | 0,232 | 0,255 | fan çıkışı ısınınca HPC 10 kademe kalsın |
| `lpt.loading` / `mach[1]` | 0,988 / 0,238 | 1,45 / 0,30 | 2 kademe korunur (gerçek ψ 1,26); P5 düşünce çıkış kanalı göbeğe açılmasın |
| Katalog `n2Rpm` / `inertia.hp` / `starterTorque` | 14 200 / 5 / 150 | 15 700 / 4,09 / 135,7 | N2 gaz yolundan (15 661); atalet (n_eski/n_yeni)², marş süresi aynı |

Sonuç: kuru itki 80,9 → 83,4 kN (+%3,1), yaş 128,6 → 132,9 kN (+%3,3),
TSFC 22,19 → 21,45 g/(kN·s) (−%3,3; karışma kaybı azaldı), OPR 25,4 → 35,3,
T3 899 K, kütle 2055 → 1801 kg, boy 5,40 → 5,10 m; kademeler 3·10·1·2 aynı.
±%3 hedefi yalnız fan PR / BPR / LPT ile tutmuyor (denge iyileştikçe TSFC
düşer); T4'ü 1670 → 1640 K indirmek (FPR 4,2, BPR 0,5) ±%3'e sokar ama
P19t/P5t 0,969'a iner ve T4'ü de değiştirir — seçilmedi. Uç Mach (MTF
1,641, front caution 1,72) %4,8 pay.

TF devirleri değişmez (N2 HPC uç hızından). **Görsel etki:** HPT halkası
küçülür, çekirdek kısalır, ITD (`core.js:226-243`) LPT'ye dik tırmanır →
kosinüs geçişle yumuşatılır (boy ≥ 1,2·Δr); baypas lülesi arkasında görünen
çekirdek kısalır; `profileAt(cowl, bz)` için `bz > zN0` sınır testi.
Kamera `turbofan.exhaust` (z 2,4) yerleşimden. Kayıt sahneleri (`surge`,
`rain`, `shutdown`) önce/sonra alınır; fark seçilmezse kadraj düzeltilir.

### 4.3 Yeni şablonların kalibrasyon hedefleri (gerçek motor bantları)

| Şablon | Kaynak sınıfı | Hedef bant (ISA SLS kalkış) |
|---|---|---|
| `turbojetDry` | J57-P-43 / J79 kuru | itki 45–55 kN; TSFC 21–26 g/(kN·s); OPR 9–13; kütle 1000–1500 kg; T/W 3,5–5 |
| `turbofanMixed` | CFM56-5C4 | itki 130–170 kN; BPR 6–7; OPR 28–38; TSFC 8,5–11 g/(kN·s); fan çapı 1,75–1,95 m; kütle 2300–3600 kg; `mixerPR` 0,98–1,06 |
| `turboshaft` | T700-GE-701C | mil gücü 1,2–1,6 MW; SFC 260–330 g/(kW·h); kütle 150–320 kg; güç/ağırlık 5–8 kW/kg; çıkış 20 900 rpm; HPC son eksenel kanat ≥ 12,5 mm |

Bant dışı kalan ölçü için kalibrasyon düğmeleri ayarlanır; kütle modeli
(`estimateMass`) bandı tutturamıyorsa katsayı **değiştirilmez**, sapma
`templates.test.ts`'te yorumla belgelenir ve kullanıcıya bildirilir.

### 4.4 Test güncellemeleri

| Test | Değişiklik |
|---|---|
| `golden.test.ts` (yeni, P0) | 4 şablon: itki, kuru/yaş itki, Wf, A8dry, A9, A19, kademe listeleri, N1/N2 rpm, kütle, çap, boy; 5 anlamlı basamak, `toMatchInlineSnapshot`. **Yalnız P2** gerekçeli commit ile günceller; TJ satırları değişmemeli (MTF §4.2b ile değişti) |
| `templates.test.ts` 116 | `TURBOPROP.n2Rpm` ±%1 yeni değerle |
| 123-140 (`OLD_TP` ±%5, kademe, difüzör .26, çark z −.14) | "eski ölçü" bloğu kalkar → fizik testleri (Mrel hp ≤ 1,5; AN² ≤ 4,03e7; refVelocity 18–25; HPT `mach[0]` ≥ 0,1; eksenel kademe ≤ 6) + yeni referans ±%5 |
| 151-158 kütle 450–1100 | korunur |
| 181 `[1,3,9,2,6]` | korunur (HPT 2 kademe) |
| 184 HPT ucu .49 | .473 ±%5 |
| 185 yanma odası .54 | .497, yorum "M5a: fiziğe uyduruldu" |
| 208-210 kaporta | geçmeli |
| `sim.test.ts` | yalnız `TURBOPROP.n2Rpm`/`inertia.hp`; "tam güce 7 s" ve rölanti testleri değişmeden geçer; `turboshaft` eklenir (mil gücü 1,2–1,6 MW, itki < 2 kN) |
| `warnings.test.ts` (P3) | yedi şablonda caution/warning 0; pay raporu `scripts/` altındaki geçici betikle dosyaya |

---

## 5. `kind` kullanım yerlerinin türetilmiş tiple çözümü

| Dosya:satır | Bugün | M5a çözümü | Paket |
|---|---|---|---|
| `sim/design.ts:41` | 4 değerli `EngineKind` | + `'turboshaft'` | P0 |
| `sim/design.ts:153` | `EngineDesign.kind` | `= traits.presentation`; + `mixer?`, `shaft?` | P0/P1 |
| `sim/design.ts:221/266/306/345, 380-385` | el yazımı katalog | aynen; `turboshaft` grafikten kaydolur (`registerCatalogDesign`) | P0/P7 |
| `sim/design.ts:497, 529-551` | prop P5; karışma yalnız AB | `d.prop ?? d.shaft`; `else if (d.mixer)` | P1 |
| `sim/cycle.ts:342-376` | karışma yalnız AB | aynı dal | P1 |
| `sim/engineSim.ts:149, 254-255` | `kind` getter | aynen (presentation) | – |
| `sim/engineSim.ts:641` | `gasGen = kind==='turboprop'` | `!!(d.prop \|\| d.shaft)` | P1 |
| `sim/engineSim.ts:744, 768, 840, 892-898` | pervane | `updateLoad`, `d.prop ?? d.shaft` | P1 |
| `sim/engineSim.ts:885` | snapshot `kind` | aynen | – |
| `design/types.ts:18, 219` | `EngineGraph.kind` zorunlu | isteğe bağlı, okunmaz | P0 |
| `design/graph.ts:105` | kind kopyası | `presentationKind(traits)` | P0 |
| `design/graph.ts:138-147` | mixer yalnız AB | `mixer && !ab → design.mixer` | P0 (yazar), P1 (okur) |
| `design/graph.ts:148-157` | prop yalnız propeller | + `shaft → design.shaft` | P0 |
| `design/graph.ts:178` | `front!.blades[0]` | `prop ? … : (front ?? hpc).blades[0]` | P0 |
| `design/flowpath.ts:342, 818, 831` | `!` | dar tip switch, `front ?? hpc` | P0 |
| `design/flowpath.ts:786, 803, 819` | yerleşim seçimi | `LAYOUTS[layoutStyleOf(g)]` | P0 |
| `design/templates.ts:13/76/152/219` | şablon kind | etiket olarak kalır; `ops` taşıması | P0 |
| `design/catalog.ts:13-18, 20-32, 39-46, 48, 52, 56-76` | kind anahtarlı | `SlotId`; `setSlotGraph`, `builtFor`, `designFor`, `layoutFor`; `overrideGraph` uyumu | P0 |
| `engine/visual.ts:150-174` | `EngineModel` | `models.ts`'e taşınır | P0 |
| `engine/visual.ts:251-255` | `turbofanLayout(kind)!` | `MODEL_BUILDERS[traits.layout]` | P0 |
| `engine/visual.ts:263-264` | alev boyu 3,6/2,6 · 2,4/1,4 | `k·exhaustExit.radius`, `k·intake.radius` (TF değerlerini veren k) | P8 |
| `engine/visual.ts:475` | turbofan iç parça | `traits.layout === 'nacelle'` | P8 |
| `engine/visual.ts:619` | duman normu 45e3/60e3 | `sized.point.thrust` (şablonda aynı sonucu veren katsayı) | P8 |
| `engine/barejet.js:93-95, 270, 292-293` | `kind==='turbojet'` | `src.traits.lpLoad === 'lpc'` | P5 |
| `effects/EngineEffects.js:157, 377, 528` | turbojet isi | `traits.smoky`; kurum `smoky ? 1 : clamp(1−bpr,0,1)·0,4` | P8 |
| `effects/EngineEffects.js:545, 564` | turbopropta girdap/dudak yok | `lpLoad ∈ {propeller, shaft}` | P8 |
| `audio/EngineAudio.ts:171` | `prop` | `output === 'propeller'` pervane; `'shaft'` fan tonu/buzz-saw kapalı | P8 |
| `app/App.ts:221, 234, 310` | kurulum kind | slot | P0 |
| `app/App.ts:513` | `setEngine('turbofan')` | aynen; yuva ayrıldığı için güvenli. `returnTo:'workshop'` seçeneği | P10 |
| `app/App.ts:582-596` | erken dönüş kind | `slot` + `built.rev` | P0 |
| `app/App.ts:605-624, 628-640` | `applyDesign(kind)`, `rebuildVisual` | `applyDesign(slot, EngineGraph \| BuiltEngine \| null, 'draft' \| 'full', BuildOptions & {effects})`; `rebuildVisual(slot, {effects, draft})`; `setEngine(slot, idle, {effects})`; `VisualSource` | P0 |
| `app/App.ts:643-650` | `applyKindViews` | `viewsFor(src)` | P8 |
| `app/App.ts:1051-1058` | ses girdisi | `fanBlades/fanDiameter` tasarımdan; TS'de HPC | P8 |
| `app/CameraRig.ts:45-56` | `KIND_VIEWS` | + `turboshaft`; şablon yuvalarında değişmez (kayıtlar bozulmaz); `workshop` yuvasında `frameDesign(metrics)` / `scaleViews` | P8 |
| `app/Picker.ts:88` | `partInfo(part, kind)` | `presentation` | P8 |
| `game/parts.ts:138-249` | `PART_OVERRIDES` | + `turboshaft`, yeni PartId kartları | P0 (yer tutucu) / P8 |
| `ui/Cockpit.ts:27-48, 177-189` | `DETENTS[kind]`, AB bölgesi MTF/TJ | `setEngine(design, traits)`; AB bölgesi `traits.afterburner` (kuru TJ'de yanlış olurdu); + turboshaft | P8 |
| `ui/Eicas.ts:89-90, 113, 287-295` | etiketler | ITT `lpLoad ∈ {prop,shaft}`; FTIT `bypass && afterburner`; "N1 LP" `lpLoad==='lpc'`; NP turboşaft; AB satırı `afterburner`, NOZ `variableNozzle` | P8 |
| `ui/CycleDiagram.ts:202, 220, 232` | TP ve AB satırları | 202 `output !== 'thrust'`; 220/232 istasyon 7 `afterburner \|\| exhaust==='mixed'`; 19 `bypass && exhaust==='separate'` | P8 |
| `ui/SandboxPanel.ts:81-85, 114, 116, 118-119, 124` | etiket, erken dönüş, pilon/kanat | 5 şablon + `data-kind="workshop"` düğmesi; `refreshEngine()` (rev); pilon/kanat `layout==='nacelle'` | P0/P10 |
| `main.ts:16` | `window.__design` | + `setSlotGraph`, `builtFor`, `TEMPLATES`, `ARCH_OPTIONS` | P0 |
| `sim/sim.test.ts:226-250` | KINDS | + turboshaft | P1 |
| `scripts/bench-rebuild.mjs:21-33` | kind listesi | + aile adları (`--family`) | P11 |
| `scripts/capture/record.mjs:94-99`, `scenes/*.json` | `kind` | aynen (kind yuvaları); yeni sahneler `workshop` yuvası için `setSlotGraph('workshop', g)` | P5/P6/P7 |

---

## 6. Arayüz

### 6.1 Atölye modu

- `App.ts:51` `Mode` + `'workshop'`; `source: 'catalog' | 'workshop'`.
- Menü: `Menus.ts:46` kilitli öge açılır (`data-menu="workshop"`),
  `MenuCallbacks.onWorkshop`; `modal()` ve `seg()` export edilir.
- `openWorkshop({resume?})` (`openSandbox` :558-575 kalıbı): `closeOverlay`,
  `runner = null`, `autoRotate = false`, `pickMode = false`, konsol ve
  diyagram kapalı, `sim.reset()` (atölyede gaz kolu yok), ortam **test
  hücresi** (hücre derlemesi ~10 s; "Test hücresinde çalıştır" anlık olur),
  `rig.go('workshop', { cutaway: state.cut })`, `refreshChrome()`.
- `rig.go(name, opts?: { cutaway?: boolean })`: atölyede kesit kullanıcı
  anahtarıdır; açı geçişleri onu zorla değiştirmez (CameraRig.ts:142).
- `layout()`: `rightOpen = diagramVisible || mode === 'workshop'`; insets
  iki panel için.
- `refreshChrome()`: `setVisible(workshopPanel.el, m==='workshop')`,
  `modeChip` "Atölye", diyagram kapalı.
- `onKey()`: atölyede W/S, PgUp/PgDn, B sim'e gitmez; C (kesit), H
  (arayüz), 1–8 (görünüm) korunur; Esc önce seçimi kaldırır, sonra menüye
  döner (otomatik kayıt olduğu için onay yok); U (uzman), Tab (sonraki
  modül), Ctrl+Z / Ctrl+Shift+Z (geri al/yinele).
- `frame()`: 0,2 s'de bir `workshopPanel.update()` / `resultsPanel.update()`.
- `onPick`: atölyede `store.select(moduleOfPart(part, traits))`;
  `stickyHighlight` kullanılmaz.
- CSS: `body.mode-workshop .side-left, body.mode-workshop .side-right { bottom: 12px }`;
  paneller `.side-left` / `.side-right` sınıflarını kullanır (`ui-hidden`
  ile gizlenir).
- Dar ekran: ≤ 1280 px 320/300 değişkenleri; ≤ 1000 px `.side-right`
  gizlenir, sonuç özeti (itki, TSFC, kütle, uyarı sayısı) üst çubuğun altına
  tek satır `.ws-summary`; ≤ 720 px "atölye masaüstü içindir" bildirimi.

### 6.2 Ekran düzeni (1440×810)

```
┌ Üst çubuk ─────────────────────────────────────────────────────────────────────────────────────┐
│ Atölye · Aile [AT-1 Sade turbojet ▾] · Varyant (AT-1/45)(AT-1/52)(+) · [Temel|Uzman] · Kesit · ↶ ↷ · Görünüm ▾ · ? │
├ Sol 372 ─────────────────┬────────────── 3B (~700 px) ──────────────┬ Sağ 344 ────────────────┤
│ [Mimari] [Ayar] [Aile]    │   ┌ hover: HPC · 3 kd · PR 2,9 · 418 m/s ┐ │ SONUÇ                   │
│ ▸ Motor   W 66 kg/s  ●    │   ○ ön uç tutamacı                       │ İtki      45,0 kN  +2,1 │
│ ▾ LPC     PR 3,2          │ ══[LPC]══[HPC]◆══[YO]══[T]══◎ lüle ağzı  │ TSFC      23,4 g/kN·s   │
│   PR  ━━━━●━━━━░░░  3,20 ↺│   hayalet meridyen (kesikli, --accent)   │ Kütle     1 220 kg      │
│   İtki +1,3 kN · kütle +46│   1,8 m ölçek figürü · hedef zarf kutusu │ T/W 3,76 · 0,79×4,1 m   │
│ ▸ HPC ▸ Yanma ▸ HPT/LPT    │                                          │ SINIRLAR (çubuklar)     │
│ ▸ Lüle (sabit, bilgi)     │   ipucu: "Turuncu noktayı sürükle"       │ KÜTLE ŞERİDİ ▆▆▆▆▆▆▆    │
│ [Şablon değerlerine dön]  │                                          │ UYARILAR (0) · GÖREV    │
│ Ad: [AT-1/45        ]     │                                          │ [▶ Test hücresinde çalış]│
└───────────────────────────┴──────────────────────────────────────────┴─────────────────────────┘
```

### 6.3 Başlangıç ekranı ve sihirbaz

Modal (`data-start`): **Devam et** (`data-action="resume"`, kayıt varsa),
**Şablondan başla** (7 kart, `data-template="<TemplateId>"`), **Sıfırdan
tasarla** (`data-action="start-scratch"`). Her şablon kartında
`outlineSvg(built)` meridyen silueti (render gerekmez), gerçek örnek, mini
istatistik (itki/güç sınıfı, T/W, TSFC).

Sihirbaz (yarı saydam sol panel, model arkada canlı güncellenir; her adım
`data-wizard-step`):

1. **Motor ne üretecek?** `data-arch="output:thrust|shaft"`
2. **LP milini ne çevirecek?** `lpLoad:lpc|fan|propeller|shaft` (1'e göre süzülür)
3. **Baypas havası nereye?** `exhaust:separate|mixed` + `mixer:confluent|lobed` (baypas yoksa atlanır)
4. **Yanma odası?** `combustor:annular|can|canAnnular`
5. **Art yakıcı ve kurulum?** `afterburner:true|false`, `installation:bare|nacelle` (kurallar süzer)
6. **Boyut:** hedef itki (kN) ya da mil gücü (kW): `data-knob="engine.targetOutput"`
   (girdi + kaydırıcı); `solveMassFlow` (~3 ms); canlı "Hava 66 kg/s · giriş
   çapı 0,79 m".

İleri `data-action="wizard-next"`, bitir `data-action="wizard-finish"`.
Varsayılan düğmeler `graphFromArchitecture` (bağışçılar + `DEFAULT_MODULES`:
sabit lüle cv 0,98; kutu-halka 8 kutu, refVelocity 35, lengthHeight 4,5;
düz karıştırıcı loss 0,01; lobe'lu 0,015, 18 lobe; çıkış mili 20 900 rpm).

### 6.4 Mimari kartları (Mimari sekmesi)

Eksen başına bölüm, iki sütunlu `.lesson-card` ızgarası
(`data-arch="<eksen>:<değer>"`). Kart: başlık; ne yapar; + kazanç; − bedel;
gerçek örnek; **canlı bedel** ("kütle +6 %, boy +4 %, TSFC 0 — aynı hava,
T4 ve OPR ile"; `requestIdleCallback`, yalnız görünen bölüm, ~0,1 ms/kart);
ders/sözlük bağlantısı. Durumlar: seçili · seçilebilir · bağımlı ("Şunlar
da değişir: Karıştırıcı → düz, Lüle → YI") · kilitli (gri, kilit simgesi,
`blocked()` metni; "Dişli fan M5b'de" gibi gelecek kartlar da burada).
Mimari değişimi yeni aile açar (§2.13).

| Eksen | Kartlar (örnek · bağlantı) |
|---|---|
| LP yükü | Yok/tek akış (J79, J57 · brayton) · Fan (CFM56, F100 · bpr, anatomy) · Pervane + redüktör (PW150, T56 · altitude) · Çıkış mili (T700, Makila · shaftPower) · *Dişli fan* (kilit: M5b) · *Açık rotor* (kilit: M5c) |
| Booster | Var / yok (CFM56 / F100) |
| HPC | Eksenel (CFM56) · Eksenel + santrifüj (T700, PW100 · uyarı: küçük kanat) |
| Yanma odası | Halka (CFM56) · Kutu (RR Dart, J33) · Kutu-halka (J57, JT8D, J79) |
| Egzoz | Ayrık (CFM56-7) · Karışık düz (CFM56-5C · mixer) · Karışık lobe'lu (TFE731, PW300) |
| Art yakıcı | Var (J79, F100) / yok; AB varken lüle: değişken yakınsak / YI |
| Kurulum | Kaportalı / çıplak |

### 6.5 Düğmeler (Ayar sekmesi)

`src/app/workshop/KnobField.ts` (`.field` kalıbı, FlightControls.ts:20-32):

```
Basınç oranı                      1,55   ↺
[━━━━━━━━━━━●━━━━░░░░░░░░░░]           ← ░ yasak bölge (taralı kırmızı)
 İtki +1,3 kN · TSFC −0,4 % · kütle −46 kg     ← delta çipi
 HPC 9 → 10 kademe                              ← kesikli olay etiketi
```

- Her alan `data-knob="<KnobId>"`; uzman alanlar `data-expert`; modül
  başlıkları `data-module="<ModuleRef>"` (tıklamak 3B'de seçer).
- **Yasak bölge:** `feasibleRange` bırakınca ve boşta hesaplanır; üzerine
  gelince sınır nedeni (`TeachingError`). Değer yasak bölgeye geçmez; sınıra
  yapışır, ray kısa süre kırmızı yanıp söner.
- **Delta çipi:** sürükleme başına göre; renk: itki/güç ↑, TSFC ↓, kütle ↓
  yeşil; çap/boy nötr gri.
- **Duyarlılık ipucu:** etiket üzerine gelince `sensitivity()`.
- **Kesikli olaylar:** kademe sayısı değişince ilgili modül 3B'de 0,6 s
  yanıp söner; sürükleme sırasında kademe histerezisi 0,03 (§2.7).
- **Olaylar:** `input` → sayılar + hayalet + taslak 3B (kısma ile);
  `change` → tam ayrıntı.
- Değişen düğmenin yanında nokta ve "↺" (aile tabanına döner).
- Aile kapsamlı düğme birden çok varyantı etkiliyorsa satır içi onay.

### 6.6 Sonuç paneli (`src/app/workshop/ResultsPanel.ts`, `.side-right`)

1. **Sonuç kartı:** jet: itki (kuru/AB), TSFC, kütle, T/W, çap × boy; mil:
   güç, SFC g/(kW·h), kütle, güç/ağırlık, çap × boy. Sağda kıyas noktasına
   göre delta (öntanımlı: son sürükleme başlangıcı; "Kıyas olarak sabitle"
   `data-action="pin-baseline"`). Deltaya tıklayınca `explainDelta`.
2. **Sınır çubukları** (`data-gauge`): fan/ön uç Mrel, HPC Mrel, HPT AN²,
   LPT AN², T4, T3, EGT payı, HPC son kanat; uzmanda ek: yanma odası hızı,
   HPT giriş Mach'ı, uç hızları, çark ucu, LPT kademesi, karıştırıcı PR.
   Yeşil/amber/kırmızı bölgeler; tıklayınca parçaları vurgular ve açıklama.
3. **Kütle şeridi:** `massParts` yığılmış bar; dilim üzerinde 3B vurgu.
4. **Uyarılar:** `.callout.warn`, `data-warning="<id>"`; eylemler
   `data-action="show-part|glossary|lesson|remedy"`. Kural: öğret,
   dayatma; "Düzelt" ikincil stil, üzerine gelince deltası önizlenir.
5. **Görev kartı** (varsa): satır satır ✓/✗ (`data-goal`).
6. **Ayrıntılar** (katlanır; uzmanda açık): istasyon tablosu (`.st-table`:
   2, 13, 21, 25, 3, 4, 45, 5, 9 için T, P, W), devirler, kademeler, OPR,
   BPR, FPR, özgül itki.
7. **Alt şerit:** `[▶ Test hücresinde çalıştır]` (`data-action="run-in-cell"`);
   kırmızı uyarı varsa altında "2 kırmızı uyarı: test hücresinde göreceksin";
   düğme kapanmaz.

**Hata durumu:** 3B ve sonuç paneli **son geçerli** tasarımı gösterir
(rozetle); sol panel başında kırmızı `.callout` (`data-error`), ilgili
düğmeler kırmızı çerçeveli, `data-action="revert"` "Son geçerli tasarıma
dön".

### 6.7 3B seçme ve temel tutamaçlar

**Parça → modül** (`src/design/partsMap.ts`):

```ts
export const PART_MODULE: Record<PartTag, ModuleRef | null> = {
  spinner: 'inlet', inlet: 'inlet', fan: 'fan', ogv: 'fan', fanCase: 'fan',
  booster: 'lpc', hpc: 'hpc', combustor: 'combustor', hpt: 'hpt', lpt: 'lpt',
  afterburner: 'afterburner', nozzle: 'nozzle', bypassNozzle: 'nozzle', exhaust: 'nozzle',
  propeller: 'propeller', gearbox: 'propeller', mixer: 'mixer', outputShaft: 'shaft',
  engineCase: 'engine', accessories: 'engine', nacelle: 'engine', bypassDuct: 'engine',
  coreCowl: 'engine', shafts: 'engine', pylon: null, wing: null, stand: null };
export function moduleOfPart(p: PartTag, t: EngineTraits): ModuleRef | null; // TJ'de 'booster' → lpc
export function partsOfModule(m: ModuleRef, t: EngineTraits): PartTag[];
```

`visual.highlight(parts: PartId | PartId[] | null)`; termal döngülerdeki
"vurgulu ise atla" (visual.ts:575, 586, 606) küme üyeliği.

**Seçme:** üzerine gelme → `.ws-hover` kartı (modül + 2–3 sayı); tıklama
(6 px / 600 ms eşiği) → seçim, nabızlı küme vurgusu, sol panel Ayar sekmesi
o modülün bölümünü açar; çift tık → `rig.focusOn`; boşa tık/Esc → seçim
kalkar.

**Tutamaçlar** (`src/app/workshop/Handles.ts`): ayrı `THREE.Group`, sahneye
(`visual.root`'a değil; her yeniden üretimde `anchor` ile yeniden konum),
`userData.noClip`, `pickables`'a girmez; ekranda sabit 14 px (üzerinde 18 px),
`--accent`; seçili modülünkiler opak, diğer temel tutamaçlar %35. Kesit
açıkken arka yarıdakiler gizli. Sürükleme düzlemi z ekseninden geçen,
kameraya en çok bakan düzlem (`ray.intersectPlane`); sürüklerken
`rig.controls.enabled = false` ve otomatik yeniden çerçeveleme kapalı.
Kılavuz: kesikli eksen çizgisi, kademe çentikleri, `range()`'in kırmızı
yasak kısmı. Klavye: seçili tutamaçta ←/→ ya da ↑/↓ bir adım, Shift ¼.
Okuma (`.ws-readout`, üç satır): geometri değişimi · sonuç deltası · neden
zinciri.

**Ters eşleme** (`src/design/inverse.ts`, `handles.ts` = `HandleDef<EngineGraph, BuiltEngine, KnobCtx>[]`):

| Tutamaç | Mimari | Konum (`anchor`) | `solve` (hedef → grafik) | Bağlı düğme |
|---|---|---|---|---|
| `frontTip` (radyal) | fan (kaportalı) | `L.fan.tip[0]` @ `L.fan.z0` | `massFlow' = massFlow·(r'/r)²` (sabit Mach ve ν'de A ∝ W); kapalı biçim | `engine.massFlow` |
| | çıplak | `gas.front.tip[0]` @ `front.z0` | aynı | aynı |
| | turboşaft | `gas.hpc.tip[0]` @ `hpc.z0` | aynı | aynı |
| `propTip` (radyal) | turboprop | `L.prop.radius` @ `L.prop.z` | `propeller.diameter = 2r'` | `propeller.diameter` |
| `length:hpc` / `length:lpc` (eksenel, kademeye yapışır) | hepsi (tek kademeli fanda yok) | `row.z1` (orta yarıçap) | `n' = clamp(1 + round((z'−z0)/pitch), 1, 20)`; `pr` ikiye bölmeyle: `stages === n'` ve gerçek ψ = 0,95·ψ_düğme; santrifüjde eksenel pay `dh/(1−wf)`; ≤ 14 adım (~2 ms) | `hpc.pr` / `lpc.pr` |
| `nozzleExit` (radyal) | TP / TS | `L.exhaust.radius` @ `z1` | `nozzle.exitMach = machFromFlow(W5√T5/(P5·πr'²))`, [0,08, 0,5] | `nozzle.exitMach` |
| | ayrık TF (baypas ağzı) | `L.bypassExit.rDuct` @ `z` | A19 hedefi: `fan.pr ∈ [1,25, 2,0]` 14 adımlı ikiye bölme (monoton) | `fan.pr` |
| | çıplak (AB'li/AB'siz) | `nozzle.exitR` @ `exitZ` | **varsayılan (§9.2 S2):** "lüle trimi" — A9/A8dry hedefi için `combustor.tit` ikiye bölmesi (monoton: TJ'de T4 1100→1550 iken A9 0,2075→0,1682) | `combustor.tit` |
| | karışık (MTF, TFM) | ortak lüle ağzı | A8dry/A9mix hedefi için `fan.bypassRatio` ikiye bölmesi (MTF: BPR 0,3→1,5 iken A8dry 0,202→0,249) | `fan.bypassRatio` |

Lüle okumasının ilk satırı bağı açıkça yazar: "Lüle trimi: daha geniş ağız
→ türbin daha az genişletir → aynı hava ve basınç oranında T4 1230 → 1180 K
· itki −…". Her eşleme monotonluk testiyle kanıtlanır (§7 P4b); kaydırıcı
aralığında monoton değilse tutamaç kilitli görünür (`blockedReason`:
"Bu mimaride lüle alanını çevrim belirler: T4'ü ya da basınç oranlarını
değiştir.").

**Sürüklerken akış ve bütçe:**

```
pointermove (rAF ile birleşik, ≤ 60 Hz)
 ├─ ters eşleme 0–2 ms → evaluate (buildEngine 0,05–0,13 ms sıcak; soğuk ölçülür) + uyarılar < 2 ms
 ├─ DOM: sağ panel, çipler, okuma (tek rAF yazımı)
 ├─ hayalet meridyen: meridionalOutline(built) → LineSegments (< 0,5 ms)
 └─ taslak 3B: tek iş, ≥ 120 ms arayla — App.applyDesign('workshop', g, 'draft')
pointerup → taslak hemen, 250 ms sonra tam
```

- **Hayalet** (`src/design/outline.ts` + `src/app/workshop/Ghost.ts`):
  `meridionalOutline(b): {z, r}[][]`; başlangıç şekli gri sabit, yeni şekil
  `--accent` kesikli; kesit düzleminde (±y).
- **Ölçek figürü:** 1,8 m insan silueti (`ShapeGeometry`, `noClip`),
  Görünüm menüsünden kapatılır.
- **Kamera:** `frameDesign(m: {length, diameter, zMid})` → uzaklık
  `max(length·0,62, diameter·1,35)/tan(fov/2)`; boy/çap %15'ten çok değişince
  ve sürükleme yokken 0,6 s'de yeniden çerçeve.
- **Hız önlemleri:** `buildCache.js` ayrıntı başına ayrı `prev` haritası
  (taslak ↔ tam geçişi önbellekten yararlanır); atölyede `EngineVisual`
  `{effects: false}`; `buildCombustor` `reuse`. Bütçe: taslak ≤ 150 ms,
  yedi ailenin her birinde (RTX 4070, `bench-rebuild --family`); aşılırsa
  sürükleme sırasında yalnız hayalet + bırakınca taslak.

### 6.8 Uyarı → ders/sözlük bağlantısı

Yeni sözlük girdileri (`src/game/glossary.ts`, `{id, term, abbr?, body}`):
`tipMach` (uç bağıl Mach), `an2` (AN²), `tit` (T4/TIT), `egtMargin` (EGT
payı), `stageLoading` (kademe yüklemesi ψ), `refVelocity` (yanma odası
referans hızı: **alev borusu toplam kesit alanına** göre hacimsel ortalama
hız), `mixer` (karıştırıcı), `chevron`, `thrustWeight` (itki/ağırlık),
`specificThrust` (özgül itki), `shaftPower` (mil gücü / SFC), `turboshaft`.
Metinler P3'te; terimler sözlükte bir kez tanımlanır, uyarılarda aynı adla
geçer (tutarlılık testi: her `glossary` kimliği sözlükte var).

Ders bağlantıları: `anatomy`, `brayton`, `fadec`, `surge`, `start`,
`altitude`, `birdstrike`. Sözlük atölyenin üstünde modal (`openGlossary`),
ders `startLesson(lesson, { returnTo: 'workshop' })`; ders bitince ya da
çıkınca atölyeye dönülür.

İlk açılış koçluk balonları (`localStorage`'da bir kez; try/catch): "Bir
modüle tıkla" → "Turuncu noktayı sürükle" → "Sağdaki sayılara bak"; her
biri kendi eylemiyle kapanır.

### 6.9 "Test hücresinde çalıştır" ve geri dönüş

`App.runWorkshopDesign()`:
1. `clearTimeout(fullDetailTimer)`; `setSlotGraph('workshop', g)`.
2. `setEngine('workshop', false)` (`rev` değiştiyse kurar; `cockpit.setEngine(design, traits)`,
   `viewsFor(src)`, efektler açık, tam ayrıntı).
3. `sim.reset()` — motor soğuk; çalıştırmak deneyimin parçası.
4. `openSandbox({ from: 'workshop' })`; ortam zaten hücre; `sandboxPanel.refreshEngine()`.
5. SandboxPanel başında şerit: "Atölye tasarımı **AT-1/45** · [← Atölyeye dön]"
   (`data-action="back-to-workshop"`) ve **Beklenen / ölçülen**: tasarım
   itkisi (gücü) vs canlı değer, %; tam güçte ISA'da ±%3; fark varsa neden
   (EGT sınırlayıcı, N1 sınırı).
6. Bildirim: "Tasarımın test hücresinde. 'Otomatik çalıştır' ile başlat."

SandboxPanel motor listesinde 6. düğme "Atölye tasarımı" (`data-kind="workshop"`,
tasarım varsa). Katalog motoru seçmek `source='catalog'` yapar.

Geri dönüş (`openWorkshop({resume: true})`): `sim.reset()`,
`rig.go('workshop')`, seçili modül/kıyas noktası/sekme geri, `{effects:false}`
ile yeniden üretim.

**Yalıtım:** `startLesson` her zaman kind yuvasıyla açılır; atölye yuvası
kind yuvalarını ezmez → dersler ve kayıt sahneleri şablonla çalışır.
`showMenu()`'deki rölanti gösterisi (`trim(0, 8)`) etkin motoru döndürür.

### 6.10 Test kancası (`window.__app.workshop`)

```ts
{
  store: WorkshopStore;
  current(): Evaluation;
  handles(): { id: HandleId; world: [number, number, number]; screen: [number, number]; axis: 'radial' | 'axial'; blocked: string | null }[];
  idle: boolean;              // taslak/tam iş yok, zamanlayıcı yok
  lastBuildMs: number;
  /** Bekleyen tam ayrıntıyı hemen çalıştırır ve framesRendered artışını bekler */
  flush(): Promise<void>;
}
```

---

## 7. İş paketleri

Gösterim: **Sahip** (yalnız bu paket yazar) · **Ortak** (hunk düzeyinde;
hangi bölge) · **Kabul**. Tek geliştirici/ajanla seri sıra da aynı
numaralarla yürür (§7.3). Her paket: Türkçe yorum ve commit; `typecheck`
ve `test` yeşil; kayıt sırasında `src/` düzenlenmez; görsel iddia ekran
görüntüsüyle.

### 7.1 Paketler

**P0 — Sözleşmeler ve iskelet** (dalga 0, M; önce birleşir, tek ajan)
- Sahip: `src/design/core/*`; `src/design/types.ts`, `traits.ts`,
  `graph.ts` (GRAPH_RULES son hali, `buildEngine` imzası, `rev`),
  `catalog.ts` (SlotId); `layouts/index.ts` + mekanik bölünmüş yerleşim
  dosyaları (`READY` bayrakları: bare/turbofan/turboprop `true`, kuru dal,
  mixed dal, turboshaft `false`); `operability.ts` (kimlik taslağı:
  `g.ops` aynen); `engine/models.ts`, `models.d.ts`, `engine/turboshaft.js`
  ve `engine/mixer.js` taslakları (`barejet.js`'teki `lobedMixer` P0'da
  taşınır, import satırı dahil); `src/workshop/*` imzaları (`throw new
  Error('P4b')` gövdeler); `src/design/golden.test.ts`; şablon `ops`
  taşıması.
- Ortak: `sim/design.ts` (yalnız tipler: EngineKind, MixerSpec,
  ShaftOutputSpec, `A9mix?`); `engine/visual.ts` (constructor, dağıtım
  :150-264, PartId birleşimi); `App.ts` (setEngine/applyDesign/rebuildVisual/slot);
  `SandboxPanel.ts` (`refreshEngine`); `main.ts`; `parts.ts` (yer tutucular).
- Kabul: dört şablonda `presentationKind === template.kind`;
  `traitsFromDesign(ENGINE_CATALOG[k])` ile `deriveTraits` aynı; her yeni
  kural mesajı için bir geçersiz grafik testi; `golden.test.ts` yeşil;
  `ONLY=1,sandbox` oynanış testi geçer; `bench-rebuild` önceki ±%10;
  dört motor `side` açısı önce/sonra **aynı** (README'ye konmaz).

**P1 — Simülasyon** (dalga 1, S–M; §9.2 S1 onayı gerekir)
- Sahip: `sim/cycle.ts`; `sim/engineSim.ts` (snapshot dışı); `sim/design.ts`
  `sizeEngine` bölümü (440-600); `design/operability.ts` (gerçek gövde);
  `sim/sim.test.ts` ekleri.
- İş: §2.9 karışık dal ve turboşaft yükü; `deriveOperability`, `rotorInertia`.
- Kabul: `golden.test.ts` **değişmeden** geçer; art yakıcısız karışık TF
  itkisi ayrık jetler ile tam karışım arasında; lobe'lu > düz; `P19t ≈ P5`'te
  karışma kazancı > 0; karışık TF rölanti ve %60 gaz trim'i yakınsar, itki
  gazda monoton; `computeCycle(N1=1,N2=1,wf=ref.Wf)` tasarım itkisi ±%1,
  T4 ±25 K; turboşaft: itki < 2 kN, `power/shaftPower > 0,8` tam güçte, NP
  %100 ±%2, otomatik çalıştırmada light-off 20–40 s; `deriveOperability`
  şablonda kimlik (< 1e-12); TJ-kuru ×0,3 ve ×3 kütle akışında 60 s içinde
  rölanti, sıcak çalıştırma yok, 10 s içinde tam güç.

**P2 — Şablon uydurma** (dalga 1, M; §9.2 S4)
- Sahip: `design/templates.ts`, `templates.test.ts`; `sim/design.ts`
  `TURBOPROP` ve `DEFAULT_DESIGN` sabitleri; `layouts/turboprop.ts` ve
  `engine/turboprop.js` (P7'ye kadar); `engine/core.js` ITD (226-243, P6'ya
  kadar); `golden.test.ts` güncellemesi (tek yetkili).
- İş: §4.1, §4.2, §4.4; TP görsel çapalama; ITD yumuşatma.
- Kabul: §4 sayısal hedefler; `templates.test.ts` yeni referanslarla;
  `ONLY=1,2,sandbox` (ders 1 parça tıklamaları küçülen HPT'yi bulur);
  önce/sonra GIF `tp-fizik` (yan + kesit) ve `tf-fizik` (kesit, gece,
  `scenes/shutdown.json` tarzı) README'ye.

**P3 — Değerlendirme: özet, uyarılar, hatalar, sözlük** (dalga 1, M)
- Sahip: `design/summary.ts`, `evaluate.ts`, `tech.ts`, `warnings.ts`,
  `warnings.test.ts`; `flowpath.ts` metrics genişlemesi (yalnız
  `FlowMetrics` ve `estimateMass` centroid bölümü); `game/glossary.ts`.
- İş: §2.11, §2.12, `translateError`, `evaluateOperability` (`new
  EngineSim(d)`; `trim(0,30)`, `trim(1,30)`; ≤ 30 ms, aşılırsa adım azalır).
- Kabul: yedi şablonda caution/warning 0 (P2 ve yeni şablonlar birleşene
  kadar o şablon için `it.skipIf(!READY)`); pay raporu (her eşik ≥ %4) geçici
  betikle dosyaya; her uyarı kimliği için onu tetikleyen bir grafik
  (sondalar: TF T4 1780 → `egtMargin`; TF HPC PR 19 → `t3` caution; TF W
  ×0,1 → `hpcExitBlade`; TF BPR 10 → `lptStages`; bugünkü TP →
  `hpcTipMach` ve `an2Hpt` warning; `fan.tipSpeed 560` → `fanTipMach`);
  `evaluateWarnings` ≤ 2 ms (100 tekrar); sözlük kimlik tutarlılığı.

**P4a — Mimari** (dalga 1, M)
- Sahip: `design/architecture.ts`, `defaults.ts`, `architecture.test.ts`.
- Kabul: §2.4 geçerli küme (≈ 40 grafik) `buildEngine`'den hatasız, `EngineSim`
  otomatik çalıştırmada 60 s içinde rölanti, sıcak/asılı çalıştırma yok, tam
  güç 10 s; geçersiz birleşimler beklenen GraphError metnini verir;
  `applyArchitecture` ardışık uygulamada `architectureOf` ile tutarlı;
  `graphFromArchitecture` çıktısı uyarısız (P3 sonrası); `solveMassFlow`
  hedefi ±%1. Hazır olmayan yerleşimler (`READY=false`) `skipIf` ile.

**P4b — Atölye çekirdeği** (dalga 1, L, kritik yol)
- Sahip: `design/knobs.ts`, `inverse.ts`, `handles.ts`, `partsMap.ts`,
  `outline.ts`, `engineDoc.ts`, `card.ts`; `src/workshop/*` ve testleri.
- Kabul:
  - **knobs:** her düğme `get(set(g,v)) === clamp(v)`; kimlikler tekil;
    aralık uçlarında şablon ya kurulur ya tipli hata verir; TF'de
    `feasibleRange('fan.pr').hi ∈ [1,58; 1,70]` ve neden "P5".
  - **Bulanık test:** her aile için tohumlu 200 rastgele temel düğme kümesi;
    sonuç ya tipli Türkçe hata ya geçerli motor (NaN, `TypeError`,
    `undefined` erişimi yok); geçerlilerin ≥ %90'ı `trim(0,30)` ile yanar
    ve rölantiye oturur; geçerli oran aile başına ≥ %70 (değilse aralık
    daraltılır, §2.10 tablosu güncellenir).
  - **inverse:** `frontTip` r ×1,05 → W ×1,1025 ±%0,5, uç yarıçapı ±%1;
    `length:hpc` +2 kademe → kademe +2; lüle eşlemeleri monoton ve
    gidiş-dönüşte ±%1 (çıplak→T4, karışık→BPR, ayrık baypas→FPR,
    stub→exitMach); bir tutamaç adımı ≤ 20 ms.
  - **engineDoc:** `serialize → parse → serialize` aynı dizge, aynı `rev`;
    karışık anahtar/modül sırasında `rev` kararlı; `ext` korunur; `v:2`
    reddedilir; alias çalışır.
  - **card:** alanlar sonlu, `mounts ≥ 2`, `envelope` z'de monoton.
  - **store:** `console.error` casusu 0 çağrı; hatalı düğme → `state.error`,
    `last` korunur; geri al/yinele 30 adım; `input` olayları tek Edit'te
    birleşir; ders yalıtımı: workshop yuvası değişince
    `designFor('turbofan')` şablonla aynı.

**P5 — Art yakıcısız çıplak motor + kutu-halka** (dalga 1, M)
- Sahip: `layouts/bare.ts`; `engine/barejet.js`, `nozzle.js`
  (`buildFixedNozzle`), `combustor.js`; `TEMPLATES.turbojetDry`;
  `scripts/capture/scenes/m5a-kuru-turbojet.json`, `m5a-kutu-halka.json`.
- İş: §3.2, §3.3; `READY=true` (kuru dal).
- Kabul: kütle TJ'den en az AB kalemi kadar düşük; §4.3 bandı; normal
  çalıştırma testi; `smoke-families.mjs FAMILY=turbojetDry` hatasız; görsel:
  kuru turbojet yan + kesit, yanma odası yakın kesit üçlüsü (halka / kutu /
  kutu-halka); uç boyutlarda (min/max hava akışı) bellmouth/burun oranlı.

**P6 — Kaportalı karışık akışlı turbofan** (dalga 2, L; P1 + P2 sonrası)
- Sahip: `layouts/turbofan.ts`; `engine/nacelle.js`, `core.js` (P2'den
  sonra); `visual.ts` `buildTurbofanModel` (181-213); `TEMPLATES.turbofanMixed`;
  `scenes/m5a-karisik.json`.
- Kabul: lüle alanı `A9mix` ile ±%3; kaporta iç duvarı çekirdek kaportasının
  dışında; aynı akışta ayrık akıştan ağır, TSFC %1–3 iyi; §4.3 bandı; uyarı
  0; görsel yan, arka ¾ ve kesit, lobe'lar kesitte kırmızı değil.

**P7 — Turboşaft** (dalga 2, L; P1 + P2 sonrası)
- Sahip: `layouts/turboshaft.ts`, `layouts/gasgen.ts`, `layouts/turboprop.ts`
  (P2'den devir); `engine/gasgen.js`, `turboprop.js`, `turboshaft.js`;
  `TEMPLATES.turboshaft`; `flowpath.ts` yalnız `computeGasPath:250`;
  `scenes/m5a-turbosaft.json`.
- Kabul: §4.3 bandı; rölanti ve tam güç trim'i; `fanBlades = hpc.blades[0]`;
  TP şablonu `golden` değişmez (gaz jeneratörü ayrımı davranışsız); görsel
  yan + kesit, standda, pervane yok.

**P8 — Kind dallarını traits'e çevirme** (dalga 1, M)
- Sahip: `ui/Cockpit.ts`, `ui/Eicas.ts`, `ui/CycleDiagram.ts`,
  `audio/EngineAudio.ts`, `effects/EngineEffects.js`, `app/CameraRig.ts`,
  `game/parts.ts`, `app/Picker.ts:88`; `visual.ts` 263-264, 475, 619;
  `App.ts` 643-650 ve 1051-1058.
- İş: §5 tablosundaki P8 satırları; turboşaft kokpit/EICAS/ses.
- Kabul: dört şablonda ekran görüntüleri ve EICAS/diyagram öncekiyle aynı
  (yalnız gürültü); kuru turbojette AB kademesi ve AB satırı yok;
  turboşaftta fan tonu yok, NP/TRQ var; `sim.test.ts` değişmeden.

**P9 — 3B seçme, tutamaçlar, hayalet, hız** (dalga 2, M)
- Sahip: `app/workshop/Handles.ts`, `Ghost.ts`, `ScaleFigure.ts`,
  `EnvelopeBox.ts`; `visual.ts` `highlight` ve termal "vurgulu mu"
  (454-464, 575-650), `{effects}` seçeneği; `app/Picker.ts` (`exclude`,
  tutamaç önceliği); `engine/buildCache.js` (ayrıntı başına `prev`).
- Kabul: tıklama/sürükleme ayrımı korunur; seçili modülün bütün parçaları
  nabızlı; tutamaç ekran konumu `setViewOffset` dahil doğru (test kancası
  `screen`); `bench-rebuild --family` yedi ailede taslak ≤ 150 ms; ekran
  görüntüsü: seçili HPC + ön uç tutamacı, iki aile, kesit açık/kapalı.

**P10 — Atölye arayüzü ve App modu** (dalga 2, L, kritik yol; P4b sonrası birleşir, P0 taslaklarıyla erken başlar)
- Sahip: `app/workshop/{WorkshopPanel,ResultsPanel,StartScreen,Wizard,ArchitectureCards,KnobField,Coachmarks,GoalCard}.ts`;
  `ui/Menus.ts` (modal/seg export, `onWorkshop`); `styles.css` atölye
  bölümü; `App.ts`'in P0/P8 hunk'ları dışındaki mod işleri (Mode, menü,
  layout, refreshChrome, onKey, frame, onPick, `runWorkshopDesign`,
  `openWorkshop`, `startLesson` `returnTo`); `SandboxPanel.ts` atölye
  şeridi; `__app.workshop`.
- Kabul: §8 senaryosu (P11 ile birlikte) yeşil; 1440×810 ve 1280×720'de
  paneller çakışmaz; ≤ 1000 px'te sağ panel gizli, özet şeridi var;
  atölyede W/S/PgUp/PgDn/B sim'e gitmez; Esc menüye döner, "Devam et"
  tasarımı geri getirir.

**P11 — Entegrasyon, oynanış testi, belgeler** (dalga 3, M)
- Sahip: `scripts/playtest.mjs` (workshop bölümü), `scripts/smoke-families.mjs`
  (yeni: 7 aile × 3 yanma odası; kurar, ekran görüntüsü, `pageerror`
  sayar; `FAMILY=` ile tek aile), `scripts/bench-rebuild.mjs` (`--family`),
  `README.md`, `ROADMAP.md`, `docs/ATOLYE.md` (S1: "simülasyon hazır" →
  "küçük sim değişikliğiyle"), `CLAUDE.md` (kod haritası, öğrenilenler),
  `turbofan.html`.
- Kabul: §1.3 bitti ölçütü; CLAUDE.md kapanış adımları.

### 7.2 Önce yazılacak ortak sözleşmeler (P0 kapsamı)

1. `design/core/*` jenerikleri (§2.2).
2. `types.ts` yeni stiller ve modüller, `ops` (§2.3).
3. `Architecture`, `LpLoad` tipleri (gövdesiz) (§2.4).
4. `EngineTraits`, `LayoutStyle`, `presentationKind`, `deriveTraits` (§2.6).
5. `GRAPH_RULES` son hali + `GraphError.ruleId/group/knobs` (§2.5).
6. `SlotId`, `BuiltEngine{traits, rev, graph}`, `BuildOptions`, katalog API'si (§2.7).
7. `EngineLayout` birleşimi, `mounts`/`outerProfile` alanları (değerleri P5–P7 doldurur), `LAYOUTS`, `READY` (§3.1).
8. `VisualSource`, `MODEL_BUILDERS`, `EngineModel` (§3.1).
9. `MixerSpec`, `ShaftOutputSpec` tipleri (§2.9).
10. `KnobId`/`EngineKnob`, `HandleId`, `Finding`, `TeachingError`, `DesignSummary`, `Evaluation`, `WorkshopStore` imzaları (§2.10–§2.13).
11. `data-*` seçici sözleşmesi (§6, §8) — `src/app/workshop/selectors.ts` sabitleri; P10 ve P11 bunları kullanır.

Sözleşme değişikliği gerekirse entegratöre önerilir, tek "sözleşme" commit'iyle girer.

### 7.3 Bağımlılık ve birleştirme sırası

```
Dalga 0  P0 ───────────────────────────────────────────────┐
Dalga 1  P1 sim · P2 şablon · P3 değerlendirme · P4a mimari  │
         P4b atölye çekirdeği (kritik) · P5 kuru+kutu-halka   │
         P8 kind→traits                                       │
Dalga 2  P6 karışık (P1+P2) · P7 turboşaft (P1+P2)            │
         P9 tutamaçlar (P4b imzaları) · P10 arayüz (P4b)      │
Dalga 3  P11 entegrasyon ─────────────────────────────────────┘
```

Birleştirme sırası (`m5a/entegrasyon` dalına): **P0 → P1 → P2 → P3 → P8 →
P5 → P4a → P4b → P6 → P7 → P9 → P10 → P11**. Her birleştirmeden sonra
entegratör `npm run typecheck`, `npm test`, `ONLY=1,sandbox node
scripts/playtest.mjs` çalıştırır; açık dallar rebase edilir. Sonda
entegrasyon dalı `claude/hyperrealistic-jet-engine-xlf5ck`'e hızlı ileri
alınır, push; PR açılmaz.

**Sıcak dosyalar (hunk sahipliği):**

| Dosya | Sahipler | Önlem |
|---|---|---|
| `App.ts` | P0 (setEngine/applyDesign/rebuildVisual/slot), P8 (643-650, 1051-1058), P10 (geri kalan) | P0 → P8 → P10 sırası; P10 en son rebase |
| `visual.ts` | P0 (constructor/dağıtım/PartId), P8 (263, 475, 619), P6 (181-213), P9 (highlight/termal/effects) | ayrık bölgeler |
| `sim/design.ts` | P0 (tipler), P1 (`sizeEngine`), P2 (yalnız `TURBOPROP`, `DEFAULT_DESIGN`) | ayrık bölgeler |
| `core.js`, `turboprop.js` | P2 → P6 / P7 | P6/P7, P2 birleşmeden başlamaz |
| `barejet.js` | P5 (P0 `lobedMixer` taşımasından sonra) | — |
| `flowpath.ts` | P0 böler; P3 (metrics, centroid); P7 (`computeGasPath:250`) | yerleşimler ayrı dosyalarda |
| `SandboxPanel.ts` | P0 (`refreshEngine`), P10 (atölye şeridi, workshop düğmesi) | — |

**Worktree ve port düzeni (PowerShell):**

```powershell
git branch m5a/entegrasyon claude/hyperrealistic-jet-engine-xlf5ck
git worktree add ..\turbofan-m5a-p4b -b m5a/p4b-atolye m5a/entegrasyon
Set-Location ..\turbofan-m5a-p4b; npm ci
npx vite --port 5184 --strictPort        # paket Pn → 518n; 5173 ana, 5174 'once', 4173 preview
```

Her worktree'nin kendi `node_modules` ve kayıt profili
(`node_modules/.cache/capture-profile`) vardır. Tek ajanla seri yürütmede
worktree gerekmez; sıra yukarıdaki birleştirme sırasıdır.

---

## 8. Oynanış testi senaryosu (`scripts/playtest.mjs`, `want('workshop')`)

Yardımcılar (bölüm başında tanımlanır):

```js
const flush = () => page.evaluate(() => __app.workshop.flush());
async function setKnob(id, v) {           // input (taslak) + change (tam)
  await page.$eval(`[data-knob="${id}"] input`, (el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, v);
  await flush();
}
async function dragHandle(id, dx, dy) {   // 8 adımda > 6 px
  const h = await page.evaluate((id) => __app.workshop.handles().find((x) => x.id === id), id);
  check(h && !h.blocked, `tutamaç ${id} hazır`);
  await page.mouse.move(h.screen[0], h.screen[1]); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.screen[0] + dx * i / 8, h.screen[1] + dy * i / 8);
  await page.mouse.up(); await flush();
}
const S = () => page.evaluate(() => __app.workshop.current().summary);
const warnings = (sev) => page.$$eval(`[data-warning][data-severity="${sev}"]`, (e) => e.length);
```

Adımlar:

1. **Giriş:** `.menu-item[data-menu="workshop"]` tıkla → `__app.mode === 'workshop'`;
   başlangıç modalı `[data-start]` görünür.
2. **Sihirbaz:** `[data-action="start-scratch"]`; sırayla tıkla, her
   birinden sonra `[data-action="wizard-next"]`:
   `[data-arch="output:thrust"]` → `[data-arch="lpLoad:lpc"]` →
   (baypas adımı atlanır) → `[data-arch="combustor:canAnnular"]` →
   `[data-arch="afterburner:false"]`, `[data-arch="installation:bare"]`.
   `setKnob('engine.targetOutput', 30)`; `[data-action="wizard-finish"]`;
   `flush()`.
   Denetim: `S().thrust` 30 kN ±%2; `warnings('warning') === 0`;
   `warnings('caution') === 0`; `__app.workshop.current().built.traits`
   `{afterburner:false, combustor:'canAnnular', nozzle:'fixed'}`; `shot('w1-sihirbaz')`.
3. **Modül seçme:** `[data-module="hpc"]` tıkla → `store.state.selected === 'hpc'`;
   ayrıca 3B'de HPC'ye `clickPart('hpc')` → aynı; `shot('w2-secim')`.
4. **Tutamaç 1 — ön uç:** `m0 = S()`; `dragHandle('frontTip', 0, -40)` →
   `S().diameter > m0.diameter·1,03` ve hava akışı > ×1,05.
5. **Tutamaç 2 — kompresör boyu:** `[data-module="hpc"]`;
   `n0 = S().rows.hpc.stages`; `dragHandle('length:hpc', +60, 0)` →
   `stages ≥ n0+1` ve `S().opr > m0.opr`.
6. **Tutamaç 3 — lüle ağzı:** `t0 = S().t4`; `dragHandle('nozzleExit', 0, -20)`
   (ağız büyür) → `S().t4 < t0` (lüle trimi; §9.2 S2 "kilitli" seçilirse
   bu adım `handles()` içinde `blocked !== null` ve açıklama metni
   denetimine dönüşür). `shot('w3-tutamac')`.
7. **Düğme:** `setKnob('combustor.tit', 1280)`; `setKnob('hpc.pr', 4.5)`.
8. **Uyarıyı tetikle ve düzelt:** `[data-action="expert"]`;
   `setKnob('lpc.tipSpeed', 560)` → `[data-warning="frontTipMach"]` var;
   `[data-warning="frontTipMach"] [data-action="show-part"]` tıkla →
   `shot('w4-uyari')`; `[data-warning="frontTipMach"] [data-action="remedy"]`
   tıkla; `flush()` → `[data-warning="frontTipMach"]` yok; caution/warning 0.
9. **Geri al:** `Ctrl+Z` → uyarı geri gelir; `Ctrl+Shift+Z` → kalkar.
10. **Ad:** `page.fill('[data-field="name"]', 'Deneme-1')`.
11. **Belge gidiş-dönüş:** `const j = __app.workshop.store.exportDoc()`;
    `importDoc(j)` → `errors.length === 0` ve `rev` aynı.
12. **Test hücresi:** `[data-action="run-in-cell"]` → `__app.mode === 'sandbox'`,
    `__app.sim.eng.design.name === 'Deneme-1'`, `[data-action="back-to-workshop"]` görünür.
    `button:has-text("Otomatik çalıştır")` → `until(() => __app.sim.lit, null, 45)`;
    `until(() => __app.sim.N2 >= __app.sim.limits.idleN2 - 0.02, null, 40)`;
    `button:has-text("Tam güç")` → `until(() => __app.sim.N1 > 0.9, null, 20)`;
    `advance(5)`. Denetim: `sim.surgeCount === 0`, `!sim.turbineDamaged`,
    `!sim.egtLimited`, itki tasarımın ±%3'ü. `shot('w5-hucre')`.
13. **Dönüş:** `[data-action="back-to-workshop"]` → `mode === 'workshop'`,
    seçim ve ad korunmuş.
14. **Diğer yeni aileler:** `[data-action="new-from-template"]` →
    `[data-template="turbofanMixed"]`, `flush()`, uyarı 0, `shot('w6-karisik')`;
    aynısı `[data-template="turboshaft"]` (`shot('w7-turbosaft')`).
15. **Yalıtım:** `Escape` (seçim) + `Escape` (menü); ders 1'i aç (`.lesson-card:nth-child(1)`)
    → `__app.sim.eng.design.name === __design.TEMPLATES.turbofan.name`;
    dersten çık.
16. **Temizlik:** `__design.setSlotGraph('workshop', null)`.

Zamanlama: bölüm bütçesi ≤ 6 dk (swiftshader; aile başına ilk shader
derlemesi dahil). `pageerror` ve konsol hatası başarısızlıktır (mevcut).
`localStorage` her açılışta temizlendiği için koçluk balonları görünür;
bölüm başında `[data-action="coach-skip"]` ile kapatılır.

---

## 9. Riskler ve açık sorular

### 9.1 Riskler

| Risk | Olasılık / etki | Önlem |
|---|---|---|
| K1 sim değişikliği art yakıcılı motorları kaydırır | O / Y | `golden.test.ts`; AB dalının kodu taşınmaz |
| Rastgele tasarımda çözücü ıraksar (NaN, donma) | Y / Y | bulanık test; NaN → `DesignError`; trim adım sınırlı; aralıklar daraltılır |
| Büyük/küçük motor çalışmaz (atalet, marş) | Y / Y | `deriveOperability` + ölçekli çalıştırma testleri (×0,3, ×3); FADEC programları zaten oranlı; hava akışı aralığı testin geçtiği bölgeyle sınırlı |
| Hazır olmayan yerleşimde model `undefined` | O / Y | `LAYOUTS`/`MODEL_BUILDERS` `Record<LayoutStyle,…>` tip denetimli; `READY`; tipli hata |
| Beklenen tasarım hataları konsola düşer | O / O | store yakalar; casus testi; kod incelemesi maddesi |
| TP LPT AN² hedefi (≤ 4,0e7) diğer hedeflerle çelişir | O / O | P2 durur ve sorar (S4); eşik gevşetilmez |
| Karışık akışta tasarım dışı A9mix kısıtı yok | O / D | `mixerPR` uyarısı + Düzelt; rölanti/kısmi güç yakınsama testi; M5b'de kısıt |
| Sıcak dosyalarda birleştirme çakışması | Y / O | P0 bölmesi, hunk sahipliği, sabit sıra |
| Tam üretim takılması ve yeni ailelerin üretim süresi ölçülmemiş | O / O | ayrıntı başına `prev`, `effects:false`, `buildCombustor` reuse, hayalet önizleme; `bench-rebuild --family` |
| `buildEngine` 0,05–0,13 ms ölçümü sıcak JIT | D / O | soğuk ölçüm P4b'de; `feasibleRange` yalnız boşta |
| `barejet.js`/`turboprop.js` sabitleri uç boyutta bozuk | Y / O | P5 ve P2 oranlama; `smoke-families` uç boyut görüntüleri |
| Uç boyutlu motor hücreye/standa sığmaz (CELL_BOUNDS ±12,9 m, `maxDistance` 18) | D / O | hava akışı aralıkları (çap ≤ 4 m, boy ≤ 9 m); `frameDesign` |
| Şablon uydurma ders 1 parça tıklamalarını kaydırır | O / O | P2 kabulünde `ONLY=1,2` |
| Kesit/`rig.go` ile tutamaç etkileşimi çakışır | O / D | `rig.go(name, {cutaway})`; kesitte arka yarı tutamaçları gizli |
| Swiftshader'da yeni aile derlemesi testi uzatır | Y / D | bölüm bütçesi; aileler çalıştırılmadan yalnız kurulur |
| `linerUniforms` modül düzeyinde paylaşılıyor | D / D | M5b A/B'ye not |
| Uyarılar ISA statik tasarım noktasında; uçuşta pervane ucu, yüksek irtifa sönmesi görülmez | O / D (M5a) | M5c deck; `propTipMach` metni uçuş etkisini anlatır; Faz 4 öncesi seyir noktası denetimi M5c |

O: orta, Y: yüksek, D: düşük.

### 9.2 Kullanıcıya sorulması gerekenler

Her biri için **varsayılan** (onay gelmezse uygulanan) yazılı.

- **S1 — Simülasyon değişikliği (karışık akış + turboşaft).** ATOLYE.md
  ve ROADMAP "simülasyon değişikliği gerektirmeyen mimariler" diyor; ölçüm
  yanlış çıktı: karışma yalnız art yakıcı dalında (`sim/design.ts:529`,
  `cycle.ts:342`), gaz jeneratörü yönetimi `kind==='turboprop'`'a bağlı
  (`engineSim.ts:641`). Varsayılan: küçük ve testli değişiklik (`MixerSpec`,
  `ShaftOutputSpec`, `gasGen`); AB'li motorlar altın testle korunur.
  Alternatif: iki mimari M5b'ye kayar.
- **S2 — Lüle ağzı tutamacı (çıplak ve karışık jette).** Lüle alanı bugün
  düğme değil, çevrimin sonucu. Varsayılan: bağlı değişkenle "lüle trimi"
  (çıplakta T4, karışıkta BPR; TP/TS'de tam, ayrık TF'de FPR) ve okumada
  bağın açık anlatımı. Alternatifler: (a) bu mimarilerde kilitli +
  açıklama; (b) M5b'deki "tasarım noktası kayar" (`nozzleAreaFactor`,
  sim değişikliği) M5a'ya çekilir.
- **S3 — `EngineKind`'a `'turboshaft'` eklenmesi** ve test hücresi motor
  listesinde 5. hazır motor olarak turboşaft (dinamometreli). Varsayılan:
  evet.
- **S4 — Turboprop şablonunun görünümü.** Fiziğe uydurma gaz jeneratörünü
  belirgin küçültür (yanma odası ~1/3, HPT ~yarı); LPT AN² (5,87e7) da
  eşiğin üstünde, onu düzeltmek pervane devrini/LPT boyunu değiştirebilir.
  Varsayılan: yap, önce/sonra GIF'le göster; LPT hedefi diğerleriyle
  çelişirse dur ve sor.
- **S5 — Uyarı eşikleri literatüre göre sıkı** (AN² 4,2e7 m²·rpm² ≈ 6,5e10
  in²·rpm²; T3 1000 K; T4 1750 K ve kaydırıcı üstü 1900 K, soğutma modeli
  M5c'ye kadar). Varsayılan: bu eşikler; şablonlar eşiğe uydurulur, eşik
  şablona uydurulmaz.
- **S6 — Basit geri al/yinele (30 adım, bellekte)** ROADMAP'te M5b'de;
  Sprocket kıvamındaki keşif için M5a'ya çekilmesi önerilir. Varsayılan: evet.
- **S7 — Görev kartı (3 tasarım görevi + hedef zarf kutusu)** M5a'da mı?
  Yargıçlar "amaçsız kurcalama" riskini işaret etti. Varsayılan: evet, küçük
  (yıldız yok); kesilebilir paket.
- **S8 — Yeni şablonların gerçek motor hedefleri** (§4.3: J57/J79 kuru,
  CFM56-5C4, T700-GE-701C) uygun mu; kütle modeli bandı tutturamazsa
  katsayı değiştirilmeden sapma belgelenir. Varsayılan: evet.
- **S9 — Atölyenin test hücresinde açılması** (hangar M5c; ortam derlemesi
  tekrarlanmaz). Varsayılan: evet.
- **S10 — Aile değiştirme davranışı:** mimari değişince yeni aile açılır,
  eski aile listede kalır (ATOLYE "varyantlar sıfırlanır" ile uyumlu, ama
  eski aile silinmez). Varsayılan: evet.
- **S11 — Dar ekran (≤ 720 px) ve dokunmatik sürükleme** M5a dışı (teknik
  borç). Varsayılan: evet.
