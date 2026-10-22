/**
 * Ölçüm (docs/OLCUM.md, docs/YAYIN.md aşama 1): kişisel veri toplamayan oyun
 * olayları. Kimlik, cihaz bilgisi, konum YOK; yalnız oyunun kendi olayları
 * (bölüm başladı/bitti, ekran, kasaba işi…), kurulumdan bu yana gün ve
 * oturum sırası.
 *
 * Uçlar:
 *  - yerel halka günlük: `localStorage` `fitil.olcum.v1`, son `EN_COK` olay
 *    (oyun testleri ve `__fitil.olcum()` raporu için; ağ isteği yok);
 *  - Android köprüsü: `window.FitilYerel.olay(ad, json)` varsa (Capacitor
 *    eklentisi Firebase Analytics'e iletir; web ve claude.ai sürümünde yok).
 */
import { DIL } from './dil';

export type OlcumDegeri = string | number | boolean;

/** Bir olay: ad, zaman (ms), kurulumdan bu yana gün, oturum sırası, özellikler. */
export interface OlcumOlayi {
  a: string;
  t: number;
  g: number;
  o: number;
  p?: Record<string, OlcumDegeri>;
}

interface Kayit {
  /** İlk açılış zamanı (ms). */
  ilk: number;
  /** Açılış (oturum) sayısı. */
  oturum: number;
  olaylar: OlcumOlayi[];
}

const ANAHTAR = 'fitil.olcum.v1';
export const EN_COK = 600;
const GUN_MS = 86_400_000;

interface Depo {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

declare global {
  interface Window {
    /** Android sarmalayıcının yerel köprüsü (Capacitor; yalnız uygulamada). */
    FitilYerel?: { olay?: (ad: string, ozellik: string) => void };
  }
}

/** Ölçüm günlüğü. Saf mantık + depo; uygulama tek örnek (`olcum`) kullanır. */
export class Olcum {
  private k: Kayit;
  private yazZamanlayici: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly depo: Depo | null,
    private readonly simdi: () => number = () => Date.now(),
  ) {
    this.k = this.oku();
  }

  /** Sayfa açıldı: oturum sayacı artar, `oturum_basla` yazılır. */
  basla(ozellik: Record<string, OlcumDegeri> = {}): void {
    this.k.oturum++;
    this.olay('oturum_basla', { dil: DIL, ...ozellik });
    this.yaz();
  }

  olay(ad: string, p?: Record<string, OlcumDegeri>): void {
    const t = this.simdi();
    const o: OlcumOlayi = { a: ad, t, g: Math.max(0, Math.floor((t - this.k.ilk) / GUN_MS)), o: this.k.oturum };
    if (p && Object.keys(p).length) o.p = p;
    this.k.olaylar.push(o);
    if (this.k.olaylar.length > EN_COK) this.k.olaylar.splice(0, this.k.olaylar.length - EN_COK);
    try {
      if (typeof window !== 'undefined') window.FitilYerel?.olay?.(ad, JSON.stringify({ ...p, gun: o.g, oturum: o.o }));
    } catch {
      /* köprü hatası oyunu durdurmasın */
    }
    this.planla();
  }

  /** Günlükteki olaylar (eskiden yeniye). */
  olaylar(): readonly OlcumOlayi[] {
    return this.k.olaylar;
  }

  /** Bekleyen yazımı hemen yap (sayfa kapanırken). */
  yaz(): void {
    if (this.yazZamanlayici) clearTimeout(this.yazZamanlayici);
    this.yazZamanlayici = null;
    try {
      this.depo?.setItem(ANAHTAR, JSON.stringify(this.k));
    } catch {
      /* depolama dolu ya da kapalı: ölçüm oyunu durdurmaz */
    }
  }

  private planla(): void {
    if (this.yazZamanlayici) return;
    this.yazZamanlayici = setTimeout(() => this.yaz(), 1000);
  }

  private oku(): Kayit {
    try {
      const ham = this.depo?.getItem(ANAHTAR);
      if (ham) {
        const k = JSON.parse(ham) as Partial<Kayit>;
        if (typeof k.ilk === 'number' && typeof k.oturum === 'number' && Array.isArray(k.olaylar)) return { ilk: k.ilk, oturum: k.oturum, olaylar: k.olaylar.slice(-EN_COK) };
      }
    } catch {
      /* bozuk ölçüm kaydı: baştan */
    }
    return { ilk: this.simdi(), oturum: 0, olaylar: [] };
  }
}

function yerelDepo(): Depo | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Uygulamanın ölçüm günlüğü. */
export const olcum = new Olcum(yerelDepo());

/** Kısa yol: `olcumOlayi('bolum_basla', { id: 3 })`. */
export function olcumOlayi(ad: string, p?: Record<string, OlcumDegeri>): void {
  olcum.olay(ad, p);
}

// ─────────────────────────── Özet (rapor) ───────────────────────────

export interface BolumOzeti {
  id: number;
  basla: number;
  kazanc: number;
  kayip: number;
  cikis: number;
  /** İlk kazanca kadar deneme (kazanılmadıysa null). */
  ilkKazancDenemesi: number | null;
  /** Bitmiş denemelerin ortalama süresi (sn). */
  ortSure: number;
}

export interface OlcumOzeti {
  oturumlar: number;
  /** Oyuncunun açtığı günler (kurulumdan bu yana gün numaraları). */
  gunler: number[];
  bolumler: BolumOzeti[];
  /** İlk oturumda varılan en yüksek ana bölüm (kazanılmış). */
  ilkOturumEnYuksek: number;
  /** İlk açılıştan 5. bölümün ilk kazancına kadar geçen süre (sn; yoksa null). */
  bolum5Suresi: number | null;
  ekranlar: Record<string, number>;
}

/** Olaylardan oyuncu özeti (saf; test edilir, `__fitil.olcum()` ve rapor betiği kullanır). */
export function olcumOzeti(olaylar: readonly OlcumOlayi[]): OlcumOzeti {
  const bolum = new Map<number, BolumOzeti & { sureler: number[] }>();
  const al = (id: number) => {
    let b = bolum.get(id);
    if (!b) bolum.set(id, (b = { id, basla: 0, kazanc: 0, kayip: 0, cikis: 0, ilkKazancDenemesi: null, ortSure: 0, sureler: [] }));
    return b;
  };
  const gunler = new Set<number>();
  const ekranlar: Record<string, number> = {};
  let oturumlar = 0;
  let ilkOturum = -1;
  let ilkOturumEnYuksek = 0;
  let bolum5Suresi: number | null = null;
  const ilkZaman = olaylar[0]?.t ?? 0;
  for (const o of olaylar) {
    gunler.add(o.g);
    if (o.a === 'oturum_basla') {
      oturumlar++;
      if (ilkOturum < 0) ilkOturum = o.o;
    } else if (o.a === 'ekran') {
      const ad = String(o.p?.ad ?? '');
      ekranlar[ad] = (ekranlar[ad] ?? 0) + 1;
    } else if (o.a === 'bolum_basla') {
      al(Number(o.p?.id)).basla++;
    } else if (o.a === 'bolum_bitti') {
      const id = Number(o.p?.id);
      const b = al(id);
      const sonuc = o.p?.sonuc;
      if (sonuc === 'kazanc') {
        b.kazanc++;
        if (b.ilkKazancDenemesi === null) b.ilkKazancDenemesi = b.basla || 1;
        if (o.o === ilkOturum && o.p?.tur === 'ana' && id > ilkOturumEnYuksek) ilkOturumEnYuksek = id;
        if (id === 5 && o.p?.tur === 'ana' && bolum5Suresi === null) bolum5Suresi = Math.round((o.t - ilkZaman) / 1000);
      } else if (sonuc === 'cikis') b.cikis++;
      else b.kayip++;
      if (typeof o.p?.sure === 'number') b.sureler.push(o.p.sure);
    }
  }
  const bolumler = [...bolum.values()]
    .sort((a, b) => a.id - b.id)
    .map(({ sureler, ...b }) => ({ ...b, ortSure: sureler.length ? Math.round(sureler.reduce((x, y) => x + y, 0) / sureler.length) : 0 }));
  return { oturumlar, gunler: [...gunler].sort((a, b) => a - b), bolumler, ilkOturumEnYuksek, bolum5Suresi, ekranlar };
}
