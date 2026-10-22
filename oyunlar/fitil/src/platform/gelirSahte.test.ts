import { describe, expect, it } from 'vitest';
import {
  SAHTE_KALICI_ANAHTARI,
  SAHTE_REKLAM_HIZLI_MS,
  SAHTE_REKLAM_MS,
  sahteAyarlari,
  sahteFiyatlar,
  sahteSaglayici,
  type SahteAyarlari,
  type SahteDepo,
  type SahteKatmanlar,
} from './gelirSahte';
import type { ReklamYeri, UrunId } from './gelir';
import { SAHTE_METNI } from './gelirSahte';
import { URUN_METINLERI } from '../ui/metinler';

class Bellek implements SahteDepo {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

/** Katman sahtesi: reklam ve onay sonuçlarını sırayla verir, çağrıları kaydeder. */
function katmanlar(reklamlar: ('odul' | 'iptal' | Error)[] = [], onaylar: (boolean | Error)[] = []) {
  const cagri: string[] = [];
  const k: SahteKatmanlar = {
    async reklam(yer: ReklamYeri, sure: number) {
      cagri.push(`reklam:${yer}:${sure}`);
      const r = reklamlar.shift() ?? 'odul';
      if (r instanceof Error) throw r;
      return r;
    },
    async onay(urun: UrunId, fiyat: string) {
      cagri.push(`onay:${urun}:${fiyat}`);
      const r = onaylar.shift() ?? true;
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { k, cagri };
}

const NORMAL: SahteAyarlari = { reklam: 'normal', satin: 'normal' };

describe('sahte sağlayıcı: test anahtarları', () => {
  it('adresten okunur, bilinmeyen değer normal', () => {
    expect(sahteAyarlari('')).toEqual(NORMAL);
    expect(sahteAyarlari('?gelir=sahte&reklam=hizli&satin=iptal')).toEqual({ reklam: 'hizli', satin: 'iptal' });
    expect(sahteAyarlari('?reklam=yok&satin=hata')).toEqual({ reklam: 'yok', satin: 'hata' });
    expect(sahteAyarlari('?reklam=hata')).toEqual({ reklam: 'hata', satin: 'normal' });
    expect(sahteAyarlari('?reklam=uzun&satin=beklemede')).toEqual(NORMAL);
  });
});

describe('sahte sağlayıcı: reklam', () => {
  it('5 sn (hızlı: 300 ms) katman; sonuç katmandan', async () => {
    const { k, cagri } = katmanlar(['odul', 'iptal']);
    const s = sahteSaglayici(NORMAL, { katmanlar: k, depo: null });
    expect(s.ad).toBe('sahte');
    expect(s.reklamHazir('can')).toBe(true);
    expect(await s.reklamGoster('can')).toBe('odul');
    expect(await s.reklamGoster('hamle')).toBe('iptal');
    const h = katmanlar(['odul']);
    expect(await sahteSaglayici({ reklam: 'hizli', satin: 'normal' }, { katmanlar: h.k, depo: null }).reklamGoster('can')).toBe('odul');
    expect([...cagri, ...h.cagri]).toEqual([`reklam:can:${SAHTE_REKLAM_MS}`, `reklam:hamle:${SAHTE_REKLAM_MS}`, `reklam:can:${SAHTE_REKLAM_HIZLI_MS}`]);
  });
  it('?reklam=yok: hazır değil, gösterim yok; ?reklam=hata: hata; katman açılmaz', async () => {
    const { k, cagri } = katmanlar();
    const yok = sahteSaglayici({ reklam: 'yok', satin: 'normal' }, { katmanlar: k, depo: null });
    expect(yok.reklamHazir('can')).toBe(false);
    expect(yok.reklamHazir('hamle')).toBe(false);
    expect(await yok.reklamGoster('can')).toBe('yok');
    const hata = sahteSaglayici({ reklam: 'hata', satin: 'normal' }, { katmanlar: k, depo: null });
    expect(hata.reklamHazir('can')).toBe(true);
    expect(await hata.reklamGoster('hamle')).toBe('hata');
    expect(cagri).toEqual([]);
  });
  it('belge yoksa, katman fırlatırsa ya da bir katman zaten açıksa hata', async () => {
    expect(await sahteSaglayici(NORMAL, { katmanlar: null, depo: null }).reklamGoster('can')).toBe('hata');
    expect(await sahteSaglayici(NORMAL, { katmanlar: katmanlar([new Error('dom')]).k, depo: null }).reklamGoster('can')).toBe('hata');
    let bitir: (r: 'odul') => void = () => {};
    const s = sahteSaglayici(NORMAL, {
      depo: null,
      katmanlar: { reklam: () => new Promise((r) => (bitir = r)), onay: async () => true },
    });
    const ilk = s.reklamGoster('can');
    expect(await s.reklamGoster('can')).toBe('hata');
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'hata' });
    bitir('odul');
    expect(await ilk).toBe('odul');
    expect(await s.satinAl('can_doldur')).toMatchObject({ durum: 'basarili' });
  });
});

describe('sahte sağlayıcı: mağaza', () => {
  it('deneme fiyatları Mağaza sırasıyla (Türkçe)', async () => {
    expect(sahteFiyatlar()).toEqual({ can_doldur: '₺29,99', guclendirici_paketi: '₺59,99', usta_karti: '₺149,99' });
    const s = sahteSaglayici(NORMAL, { katmanlar: null, depo: null, urunGecikmesi: 0 });
    expect(await s.urunler()).toEqual([
      { id: 'can_doldur', fiyat: '₺29,99' },
      { id: 'guclendirici_paketi', fiyat: '₺59,99' },
      { id: 'usta_karti', fiyat: '₺149,99' },
    ]);
  });
  it('onay kartı: Satın al → başarılı, tekil jeton; Vazgeç → iptal', async () => {
    const { k, cagri } = katmanlar([], [true, false, true]);
    let t = 1000;
    const s = sahteSaglayici(NORMAL, { katmanlar: k, depo: new Bellek(), saat: () => t++ });
    expect(await s.satinAl('can_doldur')).toEqual({ durum: 'basarili', urun: 'can_doldur', jeton: 'sahte-1-1000' });
    expect(await s.satinAl('guclendirici_paketi')).toEqual({ durum: 'iptal' });
    expect(await s.satinAl('guclendirici_paketi')).toEqual({ durum: 'basarili', urun: 'guclendirici_paketi', jeton: 'sahte-2-1001' });
    expect(cagri).toEqual(['onay:can_doldur:₺29,99', 'onay:guclendirici_paketi:₺59,99', 'onay:guclendirici_paketi:₺59,99']);
    await expect(s.tamamla('sahte-1-1000')).resolves.toBeUndefined();
    expect(await s.bekleyenler()).toEqual([]);
  });
  it('?satin=iptal|hata kart açmadan; bilinmeyen ürün, belge yok ya da kart fırlatırsa hata', async () => {
    const { k, cagri } = katmanlar([], [new Error('dom')]);
    expect(await sahteSaglayici({ reklam: 'normal', satin: 'iptal' }, { katmanlar: k, depo: null }).satinAl('can_doldur')).toEqual({ durum: 'iptal' });
    expect(await sahteSaglayici({ reklam: 'normal', satin: 'hata' }, { katmanlar: k, depo: null }).satinAl('usta_karti')).toEqual({ durum: 'hata' });
    expect(await sahteSaglayici(NORMAL, { katmanlar: k, depo: null }).satinAl('elmas' as never)).toEqual({ durum: 'hata' });
    expect(cagri).toEqual([]);
    expect(await sahteSaglayici(NORMAL, { katmanlar: null, depo: null }).satinAl('can_doldur')).toEqual({ durum: 'hata' });
    expect(await sahteSaglayici(NORMAL, { katmanlar: k, depo: null }).satinAl('can_doldur')).toEqual({ durum: 'hata' });
  });
  it('kalıcı alım cihazda saklanır, geri yükleme onu verir; tüketilir saklanmaz', async () => {
    const depo = new Bellek();
    const s = sahteSaglayici(NORMAL, { katmanlar: katmanlar().k, depo });
    expect(await s.geriYukle()).toEqual([]);
    await s.satinAl('can_doldur');
    expect(await s.geriYukle()).toEqual([]);
    await s.satinAl('usta_karti');
    await s.satinAl('usta_karti');
    expect(JSON.parse(depo.getItem(SAHTE_KALICI_ANAHTARI)!)).toEqual(['usta_karti']);
    // Yeni sayfa (yeni sağlayıcı) aynı cihazda geri yükler.
    expect(await sahteSaglayici(NORMAL, { katmanlar: null, depo }).geriYukle()).toEqual(['usta_karti']);
  });
  it('bozuk ya da kapalı depo: geri yükleme boş, kalıcı alım bu sayfada bellekte', async () => {
    const bozuk = new Bellek();
    bozuk.setItem(SAHTE_KALICI_ANAHTARI, '{bozuk');
    expect(await sahteSaglayici(NORMAL, { katmanlar: null, depo: bozuk }).geriYukle()).toEqual([]);
    bozuk.setItem(SAHTE_KALICI_ANAHTARI, '["can_doldur","elmas","usta_karti"]');
    expect(await sahteSaglayici(NORMAL, { katmanlar: null, depo: bozuk }).geriYukle()).toEqual(['usta_karti']);
    const kapali: SahteDepo = {
      getItem: () => {
        throw new Error('kapalı');
      },
      setItem: () => {
        throw new Error('kapalı');
      },
    };
    const s = sahteSaglayici(NORMAL, { katmanlar: katmanlar().k, depo: kapali });
    expect(await s.satinAl('usta_karti')).toMatchObject({ durum: 'basarili', urun: 'usta_karti' });
    expect(await s.geriYukle()).toEqual(['usta_karti']);
  });
});

describe('sahte katman metinleri', () => {
  it('onay kartındaki ürün adları Mağaza satırlarıyla birebir (Türkçe)', () => {
    for (const [id, ad] of Object.entries(SAHTE_METNI.urun)) expect(ad, id).toBe(URUN_METINLERI[id as UrunId].ad);
    expect(SAHTE_METNI.reklamEtiketi).toBe('Deneme reklamı');
  });
});
