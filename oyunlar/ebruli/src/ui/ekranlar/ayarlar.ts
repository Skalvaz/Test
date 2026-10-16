/**
 * Ayarlar (GDD §12.3 #9): efekt sesi ve müzik (kaydırıcı), ortam,
 * titreşim, hareketi azalt, hız, palet, motifler, tarif şeridi, ipuçları,
 * Nasıl oynanır, ilerlemeyi sıfırla (iki aşamalı SAYFA İÇİ onay; confirm
 * yok), Hakkında. Değişiklik anında `degisti` ile bildirilir.
 */
import { h, svg } from '../dom';
import { IKON, RUMI } from '../ikonlar';
import { M } from '../metinler';
import { dugme } from './ortak';
import type { EkranYoneticisi } from './cekirdek';
import type { AyarlarVM } from '../tipler';
import type { Ayarlar } from '../../meta/kayit';

export interface AyarlarGeri {
  degisti(yama: Partial<Ayarlar>): void;
  nasil(): void;
  sifirla(): void;
}

function satir(ikon: keyof typeof IKON, ad: string, kontrol: HTMLElement): HTMLElement {
  const i = svg(IKON[ikon]);
  i.classList.add('e-ayar-ikon');
  return h('div', { s: 'e-ayar' }, i, h('span', { s: 'e-ayar-ad', t: ad }), kontrol);
}

function anahtar(ad: string, deger: boolean, fn: (v: boolean) => void): HTMLButtonElement {
  const b = h('button', { s: 'e-anahtar', type: 'button', role: 'switch', 'aria-label': ad, 'aria-checked': String(deger) }, h('i'));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const v = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(v));
    fn(v);
  });
  return b;
}

function segment<T extends string | number>(ad: string, secenekler: [T, string][], deger: T, fn: (v: T) => void): HTMLElement {
  const k = h('div', { s: 'e-segmentli', role: 'radiogroup', 'aria-label': ad });
  const dugmeler = secenekler.map(([v, metin]) => {
    const b = h('button', { s: 'e-seg', type: 'button', role: 'radio', 'aria-checked': String(v === deger), t: metin });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      dugmeler.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      fn(v);
    });
    k.appendChild(b);
    return b;
  });
  return k;
}

function kaydirici(ad: string, deger: number, fn: (v: number) => void): HTMLInputElement {
  const i = h('input', { s: 'e-kaydirici', type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(deger * 100)), 'aria-label': ad });
  const boya = () => i.style.setProperty('--o', `${i.value}%`);
  boya();
  i.addEventListener('input', () => {
    boya();
    fn(Number(i.value) / 100);
  });
  i.addEventListener('pointerdown', (e) => e.stopPropagation());
  return i;
}

export function ayarlarEkrani(y: EkranYoneticisi, vm: AyarlarVM, geri: AyarlarGeri): Promise<void> {
  return y.ac<void>({ sinif: 'e-ayarlar e-sayfali', geri: undefined }, (bitir) => {
    const d = (yama: Partial<Ayarlar>) => geri.degisti(yama);
    const az = vm.hareketiAzalt ?? vm.sistemAzHareket;
    const sifirKap = h('div', { s: 'e-sifirla' });
    const sifirIlk = (): void => {
      sifirKap.textContent = '';
      sifirKap.appendChild(dugme(M.sifirla, { tur: 'hayalet', ikon: 'sil', sinif: 'e-tehlike', on: sifirOnay }));
    };
    const sifirOnay = (): void => {
      sifirKap.textContent = '';
      sifirKap.append(
        h('p', { s: 'e-sifir-soru', t: M.sifirlaEmin }),
        h(
          'div',
          { s: 'e-dugmeler' },
          dugme(M.sifirlaVazgec, { tur: 'ikincil', on: sifirIlk }),
          dugme(M.sifirlaEvet, {
            tur: 'ana',
            sinif: 'e-tehlike-ana',
            on: () => {
              geri.sifirla();
              sifirKap.textContent = '';
              sifirKap.appendChild(h('p', { s: 'e-sifir-soru', t: M.sifirlandi }));
            },
          }),
        ),
      );
    };
    sifirIlk();
    const kapat = dugme('', { tur: 'yuvarlak', ikon: 'kapat', ad: M.kapat, sinif: 'e-kose-kapat', on: () => bitir() });
    const r = svg(RUMI);
    r.classList.add('e-rumi');
    const tamam = dugme(M.kapat, { tur: 'ana', on: () => bitir() });
    tamam.setAttribute('data-odak', '');
    return h(
      'div',
      { s: 'e-sayfa-ic' },
      kapat,
      h('h2', { t: M.ayarlar }),
      r,
      h(
        'div',
        { s: 'e-ayar-listesi' },
        satir('ses', M.efektSesi, kaydirici(M.efektSesi, vm.sfx, (v) => d({ sfx: v }))),
        satir('muzik', M.muzik, kaydirici(M.muzik, vm.muzik, (v) => d({ muzik: v }))),
        satir('dalga', M.ortam, anahtar(M.ortam, vm.ortam, (v) => d({ ortam: v }))),
        satir('titresim', M.titresim, anahtar(M.titresim, vm.titresim, (v) => d({ titresim: v }))),
        satir('hareket', M.hareketiAzalt, anahtar(M.hareketiAzalt, az, (v) => d({ hareketiAzalt: v }))),
        satir('hiz', M.hiz, segment<number>(M.hiz, [[1, M.hizNormal], [1.5, M.hizHizli]], vm.hiz, (v) => d({ hiz: v === 1.5 ? 1.5 : 1 }))),
        satir('palet', M.palet, segment(M.palet, [['standart', M.paletStandart], ['renkKoru', M.paletRenkKoru]], vm.palet, (v) => d({ palet: v }))),
        satir('motif', M.motifler, anahtar(M.motifler, vm.motifler, (v) => d({ motifler: v }))),
        satir('tarif', M.tarifSeridi, segment(M.tarifSeridi, [['her', M.tarifHer], ['ilk', M.tarifIlk]], vm.tarifSeridi, (v) => d({ tarifSeridi: v }))),
        satir('ipucu', M.ipuclari, anahtar(M.ipuclari, vm.ipuclari, (v) => d({ ipuclari: v }))),
      ),
      h('div', { s: 'e-dugmeler tek' }, dugme(M.nasil, { tur: 'ikincil', ikon: 'soru', on: () => geri.nasil() })),
      vm.kayitBellek ? h('p', { s: 'e-not uyari', t: M.kayitBellek }) : null,
      sifirKap,
      h('details', { s: 'e-hakkinda' }, h('summary', { t: M.hakkinda }), h('p', { t: M.hakkindaMetin })),
      h('div', { s: 'e-dugmeler tek' }, tamam),
    );
  });
}
