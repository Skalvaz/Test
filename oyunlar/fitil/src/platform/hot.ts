/**
 * claude.ai görüntüleyicisinin canlı güncelleme kancası. Sayfa yeni sürümle
 * yeniden yüklendiğinde oyunun durumu (ör. süren bölüm) korunur. Bağımsız
 * dosyada `window.claude` yoktur; doğrudan başlatılır.
 */
export function bootWithHot(start: (data: unknown) => void, snapshot: () => unknown): void {
  const hot = typeof window !== 'undefined' ? window.claude?.hot : undefined;
  try {
    hot?.snapshot?.(snapshot);
  } catch {
    /* kanca yoksa sorun değil */
  }
  if (hot?.ready) hot.ready(start);
  else start(hot?.data ?? {});
}
