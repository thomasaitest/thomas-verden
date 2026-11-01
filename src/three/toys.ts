import * as THREE from 'three';
import { TOY_BY_ID } from '../logic/catalog.ts';
import { buildFurniture } from './furniture.ts';
import { box, cyl, G, part, sph } from './kit.ts';

/** A toy as a 3D model, about 0.5 units across, standing on y = 0. Used in the world and for backpack pictures. */
export function buildToy(id: string): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'leke-ball': {
      sph(g, '#ff5f6f', [0, 0.3, 0], [0.6, 0.6, 0.6]);
      cyl(g, '#ffffff', [0, 0.3, 0], [0.62, 0.1, 0.62]); // a white band round the middle
      cyl(g, '#ffffff', [0, 0.3, 0], [0.62, 0.1, 0.62], [Math.PI / 2, 0, 0]);
      sph(g, '#ffd23f', [0, 0.3, 0], [0.12, 0.62, 0.12]);
      break;
    }
    case 'leke-pinne': {
      cyl(g, '#8a5a3c', [0, 0.12, 0], [0.12, 1.1, 0.12], [0, 0, Math.PI / 2 - 0.15]);
      cyl(g, '#8a5a3c', [0.18, 0.2, 0], [0.08, 0.4, 0.08], [0, 0, 0.7]);
      cyl(g, '#b07a4a', [-0.3, 0.1, 0], [0.13, 0.2, 0.13], [0, 0, Math.PI / 2 - 0.15]);
      break;
    }
    case 'leke-bamse': {
      const t = buildFurniture('teddy', '#c98a55').clone();
      t.scale.setScalar(0.65);
      g.add(t);
      break;
    }
    case 'leke-garn': {
      sph(g, '#c88bff', [0, 0.32, 0], [0.64, 0.64, 0.64]);
      for (let i = 0; i < 4; i++) part(g, G.torus(), i % 2 ? '#ff8fb1' : '#e8c8ff', [0, 0.32, 0], [0.5, 0.5, 0.5], [i * 0.8, i * 0.5, i * 0.3]);
      box(g, '#c88bff', [0.55, 0.03, 0.1], [0.5, 0.04, 0.04], [0, 0.4, 0]); // a loose thread
      break;
    }
    default:
      if (!TOY_BY_ID[id]) throw new Error(`unknown toy ${id}`);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.userData.uid = id;
    }
  });
  return g;
}
