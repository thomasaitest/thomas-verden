/** CC0 PBR texture sets (ambientCG) — shared materials updated when maps load. */
import * as THREE from 'three';

export type PbrKind = 'wood' | 'wood-siding' | 'concrete' | 'paving' | 'asphalt' | 'metal' | 'grass';

export interface PbrMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
}

const cache = new Map<string, PbrMaps>();
const loader = new THREE.TextureLoader();

function loadOne(url: string, colorSpace?: THREE.ColorSpace): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        if (colorSpace) t.colorSpace = colorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

async function tryLoad(url: string, colorSpace?: THREE.ColorSpace): Promise<THREE.Texture | undefined> {
  try {
    return await loadOne(url, colorSpace);
  } catch {
    return undefined;
  }
}

export async function loadPbr(kind: PbrKind, repeat: [number, number] = [1, 1]): Promise<PbrMaps> {
  const key = `${kind}:${repeat[0]}x${repeat[1]}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') {
    const mk = () => {
      const t = new THREE.DataTexture(new Uint8Array([180, 180, 180, 255]), 1, 1);
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
      return t;
    };
    const maps: PbrMaps = { map: mk(), normalMap: mk(), roughnessMap: mk() };
    cache.set(key, maps);
    return maps;
  }
  const base = `/textures/${kind}`;
  const map = await loadOne(`${base}/color.jpg`, THREE.SRGBColorSpace);
  const normalMap = await loadOne(`${base}/normal.jpg`);
  const roughnessMap = await loadOne(`${base}/roughness.jpg`);
  const aoMap = await tryLoad(`${base}/ao.jpg`);
  const metalnessMap = await tryLoad(`${base}/metalness.jpg`);
  for (const t of [map, normalMap, roughnessMap, aoMap, metalnessMap]) {
    if (!t) continue;
    t.repeat.set(repeat[0], repeat[1]);
  }
  const maps: PbrMaps = { map, normalMap, roughnessMap, aoMap, metalnessMap };
  cache.set(key, maps);
  return maps;
}

function applyMaps(mat: THREE.MeshStandardMaterial, maps: PbrMaps, metalnessDefault = 0.05) {
  mat.map = maps.map;
  mat.normalMap = maps.normalMap;
  mat.roughnessMap = maps.roughnessMap;
  mat.aoMap = maps.aoMap ?? null;
  mat.metalnessMap = maps.metalnessMap ?? null;
  if (maps.metalnessMap) mat.metalness = 1;
  else if (mat.metalness < 0.01) mat.metalness = metalnessDefault;
  mat.needsUpdate = true;
}

/** Shared scene materials — maps assigned by preloadSharedPbr(). */
export const SharedMats = {
  white: new THREE.MeshStandardMaterial({
    color: '#b4bcc6',
    metalness: 0.1,
    roughness: 0.52,
    envMapIntensity: 0.75,
  }),
  wood: new THREE.MeshStandardMaterial({
    color: '#d4b896',
    metalness: 0.02,
    roughness: 0.72,
    envMapIntensity: 0.6,
  }),
  concrete: new THREE.MeshStandardMaterial({
    color: '#9aa3ae',
    metalness: 0.08,
    roughness: 0.7,
    envMapIntensity: 0.65,
  }),
  paving: new THREE.MeshStandardMaterial({
    color: '#a8b0b8',
    metalness: 0.05,
    roughness: 0.78,
    envMapIntensity: 0.55,
  }),
  asphalt: new THREE.MeshStandardMaterial({
    color: '#4a4a50',
    metalness: 0.05,
    roughness: 0.88,
    envMapIntensity: 0.4,
  }),
  metal: new THREE.MeshStandardMaterial({
    color: '#8a929c',
    metalness: 0.85,
    roughness: 0.35,
    envMapIntensity: 1.0,
  }),
  grass: new THREE.MeshStandardMaterial({
    color: '#6a9a58',
    metalness: 0.02,
    roughness: 0.92,
    envMapIntensity: 0.45,
  }),
  interiorFloor: new THREE.MeshStandardMaterial({
    color: '#8a929c',
    metalness: 0.12,
    roughness: 0.45,
    envMapIntensity: 0.9,
  }),
  interiorWall: new THREE.MeshStandardMaterial({
    color: '#c5ccd4',
    metalness: 0.05,
    roughness: 0.7,
    envMapIntensity: 0.55,
  }),
};

let sharedReady: Promise<void> | null = null;

export async function preloadSharedPbr(): Promise<void> {
  if (sharedReady) return sharedReady;
  sharedReady = (async () => {
    try {
      const [wood, concrete, paving, asphalt, metal, grass, woodFloor] = await Promise.all([
        loadPbr('wood-siding', [2, 3]),
        loadPbr('concrete', [3, 3]),
        loadPbr('paving', [6, 6]),
        loadPbr('asphalt', [8, 8]),
        loadPbr('metal', [2, 2]),
        loadPbr('grass', [10, 10]),
        loadPbr('wood', [4, 4]),
      ]);
      applyMaps(SharedMats.white, concrete, 0.08);
      SharedMats.white.color.set('#b4bcc6');
      SharedMats.white.roughness = 0.55;
      applyMaps(SharedMats.wood, wood, 0.02);
      SharedMats.wood.color.set('#d4b896');
      applyMaps(SharedMats.concrete, concrete, 0.08);
      applyMaps(SharedMats.paving, paving, 0.05);
      applyMaps(SharedMats.asphalt, asphalt, 0.05);
      applyMaps(SharedMats.metal, metal, 0.85);
      SharedMats.metal.metalness = 0.85;
      SharedMats.metal.roughness = 0.35;
      applyMaps(SharedMats.grass, grass, 0.02);
      applyMaps(SharedMats.interiorFloor, concrete, 0.12);
      SharedMats.interiorFloor.color.set('#8a929c');
      SharedMats.interiorFloor.roughness = 0.42;
      applyMaps(SharedMats.interiorWall, concrete, 0.05);
      SharedMats.interiorWall.color.set('#c5ccd4');
      // wood floor variant kept available via woodFloor maps on SharedMats.wood for benches
      void woodFloor;
    } catch {
      /* tests / offline */
    }
  })();
  return sharedReady;
}

export function pbrStandard(
  maps: PbrMaps,
  opts: { color?: string; metalness?: number; roughness?: number; flatShading?: boolean } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    aoMap: maps.aoMap,
    metalnessMap: maps.metalnessMap,
    color: new THREE.Color(opts.color ?? '#c8c8c8'),
    metalness: opts.metalness ?? (maps.metalnessMap ? 1 : 0.05),
    roughness: opts.roughness ?? 0.75,
    envMapIntensity: 0.85,
  });
}

export function physicalGlass(color = '#8eb8d0', transmission = 0.85): THREE.MeshPhysicalMaterial {
  // Cap transmission for SwiftShader/mobile stability; still reads as glass via env reflections
  const t = Math.min(transmission, 0.72);
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.05,
    roughness: 0.08,
    transmission: t,
    thickness: 0.45,
    ior: 1.45,
    transparent: true,
    opacity: 1,
    envMapIntensity: 1.25,
    specularIntensity: 1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.2,
  });
}

export function archWhite(maps?: PbrMaps): THREE.MeshStandardMaterial {
  if (maps) return pbrStandard(maps, { color: '#c5ccd4', metalness: 0.08, roughness: 0.55 });
  return SharedMats.white;
}
