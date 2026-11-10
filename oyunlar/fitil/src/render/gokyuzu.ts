/**
 * Arka plan katmanı (GDD §13.4, §16.6 katman 1): gökyüzü gradyanı, 3 katman
 * yıldız tozu (tohumlu 120/80/40 nokta, 0,05–0,2 Hz parıltı), kasaba silueti,
 * deniz (gökyüzünün dikey yansıması, 6 sinüs şerit 0,3 Hz) ve sandığın
 * oturduğu iskele. Durağan kısımlar yalnız boyut/tema değişince pişirilir;
 * karede yalnız birkaç drawImage ve ucuz şeritler çizilir.
 *
 * Yaşayan sahne (Kasım 2026, "cozy"): kasabanın arkasından göğe ağır ağır
 * yükselen dilek fenerleri, denizde fenerli bir kayık, iskele ayaklarında asılı iki
 * fener ve sudaki titrek yansımaları, seyrek bir kayan yıldız. Hepsi yavaş ve
 * yumuşak (boşta sıçrama yok); `sakin` (hareketi azalt) açıkken fenerler ve
 * kayık yerinde durur, kayan yıldız çıkmaz. Kare başına bellek ayrılmaz.
 */
import { dprTavani } from '../platform/gorunum';
import { GOKYUZU, MAHALLELER } from '../app/katalog';
import { Rng } from '../platform/rng';
import { kasabaCiz, type Pencere } from './kasaba';
import { karistir, rgba } from './matematik';
import { P } from './palet';
import { spriteCiz, spriteUret, tuvalOlustur, type Ctx, type Sprite, type Tuval } from './tuval';
import type { Dikdortgen } from '../app/sozlesme';

/** Dilek feneri: kasabanın arkasından yükselir, tepede sönüp ufuktan yeniden doğar. */
interface DilekFeneri {
  x: number;
  y: number;
  /** Yükselme hızı (px/sn) ve salınım fazı/genliği. */
  hiz: number;
  faz: number;
  sal: number;
  boy: number;
}

/** Dilek fenerlerinin söndüğü yükseklik (ufkun oranı; üstü HUD'un arkası). */
const FENER_TAVAN = 0.16;
const SICAK = '255,200,107';

interface Yansima {
  x: number;
  renk: string;
  omur: number;
  yas: number;
}

export class Gokyuzu {
  private taban: Tuval | null = null;
  private orta: Tuval | null = null;
  private kasaba: Tuval | null = null;
  private kasabaY = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  mahalle = 0;
  /** Ufuk (kasaba tabanı) ve deniz üst sınırı (CSS px). */
  ufuk = 0;
  private yakin: { x: number; y: number; r: number; f: number; faz: number }[] = [];
  private pencereler: Pencere[] = [];
  private yansimalar: Yansima[] = [];
  private ust: string = P.gokUst;
  private alt: string = P.gokAlt;
  private ayVar = false;
  private ayX = 0;
  private ayY = 0;
  /** Deniz durağan mı (otomatik kalite düşük). */
  durgun = false;
  private denizFaz = 0;
  private serit = '#FFFFFF';
  /** Son pişirmenin girdileri (aynıysa kur() hiçbir şey yapmaz). */
  private anahtar = '';
  // --- Yaşayan sahne ---
  /** Hareketi azalt: fenerler ve kayık yerinde durur, kayan yıldız yok. */
  sakin = false;
  private readonly rz = new Rng(0xfe9e);
  private fenerSprite: Sprite | null = null;
  private kayikSprite: Sprite | null = null;
  private haleSprite: Sprite | null = null;
  private fenerler: DilekFeneri[] = [];
  /**
   * Oyuncunun kazandığı dilek fenerleri (`dilekSal`): iyi hamlede ve kazançta
   * salınır, bir kez yükselip söner. Sabit havuz (kare başına bellek yok).
   */
  private readonly ekFenerler: (DilekFeneri & { yas: number; aktif: boolean })[] = Array.from({ length: 28 }, () => ({ x: 0, y: 0, hiz: 0, faz: 0, sal: 0, boy: 1, yas: 0, aktif: false }));
  /** Kayık: deniz bandı yeterince yüksekse (≥ 24 px). `yon` +1 sağa. */
  private kayikVar = false;
  private kayikX = 0;
  private kayikY = 0;
  private kayikYon = 1;
  private kayikBekle = 0;
  /** İskele fenerleri (iki dış ayak): x'ler ve y; yoksa boş. */
  private iskeleFener: number[] = [];
  private iskeleFenerY = 0;
  /** Kayan yıldız: `kyYas` < 0 bekleme (ms), ≥ 0 uçuş. */
  private kyYas = -9000;
  private kyX = 0;
  private kyY = 0;
  private kyAci = 0;
  private yasam = 0;

  /**
   * `tema` (P5 ek): oyuncunun Fişek Defteri'nde seçtiği kişisel gökyüzü
   * (§10.3); verilmezse mahallenin teması. Siluet her zaman mahallenindir.
   */
  /**
   * `altSinir`: tahtanın altında tuvale kalan boş alanın alt kenarı (dikeyde
   * alt düğmelerin üst kenarı; verilmezse ekranın altı). İskele fenerleri
   * yalnız bu sınırın üstüne tam sığarsa asılır (fener `sy + 37`'de biter;
   * küçük ekranda düğmelerin arkasına girmesinler).
   */
  kur(w: number, h: number, dpr: number, mahalle: number, gokBandi: Dikdortgen, sandik: Dikdortgen | null, tema?: string, altSinir?: number): void {
    // Aynı girdiyle yeniden pişirme yok (Tekrar dene, aynı yerleşimde yeni bölüm).
    const anahtar = `${w},${h},${dpr},${mahalle},${gokBandi.x},${gokBandi.y},${gokBandi.w},${gokBandi.h},${sandik ? `${sandik.x},${sandik.y},${sandik.w},${sandik.h}` : '-'},${tema ?? ''},${altSinir ?? ''}`;
    if (anahtar === this.anahtar && this.taban) return;
    this.anahtar = anahtar;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.mahalle = mahalle;
    const m = MAHALLELER[((mahalle % 8) + 8) % 8];
    const temaId = (tema && tema in GOKYUZU ? tema : m.gokyuzu) as keyof typeof GOKYUZU;
    const g = GOKYUZU[temaId];
    this.ust = g.ust;
    this.alt = g.alt;
    this.ayVar = temaId === 'ayIsigi' || temaId === 'yildizYagmuru' || temaId === 'denizMavisi';
    this.ufuk = Math.round(gokBandi.y + gokBandi.h + 6);
    this.serit = karistir(this.alt, '#FFFFFF', 0.35);
    const tohum = 0x51f1 + mahalle * 977;
    const r = new Rng(tohum);

    // --- Taban: gökyüzü + uzak yıldızlar + deniz + iskele -------------------
    const { tuval, ctx } = tuvalOlustur(w * dpr, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gg = ctx.createLinearGradient(0, 0, 0, this.ufuk);
    gg.addColorStop(0, this.ust);
    gg.addColorStop(0.7, karistir(this.ust, this.alt, 0.7));
    gg.addColorStop(1, this.alt);
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, w, this.ufuk + 1);
    // Ufuk sisi: şenlik ışıklarının gökteki yansıması
    const sis = ctx.createLinearGradient(0, this.ufuk - 90, 0, this.ufuk);
    sis.addColorStop(0, rgba(m.vurgu, 0));
    sis.addColorStop(1, rgba(karistir(m.vurgu, '#FFC86B', 0.5), 0.16));
    ctx.fillStyle = sis;
    ctx.fillRect(0, this.ufuk - 90, w, 90);
    // Uzak yıldız tozu (120)
    for (let i = 0; i < 120; i++) {
      const x = r.float() * w;
      const y = Math.pow(r.float(), 1.4) * (this.ufuk - 20);
      ctx.fillStyle = `rgba(255,248,230,${0.2 + r.float() * 0.35})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Samanyolu benzeri yumuşak bant
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const bx = w * (-0.1 + 1.2 * t);
      const by = this.ufuk * (0.15 + 0.35 * t) + (r.float() - 0.5) * 30;
      const br = 40 + r.float() * 50;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, rgba(karistir(this.alt, '#9AA8FF', 0.4), 0.05));
      bg.addColorStop(1, rgba(this.alt, 0));
      ctx.fillStyle = bg;
      ctx.fillRect(bx - br, by - br, 2 * br, 2 * br);
    }
    ctx.restore();
    // Ay
    if (this.ayVar) {
      this.ayX = w * 0.82;
      this.ayY = Math.max(26, this.ufuk * 0.28);
      const ar = 13;
      const hale = ctx.createRadialGradient(this.ayX, this.ayY, ar * 0.5, this.ayX, this.ayY, ar * 5);
      hale.addColorStop(0, 'rgba(255,244,214,0.22)');
      hale.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = hale;
      ctx.fillRect(this.ayX - ar * 5, this.ayY - ar * 5, ar * 10, ar * 10);
      ctx.fillStyle = '#FFF3D6';
      ctx.beginPath();
      ctx.arc(this.ayX, this.ayY, ar, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = karistir(this.ust, this.alt, 0.25);
      ctx.beginPath();
      ctx.arc(this.ayX + ar * 0.45, this.ayY - ar * 0.2, ar * 0.92, 0, Math.PI * 2);
      ctx.fill();
    }
    // Deniz: gökyüzünün dikey yansıması, koyulaşarak
    const dg = ctx.createLinearGradient(0, this.ufuk, 0, h);
    dg.addColorStop(0, karistir(this.alt, P.denizUst, 0.35));
    dg.addColorStop(0.35, karistir(this.ust, P.denizAlt, 0.5));
    dg.addColorStop(1, P.denizUst);
    ctx.fillStyle = dg;
    ctx.fillRect(0, this.ufuk, w, h - this.ufuk);
    // Ay yansıması
    if (this.ayVar) {
      for (let y = this.ufuk + 4; y < h; y += 5) {
        const k = (y - this.ufuk) / (h - this.ufuk);
        const gen = 6 + 30 * k;
        ctx.fillStyle = `rgba(255,243,214,${0.1 * (1 - k)})`;
        ctx.fillRect(this.ayX - gen / 2 + Math.sin(y * 0.3) * 4, y, gen, 1.6);
      }
    }
    // İskele: sandığın altında ahşap ayaklar ve tahtalar
    if (sandik) {
      const sx = sandik.x + sandik.w * 0.08;
      const sw = sandik.w * 0.84;
      const sy = sandik.y + sandik.h - 4;
      ctx.fillStyle = '#120A06';
      for (let k = 0; k <= 4; k++) {
        const px = sx + (k / 4) * sw - 5;
        ctx.fillRect(px, sy, 10, h - sy);
        ctx.fillStyle = 'rgba(242,198,109,0.08)';
        ctx.fillRect(px, sy, 2, h - sy);
        ctx.fillStyle = '#120A06';
      }
      const pg = ctx.createLinearGradient(0, sy, 0, sy + 14);
      pg.addColorStop(0, '#3A2416');
      pg.addColorStop(1, '#1A0F08');
      ctx.fillStyle = pg;
      ctx.fillRect(sx - 14, sy + 6, sw + 28, 12);
      // Suya düşen ayak yansımaları
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k <= 4; k++) ctx.fillRect(sx + (k / 4) * sw - 7, sy + 18, 14, h - sy);
      // Tahtanın sıcak ışığı iskelenin altındaki suya vurur (yumuşak havuz).
      if (h - sy > 40) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const ir = sw * 0.62;
        const iy = sy + 20;
        ctx.translate(sx + sw / 2, iy);
        ctx.scale(1, Math.min(0.6, (h - iy) / ir));
        const ig = ctx.createRadialGradient(0, 0, 0, 0, 0, ir);
        ig.addColorStop(0, `rgba(${SICAK},0.2)`);
        ig.addColorStop(0.5, 'rgba(255,150,70,0.07)');
        ig.addColorStop(1, 'rgba(255,150,70,0)');
        ctx.fillStyle = ig;
        ctx.fillRect(-ir, 0, 2 * ir, ir);
        ctx.restore();
        // İskele kirişine asılı iki fener (gövde pişer; ışığı ve yansıması karede):
        // yalnız altlarında düğme bandına kadar yer varsa (fener sy + 37'de biter).
        this.iskeleFenerY = sy + 31;
        this.iskeleFener = (altSinir ?? h) - sy >= 43 ? [sx + sw * 0.125, sx + sw * 0.875] : [];
        for (const fx of this.iskeleFener) {
          ctx.fillStyle = '#0A0604';
          ctx.fillRect(fx - 0.5, sy + 18, 1, 8);
          ctx.fillRect(fx - 3.5, sy + 25, 7, 1.5);
          ctx.fillRect(fx - 3, sy + 36, 6, 1.5);
          const fg = ctx.createLinearGradient(0, sy + 26, 0, sy + 36);
          fg.addColorStop(0, '#FFF1C4');
          fg.addColorStop(0.6, '#FFC15A');
          fg.addColorStop(1, '#E8842C');
          ctx.fillStyle = fg;
          ctx.fillRect(fx - 2.5, sy + 26.5, 5, 9.5);
          ctx.fillStyle = 'rgba(10,6,4,0.55)';
          ctx.fillRect(fx - 0.4, sy + 26.5, 0.8, 9.5);
        }
      } else this.iskeleFener = [];
    } else this.iskeleFener = [];
    this.taban = tuval;

    // --- Orta yıldız katmanı (80) — alfa ile parıldar ------------------------
    const o = tuvalOlustur(w * dpr, this.ufuk * dpr);
    o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < 80; i++) {
      const x = r.float() * w;
      const y = Math.pow(r.float(), 1.3) * (this.ufuk - 16);
      const rr = 0.6 + r.float() * 0.8;
      o.ctx.fillStyle = `rgba(255,250,235,${0.45 + r.float() * 0.4})`;
      o.ctx.beginPath();
      o.ctx.arc(x, y, rr, 0, Math.PI * 2);
      o.ctx.fill();
    }
    this.orta = o.tuval;

    // --- Yakın yıldızlar (40) — tek tek, kendi fazlarıyla ---------------------
    this.yakin = [];
    for (let i = 0; i < 40; i++) {
      this.yakin.push({
        x: r.float() * w,
        y: Math.pow(r.float(), 1.2) * (this.ufuk - 24) + 4,
        r: 1 + r.float() * 1.4,
        f: 0.05 + r.float() * 0.15,
        faz: r.float() * Math.PI * 2,
      });
    }

    // --- Kasaba silueti -----------------------------------------------------
    const kh = 130;
    this.kasabaY = this.ufuk - kh;
    const k = tuvalOlustur(w * dpr, (kh + 12) * dpr);
    k.ctx.setTransform(dpr, 0, 0, dpr, 0, -this.kasabaY * dpr);
    this.pencereler = kasabaCiz(k.ctx, 0, w, this.ufuk, mahalle, tohum, 1);
    this.kasaba = k.tuval;
    // Kıyı: ufuk çizgisi ve kasaba ışıklarının sudaki titrek yansıması (tabana pişer).
    ctx.fillStyle = 'rgba(255,200,107,0.16)';
    ctx.fillRect(0, this.ufuk, w, 1);
    for (const p of this.pencereler) {
      const yuk = this.ufuk - p.y;
      if (yuk > 90) continue;
      const boy = Math.min(h - this.ufuk - 2, 8 + yuk * 0.6);
      for (let yy = 2; yy < boy; yy += 2.5) {
        const k2 = yy / boy;
        ctx.fillStyle = `rgba(255,200,107,${(0.22 * (1 - k2)).toFixed(3)})`;
        const gen = 2 + 3 * k2;
        ctx.fillRect(p.x - gen / 2 + Math.sin(yy * 0.9 + p.faz) * 1.5, this.ufuk + yy, gen, 1.2);
      }
    }
    this.yasayanKur(w, h, dpr, sandik);
  }

  /** Dilek fenerleri, kayık ve kayan yıldızın sprite'ları ve ilk yerleşimi. */
  private yasayanKur(w: number, h: number, dpr: number, sandik: Dikdortgen | null): void {
    const d = Math.min(dprTavani(), dpr);
    // Fener: sıcak hale + kâğıt gövde (üstü geniş, altı dar) + koyu ağız.
    this.fenerSprite = spriteUret(44, 44, d, (x) => {
      const g = x.createRadialGradient(0, 1, 0, 0, 1, 21);
      g.addColorStop(0, `rgba(${SICAK},0.62)`);
      g.addColorStop(0.3, 'rgba(255,160,70,0.24)');
      g.addColorStop(1, 'rgba(255,140,60,0)');
      x.fillStyle = g;
      x.fillRect(-22, -22, 44, 44);
      const b = x.createLinearGradient(0, -5.5, 0, 5.5);
      b.addColorStop(0, '#FFF0C0');
      b.addColorStop(0.5, '#FFC462');
      b.addColorStop(1, '#FF8E34');
      x.fillStyle = b;
      x.beginPath();
      x.moveTo(-3.6, -4.2);
      x.quadraticCurveTo(0, -6.6, 3.6, -4.2);
      x.lineTo(2.7, 4.6);
      x.lineTo(-2.7, 4.6);
      x.closePath();
      x.fill();
      x.fillStyle = 'rgba(255,250,230,0.75)';
      x.fillRect(-1.3, 0.6, 2.6, 3.2);
      x.fillStyle = '#3A1A0C';
      x.fillRect(-2.7, 4.6, 5.4, 1.1);
    });
    this.haleSprite = spriteUret(56, 56, d, (x) => {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 28);
      g.addColorStop(0, `rgba(${SICAK},0.42)`);
      g.addColorStop(0.3, 'rgba(255,160,70,0.16)');
      g.addColorStop(1, 'rgba(255,140,60,0)');
      x.fillStyle = g;
      x.fillRect(-28, -28, 56, 56);
    });
    // Kayık: koyu tekne, kıçta direğe asılı fener (sağa bakar; sola giderken çevrilir).
    this.kayikSprite = spriteUret(56, 40, d, (x) => {
      const g = x.createRadialGradient(-12, -9, 0, -12, -9, 17);
      g.addColorStop(0, `rgba(${SICAK},0.55)`);
      g.addColorStop(0.35, 'rgba(255,160,70,0.18)');
      g.addColorStop(1, 'rgba(255,140,60,0)');
      x.fillStyle = g;
      x.fillRect(-29, -26, 34, 34);
      x.fillStyle = '#07060F';
      x.beginPath();
      x.moveTo(-17, 0);
      x.quadraticCurveTo(-14, 6.5, -8, 6.5);
      x.lineTo(9, 6.5);
      x.quadraticCurveTo(17, 5.5, 21, -2.5);
      x.quadraticCurveTo(12, 1.2, 0, 1);
      x.lineTo(-17, 0);
      x.fill();
      // Kürekçi ve fener direği
      x.beginPath();
      x.arc(3, -4.2, 2.1, 0, Math.PI * 2);
      x.fill();
      x.fillRect(1, -2.4, 4.4, 4);
      x.fillRect(-12.5, -9, 1, 9.5);
      // Fenerin tekneye vuran sıcak kenarı
      x.fillStyle = `rgba(${SICAK},0.5)`;
      x.fillRect(-15, 0.2, 13, 0.9);
      x.fillStyle = '#FFE7A0';
      x.fillRect(-14, -12.5, 4, 4.6);
      x.fillStyle = '#3A1A0C';
      x.fillRect(-14.4, -13.3, 4.8, 1);
    });
    // Dilek fenerleri: genişliğe göre 4–9; ilk kurulumda göğe yayılmış başlar.
    const adet = Math.max(6, Math.min(12, Math.round(w / 55)));
    this.fenerler.length = 0;
    for (let i = 0; i < adet; i++) {
      const f: DilekFeneri = { x: 0, y: 0, hiz: 0, faz: 0, sal: 0, boy: 1 };
      this.fenerDogur(f, w);
      f.y = this.ufuk * (FENER_TAVAN + (1 - FENER_TAVAN) * this.rz.float());
      this.fenerler.push(f);
    }
    // Kayık: kasaba ile tahta (yoksa ekranın altı) arasındaki deniz bandında.
    const bantAlt = sandik ? sandik.y : h;
    const bant = bantAlt - this.ufuk;
    this.kayikVar = bant >= 24;
    this.kayikY = this.ufuk + Math.min(bant * 0.52, 34);
    this.kayikYon = this.rz.chance(0.5) ? 1 : -1;
    this.kayikX = w * (0.15 + 0.7 * this.rz.float());
    this.kayikBekle = 0;
    this.kyYas = -(6000 + this.rz.float() * 14000);
    for (const f of this.ekFenerler) f.aktif = false;
  }

  /**
   * Oyuncu için `adet` dilek feneri sal (iyi hamle, kazanç): çatıların hemen
   * arkasından hızlıca çıkar, sonra ağırlaşarak yükselir. Hareketi azalt açıkken yok.
   */
  dilekSal(adet: number): void {
    if (this.sakin || !this.fenerSprite) return;
    let kalan = adet;
    for (const f of this.ekFenerler) {
      if (kalan <= 0) break;
      if (f.aktif) continue;
      this.fenerDogur(f, this.w);
      f.y = this.ufuk - 12 - this.rz.float() * 46;
      f.hiz = 16 + this.rz.float() * 8;
      f.boy *= 1.1;
      f.yas = 0;
      f.aktif = true;
      kalan--;
    }
  }

  private fenerDogur(f: DilekFeneri, w: number): void {
    const r = this.rz;
    f.x = w * (0.06 + 0.88 * r.float());
    f.y = this.ufuk - 4;
    f.hiz = 4.5 + r.float() * 4.5;
    f.faz = r.float() * Math.PI * 2;
    f.sal = 3 + r.float() * 5;
    f.boy = 0.85 + r.float() * 0.55;
  }

  /** Gökte patlama: denizde renkli yansıma bırak. */
  yansit(x: number, renk: string): void {
    if (this.yansimalar.length > 10) this.yansimalar.shift();
    this.yansimalar.push({ x, renk, omur: 1400, yas: 0 });
  }

  guncelle(dt: number): void {
    // Deniz şeritlerinin fazı: düşük kalitede (durgun) olduğu yerde donar, sıçramaz.
    if (!this.durgun) this.denizFaz = (this.denizFaz + (dt / 1000) * Math.PI * 2 * 0.3) % (Math.PI * 200);
    for (let i = this.yansimalar.length - 1; i >= 0; i--) {
      const y = this.yansimalar[i];
      y.yas += dt;
      if (y.yas >= y.omur) this.yansimalar.splice(i, 1);
    }
    if (this.sakin) return;
    this.yasam += dt;
    const sn = Math.min(dt, 100) / 1000;
    const tavan = this.ufuk * FENER_TAVAN;
    for (const f of this.fenerler) {
      f.y -= f.hiz * sn;
      if (f.y < tavan) this.fenerDogur(f, this.w);
    }
    for (const f of this.ekFenerler) {
      if (!f.aktif) continue;
      f.yas += dt;
      // Hızlı çıkış, sonra ağır süzülme (~6 px/sn'ye iner).
      f.hiz += (6 - f.hiz) * Math.min(1, sn * 0.9);
      f.y -= f.hiz * sn;
      if (f.y < tavan) f.aktif = false;
    }
    if (this.kayikVar) {
      if (this.kayikBekle > 0) this.kayikBekle -= dt;
      else {
        this.kayikX += this.kayikYon * 5 * sn;
        if (this.kayikX > this.w + 40 || this.kayikX < -40) {
          // Ekrandan çıktı: bir süre bekleyip öbür yöne döner.
          this.kayikYon = -this.kayikYon;
          this.kayikBekle = 9000 + this.rz.float() * 14000;
        }
      }
    }
    // Kayan yıldız: 25–55 sn'de bir, ~0,9 sn (düşük kalitede yok).
    this.kyYas += dt;
    if (this.kyYas >= 900) this.kyYas = -(25000 + this.rz.float() * 30000);
    else if (this.kyYas >= 0 && this.kyYas - dt < 0) {
      if (this.durgun) this.kyYas = -20000;
      else {
        this.kyX = this.w * (0.15 + 0.6 * this.rz.float());
        this.kyY = this.ufuk * (0.2 + 0.3 * this.rz.float());
        this.kyAci = (this.rz.chance(0.5) ? 0.35 : Math.PI - 0.35) + (this.rz.float() - 0.5) * 0.3;
      }
    }
  }

  /** Gökyüzü + yıldızlar (kasabadan önce). */
  cizArka(c: Ctx, zaman: number, yildizPiriltisi = 1): void {
    if (!this.taban || !this.orta) return;
    c.drawImage(this.taban, 0, 0, this.w, this.h);
    const t = zaman / 1000;
    c.globalAlpha = 0.65 + 0.35 * Math.sin(t * Math.PI * 2 * 0.11);
    c.drawImage(this.orta, 0, 0, this.w, this.ufuk);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#FFF6E1';
    for (const s of this.yakin) {
      const a = (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * s.f + s.faz))) * yildizPiriltisi;
      c.globalAlpha = a;
      c.fillRect(s.x - s.r * 0.5, s.y - s.r * 0.5, s.r, s.r);
      if (s.r > 2) {
        c.globalAlpha = a * 0.35;
        c.fillRect(s.x - s.r * 2, s.y - 0.4, s.r * 4, 0.8);
        c.fillRect(s.x - 0.4, s.y - s.r * 2, 0.8, s.r * 4);
      }
    }
    c.globalAlpha = 1;
    // Kayan yıldız: baştan kuyruğa sönen kısa iz.
    if (this.kyYas >= 0 && this.kyYas < 900) {
      const k = this.kyYas / 900;
      const yol = 150 * (1 - (1 - k) * (1 - k));
      const cs = Math.cos(this.kyAci);
      const sn = Math.sin(this.kyAci);
      const a = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.9 * yildizPiriltisi;
      for (let i = 0; i < 9; i++) {
        const u = yol - i * 5;
        if (u < 0) break;
        c.globalAlpha = a * (1 - i / 9);
        const b = 1.8 - i * 0.14;
        c.fillRect(this.kyX + cs * u - b / 2, this.kyY + sn * u - b / 2, b, b);
      }
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = 'source-over';
    // Dilek fenerleri kasabadan ÖNCE çizilir: çatıların arkasından çıkıp göğe yükselir
    // (binaların önünde yarı saydam süzülünce pencere ışıklarıyla karışıyordu).
    const fs = this.fenerSprite;
    if (fs) {
      const tavan = this.ufuk * FENER_TAVAN;
      const yol = this.ufuk - tavan;
      for (const f of this.fenerler) {
        const k = (this.ufuk - f.y) / yol;
        // Ufukta belirir, tavana yaklaşırken söner; yükseldikçe küçülür (uzaklaşır).
        const a = Math.min(1, k * 6) * Math.min(1, (1 - k) * 3.2);
        if (a <= 0.01) continue;
        c.globalAlpha = a * (0.86 + 0.14 * Math.sin(t * 2.3 + f.faz * 3));
        spriteCiz(c, fs, f.x + Math.sin(t * 0.35 + f.faz) * f.sal * (0.4 + k), f.y, f.boy * (1 - 0.28 * k));
      }
      for (const f of this.ekFenerler) {
        if (!f.aktif) continue;
        const k = Math.max(0, (this.ufuk - f.y) / yol);
        const a = Math.min(1, f.yas / 500) * Math.min(1, (1 - k) * 3.2);
        if (a <= 0.01) continue;
        c.globalAlpha = a * (0.88 + 0.12 * Math.sin(t * 2.3 + f.faz * 3));
        spriteCiz(c, fs, f.x + Math.sin(t * 0.35 + f.faz) * f.sal * (0.4 + k), f.y, f.boy * (1 - 0.28 * k));
      }
      c.globalAlpha = 1;
    }
  }

  /** Kasaba + deniz şeritleri + yansımalar (gök parçacıklarından sonra). */
  cizOn(c: Ctx, zaman: number): void {
    if (!this.kasaba) return;
    c.drawImage(this.kasaba, 0, this.kasabaY, this.w, this.kasaba.height / this.dpr);
    const t = zaman / 1000;
    // Pencere titreşimi: birkaçı yavaşça söner/parlar.
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#FFC86B';
    for (let i = 0; i < this.pencereler.length; i += 3) {
      const p = this.pencereler[i];
      // Tam pencerenin üstüne (eskiden 8×8 kare pencereden taşıyor, yanlış hizalı görünüyordu).
      c.globalAlpha = 0.22 + 0.2 * Math.sin(t * 0.9 + p.faz);
      c.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    }
    c.globalAlpha = 1;
    // Deniz: 6 sinüs şerit (0,3 Hz), gökyüzünün alfa 0,25'i.
    const deniz = this.h - this.ufuk;
    if (deniz > 8) {
      c.fillStyle = this.serit;
      for (let k = 0; k < 6; k++) {
        const yy = this.ufuk + 3 + deniz * (0.04 + 0.16 * k * (1 + k * 0.25));
        if (yy > this.h) break;
        const faz = this.denizFaz + k * 1.7;
        const kay = Math.sin(faz) * 18;
        const gen = this.w * (0.35 + 0.1 * Math.sin(faz * 0.7 + k));
        c.globalAlpha = 0.25 * (1 - k * 0.12);
        c.fillRect(this.w * ((k * 0.37) % 1) - gen / 2 + kay, yy, gen, 1 + k * 0.25);
        c.fillRect(this.w * ((k * 0.37 + 0.55) % 1) - gen / 3 - kay, yy + 2 + k, gen * 0.6, 1);
      }
      // Gökteki patlamaların renkli yansıması
      for (const y of this.yansimalar) {
        const a = 0.3 * (1 - y.yas / y.omur);
        c.fillStyle = y.renk;
        for (let s = 0; s < 7; s++) {
          const yy = this.ufuk + 4 + s * (deniz / 9);
          if (yy > this.h) break;
          const gen = 10 + s * 5;
          c.globalAlpha = a * (1 - s / 8);
          c.fillRect(y.x - gen / 2 + Math.sin(t * 5 + s) * 4, yy, gen, 1.5);
        }
      }
      // Sudaki fener yansımaları (kayık ve iskele): titrek sıcak çizgiler.
      c.fillStyle = '#FFC86B';
      const df = this.durgun ? 0 : this.denizFaz;
      if (this.kayikVar && this.kayikBekle <= 0) {
        const kx = this.kayikX - 12 * this.kayikYon;
        for (let i = 0; i < 5; i++) {
          c.globalAlpha = 0.3 * (1 - i / 5);
          const gen = 3 + i * 1.6;
          c.fillRect(kx - gen / 2 + Math.sin(df * 2.1 + i * 1.3) * 1.6, this.kayikY + 8 + i * 2.6, gen, 1.1);
        }
      }
      for (const fx of this.iskeleFener) {
        const y0 = this.iskeleFenerY + 12;
        const boy = Math.min(70, this.h - y0 - 2);
        for (let i = 0; i * 5 < boy; i++) {
          const k = (i * 5) / boy;
          c.globalAlpha = 0.34 * (1 - k) * (1 - k);
          const gen = 4 + 9 * k;
          c.fillRect(fx - gen / 2 + Math.sin(df * 1.7 + i * 0.9 + fx) * (1 + 3 * k), y0 + i * 5, gen, 1.3);
        }
      }
    }
    // İskele fenerlerinin halesi (yavaşça titrer).
    const hs = this.haleSprite;
    if (hs) {
      for (const fx of this.iskeleFener) {
        c.globalAlpha = 0.78 + 0.1 * Math.sin(t * 1.9 + fx);
        spriteCiz(c, hs, fx, this.iskeleFenerY);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    const ks = this.kayikSprite;
    if (ks && this.kayikVar && this.kayikBekle <= 0) {
      const by = this.kayikY + (this.sakin ? 0 : Math.sin(t * 1.1) * 0.8);
      if (this.kayikYon > 0) spriteCiz(c, ks, this.kayikX, by);
      else {
        c.save();
        c.translate(this.kayikX, by);
        c.scale(-1, 1);
        spriteCiz(c, ks, 0, 0);
        c.restore();
      }
    }
  }
}
