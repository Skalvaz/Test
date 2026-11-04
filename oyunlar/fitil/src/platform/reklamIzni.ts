/**
 * Reklam izni (KVKK açık rızası, docs/YASAL-UYUM.md §2): ödüllü reklamı
 * Google AdMob gösterir; bunun için cihazın reklam kimliği ve IP adresi
 * Google'a (ABD) aktarılır. Oyuncu ilk kez "Reklam izle"ye dokunduğunda
 * sorulur; izin verilene kadar reklam SDK'sı BAŞLAMAZ (onaydan önce veri
 * gitmez). Kişiselleştirilmiş reklam ayrı ve varsayılan kapalıdır (önceden
 * işaretli kutu yok). Ayarlar > Reklam izni'nden her an değiştirilir.
 *
 * Cihaza özgüdür (bulut kaydına girmez): `localStorage` `fitil.reklam-izni`,
 * her erişim try/catch. Saf yardımcılar test edilir.
 */
export interface ReklamIzni {
  /** Reklam verisinin işlenmesine ve yurt dışına aktarılmasına açık rıza. */
  izin: boolean;
  /** İlgi alanına göre (kişiselleştirilmiş) reklam; false → kişiselleştirilmemiş (npa). */
  kisisel: boolean;
  /** Kararın verildiği an (ms; ispat için). */
  tarih: number;
}

export const REKLAM_IZNI_ANAHTARI = 'fitil.reklam-izni';

/** Depolanan metni çözer; bozuksa null (yeniden sorulur). */
export function reklamIzniCoz(x: unknown): ReklamIzni | null {
  if (typeof x !== 'string') return null;
  try {
    const v = JSON.parse(x) as Partial<ReklamIzni>;
    if (typeof v !== 'object' || v === null || typeof v.izin !== 'boolean') return null;
    return { izin: v.izin, kisisel: v.izin && v.kisisel === true, tarih: typeof v.tarih === 'number' ? v.tarih : 0 };
  } catch {
    return null;
  }
}

export function reklamIzniOku(depo: Pick<Storage, 'getItem'> | null = yerelDepo()): ReklamIzni | null {
  try {
    return reklamIzniCoz(depo?.getItem(REKLAM_IZNI_ANAHTARI) ?? null);
  } catch {
    return null;
  }
}

export function reklamIzniYaz(i: ReklamIzni, depo: Pick<Storage, 'setItem'> | null = yerelDepo()): void {
  try {
    depo?.setItem(REKLAM_IZNI_ANAHTARI, JSON.stringify({ izin: i.izin, kisisel: i.izin && i.kisisel, tarih: i.tarih }));
  } catch {
    /* depo yok ya da dolu: karar bu oturumda bellekte kalır, sonra yeniden sorulur */
  }
}

function yerelDepo(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
