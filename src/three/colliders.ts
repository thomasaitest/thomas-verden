import * as THREE from 'three';
import type { CircleCollider, Colliders, RectCollider } from '../logic/collision.ts';

/**
 * Mark a mesh as solid so colliders can be derived from its real bounds instead of
 * hand-copied numbers. `shape: 'circle'` (default for cylinders/cones/spheres you mark that way)
 * uses the footprint radius; 'rect' uses the oriented box footprint.
 */
export function solid<T extends THREE.Object3D>(o: T, shape: 'rect' | 'circle' = 'rect', pad = 0, top?: number): T {
  o.userData.solid = { shape, pad, top };
  return o;
}

const _corner = new THREE.Vector3();

/** Walk a tree and turn every `solid()` mesh into a collider (world space; tilted parts use their tilted footprint). */
export function collectColliders(root: THREE.Object3D): { rects: RectCollider[]; circles: CircleCollider[] } {
  root.updateWorldMatrix(true, true); // parents too: the root may sit inside a moved holder
  const rects: RectCollider[] = [];
  const circles: CircleCollider[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.userData.solid) return;
    const { shape, pad, top } = m.userData.solid as { shape: 'rect' | 'circle'; pad: number; top?: number };
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    const e = m.matrixWorld.elements;
    // yaw of the mesh = direction of its local x axis in world space
    const yaw = Math.atan2(-e[2], e[0]);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      _corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld);
      const lx = _corner.x * cos - _corner.z * sin;
      const lz = _corner.x * sin + _corner.z * cos;
      minX = Math.min(minX, lx);
      maxX = Math.max(maxX, lx);
      minZ = Math.min(minZ, lz);
      maxZ = Math.max(maxZ, lz);
      maxY = Math.max(maxY, _corner.y);
    }
    const lcx = (minX + maxX) / 2;
    const lcz = (minZ + maxZ) / 2;
    const x = lcx * cos + lcz * sin;
    const z = -lcx * sin + lcz * cos;
    const hw = (maxX - minX) / 2 + pad;
    const hd = (maxZ - minZ) / 2 + pad;
    const h = top ?? maxY;
    if (shape === 'circle') circles.push({ x, z, r: Math.max(hw, hd), h });
    else rects.push({ x, z, hw, hd, rot: yaw, h });
  });
  return { rects, circles };
}

/**
 * Collider for a (possibly rotated/scaled) group, e.g. one piece of furniture:
 * the footprint is measured in the group's own frame, so a rotated sofa gets a rotated box.
 */
export function footprintOf(g: THREE.Object3D): RectCollider & { top: number } {
  const keep = { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() };
  const world = g.matrixWorld.clone();
  g.position.set(0, 0, 0);
  g.rotation.set(0, 0, 0);
  g.scale.set(1, 1, 1);
  g.updateWorldMatrix(true, true);
  const local = new THREE.Box3().setFromObject(g);
  g.position.copy(keep.p);
  g.rotation.copy(keep.r);
  g.scale.copy(keep.s);
  g.matrixWorld.copy(world);
  g.updateMatrixWorld(true);
  const sc = keep.s.x;
  const cx = ((local.min.x + local.max.x) / 2) * sc;
  const cz = ((local.min.z + local.max.z) / 2) * sc;
  const rot = keep.r.y;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    x: keep.p.x + cx * cos + cz * sin,
    z: keep.p.z - cx * sin + cz * cos,
    hw: ((local.max.x - local.min.x) / 2) * sc,
    hd: ((local.max.z - local.min.z) / 2) * sc,
    rot,
    h: local.max.y * sc,
    top: local.max.y * sc,
  };
}

export const emptyColliders: Colliders = { rects: [], circles: [] };
