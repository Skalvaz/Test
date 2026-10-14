/**
 * Ses ölçümü (P2b): sesleri OfflineAudioContext'te gerçek motorla işler,
 * tepe / RMS ölçer; kırpılma (|örnek| > 1) ve sessizlik denetler.
 *
 * Node'da OfflineAudioContext yok; ölçüm tarayıcıda çalışır:
 *   dev/ses.html → "Ölç" düğmesi ya da
 *   node scripts/shot.mjs http://localhost:5182/dev/ses.html out.png 390 844 1500 "window.__olc()"
 * (sonuç konsola yazılır).
 */
import type { Olay } from '../core/types';
import type { SesMotoru } from '../app/sozlesme';
import { sesMotoruOlustur, type SesMotoruAyrintili } from './sesMotoru';
import { OLAY_CESITLERI, ORNEK_OLAYLAR, SESSIZ_OLAYLAR, fitilGosterisi } from './gosteri';

export interface OlcumSenaryosu {
  ad: string;
  /** İşlenecek süre (s). */
  sure: number;
  /** Bilinçli sessizlik: ses üretmemeli. */
  sessizBeklenir?: boolean;
  calis(m: SesMotoruAyrintili, zamanla: (t: number, fn: () => void) => void): void;
}

export interface OlcumSonucu {
  ad: string;
  tepe: number;
  tepeDb: number;
  /** Bütün süre boyunca RMS (dBFS). */
  rmsDb: number;
  /** En gürültülü 50 ms penceresinin RMS'i (dBFS) — algılanan yükseklik. */
  pencereDb: number;
  /** |örnek| > 1 sayısı (0 olmalı). */
  kirpilan: number;
  /** |örnek| > 0,8 (yumuşak kırpıcının dizi) sayısı. */
  bozulma: number;
  sessiz: boolean;
  tamam: boolean;
}

const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const SESSIZLIK_ESIGI = 1e-3;

type CevrimdisiSinif = new (kanal: number, uzunluk: number, oran: number) => OfflineAudioContext;

export async function senaryoOlc(s: OlcumSenaryosu, oran = 44100): Promise<OlcumSonucu> {
  const OAC = (globalThis as unknown as { OfflineAudioContext?: CevrimdisiSinif; webkitOfflineAudioContext?: CevrimdisiSinif }).OfflineAudioContext ??
    (globalThis as unknown as { webkitOfflineAudioContext?: CevrimdisiSinif }).webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext yok');
  const ctx = new OAC(2, Math.ceil(s.sure * oran), oran);
  const m = sesMotoruOlustur({ baglam: ctx, tohum: 7 });
  m.ac();
  // Aynı işleme dilimine düşen çağrılar tek askıda toplanır.
  const dilim = 128 / oran;
  const bekleyen = new Map<number, (() => void)[]>();
  const simdi: (() => void)[] = [];
  s.calis(m, (t, fn) => {
    if (t <= 0) {
      simdi.push(fn);
      return;
    }
    const k = Math.max(1, Math.round(t / dilim));
    const l = bekleyen.get(k);
    if (l) l.push(fn);
    else bekleyen.set(k, [fn]);
  });
  for (const fn of simdi) fn();
  for (const [k, l] of bekleyen) {
    if (k * dilim >= s.sure) continue;
    void ctx.suspend(k * dilim).then(() => {
      for (const fn of l) fn();
      return ctx.resume();
    });
  }
  const buf = await ctx.startRendering();
  let tepe = 0;
  let kare = 0;
  let kirpilan = 0;
  let bozulma = 0;
  const n = buf.length;
  const pencere = Math.max(1, Math.floor(oran * 0.05));
  const pencereKare = new Float64Array(Math.ceil(n / pencere));
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const v = d[i];
      const a = Math.abs(v);
      if (a > tepe) tepe = a;
      if (a > 1) kirpilan++;
      if (a > 0.8) bozulma++;
      kare += v * v;
      pencereKare[(i / pencere) | 0] += v * v;
    }
  }
  const rms = Math.sqrt(kare / (n * buf.numberOfChannels));
  let enPencere = 0;
  for (const v of pencereKare) enPencere = Math.max(enPencere, v);
  const pencereRms = Math.sqrt(enPencere / (pencere * buf.numberOfChannels));
  const sessiz = tepe < SESSIZLIK_ESIGI;
  return {
    ad: s.ad,
    tepe,
    tepeDb: db(tepe),
    rmsDb: db(rms),
    pencereDb: db(pencereRms),
    kirpilan,
    bozulma,
    sessiz,
    tamam: kirpilan === 0 && sessiz === !!s.sessizBeklenir,
  };
}

export async function olc(senaryolar: OlcumSenaryosu[] = varsayilanSenaryolar(), oran = 44100, ilerleme?: (r: OlcumSonucu, i: number) => void): Promise<OlcumSonucu[]> {
  const out: OlcumSonucu[] = [];
  for (let i = 0; i < senaryolar.length; i++) {
    const r = await senaryoOlc(senaryolar[i], oran);
    out.push(r);
    ilerleme?.(r, i);
  }
  return out;
}

/** "Fitil çiz" benzetimi: düğüm arpeji (çizerken), bırakma, patlama dizisi, ısı dalgaları. */
export function fitilCizBenzetimi(m: SesMotoru, zamanla: (t: number, fn: () => void) => void, n: number, bas = 0): number {
  const ARALIK = 0.13;
  for (let k = 1; k <= n; k++) {
    const t = bas + (k - 1) * ARALIK;
    zamanla(t, () => {
      m.dugumEklendi(k);
      if (k === 6) m.ozelEsigi('roket');
      if (k === 9) m.ozelEsigi('kasimpati');
      if (k === 12) m.ozelEsigi('yildiz');
    });
  }
  const birak = bas + n * ARALIK + 0.15;
  const olaylar = fitilGosterisi(n);
  for (const o of olaylar) zamanla(birak + o.t / 1000, () => m.olay(o));
  return birak + (olaylar[olaylar.length - 1]?.t ?? 0) / 1000;
}

const tek = (ad: string, sure: number, fn: (m: SesMotoruAyrintili) => void, sessizBeklenir = false): OlcumSenaryosu => ({
  ad,
  sure,
  sessizBeklenir,
  calis: (m, z) => z(0, () => fn(m)),
});

export function varsayilanSenaryolar(): OlcumSenaryosu[] {
  const s: OlcumSenaryosu[] = [];
  // Çizim sesleri
  for (const k of [1, 6, 11, 12]) s.push(tek(`çizim · düğüm ${k}${k >= 11 ? ' (parıltı)' : ''}`, 0.7, (m) => m.dugumEklendi(k)));
  s.push(tek('çizim · geri al', 0.6, (m) => m.geriAlindi(3)));
  s.push(tek('çizim · halka', 1.4, (m) => m.halkaKapandi(4)));
  for (const t of ['roket', 'kasimpati', 'yildiz'] as const) s.push(tek(`çizim · özel eşiği ${t}`, 1.2, (m) => m.ozelEsigi(t)));
  s.push(tek('çizim · iptal', 0.5, (m) => m.iptal()));
  s.push(tek('çizim · tutuşma', 0.7, (m) => m.tutusma()));
  // Her olay türü
  for (const o of Object.values(ORNEK_OLAYLAR) as Olay[]) {
    const sessiz = SESSIZ_OLAYLAR.some((x) => x.tur === o.tur && JSON.stringify(x) === JSON.stringify(o));
    s.push(tek(`olay · ${o.tur}`, 2.4, (m) => m.olay(o), sessiz));
  }
  for (const o of SESSIZ_OLAYLAR) if (o.tur !== 'isiDegisti') s.push(tek(`olay · ${o.tur} (sessiz)`, 1, (m) => m.olay(o), true));
  for (const c of OLAY_CESITLERI) s.push(tek(`olay · ${c.ad}`, 2.6, (m) => m.olay(c.olay)));
  // Arayüz
  for (const a of ['dugme', 'ac', 'kapa', 'yildiz1', 'yildiz2', 'yildiz3', 'kazandin', 'kaybettin', 'sandik', 'parca', 'sonHamle', 'hedefTamam', 'korukDoldu'] as const) {
    s.push(tek(`arayüz · ${a}`, 2.2, (m) => m.arayuz(a)));
  }
  // Diziler ve zorlama
  s.push({ ad: 'dizi · fitil çiz (12 düğüm + ısı dalgaları)', sure: 5, calis: (m, z) => void fitilCizBenzetimi(m, z, 12) });
  s.push({ ad: 'dizi · fitil çiz (5 düğüm)', sure: 3.5, calis: (m, z) => void fitilCizBenzetimi(m, z, 5) });
  s.push({
    ad: 'zorlama · 40 pop + büyük final + kasımpatı + yıldız',
    sure: 3,
    calis: (m, z) =>
      z(0, () => {
        for (let i = 0; i < 40; i++) m.olay({ ...ORNEK_OLAYLAR.patlama, neden: i % 2 ? 'isi' : 'vurus', nesil: 1 + (i % 4), hucre: { x: i % 7, y: i % 9 } });
        m.olay({ ...ORNEK_OLAYLAR.kombinasyon, kombo: 'buyukFinal' });
        m.olay({ ...ORNEK_OLAYLAR.ozelTetiklendi, ozel: 'kasimpati' });
        m.olay({ ...ORNEK_OLAYLAR.ozelTetiklendi, ozel: 'yildiz' });
        m.olay({ ...ORNEK_OLAYLAR.devFisekFirladi });
      }),
  });
  s.push({
    ad: 'zorlama · roket yağmuru (25 ms aralı 60 vuruş)',
    sure: 2.5,
    calis: (m, z) => {
      for (let i = 0; i < 60; i++) z(i * 0.025, () => m.olay({ ...ORNEK_OLAYLAR.patlama, neden: 'vurus', k: 0, hucre: { x: i % 7, y: (i * 3) % 9 } }));
      for (let i = 0; i < 8; i++) z(i * 0.04, () => m.olay({ ...ORNEK_OLAYLAR.ozelTetiklendi, eksen: (i % 4) as 0 | 1 | 2 | 3, hucre: { x: i % 7, y: i } }));
    },
  });
  s.push({
    ad: 'yavaş çekim · alçak geçiren 1,2 kHz',
    sure: 1.5,
    calis: (m, z) => {
      z(0, () => m.yavasCekim(true));
      for (let i = 0; i < 6; i++) z(0.1 + i * 0.09, () => m.olay({ ...ORNEK_OLAYLAR.patlama, neden: 'isi', nesil: i + 1 }));
      z(1, () => m.yavasCekim(false));
    },
  });
  s.push({ ad: 'ortam · kalabalık + deniz (6 sn)', sure: 6, calis: (m, z) => z(0, () => m.ortam(true)) });
  s.push({ ad: 'müzik · üretken ped (10 sn)', sure: 10, calis: (m, z) => z(0, () => m.muzik(true)) });
  s.push({
    ad: 'karışım · ortam + müzik + fitil çiz + kısma',
    sure: 8,
    calis: (m, z) => {
      z(0, () => {
        m.ortam(true);
        m.muzik(true);
      });
      fitilCizBenzetimi(m, z, 10, 3);
    },
  });
  s.push({
    ad: 'sessiz ayarı · hiç ses yok',
    sure: 1,
    sessizBeklenir: true,
    calis: (m, z) =>
      z(0, () => {
        m.ayarla({ sessiz: true });
        m.dugumEklendi(3);
        m.olay(ORNEK_OLAYLAR.kombinasyon);
        m.arayuz('kazandin');
      }),
  });
  return s;
}
