/**
 * Sprite önbelleği (GDD §11.3, §13.5). Anahtar: hücre boyu × DPR × palet ×
 * motif; anahtar değişince (yeniden boyutlanma, ayar) önbellek boşalır ve
 * istendikçe yeniden pişer. `pisir()` bir bölümün bütün sprite'larını önden
 * hazırlar (FİTİL dersi 3: ilk dokunuşta donma olmasın).
 */
import type { OzelTur, Renk, Yon } from '../core/types';
import type { Palet } from '../app/sozlesme';
import { PALET } from '../app/katalog';
import { girdapKolCiz, govdeCiz, haleCiz, laleFilmCiz, laleSiluetCiz, mermerCiz, yildizCiz } from './damla';
import { EFEKT_RENK_SAYISI, efektRengi, hexRgb, karistir, rgba } from './palet';
import { spriteUret, type Sprite } from './tuval';
import { TAU } from './matematik';

/** Parçacık sprite'ının mantıksal yarıçapı (çekirdek). */
export const NOKTA_R = 8;

export class DamlaSpritelari {
  hucre = 0;
  dpr = 1;
  palet: Palet = 'standart';
  motifler = true;
  private anahtar = '';
  private halelar = new Map<number, Sprite>();
  private govdeler = new Map<string, Sprite>();
  private mermerler = new Map<string, Sprite>();
  private _girdap: Sprite | null = null;
  private _film: Sprite | null = null;
  private _lale: Sprite | null = null;
  private _hayalet = new Map<number, Sprite>();
  /** Pişirme sayacı (test/ölçüm). */
  pisirilen = 0;

  /** Anahtar değiştiyse önbelleği boşaltır; true = yeniden pişecek. */
  ayarla(hucre: number, dpr: number, palet: Palet, motifler: boolean): boolean {
    const h = Math.max(8, Math.round(hucre));
    const k = `${h}|${dpr}|${palet}|${motifler ? 1 : 0}`;
    if (k === this.anahtar) return false;
    this.anahtar = k;
    this.hucre = h;
    this.dpr = dpr;
    this.palet = palet;
    this.motifler = motifler;
    this.halelar.clear();
    this.govdeler.clear();
    this.mermerler.clear();
    this._hayalet.clear();
    this._girdap = this._film = this._lale = null;
    return true;
  }

  get anahtarDizesi(): string {
    return this.anahtar;
  }

  hale(kod: Renk | 0): Sprite {
    let s = this.halelar.get(kod);
    if (!s) {
      const h = this.hucre;
      s = spriteUret(h * 1.36, h * 1.36, this.dpr, (c) => haleCiz(c, h, kod, this.palet));
      this.halelar.set(kod, s);
      this.pisirilen++;
    }
    return s;
  }

  govde(kod: Renk | 0, ozel: OzelTur, yon: Yon): Sprite {
    const k = `${kod}|${ozel}|${ozel === 'tarak' ? yon : ''}`;
    let s = this.govdeler.get(k);
    if (!s) {
      const h = this.hucre;
      s = spriteUret(h * 1.24, h * 1.24, this.dpr, (c) => govdeCiz(c, h, kod, ozel, yon, { palet: this.palet, motifler: this.motifler }));
      this.govdeler.set(k, s);
      this.pisirilen++;
    }
    return s;
  }

  girdapKol(): Sprite {
    if (!this._girdap) {
      const h = this.hucre;
      this._girdap = spriteUret(h, h, this.dpr, (c) => girdapKolCiz(c, h));
      this.pisirilen++;
    }
    return this._girdap;
  }

  laleFilm(): Sprite {
    if (!this._film) {
      const h = this.hucre;
      this._film = spriteUret(h, h, this.dpr, (c) => laleFilmCiz(c, h));
      this.pisirilen++;
    }
    return this._film;
  }

  laleSiluet(): Sprite {
    if (!this._lale) {
      const h = this.hucre;
      this._lale = spriteUret(h, h, this.dpr, (c) => laleSiluetCiz(c, h));
      this.pisirilen++;
    }
    return this._lale;
  }

  /** Mermer: tohum çeşidi (0–3) × can × çatlak. */
  mermer(cesit: number, can: number, catlak: number): Sprite {
    const k = `${cesit}|${can}|${catlak}`;
    let s = this.mermerler.get(k);
    if (!s) {
      const h = this.hucre;
      s = spriteUret(h * 1.3, h * 1.3, this.dpr, (c) => mermerCiz(c, h, can, catlak, 0x51ed + cesit * 7919));
      this.mermerler.set(k, s);
      this.pisirilen++;
    }
    return s;
  }

  /** Önizleme hayaleti: sonuç renginin halkaları (saydam gövde üstüne). */
  halkaHayalet(kod: Renk | 0): Sprite {
    let s = this._hayalet.get(kod);
    if (!s) {
      const h = this.hucre;
      s = spriteUret(h * 1.24, h * 1.24, this.dpr, (c) => {
        const r = h * 0.43;
        const [ana, acik] = kod === 0 ? ['#EADFC8', '#FFF8EA'] : [efektRengi(kod, this.palet), efektRengi(kod, this.palet)];
        const g = c.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.1, 0, 0, r);
        g.addColorStop(0, rgba(karistir(acik, '#FFFFFF', 0.4), 0.95));
        g.addColorStop(0.5, rgba(ana, 0.9));
        g.addColorStop(1, rgba(karistir(ana, '#000000', 0.45), 0.9));
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, r, 0, TAU);
        c.fill();
        c.lineWidth = r * 0.075;
        for (const [rr, a] of [
          [0.86, 0.7],
          [0.56, 0.45],
        ] as const) {
          c.strokeStyle = `rgba(243,233,210,${a})`;
          c.beginPath();
          c.arc(0, 0, r * rr, 0, TAU);
          c.stroke();
        }
        yildizCiz(c, r * 0.62, -r * 0.62, r * 0.26, PALET.altinAcik);
      });
      this._hayalet.set(kod, s);
      this.pisirilen++;
    }
    return s;
  }

  /** Verilen renkleri ve özelleri önden pişir (onIsit). */
  pisir(renkler: readonly (Renk | 0)[], ozeller = true): void {
    for (const k of renkler) {
      this.hale(k);
      this.govde(k, k === 7 ? 'murekkep' : 'yok', 'yatay');
      if (k !== 0) this.halkaHayalet(k);
    }
    if (ozeller) {
      for (const k of [3, 5, 6] as const) {
        this.govde(k, 'tarak', 'yatay');
        this.govde(k, 'tarak', 'dikey');
        this.govde(k, 'girdap', 'yatay');
      }
      this.govde(0, 'lale', 'yatay');
      this.govde(7, 'murekkep', 'yatay');
      this.hale(0);
      this.hale(7);
      this.girdapKol();
      this.laleFilm();
      this.laleSiluet();
    }
  }
}

/**
 * Efekt sprite'ları (yalnız DPR'ye bağlı): parçacık noktaları (renk
 * dizinine göre), yumuşak parıltı, halka, is zerresi, kâğıt lifi, altın pul.
 */
export class EfektSpritelari {
  dpr = 0;
  palet: Palet = 'standart';
  nokta: Sprite[] = [];
  parilti!: Sprite;
  altinHale!: Sprite;
  halka!: Sprite;
  is!: Sprite;
  lif!: Sprite;
  pul!: Sprite;
  kirinti!: Sprite;

  ayarla(dpr: number, palet: Palet): void {
    if (dpr === this.dpr && palet === this.palet && this.nokta.length) return;
    this.dpr = dpr;
    this.palet = palet;
    const R = NOKTA_R;
    this.nokta = [];
    for (let i = 0; i < EFEKT_RENK_SAYISI; i++) {
      const renk = hexRgb(efektRengi(i, palet));
      this.nokta.push(
        spriteUret(R * 4, R * 4, dpr, (c) => {
          const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 2);
          g.addColorStop(0, rgba(karistir(renk, [255, 255, 255], 0.55), 1));
          g.addColorStop(0.22, rgba(renk, 0.95));
          g.addColorStop(0.5, rgba(renk, 0.35));
          g.addColorStop(1, rgba(renk, 0));
          c.fillStyle = g;
          c.beginPath();
          c.arc(0, 0, R * 2, 0, TAU);
          c.fill();
        }),
      );
    }
    this.parilti = spriteUret(64, 64, dpr, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,248,225,0.55)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g;
      c.fillRect(-32, -32, 64, 64);
    });
    this.altinHale = spriteUret(64, 64, dpr, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, 'rgba(255,236,170,0.9)');
      g.addColorStop(0.4, 'rgba(232,205,106,0.4)');
      g.addColorStop(1, 'rgba(201,162,39,0)');
      c.fillStyle = g;
      c.fillRect(-32, -32, 64, 64);
    });
    this.halka = spriteUret(128, 128, dpr, (c) => {
      // İnce, yumuşak kenarlı halka (r = 56, kalınlık ~5).
      const g = c.createRadialGradient(0, 0, 44, 0, 0, 62);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 62, 0, TAU);
      c.fill();
    });
    this.is = spriteUret(24, 24, dpr, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 11);
      g.addColorStop(0, 'rgba(20,16,12,0.95)');
      g.addColorStop(0.6, 'rgba(26,22,18,0.6)');
      g.addColorStop(1, 'rgba(26,22,18,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 11, 0, TAU);
      c.fill();
    });
    this.lif = spriteUret(20, 6, dpr, (c) => {
      c.strokeStyle = 'rgba(243,233,210,0.9)';
      c.lineCap = 'round';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-8, 0.6);
      c.quadraticCurveTo(0, -1.6, 8, 0.4);
      c.stroke();
    });
    this.pul = spriteUret(14, 14, dpr, (c) => {
      c.fillStyle = PALET.altinAcik;
      c.beginPath();
      c.moveTo(0, -6);
      c.lineTo(3.2, 0);
      c.lineTo(0, 6);
      c.lineTo(-3.2, 0);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(-0.8, -3, 1.6, 3);
    });
    this.kirinti = spriteUret(12, 12, dpr, (c) => {
      c.fillStyle = '#EDE8DF';
      c.beginPath();
      c.moveTo(-4, -3);
      c.lineTo(4, -4);
      c.lineTo(3, 4);
      c.lineTo(-3, 3);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(120,110,96,0.7)';
      c.lineWidth = 0.8;
      c.stroke();
    });
  }
}
