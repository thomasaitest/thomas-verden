import * as THREE from 'three';
import { box, cone, cyl, mat, rbox, sph } from './kit.ts';

const lathes = new Map<string, THREE.LatheGeometry>();
function lathe(key: string, pts: [number, number][], seg = 18): THREE.LatheGeometry {
  let g = lathes.get(key);
  if (!g) {
    g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
    lathes.set(key, g);
  }
  return g;
}
function addLathe(parent: THREE.Object3D, key: string, pts: [number, number][], color: string, pos: [number, number, number] = [0, 0, 0], scale = 1, opacity = 1): THREE.Mesh {
  const m = new THREE.Mesh(lathe(key, pts), opacity < 1 ? mat(color, 0, { transparent: true, opacity, depthWrite: false, roughness: 0.35 }) : mat(color));
  m.position.set(...pos);
  m.scale.setScalar(scale);
  parent.add(m);
  return m;
}

const APPLE: [number, number][] = [[0, 0.02], [0.17, 0], [0.3, 0.1], [0.35, 0.26], [0.31, 0.42], [0.19, 0.5], [0.07, 0.47], [0, 0.42]];
const BOTTLE: [number, number][] = [[0, 0], [0.16, 0], [0.18, 0.04], [0.18, 0.4], [0.15, 0.5], [0.07, 0.58], [0.07, 0.66], [0.0, 0.66]];
const CUP: [number, number][] = [[0, 0], [0.14, 0], [0.2, 0.5], [0.22, 0.52], [0.2, 0.5], [0, 0.5]];
const SCOOP: [number, number][] = [[0, 0], [0.12, 0.01], [0.2, 0.08], [0.22, 0.2], [0.17, 0.3], [0.07, 0.34], [0, 0.35]];

/** Nice little 3D versions of the shop's food and drink. Origin is the bottom centre; about 0.6 tall at most. */
export function buildFood(id: string): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'eple':
      addLathe(g, 'apple', APPLE, '#e8322f');
      addLathe(g, 'apple-hi', APPLE, '#ff6a5c', [0.02, 0.02, 0.02], 0.88);
      cyl(g, '#6b4a2b', [0, 0.54, 0], [0.04, 0.12, 0.04], [0, 0, 0.2]);
      sph(g, '#4fbf4a', [0.1, 0.55, 0], [0.16, 0.05, 0.09], [0, 0, 0.35]);
      break;
    case 'gulrot':
      cone(g, '#ff8a1f', [0, 0.2, 0], [0.22, 0.6, 0.22], [0, 0, Math.PI]);
      for (let i = 0; i < 6; i++) box(g, '#e07410', [0, 0.1 + i * 0.08, 0.1], [0.19 - i * 0.02, 0.012, 0.01]);
      for (let i = 0; i < 3; i++) cone(g, '#3fbf4a', [(i - 1) * 0.06, 0.58, 0], [0.07, 0.22, 0.07], [0, 0, (i - 1) * 0.35]);
      g.rotation.z = 0;
      break;
    case 'brod': {
      rbox(g, '#d89a45', [0, 0.14, 0], [0.7, 0.28, 0.34]);
      sph(g, '#e0a853', [0, 0.28, 0], [0.7, 0.22, 0.34]);
      for (let i = -1; i <= 1; i++) box(g, '#b97a2e', [i * 0.18, 0.37, 0], [0.04, 0.02, 0.2], [0, 0.5, 0]);
      break;
    }
    case 'pizza': {
      box(g, '#ffffff', [0, 0.02, 0], [0.62, 0.04, 0.62]);
      box(g, '#ff4f4f', [0, 0.05, 0.31], [0.62, 0.02, 0.01]);
      cyl(g, '#e6b25e', [0, 0.08, 0], [0.56, 0.06, 0.56]);
      cyl(g, '#f5d36a', [0, 0.115, 0], [0.46, 0.03, 0.46]);
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        cyl(g, '#c8372d', [Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15], [0.1, 0.02, 0.1]);
      }
      cyl(g, '#c8372d', [0, 0.14, 0], [0.1, 0.02, 0.1]);
      for (let i = 0; i < 4; i++) sph(g, '#4fbf4a', [Math.cos(i * 1.7 + 0.5) * 0.2, 0.145, Math.sin(i * 1.7 + 0.5) * 0.2], [0.05, 0.02, 0.05]);
      break;
    }
    case 'kakestykke': {
      const wedge = (y: number, h: number, c: string, r = 0.4) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, false, 0, 1.15), mat(c));
        m.position.set(0, y, 0);
        m.rotation.y = -0.575 + Math.PI / 2;
        g.add(m);
      };
      wedge(0.08, 0.16, '#8a5a3c');
      wedge(0.19, 0.06, '#fff4e0');
      wedge(0.3, 0.16, '#8a5a3c');
      wedge(0.42, 0.08, '#ff9ccf');
      sph(g, '#e8322f', [0.14, 0.5, 0.0], [0.14, 0.14, 0.14]);
      g.position.x = 0;
      break;
    }
    case 'is': {
      cone(g, '#e0a25a', [0, 0.22, 0], [0.3, 0.44, 0.3], [0, 0, Math.PI]);
      for (let i = 0; i < 5; i++) box(g, '#c98a43', [0, 0.1 + i * 0.07, 0.13], [0.2 - i * 0.03, 0.01, 0.01]);
      addLathe(g, 'scoop', SCOOP, '#ff9ccf', [0, 0.42, 0]);
      addLathe(g, 'scoop', SCOOP, '#fff1c9', [0, 0.62, 0], 0.85);
      sph(g, '#e8322f', [0.02, 0.97, 0], [0.12, 0.12, 0.12]);
      g.scale.setScalar(0.85);
      break;
    }
    case 'vann':
      addLathe(g, 'bottle', BOTTLE, '#bfe9ff', [0, 0, 0], 1, 0.85);
      addLathe(g, 'bottle-water', BOTTLE, '#6fc6ff', [0, 0.01, 0], 0.88, 0.6);
      cyl(g, '#3fa4ff', [0, 0.66, 0], [0.16, 0.06, 0.16]);
      cyl(g, '#ffffff', [0, 0.28, 0], [0.37, 0.18, 0.37]);
      cyl(g, '#3fa4ff', [0, 0.28, 0], [0.375, 0.07, 0.375]);
      break;
    case 'melk':
      box(g, '#ffffff', [0, 0.22, 0], [0.3, 0.44, 0.3]);
      // gable roof
      box(g, '#3f78d8', [0, 0.5, 0], [0.3, 0.1, 0.3]);
      box(g, '#ffffff', [0, 0.57, 0], [0.3, 0.05, 0.08]);
      box(g, '#3f78d8', [0, 0.26, 0.152], [0.3, 0.12, 0.01]);
      for (const [x, y] of [[-0.06, 0.38], [0.07, 0.34], [0.0, 0.14]]) sph(g, '#2b2340', [x, y, 0.153], [0.07, 0.05, 0.01]);
      break;
    case 'juice':
      box(g, '#ff9a1f', [0, 0.22, 0], [0.3, 0.44, 0.22]);
      box(g, '#ffd23f', [0, 0.26, 0.112], [0.2, 0.2, 0.01]);
      cyl(g, '#ff8a1f', [0, 0.26, 0.118], [0.12, 0.01, 0.12], [Math.PI / 2, 0, 0]);
      cyl(g, '#ff4f7f', [0.07, 0.56, 0], [0.025, 0.28, 0.025], [0, 0, -0.15]);
      break;
    case 'smoothie':
      addLathe(g, 'cup', CUP, '#ffffff', [0, 0, 0], 1, 0.9);
      cyl(g, '#c86bff', [0, 0.26, 0], [0.34, 0.46, 0.34]);
      sph(g, '#e6a8ff', [0, 0.5, 0], [0.4, 0.14, 0.4]);
      cyl(g, '#ffffff', [0, 0.53, 0], [0.46, 0.04, 0.46]);
      cyl(g, '#7ccf6a', [0.05, 0.7, 0], [0.03, 0.4, 0.03], [0, 0, -0.1]);
      sph(g, '#ff4f7f', [-0.07, 0.56, 0.05], [0.07, 0.07, 0.07]);
      break;
    default:
      rbox(g, '#cccccc', [0, 0.15, 0], [0.3, 0.3, 0.3]);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}
