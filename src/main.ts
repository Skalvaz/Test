/**
 * Turbofan Akademi — giriş noktası.
 */

import './styles.css';
import { App } from './app/App';
import { weather } from './core/weather';
import { ENGINE_GRAPHS, builtEngine, overrideGraph } from './design/catalog';

const container = document.getElementById('app')!;
const loader = document.getElementById('loading')!;
const loaderText = document.getElementById('loading-text')!;

const app = new App(container);
// Test ve kayıt kancaları (derlenmiş sürümde de erişilebilir)
Object.assign(window, { __app: app, __weather: weather, __design: { overrideGraph, builtEngine, ENGINE_GRAPHS } });

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
