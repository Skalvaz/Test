/**
 * Oyun özeti (Ayarlar > Oyun özeti): ölçüm günlüğünden (docs/OLCUM.md)
 * oyuncunun ekran görüntüsüyle gönderebileceği kısa bir özet. Aile testinde
 * ürün sahibi bölüm hunisini görür; özet BULUTA GİTMEZ (ağ isteği yok,
 * kişisel veri yok). Saf: ömür boyu toplamlar + şimdiki zaman → biçimlenmiş
 * VM (DOM yok). Sayımlar (deneme, kayıp, bırakma, süre, günler) ölçümün
 * `toplamaEkle`'sinde: halka günlük eski olayları düşürse de baştan beri
 * doğru kalırlar.
 */
import { yerelGun, type BolumToplami, type OlcumToplami } from '../platform/olcum';
import type { OyunOzetiBolumu, OyunOzetiSatiri, OyunOzetiVM } from '../ui/tipler';
import { M, MO } from '../ui/metinler';

/** Tabloda en çok kaç bölüm (en son oynananlar; özet telefonda tek ekrana sığsın). */
export const OZET_BOLUM_SINIRI = 8;

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

/**
 * Ömür boyu ölçüm toplamlarından oyun özeti. `ilk` ölçüm günlüğünün ilk
 * açılış zamanı (`olcum.ilkAcilis()`); "Bugün / Dün / N gün önce" takvim
 * günüyle sayılır. `enYuksek`: kayıttaki en yüksek kazanılmış ana bölüm
 * (verilmezse ölçümdeki kazançlardan).
 */
export function oyunOzetiVM(T: Readonly<OlcumToplami>, simdi: number, ilk: number, enYuksek = T.enYuksek): OyunOzetiVM {
  const gunOnce = Math.max(0, yerelGun(simdi) - yerelGun(ilk));
  const satirlar: OyunOzetiSatiri[] = [
    { anahtar: 'ilkAcilis', etiket: MO.ilkAcilis, deger: MO.gunOnce(gunOnce) },
    { anahtar: 'oturum', etiket: MO.oturum, deger: String(T.oturum) },
    { anahtar: 'oynananGun', etiket: MO.oynananGun, deger: String(T.gunler.length) },
    { anahtar: 'enYuksek', etiket: MO.enYuksek, deger: enYuksek > 0 ? String(enYuksek) : '—' },
    { anahtar: 'oyunSuresi', etiket: MO.oyunSuresi, deger: oyunSuresiMetni(T.sure) },
    { anahtar: 'surum', etiket: MO.surum, deger: [T.surum, DIL_ADLARI[T.dil]].filter(Boolean).join(' · ') || '—' },
  ];

  const tumu = Object.entries(T.bolum).map(([id, b]) => ({ id: Number(id), b }));
  const secilen = tumu.sort((x, y) => y.b.son - x.b.son).slice(0, OZET_BOLUM_SINIRI);
  let vurgu: BolumToplami | null = null;
  for (const { b } of secilen) {
    const zor = b.kayip + b.birakma;
    // Eşitlikte en son oynanan (oyuncunun şimdi takıldığı yer).
    if (zor > 0 && (!vurgu || zor > vurgu.kayip + vurgu.birakma)) vurgu = b;
  }
  const bolumler: OyunOzetiBolumu[] = secilen
    .sort((x, y) => x.id - y.id)
    .map(({ id, b }) => ({
      id,
      deneme: b.deneme,
      kayip: b.kayip,
      birakma: b.birakma,
      ortSure: b.biten ? Math.round(b.sure / b.biten) : null,
      kazanildi: b.kazanildi,
      vurgu: b === vurgu,
    }));

  return { bos: T.sira === 0, satirlar, bolumler, oynananBolum: tumu.length };
}
