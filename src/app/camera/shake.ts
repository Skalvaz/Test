/**
 * Kamera sarsıntısı (Dalga 0'da CameraRig'den ayrıldı). Bugün kare başına
 * rastgele konum kayması (genlik ∝ EngineVisual.shake). Sahibi: Dalga 1'de
 * 1I (O-10 "trauma" modeli: ağırlık dönmede, itkiyle monoton, ayardan
 * kapatılabilir), Dalga 3'te 3D (olay darbeleri).
 *
 * Sözleşme: `remove` kontroller çalışmadan önce geçen karenin kaymasını
 * geri alır (kontroller temiz konumla çalışır), `apply` çizimden hemen önce
 * yenisini ekler. Kayıt belirlenimliliği için Math.random çağrı sırası
 * (x, y, z) korunur.
 */

import * as THREE from 'three';

export class CameraShake {
  private offset = new THREE.Vector3();

  /** Geçen karenin kaymasını geri al */
  remove(camera: THREE.Camera) {
    camera.position.sub(this.offset);
  }

  /** Bu karenin kaymasını hesapla ve ekle (`amount` 0 → kayma yok) */
  apply(camera: THREE.Camera, amount: number) {
    if (amount > 0.001) {
      const s = amount * 0.035;
      this.offset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    } else {
      this.offset.set(0, 0, 0);
    }
    camera.position.add(this.offset);
  }
}
