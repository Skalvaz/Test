/**
 * Görsel tahta (GDD §13.2, FİTİL dersi 1): çizici kendi tahtasını YALNIZ
 * olaylarla günceller; oynatma sonunda çekirdeğin `sonraki` durumuyla
 * karşılaştırılır (geliştirme kipinde fark varsa konsola hata) ve eşitlenir.
 *
 * DOM yok (vitest'te sınanır). Mantıksal alanlar `Hucre` ile aynıdır; her
 * damla bir `GDamla` nesnesidir ve canlandırma durumu damlayla birlikte
 * taşınır (düşen damlanın ofseti, karışım girdabı, iniş ezilmesi…).
 *
 * `ozelSuruklendi{tasindi}`: taş kaynaktan kalkar ve hedefte tüketilir
 * (P1 çekirdeği, `src/core/oynatici.ts` ile aynı anlam); kayması çizicinin
 * efektidir. `ezilen` listesi eski olay sırasına karşı sağlamlık içindir.
 */
import type { Damla, Konum, Olay, OyunDurumu, OzelTur, Renk, Yon } from '../core/types';
import { inOutCubic, inQuad, outBack, outCubic, karma01 } from './matematik';

export const DUSME_MS = 90; // ·√d (§10.2)
export const INIS_MS = 80;
export const DOGUM_ALFA_MS = 60;
export const KARISIM_MS = 220;
export const KARISTIRMA_MS = 500;
export const TOPLANMA_MS = 120;
export const KAYMA_MS = 120;
export const POP_MS = 160;
export const TITRE_MS = 180;

export interface GDamla {
  id: number;
  renk: Renk | 0;
  ozel: OzelTur;
  yon: Yon;
  /** Anlık ofset (hücre birimi, hücre merkezinden). */
  ox: number;
  oy: number;
  /** Hareket: 0 yok, 1 düşme (inQuad), 2 karıştırma (Bezier, inOutCubic), 3 kayma (outCubic), 4 toplanma (inQuad). */
  hTur: number;
  hT: number;
  hSure: number;
  hx0: number;
  hy0: number;
  /** Bezier kontrol noktası (hücre birimi, hedefe göre). */
  hcx: number;
  hcy: number;
  /** Toplanma hedefi (hücre birimi, hücre merkezine göre). */
  hx1: number;
  hy1: number;
  /** İniş ezilmesi geçen süre (ms, < 0 pasif). */
  inis: number;
  /** Doğum alfa girişi geçen süre (ms, < 0 pasif). */
  alfaT: number;
  /** Belirme "pop" (outBack) geçen süre (< 0 pasif). */
  pop: number;
  /** Karışım girdabı geçen süre (< 0 pasif) ve iki kaynak renk. */
  karisim: number;
  ka: Renk | 0;
  kb: Renk | 0;
  /** Titreme kalan ms (geçersiz bırakma). */
  titre: number;
  /** Nefes fazı (id'den). */
  faz: number;
}

export interface GMermer {
  can: 1 | 2 | 3;
  ilkCan: number;
  /** Hasar sarsıntısı kalan ms. */
  hasar: number;
  cesit: number;
}

export type GIcerik = { tur: 'damla'; d: GDamla } | { tur: 'mermer'; m: GMermer };

export interface GHucre {
  delik: boolean;
  icerik: GIcerik | null;
  kagit: 0 | 1 | 2;
  yag: boolean;
  desen: 0 | 3 | 5 | 6;
  desenBoyali: boolean;
  /** Desen boyanma açılışı 0..1 (300 ms). */
  desenAcilis: number;
}

export function gDamla(d: Damla): GDamla {
  return {
    id: d.id,
    renk: d.renk,
    ozel: d.ozel,
    yon: d.yon,
    ox: 0,
    oy: 0,
    hTur: 0,
    hT: 0,
    hSure: 0,
    hx0: 0,
    hy0: 0,
    hcx: 0,
    hcy: 0,
    hx1: 0,
    hy1: 0,
    inis: -1,
    alfaT: -1,
    pop: -1,
    karisim: -1,
    ka: 0,
    kb: 0,
    titre: 0,
    faz: karma01(d.id, 77) * 6.283,
  };
}

const ayniDamla = (g: GDamla, d: Damla) => g.id === d.id && g.renk === d.renk && g.ozel === d.ozel && g.yon === d.yon;

export class GorselTahta {
  w = 0;
  h = 0;
  hucreler: GHucre[] = [];
  puan = 0;
  hedefler: { ilerleme: number; gerekli: number; tamam: boolean }[] = [];
  bitti: OyunDurumu['bitti'] = null;
  /** Özel taşın taşındığı hücrelerde yerinden edilen damlalar (temizlendi bekler). */
  ezilen: { hucre: Konum; d: GDamla }[] = [];
  /** Uygulanamayan (önkoşulu tutmayan) olay sayısı (geliştirme uyarısı). */
  uyumsuz = 0;

  kur(d: OyunDurumu): void {
    this.w = d.w;
    this.h = d.h;
    this.hucreler = d.hucreler.map((h, i) => ({
      delik: h.delik,
      icerik: this.icerikKur(h.icerik, i),
      kagit: h.kagit,
      yag: h.yag,
      desen: h.desen,
      desenBoyali: h.desenBoyali,
      desenAcilis: h.desenBoyali ? 1 : 0,
    }));
    this.puan = d.puan;
    this.hedefler = d.hedefler.map((h) => ({ ilerleme: h.ilerleme, gerekli: h.gerekli, tamam: h.tamam }));
    this.bitti = d.bitti;
    this.ezilen = [];
    this.uyumsuz = 0;
  }

  private icerikKur(ic: OyunDurumu['hucreler'][number]['icerik'], i: number): GIcerik | null {
    if (!ic) return null;
    if (ic.tur === 'damla') return { tur: 'damla', d: gDamla(ic.damla) };
    return { tur: 'mermer', m: { can: ic.can, ilkCan: ic.can, hasar: 0, cesit: Math.floor(karma01(i, 5) * 4) } };
  }

  hucre(k: Konum): GHucre | undefined {
    if (k.x < 0 || k.y < 0 || k.x >= this.w || k.y >= this.h) return undefined;
    return this.hucreler[k.y * this.w + k.x];
  }

  damla(k: Konum): GDamla | null {
    const h = this.hucre(k);
    return h && h.icerik && h.icerik.tur === 'damla' ? h.icerik.d : null;
  }

  /** Tek olayı uygular (zaman çizelgesinde olay anında). */
  uygula(o: Olay): void {
    switch (o.tur) {
      case 'karisti': {
        const k = this.hucre(o.kaynak);
        const e = this.hucre(o.hedef);
        if (!k || !e) return void this.uyumsuz++;
        k.icerik = null;
        const g = gDamla({ id: o.yeniId, renk: o.sonuc, ozel: o.sonuc === 7 ? 'murekkep' : 'yok', yon: 'yatay' });
        g.karisim = 0;
        g.ka = o.a;
        g.kb = o.b;
        e.icerik = { tur: 'damla', d: g };
        return;
      }
      case 'ozelSuruklendi': {
        // P1 anlamı: `tasindi` ise taş kaynaktan kalkar ve hedefte TÜKETİLİR (hedefe
        // yazılmaz; kayma çizicinin efektidir). Değilse tahta değişmez.
        if (!o.tasindi) return;
        const k = this.hucre(o.kaynak);
        if (!k || !k.icerik || k.icerik.tur !== 'damla') return void this.uyumsuz++;
        k.icerik = null;
        return;
      }
      case 'eslesti': {
        for (const c of o.hucreler) {
          const g = this.damla(c);
          if (!g) continue;
          g.hTur = 4;
          g.hT = 0;
          g.hSure = TOPLANMA_MS;
          g.hx0 = g.ox;
          g.hy0 = g.oy;
          g.hx1 = (o.merkez.x - c.x) * 0.42;
          g.hy1 = (o.merkez.y - c.y) * 0.42;
        }
        return;
      }
      case 'temizlendi': {
        this.puan += o.puan;
        const h = this.hucre(o.hucre);
        if (!h) return void this.uyumsuz++;
        if (h.icerik && h.icerik.tur === 'damla' && h.icerik.d.id === o.id) {
          h.icerik = null;
          return;
        }
        const j = this.ezilen.findIndex((e) => e.d.id === o.id);
        if (j >= 0) {
          this.ezilen.splice(j, 1);
          return;
        }
        this.uyumsuz++;
        if (h.icerik && h.icerik.tur === 'damla') h.icerik = null;
        return;
      }
      case 'ozelOlustu': {
        const h = this.hucre(o.hucre);
        if (!h) return void this.uyumsuz++;
        if (h.icerik) this.uyumsuz++;
        const g = gDamla(o.damla);
        g.pop = 0;
        h.icerik = { tur: 'damla', d: g };
        return;
      }
      case 'donustu': {
        const h = this.hucre(o.hucre);
        if (!h) return void this.uyumsuz++;
        const eski = h.icerik && h.icerik.tur === 'damla' ? h.icerik.d : null;
        const g = gDamla(o.damla);
        if (eski) {
          g.ox = eski.ox;
          g.oy = eski.oy;
        }
        g.pop = 0;
        h.icerik = { tur: 'damla', d: g };
        return;
      }
      case 'mermerHasar': {
        const h = this.hucre(o.hucre);
        if (!h || !h.icerik || h.icerik.tur !== 'mermer') return void this.uyumsuz++;
        if (o.kalan === 0) h.icerik = null;
        else {
          h.icerik.m.can = o.kalan;
          h.icerik.m.hasar = 220;
        }
        return;
      }
      case 'kagitAlindi': {
        const h = this.hucre(o.hucre);
        if (!h) return void this.uyumsuz++;
        h.kagit = o.kalan;
        return;
      }
      case 'yagKalkti': {
        const h = this.hucre(o.hucre);
        if (!h) return void this.uyumsuz++;
        h.yag = false;
        return;
      }
      case 'desenBoyandi': {
        const h = this.hucre(o.hucre);
        if (!h) return void this.uyumsuz++;
        h.desenBoyali = true;
        h.desenAcilis = 0;
        return;
      }
      case 'yercekimi': {
        const tasinan: { g: GDamla; den: Konum; e: Konum }[] = [];
        for (const m of o.dusenler) {
          const g = this.damla(m.den);
          if (!g) {
            this.uyumsuz++;
            continue;
          }
          tasinan.push({ g, den: m.den, e: m.e });
          this.hucre(m.den)!.icerik = null;
        }
        for (const { g, den, e } of tasinan) {
          const h = this.hucre(e);
          if (!h) continue;
          if (h.icerik) this.uyumsuz++;
          this.dusur(g, den.x - e.x + g.ox, den.y - e.y + g.oy);
          h.icerik = { tur: 'damla', d: g };
        }
        for (const dg of o.doganlar) {
          const h = this.hucre(dg.hucre);
          if (!h) continue;
          if (h.icerik) this.uyumsuz++;
          const g = gDamla(dg.damla);
          this.dusur(g, 0, dg.sanalY - dg.hucre.y);
          g.alfaT = 0;
          h.icerik = { tur: 'damla', d: g };
        }
        return;
      }
      case 'karistirma': {
        const tasinan: { ic: GIcerik; den: Konum; e: Konum }[] = [];
        for (const m of o.esleme) {
          const h = this.hucre(m.den);
          if (!h || !h.icerik) {
            this.uyumsuz++;
            continue;
          }
          tasinan.push({ ic: h.icerik, den: m.den, e: m.e });
        }
        for (const t of tasinan) this.hucre(t.den)!.icerik = null;
        for (const t of tasinan) {
          const h = this.hucre(t.e);
          if (!h) continue;
          if (t.ic.tur === 'damla') {
            const g = t.ic.d;
            g.hTur = 2;
            g.hT = 0;
            g.hSure = KARISTIRMA_MS;
            g.hx0 = t.den.x - t.e.x;
            g.hy0 = t.den.y - t.e.y;
            // Kalkıp yay çizerek yer değiştir: kontrol noktası yola dik.
            const n = karma01(g.id, 3) < 0.5 ? -1 : 1;
            g.hcx = g.hx0 / 2 + g.hy0 * 0.45 * n;
            g.hcy = g.hy0 / 2 - g.hx0 * 0.45 * n - 0.6;
            g.ox = g.hx0;
            g.oy = g.hy0;
          }
          h.icerik = t.ic;
        }
        return;
      }
      case 'hedefIlerledi': {
        const h = this.hedefler[o.indeks];
        if (!h) return void this.uyumsuz++;
        h.ilerleme = o.deger;
        h.tamam = o.tamam;
        return;
      }
      case 'puanEklendi':
        this.puan += o.miktar;
        return;
      case 'bolumBitti':
        this.bitti = o.sonuc;
        return;
      default:
        return;
    }
  }

  private dusur(g: GDamla, dx: number, dy: number): void {
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) return;
    g.hTur = 1;
    g.hT = 0;
    g.hSure = DUSME_MS * Math.sqrt(d);
    g.hx0 = dx;
    g.hy0 = dy;
    g.ox = dx;
    g.oy = dy;
    g.inis = -1;
  }

  /** Canlandırmaları ilerlet (gerçek ms × oynatma hızı). */
  guncelle(dt: number): void {
    for (const h of this.hucreler) {
      if (h.desenBoyali && h.desenAcilis < 1) h.desenAcilis = Math.min(1, h.desenAcilis + dt / 300);
      const ic = h.icerik;
      if (!ic) continue;
      if (ic.tur === 'mermer') {
        if (ic.m.hasar > 0) ic.m.hasar = Math.max(0, ic.m.hasar - dt);
        continue;
      }
      this.damlaGuncelle(ic.d, dt);
    }
    for (const e of this.ezilen) this.damlaGuncelle(e.d, dt);
  }

  private damlaGuncelle(g: GDamla, dt: number): void {
    // İniş önce: bu adımda biten düşmenin ezilmesi taşan süre kadar başlar.
    if (g.inis >= 0) {
      g.inis += dt;
      if (g.inis >= INIS_MS) g.inis = -1;
    }
    if (g.hTur) {
      g.hT += dt;
      const t = Math.min(1, g.hT / g.hSure);
      switch (g.hTur) {
        case 1: {
          const k = 1 - inQuad(t);
          g.ox = g.hx0 * k;
          g.oy = g.hy0 * k;
          break;
        }
        case 2: {
          const u = inOutCubic(t);
          const a = 1 - u;
          // İkinci derece Bezier: başlangıç (hx0,hy0) → kontrol → 0.
          g.ox = a * a * g.hx0 + 2 * a * u * g.hcx;
          g.oy = a * a * g.hy0 + 2 * a * u * g.hcy;
          break;
        }
        case 3: {
          const k = 1 - outCubic(t);
          g.ox = g.hx0 * k;
          g.oy = g.hy0 * k;
          break;
        }
        case 4: {
          const u = inQuad(t);
          g.ox = g.hx0 + (g.hx1 - g.hx0) * u;
          g.oy = g.hy0 + (g.hy1 - g.hy0) * u;
          break;
        }
      }
      if (t >= 1) {
        // İniş ezilmesi düşmenin bittiği andan başlar (adımın artan kısmı kadar ilerlemiş).
        if (g.hTur === 1) g.inis = Math.max(0, g.hT - g.hSure);
        if (g.hTur !== 4) {
          g.ox = 0;
          g.oy = 0;
          g.hTur = 0;
        }
      }
    }
    if (g.alfaT >= 0) {
      g.alfaT += dt;
      if (g.alfaT >= DOGUM_ALFA_MS) g.alfaT = -1;
    }
    if (g.pop >= 0) {
      g.pop += dt;
      if (g.pop >= POP_MS) g.pop = -1;
    }
    if (g.karisim >= 0) {
      g.karisim += dt;
      if (g.karisim >= KARISIM_MS + 140) g.karisim = -1;
    }
    if (g.titre > 0) g.titre = Math.max(0, g.titre - dt);
  }

  /** Bütün canlandırmaları anında bitir. */
  bitir(): void {
    const son = (g: GDamla) => {
      g.ox = g.oy = 0;
      g.hTur = 0;
      g.inis = g.alfaT = g.pop = g.karisim = -1;
    };
    for (const h of this.hucreler) {
      h.desenAcilis = h.desenBoyali ? 1 : 0;
      if (h.icerik?.tur === 'damla') son(h.icerik.d);
      else if (h.icerik?.tur === 'mermer') h.icerik.m.hasar = 0;
    }
    this.ezilen = [];
  }

  /** Canlandırma sürüyor mu (oynatma sonunu beklemek için). */
  hareketli(): boolean {
    for (const h of this.hucreler) {
      const ic = h.icerik;
      if (ic?.tur === 'damla' && (ic.d.hTur || ic.d.inis >= 0 || ic.d.pop >= 0 || ic.d.karisim >= 0)) return true;
    }
    return false;
  }

  /** Görsel tahta ile durum arasındaki farklar (boş = eşit). */
  farklar(d: OyunDurumu): string[] {
    const out: string[] = [];
    if (d.w !== this.w || d.h !== this.h) return [`boyut ${this.w}×${this.h} ≠ ${d.w}×${d.h}`];
    for (let i = 0; i < d.hucreler.length; i++) {
      const a = this.hucreler[i];
      const b = d.hucreler[i];
      const yer = `(${i % d.w},${Math.floor(i / d.w)})`;
      if (a.delik !== b.delik) out.push(`${yer} delik`);
      if (a.kagit !== b.kagit) out.push(`${yer} kagit ${a.kagit}≠${b.kagit}`);
      if (a.yag !== b.yag) out.push(`${yer} yag`);
      if (a.desen !== b.desen || a.desenBoyali !== b.desenBoyali) out.push(`${yer} desen`);
      const ia = a.icerik;
      const ib = b.icerik;
      if (!ia && !ib) continue;
      if (!ia || !ib || (ia.tur === 'damla' ? 'damla' : 'mermer') !== ib.tur) {
        out.push(`${yer} içerik ${ia ? ia.tur : 'boş'}≠${ib ? ib.tur : 'boş'}`);
        continue;
      }
      if (ia.tur === 'damla' && ib.tur === 'damla' && !ayniDamla(ia.d, ib.damla))
        out.push(`${yer} damla ${ia.d.id}/${ia.d.renk}/${ia.d.ozel}≠${ib.damla.id}/${ib.damla.renk}/${ib.damla.ozel}`);
      if (ia.tur === 'mermer' && ib.tur === 'mermer' && ia.m.can !== ib.can) out.push(`${yer} mermer ${ia.m.can}≠${ib.can}`);
    }
    if (this.puan !== d.puan) out.push(`puan ${this.puan}≠${d.puan}`);
    d.hedefler.forEach((h, i) => {
      const g = this.hedefler[i];
      if (!g || g.ilerleme !== h.ilerleme || g.tamam !== h.tamam) out.push(`hedef ${i}`);
    });
    if (this.bitti !== d.bitti) out.push(`bitti ${this.bitti}≠${d.bitti}`);
    return out;
  }

  /** `sonraki` ile eşitle: aynı kimlikli damlaların canlandırması korunur. */
  esitle(d: OyunDurumu): void {
    if (d.w !== this.w || d.h !== this.h) {
      this.kur(d);
      return;
    }
    for (let i = 0; i < d.hucreler.length; i++) {
      const a = this.hucreler[i];
      const b = d.hucreler[i];
      a.delik = b.delik;
      a.kagit = b.kagit;
      a.yag = b.yag;
      if (a.desenBoyali !== b.desenBoyali) a.desenAcilis = b.desenBoyali ? 1 : 0;
      a.desen = b.desen;
      a.desenBoyali = b.desenBoyali;
      const ib = b.icerik;
      if (!ib) {
        a.icerik = null;
        continue;
      }
      if (ib.tur === 'damla') {
        if (a.icerik?.tur === 'damla' && ayniDamla(a.icerik.d, ib.damla)) {
          const g = a.icerik.d;
          if (g.hTur === 4) {
            g.hTur = 0;
            g.ox = g.oy = 0;
          }
          continue;
        }
        a.icerik = { tur: 'damla', d: gDamla(ib.damla) };
      } else {
        if (a.icerik?.tur === 'mermer') a.icerik.m.can = ib.can;
        else a.icerik = { tur: 'mermer', m: { can: ib.can, ilkCan: ib.can, hasar: 0, cesit: Math.floor(karma01(i, 5) * 4) } };
      }
    }
    this.puan = d.puan;
    this.hedefler = d.hedefler.map((h) => ({ ilerleme: h.ilerleme, gerekli: h.gerekli, tamam: h.tamam }));
    this.bitti = d.bitti;
    this.ezilen = [];
  }
}

/** Damlanın çizim ölçeği (pop, iniş ezilmesi, karışım zıplaması); nefes ayrı. */
export function damlaOlcegi(g: GDamla): { sx: number; sy: number } {
  let s = 1;
  if (g.pop >= 0) s *= 0.2 + 0.8 * outBack(g.pop / POP_MS);
  if (g.karisim >= 0) {
    // 220 ms girdap, ardından outBack ile 1,15'e zıplayıp yerleşme.
    const t = (g.karisim - KARISIM_MS * 0.55) / 240;
    if (t > 0) s *= 1 + 0.15 * Math.sin(Math.PI * Math.min(1, t)) * (1 - Math.min(1, t) * 0.3);
  }
  let sx = s;
  let sy = s;
  if (g.inis >= 0) {
    const t = g.inis / INIS_MS;
    const e = 1 - 0.08 * Math.sin(Math.PI * t);
    sy *= e;
    sx *= 2 - e;
  }
  return { sx, sy };
}

export function damlaAlfasi(g: GDamla): number {
  return g.alfaT >= 0 ? Math.min(1, g.alfaT / DOGUM_ALFA_MS) : 1;
}
