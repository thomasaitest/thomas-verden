import { describe, expect, it } from 'vitest';
import { activityPose, canStartActivity, nearPlaza } from './activity.ts';

describe('plaza activities', () => {
  it('nearPlaza detects the fountain area', () => {
    expect(nearPlaza(0, 0)).toBe(true);
    expect(nearPlaza(50, 50)).toBe(false);
  });
  it('dance pose orbits the plaza', () => {
    const a = activityPose('dance', 1, 0);
    expect(Math.hypot(a.x, a.z)).toBeGreaterThan(3);
    expect(a.pose).toBe('dance');
  });
  it('guards start conditions', () => {
    expect(canStartActivity({ inTown: true, nearPlaza: true, driving: false, riding: false, using: false, paused: false })).toBe(true);
    expect(canStartActivity({ inTown: true, nearPlaza: true, driving: true, riding: false, using: false, paused: false })).toBe(false);
  });
});
