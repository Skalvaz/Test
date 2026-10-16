/**
 * Mühür ölçümü (docs/KANCALAR.md §A.5, §A.7, KA5): bot oyunlarında eylem
 * izi (`HamleIzi`) toplar, mühür koşullarını KAZANILAN oyunlarda
 * değerlendirir, zorluk bandına göre denetler ve eşik önerir. Saf (Node,
 * vitest); `sim-cli --muhur` işçileri ve `--dogrula` uyarısı kullanır.
 *
 * Bantlar (KA5), oranlar o botun kazançları içinde:
 *   Çırak  Acemi ≥ %40 (Acemi kazancı < 20 ise yedek: Usta ≥ %85)
 *   Kalfa  Usta %30–60
 *   Usta   Usta %8–25
 * Kısıt mühürü (`enCok`, ör. "Körük kullanmadan kazan"): bot kısıtı bilmeden
 * ölçülemez (Usta Körük'ü dolar dolmaz kullanır). Kısıtı uygulayan botla
 * aynı tohumlar oynanır; oran = kısıtlı botun koşulu tutan kazançları /
 * normal botun kazançları.
 *
 * Ölçüm koşulun DEĞERİ üzerinden yapılır (`muhurDegeri` eşikten
 * bağımsızdır): aynı oyunlarla her eşiğin oranı hesaplanır (eşik önerisi).
 */
import type { BolumVerisi, MuhurKosulu } from '../core/index';
import { muhurDegeri, muhurMetni, MUHUR_KADEMELERI, OLCU_KAPSAMLARI, type MuhurKademe, type MuhurOzeti } from '../meta/muhur';
import { ozetBaslat, ozetHamle, type HamleIzi, type OyunOzeti } from '../meta/ozet';
import type { BotTuru } from './ortak';
import { oyunOyna, type OyunKisiti, type OyunSecenek, type OyunSonucu } from './simulasyon';

// ───────────────────────────── Oyun ─────────────────────────────

/** Bir bot oyununun mühür girdisi. */
export interface MuhurOyunu {
  tohum: number;
  kazandi: boolean;
  /** Kazanç anında (final öncesi) kalan hamle; kayıpta 0. */
  kalanHamle: number;
  /** Eylem izleri (final hariç). */
  izler: HamleIzi[];
}

/**
 * Bir oyunu oynatır ve uygulamanın yaptığı gibi her eylemde `ozetHamle`
 * (eylem öncesi durumla) çağırır.
 */
export function muhurluOyun(v: BolumVerisi, tohum: number, bot: BotTuru, s: OyunSecenek = {}): { sonuc: OyunSonucu; oyun: MuhurOyunu } {
  let oz: OyunOzeti = ozetBaslat();
  let kalan = 0;
  const sonuc = oyunOyna(v, tohum, bot, {
    ...s,
    kayit: (k) => {
      oz = ozetHamle(oz, k.olaylar, { hamle: k.hamle, onceki: k.d });
      kalan = k.sonraki.kalanHamle;
      s.kayit?.(k);
    },
  });
  return { sonuc, oyun: { tohum, kazandi: sonuc.kazandi, kalanHamle: sonuc.kazandi ? kalan : 0, izler: oz.hamleIzleri } };
}

/** Değerlendirici girdisi (bot güçlendirici ve Usta'nın Eli kullanmaz). */
export function oyunMuhurOzeti(o: MuhurOyunu): MuhurOzeti {
  return { hamleIzleri: o.izler, kazandi: o.kazandi, kalanHamle: o.kalanHamle, ustaEli: false, guclendirici: 0 };
}

/** Bir oyunun koşul değerleri (koşul sırasıyla) ve kazanç bayrağı. */
export interface DegerliOyun {
  kazandi: boolean;
  degerler: readonly number[];
}

export function oyunDegerleri(kosullar: readonly MuhurKosulu[], o: MuhurOyunu): DegerliOyun {
  const mo = oyunMuhurOzeti(o);
  return { kazandi: o.kazandi, degerler: kosullar.map((k) => muhurDegeri(k, mo)) };
}

/** Değer koşulu sağlıyor mu (`muhurKosuluSaglandi` ile aynı kural, değerden). */
export function kosulTutar(k: Pick<MuhurKosulu, 'enAz' | 'enCok'>, deger: number): boolean {
  if (k.enAz !== undefined && deger < k.enAz) return false;
  if (k.enCok !== undefined && deger > k.enCok) return false;
  return true;
}

/** Kısıt mühürünün bot kısıtı (Körük, kısa zincir); ölçülemeyen kısıtta null. */
export function kosulKisiti(k: MuhurKosulu): OyunKisiti | null {
  if (k.enCok === undefined) return null;
  if (k.olcu === 'koruk') return { koruk: k.enCok };
  if (k.olcu === 'kisaZincir') return { kisaZincir: k.enCok };
  return null;
}

// ───────────────────────────── Bantlar ─────────────────────────────

export interface MuhurBandi {
  bot: BotTuru;
  min: number;
  max: number;
  /** Eşik önerisinde hedeflenen oran (%). */
  hedef: number;
}

export const MUHUR_BANTLARI: Readonly<Record<MuhurKademe, MuhurBandi>> = {
  cirak: { bot: 'acemi', min: 40, max: 100, hedef: 50 },
  kalfa: { bot: 'usta', min: 30, max: 60, hedef: 45 },
  usta: { bot: 'usta', min: 8, max: 25, hedef: 16 },
};
/** KA5 yedeği: Acemi kazancı bundan azsa Çırak Usta kazançlarıyla ölçülür. */
export const CIRAK_YEDEK_KAZANC = 20;
export const CIRAK_YEDEK_BANDI: MuhurBandi = { bot: 'usta', min: 85, max: 100, hedef: 90 };
/** `dogrula` uyarısı: bant dışında bu kadar puandan fazla sapma. */
export const MUHUR_BANT_PAYI = 5;

/** Kademenin bandı; Çırak'ta Acemi ölçülmediyse ya da kazancı azsa Usta yedeği. */
export function kademeBandi(kademe: MuhurKademe, acemiKazanc: number | null): { bant: MuhurBandi; yedek: boolean } {
  const yedek = kademe === 'cirak' && (acemiKazanc === null || acemiKazanc < CIRAK_YEDEK_KAZANC);
  return { bant: yedek ? CIRAK_YEDEK_BANDI : MUHUR_BANTLARI[kademe], yedek };
}

export type BantDurumu = 'bantta' | 'payda' | 'disinda' | 'olculemedi';

export function bantDurumu(oran: number | null, b: MuhurBandi, pay = MUHUR_BANT_PAYI): BantDurumu {
  if (oran === null) return 'olculemedi';
  if (oran >= b.min && oran <= b.max) return 'bantta';
  if (oran >= b.min - pay && oran <= b.max + pay) return 'payda';
  return 'disinda';
}

// ───────────────────────────── Ölçüm ─────────────────────────────

export interface BotOrani {
  oyun: number;
  kazanc: number;
  /** Koşulu tutan kazanç. */
  tutan: number;
  /** tutan / kazanç (%); kazanç yoksa null. */
  oran: number | null;
}

/** i. koşulun oranı (oyunların `degerler[i]`'si). */
export function botOrani(k: MuhurKosulu, i: number, oyunlar: readonly DegerliOyun[]): BotOrani {
  let kazanc = 0;
  let tutan = 0;
  for (const o of oyunlar) {
    if (!o.kazandi) continue;
    kazanc++;
    if (kosulTutar(k, o.degerler[i])) tutan++;
  }
  return { oyun: oyunlar.length, kazanc, tutan, oran: kazanc ? (100 * tutan) / kazanc : null };
}

export interface MuhurOlcumu {
  kademe: MuhurKademe;
  kosul: MuhurKosulu;
  metin: string;
  /** Doğal oranlar (normal bot, kendi kazançları içinde). */
  usta: BotOrani;
  acemi: BotOrani | null;
  /** Kısıt mühürü: kısıtlı botun tutan kazancı / normal botun kazancı (%). */
  kisitli: { usta: BotOrani | null; acemi: BotOrani | null } | null;
  /** Bant ölçütü: hangi bot ve bant, ölçülen oran, durum. */
  bant: MuhurBandi;
  yedek: boolean;
  oran: number | null;
  durum: BantDurumu;
}

export interface MuhurOlcumGirdisi {
  usta: readonly DegerliOyun[];
  acemi?: readonly DegerliOyun[];
  /**
   * Kısıt mühürleri için kısıtlı bot oyunları (kademe sırasıyla). Kısıt
   * mühüründe verilmezse ölçülemez (doğal oran yalnız bilgi).
   */
  kisitli?: readonly ({ usta?: readonly DegerliOyun[]; acemi?: readonly DegerliOyun[] } | undefined)[];
}

/** Bölümün mühürlerinin ölçümü (oyunların `degerler`'i `v.muhurler` sırasıyla). */
export function muhurOlc(v: Pick<BolumVerisi, 'muhurler'>, g: MuhurOlcumGirdisi): MuhurOlcumu[] {
  const acemiKazanc = g.acemi ? g.acemi.filter((o) => o.kazandi).length : null;
  return (v.muhurler ?? []).map((k, i) => {
    const kademe = MUHUR_KADEMELERI[i];
    const usta = botOrani(k, i, g.usta);
    const acemi = g.acemi ? botOrani(k, i, g.acemi) : null;
    const { bant, yedek } = kademeBandi(kademe, acemiKazanc);
    let kisitli: MuhurOlcumu['kisitli'] = null;
    let oran: number | null;
    if (k.enCok !== undefined) {
      const ks = g.kisitli?.[i];
      const kOran = (l: readonly DegerliOyun[] | undefined, normal: BotOrani | null): BotOrani | null => {
        if (!l || !normal) return null;
        const b = botOrani(k, i, l);
        return { ...b, kazanc: normal.kazanc, oran: normal.kazanc ? (100 * b.tutan) / normal.kazanc : null };
      };
      kisitli = { usta: kOran(ks?.usta, usta), acemi: kOran(ks?.acemi, acemi) };
      oran = (bant.bot === 'usta' ? kisitli.usta : kisitli.acemi)?.oran ?? null;
    } else oran = (bant.bot === 'usta' ? usta : acemi)?.oran ?? null;
    return { kademe, kosul: k, metin: muhurMetni(k), usta, acemi, kisitli, bant, yedek, oran, durum: bantDurumu(oran, bant) };
  });
}

// ───────────────────────────── Eşik önerisi ─────────────────────────────

export interface EsikOnerisi {
  enAz: number;
  /** Bant botunun oranı (%) ve iki botun oranları. */
  oran: number;
  usta: number | null;
  acemi: number | null;
}

/** enAz = t ile oran (%): değeri ≥ t olan kazanç payı. */
function oranEsikte(degerler: readonly number[], t: number): number | null {
  if (degerler.length === 0) return null;
  let n = 0;
  for (const x of degerler) if (x >= t) n++;
  return (100 * n) / degerler.length;
}

/**
 * `enAz` koşulu için banda giren eşik (kazançlardaki değerlerden): Çırak'ta
 * alt sınıra 5 puan pay bırakan EN ZOR eşik (yoksa banttaki en zor), Kalfa
 * ve Usta'da oranı bant hedefine en yakın eşik. Banda giren eşik yoksa null.
 * `degerU`/`degerA`: kazanılan oyunlardaki koşul değerleri.
 */
export function esikOnerisi(kademe: MuhurKademe, degerU: readonly number[], degerA: readonly number[] | null): EsikOnerisi | null {
  const { bant } = kademeBandi(kademe, degerA ? degerA.length : null);
  const d = bant.bot === 'usta' ? degerU : (degerA ?? []);
  if (d.length === 0) return null;
  const enBuyuk = Math.max(...d);
  let en: EsikOnerisi | null = null;
  let enFark = Infinity;
  for (let t = 1; t <= Math.max(1, enBuyuk); t++) {
    const r = oranEsikte(d, t)!;
    if (r < bant.min || r > bant.max) continue;
    const fark = kademe === 'cirak' ? (r >= bant.min + MUHUR_BANT_PAYI ? -t : 1000 - t) : Math.abs(r - bant.hedef);
    if (fark < enFark) {
      enFark = fark;
      en = { enAz: t, oran: r, usta: oranEsikte(degerU, t), acemi: degerA ? oranEsikte(degerA, t) : null };
    }
  }
  return en;
}

/** Kazanılan oyunlarda koşulun değerleri (eşik önerisi girdisi). */
export function kazancDegerleri(k: MuhurKosulu, oyunlar: readonly MuhurOyunu[]): number[] {
  return oyunlar.filter((o) => o.kazandi).map((o) => muhurDegeri(k, oyunMuhurOzeti(o)));
}

// ───────────────────────────── Aday kataloğu ─────────────────────────────

export type AdayKosul = Omit<MuhurKosulu, 'enAz' | 'enCok'>;

/**
 * Bölümün öğelerine göre anlamlı aday koşullar (eşiksiz; `enAz` öneriyle
 * dolar). Kalibrasyonda "bu bölüme hangi mühürler uyar" tablosu için.
 */
export function adayKatalogu(v: BolumVerisi): AdayKosul[] {
  const simge = new Set(v.duzen.flatMap((r) => r.trim().split(/\s+/)).map((s) => s.replace(/\d+$/, '')));
  const l: AdayKosul[] = [
    { olcu: 'R', kapsam: 'hamle' },
    { olcu: 'R', kapsam: 'hamle', halka: true },
    { olcu: 'nesil', kapsam: 'hamle' },
    { olcu: 'zincir', kapsam: 'hamle' },
    { olcu: 'halka', kapsam: 'oyun' },
    { olcu: 'isiPatlamasi', kapsam: 'oyun' },
    { olcu: 'ozelAtes', kapsam: 'oyun' },
    { olcu: 'ozelAtes', kapsam: 'hamle' },
    { olcu: 'kombo', kapsam: 'oyun' },
    { olcu: 'kalanHamle', kapsam: 'son' },
  ];
  const [r, kp, y] = v.ozelEsikleri;
  if (r) l.push({ olcu: 'olusum', kapsam: 'oyun', ozel: 'roket' }, { olcu: 'caprazRoket', kapsam: 'oyun' });
  if (kp) l.push({ olcu: 'olusum', kapsam: 'oyun', ozel: 'kasimpati' }, { olcu: 'ozelAtes', kapsam: 'oyun', ozel: 'kasimpati' });
  if (y) l.push({ olcu: 'olusum', kapsam: 'oyun', ozel: 'yildiz' });
  for (const h of v.hedefler) if (h.tur === 'topla' && h.renk !== 'hepsi') l.push({ olcu: 'patlama', kapsam: 'hamle', renk: h.renk });
  if ((v.korukKapasitesi ?? 0) > 0) l.push({ olcu: 'koruk', kapsam: 'oyun' }, { olcu: 'R', kapsam: 'hamle', eylem: 'koruk' });
  const ikisi = (o: MuhurKosulu['olcu']): void => {
    l.push({ olcu: o, kapsam: 'oyun' }, { olcu: o, kapsam: 'hamle' });
  };
  if (simge.has('C')) ikisi('kafes');
  if (simge.has('K')) ikisi('kaya');
  if (simge.has('K') || simge.has('S')) ikisi('engelHasar');
  if (['C', 'K', 'S', 'I', 'D'].some((s) => simge.has(s))) l.push({ olcu: 'caprazEngel', kapsam: 'oyun' });
  if (simge.has('W')) ikisi('kurutma');
  if (simge.has('I')) ikisi('is');
  if (simge.has('F') || (v.fenerDogum?.kalan ?? 0) > 0) ikisi('fener');
  if (simge.has('D')) ikisi('devFisek');
  if (simge.has('D') && v.zemin?.barutIzleri?.length) l.push({ olcu: 'izliDevFisek', kapsam: 'oyun' });
  if (v.zemin?.dosemeler?.length) ikisi('doseme');
  if (v.zemin?.desen?.hucreler.length) ikisi('desen');
  return l.filter((k) => OLCU_KAPSAMLARI[k.olcu].includes(k.kapsam));
}
