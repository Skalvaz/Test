/**
 * FİTİL titreme (flicker) ölçümü: oyunu tablet/telefon boyutlarında BOŞTA
 * bekletir ve titremeye yol açabilecek her şeyi sayfanın İÇİNDEN kaydeder.
 *
 *   npx vite --port 5187 --strictPort --host 127.0.0.1
 *   node scripts/titreme.mjs [url] [çıktı-klasörü] [profil,profil,…] [--bekle 25] [--hamle 3] [--bolum 7] [--ss 15] [--cpu 4] [--gpu swiftshader]
 *   node scripts/titreme.mjs - [çıktı-klasörü] --sim      (tarayıcısız: kaliteIzle kopyasıyla kare deseni benzetimi)
 *
 * Varsayılan url http://127.0.0.1:5173/, çıktı playtest-output/titreme,
 * profiller hepsi (aşağıdaki PROFILLER; `tablet-*` ile `telefon*` kıyaslanır).
 * `file://…/fitil.html` de verilebilir (tek dosya sürümü; `tablet-cerceve`
 * profili yalnız http adresinde çalışır).
 *
 * Senaryo (her profil, ayrı tarayıcı bağlamı = temiz kayıt):
 *   açılış → "Dokun ve başla" (gerçek dokunma) → Bölüm 1 → BOŞTA `--bekle` sn
 *   → kayda 1–6 kazanılmış yazılır → Bölüm `--bolum` → bot `--hamle` hamle
 *   (hızlı kip, sonra normal hız) → BOŞTA `--bekle` sn.
 * Her boşta penceresinde: 6,5. sn'de bir ekran görüntüsü (boşta ipucu), 14–17.
 * sn arası kare kare piksel örneklemesi, pencere bitince `--ss` ardışık ekran
 * görüntüsü (en farklı çift kaydedilir).
 *
 * Sayfa içinde kaydedilenler (addInitScript, window.__titreme):
 *  1) HTMLCanvasElement width/height ayarlayıcıları (bağlı tuvallerde eski→yeni +
 *     kısa yığın; bağlı olmayan, yani sprite/pişirme tuvallerinde sayı).
 *  2) ResizeObserver geri çağrıları (gözlenen öğe + boyut), window resize/scroll/
 *     orientationchange, visualViewport resize/scroll, DPR medya değişimi.
 *  3) Kare aralıkları (rAF dt), kare iş süresi (cizici.kare), otomatik kalite
 *     durumu (dusukKalite, havuz.oran, gok.durgun, parilti_) ve geçişleri,
 *     yerleşim/pişirme (yerlesim, gok.kur), "boş kare" (ciz() yerleşim
 *     beklerken yalnız düz renk çizer), fişek perdesi (boyut, çiz/temizle).
 *  4) MutationObserver (öğe/sınıf/stil/metin), document.getAnimations() (CSS
 *     animasyon/geçiş: ad, hedef, süre, yineleme).
 *  5) Tuval pikselleri: 80 ms'de bir ana tuval ve fişek perdesi 64×64'e
 *     küçültülüp ortalama parlaklık, std ve önceki örneğe fark; sıçrayıp geri
 *     dönen (A-B-A), siyah/düz ve ani karartı örnekleri işaretlenir.
 *  6) setTimeout/setInterval (süre + çağıran yer, kurulum ve tetiklenme sayısı),
 *     requestAnimationFrame çağıranları.
 * Çıktı: <çıktı>/<profil>/ozet.json (+ ham.json), ekran görüntüleri, <çıktı>/kiyas.json
 * ve konsolda kıyas tablosu.
 *
 * SINIR: headless Chromium (SwiftShader) `desynchronized: true` tuvalin gerçek
 * donanım davranışını (ön tampona doğrudan çizim, yırtılma, kaplama/overlay
 * geçişleri) üretemez; kare süreleri de makineye göredir. Bu araç mantık
 * düzeyindeki nedenleri (yeniden boyutlama, yeniden pişirme, kalite salınımı,
 * boş kare, DOM/animasyon değişimi) ölçer.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';

// ─────────────────────────── Argümanlar ───────────────────────────
const konum = [];
const bayrak = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const ad = a.slice(2);
    const d = process.argv[i + 1];
    if (d !== undefined && !d.startsWith('--')) {
      bayrak[ad] = d;
      i++;
    } else bayrak[ad] = true;
  } else konum.push(a);
}
const URL_ = konum[0] || 'http://127.0.0.1:5173/';
const OUT = konum[1] || 'playtest-output/titreme';
const BEKLE = Math.max(18, Number(bayrak.bekle ?? 25)) * 1000;
const HAMLE = Number(bayrak.hamle ?? 3);
const BOLUM = Number(bayrak.bolum ?? 7);
const SS = Math.max(4, Number(bayrak.ss ?? 15));
/** Tarayıcı çizimi: 'yazilim' (varsayılan; SwiftShader kareyi 3–6 fps'e düşürür) ya da 'swiftshader'. */
const GPU = String(bayrak.gpu ?? 'yazilim');
/** CDP CPU yavaşlatma katsayısı (1 = yok): zayıf tablet işlemcisi benzetimi. */
const CPU = Number(bayrak.cpu ?? 1);
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const UA_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_TELEFON = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const UA_MASAUSTU = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/** tur: kıyas grubu. cerceve: claude.ai benzeri üst çubuk (px, kesirli) + iframe. */
const PROFILLER = {
  'tablet-dikey': { w: 800, h: 1280, dpr: 1.5, mobil: true, ua: UA_TABLET, tur: 'tablet', not: '10" dikey' },
  'tablet-yatay': { w: 1280, h: 800, dpr: 1.5, mobil: true, ua: UA_TABLET, tur: 'tablet', not: '10" yatay' },
  'tablet-768': { w: 768, h: 1024, dpr: 2, mobil: true, ua: UA_TABLET, tur: 'tablet', not: 'en/boy tam 0,75 (dikey/yatay sınırı)' },
  'tablet-1024': { w: 1024, h: 768, dpr: 2, mobil: true, ua: UA_TABLET, tur: 'tablet', not: '4:3 yatay' },
  'tablet-buyuk': { w: 900, h: 1440, dpr: 2, mobil: true, ua: UA_TABLET, tur: 'tablet', not: 'Galaxy Tab boyu' },
  'tablet-133': { w: 601, h: 962, dpr: 1.33125, mobil: true, ua: UA_TABLET, tur: 'tablet', not: 'tvdpi 7–8" tablet, kesirli DPR' },
  'tablet-masaustu': { w: 1280, h: 800, dpr: 1.5, mobil: false, ua: UA_MASAUSTU, tur: 'tablet', not: '"masaüstü sitesi" kipi (isMobile:false + dokunma)' },
  'tablet-cerceve': { w: 800, h: 1280, dpr: 1.5, mobil: true, ua: UA_TABLET, tur: 'tablet', cerceve: 56.5, not: 'claude.ai benzeri iframe, 56,5 px üst çubuk' },
  telefon: { w: 390, h: 844, dpr: 3, mobil: true, ua: UA_TELEFON, tur: 'telefon', not: 'tasarım boyu' },
  'telefon-kesirli': { w: 360, h: 800, dpr: 2.625, mobil: true, ua: UA_TELEFON, tur: 'telefon', not: 'kesirli DPR' },
};
const secilen = konum[2] ? konum[2].split(',').filter(Boolean) : Object.keys(PROFILLER);
for (const s of secilen) if (!PROFILLER[s]) throw new Error(`bilinmeyen profil: ${s} (${Object.keys(PROFILLER).join(', ')})`);
mkdirSync(OUT, { recursive: true });

// ─────────────────────────── Sayfa içi kayıt ───────────────────────────
/** addInitScript ile her belgeye (iframe dahil) sayfa kodundan ÖNCE enjekte edilir. */
function enjekte() {
  if (window.__titreme) return;
  const P = performance;
  const now = () => P.now();
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const oSetTimeout = window.setTimeout.bind(window);
  const oSetInterval = window.setInterval.bind(window);
  const oRaf = window.requestAnimationFrame.bind(window);
  const SINIR = 6000;
  const T = {
    t0: now(),
    isaretler: [],
    tuval: [],
    offscreen: [],
    ro: [],
    pencere: [],
    zamanlayici: {},
    zamanlayiciTik: [],
    raf: [],
    mut: [],
    anim: {},
    kareDt: [],
    kareIs: [],
    durum: [],
    kaliteOlay: [],
    ciz: { n: 0, bos: [] },
    yerlesim: [],
    gokKur: [],
    perde: { boyut: [], ciz: [], gecis: 0, son: null },
    yerlesimBayrak: [],
    ornek: { ana: [], perde: [] },
    isaretli: [],
    patlama: null,
    patlamaSonuc: [],
    hata: [],
  };
  window.__titreme = T;
  const ekle = (dizi, x) => {
    if (dizi.length < SINIR) dizi.push(x);
  };
  T.isaret = (ad) => {
    T.isaretler.push({ ad, t: now() });
    return now();
  };
  const tuvalId = new WeakMap();
  let tuvalSayac = 0;
  const sec = (el) => {
    if (!el) return '-';
    if (el.nodeType === 3) return `#text<${sec(el.parentElement)}`;
    if (el.nodeType === 9) return '#document';
    if (!el.tagName) return String(el.nodeName);
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cl = typeof el.className === 'string' ? el.className : el.className?.baseVal || '';
    const k = cl.split(/\s+/).filter(Boolean).slice(0, 2);
    if (k.length) s += `.${k.join('.')}`;
    if (el.tagName === 'CANVAS') {
      if (!tuvalId.has(el)) tuvalId.set(el, ++tuvalSayac);
      s += `[${tuvalId.get(el)}]`;
    }
    return s;
  };
  T.sec = sec;
  /** Çağıran yer: yığının `atla`'dan sonraki 3 satırı (işlev adı + dosya:satır). */
  const yer = (atla = 3, n = 3) => {
    const s = (new Error().stack || '').split('\n').slice(atla, atla + n);
    return s
      .map((x) =>
        x
          .trim()
          .replace(/^at /, '')
          .replace(/https?:\/\/[^/]+\//, '')
          .replace(/file:\/\/\S*\//, '')
          .replace(/\?[^:)]*:/, ':'),
      )
      .join(' < ');
  };

  // 5) Örnekleme tuvali (prototip sarılmadan önce: sayılmasın).
  const ornekTuval = document.createElement('canvas');
  ornekTuval.width = 64;
  ornekTuval.height = 64;
  const ox = ornekTuval.getContext('2d', { willReadFrequently: true });

  // 1) Tuval boyut ayarlayıcıları
  const proto = HTMLCanvasElement.prototype;
  for (const ad of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(proto, ad);
    if (!d || !d.set) continue;
    Object.defineProperty(proto, ad, {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set(v) {
        const eski = d.get.call(this);
        d.set.call(this, v);
        const yeni = d.get.call(this);
        if (this.isConnected) ekle(T.tuval, { t: now(), tuval: sec(this), ad, eski, yeni, ayni: eski === yeni, yer: yer(3, 4) });
        else ekle(T.offscreen, now());
      },
    });
  }

  // 2) ResizeObserver + pencere olayları
  const RO = window.ResizeObserver;
  if (RO) {
    window.ResizeObserver = class extends RO {
      constructor(cb) {
        const kaynak = yer(3, 2);
        super((girdiler, gozlemci) => {
          ekle(T.ro, { t: now(), kaynak, g: girdiler.map((e) => `${sec(e.target)} ${r2(e.contentRect.width)}x${r2(e.contentRect.height)}`) });
          return cb(girdiler, gozlemci);
        });
      }
    };
  }
  const pencereOlay = (tur) => () =>
    ekle(T.pencere, {
      t: now(),
      tur,
      iw: window.innerWidth,
      ih: window.innerHeight,
      vvw: window.visualViewport ? r2(window.visualViewport.width) : null,
      vvh: window.visualViewport ? r2(window.visualViewport.height) : null,
      vvs: window.visualViewport ? r2(window.visualViewport.scale) : null,
      vvot: window.visualViewport ? r2(window.visualViewport.offsetTop) : null,
      dpr: window.devicePixelRatio,
      gizli: document.hidden,
    });
  window.addEventListener('resize', pencereOlay('resize'), true);
  window.addEventListener('scroll', pencereOlay('scroll'), true);
  window.addEventListener('orientationchange', pencereOlay('orientationchange'));
  document.addEventListener('visibilitychange', pencereOlay('visibilitychange'));
  window.addEventListener('blur', pencereOlay('blur'));
  window.addEventListener('focus', pencereOlay('focus'));
  window.visualViewport?.addEventListener('resize', pencereOlay('vv-resize'));
  window.visualViewport?.addEventListener('scroll', pencereOlay('vv-scroll'));
  try {
    const dprDinle = () => {
      const m = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      m.addEventListener('change', () => {
        pencereOlay('dpr-degisti')();
        dprDinle();
      }, { once: true });
    };
    dprDinle();
  } catch {
    /* yok */
  }

  // 6) Zamanlayıcılar ve rAF çağıranları
  const zKaydet = (tur, ms, y) => {
    const k = `${tur}|${ms ?? 0}|${y}`;
    const z = (T.zamanlayici[k] ||= { tur, ms: ms ?? 0, yer: y, kurulum: [], tik: 0 });
    if (z.kurulum.length < 2000) z.kurulum.push(now());
    return k;
  };
  window.setTimeout = function (fn, ms, ...a) {
    const k = zKaydet('timeout', ms, yer(3, 2));
    if (typeof fn !== 'function') return oSetTimeout(fn, ms, ...a);
    return oSetTimeout(function (...b) {
      T.zamanlayici[k].tik++;
      ekle(T.zamanlayiciTik, [now(), k]);
      return fn.apply(this, b);
    }, ms, ...a);
  };
  window.setInterval = function (fn, ms, ...a) {
    const k = zKaydet('interval', ms, yer(3, 2));
    if (typeof fn !== 'function') return oSetInterval(fn, ms, ...a);
    return oSetInterval(function (...b) {
      T.zamanlayici[k].tik++;
      ekle(T.zamanlayiciTik, [now(), k]);
      return fn.apply(this, b);
    }, ms, ...a);
  };
  const rafSay = new Map();
  window.requestAnimationFrame = function (cb) {
    const k = yer(3, 1);
    rafSay.set(k, (rafSay.get(k) || 0) + 1);
    return oRaf(cb);
  };
  T.rafSayac = () => Object.fromEntries(rafSay);

  // 4) DOM değişiklikleri
  const kirp = (s, n = 70) => (s == null ? s : s.length > n ? `${s.slice(0, n)}…` : s);
  const baslat = () => {
    const mo = new MutationObserver((liste) => {
      const t = now();
      for (const m of liste) {
        const h = sec(m.target);
        if (m.type === 'attributes') {
          const yeni = m.target.getAttribute?.(m.attributeName);
          ekle(T.mut, { t, k: `${h} @${m.attributeName}`, eski: kirp(m.oldValue), yeni: kirp(yeni) });
        } else if (m.type === 'childList') {
          const art = [...m.addedNodes].map(sec).join(',');
          const eks = [...m.removedNodes].map(sec).join(',');
          ekle(T.mut, { t, k: `${h} çocuk`, eski: kirp(eks), yeni: kirp(art) });
        } else ekle(T.mut, { t, k: `${h} metin`, eski: kirp(m.oldValue, 30), yeni: kirp(m.target.data, 30) });
      }
    });
    mo.observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });
  };
  if (document.documentElement) baslat();
  else document.addEventListener('readystatechange', baslat, { once: true });
  oSetInterval(() => {
    try {
      const t = now();
      for (const a of document.getAnimations()) {
        const e = a.effect;
        const tm = e?.getTiming?.() || {};
        const ad = a.animationName || a.transitionProperty || a.id || '-';
        const hedef = sec(e?.target) + (e?.pseudoElement || '');
        const k = `${a.constructor.name}|${ad}|${hedef}`;
        const x = (T.anim[k] ||= { tur: a.constructor.name, ad, hedef, sure: tm.duration, yineleme: tm.iterations, gecikme: tm.delay, ilk: t, gorulme: [] });
        x.son = t;
        x.durum = a.playState;
        if (x.gorulme.length < 400) x.gorulme.push(t);
      }
    } catch (e) {
      ekle(T.hata, `anim: ${e}`);
    }
  }, 500);

  // 5) Piksel örnekleme
  const onceki = new Map();
  const ornekle = (tuval, alfa) => {
    ox.setTransform(1, 0, 0, 1, 0, 0);
    ox.globalCompositeOperation = 'copy';
    ox.drawImage(tuval, 0, 0, 64, 64);
    const d = ox.getImageData(0, 0, 64, 64).data;
    const L = new Uint8Array(4096);
    let top = 0;
    let top2 = 0;
    let atop = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const l = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
      const v = alfa ? (l * d[i + 3]) / 255 : l;
      L[j] = v;
      top += v;
      top2 += v * v;
      atop += d[i + 3];
    }
    const ort = top / 4096;
    return { L, ort, std: Math.sqrt(Math.max(0, top2 / 4096 - ort * ort)), alfa: atop / 4096 / 255 };
  };
  const fark = (a, b) => {
    let s = 0;
    for (let i = 0; i < 4096; i++) s += Math.abs(a[i] - b[i]);
    return s / 4096;
  };
  const kaydetOrnek = (anahtar, dizi, tuval, alfa, t) => {
    const o = ornekle(tuval, alfa);
    const g = onceki.get(anahtar) || [];
    const dP = g.length ? fark(g[g.length - 1].L, o.L) : 0;
    ekle(dizi, [r1(t), r2(o.ort), r2(dP), r2(o.std), r2(o.alfa), tuval.width, tuval.height]);
    // A-B-A: ortadaki örnek iki komşusundan da farklı, komşular birbirine yakın.
    if (g.length >= 2) {
      const a = g[g.length - 2];
      const b = g[g.length - 1];
      const dAB = fark(a.L, b.L);
      const dAC = fark(a.L, o.L);
      if (dAB > 4 && dP > 4 && dAC < 0.4 * Math.min(dAB, dP)) ekle(T.isaretli, { t: r1(b.t), tuval: anahtar, tur: 'A-B-A', dAB: r2(dAB), dBC: r2(dP), dAC: r2(dAC), ortA: r2(a.ort), ortB: r2(b.ort), ortC: r2(o.ort) });
    }
    if (!alfa && (o.ort < 3 || o.std < 1)) ekle(T.isaretli, { t: r1(t), tuval: anahtar, tur: o.ort < 3 ? 'siyah' : 'duz', ort: r2(o.ort), std: r2(o.std) });
    if (g.length) {
      const b = g[g.length - 1];
      if (b.ort > 8 && o.ort < b.ort * 0.75) ekle(T.isaretli, { t: r1(t), tuval: anahtar, tur: 'karartı', once: r2(b.ort), simdi: r2(o.ort) });
    }
    g.push({ L: o.L, ort: o.ort, t });
    if (g.length > 2) g.shift();
    onceki.set(anahtar, g);
  };
  let ornekIs = 0;
  oSetInterval(() => {
    if (document.hidden) return;
    const t0 = now();
    try {
      const ana = document.querySelector('canvas.sahne');
      if (ana && ana.width > 1) kaydetOrnek('ana', T.ornek.ana, ana, false, t0);
      const pr = document.querySelector('canvas.f-fisek-tuval');
      if (pr && pr.width > 1 && pr.height > 1 && pr.offsetParent !== null) kaydetOrnek('perde', T.ornek.perde, pr, true, t0);
    } catch (e) {
      ekle(T.hata, `örnek: ${e}`);
    }
    ornekIs += now() - t0;
  }, 80);
  T.ornekIs = () => ornekIs;

  // 3) Kare aralığı + çizici durumu (her rAF, oyunun döngüsünden önce)
  let son = 0;
  let durumAnahtar = '';
  let c = null;
  const durumOku = () => {
    const s = c.s;
    let pa = -1;
    try {
      pa = c.perdeAlt();
    } catch {
      /* yok */
    }
    return `dusuk=${c.dusukKalite ? 1 : 0} oran=${s.havuz.oran} durgun=${c.gok.durgun ? 1 : 0} parilti=${s.parilti_ ? 1 : 0} ekran=${s.ekranW}x${s.ekranH}@${s.dpr} c=${s.c} gx=${s.gx},${s.gy} perdeAlt=${pa} gorunurGok=${Math.round(s.gorunurGok.y)}+${Math.round(s.gorunurGok.h)}`;
  };
  const dongu = (t) => {
    if (son) ekle(T.kareDt, [r1(t), r2(t - son)]);
    son = t;
    if (c) {
      try {
        if (c.yerlesimGerekli) ekle(T.yerlesimBayrak, r1(now()));
        const k = durumOku();
        if (k !== durumAnahtar) {
          T.durum.push({ t: now(), k, tazeleme: r2(c.tazeleme), iyiPencere: c.iyiPencere, gerekenIyi: c.gerekenIyi, kaliteAtla: c.kaliteAtla });
          durumAnahtar = k;
        }
      } catch (e) {
        ekle(T.hata, `durum: ${e}`);
      }
    }
    oRaf(dongu);
  };
  oRaf(dongu);

  // Çizici kancaları (window.__fitil hazır olunca bir kez)
  const sar = (nesne, ad, once, sonra) => {
    const f = nesne[ad];
    if (typeof f !== 'function') return false;
    nesne[ad] = function (...a) {
      const o = once ? once.apply(this, a) : undefined;
      const r = f.apply(this, a);
      if (sonra) sonra.call(this, o, a, r);
      return r;
    };
    return true;
  };
  const bagla = () => {
    const f = window.__fitil;
    if (!f || typeof f.cizici !== 'function') return false;
    c = f.cizici();
    T.cizici = true;
    sar(c, 'kare', () => now(), function (t0) {
      const t1 = now();
      ekle(T.kareIs, [r1(t0), r2(t1 - t0)]);
      const p = T.patlama;
      if (p && t1 < p.son) {
        try {
          const o = ornekle(this.stage.canvas, false);
          p.dizi.push({ t: r1(t1), L: o.L, ort: o.ort, std: o.std });
        } catch (e) {
          ekle(T.hata, `patlama: ${e}`);
        }
      } else if (p) {
        T.patlamaSonuc.push(patlamaOzet(p));
        T.patlama = null;
      }
    });
    sar(c, 'ciz', function () {
      T.ciz.n++;
      if (!this.s.tahta.w || this.yerlesimGerekli) ekle(T.ciz.bos, { t: r1(now()), neden: !this.s.tahta.w ? 'tahta yok' : 'yerlesimGerekli' });
    });
    sar(c, 'yerlesim', () => ekle(T.yerlesim, { t: r1(now()), yer: yer(4, 4) }));
    sar(c, 'kaliteUygula', null, function () {
      ekle(T.kaliteOlay, { t: r1(now()), dusuk: this.dusukKalite, oran: this.s.havuz.oran, durgun: this.gok.durgun, tazeleme: r2(this.tazeleme), iyiPencere: this.iyiPencere, gerekenIyi: this.gerekenIyi, yer: yer(4, 3) });
    });
    if (c.gok) {
      sar(c.gok, 'kur', function () {
        return this.anahtar;
      }, function (eski) {
        ekle(T.gokKur, { t: r1(now()), degisti: eski !== this.anahtar, anahtar: this.anahtar, yer: yer(4, 3) });
      });
    }
    const pr = c.perde;
    if (pr) {
      sar(pr, 'boyutla', function (w, h, dpr) {
        return `${this.w}x${this.h}@${this.dpr}`;
      }, function (eski, a) {
        const yeni = `${this.w}x${this.h}@${this.dpr}`;
        if (eski !== yeni) ekle(T.perde.boyut, { t: r1(now()), eski, yeni, istek: a.map((x) => r2(x)).join(',') });
      });
      const durum = (d) => {
        if (T.perde.son !== null && T.perde.son !== d) T.perde.gecis++;
        T.perde.son = d;
        ekle(T.perde.ciz, [r1(now()), d]);
      };
      sar(pr, 'basla', () => durum(1));
      sar(pr, 'temizle', function () {
        if (this.kirli) durum(0);
      });
    }
    return true;
  };
  const baglaDene = oSetInterval(() => {
    try {
      if (bagla()) clearInterval(baglaDene);
    } catch (e) {
      ekle(T.hata, `bagla: ${e}`);
      clearInterval(baglaDene);
    }
  }, 100);

  // Kare kare örnekleme (cizici.kare'nin hemen ardından)
  const patlamaOzet = (p) => {
    const d = p.dizi;
    const farklar = [];
    for (let i = 1; i < d.length; i++) farklar.push(fark(d[i - 1].L, d[i].L));
    const sirali = [...farklar].sort((a, b) => a - b);
    const med = sirali.length ? sirali[sirali.length >> 1] : 0;
    const isaret = [];
    for (let i = 1; i + 1 < d.length; i++) {
      const dAB = farklar[i - 1];
      const dBC = farklar[i];
      const dAC = fark(d[i - 1].L, d[i + 1].L);
      if (dAB > Math.max(3, med * 4) && dBC > Math.max(3, med * 4) && dAC < 0.4 * Math.min(dAB, dBC)) isaret.push({ t: d[i].t, dAB: r2(dAB), dBC: r2(dBC), dAC: r2(dAC), ort: r2(d[i].ort) });
      if (d[i].ort < 3 || d[i].std < 1) isaret.push({ t: d[i].t, tur: 'duz/siyah', ort: r2(d[i].ort), std: r2(d[i].std) });
    }
    return { bas: r1(p.bas), kare: d.length, farkMedyan: r2(med), farkP90: r2(sirali[Math.floor(sirali.length * 0.9)] ?? 0), farkMaks: r2(sirali[sirali.length - 1] ?? 0), ortMin: r2(Math.min(...d.map((x) => x.ort))), ortMaks: r2(Math.max(...d.map((x) => x.ort))), isaret };
  };
  T.patlamaBasla = (ms) => {
    T.patlama = { bas: now(), son: now() + ms, dizi: [] };
  };

  // Durum bilgisi (profil başına bir kez)
  T.bilgi = () => {
    const ana = document.querySelector('canvas.sahne');
    let attr = null;
    try {
      attr = ana?.getContext('2d')?.getContextAttributes?.() ?? null;
    } catch (e) {
      attr = String(e);
    }
    const sorgular = new Set(['(pointer: coarse)', '(pointer: fine)', '(hover: none)', '(hover: hover)', '(any-pointer: fine)', '(orientation: portrait)', '(orientation: landscape)', '(prefers-reduced-motion: reduce)', '(display-mode: standalone)', '(update: fast)', '(max-aspect-ratio: 3/4)']);
    const gez = (kurallar) => {
      for (const r of kurallar) {
        if (r.media && r.cssRules) {
          sorgular.add(r.media.mediaText);
          gez(r.cssRules);
        } else if (r.cssRules) gez(r.cssRules);
      }
    };
    for (const ss of document.styleSheets) {
      try {
        gez(ss.cssRules);
      } catch {
        /* çapraz köken */
      }
    }
    const medya = {};
    for (const q of sorgular) {
      try {
        medya[q] = matchMedia(q).matches;
      } catch {
        medya[q] = null;
      }
    }
    const se = document.scrollingElement;
    let cz = null;
    if (c) {
      const s = c.s;
      cz = { ekranW: s.ekranW, ekranH: s.ekranH, dpr: s.dpr, c: s.c, gx: s.gx, gy: s.gy, alan: s.alan, gokBandi: s.gokBandi, gorunurGok: s.gorunurGok, dusukKalite: c.dusukKalite, tazeleme: c.tazeleme, gerekenIyi: c.gerekenIyi, perdeAlt: c.perdeAlt?.(), havuzSayi: s.havuz.sayi, tuval: ana ? `${ana.width}x${ana.height} css ${ana.style.width}x${ana.style.height}` : null };
    }
    const perde = document.querySelector('canvas.f-fisek-tuval');
    const hud = document.querySelector('.f-hud');
    return {
      ua: navigator.userAgent,
      ic: { iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, vv: window.visualViewport ? { w: visualViewport.width, h: visualViewport.height, s: visualViewport.scale } : null, ekran: { w: screen.width, h: screen.height }, maxTouch: navigator.maxTouchPoints },
      kaydirma: se ? { sw: se.scrollWidth, sh: se.scrollHeight, cw: se.clientWidth, ch: se.clientHeight } : null,
      baglam: attr,
      medya,
      cizici: cz,
      perde: perde ? { w: perde.width, h: perde.height, css: `${perde.style.width}x${perde.style.height}`, gorunur: perde.offsetParent !== null } : null,
      hudSinif: hud?.className ?? null,
      kokSinif: document.querySelector('.f-kok')?.className ?? null,
      plaka: (() => {
        const p = document.querySelector('.f-plaka');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { y: r2(r.y), h: r2(r.height), w: r2(r.width) };
      })(),
      raf: T.rafSayac(),
      ornekIsMs: r1(ornekIs),
      hata: T.hata.slice(0, 20),
    };
  };
}

// ─────────────────────────── Yardımcılar (Node) ───────────────────────────
const bekleMs = (ms) => new Promise((r) => setTimeout(r, ms));
async function bekleKosul(hedef, fn, arg, sure = 30000, aciklama = '') {
  const son = Date.now() + sure;
  for (;;) {
    const ok = await hedef.evaluate(fn, arg).catch(() => false);
    if (ok) return true;
    if (Date.now() > son) throw new Error(`zaman aşımı: ${aciklama || fn.toString()}`);
    await bekleMs(100);
  }
}
const yuzde = (dizi, p) => {
  if (!dizi.length) return null;
  const s = [...dizi].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const r2 = (x) => (x == null ? x : Math.round(x * 100) / 100);
const icinde = (t, a, b) => t >= a && t <= b;

/** Ham kayıttan [bas, son] penceresinin özeti. */
function pencereOzeti(T, bas, son) {
  const sure = (son - bas) / 1000;
  const dt = T.kareDt.filter(([t]) => icinde(t, bas, son)).map(([, d]) => d);
  const is = T.kareIs.filter(([t]) => icinde(t, bas, son)).map(([, d]) => d);
  const tuval = T.tuval.filter((x) => icinde(x.t, bas, son));
  const ro = T.ro.filter((x) => icinde(x.t, bas, son));
  const pencere = T.pencere.filter((x) => icinde(x.t, bas, son));
  const mut = T.mut.filter((x) => icinde(x.t, bas, son));
  const mutSay = {};
  for (const m of mut) mutSay[m.k] = (mutSay[m.k] || 0) + 1;
  const mutOrnek = {};
  for (const m of mut) if (!mutOrnek[m.k]) mutOrnek[m.k] = { t: r2((m.t - bas) / 1000), eski: m.eski, yeni: m.yeni };
  const zam = {};
  for (const [k, z] of Object.entries(T.zamanlayici)) {
    const kur = z.kurulum.filter((t) => icinde(t, bas, son)).length;
    const tik = T.zamanlayiciTik.filter(([t, kk]) => kk === k && icinde(t, bas, son)).length;
    if (kur || tik) zam[k] = { tur: z.tur, ms: z.ms, yer: z.yer, kurulum: kur, tetik: tik };
  }
  const anim = Object.values(T.anim)
    .filter((a) => a.gorulme.some((t) => icinde(t, bas, son)))
    .map((a) => ({ tur: a.tur, ad: a.ad, hedef: a.hedef, sure: a.sure, yineleme: a.yineleme, gecikme: a.gecikme, durum: a.durum, gorulmeOrani: r2(a.gorulme.filter((t) => icinde(t, bas, son)).length / Math.max(1, (son - bas) / 500)) }));
  const ornekAna = T.ornek.ana.filter(([t]) => icinde(t, bas, son));
  const ornekPerde = T.ornek.perde.filter(([t]) => icinde(t, bas, son));
  const farkAna = ornekAna.slice(1).map((x) => x[2]);
  const durum = T.durum.filter((x) => icinde(x.t, bas, son));
  const once = [...T.durum].reverse().find((x) => x.t < bas);
  return {
    sureSn: r2(sure),
    kare: {
      n: dt.length,
      fps: r2(dt.length / sure),
      dtP50: yuzde(dt, 0.5),
      dtP90: yuzde(dt, 0.9),
      dtP99: yuzde(dt, 0.99),
      dtMaks: dt.length ? Math.max(...dt) : null,
      ust20: dt.filter((d) => d > 20).length,
      ust34: dt.filter((d) => d > 34).length,
      ust100: dt.filter((d) => d > 100).length,
      isP50: yuzde(is, 0.5),
      isP90: yuzde(is, 0.9),
      isMaks: is.length ? Math.max(...is) : null,
    },
    tuvalBoyut: tuval.map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
    offscreenTuval: T.offscreen.filter((t) => icinde(t, bas, son)).length,
    resizeObserver: { n: ro.length, ilk: ro.slice(0, 8).map((x) => ({ t: r2((x.t - bas) / 1000), kaynak: x.kaynak, g: x.g })) },
    pencereOlay: { n: pencere.length, tur: pencere.reduce((a, x) => ((a[x.tur] = (a[x.tur] || 0) + 1), a), {}), ilk: pencere.slice(0, 6).map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })) },
    cizici: {
      durumBaslangic: once?.k ?? null,
      durumGecis: durum.map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
      kaliteUygula: T.kaliteOlay.filter((x) => icinde(x.t, bas, son)).map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
      bosKare: T.ciz.bos.filter((x) => icinde(x.t, bas, son)).map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
      yerlesim: T.yerlesim.filter((x) => icinde(x.t, bas, son)).map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
      yerlesimBayrak: T.yerlesimBayrak.filter((t) => icinde(t, bas, son)).length,
      gokKur: T.gokKur.filter((x) => icinde(x.t, bas, son)).map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
      perdeBoyut: T.perde.boyut.filter((x) => icinde(x.t, bas, son)).map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
      perdeCiz: T.perde.ciz.filter(([t, d]) => icinde(t, bas, son) && d === 1).length,
      perdeTemizle: T.perde.ciz.filter(([t, d]) => icinde(t, bas, son) && d === 0).length,
      perdeGecis: (() => {
        const p = T.perde.ciz.filter(([t]) => icinde(t, bas, son));
        let g = 0;
        for (let i = 1; i < p.length; i++) if (p[i][1] !== p[i - 1][1]) g++;
        return g;
      })(),
    },
    dom: { mutasyon: mut.length, mutasyonSn: r2(mut.length / sure), anahtar: Object.entries(mutSay).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => ({ k, n, ornek: mutOrnek[k] })) },
    animasyon: anim,
    zamanlayici: Object.values(zam).sort((a, b) => b.tetik + b.kurulum - (a.tetik + a.kurulum)),
    piksel: {
      ana: { n: ornekAna.length, ortMin: ornekAna.length ? Math.min(...ornekAna.map((x) => x[1])) : null, ortMaks: ornekAna.length ? Math.max(...ornekAna.map((x) => x[1])) : null, farkP50: yuzde(farkAna, 0.5), farkP90: yuzde(farkAna, 0.9), farkMaks: farkAna.length ? Math.max(...farkAna) : null, stdMin: ornekAna.length ? Math.min(...ornekAna.map((x) => x[3])) : null },
      perde: { n: ornekPerde.length, alfaMaks: ornekPerde.length ? Math.max(...ornekPerde.map((x) => x[4])) : null, farkMaks: ornekPerde.length > 1 ? Math.max(...ornekPerde.slice(1).map((x) => x[2])) : null },
      isaretli: T.isaretli.filter((x) => icinde(x.t, bas, son)).map((x) => ({ ...x, t: r2((x.t - bas) / 1000) })),
    },
    patlama: T.patlamaSonuc.filter((p) => icinde(p.bas, bas, son)),
  };
}

/** Ekran görüntüsü dizisini ayrı bir sayfada çözüp ardışık farkları hesapla. */
async function ssAnaliz(analizSayfa, pngler) {
  return analizSayfa.evaluate(async (b64ler) => {
    const W = 200;
    const lumlar = [];
    let H = 0;
    for (const b of b64ler) {
      const ikili = Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([ikili], { type: 'image/png' }));
      H = Math.round((bmp.height / bmp.width) * W);
      const c = new OffscreenCanvas(W, H);
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(bmp, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      const L = new Float32Array(W * H);
      let top = 0;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        L[j] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        top += L[j];
      }
      lumlar.push({ L, ort: top / L.length });
    }
    const fark = (a, b) => {
      let s = 0;
      let buyuk = 0;
      for (let i = 0; i < a.length; i++) {
        const f = Math.abs(a[i] - b[i]);
        s += f;
        if (f > 40) buyuk++;
      }
      return { ort: s / a.length, buyukOran: buyuk / a.length };
    };
    const ardisik = [];
    for (let i = 1; i < lumlar.length; i++) ardisik.push(fark(lumlar[i - 1].L, lumlar[i].L));
    const aba = [];
    for (let i = 1; i + 1 < lumlar.length; i++) {
      const dAC = fark(lumlar[i - 1].L, lumlar[i + 1].L).ort;
      const dAB = ardisik[i - 1].ort;
      const dBC = ardisik[i].ort;
      if (dAB > 2 && dBC > 2 && dAC < 0.4 * Math.min(dAB, dBC)) aba.push({ i, dAB, dBC, dAC });
    }
    let enI = 0;
    for (let i = 1; i < ardisik.length; i++) if (ardisik[i].ort > ardisik[enI].ort) enI = i;
    return { boyut: `${W}x${H}`, ort: lumlar.map((x) => Math.round(x.ort * 10) / 10), ardisik: ardisik.map((x) => ({ ort: Math.round(x.ort * 100) / 100, buyukOran: Math.round(x.buyukOran * 10000) / 10000 })), aba, enFarkli: enI };
  }, pngler.map((b) => b.toString('base64')));
}

function cerceveHtml(url, ust) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;background:#fff;overflow:hidden}#ust{position:fixed;left:0;right:0;top:0;height:${ust}px;background:#f5f4ef;border-bottom:1px solid #ddd;font:14px sans-serif;display:flex;align-items:center;padding-left:12px}
iframe{position:fixed;left:0;top:${ust}px;width:100%;height:calc(100% - ${ust}px);border:0;display:block}</style></head>
<body><div id="ust">claude.ai benzeri çerçeve</div><iframe src="${url}" allow="autoplay"></iframe></body></html>`;
}

// ─────────────────────────── Profil koşusu ───────────────────────────
async function profilKos(browser, analizSayfa, ad, p) {
  const dir = join(OUT, ad);
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: p.dpr,
    isMobile: p.mobil,
    hasTouch: true,
    userAgent: p.ua,
  });
  await ctx.addInitScript(enjekte);
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') hatalar.push(`console.${m.type()}: ${m.text().slice(0, 200)}`);
  });
  let oyun = page;
  let ofsY = 0;
  if (p.cerceve) {
    if (!/^https?:/.test(URL_)) throw new Error('tablet-cerceve yalnız http adresinde çalışır');
    const sarmal = new globalThis.URL('/__titreme_cerceve.html', URL_).href;
    await page.route(sarmal, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: cerceveHtml(URL_, p.cerceve) }));
    await page.goto(sarmal);
    const son = Date.now() + 20000;
    while (!(oyun = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(URL_))) && Date.now() < son) await bekleMs(100);
    if (!oyun) throw new Error('iframe bulunamadı');
    ofsY = p.cerceve;
  } else await page.goto(URL_);
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const dokun = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await bekleMs(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const ss = (dosya) => page.screenshot({ path: join(dir, dosya), scale: 'css' });

  await oyun.waitForSelector('.f-acilis', { timeout: 30000 });
  await bekleMs(1800);
  await dokun(p.w / 2, ofsY + (p.h - ofsY) * 0.72);
  await bekleKosul(oyun, () => window.__fitil?.ekran?.() === 'oyun' && window.__fitil.bolum() === 1, null, 20000, 'bölüm 1');
  await bekleMs(1500);

  const fazlar = {};
  const bostaFaz = async (etiket) => {
    const bas = await oyun.evaluate((e) => window.__titreme.isaret(`${e}:bas`), etiket);
    const t0 = Date.now();
    const kadar = (ms) => bekleMs(Math.max(0, t0 + ms - Date.now()));
    await kadar(6500);
    await ss(`${etiket}-bosta-6s.png`);
    await kadar(14000);
    await oyun.evaluate(() => window.__titreme.patlamaBasla(3000));
    await kadar(BEKLE);
    const son = await oyun.evaluate((e) => window.__titreme.isaret(`${e}:son`), etiket);
    // Ardışık ekran görüntüleri (hâlâ boşta)
    const ssBas = await oyun.evaluate((e) => window.__titreme.isaret(`${e}:ss`), etiket);
    const pngler = [];
    const ssZaman = [];
    for (let i = 0; i < SS; i++) {
      const z0 = Date.now();
      pngler.push(await page.screenshot({ scale: 'css' }));
      ssZaman.push(Date.now() - z0);
    }
    const ssSon = await oyun.evaluate((e) => window.__titreme.isaret(`${e}:ss-son`), etiket);
    const an = await ssAnaliz(analizSayfa, pngler);
    writeFileSync(join(dir, `${etiket}-ss-ilk.png`), pngler[0]);
    writeFileSync(join(dir, `${etiket}-ss-enfarkli-a.png`), pngler[an.enFarkli]);
    writeFileSync(join(dir, `${etiket}-ss-enfarkli-b.png`), pngler[an.enFarkli + 1]);
    const T = await oyun.evaluate(() => {
      const T = window.__titreme;
      return JSON.parse(JSON.stringify({ ...T, sec: undefined, isaret: undefined, patlamaBasla: undefined, bilgi: undefined, rafSayac: undefined, ornekIs: undefined, patlama: null }));
    });
    const bilgi = await oyun.evaluate(() => window.__titreme.bilgi());
    const durum = await oyun.evaluate(() => window.__fitil.durum());
    fazlar[etiket] = {
      bilgi,
      oyunDurumu: durum,
      bosta: pencereOzeti(T, bas, son),
      ssPencere: pencereOzeti(T, ssBas, ssSon),
      ss: { n: SS, sureMs: ssZaman, ...an, dosyalar: [`${etiket}-ss-ilk.png`, `${etiket}-ss-enfarkli-a.png`, `${etiket}-ss-enfarkli-b.png`, `${etiket}-bosta-6s.png`] },
    };
    return T;
  };

  await bostaFaz('b1');

  // Orta bölüm: 1–6 kazanılmış kayıt, bot ile birkaç hamle, sonra normal hız.
  const yama = {};
  for (let i = 1; i < BOLUM; i++) yama[String(i)] = { yildiz: 3, enIyi: 3000, deneme: 1, basarisizSeri: 0, kazanc: 1 };
  await oyun.evaluate((y) => window.__fitil.kayitYama({ bolumler: y }), yama);
  await oyun.evaluate((id) => window.__fitil.bolumAc(id), BOLUM);
  await bekleKosul(oyun, (id) => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === id, BOLUM, 30000, `bölüm ${BOLUM}`);
  await bekleMs(1200);
  await oyun.evaluate(() => window.__fitil.hizli(true));
  let oynanan = 0;
  for (let i = 0; i < HAMLE; i++) {
    if ((await oyun.evaluate(() => window.__fitil.ekran())) !== 'oyun') break;
    await oyun.evaluate(() => window.__fitil.botHamle('usta'));
    oynanan++;
  }
  await oyun.evaluate(() => window.__fitil.hizli(false));
  await bekleKosul(oyun, () => window.__fitil.durum().oturum === 'bekliyor' && !window.__fitil.durum().oynuyor, null, 30000, 'hamle sonrası bekliyor').catch(() => undefined);
  await bekleMs(1500);
  const T = await bostaFaz(`b${BOLUM}`);
  fazlar[`b${BOLUM}`].oynananHamle = oynanan;

  // Otomatik kalite geçişinin görsel büyüklüğü: zaman dondurulur, yüksek ↔ düşük elle.
  const kaliteKare = async (k) => {
    await oyun.evaluate((kk) => window.__fitil.cizici().secenekAyarla({ kalite: kk }), k);
    await bekleMs(250);
    return page.screenshot({ scale: 'css' });
  };
  await oyun.evaluate(() => window.__fitil.cizici().dev.dondur(true));
  await bekleMs(200);
  const kY = await kaliteKare('yuksek');
  const kD = await kaliteKare('dusuk');
  // Kare başına dolum (drawImage + fillRect hedef alanı, cihaz pikseli; yol dolguları hariç = alt sınır).
  const dolum = {};
  for (const k of ['yuksek', 'dusuk']) {
    dolum[k] = await oyun.evaluate(async (kk) => {
      const c = window.__fitil.cizici();
      c.secenekAyarla({ kalite: kk });
      const ctx = c.stage.ctx;
      const st = c.stage.canvas;
      let alan = 0;
      let cagri = 0;
      const olc = (w, h) => {
        const m = ctx.getTransform();
        alan += Math.abs(w * h * (m.a * m.d - m.b * m.c));
        cagri++;
      };
      const d0 = ctx.drawImage;
      const f0 = ctx.fillRect;
      ctx.drawImage = function (img, ...a) {
        if (a.length === 2) olc(img.width, img.height);
        else if (a.length === 4) olc(a[2], a[3]);
        else if (a.length === 8) olc(a[6], a[7]);
        return d0.call(this, img, ...a);
      };
      ctx.fillRect = function (x, y, w, h) {
        olc(w, h);
        return f0.call(this, x, y, w, h);
      };
      const n0 = window.__titreme.ciz.n;
      await new Promise((r) => {
        let i = 0;
        const f = () => (++i >= 30 ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
      });
      delete ctx.drawImage;
      delete ctx.fillRect;
      const kare = Math.max(1, window.__titreme.ciz.n - n0);
      const px = st.width * st.height;
      // Kare maliyeti: kare() + zorla boşaltma (getImageData 1×1 → bekleyen çizim komutları
      // rasterlanır). Yazılım tuvalinde CPU rasteri; GPU'daki dolum maliyetinin göreli vekili.
      const sureler = [];
      const k0 = c.kare;
      c.kare = function (...a) {
        const t0 = performance.now();
        const r = k0.apply(this, a);
        ctx.getImageData(0, 0, 1, 1);
        sureler.push(performance.now() - t0);
        return r;
      };
      await new Promise((r) => {
        let i = 0;
        const f = () => (++i >= 40 ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
      });
      c.kare = k0;
      sureler.sort((a, b) => a - b);
      const med = sureler[sureler.length >> 1] ?? null;
      return { kare, tuvalMP: Math.round(px / 1e4) / 100, dolumMP: Math.round(alan / kare / 1e4) / 100, katKat: Math.round((alan / kare / px) * 100) / 100, cagri: Math.round(cagri / kare), maliyetMs: med == null ? null : Math.round(med * 10) / 10 };
    }, k);
  }
  await oyun.evaluate(() => {
    const c = window.__fitil.cizici();
    c.secenekAyarla({ kalite: 'oto' });
    c.dev.dondur(false);
  });
  writeFileSync(join(dir, 'kalite-yuksek.png'), kY);
  writeFileSync(join(dir, 'kalite-dusuk.png'), kD);
  const kf = await ssAnaliz(analizSayfa, [kY, kD]);
  const kaliteFarki = { ...kf.ardisik[0], ortYuksek: kf.ort[0], ortDusuk: kf.ort[1], dolum, dosyalar: ['kalite-yuksek.png', 'kalite-dusuk.png'] };

  // desynchronized tehlikesi: ön tampon çizim ORTASINDA taranırsa ne görünür? Ana tuvalin
  // durumu sandık/tahta çizilmeden hemen önce (gök + kasaba bitti) ile kare sonu kıyaslanır.
  const ara = await oyun.evaluate(async () => {
    const c = window.__fitil.cizici();
    const st = c.stage.canvas;
    const kopya = (w) => {
      const k = document.createElement('canvas');
      k.width = st.width;
      k.height = st.height;
      k.getContext('2d').drawImage(st, 0, 0);
      return k.toDataURL('image/png').split(',')[1];
    };
    let yarim = null;
    const sandik = c.sandik;
    const orj = sandik.ciz;
    sandik.ciz = function (...a) {
      if (!yarim) yarim = kopya();
      return orj.apply(this, a);
    };
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    sandik.ciz = orj;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    return { yarim, tam: kopya() };
  });
  let araKare = null;
  if (ara.yarim) {
    const y = Buffer.from(ara.yarim, 'base64');
    const tm = Buffer.from(ara.tam, 'base64');
    writeFileSync(join(dir, 'ara-kare-gok-bitti.png'), y);
    writeFileSync(join(dir, 'ara-kare-tam.png'), tm);
    const af = await ssAnaliz(analizSayfa, [y, tm]);
    araKare = { ...af.ardisik[0], ortYarim: af.ort[0], ortTam: af.ort[1], dosyalar: ['ara-kare-gok-bitti.png', 'ara-kare-tam.png'] };
  }

  // Oturum boyu kalite geçişleri, hangi aşamada oldukları ile.
  const isr = T.isaretler;
  const asama = (t) => {
    let a = 'açılış';
    for (const m of isr) if (m.t <= t) a = m.ad;
    return a;
  };
  const kaliteCizelgesi = T.kaliteOlay.map((x) => ({ tSn: r2(x.t / 1000), asama: asama(x.t), dusuk: x.dusuk, gerekenIyi: x.gerekenIyi, tazeleme: x.tazeleme, yer: x.yer.split(' < ')[0] }));

  const ozet = { profil: ad, ...p, url: URL_, bekleSn: BEKLE / 1000, gpu: GPU, cpu: CPU, hatalar, kaliteFarki, araKare, kaliteCizelgesi, isaretler: isr.map((m) => ({ ad: m.ad, tSn: r2(m.t / 1000) })), fazlar };
  writeFileSync(join(dir, 'ozet.json'), JSON.stringify(ozet, null, 1));
  writeFileSync(join(dir, 'ham.json'), JSON.stringify({ tuval: T.tuval, ro: T.ro, pencere: T.pencere, durum: T.durum, kaliteOlay: T.kaliteOlay, yerlesim: T.yerlesim, gokKur: T.gokKur, perde: T.perde, isaretler: T.isaretler, isaretli: T.isaretli, patlamaSonuc: T.patlamaSonuc, ornekAna: T.ornek.ana, kareDt: T.kareDt, kareIs: T.kareIs }));
  await ctx.close();
  return ozet;
}

// ─────────────────────────── Kalite benzetimi (--sim) ───────────────────────────
/**
 * src/render/oyunCizici.ts `kaliteIzle`'nin (satır ~1747–1797) birebir kopyası:
 * gerçek donanımda ölçülemeyen kare aralığı desenlerini (sınırda GPU, uyarlamalı
 * tazeleme hızı) besleyip kalite geçişlerini sayar. Kod değişirse bunu da güncelle.
 */
function kaliteIzleKopya(st, t0, is, oynatma) {
  const onceki = st.sonKareZamani;
  st.sonKareZamani = t0;
  if (!onceki) return;
  let aralik = t0 - onceki;
  if (aralik <= 0) return;
  if (aralik > 100) {
    st.uzunSeri++;
    if (st.uzunSeri <= 2) {
      st.kaliteAtla = Math.max(st.kaliteAtla, 10);
      st.pAralik = st.pIs = st.pN = 0;
      return;
    }
    aralik = Math.min(aralik, 250);
  } else st.uzunSeri = 0;
  if (st.kaliteAtla > 0 && st.uzunSeri <= 2) {
    st.kaliteAtla--;
    return;
  }
  st.pAralik += aralik;
  st.pIs += is;
  st.pN++;
  if (st.pN < 30) return;
  const ort = st.pAralik / st.pN;
  const isOrt = st.pIs / st.pN;
  st.pAralik = st.pIs = st.pN = 0;
  if (ort < st.tazeleme) st.tazeleme = Math.max(6, ort);
  const esik = Math.max(st.tazeleme * 1.3, st.tazeleme + 5);
  if (!st.dusukKalite) {
    if (ort > esik) {
      st.dusukKalite = true;
      st.iyiPencere = 0;
    }
    return;
  }
  const iyi = !oynatma && ort <= st.tazeleme * 1.12 && isOrt < st.tazeleme * 0.5;
  st.iyiPencere = iyi ? st.iyiPencere + 1 : 0;
  if (st.iyiPencere >= st.gerekenIyi) {
    st.dusukKalite = false;
    st.iyiPencere = 0;
    st.gerekenIyi = Math.min(64, st.gerekenIyi * 2);
  }
}

function kaliteBenzetimi() {
  let tohum = 12345;
  const rnd = () => ((tohum = (tohum * 1103515245 + 12345) >>> 0) / 4294967296);
  const V60 = 1000 / 60;
  /** Çift tampon: GPU süresi tazelemeyi aşarsa aralık bir sonraki vsync katına yuvarlanır. */
  const cift = (maliyet, v = V60) => Math.max(1, Math.ceil(maliyet / v)) * v;
  /** Üçlü tampon: ortalama aralık ≈ max(v, maliyet), kareler v ile 2v arasında karışık. */
  const uclu = (maliyet, v = V60) => (maliyet <= v ? v : rnd() < (maliyet - v) / v ? 2 * v : v);
  const senaryolar = {
    'sinirda-gpu-cift-tampon (yüksek 18±1,5 ms, düşük 13±1,5 ms, 60 Hz)': (t, d) => ({ aralik: cift((d ? 13 : 18) + (rnd() - 0.5) * 3), is: 1, oynatma: false }),
    'sinirda-gpu-uclu-tampon (yüksek 24±2 ms, düşük 15±2 ms, 60 Hz)': (t, d) => ({ aralik: uclu((d ? 15 : 24) + (rnd() - 0.5) * 4), is: 1, oynatma: false }),
    'rahat-gpu (yüksek 10 ms, düşük 8 ms, 60 Hz) — telefon kontrol': (t, d) => ({ aralik: cift(d ? 8 : 10), is: 1, oynatma: false }),
    'uyarlamali-tazeleme (dokunurken 120 Hz, 4 sn; bırakınca 1 sn oynatma; boşta 60 Hz, 15 sn)': (t) => {
      const evre = t % 20000;
      const dokunma = evre < 4000;
      const oynatma = evre >= 4000 && evre < 5000;
      return { aralik: dokunma || oynatma ? 1000 / 120 : V60, is: 1, oynatma };
    },
  };
  const sonuc = {};
  for (const [ad, kare] of Object.entries(senaryolar)) {
    const st = { dusukKalite: false, sonKareZamani: 0, kaliteAtla: 30, pAralik: 0, pIs: 0, pN: 0, tazeleme: V60, iyiPencere: 0, uzunSeri: 0, gerekenIyi: 4 };
    const olay = [];
    let t = 1000;
    while (t < 61000) {
      const k = kare(t - 1000, st.dusukKalite);
      t += k.aralik;
      const once = st.dusukKalite;
      kaliteIzleKopya(st, t, k.is, k.oynatma);
      if (st.dusukKalite !== once) olay.push({ tSn: r2((t - 1000) / 1000), kalite: st.dusukKalite ? 'düşük' : 'yüksek', gerekenIyi: st.gerekenIyi, tazeleme: r2(st.tazeleme) });
    }
    sonuc[ad] = { gecis60sn: olay.length, olay };
    console.log(`${ad}: 60 sn'de ${olay.length} geçiş → ${olay.map((o) => `${o.tSn}s ${o.kalite}`).join(', ')}`);
  }
  return sonuc;
}

if (bayrak.sim) {
  writeFileSync(join(OUT, 'kalite-sim.json'), JSON.stringify(kaliteBenzetimi(), null, 1));
  console.log(`yazıldı: ${join(OUT, 'kalite-sim.json')}`);
  process.exit(0);
}

// ─────────────────────────── Ana akış ───────────────────────────
const gpuArg = GPU === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader'] : ['--disable-gpu', '--disable-accelerated-2d-canvas'];
const browser = await chromium.launch({ executablePath: exe, args: [...gpuArg, '--autoplay-policy=no-user-gesture-required'] });
const analizCtx = await browser.newContext();
const analizSayfa = await analizCtx.newPage();
await analizSayfa.setContent('<html><body></body></html>');
const sonuclar = {};
const basla = Date.now();
for (const ad of secilen) {
  const p = PROFILLER[ad];
  const y0 = os.loadavg()[0];
  console.log(`▶ ${ad} (${p.w}×${p.h} @${p.dpr}, ${p.not}) — yük ${y0.toFixed(2)}`);
  try {
    sonuclar[ad] = await profilKos(browser, analizSayfa, ad, p);
    sonuclar[ad].yuk = [r2(y0), r2(os.loadavg()[0])];
  } catch (e) {
    console.log(`  ✗ ${ad}: ${e.message}`);
    sonuclar[ad] = { profil: ad, hata: String(e.stack || e) };
  }
}
await browser.close();

// Kıyas tablosu
const satirlar = [];
for (const [ad, o] of Object.entries(sonuclar)) {
  if (!o.fazlar) {
    satirlar.push({ profil: ad, hata: o.hata?.split('\n')[0] });
    continue;
  }
  for (const [faz, f] of Object.entries(o.fazlar)) {
    const b = f.bosta;
    const cz = f.bilgi.cizici || {};
    satirlar.push({
      profil: ad,
      faz,
      tuval: cz.tuval?.split(' ')[0],
      kip: cz.ekranW / cz.ekranH > 0.75 ? 'yatay' : 'dikey',
      fps: b.kare.fps,
      dtP50: b.kare.dtP50,
      dtP90: b.kare.dtP90,
      isP50: b.kare.isP50,
      kalite: cz.dusukKalite ? 'düşük' : 'yüksek',
      kaliteGecis: b.cizici.kaliteUygula.length,
      tuvalBoyut: b.tuvalBoyut.length,
      ro: b.resizeObserver.n,
      pencereOlay: b.pencereOlay.n,
      yerlesim: b.cizici.yerlesim.length,
      gokKur: b.cizici.gokKur.length,
      bosKare: b.cizici.bosKare.length,
      perdeBoyut: b.cizici.perdeBoyut.length,
      perdeGecis: b.cizici.perdeGecis,
      mutSn: b.dom.mutasyonSn,
      anim: b.animasyon.length,
      offscreen: b.offscreenTuval,
      pikselFarkP90: b.piksel.ana.farkP90,
      pikselIsaret: b.piksel.isaretli.length,
      kareIsaret: b.patlama.reduce((a, p) => a + p.isaret.length, 0),
      ssFarkMaks: Math.max(...f.ss.ardisik.map((x) => x.ort)),
      ssABA: f.ss.aba.length,
      kaliteGorselFark: o.kaliteFarki?.ort,
      kaliteBuyukOran: o.kaliteFarki?.buyukOran,
      oturumKaliteGecis: o.kaliteCizelgesi?.length,
      araKareFark: o.araKare?.ort,
      dolumMP: o.kaliteFarki?.dolum ? `${o.kaliteFarki.dolum.yuksek.dolumMP}/${o.kaliteFarki.dolum.dusuk.dolumMP}` : null,
      maliyetMs: o.kaliteFarki?.dolum ? `${o.kaliteFarki.dolum.yuksek.maliyetMs}/${o.kaliteFarki.dolum.dusuk.maliyetMs}` : null,
    });
  }
}
writeFileSync(join(OUT, 'kiyas.json'), JSON.stringify({ url: URL_, bekleSn: BEKLE / 1000, gpu: GPU, cpu: CPU, sureSn: Math.round((Date.now() - basla) / 1000), cekirdek: os.cpus().length, satirlar }, null, 1));
console.table(satirlar);
console.log(`yazıldı: ${join(OUT, 'kiyas.json')} (${Math.round((Date.now() - basla) / 1000)} sn)`);
