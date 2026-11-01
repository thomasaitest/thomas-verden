import type * as THREE from 'three';
import type { Avatar } from '../logic/avatar.ts';
import { isRemotePlot } from '../logic/visitDoor.ts';
import type { HouseStyle } from '../logic/catalog.ts';
import type { ActivityKind } from '../logic/activity.ts';
import type { HouseWire } from '../logic/houseWire.ts';
import { SPECIES_BY_ID } from '../logic/pets.ts';
import type { PetState } from '../logic/needs.ts';
import { toast } from '../ui/dom.ts';
import type { AvatarPoseWire, MountWire, PlaceWire, PetWire } from './protocol.ts';
import { RemotePlayers } from './remotes.ts';
import { MpSession } from './session.ts';
import { openEmotePicker, openMpSheet } from './ui.ts';

/** Minimal game surface needed by multiplayer (avoids circular imports). */
export interface MpHost {
  scene: THREE.Scene;
  save: { avatar: Avatar; playerId: string; houses?: { style: HouseStyle }[]; activeHouseId?: string };
  player: { pos: THREE.Vector3; yaw: number; speed: number };
  mode: 'town' | 'house';
  using: { id: string } | null;
  riding: string | null;
  holding: string | null;
  flying: boolean;
  driving: string | null;
  pramming: string | null;
  visitingOwnerId: string | null;
  town: {
    insideBuilding(x: number, z: number): 'shop' | 'vet' | 'cars' | 'pets' | null;
    seatWorld(id: string, u: number): { x: number; y: number; z: number; yaw: number };
    housePlots: { x: number; z: number; rot: number }[];
    setPlotHouse(plot: number, style: HouseStyle | null, label?: string, locked?: boolean): void;
  };
  mainPet(): PetState | null;
  activeHouseStyle(): HouseStyle;
  onVisitAsk(from: string, fromName: string, fromPlayerId: string): void;
  onVisitReply(from: string, ok: boolean, house?: HouseWire): void;
  onRemoteHouse(id: string, house: HouseWire): void;
  onRemoteLeft?(id: string): void;
  onRemoteActivity(id: string, kind: ActivityKind): void;
  /** Local player's house (style + furniture) for the room. */
  getHouseWire(): HouseWire;
}

export class MpClient {
  session: MpSession;
  remotes: RemotePlayers;
  private lastHouseSent = '';

  constructor(private game: MpHost) {
    this.remotes = new RemotePlayers(game.scene);
    this.session = new MpSession({
      onRemotes: () => this.updateBadge(),
      onStatus: (s, detail) => {
        this.updateBadge();
        if (s === 'error' && detail) toast(detail, 'bad');
        if (s === 'open' && this.session.code) toast(`Koblet til rom ${this.session.code}`, 'ok');
      },
      onRoom: () => this.updateBadge(),
      onError: (message) => toast(message, 'bad'),
      onAvatar: () => this.updateBadge(),
      onVisitAsk: (from, fromName, fromPlayerId) => this.game.onVisitAsk(from, fromName, fromPlayerId),
      onVisitReply: (from, ok, house) => this.game.onVisitReply(from, ok, house),
      onHouse: (id, house) => this.game.onRemoteHouse(id, house),
      onLeft: (id) => this.game.onRemoteLeft?.(id),
      onActivity: (id, kind) => this.game.onRemoteActivity(id, kind),
    });
  }

  openMenu() {
    // Carry our house + furniture into the room so peers can place it on a free plot.
    this.session.pendingHouse = this.game.getHouseWire();
    openMpSheet(
      this.session,
      () => this.game.save.avatar,
      () => this.game.save.playerId,
      () => this.updateBadge(),
    );
  }

  openEmotes() {
    openEmotePicker(this.session);
  }

  leave() {
    this.session.leave();
    this.remotes.clear();
    this.clearAllRemotePlots();
    this.updateBadge();
  }

  /** Call after the local player changes outfit mid-session. */
  broadcastAvatar(avatar: Avatar) {
    this.session.sendAvatar(avatar);
  }

  broadcastHouse(house: HouseWire) {
    const key = JSON.stringify(house);
    if (key === this.lastHouseSent) return;
    this.lastHouseSent = key;
    this.session.sendHouse(house);
  }

  askVisit(toSocketOrPlayerId: string) {
    this.session.sendVisitAsk(toSocketOrPlayerId);
  }

  replyVisit(to: string, ok: boolean, house?: HouseWire) {
    this.session.sendVisitReply(to, ok, house);
  }

  startActivity(kind: ActivityKind) {
    this.session.sendActivity(kind);
  }

  tick(pose: AvatarPoseWire) {
    const g = this.game;
    const now = performance.now();
    const place = this.currentPlace();
    const area =
      place === 'house'
        ? g.visitingOwnerId ?? g.save.playerId
        : null;

    if (this.session.active) {
      this.session.sendState(
        {
          x: g.player.pos.x,
          y: g.player.pos.y,
          z: g.player.pos.z,
          yaw: g.player.yaw,
          pose,
          speed: g.player.speed,
          place,
          area,
          pet: this.petWire(),
          equip: g.using?.id ?? null,
          mount: this.currentMount(),
          houseStyle: g.activeHouseStyle(),
          vehicle: g.driving ?? g.pramming ?? null,
        },
        now,
      );
    }

    this.remotes.sync(
      this.session,
      now,
      (id, u) => {
        try {
          return g.town.seatWorld(id, u);
        } catch {
          return null;
        }
      },
      place,
      area,
    );
    this.syncHousePlots();
  }

  /**
   * Place each remote player's house on their assigned plot (never plot 0 = local home).
   * Uses server-assigned `plot` so hosts and joiners never share a plot; free plots clear on leave.
   */
  private syncHousePlots() {
    const plots = this.game.town.housePlots;
    if (!plots?.length) return;
    const used = new Set<number>();
    for (const r of this.session.remotes.values()) {
      const plot = isRemotePlot(r.plot, plots.length) ? r.plot : null;
      if (!plot) continue;
      used.add(plot);
      const style = r.house?.style ?? r.houseStyle;
      if (style) this.game.town.setPlotHouse(plot, style, r.name, !!r.house?.locked);
    }
    for (let i = 1; i < plots.length; i++) {
      if (!used.has(i)) this.game.town.setPlotHouse(i, null);
    }
  }

  private clearAllRemotePlots() {
    const plots = this.game.town.housePlots;
    if (!plots?.length) return;
    for (let i = 1; i < plots.length; i++) this.game.town.setPlotHouse(i, null);
  }

  private currentPlace(): PlaceWire {
    if (this.game.mode === 'house') return 'house';
    const inside = this.game.town.insideBuilding(this.game.player.pos.x, this.game.player.pos.z);
    if (inside) return inside;
    return 'town';
  }

  private currentMount(): MountWire {
    if (this.game.driving) return 'drive';
    if (this.game.pramming) return 'pram';
    if (this.game.flying && this.game.riding) return 'fly';
    if (this.game.riding) return 'ride';
    if (this.game.holding) return 'hold';
    return 'none';
  }

  private petWire(): PetWire | null {
    const pet = this.game.mainPet();
    if (!pet || !SPECIES_BY_ID[pet.speciesId]) return null;
    return { speciesId: pet.speciesId, name: pet.name };
  }

  private updateBadge() {
    const btn = document.querySelector('.dock-btn.mp') as HTMLElement | null;
    if (!btn) return;
    const on = !!this.session.code;
    btn.classList.toggle('on', on);
    const b = btn.querySelector('b');
    if (b) b.textContent = on ? (this.session.code ?? 'Rom') : 'Sammen';
  }
}
