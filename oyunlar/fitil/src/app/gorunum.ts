/**
 * Meta/çekirdek verisinden arayüz görünüm modellerine eşleme (P5). Saf
 * işlevler: kayıt ve durum okunur, düz VM döner (DOM yok).
 */
import type { BolumVerisi, HedefDurumu, OyunDurumu } from '../core/types';
import type {
  AyarlarVM,
  BolumOncesiVM,
  DefterVM,
  DuraklatVM,
  EngelId,
  GunlukVM,
  HaritaVM,
  HedefVM,
  HudVM,
  IstatistikVM,
  KaybettinVM,
  KazandinVM,
  MuhurVM,
  Nadirlik as UiNadirlik,
  NasilVM,
  OdulVM,
  SandikVM,
  SeriBasamagi,
  YeniOge,
  Yildiz,
} from '../ui/tipler';
import * as meta from '../meta';
import type { Kayit } from '../meta';
import { DESENLER, FITILLER, GUCLENDIRICILER, MAHALLELER } from './katalog';
import { BOLUMLER, bolumGetir } from '../levels';
import { MK } from '../ui/metinler';
import type { StorageBackend } from '../platform/storage';

export const NADIRLIK: readonly UiNadirlik[] = ['sade', 'parlak', 'saheser'];

/** Yeni öğe tanıtımı (bölüm öncesi kartı, "Sıradaki: X!"), §8.3 "Yeni öğe" sütunu. */
const YENI_OGE: Partial<Record<number, YeniOge>> = {
  1: 'cizim',
  2: 'capraz',
  3: 'isi',
  4: 'kafes',
  5: 'nisan',
  6: 'kasimpati',
  7: 'islak',
  8: 'halka',
  9: 'doseme',
  11: 'fener',
  12: 'yildiz',
  13: 'kaya',
  14: 'kombo',
  16: 'devFisek',
  17: 'koruk',
  18: 'kova',
  19: 'bayram',
  21: 'barutIzi',
  22: 'altiRenk',
  23: 'delik',
  24: 'doseme2',
  26: 'desen',
  27: 'esik5',
  29: 'meltem',
  31: 'is',
  33: 'cisenti',
  34: 'bayram',
  39: 'bayram',
};

export function yeniOge(id: number): YeniOge | null {
  return YENI_OGE[id] ?? null;
}

/** Engellerin tanıtıldığı bölüm (Nasıl oynanır > Engeller kartı). */
const ENGEL_ACILIS: Record<EngelId, number> = {
  kafes: 4,
  islak: 7,
  doseme: 9,
  fener: 11,
  kaya: 13,
  devFisek: 16,
  kova: 18,
  barutIzi: 21,
  delik: 23,
  desen: 26,
  meltem: 29,
  is: 31,
  cisenti: 33,
};

export function hedefVM(h: HedefDurumu): HedefVM {
  const hd = h.hedef;
  return {
    tur: hd.tur,
    renk: hd.tur === 'topla' ? hd.renk : undefined,
    motif: hd.tur === 'desen' ? hd.motif : undefined,
    esik: hd.tur === 'zincirleme' ? hd.esik : undefined,
    gerekli: h.gerekli,
    ilerleme: h.ilerleme,
    tamam: h.tamam,
  };
}

export function hedefler(d: OyunDurumu): HedefVM[] {
  return d.hedefler.map(hedefVM);
}

// ─────────────────────────── Mühürler (Kancalar §C.2–§C.4) ───────────────────────────

/**
 * Bölümün üç mühür satırı: yalnız mühürlü ana bölümde (6–40) ve mühürler
 * tanıtıldıysa (6. bölüm kazanıldı; KANCALAR §A.2). `oz` verilirse (oyun
 * sürerken) anlık durumlar `muhurAnlik` ile eklenir.
 */
export function muhurVMleri(v: BolumVerisi, k: Kayit, oz?: { oz: meta.OyunOzeti; d: OyunDurumu }): MuhurVM[] | undefined {
  if (!v.muhurler || v.muhurler.length !== meta.MUHUR_SAYISI) return undefined;
  if (v.tur === 'gunluk' || v.tur === 'sonsuz' || v.tur === 'usta') return undefined;
  if (!meta.muhurlerGorunur(k)) return undefined;
  const basili = meta.muhurMaskeCoz(meta.bolumKaydi(k, v.id)?.muhur);
  const anlik = oz ? meta.muhurAnlik(v, meta.muhurOzeti(oz.oz, oz.d)) : null;
  return v.muhurler.map((m, i) => ({
    kademe: meta.MUHUR_KADEMELERI[i],
    metin: meta.muhurMetni(m),
    basili: basili[i],
    ...(anlik ? { durum: anlik[i] } : {}),
  }));
}

export interface HudBaglam {
  v: BolumVerisi;
  d: OyunDurumu;
  kayit: Kayit;
  /** (Kancalar §C.3) Bu denemenin olay özeti: rozetin anlık durumları. */
  oz?: meta.OyunOzeti;
  /** Girdi açık mı (güçlendirici basılabilirliği). */
  girdiAcik: boolean;
  /** Geri Sar için son eylem bir hamle mi. */
  geriSarHazir: boolean;
}

export function hudVM(b: HudBaglam): HudVM {
  const { v, d, kayit } = b;
  const kullanildi = d.istatistik.guclendirici > 0;
  return {
    bolumId: v.id,
    bolumAdi: v.ad,
    tahtaW: d.w,
    tahtaH: d.h,
    hedefler: hedefler(d),
    kalanHamle: d.kalanHamle,
    toplamHamle: Math.max(d.toplamHamle, d.kalanHamle),
    puan: d.puan,
    yildizEsikleri: [v.yildizEsikleri[0], v.yildizEsikleri[1]],
    yildizSiniri: meta.yildizSiniri(d.istatistik) as 1 | 2 | 3,
    korukDolum: d.korukDolum,
    korukKapasite: d.korukKapasite,
    guclendiriciler: GUCLENDIRICILER.map((g) => {
      const adet = kayit.guclendiriciler[g.id] ?? 0;
      const acik = meta.guclendiriciAcik(kayit, g.id);
      const uygun = g.id === 'geriSar' ? b.geriSarHazir : true;
      return { id: g.id, adet, acik, kullanilabilir: acik && adet > 0 && !kullanildi && b.girdiAcik && uygun };
    }),
    muhurler: muhurVMleri(v, kayit, { oz: b.oz ?? meta.ozetBaslat(), d }),
  };
}

// ─────────────────────────── Harita ───────────────────────────

export function haritaVM(k: Kayit, gorulen: { parca: number; rozet: number }): HaritaVM {
  const hv = meta.haritaVerisi(k);
  const bolumler: HaritaVM['bolumler'] = [];
  const ustalar: HaritaVM['ustalar'] = [];
  for (const d of hv.dugumler) {
    if (d.tur === 'bolum')
      bolumler.push({
        id: d.id,
        yildiz: d.yildiz,
        durum: d.durum === 'kazanildi' ? 'acik' : d.durum === 'acik' ? 'simdiki' : 'kilitli',
        // (Kancalar) Mühür sayısı ve 3/3'te çatı sancağı (mühürsüz bölümde yok).
        ...(d.muhur !== null ? { muhur: meta.muhurSayisi(d.muhur), sancak: d.sancak } : {}),
      });
    else ustalar.push({ id: d.id, acik: d.durum !== 'kilitli', yildiz: d.yildiz, gerekenYildiz: d.gerekenYildiz });
  }
  const motifler: HaritaVM['motifler'] = [];
  for (const m of hv.mahalleler) for (const mo of m.motifler) motifler.push({ motif: mo, mahalle: m.indeks });
  const bi = meta.seriBasamakIndeksi(k.gunluk.seri);
  return {
    toplamYildiz: hv.toplamYildiz,
    bolumler,
    ustalar,
    motifler,
    seri: { gun: k.gunluk.seri, basamak: bi >= 0 ? (meta.SERI_BASAMAKLARI[bi].id as SeriBasamagi) : null },
    gunluk: { acik: hv.gunluk.acik, tamam: hv.gunluk.gorevTamam, toplam: hv.gunluk.gorevToplam },
    defterYeni: k.koleksiyon.parcalar.length > gorulen.parca,
    rozetYeni: k.rozetler.length > gorulen.rozet,
    sonsuz: { acik: hv.sonsuz.acik, siradaki: hv.sonsuz.siradaki },
    // (Kancalar §C.1, §B.6) Kasaba düğmesi ve harita süsleri.
    kasaba: { acik: hv.kasaba.acik, kandil: hv.kasaba.kandil, isler: hv.kasaba.isler, yapilabilir: hv.kasaba.yapilabilir },
  };
}

// ─────────────────────────── Bölüm öncesi ───────────────────────────

export function bolumOncesiVM(v: BolumVerisi, d0: OyunDurumu, k: Kayit, cosku: boolean, muhurIpucu: string | null = null): BolumOncesiVM {
  const muhurler = muhurVMleri(v, k);
  const b = meta.bolumKaydi(k, v.id);
  const usta = v.tur === 'usta' ? meta.USTA_BOLUMLERI[v.id - 101] : null;
  return {
    id: v.id,
    ad: v.ad,
    mahalle: Math.max(0, Math.min(7, v.mahalle)),
    tur: v.tur,
    hedefler: hedefler(d0),
    hamle: d0.kalanHamle,
    esik: v.esik,
    yeniOge: v.tur === 'gunluk' || v.tur === 'sonsuz' || v.tur === 'usta' ? null : yeniOge(v.id),
    ustaKurali: usta ? usta.kural : null,
    enIyi: b && b.enIyi > 0 ? b.enIyi : null,
    yildiz: (b?.yildiz ?? 0) as Yildiz,
    tablo: b?.tablo ? { nadirlik: NADIRLIK[b.nadirlik ?? 0] } : null,
    cosku,
    ...(muhurler ? { muhurler, muhurIpucu } : {}),
  };
}

export function duraklatVM(v: BolumVerisi, d: OyunDurumu, coskuAktif: boolean, k?: Kayit, oz?: meta.OyunOzeti): DuraklatVM {
  const muhurler = k ? muhurVMleri(v, k, { oz: oz ?? meta.ozetBaslat(), d }) : undefined;
  return { bolumId: v.id, bolumAdi: v.ad, hedefler: hedefler(d), coskuAktif, ...(muhurler ? { muhurler, ustaEli: d.istatistik.ustaEli === true } : {}) };
}

// ─────────────────────────── Sonuçlar ───────────────────────────

/** Sandık çekilişleri → arayüz ödülleri. Parça sayısı kayıt öncesinden adım adım sayılır. */
export function sandiklarVM(onceki: Kayit, oduller: readonly meta.Odul[]): SandikVM[] {
  const sahip = new Set(onceki.koleksiyon.parcalar);
  const sayi = (kategori: 'desen' | 'fitil', id: string) => {
    let n = 0;
    for (let i = 0; i < 3; i++) if (sahip.has(meta.parcaId(kategori, id, i))) n++;
    return n;
  };
  const r: SandikVM[] = [];
  for (const o of oduller) {
    if (o.tur !== 'sandik') continue;
    const liste: OdulVM[] = [];
    for (const c of o.sandik.cekilisler) {
      if (c.tur === 'guclendirici') liste.push({ tur: 'guclendirici', id: c.guc, adet: c.adet });
      else if (c.tur === 'toz') liste.push({ tur: 'toz', adet: c.adet });
      else {
        sahip.add(c.parca);
        const parca = Math.max(1, sayi(c.kategori, c.hedef));
        if (c.kategori === 'desen') liste.push({ tur: 'desenParcasi', id: c.hedef as never, parca, tekrar: !c.yeni });
        else liste.push({ tur: 'fitilParcasi', id: c.hedef as never, parca, tekrar: !c.yeni });
      }
    }
    r.push({ tur: o.sandik.tur, oduller: liste });
  }
  return r;
}

export function kaybettinVM(v: BolumVerisi, d: OyunDurumu, hayalet: KaybettinVM['hayalet'], ustaEli: boolean, coskuSifirlandi: boolean): KaybettinVM {
  // En az ilerlemeli (tamamlanmamış) hedef: "%92 — 3 kızıl kaldı".
  let en: HedefDurumu | null = null;
  let enOran = 2;
  for (const h of d.hedefler) {
    if (h.tamam) continue;
    const o = h.gerekli > 0 ? h.ilerleme / h.gerekli : 1;
    if (o < enOran) {
      enOran = o;
      en = h;
    }
  }
  const yuzde = d.hedefler.length ? d.hedefler.reduce((s, h) => s + (h.gerekli <= 0 ? 1 : Math.min(1, h.ilerleme / h.gerekli)), 0) / d.hedefler.length : 0;
  return { bolumId: v.id, bolumAdi: v.ad, yuzde, enZorHedef: en ? hedefVM(en) : null, hayalet, ustaEli, coskuSifirlandi };
}

// ─────────────────────────── Ayarlar, defter, günlük ───────────────────────────

export function ayarlarVM(k: Kayit, depo: StorageBackend, hareketiAzaltSistem: boolean, surum: string): AyarlarVM {
  const a = k.ayarlar;
  return {
    sfx: a.sfx,
    muzik: a.muzik,
    ortam: a.ortam,
    titresim: a.titresim,
    hareketiAzalt: a.hareketiAzalt ?? hareketiAzaltSistem,
    hiz: a.hiz,
    palet: a.palet,
    ipuclari: a.ipuclari,
    mola: a.mola,
    defterKartlari: MAHALLELER.map((m) => k.koleksiyon.kartlar.includes(`defter:${m.id}`)),
    depolama: depo,
    surum,
  };
}

export function defterVM(k: Kayit, sekme?: DefterVM['sekme']): DefterVM {
  return {
    toz: k.toz,
    desenler: meta.desenDurumlari(k).map((d) => ({ id: d.id, parca: d.parcalar.filter(Boolean).length, takili: d.takili })),
    fitiller: meta.fitilDurumlari(k).map((f) => ({ id: f.id, parca: f.parcalar.filter(Boolean).length, secili: f.secili })),
    gokyuzleri: meta.gokyuzuDurumlari(k).map((g) => ({ id: g.id, acik: g.acik, secili: g.secili })),
    tablolar: meta.tabloListesi(k).map((t) => ({ bolumId: t.bolumId, ad: bolumGetir(t.bolumId)?.ad ?? `Bölüm ${t.bolumId}`, nadirlik: NADIRLIK[t.nadirlik] })),
    motifler: meta.motifDurumlari(k).map((m) => ({ motif: m.id, acik: m.asili })),
    kartlar: MAHALLELER.map((m) => k.koleksiyon.kartlar.includes(`defter:${m.id}`)),
    sekme,
  };
}

/**
 * (Kancalar §C.5) Kazandın ekranının mühür satırı, kandil çipi ve "iş hazır"
 * ipucu. `gorulen`: kaydın görülen ipuçları (tanıtım bir kez).
 */
export function kazandinKancalari(v: BolumVerisi, sonuc: meta.BolumSonucCiktisi, gorulen: readonly string[]): Pick<KazandinVM, 'muhurler' | 'kandil' | 'kasabaHazir'> {
  const k = sonuc.kayit;
  const o = sonuc.oduller;
  let muhurler: KazandinVM['muhurler'] = null;
  const satir = muhurVMleri(v, k);
  if (satir) {
    const mo = o.find((x): x is Extract<meta.Odul, { tur: 'muhur' }> => x.tur === 'muhur');
    const yeni = new Set(mo?.yeni ?? []);
    muhurler = {
      liste: satir.map((m) => ({ ...m, yeni: yeni.has(m.kademe) })),
      tanitim: !!mo?.tanitim && !gorulen.includes(meta.KANCA_IPUCU.muhurTanitim),
      sancak: o.some((x) => x.tur === 'sancak'),
    };
  }
  const ko = o.find((x): x is Extract<meta.Odul, { tur: 'kandil' }> => x.tur === 'kandil');
  const acildi = o.some((x) => x.tur === 'kasabaAcildi');
  const kandil: KazandinVM['kandil'] = ko ? { onceki: acildi ? 0 : ko.onceki, yeni: ko.yeni, tanitim: acildi, yildiz: ko.kaynak.yildiz, muhur: ko.kaynak.muhur } : null;
  const sira = meta.kasabaAcikMi(k) ? meta.siradakiKasabaIsi(k) : null;
  return { muhurler, kandil, kasabaHazir: !!ko && !acildi && sira?.durum === 'yapilabilir' };
}

/** Paylaşım ızgarası simgelerinden temsilî R değerleri (● 0, ▲ 8, ■ 15). */
function izgaradanReaksiyon(izgara: string): number[] {
  return Array.from(izgara).map((c) => (c === '■' ? 15 : c === '▲' ? 8 : 0));
}

export function gunlukVM(k: Kayit, bugun: number): GunlukVM {
  const s = k.gunluk.enIyi[String(bugun)];
  const bi = meta.seriBasamakIndeksi(k.gunluk.seri);
  const gorevler = k.gunluk.tarih === bugun ? k.gunluk.gorevler : [];
  return {
    tarih: bugun,
    enIyi: s ? s.puan : null,
    yildiz: (s?.kazandi ? s.yildiz : 0) as Yildiz,
    kazanildi: !!s?.kazandi,
    gorevler: gorevler.map((g) => ({ metin: meta.gorevMetni(g), ilerleme: Math.min(g.ilerleme, g.hedef), gerekli: g.hedef, tamam: g.tamam })),
    seri: { gun: k.gunluk.seri, basamak: bi >= 0 ? (meta.SERI_BASAMAKLARI[bi].id as SeriBasamagi) : null },
    paylasim: s
      ? { tarih: bugun, yildiz: (s.kazandi ? s.yildiz : 0) as Yildiz, kullanilanHamle: s.kullanilan, toplamHamle: s.toplam, enBuyuk: s.enBuyuk, reaksiyonlar: izgaradanReaksiyon(s.izgara) }
      : null,
    arsiv: meta.arsivGunleri(bugun).map((t) => {
      const a = k.gunluk.enIyi[String(t)];
      return { tarih: t, enIyi: a ? a.puan : null, yildiz: (a?.kazandi ? a.yildiz : 0) as Yildiz };
    }),
  };
}

export function istatistikVM(k: Kayit): IstatistikVM {
  const ad = (id: number) => bolumGetir(id)?.ad ?? `Bölüm ${id}`;
  const skorlar = Object.entries(k.bolumler)
    .map(([id, b]) => ({ id: Number(id), b }))
    .filter((x) => x.b.yildiz > 0 && (x.id <= BOLUMLER.length || (x.id > 100 && x.id < 200)))
    .sort((a, b) => a.id - b.id)
    .map((x) => ({ id: x.id, ad: ad(x.id), enIyi: x.b.enIyi, yildiz: x.b.yildiz as Yildiz }));
  return {
    enUzunZincir: k.rekorlar.enUzunZincir,
    enBuyukReaksiyon: k.rekorlar.enBuyukReaksiyon,
    toplamHalka: k.istatistik.toplamHalka,
    toplamPatlama: k.istatistik.toplamPatlama,
    enCokNesil: k.rekorlar.enCokNesil,
    enIyiGunluk: k.rekorlar.enIyiGunluk > 0 ? k.rekorlar.enIyiGunluk : null,
    toplamYildiz: meta.toplamYildiz(k),
    bolumSkorlari: skorlar,
    rozetler: meta.rozetDurumlari(k).map((r) => ({ id: r.id, acik: r.kazanildi })),
  };
}

export function nasilVM(k: Kayit): NasilVM {
  const acik = meta.acikEnYuksek(k);
  return { acikEngeller: (Object.keys(ENGEL_ACILIS) as EngelId[]).filter((e) => acik >= ENGEL_ACILIS[e]) };
}

const GUC_ADI: Record<'kibrit' | 'kalip' | 'geriSar', string> = { kibrit: 'Kibrit', kalip: 'Fişek Kalıbı', geriSar: 'Geri Sar' };

/**
 * Kazandın duyurularının önemi (küçük sayı önce): kart yalnız ilk birkaçını
 * gösterir, gerisi "+N daha" çipinde. Yeni açılan oyun öğeleri ve mahalle
 * önce; rozet ve görevler sonra.
 */
const DUYURU_ONEMI: Partial<Record<meta.Odul['tur'], number>> = {
  mahalleTamam: 0,
  muhurParcasi: 0,
  guclendiriciAcildi: 1,
  gunlukAcildi: 1,
  sonsuzAcildi: 1,
  ustaAcildi: 1,
  fitil: 2,
  efsane: 2,
  motif: 2,
  guclendirici: 3,
  cosku: 4,
  seriBasamagi: 5,
  gorev: 6,
  rozet: 7,
};

/**
 * Coşku Serisi'nin hazır roketi bu bölümde verilir mi. Öğretim bölümleri
 * (§15) tek kavram öğretir: b4–b5'in merkezinde açıklanmamış bir roket
 * (b5 çapraz roket nişanını öğretir) dersi bulandırır. Seri sayacı öğretimde
 * de ilerler; roket ilk tanıtım bölümünde (6) gelir.
 */
export function coskuRoketi(v: BolumVerisi, k: Kayit): boolean {
  return v.tur !== 'gunluk' && v.tur !== 'ogretim' && meta.coskuAktif(k);
}

/** Kazançla gelen ödüllerden Kazandın kartındaki kısa duyurular (sandık ve tablo kendi yerinde), önem sırasıyla. */
export function odulDuyurulari(oduller: readonly meta.Odul[], s: { sonrakiBolum?: number } = {}): { ikon: string; metin: string }[] {
  // Sıradaki bölüm öğretimse hazır roket verilmez (coskuRoketi): duyuru da çıkmaz.
  const sonrakiOgretim = s.sonrakiBolum !== undefined && bolumGetir(s.sonrakiBolum)?.tur === 'ogretim';
  const sirali = oduller
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (DUYURU_ONEMI[a.o.tur] ?? 9) - (DUYURU_ONEMI[b.o.tur] ?? 9) || a.i - b.i)
    .map((x) => x.o);
  const r: { ikon: string; metin: string }[] = [];
  for (const o of sirali) {
    switch (o.tur) {
      case 'guclendiriciAcildi':
        r.push({ ikon: o.guc, metin: `${GUC_ADI[o.guc]} açıldı · ${o.verilen.adet} hediye` });
        break;
      case 'guclendirici':
        if (o.neden !== 'mahalle') r.push({ ikon: o.verilen.guc, metin: o.verilen.adet > 0 ? `+${o.verilen.adet} ${GUC_ADI[o.verilen.guc]}` : `+${o.verilen.toz} toz` });
        break;
      case 'gunlukAcildi':
        r.push({ ikon: 'takvim', metin: 'Günün Şenliği açıldı' });
        break;
      case 'sonsuzAcildi':
        r.push({ ikon: 'alev', metin: 'Sonsuz Şenlik açıldı' });
        break;
      case 'ustaAcildi':
        r.push({ ikon: 'sapka', metin: `Usta Bölümü ${o.ustaNo} açıldı` });
        break;
      case 'mahalleTamam':
        r.push({ ikon: 'harita', metin: `${MAHALLELER[o.mahalle]?.ad ?? 'Mahalle'} tamamlandı` });
        break;
      case 'efsane':
        r.push({ ikon: 'defter', metin: 'Efsane kartı açıldı' });
        break;
      case 'motif':
        r.push({ ikon: o.motif, metin: 'Işık Deseni haritaya asıldı' });
        break;
      case 'rozet':
        r.push({ ikon: 'rozet', metin: `Rozet: ${o.ad}` });
        break;
      case 'gorev':
        r.push({ ikon: 'tik', metin: `Görev: ${o.metin}` });
        break;
      case 'seriBasamagi':
        if (o.basamak > 0) r.push({ ikon: 'alev', metin: `Fener Nöbeti: ${o.ad}` });
        break;
      case 'fitil':
        r.push({ ikon: 'denizFeneri', metin: 'Deniz Feneri fitili senin' });
        break;
      case 'cosku':
        if (o.aktif && !o.bozuldu && !sonrakiOgretim) r.push({ ikon: 'roket', metin: 'Coşku: sıradaki bölüm roketle başlar' });
        break;
      case 'muhurParcasi': {
        // (Kancalar §A.6) Mahallenin 5/10/15. mührü: fitil parçası (ya da üçü varsa toz).
        const ad = FITILLER.find((f) => f.id === o.fitil)?.ad ?? 'Fitil';
        r.push({ ikon: 'alev', metin: o.parca ? MK.parcaDuyuru(ad, o.esik) : MK.tozDuyuru(o.toz, o.esik) });
        break;
      }
      default:
        break;
    }
  }
  return r;
}

/**
 * Mahalle tamamlanınca Fener Koyu Defteri kartındaki ödüller (§10.1). Meta,
 * henüz açılmamış güçlendiriciyi toza çevirir (`verilen.adet` 0, `toz` 2):
 * kart yalnız gerçekten verilen güçlendiricileri gösterir, tozlar tek
 * satırda toplanır ("+6 toz").
 */
export function mahalleOdulleri(oduller: readonly meta.Odul[]): OdulVM[] {
  const r: OdulVM[] = [];
  let toz = 0;
  for (const o of oduller) {
    if (o.tur !== 'guclendirici' || o.neden !== 'mahalle') continue;
    if (o.verilen.adet > 0) r.push({ tur: 'guclendirici', id: o.verilen.guc, adet: o.verilen.adet });
    toz += o.verilen.toz;
  }
  if (toz > 0) r.push({ tur: 'toz', adet: toz });
  return r;
}

/** Takılı desenler (çizici gökte bunlardan seçer). */
export function takiliDesenler(k: Kayit): string[] {
  const t = k.koleksiyon.takili.filter((d) => DESENLER.some((x) => x.id === d));
  return t.length ? t : ['kasimpati', 'palmiye', 'halka'];
}

/** Fitil görünümü (açık değilse kenevir). */
export function fitilGorunumu(k: Kayit): string {
  return FITILLER.some((f) => f.id === k.koleksiyon.fitil) && meta.fitilAcik(k, k.koleksiyon.fitil) ? k.koleksiyon.fitil : 'kenevir';
}

/** Kişisel gökyüzü: Ay Işığı (varsayılan) ise mahallenin teması kullanılır. */
export function gokyuzuTemasi(k: Kayit): string {
  const g = k.koleksiyon.gokyuzu;
  return g && g !== 'ayIsigi' && meta.gokyuzuAcik(k, g) ? g : '';
}
