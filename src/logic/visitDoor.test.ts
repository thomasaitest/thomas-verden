import { describe, expect, it } from 'vitest';
import { exteriorFootprint, friendDoorPos, HOME_ENTER_RADIUS, isRemotePlot, nearFriendDoor, VISIT_DOOR_RADIUS } from './visitDoor.ts';

describe('visitDoor', () => {
  it('places the door outside the house footprint (past half-depth)', () => {
    const plot = { x: -82, z: -58, rot: 0 };
    const door = friendDoorPos(plot, 'hytte');
    const { d } = exteriorFootprint('hytte');
    expect(door.x).toBeCloseTo(plot.x, 5);
    expect(door.z).toBeGreaterThan(plot.z + d / 2);
    expect(Math.hypot(door.x - plot.x, door.z - plot.z)).toBeGreaterThan(d / 2 + 1);
  });

  it('triggers Besøk at the door, not at plot centre', () => {
    const plot = { x: -82, z: -58, rot: 0 };
    const door = friendDoorPos(plot, 'villa');
    expect(nearFriendDoor(door.x, door.z, plot, 'villa')).toBe(true);
    expect(nearFriendDoor(plot.x, plot.z, plot, 'villa')).toBe(false);
    // standing 8m south of centre (old buggy door walk) may miss centre-radius-6 but hit door
    expect(nearFriendDoor(door.x, door.z + 0.5, plot, 'villa', VISIT_DOOR_RADIUS)).toBe(true);
  });

  it('accepts plot indices safely (plot 0 is local home, not a remote)', () => {
    expect(isRemotePlot(0, 6)).toBe(false);
    expect(isRemotePlot(1, 6)).toBe(true);
    expect(isRemotePlot(5, 6)).toBe(true);
    expect(isRemotePlot(6, 6)).toBe(false);
    expect(isRemotePlot(null, 6)).toBe(false);
    expect(isRemotePlot(undefined, 6)).toBe(false);
  });

  it('home enter radius is roomier than the old 3.5', () => {
    expect(HOME_ENTER_RADIUS).toBeGreaterThan(3.5);
    expect(VISIT_DOOR_RADIUS).toBeGreaterThanOrEqual(4);
  });
});
