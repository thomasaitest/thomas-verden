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
  // Quaternius modular packs often name meshes CubeNNN — tint by name, original
  // albedo heuristic, then height bands. Skin must never get tech metalness/emissive.
  root.updateWorldMatrix(true, true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) meshes.push(m);
  });
  const rootBox = new THREE.Box3().setFromObject(root);
  const y0 = rootBox.min.y;
  const y1 = rootBox.max.y;
  const span = Math.max(0.01, y1 - y0);
  // Lift peach slightly so HDRI + N8AO don't crush faces to mud
  const skinHex = a.skin || '#f0c7a0';
  const skinCol = new THREE.Color(skinHex);
  skinCol.r = Math.min(1, skinCol.r * 1.08 + 0.04);
  skinCol.g = Math.min(1, skinCol.g * 1.05 + 0.03);
  skinCol.b = Math.min(1, skinCol.b * 1.02 + 0.02);

  const looksLikeSkin = (mat: THREE.MeshStandardMaterial) => {
    const c = mat.color;
    if (!c) return false;
    // Quaternius skin albedos are warm peach/tan, low saturation blue channel
    return c.r > 0.45 && c.g > 0.28 && c.b > 0.18 && c.r >= c.b + 0.05 && c.r >= c.g - 0.05 && (c.r + c.g + c.b) / 3 > 0.35;
  };

  for (const m of meshes) {
    const box = new THREE.Box3().setFromObject(m);
    const midY = (box.min.y + box.max.y) * 0.5;
    const band = (midY - y0) / span; // 0 feet .. 1 head
    const name = `${(m.material as THREE.Material)?.name || ''} ${m.name || ''}`.toLowerCase();
    const srcMat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    let kind: 'hair' | 'skin' | 'shoes' | 'pants' | 'shirt' = 'shirt';
    if (/hair|ponytail|bun/.test(name)) kind = 'hair';
    else if (/skin|face|arm|hand|head|neck|leg_skin|body_skin/.test(name)) kind = 'skin';
    else if (srcMat?.isMeshStandardMaterial && looksLikeSkin(srcMat) && !/cloth|shirt|pant|shoe|boot|hat/.test(name)) kind = 'skin';
    else if (/shoe|boot|sneaker|foot/.test(name)) kind = 'shoes';
    else if (/pant|leg|bottom|jean|trouser|skirt/.test(name)) kind = 'pants';
    else if (/shirt|top|hoodie|jacket|cloth|suit/.test(name)) kind = 'shirt';
    else if (band > 0.9) kind = 'hair';
    else if (band > 0.78) kind = 'skin'; // head/neck band only — narrow
    else if (band < 0.1) kind = 'shoes';
    else if (band < 0.38) kind = 'pants';
    else kind = 'shirt';

    const hex =
      kind === 'hair' ? a.hairColor : kind === 'skin' ? skinHex : kind === 'shoes' ? a.shoes : kind === 'pants' ? a.pants : a.shirt;
    const techClothes = kind === 'shirt' || kind === 'pants';
    const techLook =
      techClothes &&
      (/skjort|kjole|tutu|plissert|ballkjole|miniskjort|langtskort/.test(a.bottom || '') ||
        a.accessory.includes('vinger') ||
        a.accessory.startsWith('sekk') ||
        a.print === 'lyn');

    const apply = (mat: THREE.Material) => {
      const std = (mat as THREE.MeshStandardMaterial).clone();
      if (!std?.color) return mat;
      if (kind === 'skin') {
        // Soft studio skin: lift albedo, keep a gentle normal if present, drop crushing AO
        std.map = null;
        std.roughnessMap = null;
        std.metalnessMap = null;
        std.aoMap = null;
        if (std.normalMap) {
          std.normalScale = new THREE.Vector2(0.35, 0.35); // less angular Quaternius faceting
        }
        std.color = skinCol.clone();
        std.emissive = new THREE.Color('#4a2e1c');
        std.emissiveIntensity = 0.1; // soft fill vs N8AO crush
        std.roughness = 0.52;
        std.metalness = 0.0;
        std.envMapIntensity = 0.85;
      } else {
        std.color = new THREE.Color(hex);
        std.emissive = new THREE.Color('#000000');
        std.emissiveIntensity = 0;
        if (kind === 'hair') {
          std.roughness = 0.55;
          std.metalness = 0.04;
          std.envMapIntensity = 0.65;
          std.emissive = new THREE.Color(hex).multiplyScalar(0.15);
          std.emissiveIntensity = 0.12;
        } else if (techLook && kind === 'shirt') {
          std.roughness = 0.4;
          std.metalness = 0.22;
          std.envMapIntensity = 1.05;
        } else if (techLook && kind === 'pants') {
          std.roughness = 0.38;
          std.metalness = 0.2;
          std.envMapIntensity = 0.95;
        } else {
          std.roughness = Math.min(0.82, (std.roughness ?? 0.7) + 0.02);
          std.metalness = Math.min(0.12, std.metalness ?? 0);
          std.envMapIntensity = 0.8;
        }
      }
      std.needsUpdate = true;
      return std;
    };
    if (Array.isArray(m.material)) m.material = m.material.map(apply);
    else m.material = apply(m.material);
  }
}


/** Extra hair shell for volume — soft duplicate of hair meshes, slightly larger. */
function addHairVolume(root: THREE.Object3D, a: Avatar) {
  if (!a.hair || a.hair === 'ingen') return;
  const shells: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = `${(m.material as THREE.Material)?.name || ''} ${m.name || ''}`.toLowerCase();
    if (!/hair|ponytail|bun|bangs/.test(name)) return;
    const shell = m.clone();
    shell.scale.multiplyScalar(1.1);
    shell.position.y += 0.012;
    const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    const mat = src.clone();
    mat.transparent = true;
    mat.opacity = 0.4;
    mat.depthWrite = false;
    mat.roughness = 0.72;
    mat.color = new THREE.Color(a.hairColor);
    shell.material = mat;
    shells.push(shell);
  });
  for (const s of shells) root.add(s);
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
    // Slim tech pack — old box+strips read as a giant black slab from shoulder cam
    const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 6, 12), metal('#2a3344'));
    pack.position.set(0, 1.42, -0.32);
    gear.add(pack);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.04), metal('#1a2230'));
    plate.position.set(0, 1.42, -0.42);
    gear.add(plate);
    for (const y of [1.52, 1.38, 1.24]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.02), glow('#3ecbff', 1.2));
      strip.position.set(0, y, -0.45);
      gear.add(strip);
    }
  }

  if (acc.includes('vinger')) {
    const wingCol = acc.includes('regnbue') ? '#7ef0ff' : acc.includes('engel') ? '#fff4e0' : '#e0b8ff';
    // Translucent emissive planes with gradient + subtle flutter (tickGltfAvatar)
    const wingTex = (() => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 20, 220, 240);
      g.addColorStop(0, wingCol);
      g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(20, 128);
      ctx.quadraticCurveTo(80, 20, 240, 40);
      ctx.quadraticCurveTo(200, 128, 240, 220);
      ctx.quadraticCurveTo(80, 236, 20, 128);
      ctx.closePath();
      ctx.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const wingMat = new THREE.MeshBasicMaterial({
      map: wingTex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });
    const wingHold = new THREE.Group();
    wingHold.name = 'lightWings';
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.35), wingMat.clone());
      wing.position.set(s * 0.42, 1.5, -0.28);
      wing.rotation.y = s * 0.85;
      wing.rotation.z = s * 0.18;
      wing.rotation.x = -0.12;
      wing.userData.wingSide = s;
      wingHold.add(wing);
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.85, 0.03),
        new THREE.MeshBasicMaterial({ color: wingCol, toneMapped: false }),
      );
      rib.position.set(s * 0.28, 1.48, -0.26);
      rib.rotation.z = s * 0.28;
      wingHold.add(rib);
    }
    gear.add(wingHold);
  }

  // Suit edge accents — emissive lines selective bloom picks up (tech / neon looks)
  const wantEdges =
    a.print === 'lyn' ||
    a.print === 'stjerne' ||
    acc.startsWith('sekk') ||
    acc.includes('vinger') ||
    skirtLike ||
    a.hat === 'hjelm';
  if (wantEdges) {
    // Thin collar + zipper pip only — long side bars floated off Quaternius proportions
    const edgeCol = '#3ecbff';
    const edge = new THREE.MeshBasicMaterial({ color: edgeCol, toneMapped: false });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.01, 6, 24), edge);
    collar.rotation.x = Math.PI / 2.4;
    collar.position.set(0, 1.52, 0.08);
    gear.add(collar);
    // Center zipper glow line on torso
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.42, 0.014), edge);
    zip.position.set(0, 1.28, 0.2);
    gear.add(zip);
    // Shoulder pips
    for (const s of [-1, 1]) {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), edge);
      pip.position.set(s * 0.28, 1.5, 0.05);
      gear.add(pip);
    }
  }

  // jewellery only when selected (avoid glowing bead wash on every tech look)
  if (acc === 'halskjede' || acc === 'perlekjede') {
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
  if (acc === 'oreringer' || acc === 'glorie') {
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

  // Subtle collar LED pip only — flat cyan chest bar read as a name-tag clipping the torso
  if (!skirtLike && (a.print === 'lyn' || a.print === 'stjerne' || acc.startsWith('sekk') || acc.includes('vinger'))) {
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), glow('#3ecbff', 1.1));
    pip.position.set(0, 1.48, 0.22);
    gear.add(pip);
  }

  gear.scale.setScalar(0.95);
  root.add(gear);
}



/** Standalone Quaternius preview root for outfit thumbnails (offscreen Thumbs). */
export async function buildAvatarPreviewRoot(a: Avatar): Promise<THREE.Group> {
  const root = new THREE.Group();
  const model = await loadModel(pickPath(a));
  model.scale.setScalar(1.35);
  model.position.set(0, 0, 0);
  tintMeshes(model, a);
  addHairVolume(model, a);
  attachFuturisticGear(model, a);
  root.add(model);
  return root;
}

export async function attachGltfAvatar(rig: AvatarRig, a: Avatar): Promise<void> {
  try {
    const model = await loadModel(pickPath(a));
    model.scale.setScalar(1.35);
    model.position.set(0, 0, 0);
    model.userData.camIgnore = true;
    tintMeshes(model, a);
    addHairVolume(model, a);
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
  // animateAvatar early-outs for gltf — apply seated drop so driver sits UNDER canopy
  if (pose === 'drive') {
    rig.body.position.set(0, -0.85, 0.05);
    rig.body.rotation.x = 0.18;
  } else if (pose === 'sit') {
    rig.body.position.set(0, -0.28, -0.05);
    rig.body.rotation.x = -0.05;
  } else if (pose === 'sleep') {
    /* keep */
  } else {
    rig.body.position.set(0, 0, 0);
    rig.body.rotation.x = 0;
  }
  ext.mixer.update(dt);
  // Subtle wing flutter
  const wings = rig.body.getObjectByName('lightWings') as THREE.Group | undefined;
  if (wings) {
    const t = performance.now() * 0.001;
    wings.children.forEach((ch) => {
      const side = (ch.userData.wingSide as number) || 0;
      if (!side) return;
      ch.rotation.z = side * (0.18 + Math.sin(t * 3.2) * 0.08);
      ch.rotation.y = side * (0.85 + Math.sin(t * 2.4 + side) * 0.06);
    });
  }
  return true;
}

export const AVATAR_PREFETCH = Object.values(CHAR_PATHS);
