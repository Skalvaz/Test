/**
 * EBRULİ uygulaması (P7): modülleri bağlar ve ekran akışını yürütür
 * (GDD §12.3).
 *
 *   açılış (ilk dokunuş sesi açar; beklerken ilk bölüm önden pişer)
 *     ├─ ilk kez (Bölüm 1 hiç kazanılmadı) → doğrudan Bölüm 1 öğretimi
 *     └─ sonra → atölye haritası
 *   harita → bölüm öncesi → oyun → kazandın / kaybettin → harita (sıradaki
 *   bölümün kartı kendiliğinden açılır) ya da tekrar; Bölüm 20 kazanılınca
 *   bir kez "Devamı yakında". Harita üstünde: Galeri, Nasıl oynanır, Ayarlar.
 *
 * Test kancası `window.__ebruli` (GDD §13.6) `testKancasi()`'nda.
 */
import { Stage } from '../render/stage';
import { oyunCiziciOlustur, type OyunCiziciTam } from '../render/oyunCizici';
import { tabloCiziciOlustur, type TabloCiziciTam } from '../render/tablo';
import { sesMotoruOlustur, type SesMotoruAyrintili } from '../audio/sesMotoru';
import { surukleGirdiOlustur, type SurukleGirdiTam } from '../input/surukle';
import { buzz, setHaptics } from '../platform/haptics';
import { prefGet } from '../platform/storage';
import { bolumuYukle, type BolumVerisi, type Renk } from '../core/index';
import { Arayuz, type AyarlarVM, type BolumOncesiVM, type GaleriVM, type HaritaVM, type HedefVM } from '../ui/arayuz';
import { gorselAyarla } from '../ui/gorsel';
import { YENI_OGE } from '../ui/metinler';
import { bekle } from '../ui/dom';
import { yerlesimHesapla } from '../ui/yerlesim';
import { BOLUMLER, bolumBul, SON_BOLUM } from '../levels/index';
import * as meta from '../meta/index';
import type { Ayarlar, Kayit } from '../meta/index';
import { ATOLYELER, type AtolyeId } from './katalog';
import { Kayitci } from './kayitci';
import { Oturum } from './oturum';
import { SADE_ANAHTARI, tabloIstegi } from './tablolar';

type Hedef = { tur: 'harita'; odak?: number; kartAc?: number | null } | { tur: 'bolum'; id: number } | { tur: 'devami' };

function sistemAzHareket(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Bölüm düğümünün rengi: ilk "topla" hedefi; yoksa desen/çiçek ya da sırayla karışık renk. */
function bolumRengi(v: BolumVerisi): Renk {
  for (const h of v.hedefler) if (h.tur === 'topla') return h.renk;
  for (const h of v.hedefler) if (h.tur === 'desen') return h.motif === 'karanfil' ? 3 : 5;
  return ([3, 6, 5] as const)[v.id % 3];
}

function hedefVM(v: BolumVerisi): HedefVM[] {
  const d = bolumuYukle(v, 0);
  return d.hedefler.map((h) => ({ tur: h.hedef.tur, renk: h.hedef.tur === 'topla' ? h.hedef.renk : undefined, motif: h.hedef.tur === 'desen' ? h.hedef.motif : undefined, gerekli: h.gerekli, ilerleme: 0, tamam: false }));
}

export class Uygulama {
  readonly stage: Stage;
  readonly cizici: OyunCiziciTam;
  readonly tablo: TabloCiziciTam;
  readonly ses: SesMotoruAyrintili;
  readonly ui: Arayuz;
  readonly girdi: SurukleGirdiTam;
  readonly kayitci: Kayitci;
  readonly oturum: Oturum;
  /** Temel ekran (akış) ve üstteki katmanlar (galeri, ayarlar…). */
  private ekranAdi = 'acilis';
  private katmanlar: string[] = [];
  private ciziciAktif = false;
  private sonKare = 0;
  private hizliKip = false;
  private sesAcik = false;
  private istek: Hedef | null = null;
  private bellekUyarildi = false;

  constructor(host: HTMLElement) {
    this.stage = new Stage(host, 2);
    this.kayitci = new Kayitci();
    const a = this.ayar;
    this.cizici = oyunCiziciOlustur(this.stage);
    this.cizici.secenekAyarla({ palet: a.palet, motifler: a.motifler, hiz: a.hiz, hareketiAzalt: this.azMi() });
    gorselAyarla(a.palet, a.motifler);
    // Zayıf cihaz (önceki oturumda tablo çizimi yavaştı): sade tablo (§9.3). Oturum boyunca değişmez.
    this.tablo = tabloCiziciOlustur({ dpr: Math.min(2, window.devicePixelRatio || 1), sade: prefGet(SADE_ANAHTARI, false) });
    this.ses = sesMotoruOlustur({ hata: () => {} });
    this.ses.ayarla({ sfx: a.sfx, muzik: a.muzik, ortam: a.ortam });
    setHaptics(a.titresim);
    this.ui = new Arayuz(host, { ses: (t) => this.ses.arayuz(t), geri: { duraklat: () => void this.oturum.duraklat() } });
    this.ui.hareketiAzalt(this.azMi());
    this.girdi = surukleGirdiOlustur({
      hedef: this.stage.canvas,
      geometri: () => this.cizici.geometri(),
      durum: () => this.oturum.girdiDurumu(),
      geriCagirim: {
        basladi: (k) => this.oturum.basladi(k),
        surukleniyor: (k, h, p) => this.oturum.surukleniyor(k, h, p),
        birakildi: (h) => this.oturum.birakildi(h),
        iptal: () => this.oturum.iptalGirdi(),
        dokunuldu: () => this.oturum.dokunuldu(),
        kisitliBasildi: (k) => this.oturum.kisitliBasildi(k),
        imlecDegisti: (k) => this.oturum.imlecDegisti(k),
      },
    });
    this.girdi.kipAyarla('kapali');
    this.oturum = new Oturum({
      stage: this.stage,
      cizici: this.cizici,
      ses: this.ses,
      ui: this.ui,
      girdi: this.girdi,
      tablo: this.tablo,
      kayitci: this.kayitci,
      titret: (p) => buzz(p),
      ekran: (ad) => (this.ekranAdi = ad),
      bekle: (ms) => this.bekle(ms),
      ayarlarAc: () => this.ayarlarAc(),
      hareketiAzalt: () => this.azMi(),
    });
    this.cizici.olayDinle((o) => {
      if (this.oturum.olayGecerli()) this.ses.olay(o);
      this.oturum.olay(o);
    });
    this.stage.onResize(() => this.oturum.yerlesimUygula());
    document.addEventListener('visibilitychange', () => this.ses.askiya(document.hidden));
    // İlk dokunuş sesi açar (iOS kilidi); sonraki dokunuşlar da bağlamı sürdürür.
    // Kullanıcı etkinleştirmesi sayılan olaylar: dokunmatikte pointerup, farede/klavyede basış.
    host.addEventListener('pointerup', () => this.sesAc(), { capture: true });
    host.addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && this.sesAc(), { capture: true });
    window.addEventListener('keydown', () => this.sesAc(), { capture: true });
    const dongu = (t: number) => {
      const dt = this.sonKare ? Math.min(100, t - this.sonKare) : 16;
      this.sonKare = t;
      if (this.ciziciAktif) this.cizici.kare(dt);
      requestAnimationFrame(dongu);
    };
    requestAnimationFrame(dongu);
    // Bulut kaydı açılış ekranı beklerken yüklensin.
    void this.kayitci.bulutaBaglan().then((k) => {
      if (!k || meta.ilerlemePuani(k) <= meta.ilerlemePuani(this.kayitci.kayit) || this.oturum.durum !== 'kapali') return;
      this.kayitci.degistir(k, false);
      // Harita açık ve üstünde katman yoksa yeni ilerlemeyle yeniden kur.
      if (this.ekranAdi === 'harita' && !this.katmanlar.length) this.git({ tur: 'harita' });
    });
  }

  get ayar(): Ayarlar {
    return this.kayitci.kayit.ayarlar;
  }

  get kayit(): Kayit {
    return this.kayitci.kayit;
  }

  private azMi(): boolean {
    return this.ayar.hareketiAzalt ?? sistemAzHareket();
  }

  bekle(ms: number): Promise<void> {
    return bekle(this.hizliKip ? Math.min(ms, 40) : ms);
  }

  ekran(): string {
    return this.katmanlar.length ? this.katmanlar[this.katmanlar.length - 1] : this.ekranAdi;
  }

  private async katman<T>(ad: string, f: () => Promise<T>): Promise<T> {
    this.katmanlar.push(ad);
    try {
      return await f();
    } finally {
      const i = this.katmanlar.lastIndexOf(ad);
      if (i >= 0) this.katmanlar.splice(i, 1);
    }
  }

  private sesAc(): void {
    this.ses.ac();
    if (this.sesAcik) return;
    this.sesAcik = true;
    this.ses.muzik(this.ayar.muzik > 0.001);
  }

  private tuval(gor: boolean): void {
    this.ciziciAktif = gor;
    this.stage.canvas.style.visibility = gor ? 'visible' : 'hidden';
  }

  // ─── Açılış ve akış ────────────────────────────────────────────────

  /**
   * @param sicak claude.ai görüntüleyicisinin canlı güncelleme verisi: süren
   * bölüm varsa açılış atlanır ve o bölümün yeni denemesi açılır.
   */
  async baslat(sicak: { bolum?: number | null } = {}): Promise<void> {
    if (sicak.bolum && meta.bolumAcik(this.kayit, sicak.bolum)) {
      void this.akis({ tur: 'bolum', id: sicak.bolum });
      return;
    }
    // Açılış beklerken ilk oynanacak bölüm önden pişer (ilk dokunuşta donma olmasın).
    const ilkId = meta.ilkOturum(this.kayit) ? 1 : meta.siradakiBolum(this.kayit);
    const v = bolumBul(ilkId) ?? BOLUMLER[0];
    this.tuval(false);
    try {
      const d = bolumuYukle(v, 0);
      const y = yerlesimHesapla(this.stage.width || 390, this.stage.height || 844, this.ui.guvenliAlan(), v.w, v.h, true);
      this.cizici.alanAyarla(y.tahta);
      this.cizici.bolumKur(d, v);
      void this.cizici.onIsit(v).then(() => this.cizici.kare(0));
    } catch {
      /* ön ısıtma isteğe bağlı */
    }
    this.ekranAdi = 'acilis';
    await this.ui.acilis(() => this.sesAc());
    if (!this.bellekUyarildi && this.kayitci.arka === 'bellek') {
      this.bellekUyarildi = true;
      setTimeout(() => this.ui.bilgi(this.kayitci.arka === 'bellek' ? 'Kayıt bu tarayıcıda tutulamıyor; ilerleme sayfa kapanınca kaybolur.' : '', 4200), 1200);
    }
    const ilk: Hedef = meta.ilkOturum(this.kayit) ? { tur: 'bolum', id: 1 } : { tur: 'harita', odak: meta.siradakiBolum(this.kayit) };
    void this.akis(ilk);
  }

  private async akis(ilk: Hedef): Promise<void> {
    let h: Hedef = ilk;
    for (;;) {
      if (this.istek) {
        h = this.istek;
        this.istek = null;
      }
      try {
        h = await this.adim(h);
      } catch (e) {
        console.warn('[ebruli] akış hatası', e);
        this.oturum.iptal();
        this.ui.ekranlariKapat();
        h = { tur: 'harita' };
        await bekle(50);
      }
    }
  }

  private adim(h: Hedef): Promise<Hedef> {
    if (h.tur === 'bolum') return this.bolumAdimi(h.id);
    if (h.tur === 'devami') return this.devamiAdimi();
    return this.haritaAdimi(h.odak ?? meta.siradakiBolum(this.kayit), h.kartAc ?? null);
  }

  private async bolumAdimi(id: number): Promise<Hedef> {
    const v = bolumBul(id);
    if (!v || !meta.bolumAcik(this.kayit, id)) return { tur: 'harita', odak: id };
    const { kayit, denemeNo } = meta.denemeBaslat(this.kayit, id);
    this.kayitci.degistir(kayit, false);
    this.tuval(true);
    const s = await this.oturum.baslat(v, denemeNo);
    this.ui.hud.goster(false);
    if (this.istek) return this.istek;
    switch (s.tur) {
      case 'kazanc': {
        if (s.secim === 'tekrar') return { tur: 'bolum', id };
        if (id >= SON_BOLUM && !this.kayit.devamiGoruldu) return { tur: 'devami' };
        const sonraki = id < SON_BOLUM && meta.bolumAcik(this.kayit, id + 1) ? id + 1 : null;
        return { tur: 'harita', odak: sonraki ?? id, kartAc: sonraki };
      }
      case 'kayip':
        return s.secim === 'tekrar' ? { tur: 'bolum', id } : { tur: 'harita', odak: id };
      case 'yeniden':
        return { tur: 'bolum', id };
      default:
        return { tur: 'harita', odak: id };
    }
  }

  private async haritaAdimi(odak: number, kartAc: number | null): Promise<Hedef> {
    this.tuval(false);
    this.ses.ortam(false);
    this.ekranAdi = 'harita';
    const id = await this.ui.harita(this.haritaVM(odak, kartAc), {
      bolumKarti: (bid) => this.katman('bolumOncesi', async () => (await this.ui.bolumOncesi(this.bolumOncesiVM(bid))) === 'basla'),
      galeri: () => void this.galeriAc(),
      ayarlar: () => void this.ayarlarAc(),
      nasil: () => void this.nasilAc(),
      devami: () =>
        void this.katman('devami', () => this.devamiGoster()).then((s) => {
          if (s === 'galeri') void this.galeriAc();
        }),
    });
    if (this.istek) return this.istek;
    if (id === null) return { tur: 'harita', odak };
    return { tur: 'bolum', id };
  }

  private async devamiAdimi(): Promise<Hedef> {
    this.tuval(false);
    this.kayitci.guncelle((k) => meta.devamiGoruldu(k), true);
    this.ekranAdi = 'devami';
    const s = await this.devamiGoster();
    if (this.istek) return this.istek;
    if (s === 'galeri') await this.galeriAc();
    return { tur: 'harita', odak: SON_BOLUM };
  }

  private devamiGoster(): Promise<'galeri' | 'harita'> {
    const k = this.kayit;
    return this.ui.devami({
      toplamYildiz: meta.toplamYildiz(k),
      enCokYildiz: SON_BOLUM * 3,
      tablolar: BOLUMLER.map((v) => {
        const t = meta.bolumKaydi(k, v.id).tablo;
        return { id: v.id, renk: bolumRengi(v), ciz: t ? (w: number, h: number) => this.tablo.kucukResim(tabloIstegi(v, t), w, h) : null };
      }),
    });
  }

  // ─── Görünüm modelleri ─────────────────────────────────────────────

  private haritaVM(odak: number, kartAc: number | null): HaritaVM {
    const k = this.kayit;
    const siradaki = meta.siradakiBolum(k);
    return {
      toplamYildiz: meta.toplamYildiz(k),
      enCokYildiz: SON_BOLUM * 3,
      odak,
      kartAc,
      devamiAcik: meta.bolumKaydi(k, SON_BOLUM).kazanildi,
      atolyeler: ATOLYELER.map((a) => {
        const bolumler = BOLUMLER.filter((v) => v.atolye === a.id);
        return {
          id: a.id,
          ad: a.ad,
          altBaslik: a.altBaslik,
          cicek: a.cicek,
          bolumler: bolumler.map((v) => {
            const b = meta.bolumKaydi(k, v.id);
            return { id: v.id, ad: v.ad, tur: v.tur, acik: meta.bolumAcik(k, v.id), kazanildi: b.kazanildi, yildiz: b.yildiz, siradaki: v.id === siradaki && !b.kazanildi, renk: bolumRengi(v) };
          }),
          tablolar: bolumler.flatMap((v) => {
            const t = meta.bolumKaydi(k, v.id).tablo;
            return t ? [{ id: v.id, ciz: (w: number, h: number) => this.tablo.kucukResim(tabloIstegi(v, t), w, h) }] : [];
          }),
        };
      }),
    };
  }

  private bolumOncesiVM(id: number): BolumOncesiVM {
    const v = bolumBul(id)!;
    const b = meta.bolumKaydi(this.kayit, id);
    const a = ATOLYELER.find((x) => x.id === v.atolye) ?? ATOLYELER[0];
    const y = YENI_OGE[id];
    return {
      id,
      ad: v.ad,
      atolyeAd: a.ad,
      tur: v.tur,
      hedefler: hedefVM(v),
      hamle: v.hamle,
      enIyi: b.enIyi,
      yildiz: b.yildiz,
      yeni: y ? { ad: y.ad, metin: y.metin, ikon: y.ikon } : null,
      tablo: b.tablo ? (w, h) => this.tablo.kucukResim(tabloIstegi(v, b.tablo!), w, h) : null,
    };
  }

  private galeriVM(): GaleriVM {
    const k = this.kayit;
    const akt = this.oturum.v?.atolye ?? (meta.siradakiBolum(k) > 10 ? 'bursa' : 'uskudar');
    return {
      baslangic: akt as AtolyeId,
      atolyeler: ATOLYELER.map((a) => ({
        id: a.id,
        ad: a.ad,
        kartlar: BOLUMLER.filter((v) => v.atolye === a.id).map((v) => {
          const b = meta.bolumKaydi(k, v.id);
          const t = b.tablo;
          return {
            id: v.id,
            ad: v.ad,
            acik: meta.bolumAcik(k, v.id),
            kazanildi: b.kazanildi,
            yildiz: t?.yildiz ?? b.yildiz,
            puan: t?.puan ?? b.enIyi,
            nadirlik: t?.nadirlik ?? 0,
            teknikler: t?.teknikler ?? [],
            renk: bolumRengi(v),
            ciz: t ? (w: number, h: number) => this.tablo.kucukResim(tabloIstegi(v, t), w, h) : null,
          };
        }),
      })),
    };
  }

  private ayarlarVM(): AyarlarVM {
    return { ...this.ayar, sistemAzHareket: sistemAzHareket(), kayitBellek: this.kayitci.arka === 'bellek' };
  }

  private acikOgeler(): Set<string> {
    const k = this.kayit;
    const s = new Set<string>(['tarak']);
    const esle: Record<number, string> = { 4: 'kagit', 5: 'girdap', 7: 'lale', 8: 'mermer', 9: 'desen', 11: 'murekkep', 13: 'yag' };
    for (const [id, ad] of Object.entries(esle)) if (meta.bolumAcik(k, Number(id))) s.add(ad);
    return s;
  }

  // ─── Katmanlar ─────────────────────────────────────────────────────

  galeriAc(): Promise<void> {
    return this.katman('galeri', () => this.ui.galeri(this.galeriVM()));
  }

  nasilAc(): Promise<void> {
    return this.katman('nasil', () => this.ui.nasil({ acik: this.acikOgeler() }));
  }

  ayarlarAc(): Promise<void> {
    return this.katman('ayarlar', () =>
      this.ui.ayarlar(this.ayarlarVM(), {
        degisti: (y) => this.ayarUygula(y),
        nasil: () => void this.nasilAc(),
        sifirla: () => {
          this.kayitci.degistir(meta.ilerlemeSifirla(this.kayit, meta.varsayilanKayit()), true);
          // Harita açıksa yeniden kurulsun.
          if (this.ekranAdi === 'harita') this.istek = { tur: 'harita', odak: 1 };
        },
      }),
    ).then(() => {
      if (this.istek && this.ekranAdi === 'harita') this.ui.ekranlariKapat();
    });
  }

  private ayarUygula(y: Partial<Ayarlar>): void {
    this.kayitci.guncelle((k) => meta.ayarDegistir(k, y));
    const a = this.ayar;
    if (y.sfx !== undefined || y.muzik !== undefined || y.ortam !== undefined) this.ses.ayarla({ sfx: a.sfx, muzik: a.muzik, ortam: a.ortam });
    if (y.muzik !== undefined) this.ses.muzik(a.muzik > 0.001);
    if (y.ortam !== undefined && this.oturum.v) this.ses.ortam(a.ortam && this.oturum.durum !== 'kapali', this.oturum.v.atolye);
    if (y.titresim !== undefined) setHaptics(a.titresim);
    if (y.hareketiAzalt !== undefined) {
      this.ui.hareketiAzalt(this.azMi());
      this.cizici.secenekAyarla({ hareketiAzalt: this.azMi() });
    }
    if (y.hiz !== undefined) this.cizici.secenekAyarla({ hiz: this.hizliKip ? 6 : a.hiz });
    if (y.palet !== undefined || y.motifler !== undefined) {
      this.cizici.secenekAyarla({ palet: a.palet, motifler: a.motifler });
      gorselAyarla(a.palet, a.motifler);
    }
    if (y.tarifSeridi !== undefined && this.oturum.v && this.oturum.durum !== 'kapali') this.ui.hud.tarifSabitle(this.oturum.v.id <= 5 || a.tarifSeridi === 'her');
    if (y.ipuclari !== undefined) this.oturum.bostaKur();
  }

  // ─── Test kancası (GDD §13.6) ──────────────────────────────────────

  /** Akışı kesip hedefe git (bölüm, harita). */
  private git(h: Hedef): void {
    this.istek = h;
    this.ui.ekranlariKapat();
    this.oturum.iptal();
  }

  testKancasi(yaziHazir: Promise<void>): Record<string, unknown> {
    const o = this.oturum;
    return {
      surum: 'P7',
      ekran: () => this.ekran(),
      durum: () => {
        const d = o.d;
        return d ? { bolumId: d.bolumId, hamleNo: d.hamleNo, kalanHamle: d.kalanHamle, puan: d.puan, bitti: d.bitti, oturum: o.durum, hedefler: d.hedefler.map((h) => ({ ilerleme: h.ilerleme, gerekli: h.gerekli, tamam: h.tamam })) } : null;
      },
      bolum: () => o.aktifBolum(),
      bolumAc: (id: number) => {
        // Test: kilidi aç (önceki bölümleri kazanılmış say).
        if (!meta.bolumAcik(this.kayit, id)) {
          let k = this.kayit;
          for (let i = 1; i < id; i++) if (!meta.bolumKaydi(k, i).kazanildi) k = meta.bolumBitti(k, { id: i, kazanc: true, puan: 0, yildiz: 1 });
          this.kayitci.degistir(k, true);
        }
        this.git({ tur: 'bolum', id });
      },
      botHamle: (tur: 'usta' | 'acemi' = 'usta') => o.botHamle(tur),
      kalanHamle: (n: number) => o.testKalanHamle(n),
      hizli: (on: boolean) => {
        this.hizliKip = !!on;
        this.cizici.secenekAyarla({ hiz: on ? 6 : this.ayar.hiz });
      },
      kayit: () => JSON.parse(JSON.stringify(this.kayit)),
      kayitYama: (y: Partial<Kayit>) => this.kayitci.degistir({ ...this.kayit, ...y }, true),
      ac: (ad: string) => {
        if (ad === 'harita') return this.git({ tur: 'harita' });
        if (ad === 'galeri') return void this.galeriAc();
        if (ad === 'ayarlar') return void this.ayarlarAc();
        if (ad === 'nasil') return void this.nasilAc();
        if (ad === 'devami')
          return void this.katman('devami', () => this.devamiGoster()).then((s) => {
            if (s === 'galeri') void this.galeriAc();
          });
      },
      geometri: () => this.cizici.geometri(),
      ogretim: () => o.ogretimDurumu(),
      boyut: () => ({ w: this.stage.width, h: this.stage.height, dpr: this.stage.dpr }),
      yaziHazir: () => yaziHazir.then(() => true),
      cizici: () => ({ fark: this.cizici.dev.sonFark(), oynuyor: this.cizici.dev.oynuyor(), tabloMs: o.sonTabloMs, ...this.cizici.dev.sayac() }),
    };
  }

  /** Sıcak yeniden yükleme anlık görüntüsü (claude.ai görüntüleyicisi). */
  anlik(): { bolum: number | null } {
    return { bolum: this.oturum.aktifBolum() };
  }
}
