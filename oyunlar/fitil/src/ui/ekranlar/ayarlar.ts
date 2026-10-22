/**
 * Ayarlar (§14.8): ses, görünüm, yardım, mola, kayıt kodu (dışa/içe
 * aktarma), ilerlemeyi sıfırlama (iki aşamalı, sayfa içi onay), defter
 * kartları, hakkında. `alert/confirm/prompt` YOK.
 */
import { h, panoyaKopyala, metniSec, sistemAzHareket } from '../dom';
import { ikon, kapsulSvg, tanimlariKur } from '../ikonlar';
import { M, MK, MO, DEFTER_KARTLARI } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { satir, kasabaKartSatirlari } from './ortak';
import { MAHALLELER } from '../../app/katalog';
import type { AyarDegisikligi, AyarlarVM, MolaDakika, Palet } from '../tipler';
import { DIL, DILLER, t as tt, type Dil } from '../../platform/dil';

export interface AyarlarEk {
  nasilAc?: () => void;
  /** Ayarlar > Oyun özeti (ölçüm günlüğünden; ekran görüntüsü için). */
  oyunOzetiAc?: () => void;
  defterKartiAc?: (mahalle: number, tur?: 'defter' | 'kasaba') => void;
  /** Palet/hareket önizlemesini Arayuz'a anında uygula. */
  yerelUygula?: (d: AyarDegisikligi) => void;
  /** Dil seçildi (uygulama sayfayı o dille yeniden açar). */
  dilDegisti?: (d: Dil) => void;
  /**
   * (CAN-REKLAM §4, §6; G3) "Mağaza" satırı: yalnız verilince görünür
   * (gelir sağlayıcısı varken). Ayarlar açık kalır, Mağaza üstünde açılır.
   */
  magazaAc?: () => void;
  /**
   * (CAN-REKLAM §6; G3) Gelir sağlayıcısı var: Hakkında'daki "Can yok,
   * bekleme yok, mağaza yok." yerine "Canlar 30 dakikada dolar; reklam yalnız
   * sen isteyince." Yoksa metin aynen kalır.
   */
  gelirVar?: boolean;
}

/** Dil adları kendi dillerinde (oyuncu kendi dilini tanısın). */
const DIL_ADLARI: Record<Dil, string> = { tr: 'Türkçe', en: 'English' };

function anahtar(acik: boolean, etiket: string, degisti: (v: boolean) => void): HTMLButtonElement {
  const a = h('button', { s: 'f-anahtar', type: 'button', role: 'switch', 'aria-checked': String(acik), 'aria-label': etiket }) as HTMLButtonElement;
  a.addEventListener('click', () => {
    const v = a.getAttribute('aria-checked') !== 'true';
    a.setAttribute('aria-checked', String(v));
    degisti(v);
  });
  return a;
}

function parcali<T extends string | number>(secenekler: { d: T; ad: string; uzun?: string }[], secili: T, etiket: string, degisti: (v: T) => void): HTMLElement {
  const kap = h('div', { s: 'f-parcali', role: 'radiogroup', 'aria-label': etiket });
  const dgler = secenekler.map((s) => {
    const d = h('button', { type: 'button', role: 'radio', 'aria-checked': String(s.d === secili), t: s.ad, 'aria-label': s.uzun ?? s.ad });
    d.addEventListener('click', () => {
      dgler.forEach((x) => x.setAttribute('aria-checked', 'false'));
      d.setAttribute('aria-checked', 'true');
      degisti(s.d);
    });
    return d;
  });
  kap.append(...dgler);
  return kap;
}

function kaydirici(deger: number, etiket: string, degisti: (v: number) => void): HTMLElement {
  const yuzdeEl = h('span', { s: 'f-kaydirici-deger f-sayi', t: `${Math.round(deger * 100)}` });
  const k = h('input', {
    s: 'f-kaydirici',
    type: 'range',
    min: '0',
    max: '100',
    step: '5',
    value: String(Math.round(deger * 100)),
    'aria-label': etiket,
    css: { '--o': `${Math.round(deger * 100)}%` },
  }) as HTMLInputElement;
  k.addEventListener('input', () => {
    k.style.setProperty('--o', `${k.value}%`);
    yuzdeEl.textContent = k.value;
    degisti(Number(k.value) / 100);
  });
  return h('div', { s: 'f-kaydirici-kap' }, k, yuzdeEl);
}

export function ayarlarEkrani(b: Baglam, vm: AyarlarVM, ek: AyarlarEk = {}): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  const d = { ...vm };
  const degis = (x: AyarDegisikligi) => {
    Object.assign(d, x);
    ek.yerelUygula?.(x);
    b.geri.ayarDegisti?.(x);
  };

  // ── Ses
  const ses = h(
    'section',
    { s: 'f-ay-bolum' },
    h('h3', { s: 'f-etiket', t: M.ses }),
    h('div', { s: 'f-satir f-satir-kaydirici' }, h('span', { s: 'f-satir-ikon' }, ikon('ses')), h('span', { s: 'f-satir-etiket', t: M.efektSesi }), kaydirici(d.sfx, M.efektSesi, (v) => degis({ sfx: v }))),
    h('div', { s: 'f-satir f-satir-kaydirici' }, h('span', { s: 'f-satir-ikon' }, ikon('muzik')), h('span', { s: 'f-satir-etiket', t: M.muzik }), kaydirici(d.muzik, M.muzik, (v) => degis({ muzik: v }))),
    satir(M.ortamSesi, anahtar(d.ortam, M.ortamSesi, (v) => degis({ ortam: v })), ikon('ortam')),
    satir(M.titresim, anahtar(d.titresim, M.titresim, (v) => degis({ titresim: v })), ikon('titresim')),
  );

  // ── Görünüm
  const paletOnizleme = h('div', { s: 'f-palet-onizleme', 'aria-hidden': 'true' });
  const paletCiz = (p: Palet) => {
    tanimlariKur(p);
    paletOnizleme.replaceChildren(...[0, 1, 2, 3, 4, 5].map((i) => kapsulSvg(i, p)));
  };
  paletCiz(d.palet);
  const sistemAz = sistemAzHareket();
  const gorunum = h(
    'section',
    { s: 'f-ay-bolum' },
    h('h3', { s: 'f-etiket', t: M.gorunum }),
    h(
      'div',
      { s: 'f-satir f-satir-dikey' },
      h('span', { s: 'f-satir-ust' }, h('span', { s: 'f-satir-ikon' }, ikon('dil')), h('span', { s: 'f-satir-etiket', t: M.dil })),
      parcali(
        DILLER.map((x) => ({ d: x, ad: DIL_ADLARI[x] })),
        DIL,
        M.dil,
        (v) => {
          if (v !== DIL) ek.dilDegisti?.(v);
        },
      ),
    ),
    satir(M.hareketiAzalt, anahtar(d.hareketiAzalt || sistemAz, M.hareketiAzalt, (v) => degis({ hareketiAzalt: v })), ikon('hareket'), sistemAz ? tt('Sistem tercihi açık', 'System setting is on') : undefined),
    h(
      'div',
      { s: 'f-satir f-satir-dikey' },
      h('span', { s: 'f-satir-ust' }, h('span', { s: 'f-satir-ikon' }, ikon('hiz')), h('span', { s: 'f-satir-etiket', t: M.animasyonHizi })),
      parcali([{ d: 1 as const, ad: M.normal }, { d: 1.5 as const, ad: M.hizli }], d.hiz, M.animasyonHizi, (v) => degis({ hiz: v })),
    ),
    h(
      'div',
      { s: 'f-satir f-satir-dikey' },
      h('span', { s: 'f-satir-ust' }, h('span', { s: 'f-satir-ikon' }, ikon('palet')), h('span', { s: 'f-satir-etiket', t: M.renkPaleti })),
      parcali(
        (['standart', 'renkKoru', 'yuksekKontrast'] as Palet[]).map((p) => ({ d: p, ad: M.paletAdlari[p], uzun: M.paletUzunAdlari[p] })),
        d.palet,
        M.renkPaleti,
        (p) => {
          paletCiz(p);
          degis({ palet: p });
        },
      ),
      paletOnizleme,
    ),
  );

  // ── Yardım
  const yardim = h(
    'section',
    { s: 'f-ay-bolum' },
    h('h3', { s: 'f-etiket', t: M.yardim }),
    satir(M.ipuclari, anahtar(d.ipuclari, M.ipuclari, (v) => degis({ ipuclari: v })), ikon('ipucu')),
    h(
      'div',
      { s: 'f-dg-sira f-ay-dugmeler' },
      dugme(M.balonlariYenidenIzle, 'ikincil', () => {
        b.geri.balonlariSifirla?.();
        b.toast(M.balonlarSifirlandi);
      }, { ikon: 'tekrar' }),
      ek.nasilAc ? dugme(M.nasilOynanir, 'ikincil', () => ek.nasilAc?.(), { ikon: 'soru' }) : null,
    ),
  );

  // ── Sağlık
  const saglik = h(
    'section',
    { s: 'f-ay-bolum' },
    h('h3', { s: 'f-etiket', t: M.saglik }),
    h(
      'div',
      { s: 'f-satir f-satir-dikey' },
      h('span', { s: 'f-satir-ust' }, h('span', { s: 'f-satir-ikon' }, ikon('saat')), h('span', { s: 'f-satir-etiket', t: M.molaHatirlatici })),
      parcali<MolaDakika>(
        [{ d: 30, ad: M.dk(30) }, { d: 45, ad: M.dk(45) }, { d: 60, ad: M.dk(60) }, { d: 0, ad: M.kapali }],
        d.mola,
        M.molaHatirlatici,
        (v) => degis({ mola: v }),
      ),
    ),
  );

  const kayit = kayitBolumu(b, d);

  // ── Defter kartları
  const kartlar = h(
    'section',
    { s: 'f-ay-bolum' },
    h('h3', { s: 'f-etiket', t: M.defterKartlari }),
    h(
      'div',
      { s: 'f-kart-liste' },
      MAHALLELER.map((m, i) => {
        const acik = !!d.defterKartlari[i];
        const dg = h(
          'button',
          { s: `f-kart-satir${acik ? '' : ' f-kilitli'}`, type: 'button', 'aria-disabled': acik ? undefined : 'true', css: { '--vurgu': m.vurgu } },
          h('i'),
          h('span', null, h('strong', { t: acik ? DEFTER_KARTLARI[i].baslik : m.ad }), h('small', { t: acik ? m.ad : M.defterKilitli })),
          ikon(acik ? 'ileri' : 'kilit'),
        );
        dg.addEventListener('click', () => {
          if (acik) ek.defterKartiAc?.(i);
          else b.toast(M.defterKilitli);
        });
        return dg;
      }),
      kasabaKartSatirlari(d.kasabaKartlari, (i) => ek.defterKartiAc?.(i, 'kasaba')),
    ),
  );

  // ── Oyun özeti (Hakkında'nın hemen üstünde; aile testi: ekran görüntüsü)
  let oyunOzeti: HTMLElement | null = null;
  if (ek.oyunOzetiAc) {
    oyunOzeti = h(
      'button',
      { s: 'f-kart-satir f-ay-oyun-ozeti', type: 'button' },
      h('span', { s: 'f-satir-ikon' }, ikon('grafik')),
      h('span', null, h('strong', { t: MO.baslik })),
      ikon('ileri'),
    );
    oyunOzeti.addEventListener('click', () => ek.oyunOzetiAc?.());
  }

  const hakkinda = h(
    'section',
    { s: 'f-ay-bolum f-hakkinda' },
    h('h3', { s: 'f-etiket', t: M.hakkinda }),
    h('p', { s: 'f-govde', t: M.hakkindaMetin }),
    h('p', { s: 'f-not', t: M.yaziTipi }),
    h('p', { s: 'f-not', t: M.surum(d.surum) }),
  );

  const icerik = h('div', { s: 'f-ay' }, ses, gorunum, yardim, saglik, kayit, kartlar, oyunOzeti, hakkinda);
  const kapat = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: M.ayarlar, seritTur: 'gece', genislik: 'genis', kapatDugmesi: true, onIptal: kapat, sinif: 'f-ayarlar' });
  return { soz, kapat };
}

function kayitBolumu(b: Baglam, d: AyarlarVM): HTMLElement {
  const panel = h('div', { s: 'f-kayit-panel' });
  const durum = h('p', { s: `f-kayit-durum f-depo-${d.depolama}` }, ikon(d.depolama === 'bellek' ? 'uyari' : 'bilgi'), h('span', { t: M.depolama[d.depolama] }));

  const disaAktar = () => {
    const kod = b.geri.kayitKodu?.() ?? '';
    const alan = h('textarea', { s: 'f-kod', readonly: true, rows: '3', spellcheck: 'false', 'aria-label': M.kayitKodu }) as HTMLTextAreaElement;
    alan.value = kod;
    const kopyala = dugme(M.kopyala, 'birincil', async () => {
      if (await panoyaKopyala(kod)) b.toast(M.kopyalandi);
      else {
        metniSec(alan);
        b.toast(M.kopyalanamadi, 2600);
      }
    }, { ikon: 'kopyala' });
    panel.replaceChildren(h('div', { s: 'f-kayit-ic' }, alan, kopyala));
    alan.addEventListener('focus', () => metniSec(alan));
  };

  const iceAktar = () => {
    const alan = h('textarea', { s: 'f-kod', rows: '3', spellcheck: 'false', placeholder: M.koduYapistir, 'aria-label': M.kayitKodu }) as HTMLTextAreaElement;
    const onizleme = h('div', { s: 'f-kayit-onizleme', 'aria-live': 'polite' });
    const onay = h('div', { s: 'f-onay' });
    let gecerliKod: string | null = null;
    const yukle = dugme(M.yukle, 'birincil', () => {
      if (!gecerliKod) return;
      const kod = gecerliKod;
      onay.replaceChildren(
        h('p', { s: 'f-onay-metin' }, ikon('uyari'), h('span', { t: M.yukleOnay })),
        h(
          'div',
          { s: 'f-dg-sira' },
          dugme(M.vazgec, 'ikincil', () => onay.replaceChildren()),
          dugme(M.evetYukle, 'birincil', () => {
            const ok = b.geri.kayitYukle?.(kod) ?? false;
            b.toast(ok ? M.kayitYuklendi : M.kayitGecersiz);
            if (ok) panel.replaceChildren();
            else onay.replaceChildren();
          }),
        ),
      );
    }, { ikon: 'yukle' });
    yukle.disabled = true;
    let sure: ReturnType<typeof setTimeout> | null = null;
    alan.addEventListener('input', () => {
      if (sure) clearTimeout(sure);
      sure = setTimeout(() => {
        const kod = alan.value.trim();
        onay.replaceChildren();
        if (!kod) {
          onizleme.replaceChildren();
          gecerliKod = null;
          yukle.disabled = true;
          return;
        }
        const o = b.geri.kayitOnizle?.(kod) ?? { gecerli: false as const, hata: M.kayitGecersiz };
        if (o.gecerli) {
          gecerliKod = kod;
          yukle.disabled = false;
          onizleme.replaceChildren(
            h('span', { s: 'f-cip' }, ikon('yildizDolu'), h('span', { s: 'f-sayi', t: String(o.toplamYildiz) })),
            h('span', { s: 'f-cip' }, ikon('harita'), h('span', { s: 'f-sayi', t: `${M.bolum} ${o.sonBolum}` })),
            h('span', { s: 'f-cip' }, ikon('defter'), h('span', { s: 'f-sayi', t: tt(`${o.desen} desen`, `${o.desen} patterns`) })),
          );
          // (Kancalar §D.6) "Mühür 23 · Kasaba 17/48 işi · 6 kandil"
          if (o.muhur !== undefined && o.kasabaIs !== undefined && o.kandil !== undefined) onizleme.appendChild(h('small', { s: 'f-not', t: MK.kayitOzeti(o.muhur, o.kasabaIs, o.kandil) }));
          if (o.kayitTarihi) onizleme.appendChild(h('small', { s: 'f-not', t: o.kayitTarihi }));
        } else {
          gecerliKod = null;
          yukle.disabled = true;
          onizleme.replaceChildren(h('p', { s: 'f-hata' }, ikon('uyari'), h('span', { t: o.hata })));
        }
      }, 180);
    });
    panel.replaceChildren(h('div', { s: 'f-kayit-ic' }, alan, onizleme, yukle, onay));
    setTimeout(() => alan.focus({ preventScroll: true }), 50);
  };

  const sifirla = () => {
    let geriSayim: ReturnType<typeof setInterval> | null = null;
    const vazgec = () => {
      if (geriSayim) clearInterval(geriSayim);
      panel.replaceChildren();
    };
    const asama2 = () => {
      const sil = dugme(M.evetHepsiniSil, 'tehlike', () => {
        b.geri.ilerlemeyiSifirla?.();
        b.toast(M.sifirlandi);
        vazgec();
      });
      const etiket = sil.querySelector('span')!;
      let kalan = 3;
      sil.disabled = true;
      etiket.textContent = `${M.evetHepsiniSil} (${kalan})`;
      geriSayim = setInterval(() => {
        kalan--;
        if (kalan <= 0) {
          if (geriSayim) clearInterval(geriSayim);
          sil.disabled = false;
          etiket.textContent = M.evetHepsiniSil;
        } else etiket.textContent = `${M.evetHepsiniSil} (${kalan})`;
      }, 600);
      panel.replaceChildren(
        h(
          'div',
          { s: 'f-onay f-onay-tehlike' },
          h('p', { s: 'f-onay-metin' }, ikon('uyari'), h('span', { t: M.sifirlaUyari2 })),
          h('div', { s: 'f-dg-sira' }, dugme(M.vazgec, 'ikincil', vazgec, { odak: true }), sil),
        ),
      );
    };
    panel.replaceChildren(
      h(
        'div',
        { s: 'f-onay f-onay-tehlike' },
        h('p', { s: 'f-onay-metin' }, ikon('uyari'), h('span', { t: M.sifirlaUyari1 })),
        h('div', { s: 'f-dg-sira' }, dugme(M.vazgec, 'ikincil', vazgec), dugme(M.sifirla, 'tehlike', asama2)),
      ),
    );
  };

  return h(
    'section',
    { s: 'f-ay-bolum' },
    h('h3', { s: 'f-etiket', t: M.kayit }),
    durum,
    h(
      'div',
      { s: 'f-dg-sira f-ay-dugmeler' },
      b.geri.kayitKodu ? dugme(M.disaAktar, 'ikincil', disaAktar, { ikon: 'indir' }) : null,
      b.geri.kayitYukle ? dugme(M.iceAktar, 'ikincil', iceAktar, { ikon: 'yukle' }) : null,
    ),
    panel,
    b.geri.ilerlemeyiSifirla ? h('div', { s: 'f-ay-sifirla' }, dugme(M.ilerlemeyiSifirla, 'metin', sifirla, { ikon: 'sil', sinif: 'f-dg-tehlike-metin' })) : null,
  );
}
