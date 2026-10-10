/**
 * Modüler motor tanımı (M4): motor, akış yönünde sıralı modüllerden oluşur.
 *
 *   [Pervane | Çıkış mili] → Giriş → Fan/LPC → HPC → Yanma odası → HPT
 *         → LPT → [Karıştırıcı] → [Art yakıcı] → Lüle
 *
 * Her modül iki tür düğme taşır:
 *  - Termodinamik: basınç oranı, verim, T4, basınç kaybı… → EngineDesign
 *  - Geometri: eksenel Mach, göbek/uç oranı, kademe yüklemesi, uç hızı… →
 *    kanal yarıçapları, kademe ve kanat sayıları, eksenel konumlar.
 * Geometri doğrudan girilmez; tasarım noktası istasyonlarından fizikle
 * hesaplanır (flowpath.ts). Böylece kütle akışını büyüten oyuncu kanalı da
 * büyütmüş olur; uç hızını aşan oyuncu "kanat ucu Mach" uyarısı alır.
 *
 * Bu dosya render'dan bağımsızdır (three.js yok) ve testlidir.
 */

import type { CompressorMapShape, EngineKind, EngineLimits, StartSystem } from '../sim/design';

export type Spool = 'lp' | 'hp';

/**
 * annular: tek halka gömlek (modern motorlar); can: ayrı ayrı kutu
 * gömlekler, her biri kendi basınç kabında (eski turbojetler, sanayi gaz
 * türbinleri — daha ağır, basınç kaybı yüksek, bakımı kolay); canAnnular:
 * kutu gömlekler ortak bir halka kasanın içinde (J57, JT8D, J79)
 */
export type CombustorStyle = 'annular' | 'can' | 'canAnnular';
/**
 * fixed: art yakıcısız motorun sabit yakınsak lülesi; convergent / cd: art
 * yakıcılı motorun değişken yakınsak / yakınsak-ıraksak lülesi; stub:
 * serbest türbinli motorun kısa egzoz borusu (artık itki); separate: ayrık
 * akışlı turbofanın baypas + çekirdek lüleleri
 */
export type NozzleStyle = 'fixed' | 'convergent' | 'cd' | 'stub' | 'separate';
/**
 * bellmouth: test hücresi ağzı (çıplak motor), chin: turboprobun dişli
 * kutusu altındaki çene girişi ve S-kanal, nacelle: kaportalı turbofanın
 * pitot girişi, annular: turboşaftın önden çıkışlı milinin çevresindeki
 * halka giriş
 */
export type InletStyle = 'bellmouth' | 'chin' | 'nacelle' | 'annular';

/** Kompresör ve türbinlerin ortak kanal düğmeleri */
export interface AnnulusKnobs {
  /** Giriş ve çıkışta eksenel Mach sayısı (toplam koşullarla akış fonksiyonu) */
  mach: [number, number];
  /** Girişte göbek/uç yarıçap oranı */
  hubTip: number;
  /** Çıkış uç yarıçapı / giriş uç yarıçapı (1: sabit uç, <1: daralan) */
  taper: number;
  /**
   * Kademe yüklemesi ψ = Δh / U²ort (kademe başına). Kompresörde ~0,25–0,5,
   * türbinde ~1–2,2. Kademe sayısı bundan çıkar.
   */
  loading: number;
  /** Kademe aralığı / ortalama kanat yüksekliği (eksenel sıkılık) */
  pitchSpan: number;
  /**
   * Kanat sayısı katsayısı (katılık × en-boy oranı) ilk ve son kademede:
   * sayı = 2π·r_ort·k / kanat yüksekliği
   */
  bladeK: [number, number];
}

export interface InletModule {
  type: 'inlet';
  style: InletStyle;
  /** Giriş düzleminden ilk rotora mesafe / ilk kademe uç yarıçapı */
  length: number;
  /** Burun konisi boyu / ilk kademe uç yarıçapı */
  noseLength: number;
  /** Ön çerçeve dikmesi sayısı (0: yok) */
  struts: number;
  /** annular (turboşaft): entegre parçacık ayırıcı. M5a: yalnız görsel. */
  separator?: boolean;
}

/** Pervane ve redüksiyon dişli kutusu (turboprop). LP mili = güç türbini. */
export interface PropellerModule {
  type: 'propeller';
  diameter: number;
  blades: number;
  /** %100 güç türbini devrinde pervane devri [rpm]; dişli oranı bundan */
  rpm: number;
  figureOfMerit: number;
  efficiency: number;
  /** Pervane düzleminden gaz jeneratörü HPC girişine eksenel mesafe [m] */
  gearboxLength: number;
}

/** Serbest güç türbininin çıkış mili (turboşaft). Akış dışı modül. */
export interface ShaftModule {
  type: 'shaft';
  /** %100 NP'de çıkış devri [rpm] */
  rpm: number;
  /** M5a: yalnız 'front' (kural) */
  drive: 'front' | 'rear';
  /** |ω_pt/ω_çıkış − 1| > 0,05 ise zorunlu (flowpath denetler) */
  reduction: boolean;
  /** Aktarma verimi (0,97–0,995) */
  transmissionEff: number;
  /** Çıkış flanşından halka giriş ağzına (mil gövdesi boyu) [m]; HPC ayrıca inlet.length·uç arkada */
  gearboxLength: number;
}

/** HPC'nin son kademesi santrifüj (turboprop gaz jeneratörleri) */
export interface CentrifugalStage {
  /** Toplam HPC işinin santrifüj çarkta yapılan oranı */
  workFraction: number;
  /** Çark yüklemesi Δh / U²uç (kayma × güç katsayısı, ~0,6–0,8) */
  loading: number;
  /** Difüzör çıkış yarıçapı / çark uç yarıçapı */
  diffuserRatio: number;
  /** Eksenel son rotordan çark eksenine aralık / eksenel kademe aralığı */
  gap: number;
}

export interface CompressorModule extends AnnulusKnobs {
  type: 'fan' | 'lpc' | 'hpc';
  spool: Spool;
  pr: number;
  eff: number;
  /** Fan: baypas oranı (0: baypassız) */
  bypassRatio?: number;
  /** Fan: göbek tarafı basınç artışı / uç tarafı */
  hubPRFraction?: number;
  /**
   * Milin ilk (en büyük) kompresörü uç hızını belirler [m/s]; mil devri
   * buradan çıkar. Aynı mildeki sonraki modüllerde verilmez.
   */
  tipSpeed?: number;
  /** Önceki modülün son rotorundan bu modülün ilk rotoruna aralık / ortalama kademe aralığı */
  gap?: number;
  /** Değişken stator sırası sayısı (dış donanımda VSV halkaları) */
  vsv?: number;
  /**
   * Fan/LPC: kanat + disk tek parça (blisk).
   * @deprecated Okunmuyor (gaspath.js sabit kodlu); M5a düğme kataloğunda yok.
   */
  blisk?: boolean;
  firstMaterial?: string;
  firstChord?: number;
  /** HPC: son kademe santrifüj (eksenel kademeler kalan işi yapar) */
  centrifugal?: CentrifugalStage;
}

export interface CombustorModule {
  type: 'combustor';
  /** Gömlek düzeni (kutular arasında ateşleme geçiş boruları) */
  style: CombustorStyle;
  /** Kutu sayısı (can, canAnnular: 6–16, kural) */
  cans?: number;
  tit: number;
  eff: number;
  /** Toplam basınç kaybı (oran) */
  dp: number;
  /** Gömlek halkası (ya da kutuların toplam) referans hızı [m/s] → kesit alanı */
  refVelocity: number;
  /** Boy / halka yüksekliği (kutuda: boy / kutu çapı) */
  lengthHeight: number;
  /** Halka ortalama yarıçapı: HPC çıkışı ile HPT girişi ortalamasına göre fark [m] */
  meanShift: number;
  /** HPC son rotorundan gömlek başına aralık / HPC kademe aralığı */
  gap: number;
  injectors: number;
}

export interface TurbineModule extends AnnulusKnobs {
  type: 'hpt' | 'lpt';
  spool: Spool;
  eff: number;
  /** Önceki modülün sonundan ilk rotora aralık / bu modülün kademe aralığı */
  gap: number;
  /**
   * Serbest güç türbini: milinde kompresör yoksa devri bu uç hızından
   * çıkar [m/s] (turboprobun LP mili pervaneyi dişliyle çevirir)
   */
  tipSpeed?: number;
}

export interface MixerModule {
  type: 'mixer';
  /** Baypas–çekirdek karışma basınç kaybı */
  loss: number;
  /**
   * confluent: düz halka (iki akış yan yana girer, uzun jet borusunda
   * kısmen karışır; karışma verimi ~0,85); lobed: çiçek biçimli lobe'lar
   * akışları iç içe geçirir (~0,97) ama ek sürtünme kaybı getirir
   */
  style?: 'confluent' | 'lobed';
  /** Lobe sayısı (lobed) */
  lobes?: number;
}

/** Karıştırıcı tipine göre karışma verimi */
export const MIXING_EFF = { confluent: 0.85, lobed: 0.97 } as const;

export interface AfterburnerModule {
  type: 'afterburner';
  t7Max: number;
  eta: number;
  dpDry: number;
  dpLit: number;
  /** Jet borusu eksenel Mach'ı (kuru) → gömlek yarıçapı */
  mach: number;
  /** Boy / gömlek çapı */
  lengthDiameter: number;
}

export interface NozzleModule {
  type: 'nozzle';
  style: NozzleStyle;
  cv: number;
  /** Değişken lülede yaprak sayısı */
  flaps?: number;
  /** stub: tasarım noktasında egzoz basınç oranı (P5/P0) */
  pressureRatio?: number;
  /** stub: egzoz borusu ağzında eksenel Mach → ağız yarıçapı */
  exitMach?: number;
  /**
   * separate: lüle arka kenarlarında testere dişli çevrikler (chevron)
   * sayısı, 0 = düz kenar. Jet gürültüsünü azaltır (karışma katmanını
   * hızlandırır), lüle başına itki katsayısını ~%0,25 düşürür.
   */
  chevrons?: { core?: number; bypass?: number };
}

/** Chevron'lu lüle başına itki katsayısı kaybı */
export const CHEVRON_CV_LOSS = 0.0025;

export type EngineModule =
  | PropellerModule
  | ShaftModule
  | InletModule
  | CompressorModule
  | CombustorModule
  | TurbineModule
  | MixerModule
  | AfterburnerModule
  | NozzleModule;

export type ModuleType = EngineModule['type'];

/** Akış yönünde modül sırası (aynı tipten birden çok modül olamaz); graph.ts ORDER */
export const MODULE_ORDER: readonly ModuleType[] = [
  'propeller',
  'shaft',
  'inlet',
  'fan',
  'lpc',
  'hpc',
  'combustor',
  'hpt',
  'lpt',
  'mixer',
  'afterburner',
  'nozzle',
];

/** Geometriden henüz türetilmeyen çalışabilirlik alanları */
export interface Operability {
  /** Mil atalet momentleri [kg·m²] */
  inertia: { lp: number; hp: number };
  hpcMap: CompressorMapShape;
  limits: EngineLimits;
  start: StartSystem;
  /**
   * Aksesuar gücü uzman düzeltmesi [W] (`engine.accessoryPower` düğmesi
   * buraya yazar). Verilmezse referanslı grafikte çekirdek akışıyla
   * ölçeklenir, referanssızda `EngineGraph.accessoryPower` (operability.ts
   * resolveAccessoryPower). Boyutlandırmadan ÖNCE çözülür: HPT işine girer.
   */
  accessoryPower?: number;
}

/**
 * Modül grafiği. Gaz yolu doğrusal bir zincir; baypas fan modülünün
 * bypassRatio'sundan, karışma mixer modülünden gelir.
 */
export interface EngineGraph {
  /**
   * ARTIK TÜRETİLMİŞ (traits.ts presentationKind): şablonlarda etiket olarak
   * kalır, buildEngine okumaz. Belgeye yazılmaz.
   */
  kind?: EngineKind;
  name: string;
  summary: string;
  /** Fan yüzü toplam kütle akışı (kalkış, deniz seviyesi) [kg/s] */
  massFlow: number;
  modules: EngineModule[];
  /**
   * Mekanik verim ve aksesuar gücü (HP milinden). accessoryPower taban
   * değerdir (şablon/bağışçı); atölyede aile şablonundan ölçeklenen değer
   * ya da `ops.accessoryPower` düzeltmesi önce gelir.
   */
  mechEff: number;
  accessoryPower: number;
  /** Baypas kanalı: basınç kaybı ve eksenel Mach (kanal genişliği) */
  bypassDuct?: { dp: number; mach: number };
  /**
   * Çalışabilirlik (atalet, kompresör haritası, limitler, marş). Şablonlarda
   * tam verilir (bugünkü değerler, davranış aynı); atölye grafiklerinde yok
   * ya da kısmi: operability.ts aile şablonundan ölçekler. Verilen alanlar
   * alan alan üstüne yazar.
   */
  ops?: Partial<Operability>;
}
