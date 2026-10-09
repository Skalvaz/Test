/**
 * Motor (yuva) değişince kameranın yeniden kadrajlanıp kadrajlanmayacağı
 * (App.setEngine). Ayrı dosyada: App DOM'a bağlı, bu karar testte sınanır.
 */

import type { CameraView, ViewName } from './CameraRig';

type ViewSet = Partial<Record<ViewName, CameraView>>;

/**
 * Seçili açı motora bağlıysa yeniden kadrajlanır: yakın açılar (fan, giriş)
 * her motorda ayrıdır; öbür açılarda eski ya da yeni açı takımında motora
 * özel bir değer varsa kamera eski motora göre durmaktadır. Yalnız yeni
 * takıma bakmak yetmez: atölye yuvasının (her açısı ölçeklenip hücreye
 * sığdırılmış) bir şablon yuvasına dönüşünde kamera küçük/büyük motorun
 * konumunda ve geniş görüş açısında kalırdı. İki takımda da yoksa açı
 * VIEWS'ten gelir ve motorla değişmez.
 */
export function needsReframe(cur: ViewName, before: ViewSet, after: ViewSet): boolean {
  if (cur === 'menu') return false;
  if (cur === 'fan' || cur === 'inlet') return true;
  return !!before[cur] || !!after[cur];
}
