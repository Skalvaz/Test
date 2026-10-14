/**
 * Gökyüzü havai fişekleri (GDD §10.3, §12.2 "Kazandın", "Dev fişek
 * fırladı"): yükselen kovan (iz parçacıklı), patlama anında desen,
 * gökyüzünü aydınlatan yumuşak ışık ve denizde renkli yansıma.
 */
import { desenTarifi } from './fisekDesenleri';
import type { Gokyuzu } from './gokyuzu';
import { B, T } from './parcacik';
import { R } from './palet';
import type { Sahne } from './sahne';
import type { Ctx } from './tuval';

interface Kovan {
  aktif: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  sure: number;
  renk: number;
  desen: string;
  olcek: number;
  birikim: number;
}

interface GokIsigi {
  aktif: boolean;
  x: number;
  y: number;
  r: number;
  renk: number;
  t: number;
  sure: number;
}

export class FisekSistemi {
  private kovanlar: Kovan[] = [];
  private isiklar: GokIsigi[] = [];
  /** Gökte patlama dinleyicisi (uzak patlama sesi için). */
  dinle: (x: number, y: number, desen: string) => void = () => {};

  constructor(
    private s: Sahne,
    private gok: Gokyuzu,
  ) {
    for (let i = 0; i < 24; i++) this.kovanlar.push({ aktif: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, sure: 0, renk: 0, desen: '', olcek: 1, birikim: 0 });
    for (let i = 0; i < 16; i++) this.isiklar.push({ aktif: false, x: 0, y: 0, r: 0, renk: 0, t: 0, sure: 0 });
  }

  /** Ölçek: gök bandının ekrana göre büyüklüğü. */
  olcek(): number {
    const s = this.s;
    return Math.max(0.7, Math.min(1.5, Math.min(s.ekranW, 900) / 390));
  }

  /** Kovanı (x0,y0)'dan (x1,y1)'e fırlat; varınca patlar. Ekran koordinatı. */
  firlat(x0: number, y0: number, x1: number, y1: number, renk: number, desen: string, sure = 560, olcek = this.olcek()): void {
    const k = this.kovanlar.find((v) => !v.aktif);
    if (!k) {
      this.patlat(x1, y1, renk, desen, olcek);
      return;
    }
    k.aktif = true;
    k.x0 = x0;
    k.y0 = y0;
    k.x1 = x1;
    k.y1 = y1;
    k.t = 0;
    k.sure = sure;
    k.renk = renk;
    k.desen = desen;
    k.olcek = olcek;
    k.birikim = 0;
  }

  /** Hemen patlat. `renk`: kapsül rengi (0..5) ya da −1 gökkuşağı. */
  patlat(x: number, y: number, renk: number, desen: string, olcek = this.olcek()): void {
    const s = this.s;
    const tarif = desenTarifi(desen);
    const efRenk = renk >= 0 && renk <= 5 ? renk : -1;
    const ikinci = efRenk < 0 ? R.BEYAZ_SICAK : (efRenk + 2) % 6 === efRenk ? R.ALTIN : renk === 1 ? R.BEYAZ_SICAK : R.ALTIN;
    tarif.uret(s.havuz, x, y, { olcek, renk: efRenk, renk2: ikinci, rnd: () => s.rnd.float(), gok: true });
    // Patlama çekirdeği (beyaz flaş) — tarifin sayımına dahil değil.
    const i = s.havuz.ekle(T.NOKTA, x, y, 0, 0, 160, 26 * olcek, R.BEYAZ_SICAK, 0, 0);
    if (i >= 0) s.havuz.bayrak[i] = B.GOK | B.SABIT_BOY;
    const isik = this.isiklar.find((v) => !v.aktif) ?? this.isiklar[0];
    isik.aktif = true;
    isik.x = x;
    isik.y = y;
    isik.r = 150 * olcek;
    isik.renk = efRenk < 0 ? R.BEYAZ : efRenk;
    isik.t = 0;
    isik.sure = 900;
    this.gok.yansit(x, efRenk < 0 ? '#FFFFFF' : s.renkler[efRenk]);
    this.dinle(x, y, tarif.id);
  }

  guncelle(dt: number): void {
    const s = this.s;
    for (const k of this.kovanlar) {
      if (!k.aktif) continue;
      k.t += dt;
      const u = Math.min(1, k.t / k.sure);
      // Yavaşlayarak yükselir (outQuad), hafif yay.
      const e = 1 - (1 - u) * (1 - u);
      const x = k.x0 + (k.x1 - k.x0) * e + Math.sin(u * Math.PI) * 6;
      const y = k.y0 + (k.y1 - k.y0) * e;
      k.birikim += (dt / 1000) * 70;
      while (k.birikim >= 1) {
        k.birikim -= 1;
        const i = s.havuz.ekle(T.NOKTA, x + (s.rnd.float() - 0.5) * 2, y, (s.rnd.float() - 0.5) * 18, 20 + s.rnd.float() * 30, 420 + s.rnd.float() * 220, 1.8, s.rnd.float() < 0.5 ? R.ALTIN : R.KOZ, 2, 60);
        if (i >= 0) s.havuz.bayrak[i] = B.GOK | B.PIRILTI;
      }
      if (u >= 1) {
        k.aktif = false;
        this.patlat(k.x1, k.y1, k.renk, k.desen, k.olcek);
      }
    }
    for (const g of this.isiklar) {
      if (!g.aktif) continue;
      g.t += dt;
      if (g.t >= g.sure) g.aktif = false;
    }
  }

  /** Gök ışıkları: patlamanın gökyüzünü aydınlatması (kasabanın arkasında). */
  cizIsik(c: Ctx): void {
    const s = this.s;
    c.globalCompositeOperation = 'lighter';
    const isikSp = s.parilti.nokta;
    for (const g of this.isiklar) {
      if (!g.aktif) continue;
      const k = g.t / g.sure;
      const a = (1 - k) * (1 - k) * 0.42;
      c.globalAlpha = a;
      const r = g.r * (0.7 + 0.3 * k);
      c.drawImage(isikSp[g.renk].t, g.x - r, g.y - r, 2 * r, 2 * r);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  /** Yükselen kovan başları (kasabanın önünde). */
  cizKovan(c: Ctx): void {
    const s = this.s;
    c.globalCompositeOperation = 'lighter';
    const isikSp = s.parilti.nokta;
    for (const k of this.kovanlar) {
      if (!k.aktif) continue;
      const u = Math.min(1, k.t / k.sure);
      const e = 1 - (1 - u) * (1 - u);
      const x = k.x0 + (k.x1 - k.x0) * e + Math.sin(u * Math.PI) * 6;
      const y = k.y0 + (k.y1 - k.y0) * e;
      const r = 5;
      c.drawImage(isikSp[R.BEYAZ_SICAK].t, x - r * 2, y - r * 2, r * 4, r * 4);
    }
    c.globalCompositeOperation = 'source-over';
  }

  aktifMi(): boolean {
    return this.kovanlar.some((k) => k.aktif);
  }

  temizle(): void {
    for (const k of this.kovanlar) k.aktif = false;
    for (const g of this.isiklar) g.aktif = false;
  }
}
