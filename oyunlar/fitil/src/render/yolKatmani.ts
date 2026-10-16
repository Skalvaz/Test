/**
 * Çizim katmanı (GDD §12.2 ilk satırlar, §13.3, §3.9):
 *  - örgülü ip fitil: kalınlık 4 + 0,6·n px (en fazla 12), 7+ düğümde
 *    beyaz-sıcağa karışır, halkada gül-altın; düğüm eklenince fitil ucu
 *    merkeze yaylı yapışır, düğüm ölçeği 1→1,25→1,1 (yay k400 c18);
 *  - vinyet alfası min(0,35; 0,025·n); parmak ucunda köz (30/sn);
 *  - önizleme: eşik hücreleri ±1,5 px titreşim + turuncu parıltı, hayalet
 *    yuvalar, özel taş hayaleti (120 ms belirir; roket oku 80 ms'de döner),
 *    etki alanları kesik çizgiyle, kombo adı;
 *  - vurgu (zorunlu / ipucu / seçim), öğretici el, "bu çizgi kazandırırdı"
 *    hayalet fitili.
 */
import type { Konum, Onizleme, OzelTur, Eksen, KomboTuru } from '../core/types';
import { E, ozelUstCiz } from './efektler';
import type { Efektler } from './efektler';
import { IpCizici, type IpRenkleri } from './ip';
import { inOutCubic, outCubic, rgba, yayAdim, type YayDurumu } from './matematik';
import { B, T } from './parcacik';
import { INCI, P, R } from './palet';
import type { Sahne } from './sahne';
import type { TahtaCizimi } from './tahtaCizimi';
import { YAZI_FONT } from './yazi';
import type { Ctx } from './tuval';
import { fitilRenkleri } from './fitilGorunumu';

const DUGUM_ITKI = 7; // tepe ≈ 1,25 (k400 c18, hedef 1,1)

export const KOMBO_ADLARI: Record<KomboTuru, string> = {
  yildizHatti: 'YILDIZ HATTI',
  kalinRoket: 'KALIN ROKET',
  devKasimpati: 'DEV KASIMPATI',
  roketYagmuru: 'ROKET YAĞMURU',
  bahce: 'BAHÇE',
  buyukFinal: 'BÜYÜK FİNAL',
};

const eksenAcisi = (e: Eksen): number => (e === 0 ? 0 : e === 1 ? Math.PI / 2 : e === 2 ? -Math.PI / 4 : Math.PI / 4);

export class YolKatmani {
  yol: Konum[] = [];
  halka = false;
  renk = -1;
  onizleme: Onizleme | null = null;
  private ip = new IpCizici();
  private sarkan = new IpCizici();
  private xs = new Float32Array(260);
  private ys = new Float32Array(260);
  private uc: YayDurumu = { x: 1, v: 0 };
  private ucBasX = 0;
  private ucBasY = 0;
  parmak: { x: number; y: number } | null = null;
  private parmakBirikim = 0;
  vinyet = 0;
  private faz = 0;
  private renkler: IpRenkleri = { ana: '#FFFFFF', acik: '#FFFFFF', koyu: '#000000', parilti: '#FFFFFF' };
  // Özel hayalet
  private hayalet: { hucre: Konum; ozel: OzelTur; eksen: Eksen } | null = null;
  private hayaletAlfa = 0;
  private hayaletAci = 0;
  private hayaletHedefAci = 0;
  private komboAd = '';
  private komboFont = '';
  private komboAlfa = 0;
  // Vurgular
  zorunlu: Konum[] | null = null;
  ipucu: Konum[] | null = null;
  secim: Konum[] | null = null;
  /** Klavye imleci (§13.7: 3 px krem odak halkası); null = gizli. */
  imlec: Konum | null = null;
  private ipucuT = 0;
  private sonIpucu: Konum[] | null = null;
  // Öğretici el
  private el: Konum[] | null = null;
  private elGeri = false;
  private elT = 0;
  private elIp = new IpCizici();
  // Hayalet fitil
  private hFitil: Konum[] | null = null;
  private hHalka = false;
  private hT = 0;
  private hIp = new IpCizici();
  private nokta = { x: 0, y: 0 };

  constructor(
    private s: Sahne,
    private efekt: Efektler,
    private tahtaCizimi: TahtaCizimi,
  ) {}

  /** Yol değişti (girdi katmanı her eklemede/geri almada çağırır). */
  goster(yol: readonly Konum[], halka: boolean, renk: number, on: Onizleme | null): void {
    const s = this.s;
    const t = s.tahta;
    const eski = this.yol;
    let ortak = 0;
    while (ortak < eski.length && ortak < yol.length && eski[ortak].x === yol[ortak].x && eski[ortak].y === yol[ortak].y) ortak++;
    // Silinen düğümler: 1,1 → 1 (120 ms outCubic).
    for (let k = ortak; k < eski.length; k++) {
      const h = t.hucre(eski[k]);
      if (!h) continue;
      h.olcekHedef = 1;
      h.olcek.x = 1;
      h.olcek.v = 0;
      h.geriAl = 0;
    }
    // Eklenen düğümler: yay itkisi; fitil ucu bir önceki uçtan yaylı gelir.
    for (let k = ortak; k < yol.length; k++) {
      const h = t.hucre(yol[k]);
      if (!h) continue;
      h.olcekHedef = 1.1;
      h.olcek.v = DUGUM_ITKI;
      h.geriAl = -1;
    }
    if (yol.length > ortak && yol.length > 1) {
      if (this.parmak) {
        this.ucBasX = this.parmak.x;
        this.ucBasY = this.parmak.y;
      } else {
        const o = yol[yol.length - 2];
        this.ucBasX = s.mx(o.x);
        this.ucBasY = s.my(o.y);
      }
      this.uc.x = 0;
      this.uc.v = 0;
    }
    // Halka kapandı: ışık turu + 12 kıvılcım; fitil gül-altın parlar.
    const halkaYeni = halka && !this.halka && yol.length >= 4;
    this.yol = yol.map((p) => ({ x: p.x, y: p.y }));
    this.halka = halka;
    this.renk = renk;
    this.renkleriKur();
    this.ornekle();
    if (halkaYeni) {
      const e = this.efekt.ekle(E.HALKA_TURU, 0, 0, 250);
      if (e) {
        const ip = new IpCizici();
        ip.ornekle(this.xs, this.ys, this.yol.length, true, s.c * 0.32);
        e.ip = ip;
      }
      const n = s.havuz.adet(12);
      for (let k = 0; k < n; k++) {
        this.ip.noktaAl((k / n) * this.ip.uzunluk, this.nokta);
        const a = s.rnd.float() * Math.PI * 2;
        const v = 40 + s.rnd.float() * 90;
        s.havuz.ekle(T.NOKTA, this.nokta.x, this.nokta.y, Math.cos(a) * v, Math.sin(a) * v - 40, 520, 2.6, k % 2 ? R.ALTIN : 5, 2.2, 60);
      }
    }
    this.onizlemeKur(on);
  }

  private renkleriKur(): void {
    const s = this.s;
    const k = this.renk >= 0 && this.renk < 6 ? s.kapsulRenk[this.renk] : INCI;
    fitilRenkleri(s.secenek.fitil, k, this.yol.length, this.halka, this.renkler);
  }

  private ornekle(): void {
    const s = this.s;
    const n = Math.min(this.yol.length, 256);
    for (let k = 0; k < n; k++) {
      this.xs[k] = s.mx(this.yol[k].x);
      this.ys[k] = s.my(this.yol[k].y);
    }
    // Uç yayı: son düğüm henüz merkeze yapışmadı.
    if (n > 1 && this.uc.x < 1) {
      const u = Math.max(0, this.uc.x);
      this.xs[n - 1] = this.ucBasX + (this.xs[n - 1] - this.ucBasX) * u;
      this.ys[n - 1] = this.ucBasY + (this.ys[n - 1] - this.ucBasY) * u;
    }
    this.ip.ornekle(this.xs, this.ys, n, this.halka, s.c * 0.32);
  }

  private onizlemeKur(on: Onizleme | null): void {
    const s = this.s;
    const t = s.tahta;
    s.titresim.fill(0);
    this.tahtaCizimi.onizlemeIsi.fill(0);
    this.onizleme = on;
    if (!on || this.yol.length === 0) {
      this.hayalet = null;
      this.komboAd = '';
      return;
    }
    for (const p of on.esikHucreler) if (s.icinde(p)) s.titresim[p.y * t.w + p.x] = 1;
    for (const p of on.isinacaklar) if (s.icinde(p.hucre)) this.tahtaCizimi.onizlemeIsi[p.hucre.y * t.w + p.hucre.x] = p.artis;
    const g = on.ozelHayalet;
    const eski = this.hayalet;
    if (g) {
      const yeniTur = !eski || eski.ozel !== g.ozel;
      if (yeniTur) {
        // Özel eşiği geçildi: hayalet 120 ms'de belirir, 6 altın kıvılcım.
        this.hayaletAlfa = eski ? this.hayaletAlfa : 0;
        const x = s.mx(g.hucre.x);
        const y = s.my(g.hucre.y);
        const n = s.havuz.adet(6);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + s.rnd.float() * 0.4;
          const v = 90 + s.rnd.float() * 70;
          const i = s.havuz.ekle(T.CIZGI, x, y, Math.cos(a) * v, Math.sin(a) * v, 420, 2.2, R.ALTIN, 3, 80);
          if (i >= 0) s.havuz.iz[i] = 0.05;
        }
        if (!eski) this.hayaletAci = eksenAcisi(g.eksen);
      }
      this.hayaletHedefAci = eksenAcisi(g.eksen);
      this.hayalet = { hucre: { ...g.hucre }, ozel: g.ozel, eksen: g.eksen };
    } else {
      this.hayalet = null;
      this.hayaletAlfa = 0;
    }
    const ad = on.kombo ? KOMBO_ADLARI[on.kombo] : '';
    if (ad !== this.komboAd) this.komboAlfa = 0;
    this.komboFont = `800 ${Math.round(Math.max(13, s.c * 0.3))}px ${YAZI_FONT}`;
    this.komboAd = ad;
  }

  parmakAyarla(p: { x: number; y: number } | null): void {
    this.parmak = p ? { x: p.x, y: p.y } : null;
  }

  guncelle(dt: number): void {
    const s = this.s;
    const sn = dt / 1000;
    this.faz += dt * 0.012;
    if (this.uc.x < 1 || Math.abs(this.uc.v) > 1e-3) {
      yayAdim(this.uc, 1, 400, 18, sn);
      if (this.uc.x > 1.2) this.uc.x = 1.2;
      this.ornekle();
    }
    const hedefV = this.yol.length >= 2 ? Math.min(0.35, 0.025 * this.yol.length) : 0;
    this.vinyet += (hedefV - this.vinyet) * Math.min(1, sn * 8);
    if (this.hayalet) this.hayaletAlfa = Math.min(1, this.hayaletAlfa + dt / 120);
    // Roket oku 80 ms'de döner (en kısa yoldan).
    let fark = this.hayaletHedefAci - this.hayaletAci;
    while (fark > Math.PI / 2) fark -= Math.PI;
    while (fark < -Math.PI / 2) fark += Math.PI;
    this.hayaletAci += fark * Math.min(1, dt / 80);
    if (this.komboAd) this.komboAlfa = Math.min(1, this.komboAlfa + dt / 150);
    // Parmak ucunda köz (30/sn).
    if (this.parmak && this.yol.length > 0) {
      this.parmakBirikim += sn * 30;
      while (this.parmakBirikim >= 1) {
        this.parmakBirikim -= 1;
        const a = -Math.PI / 2 + (s.rnd.float() - 0.5) * 2.2;
        const v = 30 + s.rnd.float() * 70;
        const i = s.havuz.ekle(T.KOZ, this.parmak.x + (s.rnd.float() - 0.5) * 6, this.parmak.y + (s.rnd.float() - 0.5) * 6, Math.cos(a) * v, Math.sin(a) * v, 380 + s.rnd.float() * 300, 1.8 + s.rnd.float() * 1.4, this.yol.length >= 7 ? R.BEYAZ_SICAK : R.KOZ, 2.5, -60);
        if (i >= 0) s.havuz.bayrak[i] |= B.UST;
      }
    }
    // Yeni ipucu dalgası baştan (yoldan önce) başlar: ortadan birden belirmesin.
    if (this.ipucu !== this.sonIpucu) {
      this.sonIpucu = this.ipucu;
      this.ipucuT = 0;
    }
    this.ipucuT += dt;
    if (this.el) this.elT += dt;
    if (this.hFitil) this.hT += dt;
  }

  /** Fitil + önizleme (tahta uzayı, içeriklerin üstünde). */
  ciz(c: Ctx): void {
    const s = this.s;
    const n = this.yol.length;
    if (n > 0) {
      const kalin = Math.min(12, 4 + 0.6 * n);
      // Etki alanları: kesik çizgi (yürüyen).
      if (this.onizleme) this.etkiAlanlari(c);
      // Sarkan uç: son düğümden parmağa.
      if (this.parmak && !this.halka && n >= 1 && this.uc.x >= 0.98) {
        const xs = this.xs;
        const ys = this.ys;
        const lx = xs[n - 1];
        const ly = ys[n - 1];
        const d = Math.hypot(this.parmak.x - lx, this.parmak.y - ly);
        if (d > s.c * 0.3) {
          TMP_X[0] = lx;
          TMP_Y[0] = ly;
          TMP_X[1] = this.parmak.x;
          TMP_Y[1] = this.parmak.y;
          this.sarkan.ornekle(TMP_X, TMP_Y, 2, false, 0, 3);
          c.globalAlpha = 0.75;
          this.sarkan.ciz(c, 0, this.sarkan.uzunluk, kalin * 0.7, this.renkler, -this.faz, 0.7 * s.pariltiA);
          c.globalAlpha = 1;
        }
      }
      // Düğüm haleleri: seçili kapsüllerin altında zincir renginde nabız.
      c.globalCompositeOperation = 'lighter';
      const hr = s.parilti.nokta[n >= 7 ? R.BEYAZ_SICAK : this.renk >= 0 ? this.renk : R.BEYAZ];
      for (let k = 0; k < n; k++) {
        const r = s.c * (0.62 + 0.04 * Math.sin(this.faz * 0.7 - k * 0.8));
        c.globalAlpha = 0.32;
        c.drawImage(hr.t, this.xs[k] - r, this.ys[k] - r, 2 * r, 2 * r);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      if (n >= 2) this.ip.ciz(c, 0, this.ip.uzunluk, kalin, this.renkler, -this.faz * 0.5, s.pariltiA);
      // Düğüm başlarında küçük düğümler (ipin kapsüle değdiği yer) + ipte kayan pırıltılar.
      c.globalCompositeOperation = 'lighter';
      const nk = s.parilti.nokta[n >= 7 ? R.BEYAZ_SICAK : this.renk >= 0 ? this.renk : R.BEYAZ];
      for (let k = 0; k < n; k++) {
        const r = kalin * 0.9;
        c.globalAlpha = 0.7;
        c.drawImage(nk.t, this.xs[k] - r, this.ys[k] - r, 2 * r, 2 * r);
      }
      if (n >= 2 && this.ip.uzunluk > 1) {
        const g = s.parilti.nokta[R.BEYAZ_SICAK];
        const L = this.ip.uzunluk;
        const adet = Math.min(6, 1 + Math.floor(L / (s.c * 1.6)));
        for (let k = 0; k < adet; k++) {
          const sb = (((s.zaman * 0.12 + (k * L) / adet) % L) + L) % L;
          this.ip.noktaAl(sb, this.nokta);
          const r = kalin * (0.9 + 0.3 * Math.sin(s.zaman * 0.02 + k));
          c.globalAlpha = 0.85;
          c.drawImage(g.t, this.nokta.x - r, this.nokta.y - r, 2 * r, 2 * r);
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      // Yoldaki özel taşların simgesi ipin üstünde kalsın (roket oku, kasımpatı).
      for (let k = 0; k < n; k++) {
        const ic = s.tahta.hucre(this.yol[k])?.icerik;
        if (ic?.tur === 'kapsul' && ic.ozel !== 'yok' && ic.ozel !== 'yildiz') ozelUstCiz(c, s, ic, s.mx(this.yol[k].x), s.my(this.yol[k].y), s.zaman / 1000, 1.08);
      }
      s.tTahta.uygula(c);
      // Parmak ucu: sıcak ışık.
      if (this.parmak) {
        c.globalCompositeOperation = 'lighter';
        const g = s.parilti.nokta[R.KOZ];
        const r = s.c * (0.42 + 0.04 * Math.sin(s.zaman * 0.03));
        c.globalAlpha = 0.75;
        c.drawImage(g.t, this.parmak.x - r, this.parmak.y - r, 2 * r, 2 * r);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
      if (this.onizleme) this.onizlemeCiz(c);
    }
    this.hayaletFitilCiz(c);
  }

  private etkiAlanlari(c: Ctx): void {
    const s = this.s;
    const on = this.onizleme!;
    if (!on.etkiAlanlari.length) return;
    const hc = s.c;
    c.setLineDash(KESIK_ETKI);
    c.lineDashOffset = -this.faz * 2;
    c.lineWidth = 2;
    c.strokeStyle = rgba(P.beyazSicak, 0.92);
    for (const a of on.etkiAlanlari) {
      for (const h of a.hucreler) {
        const x = s.mx(h.x);
        const y = s.my(h.y);
        c.beginPath();
        c.rect(x - hc * 0.42, y - hc * 0.42, hc * 0.84, hc * 0.84);
        c.stroke();
      }
    }
    c.setLineDash(BOS);
    c.lineDashOffset = 0;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = P.koz;
    c.globalAlpha = 0.1 + 0.06 * Math.sin(this.faz);
    for (const a of on.etkiAlanlari) for (const h of a.hucreler) c.fillRect(s.mx(h.x) - hc * 0.42, s.my(h.y) - hc * 0.42, hc * 0.84, hc * 0.84);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  private onizlemeCiz(c: Ctx): void {
    const s = this.s;
    const on = this.onizleme!;
    const hc = s.c;
    // Eşik hücreleri: turuncu parıltı (titreşim tahta çiziminde).
    c.globalCompositeOperation = 'lighter';
    const g = s.parilti.nokta[R.KOZ];
    for (const p of on.esikHucreler) {
      const x = s.mx(p.x);
      const y = s.my(p.y);
      const r = hc * (0.62 + 0.06 * Math.sin(this.faz * 1.6 + p.x));
      c.globalAlpha = 0.55 + 0.25 * Math.sin(this.faz * 1.3 + p.y);
      c.drawImage(g.t, x - r, y - r, 2 * r, 2 * r);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    // Özel hayaleti.
    const h = this.hayalet;
    if (h && this.hayaletAlfa > 0) {
      const x = s.mx(h.hucre.x);
      const y = s.my(h.hucre.y) - hc * 0.04;
      const renk = this.renk >= 0 ? this.renk : 0;
      c.globalAlpha = this.hayaletAlfa * (0.75 + 0.2 * Math.sin(this.faz * 1.4));
      if (h.ozel === 'yildiz') {
        s.tTahta.sprite(c, s.kapsul.inciTaban, x, y, 0, 1.08, 1.08);
        ozelUstCiz(c, s, { tur: 'kapsul', renk: -1, isi: 0, ozel: 'yildiz', eksen: 0 }, x, y, s.zaman / 1000, 1.08);
      } else {
        s.tTahta.sprite(c, s.kapsul.hayalet[renk], x, y, 0, 1.12, 1.12);
        if (h.ozel === 'roket') s.tTahta.sprite(c, s.kapsul.roketOku, x, y, this.hayaletAci, 1.15, 1.15);
        else if (h.ozel === 'kasimpati') s.tTahta.sprite(c, s.kapsul.kasimpati, x, y, (s.zaman / 1000) * Math.PI * 2 * 0.4, 1.1, 1.1);
      }
      s.tTahta.uygula(c);
      c.globalAlpha = 1;
    }
    // Kombo adı: son düğümün üstünde hap etiket.
    if (this.komboAd && this.yol.length) {
      const son = this.yol[this.yol.length - 1];
      const x = s.mx(son.x);
      const y = s.my(son.y) - hc * 0.95;
      c.globalAlpha = this.komboAlfa;
      c.font = this.komboFont;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const w = c.measureText(this.komboAd).width + 18;
      const hh = Math.max(20, hc * 0.46);
      const bx = Math.max(s.gx + w / 2 - 6, Math.min(s.gx + s.tahta.w * hc - w / 2 + 6, x));
      c.fillStyle = 'rgba(36,16,8,0.88)';
      c.beginPath();
      c.roundRect(bx - w / 2, y - hh / 2, w, hh, hh / 2);
      c.fill();
      c.strokeStyle = P.pirincAcik;
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = '#FFE9A8';
      c.fillText(this.komboAd, bx, y + 1);
      c.globalAlpha = 1;
    }
  }

  private maske = new Uint8Array(0);
  private maskeKaynak: Konum[] | null = null;

  /** Zorunlu hücre maskesi (vurgu değişince bir kez kurulur). */
  private zorunluMaske(w: number, h: number): Uint8Array {
    if (this.maskeKaynak !== this.zorunlu || this.maske.length !== w * h) {
      this.maske = new Uint8Array(w * h);
      for (const p of this.zorunlu ?? []) if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) this.maske[p.y * w + p.x] = 1;
      this.maskeKaynak = this.zorunlu;
    }
    return this.maske;
  }

  /** Vurgular (içeriklerin üstünde, fitilin altında). */
  cizVurgu(c: Ctx): void {
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    if (this.zorunlu) {
      // Diğer hücreler kararır; zorunlu hücreler sıcak nabızla parlar.
      const izin = this.zorunluMaske(t.w, t.h);
      c.fillStyle = 'rgba(6,4,14,0.6)';
      for (let i = 0; i < t.hucreler.length; i++) {
        if (t.hucreler[i].delik || izin[i]) continue;
        const x = s.mx(i % t.w);
        const y = s.my((i / t.w) | 0);
        c.beginPath();
        c.roundRect(x - hc / 2 + 1, y - hc / 2 + 1, hc - 2, hc - 2, hc * 0.16);
        c.fill();
      }
      c.globalCompositeOperation = 'lighter';
      const g = s.parilti.nokta[R.ALTIN];
      for (const p of this.zorunlu) {
        const r = hc * (0.6 + 0.05 * Math.sin(this.faz * 0.9));
        c.globalAlpha = 0.3 + 0.15 * Math.sin(this.faz * 0.9 + p.x * 0.6);
        c.drawImage(g.t, s.mx(p.x) - r, s.my(p.y) - r, 2 * r, 2 * r);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    if (this.ipucu && this.ipucu.length) {
      // Parıltı dalgası: 2200 ms'de bir geçiş, sırayla hücre hücre. İlk üç geçiş art
      // arda, sonra her geçişten sonra bir geçiş boyu ara; giriş 300 ms'de solar.
      // (Eski 1200 ms'lik bitmeyen beyaz dalga boşta, büyük ekranda yanıp sönme gibiydi.)
      const n = this.ipucu.length;
      const P = 2200;
      const t = this.ipucuT;
      const k = t < 3 * P ? (t % P) / P : ((t - 3 * P) % (2 * P)) / P;
      const giris = Math.min(1, t / 300);
      c.globalCompositeOperation = 'lighter';
      const g = s.parilti.nokta[R.BEYAZ_SICAK];
      for (let j = 0; j < n && k < 1; j++) {
        const p = this.ipucu[j];
        const merkez = k * (n + 2) - 1;
        const d = Math.abs(j - merkez);
        const a = Math.max(0, 1 - d / 1.6);
        if (a <= 0) continue;
        const r = hc * (0.5 + 0.25 * a);
        c.globalAlpha = 0.55 * a * giris;
        c.drawImage(g.t, s.mx(p.x) - r, s.my(p.y) - r, 2 * r, 2 * r);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    if (this.secim) {
      // Seçim (körük/kibrit/kalıp hedefi): sıcak dolgu + koyu/krem çift kontur, nabızlı.
      const a = 0.6 + 0.35 * Math.sin(this.faz * 0.8);
      const r = hc * 0.46;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = P.pirinc;
      c.globalAlpha = 0.16 * a;
      for (const p of this.secim) c.fillRect(s.mx(p.x) - r, s.my(p.y) - r, 2 * r, 2 * r);
      c.globalCompositeOperation = 'source-over';
      c.beginPath();
      for (const p of this.secim) c.roundRect(s.mx(p.x) - r, s.my(p.y) - r, 2 * r, 2 * r, hc * 0.18);
      c.globalAlpha = 0.7;
      c.lineWidth = 5;
      c.strokeStyle = '#1A0C04';
      c.stroke();
      c.globalAlpha = a;
      c.lineWidth = 2.6;
      c.strokeStyle = P.krem;
      c.stroke();
      c.globalAlpha = 1;
    }
    if (this.imlec && this.imlec.x >= 0 && this.imlec.y >= 0 && this.imlec.x < t.w && this.imlec.y < t.h) {
      // Klavye imleci: koyu alt kontur + 3 px krem halka (§13.7), hafif nabız.
      const p = this.imlec;
      const r = hc * (0.47 + 0.015 * Math.sin(this.faz * 1.2));
      c.beginPath();
      c.roundRect(s.mx(p.x) - r, s.my(p.y) - r, 2 * r, 2 * r, hc * 0.2);
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(20,10,4,0.75)';
      c.stroke();
      c.lineWidth = 3;
      c.strokeStyle = P.krem;
      c.stroke();
    }
  }

  /** Vinyet (ekran uzayı). */
  cizVinyet(c: Ctx): void {
    if (this.vinyet < 0.005) return;
    const s = this.s;
    c.globalAlpha = this.vinyet;
    const v = s.parilti.vinyet;
    const pay = Math.max(s.ekranW, s.ekranH) * 0.12;
    c.drawImage(v.t, -pay, -pay, s.ekranW + 2 * pay, s.ekranH + 2 * pay);
    c.globalAlpha = 1;
  }

  /** `geriAl`: el sona varınca bir düğüm geri döner (geri almayı gösterir, §15 Bölüm 1 adım 5). */
  elAyarla(yol: readonly Konum[] | null, geriAl = false): void {
    this.el = yol && yol.length ? yol.map((p) => ({ ...p })) : null;
    this.elGeri = geriAl && !!this.el && this.el.length >= 3;
    this.elT = 0;
  }

  hayaletAyarla(yol: readonly Konum[] | null, halka: boolean): void {
    this.hFitil = yol && yol.length ? yol.map((p) => ({ ...p })) : null;
    this.hHalka = halka;
    this.hT = 0;
    if (this.hFitil) {
      const s = this.s;
      const n = this.hFitil.length;
      const xs = new Float32Array(n);
      const ys = new Float32Array(n);
      this.hFitil.forEach((p, k) => {
        xs[k] = s.mx(p.x);
        ys[k] = s.my(p.y);
      });
      this.hIp.ornekle(xs, ys, n, halka, s.c * 0.32);
    }
  }

  /** Geometri değişince yolları yeniden örnekle. */
  yenidenOrnekle(): void {
    if (this.yol.length) this.ornekle();
    if (this.hFitil) this.hayaletAyarla(this.hFitil, this.hHalka);
    if (this.el) this.el = this.el.slice();
  }

  /** "Bu çizgi kazandırırdı": 2 kez çizilerek oynar, sonra yerinde kalır. */
  private hayaletFitilCiz(c: Ctx): void {
    if (!this.hFitil) return;
    const s = this.s;
    const DONGU = 1800;
    const tur = Math.floor(this.hT / DONGU);
    const k = tur >= 2 ? 1 : Math.min(1, (this.hT % DONGU) / 1200);
    const L = this.hIp.uzunluk * inOutCubic(k);
    const kalin = Math.min(12, 4 + 0.6 * this.hFitil.length);
    c.globalAlpha = 0.5 + 0.15 * Math.sin(this.faz);
    this.hIp.ciz(c, 0, L, kalin, HAYALET_RENK, -this.faz * 0.5, 1);
    c.globalAlpha = 1;
    // Uçta parlayan köz
    if (k < 1) {
      this.hIp.noktaAl(L, this.nokta);
      c.globalCompositeOperation = 'lighter';
      const g = s.parilti.nokta[R.BEYAZ_SICAK];
      const r = s.c * 0.4;
      c.drawImage(g.t, this.nokta.x - r, this.nokta.y - r, 2 * r, 2 * r);
      c.globalCompositeOperation = 'source-over';
    }
  }

  /** Öğretici saydam el (ekran üstü katman, tahta uzayında). */
  cizEl(c: Ctx): void {
    if (!this.el) return;
    const s = this.s;
    const yol = this.el;
    const n = yol.length;
    // Döngü: 450 ms belir+bas, düğüm başı 380 ms sürükle, 400 ms bekle, 450 ms kalk+sol.
    // Geri alma gösterimi: sona varınca 300 ms durur, bir düğüm geri döner (iz kısalır), sonra kalkar.
    const ADIM = 380;
    const giris = 450;
    const surukle = Math.max(1, n - 1) * ADIM;
    const geri = this.elGeri ? 300 + 520 : 0;
    const bekle = 400;
    const cikis = 450;
    const dongu = giris + surukle + geri + bekle + cikis + 300;
    let t = this.elT % dongu;
    // Geri adım sonrası el bir önceki düğümde biter: kalan aşamalar yolun bu kısaltılmış sonunu kullanır.
    let son = n - 1;
    if (this.elGeri && t >= giris + surukle) {
      const g = t - giris - surukle;
      if (g < geri) {
        const k = Math.max(0, (g - 300) / 520);
        const u = inOutCubic(Math.min(1, k));
        const px0 = s.mx(yol[n - 1].x) + (s.mx(yol[n - 2].x) - s.mx(yol[n - 1].x)) * u;
        const py0 = s.my(yol[n - 1].y) + (s.my(yol[n - 2].y) - s.my(yol[n - 1].y)) * u;
        this.elCiz(c, yol, n, px0, py0, 1, 0.88, n - u);
        return;
      }
      t -= geri;
      son = n - 2;
    }
    let px: number;
    let py: number;
    let alfa = 1;
    let bas = 1;
    let ilerleme = 0;
    if (t < giris) {
      const k = t / giris;
      alfa = outCubic(k);
      bas = 1 - 0.12 * Math.max(0, (k - 0.6) / 0.4);
      px = s.mx(yol[0].x);
      py = s.my(yol[0].y) + (1 - outCubic(k)) * s.c * 0.5;
    } else if (t < giris + surukle) {
      const k = (t - giris) / surukle;
      const f = k * (n - 1);
      const j = Math.min(n - 2, Math.floor(f));
      const u = inOutCubic(f - j);
      px = s.mx(yol[j].x) + (s.mx(yol[j + 1].x) - s.mx(yol[j].x)) * u;
      py = s.my(yol[j].y) + (s.my(yol[j + 1].y) - s.my(yol[j].y)) * u;
      bas = 0.88;
      ilerleme = f + 1;
    } else if (t < giris + surukle + bekle) {
      px = s.mx(yol[son].x);
      py = s.my(yol[son].y);
      bas = 0.88;
      ilerleme = son + 1;
    } else {
      const k = Math.min(1, (t - giris - surukle - bekle) / cikis);
      px = s.mx(yol[son].x);
      py = s.my(yol[son].y) + outCubic(k) * s.c * 0.4;
      alfa = 1 - k;
      ilerleme = son + 1;
    }
    this.elCiz(c, yol, n, px, py, alfa, bas, ilerleme);
  }

  /** El ve arkasındaki saydam iz (ilerleme: geçilen düğüm sayısı, kesirli olabilir). */
  private elCiz(c: Ctx, yol: readonly Konum[], n: number, px: number, py: number, alfa: number, bas: number, ilerleme: number): void {
    const s = this.s;
    // Elin arkasında saydam fitil izi: geçilen düğümler + elin konumu.
    if (ilerleme > 1 && n > 1) {
      const j = Math.min(n - 1, Math.floor(ilerleme - 1 + 1e-6));
      for (let k = 0; k <= j; k++) {
        TMP_X[k] = s.mx(yol[k].x);
        TMP_Y[k] = s.my(yol[k].y);
      }
      let m = j + 1;
      if (m < n && ilerleme - 1 - j > 0.001) {
        TMP_X[m] = px;
        TMP_Y[m] = py;
        m++;
      }
      this.elIp.ornekle(TMP_X, TMP_Y, m, false, s.c * 0.3);
      c.globalAlpha = 0.55 * alfa;
      this.elIp.ciz(c, 0, this.elIp.uzunluk, 8, EL_RENK, -this.faz * 0.5, 0.6);
      c.globalAlpha = 1;
    }
    c.globalAlpha = 0.85 * alfa;
    const el = s.parilti.el;
    const o = (s.c / 52) * bas;
    s.tTahta.sprite(c, el, px + 2, py + 2, -0.18, o, o);
    s.tTahta.uygula(c);
    // Basış halkası
    if (bas < 1) {
      c.globalAlpha = 0.5 * alfa;
      c.strokeStyle = P.krem;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(px, py, s.c * 0.32, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

const TMP_X = new Float32Array(260);
const TMP_Y = new Float32Array(260);
const KESIK_ETKI = [5, 4];
const BOS: number[] = [];
const HAYALET_RENK: IpRenkleri = { ana: 'rgba(255,244,214,0.75)', acik: 'rgba(255,255,255,0.9)', koyu: 'rgba(200,180,140,0.6)', parilti: '#FFF4C2' };
const EL_RENK: IpRenkleri = { ana: 'rgba(255,240,210,0.7)', acik: 'rgba(255,255,255,0.85)', koyu: 'rgba(190,150,100,0.6)', parilti: '#FFE9A8' };

