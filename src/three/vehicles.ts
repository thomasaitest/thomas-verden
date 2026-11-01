/** Sleek futuristic hover-cars matching konsept/v2/4-bil.jpg — wide low chrome body, dark canopy, driver enclosed. */
import * as THREE from 'three';
import { CAR_BY_ID } from '../logic/catalog.ts';
import { glowMat, rbox, cyl } from './kit.ts';
import { physicalGlass } from './pbrTextures.ts';

/** Seat height so GLTF driver (after body drop) sits inside cabin under canopy. */
export const CAR_SEAT_Y = 0.22;
export const CAR_AVATAR_SCALE = 0.48;
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

function thrusterRing(
  g: THREE.Group,
  x: number,
  y: number,
  z: number,
  r: number,
  toward: 'front' | 'rear' | 'down',
) {
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(r, r * 0.18, 10, 28),
    new THREE.MeshStandardMaterial({ color: '#2a3344', metalness: 0.9, roughness: 0.25, envMapIntensity: 1.2 }),
  );
  rim.position.set(x, y, z);
  if (toward === 'down') rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 28), glowMat('#3ecbff', 2.6));
  if (toward === 'front') {
    core.position.set(x, y, z - 0.02);
  } else if (toward === 'rear') {
    core.position.set(x, y, z + 0.02);
  } else {
    core.rotation.x = -Math.PI / 2;
    core.position.set(x, y - 0.02, z);
  }
  g.add(core);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(r * 1.35, 24),
    new THREE.MeshBasicMaterial({ color: '#5ccfff', transparent: true, opacity: 0.32, depthWrite: false }),
  );
  if (toward === 'front') halo.position.set(x, y, z - 0.01);
  else if (toward === 'rear') halo.position.set(x, y, z + 0.01);
  else {
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(x, 0.02, z);
  }
  g.add(halo);
}

/** Wide low chrome hover-car — driver enclosed under dark canopy. */
export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const raw = def?.color ?? '#d0d8e4';
  // Push toward bright silver/chrome
  const color = hexMix(raw, '#eef2f6', 0.92);
  const dark = hexMix(color, '#121820', 0.75);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'van' ? 5.4 : kind === 'sport' ? 5.1 : 5.0;
  const bodyW = kind === 'sport' ? 2.35 : 2.45; // wider
  const hoverY = 0.32;

  const silver = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.9,
    roughness: 0.25,
    envMapIntensity: 1.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: dark,
    metalness: 0.85,
    roughness: 0.28,
    envMapIntensity: 1.1,
  });

  // Low wide teardrop profile
  const profile = new THREE.Shape();
  const L = bodyLen;
  profile.moveTo(-L * 0.5, 0.03);
  profile.quadraticCurveTo(-L * 0.52, 0.14, -L * 0.46, 0.28);
  profile.quadraticCurveTo(-L * 0.36, 0.48, -L * 0.2, 0.58);
  profile.quadraticCurveTo(-L * 0.02, 0.68, L * 0.12, 0.66);
  profile.quadraticCurveTo(L * 0.3, 0.55, L * 0.42, 0.36);
  profile.quadraticCurveTo(L * 0.5, 0.2, L * 0.52, 0.1);
  profile.lineTo(L * 0.48, 0.03);
  profile.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(profile, {
    depth: bodyW * 0.78,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.16,
    bevelSegments: 4,
    steps: 1,
  });
  hullGeo.center();
  const hull = new THREE.Mesh(hullGeo, silver);
  hull.rotation.y = Math.PI / 2;
  hull.position.set(0, hoverY + 0.06, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // Flared rear haunches (concept wide hips)
  for (const s of [-1, 1] as const) {
    const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), silver);
    haunch.scale.set(0.7, 0.45, 0.85);
    haunch.position.set(s * (bodyW * 0.48), hoverY + 0.28, bodyLen * 0.22);
    haunch.castShadow = true;
    g.add(haunch);
  }
  // Front fender bulbs
  for (const s of [-1, 1] as const) {
    const fender = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), silver);
    fender.scale.set(0.9, 0.65, 1.1);
    fender.position.set(s * (bodyW * 0.44), hoverY + 0.26, -bodyLen * 0.28);
    fender.castShadow = true;
    g.add(fender);
  }

  // Tapered rear fairing
  const rearFair = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), silver);
  rearFair.scale.set(bodyW * 0.28, 0.28, bodyLen * 0.2);
  rearFair.position.set(0, hoverY + 0.26, bodyLen * 0.38);
  rearFair.rotation.x = -0.25;
  rearFair.castShadow = true;
  g.add(rearFair);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.92, 0.08, bodyLen * 0.8), darkMat);
  chassis.position.set(0, hoverY + 0.04, 0.02);
  g.add(chassis);

  // Cyan side accent
  for (const s of [-1, 1] as const) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, bodyLen * 0.7), glowMat('#3ecbff', 1.6));
    belt.position.set(s * (bodyW * 0.52), hoverY + 0.32, 0);
    g.add(belt);
  }

  // Big round blue thruster rings at REAR (concept chase)
  thrusterRing(g, -0.42, hoverY + 0.3, bodyLen * 0.48, 0.28, 'rear');
  thrusterRing(g, 0.42, hoverY + 0.3, bodyLen * 0.48, 0.28, 'rear');
  // Front thrusters in fenders
  thrusterRing(g, -bodyW * 0.42, hoverY + 0.28, -bodyLen * 0.38, 0.16, 'front');
  thrusterRing(g, bodyW * 0.42, hoverY + 0.28, -bodyLen * 0.38, 0.16, 'front');
  // Under hover
  for (const [tx, tz] of [
    [-0.55, 0.9],
    [0.55, 0.9],
    [-0.55, -0.9],
    [0.55, -0.9],
  ] as const) {
    thrusterRing(g, tx, hoverY - 0.02, tz, 0.18, 'down');
  }

  // Dark tinted bubble canopy — encloses cabin (driver head/shoulders only)
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
    physicalGlass('#1a2838', 0.55),
  );
  // darken glass further
  (canopy.material as THREE.MeshPhysicalMaterial).color.set('#152030');
  (canopy.material as THREE.MeshPhysicalMaterial).opacity = 0.72;
  (canopy.material as THREE.MeshPhysicalMaterial).transmission = 0.35;
  (canopy.material as THREE.MeshPhysicalMaterial).roughness = 0.12;
  canopy.position.set(0, hoverY + 0.42, -0.15);
  canopy.scale.set(bodyW * 0.36, 0.52, 1.15);
  g.add(canopy);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.02, 8, 36),
    new THREE.MeshStandardMaterial({ color: dark, metalness: 0.88, roughness: 0.22 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, hoverY + 0.4, -0.15);
  rim.scale.set(bodyW * 0.36, 1.1, 1);
  g.add(rim);

  // Cabin seat (hidden under canopy)
  rbox(g, '#1a2230', [0, hoverY + 0.22, -0.05], [bodyW * 0.3, 0.08, 0.4]);
  rbox(g, '#121820', [0, hoverY + 0.38, 0.18], [bodyW * 0.28, 0.22, 0.08]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.03), glowMat('#4de0ff', 1.4));
  dash.position.set(0, hoverY + 0.4, -0.32);
  g.add(dash);

  for (const s of [-1, 1] as const) {
    rbox(g, '#ff4b6a', [s * bodyW * 0.28, hoverY + 0.26, bodyLen * 0.42], [0.3, 0.05, 0.04], undefined, 0.9);
  }

  // Panel creases
  for (const s of [-1, 1] as const) {
    const crease = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, bodyLen * 0.5), darkMat);
    crease.position.set(s * (bodyW * 0.38), hoverY + 0.45, -0.05);
    g.add(crease);
  }

  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW * 0.88, bodyLen * 0.7),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.2, depthWrite: false }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.025;
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
