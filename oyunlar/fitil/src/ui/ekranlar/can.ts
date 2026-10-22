/**
 * Can paneli / Can bitti (CAN-REKLAM §6): şerit başlık ("Canların bitti" ya
 * da "Canlar 3/5"), beş fitil (yanan = var olan can), büyük sayaç "Sonraki
 * can 12:31" (canlı) ve satırlar: [Reklam izle · +1 can] (altında "2 hak
 * kaldı"; hak bitince düğme yerine "Yarın yine"; Usta kartıyla "Ücretsiz +1
 * can", reklam simgesi yok), [Canları doldur · fiyat], [Bekle] (can
 * doluyken "Tamam"). Aynı dosyada bölümden çıkış onayı (`cikisOnayiEkrani`).
 *
 * Seçimde kapanır (§13 karar 7); uygulama reklamı/satın almayı işleyip
 * gerekiyorsa yeni modelle yeniden açar. `tazele` açıkken saniyede bir
 * çağrılır (sayaç, reklam hazır, fiyat); verilmezse `sonrakiMs` açılış
 * anından yerelde geri sayılır.
 */
import { h } from '../dom';
import { fitilCanSvg, ikon } from '../ikonlar';
import { M, MC, geriSayim } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import type { CanPaneliSecimi, CanVM } from '../tipler';

export function canPaneliEkrani(
  b: Baglam,
  ilk: CanVM,
  tazele?: () => CanVM,
  o: { girisYok?: boolean } = {},
): { soz: Promise<CanPaneliSecimi>; kapat: () => void } {
  const { soz, sec } = secimSozu<CanPaneliSecimi>();
  let sayac: ReturnType<typeof setInterval> | null = null;
  const secVeKapat = (s: CanPaneliSecimi) => {
    if (!sec(s)) return;
    if (sayac) clearInterval(sayac);
    sayac = null;
    t.kapat();
  };

  const fitiller = h('div', { s: 'f-can-fitiller', role: 'img' });
  const sure = h('strong', { s: 'f-can-sure f-sayi' });
  const sayacEl = h('div', { s: 'f-can-sayac' });
  const satirlar = h('div', { s: 'f-dg-sutun f-can-satirlar' });
  const icerik = h('div', { s: 'f-can' }, fitiller, sayacEl, satirlar);

  let vm = ilk;
  let satirAnahtari = '';
  let fitilAnahtari = '';
  let sayacDolu: boolean | null = null;

  const baslik = (v: CanVM) => (v.tur === 'bitti' ? MC.canlarBitti : MC.canlarDurum(v.sayi, v.enCok));

  const ciz = (v: CanVM) => {
    const fa = `${v.sayi}/${v.enCok}`;
    if (fa !== fitilAnahtari) {
      fitilAnahtari = fa;
      fitiller.replaceChildren(...Array.from({ length: Math.max(0, v.enCok) }, (_, i) => fitilCanSvg('f-can-fitil', i < v.sayi)));
      fitiller.setAttribute('aria-label', MC.canlarDurum(v.sayi, v.enCok));
    }
    // Sayaç: can doluysa "Canların dolu", değilse "Sonraki can" + büyük süre.
    const dolu = v.sonrakiMs === null;
    if (dolu !== sayacDolu) {
      sayacDolu = dolu;
      sayacEl.replaceChildren(...(dolu ? [h('span', { s: 'f-can-sayac-dolu', t: MC.canlarDolu })] : [h('span', { s: 'f-can-sayac-etiket', t: MC.sonrakiCan }), sure]));
    }
    if (!dolu) sure.textContent = geriSayim(v.sonrakiMs ?? 0);
    // Satırlar yalnız yapıları değişince yeniden kurulur (saniyelik sayaç düğmeleri yenilemesin).
    const sa = JSON.stringify([v.reklam, v.doldur, v.sonrakiMs === null]);
    if (sa !== satirAnahtari) {
      satirAnahtari = sa;
      satirlar.replaceChildren(...satirlariKur(v, secVeKapat));
    }
    if (seritEl) seritEl.textContent = baslik(v);
  };

  // İlk çizimde kart henüz yok: şerit modalAc'a başlıkla verilir, sonra yerinde tazelenir.
  let seritEl: Element | null = null;
  ciz(vm);
  const t = b.modalAc({
    icerik,
    serit: baslik(vm),
    seritTur: vm.tur === 'bitti' ? 'kirmizi' : 'gece',
    onIptal: () => secVeKapat('kapat'),
    perdeKapatir: true,
    sinif: 'f-can-modal',
    girisYok: o.girisYok,
  });
  seritEl = t.kart.querySelector('.f-serit-metin');

  const acilis = performance.now();
  sayac = setInterval(() => {
    if (tazele) {
      try {
        vm = tazele();
      } catch {
        return;
      }
    } else if (ilk.sonrakiMs !== null) {
      vm = { ...ilk, sonrakiMs: Math.max(0, ilk.sonrakiMs - (performance.now() - acilis)) };
    }
    ciz(vm);
  }, 1000);

  return { soz, kapat: () => secVeKapat('kapat') };
}

/**
 * Bölümden çıkış onayı (CAN-REKLAM §2, §6; `alert/confirm` yok): sönük fitil
 * + "Bölümden çıkarsan 1 can gider." [Vazgeç] [Çık]. `neden` 'yeniden':
 * "Yeniden başlarsan 1 can gider." [Vazgeç] [Yeniden başla]. Esc ve perde =
 * Vazgeç (false). Varsayılan odak Vazgeç'te (Enter can harcamaz).
 */
export function cikisOnayiEkrani(b: Baglam, neden: 'harita' | 'yeniden'): { soz: Promise<boolean>; kapat: () => void } {
  const { soz, sec } = secimSozu<boolean>();
  const secVeKapat = (onay: boolean) => {
    if (sec(onay)) t.kapat();
  };
  const metin = neden === 'yeniden' ? MC.yenidenMetni : MC.cikisMetni;
  const icerik = h(
    'div',
    { s: 'f-cikis-onay' },
    h('div', { s: 'f-co-ust' }, h('span', { s: 'f-co-simge' }, fitilCanSvg('f-co-fitil', false), h('b', { t: '−1' })), h('p', { s: 'f-co-metin', t: metin })),
    h(
      'div',
      { s: 'f-dg-sira' },
      dugme(M.vazgec, 'ikincil', () => secVeKapat(false), { odak: true }),
      dugme(neden === 'yeniden' ? M.yenidenBasla : MC.cik, 'tehlike', () => secVeKapat(true), { sinif: 'f-co-onay' }),
    ),
  );
  const t = b.modalAc({ icerik, etiket: metin, onIptal: () => secVeKapat(false), perdeKapatir: true, sinif: 'f-cikis-modal' });
  return { soz, kapat: () => secVeKapat(false) };
}

function satirlariKur(v: CanVM, sec: (s: CanPaneliSecimi) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const r = v.reklam;
  if (r) {
    if (r.hak <= 0) {
      // Bugünkü hak bitti: düğme yerine sakin bir satır (yarın yeniden).
      out.push(h('div', { s: 'f-can-yarin' }, ikon(r.kart ? 'fitil' : 'reklam'), h('span', { t: MC.yarinYine })));
    } else if (r.hazir || r.kart) {
      const metin = r.kart ? MC.ucretsizBirCan : `${MC.reklamIzle} · ${MC.artiBirCan}`;
      const dg = dugme(metin, 'birincil', () => sec('reklam'), { ikon: r.kart ? 'fitil' : 'reklam', odak: true, sinif: 'f-can-reklam' });
      out.push(h('div', { s: 'f-can-reklam-kap' }, dg, h('span', { s: 'f-can-hak', t: MC.hakKaldi(r.hak) })));
    }
  }
  if (v.doldur) out.push(dugme(`${MC.canlariDoldur} · ${v.doldur.fiyat}`, 'ikincil', () => sec('doldur'), { ikon: 'canta', sinif: 'f-can-doldur' }));
  // Can doluyken beklenecek bir şey yok: "Tamam".
  const dolu = v.sonrakiMs === null;
  out.push(dugme(dolu ? M.tamam : MC.bekle, 'ikincil', () => sec('kapat'), { ikon: dolu ? 'tik' : 'saat', sinif: 'f-can-bekle', odak: !out.some((x) => x.querySelector('[data-odak]')) }));
  return out;
}
