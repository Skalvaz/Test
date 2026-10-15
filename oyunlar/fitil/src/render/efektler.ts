/**
 * Kısa ömürlü görsel efektler (GDD §12.2 "Animasyon" sütunu): şok halkası,
 * beyaz çekirdek, ezilme, bozulma halkası, ısı dalgası, roket başı, yıldız
 * ışını, uçan kıvılcım (hedef kartına / göğe), uçan fener, yüklü taş, halka
 * ışık turu, büyük final halkaları, flaşlar, is bulutu, körük dalgası,
 * kibrit, kalıp, hava süpürmesi.
 *
 * Efekt nesneleri bir havuzda yeniden kullanılır. Zaman: oyun ms'i (yavaş
 * çekim ve hızlandırma dahil); `gecikme` dolana kadar efekt görünmez.
 */
import { B, T } from './parcacik';
import { R } from './palet';
import { bezier2, inOutCubic, outCubic, tepe } from './matematik';
import type { Sahne } from './sahne';
import type { Ctx } from './tuval';
import type { IpCizici } from './ip';
import type { Icerik } from '../core/types';

export const E = {
  SOK: 1,
  CEKIRDEK: 2,
  EZILME: 3,
  BOZULMA: 4,
  ISI_DALGA: 5,
  ROKET: 6,
  ISIN: 7,
  KIVILCIM: 8,
  FENER: 9,
  YUKLU: 10,
  HALKA_TURU: 11,
  FINAL_HALKA: 12,
  FLAS: 13,
  DUMAN: 14,
  KORUK: 15,
  KIBRIT: 16,
  KALIP: 17,
  HAVA: 18,
  IZ_KIVILCIM: 19,
  HUCRE_ISIK: 20,
} as const;

export class Efekt {
  tur = 0;
  aktif = false;
  /** true: ekran uzayı (DPR), false: tahta uzayı (kamera). */
  ekran = false;
  x = 0;
  y = 0;
  x1 = 0;
  y1 = 0;
  cx = 0;
  cy = 0;
  dx = 0;
  dy = 0;
  t = 0;
  sure = 0;
  gecikme = 0;
  r0 = 0;
  r1 = 0;
  renk = 0;
  sayi = 0;
  birikim = 0;
  /** Ek veri: içerik (ezilme, yüklü taş), ip (ışık turu). */
  icerik: Icerik | null = null;
  ip: IpCizici | null = null;
  bitince: ((e: Efekt) => void) | null = null;
}

const HAVUZ = 320;

export class Efektler {
  readonly liste: Efekt[] = [];
  /** Bekleyen hedef bildirimleri (oynatma sonu için sayılır). */
  bekleyen = 0;
  /** Alev başının konumu (yüklü taş izler); oyuncu yazar. */
  alevBasi: (gecikmeMs: number, cikis: { x: number; y: number }) => boolean = () => false;
  private nokta = { x: 0, y: 0 };

  constructor(private s: Sahne) {
    for (let i = 0; i < HAVUZ; i++) this.liste.push(new Efekt());
  }

  ekle(tur: number, x: number, y: number, sure: number, gecikme = 0): Efekt | null {
    for (const e of this.liste) {
      if (e.aktif) continue;
      e.tur = tur;
      e.aktif = true;
      e.ekran = false;
      e.x = x;
      e.y = y;
      e.x1 = x;
      e.y1 = y;
      e.cx = x;
      e.cy = y;
      e.dx = 0;
      e.dy = 0;
      e.t = 0;
      e.sure = sure;
      e.gecikme = gecikme;
      e.r0 = 0;
      e.r1 = 0;
      e.renk = 0;
      e.sayi = 0;
      e.birikim = 0;
      e.icerik = null;
      e.ip = null;
      e.bitince = null;
      return e;
    }
    return null;
  }

  temizle(hemen = false): void {
    for (const e of this.liste) {
      if (!e.aktif) continue;
      if (!hemen && e.bitince) {
        const f = e.bitince;
        e.bitince = null;
        f(e);
      }
      e.aktif = false;
    }
    this.bekleyen = 0;
  }

  /** Bildirimi bekleyen uçuşları hemen bitir (oynatma kesilince). */
  bildirimleriBitir(): void {
    for (const e of this.liste) {
      if (e.aktif && e.bitince) {
        const f = e.bitince;
        e.bitince = null;
        f(e);
        e.aktif = false;
      }
    }
  }

  guncelle(dtKare: number): void {
    const s = this.s;
    const h = s.havuz;
    for (const e of this.liste) {
      if (!e.aktif) continue;
      let dt = dtKare;
      if (e.gecikme > 0) {
        e.gecikme -= dt;
        if (e.gecikme > 0) continue;
        dt = -e.gecikme; // gecikmeden artan süre
        e.gecikme = 0;
        if (e.tur === E.ISIN) this.isinVardi(e);
      }
      e.t += dt;
      // Sürekli yayıcılar
      if (e.tur === E.ROKET || e.tur === E.IZ_KIVILCIM) {
        const k = Math.min(1, e.t / e.sure);
        const px = e.x + (e.x1 - e.x) * k;
        const py = e.y + (e.y1 - e.y) * k;
        e.birikim += (dt / 1000) * (e.tur === E.ROKET ? 60 : 30);
        while (e.birikim >= 1 && k < 1) {
          e.birikim -= 1;
          const a = Math.atan2(-e.dy, -e.dx) + (s.rnd.float() - 0.5) * 1.1;
          const v = 60 + s.rnd.float() * 110;
          const i = h.ekle(T.CIZGI, px, py, Math.cos(a) * v, Math.sin(a) * v, 260 + s.rnd.float() * 200, 1.6, e.tur === E.ROKET ? R.BEYAZ_SICAK : R.KOZ, 3, 120);
          if (i >= 0) h.iz[i] = 0.04;
        }
      } else if (e.tur === E.YUKLU) {
        e.birikim += (dt / 1000) * 30;
        while (e.birikim >= 1) {
          e.birikim -= 1;
          const i = h.ekle(T.NOKTA, e.x + (s.rnd.float() - 0.5) * 8, e.y + 6, (s.rnd.float() - 0.5) * 30, 20 + s.rnd.float() * 30, 380, 2.2, R.ALTIN, 2, -20);
          if (i >= 0) h.bayrak[i] |= B.PIRILTI;
        }
      } else if (e.tur === E.KIVILCIM || e.tur === E.FENER) {
        e.birikim += (dt / 1000) * (e.tur === E.FENER ? 40 : 26);
        while (e.birikim >= 1) {
          e.birikim -= 1;
          this.bezierNokta(e, Math.min(1, e.t / e.sure));
          const i = h.ekle(T.NOKTA, this.nokta.x, this.nokta.y, (s.rnd.float() - 0.5) * 20, (s.rnd.float() - 0.5) * 20, 260, e.tur === E.FENER ? 2.6 : 2, e.tur === E.FENER ? R.ALTIN : e.renk, 2, 0);
          if (i >= 0) h.bayrak[i] |= B.UST;
        }
      }
      if (e.t >= e.sure) {
        if (e.tur === E.ROKET && e.sayi > 0) this.kenarSicramasi(e);
        const f = e.bitince;
        e.bitince = null;
        e.aktif = false;
        if (f) f(e);
      }
    }
  }

  private bezierNokta(e: Efekt, k: number): void {
    const t = e.tur === E.FENER ? inOutCubic(k) : outCubic(k * 0.85 + k * k * 0.15);
    this.nokta.x = bezier2(e.x, e.cx, e.x1, t);
    this.nokta.y = bezier2(e.y, e.cy, e.y1, t);
  }

  /** Roket başı tahta kenarına ulaştı: 10 parçalık sıçrama. */
  private kenarSicramasi(e: Efekt): void {
    const s = this.s;
    const n = s.havuz.adet(10);
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(-e.dy, -e.dx) + (s.rnd.float() - 0.5) * 2.2;
      const v = 80 + s.rnd.float() * 180;
      const i = s.havuz.ekle(T.CIZGI, e.x1, e.y1, Math.cos(a) * v, Math.sin(a) * v, 300 + s.rnd.float() * 250, 1.8, k % 2 ? R.BEYAZ_SICAK : R.ALTIN, 3, 260);
      if (i >= 0) s.havuz.iz[i] = 0.04;
    }
  }

  /** Yıldız ışını hedefe vardı: 6 gökkuşağı kıvılcımı. */
  private isinVardi(e: Efekt): void {
    const s = this.s;
    const n = s.havuz.adet(6);
    for (let k = 0; k < n; k++) {
      const a = s.rnd.float() * Math.PI * 2;
      const v = 70 + s.rnd.float() * 140;
      s.havuz.ekle(T.NOKTA, e.x1, e.y1, Math.cos(a) * v, Math.sin(a) * v, 380 + s.rnd.float() * 200, 2.6, R.GOKKUSAGI + ((k + e.sayi) % 6), 2.5, 120);
    }
  }

  /** Tahta uzayındaki efektler (kamera dönüşümü uygulanmış ctx). */
  cizTahta(c: Ctx): void {
    for (const e of this.liste) if (e.aktif && !e.ekran && e.gecikme <= 0) this.ciz1(c, e);
  }

  /** Ekran uzayındaki efektler (uçan kıvılcımlar, fener). */
  cizEkran(c: Ctx): void {
    for (const e of this.liste) if (e.aktif && e.ekran && e.gecikme <= 0) this.ciz1(c, e);
  }

  /** (Fişek ek) Çizilecek ekran uzayı efekti var mı (fişek perdesi için). */
  ekranVar(): boolean {
    for (const e of this.liste) if (e.aktif && e.ekran && e.gecikme <= 0) return true;
    return false;
  }

  private ciz1(c: Ctx, e: Efekt): void {
    const s = this.s;
    const sp = s.parilti;
    const k = Math.min(1, e.t / Math.max(1, e.sure));
    const hc = s.c;
    switch (e.tur) {
      case E.SOK: {
        const r = e.r1 * outCubic(k);
        const kal = e.r0 * (1 - k);
        if (kal < 0.2) return;
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = s.renkler[e.renk];
        c.globalAlpha = 0.85 * (1 - k) * (1 - k * 0.5);
        c.lineWidth = kal;
        c.beginPath();
        c.arc(e.x, e.y, Math.max(0.5, r), 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 0.18 * (1 - k) * (1 - k);
        c.lineWidth = kal * 3;
        c.stroke();
        break;
      }
      case E.CEKIRDEK: {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k * 0.5;
        const r = e.r1;
        const n = sp.nokta[R.BEYAZ_SICAK];
        c.drawImage(n.t, e.x - r * 1.6, e.y - r * 1.6, r * 3.2, r * 3.2);
        c.drawImage(sp.nokta[R.BEYAZ].t, e.x - r, e.y - r, r * 2, r * 2);
        break;
      }
      case E.EZILME: {
        // 80 ms: x 1,3 / y 0,7 ezilme ve kaybolma.
        const ic = e.icerik;
        if (!ic || ic.tur !== 'kapsul') return;
        const sprite = ic.renk < 0 ? s.kapsul.inciTaban : s.kapsul.govde[ic.renk];
        const sx = 1 + 0.3 * outCubic(k);
        const sy = 1 - 0.3 * outCubic(k);
        c.globalAlpha = 1 - k;
        s.tTahta.sprite(c, sprite, e.x, e.y, 0, sx, sy);
        s.tTahta.uygula(c);
        break;
      }
      case E.BOZULMA: {
        // Kasımpatı bozulma halkası: parlak ince halka + içte koyu kırılma bandı.
        const r = e.r1 * outCubic(k);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 0.28 * (1 - k);
        c.strokeStyle = '#000000';
        c.lineWidth = hc * 0.22 * (1 - k * 0.5);
        c.beginPath();
        c.arc(e.x, e.y, Math.max(1, r - hc * 0.14), 0, Math.PI * 2);
        c.stroke();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.75 * (1 - k);
        c.strokeStyle = s.renkler[e.renk];
        c.lineWidth = hc * 0.08 * (1 - k * 0.6);
        c.beginPath();
        c.arc(e.x, e.y, Math.max(1, r), 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 0.5 * (1 - k);
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 1.5;
        c.stroke();
        break;
      }
      case E.ISI_DALGA:
      case E.KORUK: {
        // Isı dalgası: sıcak hava halkası (Chebyshev) genişler; yumuşak bant + ince parlak çekirdek.
        const r = (e.r0 + (e.r1 - e.r0) * outCubic(k)) * hc;
        const titre = Math.sin(e.t * 0.08) * 1.2;
        const a = tepe(Math.min(1, k * 1.25));
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = '#FF7A1A';
        c.globalAlpha = 0.16 * a;
        c.lineWidth = hc * 0.45;
        yuvarlakKare(c, e.x, e.y, r + titre, hc * 0.55);
        c.stroke();
        c.globalAlpha = 0.28 * a;
        c.lineWidth = hc * 0.16;
        c.stroke();
        c.strokeStyle = '#FFD7A0';
        c.globalAlpha = 0.45 * a;
        c.lineWidth = 1.5;
        c.stroke();
        if (e.tur === E.KORUK) {
          c.globalAlpha = 0.14 * (1 - k);
          c.fillStyle = '#FF9A3C';
          yuvarlakKare(c, e.x, e.y, r, hc * 0.55);
          c.fill();
        }
        break;
      }
      case E.ROKET:
      case E.IZ_KIVILCIM: {
        // Baş kural zamanıyla ilerler; ardıl görüntü izi 300 ms.
        const kk = Math.min(1, e.t / e.sure);
        const px = e.x + (e.x1 - e.x) * kk;
        const py = e.y + (e.y1 - e.y) * kk;
        const roket = e.tur === E.ROKET;
        const izMs = 300;
        const kuyruk = Math.max(0, (e.t - izMs) / e.sure);
        const tx = e.x + (e.x1 - e.x) * Math.min(kk, kuyruk);
        const ty = e.y + (e.y1 - e.y) * Math.min(kk, kuyruk);
        const L = Math.hypot(px - tx, py - ty);
        c.globalCompositeOperation = 'lighter';
        const bitis = e.t > e.sure ? 0 : 1;
        if (L > 1) {
          const sx = (L + 8) / 56;
          const kal = roket ? hc * (e.r0 > 0 ? e.r0 : 0.26) : hc * 0.12;
          c.globalAlpha = 0.95;
          s.tTahta.sprite(c, sp.cizgi[e.renk], px, py, Math.atan2(py - ty, px - tx), sx, kal / 8);
          if (roket) {
            c.globalAlpha = 0.6;
            s.tTahta.sprite(c, sp.cizgi[R.BEYAZ_SICAK], px, py, Math.atan2(py - ty, px - tx), sx * 0.8, kal / 18);
          }
          s.tTahta.uygula(c);
        }
        if (bitis) {
          const r = roket ? hc * 0.42 : hc * 0.22;
          c.globalAlpha = 1;
          c.drawImage(sp.nokta[e.renk].t, px - r, py - r, r * 2, r * 2);
          c.drawImage(sp.nokta[R.BEYAZ].t, px - r * 0.45, py - r * 0.45, r * 0.9, r * 0.9);
        }
        break;
      }
      case E.ISIN: {
        // Yıldız topu ışını: kaynaktan hedefe parlak çizgi, 220 ms söner.
        const L = Math.hypot(e.x1 - e.x, e.y1 - e.y);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k;
        s.tTahta.sprite(c, sp.cizgi[e.renk], e.x1, e.y1, Math.atan2(e.y1 - e.y, e.x1 - e.x), (L + 8) / 56, (hc * 0.16) / 8);
        s.tTahta.sprite(c, sp.cizgi[R.BEYAZ], e.x1, e.y1, Math.atan2(e.y1 - e.y, e.x1 - e.x), (L + 8) / 56, (hc * 0.06) / 8);
        s.tTahta.uygula(c);
        const r = hc * 0.4 * (1 - k * 0.5);
        c.drawImage(sp.nokta[e.renk].t, e.x1 - r, e.y1 - r, 2 * r, 2 * r);
        break;
      }
      case E.KIVILCIM:
      case E.FENER: {
        const kk = Math.min(1, e.t / e.sure);
        this.bezierNokta(e, kk);
        const px = this.nokta.x;
        const py = this.nokta.y;
        if (e.tur === E.FENER) {
          const o = 1 - 0.55 * kk;
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = 0.8;
          const g = s.engel.fenerParilti;
          c.drawImage(g.t, px - g.ox * o, py - g.oy * o, g.w * o, g.h * o);
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          const f = s.engel.fener;
          s.tEkran.sprite(c, f, px, py - hc * 0.42 * o, Math.sin(e.t * 0.02) * 0.2, o, o);
          s.tEkran.uygula(c);
        } else {
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = 1;
          const r = 7 + 3 * Math.sin(e.t * 0.05);
          c.drawImage(sp.nokta[e.renk].t, px - r * 1.6, py - r * 1.6, r * 3.2, r * 3.2);
          c.drawImage(sp.nokta[R.BEYAZ].t, px - r * 0.6, py - r * 0.6, r * 1.2, r * 1.2);
        }
        break;
      }
      case E.YUKLU: {
        // Taş 0,3 hücre havalanır, fitili 120 ms gecikmeyle izler, dönerek parlar.
        if (this.alevBasi(120, this.nokta)) {
          e.x += (this.nokta.x - e.x) * 0.35;
          e.y += (this.nokta.y - hc * 0.3 - e.y) * 0.35;
        }
        const ic = e.icerik;
        if (!ic || ic.tur !== 'kapsul') return;
        const yx = e.x;
        const yy = e.y;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.6 + 0.3 * Math.sin(e.t * 0.02);
        const hale = s.kapsul.ozelHale;
        c.drawImage(hale.t, yx - hale.ox * 1.2, yy - hale.oy * 1.2, hale.w * 1.2, hale.h * 1.2);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
        const aci = e.t * 0.012;
        const govde = ic.renk < 0 ? s.kapsul.inciTaban : s.kapsul.govde[ic.renk];
        s.tTahta.sprite(c, govde, yx, yy, aci * 0.3, 0.92, 0.92);
        ozelUstCiz(c, s, ic, yx, yy, aci, 0.92);
        s.tTahta.uygula(c);
        break;
      }
      case E.HALKA_TURU: {
        // Halka boyunca ışık turu (250 ms).
        const ip = e.ip;
        if (!ip || ip.n < 2) return;
        const sb = ip.uzunluk * outCubic(k);
        ip.noktaAl(sb, this.nokta);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k * 0.3;
        const r = hc * 0.45;
        c.drawImage(sp.nokta[R.ALTIN].t, this.nokta.x - r, this.nokta.y - r, 2 * r, 2 * r);
        c.globalAlpha = 0.55 * (1 - k);
        ip.cizInce(c, Math.max(0, sb - ip.uzunluk * 0.35), sb, 4, '#FFE7B0', false);
        break;
      }
      case E.FINAL_HALKA: {
        // Büyük final: S2'den Chebyshev halkası flaşı.
        const d = e.r1;
        const r = (d + 0.5) * hc;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.9 * (1 - k);
        c.strokeStyle = s.renkler[e.renk];
        c.lineWidth = hc * 0.3 * (1 - k * 0.7);
        yuvarlakKare(c, e.x, e.y, r, hc * 0.2);
        c.stroke();
        c.globalAlpha = 0.6 * (1 - k);
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 2;
        c.stroke();
        break;
      }
      case E.FLAS:
      case E.HUCRE_ISIK: {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (e.tur === E.FLAS ? 1 : 0.7) * (1 - outCubic(k));
        const r = e.r1 * (0.6 + 0.4 * outCubic(k));
        const n = sp.nokta[e.renk];
        c.drawImage(n.t, e.x - r, e.y - r, 2 * r, 2 * r);
        break;
      }
      case E.DUMAN: {
        // İs temizlendi: bulut 300 ms'de genişleyip solar.
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1 - k;
        const is = s.engel.is;
        const o = 1 + 0.5 * outCubic(k);
        c.drawImage(is.t, e.x - is.ox * o, e.y - is.oy * o - k * hc * 0.2, is.w * o, is.h * o);
        break;
      }
      case E.KIBRIT: {
        // Kibrit: alev parlaması ve sönüşü.
        c.globalCompositeOperation = 'lighter';
        const a = tepe(Math.min(1, k * 1.3));
        c.globalAlpha = a;
        const al = sp.alev;
        const o = 1.2 + a * 0.8;
        c.drawImage(al.t, e.x - al.ox * o, e.y - al.oy * o, al.w * o, al.h * o);
        const r = hc * 0.7 * a;
        c.drawImage(sp.nokta[R.KOZ].t, e.x - r, e.y - r, 2 * r, 2 * r);
        break;
      }
      case E.KALIP: {
        // Fişek kalıbı: pirinç halka hücreye oturur.
        const r = hc * (1.2 - 0.7 * outCubic(k));
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = Math.min(1, (1 - k) * 2);
        c.strokeStyle = '#D9A441';
        c.lineWidth = hc * 0.08;
        c.beginPath();
        c.arc(e.x, e.y, r, 0, Math.PI * 2);
        c.stroke();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = '#FFF0C0';
        c.lineWidth = 1.5;
        c.stroke();
        break;
      }
      case E.HAVA: {
        // Meltem / Çisenti tetiklendi: hat boyunca parlayan şerit (dx,dy: hat yönü).
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.35 * tepe(k);
        c.fillStyle = s.renkler[e.renk];
        c.fillRect(e.x, e.y, e.x1, e.y1);
        break;
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}

/** Merkezli yarı kenar `r` olan yuvarlak kare yolu. */
export function yuvarlakKare(c: Ctx, x: number, y: number, r: number, yr: number): void {
  const rr = Math.max(0, Math.min(yr, r));
  c.beginPath();
  c.moveTo(x - r + rr, y - r);
  c.lineTo(x + r - rr, y - r);
  c.arcTo(x + r, y - r, x + r, y - r + rr, rr);
  c.lineTo(x + r, y + r - rr);
  c.arcTo(x + r, y + r, x + r - rr, y + r, rr);
  c.lineTo(x - r + rr, y + r);
  c.arcTo(x - r, y + r, x - r, y + r - rr, rr);
  c.lineTo(x - r, y - r + rr);
  c.arcTo(x - r, y - r, x - r + rr, y - r, rr);
  c.closePath();
}

/** Özel taş üst katmanı (roket oku, kasımpatı deseni, yıldız topu gökkuşağı + üst cam). */
export function ozelUstCiz(c: Ctx, s: Sahne, ic: Icerik, x: number, y: number, zaman: number, olcek: number): void {
  if (ic.tur !== 'kapsul') return;
  const k = s.kapsul;
  if (ic.ozel === 'roket') {
    const aci = ic.eksen === 0 ? 0 : ic.eksen === 1 ? Math.PI / 2 : ic.eksen === 2 ? -Math.PI / 4 : Math.PI / 4;
    s.tTahta.sprite(c, k.roketOku, x, y, aci, olcek, olcek);
  } else if (ic.ozel === 'kasimpati') {
    s.tTahta.sprite(c, k.kasimpati, x, y, zaman * Math.PI * 2 * 0.4, olcek, olcek);
  } else if (ic.ozel === 'yildiz') {
    c.globalAlpha = 0.62;
    s.tTahta.sprite(c, k.inciGokkusagi, x, y, zaman * Math.PI * 2 * 0.2, olcek, olcek);
    c.globalAlpha = 1;
    s.tTahta.sprite(c, k.inciUst, x, y, 0, olcek, olcek);
  }
}

