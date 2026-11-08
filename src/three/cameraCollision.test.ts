import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraBlocked, collideCamera, fadeOccluders } from './cameraCollision.ts';

const blocks = {
  rects: [{ x: 0, z: 0, hw: 4, hd: 3, rot: 0, h: 8 }],
  circles: [
    { x: 20, z: 0, r: 0.4, h: 6 },
    { x: 12, z: 0, r: 3.2, h: 7 },
  ],
};

describe('analytic camera collision', () => {
  it('stops in front of a tall building and ignores thin tree trunks', () => {
    const target = new THREE.Vector3(0, 1.6, 10);
    const desired = new THREE.Vector3(0, 2.2, -6);
    const cam = collideCamera({ target, desired, blocks, minDist: 2.2 });
    expect(cam.z).toBeGreaterThan(3);
    expect(cam.z).toBeLessThan(10);
    expect(cameraBlocked(20, 2, 0, blocks)).toBe(false);
    expect(cameraBlocked(12, 2, 0, blocks)).toBe(true);
    expect(cameraBlocked(0, 2, 0, blocks)).toBe(true);
    expect(cameraBlocked(0, 2, 6, blocks)).toBe(false);
    expect(cameraBlocked(0, 2, 0, { rects: [], circles: [{ x: 0, z: 0, r: 5, h: 0.6 }] })).toBe(true);
    expect(cameraBlocked(0, 4, 0, { rects: [], circles: [{ x: 0, z: 0, r: 5, h: 0.6 }] })).toBe(false);
  });

  it('does not pull the camera for the building the player is inside', () => {
    const target = new THREE.Vector3(0, 1.6, 0);
    const desired = new THREE.Vector3(0, 3, 8);
    const cam = collideCamera({ target, desired, blocks, skip: { x: 0, z: 0, r: 6 }, minDist: 2 });
    expect(cam.z).toBeCloseTo(8, 1);
  });

  it('does not rewrite a shared material', () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#fff', opacity: 1 });
    fadeOccluders();
    expect(mat.opacity).toBe(1);
    expect(mat.transparent).toBe(false);
    mat.dispose();
  });
});
