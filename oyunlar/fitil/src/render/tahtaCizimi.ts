/**
 * Tahta katmanı çizimi (GDD §13.2, §16.6 katman 3): zemin (döşeme, desen,
 * barut izi), kapsüller ve engeller. Kompozit geçişleri toplu yapılır:
 *   0 gölge → 1 parıltı (lighter) → 2 gövdeler/engeller/kafes/boş yuvalar →
 *   3 dolu yuvalar, kızgın çekirdek, pırıltı (lighter).
 * Hücre başına dönüşüm değerleri önceden ayrılmış dizilere yazılır.
 */
import { IpCizici, type IpRenkleri } from './ip';
import { ozelUstCiz } from './efektler';
import { INIS_MS, NABIZ_MS } from './gorselTahta';
import { outBack, outCubic, perlin1, tepe } from './matematik';
import { P } from './palet';
import type { Sahne } from './sahne';
import type { Ctx } from './tuval';

const IZ_RENK: IpRenkleri = { ana: '#4A443E', acik: '#7A7068', koyu: '#2A2622', parilti: null };

export class TahtaCizimi {
  private n = 0;
  private cx = new Float32Array(0);
  private cy = new Float32Array(0);
  private sx = new Float32Array(0);
  private sy = new Float32Array(0);
  private ust = new Uint8Array(0);
  private izIpleri: IpCizici[] = [];
  /** İz hücresinin ip üzerindeki s değeri (izIndeksi → [s...]). */
  private izS: Float32Array[] = [];
  /** Önizleme: hücreye eklenecek ısı (hayalet yuvalar). */
  onizlemeIsi = new Int8Array(0);

  constructor(private s: Sahne) {}

  /** Tahta boyutu ya da geometri değişince. */
  kur(): void {
    const t = this.s.tahta;
    const n = t.w * t.h;
    if (n !== this.n) {
      this.n = n;
      this.cx = new Float32Array(n);
      this.cy = new Float32Array(n);
      this.sx = new Float32Array(n);
      this.sy = new Float32Array(n);
      this.ust = new Uint8Array(n);
      this.onizlemeIsi = new Int8Array(n);
    }
    this.izleriKur();
  }

  izleriKur(): void {
    const s = this.s;
    const t = s.tahta;
    this.izIpleri = t.izler.map((iz) => {
      const ip = new IpCizici();
      const xs = iz.map((i) => s.mx(i % t.w));
      const ys = iz.map((i) => s.my(Math.floor(i / t.w)));
      ip.ornekle(xs, ys, iz.length, false, s.c * 0.3, 2);
      return ip;
    });
    this.izS = this.izIpleri.map((ip) => ip.dugumS.slice(0, ip.dugumSayi));
  }

  /** Zemin: döşemeler, desen hücreleri ve motif çizgileri, barut izleri. */
  zemin(c: Ctx): void {
    const s = this.s;
    const t = s.tahta;
    const e = s.engel;
    const hc = s.c;
    const tt = s.tTahta;
    for (let i = 0; i < t.hucreler.length; i++) {
      const h = t.hucreler[i];
      if (h.delik) continue;
      const x = s.mx(i % t.w);
      const y = s.my((i / t.w) | 0);
      if (h.doseme > 0) {
        const sp = e.doseme[h.doseme];
        c.drawImage(sp.t, x - sp.ox, y - sp.oy, sp.w, sp.h);
        if (h.dosemeAcilis < 1) this.isikHalkasi(c, x, y, h.dosemeAcilis, P.sicakIsik);
      } else if (h.ilkDoseme > 0) {
        const sp = e.dosemeIsik;
        if (h.dosemeAcilis < 1) {
          const alt = e.doseme[1];
          c.drawImage(alt.t, x - alt.ox, y - alt.oy, alt.w, alt.h);
          const k = outCubic(h.dosemeAcilis);
          const kare = e.dosemeAcilis[Math.min(e.dosemeAcilis.length - 1, Math.floor(k * e.dosemeAcilis.length))];
          c.drawImage(kare.t, x - kare.ox, y - kare.oy, kare.w, kare.h);
          this.isikHalkasi(c, x, y, h.dosemeAcilis, P.sicakIsik);
        } else {
          c.drawImage(sp.t, x - sp.ox, y - sp.oy, sp.w, sp.h);
        }
      }
      if (h.desenRengi >= 0 && h.desenRengi < 6) {
        const sp = h.desenBoyali ? e.desenBoyali[h.desenRengi] : e.desen[h.desenRengi];
        c.drawImage(sp.t, x - sp.ox, y - sp.oy, sp.w, sp.h);
      }
    }
    // Motif çizgileri: boyalı desen hücrelerini komşularına bağlar.
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (let i = 0; i < t.hucreler.length; i++) {
      const h = t.hucreler[i];
      if (h.delik || h.desenRengi < 0 || !h.desenBoyali) continue;
      const hx = i % t.w;
      const hy = (i / t.w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = hx + (k === 0 ? 1 : k === 1 ? 0 : k === 2 ? 1 : -1);
        const ny = hy + (k === 0 ? 0 : 1);
        if (nx < 0 || nx >= t.w || ny >= t.h) continue;
        const m = t.hucreler[ny * t.w + nx];
        if (m.delik || m.desenRengi < 0 || !m.desenBoyali) continue;
        const a = Math.min(h.desenAcilis, m.desenAcilis);
        const x0 = s.mx(hx);
        const y0 = s.my(hy);
        const x1 = x0 + (s.mx(nx) - x0) * a;
        const y1 = y0 + (s.my(ny) - y0) * a;
        c.strokeStyle = s.kapsulRenk[h.desenRengi].acik;
        c.globalAlpha = 0.22;
        c.lineWidth = hc * 0.16;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
        c.globalAlpha = 0.85;
        c.lineWidth = 2;
        c.stroke();
      }
      if (h.desenAcilis < 1) {
        const n = s.parilti.nokta[h.desenRengi];
        const r = hc * (0.5 + 0.6 * h.desenAcilis);
        c.globalAlpha = 1 - h.desenAcilis;
        c.drawImage(n.t, s.mx(hx) - r, s.my(hy) - r, 2 * r, 2 * r);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    // Barut izleri: zeminde koyu gri örgülü ip; yanan kısımlar kömür.
    for (let k = 0; k < this.izIpleri.length; k++) {
      const ip = this.izIpleri[k];
      const iz = t.izler[k];
      const ss = this.izS[k];
      if (!ip || !iz || ip.n < 2) continue;
      for (let j = 0; j + 1 < iz.length; j++) {
        const a = t.hucreler[iz[j]];
        const b = t.hucreler[iz[j + 1]];
        if (a.izYandi && b.izYandi) ip.cizYanmis(c, ss[j], ss[j + 1], hc * 0.16, 1e9, 0.85);
        else ip.ciz(c, ss[j], ss[j + 1], hc * 0.13, IZ_RENK, 0, 0);
      }
      // Düğüm başlarına küçük barut kesesi
      for (let j = 0; j < iz.length; j++) {
        const h = t.hucreler[iz[j]];
        const x = s.mx(iz[j] % t.w);
        const y = s.my((iz[j] / t.w) | 0);
        c.fillStyle = h.izYandi ? '#1A1414' : '#3A3430';
        c.beginPath();
        c.arc(x, y, hc * 0.09, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = h.izYandi ? 'rgba(255,122,26,0.35)' : 'rgba(200,190,170,0.35)';
        c.lineWidth = 1;
        c.stroke();
      }
    }
    tt.uygula(c);
  }

  private isikHalkasi(c: Ctx, x: number, y: number, k: number, renk: string): void {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.8 * (1 - k);
    c.strokeStyle = renk;
    c.lineWidth = 3 * (1 - k) + 0.5;
    c.beginPath();
    c.arc(x, y, this.s.c * (0.15 + 0.6 * outCubic(k)), 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  /** Hücre başına konum/ölçek değerlerini hesapla. */
  private hazirla(): void {
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    const zaman = s.zaman;
    const azalt = s.secenek.hareketiAzalt;
    const nefes = !s.oynuyor && !azalt;
    for (let i = 0; i < t.hucreler.length; i++) {
      const h = t.hucreler[i];
      this.ust[i] = 0;
      if (h.delik || !h.icerik) continue;
      let x = s.mx(i % t.w) + h.ox * hc;
      let y = s.my((i / t.w) | 0) + h.oy * hc;
      let o = h.olcek.x;
      if (h.geriAl >= 0) o *= 1 + 0.1 * (1 - outCubic(h.geriAl / 120));
      if (h.pop >= 0) o *= 0.55 + 0.45 * outBack(Math.min(1, h.pop / 320));
      if (nefes) o *= 1 + 0.02 * Math.sin(zaman * 0.001 * Math.PI * 2 * 0.3 + h.faz);
      // Karıştırmada kapsüller kalkar (yolun ortasında büyür).
      if (h.hTur === 2) o *= 1 + 0.16 * tepe(Math.min(1, h.hT / h.hSure));
      let sx = o;
      let sy = o;
      if (h.inis >= 0) {
        const k = tepe(h.inis / INIS_MS);
        sy *= 1 - 0.1 * k;
        sx *= 1 + 0.06 * k;
        y += hc * 0.4 * 0.1 * k;
      }
      if (!azalt) {
        if (h.kizgin > 0) {
          x += perlin1(zaman * 0.03, i) * h.kizgin;
          y += perlin1(zaman * 0.03 + 50, i) * h.kizgin;
        }
        const ti = s.titresim[i];
        if (ti > 0) {
          x += Math.sin(zaman * 0.09 + i * 1.7) * 1.5 * ti;
          y += Math.cos(zaman * 0.113 + i * 2.3) * 1.5 * ti;
        }
        if (h.titreme > 0) {
          x += Math.sin(zaman * 0.21 + i) * 2;
          y += Math.cos(zaman * 0.17 + i) * 1.2;
        }
        if (h.hasar > 0) x += Math.sin(zaman * 0.25) * 2.5 * (h.hasar / 140);
      }
      this.cx[i] = x;
      this.cy[i] = y;
      this.sx[i] = sx;
      this.sy[i] = sy;
      // Tahtanın üstünde (doğan/düşen) içerik: kırpılmış geçişte çizilir.
      if (h.oy < 0 && ((i / t.w) | 0) + h.oy < 0) this.ust[i] = 1;
    }
  }

  /**
   * İçerikleri çiz. `kirpUst` true ise tahta üstünden düşenler tahta
   * dikdörtgenine kırpılır (çerçevenin arkasından çıkarlar).
   */
  icerik(c: Ctx): boolean {
    const s = this.s;
    const t = s.tahta;
    this.hazirla();
    let ustVar = false;
    for (let i = 0; i < this.n; i++) if (this.ust[i]) ustVar = true;
    this.gecisler(c, 0);
    if (ustVar) {
      c.save();
      c.beginPath();
      c.rect(s.gx - s.c, s.gy, t.w * s.c + 2 * s.c, t.h * s.c + s.c);
      c.clip();
      this.gecisler(c, 1);
      c.restore();
      s.tTahta.uygula(c);
    }
    return ustVar;
  }

  private gecisler(c: Ctx, ustMu: number): void {
    const s = this.s;
    const t = s.tahta;
    const k = s.kapsul;
    const e = s.engel;
    const hc = s.c;
    const tt = s.tTahta;
    const z = s.zaman;
    const E = Math.max(2, Math.min(5, t.esik));
    const gizli = t.gizliIsi;
    const nabizIsi = 1 + 0.02 * Math.sin(z * 0.001 * Math.PI * 2 * 1.5);

    // 0: gölgeler
    for (let i = 0; i < this.n; i++) {
      const h = t.hucreler[i];
      const ic = h.icerik;
      if (!ic || h.delik || h.gizli || this.ust[i] !== ustMu) continue;
      if (ic.tur !== 'kapsul' && ic.tur !== 'islak') continue;
      tt.sprite(c, k.golge, this.cx[i], this.cy[i] + hc * 0.34, 0, this.sx[i], this.sx[i]);
    }
    // 1: parıltılar (lighter)
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const h = t.hucreler[i];
      const ic = h.icerik;
      if (!ic || h.delik || h.gizli || this.ust[i] !== ustMu) continue;
      const x = this.cx[i];
      const y = this.cy[i];
      if (ic.tur === 'kapsul') {
        if (s.pariltiA > 0) {
          const g = ic.renk < 0 ? k.inciParilti : k.parilti[ic.renk];
          if (s.pariltiA < 1) c.globalAlpha = s.pariltiA;
          tt.sprite(c, g, x, y, 0, this.sx[i], this.sx[i]);
          c.globalAlpha = 1;
        }
        if (ic.ozel !== 'yok') {
          c.globalAlpha = 0.55 + 0.35 * Math.sin(z * 0.005 + h.faz);
          tt.sprite(c, k.ozelHale, x, y, 0, this.sx[i], this.sx[i]);
          c.globalAlpha = 1;
        }
      } else if (ic.tur === 'fener') {
        c.globalAlpha = 0.75 + 0.2 * Math.sin(z * 0.011 + h.faz) + 0.05 * Math.sin(z * 0.037);
        tt.sprite(c, e.fenerParilti, x, y + hc * 0.06, 0, 1, 1);
        c.globalAlpha = 1;
      } else if (ic.tur === 'kova') {
        // Kalkan çerçevesi: soluk mavi (alfa 0,25), hafif nabız.
        tt.uygula(c); // önceki sprite'ın yerel dönüşümü yolları kaydırmasın
        c.globalAlpha = 0.25 + 0.08 * Math.sin(z * 0.004 + h.faz);
        c.strokeStyle = '#7FC8FF';
        c.lineWidth = 2.5;
        yuvarlakKareYol(c, x, y, hc * 0.47, hc * 0.18);
        c.stroke();
        c.globalAlpha *= 0.5;
        c.lineWidth = 7;
        c.stroke();
        // Dik komşulara kalkan yayı (o yönden ısı gelmez).
        c.globalAlpha = 0.22;
        c.lineWidth = 2;
        const hx = i % t.w;
        const hy = (i / t.w) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = hx + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const ny = hy + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= t.w || ny >= t.h || t.hucreler[ny * t.w + nx].delik) continue;
          const ax = s.mx(nx) - (nx - hx) * hc * 0.36;
          const ay = s.my(ny) - (ny - hy) * hc * 0.36;
          const aci = Math.atan2(hy - ny, hx - nx);
          c.beginPath();
          c.arc(ax, ay, hc * 0.22, aci - 0.9, aci + 0.9);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
    }
    c.globalCompositeOperation = 'source-over';

    // 2: gövdeler, engeller, kafes, boş yuvalar
    for (let i = 0; i < this.n; i++) {
      const h = t.hucreler[i];
      const ic = h.icerik;
      if (!ic || h.delik || h.gizli || this.ust[i] !== ustMu) continue;
      const x = this.cx[i];
      const y = this.cy[i];
      const sx = this.sx[i];
      const sy = this.sy[i];
      switch (ic.tur) {
        case 'kapsul': {
          const g = ic.renk < 0 ? k.inciTaban : k.govde[ic.renk];
          tt.sprite(c, g, x, y, 0, sx, sy);
          if (ic.ozel !== 'yok') ozelUstCiz(c, s, ic, x, y, z / 1000, sx);
          if (h.kafes) tt.sprite(c, k.kafes, s.mx(i % t.w), s.my((i / t.w) | 0), 0, 1, 1);
          if (!gizli) tt.sprite(c, k.yuvaBos[E], x, y, 0, h.isiGorunen > 0 ? nabizIsi : 1, h.isiGorunen > 0 ? nabizIsi : 1);
          break;
        }
        case 'islak':
          tt.sprite(c, k.islak[ic.renk], x, y, 0, sx, sy);
          break;
        case 'fener': {
          const aci = s.secenek.hareketiAzalt ? 0 : 0.13 * Math.sin(z * 0.001 * Math.PI * 2 * 0.5 + h.faz);
          tt.sprite(c, e.fener, x, y - hc * 0.44, aci, sx, sy);
          break;
        }
        case 'kaya':
          tt.sprite(c, e.kaya[ic.kat], x, y, 0, 1, 1);
          break;
        case 'kova':
          tt.sprite(c, e.kova[ic.kat], x, y, 0, 1, 1);
          break;
        case 'devFisek': {
          const tik = h.dolumNabiz >= 0 ? 1 + 0.1 * tepe(h.dolumNabiz / 120) : 1;
          tt.sprite(c, e.devFisek, x, y, 0, tik, tik);
          tt.sprite(c, e.devFisekHalkasi(ic.kapasite, ic.dolum), x, y, 0, tik, tik);
          break;
        }
        case 'is': {
          const o = s.secenek.hareketiAzalt ? 1 : 1 + 0.035 * Math.sin(z * 0.0021 + h.faz);
          const aci = s.secenek.hareketiAzalt ? 0 : 0.05 * Math.sin(z * 0.0013 + h.faz * 2);
          tt.sprite(c, e.is, x + Math.sin(z * 0.0017 + h.faz) * 1.2, y, aci, o * sx, o * sy);
          break;
        }
      }
    }
    tt.uygula(c);

    // 3: dolu yuvalar, ısı nabzı, kızgın çekirdek, yıldız pırıltısı (lighter)
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const h = t.hucreler[i];
      const ic = h.icerik;
      if (!ic || ic.tur !== 'kapsul' || h.delik || h.gizli || this.ust[i] !== ustMu) continue;
      const x = this.cx[i];
      const y = this.cy[i];
      const kz = ic.isi >= E - 1;
      const goster = !gizli || kz;
      const isi = gizli ? (kz ? E - 1 : 0) : h.isiGorunen;
      if (goster && isi > 0) {
        const tam = Math.min(E - 1, Math.floor(isi + 1e-4));
        if (tam > 0) tt.sprite(c, k.yuvaDolu[E][tam], x, y, 0, nabizIsi, nabizIsi);
        const kesir = isi - tam;
        if (kesir > 0.02 && tam < E - 1) {
          tt.uygula(c);
          this.kismiYay(c, x, y, E, tam, kesir);
        }
      }
      const pre = this.onizlemeIsi[i];
      if (pre > 0 && !gizli) {
        tt.uygula(c);
        this.hayaletYuva(c, x, y, E, Math.round(h.isiGorunen), pre);
      }
      if (h.nabiz >= 0) {
        tt.uygula(c);
        const nk = h.nabiz / NABIZ_MS;
        c.globalAlpha = 0.85 * (1 - nk);
        c.strokeStyle = P.isiHalkasi;
        c.lineWidth = hc * 0.07;
        c.beginPath();
        c.arc(x, y, hc * 0.47 * (1 + 0.15 * tepe(nk)), 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
      if (h.kizgin > 0) {
        const nab = s.secenek.hareketiAzalt ? 1 : 1 + 0.04 * Math.sin(z * 0.001 * Math.PI * 2 * 3 + h.faz);
        c.globalAlpha = h.kizgin;
        tt.sprite(c, k.kizgin, x, y, 0, nab * this.sx[i], nab * this.sx[i]);
        c.globalAlpha = 1;
      }
      if (ic.ozel === 'yildiz') {
        const p = 0.6 + 0.4 * Math.sin(z * 0.006 + h.faz);
        c.globalAlpha = 0.9;
        tt.sprite(c, k.piriltiYildiz, x + hc * 0.16, y - hc * 0.18, z * 0.0015, p * 0.7, p * 0.7);
        c.globalAlpha = 1;
      }
    }
    tt.uygula(c);
    c.globalCompositeOperation = 'source-over';
  }

  /** 120 ms'de dolan yuva: kesirli yay (dinamik). */
  private kismiYay(c: Ctx, x: number, y: number, E: number, i: number, kesir: number): void {
    const hc = this.s.c;
    const n = E - 1;
    const seg = (Math.PI * 2) / n;
    const bosluk = (14 * Math.PI) / 180;
    const a0 = -Math.PI / 2 + i * seg + bosluk / 2;
    const a1 = a0 + (seg - bosluk) * kesir;
    c.lineCap = 'round';
    c.strokeStyle = P.isiHalkasi;
    c.lineWidth = hc * 0.06;
    c.beginPath();
    c.arc(x, y, hc * 0.47, a0, a1);
    c.stroke();
    c.strokeStyle = P.beyazSicak;
    c.lineWidth = hc * 0.025;
    c.stroke();
  }

  /** Önizleme: eklenecek ısının hayalet yuvaları (nabızla). */
  private hayaletYuva(c: Ctx, x: number, y: number, E: number, isi: number, artis: number): void {
    const hc = this.s.c;
    const n = E - 1;
    const seg = (Math.PI * 2) / n;
    const bosluk = (14 * Math.PI) / 180;
    c.lineCap = 'round';
    c.strokeStyle = P.isiHalkasi;
    c.lineWidth = hc * 0.06;
    c.globalAlpha = 0.4 + 0.35 * Math.sin(this.s.zaman * 0.012);
    for (let k = isi; k < Math.min(n, isi + artis); k++) {
      const a0 = -Math.PI / 2 + k * seg + bosluk / 2;
      c.beginPath();
      c.arc(x, y, hc * 0.47, a0, a0 + seg - bosluk);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /** Hücrenin hesaplanmış çizim merkezi (efektler için). */
  merkez(i: number, cikis: { x: number; y: number }): void {
    cikis.x = this.cx[i];
    cikis.y = this.cy[i];
  }
}

function yuvarlakKareYol(c: Ctx, x: number, y: number, r: number, yr: number): void {
  c.beginPath();
  c.moveTo(x - r + yr, y - r);
  c.arcTo(x + r, y - r, x + r, y + r, yr);
  c.arcTo(x + r, y + r, x - r, y + r, yr);
  c.arcTo(x - r, y + r, x - r, y - r, yr);
  c.arcTo(x - r, y - r, x + r, y - r, yr);
  c.closePath();
}

