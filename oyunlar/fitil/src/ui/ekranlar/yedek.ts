/**
 * "Kaydını yedekle" kartı (docs/YASAL-UYUM.md §3; `app/yedek.ts`): kayıt
 * yalnız cihazda olduğu için 10/20/30/40. bölümden sonra bir kez. Paylaş
 * (sistem penceresi) ya da Kopyala; "Sonra" ve kapatmak yedeklenmedi sayılır.
 * Döner: true = kod paylaşıldı ya da kopyalandı.
 */
import { h, metniSec, panoyaKopyala } from '../dom';
import { M } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';

export type YedekPaylas = () => Promise<'tamam' | 'iptal' | 'yok'>;

export function yedekEkrani(b: Baglam, kod: string, paylas?: YedekPaylas): { soz: Promise<boolean>; kapat: () => void } {
  const { soz, sec } = secimSozu<boolean>();
  const bitir = (ok: boolean) => {
    if (sec(ok)) t.kapat();
  };
  const alanYeri = h('div', { s: 'f-yedek-alan' });
  const kopyala = async () => {
    if (await panoyaKopyala(kod)) {
      b.toast(M.kopyalandi);
      bitir(true);
      return;
    }
    // Pano yok: kod seçili gösterilir, oyuncu elle kopyalar.
    const alan = h('textarea', { s: 'f-kod', readonly: true, rows: '3', spellcheck: 'false', 'aria-label': M.kayitKodu }) as HTMLTextAreaElement;
    alan.value = kod;
    alanYeri.replaceChildren(alan);
    metniSec(alan);
    b.toast(M.kopyalanamadi, 2600);
  };
  const ana = paylas
    ? dugme(M.paylas, 'birincil', async () => {
        const r = await paylas();
        if (r === 'tamam') bitir(true);
        else if (r === 'yok') await kopyala();
      }, { ikon: 'paylas', sinif: 'f-yedek-paylas' })
    : dugme(M.kopyala, 'birincil', kopyala, { ikon: 'kopyala', sinif: 'f-yedek-kopyala' });
  const icerik = h(
    'div',
    { s: 'f-yedek' },
    h('p', { s: 'f-yedek-metin', t: M.yedekMetni }),
    alanYeri,
    h('div', { s: 'f-dg-sira' }, dugme(M.sonra, 'ikincil', () => bitir(false), { sinif: 'f-yedek-sonra' }), ana),
  );
  const t = b.modalAc({ icerik, serit: M.yedekBaslik, kapatDugmesi: true, onIptal: () => bitir(false), sinif: 'f-yedek-modal' });
  return { soz, kapat: () => bitir(false) };
}
