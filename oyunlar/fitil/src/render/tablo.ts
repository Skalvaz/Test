/**
 * Gece Tablosu (GDD §13.6, §10.3): bölümün patlama günlüğünden belirlenimli
 * çizilen kişisel tablo. 512×768 referans tuval: mahalle gökyüzü ve silueti;
 * her kayıt bir havai fişek izine dönüşür (konum: tahta x → %10–90, tahta y →
 * yükseklik, alt satırlar alçakta; yarıçap 18 + 10·nesil; renk kapsül rengi;
 * desen özel türüne göre: roket → çizgi, kasımpatı → küre, yıldız →
 * gökkuşağı halka). Uzun pozlama `lighter` katmanında alfa 0,08–0,2
 * çizgilerle. Sapmalar mulberry32(tohum) — aynı girdi aynı tabloyu verir.
 * Nadirlik çerçevesi: Sade ahşap, Parlak pirinç, Şaheser altın varak + ışık süzmesi.
 *
 * Kayıt biçimi (32 bit): x 4, y 4, renk 3 (7 = yıldız topu), nesil 4,
 * özel 3 (0 yok, 1 roket, 2 kasımpatı, 3 yıldız), t/10 14 bit.
 */
import { GOKYUZU, KAPSUL_RENKLERI, MAHALLELER } from '../app/katalog';
import { rngSonraki } from '../core/rng';
import { kasabaCiz } from './kasaba';
import { hslHex, karistir, rgba } from './matematik';
import { yuvarlakDikdortgen } from './tuval';

export interface TabloKaydi {
  x: number;
  y: number;
  /** 0..5; 7 (ya da −1) yıldız topu. */
  renk: number;
  nesil: number;
  /** 0 yok, 1 roket, 2 kasımpatı, 3 yıldız. */
  ozel: number;
  /** Tik/10 (14 bit). */
  t: number;
}

export type Nadirlik = 'sade' | 'parlak' | 'saheser' | 0 | 1 | 2;

/** Kaydı 32 bitlik tamsayıya paketle. */
export function kayitPaketle(k: TabloKaydi): number {
  const renk = k.renk < 0 ? 7 : k.renk & 7;
  return ((k.x & 15) | ((k.y & 15) << 4) | (renk << 8) | ((k.nesil & 15) << 11) | ((k.ozel & 7) << 15) | ((Math.min(16383, Math.max(0, k.t)) & 16383) << 18)) >>> 0;
}

export function kayitCoz(n: number): TabloKaydi {
  return { x: n & 15, y: (n >>> 4) & 15, renk: (n >>> 8) & 7, nesil: (n >>> 11) & 15, ozel: (n >>> 15) & 7, t: (n >>> 18) & 16383 };
}

/** Bir iz çizgisi: ikinci dereceden eğri, alfa ve kalınlık. */
export interface IzCizgisi {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  a: number;
  k: number;
  renk: string;
}

export interface TabloPatlamasi {
  x: number;
  y: number;
  r: number;
  renk: string;
  desen: 'cizgi' | 'kure' | 'halka' | 'sade';
  cizgiler: IzCizgisi[];
}

function mulberry(tohum: number): () => number {
  const d = { rng: tohum >>> 0 };
  return () => rngSonraki(d) / 4294967296;
}

/** Saf plan: kayıtlardan iz çizgileri (test edilebilir, belirlenimli). */
export function tabloPlani(kayitlar: readonly (TabloKaydi | number)[], gen: number, yuk: number, tohum: number): TabloPatlamasi[] {
  const r = mulberry(tohum ^ 0x5bd1e995);
  const ks = kayitlar.map((k) => (typeof k === 'number' ? kayitCoz(k) : k));
  let maxX = 4;
  let maxY = 5;
  for (const k of ks) {
    maxX = Math.max(maxX, k.x);
    maxY = Math.max(maxY, k.y);
  }
  const o = gen / 512;
  return ks.map((k) => {
    const x = gen * (0.1 + (0.8 * k.x) / maxX) + (r() - 0.5) * 18 * o;
    const y = yuk * (0.1 + (0.5 * k.y) / maxY) + (r() - 0.5) * 18 * o;
    const rad = (18 + 10 * k.nesil) * o;
    const yildiz = k.renk === 7 || k.renk < 0 || k.ozel === 3;
    const renk = yildiz ? '#FFFFFF' : KAPSUL_RENKLERI[Math.min(5, k.renk)].ana;
    const desen: TabloPatlamasi['desen'] = k.ozel === 1 ? 'cizgi' : k.ozel === 2 ? 'kure' : yildiz ? 'halka' : 'sade';
    const cizgiler: IzCizgisi[] = [];
    const dus = 0.35 * rad;
    if (desen === 'cizgi') {
      // Roket: eksen boyunca iki yönlü uzun parlak çizgi + kıvılcım kılçıkları.
      const a = Math.floor(r() * 4) * (Math.PI / 4);
      for (let s = -1; s <= 1; s += 2) {
        const L = rad * (3.2 + r() * 0.8);
        cizgiler.push({ x0: x, y0: y, cx: x + Math.cos(a) * s * L * 0.5, cy: y + Math.sin(a) * s * L * 0.5, x1: x + Math.cos(a) * s * L, y1: y + Math.sin(a) * s * L + dus * 0.4, a: 0.2, k: 2.4 * o, renk });
        for (let j = 1; j <= 5; j++) {
          const px = x + Math.cos(a) * s * L * (j / 6);
          const py = y + Math.sin(a) * s * L * (j / 6);
          const b = a + Math.PI / 2 + (r() - 0.5) * 0.6;
          const l = rad * (0.2 + r() * 0.3);
          cizgiler.push({ x0: px, y0: py, cx: px + Math.cos(b) * l * 0.5, cy: py + Math.sin(b) * l * 0.5, x1: px + Math.cos(b) * l, y1: py + Math.sin(b) * l + dus * 0.3, a: 0.1, k: 1.2 * o, renk });
        }
      }
    } else {
      const n = desen === 'kure' ? 36 : desen === 'halka' ? 30 : 12 + Math.floor(r() * 6);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + (r() - 0.5) * 0.25;
        const z = desen === 'kure' ? Math.sqrt(r()) : 1;
        const L = rad * (desen === 'halka' ? 1.25 : (desen === 'kure' ? 1.6 : 1.1) * (0.75 + 0.35 * z));
        const bas = desen === 'halka' ? L * 0.82 : 0;
        const c = desen === 'halka' ? hslHex((j / n) * 360, 0.95, 0.65) : r() < 0.15 ? '#FFF4C2' : renk;
        cizgiler.push({
          x0: x + Math.cos(a) * bas,
          y0: y + Math.sin(a) * bas,
          cx: x + Math.cos(a) * L * 0.6,
          cy: y + Math.sin(a) * L * 0.6,
          x1: x + Math.cos(a) * L,
          y1: y + Math.sin(a) * L + dus * (desen === 'kure' ? 1.4 : 1),
          a: 0.08 + r() * 0.12,
          k: (desen === 'halka' ? 2.2 : 1.5) * o,
          renk: c,
        });
      }
    }
    return { x, y, r: rad, renk, desen, cizgiler };
  });
}

/** Gece Tablosu tuvali (offscreen, belirlenimli). */
export function tabloCiz(kayitlar: readonly (TabloKaydi | number)[], mahalleIndeksi: number, nadirlik: Nadirlik, genislik = 512, yukseklik = 768, tohum?: number): HTMLCanvasElement {
  const W = Math.max(64, Math.round(genislik));
  const H = Math.max(96, Math.round(yukseklik));
  const tuval = document.createElement('canvas');
  tuval.width = W;
  tuval.height = H;
  const c = tuval.getContext('2d')!;
  const nd = nadirlik === 0 || nadirlik === 'sade' ? 0 : nadirlik === 1 || nadirlik === 'parlak' ? 1 : 2;
  const kayitTohumu = tohum ?? kayitlar.reduce<number>((h, k) => Math.imul(h ^ (typeof k === 'number' ? k : kayitPaketle(k)), 0x01000193) >>> 0, 0x811c9dc5);
  const r = mulberry(kayitTohumu);
  const m = MAHALLELER[((mahalleIndeksi % 8) + 8) % 8];
  const g = GOKYUZU[m.gokyuzu];
  const o = W / 512;
  const ufuk = Math.round(H * 0.8);

  // Gökyüzü
  const gg = c.createLinearGradient(0, 0, 0, ufuk);
  gg.addColorStop(0, g.ust);
  gg.addColorStop(1, g.alt);
  c.fillStyle = gg;
  c.fillRect(0, 0, W, ufuk);
  for (let i = 0; i < 160; i++) {
    c.fillStyle = `rgba(255,248,230,${(0.15 + r() * 0.5).toFixed(3)})`;
    const s = r() < 0.1 ? 1.6 : 1;
    c.fillRect(r() * W, Math.pow(r(), 1.3) * ufuk, s * o, s * o);
  }
  // Deniz
  const dg = c.createLinearGradient(0, ufuk, 0, H);
  dg.addColorStop(0, karistir(g.alt, '#0A0E26', 0.35));
  dg.addColorStop(1, '#0A0E26');
  c.fillStyle = dg;
  c.fillRect(0, ufuk, W, H - ufuk);

  // Uzun pozlama: fişek izleri (lighter).
  const plan = tabloPlani(kayitlar, W, ufuk, kayitTohumu);
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  for (const p of plan) {
    // Yükselen iz
    c.strokeStyle = rgba(p.renk === '#FFFFFF' ? '#FFE9C0' : p.renk, 0.06);
    c.lineWidth = 1.2 * o;
    c.beginPath();
    c.moveTo(p.x + (r() - 0.5) * 20 * o, ufuk);
    c.quadraticCurveTo(p.x + (r() - 0.5) * 30 * o, (p.y + ufuk) / 2, p.x, p.y);
    c.stroke();
    // Hale
    const hg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
    hg.addColorStop(0, rgba(p.renk, 0.16));
    hg.addColorStop(1, rgba(p.renk, 0));
    c.fillStyle = hg;
    c.fillRect(p.x - p.r * 2.2, p.y - p.r * 2.2, p.r * 4.4, p.r * 4.4);
    for (const z of p.cizgiler) {
      c.strokeStyle = rgba(z.renk, z.a);
      c.lineWidth = z.k * 2.4;
      c.beginPath();
      c.moveTo(z.x0, z.y0);
      c.quadraticCurveTo(z.cx, z.cy, z.x1, z.y1);
      c.stroke();
      c.strokeStyle = rgba(karistir(z.renk === '#FFFFFF' ? '#FFFFFF' : z.renk, '#FFFFFF', 0.5), Math.min(0.2, z.a * 1.3));
      c.lineWidth = z.k;
      c.stroke();
      // Uçta pırıltı
      c.fillStyle = rgba('#FFF4C2', z.a * 1.6);
      c.beginPath();
      c.arc(z.x1, z.y1, z.k * 0.9, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = rgba('#FFFFFF', 0.35);
    c.beginPath();
    c.arc(p.x, p.y, 2.2 * o, 0, Math.PI * 2);
    c.fill();
  }
  // Denizde yansıma: izlerin dikey aynası, sönük şeritler.
  for (const p of plan) {
    c.fillStyle = rgba(p.renk, 0.05);
    for (let k = 0; k < 6; k++) {
      const yy = ufuk + 6 * o + k * ((H - ufuk) / 7);
      const w = (10 + k * 6) * o;
      c.fillRect(p.x - w / 2 + (r() - 0.5) * 8 * o, yy, w, 1.6 * o);
    }
  }
  c.globalCompositeOperation = 'source-over';
  // Kasaba silueti
  kasabaCiz(c, 0, W, ufuk, mahalleIndeksi, 0x51f1 + mahalleIndeksi * 977, 1.25 * o);
  // Nadirlik çerçevesi
  cerceve(c, W, H, nd, r);
  return tuval;
}

function cerceve(c: CanvasRenderingContext2D, W: number, H: number, nd: number, r: () => number): void {
  const o = W / 512;
  const k = Math.round((nd === 2 ? 26 : nd === 1 ? 22 : 20) * o);
  // Işık süzmesi (Şaheser): üstten inen saydam ışınlar.
  if (nd === 2) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = W * (0.15 + i * 0.18 + (r() - 0.5) * 0.05);
      const g = c.createLinearGradient(x, 0, x + W * 0.1, H * 0.7);
      g.addColorStop(0, 'rgba(255,236,170,0.16)');
      g.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - 18 * o, 0);
      c.lineTo(x + 18 * o, 0);
      c.lineTo(x + W * 0.16, H * 0.75);
      c.lineTo(x + W * 0.02, H * 0.75);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  yuvarlakDikdortgen(c, k, k, W - 2 * k, H - 2 * k, 6 * o, true);
  c.clip('evenodd');
  const renkler = nd === 0 ? ['#4E321F', '#3A2416', '#24160D'] : nd === 1 ? ['#F2C66D', '#D9A441', '#7A3E1C'] : ['#FFF3B0', '#F2C66D', '#B8862A'];
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, renkler[0]);
  g.addColorStop(0.5, renkler[1]);
  g.addColorStop(1, renkler[2]);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  if (nd === 0) {
    // Ahşap damar
    c.strokeStyle = 'rgba(20,10,4,0.35)';
    c.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const y = r() * H;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 8, W * 0.7, y + (r() - 0.5) * 8, W, y + (r() - 0.5) * 6);
      c.stroke();
    }
  } else {
    // Pirinç / varak benekleri
    for (let i = 0; i < (nd === 2 ? 900 : 300); i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(255,255,230,0.25)' : 'rgba(120,70,10,0.18)';
      c.fillRect(r() * W, r() * H, (nd === 2 ? 3 : 1.5) * o, (nd === 2 ? 2 : 1.5) * o);
    }
  }
  c.restore();
  // Kabartma kenarları
  c.lineWidth = 2 * o;
  c.strokeStyle = nd === 0 ? 'rgba(255,214,150,0.18)' : 'rgba(255,250,220,0.75)';
  c.strokeRect(1.5 * o, 1.5 * o, W - 3 * o, H - 3 * o);
  c.strokeStyle = 'rgba(0,0,0,0.55)';
  yuvarlakDikdortgen(c, k, k, W - 2 * k, H - 2 * k, 6 * o);
  c.stroke();
  c.strokeStyle = nd === 0 ? 'rgba(255,214,150,0.15)' : 'rgba(255,240,200,0.6)';
  c.lineWidth = 1 * o;
  yuvarlakDikdortgen(c, k - 4 * o, k - 4 * o, W - 2 * k + 8 * o, H - 2 * k + 8 * o, 8 * o);
  c.stroke();
  // Köşe süsleri (Parlak ve Şaheser)
  if (nd > 0) {
    for (const [x, y] of [
      [k / 2, k / 2],
      [W - k / 2, k / 2],
      [W - k / 2, H - k / 2],
      [k / 2, H - k / 2],
    ]) {
      const rg = c.createRadialGradient(x - 2 * o, y - 2 * o, 0, x, y, k * 0.45);
      rg.addColorStop(0, '#FFFBE0');
      rg.addColorStop(0.5, nd === 2 ? '#F2C66D' : '#D9A441');
      rg.addColorStop(1, '#7A3E1C');
      c.fillStyle = rg;
      c.beginPath();
      c.arc(x, y, k * 0.36, 0, Math.PI * 2);
      c.fill();
    }
  }
}
