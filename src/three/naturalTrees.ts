/**
 * Natural greenery — offline-baked @dgreenheck/ez-tree (MIT) GLBs + procedural fallback.
 * Leaf cards: lit MeshStandard (varied darker greens, alphaTest, shadows) so canopies have depth.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coalesceLook } from './kit.ts';
import { loadModel } from './assets.ts';

/** Darker, varied canopy greens — concept depth, not neon paper. */
const LEAF_HEX = ['#2f6e28', '#3a7a30', '#275f22', '#458538', '#336b2a', '#3d8034'];

const TREE_PATHS = [
  'nature/ez/oak-a.glb',
  'nature/ez/oak-b.glb',
  'nature/ez/aspen-a.glb',
  'nature/ez/aspen-b.glb',
  'nature/ez/pine-a.glb',
  'nature/ez/pine-b.glb',
] as const;

const BUSH_PATH = 'nature/plant_bushDetailed.glb';

const treeCache = new Map<string, THREE.Group>();
let bushCached: THREE.Group | null = null;
let ready: Promise<void> | null = null;

function leafKind(kind: number): number {
  return Math.abs(Math.floor(kind)) % LEAF_HEX.length;
}

const leafMats = new Map<string, THREE.MeshStandardMaterial>();
const trunkMats = new Map<string, THREE.MeshStandardMaterial>();

function leafStandardFrom(src?: THREE.Material | null, kind = 0): THREE.MeshStandardMaterial {
  const hex = LEAF_HEX[leafKind(kind)]!;
  const srcStd = src as THREE.MeshStandardMaterial | undefined;
  const map = srcStd?.map ?? null;
  const alphaMap = (srcStd?.alphaMap ?? null) as THREE.Texture | null;
  const key = `${leafKind(kind)}|${map?.uuid ?? ''}|${alphaMap?.uuid ?? ''}`;
  const hit = leafMats.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.82,
    metalness: 0.02,
    envMapIntensity: 0.35,
    side: THREE.DoubleSide,
    alphaTest: map || alphaMap ? 0.35 : 0,
    transparent: false,
    depthWrite: true,
  });
  if (map) mat.map = map;
  if (alphaMap) mat.alphaMap = alphaMap;
  leafMats.set(key, mat);
  return mat;
}

function trunkStandard(src?: THREE.Material | null): THREE.MeshStandardMaterial {
  const map = (src as THREE.MeshStandardMaterial | undefined)?.map ?? null;
  const key = map?.uuid ?? '';
  const hit = trunkMats.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshStandardMaterial({
    color: '#5a3d28',
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.2,
  });
  if (map) mat.map = map;
  trunkMats.set(key, mat);
  return mat;
}

const canopyGeos: THREE.BufferGeometry[] = [];
function canopyGeometry(kind: number): THREE.BufferGeometry {
  const k = leafKind(kind);
  const cached = canopyGeos[k];
  if (cached) return cached;
  const parts: THREE.BufferGeometry[] = [];
  const blobs = [
    [0, 0, 0, 1.2],
    [0.42, 0.28, 0.12, 0.82],
    [-0.38, 0.22, -0.16, 0.78],
    [0.05, 0.72, -0.08, 0.7],
  ] as const;
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.SphereGeometry(r, 7, 5);
    g.translate(x, y, z);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false) ?? parts[0]!;
  canopyGeos[k] = merged;
  return merged;
}

/** Near mesh is the full tree; far mesh is a solid canopy so the horizon stays green. */
function attachLod(root: THREE.Group, near: THREE.Object3D, kind: number): THREE.Group {
  near.name = 'tree-near';
  const far = new THREE.Mesh(canopyGeometry(kind), leafStandardFrom(null, kind));
  far.name = 'tree-far';
  far.position.y = 2.55;
  far.castShadow = false;
  far.receiveShadow = false;
  far.visible = false;
  far.userData.noCast = true;
  root.add(near, far);
  root.userData.lodNear = near;
  root.userData.lodFar = far;
  root.userData.ezTree = true;
  root.userData.treeKind = leafKind(kind);
  return root;
}

/** Force every mesh on an ez-tree: leaves = lit green cards, trunk = brown PBR. */
export function hardenEzTree(root: THREE.Object3D, kind = 0) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const geo = (m.geometry as THREE.BufferGeometry)?.type || '';
    const name = `${m.name || ''}`.toLowerCase();
    const replaced: THREE.Material[] = [];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      const c = std?.color;
      const bright = c ? (c.r + c.g + c.b) / 3 : 1;
      const hasMap = !!(std?.map || (std as any)?.alphaMap);
      const alphaBlend = (std as any)?.transparent || (std as any)?.alphaTest > 0 || (std as any)?.opacity < 1;
      const trunkish =
        name.includes('bark') ||
        name.includes('trunk') ||
        name.includes('wood') ||
        geo.includes('Cylinder') ||
        (!hasMap && !alphaBlend && c && c.r > c.g * 1.05 && bright < 0.55);
      if (trunkish) {
        replaced.push(trunkStandard(std));
      } else {
        replaced.push(leafStandardFrom(std, kind));
      }
    }
    const casts = replaced.some((mat) => [...trunkMats.values()].includes(mat as THREE.MeshStandardMaterial));
    m.castShadow = casts;
    m.receiveShadow = casts;
    m.userData.noCast = !casts;
    m.material = replaced.length === 1 ? replaced[0]! : replaced;
    const g = m.geometry as THREE.BufferGeometry;
    if (g?.attributes?.color) g.deleteAttribute('color');
  });
}

function prepareTree(root: THREE.Object3D, kind = 0) {
  hardenEzTree(root, kind);
}

export async function preloadNaturalTrees(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await Promise.all(
      TREE_PATHS.map(async (p) => {
        try {
          const g = await loadModel(p);
          prepareTree(g, TREE_PATHS.indexOf(p as (typeof TREE_PATHS)[number]));
          treeCache.set(p, g);
        } catch {
          /* procedural fallback */
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
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6a4a32', roughness: 0.92, metalness: 0.02, envMapIntensity: 0.2 });
  const pk = leafKind(kind);
  const h = 2.6 + (pk % 3) * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 + (pk % 3) * 0.03, 0.2 + (pk % 3) * 0.04, h, 10),
    trunkMat,
  );
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
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
    color: LEAF_HEX[leafKind(kind)],
    roughness: 0.82,
    metalness: 0.02,
    envMapIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  const blobs = [
    [0, h + 0.55, 0, 1.15],
    [0.45, h + 0.85, 0.15, 0.85],
    [-0.4, h + 0.8, -0.2, 0.9],
    [0.1, h + 1.25, -0.25, 0.7],
    [-0.15, h + 1.15, 0.3, 0.65],
    [0.55, h + 0.45, -0.35, 0.6],
    [-0.5, h + 0.5, 0.35, 0.58],
    [0.25, h + 0.35, 0.45, 0.55],
    [-0.3, h + 0.4, -0.45, 0.52],
    [0, h + 1.55, 0, 0.55],
  ] as const;
  for (const [x, y, z, r] of blobs) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * (0.9 + (pk % 3) * 0.05), 14, 12), leafMat);
    leaf.position.set(x, y, z);
    leaf.scale.set(1.1, 0.8 + (pk % 2) * 0.12, 1.05);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    g.add(leaf);
  }
  return g;
}

export function buildNaturalTree(kind = 0): THREE.Group {
  const g = new THREE.Group();
  const ki = leafKind(kind);
  const path = TREE_PATHS[ki % TREE_PATHS.length]!;
  const cached = treeCache.get(path);
  if (cached) {
    const model = cached.clone(true);
    model.name = `ez-${path.split('/').pop()}`;
    hardenEzTree(model, ki);
    const s = 0.95 + (ki % 3) * 0.08;
    model.scale.setScalar(s);
    model.rotation.y = ((ki * 47) % 360) * (Math.PI / 180);
    const near = new THREE.Group();
    near.add(model);
    return attachLod(g, near, ki);
  }
  const proc = proceduralTree(ki);
  return attachLod(g, proc, ki);
}

/** Slim roadside palm — trunk + radial fronds (concept palms). */
export function buildPalm(kind = 0): THREE.Group {
  const g = new THREE.Group();
  const k = leafKind(kind);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.88, metalness: 0.04, envMapIntensity: 0.25 });
  const frondMat = new THREE.MeshStandardMaterial({
    color: LEAF_HEX[(k + 2) % LEAF_HEX.length],
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.4,
    side: THREE.DoubleSide,
  });
  const h = 3.4 + (k % 3) * 0.35;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, h, 8), trunkMat);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  // slight lean
  trunk.rotation.z = ((k % 5) - 2) * 0.03;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + k * 0.2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.35, 5, 1, true), frondMat);
    frond.position.set(Math.cos(a) * 0.15, h - 0.05, Math.sin(a) * 0.15);
    frond.rotation.z = Math.PI / 2 - 0.55;
    frond.rotation.y = -a;
    frond.castShadow = true;
    frond.receiveShadow = true;
    g.add(frond);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), frondMat);
    tip.scale.set(1.6, 0.35, 0.7);
    tip.position.set(Math.cos(a) * 0.85, h - 0.35, Math.sin(a) * 0.85);
    tip.castShadow = true;
    g.add(tip);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), frondMat);
  crown.position.y = h + 0.05;
  crown.scale.set(1.2, 0.55, 1.2);
  crown.castShadow = true;
  g.add(crown);
  g.userData.palm = true;
  coalesceLook(g);
  return g;
}

/** Low roadside shrub / bush clump. */
export function buildShrub(kind = 0): THREE.Group {
  const g = new THREE.Group();
  const k = leafKind(kind);
  if (bushCached) {
    const b = bushCached.clone(true);
    b.scale.setScalar(0.7 + (k % 3) * 0.12);
    b.rotation.y = k * 0.9;
    b.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat?.color && mat.color.g > mat.color.r) {
        mat.color.set(LEAF_HEX[k]!);
        mat.roughness = 0.85;
      }
    });
    g.add(b);
  } else {
    const mat = new THREE.MeshStandardMaterial({
      color: LEAF_HEX[k]!,
      roughness: 0.85,
      metalness: 0.02,
      envMapIntensity: 0.3,
    });
    for (const [x, y, z, r] of [
      [0, 0.35, 0, 0.45],
      [0.28, 0.28, 0.1, 0.32],
      [-0.22, 0.3, -0.12, 0.3],
      [0.05, 0.48, -0.15, 0.28],
    ] as const) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      s.position.set(x, y, z);
      s.scale.set(1.1, 0.75, 1.0);
      s.castShadow = true;
      s.receiveShadow = true;
      g.add(s);
    }
  }
  g.userData.shrub = true;
  return g;
}

function grassClump(color: string, h: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const parts: THREE.BufferGeometry[] = [];
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.ConeGeometry(0.035, h * (0.7 + (i % 3) * 0.15), 4);
    const a = (i / 7) * Math.PI * 2;
    const r = 0.06 + (i % 3) * 0.03;
    q.setFromEuler(new THREE.Euler((i % 3) * 0.08, 0, (i % 2 ? 0.15 : -0.12) + i * 0.04));
    v.set(Math.cos(a) * r, h * 0.35, Math.sin(a) * r);
    blade.applyMatrix4(m4.compose(v, q, v.clone().set(1, 1, 1)));
    parts.push(blade);
  }
  const geo = mergeGeometries(parts, false) ?? parts[0]!;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.userData.noCast = true;
  return mesh;
}

function flower(color: string): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 6),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.05,
      emissive: color,
      emissiveIntensity: 0.12,
    }),
  );
}

/** Slim dark-grey / wood planter with ornamental grasses (gate plaza). */
export function buildPlanter(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({
    color: '#c4b09a',
    roughness: 0.68,
    metalness: 0.05,
    envMapIntensity: 0.55,
  });
  const rim = new THREE.MeshStandardMaterial({
    color: '#9aa3ae',
    roughness: 0.4,
    metalness: 0.3,
  });
  const pot = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.36, 0.42), wood);
  pot.position.y = 0.18;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 0.48), rim);
  lip.position.y = 0.38;
  g.add(lip);
  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.05, 0.32),
    new THREE.MeshStandardMaterial({ color: '#5a5048', roughness: 1 }),
  );
  soil.position.y = 0.35;
  g.add(soil);

  const grassColors = ['#5fa84a', '#6bb854', '#4e9a40', '#7ac45c'];
  for (let i = 0; i < 5; i++) {
    const clump = grassClump(grassColors[i % grassColors.length]!, 0.5 + (i % 3) * 0.1);
    clump.position.set(-0.45 + i * 0.22, 0.35, i % 2 ? 0.05 : -0.04);
    g.add(clump);
  }

  if (bushCached) {
    const b = bushCached.clone(true);
    b.position.set(0.15, 0.38, 0);
    b.scale.setScalar(0.55);
    b.rotation.y = 0.8;
    g.add(b);
  }

  const cols = ['#ff6f91', '#ffe066', '#c88bff'];
  for (let i = 0; i < 3; i++) {
    const f = flower(cols[i]!);
    f.position.set(-0.4 + i * 0.35, 0.62 + (i % 2) * 0.06, i % 2 ? 0.12 : -0.1);
    g.add(f);
  }
  coalesceLook(g);
  return g;
}

export function naturalTreesReady(): boolean {
  return treeCache.size > 0;
}
