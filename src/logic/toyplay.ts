/**
 * What happens in the world when a pet plays with a toy: a small script that moves the toy and tells the pet
 * where to run and how to act. Plain maths (x/z on the ground, y up), no three.js, so it can be tested.
 *
 *  - fetch (ball, stick): you throw it, the pet runs after it, picks it up, brings it back; two rounds.
 *  - chase (yarn): the ball of yarn rolls around and the pet chases it and bats it onwards.
 *  - cuddle (teddy): the teddy is put down, the pet runs to it, hops with joy and then falls asleep on it.
 */
import type { ToyPlay } from './catalog.ts';

export type PlayPose = 'walk' | 'happy' | 'idle' | 'sleep';

export interface Pt {
  x: number;
  z: number;
}

export interface PlayState {
  kind: ToyPlay;
  /** Seconds since it started. */
  t: number;
  phase: 'throw' | 'run' | 'carry' | 'drop' | 'chase' | 'hug' | 'rest' | 'done';
  /** Seconds spent in this phase. */
  pt: number;
  round: number;
  /** Direction of the next throw / roll (radians, 0 = +z). */
  heading: number;
  from: Pt;
  to: Pt;
  toy: { x: number; y: number; z: number; spin: number; visible: boolean };
  bats: number;
  speed: number;
  /** How far a fetch toy is thrown. */
  reach: number;
}

export interface PlayStep {
  /** Where the pet should head for (null = stay). */
  target: Pt | null;
  /** How close it has to get. */
  stopDist: number;
  pose: PlayPose;
  /** The toy is in the pet's mouth: the toy follows the pet. */
  carried: boolean;
}

export const FETCH_DISTANCE = 7;
export const FETCH_ROUNDS = 2;
export const THROW_TIME = 0.8;
export const MAX_PLAY_TIME = 16;
export const CUDDLE_HUG_TIME = 3.5;
export const CHASE_TIME = 9;

const at = (p: Pt, heading: number, d: number): Pt => ({ x: p.x + Math.sin(heading) * d, z: p.z + Math.cos(heading) * d });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);

export function startPlay(kind: ToyPlay, origin: Pt, heading: number, distance = FETCH_DISTANCE): PlayState {
  const base: PlayState = {
    kind,
    t: 0,
    pt: 0,
    round: 0,
    heading,
    from: origin,
    to: origin,
    toy: { x: origin.x, y: 1.4, z: origin.z, spin: 0, visible: true },
    bats: 0,
    speed: 0,
    reach: distance,
    phase: 'throw',
  };
  if (kind === 'fetch') return { ...base, to: at(origin, heading, distance), reach: distance };
  if (kind === 'cuddle') return { ...base, phase: 'throw', to: at(origin, heading, 2.2) };
  return { ...base, phase: 'chase', to: origin, speed: 4.2, toy: { ...base.toy, y: 0.25 } };
}

const go = (s: PlayState, phase: PlayState['phase']) => {
  s.phase = phase;
  s.pt = 0;
};

/**
 * Advance the play by dt. `pet` and `player` are the ground positions right now. Returns what the pet should do;
 * the state (including the toy's position) is updated in place.
 */
export function stepPlay(s: PlayState, dt: number, pet: Pt, player: Pt): PlayStep {
  s.t += dt;
  s.pt += dt;
  if (s.t > MAX_PLAY_TIME && s.phase !== 'done' && s.phase !== 'rest') go(s, 'rest');
  switch (s.kind) {
    case 'fetch':
      return stepFetch(s, dt, pet, player);
    case 'chase':
      return stepChase(s, dt, pet);
    case 'cuddle':
      return stepCuddle(s, pet);
  }
}

function stepFetch(s: PlayState, dt: number, pet: Pt, player: Pt): PlayStep {
  switch (s.phase) {
    case 'throw': {
      const k = Math.min(1, s.pt / THROW_TIME);
      s.toy.x = s.from.x + (s.to.x - s.from.x) * k;
      s.toy.z = s.from.z + (s.to.z - s.from.z) * k;
      s.toy.y = 0.25 + Math.sin(k * Math.PI) * 3.2 + (1 - k) * 1.1;
      s.toy.spin += dt * 14;
      if (k >= 1) {
        s.toy.y = 0.25;
        go(s, 'run');
      }
      return { target: s.to, stopDist: 0.5, pose: 'walk', carried: false };
    }
    case 'run': {
      // a ball bounces once, then lies still
      s.toy.y = 0.25 + Math.abs(Math.sin(Math.min(s.pt, 0.5) * 6.28)) * 0.25 * Math.max(0, 1 - s.pt * 2);
      if (dist(pet, s.to) < 0.9 || s.pt > 5) go(s, 'carry');
      return { target: s.to, stopDist: 0.5, pose: 'walk', carried: false };
    }
    case 'carry': {
      if (dist(pet, player) < 2.0 || s.pt > 6) {
        go(s, 'drop');
        s.toy.x = player.x;
        s.toy.z = player.z;
        return { target: null, stopDist: 0, pose: 'happy', carried: false };
      }
      return { target: player, stopDist: 1.6, pose: 'walk', carried: true };
    }
    case 'drop': {
      s.toy.y = 0.25;
      // the toy lies at your feet; one more round or finish
      if (s.pt > 0.7) {
        s.round++;
        if (s.round >= FETCH_ROUNDS) go(s, 'rest');
        else {
          s.heading += 0.9;
          s.from = { x: player.x, z: player.z };
          s.to = at(player, s.heading, s.reach * 0.8);
          go(s, 'throw');
        }
      }
      return { target: null, stopDist: 0, pose: 'happy', carried: false };
    }
    case 'rest': {
      s.toy.visible = s.pt < 1.2;
      s.toy.x = player.x;
      s.toy.z = player.z;
      if (s.pt > 1.4) go(s, 'done');
      return { target: null, stopDist: 0, pose: 'happy', carried: false };
    }
    default:
      return { target: null, stopDist: 0, pose: 'idle', carried: false };
  }
}

function stepChase(s: PlayState, dt: number, pet: Pt): PlayStep {
  if (s.phase === 'chase') {
    // the yarn rolls on, slowing down; when the pet catches up it gets batted off in a new direction
    s.toy.x += Math.sin(s.heading) * s.speed * dt;
    s.toy.z += Math.cos(s.heading) * s.speed * dt;
    s.toy.y = 0.25;
    s.toy.spin += s.speed * dt * 4;
    s.speed = Math.max(0.6, s.speed - dt * 1.1);
    const toy = { x: s.toy.x, z: s.toy.z };
    if (dist(pet, toy) < 0.8 && s.pt > 0.4) {
      s.bats++;
      s.heading += 1.7 + (s.bats % 3) * 0.5;
      s.speed = 4.2;
      s.pt = 0;
    }
    if (s.t > CHASE_TIME) go(s, 'rest');
    return { target: toy, stopDist: 0.4, pose: 'walk', carried: false };
  }
  if (s.phase === 'rest') {
    s.toy.y = 0.25;
    if (s.pt > 1.5) go(s, 'done');
    return { target: null, stopDist: 0, pose: 'happy', carried: false };
  }
  return { target: null, stopDist: 0, pose: 'idle', carried: false };
}

function stepCuddle(s: PlayState, pet: Pt): PlayStep {
  switch (s.phase) {
    case 'throw': {
      // the teddy is set down in front of you
      const k = Math.min(1, s.pt / 0.5);
      s.toy.x = s.from.x + (s.to.x - s.from.x) * k;
      s.toy.z = s.from.z + (s.to.z - s.from.z) * k;
      s.toy.y = 0.1 + (1 - k) * 1.2;
      if (k >= 1) go(s, 'run');
      return { target: s.to, stopDist: 0.7, pose: 'walk', carried: false };
    }
    case 'run': {
      s.toy.y = 0.1;
      if (dist(pet, s.to) < 1.0 || s.pt > 6) go(s, 'hug');
      return { target: s.to, stopDist: 0.7, pose: 'walk', carried: false };
    }
    case 'hug': {
      s.toy.y = 0.1 + Math.abs(Math.sin(s.pt * 6)) * 0.08;
      // hops with joy, then curls up on the teddy
      const pose: PlayPose = s.pt < CUDDLE_HUG_TIME * 0.6 ? 'happy' : 'sleep';
      if (s.pt > CUDDLE_HUG_TIME) go(s, 'rest');
      return { target: null, stopDist: 0, pose, carried: false };
    }
    case 'rest': {
      s.toy.visible = s.pt < 1.0;
      if (s.pt > 1.2) go(s, 'done');
      return { target: null, stopDist: 0, pose: 'idle', carried: false };
    }
    default:
      return { target: null, stopDist: 0, pose: 'idle', carried: false };
  }
}

export const playDone = (s: PlayState): boolean => s.phase === 'done';
