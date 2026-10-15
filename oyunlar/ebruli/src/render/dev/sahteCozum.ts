/**
 * SAHTE çözücü (yalnız geliştirme ve çizici testleri): çekirdek (P1) gelene
 * kadar çiziciyi gerçekçi olay listeleriyle beslemek için GDD §4'ün
 * sadeleştirilmiş bir uygulaması. Çapraz kayma, garanti, ölü tahta
 * karıştırması ve birleşimlerin ayrıntıları yoktur; olay sözlüğü ve "tahta
 * etkisi" sözleşmeye (src/core/types.ts) uyar. Dev sayfaları ve
 * `gorselTahta.test.ts` bunu kullanır; oyunda gerçek çekirdek çalışır.
 */
import { agirlikliSec, damla, durumKopyala, gruplariBul, hamleHatasi, karisikMi, SABIT } from '../../core/index';
import type { Damla, Hamle, HamleSonucu, KarisikRenk, KomboTuru, Konum, Olay, Onizleme, OyunDurumu, OzelTur, Renk, TemizlikNedeni, Yon } from '../../core/types';

const DOGUM_SIRASI: readonly Renk[] = [1, 2, 4, 3, 5, 6];

interface Cozucu {
  d: OyunDurumu;
  olaylar: Olay[];
  t: number;
  dogum: boolean;
  /** Bu adımda temizlenen hücreler (bir hücre bir kez). */
  temiz: Set<number>;
  /** Önizleme: temizlenen bütün hücreler. */
  tumTemiz: Konum[];
  yeniId: number;
  ozelHayalet: Onizleme['ozelHayalet'];
  etkiAlani: Konum[];
  kombo: KomboTuru | null;
  ilkGruplar: Onizleme['gruplar'] | null;
  sonucId: number;
  temizlenen: number;
  enUzunK: number;
  eslesme: boolean;
}

const idx = (d: OyunDurumu, k: Konum) => k.y * d.w + k.x;
const icinde = (d: OyunDurumu, x: number, y: number) => x >= 0 && y >= 0 && x < d.w && y < d.h;

type Zincir = { k: Konum; ozel: OzelTur; yon: Yon }[];

function temizle(cz: Cozucu, k: Konum, neden: TemizlikNedeni, kk: number, puan: number, t: number, zincir: Zincir | null): void {
  const d = cz.d;
  const i = idx(d, k);
  const h = d.hucreler[i];
  if (cz.temiz.has(i)) return;
  if (h.icerik?.tur === 'mermer') {
    const kalan = (h.icerik.can - 1) as 0 | 1 | 2;
    cz.olaylar.push({ t, tur: 'mermerHasar', hucre: { ...k }, kalan });
    cz.olaylar.push({ t, tur: 'puanEklendi', miktar: SABIT.PUAN.mermerCan, neden: 'engel', hucre: { ...k } });
    d.puan += SABIT.PUAN.mermerCan;
    if (kalan === 0) h.icerik = null;
    else h.icerik.can = kalan as 1 | 2;
    cz.temiz.add(i);
    return;
  }
  const dm = damla(h);
  if (!dm) return;
  cz.temiz.add(i);
  if (dm.ozel !== 'yok' && zincir && neden !== 'grup') {
    // Alanda kalan özel taş da ateşlenir (BFS; "ilk plan kazanır").
    zincir.push({ k: { ...k }, ozel: dm.ozel, yon: dm.yon });
  }
  cz.olaylar.push({ t, tur: 'temizlendi', hucre: { ...k }, id: dm.id, renk: dm.renk, ozel: dm.ozel, neden, k: kk, puan });
  d.puan += puan;
  h.icerik = null;
  cz.tumTemiz.push({ ...k });
  cz.temizlenen++;
  if (h.kagit > 0) {
    h.kagit = (h.kagit - 1) as 0 | 1;
    cz.olaylar.push({ t, tur: 'kagitAlindi', hucre: { ...k }, kalan: h.kagit as 0 | 1, renk: dm.renk });
    d.puan += SABIT.PUAN.kagitKat;
    cz.olaylar.push({ t, tur: 'puanEklendi', miktar: SABIT.PUAN.kagitKat, neden: 'engel', hucre: { ...k } });
    hedefIlerlet(cz, 'kagit', 1, t);
  }
  if (h.yag) {
    h.yag = false;
    cz.olaylar.push({ t, tur: 'yagKalkti', hucre: { ...k } });
    d.puan += SABIT.PUAN.yag;
    cz.olaylar.push({ t, tur: 'puanEklendi', miktar: SABIT.PUAN.yag, neden: 'engel', hucre: { ...k } });
  }
  if (h.desen && !h.desenBoyali && h.desen === dm.renk) {
    h.desenBoyali = true;
    cz.olaylar.push({ t, tur: 'desenBoyandi', hucre: { ...k }, renk: h.desen as KarisikRenk });
    d.puan += SABIT.PUAN.desen;
    cz.olaylar.push({ t, tur: 'puanEklendi', miktar: SABIT.PUAN.desen, neden: 'desen', hucre: { ...k } });
    hedefIlerlet(cz, 'desen', 1, t);
  }
  if (karisikMi(dm.renk)) hedefIlerlet(cz, 'topla', 1, t, dm.renk);
}

function hedefIlerlet(cz: Cozucu, tur: string, n: number, t: number, renk?: number): void {
  cz.d.hedefler.forEach((h, i) => {
    if (h.tamam || h.hedef.tur !== tur) return;
    if (h.hedef.tur === 'topla' && h.hedef.renk !== renk) return;
    h.ilerleme = Math.min(h.gerekli, h.ilerleme + n);
    h.tamam = h.ilerleme >= h.gerekli;
    cz.olaylar.push({ t, tur: 'hedefIlerledi', indeks: i, deger: h.ilerleme, tamam: h.tamam });
  });
}

function ozelAlan(d: OyunDurumu, k: Konum, ozel: OzelTur, yon: Yon, hedefRenk?: number): Konum[] {
  const out: Konum[] = [];
  const ekle = (x: number, y: number) => {
    if (!icinde(d, x, y) || d.hucreler[y * d.w + x].delik) return;
    out.push({ x, y });
  };
  if (ozel === 'tarak') {
    if (yon === 'yatay') for (let x = 0; x < d.w; x++) ekle(x, k.y);
    else for (let y = 0; y < d.h; y++) ekle(k.x, y);
  } else if (ozel === 'girdap') {
    for (let y = k.y - 2; y <= k.y + 2; y++) for (let x = k.x - 2; x <= k.x + 2; x++) if (Math.abs(x - k.x) + Math.abs(y - k.y) <= 2) ekle(x, y);
  } else if (ozel === 'murekkep') {
    for (let y = k.y - 1; y <= k.y + 1; y++) for (let x = k.x - 1; x <= k.x + 1; x++) ekle(x, y);
  } else if (ozel === 'lale') {
    ekle(k.x, k.y);
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const dm = damla(d.hucreler[y * d.w + x]);
        if (dm && dm.ozel === 'yok' && dm.renk === hedefRenk) ekle(x, y);
      }
  }
  return out;
}

/** Özel taşı ateşle (BFS zinciriyle). */
function ates(cz: Cozucu, k: Konum, ozel: OzelTur, yon: Yon, kk: number, hedefRenk?: number): void {
  const d = cz.d;
  const kuyruk: { k: Konum; ozel: OzelTur; yon: Yon; t: number; hedefRenk?: number }[] = [{ k, ozel, yon, t: cz.t, hedefRenk }];
  let tSon = cz.t;
  let n = 0;
  while (kuyruk.length && n++ < 30) {
    const q = kuyruk.shift()!;
    const alan = ozelAlan(d, q.k, q.ozel, q.yon, q.hedefRenk);
    if (!cz.etkiAlani.length) cz.etkiAlani = alan.map((a) => ({ ...a }));
    const merkezRenk = damla(d.hucreler[idx(d, q.k)])?.renk ?? 0;
    cz.olaylar.push({ t: q.t, tur: 'ozelTetiklendi', hucre: { ...q.k }, ozel: q.ozel, yon: q.yon, hedefRenk: q.hedefRenk as Renk | undefined, alan: alan.map((a) => ({ ...a })) });
    let sx = 0;
    let sy = 0;
    const zincir: Zincir = [];
    alan.forEach((a, i) => {
      const dd = Math.abs(a.x - q.k.x) + Math.abs(a.y - q.k.y);
      const tt = q.ozel === 'tarak' ? q.t + 25 * dd : q.ozel === 'girdap' ? q.t + 120 : q.ozel === 'lale' ? q.t + 300 + 30 * i : q.t + 60;
      tSon = Math.max(tSon, tt);
      sx += a.x;
      sy += a.y;
      const neden: TemizlikNedeni = q.ozel === 'tarak' ? 'tarak' : q.ozel === 'girdap' ? 'girdap' : q.ozel === 'lale' ? 'lale' : 'murekkep';
      const merkezMi = a.x === q.k.x && a.y === q.k.y;
      temizle(cz, a, neden, kk, q.ozel === 'murekkep' ? SABIT.PUAN.murekkepDamla : SABIT.PUAN.ozelDamla, tt, merkezMi ? null : zincir);
    });
    d.gunluk.push({ hamle: d.hamleNo - 1, k: kk, tur: q.ozel === 'yok' ? 'grup' : (q.ozel as 'tarak'), x10: Math.round((sx / Math.max(1, alan.length)) * 10), y10: Math.round((sy / Math.max(1, alan.length)) * 10), renk: (merkezRenk || (q.hedefRenk ?? 0)) as Renk | 0, boyut: alan.length, yon: q.ozel === 'tarak' ? q.yon : undefined });
    if (q.ozel === 'tarak') d.istatistik.tarak++;
    for (const z of zincir) {
      if (z.ozel === 'lale') continue;
      kuyruk.push({ k: z.k, ozel: z.ozel, yon: z.yon, t: tSon + 150, hedefRenk: undefined });
    }
  }
  cz.t = tSon + 250;
}

/** Düz yerçekimi (çapraz kayma yok) + isteğe bağlı dolum. */
function yercekimi(cz: Cozucu, dolum: boolean): boolean {
  const d = cz.d;
  const dusenler: { den: Konum; e: Konum }[] = [];
  const doganlar: { hucre: Konum; damla: Damla; sanalY: number }[] = [];
  for (let x = 0; x < d.w; x++) {
    let bos = d.h - 1;
    for (let y = d.h - 1; y >= 0; y--) {
      const h = d.hucreler[y * d.w + x];
      if (h.delik || h.icerik?.tur === 'mermer') {
        bos = y - 1;
        continue;
      }
      if (h.icerik) {
        if (bos !== y) {
          const e = d.hucreler[bos * d.w + x];
          e.icerik = h.icerik;
          h.icerik = null;
          dusenler.push({ den: { x, y }, e: { x, y: bos } });
        }
        bos--;
      }
    }
    if (dolum) {
      // Yalnız tepeden açık kısım dolar; sanalY: en alttaki yuvanın doğanı −1, üstündekiler −2, −3…
      const bosYuvalar: number[] = [];
      for (let y = 0; y < d.h; y++) {
        const h = d.hucreler[y * d.w + x];
        if (h.delik || h.icerik?.tur === 'mermer' || h.icerik) break;
        bosYuvalar.push(y);
      }
      const n = bosYuvalar.length;
      for (let j = n - 1; j >= 0; j--) {
        const y = bosYuvalar[j];
        const renk = DOGUM_SIRASI[agirlikliSec(d, d.dogumAgirliklari)];
        const dm: Damla = { id: d.sonrakiId++, renk, ozel: 'yok', yon: 'yatay' };
        d.hucreler[y * d.w + x].icerik = { tur: 'damla', damla: dm };
        doganlar.push({ hucre: { x, y }, damla: { ...dm }, sanalY: y - n });
      }
    }
  }
  if (!dusenler.length && !doganlar.length) return false;
  cz.olaylar.push({ t: cz.t, tur: 'yercekimi', dusenler, doganlar });
  cz.t += SABIT.ZAMAN.yercekimi;
  return true;
}

/** Hamle (sahte): olaylar + sonraki durum. `dogum` false → önizleme (doğumsuz). */
function coz(d0: OyunDurumu, h: Hamle, dogum: boolean): Cozucu {
  const d = durumKopyala(d0);
  const cz: Cozucu = { d, olaylar: [], t: 0, dogum, temiz: new Set(), tumTemiz: [], yeniId: -1, ozelHayalet: null, etkiAlani: [], kombo: null, ilkGruplar: null, sonucId: -1, temizlenen: 0, enUzunK: 1, eslesme: false };
  const hk = d.hucreler[idx(d, h.kaynak)];
  const he = d.hucreler[idx(d, h.hedef)];
  const a = damla(hk)!;
  const b = damla(he)!;
  d.hamleNo++;
  d.kalanHamle--;
  const yatay = h.kaynak.y === h.hedef.y;
  if (a.ozel === 'yok' && b.ozel === 'yok') {
    const sonuc = (a.renk | b.renk) as Renk;
    const yeniId = d.sonrakiId++;
    cz.olaylar.push({ t: 0, tur: 'karisti', kaynak: { ...h.kaynak }, hedef: { ...h.hedef }, a: a.renk as Renk, b: b.renk as Renk, sonuc, yeniId });
    he.icerik = { tur: 'damla', damla: { id: yeniId, renk: sonuc, ozel: sonuc === 7 ? 'murekkep' : 'yok', yon: 'yatay' } };
    hk.icerik = null;
    cz.yeniId = yeniId;
    cz.sonucId = yeniId;
    cz.t = SABIT.ZAMAN.karisim;
  } else if (a.ozel !== 'yok' && b.ozel !== 'yok') {
    // Özel + özel: birleşim (sadeleştirilmiş: geniş alan).
    cz.olaylar.push({ t: 0, tur: 'ozelSuruklendi', kaynak: { ...h.kaynak }, hedef: { ...h.hedef }, ozel: a.ozel, tasindi: true });
    hk.icerik = null;
    const kombo = komboBul(a.ozel, b.ozel);
    cz.kombo = kombo;
    cz.t = SABIT.ZAMAN.ozelKayma;
    const alan: Konum[] = [];
    const R = kombo === 'girdapGirdap' ? 4 : 3;
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const dx = Math.abs(x - h.hedef.x);
        const dy = Math.abs(y - h.hedef.y);
        const icerde = kombo === 'tarakTarak' ? dx === 0 || dy === 0 : kombo.startsWith('lale') && kombo !== 'laleTarak' && kombo !== 'laleGirdap' ? true : dx + dy <= R;
        if (icerde && !d.hucreler[y * d.w + x].delik) alan.push({ x, y });
      }
    cz.etkiAlani = alan;
    cz.olaylar.push({ t: cz.t, tur: 'birlesim', hucre: { ...h.hedef }, kombo, alan });
    // Yerinden edilen hedef taşı ve taşınan kaynak taşı birlikte kalkar.
    cz.olaylar.push({ t: cz.t, tur: 'temizlendi', hucre: { ...h.hedef }, id: b.id, renk: b.renk, ozel: b.ozel, neden: 'birlesim', k: 1, puan: SABIT.PUAN.ozelDamla });
    d.puan += SABIT.PUAN.ozelDamla;
    he.icerik = null;
    cz.temizlenen++;
    cz.olaylar.push({ t: cz.t, tur: 'puanEklendi', miktar: kombo.includes('lale') ? 600 : 300, neden: 'ozel', hucre: { ...h.hedef } });
    d.puan += kombo.includes('lale') ? 600 : 300;
    d.istatistik.birlesim++;
    for (const k of alan) {
      const dd = Math.abs(k.x - h.hedef.x) + Math.abs(k.y - h.hedef.y);
      temizle(cz, k, 'birlesim', 1, SABIT.PUAN.ozelDamla, cz.t + 150 + 20 * dd, null);
    }
    d.gunluk.push({ hamle: d.hamleNo - 1, k: 1, tur: 'birlesim', x10: h.hedef.x * 10, y10: h.hedef.y * 10, renk: (a.renk || b.renk) as Renk, boyut: alan.length });
    cz.t += 150 + 20 * 8 + 250;
  } else if (a.ozel !== 'yok') {
    if (a.ozel === 'tarak' || a.ozel === 'girdap') {
      cz.olaylar.push({ t: 0, tur: 'ozelSuruklendi', kaynak: { ...h.kaynak }, hedef: { ...h.hedef }, ozel: a.ozel, tasindi: true });
      cz.olaylar.push({ t: SABIT.ZAMAN.ozelKayma, tur: 'temizlendi', hucre: { ...h.hedef }, id: b.id, renk: b.renk, ozel: b.ozel, neden: a.ozel, k: 1, puan: SABIT.PUAN.ozelDamla });
      d.puan += SABIT.PUAN.ozelDamla;
      cz.temizlenen++;
      cz.tumTemiz.push({ ...h.hedef });
      if (karisikMi(b.renk)) hedefIlerlet(cz, 'topla', 1, SABIT.ZAMAN.ozelKayma, b.renk);
      // Taş hedefte tüketilir (P1 anlamı): hedef boşalır, taş orada ateşlenir.
      he.icerik = null;
      hk.icerik = null;
      cz.t = SABIT.ZAMAN.ozelKayma;
      ates(cz, h.hedef, a.ozel, a.yon, 1);
    } else {
      cz.olaylar.push({ t: 0, tur: 'ozelSuruklendi', kaynak: { ...h.kaynak }, hedef: { ...h.hedef }, ozel: a.ozel, tasindi: false });
      cz.t = SABIT.ZAMAN.ozelKayma;
      ates(cz, h.kaynak, a.ozel, a.yon, 1, a.ozel === 'lale' ? b.renk : undefined);
    }
  } else {
    cz.olaylar.push({ t: 0, tur: 'ozelSuruklendi', kaynak: { ...h.kaynak }, hedef: { ...h.hedef }, ozel: b.ozel, tasindi: false, ters: true });
    cz.t = SABIT.ZAMAN.ozelKayma;
    ates(cz, h.hedef, b.ozel, b.yon, 1, b.ozel === 'lale' ? a.renk : undefined);
  }
  // Çözümleme döngüsü.
  for (let k = 1; k <= SABIT.KASKAT_SINIRI; k++) {
    cz.temiz.clear();
    yercekimi(cz, false);
    let gruplar = gruplariBul(d);
    if (!gruplar.length) {
      if (!dogum) break;
      const dustu = yercekimi(cz, true);
      if (!dustu) break;
      gruplar = gruplariBul(d);
      if (!gruplar.length) break;
    }
    const konumlar = gruplar.map((g) => ({ renk: g.renk, hucreler: g.hucreler.map((i) => ({ x: i % d.w, y: Math.floor(i / d.w) })) }));
    if (!cz.ilkGruplar) cz.ilkGruplar = konumlar.map((g) => ({ renk: g.renk, hucreler: g.hucreler.map((c) => ({ ...c })) }));
    cz.eslesme = true;
    cz.enUzunK = Math.max(cz.enUzunK, k);
    if (k >= 2) cz.olaylar.push({ t: cz.t, tur: 'kaskat', k, kademe: k === 2 ? 'guzel' : k === 3 ? 'nefis' : k === 4 ? 'harika' : 'saheser' });
    for (const g of konumlar) {
      const mx = g.hucreler.reduce((s, c) => s + c.x, 0) / g.hucreler.length;
      const my = g.hucreler.reduce((s, c) => s + c.y, 0) / g.hucreler.length;
      cz.olaylar.push({ t: cz.t, tur: 'eslesti', renk: g.renk, hucreler: g.hucreler.map((c) => ({ ...c })), k, merkez: { x: Math.round(mx * 10) / 10, y: Math.round(my * 10) / 10 } });
      d.gunluk.push({ hamle: d.hamleNo - 1, k, tur: 'grup', x10: Math.round(mx * 10), y10: Math.round(my * 10), renk: g.renk, boyut: g.hucreler.length });
    }
    cz.t += SABIT.ZAMAN.toplanma;
    const tetik: { k: Konum; ozel: OzelTur; yon: Yon }[] = [];
    const uretim: { yer: Konum; dm: Damla }[] = [];
    for (const g of konumlar) {
      // Özel taş üretimi (yer: yeni damla ya da en alt soldaki).
      const [et, eg, el] = d.kurallar.ozelEsikleri;
      const n = g.hucreler.length;
      const ozel: OzelTur = n >= el ? 'lale' : n >= eg ? 'girdap' : n >= et ? 'tarak' : 'yok';
      if (ozel !== 'yok') {
        let yer = g.hucreler.find((c) => damla(d.hucreler[idx(d, c)])?.id === cz.yeniId);
        if (!yer) {
          const enAlt = Math.max(...g.hucreler.map((c) => c.y));
          yer = g.hucreler.filter((c) => c.y === enAlt).sort((p, q) => p.x - q.x)[0];
        }
        const xs = g.hucreler.map((c) => c.x);
        const ys = g.hucreler.map((c) => c.y);
        const gen = Math.max(...xs) - Math.min(...xs);
        const boy = Math.max(...ys) - Math.min(...ys);
        const yon: Yon = gen > boy ? 'yatay' : boy > gen ? 'dikey' : yatay ? 'yatay' : 'dikey';
        uretim.push({ yer, dm: { id: d.sonrakiId++, renk: ozel === 'lale' ? 0 : g.renk, ozel, yon: ozel === 'tarak' ? yon : 'yatay' } });
        if (!cz.ozelHayalet) cz.ozelHayalet = { hucre: { ...yer }, ozel, yon: ozel === 'tarak' ? yon : 'yatay', renk: ozel === 'lale' ? 0 : g.renk };
      }
      for (const c of g.hucreler) {
        const dm = damla(d.hucreler[idx(d, c)]);
        if (dm && (dm.ozel === 'tarak' || dm.ozel === 'girdap')) tetik.push({ k: c, ozel: dm.ozel, yon: dm.yon });
        temizle(cz, c, 'grup', k, SABIT.PUAN.grupDamla * k, cz.t, null);
      }
    }
    for (const u of uretim) {
      d.hucreler[idx(d, u.yer)].icerik = { tur: 'damla', damla: u.dm };
      cz.olaylar.push({ t: cz.t, tur: 'ozelOlustu', hucre: { ...u.yer }, damla: { ...u.dm } });
      const bonus = u.dm.ozel === 'lale' ? SABIT.PUAN.lale : u.dm.ozel === 'girdap' ? SABIT.PUAN.girdap : SABIT.PUAN.tarak;
      cz.olaylar.push({ t: cz.t, tur: 'puanEklendi', miktar: bonus, neden: 'ozel', hucre: { ...u.yer } });
      d.puan += bonus;
      if (u.dm.ozel === 'girdap') d.istatistik.girdap++;
      if (u.dm.ozel === 'lale') d.istatistik.lale++;
    }
    cz.t += SABIT.ZAMAN.yayilma;
    for (const tt of tetik) {
      cz.t += SABIT.ZAMAN.zincir;
      // Hücre zaten temizlendi: alanı yine ateşle (taşın kendi temizliği grup olayında).
      ates(cz, tt.k, tt.ozel, tt.yon, k);
    }
  }
  // Hamle sonu.
  const hepsi = d.hedefler.every((x) => x.tamam);
  d.hedefler.forEach((x, i) => {
    if (x.hedef.tur === 'puan' && !x.tamam) {
      x.ilerleme = Math.min(x.gerekli, d.puan);
      x.tamam = d.puan >= x.gerekli;
      cz.olaylar.push({ t: cz.t, tur: 'hedefIlerledi', indeks: i, deger: x.ilerleme, tamam: x.tamam });
    }
  });
  if (hepsi && d.hedefler.length) {
    d.bitti = 'kazanc';
    cz.olaylar.push({ t: cz.t, tur: 'bolumBitti', sonuc: 'kazanc' });
  } else if (d.kalanHamle <= 0) {
    d.bitti = 'kayip';
    cz.olaylar.push({ t: cz.t, tur: 'bolumBitti', sonuc: 'kayip' });
  }
  const ort = cz.tumTemiz.length ? { x: cz.tumTemiz.reduce((s, c) => s + c.x, 0) / cz.tumTemiz.length, y: cz.tumTemiz.reduce((s, c) => s + c.y, 0) / cz.tumTemiz.length } : { ...h.hedef };
  cz.olaylar.push({ t: cz.t, tur: 'hamleOzeti', temizlenen: cz.temizlenen, kaskat: cz.enUzunK, eslesme: cz.eslesme, merkez: ort });
  if (cz.eslesme) d.istatistik.eslesenHamle++;
  d.istatistik.temizlenenDamla += cz.temizlenen;
  d.istatistik.enUzunKaskat = Math.max(d.istatistik.enUzunKaskat, cz.enUzunK);
  // Olaylar t'ye göre azalmayan (kararlı sıralama).
  cz.olaylar = cz.olaylar.map((o, i) => ({ o, i })).sort((p, q) => p.o.t - q.o.t || p.i - q.i).map((x) => x.o);
  // Sıralama sonrası hedef değerleri zaman sırasıyla yeniden say (her olay +1).
  const sayac = d0.hedefler.map((x) => x.ilerleme);
  for (const o of cz.olaylar) {
    if (o.tur !== 'hedefIlerledi') continue;
    const hd = d.hedefler[o.indeks];
    if (hd.hedef.tur === 'puan') continue;
    sayac[o.indeks] = Math.min(hd.gerekli, sayac[o.indeks] + 1);
    o.deger = sayac[o.indeks];
    o.tamam = o.deger >= hd.gerekli;
  }
  return cz;
}

function komboBul(a: OzelTur, b: OzelTur): KomboTuru {
  const s = [a, b].sort().join('+');
  const tablo: Record<string, KomboTuru> = {
    'tarak+tarak': 'tarakTarak',
    'girdap+tarak': 'tarakGirdap',
    'girdap+girdap': 'girdapGirdap',
    'lale+tarak': 'laleTarak',
    'girdap+lale': 'laleGirdap',
    'lale+lale': 'laleLale',
    'murekkep+tarak': 'murekkepTarak',
    'girdap+murekkep': 'murekkepGirdap',
    'lale+murekkep': 'murekkepLale',
    'murekkep+murekkep': 'murekkepMurekkep',
  };
  return tablo[s] ?? 'tarakTarak';
}

export function sahteHamle(d: OyunDurumu, h: Hamle): HamleSonucu {
  const hata = hamleHatasi(d, h);
  if (hata) throw new Error(`geçersiz hamle: ${hata}`);
  const cz = coz(d, h, true);
  return { durum: cz.d, olaylar: cz.olaylar };
}

export function sahteOnizle(d: OyunDurumu, h: Hamle): Onizleme {
  const hata = hamleHatasi(d, h);
  if (hata) return { gecerli: false, hata, sonuc: null, sonucHucre: null, gruplar: [], temizlenecek: [], ozelHayalet: null, etkiAlani: [], kombo: null, hedefArtisi: [] };
  const cz = coz(d, h, false);
  const ilk = cz.olaylar.find((o) => o.tur === 'karisti') as Extract<Olay, { tur: 'karisti' }> | undefined;
  let sonucHucre: Konum | null = null;
  if (ilk) {
    sonucHucre = { ...h.hedef };
    const y = cz.olaylar.find((o) => o.tur === 'yercekimi') as Extract<Olay, { tur: 'yercekimi' }> | undefined;
    const m = y?.dusenler.find((x) => x.den.x === h.hedef.x && x.den.y === h.hedef.y);
    if (m) sonucHucre = { ...m.e };
  }
  return {
    gecerli: true,
    hata: null,
    sonuc: ilk ? ilk.sonuc : null,
    sonucHucre,
    gruplar: cz.ilkGruplar ?? [],
    temizlenecek: cz.tumTemiz,
    ozelHayalet: cz.ozelHayalet,
    etkiAlani: ilk ? [] : cz.etkiAlani,
    kombo: cz.kombo,
    hedefArtisi: cz.d.hedefler.map((x, i) => x.ilerleme - d.hedefler[i].ilerleme),
  };
}

/** Geçerli bütün hamleler (bot/dev). */
export function gecerliHamleler(d: OyunDurumu): Hamle[] {
  const out: Hamle[] = [];
  for (let y = 0; y < d.h; y++)
    for (let x = 0; x < d.w; x++)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const h: Hamle = { tur: 'surukle', kaynak: { x, y }, hedef: { x: x + dx, y: y + dy } };
        if (hamleHatasi(d, h) === null) out.push(h);
      }
  return out;
}

/** Açgözlü sahte bot: en çok temizleyen hamle (eşitlikte ilk). Dev sayfaları için. */
export function sahteBotHamle(d: OyunDurumu, rnd: () => number): Hamle | null {
  const hamleler = gecerliHamleler(d);
  if (!hamleler.length) return null;
  let en: Hamle | null = null;
  let enP = -1;
  for (const h of hamleler) {
    const o = sahteOnizle(d, h);
    const p = o.temizlenecek.length + rnd() * 0.5;
    if (p > enP) {
      enP = p;
      en = h;
    }
  }
  return en;
}

