import { HOUSE_BY_STYLE, type HouseStyle } from './catalog.ts';
import { blocked, movePlayer, resolve, type Colliders, type RectCollider } from './collision.ts';

/**
 * Floor plans for the houses: rooms with walls and door gaps on two floors joined by a staircase.
 * Pure data and maths (no three.js) so walking, stairs and furniture placement can be tested.
 * Coordinates are house-local metres: (0,0) is the middle, the front door is on the +z side.
 *
 * Every HouseStyle has a clearly distinct plan: staircase side/width, room count, wall layout and names.
 */
export const FLOORS = 2;
/** Height between two floors. */
export const FLOOR_H = 6.6;
export const WALL_T = 0.4;
export const DOOR_W = 2.8;
/** Legacy default corner-room size (tests / older callers). */
export const ROOM = 7;
const MARGIN = 0.4;

export interface Room {
  id: string;
  name: string;
  floor: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
export interface Stairs {
  x0: number;
  x1: number;
  /** The top end (rises towards -z) and the bottom end. */
  zTop: number;
  zBottom: number;
}
export interface HouseLayout {
  style: HouseStyle;
  w: number;
  d: number;
  stairs: Stairs;
  rooms: Room[];
  /** Wall pieces per floor (axis aligned rectangles; door gaps are simply missing). */
  walls: RectCollider[][];
  /** Where the front door is (floor 0). */
  door: { x: number; z: number };
}

export const stairsMidX = (s: Stairs): number => (s.x0 + s.x1) / 2;

function wallX(out: RectCollider[], x: number, z0: number, z1: number, gaps: number[]): void {
  const cuts = [...gaps].sort((a, b) => a - b).flatMap((g) => [g - DOOR_W / 2, g + DOOR_W / 2]);
  const pts = [z0, ...cuts, z1];
  for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] - pts[i] > 0.01) out.push({ x, z: (pts[i] + pts[i + 1]) / 2, hw: WALL_T / 2, hd: (pts[i + 1] - pts[i]) / 2, rot: 0 });
}
function wallZ(out: RectCollider[], z: number, x0: number, x1: number, gaps: number[]): void {
  const cuts = [...gaps].sort((a, b) => a - b).flatMap((g) => [g - DOOR_W / 2, g + DOOR_W / 2]);
  const pts = [x0, ...cuts, x1];
  for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] - pts[i] > 0.01) out.push({ x: (pts[i] + pts[i + 1]) / 2, z, hw: (pts[i + 1] - pts[i]) / 2, hd: WALL_T / 2, rot: 0 });
}

/** Where the doors from the middle into the back rooms are (z), on both floors. */
export const roomDoorZ = (d: number): number => -d / 2 + 2.6;

const cache = new Map<string, HouseLayout>();

function mkStairs(midX: number, halfW: number, zTop: number, len: number): Stairs {
  return { x0: midX - halfW, x1: midX + halfW, zTop, zBottom: zTop + len };
}

type Built = { stairs: Stairs; rooms: Room[]; walls: [RectCollider[], RectCollider[]]; door: { x: number; z: number } };



/**
 * Design rules for every plan:
 * - Stairs sit in an open corridor strip: no wall crosses [x0,x1]×[zTop,zBottom].
 * - Door gaps are ≥ DOOR_W and land on open floor.
 * - Topologies differ: room count, wall graph, stair corner/side/steepness.
 */

/** Koselig hytte: 3 rooms down (stue+kjøkken / soverom / bad), steep corner ladder left. */
function planHytte(w: number, d: number): Built {
  const bz = -d / 2 + 6;
  // Steep narrow ladder along the left living wall — clear of the back partition (z > bz).
  const stairs = mkStairs(-w / 2 + 1.7, 0.9, bz + 1.8, 6.7);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  // Back: soverom | bad  (gap doors into living; leave left living strip free of walls)
  wallZ(f0, bz, -w / 2 + 4.2, 0, [-w / 4]);
  wallZ(f0, bz, 0, w / 2, [w / 4]);
  wallX(f0, 0, -d / 2, bz, []);
  wallZ(f1, bz, -w / 2 + 4.2, 0, [-w / 4]);
  wallZ(f1, bz, 0, w / 2, [w / 4]);
  wallX(f1, 0, -d / 2, bz, []);
  // Small loft nook upstairs (right of loft only — keeps left stair clear)
  wallX(f1, w / 4, bz + 2.2, d / 2 - 0.8, [bz + 4.0]);
  const rooms: Room[] = [
    { id: 'f0-sove', name: 'Soverom', floor: 0, x0: -w / 2, x1: 0, z0: -d / 2, z1: bz },
    { id: 'f0-bad', name: 'Bad', floor: 0, x0: 0, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f0-stue', name: 'Stue og kjøkken', floor: 0, x0: -w / 2, x1: w / 2, z0: bz, z1: d / 2 },
    { id: 'f1-sove', name: 'Loftsrom', floor: 1, x0: -w / 2, x1: 0, z0: -d / 2, z1: bz },
    { id: 'f1-lek', name: 'Lekerom', floor: 1, x0: 0, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f1-loft', name: 'Loft', floor: 1, x0: -w / 2, x1: w / 2, z0: bz, z1: d / 2 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: 0, z: d / 2 - 1.4 } };
}

/** Rosa villa: entre + side stairs, separate stue & kjøkken, 2 bedrooms + bad. */
function planVilla(w: number, d: number): Built {
  const entreZ = d / 2 - 6;
  const midZ = -d / 2 + 7;
  const kx = 2.0; // kitchen/living split
  // Stairs in the left strip of the entre/stue — open corridor x ∈ [-w/2, -w/2+5]
  const stairs = mkStairs(-w / 2 + 2.5, 1.3, midZ + 0.5, 8.2);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  // Entre ↔ house
  wallZ(f0, entreZ, -w / 2 + 5.2, w / 2, [w / 4]); // gap on right into kitchen; left strip open for stairs
  // Stue | kjøkken
  wallX(f0, kx, midZ, entreZ, [(midZ + entreZ) / 2]);
  // Back rooms
  wallZ(f0, midZ, -w / 2 + 5.2, kx, [-w / 6]);
  wallZ(f0, midZ, kx, w / 2, [w / 3]);
  wallX(f0, -w / 6, -d / 2, midZ, [roomDoorZ(d)]);
  // Upstairs
  wallZ(f1, entreZ, -w / 2 + 5.2, w / 2, [w / 4]);
  wallX(f1, kx, midZ, entreZ, [(midZ + entreZ) / 2]);
  wallZ(f1, midZ, -w / 2 + 5.2, kx, [-w / 6]);
  wallZ(f1, midZ, kx, w / 2, [w / 3]);
  wallX(f1, -w / 6, -d / 2, midZ, [roomDoorZ(d)]);
  wallX(f1, w / 3, entreZ, d / 2, [d / 2 - 2.8]);
  const rooms: Room[] = [
    { id: 'f0-entre', name: 'Entre', floor: 0, x0: -w / 2, x1: w / 2, z0: entreZ, z1: d / 2 },
    { id: 'f0-stue', name: 'Stue', floor: 0, x0: -w / 2, x1: kx, z0: midZ, z1: entreZ },
    { id: 'f0-kjokken', name: 'Kjøkken', floor: 0, x0: kx, x1: w / 2, z0: midZ, z1: entreZ },
    { id: 'f0-master', name: 'Master', floor: 0, x0: -w / 2, x1: -w / 6, z0: -d / 2, z1: midZ },
    { id: 'f0-sove', name: 'Soverom', floor: 0, x0: -w / 6, x1: kx, z0: -d / 2, z1: midZ },
    { id: 'f0-bad', name: 'Bad', floor: 0, x0: kx, x1: w / 2, z0: -d / 2, z1: midZ },
    { id: 'f1-galleri', name: 'Galleri', floor: 1, x0: -w / 2, x1: w / 2, z0: entreZ, z1: d / 2 },
    { id: 'f1-bib', name: 'Bibliotek', floor: 1, x0: -w / 2, x1: kx, z0: midZ, z1: entreZ },
    { id: 'f1-atel', name: 'Atelier', floor: 1, x0: kx, x1: w / 2, z0: midZ, z1: entreZ },
    { id: 'f1-gjest', name: 'Gjesterom', floor: 1, x0: -w / 2, x1: -w / 6, z0: -d / 2, z1: midZ },
    { id: 'f1-barn', name: 'Barnerom', floor: 1, x0: -w / 6, x1: kx, z0: -d / 2, z1: midZ },
    { id: 'f1-ens', name: 'Ensuite', floor: 1, x0: kx, x1: w / 2, z0: -d / 2, z1: midZ },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: -2.0, z: d / 2 - 1.4 } };
}

/** Gårdshus: stor kjøkkenblokk venstre, stue midt, entre høyre, soverom/vask bakerst; trapp i høyre stue-stripe. */
function planGard(w: number, d: number): Built {
  const crossZ = -d / 2 + 8;
  const kX = -w / 2 + 11;
  const eX = w / 2 - 6;
  // Stairs toward the right of the stue strip (near entre), clear corridor
  const stairs = mkStairs(eX - 2.4, 1.3, crossZ + 0.6, 7.8);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  wallZ(f0, crossZ, -w / 2, w / 2, [-w / 3, (kX + eX) / 2, w / 3]);
  wallX(f0, kX, crossZ, d / 2, [crossZ + 3.2]); // kitchen | stue
  wallX(f0, eX, crossZ, d / 2, [d / 2 - 2.5]); // stue | entre
  wallX(f0, 0, -d / 2, crossZ, [roomDoorZ(d)]);
  wallZ(f1, crossZ, -w / 2, w / 2, [-w / 3, (kX + eX) / 2, w / 3]);
  wallX(f1, kX, crossZ, d / 2, [crossZ + 3.2]);
  wallX(f1, eX, crossZ, d / 2, [d / 2 - 2.5]);
  wallX(f1, 0, -d / 2, crossZ, [roomDoorZ(d)]);
  const rooms: Room[] = [
    { id: 'f0-sove', name: 'Soverom', floor: 0, x0: -w / 2, x1: 0, z0: -d / 2, z1: crossZ },
    { id: 'f0-vask', name: 'Vaskerom', floor: 0, x0: 0, x1: w / 2, z0: -d / 2, z1: crossZ },
    { id: 'f0-kjokken', name: 'Kjøkken', floor: 0, x0: -w / 2, x1: kX, z0: crossZ, z1: d / 2 },
    { id: 'f0-stue', name: 'Stue', floor: 0, x0: kX, x1: eX, z0: crossZ, z1: d / 2 },
    { id: 'f0-entre', name: 'Entre', floor: 0, x0: eX, x1: w / 2, z0: crossZ, z1: d / 2 },
    { id: 'f1-barn', name: 'Barnerom', floor: 1, x0: -w / 2, x1: 0, z0: -d / 2, z1: crossZ },
    { id: 'f1-verk', name: 'Verksted', floor: 1, x0: 0, x1: w / 2, z0: -d / 2, z1: crossZ },
    { id: 'f1-forrad', name: 'Forråd', floor: 1, x0: -w / 2, x1: kX, z0: crossZ, z1: d / 2 },
    { id: 'f1-lek', name: 'Lekerom', floor: 1, x0: kX, x1: eX, z0: crossZ, z1: d / 2 },
    { id: 'f1-loft', name: 'Loft', floor: 1, x0: eX, x1: w / 2, z0: crossZ, z1: d / 2 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: (eX + w / 2) / 2, z: d / 2 - 1.4 } };
}

/** Moderne: mostly open, glass wall to kitchen, spiral stair hard left in open stue. */
function planModerne(w: number, d: number): Built {
  const glassX = w / 2 - 7;
  const nookX = -w / 2 + 7.5;
  const nookZ = -d / 2 + 5.8;
  // Spiral-feel stair on the left of the open stue, fully clear of the bedroom nook walls
  const stairs = mkStairs(-w / 2 + 2.3, 1.05, nookZ + 0.5, 8.0);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  // Glass wall (many gaps)
  wallX(f0, glassX, -d / 2 + 1.2, d / 2 - 1.2, [-d / 3, 0, d / 3]);
  // Bedroom nook — only to the RIGHT of the stair corridor
  wallZ(f0, nookZ, nookX, glassX, [nookX + 2.5]);
  wallX(f0, nookX, -d / 2, nookZ, [roomDoorZ(d)]);
  wallX(f1, glassX, -d / 2 + 1.2, d / 2 - 1.2, [-d / 3, d / 3]);
  wallZ(f1, d / 2 - 6.5, -w / 2 + 5, glassX, [-w / 6]);
  wallX(f1, 0, d / 2 - 6.5, d / 2, [d / 2 - 3.0]);
  const rooms: Room[] = [
    { id: 'f0-sove', name: 'Soverom', floor: 0, x0: nookX, x1: glassX, z0: -d / 2, z1: nookZ },
    { id: 'f0-stue', name: 'Åpen stue', floor: 0, x0: -w / 2, x1: glassX, z0: nookZ, z1: d / 2 },
    { id: 'f0-stueb', name: 'Åpen stue', floor: 0, x0: -w / 2, x1: nookX, z0: -d / 2, z1: nookZ },
    { id: 'f0-kjokken', name: 'Kjøkken', floor: 0, x0: glassX, x1: w / 2, z0: -d / 2, z1: d / 2 },
    { id: 'f1-kontor', name: 'Kontor', floor: 1, x0: -w / 2, x1: 0, z0: d / 2 - 6.5, z1: d / 2 },
    { id: 'f1-media', name: 'Mediarom', floor: 1, x0: 0, x1: glassX, z0: d / 2 - 6.5, z1: d / 2 },
    { id: 'f1-galleri', name: 'Galleri', floor: 1, x0: -w / 2, x1: glassX, z0: -d / 2, z1: d / 2 - 6.5 },
    { id: 'f1-kjokken', name: 'Øvre kjøkken', floor: 1, x0: glassX, x1: w / 2, z0: -d / 2, z1: d / 2 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: 0, z: d / 2 - 1.4 } };
}

/** Trehus: staggered rooms + steep ladder in the right mid-band (open strip). */
function planTrehus(w: number, d: number): Built {
  const zA = -d / 2 + 5.5;
  const zB = -d / 2 + 10;
  const xL = -w / 2 + 8;
  const xR = w / 2 - 6.5;
  // Ladder in the gang/stue open area near xR but LEFT of xR wall: corridor (xR-4 .. xR)
  const stairs = mkStairs(xR - 2.2, 0.95, zA + 0.7, 6.7);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  wallZ(f0, zA, -w / 2, xL, [-w / 2 + 4]);
  wallX(f0, xL, -d / 2, zA, []);
  wallZ(f0, zB, -w / 2, xR - 4.5, [-w / 4]); // leave stair strip open (no wall across stairs)
  wallZ(f0, zB, xR, w / 2, [w / 2 - 3]);
  wallX(f0, xR, zA, d / 2, [(zA + d / 2) / 2]);
  wallZ(f1, zA, -w / 2, xL, [-w / 2 + 4]);
  wallX(f1, xL, -d / 2, zA, []);
  wallZ(f1, zB, -w / 2, xR - 4.5, [-w / 4]);
  wallZ(f1, zB, xR, w / 2, [w / 2 - 3]);
  wallX(f1, xR, zA, d / 2, [(zA + d / 2) / 2]);
  const rooms: Room[] = [
    { id: 'f0-sove', name: 'Soverom', floor: 0, x0: -w / 2, x1: xL, z0: -d / 2, z1: zA },
    { id: 'f0-stue', name: 'Stue og kjøkken', floor: 0, x0: -w / 2, x1: xR, z0: zA, z1: zB },
    { id: 'f0-krok', name: 'Krok', floor: 0, x0: xR, x1: w / 2, z0: zA, z1: zB },
    { id: 'f0-bad', name: 'Bad', floor: 0, x0: xR, x1: w / 2, z0: zB, z1: d / 2 },
    { id: 'f0-gang', name: 'Gang', floor: 0, x0: -w / 2, x1: xR, z0: zB, z1: d / 2 },
    { id: 'f1-loft', name: 'Loftsrom', floor: 1, x0: -w / 2, x1: xL, z0: -d / 2, z1: zA },
    { id: 'f1-lek', name: 'Lekerom', floor: 1, x0: -w / 2, x1: xR, z0: zA, z1: zB },
    { id: 'f1-hobby', name: 'Hobbyrom', floor: 1, x0: xR, x1: w / 2, z0: zA, z1: d / 2 },
    { id: 'f1-gjest', name: 'Gjesterom', floor: 1, x0: -w / 2, x1: xR, z0: zB, z1: d / 2 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: -1.2, z: d / 2 - 1.4 } };
}

/** Sjøhus: rooms in a row along z (ship bays); companionway stairs on the starboard strip. */
function planSjohus(w: number, d: number): Built {
  const z1 = -d / 2 + d * 0.28;
  const z2 = -d / 2 + d * 0.5;
  const z3 = -d / 2 + d * 0.72;
  const lane = w / 2 - 4.5; // walls stop before starboard stair lane
  const stairs = mkStairs(w / 2 - 2.2, 1.15, z1 + 0.4, 8.0);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  for (const out of [f0, f1]) {
    // Bulkheads stop before the starboard companionway so stairs stay clear
    wallZ(out, z1, -w / 2, lane, [-w / 5]);
    wallZ(out, z2, -w / 2, lane, [0]);
    wallZ(out, z3, -w / 2, lane, [w / 6]);
  }
  // Port-side cabins upstairs
  wallX(f1, -w / 2 + 5, z1, z3, [(z1 + z3) / 2]);
  const rooms: Room[] = [
    { id: 'f0-lugar', name: 'Lugar', floor: 0, x0: -w / 2, x1: w / 2, z0: -d / 2, z1: z1 },
    { id: 'f0-bad', name: 'Bad', floor: 0, x0: -w / 2, x1: w / 2, z0: z1, z1: z2 },
    { id: 'f0-salong', name: 'Salong', floor: 0, x0: -w / 2, x1: w / 2, z0: z2, z1: z3 },
    { id: 'f0-dekk', name: 'Dekk', floor: 0, x0: -w / 2, x1: w / 2, z0: z3, z1: d / 2 },
    { id: 'f1-kaptein', name: 'Kapteinslugar', floor: 1, x0: -w / 2, x1: w / 2, z0: -d / 2, z1: z1 },
    { id: 'f1-fiske', name: 'Fiskebu', floor: 1, x0: -w / 2 + 5, x1: w / 2, z0: z1, z1: z2 },
    { id: 'f1-bro', name: 'Bro', floor: 1, x0: -w / 2 + 5, x1: w / 2, z0: z2, z1: z3 },
    { id: 'f1-utsikt', name: 'Utsikt', floor: 1, x0: -w / 2, x1: w / 2, z0: z3, z1: d / 2 },
    { id: 'f1-korridor', name: 'Korridor', floor: 1, x0: -w / 2, x1: -w / 2 + 5, z0: z1, z1: z3 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: 1.2, z: d / 2 - 1.4 } };
}

/** Eventyrslott: festsal midt, fløyer, tronsal/prinsesse bakerst, tårntrapp i østfløy. */
function planSlott(w: number, d: number): Built {
  const hallZ0 = -d / 2 + 7.5;
  const hallZ1 = d / 2 - 7.5;
  const wing = 8.5;
  // Tower stair entirely inside the east wing (open strip), not crossing festsal walls
  const stairs = mkStairs(w / 2 - wing / 2, 1.2, hallZ0 + 0.5, 9.2);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  // Festsal — east wall has TWO gaps so wing↔hall works; stair stays in wing so doesn't need to cross
  wallZ(f0, hallZ0, -w / 2 + wing, w / 2 - wing, [0]);
  wallZ(f0, hallZ1, -w / 2 + wing, w / 2 - wing, [0]);
  wallX(f0, -w / 2 + wing, hallZ0, hallZ1, [(hallZ0 + hallZ1) / 2]);
  wallX(f0, w / 2 - wing, hallZ0, hallZ1, [hallZ0 + 2.5, hallZ1 - 2.5]); // gaps away from stair mid-z
  wallX(f0, 0, hallZ1, d / 2, [d / 2 - 3.2]);
  wallX(f0, 0, -d / 2, hallZ0, [roomDoorZ(d)]);
  wallZ(f0, 0, -w / 2, -w / 2 + wing, [-w / 2 + wing / 2]);
  // East wing: only a light mid-split that does NOT cross the stair x (stair mid = w/2 - wing/2)
  // Skip wallZ across east wing centre — keeps stair clear the full length
  wallZ(f1, hallZ0, -w / 2 + wing, w / 2 - wing, [0]);
  wallZ(f1, hallZ1, -w / 2 + wing, w / 2 - wing, [0]);
  wallX(f1, -w / 2 + wing, hallZ0, hallZ1, [(hallZ0 + hallZ1) / 2]);
  wallX(f1, w / 2 - wing, hallZ0, hallZ1, [hallZ0 + 2.5, hallZ1 - 2.5]);
  wallX(f1, 0, hallZ1, d / 2, [d / 2 - 3.2]);
  wallX(f1, 0, -d / 2, hallZ0, [roomDoorZ(d)]);
  wallZ(f1, 0, -w / 2, -w / 2 + wing, [-w / 2 + wing / 2]);
  const rooms: Room[] = [
    { id: 'f0-fest', name: 'Festsal', floor: 0, x0: -w / 2 + wing, x1: w / 2 - wing, z0: hallZ0, z1: hallZ1 },
    { id: 'f0-vest', name: 'Vestibyle', floor: 0, x0: -w / 2 + wing, x1: w / 2 - wing, z0: hallZ1, z1: d / 2 },
    { id: 'f0-tron', name: 'Tronsal', floor: 0, x0: -w / 2 + wing, x1: 0, z0: -d / 2, z1: hallZ0 },
    { id: 'f0-prins', name: 'Prinsesserom', floor: 0, x0: 0, x1: w / 2 - wing, z0: -d / 2, z1: hallZ0 },
    { id: 'f0-vestfloy', name: 'Vestfløy', floor: 0, x0: -w / 2, x1: -w / 2 + wing, z0: -d / 2, z1: d / 2 },
    { id: 'f0-ostfloy', name: 'Østfløy', floor: 0, x0: w / 2 - wing, x1: w / 2, z0: -d / 2, z1: d / 2 },
    { id: 'f1-ball', name: 'Ballsal', floor: 1, x0: -w / 2 + wing, x1: w / 2 - wing, z0: hallZ0, z1: hallZ1 },
    { id: 'f1-galleri', name: 'Galleri', floor: 1, x0: -w / 2 + wing, x1: w / 2 - wing, z0: hallZ1, z1: d / 2 },
    { id: 'f1-konge', name: 'Kongesuite', floor: 1, x0: -w / 2 + wing, x1: 0, z0: -d / 2, z1: hallZ0 },
    { id: 'f1-skatt', name: 'Skattkammer', floor: 1, x0: 0, x1: w / 2 - wing, z0: -d / 2, z1: hallZ0 },
    { id: 'f1-vesttarn', name: 'Vesttårn', floor: 1, x0: -w / 2, x1: -w / 2 + wing, z0: -d / 2, z1: d / 2 },
    { id: 'f1-osttarn', name: 'Østtårn', floor: 1, x0: w / 2 - wing, x1: w / 2, z0: -d / 2, z1: d / 2 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: 3.2, z: d / 2 - 1.4 } };
}

function buildPlan(style: HouseStyle, w: number, d: number): Built {
  switch (style) {
    case 'villa':
      return planVilla(w, d);
    case 'gard':
      return planGard(w, d);
    case 'moderne':
      return planModerne(w, d);
    case 'trehus':
      return planTrehus(w, d);
    case 'sjohus':
      return planSjohus(w, d);
    case 'slott':
      return planSlott(w, d);
    default:
      return planHytte(w, d);
  }
}

export function houseLayout(style: HouseStyle): HouseLayout {
  const hit = cache.get(style);
  if (hit) return hit;
  const info = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  const { w, d } = info;
  const built = buildPlan(style, w, d);
  // Keep stairs inside the footprint with clear step-off room.
  const s = built.stairs;
  if (s.x0 < -w / 2 + 0.5 || s.x1 > w / 2 - 0.5) throw new Error(`stairs out of width for ${style}`);
  if (s.zTop < -d / 2 + 1.5 || s.zBottom > d / 2 - 1.5) throw new Error(`stairs out of depth for ${style}`);
  const layout: HouseLayout = { style, w, d, stairs: s, rooms: built.rooms, walls: built.walls, door: built.door };
  cache.set(style, layout);
  return layout;
}

/** Test helper: drop cached plans (vitest module reuse). */
export function clearLayoutCache(): void {
  cache.clear();
}

export const floorOfY = (y: number): number => (y > FLOOR_H * 0.5 ? 1 : 0);

const stairsRect = (s: Stairs): RectCollider => {
  const mx = stairsMidX(s);
  return { x: mx, z: (s.zTop + s.zBottom) / 2, hw: (s.x1 - s.x0) / 2, hd: (s.zBottom - s.zTop) / 2, rot: 0 };
};
export const onStairs = (s: Stairs, x: number, z: number): boolean => x > s.x0 && x < s.x1 && z > s.zTop && z < s.zBottom;

/** Height of the walkable ground at a spot, for a walker currently on `floor`. The stairs are a ramp. */
export function groundHeight(l: HouseLayout, x: number, z: number, floor: number): number {
  const s = l.stairs;
  if (onStairs(s, x, z)) return Math.max(0, Math.min(1, (s.zBottom - z) / (s.zBottom - s.zTop))) * FLOOR_H;
  return floor >= 1 ? FLOOR_H : 0;
}

/** The staircase's side rails (both floors) and a cap at the end you can't enter from this floor. */
function stairBarriers(l: HouseLayout, floor: number): RectCollider[] {
  const s = l.stairs;
  const mx = stairsMidX(s);
  const len = (s.zBottom - s.zTop) / 2;
  const cz = (s.zTop + s.zBottom) / 2;
  const rails: RectCollider[] = [-1, 1].map((side) => ({ x: side < 0 ? s.x0 - 0.12 : s.x1 + 0.12, z: cz, hw: 0.12, hd: len, rot: 0 }));
  const capW = (s.x1 - s.x0) / 2 + 0.24;
  const cap: RectCollider = floor === 0 ? { x: mx, z: s.zTop - 0.12, hw: capW, hd: 0.12, rot: 0 } : { x: mx, z: s.zBottom + 0.12, hw: capW, hd: 0.12, rot: 0 };
  return [...rails, cap];
}

/** What stops a walker on this floor: partition walls and the staircase barriers (furniture is added by the interior). */
export function floorColliders(l: HouseLayout, floor: number): Colliders {
  return { rects: [...l.walls[Math.min(FLOORS - 1, floor)], ...stairBarriers(l, floor)], circles: [] };
}

/** Where furniture may not stand on a floor: walls, and the stairs and the hole above them. */
function itemBlockers(l: HouseLayout, floor: number): Colliders {
  return { rects: [...l.walls[Math.min(FLOORS - 1, floor)], stairsRect(l.stairs)], circles: [] };
}

export const itemRadius = (size: number, scale: number): number => Math.max(0.3, size * scale * 0.5 * 0.9);

/** Which room a point is in (or null in a doorway or outside). */
export function roomAt(l: HouseLayout, floor: number, x: number, z: number): Room | null {
  let best: Room | null = null;
  for (const r of l.rooms) {
    if (r.floor !== floor || x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    if (!best || (r.x1 - r.x0) * (r.z1 - r.z0) < (best.x1 - best.x0) * (best.z1 - best.z0)) best = r;
  }
  return best;
}

function keepInside(l: HouseLayout, x: number, z: number, r: number): { x: number; z: number } {
  const lim = (half: number) => Math.max(0, half - Math.max(MARGIN, r * 0.6));
  return { x: Math.max(-lim(l.w / 2), Math.min(lim(l.w / 2), x)), z: Math.max(-lim(l.d / 2), Math.min(lim(l.d / 2), z)) };
}

/** Put furniture of radius r at (x,z) on a floor: inside the house and out of every wall and the stairs. */
export function placeInLayout(l: HouseLayout, floor: number, x: number, z: number, r: number): { x: number; z: number } {
  const c = itemBlockers(l, floor);
  let p = keepInside(l, x, z, r);
  for (let i = 0; i < 3; i++) {
    const pos = { x: p.x, y: 0, z: p.z };
    resolve(pos, r, c, 6);
    p = keepInside(l, pos.x, pos.z, r);
  }
  if (!blocked(p.x, p.z, r, c)) return p;
  // Spiral search when resolve cannot escape a wide stair footprint / tight pocket.
  for (let ring = 1; ring <= 24; ring++) {
    const step = 0.55;
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dz] of [
        [i * step, -ring * step],
        [i * step, ring * step],
        [-ring * step, i * step],
        [ring * step, i * step],
      ]) {
        const q = keepInside(l, x + dx, z + dz, r);
        if (!blocked(q.x, q.z, r, c)) return q;
      }
    }
  }
  return p;
}

/**
 * Drag furniture from one spot to another. It slides along walls instead of jumping through them,
 * so you can't push a sofa from one room to the next except through the doorway.
 */
export function moveInLayout(l: HouseLayout, floor: number, from: { x: number; z: number }, to: { x: number; z: number }, r: number): { x: number; z: number } {
  const c = itemBlockers(l, floor);
  const pos = { x: from.x, y: 0, z: from.z };
  movePlayer(pos, to.x - from.x, to.z - from.z, r, c, undefined, 0.15);
  return keepInside(l, pos.x, pos.z, r);
}

/** True if furniture of radius r would overlap a wall or the stairs here. */
export function itemBlocked(l: HouseLayout, floor: number, x: number, z: number, r: number): boolean {
  return blocked(x, z, r, itemBlockers(l, floor));
}

/** Preferred centre of a named room (or null). */
export function roomCenter(l: HouseLayout, floor: number, nameMatch: RegExp): { x: number; z: number } | null {
  const r = l.rooms.find((q) => q.floor === floor && nameMatch.test(q.name));
  if (!r) return null;
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}
