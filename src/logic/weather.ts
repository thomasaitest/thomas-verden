/** Daytime sky and light weather for the outdoor town (pure maths). Night mode is removed – always day. */

export type WeatherKind = 'clear' | 'cloudy' | 'rain';

export interface SkyState {
  /** Kept for save/compat; always midday-ish (no night). */
  dayT: number;
  weather: WeatherKind;
  /** Always bright day (0.85..1). */
  daylight: number;
  sunElevation: number;
  skyTop: string;
  skyHorizon: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  /** Rain particle density 0..1. */
  rain: number;
}

/** Real-time seconds for one weather “day” loop (sun drifts a little, never night). */
export const DAY_SECONDS = 180;

/** Weather changes every this many real seconds (deterministic from seed+time). */
export const WEATHER_SLOT = 45;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function hexMix(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const A = parse(a);
  const B = parse(b);
  const m = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return `#${[m(0), m(1), m(2)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export function weatherAt(slot: number): WeatherKind {
  const k = ((slot % 7) + 7) % 7;
  if (k === 0 || k === 3) return 'rain';
  if (k === 1 || k === 5) return 'cloudy';
  return 'clear';
}

/** Pure sky state – always daytime. Sun drifts slightly for interest; never goes dark. */
export function skyAt(elapsedSec: number): SkyState {
  // Map elapsed time into a gentle midday wobble (0.42..0.58), never dawn/dusk/night.
  const wobble = Math.sin((elapsedSec / DAY_SECONDS) * Math.PI * 2) * 0.08;
  const dayT = 0.5 + wobble;
  const sunElevation = 0.75 + wobble * 0.5;
  const daylight = clamp01(0.88 + sunElevation * 0.08);

  const slot = Math.floor(elapsedSec / WEATHER_SLOT);
  const weather = weatherAt(slot);

  let skyTop = '#9fdcff';
  if (weather === 'cloudy') skyTop = hexMix(skyTop, '#a8b8c8', 0.45);
  if (weather === 'rain') skyTop = hexMix(skyTop, '#6a7a8c', 0.55);

  const skyHorizon = hexMix(skyTop, '#ffe9c8', 0.35);
  const fog = hexMix(skyTop, '#dfefff', 0.4);
  const rain = weather === 'rain' ? 0.55 : 0;

  return {
    dayT,
    weather,
    daylight,
    sunElevation,
    skyTop,
    skyHorizon,
    fog,
    fogNear: 140,
    fogFar: 320,
    hemiSky: skyTop,
    hemiGround: '#9ad07a',
    hemiIntensity: 1.45,
    sunColor: '#fff4dc',
    sunIntensity: 1.85,
    rain,
  };
}

/** Label for HUD (Norwegian). Never «Natt». */
export function skyLabel(s: SkyState): string {
  if (s.weather === 'rain') return 'Dag · Regn 🌧️';
  if (s.weather === 'cloudy') return 'Dag · Skyet ☁️';
  return 'Dag · Sol ☀️';
}
