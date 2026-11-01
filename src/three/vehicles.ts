/** Sleek futuristic hover-cars — low, wide, glass canopy, driver seated inside. */
import * as THREE from 'three';
import { CAR_BY_ID } from '../logic/catalog.ts';
import { glassMat, glowMat, mat, rbox, sph, cyl } from './kit.ts';

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

function thruster(g: THREE.Group, x: number, y: number, z: number, r = 0.38) {
  const shell = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.045, 10, 24), mat('#2a3344', 0, { metalness: 0.75, roughness: 0.28 }));
  shell.rotation.x = Math.PI / 2;
  shell.position.set(x, y, z);
  g.add(shell);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.4, 0.12, 16), glowMat('#3ecbff', 1.6));
  core.position.set(x, y - 0.02, z);
  g.add(core);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.95, 20),
    new THREE.MeshBasicMaterial({ color: '#5ccfff', transparent: true, opacity: 0.35, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.04, z);
  g.add(glow);
}

/** Build a sleek low hover-car. Prefer metallic silver/white over candy colours. */
export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const raw = def?.color ?? '#c8d4e8';
  // desaturate candy colors toward metal
  const color = hexMix(raw, '#d0d8e4', 0.45);
  const dark = hexMix(color, '#121820', 0.55);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'van' ? 5.2 : kind === 'sport' ? 4.6 : kind === 'suv' ? 4.8 : 4.5;
  const bodyW = kind === 'van' ? 2.35 : kind === 'sport' ? 2.15 : 2.25;
  const bodyH = kind === 'van' ? 0.95 : kind === 'sport' ? 0.62 : kind === 'suv' ? 0.85 : 0.72;
  const hoverY = 0.42;

  // main hull — low flat rounded body
  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.2, 8, 16),
    mat(color, 0, { metalness: 0.62, roughness: 0.22 }),
  );
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(bodyH * 1.1, bodyW * 0.95, bodyLen * 0.55);
  hull.position.set(0, hoverY + bodyH * 0.55, 0);
  hull.castShadow = true;
  g.add(hull);

  // side skirts / lower chassis
  rbox(g, dark, [0, hoverY + 0.14, 0], [bodyW * 0.98, 0.16, bodyLen * 0.88]);

  // nose / hood panel
  rbox(g, color, [0, hoverY + bodyH * 0.7, bodyLen * 0.22], [bodyW * 0.85, bodyH * 0.35, bodyLen * 0.35]);

  // LED strips
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, bodyLen * 0.7), glowMat('#3ecbff', 1.1));
    strip.position.set(s * (bodyW / 2 + 0.02), hoverY + 0.28, 0);
    g.add(strip);
  }
  // headlights
  for (const s of [-1, 1]) {
    sph(g, '#e8f7ff', [s * bodyW * 0.32, hoverY + 0.35, bodyLen * 0.42], [0.22, 0.16, 0.1], undefined, 0.9);
    rbox(g, '#ff4b6a', [s * bodyW * 0.28, hoverY + 0.32, -bodyLen * 0.42], [0.28, 0.1, 0.06], undefined, 0.55);
  }

  // glass canopy — large enough to show seated driver
  const canopyY = hoverY + bodyH + 0.35;
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    glassMat('#8ec8e0', 0.22),
  );
  canopy.position.set(0, canopyY, kind === 'van' ? 0.25 : 0.05);
  canopy.scale.set(bodyW * 0.95, kind === 'convertible' ? 0.75 : 1.05, kind === 'sport' ? 1.55 : 1.7);
  canopy.castShadow = false;
  g.add(canopy);

  // canopy rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 8, 32), mat(dark, 0, { metalness: 0.7, roughness: 0.3 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, canopyY - 0.08, kind === 'van' ? 0.25 : 0.05);
  rim.scale.set(bodyW * 0.85, kind === 'sport' ? 1.35 : 1.5, 1);
  g.add(rim);

  // interior seat (visible through canopy)
  const seatZ = 0.05;
  rbox(g, '#1a2230', [0, hoverY + 0.38, seatZ], [bodyW * 0.5, 0.1, 0.5]);
  rbox(g, '#121820', [0, hoverY + 0.58, seatZ - 0.18], [bodyW * 0.48, 0.32, 0.1]);
  rbox(g, '#0e141c', [0, hoverY + 0.5, seatZ + 0.32], [bodyW * 0.45, 0.12, 0.18]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.03), glowMat('#4de0ff', 1.2));
  dash.position.set(0, hoverY + 0.58, seatZ + 0.4);
  g.add(dash);

  // thrusters
  const tz = bodyLen * 0.26;
  const tw = bodyW * 0.3;
  for (const [tx, tzv] of [
    [-tw, tz],
    [tw, tz],
    [-tw, -tz],
    [tw, -tz],
  ] as const) {
    thruster(g, tx, hoverY - 0.02, tzv, kind === 'suv' ? 0.42 : 0.36);
  }

  if (kind === 'sport') {
    rbox(g, dark, [0, hoverY + bodyH * 0.9, -bodyLen * 0.32], [bodyW * 0.65, 0.06, 0.35]);
  }

  // under-glow plane
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW * 0.9, bodyLen * 0.75),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.2, depthWrite: false }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.05;
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
