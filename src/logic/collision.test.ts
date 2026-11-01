import { describe, expect, it } from 'vitest';
import { cameraRelative, DIST_MIN, orbit, PITCH_MAX, PITCH_MIN } from './camera.ts';
import { blocked, movePlayer, resolve, type Colliders } from './collision.ts';

const wall: Colliders = { rects: [{ x: 0, z: 0, hw: 5, hd: 0.2, rot: 0 }], circles: [] };

describe('collision', () => {
  it('pushes a circle out of a rectangle and slides along it', () => {
    const p = { x: 0, y: 0, z: 0.5 };
    movePlayer(p, 3, -0.3, 0.5, wall); // walk into the wall while moving sideways
    expect(p.z).toBeGreaterThanOrEqual(0.7 - 1e-6); // never gets past the wall face (0.2 + 0.5)
    expect(p.x).toBeGreaterThan(2); // but still slid sideways
  });

  it('cannot tunnel through a thin wall at high speed', () => {
    const p = { x: 0, y: 0, z: 4 };
    movePlayer(p, 0, -12, 0.3, wall); // 12 m in one frame
    expect(p.z).toBeGreaterThan(0);
  });

  it('works for rotated rectangles', () => {
    const c: Colliders = { rects: [{ x: 10, z: 5, hw: 3, hd: 0.5, rot: Math.PI / 3 }], circles: [] };
    for (const [sx, sz] of [[10, 12], [10, -2], [18, 5], [2, 5]]) {
      const p = { x: sx, y: 0, z: sz };
      movePlayer(p, 10 - sx, 5 - sz, 0.5, c);
      expect(blocked(p.x, p.z, 0.5, c)).toBe(false);
      // stays on its own side: distance to the centre never collapses
      expect(Math.hypot(p.x - 10, p.z - 5)).toBeGreaterThan(0.9);
    }
  });

  it('circles block and slide', () => {
    const c: Colliders = { rects: [], circles: [{ x: 0, z: 0, r: 1 }] };
    const p = { x: 3, y: 0, z: 0.1 };
    movePlayer(p, -4, 0, 0.5, c);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1.5 - 1e-6);
  });

  it('pushes out a player who is inside an object', () => {
    const p = { x: 0.1, y: 0, z: 0.05 };
    resolve(p, 0.5, wall);
    expect(blocked(p.x, p.z, 0.5, wall)).toBe(false);
  });

  it('lets a flyer pass over low objects but not tall ones', () => {
    const c: Colliders = { rects: [{ x: 0, z: 0, hw: 2, hd: 2, rot: 0, h: 3 }, { x: 10, z: 0, hw: 2, hd: 2, rot: 0, h: 40 }], circles: [] };
    const hi = { x: 0, y: 12, z: 0 };
    resolve(hi, 0.5, c);
    expect(hi.x).toBe(0);
    const tall = { x: 10, y: 12, z: 0 };
    resolve(tall, 0.5, c);
    expect(Math.abs(tall.x - 10) > 2 || Math.abs(tall.z) > 2).toBe(true);
  });

  it('stays out of a corner between two walls', () => {
    const c: Colliders = { rects: [{ x: 0, z: 0, hw: 5, hd: 0.2, rot: 0 }, { x: 5, z: 3, hw: 0.2, hd: 3, rot: 0 }], circles: [] };
    const p = { x: 3, y: 0, z: 2 };
    movePlayer(p, 8, -8, 0.5, c);
    expect(blocked(p.x, p.z, 0.5, c)).toBe(false);
  });
});

describe('camera', () => {
  const cam = { yaw: 0, pitch: 0.4, dist: 15 };
  it('drags rotate and keep pitch above the ground', () => {
    const a = orbit(cam, 100, 0, 0, 34);
    expect(a.yaw).not.toBe(cam.yaw);
    expect(orbit(cam, 0, -5000, 0, 34).pitch).toBe(PITCH_MIN);
    expect(orbit(cam, 0, 5000, 0, 34).pitch).toBe(PITCH_MAX);
    expect(PITCH_MIN).toBeGreaterThan(0);
  });
  it('zoom is limited', () => {
    expect(orbit(cam, 0, 0, -100, 34).dist).toBe(DIST_MIN);
    expect(orbit(cam, 0, 0, 100, 34).dist).toBe(34);
  });
  it('forward means away from the camera at any yaw', () => {
    for (const yaw of [0, 0.7, 1.9, Math.PI, -2.4]) {
      const f = cameraRelative({ x: 0, y: -1 }, yaw);
      const camDir = { x: Math.sin(yaw), z: Math.cos(yaw) }; // camera sits at +camDir from the player
      expect(f.x * camDir.x + f.z * camDir.z).toBeCloseTo(-1, 5);
      const r = cameraRelative({ x: 1, y: 0 }, yaw);
      expect(r.x * f.x + r.z * f.z).toBeCloseTo(0, 5);
      // right-hand side as seen from the camera: right = forward x up
      expect(r.x).toBeCloseTo(-f.z, 5);
      expect(r.z).toBeCloseTo(f.x, 5);
    }
  });
});
