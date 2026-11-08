import { describe, expect, it } from 'vitest';
import { budgetForTier, nextTier } from './frameBudget.ts';

describe('render budget', () => {
  it('drops lights, resolution and tree detail on the lowest tier', () => {
    const low = budgetForTier(0);
    const mid = budgetForTier(1);
    const high = budgetForTier(2);
    expect(low.maxLights).toBeLessThan(mid.maxLights);
    expect(low.treeLod).toBeLessThan(mid.treeLod);
    expect(low.pixelRatioCap).toBeLessThan(mid.pixelRatioCap);
    expect(low.shadows).toBe(false);
    expect(low.bloom).toBe(false);
    expect(high.shadows).toBe(true);
    expect(high.bloom).toBe(true);
    expect(high.maxLights).toBeLessThanOrEqual(4);
  });

  it('steps down after sustained slow frames and up only under the HQ ceiling', () => {
    expect(nextTier(1, 10, 0, 2)).toBe(0);
    expect(nextTier(0, 30, 0, 2)).toBe(0);
    expect(nextTier(1, 0, 40, 1)).toBe(1);
    expect(nextTier(1, 0, 40, 2)).toBe(2);
    expect(nextTier(2, 0, 40, 2)).toBe(2);
    expect(nextTier(2, 3, 0, 2)).toBe(2);
  });
});
