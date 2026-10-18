/**
 * EBRULİ oyun sahnesi çizicisi (P3). `OyunCizici` sözleşmesini (src/app/
 * sozlesme.ts) tek bir <canvas> üzerinde uygular.
 *
 * Katmanlar (GDD §13.5):
 *   1 su (offscreen arka plan + kayan dalga dokusu + sudaki canlı iz)
 *   2 ceviz tekne çerçevesi (offscreen)
 *   3 tekne içi (kırpılmış): zemin (kâğıt/yağ/desen/delik, offscreen), ızgara
 *     noktaları, damla haleleri, damlalar ve özel taşlar, mermer, önizleme,
 *     efektler, parçacıklar
 *   ekran üstü: öğretici el, imleç, kutlama yazısı, kararma, kâğıt çekme,
 *   HUD'a uçan damlalar, flaş
 *
 * Olay oynatıcı: `oynat()` olayları tik zamanında sıralı işler (tik → ms:
 * hız × hızlandırma; birleşimden sonra 150 ms %40). Her olay görsel tahtayı
 * günceller, efekt/parçacık/sarsıntı üretir ve `olayDinle` dinleyicilerini
 * çağırır. Toplanan damlanın `hedefIlerledi` bildirimi damla hedef kartına
 * vardığında yapılır (HUD sayacı o anda zıplasın). Oynatma bitince görsel
 * tahta `sonraki` ile karşılaştırılır (geliştirme kipinde fark varsa
 * console.error) ve eşitlenir.
 */
import type { CiziciSecenek, Dikdortgen, OyunCizici, TahtaGeometrisi } from '../app/sozlesme';
import type { BolumVerisi, Hamle, Hedef, KomboTuru, Konum, Olay, Onizleme, OyunDurumu, Renk } from '../core/types';
import { ATOLYELER, PALET } from '../app/katalog';
import { Rng } from '../platform/rng';
import type { Stage } from './stage';
import { bantKalinligi, CerceveKatmani } from './cerceve';
import { E, Efektler, type EfektCizimBaglami } from './efektler';
import { damlaAlfasi, damlaOlcegi, GorselTahta, KARISIM_MS, TITRE_MS, type GDamla } from './gorselTahta';
import { inOutCubic, outBack, outCubic, sinirla01, TAU, karma01, bezier2 } from './matematik';
import { ER, renkUclu, rgba } from './palet';
import { HAVUZ, ParcacikHavuzu, PT } from './parcacik';
import { DamlaSpritelari, EfektSpritelari } from './sprite';
import { SuKatmani } from './su';
import { spriteUret, yuvarlakDikdortgen, type Ctx, type Sprite } from './tuval';
import { GOVDE_FONT, Yazi } from './yazi';
import { ZeminKatmani } from './zemin';
import { KagitCekme } from './kagitCek';
import { elSpriteUret } from './el';

/** Son olaydan sonra beklenen pay (oynatma ms). */
const KUYRUK = 160;
/** Boşta ipucunun kapanırken solma süresi (ms). */
const IPUCU_SOLMA = 300;
const simdiMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const KADEME_METNI: Record<string, string> = { guzel: 'Güzel', nefis: 'Nefis', harika: 'Harika', saheser: 'Şaheser!' };

export const KOMBO_ADLARI: Record<KomboTuru, string> = {
  tarakTarak: 'Tarak + Tarak: artı',
  tarakGirdap: 'Tarak + Girdap: üç hat',
  girdapGirdap: 'Girdap + Girdap: büyük baklava',
  laleTarak: 'Lale + Tarak: taraklar',
  laleGirdap: 'Lale + Girdap: girdaplar',
  laleLale: 'Lale + Lale: bütün tekne',
  murekkepTarak: 'Mürekkep + Tarak: kalın tarak',
  murekkepGirdap: 'Mürekkep + Girdap: geniş baklava',
  murekkepLale: 'Mürekkep + Lale: ham boyalar',
  murekkepMurekkep: 'Mürekkep + Mürekkep: büyük patlama',
};

/** Anında bitirmede bile bildirilen (durum taşıyan) olaylar. */
const DURUM_OLAYLARI = new Set(['hedefIlerledi', 'puanEklendi', 'bolumBitti', 'hamleOzeti', 'solenBasladi', 'temizlendi', 'kaskat']);

interface Oynatma {
  olaylar: readonly Olay[];
  i: number;
  saat: number;
  son: number;
  onceki: OyunDurumu;
  sonraki: OyunDurumu;
  coz: () => void;
}

interface SurukleDurumu {
  kaynak: Konum | null;
  parmak: { x: number; y: number } | null;
  hedefler: readonly Konum[];
  onizleme: Onizleme | null;
  /** Kaynak kalkış zamanı (ms). */
  kalkis: number;
  /** Geçerli hedefe giriş zamanı (ms) ve anahtarı. */
  giris: number;
  hedefAnahtar: string;
}

export interface CiziciKurulum {
  /** Geliştirme kipi: oynatma sonu fark uyarıları (varsayılan import.meta.env.DEV). */
  gelistirme?: boolean;
}

/** Geliştirme ve test kancaları (sözleşme dışı). */
export interface CiziciDev {
  gt: GorselTahta;
  dondur(d: boolean): void;
  /** Sabit 1/60 s adımlarla ilerlet. */
  ilerle(ms: number): void;
  oynuyor(): boolean;
  /** Son oynatmadaki fark sayısı (görsel tahta ≠ sonraki). */
  sonFark(): number;
  sayac(): { parcacik: number; efekt: number; kalite: string; sprite: number };
  kaliteZorla(dusuk: boolean | null): void;
}

/** Sözleşmenin üstüne çizici ekleri (entegratör kullanır; GDD §12.1, §9.5). */
export interface OyunCiziciTam extends OyunCizici {
  dev: CiziciDev;
  /** Öğretim kipi: kayacak sütun okları alfa 0,7 (§3.5). */
  ogretimKipi(acik: boolean): void;
  /** Kâğıt çekme sürerken tablo hazır olunca (parçalı çizim bitti) ver. */
  kagitTablo(t: HTMLCanvasElement | OffscreenCanvas | null): void;
  /** Sunulan tabloyu kaldır (kazandın ekranı kapanınca). */
  kagitKaldir(): void;
  /** Kâğıt çekmenin sonunda tablonun ekrandaki yeri (yıldız mühürleri için). */
  kagitDikdortgeni(): Dikdortgen | null;
  /** Hücre merkezi (CSS px). */
  hucreMerkezi(k: Konum): { x: number; y: number };
  /** Ekran konumunda altın varak tozu (kazandın, yıldız mührü). */
  altinTozu(x: number, y: number, adet?: number): void;
}

export function oyunCiziciOlustur(stage: Stage, kurulum: CiziciKurulum = {}): OyunCiziciTam {
  return new OyunCiziciSinifi(stage, kurulum);
}

class OyunCiziciSinifi implements OyunCiziciTam {
  private sec: CiziciSecenek = {
    hareketiAzalt: typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false,
    hiz: 1,
    palet: 'standart',
    motifler: true,
    kalite: 'oto',
  };
  private gt = new GorselTahta();
  private bolum: BolumVerisi | null = null;
  private hedefTanim: Hedef[] = [];
  private alan: Dikdortgen | null = null;
  private geo: TahtaGeometrisi = { x: 0, y: 0, hucre: 40, w: 7, h: 9 };
  private yerlesimAnahtar = '';
  private spr = new DamlaSpritelari();
  private efs = new EfektSpritelari();
  private su = new SuKatmani();
  private cer = new CerceveKatmani();
  private zem = new ZeminKatmani();
  private parc = new ParcacikHavuzu();
  private ef = new Efektler();
  private yazi = new Yazi();
  private bilgi = new Yazi();
  private kagit = new KagitCekme();
  private rnd = new Rng(0xeb2a1);
  private dinleyiciler: ((o: Olay) => void)[] = [];
  private zaman = 0;
  private oyn: Oynatma | null = null;
  private hizCarpani = 1;
  private yavasKalan = 0;
  /** Kıl payı donması kalan gerçek ms (oynatma ve canlandırma durur). */
  private donma = 0;
  private sur: SurukleDurumu = { kaynak: null, parmak: null, hedefler: [], onizleme: null, kalkis: 0, giris: 0, hedefAnahtar: '' };
  /** `sol`: ipucu kapanırken kalan solma süresi (ms); yoksa tam görünür. */
  private vurgu: { hucreler: readonly Konum[]; kip: 'zorunlu' | 'ipucu'; t: number; sol?: number } | null = null;
  private el: { yol: Konum[]; t: number } | null = null;
  private elSprite: Sprite | null = null;
  private hayalet: { h: Hamle; t: number } | null = null;
  private imlec: Konum | null = null;
  private karartma = { alfa: 0, hedef: 0 };
  private sars = { A: 0, t: 999, dx: 1, dy: 0 };
  private flas = { alfa: 0, z1: -9999, z2: -9999 };
  private kalite = { dusuk: false, zorla: null as boolean | null, aralik: 0, n: 0, maliyet: 0, m: 0, iyi: 0, gereken: 1 };
  private hedefNoktalari: { x: number; y: number }[] = [];
  private ucusSayisi: number[] = [];
  private bekleyen: Olay[][] = [];
  private ogretim = false;
  /** Önizleme hücre maskesi (bit 1 grup, bit 2 etki alanı); kare başına ayırma olmasın diye surukleGoster'de kurulur. */
  private maske = new Uint8Array(0);
  private gelistirme: boolean;
  private donuk = false;
  private sonFarkSayisi = 0;
  private yokEdildi = false;
  readonly dev: CiziciDev;

  constructor(
    private readonly st: Stage,
    kurulum: CiziciKurulum,
  ) {
    let dev = false;
    try {
      dev = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
    } catch {
      dev = false;
    }
    this.gelistirme = kurulum.gelistirme ?? dev;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.dev = {
      gt: this.gt,
      dondur(d) {
        self.donuk = d;
      },
      ilerle(ms) {
        const d = self.donuk;
        self.donuk = false;
        let kalan = ms;
        while (kalan > 0) {
          const a = Math.min(1000 / 60, kalan);
          self.adim(a);
          kalan -= a;
        }
        self.ciz();
        self.donuk = d;
      },
      oynuyor: () => !!self.oyn,
      sonFark: () => self.sonFarkSayisi,
      sayac: () => ({ parcacik: self.parc.sayi, efekt: self.ef.sayi(), kalite: self.dusukMu() ? 'dusuk' : 'yuksek', sprite: self.spr.pisirilen }),
      kaliteZorla(d) {
        self.kalite.zorla = d;
      },
    };
    this.efs.ayarla(this.spriteDpr(), this.sec.palet);
  }

  // ─── Yerleşim ────────────────────────────────────────────────────────

  private spriteDpr(): number {
    return Math.min(2, this.st.dpr || 1);
  }

  private suRenkleri() {
    const a = ATOLYELER.find((x) => x.id === this.bolum?.atolye) ?? ATOLYELER[0];
    return { ust: a.su[0], alt: a.su[1], parilti: a.su[2] };
  }

  /** Tahta boyutu (w×h) için geometri; alan yoksa bütün sahne. */
  private geometriHesapla(bw: number, bh: number): TahtaGeometrisi {
    const W = this.st.width || 390;
    const H = this.st.height || 844;
    const r = this.alan ?? { x: 0, y: 0, w: W, h: H };
    // Hücre üst sınırı ui/yerlesim.ts `hucreSiniri` ile aynı: telefonda 64, büyük ekranda 96.
    const sinir = Math.min(W, H) >= 600 ? 96 : 64;
    const tahmin = Math.min((r.w - 44) / bw, (r.h - 44) / bh, sinir);
    const bant = bantKalinligi(tahmin);
    const pay = bant + 8;
    let hucre = Math.floor(Math.min((r.w - 2 * pay) / bw, (r.h - 2 * pay) / bh, sinir));
    hucre = Math.max(20, hucre);
    return {
      x: Math.round(r.x + (r.w - bw * hucre) / 2),
      y: Math.round(r.y + (r.h - bh * hucre) / 2),
      hucre,
      w: bw,
      h: bh,
    };
  }

  private yerlesim(): void {
    const bw = this.gt.w || this.bolum?.w || 7;
    const bh = this.gt.h || this.bolum?.h || 9;
    const a = this.alan;
    const anahtar = `${this.st.width}|${this.st.height}|${this.st.dpr}|${a ? `${a.x},${a.y},${a.w},${a.h}` : '-'}|${bw}|${bh}|${this.sec.palet}|${this.sec.motifler}|${this.bolum?.atolye}`;
    if (anahtar === this.yerlesimAnahtar) return;
    this.yerlesimAnahtar = anahtar;
    this.geo = this.geometriHesapla(bw, bh);
    const g = this.geo;
    const dpr = this.spriteDpr();
    this.spr.ayarla(g.hucre, dpr, this.sec.palet, this.sec.motifler);
    this.efs.ayarla(dpr, this.sec.palet);
    this.zem.palet = this.sec.palet;
    const tahta = { x: g.x, y: g.y, w: g.w * g.hucre, h: g.h * g.hucre };
    this.su.ayarla(this.st.width, this.st.height, dpr, tahta, g.hucre, this.suRenkleri());
    this.cer.pisir(tahta, g.hucre, dpr);
    this.elSprite = null;
  }

  private mx(x: number): number {
    return this.geo.x + (x + 0.5) * this.geo.hucre;
  }
  private my(y: number): number {
    return this.geo.y + (y + 0.5) * this.geo.hucre;
  }

  hucreMerkezi(k: Konum): { x: number; y: number } {
    this.yerlesim();
    return { x: this.mx(k.x), y: this.my(k.y) };
  }

  // ─── Sözleşme ────────────────────────────────────────────────────────

  bolumKur(d: OyunDurumu, bolum: BolumVerisi): void {
    this.oynatmayiBitir();
    this.bolum = bolum;
    this.hedefTanim = bolum.hedefler.slice();
    this.gt.kur(d);
    this.ucusSayisi = this.hedefTanim.map(() => 0);
    this.bekleyen = this.hedefTanim.map(() => []);
    this.ef.temizle();
    this.parc.temizle();
    this.yazi.kapat();
    this.bilgi.kapat();
    this.sur = { kaynak: null, parmak: null, hedefler: [], onizleme: null, kalkis: 0, giris: 0, hedefAnahtar: '' };
    this.vurgu = null;
    this.el = null;
    this.hayalet = null;
    this.imlec = null;
    this.karartma = { alfa: 0, hedef: 0 };
    this.kagit.kaldir();
    this.yerlesimAnahtar = '';
    this.yerlesim();
    this.su.izSifirla();
  }

  durumGoster(d: OyunDurumu): void {
    this.oynatmayiBitir();
    if (this.gt.w !== d.w || this.gt.h !== d.h) {
      this.gt.kur(d);
      this.yerlesimAnahtar = '';
    } else this.gt.esitle(d);
    this.gt.bitir();
  }

  oynat(onceki: OyunDurumu, olaylar: readonly Olay[], sonraki: OyunDurumu): Promise<void> {
    this.oynatmayiBitir();
    if (this.gt.w !== onceki.w || this.gt.h !== onceki.h) {
      this.gt.kur(onceki);
      this.yerlesimAnahtar = '';
    } else {
      const f = this.gt.farklar(onceki);
      if (f.length) {
        if (this.gelistirme) console.warn('[çizici] oynatma öncesi görsel tahta ≠ önceki; eşitleniyor', f.slice(0, 6));
        this.gt.esitle(onceki);
      }
    }
    this.gt.uyumsuz = 0;
    this.hizCarpani = 1;
    return new Promise<void>((coz) => {
      const son = olaylar.length ? olaylar[olaylar.length - 1].t : 0;
      this.oyn = { olaylar, i: 0, saat: 0, son, onceki, sonraki, coz };
      if (!olaylar.length) this.oynatmaSonu();
    });
  }

  hizlandir(carpan: number): void {
    this.hizCarpani = Math.max(0.1, carpan);
  }

  surukleGoster(s: { kaynak: Konum | null; parmak: { x: number; y: number } | null; hedefler: readonly Konum[]; onizleme: Onizleme | null }): void {
    const eski = this.sur;
    const yeniKaynak = !!s.kaynak && (!eski.kaynak || eski.kaynak.x !== s.kaynak.x || eski.kaynak.y !== s.kaynak.y);
    const hedef = s.onizleme && s.onizleme.gecerli ? this.onizlemeHedefi(s) : null;
    const ha = hedef ? `${hedef.x},${hedef.y}` : '';
    if (s.onizleme !== eski.onizleme) {
      const n = this.gt.w * this.gt.h;
      if (this.maske.length !== n) this.maske = new Uint8Array(n);
      else this.maske.fill(0);
      const o = s.onizleme;
      if (o && o.gecerli) {
        for (const gr of o.gruplar) for (const k of gr.hucreler) if (k.x >= 0 && k.y >= 0 && k.x < this.gt.w && k.y < this.gt.h) this.maske[k.y * this.gt.w + k.x] |= 1;
        for (const k of o.etkiAlani) if (k.x >= 0 && k.y >= 0 && k.x < this.gt.w && k.y < this.gt.h) this.maske[k.y * this.gt.w + k.x] |= 2;
      }
    }
    this.sur = {
      kaynak: s.kaynak ? { ...s.kaynak } : null,
      parmak: s.parmak ? { ...s.parmak } : null,
      hedefler: s.hedefler,
      onizleme: s.onizleme,
      kalkis: yeniKaynak ? this.zaman : eski.kalkis,
      giris: ha && ha !== eski.hedefAnahtar ? this.zaman : eski.giris,
      hedefAnahtar: ha,
    };
  }

  /** Önizlemenin hedef hücresi: parmağa en yakın geçerli hedef. */
  private onizlemeHedefi(s: { kaynak: Konum | null; parmak: { x: number; y: number } | null; hedefler: readonly Konum[] }): Konum | null {
    if (!s.kaynak || !s.parmak || !s.hedefler.length) return null;
    const gx = (s.parmak.x - this.geo.x) / this.geo.hucre - 0.5;
    const gy = (s.parmak.y - this.geo.y) / this.geo.hucre - 0.5;
    const dx = gx - s.kaynak.x;
    const dy = gy - s.kaynak.y;
    const yon = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    const k = s.hedefler.find((h) => h.x === s.kaynak!.x + yon.x && h.y === s.kaynak!.y + yon.y);
    return k ?? null;
  }

  titret(h: Konum): void {
    const g = this.gt.damla(h);
    if (g) g.titre = TITRE_MS;
  }

  vurgula(hucreler: readonly Konum[] | null, kip: 'zorunlu' | 'ipucu'): void {
    // Boşta ipucu birden kaybolmaz, 300 ms'de solar (aç/kapa boşta yanıp sönme gibiydi).
    if (!hucreler?.length && this.vurgu?.kip === 'ipucu' && kip === 'ipucu' && !this.sec.hareketiAzalt) {
      this.vurgu.sol ??= IPUCU_SOLMA;
      return;
    }
    this.vurgu = hucreler && hucreler.length ? { hucreler: hucreler.map((k) => ({ ...k })), kip, t: 0 } : null;
  }

  /** İpucu vurgusunun görünürlüğü (0–1): 350 ms'de belirir, kapanırken solar. */
  private ipucuZarf(): number {
    const v = this.vurgu;
    if (!v || v.kip !== 'ipucu') return 0;
    const gir = Math.min(1, v.t / 350);
    return v.sol === undefined ? gir : gir * Math.max(0, v.sol / IPUCU_SOLMA);
  }

  elGoster(yol: readonly Konum[] | null): void {
    this.el = yol && yol.length ? { yol: yol.map((k) => ({ ...k })), t: 0 } : null;
  }

  hayaletHamle(h: Hamle | null): void {
    this.hayalet = h ? { h, t: 0 } : null;
  }

  imlecGoster(h: Konum | null): void {
    this.imlec = h ? { ...h } : null;
  }

  geometri(): TahtaGeometrisi {
    this.yerlesim();
    return { ...this.geo };
  }

  alanAyarla(r: Dikdortgen): void {
    this.alan = { ...r };
    this.yerlesim();
  }

  hedefKonumlari(k: readonly { x: number; y: number }[]): void {
    this.hedefNoktalari = k.map((p) => ({ ...p }));
  }

  secenekAyarla(s: Partial<CiziciSecenek>): void {
    this.sec = { ...this.sec, ...s };
    this.yerlesimAnahtar = '';
    this.yerlesim();
  }

  olayDinle(fn: (o: Olay) => void): void {
    this.dinleyiciler.push(fn);
  }

  karart(alfa: number): void {
    this.karartma.hedef = sinirla01(alfa);
  }

  kagitCek(tablo: HTMLCanvasElement | OffscreenCanvas | null): Promise<void> {
    this.yerlesim();
    const g = this.geo;
    return this.kagit.baslat(tablo, { x: g.x, y: g.y, w: g.w * g.hucre, h: g.h * g.hucre }, this.st.width, this.st.height, this.sec.hareketiAzalt, (x, y, r) => {
      // Kâğıt suya değerken kenarlarından açılan su halkaları.
      for (let i = 0; i < 3; i++) {
        const e = this.ef.al(E.HALKA, 700, i * 90);
        e.x = x;
        e.y = y;
        e.r0 = r * 0.6;
        e.r1 = r * (1.05 + i * 0.12);
        e.a0 = 0.35;
        e.renk = 0;
      }
    });
  }

  kagitTablo(t: HTMLCanvasElement | OffscreenCanvas | null): void {
    this.kagit.tabloVer(t);
  }

  kagitKaldir(): void {
    this.kagit.kaldir();
  }

  kagitDikdortgeni(): Dikdortgen | null {
    return this.kagit.sonDikdortgen();
  }

  ogretimKipi(acik: boolean): void {
    this.ogretim = acik;
  }

  async onIsit(bolum: BolumVerisi): Promise<void> {
    const once = this.bolum;
    if (!this.gt.w) this.bolum = bolum;
    const renkler = new Set<Renk | 0>();
    const sira: Renk[] = [1, 2, 4, 3, 5, 6];
    bolum.dogum.forEach((w, i) => w > 0 && renkler.add(sira[i]));
    for (const satir of bolum.duzen) for (const s of satir.split(' ')) if (/^[1-7]$/.test(s)) renkler.add(Number(s) as Renk);
    for (const k of [1, 2, 4] as const) if (renkler.has((k | 1) as Renk) || renkler.size === 0) renkler.add(k);
    const bekle = () => new Promise<void>((r) => setTimeout(r, 0));
    // Geometri bu bölümün boyutuyla (henüz kurulmadıysa).
    if (!this.gt.w) {
      this.yerlesimAnahtar = '';
      const eski = { w: this.gt.w, h: this.gt.h };
      this.gt.w = bolum.w;
      this.gt.h = bolum.h;
      this.yerlesim();
      this.gt.w = eski.w;
      this.gt.h = eski.h;
      this.yerlesimAnahtar = '';
    } else this.yerlesim();
    await bekle();
    this.spr.pisir([...renkler], true);
    await bekle();
    this.spr.mermer(0, 1, 0);
    this.elSpriteAl();
    if (!this.gt.w) this.bolum = once ?? bolum;
  }

  kare(dtMs: number): void {
    if (this.yokEdildi) return;
    const t0 = simdiMs();
    const dt = Math.max(0, Math.min(dtMs, 50));
    if (!this.donuk) this.adim(dt);
    this.ciz();
    this.kaliteOlc(dtMs, simdiMs() - t0);
  }

  altinTozu(x: number, y: number, adet = 24): void {
    const n = this.parc.adet(adet);
    for (let i = 0; i < n; i++) {
      const a = this.rnd.float() * TAU;
      const v = 60 + this.rnd.float() * 160;
      const j = this.parc.ekle(PT.PUL, x, y, Math.cos(a) * v, Math.sin(a) * v - 60, 700 + this.rnd.float() * 600, 3 + this.rnd.float() * 3, ER.ALTIN_ACIK, 2.2, 90, i * 6);
      if (j >= 0) {
        this.parc.ust[j] = 1;
        this.parc.donusHizi[j] = (this.rnd.float() - 0.5) * 10;
      }
    }
  }

  yokEt(): void {
    this.yokEdildi = true;
    this.oynatmayiBitir();
    this.dinleyiciler = [];
    this.ef.temizle();
    this.parc.temizle();
  }

  // ─── Oynatma ─────────────────────────────────────────────────────────

  private bildir(o: Olay): void {
    for (const fn of this.dinleyiciler) {
      try {
        fn(o);
      } catch (e) {
        if (this.gelistirme) console.error('[çizici] dinleyici hatası', e);
      }
    }
  }

  private oynatmayiBitir(): void {
    const o = this.oyn;
    if (!o) return;
    // Kalan olaylar efektsiz uygulanır; durum taşıyanlar bildirilir.
    while (o.i < o.olaylar.length) {
      const ol = o.olaylar[o.i++];
      this.gt.uygula(ol);
      if (DURUM_OLAYLARI.has(ol.tur)) this.bildir(ol);
    }
    this.ef.temizle();
    this.bekleyenleriBosalt();
    this.oynatmaSonu();
  }

  private bekleyenleriBosalt(): void {
    for (let i = 0; i < this.bekleyen.length; i++) {
      const l = this.bekleyen[i];
      while (l.length) this.bildir(l.shift()!);
      this.ucusSayisi[i] = 0;
    }
  }

  private oynatmaSonu(): void {
    const o = this.oyn;
    if (!o) return;
    this.oyn = null;
    this.bekleyenleriBosalt();
    const fark = this.gt.farklar(o.sonraki);
    this.sonFarkSayisi = fark.length;
    if (fark.length && this.gelistirme) console.error('[çizici] görsel tahta ≠ sonraki durum', fark.slice(0, 8));
    this.gt.esitle(o.sonraki);
    this.hizCarpani = 1;
    o.coz();
  }

  private bekleyenVar(): boolean {
    for (const l of this.bekleyen) if (l.length) return true;
    return false;
  }

  /** Bir zaman adımı (gerçek ms). */
  private adim(dt: number): void {
    this.zaman += dt;
    this.yerlesim();
    let animDt = dt * this.sec.hiz;
    const o = this.oyn;
    if (this.donma > 0) {
      this.donma -= dt;
      this.yazi.guncelle(dt);
      return;
    }
    if (o) {
      let hiz = this.sec.hiz * this.hizCarpani;
      if (this.yavasKalan > 0) {
        hiz *= 0.4;
        this.yavasKalan -= dt;
      }
      animDt = dt * hiz;
      o.saat += animDt;
      while (o.i < o.olaylar.length && o.olaylar[o.i].t <= o.saat) {
        const ol = o.olaylar[o.i++];
        this.olayIsle(ol);
        if (this.yavasKalan > 0 && ol.tur === 'birlesim') {
          // Birleşimden sonraki olaylar yavaş çekimde gelsin.
          o.saat = Math.min(o.saat, ol.t);
          break;
        }
      }
      if (o.i >= o.olaylar.length && o.saat >= o.son + KUYRUK) {
        const sarkma = o.saat - o.son;
        if ((!this.bekleyenVar() && !this.gt.hareketli()) || sarkma > 2500) this.oynatmaSonu();
      }
    }
    this.gt.guncelle(animDt);
    this.ef.guncelle(animDt);
    this.parc.guncelle(animDt);
    this.yazi.guncelle(dt);
    this.bilgi.guncelle(dt);
    this.kagit.guncelle(dt);
    if (this.vurgu) {
      this.vurgu.t += dt;
      if (this.vurgu.sol !== undefined && (this.vurgu.sol -= dt) <= 0) this.vurgu = null;
    }
    if (this.el) this.el.t += dt;
    if (this.hayalet) this.hayalet.t += dt;
    // Kararma: 400 ms'de hedefe.
    const k = this.karartma;
    if (k.alfa !== k.hedef) {
      const adim = dt / 400;
      k.alfa = k.alfa < k.hedef ? Math.min(k.hedef, k.alfa + adim) : Math.max(k.hedef, k.alfa - adim);
    }
    this.sars.t += dt;
    if (this.flas.alfa > 0) this.flas.alfa = Math.max(0, this.flas.alfa - dt / 260);
    this.parc.oran = this.dusukMu() ? 0.5 : this.sec.hareketiAzalt ? 0.7 : 1;
  }

  private dusukMu(): boolean {
    if (this.kalite.zorla !== null) return this.kalite.zorla;
    if (this.sec.kalite === 'dusuk') return true;
    if (this.sec.kalite === 'yuksek') return false;
    return this.kalite.dusuk;
  }

  /** Otomatik kalite (§13.5): 30 kare ortalama aralık > 20 ms → düşük; 120 kare ucuz ve akıcı → geri. */
  private kaliteOlc(aralik: number, maliyet: number): void {
    const q = this.kalite;
    if (aralik > 100 || aralik <= 0) return; // sekme gizliydi
    q.aralik += aralik;
    q.n++;
    q.maliyet += maliyet;
    q.m++;
    if (!q.dusuk && q.n >= 30) {
      if (q.aralik / q.n > 20) {
        q.dusuk = true;
        q.m = q.maliyet = 0;
        q.iyi = 0;
      }
      q.n = q.aralik = 0;
    } else if (q.dusuk && q.m >= 120) {
      // Yükselmek için art arda `gereken` iyi pencere; her yükselmede ikiye katlanır
      // (sınırdaki cihazda, ör. büyük tablet tuvalinde, kalite birkaç saniyede bir gidip gelmesin).
      q.iyi = q.maliyet / q.m < 6 && q.aralik / Math.max(1, q.n) < 18 ? q.iyi + 1 : 0;
      if (q.iyi >= q.gereken) {
        q.dusuk = false;
        q.iyi = 0;
        q.gereken = Math.min(16, q.gereken * 2);
      }
      q.m = q.maliyet = q.n = q.aralik = 0;
    }
  }

  private sarsinti(px: number): void {
    if (this.sec.hareketiAzalt) return;
    if (this.sars.t < 150 && this.sars.A > px) return;
    const a = this.rnd.float() * TAU;
    this.sars = { A: px, t: 0, dx: Math.cos(a), dy: Math.sin(a) };
  }

  /** Tam ekran flaş: saniyede en fazla 2, alfa ≤ 0,25 (§10.1). */
  private flasIste(alfa: number): void {
    const f = this.flas;
    if (this.zaman - f.z1 < 1000) return;
    f.z1 = f.z2;
    f.z2 = this.zaman;
    f.alfa = Math.min(0.25, this.sec.hareketiAzalt ? alfa * 0.5 : alfa);
  }

  // ─── Olay → görsel ───────────────────────────────────────────────────

  /** Damlanın anlık ekran konumu (görsel tahtadan, ofset dahil). */
  private damlaKonumu(k: Konum): { x: number; y: number } {
    const g = this.gt.damla(k) ?? this.gt.ezilen.find((e) => e.hucre.x === k.x && e.hucre.y === k.y)?.d ?? null;
    const h = this.geo.hucre;
    return { x: this.mx(k.x) + (g ? g.ox * h : 0), y: this.my(k.y) + (g ? g.oy * h : 0) };
  }

  private serpe(x: number, y: number, n: number, renk: number, vMin: number, vMax: number, omurMin: number, omurMax: number, boy: number, tur: number = PT.DAMLACIK, surt = 3, gec = 0): void {
    const adet = this.parc.adet(n);
    for (let i = 0; i < adet; i++) {
      const a = this.rnd.float() * TAU;
      const v = vMin + this.rnd.float() * (vMax - vMin);
      const j = this.parc.ekle(tur, x + Math.cos(a) * 2, y + Math.sin(a) * 2, Math.cos(a) * v, Math.sin(a) * v, omurMin + this.rnd.float() * (omurMax - omurMin), boy * (0.7 + this.rnd.float() * 0.6), renk, surt, 0, gec);
      if (j >= 0 && tur !== PT.DAMLACIK && tur !== PT.ISIK) this.parc.donusHizi[j] = (this.rnd.float() - 0.5) * 12;
    }
  }

  private halka(x: number, y: number, r0: number, r1: number, a0: number, sure: number, renk = 0, gec = 0): void {
    const e = this.ef.al(E.HALKA, sure, gec);
    e.x = x;
    e.y = y;
    e.r0 = r0;
    e.r1 = r1;
    e.a0 = a0;
    e.renk = renk;
  }

  private metin(x: number, y: number, s: string, boy: number, gec = 0, krem = false): void {
    const e = this.ef.al(E.METIN, 900, gec);
    e.x = x;
    e.y = y;
    e.metin = s;
    e.r0 = boy;
    e.renk2 = krem ? 1 : 0;
  }

  /** `renk` için bir 'topla' hedefi varsa indeksi. */
  private toplaHedefi(renk: number): number {
    for (let i = 0; i < this.hedefTanim.length; i++) {
      const h = this.hedefTanim[i];
      if (h.tur === 'topla' && h.renk === renk && !this.gt.hedefler[i]?.tamam) return i;
    }
    return -1;
  }

  private turHedefi(tur: Hedef['tur']): number {
    for (let i = 0; i < this.hedefTanim.length; i++) if (this.hedefTanim[i].tur === tur && !this.gt.hedefler[i]?.tamam) return i;
    return -1;
  }

  /** Hedef kartına uçuş (HUD bildirimi varışta). */
  private ucur(indeks: number, x: number, y: number, renk: number, kagit: boolean, gec: number): boolean {
    const p = this.hedefNoktalari[indeks];
    if (!p) return false;
    if (this.ucusSayisi[indeks] > 14) return false;
    const e = this.ef.al(kagit ? E.KAGIT_UCUS : E.UCUS, kagit ? 520 : 420, gec);
    e.x = x;
    e.y = y;
    e.x2 = p.x;
    e.y2 = p.y;
    e.renk = renk;
    e.ust = true;
    e.aci = (this.rnd.float() - 0.5) * 2;
    this.ucusSayisi[indeks]++;
    e.bitince = () => {
      this.ucusSayisi[indeks] = Math.max(0, this.ucusSayisi[indeks] - 1);
      // Kartta küçük parıltı.
      const j = this.parc.ekle(PT.ISIK, p.x, p.y, 0, 0, 260, 9, kagit ? ER.KREM : renk);
      if (j >= 0) this.parc.ust[j] = 1;
      if (this.ucusSayisi[indeks] === 0) {
        const l = this.bekleyen[indeks];
        while (l && l.length) this.bildir(l.shift()!);
      }
    };
    return true;
  }

  private olayIsle(o: Olay): void {
    const h = this.geo.hucre;
    switch (o.tur) {
      case 'karisti': {
        const a = this.damlaKonumu(o.kaynak);
        const b = { x: this.mx(o.hedef.x), y: this.my(o.hedef.y) };
        const e = this.ef.al(E.KAYMA, 140);
        e.x = a.x;
        e.y = a.y;
        e.x2 = b.x;
        e.y2 = b.y;
        e.renk = o.a;
        this.gt.uygula(o);
        this.halka(a.x, a.y, h * 0.2, h * 0.7, 0.4, 420, 0);
        this.halka(b.x, b.y, h * 0.35, h * 0.85, 0.45, 520, o.sonuc, 120);
        const n = this.parc.adet(8);
        for (let i = 0; i < n; i++) {
          const an = this.rnd.float() * TAU;
          const v = 50 + this.rnd.float() * 90;
          this.parc.ekle(PT.DAMLACIK, b.x, b.y, Math.cos(an) * v, Math.sin(an) * v, 360 + this.rnd.float() * 200, h * 0.06, i % 2 ? o.a : o.b, 3.5, 0, 60);
        }
        break;
      }
      case 'ozelSuruklendi': {
        const a = this.damlaKonumu(o.kaynak);
        const tas = this.gt.damla(o.kaynak);
        if (o.tasindi && tas) {
          // Taş hedefe kayar ve orada tüketilir (görsel tahtada yazılmaz).
          const e = this.ef.al(E.TAS, 260);
          e.x = a.x;
          e.y = a.y;
          e.x2 = this.mx(o.hedef.x);
          e.y2 = this.my(o.hedef.y);
          e.renk = tas.renk;
          e.ozel = tas.ozel;
          e.yon = tas.yon;
        }
        this.gt.uygula(o);
        this.halka(a.x, a.y, h * 0.2, h * 0.6, 0.35, 360, 0);
        break;
      }
      case 'eslesti': {
        this.gt.uygula(o);
        const mx = this.mx(o.merkez.x);
        const my = this.my(o.merkez.y);
        this.su.izEkle(o.merkez.x, o.merkez.y, renkUclu(o.renk, this.sec.palet)[0], o.hucreler.length);
        this.metin(mx, my - h * 0.2, `+${o.hucreler.length * 30 * o.k}`, Math.round(h * 0.36 + 4), 120);
        break;
      }
      case 'temizlendi': {
        const p = this.damlaKonumu(o.hucre);
        this.gt.uygula(o);
        const renk = o.renk === 0 ? 0 : o.renk;
        // Boya suya açılır: leke + üç halka (r 0 → 0,9 hücre).
        if (renk !== 7) {
          const l = this.ef.al(E.LEKE, 420);
          l.x = p.x;
          l.y = p.y;
          l.r0 = h * 0.4;
          l.r1 = h * 1.05;
          l.a0 = 0.75;
          l.renk = renk;
        }
        for (let i = 0; i < 3; i++) this.halka(p.x, p.y, h * 0.1, h * (0.55 + i * 0.18), 0.8 - i * 0.15, 250 + i * 60, renk === 7 ? 0 : renk, i * 50);
        this.serpe(p.x, p.y, 6 + Math.floor(this.rnd.float() * 5), renk === 7 ? ER.IS : renk === 0 ? ER.KREM : renk, 80, 180, 400, 650, h * 0.07);
        if (o.ozel !== 'yok') this.serpe(p.x, p.y, 6, ER.ALTIN_ACIK, 60, 200, 400, 700, h * 0.06, PT.ISIK, 2.5);
        const hi = renk >= 3 && renk <= 6 ? this.toplaHedefi(renk) : -1;
        if (hi >= 0) this.ucur(hi, p.x, p.y, renk, false, 90);
        break;
      }
      case 'ozelOlustu': {
        this.gt.uygula(o);
        const x = this.mx(o.hucre.x);
        const y = this.my(o.hucre.y);
        this.halka(x, y, h * 0.3, h * 1.1, 0.7, 500, 0);
        const n = this.parc.adet(10);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + this.rnd.float() * 0.3;
          const v = 90 + this.rnd.float() * 80;
          const j = this.parc.ekle(PT.PUL, x, y, Math.cos(a) * v, Math.sin(a) * v, 500 + this.rnd.float() * 300, 4, ER.ALTIN_ACIK, 3);
          if (j >= 0) this.parc.donusHizi[j] = (this.rnd.float() - 0.5) * 14;
        }
        break;
      }
      case 'ozelTetiklendi':
        this.ozelEfekt(o);
        this.gt.uygula(o);
        break;
      case 'birlesim': {
        this.gt.uygula(o);
        this.yavasKalan = 150;
        const x = this.mx(o.hucre.x);
        const y = this.my(o.hucre.y);
        const e = this.ef.al(E.BIRLESIM, 650);
        e.x = x;
        e.y = y;
        e.r1 = h * 3.6;
        this.flasIste(0.2);
        this.sarsinti(6);
        this.serpe(x, y, 24, ER.ALTIN_ACIK, 120, 320, 500, 900, h * 0.08, PT.ISIK, 2.2);
        this.serpe(x, y, 16, ER.BEYAZ, 80, 260, 400, 700, h * 0.06, PT.ISIK, 2.6);
        break;
      }
      case 'donustu': {
        this.gt.uygula(o);
        const x = this.mx(o.hucre.x);
        const y = this.my(o.hucre.y);
        this.halka(x, y, h * 0.25, h * 0.75, 0.6, 360, 0);
        this.serpe(x, y, 4, ER.ALTIN_ACIK, 40, 120, 300, 500, 3, PT.PUL, 3);
        break;
      }
      case 'mermerHasar': {
        const x = this.mx(o.hucre.x);
        const y = this.my(o.hucre.y);
        const m = this.gt.hucre(o.hucre)?.icerik;
        const cesit = m && m.tur === 'mermer' ? m.m.cesit : 0;
        this.gt.uygula(o);
        if (o.kalan === 0) {
          const e = this.ef.al(E.MERMER, 500);
          e.x = x;
          e.y = y;
          e.tohum = cesit;
        }
        this.serpe(x, y, 6, ER.MERMER, 60, 160, 400, 650, 7, PT.KIRINTI, 2.5);
        break;
      }
      case 'kagitAlindi': {
        const x = this.mx(o.hucre.x);
        const y = this.my(o.hucre.y);
        this.gt.uygula(o);
        const hi = this.turHedefi('kagit');
        if (!(hi >= 0 && this.ucur(hi, x, y, o.renk, true, 60))) {
          const e = this.ef.al(E.KAGIT_UCUS, 500, 60);
          e.x = x;
          e.y = y;
          e.x2 = x + h * 0.6;
          e.y2 = y - h * 1.6;
          e.renk = o.renk;
        }
        this.serpe(x, y, 4, ER.KREM, 40, 110, 400, 700, 7, PT.LIF, 2.5);
        break;
      }
      case 'yagKalkti': {
        const x = this.mx(o.hucre.x);
        const y = this.my(o.hucre.y);
        this.gt.uygula(o);
        this.halka(x, y, h * 0.3, h * 0.9, 0.5, 300, 0);
        this.serpe(x, y, 6, ER.YANAR, 50, 140, 300, 520, h * 0.07, PT.ISIK, 3);
        break;
      }
      case 'desenBoyandi': {
        const x = this.mx(o.hucre.x);
        const y = this.my(o.hucre.y);
        this.gt.uygula(o);
        this.serpe(x, y, 6, o.renk, 50, 140, 360, 560, h * 0.07, PT.DAMLACIK, 3);
        this.halka(x, y, h * 0.2, h * 0.8, 0.6, 300, o.renk);
        break;
      }
      case 'kaskat': {
        this.gt.uygula(o);
        if (o.kademe) {
          const W = this.st.width;
          const boy = Math.max(40, Math.min(64, W * 0.13 + (o.k - 2) * 3));
          const x = this.geo.x + (this.geo.w * h) / 2;
          const y = this.geo.y + this.geo.h * h * 0.3;
          this.yazi.goster(KADEME_METNI[o.kademe], o.kademe === 'saheser' ? 'saheser' : 'kaskat', x, y, boy);
          this.serpe(x, y, 16, ER.ALTIN_ACIK, 120, 280, 450, 800, h * 0.06, PT.ISIK, 2.4);
        }
        break;
      }
      case 'yercekimi':
        this.gt.uygula(o);
        break;
      case 'karistirma': {
        this.gt.uygula(o);
        const x = this.geo.x + (this.geo.w * h) / 2;
        const y = this.geo.y + (this.geo.h * h) / 2;
        this.bilgi.goster('Tekne çalkalanıyor…', 'bilgi', x, y, Math.max(18, Math.min(26, this.st.width * 0.055)), 500);
        for (let i = 0; i < 3; i++) this.halka(x, y, h * 0.5, h * (2.5 + i), 0.3, 700, 0, i * 120);
        break;
      }
      case 'hedefIlerledi': {
        this.gt.uygula(o);
        if (o.tamam) {
          const p = this.hedefNoktalari[o.indeks];
          if (p) this.altinTozu(p.x, p.y, 10);
        }
        if (this.ucusSayisi[o.indeks] > 0) {
          this.bekleyen[o.indeks].push(o);
          return;
        }
        break;
      }
      case 'puanEklendi': {
        this.gt.uygula(o);
        // Özel taş ve desen puanı hücrede yükselir; engel puanı (kâğıt/mermer/yağ) uçuşla zaten okunur.
        if (o.hucre && o.miktar > 0 && (o.neden === 'ozel' || o.neden === 'desen')) this.metin(this.mx(o.hucre.x), this.my(o.hucre.y) + h * 0.15, `+${o.miktar}`, Math.round(h * 0.3 + 4), 60, o.neden !== 'ozel');
        break;
      }
      case 'bolumBitti': {
        this.gt.uygula(o);
        // Son hamle kazandırdı: 0,3 sn kare donması ("kıl payı", §10.2).
        if (o.sonuc === 'kazanc' && this.oyn && this.oyn.sonraki.kalanHamle === 0 && !this.sec.hareketiAzalt) this.donma = 300;
        break;
      }
      case 'solenBasladi': {
        this.gt.uygula(o);
        const x = this.geo.x + (this.geo.w * h) / 2;
        const y = this.geo.y + this.geo.h * h * 0.42;
        this.yazi.goster('Ebru Şöleni!', 'solen', x, y, Math.max(40, Math.min(62, this.st.width * 0.12)), 900);
        this.altinTozu(x, y, 30);
        break;
      }
      default:
        this.gt.uygula(o);
        break;
    }
    this.bildir(o);
  }

  private ozelEfekt(o: Extract<Olay, { tur: 'ozelTetiklendi' }>): void {
    const h = this.geo.hucre;
    const x = this.mx(o.hucre.x);
    const y = this.my(o.hucre.y);
    const g = this.gt.damla(o.hucre);
    const renk = g ? g.renk : 0;
    switch (o.ozel) {
      case 'tarak': {
        const yatay = o.yon === 'yatay';
        const n1 = yatay ? o.hucre.x : o.hucre.y;
        const n2 = yatay ? this.geo.w - 1 - o.hucre.x : this.geo.h - 1 - o.hucre.y;
        const e = this.ef.al(E.TARAK, (Math.max(n1, n2) + 2) * 25 + 120);
        e.x = x;
        e.y = y;
        e.yon = o.yon;
        e.n1 = n1;
        e.n2 = n2;
        e.renk = renk || 3;
        const iz = this.ef.al(E.TARAK_IZ, (Math.max(n1, n2) + 1) * 25 + 600);
        iz.x = x;
        iz.y = y;
        iz.yon = o.yon;
        iz.n1 = n1;
        iz.n2 = n2;
        iz.renk = renk || 3;
        iz.tohum = this.rnd.float() * 6;
        for (const k of o.alan) {
          const d = Math.abs(k.x - o.hucre.x) + Math.abs(k.y - o.hucre.y);
          const px = this.mx(k.x);
          const py = this.my(k.y);
          const nn = this.parc.adet(4);
          for (let i = 0; i < nn; i++) {
            const a = (yatay ? -Math.PI / 2 : 0) + (this.rnd.float() < 0.5 ? Math.PI : 0) + (this.rnd.float() - 0.5) * 0.9;
            const v = 60 + this.rnd.float() * 110;
            this.parc.ekle(PT.ISIK, px, py, Math.cos(a) * v, Math.sin(a) * v, 380 + this.rnd.float() * 220, h * 0.05, i % 2 ? ER.ALTIN_ACIK : renk || ER.KREM, 3, 0, d * 25);
          }
        }
        break;
      }
      case 'girdap': {
        const e = this.ef.al(E.GIRDAP, 700);
        e.x = x;
        e.y = y;
        e.r1 = h * 2.5;
        e.aci = this.rnd.float() * TAU;
        this.sarsinti(4);
        const n = this.parc.adet(24);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const r = h * (1.2 + this.rnd.float() * 1.3);
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          // İçe ve yana: sarmal.
          const v = 120 + this.rnd.float() * 80;
          const j = this.parc.ekle(PT.ISIK, px, py, -Math.cos(a) * v * 0.6 - Math.sin(a) * v, -Math.sin(a) * v * 0.6 + Math.cos(a) * v, 520 + this.rnd.float() * 200, h * 0.06, i % 3 ? renk || ER.KREM : ER.ALTIN_ACIK, 1.5);
          if (j >= 0) this.parc.acisal[j] = 4.5;
        }
        break;
      }
      case 'lale': {
        const e = this.ef.al(E.LALE, 520);
        e.x = x;
        e.y = y;
        e.aci = this.rnd.float() * TAU;
        const sirali = o.alan
          .map((k) => ({ k, d: Math.hypot(k.x - o.hucre.x, k.y - o.hucre.y) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 40);
        sirali.forEach(({ k }, i) => {
          const y2 = this.ef.al(E.YAPRAK, 300, 200 + 30 * i);
          y2.x = x;
          y2.y = y;
          y2.x2 = this.mx(k.x);
          y2.y2 = this.my(k.y);
          y2.renk = o.hedefRenk ?? 0;
          y2.aci = this.rnd.float() * TAU;
          this.serpe(this.mx(k.x), this.my(k.y), 6, o.hedefRenk ?? ER.KREM, 50, 140, 300, 500, h * 0.06, PT.DAMLACIK, 3, 480 + 30 * i);
        });
        this.serpe(x, y, 12, ER.ALTIN_ACIK, 80, 220, 500, 800, h * 0.06, PT.ISIK, 2.4);
        break;
      }
      case 'murekkep': {
        const e = this.ef.al(E.MUREKKEP, 520);
        e.x = x;
        e.y = y;
        e.r1 = h * 1.55;
        e.tohum = Math.floor(this.rnd.float() * 1000);
        this.sarsinti(3);
        this.serpe(x, y, 20, ER.IS, 60, 220, 500, 900, 9, PT.IS, 2.2);
        break;
      }
      default:
        break;
    }
  }

  // ─── Çizim ───────────────────────────────────────────────────────────

  private ciz(): void {
    this.yerlesim();
    const c = this.st.begin();
    const W = this.st.width;
    const H = this.st.height;
    const g = this.geo;
    const h = g.hucre;
    this.su.ciz(c, this.zaman, !this.dusukMu() && !this.sec.hareketiAzalt);
    // Sarsıntı: sönümlü sinüs 30 Hz, 150 ms.
    let sx = 0;
    let sy = 0;
    if (this.sars.t < 150) {
      const t = this.sars.t;
      const a = this.sars.A * Math.exp(-t / 50) * Math.sin(TAU * 0.03 * t);
      sx = a * this.sars.dx;
      sy = a * this.sars.dy;
    }
    c.save();
    c.translate(sx, sy);
    this.cer.ciz(c);
    c.save();
    c.beginPath();
    c.rect(g.x - 3, g.y - 3, g.w * h + 6, g.h * h + 6);
    c.clip();
    this.zem.ciz(c, this.gt, g, this.spriteDpr(), this.zaman);
    this.izgaraCiz(c);
    this.damlalariCiz(c);
    this.zem.ustCiz(c, this.gt, g, this.spriteDpr(), this.zaman);
    this.onizlemeCiz(c);
    const b: EfektCizimBaglami = { spr: this.spr, efs: this.efs, hucre: h, palet: this.sec.palet, dpr: this.spriteDpr() };
    this.ef.ciz(c, b, false, this.zaman);
    this.parc.ciz(c, this.efs, 0);
    if (this.vurgu) this.vurguCiz(c);
    c.restore();
    if (this.hayalet) this.hayaletCiz(c);
    if (this.imlec) this.imlecCiz(c);
    if (this.el) this.elCiz(c);
    this.yazi.ciz(c);
    this.bilgi.ciz(c);
    c.restore();
    if (this.karartma.alfa > 0.001) {
      c.fillStyle = `rgba(3,10,14,${this.karartma.alfa.toFixed(3)})`;
      c.fillRect(0, 0, W, H);
    }
    this.kagit.ciz(c, this.zaman);
    this.ef.ciz(c, b, true, this.zaman);
    this.parc.ciz(c, this.efs, 1);
    if (this.flas.alfa > 0.002) {
      c.fillStyle = `rgba(255,250,235,${this.flas.alfa.toFixed(3)})`;
      c.fillRect(0, 0, W, H);
    }
  }

  private izgaraCiz(c: Ctx): void {
    const g = this.geo;
    const h = g.hucre;
    c.fillStyle = 'rgba(220,240,235,0.07)';
    const r = Math.max(1, h * 0.03);
    for (let y = 1; y < g.h; y++)
      for (let x = 1; x < g.w; x++) {
        c.fillRect(g.x + x * h - r, g.y + y * h - r, r * 2, r * 2);
      }
  }

  private kaynakMi(x: number, y: number): boolean {
    const k = this.sur.kaynak;
    return !!k && k.x === x && k.y === y;
  }

  private damlalariCiz(c: Ctx): void {
    const gt = this.gt;
    const g = this.geo;
    const h = g.hucre;
    const nefes = !this.sec.hareketiAzalt;
    const zs = this.zaman / 1000;
    // Hedef nabzı (geçerli komşular hafifçe şişer, 1,5 Hz).
    const hedefNabiz = 1 + 0.06 * (0.5 + 0.5 * Math.sin(zs * TAU * 1.5));
    const ipucuNabiz = this.vurgu?.kip === 'ipucu' ? 1 + 0.07 * this.ipucuZarf() * (0.5 + 0.5 * Math.sin(this.vurgu.t * 0.001 * TAU * 1.5)) : 1;
    this.hedefNabiz = hedefNabiz;
    this.ipucuNabiz = ipucuNabiz;
    const olcekBul = this.olcekBulBagli;
    // 1. geçiş: haleler.
    for (let i = 0; i < gt.hucreler.length; i++) {
      const ic = gt.hucreler[i].icerik;
      if (!ic || ic.tur !== 'damla') continue;
      const d = ic.d;
      const x = i % gt.w;
      const y = (i - x) / gt.w;
      if (this.kaynakMi(x, y) && this.sur.parmak) continue;
      const s = this.spr.hale(d.renk);
      const { sx, sy } = damlaOlcegi(d);
      const k = (nefes ? 1 + 0.03 * Math.sin(zs * TAU * 0.3 + d.faz) : 1) * olcekBul(x, y);
      c.globalAlpha = damlaAlfasi(d) * (d.hTur === 4 ? 0.7 : 1);
      const px = this.mx(x) + d.ox * h;
      const py = this.my(y) + d.oy * h;
      c.drawImage(s.t, px - s.ox * sx * k, py - s.oy * sy * k, s.w * sx * k, s.h * sy * k);
    }
    for (const e of gt.ezilen) {
      const s = this.spr.hale(e.d.renk);
      c.globalAlpha = 0.6;
      c.drawImage(s.t, this.mx(e.hucre.x) - s.ox, this.my(e.hucre.y) - s.oy, s.w, s.h);
    }
    c.globalAlpha = 1;
    this.onizlemeAltCiz(c);
    // 2. geçiş: mermer ve damlalar.
    for (const e of gt.ezilen) this.damlaGovdesi(c, e.d, this.mx(e.hucre.x), this.my(e.hucre.y), 1, 1);
    for (let i = 0; i < gt.hucreler.length; i++) {
      const ic = gt.hucreler[i].icerik;
      if (!ic) continue;
      const x = i % gt.w;
      const y = (i - x) / gt.w;
      if (ic.tur === 'mermer') {
        const m = ic.m;
        const s = this.spr.mermer(m.cesit, m.can, Math.max(0, m.ilkCan - m.can));
        const t = m.hasar > 0 ? Math.sin((m.hasar / 220) * Math.PI * 6) * 2 * (m.hasar / 220) : 0;
        c.drawImage(s.t, this.mx(x) - s.ox + t, this.my(y) - s.oy, s.w, s.h);
        continue;
      }
      const d = ic.d;
      if (this.kaynakMi(x, y)) {
        this.kaynakCiz(c, d, x, y);
        continue;
      }
      const k = (nefes ? 1 + 0.02 * Math.sin(zs * TAU * 0.3 + d.faz) : 1) * olcekBul(x, y);
      this.damlaGovdesi(c, d, this.mx(x), this.my(y), k, damlaAlfasi(d));
    }
  }

  private hedefNabiz = 1;
  private ipucuNabiz = 1;
  /** Geçerli komşu nabzı ve ipucu nabzı (kapanış yok: kare başına ayırma olmasın). */
  private readonly olcekBulBagli = (x: number, y: number): number => {
    let s = 1;
    for (const k of this.sur.hedefler)
      if (k.x === x && k.y === y) {
        s *= this.hedefNabiz;
        break;
      }
    if (this.ipucuNabiz !== 1 && this.vurgu) for (const k of this.vurgu.hucreler) if (k.x === x && k.y === y) s *= this.ipucuNabiz;
    return s;
  };

  /** Damla gövdesi + özel taş katmanları + karışım girdabı (hücre merkezi cx, cy). */
  private damlaGovdesi(c: Ctx, d: GDamla, cx: number, cy: number, k: number, alfa: number, ekX = 1, ekY = 1): void {
    const h = this.geo.hucre;
    const { sx, sy } = damlaOlcegi(d);
    const titre = d.titre > 0 ? Math.sin((1 - d.titre / TITRE_MS) * Math.PI * 6) * 3 : 0;
    const x = cx + d.ox * h + titre;
    const y = cy + d.oy * h;
    const kx = sx * k * ekX;
    const ky = sy * k * ekY;
    const zs = this.zaman / 1000;
    c.globalAlpha = alfa;
    if (d.ozel === 'murekkep' || d.renk === 7) {
      // 1,2 Hz altın nabız.
      const p = 0.5 + 0.5 * Math.sin(zs * TAU * 1.2 + d.faz);
      const ah = this.efs.altinHale;
      const r = (h * (0.5 + 0.08 * p)) / 32;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = alfa * (0.18 + 0.22 * p);
      c.drawImage(ah.t, x - ah.ox * r, y - ah.oy * r, ah.w * r, ah.h * r);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = alfa;
    }
    const s = this.spr.govde(d.renk, d.ozel, d.yon);
    c.drawImage(s.t, x - s.ox * kx, y - s.oy * ky, s.w * kx, s.h * ky);
    if (d.karisim >= 0 && d.karisim < KARISIM_MS) this.karisimGirdabi(c, d, x, y, kx);
    this.ozelKatmanCiz(c, d, x, y, kx, ky);
    c.globalAlpha = 1;
  }

  /** Dönen özel taş katmanları: Girdap kolları (0,3 Hz), Lale filmi (0,15 Hz) ve silueti. */
  private ozelKatmanCiz(c: Ctx, d: GDamla, x: number, y: number, kx: number, ky: number): void {
    const zs = this.zaman / 1000;
    if (d.ozel === 'girdap') {
      const kol = this.spr.girdapKol();
      c.save();
      c.translate(x, y);
      c.rotate(zs * TAU * 0.3 * (this.sec.hareketiAzalt ? 0 : 1) + d.faz);
      c.scale(kx, ky);
      c.drawImage(kol.t, -kol.ox, -kol.oy, kol.w, kol.h);
      c.restore();
    } else if (d.ozel === 'lale') {
      const film = this.spr.laleFilm();
      c.save();
      c.translate(x, y);
      c.rotate(zs * TAU * 0.15 * (this.sec.hareketiAzalt ? 0 : 1) + d.faz);
      c.scale(kx, ky);
      c.drawImage(film.t, -film.ox, -film.oy, film.w, film.h);
      c.restore();
      const l = this.spr.laleSiluet();
      c.drawImage(l.t, x - l.ox * kx, y - l.oy * ky, l.w * kx, l.h * ky);
    }
  }

  /** Karışım: iki renk dönen konik gradyanla dolanır (220 ms), sonuç rengine çözülür. */
  private karisimGirdabi(c: Ctx, d: GDamla, x: number, y: number, k: number): void {
    const p = d.karisim / KARISIM_MS;
    const r = this.geo.hucre * 0.43 * k;
    const [a] = renkUclu(d.ka, this.sec.palet);
    const [b] = renkUclu(d.kb, this.sec.palet);
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.clip();
    c.globalAlpha = (1 - p) ** 0.8;
    const cc = c as Ctx & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
    const aci = p * Math.PI * 3;
    if (typeof cc.createConicGradient === 'function') {
      const g = cc.createConicGradient(aci, x, y);
      g.addColorStop(0, a);
      g.addColorStop(0.25, b);
      g.addColorStop(0.5, a);
      g.addColorStop(0.75, b);
      g.addColorStop(1, a);
      c.fillStyle = g;
      c.fillRect(x - r, y - r, 2 * r, 2 * r);
    } else {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? b : a;
        c.beginPath();
        c.moveTo(x, y);
        c.arc(x, y, r, aci + (i * TAU) / 4, aci + ((i + 1) * TAU) / 4);
        c.fill();
      }
    }
    // Girdap kolları (ince krem sarmal).
    c.strokeStyle = 'rgba(243,233,210,0.55)';
    c.lineWidth = Math.max(1, r * 0.08);
    for (let kk = 0; kk < 2; kk++) {
      c.beginPath();
      for (let i = 0; i <= 18; i++) {
        const u = i / 18;
        const an = aci * 1.4 + kk * Math.PI + u * 4;
        const rr = r * u * 0.9;
        if (i === 0) c.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
        else c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
      }
      c.stroke();
    }
    c.restore();
    c.globalAlpha = 1;
  }

  /** Parmaktaki damla: 1,08× kalkar; sürüklerken parmağa doğru 1,3 kata kadar uzar (metaball). */
  private kaynakCiz(c: Ctx, d: GDamla, x: number, y: number): void {
    const h = this.geo.hucre;
    const cx = this.mx(x);
    const cy = this.my(y);
    const kalk = 1 + 0.08 * outBack(Math.min(1, (this.zaman - this.sur.kalkis) / 90));
    // Altın kalkış parıltısı.
    const ah = this.efs.altinHale;
    const r = (h * 0.62) / 32;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.32;
    c.drawImage(ah.t, cx - ah.ox * r, cy - ah.oy * r, ah.w * r, ah.h * r);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const p = this.sur.parmak;
    if (!p) {
      const hl = this.spr.hale(d.renk);
      c.drawImage(hl.t, cx - hl.ox * kalk, cy - hl.oy * kalk, hl.w * kalk, hl.h * kalk);
      this.damlaGovdesi(c, d, cx, cy, kalk, 1);
      return;
    }
    let vx = p.x - cx;
    let vy = p.y - cy;
    const L = Math.hypot(vx, vy);
    const e = Math.min(1, L / (h * 0.9));
    if (L > 0.001) {
      vx /= L;
      vy /= L;
    }
    const [ana, acik, koyu] = renkUclu(d.renk, this.sec.palet);
    // Boyun: kaynaktan parmağa doğru incelen boya (iki daire + kavisli boyun).
    if (e > 0.05) {
      const r0 = h * 0.3;
      const tx = cx + vx * h * 0.62 * e;
      const ty = cy + vy * h * 0.62 * e;
      const r1 = h * (0.11 + 0.05 * (1 - e));
      const nx = -vy;
      const ny = vx;
      const g = c.createLinearGradient(cx, cy, tx, ty);
      g.addColorStop(0, ana);
      g.addColorStop(1, koyu);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(cx + nx * r0, cy + ny * r0);
      c.quadraticCurveTo((cx + tx) / 2 + nx * r1 * 0.6, (cy + ty) / 2 + ny * r1 * 0.6, tx + nx * r1, ty + ny * r1);
      c.arc(tx, ty, r1, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
      c.quadraticCurveTo((cx + tx) / 2 - nx * r1 * 0.6, (cy + ty) / 2 - ny * r1 * 0.6, cx - nx * r0, cy - ny * r0);
      c.closePath();
      c.fill();
      c.fillStyle = rgba(acik, 0.7);
      c.beginPath();
      c.arc(tx - vx * r1 * 0.2 - nx * r1 * 0.3, ty - vy * r1 * 0.2 - ny * r1 * 0.3, r1 * 0.35, 0, TAU);
      c.fill();
    }
    const ox = vx * h * 0.22 * e;
    const oy = vy * h * 0.22 * e;
    const hl = this.spr.hale(d.renk);
    c.drawImage(hl.t, cx + ox - hl.ox * kalk, cy + oy - hl.oy * kalk, hl.w * kalk, hl.h * kalk);
    // Gövde: sürükleme yönünde uzar (1 → 1,3), dikinde hafif daralır.
    const govde = this.spr.govde(d.renk, d.ozel, d.yon);
    c.save();
    c.translate(cx + ox, cy + oy);
    const aci = Math.atan2(vy, vx);
    c.rotate(aci);
    c.scale(kalk * (1 + 0.2 * e), kalk * (1 - 0.08 * e));
    c.rotate(-aci);
    c.drawImage(govde.t, -govde.ox, -govde.oy, govde.w, govde.h);
    c.restore();
    if (d.ozel === 'girdap' || d.ozel === 'lale') this.ozelKatmanCiz(c, d, cx + ox, cy + oy, kalk * (1 + 0.1 * e), kalk * (1 - 0.04 * e));
  }

  /** Önizlemenin damlaların ALTINDAKİ kısmı: eşleşecek grubun altın parıltısı (2 Hz). */
  private onizlemeAltCiz(c: Ctx): void {
    const s = this.sur;
    const o = s.onizleme;
    if (!s.kaynak || !o || !o.gecerli || !o.gruplar.length || !this.onizlemeHedefi(s)) return;
    const h = this.geo.hucre;
    const giris = Math.min(1, (this.zaman - s.giris) / 120);
    const nabiz = 0.5 + 0.5 * Math.sin((this.zaman / 1000) * TAU * 2);
    const ah = this.efs.altinHale;
    c.globalCompositeOperation = 'lighter';
    for (const gr of o.gruplar)
      for (const k of gr.hucreler) {
        const r = (h * (0.62 + 0.08 * nabiz)) / 32;
        c.globalAlpha = (0.45 + 0.35 * nabiz) * giris;
        c.drawImage(ah.t, this.mx(k.x) - ah.ox * r, this.my(k.y) - ah.oy * r, ah.w * r, ah.h * r);
      }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  private onizlemeCiz(c: Ctx): void {
    const s = this.sur;
    const g = this.geo;
    const h = g.hucre;
    const zs = this.zaman / 1000;
    // Geçerli komşular: hafif altın halka (K6: geçersizler hiç gösterilmez).
    if (s.kaynak) {
      c.strokeStyle = rgba(PALET.altinAcik, 0.35 + 0.2 * Math.sin(zs * TAU * 1.5));
      c.lineWidth = Math.max(1.2, h * 0.035);
      for (const k of s.hedefler) {
        c.beginPath();
        c.arc(this.mx(k.x), this.my(k.y), h * 0.47, 0, TAU);
        c.stroke();
      }
    }
    const o = s.onizleme;
    if (!s.kaynak || !o || !o.gecerli) return;
    const hedef = this.onizlemeHedefi(s);
    if (!hedef) return;
    const giris = Math.min(1, (this.zaman - s.giris) / 120);
    const nabiz = 0.5 + 0.5 * Math.sin(zs * TAU * 2);
    // Temizlenecek bütün hücreler (kaskat/özel dahil): soluk işaret alfa 0,35.
    c.strokeStyle = rgba(PALET.altinAcik, 0.35 * giris);
    c.lineWidth = Math.max(1, h * 0.03);
    c.setLineDash([h * 0.08, h * 0.06]);
    for (const k of o.temizlenecek) {
      if (this.maskeVar(k.x, k.y, 1)) continue;
      c.beginPath();
      c.arc(this.mx(k.x), this.my(k.y), h * 0.4, 0, TAU);
      c.stroke();
    }
    c.setLineDash([]);
    // Eşleşecek gruplar: altın kontur, 2 Hz nabız (parıltı damlaların altında, onizlemeAltCiz).
    c.strokeStyle = rgba(PALET.altinAcik, (0.6 + 0.4 * nabiz) * giris);
    c.lineWidth = Math.max(1.5, h * 0.05);
    for (const gr of o.gruplar)
      for (const k of gr.hucreler) {
        c.beginPath();
        c.arc(this.mx(k.x), this.my(k.y), h * (0.45 + 0.02 * nabiz), 0, TAU);
        c.stroke();
      }
    // Etki alanı: kesik altın çizgi (yürüyen).
    if (o.etkiAlani.length) this.alanCiz(c, o.etkiAlani, giris);
    // Kayacak sütun okları.
    if (o.sonuc !== null) this.okCiz(c, s.kaynak, hedef);
    // Sonuç hayaleti: hedef halkaları sonuç rengine döner, 1,1× şişer.
    const hx = this.mx(hedef.x);
    const hy = this.my(hedef.y);
    const kx = this.mx(s.kaynak.x);
    const ky = this.my(s.kaynak.y);
    if (o.sonuc !== null) {
      const gh = this.spr.halkaHayalet(o.sonuc);
      const k = 1 + 0.1 * outBack(giris);
      c.globalAlpha = 0.9 * giris;
      c.drawImage(gh.t, hx - gh.ox * k, hy - gh.oy * k, gh.w * k, gh.h * k);
      c.globalAlpha = 1;
      // İki damla yaklaşınca renkler girdap gibi karışır.
      const p = s.parmak;
      if (p) {
        const yak = sinirla01(1 - Math.hypot(p.x - hx, p.y - hy) / (h * 1.0));
        const ga = this.gt.damla(s.kaynak);
        const gb = this.gt.damla(hedef);
        if (yak > 0.02 && ga && gb) this.girdapKarisimCiz(c, kx + (hx - kx) * 0.58, ky + (hy - ky) * 0.58, h * (0.1 + 0.2 * yak), yak, ga.renk, gb.renk, o.sonuc);
      }
      if (o.sonucHucre && (o.sonucHucre.x !== hedef.x || o.sonucHucre.y !== hedef.y)) {
        const sx = this.mx(o.sonucHucre.x);
        const sy = this.my(o.sonucHucre.y);
        c.setLineDash([h * 0.07, h * 0.06]);
        c.strokeStyle = rgba(renkUclu(o.sonuc, this.sec.palet)[1], 0.7 * giris);
        c.lineWidth = Math.max(1.2, h * 0.035);
        c.beginPath();
        c.arc(sx, sy, h * 0.36, 0, TAU);
        c.stroke();
        c.setLineDash([]);
      }
    }
    // Özel taş hayaleti (alfa 0,6).
    if (o.ozelHayalet) {
      const oh = o.ozelHayalet;
      const s2 = this.spr.govde(oh.renk, oh.ozel, oh.yon);
      const x = this.mx(oh.hucre.x);
      const y = this.my(oh.hucre.y);
      const k = 0.9 + 0.06 * nabiz;
      c.globalAlpha = 0.6 * giris;
      c.drawImage(s2.t, x - s2.ox * k, y - s2.oy * k, s2.w * k, s2.h * k);
      if (oh.ozel === 'girdap') {
        const kol = this.spr.girdapKol();
        c.drawImage(kol.t, x - kol.ox * k, y - kol.oy * k, kol.w * k, kol.h * k);
      } else if (oh.ozel === 'lale') {
        const l = this.spr.laleSiluet();
        c.drawImage(l.t, x - l.ox * k, y - l.oy * k, l.w * k, l.h * k);
      }
      c.globalAlpha = 1;
    }
    // Birleşim adı.
    if (o.kombo) {
      const metin = KOMBO_ADLARI[o.kombo];
      const fs = Math.max(13, Math.min(17, h * 0.3));
      c.font = `800 ${fs}px ${GOVDE_FONT}`;
      const w = c.measureText(metin).width + 16;
      let x = hx - w / 2;
      x = Math.max(g.x + 2, Math.min(g.x + g.w * h - w - 2, x));
      const y = Math.max(g.y + 4, hy - h * 0.95);
      c.globalAlpha = giris;
      c.fillStyle = 'rgba(243,233,210,0.94)';
      yuvarlakDikdortgen(c, x, y - fs * 0.8, w, fs * 1.6, fs * 0.5);
      c.fill();
      c.strokeStyle = PALET.altin;
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = PALET.murekkep;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(metin, x + 8, y);
      c.globalAlpha = 1;
    }
  }

  /**
   * İki rengin girdap gibi karışması (sürüklerken, iki damla arasında):
   * iki boyanın dönen konik gradyanı + krem sarmal çizgiler, sonuç renginin
   * halesi; parmak hedefe yaklaştıkça büyür.
   */
  private girdapKarisimCiz(c: Ctx, x: number, y: number, R: number, k: number, a: Renk | 0, b: Renk | 0, sonuc: Renk): void {
    const zs = this.zaman / 1000;
    const hs = this.spr.hale(sonuc);
    const kk = (R * 2.6) / (this.geo.hucre * 0.66);
    c.globalAlpha = 0.7 * k;
    c.drawImage(hs.t, x - hs.ox * kk, y - hs.oy * kk, hs.w * kk, hs.h * kk);
    const [ra] = renkUclu(a, this.sec.palet);
    const [rb] = renkUclu(b, this.sec.palet);
    const [rs, rsAcik] = renkUclu(sonuc, this.sec.palet);
    const aci = zs * 4.2;
    c.save();
    c.beginPath();
    c.arc(x, y, R, 0, TAU);
    c.clip();
    c.globalAlpha = 0.95 * k;
    const cc = c as Ctx & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
    if (typeof cc.createConicGradient === 'function') {
      const g = cc.createConicGradient(aci, x, y);
      g.addColorStop(0, ra);
      g.addColorStop(0.2, rs);
      g.addColorStop(0.33, rb);
      g.addColorStop(0.53, rs);
      g.addColorStop(0.66, ra);
      g.addColorStop(0.86, rs);
      g.addColorStop(1, ra);
      c.fillStyle = g;
    } else c.fillStyle = rs;
    c.fillRect(x - R, y - R, 2 * R, 2 * R);
    // Ortada sonuç rengi açılıyor.
    const mg = c.createRadialGradient(x, y, 0, x, y, R);
    mg.addColorStop(0, rgba(rsAcik, 0.9 * k));
    mg.addColorStop(0.45, rgba(rs, 0.55 * k));
    mg.addColorStop(1, rgba(rs, 0));
    c.fillStyle = mg;
    c.fillRect(x - R, y - R, 2 * R, 2 * R);
    // Krem sarmal çizgiler (ebru'da bizle çekilmiş gibi).
    c.strokeStyle = 'rgba(243,233,210,0.7)';
    c.lineWidth = Math.max(1, R * 0.07);
    c.lineCap = 'round';
    for (let kol = 0; kol < 3; kol++) {
      c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const an = aci * 1.3 + (kol * TAU) / 3 + u * 3.6;
        const rr = R * (0.12 + 0.85 * u);
        if (i === 0) c.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
        else c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
      }
      c.stroke();
    }
    c.restore();
    c.strokeStyle = rgba(PALET.altinAcik, 0.6 * k);
    c.lineWidth = Math.max(1, R * 0.06);
    c.beginPath();
    c.arc(x, y, R, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
  }

  private maskeVar(x: number, y: number, bit: number): boolean {
    if (x < 0 || y < 0 || x >= this.gt.w || y >= this.gt.h) return false;
    return (this.maske[y * this.gt.w + x] & bit) !== 0;
  }

  private alanCiz(c: Ctx, alan: readonly Konum[], giris: number): void {
    const g = this.geo;
    const h = g.hucre;
    const var_ = (x: number, y: number) => this.maskeVar(x, y, 2);
    c.fillStyle = rgba(PALET.altin, 0.08 * giris);
    for (const k of alan) c.fillRect(g.x + k.x * h, g.y + k.y * h, h, h);
    c.setLineDash([h * 0.12, h * 0.08]);
    c.lineDashOffset = -this.zaman * 0.02;
    c.strokeStyle = rgba(PALET.altinAcik, 0.9 * giris);
    c.lineWidth = Math.max(1.5, h * 0.04);
    c.beginPath();
    for (const k of alan) {
      const x0 = g.x + k.x * h;
      const y0 = g.y + k.y * h;
      if (!var_(k.x, k.y - 1)) (c.moveTo(x0, y0), c.lineTo(x0 + h, y0));
      if (!var_(k.x, k.y + 1)) (c.moveTo(x0, y0 + h), c.lineTo(x0 + h, y0 + h));
      if (!var_(k.x - 1, k.y)) (c.moveTo(x0, y0), c.lineTo(x0, y0 + h));
      if (!var_(k.x + 1, k.y)) (c.moveTo(x0 + h, y0), c.lineTo(x0 + h, y0 + h));
    }
    c.stroke();
    c.setLineDash([]);
    c.lineDashOffset = 0;
  }

  /** Kayacak sütunda soluk aşağı oklar (alfa 0,35; öğretimde 0,7). */
  private okCiz(c: Ctx, kaynak: Konum, hedef: Konum): void {
    const gt = this.gt;
    const h = this.geo.hucre;
    const a = this.ogretim ? 0.7 : 0.35;
    const x = kaynak.x;
    // Yukarı sürüklemede sonuç boşalan kaynağa düşer: ok hedeften başlar.
    let y = hedef.y < kaynak.y ? hedef.y : kaynak.y - 1;
    const zs = this.zaman / 1000;
    const bob = Math.sin(zs * TAU * 1.2) * h * 0.04;
    c.strokeStyle = rgba(PALET.kagit, a);
    c.lineWidth = Math.max(1.5, h * 0.05);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    while (y >= 0) {
      const hc = gt.hucreler[y * gt.w + x];
      if (!hc || hc.delik || !hc.icerik || hc.icerik.tur !== 'damla') break;
      const px = this.mx(x);
      const py = this.my(y) + h * 0.5 + bob;
      c.beginPath();
      c.moveTo(px - h * 0.11, py - h * 0.07);
      c.lineTo(px, py + h * 0.04);
      c.lineTo(px + h * 0.11, py - h * 0.07);
      c.stroke();
      y--;
    }
  }

  private vurguCiz(c: Ctx): void {
    const v = this.vurgu!;
    const g = this.geo;
    const h = g.hucre;
    if (v.kip === 'zorunlu') {
      // Diğer damlalar %45 kararır; zorunlu hücreler açıkta.
      c.fillStyle = 'rgba(3,12,16,0.45)';
      c.beginPath();
      c.rect(g.x - 4, g.y - 4, g.w * h + 8, g.h * h + 8);
      for (const k of v.hucreler) {
        const x = this.mx(k.x);
        const y = this.my(k.y);
        c.moveTo(x + h * 0.52, y);
        c.arc(x, y, h * 0.52, 0, TAU, true);
      }
      c.fill('evenodd');
      const p = 0.5 + 0.5 * Math.sin(v.t * 0.001 * TAU * 1.5);
      c.strokeStyle = rgba(PALET.altinAcik, 0.5 + 0.4 * p);
      c.lineWidth = Math.max(1.5, h * 0.045);
      for (const k of v.hucreler) {
        c.beginPath();
        c.arc(this.mx(k.x), this.my(k.y), h * (0.49 + 0.02 * p), 0, TAU);
        c.stroke();
      }
    } else if (v.hucreler.length >= 2) {
      // İpucu: iki damla nabız (damlalariCiz'de) + aralarında hayalet ok.
      const a = v.hucreler[0];
      const b = v.hucreler[1];
      const p = 0.5 + 0.5 * Math.sin(v.t * 0.001 * TAU * 1.5);
      this.okYayi(c, this.mx(a.x), this.my(a.y), this.mx(b.x), this.my(b.y), (0.35 + 0.35 * p) * this.ipucuZarf());
    }
  }

  /** Kavisli hayalet ok (a → b). */
  private okYayi(c: Ctx, ax: number, ay: number, bx: number, by: number, alfa: number): void {
    const h = this.geo.hucre;
    const nx = -(by - ay);
    const ny = bx - ax;
    const L = Math.hypot(nx, ny) || 1;
    const kx = (ax + bx) / 2 + (nx / L) * h * 0.28;
    const ky = (ay + by) / 2 + (ny / L) * h * 0.28;
    const sx = bezier2(ax, kx, bx, 0.18);
    const sy = bezier2(ay, ky, by, 0.18);
    const ex = bezier2(ax, kx, bx, 0.82);
    const ey = bezier2(ay, ky, by, 0.82);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [renk, gen] of [
      ['rgba(20,14,8,', h * 0.13],
      ['rgba(243,233,210,', h * 0.07],
    ] as const) {
      c.strokeStyle = `${renk}${alfa.toFixed(3)})`;
      c.lineWidth = gen;
      c.beginPath();
      c.moveTo(sx, sy);
      c.quadraticCurveTo(kx, ky, ex, ey);
      c.stroke();
      const an = Math.atan2(ey - bezier2(ay, ky, by, 0.7), ex - bezier2(ax, kx, bx, 0.7));
      c.beginPath();
      c.moveTo(ex + Math.cos(an + 2.5) * h * 0.18, ey + Math.sin(an + 2.5) * h * 0.18);
      c.lineTo(ex, ey);
      c.lineTo(ex + Math.cos(an - 2.5) * h * 0.18, ey + Math.sin(an - 2.5) * h * 0.18);
      c.stroke();
    }
  }

  private hayaletCiz(c: Ctx): void {
    const hy = this.hayalet!;
    const h = this.geo.hucre;
    const ax = this.mx(hy.h.kaynak.x);
    const ay = this.my(hy.h.kaynak.y);
    const bx = this.mx(hy.h.hedef.x);
    const by = this.my(hy.h.hedef.y);
    const t = (hy.t % 1600) / 1600;
    const u = inOutCubic(Math.min(1, t / 0.55));
    const a = t < 0.75 ? 0.6 : 0.6 * (1 - (t - 0.75) / 0.25);
    const d = this.gt.damla(hy.h.kaynak);
    this.okYayi(c, ax, ay, bx, by, 0.55);
    if (d) {
      const s = this.spr.govde(d.renk, d.ozel, d.yon);
      c.globalAlpha = a;
      const k = 1.05;
      c.drawImage(s.t, ax + (bx - ax) * u - s.ox * k, ay + (by - ay) * u - s.oy * k, s.w * k, s.h * k);
      c.globalAlpha = 1;
    }
    c.strokeStyle = rgba(PALET.altinAcik, 0.8);
    c.lineWidth = Math.max(1.5, h * 0.04);
    c.beginPath();
    c.arc(bx, by, h * 0.48, 0, TAU);
    c.stroke();
  }

  private imlecCiz(c: Ctx): void {
    const k = this.imlec!;
    const h = this.geo.hucre;
    const x = this.geo.x + k.x * h;
    const y = this.geo.y + k.y * h;
    const p = 0.5 + 0.5 * Math.sin((this.zaman / 1000) * TAU * 1.2);
    c.strokeStyle = 'rgba(10,8,4,0.6)';
    c.lineWidth = 5;
    yuvarlakDikdortgen(c, x + 2, y + 2, h - 4, h - 4, h * 0.18);
    c.stroke();
    c.strokeStyle = rgba(PALET.altinAcik, 0.75 + 0.25 * p);
    c.lineWidth = 3;
    yuvarlakDikdortgen(c, x + 2, y + 2, h - 4, h - 4, h * 0.18);
    c.stroke();
  }

  private elSpriteAl(): Sprite {
    const h = this.geo.hucre;
    if (!this.elSprite) this.elSprite = elSpriteUret(Math.max(48, h * 1.25), this.spriteDpr());
    return this.elSprite;
  }

  /** Öğretici saydam el: yol boyunca sürükler, döngüde (2,2 sn). */
  private elCiz(c: Ctx): void {
    const el = this.el!;
    const yol = el.yol;
    const s = this.elSpriteAl();
    const T = 2300;
    const t = el.t % T;
    const nokta = (u: number): { x: number; y: number } => {
      if (yol.length === 1) return { x: this.mx(yol[0].x), y: this.my(yol[0].y) };
      const n = yol.length - 1;
      const f = Math.min(n - 1e-6, u * n);
      const i = Math.floor(f);
      const r = f - i;
      return { x: this.mx(yol[i].x) + (this.mx(yol[i + 1].x) - this.mx(yol[i].x)) * r, y: this.my(yol[i].y) + (this.my(yol[i + 1].y) - this.my(yol[i].y)) * r };
    };
    let u = 0;
    let alfa = 1;
    let bas = 1;
    if (t < 250) alfa = t / 250;
    else if (t < 420) bas = 1 - 0.1 * outCubic((t - 250) / 170);
    else if (t < 1250) {
      bas = 0.9;
      u = inOutCubic((t - 420) / 830);
    } else if (t < 1450) {
      u = 1;
      bas = 0.9 + 0.1 * outCubic((t - 1250) / 200);
    } else if (t < 1750) {
      u = 1;
      alfa = 1 - (t - 1450) / 300;
    } else {
      u = 1;
      alfa = 0;
    }
    if (alfa <= 0.01) return;
    const p = nokta(u);
    // Basılı iken parmak ucunda su halkası.
    if (t >= 300 && t < 1300) {
      const h = this.geo.hucre;
      c.strokeStyle = `rgba(243,233,210,${(0.35 * alfa).toFixed(3)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, h * (0.22 + 0.06 * Math.sin(t * 0.012)), 0, TAU);
      c.stroke();
      // İz.
      const p0 = nokta(0);
      c.setLineDash([4, 6]);
      c.strokeStyle = `rgba(243,233,210,${(0.3 * alfa).toFixed(3)})`;
      c.beginPath();
      c.moveTo(p0.x, p0.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      c.setLineDash([]);
    }
    c.globalAlpha = 0.88 * alfa;
    c.drawImage(s.t, p.x - s.ox * bas, p.y - s.oy * bas, s.w * bas, s.h * bas);
    c.globalAlpha = 1;
  }
}

/** Sözleşme dışı yardımcı: parçacık havuzu boyu (test). */
export const PARCACIK_HAVUZU = HAVUZ;
export { karma01, spriteUret };
