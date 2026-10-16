/**
 * Kasaba İşleri (docs/KANCALAR.md Bölüm B): KANDİL ile Fener Koyu'nu süsleme.
 * Saf, belirlenimli, DOM'suz.
 *
 * KANDİL BAKİYESİ SAKLANMAZ, TÜRETİLİR (§B.2):
 *   kazanılan = yıldız (ana + Usta) · 1 + mühür · 1 + tamamlanan mahalle · 3
 *             + günlük kandil (3/3 görev günü başına 1; kayıtta sayaç)
 *   harcanan  = Σ yapılan işlerin bedeli
 *   bakiye    = kazanılan − harcanan
 * Böylece kandil tekrar oynayarak kasılamaz (kaynaklar rekorlardır), kayıt
 * birleşiminde ya da göçte kaybolmaz ve eski oyuncu göçle "yıldız başına 1"
 * başlangıç bakiyesini kendiliğinden alır.
 *
 * Kurallar (§B.3):
 *  - Kasaba 3. bölümün ilk kazancıyla açılır (`KASABA_ACILIS_BOLUMU`).
 *  - Mahalleler sırayla süslenir: m. mahallenin işleri, (m−1). mahallenin 6
 *    işi bitince VE m. mahallenin ilk bölümü haritada açıkken açılır.
 *  - Mahalle içinde ilk beş iş serbest sırayla; taç iş (sira 5) en son.
 *  - Mahallenin 6 işi bitince "Mahalle şenliği" + `kasaba:<mahalleId>` kartı.
 */
import { KASABA_ISLERI, KASABA_IS_PER_MAHALLE, MAHALLELER } from '../app/katalog';
import type { KasabaIsi } from '../app/katalog';
import type { Kayit } from './kayit';
import { MUHUR_ACILIS_BOLUMU, MUHUR_MASKE_TAVANI, MUHUR_SON_BOLUM, muhurSayisi } from './muhur';
import { bolumTuru, mahalleBolumleri, mahalleSayisi, metaAyar } from './sabitler';
import type { MetaAyar } from './sabitler';

// ───────────────────────────── Sabitler ─────────────────────────────

/** Kasaba bu bölümün ilk kazancıyla açılır (öğretimin ortası; §B.5 ilk kandil balonu). */
export const KASABA_ACILIS_BOLUMU = 3;
/** Kandil kaynakları (§B.2). */
export const KANDIL = {
  /** Her yeni yıldız (ana 1–40 ve Usta Bölümleri; rekor artışı). */
  yildiz: 1,
  /** Her yeni mühür. */
  muhur: 1,
  /** Mahallenin 5 bölümü de kazanıldı (ilk kez). */
  mahalle: 3,
  /** Günün 3 görevinin üçü de tamamlandı (günde en çok 1). */
  gunluk: 1,
} as const;
/** Kart kimliği öneki: `kasaba:<mahalleId>`. */
export const KASABA_KART_ONEKI = 'kasaba:';

// ───────────────────────────── Kayıt ─────────────────────────────

/** Kayıttaki kasaba alanı (`Kayit.kasaba`, şema 3). */
export interface KasabaKaydi {
  /** Yapılan işler (`KASABA_ISLERI` kimlikleri), yapılış sırasıyla. */
  isler: string[];
  /** Günlük görevlerden kazanılan kandil (3/3 görev günü başına 1). */
  gunlukKandil: number;
  /** "Kandil yetti" uyarısı yapılmış işler (kazanç sonrası oto-kart iş başına bir kez atlanır). */
  uyarilan: string[];
}

export function bosKasaba(): KasabaKaydi {
  return { isler: [], gunlukKandil: 0, uyarilan: [] };
}

const IS_HARITASI = new Map<string, KasabaIsi>(KASABA_ISLERI.map((x) => [x.id, x]));

export function kasabaIsi(id: string): KasabaIsi | undefined {
  return IS_HARITASI.get(id);
}

export function kasabaIsGecerli(id: unknown): id is string {
  return typeof id === 'string' && IS_HARITASI.has(id);
}

/** Mahallenin işleri (sira sırasıyla). */
export function mahalleIsleri(m: number): KasabaIsi[] {
  return KASABA_ISLERI.filter((x) => x.mahalle === m).sort((a, b) => a.sira - b.sira);
}

// ─────────────────────────── Kandil ───────────────────────────

export interface KandilDokumu {
  yildiz: number;
  muhur: number;
  mahalle: number;
  gunluk: number;
  kazanilan: number;
  harcanan: number;
  bakiye: number;
}

function kazanildi(k: Pick<Kayit, 'bolumler'>, id: number): boolean {
  return (k.bolumler[String(id)]?.yildiz ?? 0) >= 1;
}

/** Tamamlanan (5 bölümü de kazanılmış) mahalle sayısı. */
export function tamamlananMahalle(k: Pick<Kayit, 'bolumler'>, ayarK?: Partial<MetaAyar>): number {
  const ayar = metaAyar(ayarK);
  let n = 0;
  for (let m = 0; m < mahalleSayisi(ayar); m++) if (mahalleBolumleri(m, ayar).every((id) => kazanildi(k, id))) n++;
  return n;
}

/** Toplam mühür (ana bölümler). */
export function toplamMuhur(k: Pick<Kayit, 'bolumler'>, ayarK?: Partial<MetaAyar>): number {
  const ayar = metaAyar(ayarK);
  let n = 0;
  for (const [a, b] of Object.entries(k.bolumler)) if (bolumTuru(Number(a), ayar) === 'ana') n += muhurSayisi(b.muhur);
  return n;
}

/** Kandil dökümü (türetilmiş; §B.2). */
export function kandilDokumu(k: Pick<Kayit, 'bolumler' | 'kasaba'>, ayarK?: Partial<MetaAyar>): KandilDokumu {
  const ayar = metaAyar(ayarK);
  let yildiz = 0;
  for (const [a, b] of Object.entries(k.bolumler)) {
    const t = bolumTuru(Number(a), ayar);
    if (t === 'ana' || t === 'usta') yildiz += b.yildiz;
  }
  const muhur = toplamMuhur(k, ayar);
  const mahalle = tamamlananMahalle(k, ayar);
  const gunluk = k.kasaba?.gunlukKandil ?? 0;
  const kazanilan = yildiz * KANDIL.yildiz + muhur * KANDIL.muhur + mahalle * KANDIL.mahalle + gunluk * KANDIL.gunluk;
  let harcanan = 0;
  for (const id of k.kasaba?.isler ?? []) harcanan += IS_HARITASI.get(id)?.maliyet ?? 0;
  return { yildiz, muhur, mahalle, gunluk, kazanilan, harcanan, bakiye: Math.max(0, kazanilan - harcanan) };
}

export function kandilBakiyesi(k: Pick<Kayit, 'bolumler' | 'kasaba'>, ayarK?: Partial<MetaAyar>): number {
  return kandilDokumu(k, ayarK).bakiye;
}

/** Bir kayıt değişikliğinin kandil kazanımı (Kazandın kazanç şeridi, `Odul kandil`). */
export interface KandilKazanimi {
  /** Değişiklikten önceki ve sonraki bakiye. */
  onceki: number;
  yeni: number;
  /** Kaynaklara göre kazanılan kandil (her biri ≥ 0; harcama dahil değil). */
  kaynak: { yildiz: number; muhur: number; mahalle: number; gunluk: number };
  /** Toplam kazanılan (kaynakların toplamı). */
  toplam: number;
}

/**
 * Önceki → yeni kayıt arasında kazanılan kandil (§B.2, KANCALAR §D.4 adım
 * 11). Kaynaklar rekor olduğundan aynı bölümü tekrar oynamak (yıldız
 * artmadan) 0 verir. Hiç kazanım yoksa null. Harcama (iş yapma) kazanım
 * sayılmaz; `yeni` yine güncel bakiyedir.
 */
export function kandilKazanimi(onceki: Pick<Kayit, 'bolumler' | 'kasaba'>, yeni: Pick<Kayit, 'bolumler' | 'kasaba'>, ayarK?: Partial<MetaAyar>): KandilKazanimi | null {
  const a = kandilDokumu(onceki, ayarK);
  const b = kandilDokumu(yeni, ayarK);
  const kaynak = {
    yildiz: Math.max(0, b.yildiz - a.yildiz) * KANDIL.yildiz,
    muhur: Math.max(0, b.muhur - a.muhur) * KANDIL.muhur,
    mahalle: Math.max(0, b.mahalle - a.mahalle) * KANDIL.mahalle,
    gunluk: Math.max(0, b.gunluk - a.gunluk) * KANDIL.gunluk,
  };
  const toplam = kaynak.yildiz + kaynak.muhur + kaynak.mahalle + kaynak.gunluk;
  if (toplam === 0) return null;
  return { onceki: a.bakiye, yeni: b.bakiye, kaynak, toplam };
}

/** Kasaba bu değişiklikle mi açıldı (3. bölümün ilk kazancı; `Odul kasabaAcildi`). */
export function kasabaAcildi(onceki: Pick<Kayit, 'bolumler'>, yeni: Pick<Kayit, 'bolumler'>): boolean {
  return !kasabaAcikMi(onceki) && kasabaAcikMi(yeni);
}

// ─────────────────────────── İş durumu ───────────────────────────

/**
 *  - yapildi        iş yapılmış
 *  - yapilabilir    açık ve kandil yetiyor
 *  - yetersiz       açık ama kandil yetmiyor (`eksik` kadar)
 *  - tacKilitli     taç iş: mahallenin öbür 5 işi bitmedi
 *  - sirada         önceki mahallenin işleri bitmedi
 *  - haritaKilitli  mahallenin ilk bölümü haritada açılmadı (sis)
 *  - kasabaKapali   kasaba henüz açılmadı (3. bölüm)
 */
export type KasabaIsDurumu = 'yapildi' | 'yapilabilir' | 'yetersiz' | 'tacKilitli' | 'sirada' | 'haritaKilitli' | 'kasabaKapali';

export function kasabaAcikMi(k: Pick<Kayit, 'bolumler'>): boolean {
  return kazanildi(k, KASABA_ACILIS_BOLUMU);
}

function acikEnYuksekAna(k: Pick<Kayit, 'bolumler'>, ayar: MetaAyar): number {
  let en = 0;
  for (const [a, b] of Object.entries(k.bolumler)) {
    const id = Number(a);
    if (bolumTuru(id, ayar) === 'ana' && b.yildiz >= 1 && id > en) en = id;
  }
  return Math.min(ayar.anaBolumSayisi, en + 1);
}

/** Mahallenin 6 işi de yapıldı mı. */
export function mahalleSuslendi(k: Pick<Kayit, 'kasaba'>, m: number): boolean {
  const yapilan = new Set(k.kasaba?.isler ?? []);
  return mahalleIsleri(m).every((x) => yapilan.has(x.id));
}

/** Kasabada şu an süslenen mahalle (ilk bitmemiş); hepsi bittiyse −1. */
export function suslenenMahalle(k: Pick<Kayit, 'kasaba'>): number {
  for (let m = 0; m < MAHALLELER.length; m++) if (!mahalleSuslendi(k, m)) return m;
  return -1;
}

export function kasabaIsDurumu(k: Pick<Kayit, 'bolumler' | 'kasaba'>, id: string, ayarK?: Partial<MetaAyar>): { durum: KasabaIsDurumu; eksik: number } {
  const ayar = metaAyar(ayarK);
  const is = IS_HARITASI.get(id);
  if (!is) return { durum: 'kasabaKapali', eksik: 0 };
  const yapilan = new Set(k.kasaba?.isler ?? []);
  if (yapilan.has(id)) return { durum: 'yapildi', eksik: 0 };
  if (!kasabaAcikMi(k)) return { durum: 'kasabaKapali', eksik: 0 };
  if (acikEnYuksekAna(k, ayar) < is.mahalle * ayar.bolumPerMahalle + 1) return { durum: 'haritaKilitli', eksik: 0 };
  for (let m = 0; m < is.mahalle; m++) if (!mahalleSuslendi(k, m)) return { durum: 'sirada', eksik: 0 };
  if (is.sira === KASABA_IS_PER_MAHALLE - 1 && mahalleIsleri(is.mahalle).some((x) => x.id !== id && !yapilan.has(x.id))) return { durum: 'tacKilitli', eksik: 0 };
  const bakiye = kandilBakiyesi(k, ayar);
  return bakiye >= is.maliyet ? { durum: 'yapilabilir', eksik: 0 } : { durum: 'yetersiz', eksik: is.maliyet - bakiye };
}

/** Sıradaki iş: açık ve yapılmamış işlerin en ucuzu (eşitlikte sira). Kasaba bitti ya da kapalıysa null. */
export function siradakiKasabaIsi(k: Pick<Kayit, 'bolumler' | 'kasaba'>, ayarK?: Partial<MetaAyar>): { is: KasabaIsi; durum: KasabaIsDurumu; eksik: number } | null {
  const m = suslenenMahalle(k);
  if (m < 0) return null;
  let en: { is: KasabaIsi; durum: KasabaIsDurumu; eksik: number } | null = null;
  for (const is of mahalleIsleri(m)) {
    const d = kasabaIsDurumu(k, is.id, ayarK);
    if (d.durum !== 'yapilabilir' && d.durum !== 'yetersiz') continue;
    if (!en || is.maliyet < en.is.maliyet) en = { is, ...d };
  }
  return en;
}

// ─────────────────────────── İş yapma ───────────────────────────

export type KasabaOdulu = { tur: 'is'; is: KasabaIsi } | { tur: 'kasabaSenligi'; mahalle: number; kart: string };

export type KasabaHatasi = 'gecersiz' | Exclude<KasabaIsDurumu, 'yapilabilir'>;

/**
 * İşi yap (kandil harcanır, iş kayda yazılır). Mahallenin 6. işiyse
 * `kasaba:<mahalleId>` kartı koleksiyona eklenir ve şenlik ödülü döner.
 * Saf: yeni kayıt döner.
 */
export function kasabaIsYap(k: Kayit, id: string, ayarK?: Partial<MetaAyar>): { tamam: true; kayit: Kayit; oduller: KasabaOdulu[] } | { tamam: false; hata: KasabaHatasi } {
  const is = IS_HARITASI.get(id);
  if (!is) return { tamam: false, hata: 'gecersiz' };
  const d = kasabaIsDurumu(k, id, ayarK);
  if (d.durum !== 'yapilabilir') return { tamam: false, hata: d.durum };
  const y = JSON.parse(JSON.stringify(k)) as Kayit;
  y.kasaba.isler.push(id);
  const oduller: KasabaOdulu[] = [{ tur: 'is', is }];
  if (mahalleSuslendi(y, is.mahalle)) {
    const kart = `${KASABA_KART_ONEKI}${MAHALLELER[is.mahalle].id}`;
    if (!y.koleksiyon.kartlar.includes(kart)) y.koleksiyon.kartlar.push(kart);
    oduller.push({ tur: 'kasabaSenligi', mahalle: is.mahalle, kart });
  }
  return { tamam: true, kayit: y, oduller };
}

/**
 * Kazançtan sonra "Kandil yetti" uyarısı (§B.5): yapılabilir ve daha önce
 * uyarılmamış en ucuz iş. Uygulama uyarıyı gösterince `kasabaUyarildi` ile
 * işaretler (oto-kart iş başına bir kez atlanır).
 */
export function kasabaUyarisi(k: Pick<Kayit, 'bolumler' | 'kasaba'>, ayarK?: Partial<MetaAyar>): KasabaIsi | null {
  // Yalnız sıradaki (en ucuz) iş uyarılır: oyuncu uyarıyı geçerse o iş
  // yapılana kadar oto-kart yeniden atlanmaz ("bir bölüm daha" akışı bozulmaz).
  const s = siradakiKasabaIsi(k, ayarK);
  if (!s || s.durum !== 'yapilabilir') return null;
  return (k.kasaba?.uyarilan ?? []).includes(s.is.id) ? null : s.is;
}

export function kasabaUyarildi(k: Kayit, id: string): Kayit {
  if (!kasabaIsGecerli(id) || k.kasaba.uyarilan.includes(id)) return k;
  const y = JSON.parse(JSON.stringify(k)) as Kayit;
  y.kasaba.uyarilan.push(id);
  return y;
}

// ─────────────────────────── Onarım ───────────────────────────

/**
 * Kayıttaki kasaba alanını onarır (kayitOnar çağırır): geçersiz ve tekrar
 * eden kimlikler atılır; kurallara aykırı sırayla yapılmış iş (önceki mahalle
 * bitmeden, taç iş erken) atılır; harcanan kazanılanı aşarsa SON yapılan
 * işlerden başlayarak geri alınır. `bolumler` önceden onarılmış olmalı.
 */
export function kasabaOnar(ham: unknown, k: Pick<Kayit, 'bolumler'>, not: (yol: string) => void, ayarK?: Partial<MetaAyar>): KasabaKaydi {
  const v = bosKasaba();
  const o = ham && typeof ham === 'object' && !Array.isArray(ham) ? (ham as Record<string, unknown>) : null;
  if (!o) {
    if (ham !== undefined) not('kasaba');
    return v;
  }
  const g = o.gunlukKandil;
  if (typeof g === 'number' && Number.isInteger(g) && g >= 0 && g <= 100_000) v.gunlukKandil = g;
  else if (g !== undefined) not('kasaba.gunlukKandil');
  // İşler: sırayla kabul, kurallara uymayan atılır.
  const kabul: string[] = [];
  const kume = new Set<string>();
  if (Array.isArray(o.isler)) {
    for (const id of o.isler) {
      if (!kasabaIsGecerli(id) || kume.has(id)) {
        not('kasaba.isler');
        continue;
      }
      const is = IS_HARITASI.get(id)!;
      const oncekiler = Array.from({ length: is.mahalle }, (_, m) => m).every((m) => mahalleIsleri(m).every((x) => kume.has(x.id)));
      const tacErken = is.sira === KASABA_IS_PER_MAHALLE - 1 && mahalleIsleri(is.mahalle).some((x) => x.id !== id && !kume.has(x.id));
      if (!oncekiler || tacErken) {
        not('kasaba.isler');
        continue;
      }
      kabul.push(id);
      kume.add(id);
    }
  } else if (o.isler !== undefined) not('kasaba.isler');
  // Bütçe: harcanan ≤ kazanılan (sondan geri al).
  const kazanilan = kandilDokumu({ bolumler: k.bolumler, kasaba: { isler: [], gunlukKandil: v.gunlukKandil, uyarilan: [] } }, ayarK).kazanilan;
  let harcanan = kabul.reduce((s, id) => s + IS_HARITASI.get(id)!.maliyet, 0);
  while (harcanan > kazanilan && kabul.length > 0) {
    harcanan -= IS_HARITASI.get(kabul.pop()!)!.maliyet;
    not('kasaba.isler');
  }
  v.isler = kabul;
  if (Array.isArray(o.uyarilan)) {
    const u = new Set<string>();
    for (const id of o.uyarilan) {
      if (kasabaIsGecerli(id) && !u.has(id)) u.add(id);
      else not('kasaba.uyarilan');
    }
    v.uyarilan = [...u];
  } else if (o.uyarilan !== undefined) not('kasaba.uyarilan');
  return v;
}

// ─────────────────────────── Birleştirme ───────────────────────────

/**
 * İki kaydın kanca ilerlemesini birleştirir (bulut + tarayıcı, KANCALAR §D.3).
 * Kayıt deposu ilerleme puanı büyük olan kaydı seçer (`pickBetter`); bu,
 * öbür kayıttaki mühürleri ve kasaba işlerini sessizce kaybettirebilirdi
 * (ör. eski sürümün açık kalmış bir sekmesi şema 3 alanlarını bilmeden yazar,
 * ya da iki cihazda ayrı işler yapılır). `kazanan` esas alınır, `diger`den
 * yalnız kaybolmaması gerekenler eklenir:
 *  - mühür maskeleri: kazananda kazanılmış 6–40. bölümlerde bit bit VEYA;
 *  - kasaba işleri: kazananın sırası korunur, öbürünün eksik işleri kendi
 *    sırasıyla eklenir; kurallara ya da bütçeye uymayan atılır (`kasabaOnar`);
 *  - günlük kandil: büyük olan (iki cihazın ortak geçmişi iki kez sayılmaz);
 *  - uyarılan işler birleşimi; süslenmiş mahallenin `kasaba:` kartı.
 * Yıldız, rozet, koleksiyon ve mühür ödülleri kazananınkidir (bu birleştirme
 * yalnız kandili ve işleri korur). Girdiler onarılmış kayıtlar olmalı; saf.
 */
export function kancaBirlestir(kazanan: Kayit, diger: Kayit, ayarK?: Partial<MetaAyar>): Kayit {
  const ayar = metaAyar(ayarK);
  const y = JSON.parse(JSON.stringify(kazanan)) as Kayit;
  for (const [a, b] of Object.entries(y.bolumler)) {
    const id = Number(a);
    if (bolumTuru(id, ayar) !== 'ana' || id < MUHUR_ACILIS_BOLUMU || id > MUHUR_SON_BOLUM || b.yildiz < 1) continue;
    const m = ((b.muhur ?? 0) | (diger.bolumler?.[a]?.muhur ?? 0)) & MUHUR_MASKE_TAVANI;
    if (m > 0) b.muhur = m;
  }
  const kendi = new Set(y.kasaba.isler);
  const aday: KasabaKaydi = {
    isler: [...y.kasaba.isler, ...(diger.kasaba?.isler ?? []).filter((id) => !kendi.has(id))],
    gunlukKandil: Math.max(y.kasaba.gunlukKandil, diger.kasaba?.gunlukKandil ?? 0),
    uyarilan: [...new Set([...y.kasaba.uyarilan, ...(diger.kasaba?.uyarilan ?? [])])],
  };
  y.kasaba = kasabaOnar(aday, y, () => undefined, ayar);
  for (let m = 0; m < MAHALLELER.length; m++) {
    const kart = `${KASABA_KART_ONEKI}${MAHALLELER[m].id}`;
    if (mahalleSuslendi(y, m) && !y.koleksiyon.kartlar.includes(kart)) y.koleksiyon.kartlar.push(kart);
  }
  return y;
}
