import * as THREE from 'three';
import { FURN_BY_ID, HOUSE_BY_STYLE } from '../logic/catalog.ts';
import { roomSize, type House } from '../logic/house.ts';
import { blocked, type CircleCollider, type Colliders, type RectCollider } from '../logic/collision.ts';
import { FLOOR_H, FLOORS, floorColliders, houseLayout, type HouseLayout } from '../logic/layout.ts';
import { footprintOf } from './colliders.ts';
import { buildFurniture } from './furniture.ts';
import { box, G, glowMat, mat, rbox, textTexture } from './kit.ts';
import { SharedMats, physicalGlass } from './pbrTextures.ts';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

let rectAreaReady = false;
function ensureRectArea() {
  if (rectAreaReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaReady = true;
}

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
      const fill = new THREE.PointLight('#ffd7b0', house.style === 'moderne' ? 0.16 : 1.15, 34, 2);
      fill.name = 'InteriorFillLight';
      fill.position.set(0, 4.2, 0);
      shell.add(fill);
      const fill2 = new THREE.PointLight('#c8e4ff', house.style === 'moderne' ? 0.12 : 0.4, 26, 2);
      fill2.position.set(-5, 3.2, -4);
      shell.add(fill2);
      const fill3 = new THREE.PointLight('#ffe2c0', house.style === 'moderne' ? 0.18 : 0.7, 22, 2);
      fill3.position.set(4, 2.2, 2);
      shell.add(fill3);
      const kit = new THREE.PointLight('#ffcc88', house.style === 'moderne' ? 0.22 : 0.9, 10, 2);
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
      // Concept living: warm light walls (not grey concrete)
      const warmWall = house.style === 'moderne' ? '#4e555e' : (house.wallColor || '#efeae3');
      wallMat.color.set(house.style === 'moderne' ? warmWall : (house.wallColor || warmWall));
      wallMat.roughness = house.style === 'moderne' ? 0.88 : 0.72;
      wallMat.metalness = 0.02;
      wallMat.map = null; // drop concrete albedo
      wallMat.envMapIntensity = house.style === 'moderne' ? 0.18 : 0.55;
      const trim = house.style === 'moderne' ? '#3a4048' : '#e8e2d8';
      const st = L.stairs;
      for (let f = 0; f < FLOORS; f++) {
        const fg = floorGroups[f];
        const y0 = f * FLOOR_H;
        // floor slab (the upper one has a hole for the stairs)
        const slab = (x0: number, x1: number, z0: number, z1: number) => {
          if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
          const matFloor = SharedMats.interiorFloor.clone();
          if (house.style === 'moderne') {
            // Calm light-grey polished concrete (no orange plank stripes)
            matFloor.map = null;
            matFloor.normalMap = SharedMats.interiorFloor.normalMap;
            if (matFloor.normalMap) matFloor.normalScale = new THREE.Vector2(0.18, 0.18);
            matFloor.color.set(house.floorColor || '#5a626c');
            matFloor.roughness = 0.45;
            matFloor.metalness = 0.06;
            matFloor.envMapIntensity = 0.45;
          } else {
            matFloor.color.set(house.floorColor || '#c9b8a0');
            matFloor.roughness = 0.45;
            matFloor.metalness = 0.04;
            matFloor.envMapIntensity = 0.75;
            if (SharedMats.interiorFloor.map) matFloor.map = SharedMats.interiorFloor.map;
            if (SharedMats.interiorFloor.normalMap) {
              matFloor.normalMap = SharedMats.interiorFloor.normalMap;
              matFloor.normalScale = new THREE.Vector2(0.3, 0.3);
            }
          }
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
        // Plank lines only for non-moderne (moderne = polished concrete, no stripes)
        if (house.style !== 'moderne') {
          for (let i = 1; i < Math.floor(w / 2); i++) {
            const x = -w / 2 + i * 2;
            const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, d), mat(shade(house.floorColor, -0.08)));
            line.position.set(x, y0 + 0.01, 0);
            if (f === 1 && x > st.x0 - 0.05 && x < st.x1 + 0.05) continue;
            fg.add(line);
          }
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
        if (house.style === 'moderne' && f === 0) {
          // Replace solid back wall with open panoramic window wall (no floating trim leftovers)
          back.clear();
          walls = walls.filter((wl) => wl.mesh !== back);
          const panW = Math.min(w * 0.88, 16);
          const panH = 4.1;
          const zBack = -d / 2;
          const frameMat = new THREE.MeshStandardMaterial({ color: '#6a727c', metalness: 0.4, roughness: 0.35 });
          const darkMat = new THREE.MeshStandardMaterial({ color: '#2a3340', metalness: 0.45, roughness: 0.35 });
          // slim side returns (thick posts read as indoor pillars)
          for (const sx of [-1, 1]) {
            const ret = new THREE.Mesh(new THREE.BoxGeometry(0.1, panH + 0.4, 0.12), frameMat);
            ret.position.set(sx * (panW / 2 + 0.08), y0 + 3.15, zBack);
            ret.receiveShadow = true;
            back.add(ret);
          }
          // header + sill
          const header = new THREE.Mesh(new THREE.BoxGeometry(panW + 0.8, 0.55, 0.35), frameMat);
          header.position.set(0, y0 + 5.35, zBack);
          back.add(header);
          const sill = new THREE.Mesh(new THREE.BoxGeometry(panW + 0.6, 0.2, 0.45), darkMat);
          sill.position.set(0, y0 + 1.05, zBack + 0.05);
          back.add(sill);
          // Side mullions only — no centre post (read as black pillar in window)
          for (const mx of [-panW * 0.32, panW * 0.32]) {
            const mull = new THREE.Mesh(new THREE.BoxGeometry(0.06, panH, 0.08), frameMat);
            mull.position.set(mx, y0 + 3.15, zBack + 0.08);
            back.add(mull);
          }
          // skyline backdrop (outside)
          {
            const sky = document.createElement('canvas');
            sky.width = 1024; sky.height = 384;
            const sctx = sky.getContext('2d')!;
            const grd = sctx.createLinearGradient(0, 0, 0, 384);
            grd.addColorStop(0, '#6aa0d0'); grd.addColorStop(0.45, '#b8d0e4'); grd.addColorStop(1, '#e4ecf2');
            sctx.fillStyle = grd; sctx.fillRect(0, 0, 1024, 384);
            for (let k = 0; k < 36; k++) {
              const bw = 14 + (k * 9) % 36;
              const bh = 60 + (k * 23) % 220;
              sctx.fillStyle = k % 3 === 0 ? '#4a5a68' : '#5a6a78';
              sctx.fillRect(8 + k * 28, 384 - bh, bw, bh);
              sctx.fillStyle = '#9ad8ffcc';
              for (let wy = 0; wy < 10; wy++) sctx.fillRect(12 + k * 28, 384 - bh + 12 + wy * 18, bw - 8, 8);
            }
            const stex = new THREE.CanvasTexture(sky);
            stex.colorSpace = THREE.SRGBColorSpace;
            const card = new THREE.Mesh(
              new THREE.PlaneGeometry(panW * 1.08, panH * 1.1),
              new THREE.MeshBasicMaterial({ map: stex, side: THREE.DoubleSide }),
            );
            // Just outside the glass so it reads through translucent pane
            card.position.set(0, y0 + 3.15, zBack - 0.55);
            back.add(card);
            // (no outdoor tower boxes — they read as indoor pillars through glass)
          }
          // SwiftShader-safe glass (transmission often draws as opaque white)
          const glass = new THREE.Mesh(
            new THREE.BoxGeometry(panW, panH, 0.05),
            new THREE.MeshPhysicalMaterial({
              color: '#c8dff0',
              metalness: 0.05,
              roughness: 0.05,
              transparent: true,
              opacity: 0.22,
              transmission: 0,
              depthWrite: false,
              envMapIntensity: 1.1,
            }),
          );
          glass.position.set(0, y0 + 3.15, zBack + 0.14);
          back.add(glass);
          walls.push({ mesh: back, axis: 'z', at: -d / 2, sign: -1 });
        } else {
        // panoramic skyline window on back wall (non-moderne styles)
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
        // LED cove around ceiling — moderne gets curved warm strips that bloom
        {
          ensureRectArea();
          const coveY = y0 + WALL_H - 0.14;
          // Thin recessed LED strips (not floating gold tubes)
          const coveMat = new THREE.MeshBasicMaterial({
            color: '#ffe8d0',
            toneMapped: false,
          });
          if (house.style === 'moderne' && f === 0) {
            const ledH = 0.025; // ~2.5 cm
            const ledD = 0.04;
            const inset = 0.22;
            const yLed = coveY - 0.02;
            // Perimeter flush to ceiling edges
            const mkStrip = (sx: number, sz: number, px: number, pz: number) => {
              const c = new THREE.Mesh(new THREE.BoxGeometry(sx, ledH, sz), coveMat);
              c.position.set(px, yLed, pz);
              fg.add(c);
            };
            mkStrip(w - inset * 2, ledD, 0, -d / 2 + inset);
            mkStrip(w - inset * 2, ledD, 0, d / 2 - inset);
            mkStrip(ledD, d - inset * 2, -w / 2 + inset, 0);
            mkStrip(ledD, d - inset * 2, w / 2 - inset, 0);
            const area = new THREE.RectAreaLight('#ffe8d0', 4.5, w * 0.5, d * 0.35);
            area.position.set(0, coveY - 0.08, -d * 0.05);
            area.rotation.x = -Math.PI / 2;
            fg.add(area);
            const soft = new THREE.PointLight('#ffe0b0', 0.4, 24, 2);
            soft.position.set(0, coveY - 0.5, 0);
            fg.add(soft);
          } else {
            const mkCove = (sx: number, sz: number, px: number, pz: number) => {
              const c = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.025, sz), coveMat);
              c.position.set(px, coveY - 0.02, pz);
              fg.add(c);
            };
            mkCove(w * 0.92, 0.04, 0, -d / 2 + 0.35);
            mkCove(w * 0.92, 0.04, 0, d / 2 - 0.35);
            mkCove(0.04, d * 0.85, -w / 2 + 0.35, 0);
            mkCove(0.04, d * 0.85, w / 2 - 0.35, 0);
            if (f === 0) {
              const area = new THREE.RectAreaLight('#ffe8d0', 11, w * 0.7, d * 0.45);
              area.position.set(0, coveY - 0.05, -d * 0.08);
              area.rotation.x = -Math.PI / 2;
              fg.add(area);
              const soft = new THREE.PointLight('#ffe0b0', 0.85, 22, 2);
              soft.position.set(0, coveY - 0.4, 0);
              fg.add(soft);
            }
          }
        }
        // Living-room composition (concept 2-hus-inne): sofa/table/rug, left holo+shelves, right island, pod via right doorway
        if (f === 0) {
          const living = new THREE.Group();
          // Light grey fabric (not pure white) — total sofa height ~0.8 m so cam sees over back to table/rug
          const fabric = new THREE.MeshStandardMaterial({ color: '#c5cdd6', roughness: 0.62, metalness: 0.03, envMapIntensity: 0.4 });
          const pillowMat = new THREE.MeshStandardMaterial({ color: '#d5dde6', roughness: 0.72, metalness: 0.02 });
          const accentPillow = new THREE.MeshStandardMaterial({ color: '#8a96a4', roughness: 0.68, metalness: 0.04 });
          {
            const sofa = new THREE.Group();
            const shape = new THREE.Shape();
            shape.moveTo(-2.2, 0.55);
            shape.quadraticCurveTo(-2.3, -0.15, -1.2, -0.6);
            shape.quadraticCurveTo(0, -0.85, 1.2, -0.6);
            shape.quadraticCurveTo(2.3, -0.15, 2.2, 0.55);
            shape.lineTo(1.65, 0.55);
            shape.quadraticCurveTo(1.55, 0.05, 0.9, -0.15);
            shape.quadraticCurveTo(0, -0.32, -0.9, -0.15);
            shape.quadraticCurveTo(-1.55, 0.05, -1.65, 0.55);
            shape.lineTo(-2.2, 0.55);
            // Seat cushion ~0.38 m high
            const seatGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 48 });
            seatGeo.rotateX(-Math.PI / 2);
            const seat = new THREE.Mesh(seatGeo, fabric);
            seat.position.y = 0.16;
            seat.castShadow = true;
            seat.receiveShadow = true;
            sofa.add(seat);
            // Thin curved backrest — extrude depth = back height (~0.38 → total ~0.8 m)
            const backShape = new THREE.Shape();
            backShape.moveTo(-2.1, -0.5);
            backShape.quadraticCurveTo(-1.1, -0.85, 0, -0.95);
            backShape.quadraticCurveTo(1.1, -0.85, 2.1, -0.5);
            backShape.lineTo(1.95, -0.38);
            backShape.quadraticCurveTo(1.05, -0.68, 0, -0.75);
            backShape.quadraticCurveTo(-1.05, -0.68, -1.95, -0.38);
            backShape.lineTo(-2.1, -0.5);
            const backGeo = new THREE.ExtrudeGeometry(backShape, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 48 });
            backGeo.rotateX(-Math.PI / 2);
            const backRest = new THREE.Mesh(backGeo, fabric);
            backRest.position.set(0, 0.42, 0); // top ≈ 0.42+0.38 = 0.8 m
            backRest.castShadow = true;
            sofa.add(backRest);
            // Soft cushions against the low back
            for (const [u, mat, sy] of [
              [0.2, pillowMat, 0.38],
              [0.5, accentPillow, 0.4],
              [0.8, pillowMat, 0.38],
            ] as const) {
              const ang = -Math.PI * 0.18 + u * Math.PI * 0.36;
              const px = Math.sin(ang) * 1.35;
              const pz = -0.55 + Math.cos(ang) * 0.06;
              const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), mat);
              pillow.scale.set(1.25, sy, 0.7);
              pillow.position.set(px, 0.58, pz);
              pillow.rotation.y = ang * 0.4;
              pillow.castShadow = true;
              sofa.add(pillow);
            }
            sofa.rotation.y = 0;
            sofa.scale.set(1.45, 1.0, 1.25); // no Y stretch — keep ~0.8 m
            sofa.position.set(-2.8, y0, 2.05);
            living.add(sofa);
            const rug = new THREE.Mesh(
              new THREE.CylinderGeometry(2.15, 2.15, 0.03, 48),
              new THREE.MeshStandardMaterial({ color: '#7a8694', roughness: 0.88, metalness: 0.02 }),
            );
            rug.position.set(-2.6, y0 + 0.02, 2.7);
            living.add(rug);
            const rugIn = new THREE.Mesh(
              new THREE.CylinderGeometry(1.35, 1.35, 0.032, 48),
              new THREE.MeshStandardMaterial({ color: '#dce2ea', roughness: 0.9, metalness: 0.02 }),
            );
            rugIn.position.set(-2.6, y0 + 0.025, 2.7);
            living.add(rugIn);
          }
          // Round low coffee table on pedestal (not a flat disc)
          {
            const table = new THREE.Group();
            const topMat = new THREE.MeshStandardMaterial({ color: '#c8b79a', roughness: 0.35, metalness: 0.15, envMapIntensity: 0.8 });
            const metalMat = new THREE.MeshStandardMaterial({ color: '#8aa0b8', metalness: 0.85, roughness: 0.22, envMapIntensity: 1.1 });
            const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.74, 0.06, 40), topMat);
            top.position.y = 0.4;
            top.castShadow = true;
            table.add(top);
            const lip = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.02, 8, 40), metalMat);
            lip.rotation.x = Math.PI / 2;
            lip.position.y = 0.37;
            table.add(lip);
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.32, 16), metalMat);
            stem.position.y = 0.2;
            table.add(stem);
            const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.05, 32), metalMat);
            foot.position.y = 0.03;
            table.add(foot);
            table.position.set(-2.55, y0, 2.85);
            living.add(table);
          }
          // Holo-screen LEFT of window bay (default cam sees it) + lit shelves/plants
          if (house.style === 'moderne') {
            const tw = 3.2;
            const th = 2.15;
            const hx = -6.2;
            const hz = -d / 2 + 0.55;
            const holoFrame = new THREE.Mesh(
              new THREE.BoxGeometry(tw + 0.2, th + 0.2, 0.1),
              new THREE.MeshStandardMaterial({ color: '#121820', metalness: 0.7, roughness: 0.25 }),
            );
            holoFrame.position.set(hx, y0 + 2.15, hz);
            living.add(holoFrame);
            const hc = document.createElement('canvas');
            hc.width = 1024; hc.height = 576;
            const hx2 = hc.getContext('2d')!;
            hx2.fillStyle = '#071428'; hx2.fillRect(0, 0, 1024, 576);
            hx2.strokeStyle = '#3ecbff'; hx2.lineWidth = 4; hx2.strokeRect(18, 18, 988, 540);
            hx2.fillStyle = '#7ef0ff'; hx2.font = '700 36px Inter, system-ui, sans-serif';
            hx2.fillText('NORDIC HOME OS', 48, 70);
            hx2.fillStyle = '#5a8cff'; hx2.font = '500 22px Inter, system-ui, sans-serif';
            hx2.fillText('Living · Climate 21° · Air good', 48, 108);
            hx2.strokeStyle = '#3ecbffaa';
            for (let i = 0; i < 14; i++) {
              hx2.beginPath();
              hx2.moveTo(60 + i * 65, 480);
              hx2.lineTo(90 + i * 60, 160 + (i * 37) % 220);
              hx2.stroke();
            }
            hx2.fillStyle = '#3ecbff';
            for (let i = 0; i < 16; i++) hx2.fillRect(48 + i * 58, 500, 36, 10 + (i * 17) % 40);
            const htex = new THREE.CanvasTexture(hc);
            htex.colorSpace = THREE.SRGBColorSpace;
            const holo = new THREE.Mesh(
              new THREE.PlaneGeometry(tw, th),
              new THREE.MeshBasicMaterial({ map: htex }),
            );
            holo.position.set(hx, y0 + 2.15, hz + 0.08);
            living.add(holo);
            const holoLight = new THREE.PointLight('#3a7cff', 1.1, 9, 2);
            holoLight.position.set(hx, y0 + 2.15, hz + 1.4);
            living.add(holoLight);
            // Lit shelves + plants flanking holo
            for (const sx of [-1, 1] as const) {
              const shelf = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 2.0, 0.36),
                SharedMats.wood.clone(),
              );
              shelf.position.set(hx + sx * (tw / 2 + 0.5), y0 + 1.7, hz + 0.2);
              living.add(shelf);
              for (const ly of [0.95, 1.45, 1.95] as const) {
                const led = new THREE.Mesh(
                  new THREE.BoxGeometry(0.6, 0.04, 0.06),
                  new THREE.MeshBasicMaterial({ color: '#ffe6c4' }),
                );
                led.position.set(hx + sx * (tw / 2 + 0.5), y0 + ly, hz + 0.38);
                living.add(led);
              }
              // Floor plant + shelf plant
              const pot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.16, 0.13, 0.28, 12),
                new THREE.MeshStandardMaterial({ color: '#2a3340', roughness: 0.45, metalness: 0.15 }),
              );
              pot.position.set(hx + sx * (tw / 2 + 0.55), y0 + 0.14, hz + 0.55);
              living.add(pot);
              for (const [oy, r, col] of [[0.45, 0.28, '#4e9a40'], [0.65, 0.22, '#5fa84a'], [0.55, 0.18, '#3d8a35']] as const) {
                const leaf = new THREE.Mesh(
                  new THREE.SphereGeometry(r, 12, 10),
                  new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }),
                );
                leaf.scale.set(1.1, 0.75, 1.0);
                leaf.position.set(hx + sx * (tw / 2 + 0.55) + (r - 0.2) * 0.3, y0 + oy, hz + 0.55);
                living.add(leaf);
              }
              const shelfPot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.08, 0.16, 10),
                new THREE.MeshStandardMaterial({ color: '#3a4550', roughness: 0.5 }),
              );
              shelfPot.position.set(hx + sx * (tw / 2 + 0.5), y0 + 2.15, hz + 0.25);
              living.add(shelfPot);
              const shelfLeaf = new THREE.Mesh(
                new THREE.SphereGeometry(0.18, 10, 8),
                new THREE.MeshStandardMaterial({ color: '#5a8f5a', roughness: 0.8 }),
              );
              shelfLeaf.position.set(hx + sx * (tw / 2 + 0.5), y0 + 2.38, hz + 0.25);
              living.add(shelfLeaf);
            }
            // Bedroom doorway frame (right) — readable opening + warm lintel so pod peeks through
            {
              const gx = w / 2 - 7;
              const nx = gx - 6.0;
              const nz = -d / 2 + 5.2;
              const dx = (nx + gx) / 2;
              const frameMat = new THREE.MeshStandardMaterial({ color: '#7a848e', metalness: 0.4, roughness: 0.35 });
              const halfW = 1.35;
              for (const sx of [-1, 1] as const) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.45, 0.12), frameMat);
                post.position.set(dx + sx * halfW, y0 + 1.25, nz + 0.08);
                living.add(post);
              }
              const lintel = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.2, 0.12, 0.14), frameMat);
              lintel.position.set(dx, y0 + 2.5, nz + 0.08);
              living.add(lintel);
              const glow = new THREE.Mesh(
                new THREE.BoxGeometry(halfW * 2 - 0.15, 0.06, 0.06),
                new THREE.MeshBasicMaterial({ color: '#ffe6c4' }),
              );
              glow.position.set(dx, y0 + 2.48, nz + 0.16);
              living.add(glow);
              // Floor threshold glow — draws the eye into the alcove
              const thresh = new THREE.Mesh(
                new THREE.BoxGeometry(halfW * 1.7, 0.03, 0.35),
                new THREE.MeshBasicMaterial({ color: '#7ef0ff' }),
              );
              thresh.position.set(dx, y0 + 0.03, nz + 0.2);
              living.add(thresh);
              const alcoveLight = new THREE.PointLight('#ffe8d0', 0.45, 7, 2);
              alcoveLight.position.set(dx, y0 + 1.6, nz - 1.2);
              living.add(alcoveLight);
              // Alcove enclosure (right-back) — warm-grey walls, not pillars
              const alcoveWall = new THREE.MeshStandardMaterial({ color: '#4e555e', roughness: 0.9, metalness: 0.02, envMapIntensity: 0.12 });
              const side = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, nz - (-d / 2) + 0.2), alcoveWall);
              side.position.set(nx, y0 + 1.4, (-d / 2 + nz) / 2);
              living.add(side);
              const back = new THREE.Mesh(new THREE.BoxGeometry(gx - nx, 2.8, 0.18), alcoveWall);
              back.position.set((nx + gx) / 2, y0 + 1.4, -d / 2 + 0.15);
              living.add(back);
            }
          }
          // Kitchen island right with warm under-glow + bar stools
          if (house.style === 'moderne') {
            const island = new THREE.Group();
            const base = new THREE.Mesh(
              new THREE.BoxGeometry(2.6, 0.95, 1.15),
              new THREE.MeshStandardMaterial({ color: '#e4e8ee', roughness: 0.4, metalness: 0.08 }),
            );
            base.position.y = 0.48;
            island.add(base);
            const top = new THREE.Mesh(
              new THREE.BoxGeometry(2.75, 0.08, 1.25),
              new THREE.MeshStandardMaterial({ color: '#2a3340', roughness: 0.25, metalness: 0.4 }),
            );
            top.position.y = 1.0;
            island.add(top);
            // Warm under-glow strip (bloom-capable)
            const glow = new THREE.Mesh(
              new THREE.BoxGeometry(2.45, 0.06, 1.05),
              new THREE.MeshBasicMaterial({ color: '#ffd7a0', toneMapped: false }),
            );
            glow.position.y = 0.04;
            island.add(glow);
            const glowSoft = new THREE.Mesh(
              new THREE.BoxGeometry(2.55, 0.02, 1.15),
              glowMat('#ffe0b0', 2.8),
            );
            glowSoft.position.y = 0.01;
            island.add(glowSoft);
            island.position.set(4.4, y0, 0.2);
            living.add(island);
            const kitLight = new THREE.PointLight('#ffcc88', 0.95, 9, 2);
            kitLight.position.set(4.4, y0 + 0.25, 0.2);
            living.add(kitLight);
            for (const sx of [-0.55, 0.55]) {
              const stool = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.24, 0.7, 14),
                new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.35, metalness: 0.5 }),
              );
              stool.position.set(4.4 + sx, y0 + 0.35, 1.25);
              living.add(stool);
              const seat = new THREE.Mesh(
                new THREE.CylinderGeometry(0.24, 0.24, 0.06, 14),
                SharedMats.wood.clone(),
              );
              seat.position.set(4.4 + sx, y0 + 0.72, 1.25);
              living.add(seat);
            }
          }
          fg.add(living);
        }

        // inner walls between the rooms, with door gaps
        for (const r of L.walls[f]) {
          // Moderne open living: skip thin glass partitions on ground floor (read as floating white slabs)
          const isGlassWall = house.style === 'moderne' && r.hw < 0.35 && r.hd > 1.5;
          if (isGlassWall && f === 0) continue;
          // Moderne ground: no partition meshes (they read as pillars). Doorway frame is in living vignette; colliders remain.
          if (house.style === 'moderne' && f === 0) continue;
          const g = new THREE.Group();
          const partMat = house.style === 'moderne' && !isGlassWall
            ? new THREE.MeshStandardMaterial({ color: '#3e444c', roughness: 0.92, metalness: 0.02, envMapIntensity: 0.1 })
            : wallMat;
          const m = new THREE.Mesh(
            G.box(),
            isGlassWall
              ? new THREE.MeshPhysicalMaterial({
                  color: '#c8dff0', metalness: 0.05, roughness: 0.08,
                  transparent: true, opacity: 0.28, transmission: 0, depthWrite: false,
                })
              : partMat,
          );
          // Slimmer moderne partitions; short cross-walls only ~door height (not full towers)
          const slim = house.style === 'moderne' && !isGlassWall ? 0.45 : 1;
          const isCross = house.style === 'moderne' && !isGlassWall && r.hd <= 0.25;
          const partH = isCross ? 2.35 : WALL_H - 0.2;
          m.scale.set(isGlassWall ? 0.1 : r.hw * 2 * slim, partH, r.hd * 2 * slim);
          m.position.set(r.x, y0 + partH / 2, r.z);
          m.receiveShadow = !isGlassWall;
          m.castShadow = !isGlassWall;
          g.add(m);
          // Moderne: no skirting/capital trim — those read as floating pillar plinths
          if (!isGlassWall && house.style !== 'moderne') {
            box(g, trim, [r.x, y0 + 0.2, r.z], [r.hw * 2 + 0.05, 0.4, r.hd * 2 + 0.05]);
            box(g, trim, [r.x, y0 + WALL_H - 0.2, r.z], [r.hw * 2 + 0.08, 0.2, r.hd * 2 + 0.08]);
          }
          fg.add(g);
          partitions.push({ mesh: g, rect: r, floor: f });
        }
      }
      // closed ceiling / roof over the top floor (fixes open sky bug)
      {
        const y0 = (FLOORS - 1) * FLOOR_H + WALL_H;
        const ceilCol = house.style === 'moderne' ? '#3a4048' : shade(house.wallColor || '#efeae3', -0.05);
        const ceil = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.35, d + 1.2), mat(ceilCol));
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
        // Slim dark handrail only — no tall white pillar balusters
        box(stairs, '#9ad8ff', [x, FLOOR_H + 1.0, (st.zTop + st.zBottom) / 2], [0.06, 0.06, st.zBottom - st.zTop], undefined, 0.35);
      }
      box(stairs, '#9ad8ff', [smx, FLOOR_H + 0.95, st.zBottom + 0.12], [st.x1 - st.x0 + 0.3, 0.06, 0.06], undefined, 0.35);
      floorGroups[0].add(stairs);
      // Moderne: keep stair open/light — no heavy spiral newel (was reading as giant pillars)

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
