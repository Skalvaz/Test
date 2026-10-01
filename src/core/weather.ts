/**
 * Paylaşılan hava durumu: bağıl nem (yoğuşma efektleri) ve yağmur.
 * Test hücresi panelindeki nem kaydırıcısı ve ortam seçimi (yağmurlu
 * havaalanı) yazar; motor efektleri, yağmur ve ıslak zemin okur.
 */
export const weather = {
  /** Bağıl nem 0..1 */
  humidity: 0.6,
  /** Yağış şiddeti 0..1 (ortam seçer) */
  rain: 0,
};

/** Islaklık: yağmur başlayınca yavaş artar, durunca daha yavaş kurur */
export const wetUniforms = {
  uWet: { value: 0 },
  uRainTime: { value: 0 },
};

export function updateWeather(dt: number) {
  const w = wetUniforms.uWet;
  const target = weather.rain;
  w.value += (target - w.value) * Math.min(1, dt * (target > w.value ? 0.6 : 0.08));
  wetUniforms.uRainTime.value += dt;
}

/** Etkin nem: yağmurda hava doymuştur */
export function effectiveHumidity() {
  return Math.max(weather.humidity, 0.95 * weather.rain);
}
