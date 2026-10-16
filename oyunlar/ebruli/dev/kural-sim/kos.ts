/**
 * Ebruli kural ölçümü (P0 prototipi, GDD §0.1). Çalıştır: npx tsx dev/kural-sim/tarama4.ts 150 a
 */
import { Ayar, Hamle, Rng, Tahta, gecerliHamleler, hazirHamleler, ilkTahta, karistir, onizle, uygula, yardim, tahtaKopya, garanti } from './model';

type BotAdi = 'rastgele' | 'acemi' | 'acgozlu' | 'usta';

interface Olcum {
  hamle: number;
  eslesenHamle: number; // herhangi bir temizlik (doğum kaskatı dahil)
  anlikEslesen: number; // önizlemede görünen (doğumsuz) temizlik
  hazirToplam: number;
  hazirCiftToplam: number;
  hazirHist: number[]; // 0,1,2,3,4,5+
  gecerliToplam: number;
  olu: number;
  yardimKullanildi: number;
  yardimBasarisiz: number;
  temizlenen: number;
  kaskatTemiz: number;
  yaratilanGrup: number;
  ozel: number[];
  murekkep: number;
  murekkepPatladi: number;
  karisikTopla: number[]; // T, Mo, Y
  kaskatK2: number;
  turSayisi: number;
}

function yeniOlcum(): Olcum {
  return { hamle: 0, eslesenHamle: 0, anlikEslesen: 0, hazirToplam: 0, hazirCiftToplam: 0, hazirHist: [0, 0, 0, 0, 0, 0], gecerliToplam: 0, olu: 0, yardimKullanildi: 0, yardimBasarisiz: 0, temizlenen: 0, kaskatTemiz: 0, yaratilanGrup: 0, ozel: [0, 0, 0], murekkep: 0, murekkepPatladi: 0, karisikTopla: [0, 0, 0], kaskatK2: 0, turSayisi: 0 };
}

function botSec(bot: BotAdi, ay: Ayar, t: Tahta, rng: Rng, hazir: { hamle: Hamle; temiz: number }[]): Hamle {
  const gecerli = gecerliHamleler(ay, t, true);
  if (bot === 'rastgele') return gecerli[rng.int(gecerli.length)];
  if (bot === 'acemi') {
    // Önizlemeyi gören gündelik oyuncu: %70 hazır bir hamle (rastgele), değilse rastgele geçerli hamle.
    const ozel = gecerli.filter((m) => t.s[m.a] !== 0);
    if (ozel.length && rng.int(100) < 50) return ozel[rng.int(ozel.length)];
    if (hazir.length && rng.int(100) < 70) return hazir[rng.int(hazir.length)].hamle;
    return gecerli[rng.int(gecerli.length)];
  }
  // açgözlü / usta: önizleme skoru
  let en: Hamle[] = [];
  let enS = -1e9;
  for (const m of gecerli) {
    const k = tahtaKopya(t);
    const s = uygula(ay, k, m, null);
    let v = s.temizlenen * 10 + s.ozelUretim[0] * 30 + s.ozelUretim[1] * 50 + s.ozelUretim[2] * 80;
    if (bot === 'usta') {
      // 1 adım ileri: sonraki hazır hamle sayısı (doğumsuz, boşluklar boş kalır)
      const hz = hazirHamleler(ay, k).length;
      v += Math.min(hz, 6) * 4;
      if (s.murekkepUretildi) v += 6;
    }
    if (v > enS) {
      enS = v;
      en = [m];
    } else if (v === enS) en.push(m);
  }
  return en[rng.int(en.length)];
}

export function oyna(ay: Ayar, bot: BotAdi, tohum: number, hamleSayisi: number, o: Olcum): void {
  const rng = new Rng(tohum);
  const botRng = new Rng(tohum ^ 0xabcdef);
  const t = ilkTahta(ay, rng);
  for (let n = 0; n < hamleSayisi; n++) {
    let gecerli = gecerliHamleler(ay, t, true);
    if (gecerli.length === 0) {
      o.olu++;
      karistir(ay, t, rng);
      gecerli = gecerliHamleler(ay, t, true);
      if (!gecerli.length) break;
    }
    const hazir = hazirHamleler(ay, t);
    o.hazirToplam += hazir.length;
    const ciftler = new Set(hazir.map((h) => (h.hamle.a < h.hamle.b ? h.hamle.a * 1000 + h.hamle.b : h.hamle.b * 1000 + h.hamle.a)));
    o.hazirCiftToplam += ciftler.size;
    o.hazirHist[Math.min(5, ciftler.size)]++;
    o.gecerliToplam += gecerliHamleler(ay, t, false).length;
    o.turSayisi++;
    const m = botSec(bot, ay, t, botRng, hazir);
    const on = onizle(ay, t, m);
    const s = uygula(ay, t, m, rng);
    o.hamle++;
    if (s.temizlenen > 0) o.eslesenHamle++;
    if (on.temizlenen > 0) o.anlikEslesen++;
    o.temizlenen += s.temizlenen;
    o.kaskatTemiz += s.kaskatTemiz;
    o.yaratilanGrup += s.yaratilanGrup;
    for (let i = 0; i < 3; i++) o.ozel[i] += s.ozelUretim[i];
    if (s.murekkepUretildi) o.murekkep++;
    o.murekkepPatladi += s.murekkepPatladi;
    o.karisikTopla[0] += s.renkSayim[3];
    o.karisikTopla[1] += s.renkSayim[5];
    o.karisikTopla[2] += s.renkSayim[6];
    if (s.kaskatK >= 2) o.kaskatK2++;
    if (ay.garanti) {
      const g = garanti(ay, t, rng, ay.garanti);
      if (g > 0) o.yardimKullanildi++;
    }
    const y = yardim(ay, t, rng);
    if (y > 0) o.yardimKullanildi++;
    if (y < 0) o.yardimBasarisiz++;
  }
}

function yuzde(a: number, b: number) {
  return b ? ((100 * a) / b).toFixed(0) + '%' : '-';
}

export function rapor(ad: string, o: Olcum): string {
  const h = o.turSayisi;
  const hist = o.hazirHist.map((x) => yuzde(x, h)).join('/');
  return [
    ad.padEnd(34),
    `eşl ${yuzde(o.eslesenHamle, o.hamle).padStart(4)}`,
    `anlık ${yuzde(o.anlikEslesen, o.hamle).padStart(4)}`,
    `hazır ${(o.hazirCiftToplam / h).toFixed(1).padStart(4)}`,
    `h0/1/2/3/4/5+ ${hist}`,
    `geçerli ${(o.gecerliToplam / h).toFixed(0)}`,
    `ölü ${yuzde(o.olu, h)}`,
    `yrd ${yuzde(o.yardimKullanildi, h)}/${yuzde(o.yardimBasarisiz, h)}`,
    `dmlH ${(o.temizlenen / o.hamle).toFixed(1)}`,
    `kskt ${yuzde(o.kaskatTemiz, o.temizlenen)}`,
    `yrtG ${yuzde(o.yaratilanGrup, o.temizlenen)}`,
    `özel/H ${((o.ozel[0] + o.ozel[1] + o.ozel[2]) / o.hamle).toFixed(2)} (${o.ozel.map((x) => (x / o.hamle).toFixed(2)).join(',')})`,
    `mrk ${yuzde(o.murekkep, o.hamle)}`,
    `T/Mo/Y ${o.karisikTopla.map((x) => (x / o.hamle).toFixed(1)).join('/')}`,
  ].join(' | ');
}

export function topla(ay: Ayar, bot: BotAdi, oyunlar: number, hamle = 25, tohum0 = 1): Olcum {
  const o = yeniOlcum();
  for (let g = 0; g < oyunlar; g++) oyna(ay, bot, tohum0 + g * 7919, hamle, o);
  return o;
}
