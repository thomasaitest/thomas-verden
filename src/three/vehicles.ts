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
  const color = hexMix(raw, '#c8d0dc', 0.62); // silver-leaning
  const dark = hexMix(color, '#121820', 0.6);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'van' ? 5.2 : kind === 'sport' ? 4.8 : 4.6;
  const bodyW = kind === 'sport' ? 2.05 : 2.15;
  const bodyH = kind === 'suv' ? 0.62 : kind === 'sport' ? 0.42 : 0.48;
  const hoverY = 0.42;

  const silver = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.82,
    roughness: 0.18,
    envMapIntensity: 1.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: dark,
    metalness: 0.7,
    roughness: 0.3,
    envMapIntensity: 1.0,
  });

  // Main elongated hull (box + rounded nose/tail) — long in Z, low in Y
  const hull = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.92, bodyH, bodyLen * 0.72), silver);
  hull.position.set(0, hoverY + bodyH * 0.55, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // Nose wedge
  const nose = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, bodyH * 0.75, bodyLen * 0.22), silver);
  nose.position.set(0, hoverY + bodyH * 0.48, bodyLen * 0.38);
  nose.castShadow = true;
  g.add(nose);
  const noseCap = new THREE.Mesh(new THREE.SphereGeometry(bodyH * 0.55, 16, 12), silver);
  noseCap.scale.set(bodyW * 0.7, 1, 1.2);
  noseCap.position.set(0, hoverY + bodyH * 0.5, bodyLen * 0.48);
  g.add(noseCap);

  // Rear deck
  const rear = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.85, bodyH * 0.7, bodyLen * 0.2), silver);
  rear.position.set(0, hoverY + bodyH * 0.5, -bodyLen * 0.38);
  rear.castShadow = true;
  g.add(rear);

  // Lower chassis / rocker panels
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.98, 0.12, bodyLen * 0.9), darkMat);
  chassis.position.set(0, hoverY + 0.1, 0);
  g.add(chassis);

  // Shoulder / belt line
  for (const s of [-1, 1]) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, bodyLen * 0.75), glowMat('#3ecbff', 1.1));
    belt.position.set(s * (bodyW * 0.48), hoverY + bodyH * 0.7, 0);
    g.add(belt);
  }

  // Front thruster discs (concept 4-bil — four blue ports on front)
  const frontY = hoverY + bodyH * 0.35;
  const frontZ = bodyLen * 0.5;
  for (const [tx, ty] of [
    [-0.45, 0.08],
    [0.45, 0.08],
    [-0.22, -0.06],
    [0.22, -0.06],
  ] as const) {
    thrusterDisc(g, tx, frontY + ty, frontZ, 0.16, 'front');
  }
  // Accent strips on front
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.04), glowMat('#3ecbff', 1.4));
    strip.position.set(s * 0.55, frontY + 0.18, frontZ + 0.02);
    g.add(strip);
  }

  // Underside hover thrusters
  const tz = bodyLen * 0.28;
  const tw = bodyW * 0.32;
  for (const [tx, tzv] of [
    [-tw, tz],
    [tw, tz],
    [-tw, -tz],
    [tw, -tz],
  ] as const) {
    thrusterDisc(g, tx, hoverY - 0.02, tzv, kind === 'suv' ? 0.28 : 0.24, 'down');
  }

  // Glass bubble canopy — mid body, shows driver
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
    physicalGlass('#b0d8ec', 0.9),
  );
  canopy.position.set(0, hoverY + bodyH + 0.15, -0.05);
  canopy.scale.set(bodyW * 0.72, 0.95, kind === 'sport' ? 1.15 : 1.35);
  g.add(canopy);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.025, 8, 32),
    new THREE.MeshStandardMaterial({ color: dark, metalness: 0.8, roughness: 0.25 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, hoverY + bodyH + 0.12, -0.05);
  rim.scale.set(bodyW * 0.68, kind === 'sport' ? 1.05 : 1.2, 1);
  g.add(rim);

  // Cabin / seat
  rbox(g, '#1a2230', [0, hoverY + 0.35, 0.0], [bodyW * 0.42, 0.1, 0.45]);
  rbox(g, '#121820', [0, hoverY + 0.52, -0.18], [bodyW * 0.4, 0.28, 0.1]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.03), glowMat('#4de0ff', 1.4));
  dash.position.set(0, hoverY + 0.52, 0.32);
  g.add(dash);

  // Side mirrors / fins
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.35), darkMat);
    fin.position.set(s * (bodyW * 0.52), hoverY + bodyH * 0.9, -0.15);
    g.add(fin);
  }

  // Tail lights
  for (const s of [-1, 1]) {
    rbox(g, '#ff4b6a', [s * bodyW * 0.28, hoverY + 0.32, -bodyLen * 0.48], [0.3, 0.1, 0.05], undefined, 0.7);
  }

  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW * 0.85, bodyLen * 0.75),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.16, depthWrite: false }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.04;
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
