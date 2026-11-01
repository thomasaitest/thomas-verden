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
    if (a.accessory.startsWith('sekk') || a.accessory.includes('ryggsekk') || a.hat !== 'ingen') return CHAR_PATHS.wSci;
    return CHAR_PATHS.wCasual;
  }
  if (a.hat === 'hjelm' || a.accessory.includes('vinger')) return CHAR_PATHS.mSpace;
  if (a.print === 'hjerte' || a.accessory.startsWith('sekk') || a.accessory.includes('ryggsekk')) return CHAR_PATHS.mCasual;
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
    const tech = /skjort|kjole|tutu|plissert|ballkjole|miniskjort|langtskort/.test(a.bottom || '') || a.accessory.includes('vinger') || a.accessory.startsWith('sekk');
    const apply = (mat: THREE.Material) => {
      const std = (mat as THREE.MeshStandardMaterial).clone();
      if (!std?.color) return mat;
      std.color = new THREE.Color(hex);
      if (hex === a.shirt && tech) {
        std.roughness = 0.35;
        std.metalness = 0.28;
        std.envMapIntensity = 1.15;
        if (a.shirt.toLowerCase().includes('c8') || a.shirt.toLowerCase().includes('a6') || a.shirt.toLowerCase().includes('ff')) {
          std.emissive = new THREE.Color(hex);
          std.emissiveIntensity = 0.12;
        }
      } else if (hex === a.pants && tech) {
        std.roughness = 0.28;
        std.metalness = 0.35;
        std.envMapIntensity = 1.05;
      } else {
        std.roughness = Math.min(0.82, (std.roughness ?? 0.7) + 0.02);
        std.metalness = Math.min(0.15, std.metalness ?? 0);
        std.envMapIntensity = 0.85;
      }
      std.needsUpdate = true;
      return std;
    };
    if (Array.isArray(m.material)) m.material = m.material.map(apply);
    else m.material = apply(m.material);
  }
}


/** Concept-style overlays on Quaternius humans: glow skirt, tech pack, light wings, jewellery. */
function attachFuturisticGear(root: THREE.Object3D, a: Avatar) {
  const gear = new THREE.Group();
  gear.name = 'futuristicGear';
  const glow = (color: string, intensity = 1.2) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.25,
      metalness: 0.45,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.2,
    });
  const glass = (color: string, opacity = 0.45) =>
    new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity,
      transmission: 0.55,
      roughness: 0.15,
      metalness: 0.05,
      thickness: 0.2,
      emissive: color,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });
  const metal = (color: string) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.4 });

  const bottom = a.bottom || '';
  const skirtLike = /skjort|kjole|tutu|plissert|ballkjole|miniskjort|langtskort/.test(bottom);
  if (skirtLike) {
    // holographic glow skirt panels
    const skirtCol = a.pants || a.shirt || '#c88bff';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.85), glass(skirtCol, 0.5));
      panel.position.set(Math.sin(ang) * 0.38, 0.85, Math.cos(ang) * 0.38);
      panel.rotation.y = ang;
      panel.rotation.x = 0.15;
      gear.add(panel);
    }
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 32), glow(skirtCol, 1.4));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.48;
    gear.add(hem);
  }

  const acc = a.accessory || 'ingen';
  if (acc.startsWith('sekk') || acc === 'sekk') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.28), metal('#2a3344'));
    pack.position.set(0, 1.35, -0.42);
    gear.add(pack);
    for (const y of [1.55, 1.35, 1.15]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.04), glow('#3ecbff', 1.6));
      strip.position.set(0, y, -0.57);
      gear.add(strip);
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), metal('#8aa0b8'));
    antenna.position.set(0.18, 1.85, -0.42);
    gear.add(antenna);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), glow('#7ef0ff', 2));
    tip.position.set(0.18, 2.05, -0.42);
    gear.add(tip);
  }

  if (acc.includes('vinger')) {
    const wingCol = acc.includes('regnbue') ? '#7ef0ff' : acc.includes('engel') ? '#fff4e0' : '#e0b8ff';
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12, 0, Math.PI, 0, Math.PI), glass(wingCol, 0.4));
      wing.scale.set(0.55, 1.05, 0.12);
      wing.position.set(s * 0.55, 1.45, -0.35);
      wing.rotation.y = s * 0.55;
      wing.rotation.z = s * 0.25;
      gear.add(wing);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.04), glow(wingCol, 1.1));
      rib.position.set(s * 0.35, 1.45, -0.32);
      rib.rotation.z = s * 0.35;
      gear.add(rib);
    }
  }

  // jewellery accents (necklace / earrings / bracelet) — always a subtle futuristic read on tech looks
  if (acc === 'halskjede' || acc === 'perlekjede' || skirtLike || acc.startsWith('sekk')) {
    for (let i = 0; i < 10; i++) {
      const t = (i / 9) * Math.PI;
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        i === 5 ? glow('#3ecbff', 1.8) : metal('#e8d090'),
      );
      bead.position.set(Math.cos(t) * 0.22, 1.55 - Math.sin(t) * 0.18, 0.2);
      gear.add(bead);
    }
  }
  if (acc === 'oreringer' || acc === 'glorie' || skirtLike) {
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), metal('#e8d090'));
      ring.position.set(s * 0.28, 1.72, 0.05);
      gear.add(ring);
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), glow('#c88bff', 1.3));
      drop.position.set(s * 0.28, 1.64, 0.05);
      gear.add(drop);
    }
  }
  if (acc === 'armband' || acc === 'klokke') {
    for (const s of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 16), glow('#3ecbff', 1.2));
      band.rotation.z = Math.PI / 2;
      band.position.set(s * 0.55, 1.15, 0);
      gear.add(band);
    }
  }
  if (acc === 'glorie') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 28), glow('#ffe066', 1.6));
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 2.15, 0);
    gear.add(halo);
  }

  // chest tech stripe for hoodie/tech looks
  if (!skirtLike && (a.print === 'lyn' || a.print === 'stjerne' || acc.startsWith('sekk') || acc.includes('vinger'))) {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.04), glow('#3ecbff', 1.3));
    chest.position.set(0, 1.35, 0.28);
    gear.add(chest);
  }

  root.add(gear);
}

export async function attachGltfAvatar(rig: AvatarRig, a: Avatar): Promise<void> {
  try {
    const model = await loadModel(pickPath(a));
    model.scale.setScalar(1.35);
    model.position.set(0, 0, 0);
    model.userData.camIgnore = true;
    tintMeshes(model, a);
    attachFuturisticGear(model, a);
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
