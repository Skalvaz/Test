/**
 * Ebruli kural prototipi (ölçüm için; oyunun çekirdeği değil).
 * Renk kodu 3 bit: K=1 S=2 M=4, T=3 Mo=5 Y=6, Mürekkep=7. 0 = boş.
 * Özel: 0 yok, 1 tarak yatay, 2 tarak dikey, 3 girdap, 4 lale (renk 0), 5 mürekkep (renk 7).
 */

export interface Ayar {
  w: number;
  h: number;
  /** Doğum ağırlıkları [K,S,M,T,Mo,Y]. */
  dogum: number[];
  /** Karışık + eksik ham → Mürekkep karışımı açık mı. */
  murekkepKarisim: boolean;
  /** Yardım n: anında eşleşme yoksa bu turda doğanları en fazla n kez yeniden çek. */
  yardim: number;
  /** Ham renkler de eşleşir mi (karşılaştırma için). */
  hamEslesir?: boolean;
  /** Eşleşme eşiği. */
  esik?: number;
  /** Yayılma: ham hedefe damlatınca hedefin aynı renkli ham kümesi karışır. */
  yayilma?: boolean;
  /** Kümeli doğum (binde): doğan damla altındakinin rengini kopyalar. */
  kume?: number;
  /** Özel eşikleri [tarak, girdap, lale]. */
  ozelEsik?: [number, number, number];
  /** Akıllı yardım: hamle sonunda en az bu kadar hazır çift (0 = kapalı). */
  garanti?: number;
}

/** Hazır hamle sayısı (eşsiz çift) — garanti için. */
export function hazirCift(ay: Ayar, t: Tahta): number {
  const s = new Set<number>();
  for (const h of hazirHamleler(ay, t)) s.add(h.hamle.a < h.hamle.b ? h.hamle.a * 1000 + h.hamle.b : h.hamle.b * 1000 + h.hamle.a);
  return s.size;
}

/**
 * Akıllı yardım (garanti): hazır çift sayısı `enAz`'ın altındaysa bu turda
 * doğan damlaları sırayla (aşağıdan yukarı, soldan sağa) RNG ile karılmış renk
 * sırasında dener; grup oluşturmadan hazır sayısını artıran ilk rengi alır.
 */
export function garanti(ay: Ayar, t: Tahta, rng: Rng, enAz: number): number {
  if (enAz <= 0) return 0;
  let simdi = hazirCift(ay, t);
  if (simdi >= enAz) return 0;
  const doganlar: number[] = [];
  for (let y = t.h - 1; y >= 0; y--)
    for (let x = 0; x < t.w; x++) {
      const i = y * t.w + x;
      if (t.dogan[i] && t.s[i] === 0) doganlar.push(i);
    }
  let degisen = 0;
  for (const i of doganlar) {
    const sira = RENKLER.filter((_c, k) => ay.dogum[k] > 0);
    for (let k = sira.length - 1; k > 0; k--) {
      const j = rng.int(k + 1);
      [sira[k], sira[j]] = [sira[j], sira[k]];
    }
    const eski = t.c[i];
    let enIyi = eski;
    let enIyiS = simdi;
    for (const c of sira) {
      if (c === eski) continue;
      t.c[i] = c;
      if (gruplar(ay, t).length) continue;
      const s = hazirCift(ay, t);
      if (s > enIyiS) {
        enIyi = c;
        enIyiS = s;
        break;
      }
    }
    t.c[i] = enIyi;
    if (enIyi !== eski) {
      degisen++;
      simdi = enIyiS;
    }
    if (simdi >= enAz) break;
  }
  return degisen;
}

export const RENKLER = [1, 2, 4, 3, 5, 6];
export const karisikMi = (c: number) => c === 3 || c === 5 || c === 6;
export const hamMi = (c: number) => c === 1 || c === 2 || c === 4;

export class Rng {
  s: number;
  constructor(s: number) {
    this.s = s >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  int(n: number): number {
    return Math.floor((this.next() * n) / 4294967296);
  }
  agirlik(a: readonly number[]): number {
    let top = 0;
    for (const x of a) top += x;
    let r = this.int(top);
    for (let i = 0; i < a.length; i++) {
      r -= a[i];
      if (r < 0) return i;
    }
    return a.length - 1;
  }
}

export interface Tahta {
  w: number;
  h: number;
  c: Int8Array;
  s: Int8Array;
  /** Bu hamlede oyuncunun yarattığı damla. */
  yeni: Uint8Array;
  /** Bu turda doğan damla. */
  dogan: Uint8Array;
}

export function tahtaKopya(t: Tahta): Tahta {
  return { w: t.w, h: t.h, c: t.c.slice(), s: t.s.slice(), yeni: t.yeni.slice(), dogan: t.dogan.slice() };
}

export interface Hamle {
  a: number; // kaynak indeksi
  b: number; // hedef indeksi
}

export interface Sonuc {
  temizlenen: number;
  /** Oyuncunun yarattığı damlayı içeren grupların damla sayısı. */
  yaratilanGrup: number;
  /** Doğumdan sonra gelen (kaskat) temizlik. */
  kaskatTemiz: number;
  ilkGrupVar: boolean;
  gruplar: number;
  ozelUretim: number[]; // [tarak, girdap, lale]
  murekkepUretildi: boolean;
  murekkepPatladi: number;
  /** Renk başına temizlenen damla (indeks renk kodu). */
  renkSayim: number[];
  kaskatK: number;
}

function bosSonuc(): Sonuc {
  return { temizlenen: 0, yaratilanGrup: 0, kaskatTemiz: 0, ilkGrupVar: false, gruplar: 0, ozelUretim: [0, 0, 0], murekkepUretildi: false, murekkepPatladi: 0, renkSayim: new Array(8).fill(0), kaskatK: 0 };
}

/** Geçerli karışım mı (yalnız düz damlalar). */
export function karisabilir(ay: Ayar, a: number, b: number): boolean {
  if (a === 0 || b === 0 || a === 7 || b === 7) return false;
  if ((a & b) !== 0) return false;
  const r = a | b;
  if (r === 7) return ay.murekkepKarisim;
  return true;
}

export function gecerliHamleler(ay: Ayar, t: Tahta, ozelDahil = true): Hamle[] {
  const out: Hamle[] = [];
  const { w, h } = t;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (t.c[i] === 0 && t.s[i] === 0) continue;
      const kom = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of kom) {
        if (j < 0) continue;
        if (t.c[j] === 0 && t.s[j] === 0) continue;
        if (t.s[i] !== 0) {
          if (ozelDahil) out.push({ a: i, b: j });
          continue;
        }
        if (t.s[j] !== 0) continue; // düz → özel: GDD'de özel tarafından tetiklenir; ölçümde kaynak özel sayılır
        if (karisabilir(ay, t.c[i], t.c[j])) out.push({ a: i, b: j });
      }
    }
  return out;
}

function yercekimi(t: Tahta): boolean {
  const { w, h } = t;
  let degisti = false;
  for (let x = 0; x < w; x++) {
    let yaz = h - 1;
    for (let y = h - 1; y >= 0; y--) {
      const i = y * w + x;
      if (t.c[i] !== 0 || t.s[i] !== 0) {
        const j = yaz * w + x;
        if (j !== i) {
          t.c[j] = t.c[i];
          t.s[j] = t.s[i];
          t.yeni[j] = t.yeni[i];
          t.dogan[j] = t.dogan[i];
          t.c[i] = 0;
          t.s[i] = 0;
          t.yeni[i] = 0;
          t.dogan[i] = 0;
          degisti = true;
        }
        yaz--;
      }
    }
  }
  return degisti;
}

function doldur(ay: Ayar, t: Tahta, rng: Rng): number {
  let n = 0;
  for (let x = 0; x < t.w; x++)
    for (let y = t.h - 1; y >= 0; y--) {
      const i = y * t.w + x;
      if (t.c[i] === 0 && t.s[i] === 0) {
        const alt = y + 1 < t.h ? t.c[i + t.w] : 0;
        const altOzel = y + 1 < t.h ? t.s[i + t.w] : 1;
        if (ay.kume && alt > 0 && alt < 7 && altOzel === 0 && rng.int(1000) < ay.kume) t.c[i] = alt;
        else t.c[i] = RENKLER[rng.agirlik(ay.dogum)];
        t.dogan[i] = 1;
        n++;
      }
    }
  return n;
}

function eslesirMi(ay: Ayar, c: number, s: number): boolean {
  if (s === 4 || s === 5) return false;
  if (karisikMi(c)) return true;
  return !!ay.hamEslesir && hamMi(c) && s === 0;
}

/** Grupları bul (flood-fill, 4 komşu). */
export function gruplar(ay: Ayar, t: Tahta): number[][] {
  const { w, h } = t;
  const esik = ay.esik ?? 3;
  const gor = new Uint8Array(w * h);
  const out: number[][] = [];
  const yigin: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (gor[i] || !eslesirMi(ay, t.c[i], t.s[i])) continue;
    const renk = t.c[i];
    const g: number[] = [];
    yigin.length = 0;
    yigin.push(i);
    gor[i] = 1;
    while (yigin.length) {
      const k = yigin.pop()!;
      g.push(k);
      const x = k % w,
        y = (k / w) | 0;
      const kom = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const j of kom) {
        if (j < 0 || gor[j]) continue;
        if (t.c[j] === renk && eslesirMi(ay, t.c[j], t.s[j])) {
          gor[j] = 1;
          yigin.push(j);
        }
      }
    }
    if (g.length >= esik) out.push(g);
  }
  return out;
}

/** Bir özel taşın etki alanı. */
function ozelAlan(t: Tahta, i: number, tur: number): number[] {
  const { w, h } = t;
  const x = i % w,
    y = (i / w) | 0;
  const out: number[] = [];
  if (tur === 1) for (let xx = 0; xx < w; xx++) out.push(y * w + xx);
  else if (tur === 2) for (let yy = 0; yy < h; yy++) out.push(yy * w + x);
  else if (tur === 3 || tur === 5)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h) out.push(yy * w + xx);
      }
  return out;
}

function enCokRenk(t: Tahta): number {
  const say = new Array(8).fill(0);
  for (let i = 0; i < t.c.length; i++) if (t.s[i] === 0 && t.c[i] > 0 && t.c[i] < 7) say[t.c[i]]++;
  let en = 1;
  for (const c of [1, 2, 4, 3, 5, 6]) if (say[c] > say[en]) en = c;
  return en;
}

/**
 * Temizlik: verilen hücreleri kaldırır; özel taşları kuyrukla ateşler.
 * korunan: bu adımda yeni üretilen özel taşın hücresi (silinmez).
 */
function temizle(t: Tahta, ilk: Set<number>, korunan: Set<number>, sonuc: Sonuc, lalRenk?: number): void {
  const kuyruk: number[] = [];
  const silinecek = new Set<number>();
  const ekle = (i: number) => {
    if (korunan.has(i) || silinecek.has(i)) return;
    if (t.c[i] === 0 && t.s[i] === 0) return;
    silinecek.add(i);
    if (t.s[i] !== 0) kuyruk.push(i);
  };
  for (const i of ilk) ekle(i);
  if (lalRenk !== undefined) for (let i = 0; i < t.c.length; i++) if (t.s[i] === 0 && t.c[i] === lalRenk) ekle(i);
  while (kuyruk.length) {
    const i = kuyruk.shift()!;
    const tur = t.s[i];
    if (tur === 4) {
      const r = enCokRenk(t);
      for (let j = 0; j < t.c.length; j++) if (t.s[j] === 0 && t.c[j] === r) ekle(j);
    } else {
      if (tur === 5) sonuc.murekkepPatladi++;
      for (const j of ozelAlan(t, i, tur)) ekle(j);
    }
  }
  for (const i of silinecek) {
    sonuc.temizlenen++;
    sonuc.renkSayim[t.c[i]]++;
    t.c[i] = 0;
    t.s[i] = 0;
    t.yeni[i] = 0;
    t.dogan[i] = 0;
  }
}

/** Bir çözümleme adımı: grupları temizle (özel üretimi, mürekkep). Grup yoksa false. */
function adim(ay: Ayar, t: Tahta, sonuc: Sonuc, kaskat: boolean): boolean {
  const gs = gruplar(ay, t);
  if (gs.length === 0) return false;
  sonuc.gruplar += gs.length;
  const temiz = new Set<number>();
  const korunan = new Set<number>();
  const yeniOzel: [number, number, number][] = [];
  for (const g of gs) {
    let yaratilan = -1;
    for (const i of g) if (t.yeni[i]) yaratilan = i;
    if (yaratilan >= 0) sonuc.yaratilanGrup += g.length;
    if (kaskat) sonuc.kaskatTemiz += g.length;
    for (const i of g) temiz.add(i);
    // özel üretimi
    const n = g.length;
    const [eT, eG, eL] = ay.ozelEsik ?? [4, 5, 7];
    let tur = 0;
    if (n >= eL) tur = 4;
    else if (n >= eG) tur = 3;
    else if (n >= eT) {
      let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
      for (const i of g) {
        const x = i % t.w, y = (i / t.w) | 0;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      tur = x1 - x0 >= y1 - y0 ? 1 : 2;
    }
    if (tur) {
      let yer = yaratilan;
      if (yer < 0) {
        yer = g[0];
        for (const i of g) {
          const y = (i / t.w) | 0, x = i % t.w;
          const ey = (yer / t.w) | 0, ex = yer % t.w;
          if (y > ey || (y === ey && x < ex)) yer = i;
        }
      }
      yeniOzel.push([yer, tur, tur === 4 ? 0 : t.c[g[0]]]);
      sonuc.ozelUretim[tur === 4 ? 2 : tur === 3 ? 1 : 0]++;
    }
  }
  // mürekkep komşuları
  const murekkep: number[] = [];
  for (const i of temiz) {
    const x = i % t.w, y = (i / t.w) | 0;
    const kom = [x > 0 ? i - 1 : -1, x < t.w - 1 ? i + 1 : -1, y > 0 ? i - t.w : -1, y < t.h - 1 ? i + t.w : -1];
    for (const j of kom) if (j >= 0 && t.s[j] === 5 && !temiz.has(j)) murekkep.push(j);
  }
  for (const m of murekkep) temiz.add(m);
  // Yeni özel taşın hücresinde eski özel varsa önce o ateşlenir; yeni taş sonra yazılır.
  temizle(t, temiz, korunan, sonuc);
  for (const [yer, tur, renk] of yeniOzel) {
    t.c[yer] = renk;
    t.s[yer] = tur;
    t.yeni[yer] = 0;
  }
  return true;
}

/** Hamleyi uygular ve çözer. doldur=false: önizleme (doğum yok). */
export function uygula(ay: Ayar, t: Tahta, m: Hamle, rng: Rng | null): Sonuc {
  const sonuc = bosSonuc();
  t.yeni.fill(0);
  t.dogan.fill(0);
  const sa = t.s[m.a], sb = t.s[m.b];
  if (sa !== 0) {
    // özel sürükleme
    if (sa === 5) {
      temizle(t, new Set([m.a]), new Set(), sonuc);
    } else if (sa === 4) {
      const hedefRenk = t.s[m.b] === 0 ? t.c[m.b] : undefined;
      const ilk = new Set([m.a]);
      t.s[m.a] = 0; // lale kendisi silinir, alan: hedef renk
      t.c[m.a] = 0;
      sonuc.temizlenen++;
      temizle(t, ilk, new Set(), sonuc, hedefRenk ?? enCokRenk(t));
    } else {
      // tarak/girdap hedef hücrede ateşlenir: kaynağı hedefe taşı (hedef içeriği alanda temizlenir)
      const tur = sa, renk = t.c[m.a];
      t.c[m.a] = 0;
      t.s[m.a] = 0;
      const hedefIc = [t.c[m.b], t.s[m.b]];
      t.c[m.b] = renk;
      t.s[m.b] = tur;
      sonuc.temizlenen--; // taşın kendisi bir kez sayılsın
      if (hedefIc[1] !== 0) {
        // birleşim: basitçe ikisini de ateşle (hedef özeli komşuya koy)
        temizle(t, new Set([m.b, ...ozelAlan(t, m.b, hedefIc[1] === 4 ? 3 : hedefIc[1])]), new Set(), sonuc);
      } else {
        sonuc.temizlenen++;
        sonuc.renkSayim[hedefIc[0]]++;
        temizle(t, new Set([m.b]), new Set(), sonuc);
      }
    }
  } else {
    const a = t.c[m.a], b = t.c[m.b];
    if (ay.yayilma && hamMi(b)) {
      const kume = [m.b];
      const gor = new Set([m.b]);
      for (let q = 0; q < kume.length; q++) {
        const k = kume[q];
        const x = k % t.w, y = (k / t.w) | 0;
        for (const j of [x > 0 ? k - 1 : -1, x < t.w - 1 ? k + 1 : -1, y > 0 ? k - t.w : -1, y < t.h - 1 ? k + t.w : -1]) {
          if (j < 0 || gor.has(j) || j === m.a) continue;
          if (t.c[j] === b && t.s[j] === 0) {
            gor.add(j);
            kume.push(j);
          }
        }
      }
      for (const k of kume) {
        t.c[k] = a | b;
        t.yeni[k] = 1;
      }
    }
    t.c[m.b] = a | b;
    t.yeni[m.b] = 1;
    if ((a | b) === 7) {
      t.s[m.b] = 5;
      sonuc.murekkepUretildi = true;
    }
    t.c[m.a] = 0;
    t.s[m.a] = 0;
    void sb;
  }
  let k = 0;
  let dolumSonrasi = false;
  for (let tur = 0; tur < 60; tur++) {
    yercekimi(t);
    if (adim(ay, t, sonuc, dolumSonrasi)) {
      if (!dolumSonrasi) sonuc.ilkGrupVar = true;
      k++;
      continue;
    }
    if (!rng) break;
    if (doldur(ay, t, rng) === 0) break;
    dolumSonrasi = true;
    if (gruplar(ay, t).length === 0) break;
  }
  sonuc.kaskatK = k;
  return sonuc;
}

/** Önizleme: doğumsuz çözüm, temizlenen damla sayısı. */
export function onizle(ay: Ayar, t: Tahta, m: Hamle): Sonuc {
  const k = tahtaKopya(t);
  return uygula(ay, k, m, null);
}

export function hazirHamleler(ay: Ayar, t: Tahta): { hamle: Hamle; temiz: number }[] {
  const out: { hamle: Hamle; temiz: number }[] = [];
  for (const m of gecerliHamleler(ay, t, false)) {
    const s = onizle(ay, t, m);
    if (s.ilkGrupVar) out.push({ hamle: m, temiz: s.temizlenen });
  }
  return out;
}

/** Başlangıç tahtası: grupsuz, en az bir geçerli hamle. */
export function ilkTahta(ay: Ayar, rng: Rng): Tahta {
  const n = ay.w * ay.h;
  const t: Tahta = { w: ay.w, h: ay.h, c: new Int8Array(n), s: new Int8Array(n), yeni: new Uint8Array(n), dogan: new Uint8Array(n) };
  for (let deneme = 0; deneme < 1000; deneme++) {
    for (let i = 0; i < n; i++) t.c[i] = RENKLER[rng.agirlik(ay.dogum)];
    for (let tekrar = 0; tekrar < 200; tekrar++) {
      const gs = gruplar(ay, t);
      if (!gs.length) break;
      for (const g of gs) t.c[g[0]] = RENKLER[rng.agirlik(ay.dogum)];
    }
    if (gruplar(ay, t).length === 0 && gecerliHamleler(ay, t).length > 0) return t;
  }
  throw new Error('ilk tahta üretilemedi');
}

/** Ölü tahta: geçerli hamle yok → karıştır. */
export function karistir(ay: Ayar, t: Tahta, rng: Rng): void {
  const idx: number[] = [];
  for (let i = 0; i < t.c.length; i++) if (t.s[i] === 0) idx.push(i);
  for (let deneme = 0; deneme < 200; deneme++) {
    const renk = idx.map((i) => t.c[i]);
    for (let i = renk.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [renk[i], renk[j]] = [renk[j], renk[i]];
    }
    idx.forEach((i, k) => (t.c[i] = renk[k]));
    if (gruplar(ay, t).length === 0 && gecerliHamleler(ay, t).length > 0) return;
  }
}

/**
 * Yardım: hazır hamle yoksa bu turda doğan damlaları en fazla n kez yeniden çek.
 * Yeniden çekim grup oluşturursa reddedilir (deneme sayılır).
 */
export function yardim(ay: Ayar, t: Tahta, rng: Rng): number {
  if (ay.yardim <= 0) return 0;
  if (hazirHamleler(ay, t).length > 0) return 0;
  const doganlar: number[] = [];
  for (let i = 0; i < t.c.length; i++) if (t.dogan[i] && t.s[i] === 0) doganlar.push(i);
  if (!doganlar.length) return 0;
  const yedek = t.c.slice();
  for (let k = 0; k < ay.yardim; k++) {
    for (const i of doganlar) t.c[i] = RENKLER[rng.agirlik(ay.dogum)];
    if (gruplar(ay, t).length === 0 && hazirHamleler(ay, t).length > 0) return k + 1;
    t.c.set(yedek);
  }
  return -1;
}
