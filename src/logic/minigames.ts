/** Tiny playground minigames: bubble-pop and ball-kick (pure state). */

export type MiniKind = 'bubbles' | 'kickball';

export interface Bubble {
  id: number;
  x: number;
  y: number;
  z: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
}

export interface KickBall {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface MiniState {
  kind: MiniKind;
  t: number;
  score: number;
  bubbles: Bubble[];
  ball: KickBall | null;
  done: boolean;
  /** Next bubble id. */
  nextId: number;
}

export const BUBBLE_GOAL = 8;
export const KICK_GOAL = 5;
export const MINI_DURATION = 25;

export function startMini(kind: MiniKind): MiniState {
  return {
    kind,
    t: 0,
    score: 0,
    bubbles: [],
    ball: kind === 'kickball' ? { x: 0, z: 0, vx: 0, vz: 0 } : null,
    done: false,
    nextId: 1,
  };
}

function spawnBubble(s: MiniState, rng: () => number): void {
  s.bubbles.push({
    id: s.nextId++,
    x: (rng() - 0.5) * 8,
    y: 0.8 + rng() * 2.5,
    z: (rng() - 0.5) * 8,
    r: 0.35 + rng() * 0.35,
    vx: (rng() - 0.5) * 1.2,
    vy: 0.4 + rng() * 0.6,
    life: 4 + rng() * 3,
  });
}

/** Advance minigame; `tap` is an optional world-ish tap in playground frame. */
export function stepMini(
  s: MiniState,
  dt: number,
  opts: { playerX: number; playerZ: number; tap?: { x: number; z: number } | null; rng?: () => number },
): MiniState {
  if (s.done) return s;
  const rng = opts.rng ?? Math.random;
  const next: MiniState = {
    ...s,
    t: s.t + dt,
    bubbles: s.bubbles.map((b) => ({ ...b })),
    ball: s.ball ? { ...s.ball } : null,
  };

  if (next.kind === 'bubbles') {
    if (next.bubbles.length < 6 && rng() < dt * 1.8) spawnBubble(next, rng);
    for (const b of next.bubbles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += 0;
      b.life -= dt;
    }
    next.bubbles = next.bubbles.filter((b) => b.life > 0 && b.y < 6);
    if (opts.tap) {
      const hit = next.bubbles.find((b) => Math.hypot(b.x - opts.tap!.x, b.z - opts.tap!.z) < b.r + 0.6);
      if (hit) {
        next.bubbles = next.bubbles.filter((b) => b.id !== hit.id);
        next.score += 1;
      }
    }
    // auto-pop near player head height
    const near = next.bubbles.find((b) => Math.hypot(b.x - opts.playerX, b.z - opts.playerZ) < b.r + 0.9 && b.y < 2.2);
    if (near) {
      next.bubbles = next.bubbles.filter((b) => b.id !== near.id);
      next.score += 1;
    }
    if (next.score >= BUBBLE_GOAL || next.t >= MINI_DURATION) next.done = true;
  } else if (next.kind === 'kickball' && next.ball) {
    const b = next.ball;
    // friction
    b.vx *= Math.pow(0.15, dt);
    b.vz *= Math.pow(0.15, dt);
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    // soft bounds
    if (Math.abs(b.x) > 9) b.vx *= -0.7;
    if (Math.abs(b.z) > 9) b.vz *= -0.7;
    b.x = Math.max(-9, Math.min(9, b.x));
    b.z = Math.max(-9, Math.min(9, b.z));
    const d = Math.hypot(b.x - opts.playerX, b.z - opts.playerZ);
    if (d < 1.2 && Math.hypot(b.vx, b.vz) < 2) {
      const ang = Math.atan2(b.z - opts.playerZ, b.x - opts.playerX);
      b.vx = Math.cos(ang) * 9;
      b.vz = Math.sin(ang) * 9;
      next.score += 1;
    }
    if (next.score >= KICK_GOAL || next.t >= MINI_DURATION) next.done = true;
  }

  return next;
}

export function miniReward(s: MiniState): number {
  if (!s.done) return 0;
  if (s.kind === 'bubbles') return s.score >= BUBBLE_GOAL ? 15 : Math.max(3, s.score * 2);
  return s.score >= KICK_GOAL ? 15 : Math.max(3, s.score * 2);
}
