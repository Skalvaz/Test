/**
 * Hangar: helikopter hattı, geliştirmeler ve kalıcı kayıt.
 *
 * Kullanıcı fikri (Kasım 2026): "dandik bir helikopterle başlayalım (7,62'lik
 * minigun), sonra roketleri, tanksavar ve hava füzelerini açarız, ek zırh
 * takarız, sonra bir sonraki helikoptere geçeriz; en sonda dikey kalkışlı jet."
 * Yapı uçak oyunlarındaki araştırma ağacından esinli: oynadıkça araştırma
 * puanı (AP) birikir, AP ile geliştirme ve yeni helikopter açılır. Adlar ve
 * sayılar bize ait; gerçek ülke, işaret, marka yok.
 */
import { type Donanim } from './dunya';

export interface ModTanim {
  id: string;
  ad: string;
  aciklama: string;
  bedel: number;
  uygula: (d: Donanim) => void;
}

export interface HeliTanim {
  id: string;
  ad: string;
  sinif: string;
  /** Açma bedeli (AP). 0: baştan açık. */
  bedel: number;
  /** Henüz yapılmadı: hangarda kilitli görünür. */
  yakinda?: boolean;
  taban: Donanim;
  modlar: ModTanim[];
}

export const HELILER: HeliTanim[] = [
  {
    id: 'kesif',
    ad: 'KEŞİF',
    sinif: 'HAFİF HELİKOPTER',
    bedel: 0,
    // 7,62'lik minigun: çok hızlı atar, piyadeyi biçer, zırha işlemez. Roketi yok.
    taban: { tur: 0, can: 65, hiz: 0.92, zirh: 0, topAra: 0.075, topArac: 0.18, topTank: 0.02, roket: 0, atgm: false, aam: false, bomba: 2 },
    modlar: [
      { id: 'roket', ad: 'ROKET YUVASI', aciklama: 'GÜDÜMSÜZ ROKET', bedel: 250, uygula: (d) => (d.roket = 1.7) },
      { id: 'serit', ad: 'ÇİFT ŞERİT', aciklama: 'ATIŞ HIZI +%25', bedel: 300, uygula: (d) => (d.topAra *= 0.8) },
      { id: 'motor', ad: 'GÜÇLÜ MOTOR', aciklama: 'HIZ +%12', bedel: 350, uygula: (d) => (d.hiz *= 1.12) },
      { id: 'bomba', ad: 'BOMBA ASKISI', aciklama: 'BOMBA +1', bedel: 400, uygula: (d) => (d.bomba += 1) },
      {
        id: 'zirh', ad: 'EK ZIRH', aciklama: 'CAN +20, KURŞUN -%25', bedel: 450,
        uygula: (d) => {
          d.can += 20;
          d.zirh = 0.25;
        },
      },
    ],
  },
  {
    id: 'hafif',
    ad: 'SALDIRI',
    sinif: 'DAR GÖVDELİ HELİKOPTER',
    bedel: 1200,
    // Çene altında üç namlulu 20 mm top, kısa kanatta roket; çevik, ince zırhlı
    taban: { tur: 3, can: 80, hiz: 1.08, zirh: 0, topAra: 0.11, topArac: 0.35, topTank: 0.06, roket: 1.5, atgm: false, aam: false, bomba: 2 },
    modlar: [
      { id: 'salvo', ad: 'ROKET SALVOSU', aciklama: 'ROKETLER İKİŞER ATILIR', bedel: 500, uygula: (d) => (d.roketSalvo = 2) },
      { id: 'atgm', ad: 'TANKSAVAR FÜZE', aciklama: 'GÜDÜMLÜ, TANKI TEK ATAR', bedel: 800, uygula: (d) => (d.atgm = true) },
      { id: 'motor', ad: 'GÜÇLÜ MOTOR', aciklama: 'HIZ +%10', bedel: 400, uygula: (d) => (d.hiz *= 1.1) },
      { id: 'bomba', ad: 'BOMBA ASKISI', aciklama: 'BOMBA +1', bedel: 450, uygula: (d) => (d.bomba += 1) },
      {
        id: 'zirh', ad: 'EK ZIRH', aciklama: 'CAN +20, KURŞUN -%25', bedel: 600,
        uygula: (d) => {
          d.can += 20;
          d.zirh = 0.25;
        },
      },
    ],
  },
  {
    id: 'agir',
    ad: 'AĞIR SALDIRI',
    sinif: 'ZIRHLI HELİKOPTER',
    bedel: 3500,
    // 30 mm zincirli top, roket yuvaları; füzeler geliştirmeyle
    taban: { tur: 1, can: 100, hiz: 1, zirh: 0, topAra: 0.13, topArac: 0.5, topTank: 0.12, roket: 1.15, atgm: false, aam: false, bomba: 3 },
    modlar: [
      { id: 'atgm', ad: 'TANKSAVAR FÜZE', aciklama: 'GÜDÜMLÜ, TANKI TEK ATAR', bedel: 900, uygula: (d) => (d.atgm = true) },
      { id: 'aam', ad: 'HAVA FÜZESİ', aciklama: 'UÇAĞA VE HELİKOPTERE', bedel: 900, uygula: (d) => (d.aam = true) },
      {
        id: 'delici', ad: 'ZIRH DELİCİ', aciklama: 'ARACA HASAR +%60', bedel: 700,
        uygula: (d) => {
          d.topArac *= 1.6;
          d.topTank *= 2;
        },
      },
      { id: 'motor', ad: 'GÜÇLÜ MOTOR', aciklama: 'HIZ +%10', bedel: 600, uygula: (d) => (d.hiz *= 1.1) },
      {
        id: 'zirh', ad: 'EK ZIRH', aciklama: 'CAN +30, KURŞUN -%30', bedel: 800,
        uygula: (d) => {
          d.can += 30;
          d.zirh = 0.3;
        },
      },
    ],
  },
  {
    id: 'jet',
    ad: 'DİKEY KALKIŞLI JET',
    sinif: 'HIZLI BOMBACI',
    bedel: 8000,
    // Hızlı, ince zırhlı; karında beş namlulu top, kanat altında bol bomba.
    // Helikopter gibi asılı durur (lüleler aşağı döner).
    taban: { tur: 2, can: 90, hiz: 1.3, zirh: 0, topAra: 0.09, topArac: 0.7, topTank: 0.2, roket: 1.0, atgm: false, aam: false, bomba: 6, bombaDolum: 1.7 },
    modlar: [
      { id: 'salkim', ad: 'SALKIM BOMBA', aciklama: 'HER BOMBA ÜÇE AÇILIR', bedel: 1400, uygula: (d) => (d.salkim = true) },
      { id: 'atgm', ad: 'GÜDÜMLÜ FÜZE', aciklama: 'TANKI TEK ATAR', bedel: 1100, uygula: (d) => (d.atgm = true) },
      { id: 'aam', ad: 'HAVA FÜZESİ', aciklama: 'UÇAĞA VE HELİKOPTERE', bedel: 900, uygula: (d) => (d.aam = true) },
      { id: 'yakici', ad: 'ART YAKICI', aciklama: 'HIZ +%12', bedel: 800, uygula: (d) => (d.hiz *= 1.12) },
      {
        id: 'zirh', ad: 'KABİN ZIRHI', aciklama: 'CAN +20, KURŞUN -%20', bedel: 1000,
        uygula: (d) => {
          d.can += 20;
          d.zirh = 0.2;
        },
      },
    ],
  },
];

export interface Kayit {
  ap: number;
  sahip: string[];
  secili: string;
  /** Helikopter başına alınmış geliştirmeler. */
  mod: Record<string, string[]>;
}

const ANAHTAR = 'barut.hangar.v1';

export function bosKayit(): Kayit {
  return { ap: 0, sahip: ['kesif'], secili: 'kesif', mod: {} };
}

export function kayitOku(): Kayit {
  const k = bosKayit();
  try {
    const ham = JSON.parse(localStorage.getItem(ANAHTAR) ?? 'null') as Partial<Kayit> | null;
    if (ham && typeof ham === 'object') {
      if (typeof ham.ap === 'number' && Number.isFinite(ham.ap)) k.ap = Math.max(0, Math.floor(ham.ap));
      if (Array.isArray(ham.sahip)) for (const id of ham.sahip) if (heliBul(id) && !k.sahip.includes(id)) k.sahip.push(id);
      if (typeof ham.secili === 'string' && k.sahip.includes(ham.secili)) k.secili = ham.secili;
      if (ham.mod && typeof ham.mod === 'object') {
        for (const [id, liste] of Object.entries(ham.mod)) {
          const h = heliBul(id);
          if (h && Array.isArray(liste)) k.mod[id] = liste.filter((m) => h.modlar.some((t) => t.id === m));
        }
      }
    }
  } catch {
    /* özel pencere ya da bozuk kayıt: baştan başlar */
  }
  return k;
}

export function kayitYaz(k: Kayit): void {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(k));
  } catch {
    /* kayıt yoksa da oyun çalışır */
  }
}

export function heliBul(id: string): HeliTanim | undefined {
  return HELILER.find((h) => h.id === id && !h.yakinda);
}

/** Seçili helikopterin, alınmış geliştirmeleri uygulanmış donanımı. */
export function donanimKur(k: Kayit, id = k.secili): Donanim {
  const h = heliBul(id) ?? HELILER[0];
  const d: Donanim = { ...h.taban };
  for (const m of h.modlar) if (k.mod[h.id]?.includes(m.id)) m.uygula(d);
  return d;
}

/** Bir oyunun kazandırdığı araştırma puanı. */
export function kazanc(skor: number): number {
  return Math.round(skor / 8);
}

/** Helikopteri aç (AP yeterse). */
export function heliAc(k: Kayit, id: string): boolean {
  const h = heliBul(id);
  if (!h || k.sahip.includes(id) || k.ap < h.bedel) return false;
  k.ap -= h.bedel;
  k.sahip.push(id);
  k.secili = id;
  return true;
}

export function heliSec(k: Kayit, id: string): boolean {
  if (!k.sahip.includes(id) || k.secili === id) return false;
  k.secili = id;
  return true;
}

/** Seçili helikoptere geliştirme al. */
export function modAl(k: Kayit, modId: string): boolean {
  const h = heliBul(k.secili);
  const m = h?.modlar.find((t) => t.id === modId);
  if (!h || !m) return false;
  const alinan = (k.mod[h.id] ??= []);
  if (alinan.includes(modId) || k.ap < m.bedel) return false;
  k.ap -= m.bedel;
  alinan.push(modId);
  return true;
}

/** Hangardaki çubuklar için 0–1 arası kaba değerler: [dayanıklılık, hız, ateş gücü]. */
export function ozet(d: Donanim): [number, number, number] {
  const ates = (0.5 / d.topAra) * (0.3 + d.topArac) * 0.09 + (d.roket > 0 ? 0.25 : 0) + (d.atgm ? 0.2 : 0) + (d.aam ? 0.12 : 0) + (d.bomba - 3) * 0.04 + (d.salkim ? 0.15 : 0) + ((d.roketSalvo ?? 1) > 1 ? 0.12 : 0);
  return [Math.min(1, (d.can / (1 - d.zirh * 0.5)) / 160), Math.min(1, (d.hiz - 0.7) / 0.8), Math.min(1, ates)];
}
