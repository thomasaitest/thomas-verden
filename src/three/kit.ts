import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type MatOpts = { metalness?: number; roughness?: number; transparent?: boolean; opacity?: number; side?: THREE.Side; depthWrite?: boolean };

const mats = new Map<string, THREE.MeshStandardMaterial>();
/** Shared PBR material per colour (MeshStandard – stylized-realistic look). */
export function mat(color: string, emissive = 0, opts: MatOpts = {}): THREE.MeshStandardMaterial {
  const metalness = opts.metalness ?? 0.12;
  const roughness = opts.roughness ?? 0.55;
  const transparent = !!opts.transparent;
  const opacity = opts.opacity ?? 1;
  const side = opts.side ?? THREE.FrontSide;
  const depthWrite = opts.depthWrite ?? true;
  const key = `${color}|${emissive}|${metalness}|${roughness}|${transparent}|${opacity}|${side}|${depthWrite}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      transparent,
      opacity,
      side,
      depthWrite,
    });
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    }
    mats.set(key, m);
  }
  return m;
}

/** Glass-like transparent material. */
export function glassMat(color = '#bfe9ff', opacity = 0.32): THREE.MeshStandardMaterial {
  return mat(color, 0.02, { metalness: 0.35, roughness: 0.08, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

/** Bright emissive accent (lane lines, holos, thrusters). */
export function glowMat(color: string, intensity = 1.2): THREE.MeshStandardMaterial {
  return mat(color, intensity, { metalness: 0.2, roughness: 0.35 });
}

const geos = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}

export const G = {
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  rbox: (r = 0.18) => cached(`rbox${r}`, () => new RoundedBoxGeometry(1, 1, 1, 2, r)),
  sph: () => cached('sph', () => new THREE.SphereGeometry(0.5, 14, 10)),
  cyl: () => cached('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16)),
  cone: () => cached('cone', () => new THREE.ConeGeometry(0.5, 1, 14)),
  torus: () => cached('torus', () => new THREE.TorusGeometry(0.5, 0.12, 8, 24)),
  ico: () => cached('ico', () => new THREE.IcosahedronGeometry(0.5, 0)),
  disc: () => cached('disc', () => new THREE.CircleGeometry(0.5, 24)),
  heart: () =>
    cached('heart', () => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.5);
      s.bezierCurveTo(-0.6, -0.05, -0.55, 0.45, 0, 0.2);
      s.bezierCurveTo(0.55, 0.45, 0.6, -0.05, 0, -0.5);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
      g.center();
      return g;
    }),
  star: () =>
    cached('star', () => {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.22 : 0.5;
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
      g.center();
      return g;
    }),
};

export type V3 = [number, number, number];

/** Add a mesh with position, scale and optional rotation to a parent. */
export function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: V3, scale: V3, rot: V3 = [0, 0, 0], emissive = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, emissive));
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  parent.add(m);
  return m;
}

export const box = (p: THREE.Object3D, c: string, pos: V3, s: V3, r?: V3, e = 0) => part(p, G.box(), c, pos, s, r, e);
export const rbox = (p: THREE.Object3D, c: string, pos: V3, s: V3, r?: V3, e = 0) => part(p, G.rbox(), c, pos, s, r, e);
export const sph = (p: THREE.Object3D, c: string, pos: V3, s: V3, r?: V3, e = 0) => part(p, G.sph(), c, pos, s, r, e);
export const cyl = (p: THREE.Object3D, c: string, pos: V3, s: V3, r?: V3, e = 0) => part(p, G.cyl(), c, pos, s, r, e);
export const cone = (p: THREE.Object3D, c: string, pos: V3, s: V3, r?: V3, e = 0) => part(p, G.cone(), c, pos, s, r, e);

/**
 * Merge every mesh under a group into one mesh per material, to cut draw calls for static scenery.
 */
export function mergeStatic(group: THREE.Object3D, opts: { cast?: boolean; receive?: boolean } = {}): THREE.Group {
  group.updateMatrixWorld(true);
  const byMat = new Map<string, { material: THREE.Material; cast: boolean; list: THREE.BufferGeometry[] }>();
  const keep: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mm = m.material as THREE.MeshStandardMaterial;
    if (mm.map || mm.transparent) {
      keep.push(m);
      return;
    }
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(m.matrixWorld);
    const material = m.material as THREE.Material;
    const cast = !!opts.cast && !m.userData.noCast;
    const key = `${material.uuid}|${cast}`;
    if (!byMat.has(key)) byMat.set(key, { material, cast, list: [] });
    byMat.get(key)!.list.push(g);
  });
  const out = new THREE.Group();
  for (const { material, cast, list } of byMat.values()) {
    const merged = mergeGeometries(list, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = !!opts.receive;
    out.add(mesh);
    list.forEach((g) => g.dispose());
  }
  for (const m of keep) {
    const c = new THREE.Mesh(m.geometry, m.material);
    m.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    out.add(c);
  }
  return out;
}

/**
 * Bake static meshes that look the same (colour / roughness / metal) into one
 * draw each. Transparent, textured and instanced meshes stay individual.
 */
export function coalesceLook(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    if (m.userData.noMerge || m.userData.spin) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat || Array.isArray(m.material) || mat.map || mat.transparent || mat.alphaMap) return;
    const key = [
      mat.type,
      mat.color?.getHexString?.() ?? '',
      mat.roughness ?? '',
      mat.metalness ?? '',
      mat.emissive?.getHexString?.() ?? '',
      mat.emissiveIntensity ?? 0,
      mat.side ?? 0,
      m.castShadow ? 1 : 0,
    ].join('|');
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: mat, cast: m.castShadow, geos: [], meshes: [] };
      buckets.set(key, bucket);
    }
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.applyMatrix4(rootInv.clone().multiply(m.matrixWorld));
    bucket.geos.push(g);
    bucket.meshes.push(m);
  });
  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 2) {
      for (const g of bucket.geos) g.dispose();
      continue;
    }
    const merged = mergeGeometries(bucket.geos, false);
    for (const g of bucket.geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    for (const old of bucket.meshes) old.parent?.remove(old);
  }
}

export function shadowAll(o: THREE.Object3D, cast = true, receive = false): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast && !m.userData.noCast;
      m.receiveShadow = receive;
    }
  });
}

/** Text drawn on a canvas, for signs and labels. */
export function textTexture(text: string, opts: { bg?: string; fg?: string; w?: number; h?: number; font?: number; stroke?: string } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    const r = h * 0.3;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, r);
    ctx.fill();
    // soft glow rim
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.45)';
    ctx.stroke();
  }
  ctx.font = `700 ${opts.font ?? Math.floor(h * 0.55)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.stroke) {
    ctx.lineWidth = 10;
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(text, w / 2, h / 2 + 4);
  }
  ctx.fillStyle = opts.fg ?? '#e8f4ff';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A soft round shadow under characters (cheaper than real shadows). */
let blobTex: THREE.Texture | null = null;
export function blobShadow(size = 1): THREE.Mesh {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(20,30,50,0.4)');
    g.addColorStop(1, 'rgba(20,30,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

/** Procedural canvas noise for subtle surface variation (no photo textures). */
export function noiseTexture(size = 128, opts: { a?: string; b?: string; scale?: number } = {}): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const a = opts.a ?? '#6a9a6a';
  const b = opts.b ?? '#5a8a5a';
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.35; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = (opts.scale ?? 1) * (0.4 + Math.random() * 1.8);
    ctx.fillStyle = Math.random() > 0.5 ? b : a;
    ctx.globalAlpha = 0.35 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function tileTexture(size = 256, opts: { mortar?: string; tile?: string; tiles?: number } = {}): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const n = opts.tiles ?? 6;
  const mortar = opts.mortar ?? '#9aa4b0';
  const tile = opts.tile ?? '#d0d6de';
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const gap = 3;
  const tw = (size - gap * (n + 1)) / n;
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const shade = Math.floor(-8 + Math.random() * 16);
    ctx.fillStyle = shadeTile(tile, shade);
    ctx.fillRect(gap + ix * (tw + gap), gap + iy * (tw + gap), tw, tw);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function shadeTile(hex: string, d: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + d));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d));
  const b = Math.max(0, Math.min(255, (n & 255) + d));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function asphaltTexture(size = 256): THREE.CanvasTexture {
  return noiseTexture(size, { a: '#4a5160', b: '#3a414e', scale: 1.2 });
}
