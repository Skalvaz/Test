/**
 * Bot simülasyon aracı (GDD §16.5 CLI). tsx ile Node'da çalışır:
 *
 *   npm run bot -- --bolum 12 --tohum 200 --bot usta     tek oyun dökümü
 *   npm run dogrula                                       bütün bölümler, 100 tohum
 *   npm run dogrula -- --bolum 7 --tohum 30               bir bölüm, 30 tohum
 *   npm run kalibre                                       500 tohum, yildizEsikleri yazar
 *   npm run kalibre -- --bolum 7 --yazma                  yazmadan göster
 *   npm run kalibre -- --bolum 6-19 --kural k24           K24 eşikleri (+ Acemi), bayrağı yazar
 *   npm run bot -- --dagilim --bolum 1-12 --tohum 100 --acemi-tohum 60
 *                                                         Usta + Acemi kazanma ve yıldız dağılımı
 *   npm run bot -- --muhur --bolum 6-40 --tohum 150 --acemi-tohum 300 --bas 2000
 *                                                         Bölüm Mühürleri: kazançlarda tutma oranı,
 *                                                         bant denetimi ve eşik önerisi (KANCALAR §A.7)
 *   npm run bot -- --muhur --bolum 22 --katalog           + bölüme uyan aday mühürlerin eşik tablosu
 *
 * Seçenekler:
 *   --bolum N      Bölüm id (1..40, 101..108). Virgülle ya da aralıkla: 1-10,12
 *   --dosya YOL    Diskteki bölüm JSON'u ya da klasörü (varyant denemesi; virgülle birden çok)
 *   --tohum K      Tek oyunda tohum; --dogrula/--kalibre/--dagilim'de tohum SAYISI
 *   --bas S        İlk tohum (varsayılan 0)
 *   --bot usta|acemi
 *   --isci N       İşçi sayısı (varsayılan min(3, çekirdek − 1))
 *   --taslaklar    Taslak bölümleri de simüle et (hataları başarısızlık sayılmaz)
 *   --acemi        Acemi botu her bölümde ölç (öğretim ve tanıtımda varsayılan açık)
 *   --acemi-tohum K  --dagilim, --dogrula ve K24 --kalibre'de Acemi tohum sayısı
 *                  (varsayılan --tohum)
 *   --kural k24    --kalibre'de K24 eşik kuralı (bölüme "esikKurali": "k24" yazar)
 *   --json DOSYA   Ölçümleri JSON olarak yaz
 *   --yazma        --kalibre'de JSON'a yazma
 *   --muhur        Mühür ölçümü (varsayılan: mühürlü bütün bölümler, Usta 150 /
 *                  Acemi 2 × Usta tohum, 2 işçi). Kısıt mühürlerinde (`enCok`)
 *                  kısıtlı botu da aynı tohumlarla oynatır.
 *   --katalog      --muhur'da bölüm öğelerine göre aday koşulların eşik tablosu
 *   --aday DOSYA   --muhur'da ek aday koşullar (JSON: koşul dizisi ya da
 *                  {"<bölüm>": [koşul…]}); aynı oyunlarda oranları yazılır
 *
 * `--dogrula` mühürlü bölümlerde mühür oranlarını da hesaplar ve bandın ±5
 * puan dışındaki mühürde UYARI verir (başarısızlık değil; Çırak yalnız Acemi
 * ölçüldüyse, kısıt mühürleri yalnız `--muhur` ile).
 *
 * `elleEsik: true` taşıyan bölümlerin (öğretim, GDD K22) yıldız eşiklerini
 * kalibre YAZMAZ, yalnız Usta önerisini gösterir; bu eşikler `--dagilim`
 * çıktısındaki Acemi/Usta yüzdeliklerinden elle seçilir.
 *
 * K24 (GDD K24, 6–25): `"esikKurali": "k24"` taşıyan bölümde (ya da
 * `--kural k24` ile) kalibre Acemi'yi de oynatır ve 2★ = min(Usta p50,
 * Acemi kazançlarının p50'si), 3★ = Usta p85 yazar; `--kural k24` bayrağı
 * da JSON'a ekler. `--dagilim` "K24 önerisi" sütununu her bölüm için gösterir.
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
import { olcumHesapla, olcutHatalari, yildizEsikleriHesapla, yildizEsikleriIlkIzlenim, yildizEsikleriK24, yildizEsikleriOgretim, yuzdelik, type BolumOlcumu } from './olcut';
import type { BotTuru } from './ortak';
import { oyunOyna, type OyunKisiti, type OyunSonucu } from './simulasyon';
import { muhurDegeri, muhurKosuluDogrula, muhurMetni, MUHUR_KADEME_ADLARI, MUHUR_KADEMELERI } from '../meta/muhur';
import type { MuhurKosulu } from '../core/index';
import {
  adayKatalogu,
  esikOnerisi,
  kazancDegerleri,
  kosulKisiti,
  muhurluOyun,
  muhurOlc,
  oyunDegerleri,
  oyunMuhurOzeti,
  type DegerliOyun,
  type MuhurOlcumu,
  type MuhurOyunu,
} from './muhurOlcum';

interface Gorev {
  no: number;
  bolumId: number;
  /** Bölüm verisi (işçi dosyadan okunan varyantları da oynatabilsin). */
  bolum: BolumVerisi;
  bot: BotTuru;
  hamleEk: number;
  tohumlar: number[];
  /** --muhur: oyunların eylem izlerini döndür. */
  muhur?: boolean;
  /** --muhur: kısıt mühürü için kısıtlı bot. */
  kisit?: OyunKisiti;
  /** --dogrula: sonuçlara bölümün mühür değerlerini ekle. */
  muhurDeger?: boolean;
}

interface Cevap {
  no: number;
  sonuclar: OyunSonucu[];
  /** --muhur: eylem izli oyunlar. */
  oyunlar?: MuhurOyunu[];
}

// ─── İşçi ───────────────────────────────────────────────────────────────
function isciCalis(): void {
  parentPort!.on('message', (g: Gorev | null) => {
    if (!g) {
      process.exit(0);
    }
    const sonuclar: OyunSonucu[] = [];
    const oyunlar: MuhurOyunu[] = [];
    for (const t of g.tohumlar) {
      if (!g.muhur && !g.muhurDeger) {
        sonuclar.push(oyunOyna(g.bolum, t, g.bot, { hamleEk: g.hamleEk }));
        continue;
      }
      const r = muhurluOyun(g.bolum, t, g.bot, { hamleEk: g.hamleEk, kisit: g.kisit });
      if (g.muhurDeger && g.bolum.muhurler) {
        const mo = oyunMuhurOzeti(r.oyun);
        r.sonuc.muhurDegerleri = g.bolum.muhurler.map((k) => muhurDegeri(k, mo));
      }
      sonuclar.push(r.sonuc);
      if (g.muhur) oyunlar.push(r.oyun);
    }
    parentPort!.postMessage({ no: g.no, sonuclar, ...(g.muhur ? { oyunlar } : {}) } satisfies Cevap);
  });
}

// ─── Ana iş parçacığı ──────────────────────────────────────────────────
interface Argumanlar {
  kip: 'tek' | 'dogrula' | 'kalibre' | 'dagilim' | 'muhur';
  bolumler: number[] | null;
  /** Diskteki bölüm JSON'ları (varyant denemesi; index'e girmeden). */
  dosyalar: string[];
  tohum: number | null;
  bas: number;
  bot: BotTuru;
  isci: number;
  /** --isci açıkça verildi mi (--muhur varsayılanı 2 işçi). */
  isciVerildi: boolean;
  taslaklar: boolean;
  acemi: boolean;
  /** --dagilim'de Acemi tohum sayısı (null = --tohum). */
  acemiTohum: number | null;
  json: string | null;
  yazma: boolean;
  /** --kalibre'de eşik kuralı (null = bölümün `esikKurali`'na göre). */
  kural: 'k24' | null;
  /** --muhur: aday katalog tablosu. */
  katalog: boolean;
  /** --muhur: ek aday koşul dosyası. */
  aday: string | null;
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
    isciVerildi: false,
    taslaklar: false,
    acemi: false,
    acemiTohum: null,
    json: null,
    yazma: true,
    kural: null,
    katalog: false,
    aday: null,
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
      case '--muhur':
        a.kip = 'muhur';
        break;
      case '--katalog':
        a.katalog = true;
        break;
      case '--aday':
        a.aday = deger();
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
        a.isciVerildi = true;
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
      case '--kural': {
        const k = deger();
        if (k !== 'k24') throw new Error('--kural k24');
        a.kural = k;
        break;
      }
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

/**
 * Kalıcı işçi havuzu (--muhur): bölümler sırayla, her bölümün görevleri
 * paralel çalışır; eylem izleri bölüm yazdırılınca atılır (bellek).
 */
interface KaliciHavuz {
  calistir(gorevler: Gorev[]): Promise<Map<number, Cevap>>;
  kapat(): Promise<void>;
}

function kaliciHavuz(n: number): KaliciHavuz {
  const isciler = Array.from({ length: Math.max(1, n) }, () => isciBaslat());
  let is: { gorevler: Gorev[]; sira: number; biten: number; sonuc: Map<number, Cevap>; coz: (m: Map<number, Cevap>) => void; reddet: (e: unknown) => void } | null = null;
  const ver = (w: Worker): void => {
    if (is && is.sira < is.gorevler.length) w.postMessage(is.gorevler[is.sira++]);
  };
  for (const w of isciler) {
    w.on('message', (c: Cevap) => {
      if (!is) return;
      is.sonuc.set(c.no, c);
      is.biten++;
      ilerlemeYaz(is.biten, is.gorevler.length);
      if (is.biten === is.gorevler.length) {
        const s = is;
        is = null;
        s.coz(s.sonuc);
      } else ver(w);
    });
    w.on('error', (e) => is?.reddet(e));
  }
  return {
    calistir(gorevler) {
      return new Promise((coz, reddet) => {
        if (gorevler.length === 0) {
          coz(new Map());
          return;
        }
        is = { gorevler, sira: 0, biten: 0, sonuc: new Map(), coz, reddet };
        for (const w of isciler) ver(w);
      });
    },
    async kapat() {
      await Promise.all(
        isciler.map(
          (w) =>
            new Promise<void>((coz) => {
              w.once('exit', () => coz());
              w.postMessage(null);
            }),
        ),
      );
    },
  };
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
  const nA = a.acemiTohum ?? sayi;
  const acemiG = gorevleriKur(acemiBolum, 'acemi', a.bas, nA, () => 0, ustaG.length);
  // Mühürlü bölümlerde işçi mühür değerlerini de döndürür (bant uyarısı, KANCALAR §A.7).
  const gorevler = [...ustaG, ...acemiG].map((g) => (g.bolum.muhurler?.length ? { ...g, muhurDeger: true } : g));
  console.log(
    `Doğrulama: ${sim.length} bölüm × ${sayi} tohum (Usta${acemiBolum.length ? `, Acemi ${acemiBolum.length} bölüm × ${nA}` : ''}), ${Math.min(a.isci, gorevler.length)} işçi`,
  );
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
    for (const u of muhurUyarilari(v, topla(gorevler, cevap, v, 'usta'), acemiBolum.includes(v) ? topla(gorevler, cevap, v, 'acemi') : null)) {
      uyarilar.push(u);
      console.log(`        uyarı: ${u}`);
    }
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

/**
 * Biçimi koruyarak yalnız `yildizEsikleri` satırını değiştir. `k24`: dosyada
 * yoksa hemen arkasına `"esikKurali": "k24"` ekler (K24 bayrağı).
 */
function yildizYaz(id: number, esik: [number, number], k24 = false): void {
  const dosya = bolumDosyasi(id);
  const metin = readFileSync(dosya, 'utf8');
  let yeni = metin.replace(/"yildizEsikleri"\s*:\s*\[[^\]]*\]/, `"yildizEsikleri": [${esik[0]}, ${esik[1]}]`);
  if (yeni === metin && !metin.includes(`"yildizEsikleri": [${esik[0]}, ${esik[1]}]`)) throw new Error(`${dosya}: yildizEsikleri bulunamadı`);
  if (k24 && !/"esikKurali"/.test(yeni)) {
    const girinti = /^([ \t]*)"yildizEsikleri"/m.exec(yeni)?.[1] ?? '  ';
    yeni = yeni.replace(/("yildizEsikleri"\s*:\s*\[[^\]]*\])(,?)/, `$1,\n${girinti}"esikKurali": "k24"$2`);
  }
  writeFileSync(dosya, yeni);
}

async function kalibre(a: Argumanlar): Promise<number> {
  const t0 = Date.now();
  const sayi = a.tohum ?? 500;
  const secili = seciliBolumler(a, TUM_BOLUMLER.filter((v) => !v.taslak || a.taslaklar));
  const ek = (v: BolumVerisi): number => Math.max(5, Math.ceil(v.hamle / 2));
  // 1) Gerçek hamleyle: yıldız eşikleri. 2) Fazla hamleyle: kazanma hamlesi dağılımı → hamle önerisi.
  // K24 (GDD K24): bayraklı bölüm ya da --kural k24 (elle eşikli öğretim hariç); Acemi de oynar.
  const k24 = (v: BolumVerisi): boolean => !v.elleEsik && (v.esikKurali === 'k24' || a.kural === 'k24');
  const nA = a.acemiTohum ?? sayi;
  const g1 = gorevleriKur(secili, 'usta', a.bas, sayi, () => 0, 0);
  const g2 = gorevleriKur(secili, 'usta', a.bas, Math.min(sayi, 200), ek, g1.length);
  const g3 = gorevleriKur(secili.filter(k24), 'acemi', a.bas, nA, () => 0, g1.length + g2.length);
  const gorevler = [...g1, ...g2, ...g3];
  console.log(
    `Kalibrasyon: ${secili.length} bölüm × ${sayi} tohum (+ ${Math.min(sayi, 200)} uzatılmış${g3.length ? `, K24: Acemi ${nA}` : ''}), ${Math.min(a.isci, gorevler.length)} işçi`,
  );
  const cevap = await havuz(gorevler, a.isci, ilerlemeYaz);
  if (process.stderr.isTTY) process.stderr.write('\n');
  for (const v of secili) {
    const us = topla(gorevler, cevap, v, 'usta');
    const o = olcumHesapla(v, us);
    const kazancPuani = (s: OyunSonucu[]): number[] =>
      s
        .filter((x) => x.kazandi)
        .map((x) => x.puan)
        .sort((x, y) => x - y);
    const as = k24(v) ? topla(gorevler, cevap, v, 'acemi') : [];
    const esik = k24(v) ? yildizEsikleriK24(kazancPuani(us), kazancPuani(as)) : yildizEsikleriHesapla(o);
    const kuralNotu = k24(v) ? ` K24 (Acemi %${((100 * kazancPuani(as).length) / Math.max(1, as.length)).toFixed(0)})` : '';
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
      `Bölüm ${v.id}${v.taslak ? '*' : ''}: kazanma %${o.kazanmaOrani.toFixed(0)} (bant ${bMin}–${bMax}), yildizEsikleri [${esik.join(', ')}]${kuralNotu} (eski [${v.yildizEsikleri.join(', ')}])${elle}, hamle ${v.hamle} → öneri ${oneri}  [${egri}]`,
    );
    if (a.yazma && o.kazanc > 0 && a.dosyalar.length === 0 && !v.elleEsik) yildizYaz(v.id, esik, k24(v));
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
  p20: number;
  p40: number;
  p50: number;
  p70: number;
  p85: number;
}

interface DagilimSatiri {
  bolumId: number;
  tur: BolumVerisi['tur'];
  hamle: number;
  hedef: string;
  yildizEsikleri: [number, number];
  /** Öğretim eşik önerisi (K22, `yildizEsikleriOgretim`; 4–5). */
  k22: [number, number];
  /** İlk izlenim eşik önerisi (K22, `yildizEsikleriIlkIzlenim`; 1–3). */
  ilk: [number, number];
  /** K24 eşik önerisi (`yildizEsikleriK24`; 6–25). */
  k24: [number, number];
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
      p20: yuzdelik(p, 20),
      p40: yuzdelik(p, 40),
      p50: yuzdelik(p, 50),
      p70: yuzdelik(p, 70),
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
      'Acemi p20/p40/p50/p70/p85'.padEnd(26),
      'İlk izl.'.padEnd(11),
      'K22 öneri'.padEnd(11),
      'K24 öneri',
    ].join(' '),
  );
  const satirlar: DagilimSatiri[] = [];
  for (const v of secili) {
    const us = topla(gorevler, cevap, v, 'usta');
    const as = topla(gorevler, cevap, v, 'acemi');
    const u = ozet(us, v.yildizEsikleri);
    const ac = ozet(as, v.yildizEsikleri);
    const k22 = yildizEsikleriOgretim(puanlar(us), puanlar(as));
    const ilk = yildizEsikleriIlkIzlenim(puanlar(us), puanlar(as));
    const k24 = yildizEsikleriK24(puanlar(us), puanlar(as));
    const s: DagilimSatiri = { bolumId: v.id, tur: v.tur, hamle: v.hamle, hedef: hedefOzeti(v), yildizEsikleri: v.yildizEsikleri, k22, ilk, k24, usta: u, acemi: ac };
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
        `${v.yildizEsikleri[0]}/${v.yildizEsikleri[1]}${v.elleEsik ? 'e' : v.esikKurali === 'k24' ? 'k' : ''}`.padEnd(12),
        `${u.p15}/${u.p50}/${u.p85}`.padEnd(18),
        `${ac.p20}/${ac.p40}/${ac.p50}/${ac.p70}/${ac.p85}`.padEnd(26),
        `${ilk[0]}/${ilk[1]}`.padEnd(11),
        `${k22[0]}/${k22[1]}`.padEnd(11),
        `${k24[0]}/${k24[1]}`,
      ].join(' '),
    );
  }
  console.log(
    `${((Date.now() - t0) / 1000).toFixed(1)} sn. (Eşik sonundaki e = elle (K22), k = K24; elleEsik bölümlerine elle yazılır: 1–3 "İlk izl." (2★ Acemi p20, 3★ Acemi p70 ile Usta p50 ortası), 4–5 "K22 öneri"; K24 önerisini kalibre --kural k24 500 tohumla yazar)`,
  );
  if (a.json) writeFileSync(a.json, JSON.stringify(satirlar, null, 2));
  return 0;
}

// ─── Bölüm Mühürleri (docs/KANCALAR.md §A.5, §A.7) ───────────────────────

const KADEME_HARFI = { cirak: 'Ç', kalfa: 'K', usta: 'U' } as const;

function oranMetni(x: number | null): string {
  return x === null ? '  —' : `${Math.round(x)}`.padStart(3);
}

function bantMetni(o: Pick<MuhurOlcumu, 'bant'>): string {
  const b = o.bant;
  return `${b.bot === 'usta' ? 'U' : 'A'} ${b.max >= 100 ? `≥ ${b.min}` : `${b.min}–${b.max}`}`;
}

/**
 * --dogrula: mühür oranları bandın ±5 puan dışındaysa uyarı. Çırak yalnız
 * Acemi ölçüldüyse; kısıt mühürleri (kısıtlı bot gerekir) yalnız --muhur ile.
 */
function muhurUyarilari(v: BolumVerisi, usta: OyunSonucu[], acemi: OyunSonucu[] | null): string[] {
  if (!v.muhurler?.length) return [];
  const degerli = (l: OyunSonucu[]): DegerliOyun[] => l.filter((s) => s.muhurDegerleri).map((s) => ({ kazandi: s.kazandi, degerler: s.muhurDegerleri! }));
  const u: string[] = [];
  for (const o of muhurOlc(v, { usta: degerli(usta), acemi: acemi ? degerli(acemi) : undefined })) {
    if (o.kademe === 'cirak' && !acemi) continue;
    if (o.durum !== 'disinda') continue;
    u.push(`mühür ${MUHUR_KADEME_ADLARI[o.kademe]} "${o.metin}" ${bantMetni(o).split(' ')[0]} %${Math.round(o.oran ?? 0)} (bant ${bantMetni(o)}${o.yedek ? ', yedek' : ''})`);
  }
  return u;
}

/** --aday dosyası: koşul dizisi (her bölüme) ya da {"<bölüm>": [koşul…]}. */
function adaylariOku(dosya: string): (id: number) => MuhurKosulu[] {
  const j = JSON.parse(readFileSync(dosya, 'utf8')) as MuhurKosulu[] | Record<string, MuhurKosulu[]>;
  const denetle = (l: MuhurKosulu[]): MuhurKosulu[] => {
    for (const k of l) {
      const h = muhurKosuluDogrula(k);
      if (h.length) throw new Error(`${dosya}: ${JSON.stringify(k)}: ${h.join('; ')}`);
    }
    return l;
  };
  if (Array.isArray(j)) {
    const l = denetle(j);
    return () => l;
  }
  for (const l of Object.values(j)) denetle(l);
  return (id) => j[String(id)] ?? [];
}

/** Değer → kazanç sayısı (JSON raporunda eşik keşfi için; kümeler toplanabilir). */
type Dagilim = Record<string, number>;

function degerDagilimi(degerler: readonly number[]): Dagilim {
  const d: Dagilim = {};
  for (const x of degerler) d[x] = (d[x] ?? 0) + 1;
  return d;
}

interface MuhurBolumRaporu {
  bolumId: number;
  ad: string;
  usta: { oyun: number; kazanc: number };
  acemi: { oyun: number; kazanc: number };
  /** Mühürler; `dagilim`: kazançlarda koşul değerinin dağılımı (kısıtta kısıtlı botun). */
  muhurler: (MuhurOlcumu & { oneri: ReturnType<typeof esikOnerisi>; dagilim: { usta: Dagilim; acemi: Dagilim } })[];
  adaylar: { kosul: MuhurKosulu; metin: string; usta: number | null; acemi: number | null }[];
  /** --katalog: aday koşulların kazanç değer dağılımları. */
  katalog: { kosul: MuhurKosulu; usta: Dagilim; acemi: Dagilim }[];
}

async function muhurKip(a: Argumanlar): Promise<number> {
  const t0 = Date.now();
  const nU = a.tohum ?? 150;
  const nA = a.acemiTohum ?? 2 * nU;
  const isci = a.isciVerildi ? a.isci : Math.min(2, a.isci);
  const aday = a.aday ? adaylariOku(a.aday) : null;
  const secili = seciliBolumler(
    a,
    TUM_BOLUMLER.filter((v) => v.muhurler?.length),
  ).filter((v) => v.muhurler?.length || a.katalog || aday);
  console.log(`Mühür ölçümü: ${secili.length} bölüm × Usta ${nU} / Acemi ${nA} tohum (ilk tohum ${a.bas}), ${isci} işçi`);
  const havuz = kaliciHavuz(isci);
  const raporlar: MuhurBolumRaporu[] = [];
  const sayac = { bantta: 0, payda: 0, disinda: 0, olculemedi: 0 };
  try {
    for (const v of secili) {
      const m = v.muhurler ?? [];
      // Görevler: normal Usta ve Acemi; kısıt mühürlerinde aynı tohumlarla kısıtlı bot(lar).
      const gorevler: Gorev[] = [];
      const ekle = (bot: BotTuru, sayi: number, kisit?: OyunKisiti): Gorev[] => {
        const g = gorevleriKur([v], bot, a.bas, sayi, () => 0, gorevler.length).map((x) => ({ ...x, muhur: true, ...(kisit ? { kisit } : {}) }));
        gorevler.push(...g);
        return g;
      };
      const gU = ekle('usta', nU);
      const gA = ekle('acemi', nA);
      const gK = m.map((k, i) => {
        const kisit = kosulKisiti(k);
        if (!kisit) return undefined;
        // Çırak bandı Acemi'yle ölçülür; Kalfa/Usta Usta'yla.
        return { usta: ekle('usta', nU, kisit), acemi: i === 0 ? ekle('acemi', nA, kisit) : undefined };
      });
      const cevap = await havuz.calistir(gorevler);
      if (process.stderr.isTTY) process.stderr.write('\r\x1b[K');
      const oyunlar = (g: Gorev[] | undefined): MuhurOyunu[] => (g ?? []).flatMap((x) => cevap.get(x.no)?.oyunlar ?? []);
      const oU = oyunlar(gU);
      const oA = oyunlar(gA);
      const degerli = (l: MuhurOyunu[]): DegerliOyun[] => l.map((o) => oyunDegerleri(m, o));
      const olcumler = muhurOlc(v, {
        usta: degerli(oU),
        acemi: degerli(oA),
        kisitli: gK.map((x) => (x ? { usta: degerli(oyunlar(x.usta)), acemi: x.acemi ? degerli(oyunlar(x.acemi)) : undefined } : undefined)),
      });
      const kU = oU.filter((o) => o.kazandi).length;
      const kA = oA.filter((o) => o.kazandi).length;
      console.log(`\nBölüm ${v.id} "${v.ad}" (${v.tur}): kazanç Usta %${oranMetni((100 * kU) / Math.max(1, oU.length)).trim()} (${kU}/${oU.length}), Acemi %${oranMetni((100 * kA) / Math.max(1, oA.length)).trim()} (${kA}/${oA.length})`);
      const rapor: MuhurBolumRaporu = { bolumId: v.id, ad: v.ad, usta: { oyun: oU.length, kazanc: kU }, acemi: { oyun: oA.length, kazanc: kA }, muhurler: [], adaylar: [], katalog: [] };
      olcumler.forEach((o, i) => {
        sayac[o.durum]++;
        const k = m[i];
        const oneri = o.durum !== 'bantta' && k.enAz !== undefined ? esikOnerisi(o.kademe, kazancDegerleri(k, oU), kazancDegerleri(k, oA)) : null;
        const kU2 = gK[i] ? oyunlar(gK[i]!.usta) : oU;
        const kA2 = gK[i]?.acemi ? oyunlar(gK[i]!.acemi) : oA;
        rapor.muhurler.push({ ...o, oneri, dagilim: { usta: degerDagilimi(kazancDegerleri(k, kU2)), acemi: degerDagilimi(kazancDegerleri(k, kA2)) } });
        const ks = o.kisitli ? ` kısıtlı U ${oranMetni(o.kisitli.usta?.oran ?? null)}${o.kisitli.acemi ? ` A ${oranMetni(o.kisitli.acemi.oran)}` : ''}` : '';
        const isaret = { bantta: 'bantta', payda: 'PAYDA (±5)', disinda: 'BANT DIŞI', olculemedi: 'ölçülemedi' }[o.durum];
        console.log(
          `  ${KADEME_HARFI[o.kademe]} ${(o.metin + (k.sans ? ' (şans)' : '')).padEnd(42)} U ${oranMetni(o.usta.oran)}  A ${oranMetni(o.acemi?.oran ?? null)}${ks}  → ${oranMetni(o.oran)} (bant ${bantMetni(o)}${o.yedek ? ', yedek' : ''}) ${isaret}`,
        );
        if (oneri) console.log(`      öneri: enAz ${oneri.enAz} → U ${oranMetni(oneri.usta)} A ${oranMetni(oneri.acemi)}  "${muhurMetni({ ...k, enAz: oneri.enAz, metin: undefined })}"`);
      });
      // Ek adaylar (dosyadan): doğal oranlar.
      for (const k of aday?.(v.id) ?? []) {
        const dU = kazancDegerleri(k, oU);
        const dA = kazancDegerleri(k, oA);
        const oran = (d: number[]): number | null => (d.length ? (100 * d.filter((x) => (k.enAz === undefined || x >= k.enAz) && (k.enCok === undefined || x <= k.enCok)).length) / d.length : null);
        const s = { kosul: k, metin: muhurMetni(k), usta: oran(dU), acemi: oran(dA) };
        rapor.adaylar.push(s);
        console.log(`  aday ${s.metin.padEnd(40)} U ${oranMetni(s.usta)}  A ${oranMetni(s.acemi)}${k.enCok !== undefined ? ' (doğal oran; kısıt için kısıtlı bot gerekir)' : ''}`);
      }
      // Katalog: bölüm öğelerine göre adaylar ve kademe başına önerilen eşik.
      if (a.katalog) {
        console.log(`  Katalog (Ç: Acemi ≥ 45 en zor eşik, K: Usta ~45, U: Usta ~16; oranlar Usta/Acemi kazançlarında):`);
        for (const b of adayKatalogu(v)) {
          const k = { ...b, enAz: 1 } as MuhurKosulu;
          const dU = kazancDegerleri(k, oU);
          const dA = kazancDegerleri(k, oA);
          rapor.katalog.push({ kosul: { ...b, enAz: 1 } as MuhurKosulu, usta: degerDagilimi(dU), acemi: degerDagilimi(dA) });
          const parca = MUHUR_KADEMELERI.map((kd) => {
            const e = esikOnerisi(kd, dU, dA.length ? dA : null);
            return `${KADEME_HARFI[kd]} ${e ? `${String(e.enAz).padStart(2)}: U ${oranMetni(e.usta)} A ${oranMetni(e.acemi)}` : '        —        '}`;
          });
          const ad = muhurMetni({ ...k, enAz: 99 }).replace('99', 'N');
          console.log(`    ${ad.padEnd(36)} ${parca.join(' │ ')}`);
        }
      }
      // Kısıt adayları kataloğun dışında: kısıtlı bot gerekir (yalnız mühür olarak yazılınca ölçülür).
      raporlar.push(rapor);
    }
  } finally {
    await havuz.kapat();
  }
  console.log(
    `\n${secili.length} bölüm, ${raporlar.reduce((t, r) => t + r.muhurler.length, 0)} mühür: ${sayac.bantta} bantta, ${sayac.payda} payda (±5), ${sayac.disinda} bant dışı, ${sayac.olculemedi} ölçülemedi; ${((Date.now() - t0) / 1000).toFixed(0)} sn.`,
  );
  if (a.json) writeFileSync(a.json, JSON.stringify(raporlar, null, 2));
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
  else if (a.kip === 'muhur') kod = await muhurKip(a);
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
