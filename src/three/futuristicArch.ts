/**
 * Futuristic architecture matching konsept/v2:
 * hollow curved white shell + warm wood + glass storefront + solar canopy.
 * Shared CC0 PBR materials; white albedo ≤ ~0.8; no emissive walls.
 */
import * as THREE from 'three';
import { glowMat } from './kit.ts';
import {
  loadPbr,
  physicalGlass,
  preloadSharedPbr,
  SharedMats,
} from './pbrTextures.ts';
import {
  preloadNaturalTrees,
  buildNaturalTree as buildEzTree,
  buildPlanter as buildEzPlanter,
} from './naturalTrees.ts';

let mapsReady: Promise<void> | null = null;

export async function preloadArchMaterials(): Promise<void> {
  if (mapsReady) return mapsReady;
  mapsReady = (async () => {
    await preloadSharedPbr();
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
    await preloadNaturalTrees();
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

/** Hollow open-front shop: curved white shell + wood bay + lit glass + slanted blue solar. */
export function buildFuturisticShop(spec: ShopSpec): THREE.Group {
  const g = new THREE.Group();
  const w = spec.w ?? 12;
  const d = spec.d ?? 9;
  const storeys = Math.max(2, spec.storeys ?? 2);
  const h = storeys * 3.15 + 0.35;
  const v = spec.variant ?? 0;
  const woodSide = v % 2 === 0 ? -1 : 1;
  const white = whiteMat();
  const wm = woodMat();
  const wallT = 0.28;
  const cornerR = 1.45;

  // Soft concrete plinth with rounded ends
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 0.22, d + 0.9), SharedMats.concrete);
  plinth.position.y = 0.11;
  plinth.receiveShadow = true;
  g.add(plinth);
  for (const s of [-1, 1] as const) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, d + 0.9, 18, 1, false, 0, Math.PI),
      SharedMats.concrete,
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.set(s * (w / 2 + 0.05), 0.11, 0);
    g.add(cap);
  }

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.15, 0.1, d - 0.15), SharedMats.concrete);
  floor.position.y = 0.28;
  floor.receiveShadow = true;
  g.add(floor);

  // Curved white shell — back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(w - cornerR * 0.4, h, wallT), white);
  back.position.set(0, h / 2 + 0.28, -d / 2 + wallT / 2);
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  // Side walls + large quarter-pipe front corners (concept curved shell)
  for (const s of [-1, 1] as const) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d - cornerR * 0.85), white);
    side.position.set(s * (w / 2 - wallT / 2), h / 2 + 0.28, -0.15);
    side.castShadow = true;
    g.add(side);

    const fillet = new THREE.Mesh(
      new THREE.CylinderGeometry(cornerR, cornerR, h, 24, 1, true, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI / 2),
      white,
    );
    fillet.position.set(s * (w / 2 - cornerR * 0.55), h / 2 + 0.28, d / 2 - cornerR * 0.55);
    fillet.castShadow = true;
    g.add(fillet);

    // Solid filler so shell reads opaque from plaza
    const fill = new THREE.Mesh(new THREE.BoxGeometry(cornerR * 0.7, h, cornerR * 0.7), white);
    fill.position.set(s * (w / 2 - cornerR * 0.85), h / 2 + 0.28, d / 2 - cornerR * 0.85);
    g.add(fill);
  }

  // Soft curved roof parapet wrapping the shell
  const roofShell = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.38, d + 0.35), white);
  roofShell.position.y = h + 0.28;
  roofShell.castShadow = true;
  g.add(roofShell);
  for (const s of [-1, 1] as const) {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, d + 0.35, 16, 1, false, 0, Math.PI),
      white,
    );
    rim.rotation.z = Math.PI / 2;
    rim.position.set(s * (w / 2), h + 0.28, 0);
    g.add(rim);
  }
  // Front curved roof lip
  const frontLip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, w * 0.72, 16, 1, false, 0, Math.PI),
    white,
  );
  frontLip.rotation.z = Math.PI / 2;
  frontLip.rotation.y = Math.PI / 2;
  frontLip.position.set(0, h + 0.28, d / 2 - 0.1);
  g.add(frontLip);

  // Façade split: ~35% warm wood bay, ~65% big lit glass
  const woodW = w * 0.34;
  const glassW = w * 0.58;
  const glassH = h * 0.88;
  const glassX = -woodSide * (w * 0.12);
  const wellDepth = 1.7;

  // Warm wood bay — deep vertical oak battens (concept readable)
  const woodBay = new THREE.Mesh(new THREE.BoxGeometry(woodW, h * 0.96, 0.42), wm);
  woodBay.position.set(woodSide * (w / 2 - woodW / 2 - 0.05), h * 0.5 + 0.12, d / 2 - 0.02);
  woodBay.castShadow = true;
  g.add(woodBay);
  const battenCount = 14;
  for (let i = 0; i < battenCount; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.07, h * 0.92, 0.1), wm);
    slat.position.set(
      woodSide * (w / 2 - 0.18 - i * ((woodW - 0.25) / battenCount)),
      h * 0.5 + 0.12,
      d / 2 + 0.2,
    );
    g.add(slat);
  }
  const woodReturn = new THREE.Mesh(new THREE.BoxGeometry(0.32, h * 0.94, d * 0.55), wm);
  woodReturn.position.set(woodSide * (w / 2 - 0.1), h * 0.5 + 0.12, d * 0.02);
  woodReturn.castShadow = true;
  g.add(woodReturn);
  // Wood canopy shelf over bay
  const woodShelf = new THREE.Mesh(new THREE.BoxGeometry(woodW + 0.15, 0.12, 0.55), wm);
  woodShelf.position.set(woodSide * (w / 2 - woodW / 2 - 0.05), h * 0.92, d / 2 + 0.15);
  g.add(woodShelf);

  // Soft white eyebrow over glass
  const brow = new THREE.Mesh(new THREE.BoxGeometry(glassW + 0.7, 0.32, 0.6), white);
  brow.position.set(glassX, 0.28 + glassH + 0.12, d / 2 - 0.05);
  brow.castShadow = true;
  g.add(brow);

  const wellFloor = new THREE.Mesh(new THREE.BoxGeometry(glassW + 0.3, 0.08, wellDepth), SharedMats.concrete);
  wellFloor.position.set(glassX, 0.32, d / 2 - wellDepth / 2);
  wellFloor.receiveShadow = true;
  g.add(wellFloor);

  // Warm lit interior back (glowing storefront)
  const wellBack = new THREE.Mesh(
    new THREE.PlaneGeometry(glassW * 0.96, glassH * 0.92),
    new THREE.MeshStandardMaterial({
      color: '#f2e2cc',
      roughness: 0.62,
      metalness: 0.02,
      emissive: '#ffc888',
      emissiveIntensity: 0.38,
    }),
  );
  wellBack.position.set(glassX, 0.28 + glassH * 0.48, d / 2 - wellDepth + 0.05);
  g.add(wellBack);

  // Interior props visible through glass
  for (const sx of [-glassW * 0.28, glassW * 0.28] as const) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 18), wm);
    table.position.set(glassX + sx, 0.98, d / 2 - wellDepth * 0.55);
    g.add(table);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.88, 8), metalMat('#6a7380'));
    stem.position.set(glassX + sx, 0.52, d / 2 - wellDepth * 0.55);
    g.add(stem);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(glassW * 0.55, 0.08, 0.35), wm);
  shelf.position.set(glassX, 2.4, d / 2 - wellDepth + 0.35);
  g.add(shelf);

  // Big physical glass storefront
  const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, glassH, 0.1), physicalGlass('#b8daf0', 0.88));
  glass.position.set(glassX, 0.28 + glassH / 2, d / 2 + 0.06);
  g.add(glass);
  const mull = metalMat('#e8eef6');
  for (let i = -1; i <= 1; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, glassH, 0.11), mull);
    m.position.set(glassX + i * (glassW / 3), 0.28 + glassH / 2, d / 2 + 0.1);
    g.add(m);
  }
  const mid = new THREE.Mesh(new THREE.BoxGeometry(glassW, 0.06, 0.11), mull);
  mid.position.set(glassX, 0.28 + glassH * 0.5, d / 2 + 0.1);
  g.add(mid);

  const pt = new THREE.PointLight('#ffd7a8', 2.4, 18, 2);
  pt.position.set(glassX, 2.7, d / 2 - wellDepth * 0.5);
  g.add(pt);
  const pt2 = new THREE.PointLight('#ffe8c8', 1.0, 11, 2);
  pt2.position.set(glassX, 1.15, d / 2 - 0.35);
  g.add(pt2);

  // Eye-level sign on glass eyebrow
  {
    const sc = document.createElement('canvas');
    sc.width = 768;
    sc.height = 160;
    const sctx = sc.getContext('2d')!;
    sctx.fillStyle = '#0c1424f0';
    sctx.roundRect(12, 12, 744, 136, 28);
    sctx.fill();
    sctx.strokeStyle = spec.logoColor;
    sctx.lineWidth = 6;
    sctx.roundRect(18, 18, 732, 124, 24);
    sctx.stroke();
    sctx.fillStyle = '#eef7ff';
    sctx.font = '700 52px Inter, system-ui, sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText(spec.label.toUpperCase(), 384, 88);
    const stex = new THREE.CanvasTexture(sc);
    stex.colorSpace = THREE.SRGBColorSpace;
    const signW = Math.min(glassW * 0.95, 7.8);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(signW, 0.9),
      new THREE.MeshBasicMaterial({ map: stex, transparent: true }),
    );
    sign.position.set(glassX, 0.28 + glassH + 0.5, d / 2 + 0.22);
    g.add(sign);
    const signGlow = new THREE.Mesh(new THREE.BoxGeometry(signW + 0.2, 1.0, 0.08), glowMat(spec.logoColor, 0.7));
    signGlow.position.set(glassX, 0.28 + glassH + 0.5, d / 2 + 0.14);
    g.add(signGlow);
  }

  for (let i = 1; i < storeys; i++) {
    const fb = new THREE.Mesh(new THREE.BoxGeometry(w - 0.35, 0.12, d - 0.35), white);
    fb.position.y = 0.28 + i * 3.15;
    g.add(fb);
  }

  // Slanted BLUE solar canopy — large, concept-readable
  const solarMat = new THREE.MeshStandardMaterial({
    color: '#1a4a8a',
    metalness: 0.88,
    roughness: 0.26,
    envMapIntensity: 1.25,
  });
  const cellMat = new THREE.MeshStandardMaterial({
    color: '#2462a8',
    metalness: 0.92,
    roughness: 0.2,
    envMapIntensity: 1.35,
  });
  const solar = new THREE.Mesh(new THREE.BoxGeometry(w + 3.6, 0.14, d * 0.82), solarMat);
  solar.position.set(0, h + 1.25, d * 0.22);
  solar.rotation.x = -0.38;
  solar.castShadow = true;
  g.add(solar);
  for (let ix = -5; ix <= 5; ix++) {
    for (let iz = -2; iz <= 2; iz++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.55), cellMat);
      cell.position.set(ix * 1.0, h + 1.34, d * 0.08 + iz * 0.7);
      cell.rotation.x = -0.38;
      g.add(cell);
    }
  }
  for (const s of [-1, 1] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.55, 8), metalMat('#8a929c'));
    post.position.set(s * (w * 0.3), h + 0.45, d * 0.18);
    g.add(post);
  }
  const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 2.6, 0.05, 0.07), glowMat('#7ef0ff', 0.75));
  edge.position.set(0, h + 0.78, d * 0.4);
  g.add(edge);

  // Roof hologram logo — tall floating glowing sign (concept)
  {
    const signW = Math.min(8.4, w * 0.72);
    const signH = 1.55;
    const hy = h + 2.55;
    const hz = d * 0.42;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(signW, signH, 0.12),
      glowMat(spec.logoColor, 1.35),
    );
    board.position.set(0, hy, hz);
    g.add(board);
    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(signW + 0.35, signH + 0.35, 0.06),
      new THREE.MeshBasicMaterial({ color: spec.logoColor, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    halo.position.set(0, hy, hz + 0.02);
    g.add(halo);
    const label = document.createElement('canvas');
    label.width = 768;
    label.height = 192;
    const lctx = label.getContext('2d')!;
    lctx.clearRect(0, 0, 768, 192);
    lctx.fillStyle = '#061018cc';
    lctx.roundRect(16, 16, 736, 160, 28);
    lctx.fill();
    lctx.strokeStyle = spec.logoColor;
    lctx.lineWidth = 8;
    lctx.roundRect(24, 24, 720, 144, 22);
    lctx.stroke();
    lctx.fillStyle = '#f0fbff';
    lctx.font = '800 58px Inter, system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.shadowColor = spec.logoColor;
    lctx.shadowBlur = 18;
    lctx.fillText(spec.label.toUpperCase(), 384, 100);
    const ltex = new THREE.CanvasTexture(label);
    ltex.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(signW * 0.92, signH * 0.82),
      new THREE.MeshBasicMaterial({ map: ltex, transparent: true }),
    );
    plate.position.set(0, hy, hz + 0.1);
    g.add(plate);
    const pl = new THREE.PointLight(spec.logoColor, 1.1, 14, 2);
    pl.position.set(0, hy, hz + 1.2);
    g.add(pl);
  }

  // Rear windows
  for (let row = 0; row < storeys; row++) {
    for (let col = 0; col < 3; col++) {
      const pw = (w * 0.55) / 3 - 0.12;
      const ph = 2.0;
      const px = -w * 0.22 + (col + 0.5) * ((w * 0.55) / 3);
      const py = 1.55 + row * 3.15;
      const well = new THREE.Mesh(
        new THREE.BoxGeometry(pw, ph, 0.35),
        new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.6 }),
      );
      well.position.set(px, py, -d / 2 + 0.2);
      g.add(well);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.9, ph * 0.9), physicalGlass('#7aa8c0', 0.7));
      pane.position.set(px, py, -d / 2 - 0.02);
      pane.rotation.y = Math.PI;
      g.add(pane);
    }
  }

  return g;
}

export function buildSleekFountain(): { group: THREE.Group; jets: THREE.Mesh[]; rings: THREE.Mesh[] } {
  const group = new THREE.Group();
  // Clean white stone (concept fountain is bright white, not grey concrete)
  const stone = new THREE.MeshStandardMaterial({
    color: '#d4dae2',
    metalness: 0.06,
    roughness: 0.38,
    envMapIntensity: 0.9,
  });
  const dark = metalMat('#2a3340');

  // Outer basin
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.95, 0.58, 64, 1, true), stone);
  outer.position.y = 0.36;
  outer.castShadow = true;
  outer.receiveShadow = true;
  group.add(outer);
  const outerLip = new THREE.Mesh(new THREE.TorusGeometry(4.78, 0.14, 10, 64), stone);
  outerLip.rotation.x = Math.PI / 2;
  outerLip.position.y = 0.64;
  group.add(outerLip);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.55, 4.55, 0.08, 64), dark);
  floor.position.y = 0.12;
  floor.receiveShadow = true;
  group.add(floor);

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: '#6ab8d0',
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.7,
    thickness: 0.45,
    transparent: true,
    opacity: 0.95,
    envMapIntensity: 1.4,
    ior: 1.33,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.5;
  group.add(water);

  // Mid tier
  const midCol = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.2, 28), stone);
  midCol.position.y = 1.08;
  midCol.castShadow = true;
  group.add(midCol);
  const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.3, 48, 1, true), stone);
  midBowl.position.y = 1.58;
  group.add(midBowl);
  const midLip = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.09, 8, 48), stone);
  midLip.rotation.x = Math.PI / 2;
  midLip.position.y = 1.72;
  group.add(midLip);
  const midWater = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), waterMat.clone());
  midWater.rotation.x = -Math.PI / 2;
  midWater.position.y = 1.66;
  group.add(midWater);

  // Top
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.2, 20), stone);
  col.position.y = 2.35;
  group.add(col);
  const topBowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), stone);
  topBowl.position.y = 3.05;
  group.add(topBowl);
  const topWater = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), waterMat.clone());
  topWater.rotation.x = -Math.PI / 2;
  topWater.position.y = 3.1;
  group.add(topWater);

  const rings: THREE.Mesh[] = [];
  for (const [ry, rr, thick] of [
    [0.52, 4.5, 0.04],
    [1.66, 1.95, 0.035],
    [3.1, 0.48, 0.025],
  ] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, thick, 8, 64), glowMat('#3ecbff', 1.6));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    group.add(ring);
    rings.push(ring);
  }

  const jets: THREE.Mesh[] = [];
  // Bright opaque water streams — MeshBasic so they always read (Physical+transmission vanished under ACES)
  const jetMat = new THREE.MeshBasicMaterial({
    color: '#d8f4ff',
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#f0fbff',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Outer ring of thick arcing jets
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 24; s++) {
      const u = s / 24;
      const r = 0.35 + u * 3.85;
      const y = 1.55 + Math.sin(u * Math.PI) * 3.6 - u * 0.05;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, 0.028, 5, false), jetMat);
    tube.frustumCulled = false;
    group.add(tube);
    jets.push(tube);
  }
  // Inner ring
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + 0.12;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 16; s++) {
      const u = s / 16;
      const r = 0.2 + u * 1.7;
      const y = 3.0 + Math.sin(u * Math.PI) * 1.35;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.022, 5, false), jetMat);
    tube.frustumCulled = false;
    group.add(tube);
    jets.push(tube);
  }
  // Center plume + mist cone
  const plumePts: THREE.Vector3[] = [];
  for (let s = 0; s <= 24; s++) {
    const u = s / 24;
    plumePts.push(new THREE.Vector3(Math.sin(u * 14) * 0.06, 3.1 + u * 3.4, Math.cos(u * 14) * 0.06));
  }
  const plume = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(plumePts), 40, 0.032, 5, false), jetMat);
  plume.frustumCulled = false;
  group.add(plume);
  jets.push(plume);

  const mist = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.2, 14, 1, true), mistMat);
  mist.position.y = 4.6;
  mist.frustumCulled = false;
  group.add(mist);
  jets.push(mist);

  // Soft water curtains (volume)
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 2.6), mistMat);
    curtain.position.set(Math.cos(ang) * 2.35, 2.35, Math.sin(ang) * 2.35);
    curtain.rotation.y = ang + Math.PI / 2;
    curtain.rotation.x = -0.4;
    curtain.frustumCulled = false;
    group.add(curtain);
    jets.push(curtain);
  }

  // Splash foam discs
  const foamMat = new THREE.MeshBasicMaterial({ color: '#f0fbff', transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2;
    const foam = new THREE.Mesh(new THREE.CircleGeometry(0.22 + (i % 3) * 0.08, 14), foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(Math.cos(ang) * (1.15 + (i % 5) * 0.55), 0.54, Math.sin(ang) * (1.15 + (i % 5) * 0.55));
    group.add(foam);
  }

  // Unique materials per jet (shared mat + opacity anim previously cascaded to ~0)
  for (const j of jets) {
    const m = j.material as THREE.MeshBasicMaterial;
    const c = m.clone();
    if (c.color.getHexString() === 'd8f4ff' || c.color.getHexString() === 'c8f0ff') c.opacity = 0.78;
    else c.opacity = Math.max(0.4, c.opacity);
    j.material = c;
    j.userData.baseOpacity = c.opacity;
  }

  return { group, jets, rings };
}

export function buildNaturalTree(kind = 0): THREE.Group {
  return buildEzTree(kind);
}

export function buildPlanter(): THREE.Group {
  return buildEzPlanter();
}

export function buildModernBench(): THREE.Group {
  const g = new THREE.Group();
  // Slim park bench: thin wood slats + thin metal frame (not a black box)
  const wood = SharedMats.wood.clone();
  wood.color.set('#c4a078');
  wood.roughness = 0.7;
  const metal = metalMat('#6a7484');
  for (let i = 0; i < 5; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.035, 0.09), wood);
    slat.position.set(0, 0.46, -0.18 + i * 0.1);
    slat.castShadow = true;
    g.add(slat);
  }
  for (let i = 0; i < 3; i++) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.035, 0.08), wood);
    back.position.set(0, 0.62 + i * 0.1, -0.28);
    back.rotation.x = -0.12;
    g.add(back);
  }
  for (const s of [-1, 1] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.46, 0.42), metal);
    leg.position.set(s * 0.72, 0.23, 0.02);
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.42), metal);
    arm.position.set(s * 0.72, 0.58, 0.02);
    g.add(arm);
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
