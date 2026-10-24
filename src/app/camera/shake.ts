/**
 * Kamera sarsıntısı (Dalga 0'da CameraRig'den ayrıldı). Bugün kare başına
 * rastgele konum kayması (genlik ∝ `amount` = EngineVisual.shake). Sahibi:
 * Dalga 1'de 1I (O-10 "trauma" modeli: ağırlık dönmede, itkiyle monoton,
 * ayardan kapatılabilir), Dalga 3'te 3D (olay darbeleri: `impulse`).
 *
 * Sözleşme:
 * - `remove` kontroller çalışmadan önce geçen karenin kaymasını (konum ve
 *   dönme) geri alır (kontroller temiz konumla çalışır), `apply` çizimden
 *   hemen önce yenisini ekler.
 * - `apply` girdisi `ShakeInput`: kare süresi, itki oranı, kamera yakınlığı,
 *   olay darbesi ve bugünkü genlik. App her kare doldurur (CameraRig.update);
 *   1I modeli bunlardan kurar, App'e dokunmaz. Sayı da kabul edilir (eski
 *   çağrılar: yalnız `amount`).
 * - Kayıt belirlenimliliği için Math.random çağrı sırası (x, y, z) korunur;
 *   genlik eşiğin altındayken Math.random çağrılmaz.
 */

import * as THREE from 'three';

export interface ShakeInput {
  /** Bugünkü genlik (EngineVisual.shake: titreşim + surge, 0..~1,6) */
  amount: number;
  /** Kare süresi [s] (trauma sönümü ve gürültü saati için; 0: duraklatılmış) */
  dt: number;
  /** İtki / tasarım itkisi (SimSnapshot.thrustFrac, 0..~1,5) */
  thrustFrac: number;
  /** Kameranın motora yakınlığı 0 (uzak) … 1 (çok yakın); ses modeliyle aynı */
  proximity: number;
  /** Bu karede gelen olay darbesi (3D: surge, kuş çarpması; bugün 0) */
  impulse: number;
}

const toInput = (v: number | ShakeInput): ShakeInput =>
  typeof v === 'number' ? { amount: v, dt: 0, thrustFrac: 0, proximity: 0, impulse: 0 } : v;

export class CameraShake {
  private offset = new THREE.Vector3();
  /** Dönme kayması (bugün birim: konum kayması yeterliydi; 1I dönmeyi kullanır) */
  private rot = new THREE.Quaternion();
  private rotInv = new THREE.Quaternion();
  /** Son karenin girdisi (ölçüm ve testler) */
  last: ShakeInput = toInput(0);

  /** Geçen karenin kaymasını geri al */
  remove(camera: THREE.Camera) {
    camera.position.sub(this.offset);
    if (this.rot.w !== 1) camera.quaternion.multiply(this.rotInv.copy(this.rot).invert());
  }

  /** Bu karenin kaymasını hesapla ve ekle (`amount` 0 → kayma yok) */
  apply(camera: THREE.Camera, input: number | ShakeInput) {
    const inp = toInput(input);
    this.last = inp;
    const amount = inp.amount;
    if (amount > 0.001) {
      const s = amount * 0.035;
      this.offset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    } else {
      this.offset.set(0, 0, 0);
    }
    this.rot.identity();
    camera.position.add(this.offset);
    if (this.rot.w !== 1) camera.quaternion.multiply(this.rot);
  }
}
