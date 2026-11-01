import { describe, expect, it } from 'vitest';
import { isAvatarBed, nearestBed, shouldWakeFromBed, sleepSpotFor } from './sleep.ts';
import { FLOOR_H } from './layout.ts';

describe('avatar bed sleep', () => {
  it('human beds are usable; pet basket is not', () => {
    expect(isAvatarBed('seng')).toBe(true);
    expect(isAvatarBed('dobbeltseng')).toBe(true);
    expect(isAvatarBed('himmelseng')).toBe(true);
    expect(isAvatarBed('dyreseng')).toBe(false);
    expect(isAvatarBed('sofa')).toBe(false);
  });

  it('sleep spot sits on the mattress and keeps the bed yaw', () => {
    const spot = sleepSpotFor({ uid: '1', itemId: 'seng', x: 2, z: -3, rot: 1.2, scale: 1, floor: 0, color: '#fff' });
    expect(spot).toMatchObject({ x: 2, z: -3, yaw: 1.2, itemUid: '1' });
    expect(spot!.y).toBeGreaterThan(0.5);
    expect(spot!.y).toBeLessThan(1.5);
    const up = sleepSpotFor({ uid: '2', itemId: 'seng', x: 0, z: 0, rot: 0, scale: 1, floor: 1, color: '#fff' });
    expect(up!.y).toBeGreaterThan(FLOOR_H);
  });

  it('finds the nearest bed on the same floor', () => {
    const items = [
      { uid: 'a', itemId: 'seng', x: 0, z: 0, rot: 0, scale: 1, floor: 0, color: '#fff' },
      { uid: 'b', itemId: 'seng', x: 10, z: 0, rot: Math.PI / 2, scale: 1, floor: 0, color: '#fff' },
      { uid: 'c', itemId: 'seng', x: 0.5, z: 0.5, rot: 0, scale: 1, floor: 1, color: '#fff' },
    ];
    expect(nearestBed(items, 0.2, 0.1, 0)?.itemUid).toBe('a');
    expect(nearestBed(items, 9.5, 0.2, 0)?.itemUid).toBe('b');
    expect(nearestBed(items, 0.2, 0.1, 1)?.itemUid).toBe('c');
    expect(nearestBed(items, 50, 50, 0)).toBe(null);
  });

  it('wakes on move or jump; sleep does not touch the clock', () => {
    expect(shouldWakeFromBed(0, false)).toBe(false);
    expect(shouldWakeFromBed(0.2, false)).toBe(true);
    expect(shouldWakeFromBed(0, true)).toBe(true);
  });
});
