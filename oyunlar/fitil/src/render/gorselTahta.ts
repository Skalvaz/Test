/**
 * Görsel tahta (GDD §16.1 kuralı): çizici kendi tahtasını yalnız olaylarla
 * günceller; oynatma sonunda çekirdeğin `sonraki` durumuyla karşılaştırılır
 * (geliştirme kipinde fark varsa uyarı) ve eşitlenir.
 *
 * Bu modül DOM kullanmaz (vitest'te sınanır). Mantıksal alanlar `Hucre` ile
 * aynıdır; ek olarak her hücrede içeriğin canlandırma durumu tutulur.
 */
import type { Icerik, Konum, Olay, OyunDurumu } from '../core/types';
import { karma01, yayAdim, type YayDurumu } from './matematik';

export const DUSME_MS = 90; // ·√d (§12.2)
export const INIS_MS = 80;
export const KARISTIRMA_MS = 500;
export const ISI_DOLUM_MS = 120;
export const KIZGIN_MS = 150;
export const NABIZ_MS = 160;
export const GERI_AL_MS = 120;
export const ISIK_MS = 300;

export interface GHucre {
  delik: boolean;
  icerik: Icerik | null;
  kafes: boolean;
  doseme: 0 | 1 | 2;
  /** Bölüm başındaki döşeme katı: 0'a inince "aydınlanmış karo" çizilir. */
  ilkDoseme: number;
  desenRengi: number;
  desenBoyali: boolean;
  izIndeksi: number;
  izYandi: boolean;
  isikIzi: boolean;

  // --- İçerik canlandırması (içerikle birlikte taşınır) ---
  /** İçerik ofseti (hücre birimi). */
  ox: number;
  oy: number;
  /** 0 yok, 1 düşme (inQuad), 2 karıştırma (Bezier, inOutCubic). */
  hTur: number;
  hT: number;
  hSure: number;
  hx0: number;
  hy0: number;
  hcx: number;
  hcy: number;
  /** İniş ezilmesi için geçen süre (ms, < 0 pasif). */
  inis: number;
  /** Ölçek yayı (düğüm eklendi) ve hedefi. */
  olcek: YayDurumu;
  olcekHedef: number;
  /** Geri alma: 1,1→1 (120 ms outCubic) için geçen süre (< 0 pasif). */
  geriAl: number;
  /** Isı nabzı (160 ms) için geçen süre (< 0 pasif). */
  nabiz: number;
  /** Görünen dolu yuva sayısı (kesirli; 120 ms'de dolar). */
  isiGorunen: number;
  /** Beyaz-sıcak çekirdek görünürlüğü 0..1 (150 ms). */
  kizgin: number;
  /** Özel taş oluşumu/kuruma "pop" için geçen süre (< 0 pasif). */
  pop: number;
  /** Dev fişek dolum tıkırtısı (120 ms) için geçen süre (< 0 pasif). */
  dolumNabiz: number;
  /** Dev fişek fırlama öncesi titreme kalan ms. */
  titreme: number;
  /** Kaya/kova hasar sarsıntısı kalan ms. */
  hasar: number;
  /** İçerik geçici olarak çizilmez (örn. havalanan yüklü taş). */
  gizli: boolean;

  // --- Zemin canlandırması ---
  /** Işık izi dairesel maske 0..1 (300 ms). */
  isikAcilis: number;
  /** Döşeme aydınlanma maskesi 0..1. */
  dosemeAcilis: number;
  /** Desen boyanma parıltısı 0..1. */
  desenAcilis: number;
  /** Nefes/titreşim fazı. */
  faz: number;
}

function yeniHucre(i: number): GHucre {
  return {
    delik: false,
    icerik: null,
    kafes: false,
    doseme: 0,
    ilkDoseme: 0,
    desenRengi: -1,
    desenBoyali: false,
    izIndeksi: -1,
    izYandi: false,
    isikIzi: false,
    ox: 0,
    oy: 0,
    hTur: 0,
    hT: 0,
    hSure: 0,
    hx0: 0,
    hy0: 0,
    hcx: 0,
    hcy: 0,
    inis: -1,
    olcek: { x: 1, v: 0 },
    olcekHedef: 1,
    geriAl: -1,
    nabiz: -1,
    isiGorunen: 0,
    kizgin: 0,
    pop: -1,
    dolumNabiz: -1,
    titreme: 0,
    hasar: 0,
    gizli: false,
    isikAcilis: 1,
    dosemeAcilis: 1,
    desenAcilis: 1,
    faz: karma01(i, 7) * Math.PI * 2,
  };
}

const kopya = (ic: Icerik | null): Icerik | null => (ic ? ({ ...ic } as Icerik) : null);

/** İçerikle taşınan canlandırma alanları. */
function animTasi(a: GHucre, b: GHucre): void {
  b.isiGorunen = a.isiGorunen;
  b.kizgin = a.kizgin;
  b.olcek.x = a.olcek.x;
  b.olcek.v = a.olcek.v;
  b.olcekHedef = a.olcekHedef;
  b.pop = a.pop;
  b.titreme = a.titreme;
  b.gizli = false;
}

function animSifirla(h: GHucre): void {
  h.ox = 0;
  h.oy = 0;
  h.hTur = 0;
  h.inis = -1;
  h.olcek.x = 1;
  h.olcek.v = 0;
  h.olcekHedef = 1;
  h.geriAl = -1;
  h.nabiz = -1;
  h.pop = -1;
  h.dolumNabiz = -1;
  h.titreme = 0;
  h.hasar = 0;
  h.gizli = false;
  const ic = h.icerik;
  h.isiGorunen = ic?.tur === 'kapsul' ? ic.isi : 0;
  h.kizgin = 0;
}

export class GorselTahta {
  w = 0;
  h = 0;
  esik = 4;
  gizliIsi = false;
  hucreler: GHucre[] = [];
  /** Barut izleri (hücre indeksleri, sıralı). */
  izler: number[][] = [];
  /** Uyarılar (dev kipte console.warn'a gider). */
  uyari: (m: string) => void = () => {};

  /** Durumdan sıfırdan kur (bölüm başı). */
  kur(d: OyunDurumu): void {
    this.w = d.w;
    this.h = d.h;
    this.esik = d.esik;
    this.gizliIsi = !!d.kurallar.gizliIsi;
    this.hucreler = d.hucreler.map((_, i) => yeniHucre(i));
    this.izler = d.izler.map((z) => [...z.hucreler]);
    this.esitle(d, true);
    for (const h of this.hucreler) h.ilkDoseme = h.doseme;
  }

  /** Animasyonsuz eşitleme. `hepsi` false ise yalnız farklı hücreler sıfırlanır. */
  esitle(d: OyunDurumu, hepsi = false): number {
    if (d.w !== this.w || d.h !== this.h || this.hucreler.length !== d.hucreler.length) {
      this.kur(d);
      return d.w * d.h;
    }
    this.esik = d.esik;
    this.gizliIsi = !!d.kurallar.gizliIsi;
    this.izler = d.izler.map((z) => [...z.hucreler]);
    const yanan = this.izYandiKumesi(d);
    let fark = 0;
    d.hucreler.forEach((s, i) => {
      const g = this.hucreler[i];
      const izY = yanan.has(i);
      const ayni =
        g.delik === s.delik &&
        icerikEsit(g.icerik, s.icerik) &&
        g.kafes === s.kafes &&
        g.doseme === s.doseme &&
        g.desenRengi === s.desenRengi &&
        g.desenBoyali === s.desenBoyali &&
        g.izIndeksi === s.izIndeksi &&
        g.isikIzi === s.isikIzi &&
        g.izYandi === izY;
      if (ayni && !hepsi) return;
      if (!ayni) fark++;
      const icDegisti = !icerikEsit(g.icerik, s.icerik);
      g.delik = s.delik;
      g.icerik = kopya(s.icerik);
      g.kafes = s.kafes;
      g.doseme = s.doseme;
      g.ilkDoseme = Math.max(g.ilkDoseme, s.doseme);
      g.desenRengi = s.desenRengi;
      g.desenBoyali = s.desenBoyali;
      g.izIndeksi = s.izIndeksi;
      g.izYandi = izY;
      g.isikIzi = s.isikIzi;
      if (hepsi || icDegisti) animSifirla(g);
    });
    return fark;
  }

  private izYandiKumesi(d: OyunDurumu): Set<number> {
    const s = new Set<number>();
    d.izler.forEach((z) => z.hucreler.forEach((i, k) => z.yandi[k] && s.add(i)));
    return s;
  }

  /** Görsel tahta ile durum arasındaki farklar (boş = eşit). */
  farklar(d: OyunDurumu): string[] {
    const f: string[] = [];
    if (d.w !== this.w || d.h !== this.h) return [`boyut ${this.w}×${this.h} ≠ ${d.w}×${d.h}`];
    const yanan = this.izYandiKumesi(d);
    d.hucreler.forEach((s, i) => {
      const g = this.hucreler[i];
      const yer = `(${i % d.w},${Math.floor(i / d.w)})`;
      if (!icerikEsit(g.icerik, s.icerik)) f.push(`${yer} içerik ${JSON.stringify(g.icerik)} ≠ ${JSON.stringify(s.icerik)}`);
      if (g.kafes !== s.kafes) f.push(`${yer} kafes ${g.kafes} ≠ ${s.kafes}`);
      if (g.doseme !== s.doseme) f.push(`${yer} döşeme ${g.doseme} ≠ ${s.doseme}`);
      if (g.desenBoyali !== s.desenBoyali) f.push(`${yer} desen ${g.desenBoyali} ≠ ${s.desenBoyali}`);
      if (g.isikIzi !== s.isikIzi) f.push(`${yer} ışık izi ${g.isikIzi} ≠ ${s.isikIzi}`);
      if (g.izYandi !== yanan.has(i)) f.push(`${yer} iz ${g.izYandi} ≠ ${yanan.has(i)}`);
      if (g.delik !== s.delik) f.push(`${yer} delik`);
    });
    return f;
  }

  idx(p: Konum): number {
    return p.y * this.w + p.x;
  }

  hucre(p: Konum): GHucre | null {
    if (p.x < 0 || p.y < 0 || p.x >= this.w || p.y >= this.h) return null;
    return this.hucreler[p.y * this.w + p.x];
  }

  /**
   * Olayın mantıksal etkisini uygula ve hücre canlandırmalarını başlat.
   * Görsel efektler (parçacık, halka…) çiziciye aittir.
   */
  uygula(o: Olay): void {
    switch (o.tur) {
      case 'patlama': {
        const h = this.hucre(o.hucre);
        if (!h) return;
        if (h.icerik?.tur !== 'kapsul') this.uyari(`patlama: (${o.hucre.x},${o.hucre.y}) kapsül değil (${h.icerik?.tur ?? 'boş'})`);
        h.icerik = null;
        h.gizli = false;
        h.kizgin = 0;
        h.isiGorunen = 0;
        h.olcek.x = 1;
        h.olcek.v = 0;
        h.olcekHedef = 1;
        if (!h.isikIzi) {
          h.isikIzi = true;
          h.isikAcilis = 0;
        }
        return;
      }
      case 'isindi':
      case 'isiDegisti': {
        const h = this.hucre(o.hucre);
        const ic = h?.icerik;
        if (!h || ic?.tur !== 'kapsul') return;
        const once = ic.isi;
        ic.isi = o.isi;
        if (o.tur === 'isindi' || o.isi > once) h.nabiz = 0;
        if (o.isi < this.esik - 1) h.kizgin = Math.min(h.kizgin, 0.999);
        return;
      }
      case 'ozelOlustu': {
        const h = this.hucre(o.hucre);
        if (!h) return;
        h.icerik = { tur: 'kapsul', renk: o.ozel === 'yildiz' ? -1 : (o.renk as 0), isi: 0, ozel: o.ozel, eksen: o.eksen };
        h.isiGorunen = 0;
        h.kizgin = 0;
        h.pop = 0;
        h.gizli = false;
        return;
      }
      case 'engelHasar': {
        const h = this.hucre(o.hucre);
        const ic = h?.icerik;
        if (!h || !ic) return;
        if (ic.tur === 'kaya' || ic.tur === 'kova') {
          if (o.kalan <= 0) h.icerik = null;
          else ic.kat = o.kalan as 1;
          h.hasar = 140;
        }
        return;
      }
      case 'kafesKirildi': {
        const h = this.hucre(o.hucre);
        if (h) h.kafes = false;
        return;
      }
      case 'kurudu': {
        const h = this.hucre(o.hucre);
        if (!h) return;
        h.icerik = { tur: 'kapsul', renk: o.renk as 0, isi: 0, ozel: 'yok', eksen: 0 };
        h.isiGorunen = 0;
        h.pop = 0;
        return;
      }
      case 'dosemeAydinlandi': {
        const h = this.hucre(o.hucre);
        if (!h) return;
        h.doseme = Math.max(0, o.kalan) as 0;
        h.dosemeAcilis = 0;
        return;
      }
      case 'desenBoyandi': {
        const h = this.hucre(o.hucre);
        if (!h) return;
        h.desenBoyali = true;
        h.desenAcilis = 0;
        return;
      }
      case 'izYandi': {
        const h = this.hucre(o.hucre);
        if (h) h.izYandi = true;
        return;
      }
      case 'devFisekDoldu': {
        const h = this.hucre(o.hucre);
        const ic = h?.icerik;
        if (!h || ic?.tur !== 'devFisek') return;
        ic.dolum = o.dolum;
        ic.kapasite = o.kapasite;
        h.dolumNabiz = 0;
        if (o.dolum >= o.kapasite) h.titreme = 150;
        return;
      }
      case 'devFisekFirladi':
      case 'isTemizlendi':
      case 'fenerToplandi': {
        const h = this.hucre(o.hucre);
        if (h) h.icerik = null;
        return;
      }
      case 'isYayildi': {
        const h = this.hucre(o.hucre);
        if (!h) return;
        h.icerik = { tur: 'is' };
        h.pop = 0;
        h.kizgin = 0;
        h.isiGorunen = 0;
        return;
      }
      case 'yercekimi':
        this.yercekimi(o.dusenler, o.doganlar);
        return;
      case 'karistirma':
        this.karistir(o.esleme, o.yenidenRenk);
        return;
      default:
        return;
    }
  }

  private yercekimi(dusenler: { den: Konum; e: Konum }[], doganlar: { hucre: Konum; icerik: Icerik; sanalY: number }[]): void {
    // Önce hepsini topla, sonra yerleştir (zincirleme kaymalar için).
    const tasinan = dusenler.map((m) => {
      const h = this.hucre(m.den);
      return { m, ic: h?.icerik ?? null, kaynak: h ? { ...h, olcek: { ...h.olcek } } : null };
    });
    for (const { m } of tasinan) {
      const h = this.hucre(m.den);
      if (h) h.icerik = null;
    }
    for (const { m, ic, kaynak } of tasinan) {
      const h = this.hucre(m.e);
      if (!h) continue;
      if (!ic) this.uyari(`yerçekimi: (${m.den.x},${m.den.y}) boş`);
      h.icerik = ic;
      if (kaynak) animTasi(kaynak, h);
      this.dusur(h, m.den.x - m.e.x, m.den.y - m.e.y);
    }
    for (const d of doganlar) {
      const h = this.hucre(d.hucre);
      if (!h) continue;
      h.icerik = kopya(d.icerik);
      animSifirla(h);
      this.dusur(h, 0, d.sanalY - d.hucre.y);
    }
  }

  private dusur(h: GHucre, dx: number, dy: number): void {
    const d = Math.hypot(dx, dy);
    if (d <= 0) return;
    h.hTur = 1;
    h.hT = 0;
    h.hSure = DUSME_MS * Math.sqrt(d);
    h.hx0 = dx;
    h.hy0 = dy;
    h.ox = dx;
    h.oy = dy;
    h.inis = -1;
  }

  private karistir(esleme: { den: Konum; e: Konum }[], yenidenRenk: { hucre: Konum; renk: number }[]): void {
    const tasinan = esleme.map((m) => {
      const h = this.hucre(m.den);
      return { m, ic: h?.icerik ?? null, kaynak: h ? { ...h, olcek: { ...h.olcek } } : null };
    });
    for (const { m } of tasinan) {
      const h = this.hucre(m.den);
      if (h) h.icerik = null;
    }
    tasinan.forEach(({ m, ic, kaynak }, k) => {
      const h = this.hucre(m.e);
      if (!h) return;
      h.icerik = ic;
      if (kaynak) animTasi(kaynak, h);
      const dx = m.den.x - m.e.x;
      const dy = m.den.y - m.e.y;
      if (dx === 0 && dy === 0) return;
      // Kalkıp yay çizen yol: kontrol noktası dikme yönünde kaydırılmış orta nokta.
      const yon = karma01(k, m.e.x * 31 + m.e.y) < 0.5 ? -1 : 1;
      h.hTur = 2;
      h.hT = 0;
      h.hSure = KARISTIRMA_MS;
      h.hx0 = dx;
      h.hy0 = dy;
      h.hcx = dx / 2 - dy * 0.45 * yon;
      h.hcy = dy / 2 + dx * 0.45 * yon - 0.6;
      h.ox = dx;
      h.oy = dy;
    });
    for (const r of yenidenRenk) {
      const h = this.hucre(r.hucre);
      if (h?.icerik?.tur === 'kapsul' && h.icerik.ozel !== 'yildiz') {
        h.icerik.renk = r.renk as 0;
        h.pop = 0;
      }
    }
  }

  /** Canlandırmaları ilerlet (dt: oyun ms'i). Hareket sürüyorsa true. */
  guncelle(dt: number): boolean {
    let hareket = false;
    const sn = dt / 1000;
    for (const h of this.hucreler) {
      if (h.delik) continue;
      if (h.hTur) {
        hareket = true;
        h.hT += dt;
        const t = Math.min(1, h.hT / h.hSure);
        if (h.hTur === 1) {
          const e = t * t; // inQuad
          h.ox = h.hx0 * (1 - e);
          h.oy = h.hy0 * (1 - e);
        } else {
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const u = 1 - e;
          h.ox = u * u * h.hx0 + 2 * u * e * h.hcx;
          h.oy = u * u * h.hy0 + 2 * u * e * h.hcy;
        }
        if (t >= 1) {
          if (h.hTur === 1) h.inis = 0;
          h.hTur = 0;
          h.ox = 0;
          h.oy = 0;
        }
      }
      if (h.inis >= 0) {
        h.inis += dt;
        if (h.inis >= INIS_MS) h.inis = -1;
        else hareket = true;
      }
      if (h.olcek.x !== h.olcekHedef || Math.abs(h.olcek.v) > 1e-4) {
        yayAdim(h.olcek, h.olcekHedef, 400, 18, sn);
        if (Math.abs(h.olcek.x - h.olcekHedef) < 1e-4 && Math.abs(h.olcek.v) < 1e-3) {
          h.olcek.x = h.olcekHedef;
          h.olcek.v = 0;
        }
      }
      if (h.geriAl >= 0) {
        h.geriAl += dt;
        if (h.geriAl >= GERI_AL_MS) h.geriAl = -1;
      }
      if (h.nabiz >= 0) {
        h.nabiz += dt;
        if (h.nabiz >= NABIZ_MS) h.nabiz = -1;
      }
      if (h.pop >= 0) {
        h.pop += dt;
        if (h.pop >= 320) h.pop = -1;
      }
      if (h.dolumNabiz >= 0) {
        h.dolumNabiz += dt;
        if (h.dolumNabiz >= 120) h.dolumNabiz = -1;
      }
      if (h.titreme > 0) h.titreme = Math.max(0, h.titreme - dt);
      if (h.hasar > 0) h.hasar = Math.max(0, h.hasar - dt);
      const ic = h.icerik;
      if (ic?.tur === 'kapsul') {
        const hedef = ic.isi;
        if (h.isiGorunen < hedef) h.isiGorunen = Math.min(hedef, h.isiGorunen + dt / ISI_DOLUM_MS);
        else if (h.isiGorunen > hedef) h.isiGorunen = Math.max(hedef, h.isiGorunen - dt / ISI_DOLUM_MS);
        const kz = ic.isi >= this.esik - 1 ? 1 : 0;
        if (h.kizgin < kz) h.kizgin = Math.min(1, h.kizgin + dt / KIZGIN_MS);
        else if (h.kizgin > kz) h.kizgin = Math.max(0, h.kizgin - dt / KIZGIN_MS);
      }
      if (h.isikAcilis < 1) h.isikAcilis = Math.min(1, h.isikAcilis + dt / ISIK_MS);
      if (h.dosemeAcilis < 1) h.dosemeAcilis = Math.min(1, h.dosemeAcilis + dt / ISIK_MS);
      if (h.desenAcilis < 1) h.desenAcilis = Math.min(1, h.desenAcilis + dt / 450);
    }
    return hareket;
  }

  /** Düşme ya da karıştırma sürüyor mu. */
  hareketVar(): boolean {
    for (const h of this.hucreler) if (h.hTur || h.inis >= 0) return true;
    return false;
  }
}

export function icerikEsit(a: Icerik | null, b: Icerik | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.tur !== b.tur) return false;
  switch (a.tur) {
    case 'kapsul': {
      const k = b as typeof a;
      return a.renk === k.renk && a.isi === k.isi && a.ozel === k.ozel && (a.ozel === 'yok' || a.ozel === 'kasimpati' || a.ozel === 'yildiz' || a.eksen === k.eksen);
    }
    case 'islak':
      return a.renk === (b as typeof a).renk;
    case 'kaya':
    case 'kova':
      return a.kat === (b as typeof a).kat;
    case 'devFisek':
      return a.dolum === (b as typeof a).dolum && a.kapasite === (b as typeof a).kapasite;
    default:
      return true;
  }
}
