/** Lazy GLB loader with shared cache. Paths under public/models/ (base-aware). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { publicUrl } from '../util/publicUrl';

type Entry = { scene: THREE.Group; animations: THREE.AnimationClip[] };

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath(publicUrl('draco/'));
loader.setDRACOLoader(draco);

const cache = new Map<string, Promise<Entry>>();

export function loadModel(path: string): Promise<THREE.Group & { animations: THREE.AnimationClip[] }> {
  const key = path.startsWith('/') ? publicUrl(path) : publicUrl(`models/${path}`);
  let p = cache.get(key);
  if (!p) {
    p = loader.loadAsync(key).then((gltf) => {
      const scene = gltf.scene;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return { scene, animations: gltf.animations };
    });
    cache.set(key, p);
  }
  return p.then(({ scene, animations }) => {
    // SkeletonUtils.clone keeps SkinnedMesh ↔ skeleton bone binding (scene.clone breaks it)
    const g = skeletonClone(scene) as THREE.Group & { animations: THREE.AnimationClip[] };
    g.animations = animations;
    g.userData.animations = animations;
    return g;
  });
}

export function prefetch(paths: string[]): void {
  for (const p of paths) void loadModel(p).catch(() => undefined);
}

export function disposeModelCache(): void {
  cache.clear();
}
