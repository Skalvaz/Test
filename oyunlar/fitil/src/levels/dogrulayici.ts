/**
 * Bölüm doğrulayıcı — statik kurallar (GDD §16.5 "Doğrulayıcı", §8.1).
 * Bot ölçütleri ayrıdır (src/bot/olcut.ts, `npm run dogrula`).
 *
 * Denetlenenler: boyut, eşik, renk, hamle aralıkları; simge geçerliliği;
 * sabit kapsül / ön ısı / döşeme / desen yalnız kapsül hücrelerinde;
 * hedefin nesnesi tahtada var; fener çıkışlarına ulaşılabilir; barut izi
 * komşuluğu; desen renkleri < renkSayısı; başlangıç tahtası kilitsiz
 * (yükleyici karıştırmadı); `yardim > 0` yalnız id ≤ 20; bant, yıldız
 * eşikleri, ipuçları ve zorunlu ilk hamle tutarlılığı.
 *
 * P4a yorumları (§ atıflı):
 *  - Eşik 2 yalnız Usta bölümünde (K1); diğerlerinde 3–5.
 *  - Hamle 12–30 (§8.1); Usta bölümlerinde 5–30 (U5 Domino 8 hamle, §10.2).
 *  - `puan` hedefi yalnız öğretim ve Usta bölümlerinde (§6.11).
 *  - Kapsül hücresi: `.`, `C`, `W` (ıslak kuruyunca kapsül olur).
 *  - Fener ulaşılabilirliği: bütün engeller kırılabilir olduğundan fener
 *    kendi sütununun çıkış yuvasına iner; bu yüzden fenerin sütunu ve
 *    (fener doğumu varsa) dolum alabilen her sütun `cikislar` içinde olmalı.
 *  - Başlangıç kilitsizliği: yükleyici kilitli ilk tahtayı karıştırır
 *    (§8.1 adım 4); tasarlanmış düzen bozulmasın diye karıştırma hata sayılır.
 */
import { bolumuYukle, kilitliMi } from '../core/index';
import type { BolumVerisi, Hedef, OyunDurumu } from '../core/index';

const TURLER = ['ogretim', 'tanitim', 'normal', 'zor', 'rahatlama', 'final', 'usta', 'gunluk', 'sonsuz'] as const;
const MOTIFLER = ['lale', 'kayik', 'mart', 'fener', 'carkifelek', 'burc'] as const;
const TETIKLER = ['baslangic', 'ilkHamleSonrasi', 'bosta5sn', 'kisaYol', 'kazanc'] as const;
const KAPSUL_SIMGE = new Set(['.', 'C', 'W']);

function tamsayi(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x);
}

function aralikta(x: unknown, a: number, b: number): boolean {
  return tamsayi(x) && x >= a && x <= b;
}

function simgeGecerli(s: string): boolean {
  return ['.', '#', 'C', 'W', 'F', 'I', 'K1', 'K2', 'K3', 'S', 'S1', 'S2', 'D'].includes(s) || /^D[1-9]\d*$/.test(s);
}

/** Bütün statik hatalar (boş = geçerli). */
export function bolumDogrula(v: BolumVerisi): string[] {
  const h: string[] = [];
  const hata = (m: string): void => {
    h.push(m);
  };
  const usta = v.tur === 'usta';

  // Kimlik ve tür.
  if (!TURLER.includes(v.tur)) hata(`tür geçersiz: ${v.tur}`);
  if (!tamsayi(v.id)) hata('id tamsayı değil');
  else if (usta && !(v.id >= 101 && v.id <= 108)) hata(`Usta id 101..108 olmalı: ${v.id}`);
  else if (v.tur === 'gunluk' && !(v.id >= 20000101 && v.id <= 99991231)) hata(`günlük id yyyymmdd olmalı: ${v.id}`);
  else if (v.tur === 'sonsuz' && v.id < 1_000_000) hata(`sonsuz id ≥ 1000000 olmalı: ${v.id}`);
  else if (!usta && v.tur !== 'gunluk' && v.tur !== 'sonsuz' && !(v.id >= 1 && v.id <= 40)) hata(`id 1..40 olmalı: ${v.id}`);
  if (typeof v.ad !== 'string' || v.ad.trim() === '') hata('ad boş');
  if (!aralikta(v.mahalle, 0, 7)) hata(`mahalle 0..7: ${v.mahalle}`);

  // Aralıklar (§8.1).
  if (!aralikta(v.w, 5, 8)) hata(`w 5..8: ${v.w}`);
  if (!aralikta(v.h, 6, 10)) hata(`h 6..10: ${v.h}`);
  if (!aralikta(v.renkSayisi, 3, 6)) hata(`renkSayisi 3..6: ${v.renkSayisi}`);
  if (!aralikta(v.esik, usta ? 2 : 3, 5)) hata(`eşik ${usta ? 2 : 3}..5: ${v.esik}`);
  if (!aralikta(v.hamle, usta ? 5 : 12, 30)) hata(`hamle ${usta ? 5 : 12}..30: ${v.hamle}`);
  if (!aralikta(v.tohum, 0, 0xffffffff)) hata(`tohum uint32 değil: ${v.tohum}`);
  if (!aralikta(v.yardim, 0, 3)) hata(`yardım 0..3: ${v.yardim}`);
  else if (v.yardim > 0 && !(v.id >= 1 && v.id <= 20 && !usta)) hata('yardım > 0 yalnız id ≤ 20 (K10)');
  if (!Array.isArray(v.ozelEsikleri) || v.ozelEsikleri.length !== 3) hata('ozelEsikleri 3 öğe olmalı');
  else {
    const acik = v.ozelEsikleri.filter((e) => e !== 0);
    if (!v.ozelEsikleri.every((e) => e === 0 || aralikta(e, 3, 99))) hata(`ozelEsikleri 0 ya da ≥ 3: ${v.ozelEsikleri}`);
    for (let k = 1; k < acik.length; k++) if (acik[k] <= acik[k - 1]) hata(`ozelEsikleri artan olmalı: ${v.ozelEsikleri}`);
  }
  if (v.dogumAgirliklari) {
    const a = v.dogumAgirliklari;
    if (a.length !== v.renkSayisi) hata(`dogumAgirliklari ${a.length} öğe, renkSayisi ${v.renkSayisi}`);
    if (!a.every((x) => aralikta(x, 0, 1e6)) || a.reduce((s, x) => s + x, 0) <= 0) hata('dogumAgirliklari negatif olmayan tamsayılar, toplam > 0');
  }

  // Düzen.
  if (!Array.isArray(v.duzen) || v.duzen.length !== v.h) {
    hata(`düzen ${v.duzen?.length} satır, h=${v.h}`);
    return h;
  }
  const izgara: string[][] = [];
  for (let y = 0; y < v.h; y++) {
    const s = v.duzen[y].trim().split(/\s+/);
    if (s.length !== v.w) hata(`düzen satır ${y}: ${s.length} simge, w=${v.w}`);
    for (let x = 0; x < s.length; x++) if (!simgeGecerli(s[x])) hata(`düzen (${x},${y}): bilinmeyen simge "${s[x]}"`);
    izgara.push(s);
  }
  if (h.length) return h;
  const icinde = (x: number, y: number): boolean => tamsayi(x) && tamsayi(y) && x >= 0 && y >= 0 && x < v.w && y < v.h;
  const simge = (x: number, y: number): string => izgara[y][x];
  const kapsulHucresi = (x: number, y: number): boolean => icinde(x, y) && KAPSUL_SIMGE.has(simge(x, y));
  const say = (f: (s: string) => boolean): number => izgara.reduce((t, r) => t + r.filter(f).length, 0);

  // Sabit kapsüller ve ön ısı.
  const sabitGorulen = new Set<string>();
  for (const s of v.sabitKapsuller ?? []) {
    const yer = `(${s.x},${s.y})`;
    if (!kapsulHucresi(s.x, s.y)) {
      hata(`sabit kapsül kapsül hücresinde değil ${yer}`);
      continue;
    }
    if (sabitGorulen.has(yer)) hata(`sabit kapsül yineleniyor ${yer}`);
    sabitGorulen.add(yer);
    if (!aralikta(s.renk, -1, v.renkSayisi - 1)) hata(`sabit kapsül rengi ${s.renk} ${yer}`);
    if (s.renk === -1 && s.ozel && s.ozel !== 'yildiz') hata(`renk −1 yalnız yıldız topu ${yer}`);
    if (s.ozel && !['roket', 'kasimpati', 'yildiz'].includes(s.ozel)) hata(`sabit kapsül özel türü ${s.ozel} ${yer}`);
    if (s.eksen !== undefined && !aralikta(s.eksen, 0, 3)) hata(`sabit kapsül ekseni ${s.eksen} ${yer}`);
    if (s.isi !== undefined && !aralikta(s.isi, 0, v.esik - 1)) hata(`sabit kapsül ısısı ${s.isi} ${yer}`);
    if (simge(s.x, s.y) === 'W' && (s.ozel || s.isi)) hata(`ıslak hücrede özel/ısı olmaz ${yer}`);
  }
  for (const o of v.onIsi ?? []) {
    const [x, y, isi] = o;
    if (!icinde(x, y) || !['.', 'C'].includes(simge(x, y))) hata(`ön ısı kapsül hücresinde değil (${x},${y})`);
    else if (!aralikta(isi, 1, v.esik - 1)) hata(`ön ısı 1..${v.esik - 1}: ${isi} (${x},${y})`);
  }

  // Zemin.
  const dosemeler = v.zemin?.dosemeler ?? [];
  const dosGorulen = new Set<string>();
  for (const [x, y, kat] of dosemeler) {
    if (!kapsulHucresi(x, y)) hata(`döşeme kapsül hücresinde değil (${x},${y})`);
    if (kat !== 1 && kat !== 2) hata(`döşeme katı 1|2: ${kat} (${x},${y})`);
    if (dosGorulen.has(`${x},${y}`)) hata(`döşeme yineleniyor (${x},${y})`);
    dosGorulen.add(`${x},${y}`);
  }
  const desen = v.zemin?.desen;
  if (desen) {
    if (!MOTIFLER.includes(desen.motif)) hata(`desen motifi geçersiz: ${desen.motif}`);
    const g = new Set<string>();
    for (const [x, y, renk] of desen.hucreler) {
      if (!kapsulHucresi(x, y)) hata(`desen kapsül hücresinde değil (${x},${y})`);
      if (!aralikta(renk, 0, v.renkSayisi - 1)) hata(`desen rengi ${renk} ≥ renkSayısı (${x},${y})`);
      if (g.has(`${x},${y}`)) hata(`desen hücresi yineleniyor (${x},${y})`);
      g.add(`${x},${y}`);
    }
  }
  const izGorulen = new Set<string>();
  (v.zemin?.barutIzleri ?? []).forEach((iz, k) => {
    if (iz.length < 2) hata(`barut izi ${k}: en az 2 hücre`);
    iz.forEach(([x, y], j) => {
      if (!icinde(x, y) || simge(x, y) === '#') hata(`barut izi ${k}: (${x},${y}) tahta dışında/delikte`);
      if (izGorulen.has(`${x},${y}`)) hata(`barut izi ${k}: (${x},${y}) birden çok kez`);
      izGorulen.add(`${x},${y}`);
      if (j > 0) {
        const [px, py] = iz[j - 1];
        if (Math.max(Math.abs(px - x), Math.abs(py - y)) !== 1) hata(`barut izi ${k}: (${px},${py})–(${x},${y}) 8-komşu değil`);
      }
    });
  });

  // Fener çıkışları (§5).
  const cikislar = v.cikislar ?? Array.from({ length: v.w }, (_, x) => x);
  const sutunVar = (x: number): boolean => izgara.some((r) => r[x] !== '#');
  for (const x of cikislar) if (!aralikta(x, 0, v.w - 1) || !sutunVar(x)) hata(`çıkış sütunu geçersiz: ${x}`);
  for (let y = 0; y < v.h; y++)
    for (let x = 0; x < v.w; x++) if (simge(x, y) === 'F' && !cikislar.includes(x)) hata(`fener (${x},${y}) çıkışa ulaşamaz (sütun ${x} çıkış değil)`);
  if (v.fenerDogum) {
    if (!aralikta(v.fenerDogum.kalan, 0, 99) || !aralikta(v.fenerDogum.sahadaEnFazla, 1, 99)) hata('fenerDogum değerleri geçersiz');
    if (v.fenerDogum.kalan > 0) for (let x = 0; x < v.w; x++) if (sutunVar(x) && !cikislar.includes(x)) hata(`fener doğabilen sütun ${x} çıkış değil`);
  }
  if (v.devFisekKapasite !== undefined && !aralikta(v.devFisekKapasite, 1, 20)) hata(`devFisekKapasite: ${v.devFisekKapasite}`);
  for (const o of v.havaOlaylari ?? []) {
    if (o.tur !== 'meltem' && o.tur !== 'cisenti') hata(`hava türü: ${o.tur}`);
    if (o.eksen !== 'satir' && o.eksen !== 'sutun') hata(`hava ekseni: ${o.eksen}`);
    const sinir = o.eksen === 'satir' ? v.h : v.w;
    if (!o.hatlar.length || !o.hatlar.every((x) => aralikta(x, 0, sinir - 1))) hata(`hava hatları ${o.hatlar} (0..${sinir - 1})`);
    if (!aralikta(o.periyot, 1, 99) || !aralikta(o.baslangic, 1, 99)) hata('hava periyot/başlangıç ≥ 1');
  }
  if (v.korukKapasitesi !== undefined && !aralikta(v.korukKapasitesi, 0, 99)) hata(`korukKapasitesi: ${v.korukKapasitesi}`);
  const kur = v.kurallar ?? {};
  if (kur.caprazSiniri != null && !aralikta(kur.caprazSiniri, 0, 99)) hata(`caprazSiniri: ${kur.caprazSiniri}`);
  if (kur.soguma !== undefined && !aralikta(kur.soguma, 0, 99)) hata(`soguma: ${kur.soguma}`);

  // Hedefler (§6): 1..3 ve nesnesi tahtada.
  if (!Array.isArray(v.hedefler) || v.hedefler.length < 1 || v.hedefler.length > 3) hata(`hedef sayısı 1..3: ${v.hedefler?.length}`);
  for (const hd of v.hedefler ?? []) hedefDenetle(v, hd, say, hata);

  // Bant ve yıldızlar (§8.2, §7.4).
  const [bMin, bMax] = v.botBandi ?? [];
  if (!aralikta(bMin, 0, 100) || !aralikta(bMax, 0, 100) || bMin > bMax) hata(`botBandi geçersiz: ${v.botBandi}`);
  else if (bMin < 35) hata(`botBandi alt sınırı %35'in altında: ${bMin}`);
  const [p50, p85] = v.yildizEsikleri ?? [];
  if (!aralikta(p50, 0, 1e7) || !aralikta(p85, 0, 1e7) || p50 > p85) hata(`yildizEsikleri geçersiz: ${v.yildizEsikleri}`);

  // İpuçları ve zorunlu ilk hamle (§15).
  for (const ip of v.ipuclari ?? []) {
    if (!TETIKLER.includes(ip.tetik)) hata(`ipucu tetiği: ${ip.tetik}`);
    if (typeof ip.metin !== 'string' || !ip.metin.trim()) hata('ipucu metni boş');
    for (const [x, y] of ip.el ?? []) if (!icinde(x, y)) hata(`ipucu el yolu tahta dışında (${x},${y})`);
  }
  for (const [x, y] of v.zorunluIlkHamle ?? []) if (!kapsulHucresi(x, y)) hata(`zorunluIlkHamle kapsül hücresinde değil (${x},${y})`);
  if (h.length) return h;

  // Yükleme, kilit ve karıştırma.
  let d: OyunDurumu;
  try {
    d = bolumuYukle(v, 0);
  } catch (e) {
    hata(`yüklenemedi: ${e instanceof Error ? e.message : e}`);
    return h;
  }
  if (kilitliMi(d)) hata('başlangıç tahtası kilitli');
  if (karistirildi(v, d)) hata('ilk tahta kilitliydi ve yükleyici karıştırdı (tohumu değiştir)');
  if (v.zorunluIlkHamle?.length && !zorunluYolVar(d, v.zorunluIlkHamle)) hata('zorunluIlkHamle hücrelerinde ≥ 3 düğümlü geçerli yol yok');
  return h;
}

function hedefDenetle(v: BolumVerisi, hd: Hedef, say: (f: (s: string) => boolean) => number, hata: (m: string) => void): void {
  switch (hd.tur) {
    case 'topla':
      if (hd.renk !== 'hepsi' && !aralikta(hd.renk, 0, v.renkSayisi - 1)) hata(`topla rengi ${hd.renk} ≥ renkSayısı`);
      if (!aralikta(hd.adet, 1, 9999)) hata(`topla adedi: ${hd.adet}`);
      if (hd.renk !== 'hepsi' && v.dogumAgirliklari && v.dogumAgirliklari[hd.renk] === 0) hata(`topla rengi ${hd.renk} hiç doğmuyor`);
      break;
    case 'kafes':
      if (say((s) => s === 'C') === 0) hata('kafes hedefi var ama kafes yok');
      break;
    case 'kaya':
      if (say((s) => /^K[123]$/.test(s)) === 0) hata('kaya hedefi var ama kaya yok');
      break;
    case 'aydinlat':
      if (!(v.zemin?.dosemeler?.length ?? 0)) hata('aydınlat hedefi var ama döşeme yok');
      break;
    case 'desen':
      if (!(v.zemin?.desen?.hucreler.length ?? 0)) hata('desen hedefi var ama desen yok');
      else if (hd.motif && hd.motif !== v.zemin?.desen?.motif) hata(`desen motifi uyuşmuyor: ${hd.motif} / ${v.zemin?.desen?.motif}`);
      break;
    case 'is':
      if (say((s) => s === 'I') === 0) hata('is hedefi var ama is yok');
      break;
    case 'devFisek': {
      const n = say((s) => /^D\d*$/.test(s));
      if (!aralikta(hd.adet, 1, 99) || n < hd.adet) hata(`dev fişek hedefi ${hd.adet}, tahtada ${n}`);
      break;
    }
    case 'fener': {
      const n = say((s) => s === 'F') + (v.fenerDogum?.kalan ?? 0);
      if (!aralikta(hd.adet, 1, 99) || n < hd.adet) hata(`fener hedefi ${hd.adet}, tahtada + doğacak ${n}`);
      break;
    }
    case 'zincirleme':
      if (!aralikta(hd.esik, 1, 99) || !aralikta(hd.adet, 1, 99)) hata('zincirleme eşik/adet ≥ 1');
      break;
    case 'halka':
      if (!aralikta(hd.adet, 1, 99)) hata('halka adedi ≥ 1');
      break;
    case 'puan':
      if (!aralikta(hd.puan, 1, 1e7)) hata('puan hedefi ≥ 1');
      if (v.tur !== 'ogretim' && v.tur !== 'usta') hata('puan hedefi yalnız öğretim ve Usta bölümlerinde (§6.11)');
      break;
    default:
      hata(`hedef türü geçersiz: ${(hd as { tur: string }).tur}`);
  }
}

/**
 * Yükleyici ilk tahtayı karıştırdı mı: aynı bölüme bir özel taş eklenmiş
 * kopyası (özel taş varken tahta kilitli sayılmaz, §3.4) asla karıştırılmaz;
 * eklenen hücre dışında iki tahta farklıysa asıl bölüm karıştırılmıştır.
 * Sabit kapsüller dolumdan sonra uygulandığından dolum akışı değişmez.
 */
function karistirildi(v: BolumVerisi, d: OyunDurumu): boolean {
  // İlk `.` hücresine roket konur (sabit kapsülse sonraki kayıt onu ezer).
  let ek = -1;
  for (let y = 0; y < v.h && ek < 0; y++) {
    const s = v.duzen[y].trim().split(/\s+/);
    for (let x = 0; x < v.w; x++) {
      if (s[x] === '.') {
        ek = y * v.w + x;
        break;
      }
    }
  }
  if (ek < 0) return false;
  const kopya: BolumVerisi = { ...v, sabitKapsuller: [...(v.sabitKapsuller ?? []), { x: ek % v.w, y: Math.floor(ek / v.w), renk: 0, ozel: 'roket', eksen: 0 }] };
  const d2 = bolumuYukle(kopya, 0);
  for (let i = 0; i < d.hucreler.length; i++) {
    if (i === ek) continue;
    if (JSON.stringify(d.hucreler[i]) !== JSON.stringify(d2.hucreler[i])) return true;
  }
  return false;
}

/** İzinli hücrelerde aynı renk (ya da joker) ≥ 3 düğümlü bağlı küme var mı. */
function zorunluYolVar(d: OyunDurumu, izin: readonly [number, number][]): boolean {
  const kume = new Set(izin.map(([x, y]) => y * d.w + x));
  const dort = !!d.kurallar.dortKomsu;
  for (let c = 0; c < d.renkSayisi; c++) {
    const uygun = (i: number): boolean => {
      const hc = d.hucreler[i];
      return kume.has(i) && !hc.kafes && hc.icerik?.tur === 'kapsul' && (hc.icerik.renk === c || hc.icerik.renk === -1);
    };
    const gorulen = new Set<number>();
    for (const s of kume) {
      if (gorulen.has(s) || !uygun(s)) continue;
      let boyut = 0;
      const yigin = [s];
      gorulen.add(s);
      while (yigin.length) {
        const i = yigin.pop() as number;
        boyut++;
        const x = i % d.w;
        const y = (i - x) / d.w;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx === 0 && dy === 0) || (dort && dx !== 0 && dy !== 0)) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) continue;
            const j = ny * d.w + nx;
            if (gorulen.has(j) || !uygun(j)) continue;
            gorulen.add(j);
            yigin.push(j);
          }
      }
      if (boyut >= 3) return true;
    }
  }
  return false;
}
