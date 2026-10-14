/**
 * Bölüm verisinden başlangıç durumu (§8.1 "İlk tahta üretimi").
 * İlk tahta yalnız `tohum` akışından üretilir (her denemede aynı); oyun
 * akışı `oyunTohumu(tohum, denemeNo)` ile tazelenir.
 */
import { agirlikliSec, oyunTohumu } from './rng';
import { ILK_TAHTA_BILESEN_SINIRI, ILK_TAHTA_YENIDEN_CEKIM, VARSAYILAN_DEV_FISEK } from './sabitler';
import { SEKIZ, bosHucre, icinde, idx, kapsul } from './tahta';
import { hedefDurumu } from './hedef';
import { karistir } from './karistir';
import { kilitliMi } from './kilit';
import type { BolumVerisi, BolumYukleSecenek, Hucre, OyunDurumu, Renk } from './types';

export class BolumHatasi extends Error {}

export function bolumuYukle(v: BolumVerisi, denemeNo: number, secenek: BolumYukleSecenek = {}): OyunDurumu {
  if (v.duzen.length !== v.h) throw new BolumHatasi(`bölüm ${v.id}: düzen ${v.duzen.length} satır, h=${v.h}`);
  const agirlik = v.dogumAgirliklari ?? Array.from({ length: v.renkSayisi }, () => 1);
  const ilk = { rng: v.tohum >>> 0 };
  const hucreler: Hucre[] = [];
  const doldurulacak: number[] = [];

  for (let y = 0; y < v.h; y++) {
    const simgeler = v.duzen[y].trim().split(/\s+/);
    if (simgeler.length !== v.w) throw new BolumHatasi(`bölüm ${v.id}: satır ${y} ${simgeler.length} simge, w=${v.w}`);
    for (let x = 0; x < v.w; x++) {
      const s = simgeler[x];
      const h = bosHucre();
      switch (s) {
        case '.':
          doldurulacak.push(hucreler.length);
          break;
        case '#':
          h.delik = true;
          break;
        case 'C':
          h.kafes = true;
          doldurulacak.push(hucreler.length);
          break;
        case 'W':
          h.icerik = { tur: 'islak', renk: 0 };
          doldurulacak.push(hucreler.length);
          break;
        case 'F':
          h.icerik = { tur: 'fener' };
          break;
        case 'I':
          h.icerik = { tur: 'is' };
          break;
        case 'K1':
        case 'K2':
        case 'K3':
          h.icerik = { tur: 'kaya', kat: Number(s[1]) as 1 | 2 | 3 };
          break;
        case 'S':
        case 'S2':
          h.icerik = { tur: 'kova', kat: 2 };
          break;
        case 'S1':
          h.icerik = { tur: 'kova', kat: 1 };
          break;
        case 'D':
          h.icerik = { tur: 'devFisek', dolum: 0, kapasite: v.devFisekKapasite ?? VARSAYILAN_DEV_FISEK };
          break;
        default:
          if (/^D\d+$/.test(s)) {
            h.icerik = { tur: 'devFisek', dolum: 0, kapasite: Number(s.slice(1)) };
            break;
          }
          throw new BolumHatasi(`bölüm ${v.id}: bilinmeyen simge "${s}" (${x},${y})`);
      }
      hucreler.push(h);
    }
  }

  const d: OyunDurumu = {
    bolumId: v.id,
    denemeNo,
    w: v.w,
    h: v.h,
    hucreler,
    esik: v.esik,
    renkSayisi: v.renkSayisi,
    ozelEsikleri: [...v.ozelEsikleri] as [number, number, number],
    dogumAgirliklari: [...agirlik],
    yardim: v.yardim,
    kalanHamle: v.hamle,
    toplamHamle: v.hamle,
    puan: 0,
    hedefler: [],
    korukDolum: 0,
    korukKapasite: v.korukKapasitesi ?? 0,
    rng: 0,
    hamleNo: 0,
    izler: (v.zemin?.barutIzleri ?? []).map((iz) => ({ hucreler: iz.map(([x, y]) => y * v.w + x), yandi: iz.map(() => false) })),
    havaOlaylari: (v.havaOlaylari ?? []).map((o) => ({ ...o, hatlar: [...o.hatlar], sayac: o.baslangic, sira: 0 })),
    fenerDogum: v.fenerDogum ? { ...v.fenerDogum } : null,
    cikislar: v.cikislar ? [...v.cikislar] : Array.from({ length: v.w }, (_, x) => x),
    kurallar: { ...(v.kurallar ?? {}) },
    istatistik: {
      enUzunZincir: 0,
      enBuyukReaksiyon: 0,
      halkaSayisi: 0,
      toplamPatlama: 0,
      isiPatlamasi: 0,
      enCokNesil: 0,
      roket: 0,
      kasimpati: 0,
      yildiz: 0,
      kombinasyon: 0,
      reaksiyonlar: [],
      korukKullanim: 0,
      kafesKirilan: 0,
      kayaKirilan: 0,
      fenerToplanan: 0,
      devFisekAtesi: 0,
      guclendirici: 0,
      ustaEli: false,
    },
    bitti: null,
    finalYapildi: false,
  };

  // 1–2. Renkleri doldur; 8-komşu aynı renk bileşeni sınırı aşarsa yeniden çek.
  for (const i of doldurulacak) {
    const x = i % v.w;
    const y = (i - x) / v.w;
    let renk = agirlikliSec(ilk, agirlik) as Renk;
    for (let deneme = 0; deneme < ILK_TAHTA_YENIDEN_CEKIM && bilesenBoyutu(d, x, y, renk) > ILK_TAHTA_BILESEN_SINIRI; deneme++) {
      renk = agirlikliSec(ilk, agirlik) as Renk;
    }
    const h = hucreler[i];
    if (h.icerik?.tur === 'islak') h.icerik = { tur: 'islak', renk };
    else h.icerik = kapsul(renk);
  }

  // 3. Sabit kapsüller ve ön ısı.
  for (const s of v.sabitKapsuller ?? []) {
    const h = hucreler[idx(d, s.x, s.y)];
    if (h.delik) throw new BolumHatasi(`bölüm ${v.id}: sabit kapsül delikte (${s.x},${s.y})`);
    if (h.icerik?.tur === 'islak') {
      h.icerik = { tur: 'islak', renk: s.renk as Renk };
      continue;
    }
    const ozel = s.ozel ?? (s.renk === -1 ? 'yildiz' : 'yok');
    h.icerik = { tur: 'kapsul', renk: (ozel === 'yildiz' ? -1 : s.renk) as Renk | -1, isi: s.isi ?? 0, ozel, eksen: s.eksen ?? 0 };
  }
  for (const [x, y, isi] of v.onIsi ?? []) {
    const ic = hucreler[idx(d, x, y)].icerik;
    if (ic?.tur === 'kapsul') ic.isi = Math.min(isi, v.esik - 1);
  }

  // Zemin katmanları.
  for (const [x, y, kat] of v.zemin?.dosemeler ?? []) hucreler[idx(d, x, y)].doseme = kat;
  for (const [x, y, renk] of v.zemin?.desen?.hucreler ?? []) hucreler[idx(d, x, y)].desenRengi = renk;
  d.izler.forEach((iz, k) => {
    for (const i of iz.hucreler) hucreler[i].izIndeksi = k;
  });

  // 4. Kilitliyse §3.8 karıştırması, ilk tahta akışından (her denemede aynı).
  if (kilitliMi(d)) {
    d.rng = ilk.rng;
    karistir(d);
    ilk.rng = d.rng;
  }

  // Coşku Serisi: merkeze en yakın düz kapsül yatay roket.
  if (secenek.cosku) {
    let en = -1;
    let enU = Infinity;
    const cx2 = v.w - 1;
    const cy2 = v.h - 1;
    hucreler.forEach((h, i) => {
      if (h.delik || h.kafes || h.icerik?.tur !== 'kapsul' || h.icerik.ozel !== 'yok') return;
      const x = i % v.w;
      const y = (i - x) / v.w;
      const u = (2 * x - cx2) ** 2 + (2 * y - cy2) ** 2;
      if (u < enU) {
        enU = u;
        en = i;
      }
    });
    if (en >= 0) {
      const ic = hucreler[en].icerik;
      if (ic?.tur === 'kapsul') {
        ic.ozel = 'roket';
        ic.eksen = 0;
      }
    }
  }

  d.hedefler = v.hedefler.map((h) => hedefDurumu(d, h));
  d.rng = oyunTohumu(v.tohum, denemeNo);
  return d;
}

/** (x,y)'ye `renk` konursa, şimdiye dek doldurulmuş aynı renk düz kapsüllerle 8-komşu bileşen boyutu. */
function bilesenBoyutu(d: OyunDurumu, x: number, y: number, renk: number): number {
  const ayni = (i: number) => {
    const h = d.hucreler[i];
    return !h.delik && !h.kafes && h.icerik?.tur === 'kapsul' && h.icerik.renk === renk;
  };
  const gorulen = new Set<number>([idx(d, x, y)]);
  const yigin = [idx(d, x, y)];
  while (yigin.length) {
    const j = yigin.pop()!;
    const jx = j % d.w;
    const jy = (j - jx) / d.w;
    for (const k of SEKIZ) {
      const nx = jx + k.x;
      const ny = jy + k.y;
      if (!icinde(d, nx, ny)) continue;
      const n = idx(d, nx, ny);
      if (gorulen.has(n) || !ayni(n)) continue;
      gorulen.add(n);
      yigin.push(n);
    }
  }
  return gorulen.size;
}
