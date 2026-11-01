import * as THREE from 'three';
import { SPECIES_BY_ID } from '../logic/pets.ts';
import { sameVisibility } from '../logic/collision.ts';
import { animateAvatar, buildAvatar, type AvatarPose, type AvatarRig } from '../three/avatarModel.ts';
import { animatePet, buildPet, type PetRig } from '../three/petModel.ts';
import { blobShadow } from '../three/kit.ts';
import { buildCar, buildPram, CAR_SEAT_Y, PRAM_PULL_BACK } from '../three/vehicles.ts';
import { EMOTE_BY_ID, type EmoteId, type MountWire, type PlaceWire } from './protocol.ts';
import type { MpSession } from './session.ts';

interface RemoteActor {
  id: string;
  avatarKey: string;
  avatar: AvatarRig;
  holder: THREE.Group;
  shadow: THREE.Mesh;
  nameSpr: THREE.Sprite;
  bubble: THREE.Sprite;
  pet: { key: string; rig: PetRig; shadow: THREE.Mesh } | null;
  vehicleKey: string | null;
  vehicle: THREE.Group | null;
  label: string;
}

function avatarKey(a: { skin: string; hair: string; hairColor: string; face: string; shirt: string; print: string; pants: string; bottom: string; shoes: string; shoeStyle: string; hat: string; accessory: string }): string {
  return JSON.stringify(a);
}

import { ridePetScale, rideSeatOffset } from './ride.ts';
export { ridePetScale, rideSeatOffset };

export function remoteVisible(localPlace: PlaceWire, localArea: string | null, remotePlace: PlaceWire, remoteArea: string | null): boolean {
  return sameVisibility(localPlace, localArea, remotePlace, remoteArea);
}

function makeTextSprite(text: string, opts: { font?: number; bg?: string; pad?: number } = {}): THREE.Sprite {
  const font = opts.font ?? 42;
  const pad = opts.pad ?? 16;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `700 ${font}px Fredoka, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = font + pad * 2;
  c.width = w;
  c.height = h;
  ctx.font = `700 ${font}px Fredoka, sans-serif`;
  ctx.fillStyle = opts.bg ?? 'rgba(255,255,255,0.92)';
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a3b5c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(w / 64, h / 64, 1);
  spr.renderOrder = 20;
  return spr;
}

function makeEmoteSprite(emote: EmoteId): THREE.Sprite {
  const def = EMOTE_BY_ID[emote];
  const text = def ? `${def.emoji}` : '👋';
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#c9b8d8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 56, 48, 0, Math.PI * 2);
  ctx.moveTo(52, 100);
  ctx.lineTo(64, 124);
  ctx.lineTo(76, 100);
  ctx.fill();
  ctx.stroke();
  ctx.font = '56px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(1.6, 1.6, 1);
  spr.renderOrder = 21;
  return spr;
}

export class RemotePlayers {
  private actors = new Map<string, RemoteActor>();
  private emoteCache = new Map<string, THREE.Sprite>();

  constructor(private scene: THREE.Scene) {}

  sync(
    session: MpSession,
    now: number,
    seatWorld: ((id: string, u: number) => { x: number; y: number; z: number; yaw: number; pitch?: number } | null) | null,
    localPlace: PlaceWire = 'town',
    localArea: string | null = null,
  ) {
    const live = new Set<string>();
    for (const r of session.tickRemotes(now)) {
      live.add(r.id);
      const hidden = !remoteVisible(localPlace, localArea, r.place, r.area);
      let actor = this.actors.get(r.id);
      const key = avatarKey(r.avatar);
      if (!actor) {
        const holder = new THREE.Group();
        holder.rotation.order = 'YXZ';
        const avatar = buildAvatar(r.avatar);
        holder.add(avatar.root);
        const shadow = blobShadow(1.8);
        const nameSpr = makeTextSprite(r.name);
        const bubble = makeEmoteSprite('hei');
        bubble.visible = false;
        this.scene.add(holder, shadow, nameSpr, bubble);
        actor = { id: r.id, avatarKey: key, avatar, holder, shadow, nameSpr, bubble, pet: null, vehicleKey: null, vehicle: null, label: r.name };
        this.actors.set(r.id, actor);
      } else if (actor.avatarKey !== key) {
        actor.holder.clear();
        actor.avatar = buildAvatar(r.avatar);
        actor.holder.add(actor.avatar.root);
        actor.avatarKey = key;
      }
      if (actor.label !== r.name) {
        this.scene.remove(actor.nameSpr);
        actor.nameSpr.material.map?.dispose();
        (actor.nameSpr.material as THREE.SpriteMaterial).dispose();
        actor.nameSpr = makeTextSprite(r.name);
        this.scene.add(actor.nameSpr);
        actor.label = r.name;
      }

      let x = r.x;
      let y = r.y;
      let z = r.z;
      let yaw = r.yaw;
      let pose = r.pose as AvatarPose;
      if (r.equip && seatWorld) {
        const seat = seatWorld(r.equip, now / 1000);
        if (seat) {
          x = seat.x;
          y = seat.y;
          z = seat.z;
          yaw = seat.yaw;
        }
      }

      const mount: MountWire = r.mount ?? 'none';
      const riding = mount === 'ride' || mount === 'fly';
      const driving = mount === 'drive';
      const pramming = mount === 'pram';

      actor.holder.visible = !hidden;
      actor.shadow.visible = !hidden && y < 0.5 && !riding;
      actor.nameSpr.visible = !hidden;

      // Pet first so we know seat height when riding
      const petKey = r.pet ? `${r.pet.speciesId}:${r.pet.name}` : '';
      if (!r.pet || hidden) {
        if (actor.pet) {
          this.scene.remove(actor.pet.rig.root, actor.pet.shadow);
          actor.pet = null;
        }
      } else {
        const sp = SPECIES_BY_ID[r.pet.speciesId];
        if (!sp) {
          /* unknown species: skip */
        } else if (!actor.pet || actor.pet.key !== petKey) {
          if (actor.pet) this.scene.remove(actor.pet.rig.root, actor.pet.shadow);
          const rig = buildPet(sp);
          const shadow = blobShadow(1.4);
          this.scene.add(rig.root, shadow);
          actor.pet = { key: petKey, rig, shadow };
        }
        if (actor.pet) {
          const scale = riding ? ridePetScale(1.5) : 1.5;
          actor.pet.rig.root.scale.setScalar(scale);
          if (riding) {
            // Pony under the rider (same world position as the player)
            actor.pet.rig.root.position.set(x, Math.max(0, y - (mount === 'fly' ? 0 : 0)), z);
            actor.pet.rig.root.rotation.y = yaw;
            y += rideSeatOffset(actor.pet.rig.seatY, scale);
            if (pose === 'idle' || pose === 'walk') pose = mount === 'fly' ? 'fly' : 'sit';
          } else if (mount === 'hold') {
            const ang = yaw;
            actor.pet.rig.root.position.set(x + Math.sin(ang) * 0.9, y + 0.8, z + Math.cos(ang) * 0.9);
            actor.pet.rig.root.rotation.y = yaw;
            actor.pet.rig.root.scale.setScalar(1.1);
          } else {
            const ang = yaw + Math.PI - 0.5;
            const px = x + Math.sin(ang) * 2.4;
            const pz = z + Math.cos(ang) * 2.4;
            actor.pet.rig.root.position.set(px, Math.max(0, y - 0.2), pz);
            actor.pet.rig.root.rotation.y = yaw;
          }
          animatePet(actor.pet.rig, now / 1000, r.speed > 0.2 || riding ? 'walk' : 'idle', r.speed);
          actor.pet.shadow.position.set(actor.pet.rig.root.position.x, 0.025, actor.pet.rig.root.position.z);
          actor.pet.shadow.visible = actor.pet.rig.root.position.y < 0.5 && mount !== 'hold';
        }
      }

      actor.holder.position.set(x, y, z);
      actor.holder.rotation.y = yaw;
      if (r.equip === 'sklie') actor.holder.rotation.x = -0.35;
      else if (r.equip === 'vippe') actor.holder.rotation.x = 0.15;
      else actor.holder.rotation.x = 0;
      // Vehicle mesh (car / pram) – same models as local player, avatar sits inside the cabin
      const wantVehicle = !hidden && ((driving && r.vehicle) || (pramming && r.vehicle)) ? `${mount}:${r.vehicle}` : null;
      if (wantVehicle !== actor.vehicleKey) {
        if (actor.vehicle) {
          this.scene.remove(actor.vehicle);
          actor.vehicle = null;
        }
        actor.vehicleKey = wantVehicle;
        if (wantVehicle && r.vehicle) {
          actor.vehicle = mount === 'drive' ? buildCar(r.vehicle) : buildPram(r.vehicle);
          this.scene.add(actor.vehicle);
        }
      }
      if (actor.vehicle) {
        if (driving) {
          actor.vehicle.position.set(x, 0, z);
          actor.vehicle.rotation.y = yaw;
          pose = 'drive';
          actor.holder.position.y = CAR_SEAT_Y;
          actor.holder.scale.setScalar(0.72);
          actor.shadow.visible = false;
        } else if (pramming) {
          actor.vehicle.position.set(x - Math.sin(yaw) * PRAM_PULL_BACK, 0, z - Math.cos(yaw) * PRAM_PULL_BACK);
          actor.vehicle.rotation.y = yaw;
          if (pose === 'idle') pose = 'walk';
        }
        actor.vehicle.visible = !hidden;
      } else if (!driving) {
        actor.holder.scale.setScalar(1);
        actor.shadow.visible = !hidden;
      }
      animateAvatar(actor.avatar, now / 1000, pose, r.speed, pose === 'hold' || mount === 'hold');
      actor.shadow.position.set(x, 0.025, z);
      actor.nameSpr.position.set(x, y + (driving ? 2.6 : 3.2), z);

      if (r.emote && !hidden) {
        const cached = this.emoteCache.get(r.emote);
        if (!cached || actor.bubble.userData.emote !== r.emote) {
          this.scene.remove(actor.bubble);
          actor.bubble.material.map?.dispose();
          (actor.bubble.material as THREE.SpriteMaterial).dispose();
          actor.bubble = makeEmoteSprite(r.emote);
          actor.bubble.userData.emote = r.emote;
          this.emoteCache.set(r.emote, actor.bubble);
          this.scene.add(actor.bubble);
        }
        actor.bubble.visible = true;
        actor.bubble.position.set(x, y + 4.2, z);
      } else {
        actor.bubble.visible = false;
      }
    }

    for (const [id, a] of this.actors) {
      if (live.has(id)) continue;
      this.scene.remove(a.holder, a.shadow, a.nameSpr, a.bubble);
      if (a.pet) this.scene.remove(a.pet.rig.root, a.pet.shadow);
      if (a.vehicle) this.scene.remove(a.vehicle);
      this.actors.delete(id);
    }
  }

  clear() {
    for (const a of this.actors.values()) {
      this.scene.remove(a.holder, a.shadow, a.nameSpr, a.bubble);
      if (a.pet) this.scene.remove(a.pet.rig.root, a.pet.shadow);
      if (a.vehicle) this.scene.remove(a.vehicle);
    }
    this.actors.clear();
  }
}
