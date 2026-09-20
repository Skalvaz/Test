/**
 * Uçuş göstergesi tipi telemetri paneli.
 * Motor modelinin ürettiği N1/N2/EGT/itki değerlerini canlı gösterir.
 */

const ROWS = [
  { key: 'n1', label: 'N1', unit: '%', max: 100, redline: 101 },
  { key: 'n2', label: 'N2', unit: '%', max: 105, redline: 100 },
  { key: 'egt', label: 'EGT', unit: '°C', max: 950, redline: 905 },
  { key: 'thrust', label: 'İTKİ', unit: 'kN', max: 340, redline: 999 },
  { key: 'fuel', label: 'YAKIT', unit: 'kg/s', max: 3.0, redline: 999 },
];

export function createHud(container) {
  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <div class="hud-title">
      <span class="hud-dot"></span>
      <span>TURBOFAN · YÜKSEK BAYPAS</span>
    </div>
    <div class="hud-rows"></div>
    <div class="hud-foot">
      <span id="hud-tip">Pala ucu M 0.00</span>
      <span id="hud-mode">RÖLANTİ</span>
    </div>
  `;
  const rowsEl = root.querySelector('.hud-rows');
  const rowEls = {};

  for (const row of ROWS) {
    const el = document.createElement('div');
    el.className = 'hud-row';
    el.innerHTML = `
      <span class="hud-label">${row.label}</span>
      <span class="hud-bar"><i></i></span>
      <span class="hud-value">0<em>${row.unit}</em></span>
    `;
    rowsEl.appendChild(el);
    rowEls[row.key] = {
      bar: el.querySelector('i'),
      value: el.querySelector('.hud-value'),
      cfg: row,
    };
  }

  container.appendChild(root);

  function update(t) {
    for (const row of ROWS) {
      const el = rowEls[row.key];
      const v = t[row.key];
      const pct = Math.max(0, Math.min(1, v / row.max));
      el.bar.style.width = `${pct * 100}%`;
      el.bar.classList.toggle('over', v > row.redline);
      const decimals = row.key === 'fuel' ? 2 : row.key === 'egt' ? 0 : 1;
      el.value.innerHTML = `${v.toFixed(decimals)}<em>${row.unit}</em>`;
    }
    root.querySelector('#hud-tip').textContent = `Pala ucu M ${t.tipMach.toFixed(2)}`;
    const mode =
      t.n1 < 5 ? 'KESİK' : t.n1 < 28 ? 'RÖLANTİ' : t.n1 < 85 ? 'TIRMANIŞ' : 'KALKIŞ';
    root.querySelector('#hud-mode').textContent = mode;
  }

  return { root, update };
}

/** Basit FPS / çizim istatistiği göstergesi. */
export function createStats(container, renderer) {
  const el = document.createElement('div');
  el.className = 'stats';
  container.appendChild(el);

  let frames = 0;
  let last = performance.now();
  let fps = 0;

  function update() {
    frames++;
    const now = performance.now();
    if (now - last >= 500) {
      fps = (frames * 1000) / (now - last);
      frames = 0;
      last = now;
      const info = renderer.info.render;
      el.textContent = `${fps.toFixed(0)} FPS · ${(info.triangles / 1000).toFixed(0)}k üçgen · ${info.calls} çizim`;
    }
  }
  return { update };
}
