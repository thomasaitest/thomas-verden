import { beforeAll, describe, expect, it } from 'vitest';
import { HOUSES, type HouseStyle } from '../logic/catalog.ts';
import { blocked, movePlayer, resolve, type Colliders } from '../logic/collision.ts';
import { newHouse, type House, type PlacedItem } from '../logic/house.ts';
import { installDomStub } from '../test/domStub.ts';
import type { Interior } from './interior.ts';
import type { Town } from './town.ts';
import { PLACES as LAYOUT_PLACES, faceStreet } from '../logic/townLayout.ts';

const R = 0.55; // walking player radius in the town
let town: Town;
let mkInterior: () => Interior;
let furnitureColliders: typeof import('./interior.ts').furnitureColliders;

beforeAll(async () => {
  installDomStub();
  const t = await import('./town.ts');
  const i = await import('./interior.ts');
  town = t.buildTown();
  mkInterior = i.createInterior;
  furnitureColliders = i.furnitureColliders;
});

const col = (): Colliders => town;
const local = (p: { x: number; z: number }, rot: number, lx: number, lz: number) => ({
  x: p.x + lx * Math.cos(rot) + lz * Math.sin(rot),
  z: p.z - lx * Math.sin(rot) + lz * Math.cos(rot),
});
const faceCenter = (x: number, z: number) => faceStreet(x, z);
const PLACES = {
  shop: LAYOUT_PLACES.shop,
  vet: LAYOUT_PLACES.vet,
  eggs: LAYOUT_PLACES.eggs,
  doors: LAYOUT_PLACES.doors,
  play: LAYOUT_PLACES.play,
  home: LAYOUT_PLACES.home,
};

describe('town colliders', () => {
  it('has colliders for the fountain and every landmark', () => {
    expect(blocked(0, 0, R, col())).toBe(true); // fountain
    expect(blocked(3.5, 0, R, col())).toBe(true); // fountain rim
    for (const k of ['eggs', 'doors'] as const) {
      const p = PLACES[k];
      expect(blocked(p.x, p.z, R, col()), k).toBe(true);
    }
    expect(town.circles.length).toBeGreaterThan(60); // trees, bushes, lamps
    expect(town.rects.length).toBeGreaterThan(20);
  });

  it('shop, egg shop and door hut cannot be walked through from any side', () => {
    for (const k of ['shop', 'eggs', 'doors'] as const) {
      const p = PLACES[k];
      const rot = 'rot' in p && typeof (p as { rot?: number }).rot === 'number' ? (p as { rot: number }).rot : faceCenter(p.x, p.z);
      for (const [lx, lz] of [[-12, 0], [12, 0], [0, -12], [0, 12], [-10, 10], [10, -10]]) {
        if (k === 'shop' && lx === 0 && lz === 12) continue; // the shop has a door in front: you can walk in
        const s = local(p, rot, lx, lz);
        const pos = { x: s.x, y: 0, z: s.z };
        // walk straight at the building centre
        movePlayer(pos, p.x - s.x, p.z - s.z, R, col());
        expect(Math.hypot(pos.x - p.x, pos.z - p.z), `${k} from ${lx},${lz}`).toBeGreaterThan(3);
      }
    }
  });

  it('shop: you can walk in through the door; walls, counter, shelves and displays are solid', () => {
    const p = PLACES.shop;
    const rot = 'rot' in p && typeof (p as { rot?: number }).rot === 'number' ? (p as { rot: number }).rot : faceCenter(p.x, p.z);
    const free = (lx: number, lz: number) => blocked(local(p, rot, lx, lz).x, local(p, rot, lx, lz).z, R, col());
    // the doorway and the way in are open, the walls either side of it are not
    for (const [lx, lz] of [[0, 8], [0, 5], [0, 3.5], [1.5, 4.8], [-1.5, 4.8]]) expect(free(lx, lz), `door ${lx},${lz}`).toBe(false);
    for (const lx of [-4, -3, 3, 4]) expect(free(lx, 4.75), `front wall ${lx}`).toBe(true);
    expect(free(0, -4.4), 'back wall').toBe(true);
    expect(free(-6.7, 0), 'side wall').toBe(true);
    // furniture inside
    expect(free(-2.4, 0.4), 'fruit island').toBe(true);
    expect(free(5, -0.9), 'counter').toBe(true);
    expect(free(0, -3.9), 'shelves').toBe(true);
    expect(free(-5.8, -1.6), 'cooler').toBe(true);
    // walk from outside, through the door, to the counter and shop there
    const zone = town.zones.find((z) => z.kind === 'shop')!;
    expect(town.insideBuilding(zone.x, zone.z)).toBe('shop');
    expect(town.insideBuilding(local(p, rot, 0, 9).x, local(p, rot, 0, 9).z)).toBe(null);
    const s = local(p, rot, 0, 10);
    const pos = { x: s.x, y: 0, z: s.z };
    for (const [lx, lz] of [[0, 3.5], [1.2, 0], [2.9, -0.8]]) {
      const t = local(p, rot, lx, lz);
      for (let i = 0; i < 80; i++) movePlayer(pos, (t.x - pos.x) * 0.15, (t.z - pos.z) * 0.15, R, col());
    }
    expect(Math.hypot(pos.x - zone.x, pos.z - zone.z)).toBeLessThan(zone.r);
    expect(town.insideBuilding(pos.x, pos.z)).toBe('shop');
  });

  it('hospital: walk in through the door, four beds stand along the back wall, walls and furniture block', () => {
    const p = PLACES.vet;
    const rot = 'rot' in p && typeof (p as { rot?: number }).rot === 'number' ? (p as { rot: number }).rot : faceCenter(p.x, p.z);
    const hit = (lx: number, lz: number) => blocked(local(p, rot, lx, lz).x, local(p, rot, lx, lz).z, R, col());
    for (const lz of [-4, -1, 2, 4]) for (const lx of [-6.7, 6.7]) expect(hit(lx, lz), `wall ${lx},${lz}`).toBe(true);
    expect(hit(0, -5.2)).toBe(true);
    for (const lx of [-4.8, -1.6, 1.6, 4.8]) expect(hit(lx, -3.25), `bed ${lx}`).toBe(true);
    expect(town.vetBeds.length).toBe(4);
    for (const b of town.vetBeds) expect(b.y).toBeGreaterThan(0.8);
    // front wall beside the door blocks; the door, the pad and the aisle are open
    for (const lx of [-5, -4, 4, 5]) expect(hit(lx, 5.2), `front wall ${lx}`).toBe(true);
    for (const [lx, lz] of [[0, 1.0], [0, 5], [0, 8], [-1, 3], [0, -1]]) expect(hit(lx, lz), `open ${lx},${lz}`).toBe(false);
    expect(hit(4.9, 1.5), 'reception desk').toBe(true);
    expect(hit(-5.8, 1.3), 'medicine cabinet').toBe(true);
    // can walk in and stand on the pad, and beds are in reach of the care zone
    const s = local(p, rot, 0, 10);
    const pos = { x: s.x, y: 0, z: s.z };
    const pad = local(p, rot, 0, 1.0);
    movePlayer(pos, pad.x - s.x, pad.z - s.z, R, col());
    expect(Math.hypot(pos.x - pad.x, pos.z - pad.z)).toBeLessThan(0.3);
    expect(town.insideBuilding(pos.x, pos.z)).toBe('vet');
    // an animal on a bed does not end up inside a wall
    for (const b of town.vetBeds) expect(town.insideBuilding(b.x, b.z)).toBe('vet');
  });

  it.each(HOUSES.map((h) => h.style))('home (%s): body, porch and mailbox block; the front door zone is reachable', (style: HouseStyle) => {
    town.setHomeStyle(style);
    const p = PLACES.home;
    const rot = 'rot' in p && typeof (p as { rot?: number }).rot === 'number' ? (p as { rot: number }).rot : faceCenter(p.x, p.z);
    expect(blocked(p.x, p.z, R, col())).toBe(true);
    for (const [lx, lz] of [[-5, 0], [5, 0], [0, -3], [0, 3]]) {
      const w = local(p, rot, lx, lz);
      expect(blocked(w.x, w.z, R, col()), `${lx},${lz}`).toBe(true);
    }
    const info = HOUSES.find((h) => h.style === style)!;
    const w = Math.min(22, info.w * 0.65);
    const d = Math.min(18, info.d * 0.7);
    const mail = local(p, rot, 3.5, d / 2 + 3);
    expect(blocked(mail.x, mail.z, R, col()), 'mailbox').toBe(true);
    if (style === 'slott') {
      // the round corner towers stick out past the walls
      const tower = local(p, rot, w / 2 + 1, d / 2 + 1);
      expect(blocked(tower.x, tower.z, R, col()), 'tower').toBe(true);
    }
    const zone = town.zones.find((z) => z.kind === 'home')!;
    expect(blocked(zone.x, zone.z, R, col())).toBe(false);
    // actually walk from the plaza to the door
    const pos = { x: 0, y: 0, z: 0 };
    town.setHomeStyle(style);
    const start = { x: zone.x * 0.5 + 0, y: 0, z: zone.z * 0.5 };
    Object.assign(pos, start);
    for (let i = 0; i < 400; i++) movePlayer(pos, (zone.x - pos.x) * 0.1, (zone.z - pos.z) * 0.1, R, col());
    expect(Math.hypot(pos.x - zone.x, pos.z - zone.z)).toBeLessThan(zone.r);
    town.setHomeStyle('hytte');
  });

  it('switching house style replaces (and does not leak) house colliders', () => {
    town.setHomeStyle('hytte');
    const n = town.rects.length + town.circles.length;
    for (const s of ['slott', 'villa', 'hytte'] as const) town.setHomeStyle(s);
    expect(town.rects.length + town.circles.length).toBe(n);
  });

  it('playground: equipment and fence block, the gate is open', () => {
    const p = PLACES.play;
    const rot = 'rot' in p && typeof (p as { rot?: number }).rot === 'number' ? (p as { rot: number }).rot : faceCenter(p.x, p.z);
    const items: [string, number, number][] = [
      ['slide ladder', -4.8, -3],
      ['swing leg', 1.5, -4],
      ['sandbox', 4, 4],
      ['seesaw', -4, 5.5],
      ['merry-go-round', 0, 7.5],
    ];
    for (const [name, lx, lz] of items) {
      const w = local(p, rot, lx, lz);
      expect(blocked(w.x, w.z, R, col()), name).toBe(true);
    }
    // the fence is a closed ring with exactly one gap (the gate), which faces the plaza
    const steps = 720;
    const open: number[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const w = local(p, rot, Math.cos(a) * 11, Math.sin(a) * 11);
      if (!blocked(w.x, w.z, 0.3, col())) open.push(a);
    }
    // all open angles are contiguous (mod 2pi) = one gate
    let breaks = 0;
    for (let i = 0; i < open.length; i++) {
      const next = open[(i + 1) % open.length];
      const gap = (next - open[i] + Math.PI * 2) % (Math.PI * 2);
      if (gap > (Math.PI * 2) / steps * 1.5) breaks++;
    }
    expect(open.length).toBeGreaterThan(30);
    expect(breaks).toBeLessThanOrEqual(1);
    // and nothing walks in anywhere else (sliding along the rail into the gate is fine, so skip angles near it)
    const gateAngle = Math.atan2(open.reduce((t, a) => t + Math.sin(a), 0), open.reduce((t, a) => t + Math.cos(a), 0));
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + 0.05;
      const out = local(p, rot, Math.cos(a) * 15, Math.sin(a) * 15);
      if (Math.abs(Math.atan2(Math.sin(a - gateAngle), Math.cos(a - gateAngle))) < 1.0) continue;
      const pos = { x: out.x, y: 0, z: out.z };
      movePlayer(pos, p.x - out.x, p.z - out.z, R, col());
      expect(Math.hypot(pos.x - p.x, pos.z - p.z), `fence angle ${a.toFixed(2)}`).toBeGreaterThan(10.3);
    }
  });

  it('trees and bushes block', () => {
    // every tree-sized circle must stop a walker
    const trunks = town.circles.filter((c) => c.r > 0.6 && c.r < 2);
    expect(trunks.length).toBeGreaterThan(50);
    for (const c of trunks.slice(0, 80)) {
      const pos = { x: c.x + c.r + 4, y: 0, z: c.z };
      movePlayer(pos, -(c.r + 4), 0, R, col());
      expect(Math.hypot(pos.x - c.x, pos.z - c.z)).toBeGreaterThanOrEqual(c.r + R - 0.01);
    }
  });

  it('walking randomly never leaves the player inside anything', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 150; n++) {
      const pos = { x: (rnd() - 0.5) * 180, y: 0, z: (rnd() - 0.5) * 180 };
      if (blocked(pos.x, pos.z, R, col())) continue;
      let a = rnd() * Math.PI * 2;
      for (let i = 0; i < 250; i++) {
        if (i % 40 === 0) a += (rnd() - 0.5) * 3;
        movePlayer(pos, Math.cos(a) * 15 * 0.016, Math.sin(a) * 15 * 0.016, R, col(), 98);
        expect(blocked(pos.x, pos.z, R - 0.05, col())).toBe(false);
      }
    }
  });

  it('every entrance and interaction zone is reachable on foot from the spawn', () => {
    const cell = 0.8;
    const half = 98;
    const N = Math.round((half * 2) / cell);
    const open = new Uint8Array(N * N);
    const idx = (ix: number, iz: number) => iz * N + ix;
    const pt = (i: number) => -half + i * cell;
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) open[idx(ix, iz)] = blocked(pt(ix), pt(iz), R, col()) ? 0 : 1;
    const toCell = (v: number) => Math.round((v + half) / cell);
    const seen = new Uint8Array(N * N);
    const sp = town.spawn;
    const stack = [idx(toCell(sp.x), toCell(sp.z))];
    expect(open[stack[0]]).toBe(1);
    seen[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const ix = i % N;
      const iz = (i / N) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jx = ix + dx;
        const jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= N || jz >= N) continue;
        const j = idx(jx, jz);
        if (open[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    for (const z of town.zones) {
      // any open cell inside the zone radius must be reachable
      let ok = false;
      for (let iz = 0; iz < N && !ok; iz++) for (let ix = 0; ix < N && !ok; ix++) if (Math.hypot(pt(ix) - z.x, pt(iz) - z.z) < Math.min(z.r, 3) && seen[idx(ix, iz)]) ok = true;
      expect(ok, `zone ${z.kind}`).toBe(true);
    }
    for (const [k, p] of Object.entries(town.entrances)) {
      expect(blocked(p.x, p.z, R, col()), `place ${k}`).toBe(false);
      expect(seen[idx(toCell(p.x), toCell(p.z))], `place ${k} reachable`).toBe(1);
    }
  });
});

type TestItem = Omit<PlacedItem, 'uid' | 'scale' | 'color' | 'floor'> & { floor?: number };

describe('interior furniture colliders', () => {
  const base = (style: HouseStyle, items: TestItem[]): House => {
    const h = newHouse(style, 'me', 0);
    return { ...h, items: items.map((i, n) => ({ uid: `u${n}`, scale: 1, color: '#ffffff', floor: 0, ...i })) };
  };
  const build = (items: TestItem[]) => {
    const interior = mkInterior();
    const house = base('villa', items);
    interior.build(house);
    return { interior, house };
  };

  it('solid furniture blocks, flat things and wall decor do not', () => {
    const { interior } = build([
      { itemId: 'sofa', x: -4, z: -2, rot: 0 },
      { itemId: 'rundtteppe', x: 4, z: -2, rot: 0 },
      { itemId: 'maleri', x: 0, z: -7.8, rot: 0 },
      { itemId: 'ball', x: 6, z: 2, rot: 0 },
      { itemId: 'matskal', x: 7, z: 2, rot: 0 },
    ]);
    const c: Colliders = { rects: interior.rects, circles: [] };
    expect(interior.rects.length).toBe(1);
    expect(blocked(-4, -2, 0.45, c)).toBe(true);
    expect(blocked(4, -2, 0.45, c)).toBe(false);
    expect(blocked(6, 2, 0.45, c)).toBe(false);
  });

  it('a rotated sofa has a rotated footprint', () => {
    const { interior } = build([{ itemId: 'sofa', x: 0, z: 0, rot: Math.PI / 2 }]);
    const c: Colliders = { rects: interior.rects, circles: [] };
    // sofa is ~3.2 wide (local x) and 1.5 deep; turned 90 degrees it is long along z
    expect(blocked(0, 1.4, 0.3, c)).toBe(true);
    expect(blocked(1.4, 0, 0.3, c)).toBe(false);
  });

  it('you cannot walk through a bed, table or bathtub', () => {
    const { interior } = build([
      { itemId: 'seng', x: -5, z: -4, rot: 0 },
      { itemId: 'spisebord', x: 3, z: -4, rot: 0.5 },
      { itemId: 'badekar', x: 6, z: 3, rot: 0 },
    ]);
    const c: Colliders = { rects: interior.rects, circles: [] };
    for (const [x, z] of [[-5, -4], [3, -4], [6, 3]]) {
      const pos = { x: x + 5, y: 0, z: z + 0.3 };
      movePlayer(pos, -10, 0, 0.45, c);
      expect(blocked(pos.x, pos.z, 0.45, c)).toBe(false);
      expect(Math.abs(pos.x - x) > 0.9 || Math.abs(pos.z - z) > 0.9).toBe(true);
    }
  });

  it('furniture on the door mat never locks you in', () => {
    const interior = mkInterior();
    const house = base('hytte', []);
    interior.build(house);
    const { door } = interior;
    const sofa: PlacedItem = { uid: 'x', itemId: 'sofa', x: door.x, z: door.z, rot: 0, scale: 1, color: '#fff', floor: 0 };
    const h2 = { ...house, items: [sofa] };
    interior.syncItems(h2);
    expect(interior.rects.length).toBe(0);
    expect(furnitureColliders(h2, interior.items, door).length).toBe(0);
  });
});

describe('playground equipment in the town', () => {
  const play = PLACES.play;
  const rot = faceCenter(play.x, play.z);

  it('lists every piece in world coordinates, inside the fence', () => {
    expect(town.equipment.map((e) => e.id).sort()).toEqual(['merry', 'seesaw', 'slide', 'swing1', 'swing2', 'tramp']);
    for (const e of town.equipment) {
      expect(Math.hypot(e.wx - play.x, e.wz - play.z), e.id).toBeLessThan(10);
      expect(town.zones.some((z) => z.kind === 'play' && Math.hypot(e.wx - z.x, e.wz - z.z) < z.r), `${e.id} in the play zone`).toBe(true);
    }
  });

  it('every piece is tappable (it has meshes that carry its id)', () => {
    const ids = new Set<string>();
    for (const o of town.equipTargets) ids.add(o.userData.equip as string);
    expect([...ids].sort()).toEqual(['merry', 'seesaw', 'slide', 'swing1', 'swing2', 'tramp']);
  });

  it('the spot where you step down is free to stand on, and can be walked to from the gate', () => {
    // flood fill over free ground from the playground entrance
    const cell = 0.5;
    const key = (i: number, j: number) => `${i},${j}`;
    const seen = new Set<string>();
    const start = [Math.round(town.entrances.play.x / cell), Math.round(town.entrances.play.z / cell)];
    const queue: number[][] = [start];
    seen.add(key(start[0], start[1]));
    while (queue.length) {
      const [i, j] = queue.pop()!;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        const x = ni * cell;
        const z = nj * cell;
        if (seen.has(key(ni, nj)) || Math.hypot(x - play.x, z - play.z) > 16 || blocked(x, z, R, col())) continue;
        seen.add(key(ni, nj));
        queue.push([ni, nj]);
      }
    }
    for (const e of town.equipment) {
      expect(blocked(e.exitX, e.exitZ, R, col()), `${e.id} exit`).toBe(false);
      expect(seen.has(key(Math.round(e.exitX / cell), Math.round(e.exitZ / cell))), `${e.id} reachable on foot`).toBe(true);
    }
  });

  it('the pieces themselves stay solid when nobody is on them (no walking through the seesaw or the slide)', () => {
    const at = (lx: number, lz: number) => local(play, rot, lx, lz);
    const probes: [string, number, number][] = [['seesaw plank', -4, 5.5], ['seesaw end', -1.5, 5.5], ['merry-go-round', 0, 7.5], ['slide ramp', -4, 0.4], ['swing seat', 2.8, -3]];
    for (const [n, lx, lz] of probes) {
      const w = at(lx, lz);
      expect(blocked(w.x, w.z, R, col()), n).toBe(true);
    }
  });

  it('the avatar sits on the piece in world space (seat follows the playground rotation) and the meshes move with it', () => {
    for (const e of town.equipment) {
      town.setEquipUse({ id: e.id, u: 1.3 });
      town.update(0);
      const seat = town.seatWorld(e.id, 1.3);
      // the seat is near the piece's middle in the world, whatever way the playground faces
      expect(Math.hypot(seat.x - e.wx, seat.z - e.wz), e.id).toBeLessThan(4.5);
      expect(Number.isFinite(seat.yaw)).toBe(true);
    }
    const sw = town.equipTargets.find((o) => o.userData.equip === 'swing1')!;
    town.setEquipUse({ id: 'swing1', u: 1.0 });
    town.update(0);
    expect(Math.abs(sw.rotation.x)).toBeGreaterThan(0.1); // the swing is moving while somebody is on it
    town.setEquipUse(null);
    expect(sw.rotation.x).toBe(0); // and hangs still afterwards
  });
});

describe('toy models', () => {
  it('every toy has a small 3D model standing on the ground, and a made-up one is an error', async () => {
    const { buildToy } = await import('./toys.ts');
    const { TOYS } = await import('../logic/catalog.ts');
    const THREE = await import('three');
    for (const t of TOYS) {
      const g = buildToy(t.id);
      let meshes = 0;
      g.traverse((o) => (meshes += (o as import('three').Mesh).isMesh ? 1 : 0));
      expect(meshes, t.id).toBeGreaterThan(1);
      const b = new THREE.Box3().setFromObject(g);
      const size = b.getSize(new THREE.Vector3());
      expect(Math.max(size.x, size.y, size.z), `${t.id} is a toy-sized thing`).toBeLessThan(1.4);
      expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(0.3);
      expect(b.min.y, `${t.id} stands on the ground`).toBeGreaterThan(-0.15);
      expect(b.min.y).toBeLessThan(0.15);
    }
    expect(() => buildToy('leke-laser')).toThrow();
  });
});


describe('town roads, benches and shop signs (next round)', () => {
  it('exposes a road network that does not run through building centres', () => {
    expect(town.roads.length).toBeGreaterThanOrEqual(12);
    for (const s of town.roads) {
      const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
      if (len < 20) continue; // short door stubs may approach a facade
      for (const p of Object.values(PLACES)) {
        const mx = (s.x1 + s.x2) / 2;
        const mz = (s.z1 + s.z2) / 2;
        expect(Math.hypot(mx - p.x, mz - p.z), `${(p as {id?: string}).id ?? p} mid`).toBeGreaterThan(4);
      }
    }
  });

  it('no bench sits on a road', async () => {
    const { onRoad } = await import('../logic/townLayout.ts');
    expect(town.benches.length).toBeGreaterThanOrEqual(4);
    for (const b of town.benches) {
      expect(onRoad(b.x, b.z, town.roads, 0.9), `${b.x},${b.z}`).toBe(false);
    }
  });

  it('bench sit yaw faces away from the backrest', async () => {
    const { benchBackrestOffset } = await import('../logic/townLayout.ts');
    for (const b of town.benches) {
      const back = benchBackrestOffset(b.yaw);
      const dot = Math.sin(b.yaw) * back.x + Math.cos(b.yaw) * back.z;
      expect(dot).toBeLessThan(-0.2);
    }
  });

  it('a pet circle is pushed out of solid town colliders (same as avatar)', () => {
    const pos = { x: 0, y: 0, z: 0 };
    resolve(pos, 0.5, col());
    expect(Math.hypot(pos.x, pos.z)).toBeGreaterThan(3);
  });
});
