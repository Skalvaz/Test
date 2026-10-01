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
  /** Test hücresi ağzı (çıplak motor) */
  style: 'bellmouth';
  /** Giriş düzleminden ilk rotora mesafe / ilk kademe uç yarıçapı */
  length: number;
  /** Burun konisi boyu / ilk kademe uç yarıçapı */
  noseLength: number;
  /** Ön çerçeve dikmesi sayısı (0: yok) */
  struts: number;
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
}

export interface CombustorModule {
  type: 'combustor';
  style: 'annular';
  tit: number;
  eff: number;
  /** Toplam basınç kaybı (oran) */
  dp: number;
  /** Gömlek halkası referans hızı [m/s] → halka yüksekliği */
  refVelocity: number;
  /** Boy / halka yüksekliği */
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
}

export interface MixerModule {
  type: 'mixer';
  /** Baypas–çekirdek karışma basınç kaybı */
  loss: number;
}

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
  /** convergent: yalnız yakınsak yapraklar, cd: yakınsak-ıraksak */
  style: 'convergent' | 'cd';
  cv: number;
  flaps: number;
}

export type EngineModule =
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
