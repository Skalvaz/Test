/**
 * Harita (ana ekran, §14.2, §10.1): Fener Koyu dikey kaydırılır, son açık
 * bölüme otomatik kayar. Üstte toplam ★, Fener Nöbeti alevi, günlük görev
 * rozeti; altta [Günün Şenliği] [Fişek Defteri] [İstatistik] [Ayarlar] ve
 * büyük "Bölüm N" düğmesi.
 *
 * Çizim: her mahalle ayrı, durağan bir SVG (cizim.ts). Canlı öğeler —
 * düğümler, çatı fişekleri, şimdiki bölüm nabzı, ateş böcekleri — HTML
 * katmanında, yalnız transform/opacity ile; görünmeyen mahallelerde
 * IntersectionObserver ile durdurulur. Yeni bölüm açıldığında fitil eski
 * düğümden yenisine yanarak ilerler.
 */
import { h, svg } from '../dom';
import { ikon, alevSvg, kucukYildiz, ustaSvg } from '../ikonlar';
import { M, sayi } from '../metinler';
import { yildizAlani } from '../sahne';
import type { Baglam } from '../cekirdek';
import type { HaritaSecimi, HaritaVM, BolumDugumuVM } from '../tipler';
import { MAHALLELER, USTA_BOLUM_IDLERI } from '../../app/katalog';
import type { Motif } from '../../core/types';
import {
  HARITA_W,
  HARITA_H,
  BOLGE_H,
  UST_PAY,
  ALT_PAY,
  MAHALLE_SAYISI,
  bolgeUst,
  bolgeCiz,
  dugumKonumu,
  ustaKonumu,
  yolParcalari,
  ustPayCiz,
  altPayCiz,
  haritaTanimlari,
  baslangicKonumu,
} from './cizim';

const yuzdeX = (x: number) => `${((x / HARITA_W) * 100).toFixed(3)}%`;
const yuzdeY = (y: number) => `${((y / HARITA_H) * 100).toFixed(4)}%`;

export class HaritaEkrani {
  private b: Baglam;
  private kok: HTMLElement | null = null;
  private kaydir: HTMLElement | null = null;
  private icerik: HTMLElement | null = null;
  private vm: HaritaVM | null = null;
  private coz: ((s: HaritaSecimi) => void) | null = null;
  private gozcu: IntersectionObserver | null = null;
  private ustBar: HTMLElement | null = null;
  private oynaDg: HTMLButtonElement | null = null;

  constructor(b: Baglam) {
    this.b = b;
  }

  get acik(): boolean {
    return !!this.kok;
  }

  goster(vm: HaritaVM): Promise<HaritaSecimi> {
    // Önceki bekleyen seçim varsa kapandı say.
    this.coz?.({ tur: 'kapandi' });
    const onceki = this.vm;
    this.vm = vm;
    const ilk = !this.kok;
    if (ilk) this.iskelet();
    const simdiki = simdikiBolum(vm);
    const oncekiSimdiki = onceki ? simdikiBolum(onceki) : null;
    const yeniAcilan = oncekiSimdiki !== null && simdiki > oncekiSimdiki && simdiki - oncekiSimdiki <= 1 ? oncekiSimdiki : null;
    this.ciz(vm, yeniAcilan);
    this.kok!.classList.remove('f-gizli-ekran');
    if (ilk || simdiki !== oncekiSimdiki) requestAnimationFrame(() => this.kaydirSimdiye(simdiki, ilk, yeniAcilan !== null));
    return new Promise((r) => {
      this.coz = (s) => {
        this.coz = null;
        r(s);
      };
    });
  }

  gizle(): void {
    this.coz?.({ tur: 'kapandi' });
    if (!this.kok) return;
    this.kok.classList.add('f-gizli-ekran');
  }

  yokEt(): void {
    this.coz?.({ tur: 'kapandi' });
    this.gozcu?.disconnect();
    this.kok?.remove();
    this.kok = null;
  }

  private sec(s: HaritaSecimi): void {
    this.coz?.(s);
  }

  // ─────────────────────── İskelet ───────────────────────

  private iskelet(): void {
    const kaydir = h('div', { s: 'f-harita-kaydir f-kaydir', tabindex: '-1' });
    const icerik = h('div', { s: 'f-harita-icerik', css: { 'aspect-ratio': `${HARITA_W} / ${HARITA_H}` } });
    kaydir.appendChild(icerik);
    this.ustBar = h('header', { s: 'f-harita-ust' });
    this.oynaDg = h('button', { s: 'f-dg f-dg-birincil f-dg-buyuk f-harita-oyna', type: 'button' }) as HTMLButtonElement;
    this.oynaDg.addEventListener('click', () => {
      const v = this.vm;
      if (v) this.sec({ tur: 'bolum', id: simdikiBolum(v) });
    });
    const alt = h('nav', { s: 'f-harita-alt', 'aria-label': 'Menü' });
    const kok = h(
      'div',
      { s: 'f-harita', role: 'main', 'aria-label': M.fenerKoyu },
      h('div', { s: 'f-harita-arka', 'aria-hidden': 'true' }, yildizAlani('harita-arka', 140, 0)),
      kaydir,
      this.ustBar,
      h('div', { s: 'f-harita-alt-kap' }, this.oynaDg, alt),
    );
    this.b.ekranKatmani.appendChild(kok);
    this.kok = kok;
    this.kaydir = kaydir;
    this.icerik = icerik;
    if (typeof IntersectionObserver !== 'undefined') {
      this.gozcu = new IntersectionObserver(
        (girdiler) => {
          for (const g of girdiler) (g.target as HTMLElement).classList.toggle('f-gorunur', g.isIntersecting);
        },
        { root: kaydir, rootMargin: '200px 0px' },
      );
    }
  }

  // ─────────────────────── Çizim ───────────────────────

  private ciz(vm: HaritaVM, yeniAcilan: number | null): void {
    const icerik = this.icerik!;
    this.gozcu?.disconnect();
    icerik.replaceChildren();
    const bolumler: BolumDugumuVM[] = Array.from({ length: 40 }, (_, i) => vm.bolumler.find((x) => x.id === i + 1) ?? { id: i + 1, yildiz: 0, durum: 'kilitli' as const });
    const simdiki = simdikiBolum(vm);

    // Durağan çizim: üst pay, 8 mahalle (üstten alta), alt pay.
    const tanim = svg(`<svg class="f-harita-tanim" width="0" height="0" aria-hidden="true">${haritaTanimlari()}</svg>`);
    icerik.appendChild(tanim);
    icerik.appendChild(svg(`<svg class="f-bolge-svg" viewBox="0 0 ${HARITA_W} ${UST_PAY}" aria-hidden="true">${ustPayCiz()}</svg>`));
    const yollar = yolParcalari();
    const motifMahalle = new Map<number, Motif[]>();
    for (const mo of vm.motifler) motifMahalle.set(mo.mahalle, [...(motifMahalle.get(mo.mahalle) ?? []), mo.motif]);
    const catilar: { id: number; x: number; y: number }[] = [];
    for (let m = MAHALLE_SAYISI - 1; m >= 0; m--) {
      const c = bolgeCiz(m, bolumler, motifMahalle.get(m) ?? []);
      catilar.push(...c.catilar);
      // Bu mahallenin alt düğümlerinden çıkan fitil parçaları (k = id; id → id+1).
      let yol = '';
      for (let id = m * 5 + 1; id <= m * 5 + 5 && id < 40; id++) yol += this.yolParcasi(yollar[id].d, bolumler[id], id === yeniAcilan);
      const ust = bolgeUst(m);
      const e = svg(`<svg class="f-bolge-svg" viewBox="0 ${ust} ${HARITA_W} ${BOLGE_H}" aria-hidden="true"><g clip-path="url(#hb-yatay)">${c.svg}<g class="f-yol">${yol}</g></g></svg>`);
      icerik.appendChild(e);
    }
    const altPay = svg(`<svg class="f-bolge-svg" viewBox="0 ${HARITA_H - ALT_PAY} ${HARITA_W} ${ALT_PAY}" aria-hidden="true">${altPayCiz()}<g class="f-yol">${this.yolParcasi(yollar[0].d, bolumler[0], false)}</g></svg>`);
    icerik.appendChild(altPay);

    // Canlı katman
    const ogeler = h('div', { s: 'f-harita-ogeler' });
    icerik.appendChild(ogeler);

    // Kilitli mahalleler sisi (tek parça).
    const ilkKilitliMahalle = bolumler.findIndex((x) => x.durum === 'kilitli');
    if (ilkKilitliMahalle >= 0) {
      const m = Math.floor(ilkKilitliMahalle / 5);
      const ilkKilitliBolgede = bolumler[m * 5].durum === 'kilitli';
      const sinir = ilkKilitliBolgede ? bolgeUst(m) + BOLGE_H : bolgeUst(m);
      if (m < MAHALLE_SAYISI && sinir > UST_PAY) ogeler.appendChild(h('div', { s: 'f-harita-sis', css: { height: yuzdeY(sinir + 40) } }));
    }

    // Mahalle şeritleri + bölge kapları (görünürlük için)
    for (let m = 0; m < MAHALLE_SAYISI; m++) {
      const ust = bolgeUst(m);
      const kap = h('div', { s: 'f-harita-bolge', css: { top: yuzdeY(ust), height: yuzdeY(BOLGE_H) } });
      ogeler.appendChild(kap);
      this.gozcu?.observe(kap);
      const mh = MAHALLELER[m];
      const ilkBolum = bolumler[m * 5];
      const kilitli = ilkBolum.durum === 'kilitli';
      const yildiz = bolumler.slice(m * 5, m * 5 + 5).reduce((a, x) => a + x.yildiz, 0);
      ogeler.appendChild(
        h(
          'div',
          { s: `f-mahalle-serit${kilitli ? ' f-kilitli' : ''}`, css: { left: '50%', top: yuzdeY(ust + BOLGE_H - 28), '--vurgu': mh.vurgu } },
          h('span', { s: 'f-mahalle-ad', t: mh.ad }),
          kilitli ? h('small', null, ikon('kilit'), h('span', { t: M.kilitliMahalle(m * 5 + 1) })) : h('small', null, kucukYildiz(true), h('span', { s: 'f-sayi', t: `${yildiz}/15` })),
        ),
      );
      if (m === 4 && !kilitli) {
        // Ateş böcekleri
        for (let k = 0; k < 9; k++)
          kap.appendChild(h('i', { s: 'f-atesbocegi', css: { left: `${(8 + ((k * 37) % 84)).toFixed(0)}%`, top: `${(10 + ((k * 23) % 80)).toFixed(0)}%`, 'animation-delay': `${(-k * 0.7).toFixed(1)}s` } }));
      }
    }

    // Başlık tabelası (alt payda)
    const bas = baslangicKonumu();
    ogeler.appendChild(h('div', { s: 'f-harita-tabela', css: { left: '50%', top: yuzdeY(bas.y + 74) } }, h('span', { t: M.fenerKoyu })));

    // Çatı fişekleri (3★)
    for (const c of catilar) {
      ogeler.appendChild(
        h('span', { s: 'f-cati-fisek', 'aria-hidden': 'true', css: { left: yuzdeX(c.x), top: yuzdeY(c.y), '--r': ['#FF5FB4', '#FFB020', '#3AA8FF', '#2EE07A', '#B266FF'][c.id % 5] } }, Array.from({ length: 8 }, (_, i) => h('i', { css: { '--a': `${i * 45}deg` } }))),
      );
    }

    // Bölüm düğümleri
    for (const d of bolumler) {
      const k = dugumKonumu(d.id);
      const yeni = d.id === simdiki && yeniAcilan !== null;
      const dg = h(
        'button',
        {
          s: `f-dugum f-${d.durum}${yeni ? ' f-yeni' : ''}`,
          type: 'button',
          css: { left: yuzdeX(k.x), top: yuzdeY(k.y) },
          'aria-label': `${M.bolum} ${d.id}${d.durum === 'kilitli' ? `, ${M.kilitli}` : d.durum === 'acik' ? `, ${d.yildiz} yıldız` : `, ${M.buradasin}`}`,
          'data-id': String(d.id),
        },
        h('span', { s: 'f-dugum-ic' }, h('span', { s: 'f-dugum-no f-sayi', t: String(d.id) })),
        d.durum === 'acik' ? h('span', { s: 'f-dugum-yildiz' }, [0, 1, 2].map((i) => kucukYildiz(i < d.yildiz))) : null,
        d.durum === 'kilitli' ? h('span', { s: 'f-dugum-kilit' }, ikon('kilit')) : null,
      );
      dg.addEventListener('click', () => {
        if (d.durum === 'kilitli') {
          this.b.toast(M.kilitliBolum(simdiki));
          dg.classList.remove('f-salla');
          void dg.offsetWidth;
          dg.classList.add('f-salla');
          return;
        }
        this.sec({ tur: 'bolum', id: d.id });
      });
      ogeler.appendChild(dg);
      if (d.id === simdiki) {
        ogeler.appendChild(
          h(
            'div',
            { s: `f-buradasin${yeni ? ' f-yeni' : ''}`, 'aria-hidden': 'true', css: { left: yuzdeX(k.x), top: yuzdeY(k.y) } },
            h('span', { s: 'f-buradasin-ic' }, ustaSvg()),
          ),
        );
      }
    }

    // Usta Bölümleri (deniz fenerleri)
    vm.ustalar.forEach((u) => {
      const sira = USTA_BOLUM_IDLERI.indexOf(u.id as (typeof USTA_BOLUM_IDLERI)[number]) + 1;
      if (sira <= 0) return;
      const k = ustaKonumu(sira);
      const dg = h(
        'button',
        {
          s: `f-usta-dugum${u.acik ? ' f-acik' : ''}`,
          type: 'button',
          css: { left: yuzdeX(k.x), top: yuzdeY(k.y) },
          'aria-label': `${M.usta} ${sira}${u.acik ? '' : `, ${M.kilitliUsta(u.gerekenYildiz)}`}`,
        },
        svg(`<svg class="f-usta-fener" viewBox="-20 -40 40 56" aria-hidden="true">
          ${u.acik ? '<circle cx="0" cy="-24" r="18" fill="url(#ftl-koz)"/>' : ''}
          <path d="M-12 14h24l-4-8h-16z" fill="#2A2232"/>
          <path d="M-7 6-5-22h10l2 28z" fill="${u.acik ? '#EDE6F2' : '#4A4252'}"/>
          <path d="M-6.4-4h12.6M-5.6-14h11.4" stroke="${u.acik ? '#B8381C' : '#3A3040'}" stroke-width="4"/>
          <rect x="-6" y="-31" width="12" height="9" rx="2" fill="${u.acik ? '#FFF4C2' : '#2A2232'}"/>
          <path d="M-8-31 0-38 8-31z" fill="#3A2416"/></svg>`),
        h('span', { s: 'f-usta-etiket' }, h('span', { t: `U${sira}` }), u.acik ? h('span', { s: 'f-usta-yildiz' }, [0, 1, 2].map((i) => kucukYildiz(i < u.yildiz))) : h('small', { s: 'f-sayi' }, ikon('yildizDolu'), h('span', { t: String(u.gerekenYildiz) }))),
      );
      dg.addEventListener('click', () => {
        if (!u.acik) {
          this.b.toast(M.kilitliUsta(u.gerekenYildiz));
          return;
        }
        this.sec({ tur: 'usta', id: u.id });
      });
      ogeler.appendChild(dg);
    });

    this.ustCubuk(vm);
    this.altCubuk(vm, simdiki);
  }

  private yolParcasi(d: string, hedef: BolumDugumuVM, yeni: boolean): string {
    const yanik = hedef.durum !== 'kilitli';
    let s = `<path d="${d}" class="f-yol-golge" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="11" stroke-linecap="round" transform="translate(0 3)"/>
      <path d="${d}" fill="none" stroke="#1A0C04" stroke-width="9.5" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="${yanik ? 'url(#ftl-ip)' : '#3A2C3A'}" stroke-width="6.4" stroke-linecap="round"/>`;
    if (yanik)
      s += `<g class="${yeni ? 'f-yol-yeni' : 'f-yol-yanik'}">
        <path d="${d}" pathLength="1" fill="none" stroke="#FF9A2C" stroke-opacity=".32" stroke-width="16" stroke-linecap="round"/>
        <path d="${d}" pathLength="1" fill="none" stroke="#FFD15C" stroke-width="3" stroke-linecap="round" class="f-yol-kor"/></g>`;
    return s;
  }

  private ustCubuk(vm: HaritaVM): void {
    const bar = this.ustBar!;
    const yildiz = h('div', { s: 'f-harita-hap f-yildiz-hap', role: 'status', 'aria-label': `${M.toplamYildiz}: ${vm.toplamYildiz}` }, h('span', { s: 'f-hap-ikon' }, ikon('yildizDolu')), h('span', { s: 'f-sayi', t: sayi(vm.toplamYildiz) }));
    const seri = h(
      'div',
      { s: `f-harita-hap f-seri-hap${vm.seri.gun > 0 ? ' f-yanik' : ''}`, 'aria-label': `${M.fenerNobeti}: ${vm.seri.gun}` },
      alevSvg('f-hap-alev'),
      h('span', { s: 'f-sayi', t: String(vm.seri.gun) }),
    );
    const gunluk = h(
      'button',
      { s: `f-harita-hap f-gunluk-hap${vm.gunluk.acik ? '' : ' f-kilitli'}`, type: 'button', 'aria-label': `${M.gunlukGorev}: ${vm.gunluk.tamam}/${vm.gunluk.toplam}` },
      ikon('takvim'),
      h('span', { s: 'f-sayi', t: vm.gunluk.acik ? `${vm.gunluk.tamam}/${vm.gunluk.toplam}` : '' }),
      vm.gunluk.acik && vm.gunluk.tamam < vm.gunluk.toplam ? h('span', { s: 'f-nokta' }) : null,
    );
    gunluk.addEventListener('click', () => (vm.gunluk.acik ? this.sec({ tur: 'gunluk' }) : this.b.toast(M.gunlukKilitli)));
    const yardim = h('button', { s: 'f-yuvarlak f-harita-yardim', type: 'button', 'aria-label': M.nasilOynanir }, ikon('soru'));
    yardim.addEventListener('click', () => this.sec({ tur: 'nasil' }));
    bar.replaceChildren(h('div', { s: 'f-harita-ust-sol' }, yildiz, seri), h('div', { s: 'f-harita-ust-sag' }, gunluk, yardim));
  }

  private altCubuk(vm: HaritaVM, simdiki: number): void {
    const alt = this.kok!.querySelector('.f-harita-alt')!;
    alt.replaceChildren(
      this.sekme(M.gununSenligi, 'takvim', { tur: 'gunluk' }, vm.gunluk.acik && vm.gunluk.tamam < vm.gunluk.toplam, !vm.gunluk.acik),
      this.sekme(M.fisekDefteri, 'defter', { tur: 'defter' }, !!vm.defterYeni),
      this.sekme(M.istatistik, 'kupa', { tur: 'istatistik' }, !!vm.rozetYeni),
      this.sekme(M.ayarlar, 'ayar', { tur: 'ayarlar' }),
    );
    const hepsiBitti = vm.bolumler.length >= 40 && vm.bolumler.every((x) => x.durum === 'acik');
    this.oynaDg!.replaceChildren(ikon('oynat'), h('span', { t: hepsiBitti ? `${M.bolum} 40` : `${M.bolum} ${simdiki}` }));
  }

  private sekme(ad: string, ik: Parameters<typeof ikon>[0], secim: HaritaSecimi, nokta = false, kilitli = false): HTMLElement {
    const d = h(
      'button',
      { s: `f-harita-sekme${kilitli ? ' f-kilitli' : ''}`, type: 'button' },
      h('span', { s: 'f-harita-sekme-ikon' }, ikon(ik), nokta ? h('span', { s: 'f-nokta' }) : null),
      h('span', { s: 'f-harita-sekme-ad', t: ad }),
    );
    d.addEventListener('click', () => (kilitli ? this.b.toast(M.gunlukKilitli) : this.sec(secim)));
    return d;
  }

  private kaydirSimdiye(id: number, ilk: boolean, yeni: boolean): void {
    const k = this.kaydir;
    const ic = this.icerik;
    if (!k || !ic) return;
    const p = dugumKonumu(id);
    const olcek = ic.clientWidth / HARITA_W;
    const hedef = Math.max(0, ic.offsetTop + p.y * olcek - k.clientHeight * 0.56);
    if (this.b.az() || !ilk) {
      if (yeni && !this.b.az()) k.scrollTo({ top: hedef, behavior: 'smooth' });
      else k.scrollTop = hedef;
      return;
    }
    // Açılışta aşağıdan yukarı kısa bir süzülüş.
    k.scrollTop = Math.min(k.scrollHeight, hedef + k.clientHeight * 0.6);
    const bas = k.scrollTop;
    const t0 = performance.now();
    const sure = 900;
    const adim = (t: number) => {
      const u = Math.min(1, (t - t0) / sure);
      const e = 1 - Math.pow(1 - u, 3);
      k.scrollTop = bas + (hedef - bas) * e;
      if (u < 1) requestAnimationFrame(adim);
    };
    requestAnimationFrame(adim);
  }
}

/** Şimdiki (oynanacak) bölüm: 'simdiki' durumlu, yoksa son açık + 1. */
export function simdikiBolum(vm: HaritaVM): number {
  const s = vm.bolumler.find((x) => x.durum === 'simdiki');
  if (s) return s.id;
  let son = 0;
  for (const x of vm.bolumler) if (x.durum === 'acik') son = Math.max(son, x.id);
  return Math.min(40, son + 1);
}

