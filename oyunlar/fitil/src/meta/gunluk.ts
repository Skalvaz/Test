/**
 * Günün Şenliği (GDD §10.5): günlük görevler, Fener Nöbeti serisi, arşiv ve
 * paylaşım metni. Tarih her zaman dışarıdan, yerel gün olarak (`yyyymmdd`)
 * gelir; meta `Date` kullanmaz.
 *
 * Görev seçimi: 20 şablon `mulberry32(yyyymmdd)` ile karıştırılır, oyuncunun
 * ulaştığı bölüme göre yapılabilir olan ilk 3'ü alınır. Aynı ilerlemedeki
 * herkes aynı görevleri görür; 17+ bölümdeki herkes tam olarak aynısını.
 * (Karar: süzme olmasa 11. bölümdeki oyuncuya "Körük'ü 2 kez kullan" gibi
 * henüz yapamayacağı görev düşerdi.)
 *
 * Fener Nöbeti: ardışık oyun günleri (günde en az bir bölüm sonucu, kazanç
 * ya da kayıp). Haftada (Pazartesi–Pazar) 1 kaçırılan gün affedilir. Affedilmeyen
 * her kaçırılan gün seriyi bir alt basamağın başlangıç değerine düşürür
 * (12 → 3); sıfırlamaz. Geri dönülen gün düşen değere dahildir.
 */
import { rngInt } from '../core/rng';
import { t } from '../platform/dil';
import { bolumKazanildi, seriBasamakIndeksi } from './kayit';
import type { GorevDurumu, GunlukKaydi, GunlukSonucKaydi, Kayit } from './kayit';
import type { OyunOzeti } from './ozet';
import { ARSIV_GUN, GUNLUK_ACILIS_BOLUMU, GUNLUK_GOREV_SAYISI, GUNLUK_SAKLAMA_GUN, SERI_BASAMAKLARI } from './sabitler';
import { gunFarki, haftaNo, tarihEkle, tarihGecerli, tarihMetni } from './takvim';

// ─────────────────────────── Görevler ───────────────────────────

/** Görev ilerlemesini ölçmek için bir oyunun bağlamı. */
export interface GorevBaglami {
  kazandi: boolean;
  yildiz: number;
  /** Bölümün ilk denemesi kazanıldı. */
  ilkDeneme: boolean;
  /** Bugünün Günün Şenliği (arşiv değil). */
  gununSenligi: boolean;
  ozet: OyunOzeti;
}

export interface GorevSablonu {
  no: number;
  hedef: number;
  /** Gerekli mekaniğin tanıtıldığı bölüm: oyuncu buna ulaşmış olmalı. */
  acilis: number;
  /** Şablon 3: renk tohumdan (0..4). */
  renkli?: boolean;
  /** Bu oyunun ilerlemeye katkısı. */
  olc(b: GorevBaglami, renk: number): number;
}

/** Kapsül renk adları küçük harfle (§2.3). */
export const RENK_ADLARI_KUCUK: readonly string[] = t(['kızıl', 'kehribar', 'zümrüt', 'gök', 'mor', 'gül'], ['red', 'amber', 'emerald', 'sky', 'purple', 'rose']);

const evet = (x: boolean) => (x ? 1 : 0);

/** §10.5'teki 20 şablon (numara sırası korunur). */
export const GOREV_SABLONLARI: readonly GorevSablonu[] = [
  { no: 1, hedef: 2, acilis: 8, olc: (b) => b.ozet.halka },
  { no: 2, hedef: 1, acilis: 3, olc: (b) => evet(b.ozet.enBuyukReaksiyon >= 15) },
  { no: 3, hedef: 50, acilis: 1, renkli: true, olc: (b, r) => b.ozet.renkPatlama[r] ?? 0 },
  { no: 4, hedef: 3, acilis: 2, olc: (b) => b.ozet.roketAtesi },
  { no: 5, hedef: 1, acilis: 6, olc: (b) => b.ozet.kasimpatiAtesi },
  { no: 6, hedef: 1, acilis: 14, olc: (b) => b.ozet.kombolar.length },
  { no: 7, hedef: 5, acilis: 4, olc: (b) => b.ozet.kafesKirilan },
  { no: 8, hedef: 20, acilis: 9, olc: (b) => b.ozet.dosemeAydinlanan },
  { no: 9, hedef: 3, acilis: 1, olc: (b) => evet(b.kazandi) },
  { no: 10, hedef: 1, acilis: 5, olc: (b) => evet(b.kazandi && b.yildiz >= 3) },
  { no: 11, hedef: 1, acilis: 1, olc: (b) => evet(b.ozet.enUzunZincir >= 12) },
  { no: 12, hedef: 2, acilis: 17, olc: (b) => b.ozet.korukKullanim },
  { no: 13, hedef: 2, acilis: 5, olc: (b) => b.ozet.caprazRoketEngel },
  { no: 14, hedef: 10, acilis: 13, olc: (b) => b.ozet.kayaYokEdilen },
  { no: 15, hedef: 2, acilis: 11, olc: (b) => b.ozet.fenerToplanan },
  { no: 16, hedef: 1, acilis: 5, olc: (b) => evet(b.ozet.finalRoket >= 5) },
  { no: 17, hedef: 1, acilis: GUNLUK_ACILIS_BOLUMU + 1, olc: (b) => evet(b.gununSenligi && b.kazandi) },
  { no: 18, hedef: 1, acilis: 3, olc: (b) => evet(b.ozet.enCokNesil >= 2) },
  { no: 19, hedef: 30, acilis: 3, olc: (b) => b.ozet.isiPatlamasi },
  { no: 20, hedef: 1, acilis: 1, olc: (b) => evet(b.kazandi && b.ilkDeneme) },
];

/** Görevin arayüz metni (sayfanın dilinde, tek satır). */
export function gorevMetni(g: Pick<GorevDurumu, 'sablon' | 'renk'>): string {
  const renk = RENK_ADLARI_KUCUK[g.renk ?? 3];
  switch (g.sablon) {
    case 1:
      return t('2 halka çiz', 'Draw 2 loops');
    case 2:
      return t('Tek hamlede 15+ reaksiyon yap', 'Get a 15+ reaction in one move');
    case 3:
      return t(`50 ${renk} patlat`, `Pop 50 ${renk} capsules`);
    case 4:
      return t('3 roket ateşle', 'Fire 3 rockets');
    case 5:
      return t('1 kasımpatı ateşle', 'Fire 1 chrysanthemum');
    case 6:
      return t('Bir kombinasyon yap', 'Make a combo');
    case 7:
      return t('5 kafes kır', 'Break 5 cages');
    case 8:
      return t('20 döşeme aydınlat', 'Light up 20 tiles');
    case 9:
      return t('3 bölüm kazan', 'Win 3 levels');
    case 10:
      return t('Bir bölümü 3★ ile bitir', 'Finish a level with 3★');
    case 11:
      return t('12+ düğümlü bir zincir çiz', 'Draw a chain of 12+');
    case 12:
      return t("Körük'ü 2 kez kullan", 'Use the Bellows twice');
    case 13:
      return t('Çapraz roketle 2 engel vur', 'Hit 2 obstacles by diagonal rocket');
    case 14:
      return t('10 kaya kır', 'Break 10 rocks');
    case 15:
      return t('2 fener indir', 'Bring down 2 lanterns');
    case 16:
      return t('Final gösterisinde 5+ roket ateşle', 'Fire 5+ rockets in the finale');
    case 17:
      return t("Günün Şenliği'ni kazan", 'Win the Daily Festival');
    case 18:
      return t('2. nesil bir patlama yap', 'Set off a 2nd-generation blast');
    case 19:
      return t('30 kapsülü ısıyla patlat', 'Pop 30 capsules with heat');
    case 20:
      return t('Bir bölümü ilk denemede kazan', 'Win a level on the first try');
    default:
      return '';
  }
}

/**
 * Günün 3 görevi: şablonlar mulberry32(tarih) ile karıştırılır (Fisher–Yates),
 * `acikBolum`a göre yapılabilir olanların ilk 3'ü alınır. Renk de aynı akıştan.
 */
export function gunlukGorevSec(tarih: number, acikBolum: number): GorevDurumu[] {
  const r = { rng: tarih >>> 0 };
  const sira = GOREV_SABLONLARI.map((s) => s.no);
  for (let i = sira.length - 1; i > 0; i--) {
    const j = rngInt(r, i + 1);
    [sira[i], sira[j]] = [sira[j], sira[i]];
  }
  const renk = rngInt(r, 5);
  const secilen: GorevDurumu[] = [];
  for (const no of sira) {
    const s = GOREV_SABLONLARI[no - 1];
    if (s.acilis > acikBolum) continue;
    const g: GorevDurumu = { sablon: no, ilerleme: 0, hedef: s.hedef, tamam: false };
    if (s.renkli) g.renk = renk;
    secilen.push(g);
    if (secilen.length === GUNLUK_GOREV_SAYISI) break;
  }
  return secilen;
}

/**
 * Görevleri bir oyunun sonucuyla ilerletir. Dönen `tamamlanan`: bu oyunla
 * yeni tamamlanan görevlerin indeksleri.
 */
export function gorevIlerlet(gorevler: readonly GorevDurumu[], b: GorevBaglami): { gorevler: GorevDurumu[]; tamamlanan: number[] } {
  const tamamlanan: number[] = [];
  const yeni = gorevler.map((g, i) => {
    if (g.tamam) return { ...g };
    const s = GOREV_SABLONLARI[g.sablon - 1];
    const art = s ? Math.max(0, Math.floor(s.olc(b, g.renk ?? 0))) : 0;
    const ilerleme = Math.min(g.hedef, g.ilerleme + art);
    const tamam = ilerleme >= g.hedef;
    if (tamam) tamamlanan.push(i);
    return { ...g, ilerleme, tamam };
  });
  return { gorevler: yeni, tamamlanan };
}

export function gunlukAcik(k: Kayit): boolean {
  return bolumKazanildi(k, GUNLUK_ACILIS_BOLUMU);
}

/**
 * Gün değiştiyse görevleri yeniler ve eski günlük sonuçları budar (yerinde).
 * Günlük kapalıysa (10. bölüm kazanılmadı) görev seçilmez.
 */
export function gunlukTazele_yerinde(k: Kayit, bugun: number, acikBolum: number): boolean {
  if (!tarihGecerli(bugun)) return false;
  let degisti = false;
  for (const t of Object.keys(k.gunluk.enIyi)) {
    const fark = gunFarki(Number(t), bugun);
    if (fark > GUNLUK_SAKLAMA_GUN || fark < -1) {
      delete k.gunluk.enIyi[t];
      degisti = true;
    }
  }
  if (gunlukAcik(k) && k.gunluk.tarih !== bugun) {
    k.gunluk.tarih = bugun;
    k.gunluk.gorevler = gunlukGorevSec(bugun, acikBolum);
    k.gunluk.ucGorevSandigi = false;
    degisti = true;
  }
  return degisti;
}

// ─────────────────────────── Fener Nöbeti ───────────────────────────

export interface SeriSonucu {
  onceki: number;
  seri: number;
  /** Bugün zaten sayılmıştı (değişiklik yok). */
  ayniGun: boolean;
  /** Affedilen kaçırılmış günler (yyyymmdd). */
  affedilen: number[];
  /** Affedilmeyen kaçırma sayısı ve düşüş. */
  dusus: { kacirma: number; den: number; e: number } | null;
  /** İlk kez geçilen basamakların indeksleri (ödül verilir). */
  yeniBasamaklar: number[];
}

/** Seri değerinin basamak indeksi (−1 = basamak yok). */
export { seriBasamakIndeksi } from './kayit';

/** Bir alt basamağın başlangıç değeri (en alt Kıvılcım: 1). */
export function seriDusur(seri: number): number {
  const b = seriBasamakIndeksi(seri);
  return b <= 0 ? 1 : SERI_BASAMAKLARI[b - 1].esik;
}

/** Bir sonraki basamak ve kalan gün (arayüz: `${yonelme} ${kalan} gün` → "Meşale'ye 2 gün"). */
export function sonrakiBasamak(seri: number): { indeks: number; ad: string; yonelme: string; kalan: number } | null {
  const b = seriBasamakIndeksi(seri);
  const s = SERI_BASAMAKLARI[b + 1];
  return s ? { indeks: b + 1, ad: s.ad, yonelme: s.yonelme, kalan: s.esik - seri } : null;
}

/** Uzun yoklukta döngü sınırı: bu kadar kaçırmadan sonrası en alta düşürür. */
const KACIRMA_DONGU_SINIRI = 70;

/**
 * Oyun günü kaydı: `bugun` bir bölüm sonucu geldiği gün. Saf: yeni günlük
 * kaydı ve özet döner. Saat geri alınmışsa (bugün < son gün) değişiklik yok.
 */
export function seriIlerle(g: GunlukKaydi, bugun: number): { gunluk: GunlukKaydi; sonuc: SeriSonucu } {
  const y: GunlukKaydi = { ...g };
  const sonuc: SeriSonucu = { onceki: g.seri, seri: g.seri, ayniGun: false, affedilen: [], dusus: null, yeniBasamaklar: [] };
  if (!tarihGecerli(bugun) || (g.sonGun !== 0 && gunFarki(g.sonGun, bugun) <= 0)) {
    sonuc.ayniGun = true;
    return { gunluk: y, sonuc };
  }
  let seri = g.seri;
  if (g.sonGun === 0 || seri <= 0) {
    seri = 1;
  } else {
    const kacirilan = gunFarki(g.sonGun, bugun) - 1;
    let hafta = g.affedilenHafta;
    let kacirma = 0;
    const tara = Math.min(kacirilan, KACIRMA_DONGU_SINIRI);
    for (let d = 1; d <= tara; d++) {
      const gun = tarihEkle(g.sonGun, d);
      const h = haftaNo(gun);
      if (h > hafta) {
        hafta = h;
        sonuc.affedilen.push(gun);
      } else kacirma++;
    }
    kacirma += kacirilan - tara;
    y.affedilenHafta = hafta;
    if (kacirma === 0) seri += 1;
    else {
      const den = seri;
      for (let i = 0; i < Math.min(kacirma, SERI_BASAMAKLARI.length + 1); i++) seri = seriDusur(seri);
      sonuc.dusus = { kacirma, den, e: seri };
    }
  }
  y.seri = seri;
  y.sonGun = bugun;
  y.enUzunSeri = Math.max(g.enUzunSeri, seri);
  const b = seriBasamakIndeksi(seri);
  for (let i = g.basamakOdulu + 1; i <= b; i++) sonuc.yeniBasamaklar.push(i);
  y.basamakOdulu = Math.max(g.basamakOdulu, b);
  sonuc.seri = seri;
  return { gunluk: y, sonuc };
}

// ─────────────────────────── Arşiv ───────────────────────────

/** Oynanabilir arşiv günleri: dün ve önceki 6 gün (yeniden eskiye). Sandık vermez. */
export function arsivGunleri(bugun: number): number[] {
  const r: number[] = [];
  for (let i = 1; i <= ARSIV_GUN; i++) r.push(tarihEkle(bugun, -i));
  return r;
}

export function arsivdeMi(tarih: number, bugun: number): boolean {
  if (!tarihGecerli(tarih) || !tarihGecerli(bugun)) return false;
  const f = gunFarki(tarih, bugun);
  return f >= 1 && f <= ARSIV_GUN;
}

// ─────────────────────────── Paylaşım ───────────────────────────

/** Hamle simgesi: ● R < 8, ▲ 8 ≤ R < 15, ■ R ≥ 15 (emoji değil, metin simgesi). */
export function reaksiyonSimgesi(R: number): '●' | '▲' | '■' {
  return R >= 15 ? '■' : R >= 8 ? '▲' : '●';
}

export function izgaraMetni(reaksiyonlar: readonly number[]): string {
  return reaksiyonlar.map(reaksiyonSimgesi).join('');
}

/**
 * Paylaşım metni (panoya; emoji yok):
 *
 *   FİTİL · Günün Şenliği 14.10.2026
 *   ★★☆  18/22 hamle  En büyük: 27
 *   ●●▲●■▲●●▲▲●■●▲●●▲▲
 */
export function paylasimMetni(tarih: number, s: Pick<GunlukSonucKaydi, 'yildiz' | 'kullanilan' | 'toplam' | 'enBuyuk' | 'izgara'>): string {
  const yildiz = '★'.repeat(s.yildiz) + '☆'.repeat(3 - s.yildiz);
  const baslik = t(`FİTİL · Günün Şenliği ${tarihMetni(tarih)}`, `FİTİL · Daily Festival ${tarihMetni(tarih)}`);
  const satir = t(`${yildiz}  ${s.kullanilan}/${s.toplam} hamle  En büyük: ${s.enBuyuk}`, `${yildiz}  ${s.kullanilan}/${s.toplam} moves  Biggest: ${s.enBuyuk}`);
  return [baslik, satir, s.izgara].join('\n');
}

/** Sonuç daha iyi mi: önce kazanç, sonra puan. */
export function gunlukDahaIyi(a: Pick<GunlukSonucKaydi, 'kazandi' | 'puan'>, b: Pick<GunlukSonucKaydi, 'kazandi' | 'puan'> | undefined): boolean {
  if (!b) return true;
  if (a.kazandi !== b.kazandi) return a.kazandi;
  return a.puan > b.puan;
}
