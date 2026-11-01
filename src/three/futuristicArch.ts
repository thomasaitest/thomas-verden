/**
 * Vertical-slice futuristic architecture: curved white + wood + glass shops,
 * sleek fountain, paved plaza, natural-ish trees. Procedural textures (CC0).
 */
import * as THREE from 'three';
import { box, glassMat, glowMat, mat, G } from './kit.ts';

function canvasTex(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function woodTexture(size = 256): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#c4a07a';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 18) {
      const shade = 160 + ((x * 17) % 40);
      ctx.fillStyle = `rgb(${shade},${shade - 35},${shade - 70})`;
      ctx.fillRect(x, 0, 16, s);
      ctx.strokeStyle = `rgba(80,50,30,${0.15 + (x % 5) * 0.03})`;
      ctx.beginPath();
      for (let y = 0; y < s; y += 4) ctx.lineTo(x + 8 + Math.sin(y * 0.08 + x) * 2, y);
      ctx.stroke();
    }
  }, size);
}

export function woodNormal(size = 128): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 18) {
      ctx.fillStyle = x % 36 ? '#9090ff' : '#7070ee';
      ctx.fillRect(x, 0, 14, s);
    }
  }, size);
}

export function pavingTexture(size = 512): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#7a828c';
    ctx.fillRect(0, 0, s, s);
    const n = 8;
    const gap = 4;
    const tw = (s - gap * (n + 1)) / n;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const v = 110 + ((ix * 13 + iy * 7) % 35);
      ctx.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
      ctx.fillRect(gap + ix * (tw + gap), gap + iy * (tw + gap), tw, tw);
      // subtle edge
      ctx.strokeStyle = 'rgba(40,45,55,0.35)';
      ctx.strokeRect(gap + ix * (tw + gap) + 0.5, gap + iy * (tw + gap) + 0.5, tw - 1, tw - 1);
    }
  }, size);
}

export function pavingNormal(size = 256): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, s, s);
    const n = 8;
    const gap = 3;
    const tw = (s - gap * (n + 1)) / n;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      ctx.fillStyle = '#8888ff';
      ctx.fillRect(gap + ix * (tw + gap), gap + iy * (tw + gap), tw, tw);
      ctx.fillStyle = '#7070ee';
      ctx.fillRect(gap + ix * (tw + gap), gap + iy * (tw + gap), tw, 2);
      ctx.fillRect(gap + ix * (tw + gap), gap + iy * (tw + gap), 2, tw);
    }
  }, size);
}

export function grassTexture(size = 256): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#4a7a45';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const g = 70 + Math.random() * 50;
      ctx.fillStyle = `rgb(${40 + Math.random() * 30},${g},${35 + Math.random() * 25})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 3);
    }
  }, size);
}

export interface ShopSpec {
  label: string;
  logoColor: string;
  wood?: boolean;
  w?: number;
  d?: number;
  storeys?: number;
}

/** Futuristic 2–3 storey shop: white curved body, wood cladding, window grid, solar canopy, holo sign. */
export function buildFuturisticShop(spec: ShopSpec): THREE.Group {
  const g = new THREE.Group();
  const w = spec.w ?? 12;
  const d = spec.d ?? 9;
  const storeys = spec.storeys ?? 2;
  const h = storeys * 3.4 + 0.4;

  // body: solid back + sides + roof (OPEN FRONT so window grid reads clearly)
  const bodyMat = mat('#d8dee6', 0, { metalness: 0.15, roughness: 0.4 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), bodyMat);
  back.position.set(0, h / 2, -d / 2 + 0.2);
  back.castShadow = true;
  g.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, d), bodyMat);
    side.position.set(s * (w / 2 - 0.2), h / 2, 0);
    side.castShadow = true;
    g.add(side);
  }
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), mat('#e8eef4', 0, { metalness: 0.2, roughness: 0.35 }));
  roofDeck.position.set(0, h - 0.1, 0);
  roofDeck.castShadow = true;
  g.add(roofDeck);
  // rounded front pillars
  for (const s of [-1, 1]) {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, h, 16), mat('#eef2f6', 0, { metalness: 0.12, roughness: 0.4 }));
    pil.position.set(s * (w / 2 - 0.4), h / 2, d / 2 - 0.2);
    pil.castShadow = true;
    g.add(pil);
  }

  // dark plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4), mat('#8a929c', 0, { metalness: 0.2, roughness: 0.55 }));
  plinth.position.y = 0.18;
  plinth.castShadow = true;
  g.add(plinth);

  // wood-slat side + front corner cladding
  const woodMap = woodTexture();
  const woodN = woodNormal();
  woodMap.repeat.set(2, 3);
  woodN.repeat.set(2, 3);
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodMap,
    normalMap: woodN,
    roughness: 0.7,
    metalness: 0.05,
    color: '#d8b890',
  });
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.22, h * 0.88, d * 0.75), woodMat);
    side.position.set(s * (w / 2 - 0.12), h * 0.5, -0.15);
    side.castShadow = true;
    g.add(side);
    // front wood fins
    for (let i = 0; i < storeys; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 0.12), woodMat);
      fin.position.set(s * (w / 2 - 0.55), 1.5 + i * 3.4, d / 2 + 0.08);
      g.add(fin);
    }
  }

  // floor bands
  for (let i = 1; i < storeys; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.18, d + 0.15), mat('#d8dee6', 0, { metalness: 0.15, roughness: 0.4 }));
    band.position.y = i * 3.4;
    g.add(band);
  }

  // window grid on front (opaque panes + frames — readable at distance)
  const cols = 4;
  const rows = storeys;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pw = (w * 0.72) / cols - 0.15;
      const ph = 2.4;
      const px = -w * 0.36 + (col + 0.5) * ((w * 0.72) / cols);
      const py = 1.55 + row * 3.4;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.12, ph + 0.12, 0.1), mat('#e8eef4', 0, { metalness: 0.25, roughness: 0.35 }));
      frame.position.set(px, py, d / 2 + 0.06);
      g.add(frame);
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(pw, ph),
        new THREE.MeshStandardMaterial({
          color: row === 0 ? '#2a5a78' : '#3a6a88',
          metalness: 0.55,
          roughness: 0.12,
          transparent: true,
          opacity: 0.72,
          envMapIntensity: 1.6,
        }),
      );
      pane.position.set(px, py, d / 2 + 0.12);
      g.add(pane);
      // warm interior card
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(pw * 0.9, ph * 0.85),
        new THREE.MeshBasicMaterial({ color: row === 0 ? '#ffe4c0' : '#e8f0ff', transparent: true, opacity: 0.55 }),
      );
      card.position.set(px, py, d / 2 - 0.35);
      g.add(card);
    }
  }

  // rear window band (so backs aren't blank white)
  for (let row = 0; row < storeys; row++) {
    for (let col = 0; col < 3; col++) {
      const pw = (w * 0.55) / 3 - 0.12;
      const ph = 2.0;
      const px = -w * 0.28 + (col + 0.5) * ((w * 0.55) / 3);
      const py = 1.5 + row * 3.4;
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(pw, ph),
        new THREE.MeshStandardMaterial({ color: '#7aa8c0', metalness: 0.5, roughness: 0.15, transparent: true, opacity: 0.5 }),
      );
      pane.position.set(px, py, -d / 2 - 0.06);
      pane.rotation.y = Math.PI;
      g.add(pane);
    }
  }

  // storefront canopy ledge
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.12, 1.1), mat('#f2f5f8', 0, { metalness: 0.2, roughness: 0.4 }));
  ledge.position.set(0, 3.25, d / 2 + 0.4);
  ledge.castShadow = true;
  g.add(ledge);
  const ledgeGlow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.04, 0.08), glowMat('#7ef0ff', 0.5));
  ledgeGlow.position.set(0, 3.18, d / 2 + 0.85);
  g.add(ledgeGlow);

  // furniture silhouettes ground floor
  for (const sx of [-w * 0.18, w * 0.18]) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16), mat('#c8a882', 0, { roughness: 0.6 }));
    table.position.set(sx, 0.95, d / 2 - 1.2);
    g.add(table);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), mat('#8a929c'));
    stem.position.set(sx, 0.5, d / 2 - 1.2);
    g.add(stem);
  }

  // cantilevered solar canopy
  const solar = new THREE.Mesh(G.rbox(0.1), mat('#1a3358', 0.12, { metalness: 0.55, roughness: 0.35 }));
  solar.scale.set(w + 2.4, 0.2, d * 0.6);
  solar.position.set(0, h + 0.4, d * 0.12);
  solar.rotation.x = -0.14;
  solar.castShadow = true;
  g.add(solar);
  for (let i = -3; i <= 3; i++) {
    box(g, '#2a4a78', [i * ((w + 1.5) / 7), h + 0.52, d * 0.12], [0.04, 0.02, d * 0.5], [-0.14, 0, 0], 0.05);
  }
  const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 2.0, 0.05, 0.08), glowMat('#7ef0ff', 0.45));
  edge.position.set(0, h + 0.28, d * 0.42);
  g.add(edge);

  // holographic roof logo
  const board = new THREE.Mesh(G.rbox(0.08), glowMat(spec.logoColor, 0.55));
  board.scale.set(Math.min(7, w * 0.6), 0.85, 0.14);
  board.position.set(0, h + 1.15, d * 0.05);
  g.add(board);
  const label = document.createElement('canvas');
  label.width = 512;
  label.height = 128;
  const lctx = label.getContext('2d')!;
  lctx.fillStyle = '#0a1220';
  lctx.roundRect(8, 8, 496, 112, 24);
  lctx.fill();
  lctx.fillStyle = '#e8f7ff';
  lctx.font = '700 40px Inter, system-ui, sans-serif';
  lctx.textAlign = 'center';
  lctx.textBaseline = 'middle';
  lctx.fillText(spec.label, 256, 68);
  const ltex = new THREE.CanvasTexture(label);
  ltex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(6.2, w * 0.55), 0.72), new THREE.MeshBasicMaterial({ map: ltex, transparent: true }));
  plate.position.set(0, h + 1.15, d * 0.05 + 0.1);
  g.add(plate);

  g.userData.buildingH = h;
  return g;
}

/** Sleek multi-tier fountain with arcing jets + glow rings. */
export function buildSleekFountain(): { group: THREE.Group; jets: THREE.Mesh[]; rings: THREE.Mesh[] } {
  const group = new THREE.Group();
  const stone = mat('#6a7380', 0, { metalness: 0.4, roughness: 0.38 });
  const dark = mat('#4a5560', 0, { metalness: 0.45, roughness: 0.32 });
  // thin outer rim (not a fat disc)
  const outer = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.22, 12, 64), stone);
  outer.rotation.x = Math.PI / 2;
  outer.position.y = 0.35;
  outer.castShadow = true;
  outer.receiveShadow = true;
  group.add(outer);
  const outerFloor = new THREE.Mesh(new THREE.CylinderGeometry(4.95, 4.95, 0.12, 64), dark);
  outerFloor.position.y = 0.12;
  outerFloor.receiveShadow = true;
  group.add(outerFloor);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(4.85, 64),
    new THREE.MeshStandardMaterial({
      color: '#4a9ab8',
      transparent: true,
      opacity: 0.62,
      metalness: 0.55,
      roughness: 0.08,
      emissive: '#1a6090',
      emissiveIntensity: 0.25,
      depthWrite: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.42;
  group.add(water);

  // mid tier — slim bowl
  const midRim = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.12, 10, 48), stone);
  midRim.rotation.x = Math.PI / 2;
  midRim.position.y = 1.55;
  midRim.castShadow = true;
  group.add(midRim);
  const midCol = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.15, 24), stone);
  midCol.position.y = 0.95;
  group.add(midCol);
  const midWater = new THREE.Mesh(
    new THREE.CircleGeometry(2.05, 48),
    new THREE.MeshStandardMaterial({ color: '#5ab0c8', transparent: true, opacity: 0.55, metalness: 0.5, roughness: 0.1, emissive: '#2a80a0', emissiveIntensity: 0.3, depthWrite: false }),
  );
  midWater.rotation.x = -Math.PI / 2;
  midWater.position.y = 1.58;
  group.add(midWater);

  // top spout
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.35, 20), stone);
  col.position.y = 2.35;
  group.add(col);
  const topBowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), stone);
  topBowl.position.y = 3.05;
  group.add(topBowl);

  const rings: THREE.Mesh[] = [];
  for (const [ry, rr, thick] of [
    [0.42, 4.7, 0.035],
    [1.58, 2.0, 0.03],
    [3.1, 0.55, 0.025],
  ] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, thick, 8, 64), glowMat('#3ecbff', 1.1));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    group.add(ring);
    rings.push(ring);
  }

  const jets: THREE.Mesh[] = [];
  const jetMat = new THREE.MeshStandardMaterial({
    color: '#d8f4ff',
    transparent: true,
    opacity: 0.7,
    emissive: '#7ef0ff',
    emissiveIntensity: 0.55,
    depthWrite: false,
  });
  // thin arcing jets from mid bowl outward
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 14; s++) {
      const u = s / 14;
      const r = 0.4 + u * 3.6;
      const y = 1.6 + Math.sin(u * Math.PI) * 2.2 - u * 0.15;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.035, 6, false), jetMat);
    group.add(tube);
    jets.push(tube);
  }
  // center plume
  const plumePts: THREE.Vector3[] = [];
  for (let s = 0; s <= 16; s++) {
    const u = s / 16;
    plumePts.push(new THREE.Vector3(Math.sin(u * 8) * 0.05, 3.1 + u * 2.8, Math.cos(u * 8) * 0.05));
  }
  const plume = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(plumePts), 24, 0.05, 6, false), jetMat);
  group.add(plume);
  jets.push(plume);

  return { group, jets, rings };
}

/** Natural multi-blob tree (not a lollipop). */
export function buildNaturalTree(kind = 0): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = mat('#5a3d28', 0, { roughness: 0.9, metalness: 0.02 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.8, 10), trunkMat);
  trunk.position.y = 1.4;
  trunk.castShadow = true;
  g.add(trunk);
  // branches
  for (const [bx, by, bz, rx, rz] of [
    [0.35, 2.2, 0.1, 0.5, 0.15],
    [-0.3, 2.5, -0.2, -0.45, -0.2],
    [0.15, 2.9, 0.3, 0.2, 0.5],
  ] as const) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.0, 6), trunkMat);
    b.position.set(bx, by, bz);
    b.rotation.set(rz * 0.9, 0, -rx * 0.9);
    b.castShadow = true;
    g.add(b);
  }
  const greens = kind === 1 ? ['#2a5a32', '#3a6e3c', '#1e4a28'] : kind === 2 ? ['#3a6a40', '#4a7a48', '#2e5a36'] : ['#2f6e38', '#3d8248', '#255a30', '#4a9054'];
  const clusters =
    kind === 1
      ? [
          [0, 3.6, 0, 1.6, 2.2, 1.6],
          [0, 5.0, 0, 1.2, 1.8, 1.2],
          [0, 6.0, 0, 0.8, 1.2, 0.8],
        ]
      : [
          [0, 3.5, 0, 1.8, 1.5, 1.7],
          [0.7, 4.0, 0.3, 1.2, 1.0, 1.1],
          [-0.65, 3.9, -0.35, 1.15, 0.95, 1.05],
          [0.2, 4.7, -0.15, 1.0, 0.85, 0.95],
          [-0.2, 4.3, 0.6, 0.9, 0.75, 0.85],
        ];
  clusters.forEach((c, i) => {
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 1),
      mat(greens[i % greens.length]!, 0, { roughness: 0.85, metalness: 0.02 }),
    );
    leaf.position.set(c[0]!, c[1]!, c[2]!);
    leaf.scale.set(c[3]!, c[4]!, c[5]!);
    leaf.castShadow = true;
    g.add(leaf);
  });
  return g;
}

/** Planter with shrubs. */
export function buildPlanter(): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(G.rbox(0.12), mat('#8a929c', 0, { roughness: 0.6, metalness: 0.15 }));
  pot.scale.set(1.6, 0.55, 1.6);
  pot.position.y = 0.28;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 16), mat('#3a2a1e', 0, { roughness: 1 }));
  soil.position.y = 0.58;
  g.add(soil);
  for (let i = 0; i < 5; i++) {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), mat(['#3a7a42', '#4a8a50', '#2e6a38'][i % 3]!, 0, { roughness: 0.9 }));
    const a = (i / 5) * Math.PI * 2;
    bush.position.set(Math.cos(a) * 0.35, 0.85, Math.sin(a) * 0.35);
    bush.scale.set(1, 0.9 + (i % 3) * 0.15, 1);
    g.add(bush);
  }
  return g;
}

/** Modern wood+metal bench. */
export function buildModernBench(): THREE.Group {
  const g = new THREE.Group();
  const wood = woodTexture();
  const seatMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7, metalness: 0.05, color: '#d4b090' });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.7), seatMat);
  seat.position.y = 0.55;
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.08), seatMat);
  back.position.set(0, 0.9, -0.32);
  g.add(back);
  for (const x of [-1.0, 1.0]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.6), mat('#2a3344', 0, { metalness: 0.6, roughness: 0.35 }));
    leg.position.set(x, 0.28, 0);
    g.add(leg);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.5), glowMat('#3ecbff', 0.2));
  strip.position.y = 0.48;
  g.add(strip);
  return g;
}

/** Detailed skyline tower (visual only). */
export function buildSkylineTower(h: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(G.rbox(0.05), mat('#e8eef4', 0, { metalness: 0.2, roughness: 0.35 }));
  body.scale.set(4 + Math.random() * 3, h, 4 + Math.random() * 3);
  body.position.y = h / 2;
  g.add(body);
  // glass bands
  for (let i = 0; i < 8; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.01, 0.15, 1.01), glassMat('#8ec8e8', 0.35));
    band.scale.set(body.scale.x, 1, body.scale.z);
    band.position.y = (i + 1) * (h / 9);
    g.add(band);
  }
  // spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, h * 0.25, 8), mat('#c8d4e0', 0, { metalness: 0.5, roughness: 0.3 }));
  spire.position.y = h + h * 0.12;
  g.add(spire);
  return g;
}
