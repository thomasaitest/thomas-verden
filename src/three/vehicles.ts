/** Sleek futuristic hover-cars matching konsept/v2/4-bil.jpg — low, wide, glass canopy, driver visible. */
import * as THREE from 'three';
import { CAR_BY_ID } from '../logic/catalog.ts';
import { glowMat, rbox, cyl } from './kit.ts';
import { physicalGlass } from './pbrTextures.ts';

export const CAR_SEAT_Y = 0.48;
export const CAR_AVATAR_SCALE = 0.55;
export const PRAM_PULL_BACK = 1.45;

function hexMix(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a.length === 7 ? a : '#888888');
  const B = p(b);
  const m = (i: number) => Math.round(A[i]! + (B[i]! - A[i]!) * t).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}

type CarKind = 'sport' | 'sedan' | 'suv' | 'van' | 'convertible';
function carKind(carId: string): CarKind {
  if (carId.includes('lilla') || carId.includes('rosa')) return 'sport';
  if (carId.includes('gul')) return 'convertible';
  if (carId.includes('bla')) return 'sedan';
  if (carId.includes('gronn')) return 'suv';
  return 'sedan';
}

function thrusterDisc(g: THREE.Group, x: number, y: number, z: number, r = 0.18, facing: 'down' | 'front' = 'down') {
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r * 1.05, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: '#2a3344', metalness: 0.85, roughness: 0.22 }),
  );
  disc.position.set(x, y, z);
  if (facing === 'front') disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 24), glowMat('#3ecbff', 2.2));
  if (facing === 'front') {
    core.position.set(x, y, z + 0.035);
  } else {
    core.rotation.x = -Math.PI / 2;
    core.position.set(x, y - 0.035, z);
  }
  g.add(core);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.2, 20),
    new THREE.MeshBasicMaterial({ color: '#5ccfff', transparent: true, opacity: 0.3, depthWrite: false }),
  );
  if (facing === 'front') {
    glow.position.set(x, y, z + 0.02);
  } else {
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(x, 0.02, z);
  }
  g.add(glow);
}

/** Elongated sculpted silver hover-car — NOT a saucer. */
export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const raw = def?.color ?? '#d0d8e4';
  // Push hard toward concept silver-white (4-bil.jpg)
  const color = hexMix(raw, '#e8eef4', 0.88);
  const dark = hexMix(color, '#121820', 0.72);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'van' ? 5.6 : kind === 'sport' ? 5.4 : 5.35;
  const bodyW = kind === 'sport' ? 2.05 : 2.15;
  const bodyH = kind === 'suv' ? 0.52 : kind === 'sport' ? 0.34 : 0.4;
  const hoverY = 0.38;

  const silver = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.95,
    roughness: 0.12,
    envMapIntensity: 1.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: dark,
    metalness: 0.75,
    roughness: 0.28,
    envMapIntensity: 1.1,
  });

  // Sculpted elongated hull: low waist + overlapping tapered volumes
  const hull = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.86, bodyH * 0.85, bodyLen * 0.58), silver);
  hull.position.set(0, hoverY + bodyH * 0.48, 0.05);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  // side shoulders (break up the slab)
  for (const s of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.22, bodyH * 0.55, bodyLen * 0.5), silver);
    sh.position.set(s * bodyW * 0.42, hoverY + bodyH * 0.5, 0.05);
    sh.castShadow = true;
    g.add(sh);
  }

  // Rounded upper deck along car length (capsule default = Y; rotate to Z)
  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(bodyH * 0.42, bodyLen * 0.42, 8, 20), silver);
  deck.rotation.x = Math.PI / 2;
  deck.scale.set(bodyW * 0.48, 1, 1.0);
  deck.position.set(0, hoverY + bodyH * 0.78, 0.1);
  deck.castShadow = true;
  g.add(deck);

  // Nose wedge (aerodynamic)
  const nose = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.72, bodyH * 0.62, bodyLen * 0.28), silver);
  nose.position.set(0, hoverY + bodyH * 0.42, bodyLen * 0.38);
  nose.rotation.x = 0.12;
  nose.castShadow = true;
  g.add(nose);
  const noseCap = new THREE.Mesh(new THREE.SphereGeometry(bodyH * 0.62, 18, 14), silver);
  noseCap.scale.set(bodyW * 0.62, 0.85, 1.35);
  noseCap.position.set(0, hoverY + bodyH * 0.42, bodyLen * 0.52);
  g.add(noseCap);

  // Rear taper
  const rear = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, bodyH * 0.55, bodyLen * 0.22), silver);
  rear.position.set(0, hoverY + bodyH * 0.48, -bodyLen * 0.4);
  rear.rotation.x = -0.08;
  rear.castShadow = true;
  g.add(rear);

  // Lower chassis / rocker
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.98, 0.11, bodyLen * 0.92), darkMat);
  chassis.position.set(0, hoverY + 0.08, 0);
  g.add(chassis);

  // Continuous cyan belt line (concept glow strip)
  for (const s of [-1, 1]) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, bodyLen * 0.82), glowMat('#3ecbff', 1.55));
    belt.position.set(s * (bodyW * 0.49), hoverY + bodyH * 0.55, 0);
    g.add(belt);
  }
  // Front bumper glow bar
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.7, 0.06, 0.05), glowMat('#5ce0ff', 1.8));
  bumper.position.set(0, hoverY + bodyH * 0.25, bodyLen * 0.52);
  g.add(bumper);

  // Front thruster discs (concept 4-bil)
  const frontY = hoverY + bodyH * 0.32;
  const frontZ = bodyLen * 0.54;
  for (const [tx, ty] of [
    [-0.5, 0.1],
    [0.5, 0.1],
    [-0.25, -0.05],
    [0.25, -0.05],
  ] as const) {
    thrusterDisc(g, tx, frontY + ty, frontZ, 0.17, 'front');
  }

  // Underside hover thrusters
  const tz = bodyLen * 0.3;
  const tw = bodyW * 0.34;
  for (const [tx, tzv] of [
    [-tw, tz],
    [tw, tz],
    [-tw, -tz],
    [tw, -tz],
  ] as const) {
    thrusterDisc(g, tx, hoverY - 0.02, tzv, kind === 'suv' ? 0.28 : 0.24, 'down');
  }

  // Glass canopy — elongated oval, not full bubble saucer
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
    physicalGlass('#c4e4f4', 0.92),
  );
  canopy.position.set(0, hoverY + bodyH + 0.12, 0.1);
  canopy.scale.set(bodyW * 0.58, 0.78, kind === 'sport' ? 1.35 : 1.55);
  g.add(canopy);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.022, 8, 36),
    new THREE.MeshStandardMaterial({ color: dark, metalness: 0.85, roughness: 0.22 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, hoverY + bodyH + 0.1, 0.1);
  rim.scale.set(bodyW * 0.55, kind === 'sport' ? 1.2 : 1.4, 1);
  g.add(rim);

  // Cabin / seat
  rbox(g, '#1a2230', [0, hoverY + 0.32, 0.05], [bodyW * 0.38, 0.1, 0.5]);
  rbox(g, '#121820', [0, hoverY + 0.5, -0.2], [bodyW * 0.36, 0.28, 0.1]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.03), glowMat('#4de0ff', 1.5));
  dash.position.set(0, hoverY + 0.5, 0.35);
  g.add(dash);

  // Side mirrors
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.28), darkMat);
    fin.position.set(s * (bodyW * 0.52), hoverY + bodyH * 0.95, 0.15);
    g.add(fin);
  }

  // Tail lights — thin horizontal bars
  for (const s of [-1, 1]) {
    rbox(g, '#ff4b6a', [s * bodyW * 0.3, hoverY + 0.3, -bodyLen * 0.5], [0.38, 0.08, 0.04], undefined, 0.85);
  }

  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW * 0.9, bodyLen * 0.8),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.2, depthWrite: false }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.03;
  g.add(under);

  g.userData.carId = carId;
  g.userData.seatY = CAR_SEAT_Y;
  g.userData.carKind = kind;
  return g;
}

export function buildPram(pramId: string): THREE.Group {
  const color = pramId.includes('gull') ? '#c9a84c' : pramId.includes('blaa') ? '#5a8fb8' : '#a8b8d0';
  const g = new THREE.Group();
  rbox(g, color, [0, 0.95, 0], [1.35, 0.5, 1.85]);
  rbox(g, '#e8f0ff', [0, 1.25, -0.1], [1.15, 0.14, 1.35]);
  rbox(g, color, [0, 1.55, -0.55], [1.25, 0.45, 0.7], [0.5, 0, 0]);
  for (const [x, z] of [
    [-0.45, 0.55],
    [0.45, 0.55],
    [-0.45, -0.55],
    [0.45, -0.55],
  ] as const) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.1, 12), glowMat('#7ef0ff', 1.0));
    pad.position.set(x, 0.22, z);
    g.add(pad);
  }
  cyl(g, '#8a9bb0', [0, 1.55, 0.95], [0.1, 0.85, 0.1], [0.7, 0, 0]);
  g.userData.pramId = pramId;
  return g;
}
