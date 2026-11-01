/** Futuristic hover-cars with curved bodies and glass canopies. Driver sits inside. */
import * as THREE from 'three';
import { CAR_BY_ID, PET_SHOP_BY_ID } from '../logic/catalog.ts';
import { cyl, G, glassMat, glowMat, mat, rbox, sph } from './kit.ts';

/** Avatar holder Y while driving – hips on the seat under the canopy. */
export const CAR_SEAT_Y = 0.32;
export const CAR_AVATAR_SCALE = 0.38;
export const PRAM_PULL_BACK = 1.45;

function hexMix(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a);
  const B = p(b);
  const m = (i: number) => Math.round(A[i]! + (B[i]! - A[i]!) * t).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}

type CarKind = 'convertible' | 'beetle' | 'van' | 'jeep' | 'sport' | 'family';

function carKind(carId: string): CarKind {
  if (carId.includes('rosa')) return 'convertible';
  if (carId.includes('gul')) return 'beetle';
  if (carId.includes('bla')) return 'van';
  if (carId.includes('gronn')) return 'jeep';
  if (carId.includes('lilla')) return 'sport';
  return 'family';
}


function thruster(g: THREE.Group, x: number, y: number, z: number, r = 0.42) {
  const shell = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.05, 10, 24), mat('#2a3344', 0, { metalness: 0.7, roughness: 0.3 }));
  shell.rotation.x = Math.PI / 2;
  shell.position.set(x, y, z);
  g.add(shell);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.42, 0.14, 16), glowMat('#3ecbff', 2.0));
  core.position.set(x, y - 0.02, z);
  g.add(core);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.9, 20),
    new THREE.MeshBasicMaterial({ color: '#5ccfff', transparent: true, opacity: 0.4, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.05, z);
  g.add(glow);
}

export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const color = def?.color ?? '#c8d4e8';
  const dark = hexMix(color, '#121820', 0.55);
  const light = hexMix(color, '#ffffff', 0.35);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'van' ? 5.0 : kind === 'sport' ? 4.6 : kind === 'beetle' ? 4.0 : 4.5;
  const bodyW = kind === 'van' ? 2.35 : kind === 'beetle' ? 2.1 : 2.2;
  const hoverY = 0.42;
  const bodyH = kind === 'van' ? 1.35 : kind === 'sport' ? 0.95 : kind === 'convertible' ? 0.8 : 1.1;

  // Sleek elongated hover body (rounded box + nose/tail caps) — reads as a car, not an egg
  const bodyMat = mat(color, 0, { metalness: 0.55, roughness: 0.22 });
  const hull = new THREE.Mesh(G.rbox(0.35), bodyMat);
  hull.position.set(0, hoverY + bodyH * 0.45, 0);
  hull.scale.set(bodyW, bodyH, bodyLen * 0.72);
  hull.castShadow = true;
  g.add(hull);
  // nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), bodyMat);
  nose.position.set(0, hoverY + bodyH * 0.42, bodyLen * 0.32);
  nose.scale.set(bodyW * 0.95, bodyH * 0.9, bodyLen * 0.28);
  nose.castShadow = true;
  g.add(nose);
  // tail
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), bodyMat);
  tail.position.set(0, hoverY + bodyH * 0.4, -bodyLen * 0.3);
  tail.scale.set(bodyW * 0.9, bodyH * 0.85, bodyLen * 0.22);
  tail.castShadow = true;
  g.add(tail);

  // Lower belly / dark chassis
  rbox(g, dark, [0, hoverY + 0.12, 0], [bodyW * 0.92, 0.14, bodyLen * 0.9]);

  // Side LED strips
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, bodyLen * 0.65), glowMat('#3ecbff', 1.3));
    strip.position.set(s * (bodyW / 2 + 0.02), hoverY + 0.32, 0);
    g.add(strip);
  }

  // Lights
  for (const s of [-1, 1]) {
    sph(g, '#e8f7ff', [s * (bodyW * 0.32), hoverY + 0.38, bodyLen * 0.42], [0.28, 0.22, 0.14], undefined, 0.85);
    rbox(g, '#ff4b6a', [s * (bodyW * 0.3), hoverY + 0.36, -bodyLen * 0.44], [0.32, 0.12, 0.08], undefined, 0.65);
  }

  // Glass canopy – large enough to cover seated avatar
  const canopyY = hoverY + bodyH * 0.55 + (kind === 'van' ? 0.55 : kind === 'convertible' ? 0.35 : 0.45);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    glassMat('#6aa8c8', 0.2),
  );
  canopy.position.set(0, canopyY, kind === 'van' ? 0.35 : 0.05);
  canopy.scale.set(bodyW * 1.02, kind === 'convertible' ? 1.05 : 1.35, kind === 'sport' ? 1.65 : kind === 'van' ? 1.5 : 1.85);
  canopy.castShadow = false;
  g.add(canopy);

  // Thin canopy frame rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.025, 8, 32), mat(dark, 0, { metalness: 0.6, roughness: 0.35 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, canopyY - 0.05, kind === 'van' ? 0.35 : 0.05);
  rim.scale.set(bodyW * 0.9, kind === 'sport' ? 1.4 : 1.55, 1);
  g.add(rim);

  // Interior seat (hidden under canopy)
  const seatZ = kind === 'van' ? 0.4 : 0.05;
  rbox(g, '#1a2230', [0, hoverY + 0.4, seatZ], [bodyW * 0.55, 0.12, 0.55]);
  rbox(g, '#121820', [0, hoverY + 0.62, seatZ - 0.2], [bodyW * 0.5, 0.35, 0.12]);
  // dash
  rbox(g, '#0e141c', [0, hoverY + 0.55, seatZ + 0.35], [bodyW * 0.5, 0.14, 0.2]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.03), glowMat('#4de0ff', 1.3));
  dash.position.set(0, hoverY + 0.62, seatZ + 0.45);
  g.add(dash);
  cyl(g, '#2a3344', [0.22, hoverY + 0.68, seatZ + 0.28], [0.32, 0.04, 0.32], [Math.PI / 2, 0, 0]);

  // Thrusters
  const tz = bodyLen * 0.28;
  const tw = bodyW * 0.32;
  for (const [tx, tzv] of [
    [-tw, tz],
    [tw, tz],
    [-tw, -tz],
    [tw, -tz],
  ] as const) {
    thruster(g, tx, hoverY - 0.02, tzv, kind === 'jeep' ? 0.5 : 0.4);
  }

  if (kind === 'sport') {
    rbox(g, dark, [0, hoverY + 0.7, -bodyLen * 0.35], [bodyW * 0.7, 0.08, 0.35]);
  }
  if (kind === 'jeep') {
    rbox(g, dark, [0, canopyY + 0.35, 0.1], [bodyW * 0.7, 0.08, 0.28]);
    for (const s of [-1, 1]) sph(g, '#e8f7ff', [s * 0.35, canopyY + 0.42, 0.1], [0.16, 0.16, 0.16], undefined, 0.7);
  }

  // Soft under-glow
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyW * 0.85, bodyLen * 0.8),
    new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.22, depthWrite: false }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.06;
  g.add(under);

  g.userData.carId = carId;
  g.userData.seatY = CAR_SEAT_Y;
  g.userData.carKind = kind;
  g.userData.hover = true;
  void light;
  return g;
}

export function buildPram(pramId: string): THREE.Group {
  const color = pramId.includes('gull') ? '#ffd76a' : pramId.includes('blaa') ? '#5cc3f2' : '#a8b8d0';
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
  void PET_SHOP_BY_ID;
  g.userData.pramId = pramId;
  return g;
}
