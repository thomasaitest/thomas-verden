/** Sleek futuristic hover-cars — concept silhouette: bubble canopy, fenders, 4 hover pods. */
import * as THREE from 'three';
import { CAR_BY_ID } from '../logic/catalog.ts';
import { glowMat, rbox } from './kit.ts';
import { physicalGlass } from './pbrTextures.ts';

/** Seat height so GLTF driver (after body drop) sits inside cabin under canopy. */
export const CAR_SEAT_Y = 0.42;
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

/** Hover pod under a fender — dark disc + cyan glow ring. */
function hoverPod(g: THREE.Group, x: number, y: number, z: number) {
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: '#1a2230', metalness: 0.85, roughness: 0.28 }),
  );
  disc.position.set(x, y, z);
  g.add(disc);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.025, 8, 24),
    new THREE.MeshBasicMaterial({ color: '#c8ffff', toneMapped: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y - 0.02, z);
  g.add(ring);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 16),
    new THREE.MeshBasicMaterial({ color: '#7ef0ff', transparent: true, opacity: 0.35, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, y - 0.06, z);
  g.add(glow);
}

/** Concept hover-car: tall bubble canopy, curved fenders, 4 cyan hover pods, chrome panel lines. */
export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const raw = def?.color ?? '#d0d8e4';
  const color = hexMix(raw, '#e8eef4', 0.82);
  const dark = hexMix(color, '#0e141c', 0.78);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'van' ? 4.5 : kind === 'sport' ? 4.15 : 4.3;
  const bodyW = kind === 'sport' ? 1.78 : 1.85;
  const hoverY = 0.28;

  const chrome = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.97,
    roughness: 0.12,
    envMapIntensity: 2.2,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: dark,
    metalness: 0.9,
    roughness: 0.22,
    envMapIntensity: 1.2,
  });
  const crease = new THREE.MeshStandardMaterial({
    color: '#0e141c',
    metalness: 0.7,
    roughness: 0.35,
  });

  // Main body — rounded capsule-ish hull (not flat wedge)
  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(bodyW * 0.38, bodyLen * 0.55, 8, 20),
    chrome,
  );
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 0.55, 0.85);
  hull.position.set(0, hoverY + 0.32, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // Lower belly / chassis
  const belly = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.72, 0.14, bodyLen * 0.78),
    darkMat,
  );
  belly.position.set(0, hoverY + 0.12, 0.02);
  belly.castShadow = true;
  g.add(belly);

  // Nose scoop
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    chrome,
  );
  nose.scale.set(bodyW * 0.55, 0.35, 0.7);
  nose.position.set(0, hoverY + 0.28, -bodyLen * 0.38);
  nose.rotation.x = Math.PI;
  g.add(nose);

  // Rear haunches
  const rear = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    chrome,
  );
  rear.scale.set(bodyW * 0.58, 0.4, 0.55);
  rear.position.set(0, hoverY + 0.3, bodyLen * 0.34);
  g.add(rear);

  // Curved fenders over each hover pod — rear pair slightly slimmer
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const fx = sx * bodyW * 0.42;
    const fz = sz * bodyLen * 0.28;
    const rear = sz > 0;
    const fender = new THREE.Mesh(
      new THREE.TorusGeometry(rear ? 0.28 : 0.32, rear ? 0.08 : 0.1, 10, 20, Math.PI),
      chrome,
    );
    fender.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    fender.rotation.y = sz > 0 ? Math.PI : 0;
    fender.position.set(fx, hoverY + 0.22, fz);
    fender.scale.set(rear ? 0.92 : 1, rear ? 0.78 : 0.85, rear ? 1.0 : 1.1);
    g.add(fender);
    hoverPod(g, fx, hoverY - 0.02, fz);
  }

  // Panel / crease lines
  for (const s of [-1, 1] as const) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, bodyLen * 0.55), crease);
    line.position.set(s * bodyW * 0.38, hoverY + 0.42, 0);
    g.add(line);
  }
  const hoodLine = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.4, 0.012, 0.014), crease);
  hoodLine.position.set(0, hoverY + 0.48, -bodyLen * 0.18);
  g.add(hoodLine);

  // Front headlight strips (cyan/white)
  for (const s of [-1, 1] as const) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.04, 0.06),
      glowMat('#e8f6ff', 2.2),
    );
    hl.position.set(s * bodyW * 0.28, hoverY + 0.3, -bodyLen * 0.46);
    g.add(hl);
  }
  // Thin LED brow
  const brow = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.55, 0.025, 0.03),
    glowMat('#3ecbff', 1.6),
  );
  brow.position.set(0, hoverY + 0.38, -bodyLen * 0.45);
  g.add(brow);

  // Tall rounded bubble canopy (glass dome) — avatar readable
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    physicalGlass('#0c1520', 0.45),
  );
  const cm = canopy.material as THREE.MeshPhysicalMaterial;
  cm.color.set('#081018');
  cm.opacity = 0.48;
  cm.transmission = 0.42;
  cm.transparent = true;
  cm.roughness = 0.04;
  cm.metalness = 0.08;
  cm.envMapIntensity = 1.6;
  canopy.position.set(0, hoverY + 0.55, -0.05);
  canopy.scale.set(bodyW * 0.48, 0.72, 0.85);
  canopy.castShadow = true;
  g.add(canopy);

  // Chrome canopy ring
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.02, 8, 32),
    new THREE.MeshStandardMaterial({ color: '#c8d0d8', metalness: 0.95, roughness: 0.15 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, hoverY + 0.52, -0.05);
  rim.scale.set(bodyW * 0.48, 0.9, 1);
  g.add(rim);

  // Cabin seat + dash
  rbox(g, '#1a2230', [0, hoverY + 0.35, -0.05], [bodyW * 0.32, 0.08, 0.4]);
  rbox(g, '#121820', [0, hoverY + 0.5, 0.15], [bodyW * 0.3, 0.2, 0.06]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.03), glowMat('#4de0ff', 1.4));
  dash.position.set(0, hoverY + 0.52, -0.32);
  g.add(dash);

  // Compact red taillight strips
  for (const s of [-1, 1] as const) {
    rbox(g, '#ff4b6a', [s * bodyW * 0.32, hoverY + 0.42, bodyLen * 0.445], [0.28, 0.045, 0.04], undefined, 1.1);
  }
  // Concept cyan glowing rear thruster rings (bloom targets — emissive > 1)
  for (const s of [-1, 1] as const) {
    const tx = s * bodyW * 0.26;
    const ty = hoverY + 0.26;
    const tz = bodyLen * 0.455;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.028, 10, 28),
      new THREE.MeshBasicMaterial({ color: '#d8ffff', toneMapped: false }),
    );
    ring.position.set(tx, ty, tz);
    g.add(ring);
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 20),
      glowMat('#7ef0ff', 3.2),
    );
    core.position.set(tx, ty, tz + 0.01);
    g.add(core);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 20),
      new THREE.MeshBasicMaterial({ color: '#b8ffff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }),
    );
    halo.position.set(tx, ty, tz + 0.005);
    g.add(halo);
  }
  // Side / rear cyan light strips
  for (const s of [-1, 1] as const) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.03, bodyLen * 0.35),
      glowMat('#3ecbff', 2.4),
    );
    strip.position.set(s * bodyW * 0.4, hoverY + 0.22, bodyLen * 0.05);
    g.add(strip);
  }
  const rearBar = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.55, 0.03, 0.035),
    glowMat('#5af0ff', 2.6),
  );
  rearBar.position.set(0, hoverY + 0.18, bodyLen * 0.46);
  g.add(rearBar);

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
