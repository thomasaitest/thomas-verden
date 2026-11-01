/** Happy little sounds generated with WebAudio. No sound files needed. */
let ctx: AudioContext | null = null;
let enabled = true;
let musicTimer: number | null = null;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    stopMusic();
    setLocationAmbient(null);
  }
}

/** iPad Safari only plays audio after a touch, so unlock on the first one. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, slideTo?: number): void {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const notes = (list: number[], step: number, type: OscillatorType = 'triangle', vol = 0.16) => list.forEach((f, i) => tone(f, i * step, step * 1.6, type, vol));

export const sfx = {
  tap: () => tone(660, 0, 0.08, 'sine', 0.12, 880),
  pop: () => tone(420, 0, 0.12, 'sine', 0.18, 900),
  coin: () => notes([988, 1319], 0.07, 'square', 0.07),
  door: () => tone(220, 0, 0.35, 'triangle', 0.14, 440),
  safe: () => notes([523, 659, 784], 0.08),
  item: () => notes([784, 988, 1175, 1568], 0.07),
  trap: () => tone(330, 0, 0.45, 'sawtooth', 0.08, 140),
  win: () => notes([523, 659, 784, 1047, 784, 1047, 1319], 0.11),
  lose: () => notes([392, 349, 330, 262], 0.16, 'triangle', 0.12),
  wobble: () => tone(300, 0, 0.15, 'sine', 0.14, 360),
  hatch: () => notes([659, 784, 988, 1319, 1568], 0.08, 'sine', 0.18),
  care: () => notes([660, 880, 1100], 0.07, 'sine', 0.14),
  nope: () => tone(260, 0, 0.18, 'triangle', 0.1, 220),
  grow: () => notes([523, 784, 659, 1047, 1319], 0.1, 'triangle', 0.16),
  buy: () => notes([784, 1047, 1319], 0.06, 'square', 0.06),
  whoosh: () => tone(200, 0, 0.6, 'sine', 0.1, 900),
};

/** A small looping party tune for the dance floor. */
export function startMusic(): void {
  if (!ctx || !enabled || musicTimer !== null) return;
  const bar = [523, 659, 784, 659, 587, 698, 880, 698];
  let i = 0;
  musicTimer = window.setInterval(() => {
    tone(bar[i % bar.length], 0, 0.22, 'triangle', 0.07);
    if (i % 2 === 0) tone(bar[i % bar.length] / 4, 0, 0.18, 'sine', 0.09);
    i++;
  }, 250);
}

export function stopMusic(): void {
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
}

export function musicPlaying(): boolean {
  return musicTimer !== null;
}

/** Soft ambient bed that changes with where you are. */
let ambientTimer: number | null = null;
let ambientPlace: string | null = null;

const AMBIENT: Record<string, () => void> = {
  town: () => {
    tone(880 + Math.random() * 200, 0, 0.08, 'sine', 0.02);
    if (Math.random() < 0.3) tone(1320, 0.05, 0.05, 'triangle', 0.015);
  },
  house: () => {
    tone(392, 0, 0.25, 'sine', 0.025);
    tone(494, 0.12, 0.2, 'sine', 0.02);
  },
  play: () => {
    notes([659, 784, 988], 0.05, 'square', 0.03);
  },
  shop: () => {
    tone(1047, 0, 0.06, 'square', 0.03);
  },
  cars: () => {
    tone(180, 0, 0.2, 'sawtooth', 0.02, 120);
  },
  pets: () => {
    tone(700, 0, 0.08, 'sine', 0.03, 900);
  },
  plaza: () => {
    notes([523, 659, 784, 659], 0.08, 'triangle', 0.04);
  },
  rain: () => {
    tone(400 + Math.random() * 400, 0, 0.04, 'sine', 0.012);
  },
};

export function setLocationAmbient(place: string | null): void {
  if (!enabled) {
    if (ambientTimer !== null) {
      window.clearInterval(ambientTimer);
      ambientTimer = null;
    }
    ambientPlace = null;
    return;
  }
  if (place === ambientPlace) return;
  ambientPlace = place;
  if (ambientTimer !== null) {
    window.clearInterval(ambientTimer);
    ambientTimer = null;
  }
  if (!place || !AMBIENT[place]) return;
  const beat = place === 'rain' ? 180 : place === 'play' || place === 'plaza' ? 900 : 1400;
  ambientTimer = window.setInterval(() => {
    if (!enabled || !ctx) return;
    AMBIENT[place]?.();
  }, beat);
}

export function locationAmbient(): string | null {
  return ambientPlace;
}
