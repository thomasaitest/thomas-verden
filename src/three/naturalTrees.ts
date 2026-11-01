/**
 * Natural greenery — recolored Kenney CC0 trees + procedural canopy/bushes/flowers.
 * (ez-tree is available as a dep but too heavy for SwiftShader shot gates; Kenney+tint is the runtime path.)
 */
import * as THREE from 'three';
import { loadModel } from './assets.ts';

const LEAF_HEX = ['#5fa84a', '#6bb854', '#4e9a40', '#7ac45c', '#58a048', '#69b060'];
const TREE_PATHS = [
  'nature/tree_oak.glb',
  'nature/tree_detailed.glb',
  'nature/tree_pineTallA.glb',
  'nature/tree_pineTallD.glb',
  'nature/tree_default.glb',
] as const;
const BUSH_PATH = 'nature/plant_bushDetailed.glb';

const treeCache = new Map<string, THREE.Group>();
let bushCached: THREE.Group | null = null;
let ready: Promise<void> | null = null;

function isLeafyColor(c: THREE.Color): boolean {
  // Kenney teals/cyans and greens
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return c.g > 0.25 && (c.g >= c.r - 0.05) && (max - min > 0.05 || c.g > 0.4);
}

function tintNatural(root: THREE.Object3D, leafHex: string, barkHex = '#6a4a32') {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const apply = (mat: THREE.Material) => {
      const std = (mat as THREE.MeshStandardMaterial).clone();
      if (!std?.color) return mat;
      const name = `${std.name || ''} ${m.name || ''}`.toLowerCase();
      const leafy = /leaf|leave|foliage|crown|canopy|pine|needle/.test(name) || isLeafyColor(std.color);
      const barky = /bark|trunk|wood|stem|branch/.test(name);
      if (leafy && !barky) {
        std.map = null;
        std.color = new THREE.Color(leafHex);
        std.emissive = new THREE.Color('#1a3010');
        std.emissiveIntensity = 0.05;
        std.roughness = 0.82;
        std.metalness = 0.02;
        std.envMapIntensity = 0.6;
      } else if (barky || (!leafy && std.color.r > std.color.g)) {
        std.color = new THREE.Color(barkHex);
        std.roughness = 0.92;
        std.metalness = 0.02;
      } else if (isLeafyColor(std.color)) {
        std.map = null;
        std.color = new THREE.Color(leafHex);
        std.roughness = 0.82;
        std.metalness = 0.02;
      }
      std.needsUpdate = true;
      return std;
    };
    if (Array.isArray(m.material)) m.material = m.material.map(apply);
    else m.material = apply(m.material);
    m.castShadow = true;
    m.receiveShadow = true;
  });
}

export async function preloadNaturalTrees(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await Promise.all(
      TREE_PATHS.map(async (p) => {
        try {
          treeCache.set(p, await loadModel(p));
        } catch {
          /* procedural */
        }
      }),
    );
    try {
      bushCached = await loadModel(BUSH_PATH);
    } catch {
      bushCached = null;
    }
  })();
  return ready;
}

function proceduralTree(kind: number): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6a4a32', roughness: 0.92, metalness: 0.02 });
  const h = 2.6 + (kind % 3) * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 + (kind % 3) * 0.03, 0.2 + (kind % 3) * 0.04, h, 10),
    trunkMat,
  );
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  // secondary limbs
  for (const [ang, y, len] of [
    [0.6, h * 0.55, 0.7],
    [-0.9, h * 0.65, 0.55],
    [2.2, h * 0.48, 0.6],
  ] as const) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, len, 6), trunkMat);
    limb.position.set(Math.sin(ang) * len * 0.35, y, Math.cos(ang) * len * 0.35);
    limb.rotation.z = ang * 0.35;
    limb.castShadow = true;
    g.add(limb);
  }
  const leafMat = new THREE.MeshStandardMaterial({
    color: LEAF_HEX[kind % LEAF_HEX.length],
    roughness: 0.84,
    metalness: 0.02,
    envMapIntensity: 0.55,
  });
  const blobs = [
    [0, h + 0.35, 0, 1.5],
    [0.55, h + 0.7, 0.2, 1.05],
    [-0.5, h + 0.65, -0.25, 1.1],
    [0.15, h + 1.2, -0.3, 0.9],
    [-0.2, h + 1.05, 0.35, 0.85],
    [0.4, h + 0.25, -0.45, 0.75],
    [-0.45, h + 0.3, 0.4, 0.7],
  ] as const;
  for (const [x, y, z, r] of blobs) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * (0.9 + (kind % 3) * 0.05), 14, 12), leafMat);
    leaf.position.set(x, y, z);
    leaf.scale.set(1.1, 0.8 + (kind % 2) * 0.12, 1.05);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    g.add(leaf);
  }
  return g;
}

export function buildNaturalTree(kind = 0): THREE.Group {
  const g = new THREE.Group();
  const path = TREE_PATHS[Math.abs(kind) % TREE_PATHS.length]!;
  const cached = treeCache.get(path);
  if (cached) {
    const model = cached.clone(true);
    tintNatural(model, LEAF_HEX[Math.abs(kind) % LEAF_HEX.length]!, kind % 2 ? '#5a3d28' : '#6a4a32');
    // Kenney trees are ~1–2 units tall
    const s = 2.5 + (kind % 3) * 0.25;
    model.scale.setScalar(s);
    model.rotation.y = ((kind * 47) % 360) * (Math.PI / 180);
    g.add(model);
    return g;
  }
  return proceduralTree(kind);
}

function flower(color: string): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.05,
      emissive: color,
      emissiveIntensity: 0.15,
    }),
  );
}

export function buildPlanter(): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.55, 1.1),
    new THREE.MeshStandardMaterial({ color: '#c5ccd4', roughness: 0.55, metalness: 0.08 }),
  );
  pot.position.y = 0.28;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);
  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.08, 0.9),
    new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 }),
  );
  soil.position.y = 0.58;
  g.add(soil);

  if (bushCached) {
    for (const [x, z, s, rot, leaf] of [
      [-0.55, 0.05, 1.15, 0.4, '#5fa84a'],
      [0.1, -0.05, 1.3, 1.2, '#6bb854'],
      [0.55, 0.08, 1.1, 2.1, '#4e9a40'],
    ] as const) {
      const b = bushCached.clone(true);
      tintNatural(b, leaf);
      b.position.set(x, 0.55, z);
      b.scale.setScalar(s);
      b.rotation.y = rot;
      g.add(b);
    }
  } else {
    const bushMat = new THREE.MeshStandardMaterial({ color: '#5fa84a', roughness: 0.85, metalness: 0.02 });
    for (const [x, z, s] of [
      [-0.55, 0, 0.42],
      [0, 0.08, 0.48],
      [0.55, -0.05, 0.4],
    ] as const) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), bushMat);
      b.position.set(x, 0.85, z);
      b.scale.set(1.1, 0.75, 1.0);
      b.castShadow = true;
      g.add(b);
    }
  }

  const cols = ['#ff6f91', '#ffe066', '#c88bff', '#ff8f6f', '#ffb3d1'];
  for (let i = 0; i < 5; i++) {
    const f = flower(cols[i % cols.length]!);
    f.position.set(-0.7 + i * 0.35, 0.72 + (i % 2) * 0.08, i % 2 ? 0.25 : -0.2);
    g.add(f);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.25, 5),
      new THREE.MeshStandardMaterial({ color: '#3d7a40', roughness: 0.9 }),
    );
    stem.position.set(f.position.x, 0.62, f.position.z);
    g.add(stem);
  }
  return g;
}

export function naturalTreesReady(): boolean {
  return treeCache.size > 0;
}
