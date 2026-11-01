import * as THREE from 'three';
import { HOUSE_BY_STYLE, type HouseStyle } from '../logic/catalog.ts';
import { HOME_ENTER_RADIUS } from '../logic/visitDoor.ts';
import { doorLockStatus } from '../logic/houseLock.ts';
import type { CircleCollider, RectCollider, Surface } from '../logic/collision.ts';
import {
  HOUSE_PLOTS,
  PLACES,
  PLAZA_R,
  benchSpots,
  buildRoadNetwork,
  frontOf,
  lampSpots,
  onRoad,
  type RoadSeg,
} from '../logic/townLayout.ts';
import { collectColliders, solid } from './colliders.ts';
import { fillCarShop, fillHospital, fillPetShop, fillShop } from './buildings.ts';
import { EQUIPMENT, MERRY, SEESAW, SLIDE, SWING_PIVOT_Y, SWING_ROPE, SWING_XS, SWING_Z, TRAMP, merryAngle, seatAt, seesawAngle, swingAngle, type EquipDef, type Seat } from '../logic/playground.ts';
import { box, cone, cyl, G, glassMat, glowMat, mat, mergeStatic, part, rbox, shadowAll, sph, textTexture } from './kit.ts';
import {
  buildFuturisticShop,
  buildSleekFountain,
  buildNaturalTree,
  buildPlanter,
  buildModernBench,
  buildSkylineTower,
  grassGroundMaterial,
  pavingGroundMaterial,
  asphaltGroundMaterial,
  preloadArchMaterials,
} from './futuristicArch.ts';
import { buildCar } from './vehicles.ts';
import { SharedMats } from './pbrTextures.ts';

export type ZoneKind = 'home' | 'shop' | 'vet' | 'eggs' | 'doors' | 'play' | 'cars' | 'pets';
export interface Zone {
  kind: ZoneKind;
  x: number;
  z: number;
  r: number;
  label: string;
}
export type { CircleCollider, RectCollider } from '../logic/collision.ts';

export interface WorldEquip extends EquipDef {
  /** World position of the middle and of the spot where you step down. */
  wx: number;
  wz: number;
  exitX: number;
  exitZ: number;
  exitYaw: number;
}

export interface Town {
  group: THREE.Group;
  zones: Zone[];
  rects: RectCollider[];
  circles: CircleCollider[];
  spawn: { x: number; z: number; yaw: number };
  entrances: Record<ZoneKind, { x: number; z: number; yaw: number }>;
  /** World positions where a sick animal can lie down in the hospital. */
  vetBeds: { x: number; z: number; y: number }[];
  setHomeStyle(style: HouseStyle, locked?: boolean): void;
  /** Playground equipment in world coordinates (you can sit on these). */
  equipment: WorldEquip[];
  /** The meshes you can tap to climb on (userData.equip holds the id). */
  equipTargets: THREE.Object3D[];
  /** Which piece is in use and for how long; it moves while someone is on it and rests otherwise. */
  setEquipUse(use: { id: string; u: number } | null): void;
  /** Where the avatar sits on a piece `u` seconds after climbing on (world coordinates). */
  seatWorld(id: string, u: number): Seat;
  /** Animate; roofs of the shop and the hospital are lifted off while the player is inside. */
  update(t: number, px?: number, pz?: number, camX?: number, camZ?: number): void;
  /** Centre and radius of the walk-in building the point is inside (the camera must not be pushed in by its walls). */
  buildingAt(x: number, z: number): { kind: 'shop' | 'vet' | 'cars' | 'pets'; x: number; z: number; r: number } | null;
  /** Which walk-in building the point is inside, if any. */
  insideBuilding(x: number, z: number): 'shop' | 'vet' | 'cars' | 'pets' | null;
  /** Tops you can land on after a jump (fountain, etc.). */
  surfaces: Surface[];
  /** Outdoor benches you can sit on to rest. */
  benches: { x: number; z: number; yaw: number }[];
  /** Road centre-line segments (for tests and props). */
  roads: RoadSeg[];
  /** Neighbourhood house plots (each multiplayer player gets one). */
  housePlots: { x: number; z: number; rot: number }[];
  /** Show a remote player's house exterior on a plot (style + label). */
  setPlotHouse(plot: number, style: HouseStyle | null, label?: string, locked?: boolean): void;
  size: number;
}

const GRASS = '#6bb86a';
const ROAD = '#5a6270';
const LANE = '#9ef0ff';
const WOOD = '#c4a574';
const WHITE = '#f2f6fb';
const SOLAR = '#1a3358';
const SIZE = 240;

/** Flat text plate (kept for house labels). */
function sign(parent: THREE.Object3D, text: string, y: number, z: number, bg: string, w = 7) {
  const tex = textTexture(text, { bg, fg: '#ffffff', stroke: '#00000033', w: 512, h: 128 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.set(0, y, z);
  parent.add(m);
  return m;
}

/** Holographic 3D shop sign that sits ON TOP of the roof. */
function shopSign3d(
  parent: THREE.Object3D,
  opts: { label: string; bg: string; /** Roof-top Y (above roof slab). */ y: number; z?: number; w?: number; logo: (g: THREE.Group) => void },
) {
  const w = opts.w ?? 6.5;
  const z = opts.z ?? 0;
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    cyl(g, '#8aa0b8', [s * (w / 2 - 0.35), opts.y - 0.55, z], [0.14, 1.1, 0.14]);
    sph(g, '#7ef0ff', [s * (w / 2 - 0.35), opts.y, z], [0.22, 0.22, 0.22], undefined, 0.8);
  }
  // glowing holographic board
  const board = new THREE.Mesh(G.rbox(0.12), glowMat(opts.bg, 0.55));
  board.position.set(0, opts.y, z);
  board.scale.set(w, 1.35, 0.22);
  g.add(board);
  rbox(g, '#0e1a28', [0, opts.y, z + 0.14], [w - 0.4, 1.05, 0.06]);
  const tex = textTexture(opts.label, { bg: opts.bg, fg: '#ffffff', stroke: '#00000044', w: 512, h: 128 });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.9, 0.7), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  plate.position.set(0, opts.y - 0.1, z + 0.2);
  g.add(plate);
  const logo = new THREE.Group();
  logo.position.set(0, opts.y + 1.25, z);
  opts.logo(logo);
  g.add(logo);
  parent.add(g);
  return g;
}

function awning(g: THREE.Group, w: number, y: number, z: number, a: string, _b: string) {
  // sleek solar/LED canopy instead of striped fabric
  box(g, '#e8eef6', [0, y + 0.15, z - 0.2], [w + 0.4, 0.18, 2.6], [0.22, 0, 0]).userData.noCast = true;
  box(g, '#1a3358', [0, y + 0.28, z - 0.35], [w + 0.2, 0.1, 2.3], [0.22, 0, 0]).userData.noCast = true;
  box(g, a, [0, y - 0.05, z + 0.85], [w * 0.92, 0.06, 0.1], undefined, 0.75).userData.noCast = true;
}

/** Open-front building (shop, vet, egg shop): back + side walls, roof, sign. With `door` it gets a front wall you walk in through. */
function openBuilding(w: number, d: number, h: number, wall: string, _roof: string, trim: string, opts: { solidFloor?: boolean; door?: number; roofSeparate?: boolean } = {}) {
  const g = new THREE.Group();
  const roofG = opts.roofSeparate ? new THREE.Group() : g;
  const walkIn = opts.door !== undefined;
  // a walk-in building keeps its walls in separate groups, so the ones between the camera and you can be hidden
  const shell = { back: new THREE.Group(), left: new THREE.Group(), right: new THREE.Group(), front: new THREE.Group() };
  const W = walkIn ? shell : { back: g, left: g, right: g, front: g };
  if (walkIn) {
    // a thin slab, so the player's feet are on it
    box(g, '#e8eef6', [0, 0.01, 0], [w, 0.06, d]).userData.noCast = true;
  } else {
    const floor = box(g, '#e8eef6', [0, 0.1, 0], [w, 0.2, d]);
    if (opts.solidFloor !== false) solid(floor, 'rect', 0, h + 1);
  }
  solid(box(W.back, wall, [0, h / 2, -d / 2 + 0.3], [w, h, 0.6]));
  solid(box(W.left, wall, [-(w / 2 - 0.3), h / 2, 0], [0.6, h, d]));
  solid(box(W.right, wall, [w / 2 - 0.3, h / 2, 0], [0.6, h, d]));
  if (walkIn) {
    const door = opts.door!;
    const seg = (w - door) / 2;
    for (const s of [-1, 1]) {
      const cx = s * (door / 2 + seg / 2);
      solid(box(W.front, wall, [cx, h / 2, d / 2 - 0.25], [seg, h, 0.5]));
      // door frame and a window in each front segment
      box(W.front, trim, [s * (door / 2 + 0.2), h / 2, d / 2 - 0.1], [0.4, h, 0.7]);
      const win = new THREE.Mesh(G.box(), glassMat('#bfe9ff', 0.4));
      win.position.set(cx, 3.1, d / 2 + 0.03);
      win.scale.set(Math.min(3.4, seg - 1.4), 1.8, 0.12);
      W.front.add(win);
      box(W.front, '#ffffff', [cx, 3.1, d / 2 + 0.0], [Math.min(3.4, seg - 1.4) + 0.3, 2.1, 0.08]);
      box(W.front, trim, [s * (w / 2 - 0.3), h / 2, d / 2 - 0.2], [0.9, h, 0.9]);
    }
    g.userData.shell = shell;
  } else for (const s of [-1, 1]) solid(box(g, trim, [s * (w / 2 - 0.3), h / 2, d / 2 - 0.2], [0.9, h, 0.9]));
  // solar overhang roof
  const solarRoof = new THREE.Mesh(G.rbox(0.08), mat('#1a3358', 0.12, { metalness: 0.5, roughness: 0.4 }));
  solarRoof.position.set(0, h + 0.55, -0.1);
  solarRoof.scale.set(w + 2.6, 0.35, d + 2.4);
  solarRoof.rotation.x = -0.12;
  solarRoof.userData.noCast = true;
  roofG.add(solarRoof);
  box(roofG, trim, [0, h + 0.15, d / 2 + 0.4], [w + 1.5, 0.2, 0.8]).userData.noCast = true;
  const edgeGlow = new THREE.Mesh(G.box(), glowMat('#7ef0ff', 0.25));
  edgeGlow.position.set(0, h + 0.35, d / 2 + 0.9);
  edgeGlow.scale.set(w + 1.2, 0.08, 0.1);
  edgeGlow.userData.noCast = true;
  roofG.add(edgeGlow);
  g.userData.roof = roofG;
  return g;
}

function homeExterior(style: HouseStyle, locked = false): THREE.Group {
  const info = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  const g = new THREE.Group();
  const w = Math.min(22, info.w * 0.65);
  const d = Math.min(18, info.d * 0.7);
  const h = style === 'slott' ? 14 : 12;

  // plinth
  solid(box(g, '#d8dee8', [0, 0.2, 0], [w + 1.2, 0.4, d + 1.2]), 'rect', 0, 18);

  // curved white shell + wood panel sides + glass front
  solid(rbox(g, WHITE, [0, h / 2 + 0.4, 0], [w, h, d]), 'rect', 0, 18);
  // wood vertical panels left/right
  for (const s of [-1, 1]) {
    box(g, WOOD, [s * (w / 2 - 0.15), h / 2 + 0.4, 0], [0.35, h - 0.4, d - 0.6]);
    for (let i = 0; i < 6; i++) {
      box(g, '#b89560', [s * (w / 2 - 0.02), 1.2 + i * 1.7, 0], [0.08, 1.4, d - 1.2]);
    }
  }
  // floor band + mid band
  box(g, WHITE, [0, 0.7, 0], [w + 0.25, 0.35, d + 0.25]);
  box(g, '#cfd8e6', [0, 6.9, 0], [w + 0.3, 0.25, d + 0.3]);

  // solar panel overhang roof
  const eave = 1.1;
  const rw = w + eave * 2;
  const rd = d + eave * 2;
  box(g, WHITE, [0, h + 0.15, 0], [w + 0.2, 0.2, d + 0.2]).userData.noCast = true;
  // slanted solar slab
  const solar = new THREE.Mesh(G.box(), mat(SOLAR, 0.15, { metalness: 0.55, roughness: 0.35 }));
  solar.position.set(0, h + 0.85, -0.15);
  solar.scale.set(rw, 0.22, rd);
  solar.rotation.x = -0.18;
  solar.castShadow = true;
  solar.userData.noCast = true;
  g.add(solar);
  // solar grid lines
  for (let i = -3; i <= 3; i++) {
    box(g, '#2a4a78', [i * (rw / 7), h + 0.98 - Math.abs(i) * 0.02, -0.15], [0.06, 0.04, rd - 0.4], [-0.18, 0, 0]).userData.noCast = true;
  }
  for (let i = -2; i <= 2; i++) {
    box(g, '#2a4a78', [0, h + 0.98, i * (rd / 5) - 0.15], [rw - 0.5, 0.04, 0.06], [-0.18, 0, 0]).userData.noCast = true;
  }
  // front lip glow
  const lip = new THREE.Mesh(G.box(), glowMat('#7ef0ff', 0.28));
  lip.position.set(0, h + 0.55, d / 2 + eave * 0.55);
  lip.scale.set(rw * 0.92, 0.08, 0.12);
  lip.userData.noCast = true;
  g.add(lip);

  if (style === 'slott') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      solid(cyl(g, WHITE, [sx * w / 2, h / 2 + 1.2, sz * d / 2], [2.6, h + 1.5, 2.6]), 'circle', 0, 14);
      cone(g, SOLAR, [sx * w / 2, h + 3.6, sz * d / 2], [3.6, 2.8, 3.6]);
      sph(g, '#7ef0ff', [sx * w / 2, h + 5.1, sz * d / 2], [0.45, 0.45, 0.45], undefined, 0.9);
    }
  }

  // glass door + windows
  rbox(g, '#8aa0b8', [0, 2.3, d / 2 + 0.04], [2.8, 3.8, 0.18]);
  const doorGlass = new THREE.Mesh(G.box(), glassMat('#9ad8ff', 0.35));
  doorGlass.position.set(0, 2.3, d / 2 + 0.14);
  doorGlass.scale.set(2.4, 3.4, 0.06);
  g.add(doorGlass);
  sph(g, '#7ef0ff', [0.9, 2.3, d / 2 + 0.28], [0.2, 0.2, 0.16], undefined, 0.8);
  if (locked) {
    rbox(g, '#555a75', [0, 2.4, d / 2 + 0.22], [0.5, 0.4, 0.18]);
    part(g, G.torus(), '#7ef0ff', [0, 2.7, d / 2 + 0.22], [0.32, 0.32, 0.18], [Math.PI / 2, 0, 0], 0.5);
  }
  for (const s of [-1, 1]) {
    box(g, WHITE, [s * (w / 2 - 2.6), 4, d / 2 + 0.05], [2.5, 2.3, 0.16]);
    const win = new THREE.Mesh(G.box(), glassMat('#9ad8ff', 0.4));
    win.position.set(s * (w / 2 - 2.6), 4, d / 2 + 0.14);
    win.scale.set(2.1, 1.9, 0.08);
    g.add(win);
    box(g, WHITE, [s * (w / 2 - 2.6), 9.5, d / 2 + 0.05], [2.5, 2.4, 0.16]);
    const win2 = new THREE.Mesh(G.box(), glassMat('#9ad8ff', 0.4));
    win2.position.set(s * (w / 2 - 2.6), 9.5, d / 2 + 0.14);
    win2.scale.set(2.1, 2.0, 0.08);
    g.add(win2);
    // slim dark/wood planter with grasses
    rbox(g, '#3a342c', [s * (w / 2 - 2.6), 0.22, d / 2 + 0.7], [1.7, 0.4, 0.5]);
    rbox(g, '#2a2e34', [s * (w / 2 - 2.6), 0.44, d / 2 + 0.7], [1.78, 0.05, 0.56]);
    for (let i = 0; i < 5; i++) {
      const gx = s * (w / 2 - 2.6) + (i - 2) * 0.28;
      sph(g, i % 2 ? '#5fa84a' : '#4e9a40', [gx, 0.7, d / 2 + 0.7], [0.12, 0.35 + (i % 3) * 0.08, 0.12]);
    }
  }

  // path with glowing edge
  box(g, ROAD, [0, 0.03, d / 2 + 3], [3.2, 0.06, 5]);
  box(g, LANE, [0, 0.06, d / 2 + 3], [0.12, 0.02, 4.6], undefined, 0.9);
  solid(cyl(g, '#8aa0b8', [3.5, 0.8, d / 2 + 3], [0.16, 1.6, 0.16]), 'circle', 0.3);
  rbox(g, '#3ecbff', [3.5, 1.75, d / 2 + 3], [0.55, 0.45, 0.7], undefined, 0.35);
  sign(g, 'Hjem', 8.0, d / 2 + 0.12, '#3ecbff', 3.6);
  g.userData.size = { w: w + 1, d: d + 1 };
  return g;
}

function tree(g: THREE.Group, x: number, z: number, s: number, kind: number, collide = false) {
  const t0 = buildNaturalTree(kind % 6);
  t0.position.set(x, 0, z);
  t0.scale.setScalar(s);
  g.add(t0);
  if (collide) {
    const hit = cyl(g, '#5a3d28', [x, 1.2 * s, z], [0.2 * s, 2.4 * s, 0.2 * s]);
    hit.visible = false;
    solid(hit, 'circle', 0.5 * s, 6 * s);
  }
}



export function buildTown(): Town {
  void preloadArchMaterials();
  const group = new THREE.Group();
  const stat = new THREE.Group();
  const zones: Zone[] = [];
  const rects: RectCollider[] = [];
  const circles: CircleCollider[] = [];

  // ground – PBR grass (lush light green)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2, SIZE * 2), grassGroundMaterial());
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  // lighter grass rings near plaza / hedges for concept variation
  {
    const lush = grassGroundMaterial().clone();
    lush.color = lush.color.clone().offsetHSL(0.01, -0.08, 0.02);
    for (const [r, y] of [[22, 0.02], [32, 0.015]] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 3.5, r, 64), lush);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = y;
      ring.receiveShadow = true;
      ring.userData.noCast = true;
      group.add(ring);
    }
  }

  const P = {
    home: { x: PLACES.home.x, z: PLACES.home.z },
    shop: { x: PLACES.shop.x, z: PLACES.shop.z },
    eggs: { x: PLACES.eggs.x, z: PLACES.eggs.z },
    vet: { x: PLACES.vet.x, z: PLACES.vet.z },
    play: { x: PLACES.play.x, z: PLACES.play.z },
    doors: { x: PLACES.doors.x, z: PLACES.doors.z },
    cars: { x: PLACES.cars.x, z: PLACES.cars.z },
    pets: { x: PLACES.pets.x, z: PLACES.pets.z },
  };
  const surfaces: Surface[] = [];
  const roads = buildRoadNetwork();
  const benches: { x: number; z: number; yaw: number }[] = [];

  // plaza + fountain (outer wall jumpable; rim and upper bowl are landable)
  {
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(PLAZA_R, PLAZA_R, 0.12, 64),
      pavingGroundMaterial(),
    );
    plaza.position.y = 0.05;
    plaza.receiveShadow = true;
    plaza.userData.noCast = true;
    stat.add(plaza);
  }
  // sleek multi-tier fountain (concept match)
  const fountainBuilt = buildSleekFountain();
  group.add(fountainBuilt.group);
  shadowAll(fountainBuilt.group);
  {
    const a = cyl(stat, '#c8d0da', [0, 0.28, 0], [10.4, 0.55, 10.4]); a.visible = false; solid(a, 'circle', 0, 0.6);
    const b = cyl(stat, '#c8d0da', [0, 1.35, 0], [4.8, 0.35, 4.8]); b.visible = false; solid(b, 'circle', 0, 1.55);
    const c = cyl(stat, '#c8d0da', [0, 2.4, 0], [0.8, 1.6, 0.8]); c.visible = false; solid(c, 'circle', 0.15, 3.4);
  }
  surfaces.push({ x: 0, z: 0, r: 5.0, top: 0.6 });
  surfaces.push({ x: 0, z: 0, r: 2.3, top: 1.55 });
  const jets = fountainBuilt.jets;
  const fountainRings = fountainBuilt.rings;
  let waterSurf: THREE.Object3D | null = null;
  fountainBuilt.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!waterSurf && m.isMesh && (m.geometry as THREE.BufferGeometry).type === 'CircleGeometry') waterSurf = m;
  });

  // road network (ring + approaches + neighbourhood) – never through buildings
  for (const s of roads) {
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const L = Math.hypot(dx, dz);
    if (L < 0.2) continue;
    const ang = Math.atan2(dx, dz);
    const mx = (s.x1 + s.x2) / 2;
    const mz = (s.z1 + s.z2) / 2;
    {
      const roadMesh = new THREE.Mesh(G.box(), asphaltGroundMaterial());
      roadMesh.position.set(mx, 0.05, mz);
      roadMesh.scale.set(s.width, 0.06, L);
      roadMesh.rotation.set(0, ang, 0);
      roadMesh.receiveShadow = true;
      roadMesh.userData.noCast = true;
      if (roadMesh.material.map) roadMesh.material.map.repeat.set(1, Math.max(1, L / 8));
      stat.add(roadMesh);
    }
    // glowing centre lane
    box(stat, LANE, [mx, 0.085, mz], [0.12, 0.02, Math.max(0.5, L - 0.8)], [0, ang, 0], 0.35).userData.noCast = true;
    // edge lines
    const half = s.width * 0.42;
    for (const side of [-1, 1]) {
      const ox = Math.cos(ang) * half * side;
      const oz = -Math.sin(ang) * half * side;
      box(stat, LANE, [mx + ox, 0.082, mz + oz], [0.07, 0.015, Math.max(0.5, L - 0.4)], [0, ang, 0], 0.25).userData.noCast = true;
    }
  }

  const entrances = {} as Town["entrances"];
  const front = (p: { x: number; z: number }, dist: number) => frontOf(p, dist);

  // walk-in buildings: the roof lifts off while you are inside, so you can see what is there
  type Shell = { back: THREE.Group; left: THREE.Group; right: THREE.Group; front: THREE.Group };
  const walkIns: { kind: 'shop' | 'vet' | 'cars' | 'pets'; x: number; z: number; rot: number; hw: number; hd: number; roof: THREE.Group; shell: Shell }[] = [];
  /** Put a walk-in building's walls and roof in the world (they are not merged, since they hide and show). */
  const mountShell = (g: THREE.Group, roofG: THREE.Group, p: { x: number; z: number }, rot: number): Shell => {
    const shell = g.userData.shell as Shell;
    for (const o of [g, roofG, ...Object.values(shell)]) {
      o.position.set(p.x, 0, p.z);
      o.rotation.y = rot;
    }
    for (const o of Object.values(shell)) {
      group.add(o);
      const c = collectColliders(o);
      rects.push(...c.rects);
      circles.push(...c.circles);
    }
    return shell;
  };
  const toWorld = (p: { x: number; z: number }, rot: number, lx: number, lz: number) => ({ x: p.x + lx * Math.cos(rot) + lz * Math.sin(rot), z: p.z - lx * Math.sin(rot) + lz * Math.cos(rot) });
  const vetBeds: Town['vetBeds'] = [];
  // shop: you walk in through the door and shop at the counter
  {
    const g = openBuilding(14, 10, 6, '#f2f6fb', '#1a3358', '#ffffff', { door: 4.4, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    awning(roofG, 14, 5.4, 5.6, '#ff6f6f', '#ffffff');
    // 3D sign ON TOP of the roof (stays with roof when it lifts)
    shopSign3d(roofG, {
      label: 'Butikk',
      bg: '#ff6f6f',
      y: 8.0,
      z: 0,
      w: 6.2,
      logo: (lg) => {
        rbox(lg, '#ffffff', [0, 0, 0], [1.1, 0.9, 0.35]);
        box(lg, '#ff6f6f', [0, 0.15, 0.2], [0.7, 0.45, 0.1]);
        cyl(lg, '#8a5a3c', [-0.35, -0.55, 0.1], [0.12, 0.25, 0.12], [0, 0, Math.PI / 2]);
        cyl(lg, '#8a5a3c', [0.35, -0.55, 0.1], [0.12, 0.25, 0.12], [0, 0, Math.PI / 2]);
      },
    });
    const inside = fillShop(g);
    const f = front(P.shop, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.shop, f.rot);
    walkIns.push({ kind: 'shop', x: P.shop.x, z: P.shop.z, rot: f.rot, hw: 7, hd: 5, roof: roofG, shell });
    const z = toWorld(P.shop, f.rot, inside.counter.x, inside.counter.z);
    zones.push({ kind: 'shop', x: z.x, z: z.z, r: 3.2, label: 'Handle mat 🛒' });
    const door = front(P.shop, 8.5);
    entrances.shop = { x: door.x, z: door.z, yaw: f.rot };
  }
  // animal hospital: a walk-in building with beds
  {
    const g = openBuilding(14, 11, 6.5, '#f7fafc', '#1a3358', '#9ad8ff', { door: 5, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    // Big red cross on a mast on the FRONT facade (clearly visible from the street).
    const crossMast = new THREE.Group();
    cyl(crossMast, '#c3cad9', [0, 7.8, 5.85], [0.28, 2.4, 0.28]);
    box(crossMast, '#ff4b4b', [0, 9.4, 5.85], [0.85, 2.8, 0.4]);
    box(crossMast, '#ff4b4b', [0, 9.4, 5.85], [2.8, 0.85, 0.4]);
    // white outline behind the cross so it reads at a distance
    box(crossMast, '#ffffff', [0, 9.4, 5.7], [3.1, 1.15, 0.2]);
    box(crossMast, '#ffffff', [0, 9.4, 5.7], [1.15, 3.1, 0.2]);
    g.add(crossMast);
    shopSign3d(roofG, {
      label: 'Dyrlegen',
      bg: '#3fa4ff',
      y: 8.4,
      z: 0,
      w: 7.0,
      logo: (lg) => {
        box(lg, '#ff4b4b', [0, 0, 0], [0.55, 1.5, 0.3]);
        box(lg, '#ff4b4b', [0, 0, 0], [1.5, 0.55, 0.3]);
      },
    });
    const inside = fillHospital(g);
    const f = front(P.vet, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.vet, f.rot);
    walkIns.push({ kind: 'vet', x: P.vet.x, z: P.vet.z, rot: f.rot, hw: 7, hd: 5.5, roof: roofG, shell });
    for (const b of inside.beds) vetBeds.push({ ...toWorld(P.vet, f.rot, b.x, b.z), y: b.y });
    const p = toWorld(P.vet, f.rot, 0, 1.0);
    zones.push({ kind: 'vet', x: p.x, z: p.z, r: 3.2, label: 'Dyrlegen 🩺' });
    const door = front(P.vet, 9);
    entrances.vet = { x: door.x, z: door.z, yaw: f.rot + Math.PI };
  }
  // egg shop
  {
    const g = openBuilding(12, 9, 6, '#efe8f8', '#1a3358', '#ffffff');
    awning(g, 12, 5.4, 5.1, '#c88bff', '#ffffff');
    shopSign3d(g, {
      label: 'Eggbutikk',
      bg: '#b05cff',
      y: 11.2,
      z: 0,
      w: 5.8,
      logo: (lg) => {
        sph(lg, '#fff4c2', [0, 0.1, 0], [1.0, 1.25, 1.0]);
        for (let i = 0; i < 4; i++) sph(lg, '#ff8fc7', [Math.cos(i * 1.5) * 0.35, 0.2 + Math.sin(i) * 0.2, 0.45], [0.22, 0.22, 0.15]);
      },
    });
    sph(g, '#fff4c2', [0, 9.8, 0], [3, 3.8, 3]);
    for (let i = 0; i < 5; i++) sph(g, '#ff8fc7', [Math.cos(i * 1.26) * 1.4, 9.8 + Math.sin(i * 2) * 0.8, Math.sin(i * 1.26) * 1.4], [0.7, 0.7, 0.4]);
    solid(rbox(g, '#ffd23f', [0, 1, 1.2], [7, 2, 1.6]));
    const eggs = ['#bfe9ff', '#ffe8a8', '#e2c6ff', '#ffd23f'];
    eggs.forEach((c, i) => {
      cyl(g, '#ffffff', [-2.7 + i * 1.8, 2.1, 1.2], [1, 0.2, 1]);
      sph(g, c, [-2.7 + i * 1.8, 2.8, 1.2], [1.0, 1.3, 1.0]);
    });
    const f = front(P.eggs, 0);
    g.position.set(P.eggs.x, 0, P.eggs.z);
    g.rotation.y = f.rot;
    stat.add(g);
    const z = front(P.eggs, 6.8);
    zones.push({ kind: 'eggs', x: z.x, z: z.z, r: 4, label: 'Kjøp egg 🥚' });
    entrances.eggs = { x: z.x, z: z.z, yaw: f.rot + Math.PI };
  }
  // car shop (bilbutikk)
  {
    const g = openBuilding(18, 13, 7, '#eef3f8', '#1a3358', '#ffffff', { door: 5.2, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    awning(roofG, 18, 6.0, 7.2, '#3fa4ff', '#ffffff');
    shopSign3d(roofG, {
      label: 'Bilbutikk',
      bg: '#3fa4ff',
      y: 9.0,
      z: 0,
      w: 7.5,
      logo: (lg) => {
        rbox(lg, '#ff8fb1', [0, 0, 0], [1.6, 0.55, 0.7]);
        rbox(lg, '#bfe9ff', [0.1, 0.35, 0], [0.9, 0.4, 0.6], undefined, 0.2);
        for (const s of [-1, 1]) cyl(lg, '#2b2b38', [s * 0.45, -0.35, 0.35], [0.35, 0.2, 0.35], [0, 0, Math.PI / 2]);
      },
    });
    const inside = fillCarShop(g);
    const f = front(P.cars, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.cars, f.rot);
    walkIns.push({ kind: 'cars', x: P.cars.x, z: P.cars.z, rot: f.rot, hw: 9, hd: 6.5, roof: roofG, shell });
    const z = toWorld(P.cars, f.rot, inside.counter.x, inside.counter.z);
    zones.push({ kind: 'cars', x: z.x, z: z.z, r: 3.2, label: 'Se på biler 🚗' });
    const door = front(P.cars, 10);
    entrances.cars = { x: door.x, z: door.z, yaw: f.rot };
  }
  // pet shop (dyrebutikk)
  {
    const g = openBuilding(16, 12, 6.5, '#f4eef6', '#1a3358', '#ffffff', { door: 4.8, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    awning(roofG, 16, 5.6, 6.6, '#ff8fb1', '#ffffff');
    shopSign3d(roofG, {
      label: 'Dyrebutikk',
      bg: '#ff8fb1',
      y: 8.6,
      z: 0,
      w: 7.2,
      logo: (lg) => {
        // paw print
        sph(lg, '#ffffff', [0, -0.1, 0.1], [0.55, 0.45, 0.2]);
        for (const [ox, oy] of [[-0.45, 0.35], [-0.15, 0.5], [0.15, 0.5], [0.45, 0.35]]) {
          sph(lg, '#ffffff', [ox, oy, 0.1], [0.28, 0.28, 0.15]);
        }
      },
    });
    const inside = fillPetShop(g);
    const f = front(P.pets, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.pets, f.rot);
    walkIns.push({ kind: 'pets', x: P.pets.x, z: P.pets.z, rot: f.rot, hw: 8, hd: 6, roof: roofG, shell });
    const z = toWorld(P.pets, f.rot, inside.counter.x, inside.counter.z);
    zones.push({ kind: 'pets', x: z.x, z: z.z, r: 3.2, label: 'Dyrebutikk 🐾' });
    const door = front(P.pets, 9.5);
    entrances.pets = { x: door.x, z: door.z, yaw: f.rot };
  }
  // door game hut
  {
    const g = new THREE.Group();
    solid(rbox(g, '#dce4f0', [0, 3, 0], [10, 6, 6]), 'rect', 0, 9);
    cone(g, '#1a3358', [0, 7.5, 0], [12, 3, 8], [0, Math.PI / 4, 0]).scale.set(13, 3, 9);
    const doorCols = ['#ff6f6f', '#ffe066', '#5cc3f2'];
    doorCols.forEach((c, i) => {
      rbox(g, c, [-3 + i * 3, 1.8, 3.05], [2, 3.4, 0.3]);
      sph(g, '#ffffff', [-2.5 + i * 3, 1.8, 3.25], [0.25, 0.25, 0.2]);
      part(g, G.star(), '#ffffff', [-3 + i * 3, 4.3, 3.1], [0.6, 0.6, 0.3]);
    });
    shopSign3d(g, {
      label: 'Dørspillet',
      bg: '#ff4fa8',
      y: 11.0,
      z: 0,
      w: 5.6,
      logo: (lg) => {
        rbox(lg, '#ffe066', [0, 0, 0], [0.9, 1.3, 0.2]);
        sph(lg, '#ffffff', [0.25, 0, 0.15], [0.15, 0.15, 0.1]);
        part(lg, G.star(), '#ff6f6f', [0, 0.85, 0.05], [0.35, 0.35, 0.1]);
      },
    });
    const f = front(P.doors, 0);
    g.position.set(P.doors.x, 0, P.doors.z);
    g.rotation.y = f.rot;
    stat.add(g);
    const z = front(P.doors, 6);
    zones.push({ kind: 'doors', x: z.x, z: z.z, r: 3.5, label: 'Spill Dørspillet 🚪' });
    entrances.doors = { x: z.x, z: z.z, yaw: f.rot + Math.PI };
  }

  // VERTICAL SLICE: futuristic plaza façades (visual shops facing the fountain)
  {
    // Open plaza: shops farther out with sky gaps (concept has breathing room)
    const facades: { label: string; logoColor: string; ang: number; dist: number; w?: number }[] = [
      // Keep |ang| away from 0 and π so nothing sits on N/S road
      { label: 'Solvind Kaffi', logoColor: '#3ecbff', ang: -1.05, dist: 25, w: 12 },
      { label: 'Nordic Tech', logoColor: '#5a8cff', ang: 0.95, dist: 26, w: 12 },
      { label: 'Havblomst Flora', logoColor: '#4a9a62', ang: 2.15, dist: 27, w: 12 },
      { label: 'Solcelle', logoColor: '#e8a040', ang: -2.15, dist: 27, w: 11 },
      { label: 'Byte Lab', logoColor: '#c88bff', ang: 3.05, dist: 28, w: 11 },
    ];
    for (const f of facades) {
      const shop = buildFuturisticShop({ label: f.label, logoColor: f.logoColor, w: f.w, d: 9, storeys: 2, variant: Math.abs(Math.round(f.ang * 10)) });
      const x = Math.sin(f.ang) * f.dist;
      const z = Math.cos(f.ang) * f.dist;
      shop.position.set(x, 0, z);
      shop.rotation.y = f.ang + Math.PI; // face plaza center
      shop.userData.noFade = false;
      {
        const hit = cyl(stat, '#f2f5f8', [x, 3.5, z], [f.w! * 0.55, 7, 4.5]);
        hit.visible = false;
        solid(hit, 'circle', 0.2, 8);
      }
      // keep unmerged so PBR glass/wood survive (mergeStatic washes façades)
      group.add(shop);
      shadowAll(shop);
    }
    // planters + trees in plaza ring AND in façade gaps (sky/greenery readable)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      const pl = buildPlanter();
      pl.position.set(Math.sin(a) * 10.5, 0, Math.cos(a) * 10.5);
      pl.rotation.y = a;
      stat.add(pl);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.55;
      tree(stat, Math.sin(a) * 18.5, Math.cos(a) * 18.5, 1.15 + (i % 3) * 0.1, i % 3, true);
    }
    // extra trees in southern approach (camera side) so skyline isn't a wall
    for (const [x, z] of [[-8, -16], [8, -16], [-12, -12], [12, -12], [0, -18]] as const) {
      tree(stat, x, z, 1.1, Math.abs(x + z) % 3, true);
    }
  }

  // VERTICAL SLICE street: façades + sidewalks from plaza toward home (+Z belt)
  {
    // Side façades face the road (inward); endcaps face along the belt
    const streetLabels = [
      { label: 'Aether Atelier', logoColor: '#7ef0ff', x: -16, z: 26, rot: Math.PI / 2 },
      { label: 'Nordlys', logoColor: '#5a8cff', x: 16, z: 26, rot: -Math.PI / 2 },
      { label: 'Pulse Gym', logoColor: '#ff6f6f', x: -16, z: 40, rot: Math.PI / 2 },
      { label: 'Orbit Deli', logoColor: '#e8a040', x: 16, z: 40, rot: -Math.PI / 2 },
      { label: 'Cloud Clinic', logoColor: '#54c45e', x: -16, z: 54, rot: Math.PI / 2 },
      { label: 'Lumen Spa', logoColor: '#c88bff', x: 16, z: 54, rot: -Math.PI / 2 },
    ];
    for (const s of streetLabels) {
      const shop = buildFuturisticShop({ label: s.label, logoColor: s.logoColor, w: 12, d: 8, storeys: 2 + (Math.abs(s.x) > 10 ? 1 : 0) });
      shop.position.set(s.x, 0, s.z);
      shop.rotation.y = s.rot;
      {
        const hit = cyl(stat, '#f2f5f8', [s.x, 3.5, s.z], [6, 8, 4.5]);
        hit.visible = false;
        solid(hit, 'circle', 0.2, 9);
      }
      group.add(shop);
      shadowAll(shop);
    }
    // sidewalk strips + planting beds along street belt and N–S approach
    for (const [x, z, sx, sz] of [
      [0, 48, 48, 3.2],
      [-22, 48, 3.2, 28],
      [22, 48, 3.2, 28],
      // N–S road sidewalks (plaza approach, camera side)
      [-5.6, 8, 2.4, 52],
      [5.6, 8, 2.4, 52],
      [-5.6, -12, 2.4, 28],
      [5.6, -12, 2.4, 28],
    ] as const) {
      const walk = new THREE.Mesh(
        new THREE.BoxGeometry(sx, 0.08, sz),
        pavingGroundMaterial(),
      );
      walk.position.set(x, 0.06, z);
      walk.receiveShadow = true;
      walk.userData.noCast = true;
      group.add(walk);
    }
    // planting beds between sidewalk and façades
    for (const [x, z, sx, sz] of [
      [-12, 32, 3.2, 8], [12, 32, 3.2, 8],
      [-12, 46, 3.2, 8], [12, 46, 3.2, 8],
      [-8.5, 10, 2.2, 6], [8.5, 10, 2.2, 6],
      [-8.5, -8, 2.2, 5], [8.5, -8, 2.2, 5],
    ] as const) {
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(sx, 0.18, sz),
        SharedMats.concrete.clone(),
      );
      (bed.material as THREE.MeshStandardMaterial).color.set('#9aa3ae');
      bed.position.set(x, 0.1, z);
      bed.receiveShadow = true;
      bed.userData.noCast = true;
      group.add(bed);
      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(sx - 0.25, 0.08, sz - 0.25),
        grassGroundMaterial().clone(),
      );
      (soil.material as THREE.MeshStandardMaterial).color.set('#6f8f5e');
      soil.position.set(x, 0.2, z);
      soil.receiveShadow = true;
      soil.userData.noCast = true;
      group.add(soil);
    }
    // cyan curb / edge lights along road edges
    for (const side of [-4.05, 4.05] as const) {
      for (let z = -24; z <= 56; z += 3.2) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.05, 2.4),
          glowMat('#3ecbff', 1.6),
        );
        strip.position.set(side, 0.06, z);
        strip.userData.noCast = true;
        group.add(strip);
      }
    }
    for (const z of [45.5, 50.5] as const) {
      for (let x = -20; x <= 20; x += 3.2) {
        if (Math.abs(x) < 5) continue;
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.05, 0.12),
          glowMat('#3ecbff', 1.4),
        );
        strip.position.set(x, 0.06, z);
        strip.userData.noCast = true;
        group.add(strip);
      }
    }
    // street trees (chase-cam belt + plaza approach)
    for (const [x, z] of [
      [-9, 26], [9, 26], [-9, 32], [9, 32], [-9, 38], [9, 38],
      [-10, 45], [10, 45], [-10, 55], [10, 55], [-26, 48], [26, 48],
    ] as const) {
      tree(stat, x, z, 1.05, Math.abs(x + z) % 3, true);
    }
  }


  // parked cars on asphalt parking bays (NOT plaza, NOT grass)
  {
    const parked = [
      // south approach — on asphalt, clear of chase cam at z≈28
      { id: 'bil-bla', x: 1.7, z: -18.5, yaw: Math.PI },
      { id: 'bil-lilla', x: -1.7, z: -22.0, yaw: 0 },
      // north road — before chase spawn (z=28)
      { id: 'bil-rosa', x: 1.7, z: 16.5, yaw: 0 },
      { id: 'bil-gronn', x: -1.7, z: 19.5, yaw: Math.PI },
      // Keep +Z approach clear for chase cam (player ~z=28–32, cam ~10 m behind)
      { id: 'bil-gul', x: 1.7, z: 52.0, yaw: 0 },
      { id: 'bil-bla', x: -1.7, z: 55.0, yaw: Math.PI },
    ];
    for (const c of parked) {
      // asphalt bay pad under each car
      const bay = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.05, 5.2),
        asphaltGroundMaterial(),
      );
      bay.position.set(c.x, 0.08, c.z);
      bay.receiveShadow = true;
      bay.userData.noCast = true;
      stat.add(bay);
      const car = buildCar(c.id);
      car.position.set(c.x, 0, c.z);
      car.rotation.y = c.yaw;
      car.name = `parked-${c.id}`;
      car.userData.noFade = true;
      car.userData.parkedCar = true;
      {
        const hit = cyl(stat, '#888', [c.x, 0.4, c.z], [1.0, 0.8, 1.8]);
        hit.visible = false;
        solid(hit, 'circle', 0.15, 1.2);
      }
      group.add(car);
      shadowAll(car);
    }
  }


  // Ambient plaza people + road hover traffic (concept: busy street)
  {
    const skinCols = ['#f0c9a8', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'];
    const shirtCols = ['#3ecbff', '#5a8cff', '#e8eef4', '#c88bff', '#54c45e', '#ff6f6f'];
    const mkPerson = (x: number, z: number, yaw: number, seed: number) => {
      const g = new THREE.Group();
      const skin = skinCols[seed % skinCols.length]!;
      const shirt = shirtCols[(seed * 3) % shirtCols.length]!;
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.55, 4, 8),
        new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.65, metalness: 0.05 }),
      );
      body.position.y = 0.95;
      g.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
      );
      head.position.y = 1.55;
      g.add(head);
      const legs = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.14, 0.35, 4, 8),
        new THREE.MeshStandardMaterial({ color: '#2a3344', roughness: 0.7 }),
      );
      legs.position.y = 0.4;
      g.add(legs);
      g.position.set(x, 0, z);
      g.rotation.y = yaw;
      g.userData.noFade = true;
      return g;
    };
    const walkers: [number, number, number, number][] = [
      // plaza ring
      [6, -4, 0.4, 1], [-7, 3, -1.2, 2], [3, 8, 2.1, 3], [-4, -9, 0.8, 4],
      [10, 2, -0.5, 5], [-11, -2, 1.7, 6], [2, 14, 3.0, 7], [-2, 18, 0.2, 8],
      // sidewalks toward home / chase view
      [-5.2, 22, 0.05, 9], [5.4, 28, Math.PI, 10], [-5.3, 34, 0.1, 11],
      [5.5, 40, Math.PI + 0.1, 12], [-5.1, 12, 0, 13], [5.2, 8, Math.PI, 14],
      [8, 26, -1.4, 15], [-9, 36, 1.5, 16],
    ];
    for (const [x, z, yaw, seed] of walkers) {
      const p = mkPerson(x, z, yaw, seed);
      group.add(p);
      shadowAll(p);
    }
    // Moving/road hover cars in view (ahead + sides of chase spawn)
    const traffic = [
      { id: 'bil-rosa', x: 1.6, z: 12, yaw: 0 },
      { id: 'bil-lilla', x: -1.6, z: 6, yaw: Math.PI },
      { id: 'bil-gul', x: 1.55, z: -6, yaw: 0 },
      { id: 'bil-gronn', x: -1.55, z: 24, yaw: Math.PI },
      { id: 'bil-bla', x: 1.6, z: 36, yaw: 0 },
    ];
    for (const c of traffic) {
      const car = buildCar(c.id);
      car.position.set(c.x, 0, c.z);
      car.rotation.y = c.yaw;
      car.name = `traffic-${c.id}-${c.z}`;
      car.userData.noFade = true;
      group.add(car);
      shadowAll(car);
    }
  }

  // playground
  const equipTargets: THREE.Object3D[] = [];
  const swingGroups: THREE.Group[] = [];
  const seesawGroup = new THREE.Group();
  const merryGroup = new THREE.Group();
  let playRot = 0;
  let equipUse: { id: string; u: number } | null = null;
  {
    const g = new THREE.Group();
    cyl(g, '#ffe8a8', [0, 0.05, 0], [22, 0.1, 22]);
    // slide: tower is fixed, the ramp is a separate (tappable) piece
    for (const x of [-0.8, 0.8]) solid(box(g, '#ff6f6f', [x - 4, 2, -3], [0.3, 4, 0.3]), 'rect', 0.1);
    box(g, '#5cc3f2', [-4, 3.8, -3], [2.2, 0.3, 2]);
    cone(g, '#ff6f6f', [-4, 5.2, -3], [3, 2, 3], [0, Math.PI / 4, 0]);
    // swing frame (the seats are animated pieces below)
    for (const x of [1.5, 6.5]) for (const z of [-4, -2]) solid(box(g, '#7ccf6a', [x, 2.5, z], [0.3, 5, 0.3], [z === -4 ? 0.2 : -0.2, 0, 0]), 'rect', 0.15);
    box(g, '#7ccf6a', [4, SWING_PIVOT_Y, SWING_Z], [5.6, 0.3, 0.3]);
    // sandbox
    solid(rbox(g, '#c98a55', [4, 0.3, 4], [5, 0.6, 5]));
    box(g, '#ffe0a0', [4, 0.5, 4], [4.4, 0.2, 4.4]);
    cone(g, '#ff6f6f', [3.2, 1, 3.4], [0.8, 0.9, 0.8]);
    cone(g, '#555a75', [SEESAW.x, 0.4, SEESAW.z], [1, 0.8, 1]); // seesaw support

    // the pieces that move while somebody is on them
    const anim = new THREE.Group();
    equipTargets.length = 0;
    const tag = (o: THREE.Object3D, id: string) => {
      o.userData.equip = id;
      equipTargets.push(o);
      return o;
    };
    const rampMesh = solid(box(anim, '#ffe066', [SLIDE.x, SLIDE.y, SLIDE.z], [1.6, SLIDE.thick, SLIDE.len], [SLIDE.tilt, 0, 0]));
    tag(rampMesh, 'slide');
    for (const sx of [-0.85, 0.85]) {
      const rail = box(anim, '#ff9f4a', [SLIDE.x + sx, SLIDE.y + 0.25, SLIDE.z], [0.12, 0.3, SLIDE.len], [SLIDE.tilt, 0, 0]);
      rail.userData.equip = 'slide';
      equipTargets.push(rail);
    }
    swingGroups.length = 0;
    SWING_XS.forEach((x, i) => {
      const sg = new THREE.Group();
      sg.position.set(x, SWING_PIVOT_Y, SWING_Z);
      for (const sx of [-0.5, 0.5]) box(sg, '#c0c6d6', [sx, -SWING_ROPE / 2, 0], [0.05, SWING_ROPE, 0.05]);
      solid(rbox(sg, '#ff8fb1', [0, -SWING_ROPE, 0], [1.3, 0.2, 0.7]));
      anim.add(sg);
      tag(sg, `swing${i + 1}`);
      swingGroups.push(sg);
    });
    // seesaw: the plank turns about its middle
    seesawGroup.position.set(SEESAW.x, SEESAW.y, SEESAW.z);
    solid(box(seesawGroup, '#c88bff', [0, 0, 0], [SEESAW.len, SEESAW.thick, 0.8]));
    for (const sx of [-1, 1]) box(seesawGroup, '#ffe066', [sx * 1.7, 0.45, 0], [0.12, 0.7, 0.5]);
    anim.add(seesawGroup);
    tag(seesawGroup, 'seesaw');
    // merry-go-round: a coloured disc that spins
    merryGroup.position.set(MERRY.x, MERRY.y, MERRY.z);
    solid(cyl(merryGroup, '#ffb84d', [0, 0, 0], [MERRY.radius * 2, MERRY.thick, MERRY.radius * 2]), 'circle', 0, 3);
    cyl(merryGroup, '#ff6f6f', [0, 1, 0], [0.3, 2, 0.3]);
    ['#ff6f6f', '#5cc3f2', '#ffe066', '#7ccf6a'].forEach((c, i) => {
      const a = (i / 4) * Math.PI * 2;
      box(merryGroup, c, [Math.cos(a) * 1.5, 0.4, Math.sin(a) * 1.5], [0.9, 0.5, 0.9], [0, -a, 0]);
    });
    anim.add(merryGroup);
    tag(merryGroup, 'merry');
    // trampoline
    const trampGroup = new THREE.Group();
    trampGroup.position.set(TRAMP.x, TRAMP.y, TRAMP.z);
    solid(cyl(trampGroup, '#5a6a7a', [0, 0, 0], [TRAMP.radius * 2.1, TRAMP.thick, TRAMP.radius * 2.1]), 'circle', 0, 2);
    cyl(trampGroup, '#c88bff', [0, 0.06, 0], [TRAMP.radius * 1.85, 0.08, TRAMP.radius * 1.85]);
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      box(trampGroup, '#ff8fb1', [Math.cos(a) * TRAMP.radius, 0.55, Math.sin(a) * TRAMP.radius], [0.12, 1.1, 0.12]);
    }
    anim.add(trampGroup);
    tag(trampGroup, 'tramp');
    // fence built in local space; group later rotates by play.rot. Local +Z
    // becomes world forward, so the gate must open at a = π/2 (local +Z).
    const gateA = Math.PI / 2;
    const inGate = (a: number) => Math.abs(Math.atan2(Math.sin(a - gateA), Math.cos(a - gateA))) < 0.4;
    const FENCE_N = 28;
    for (let i = 0; i < FENCE_N; i++) {
      const a = (i / FENCE_N) * Math.PI * 2;
      if (inGate(a)) continue;
      solid(rbox(g, '#ffffff', [Math.cos(a) * 11, 0.7, Math.sin(a) * 11], [0.4, 1.4, 0.4]));
      const a2 = ((i + 0.5) / FENCE_N) * Math.PI * 2;
      if (inGate(a) || inGate(((i + 1) / FENCE_N) * Math.PI * 2)) continue;
      // rail between this post and the next
      const len = 2 * 11 * Math.sin(Math.PI / FENCE_N);
      const r = 11 * Math.cos(Math.PI / FENCE_N);
      solid(box(g, '#f2f2f8', [Math.cos(a2) * r, 0.95, Math.sin(a2) * r], [len, 0.18, 0.14], [0, -a2 + Math.PI / 2, 0]));
      box(g, '#f2f2f8', [Math.cos(a2) * r, 0.45, Math.sin(a2) * r], [len, 0.14, 0.12], [0, -a2 + Math.PI / 2, 0]);
    }
    // no logo/sign on the playground (Thomas)
    const f = front(P.play, 0);
    g.position.set(P.play.x, 0, P.play.z);
    g.rotation.y = f.rot;
    stat.add(g);
    anim.position.copy(g.position);
    anim.rotation.y = f.rot;
    group.add(anim);
    shadowAll(anim, true, true);
    const ac = collectColliders(anim);
    rects.push(...ac.rects);
    circles.push(...ac.circles);
    playRot = f.rot;
    zones.push({ kind: 'play', x: P.play.x, z: P.play.z, r: 10.5, label: 'Lekeplassen ⚽' });
    const pp = front(P.play, 13);
    entrances.play = { x: pp.x, z: pp.z, yaw: f.rot + Math.PI };
  }

  const playToWorld = (lx: number, lz: number) => ({
    x: P.play.x + lx * Math.cos(playRot) + lz * Math.sin(playRot),
    z: P.play.z - lx * Math.sin(playRot) + lz * Math.cos(playRot),
  });
  const equipment: WorldEquip[] = EQUIPMENT.map((e) => {
    const c = playToWorld(e.x, e.z);
    const x = playToWorld(e.exit.x, e.exit.z);
    return { ...e, wx: c.x, wz: c.z, exitX: x.x, exitZ: x.z, exitYaw: e.exit.yaw + playRot };
  });

  // trees, bushes, flowers, lamps, benches (deterministic positions)
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  /** Keep solid props far enough apart so walkers cannot wedge between them. */
  const solids: { x: number; z: number; r: number }[] = [];
  const tooClose = (x: number, z: number, r: number) => solids.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + r + 1.3);
  const blocked = (x: number, z: number) =>
    Math.hypot(x, z) < PLAZA_R + 3 ||
    Object.values(P).some((p) => Math.hypot(x - p.x, z - p.z) < 16) ||
    onRoad(x, z, roads, 2.5);
  for (let i = 0; i < 140; i++) {
    const x = (rnd() - 0.5) * SIZE * 0.95;
    const z = (rnd() - 0.5) * SIZE * 0.95;
    const s = 0.8 + rnd() * 0.6;
    if (blocked(x, z) || tooClose(x, z, 0.9 * s)) continue;
    tree(stat, x, z, s, Math.floor(rnd() * 4), true);
    solids.push({ x, z, r: 0.9 * s });
  }
  // a ring of trees on the edge
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r = SIZE / 2 + 4 + (i % 3) * 3;
    tree(stat, Math.cos(a) * r, Math.sin(a) * r, 1.3, i % 4);
  }
  const flowerCols = ['#6a9a58', '#5a8a4a', '#7aaa68', '#4a7a40', '#8aba78'];
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * SIZE * 0.9;
    const z = (rnd() - 0.5) * SIZE * 0.9;
    if (blocked(x, z)) continue;
    if (i % 4 === 0) {
      if (tooClose(x, z, 1.2)) continue;
      solid(sph(stat, '#5cc36b', [x, 0.5, z], [2, 1.4, 2]), 'circle', 0.1);
      solids.push({ x, z, r: 1.2 });
    } else {
      box(stat, '#3fbf5a', [x, 0.3, z], [0.08, 0.6, 0.08]);
      sph(stat, flowerCols[i % 5], [x, 0.65, z], [0.35, 0.3, 0.35]);
    }
  }
  // lamps and benches from the layout helper – never on a road
  for (const L of lampSpots(roads)) {
    solid(cyl(stat, '#2a3340', [L.x, 2.6, L.z], [0.12, 5.2, 0.12]), 'circle', 0.2, 5.5);
    cyl(stat, '#1a2230', [L.x, 5.3, L.z], [0.55, 0.08, 0.55]);
    sph(stat, '#e8f4ff', [L.x, 5.15, L.z], [0.35, 0.12, 0.35], undefined, 0.7);
  }
  for (const b of benchSpots(roads)) {
    const sitYaw = b.yaw;
    const fx = Math.sin(sitYaw);
    const fz = Math.cos(sitYaw);
    const bench = buildModernBench();
    bench.position.set(b.x, 0, b.z);
    bench.rotation.y = sitYaw;
    // keep unmerged so wood/metal slats survive mergeStatic
    group.add(bench);
    shadowAll(bench);
    // footprint collider
    solid(cyl(stat, '#2a3344', [b.x, 0.3, b.z], [0.5, 0.6, 0.5]), 'circle', 0.05, 0.7);
    const sitX = b.x + fx * 0.12;
    const sitZ = b.z + fz * 0.12;
    benches.push({ x: sitX, z: sitZ, yaw: sitYaw });
  }
  // hills at the edge
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    sph(stat, '#3d7a48', [Math.cos(a) * (SIZE / 2 + 25), 0, Math.sin(a) * (SIZE / 2 + 25)], [50, 26, 50]);
  }
  // distant skyline towers (detailed)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.4;
    const dist = SIZE / 2 + 18 + (i % 5) * 8;
    const th = 28 + (i * 17) % 55;
    const tower = buildSkylineTower(th);
    tower.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
    tower.rotation.y = a + Math.PI;
    group.add(tower);
  }

  // colliders come from the real meshes that were marked solid()
  const fixed = collectColliders(stat);
  rects.push(...fixed.rects);
  circles.push(...fixed.circles);

  const merged = mergeStatic(stat, { cast: true, receive: true });
  group.add(merged);

  // clouds (separate so they can drift)
  const clouds = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) sph(c, '#ffffff', [j * 2.4 - 3.6, Math.sin(j) * 0.8, (j % 2) * 1.2], [4 - Math.abs(j - 1.5), 3 - Math.abs(j - 1.5) * 0.6, 3]);
    c.position.set((rnd() - 0.5) * SIZE * 1.2, 30 + rnd() * 12, (rnd() - 0.5) * SIZE * 1.2);
    clouds.add(c);
  }
  const mergedClouds = mergeStatic(clouds);
  group.add(mergedClouds);

  // drones — near plaza (gate-visible) + far sky
  const drones: THREE.Group[] = [];
  for (let i = 0; i < 12; i++) {
    const dr = new THREE.Group();
    rbox(dr, '#d8e2f0', [0, 0, 0], [0.9, 0.28, 0.7]);
    rbox(dr, '#3ecbff', [0, -0.12, 0], [0.5, 0.1, 0.4], undefined, 0.5);
    for (const [ox, oz] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]] as const) {
      cyl(dr, '#8aa0b8', [ox, 0.08, oz], [0.08, 0.12, 0.08]);
      const blade = new THREE.Mesh(G.box(), mat('#cfd8e6', 0, { metalness: 0.3, roughness: 0.4 }));
      blade.position.set(ox, 0.16, oz);
      blade.scale.set(0.55, 0.03, 0.08);
      blade.userData.spin = true;
      dr.add(blade);
    }
    const near = i < 6;
    const a = (i / (near ? 6 : 6)) * Math.PI * 2 + (near ? 0.3 : 0.1);
    const rr = near ? 7 + (i % 3) * 2.2 : 30 + (i % 3) * 8;
    const yy = near ? 5.2 + (i % 3) * 0.7 : 16 + (i % 4) * 2.5;
    dr.position.set(Math.cos(a) * rr, yy, Math.sin(a) * rr);
    dr.userData.baseA = a;
    dr.userData.baseR = rr;
    dr.userData.baseY = yy;
    group.add(dr);
    drones.push(dr);
  }

  // neighbourhood: several house plots (plot 0 = local player). Roads already in network.
  const housePlots: { x: number; z: number; rot: number }[] = HOUSE_PLOTS.map((plot) => ({
    x: plot.x,
    z: plot.z,
    // Neighbourhood plots face north (+Z) onto the EW street belt
    rot: 0,
  }));
  type PlotState = { holder: THREE.Group; rects: RectCollider[]; circles: CircleCollider[]; zone: Zone | null; mountedKey: string | null };
  const plots: PlotState[] = housePlots.map((plot, i) => {
    const holder = new THREE.Group();
    holder.position.set(plot.x, 0, plot.z);
    holder.rotation.y = plot.rot;
    group.add(holder);
    // empty lot pad
    box(holder, GRASS, [0, 0.015, 0], [15, 0.03, 11]).userData.noCast = true;
    return { holder, rects: [], circles: [], zone: i === 0 ? ({ kind: 'home', x: 0, z: 0, r: HOME_ENTER_RADIUS, label: 'Gå inn 🏠' } as Zone) : null, mountedKey: null };
  });
  if (plots[0].zone) zones.push(plots[0].zone);

  function mountHouseOn(plotIdx: number, style: HouseStyle | null, label?: string, locked = false) {
    const plot = housePlots[plotIdx];
    const st = plots[plotIdx];
    if (!plot || !st) return;
    const key = style ? `${style}|${label ?? ''}|${locked ? 1 : 0}` : '';
    if (st.mountedKey === key) return; // idempotent — MP syncs every tick
    st.mountedKey = key;
    for (const r of st.rects) {
      const i = rects.indexOf(r);
      if (i >= 0) rects.splice(i, 1);
    }
    for (const c of st.circles) {
      const i = circles.indexOf(c);
      if (i >= 0) circles.splice(i, 1);
    }
    st.rects = [];
    st.circles = [];
    st.holder.clear();
    // Keep holder synced to (possibly relocated) plot coords — used by MP proofs too.
    st.holder.position.set(plot.x, 0, plot.z);
    st.holder.rotation.y = plot.rot;
    box(st.holder, GRASS, [0, 0.015, 0], [15, 0.03, 11]).userData.noCast = true;
    if (!style) {
      if (st.zone && plotIdx !== 0) {
        const zi = zones.indexOf(st.zone);
        if (zi >= 0) zones.splice(zi, 1);
        st.zone = null;
      }
      return;
    }
    const ext = homeExterior(style, locked);
    // Prefer the peer's name plate over the generic «Hjem» label on remote plots.
    if (label) {
      const toRemove: THREE.Object3D[] = [];
      ext.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && (m.geometry as THREE.BufferGeometry)?.type === 'PlaneGeometry' && (m.material as THREE.Material)?.transparent) {
          toRemove.push(m);
        }
      });
      for (const m of toRemove) m.parent?.remove(m);
      const size = ext.userData.size as { w: number; d: number };
      const postZ = size.d / 2 + 2.4;
      cyl(ext, '#8a5a3c', [0, 1.4, postZ], [0.18, 2.8, 0.18]);
      const status = doorLockStatus(locked);
      sign(ext, status, 3.0, postZ + 0.05, locked ? '#555a75' : '#54c45e', 2.6);
      sign(ext, label.slice(0, 8), 4.4, postZ + 0.05, locked ? '#555a75' : '#54c45e', 3.2);
    }
    const size = ext.userData.size as { w: number; d: number };
    // Parent first so collectColliders reads world-space footprints for the plot.
    st.holder.add(ext);
    st.holder.updateMatrixWorld(true);
    const hc = collectColliders(ext);
    st.rects = hc.rects;
    st.circles = hc.circles;
    rects.push(...st.rects);
    circles.push(...st.circles);
    shadowAll(ext);
    const dist = size.d / 2 + 2.2;
    if (plotIdx === 0) {
      const zone = plots[0].zone!;
      zone.x = plot.x + Math.sin(plot.rot) * dist;
      zone.z = plot.z + Math.cos(plot.rot) * dist;
      entrances.home = { x: plot.x + Math.sin(plot.rot) * (dist + 2), z: plot.z + Math.cos(plot.rot) * (dist + 2), yaw: plot.rot };
    }
  }
  function setHomeStyle(style: HouseStyle, locked = false) {
    mountHouseOn(0, style, undefined, locked);
  }
  function setPlotHouse(plot: number, style: HouseStyle | null, label?: string, locked = false) {
    if (plot <= 0 || plot >= housePlots.length) return;
    mountHouseOn(plot, style, label, locked);
  }
  setHomeStyle('hytte');

  function buildingAt(x: number, z: number) {
    for (const b of walkIns) {
      const lx = (x - b.x) * Math.cos(b.rot) - (z - b.z) * Math.sin(b.rot);
      const lz = (x - b.x) * Math.sin(b.rot) + (z - b.z) * Math.cos(b.rot);
      if (Math.abs(lx) < b.hw - 0.3 && Math.abs(lz) < b.hd - 0.3) return { kind: b.kind as 'shop' | 'vet' | 'cars' | 'pets', x: b.x, z: b.z, r: Math.hypot(b.hw, b.hd) + 1.5 };
    }
    return null;
  }
  function insideBuilding(x: number, z: number): 'shop' | 'vet' | 'cars' | 'pets' | null {
    return buildingAt(x, z)?.kind ?? null;
  }

  return {
    group,
    zones,
    rects,
    circles,
    surfaces,
    benches,
    roads,
    housePlots,
    get spawn() {
      return { x: entrances.home.x, z: entrances.home.z, yaw: entrances.home.yaw };
    },
    entrances,
    vetBeds,
    setHomeStyle,
    setPlotHouse,
    equipment,
    equipTargets,
    setEquipUse(use) {
      equipUse = use;
      if (!use) {
        swingGroups.forEach((sg) => (sg.rotation.x = 0));
        seesawGroup.rotation.z = 0;
      }
    },
    seatWorld(id, u) {
      const l = seatAt(id, u);
      const w = playToWorld(l.x, l.z);
      const f = playToWorld(l.focus.x, l.focus.z);
      return { ...l, x: w.x, z: w.z, yaw: l.yaw + playRot, focus: { x: f.x, y: l.focus.y, z: f.z } };
    },
    insideBuilding,
    buildingAt,
    size: SIZE,
    update(t: number, px?: number, pz?: number, camX?: number, camZ?: number) {
      for (const b of walkIns) {
        const inside = px !== undefined && pz !== undefined && insideBuilding(px, pz) === b.kind;
        b.roof.visible = !inside;
        // walls between the camera and the player are hidden, the others stay
        const cx = camX ?? b.x;
        const cz = camZ ?? b.z;
        const lx = (cx - b.x) * Math.cos(b.rot) - (cz - b.z) * Math.sin(b.rot);
        const lz = (cx - b.x) * Math.sin(b.rot) + (cz - b.z) * Math.cos(b.rot);
        b.shell.back.visible = !inside || lz > -b.hd + 0.5;
        b.shell.front.visible = !inside || lz < b.hd - 0.5;
        b.shell.left.visible = !inside || lx > -b.hw + 0.5;
        b.shell.right.visible = !inside || lx < b.hw - 0.5;
      }
      mergedClouds.position.x = Math.sin(t * 0.02) * 20;
      if (equipUse) {
        const u = equipUse.u;
        if (equipUse.id.startsWith('swing')) swingGroups[Number(equipUse.id.slice(5)) - 1].rotation.x = -swingAngle(u);
        else if (equipUse.id === 'seesaw') seesawGroup.rotation.z = seesawAngle(u);
        else if (equipUse.id === 'merry') merryGroup.rotation.y = -merryAngle(u);
      }
      if (waterSurf) waterSurf.position.y = 0.5 + Math.sin(t * 2) * 0.012;
      // Jets on for ~2.2s, off for ~1.8s
      const jetOn = true; // always on for visual fidelity
      for (const ring of fountainRings) {
        ring.visible = true;
        ring.rotation.z = t * 0.6;
      }
      for (let di = 0; di < drones.length; di++) {
        const dr = drones[di]!;
        const a = dr.userData.baseA + t * (0.08 + (di % 3) * 0.02);
        const rr = dr.userData.baseR as number;
        dr.position.x = Math.cos(a) * rr;
        dr.position.z = Math.sin(a) * rr;
        dr.position.y = (dr.userData.baseY as number) + Math.sin(t * 1.4 + di) * 0.6;
        dr.rotation.y = -a + Math.PI / 2;
        dr.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && o.userData.spin) o.rotation.y = t * 18 + di;
        });
      }
      // Jets share materials — never rewrite shared opacity (cascaded to ~0 before).
      for (let i = 0; i < jets.length; i++) {
        jets[i]!.visible = jetOn;
      }
    },
  };
}
