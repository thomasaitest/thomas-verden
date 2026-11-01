/** Futuristic hover-cars and prams. Each car id has a distinct body; avatar sits under a glass canopy. */
import * as THREE from 'three';
import { CAR_BY_ID, PET_SHOP_BY_ID } from '../logic/catalog.ts';
import { cyl, glassMat, glowMat, mat, rbox, sph } from './kit.ts';

function glassCanopy(
  parent: THREE.Object3D,
  pos: [number, number, number],
  scale: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
): void {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), glassMat('#9ad8ff', 0.42));
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  parent.add(m);
}

/** Avatar root Y while driving – sunk so hips sit on the bench. */
export const CAR_SEAT_Y = 0.62;
export const PRAM_PULL_BACK = 1.45;

function hexMix(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a);
  const B = p(b);
  const m = (i: number) => Math.round(A[i]! + (B[i]! - A[i]!) * t).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}

type CarKind = 'mini' | 'family' | 'pickup' | 'sport' | 'beetle' | 'jeep' | 'van' | 'convertible';

function carKind(carId: string): CarKind {
  if (carId.includes('rosa')) return 'convertible';
  if (carId.includes('gul')) return 'beetle';
  if (carId.includes('bla')) return 'van';
  if (carId.includes('gronn')) return 'jeep';
  if (carId.includes('lilla')) return 'sport';
  return 'family';
}

function thruster(g: THREE.Group, x: number, y: number, z: number, r = 0.55) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.45, 0.06, 8, 20), glowMat('#3ecbff', 1.4));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y, z);
  g.add(ring);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.4, 0.18, 14), glowMat('#7ef0ff', 1.8));
  core.position.set(x, y - 0.05, z);
  g.add(core);
  // soft glow disc under thruster
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.7, 16), new THREE.MeshBasicMaterial({ color: '#5ccfff', transparent: true, opacity: 0.35, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.04, z);
  g.add(disc);
}

export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const color = def?.color ?? '#c8d4e8';
  const dark = hexMix(color, '#1a2230', 0.55);
  const light = hexMix(color, '#ffffff', 0.4);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'mini' || kind === 'beetle' ? 3.8 : kind === 'van' ? 5.2 : kind === 'jeep' ? 4.5 : kind === 'sport' ? 4.3 : 4.5;
  const bodyW = kind === 'van' ? 2.55 : kind === 'jeep' ? 2.5 : kind === 'beetle' ? 2.25 : 2.35;
  const hoverY = 0.42; // chassis floats above ground

  // Sleek lower body
  if (kind === 'beetle') {
    sph(g, color, [0, hoverY + 0.55, 0.05], [bodyW * 1.05, 1.15, bodyLen * 0.95]);
    rbox(g, dark, [0, hoverY + 0.18, 0], [bodyW * 0.95, 0.22, bodyLen * 0.88]);
  } else if (kind === 'van') {
    rbox(g, color, [0, hoverY + 0.95, -0.05], [bodyW, 1.7, bodyLen * 0.9]);
    rbox(g, dark, [0, hoverY + 0.18, 0], [bodyW + 0.06, 0.2, bodyLen]);
  } else if (kind === 'sport') {
    rbox(g, color, [0, hoverY + 0.38, 0.1], [bodyW, 0.45, bodyLen]);
    rbox(g, dark, [0, hoverY + 0.15, 0], [bodyW + 0.1, 0.16, bodyLen - 0.1]);
    // low wedge nose
    rbox(g, light, [0, hoverY + 0.35, bodyLen / 2 - 0.35], [bodyW - 0.4, 0.25, 0.7], [0.25, 0, 0]);
  } else {
    rbox(g, color, [0, hoverY + 0.4, 0], [bodyW, kind === 'jeep' ? 0.65 : 0.5, bodyLen]);
    rbox(g, dark, [0, hoverY + 0.16, 0], [bodyW + 0.08, 0.16, bodyLen - 0.12]);
  }

  // Accent LED strips along sides
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, bodyLen * 0.7), glowMat('#3ecbff', 1.1));
    strip.position.set(s * (bodyW / 2 + 0.02), hoverY + 0.35, 0);
    g.add(strip);
  }

  // Head / tail lights
  for (const s of [-1, 1]) {
    const hz = kind === 'beetle' ? bodyLen * 0.32 : bodyLen / 2 - 0.08;
    sph(g, '#e8f7ff', [s * (bodyW / 2 - 0.5), hoverY + 0.45, hz], [0.32, 0.28, 0.18], undefined, 0.7);
    rbox(g, '#ff4b6a', [s * (bodyW / 2 - 0.55), hoverY + 0.42, -bodyLen / 2 + 0.06], [0.38, 0.16, 0.1], undefined, 0.55);
  }

  // Cabin / glass canopy
  const cabinZ = kind === 'sport' ? -0.1 : kind === 'van' ? 0.5 : 0.05;
  if (kind === 'convertible') {
    // open canopy rim + windshield
    rbox(g, light, [0, hoverY + 0.95, cabinZ + 0.7], [bodyW - 0.6, 0.08, 0.08], [-0.35, 0, 0]);
    for (const s of [-1, 1]) rbox(g, light, [s * (bodyW / 2 - 0.4), hoverY + 0.85, cabinZ + 0.4], [0.08, 0.55, 0.08], [-0.2, 0, 0]);
    glassCanopy(g, [0, hoverY + 1.05, cabinZ + 0.15], [bodyW * 0.85, 0.85, 1.6]);
  } else if (kind === 'beetle') {
    glassCanopy(g, [0, hoverY + 0.95, 0.05], [bodyW * 0.85, 0.95, bodyLen * 0.7]);
  } else if (kind === 'van') {
    rbox(g, light, [0, hoverY + 1.85, cabinZ], [bodyW - 0.3, 0.15, 1.5]);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.45, 1.2, 0.06), glassMat('#9ad8ff', 0.45));
    pane.position.set(0, hoverY + 1.2, cabinZ + 0.85);
    pane.rotation.x = -0.25;
    g.add(pane);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 1.3), glassMat('#9ad8ff', 0.42));
      side.position.set(s * (bodyW / 2 - 0.08), hoverY + 1.15, cabinZ);
      g.add(side);
    }
  } else {
    glassCanopy(g, [0, hoverY + 1.05, cabinZ], [bodyW * 0.9, kind === 'sport' ? 0.75 : 0.95, kind === 'sport' ? 1.7 : 1.9]);
    // thin canopy frame
    rbox(g, dark, [0, hoverY + 1.45, cabinZ], [bodyW - 0.5, 0.08, kind === 'sport' ? 1.5 : 1.7]);
  }

  // Interior seat + wheel
  const seatZ = kind === 'van' ? 0.55 : cabinZ + 0.05;
  rbox(g, '#2a3344', [0, hoverY + 0.55, seatZ], [bodyW - 0.8, 0.18, 0.7]);
  rbox(g, '#1e2633', [0, hoverY + 0.85, seatZ - 0.28], [bodyW - 0.95, 0.5, 0.16]);
  cyl(g, '#3ecbff', [0.28, hoverY + 0.9, seatZ + 0.4], [0.42, 0.05, 0.42], [Math.PI / 2, 0, 0], 0.4);
  // dash glow
  rbox(g, '#15202c', [0, hoverY + 0.72, seatZ + 0.55], [bodyW - 1.0, 0.2, 0.25]);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.04), glowMat('#4de0ff', 1.2));
  dash.position.set(0, hoverY + 0.82, seatZ + 0.68);
  g.add(dash);

  // Four thrusters instead of wheels
  const tz = bodyLen * (kind === 'van' ? 0.28 : 0.3);
  const tw = bodyW / 2 - 0.25;
  for (const [tx, tzv] of [
    [-tw, tz],
    [tw, tz],
    [-tw, -tz],
    [tw, -tz],
  ] as const) {
    thruster(g, tx, hoverY - 0.05, tzv, kind === 'jeep' ? 0.65 : 0.55);
  }

  if (kind === 'sport') {
    rbox(g, dark, [0, hoverY + 0.85, -bodyLen / 2 + 0.35], [bodyW - 0.5, 0.1, 0.4]);
  }
  if (kind === 'jeep') {
    // light bar
    rbox(g, dark, [0, hoverY + 1.55, cabinZ + 0.15], [bodyW - 0.55, 0.1, 0.3]);
    for (const s of [-1, 1]) sph(g, '#e8f7ff', [s * 0.4, hoverY + 1.65, cabinZ + 0.15], [0.2, 0.2, 0.2], undefined, 0.7);
  }
  if (kind === 'van') {
    rbox(g, light, [0, hoverY + 1.05, 0], [bodyW + 0.02, 0.14, bodyLen * 0.65]);
  }

  // Soft under-glow
  const under = new THREE.Mesh(new THREE.PlaneGeometry(bodyW * 0.9, bodyLen * 0.85), new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.18, depthWrite: false }));
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.06;
  g.add(under);

  g.userData.carId = carId;
  g.userData.seatY = CAR_SEAT_Y;
  g.userData.carKind = kind;
  g.userData.hover = true;
  void mat; // keep import used if tree-shaken oddly
  return g;
}

export function buildPram(pramId: string): THREE.Group {
  const color = pramId.includes('gull') ? '#ffd76a' : pramId.includes('blaa') ? '#5cc3f2' : '#ff8fb1';
  const g = new THREE.Group();
  rbox(g, color, [0, 0.95, 0], [1.35, 0.55, 1.85]);
  rbox(g, '#e8f0ff', [0, 1.28, -0.1], [1.15, 0.16, 1.35]);
  rbox(g, color, [0, 1.6, -0.55], [1.25, 0.5, 0.7], [0.5, 0, 0]);
  // hover pads instead of wheels
  for (const [x, z] of [
    [-0.45, 0.55],
    [0.45, 0.55],
    [-0.45, -0.55],
    [0.45, -0.55],
  ] as const) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 12), glowMat('#7ef0ff', 1.0));
    pad.position.set(x, 0.22, z);
    g.add(pad);
  }
  cyl(g, '#8a9bb0', [0, 1.55, 0.95], [0.12, 0.9, 0.12], [0.7, 0, 0]);
  void PET_SHOP_BY_ID;
  g.userData.pramId = pramId;
  return g;
}
