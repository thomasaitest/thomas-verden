/** Daytime sky and light weather for the outdoor town (pure maths). Night mode is removed – always day. */

export type WeatherKind = 'clear' | 'cloudy' | 'rain';

export interface SkyState {
  dayT: number;
  weather: WeatherKind;
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
  rain: number;
}

export const DAY_SECONDS = 180;
export const WEATHER_SLOT = 45;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function hexMix(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const A = parse(a);
  const B = parse(b);
  const m = (i: number) => Math.round(A[i]! + (B[i]! - A[i]!) * t);
  return `#${[m(0), m(1), m(2)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export function weatherAt(slot: number): WeatherKind {
  const k = ((slot % 7) + 7) % 7;
  if (k === 0 || k === 3) return 'rain';
  if (k === 1 || k === 5) return 'cloudy';
  return 'clear';
}

export function skyAt(elapsedSec: number): SkyState {
  const wobble = Math.sin((elapsedSec / DAY_SECONDS) * Math.PI * 2) * 0.08;
  const dayT = 0.5 + wobble;
  const sunElevation = 0.75 + wobble * 0.5;
  const daylight = clamp01(0.9 + sunElevation * 0.06);

  const slot = Math.floor(elapsedSec / WEATHER_SLOT);
  const weather = weatherAt(slot);

  let skyTop = '#7eb8e8';
  if (weather === 'cloudy') skyTop = hexMix(skyTop, '#8a9aac', 0.4);
  if (weather === 'rain') skyTop = hexMix(skyTop, '#5a6a7c', 0.5);

  const skyHorizon = hexMix(skyTop, '#d8e8f4', 0.45);
  const fog = hexMix(skyTop, '#c8d8e8', 0.35);
  const rain = weather === 'rain' ? 0.55 : 0;

  return {
    dayT,
    weather,
    daylight,
    sunElevation,
    skyTop,
    skyHorizon,
    fog,
    fogNear: 80,
    fogFar: 260,
    hemiSky: skyTop,
    hemiGround: '#6a8a6a',
    hemiIntensity: 1.15,
    sunColor: '#fff6e8',
    sunIntensity: 2.1,
    rain,
  };
}

export function skyLabel(s: SkyState): string {
  if (s.weather === 'rain') return 'Dag · Regn';
  if (s.weather === 'cloudy') return 'Dag · Skyet';
  return 'Dag · Sol';
}
