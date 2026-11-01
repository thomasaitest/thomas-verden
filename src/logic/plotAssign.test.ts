import { describe, expect, it } from 'vitest';
import { allocatePlot, takenPlots } from './plotAssign.ts';

describe('plot assignment', () => {
  it('gives the lowest free plot starting at 1 (0 is local home)', () => {
    expect(allocatePlot(new Set())).toBe(1);
    expect(allocatePlot(new Set([1]))).toBe(2);
    expect(allocatePlot(new Set([1, 2, 4]))).toBe(3);
  });
  it('returns null when all remote plots are taken', () => {
    expect(allocatePlot(new Set([1, 2, 3, 4, 5]))).toBe(null);
  });
  it('ignores plot 0 and junk in takenPlots', () => {
    expect([...takenPlots([0, 1, null, 99, 2])].sort()).toEqual([1, 2]);
  });
});
