/**
 * Natural greenery — offline-baked @dgreenheck/ez-tree (MIT) GLBs + procedural fallback.
 * Leaf cards: MeshBasic + toneMapped:false so ACES/HDRI/bloom cannot bleach them white.
 */
import * as THREE from 'three';
import { loadModel } from './assets.ts';

const LEAF_HEX = ['#2f6e28', '#3a7a30', '#256820', '#3d8532', '#2c7028', '#387830'];

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
const fixedLeafMaps = new WeakSet<THREE.Texture>();

/** Transparent leaf texels are often stored as white RGB — mipmaps bleach canopies at distance. */
function fixLeafMapMips(map: THREE.Texture) {
  if (fixedLeafMaps.has(map)) return;
  const img = map.image as { width?: number; height?: number; data?: Uint8ClampedArray } | HTMLImageElement | ImageBitmap | undefined;
  try {
    const canvas = document.createElement('canvas');
    const w = (img as HTMLImageElement)?.naturalWidth || (img as ImageBitmap)?.width || (img as any)?.width || 0;
    const h = (img as HTMLImageElement)?.naturalHeight || (img as ImageBitmap)?.height || (img as any)?.height || 0;
    if (!w || !h) {
      // Still harden sampler even if we can't edit pixels yet
      map.colorSpace = THREE.SRGBColorSpace;
      map.generateMipmaps = true;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.magFilter = THREE.LinearFilter;
      map.needsUpdate = true;
      fixedLeafMaps.add(map);
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img as CanvasImageSource, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    // Flood transparent/near-transparent texels with average opaque green so mips stay green
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! > 140) {
        sr += d[i]!; sg += d[i + 1]!; sb += d[i + 2]!; n++;
      }
    }
    const fr = n ? Math.round(sr / n) : 60;
    const fg = n ? Math.round(sg / n) : 120;
    const fb = n ? Math.round(sb / n) : 40;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! < 140) {
        d[i] = fr; d[i + 1] = fg; d[i + 2] = fb;
        // keep alpha for alphaTest
      }
    }
    ctx.putImageData(imageData, 0, 0);
    map.image = canvas;
  } catch {
    /* SwiftShader / worker may lack canvas — still set filters */
  }
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  fixedLeafMaps.add(map);
}

function leafBasicFrom(src?: THREE.Material | null, kind = 0): THREE.MeshBasicMaterial {
  const hex = LEAF_HEX[Math.abs(kind) % LEAF_HEX.length]!;
  const std = src as THREE.MeshStandardMaterial | undefined;
  const map = (std?.map || (std as any)?.alphaMap || null) as THREE.Texture | null;
  // Build a clean alpha mask from the leaf map so silhouette stays leaf-shaped
  // while RGB is forced solid green (no white mip fringe).
  let alpha: THREE.Texture | undefined;
  if (map && typeof document !== 'undefined') {
    try {
      if (!fixedLeafMaps.has(map)) fixLeafMapMips(map);
      const img = map.image as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number };
      const w = (img as any).naturalWidth || (img as any).width || 0;
      const h = (img as any).naturalHeight || (img as any).height || 0;
      if (w && h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h);
        const d = data.data;
        // grayscale alpha in all channels for Three alphaMap (uses green channel)
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]!;
          d[i] = a; d[i + 1] = a; d[i + 2] = a; d[i + 3] = 255;
        }
        ctx.putImageData(data, 0, 0);
        alpha = new THREE.CanvasTexture(c);
        alpha.wrapS = map.wrapS;
        alpha.wrapT = map.wrapT;
        alpha.flipY = map.flipY;
        alpha.generateMipmaps = true;
        alpha.minFilter = THREE.LinearMipmapLinearFilter;
        alpha.magFilter = THREE.LinearFilter;
        alpha.needsUpdate = true;
      }
    } catch {
      alpha = undefined;
    }
  }
  return new THREE.MeshBasicMaterial({
    color: hex,
    alphaMap: alpha,
    transparent: false,
    alphaTest: alpha ? 0.4 : 0,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: true,
  });
}

function trunkStandard(src?: THREE.Material | null): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#5a3d28',
    map: (src as THREE.MeshStandardMaterial)?.map ?? null,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.2,
  });
}

/** Force every mesh on an ez-tree: leaves = unlit green cards, trunk = brown PBR. */
export function hardenEzTree(root: THREE.Object3D, kind = 0) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
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
        // Leaf cards (white baseColor + green map) and any bright/non-trunk mesh
        replaced.push(leafBasicFrom(std, kind));
      }
    }
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
  const h = 2.6 + (kind % 3) * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 + (kind % 3) * 0.03, 0.2 + (kind % 3) * 0.04, h, 10),
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
  const leafMat = new THREE.MeshBasicMaterial({
    color: LEAF_HEX[kind % LEAF_HEX.length],
    side: THREE.DoubleSide,
    toneMapped: false,
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
    model.name = `ez-${path.split('/').pop()}`;
    model.userData.ezTree = true;
    // Re-harden clones (shared mats from cache already hardened; clone(true) shares mats — OK)
    hardenEzTree(model, kind);
    const s = 0.95 + (kind % 3) * 0.08;
    model.scale.setScalar(s);
    model.rotation.y = ((kind * 47) % 360) * (Math.PI / 180);
    g.add(model);
    g.userData.ezTree = true;
    g.userData.treeKind = kind;
    return g;
  }
  const p = proceduralTree(kind);
  p.userData.ezTree = false;
  p.userData.treeKind = kind;
  return p;
}

function grassClump(color: string, h: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, h * (0.7 + (i % 3) * 0.15), 4), mat);
    const a = (i / 7) * Math.PI * 2;
    const r = 0.06 + (i % 3) * 0.03;
    blade.position.set(Math.cos(a) * r, h * 0.35, Math.sin(a) * r);
    blade.rotation.z = (i % 2 ? 0.15 : -0.12) + i * 0.04;
    blade.rotation.x = (i % 3) * 0.08;
    blade.castShadow = true;
    g.add(blade);
  }
  return g;
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
  return g;
}

export function naturalTreesReady(): boolean {
  return treeCache.size > 0;
}
