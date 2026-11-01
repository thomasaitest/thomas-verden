/** Sleek futuristic hover-cars — ~4.5×1.85×1.3 m, glossy silver, dark canopy, compact cyan thrusters. */
import * as THREE from 'three';
import { CAR_BY_ID } from '../logic/catalog.ts';
import { glowMat, rbox } from './kit.ts';
import { physicalGlass } from './pbrTextures.ts';

/** Seat height so GLTF driver (after body drop) sits inside cabin under canopy. */
export const CAR_SEAT_Y = 0.38;
export const CAR_AVATAR_SCALE = 0.52;
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

/** Compact rear thruster — tiny rim + cyan core (bloom-safe, not giant rings). */
function compactThruster(g: THREE.Group, x: number, y: number, z: number) {
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.014, 8, 20),
    new THREE.MeshStandardMaterial({ color: '#1a2230', metalness: 0.92, roughness: 0.22, envMapIntensity: 1.0 }),
  );
  rim.position.set(x, y, z);
  g.add(rim);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), glowMat('#3ecbff', 1.4));
  core.position.set(x, y, z + 0.01);
  g.add(core);
  const jet = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.18, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: '#7ef0ff', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  );
  jet.position.set(x, y, z + 0.11);
  jet.rotation.x = Math.PI / 2;
  g.add(jet);
}

/** Low sleek wedge hover-car — concept scale ~4.5 m × 1.85 m × ~1.3 m tall. */
export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const raw = def?.color ?? '#d0d8e4';
  const color = hexMix(raw, '#e8eef4', 0.88);
  const dark = hexMix(color, '#0e141c', 0.78);
  const kind = carKind(carId);
  const g = new THREE.Group();

  // Target real-world-ish scale (lane ~3.5–3.6 m)
  const bodyLen = kind === 'van' ? 4.4 : kind === 'sport' ? 4.0 : 4.15;
  const bodyW = kind === 'sport' ? 1.65 : 1.7;
  const hoverY = 0.16;
  const bodyH = 0.62; // hull; + canopy ≈ 1.15–1.25 m

  const silver = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.96,
    roughness: 0.14,
    envMapIntensity: 2.0,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: dark,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.3,
  });
  const creaseMat = new THREE.MeshStandardMaterial({
    color: '#121820',
    metalness: 0.75,
    roughness: 0.3,
  });

  // Low wedge / teardrop side profile (sleek, not bulbous)
  const profile = new THREE.Shape();
  const L = bodyLen;
  const H = bodyH;
  profile.moveTo(-L * 0.48, 0.02);
  profile.quadraticCurveTo(-L * 0.5, H * 0.25, -L * 0.42, H * 0.48); // nose
  profile.quadraticCurveTo(-L * 0.22, H * 0.78, -L * 0.05, H * 0.88); // cabin rise
  profile.quadraticCurveTo(L * 0.12, H * 0.92, L * 0.28, H * 0.72); // roof
  profile.quadraticCurveTo(L * 0.42, H * 0.45, L * 0.48, H * 0.22); // taper rear
  profile.lineTo(L * 0.46, 0.02);
  profile.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(profile, {
    depth: bodyW * 0.92,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 3,
    steps: 1,
  });
  hullGeo.center();
  const hull = new THREE.Mesh(hullGeo, silver);
  hull.rotation.y = Math.PI / 2;
  hull.position.set(0, hoverY + 0.04, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // Subtle side character lines
  for (const s of [-1, 1] as const) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, bodyLen * 0.62), creaseMat);
    line.position.set(s * (bodyW * 0.46), hoverY + 0.38, 0.05);
    g.add(line);
  }
  // Hood seam
  const hood = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.55, 0.01, 0.012), creaseMat);
  hood.position.set(0, hoverY + 0.55, -bodyLen * 0.12);
  g.add(hood);

  // Thin cyan side accent
  for (const s of [-1, 1] as const) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, bodyLen * 0.55), glowMat('#3ecbff', 1.4));
    belt.position.set(s * (bodyW * 0.48), hoverY + 0.28, 0.05);
    g.add(belt);
  }

  // Chassis plate
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.88, 0.05, bodyLen * 0.75), darkMat);
  chassis.position.set(0, hoverY + 0.02, 0.02);
  g.add(chassis);

  // Two compact rear cyan thrusters only
  compactThruster(g, -0.32, hoverY + 0.28, bodyLen * 0.46);
  compactThruster(g, 0.32, hoverY + 0.28, bodyLen * 0.46);

  // Small under-hover glow (not thruster rings)
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW * 0.7, bodyLen * 0.55),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.12, depthWrite: false }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.03;
  g.add(under);

  // Dark glass bubble canopy — avatar readable
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
    physicalGlass('#0c1520', 0.5),
  );
  const cm = canopy.material as THREE.MeshPhysicalMaterial;
  cm.color.set('#0a121c');
  cm.opacity = 0.55;
  cm.transmission = 0.35;
  cm.transparent = true;
  cm.roughness = 0.05;
  cm.metalness = 0.12;
  cm.envMapIntensity = 1.5;
  canopy.position.set(0, hoverY + 0.55, -0.12);
  canopy.scale.set(bodyW * 0.42, 0.48, 0.95);
  g.add(canopy);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.012, 8, 28),
    new THREE.MeshStandardMaterial({ color: dark, metalness: 0.9, roughness: 0.2 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, hoverY + 0.52, -0.12);
  rim.scale.set(bodyW * 0.42, 0.95, 1);
  g.add(rim);

  // Cabin
  rbox(g, '#1a2230', [0, hoverY + 0.32, -0.05], [bodyW * 0.28, 0.06, 0.35]);
  rbox(g, '#121820', [0, hoverY + 0.45, 0.12], [bodyW * 0.26, 0.18, 0.06]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.025), glowMat('#4de0ff', 1.3));
  dash.position.set(0, hoverY + 0.48, -0.28);
  g.add(dash);

  // Tiny taillights
  for (const s of [-1, 1] as const) {
    rbox(g, '#ff4b6a', [s * bodyW * 0.28, hoverY + 0.3, bodyLen * 0.45], [0.18, 0.04, 0.03], undefined, 0.85);
  }

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
    const w = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 8, 16),
      new THREE.MeshStandardMaterial({ color: '#2a3344', metalness: 0.6, roughness: 0.35 }),
    );
    w.position.set(x, 0.28, z);
    w.rotation.y = Math.PI / 2;
    g.add(w);
  }
  g.userData.pramId = pramId;
  return g;
}
