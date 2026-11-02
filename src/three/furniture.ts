import * as THREE from 'three';
import { box, cone, cyl, G, glassMat, part, rbox, sph } from './kit.ts';
import { loadModel } from './assets.ts';

type B = (g: THREE.Group, c: string) => void;

const FURN_GLB: Record<string, string> = {
  sofa: 'furniture/couch-medium1.glb',
  sofalong: 'furniture/couch-large1.glb',
  armchair: 'furniture2/sofa2.glb',
  // procedural capsule pod beds (concept) — not Quaternius boxes
  coffeetable: 'furniture/table-roundlarge.glb',
  table: 'furniture2/table.glb',
  chair: 'furniture/chair-1.glb',
  bookshelf: 'furniture/shelf-large.glb',
  fridge: 'furniture/kitchen-fridge.glb',
  stove: 'furniture/kitchen-oven.glb',
  counter: 'furniture/kitchen-2drawers.glb',
  dresser: 'furniture2/closet.glb',
  plant: 'furniture/houseplant-1.glb',
  plant2: 'furniture/houseplant-3.glb',
  plant3: 'furniture/houseplant-5.glb',
  carpet: 'furniture/carpet-1.glb',
};

const glbReady = new Map<string, THREE.Group>();

/** Prefetch furniture GLBs used indoors. */
export async function preloadFurnitureModels(): Promise<void> {
  await Promise.all(
    Object.values(FURN_GLB).map(async (path) => {
      if (glbReady.has(path)) return;
      try {
        const m = await loadModel(path);
        glbReady.set(path, m);
      } catch {
        /* keep procedural */
      }
    }),
  );
}

const WOOD = '#c98a55';
const DARK = '#555a75';
const WHITE = '#ffffff';
const PILLOW = '#fff8f0';

const bedBase = (g: THREE.Group, c: string, w: number, d: number) => {
  // Capsule sleep pod — open clam shell toward +Z (living doorway), mattress + blue glow
  const shellMat = new THREE.MeshStandardMaterial({
    color: '#e8eef6',
    roughness: 0.28,
    metalness: 0.22,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
  });
  // Back hood (closed half) — not a full egg
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 28, 18, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.55),
    shellMat,
  );
  hood.scale.set(w * 0.45, 0.88, d * 0.36);
  hood.position.set(0, 1.05, -0.35);
  hood.castShadow = true;
  g.add(hood);
  // Side rails
  for (const s of [-1, 1] as const) {
    const rail = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.08, d * 0.45, 4, 8),
      shellMat,
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.set(s * w * 0.38, 0.55, 0.05);
    g.add(rail);
  }
  // Dark base plinth
  rbox(g, '#1a2230', [0, 0.22, 0.1], [w * 0.92, 0.2, d * 0.72]);
  // Mattress (readable from doorway)
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.75, 0.16, d * 0.55),
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0.02 }),
  );
  mattress.position.set(0, 0.52, 0.2);
  mattress.castShadow = true;
  g.add(mattress);
  // Pillow at back
  rbox(g, '#f4f7fb', [0, 0.68, -d * 0.08], [w * 0.45, 0.14, 0.35]);
  // Cyan rim around open mouth
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(w * 0.36, 0.03, 8, 40, Math.PI * 1.05),
    new THREE.MeshBasicMaterial({ color: '#4de0ff', toneMapped: false }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.7, d * 0.18);
  g.add(rim);
  const glow = new THREE.PointLight('#5ad4ff', 1.35, 6, 2);
  glow.position.set(0, 0.9, 0.35);
  g.add(glow);
  const glow2 = new THREE.PointLight('#7ef0ff', 0.55, 4, 2);
  glow2.position.set(0, 1.15, -0.1);
  g.add(glow2);
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.7, d * 0.45),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.4, toneMapped: false }),
  );
  wash.rotation.x = -Math.PI / 2;
  wash.position.set(0, 0.44, 0.2);
  g.add(wash);
};

const chairShape = (g: THREE.Group, c: string, seatH = 0.9, back = true) => {
  rbox(g, c, [0, seatH, 0], [0.9, 0.16, 0.9]);
  for (const x of [-0.35, 0.35]) for (const z of [-0.35, 0.35]) cyl(g, WOOD, [x, seatH / 2, z], [0.1, seatH, 0.1]);
  if (back) rbox(g, c, [0, seatH + 0.55, -0.4], [0.9, 1, 0.12]);
};

const sofaShape = (g: THREE.Group, c: string, w: number) => {
  // Soft sectional within ~w × 1.35 footprint (collider tests depend on AABB)
  const seat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.7 });
  const cush = new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.65, metalness: 0.02 });
  const mods = Math.max(4, Math.round(w / 0.9));
  const half = (w - 0.5) / 2;
  for (let i = 0; i < mods; i++) {
    const u = mods === 1 ? 0.5 : i / (mods - 1);
    const x = -half + u * half * 2;
    // shallow curve toward camera (+z) — keep |z| ≤ ~0.55 so depth ≈ 1.35
    const z = (1 - Math.cos((u - 0.5) * Math.PI)) * 0.22;
    const yaw = (u - 0.5) * 0.45;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w / mods + 0.12, 0.42, 1.05), seat);
    base.position.set(x, 0.38, z);
    base.rotation.y = -yaw;
    base.castShadow = true;
    g.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w / mods + 0.05, 0.88, 0.28), seat);
    back.position.set(x, 0.95, z - 0.42);
    back.rotation.y = -yaw;
    g.add(back);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.45, w / mods - 0.15), 0.14, 0.7), cush);
    pillow.position.set(x, 0.62, z + 0.05);
    pillow.rotation.y = -yaw;
    g.add(pillow);
  }
  for (const s of [-1, 1] as const) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 1.1), seat);
    arm.position.set(s * (w / 2 - 0.18), 0.7, 0.05);
    g.add(arm);
  }
  part(g, G.box(), '#3ecbff', [0, 0.1, 0.05], [w * 0.78, 0.04, 0.85], [0, 0, 0], 0.55);
};

export const MODELS: Record<string, B> = {
  bed: (g, c) => bedBase(g, c, 2.2, 3.4),
  bedwide: (g, c) => bedBase(g, c, 3.2, 3.6),
  bunk: (g, c) => {
    bedBase(g, c, 2.0, 3.2);
    for (const x of [-0.95, 0.95]) for (const z of [-1.5, 1.5]) box(g, WOOD, [x, 1.6, z], [0.14, 3.2, 0.14]);
    rbox(g, WOOD, [0, 2.1, 0], [2.0, 0.3, 3.2]);
    rbox(g, c, [0, 2.35, 0.3], [1.9, 0.18, 2.4]);
    rbox(g, PILLOW, [0, 2.4, -1.1], [1.2, 0.2, 0.5]);
    for (let i = 0; i < 4; i++) box(g, WOOD, [1.05, 0.5 + i * 0.5, 1.2], [0.08, 0.08, 0.6]);
  },
  canopy: (g, c) => {
    bedBase(g, c, 2.8, 3.4);
    for (const x of [-1.35, 1.35]) for (const z of [-1.6, 1.6]) cyl(g, WOOD, [x, 1.7, z], [0.12, 3.4, 0.12]);
    rbox(g, c, [0, 3.45, 0], [3.0, 0.2, 3.6]);
    for (const s of [-1, 1]) box(g, '#ffffff', [s * 1.42, 2.4, 0], [0.04, 2.0, 3.4]).material = glassMat(c, 0.45);
  },
  starbed: (g, c) => {
    bedBase(g, c, 2.6, 3.4);
    part(g, G.star(), '#ffe066', [0, 2.1, -1.6], [1.6, 1.6, 0.6], [0, 0, 0], 0.25);
    for (let i = 0; i < 3; i++) part(g, G.star(), '#ffffff', [-0.9 + i * 0.9, 0.82, 1.0], [0.3, 0.3, 0.3], [-Math.PI / 2, 0, 0]);
  },
  petbed: (g, c) => {
    cyl(g, c, [0, 0.2, 0], [1.6, 0.4, 1.6]);
    cyl(g, PILLOW, [0, 0.32, 0], [1.25, 0.25, 1.25]);
    part(g, G.torus(), c, [0, 0.42, 0], [1.45, 1.45, 1.6], [Math.PI / 2, 0, 0]);
  },
  hammock: (g, c) => {
    for (const x of [-1.6, 1.6]) cyl(g, WOOD, [x, 1.2, 0], [0.16, 2.4, 0.16]);
    sph(g, c, [0, 1.0, 0], [3.0, 0.5, 1.2]).scale.y = 0.35;
    box(g, c, [0, 1.5, 0], [3.2, 0.04, 0.04]);
  },
  bathtub: (g, c) => {
    rbox(g, c, [0, 0.5, 0], [1.8, 1.0, 3.0]);
    box(g, '#7fd8ff', [0, 0.92, 0], [1.5, 0.1, 2.7]);
    for (let i = 0; i < 5; i++) sph(g, WHITE, [-0.5 + (i % 3) * 0.45, 1.02, -0.8 + i * 0.4], [0.35, 0.25, 0.35]);
    cyl(g, '#c0c6d6', [0, 1.3, -1.35], [0.1, 0.6, 0.1]);
    sph(g, '#ffe066', [0.4, 1.05, 0.6], [0.22, 0.2, 0.26]);
  },
  shower: (g, c) => {
    box(g, WHITE, [0, 0.1, 0], [1.8, 0.2, 1.8]);
    for (const x of [-0.88, 0.88]) box(g, '#c0c6d6', [x, 1.8, -0.88], [0.06, 3.4, 0.06]);
    const glass = box(g, c, [0, 1.8, 0.88], [1.8, 3.4, 0.04]);
    glass.material = glassMat(c, 0.4);
    box(g, '#e6ecff', [0, 1.8, -0.9], [1.8, 3.4, 0.06]);
    cyl(g, '#c0c6d6', [0, 3.0, -0.5], [0.5, 0.08, 0.5]);
  },
  hottub: (g, c) => {
    cyl(g, WOOD, [0, 0.5, 0], [3.2, 1.0, 3.2]);
    cyl(g, c, [0, 0.95, 0], [2.8, 0.1, 2.8], undefined, 0.15);
    for (let i = 0; i < 7; i++) sph(g, WHITE, [Math.cos(i) * 0.9, 1.02, Math.sin(i * 1.3) * 0.9], [0.25, 0.15, 0.25]);
  },
  toilet: (g, c) => {
    rbox(g, c, [0, 0.4, 0.2], [0.8, 0.8, 1.0]);
    rbox(g, c, [0, 1.1, -0.35], [0.9, 1.0, 0.4]);
    cyl(g, '#e6ecff', [0, 0.82, 0.2], [0.75, 0.06, 0.9]);
  },
  sink: (g, c) => {
    cyl(g, c, [0, 0.6, 0], [0.4, 1.2, 0.4]);
    rbox(g, c, [0, 1.3, 0], [1.2, 0.3, 0.9]);
    box(g, '#7fd8ff', [0, 1.46, 0.05], [0.8, 0.04, 0.5]);
    cyl(g, '#c0c6d6', [0, 1.65, -0.3], [0.08, 0.4, 0.08]);
  },
  mirror: (g, c) => {
    cyl(g, '#ffd23f', [0, 2.6, 0.05], [1.1, 0.08, 1.5], [Math.PI / 2, 0, 0]);
    cyl(g, c, [0, 2.6, 0.1], [0.95, 0.04, 1.32], [Math.PI / 2, 0, 0], 0.3);
  },
  fridge: (g, c) => {
    rbox(g, c, [0, 1.6, 0], [1.4, 3.2, 1.2]);
    box(g, '#c0c6d6', [0, 2.05, 0.61], [1.3, 0.04, 0.02]);
    box(g, '#c0c6d6', [0.5, 2.5, 0.64], [0.08, 0.6, 0.06]);
    box(g, '#c0c6d6', [0.5, 1.3, 0.64], [0.08, 0.6, 0.06]);
    box(g, '#3ecbff', [-0.35, 2.55, 0.62], [0.35, 0.08, 0.02], undefined, 0.5);
  },
  stove: (g, c) => {
    rbox(g, c, [0, 0.75, 0], [1.4, 1.5, 1.2]);
    box(g, DARK, [0, 0.6, 0.61], [1.0, 0.7, 0.04]);
    for (const x of [-0.35, 0.35]) for (const z of [-0.25, 0.25]) cyl(g, DARK, [x, 1.52, z], [0.4, 0.04, 0.4]);
    cyl(g, '#ff6f6f', [0.35, 1.7, 0.25], [0.5, 0.3, 0.5]);
  },
  counter: (g, _c) => {
    // kitchen island with glow strip
    rbox(g, '#1a2230', [0, 0.7, 0], [2.2, 1.35, 1.2]);
    rbox(g, '#e8eef6', [0, 1.42, 0], [2.35, 0.1, 1.3]);
    part(g, G.box(), '#3ecbff', [0, 0.12, 0], [2.0, 0.04, 1.05], [0, 0, 0], 0.7);
    for (const x of [-0.55, 0.55]) box(g, '#2a3344', [x, 0.75, 0.58], [0.85, 0.9, 0.03]);
    cyl(g, '#8aa0b8', [0.7, 1.55, 0.2], [0.12, 0.25, 0.12]);
    box(g, '#3ecbff', [-0.5, 1.52, -0.2], [0.55, 0.04, 0.4], undefined, 0.4);
  },
  table: (g, c) => {
    rbox(g, c, [0, 1.1, 0], [2.6, 0.16, 1.6]);
    for (const x of [-1.1, 1.1]) for (const z of [-0.6, 0.6]) cyl(g, c, [x, 0.55, z], [0.14, 1.1, 0.14]);
    cyl(g, '#ffffff', [0, 1.25, 0], [0.6, 0.12, 0.6]);
    sph(g, '#ff6f6f', [0, 1.38, 0], [0.22, 0.22, 0.22]);
  },
  chair: (g, c) => chairShape(g, c),
  stool: (g, c) => {
    cyl(g, c, [0, 0.9, 0], [0.8, 0.16, 0.8]);
    for (let i = 0; i < 3; i++) cyl(g, WOOD, [Math.cos(i * 2.1) * 0.25, 0.45, Math.sin(i * 2.1) * 0.25], [0.08, 0.9, 0.08]);
  },
  bowl: (g, c) => {
    cyl(g, c, [0, 0.15, 0], [0.9, 0.3, 0.9]);
    for (let i = 0; i < 5; i++) sph(g, '#a0632f', [Math.cos(i) * 0.2, 0.3, Math.sin(i) * 0.2], [0.18, 0.12, 0.18]);
  },
  waterbowl: (g, c) => {
    cyl(g, c, [0, 0.15, 0], [0.9, 0.3, 0.9]);
    cyl(g, '#bff0ff', [0, 0.28, 0], [0.75, 0.04, 0.75], undefined, 0.2);
  },
  sofa: (g, c) => sofaShape(g, c, 3.2),
  sofalong: (g, c) => sofaShape(g, c, 4.6),
  armchair: (g, c) => sofaShape(g, c, 1.6),
  beanbag: (g, c) => {
    sph(g, c, [0, 0.5, 0], [1.6, 1.0, 1.6]);
    sph(g, c, [0, 0.95, -0.35], [1.2, 0.8, 0.7]);
  },
  coffeetable: (g, _c) => {
    rbox(g, '#1a2230', [0, 0.55, 0], [1.9, 0.12, 1.1]);
    const glass = box(g, '#9ad8ff', [0, 0.62, 0], [1.85, 0.04, 1.05]);
    glass.material = glassMat('#9ad8ff', 0.35);
    for (const x of [-0.7, 0.7]) cyl(g, '#8aa0b8', [x, 0.28, 0], [0.08, 0.55, 0.08]);
    part(g, G.torus(), '#3ecbff', [0, 0.08, 0], [0.9, 0.9, 0.2], [Math.PI / 2, 0, 0], 0.55);
  },
  tv: (g, _c) => {
    rbox(g, '#15202c', [0, 1.6, 0], [2.8, 1.6, 0.12]);
    rbox(g, '#0a1220', [0, 1.6, 0.05], [2.5, 1.35, 0.06]);
    part(g, G.torus(), '#3ecbff', [0, 1.6, 0.1], [1.4, 1.4, 0.2], [0, 0, 0], 0.9);
    part(g, G.torus(), '#7ef0ff', [0, 1.6, 0.12], [0.9, 0.9, 0.15], [0, 0, 0], 1.1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sph(g, '#5ccfff', [Math.cos(a) * 0.55, 1.6 + Math.sin(a) * 0.35, 0.14], [0.12, 0.12, 0.08], undefined, 0.8);
    }
    rbox(g, '#8aa0b8', [0, 0.5, 0], [0.8, 1.0, 0.25]);
  },
  bookshelf: (g, c) => {
    box(g, c, [0, 1.6, -0.3], [2.2, 3.2, 0.1]);
    for (const s of [-1, 1]) box(g, c, [s * 1.05, 1.6, 0], [0.1, 3.2, 0.7]);
    const cols = ['#ff6f6f', '#5cc3f2', '#ffe066', '#7ccf6a', '#c88bff', '#ff8fb1'];
    for (let r = 0; r < 4; r++) {
      box(g, c, [0, 0.05 + r * 0.8, 0], [2.1, 0.1, 0.7]);
      for (let i = 0; i < 6; i++) box(g, cols[(i + r) % 6], [-0.8 + i * 0.3, 0.38 + r * 0.8, 0], [0.22, 0.5 + ((i * 7) % 3) * 0.06, 0.5]);
    }
    box(g, c, [0, 3.2, 0], [2.2, 0.1, 0.7]);
  },
  wardrobe: (g, c) => {
    rbox(g, c, [0, 1.7, 0], [2.0, 3.4, 1.1]);
    box(g, '#d0d0d8', [0, 1.7, 0.56], [0.03, 3.1, 0.02]);
    for (const s of [-1, 1]) sph(g, '#ffd23f', [s * 0.18, 1.8, 0.58], [0.14, 0.14, 0.1]);
  },
  dresser: (g, c) => {
    rbox(g, c, [0, 0.85, 0], [2.0, 1.7, 1.0]);
    for (let r = 0; r < 3; r++) {
      box(g, '#ffffff', [0, 0.35 + r * 0.5, 0.5], [1.8, 0.4, 0.03]);
      sph(g, '#ff8fb1', [0, 0.35 + r * 0.5, 0.55], [0.14, 0.14, 0.1]);
    }
  },
  fireplace: (g, c) => {
    rbox(g, c, [0, 1.2, 0], [2.6, 2.4, 0.9]);
    box(g, '#3a2a2a', [0, 0.75, 0.3], [1.4, 1.1, 0.4]);
    cone(g, '#ff8a2a', [0, 0.65, 0.4], [0.6, 0.8, 0.4], undefined, 0.8);
    cone(g, '#ffe066', [0, 0.55, 0.45], [0.35, 0.5, 0.3], undefined, 0.9);
    rbox(g, WOOD, [0, 2.45, 0.05], [2.9, 0.2, 1.1]);
  },
  piano: (g, c) => {
    rbox(g, c, [0, 1.2, -0.2], [2.6, 2.0, 0.9]);
    box(g, c, [0, 1.0, 0.45], [2.6, 0.2, 0.6]);
    box(g, WHITE, [0, 1.12, 0.45], [2.4, 0.06, 0.5]);
    for (let i = 0; i < 10; i++) box(g, '#2b2b38', [-1.05 + i * 0.24, 1.17, 0.35], [0.1, 0.06, 0.3]);
    for (const x of [-1.15, 1.15]) box(g, c, [x, 0.45, 0.6], [0.14, 0.9, 0.14]);
  },
  ball: (g, c) => {
    sph(g, c, [0, 0.4, 0], [0.8, 0.8, 0.8]);
    part(g, G.torus(), WHITE, [0, 0.4, 0], [0.75, 0.75, 0.75]);
  },
  toybox: (g, c) => {
    rbox(g, c, [0, 0.55, 0], [1.8, 1.1, 1.2]);
    rbox(g, '#ffe066', [0, 1.15, -0.1], [1.9, 0.18, 1.3], [-0.5, 0, 0]);
    sph(g, '#ff6f6f', [0.4, 1.15, 0.2], [0.4, 0.4, 0.4]);
    part(g, G.star(), '#7ccf6a', [-0.4, 1.2, 0.2], [0.5, 0.5, 0.5]);
  },
  slide: (g, c) => {
    for (const x of [-0.5, 0.5]) box(g, '#ff6f6f', [x, 1.4, -1.2], [0.14, 2.8, 0.14]);
    box(g, '#5cc3f2', [0, 2.6, -1.2], [1.2, 0.14, 1.0]);
    box(g, c, [0, 1.3, 0.3], [1.0, 0.12, 3.4], [0.75, 0, 0]);
    for (const s of [-1, 1]) box(g, c, [s * 0.5, 1.45, 0.3], [0.08, 0.3, 3.4], [0.75, 0, 0]);
    for (let i = 0; i < 5; i++) box(g, '#ffffff', [0, 0.4 + i * 0.5, -1.75], [1.0, 0.08, 0.14]);
  },
  trampoline: (g, c) => {
    cyl(g, '#2b2b38', [0, 0.7, 0], [3.2, 0.08, 3.2]);
    part(g, G.torus(), c, [0, 0.72, 0], [3.2, 3.2, 3.2], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) cyl(g, '#c0c6d6', [Math.cos(i * 1.57 + 0.78) * 1.3, 0.35, Math.sin(i * 1.57 + 0.78) * 1.3], [0.1, 0.7, 0.1]);
  },
  dollhouse: (g, c) => {
    rbox(g, c, [0, 0.8, 0], [1.8, 1.6, 1.2]);
    cone(g, '#ff6f6f', [0, 2.0, 0], [2.0, 0.9, 1.4], [0, Math.PI / 4, 0]).scale.set(1.8, 0.9, 1.8);
    box(g, '#bfe9ff', [-0.4, 1.0, 0.61], [0.4, 0.4, 0.02]);
    box(g, '#bfe9ff', [0.4, 1.0, 0.61], [0.4, 0.4, 0.02]);
    box(g, WOOD, [0, 0.35, 0.61], [0.35, 0.6, 0.02]);
  },
  rockinghorse: (g, c) => {
    part(g, G.torus(), WOOD, [0, 0.2, 0], [1.8, 1.8, 3], [0, Math.PI / 2, 0]).scale.set(2.2, 0.8, 1.6);
    sph(g, c, [0, 1.0, 0], [0.7, 0.6, 1.4]);
    sph(g, c, [0, 1.55, 0.6], [0.55, 0.6, 0.7]);
    for (const x of [-0.25, 0.25]) for (const z of [-0.4, 0.4]) cyl(g, c, [x, 0.55, z], [0.14, 0.6, 0.14]);
    sph(g, '#ff6f6f', [0, 1.7, 0.25], [0.18, 0.4, 0.4]);
  },
  cattree: (g, c) => {
    cyl(g, c, [0, 0.1, 0], [1.6, 0.2, 1.6]);
    cyl(g, '#f3d9b1', [0, 1.4, 0], [0.35, 2.6, 0.35]);
    cyl(g, c, [0, 1.6, 0], [1.2, 0.16, 1.2]);
    cyl(g, c, [0, 2.8, 0], [1.0, 0.3, 1.0]);
    sph(g, '#ff8fb1', [0.5, 1.2, 0], [0.24, 0.24, 0.24]);
  },
  pool: (g, c) => {
    rbox(g, WHITE, [0, 0.3, 0], [4.4, 0.6, 3.2]);
    box(g, c, [0, 0.56, 0], [4.0, 0.1, 2.8], undefined, 0.15);
    part(g, G.torus(), '#ff6f6f', [1.0, 0.68, 0.5], [0.9, 0.9, 1.6], [Math.PI / 2, 0, 0]);
  },
  ballpit: (g, c) => {
    rbox(g, c, [0, 0.4, 0], [3.4, 0.8, 3.4]);
    const cols = ['#ff6f6f', '#5cc3f2', '#ffe066', '#7ccf6a', '#ff8fb1'];
    for (let i = 0; i < 26; i++) sph(g, cols[i % 5], [((i * 37) % 28) / 10 - 1.4, 0.85 + (i % 3) * 0.08, ((i * 53) % 28) / 10 - 1.4], [0.36, 0.36, 0.36]);
  },
  balloons: (g, c) => {
    const cols = [c, '#ffe066', '#5cc3f2', '#7ccf6a', '#c88bff'];
    for (let i = 0; i < 5; i++) {
      const x = Math.cos(i * 1.26) * 0.35;
      const z = Math.sin(i * 1.26) * 0.35;
      sph(g, cols[i], [x, 2.6 + (i % 2) * 0.35, z], [0.6, 0.72, 0.6]);
      box(g, '#ffffff', [x / 2, 1.3, z / 2], [0.02, 2.4, 0.02]);
    }
    rbox(g, '#ff8fb1', [0, 0.15, 0], [0.4, 0.3, 0.4]);
  },
  gift: (g, c) => {
    rbox(g, c, [0, 0.45, 0], [0.9, 0.9, 0.9]);
    box(g, '#ffe066', [0, 0.45, 0], [0.94, 0.92, 0.2]);
    box(g, '#ffe066', [0, 0.45, 0], [0.2, 0.92, 0.94]);
    for (const s of [-1, 1]) sph(g, '#ffe066', [s * 0.15, 0.98, 0], [0.3, 0.2, 0.15], [0, 0, s * 0.5]);
  },
  teddy: (g, c) => {
    sph(g, c, [0, 0.5, 0], [0.8, 0.9, 0.7]);
    sph(g, c, [0, 1.15, 0], [0.7, 0.65, 0.6]);
    for (const s of [-1, 1]) {
      sph(g, c, [s * 0.28, 1.45, 0], [0.24, 0.24, 0.16]);
      sph(g, c, [s * 0.4, 0.6, 0.1], [0.24, 0.4, 0.24]);
      sph(g, c, [s * 0.25, 0.15, 0.2], [0.3, 0.26, 0.36]);
      sph(g, '#2b2340', [s * 0.12, 1.22, 0.28], [0.08, 0.08, 0.05]);
    }
    sph(g, '#f3d9b1', [0, 1.06, 0.28], [0.26, 0.2, 0.14]);
    part(g, G.heart(), '#ff4f7f', [0, 0.55, 0.36], [0.3, 0.3, 0.3]);
  },
  globe: (g, c) => {
    cyl(g, WOOD, [0, 0.1, 0], [0.6, 0.2, 0.6]);
    cyl(g, WOOD, [0, 0.4, 0], [0.08, 0.6, 0.08]);
    sph(g, c, [0, 1.05, 0], [0.9, 0.9, 0.9]);
    sph(g, '#7ccf6a', [0.2, 1.2, 0.25], [0.4, 0.3, 0.3]);
    sph(g, '#7ccf6a', [-0.25, 0.9, 0.2], [0.3, 0.35, 0.4]);
  },
  aquarium: (g, c) => {
    rbox(g, WOOD, [0, 0.5, 0], [2.2, 1.0, 1.0]);
    const glass = box(g, c, [0, 1.65, 0], [2.0, 1.3, 0.9], undefined, 0.2);
    glass.material = glassMat(c, 0.55);
    sph(g, '#ff8a2a', [-0.4, 1.7, 0], [0.35, 0.22, 0.12]);
    sph(g, '#ffe066', [0.5, 1.4, 0.1], [0.3, 0.2, 0.1]);
    for (let i = 0; i < 3; i++) cone(g, '#3fbf5a', [-0.7 + i * 0.6, 1.25, -0.2], [0.2, 0.6, 0.2]);
  },
  discoball: (g, c) => {
    box(g, '#c0c6d6', [0, 3.6, 0], [0.04, 1.2, 0.04]);
    part(g, G.ico(), c, [0, 2.8, 0], [0.9, 0.9, 0.9], [0, 0, 0], 0.5);
    cyl(g, '#c0c6d6', [0, 0.05, 0], [0.8, 0.1, 0.8]);
  },
  rainbow: (g, c) => {
    const cols = [c, '#ffb84d', '#ffe066', '#7ccf6a', '#5cc3f2', '#c88bff'];
    cols.forEach((col, i) => part(g, G.torus(), col, [0, 0, 0], [3.2 - i * 0.42, 3.2 - i * 0.42, 1.6]).scale.set(3.2 - i * 0.42, 3.2 - i * 0.42, 1.6));
    for (const s of [-1, 1]) sph(g, WHITE, [s * 1.4, 0.2, 0], [0.9, 0.6, 0.7]);
  },
  star: (g, c) => {
    part(g, G.star(), c, [0, 1.0, 0], [1.6, 1.6, 1.6], [0, 0, 0], 0.3);
    cyl(g, '#c0c6d6', [0, 0.1, 0], [0.6, 0.2, 0.6]);
  },
  heart: (g, c) => part(g, G.heart(), c, [0, 0.55, 0], [1.1, 1.1, 1.2], [-0.2, 0, 0]),
  vase: (g, c) => {
    sph(g, c, [0, 0.4, 0], [0.6, 0.8, 0.6]);
    cyl(g, c, [0, 0.85, 0], [0.3, 0.3, 0.3]);
    const cols = ['#ff6f6f', '#ffe066', '#ff8fb1'];
    for (let i = 0; i < 3; i++) {
      box(g, '#3fbf5a', [(i - 1) * 0.15, 1.3, 0], [0.04, 0.7, 0.04], [0, 0, (i - 1) * 0.3]);
      sph(g, cols[i], [(i - 1) * 0.3, 1.65, 0], [0.3, 0.3, 0.3]);
    }
  },
  cake: (g, c) => {
    cyl(g, WHITE, [0, 0.9, 0], [1.2, 0.06, 1.2]);
    cyl(g, '#c0c6d6', [0, 0.45, 0], [0.2, 0.9, 0.2]);
    cyl(g, c, [0, 1.15, 0], [1.0, 0.45, 1.0]);
    cyl(g, '#ffffff', [0, 1.42, 0], [1.02, 0.1, 1.02]);
    for (let i = 0; i < 4; i++) {
      cyl(g, ['#5cc3f2', '#ffe066', '#7ccf6a', '#ff8fb1'][i], [Math.cos(i * 1.57) * 0.25, 1.6, Math.sin(i * 1.57) * 0.25], [0.06, 0.3, 0.06]);
      sph(g, '#ffb02e', [Math.cos(i * 1.57) * 0.25, 1.8, Math.sin(i * 1.57) * 0.25], [0.08, 0.12, 0.08], undefined, 1);
    }
  },
  floorlamp: (g, c) => {
    cyl(g, DARK, [0, 0.05, 0], [0.7, 0.1, 0.7]);
    cyl(g, DARK, [0, 1.4, 0], [0.08, 2.8, 0.08]);
    cone(g, c, [0, 2.9, 0], [0.9, 0.6, 0.9], undefined, 0.6);
  },
  tablelamp: (g, c) => {
    rbox(g, WOOD, [0, 0.4, 0], [0.8, 0.8, 0.8]);
    cyl(g, DARK, [0, 1.0, 0], [0.06, 0.5, 0.06]);
    cone(g, c, [0, 1.35, 0], [0.7, 0.5, 0.7], undefined, 0.6);
  },
  lavalamp: (g, c) => {
    cone(g, '#c0c6d6', [0, 0.25, 0], [0.5, 0.5, 0.5]);
    cyl(g, c, [0, 0.9, 0], [0.35, 0.9, 0.35], undefined, 0.7);
    sph(g, '#ffe066', [0, 0.8, 0], [0.2, 0.25, 0.2], undefined, 0.8);
    cone(g, '#c0c6d6', [0, 1.45, 0], [0.3, 0.2, 0.3], [Math.PI, 0, 0]);
  },
  candles: (g, c) => {
    for (let i = 0; i < 3; i++) {
      const h = 0.4 + i * 0.2;
      cyl(g, c, [(i - 1) * 0.3, h / 2, (i % 2) * 0.15], [0.22, h, 0.22]);
      sph(g, '#ffb02e', [(i - 1) * 0.3, h + 0.1, (i % 2) * 0.15], [0.08, 0.16, 0.08], undefined, 1);
    }
  },
  lights: (g, c) => {
    const cols = [c, '#ff8fb1', '#5cc3f2', '#7ccf6a'];
    for (let i = 0; i < 12; i++) {
      const x = -2.2 + i * 0.4;
      const y = 3.2 - Math.sin((i / 11) * Math.PI) * 0.4;
      sph(g, cols[i % 4], [x, y, 0.1], [0.16, 0.22, 0.16], undefined, 0.9);
    }
    box(g, '#3b5b3b', [0, 3.3, 0.05], [4.6, 0.02, 0.02]);
  },
  neonheart: (g, c) => part(g, G.heart(), c, [0, 2.6, 0.1], [1.2, 1.2, 0.3], [0, 0, 0], 1),
  plant: (g, c) => {
    cyl(g, '#8a9098', [0, 0.35, 0], [0.7, 0.7, 0.7]);
    for (let i = 0; i < 5; i++) sph(g, c, [Math.cos(i * 1.3) * 0.25, 1.0 + (i % 2) * 0.25, Math.sin(i * 1.3) * 0.25], [0.5, 0.6, 0.5]);
  },
  cactus: (g, c) => {
    cyl(g, '#8a9098', [0, 0.3, 0], [0.6, 0.6, 0.6]);
    sph(g, c, [0, 1.05, 0], [0.45, 1.2, 0.45]);
    sph(g, c, [0.32, 1.1, 0], [0.22, 0.5, 0.22]);
    sph(g, '#ff8fb1', [0, 1.68, 0], [0.18, 0.12, 0.18]);
  },
  palm: (g, c) => {
    cyl(g, '#8a9098', [0, 0.4, 0], [1.0, 0.8, 1.0]);
    cyl(g, '#a0703f', [0, 1.8, 0], [0.22, 2.2, 0.22]);
    for (let i = 0; i < 6; i++) sph(g, c, [Math.cos(i * 1.05) * 0.7, 2.95, Math.sin(i * 1.05) * 0.7], [1.3, 0.12, 0.45], [0, -i * 1.05, -0.3]);
  },
  sunflower: (g, c) => {
    cyl(g, '#8a9098', [0, 0.3, 0], [0.6, 0.6, 0.6]);
    cyl(g, '#3fbf5a', [0, 1.3, 0], [0.08, 1.8, 0.08]);
    cyl(g, c, [0, 2.3, 0.05], [0.9, 0.06, 0.9], [Math.PI / 2, 0, 0]);
    cyl(g, '#8a5a3c', [0, 2.3, 0.1], [0.45, 0.08, 0.45], [Math.PI / 2, 0, 0]);
  },
  tree: (g, c) => {
    cyl(g, '#8a9098', [0, 0.4, 0], [0.9, 0.8, 0.9]);
    cyl(g, '#a0703f', [0, 1.3, 0], [0.25, 1.4, 0.25]);
    sph(g, c, [0, 2.4, 0], [1.6, 1.4, 1.6]);
  },
  flowerbox: (g, c) => {
    rbox(g, WOOD, [0, 0.3, 0], [1.8, 0.6, 0.7]);
    for (let i = 0; i < 5; i++) {
      box(g, '#3fbf5a', [-0.7 + i * 0.35, 0.75, 0], [0.04, 0.4, 0.04]);
      sph(g, i % 2 ? '#ffe066' : c, [-0.7 + i * 0.35, 1.0, 0], [0.3, 0.3, 0.3]);
    }
  },
  painting: (g, c) => {
    box(g, WOOD, [0, 2.6, 0.05], [1.8, 1.4, 0.1]);
    box(g, '#bfe9ff', [0, 2.6, 0.11], [1.5, 1.1, 0.02]);
    sph(g, c, [0.4, 2.85, 0.13], [0.3, 0.3, 0.02]);
    cone(g, '#7ccf6a', [-0.2, 2.35, 0.13], [0.9, 0.6, 0.02]);
  },
  clock: (g, c) => {
    cyl(g, c, [0, 2.9, 0.06], [1.0, 0.12, 1.0], [Math.PI / 2, 0, 0]);
    cyl(g, WHITE, [0, 2.9, 0.13], [0.82, 0.02, 0.82], [Math.PI / 2, 0, 0]);
    box(g, '#2b2340', [0, 3.0, 0.15], [0.05, 0.25, 0.02]);
    box(g, '#2b2340', [0.1, 2.9, 0.15], [0.22, 0.05, 0.02]);
  },
  shelf: (g, c) => {
    box(g, c, [0, 2.4, 0.3], [2.0, 0.12, 0.6]);
    sph(g, '#7ccf6a', [-0.6, 2.7, 0.3], [0.4, 0.4, 0.4]);
    box(g, '#ff6f6f', [0.1, 2.7, 0.3], [0.2, 0.5, 0.4]);
    box(g, '#5cc3f2', [0.35, 2.68, 0.3], [0.2, 0.46, 0.4]);
    part(g, G.heart(), '#ff8fb1', [0.75, 2.7, 0.3], [0.35, 0.35, 0.35]);
  },
  poster: (g, c) => {
    box(g, c, [0, 2.6, 0.03], [1.3, 1.8, 0.04]);
    sph(g, WHITE, [0, 2.5, 0.06], [0.7, 0.5, 0.03]);
    cone(g, '#ffe066', [0.15, 2.95, 0.07], [0.12, 0.4, 0.02], [0, 0, -0.4]);
    part(g, G.star(), '#ffe066', [-0.4, 3.2, 0.06], [0.2, 0.2, 0.05]);
  },
  window: (g, c) => {
    box(g, WHITE, [0, 2.5, 0.04], [2.0, 1.8, 0.08]);
    box(g, c, [0, 2.5, 0.07], [1.7, 1.5, 0.02], undefined, 0.35);
    box(g, WHITE, [0, 2.5, 0.09], [0.08, 1.5, 0.02]);
    box(g, WHITE, [0, 2.5, 0.09], [1.7, 0.08, 0.02]);
    box(g, '#ff8fb1', [-1.05, 2.5, 0.12], [0.3, 1.9, 0.06]);
    box(g, '#ff8fb1', [1.05, 2.5, 0.12], [0.3, 1.9, 0.06]);
  },
  ruground: (g, c) => {
    cyl(g, c, [0, 0.02, 0], [3.6, 0.04, 3.6]);
    cyl(g, '#f2ebe3', [0, 0.028, 0], [2.7, 0.04, 2.7]);
    cyl(g, c, [0, 0.036, 0], [1.9, 0.04, 1.9]);
    cyl(g, '#f7f2ec', [0, 0.042, 0], [0.9, 0.04, 0.9]);
  },
  rugrect: (g, c) => {
    box(g, c, [0, 0.025, 0], [3.6, 0.05, 2.6]);
    box(g, WHITE, [0, 0.03, 0], [3.0, 0.05, 2.0]);
    box(g, c, [0, 0.035, 0], [2.6, 0.05, 1.6]);
  },
  rugrainbow: (g, c) => {
    const cols = [c, '#ffb84d', '#ffe066', '#7ccf6a', '#5cc3f2', '#c88bff'];
    cols.forEach((col, i) => box(g, col, [0, 0.025 + i * 0.002, -1.25 + i * 0.5], [3.6, 0.05, 0.5]));
  },
  dancefloor: (g, c) => {
    const cols = [c, '#ff8fb1', '#5cc3f2', '#ffe066'];
    for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) box(g, cols[(x + z) % 4], [-1.5 + x, 0.05, -1.5 + z], [0.98, 0.1, 0.98], undefined, 0.45);
  },
};

const furnCache = new Map<string, THREE.Group>();
/** A fresh copy of a furniture model (geometry and materials are shared). */
export function buildFurniture(model: string, color: string): THREE.Group {
  if (model === 'counter') {
    const g = new THREE.Group();
    const path = FURN_GLB[model];
    if (path && glbReady.has(path)) {
      const m = glbReady.get(path)!.clone(true);
      m.scale.setScalar(1.2);
      g.add(m);
    } else {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.9, 0.7),
        new THREE.MeshStandardMaterial({ color: color || '#2a3344', roughness: 0.45, metalness: 0.2 }),
      );
      body.position.y = 0.45;
      g.add(body);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.06, 0.75),
        new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.25, metalness: 0.4 }),
      );
      top.position.y = 0.93;
      g.add(top);
    }
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.08), new THREE.MeshBasicMaterial({ color: '#ffd7a0' }));
    led.position.set(0, 0.06, 0.32);
    g.add(led);
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return g;
  }
  const path = FURN_GLB[model];
  if (path && glbReady.has(path)) {
    const g = glbReady.get(path)!.clone(true);
    const scale =
      model === 'sofalong' ? 1.05 :
      model === 'sofa' ? 1.0 :
      model === 'coffeetable' ? 1.1 :
      model === 'carpet' ? 1.8 :
      model.startsWith('plant') ? 1.25 :
      model === 'bookshelf' ? 1.05 :
      model === 'armchair' ? 1.0 :
      1.15;
    g.scale.setScalar(scale);
    // Tint seating toward light grey (clone mats — Quaternius sofas ship brown shared mats)
    const tint = !!(color && (model === 'sofalong' || model === 'sofa' || model === 'armchair'));
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      if (!tint || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const next = mats.map((mat) => {
        const std = (mat as THREE.MeshStandardMaterial).clone();
        if (std.color) {
          const bright = (std.color.r + std.color.g + std.color.b) / 3;
          if (bright > 0.08) {
            std.color.set(color || '#d0d6de');
            std.map = null;
            std.normalMap = null;
            std.roughness = 0.6;
            std.metalness = 0.03;
            std.envMapIntensity = 0.5;
          }
        }
        return std;
      });
      m.material = next.length === 1 ? next[0]! : next;
    });
    return g;
  }
  const key = `${model}|${color}`;
  let tpl = furnCache.get(key);
  if (!tpl) {
    tpl = new THREE.Group();
    (MODELS[model] ?? MODELS.gift)(tpl, color);
    tpl.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    furnCache.set(key, tpl);
  }
  return tpl.clone();
}
