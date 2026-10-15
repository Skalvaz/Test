/**
 * Yerçekimi ve dolum (GDD §4.5, §4.6).
 *
 * Genel algoritma tip dizileri üzerinde çalışır (`yercekimiUygula`,
 * `dolumYap`): hem çözümleme (`YerTuru`, OyunDurumu üstünde) hem hızlı hazır
 * sayımı (`hazir.ts`, yalnız renk dizileri) AYNI işlevi kullanır; ikisi asla
 * ayrışmaz.
 *
 * Kurallar:
 *  - engel: delik ya da mermer. Mermer düşmez; altındaki parça ayrı bölümdür.
 *  - Doğum yeri ("beslenen" hücre): sütunun tepesinden (y = 0) engelsiz
 *    ulaşılan hücreler. Dolum yalnız buradan yapılır; boşalan beslenen hücre
 *    çapraz kaymayla DOLMAZ (dolumu bekler).
 *  - Değişiklik kalmayana kadar: (1) düz düşme — her sütunda her parça
 *    aşağı sıkışır; (2) çapraz kayma — alttan yukarı, soldan sağa taranan
 *    ilk beslenmeyen boş hücre önce sol-üst, sonra sağ-üst çaprazdaki
 *    damlayı alır (o damla kendi sütununda aşağı düşemiyorsa). Her kaymadan
 *    sonra yeniden (1).
 */
import { DOGUM_SIRASI } from './sabitler';
import { agirlikliSec } from './rng';
import type { Damla, Konum, Olay, OyunDurumu } from './types';

/** Beslenen hücreler: sütunun tepesinden engelsiz ulaşılanlar (1). */
export function dogumYerleri(w: number, h: number, engel: Uint8Array): Uint8Array {
  const b = new Uint8Array(w * h);
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++) {
      const i = y * w + x;
      if (engel[i]) break;
      b[i] = 1;
    }
  return b;
}

/**
 * Dolumsuz yerçekimi (düz düşme + çapraz kayma). `dolu` yerinde
 * güncellenir; `tasi(den, e)` içeriği taşır. Bir şey kıpırdadıysa true.
 */
export function yercekimiUygula(
  w: number,
  h: number,
  engel: Uint8Array,
  dolu: Uint8Array,
  besli: Uint8Array,
  tasi: (den: number, e: number) => void,
): boolean {
  let degisti = false;
  for (;;) {
    // (1) Düz düşme: her parçada damlalar en alttaki boş hücrelere iner.
    for (let x = 0; x < w; x++) {
      let bos = -1;
      for (let y = h - 1; y >= 0; y--) {
        const i = y * w + x;
        if (engel[i]) {
          bos = -1;
          continue;
        }
        if (!dolu[i]) {
          if (bos < 0) bos = y;
          continue;
        }
        if (bos >= 0) {
          const e = bos * w + x;
          tasi(i, e);
          dolu[e] = 1;
          dolu[i] = 0;
          degisti = true;
          bos--;
        }
      }
    }
    // (2) Çapraz kayma: tek kayma, sonra yeniden düz düşme.
    let kaydi = false;
    tara: for (let y = h - 1; y >= 1; y--)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (engel[i] || dolu[i] || besli[i]) continue;
        for (let s = -1; s <= 1; s += 2) {
          const xx = x + s;
          if (xx < 0 || xx >= w) continue;
          const j = i - w + s;
          if (engel[j] || !dolu[j]) continue;
          const alt = j + w;
          if (!engel[alt] && !dolu[alt]) continue; // kendi sütununda düşebilir
          tasi(j, i);
          dolu[i] = 1;
          dolu[j] = 0;
          degisti = kaydi = true;
          break tara;
        }
      }
    if (!kaydi) return degisti;
  }
}

/**
 * Dolum turu (§4.5): (doğum → yerçekimi) beslenen boş yuva kalmayana kadar.
 * Doğum sırası soldan sağa sütun, her sütunda aşağıdan yukarı yuva.
 * `dog(i, x)` hücreye damla yazar. Doğan sayısını döndürür.
 */
export function dolumYap(
  w: number,
  h: number,
  engel: Uint8Array,
  dolu: Uint8Array,
  besli: Uint8Array,
  dog: (i: number, x: number) => void,
  tasi: (den: number, e: number) => void,
): number {
  let toplam = 0;
  for (let tur = 0; tur < w * h; tur++) {
    let dogdu = 0;
    for (let x = 0; x < w; x++) {
      // Sıkışmış parçada beslenen boşluklar tepededir: y = 0..k−1.
      let k = 0;
      while (k < h) {
        const i = k * w + x;
        if (!besli[i] || dolu[i]) break;
        k++;
      }
      for (let y = k - 1; y >= 0; y--) {
        const i = y * w + x;
        dog(i, x);
        dolu[i] = 1;
        dogdu++;
      }
    }
    if (!dogdu) break;
    toplam += dogdu;
    yercekimiUygula(w, h, engel, dolu, besli, tasi);
  }
  return toplam;
}

/** Durumdan engel/dolu/besli dizileri. */
export function tahtaDizileri(d: Pick<OyunDurumu, 'w' | 'h' | 'hucreler'>): { engel: Uint8Array; dolu: Uint8Array; besli: Uint8Array } {
  const n = d.w * d.h;
  const engel = new Uint8Array(n);
  const dolu = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = d.hucreler[i];
    if (c.delik || c.icerik?.tur === 'mermer') engel[i] = 1;
    else if (c.icerik) dolu[i] = 1;
  }
  return { engel, dolu, besli: dogumYerleri(d.w, d.h, engel) };
}

/**
 * Çözümleme döngüsünün bir yerçekimi turu (§4.2 a–b): dolumsuz düşme ve
 * (gerekirse) dolum. Turun düşenleri ve doğanları tek `yercekimi` olayında
 * yazılır: düşen her damlanın turdaki ilk ve son konumu; doğanların son
 * konumu, tam damlası (garanti rengi dahil) ve sanalY'si.
 */
export class YerTuru {
  /** Damla kimliği → turdaki ilk ve son hücre. */
  readonly hareket = new Map<number, { den: number; e: number }>();
  /** Doğan damla kimliği → son hücre, sanalY, damla (garanti rengini değiştirebilir). */
  readonly dogan = new Map<number, { e: number; sanalY: number; damla: Damla }>();
  private readonly sutunDogan: Int32Array;
  private readonly tasiFn: (den: number, e: number) => void;

  constructor(private readonly d: OyunDurumu) {
    this.sutunDogan = new Int32Array(d.w);
    this.tasiFn = (den, e) => {
      const hs = this.d.hucreler;
      const ic = hs[den].icerik!;
      hs[e].icerik = ic;
      hs[den].icerik = null;
      const id = ic.tur === 'damla' ? ic.damla.id : -1;
      const dg = this.dogan.get(id);
      if (dg) {
        dg.e = e;
        return;
      }
      const m = this.hareket.get(id);
      if (m) m.e = e;
      else this.hareket.set(id, { den, e });
    };
  }

  /** Dolumsuz yerçekimi (§4.5). */
  dus(): boolean {
    const { engel, dolu, besli } = tahtaDizileri(this.d);
    return yercekimiUygula(this.d.w, this.d.h, engel, dolu, besli, this.tasiFn);
  }

  /** Dolum (§4.6): doğum ağırlıklarıyla, `d.rng` akışından. */
  doldur(): number {
    const d = this.d;
    const { engel, dolu, besli } = tahtaDizileri(d);
    return dolumYap(
      d.w,
      d.h,
      engel,
      dolu,
      besli,
      (i, x) => {
        const renk = DOGUM_SIRASI[agirlikliSec(d, d.dogumAgirliklari)];
        const damla: Damla = { id: d.sonrakiId++, renk, ozel: 'yok', yon: 'yatay' };
        d.hucreler[i].icerik = { tur: 'damla', damla };
        this.dogan.set(damla.id, { e: i, sanalY: -++this.sutunDogan[x], damla });
      },
      this.tasiFn,
    );
  }

  bos(): boolean {
    return this.hareket.size === 0 && this.dogan.size === 0;
  }

  /** Turun `yercekimi` olayı (boşsa null). Doğanların damlası kopyalanır. */
  olay(t: number): Olay | null {
    if (this.bos()) return null;
    const w = this.d.w;
    const K = (i: number): Konum => ({ x: i % w, y: (i - (i % w)) / w });
    const dusenler: { den: Konum; e: Konum }[] = [];
    for (const m of this.hareket.values()) if (m.den !== m.e) dusenler.push({ den: K(m.den), e: K(m.e) });
    const doganlar: { hucre: Konum; damla: Damla; sanalY: number }[] = [];
    for (const g of this.dogan.values()) doganlar.push({ hucre: K(g.e), damla: { ...g.damla }, sanalY: g.sanalY });
    if (dusenler.length === 0 && doganlar.length === 0) return null;
    return { t, tur: 'yercekimi', dusenler, doganlar };
  }
}
