/**
 * Kasaba İşleri yerleşim denetimi (dev sunucusu açıkken):
 *   node scripts/kasaba-yerlesim.mjs [taban-url] [çıktı-klasörü] [genişlik] [yükseklik]
 * Varsayılan http://localhost:5173, kasaba-yerlesim/, 390×844 (telefon: düğüm
 * ve etiketler haritaya göre en büyük burada).
 *
 * Her işin "dolu" kutusunu (hale/ışık havuzu gibi yumuşak parlamalar hariç)
 * ölçer ve şunlarla çakışmasını raporlar:
 *  - düğüm: bölüm düğmesi + altındaki yıldızlar (+6 birim pay),
 *  - etiket: mahalle şeridi (İSKELE 12/15),
 *  - usta: Usta deniz feneri rozeti; tabela: alt paydaki FENER KOYU,
 *  - yol: dolu parçaların altında kalan fitil yolu (ip×yol: yolu kesen
 *    ip noktaları, yalnız bilgi).
 * Çıktı: m<n>.png ve kiyi.png (alt pay) (mahalle, kırmızı = yasak bölgeler, mavi = iş kutuları),
 * rapor.json ve ekrana özet. Çakışma varsa çıkış kodu 1.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const [taban = 'http://localhost:5173', cikti = 'kasaba-yerlesim', w = '390', h = '844'] = process.argv.slice(2);
mkdirSync(cikti, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ locale: 'tr-TR', viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: +w < 700, hasTouch: true });
const hatalar = [];
page.on('pageerror', (e) => hatalar.push(e.message));
// simdiki=41: bütün düğümler açık (yıldızlı); "buradasın" işareti yok.
await page.goto(`${taban}/dev/kasaba.html?temiz=1&isler=tam&az=1&simdiki=41`);
await page.waitForTimeout(3500);

const rapor = await page.evaluate(async () => {
  const S = await import('/src/ui/harita/susler.ts');
  const C = await import('/src/ui/harita/cizim.ts');
  const K = await import('/src/app/katalog.ts');
  const ic = document.querySelector('.f-harita-icerik');
  const ir = ic.getBoundingClientRect();
  const olcek = C.HARITA_W / ir.width;
  const birim = (r) => ({ x0: (r.left - ir.left) * olcek, y0: (r.top - ir.top) * olcek, x1: (r.right - ir.left) * olcek, y1: (r.bottom - ir.top) * olcek });
  const pay = (k, p) => ({ ...k, x0: k.x0 - p, y0: k.y0 - p, x1: k.x1 + p, y1: k.y1 + p });

  // Yasak bölgeler (DOM'dan, bu ekran boyunda).
  const yasak = [];
  for (const d of document.querySelectorAll('.f-dugum')) {
    let k = birim(d.getBoundingClientRect());
    const y = d.querySelector('.f-dugum-yildiz');
    if (y) {
      const yk = birim(y.getBoundingClientRect());
      k = { x0: Math.min(k.x0, yk.x0), y0: k.y0, x1: Math.max(k.x1, yk.x1), y1: Math.max(k.y1, yk.y1) };
    }
    yasak.push({ tur: 'düğüm', ad: d.getAttribute('aria-label')?.split(',')[0] ?? '', ...pay(k, 6) });
  }
  for (const e of document.querySelectorAll('.f-mahalle-serit')) yasak.push({ tur: 'etiket', ad: e.querySelector('.f-mahalle-ad')?.textContent ?? '', ...pay(birim(e.getBoundingClientRect()), 4) });
  for (const e of document.querySelectorAll('.f-harita-tabela')) yasak.push({ tur: 'tabela', ad: 'Fener Koyu', ...pay(birim(e.getBoundingClientRect()), 4) });
  for (const e of document.querySelectorAll('.f-usta-dugum')) yasak.push({ tur: 'usta', ad: e.querySelector('.f-usta-etiket span')?.textContent ?? '', ...pay(birim(e.getBoundingClientRect()), 4) });

  // Fitil yolu: kübik parçalardan örnekler.
  const yol = [];
  for (const p of C.yolParcalari()) {
    const n = p.d.match(/-?\d+(\.\d+)?/g).map(Number);
    const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const u = 1 - t;
      yol.push({ x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3 });
    }
  }

  // Ölçüm için gizli SVG (haritanın tanımlarıyla).
  const NS = 'http://www.w3.org/2000/svg';
  const olc = document.createElementNS(NS, 'svg');
  olc.setAttribute('style', 'position:absolute;left:0;top:0;width:400px;height:5940px;visibility:hidden');
  document.body.appendChild(olc);
  const YUMUSAK = /url\(#(ftl-|hs-parla|hs-kirmizi|hs-yesil|hs-su|hs-koni|hs-huzme|hs-mazgal)/;
  // İşin parçaları: dolu şekiller kutusuyla, yalnız çizgi olanlar (ip, sap)
  // üstlerinden örneklenen noktalarla (çapraz bir ipin kutusu yanıltır).
  const parcalarOlc = (svgMetni, ust) => {
    olc.setAttribute('viewBox', `0 ${ust} 400 ${C.BOLGE_H}`);
    olc.innerHTML = C.haritaTanimlari() + `<g>${svgMetni}</g>`;
    const kok = olc.getScreenCTM().inverse();
    const parcalar = [];
    for (const el of olc.querySelectorAll('g > path, g > circle, g > ellipse, g > rect, g > polygon, g > polyline, g > line, g > text')) {
      if (el.closest('defs')) continue;
      const fill = el.getAttribute('fill') ?? '';
      const op = Number(el.getAttribute('opacity') ?? 1);
      if (YUMUSAK.test(fill) || op < 0.3) continue;
      const cizgi = fill === 'none' || ((el.tagName === 'line' || el.tagName === 'polyline') && !fill);
      if (cizgi && !el.getAttribute('stroke')) continue;
      const m = kok.multiply(el.getScreenCTM());
      const donustur = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
      if (cizgi && typeof el.getTotalLength === 'function') {
        const L = el.getTotalLength();
        const sw = Number(el.getAttribute('stroke-width') ?? 1) / 2 + 0.5;
        for (let t = 0; t <= L; t += 3) {
          const q = el.getPointAtLength(t);
          const p = donustur(q.x, q.y);
          parcalar.push({ x0: p.x - sw, y0: p.y - sw, x1: p.x + sw, y1: p.y + sw, cizgi: true });
        }
        continue;
      }
      let b;
      try { b = el.getBBox(); } catch { continue; }
      if (b.width === 0 && b.height === 0) continue;
      const ks = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => donustur(x, y));
      parcalar.push({ x0: Math.min(...ks.map((p) => p.x)), y0: Math.min(...ks.map((p) => p.y)), x1: Math.max(...ks.map((p) => p.x)), y1: Math.max(...ks.map((p) => p.y)), cizgi: false });
    }
    return parcalar;
  };
  const kesisim = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const icinde = (p, k) => p.x > k.x0 && p.x < k.x1 && p.y > k.y0 && p.y < k.y1;

  const isler = [];
  for (let m = 0; m < 8; m++) {
    const g = C.bolgeGeo(m);
    for (const is of K.KASABA_ISLERI.filter((x) => x.mahalle === m)) {
      const s = S.mahalleSusleri(g, { yapilan: new Set([is.id]), hayalet: false, yeni: new Set() });
      let metin = '';
      for (const kt of ['arka', 4, 3, 2, 1, 0, 'on', 'kiyi']) metin += s.katman(kt);
      // Canlı öğeler kendi kutularında (x, y, w, h) çizilir.
      for (const o of s.canli) metin += `<svg x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" viewBox="0 0 ${o.w} ${o.h}" overflow="visible"><g>${o.ic}</g></svg>`;
      const parcalar = parcalarOlc(metin, g.ust);
      if (!parcalar.length) continue;
      const kutu = parcalar.reduce((k, p) => ({ x0: Math.min(k.x0, p.x0), y0: Math.min(k.y0, p.y0), x1: Math.max(k.x1, p.x1), y1: Math.max(k.y1, p.y1) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
      const cakisma = [];
      for (const z of yasak) {
        // Parçaların bölgeyle kesişimi (üst üste binen parçalar iki kez sayılabilir: yaklaşık).
        const a = parcalar.reduce((t, p) => t + kesisim(p, z), 0);
        if (a >= 6) cakisma.push({ tur: z.tur, ad: z.ad, alan: Math.round(a) });
      }
      // Yolun üstüne oturan dolu parçalar (yol örnekleri) ve yolu kesen ipler (bilgi).
      const dolu = parcalar.filter((p) => !p.cizgi);
      const yolda = yol.filter((p) => dolu.some((k) => icinde(p, k))).length;
      const ipYol = parcalar.filter((p) => p.cizgi && yol.some((q) => Math.abs(q.x - (p.x0 + p.x1) / 2) < 3 && Math.abs(q.y - (p.y0 + p.y1) / 2) < 3)).length;
      if (yolda >= 2) cakisma.push({ tur: 'yol', ad: '', alan: yolda });
      const yuvarla = (k) => ({ x0: Math.round(k.x0), y0: Math.round(k.y0), x1: Math.round(k.x1), y1: Math.round(k.y1) });
      isler.push({ id: is.id, m, tur: is.cizim, kutu: yuvarla(kutu), dolu: dolu.map(yuvarla), cakisma, ipYol });
    }
  }
  olc.remove();

  // Kaplama: yasak bölgeler + iş kutuları.
  const kap = document.createElementNS(NS, 'svg');
  kap.setAttribute('viewBox', `0 0 400 ${C.HARITA_H}`);
  kap.setAttribute('preserveAspectRatio', 'none');
  kap.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50');
  let s = '';
  for (const z of yasak) s += `<rect x="${z.x0}" y="${z.y0}" width="${z.x1 - z.x0}" height="${z.y1 - z.y0}" fill="rgba(255,0,0,.18)" stroke="#f33" stroke-width="1"/>`;
  for (const i of isler) {
    const k = i.kutu;
    const renk = i.cakisma.length ? '#ff3' : '#3cf';
    for (const d of i.dolu) s += `<rect x="${d.x0}" y="${d.y0}" width="${d.x1 - d.x0}" height="${d.y1 - d.y0}" fill="none" stroke="${renk}" stroke-width=".5" opacity=".7"/>`;
    s += `<rect x="${k.x0}" y="${k.y0}" width="${k.x1 - k.x0}" height="${k.y1 - k.y0}" fill="none" stroke="${renk}" stroke-width="1" stroke-dasharray="4 3"/><text x="${k.x0 + 2}" y="${k.y0 + 9}" font-size="8" fill="${renk}" stroke="#000" stroke-width="2" paint-order="stroke" font-family="sans-serif">${i.id.split('.')[1]}</text>`;
  }
  kap.innerHTML = s;
  ic.appendChild(kap);
  return { isler, yasak: yasak.length };
});

for (let m = 0; m < 8; m++) {
  await page.evaluate((m) => window.__kasaba.kaydir(m), m);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${cikti}/m${m}.png` });
}
// İskele'nin kıyısı (alt pay): haritanın en altı.
await page.evaluate(() => {
  const k = document.querySelector('.f-harita-kaydir');
  k.scrollTop = k.scrollHeight;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${cikti}/kiyi.png` });
writeFileSync(`${cikti}/rapor.json`, JSON.stringify(rapor, null, 1));
await browser.close();

let sorun = 0;
for (const i of rapor.isler) {
  const c = i.cakisma.map((x) => `${x.tur}${x.ad ? ` (${x.ad})` : ''} ${x.alan}`).join(', ');
  if (i.cakisma.length) sorun++;
  console.log(`${i.cakisma.length ? '✗' : '✓'} ${i.id.padEnd(30)} ${i.tur.padEnd(12)} ip×yol:${String(i.ipYol).padStart(3)}  ${c}`);
}
for (const e of hatalar) console.log('[pageerror]', e);
console.log(`\n${rapor.isler.length} iş, ${sorun} çakışmalı. Görseller: ${cikti}/m0..7.png`);
process.exit(sorun ? 1 : 0);
