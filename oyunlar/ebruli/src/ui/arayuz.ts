/**
 * EBRULİ arayüzü (DOM) — uygulamanın kullandığı tek giriş noktası.
 *
 *   const ui = new Arayuz(kok, { ses: (t) => ses.arayuz(t) });
 *   await ui.acilis(() => ses.ac());
 *   const id = await ui.harita(vm, geri);          // "Başla" ile çözülür
 *   ui.hudKur(hudVm); ui.yerlesim(...)             // oyun
 *   await ui.kazandin(vm, ek) / ui.kaybettin(...)
 *
 * DOM katmanı tuvalin üstündedir; kök işaretçi olaylarını geçirir, yalnız
 * düğmeler, kartlar ve açık ekranlar dokunulabilir. Metinler `textContent`.
 */
import './stil/arayuz.css';
import { h, svg } from './dom';
import { IKON } from './ikonlar';
import { EkranYoneticisi } from './ekranlar/cekirdek';
import { dugmeSesiAyarla } from './ekranlar/ortak';
import { Hud, type HudGeri } from './hud';
import { acilisEkrani } from './ekranlar/acilis';
import { haritaEkrani, type HaritaGeri } from './ekranlar/harita';
import { bolumOncesiEkrani, duraklatEkrani } from './ekranlar/kartlar';
import { kaybettinEkrani, kazandinEkrani, type KaybettinKontrol, type SonEk } from './ekranlar/oyunSonu';
import { devamiEkrani, galeriEkrani } from './ekranlar/galeri';
import { ayarlarEkrani, type AyarlarGeri } from './ekranlar/ayarlar';
import { nasilEkrani, type NasilVM } from './ekranlar/nasil';
import { SIFIR_KENAR, type Kenarlar, type Yerlesim } from './yerlesim';
import type { ArayuzSesi, TahtaGeometrisi } from '../app/sozlesme';
import type { AyarlarVM, BolumOncesiVM, DevamiVM, DuraklatSecimi, GaleriVM, HaritaVM, HudVM, KaybettinSecimi, KaybettinVM, KazandinSecimi, KazandinVM } from './tipler';

export * from './tipler';
export type { Yerlesim, Kenarlar } from './yerlesim';
export type { NasilVM } from './ekranlar/nasil';
export type { KaybettinKontrol, SonEk } from './ekranlar/oyunSonu';

export interface ArayuzSecenek {
  ses?: (t: ArayuzSesi) => void;
  geri: HudGeri;
}

export class Arayuz {
  readonly kok: HTMLElement;
  readonly ekran: EkranYoneticisi;
  readonly hud: Hud;
  private balonEl: HTMLElement;
  private balonMetin: HTMLElement;
  private balonSure: ReturnType<typeof setTimeout> | null = null;
  private bilgiEl: HTMLElement;
  private bilgiSure: ReturnType<typeof setTimeout> | null = null;
  private sonda: HTMLElement;

  constructor(ebeveyn: HTMLElement, private s: ArayuzSecenek) {
    this.kok = h('div', { s: 'e-arayuz' });
    ebeveyn.appendChild(this.kok);
    this.ekran = new EkranYoneticisi(this.kok);
    this.hud = new Hud(this.kok, s.geri);
    const firca = svg(IKON.el);
    firca.classList.add('e-balon-ikon');
    this.balonMetin = h('span');
    this.balonEl = h('div', { s: 'e-balon', role: 'status', 'aria-live': 'polite' }, firca, this.balonMetin);
    this.balonEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.balonKapat();
    });
    this.bilgiEl = h('div', { s: 'e-bilgi', role: 'status', 'aria-live': 'polite' });
    this.sonda = h('div', { s: 'e-sonda', 'aria-hidden': 'true' });
    this.kok.append(this.balonEl, this.bilgiEl, this.sonda);
    dugmeSesiAyarla(() => s.ses?.('dugme'));
  }

  hareketiAzalt(az: boolean): void {
    this.ekran.azalt = az;
    this.kok.classList.toggle('e-az', az);
  }

  /** Güvenli alan payları (env(safe-area-inset-*) ölçümü). */
  guvenliAlan(): Kenarlar {
    const cs = getComputedStyle(this.sonda);
    const px = (v: string) => Number.parseFloat(v) || 0;
    if (!cs) return SIFIR_KENAR;
    return { ust: px(cs.paddingTop), sag: px(cs.paddingRight), alt: px(cs.paddingBottom), sol: px(cs.paddingLeft) };
  }

  // ─── Ekranlar ──────────────────────────────────────────────────────

  acilis(ilkDokunus: () => void): Promise<void> {
    return acilisEkrani(this.ekran, ilkDokunus);
  }

  harita(vm: HaritaVM, geri: HaritaGeri): Promise<number | null> {
    return haritaEkrani(this.ekran, vm, geri);
  }

  bolumOncesi(vm: BolumOncesiVM): Promise<'basla' | 'geri'> {
    this.s.ses?.('ac');
    return bolumOncesiEkrani(this.ekran, vm);
  }

  duraklat(ad: string): Promise<DuraklatSecimi> {
    this.s.ses?.('ac');
    return duraklatEkrani(this.ekran, ad);
  }

  kazandin(vm: KazandinVM, ek: SonEk): Promise<KazandinSecimi> {
    return kazandinEkrani(this.ekran, vm, ek);
  }

  kaybettin(vm: KaybettinVM, yer: Yerlesim, kontrol: Partial<KaybettinKontrol>): Promise<KaybettinSecimi> {
    return kaybettinEkrani(this.ekran, vm, yer, kontrol);
  }

  galeri(vm: GaleriVM): Promise<void> {
    this.s.ses?.('ac');
    return galeriEkrani(this.ekran, vm, this.kok.clientWidth, this.kok.clientHeight);
  }

  devami(vm: DevamiVM): Promise<'galeri' | 'harita'> {
    return devamiEkrani(this.ekran, vm, this.kok.clientWidth);
  }

  ayarlar(vm: AyarlarVM, geri: AyarlarGeri): Promise<void> {
    this.s.ses?.('ac');
    return ayarlarEkrani(this.ekran, vm, geri);
  }

  nasil(vm: NasilVM): Promise<void> {
    this.s.ses?.('ac');
    return nasilEkrani(this.ekran, vm);
  }

  ekranlariKapat(): void {
    this.ekran.hepsiniKapat();
  }

  get ekranAcik(): boolean {
    return this.ekran.sayi > 0;
  }

  // ─── HUD ───────────────────────────────────────────────────────────

  hudKur(vm: HudVM, yer: Yerlesim): void {
    this.hud.kur(vm);
    this.hud.yerlestir(yer);
    this.hud.goster(true);
  }

  // ─── Usta balonu ve bilgi ──────────────────────────────────────────

  /**
   * Usta balonu (tek satır, tahtanın üst kenarına yapışık; dokununca
   * kapanır). `sure` 0 → kalıcı (zorunlu ilk hamle boyunca).
   */
  balon(metin: string, g: TahtaGeometrisi, sure = 4200): void {
    if (this.balonSure) clearTimeout(this.balonSure);
    this.balonSure = null;
    this.balonMetin.textContent = metin;
    const bant = Math.max(10, Math.round(g.hucre * 0.3));
    this.balonEl.style.left = `${g.x + (g.w * g.hucre) / 2}px`;
    this.balonEl.style.top = `${g.y - bant}px`;
    this.balonEl.style.maxWidth = `${Math.max(220, g.w * g.hucre + bant)}px`;
    this.balonEl.classList.remove('gor');
    void this.balonEl.offsetWidth;
    this.balonEl.classList.add('gor');
    if (sure > 0) this.balonSure = setTimeout(() => this.balonKapat(), sure);
  }

  balonKapat(): void {
    if (this.balonSure) clearTimeout(this.balonSure);
    this.balonSure = null;
    this.balonEl.classList.remove('gor');
  }

  get balonAcik(): boolean {
    return this.balonEl.classList.contains('gor');
  }

  bilgi(metin: string, sure = 2600): void {
    if (this.bilgiSure) clearTimeout(this.bilgiSure);
    this.bilgiEl.textContent = metin;
    this.bilgiEl.classList.add('gor');
    this.bilgiSure = setTimeout(() => this.bilgiEl.classList.remove('gor'), sure);
  }
}
