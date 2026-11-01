import * as THREE from 'three';
import type { PetSpecies } from '../logic/pets.ts';
import { box, cone, cyl, G, part, sph, type V3 } from './kit.ts';

export interface PetRig {
  root: THREE.Group;
  /** Everything that bobs; the root stays on the ground. */
  body: THREE.Group;
  legs: THREE.Object3D[];
  wings: THREE.Object3D[];
  tail: THREE.Object3D | null;
  head: THREE.Object3D;
  /** Height of the back, where a rider sits (at scale 1). */
  seatY: number;
  /** Top of the head, for need bubbles (at scale 1). */
  topY: number;
  biped: boolean;
}

const EYE = '#2b2340';
const BLUSH = '#ff9fb8';

function eyes(head: THREE.Object3D, y: number, z: number, spread: number, size = 0.13) {
  for (const s of [-1, 1]) {
    sph(head, EYE, [s * spread, y, z], [size, size * 1.15, size * 0.7]);
    sph(head, '#ffffff', [s * spread + 0.025, y + 0.035, z + size * 0.3], [size * 0.38, size * 0.38, size * 0.3]);
    sph(head, BLUSH, [s * (spread + 0.09), y - 0.11, z - 0.03], [0.11, 0.06, 0.04]);
  }
}

function leg(parent: THREE.Object3D, color: string, pos: V3, len: number, thick: number, paw?: string): THREE.Object3D {
  const pivot = new THREE.Object3D();
  pivot.position.set(...pos);
  parent.add(pivot);
  cyl(pivot, color, [0, -len / 2, 0], [thick, len, thick]);
  sph(pivot, paw ?? color, [0, -len, 0.02], [thick * 1.15, thick * 0.7, thick * 1.3]);
  return pivot;
}

function wings(parent: THREE.Object3D, color: string, y: number, z: number, span = 0.55, feather = false): THREE.Object3D[] {
  return [-1, 1].map((s) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(s * 0.22, y, z);
    parent.add(pivot);
    if (feather) {
      for (let i = 0; i < 3; i++) sph(pivot, color, [s * (0.18 + i * 0.12), 0.05 - i * 0.04, -i * 0.06], [0.32 - i * 0.05, 0.1, 0.42 - i * 0.08]);
    } else {
      sph(pivot, color, [s * span * 0.5, 0.05, 0], [span, 0.08, 0.45]);
    }
    pivot.userData.side = s;
    return pivot;
  });
}

function quadruped(sp: PetSpecies, rig: Partial<PetRig>, body: THREE.Group) {
  const [c1, c2, c3] = sp.colors;
  const horse = sp.body === 'horse';
  const dragon = sp.body === 'dragon';
  const bunny = sp.body === 'bunny';
  const legLen = horse ? 0.5 : bunny ? 0.22 : 0.3;
  const bodyY = legLen + 0.25;
  // body
  sph(body, c1, [0, bodyY, 0], horse ? [0.62, 0.55, 1.05] : [0.66, 0.58, 0.85]);
  sph(body, c2, [0, bodyY - 0.08, 0.08], horse ? [0.5, 0.42, 0.8] : [0.52, 0.46, 0.62]);
  if (sp.spots) {
    const spots: V3[] = [[0.25, bodyY + 0.12, 0.1], [-0.22, bodyY + 0.15, -0.15], [0.1, bodyY + 0.27, -0.25], [-0.28, bodyY, 0.2]];
    spots.forEach((p) => sph(body, c3, p, [0.2, 0.16, 0.2]));
  }
  // legs
  const lx = 0.2;
  const lz = horse ? 0.32 : 0.24;
  rig.legs = [
    leg(body, c1, [lx, legLen, lz], legLen, 0.17, horse ? c3 : c2),
    leg(body, c1, [-lx, legLen, lz], legLen, 0.17, horse ? c3 : c2),
    leg(body, c1, [lx, legLen, -lz], legLen, bunny ? 0.22 : 0.17, horse ? c3 : c2),
    leg(body, c1, [-lx, legLen, -lz], legLen, bunny ? 0.22 : 0.17, horse ? c3 : c2),
  ];
  // head
  const head = new THREE.Group();
  const headY = horse ? bodyY + 0.55 : bodyY + 0.42;
  const headZ = horse ? 0.52 : 0.38;
  head.position.set(0, headY, headZ);
  body.add(head);
  rig.head = head;
  const hs = horse ? 0.62 : 0.72;
  if (horse) cyl(body, c1, [0, bodyY + 0.3, 0.38], [0.3, 0.5, 0.3], [0.5, 0, 0]);
  sph(head, c1, [0, 0, 0], [hs, hs * 0.92, hs * 0.9]);
  // snout
  if (sp.body === 'pig') {
    cyl(head, c2, [0, -0.06, hs * 0.45], [0.26, 0.12, 0.26], [Math.PI / 2, 0, 0]);
    sph(head, '#b04a6a', [0.05, -0.06, hs * 0.52], [0.04, 0.06, 0.03]);
    sph(head, '#b04a6a', [-0.05, -0.06, hs * 0.52], [0.04, 0.06, 0.03]);
  } else if (horse || dragon) {
    sph(head, c2, [0, -0.1, hs * 0.42], [0.42, 0.32, 0.36]);
    sph(head, EYE, [0.08, -0.06, hs * 0.58], [0.04, 0.04, 0.03]);
    sph(head, EYE, [-0.08, -0.06, hs * 0.58], [0.04, 0.04, 0.03]);
  } else {
    sph(head, c2, [0, -0.11, hs * 0.38], [0.3, 0.22, 0.2]);
    sph(head, sp.body === 'bear' ? '#2b2340' : '#5b3a4a', [0, -0.05, hs * 0.48], [0.1, 0.07, 0.06]);
  }
  eyes(head, 0.04, hs * 0.4, horse ? 0.17 : 0.16, horse ? 0.1 : 0.12);
  // ears
  switch (sp.body) {
    case 'dog':
      for (const s of [-1, 1]) sph(head, c3 === '#2b2b38' ? c1 : c3, [s * 0.32, 0.02, -0.02], [0.14, 0.38, 0.24], [0, 0, s * 0.25]);
      if (sp.spots) sph(head, c3, [0.12, 0.18, 0.18], [0.16, 0.12, 0.1]);
      break;
    case 'cat':
    case 'fox':
      for (const s of [-1, 1]) {
        cone(head, c1, [s * 0.2, 0.32, 0], sp.body === 'fox' ? [0.22, 0.32, 0.14] : [0.2, 0.24, 0.12], [0, 0, s * -0.2]);
        cone(head, BLUSH, [s * 0.2, 0.3, 0.03], [0.1, 0.16, 0.05], [0, 0, s * -0.2]);
      }
      break;
    case 'bear':
      for (const s of [-1, 1]) sph(head, sp.spots ? c3 : c1, [s * 0.26, 0.28, -0.02], [0.2, 0.2, 0.12]);
      if (sp.spots) for (const s of [-1, 1]) sph(head, c3, [s * 0.16, 0.04, hs * 0.38], [0.18, 0.2, 0.06]);
      break;
    case 'pig':
      for (const s of [-1, 1]) cone(head, c1, [s * 0.22, 0.28, 0.05], [0.16, 0.18, 0.1], [0.5, 0, s * -0.35]);
      break;
    case 'bunny':
      for (const s of [-1, 1]) {
        sph(head, c1, [s * 0.13, 0.48, -0.04], [0.14, 0.55, 0.1], [0, 0, s * -0.12]);
        sph(head, c2, [s * 0.13, 0.48, -0.0], [0.07, 0.4, 0.05], [0, 0, s * -0.12]);
      }
      break;
    case 'horse':
    case 'dragon':
      for (const s of [-1, 1]) cone(head, c1, [s * 0.16, 0.3, -0.06], [0.12, 0.2, 0.08], [0, 0, s * -0.2]);
      break;
  }
  if (sp.horn) {
    if (dragon) for (const s of [-1, 1]) cone(head, c3, [s * 0.12, 0.34, -0.12], [0.08, 0.28, 0.08], [-0.5, 0, s * -0.2]);
    else cone(head, '#ffd84d', [0, 0.36, 0.14], [0.09, 0.34, 0.09], [0.35, 0, 0], 0.15);
  }
  if (sp.mane) {
    for (let i = 0; i < 5; i++) sph(body, c3, [0, bodyY + 0.42 + i * 0.06 - (i > 2 ? 0.05 : 0), 0.25 + i * 0.07], [0.12, 0.2, 0.16]);
    sph(head, c3, [0, 0.3, 0.05], [0.18, 0.12, 0.2]);
  }
  // tail
  const tail = new THREE.Object3D();
  tail.position.set(0, bodyY + 0.12, horse ? -0.52 : -0.4);
  body.add(tail);
  rig.tail = tail;
  if (sp.body === 'fox') {
    sph(tail, c1, [0, 0.12, -0.2], [0.3, 0.3, 0.55], [0.6, 0, 0]);
    sph(tail, c2, [0, 0.3, -0.42], [0.2, 0.2, 0.2]);
  } else if (bunny || sp.body === 'bear') sph(tail, c2, [0, 0, -0.04], [0.2, 0.2, 0.2]);
  else if (sp.body === 'pig') part(tail, G.torus(), c1, [0, 0.02, -0.04], [0.12, 0.12, 0.12], [0, Math.PI / 2, 0]);
  else if (horse) cone(tail, c3, [0, -0.2, -0.1], [0.18, 0.5, 0.18], [2.6, 0, 0]);
  else if (dragon) {
    cone(tail, c1, [0, -0.05, -0.3], [0.2, 0.7, 0.2], [-1.9, 0, 0]);
    cone(tail, c3, [0, -0.2, -0.66], [0.14, 0.18, 0.06], [-1.9, 0, 0]);
  } else cone(tail, c1, [0, 0.14, -0.08], [0.1, 0.38, 0.1], [-0.6, 0, 0]);
  if (dragon) for (let i = 0; i < 4; i++) cone(body, c3, [0, bodyY + 0.3 - i * 0.02, 0.18 - i * 0.18], [0.1, 0.18, 0.1]);
  if (sp.wings) rig.wings = wings(body, dragon ? c3 : c2, bodyY + 0.22, 0, dragon ? 0.75 : 0.6, !dragon);
  rig.seatY = bodyY + 0.28;
  rig.topY = headY + (bunny ? 0.85 : 0.5);
}

function bird(sp: PetSpecies, rig: Partial<PetRig>, body: THREE.Group) {
  const [c1, c2, c3] = sp.colors;
  const penguin = sp.body === 'penguin';
  const y = 0.62;
  sph(body, c1, [0, y, 0], penguin ? [0.8, 1.0, 0.75] : [0.9, 0.9, 0.85]);
  sph(body, c2, [0, y - 0.08, 0.16], penguin ? [0.6, 0.78, 0.5] : [0.62, 0.6, 0.6]);
  const head = new THREE.Group();
  head.position.set(0, y + 0.18, 0.16);
  body.add(head);
  rig.head = head;
  eyes(head, 0.12, 0.3, 0.16, 0.12);
  cone(head, c3 === '#2b2b38' ? '#ffb02e' : c3, [0, 0.0, 0.42], [0.14, 0.2, 0.14], [Math.PI / 2, 0, 0]);
  if (sp.id === 'ugle') for (const s of [-1, 1]) cone(head, c1, [s * 0.24, 0.44, -0.05], [0.12, 0.22, 0.1], [0, 0, s * -0.3]);
  else if (!penguin) sph(head, c3, [0, 0.48, -0.05], [0.1, 0.2, 0.18], [-0.4, 0, 0]);
  rig.legs = [-1, 1].map((s) => leg(body, '#ffb02e', [s * 0.16, 0.22, 0.02], 0.2, 0.07, '#ffb02e'));
  rig.wings = penguin ? wings(body, c1, y + 0.05, -0.02, 0.35) : wings(body, c1, y + 0.08, -0.04, 0.5, true);
  const tail = new THREE.Object3D();
  tail.position.set(0, y - 0.05, -0.42);
  body.add(tail);
  if (sp.id === 'fenix' || sp.id === 'papegoye') for (const s of [-1, 0, 1]) cone(tail, s ? c3 : c2, [s * 0.1, -0.05, -0.2], [0.1, 0.55, 0.06], [-2.0, s * 0.3, 0]);
  else cone(tail, c1, [0, 0, -0.06], [0.24, 0.24, 0.1], [-1.9, 0, 0]);
  rig.tail = tail;
  rig.seatY = y + 0.45;
  rig.topY = y + 0.8;
  rig.biped = true;
}

function dino(sp: PetSpecies, rig: Partial<PetRig>, body: THREE.Group) {
  const [c1, c2, c3] = sp.colors;
  sph(body, c1, [0, 0.72, 0], [0.75, 0.85, 0.85], [-0.3, 0, 0]);
  sph(body, c2, [0, 0.66, 0.15], [0.55, 0.68, 0.6], [-0.3, 0, 0]);
  if (sp.spots) [[0.25, 0.85, -0.1], [-0.25, 0.8, -0.05], [0.0, 1.05, -0.2]].forEach((p) => sph(body, c3, p as V3, [0.18, 0.18, 0.18]));
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0.25);
  body.add(head);
  rig.head = head;
  sph(head, c1, [0, 0, 0.05], [0.72, 0.62, 0.8]);
  sph(head, c2, [0, -0.16, 0.32], [0.5, 0.2, 0.36]);
  for (let i = -2; i <= 2; i++) cone(head, '#ffffff', [i * 0.07, -0.08, 0.46], [0.05, 0.08, 0.05], [Math.PI, 0, 0]);
  eyes(head, 0.08, 0.36, 0.18, 0.11);
  for (const s of [-1, 1]) cyl(body, c1, [s * 0.32, 0.85, 0.32], [0.08, 0.22, 0.08], [1.1, 0, 0]);
  rig.legs = [-1, 1].map((s) => leg(body, c1, [s * 0.24, 0.45, -0.05], 0.4, 0.24, c3));
  for (let i = 0; i < 4; i++) cone(body, c3, [0, 1.12 - i * 0.12, -0.2 - i * 0.1], [0.1, 0.16, 0.1], [-0.5, 0, 0]);
  const tail = new THREE.Object3D();
  tail.position.set(0, 0.6, -0.35);
  body.add(tail);
  cone(tail, c1, [0, -0.06, -0.35], [0.36, 0.85, 0.36], [-1.75, 0, 0]);
  rig.tail = tail;
  rig.seatY = 1.05;
  rig.topY = 1.7;
  rig.biped = true;
}

function turtle(sp: PetSpecies, rig: Partial<PetRig>, body: THREE.Group) {
  const [c1, c2, c3] = sp.colors;
  const shell = sph(body, c2, [0, 0.32, 0], [0.9, 0.62, 1.0]);
  shell.scale.y = 0.62;
  [[0, 0.6, 0], [0.22, 0.5, 0.2], [-0.22, 0.5, 0.2], [0.22, 0.5, -0.2], [-0.22, 0.5, -0.2]].forEach((p) => sph(body, c3, p as V3, [0.22, 0.1, 0.22]));
  cyl(body, c1, [0, 0.18, 0], [0.92, 0.1, 1.0]);
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.55);
  body.add(head);
  rig.head = head;
  sph(head, c1, [0, 0, 0], [0.5, 0.46, 0.5]);
  eyes(head, 0.06, 0.2, 0.12, 0.1);
  rig.legs = [[0.32, 0.25, 0.3], [-0.32, 0.25, 0.3], [0.32, 0.25, -0.3], [-0.32, 0.25, -0.3]].map((p) => leg(body, c1, p as V3, 0.18, 0.18));
  const tail = new THREE.Object3D();
  tail.position.set(0, 0.22, -0.5);
  body.add(tail);
  cone(tail, c1, [0, 0, -0.06], [0.1, 0.18, 0.1], [-1.6, 0, 0]);
  rig.tail = tail;
  rig.seatY = 0.6;
  rig.topY = 0.9;
}

function bug(sp: PetSpecies, rig: Partial<PetRig>, body: THREE.Group) {
  const [c1, c2] = sp.colors;
  const bee = sp.id === 'bie';
  sph(body, c1, [0, 0.45, -0.05], [0.8, 0.66, 0.9]);
  if (bee) for (const z of [-0.2, 0.08]) cyl(body, c2, [0, 0.45, z], [0.8, 0.12, 0.8], [Math.PI / 2, 0, 0]).scale.set(0.72, 0.1, 0.62);
  if (sp.spots && !bee) {
    box(body, c2, [0, 0.79, -0.05], [0.03, 0.02, 0.85]);
    [[0.2, 0.7, 0.1], [-0.2, 0.7, 0.1], [0.22, 0.65, -0.25], [-0.22, 0.65, -0.25]].forEach((p) => sph(body, c2, p as V3, [0.16, 0.08, 0.16]));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.42);
  body.add(head);
  rig.head = head;
  sph(head, bee ? c1 : '#2b2b38', [0, 0, 0], [0.5, 0.46, 0.44]);
  eyes(head, 0.04, 0.18, 0.12, 0.1);
  for (const s of [-1, 1]) {
    cyl(head, '#2b2b38', [s * 0.1, 0.3, 0.02], [0.03, 0.3, 0.03], [0.3, 0, s * -0.4]);
    sph(head, bee ? c2 : c1, [s * 0.16, 0.44, 0.06], [0.08, 0.08, 0.08]);
  }
  rig.legs = [[0.25, 0.22, 0.15], [-0.25, 0.22, 0.15], [0.25, 0.22, -0.2], [-0.25, 0.22, -0.2]].map((p) => leg(body, '#2b2b38', p as V3, 0.18, 0.06));
  rig.wings = wings(body, '#e9f6ff', 0.75, -0.08, 0.5);
  rig.tail = null;
  if (bee) cone(body, '#2b2b38', [0, 0.42, -0.52], [0.08, 0.14, 0.08], [-Math.PI / 2, 0, 0]);
  rig.seatY = 0.8;
  rig.topY = 1.05;
}

export function buildPet(sp: PetSpecies): PetRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const rig: Partial<PetRig> = { root, body, legs: [], wings: [], tail: null, biped: false };
  if (sp.body === 'bird' || sp.body === 'penguin') bird(sp, rig, body);
  else if (sp.body === 'dino') dino(sp, rig, body);
  else if (sp.body === 'turtle') turtle(sp, rig, body);
  else if (sp.body === 'bug') bug(sp, rig, body);
  else quadruped(sp, rig, body);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return rig as PetRig;
}

export type PetPose = 'idle' | 'walk' | 'sleep' | 'fly' | 'held' | 'happy' | 'sick';

/** Animate a pet. `t` is seconds, `speed` 0–1 walking speed. */
export function animatePet(rig: PetRig, t: number, pose: PetPose, speed = 0): void {
  const walk = pose === 'walk' ? Math.min(1, speed) : 0;
  const swing = Math.sin(t * 12) * 0.7 * walk;
  rig.legs.forEach((l, i) => {
    const phase = rig.biped ? (i % 2 ? 1 : -1) : i === 0 || i === 3 ? 1 : -1;
    l.rotation.x = pose === 'sleep' ? 1.3 : pose === 'fly' ? 0.6 : swing * phase;
  });
  const flap = pose === 'fly' ? Math.sin(t * 14) * 0.8 : Math.sin(t * 3) * 0.1;
  rig.wings.forEach((w) => (w.rotation.z = (w.userData.side as number) * (0.2 + flap)));
  if (rig.tail) rig.tail.rotation.y = Math.sin(t * (pose === 'happy' ? 18 : 6)) * (pose === 'sleep' ? 0.05 : 0.4);
  let y = 0;
  let tilt = 0;
  if (pose === 'walk') y = Math.abs(Math.sin(t * 12)) * 0.08 * walk;
  else if (pose === 'idle') y = Math.sin(t * 2.5) * 0.02;
  else if (pose === 'happy') y = Math.abs(Math.sin(t * 7)) * 0.3;
  else if (pose === 'sleep') {
    y = -0.12;
    tilt = 0;
  } else if (pose === 'sick') {
    y = -0.05;
    rig.body.rotation.z = Math.sin(t * 30) * 0.03;
  }
  if (pose !== 'sick') rig.body.rotation.z = 0;
  rig.body.position.y = y;
  rig.body.rotation.x = tilt;
  rig.head.rotation.x = pose === 'sleep' ? 0.35 : pose === 'sick' ? 0.25 : Math.sin(t * 1.7) * 0.06;
  rig.head.rotation.y = pose === 'idle' ? Math.sin(t * 0.7) * 0.25 : 0;
}
