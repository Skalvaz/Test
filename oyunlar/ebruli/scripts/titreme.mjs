/**
 * EBRULİ boşta titreme ölçümü (tablet ve telefon profilleri; Playwright).
 *
 *   npx vite --port 5287 --strictPort --host 127.0.0.1      (ya da tek dosya: file://…/ebruli.html)
 *   node scripts/titreme.mjs [url] [çıktı-klasörü] [profiller|hepsi] [--sure 25] [--bolumler 1,6] [--deney kalite,boyut,yarim] [--kare 15]
 *
 * Profiller (virgülle): t-dikey, t-yatay, t-768, t-1024, t-galaxy, t-kesirli,
 * tel-390, tel-360, masaustu-istek. Varsayılan hepsi.
 *
 * Her profilde: açılış → Bölüm 1 (öğretim; zorunlu ilk hamle eli döner) →
 * HİÇ DOKUNMADAN `sure` sn bekle; sonra Bölüm 6, bot ile 3 hamle → yine
 * `sure` sn boşta. Bekleme sırasında sayfa İÇİNDE (addInitScript) kaydedilir:
 *   1) her tuval width/height ataması (hangi tuval, eski→yeni, hangi evrede:
 *      rAF / ResizeObserver / resize olayı / zamanlayıcı / diğer, kısa yığın),
 *   2) ResizeObserver geri çağrıları, window resize, visualViewport resize/scroll,
 *   3) rAF aralıkları, oyunun rAF geri çağrısının süresi (≈ kaliteOlc maliyeti),
 *      otomatik kalite geçişleri (window.__ebruli.cizici().kalite),
 *   4) MutationObserver (öğe/sınıf/style), document.getAnimations() özetleri,
 *   5) ana tuvalden ~80 ms'de bir 64×64 örnek: ortalama parlaklık, önceki
 *      örneğe fark, 8×8 blok farkı; çukur (sıçrayıp geri dönen) ve siyah kare
 *      işaretleri; ayrıca ardışık page.screenshot dizisi ve en uç kareleri,
 *   6) boşta çalışan setTimeout/setInterval (süre, kaynak, sayı),
 *   +) ana tuvale rAF DIŞINDA yapılan çizimler, kare başına çizim sırası
 *      (arka plan → son çağrı süresi: desynchronized ön tamponda "yarım kare"
 *      riski taşıyan pencere).
 * Deneyler (yalnız dev sunucusunda; çiziciye modül içe aktarımıyla erişir):
 *   kalite — kalite.zorla 2 sn'de bir değiştirilir; geçiş karesindeki piksel
 *            sıçraması normal kare farkıyla kıyaslanır;
 *   boyut  — #app 1 px daraltılıp geri alınır (yalnız ResizeObserver tetiklenir)
 *            ve pencere 1 px değiştirilir: temizlenmiş (siyah) kare sunuluyor mu;
 *   yarim  — bir karenin çizimi sırasında ara görüntüler (arka plandan hemen
 *            sonra, %25/%50/%75): ön tamponda tarama yakalarsa görülecek kare.
 * Headless yazılım çizimidir: desynchronized tuvalin gerçek donanım davranışı
 * (ön tampon/overlay, yırtılma) burada YENİDEN ÜRETİLEMEZ; mantık düzeyi ölçülür.
 *
 * Çıktı: <çıktı>/<profil>/<senaryo>.json, kareler (png), <çıktı>/ozet.json,
 * <çıktı>/ozet.txt.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

// ── Argümanlar
const argv = process.argv.slice(2);
const konum = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const bayrak = (ad, vars) => {
  const i = argv.indexOf(`--${ad}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : vars;
};
const URL = konum[0] || 'http://127.0.0.1:5287/';
const OUT = konum[1] || 'playtest-output/titreme';
const SECIM = konum[2] && konum[2] !== 'hepsi' ? konum[2].split(',') : null;
const SURE = +bayrak('sure', '25') * 1000;
const BOLUMLER = bayrak('bolumler', '1,6').split(',').map(Number);
const DENEYLER = bayrak('deney', 'kalite,boyut,yarim').split(',').filter(Boolean);
const KARE_SAYISI = +bayrak('kare', '15');
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
mkdirSync(OUT, { recursive: true });

const UA_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Safari/537.36';
const UA_TELEFON = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36';
const UA_MASAUSTU = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PROFILLER = [
  { ad: 't-dikey', tur: 'tablet', w: 800, h: 1280, dpr: 1.5, mobil: true, ua: UA_TABLET, not: '10" tablet dikey' },
  { ad: 't-yatay', tur: 'tablet', w: 1280, h: 800, dpr: 1.5, mobil: true, ua: UA_TABLET, not: '10" tablet yatay' },
  { ad: 't-768', tur: 'tablet', w: 768, h: 1024, dpr: 2, mobil: true, ua: UA_TABLET, not: '768×1024 dikey' },
  { ad: 't-1024', tur: 'tablet', w: 1024, h: 768, dpr: 2, mobil: true, ua: UA_TABLET, not: '1024×768 yatay' },
  { ad: 't-galaxy', tur: 'tablet', w: 900, h: 1440, dpr: 2, mobil: true, ua: UA_TABLET, not: 'Galaxy Tab boyu' },
  { ad: 't-kesirli', tur: 'tablet', w: 601, h: 962, dpr: 1.3312, mobil: true, ua: UA_TABLET, not: '8" tablet, kesirli DPR' },
  { ad: 'tel-390', tur: 'telefon', w: 390, h: 844, dpr: 3, mobil: true, ua: UA_TELEFON, not: 'telefon' },
  { ad: 'tel-360', tur: 'telefon', w: 360, h: 800, dpr: 2.625, mobil: true, ua: UA_TELEFON, not: 'telefon, kesirli DPR' },
  { ad: 'masaustu-istek', tur: 'tablet', w: 1280, h: 800, dpr: 1.5, mobil: false, ua: UA_MASAUSTU, not: '"masaüstü sitesi iste" (isMobile false + dokunma)' },
].filter((p) => !SECIM || SECIM.includes(p.ad));

// ── Sayfa içi ölçüm (addInitScript; uygulamanın kodundan ÖNCE çalışır)
function olcumKur() {
  const P = performance.now.bind(performance);
  const st = window.setTimeout.bind(window);
  const si = window.setInterval.bind(window);
  const raf = window.requestAnimationFrame.bind(window);
  const T = {
    kayit: false,
    t0: 0,
    boyut: [],
    boyutTum: [],
    ro: [],
    pencere: [],
    vv: [],
    mut: [],
    mutSayac: {},
    anim: {},
    zaman: {},
    kare: [],
    oyunCb: [],
    kalite: [],
    ornek: [],
    cizim: { raf: 0, ro: 0, olay: 0, zamanlayici: 0, diger: 0 },
    disari: [],
    kareCizim: [],
    temizSunum: [],
    anaSecenek: null,
    anaAttr: null,
    olayIz: [],
    yarim: null,
    yarimIste: false,
  };
  window.__tt = T;
  window.__ttOrijinal = { st, si, raf, P };
  let faz = 'diger';
  const sinirli = (a, x, n = 4000) => {
    if (a.length < n) a.push(x);
  };
  const ids = new WeakMap();
  let nid = 0;
  const cid = (c) => {
    let i = ids.get(c);
    if (!i) {
      i = ++nid;
      ids.set(c, i);
    }
    return i;
  };
  const tum = new Set();
  const kisaYigin = () =>
    (new Error().stack || '')
      .split('\n')
      .slice(3, 7)
      .map((s) => s.trim().replace(/^at /, '').replace(/(https?|file):\/\/[^)\s]*\/(src|node_modules)\//g, '$2/').replace(/\?[^:)]*/g, ''))
      .join(' < ');
  const tanim = (n) => {
    if (!n || n.nodeType !== 1) return n && n.nodeType === 3 ? '#text' : String(n && n.nodeName);
    const s = typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + s;
  };

  // 1) Tuval boyut ayarlayıcıları
  for (const ad of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, ad);
    Object.defineProperty(HTMLCanvasElement.prototype, ad, {
      configurable: true,
      enumerable: d.enumerable,
      get() {
        return d.get.call(this);
      },
      set(v) {
        const eski = d.get.call(this);
        d.set.call(this, v);
        tum.add(new WeakRef(this));
        const kayit = { t: Math.round(P() - T.t0), id: cid(this), ana: !!this.__ana, bagli: this.isConnected, sinif: this.className || '', ad, eski, yeni: v, faz, yigin: kisaYigin() };
        if (this.__ana) {
          T.anaTemizlendi = { t: P(), faz };
          sinirli(T.boyutTum, kayit, 500);
        }
        if (T.kayit) sinirli(T.boyut, kayit);
      },
    });
  }
  T.tuvalBellegi = () => {
    let px = 0;
    let n = 0;
    let bagli = 0;
    for (const r of tum) {
      const c = r.deref();
      if (!c) {
        tum.delete(r);
        continue;
      }
      n++;
      px += c.width * c.height;
      if (c.isConnected) bagli++;
    }
    return { n, bagli, mpx: +(px / 1e6).toFixed(2), mb: +((px * 4) / 1048576).toFixed(1) };
  };

  // Ana (desynchronized) tuval: bağlam sarılır, çizimler evreye göre sayılır.
  const SARILACAK = ['drawImage', 'fillRect', 'clearRect', 'fill', 'stroke', 'putImageData', 'fillText', 'strokeText'];
  let kareOp = 0;
  let kareBas = 0;
  let kareArka = 0;
  let kareSon = 0;
  let oncekiOp = 0;
  let anaTuval = null;
  const yarimAl = (etiket) => {
    const c = anaTuval;
    const o = document.createElement('canvas');
    o.width = Math.max(1, Math.round(c.width / 2));
    o.height = Math.max(1, Math.round(c.height / 2));
    o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
    T.yarim.push({ etiket, op: kareOp, ms: +(P() - kareBas).toFixed(2), url: o.toDataURL('image/png') });
  };
  const sar = (ctx, tuval) => {
    for (const m of SARILACAK) {
      const o = ctx[m];
      if (typeof o !== 'function') continue;
      ctx[m] = function (...a) {
        const r = o.apply(this, a);
        const f = faz.startsWith('olay') ? 'olay' : faz;
        T.cizim[f] = (T.cizim[f] || 0) + 1;
        if (f === 'raf') {
          if (kareOp === 0) kareBas = P();
          kareOp++;
          kareSon = P();
          if (!kareArka && m === 'drawImage' && a.length >= 5 && a[3] >= tuval.width / (window.devicePixelRatio || 1) * 0.9) {
            kareArka = P();
            if (T.yarim && T.yarim.length === 0) yarimAl('arka plan çizildikten hemen sonra');
          } else if (T.yarim && T.yarim.length > 0 && T.yarim.length < 4 && oncekiOp > 0) {
            const hedef = [0, 0.25, 0.5, 0.75][T.yarim.length];
            if (kareOp >= Math.floor(oncekiOp * hedef)) yarimAl(`çizim %${Math.round(hedef * 100)}`);
          }
        } else if (T.kayit) sinirli(T.disari, { t: Math.round(P() - T.t0), m, faz, yigin: kisaYigin() }, 300);
        return r;
      };
    }
  };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tur, sec) {
    const ctx = gc.call(this, tur, sec);
    if (tur === '2d' && sec && sec.desynchronized && !this.__ana && ctx) {
      this.__ana = true;
      anaTuval = this;
      T.anaSecenek = { ...sec };
      try {
        T.anaAttr = ctx.getContextAttributes ? ctx.getContextAttributes() : null;
      } catch {
        T.anaAttr = null;
      }
      sar(ctx, this);
      window.__anaTuval = this;
    }
    return ctx;
  };

  // rAF evresi + oyunun geri çağrı süresi
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      const f = faz;
      faz = 'raf';
      const a = P();
      try {
        cb(t);
      } finally {
        faz = f;
        if (T.kayit) sinirli(T.oyunCb, +(P() - a).toFixed(2), 20000);
      }
    });

  // ResizeObserver
  const RO = window.ResizeObserver;
  if (RO) {
    window.ResizeObserver = class extends RO {
      constructor(cb) {
        super((girdiler, gozcu) => {
          const e = girdiler[0];
          if (T.kayit || true) sinirli(T.ro, { t: Math.round(P() - T.t0), kayit: T.kayit, n: girdiler.length, hedef: tanim(e && e.target), w: e && +e.contentRect.width.toFixed(3), h: e && +e.contentRect.height.toFixed(3) }, 500);
          const f = faz;
          faz = 'ro';
          try {
            cb(girdiler, gozcu);
          } finally {
            faz = f;
          }
        });
      }
    };
  }

  // resize / scroll dinleyicileri: evre etiketi
  const ael = EventTarget.prototype.addEventListener;
  const rel = EventTarget.prototype.removeEventListener;
  const harita = new WeakMap();
  EventTarget.prototype.addEventListener = function (tip, fn, opt) {
    if ((tip === 'resize' || tip === 'scroll') && (this === window || this === window.visualViewport) && typeof fn === 'function') {
      const kim = this === window ? 'w' : 'vv';
      let s = harita.get(fn);
      if (!s) {
        s = function (e) {
          const f = faz;
          faz = `olay:${kim}${tip}`;
          try {
            return fn.call(this, e);
          } finally {
            faz = f;
          }
        };
        harita.set(fn, s);
      }
      return ael.call(this, tip, s, opt);
    }
    return ael.call(this, tip, fn, opt);
  };
  EventTarget.prototype.removeEventListener = function (tip, fn, opt) {
    return rel.call(this, tip, harita.get(fn) || fn, opt);
  };
  ael.call(window, 'resize', () => sinirli(T.pencere, { t: Math.round(P() - T.t0), kayit: T.kayit, iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio }, 500));
  const vvKur = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    for (const tip of ['resize', 'scroll']) ael.call(vv, tip, () => sinirli(T.vv, { t: Math.round(P() - T.t0), kayit: T.kayit, tip, w: +vv.width.toFixed(2), h: +vv.height.toFixed(2), s: +vv.scale.toFixed(3), ox: +vv.offsetTop.toFixed(2) }, 500));
  };
  vvKur();

  // 6) Zamanlayıcılar
  const zKaydet = (tur, ms) => {
    if (!T.kayit) return;
    const y = kisaYigin().split(' < ')[0] || '?';
    const k = `${tur} ${Math.round(+ms || 0)}ms @ ${y}`;
    T.zaman[k] = (T.zaman[k] || 0) + 1;
  };
  const sarZ = (fn) =>
    typeof fn === 'function'
      ? function (...a) {
          const f = faz;
          faz = 'zamanlayici';
          try {
            return fn.apply(this, a);
          } finally {
            faz = f;
          }
        }
      : fn;
  window.setTimeout = function (fn, ms, ...a) {
    zKaydet('setTimeout', ms);
    return st(sarZ(fn), ms, ...a);
  };
  window.setInterval = function (fn, ms, ...a) {
    zKaydet('setInterval', ms);
    return si(sarZ(fn), ms, ...a);
  };

  // 4) DOM değişiklikleri (kayıt başlayınca)
  let mo = null;
  T.mutBaslat = () => {
    if (mo) mo.disconnect();
    mo = new MutationObserver((l) => {
      const t = Math.round(P() - T.t0);
      for (const m of l) {
        let k;
        if (m.type === 'attributes') {
          const yeni = m.target.getAttribute(m.attributeName);
          k = `${m.attributeName} ${tanim(m.target)}`;
          if (T.mut.length < 1500) T.mut.push({ t, tur: 'öznitelik', hedef: tanim(m.target), ad: m.attributeName, eski: (m.oldValue || '').slice(0, 120), yeni: (yeni || '').slice(0, 120) });
        } else if (m.type === 'childList') {
          k = `childList ${tanim(m.target)}`;
          if (T.mut.length < 1500) T.mut.push({ t, tur: 'çocuk', hedef: tanim(m.target), eklenen: [...m.addedNodes].map(tanim).slice(0, 4), silinen: [...m.removedNodes].map(tanim).slice(0, 4) });
        } else {
          k = `metin ${tanim(m.target.parentNode)}`;
          if (T.mut.length < 1500) T.mut.push({ t, tur: 'metin', hedef: tanim(m.target.parentNode), yeni: (m.target.data || '').slice(0, 60) });
        }
        T.mutSayac[k] = (T.mutSayac[k] || 0) + 1;
      }
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true });
  };

  // 3) + 5) Kendi rAF döngümüz: uygulamanınkinden ÖNCE kayıtlı, her karenin başında çalışır
  // (okunan tuval = bir önceki karede sunulan içerik).
  const ornekT = document.createElement('canvas');
  ornekT.width = 64;
  ornekT.height = 64;
  ornekT.__olcum = true;
  let octx = null;
  let onceki = null;
  let sonOrnek = 0;
  let sonAnim = 0;
  let sonT = 0;
  let sonKalite = null;
  let kareNo = 0;
  const animOzet = () => {
    let l = [];
    try {
      l = document.getAnimations();
    } catch {
      return;
    }
    const t = Math.round(P() - T.t0);
    for (const a of l) {
      const ef = a.effect;
      const tm = ef && ef.getTiming ? ef.getTiming() : {};
      const ad = a.animationName || (a.transitionProperty ? `geçiş:${a.transitionProperty}` : a.id || a.constructor.name);
      const k = `${ad} @ ${tanim(ef && ef.target)}`;
      const o = T.anim[k] || (T.anim[k] = { ad, hedef: tanim(ef && ef.target), sure: tm.duration, yineleme: tm.iterations, ilk: t, son: t, kez: 0, durum: a.playState });
      o.son = t;
      o.kez++;
      o.durum = a.playState;
    }
  };
  const dongu = (t) => {
    raf(dongu);
    kareNo++;
    // Önceki karenin çizim sırası
    if (kareOp) {
      if (T.kayit) sinirli(T.kareCizim, { op: kareOp, arkaSonrasiMs: kareArka ? +(kareSon - kareArka).toFixed(2) : null, toplamMs: +(kareSon - kareBas).toFixed(2) }, 3000);
      oncekiOp = kareOp;
      if (T.yarim && T.yarim.length && !T.yarim.bitti) {
        T.yarim.bitti = true;
        yarimAl('kare sonu (sunulan)');
      }
    }
    if (T.yarimIste && anaTuval) {
      T.yarimIste = false;
      T.yarim = [];
    }
    kareOp = 0;
    kareArka = 0;
    // Temizlenmiş kare sunuldu mu: ana tuval son karede rAF dışında boyutlandıysa ve
    // ardından rAF içinde çizilmediyse, bir önceki boya bu temiz (siyah) içeriği gösterdi.
    if (T.anaTemizlendi && T.anaTemizlendi.faz !== 'raf') {
      if (T.kayit || true) sinirli(T.temizSunum, { t: Math.round(T.anaTemizlendi.t - T.t0), faz: T.anaTemizlendi.faz, kayit: T.kayit }, 200);
    }
    T.anaTemizlendi = null;
    if (!T.kayit) {
      sonT = t;
      return;
    }
    if (sonT) sinirli(T.kare, +(t - sonT).toFixed(2), 20000);
    sonT = t;
    const p = P();
    if (kareNo % 3 === 0) {
      try {
        const c = window.__ebruli && window.__ebruli.cizici ? window.__ebruli.cizici() : null;
        const k = c ? c.kalite : null;
        const cz = window.__ciz;
        const ic = cz ? { dusuk: cz.kalite.dusuk, n: cz.kalite.n, m: cz.kalite.m, vurgu: cz.vurgu ? cz.vurgu.kip : null, el: !!cz.el } : null;
        if (k !== sonKalite) {
          T.kalite.push({ t: Math.round(p - T.t0), kalite: k, ic });
          sonKalite = k;
        }
        if (cz) {
          const iz = `${ic.vurgu || '-'}|${ic.el ? 'el' : '-'}`;
          if (iz !== T.sonIz) {
            T.sonIz = iz;
            sinirli(T.olayIz, { t: Math.round(p - T.t0), vurgu: ic.vurgu, el: ic.el }, 500);
          }
        }
      } catch {
        /* kanca yok */
      }
    }
    if (p - sonAnim > 1000) {
      sonAnim = p;
      animOzet();
    }
    if (p - sonOrnek >= 80 && anaTuval && anaTuval.width > 1) {
      sonOrnek = p;
      if (!octx) octx = ornekT.getContext('2d', { willReadFrequently: true });
      octx.drawImage(anaTuval, 0, 0, 64, 64);
      const d = octx.getImageData(0, 0, 64, 64).data;
      const l = new Float32Array(4096);
      let top = 0;
      for (let i = 0; i < 4096; i++) {
        const v = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
        l[i] = v;
        top += v;
      }
      let fark = 0;
      let blokMaks = 0;
      if (onceki) {
        const blok = new Float32Array(64);
        for (let i = 0; i < 4096; i++) {
          const f = Math.abs(l[i] - onceki[i]);
          fark += f;
          blok[((i >> 6) >> 3) * 8 + ((i & 63) >> 3)] += f;
        }
        fark /= 4096;
        for (let b = 0; b < 64; b++) blokMaks = Math.max(blokMaks, blok[b] / 64);
      }
      onceki = l;
      T.ornek.push({ t: Math.round(p - T.t0), luma: +(top / 4096).toFixed(2), fark: +fark.toFixed(3), blokMaks: +blokMaks.toFixed(2), gorunur: anaTuval.style.visibility !== 'hidden' });
    }
  };
  raf(dongu);
}

// ── Yardımcılar (node)
const yuzde = (a, q) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return +s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))].toFixed(2);
};
const hist = (a, sinir) => {
  const h = {};
  for (let i = 0; i <= sinir.length; i++) {
    const ad = i === 0 ? `<${sinir[0]}` : i === sinir.length ? `≥${sinir[i - 1]}` : `${sinir[i - 1]}–${sinir[i]}`;
    h[ad] = 0;
  }
  const adlar = Object.keys(h);
  for (const v of a) {
    let i = sinir.findIndex((s) => v < s);
    if (i < 0) i = sinir.length;
    h[adlar[i]]++;
  }
  return h;
};
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

async function bekleKosul(page, fn, arg, sure = 30000, aciklama = '') {
  const son = Date.now() + sure;
  for (;;) {
    const ok = await page.evaluate(fn, arg).catch(() => false);
    if (ok) return true;
    if (Date.now() > son) throw new Error(`zaman aşımı: ${aciklama}`);
    await page.waitForTimeout(80);
  }
}

/** Piksel örneklerinden çukur/siyah/sıçrama işaretleri. */
function pikselAnaliz(ornek) {
  const o = ornek.filter((x) => x.gorunur);
  const lumalar = o.map((x) => x.luma);
  const farklar = o.slice(1).map((x) => x.fark);
  const med = yuzde(lumalar, 0.5) ?? 0;
  const farkMed = yuzde(farklar, 0.5) ?? 0;
  const farkP99 = yuzde(farklar, 0.99) ?? 0;
  const cukur = [];
  for (let i = 1; i < o.length - 1; i++) {
    const a = o[i - 1].luma;
    const b = o[i].luma;
    const c = o[i + 1].luma;
    // Sıçrayıp geri dönen kare: komşulardan ≥ %4 (en az 1,5 birim) sapma, komşular birbirine yakın.
    const esik = Math.max(1.5, med * 0.04);
    if (Math.abs(b - a) > esik && Math.abs(b - c) > esik && Math.sign(b - a) === Math.sign(b - c) && Math.abs(a - c) < esik / 2) cukur.push({ t: o[i].t, luma: b, komsu: [a, c] });
  }
  const siyah = o.filter((x) => x.luma < 3).map((x) => x.t);
  const sicrama = o.filter((x, i) => i > 0 && x.fark > Math.max(4 * farkMed, 1.5)).map((x) => ({ t: x.t, fark: x.fark, blokMaks: x.blokMaks }));
  return {
    n: o.length,
    lumaMed: med,
    lumaMin: lumalar.length ? Math.min(...lumalar) : null,
    lumaMaks: lumalar.length ? Math.max(...lumalar) : null,
    farkMed,
    farkP99,
    farkMaks: farklar.length ? Math.max(...farklar) : null,
    blokMaks: o.length ? Math.max(...o.map((x) => x.blokMaks)) : null,
    cukur,
    siyah,
    sicrama: sicrama.slice(0, 40),
    sicramaSayisi: sicrama.length,
  };
}

/** Ekran görüntüsü dizisini ayrı (boş) bir sayfada çöz: parlaklık ve kareler arası fark. */
async function kareDizisiAnaliz(browser, pngler) {
  const p = await browser.newPage();
  try {
    return await p.evaluate(async (l) => {
      const sonuc = [];
      let onceki = null;
      for (const b64 of l) {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bm = await createImageBitmap(blob);
        const c = new OffscreenCanvas(96, 96);
        const x = c.getContext('2d');
        x.drawImage(bm, 0, 0, 96, 96);
        const d = x.getImageData(0, 0, 96, 96).data;
        const L = new Float32Array(96 * 96);
        let top = 0;
        for (let i = 0; i < L.length; i++) {
          L[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
          top += L[i];
        }
        let f = 0;
        let fm = 0;
        if (onceki) {
          for (let i = 0; i < L.length; i++) {
            const v = Math.abs(L[i] - onceki[i]);
            f += v;
            if (v > fm) fm = v;
          }
          f /= L.length;
        }
        onceki = L;
        sonuc.push({ luma: +(top / L.length).toFixed(2), fark: +f.toFixed(3), pikselMaks: Math.round(fm) });
      }
      return sonuc;
    }, pngler);
  } finally {
    await p.close();
  }
}

// ── Senaryo
async function bostaOlc(browser, page, p, senaryo, dir) {
  await page.evaluate(() => {
    const T = window.__tt;
    T.boyut = [];
    T.ro = T.ro.filter(() => false);
    T.pencere = [];
    T.vv = [];
    T.mut = [];
    T.mutSayac = {};
    T.anim = {};
    T.zaman = {};
    T.kare = [];
    T.oyunCb = [];
    T.kalite = [];
    T.ornek = [];
    T.cizim = { raf: 0, ro: 0, olay: 0, zamanlayici: 0, diger: 0 };
    T.disari = [];
    T.kareCizim = [];
    T.temizSunum = [];
    T.olayIz = [];
    T.sonIz = null;
    T.t0 = performance.now();
    T.mutBaslat();
    T.kayit = true;
  });
  await page.waitForTimeout(SURE);
  const veri = await page.evaluate(() => {
    const T = window.__tt;
    T.kayit = false;
    const s = window.__ebruli;
    const c = window.__anaTuval;
    const mq = {};
    for (const q of ['(max-width: 420px)', '(max-height: 520px)', '(pointer: coarse)', '(hover: none)', '(orientation: portrait)', '(prefers-reduced-motion: reduce)']) mq[q] = matchMedia(q).matches;
    return {
      ekran: s.ekran(),
      bolum: s.bolum(),
      boyut: s.boyut(),
      hudKip: document.querySelector('.e-hud')?.getAttribute('data-kip') ?? null,
      geometri: s.geometri(),
      cizici: s.cizici(),
      tuval: c ? { w: c.width, h: c.height, css: [c.style.width, c.style.height], vis: c.style.visibility } : null,
      anaSecenek: T.anaSecenek,
      anaAttr: T.anaAttr,
      bellek: T.tuvalBellegi(),
      mq,
      pencere: { iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, vv: visualViewport ? [visualViewport.width, visualViewport.height] : null },
      boyutlar: T.boyut,
      ro: T.ro.filter((x) => x.kayit),
      pencereOlay: T.pencere.filter((x) => x.kayit),
      vv: T.vv.filter((x) => x.kayit),
      mut: T.mut,
      mutSayac: T.mutSayac,
      anim: Object.values(T.anim),
      zaman: T.zaman,
      kare: T.kare,
      oyunCb: T.oyunCb,
      kalite: T.kalite,
      ornek: T.ornek,
      cizim: T.cizim,
      disari: T.disari,
      kareCizim: T.kareCizim,
      temizSunum: T.temizSunum.filter((x) => x.kayit),
      olayIz: T.olayIz,
    };
  });
  // Ardışık ekran görüntüleri (hâlâ boşta; css ölçeğinde, hızlı)
  const pngler = [];
  const zamanlar = [];
  const b0 = Date.now();
  for (let i = 0; i < KARE_SAYISI; i++) {
    const buf = await page.screenshot({ scale: 'css' });
    pngler.push(buf.toString('base64'));
    zamanlar.push(Date.now() - b0);
  }
  const dizi = await kareDizisiAnaliz(browser, pngler);
  dizi.forEach((d, i) => (d.ms = zamanlar[i]));
  // En uç kareler: ilk, en büyük fark, en düşük ve en yüksek parlaklık
  const kaydet = new Map();
  kaydet.set(0, 'ilk');
  let mf = 1;
  for (let i = 1; i < dizi.length; i++) if (dizi[i].fark > dizi[mf]?.fark) mf = i;
  if (dizi.length > 1) {
    kaydet.set(mf - 1, kaydet.get(mf - 1) ?? 'enbuyukfark-once');
    kaydet.set(mf, 'enbuyukfark');
  }
  let lmin = 0;
  let lmax = 0;
  dizi.forEach((d, i) => {
    if (d.luma < dizi[lmin].luma) lmin = i;
    if (d.luma > dizi[lmax].luma) lmax = i;
  });
  if (!kaydet.has(lmin)) kaydet.set(lmin, 'enkaranlik');
  if (!kaydet.has(lmax)) kaydet.set(lmax, 'enparlak');
  const dosyalar = [];
  for (const [i, ad] of kaydet) {
    const f = join(dir, `${senaryo}-kare${String(i).padStart(2, '0')}-${ad}.png`);
    writeFileSync(f, Buffer.from(pngler[i], 'base64'));
    dosyalar.push(f);
  }
  // Tam çözünürlüklü bir boşta karesi
  const tam = join(dir, `${senaryo}-bosta-tam.png`);
  await page.screenshot({ path: tam });
  dosyalar.push(tam);
  return { veri, dizi, dosyalar };
}

function ozetle(p, senaryo, r) {
  const v = r.veri;
  const piks = pikselAnaliz(v.ornek);
  const anaBoyut = v.boyutlar.filter((x) => x.ana);
  const digerBoyut = v.boyutlar.filter((x) => !x.ana);
  const gruplar = {};
  for (const b of digerBoyut) {
    const k = `${b.bagli ? 'DOM' : 'ekran dışı'} ${b.sinif || '-'} @ ${b.yigin.split(' < ').slice(0, 2).join(' < ')}`;
    gruplar[k] = (gruplar[k] || 0) + 1;
  }
  const kc = v.kareCizim;
  const oran = kc.filter((x) => x.arkaSonrasiMs != null);
  const diziF = r.dizi.slice(1).map((d) => d.fark);
  return {
    profil: p.ad,
    tur: p.tur,
    senaryo,
    gorunum: `${p.w}×${p.h} @${p.dpr}${p.mobil ? '' : ' (isMobile:false)'}`,
    ekran: v.ekran,
    bolum: v.bolum,
    hudKip: v.hudKip,
    sahne: v.boyut,
    tuvalPx: v.tuval ? `${v.tuval.w}×${v.tuval.h}` : null,
    tuvalMpx: v.tuval ? +((v.tuval.w * v.tuval.h) / 1e6).toFixed(2) : null,
    hucre: v.geometri?.hucre,
    tuvalBellegi: v.bellek,
    anaAttr: v.anaAttr,
    mq: v.mq,
    anaTuvalBoyutlanma: anaBoyut.length,
    anaTuvalBoyutlanmaOrnek: anaBoyut.slice(0, 6),
    temizKareSunumu: v.temizSunum.length,
    digerTuvalBoyutlanma: digerBoyut.length,
    digerTuvalGruplari: gruplar,
    resizeObserver: v.ro.length,
    pencereResize: v.pencereOlay.length,
    vvOlay: v.vv.length,
    mutasyon: v.mut.length,
    mutasyonEnCok: Object.entries(v.mutSayac)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    animasyon: v.anim.map((a) => `${a.ad} @ ${a.hedef} (${a.sure} ms × ${a.yineleme}, ${a.durum}, ${a.ilk}–${a.son} ms)`),
    zamanlayici: v.zaman,
    kareAraligi: { n: v.kare.length, p50: yuzde(v.kare, 0.5), p90: yuzde(v.kare, 0.9), p99: yuzde(v.kare, 0.99), maks: v.kare.length ? Math.max(...v.kare) : null, dagilim: hist(v.kare, [12, 18, 20, 25, 40, 70, 100]) },
    oyunCbMs: { p50: yuzde(v.oyunCb, 0.5), p90: yuzde(v.oyunCb, 0.9), maks: v.oyunCb.length ? Math.max(...v.oyunCb) : null },
    kalite: v.kalite,
    cizimEvre: v.cizim,
    rafDisiCizim: v.disari.slice(0, 10),
    kareCizimi: { opP50: yuzde(kc.map((x) => x.op), 0.5), toplamMsP50: yuzde(kc.map((x) => x.toplamMs), 0.5), arkaSonrasiMsP50: yuzde(oran.map((x) => x.arkaSonrasiMs), 0.5), arkaSonrasiMsP90: yuzde(oran.map((x) => x.arkaSonrasiMs), 0.9) },
    olayIz: v.olayIz,
    piksel: piks,
    ekranDizisi: { n: r.dizi.length, lumaMin: Math.min(...r.dizi.map((d) => d.luma)), lumaMaks: Math.max(...r.dizi.map((d) => d.luma)), farkMed: yuzde(diziF, 0.5), farkMaks: diziF.length ? Math.max(...diziF) : null, kareler: r.dizi },
    dosyalar: r.dosyalar,
  };
}

/** Dev sunucusunda çizici örneğini yakala (prototip yaması; kaynak değişmez). */
async function ciziciYakala(page) {
  return page.evaluate(async () => {
    if (window.__ciz) return true;
    const ad = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((n) => /\/src\/render\/oyunCizici\.ts/.test(n));
    if (!ad) return false;
    try {
      const m = await import(ad);
      const sahte = { dpr: 1, width: 390, height: 844, canvas: document.createElement('canvas'), begin() {}, onResize() {} };
      const o = m.oyunCiziciOlustur(sahte);
      const proto = Object.getPrototypeOf(o);
      if (!proto.__yamali) {
        const k = proto.kare;
        proto.kare = function (dt) {
          if (this !== o) window.__ciz = this;
          return k.call(this, dt);
        };
        proto.__yamali = true;
      }
      o.yokEt();
      for (let i = 0; i < 40 && !window.__ciz; i++) await new Promise((r) => window.__ttOrijinal.st(r, 30));
      return !!window.__ciz;
    } catch (e) {
      return String(e);
    }
  });
}

async function profilKos(browser, p) {
  const dir = join(OUT, p.ad);
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: p.dpr, isMobile: p.mobil, hasTouch: true, userAgent: p.ua });
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`console.error: ${m.text()}`);
  });
  await page.addInitScript(olcumKur);
  const cdp = await ctx.newCDPSession(page);
  const dokun = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const sonuc = { profil: p, senaryolar: [], deneyler: {}, hatalar, baslangic: null };
  await page.goto(URL);
  await page.waitForSelector('.e-acilis', { timeout: 30000 });
  await page.waitForTimeout(1900);
  // Açılıştaki tuval boyutlanmaları (bilgi)
  sonuc.baslangic = await page.evaluate(() => ({ anaBoyut: window.__tt.boyutTum.slice(0, 20), ro: window.__tt.ro.slice(0, 10), attr: window.__tt.anaAttr, secenek: window.__tt.anaSecenek }));
  const yakalandi = await ciziciYakala(page);
  sonuc.ciziciYakalandi = yakalandi;
  await dokun(p.w / 2, p.h * 0.72);
  await bekleKosul(page, () => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === 1, null, 20000, 'bölüm 1 açıldı');
  await page.waitForTimeout(1500);
  if (BOLUMLER.includes(1)) {
    console.log(`[${p.ad}] bölüm 1 boşta ${SURE / 1000} sn`);
    const r = await bostaOlc(browser, page, p, 'b1', dir);
    sonuc.senaryolar.push(ozetle(p, 'b1', r));
  }
  for (const id of BOLUMLER.filter((b) => b !== 1)) {
    await page.evaluate((b) => window.__ebruli.bolumAc(b), id);
    await bekleKosul(page, (b) => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === b && window.__ebruli.durum()?.oturum === 'bekliyor', id, 30000, `bölüm ${id} açıldı`);
    await page.evaluate(() => window.__ebruli.hizli(true));
    for (let i = 0; i < 3; i++) {
      if ((await page.evaluate(() => window.__ebruli.ekran())) !== 'oyun') break;
      await page.evaluate(() => window.__ebruli.botHamle('usta'));
      await bekleKosul(page, () => window.__ebruli.durum()?.oturum === 'bekliyor' || window.__ebruli.ekran() !== 'oyun', null, 30000, 'bot hamlesi oynatıldı');
    }
    await page.evaluate(() => window.__ebruli.hizli(false));
    await page.waitForTimeout(800);
    if ((await page.evaluate(() => window.__ebruli.ekran())) !== 'oyun') {
      hatalar.push(`bölüm ${id}: bot hamlelerinden sonra oyun ekranı değil`);
      continue;
    }
    console.log(`[${p.ad}] bölüm ${id} (3 bot hamlesi) boşta ${SURE / 1000} sn`);
    const r = await bostaOlc(browser, page, p, `b${id}`, dir);
    sonuc.senaryolar.push(ozetle(p, `b${id}`, r));
  }

  // ── Deneyler (son açık bölümde, hâlâ boşta)
  if (DENEYLER.includes('yarim')) {
    await page.evaluate(() => (window.__tt.yarimIste = true));
    await page.waitForTimeout(600);
    const y = await page.evaluate(() => (window.__tt.yarim || []).map((x) => ({ ...x })));
    const kayit = [];
    for (const [i, x] of y.entries()) {
      const f = join(dir, `yarim-${i}-${x.etiket.replace(/[^a-z0-9%]+/gi, '_')}.png`);
      writeFileSync(f, Buffer.from(x.url.split(',')[1], 'base64'));
      kayit.push({ etiket: x.etiket, op: x.op, ms: x.ms, dosya: f });
    }
    // Ara görüntülerin parlaklığı ve kare sonuna farkı
    const an = await kareDizisiAnaliz(browser, [...y.map((x) => x.url.split(',')[1])]);
    const son = an[an.length - 1];
    sonuc.deneyler.yarim = kayit.map((k, i) => ({ ...k, luma: an[i]?.luma, sonaGoreLuma: an[i] && son ? +(an[i].luma - son.luma).toFixed(2) : null }));
  }
  if (DENEYLER.includes('kalite') && yakalandi === true) {
    const k = await page.evaluate(async () => {
      const cz = window.__ciz;
      const { st, P } = window.__ttOrijinal;
      const T = window.__tt;
      const once = cz.kalite.zorla;
      T.ornek = [];
      T.t0 = P();
      T.kayit = true;
      const gecis = [];
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => st(r, 1000));
        cz.kalite.zorla = i % 2 === 0;
        gecis.push({ t: Math.round(P() - T.t0), dusuk: cz.kalite.zorla });
      }
      await new Promise((r) => st(r, 1000));
      T.kayit = false;
      cz.kalite.zorla = once;
      return { gecis, ornek: T.ornek.slice() };
    });
    // Geçişten sonraki ilk örneğin farkı ↔ diğer örneklerin farkı
    const fark = k.ornek.slice(1).map((o) => o.fark);
    const gecisFark = k.gecis.map((g) => {
      const o = k.ornek.find((x) => x.t > g.t);
      return { ...g, fark: o?.fark ?? null, blokMaks: o?.blokMaks ?? null };
    });
    sonuc.deneyler.kalite = { normalFarkMed: yuzde(fark, 0.5), normalFarkP90: yuzde(fark, 0.9), gecisFark };
  }
  if (DENEYLER.includes('boyut')) {
    const b = await page.evaluate(async () => {
      const { st, P } = window.__ttOrijinal;
      const T = window.__tt;
      const app = document.getElementById('app');
      T.temizSunum = [];
      T.boyut = [];
      T.ornek = [];
      T.t0 = P();
      T.kayit = true;
      await new Promise((r) => st(r, 400));
      const t1 = Math.round(P() - T.t0);
      app.style.bottom = '1px'; // yalnız ResizeObserver (pencere boyutu aynı)
      await new Promise((r) => st(r, 600));
      app.style.bottom = '';
      await new Promise((r) => st(r, 600));
      T.kayit = false;
      return { t1, temiz: T.temizSunum.slice(), boyut: T.boyut.filter((x) => x.ana), ornek: T.ornek.slice() };
    });
    const v0 = p.h;
    await page.evaluate(() => {
      const T = window.__tt;
      T.temizSunum = [];
      T.boyut = [];
      T.t0 = window.__ttOrijinal.P();
      T.kayit = true;
    });
    await page.setViewportSize({ width: p.w, height: v0 - 1 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: p.w, height: v0 });
    await page.waitForTimeout(600);
    const pen = await page.evaluate(() => {
      const T = window.__tt;
      T.kayit = false;
      return { temiz: T.temizSunum.slice(), boyut: T.boyut.filter((x) => x.ana), pencere: T.pencere.filter((x) => x.kayit), vv: T.vv.filter((x) => x.kayit), ro: T.ro.filter((x) => x.kayit) };
    });
    const minLuma = b.ornek.length ? Math.min(...b.ornek.map((o) => o.luma)) : null;
    sonuc.deneyler.boyut = { yalnizRO: { temizKare: b.temiz, anaBoyut: b.boyut, ornekMinLuma: minLuma, ornekLumaMed: yuzde(b.ornek.map((o) => o.luma), 0.5) }, pencere1px: pen };
  }
  await ctx.close();
  return sonuc;
}

// ── Ana akış
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const tumu = [];
for (const p of PROFILLER) {
  const t = Date.now();
  try {
    const s = await profilKos(browser, p);
    writeFileSync(join(OUT, p.ad, 'sonuc.json'), JSON.stringify(s, null, 1));
    tumu.push(s);
    console.log(`[${p.ad}] bitti (${Math.round((Date.now() - t) / 1000)} sn)${s.hatalar.length ? ` — ${s.hatalar.length} hata` : ''}`);
  } catch (e) {
    console.log(`[${p.ad}] HATA: ${e.message}`);
    tumu.push({ profil: p, hata: e.message, senaryolar: [] });
  }
}
await browser.close();

// ── Özet tablo
const satirlar = [];
const s = (x) => (x === null || x === undefined ? '-' : String(x));
satirlar.push('EBRULİ boşta titreme ölçümü — ' + new Date().toISOString());
satirlar.push(`url ${URL}; bekleme ${SURE / 1000} sn; headless Chromium (swiftshader). desynchronized ön tampon davranışı burada ölçülemez.`);
satirlar.push('');
satirlar.push(['profil', 'sen.', 'kip', 'tuval', 'MPx', 'hücre', 'anaBoy', 'temizKare', 'RO', 'win', 'vv', 'mut', 'anim', 'dt50', 'dt90', 'cb50', 'kalite', 'çukur', 'siyah', 'sıçrama', 'fark50', 'farkMaks', 'rafDışı'].join('\t'));
for (const r of tumu) {
  if (r.hata) {
    satirlar.push(`${r.profil.ad}\tHATA ${r.hata}`);
    continue;
  }
  for (const z of r.senaryolar) {
    satirlar.push(
      [
        z.profil,
        z.senaryo,
        z.hudKip,
        z.tuvalPx,
        z.tuvalMpx,
        z.hucre,
        z.anaTuvalBoyutlanma,
        z.temizKareSunumu,
        z.resizeObserver,
        z.pencereResize,
        z.vvOlay,
        z.mutasyon,
        z.animasyon.length,
        z.kareAraligi.p50,
        z.kareAraligi.p90,
        z.oyunCbMs.p50,
        z.kalite.map((k) => k.kalite).join('→') || '-',
        z.piksel.cukur.length,
        z.piksel.siyah.length,
        z.piksel.sicramaSayisi,
        z.piksel.farkMed,
        z.piksel.farkMaks,
        Object.entries(z.cizimEvre)
          .filter(([k, v]) => k !== 'raf' && v)
          .map(([k, v]) => `${k}:${v}`)
          .join(',') || '0',
      ]
        .map(s)
        .join('\t'),
    );
  }
}
satirlar.push('');
for (const r of tumu) {
  if (r.hata) continue;
  satirlar.push(`── ${r.profil.ad} (${r.profil.not})  attr=${JSON.stringify(r.baslangic?.attr)} çizici=${r.ciziciYakalandi}`);
  for (const z of r.senaryolar) {
    satirlar.push(`  [${z.senaryo}] mq=${JSON.stringify(z.mq)}`);
    satirlar.push(`    zamanlayıcılar: ${JSON.stringify(z.zamanlayici)}`);
    satirlar.push(`    animasyonlar: ${z.animasyon.join(' | ') || '-'}`);
    satirlar.push(`    mutasyon (en çok): ${z.mutasyonEnCok.map(([k, v]) => `${k}×${v}`).join(' | ') || '-'}`);
    satirlar.push(`    diğer tuval boyutlanma: ${JSON.stringify(z.digerTuvalGruplari)}`);
    satirlar.push(`    olay izi (vurgu/el): ${z.olayIz.map((o) => `${o.t}:${o.vurgu || '-'}/${o.el ? 'el' : '-'}`).join(' ') || '-'}`);
    satirlar.push(`    kare dağılımı: ${JSON.stringify(z.kareAraligi.dagilim)}; çizim/kare op ${z.kareCizimi.opP50}, toplam ${z.kareCizimi.toplamMsP50} ms, arka→son ${z.kareCizimi.arkaSonrasiMsP50}/${z.kareCizimi.arkaSonrasiMsP90} ms`);
    satirlar.push(`    piksel: luma ${z.piksel.lumaMin}–${z.piksel.lumaMaks} (med ${z.piksel.lumaMed}); sıçramalar ${JSON.stringify(z.piksel.sicrama.slice(0, 8))}`);
    satirlar.push(`    ekran dizisi: luma ${z.ekranDizisi.lumaMin}–${z.ekranDizisi.lumaMaks}, fark med ${z.ekranDizisi.farkMed} maks ${z.ekranDizisi.farkMaks}`);
    satirlar.push(`    tuval belleği: ${JSON.stringify(z.tuvalBellegi)}`);
  }
  if (r.deneyler.kalite) satirlar.push(`  deney kalite: normal fark med ${r.deneyler.kalite.normalFarkMed} p90 ${r.deneyler.kalite.normalFarkP90}; geçişler ${JSON.stringify(r.deneyler.kalite.gecisFark)}`);
  if (r.deneyler.boyut) satirlar.push(`  deney boyut: yalnız RO → temiz kare ${JSON.stringify(r.deneyler.boyut.yalnizRO.temizKare)}, ana boyut evresi ${r.deneyler.boyut.yalnizRO.anaBoyut.map((b) => b.faz).join(',')}, örnek min luma ${r.deneyler.boyut.yalnizRO.ornekMinLuma} (med ${r.deneyler.boyut.yalnizRO.ornekLumaMed}); pencere 1 px → temiz ${JSON.stringify(r.deneyler.boyut.pencere1px.temiz)}, evre ${r.deneyler.boyut.pencere1px.boyut.map((b) => b.faz).join(',')}`);
  if (r.deneyler.yarim) satirlar.push(`  deney yarım kare: ${r.deneyler.yarim.map((y) => `${y.etiket} (op ${y.op}, ${y.ms} ms, luma ${y.luma}, Δ ${y.sonaGoreLuma})`).join(' | ')}`);
  if (r.hatalar.length) satirlar.push(`  hatalar: ${r.hatalar.slice(0, 5).join(' | ')}`);
}
writeFileSync(join(OUT, 'ozet.txt'), satirlar.join('\n'));
writeFileSync(join(OUT, 'ozet.json'), JSON.stringify(tumu.map((r) => ({ profil: r.profil.ad, hata: r.hata, baslangic: r.baslangic, ciziciYakalandi: r.ciziciYakalandi, deneyler: r.deneyler, hatalar: r.hatalar, senaryolar: r.senaryolar?.map((z) => ({ ...z, ekranDizisi: { ...z.ekranDizisi, kareler: undefined } })) })), null, 1));
console.log(satirlar.join('\n'));
