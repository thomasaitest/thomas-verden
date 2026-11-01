import * as THREE from 'three';
import { FURN_BY_ID, HOUSE_BY_STYLE } from '../logic/catalog.ts';
import { roomSize, type House } from '../logic/house.ts';
import { blocked, type CircleCollider, type Colliders, type RectCollider } from '../logic/collision.ts';
import { FLOOR_H, FLOORS, floorColliders, houseLayout, type HouseLayout } from '../logic/layout.ts';
import { footprintOf } from './colliders.ts';
import { buildFurniture } from './furniture.ts';
import { box, G, glowMat, mat, rbox, textTexture } from './kit.ts';
import { SharedMats, physicalGlass } from './pbrTextures.ts';

export const WALL_H = 6.2;

export interface Interior {
  group: THREE.Group;
  w: number;
  d: number;
  layout: HouseLayout;
  door: { x: number; z: number };
  items: Map<string, THREE.Group>;
  /** Solid furniture on the ground floor, rebuilt whenever the items change (see floorRects for every floor). */
  rects: RectCollider[];
  circles: CircleCollider[];
  floorRects: RectCollider[][];
  /** Everything that blocks a walker on a floor: partition walls, stair barriers and furniture. */
  collidersFor(floor: number): Colliders;
  build(house: House): void;
  syncItems(house: House): void;
  /** Hide walls between the camera and what it looks at; hide the upper floor while you are downstairs. */
  updateWalls(cam: THREE.Vector3, focus?: THREE.Vector3, floor?: number): void;
  select(uid: string | null): void;
  update(t: number): void;
}

export function createInterior(): Interior {
  const group = new THREE.Group();
  const shell = new THREE.Group();
  const floorGroups = [new THREE.Group(), new THREE.Group()];
  const furn = new THREE.Group();
  group.add(shell, furn);
  const items = new Map<string, THREE.Group>();
  const itemKeys = new Map<string, string>();
  let walls: { mesh: THREE.Object3D; axis: 'x' | 'z'; at: number; sign: number }[] = [];
  let partitions: { mesh: THREE.Object3D; rect: RectCollider; floor: number }[] = [];
  const ring = new THREE.Mesh(G.torus(), new THREE.MeshBasicMaterial({ color: '#ffe14d' }));
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  group.add(ring);
  let selected: string | null = null;
  let selectedFloor = 0;
  let sets: Colliders[] = [];

  const api: Interior = {
    group,
    w: 22,
    d: 18,
    layout: houseLayout('hytte'),
    door: { x: 0, z: 7.6 },
    items,
    rects: [],
    circles: [],
    floorRects: [[], []],
    collidersFor(floor) {
      return sets[Math.min(FLOORS - 1, Math.max(0, floor))] ?? { rects: [], circles: [] };
    },
    build(house) {
      shell.clear();
      floorGroups.forEach((g) => g.clear());
      shell.add(...floorGroups);
      // Warm cove-style fills — keep moderate so whites don't haze under ACES
      const fill = new THREE.PointLight('#ffd7b0', 1.15, 34, 2);
      fill.name = 'InteriorFillLight';
      fill.position.set(0, 4.2, 0);
      shell.add(fill);
      const fill2 = new THREE.PointLight('#c8e4ff', 0.4, 26, 2);
      fill2.position.set(-5, 3.2, -4);
      shell.add(fill2);
      const fill3 = new THREE.PointLight('#ffe2c0', 0.7, 22, 2);
      fill3.position.set(4, 2.2, 2);
      shell.add(fill3);
      const kit = new THREE.PointLight('#ffcc88', 0.9, 10, 2);
      kit.name = 'KitchenGlow';
      kit.position.set(4.5, 1.1, -2);
      shell.add(kit);
      const { w, d } = roomSize(house.style);
      const L = houseLayout(house.style);
      api.layout = L;
      api.w = w;
      api.d = d;
      api.door = { ...L.door };
      walls = [];
      partitions = [];
      const wallMat = SharedMats.interiorWall.clone();
      wallMat.color.set(house.wallColor || '#c5ccd4');
      const trim = '#d8dee6';
      const st = L.stairs;
      for (let f = 0; f < FLOORS; f++) {
        const fg = floorGroups[f];
        const y0 = f * FLOOR_H;
        // floor slab (the upper one has a hole for the stairs)
        const slab = (x0: number, x1: number, z0: number, z1: number) => {
          if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
          const matFloor = SharedMats.interiorFloor.clone();
          matFloor.color.set(house.floorColor || '#8a929c');
          matFloor.roughness = 0.4;
          matFloor.metalness = 0.12;
          matFloor.envMapIntensity = 1.0;
          const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.4, z1 - z0), matFloor);
          m.position.set((x0 + x1) / 2, y0 - 0.2, (z0 + z1) / 2);
          m.receiveShadow = true;
          fg.add(m);
        };
        if (f === 0) slab(-w / 2, w / 2, -d / 2, d / 2);
        else {
          slab(-w / 2, st.x0, -d / 2, d / 2);
          slab(st.x1, w / 2, -d / 2, d / 2);
          slab(st.x0, st.x1, -d / 2, st.zTop);
          slab(st.x0, st.x1, st.zBottom, d / 2);
        }
        for (let i = 1; i < Math.floor(w / 2); i++) {
          const x = -w / 2 + i * 2;
          const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, d), mat(shade(house.floorColor, -0.08)));
          line.position.set(x, y0 + 0.01, 0);
          if (f === 1 && x > st.x0 - 0.05 && x < st.x1 + 0.05) continue; // no planks over the stair hole (any mid-X)
          fg.add(line);
        }
        const mk = (x: number, z: number, sx: number, sz: number, axis: 'x' | 'z', at: number, sign: number) => {
          const g = new THREE.Group();
          const m = new THREE.Mesh(G.box(), wallMat);
          m.scale.set(sx, WALL_H, sz);
          m.position.set(x, y0 + WALL_H / 2, z);
          m.receiveShadow = true;
          g.add(m);
          box(g, trim, [x, y0 + 0.25, z], [sx + 0.05, 0.5, sz + 0.05]);
          box(g, trim, [x, y0 + WALL_H, z], [sx + 0.1, 0.3, sz + 0.1]);
          fg.add(g);
          walls.push({ mesh: g, axis, at, sign });
          return g;
        };
        const back = mk(0, -d / 2 - 0.2, w + 0.8, 0.4, 'z', -d / 2, -1);
        // panoramic skyline window on back wall (concept 2-hus-inne)
        {
          const panW = Math.min(w * 0.72, 14);
          const panH = 3.6;
          box(back, '#8aa0b8', [0, y0 + 3.4, -d / 2 + 0.05], [panW + 0.3, panH + 0.3, 0.12]);
          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(panW, panH, 0.06),
            physicalGlass('#9ad8ff', 0.55),
          );
          glass.position.set(0, y0 + 3.4, -d / 2 + 0.12);
          back.add(glass);
          const sky = document.createElement('canvas');
          sky.width = 512; sky.height = 256;
          const sctx = sky.getContext('2d')!;
          const grd = sctx.createLinearGradient(0, 0, 0, 256);
          grd.addColorStop(0, '#7eb0d8'); grd.addColorStop(0.55, '#c5d8e8'); grd.addColorStop(1, '#e8eef4');
          sctx.fillStyle = grd; sctx.fillRect(0, 0, 512, 256);
          sctx.fillStyle = '#5a6a78';
          for (let k = 0; k < 22; k++) {
            const bw = 10 + (k * 7) % 28;
            const bh = 40 + (k * 19) % 140;
            sctx.fillRect(8 + k * 23, 256 - bh, bw, bh);
            sctx.fillStyle = '#3ecbff33';
            for (let wy = 0; wy < bh; wy += 10) sctx.fillRect(10 + k * 23, 256 - bh + wy, bw - 4, 3);
            sctx.fillStyle = '#5a6a78';
          }
          const stex = new THREE.CanvasTexture(sky);
          stex.colorSpace = THREE.SRGBColorSpace;
          const card = new THREE.Mesh(new THREE.PlaneGeometry(panW * 0.96, panH * 0.92), new THREE.MeshBasicMaterial({ map: stex }));
          card.position.set(0, y0 + 3.4, -d / 2 + 0.02);
          card.rotation.y = Math.PI;
          back.add(card);
        }

        const left = mk(-w / 2 - 0.2, 0, 0.4, d, 'x', -w / 2, -1);
        const right = mk(w / 2 + 0.2, 0, 0.4, d, 'x', w / 2, 1);
        if (f === 0) {
          // front wall with a door gap
          const gap = 3.2;
          const seg = (w - gap) / 2;
          const front = mk(-gap / 2 - seg / 2, d / 2 + 0.2, seg + 0.4, 0.4, 'z', d / 2, 1);
          const fr = new THREE.Mesh(G.box(), wallMat);
          fr.scale.set(seg + 0.4, WALL_H, 0.4);
          fr.position.set(gap / 2 + seg / 2, WALL_H / 2, d / 2 + 0.2);
          front.add(fr);
          const top = new THREE.Mesh(G.box(), wallMat);
          top.scale.set(gap, WALL_H - 4.2, 0.4);
          top.position.set(0, 4.2 + (WALL_H - 4.2) / 2, d / 2 + 0.2);
          front.add(top);
          rbox(front, '#a0632f', [0, 2.1, d / 2 + 0.25], [gap - 0.2, 4.2, 0.2]);
          const exit = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: textTexture('Gå ut', { bg: '#0e1624', fg: '#7ef0ff', w: 256, h: 96, stroke: '#3ecbff' }), transparent: true }));
          exit.position.set(0, 4.8, d / 2 - 0.05);
          exit.rotation.y = Math.PI;
          front.add(exit);
          const exitMat = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: '#3ecbff', transparent: true, opacity: 0.35 }));
          exitMat.rotation.x = -Math.PI / 2;
          exitMat.position.set(0, 0.03, d / 2 - 1.2);
          fg.add(exitMat);
        } else {
          const front = mk(0, d / 2 + 0.2, w + 0.8, 0.4, 'z', d / 2, 1);
          for (const x of [-w * 0.25, w * 0.25]) {
            box(front, '#ffffff', [x, y0 + 3.3, d / 2 - 0.02], [2.8, 2.2, 0.1]);
            box(front, '#bfe9ff', [x, y0 + 3.3, d / 2 - 0.06], [2.4, 1.9, 0.06], undefined, 0.45);
          }
        }
        // panoramic glass windows with generated skyline
        for (const [wall, s] of [[left, -1], [right, 1]] as const) {
          for (let i = -1; i <= 1; i += 2) {
            box(wall, '#8aa0b8', [s * (w / 2 - 0.02), y0 + 3.3, i * d * 0.22], [0.08, 2.6, 2.8]);
            const glass = box(wall, '#9ad8ff', [s * (w / 2 - 0.08), y0 + 3.3, i * d * 0.22], [0.04, 2.3, 2.5], undefined, 0.35);
            glass.material = new THREE.MeshStandardMaterial({ color: '#9ad8ff', transparent: true, opacity: 0.28, metalness: 0.1, roughness: 0.1, depthWrite: false });
            // skyline silhouette card behind glass
            const sky = document.createElement('canvas');
            sky.width = 256; sky.height = 128;
            const sctx = sky.getContext('2d')!;
            const grd = sctx.createLinearGradient(0, 0, 0, 128);
            grd.addColorStop(0, '#8eb8e0'); grd.addColorStop(1, '#d8e6f0');
            sctx.fillStyle = grd; sctx.fillRect(0, 0, 256, 128);
            sctx.fillStyle = '#6a7a88';
            for (let k = 0; k < 14; k++) {
              const bw = 8 + (k * 5) % 18;
              const bh = 30 + (k * 17) % 70;
              sctx.fillRect(6 + k * 18, 128 - bh, bw, bh);
            }
            const stex = new THREE.CanvasTexture(sky);
            stex.colorSpace = THREE.SRGBColorSpace;
            const card = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.1), new THREE.MeshBasicMaterial({ map: stex }));
            card.position.set(s * (w / 2 - 0.2), y0 + 3.3, i * d * 0.22);
            card.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
            wall.add(card);
          }
        }
        // LED cove around ceiling perimeter (concept 2-hus-inne)
        {
          const coveY = y0 + WALL_H - 0.12;
          const coveMat = glowMat('#ffe8d0', 2.4);
          const mkCove = (sx: number, sz: number, px: number, pz: number) => {
            const c = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.04, sz), coveMat);
            c.position.set(px, coveY, pz);
            fg.add(c);
          };
          mkCove(w * 0.92, 0.08, 0, -d / 2 + 0.35);
          mkCove(w * 0.92, 0.08, 0, d / 2 - 0.35);
          mkCove(0.08, d * 0.85, -w / 2 + 0.35, 0);
          mkCove(0.08, d * 0.85, w / 2 - 0.35, 0);
          // soft rect light feel
          const soft = new THREE.Mesh(
            new THREE.PlaneGeometry(w * 0.55, d * 0.4),
            new THREE.MeshBasicMaterial({ color: '#fff6e8', transparent: true, opacity: 0.08, depthWrite: false }),
          );
          soft.rotation.x = Math.PI / 2;
          soft.position.set(0, coveY - 0.02, -d * 0.05);
          fg.add(soft);
        }
        // Holographic wall screen on back wall (living area)
        if (f === 0) {
          const holoFrame = new THREE.Mesh(
            new THREE.PlaneGeometry(4.4, 2.6),
            new THREE.MeshStandardMaterial({ color: '#1a2230', metalness: 0.6, roughness: 0.3 }),
          );
          holoFrame.position.set(-w * 0.18, y0 + 2.6, -d / 2 + 0.25);
          fg.add(holoFrame);
          const holo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), glowMat('#3a7cff', 0.65));
          holo.position.set(-w * 0.18, y0 + 2.6, -d / 2 + 0.28);
          fg.add(holo);
          // shelves flanking holo
          for (const sx of [-1, 1]) {
            const shelf = new THREE.Mesh(
              new THREE.BoxGeometry(0.9, 2.2, 0.35),
              SharedMats.wood.clone(),
            );
            shelf.position.set(-w * 0.18 + sx * 2.6, y0 + 2.4, -d / 2 + 0.45);
            fg.add(shelf);
          }

          // panoramic city window on back wall (concept skyline)
          {
            const sky = document.createElement('canvas');
            sky.width = 512; sky.height = 256;
            const sctx = sky.getContext('2d')!;
            const grd = sctx.createLinearGradient(0, 0, 0, 256);
            grd.addColorStop(0, '#9ec4e8'); grd.addColorStop(0.55, '#d2e4f2'); grd.addColorStop(1, '#e8eef4');
            sctx.fillStyle = grd; sctx.fillRect(0, 0, 512, 256);
            sctx.fillStyle = '#6a7a88';
            for (let k = 0; k < 22; k++) {
              const bw = 10 + (k * 7) % 28;
              const bh = 40 + (k * 19) % 140;
              sctx.fillRect(8 + k * 23, 256 - bh, bw, bh);
              sctx.fillStyle = '#8ecbff88';
              for (let wy = 0; wy < 6; wy++) sctx.fillRect(12 + k * 23, 256 - bh + 8 + wy * 14, bw - 8, 6);
              sctx.fillStyle = '#6a7a88';
            }
            const stex = new THREE.CanvasTexture(sky);
            stex.colorSpace = THREE.SRGBColorSpace;
            const livingSky = new THREE.Mesh(
              new THREE.PlaneGeometry(5.2, 2.8),
              new THREE.MeshBasicMaterial({ map: stex }),
            );
            livingSky.position.set(w * 0.28, y0 + 2.7, -d / 2 + 0.22);
            fg.add(livingSky);
            const frame = new THREE.Mesh(
              new THREE.BoxGeometry(5.4, 3.0, 0.08),
              new THREE.MeshStandardMaterial({ color: '#d0d6de', metalness: 0.4, roughness: 0.35 }),
            );
            frame.position.set(w * 0.28, y0 + 2.7, -d / 2 + 0.18);
            fg.add(frame);
            const pane = new THREE.Mesh(
              new THREE.PlaneGeometry(5.15, 2.75),
              physicalGlass('#b8d8ec', 0.55),
            );
            pane.position.set(w * 0.28, y0 + 2.7, -d / 2 + 0.26);
            fg.add(pane);
          }
        }
        // inner walls between the rooms, with door gaps
        for (const r of L.walls[f]) {
          const g = new THREE.Group();
          const m = new THREE.Mesh(G.box(), wallMat);
          m.scale.set(r.hw * 2, WALL_H - 0.2, r.hd * 2);
          m.position.set(r.x, y0 + (WALL_H - 0.2) / 2, r.z);
          m.receiveShadow = true;
          m.castShadow = true;
          g.add(m);
          box(g, trim, [r.x, y0 + 0.2, r.z], [r.hw * 2 + 0.05, 0.4, r.hd * 2 + 0.05]);
          box(g, trim, [r.x, y0 + WALL_H - 0.2, r.z], [r.hw * 2 + 0.08, 0.2, r.hd * 2 + 0.08]);
          fg.add(g);
          partitions.push({ mesh: g, rect: r, floor: f });
        }
      }
      // closed ceiling / roof over the top floor (fixes open sky bug)
      {
        const y0 = (FLOORS - 1) * FLOOR_H + WALL_H;
        const ceil = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.35, d + 1.2), mat(shade(house.wallColor, -0.05)));
        ceil.position.set(0, y0 + 0.1, 0);
        ceil.receiveShadow = true;
        floorGroups[FLOORS - 1].add(ceil);
        // LED strip under ceiling
        box(floorGroups[FLOORS - 1], '#3ecbff', [0, y0 - 0.05, 0], [w * 0.7, 0.05, 0.08], undefined, 0.8);
        // shallow pitched roof peeking above when upstairs walls are visible
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), mat(HOUSE_BY_STYLE[house.style]?.roof ?? '#ff7a7a'));
        roof.position.set(0, y0 + 2.4, 0);
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(w * 1.2, 3.6, d * 1.2);
        floorGroups[FLOORS - 1].add(roof);
      }
      // the staircase: steps that fill the ramp, with railings (centred on stairs mid-X — supports side/corner plans)
      const stairs = new THREE.Group();
      const N = 18;
      const run = (st.zBottom - st.zTop) / N;
      const smx = (st.x0 + st.x1) / 2;
      for (let i = 0; i < N; i++) {
        const h = ((i + 1) / N) * FLOOR_H;
        const z = st.zBottom - (i + 0.5) * run;
        const step = box(stairs, i % 2 ? '#d5dde8' : '#e8eef6', [smx, h / 2, z], [st.x1 - st.x0, h, run + 0.01]);
        step.receiveShadow = true;
        // LED tread nosing
        box(stairs, '#3ecbff', [smx, h + 0.02, z + run * 0.35], [st.x1 - st.x0 - 0.15, 0.03, 0.06], undefined, 0.75);
      }
      for (const x of [st.x0 - 0.05, st.x1 + 0.05]) {
        const mid = (st.zTop + st.zBottom) / 2;
        const len = Math.hypot(st.zBottom - st.zTop, FLOOR_H);
        const ang = Math.atan2(FLOOR_H, st.zBottom - st.zTop);
        box(stairs, '#8aa0b8', [x, FLOOR_H / 2 + 1.0, mid], [0.1, 0.1, len], [ang, 0, 0]);
        box(stairs, '#3ecbff', [x, FLOOR_H / 2 + 0.85, mid], [0.04, 0.04, len], [ang, 0, 0], 0.7);
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          box(stairs, '#ffffff', [x, t * FLOOR_H + 0.5, st.zBottom - t * (st.zBottom - st.zTop)], [0.1, 1.0, 0.1]);
        }
        box(stairs, '#9ad8ff', [x, FLOOR_H + 1.0, (st.zTop + st.zBottom) / 2], [0.08, 0.08, st.zBottom - st.zTop], undefined, 0.25);
      }
      box(stairs, '#9ad8ff', [smx, FLOOR_H + 1.0, st.zBottom + 0.12], [st.x1 - st.x0 + 0.3, 0.08, 0.08], undefined, 0.25);
      for (const x of [st.x0, smx, st.x1]) box(stairs, '#ffffff', [x, FLOOR_H + 0.5, st.zBottom + 0.12], [0.1, 1.0, 0.1]);
      floorGroups[0].add(stairs);
      // Moderne: visual spiral newel (gameplay ramp stays straight) so the plan reads as a corner spiral.
      if (house.style === 'moderne') {
        const post = new THREE.Group();
        const turns = 5;
        for (let i = 0; i < turns * 8; i++) {
          const t = i / (turns * 8);
          const ang = t * Math.PI * 2 * turns;
          const y = t * FLOOR_H;
          const r = 0.55;
          const peg = box(post, i % 2 ? '#cfd8ff' : '#9aa6d6', [smx + Math.cos(ang) * r, y + 0.15, st.zBottom - t * (st.zBottom - st.zTop)], [0.18, 0.12, 0.18]);
          peg.castShadow = false;
        }
        box(post, '#8891b8', [smx, FLOOR_H / 2, (st.zTop + st.zBottom) / 2], [0.22, FLOOR_H, 0.22]);
        floorGroups[0].add(post);
      }
      itemKeys.clear();
      furn.clear();
      items.clear();
      api.syncItems(house);
    },
    syncItems(house) {
      const seen = new Set<string>();
      for (const it of house.items) {
        seen.add(it.uid);
        const def = FURN_BY_ID[it.itemId];
        const key = `${it.itemId}|${it.color}`;
        let g = items.get(it.uid);
        if (!g || itemKeys.get(it.uid) !== key) {
          if (g) furn.remove(g);
          g = buildFurniture(def.model, it.color);
          g.userData.uid = it.uid;
          g.traverse((o) => (o.userData.uid = it.uid));
          furn.add(g);
          items.set(it.uid, g);
          itemKeys.set(it.uid, key);
        }
        g.position.set(it.x, it.floor * FLOOR_H, it.z);
        g.userData.floor = it.floor;
        g.rotation.y = it.rot;
        g.scale.setScalar(it.scale);
      }
      for (const [uid, g] of items) {
        if (!seen.has(uid)) {
          furn.remove(g);
          items.delete(uid);
          itemKeys.delete(uid);
        }
      }
      selectedFloor = house.items.find((i) => i.uid === selected)?.floor ?? 0;
      api.select(selected);
      api.floorRects = Array.from({ length: FLOORS }, (_, f) => furnitureColliders(house, items, api.door, f));
      api.rects = api.floorRects[0];
      sets = api.floorRects.map((fr, f) => ({ rects: [...floorColliders(api.layout, f).rects, ...fr], circles: [] }));
    },
    updateWalls(cam, focus, floor = 0) {
      floorGroups[1].visible = floor >= 1;
      furn.children.forEach((c) => (c.visible = (c.userData.floor ?? 0) <= floor));
      for (const wl of walls) {
        const v = wl.axis === 'x' ? cam.x : cam.z;
        // Hide exterior wall when camera is outside that wall OR the wall sits between cam and focus
        let hide = (v - wl.at) * wl.sign >= 0.15;
        if (focus) {
          const fv = wl.axis === 'x' ? focus.x : focus.z;
          // wall plane between camera and focus along axis
          if ((v - wl.at) * (fv - wl.at) < 0) hide = true;
        }
        wl.mesh.visible = !hide;
      }
      for (const p of partitions) {
        if (!focus || p.floor > floor) {
          p.mesh.visible = p.floor <= floor;
          continue;
        }
        // hide a partition wall that stands between the camera and the player
        const base = p.floor * FLOOR_H;
        p.mesh.visible = !(cam.y - base < WALL_H + 1.5 && segmentHitsRect(cam.x, cam.z, focus.x, focus.z, p.rect));
      }
    },
    select(uid) {
      selected = uid && items.has(uid) ? uid : null;
      ring.visible = !!selected;
    },
    update(t) {
      if (!selected) return;
      const g = items.get(selected)!;
      const box3 = new THREE.Box3().setFromObject(g);
      const size = Math.max(box3.max.x - box3.min.x, box3.max.z - box3.min.z);
      ring.position.set((box3.max.x + box3.min.x) / 2, selectedFloor * FLOOR_H + 0.08 + Math.sin(t * 5) * 0.04, (box3.max.z + box3.min.z) / 2);
      ring.scale.setScalar(size * 0.6 + 0.4);
    },
  };
  return api;
}

/** Does the segment (ax,az)-(bx,bz) cross the axis-aligned rectangle? */
function segmentHitsRect(ax: number, az: number, bx: number, bz: number, r: RectCollider): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const slab = (p: number, d: number, lo: number, hi: number) => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let a = (lo - p) / d;
    let b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  return slab(ax, dx, r.x - r.hw, r.x + r.hw) && slab(az, dz, r.z - r.hd, r.z + r.hd);
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

/** Soft things you can step over; everything else that stands on the floor is solid. */
const WALK_THROUGH = new Set(['ball', 'teddy', 'heart', 'gift']);
/** Floor items must be at least this tall to count as solid (rugs, mats and bowls are flat). */
const MIN_SOLID_HEIGHT = 0.4;
/** Furniture this close to the front door never blocks, so a room can't be built shut. */
const DOOR_CLEAR = 1.9;

/** The solid furniture of one floor (default: the ground floor). Heights are absolute, so upstairs furniture is not "jumped over" by someone standing upstairs. */
export function furnitureColliders(house: House, items: Map<string, THREE.Group>, door: { x: number; z: number }, floor = 0): RectCollider[] {
  const out: RectCollider[] = [];
  for (const it of house.items) {
    if ((it.floor ?? 0) !== floor) continue;
    const def = FURN_BY_ID[it.itemId];
    const g = items.get(it.uid);
    if (!def || !g || def.wall || def.cat === 'gulv' || WALK_THROUGH.has(def.model)) continue;
    const fp = footprintOf(g);
    if (fp.top < MIN_SOLID_HEIGHT) continue;
    const rect: RectCollider = { x: fp.x, z: fp.z, hw: fp.hw, hd: fp.hd, rot: fp.rot, h: fp.top + floor * FLOOR_H };
    // keep the doorway open: skip anything touching the door mat
    if (floor === 0 && blocked(door.x, door.z, DOOR_CLEAR, { rects: [rect], circles: [] })) continue;
    out.push(rect);
  }
  return out;
}
