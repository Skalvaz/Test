/**
 * Mağaza (CAN-REKLAM §4, §6; Ayarlar > Mağaza ve can paneli): üç ürün satırı
 * (simge, ad, tek satır açıklama, fiyat düğmesi) ve altta "Satın alımları
 * geri yükle". Durumlar: 'sende' → "Sende var" (düğme yok), 'stokDolu' →
 * pasif "Stok dolu" (`can_doldur` için "Canların dolu"), 'yok' → pasif
 * "Şu an yok", fiyat henüz gelmediyse pasif "—".
 *
 * Seçimde kapanır (§13 karar 7): uygulama satın almayı işleyip yeni modelle
 * yeniden açar. `tazele` açıkken saniyede bir çağrılır (fiyatların gelişi,
 * stok); satırlar yalnız model değişince yeniden kurulur.
 */
import { h } from '../dom';
import { ikon, urunSvg } from '../ikonlar';
import { MC } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import type { MagazaSecimi, MagazaUrunVM, MagazaVM } from '../tipler';

export function magazaEkrani(
  b: Baglam,
  ilk: MagazaVM,
  tazele?: () => MagazaVM,
  o: { girisYok?: boolean } = {},
): { soz: Promise<MagazaSecimi>; kapat: () => void } {
  const { soz, sec } = secimSozu<MagazaSecimi>();
  let sayac: ReturnType<typeof setInterval> | null = null;
  const secVeKapat = (s: MagazaSecimi) => {
    if (!sec(s)) return;
    if (sayac) clearInterval(sayac);
    sayac = null;
    t.kapat();
  };

  const liste = h('ul', { s: 'f-mg-liste' });
  const alt = h('div', { s: 'f-mg-alt' });
  const icerik = h('div', { s: 'f-mg' }, liste, alt);
  let anahtar = '';
  const ciz = (vm: MagazaVM) => {
    const a = JSON.stringify(vm);
    if (a === anahtar) return;
    anahtar = a;
    liste.replaceChildren(...vm.urunler.map((u) => urunSatiri(u, (id) => secVeKapat({ tur: 'satinAl', id }))));
    alt.replaceChildren(...(vm.geriYukle ? [dugme(MC.geriYukle, 'metin', () => secVeKapat({ tur: 'geriYukle' }), { ikon: 'tekrar', sinif: 'f-mg-geri' })] : []));
  };
  ciz(ilk);

  const t = b.modalAc({
    icerik,
    serit: MC.magaza,
    seritTur: 'gece',
    genislik: 'genis',
    kapatDugmesi: true,
    onIptal: () => secVeKapat({ tur: 'kapat' }),
    sinif: 'f-magaza-modal',
    girisYok: o.girisYok,
  });

  if (tazele)
    sayac = setInterval(() => {
      try {
        ciz(tazele());
      } catch {
        /* tazeleme isteğe bağlı: eski model kalır */
      }
    }, 1000);

  return { soz, kapat: () => secVeKapat({ tur: 'kapat' }) };
}

function urunSatiri(u: MagazaUrunVM, satinAl: (id: MagazaUrunVM['id']) => void): HTMLElement {
  let eylem: HTMLElement;
  if (u.durum === 'sende') {
    eylem = h('span', { s: 'f-mg-sende' }, ikon('tik'), h('span', { t: MC.sendeVar }));
  } else {
    const metin = u.durum === 'stokDolu' ? (u.id === 'can_doldur' ? MC.canlarDolu : MC.stokDolu) : u.durum === 'yok' ? MC.suAnYok : (u.fiyat ?? MC.fiyatYok);
    const dg = dugme(metin, 'birincil', () => satinAl(u.id), { sinif: 'f-mg-fiyat', etiket: u.durum === 'satilik' && u.fiyat ? `${u.ad}: ${u.fiyat}` : undefined });
    dg.disabled = u.durum !== 'satilik' || !u.fiyat;
    if (dg.disabled) dg.classList.replace('f-dg-birincil', 'f-dg-ikincil');
    eylem = dg;
  }
  return h(
    'li',
    // Durum sınıfı önekli (f-mg-d-*): "f-mg-sende" iç öğenin sınıfıyla çakışmasın.
    { s: `f-mg-urun f-mg-d-${u.durum}` },
    h('span', { s: 'f-mg-resim' }, urunSvg(u.id)),
    h('strong', { s: 'f-mg-ad', t: u.ad }),
    h('span', { s: 'f-mg-aciklama', t: u.aciklama }),
    h('span', { s: 'f-mg-eylem' }, eylem),
  );
}
