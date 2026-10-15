/**
 * Bot simülasyon aracı (GDD §14.5 CLI). tsx ile Node'da çalışır:
 *
 *   npm run bot -- --bolum 5 --tohum 200 --bot usta     tek oyun dökümü
 *   npm run bot -- --dagilim --bolum 1-10 --tohum 100    Usta + Acemi kazanma, yıldız dağılımı, puan yüzdelikleri
 *   npm run dogrula                                       statik + bot bantları (Usta 100, Acemi 120 tohum)
 *   npm run dogrula -- --bolum 4-10 --tohum 30            seçili bölümler, 30 tohum
 *   npm run kalibre -- --bolum 6                          yıldız eşikleri (K13; 500 + 500 tohum), JSON'a yazar
 *   npm run kalibre -- --bolum 6 --yazma                  yazmadan göster
 *   npm run bot -- --olcum                                hamleUygula / onizle süreleri (7×9)
 *
 * Seçenekler:
 *   --bolum N        Bölüm id. Virgülle ya da aralıkla: 1-10,12
 *   --dosya YOL      Diskteki bölüm JSON'u ya da klasörü (varyant denemesi; virgülle birden çok)
 *   --tohum K        Tek oyunda tohum (deneme no); diğer kiplerde Usta tohum SAYISI
 *   --acemi-tohum K  Acemi tohum sayısı (varsayılan: dogrula 120, dagilim/kalibre --tohum)
 *   --bas S          İlk tohum (varsayılan 0)
 *   --bot usta|acemi Tek oyunda bot (varsayılan usta)
 *   --isci N         İşçi sayısı (varsayılan min(2, çekirdek − 1); en fazla 2 önerilir)
 *   --taslaklar      Taslak bölümleri de bantla denetle (hataları başarısızlık sayılmaz)
 *   --json DOSYA     Ölçümleri JSON olarak yaz
 *   --yazma          --kalibre'de JSON'a yazma
 *
 * K13 (§14.4): 2★ = min(Usta p50, Acemi kazanç p50), 3★ = Usta p85 (kazanılan
 * oyunların şölen dahil puanı, aşağı 100'e). `elleEsik: true` bölümlerde
 * (öğretim) kalibre YAZMAZ; öneri (2★ ≈ Acemi kazanç p40, 3★ ≈ Usta p50)
 * gösterilir.
 *
 * Paralellik worker_threads ile; işçi bu dosyanın kendisidir (tsx ESM API'si
 * işçide kaydedilip `import.meta.url` içe aktarılır; Windows yollarında da
 * çalışır). Çıkış kodu: --dogrula'da hata varsa 1.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { bolumuYukle, hamleUygula, ilerlemeYuzdesi, onizle, gecerliHamleler, olumluHamleler, rngInt } from '../core/index';
import type { BolumVerisi, Hamle, Olay } from '../core/index';
import { BOLUMLER, bolumBul } from '../levels/index';
import { bolumDogrula } from '../levels/dogrulayici';
import { olcumHesapla, olcutHatalari, yildizEsikleriK13, yildizEsikleriOgretim, type BolumOlcumu } from './olcut';
import type { BotTuru } from './ortak';
import { oyunOyna, type OyunSonucu } from './simulasyon';

interface Gorev {
  no: number;
  bolum: BolumVerisi;
  bot: BotTuru;
  tohumlar: number[];
}

interface Cevap {
  no: number;
  sonuclar: OyunSonucu[];
}

// ─── İşçi ───────────────────────────────────────────────────────────────
function isciCalis(): void {
  parentPort!.on('message', (g: Gorev | null) => {
    if (!g) process.exit(0);
    const sonuclar = g.tohumlar.map((t) => oyunOyna(g.bolum, t, g.bot));
    parentPort!.postMessage({ no: g.no, sonuclar } satisfies Cevap);
  });
}

// ─── Argümanlar ─────────────────────────────────────────────────────────
interface Argumanlar {
  kip: 'tek' | 'dogrula' | 'kalibre' | 'dagilim' | 'olcum';
  bolumler: number[] | null;
  dosyalar: string[];
  tohum: number | null;
  acemiTohum: number | null;
  bas: number;
  bot: BotTuru;
  isci: number;
  taslaklar: boolean;
  json: string | null;
  yazma: boolean;
}

function argumanlar(argv: string[]): Argumanlar {
  const a: Argumanlar = {
    kip: 'tek',
    bolumler: null,
    dosyalar: [],
    tohum: null,
    acemiTohum: null,
    bas: 0,
    bot: 'usta',
    isci: Math.max(1, Math.min(2, availableParallelism() - 1)),
    taslaklar: false,
    json: null,
    yazma: true,
  };
  for (let k = 0; k < argv.length; k++) {
    const s = argv[k];
    const deger = (): string => {
      const v = argv[++k];
      if (v === undefined) throw new Error(`${s} bir değer ister`);
      return v;
    };
    switch (s) {
      case '--dogrula':
      case '--kalibre':
      case '--dagilim':
      case '--olcum':
        a.kip = s.slice(2) as Argumanlar['kip'];
        break;
      case '--bolum':
        a.bolumler = aralik(deger());
        break;
      case '--dosya':
        a.dosyalar.push(...deger().split(','));
        break;
      case '--tohum':
        a.tohum = Number(deger());
        break;
      case '--acemi-tohum':
        a.acemiTohum = Number(deger());
        break;
      case '--bas':
        a.bas = Number(deger());
        break;
      case '--bot': {
        const b = deger();
        if (b !== 'usta' && b !== 'acemi') throw new Error('--bot usta|acemi');
        a.bot = b;
        break;
      }
      case '--isci':
        a.isci = Math.max(1, Number(deger()));
        break;
      case '--taslaklar':
        a.taslaklar = true;
        break;
      case '--json':
        a.json = deger();
        break;
      case '--yazma':
        a.yazma = false;
        break;
      case '--yardim':
      case '-h':
        console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
        process.exit(0);
        break;
      default:
        throw new Error(`bilinmeyen seçenek: ${s}`);
    }
  }
  return a;
}

/** "1-10,12" → [1..10, 12]. */
function aralik(s: string): number[] {
  const l: number[] = [];
  for (const p of s.split(',')) {
    const m = /^(\d+)-(\d+)$/.exec(p.trim());
    if (m) for (let i = Number(m[1]); i <= Number(m[2]); i++) l.push(i);
    else l.push(Number(p));
  }
  return l;
}

function hata(s: string): never {
  throw new Error(s);
}

// ─── İşçi havuzu ────────────────────────────────────────────────────────
function isciBaslat(): Worker {
  const api = import.meta.resolve('tsx/esm/api');
  const kod = `import(${JSON.stringify(api)}).then((m) => { m.register(); return import(${JSON.stringify(import.meta.url)}); });`;
  return new Worker(kod, { eval: true, workerData: { isci: true } });
}

async function havuz(gorevler: Gorev[], isciSayisi: number): Promise<Map<number, OyunSonucu[]>> {
  const sonuc = new Map<number, OyunSonucu[]>();
  if (gorevler.length === 0) return sonuc;
  if (isciSayisi <= 1) {
    for (const g of gorevler) {
      sonuc.set(g.no, g.tohumlar.map((t) => oyunOyna(g.bolum, t, g.bot)));
      ilerlemeYaz(sonuc.size, gorevler.length);
    }
    return sonuc;
  }
  const n = Math.min(isciSayisi, gorevler.length);
  let sira = 0;
  await new Promise<void>((coz, reddet) => {
    let kapanan = 0;
    for (let k = 0; k < n; k++) {
      const w = isciBaslat();
      const ver = (): void => {
        if (sira < gorevler.length) w.postMessage(gorevler[sira++]);
        else w.postMessage(null);
      };
      w.on('message', (c: Cevap) => {
        sonuc.set(c.no, c.sonuclar);
        ilerlemeYaz(sonuc.size, gorevler.length);
        ver();
      });
      w.on('error', reddet);
      w.on('exit', () => {
        if (++kapanan === n) coz();
      });
      ver();
    }
  });
  return sonuc;
}

function ilerlemeYaz(bitti: number, toplam: number): void {
  if (process.stderr.isTTY) process.stderr.write(`\r  ${bitti}/${toplam} görev`);
}

// ─── Bölüm seçimi ───────────────────────────────────────────────────────
const dosyaYolu = new Map<BolumVerisi, string>();

function seciliBolumler(a: Argumanlar): BolumVerisi[] {
  const l: BolumVerisi[] = [];
  for (const id of a.bolumler ?? []) l.push(bolumBul(id) ?? hata(`bölüm yok: ${id}`));
  for (const d of a.dosyalar) {
    const yollar = statSync(d).isDirectory() ? readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => join(d, f)) : [d];
    for (const y of yollar) {
      const v = JSON.parse(readFileSync(y, 'utf8')) as BolumVerisi;
      dosyaYolu.set(v, y);
      l.push(v);
    }
  }
  return l.length ? l : [...BOLUMLER];
}

function gorevleriKur(bolumler: BolumVerisi[], bot: BotTuru, bas: number, sayi: number, no0: number): Gorev[] {
  const g: Gorev[] = [];
  let no = no0;
  for (const v of bolumler)
    for (let t = bas; t < bas + sayi; t += 5) {
      const tohumlar: number[] = [];
      for (let k = t; k < Math.min(bas + sayi, t + 5); k++) tohumlar.push(k);
      g.push({ no: no++, bolum: v, bot, tohumlar });
    }
  return g;
}

async function olc(a: Argumanlar, bolumler: BolumVerisi[], ustaSayi: number, acemiSayi: number): Promise<Map<BolumVerisi, { usta: OyunSonucu[]; acemi: OyunSonucu[] }>> {
  const gu = gorevleriKur(bolumler, 'usta', a.bas, ustaSayi, 0);
  const ga = gorevleriKur(bolumler, 'acemi', a.bas, acemiSayi, gu.length);
  const tum = [...gu, ...ga];
  const c = await havuz(tum, a.isci);
  if (process.stderr.isTTY) process.stderr.write('\n');
  const m = new Map<BolumVerisi, { usta: OyunSonucu[]; acemi: OyunSonucu[] }>();
  for (const v of bolumler) m.set(v, { usta: [], acemi: [] });
  for (const g of tum) m.get(g.bolum)![g.bot].push(...(c.get(g.no) ?? []));
  return m;
}

// ─── Tablolar ───────────────────────────────────────────────────────────
const yz = (x: number | null): string => (x === null ? '   -' : `${x.toFixed(0).padStart(3)}%`);
const ad = (v: BolumVerisi): string => `${dosyaYolu.has(v) ? basename(dosyaYolu.get(v)!) : v.id}${v.taslak ? '*' : ''}`;

function dogrulaBaslik(): string {
  return ['Bölüm'.padEnd(6), 'Tür'.padEnd(10), 'Usta'.padStart(5), 'Bant'.padEnd(8), 'Acemi'.padStart(5), 'Alt'.padStart(4), 'Yakın', '≥2hz', '0hz ', 'AcEş', 'Tarak', 'Kskt', 'Süre', 'Puan p50/p85'].join(' ');
}

function dogrulaSatiri(v: BolumVerisi, o: BolumOlcumu): string {
  return [
    ad(v).padEnd(6),
    v.tur.padEnd(10),
    yz(o.ustaKazanma).padStart(5),
    `${v.botBandi[0]}–${v.botBandi[1]}`.padEnd(8),
    yz(o.acemiKazanma).padStart(5),
    String(v.acemiAlt).padStart(4),
    yz(o.yakinKacis).padStart(5),
    yz(o.hazir2),
    `${o.hazir0.toFixed(1)}%`.padStart(4),
    yz(o.acemiEslesme),
    o.tarakHamle.toFixed(2).padStart(5),
    String(o.kaskatMedyan).padStart(4),
    `${o.sureSn.toFixed(0)}s`.padStart(4),
    `${o.ustaP50}/${o.ustaP85}`,
  ].join(' ');
}

async function dogrula(a: Argumanlar): Promise<number> {
  const t0 = Date.now();
  const secili = seciliBolumler(a);
  let basarisiz = 0;
  for (const v of secili) {
    const uy: string[] = [];
    const h = bolumDogrula(v, uy);
    for (const u of uy) console.log(`  bölüm ${ad(v)} (uyarı): ${u}`);
    if (h.length) {
      if (!v.taslak) basarisiz++;
      console.log(`✗ bölüm ${ad(v)} statik${v.taslak ? ' (taslak)' : ''}:\n    ${h.join('\n    ')}`);
    }
  }
  const bantli = secili.filter((v) => a.taslaklar || !v.taslak);
  const sonuc = await olc(a, bantli, a.tohum ?? 100, a.acemiTohum ?? 120);
  console.log(dogrulaBaslik());
  const json: unknown[] = [];
  for (const v of bantli) {
    const { usta, acemi } = sonuc.get(v)!;
    const o = olcumHesapla(v, usta, acemi);
    const uy: string[] = [];
    const h = olcutHatalari(v, o, uy);
    console.log(dogrulaSatiri(v, o));
    for (const x of h) console.log(`    ✗ ${x}`);
    for (const x of uy) console.log(`    · ${x}`);
    if (h.length && !v.taslak) basarisiz++;
    json.push({ ...o, hatalar: h, uyarilar: uy });
  }
  if (a.json) writeFileSync(a.json, JSON.stringify(json, null, 2));
  console.log(`\n${secili.length} bölüm, ${basarisiz} başarısız, ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
  return basarisiz ? 1 : 0;
}

async function dagilim(a: Argumanlar): Promise<number> {
  const secili = seciliBolumler(a);
  const sonuc = await olc(a, secili, a.tohum ?? 100, a.acemiTohum ?? a.tohum ?? 100);
  console.log(['Bölüm'.padEnd(6), 'Tür'.padEnd(10), 'Usta'.padStart(5), 'Acemi'.padStart(5), 'Usta ★0/1/2/3'.padEnd(18), 'Acemi ★0/1/2/3'.padEnd(18), 'Usta p15/50/85'.padEnd(18), 'Acemi p40/50/85'.padEnd(18), 'Eşik', 'K13 önerisi'].join(' '));
  const json: unknown[] = [];
  for (const v of secili) {
    const { usta, acemi } = sonuc.get(v)!;
    const o = olcumHesapla(v, usta, acemi);
    const yd = (y: number[]): string => y.map((x) => x.toFixed(0)).join('/');
    const oneri = v.elleEsik ? yildizEsikleriOgretim(o) : yildizEsikleriK13(o);
    console.log(
      [
        ad(v).padEnd(6),
        v.tur.padEnd(10),
        yz(o.ustaKazanma).padStart(5),
        yz(o.acemiKazanma).padStart(5),
        yd(o.ustaYildiz).padEnd(18),
        yd(o.acemiYildiz).padEnd(18),
        `${o.ustaP15}/${o.ustaP50}/${o.ustaP85}`.padEnd(18),
        `${o.acemiP40}/${o.acemiP50}/${o.acemiP85}`.padEnd(18),
        `${v.yildizEsikleri[0]}/${v.yildizEsikleri[1]}`,
        `${oneri[0]}/${oneri[1]}${v.elleEsik ? ' (elle: öneri)' : ''}`,
      ].join(' '),
    );
    json.push(o);
  }
  if (a.json) writeFileSync(a.json, JSON.stringify(json, null, 2));
  return 0;
}

/** Bölüm dosyası yolu (src/levels/veri/bNNN.json ya da --dosya). */
function bolumDosyasi(v: BolumVerisi): string {
  if (dosyaYolu.has(v)) return dosyaYolu.get(v)!;
  const kok = join(dirname(fileURLToPath(import.meta.url)), '..', 'levels', 'veri');
  return join(kok, `b${String(v.id).padStart(3, '0')}.json`);
}

async function kalibre(a: Argumanlar): Promise<number> {
  const secili = seciliBolumler(a);
  const sayi = a.tohum ?? 500;
  const sonuc = await olc(a, secili, sayi, a.acemiTohum ?? sayi);
  for (const v of secili) {
    const { usta, acemi } = sonuc.get(v)!;
    const o = olcumHesapla(v, usta, acemi);
    const k13 = yildizEsikleriK13(o);
    if (v.elleEsik) {
      const og = yildizEsikleriOgretim(o);
      console.log(`bölüm ${ad(v)}: elle eşik [${v.yildizEsikleri}] korunur; öneri ${JSON.stringify(og)} (Acemi p40 / Usta p50), K13 ${JSON.stringify(k13)}`);
      continue;
    }
    console.log(`bölüm ${ad(v)}: Usta %${o.ustaKazanma.toFixed(0)}, Acemi %${(o.acemiKazanma ?? 0).toFixed(0)}; yıldız [${v.yildizEsikleri}] → ${JSON.stringify(k13)}`);
    if (!a.yazma) continue;
    const yol = bolumDosyasi(v);
    const metin = readFileSync(yol, 'utf8');
    const yeni = metin.replace(/"yildizEsikleri":\s*\[[^\]]*\]/, `"yildizEsikleri": [${k13[0]}, ${k13[1]}]`);
    if (yeni === metin && !metin.includes(`"yildizEsikleri": [${k13[0]}, ${k13[1]}]`)) throw new Error(`${yol}: yildizEsikleri bulunamadı`);
    writeFileSync(yol, yeni);
  }
  return 0;
}

// ─── Tek oyun ──────────────────────────────────────────────────────────
function hamleMetni(h: Hamle): string {
  return `(${h.kaynak.x},${h.kaynak.y})→(${h.hedef.x},${h.hedef.y})`;
}

function tek(a: Argumanlar): number {
  const [v] = seciliBolumler({ ...a, bolumler: a.bolumler ?? [1] });
  const tohum = a.tohum ?? 0;
  console.log(`bölüm ${ad(v)} «${v.ad}» ${v.w}×${v.h}, ${v.hamle} hamle, tohum ${tohum}, bot ${a.bot}`);
  const r = oyunOyna(v, tohum, a.bot, {
    kayit: ({ hamle, olaylar, sonraki }) => {
      const oz = olaylar[olaylar.length - 1] as Extract<Olay, { tur: 'hamleOzeti' }>;
      const ozel = olaylar.filter((o) => o.tur === 'ozelOlustu').map((o) => (o as Extract<Olay, { tur: 'ozelOlustu' }>).damla.ozel);
      const hedef = sonraki.hedefler.map((h) => `${h.ilerleme}/${h.gerekli}`).join(' ');
      console.log(
        `  ${String(sonraki.hamleNo).padStart(2)}. ${hamleMetni(hamle).padEnd(14)} temiz ${String(oz.temizlenen).padStart(2)} kaskat ${oz.kaskat}${ozel.length ? ` özel ${ozel.join(',')}` : ''}  puan ${sonraki.puan}  hedef ${hedef}`,
      );
    },
  });
  console.log(`${r.kazandi ? 'KAZANDI' : 'kaybetti'}: ${r.hamle} hamle, puan ${r.puan} (şölen öncesi ${r.puanSolenOncesi}), ${r.yildiz}★, ilerleme %${(r.ilerleme * 100).toFixed(0)}`);
  return 0;
}

// ─── Süre ölçümü ───────────────────────────────────────────────────────
function olcum(): number {
  const v: BolumVerisi = { ...(bolumBul(1) as BolumVerisi), id: 900, w: 7, h: 9, tohum: 5, dogum: [20, 20, 20, 11, 11, 11], garanti: 2, hamle: 60, duzen: Array(9).fill('. . . . . . .'), zorunluIlkHamle: undefined, hedefler: [{ tur: 'puan', puan: 1e9 }] };
  const hs: number[] = [];
  const os: number[] = [];
  const ol: number[] = [];
  for (let oyun = 0; oyun < 10; oyun++) {
    let d = bolumuYukle(v, oyun);
    const r = { rng: oyun + 1 };
    for (let k = 0; k < 40 && !d.bitti; k++) {
      const l = gecerliHamleler(d);
      for (const h of l.slice(0, 20)) {
        const t0 = performance.now();
        onizle(d, h);
        os.push(performance.now() - t0);
      }
      let t0 = performance.now();
      const hz = olumluHamleler(d);
      ol.push(performance.now() - t0);
      const h = hz.length && rngInt(r, 4) ? hz[rngInt(r, hz.length)].hamle : l[rngInt(r, l.length)];
      t0 = performance.now();
      d = hamleUygula(d, h).durum;
      hs.push(performance.now() - t0);
    }
  }
  const p = (l: number[], q: number): string => {
    const s = l.slice().sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor((q / 100) * s.length))].toFixed(3);
  };
  console.log(`hamleUygula (garanti 2): ortanca ${p(hs, 50)} ms, p99 ${p(hs, 99)} ms (n=${hs.length})`);
  console.log(`onizle: ortanca ${p(os, 50)} ms, p99 ${p(os, 99)} ms (n=${os.length})`);
  console.log(`olumluHamleler: ortanca ${p(ol, 50)} ms, p99 ${p(ol, 99)} ms`);
  console.log(`ilerleme örneği: ${ilerlemeYuzdesi(bolumuYukle(v, 0))}`);
  return 0;
}

// ─── Giriş ─────────────────────────────────────────────────────────────
if (!isMainThread && (workerData as { isci?: boolean } | null)?.isci) {
  isciCalis();
} else if (isMainThread) {
  const a = argumanlar(process.argv.slice(2));
  const calis = async (): Promise<number> => {
    switch (a.kip) {
      case 'dogrula':
        return dogrula(a);
      case 'kalibre':
        return kalibre(a);
      case 'dagilim':
        return dagilim(a);
      case 'olcum':
        return olcum();
      default:
        return tek(a);
    }
  };
  calis().then(
    (kod) => process.exit(kod),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(2);
    },
  );
}
