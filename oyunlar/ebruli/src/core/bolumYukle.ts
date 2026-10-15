/**
 * Bölüm verisinden başlangıç durumu (GDD §15.1 "İlk tahta") — P0 başvuru
 * uygulaması.
 *
 *  - İlk tahta yalnız `tohum` akışından üretilir: her denemede AYNI tahta
 *    (FİTİL K15). Oyun akışı (dolum, garanti, karıştırma, şölen)
 *    `oyunTohumu(tohum, denemeNo)` ile her denemede taze.
 *  - Rastgele hücreler (`.`) doğum ağırlıklarıyla okuma sırasında (soldan
 *    sağa, yukarıdan aşağı) çekilir. Grup oluşursa grubun ilk RASTGELE
 *    hücresi yeniden çekilir (en fazla 400 tur); yalnız sabit damlalardan
 *    oluşan grup tasarım hatasıdır.
 *  - Geçerli hamle yoksa bütün rastgele hücreler yeniden çekilir (en fazla
 *    50 kez).
 *  - P1 eki (§4.7): ilk tahtaya da garanti uygulanır (en az `garanti` hazır
 *    çift); `olumluHamleler` gelince burada, rastgele hücrelerin rengini
 *    garanti sırasıyla seçerek. Bu P0 sürümü yalnız geçerli hamle arar.
 */
import { agirlikliSec, oyunTohumu } from './rng';
import { DOGUM_SIRASI, GARANTI_SINIRI, VARSAYILAN_OZEL_ESIKLERI } from './sabitler';
import { bosHucre, gecerliHamleVar, gruplariBul, karisikMi } from './tahta';
import type { BolumIstatistigi, BolumVerisi, Damla, Hedef, HedefDurumu, Hucre, KarisikRenk, OyunDurumu, Renk } from './types';

export class BolumHatasi extends Error {}

const RENK_SIMGELERI: Record<string, Renk> = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7 };

export function bosIstatistik(): BolumIstatistigi {
  return {
    eslesenHamle: 0,
    enUzunKaskat: 0,
    enBuyukGrup: 0,
    temizlenenDamla: 0,
    tarak: 0,
    girdap: 0,
    lale: 0,
    murekkep: 0,
    birlesim: 0,
    garantiKullanimi: 0,
    karistirma: 0,
    ustaEli: false,
  };
}

/** Hedefin başlangıç durumu: kâğıt ve desen tahtadan sayılır. */
export function hedefDurumu(h: Hedef, hucreler: readonly Hucre[]): HedefDurumu {
  let gerekli = 0;
  switch (h.tur) {
    case 'topla':
      gerekli = h.adet;
      break;
    case 'kagit':
      for (const c of hucreler) gerekli += c.kagit;
      break;
    case 'desen':
      for (const c of hucreler) if (c.desen) gerekli++;
      break;
    case 'puan':
      gerekli = h.puan;
      break;
  }
  return { hedef: h, ilerleme: 0, gerekli, tamam: gerekli === 0 };
}

export function bolumuYukle(v: BolumVerisi, denemeNo: number): OyunDurumu {
  const ad = `bölüm ${v.id}`;
  if (!(v.w >= 4 && v.w <= 8 && v.h >= 4 && v.h <= 10)) throw new BolumHatasi(`${ad}: boyut ${v.w}×${v.h} (4–8 × 4–10)`);
  if (v.duzen.length !== v.h) throw new BolumHatasi(`${ad}: düzen ${v.duzen.length} satır, h=${v.h}`);
  if (v.dogum.length !== 6 || v.dogum.some((a) => !Number.isInteger(a) || a < 0) || v.dogum.reduce((s, a) => s + a, 0) <= 0)
    throw new BolumHatasi(`${ad}: doğum ağırlıkları 6 negatif olmayan tamsayı olmalı`);
  if (!Number.isInteger(v.garanti) || v.garanti < 0 || v.garanti > GARANTI_SINIRI) throw new BolumHatasi(`${ad}: garanti 0–${GARANTI_SINIRI}`);
  if (!(v.hamle > 0)) throw new BolumHatasi(`${ad}: hamle > 0 olmalı`);

  const ilk = { rng: v.tohum >>> 0 };
  let sonrakiId = 1;
  const hucreler: Hucre[] = [];
  const rastgele: number[] = [];

  for (let y = 0; y < v.h; y++) {
    const simgeler = v.duzen[y].trim().split(/\s+/);
    if (simgeler.length !== v.w) throw new BolumHatasi(`${ad}: satır ${y} ${simgeler.length} simge, w=${v.w}`);
    for (let x = 0; x < v.w; x++) {
      const s = simgeler[x];
      const h = bosHucre();
      if (s === '.') {
        rastgele.push(hucreler.length);
      } else if (s === '#') {
        h.delik = true;
      } else if (s in RENK_SIMGELERI) {
        const renk = RENK_SIMGELERI[s];
        h.icerik = { tur: 'damla', damla: { id: 0, renk, ozel: renk === 7 ? 'murekkep' : 'yok', yon: 'yatay' } };
      } else if (/^X[123]$/.test(s)) {
        h.icerik = { tur: 'mermer', can: Number(s[1]) as 1 | 2 | 3 };
      } else {
        throw new BolumHatasi(`${ad}: bilinmeyen simge "${s}" (${x},${y})`);
      }
      hucreler.push(h);
    }
  }

  const hucreAl = (x: number, y: number, ne: string): Hucre => {
    if (!(x >= 0 && y >= 0 && x < v.w && y < v.h)) throw new BolumHatasi(`${ad}: ${ne} (${x},${y}) tahta dışında`);
    const h = hucreler[y * v.w + x];
    if (h.delik) throw new BolumHatasi(`${ad}: ${ne} (${x},${y}) delikte`);
    return h;
  };

  // Zemin katmanları.
  for (const [x, y, kat] of v.zemin?.kagit ?? []) hucreAl(x, y, 'kâğıt').kagit = kat;
  for (const [x, y] of v.zemin?.yag ?? []) {
    const h = hucreAl(x, y, 'yağ');
    if (h.icerik?.tur === 'mermer') throw new BolumHatasi(`${ad}: yağ (${x},${y}) mermerin altında olamaz`);
    h.yag = true;
  }
  for (const [x, y, renk] of v.zemin?.desen?.hucreler ?? []) {
    if (!karisikMi(renk)) throw new BolumHatasi(`${ad}: desen (${x},${y}) karışık renk istemeli (3, 5, 6)`);
    const h = hucreAl(x, y, 'desen');
    if (h.icerik?.tur === 'mermer') throw new BolumHatasi(`${ad}: desen (${x},${y}) mermerin altında olamaz`);
    h.desen = renk;
  }

  // Rastgele doldurma (ilk tahta akışı).
  const agirlik = v.dogum;
  const cek = (i: number) => {
    const renk = DOGUM_SIRASI[agirlikliSec(ilk, agirlik)];
    hucreler[i].icerik = { tur: 'damla', damla: { id: 0, renk, ozel: 'yok', yon: 'yatay' } };
  };
  for (const i of rastgele) cek(i);

  // Sabit özel taşlar (öğretim).
  const rastgeleKume = new Set(rastgele);
  for (const o of v.ozeller ?? []) {
    const h = hucreAl(o.x, o.y, 'özel taş');
    if (!h.icerik || h.icerik.tur !== 'damla') throw new BolumHatasi(`${ad}: özel taş (${o.x},${o.y}) damla hücresinde olmalı`);
    let renk: Renk | 0;
    if (o.ozel === 'lale') renk = 0;
    else if (o.ozel === 'murekkep') renk = 7;
    else {
      if (!o.renk || !karisikMi(o.renk)) throw new BolumHatasi(`${ad}: ${o.ozel} (${o.x},${o.y}) karışık renk ister`);
      renk = o.renk as KarisikRenk;
    }
    h.icerik.damla = { id: 0, renk, ozel: o.ozel, yon: o.yon ?? 'yatay' };
    rastgeleKume.delete(o.y * v.w + o.x);
  }
  const yenidenCekilebilir = rastgele.filter((i) => rastgeleKume.has(i));

  const durum: OyunDurumu = {
    bolumId: v.id,
    denemeNo,
    w: v.w,
    h: v.h,
    hucreler,
    dogumAgirliklari: [...v.dogum] as OyunDurumu['dogumAgirliklari'],
    kurallar: {
      murekkep: v.murekkep,
      garanti: v.garanti,
      ozelEsikleri: [...(v.ozelEsikleri ?? VARSAYILAN_OZEL_ESIKLERI)] as [number, number, number],
    },
    kalanHamle: v.hamle,
    toplamHamle: v.hamle,
    puan: 0,
    hedefler: [],
    rng: oyunTohumu(v.tohum, denemeNo),
    hamleNo: 0,
    sonrakiId: 1,
    gunluk: [],
    istatistik: bosIstatistik(),
    bitti: null,
    solenYapildi: false,
  };

  // Grupsuz ve oynanabilir ilk tahta.
  for (let deneme = 0; ; deneme++) {
    for (let tur = 0; tur < 400; tur++) {
      const gruplar = gruplariBul(durum);
      if (gruplar.length === 0) break;
      for (const g of gruplar) {
        const aday = g.hucreler.find((i) => rastgeleKume.has(i));
        if (aday === undefined) throw new BolumHatasi(`${ad}: sabit damlalar başlangıçta eşleşiyor (${g.hucreler.join(',')})`);
        cek(aday);
      }
    }
    if (gruplariBul(durum).length > 0) throw new BolumHatasi(`${ad}: grupsuz ilk tahta üretilemedi`);
    if (gecerliHamleVar(durum)) break;
    if (deneme >= 50 || yenidenCekilebilir.length === 0) throw new BolumHatasi(`${ad}: ilk tahtada geçerli hamle yok`);
    for (const i of yenidenCekilebilir) cek(i);
  }

  // Kimlikler okuma sırasıyla.
  for (const h of hucreler) if (h.icerik?.tur === 'damla') (h.icerik.damla as Damla).id = sonrakiId++;
  durum.sonrakiId = sonrakiId;
  durum.hedefler = v.hedefler.map((h) => hedefDurumu(h, hucreler));
  if (durum.hedefler.length === 0) throw new BolumHatasi(`${ad}: en az bir hedef gerekli`);
  return durum;
}
