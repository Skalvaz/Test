/**
 * Kazandın (GDD §12.3 #6, §9.5) ve Kaybettin (#7).
 *
 * Kazandın, kâğıt çekmenin sonunda tuvalde duran tablonun ÇEVRESİNE
 * yerleşir: üstte başlık, tablonun alt kenarında yıldız mühürleri (300 ms
 * arayla basılır), altta sayarak artan puan, nadirlik etiketi, "Galeriye
 * eklendi", eski tablo varsa [Bunu sakla | Eskisini koru], "Sıradaki: X!",
 * [Tekrar oyna] [Devam].
 *
 * Kaybettin tahtayı örtmez: üst bantta "Az kaldı!" + ilerleme çubuğu +
 * eksik hedef + soluk yarım tablo; alt bantta büyük [Tekrar dene] (< 1 sn)
 * ve [Haritaya dön]. Tahtada "Bu hamle kazandırırdı" hayaleti oynarken
 * üstte şerit görünür. 3. ardışık kayıpta Usta'nın Eli şeridi.
 */
import { bekle, h, sayarakYaz, svg } from '../dom';
import { YILDIZ_BOS, YILDIZ_DOLU } from '../ikonlar';
import { M, sayi } from '../metinler';
import { NADIRLIK } from '../../app/katalog';
import { dugme, tabloResmi } from './ortak';
import type { EkranYoneticisi } from './cekirdek';
import type { KaybettinSecimi, KaybettinVM, KazandinSecimi, KazandinVM } from '../tipler';
import type { Yerlesim } from '../yerlesim';

export interface SonEk {
  W: number;
  H: number;
  guvenliAlt: number;
  guvenliUst: number;
  azalt: boolean;
  /** Yıldız mührü basıldı (ses + altın tozu; ekran koordinatı). */
  muhur(i: number, x: number, y: number): void;
}

export function kazandinEkrani(y: EkranYoneticisi, vm: KazandinVM, ek: SonEk): Promise<KazandinSecimi> {
  return y.ac<KazandinSecimi>({ sinif: 'e-kazandin', geri: { secim: 'devam', tabloSakla: false } }, (bitir, kok) => {
    const W = ek.W;
    const H = ek.H;
    const t = vm.tablo ?? { x: W * 0.1, y: H * 0.12, w: W * 0.8, h: H * 0.5 };
    let sakla = !vm.eskiTablo || vm.puan >= vm.eskiPuan;

    // Başlık (tablonun üstü).
    const ustAlan = t.y - ek.guvenliUst;
    const baslik = h(
      'div',
      { s: `e-kz-baslik${ustAlan < 64 ? ' dar' : ''}`, css: { bottom: `${H - t.y + 6}px` } },
      h('h2', { t: M.kazandin }),
      h('small', { t: `${vm.atolyeAd} · ${vm.bolumId} · ${vm.ad}` }),
    );

    // Yıldız mühürleri (tablonun alt kenarında).
    const muhurler = h('div', { s: 'e-kz-muhurler', css: { top: `${t.y + t.h - 30}px` } });
    const muhurEl: HTMLElement[] = [];
    for (let i = 0; i < 3; i++) {
      const m = h('div', { s: `e-muhur${i === 1 ? ' orta' : ''}` });
      m.appendChild(svg(i < vm.yildiz ? YILDIZ_DOLU : YILDIZ_BOS));
      muhurEl.push(m);
      muhurler.appendChild(m);
    }

    // Alt bölüm.
    const puanEl = h('b', { s: 'e-kz-puan-sayi', t: '0' });
    const etiket = h(
      'div',
      { s: 'e-kz-etiket' },
      h('span', { s: `e-nadirlik n${vm.nadirlik}`, t: NADIRLIK[vm.nadirlik] }),
      h('span', { s: 'e-kz-galeri', t: vm.ilkTablo ? M.ilkTablo : vm.eskiTablo ? '' : M.galeriyeEklendi }),
    );
    let secim: HTMLElement | null = null;
    if (vm.eskiTablo) {
      const yeniB = h('button', { s: 'e-seg', type: 'button', role: 'radio' }, h('span', { t: M.buTablo }));
      const eskiB = h('button', { s: 'e-seg', type: 'button', role: 'radio' }, tabloResmi(vm.eskiTablo, 20, 30, 'e-seg-tablo'), h('span', { t: M.eskiTablo }));
      const guncelle = () => {
        yeniB.setAttribute('aria-checked', String(sakla));
        eskiB.setAttribute('aria-checked', String(!sakla));
      };
      yeniB.addEventListener('click', (e) => {
        e.stopPropagation();
        sakla = true;
        guncelle();
      });
      eskiB.addEventListener('click', (e) => {
        e.stopPropagation();
        sakla = false;
        guncelle();
      });
      guncelle();
      secim = h('div', { s: 'e-segmentli e-kz-secim', role: 'radiogroup', 'aria-label': 'Galeriye hangi tablo' }, yeniB, eskiB);
    }
    const devam = dugme(M.devam, { tur: 'ana', ikon: 'ok', on: () => bitir({ secim: 'devam', tabloSakla: sakla }) });
    devam.setAttribute('data-odak', '');
    const alt = h(
      'div',
      { s: 'e-kz-alt', css: { top: `${t.y + t.h + 30}px`, bottom: `${ek.guvenliAlt + 10}px` } },
      h('div', { s: 'e-kz-puan' }, puanEl, h('small', { t: M.puan })),
      etiket,
      secim,
      vm.siradaki ? h('div', { s: 'e-kz-siradaki', t: vm.siradaki }) : null,
      h('div', { s: 'e-dugmeler' }, dugme(M.tekrarOyna, { tur: 'ikincil', ikon: 'yeniden', on: () => bitir({ secim: 'tekrar', tabloSakla: sakla }) }), devam),
    );
    if (ek.H - (t.y + t.h) < 190) alt.classList.add('dar');

    // Sıra: başlık → mühürler → puan → etiket.
    void (async () => {
      await bekle(ek.azalt ? 0 : 160);
      for (let i = 0; i < 3; i++) {
        if (i < vm.yildiz) {
          muhurEl[i].classList.add('basildi');
          const r = muhurEl[i].getBoundingClientRect();
          const kr = kok.getBoundingClientRect();
          ek.muhur(i, r.left - kr.left + r.width / 2, r.top - kr.top + r.height / 2);
        } else muhurEl[i].classList.add('bos');
        await bekle(ek.azalt ? 0 : 300);
      }
      await sayarakYaz(puanEl, vm.puan, 900, sayi, ek.azalt);
      etiket.classList.add('gor');
    })();
    return [baslik, muhurler, alt];
  });
}

export interface KaybettinKontrol {
  /** "Bu hamle kazandırırdı" şeridi. */
  hayalet(goster: boolean): void;
}

export function kaybettinEkrani(y: EkranYoneticisi, vm: KaybettinVM, yer: Yerlesim, kontrol: Partial<KaybettinKontrol>): Promise<KaybettinSecimi> {
  return y.ac<KaybettinSecimi>({ sinif: `e-kaybettin ${yer.kip}`, geri: 'harita' }, (bitir) => {
    const yuzde = Math.round(vm.yuzde * 100);
    const cubuk = h('div', { s: 'e-kb-cubuk', role: 'progressbar', 'aria-valuenow': String(yuzde), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { css: { '--o': String(vm.yuzde) } }), h('b', { t: `%${yuzde}` }));
    const bilgi = h('div', { s: 'e-kb-bilgi' }, h('h2', { t: M.azKaldi }), cubuk, vm.eksik ? h('p', { s: 'e-kb-eksik', t: vm.eksik }) : null);
    const ust = h('div', { s: 'e-kb-ust' });
    if (vm.yarimTablo) {
      const t = tabloResmi(() => vm.yarimTablo!, 44, 66, 'e-kb-tablo');
      ust.appendChild(h('div', { s: 'e-kb-tablo-kap', 'aria-hidden': 'true' }, t));
    }
    ust.appendChild(bilgi);
    const tekrar = dugme(M.tekrarDene, { tur: 'ana', ikon: 'yeniden', on: () => bitir('tekrar') });
    tekrar.setAttribute('data-odak', '');
    const alt = h('div', { s: 'e-kb-alt' }, dugme(M.haritayaDon, { tur: 'ikincil', ikon: 'harita', on: () => bitir('harita') }), tekrar);
    const serit = h('div', { s: 'e-kb-hayalet', t: M.kazandirirdi, 'aria-live': 'polite' });
    const usta = vm.ustaEli
      ? h(
          'div',
          { s: 'e-kb-usta' },
          h('div', null, h('b', { t: M.ustaEli }), h('small', { t: M.ustaEliMetin })),
          dugme(M.ustaEliDugme, { tur: 'ana', sinif: 'kucuk', on: () => bitir('ustaEli') }),
        )
      : null;
    kontrol.hayalet = (g) => serit.classList.toggle('gor', g);
    const yerles = (e: HTMLElement, r: { x: number; y: number; w: number; h: number }) => {
      e.style.left = `${r.x}px`;
      e.style.top = `${r.y}px`;
      e.style.width = `${r.w}px`;
      e.style.height = `${r.h}px`;
    };
    if (yer.kip === 'dikey') {
      yerles(ust, { x: 0, y: 0, w: yer.W, h: yer.tahta.y });
      yerles(alt, yer.alt);
      serit.style.top = `${yer.tahta.y + 8}px`;
      if (usta) usta.style.bottom = `${yer.alt.h + 8}px`;
      const l: HTMLElement[] = [ust, serit, alt];
      if (usta) l.splice(2, 0, usta);
      return l;
    }
    const panel = h('div', { s: 'e-kb-panel e-kart' }, ust, usta, alt);
    yerles(panel, { ...yer.panel!, h: 0 });
    panel.style.height = 'auto';
    serit.style.top = `${yer.tahta.y + 16}px`;
    serit.style.left = `${yer.tahta.x + yer.tahta.w / 2}px`;
    return [panel, serit];
  });
}
