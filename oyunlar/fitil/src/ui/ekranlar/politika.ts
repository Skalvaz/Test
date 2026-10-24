/**
 * Gizlilik politikası (Ayarlar > Hakkında; yalnız Android, docs/ANDROID.md
 * §5). Play Kullanıcı Verileri politikası politikanın Play Console'daki
 * alanın yanında uygulamanın İÇİNDE de yayımlanmasını ister. Android köprüsü
 * `docs/gizlilik.html`'i pakete gömer (`FitilYerel.politika`): ürün
 * sahibinin yayımladığı sayfayla aynı metin, ağ gerekmez. Bu ekran sayfanın
 * oyuncunun dilindeki bölümünü (`section[lang]`) oyunun modalında gösterir;
 * başlık şeritte. Dış bağlantılar (Google politikaları, e-posta) yerel
 * sarmalayıcıda sistem tarayıcısında / e-posta uygulamasında açılır
 * (Capacitor uygulama dışı adresi kendisi yüklemez). Ayarlar'ın üstünde
 * açılır; Kapat (ya da Esc) Ayarlar'a döner.
 */
import { h } from '../dom';
import { MC } from '../metinler';
import { secimSozu, type Baglam } from '../cekirdek';
import { DIL } from '../../platform/dil';

/**
 * Politika HTML'inden oyuncunun dilindeki bölüm (yoksa ilk bölüm, o da yoksa
 * gövde). Bölüm başlığı (şeritte zaten var), betik, biçem ve dil seçici
 * atılır; sayfa içi çapalar (`#tr`, `#en`) modalda işe yaramadığı için
 * bağlantı olmaktan çıkar, dış bağlantılar yeni pencere ister.
 */
export function politikaIcerigi(html: string, dil: string = DIL): DocumentFragment {
  const belge = new DOMParser().parseFromString(html, 'text/html');
  const kaynak = belge.querySelector(`section[lang="${dil}"]`) ?? belge.querySelector('section') ?? belge.body;
  const parca = document.createDocumentFragment();
  for (const d of Array.from(kaynak.childNodes)) parca.appendChild(document.importNode(d, true));
  parca.querySelectorAll('script, style, nav, h1').forEach((e) => e.remove());
  parca.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (/^https?:/i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    } else if (!/^mailto:/i.test(href)) a.removeAttribute('href');
  });
  return parca;
}

export function politikaEkrani(b: Baglam, html: string): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  const icerik = h('div', { s: 'f-politika' });
  icerik.appendChild(politikaIcerigi(html));
  const kapat = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: MC.politika, seritTur: 'gece', genislik: 'genis', kapatDugmesi: true, onIptal: kapat, sinif: 'f-politika-modal' });
  return { soz, kapat };
}
