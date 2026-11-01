import { describe, expect, it } from 'vitest';
import { afterJump, canJump, clampEnergy, drainWalk, ENERGY_JUMP_COST, ENERGY_MAX, restEnergy } from './energy.ts';

describe('energy', () => {
  it('clamps and drains while walking', () => {
    expect(clampEnergy(2)).toBe(ENERGY_MAX);
    expect(clampEnergy(-1)).toBe(0);
    const e = drainWalk(1, 10, true);
    expect(e).toBeLessThan(1);
    expect(drainWalk(1, 10, false)).toBe(1);
  });
  it('restores on a bench and spends on jump', () => {
    expect(restEnergy(0.2, 4)).toBeGreaterThan(0.9);
    expect(canJump(ENERGY_JUMP_COST)).toBe(true);
    expect(canJump(ENERGY_JUMP_COST - 0.001)).toBe(false);
    expect(afterJump(1)).toBeCloseTo(1 - ENERGY_JUMP_COST, 5);
  });
});
