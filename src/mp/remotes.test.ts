import { describe, expect, it } from 'vitest';
import { sameVisibility } from '../logic/collision.ts';
import { ridePetScale, rideSeatOffset } from './ride.ts';

describe('remote riding', () => {
  it('raises the rider to the pony seat (not beside it)', () => {
    const scale = ridePetScale(1.5);
    expect(scale).toBeGreaterThanOrEqual(2.2);
    const dy = rideSeatOffset(0.8, scale);
    expect(dy).toBeGreaterThan(0.5);
  });
  it('hides outside players while you are in your house', () => {
    expect(sameVisibility('house', 'me', 'town', null)).toBe(false);
    expect(sameVisibility('house', 'me', 'house', 'me')).toBe(true);
  });
});
