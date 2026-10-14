import './style.css';
import { Stage } from './render/stage';
import { bootWithHot } from './platform/hot';

// P0 yer tutucu: entegrasyon (P5) gerçek oyun akışını buraya bağlar.
bootWithHot(() => {
  const host = document.getElementById('app')!;
  const stage = new Stage(host, 2);
  const loop = (t: number) => {
    const c = stage.begin();
    const g = c.createLinearGradient(0, 0, 0, stage.height);
    g.addColorStop(0, '#0B1030');
    g.addColorStop(1, '#2A1450');
    c.fillStyle = g;
    c.fillRect(0, 0, stage.width, stage.height);
    c.fillStyle = '#FFF3D6';
    c.font = '800 44px "Baloo 2", ui-rounded, system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('FİTİL', stage.width / 2, stage.height / 2 + 10 * Math.sin(t / 400));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}, () => ({}));
