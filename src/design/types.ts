/**
 * Modüler motor tanımı (M4): motor, akış yönünde sıralı modüllerden oluşur.
 *
 *   Giriş → Fan/LPC → HPC → Yanma odası → HPT → LPT → [Karıştırıcı]
 *         → [Art yakıcı] → Lüle
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
  /**
   * bellmouth: test hücresi ağzı (çıplak motor), chin: turboprobun dişli
   * kutusu altındaki çene girişi ve S-kanal, nacelle: kaportalı turbofanın
   * pitot girişi
   */
  style: 'bellmouth' | 'chin' | 'nacelle';
  /** Giriş düzleminden ilk rotora mesafe / ilk kademe uç yarıçapı */
  length: number;
  /** Burun konisi boyu / ilk kademe uç yarıçapı */
  noseLength: number;
  /** Ön çerçeve dikmesi sayısı (0: yok) */
  struts: number;
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
  /** Fan/LPC: kanat + disk tek parça (blisk) */
  blisk?: boolean;
  firstMaterial?: string;
  firstChord?: number;
  /** HPC: son kademe santrifüj (eksenel kademeler kalan işi yapar) */
  centrifugal?: CentrifugalStage;
}

export interface CombustorModule {
  type: 'combustor';
  /**
   * annular: tek halka gömlek (modern motorlar); can: ayrı ayrı kutu
   * gömlekler, aralarında ateşleme geçiş boruları (eski turbojetler, sanayi
   * gaz türbinleri — daha ağır, basınç kaybı daha yüksek, bakımı kolay)
   */
  style: 'annular' | 'can';
  /** Kutu sayısı (can) */
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
  /**
   * convergent: değişken yakınsak yapraklar, cd: yakınsak-ıraksak,
   * stub: turboprobun kısa egzoz borusu (artık itki), separate: ayrık akışlı
   * turbofanın baypas + çekirdek lüleleri
   */
  style: 'convergent' | 'cd' | 'stub' | 'separate';
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
  | InletModule
  | CompressorModule
  | CombustorModule
  | TurbineModule
  | MixerModule
  | AfterburnerModule
  | NozzleModule;

/**
 * Modül grafiği. M4a'da gaz yolu doğrusal bir zincir; baypas fan
 * modülünün bypassRatio'sundan, karışma mixer modülünden gelir.
 */
export interface EngineGraph {
  kind: EngineKind;
  name: string;
  summary: string;
  /** Fan yüzü toplam kütle akışı (kalkış, deniz seviyesi) [kg/s] */
  massFlow: number;
  modules: EngineModule[];
  /** Mekanik verim ve aksesuar gücü (HP milinden) */
  mechEff: number;
  accessoryPower: number;
  /** Baypas kanalı: basınç kaybı ve eksenel Mach (kanal genişliği) */
  bypassDuct?: { dp: number; mach: number };
  /** Motor düzeyinde (henüz modüllerden türetilmeyen) alanlar */
  inertia: { lp: number; hp: number };
  hpcMap: CompressorMapShape;
  limits: EngineLimits;
  start: StartSystem;
}
