/**
 * Pure town layout: places, building footprints, road network and props.
 * Used by the 3D town builder and by tests (no three.js).
 */

export interface Place {
  id: string;
  x: number;
  z: number;
  /** Half-width / half-depth of the building footprint in local space (door on +Z). */
  hw: number;
  hd: number;
  /** Explicit street-facing yaw (cardinal). Door faces this way onto a grid street. */
  rot: number;
}

export interface RoadSeg {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
}

export interface BuildingFoot {
  x: number;
  z: number;
  hw: number;
  hd: number;
  rot: number;
  id: string;
}

/**
 * Landmark centres on the orthogonal grid.
 * Each building sits on a grass lot beside a main street and faces that street
 * (door along local +Z after `rot`). No diagonal plaza-facing.
 */
export const PLACES: Record<string, Place> = {
  // South of EW -22 (doors face north onto street)
  home: { id: 'home', x: -62, z: -58, hw: 8, hd: 7, rot: 0 },
  shop: { id: 'shop', x: 38, z: -34, hw: 7, hd: 5, rot: 0 },
  // South on x=0 corridor, door faces north onto the corridor stub
  eggs: { id: 'eggs', x: 0, z: -48, hw: 6, hd: 4.5, rot: 0 },
  // West / east of NS ±22, door curb lands on the street
  pets: { id: 'pets', x: -28, z: -8, hw: 8, hd: 6, rot: Math.PI / 2 },
  cars: { id: 'cars', x: 34, z: -8, hw: 9, hd: 6.5, rot: -Math.PI / 2 },
  // Playground west of plaza
  play: { id: 'play', x: -44, z: 16, hw: 11, hd: 11, rot: Math.PI / 2 },
  // North of EW 22
  doors: { id: 'doors', x: 0, z: 46, hw: 5, hd: 3, rot: Math.PI },
  // North of EW 22, door faces south onto that street
  vet: { id: 'vet', x: 38, z: 30, hw: 7, hd: 5.5, rot: Math.PI },
};

export const PLAZA_R = 13;
export const RING_R = 17;
export const ROAD_W = 4.8;
export const APPROACH_W = 4.6;

/** Cardinal facing: 0=+Z (north), π/2=+X (east), π=-Z (south), -π/2=-X (west). */
export type Cardinal = 0 | number;

/** Look up the explicit street-facing yaw for a landmark, or infer for plots. */
export function faceStreet(x: number, z: number): number {
  for (const p of Object.values(PLACES)) {
    if (Math.hypot(p.x - x, p.z - z) < 0.5) return p.rot;
  }
  // House plots / free points: face the nearest main street
  const ews = [-22, 22, -48, -70, -6, 34, 0];
  const nss = [-22, 22, -72, -90, 55, 0];
  let best = { d: Infinity, rot: 0 };
  for (const sz of ews) {
    const d = Math.abs(z - sz);
    if (d < best.d) best = { d, rot: sz > z ? 0 : Math.PI };
  }
  for (const sx of nss) {
    const d = Math.abs(x - sx);
    if (d < best.d) best = { d, rot: sx > x ? Math.PI / 2 : -Math.PI / 2 };
  }
  return best.rot;
}

/** @deprecated Alias of faceStreet (grid cardinals). */
export function faceCenter(x: number, z: number) {
  return faceStreet(x, z);
}

/** Point in front of a place (local +z is the door side after rotation). */
export function frontOf(p: { x: number; z: number; rot?: number }, dist: number) {
  const rot = p.rot ?? faceStreet(p.x, p.z);
  return { x: p.x + Math.sin(rot) * dist, z: p.z + Math.cos(rot) * dist, rot };
}

/**
 * Neighbourhood house plots (plot 0 = local player / Hjem).
 * Kept clear of shop/vet/play footprints.
 */
export const HOUSE_PLOTS: { x: number; z: number }[] = [
  // SW neighbourhood — well clear of pets/shop/play (min ~25 m gap)
  { x: -62, z: -58 }, // plot 0 = local home (matches PLACES.home)
  { x: -82, z: -58 },
  { x: -82, z: -76 },
  { x: -62, z: -76 },
  { x: -98, z: -76 },
  { x: -98, z: -58 },
];

function len(x1: number, z1: number, x2: number, z2: number) {
  return Math.hypot(x2 - x1, z2 - z1);
}

/** Closest distance from point to a finite road segment (to centre line). */
export function distToSeg(x: number, z: number, s: RoadSeg): number {
  const dx = s.x2 - s.x1;
  const dz = s.z2 - s.z1;
  const L2 = dx * dx + dz * dz;
  if (L2 < 1e-9) return Math.hypot(x - s.x1, z - s.z1);
  let t = ((x - s.x1) * dx + (z - s.z1) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (s.x1 + dx * t), z - (s.z1 + dz * t));
}

export function onRoad(x: number, z: number, roads: readonly RoadSeg[], margin = 0): boolean {
  return roads.some((s) => distToSeg(x, z, s) < s.width / 2 + margin);
}

/** Does a road centre-line come within the building footprint (+ pad)? */
export function roadHitsBuilding(s: RoadSeg, b: BuildingFoot, pad = 0.5): boolean {
  const steps = Math.max(10, Math.ceil(len(s.x1, s.z1, s.x2, s.z2) / 1.2));
  const cos = Math.cos(b.rot);
  const sin = Math.sin(b.rot);
  const expand = s.width / 2 + pad;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = s.x1 + (s.x2 - s.x1) * t;
    const z = s.z1 + (s.z2 - s.z1) * t;
    const wx = x - b.x;
    const wz = z - b.z;
    const lx = wx * cos - wz * sin;
    const lz = wx * sin + wz * cos;
    if (Math.abs(lx) < b.hw + expand && Math.abs(lz) < b.hd + expand) return true;
  }
  return false;
}

export function buildingsFromPlaces(): BuildingFoot[] {
  return Object.values(PLACES).map((p) => ({
    id: p.id,
    x: p.x,
    z: p.z,
    hw: p.hw,
    hd: p.hd,
    rot: p.rot,
  }));
}

function hitsAny(s: RoadSeg, buildings: BuildingFoot[], pad = 0.5): boolean {
  return buildings.some((b) => roadHitsBuilding(s, b, pad));
}

/** Add a segment only if it clears every building. */
function pushClear(roads: RoadSeg[], s: RoadSeg, buildings: BuildingFoot[]) {
  if (!hitsAny(s, buildings, 0.45)) roads.push(s);
}

/**
 * Road network: plaza ring + short approaches that stop at each building front,
 * neighbourhood loop, and clear cross-links. Never runs through a building.
 */
/**
 * Road network: orthogonal grid of main streets + cross streets, a small
 * plaza square around the fountain, and short stubs to each door.
 * No hub-and-spoke diagonals from the centre.
 */
export function buildRoadNetwork(): RoadSeg[] {
  const buildings = buildingsFromPlaces();
  const roads: RoadSeg[] = [];

  const addForce = (x1: number, z1: number, x2: number, z2: number, width = ROAD_W) => {
    roads.push({ x1, z1, x2, z2, width });
  };
  const add = (x1: number, z1: number, x2: number, z2: number, width = ROAD_W) => {
    pushClear(roads, { x1, z1, x2, z2, width }, buildings);
  };

  // Plaza square
  const P = 14;
  addForce(-P, -P, P, -P, 5.0);
  addForce(P, -P, P, P, 5.0);
  addForce(P, P, -P, P, 5.0);
  addForce(-P, P, -P, -P, 5.0);

  // Main streets — pushClear so they never clip buildings
  add(-70, -22, 70, -22, 5.2);
  add(-60, 22, 60, 22, 5.0);
  add(-100, -48, -40, -48, 4.6); // neighbourhood street north of house plots
  add(-100, -70, -50, -70, 4.4); // back lane between plot rows
  add(-22, -78, -22, 50, 5.0);
  add(22, -60, 22, 50, 5.0);
  // neighbourhood west spines (clear of pets at x=-28)
  add(-72, -90, -72, -30, 4.6);
  add(-90, -90, -90, -40, 4.4);
  add(0, -P, 0, -42, 4.8); // plaza → eggs corridor
  add(0, P, 0, 40, 4.8); // plaza → doors
  add(-P, 0, -22, 0, 4.8); // plaza west to NS -22
  add(P, 0, 22, 0, 4.8); // plaza east to NS 22

  // --- Short stubs: door → street (curb lands on the facing main street) ---
  for (const p of Object.values(PLACES)) {
    if (p.id === 'home' || p.id === 'play') continue;
    const door = frontOf(p, p.hd + 0.5);
    // Snap curb onto the street the building faces
    let curbX = door.x;
    let curbZ = door.z;
    if (Math.abs(p.rot) < 0.01) {
      // face +Z (north): walk to nearest EW street north of door
      curbZ = p.id === 'eggs' ? -22 : -22;
    } else if (Math.abs(p.rot - Math.PI) < 0.01) {
      curbZ = 22; // face south onto EW 22
    } else if (p.rot > 0) {
      curbX = -22; // face east onto NS -22
    } else {
      curbX = 22; // face west onto NS 22
    }
    add(door.x, door.z, curbX, curbZ, APPROACH_W);
  }

  // House plots face north onto neighbourhood EW -48
  for (const plot of HOUSE_PLOTS) {
    const door = { x: plot.x, z: plot.z + 9 };
    add(door.x, door.z, door.x, -48, 4.0);
  }

  return roads;
}

/**
 * Bench positions: on the grass, clearly off every road.
 * `yaw` = sit facing (avatar forward = away from the backrest).
 * Forward in the game is (sin(yaw), cos(yaw)).
 */
export function benchSpots(roads: readonly RoadSeg[]): { x: number; z: number; yaw: number }[] {
  const out: { x: number; z: number; yaw: number }[] = [];
  const tryAdd = (x: number, z: number, yaw: number) => {
    if (onRoad(x, z, roads, 1.35)) return;
    // Keep clear of the fountain bowl only (not the whole plaza lawn).
    if (Math.hypot(x, z) < 6.2) return;
    for (const p of Object.values(PLACES)) {
      if (Math.hypot(x - p.x, z - p.z) < Math.max(p.hw, p.hd) + 2.5) return;
    }
    // keep clear of other benches
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 3.5)) return;
    out.push({ x, z, yaw });
  };

  // Plaza grass just inside the square roads, facing the fountain.
  // Sit on the inner lawn (radius ~10), not on the plaza road at |x| or |z| = 14.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    // well inside the plaza square roads (|x|,|z|=14) so onRoad never rejects them
    const x = Math.cos(a) * 8.5;
    const z = Math.sin(a) * 8.5;
    tryAdd(x, z, Math.atan2(-x, -z));
  }

  // Grass strips beside the main streets (offset off the asphalt), facing the street.
  const roadside: [number, number, number][] = [
    // south of EW z=-22, face north (toward street / plaza)
    [-35, -27, Math.PI],
    [8, -27, Math.PI],
    [35, -27, Math.PI],
    // north of EW z=-22, face south
    [-35, -17, 0],
    [35, -17, 0],
    // west of NS x=-22, face east
    [-27, 5, Math.PI / 2],
    [-27, -35, Math.PI / 2],
    // east of NS x=22, face west
    [27, 5, -Math.PI / 2],
    [27, -35, -Math.PI / 2],
    // neighbourhood park pockets
    [-40, -48, Math.PI],
    [-65, -48, Math.PI / 2],
    [-48, -70, 0],
    [-18, -62, -Math.PI / 2],
  ];
  for (const [x, z, yaw] of roadside) tryAdd(x, z, yaw);

  return out;
}

/**
 * Bench forward vector (from backrest through seat front).
 * Avatar facing MUST equal this yaw so their back is against the backrest.
 * Game forward = (sin(yaw), cos(yaw)).
 */
export function benchForward(sitYaw: number): { x: number; z: number } {
  return { x: Math.sin(sitYaw), z: Math.cos(sitYaw) };
}

/** World offset of the backrest relative to the sit point for a given sit yaw. */
export function benchBackrestOffset(sitYaw: number, depth = 0.3): { x: number; z: number } {
  // Backrest is behind the sitter (opposite of forward).
  const f = benchForward(sitYaw);
  return { x: -f.x * depth, z: -f.z * depth };
}

/**
 * Assert sit facing matches bench forward: backrest is behind the avatar.
 * Returns the signed forward·(sit→backrest) which must be negative.
 */
export function sitFacesAwayFromBackrest(sitYaw: number): number {
  const f = benchForward(sitYaw);
  const back = benchBackrestOffset(sitYaw);
  return f.x * back.x + f.z * back.z;
}

/** Lamp posts along the plaza square and main streets, off the asphalt. */
export function lampSpots(roads: readonly RoadSeg[]): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const tryAdd = (x: number, z: number) => {
    if (onRoad(x, z, roads, 0.9)) return;
    out.push({ x, z });
  };
  // Corners of the plaza square
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) tryAdd(s * 16.5, t * 16.5);
  }
  // Along main corridors
  for (const x of [-50, -30, 30, 50]) {
    tryAdd(x, -25);
    tryAdd(x, -19);
  }
  for (const z of [-50, -30, 10, 30]) {
    tryAdd(-25, z);
    tryAdd(25, z);
  }
  return out;
}
