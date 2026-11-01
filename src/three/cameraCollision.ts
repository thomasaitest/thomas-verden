import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();

function isIgnored(obj: THREE.Object3D, ignore?: Set<THREE.Object3D>): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (ignore?.has(o) || o.userData?.camIgnore || o.userData?.noFade) return true;
    o = o.parent;
  }
  return false;
}

export interface CamCollideOpts {
  target: THREE.Vector3;
  desired: THREE.Vector3;
  scene: THREE.Object3D;
  ignore?: Set<THREE.Object3D>;
  minDist?: number;
}

/** Pull camera toward target if something solid is between them. */
export function collideCamera(opts: CamCollideOpts): THREE.Vector3 {
  const { target, desired, scene, ignore, minDist = 1.2 } = opts;
  try {
    _dir.copy(desired).sub(target);
    const full = _dir.length();
    if (full < 0.01) return desired.clone();
    _dir.multiplyScalar(1 / full);
    _ray.set(target, _dir);
    _ray.far = full;
    scene.updateMatrixWorld(true);
    const hits = _ray.intersectObject(scene, true);
    for (const h of hits) {
      if (!h.object || isIgnored(h.object, ignore)) continue;
      // skip skinned/transparent fluff
      if (h.distance < minDist) continue;
      const d = Math.max(minDist, h.distance - 0.45);
      return target.clone().addScaledVector(_dir, d);
    }
  } catch {
    /* keep desired */
  }
  return desired.clone();
}

/** Fade meshes that occlude the view of the player (between cam and target). */
export function fadeOccluders(
  scene: THREE.Object3D,
  cam: THREE.Vector3,
  target: THREE.Vector3,
  ignore?: Set<THREE.Object3D>,
): void {
  try {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.userData._fadePrev != null) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && !Array.isArray(m.material) && m.userData._fadePrev === true) {
          mat.opacity = m.userData._fadeOpacity ?? 1;
          mat.transparent = m.userData._fadeWasTransparent ?? false;
          mat.depthWrite = m.userData._fadeDepthWrite ?? true;
          mat.needsUpdate = true;
        }
        delete m.userData._fadePrev;
      }
    });
    _dir.copy(target).sub(cam);
    const full = _dir.length();
    if (full < 0.5) return;
    _dir.multiplyScalar(1 / full);
    _ray.set(cam, _dir);
    _ray.far = full - 0.5;
    scene.updateMatrixWorld(true);
    const hits = _ray.intersectObject(scene, true);
    for (const h of hits) {
      if (!h.object || isIgnored(h.object, ignore)) continue;
      const m = h.object as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat || Array.isArray(m.material)) continue;
      m.userData._fadePrev = true;
      m.userData._fadeWasTransparent = mat.transparent;
      m.userData._fadeOpacity = mat.opacity;
      m.userData._fadeDepthWrite = mat.depthWrite;
      mat.transparent = true;
      mat.opacity = Math.min(mat.opacity, 0.22);
      mat.depthWrite = false;
      mat.needsUpdate = true;
    }
  } catch {
    /* ignore fade errors */
  }
}
