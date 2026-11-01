import * as THREE from 'three';
import { solid } from './colliders.ts';
import { buildFood } from './food.ts';
import { box, cone, cyl, G, glassMat, part, rbox, sph, textTexture } from './kit.ts';
import { buildCar } from './vehicles.ts';

type V3 = [number, number, number];

const plane = (parent: THREE.Object3D, tex: THREE.Texture, pos: V3, w: number, h: number, rotY = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.set(...pos);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
};

const glass = (parent: THREE.Object3D, pos: V3, size: V3, color = '#cfeeff', opacity = 0.28) => {
  const m = new THREE.Mesh(G.box(), glassMat(color, opacity));
  m.position.set(...pos);
  m.scale.set(...size);
  parent.add(m);
  return m;
};

/** An invisible solid box (the real thing is drawn separately). Fully transparent, so scenery merging leaves it alone. */
export function hiddenSolid(parent: THREE.Object3D, pos: V3, size: V3, top: number): THREE.Mesh {
  const m = new THREE.Mesh(G.box(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  m.position.set(...pos);
  m.scale.set(...size);
  parent.add(m);
  return solid(m, 'rect', 0, top);
}

/** Checkered floor tiles. */
export function tileFloor(g: THREE.Object3D, w: number, d: number, a: string, b: string, y = 0.02): void {
  const nx = Math.round(w);
  const nz = Math.round(d);
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) box(g, (ix + iz) % 2 ? a : b, [-w / 2 + (ix + 0.5) * (w / nx), y, -d / 2 + (iz + 0.5) * (d / nz)], [w / nx, 0.04, d / nz]).userData.noCast = true;
}

// ---------------------------------------------------------------- shop

const SHELF_ROWS: string[][] = [
  ['eple', 'gulrot', 'brod', 'eple', 'brod', 'gulrot', 'eple', 'brod', 'gulrot', 'eple', 'brod', 'gulrot'],
  ['pizza', 'kakestykke', 'is', 'pizza', 'kakestykke', 'is', 'pizza', 'kakestykke', 'is', 'pizza', 'kakestykke', 'is'],
  ['vann', 'melk', 'juice', 'smoothie', 'vann', 'melk', 'juice', 'smoothie', 'vann', 'melk', 'juice', 'smoothie'],
];

function food(parent: THREE.Object3D, id: string, pos: V3, rotY = 0, scale = 1): THREE.Group {
  const f = buildFood(id);
  f.position.set(...pos);
  f.rotation.y = rotY;
  f.scale.multiplyScalar(scale);
  parent.add(f);
  return f;
}

function basket(g: THREE.Object3D, x: number, y: number, z: number, id: string, n = 7) {
  cyl(g, '#a8763e', [x, y + 0.2, z], [1.0, 0.4, 1.0]);
  cyl(g, '#7a5128', [x, y + 0.38, z], [0.86, 0.04, 0.86]);
  for (let i = 0; i < n; i++) {
    const a = i * 2.4;
    const r = i === 0 ? 0 : 0.28;
    food(g, id, [x + Math.cos(a) * r, y + 0.36 + (i === 0 ? 0.2 : 0), z + Math.sin(a) * r], a, 0.85);
  }
}

/**
 * The inside of the shop. Local coordinates: the door is on the +z side, the back wall at z = -4.4.
 * Returns where to stand to shop.
 */
export function fillShop(g: THREE.Group): { counter: { x: number; z: number } } {
  tileFloor(g, 12.8, 9.4, '#eef3f8', '#dce6f2');
  // door mat
  box(g, '#e8564f', [0, 0.05, 4.2], [3.2, 0.03, 1.2]).userData.noCast = true;

  // back wall shelving with real-looking things on it
  const shelf = box(g, '#b9814b', [0, 2.0, -4.15], [12.4, 4.3, 0.5]);
  solid(shelf, 'rect', 0.05, 4.5);
  box(g, '#fff4e6', [0, 2.0, -3.88], [12.2, 4.1, 0.04]);
  SHELF_ROWS.forEach((row, r) => {
    const y = 1.0 + r * 1.2;
    box(g, '#d9a066', [0, y, -3.62], [12.2, 0.12, 1.0]);
    box(g, '#7a5128', [0, y - 0.1, -3.14], [12.2, 0.08, 0.06]);
    row.forEach((id, i) => food(g, id, [-5.5 + i * 1.0, y + 0.06, -3.55], 0, 0.95));
    // price strip with the real category names
    plane(g, textTexture(['Frukt og brød', 'Pizza, kake og is', 'Drikke'][r], { bg: '#ff6f6f', fg: '#fff', w: 384, h: 80 }), [-5.2 + r * 0.0, y - 0.15, -3.1], 2.0, 0.36);
  });
  plane(g, textTexture('Velkommen til butikken!', { bg: '#ffb84d', fg: '#fff', w: 640, h: 110 }), [0, 5.0, -4.12], 5.6, 0.96);

  // glass drink coolers along the left wall
  for (const z of [-1.6, 1.3]) {
    const c = new THREE.Group();
    solid(box(c, '#f4f7ff', [0, 1.6, 0], [1.2, 3.2, 2.2]), 'rect', 0, 3.4);
    box(c, '#3fa4ff', [0.62, 3.2, 0], [0.1, 0.3, 2.2]);
    box(c, '#dfe8ff', [0.6, 1.7, 0], [0.06, 2.9, 2.0]);
    for (let r = 0; r < 4; r++) {
      box(c, '#aab6d4', [0.58, 0.55 + r * 0.62, 0], [0.04, 0.05, 1.95]);
      for (let i = 0; i < 4; i++) food(c, ['vann', 'melk', 'juice', 'smoothie'][(i + r) % 4], [0.5, 0.6 + r * 0.62, -0.7 + i * 0.47], 0, 0.62);
    }
    glass(c, [0.66, 1.65, 0], [0.04, 3.0, 2.05]);
    c.position.set(-5.8, 0, z);
    g.add(c);
  }

  // fruit island in the middle-left
  solid(rbox(g, '#ffb84d', [-2.4, 0.5, 0.4], [3.0, 1.0, 1.5]), 'rect', 0, 1.2);
  rbox(g, '#ffffff', [-2.4, 1.03, 0.4], [3.1, 0.1, 1.6]);
  basket(g, -3.3, 1.08, 0.4, 'eple');
  basket(g, -2.4, 1.08, 0.4, 'gulrot', 6);
  basket(g, -1.5, 1.08, 0.4, 'brod', 5);
  // crates and a pizza stand near the door
  solid(rbox(g, '#c98a55', [-5.0, 0.4, 3.1], [1.6, 0.8, 1.2]), 'rect', 0, 1.0);
  for (let i = 0; i < 6; i++) food(g, 'eple', [-5.5 + (i % 3) * 0.5, 0.82, 2.8 + Math.floor(i / 3) * 0.5], i, 0.85);
  solid(rbox(g, '#ffffff', [4.9, 0.55, 3.0], [1.8, 1.1, 1.2]), 'rect', 0, 1.2);
  for (let i = 0; i < 3; i++) food(g, i === 1 ? 'kakestykke' : 'pizza', [4.3 + i * 0.6, 1.12, 3.0], i * 0.5, 0.9);
  solid(rbox(g, '#7fd8ff', [3.0, 0.45, 3.6], [0.8, 0.9, 0.8]), 'rect', 0, 1.0);
  for (let i = 0; i < 2; i++) food(g, 'is', [3.0 + (i - 0.5) * 0.3, 0.95, 3.6], 0, 0.7);

  // the counter with a till
  const counter = new THREE.Group();
  solid(rbox(counter, '#ff8f8f', [0, 0.6, 0], [2.0, 1.2, 4.2]), 'rect', 0, 1.4);
  rbox(counter, '#ffffff', [0, 1.25, 0], [2.2, 0.14, 4.4]);
  box(counter, '#2b2b38', [0, 1.5, 0.9], [0.8, 0.45, 0.7]);
  box(counter, '#7cf08a', [0.05, 1.82, 0.9], [0.5, 0.3, 0.05], [-0.4, 0, 0], 0.4);
  rbox(counter, '#555a75', [0, 1.4, 1.5], [0.6, 0.2, 0.4]);
  // candy jars
  for (let i = 0; i < 3; i++) {
    const x = -0.4 + (i % 2) * 0.8;
    const z = -1.0 - (i > 1 ? 0.7 : 0);
    glass(counter, [x, 1.65, z], [0.55, 0.75, 0.55]);
    for (let k = 0; k < 7; k++) sph(counter, ['#ff6f6f', '#ffe066', '#7ccf6a', '#c88bff', '#5cc3f2'][(k + i) % 5], [x + Math.cos(k) * 0.14, 1.4 + (k % 3) * 0.15, z + Math.sin(k * 2) * 0.14], [0.14, 0.14, 0.14]);
    cyl(counter, '#ffffff', [x, 2.06, z], [0.45, 0.08, 0.45]);
  }
  cone(counter, '#ffd23f', [0.5, 1.45, -0.2], [0.18, 0.2, 0.18]);
  food(counter, 'kakestykke', [-0.3, 1.32, 1.7], 0.3, 0.8);
  counter.position.set(5.0, 0, -0.9);
  g.add(counter);
  // a lamp on each side wall
  for (const s of [-1, 1]) {
    sph(g, '#fff4c2', [s * 6.2, 4.6, 1.2], [0.5, 0.5, 0.5], undefined, 0.7);
    cyl(g, '#555a75', [s * 6.3, 4.6, 1.2], [0.1, 0.1, 0.1], [0, 0, Math.PI / 2]);
  }
  return { counter: { x: 2.9, z: -0.8 } };
}

// ---------------------------------------------------------------- hospital

function pulseTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#10261a';
  ctx.fillRect(0, 0, 128, 80);
  ctx.strokeStyle = '#4dff88';
  ctx.lineWidth = 4;
  ctx.beginPath();
  const pts = [[6, 44], [34, 44], [42, 22], [52, 66], [62, 14], [72, 44], [122, 44]];
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A hospital bed for animals. Origin: floor under the middle of the bed, head towards -z. */
export function buildHospitalBed(blanket: string): THREE.Group {
  const g = new THREE.Group();
  const steel = '#c3cad9';
  for (const x of [-0.8, 0.8]) for (const z of [-1.4, 1.4]) {
    cyl(g, steel, [x, 0.3, z], [0.09, 0.5, 0.09]);
    cyl(g, '#2b2b38', [x, 0.08, z], [0.2, 0.14, 0.2], [0, 0, Math.PI / 2]);
  }
  box(g, steel, [0, 0.56, 0], [1.76, 0.1, 3.1]);
  rbox(g, '#ffffff', [0, 0.78, 0], [1.7, 0.34, 2.96]);
  rbox(g, '#ffffff', [0, 1.03, -1.0], [1.15, 0.24, 0.65]);
  rbox(g, blanket, [0, 0.98, 0.5], [1.74, 0.22, 1.85]);
  box(g, '#ffffff', [0, 1.1, -0.45], [1.76, 0.1, 0.5]);
  part(g, G.heart(), '#ff4f6f', [0, 1.12, 0.8], [0.55, 0.55, 0.12], [-Math.PI / 2, 0, 0]);
  // head and foot boards, side rails
  rbox(g, steel, [0, 1.15, -1.6], [1.9, 1.3, 0.12]);
  rbox(g, steel, [0, 0.9, 1.6], [1.9, 0.8, 0.1]);
  for (const x of [-0.92, 0.92]) {
    box(g, steel, [x, 1.15, 0.2], [0.05, 0.05, 2.3]);
    for (let i = 0; i < 5; i++) box(g, steel, [x, 0.95, -0.8 + i * 0.55], [0.04, 0.35, 0.04]);
  }
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : 0));
  return g;
}

export const HOSPITAL_BED_TOP = 1.1;

/**
 * The inside of the animal hospital: four beds along the back wall, monitors, IV stands,
 * a reception desk and a medicine cabinet. Returns the beds' positions (local).
 */
export function fillHospital(g: THREE.Group): { beds: { x: number; z: number; y: number }[] } {
  tileFloor(g, 12.8, 10.0, '#f4f7fb', '#d8e8f8');
  box(g, '#e8564f', [0, 0.05, 4.8], [4.2, 0.03, 1.2]).userData.noCast = true;
  const beds: { x: number; z: number; y: number }[] = [];
  const tex = pulseTexture();
  const covers = ['#7fc8ff', '#ff9ccf', '#8fe08f', '#ffe066'];
  [-4.8, -1.6, 1.6, 4.8].forEach((x, i) => {
    const bed = buildHospitalBed(covers[i]);
    bed.position.set(x, 0.04, -3.25);
    g.add(bed);
    // the collision box is invisible: the bed itself is the picture
    hiddenSolid(g, [x, 0.7, -3.25], [1.9, 1.4, 3.2], 1.3);
    beds.push({ x, z: -3.1, y: HOSPITAL_BED_TOP });
    // monitor on the wall above the bed
    rbox(g, '#2b2b38', [x, 3.0, -4.75], [1.3, 0.95, 0.2]);
    plane(g, tex, [x, 3.0, -4.63], 1.1, 0.7);
    // little light
    sph(g, '#7cf08a', [x + 0.5, 3.6, -4.7], [0.15, 0.15, 0.15], undefined, 0.8);
  });
  // IV stands between the beds
  for (const x of [-3.2, 0, 3.2]) {
    cyl(g, '#c3cad9', [x, 1.5, -1.9], [0.06, 3.0, 0.06]);
    for (let k = 0; k < 4; k++) box(g, '#c3cad9', [x + Math.cos((k * Math.PI) / 2) * 0.25, 0.08, -1.9 + Math.sin((k * Math.PI) / 2) * 0.25], [0.5, 0.05, 0.06], [0, (k * Math.PI) / 2, 0]);
    glass(g, [x, 2.85, -1.9], [0.32, 0.55, 0.14], '#9ad8ff', 0.7);
    cyl(g, '#9ad8ff', [x + 0.1, 2.0, -1.9], [0.015, 1.4, 0.015], [0, 0, 0.05]);
  }
  // big red cross + sign on the back wall
  box(g, '#ff4b4b', [0, 4.9, -4.78], [0.7, 1.8, 0.14]);
  box(g, '#ff4b4b', [0, 4.9, -4.78], [1.8, 0.7, 0.14]);
  plane(g, textTexture('Sykehus', { bg: '#3fa4ff', fg: '#fff', w: 384, h: 96 }), [-3.6, 5.0, -4.7], 2.4, 0.6);
  plane(g, textTexture('Dyrlegen', { bg: '#54c45e', fg: '#fff', w: 384, h: 96 }), [3.6, 5.0, -4.7], 2.4, 0.6);
  // reception desk, right front
  solid(rbox(g, '#ffffff', [4.9, 0.55, 1.5], [2.6, 1.1, 1.3]), 'rect', 0, 1.3);
  rbox(g, '#5cc3f2', [4.9, 1.14, 1.5], [2.7, 0.1, 1.4]);
  box(g, '#2b2b38', [5.2, 1.5, 1.45], [0.8, 0.5, 0.06], [-0.2, 0, 0]);
  box(g, '#555a75', [5.2, 1.22, 1.55], [0.5, 0.06, 0.3]);
  cyl(g, '#ff8fb1', [4.2, 1.28, 1.55], [0.3, 0.2, 0.3]);
  // medicine cabinet on the left wall
  const cab = new THREE.Group();
  solid(box(cab, '#ffffff', [0, 1.1, 0], [0.9, 2.2, 2.6]), 'rect', 0, 2.4);
  glass(cab, [0.46, 1.4, 0], [0.04, 1.6, 2.3], '#bfe9ff', 0.5);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) rbox(cab, ['#ff6f6f', '#5cc3f2', '#ffe066', '#7ccf6a'][(r + i) % 4], [0.42, 0.9 + r * 0.45, -0.9 + i * 0.6], [0.15, 0.3, 0.22]);
  box(cab, '#54c45e', [0.48, 2.15, 0], [0.04, 0.4, 0.14]);
  box(cab, '#54c45e', [0.48, 2.15, 0], [0.04, 0.14, 0.4]);
  cab.position.set(-5.8, 0, 1.3);
  g.add(cab);
  // a scale and a toy basket
  solid(cyl(g, '#e6ecff', [-3.2, 0.2, 3.4], [1.3, 0.4, 1.3]), 'circle', 0, 0.6);
  rbox(g, '#9ad8c8', [-1.0, 0.35, 3.9], [1.0, 0.7, 0.8]);
  for (let i = 0; i < 3; i++) sph(g, ['#ff6f6f', '#ffe066', '#5cc3f2'][i], [-1.3 + i * 0.3, 0.8, 3.9], [0.28, 0.28, 0.28]);
  // the green care pad
  const pad = cyl(g, '#7cf08a', [0, 0.07, 1.0], [4.0, 0.06, 4.0], undefined, 0.5);
  pad.name = 'vetpad';
  pad.userData.noCast = true;
  return { beds };
}

// ---------------------------------------------------------------- car shop / pet shop

/** Showroom floor with cars on pads. Returns where to stand to browse. */
export function fillCarShop(g: THREE.Group): { counter: { x: number; z: number } } {
  tileFloor(g, 16, 12, '#e8eef8', '#cfd8e8');
  box(g, '#3fa4ff', [0, 0.05, 5.4], [4, 0.03, 1.2]).userData.noCast = true;
  plane(g, textTexture('Bilbutikk', { bg: '#3fa4ff', fg: '#fff', w: 512, h: 96 }), [0, 5.2, -5.7], 5, 0.9);
  const ids = ['bil-rosa', 'bil-gul', 'bil-bla', 'bil-gronn', 'bil-lilla'];
  ids.forEach((id, i) => {
    const x = -6 + i * 3;
    const car = buildCar(id);
    car.scale.setScalar(0.72);
    car.position.set(x, 0, -1.2);
    car.rotation.y = Math.PI / 2;
    g.add(car);
    solid(rbox(g, '#ffffff', [x, 0.08, -1.2], [3.0, 0.1, 2.4]), 'rect', 0, 0.2);
  });
  solid(rbox(g, '#ffffff', [5.5, 0.55, 3.2], [2.4, 1.1, 1.4]), 'rect', 0, 1.3);
  rbox(g, '#3fa4ff', [5.5, 1.14, 3.2], [2.5, 0.1, 1.5]);
  return { counter: { x: 3.5, z: 3.0 } };
}

/** Pet shop with prams and toys on shelves. */
export function fillPetShop(g: THREE.Group): { counter: { x: number; z: number } } {
  tileFloor(g, 14, 11, '#f0e8f4', '#e0d4ec');
  box(g, '#ff8fb1', [0, 0.05, 4.8], [3.6, 0.03, 1.2]).userData.noCast = true;
  plane(g, textTexture('Dyrebutikk', { bg: '#ff8fb1', fg: '#fff', w: 512, h: 96 }), [0, 5.0, -5.1], 5.2, 0.9);
  // shelves of toys
  solid(box(g, '#c98a55', [0, 1.8, -4.7], [12, 3.6, 0.5]), 'rect', 0.05, 4);
  for (let r = 0; r < 3; r++) {
    box(g, '#d9a066', [0, 0.7 + r * 1.1, -4.3], [11.6, 0.1, 0.9]);
    for (let i = 0; i < 8; i++) sph(g, ['#ff6f6f', '#ffe066', '#5cc3f2', '#c88bff'][(i + r) % 4], [-4.5 + i * 1.2, 0.95 + r * 1.1, -4.2], [0.35, 0.35, 0.35]);
  }
  // prams
  for (const [x, c] of [[-3.5, '#ff8fb1'], [0, '#5cc3f2'], [3.5, '#ffe066']] as const) {
    const p = new THREE.Group();
    solid(rbox(p, c, [0, 0.7, 0], [1.6, 0.7, 1.0]), 'rect', 0.1, 1.3);
    for (const sx of [-0.55, 0.55]) cyl(p, '#2b2b38', [sx, 0.25, 0.45], [0.35, 0.2, 0.35], [0, 0, Math.PI / 2]);
    for (const sx of [-0.55, 0.55]) cyl(p, '#2b2b38', [sx, 0.25, -0.45], [0.35, 0.2, 0.35], [0, 0, Math.PI / 2]);
    box(p, '#ffffff', [0, 1.3, -0.2], [0.08, 0.9, 0.08], [0.4, 0, 0]);
    p.position.set(x, 0, 1.2);
    g.add(p);
  }
  solid(rbox(g, '#ffffff', [5.0, 0.55, 3.0], [2.2, 1.1, 1.3]), 'rect', 0, 1.3);
  rbox(g, '#ff8fb1', [5.0, 1.14, 3.0], [2.3, 0.1, 1.4]);
  return { counter: { x: 3.0, z: 2.8 } };
}
