/** Player energy (0–1). Walking drains a little; resting on a bench restores it. */
export const ENERGY_MAX = 1;
export const ENERGY_WALK_DRAIN = 0.015; // per second while moving
export const ENERGY_REST_RATE = 0.25; // per second while sitting
export const ENERGY_JUMP_COST = 0.04;

export function clampEnergy(e: number): number {
  return Math.max(0, Math.min(ENERGY_MAX, e));
}

export function drainWalk(energy: number, dt: number, moving: boolean): number {
  if (!moving) return energy;
  return clampEnergy(energy - ENERGY_WALK_DRAIN * dt);
}

export function restEnergy(energy: number, dt: number): number {
  return clampEnergy(energy + ENERGY_REST_RATE * dt);
}

export function canJump(energy: number): boolean {
  return energy >= ENERGY_JUMP_COST;
}

export function afterJump(energy: number): number {
  return clampEnergy(energy - ENERGY_JUMP_COST);
}
