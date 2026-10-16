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
import { KASABA_ISLERI, MAHALLELER, USTA_BOLUM_IDLERI } from '../../app/katalog';
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
  bolgeGeo,
} from './cizim';
import type { Nokta } from './cizim';
import { isCapasi, sancakOgesi } from './susler';
import type { CanliOge, KutlamaCizimi, SusSecenek } from './susler';

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
  /** Mahalle bölge kapları (canlı süsler ve kutlama katmanı bunların içinde). */
  private bolgeKaplari: HTMLElement[] = [];
  /** Süren iş kutlaması (+ gerekiyorsa Mahalle şenliği); `kutlamaBitti` bekler. */
  private kutlamaSozu: Promise<void> | null = null;
  private senlikIptal: (() => void) | null = null;

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
    // (Kancalar §C.1) Önceki çizimde olmayıp şimdi yapılmış işler: kutlanır.
    const oncekiIsler = onceki?.kasaba ? new Set(onceki.kasaba.isler) : null;
    const yeniIsler = new Set(oncekiIsler ? (vm.kasaba?.isler ?? []).filter((x) => !oncekiIsler.has(x)) : []);
    const kutlamalar = this.ciz(vm, yeniAcilan, yeniIsler);
    this.kok!.classList.remove('f-gizli-ekran');
    if (kutlamalar.length) this.kutlamaSozu = this.kutlamalariOynat(kutlamalar, vm);
    else if (ilk || simdiki !== oncekiSimdiki) requestAnimationFrame(() => this.kaydirSimdiye(simdiki, ilk, yeniAcilan !== null));
    return new Promise((r) => {
      this.coz = (s) => {
        this.coz = null;
        r(s);
      };
    });
  }

  gizle(): void {
    this.coz?.({ tur: 'kapandi' });
    this.senlikIptal?.();
    if (!this.kok) return;
    this.kok.classList.add('f-gizli-ekran');
  }

  yokEt(): void {
    this.coz?.({ tur: 'kapandi' });
    this.senlikIptal?.();
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
      if (!v) return;
      if (sonsuzSirada(v)) this.sec({ tur: 'sonsuz' });
      else this.sec({ tur: 'bolum', id: simdikiBolum(v) });
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

  private ciz(vm: HaritaVM, yeniAcilan: number | null, yeniIsler: ReadonlySet<string> = new Set()): KutlamaBilgisi[] {
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
    // Kasaba süsleri (KANCALAR §B.6): yapılan işler; süslenen mahallede yapılmamışların hayaleti.
    const kasabaAcik = !!vm.kasaba?.acik;
    const yapilan = new Set(kasabaAcik ? vm.kasaba!.isler : []);
    const suslenen = kasabaAcik ? suslenenMahalle(yapilan) : -1;
    const canlilar = new Map<number, CanliOge[]>();
    const kutla = new Map<number, KutlamaCizimi[]>();
    for (let m = MAHALLE_SAYISI - 1; m >= 0; m--) {
      const sus: SusSecenek | undefined = kasabaAcik ? { yapilan, hayalet: m === suslenen, yeni: yeniIsler } : undefined;
      const c = bolgeCiz(m, bolumler, motifMahalle.get(m) ?? [], sus);
      catilar.push(...c.catilar);
      canlilar.set(m, [...c.canli, ...c.sancaklar.map((x) => sancakOgesi(x.id, x, m))]);
      if (c.kutla.length) kutla.set(m, c.kutla);
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
    this.bolgeKaplari = [];
    const muhurGorunur = bolumler[5]?.durum === 'acik';
    const kutlamalar: KutlamaBilgisi[] = [];
    for (let m = 0; m < MAHALLE_SAYISI; m++) {
      const ust = bolgeUst(m);
      const kap = h('div', { s: 'f-harita-bolge', css: { top: yuzdeY(ust), height: yuzdeY(BOLGE_H) } });
      ogeler.appendChild(kap);
      this.bolgeKaplari[m] = kap;
      this.gozcu?.observe(kap);
      const mh = MAHALLELER[m];
      const ilkBolum = bolumler[m * 5];
      const kilitli = ilkBolum.durum === 'kilitli';
      const yildiz = bolumler.slice(m * 5, m * 5 + 5).reduce((a, x) => a + x.yildiz, 0);
      const suslendi = !kilitli && mahalleSuslu(yapilan, m);
      // Mühür çipi "● 9/15" (İskele mühürsüz; mühürler 6. bölüm kazanılınca görünür).
      const muhur = bolumler.slice(m * 5, m * 5 + 5).reduce((a, x) => a + (x.muhur ?? 0), 0);
      const muhurCipi = muhurGorunur && !kilitli && m > 0 ? h('span', { s: 'f-serit-muhur', 'aria-label': `Mühür ${muhur}/15` }, h('i', { 'aria-hidden': 'true' }), h('span', { s: 'f-sayi', t: `${muhur}/15` })) : null;
      ogeler.appendChild(
        h(
          'div',
          { s: `f-mahalle-serit${kilitli ? ' f-kilitli' : ''}${suslendi ? ' f-suslendi' : ''}`, css: { left: '50%', top: yuzdeY(ust + BOLGE_H - 28), '--vurgu': mh.vurgu } },
          h('span', { s: 'f-mahalle-ad', t: mh.ad }),
          kilitli ? h('small', null, ikon('kilit'), h('span', { t: M.kilitliMahalle(m * 5 + 1) })) : h('small', null, kucukYildiz(true), h('span', { s: 'f-sayi', t: `${yildiz}/15` }), muhurCipi),
        ),
      );
      if (!kilitli) {
        for (const o of canlilar.get(m) ?? []) kap.appendChild(canliOge(o, ust, yeniIsler.has(o.sahip)));
        for (const k of kutla.get(m) ?? []) {
          kap.appendChild(svg(`<svg class="f-sus-kutla" viewBox="0 ${ust} ${HARITA_W} ${BOLGE_H}" preserveAspectRatio="none" aria-hidden="true">${k.svg}</svg>`));
          kutlamalar.push({ ...k, m, mahalleTamam: mahalleSuslu(yapilan, m) && [...yeniIsler].some((x) => x.startsWith(`${mh.id}.`)) });
        }
      }
      if (m === 4 && !kilitli) {
        // Ateş böcekleri
        for (let k = 0; k < 9; k++)
          kap.appendChild(h('i', { s: 'f-atesbocegi', css: { left: `${(8 + ((k * 37) % 84)).toFixed(0)}%`, top: `${(10 + ((k * 23) % 80)).toFixed(0)}%`, 'animation-delay': `${(-k * 0.7).toFixed(1)}s` } }));
      }
    }

    // Başlık tabelası (alt payda); "İskele tabelası" işi yapıldıysa ampullerle ışıl ışıl (§B.3).
    const bas = baslangicKonumu();
    const tabelaIsikli = yapilan.has('iskele.tabela');
    const tabela = h(
      'div',
      { s: `f-harita-tabela${tabelaIsikli ? ' f-isikli' : ''}${yeniIsler.has('iskele.tabela') ? ' f-yeni' : ''}`, css: { left: '50%', top: yuzdeY(bas.y + 74) } },
      h('span', { t: M.fenerKoyu }, tabelaIsikli ? h('b', { s: 'f-tabela-ampul', 'aria-hidden': 'true' }, tabelaAmpulleri().map((p, i) => h('i', { css: { left: `${p.x.toFixed(1)}%`, top: `${p.y.toFixed(1)}%`, '--i': String(i) } }))) : null),
    );
    ogeler.appendChild(tabela);
    if (tabelaIsikli) this.gozcu?.observe(tabela);

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
    return kutlamalar;
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
    const etiket = sonsuzSirada(vm) ? `${M.sonsuzSenlik} ${vm.sonsuz!.siradaki}` : hepsiBitti ? `${M.bolum} 40` : `${M.bolum} ${simdiki}`;
    this.oynaDg!.replaceChildren(ikon('oynat'), h('span', { t: etiket }));
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

  // ─────────────────────── Kasaba kutlamaları ───────────────────────

  /**
   * Süren iş kutlaması ve (mahalle 6/6 olduysa) Mahalle şenliği bitince
   * çözülür; kutlama yoksa hemen. Uygulama Defter kartını bundan sonra açar.
   */
  kutlamaBitti(): Promise<void> {
    return this.kutlamaSozu ?? Promise.resolve();
  }

  /** Haritayı bir noktaya (küresel) kaydırır; nokta görünür bandın ortasına gelir. */
  private kaydirYere(p: Nokta, yumusak: boolean): void {
    const k = this.kaydir;
    const ic = this.icerik;
    if (!k || !ic) return;
    const olcek = ic.clientWidth / HARITA_W;
    let ust = 64;
    try {
      ust = parseFloat(getComputedStyle(k).paddingTop) || 64;
    } catch {
      /* varsayılan */
    }
    const altKap = k.parentElement?.querySelector<HTMLElement>('.f-harita-alt-kap');
    const bantAlt = k.clientHeight - (altKap?.offsetHeight ?? 160) - 10;
    const hedef = Math.max(0, Math.min(k.scrollHeight - k.clientHeight, ic.offsetTop + p.y * olcek - (ust + Math.max(0, bantAlt - ust) * 0.5)));
    if (yumusak && !this.b.az()) k.scrollTo({ top: hedef, behavior: 'smooth' });
    else k.scrollTop = hedef;
  }

  /**
   * İş kutlaması (KANCALAR §C.1): harita çapaya kayar, ışıklar sırayla yanar
   * (CSS, `.f-sus-kutla .f-sl`), ışık halkası + parıltılar + küçük fişek,
   * ses ve titreşim, sakin balonu. Mahalle 6/6 olduysa ardından şenlik.
   */
  private async kutlamalariOynat(liste: KutlamaBilgisi[], vm: HaritaVM): Promise<void> {
    const az = this.b.az();
    for (const k of liste) {
      if (this.vm !== vm) return;
      this.kaydirYere(k.capa, true);
      const kap = this.bolgeKaplari[k.m];
      if (!kap) continue;
      const ust = bolgeUst(k.m);
      const yer = { left: yuzdeX(k.capa.x), top: `${(((k.capa.y - ust) / BOLGE_H) * 100).toFixed(3)}%` };
      // Kutlama katmanı (fişek, halka, parıltı) — ışıklar yanmaya başlayınca.
      const fisek = h('span', { s: 'f-sus-fisek', 'aria-hidden': 'true', css: yer }, [
        h('b', { s: 'f-sus-halka' }),
        ...Array.from({ length: 12 }, (_, i) => h('i', { css: { '--a': `${i * 30}deg`, '--r': ['#FFD15C', '#FF5FB4', '#3AA8FF', '#2EE07A', '#FFB020', '#B266FF'][i % 6] } })),
      ]);
      kap.appendChild(fisek);
      const is = KASABA_ISLERI.find((x) => x.id === k.id);
      await this.bekle(az ? 0 : 520);
      this.b.ses('parca');
      this.b.titret(20);
      if (is) {
        this.b.duyur(`${is.ad} yapıldı`);
        const soz = h('div', { s: 'f-sus-soz', role: 'status', css: { left: `${Math.max(22, Math.min(78, (k.capa.x / HARITA_W) * 100)).toFixed(2)}%`, top: yuzdeY(k.capa.y - 30) } }, h('span', { t: is.sakin }));
        this.icerik?.querySelector('.f-harita-ogeler')?.appendChild(soz);
        setTimeout(() => soz.remove(), az ? 2400 : 3200);
      }
      await this.bekle(az ? 400 : Math.min(2400, 900 + k.isik * 70));
      setTimeout(() => fisek.remove(), 1800);
      if (k.mahalleTamam) await this.senlik(k.m);
    }
  }

  private bekle(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Mahalle şenliği (6/6, §B.5): harita mahalleye kayar; mahallenin süsleri
   * hızla yanıp söner, görünür gök şeridinde fişekler patlar, altın şeritte
   * "Mahalle şenliği" yazar. 6 sn; dokunuş atlar. Hareketi azaltta kısa.
   */
  senlik(m: number): Promise<void> {
    const kap = this.bolgeKaplari[m];
    const kok = this.kok;
    if (!kap || !kok) return Promise.resolve();
    this.senlikIptal?.();
    const az = this.b.az();
    this.kaydirYere({ x: 200, y: bolgeUst(m) + BOLGE_H * 0.45 }, true);
    kap.classList.add('f-senlik');
    const katman = h('div', { s: 'f-senlik-katman', 'aria-hidden': 'true' });
    const bant = h('div', { s: 'f-senlik-bant', role: 'status' }, h('small', { t: MAHALLELER[m]?.ad ?? '' }), h('span', { t: 'Mahalle şenliği' }));
    kok.appendChild(katman);
    kok.appendChild(bant);
    this.b.duyur(`${MAHALLELER[m]?.ad ?? ''} mahalle şenliği`);
    this.b.titret([30, 20, 60]);
    this.b.ses('kazandin');
    const renk = ['#FF5FB4', '#FFB020', '#3AA8FF', '#2EE07A', '#B266FF', '#FF4D4D', MAHALLELER[m]?.vurgu ?? '#FFD15C'];
    let n = 0;
    const patlat = () => {
      // Görünür gök şeridi: üst çubuğun altı → alt düğmelerin üstü (HUD yok).
      const ustBar = this.ustBar?.getBoundingClientRect();
      const alt = kok.querySelector('.f-harita-alt-kap')?.getBoundingClientRect();
      const kr = kok.getBoundingClientRect();
      const y0 = (ustBar ? ustBar.bottom : kr.top + 70) - kr.top + 16;
      const y1 = Math.max(y0 + 40, (alt ? alt.top : kr.bottom - 170) - kr.top - 140);
      const u = (n * 0.618 + 0.11) % 1;
      const w = (n * 0.382 + 0.07) % 1;
      const p = h('span', { s: 'f-senlik-fisek', css: { left: `${(8 + u * 84).toFixed(1)}%`, top: `${(y0 + w * (y1 - y0)).toFixed(0)}px`, '--r': renk[n % renk.length], '--s': `${(0.8 + ((n * 7) % 5) * 0.12).toFixed(2)}` } }, Array.from({ length: 14 }, (_, i) => h('i', { css: { '--a': `${i * (360 / 14)}deg` } })));
      katman.appendChild(p);
      setTimeout(() => p.remove(), 1500);
      n++;
    };
    return new Promise((coz) => {
      const zamanlar: ReturnType<typeof setTimeout>[] = [];
      let bitti = false;
      const bitir = () => {
        if (bitti) return;
        bitti = true;
        zamanlar.forEach(clearTimeout);
        kok.removeEventListener('pointerdown', bitir);
        kap.classList.remove('f-senlik');
        bant.classList.add('f-cik');
        katman.classList.add('f-cik');
        setTimeout(() => {
          bant.remove();
          katman.remove();
        }, 400);
        this.senlikIptal = null;
        coz();
      };
      this.senlikIptal = bitir;
      setTimeout(() => kok.addEventListener('pointerdown', bitir), 150);
      const sure = az ? 1800 : 6000;
      if (!az) for (let t = 300, k = 0; t < sure - 700; t += 320 + (k % 3) * 140, k++) zamanlar.push(setTimeout(patlat, t));
      zamanlar.push(setTimeout(bitir, sure));
    });
  }

  private kaydirSimdiye(id: number, ilk: boolean, yeni: boolean): void {
    const k = this.kaydir;
    const ic = this.icerik;
    if (!k || !ic) return;
    const p = dugumKonumu(id);
    const olcek = ic.clientWidth / HARITA_W;
    // Görünür bant: üst çubuk ile alttaki "Bölüm N" + menü arası. Şimdiki düğüm bandın
    // ortasında; bir önceki düğümün yıldızları (mahallenin ilk iki bölümünde mahalle
    // tabelası da) alt çubuğun ÜSTÜNDE kalır (ilk harita görünümü, 360×640).
    let ust = 64;
    try {
      ust = parseFloat(getComputedStyle(k).paddingTop) || 64;
    } catch {
      /* varsayılan */
    }
    const altKap = k.parentElement?.querySelector<HTMLElement>('.f-harita-alt-kap');
    const bantAlt = k.clientHeight - (altKap?.offsetHeight ?? 160) - 10;
    const m = Math.floor((id - 1) / 5);
    const altNokta = id === 1 ? baslangicKonumu().y + 74 + 48 : (id - 1) % 5 <= 1 ? bolgeUst(m) + BOLGE_H + 18 : dugumKonumu(Math.max(1, id - 1)).y + 56;
    const enCok = Math.max(0, k.scrollHeight - k.clientHeight);
    const ortada = ic.offsetTop + p.y * olcek - (ust + Math.max(0, bantAlt - ust) * 0.55);
    const altGorunur = ic.offsetTop + altNokta * olcek - bantAlt;
    const hedef = Math.min(enCok, Math.max(0, ortada, Math.min(altGorunur, ic.offsetTop + p.y * olcek - ust - 96)));
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

/** (P5 ek) 40 bölüm bitti ve Sonsuz Şenlik açık: büyük düğme ona gider (§10.7). */
function sonsuzSirada(vm: HaritaVM): boolean {
  return !!vm.sonsuz?.acik && vm.bolumler.length >= 40 && vm.bolumler.every((x) => x.durum === 'acik');
}

/** Şimdiki (oynanacak) bölüm: 'simdiki' durumlu, yoksa son açık + 1. */
export function simdikiBolum(vm: HaritaVM): number {
  const s = vm.bolumler.find((x) => x.durum === 'simdiki');
  if (s) return s.id;
  let son = 0;
  for (const x of vm.bolumler) if (x.durum === 'acik') son = Math.max(son, x.id);
  return Math.min(40, son + 1);
}


interface KutlamaBilgisi extends KutlamaCizimi {
  m: number;
  /** Bu iş mahalleyi 6/6 süsledi: ardından Mahalle şenliği. */
  mahalleTamam: boolean;
}

const MAHALLE_ISLERI: string[][] = MAHALLELER.map((mh) => KASABA_ISLERI.filter((x) => x.id.startsWith(`${mh.id}.`)).map((x) => x.id));

/** Mahallenin bütün işleri yapıldı mı (6/6). */
function mahalleSuslu(yapilan: ReadonlySet<string>, m: number): boolean {
  const isler = MAHALLE_ISLERI[m] ?? [];
  return isler.length > 0 && isler.every((x) => yapilan.has(x));
}

/** Kasabada süslenen mahalle (ilk bitmemiş); hepsi bittiyse −1. */
function suslenenMahalle(yapilan: ReadonlySet<string>): number {
  for (let m = 0; m < MAHALLELER.length; m++) if (!mahalleSuslu(yapilan, m)) return m;
  return -1;
}

/**
 * Canlı süs öğesi: kutusu mahalle kabının yüzdesiyle yerleşir (harita
 * genişliği değişince SVG ile birlikte ölçeklenir), içi küçük bir SVG.
 * Yeni yapılan işin öğeleri, ışıkları sırayla yanarken belirir (`f-sus-yeni`).
 */
function canliOge(o: CanliOge, ust: number, yeni: boolean): HTMLElement {
  const css: Record<string, string> = {
    left: `${((o.x / HARITA_W) * 100).toFixed(3)}%`,
    top: `${(((o.y - ust) / BOLGE_H) * 100).toFixed(3)}%`,
    width: `${((o.w / HARITA_W) * 100).toFixed(3)}%`,
    'aspect-ratio': `${o.w.toFixed(2)} / ${o.h.toFixed(2)}`,
  };
  if (o.koken) css['--o'] = o.koken;
  if (o.gecikme !== undefined) css['--g'] = `${o.gecikme.toFixed(2)}s`;
  if (o.sure !== undefined) css['--s'] = `${o.sure.toFixed(2)}s`;
  if (o.dy !== undefined) css['--dy'] = `${((-o.dy / o.h) * 100).toFixed(0)}%`;
  if (yeni) css['--gec'] = `${(0.55 + (o.sira ?? 0) * 0.07).toFixed(2)}s`;
  const e = h('span', { s: `f-sus f-sus-${o.tur}${yeni ? ' f-sus-yeni' : ''}`, 'aria-hidden': 'true', css });
  e.appendChild(svg(`<svg viewBox="0 0 ${o.w.toFixed(2)} ${o.h.toFixed(2)}" overflow="visible">${o.ic}</svg>`));
  return e;
}

/** Bir işin haritadaki çapası (küresel), harita kaydırması için. */
export function kasabaIsCapasi(id: string): Nokta | null {
  const is = KASABA_ISLERI.find((x) => x.id === id);
  return is ? isCapasi(id, bolgeGeo(is.mahalle)) : null;
}

/** Tabela çevresinde 22 ampul (yüzde konum): üst ve altta 8'er, yanlarda 3'er. */
function tabelaAmpulleri(): { x: number; y: number }[] {
  const p: { x: number; y: number }[] = [];
  for (let i = 0; i < 8; i++) p.push({ x: 4 + (92 * i) / 7, y: 0 });
  for (let i = 0; i < 3; i++) p.push({ x: 100, y: 25 + 25 * i });
  for (let i = 0; i < 8; i++) p.push({ x: 96 - (92 * i) / 7, y: 100 });
  for (let i = 0; i < 3; i++) p.push({ x: 0, y: 75 - 25 * i });
  return p;
}
