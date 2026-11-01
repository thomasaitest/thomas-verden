import type { Avatar } from '../logic/avatar.ts';
import { cleanCode, generateCode, isValidCode } from './codes.ts';
import { filterName } from './names.ts';
import {
  STATE_HZ,
  type ClientMsg,
  type EmoteId,
  type MountWire,
  type PetWire,
  type PlaceWire,
  type PlayerSnapshot,
  type AvatarPoseWire,
  type ServerMsg,
  normalizeSnapshot,
} from './protocol.ts';
import { defaultMpUrl, type MpTransport, type TransportStatus } from './transport.ts';
import { WsTransport } from './wsTransport.ts';
import { pushSample, sampleAt, type InterpState } from './interp.ts';

export interface RemoteView {
  id: string;
  name: string;
  avatar: Avatar;
  interp: InterpState;
  pose: AvatarPoseWire;
  place: PlaceWire;
  area: string | null;
  pet: PetWire | null;
  equip: string | null;
  mount: MountWire;
  houseStyle: import('../logic/catalog.ts').HouseStyle | null;
  house: import('../logic/houseWire.ts').HouseWire | null;
  plot: number | null;
  vehicle: string | null;
  emote: EmoteId | null;
  emoteUntil: number;
}

export interface SessionHooks {
  onRemotes(): void;
  onStatus(status: TransportStatus, detail?: string): void;
  onRoom(code: string | null, youName: string | null): void;
  onError(message: string): void;
  onEmote?(id: string, emote: EmoteId): void;
  onAvatar?(id: string): void;
  onVisitAsk?(from: string, fromName: string, fromPlayerId: string): void;
  onVisitReply?(from: string, ok: boolean, house?: import('../logic/houseWire.ts').HouseWire): void;
  onHouse?(id: string, house: import('../logic/houseWire.ts').HouseWire): void;
  onLeft?(id: string): void;
  onActivity?(id: string, kind: import('../logic/activity.ts').ActivityKind): void;
}

export class MpSession {
  transport: MpTransport;
  remotes = new Map<string, RemoteView>();
  youId: string | null = null;
  code: string | null = null;
  youName: string | null = null;
  private lastSend = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wantUrl: string | null = null;
  private hello: { name: string; avatar: Avatar; playerId: string; house?: import('../logic/houseWire.ts').HouseWire } | null = null;
  /** Set before create/join so hello carries the player's house into the room. */
  pendingHouse: import('../logic/houseWire.ts').HouseWire | null = null;
  private intentionalClose = false;

  constructor(
    private hooks: SessionHooks,
    transport?: MpTransport,
  ) {
    this.transport = transport ?? new WsTransport();
    this.transport.onMessage = (m) => this.onServer(m);
    this.transport.onStatus = (s, d) => this.onTransportStatus(s, d);
  }

  get active(): boolean {
    return !!this.code && this.transport.status === 'open';
  }

  createRoom(name: string, avatar: Avatar, playerId: string): string | null {
    const n = filterName(name);
    if (!n) return null;
    const code = generateCode();
    this.joinRoom(code, n, avatar, playerId);
    return code;
  }

  joinRoom(rawCode: string, name: string, avatar: Avatar, playerId: string): boolean {
    const code = cleanCode(rawCode);
    const n = filterName(name);
    if (!isValidCode(code) || !n) return false;
    this.intentionalClose = false;
    this.hello = { name: n, avatar, playerId, ...(this.pendingHouse ? { house: this.pendingHouse } : {}) };
    this.code = code;
    this.youName = n;
    this.remotes.clear();
    this.wantUrl = `${defaultMpUrl()}/room/${code}`;
    this.transport.connect(this.wantUrl);
    this.hooks.onRoom(code, n);
    return true;
  }

  leave() {
    this.intentionalClose = true;
    this.clearReconnect();
    this.transport.close();
    this.code = null;
    this.youId = null;
    this.youName = null;
    this.hello = null;
    this.wantUrl = null;
    this.remotes.clear();
    this.hooks.onRoom(null, null);
    this.hooks.onRemotes();
  }

  sendState(s: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pose: AvatarPoseWire;
    speed: number;
    place: PlaceWire;
    area?: string | null;
    pet: PetWire | null;
    equip: string | null;
    mount?: MountWire;
    houseStyle?: import('../logic/catalog.ts').HouseStyle | null;
    vehicle?: string | null;
  }, now = performance.now()): void {
    if (!this.active) return;
    const minGap = 1000 / STATE_HZ;
    if (now - this.lastSend < minGap) return;
    this.lastSend = now;
    const msg: ClientMsg = { t: 'state', ...s };
    this.transport.send(msg);
  }

  /** Push a live avatar/outfit change so others rebuild the remote figure. */
  sendAvatar(avatar: Avatar): void {
    if (!this.active) return;
    if (this.hello) this.hello = { ...this.hello, avatar };
    this.transport.send({ t: 'avatar', avatar });
  }

  sendEmote(id: EmoteId): void {
    if (!this.active) return;
    this.transport.send({ t: 'emote', id });
  }

  sendHouse(house: import('../logic/houseWire.ts').HouseWire): void {
    if (!this.active) return;
    this.transport.send({ t: 'house', house });
  }

  sendVisitAsk(to: string): void {
    if (!this.active) return;
    this.transport.send({ t: 'visit-ask', to });
  }

  sendVisitReply(to: string, ok: boolean, house?: import('../logic/houseWire.ts').HouseWire): void {
    if (!this.active) return;
    this.transport.send({ t: 'visit-reply', to, ok, ...(house ? { house } : {}) });
  }

  sendActivity(kind: import('../logic/activity.ts').ActivityKind): void {
    if (!this.active) return;
    this.transport.send({ t: 'activity', kind });
  }

  tickRemotes(now = performance.now()): Iterable<RemoteView & { x: number; y: number; z: number; yaw: number; speed: number }> {
    const out: (RemoteView & { x: number; y: number; z: number; yaw: number; speed: number })[] = [];
    for (const r of this.remotes.values()) {
      const s = sampleAt(r.interp, now);
      if (r.emote && now > r.emoteUntil) {
        r.emote = null;
      }
      out.push({ ...r, x: s.x, y: s.y, z: s.z, yaw: s.yaw, speed: s.speed });
    }
    return out;
  }

  private onTransportStatus(s: TransportStatus, detail?: string) {
    this.hooks.onStatus(s, detail);
    if (s === 'open' && this.hello) {
      this.transport.send({
        t: 'hello',
        v: 1,
        name: this.hello.name,
        avatar: this.hello.avatar,
        playerId: this.hello.playerId,
        ...(this.hello.house ? { house: this.hello.house } : {}),
      });
    }
    if ((s === 'closed' || s === 'error') && this.wantUrl && this.hello && !this.intentionalClose) {
      this.scheduleReconnect();
    }
    if (s === 'error' && detail) this.hooks.onError(detail);
  }

  private scheduleReconnect() {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      if (this.wantUrl && this.hello && !this.intentionalClose) {
        this.transport.connect(this.wantUrl);
      }
    }, 2000);
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private onServer(msg: ServerMsg) {
    if (msg.t === 'welcome') {
      this.youId = msg.you;
      this.code = msg.code;
      this.remotes.clear();
      for (const p of msg.players) this.upsertRemote(p);
      this.hooks.onRoom(msg.code, this.youName);
      this.hooks.onRemotes();
      // Re-send our house so peers that were already here get furniture (and we confirm plot).
      if (this.pendingHouse) this.transport.send({ t: 'house', house: this.pendingHouse });
      return;
    }
    if (msg.t === 'joined') {
      this.upsertRemote(msg.player);
      this.hooks.onRemotes();
      return;
    }
    if (msg.t === 'left') {
      this.remotes.delete(msg.id);
      this.hooks.onLeft?.(msg.id);
      this.hooks.onRemotes();
      return;
    }
    if (msg.t === 'state') {
      const r = this.remotes.get(msg.id);
      if (!r) return;
      r.interp = pushSample(r.interp, {
        x: msg.x,
        y: msg.y,
        z: msg.z,
        yaw: msg.yaw,
        speed: msg.speed,
        pose: msg.pose,
        place: msg.place,
        equip: msg.equip,
      });
      r.pose = msg.pose;
      r.place = msg.place;
      r.area = msg.area ?? null;
      r.pet = msg.pet;
      r.equip = msg.equip;
      r.mount = msg.mount ?? 'none';
      r.houseStyle = msg.houseStyle ?? r.houseStyle ?? null;
      r.vehicle = msg.vehicle ?? null;
      return;
    }
    if (msg.t === 'house') {
      const r = this.remotes.get(msg.id);
      if (r) {
        r.houseStyle = msg.house.style;
        r.house = msg.house;
      }
      this.hooks.onHouse?.(msg.id, msg.house);
      return;
    }
    if (msg.t === 'visit-ask') {
      this.hooks.onVisitAsk?.(msg.from, msg.fromName, msg.fromPlayerId);
      return;
    }
    if (msg.t === 'visit-reply') {
      this.hooks.onVisitReply?.(msg.from, msg.ok, msg.house);
      return;
    }
    if (msg.t === 'activity') {
      this.hooks.onActivity?.(msg.id, msg.kind);
      return;
    }
    if (msg.t === 'avatar') {
      const r = this.remotes.get(msg.id);
      if (r) {
        r.avatar = msg.avatar;
        this.hooks.onAvatar?.(msg.id);
        this.hooks.onRemotes();
      }
      return;
    }
    if (msg.t === 'emote') {
      const r = this.remotes.get(msg.id);
      if (r) {
        r.emote = msg.emote;
        r.emoteUntil = performance.now() + 3000;
      }
      this.hooks.onEmote?.(msg.id, msg.emote);
      return;
    }
    if (msg.t === 'error') {
      this.hooks.onError(msg.message);
      if (msg.code === 'full' || msg.code === 'name' || msg.code === 'version') {
        this.leave();
      }
    }
  }

  private upsertRemote(p: PlayerSnapshot | (Partial<PlayerSnapshot> & { id: string; name: string; avatar: Avatar })) {
    const snap = normalizeSnapshot(p);
    const existing = this.remotes.get(snap.id);
    const interp = pushSample(existing?.interp ?? null, {
      x: snap.x,
      y: snap.y,
      z: snap.z,
      yaw: snap.yaw,
      speed: snap.speed,
      pose: snap.pose,
      place: snap.place,
      equip: snap.equip,
    });
    this.remotes.set(snap.id, {
      id: snap.id,
      name: snap.name,
      avatar: snap.avatar,
      interp,
      pose: snap.pose,
      place: snap.place,
      area: snap.area,
      pet: snap.pet,
      equip: snap.equip,
      mount: snap.mount,
      houseStyle: snap.houseStyle ?? snap.house?.style ?? existing?.houseStyle ?? null,
      house: snap.house ?? existing?.house ?? null,
      plot: snap.plot ?? existing?.plot ?? null,
      vehicle: snap.vehicle ?? null,
      emote: snap.emote,
      emoteUntil: snap.emoteUntil,
    });
    if (snap.house) this.hooks.onHouse?.(snap.id, snap.house);
  }
}
