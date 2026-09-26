/**
 * Turbofan Akademi — giriş noktası.
 */

import './styles.css';
import { App } from './app/App';

const container = document.getElementById('app')!;
const loader = document.getElementById('loading')!;
const loaderText = document.getElementById('loading-text')!;

const app = new App(container);
(window as unknown as { __app: App }).__app = app;

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
