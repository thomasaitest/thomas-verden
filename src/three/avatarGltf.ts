import * as THREE from 'three';
import type { Avatar } from '../logic/avatar.ts';
import { loadModel } from './assets.ts';
import type { AvatarPose, AvatarRig } from './avatarModel.ts';

const CHAR_PATHS = {
  mCasual: 'characters/m-casual-hoodie.glb',
  mCasual2: 'characters/m-casual-2.glb',
  mSpace: 'characters/m-spacesuit.glb',
  wCasual: 'characters/w-casual.glb',
  wSci: 'characters/w-scifi.glb',
  wSuit: 'characters/w-suit.glb',
} as const;

function pickPath(a: Avatar): string {
  const bottom = a.bottom || '';
  const skirtLike = /skjort|kjole|tutu|plissert|ballkjole|miniskjort|langtskort/.test(bottom);
  if (skirtLike) {
    if (a.accessory.includes('ryggsekk') || a.hat !== 'ingen') return CHAR_PATHS.wSci;
    return CHAR_PATHS.wCasual;
  }
  if (a.hat === 'hjelm' || a.accessory.includes('vinger')) return CHAR_PATHS.mSpace;
  if (a.print === 'hjerte' || a.accessory.includes('ryggsekk')) return CHAR_PATHS.mCasual;
  return CHAR_PATHS.mCasual2;
}

function tintMeshes(root: THREE.Object3D, a: Avatar) {
  // Quaternius modular packs often name meshes CubeNNN — tint by relative height + name hints.
  root.updateWorldMatrix(true, true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) meshes.push(m);
  });
  // overall height for relative bands
  const rootBox = new THREE.Box3().setFromObject(root);
  const y0 = rootBox.min.y;
  const y1 = rootBox.max.y;
  const span = Math.max(0.01, y1 - y0);
  for (const m of meshes) {
    const box = new THREE.Box3().setFromObject(m);
    const midY = (box.min.y + box.max.y) * 0.5;
    const t = (midY - y0) / span; // 0 feet .. 1 head
    const name = `${(m.material as THREE.Material)?.name || ''} ${m.name || ''}`.toLowerCase();
    let hex = a.shirt;
    if (/hair/.test(name) || t > 0.88) hex = a.hairColor;
    else if (/skin|face|arm|hand|head|neck/.test(name) || (t > 0.72 && t <= 0.88)) hex = a.skin;
    else if (/shoe|boot|sneaker/.test(name) || t < 0.12) hex = a.shoes;
    else if (/pant|leg|bottom|jean|trouser/.test(name) || (t >= 0.12 && t < 0.42)) hex = a.pants;
    else hex = a.shirt;
    const apply = (mat: THREE.Material) => {
      const std = (mat as THREE.MeshStandardMaterial).clone();
      if (!std?.color) return mat;
      std.color = new THREE.Color(hex);
      std.roughness = Math.min(0.85, (std.roughness ?? 0.7) + 0.05);
      std.metalness = Math.min(0.12, std.metalness ?? 0);
      std.envMapIntensity = 0.75;
      std.needsUpdate = true;
      return std;
    };
    if (Array.isArray(m.material)) m.material = m.material.map(apply);
    else m.material = apply(m.material);
  }
}

export async function attachGltfAvatar(rig: AvatarRig, a: Avatar): Promise<void> {
  try {
    const model = await loadModel(pickPath(a));
    model.scale.setScalar(1.35);
    model.position.set(0, 0, 0);
    model.userData.camIgnore = true;
    tintMeshes(model, a);
    // swap in only after successful load
    while (rig.body.children.length) rig.body.remove(rig.body.children[0]!);
    rig.body.scale.set(1, 1, 1);
    rig.body.add(model);

    const list: THREE.AnimationClip[] =
      (model.animations && model.animations.length ? model.animations : null) ||
      ((model.userData.animations as THREE.AnimationClip[] | undefined) ?? []);

    const mixer = new THREE.AnimationMixer(model);
    const byName = (n: string) => list.find((c) => c.name === n) ?? null;
    const clips = {
      idle: byName('Idle') || byName('Idle_Neutral'),
      walk: byName('Walk'),
      run: byName('Run'),
      wave: byName('Wave'),
      sit: byName('Idle_Neutral') || byName('Idle'),
    };
    const actions: Record<string, THREE.AnimationAction | null> = {};
    for (const [k, clip] of Object.entries(clips)) {
      actions[k] = clip ? mixer.clipAction(clip) : null;
    }
    (rig as AvatarRig & { mixer?: THREE.AnimationMixer; actions?: typeof actions; gltf?: boolean }).mixer = mixer;
    (rig as AvatarRig & { actions?: typeof actions }).actions = actions;
    (rig as AvatarRig & { gltf?: boolean }).gltf = true;
    rig.legs = [];
    rig.arms = [];
    const head = new THREE.Group();
    head.position.set(0, 1.6, 0);
    rig.body.add(head);
    rig.head = head;
  } catch (e) {
    console.warn('gltf avatar failed, keeping procedural', e);
  }
}

export function tickGltfAvatar(rig: AvatarRig, dt: number, pose: AvatarPose, speed: number): boolean {
  const ext = rig as AvatarRig & {
    mixer?: THREE.AnimationMixer;
    actions?: Record<string, THREE.AnimationAction | null>;
  };
  if (!ext.mixer || !ext.actions) return false;
  let key = 'idle';
  if (pose === 'wave') key = 'wave';
  else if (pose === 'sit' || pose === 'drive' || pose === 'sleep') key = 'sit';
  else if (pose === 'walk' || speed > 0.05) key = speed > 8 ? 'run' : 'walk';
  else if (pose === 'jump' || pose === 'fly') key = 'walk';
  for (const [k, act] of Object.entries(ext.actions)) {
    if (!act) continue;
    if (k === key) {
      if (!act.isRunning()) act.reset().fadeIn(0.15).play();
      act.setEffectiveTimeScale(k === 'walk' || k === 'run' ? Math.max(0.7, Math.min(1.6, speed / 6 || 1)) : 1);
    } else if (act.isRunning()) {
      act.fadeOut(0.15);
    }
  }
  ext.mixer.update(dt);
  return true;
}

export const AVATAR_PREFETCH = Object.values(CHAR_PATHS);
