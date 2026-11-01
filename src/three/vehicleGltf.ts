import * as THREE from 'three';
import { CAR_BY_ID } from '../logic/catalog.ts';
import { loadModel } from './assets.ts';
import { glassMat, glowMat, mat, rbox } from './kit.ts';
import { CAR_AVATAR_SCALE, CAR_SEAT_Y } from './vehicles.ts';

const CAR_PATH: Record<string, string> = {
  'bil-rosa': 'cars/hatchback-sports.glb',
  'bil-gul': 'cars/taxi.glb',
  'bil-bla': 'cars/race-future.glb',
  'bil-gronn': 'cars/suv-luxury.glb',
  'bil-lilla': 'cars/sedan-sports.glb',
};

export async function buildGltfCar(carId: string): Promise<THREE.Group> {
  const path = CAR_PATH[carId] ?? 'cars/race-future.glb';
  const def = CAR_BY_ID[carId];
  const g = new THREE.Group();
  const hoverY = 0.45;
  try {
    const model = await loadModel(path);
    // Kenney cars ~2.5m long; scale up slightly for game
    model.scale.setScalar(1.55);
    model.position.set(0, hoverY, 0);
    model.rotation.y = Math.PI; // face +Z like game
    // hide wheels visually? keep them but sink; hover look via lift + thrusters
    model.traverse((o) => {
      const name = o.name.toLowerCase();
      if (name.includes('wheel')) {
        o.visible = false;
      }
    });
    // tint body toward catalog color
    if (def?.color) {
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat0 = m.material as THREE.MeshStandardMaterial;
        if (!mat0?.color) return;
        const n = (mat0.name || m.name || '').toLowerCase();
        if (/body|paint|car|chassis|hull/.test(n) || mat0.color.getHexString() === 'ffffff') {
          // soft tint
          mat0.color.lerp(new THREE.Color(def.color), 0.55);
          mat0.metalness = Math.max(mat0.metalness, 0.45);
          mat0.roughness = Math.min(mat0.roughness, 0.35);
        }
      });
    }
    g.add(model);
  } catch {
    // fallback box
    rbox(g, def?.color ?? '#8aa0b8', [0, hoverY + 0.4, 0], [2.2, 0.8, 4.2]);
  }

  // glass canopy bubble for "hover" sci-fi
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    glassMat('#7ab8d8', 0.22),
  );
  canopy.position.set(0, hoverY + 1.15, 0.15);
  canopy.scale.set(2.0, 1.15, 2.4);
  canopy.userData.camIgnore = true;
  g.add(canopy);

  // thrusters
  for (const [x, z] of [
    [-0.7, 1.1],
    [0.7, 1.1],
    [-0.7, -1.1],
    [0.7, -1.1],
  ] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20), mat('#2a3344', 0, { metalness: 0.7, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, hoverY - 0.05, z);
    g.add(ring);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), glowMat('#3ecbff', 1.4));
    core.rotation.x = -Math.PI / 2;
    core.position.set(x, hoverY - 0.08, z);
    g.add(core);
  }
  // under glow
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 3.6),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.2, depthWrite: false }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.05;
  g.add(under);

  // seat marker
  rbox(g, '#1a2230', [0, hoverY + 0.55, 0.1], [0.9, 0.12, 0.7]);

  g.userData.carId = carId;
  g.userData.seatY = CAR_SEAT_Y;
  g.userData.gltf = true;
  return g;
}

export { CAR_AVATAR_SCALE, CAR_SEAT_Y };
