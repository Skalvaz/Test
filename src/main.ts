/**
 * Turbofan Akademi — giriş noktası.
 */

import './styles.css';
import { App } from './app/App';
import { weather } from './core/weather';
import { ENGINE_GRAPHS, TEMPLATES, builtEngine, builtFor, designFor, overrideGraph, setSlotGraph } from './design/catalog';
import { ARCH_OPTIONS } from './design/architecture';

const container = document.getElementById('app')!;
const loader = document.getElementById('loading')!;
const loaderText = document.getElementById('loading-text')!;

const app = new App(container);
// Test ve kayıt kancaları (derlenmiş sürümde de erişilebilir)
Object.assign(window, {
  __app: app,
  __weather: weather,
  __design: { overrideGraph, builtEngine, ENGINE_GRAPHS, setSlotGraph, builtFor, designFor, TEMPLATES, ARCH_OPTIONS },
});

app
  .init((t) => {
    loaderText.textContent = t;
  })
  .then(() => {
    loader.classList.add('hidden-fade');
    setTimeout(() => loader.remove(), 700);
  })
  .catch((err: Error) => {
    console.error(err);
    loaderText.textContent = `Başlatılamadı: ${err.message}. Tarayıcınız WebGL2 destekliyor mu?`;
  });
