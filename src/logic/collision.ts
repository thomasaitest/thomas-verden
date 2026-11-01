/**
 * Pure 2D (x/z plane) collision helpers. No three.js here so it is easy to test.
 * A player is a circle; the world is made of oriented rectangles and circles.
 * Jumping clears low obstacles when the feet are above their top (`h`).
 * Landable surfaces let you stand on top of things (fountain rim, etc.).
 */
export interface RectCollider {
  x: number;
  z: number;
  /** Half extents along the rectangle's own x / z axes. */
  hw: number;
  hd: number;
  /** Rotation about the y axis (same convention as three.js `rotation.y`). */
  rot: number;
  /** Top of the object; feet at or above this clear it. Default: infinitely tall. */
  h?: number;
}
export interface CircleCollider {
  x: number;
  z: number;
  r: number;
  h?: number;
}
export interface Colliders {
  rects: readonly RectCollider[];
  circles: readonly CircleCollider[];
}
export interface Pos {
  x: number;
  y: number;
  z: number;
}

/** A flat top you can land on (fountain bowl, roof ledge, …). */
export interface Surface {
  x: number;
  z: number;
  /** Circle footprint radius, or use hw/hd for a box. */
  r?: number;
  hw?: number;
  hd?: number;
  rot?: number;
  /** Absolute y of the walkable top. */
  top: number;
}

/** How far above an obstacle the feet must be to pass over it. Small so a normal jump clears benches. */
export const CLEAR_MARGIN = 0.12;

const cleared = (y: number, h: number | undefined) => h !== undefined && y >= h - CLEAR_MARGIN;

function inSurface(s: Surface, x: number, z: number): boolean {
  if (s.r !== undefined) return Math.hypot(x - s.x, z - s.z) <= s.r;
  const hw = s.hw ?? 0;
  const hd = s.hd ?? 0;
  const rot = s.rot ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const wx = x - s.x;
  const wz = z - s.z;
  const lx = wx * cos - wz * sin;
  const lz = wx * sin + wz * cos;
  return Math.abs(lx) <= hw && Math.abs(lz) <= hd;
}

/** Highest surface under (x,z) whose top is at most `y + slack` and at least `minY`. */
export function surfaceUnder(x: number, z: number, y: number, surfaces: readonly Surface[], slack = 0.35, minY = -0.01): number | null {
  let best: number | null = null;
  for (const s of surfaces) {
    if (s.top < minY || s.top > y + slack) continue;
    if (!inSurface(s, x, z)) continue;
    if (best === null || s.top > best) best = s.top;
  }
  return best;
}

/** Push a circle (centre + radius r) out of everything. Slides naturally along walls. Mutates pos. */
export function resolve(pos: Pos, r: number, c: Colliders, passes = 4): boolean {
  let hit = false;
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (const k of c.circles) {
      if (cleared(pos.y, k.h)) continue;
      const dx = pos.x - k.x;
      const dz = pos.z - k.z;
      const d = Math.hypot(dx, dz);
      const min = k.r + r;
      if (d >= min) continue;
      if (d < 1e-6) pos.x = k.x + min;
      else {
        pos.x = k.x + (dx / d) * min;
        pos.z = k.z + (dz / d) * min;
      }
      moved = true;
    }
    for (const b of c.rects) {
      if (cleared(pos.y, b.h)) continue;
      const cos = Math.cos(b.rot);
      const sin = Math.sin(b.rot);
      const wx = pos.x - b.x;
      const wz = pos.z - b.z;
      // world -> rectangle local (inverse of three's rotation.y)
      const lx = wx * cos - wz * sin;
      const lz = wx * sin + wz * cos;
      const cx = Math.max(-b.hw, Math.min(b.hw, lx));
      const cz = Math.max(-b.hd, Math.min(b.hd, lz));
      let nx: number;
      let nz: number;
      if (cx === lx && cz === lz) {
        // centre is inside: leave through the nearest side
        const px = b.hw - Math.abs(lx);
        const pz = b.hd - Math.abs(lz);
        if (px < pz) {
          nx = (lx < 0 ? -1 : 1) * (b.hw + r);
          nz = lz;
        } else {
          nx = lx;
          nz = (lz < 0 ? -1 : 1) * (b.hd + r);
        }
      } else {
        const dx = lx - cx;
        const dz = lz - cz;
        const d = Math.hypot(dx, dz);
        if (d >= r) continue;
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      }
      pos.x = b.x + nx * cos + nz * sin;
      pos.z = b.z - nx * sin + nz * cos;
      moved = true;
    }
    if (!moved) break;
    hit = true;
  }
  return hit;
}

/**
 * Move by (dx, dz) in small sub-steps so a fast player (or a long frame) can never
 * jump over a thin wall, resolving collisions after each step.
 */
export function movePlayer(pos: Pos, dx: number, dz: number, r: number, c: Colliders, bounds?: number, maxStep = 0.3): void {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / maxStep));
  for (let i = 0; i < steps; i++) {
    pos.x += dx / steps;
    pos.z += dz / steps;
    if (bounds !== undefined) {
      pos.x = Math.max(-bounds, Math.min(bounds, pos.x));
      pos.z = Math.max(-bounds, Math.min(bounds, pos.z));
    }
    resolve(pos, r, c);
  }
}

/** True if a circle at (x,z) with radius r overlaps any collider (used for placing and for tests). */
export function blocked(x: number, z: number, r: number, c: Colliders, y = 0): boolean {
  const p = { x, y, z };
  const px = p.x;
  const pz = p.z;
  resolve(p, r - 1e-4, c, 1);
  return Math.abs(p.x - px) > 1e-6 || Math.abs(p.z - pz) > 1e-6;
}

/** True if feet at height y clear this obstacle (for jump-over tests). */
export function clearsAt(y: number, h: number | undefined): boolean {
  return cleared(y, h);
}

/** Can two players see each other? Houses are private per area id. */
export function sameVisibility(localPlace: string, localArea: string | null, remotePlace: string, remoteArea: string | null): boolean {
  const priv = localPlace === 'house' || remotePlace === 'house';
  if (!priv) return true;
  if (localPlace !== remotePlace) return false;
  // both in a house: only same owner's house
  return (localArea ?? '') === (remoteArea ?? '');
}
