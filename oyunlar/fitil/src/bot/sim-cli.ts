/**
 * Bot simülasyon aracı (GDD §16.5 CLI). tsx ile Node'da çalışır:
 *
 *   npm run bot -- --bolum 12 --tohum 200 --bot usta     tek oyun dökümü
 *   npm run dogrula                                       bütün bölümler, 100 tohum
 *   npm run dogrula -- --bolum 7 --tohum 30               bir bölüm, 30 tohum
 *   npm run kalibre                                       500 tohum, yildizEsikleri yazar
 *   npm run kalibre -- --bolum 7 --yazma                  yazmadan göster
 *   npm run bot -- --dagilim --bolum 1-12 --tohum 100 --acemi-tohum 60
 *                                                         Usta + Acemi kazanma ve yıldız dağılımı
 *
 * Seçenekler:
 *   --bolum N      Bölüm id (1..40, 101..108). Virgülle ya da aralıkla: 1-10,12
 *   --dosya YOL    Diskteki bölüm JSON'u ya da klasörü (varyant denemesi; virgülle birden çok)
 *   --tohum K      Tek oyunda tohum; --dogrula/--kalibre'de tohum SAYISI
 *   --bas S        İlk tohum (varsayılan 0)
 *   --bot usta|acemi
 *   --isci N       İşçi sayısı (varsayılan min(3, çekirdek − 1))
 *   --taslaklar    Taslak bölümleri de simüle et (hataları başarısızlık sayılmaz)
 *   --acemi        Acemi botu her bölümde ölç (öğretim ve tanıtımda varsayılan açık)
 *   --acemi-tohum K  --dagilim'de Acemi tohum sayısı (varsayılan --tohum)
 *   --json DOSYA   Ölçümleri JSON olarak yaz
 *   --yazma        --kalibre'de JSON'a yazma
 *
 * `elleEsik: true` taşıyan bölümlerin (öğretim, GDD K22) yıldız eşiklerini
 * kalibre YAZMAZ, yalnız Usta önerisini gösterir; bu eşikler `--dagilim`
 * çıktısındaki Acemi/Usta yüzdeliklerinden elle seçilir.
 *
 * Paralellik worker_threads ile; işçi bu dosyanın kendisidir (tsx API'siyle
 * `import.meta.url` içe aktarılır), yol ayırıcısından bağımsız.
 * Çıkış kodu: --dogrula'da ölçüt hatası varsa 1.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { bolumuYukle, ilerlemeYuzdesi } from '../core/index';
import type { BolumVerisi, Hamle } from '../core/index';
import { TUM_BOLUMLER, bolumGetir } from '../levels/index';
import { bolumDogrula } from '../levels/dogrulayici';
import { olcumHesapla, olcutHatalari, yildizEsikleriHesapla, yildizEsikleriOgretim, yuzdelik, type BolumOlcumu } from './olcut';
import type { BotTuru } from './ortak';
import { oyunOyna, type OyunSonucu } from './simulasyon';

interface Gorev {
  no: number;
  bolumId: number;
  /** Bölüm verisi (işçi dosyadan okunan varyantları da oynatabilsin). */
  bolum: BolumVerisi;
  bot: BotTuru;
  hamleEk: number;
  tohumlar: number[];
}

interface Cevap {
  no: number;
  sonuclar: OyunSonucu[];
}

// ─── İşçi ───────────────────────────────────────────────────────────────
function isciCalis(): void {
  parentPort!.on('message', (g: Gorev | null) => {
    if (!g) {
      process.exit(0);
    }
    const sonuclar = g.tohumlar.map((t) => oyunOyna(g.bolum, t, g.bot, { hamleEk: g.hamleEk }));
    parentPort!.postMessage({ no: g.no, sonuclar } satisfies Cevap);
  });
}

// ─── Ana iş parçacığı ──────────────────────────────────────────────────
interface Argumanlar {
  kip: 'tek' | 'dogrula' | 'kalibre' | 'dagilim';
  bolumler: number[] | null;
  /** Diskteki bölüm JSON'ları (varyant denemesi; index'e girmeden). */
  dosyalar: string[];
  tohum: number | null;
  bas: number;
  bot: BotTuru;
  isci: number;
  taslaklar: boolean;
  acemi: boolean;
  /** --dagilim'de Acemi tohum sayısı (null = --tohum). */
  acemiTohum: number | null;
  json: string | null;
  yazma: boolean;
}

function argumanlar(argv: string[]): Argumanlar {
  const a: Argumanlar = {
    kip: 'tek',
    bolumler: null,
    dosyalar: [],
    tohum: null,
    bas: 0,
    bot: 'usta',
    isci: Math.max(1, Math.min(3, availableParallelism() - 1)),
    taslaklar: false,
    acemi: false,
    acemiTohum: null,
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
        a.kip = 'dogrula';
        break;
      case '--kalibre':
        a.kip = 'kalibre';
        break;
      case '--dagilim':
        a.kip = 'dagilim';
        break;
      case '--acemi-tohum':
        a.acemiTohum = Number(deger());
        break;
      case '--bolum':
        a.bolumler = aralik(deger());
        break;
      case '--dosya':
        a.dosyalar.push(...deger().split(','));
        break;
      case '--tohum':
      case '--tohumlar':
        a.tohum = Number(deger());
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
      case '--acemi':
        a.acemi = true;
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

/**
 * İşçi: bu dosyanın kendisi. tsx'in `--import` yükleyicisi işçi iş
 * parçacığına geçmediğinden (Node 22) işçi, tsx ESM API'sini kaydedip bu
 * modülü dosya URL'siyle içe aktaran küçük bir eval betiğiyle başlar.
 * URL'ler `import.meta` üzerinden çözülür; Windows yollarında da çalışır.
 */
function isciBaslat(): Worker {
  const api = import.meta.resolve('tsx/esm/api');
  const kod = `import(${JSON.stringify(api)}).then((m) => { m.register(); return import(${JSON.stringify(import.meta.url)}); });`;
  return new Worker(kod, { eval: true, workerData: { isci: true } });
}

/** İşçi havuzu: görevleri dağıtır, cevapları toplar. */
async function havuz(gorevler: Gorev[], isciSayisi: number, ilerleme?: (bitti: number, toplam: number) => void): Promise<Map<number, OyunSonucu[]>> {
  const sonuc = new Map<number, OyunSonucu[]>();
  if (gorevler.length === 0) return sonuc;
  const n = Math.min(isciSayisi, gorevler.length);
  let sira = 0;
  let biten = 0;
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
        biten++;
        ilerleme?.(biten, gorevler.length);
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

/** Dosyadan okunan bölümlerin dosya adı (tabloda gösterilir). */
const dosyaAdi = new Map<BolumVerisi, string>();

/** --bolum / --dosya seçimi; ikisi de yoksa varsayılan liste. */
function seciliBolumler(a: Argumanlar, varsayilan: BolumVerisi[]): BolumVerisi[] {
  const l: BolumVerisi[] = [];
  for (const id of a.bolumler ?? []) l.push(bolumGetir(id) ?? hata(`bölüm yok: ${id}`));
  for (const d of a.dosyalar) {
    // Klasör verilirse içindeki bütün .json dosyaları (ad sırasıyla).
    const yollar = statSync(d).isDirectory() ? readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => join(d, f)) : [d];
    for (const y of yollar) {
      const v = JSON.parse(readFileSync(y, 'utf8')) as BolumVerisi;
      dosyaAdi.set(v, basename(y));
      l.push(v);
    }
  }
  return l.length ? l : varsayilan;
}

/** Bölüm × bot × tohum aralığını 5'lik görevlere böl. */
function gorevleriKur(bolumler: BolumVerisi[], bot: BotTuru, bas: number, sayi: number, hamleEk: (v: BolumVerisi) => number, no0: number): Gorev[] {
  const g: Gorev[] = [];
  let no = no0;
  for (const v of bolumler) {
    for (let t = bas; t < bas + sayi; t += 5) {
      const tohumlar: number[] = [];
      for (let k = t; k < Math.min(bas + sayi, t + 5); k++) tohumlar.push(k);
      g.push({ no: no++, bolumId: v.id, bolum: v, bot, hamleEk: hamleEk(v), tohumlar });
    }
  }
  return g;
}

function topla(gorevler: Gorev[], cevap: Map<number, OyunSonucu[]>, v: BolumVerisi, bot: BotTuru, hamleEkli = false): OyunSonucu[] {
  return gorevler.filter((g) => g.bolum === v && g.bot === bot && (g.hamleEk > 0) === hamleEkli).flatMap((g) => cevap.get(g.no) ?? []);
}

function yuzde(x: number | null): string {
  return x === null ? '   -' : `${x.toFixed(0).padStart(3)}%`;
}

function ilerlemeYaz(bitti: number, toplam: number): void {
  if (process.stderr.isTTY) process.stderr.write(`\r  ${bitti}/${toplam} görev`);
}

function tabloBaslik(): string {
  return [
    'Bölüm'.padEnd(6),
    'Tür'.padEnd(10),
    'Usta'.padStart(5),
    'Bant'.padEnd(8),
    'Yakın'.padStart(5),
    'R med/p90/p99'.padEnd(14),
    'Zncr',
    'Rok/Kas/Yıl %'.padEnd(14),
    'Isı/sınır'.padEnd(10),
    'Süre'.padStart(5),
    'Acemi',
    'Yıldız p50/p85',
  ].join(' ');
}

function tabloSatiri(v: BolumVerisi, o: BolumOlcumu): string {
  return [
    `${dosyaAdi.get(v) ?? v.id}${v.taslak ? '*' : ''}`.padEnd(6),
    v.tur.padEnd(10),
    yuzde(o.kazanmaOrani).padStart(5),
    `${v.botBandi[0]}–${v.botBandi[1]}`.padEnd(8),
    yuzde(o.yakinKacis).padStart(5),
    `${o.rMedyan}/${o.rP90}/${o.rP99}`.padEnd(14),
    String(o.zincirMedyan).padStart(4),
    `${o.roketOrani.toFixed(0)}/${o.kasimpatiOrani.toFixed(0)}/${o.yildizOrani.toFixed(1)}`.padEnd(14),
    `${o.ortalamaIsi.toFixed(2)}/${o.isiSiniri.toFixed(1)}`.padEnd(10),
    `${o.sureSn.toFixed(0)}s`.padStart(5),
    yuzde(o.acemiOrani).padStart(5),
    `${o.puanP50}/${o.puanP85}`,
  ].join(' ');
}

async function dogrula(a: Argumanlar): Promise<number> {
  const t0 = Date.now();
  const sayi = a.tohum ?? 100;
  const secili = seciliBolumler(a, [...TUM_BOLUMLER]);
  // Statik doğrulama her bölümde (taslaklar dahil).
  let basarisiz = 0;
  for (const v of secili) {
    const h = bolumDogrula(v);
    if (h.length) {
      basarisiz++;
      console.log(`Bölüm ${v.id} statik: ${h.join('; ')}`);
    }
  }
  const sim = secili.filter((v) => !v.taslak || a.taslaklar || a.dosyalar.length > 0 || (a.bolumler && a.bolumler.includes(v.id)));
  const ustaG = gorevleriKur(sim, 'usta', a.bas, sayi, () => 0, 0);
  // Acemi ölçümü ucuzdur (Usta'nın ~1/5'i): öğretim ve tanıtımda hep ölçülür (izleme ölçütleri).
  const acemiBolum = sim.filter((v) => a.acemi || v.tur === 'ogretim' || v.tur === 'tanitim');
  const acemiG = gorevleriKur(acemiBolum, 'acemi', a.bas, sayi, () => 0, ustaG.length);
  const gorevler = [...ustaG, ...acemiG];
  console.log(`Doğrulama: ${sim.length} bölüm × ${sayi} tohum (Usta${acemiBolum.length ? `, Acemi ${acemiBolum.length} bölüm` : ''}), ${Math.min(a.isci, gorevler.length)} işçi`);
  const cevap = await havuz(gorevler, a.isci, ilerlemeYaz);
  if (process.stderr.isTTY) process.stderr.write('\n');
  console.log(tabloBaslik());
  const olcumler: (BolumOlcumu & { hatalar: string[]; uyarilar: string[] })[] = [];
  for (const v of sim) {
    const o = olcumHesapla(v, topla(gorevler, cevap, v, 'usta'), topla(gorevler, cevap, v, 'acemi'));
    const uyarilar: string[] = [];
    const hatalar = olcutHatalari(v, o, uyarilar);
    olcumler.push({ ...o, hatalar, uyarilar });
    console.log(tabloSatiri(v, o));
    for (const h of hatalar) console.log(`        ${v.taslak ? 'taslak' : 'HATA'}: ${h}`);
    for (const u of uyarilar) console.log(`        uyarı: ${u}`);
    if (hatalar.length && !v.taslak) basarisiz++;
  }
  const sn = (Date.now() - t0) / 1000;
  console.log(`\n${sim.length} bölüm, ${basarisiz} başarısız, ${sn.toFixed(1)} sn. (* = taslak)`);
  if (a.json) writeFileSync(a.json, JSON.stringify(olcumler, null, 2));
  return basarisiz ? 1 : 0;
}

/** Bölüm JSON dosyasının yolu (Windows/POSIX bağımsız). */
function bolumDosyasi(id: number): string {
  const ad = id > 100 ? `u${id}` : `b${String(id).padStart(3, '0')}`;
  return fileURLToPath(new URL(`../levels/veri/${ad}.json`, import.meta.url));
}

/** Biçimi koruyarak yalnız `yildizEsikleri` satırını değiştir. */
function yildizYaz(id: number, esik: [number, number]): void {
  const dosya = bolumDosyasi(id);
  const metin = readFileSync(dosya, 'utf8');
  const yeni = metin.replace(/"yildizEsikleri"\s*:\s*\[[^\]]*\]/, `"yildizEsikleri": [${esik[0]}, ${esik[1]}]`);
  if (yeni === metin && !metin.includes(`"yildizEsikleri": [${esik[0]}, ${esik[1]}]`)) throw new Error(`${dosya}: yildizEsikleri bulunamadı`);
  writeFileSync(dosya, yeni);
}

async function kalibre(a: Argumanlar): Promise<number> {
  const t0 = Date.now();
  const sayi = a.tohum ?? 500;
  const secili = seciliBolumler(a, TUM_BOLUMLER.filter((v) => !v.taslak || a.taslaklar));
  const ek = (v: BolumVerisi): number => Math.max(5, Math.ceil(v.hamle / 2));
  // 1) Gerçek hamleyle: yıldız eşikleri. 2) Fazla hamleyle: kazanma hamlesi dağılımı → hamle önerisi.
  const g1 = gorevleriKur(secili, 'usta', a.bas, sayi, () => 0, 0);
  const g2 = gorevleriKur(secili, 'usta', a.bas, Math.min(sayi, 200), ek, g1.length);
  const gorevler = [...g1, ...g2];
  console.log(`Kalibrasyon: ${secili.length} bölüm × ${sayi} tohum (+ ${Math.min(sayi, 200)} uzatılmış), ${Math.min(a.isci, gorevler.length)} işçi`);
  const cevap = await havuz(gorevler, a.isci, ilerlemeYaz);
  if (process.stderr.isTTY) process.stderr.write('\n');
  for (const v of secili) {
    const o = olcumHesapla(v, topla(gorevler, cevap, v, 'usta'));
    const esik = yildizEsikleriHesapla(o);
    // Hamle önerisi: uzatılmış koşularda H hamlede kazanılanların oranı ≈ H hamleli kazanma oranı.
    const uzun = topla(gorevler, cevap, v, 'usta', true);
    const oran = (H: number): number => (100 * uzun.filter((s) => s.kazandi && s.hamle <= H).length) / Math.max(1, uzun.length);
    const [bMin, bMax] = v.botBandi;
    const hedef = bMax >= 100 ? bMin + 1 : (bMin + bMax) / 2;
    let oneri = v.hamle;
    let enFark = Infinity;
    for (let H = Math.max(5, Math.floor(v.hamle * 0.6)); H <= v.hamle + ek(v); H++) {
      const f = Math.abs(oran(H) - hedef) + (bMax >= 100 && oran(H) < bMin ? 1000 : 0);
      if (f < enFark - 0.5) {
        enFark = f;
        oneri = H;
      }
    }
    const egri = [-2, -1, 0, 1, 2].map((d) => `${v.hamle + d}:${oran(v.hamle + d).toFixed(0)}%`).join(' ');
    // K22: elle seçilmiş eşikler (öğretim) korunur; Usta p50/p85 yalnız bilgi.
    const elle = v.elleEsik ? ' — elle eşik (K22), yazılmadı' : '';
    console.log(
      `Bölüm ${v.id}${v.taslak ? '*' : ''}: kazanma %${o.kazanmaOrani.toFixed(0)} (bant ${bMin}–${bMax}), yildizEsikleri [${esik.join(', ')}] (eski [${v.yildizEsikleri.join(', ')}])${elle}, hamle ${v.hamle} → öneri ${oneri}  [${egri}]`,
    );
    if (a.yazma && o.kazanc > 0 && a.dosyalar.length === 0 && !v.elleEsik) yildizYaz(v.id, esik);
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} sn.${a.yazma ? ' yildizEsikleri yazıldı.' : ''}`);
  return 0;
}

/** Hedeflerin kısa özeti: "36 r2 + 36 r4", "kafes 5 + aydinlat 30". */
function hedefOzeti(v: BolumVerisi): string {
  return bolumuYukle(v, 0)
    .hedefler.map(({ hedef: t, gerekli }) => (t.tur === 'topla' ? `${gerekli} ${t.renk === 'hepsi' ? 'hepsi' : `r${t.renk}`}` : `${t.tur} ${gerekli}`))
    .join(' + ');
}

/** Kazanılan oyunlarda 1★/2★/3★ payı (% kazanç; güçlendirici yok, §7.4). */
function yildizPayi(s: readonly OyunSonucu[], esik: readonly [number, number]): [number, number, number] {
  const k = s.filter((x) => x.kazandi);
  const n = k.length || 1;
  const y3 = k.filter((x) => x.puan >= esik[1]).length;
  const y2 = k.filter((x) => x.puan >= esik[0] && x.puan < esik[1]).length;
  return [(100 * (k.length - y2 - y3)) / n, (100 * y2) / n, (100 * y3) / n];
}

interface BotDagilimi {
  kosu: number;
  /** Kazanma oranı (%). */
  kazanma: number;
  /** Kazançlarda 1★/2★/3★ payı (%), bölümün mevcut eşikleriyle. */
  yildiz: [number, number, number];
  /** Kazançların puan yüzdelikleri (final dahil). */
  p15: number;
  p40: number;
  p50: number;
  p85: number;
}

interface DagilimSatiri {
  bolumId: number;
  tur: BolumVerisi['tur'];
  hamle: number;
  hedef: string;
  yildizEsikleri: [number, number];
  /** Öğretim eşik önerisi (K22, `yildizEsikleriOgretim`). */
  k22: [number, number];
  usta: BotDagilimi;
  acemi: BotDagilimi;
}

/**
 * Usta ve Acemi kazanma oranı, yıldız dağılımı (mevcut eşiklerle) ve
 * kazançların puan yüzdelikleri. Öğretimin elle eşikleri (K22) ve
 * bölüm ayarı (Acemi izleme ölçütü) için.
 */
async function dagilim(a: Argumanlar): Promise<number> {
  const t0 = Date.now();
  const nU = a.tohum ?? 100;
  const nA = a.acemiTohum ?? nU;
  const secili = seciliBolumler(a, TUM_BOLUMLER.filter((v) => !v.taslak || a.taslaklar));
  const gU = gorevleriKur(secili, 'usta', a.bas, nU, () => 0, 0);
  const gA = gorevleriKur(secili, 'acemi', a.bas, nA, () => 0, gU.length);
  const gorevler = [...gU, ...gA];
  console.log(`Dağılım: ${secili.length} bölüm × Usta ${nU} / Acemi ${nA} tohum, ${Math.min(a.isci, gorevler.length)} işçi`);
  const cevap = await havuz(gorevler, a.isci, ilerlemeYaz);
  if (process.stderr.isTTY) process.stderr.write('\n');
  const puanlar = (s: OyunSonucu[]): number[] =>
    s
      .filter((x) => x.kazandi)
      .map((x) => x.puan)
      .sort((x, y) => x - y);
  const ozet = (s: OyunSonucu[], esik: [number, number]): BotDagilimi => {
    const p = puanlar(s);
    return {
      kosu: s.length,
      kazanma: (100 * p.length) / Math.max(1, s.length),
      yildiz: yildizPayi(s, esik),
      p15: yuzdelik(p, 15),
      p40: yuzdelik(p, 40),
      p50: yuzdelik(p, 50),
      p85: yuzdelik(p, 85),
    };
  };
  const yd = (y: [number, number, number]): string => y.map((x) => x.toFixed(0)).join('/');
  console.log(
    [
      'Bölüm'.padEnd(6),
      'Tür'.padEnd(9),
      'H'.padStart(3),
      'Hedef'.padEnd(24),
      'Usta'.padStart(5),
      '1/2/3★ %'.padEnd(10),
      'Acemi'.padStart(5),
      '1/2/3★ %'.padEnd(10),
      'Eşik'.padEnd(12),
      'Usta p15/p50/p85'.padEnd(18),
      'Acemi p40/p50/p85'.padEnd(18),
      'K22 önerisi',
    ].join(' '),
  );
  const satirlar: DagilimSatiri[] = [];
  for (const v of secili) {
    const us = topla(gorevler, cevap, v, 'usta');
    const as = topla(gorevler, cevap, v, 'acemi');
    const u = ozet(us, v.yildizEsikleri);
    const ac = ozet(as, v.yildizEsikleri);
    const k22 = yildizEsikleriOgretim(puanlar(us), puanlar(as));
    const s: DagilimSatiri = { bolumId: v.id, tur: v.tur, hamle: v.hamle, hedef: hedefOzeti(v), yildizEsikleri: v.yildizEsikleri, k22, usta: u, acemi: ac };
    satirlar.push(s);
    console.log(
      [
        `${dosyaAdi.get(v) ?? v.id}`.padEnd(6),
        v.tur.padEnd(9),
        String(v.hamle).padStart(3),
        s.hedef.padEnd(24),
        yuzde(u.kazanma).padStart(5),
        yd(u.yildiz).padEnd(10),
        yuzde(ac.kazanma).padStart(5),
        yd(ac.yildiz).padEnd(10),
        `${v.yildizEsikleri[0]}/${v.yildizEsikleri[1]}${v.elleEsik ? 'e' : ''}`.padEnd(12),
        `${u.p15}/${u.p50}/${u.p85}`.padEnd(18),
        `${ac.p40}/${ac.p50}/${ac.p85}`.padEnd(18),
        `${k22[0]}/${k22[1]}`,
      ].join(' '),
    );
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} sn. (Eşik sonundaki e = elle; K22 önerisi yalnız elleEsik bölümlerine elle yazılır)`);
  if (a.json) writeFileSync(a.json, JSON.stringify(satirlar, null, 2));
  return 0;
}

function hamleMetni(w: number, h: Hamle): string {
  switch (h.tur) {
    case 'fitil':
      return `fitil${h.halka ? ' HALKA' : ''} [${h.yol.map((p) => `${p.x},${p.y}`).join(' ')}] (${h.yol.length})`;
    case 'ciftDokunus':
      return `çift dokunuş (${h.hucre.x},${h.hucre.y})`;
    case 'koruk':
      return `körük (${h.merkez.x},${h.merkez.y})`;
    default:
      return `${h.tur} ${w}`;
  }
}

function tek(a: Argumanlar): number {
  const v = seciliBolumler(a, [bolumGetir(1)!])[0];
  const tohum = a.tohum ?? 0;
  const t0 = Date.now();
  const s = oyunOyna(v, tohum, a.bot, {
    kayit: ({ d, hamle, olaylar, sonraki }) => {
      let R = 0;
      for (const o of olaylar) if (o.tur === 'reaksiyon') R = o.boyut;
      console.log(
        `${String(sonraki.hamleNo).padStart(3)}. ${hamleMetni(d.w, hamle).padEnd(60)} R=${String(R).padStart(2)} puan=${String(sonraki.puan).padStart(6)} ilerleme=${(100 * ilerlemeYuzdesi(sonraki)).toFixed(0)}% kalan=${sonraki.kalanHamle}`,
      );
    },
  });
  const R = s.reaksiyonlar.slice().sort((x, y) => x - y);
  console.log(
    `\nBölüm ${v.id} "${v.ad}", tohum ${tohum}, ${a.bot}: ${s.kazandi ? 'KAZANDI' : 'kaybetti'} — ${s.hamle} hamle, puan ${s.puan}, ilerleme %${(100 * s.ilerleme).toFixed(0)}, R medyan ${yuzdelik(R, 50)}, en büyük ${R[R.length - 1] ?? 0}, tahmini süre ${(s.sureMs / 1000).toFixed(0)} sn (${Date.now() - t0} ms)`,
  );
  return 0;
}

function hata(m: string): never {
  throw new Error(m);
}

async function ana(): Promise<void> {
  const a = argumanlar(process.argv.slice(2));
  let kod = 0;
  if (a.kip === 'dogrula') kod = await dogrula(a);
  else if (a.kip === 'kalibre') kod = await kalibre(a);
  else if (a.kip === 'dagilim') kod = await dagilim(a);
  else kod = tek(a);
  process.exitCode = kod;
}

if (isMainThread) {
  ana().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 2;
  });
} else if ((workerData as { isci?: boolean } | null)?.isci) {
  isciCalis();
}
