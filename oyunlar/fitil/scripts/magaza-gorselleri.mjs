/**
 * Android simgeleri, açılış perdesi ve Play mağaza görselleri (docs/ANDROID.md §4).
 * Kaynak SVG'ler `magaza/kaynak/`; Playwright Chromium ile PNG'ye çizilir.
 *
 *   node scripts/magaza-gorselleri.mjs                  # simge + play (sunucu gerekmez)
 *   node scripts/magaza-gorselleri.mjs simge            # android/app/src/main/res: mipmap-*, anydpi-v26, açılış perdesi
 *   node scripts/magaza-gorselleri.mjs play             # magaza/play: simge-512, öne çıkan görsel (TR + EN)
 *   node scripts/magaza-gorselleri.mjs ekran <url> [tr|en] [sahne,…]  # magaza/play/ekran-tr-0N.png, ekran-en-0N.png (dev sunucusu)
 *   node scripts/magaza-gorselleri.mjs onizleme <klasör> # maskeli simge ve açılış perdesi denetim kareleri
 *
 * Windows PowerShell'de de aynı komutlar; Linux bulut ortamında hazır Chromium
 * (/opt/pw-browsers/chromium) kullanılır. Ekran görüntüleri için önce
 * `npm run dev` (ya da `npx vite --port 5194 --strictPort`) açık olmalı.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KAYNAK = join(KOK, 'magaza', 'kaynak');
const PLAY = join(KOK, 'magaza', 'play');
const RES = join(KOK, 'android', 'app', 'src', 'main', 'res');

/** Oyunun açılış zemini (index.html theme-color, res/values/colors.xml fitil_gece). */
const GECE = '#0B1030';

/** Android yoğunlukları: dp → piksel çarpanı. */
const YOGUNLUK = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** Capacitor şablonunun açılış perdesi boyutları (drawable-port/land-*); `drawable/splash.png` land-mdpi ile aynı. */
const PERDE = {
  'port-mdpi': [320, 480],
  'port-hdpi': [480, 800],
  'port-xhdpi': [720, 1280],
  'port-xxhdpi': [960, 1600],
  'port-xxxhdpi': [1280, 1920],
  'land-mdpi': [480, 320],
  'land-hdpi': [800, 480],
  'land-xhdpi': [1280, 720],
  'land-xxhdpi': [1600, 960],
  'land-xxxhdpi': [1920, 1280],
};

// ─────────────────────────── Yardımcılar ───────────────────────────

const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

function svgOku(ad) {
  return readFileSync(join(KAYNAK, ad), 'utf8')
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

/** Kök <svg>'nin viewBox'ını değiştirir (ör. 108 dp tuvalden ortadaki 72 dp'yi kırpmak için). */
function gorunum(svg, viewBox) {
  return svg.replace(/<svg([^>]*?)viewBox="[^"]*"/, `<svg$1viewBox="${viewBox}"`);
}

/** Nunito (oyunun gömülü yazı tipi) data: URL olarak: sayfa dış kaynak yüklemez. Bir kez okunur. */
let yaziTipiOnbellek = '';
function yaziTipiCss() {
  if (yaziTipiOnbellek) return yaziTipiOnbellek;
  const d = join(KOK, 'node_modules', '@fontsource-variable', 'nunito', 'files');
  const yuz = (dosya, aralik) =>
    `@font-face{font-family:'Nunito';font-weight:200 1000;font-style:normal;src:url(data:font/woff2;base64,${readFileSync(join(d, dosya)).toString('base64')}) format('woff2');unicode-range:${aralik};}`;
  yaziTipiOnbellek =
    yuz('nunito-latin-wght-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD') +
    yuz('nunito-latin-ext-wght-normal.woff2', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF');
  return yaziTipiOnbellek;
}

/** Katmanları üst üste dizen sayfa (her katman tam alanı kaplar); `yazi`: Nunito gömülür (yazılı SVG için). */
function sayfa(w, h, katmanlar, { zemin = 'transparent', yazi = false } = {}) {
  const ic = katmanlar.map((k) => `<div class="k">${k}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${yazi ? yaziTipiCss() : ''}
    html,body{margin:0;padding:0;background:transparent;}
    #s{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${zemin};}
    .k{position:absolute;inset:0;}
    .k>svg{display:block;width:100%;height:100%;}
  </style></head><body><div id="s">${ic}</div></body></html>`;
}

/** PNG başlığından boyut ve renk türü (2 = RGB, 6 = RGBA). */
function pngBilgi(yol) {
  const b = readFileSync(yol);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), renkTuru: b[25] };
}

class Cizer {
  async ac() {
    this.tarayici = await chromium.launch({ executablePath: exe });
    this.sayfa = await this.tarayici.newPage({ deviceScaleFactor: 1 });
  }
  async kapat() {
    await this.tarayici?.close();
  }
  /**
   * HTML'i w×h piksele çizip PNG yazar; `saydam` false ise zemin opak olmalı
   * (RGB). `alfa`: opak içerik ama 32 bit RGBA (Play simgesi "32-bit PNG (with
   * alpha)" ister). Chromium'un ekran görüntüsü opak karede alfa kanalını
   * atar; kare tuvalden yeniden kodlanır (tuvalin PNG'si hep RGBA) ve her
   * pikselde alfanın 255 olduğu denetlenir.
   */
  async ciz(html, w, h, yol, { saydam = false, serbest = false, alfa = false } = {}) {
    await this.sayfa.setViewportSize({ width: w, height: h });
    await this.sayfa.setContent(html, { waitUntil: 'load' });
    await this.sayfa.evaluate(() => document.fonts.ready);
    mkdirSync(dirname(yol), { recursive: true });
    const kare = await this.sayfa.locator('#s').screenshot({ omitBackground: saydam });
    writeFileSync(yol, alfa ? await this.rgbaKodla(kare) : kare);
    const b = pngBilgi(yol);
    if (!serbest && (b.w !== w || b.h !== h)) throw new Error(`${yol}: ${b.w}×${b.h}, beklenen ${w}×${h}`);
    if (alfa) {
      if (b.renkTuru !== 6) throw new Error(`${yol}: 32 bit RGBA beklenirken renk türü ${b.renkTuru}`);
      const enAz = await this.enAzAlfa(yol);
      if (enAz !== 255) throw new Error(`${yol}: saydam piksel var (en düşük alfa ${enAz})`);
    } else if (!saydam && b.renkTuru !== 2) throw new Error(`${yol}: opak beklenirken renk türü ${b.renkTuru}`);
    return b;
  }
  /** PNG'yi tarayıcının tuvalinden RGBA PNG olarak yeniden kodlar (piksel değerleri aynı). */
  async rgbaKodla(png) {
    const b64 = await this.sayfa.evaluate(async (veri) => {
      const r = new Image();
      r.src = `data:image/png;base64,${veri}`;
      await r.decode();
      const t = document.createElement('canvas');
      t.width = r.naturalWidth;
      t.height = r.naturalHeight;
      t.getContext('2d').drawImage(r, 0, 0);
      return t.toDataURL('image/png').split(',')[1];
    }, png.toString('base64'));
    return Buffer.from(b64, 'base64');
  }
  /** PNG'nin en düşük alfa değeri (tarayıcıda çözülür). */
  async enAzAlfa(yol) {
    const b64 = readFileSync(yol).toString('base64');
    return this.sayfa.evaluate(async (veri) => {
      const r = new Image();
      r.src = `data:image/png;base64,${veri}`;
      await r.decode();
      const t = document.createElement('canvas');
      t.width = r.naturalWidth;
      t.height = r.naturalHeight;
      const g = t.getContext('2d');
      g.drawImage(r, 0, 0);
      const d = g.getImageData(0, 0, t.width, t.height).data;
      let enAz = 255;
      for (let i = 3; i < d.length; i += 4) if (d[i] < enAz) enAz = d[i];
      return enAz;
    }, b64);
  }
}

const yaz = (yol, metin) => {
  mkdirSync(dirname(yol), { recursive: true });
  writeFileSync(yol, metin);
};
const goreli = (yol) => yol.slice(KOK.length + 1).replace(/\\/g, '/');

// ─────────────────────────── Simge katmanları ───────────────────────────

function katmanlar() {
  return { arka: svgOku('simge-arka.svg'), on: svgOku('simge-on.svg'), tek: svgOku('simge-tekrenk.svg') };
}

/** Uyarlanabilir simgenin başlatıcıda görünen hâli: 108 dp tuvalin ortadaki 72 dp'si. */
const GORUNEN = '18 18 72 72';

/**
 * `simge-tam.svg`: iki katmanın birleşimi (Play simgesi ve elle bakmak için).
 * Katman dosyalarından üretilir; elle düzenleme, katmanları düzenle.
 */
function tamSimgeSvg() {
  const { arka, on } = katmanlar();
  const ic = (s) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  FİTİL tam simge (Play 512×512 ve önizleme): simge-arka.svg + simge-on.svg,
  108 dp tuvalin başlatıcıda görünen ortadaki 72 dp'si. ÜRETİLİR:
  node scripts/magaza-gorselleri.mjs play — katman dosyalarını düzenle.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${GORUNEN}" width="512" height="512">
  <g id="arka">${ic(arka)}</g>
  <g id="on">${ic(on)}</g>
</svg>
`;
}

const ADAPTIF_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- FİTİL uyarlanabilir simgesi (docs/ANDROID.md §4): gece göğü arka katmanı,
     kıvılcımlı fitil ön katmanı, Android 13+ tek renkli (temalı) simge.
     PNG'ler scripts/magaza-gorselleri.mjs ile magaza/kaynak/*.svg'den üretilir. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;

/** Eski (API 24–25) başlatıcı simgesi: 48 dp'de 2 dp pay, yuvarlak kare ya da daire. */
function eskiSimgeHtml(px, yuvarlak) {
  const { arka, on } = katmanlar();
  const pay = (2 / 48) * px;
  const ic = px - 2 * pay;
  const kap = yuvarlak ? 'border-radius:50%;' : `border-radius:${(0.2 * ic).toFixed(2)}px;`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent;}
    #s{position:relative;width:${px}px;height:${px}px;}
    #m{position:absolute;left:${pay}px;top:${pay}px;width:${ic}px;height:${ic}px;overflow:hidden;${kap}}
    .k{position:absolute;inset:0;} .k>svg{display:block;width:100%;height:100%;}
  </style></head><body><div id="s"><div id="m"><div class="k">${gorunum(arka, GORUNEN)}</div><div class="k">${gorunum(on, GORUNEN)}</div></div></div></body></html>`;
}

/**
 * Açılış perdesi simgesi (`windowSplashScreenAnimatedIcon`): 288 dp tuval,
 * ön katmanın tamamı (108 dp ölçeğinde); sistem 2/3 daireyle maskeler,
 * ön katmanın içeriği 66/108 dairede kaldığı için hiçbir şey kesilmez.
 */
function perdeSimgesiHtml(px) {
  return sayfa(px, px, [katmanlar().on]);
}

/** splash.png: düz gece mavisi + ortada ön katman (tuval kısa kenarın %80'i; Android 12 oranı 288/360). */
function perdeHtml(w, h) {
  const t = Math.round(Math.min(w, h) * 0.8);
  const { on } = katmanlar();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;}
    #s{position:relative;width:${w}px;height:${h}px;background:${GECE};overflow:hidden;}
    #i{position:absolute;left:${(w - t) / 2}px;top:${(h - t) / 2}px;width:${t}px;height:${t}px;}
    #i>svg{display:block;width:100%;height:100%;}
  </style></head><body><div id="s"><div id="i">${on}</div></div></body></html>`;
}

async function simgeler(c) {
  const { arka, on, tek } = katmanlar();
  const yazilan = [];
  for (const [ad, f] of Object.entries(YOGUNLUK)) {
    const d = join(RES, `mipmap-${ad}`);
    const t = Math.round(108 * f);
    const e = Math.round(48 * f);
    await c.ciz(sayfa(t, t, [arka]), t, t, join(d, 'ic_launcher_background.png'));
    await c.ciz(sayfa(t, t, [on]), t, t, join(d, 'ic_launcher_foreground.png'), { saydam: true });
    await c.ciz(sayfa(t, t, [tek]), t, t, join(d, 'ic_launcher_monochrome.png'), { saydam: true });
    await c.ciz(eskiSimgeHtml(e, false), e, e, join(d, 'ic_launcher.png'), { saydam: true });
    await c.ciz(eskiSimgeHtml(e, true), e, e, join(d, 'ic_launcher_round.png'), { saydam: true });
    const p = Math.round(288 * f);
    await c.ciz(perdeSimgesiHtml(p), p, p, join(RES, `drawable-${ad}`, 'splash_simge.png'), { saydam: true });
    yazilan.push(`mipmap-${ad} (${t}/${e} px), drawable-${ad}/splash_simge.png (${p} px)`);
  }
  for (const [ad, [w, h]] of Object.entries(PERDE)) {
    await c.ciz(perdeHtml(w, h), w, h, join(RES, `drawable-${ad}`, 'splash.png'));
  }
  await c.ciz(perdeHtml(480, 320), 480, 320, join(RES, 'drawable', 'splash.png'));
  yazilan.push(`açılış perdesi: drawable/splash.png + ${Object.keys(PERDE).length} yön/yoğunluk`);
  yaz(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), ADAPTIF_XML);
  yaz(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), ADAPTIF_XML);
  yazilan.push('mipmap-anydpi-v26/ic_launcher.xml, ic_launcher_round.xml');
  // Capacitor şablonunun artık kullanılmayan varsayılan simge parçaları (yeşil ızgara, robot).
  for (const eski of ['drawable/ic_launcher_background.xml', 'drawable-v24/ic_launcher_foreground.xml', 'values/ic_launcher_background.xml']) {
    const y = join(RES, eski);
    if (existsSync(y)) {
      rmSync(y);
      yazilan.push(`silindi: ${eski}`);
    }
  }
  return yazilan;
}

// ─────────────────────────── Önizleme (denetim) ───────────────────────────

/** Başlatıcı maskeleri (72 dp görünen alan üstünde): daire, yuvarlak kare, damla, yumuşak kare. */
const MASKELER = {
  daire: 'border-radius:50%;',
  'yuvarlak-kare': 'border-radius:22%;',
  damla: 'border-radius:50% 50% 50% 12%;',
  kare: 'border-radius:8%;',
};

async function onizleme(c, klasor) {
  const { arka, on, tek } = katmanlar();
  mkdirSync(klasor, { recursive: true });
  const boylar = [192, 96, 48, 36];
  const hucre = (px, kap) =>
    `<div style="position:relative;width:${px}px;height:${px}px;overflow:hidden;${kap}"><div class="k">${gorunum(arka, GORUNEN)}</div><div class="k">${gorunum(on, GORUNEN)}</div></div>`;
  const satirlar = Object.entries(MASKELER)
    .map(([ad, kap]) => `<div class="satir"><span>${ad}</span>${boylar.map((b) => hucre(b, kap)).join('')}</div>`)
    .join('');
  const temali = boylar
    .map((b) => `<div style="position:relative;width:${b}px;height:${b}px;border-radius:50%;overflow:hidden;background:#D8E2FF;"><div class="k" style="filter:brightness(0) saturate(100%) invert(14%) sepia(37%) saturate(2400%) hue-rotate(215deg);">${gorunum(tek, GORUNEN)}</div></div>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#3A3F4A;font:16px system-ui;color:#fff;}
    #s{padding:24px;display:flex;flex-direction:column;gap:22px;width:760px;background:linear-gradient(#5B6B7F,#2E3440);}
    .satir{display:flex;align-items:center;gap:22px;} .satir>span{width:130px;}
    .k{position:absolute;inset:0;} .k>svg{display:block;width:100%;height:100%;}
  </style></head><body><div id="s">${satirlar}<div class="satir"><span>temalı (13+)</span>${temali}</div></div></body></html>`;
  await c.ciz(html, 808, 1400, join(klasor, 'simge-maskeler.png'), { serbest: true });

  // Açılış perdesi: Android 12+ (288 dp tuval, 2/3 daire maskesi) 360×800 dp telefon, ×2.
  const perde = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;}
    #s{position:relative;width:720px;height:1600px;background:${GECE};}
    #i{position:absolute;left:72px;top:512px;width:576px;height:576px;clip-path:circle(33.333% at 50% 50%);}
    #i>svg{display:block;width:100%;height:100%;}
  </style></head><body><div id="s"><div id="i">${on}</div></div></body></html>`;
  await c.ciz(perde, 720, 1600, join(klasor, 'perde-android12.png'));
  return [join(klasor, 'simge-maskeler.png'), join(klasor, 'perde-android12.png')];
}

// ─────────────────────────── Play mağaza görselleri ───────────────────────────

/**
 * Play simgesi 512×512: tam kare, saydam piksel yok (Play köşeleri kendi
 * yuvarlar) ama dosya 32 bit RGBA: Play Console'un simge şartı "32-bit PNG
 * (with alpha)"; 24 bit RGB yükleme reddedilebilir. Öne çıkan görsel ve ekran
 * görüntüleri 24 bit RGB kalır (onların şartı "JPEG ya da 24-bit PNG (alfa yok)").
 */
async function playGorselleri(c) {
  const tam = tamSimgeSvg();
  yaz(join(KAYNAK, 'simge-tam.svg'), tam);
  const yazilan = [join(KAYNAK, 'simge-tam.svg')];
  const ic = tam.replace(/<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  await c.ciz(sayfa(512, 512, [ic], { zemin: GECE }), 512, 512, join(PLAY, 'simge-512.png'), { alfa: true });
  yazilan.push(join(PLAY, 'simge-512.png'));

  // Öne çıkan görsel 1024×500 (24 bit, saydamlık yok): Türkçe ve İngilizce.
  const one = svgOku('one-cikan.svg');
  for (const [dil, dosya] of [
    ['tr', 'one-cikan-1024x500.png'],
    ['en', 'one-cikan-1024x500_en.png'],
  ]) {
    const dilCss = dil === 'en' ? '<style>#s .tr{display:none}#s .en{display:inline}</style>' : '';
    await c.ciz(sayfa(1024, 500, [one], { zemin: GECE, yazi: true }).replace('</head>', `${dilCss}</head>`), 1024, 500, join(PLAY, dosya));
    yazilan.push(join(PLAY, dosya));
  }
  return yazilan;
}

// ─────────────────────────── Telefon ekran görüntüleri ───────────────────────────

/**
 * Play telefon ekran görüntüleri: 360×640 CSS px, DPR 3 → 1080×1920 (9:16,
 * saydamlık yok). Her kare temiz bir tarayıcı bağlamında (boş kayıt) çekilir;
 * ilerleme gerekirse test kancasının `kayitYama`'sıyla kurulur. `?gelir=sahte`:
 * Android sürümündeki gibi can hapı ve Mağaza görünür (sahte sağlayıcının
 * kendi katmanları bu karelerde açılmaz). Oyunun kendi Nunito'su gömülüdür.
 */
const EKRAN = { w: 360, h: 640, dpr: 3 };

/** İlerlemiş kayıt: 1..son kazanılmış (3★, 6+ iki mühür), kasaba işleri, öğretim balonları kapalı. */
function ilerlemisKayit(son, isler = []) {
  const b = {};
  for (let i = 1; i <= son; i++) b[i] = { yildiz: 3, enIyi: 9000, deneme: 1, basarisizSeri: 0, kazanc: 1, ...(i >= 6 ? { muhur: 3 } : {}) };
  return { bolumler: b, kasaba: { isler, gunlukKandil: 0 }, ayarlar: { ipuclari: false } };
}

/** Harita karesi: İskele ve Çarşı tamamen, Liman yarıya kadar süslü (bakiye artıda: 39★ + 16 mühür + 2 mahalle). */
const SUSLU_ISLER = [
  'iskele.kayikFenerleri', 'iskele.iskeleBayraklari', 'iskele.fenerDizisi', 'iskele.kandilliKemer', 'iskele.denizFeneri', 'iskele.tabela',
  'carsi.dukkanKandilleri', 'carsi.kemerCelengi', 'carsi.laleFenerleri', 'carsi.kubbeKandilleri', 'carsi.mahyaYazisi', 'carsi.carsiKapisi',
  'liman.direkFenerleri', 'liman.halatFlamalari', 'liman.vincIsiklari', 'liman.gemiDonanmasi',
];

async function bekleKosul(page, kosul, arg, ms, ad) {
  try {
    await page.waitForFunction(kosul, arg, { timeout: ms, polling: 100 });
  } catch {
    throw new Error(`zaman aşımı: ${ad} (ekran ${await page.evaluate(() => window.__fitil?.ekran?.()).catch(() => '?')})`);
  }
}

/** Sahne adımları; her biri sayfayı karenin çekileceği ana getirir. */
const SAHNELER = [
  {
    ad: 'acilis',
    async kur(page) {
      await page.waitForSelector('.f-acilis.f-hazir', { timeout: 20000 });
      await page.waitForTimeout(1600);
    },
  },
  {
    ad: 'ogretim',
    async kur(page) {
      await basla(page);
      await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 1 && window.__fitil.durum().oturum === 'bekliyor', null, 20000, 'bölüm 1');
      // Kıvılcım Usta balonu yerleşsin; el ipucunu sürüklemenin ortasında dondur
      // (yolKatmani cizEl döngüsü: 450 ms giriş + düğüm başı 380 ms sürükleme).
      await bekleKosul(page, () => !!window.__fitil.cizici().yol.el, null, 15000, 'el ipucu');
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const c = window.__fitil.cizici();
        c.yol.elT = 450 + 380 * 1.6;
        c.dev.dondur(true);
      });
      await page.waitForTimeout(400);
    },
  },
  {
    ad: 'reaksiyon',
    async kur(page) {
      await page.evaluate((y) => window.__fitil.kayitYama(y), ilerlemisKayit(15));
      await basla(page);
      await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'harita');
      await page.evaluate(() => window.__fitil.bolumAc(16));
      await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 16 && window.__fitil.durum().oturum === 'bekliyor', null, 20000, 'bölüm 16');
      await page.waitForTimeout(800);
      // Büyük reaksiyon ("Muhteşem!" / "ŞENLİK!") yazısı çıkınca çizimi dondur ve
      // oyun zamanını belirlenimli 620 ms ilerlet: yazının yayı (render/yazi.ts,
      // k 300 c 14) oturmuş, solma (700 ms) başlamamış; fişekler gökte açık.
      await page.evaluate(() => {
        const c = window.__fitil.cizici();
        const asil = c.reaksiyonYazisi.bind(c);
        window.__magazaRx = null;
        c.reaksiyonYazisi = (k) => {
          asil(k);
          if (!window.__magazaRx && (k === 'muhtesem' || k === 'senlik')) {
            window.__magazaRx = k;
            c.dev.dondur(true);
            setTimeout(() => {
              c.dev.ilerle(620);
              window.__magazaDondu = true;
            }, 0);
          }
        };
      });
      for (let i = 0; i < 40; i++) {
        await page.evaluate(() => {
          void window.__fitil.botHamle('usta');
        });
        await bekleKosul(page, () => window.__magazaDondu || (window.__fitil.durum().oturum === 'bekliyor' && !window.__fitil.durum().oynuyor) || window.__fitil.ekran() !== 'oyun', null, 30000, 'hamle');
        if (await page.evaluate(() => !!window.__magazaDondu)) return;
        if ((await page.evaluate(() => window.__fitil.ekran())) !== 'oyun') break;
        await page.waitForTimeout(150);
      }
      throw new Error('büyük reaksiyon yakalanamadı');
    },
  },
  {
    ad: 'harita',
    async kur(page) {
      await page.evaluate((y) => window.__fitil.kayitYama(y), ilerlemisKayit(13, SUSLU_ISLER));
      await basla(page);
      await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'harita');
      await page.waitForTimeout(3000);
    },
  },
  {
    ad: 'kazandin',
    async kur(page, deneme) {
      // Tahta tohumu kayıttaki deneme sayısıdır (meta.siradakiDenemeNo) ve bot
      // belirlenimlidir: her denemede bölüm 9'a o kadar kazanılmamış deneme
      // yazılır; kazanç yine ilk kazançtır (ödül satırları görünür).
      const k = ilerlemisKayit(8);
      if (deneme) k.bolumler[9] = { yildiz: 0, enIyi: 0, deneme, basarisizSeri: 0, kazanc: 0 };
      await page.evaluate((y) => window.__fitil.kayitYama(y), k);
      await basla(page);
      await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'harita');
      await page.evaluate(() => window.__fitil.bolumAc(9));
      await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 9 && window.__fitil.durum().oturum === 'bekliyor', null, 20000, 'bölüm 9');
      await page.evaluate(() => window.__fitil.hizli(true));
      for (let i = 0; i < 60; i++) {
        const e = await page.evaluate(() => window.__fitil.ekran());
        if (e === 'kazandin' || e === 'kaybettin') break;
        if (e === 'oyun') await page.evaluate(() => window.__fitil.botHamle('usta'));
        else await page.waitForTimeout(150);
      }
      await bekleKosul(page, () => ['kazandin', 'kaybettin'].includes(window.__fitil.ekran()), null, 60000, 'sonuç');
      await page.waitForTimeout(600);
      // İlk kazanç (ödül satırlarıyla) ve 3★ isteniyor; Usta botu 3★'ı (Usta p85) her
      // oyunda almaz: değilse sahne temiz bağlamda yeniden kurulur (en çok `tekrar` kez).
      const etiket = await page.evaluate(() => document.querySelector('.f-kz-yildizlar')?.getAttribute('aria-label') ?? '');
      if (!etiket.startsWith('3/')) return false;
      // Yıldız, mühür ve ödül satırlarının giriş animasyonları bitsin.
      await page.waitForTimeout(4200);
      return true;
    },
    tekrar: 16,
  },
  {
    ad: 'kasaba',
    async kur(page) {
      await page.evaluate((y) => window.__fitil.kayitYama(y), ilerlemisKayit(13, SUSLU_ISLER.slice(0, 14)));
      await basla(page);
      await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'harita');
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__fitil.ac('kasaba'));
      await bekleKosul(page, () => window.__fitil.ekran() === 'kasaba' && !!document.querySelector('.f-kasaba-modal.f-giris'), null, 10000, 'Kasaba paneli');
      await page.waitForTimeout(1800);
    },
  },
];

async function basla(page) {
  await page.waitForSelector('.f-acilis.f-hazir', { timeout: 20000 });
  await page.locator('.f-acilis').dispatchEvent('pointerup');
}

/**
 * `dilSuzgeci`: 'tr' | 'en' (yoksa ikisi); `sahneSuzgeci`: sahne adları virgülle
 * (ör. "kazandin,kasaba"; yoksa hepsi). Kare numarası sahnenin sırasıdır.
 */
async function ekranGoruntuleri(url, dilSuzgeci, sahneSuzgeci) {
  if (!url) throw new Error('kullanım: node scripts/magaza-gorselleri.mjs ekran <url> [tr|en] [sahne,…]');
  const secili = sahneSuzgeci ? new Set(sahneSuzgeci.split(',')) : null;
  const tarayici = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const dil of dilSuzgeci ? [dilSuzgeci] : ['tr', 'en']) {
      for (let i = 0; i < SAHNELER.length; i++) {
        const s = SAHNELER[i];
        if (secili && !secili.has(s.ad)) continue;
        const yol = join(PLAY, `ekran-${dil}-${String(i + 1).padStart(2, '0')}.png`);
        let tamam = false;
        for (let deneme = 0; deneme <= (s.tekrar ?? 0) && !tamam; deneme++) {
          const ctx = await tarayici.newContext({
            locale: dil === 'en' ? 'en-US' : 'tr-TR',
            viewport: { width: EKRAN.w, height: EKRAN.h },
            deviceScaleFactor: EKRAN.dpr,
            isMobile: true,
            hasTouch: true,
          });
          try {
            const page = await ctx.newPage();
            const hatalar = [];
            page.on('pageerror', (e) => hatalar.push(e.message));
            page.on('console', (m) => {
              if (m.type() === 'error') hatalar.push(m.text());
            });
            const u = new URL(url);
            u.searchParams.set('gelir', 'sahte');
            u.searchParams.set('dil', dil);
            await page.goto(u.href);
            const sonuc = await s.kur(page, deneme);
            if (hatalar.length) throw new Error(`${dil}/${s.ad}: ${hatalar.join(' | ')}`);
            // `kur` false dönerse kare istenen anı yakalamadı: tekrar hakkı bittiyse son deneme yine de yazılır.
            if (sonuc === false && deneme < (s.tekrar ?? 0)) continue;
            mkdirSync(PLAY, { recursive: true });
            await page.screenshot({ path: yol });
            const b = pngBilgi(yol);
            if (b.w !== EKRAN.w * EKRAN.dpr || b.h !== EKRAN.h * EKRAN.dpr || b.renkTuru !== 2) throw new Error(`${yol}: ${b.w}×${b.h}, renk türü ${b.renkTuru}`);
            console.log(`${goreli(yol)} (${s.ad}${deneme ? `, ${deneme + 1}. deneme` : ''}${sonuc === false ? ', istenen an yakalanamadı' : ''})`);
            tamam = true;
          } finally {
            await ctx.close();
          }
        }
      }
    }
  } finally {
    await tarayici.close();
  }
}

// ─────────────────────────── Ana akış ───────────────────────────

const [komut = 'varsayilan', arg, arg2, arg3] = process.argv.slice(2);
if (komut === 'ekran') {
  await ekranGoruntuleri(arg, arg2, arg3);
  process.exit(0);
}
if (!['varsayilan', 'simge', 'play', 'onizleme'].includes(komut)) {
  console.error('kullanım: node scripts/magaza-gorselleri.mjs [simge|play|ekran <url> [tr|en] [sahne,…]|onizleme <klasör>]');
  process.exit(1);
}
const c = new Cizer();
await c.ac();
try {
  const cikti = [];
  if (komut === 'varsayilan' || komut === 'simge') cikti.push(...(await simgeler(c)));
  if (komut === 'varsayilan' || komut === 'play') cikti.push(...(await playGorselleri(c)));
  if (komut === 'onizleme') cikti.push(...(await onizleme(c, resolve(arg || 'magaza-onizleme'))));
  for (const s of cikti) console.log(s.startsWith(KOK) ? goreli(s) : s);
} finally {
  await c.kapat();
}
