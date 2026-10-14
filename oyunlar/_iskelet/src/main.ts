import './style.css';
import { Stage } from './render/stage';
import { bootWithHot } from './platform/hot';

bootWithHot(() => {
  const host = document.getElementById('app')!;
  const stage = new Stage(host);
  const loop = (t: number) => {
    const c = stage.begin();
    c.fillStyle = '#101418';
    c.fillRect(0, 0, stage.width, stage.height);
    c.fillStyle = '#e8c86a';
    c.beginPath();
    c.arc(stage.width / 2, stage.height / 2, 40 + 10 * Math.sin(t / 300), 0, Math.PI * 2);
    c.fill();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}, () => ({}));
