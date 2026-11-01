/** Sleek futuristic hover-cars matching konsept/v2/4-bil.jpg — sculpted teardrop, glass canopy, driver visible. */
import * as THREE from 'three';
import { CAR_BY_ID } from '../logic/catalog.ts';
import { glowMat, rbox, cyl } from './kit.ts';
import { physicalGlass } from './pbrTextures.ts';

export const CAR_SEAT_Y = 0.52;
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
    // Car forward is −Z; place emissive face on the nose side
    core.position.set(x, y, z - 0.035);
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
    glow.position.set(x, y, z - 0.02);
  } else {
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(x, 0.02, z);
  }
  g.add(glow);
}

/** Elongated sculpted silver hover-car — NOT a slab. Concept teardrop from chase cam. */
export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const raw = def?.color ?? '#d0d8e4';
  const color = hexMix(raw, '#e8eef4', 0.88);
  const dark = hexMix(color, '#121820', 0.72);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'van' ? 5.6 : kind === 'sport' ? 5.3 : 5.2;
  const bodyW = kind === 'sport' ? 2.05 : 2.15;
  const hoverY = 0.42;

  const silver = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.96,
    roughness: 0.1,
    envMapIntensity: 1.65,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: dark,
    metalness: 0.82,
    roughness: 0.24,
    envMapIntensity: 1.15,
  });

  // Side-profile extrude — tall enough to read as a sculpted sedan, not a pancake
  const profile = new THREE.Shape();
  const L = bodyLen;
  // Nose (front = +Z after rotate) sits at +L/2 in shape X before rotate
  profile.moveTo(-L * 0.48, 0.04);
  profile.quadraticCurveTo(-L * 0.5, 0.22, -L * 0.46, 0.38); // rear bumper rise
  profile.quadraticCurveTo(-L * 0.38, 0.72, -L * 0.22, 0.82); // rear deck
  profile.quadraticCurveTo(-L * 0.05, 0.95, L * 0.08, 0.98); // cabin roof line
  profile.quadraticCurveTo(L * 0.28, 0.88, L * 0.38, 0.62); // windshield rake
  profile.quadraticCurveTo(L * 0.48, 0.4, L * 0.5, 0.22); // nose drop
  profile.lineTo(L * 0.48, 0.04);
  profile.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(profile, {
    depth: bodyW * 0.78,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 3,
    steps: 1,
  });
  hullGeo.center();
  const hull = new THREE.Mesh(hullGeo, silver);
  hull.rotation.y = Math.PI / 2; // profile X → world −Z length
  hull.position.set(0, hoverY + 0.08, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // Soft side bolsters (width curve without reading as extra domes)
  for (const s of [-1, 1] as const) {
    const bolster = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), silver);
    bolster.scale.set(0.42, 0.42, bodyLen * 0.32);
    bolster.position.set(s * (bodyW * 0.4), hoverY + 0.32, 0.0);
    bolster.castShadow = true;
    g.add(bolster);
  }

  // Front fender bulbs (concept circular thruster housings)
  for (const s of [-1, 1] as const) {
    const fender = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), silver);
    fender.scale.set(0.85, 0.7, 1.15);
    fender.position.set(s * (bodyW * 0.42), hoverY + 0.32, -bodyLen * 0.32);
    fender.castShadow = true;
    g.add(fender);
  }

  // Tapered rear fairing — single continuous sculpt, not a second dome
  const rearFair = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), silver);
  rearFair.scale.set(bodyW * 0.38, 0.38, bodyLen * 0.22);
  rearFair.position.set(0, hoverY + 0.34, bodyLen * 0.38);
  rearFair.rotation.x = -0.22;
  rearFair.castShadow = true;
  g.add(rearFair);

  // Lower chassis skirt
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.08, bodyLen * 0.82), darkMat);
  chassis.position.set(0, hoverY + 0.05, 0.02);
  g.add(chassis);

  // Cyan side belt (concept accent)
  for (const s of [-1, 1] as const) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, bodyLen * 0.72), glowMat('#3ecbff', 1.7));
    belt.position.set(s * (bodyW * 0.5), hoverY + 0.4, 0.02);
    g.add(belt);
  }
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.55, 0.045, 0.045), glowMat('#5ce0ff', 1.9));
  bumper.position.set(0, hoverY + 0.22, -bodyLen * 0.48);
  g.add(bumper);

  // Front thrusters in fender bulbs
  const frontY = hoverY + 0.32;
  const frontZ = -bodyLen * 0.42;
  for (const [tx, ty] of [
    [-bodyW * 0.42, 0.02],
    [bodyW * 0.42, 0.02],
    [-0.22, -0.06],
    [0.22, -0.06],
  ] as const) {
    thrusterDisc(g, tx, frontY + ty, frontZ, 0.15, 'front');
  }
  // Under-hover pads
  const tz = bodyLen * 0.26;
  const tw = bodyW * 0.3;
  for (const [tx, tzv] of [
    [-tw, tz],
    [tw, tz],
    [-tw, -tz],
    [tw, -tz],
  ] as const) {
    thrusterDisc(g, tx, hoverY - 0.02, tzv, kind === 'suv' ? 0.24 : 0.2, 'down');
  }

  // ONE elongated glass canopy nestled into hull (concept bubble)
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
    physicalGlass('#c4e4f4', 0.9),
  );
  canopy.position.set(0, hoverY + 0.58, -0.35);
  canopy.scale.set(bodyW * 0.38, 0.55, kind === 'sport' ? 1.2 : 1.42);
  g.add(canopy);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.018, 8, 36),
    new THREE.MeshStandardMaterial({ color: dark, metalness: 0.85, roughness: 0.2 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, hoverY + 0.55, -0.35);
  rim.scale.set(bodyW * 0.42, kind === 'sport' ? 1.05 : 1.25, 1);
  g.add(rim);

  // Cabin / seat / dash
  rbox(g, '#1a2230', [0, hoverY + 0.32, -0.15], [bodyW * 0.34, 0.1, 0.46]);
  rbox(g, '#121820', [0, hoverY + 0.5, 0.05], [bodyW * 0.32, 0.24, 0.1]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.03), glowMat('#4de0ff', 1.5));
  dash.position.set(0, hoverY + 0.5, -0.42);
  g.add(dash);

  for (const s of [-1, 1] as const) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.18), darkMat);
    mir.position.set(s * (bodyW * 0.48), hoverY + 0.7, -0.45);
    g.add(mir);
  }
  for (const s of [-1, 1] as const) {
    rbox(g, '#ff4b6a', [s * bodyW * 0.26, hoverY + 0.3, bodyLen * 0.44], [0.34, 0.06, 0.04], undefined, 0.9);
  }

  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW * 0.85, bodyLen * 0.72),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.22, depthWrite: false }),
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
