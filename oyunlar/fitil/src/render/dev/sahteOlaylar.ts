/**
 * GEÇİCİ sahte olay üretici (yalnız çizici geliştirme sayfası ve testleri).
 * Çekirdeğin `hamleUygula/onizle` fonksiyonları başka pakette yazılıyor; bu
 * dosya GDD §3.5–§5 kurallarının sadeleştirilmiş bir kopyasıyla gerçekçi olay
 * dizisi ve `sonraki` durum üretir. Çekirdek tamamlanınca dev sayfası gerçek
 * çekirdeğe geçebilir; bu dosya silinebilir.
 *
 * Kapsam: fitil (hızlanan alev, dönüşüm, halka +2, ilk iki özelin
 * kombinasyonu), çift dokunuş, kibrit, körük; ısı (eşik, nesil, kalkan),
 * roket/kasımpatı/yıldız etkileri, 6 kombinasyon (sade), vuruş tablosu
 * (kafes, ıslak, kaya, kova, dev fişek, is), döşeme/desen/barut izi,
 * yerçekimi + doldurma, fener toplama, reaksiyon özeti, hedef sayaçları.
 */
import type { Eksen, Hamle, HamleSonucu, Icerik, KomboTuru, Konum, Olay, Onizleme, OyunDurumu, OzelTur, PatlamaNedeni, Renk } from '../../core/types';
import { Rng } from '../../platform/rng';

type KuyrukTur = 'FITIL' | 'ISI' | 'VURUS' | 'DONUSUM' | 'ISI_DALGASI' | 'IZ' | 'DEVFISEK_ATES' | 'OZEL_ATES';

interface K {
  t: number;
  i: number;
  sira: number;
  tur: KuyrukTur;
  nesil: number;
  isi: number;
  k: number;
  yukle?: boolean;
  kombo?: boolean;
  neden?: PatlamaNedeni;
  ozelYeni?: { ozel: OzelTur; eksen: Eksen };
  iz?: number;
}

const DIK = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function eksenBul(a: Konum, b: Konum): Eksen {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dy === 0) return 0;
  if (dx === 0) return 1;
  return dx * dy < 0 ? 2 : 3;
}

export function sahteHamle(d0: OyunDurumu, h: Hamle, tohum = 7): HamleSonucu {
  const d: OyunDurumu = structuredClone(d0);
  const W = d.w;
  const H = d.h;
  const N = W * H;
  const rnd = new Rng(tohum ^ d.hamleNo * 977);
  const olaylar: Olay[] = [];
  const kuyruk: K[] = [];
  let sira = 0;
  const planli = new Uint8Array(N);
  const patladi = new Uint8Array(N);
  const kalkan = new Uint8Array(N);
  let R = 0;
  let komboVar = false;
  let zincirRengi = -1;
  let enGecT = 0;
  const xy = (i: number): Konum => ({ x: i % W, y: (i / W) | 0 });
  const ic = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !d.hucreler[y * W + x].delik;
  const yay = (o: Olay) => {
    olaylar.push(o);
    if (o.t > enGecT) enGecT = o.t;
  };
  const it = (k: Omit<K, 'sira'>) => kuyruk.push({ ...k, sira: sira++ });
  const hedefSay = (tur: string, renk: number, t: number) => {
    d.hedefler.forEach((hd, j) => {
      if (hd.tamam) return;
      let artti = false;
      if (tur === 'topla' && hd.hedef.tur === 'topla' && (hd.hedef.renk === 'hepsi' || (renk >= 0 && hd.hedef.renk === renk))) artti = true;
      if (tur !== 'topla' && hd.hedef.tur === tur) artti = true;
      if (!artti) return;
      hd.ilerleme++;
      hd.tamam = hd.ilerleme >= hd.gerekli;
      yay({ t, tur: 'hedefIlerledi', indeks: j, deger: hd.ilerleme, tamam: hd.tamam });
    });
  };
  // Kalkan: hamle başında bir kovaya dik komşu olan hücreler.
  for (let i = 0; i < N; i++) {
    if (d.hucreler[i].icerik?.tur !== 'kova') continue;
    const { x, y } = xy(i);
    for (const [dx, dy] of DIK) if (ic(x + dx, y + dy)) kalkan[(y + dy) * W + x + dx] = 1;
  }

  const isit = (m: number, miktar: number, g: number, t: number) => {
    const hc = d.hucreler[m];
    const c = hc.icerik;
    if (!c || c.tur !== 'kapsul') return;
    if (kalkan[m] || planli[m] || patladi[m]) return;
    c.isi += miktar;
    const kizgin = c.isi >= d.esik - 1;
    yay({ t, tur: 'isindi', hucre: xy(m), isi: Math.min(c.isi, d.esik), kizgin });
    if (c.isi >= d.esik) {
      planli[m] = 1;
      it({ t: t + 90, i: m, tur: 'ISI', nesil: g + 1, isi: 1, k: 0 });
    }
  };

  const bitisikHasar = (m: number, t: number, g: number) => {
    const c = d.hucreler[m].icerik;
    if (!c) return;
    const p = xy(m);
    switch (c.tur) {
      case 'islak':
        d.hucreler[m].icerik = { tur: 'kapsul', renk: c.renk, isi: 0, ozel: 'yok', eksen: 0 };
        yay({ t, tur: 'kurudu', hucre: p, renk: c.renk });
        break;
      case 'kaya':
      case 'kova': {
        const kalan = c.kat - 1;
        yay({ t, tur: 'engelHasar', hucre: p, engel: c.tur, kalan });
        if (kalan <= 0) {
          d.hucreler[m].icerik = null;
          if (c.tur === 'kaya') hedefSay('kaya', -1, t);
        } else c.kat = kalan as 1;
        break;
      }
      case 'devFisek':
        if (c.dolum >= c.kapasite) break;
        c.dolum++;
        yay({ t, tur: 'devFisekDoldu', hucre: p, dolum: c.dolum, kapasite: c.kapasite });
        if (c.dolum >= c.kapasite) it({ t: t + 150, i: m, tur: 'DEVFISEK_ATES', nesil: g, isi: 0, k: 0 });
        break;
      case 'is':
        d.hucreler[m].icerik = null;
        yay({ t, tur: 'isTemizlendi', hucre: p });
        hedefSay('is', -1, t);
        break;
    }
  };

  const ozelEtki = (m: number, ozel: OzelTur, eksen: Eksen, T: number, g: number, hedefRenk: number) => {
    const { x, y } = xy(m);
    yay({ t: T, tur: 'ozelTetiklendi', hucre: { x, y }, ozel, eksen, ...(ozel === 'yildiz' ? { hedefRenk } : {}) });
    if (ozel === 'roket') roket(x, y, eksen, T, g);
    else if (ozel === 'kasimpati') {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const c = Math.max(Math.abs(dx), Math.abs(dy));
          if (c === 0 || !ic(x + dx, y + dy)) continue;
          const j = (y + dy) * W + x + dx;
          if (c === 1) it({ t: T + 30, i: j, tur: 'VURUS', nesil: g, isi: 1, k: 0 });
          else it({ t: T + 60, i: j, tur: 'ISI_DALGASI', nesil: g, isi: 1, k: 0 });
        }
      yay({ t: T + 60, tur: 'isiDalgasi', merkez: { x, y }, yaricap: 2 });
    } else if (ozel === 'yildiz') {
      const liste: [number, number][] = [];
      for (let j = 0; j < N; j++) {
        const c = d.hucreler[j].icerik;
        if (c?.tur !== 'kapsul' || c.renk !== hedefRenk || planli[j] || j === m) continue;
        const q = xy(j);
        liste.push([(q.x - x) ** 2 + (q.y - y) ** 2, j]);
      }
      liste.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      liste.forEach(([, j], k) => it({ t: T + 20 * (k + 1), i: j, tur: 'VURUS', nesil: g, isi: 1, k: 0 }));
    }
  };

  const roket = (x: number, y: number, a: Eksen, T: number, g: number, adim = 25) => {
    const [dx, dy] = a === 0 ? [1, 0] : a === 1 ? [0, 1] : a === 2 ? [1, -1] : [1, 1];
    for (const s of [1, -1]) {
      for (let k = 1; ; k++) {
        const nx = x + dx * s * k;
        const ny = y + dy * s * k;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
        if (d.hucreler[ny * W + nx].delik) continue;
        it({ t: T + adim * k, i: ny * W + nx, tur: 'VURUS', nesil: g, isi: 1, k: 0 });
      }
    }
  };

  let yukluOzel: { ozel: OzelTur; eksen: Eksen } | null = null;
  const kombo = (m: number, s2: { ozel: OzelTur; eksen: Eksen }, T: number, g: number) => {
    const s1 = yukluOzel!;
    const tur = [s1.ozel, s2.ozel].sort().join('+');
    const ad: KomboTuru =
      tur === 'roket+roket' ? 'yildizHatti' : tur === 'kasimpati+roket' ? 'kalinRoket' : tur === 'kasimpati+kasimpati' ? 'devKasimpati' : tur === 'roket+yildiz' ? 'roketYagmuru' : tur === 'kasimpati+yildiz' ? 'bahce' : 'buyukFinal';
    komboVar = true;
    const { x, y } = xy(m);
    yay({ t: T, tur: 'kombinasyon', hucre: { x, y }, kombo: ad });
    if (ad === 'yildizHatti') for (const a of [0, 1, 2, 3] as Eksen[]) roket(x, y, a, T, g);
    else if (ad === 'kalinRoket') {
      const a = s1.ozel === 'roket' ? s1.eksen : s2.eksen;
      const kay = a === 0 ? [[0, -1], [0, 0], [0, 1]] : [[-1, 0], [0, 0], [1, 0]];
      for (const [ox, oy] of kay) if (ic(x + ox, y + oy) || (x + ox >= 0 && x + ox < W && y + oy >= 0 && y + oy < H)) roket(x + ox, y + oy, a, T, g);
    } else if (ad === 'devKasimpati') {
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const c = Math.max(Math.abs(dx), Math.abs(dy));
          if (c === 0 || !ic(x + dx, y + dy)) continue;
          const j = (y + dy) * W + x + dx;
          if (c <= 2) it({ t: T + 30 * c, i: j, tur: 'VURUS', nesil: g, isi: 1, k: 0 });
          else it({ t: T + 90, i: j, tur: 'ISI_DALGASI', nesil: g, isi: 1, k: 0 });
        }
    } else if (ad === 'roketYagmuru' || ad === 'bahce') {
      const renk = zincirRengi;
      let k = 0;
      for (let j = 0; j < N; j++) {
        const c = d.hucreler[j].icerik;
        if (c?.tur !== 'kapsul' || c.renk !== renk || planli[j] || c.ozel !== 'yok') continue;
        const yeni: OzelTur = ad === 'roketYagmuru' ? 'roket' : 'kasimpati';
        c.ozel = yeni;
        c.eksen = (k % 4) as Eksen;
        yay({ t: T, tur: 'ozelOlustu', hucre: xy(j), ozel: yeni, eksen: c.eksen, renk });
        planli[j] = 1;
        it({ t: T + 40 * (k + 1), i: j, tur: 'OZEL_ATES', nesil: g, isi: 1, k: 0 });
        k++;
      }
    } else {
      for (let j = 0; j < N; j++) {
        if (d.hucreler[j].delik || j === m) continue;
        const q = xy(j);
        const c = Math.max(Math.abs(q.x - x), Math.abs(q.y - y));
        it({ t: T + 40 * c, i: j, tur: 'VURUS', nesil: g, isi: 1, k: 0 });
      }
    }
  };

  const patlat = (e: K, neden: PatlamaNedeni) => {
    const m = e.i;
    const hc = d.hucreler[m];
    const c = hc.icerik;
    if (!c || c.tur !== 'kapsul') return;
    patladi[m] = 1;
    const p = xy(m);
    const puan = neden === 'fitil' ? 10 * e.k : neden === 'isi' ? 20 * e.nesil : 15;
    d.puan += puan;
    if (e.k === 0) R++;
    yay({ t: e.t, tur: 'patlama', hucre: p, renk: c.renk, neden, nesil: e.nesil, puan, ozel: c.ozel, k: e.k });
    hedefSay('topla', c.renk, e.t);
    hc.isikIzi = true;
    if (hc.kafes) {
      hc.kafes = false;
      yay({ t: e.t, tur: 'kafesKirildi', hucre: p });
      hedefSay('kafes', -1, e.t);
    }
    if (hc.doseme > 0) {
      hc.doseme = (hc.doseme - 1) as 0;
      yay({ t: e.t, tur: 'dosemeAydinlandi', hucre: p, kalan: hc.doseme });
      hedefSay('aydinlat', -1, e.t);
    }
    if (hc.desenRengi >= 0 && !hc.desenBoyali && (hc.desenRengi === c.renk || c.renk === -1)) {
      hc.desenBoyali = true;
      yay({ t: e.t, tur: 'desenBoyandi', hucre: p, renk: hc.desenRengi });
      hedefSay('desen', -1, e.t);
    }
    izTutustur(m, e.t, e.nesil);
    const ozel = c.ozel;
    const eksen = c.eksen;
    hc.icerik = null;
    if (ozel !== 'yok') {
      if (e.yukle) {
        yukluOzel = { ozel, eksen };
        yay({ t: e.t, tur: 'yuklendi', hucre: p, ozel });
      } else if (e.kombo && yukluOzel) kombo(m, { ozel, eksen }, e.t, e.nesil);
      else ozelEtki(m, ozel, eksen, e.t, e.nesil, c.renk >= 0 ? c.renk : zincirRengi >= 0 ? zincirRengi : enCok());
    }
    for (const [dx, dy] of DIK) {
      if (!ic(p.x + dx, p.y + dy)) continue;
      const j = (p.y + dy) * W + p.x + dx;
      isit(j, e.isi || 1, e.nesil, e.t);
      bitisikHasar(j, e.t, e.nesil);
    }
  };

  const izTutustur = (m: number, t: number, g: number) => {
    const hc = d.hucreler[m];
    if (hc.izIndeksi < 0) return;
    const iz = d.izler[hc.izIndeksi];
    const k = iz.hucreler.indexOf(m);
    if (k < 0 || iz.yandi[k]) return;
    iz.yandi[k] = true;
    yay({ t, tur: 'izYandi', hucre: xy(m) });
    for (const s of [-1, 1]) {
      const j = k + s;
      if (j < 0 || j >= iz.hucreler.length || iz.yandi[j]) continue;
      it({ t: t + 60, i: iz.hucreler[j], tur: 'IZ', nesil: g, isi: 1, k: 0, iz: s });
    }
  };

  const vurus = (e: K, neden: PatlamaNedeni) => {
    const m = e.i;
    const hc = d.hucreler[m];
    const c = hc.icerik;
    if (!c) return;
    if (c.tur === 'kapsul') {
      if (planli[m] || patladi[m]) return;
      planli[m] = 1;
      patlat(e, neden);
    } else bitisikHasar(m, e.t, e.nesil);
  };

  const enCok = () => {
    const say = [0, 0, 0, 0, 0, 0];
    for (const hc of d.hucreler) if (hc.icerik?.tur === 'kapsul' && hc.icerik.renk >= 0) say[hc.icerik.renk]++;
    return say.indexOf(Math.max(...say));
  };

  // --- Hamle → kuyruk --------------------------------------------------------
  const fitil = h.tur === 'fitil';
  if (h.tur === 'fitil') {
    const P = h.yol.map((p) => p.y * W + p.x);
    const n = P.length;
    for (const i of P) {
      const c = d.hucreler[i].icerik;
      if (c?.tur === 'kapsul' && c.renk >= 0) {
        zincirRengi = c.renk;
        break;
      }
    }
    if (zincirRengi < 0) zincirRengi = enCok();
    const carpan = h.halka ? 2 : 1;
    const [er, ek, ey] = d.ozelEsikleri;
    const sonC = d.hucreler[P[n - 1]].icerik;
    let donusum = -1;
    if (!h.halka && er > 0 && n >= er && sonC?.tur === 'kapsul' && sonC.ozel === 'yok') donusum = P[n - 1];
    const ozeller = P.filter((i) => i !== donusum && (d.hucreler[i].icerik as { ozel?: string })?.ozel !== 'yok');
    const [S1, S2] = ozeller.length >= 2 ? ozeller : [-1, -1];
    yay({ t: 0, tur: 'fitilBasladi', yol: h.yol.map((p) => ({ ...p })), halka: h.halka, renk: zincirRengi });
    let t = 0;
    for (let k = 0; k < n; k++) {
      if (k > 0) t += Math.max(35, 110 - 7 * k);
      planli[P[k]] = 1;
      yay({ t, tur: 'dugumYandi', hucre: xy(P[k]), k: k + 1 });
      if (P[k] === donusum) {
        const ozel: OzelTur = ey > 0 && n >= ey ? 'yildiz' : ek > 0 && n >= ek ? 'kasimpati' : 'roket';
        it({ t, i: P[k], tur: 'DONUSUM', nesil: 0, isi: 0, k: k + 1, ozelYeni: { ozel, eksen: eksenBul(h.yol[n - 2], h.yol[n - 1]) } });
      } else it({ t, i: P[k], tur: 'FITIL', nesil: 0, isi: carpan, k: k + 1, yukle: P[k] === S1, kombo: P[k] === S2 });
    }
    d.kalanHamle--;
    if (h.halka) {
      d.puan += 100;
      yay({ t: 0, tur: 'puanEklendi', miktar: 100, neden: 'halka' });
      hedefSay('halka', -1, 0);
    }
  } else if (h.tur === 'ciftDokunus' || h.tur === 'kibrit') {
    const i = h.hucre.y * W + h.hucre.x;
    if (h.tur === 'kibrit') yay({ t: 0, tur: 'guclendirici', guc: 'kibrit', hucre: { ...h.hucre } });
    else d.kalanHamle--;
    planli[i] = 1;
    it({ t: 0, i, tur: h.tur === 'kibrit' ? 'VURUS' : 'OZEL_ATES', nesil: 0, isi: 1, k: 0, neden: h.tur === 'kibrit' ? 'kibrit' : 'vurus' });
    if (h.tur === 'kibrit') planli[i] = 0;
  } else if (h.tur === 'koruk') {
    yay({ t: 0, tur: 'korukKullanildi', merkez: { ...h.merkez } });
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ic(h.merkez.x + dx, h.merkez.y + dy)) isit((h.merkez.y + dy) * W + h.merkez.x + dx, 1, 0, 0);
    d.korukDolum = 0;
  }

  // --- Ayrık olay simülasyonu -----------------------------------------------
  let guvenlik = 0;
  while (kuyruk.length && guvenlik++ < 5000) {
    let en = 0;
    for (let j = 1; j < kuyruk.length; j++) {
      const a = kuyruk[j];
      const b = kuyruk[en];
      if (a.t < b.t || (a.t === b.t && (a.i / W | 0) < (b.i / W | 0)) || (a.t === b.t && (a.i / W | 0) === (b.i / W | 0) && (a.i % W < b.i % W || (a.i === b.i && a.sira < b.sira)))) en = j;
    }
    const e = kuyruk.splice(en, 1)[0];
    switch (e.tur) {
      case 'FITIL':
        if (!patladi[e.i]) patlat(e, 'fitil');
        break;
      case 'ISI':
        if (!patladi[e.i]) {
          const c = d.hucreler[e.i].icerik;
          if (c?.tur === 'kapsul') {
            if (d.hucreler[e.i].kafes) {
              /* kafes eşikte kırılır: patlat içinde */
            }
            patlat(e, 'isi');
          }
        }
        break;
      case 'VURUS':
        vurus(e, e.neden ?? 'vurus');
        break;
      case 'IZ':
        izTutustur(e.i, e.t, e.nesil);
        vurus(e, 'iz');
        break;
      case 'OZEL_ATES':
        if (!patladi[e.i]) {
          planli[e.i] = 1;
          patlat({ ...e, k: 0 }, e.neden ?? 'vurus');
        }
        break;
      case 'ISI_DALGASI':
        isit(e.i, 1, e.nesil, e.t);
        break;
      case 'DONUSUM': {
        const c = d.hucreler[e.i].icerik;
        if (c?.tur !== 'kapsul' || !e.ozelYeni) break;
        const ozel = e.ozelYeni.ozel;
        d.hucreler[e.i].icerik = { tur: 'kapsul', renk: (ozel === 'yildiz' ? -1 : c.renk) as Renk, isi: 0, ozel, eksen: e.ozelYeni.eksen };
        patladi[e.i] = 1;
        yay({ t: e.t, tur: 'ozelOlustu', hucre: xy(e.i), ozel, eksen: e.ozelYeni.eksen, renk: c.renk });
        break;
      }
      case 'DEVFISEK_ATES': {
        const c = d.hucreler[e.i].icerik;
        if (c?.tur !== 'devFisek') break;
        const p = xy(e.i);
        yay({ t: e.t, tur: 'devFisekFirladi', hucre: p });
        d.hucreler[e.i].icerik = null;
        d.puan += 300;
        hedefSay('devFisek', -1, e.t);
        for (let y = p.y - 1; y >= 0; y--) if (ic(p.x, y)) it({ t: e.t + 30 * (p.y - y), i: y * W + p.x, tur: 'VURUS', nesil: e.nesil, isi: 1, k: 0, neden: 'devFisek' });
        break;
      }
    }
  }

  // --- Hamle sonu: yerçekimi + doldurma ---------------------------------------
  const tY = enGecT + 120;
  const dusenler: { den: Konum; e: Konum }[] = [];
  const doganlar: { hucre: Konum; icerik: Icerik; sanalY: number }[] = [];
  const sabit = (i: number) => {
    const hc = d.hucreler[i];
    const c = hc.icerik;
    if (!c) return false;
    if (c.tur === 'kapsul') return hc.kafes;
    return c.tur === 'kaya' || c.tur === 'kova' || c.tur === 'devFisek' || c.tur === 'is';
  };
  for (let x = 0; x < W; x++) {
    const S: number[] = [];
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      if (d.hucreler[i].delik || sabit(i)) continue;
      S.push(i);
    }
    const hareketli = S.filter((i) => d.hucreler[i].icerik);
    const icerikler = hareketli.map((i) => d.hucreler[i].icerik);
    for (const i of S) d.hucreler[i].icerik = null;
    hareketli.forEach((den, k) => {
      const e = S[k];
      d.hucreler[e].icerik = icerikler[k];
      if (den !== e) dusenler.push({ den: xy(den), e: xy(e) });
    });
    let sanal = -1;
    for (let k = hareketli.length; k < S.length; k++) {
      const e = S[k];
      const renk = rnd.int(d.renkSayisi) as Renk;
      const yeni: Icerik = { tur: 'kapsul', renk, isi: 0, ozel: 'yok', eksen: 0 };
      d.hucreler[e].icerik = yeni;
      doganlar.push({ hucre: xy(e), icerik: { ...yeni }, sanalY: sanal-- });
    }
  }
  // sanalY: tahta üstünde, en üstteki doğan −1'de olacak biçimde sırala.
  const sutunlar = new Map<number, typeof doganlar>();
  for (const dg of doganlar) {
    const l = sutunlar.get(dg.hucre.x) ?? [];
    l.push(dg);
    sutunlar.set(dg.hucre.x, l);
  }
  for (const l of sutunlar.values()) {
    l.sort((a, b) => b.hucre.y - a.hucre.y);
    const n = l.length;
    for (const dg of l) dg.sanalY = dg.hucre.y - n;
  }
  if (dusenler.length || doganlar.length) yay({ t: tY, tur: 'yercekimi', dusenler, doganlar });

  // Fener toplama (çıkış yuvası: sütunun en alt deliksiz hücresi).
  const tF = tY + 350;
  for (const x of d.cikislar) {
    for (let y = H - 1; y >= 0; y--) {
      const hc = d.hucreler[y * W + x];
      if (hc.delik) continue;
      if (hc.icerik?.tur === 'fener') {
        hc.icerik = null;
        d.puan += 200;
        yay({ t: tF, tur: 'fenerToplandi', hucre: { x, y } });
        hedefSay('fener', -1, tF);
      }
      break;
    }
  }
  // Reaksiyon özeti.
  const kademe = R >= 40 ? 'senlik' : R >= 25 ? 'muhtesem' : R >= 15 ? 'harika' : R >= 8 ? 'guzel' : null;
  const pencere = new Map<number, number[]>();
  for (const o of olaylar) if (o.tur === 'patlama') pencere.set(Math.floor(o.t / 90), [...(pencere.get(Math.floor(o.t / 90)) ?? []), o.hucre.x * 100 + o.hucre.y]);
  let zirveW = 0;
  let zirveN = 0;
  for (const [w, l] of pencere) if (l.length > zirveN) [zirveW, zirveN] = [w, l.length];
  const zl = pencere.get(zirveW) ?? [0];
  const merkez = { x: zl.reduce((a, v) => a + Math.floor(v / 100), 0) / zl.length, y: zl.reduce((a, v) => a + (v % 100), 0) / zl.length };
  const tSon = Math.max(enGecT, tF);
  if (kademe) {
    const bonus = { guzel: 100, harika: 300, muhtesem: 600, senlik: 1200 }[kademe];
    d.puan += bonus;
    yay({ t: tSon, tur: 'puanEklendi', miktar: bonus, neden: 'reaksiyon', kademe });
  }
  if (fitil || h.tur === 'ciftDokunus') d.hamleNo++;
  yay({ t: tSon, tur: 'reaksiyon', boyut: R, zirveT: zirveW * 90 + 45, merkez, kombo: komboVar, kademe });
  olaylar.sort((a, b) => a.t - b.t);
  return { durum: d, olaylar };
}

/** Sade önizleme (§3.9): ilk dalga eşik hücreleri, ısınacaklar, özel hayaleti, etki alanları. */
export function sahteOnizle(d: OyunDurumu, yol: readonly Konum[], halka: boolean): Onizleme {
  const W = d.w;
  const n = yol.length;
  const yolda = new Set(yol.map((p) => p.y * W + p.x));
  let renk = -1;
  for (const p of yol) {
    const c = d.hucreler[p.y * W + p.x].icerik;
    if (c?.tur === 'kapsul' && c.renk >= 0) {
      renk = c.renk;
      break;
    }
  }
  const artis = new Map<number, number>();
  const kalkan = new Set<number>();
  d.hucreler.forEach((h, i) => {
    if (h.icerik?.tur !== 'kova') return;
    for (const [dx, dy] of DIK) kalkan.add(i + dy * W + dx);
  });
  for (const p of yol) {
    for (const [dx, dy] of DIK) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= d.h) continue;
      const j = y * W + x;
      if (yolda.has(j) || kalkan.has(j) || d.hucreler[j].icerik?.tur !== 'kapsul') continue;
      artis.set(j, (artis.get(j) ?? 0) + (halka ? 2 : 1));
    }
  }
  const esikHucreler: Konum[] = [];
  const isinacaklar: { hucre: Konum; artis: number }[] = [];
  for (const [j, a] of artis) {
    const c = d.hucreler[j].icerik as { isi: number };
    const p = { x: j % W, y: (j / W) | 0 };
    isinacaklar.push({ hucre: p, artis: a });
    if (c.isi + a >= d.esik) esikHucreler.push(p);
  }
  const [er, ek, ey] = d.ozelEsikleri;
  let ozelHayalet: Onizleme['ozelHayalet'] = null;
  const son = yol[n - 1];
  const sonC = son ? d.hucreler[son.y * W + son.x].icerik : null;
  if (!halka && n >= 2 && er > 0 && n >= er && sonC?.tur === 'kapsul' && sonC.ozel === 'yok') {
    const ozel: OzelTur = ey > 0 && n >= ey ? 'yildiz' : ek > 0 && n >= ek ? 'kasimpati' : 'roket';
    ozelHayalet = { hucre: { ...son }, ozel, eksen: eksenBul(yol[n - 2], son) };
  }
  const etkiAlanlari: Onizleme['etkiAlanlari'] = [];
  const ozeller: OzelTur[] = [];
  for (const p of yol) {
    const c = d.hucreler[p.y * W + p.x].icerik;
    if (c?.tur !== 'kapsul' || c.ozel === 'yok') continue;
    ozeller.push(c.ozel);
    const hucreler: Konum[] = [];
    if (c.ozel === 'roket') {
      const [dx, dy] = c.eksen === 0 ? [1, 0] : c.eksen === 1 ? [0, 1] : c.eksen === 2 ? [1, -1] : [1, 1];
      for (const s of [1, -1])
        for (let k = 1; ; k++) {
          const x = p.x + dx * s * k;
          const y = p.y + dy * s * k;
          if (x < 0 || y < 0 || x >= W || y >= d.h) break;
          hucreler.push({ x, y });
        }
    } else if (c.ozel === 'kasimpati') {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && p.x + dx >= 0 && p.x + dx < W && p.y + dy >= 0 && p.y + dy < d.h) hucreler.push({ x: p.x + dx, y: p.y + dy });
    }
    etkiAlanlari.push({ kaynak: { ...p }, hucreler });
  }
  let kombo: Onizleme['kombo'] = null;
  if (ozeller.length >= 2) {
    const t = [ozeller[0], ozeller[1]].sort().join('+');
    kombo = t === 'roket+roket' ? 'yildizHatti' : t === 'kasimpati+roket' ? 'kalinRoket' : t === 'kasimpati+kasimpati' ? 'devKasimpati' : t === 'roket+yildiz' ? 'roketYagmuru' : t === 'kasimpati+yildiz' ? 'bahce' : 'buyukFinal';
  }
  return { gecerli: n >= 3, renk, esikHucreler, isinacaklar, ozelHayalet, etkiAlanlari, kombo };
}

/** Sade final gösterisi: m kapsül sırayla rokete döner ve ateşlenir (§7.3 adım 1). */
export function sahteFinal(d0: OyunDurumu, tohum = 3): HamleSonucu {
  const d = structuredClone(d0);
  const rnd = new Rng(tohum);
  const olaylar: Olay[] = [{ t: 0, tur: 'finalBasladi', kalanHamle: d.kalanHamle }];
  const m = Math.min(5, d.kalanHamle);
  let son = 0;
  let ara = d;
  for (let k = 0; k < m; k++) {
    const duz: number[] = [];
    ara.hucreler.forEach((h, i) => h.icerik?.tur === 'kapsul' && h.icerik.ozel === 'yok' && !h.kafes && duz.push(i));
    if (!duz.length) break;
    const i = duz[rnd.int(duz.length)];
    const c = ara.hucreler[i].icerik as Extract<Icerik, { tur: 'kapsul' }>;
    const eksen = rnd.int(4) as Eksen;
    c.ozel = 'roket';
    c.eksen = eksen;
    const t0 = son + 120;
    olaylar.push({ t: t0, tur: 'ozelOlustu', hucre: { x: i % d.w, y: (i / d.w) | 0 }, ozel: 'roket', eksen, renk: c.renk });
    const r = sahteHamle(ara, { tur: 'ciftDokunus', hucre: { x: i % d.w, y: (i / d.w) | 0 } }, tohum + k);
    for (const o of r.olaylar) if (o.tur !== 'reaksiyon') olaylar.push({ ...o, t: o.t + t0 + 40 } as Olay);
    son = t0 + 40 + Math.max(0, ...r.olaylar.map((o) => o.t));
    ara = r.durum;
  }
  ara.kalanHamle = 0;
  olaylar.sort((a, b) => a.t - b.t);
  olaylar.push({ t: (olaylar[olaylar.length - 1]?.t ?? 0) + 60, tur: 'bolumBitti', sonuc: 'kazanc' });
  return { durum: ara, olaylar };
}
