/**
 * Oyun özeti (Ayarlar > Oyun özeti): ölçüm günlüğünden (docs/OLCUM.md)
 * oyuncunun ekran görüntüsüyle gönderebileceği kısa bir özet. Aile testinde
 * ürün sahibi bölüm hunisini görür; özet BULUTA GİTMEZ (ağ isteği yok,
 * kişisel veri yok). Saf: olaylar + şimdiki zaman → biçimlenmiş VM (DOM yok).
 *
 * Tablo yalnız ana bölümleri sayar (`bolum_bitti` / `bolum_basla` `tur`
 * 'ana'; `olcumOzeti` türleri ayırmadığı için hesap burada yapılır).
 * Bırakma = çıkış + bitmeden kapatılan deneme (`bolum_basla`'dan sonra
 * `bolum_bitti` gelmeden yeni bir deneme ya da oturum başladı). Günlüğün
 * sonunda süren deneme bırakma sayılmaz (Ayarlar oyun içinden de açılır).
 */
import type { OlcumOlayi } from '../platform/olcum';
import type { OyunOzetiBolumu, OyunOzetiSatiri, OyunOzetiVM } from '../ui/tipler';
import { M, MO } from '../ui/metinler';

const GUN_MS = 86_400_000;
/** Tabloda en çok kaç bölüm (en son oynananlar). */
export const OZET_BOLUM_SINIRI = 12;

/** Dil adları kendi dillerinde (Ayarlar > Dil ile aynı). */
const DIL_ADLARI: Record<string, string> = { tr: 'Türkçe', en: 'English' };

/** Saniye → "0:48", "1:05", "12:00" (dilden bağımsız). */
export function dakikaSaniye(sn: number): string {
  const s = Math.max(0, Math.round(sn));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Toplam oyun süresi: "0 dk", "42 dk", "1 sa 5 dk". */
export function oyunSuresiMetni(sn: number): string {
  const dk = sn > 0 ? Math.max(1, Math.round(sn / 60)) : 0;
  return dk >= 60 ? MO.saatDakika(Math.floor(dk / 60), dk % 60) : M.dk(dk);
}

/** Olay ana bölüme mi ait (eski olaylarda `tur` yoksa numaradan: 1–100). */
function anaMi(o: OlcumOlayi): boolean {
  const tur = o.p?.tur;
  if (tur !== undefined) return tur === 'ana';
  const id = Number(o.p?.id);
  return id >= 1 && id <= 100;
}

interface Sayac {
  id: number;
  deneme: number;
  kayip: number;
  birakma: number;
  kazanildi: boolean;
  sureler: number[];
  /** Son olayın sırası (en son oynananları seçmek için). */
  son: number;
}

/**
 * Ölçüm olaylarından oyun özeti. `ilk` ölçüm günlüğünün ilk açılış zamanı
 * (`olcum.ilkAcilis()`); verilmezse olaylardan tahmin edilir (en eski
 * olayın zamanı eksi günü).
 */
export function oyunOzetiVM(olaylar: readonly OlcumOlayi[], simdi: number, ilk?: number): OyunOzetiVM {
  const bolum = new Map<number, Sayac>();
  const al = (id: number, sira: number): Sayac => {
    let b = bolum.get(id);
    if (!b) bolum.set(id, (b = { id, deneme: 0, kayip: 0, birakma: 0, kazanildi: false, sureler: [], son: sira }));
    b.son = sira;
    return b;
  };
  const gunler = new Set<number>();
  let oturum = 0;
  let enYuksek = 0;
  let toplamSure = 0;
  let surum = '';
  let dil = '';
  let ilkTahmin = Infinity;
  /** Başlamış, henüz bitmemiş deneme (bir anda en çok bir bölüm oynanır). */
  let suren: { id: number; ana: boolean } | null = null;
  const terk = () => {
    if (suren?.ana) bolum.get(suren.id)!.birakma++;
    suren = null;
  };

  olaylar.forEach((o, sira) => {
    gunler.add(o.g);
    if (o.o > oturum) oturum = o.o;
    ilkTahmin = Math.min(ilkTahmin, o.t - o.g * GUN_MS);
    if (o.a === 'oturum_basla') {
      terk();
      if (typeof o.p?.surum === 'string') surum = o.p.surum;
      if (typeof o.p?.dil === 'string') dil = o.p.dil;
      // Açık en yüksek ana bölüm: ondan bir öncesi kazanılmıştır (halka günlük eski kazançları düşürse de).
      if (typeof o.p?.ana === 'number') enYuksek = Math.max(enYuksek, o.p.ana - 1);
    } else if (o.a === 'bolum_basla') {
      terk();
      const ana = anaMi(o);
      const id = Number(o.p?.id);
      suren = { id, ana };
      if (ana) al(id, sira).deneme++;
    } else if (o.a === 'bolum_bitti') {
      const id = Number(o.p?.id);
      const ana = anaMi(o);
      // Başlangıcı halka günlükten düşmüş deneme yine bir deneme sayılır.
      const eslesti = suren !== null && suren.id === id;
      if (!eslesti) terk();
      suren = null;
      if (typeof o.p?.sure === 'number') toplamSure += o.p.sure;
      if (!ana) return;
      const b = al(id, sira);
      if (!eslesti) b.deneme++;
      const sonuc = o.p?.sonuc;
      if (sonuc === 'kazanc') {
        b.kazanildi = true;
        if (id > enYuksek) enYuksek = id;
      } else if (sonuc === 'cikis') b.birakma++;
      else b.kayip++;
      if (typeof o.p?.sure === 'number') b.sureler.push(o.p.sure);
    }
  });

  const ilkZaman = ilk ?? (Number.isFinite(ilkTahmin) ? ilkTahmin : simdi);
  const gunOnce = Math.max(0, Math.floor((simdi - ilkZaman) / GUN_MS));
  const satirlar: OyunOzetiSatiri[] = [
    { anahtar: 'ilkAcilis', etiket: MO.ilkAcilis, deger: MO.gunOnce(gunOnce) },
    { anahtar: 'oturum', etiket: MO.oturum, deger: String(oturum) },
    { anahtar: 'oynananGun', etiket: MO.oynananGun, deger: String(gunler.size) },
    { anahtar: 'enYuksek', etiket: MO.enYuksek, deger: enYuksek > 0 ? String(enYuksek) : '—' },
    { anahtar: 'oyunSuresi', etiket: MO.oyunSuresi, deger: oyunSuresiMetni(toplamSure) },
    { anahtar: 'surum', etiket: MO.surum, deger: [surum, DIL_ADLARI[dil]].filter(Boolean).join(' · ') || '—' },
  ];

  const secilen = [...bolum.values()].sort((a, b) => b.son - a.son).slice(0, OZET_BOLUM_SINIRI);
  let vurgu: Sayac | null = null;
  for (const b of secilen) {
    const zor = b.kayip + b.birakma;
    // Eşitlikte en son oynanan (oyuncunun şimdi takıldığı yer).
    if (zor > 0 && (!vurgu || zor > vurgu.kayip + vurgu.birakma)) vurgu = b;
  }
  const bolumler: OyunOzetiBolumu[] = secilen
    .sort((a, b) => a.id - b.id)
    .map((b) => ({
      id: b.id,
      deneme: b.deneme,
      kayip: b.kayip,
      birakma: b.birakma,
      ortSure: b.sureler.length ? Math.round(b.sureler.reduce((x, y) => x + y, 0) / b.sureler.length) : null,
      kazanildi: b.kazanildi,
      vurgu: b === vurgu,
    }));

  return { bos: olaylar.length === 0, satirlar, bolumler, oynananBolum: bolum.size };
}
