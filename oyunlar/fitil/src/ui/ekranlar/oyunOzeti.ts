/**
 * Oyun özeti (Ayarlar > Oyun özeti): aile testinde oyuncu bu ekranın
 * görüntüsünü gönderir. Üstte altı kutu (ilk açılış, oturum, gün, en
 * yüksek bölüm, süre, sürüm), altta en son oynanan ana bölümlerin tablosu
 * (en çok takılınan satır vurgulu). Veri yalnız bu cihazda; ağ isteği yok.
 * Ayarlar'ın üstünde açılır; Kapat (ya da Esc) Ayarlar'a döner.
 */
import { h } from '../dom';
import { kucukYildiz } from '../ikonlar';
import { MO, sayi } from '../metinler';
import { secimSozu, type Baglam } from '../cekirdek';
import { dakikaSaniye } from '../../app/oyunOzeti';
import type { OyunOzetiBolumu, OyunOzetiVM } from '../tipler';

export function oyunOzetiEkrani(b: Baglam, vm: OyunOzetiVM): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  const icerik = h(
    'div',
    { s: 'f-oo' },
    vm.bos
      ? h('p', { s: 'f-oo-bos', t: MO.bos })
      : [
          h(
            'div',
            { s: 'f-oo-izgara' },
            vm.satirlar.map((s) => h('div', { s: `f-oo-kutu f-oo-${s.anahtar}` }, h('strong', { s: 'f-sayi', t: s.deger }), h('span', { t: s.etiket }))),
          ),
          h(
            'section',
            { s: 'f-oo-bolumler' },
            h('h3', { s: 'f-etiket', t: vm.oynananBolum > vm.bolumler.length ? MO.sonBolumler(vm.bolumler.length) : MO.bolumler }),
            vm.bolumler.length ? tablo(vm.bolumler) : h('p', { s: 'f-oo-bos', t: MO.bolumYok }),
          ),
        ],
    h('p', { s: 'f-oo-not', t: MO.not }),
  );
  const kapat = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: MO.baslik, seritTur: 'gece', genislik: 'genis', kapatDugmesi: true, onIptal: kapat, sinif: 'f-oyun-ozeti' });
  return { soz, kapat };
}

function tablo(bolumler: readonly OyunOzetiBolumu[]): HTMLElement {
  const th = (metin: string) => h('th', { scope: 'col', t: metin });
  return h(
    'table',
    { s: 'f-oo-tablo' },
    h('thead', null, h('tr', null, th(MO.bolum), th(MO.deneme), th(MO.kayip), th(MO.birakma), th(MO.sure))),
    h(
      'tbody',
      null,
      bolumler.map((x) => {
        const sure = x.ortSure === null ? '—' : dakikaSaniye(x.ortSure);
        // Yıldız ve vurgu görsel: ekran okuyucu için satır başlığında gizli metin (hücre gezintisinde de okunur).
        const ek = [x.kazanildi ? MO.kazanildi : '', x.vurgu ? MO.enCokTakilan : ''].filter(Boolean);
        return h(
          'tr',
          { s: x.vurgu ? 'f-oo-vurgu' : undefined },
          h(
            'th',
            { scope: 'row', s: 'f-sayi' },
            h('span', { t: String(x.id) }),
            x.kazanildi ? kucukYildiz(true) : h('i'),
            ek.length ? h('span', { s: 'f-gizli', t: `, ${ek.join(', ')}` }) : null,
          ),
          h('td', { s: 'f-sayi', t: sayi(x.deneme) }),
          h('td', { s: `f-sayi${x.kayip ? ' f-oo-sicak' : ''}`, t: sayi(x.kayip) }),
          h('td', { s: `f-sayi${x.birakma ? ' f-oo-sicak' : ''}`, t: sayi(x.birakma) }),
          h('td', { s: 'f-sayi', t: sure }),
        );
      }),
    ),
  );
}
