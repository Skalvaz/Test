/**
 * Oyun HUD'u (GDD §13.7, §14.4; §11 kancaları 7, 8, 9).
 *
 * Dikey telefon: üstte pirinç çerçeveli ahşap plaka — solda hedef kartları,
 * ortada hamle madalyonu (56 px), sağda puan ve 3 yıldız işaretli çubuk.
 * Altta başparmak bandı: [Duraklat] solda, [Kibrit][Kalıp][Geri Sar]
 * ortada (56×56), [Körük] sağda (72 px daire).
 * Yatay/masaüstü: aynı parçalar sağdaki 320 px panelde.
 *
 * HUD kökü işaretçi olaylarını geçirir (tahta tuvali altta); yalnız
 * düğmeler dokunulabilir.
 */
import { h, svg, say, yenidenOynat } from './dom';
import { ikon, hedefIkonu, guclendiriciIsaretleme, alevSvg } from './ikonlar';
import { M, GUCLENDIRICI_ADLARI, hedefKalan, hedefEtiketi, sayi, bolumBasligi } from './metinler';
import type { Baglam } from './cekirdek';
import type { HudVM, HedefVM, GuclendiriciVM } from './tipler';
import type { Yerlesim } from './yerlesim';
import type { GuclendiriciId } from '../app/katalog';
import { puanOrani, yildizKonumlari } from './puanCubugu';

interface HedefEl {
  kart: HTMLElement;
  ikon: HTMLElement;
  sayi: HTMLElement;
  vm: HedefVM;
}

const KORUK_CEVRE = 2 * Math.PI * 31;
const HAMLE_CEVRE = 2 * Math.PI * 25;

export class Hud {
  private b: Baglam;
  private vm: HudVM | null = null;
  private yer: Yerlesim | null = null;
  private kok: HTMLElement | null = null;
  private hedefler: HedefEl[] = [];
  private hamleKutu: HTMLElement | null = null;
  private hamleSayi: HTMLElement | null = null;
  private hamleHalka: SVGCircleElement | null = null;
  private puanSayi: HTMLElement | null = null;
  private puanDolgu: HTMLElement | null = null;
  private isaretler: HTMLElement[] = [];
  private guclendiriciler = new Map<GuclendiriciId, { dg: HTMLButtonElement; rozet: HTMLElement; vm: GuclendiriciVM }>();
  private korukDg: HTMLButtonElement | null = null;
  private korukHalka: SVGCircleElement | null = null;
  private korukSayi: HTMLElement | null = null;
  private secimEl: HTMLElement | null = null;
  private gosterilenPuan = 0;
  private puanSayimIptal: (() => void) | null = null;
  private oncekiKorukDolu = false;
  private vurgulu: GuclendiriciId | 'koruk' | null = null;
  /** "Son hamle!" bandı (Arayuz bağlar). */
  bantGoster: (metin: string) => void = () => {};

  constructor(b: Baglam) {
    this.b = b;
  }

  get gorunur(): boolean {
    return !!this.kok;
  }

  get model(): HudVM | null {
    return this.vm;
  }

  kur(vm: HudVM, yer: Yerlesim): void {
    this.vm = vm;
    this.yer = yer;
    this.gosterilenPuan = vm.puan;
    this.oncekiKorukDolu = vm.korukKapasite > 0 && vm.korukDolum >= vm.korukKapasite;
    this.ciz();
  }

  /** Ekran boyutu değişti; kip değiştiyse yeniden kurar. */
  yerlesimUygula(yer: Yerlesim): void {
    const kipDegisti = this.yer?.kip !== yer.kip;
    this.yer = yer;
    if (!this.kok || !this.vm) return;
    if (kipDegisti) this.ciz();
    else this.konumla();
  }

  gizle(): void {
    this.puanSayimIptal?.();
    if (!this.kok) return;
    const k = this.kok;
    k.classList.add('f-hud-cikis');
    setTimeout(() => k.remove(), 200);
    this.kok = null;
    this.secimEl = null;
  }

  // ───────────────────── Kurulum ─────────────────────

  private ciz(): void {
    const vm = this.vm!;
    const yer = this.yer!;
    this.kok?.remove();
    this.hedefler = [];
    this.isaretler = [];
    this.guclendiriciler.clear();
    const kok = h('div', { s: `f-hud-ic f-hud-${yer.kip}` });
    this.kok = kok;

    const hedefKutusu = h('div', { s: 'f-hedefler', role: 'list', 'aria-label': M.hedefler });
    for (const hd of vm.hedefler) hedefKutusu.appendChild(this.hedefKarti(hd));
    if (vm.hedefler.length === 0) hedefKutusu.classList.add('f-bos');
    const hamle = this.hamleMadalyonu(vm);
    const puan = this.puanCubugu(vm);
    const duraklat = h('button', { s: 'f-yuvarlak f-duraklat-dg', type: 'button', 'aria-label': M.duraklat }, ikon('duraklat'));
    duraklat.addEventListener('click', () => this.b.geri.duraklatIstendi?.());
    const guclendiriciler = h('div', { s: 'f-gucler' });
    for (const g of vm.guclendiriciler) guclendiriciler.appendChild(this.guclendiriciDugmesi(g));
    const koruk = this.korukDugmesi(vm);

    if (yer.kip === 'dikey') {
      const plaka = h('div', { s: 'f-plaka' }, hedefKutusu, h('div', { s: 'f-plaka-orta' }, hamle), puan);
      const alt = h('div', { s: 'f-hud-alt' }, h('div', { s: 'f-alt-sol' }, duraklat), guclendiriciler, h('div', { s: 'f-alt-sag' }, koruk));
      kok.append(h('div', { s: 'f-hud-ust' }, plaka), alt);
    } else {
      const baslik = h(
        'div',
        { s: 'f-panel-baslik' },
        h('div', { s: 'f-etiket', t: bolumBasligi(vm.bolumId) }),
        h('div', { s: 'f-panel-ad', t: vm.bolumAdi }),
      );
      const panel = h(
        'div',
        { s: 'f-panel' },
        baslik,
        h('div', { s: 'f-panel-bolum' }, h('div', { s: 'f-etiket', t: M.hedefler }), hedefKutusu),
        h('div', { s: 'f-panel-bolum f-panel-sira' }, hamle, puan),
        h('div', { s: 'f-panel-bolum' }, guclendiriciler),
        h('div', { s: 'f-panel-sira f-panel-son' }, duraklat, koruk),
      );
      kok.append(h('div', { s: 'f-panel-yer' }, panel));
    }
    this.b.hudKatmani.appendChild(kok);
    this.konumla();
    this.hamleGuncelle(vm.kalanHamle, false);
    this.puanGoster(vm.puan, false);
    this.korukGuncelle(vm.korukDolum, vm.korukKapasite, false);
    this.secimEl = null;
  }

  private konumla(): void {
    const yer = this.yer!;
    const k = this.kok!;
    k.style.setProperty('--tahta-x', `${yer.tahta.x}px`);
    k.style.setProperty('--tahta-y', `${yer.tahta.y}px`);
    k.style.setProperty('--tahta-w', `${yer.tahta.w}px`);
    k.style.setProperty('--tahta-h', `${yer.tahta.h}px`);
    if (yer.kip === 'dikey') {
      const ust = k.querySelector<HTMLElement>('.f-hud-ust')!;
      ust.style.height = `${yer.ustBant.h}px`;
      k.classList.toggle('f-dar', yer.ustOran < 0.2 || yer.ekranH < 700);
      const alt = k.querySelector<HTMLElement>('.f-hud-alt')!;
      alt.style.top = `${yer.altBant!.y}px`;
      alt.style.height = `${yer.altBant!.h}px`;
    } else {
      const p = k.querySelector<HTMLElement>('.f-panel-yer')!;
      const r = yer.panel!;
      p.style.left = `${r.x}px`;
      p.style.top = `${r.y}px`;
      p.style.width = `${r.w}px`;
      p.style.height = `${r.h}px`;
    }
  }

  private hedefKarti(hd: HedefVM): HTMLElement {
    const ik = h('span', { s: 'f-hedef-ikon' }, hedefIkonu(hd, this.b.palet));
    const sy = h('span', { s: 'f-hedef-sayi f-sayi', t: sayi(hedefKalan(hd)) });
    const tik = h('span', { s: 'f-hedef-tik', 'aria-hidden': 'true' }, ikon('tik'));
    const kart = h('div', { s: `f-hedef${hd.tamam ? ' f-tamam' : ''}`, role: 'listitem', 'aria-label': hedefEtiketi(hd) }, ik, sy, tik);
    if (hedefKalan(hd) >= 1000) kart.classList.add('f-uzun');
    this.hedefler.push({ kart, ikon: ik, sayi: sy, vm: { ...hd } });
    return kart;
  }

  private hamleMadalyonu(vm: HudVM): HTMLElement {
    const halka = svg(`<svg class="f-hamle-halka" viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="4"/>
      <circle class="f-hamle-yay" cx="30" cy="30" r="25" fill="none" stroke="url(#ftl-altin)" stroke-width="4" stroke-linecap="round"
        stroke-dasharray="${HAMLE_CEVRE.toFixed(2)}" transform="rotate(-90 30 30)"/></svg>`);
    this.hamleHalka = halka.querySelector('.f-hamle-yay');
    this.hamleSayi = h('span', { s: 'f-hamle-sayi f-sayi', t: String(vm.kalanHamle) });
    this.hamleKutu = h(
      'div',
      { s: 'f-hamle', role: 'status', 'aria-label': `${vm.kalanHamle} ${M.hamle}` },
      halka,
      h('span', { s: 'f-hamle-ic' }, this.hamleSayi, h('span', { s: 'f-hamle-etiket', t: M.hamle })),
    );
    return this.hamleKutu;
  }

  private puanCubugu(vm: HudVM): HTMLElement {
    this.puanSayi = h('span', { s: 'f-puan-sayi f-sayi', t: sayi(vm.puan) });
    this.puanDolgu = h('div', { s: 'f-puan-dolgu' });
    const cubuk = h('div', { s: 'f-puan-cubuk' }, this.puanDolgu);
    const [, k2, k3] = yildizKonumlari(vm.yildizEsikleri);
    const konumlar = [0.07, k2, k3];
    konumlar.forEach((o, i) => {
      const isaret = h('span', { s: 'f-yildiz-isaret', css: { left: `${(Math.min(0.94, o) * 100).toFixed(1)}%` } }, ikon('yildizDolu'));
      if (i + 1 > vm.yildizSiniri) isaret.classList.add('f-sinirli');
      this.isaretler.push(isaret);
      cubuk.appendChild(isaret);
    });
    return h('div', { s: 'f-puan', 'aria-label': M.puan }, this.puanSayi, cubuk);
  }


  private guclendiriciDugmesi(g: GuclendiriciVM): HTMLElement {
    const res = svg(`<svg class="f-resim f-guc-resim" viewBox="-24 -24 48 48" aria-hidden="true">${guclendiriciIsaretleme(g.id)}</svg>`);
    const rozet = h('span', { s: 'f-guc-adet f-sayi' });
    const kilit = h('span', { s: 'f-guc-kilit' }, ikon('kilit'));
    const dg = h('button', { s: 'f-guc', type: 'button', 'data-id': g.id }, res, rozet, kilit) as HTMLButtonElement;
    dg.addEventListener('click', () => {
      const k = this.guclendiriciler.get(g.id);
      if (!k) return;
      const v = k.vm;
      if (!v.acik) {
        const acilis = { kibrit: 7, kalip: 12, geriSar: 20 }[v.id];
        this.b.toast(M.guclendiriciAcilis(acilis));
        return;
      }
      if (v.adet <= 0) {
        this.b.toast(M.stokYok);
        return;
      }
      if (!v.kullanilabilir) {
        this.b.toast(M.bolumBasina1);
        return;
      }
      this.b.geri.guclendiriciSecildi?.(v.id);
    });
    this.guclendiriciler.set(g.id, { dg, rozet, vm: g });
    this.guclendiriciBoya(g.id);
    return dg;
  }

  private guclendiriciBoya(id: GuclendiriciId): void {
    const k = this.guclendiriciler.get(id);
    if (!k) return;
    const v = k.vm;
    k.rozet.textContent = String(v.adet);
    k.dg.classList.toggle('f-kilitli', !v.acik);
    k.dg.classList.toggle('f-bos', v.acik && v.adet <= 0);
    k.dg.classList.toggle('f-pasif', v.acik && v.adet > 0 && !v.kullanilabilir);
    k.dg.classList.toggle('f-secili', this.vurgulu === id);
    k.dg.setAttribute('aria-disabled', String(!(v.acik && v.adet > 0 && v.kullanilabilir)));
    const durum = !v.acik ? M.kilitli : `${v.adet}`;
    k.dg.setAttribute('aria-label', `${GUCLENDIRICI_ADLARI[id]}: ${durum}`);
  }

  private korukDugmesi(vm: HudVM): HTMLElement {
    const halka = svg(`<svg class="f-koruk-halka" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="31" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="6"/>
      <circle class="f-koruk-yay" cx="36" cy="36" r="31" fill="none" stroke="url(#ftl-altin)" stroke-width="6" stroke-linecap="round"
        stroke-dasharray="${KORUK_CEVRE.toFixed(2)}" stroke-dashoffset="${KORUK_CEVRE.toFixed(2)}" transform="rotate(-90 36 36)"/></svg>`);
    this.korukHalka = halka.querySelector('.f-koruk-yay');
    this.korukSayi = h('span', { s: 'f-koruk-sayi f-sayi' });
    const dg = h(
      'button',
      { s: 'f-koruk', type: 'button', 'aria-label': M.koruk },
      h('span', { s: 'f-koruk-parilti', 'aria-hidden': 'true' }),
      halka,
      h('span', { s: 'f-koruk-ic' }, ikon('koruk', 'f-koruk-ikon'), this.korukSayi),
    ) as HTMLButtonElement;
    dg.addEventListener('click', () => {
      const v = this.vm;
      if (!v || v.korukKapasite <= 0) return;
      if (v.korukDolum < v.korukKapasite) {
        this.b.toast(`${M.koruk}: ${v.korukDolum}/${v.korukKapasite}`);
        return;
      }
      this.b.geri.korukSecildi?.();
    });
    this.korukDg = dg;
    if (vm.korukKapasite <= 0) dg.classList.add('f-yok');
    return dg;
  }

  // ───────────────────── Güncelleme ─────────────────────

  /** Bütün HUD'u görünüm modeliyle eşitler (fark varsa canlandırır). */
  guncelle(vm: HudVM): void {
    const eski = this.vm;
    this.vm = vm;
    if (!this.kok || !eski) return;
    const yapiDegisti =
      eski.hedefler.length !== vm.hedefler.length ||
      eski.hedefler.some((x, i) => x.tur !== vm.hedefler[i].tur || x.renk !== vm.hedefler[i].renk) ||
      eski.guclendiriciler.length !== vm.guclendiriciler.length ||
      eski.yildizEsikleri[0] !== vm.yildizEsikleri[0] ||
      eski.yildizEsikleri[1] !== vm.yildizEsikleri[1] ||
      eski.yildizSiniri !== vm.yildizSiniri ||
      (eski.korukKapasite > 0) !== (vm.korukKapasite > 0) ||
      eski.tahtaW !== vm.tahtaW ||
      eski.tahtaH !== vm.tahtaH;
    if (yapiDegisti) {
      this.ciz();
      return;
    }
    vm.hedefler.forEach((hd, i) => this.hedefSayaci(i, hd.ilerleme, hd.tamam, hd.gerekli));
    if (vm.kalanHamle !== eski.kalanHamle) this.hamleSayaci(vm.kalanHamle);
    if (vm.puan !== eski.puan) this.puanGoster(vm.puan, true);
    this.korukGuncelle(vm.korukDolum, vm.korukKapasite, true);
    for (const g of vm.guclendiriciler) {
      const k = this.guclendiriciler.get(g.id);
      if (!k) continue;
      k.vm = g;
      this.guclendiriciBoya(g.id);
    }
  }

  /** Hedef sayacı (§12.2: sayaç 1→1,25→1, 150 ms; tamamlanınca onay outBack 250 ms). */
  hedefSayaci(indeks: number, deger: number, tamam: boolean, gerekli?: number): void {
    const e = this.hedefler[indeks];
    if (!e) return;
    const oncekiKalan = hedefKalan(e.vm);
    const oncekiTamam = e.vm.tamam;
    e.vm.ilerleme = deger;
    if (gerekli !== undefined) e.vm.gerekli = gerekli;
    e.vm.tamam = tamam;
    if (this.vm?.hedefler[indeks]) {
      this.vm.hedefler[indeks].ilerleme = deger;
      this.vm.hedefler[indeks].tamam = tamam;
      if (gerekli !== undefined) this.vm.hedefler[indeks].gerekli = gerekli;
    }
    const kalan = hedefKalan(e.vm);
    e.sayi.textContent = sayi(kalan);
    e.kart.setAttribute('aria-label', hedefEtiketi(e.vm));
    if (kalan !== oncekiKalan && !tamam) yenidenOynat(e.kart, 'f-zipla');
    if (tamam && !oncekiTamam) {
      e.kart.classList.add('f-tamam');
      yenidenOynat(e.kart, 'f-zipla');
      this.b.ses('hedefTamam');
      this.b.titret(15);
    } else if (!tamam) e.kart.classList.remove('f-tamam');
  }

  /** Hamle sayacı: son 5'te turuncu nabız, 1'de "Son hamle!" bandı (§11.9). */
  hamleSayaci(kalan: number): void {
    const onceki = this.vm?.kalanHamle;
    if (this.vm) this.vm.kalanHamle = kalan;
    this.hamleGuncelle(kalan, onceki !== undefined && onceki !== kalan);
    if (kalan === 1 && onceki !== 1) {
      this.bantGoster(M.sonHamle);
      this.b.ses('sonHamle');
    }
  }

  private hamleGuncelle(kalan: number, canli: boolean): void {
    if (!this.hamleSayi || !this.hamleKutu || !this.vm) return;
    this.hamleSayi.textContent = String(Math.max(0, kalan));
    this.hamleKutu.setAttribute('aria-label', `${kalan} ${M.hamle}`);
    const oran = this.vm.toplamHamle > 0 ? Math.max(0, Math.min(1, kalan / this.vm.toplamHamle)) : 0;
    this.hamleHalka?.setAttribute('stroke-dashoffset', (HAMLE_CEVRE * (1 - oran)).toFixed(2));
    this.hamleKutu.classList.toggle('f-son5', kalan <= 5 && kalan > 0);
    this.hamleKutu.classList.toggle('f-son1', kalan === 1);
    if (canli) yenidenOynat(this.hamleKutu, 'f-tik');
  }

  /** Puan (sayarak) ve yıldız işaretleri. */
  puanGoster(puan: number, canli = true): void {
    const vm = this.vm;
    if (!vm || !this.puanSayi || !this.puanDolgu) return;
    vm.puan = puan;
    this.puanSayimIptal?.();
    const bas = this.gosterilenPuan;
    this.gosterilenPuan = puan;
    this.puanSayimIptal = say(this.puanSayi, bas, puan, canli && !this.b.az() ? 420 : 0, sayi);
    this.puanDolgu.style.transform = `scaleX(${puanOrani(puan, vm.yildizEsikleri).toFixed(4)})`;
    const hedeflerTamam = vm.hedefler.every((x) => x.tamam);
    const yanik = [hedeflerTamam, puan >= vm.yildizEsikleri[0], puan >= vm.yildizEsikleri[1]];
    this.isaretler.forEach((e, i) => {
      const once = e.classList.contains('f-yanik');
      e.classList.toggle('f-yanik', yanik[i]);
      if (yanik[i] && !once && canli) yenidenOynat(e, 'f-zipla');
    });
  }

  /** Körük göstergesi (§6, §12.2: dolunca 1,5 Hz nabız). */
  korukGuncelle(dolum: number, kapasite: number, canli = true): void {
    if (this.vm) {
      this.vm.korukDolum = dolum;
      this.vm.korukKapasite = kapasite;
    }
    const dg = this.korukDg;
    if (!dg) return;
    dg.classList.toggle('f-yok', kapasite <= 0);
    if (kapasite <= 0) return;
    const oran = Math.max(0, Math.min(1, dolum / kapasite));
    this.korukHalka?.setAttribute('stroke-dashoffset', (KORUK_CEVRE * (1 - oran)).toFixed(2));
    if (this.korukSayi) this.korukSayi.textContent = `${Math.min(dolum, kapasite)}/${kapasite}`;
    const dolu = dolum >= kapasite;
    dg.classList.toggle('f-dolu', dolu);
    dg.setAttribute('aria-label', dolu ? M.korukDolu : `${M.koruk}: ${dolum}/${kapasite}`);
    if (dolu && !this.oncekiKorukDolu && canli) {
      this.b.ses('korukDoldu');
      this.b.titret([20, 30, 20]);
      yenidenOynat(dg, 'f-zipla');
    }
    this.oncekiKorukDolu = dolu;
  }

  /** Hedef seçimi ipucu (körük/kibrit/kalıp) ve iptal düğmesi; null = kapat. */
  secimKipi(metin: string | null, kaynak: GuclendiriciId | 'koruk' | null = null): void {
    this.vurgulu = metin ? kaynak : null;
    for (const id of this.guclendiriciler.keys()) this.guclendiriciBoya(id);
    this.korukDg?.classList.toggle('f-secili', this.vurgulu === 'koruk');
    if (!this.kok) return;
    if (!metin) {
      const e = this.secimEl;
      if (e) {
        e.classList.add('f-cikis');
        setTimeout(() => e.remove(), 180);
      }
      this.secimEl = null;
      return;
    }
    if (this.secimEl) {
      this.secimEl.querySelector('.f-secim-metin')!.textContent = metin;
      return;
    }
    const iptal = h('button', { s: 'f-secim-iptal', type: 'button' }, ikon('kapat'), h('span', { t: M.iptal }));
    iptal.addEventListener('click', () => this.b.geri.secimIptal?.());
    const e = h('div', { s: 'f-secim', role: 'status' }, alevSvg('f-secim-alev'), h('span', { s: 'f-secim-metin', t: metin }), iptal);
    this.kok.appendChild(e);
    this.secimEl = e;
    this.b.duyur(metin);
  }

  /** Hedef kartlarının (ikon merkezleri) kök öğeye göre konumları. */
  hedefKonumlari(): { x: number; y: number }[] {
    const kr = this.b.kok.getBoundingClientRect();
    return this.hedefler.map((e) => {
      const r = e.ikon.getBoundingClientRect();
      return { x: r.left - kr.left + r.width / 2, y: r.top - kr.top + r.height / 2 };
    });
  }

  /** Klavye kısayolları (§13.7): K Körük, 1/2/3 güçlendirici, P duraklat. */
  tus(e: KeyboardEvent): boolean {
    if (!this.kok || !this.vm || e.ctrlKey || e.metaKey || e.altKey) return false;
    const hedef = e.target as HTMLElement | null;
    if (hedef && (hedef.tagName === 'INPUT' || hedef.tagName === 'TEXTAREA')) return false;
    const k = e.key.toLowerCase();
    if (k === 'k') {
      this.korukDg?.click();
      return true;
    }
    if (k === 'p') {
      this.b.geri.duraklatIstendi?.();
      return true;
    }
    const i = ['1', '2', '3'].indexOf(k);
    if (i >= 0) {
      const g = this.vm.guclendiriciler[i];
      if (g) this.guclendiriciler.get(g.id)?.dg.click();
      return true;
    }
    return false;
  }
}
