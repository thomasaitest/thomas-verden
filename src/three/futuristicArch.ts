/**
 * Futuristic architecture matching konsept/v2:
 * hollow curved white shell + warm wood + glass storefront + solar canopy.
 * Shared CC0 PBR materials; white albedo ≤ ~0.8; no emissive walls.
 */
import * as THREE from 'three';
import { glowMat, G } from './kit.ts';
import { loadModel } from './assets.ts';
import {
  loadPbr,
  physicalGlass,
  preloadSharedPbr,
  SharedMats,
} from './pbrTextures.ts';

let mapsReady: Promise<void> | null = null;

const treeCache = new Map<string, THREE.Group>();
const TREE_PATHS = ['nature/tree_oak.glb', 'nature/tree_detailed.glb', 'nature/tree_pineTallA.glb', 'nature/plant_bushDetailed.glb'];

export async function preloadArchMaterials(): Promise<void> {
  if (mapsReady) return mapsReady;
  mapsReady = (async () => {
    await preloadSharedPbr();
    // Warm individual map cache used by any late callers
    try {
      await Promise.all([
        loadPbr('wood-siding', [2, 3]),
        loadPbr('concrete', [2, 2]),
        loadPbr('paving', [4, 4]),
        loadPbr('grass', [8, 8]),
        loadPbr('metal', [2, 2]),
        loadPbr('asphalt', [6, 6]),
      ]);
    } catch {
      /* offline / tests */
    }
    await Promise.all(
      TREE_PATHS.map(async (p) => {
        if (treeCache.has(p)) return;
        try {
          treeCache.set(p, await loadModel(p));
        } catch {
          /* keep procedural */
        }
      }),
    );
  })();
  return mapsReady;
}

function whiteMat() {
  return SharedMats.white;
}
function woodMat() {
  return SharedMats.wood;
}
function metalMat(color = '#8a929c') {
  const m = SharedMats.metal.clone();
  m.color.set(color);
  return m;
}

export interface ShopSpec {
  label: string;
  logoColor: string;
  w?: number;
  d?: number;
  storeys?: number;
  variant?: number;
}

/** Hollow open-front shop: white shell + wood bay + glass storefront + solar roof. */
export function buildFuturisticShop(spec: ShopSpec): THREE.Group {
  const g = new THREE.Group();
  const w = spec.w ?? 12;
  const d = spec.d ?? 9;
  const storeys = Math.max(2, spec.storeys ?? 2);
  const h = storeys * 3.35 + 0.35;
  const v = spec.variant ?? 0;
  const woodSide = v % 2 === 0 ? -1 : 1; // asymmetric wood bay

  // Plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.28, d + 0.6), SharedMats.concrete);
  plinth.position.y = 0.14;
  plinth.receiveShadow = true;
  g.add(plinth);

  // Floor slab (interior visible through glass)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.12, d - 0.3), SharedMats.concrete);
  floor.position.y = 0.32;
  floor.receiveShadow = true;
  g.add(floor);

  const wallT = 0.28;
  // Back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), whiteMat());
  back.position.set(0, h / 2 + 0.3, -d / 2 + wallT / 2);
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  // Side walls (slightly rounded feel via vertical fillets)
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d - wallT), whiteMat());
    side.position.set(s * (w / 2 - wallT / 2), h / 2 + 0.3, 0);
    side.castShadow = true;
    side.receiveShadow = true;
    g.add(side);
    // corner fillet cylinder
    const fillet = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, h, 12, 1, true, 0, Math.PI / 2), whiteMat());
    fillet.position.set(s * (w / 2 - 0.15), h / 2 + 0.3, d / 2 - 0.15);
    fillet.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI;
    g.add(fillet);
  }

  // Upper front spandrel (above glass) + side of wood bay
  const glassW = w * 0.58;
  const woodW = w * 0.32;
  const glassH = h * 0.78;
  const glassX = -woodSide * (w * 0.12);

  // Warm wood vertical cladding bay
  const wm = woodMat();
  const woodBay = new THREE.Mesh(new THREE.BoxGeometry(woodW, h * 0.92, 0.22), wm);
  woodBay.position.set(woodSide * (w / 2 - woodW / 2 - 0.05), h * 0.48 + 0.15, d / 2 - 0.05);
  woodBay.castShadow = true;
  g.add(woodBay);
  for (let i = 0; i < 10; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.88, 0.04), wm);
    slat.position.set(woodSide * (w / 2 - 0.25 - i * 0.14), h * 0.48 + 0.15, d / 2 + 0.08);
    g.add(slat);
  }
  // Side wood return
  const woodReturn = new THREE.Mesh(new THREE.BoxGeometry(0.18, h * 0.9, d * 0.55), wm);
  woodReturn.position.set(woodSide * (w / 2 - 0.1), h * 0.48 + 0.15, d * 0.1);
  woodReturn.castShadow = true;
  g.add(woodReturn);

  // Front upper band
  const band = new THREE.Mesh(new THREE.BoxGeometry(glassW + 0.4, h - glassH - 0.2, wallT), whiteMat());
  band.position.set(glassX, 0.3 + glassH + (h - glassH) / 2, d / 2 - wallT / 2);
  g.add(band);

  // Recessed storefront well
  const wellDepth = 1.35;
  const wellFloor = new THREE.Mesh(new THREE.BoxGeometry(glassW + 0.2, 0.08, wellDepth), SharedMats.concrete);
  wellFloor.position.set(glassX, 0.36, d / 2 - wellDepth / 2);
  wellFloor.receiveShadow = true;
  g.add(wellFloor);

  // Interior back of recess (warm lit)
  const wellBack = new THREE.Mesh(
    new THREE.PlaneGeometry(glassW * 0.95, glassH * 0.9),
    new THREE.MeshStandardMaterial({ color: '#e8d4b8', roughness: 0.7, metalness: 0.02, emissive: '#ffcc88', emissiveIntensity: 0.18 }),
  );
  wellBack.position.set(glassX, 0.3 + glassH * 0.48, d / 2 - wellDepth + 0.05);
  g.add(wellBack);

  // Café tables inside recess
  for (const sx of [-glassW * 0.28, glassW * 0.28]) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 16), wm);
    table.position.set(glassX + sx, 0.95, d / 2 - wellDepth * 0.55);
    g.add(table);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.85, 8), metalMat('#6a7380'));
    stem.position.set(glassX + sx, 0.52, d / 2 - wellDepth * 0.55);
    g.add(stem);
  }

  // Physical glass pane
  const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, glassH, 0.08), physicalGlass('#9ec8e0', 0.88));
  glass.position.set(glassX, 0.3 + glassH / 2, d / 2 + 0.02);
  g.add(glass);

  // Mullions
  const mull = metalMat('#d0d6de');
  for (let i = -1; i <= 1; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, glassH, 0.1), mull);
    m.position.set(glassX + i * (glassW / 3), 0.3 + glassH / 2, d / 2 + 0.06);
    g.add(m);
  }
  const mid = new THREE.Mesh(new THREE.BoxGeometry(glassW, 0.06, 0.1), mull);
  mid.position.set(glassX, 0.3 + glassH / 2, d / 2 + 0.06);
  g.add(mid);

  // Soft interior point light
  const pt = new THREE.PointLight('#ffd7a8', 1.4, 12, 2);
  pt.position.set(glassX, 2.4, d / 2 - wellDepth * 0.6);
  g.add(pt);

  // Floor band between storeys
  for (let i = 1; i < storeys; i++) {
    const fb = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.14, d - 0.2), whiteMat());
    fb.position.y = 0.3 + i * 3.35;
    g.add(fb);
  }

  // Ceiling / roof deck
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.2, d + 0.4), whiteMat());
  roofDeck.position.y = h + 0.35;
  roofDeck.castShadow = true;
  g.add(roofDeck);

  // Slanted solar canopy (arrays)
  const solarMat = metalMat('#1a3358');
  solarMat.roughness = 0.25;
  solarMat.metalness = 0.9;
  const solar = new THREE.Mesh(new THREE.BoxGeometry(w + 2.6, 0.12, d * 0.62), solarMat);
  solar.position.set(0, h + 0.85, d * 0.22);
  solar.rotation.x = -0.22;
  solar.castShadow = true;
  g.add(solar);
  // solar cell grid
  for (let ix = -5; ix <= 5; ix++) {
    for (let iz = -2; iz <= 2; iz++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.02, 0.55), metalMat('#243a62'));
      cell.position.set(ix * 0.95, h + 0.92, d * 0.08 + iz * 0.65);
      cell.rotation.x = -0.22;
      g.add(cell);
    }
  }
  // canopy supports
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 8), metalMat('#6a7380'));
    post.position.set(s * (w * 0.35), h + 0.2, d * 0.25);
    g.add(post);
  }
  const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 2.0, 0.04, 0.06), glowMat('#7ef0ff', 0.55));
  edge.position.set(0, h + 0.55, d * 0.38);
  g.add(edge);

  // Holographic roof logo
  const board = new THREE.Mesh(G.rbox(0.08), glowMat(spec.logoColor, 0.75));
  board.scale.set(Math.min(7.2, w * 0.62), 0.95, 0.14);
  board.position.set(0, h + 1.75, d * 0.35);
  g.add(board);
  const label = document.createElement('canvas');
  label.width = 512;
  label.height = 128;
  const lctx = label.getContext('2d')!;
  lctx.fillStyle = '#0a1220ee';
  lctx.roundRect(8, 8, 496, 112, 22);
  lctx.fill();
  lctx.fillStyle = '#e8f7ff';
  lctx.font = '700 36px Inter, system-ui, sans-serif';
  lctx.textAlign = 'center';
  lctx.textBaseline = 'middle';
  lctx.fillText(spec.label, 256, 68);
  const ltex = new THREE.CanvasTexture(label);
  ltex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(5.8, w * 0.5), 0.65),
    new THREE.MeshBasicMaterial({ map: ltex, transparent: true }),
  );
  plate.position.set(0, h + 1.75, d * 0.35 + 0.12);
  g.add(plate);

  // Rear windows
  for (let row = 0; row < storeys; row++) {
    for (let col = 0; col < 3; col++) {
      const pw = (w * 0.55) / 3 - 0.12;
      const ph = 2.0;
      const px = -w * 0.22 + (col + 0.5) * ((w * 0.55) / 3);
      const py = 1.6 + row * 3.35;
      const well = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.35), new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.6 }));
      well.position.set(px, py, -d / 2 + 0.2);
      g.add(well);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.9, ph * 0.9), physicalGlass('#7aa8c0', 0.7));
      pane.position.set(px, py, -d / 2 - 0.02);
      pane.rotation.y = Math.PI;
      g.add(pane);
    }
  }

  g.userData.buildingH = h;
  return g;
}

/** Slim multi-tier stone/metal fountain — many thin arcing jets, translucent water, ring lights. */
export function buildSleekFountain(): { group: THREE.Group; jets: THREE.Mesh[]; rings: THREE.Mesh[] } {
  const group = new THREE.Group();
  const stone = SharedMats.concrete;
  const dark = metalMat('#3a4450');

  // Outer basin
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.9, 0.55, 64, 1, true), stone);
  outer.position.y = 0.35;
  outer.castShadow = true;
  outer.receiveShadow = true;
  group.add(outer);
  const outerLip = new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.12, 10, 64), stone);
  outerLip.rotation.x = Math.PI / 2;
  outerLip.position.y = 0.62;
  group.add(outerLip);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.55, 4.55, 0.08, 64), dark);
  floor.position.y = 0.12;
  floor.receiveShadow = true;
  group.add(floor);

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: '#5aa8c0',
    metalness: 0.0,
    roughness: 0.06,
    transmission: 0.82,
    thickness: 0.55,
    transparent: true,
    opacity: 1,
    envMapIntensity: 1.35,
    ior: 1.33,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.48;
  group.add(water);

  // Mid tier
  const midCol = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.15, 24), stone);
  midCol.position.y = 1.05;
  midCol.castShadow = true;
  group.add(midCol);
  const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.15, 0.28, 48, 1, true), stone);
  midBowl.position.y = 1.55;
  group.add(midBowl);
  const midLip = new THREE.Mesh(new THREE.TorusGeometry(2.08, 0.08, 8, 48), stone);
  midLip.rotation.x = Math.PI / 2;
  midLip.position.y = 1.68;
  group.add(midLip);
  const midWater = new THREE.Mesh(new THREE.CircleGeometry(1.95, 48), waterMat.clone());
  midWater.rotation.x = -Math.PI / 2;
  midWater.position.y = 1.62;
  group.add(midWater);

  // Top
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1.15, 20), stone);
  col.position.y = 2.3;
  group.add(col);
  const topBowl = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), stone);
  topBowl.position.y = 3.0;
  group.add(topBowl);
  const topWater = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), waterMat.clone());
  topWater.rotation.x = -Math.PI / 2;
  topWater.position.y = 3.05;
  group.add(topWater);

  const rings: THREE.Mesh[] = [];
  for (const [ry, rr, thick] of [
    [0.5, 4.5, 0.035],
    [1.62, 1.92, 0.03],
    [3.05, 0.45, 0.022],
  ] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, thick, 8, 64), glowMat('#3ecbff', 1.35));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    group.add(ring);
    rings.push(ring);
  }

  const jets: THREE.Mesh[] = [];
  const jetMat = new THREE.MeshPhysicalMaterial({
    color: '#5ec8f0',
    transparent: true,
    opacity: 0.85,
    transmission: 0.55,
    roughness: 0.08,
    metalness: 0,
    depthWrite: false,
  });
  // Outer ring of arcing jets
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 20; s++) {
      const u = s / 20;
      const r = 0.4 + u * 3.6;
      const y = 1.65 + Math.sin(u * Math.PI) * 2.8 - u * 0.05;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.065, 6, false), jetMat);
    group.add(tube);
    jets.push(tube);
  }
  // Inner ring
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + 0.15;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 14; s++) {
      const u = s / 14;
      const r = 0.25 + u * 1.55;
      const y = 2.95 + Math.sin(u * Math.PI) * 1.1;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.048, 5, false), jetMat);
    group.add(tube);
    jets.push(tube);
  }
  // Center plume
  const plumePts: THREE.Vector3[] = [];
  for (let s = 0; s <= 22; s++) {
    const u = s / 22;
    plumePts.push(new THREE.Vector3(Math.sin(u * 12) * 0.05, 3.05 + u * 3.0, Math.cos(u * 12) * 0.05));
  }
  const plume = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(plumePts), 32, 0.08, 6, false), jetMat);
  group.add(plume);
  jets.push(plume);

  // Soft water curtains (read as volume, not just wires)
  const curtainMat = new THREE.MeshPhysicalMaterial({
    color: '#8ec8e0',
    transparent: true,
    opacity: 0.32,
    transmission: 0.55,
    roughness: 0.15,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.4), curtainMat);
    curtain.position.set(Math.cos(ang) * 2.2, 2.2, Math.sin(ang) * 2.2);
    curtain.rotation.y = ang + Math.PI / 2;
    curtain.rotation.x = -0.35;
    group.add(curtain);
    jets.push(curtain);
  }

  const foamMat = new THREE.MeshBasicMaterial({ color: '#e8f7ff', transparent: true, opacity: 0.45, depthWrite: false });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const foam = new THREE.Mesh(new THREE.CircleGeometry(0.18 + (i % 3) * 0.06, 12), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(Math.cos(ang) * (1.2 + (i % 4) * 0.55), 0.52, Math.sin(ang) * (1.2 + (i % 4) * 0.55));
    group.add(foam);
  }

  return { group, jets, rings };
}

export function buildNaturalTree(kind = 0): THREE.Group {
  const g = new THREE.Group();
  const paths = ['nature/tree_oak.glb', 'nature/tree_detailed.glb', 'nature/tree_pineTallA.glb'];
  const path = paths[kind % paths.length]!;
  const cached = treeCache.get(path);
  if (cached) {
    const model = cached.clone(true);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    // Kenney trees are ~1–2 units; scale up
    const s = kind % 2 ? 2.4 : 2.8;
    model.scale.setScalar(s);
    g.add(model);
    return g;
  }
  // Procedural fallback
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a3d28', roughness: 0.92, metalness: 0.02 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 + (kind % 3) * 0.04, 0.26 + (kind % 3) * 0.04, 2.6 + (kind % 2), 10), trunkMat);
  trunk.position.y = 1.3 + (kind % 2) * 0.2;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = SharedMats.grass.clone();
  leafMat.color.set(kind % 2 ? '#4a8a48' : '#3d7a40');
  const blobs = [
    [0, 3.2, 0, 1.6],
    [0.55, 3.6, 0.2, 1.1],
    [-0.5, 3.5, -0.25, 1.15],
    [0.2, 4.2, -0.3, 0.95],
    [-0.15, 4.0, 0.35, 0.9],
  ] as const;
  for (const [x, y, z, r] of blobs) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.85 + (kind % 3) * 0.08), 1), leafMat);
    leaf.position.set(x, y + (kind % 2) * 0.15, z);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    g.add(leaf);
  }
  return g;
}

export function buildPlanter(): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.1), SharedMats.concrete);
  pot.position.y = 0.28;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 }));
  soil.position.y = 0.58;
  g.add(soil);
  const bushPath = 'nature/plant_bushDetailed.glb';
  const bushCached = treeCache.get(bushPath);
  if (bushCached) {
    for (const [x, z, s] of [
      [-0.5, 0, 1.1],
      [0.15, 0.1, 1.25],
      [0.55, -0.05, 1.0],
    ] as const) {
      const b = bushCached.clone(true);
      b.position.set(x, 0.55, z);
      b.scale.setScalar(s);
      b.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      g.add(b);
    }
  } else {
    const bushMat = SharedMats.grass.clone();
    bushMat.color.set('#4a8a48');
    for (const [x, z, s] of [
      [-0.55, 0, 0.45],
      [0, 0.1, 0.5],
      [0.55, -0.05, 0.42],
    ] as const) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), bushMat);
      b.position.set(x, 0.85, z);
      b.castShadow = true;
      g.add(b);
    }
  }
  return g;
}

export function buildModernBench(): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.55), SharedMats.wood);
  seat.position.set(0, 0.48, 0);
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), SharedMats.wood);
  back.position.set(0, 0.75, -0.24);
  g.add(back);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.5), metalMat('#2a3344'));
    leg.position.set(s * 0.75, 0.24, 0);
    g.add(leg);
  }
  return g;
}

export function buildSkylineTower(h: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(5 + (h % 5), h, 5 + (h % 3)), whiteMat());
  body.position.y = h / 2;
  body.castShadow = true;
  g.add(body);
  for (let y = 4; y < h - 2; y += 3.2) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(5.2 + (h % 5), 0.8, 5.2 + (h % 3)),
      new THREE.MeshStandardMaterial({ color: '#3a5a78', metalness: 0.4, roughness: 0.2, emissive: '#1a4060', emissiveIntensity: 0.15 }),
    );
    band.position.y = y;
    g.add(band);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), metalMat('#1a3358'));
  top.position.y = h + 2;
  g.add(top);
  return g;
}

export function grassGroundMaterial(): THREE.MeshStandardMaterial {
  return SharedMats.grass;
}
export function pavingGroundMaterial(): THREE.MeshStandardMaterial {
  return SharedMats.paving;
}
export function asphaltGroundMaterial(): THREE.MeshStandardMaterial {
  return SharedMats.asphalt;
}

// Legacy texture helpers kept for town.ts imports during transition
export function woodTexture() {
  return new THREE.CanvasTexture(document.createElement('canvas'));
}
export function woodNormal() {
  return woodTexture();
}
export function pavingTexture() {
  return woodTexture();
}
export function pavingNormal() {
  woodTexture();
  return woodTexture();
}
export function grassTexture() {
  return woodTexture();
}
