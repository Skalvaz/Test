/**
 * Oyun içi HUD (GDD §11.6, §7, §10.2): hedef kartları (kalan sayı; damla
 * vardığında zıplar, tamamlanınca altın onay mührü), hamle mührü (son 3
 * hamlede kırmızımsı nabız), puan + üç yıldız işaretli çubuk (işaretler üst
 * üste binmez: `puanCubugu.ts`), tarif şeridi (dokununca açılır/katlanır),
 * Duraklat. Dikey telefonda üst/alt bant; masaüstünde sağ panel.
 */
import { t as dilT } from '../platform/dil';
import { h, svg } from './dom';
import { IKON, YILDIZ_DOLU } from './ikonlar';
import { damlaResmi, img } from './gorsel';
import { M, bolumEtiketi, renkAdi, sayi } from './metinler';
import { dugme, hedefIkonu, hedefKalan } from './ekranlar/ortak';
import { puanOrani, yildizKonumlari } from './puanCubugu';
import type { HedefVM, HudVM } from './tipler';
import type { Yerlesim } from './yerlesim';

export interface HudGeri {
  duraklat(): void;
}

export class Hud {
  readonly kok: HTMLElement;
  private ust = h('div', { s: 'e-hud-ust' });
  private sira = h('div', { s: 'e-hud-sira' });
  private hedefKap = h('div', { s: 'e-hedefler' });
  private hamleEl = h('div', { s: 'e-hamle', role: 'status', 'aria-live': 'polite' });
  private hamleSayi = h('b', { t: '0' });
  private puanKap = h('div', { s: 'e-puan' });
  private puanSayi = h('b', { s: 'e-puan-sayi', t: '0' });
  private dolgu = h('i', { s: 'e-dolgu' });
  private isaretler: HTMLElement[] = [];
  private tarif = h('div', { s: 'e-tarif' });
  private tarifIc = h('div', { s: 'e-tarif-ic' });
  private alt = h('div', { s: 'e-hud-alt' });
  private ad = h('div', { s: 'e-hud-ad' });
  private panelAd = h('div', { s: 'e-panel-ad' });
  private durDugme: HTMLButtonElement;
  private kartlar: { kok: HTMLElement; sayi: HTMLElement; hd: HedefVM }[] = [];
  private vm: HudVM | null = null;
  private puanDeger = 0;
  private tarifAcik = true;
  private tarifSabit = true;
  private kip: 'dikey' | 'yan' = 'dikey';

  constructor(ebeveyn: HTMLElement, geri: HudGeri) {
    this.kok = h('div', { s: 'e-hud gizli', 'data-kip': 'dikey' });
    // Yalnız sayı (Ekim 2026): "18" yeterince anlaşılır, "HAMLE" etiketi 9 px'te okunmuyordu.
    this.hamleEl.append(this.hamleSayi);
    const cubuk = h('div', { s: 'e-cubuk' }, this.dolgu);
    for (let i = 0; i < 3; i++) {
      const s = h('span', { s: 'e-isaret' });
      s.appendChild(svg(YILDIZ_DOLU));
      this.isaretler.push(s);
      cubuk.appendChild(s);
    }
    this.puanKap.append(this.puanSayi, cubuk);
    this.sira.append(this.hedefKap, this.hamleEl, this.puanKap);
    this.ust.append(this.panelAd, this.sira);
    this.durDugme = dugme('', { tur: 'yuvarlak', ikon: 'duraklat', ad: M.duraklat, sinif: 'e-dur', on: () => geri.duraklat() });
    this.alt.append(this.durDugme, this.ad);
    const tarifBaslik = h('button', { s: 'e-tarif-baslik', type: 'button', 'aria-label': M.tarifler });
    tarifBaslik.append(svg(IKON.tarif), h('span', { t: M.tarifler }));
    // Katlanır şerit (bölüm 6+, ayar "İlk bölümlerde"): dokununca açılır/katlanır.
    this.tarif.addEventListener('click', (e) => {
      if (this.tarifSabit) return;
      e.stopPropagation();
      this.tarifAc(!this.tarifAcik);
    });
    this.tarif.append(tarifBaslik, this.tarifIc);
    this.kok.append(this.ust, this.tarif, this.alt);
    ebeveyn.appendChild(this.kok);
  }

  kur(vm: HudVM): void {
    this.vm = vm;
    this.hedefKap.textContent = '';
    this.kartlar = vm.hedefler.map((hd, i) => {
      const sayiEl = h('b', { s: 'e-hedef-sayi', t: hd.tur === 'puan' ? sayi(hedefKalan(hd)) : String(hedefKalan(hd)) });
      const k = h('div', { s: `e-hedef${hd.tamam ? ' tamam' : ''}`, 'data-i': String(i), 'aria-label': this.kartEtiketi(hd) });
      const tik = h('i', { s: 'e-tik' });
      tik.appendChild(svg(IKON.tik));
      k.append(hedefIkonu(hd, 28), sayiEl, tik);
      this.hedefKap.appendChild(k);
      return { kok: k, sayi: sayiEl, hd: { ...hd } };
    });
    const ad = `${vm.atolyeAd} · ${vm.bolumId} · ${vm.ad}`;
    this.ad.textContent = ad;
    this.panelAd.textContent = '';
    this.panelAd.append(h('small', { t: `${vm.atolyeAd} · ${bolumEtiketi(vm.bolumId)}` }), h('b', { t: vm.ad }));
    const [a, b, c] = yildizKonumlari(vm.esikler);
    [a, b, c].forEach((x, i) => this.isaretler[i].style.setProperty('--x', String(x)));
    this.puanDeger = vm.puan;
    this.puanYaz();
    this.hamle(vm.kalanHamle, false);
    // Tarifler.
    this.tarifIc.textContent = '';
    for (const t of vm.tarifler) {
      const cip = h('div', { s: 'e-cip', 'aria-label': dilT(`${renkAdi(t.a)} artı ${renkAdi(t.b)} eşittir ${renkAdi(t.sonuc)}`, `${renkAdi(t.a)} plus ${renkAdi(t.b)} makes ${renkAdi(t.sonuc)}`) });
      cip.append(img(damlaResmi(t.a, 20), 20), h('span', { s: 'e-arti', t: '+' }), img(damlaResmi(t.b, 20), 20), h('span', { s: 'e-esit', t: '=' }), img(damlaResmi(t.sonuc, 22), 22));
      this.tarifIc.appendChild(cip);
    }
    this.tarif.classList.toggle('yok', vm.tarifler.length === 0);
    this.tarifSabitle(vm.tarifAcik);
  }

  /** Sabit açık (bölüm 1–5 ya da ayar "Her zaman") ya da katlanır (dokununca açılır). */
  tarifSabitle(sabit: boolean): void {
    this.tarifSabit = sabit;
    this.tarif.classList.toggle('sabit', sabit);
    this.tarifAc(sabit, false);
  }

  private kartEtiketi(hd: HedefVM): string {
    const k = hedefKalan(hd);
    if (hd.tur === 'topla') return dilT(`${k} ${renkAdi(hd.renk ?? 0)} kaldı`, `${k} ${renkAdi(hd.renk ?? 0)} left`);
    if (hd.tur === 'kagit') return dilT(`${k} kâğıt kaldı`, k === 1 ? '1 paper left' : `${k} papers left`);
    if (hd.tur === 'desen') return dilT(`${k} desen hücresi kaldı`, k === 1 ? '1 pattern cell left' : `${k} pattern cells left`);
    return dilT(`${k} puan kaldı`, `${k} points left`);
  }

  tarifAc(ac: boolean, anim = true): void {
    this.tarifAcik = ac;
    this.tarif.classList.toggle('acik', ac);
    this.tarif.classList.toggle('anim', anim);
  }

  /** Yerleşim değişti: dikeyde bantlar, yanda panel. */
  yerlestir(y: Yerlesim): void {
    this.kip = y.kip;
    this.kok.dataset.kip = y.kip;
    const st = (e: HTMLElement, r: { x: number; y: number; w: number; h: number } | null) => {
      if (!r) {
        e.style.cssText = '';
        return;
      }
      e.style.left = `${r.x}px`;
      e.style.top = `${r.y}px`;
      e.style.width = `${r.w}px`;
      e.style.height = `${r.h}px`;
    };
    if (y.kip === 'dikey') {
      if (this.tarif.parentElement !== this.kok) this.kok.insertBefore(this.tarif, this.alt);
      if (this.durDugme.parentElement !== this.alt) this.alt.insertBefore(this.durDugme, this.ad);
      // Yan kipten dönüşte (telefon döndürülünce) panel stilleri temizlensin.
      this.ust.style.cssText = '';
      this.alt.style.cssText = '';
      st(this.ust, y.ust);
      st(this.alt, y.alt);
      this.tarif.style.cssText = '';
      if (y.tarif) {
        st(this.tarif, y.tarif);
        this.tarif.style.display = '';
      } else this.tarif.style.display = 'none';
    } else {
      this.ust.style.cssText = '';
      st(this.ust, y.panel);
      this.ust.style.height = 'auto';
      this.ust.style.maxHeight = `${y.panel!.h}px`;
      if (this.tarif.parentElement !== this.ust) this.ust.appendChild(this.tarif);
      this.tarif.style.cssText = '';
      this.tarif.style.display = y.tarif ? '' : 'none';
      if (this.durDugme.parentElement !== this.ust) this.ust.appendChild(this.durDugme);
      this.alt.style.cssText = 'display:none';
    }
  }

  goster(g: boolean): void {
    this.kok.classList.toggle('gizli', !g);
  }

  /** Hedef ilerledi (damla karta vardığında). */
  hedef(i: number, ilerleme: number, tamam: boolean): void {
    const k = this.kartlar[i];
    if (!k) return;
    const onceTamam = k.hd.tamam;
    k.hd.ilerleme = ilerleme;
    k.hd.tamam = tamam;
    const kalan = hedefKalan(k.hd);
    k.sayi.textContent = k.hd.tur === 'puan' ? sayi(kalan) : String(kalan);
    k.kok.setAttribute('aria-label', this.kartEtiketi(k.hd));
    k.kok.classList.remove('zipla');
    void k.kok.offsetWidth;
    k.kok.classList.add('zipla');
    if (tamam && !onceTamam) k.kok.classList.add('tamam', 'damga');
    if (!tamam) k.kok.classList.remove('tamam');
  }

  /** Bütün hedefleri durumdan eşitle (oynatma sonu). */
  hedefleriEsitle(l: { ilerleme: number; tamam: boolean }[]): void {
    l.forEach((x, i) => {
      const k = this.kartlar[i];
      if (!k || (k.hd.ilerleme === x.ilerleme && k.hd.tamam === x.tamam)) return;
      this.hedef(i, x.ilerleme, x.tamam);
    });
  }

  hamle(n: number, anim = true): void {
    this.hamleSayi.textContent = String(Math.max(0, n));
    this.hamleEl.classList.toggle('az', n <= 3);
    this.hamleEl.setAttribute('aria-label', M.hamleKaldi(n));
    if (anim) {
      this.hamleEl.classList.remove('vur');
      void this.hamleEl.offsetWidth;
      this.hamleEl.classList.add('vur');
    }
  }

  puanEkle(m: number): void {
    this.puanDeger += m;
    this.puanYaz();
  }

  puan(p: number): void {
    this.puanDeger = p;
    this.puanYaz();
  }

  private puanYaz(): void {
    const vm = this.vm;
    if (!vm) return;
    this.puanSayi.textContent = sayi(this.puanDeger);
    const o = puanOrani(this.puanDeger, vm.esikler);
    this.dolgu.style.transform = `scaleX(${o.toFixed(4)})`;
    const k = yildizKonumlari(vm.esikler);
    this.isaretler.forEach((s, i) => s.classList.toggle('dolu', o >= k[i] - 1e-6));
  }

  /** Önizlemede ilerleyecek hedef kartları nabız atar (null = kapat). */
  nabiz(artis: readonly number[] | null): void {
    this.kartlar.forEach((k, i) => k.kok.classList.toggle('nabiz', !!artis && (artis[i] ?? 0) > 0));
  }

  /** Hedef kartlarının merkezleri (köke göre CSS px): toplanan damla buraya uçar. */
  kartMerkezleri(): { x: number; y: number }[] {
    const kr = this.kok.parentElement?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return this.kartlar.map((k) => {
      const r = k.kok.getBoundingClientRect();
      return { x: r.left - kr.left + r.width / 2, y: r.top - kr.top + r.height / 2 };
    });
  }

  get yan(): boolean {
    return this.kip === 'yan';
  }
}
