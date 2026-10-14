/**
 * Yol çizici (P2b, GDD §3.3, §13.7): Pointer Events + klavye → `YolGeriCagirim`.
 * Kural mantığı saf `yolMantigi.ts`'te; bu dosya yalnız DOM'u bağlar.
 *
 * Telefon (WhatsApp içi tarayıcı: Android Custom Tab, iOS Safari görünümü):
 *  - Yalnız ilk pointerId izlenir; ikinci parmak yok sayılır.
 *  - `setPointerCapture` + `touch-action: none` + touchstart/touchmove
 *    `preventDefault` (pasif değil): sayfa kaymaz, çift dokunma ve iki parmak
 *    yakınlaştırması olmaz. iOS'ta uzun basma menüsü (`-webkit-touch-callout`),
 *    metin seçimi, sürükle-bırak ve sağ tık menüsü kapalıdır.
 *  - Hareket/bırakma `window` üzerinden dinlenir: yakalama başarısız olsa da
 *    (eski WebView, sentetik olay) parmak tahtadan çıkınca yol takılı kalmaz.
 *  - Birleşik olaylar (`getCoalescedEvents`) varsa her biri ayrıca örneklenir.
 *
 * Koordinatlar: `geometri()` hedef öğenin sol üst köşesine göre CSS pikselidir
 * (tuval hedefin altını kaplar). `parmak()` da aynı uzayda bildirilir.
 *
 * Yorum kararları:
 *  - Özel taşa sürüklemesiz dokunuş (`birakildi`/`iptal` çağrılmaz): yol
 *    `yolDegisti([], false, 'temizlendi')` ile silinir, sonra `ozelDokunus`
 *    (ilk) ya da `ciftDokunus` (300 ms içinde ikinci) çağrılır. Düz kapsüle
 *    dokunuş ise |yol| = 1 ile `birakildi` olur (uygulama "fıs" çalar).
 *  - 'secim' kipinde parmağın KALKTIĞI hücre seçilir (yanlış basışta parmak
 *    tahtadan kaydırılıp iptal edilebilir).
 *  - Kip değişince süren yol `iptal` ile biter.
 *  - Klavye: Boşluk ve Enter odaktaki DOM düğmesinde ise düğmeye bırakılır;
 *    metin alanlarında hiçbir tuş işlenmez. Fare/dokunuş imleci gizler.
 */
import { icinde } from '../core/index';
import type { Konum, OyunDurumu } from '../core/types';
import type { TahtaGeometrisi, YolCizici, YolCiziciSecenek } from '../app/sozlesme';
import {
  CIFT_DOKUNUS_HAREKETI,
  CiftDokunusTakibi,
  boslukAdimi,
  geriAlAdimi,
  hucreAnahtari,
  imlecBaslangici,
  imlecTasi,
  noktadakiHucre,
  yolBaslat,
  yolSurukle,
  type Nokta,
  type YolAdimSonucu,
  type YolDurumu,
  type YolKisiti,
} from './yolMantigi';

type Kip = 'cizim' | 'secim' | 'kapali';
type TusEylemi = { tur: 'yon'; dx: number; dy: number } | { tur: 'bosluk' | 'geri' | 'birak' | 'iptal' | 'ates' };

/** Ok tuşları ve numpad (NumLock açık/kapalı fark etmez: `code`). */
const YON_KODLARI: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  Numpad8: [0, -1],
  Numpad2: [0, 1],
  Numpad4: [-1, 0],
  Numpad6: [1, 0],
  Numpad7: [-1, -1],
  Numpad9: [1, -1],
  Numpad1: [-1, 1],
  Numpad3: [1, 1],
};
/** Q/E/Z/C çapraz (§13.7): yazılan harfe göre (Türkçe Q klavyede de aynı yer). */
const YON_HARFLERI: Record<string, [number, number]> = { q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1] };

export function tusEylemi(e: Pick<KeyboardEvent, 'key' | 'code'>): TusEylemi | null {
  const yon = YON_KODLARI[e.code] ?? YON_KODLARI[e.key] ?? (e.key.length === 1 ? YON_HARFLERI[e.key.toLowerCase()] : undefined);
  if (yon) return { tur: 'yon', dx: yon[0], dy: yon[1] };
  if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar') return { tur: 'bosluk' };
  if (e.key === 'Backspace') return { tur: 'geri' };
  if (e.key === 'Enter' || e.code === 'NumpadEnter') return { tur: 'birak' };
  if (e.key === 'Escape' || e.key === 'Esc') return { tur: 'iptal' };
  if (e.key.length === 1 && e.key.toLowerCase() === 'd') return { tur: 'ates' };
  return null;
}

function ozelTasMi(d: OyunDurumu, h: Konum): boolean {
  const c = d.hucreler[h.y * d.w + h.x];
  return !c.delik && !c.kafes && c.icerik?.tur === 'kapsul' && c.icerik.ozel !== 'yok';
}

/** Stil özelliği ve önceki değeri (yokEt'te geri yüklenir). */
const STILLER: [string, string][] = [
  ['touch-action', 'none'],
  ['user-select', 'none'],
  ['-webkit-user-select', 'none'],
  ['-webkit-touch-callout', 'none'],
  ['-webkit-tap-highlight-color', 'transparent'],
  ['-webkit-user-drag', 'none'],
];

export function yolCiziciOlustur(s: YolCiziciSecenek): YolCizici {
  const el = s.hedef;
  const gc = s.geriCagirim;
  let kip: Kip = 'cizim';
  let zorunluListe: Konum[] | null = null;
  const kisit: YolKisiti = { zorunlu: null };

  // İşaretçi durumu
  let aktif: number | null = null;
  let kutu: DOMRect | null = null;
  let geo: TahtaGeometrisi | null = null;
  let basNokta: Nokta = { x: 0, y: 0 };
  let sonNokta: Nokta = { x: 0, y: 0 };
  let basZaman = 0;
  let hareket = 0;
  // Ortak yol (işaretçi ya da klavye)
  let yol: YolDurumu | null = null;
  const cift = new CiftDokunusTakibi();
  let imlec: Konum | null = null;

  const eskiStil = STILLER.map(([ad]) => el.style.getPropertyValue(ad));
  for (const [ad, deger] of STILLER) el.style.setProperty(ad, deger);

  function bildir(r: YolAdimSonucu): void {
    yol = { yol: r.yol, halka: r.halka };
    gc.yolDegisti(r.yol, r.halka, r.degisim ?? undefined);
  }

  function noktaya(e: { clientX: number; clientY: number }): Nokta {
    const k = kutu!;
    const g = geo!;
    return { x: (e.clientX - k.left - g.x) / g.hucre, y: (e.clientY - k.top - g.y) / g.hucre };
  }

  function piksel(e: { clientX: number; clientY: number }): { x: number; y: number } {
    return { x: e.clientX - kutu!.left, y: e.clientY - kutu!.top };
  }

  function imleciGizle(): void {
    if (!imlec) return;
    imlec = null;
    gc.imlecDegisti?.(null);
  }

  /** Etkin işaretçiyi bırakır (yol durumuna dokunmaz). */
  function isaretciyiBirak(): void {
    const id = aktif;
    aktif = null;
    kutu = null;
    geo = null;
    if (id !== null) {
      try {
        if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
      } catch {
        /* yakalama zaten yok */
      }
    }
  }

  /** Süren yolu iptal eder (pointercancel, Esc, kip değişimi). */
  function yoluIptalEt(): void {
    if (!yol) return;
    yol = null;
    gc.parmak(null);
    gc.iptal();
  }

  function isle(d: OyunDurumu, p: Nokta): void {
    const h = Math.hypot(p.x - basNokta.x, p.y - basNokta.y);
    if (h > hareket) hareket = h;
    if (kip === 'cizim' && yol) {
      const r = yolSurukle(d, yol, sonNokta, p, kisit);
      for (const a of r.adimlar) bildir(a);
    }
    sonNokta = p;
  }

  // ─── İşaretçi ────────────────────────────────────────────────────────

  function basildi(e: PointerEvent): void {
    if (e.cancelable) e.preventDefault();
    if (aktif !== null) return; // yalnız ilk pointerId
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gc.dokunuldu?.();
    imleciGizle();
    if (kip === 'kapali') return;
    const d = s.durum();
    if (!d) return;
    if (yol) yoluIptalEt(); // klavyeyle başlamış yol varsa
    aktif = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* sentetik olay ya da desteklenmiyor: window dinleyicileri yeter */
    }
    kutu = el.getBoundingClientRect();
    geo = s.geometri();
    basNokta = sonNokta = noktaya(e);
    basZaman = e.timeStamp;
    hareket = 0;
    if (kip === 'cizim') {
      const r = yolBaslat(d, basNokta, kisit);
      if (r) {
        bildir(r);
        gc.parmak(piksel(e));
      }
    }
  }

  function hareketEtti(e: PointerEvent): void {
    if (e.pointerId !== aktif) return;
    if (e.cancelable) e.preventDefault();
    const d = s.durum();
    if (!d || !kutu || !geo) return;
    const birlesik = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    if (birlesik.length > 1) for (const c of birlesik) isle(d, noktaya(c));
    else isle(d, noktaya(e));
    if (kip === 'cizim' && yol) gc.parmak(piksel(e));
  }

  function kalkti(e: PointerEvent): void {
    if (e.pointerId !== aktif) return;
    if (e.cancelable) e.preventDefault();
    const d = s.durum();
    if (d && kutu && geo) isle(d, noktaya(e));
    const p = sonNokta;
    isaretciyiBirak();
    if (!d) {
      yoluIptalEt();
      return;
    }
    if (kip === 'secim') {
      const h = noktadakiHucre(d, p);
      if (h) gc.hucreSecildi(h);
      return;
    }
    if (kip !== 'cizim' || !yol) return;
    const y = yol;
    yol = null;
    gc.parmak(null);
    if (y.yol.length === 1 && hareket <= CIFT_DOKUNUS_HAREKETI && ozelTasMi(d, y.yol[0])) {
      gc.yolDegisti([], false, 'temizlendi');
      const sonuc = cift.dokunus(y.yol[0], basZaman, e.timeStamp, hareket);
      if (sonuc === 'cift') gc.ciftDokunus({ ...y.yol[0] });
      else if (sonuc === 'ilk') gc.ozelDokunus?.({ ...y.yol[0] });
      return;
    }
    cift.sifirla();
    gc.birakildi(y.yol, y.halka);
  }

  function iptalOldu(e: PointerEvent): void {
    if (e.pointerId !== aktif) return;
    isaretciyiBirak();
    yoluIptalEt();
  }

  /** Pencere odağı ya da sekme kaybolursa süren sürükleme iptal. */
  function odakKayboldu(): void {
    if (aktif === null) return;
    isaretciyiBirak();
    yoluIptalEt();
  }

  function gorunurlukDegisti(): void {
    if (document.visibilityState === 'hidden') odakKayboldu();
  }

  const engelle = (e: Event) => {
    if (e.cancelable) e.preventDefault();
  };

  // ─── Klavye (§13.7) ──────────────────────────────────────────────────

  function tusBasildi(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const hedef = e.target as HTMLElement | null;
    if (hedef && (hedef.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(hedef.tagName))) return;
    const ey = tusEylemi(e);
    if (!ey) return;
    const dugmede = !!hedef && /^(BUTTON|A|SUMMARY)$/.test(hedef.tagName);
    if (dugmede && (ey.tur === 'bosluk' || ey.tur === 'birak')) return;
    if (e.repeat && ey.tur !== 'yon' && ey.tur !== 'geri') {
      e.preventDefault();
      return;
    }

    if (aktif !== null) {
      // Parmak/fare sürüklerken yalnız Esc.
      if (ey.tur === 'iptal') {
        e.preventDefault();
        isaretciyiBirak();
        yoluIptalEt();
      }
      return;
    }

    if (kip === 'kapali') {
      if (ey.tur === 'bosluk' || ey.tur === 'birak') {
        e.preventDefault();
        gc.dokunuldu?.();
      }
      return;
    }
    const d = s.durum();
    if (!d) return;
    e.preventDefault();
    gc.dokunuldu?.();
    // Bölüm değiştiyse imleç yeni tahtanın dışında/delikte kalmış olabilir: yeniden konumla.
    if (imlec && (!icinde(d, imlec.x, imlec.y) || d.hucreler[imlec.y * d.w + imlec.x].delik)) imleciGizle();

    const imleciGoster = (): Konum => {
      const yeni = imlecBaslangici(d, yol?.yol ?? null, zorunluListe);
      imlec = yeni;
      gc.imlecDegisti?.({ ...yeni });
      return yeni;
    };

    if (ey.tur === 'yon') {
      if (!imlec) {
        imleciGoster();
        return;
      }
      const yeni = imlecTasi(d, imlec, ey.dx, ey.dy);
      if (yeni.x !== imlec.x || yeni.y !== imlec.y) {
        imlec = yeni;
        gc.imlecDegisti?.({ ...yeni });
      }
      return;
    }

    if (kip === 'secim') {
      if (ey.tur === 'bosluk' || ey.tur === 'birak') {
        if (!imlec) imleciGoster();
        else gc.hucreSecildi({ ...imlec });
      } else if (ey.tur === 'iptal') gc.iptal();
      return;
    }

    // 'cizim'
    switch (ey.tur) {
      case 'bosluk': {
        if (!imlec) {
          imleciGoster();
          return;
        }
        const r = boslukAdimi(d, yol, imlec, kisit);
        if (r) bildir(r);
        return;
      }
      case 'geri': {
        if (!yol) return;
        const r = geriAlAdimi(yol);
        if (r) bildir(r);
        else yoluIptalEt();
        return;
      }
      case 'birak': {
        if (!yol) return;
        const y = yol;
        yol = null;
        cift.sifirla();
        gc.birakildi(y.yol, y.halka);
        return;
      }
      case 'iptal':
        yoluIptalEt();
        return;
      case 'ates': {
        if (!imlec) {
          imleciGoster();
          return;
        }
        if (yol || !ozelTasMi(d, imlec)) return;
        gc.ciftDokunus({ ...imlec });
        return;
      }
    }
  }

  // ─── Dinleyiciler ────────────────────────────────────────────────────

  const aktifDegil = { passive: false } as const;
  el.addEventListener('pointerdown', basildi, aktifDegil);
  window.addEventListener('pointermove', hareketEtti, aktifDegil);
  window.addEventListener('pointerup', kalkti, aktifDegil);
  window.addEventListener('pointercancel', iptalOldu);
  el.addEventListener('lostpointercapture', iptalOldu);
  el.addEventListener('touchstart', engelle, aktifDegil);
  el.addEventListener('touchmove', engelle, aktifDegil);
  el.addEventListener('gesturestart', engelle, aktifDegil);
  el.addEventListener('contextmenu', engelle);
  el.addEventListener('selectstart', engelle);
  el.addEventListener('dragstart', engelle);
  el.addEventListener('dblclick', engelle);
  window.addEventListener('keydown', tusBasildi);
  window.addEventListener('blur', odakKayboldu);
  document.addEventListener('visibilitychange', gorunurlukDegisti);

  return {
    kipAyarla(k: Kip): void {
      if (k === kip) return;
      if (aktif !== null) isaretciyiBirak();
      yoluIptalEt();
      cift.sifirla();
      kip = k;
      if (k === 'kapali') imleciGizle();
    },
    zorunluAyarla(hucreler: readonly Konum[] | null): void {
      zorunluListe = hucreler && hucreler.length ? hucreler.map((h) => ({ x: h.x, y: h.y })) : null;
      kisit.zorunlu = zorunluListe ? new Set(zorunluListe.map((h) => hucreAnahtari(h.x, h.y))) : null;
    },
    imlec(): Konum | null {
      return imlec ? { ...imlec } : null;
    },
    yokEt(): void {
      isaretciyiBirak();
      yol = null;
      el.removeEventListener('pointerdown', basildi);
      window.removeEventListener('pointermove', hareketEtti);
      window.removeEventListener('pointerup', kalkti);
      window.removeEventListener('pointercancel', iptalOldu);
      el.removeEventListener('lostpointercapture', iptalOldu);
      el.removeEventListener('touchstart', engelle);
      el.removeEventListener('touchmove', engelle);
      el.removeEventListener('gesturestart', engelle);
      el.removeEventListener('contextmenu', engelle);
      el.removeEventListener('selectstart', engelle);
      el.removeEventListener('dragstart', engelle);
      el.removeEventListener('dblclick', engelle);
      window.removeEventListener('keydown', tusBasildi);
      window.removeEventListener('blur', odakKayboldu);
      document.removeEventListener('visibilitychange', gorunurlukDegisti);
      STILLER.forEach(([ad], i) => {
        if (eskiStil[i]) el.style.setProperty(ad, eskiStil[i]);
        else el.style.removeProperty(ad);
      });
    },
  };
}
