/** Quaternius animal GLBs for dog/cat/fox — realistic proportions. */
import * as THREE from 'three';
import type { PetSpecies } from '../logic/pets.ts';
import { loadModel } from './assets.ts';
import { buildPet, type PetRig } from './petModel.ts';
import { glowMat, mat } from './kit.ts';

const BODY_PATH: Partial<Record<PetSpecies['body'], string>> = {
  dog: 'animals/husky.glb',
  cat: 'animals/shibainu.glb', // closest small quadruped we have; tinted
  fox: 'animals/fox.glb',
};

const cache = new Map<string, THREE.Group>();

export async function preloadPetModels(): Promise<void> {
  await Promise.all(
    Object.values(BODY_PATH).map(async (path) => {
      if (!path || cache.has(path)) return;
      try {
        const m = await loadModel(path);
        cache.set(path, m);
      } catch {
        /* keep procedural */
      }
    }),
  );
}

function tint(root: THREE.Object3D, colors: [string, string, string]) {
  const c1 = new THREE.Color(colors[0]);
  const c2 = new THREE.Color(colors[1]);
  let i = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat0 of mats) {
      const std = mat0 as THREE.MeshStandardMaterial;
      if (!std?.color) continue;
      std.color.lerp(i % 2 ? c2 : c1, 0.55);
      std.roughness = Math.min(std.roughness ?? 0.8, 0.75);
      i++;
    }
  });
}

/** Prefer Quaternius animal for dog/cat/fox; sleek procedural robot; else procedural. */
export function buildPetPreferGltf(sp: PetSpecies): PetRig {
  const path = BODY_PATH[sp.body];
  if (path && cache.has(path)) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const model = cache.get(path)!.clone(true);
    // Quaternius animals ~1 unit; scale to game pet size
    const s = sp.body === 'fox' ? 1.15 : sp.body === 'cat' ? 0.95 : 1.05;
    model.scale.setScalar(s);
    model.position.set(0, 0, 0);
    tint(model, sp.colors);
    if (sp.spots) {
      // soft accent spots via emissive disks
      for (const [x, z] of [
        [0.2, 0.15],
        [-0.18, -0.1],
      ] as const) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat(sp.colors[2], 0));
        d.position.set(x, 0.55, z);
        body.add(d);
      }
    }
    body.add(model);
    const head = new THREE.Object3D();
    head.position.set(0, 0.85, 0.45);
    body.add(head);
    const legs: THREE.Object3D[] = [];
    for (const [x, z] of [
      [0.18, 0.25],
      [-0.18, 0.25],
      [0.18, -0.22],
      [-0.18, -0.22],
    ] as const) {
      const p = new THREE.Object3D();
      p.position.set(x, 0.35, z);
      body.add(p);
      legs.push(p);
    }
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return {
      root,
      body,
      legs,
      wings: [],
      tail: null,
      head,
      seatY: 0.85,
      topY: 1.15,
      biped: false,
    };
  }
  if (sp.body === 'robot') {
    // Sleeker metal robot dog (procedural but refined)
    const rig = buildPet(sp);
    // add under-glow
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), glowMat('#3ecbff', 0.9));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    (glow.material as THREE.MeshStandardMaterial).transparent = true;
    (glow.material as THREE.MeshStandardMaterial).opacity = 0.35;
    rig.root.add(glow);
    return rig;
  }
  return buildPet(sp);
}
