/**
 * Turbofan Akademi — giriş noktası.
 */

import './styles/index.css';
import { App } from './app/App';
import { onLoadProgress } from './app/loadProgress';
import { weather } from './core/weather';
import { ENGINE_GRAPHS, TEMPLATES, builtEngine, builtFor, designFor, overrideGraph, setSlotGraph } from './design/catalog';
import { ARCH_OPTIONS } from './design/architecture';

const container = document.getElementById('app')!;
const loader = document.getElementById('loading')!;
const loaderText = document.getElementById('loading-text')!;
const loaderBar = document.getElementById('loading-progress');

// Yükleme sözleşmesi (src/app/loadProgress.ts): App aşama olaylarını yayar,
// yükleme ekranı çizer. Bugün yalnız metin; çubuk iskeleti gizli (1C çizer)
onLoadProgress((p) => {
  loader.dataset.stage = p.stage;
  loader.style.setProperty('--load', p.fraction.toFixed(3));
  loaderBar?.setAttribute('aria-valuenow', String(Math.round(p.fraction * 100)));
  if (!p.done) loaderText.textContent = p.label;
});

const app = new App(container);
// Test ve kayıt kancaları (derlenmiş sürümde de erişilebilir)
Object.assign(window, {
  __app: app,
  __weather: weather,
  __design: { overrideGraph, builtEngine, ENGINE_GRAPHS, setSlotGraph, builtFor, designFor, TEMPLATES, ARCH_OPTIONS },
});

app
  .init()
  .then(() => {
    loader.classList.add('hidden-fade');
    setTimeout(() => loader.remove(), 700);
  })
  .catch((err: Error) => {
    console.error(err);
    loaderText.textContent = `Başlatılamadı: ${err.message}. Tarayıcınız WebGL2 destekliyor mu?`;
  });
