/**
 * Reklam izni kartı (docs/YASAL-UYUM.md §2; KVKK açık rızası): ilk "Reklam
 * izle"de ve Ayarlar > Reklam izni'nden açılır. Aydınlatma metni ayrıdır
 * (bağlantı politikayı açar); kişiselleştirme kutusu önceden işaretli DEĞİL.
 * Kapatmak karar değildir (null): sonra yeniden sorulur. İki seçenek eşit
 * görünür (kabulü öne çıkarmak yönlendirme sayılır).
 */
import { h } from '../dom';
import { MC } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import type { ReklamIzni } from '../../platform/reklamIzni';

export type ReklamIzniKarari = Pick<ReklamIzni, 'izin' | 'kisisel'>;

export function reklamIzniEkrani(b: Baglam, mevcut: ReklamIzni | null, politikaAc?: () => void): { soz: Promise<ReklamIzniKarari | null>; kapat: () => void } {
  const { soz, sec } = secimSozu<ReklamIzniKarari | null>();
  const secVeKapat = (k: ReklamIzniKarari | null) => {
    if (sec(k)) t.kapat();
  };
  const kutu = h('input', { type: 'checkbox', s: 'f-ri-kutu' });
  kutu.checked = mevcut?.izin === true && mevcut.kisisel;
  const kisisel = h('label', { s: 'f-ri-kisisel' }, kutu, h('span', { t: MC.izinKisisel }));
  const aydinlatma = politikaAc ? dugme(MC.izinAydinlatma, 'metin', () => politikaAc(), { sinif: 'f-ri-aydinlatma' }) : null;
  const icerik = h(
    'div',
    { s: 'f-reklam-izni' },
    h('p', { s: 'f-ri-metin', t: MC.izinMetni }),
    kisisel,
    aydinlatma,
    h(
      'div',
      { s: 'f-dg-sira' },
      dugme(MC.izinVerme, 'ikincil', () => secVeKapat({ izin: false, kisisel: false }), { sinif: 'f-ri-hayir' }),
      dugme(MC.izinVer, 'ikincil', () => secVeKapat({ izin: true, kisisel: kutu.checked }), { sinif: 'f-ri-evet' }),
    ),
  );
  const t = b.modalAc({ icerik, serit: MC.izinBaslik, kapatDugmesi: true, onIptal: () => secVeKapat(null), sinif: 'f-reklam-izni-modal' });
  return { soz, kapat: () => secVeKapat(null) };
}
