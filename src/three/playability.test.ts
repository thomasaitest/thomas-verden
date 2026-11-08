import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PLAZA_R } from '../logic/townLayout.ts';
import { installDomStub } from '../test/domStub.ts';
import type { Town } from './town.ts';

let town: Town;
let physicalGlass: typeof import('./pbrTextures.ts').physicalGlass;

beforeAll(async () => {
  installDomStub();
  const t = await import('./town.ts');
  town = t.buildTown();
  physicalGlass = (await import('./pbrTextures.ts')).physicalGlass;
});

function lightsOn(): number {
  let n = 0;
  town.group.traverse((o) => {
    const l = o as THREE.PointLight;
    if (l.isPointLight && l.visible) n++;
  });
  return n;
}

describe('playability guards', () => {
  it('does not enable transmission and only lights the nearest façades', () => {
    expect(physicalGlass('#fff', 0.9).transmission).toBe(0);
    town.setRenderBudget({ maxLights: 3, treeLod: 36 });
    town.update(0.4, 0, 8, 0, 8);
    expect(lightsOn()).toBeLessThanOrEqual(3);
    expect(lightsOn()).toBeGreaterThan(0);
    let transmission = 0;
    town.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (mats.some((mat) => (mat as THREE.MeshPhysicalMaterial)?.transmission > 0)) transmission++;
    });
    expect(transmission).toBe(0);
  });

  it('drives hovercars outside the plaza and moves people', () => {
    const cars: THREE.Object3D[] = [];
    const npcs: THREE.Object3D[] = [];
    town.group.traverse((o) => {
      if (o.name.startsWith('traffic-')) cars.push(o);
      if (o.name.startsWith('npc-')) npcs.push(o);
    });
    expect(cars.length).toBeGreaterThan(3);
    expect(npcs.length).toBeGreaterThan(8);
    town.update(0.2, 1000, 1000, 1000, 1000);
    const before = cars.map((c) => ({ x: c.position.x, z: c.position.z }));
    const npcBefore = npcs.map((n) => ({ x: n.position.x, z: n.position.z }));
    town.update(5, 1000, 1000, 1000, 1000);
    expect(cars.some((c, i) => Math.hypot(c.position.x - before[i]!.x, c.position.z - before[i]!.z) > 1)).toBe(true);
    expect(npcs.some((n, i) => Math.hypot(n.position.x - npcBefore[i]!.x, n.position.z - npcBefore[i]!.z) > 0.2)).toBe(true);
    for (const c of cars) expect(Math.hypot(c.position.x, c.position.z)).toBeGreaterThan(PLAZA_R + 5);
  });

  it('uses a low canopy for trees far from the camera', () => {
    town.setRenderBudget({ maxLights: 3, treeLod: 18 });
    town.update(1, 0, 0, 0, 0);
    let farCanopy = 0;
    town.group.traverse((o) => {
      if (!o.userData.lodFar) return;
      if (Math.hypot(o.position.x, o.position.z) <= 18) return;
      const far = o.userData.lodFar as THREE.Object3D;
      const near = o.userData.lodNear as THREE.Object3D;
      if (far.visible && !near.visible) farCanopy++;
    });
    expect(farCanopy).toBeGreaterThan(20);
  });
});
