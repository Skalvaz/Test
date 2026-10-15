/**
 * Test araçları (yalnız vitest ve bot testleri kullanır; uygulama içe
 * aktarmaz).
 *
 * Kompakt tahta (`kur`): her hücre boşlukla ayrılmış bir simge.
 *   `1 2 4 3 5 6` düz damla, `7` Mürekkep, `-` boş, `#` delik, `X1..X3`
 *   mermer, `T5` Tarak (renk 5, yatay), `T5d` dikey Tarak, `G6` Girdap,
 *   `L` Lale. Zemin `ek.zemin` ile.
 * Dolum varsayılan olarak yalnız Kırmızı doğurur (ham boya eşleşmez:
 * çözüm belirlenimli ve okunur kalır); garanti varsayılan 0.
 */
import { BolumHatasi, bolumuYukle, bosIstatistik, hedefDurumu } from './bolumYukle';
import { gecerliHamleler } from './hamle';
import { oyunTohumu, rngInt } from './rng';
import { VARSAYILAN_OZEL_ESIKLERI } from './sabitler';
import { bosHucre, damla } from './tahta';
import type { BolumVerisi, Damla, Hamle, Hedef, Hucre, Icerik, KarisikRenk, Konum, OyunDurumu, Renk } from './types';

export function bolum(satirlar: string[], ek: Partial<BolumVerisi> = {}): BolumVerisi {
  const izgara = satirlar.map((s) => s.trim().split(/\s+/));
  const h = izgara.length;
  const w = izgara[0].length;
  const duzen: string[] = [];
  const ozeller: NonNullable<BolumVerisi['ozeller']> = [];
  for (let y = 0; y < h; y++) {
    if (izgara[y].length !== w) throw new Error(`satır ${y}: ${izgara[y].length} simge, w=${w}`);
    const satir: string[] = [];
    for (let x = 0; x < w; x++) {
      const s = izgara[y][x];
      const m = /^([TG])([356])(d?)$/.exec(s);
      if (m) {
        satir.push('1');
        ozeller.push({ x, y, ozel: m[1] === 'T' ? 'tarak' : 'girdap', renk: Number(m[2]) as KarisikRenk, yon: m[3] ? 'dikey' : 'yatay' });
      } else if (s === 'L') {
        satir.push('1');
        ozeller.push({ x, y, ozel: 'lale' });
      } else if (s === '-') satir.push('1');
      else satir.push(s);
    }
    duzen.push(satir.join(' '));
  }
  return {
    id: 9000,
    ad: 'test',
    atolye: 'uskudar',
    tur: 'normal',
    w,
    h,
    hamle: 30,
    tohum: 7,
    dogum: [1, 0, 0, 0, 0, 0],
    garanti: 0,
    murekkep: false,
    hedefler: [{ tur: 'puan', puan: 999999 }],
    duzen,
    ozeller: ozeller.length ? ozeller : undefined,
    botBandi: [0, 100],
    acemiAlt: 0,
    yildizEsikleri: [1000, 2000],
    ...ek,
  };
}

/**
 * Tahtayı DOĞRUDAN kur (bolumuYukle'nin boyut, grupsuzluk ve garanti
 * denetimleri olmadan; küçük kural tahtaları için). `.` yasak; `-` boş.
 * Kimlikler okuma sırasıyla 1'den; oyun akışı `oyunTohumu(tohum, denemeNo)`.
 */
export function kur(satirlar: string[], ek: Partial<BolumVerisi> = {}, denemeNo = 0): OyunDurumu {
  const v = bolum(satirlar, ek);
  const izgara = satirlar.map((s) => s.trim().split(/\s+/));
  const hucreler: Hucre[] = [];
  let id = 1;
  for (let y = 0; y < v.h; y++)
    for (let x = 0; x < v.w; x++) {
      const t = izgara[y][x];
      const c = bosHucre();
      const dm = (renk: Renk | 0, ozel: Damla['ozel'], yon: Damla['yon'] = 'yatay'): Icerik => ({ tur: 'damla', damla: { id: id++, renk, ozel, yon } });
      let m: RegExpExecArray | null;
      if (t === '-') c.icerik = null;
      else if (t === '#') c.delik = true;
      else if ((m = /^X([123])$/.exec(t))) c.icerik = { tur: 'mermer', can: Number(m[1]) as 1 | 2 | 3 };
      else if ((m = /^([TG])([356])(d?)$/.exec(t))) c.icerik = dm(Number(m[2]) as Renk, m[1] === 'T' ? 'tarak' : 'girdap', m[3] ? 'dikey' : 'yatay');
      else if (t === 'L') c.icerik = dm(0, 'lale');
      else if (/^[1-7]$/.test(t)) c.icerik = dm(Number(t) as Renk, t === '7' ? 'murekkep' : 'yok');
      else throw new Error(`kur: bilinmeyen simge ${t}`);
      hucreler.push(c);
    }
  for (const [x, y, k] of v.zemin?.kagit ?? []) hucreler[y * v.w + x].kagit = k;
  for (const [x, y] of v.zemin?.yag ?? []) hucreler[y * v.w + x].yag = true;
  for (const [x, y, r] of v.zemin?.desen?.hucreler ?? []) hucreler[y * v.w + x].desen = r;
  return {
    bolumId: v.id,
    denemeNo,
    w: v.w,
    h: v.h,
    hucreler,
    dogumAgirliklari: [...v.dogum] as OyunDurumu['dogumAgirliklari'],
    kurallar: { murekkep: v.murekkep, garanti: v.garanti, ozelEsikleri: [...(v.ozelEsikleri ?? VARSAYILAN_OZEL_ESIKLERI)] as [number, number, number] },
    kalanHamle: v.hamle,
    toplamHamle: v.hamle,
    puan: 0,
    hedefler: v.hedefler.map((h) => hedefDurumu(h, hucreler)),
    rng: oyunTohumu(v.tohum, denemeNo),
    hamleNo: 0,
    sonrakiId: id,
    gunluk: [],
    istatistik: bosIstatistik(),
    bitti: null,
    solenYapildi: false,
  };
}

/** Tahtanın kompakt metni (içerik): renk/özel, `-` boş, `#`, `X2`. */
export function tahtaMetni(d: OyunDurumu): string[] {
  const out: string[] = [];
  for (let y = 0; y < d.h; y++) {
    const s: string[] = [];
    for (let x = 0; x < d.w; x++) {
      const c = d.hucreler[y * d.w + x];
      if (c.delik) s.push('#');
      else if (c.icerik?.tur === 'mermer') s.push(`X${c.icerik.can}`);
      else {
        const dm = damla(c);
        if (!dm) s.push('-');
        else if (dm.ozel === 'tarak') s.push(`T${dm.renk}${dm.yon === 'dikey' ? 'd' : ''}`);
        else if (dm.ozel === 'girdap') s.push(`G${dm.renk}`);
        else if (dm.ozel === 'lale') s.push('L');
        else s.push(String(dm.renk));
      }
    }
    out.push(s.join(' '));
  }
  return out;
}

export const H = (kx: number, ky: number, ex: number, ey: number): Hamle => ({ tur: 'surukle', kaynak: { x: kx, y: ky }, hedef: { x: ex, y: ey } });

/** Bütün geçerli hamleler (çekirdeğin `gecerliHamleler`i). */
export const tumHamleler = gecerliHamleler;

/**
 * Rastgele geçerli hamle; özel taşa dokunanlar (özellikle özel + özel)
 * ağırlıklı, böylece birleşimler ve zincirler sık oynanır.
 */
export function rastgeleHamle(d: OyunDurumu, r: { rng: number }): Hamle | null {
  const l = tumHamleler(d);
  if (l.length === 0) return null;
  const oz = (p: Konum): boolean => damla(d.hucreler[p.y * d.w + p.x])!.ozel !== 'yok';
  const ikili = l.filter((h) => oz(h.kaynak) && oz(h.hedef));
  if (ikili.length && rngInt(r, 100) < 60) return ikili[rngInt(r, ikili.length)];
  const ozelli = l.filter((h) => oz(h.kaynak) || oz(h.hedef));
  if (ozelli.length && rngInt(r, 100) < 35) return ozelli[rngInt(r, ozelli.length)];
  return l[rngInt(r, l.length)];
}

/** Belirlenimli seçici (altın tekrarlar): ilk geçerli hamle. */
export function ilkHamle(d: OyunDurumu): Hamle | null {
  return tumHamleler(d)[0] ?? null;
}

const DOGUM_KALIPLARI: [number, number, number, number, number, number][] = [
  [20, 20, 20, 11, 11, 11],
  [20, 20, 20, 11, 11, 11],
  [20, 20, 20, 11, 11, 11],
  [32, 32, 0, 18, 0, 0],
  [30, 0, 30, 8, 16, 8],
  [20, 20, 20, 30, 30, 30],
  [10, 10, 10, 40, 40, 40],
  [10, 0, 0, 0, 0, 10], // K + Y: karışım yok → ölü tahta, son çare
  [10, 10, 0, 0, 0, 0], // yalnız ham: yağla ölü tahta, karıştırma
];

/**
 * Bulanık test bölümü: boyut, delik, mermer, kâğıt, yağ, desen, özel taşlar,
 * Mürekkep, garanti ve hedefler rastgele. Geçersiz ilk tahta çıkarsa başka
 * tohumla yeniden dener.
 */
export function rastgeleBolum(r: { rng: number }, id: number): BolumVerisi {
  for (let deneme = 0; ; deneme++) {
    const v = rastgeleBolumTaslagi(r, id);
    try {
      bolumuYukle(v, 0);
      return v;
    } catch (e) {
      if (!(e instanceof BolumHatasi) || deneme > 200) throw e;
    }
  }
}

function rastgeleBolumTaslagi(r: { rng: number }, id: number): BolumVerisi {
  const ri = (a: number, b: number): number => a + rngInt(r, b - a + 1);
  const w = ri(4, 8);
  const h = ri(4, 10);
  const kalip = DOGUM_KALIPLARI[rngInt(r, DOGUM_KALIPLARI.length)];
  const yalnizHam = kalip[3] + kalip[4] + kalip[5] === 0;
  const duzen: string[][] = [];
  for (let y = 0; y < h; y++) {
    const s: string[] = [];
    for (let x = 0; x < w; x++) {
      const p = rngInt(r, 100);
      if (p < 4 && y > 0) s.push('#');
      else if (p < 10 && y > 0) s.push(`X${ri(1, 3)}`);
      else s.push('.');
    }
    duzen.push(s);
  }
  // Ölü tahta kalıbında başlangıçta bir geçerli çift: Kırmızı + Sarı.
  if (kalip[1] === 0 && kalip[3] === 0) {
    duzen[h - 1][0] = '1';
    duzen[h - 1][1] = '2';
  }
  const bos = (x: number, y: number): boolean => duzen[y][x] === '.' || /^[1-7]$/.test(duzen[y][x]);
  const kagit: [number, number, 1 | 2][] = [];
  const yag: [number, number][] = [];
  const desen: [number, number, KarisikRenk][] = [];
  const yagOrani = yalnizHam ? 85 : 10;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (duzen[y][x] === '#') continue;
      if (rngInt(r, 100) < 18) kagit.push([x, y, rngInt(r, 3) === 0 ? 2 : 1]);
      if (bos(x, y) && rngInt(r, 100) < yagOrani && !(kalip[1] === 0 && kalip[3] === 0 && y === h - 1 && x < 2)) yag.push([x, y]);
      else if (bos(x, y) && !yalnizHam && rngInt(r, 100) < 8) desen.push([x, y, ([3, 5, 6] as const)[rngInt(r, 3)]]);
    }
  const ozeller: NonNullable<BolumVerisi['ozeller']> = [];
  const ozelSayisi = rngInt(r, 4);
  for (let k = 0; k < ozelSayisi; k++) {
    const x = rngInt(r, w);
    const y = rngInt(r, h);
    if (!bos(x, y) || ozeller.some((o) => o.x === x && o.y === y)) continue;
    const t = rngInt(r, 4);
    const renk = ([3, 5, 6] as const)[rngInt(r, 3)];
    if (t === 0) ozeller.push({ x, y, ozel: 'tarak', renk, yon: rngInt(r, 2) ? 'dikey' : 'yatay' });
    else if (t === 1) ozeller.push({ x, y, ozel: 'girdap', renk });
    else if (t === 2) ozeller.push({ x, y, ozel: 'lale' });
    else ozeller.push({ x, y, ozel: 'murekkep' });
  }
  const hedefler: Hedef[] = [];
  const hs = rngInt(r, 4);
  if (hs === 0 && kagit.length) hedefler.push({ tur: 'kagit' });
  else if (hs === 1 && desen.length) hedefler.push({ tur: 'desen', motif: 'lale' });
  else if (hs === 2) hedefler.push({ tur: 'puan', puan: ri(500, 6000) });
  else hedefler.push({ tur: 'topla', renk: ([3, 5, 6] as const)[rngInt(r, 3)], adet: ri(3, 40) });
  if (rngInt(r, 3) === 0) hedefler.push({ tur: 'puan', puan: ri(300, 3000) });
  return {
    id,
    ad: `rastgele ${id}`,
    atolye: 'uskudar',
    tur: 'normal',
    w,
    h,
    hamle: ri(6, 30),
    tohum: rngInt(r, 1 << 30),
    dogum: [...kalip] as BolumVerisi['dogum'],
    garanti: rngInt(r, 4),
    murekkep: rngInt(r, 2) === 0,
    hedefler,
    duzen: duzen.map((s) => s.join(' ')),
    ozeller: ozeller.length ? ozeller : undefined,
    zemin: { kagit, yag, desen: desen.length ? { motif: 'lale', hucreler: desen } : undefined },
    botBandi: [0, 100],
    acemiAlt: 0,
    yildizEsikleri: [1000, 2000],
  };
}

/** Derin dondurma (girdi değişmez testi). */
export function derinDondur<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) derinDondur(v);
  }
  return o;
}
