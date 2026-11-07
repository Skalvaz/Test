/**
 * Android paylaş penceresi (`@capacitor/share`) — `window.FitilYerel.paylas`.
 * Kayıt kodunu oyuncunun seçtiği uygulamaya (e-posta, not, Drive…) verir;
 * oyun hiçbir yere göndermez. Vazgeçmek `iptal`, eklenti yoksa `yok`.
 */
import { Share } from '@capacitor/share';
import type { PaylasSonucu } from '../paylas';

export async function yerelPaylas(metin: string, baslik: string): Promise<PaylasSonucu> {
  try {
    const c = await Share.canShare();
    if (!c.value) return 'yok';
  } catch {
    return 'yok';
  }
  try {
    await Share.share({ title: baslik, text: metin, dialogTitle: baslik });
    return 'tamam';
  } catch (e) {
    // Android eklentisi vazgeçmede "Share canceled" ile reddeder.
    const m = String((e as { message?: unknown } | null)?.message ?? e);
    return /cancel/i.test(m) ? 'iptal' : 'yok';
  }
}
