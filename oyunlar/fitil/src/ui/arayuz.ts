/**
 * FİTİL arayüzü (P3a) — entegratörün kullandığı tek giriş noktası.
 *
 *   const ui = new Arayuz({ kok: document.getElementById('app')!, ses, titresim: buzz, geri: {...} });
 *   await ui.acilis(() => ses.ac());                 // ilk dokunuş sesi açar
 *   const s = await ui.harita(haritaVm);              // { tur: 'bolum', id } …
 *   if ((await ui.bolumOncesi(vm)) === 'basla') {
 *     ui.hudKur(hudVm);                               // harita gizlenir
 *     const { tahta, gokBandi, gorunurGok } = ui.tahtaAlani();    // → cizici.alanAyarla(tahta, gokBandi, gorunurGok)
 *     cizici.fisekKatmani(ui.fisekKatmani());         // HUD'un üstündeki fişek tuvali
 *     cizici.hedefKonumlari(ui.hedefKartKonumlari());
 *     ui.yerlesimDinle(() => { … yeniden uygula … });
 *   }
 *
 * DOM katmanı tuvalin üstündedir; kök işaretçi olaylarını geçirir, yalnız
 * düğmeler ve kartlar dokunulabilir. Ekran işlevleri kullanıcının seçimini
 * Promise ile döndürür; ekran programlı kapatılırsa (`ekranlariKapat`)
 * "geri" anlamındaki seçenekle çözülür.
 */
import './stil/temel.css';
import './stil/hud.css';
import './stil/ekranlar.css';
import './stil/harita.css';
import './stil/kanca.css';
import { h, kare } from './dom';
import { tanimlariKur, ustaSvg } from './ikonlar';
import { Baglam } from './cekirdek';
import { Hud } from './hud';
import { gorunurGokHesapla, yerlesimHesapla, SIFIR_KENAR, type Kenarlar, type Yerlesim } from './yerlesim';
import { HaritaEkrani } from './harita/harita';
import { acilisEkrani } from './ekranlar/acilis';
import { bolumOncesiEkrani } from './ekranlar/bolumOncesi';
import { duraklatEkrani } from './ekranlar/duraklat';
import { kazandinEkrani } from './ekranlar/kazandin';
import { tasarim } from './tasarim';
import { kaybettinEkrani } from './ekranlar/kaybettin';
import { ayarlarEkrani, type AyarlarEk } from './ekranlar/ayarlar';
import { nasilEkrani } from './ekranlar/nasil';
import { defterEkrani } from './ekranlar/defter';
import { gunlukEkrani } from './ekranlar/gunluk';
import { istatistikEkrani } from './ekranlar/istatistik';
import { molaEkrani, defterKartiEkrani, sandikEkrani } from './ekranlar/kucukler';
import { kasabaEkrani } from './ekranlar/kasaba';
import { beklemeEkrani, eksenSecici, type BeklemeTutamak } from './ekranlar/ek';
import type { Eksen } from '../core/types';
import { muhurUcur, muhurEtiketi } from './kanca';
import { MK } from './metinler';
import type { Dikdortgen, SesMotoru } from '../app/sozlesme';
import type { GuclendiriciId } from '../app/katalog';
import type {
  ArayuzGeriCagirim,
  AyarDegisikligi,
  AyarlarVM,
  BolumOncesiVM,
  DefterKartiVM,
  DefterVM,
  DuraklatSecimi,
  DuraklatVM,
  GunlukSecimi,
  GunlukVM,
  HaritaSecimi,
  HaritaVM,
  HudVM,
  IstatistikVM,
  KasabaSecimi,
  KasabaVM,
  KaybettinSecimi,
  KaybettinVM,
  KazandinVM,
  MolaSecimi,
  NasilVM,
  Palet,
  ReaksiyonKademesi,
  SandikVM,
} from './tipler';

export * from './tipler';
export type { Yerlesim, Kenarlar } from './yerlesim';
export { yerlesimHesapla } from './yerlesim';
export { paylasimMetni } from './paylasim';

export interface ArayuzSecenek {
  /** Arayüzün ekleneceği kök (genellikle #app; tuvalle aynı kap). */
  kok: HTMLElement;
  /** Arayüz sesleri (düğme, yıldız, sandık…). */
  ses?: Pick<SesMotoru, 'arayuz'> | null;
  /** Titreşim (platform/haptics `buzz`). */
  titresim?: ((p: number | number[]) => void) | null;
  geri?: Partial<ArayuzGeriCagirim>;
  palet?: Palet;
  hareketiAzalt?: boolean;
  /** HUD kısayolları (K, 1/2/3, P). Girdi modülü bunları ayrıca dinliyorsa false. */
  klavyeKisayollari?: boolean;
  /** Güvenli alan paylarını elle ver (önizleme/test); verilmezse env(safe-area-inset-*). */
  guvenliAlan?: Kenarlar;
}

const KUTLAMA: Record<ReaksiyonKademesi, { metin: string; boy: number; parilti: string }> = {
  guzel: { metin: 'Güzel!', boy: 44, parilti: 'rgba(255,200,90,.8)' },
  harika: { metin: 'Harika!', boy: 50, parilti: 'rgba(255,150,40,.85)' },
  muhtesem: { metin: 'Muhteşem!', boy: 56, parilti: 'rgba(255,95,180,.85)' },
  senlik: { metin: 'ŞENLİK!', boy: 64, parilti: 'rgba(178,102,255,.9)' },
};

interface Kapanabilir {
  kapat: () => void;
}

export class Arayuz {
  private b: Baglam;
  private hud: Hud;
  private haritaEkrani: HaritaEkrani;
  private yer: Yerlesim;
  private guvenliSabit: Kenarlar | null;
  private sonda: HTMLElement;
  private dinleyiciler = new Set<(y: Yerlesim) => void>();
  private ro: ResizeObserver | null = null;
  private boyutDinle: () => void;
  private acikEkranlar = new Set<Kapanabilir>();
  private balonEl: HTMLElement | null = null;
  private balonCoz: (() => void) | null = null;
  private balonSure: ReturnType<typeof setTimeout> | null = null;
  private balonGecirgen = false;
  private kisayol: boolean;
  /** (Kancalar §C.3) Süren mühür uçuşlarının iptali (Geri Sar, bölümden çıkış). */
  private muhurIptalci = new AbortController();

  constructor(s: ArayuzSecenek) {
    tasarim(); // GEÇİCİ: menü alternatifi (data-tasarim)
    this.b = new Baglam({ kok: s.kok, ses: s.ses, titresim: s.titresim });
    this.b.geri = { ...(s.geri ?? {}) };
    this.b.palet = s.palet ?? 'standart';
    this.b.hareketiAzalt = !!s.hareketiAzalt;
    this.b.kok.classList.toggle('f-az', this.b.hareketiAzalt);
    this.kisayol = s.klavyeKisayollari !== false;
    this.guvenliSabit = s.guvenliAlan ?? null;
    if (this.guvenliSabit) this.guvenliDegiskenleri(this.guvenliSabit);
    tanimlariKur(this.b.palet);
    this.hud = new Hud(this.b);
    this.hud.bantGoster = (m) => void this.bant(m);
    this.b.toastKonumu = () => this.toastUst();
    this.haritaEkrani = new HaritaEkrani(this.b);
    this.sonda = h('div', { s: 'f-sonda', 'aria-hidden': 'true' });
    this.b.kok.appendChild(this.sonda);
    this.yer = this.olc();
    this.boyutDinle = () => this.boyutDegisti();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(this.boyutDinle);
      this.ro.observe(this.b.kok);
    }
    window.addEventListener('resize', this.boyutDinle);
    window.visualViewport?.addEventListener('resize', this.boyutDinle);
    this.b.tusBaskasi = (e) => {
      if (!this.kisayol || !this.hud.gorunur) return false;
      const ok = this.hud.tus(e);
      if (ok) e.preventDefault();
      return ok;
    };
    // Bütün düğmelerde hafif "tık" sesi.
    this.b.kok.addEventListener('click', (e) => {
      const d = (e.target as Element).closest('button');
      if (d && !d.disabled && !d.hasAttribute('data-sessiz')) this.b.ses('dugme');
    });
  }

  // ─────────────────────── Ayarlar ───────────────────────

  geriCagirimAyarla(g: Partial<ArayuzGeriCagirim>): void {
    Object.assign(this.b.geri, g);
  }

  /** Palet ve hareket tercihini anında uygular (HUD ikonları yeniden çizilir). */
  secenekAyarla(s: { palet?: Palet; hareketiAzalt?: boolean }): void {
    if (s.palet && s.palet !== this.b.palet) {
      this.b.palet = s.palet;
      tanimlariKur(s.palet);
      // Yalnız görünür HUD yeniden kurulur: haritadan açılan Ayarlar'da palet
      // değişince son bölümün HUD'u (ve fişek katmanı) pencerenin arkasında belirmesin.
      // Gizli HUD sonraki hudKur'da yeni paletle kurulur.
      const vm = this.hud.model;
      if (vm && this.hud.gorunur) this.hud.kur(vm, this.yer);
    }
    if (s.hareketiAzalt !== undefined) {
      this.b.hareketiAzalt = s.hareketiAzalt;
      this.b.kok.classList.toggle('f-az', s.hareketiAzalt);
    }
  }

  // ─────────────────────── Yerleşim ───────────────────────

  private guvenliDegiskenleri(k: Kenarlar): void {
    const st = this.b.kok.style;
    st.setProperty('--guv-ust', `${k.ust}px`);
    st.setProperty('--guv-sag', `${k.sag}px`);
    st.setProperty('--guv-alt', `${k.alt}px`);
    st.setProperty('--guv-sol', `${k.sol}px`);
  }

  private guvenliOlc(): Kenarlar {
    if (this.guvenliSabit) return this.guvenliSabit;
    try {
      const c = getComputedStyle(this.sonda);
      return { ust: parseFloat(c.paddingTop) || 0, sag: parseFloat(c.paddingRight) || 0, alt: parseFloat(c.paddingBottom) || 0, sol: parseFloat(c.paddingLeft) || 0 };
    } catch {
      return SIFIR_KENAR;
    }
  }

  private olc(tahtaW?: number, tahtaH?: number): Yerlesim {
    const r = this.b.kok.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width || window.innerWidth));
    const hh = Math.max(1, Math.round(r.height || window.innerHeight));
    const vm = this.hud.model;
    return yerlesimHesapla(w, hh, tahtaW ?? vm?.tahtaW ?? 7, tahtaH ?? vm?.tahtaH ?? 9, this.guvenliOlc());
  }

  /**
   * (P5 ek) HUD'u kurmadan, verilen tahta boyutu için `tahtaAlani()` ile aynı
   * sonuç: açılış ekranı beklerken bölümün pişirmeleri önceden yapılır.
   */
  onYerlesim(tahtaW: number, tahtaH: number): { tahta: Dikdortgen; gokBandi: Dikdortgen; gorunurGok: Dikdortgen } {
    const y = this.olc(tahtaW, tahtaH);
    return { tahta: { ...y.tahtaAlani }, gokBandi: { ...y.gokBandi }, gorunurGok: { ...y.gorunurGok } };
  }

  /**
   * (Fişek ek) Görünür gök şeridi: HUD kuruluysa plakanın ölçülen alt
   * kenarından (yoksa CSS ölçülerinden tahmin) tahtanın üstüne.
   */
  private gorunurGok(y: Yerlesim): Dikdortgen {
    return gorunurGokHesapla(y, y.kip === 'dikey' ? this.hud.altKenar() : null);
  }

  /** (Fişek ek) Çizicinin fişek tuvalinin ekleneceği katman (HUD'un üstü, balon/modal altı). */
  fisekKatmani(): HTMLElement {
    return this.b.fisekKatmani;
  }

  /** Oyun ekranında bildirimin üst konumu: HUD ile tahta arasındaki gök bandı (tahta satırlarını örtmesin). */
  private toastUst(): number | null {
    if (!this.hud.gorunur || this.acikEkranlar.size > 0 || this.b.modalAcik) return null;
    const y = this.yer;
    if (!y || y.kip !== 'dikey') return null;
    const ust = y.ustBant.y + y.ustBant.h;
    const bosluk = y.tahta.y - ust;
    return Math.round(ust + Math.max(6, bosluk / 2 - 24));
  }

  private boyutDegisti(): void {
    const y = this.olc();
    const o = this.yer;
    if (o && o.ekranW === y.ekranW && o.ekranH === y.ekranH && o.hucre === y.hucre && o.guvenli.ust === y.guvenli.ust && o.guvenli.alt === y.guvenli.alt) return;
    this.yer = y;
    this.hud.yerlesimUygula(y);
    this.balonKonumla();
    for (const fn of this.dinleyiciler) fn(y);
  }

  /** Güncel yerleşim (§13.7). */
  yerlesim(): Yerlesim {
    this.yer = this.olc();
    return this.yer;
  }

  /**
   * HUD'lar yerleştikten sonra tuvalde tahtaya kalan alan ve gökyüzü bandı
   * (§13.7). `tahta` alanının içinde tahta `yerlesim().tahta` olarak ortalanır.
   * `gorunurGok`: HUD'un ölçülen alt kenarı ile tahta arası (gök fişekleri).
   */
  tahtaAlani(): { tahta: Dikdortgen; gokBandi: Dikdortgen; gorunurGok: Dikdortgen } {
    const y = this.yerlesim();
    return { tahta: { ...y.tahtaAlani }, gokBandi: { ...y.gokBandi }, gorunurGok: this.gorunurGok(y) };
  }

  /** Ekran boyutu/kip değişince çağrılır. Dönen işlev aboneliği kaldırır. */
  yerlesimDinle(fn: (y: Yerlesim) => void): () => void {
    this.dinleyiciler.add(fn);
    return () => this.dinleyiciler.delete(fn);
  }

  /** Hedef kartlarının merkezleri (kök öğeye göre CSS px): kıvılcım uçuşu. */
  hedefKartKonumlari(): { x: number; y: number }[] {
    return this.hud.hedefKonumlari();
  }

  // ─────────────────────── Ekranlar ───────────────────────

  private ac<T>(e: { soz: Promise<T>; kapat: () => void }): Promise<T> {
    this.acikEkranlar.add(e);
    void e.soz.then(() => this.acikEkranlar.delete(e));
    return e.soz;
  }

  /** Açılış: logo tutuşur, "Dokun ve başla". `ilkDokunus` dokunma olayının içinde çağrılır (ses kilidi). */
  acilis(ilkDokunus?: () => void): Promise<void> {
    return acilisEkrani(this.b, ilkDokunus);
  }

  /** Harita (ana ekran). HUD açıksa gizler. Seçimle çözülür. */
  harita(vm: HaritaVM): Promise<HaritaSecimi> {
    this.hudGizle();
    return this.haritaEkrani.goster(vm);
  }

  haritaGizle(): void {
    this.haritaEkrani.gizle();
  }

  /**
   * (Kancalar §C.1) Yeni yapılan kasaba işinin harita kutlaması — `harita(vm)`
   * önceki modelde olmayan işi görünce kendiliğinden oynar — ve mahalle 6/6
   * olduysa ardından Mahalle şenliği bitince çözülür. Uygulama Defter kartını
   * (`kasaba:<mahalleId>`) bundan sonra gösterir.
   */
  haritaKutlamasi(): Promise<void> {
    return this.haritaEkrani.kutlamaBitti();
  }

  /**
   * (Kancalar §C.1) Kasaba paneli: alttan çekmece. "Yap" seçilince çekmece
   * kapanır (240 ms); uygulama işi kaydedip `harita(yeniVm)` ile kutlar.
   */
  kasaba(vm: KasabaVM): Promise<KasabaSecimi> {
    return this.ac(kasabaEkrani(this.b, vm));
  }

  /** (Kancalar §C.6) Haritada Kıvılcım Usta balonu: Kasaba düğmesinin ya da bir sancağın üstünde. */
  haritaBalonu(metin: string, yer: 'kasaba' | { bolumId: number }, sure = 3500): Promise<void> {
    return this.haritaEkrani.balon(metin, yer, sure);
  }

  /** (Kancalar §B.5) Haritada Mahalle şenliği (6 sn, dokunuş atlar). */
  haritaSenligi(mahalle: number): Promise<void> {
    return this.haritaEkrani.senlik(mahalle);
  }

  bolumOncesi(vm: BolumOncesiVM): Promise<'basla' | 'geri'> {
    return this.ac(bolumOncesiEkrani(this.b, vm));
  }

  duraklat(vm: DuraklatVM): Promise<DuraklatSecimi> {
    return this.ac(duraklatEkrani(this.b, vm));
  }

  /** ek.tablo: bu kazancın Gece Tablosu tuvali (çizici üretir). */
  kazandin(vm: KazandinVM, ek: { tablo?: HTMLCanvasElement | null } = {}): Promise<'devam' | 'tekrar'> {
    return this.ac(kazandinEkrani(this.b, vm, ek));
  }

  kaybettin(vm: KaybettinVM): Promise<KaybettinSecimi> {
    return this.ac(kaybettinEkrani(this.b, vm));
  }

  ayarlar(vm: AyarlarVM, ek: Omit<AyarlarEk, 'yerelUygula'> = {}): Promise<void> {
    const yerelUygula = (d: AyarDegisikligi) => {
      if (d.palet !== undefined || d.hareketiAzalt !== undefined) this.secenekAyarla({ palet: d.palet, hareketiAzalt: d.hareketiAzalt });
    };
    return this.ac(
      ayarlarEkrani(this.b, vm, {
        nasilAc: ek.nasilAc,
        defterKartiAc: ek.defterKartiAc ?? ((m, tur) => void this.defterKarti({ mahalle: m, oduller: [], tur })),
        yerelUygula,
      }),
    );
  }

  nasilOynanir(vm: NasilVM): Promise<void> {
    return this.ac(nasilEkrani(this.b, vm));
  }

  defter(vm: DefterVM): Promise<void> {
    return this.ac(defterEkrani(this.b, vm, { defterKartiAc: (m, tur) => void this.defterKarti({ mahalle: m, oduller: [], tur }) }));
  }

  /** Mahalle tamamlanınca Fener Koyu Defteri kartı (ve ödülleri). */
  defterKarti(vm: DefterKartiVM): Promise<void> {
    return this.ac(defterKartiEkrani(this.b, vm));
  }

  gunluk(vm: GunlukVM, ek: { kucukResim?: HTMLCanvasElement | null } = {}): Promise<GunlukSecimi> {
    return this.ac(gunlukEkrani(this.b, vm, ek));
  }

  istatistik(vm: IstatistikVM, sekme: 'istatistik' | 'rozetler' = 'istatistik'): Promise<void> {
    return this.ac(istatistikEkrani(this.b, vm, sekme));
  }

  /** Mola balonu (§11 kanca 30). */
  mola(): Promise<MolaSecimi> {
    return this.ac(molaEkrani(this.b));
  }

  /** Tek başına sandık (günlük görev, Fener Nöbeti basamağı). */
  sandikAc(sandik: SandikVM, baslik?: string): Promise<void> {
    return this.ac(sandikEkrani(this.b, sandik, baslik));
  }

  /** (P5 ek) Uzun hazırlık (günlük tahta üretimi) için ilerleme kartı. */
  bekleme(metin: string, alt?: string, iptal?: () => void): BeklemeTutamak {
    return beklemeEkrani(this.b, metin, alt, iptal);
  }

  /**
   * (P5 ek) Fişek Kalıbı ekseni (§9): hücre merkezinin yanında 4 yön düğmesi.
   * `merkez` kök öğeye göre CSS px. İptal → null.
   */
  eksenSec(merkez: { x: number; y: number }, hucre: number): Promise<Eksen | null> {
    return this.ac(eksenSecici(this.b, merkez, hucre, this.yer.ekranW));
  }

  /** (P5 ek) Modal ya da ekran kartı açık mı (girdi kısayolları için). */
  get modalAcik(): boolean {
    return this.b.modalAcik || this.acikEkranlar.size > 0;
  }

  /** Açık kart ekranlarını kapatır (her biri "geri" seçimiyle çözülür). */
  ekranlariKapat(): void {
    for (const e of [...this.acikEkranlar]) e.kapat();
    this.acikEkranlar.clear();
  }

  // ─────────────────────── HUD ───────────────────────

  /** Oyun HUD'unu kurar (harita gizlenir). */
  hudKur(vm: HudVM): void {
    this.haritaEkrani.gizle();
    this.hud.kur(vm, this.yerlesimIcin(vm));
  }

  private yerlesimIcin(vm: HudVM): Yerlesim {
    const r = this.b.kok.getBoundingClientRect();
    this.yer = yerlesimHesapla(Math.round(r.width || window.innerWidth), Math.round(r.height || window.innerHeight), vm.tahtaW, vm.tahtaH, this.guvenliOlc());
    return this.yer;
  }

  /** Bütün HUD'u modelle eşitler (fark varsa canlandırır). */
  hudGuncelle(vm: HudVM): void {
    const yapi = this.hud.model && (this.hud.model.tahtaW !== vm.tahtaW || this.hud.model.tahtaH !== vm.tahtaH);
    if (yapi) this.yerlesimIcin(vm);
    this.hud.guncelle(vm);
    if (yapi) for (const fn of this.dinleyiciler) fn(this.yer);
  }

  hudGizle(): void {
    this.hud.gizle();
    this.balonKapat();
  }

  /** Hedef sayacı zıplaması (§12.2); `deger` = ilerleme (çekirdekteki hedefIlerledi.deger). */
  hedefSayaci(indeks: number, deger: number, tamam: boolean, gerekli?: number): void {
    this.hud.hedefSayaci(indeks, deger, tamam, gerekli);
  }

  /** Kalan hamle: son 5 nabız, 1'de "Son hamle!" bandı. */
  hamleSayaci(kalan: number): void {
    this.hud.hamleSayaci(kalan);
  }

  puan(puan: number): void {
    this.hud.puanGoster(puan, true);
  }

  korukGostergesi(dolum: number, kapasite: number): void {
    this.hud.korukGuncelle(dolum, kapasite, true);
  }

  /**
   * (Kancalar §C.3) Mühürler bu denemede tuttu: `kaynak`ta (reaksiyon
   * merkezi, kök öğeye göre CSS px) 28 px mum mühür belirir, rozetin
   * noktasına uçar (birden çoksa 160 ms arayla), nokta damgalanır, ses +
   * titreşim + "Kalfa mührü!" etiketi. Bütün noktalar çağrı anında "uçuşta"
   * sayılır (sıradakiler de damgaya kadar boş kalır). Hareketi azaltta uçuş
   * yok, nokta anında dolar. `muhurUcuslariniIptal` (Geri Sar, çıkış) uçanları
   * kaldırır: damga, ses ve etiket çıkmaz.
   */
  muhurTuttu(liste: readonly { indeks: number; kademe: 'cirak' | 'kalfa' | 'usta' }[], kaynak: { x: number; y: number }): Promise<void> {
    const sinyal = this.muhurIptalci.signal;
    for (const m of liste) this.hud.muhurUcusBasla(m.indeks);
    const tek = async (m: { indeks: number; kademe: 'cirak' | 'kalfa' | 'usta' }, gecikme: number): Promise<void> => {
      if (gecikme > 0 && !sinyal.aborted) await new Promise<void>((r) => {
        const t = setTimeout(r, gecikme);
        sinyal.addEventListener('abort', () => {
          clearTimeout(t);
          r();
        }, { once: true });
      });
      const hedef = sinyal.aborted ? null : this.hud.muhurNoktasi(m.indeks);
      if (hedef) await muhurUcur(this.b, m.kademe, kaynak, hedef, sinyal);
      // Uçuş sürerken Geri Sar mühürü geri aldıysa ya da bölümden çıkıldıysa damga yok.
      if (sinyal.aborted || !this.hud.muhurTutuyor(m.indeks)) {
        this.hud.muhurUcusBitti(m.indeks, false);
        return;
      }
      this.hud.muhurUcusBitti(m.indeks, true);
      this.b.ses('muhur');
      this.b.titret(15);
      const metin = MK.muhurTuttu(MK.kademe[m.kademe]);
      const p = hedef ?? this.hud.muhurNoktasi(m.indeks);
      if (p) muhurEtiketi(this.b, metin, { x: Math.max(64, Math.min(this.yer.ekranW - 64, p.x)), y: p.y - 14 }, sinyal);
      else this.b.duyur(metin);
    };
    return Promise.all(liste.map((m, n) => tek(m, n * 160))).then(() => undefined);
  }

  /** Süren mühür uçuşlarını ve etiketlerini kaldırır (Geri Sar, bölümden çıkış). */
  muhurUcuslariniIptal(): void {
    this.muhurIptalci.abort();
    this.muhurIptalci = new AbortController();
  }

  /** Hareketi azalt açık mı (ayar ya da sistem). */
  hareketiAzaltik(): boolean {
    return this.b.az();
  }

  /** Hedef seçimi ipucu (null = kapat). kaynak: vurgulanacak düğme. */
  secimKipi(metin: string | null, kaynak: GuclendiriciId | 'koruk' | null = null): void {
    this.hud.secimKipi(metin, kaynak);
  }

  // ─────────────────────── Balon, bant, bildirim ───────────────────────

  /**
   * Kıvılcım Usta balonu (§14.4, §15): tahtanın üst kenarında, tek satır,
   * dokununca kapanır. `sure` ms sonra kendiliğinden kapanır (0 = beklemez).
   */
  balon(metin: string, sure = 0, o: { gecirgen?: boolean } = {}): Promise<void> {
    this.balonKapat();
    const el = h('div', { s: 'f-balon', role: 'status', tabindex: '0', 'aria-label': `Kıvılcım Usta: ${metin}` }, ustaSvg(), h('span', { s: 'f-balon-metin', t: metin }));
    this.balonEl = el;
    this.balonGecirgen = !!o.gecirgen;
    this.b.ustKatman.appendChild(el);
    this.balonKonumla();
    this.b.duyur(metin);
    const kapat = () => this.balonKapat();
    el.addEventListener('pointerup', kapat);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') kapat();
    });
    void kare().then(() => el.classList.add('f-giris'));
    if (sure > 0) this.balonSure = setTimeout(kapat, sure);
    return new Promise((r) => (this.balonCoz = r));
  }

  balonKapat(): void {
    if (this.balonSure) clearTimeout(this.balonSure);
    this.balonSure = null;
    const el = this.balonEl;
    if (el) {
      el.classList.remove('f-giris');
      el.classList.add('f-cikis');
      setTimeout(() => el.remove(), 200);
    }
    this.balonEl = null;
    const c = this.balonCoz;
    this.balonCoz = null;
    c?.();
  }

  private balonKonumla(): void {
    const el = this.balonEl;
    if (!el) return;
    const y = this.yer;
    const t = y.tahta;
    // Yatayda tahta dar (ör. 5 × 40 px): balon tahtanın solundaki boş alanı da kullanır,
    // sağ panelin üstüne taşmaz; talimat kesilmesin.
    const sag = y.kip === 'yatay' && y.panel ? y.panel.x - 8 : y.ekranW - 8;
    const enAz = y.kip === 'yatay' ? 320 : 0;
    const genislik = Math.min(Math.max(t.w + 8, enAz), sag - 8, 460);
    const sol = Math.max(8, Math.min(sag - genislik, Math.round(t.x + t.w / 2 - genislik / 2)));
    el.style.left = `${sol}px`;
    el.style.width = `${genislik}px`;
    // Üst plakanın altıyla tahta arasında yer varsa tahtanın hemen üstüne, yoksa üst kenarına biner.
    const plakaAlti = y.kip === 'dikey' ? y.guvenli.ust + 76 : y.guvenli.ust + 8;
    const ust = t.y - 62 >= plakaAlti ? t.y - 62 : Math.max(plakaAlti, t.y + 6);
    el.style.top = `${Math.round(ust)}px`;
    // Oyun ortasında kendiliğinden çıkan balon (ör. "Mühür tuttu!") tahtaya
    // biniyorsa dokunuşu yakalamaz ve yarı saydamdır: ilk sıradan başlayan
    // sürükleme tahtaya gider (KANCALAR §C.3, kısa ekran).
    el.classList.toggle('f-gecirgen', this.balonGecirgen && ust + 52 > t.y);
  }

  toast(metin: string, ms?: number): void {
    this.b.toast(metin, ms);
  }

  /** Ekranı boydan geçen şerit ("Son hamle!", "Şenlik başlıyor!"), 900 ms. */
  bant(metin: string, tur: 'kizil' | 'altin' = 'kizil'): Promise<void> {
    const y = this.yer;
    const orta = y.tahta.y + y.tahta.h * 0.38;
    const ic = h('div', { s: 'f-bant-ic' }, h('span', { t: metin }));
    const el = h('div', { s: `f-bant${tur === 'altin' ? ' f-bant-altin' : ''}`, 'aria-hidden': 'true', css: { '--bant-y': `${Math.round(orta)}px` } }, ic);
    if (this.b.az()) {
      ic.style.animation = 'none';
      ic.style.transform = 'none';
      ic.querySelector('span')!.style.animation = 'none';
    }
    this.b.ustKatman.appendChild(el);
    this.b.duyur(metin);
    return new Promise((r) =>
      setTimeout(() => {
        el.remove();
        r();
      }, 950),
    );
  }

  /** Reaksiyon yazısı (§12.2): Güzel! / Harika! / Muhteşem! / ŞENLİK!, harfler dalgalanır. */
  reaksiyonYazisi(kademe: ReaksiyonKademesi): void {
    const k = KUTLAMA[kademe];
    const y = this.yer;
    const el = h(
      'div',
      {
        s: `f-kutlama f-kutlama-${kademe}`,
        'aria-hidden': 'true',
        css: { top: `${Math.round(y.tahta.y + y.tahta.h * 0.3 - k.boy / 2)}px`, '--boy': `${k.boy}px`, '--parilti': k.parilti },
      },
      Array.from(k.metin).map((c, i) => h('span', { t: c === ' ' ? ' ' : c, css: { '--i': String(i) } })),
    );
    if (this.b.az()) el.style.animation = 'none';
    this.b.ustKatman.appendChild(el);
    this.b.duyur(k.metin);
    setTimeout(() => el.remove(), 1150);
  }

  yokEt(): void {
    this.ekranlariKapat();
    this.haritaEkrani.yokEt();
    this.hud.gizle();
    this.ro?.disconnect();
    window.removeEventListener('resize', this.boyutDinle);
    window.visualViewport?.removeEventListener('resize', this.boyutDinle);
    this.b.yokEt();
  }
}
