/**
 * Sürükleme girdisinin saf mantığı (GDD §3.2) — DOM yok, vitest'te sınanır.
 * DOM bağlayıcısı (`surukle.ts`) Pointer Events ve klavye olaylarını buraya
 * çevirir.
 *
 *  - Yalnız ilk pointer izlenir; ikinci parmak yok sayılır.
 *  - Damlaya basınca `basladi(kaynak)`. Basma noktasından 12 px'i geçince
 *    baskın eksen yönü belirler; hedef o yöndeki komşudur
 *    (`surukleniyor(kaynak, hedef, parmak)`; eşik altında hedef null).
 *  - Bırakınca hedef varsa `birakildi(hamle)` (geçerliliği uygulama denetler;
 *    geçersizse çiziciye `titret` der). Eşiği aşıp hedefsiz (geri dönüp)
 *    bırakmak `iptal()`.
 *  - Dokun-dokun: eşik aşılmadan bırakılan damla SEÇİLİ KALIR (basladi
 *    zaten gönderildi). Ardından komşuya dokunmak `birakildi(seçili →
 *    komşu)`; aynı damlaya ya da boşluğa dokunmak `iptal()`; başka bir
 *    damlaya dokunmak seçimi ona taşır (`iptal()` + `basladi(yeni)`).
 *  - Klavye: oklar imleci taşır (`imlecDegisti`); Enter/Boşluk imleçteki
 *    damlayı seçer (`basladi`); seçiliyken ok tuşu o yöndeki hamleyi yapar
 *    (`birakildi`); Esc seçimi bırakır (`iptal`), seçim yoksa imleci gizler.
 *  - Zorunlu ilk hamle (öğretim, §12.1): yalnız zorunlu kaynaktan zorunlu
 *    hedefe; dışarı basmak `kisitliBasildi(hücre)`, başka yöne sürüklemek
 *    hedef üretmez.
 *  - Kip 'kapali' (oynatma): her dokunuş yalnız `dokunuldu()` (hızlandırma).
 */
import type { SurukleGeriCagirim, TahtaGeometrisi } from '../app/sozlesme';
import type { Hamle, Konum } from '../core/types';

/** Sürükleme eşiği (CSS px). */
export const ESIK_PX = 12;

export interface GirdiOrtami {
  geometri(): TahtaGeometrisi;
  /** Bu hücrede seçilebilir bir damla var mı (mermer/boş/delik değil). Girdi kapalıyken null döner. */
  secilebilir(k: Konum): boolean | null;
}

type Kip = 'yok' | 'kaynak' | 'ayniSecili' | 'ikinci';

const esit = (a: Konum | null | undefined, b: Konum | null | undefined): boolean => !!a && !!b && a.x === b.x && a.y === b.y;
const komsu = (a: Konum, b: Konum): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

export const YON_TUSLARI: Record<string, Konum> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export class SurukleMantigi {
  private kipGirdi: 'acik' | 'kapali' = 'acik';
  private pointer: number | null = null;
  private bas0 = { x: 0, y: 0 };
  private mod: Kip = 'yok';
  private kaynak: Konum | null = null;
  /** Dokun-dokun seçimi (bırakıldıktan sonra da kalır). */
  secili: Konum | null = null;
  private suruklu = false;
  private hedef: Konum | null = null;
  private ikinciHucre: Konum | null = null;
  imlec: Konum | null = null;
  zorunlu: Hamle | null = null;

  constructor(
    private readonly ort: GirdiOrtami,
    private readonly cb: SurukleGeriCagirim,
  ) {}

  get kip(): 'acik' | 'kapali' {
    return this.kipGirdi;
  }

  /** Etkin bir pointer izleniyor mu. */
  get basili(): boolean {
    return this.pointer !== null;
  }

  kipAyarla(k: 'acik' | 'kapali'): void {
    if (k === this.kipGirdi) return;
    this.kipGirdi = k;
    if (k === 'kapali') {
      const vardi = this.secili || this.mod !== 'yok';
      this.sifirla();
      if (vardi) this.cb.iptal();
    }
  }

  zorunluAyarla(h: Hamle | null): void {
    this.zorunlu = h ? { tur: 'surukle', kaynak: { ...h.kaynak }, hedef: { ...h.hedef } } : null;
  }

  /** Seçimi ve süren sürüklemeyi sessizce bırak. */
  sifirla(): void {
    this.pointer = null;
    this.mod = 'yok';
    this.kaynak = null;
    this.secili = null;
    this.suruklu = false;
    this.hedef = null;
    this.ikinciHucre = null;
  }

  hucreBul(x: number, y: number): Konum | null {
    const g = this.ort.geometri();
    const gx = Math.floor((x - g.x) / g.hucre);
    const gy = Math.floor((y - g.y) / g.hucre);
    if (gx < 0 || gy < 0 || gx >= g.w || gy >= g.h) return null;
    return { x: gx, y: gy };
  }

  /** Zorunlu hamlede bu basış serbest mi. */
  private zorunluIzin(h: Konum | null): boolean {
    const z = this.zorunlu;
    if (!z) return true;
    if (esit(h, z.kaynak)) return true;
    // Dokun-dokun: zorunlu kaynak seçiliyken zorunlu hedefe dokunmak.
    return esit(this.secili, z.kaynak) && esit(h, z.hedef);
  }

  bas(id: number, x: number, y: number): void {
    this.cb.dokunuldu();
    if (this.kipGirdi === 'kapali') return;
    if (this.pointer !== null) return;
    const hucre = this.hucreBul(x, y);
    const sec = hucre ? this.ort.secilebilir(hucre) : false;
    if (sec === null) return;
    this.pointer = id;
    this.bas0 = { x, y };
    this.suruklu = false;
    this.hedef = null;
    if (!this.zorunluIzin(hucre)) {
      this.mod = 'yok';
      if (hucre) this.cb.kisitliBasildi?.(hucre);
      return;
    }
    if (this.secili && hucre && komsu(this.secili, hucre)) {
      this.mod = 'ikinci';
      this.ikinciHucre = hucre;
      this.kaynak = this.secili;
      return;
    }
    if (hucre && sec) {
      if (esit(this.secili, hucre)) {
        this.mod = 'ayniSecili';
        this.kaynak = hucre;
        return;
      }
      if (this.secili) this.cb.iptal();
      this.secili = hucre;
      this.kaynak = hucre;
      this.mod = 'kaynak';
      this.cb.basladi(hucre);
      return;
    }
    this.mod = 'yok';
    if (this.secili) {
      this.secili = null;
      this.cb.iptal();
    }
  }

  hareket(id: number, x: number, y: number): void {
    if (id !== this.pointer || this.kipGirdi === 'kapali') return;
    const dx = x - this.bas0.x;
    const dy = y - this.bas0.y;
    const uzak = Math.hypot(dx, dy) > ESIK_PX;
    if (this.mod === 'ikinci') {
      if (!uzak) return;
      // Komşuya basıp sürüklemek: o damladan yeni sürükleme.
      const h = this.ikinciHucre!;
      if (!this.ort.secilebilir(h) || (this.zorunlu && !esit(h, this.zorunlu.kaynak))) {
        this.mod = 'yok';
        return;
      }
      this.cb.iptal();
      this.secili = h;
      this.kaynak = h;
      this.mod = 'kaynak';
      this.cb.basladi(h);
    }
    if (this.mod !== 'kaynak' && this.mod !== 'ayniSecili') return;
    const k = this.kaynak!;
    const hedef = this.hedefHesapla(x, y);
    this.hedef = hedef;
    this.cb.surukleniyor(k, hedef, { x, y });
  }

  /** Basma noktasından eşiği aştıysa baskın eksendeki komşu (sürüklü olur); değilse null. */
  private hedefHesapla(x: number, y: number): Konum | null {
    const dx = x - this.bas0.x;
    const dy = y - this.bas0.y;
    if (Math.hypot(dx, dy) <= ESIK_PX) return null;
    this.suruklu = true;
    const k = this.kaynak!;
    const yon = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    const g = this.ort.geometri();
    const t = { x: k.x + yon.x, y: k.y + yon.y };
    if (t.x < 0 || t.y < 0 || t.x >= g.w || t.y >= g.h) return null;
    if (this.zorunlu && !esit(t, this.zorunlu.hedef)) return null;
    return t;
  }

  birak(id: number, x: number, y: number): void {
    if (id !== this.pointer) return;
    this.pointer = null;
    const mod = this.mod;
    this.mod = 'yok';
    if (this.kipGirdi === 'kapali') return;
    if (mod === 'ikinci') {
      const kaynak = this.secili!;
      const hedef = this.ikinciHucre!;
      this.secili = null;
      this.ikinciHucre = null;
      this.cb.birakildi({ tur: 'surukle', kaynak: { ...kaynak }, hedef: { ...hedef } });
      return;
    }
    if (mod !== 'kaynak' && mod !== 'ayniSecili') return;
    // Hızlı fiske: hareket olayı gelmeden bırakıldıysa hedef bırakma noktasından.
    if (!this.suruklu) this.hedef = this.hedefHesapla(x, y);
    const k = this.kaynak!;
    if (this.suruklu) {
      const hedef = this.hedef;
      this.secili = null;
      this.suruklu = false;
      this.hedef = null;
      if (hedef) this.cb.birakildi({ tur: 'surukle', kaynak: { ...k }, hedef: { ...hedef } });
      else this.cb.iptal();
      return;
    }
    if (mod === 'ayniSecili') {
      this.secili = null;
      this.cb.iptal();
    }
    // 'kaynak' + eşik altı: dokun-dokun seçimi kalır.
  }

  /** pointercancel / lostpointercapture. */
  iptalEt(id: number): void {
    if (id !== this.pointer) return;
    this.pointer = null;
    const vardi = this.mod !== 'yok' || this.secili;
    this.mod = 'yok';
    this.secili = null;
    this.suruklu = false;
    this.hedef = null;
    if (vardi) this.cb.iptal();
  }

  /** Klavye (§3.2). İşlenirse true (varsayılan davranış engellenmeli). */
  tus(key: string): boolean {
    const yon = YON_TUSLARI[key];
    const secTusu = key === 'Enter' || key === ' ' || key === 'Spacebar';
    if (!yon && !secTusu && key !== 'Escape') return false;
    this.cb.dokunuldu();
    if (this.kipGirdi === 'kapali') return true;
    const g = this.ort.geometri();
    if (key === 'Escape') {
      if (this.secili) {
        this.secili = null;
        this.cb.iptal();
      } else if (this.imlec) {
        this.imlec = null;
        this.cb.imlecDegisti?.(null);
      }
      return true;
    }
    if (!this.imlec) {
      this.imlec = this.zorunlu ? { ...this.zorunlu.kaynak } : this.secili ? { ...this.secili } : { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) };
      this.cb.imlecDegisti?.({ ...this.imlec });
      if (!secTusu && !this.secili) return true;
    }
    if (yon) {
      if (this.secili) {
        const kaynak = this.secili;
        const hedef = { x: kaynak.x + yon.x, y: kaynak.y + yon.y };
        if (hedef.x < 0 || hedef.y < 0 || hedef.x >= g.w || hedef.y >= g.h) return true;
        if (this.zorunlu && !esit(hedef, this.zorunlu.hedef)) {
          this.cb.kisitliBasildi?.(hedef);
          return true;
        }
        this.secili = null;
        this.cb.birakildi({ tur: 'surukle', kaynak: { ...kaynak }, hedef });
        return true;
      }
      const yeni = { x: Math.max(0, Math.min(g.w - 1, this.imlec.x + yon.x)), y: Math.max(0, Math.min(g.h - 1, this.imlec.y + yon.y)) };
      if (!esit(yeni, this.imlec)) {
        this.imlec = yeni;
        this.cb.imlecDegisti?.({ ...yeni });
      }
      return true;
    }
    // Enter / Boşluk.
    const k = this.imlec;
    if (esit(this.secili, k)) {
      this.secili = null;
      this.cb.iptal();
      return true;
    }
    if (this.zorunlu && !esit(k, this.zorunlu.kaynak)) {
      this.cb.kisitliBasildi?.({ ...k });
      return true;
    }
    if (!this.ort.secilebilir(k)) return true;
    if (this.secili) this.cb.iptal();
    this.secili = { ...k };
    this.cb.basladi({ ...k });
    return true;
  }
}
