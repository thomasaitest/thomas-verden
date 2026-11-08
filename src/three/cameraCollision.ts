import * as THREE from 'three';
import type { CircleCollider, RectCollider } from '../logic/collision.ts';

const _out = new THREE.Vector3();

export interface CamBlocks {
  rects: readonly RectCollider[];
  circles: readonly CircleCollider[];
}

export interface CamCollideOpts {
  target: THREE.Vector3;
  desired: THREE.Vector3;
  blocks?: CamBlocks;
  /** Skip colliders that belong to the building the player is already inside. */
  skip?: { x: number; z: number; r: number } | null;
  minDist?: number;
}

function skipped(x: number, z: number, skip?: { x: number; z: number; r: number } | null): boolean {
  if (!skip) return false;
  return Math.hypot(x - skip.x, z - skip.z) < skip.r;
}

/** True when a tall solid (building, fountain core) contains this point. Foliage trunks are ignored. */
export function cameraBlocked(x: number, y: number, z: number, blocks: CamBlocks, skip?: CamCollideOpts['skip']): boolean {
  for (const c of blocks.circles) {
    if (c.r < 1.25) continue;
    // Wide bowls (fountain) are short to walk on, but the camera must stay outside them.
    const top = c.r > 2.5 ? Math.max(c.h ?? 0, 2.6) : (c.h ?? 99);
    if (top < y + 0.35 || top < 1.7) continue;
    if (skipped(c.x, c.z, skip)) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  for (const b of blocks.rects) {
    const top = b.h ?? 99;
    if (top < y + 0.35 || top < 2) continue;
    if (b.hw < 0.9 && b.hd < 0.9) continue;
    if (skipped(b.x, b.z, skip)) continue;
    const cos = Math.cos(b.rot);
    const sin = Math.sin(b.rot);
    const lx = (x - b.x) * cos - (z - b.z) * sin;
    const lz = (x - b.x) * sin + (z - b.z) * cos;
    if (Math.abs(lx) < b.hw && Math.abs(lz) < b.hd) return true;
  }
  return false;
}

/**
 * Pull the camera in along the view ray using the town's analytic colliders.
 * This used to raycast every triangle in the scene (trees, skinned crowds,
 * merged scenery) and then fade shared materials — both made the game stall
 * and flicker.
 */
export function collideCamera(opts: CamCollideOpts): THREE.Vector3 {
  const { target, desired, blocks, skip = null, minDist = 2.2 } = opts;
  if (!blocks) return desired;
  const dx = desired.x - target.x;
  const dy = desired.y - target.y;
  const dz = desired.z - target.z;
  const full = Math.hypot(dx, dy, dz);
  if (full < 0.05) return desired;
  const steps = 12;
  let safe = Math.min(1, minDist / full);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (t * full < minDist) {
      safe = t;
      continue;
    }
    const x = target.x + dx * t;
    const y = target.y + dy * t;
    const z = target.z + dz * t;
    if (cameraBlocked(x, y, z, blocks, skip)) {
      return _out.set(target.x + dx * safe, target.y + dy * safe, target.z + dz * safe).clone();
    }
    safe = t;
  }
  return desired;
}

/**
 * Previously walked the whole scene every frame and rewrote material.transparent.
 * Occlusion is handled by analytic camera pull-in and by hiding interior walls.
 * Kept so old call sites cannot mutate shared materials.
 */
export function fadeOccluders(): void {
  /* no-op */
}
