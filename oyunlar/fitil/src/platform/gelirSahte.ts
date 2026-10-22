/**
 * Sahte gelir sağlayıcısı (docs/CAN-REKLAM.md §5): web'de `?gelir=sahte` ile
 * can, reklam ve Mağaza akışlarını denemek için. Gerçek reklam ya da ödeme
 * YOK; ağ isteği yok.
 *
 *  - Reklam: tam ekran DOM katmanı ("Deneme reklamı", 5 sn geri sayım, sonra
 *    "Ödülü al" → 'odul'; erken "Kapat" ya da Esc → 'iptal').
 *  - Mağaza: sabit deneme fiyatları; `satinAl` sayfa içi onay kartı ("Satın
 *    al" → 'basarili', "Vazgeç" / Esc / boşluk → 'iptal'); kalıcı alımlar bu
 *    cihazda `fitil.gelir.sahte.kalici`'de tutulur, `geriYukle` onları verir.
 *    `tamamla` hiçbir şey yapmaz, `bekleyenler` hep boş.
 *  - Test anahtarları (adres): `?reklam=hizli` (300 ms), `?reklam=yok`
 *    (`reklamHazir` false, gösterim 'yok'), `?reklam=hata` ('hata');
 *    `?satin=iptal|hata` (kart açılmadan o sonuç).
 *
 * Katmanlar sağlayıcının kendisidir (arayüz değil; Play'in ödeme sayfası
 * gibi): oyunun arayüz kökünün dışında, `document.body`'de en üstte durur,
 * açıkken klavye ve dokunuş oyuna geçmez. Aynı anda tek katman açılır.
 */
import { t } from './dil';
import { URUN_IDLERI, URUN_TURLERI, urunIdMi, type GelirSaglayici, type ReklamYeri, type Urun, type UrunId } from './gelir';
import './gelirSahte.css';

// ─────────────────────────── Ayarlar ───────────────────────────

export interface SahteAyarlari {
  reklam: 'normal' | 'hizli' | 'yok' | 'hata';
  satin: 'normal' | 'iptal' | 'hata';
}

/** Adres sorgusundan test anahtarları (`?reklam=hizli|yok|hata`, `?satin=iptal|hata`). */
export function sahteAyarlari(adres: string): SahteAyarlari {
  let p: URLSearchParams | null = null;
  try {
    p = new URLSearchParams(adres);
  } catch {
    /* adres okunamadı: varsayılanlar */
  }
  const r = p?.get('reklam');
  const s = p?.get('satin');
  return {
    reklam: r === 'hizli' || r === 'yok' || r === 'hata' ? r : 'normal',
    satin: s === 'iptal' || s === 'hata' ? s : 'normal',
  };
}

/** Deneme reklamının süresi (ms). */
export const SAHTE_REKLAM_MS = 5000;
/** `?reklam=hizli` süresi (ms; oynanış testi). */
export const SAHTE_REKLAM_HIZLI_MS = 300;
/** Sahte mağazanın ürün listesini "getirme" gecikmesi (ms; Mağaza'nın fiyat beklemesi de denensin). */
export const SAHTE_URUN_GECIKMESI = 200;
/** Sahte kalıcı alımların cihaz anahtarı (JSON `UrunId[]`). */
export const SAHTE_KALICI_ANAHTARI = 'fitil.gelir.sahte.kalici';

/** Deneme fiyatları (gerçekte mağaza verir, §4). */
export function sahteFiyatlar(): Readonly<Record<UrunId, string>> {
  return {
    can_doldur: t('₺29,99', '$0.99'),
    guclendirici_paketi: t('₺59,99', '$1.99'),
    usta_karti: t('₺149,99', '$4.99'),
  };
}

/** Onay kartındaki ürün adı (gerçekte mağazanın ürün başlığı; oyunun Mağaza metinleri G3'ün `metinler.ts`'inde). */
function urunAdi(id: UrunId): string {
  switch (id) {
    case 'can_doldur':
      return t('Canları doldur', 'Refill lives');
    case 'guclendirici_paketi':
      return t('Güçlendirici paketi', 'Booster pack');
    case 'usta_karti':
      return t('Usta kartı', 'Master pass');
  }
}

// ─────────────────────────── Sağlayıcı (DOM'suz çekirdek) ───────────────────────────

export interface SahteDepo {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** Sağlayıcının ekrana çıkardığı iki katman (DOM; testler sahtesini verir). */
export interface SahteKatmanlar {
  /** Deneme reklamı: sonuna kadar izlenip "Ödülü al" → 'odul', erken kapatma → 'iptal'. */
  reklam(yer: ReklamYeri, sureMs: number): Promise<'odul' | 'iptal'>;
  /** Satın alma onayı: "Satın al" → true, "Vazgeç" → false. */
  onay(urun: UrunId, fiyat: string): Promise<boolean>;
}

export interface SahteSecenek {
  /** Kalıcı alımların deposu (varsayılan localStorage; yoksa yalnız bellekte). */
  depo?: SahteDepo | null;
  /** Varsayılan: DOM katmanları (belge yoksa null → gösterim 'hata'). */
  katmanlar?: SahteKatmanlar | null;
  /** Jeton zamanı (varsayılan Date.now). */
  saat?: () => number;
  /** `urunler()` gecikmesi (ms). */
  urunGecikmesi?: number;
}

function yerelDepo(): SahteDepo | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Sahte sağlayıcı. Hiçbir yöntem fırlatmaz; aynı anda ikinci gösterim/satın alma 'hata'. */
export function sahteSaglayici(ayar: SahteAyarlari, secenek: SahteSecenek = {}): GelirSaglayici {
  const depo = secenek.depo === undefined ? yerelDepo() : secenek.depo;
  const katmanlar = secenek.katmanlar === undefined ? domKatmanlari() : secenek.katmanlar;
  const saat = secenek.saat ?? (() => Date.now());
  const gecikme = secenek.urunGecikmesi ?? SAHTE_URUN_GECIKMESI;
  let sayac = 0;
  let mesgul = false;
  let bellek: UrunId[] = [];

  const kaliciOku = (): UrunId[] => {
    try {
      const ham = depo?.getItem(SAHTE_KALICI_ANAHTARI);
      if (ham) {
        const v = JSON.parse(ham) as unknown;
        if (Array.isArray(v)) return URUN_IDLERI.filter((id) => URUN_TURLERI[id] === 'kalici' && v.includes(id));
      }
    } catch {
      /* bozuk ya da kapalı depo: bellekteki liste */
    }
    return [...bellek];
  };
  const kaliciEkle = (id: UrunId) => {
    const liste = kaliciOku();
    if (!liste.includes(id)) liste.push(id);
    bellek = liste;
    try {
      depo?.setItem(SAHTE_KALICI_ANAHTARI, JSON.stringify(liste));
    } catch {
      /* depolama kapalı: bu sayfa boyunca bellekte */
    }
  };

  return {
    ad: 'sahte',
    reklamHazir: () => ayar.reklam !== 'yok',
    async reklamGoster(yer) {
      if (ayar.reklam === 'yok') return 'yok';
      if (ayar.reklam === 'hata' || !katmanlar || mesgul) return 'hata';
      mesgul = true;
      try {
        return await katmanlar.reklam(yer, ayar.reklam === 'hizli' ? SAHTE_REKLAM_HIZLI_MS : SAHTE_REKLAM_MS);
      } catch {
        return 'hata';
      } finally {
        mesgul = false;
      }
    },
    async urunler() {
      if (gecikme > 0) await bekle(gecikme);
      const f = sahteFiyatlar();
      return URUN_IDLERI.map((id): Urun => ({ id, fiyat: f[id] }));
    },
    async satinAl(id) {
      if (!urunIdMi(id) || ayar.satin === 'hata') return { durum: 'hata' };
      if (ayar.satin === 'iptal') return { durum: 'iptal' };
      if (!katmanlar || mesgul) return { durum: 'hata' };
      mesgul = true;
      try {
        if (!(await katmanlar.onay(id, sahteFiyatlar()[id]))) return { durum: 'iptal' };
      } catch {
        return { durum: 'hata' };
      } finally {
        mesgul = false;
      }
      // Kalıcı ürün zaten alınmışsa da yeniden "satılır" (deneme: kayıt sıfırlanınca yeniden alınabilsin).
      if (URUN_TURLERI[id] === 'kalici') kaliciEkle(id);
      return { durum: 'basarili', urun: id, jeton: `sahte-${++sayac}-${saat()}` };
    },
    async tamamla() {
      /* sahte mağazada tüketme/onaylama yok */
    },
    async bekleyenler() {
      return [];
    },
    async geriYukle() {
      return kaliciOku();
    },
  };
}

// ─────────────────────────── DOM katmanları ───────────────────────────

/** Belge varsa DOM katmanları, yoksa null (Node, testler). */
export function domKatmanlari(): SahteKatmanlar | null {
  if (typeof document === 'undefined') return null;
  return { reklam: reklamKatmani, onay: onayKarti };
}

function oge<K extends keyof HTMLElementTagNameMap>(etiket: K, sinif: string, metin?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiket);
  e.className = sinif;
  if (metin !== undefined) e.textContent = metin;
  return e;
}

/** Modülün kendi SVG işaretlemesinden öğe (dışarıdan metin girmez). */
function svgOge(isaretleme: string): SVGSVGElement {
  const s = document.createElement('template');
  s.innerHTML = isaretleme.trim();
  return s.content.firstElementChild as SVGSVGElement;
}

const KAPAT_SVG =
  '<svg class="fs-ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/></svg>';
const TAMAM_SVG =
  '<svg class="fs-tamam" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 25.5l8 8L36.5 15"/></svg>';
/** Geri sayım halkası: sönük iz, hazır olunca yanan halka ve izin üstünde bir tur dönen kıvılcım (fitil gibi). */
const HALKA_SVG =
  '<svg class="fs-halka-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
  '<circle class="fs-iz" cx="60" cy="60" r="50"/>' +
  '<circle class="fs-yay" cx="60" cy="60" r="50"/>' +
  '<g class="fs-kivilcim">' +
  '<path d="M22.84 26.54A50 50 0 0 1 39.66 14.32" fill="none" stroke="#FF9A3C" stroke-width="7" opacity=".22"/>' +
  '<path d="M39.66 14.32A50 50 0 0 1 60 10" fill="none" stroke="#FF9A3C" stroke-width="7" opacity=".6"/>' +
  '<circle cx="60" cy="10" r="9" fill="#FF9A3C" opacity=".35"/><circle cx="60" cy="10" r="4.6" fill="#FFF4C2"/>' +
  '</g>' +
  '</svg>';

/**
 * Açık katmanın ortak davranışı: odak içeride kalır, Esc `iptal()`'i çağırır,
 * klavye ve dokunuş olayları oyuna (pencere/belge dinleyicileri) geçmez.
 * Kaldırıcı döndürür.
 */
function katmanBagla(kok: HTMLElement, iptal: () => void): () => void {
  const odaklanabilir = () => Array.from(kok.querySelectorAll<HTMLElement>('button:not(:disabled)')).filter((b) => b.offsetParent !== null);
  const tus = (e: KeyboardEvent) => {
    // Oyunun tuş dinleyicileri (Duraklat, yol çizici) görmesin; varsayılan eylem (Enter/Boşluk → tıklama) sürer.
    e.stopImmediatePropagation();
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      iptal();
      return;
    }
    const liste = odaklanabilir();
    const etkin = document.activeElement as HTMLElement | null;
    const icerde = !!etkin && kok.contains(etkin);
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!liste.length) return;
      const i = icerde ? liste.indexOf(etkin as HTMLElement) : -1;
      const j = e.shiftKey ? (i <= 0 ? liste.length - 1 : i - 1) : (i + 1) % liste.length;
      liste[j].focus({ preventScroll: true });
      return;
    }
    // Odak katmanın dışındaysa (arkadaki oyun düğmesi) Enter/Boşluk onu tetiklemesin.
    if (!icerde) {
      e.preventDefault();
      liste[0]?.focus({ preventScroll: true });
    }
  };
  const durdur = (e: Event) => e.stopPropagation();
  const isaretOlaylari = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'wheel', 'contextmenu'] as const;
  window.addEventListener('keydown', tus, true);
  for (const ad of isaretOlaylari) kok.addEventListener(ad, durdur);
  return () => {
    window.removeEventListener('keydown', tus, true);
    for (const ad of isaretOlaylari) kok.removeEventListener(ad, durdur);
  };
}

/** Katmanı kapatır: çıkış geçişi, sonra belgeden kaldırır; odağı önceki öğeye geri verir. */
function katmanKapat(kok: HTMLElement, onceki: Element | null): void {
  kok.classList.remove('fs-giris');
  kok.classList.add('fs-cikis');
  setTimeout(() => kok.remove(), 200);
  try {
    if (onceki instanceof HTMLElement && onceki.isConnected) onceki.focus({ preventScroll: true });
  } catch {
    /* odak verilemedi */
  }
}

function girisOynat(kok: HTMLElement): void {
  requestAnimationFrame(() => requestAnimationFrame(() => kok.classList.add('fs-giris')));
}

/** Tam ekran deneme reklamı. */
function reklamKatmani(yer: ReklamYeri, sureMs: number): Promise<'odul' | 'iptal'> {
  return new Promise((coz) => {
    const onceki = document.activeElement;
    const kok = oge('div', 'fs-kok fs-reklam');
    kok.setAttribute('role', 'dialog');
    kok.setAttribute('aria-modal', 'true');
    kok.setAttribute('aria-label', t('Deneme reklamı', 'Test ad'));
    kok.style.setProperty('--fs-sure', `${Math.max(0, sureMs)}ms`);

    const etiket = oge('span', 'fs-etiket', t('Deneme reklamı', 'Test ad'));
    const kapat = oge('button', 'fs-dg fs-dg-ikincil fs-kapat');
    kapat.type = 'button';
    kapat.append(svgOge(KAPAT_SVG), oge('span', '', t('Kapat', 'Close')));
    const ust = oge('div', 'fs-ust');
    ust.append(etiket, kapat);

    const sayi = oge('span', 'fs-sayi', String(Math.max(1, Math.ceil(sureMs / 1000))));
    const halka = oge('div', 'fs-halka');
    halka.append(svgOge(HALKA_SVG), sayi, svgOge(TAMAM_SVG));
    const odul = oge('p', 'fs-odul', yer === 'can' ? t('Ödül: +1 can', 'Reward: +1 life') : t('Ödül: +5 hamle', 'Reward: +5 moves'));
    const orta = oge('div', 'fs-orta');
    orta.append(halka, odul);

    const al = oge('button', 'fs-dg fs-dg-birincil fs-al', t('Ödülü al', 'Get reward'));
    al.type = 'button';
    al.disabled = true;
    const alt = oge('div', 'fs-alt');
    alt.append(al);

    kok.append(ust, orta, alt);

    let bitti = false;
    let zaman: ReturnType<typeof setTimeout> | null = null;
    const bitir = (sonuc: 'odul' | 'iptal') => {
      if (bitti) return;
      bitti = true;
      if (zaman !== null) clearTimeout(zaman);
      kaldir();
      katmanKapat(kok, onceki);
      coz(sonuc);
    };
    const kaldir = katmanBagla(kok, () => bitir('iptal'));
    kapat.addEventListener('click', () => bitir('iptal'));
    al.addEventListener('click', () => bitir('odul'));

    const bas = performance.now();
    const tik = () => {
      const kalan = sureMs - (performance.now() - bas);
      if (kalan > 0) {
        sayi.textContent = String(Math.ceil(kalan / 1000));
        zaman = setTimeout(tik, Math.min(250, kalan));
        return;
      }
      zaman = null;
      kok.classList.add('fs-hazir');
      kapat.disabled = true;
      al.disabled = false;
      al.focus({ preventScroll: true });
    };

    document.body.appendChild(kok);
    kapat.focus({ preventScroll: true });
    girisOynat(kok);
    tik();
  });
}

/** Sayfa içi satın alma onayı (Play'in ödeme sayfasının yerine; alttan açılır). */
function onayKarti(urun: UrunId, fiyat: string): Promise<boolean> {
  return new Promise((coz) => {
    const onceki = document.activeElement;
    const kok = oge('div', 'fs-kok fs-satin');
    kok.setAttribute('role', 'dialog');
    kok.setAttribute('aria-modal', 'true');
    kok.setAttribute('aria-label', t('Deneme satın alma', 'Test purchase'));

    const perde = oge('div', 'fs-perde');
    const kart = oge('div', 'fs-kart');
    const etiket = oge('span', 'fs-etiket', t('Deneme satın alma', 'Test purchase'));
    const ad = oge('p', 'fs-urun', urunAdi(urun));
    const tutar = oge('p', 'fs-fiyat', fiyat);
    const not = oge('p', 'fs-not', t('Ödeme alınmaz.', 'No payment is taken.'));
    const vazgec = oge('button', 'fs-dg fs-dg-ikincil', t('Vazgeç', 'Cancel'));
    vazgec.type = 'button';
    const satin = oge('button', 'fs-dg fs-dg-birincil', t('Satın al', 'Buy'));
    satin.type = 'button';
    const sira = oge('div', 'fs-sira');
    sira.append(vazgec, satin);
    kart.append(etiket, ad, tutar, not, sira);
    kok.append(perde, kart);

    let bitti = false;
    const bitir = (evet: boolean) => {
      if (bitti) return;
      bitti = true;
      kaldir();
      katmanKapat(kok, onceki);
      coz(evet);
    };
    const kaldir = katmanBagla(kok, () => bitir(false));
    vazgec.addEventListener('click', () => bitir(false));
    satin.addEventListener('click', () => bitir(true));
    // Boşluğa dokunmak vazgeçmektir (Play'in ödeme sayfası gibi).
    perde.addEventListener('click', () => bitir(false));

    document.body.appendChild(kok);
    satin.focus({ preventScroll: true });
    girisOynat(kok);
  });
}
