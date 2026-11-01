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
      // Concept living: warm light walls (not grey concrete)
      const warmWall = house.style === 'moderne' ? '#f3efe8' : (house.wallColor || '#efeae3');
      wallMat.color.set(house.style === 'moderne' ? warmWall : (house.wallColor || warmWall));
      wallMat.roughness = 0.72;
      wallMat.metalness = 0.02;
      wallMat.map = null; // drop concrete albedo that reads as grey bunker
      const trim = '#e8e2d8';
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
            matFloor.color.set(house.floorColor || '#aeb6c0');
            matFloor.roughness = 0.32;
            matFloor.metalness = 0.1;
            matFloor.envMapIntensity = 0.9;
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
          const frameMat = new THREE.MeshStandardMaterial({ color: '#e8eef4', metalness: 0.35, roughness: 0.32 });
          const darkMat = new THREE.MeshStandardMaterial({ color: '#2a3340', metalness: 0.45, roughness: 0.35 });
          // side returns
          for (const sx of [-1, 1]) {
            const ret = new THREE.Mesh(new THREE.BoxGeometry(0.55, WALL_H, 0.4), wallMat);
            ret.position.set(sx * (panW / 2 + 0.4), y0 + WALL_H / 2, zBack - 0.05);
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
          // mullions
          for (const mx of [-panW * 0.28, 0, panW * 0.28]) {
            const mull = new THREE.Mesh(new THREE.BoxGeometry(0.08, panH, 0.1), frameMat);
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
            // distant tower meshes for parallax depth
            for (const [tx, th] of [[-5.5, 6.5], [-2.2, 8.2], [1.8, 7.0], [4.8, 9.0], [7.2, 5.5]] as const) {
              const tw = new THREE.Mesh(
                new THREE.BoxGeometry(1.1 + (th % 2) * 0.3, th, 1.1),
                new THREE.MeshStandardMaterial({ color: '#6a7a88', roughness: 0.55, metalness: 0.2 }),
              );
              tw.position.set(tx, y0 + th / 2 + 0.8, zBack - 1.1);
              back.add(tw);
            }
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
        // LED cove around ceiling perimeter (emissive strip + rect area light)
        {
          ensureRectArea();
          const coveY = y0 + WALL_H - 0.14;
          // MeshBasic cove so UnrealBloom picks it up clearly
          const coveMat = new THREE.MeshBasicMaterial({ color: '#ffe6c4' });
          const mkCove = (sx: number, sz: number, px: number, pz: number) => {
            const c = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), coveMat);
            c.position.set(px, coveY, pz);
            fg.add(c);
          };
          mkCove(w * 0.92, 0.09, 0, -d / 2 + 0.35);
          mkCove(w * 0.92, 0.09, 0, d / 2 - 0.35);
          mkCove(0.09, d * 0.85, -w / 2 + 0.35, 0);
          mkCove(0.09, d * 0.85, w / 2 - 0.35, 0);
          if (f === 0) {
            const area = new THREE.RectAreaLight('#fff3e0', 11, w * 0.7, d * 0.45);
            area.position.set(0, coveY - 0.05, -d * 0.08);
            area.rotation.x = -Math.PI / 2;
            fg.add(area);
            const soft = new THREE.PointLight('#ffe0b0', 0.85, 22, 2);
            soft.position.set(0, coveY - 0.4, 0);
            fg.add(soft);
          }
        }
        // Living-room composition facing the panoramic window (concept 2-hus-inne)
        if (f === 0) {
          const living = new THREE.Group();
          // Continuous curved light-grey sofa + small cushions facing window (−Z)
          {
            const sofa = new THREE.Group();
            const fabric = new THREE.MeshStandardMaterial({ color: '#c2ccd8', roughness: 0.64, metalness: 0.03, envMapIntensity: 0.55 });
            const cush = new THREE.MeshStandardMaterial({ color: '#eef3f8', roughness: 0.75, metalness: 0.02 });
            const accent = new THREE.MeshStandardMaterial({ color: '#9eb0c2', roughness: 0.7, metalness: 0.04 });
            // Continuous C-curve sofa (dense modules + cap strip reads as one piece)
            const curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(-1.85, 0, 0.35),
              new THREE.Vector3(-1.1, 0, -0.05),
              new THREE.Vector3(0, 0, -0.25),
              new THREE.Vector3(1.1, 0, -0.05),
              new THREE.Vector3(1.85, 0, 0.35),
            ]);
            // Approximate continuous sofa with dense overlapping modules sharing fabric
            const n = 11;
            for (let i = 0; i < n; i++) {
              const u = i / (n - 1);
              const p = curve.getPoint(u);
              const tng = curve.getTangent(u);
              const ang = Math.atan2(tng.x, tng.z);
              const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.95), fabric);
              seat.position.set(p.x, 0.4, p.z);
              seat.rotation.y = ang;
              sofa.add(seat);
              const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.2), fabric);
              back.position.set(p.x - Math.sin(ang) * 0.4, 0.86, p.z - Math.cos(ang) * 0.4);
              back.rotation.y = ang;
              sofa.add(back);
            }
            // Soft continuous look: hide seams with thin top cushion strip
            for (let i = 0; i < n; i++) {
              const u = i / (n - 1);
              const p = curve.getPoint(u);
              const tng = curve.getTangent(u);
              const ang = Math.atan2(tng.x, tng.z);
              const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.88), fabric);
              cap.position.set(p.x, 0.58, p.z);
              cap.rotation.y = ang;
              sofa.add(cap);
            }
            // Only a few small cushions
            for (const [u, col] of [[0.25, cush], [0.5, accent], [0.75, cush]] as const) {
              const p = curve.getPoint(u);
              const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), col);
              pillow.scale.set(1.0, 0.4, 0.9);
              pillow.position.set(p.x, 0.68, p.z + 0.08);
              sofa.add(pillow);
            }
            sofa.position.set(-1.2, y0, 1.0);
            living.add(sofa);
            // Round rug (calm grey — not orange/red)
            const rugOuter = new THREE.Mesh(
              new THREE.CylinderGeometry(1.65, 1.65, 0.03, 48),
              new THREE.MeshStandardMaterial({ color: '#8a96a4', roughness: 0.85, metalness: 0.02 }),
            );
            rugOuter.position.set(-1.2, y0 + 0.02, -0.05);
            living.add(rugOuter);
            const rugIn = new THREE.Mesh(
              new THREE.CylinderGeometry(1.1, 1.1, 0.032, 48),
              new THREE.MeshStandardMaterial({ color: '#d8dee6', roughness: 0.88, metalness: 0.02 }),
            );
            rugIn.position.set(-1.2, y0 + 0.025, -0.05);
            living.add(rugIn);
          }
          // Coffee table on the rug
          {
            const table = new THREE.Group();
            const top = new THREE.Mesh(
              new THREE.CylinderGeometry(0.55, 0.58, 0.05, 32),
              new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.22, metalness: 0.6, envMapIntensity: 1.2 }),
            );
            top.position.y = 0.4;
            table.add(top);
            const stem = new THREE.Mesh(
              new THREE.CylinderGeometry(0.06, 0.1, 0.36, 12),
              new THREE.MeshStandardMaterial({ color: '#8aa0b8', metalness: 0.75, roughness: 0.28 }),
            );
            stem.position.y = 0.2;
            table.add(stem);
            table.position.set(-1.2, y0, -0.15);
            living.add(table);
          }
          // Big holo-TV wall with glowing UI (living only — no pod eggs here)
          {
            const tw = 4.6;
            const th = 2.4;
            const tz = -d / 2 + 0.5;
            const holoFrame = new THREE.Mesh(
              new THREE.BoxGeometry(tw + 0.2, th + 0.2, 0.1),
              new THREE.MeshStandardMaterial({ color: '#121820', metalness: 0.7, roughness: 0.25 }),
            );
            holoFrame.position.set(-1.0, y0 + 2.35, tz);
            living.add(holoFrame);
            const hc = document.createElement('canvas');
            hc.width = 1024; hc.height = 576;
            const hx = hc.getContext('2d')!;
            hx.fillStyle = '#071428'; hx.fillRect(0, 0, 1024, 576);
            hx.strokeStyle = '#3ecbff'; hx.lineWidth = 4; hx.strokeRect(18, 18, 988, 540);
            hx.fillStyle = '#7ef0ff'; hx.font = '700 36px Inter, system-ui, sans-serif';
            hx.fillText('NORDIC HOME OS', 48, 70);
            hx.fillStyle = '#5a8cff'; hx.font = '500 22px Inter, system-ui, sans-serif';
            hx.fillText('Living · Climate 21° · Air good', 48, 108);
            hx.strokeStyle = '#3ecbffaa';
            for (let i = 0; i < 14; i++) {
              hx.beginPath();
              hx.moveTo(60 + i * 65, 480);
              hx.lineTo(90 + i * 60, 160 + (i * 37) % 220);
              hx.stroke();
            }
            hx.fillStyle = '#3ecbff';
            for (let i = 0; i < 16; i++) hx.fillRect(48 + i * 58, 500, 36, 10 + (i * 17) % 40);
            hx.fillStyle = '#ffe8d0'; hx.font = '600 18px Inter, system-ui, sans-serif';
            hx.fillText('Cove LEDs · On', 780, 70);
            const htex = new THREE.CanvasTexture(hc);
            htex.colorSpace = THREE.SRGBColorSpace;
            const holo = new THREE.Mesh(
              new THREE.PlaneGeometry(tw, th),
              new THREE.MeshBasicMaterial({ map: htex }),
            );
            holo.position.set(-1.0, y0 + 2.35, tz + 0.08);
            living.add(holo);
            const holoGlow = new THREE.PointLight('#3a7cff', 1.35, 10, 2);
            holoGlow.position.set(-1.0, y0 + 2.35, tz + 1.6);
            living.add(holoGlow);
            // Shelf units with blooming cove LEDs flanking the TV
            for (const sx of [-1, 1] as const) {
              const shelf = new THREE.Mesh(
                new THREE.BoxGeometry(0.75, 2.2, 0.34),
                SharedMats.wood.clone(),
              );
              shelf.position.set(-1.0 + sx * (tw / 2 + 0.55), y0 + 1.9, tz + 0.15);
              living.add(shelf);
              for (const ly of [1.0, 1.55, 2.1] as const) {
                const led = new THREE.Mesh(
                  new THREE.BoxGeometry(0.65, 0.04, 0.06),
                  new THREE.MeshBasicMaterial({ color: '#ffe6c4' }),
                );
                led.position.set(-1.0 + sx * (tw / 2 + 0.55), y0 + ly, tz + 0.3);
                living.add(led);
              }
            }
          }
          // Kitchen island to the right
          if (house.style === 'moderne') {
            const island = new THREE.Group();
            const base = new THREE.Mesh(
              new THREE.BoxGeometry(2.8, 0.95, 1.2),
              new THREE.MeshStandardMaterial({ color: '#d8dde4', roughness: 0.4, metalness: 0.1 }),
            );
            base.position.y = 0.48;
            island.add(base);
            const top = new THREE.Mesh(
              new THREE.BoxGeometry(2.95, 0.08, 1.3),
              new THREE.MeshStandardMaterial({ color: '#2a3340', roughness: 0.25, metalness: 0.4 }),
            );
            top.position.y = 1.0;
            island.add(top);
            const glow = new THREE.Mesh(
              new THREE.BoxGeometry(2.7, 0.04, 1.1),
              glowMat('#ffe0b0', 1.8),
            );
            glow.position.y = 0.06;
            island.add(glow);
            const faucet = new THREE.Mesh(
              new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI),
              new THREE.MeshStandardMaterial({ color: '#1a2230', metalness: 0.9, roughness: 0.2 }),
            );
            faucet.position.set(0.6, 1.2, 0);
            faucet.rotation.y = Math.PI / 2;
            island.add(faucet);
            island.position.set(4.6, y0, 0.4);
            living.add(island);
            for (const sx of [-0.55, 0.55]) {
              const stool = new THREE.Mesh(
                new THREE.CylinderGeometry(0.22, 0.25, 0.7, 16),
                new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.35, metalness: 0.5 }),
              );
              stool.position.set(4.6 + sx, y0 + 0.35, 1.5);
              living.add(stool);
              const seat = new THREE.Mesh(
                new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16),
                SharedMats.wood.clone(),
              );
              seat.position.set(4.6 + sx, y0 + 0.72, 1.5);
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
          const g = new THREE.Group();
          const m = new THREE.Mesh(
            G.box(),
            isGlassWall
              ? new THREE.MeshPhysicalMaterial({
                  color: '#c8dff0', metalness: 0.05, roughness: 0.08,
                  transparent: true, opacity: 0.28, transmission: 0, depthWrite: false,
                })
              : wallMat,
          );
          m.scale.set(isGlassWall ? 0.1 : r.hw * 2, WALL_H - 0.2, r.hd * 2);
          m.position.set(r.x, y0 + (WALL_H - 0.2) / 2, r.z);
          m.receiveShadow = !isGlassWall;
          m.castShadow = !isGlassWall;
          g.add(m);
          if (!isGlassWall) {
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
