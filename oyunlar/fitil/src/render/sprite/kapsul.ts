/**
 * Kapsül sprite önbelleği (GDD §13.2, §16.6). Hücre boyu c ve DPR değişince
 * yeniden üretilir. Her şey bir kez çizilir; karede yalnız drawImage.
 *
 *   govde[renk]      cam gövde (adım 2–6): dolgu, iç ışık, yansıma, kontur
 *   islak[renk]      doygunluk %40, parıltı yok, üstte 3 mavi damla
 *   parilti[renk]    dış parıltı (adım 1), `lighter` ile
 *   inci*            yıldız topu: inci taban, dönen konik gökkuşağı, cam üst
 *   roketOku         çift başlı pirinç ok (döndürülerek çizilir)
 *   kasimpati        8 yapraklı krem yıldız deseni (döndürülerek çizilir)
 *   yuvaBos[E]       köz yuvaları, boş (adım 7)
 *   yuvaDolu[E][i]   ilk i yuva dolu (`lighter`)
 *   kizgin           beyaz-sıcak çekirdek (adım 8)
 *   kafes            pirinç çubuklar (adım 11)
 *   golge            gövde altı yumuşak gölge
 */
import type { Palet } from '../../app/sozlesme';
import { INCI, P, kapsulRenkleri, type KapsulRengi } from '../palet';
import { doygunluk, hslHex, rgba } from '../matematik';
import { spriteUret, type Ctx, type Sprite } from '../tuval';
import { IC_SIMGE_OLCEK, sekilYolu, yansimaKonumu } from './sekil';

export class KapsulSpritelari {
  c = 0;
  dpr = 1;
  palet: Palet = 'standart';
  renkler: KapsulRengi[] = [];
  govde: Sprite[] = [];
  islak: Sprite[] = [];
  parilti: Sprite[] = [];
  /** Hayalet (önizleme): saydam gövde, yalnız kontur ve hafif dolgu. */
  hayalet: Sprite[] = [];
  /** Siluet yolları (vurgu/kesik çizgi için), r = 0,40c. */
  yollar: Path2D[] = [];
  inciTaban!: Sprite;
  inciGokkusagi!: Sprite;
  inciUst!: Sprite;
  inciParilti!: Sprite;
  piriltiYildiz!: Sprite;
  roketOku!: Sprite;
  kasimpati!: Sprite;
  ozelHale!: Sprite;
  yuvaBos: Sprite[] = [];
  yuvaDolu: Sprite[][] = [];
  kizgin!: Sprite;
  kafes!: Sprite;
  golge!: Sprite;

  /** Gerekirse yeniden üret; değiştiyse true. */
  hazirla(c: number, dpr: number, palet: Palet): boolean {
    if (c === this.c && dpr === this.dpr && palet === this.palet && this.govde.length) return false;
    this.c = c;
    this.dpr = dpr;
    this.palet = palet;
    this.renkler = kapsulRenkleri(palet);
    const r = 0.4 * c;
    const kontur = palet === 'yuksekKontrast' ? 3 : 1.5;
    const boy = Math.ceil(1.34 * c);
    this.govde = this.renkler.map((k) => spriteUret(boy, boy, dpr, (x) => camGovde(x, k, r, kontur, palet === 'yuksekKontrast', 1)));
    this.islak = this.renkler.map((k) => {
      const kk: KapsulRengi = { ...k, ana: doygunluk(k.ana, 0.4), acik: doygunluk(k.acik, 0.4), koyu: doygunluk(k.koyu, 0.4) };
      return spriteUret(boy, boy, dpr, (x) => {
        camGovde(x, kk, r, kontur, palet === 'yuksekKontrast', 0.7);
        // Nem: mavi örtü + üstte üç damla.
        x.save();
        sekilYolu(x, k.sekil, r);
        x.clip();
        x.fillStyle = 'rgba(70,140,220,0.16)';
        x.fillRect(-r * 2, -r * 2, r * 4, r * 4);
        x.restore();
        damla(x, -0.42 * r, -0.62 * r, 0.17 * r);
        damla(x, 0.02 * r, -0.86 * r, 0.21 * r);
        damla(x, 0.44 * r, -0.58 * r, 0.15 * r);
      });
    });
    this.parilti = this.renkler.map((k) => parilti(dpr, c, k.ana));
    this.hayalet = this.renkler.map((k) =>
      spriteUret(boy, boy, dpr, (x) => {
        sekilYolu(x, k.sekil, r);
        x.fillStyle = rgba(k.ana, 0.22);
        x.fill();
        x.lineWidth = 2;
        x.strokeStyle = rgba(k.acik, 0.85);
        x.setLineDash([4, 3]);
        x.stroke();
      }),
    );
    this.yollar = this.renkler.map((k) => {
      const p = new Path2D();
      sekilYolu(p, k.sekil, r);
      return p;
    });

    // Yıldız topu: inci cam + dönen konik gökkuşağı + 6 köşeli pırıltı (§13.2 adım 9).
    this.inciTaban = spriteUret(boy, boy, dpr, (x) => {
      sekilYolu(x, 'daire', r);
      const g = x.createRadialGradient(-0.3 * r, -0.35 * r, 0, -0.3 * r, -0.35 * r, 1.45 * r);
      g.addColorStop(0, INCI.acik);
      g.addColorStop(0.45, INCI.ana);
      g.addColorStop(1, INCI.koyu);
      x.fillStyle = g;
      x.fill();
    });
    this.inciGokkusagi = spriteUret(boy, boy, dpr, (x) => {
      x.save();
      sekilYolu(x, 'daire', r * 0.98);
      x.clip();
      const n = 72;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1.15) / n) * Math.PI * 2;
        x.beginPath();
        x.moveTo(0, 0);
        x.arc(0, 0, r * 1.05, a0, a1);
        x.closePath();
        x.fillStyle = hslHex((i / n) * 360, 0.95, 0.62);
        x.fill();
      }
      // Merkeze doğru sütlü geçiş: gökkuşağı kenarda yoğun.
      const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(-r, -r, 2 * r, 2 * r);
      x.restore();
    });
    this.inciUst = spriteUret(boy, boy, dpr, (x) => camUst(x, 'daire', r, '#5C5476', kontur, palet === 'yuksekKontrast', '#FFFFFF'));
    this.inciParilti = parilti(dpr, c, '#FFFFFF');
    this.piriltiYildiz = spriteUret(Math.ceil(0.8 * c), Math.ceil(0.8 * c), dpr, (x) => {
      const R = 0.36 * c;
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const uzun = i % 2 === 0 ? R : R * 0.62;
        x.save();
        x.rotate(a);
        const g = x.createLinearGradient(0, 0, uzun, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(0, -0.05 * c);
        x.lineTo(uzun, 0);
        x.lineTo(0, 0.05 * c);
        x.closePath();
        x.fill();
        x.restore();
      }
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 0.12 * c);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(-0.12 * c, -0.12 * c, 0.24 * c, 0.24 * c);
    });

    // Roket: eksen boyunca çift başlı pirinç ok (uzunluk 1,5r) ve iki kanatçık.
    this.roketOku = spriteUret(Math.ceil(1.0 * c), Math.ceil(0.6 * c), dpr, (x) => roketOku(x, r));
    // Kasımpatı: 8 yapraklı krem yıldız deseni.
    this.kasimpati = spriteUret(Math.ceil(0.62 * c), Math.ceil(0.62 * c), dpr, (x) => kasimpatiDeseni(x, r));
    // Özel taş halesi: güçlü, sıcak dış parıltı.
    this.ozelHale = spriteUret(Math.ceil(1.5 * c), Math.ceil(1.5 * c), dpr, (x) => {
      const g = x.createRadialGradient(0, 0, 0.3 * c, 0, 0, 0.74 * c);
      g.addColorStop(0, 'rgba(255,236,190,0.42)');
      g.addColorStop(0.5, 'rgba(255,200,120,0.16)');
      g.addColorStop(1, 'rgba(255,170,80,0)');
      x.fillStyle = g;
      x.fillRect(-0.75 * c, -0.75 * c, 1.5 * c, 1.5 * c);
    });

    // Köz yuvaları (adım 7): E−1 yay, yarıçap 0,47c, kalınlık 0,06c.
    this.yuvaBos = [];
    this.yuvaDolu = [];
    const yb = Math.ceil(1.24 * c);
    for (let E = 2; E <= 5; E++) {
      this.yuvaBos[E] = spriteUret(yb, yb, dpr, (x) => yaylar(x, c, E, E - 1, 'rgba(255,255,255,0.12)', 0, false));
      this.yuvaDolu[E] = [];
      for (let i = 1; i <= E - 1; i++) {
        this.yuvaDolu[E][i] = spriteUret(yb, yb, dpr, (x) => yaylar(x, c, E, i, P.isiHalkasi, 0, true));
      }
    }
    // Kızgın: beyaz-sıcak çekirdek (radyal #FFF4C2 alfa 0,7, r 0,45r) + yumuşak hale.
    this.kizgin = spriteUret(Math.ceil(0.9 * c), Math.ceil(0.9 * c), dpr, (x) => {
      const R = 0.45 * r;
      const h = x.createRadialGradient(0, 0, 0, 0, 0, 0.42 * c);
      h.addColorStop(0, 'rgba(255,170,80,0.32)');
      h.addColorStop(1, 'rgba(255,120,40,0)');
      x.fillStyle = h;
      x.fillRect(-0.45 * c, -0.45 * c, 0.9 * c, 0.9 * c);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, R * 1.6);
      g.addColorStop(0, rgba(P.beyazSicak, 0.7));
      g.addColorStop(0.55, rgba(P.beyazSicak, 0.42));
      g.addColorStop(1, rgba(P.beyazSicak, 0));
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, R * 1.6, 0, Math.PI * 2);
      x.fill();
    });
    this.kafes = spriteUret(Math.ceil(1.02 * c), Math.ceil(1.02 * c), dpr, (x) => kafes(x, c));
    this.golge = spriteUret(Math.ceil(1.1 * c), Math.ceil(0.7 * c), dpr, (x) => {
      x.scale(1, 0.42);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 0.48 * c);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, 0.48 * c, 0, Math.PI * 2);
      x.fill();
    });
    return true;
  }
}

/** Dış parıltı (adım 1): ana renk alfa 0,35 → 0, yarıçap 0,62c. */
function parilti(dpr: number, c: number, renk: string): Sprite {
  const R = 0.62 * c;
  return spriteUret(Math.ceil(2 * R), Math.ceil(2 * R), dpr, (x) => {
    const g = x.createRadialGradient(0, 0, 0.18 * c, 0, 0, R);
    g.addColorStop(0, rgba(renk, 0.35));
    g.addColorStop(0.55, rgba(renk, 0.14));
    g.addColorStop(1, rgba(renk, 0));
    x.fillStyle = g;
    x.fillRect(-R, -R, 2 * R, 2 * R);
  });
}

/** Cam gövde: adım 2–6 (+ alt kostik ve küçük ikinci pırıltı cilası). */
function camGovde(x: Ctx, k: KapsulRengi, r: number, kontur: number, yuksekKontrast: boolean, parlaklik: number): void {
  // Gövde dolgusu: merkez (−0,3r, −0,35r); 0 açık, 0,45 ana, 1 koyu.
  sekilYolu(x, k.sekil, r);
  const g = x.createRadialGradient(-0.3 * r, -0.35 * r, 0, -0.3 * r, -0.35 * r, 1.5 * r);
  g.addColorStop(0, k.acik);
  g.addColorStop(0.45, k.ana);
  g.addColorStop(1, k.koyu);
  x.fillStyle = g;
  x.fill();
  camUst(x, k.sekil, r, k.koyu, kontur, yuksekKontrast, k.acik, parlaklik);
}

/** Camın üst katmanları: iç ışık, kostik, yansıma, kontur, (yüksek kontrast) iç simge. */
function camUst(x: Ctx, sekil: KapsulRengi['sekil'], r: number, koyu: string, kontur: number, yuksekKontrast: boolean, acik: string, parlaklik = 1): void {
  x.save();
  sekilYolu(x, sekil, r);
  x.clip();
  // İç ışık: merkezde beyaz alfa 0,25, yarıçap 0,5r.
  const ic = x.createRadialGradient(0, 0, 0, 0, 0, 0.5 * r);
  ic.addColorStop(0, `rgba(255,255,255,${0.25 * parlaklik})`);
  ic.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = ic;
  x.fillRect(-r, -r, 2 * r, 2 * r);
  // Alt kostik: camdan geçen ışığın alt kenarda toplanması.
  const ks = x.createRadialGradient(0.18 * r, 0.62 * r, 0, 0.18 * r, 0.62 * r, 0.62 * r);
  ks.addColorStop(0, rgba(acik, 0.42 * parlaklik));
  ks.addColorStop(1, rgba(acik, 0));
  x.fillStyle = ks;
  x.fillRect(-1.3 * r, -1.3 * r, 2.6 * r, 2.6 * r);
  // Kenar koyulaşması (camın kalınlığı).
  x.lineWidth = 0.22 * r;
  x.strokeStyle = rgba(koyu, 0.35);
  sekilYolu(x, sekil, r);
  x.stroke();
  // Yansıma: sol üstte beyaz elips (0,45r × 0,22r), −30°, alfa 0,55.
  const [yx, yy] = yansimaKonumu(sekil, r);
  x.save();
  x.translate(yx, yy);
  x.rotate(-Math.PI / 6);
  const yg = x.createRadialGradient(0, 0, 0, 0, 0, 0.45 * r);
  yg.addColorStop(0, `rgba(255,255,255,${0.55 * parlaklik})`);
  yg.addColorStop(0.7, `rgba(255,255,255,${0.42 * parlaklik})`);
  yg.addColorStop(1, 'rgba(255,255,255,0)');
  x.scale(1, 0.22 / 0.45);
  x.fillStyle = yg;
  x.beginPath();
  x.arc(0, 0, 0.45 * r, 0, Math.PI * 2);
  x.fill();
  x.restore();
  // Küçük ikinci pırıltı.
  x.fillStyle = `rgba(255,255,255,${0.7 * parlaklik})`;
  x.beginPath();
  x.arc(yx + 0.36 * r, yy - 0.04 * r, 0.06 * r, 0, Math.PI * 2);
  x.fill();
  x.restore();
  // Kontur: koyu renk 1,5 px (yüksek kontrastta 3 px).
  sekilYolu(x, sekil, r);
  x.lineJoin = 'round';
  x.lineWidth = kontur;
  x.strokeStyle = yuksekKontrast ? '#0A0608' : koyu;
  x.stroke();
  if (yuksekKontrast) {
    // İç simge beyaz: siluetin küçük kopyası.
    x.save();
    x.scale(IC_SIMGE_OLCEK, IC_SIMGE_OLCEK);
    sekilYolu(x, sekil, r);
    x.fillStyle = '#FFFFFF';
    x.fill();
    x.lineWidth = 2 / IC_SIMGE_OLCEK;
    x.strokeStyle = '#0A0608';
    x.stroke();
    x.restore();
  }
}

function damla(x: Ctx, cx: number, cy: number, s: number): void {
  x.save();
  x.translate(cx, cy);
  x.beginPath();
  x.moveTo(0, -1.4 * s);
  x.quadraticCurveTo(0.95 * s, -0.1 * s, 0.7 * s, 0.45 * s);
  x.arc(0, 0.35 * s, 0.72 * s, 0.15, Math.PI - 0.15);
  x.quadraticCurveTo(-0.95 * s, -0.1 * s, 0, -1.4 * s);
  x.closePath();
  const g = x.createLinearGradient(-s, -s, s, s);
  g.addColorStop(0, '#CDEBFF');
  g.addColorStop(1, '#3A8EE8');
  x.fillStyle = g;
  x.fill();
  x.lineWidth = 1;
  x.strokeStyle = '#1C4E8A';
  x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.beginPath();
  x.arc(-0.25 * s, 0.1 * s, 0.18 * s, 0, Math.PI * 2);
  x.fill();
  x.restore();
}

function pirincGradyan(x: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, P.pirincAcik);
  g.addColorStop(0.45, P.pirinc);
  g.addColorStop(1, P.bakirKoyu);
  return g;
}

/** Yatay çizilir; çizimde eksene göre döndürülür. Uzunluk 1,5r. */
function roketOku(x: Ctx, r: number): void {
  const L = 0.75 * r;
  const kal = 0.11 * r;
  const bas = 0.3 * r;
  // Koyu hale: gövdeden ayrılsın.
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.strokeStyle = 'rgba(30,12,4,0.55)';
  x.lineWidth = kal * 2 + 3;
  x.beginPath();
  x.moveTo(-L + bas * 0.5, 0);
  x.lineTo(L - bas * 0.5, 0);
  x.stroke();
  const yol = () => {
    x.beginPath();
    x.moveTo(L + 0.04 * r, 0);
    x.lineTo(L - bas, -bas * 0.78);
    x.lineTo(L - bas, -kal);
    // Kanatçık (üst)
    x.lineTo(0.12 * r, -kal);
    x.lineTo(-0.02 * r, -0.3 * r);
    x.lineTo(-0.16 * r, -0.3 * r);
    x.lineTo(-0.1 * r, -kal);
    x.lineTo(-L + bas, -kal);
    x.lineTo(-L + bas, -bas * 0.78);
    x.lineTo(-L - 0.04 * r, 0);
    x.lineTo(-L + bas, bas * 0.78);
    x.lineTo(-L + bas, kal);
    x.lineTo(-0.1 * r, kal);
    // Kanatçık (alt)
    x.lineTo(-0.16 * r, 0.3 * r);
    x.lineTo(-0.02 * r, 0.3 * r);
    x.lineTo(0.12 * r, kal);
    x.lineTo(L - bas, kal);
    x.lineTo(L - bas, bas * 0.78);
    x.closePath();
  };
  yol();
  x.lineWidth = 2.4;
  x.strokeStyle = '#2A1406';
  x.stroke();
  x.fillStyle = pirincGradyan(x, 0, -0.35 * r, 0, 0.35 * r);
  x.fill();
  // Parlak sırt çizgisi
  x.strokeStyle = 'rgba(255,240,200,0.85)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(-L + bas, -kal * 0.35);
  x.lineTo(L - bas, -kal * 0.35);
  x.stroke();
}

function kasimpatiDeseni(x: Ctx, r: number): void {
  const R = 0.52 * r;
  x.save();
  // Koyu taban: krem desen her renkte okunsun.
  const t = x.createRadialGradient(0, 0, 0, 0, 0, R * 1.08);
  t.addColorStop(0, 'rgba(60,20,4,0.55)');
  t.addColorStop(0.7, 'rgba(60,20,4,0.35)');
  t.addColorStop(1, 'rgba(60,20,4,0)');
  x.fillStyle = t;
  x.beginPath();
  x.arc(0, 0, R * 1.08, 0, Math.PI * 2);
  x.fill();
  for (let i = 0; i < 8; i++) {
    x.save();
    x.rotate((i * Math.PI) / 4);
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(0.2 * R, -0.42 * R, 0, -R);
    x.quadraticCurveTo(-0.2 * R, -0.42 * R, 0, 0);
    x.closePath();
    const g = x.createLinearGradient(0, 0, 0, -R);
    g.addColorStop(0, 'rgba(255,243,214,0.95)');
    g.addColorStop(1, 'rgba(255,226,170,0.75)');
    x.fillStyle = g;
    x.fill();
    x.lineWidth = 1;
    x.strokeStyle = 'rgba(120,60,20,0.55)';
    x.stroke();
    x.restore();
  }
  x.beginPath();
  x.arc(0, 0, 0.16 * R, 0, Math.PI * 2);
  x.fillStyle = P.pirincAcik;
  x.fill();
  x.strokeStyle = P.bakirKoyu;
  x.lineWidth = 1;
  x.stroke();
  x.restore();
}

/** Köz yuvaları: E−1 yay; her yay (360/(E−1) − 14)°, tepeden saat yönünde. */
export function yaylar(x: Ctx, c: number, E: number, dolu: number, renk: string, bas: number, parlak: boolean): void {
  const n = E - 1;
  const seg = (Math.PI * 2) / n;
  const bosluk = (14 * Math.PI) / 180;
  const R = 0.47 * c;
  x.lineCap = 'round';
  for (let i = bas; i < dolu; i++) {
    const a0 = -Math.PI / 2 + i * seg + bosluk / 2;
    const a1 = a0 + seg - bosluk;
    if (parlak) {
      x.strokeStyle = rgba(P.koz, 0.28);
      x.lineWidth = 0.06 * c * 2.6;
      x.beginPath();
      x.arc(0, 0, R, a0, a1);
      x.stroke();
      x.strokeStyle = renk;
      x.lineWidth = 0.06 * c;
      x.beginPath();
      x.arc(0, 0, R, a0, a1);
      x.stroke();
      x.strokeStyle = rgba(P.beyazSicak, 0.75);
      x.lineWidth = 0.022 * c;
      x.beginPath();
      x.arc(0, 0, R, a0, a1);
      x.stroke();
    } else {
      x.strokeStyle = 'rgba(0,0,0,0.35)';
      x.lineWidth = 0.06 * c + 1.5;
      x.beginPath();
      x.arc(0, 0, R, a0, a1);
      x.stroke();
      x.strokeStyle = renk;
      x.lineWidth = 0.06 * c;
      x.beginPath();
      x.arc(0, 0, R, a0, a1);
      x.stroke();
    }
  }
}

/** Kafes: pirinç çubuklar (3 dikey, 1 yatay, 0,07c), köşe perçinleri. */
function kafes(x: Ctx, c: number): void {
  const k = 0.07 * c;
  const ic = 0.4 * c;
  const cubuk = (x0: number, y0: number, x1: number, y1: number) => {
    x.lineCap = 'round';
    x.strokeStyle = '#2A1406';
    x.lineWidth = k + 2.2;
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x1, y1);
    x.stroke();
    x.strokeStyle = pirincGradyan(x, x0 - k, y0 - k, x0 + k, y0 + k);
    x.lineWidth = k;
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x1, y1);
    x.stroke();
    x.strokeStyle = 'rgba(255,240,200,0.8)';
    x.lineWidth = Math.max(0.8, k * 0.25);
    x.beginPath();
    x.moveTo(x0 - (y1 !== y0 ? k * 0.2 : 0), y0 - (y1 === y0 ? k * 0.2 : 0));
    x.lineTo(x1 - (y1 !== y0 ? k * 0.2 : 0), y1 - (y1 === y0 ? k * 0.2 : 0));
    x.stroke();
  };
  for (const dx of [-0.26, 0, 0.26]) cubuk(dx * c, -ic, dx * c, ic);
  cubuk(-ic, 0.02 * c, ic, 0.02 * c);
  const percin = (px: number, py: number) => {
    const g = x.createRadialGradient(px - 0.012 * c, py - 0.012 * c, 0, px, py, 0.05 * c);
    g.addColorStop(0, '#FFF0C0');
    g.addColorStop(0.5, P.pirinc);
    g.addColorStop(1, P.bakirKoyu);
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, 0.05 * c, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = '#2A1406';
    x.lineWidth = 1;
    x.stroke();
  };
  percin(-0.26 * c, -ic);
  percin(0.26 * c, -ic);
  percin(-0.26 * c, ic);
  percin(0.26 * c, ic);
  percin(-ic, 0.02 * c);
  percin(ic, 0.02 * c);
}
