/**
 * Öğretici saydam el (GDD §1 "Usta'nın eli", §12.1): yüzü gösterilmeyen
 * kurgusal ustanın fırça tutan eli; işaret parmağı ucu çapadır. Krem,
 * yarı saydam, ceviz konturlu; offscreen sprite.
 */
import { PALET } from '../app/katalog';
import { spriteUret, type Sprite } from './tuval';

export function elSpriteUret(boy: number, dpr: number): Sprite {
  // Yerel birim: boy = 64 birim. Parmak ucu (0,0); el sağ alta uzanır.
  const k = boy / 64;
  return spriteUret(boy * 1.25, boy * 1.35, dpr, (c) => {
    c.scale(k, k);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    // Fırça sapı (elin arkasında, çapraz).
    c.strokeStyle = PALET.cevizKoyu;
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(18, 30);
    c.lineTo(52, 62);
    c.stroke();
    c.strokeStyle = PALET.ceviz;
    c.lineWidth = 4.5;
    c.beginPath();
    c.moveTo(18, 30);
    c.lineTo(52, 62);
    c.stroke();
    c.strokeStyle = PALET.altin;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(20, 32);
    c.lineTo(24, 36);
    c.stroke();
    const yol = () => {
      c.beginPath();
      // İşaret parmağı (uç 0,0 → sol üst).
      c.moveTo(-4.5, 1.5);
      c.quadraticCurveTo(-4, -4.5, 1.5, -3.5);
      c.quadraticCurveTo(5.5, -2.5, 7, 2);
      c.lineTo(15, 20);
      // Bükülü parmaklar (üç tümsek).
      c.quadraticCurveTo(20, 15, 24, 19);
      c.quadraticCurveTo(29, 16, 32, 22);
      c.quadraticCurveTo(37, 21, 38, 28);
      // Avuç ve bilek.
      c.quadraticCurveTo(40, 40, 33, 48);
      c.lineTo(36, 58);
      c.lineTo(20, 62);
      c.lineTo(18, 51);
      c.quadraticCurveTo(10, 46, 9, 38);
      // Başparmak.
      c.quadraticCurveTo(2, 34, 1, 27);
      c.quadraticCurveTo(1, 23, 5, 24);
      c.quadraticCurveTo(9, 26, 11, 30);
      c.lineTo(4, 7);
      c.closePath();
    };
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.save();
    c.translate(2.5, 3);
    yol();
    c.fill();
    c.restore();
    const g = c.createLinearGradient(0, 0, 36, 60);
    g.addColorStop(0, '#FFF9EC');
    g.addColorStop(0.6, PALET.kagit);
    g.addColorStop(1, PALET.kagitGolge);
    c.fillStyle = g;
    yol();
    c.fill();
    c.strokeStyle = PALET.cevizKoyu;
    c.lineWidth = 2;
    yol();
    c.stroke();
    // Parmak boğumları ve tırnak.
    c.strokeStyle = 'rgba(90,58,34,0.55)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-1.5, -0.5);
    c.quadraticCurveTo(1.5, -2.5, 4, 0.5);
    c.moveTo(22, 23);
    c.lineTo(24, 28);
    c.moveTo(29, 24);
    c.lineTo(31, 29);
    c.stroke();
    // Altın yüzük (Usta işareti).
    c.strokeStyle = PALET.altin;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(9.5, 12.5);
    c.lineTo(14.5, 10.5);
    c.stroke();
  }, boy * 0.12, boy * 0.12);
}
