/**
 * Bölüm içi döngü (GDD §3, §8, §9.5, §12): girdi → önizleme → hamle →
 * oynatma (dokununca 2×) → HUD → bitti mi. Öğretim (zorunlu ilk hamle, el,
 * Usta balonu), boşta ipucu (`olumluHamleler`), kazançta Ebru Şöleni +
 * kâğıt çekme + kazandın ekranı, kayıpta yakın kaçış + "Bu hamle
 * kazandırırdı" hayaleti + Usta'nın Eli.
 *
 * Çizici yalnız olaylarla görsel tahtasını günceller; HUD sayaçları
 * olay anında (`olay`), oynatma sonunda durumdan eşitlenir. Asenkron
 * akışlar `nesil` ile iptal edilir (yeni bölüm/test kancası).
 */
import {
  bolumuYukle,
  ebruSoleni,
  gecerliHamleVar,
  gecerliHedefler,
  hamleHatasi,
  hamleUygula,
  ilerlemeYuzdesi,
  olumluHamleler,
  onizle,
  ustaEliUygula,
  yildizHesapla,
  type BolumVerisi,
  type Hamle,
  type HamleHatasi,
  type Konum,
  type Olay,
  type OyunDurumu,
} from '../core/index';
import { acemiSec, botTohumuTuret, kazandiranBul, ustaSec, zorunluHamle } from '../bot/index';
import type { OyunCiziciTam } from '../render/oyunCizici';
import type { TabloCiziciTam } from '../render/tablo';
import type { SesMotoruAyrintili } from '../audio/sesMotoru';
import type { SurukleGirdiTam } from '../input/surukle';
import { titresimDeseni } from '../input/titresim';
import type { Stage } from '../render/stage';
import type { Arayuz, HedefVM, HudVM, KaybettinKontrol } from '../ui/arayuz';
import { yerlesimHesapla, type Yerlesim } from '../ui/yerlesim';
import { eksikMetni, hataMetni, M } from '../ui/metinler';
import { ATOLYELER, TARIFLER, tabloTohumu } from './katalog';
import type { TabloIstegi } from './sozlesme';
import { balonGoruldu, bolumBitti, bolumKaydi, gunlukKodla, tabloSakla, ustaEliOnerilir, type TabloKaydi } from '../meta/index';
import type { Kayitci } from './kayitci';
import { bolumBul, SON_BOLUM } from '../levels/index';
import { tabloIstegi } from './tablolar';

export type OturumSonucu = { tur: 'kazanc'; secim: 'devam' | 'tekrar' } | { tur: 'kayip'; secim: 'tekrar' | 'harita' } | { tur: 'cik' } | { tur: 'yeniden' };

export interface OturumBaglam {
  stage: Stage;
  cizici: OyunCiziciTam;
  ses: SesMotoruAyrintili;
  ui: Arayuz;
  girdi: SurukleGirdiTam;
  tablo: TabloCiziciTam;
  kayitci: Kayitci;
  titret(p: number | number[]): void;
  /** Ekran adı (test kancası). */
  ekran(ad: string): void;
  bekle(ms: number): Promise<void>;
  ayarlarAc(): Promise<void>;
  hareketiAzalt(): boolean;
}

type Durum = 'kapali' | 'bekliyor' | 'oynatiyor' | 'bitti';

const esit = (a: Konum, b: Konum): boolean => a.x === b.x && a.y === b.y;

export class Oturum {
  durum: Durum = 'kapali';
  d: OyunDurumu | null = null;
  v: BolumVerisi | null = null;
  denemeNo = 0;
  duraklatildi = false;
  /** Son yerleşim (kaybettin ekranı da kullanır). */
  yer: Yerlesim | null = null;
  private coz: ((s: OturumSonucu) => void) | null = null;
  private nesil = 0;
  private surHedefler: Konum[] = [];
  private surAnahtar = '';
  private zorunlu: Hamle | null = null;
  private oncekiDurum: OyunDurumu | null = null;
  private eslestiT: number | null = null;
  private ozelOlustu = false;
  private hataGosterildi = new Set<HamleHatasi>();
  private bostaZ: ReturnType<typeof setTimeout> | null = null;
  private ipucuZ: ReturnType<typeof setTimeout> | null = null;
  private elZ: ReturnType<typeof setTimeout> | null = null;
  private bostaBalonu = false;

  constructor(private readonly b: OturumBaglam) {}

  // ─── Yaşam döngüsü ─────────────────────────────────────────────────

  baslat(v: BolumVerisi, denemeNo: number): Promise<OturumSonucu> {
    this.iptal();
    this.nesil++;
    const b = this.b;
    this.v = v;
    this.denemeNo = denemeNo;
    const d = bolumuYukle(v, denemeNo);
    this.d = d;
    this.oncekiDurum = null;
    this.eslestiT = null;
    this.hataGosterildi.clear();
    this.bostaBalonu = false;
    this.duraklatildi = false;
    b.cizici.bolumKur(d, v);
    b.cizici.karart(0);
    b.cizici.kagitKaldir();
    b.cizici.ogretimKipi(v.tur === 'ogretim');
    b.girdi.sifirla();
    b.ses.tahtaBoyutu(v.w, v.h);
    b.ses.ortam(b.kayitci.kayit.ayarlar.ortam, v.atolye);
    b.ui.hudKur(this.hudVM(), this.yerlesimHesapla());
    this.yerlesimUygula();
    this.durum = 'bekliyor';
    b.girdi.kipAyarla('acik');
    this.zorunlu = zorunluHamle(v, d);
    b.girdi.zorunluAyarla(this.zorunlu);
    b.ekran('oyun');
    const p = new Promise<OturumSonucu>((r) => (this.coz = r));
    // Balon ve el: yerleşim oturduktan sonra (geometri doğru).
    const n = this.nesil;
    requestAnimationFrame(() => {
      if (n === this.nesil) this.baslangicOgretimi();
    });
    this.bostaKur();
    return p;
  }

  /** Oturumu sessizce kapat (yeni bölüm, test kancası); bekleyen söz 'cik' ile çözülür. */
  iptal(): void {
    if (this.durum === 'kapali' && !this.coz) return;
    this.nesil++;
    this.temizle();
    this.durum = 'kapali';
    const c = this.coz;
    this.coz = null;
    c?.({ tur: 'cik' });
  }

  private temizle(): void {
    const b = this.b;
    this.bostaDurdur();
    this.ipucuKapat();
    if (this.elZ) clearTimeout(this.elZ);
    this.elZ = null;
    b.girdi.kipAyarla('kapali');
    b.girdi.zorunluAyarla(null);
    b.girdi.sifirla();
    b.cizici.surukleGoster({ kaynak: null, parmak: null, hedefler: [], onizleme: null });
    b.cizici.vurgula(null, 'zorunlu');
    b.cizici.elGoster(null);
    b.cizici.hayaletHamle(null);
    b.cizici.imlecGoster(null);
    b.ui.balonKapat();
    b.ui.hud.nabiz(null);
  }

  private bitir(s: OturumSonucu): void {
    this.temizle();
    this.durum = 'kapali';
    const c = this.coz;
    this.coz = null;
    c?.(s);
  }

  /** Girdi bu durumu görür (oynatma/duraklat/bitiş sırasında null). */
  girdiDurumu(): OyunDurumu | null {
    return this.durum === 'bekliyor' && !this.duraklatildi ? this.d : null;
  }

  olayGecerli(): boolean {
    return this.durum !== 'kapali';
  }

  aktifBolum(): number | null {
    return this.durum === 'kapali' ? null : (this.v?.id ?? null);
  }

  // ─── Yerleşim ──────────────────────────────────────────────────────

  private tarifler(): { a: 1 | 2 | 4; b: 1 | 2 | 4; sonuc: 3 | 5 | 6 }[] {
    const v = this.v!;
    const var_ = new Set<number>();
    const sira = [1, 2, 4];
    sira.forEach((r, i) => v.dogum[i] > 0 && var_.add(r));
    for (const s of v.duzen) for (const t of s.split(/\s+/)) if (t === '1' || t === '2' || t === '4') var_.add(Number(t));
    return TARIFLER.filter((t) => var_.has(t.a) && var_.has(t.b)) as { a: 1 | 2 | 4; b: 1 | 2 | 4; sonuc: 3 | 5 | 6 }[];
  }

  private yerlesimHesapla(): Yerlesim {
    const b = this.b;
    const v = this.v!;
    this.yer = yerlesimHesapla(b.stage.width || 390, b.stage.height || 844, b.ui.guvenliAlan(), v.w, v.h, this.tarifler().length > 0);
    return this.yer;
  }

  /** Boyut değişti ya da HUD kuruldu: tahta alanı, HUD, hedef kartı konumları. */
  yerlesimUygula(): void {
    if (!this.v || this.durum === 'kapali' && !this.coz) return;
    const b = this.b;
    const y = this.yerlesimHesapla();
    b.cizici.alanAyarla(y.tahta);
    b.ui.hud.yerlestir(y);
    requestAnimationFrame(() => b.cizici.hedefKonumlari(b.ui.hud.kartMerkezleri()));
  }

  private hedefVM(i: number, d: OyunDurumu): HedefVM {
    const h = d.hedefler[i];
    const t = h.hedef;
    return { tur: t.tur, renk: t.tur === 'topla' ? t.renk : undefined, motif: t.tur === 'desen' ? t.motif : undefined, gerekli: h.gerekli, ilerleme: h.ilerleme, tamam: h.tamam };
  }

  private hudVM(): HudVM {
    const v = this.v!;
    const d = this.d!;
    const a = ATOLYELER.find((x) => x.id === v.atolye) ?? ATOLYELER[0];
    const ayar = this.b.kayitci.kayit.ayarlar;
    return {
      bolumId: v.id,
      ad: v.ad,
      atolyeAd: a.ad,
      hedefler: d.hedefler.map((_, i) => this.hedefVM(i, d)),
      kalanHamle: d.kalanHamle,
      puan: d.puan,
      esikler: v.yildizEsikleri,
      tarifler: this.tarifler(),
      tarifAcik: v.id <= 5 || ayar.tarifSeridi === 'her',
    };
  }

  // ─── Öğretim ve balonlar ───────────────────────────────────────────

  private ipucu(tetik: string): { metin: string; el?: [number, number][] } | null {
    return this.v?.ipuclari?.find((i) => i.tetik === tetik) ?? null;
  }

  /** Öğretim bölümünde her seferinde; tanıtım balonları yalnız ilk kez (kayıtta). */
  private balonGoster(tetik: string, metin: string, sure = 4200): void {
    const v = this.v!;
    const anahtar = `${v.id}:${tetik}`;
    const kayit = this.b.kayitci.kayit;
    if (v.tur !== 'ogretim' && kayit.ogretim.gorulenBalonlar.includes(anahtar)) return;
    this.b.ui.balon(metin, this.b.cizici.geometri(), sure);
    this.b.kayitci.guncelle((k) => balonGoruldu(k, anahtar));
  }

  private elGosterSureli(yol: Konum[], ms = 4600): void {
    if (this.elZ) clearTimeout(this.elZ);
    this.b.cizici.elGoster(yol);
    const n = this.nesil;
    this.elZ = setTimeout(() => {
      if (n === this.nesil && !this.zorunlu) this.b.cizici.elGoster(null);
    }, ms);
  }

  private baslangicOgretimi(): void {
    const b = this.b;
    const ip = this.ipucu('baslangic');
    if (this.zorunlu) {
      const z = this.zorunlu;
      b.cizici.vurgula([z.kaynak, z.hedef], 'zorunlu');
      b.cizici.elGoster([z.kaynak, z.hedef]);
      if (ip) b.ui.balon(ip.metin, b.cizici.geometri(), 0);
      return;
    }
    if (!ip) return;
    const v = this.v!;
    const anahtar = `${v.id}:baslangic`;
    if (v.tur !== 'ogretim' && b.kayitci.kayit.ogretim.gorulenBalonlar.includes(anahtar)) return;
    this.balonGoster('baslangic', ip.metin, 5200);
    if (ip.el && ip.el.length >= 2) {
      const yol = ip.el.map(([x, y]) => ({ x, y }));
      if (!hamleHatasi(this.d!, { tur: 'surukle', kaynak: yol[0], hedef: yol[1] })) this.elGosterSureli(yol);
    }
  }

  private ilkHamleSonrasi(): void {
    const ip = this.ipucu('ilkHamleSonrasi');
    if (!ip) return;
    this.balonGoster('ilkHamleSonrasi', ip.metin);
    if (ip.el && ip.el.length >= 2) {
      const yol = ip.el.map(([x, y]) => ({ x, y }));
      if (!hamleHatasi(this.d!, { tur: 'surukle', kaynak: yol[0], hedef: yol[1] })) this.elGosterSureli(yol);
    }
  }

  private ozelOlusunca(): void {
    const ip = this.ipucu('ozelOlusunca');
    if (!ip) return;
    this.balonGoster('ozelOlusunca', ip.metin);
    const d = this.d!;
    // El: özel taştan geçerli bir komşuya (ilk bulunan).
    for (let i = 0; i < d.hucreler.length; i++) {
      const c = d.hucreler[i].icerik;
      if (!c || c.tur !== 'damla' || c.damla.ozel === 'yok' || c.damla.ozel === 'murekkep') continue;
      const k = { x: i % d.w, y: Math.floor(i / d.w) };
      const t = gecerliHedefler(d, k);
      if (t.length) {
        const sag = t.find((x) => x.x === k.x + 1 && x.y === k.y) ?? t[0];
        this.elGosterSureli([k, sag], 6800);
        break;
      }
    }
  }

  private hataBalonu(h: HamleHatasi): void {
    const v = this.v!;
    if (this.hataGosterildi.has(h)) return;
    const m = hataMetni(h);
    if (!m) return;
    if (v.tur !== 'ogretim' && this.b.kayitci.kayit.ogretim.gorulenBalonlar.includes(`hata:${h}`)) return;
    this.hataGosterildi.add(h);
    this.b.ui.balon(m, this.b.cizici.geometri(), 2600);
    this.b.kayitci.guncelle((k) => balonGoruldu(k, `hata:${h}`));
  }

  // ─── Boşta ipucu (§12.4) ───────────────────────────────────────────

  private bostaDurdur(): void {
    if (this.bostaZ) clearTimeout(this.bostaZ);
    this.bostaZ = null;
  }

  private ipucuKapat(): void {
    if (this.ipucuZ) clearTimeout(this.ipucuZ);
    this.ipucuZ = null;
    this.b.cizici.vurgula(null, 'ipucu');
  }

  bostaKur(): void {
    this.bostaDurdur();
    if (this.durum !== 'bekliyor' || this.zorunlu || this.duraklatildi) return;
    const v = this.v!;
    const ogretim = v.tur === 'ogretim';
    if (!ogretim && !this.b.kayitci.kayit.ayarlar.ipuclari) return;
    const n = this.nesil;
    this.bostaZ = setTimeout(() => {
      if (n === this.nesil) this.ipucuGoster();
    }, ogretim ? 3000 : 5000);
  }

  private ipucuGoster(): void {
    if (this.durum !== 'bekliyor' || !this.d || this.duraklatildi) return;
    const l = olumluHamleler(this.d);
    if (!l.length) return;
    const h = l[0].hamle;
    this.b.cizici.vurgula([h.kaynak, h.hedef], 'ipucu');
    if (!this.bostaBalonu) {
      this.bostaBalonu = true;
      const ip = this.ipucu('bosta5sn');
      if (ip) this.balonGoster('bosta5sn', ip.metin, 3000);
    }
    const n = this.nesil;
    this.ipucuZ = setTimeout(() => {
      if (n !== this.nesil) return;
      this.b.cizici.vurgula(null, 'ipucu');
      this.bostaKur();
    }, 2500);
  }

  // ─── Girdi geri çağırımları ────────────────────────────────────────

  basladi(k: Konum): void {
    if (this.durum !== 'bekliyor' || !this.d || this.duraklatildi) return;
    const b = this.b;
    b.ses.tutuldu();
    this.ipucuKapat();
    this.bostaKur();
    let hedefler = gecerliHedefler(this.d, k);
    if (this.zorunlu) hedefler = esit(k, this.zorunlu.kaynak) ? hedefler.filter((t) => esit(t, this.zorunlu!.hedef)) : [];
    this.surHedefler = hedefler;
    this.surAnahtar = '';
    b.cizici.surukleGoster({ kaynak: k, parmak: null, hedefler, onizleme: null });
  }

  surukleniyor(k: Konum, h: Konum | null, p: { x: number; y: number }): void {
    if (this.durum !== 'bekliyor' || !this.d) return;
    const b = this.b;
    let on = h && this.surHedefler.some((t) => esit(t, h)) ? onizle(this.d, { tur: 'surukle', kaynak: k, hedef: h }) : null;
    if (on && !on.gecerli) on = null;
    b.cizici.surukleGoster({ kaynak: k, parmak: p, hedefler: this.surHedefler, onizleme: on });
    const a = on && h ? `${h.x},${h.y}` : '';
    if (a !== this.surAnahtar) {
      this.surAnahtar = a;
      if (on) b.ses.hedefeGirdi(on.sonuc);
      b.ui.hud.nabiz(on ? on.hedefArtisi : null);
    }
  }

  birakildi(h: Hamle): void {
    this.surukleTemizle();
    void this.hamleYap(h);
  }

  iptalGirdi(): void {
    this.surukleTemizle();
  }

  private surukleTemizle(): void {
    this.surHedefler = [];
    this.surAnahtar = '';
    this.b.cizici.surukleGoster({ kaynak: null, parmak: null, hedefler: [], onizleme: null });
    this.b.ui.hud.nabiz(null);
  }

  dokunuldu(): void {
    if (this.durum === 'oynatiyor') this.b.cizici.hizlandir(2);
    if (this.durum === 'bekliyor') this.bostaKur();
  }

  kisitliBasildi(k: Konum): void {
    const b = this.b;
    b.cizici.titret(k);
    b.ses.gecersiz();
    const ip = this.ipucu('baslangic');
    if (this.zorunlu && ip && !b.ui.balonAcik) b.ui.balon(ip.metin, b.cizici.geometri(), 0);
  }

  imlecDegisti(k: Konum | null): void {
    this.b.cizici.imlecGoster(k);
  }

  // ─── Hamle ─────────────────────────────────────────────────────────

  async hamleYap(h: Hamle): Promise<boolean> {
    if (this.durum !== 'bekliyor' || !this.d || !this.v || this.duraklatildi) return false;
    const b = this.b;
    const hata = hamleHatasi(this.d, h);
    if (hata) {
      b.cizici.titret(h.kaynak);
      b.ses.gecersiz();
      this.hataBalonu(hata);
      return false;
    }
    const n = this.nesil;
    this.durum = 'oynatiyor';
    b.girdi.kipAyarla('kapali');
    this.ipucuKapat();
    this.bostaDurdur();
    const ilk = this.d.hamleNo === 0;
    if (this.zorunlu) {
      this.zorunlu = null;
      b.girdi.zorunluAyarla(null);
      b.cizici.vurgula(null, 'zorunlu');
      b.ui.balonKapat();
    }
    if (this.elZ) clearTimeout(this.elZ);
    b.cizici.elGoster(null);
    const once = this.d;
    const r = hamleUygula(once, h);
    this.oncekiDurum = once;
    this.d = r.durum;
    this.eslestiT = null;
    this.ozelOlustu = false;
    b.ui.hud.hamle(this.d.kalanHamle);
    if (this.d.kalanHamle === 3 && !this.d.bitti) b.ses.arayuz('sonHamle');
    await b.cizici.oynat(once, r.olaylar, this.d);
    if (n !== this.nesil) return true;
    const d = this.d;
    b.ui.hud.puan(d.puan);
    b.ui.hud.hedefleriEsitle(d.hedefler);
    if (d.bitti === 'kazanc') {
      void this.kazanc(n);
      return true;
    }
    if (d.bitti === 'kayip') {
      void this.kayip(n, false);
      return true;
    }
    if (!gecerliHamleVar(d)) {
      // Ölü tahta (son çare de bulunamadı): kayıp say, yeniden dene sun.
      void this.kayip(n, true);
      return true;
    }
    if (ilk) this.ilkHamleSonrasi();
    if (this.ozelOlustu) this.ozelOlusunca();
    this.durum = 'bekliyor';
    b.girdi.kipAyarla('acik');
    this.bostaKur();
    return true;
  }

  /** Çizici olayı (oynatma anında): HUD sayaçları, titreşim. */
  olay(o: Olay): void {
    if (this.durum === 'kapali') return;
    const hud = this.b.ui.hud;
    switch (o.tur) {
      case 'hedefIlerledi':
        hud.hedef(o.indeks, o.deger, o.tamam);
        if (o.tamam) this.b.ses.arayuz('hedefTamam');
        break;
      case 'temizlendi':
        if (o.puan) hud.puanEkle(o.puan);
        break;
      case 'puanEklendi':
        if (o.miktar) hud.puanEkle(o.miktar);
        break;
      case 'ozelOlustu':
        this.ozelOlustu = true;
        break;
    }
    const p = titresimDeseni(o, this.eslestiT);
    if (o.tur === 'eslesti') this.eslestiT = o.t;
    if (p) this.b.titret(p);
  }

  // ─── Duraklat ──────────────────────────────────────────────────────

  async duraklat(): Promise<void> {
    if (this.durum === 'kapali' || this.durum === 'bitti' || this.duraklatildi) return;
    const b = this.b;
    const n = this.nesil;
    this.duraklatildi = true;
    this.bostaDurdur();
    this.ipucuKapat();
    this.surukleTemizle();
    b.girdi.sifirla();
    b.ekran('duraklat');
    const s = await b.ui.duraklat(`${ATOLYELER.find((a) => a.id === this.v!.atolye)?.ad ?? ''} · Bölüm ${this.v!.id}`);
    if (n !== this.nesil) return;
    b.ekran('oyun');
    if (s === 'ayarlar') {
      await b.ayarlarAc();
      if (n !== this.nesil) return;
    }
    if (s === 'yeniden') return this.bitir({ tur: 'yeniden' });
    if (s === 'harita') return this.bitir({ tur: 'cik' });
    this.duraklatildi = false;
    if (this.durum === 'bekliyor') {
      b.girdi.kipAyarla('acik');
      this.bostaKur();
    }
  }

  // ─── Test kancası ──────────────────────────────────────────────────

  async botHamle(tur: 'usta' | 'acemi'): Promise<boolean> {
    if (this.durum !== 'bekliyor' || !this.d || !this.v || this.duraklatildi) return false;
    const izin = zorunluHamle(this.v, this.d);
    const tohum = botTohumuTuret(this.denemeNo);
    const h = tur === 'acemi' ? acemiSec(this.d, tohum, { izin }) : ustaSec(this.d, tohum, { izin });
    return this.hamleYap(h);
  }

  ogretimDurumu(): { zorunlu: Hamle | null; el: [number, number][] | null; balon: boolean } {
    const z = this.zorunlu;
    return { zorunlu: z, el: z ? [[z.kaynak.x, z.kaynak.y], [z.hedef.x, z.hedef.y]] : null, balon: this.b.ui.balonAcik };
  }

  // ─── Kazanç (§8.3, §9.5, §12.3 #6) ─────────────────────────────────

  private async kazanc(n: number): Promise<void> {
    const b = this.b;
    const v = this.v!;
    this.durum = 'bitti';
    b.girdi.kipAyarla('kapali');
    b.ui.balonKapat();
    await b.bekle(360);
    if (n !== this.nesil) return;
    let d = this.d!;
    if (!d.solenYapildi) {
      const s = ebruSoleni(d);
      const once = d;
      d = s.durum;
      this.d = d;
      const p = b.cizici.oynat(once, s.olaylar, d);
      if (d.kalanHamle === 0 && once.kalanHamle > 4) b.cizici.hizlandir(1.6);
      await p;
      if (n !== this.nesil) return;
      b.ui.hud.puan(d.puan);
      await b.bekle(260);
      if (n !== this.nesil) return;
    }
    const yildiz = yildizHesapla(d, v);
    const istek = this.tabloIstegiKur(d, yildiz);
    b.ui.hud.goster(false);
    b.ekran('kagitCekme');
    b.ses.arayuz('kagitCek');
    const parca = b.tablo.tabloCizParcali(istek);
    const cek = b.cizici.kagitCek(null);
    void parca.then((r) => {
      if (n === this.nesil) b.cizici.kagitTablo(r.tuval);
    });
    const [r] = await Promise.all([parca, cek]);
    if (n !== this.nesil) return;
    const kayitOnce = b.kayitci.kayit;
    const eski = bolumKaydi(kayitOnce, v.id).tablo;
    const yeniTablo: TabloKaydi = { tohum: istek.tohum, gunluk: gunlukKodla(d.gunluk), nadirlik: r.nadirlik, teknikler: [...r.teknikler], yildiz, puan: d.puan };
    if (istek.motif) yeniTablo.motif = istek.motif;
    b.kayitci.guncelle((k) => bolumBitti(k, { id: v.id, kazanc: true, puan: d.puan, yildiz, kaskat: d.istatistik.enUzunKaskat, lale: d.istatistik.lale, tablo: yeniTablo }), true);
    b.ses.arayuz('kazandin');
    const a = ATOLYELER.find((x) => x.id === v.atolye) ?? ATOLYELER[0];
    const sonraki = v.id < SON_BOLUM ? bolumBul(v.id + 1) : undefined;
    const H = b.stage.height;
    const g = b.ui.guvenliAlan();
    b.ekran('kazandin');
    const secim = await b.ui.kazandin(
      {
        ad: v.ad,
        atolyeAd: a.ad,
        bolumId: v.id,
        puan: d.puan,
        yildiz,
        nadirlik: r.nadirlik,
        teknikler: r.teknikler,
        eskiTablo: eski ? (w, h) => b.tablo.kucukResim(tabloIstegi(v, eski), w, h) : null,
        eskiPuan: eski?.puan ?? 0,
        siradaki: v.sonrakiTanitim ?? (sonraki ? `${M.siradaki}: ${sonraki.ad}!` : null),
        ilkTablo: !eski && kayitOnce.istatistik.kazanilan === 0,
        tablo: b.cizici.kagitDikdortgeni(),
        ustaEli: d.istatistik.ustaEli,
      },
      {
        W: b.stage.width,
        H,
        guvenliAlt: g.alt,
        guvenliUst: g.ust,
        azalt: b.hareketiAzalt(),
        muhur: (i, x, y) => {
          b.ses.arayuz((['yildiz1', 'yildiz2', 'yildiz3'] as const)[i] ?? 'yildiz1');
          b.cizici.altinTozu(x, y, 26);
          b.titret(14);
        },
      },
    );
    if (n !== this.nesil) return;
    if (secim.tabloSakla && eski) b.kayitci.guncelle((k) => tabloSakla(k, v.id, yeniTablo), true);
    b.cizici.kagitKaldir();
    b.cizici.karart(0);
    this.bitir({ tur: 'kazanc', secim: secim.secim });
  }

  private tabloIstegiKur(d: OyunDurumu, yildiz: 0 | 1 | 2 | 3): TabloIstegi {
    const v = this.v!;
    const desen = v.hedefler.find((h) => h.tur === 'desen');
    const desenTamam = desen ? d.hedefler.some((h) => h.hedef.tur === 'desen' && h.tamam) : false;
    const istek: TabloIstegi = { bolumId: v.id, atolye: v.atolye, tohum: tabloTohumu(v.id, this.denemeNo, d.puan), gunluk: d.gunluk, w: v.w, h: v.h, yildiz };
    if (desen && desen.tur === 'desen' && desenTamam) istek.motif = desen.motif;
    return istek;
  }

  // ─── Kayıp (§12.3 #7) ──────────────────────────────────────────────

  private async kayip(n: number, olu: boolean): Promise<void> {
    const b = this.b;
    const v = this.v!;
    const d = this.d!;
    this.durum = 'bitti';
    b.girdi.kipAyarla('kapali');
    b.ui.balonKapat();
    b.ses.arayuz('kaybettin');
    b.kayitci.guncelle((k) => bolumBitti(k, { id: v.id, kazanc: false, puan: d.puan, yildiz: 0, kaskat: d.istatistik.enUzunKaskat, lale: d.istatistik.lale }), true);
    const ustaEli = !olu && d.bitti === 'kayip' && !d.istatistik.ustaEli && ustaEliOnerilir(b.kayitci.kayit, v.id);
    const eksik = eksikMetni(d.hedefler.map((h) => ({ tur: h.hedef.tur, renk: h.hedef.tur === 'topla' ? h.hedef.renk : undefined, kalan: Math.max(0, h.gerekli - h.ilerleme) })));
    let yarim: HTMLCanvasElement | OffscreenCanvas | null = null;
    try {
      if (d.gunluk.length) yarim = b.tablo.kucukResim(this.tabloIstegiKur(d, 0), 44, 66);
    } catch {
      yarim = null;
    }
    b.ui.hud.goster(false);
    b.cizici.karart(0.42);
    const yer = this.yer ?? this.yerlesimHesapla();
    const kontrol: Partial<KaybettinKontrol> = {};
    b.ekran('kaybettin');
    const secimP = b.ui.kaybettin({ ad: v.ad, yuzde: ilerlemeYuzdesi(d), eksik, yarimTablo: yarim, ustaEli }, yer, kontrol);
    let secildi = false;
    void secimP.then(() => (secildi = true));
    // "Bu hamle kazandırırdı" hayaleti: son hamle öncesi tahtada (≤ 300 ms bütçe), 2 kez.
    const once = this.oncekiDurum;
    if (!olu && once) {
      void (async () => {
        await b.bekle(500);
        if (n !== this.nesil || secildi) return;
        const h = kazandiranBul(once, { enFazlaDugum: 200 });
        if (!h || n !== this.nesil || secildi) return;
        b.cizici.karart(0);
        b.cizici.durumGoster(once);
        b.cizici.hayaletHamle(h);
        kontrol.hayalet?.(true);
        await b.bekle(3300);
        if (n !== this.nesil || secildi) return;
        b.cizici.hayaletHamle(null);
        kontrol.hayalet?.(false);
        b.cizici.durumGoster(this.d!);
        b.cizici.karart(0.42);
      })();
    }
    const s = await secimP;
    if (n !== this.nesil) return;
    b.cizici.hayaletHamle(null);
    b.cizici.durumGoster(this.d!);
    b.cizici.karart(0);
    if (s === 'ustaEli' && this.d!.bitti === 'kayip') {
      const r = ustaEliUygula(this.d!);
      const o = this.d!;
      this.d = r.durum;
      b.ui.hud.goster(true);
      b.ui.hud.hamle(this.d.kalanHamle);
      b.ekran('oyun');
      await b.cizici.oynat(o, r.olaylar, this.d);
      if (n !== this.nesil) return;
      this.durum = 'bekliyor';
      b.girdi.kipAyarla('acik');
      this.bostaKur();
      return;
    }
    this.bitir({ tur: 'kayip', secim: s === 'tekrar' ? 'tekrar' : 'harita' });
  }
}
