/** Shared multiplayer wire protocol (client + server). Keep messages small and typed. */

import type { Avatar } from '../logic/avatar.ts';
import { cleanAvatar } from '../logic/avatar.ts';
import type { ActivityKind } from '../logic/activity.ts';
import type { HouseStyle } from '../logic/catalog.ts';
import { parseHouseStyle, parseHouseWire, type HouseWire } from '../logic/houseWire.ts';

export const MP_VERSION = 1;
export const MAX_PLAYERS = 8;
export const STATE_HZ = 10;
export const MAX_MSG_BYTES = 16384;
/** Max client→server messages per second per socket (state + emotes). */
export const MAX_MSG_PER_SEC = 20;

export const EMOTES = [
  { id: 'hei', emoji: '👋', label: 'Hei!' },
  { id: 'glad', emoji: '😊', label: 'Glad' },
  { id: 'hjerte', emoji: '❤️', label: 'Hjerte' },
  { id: 'lo', emoji: '😂', label: 'Haha' },
  { id: 'tommel', emoji: '👍', label: 'Tommel opp' },
  { id: 'klapp', emoji: '👏', label: 'Klapp' },
  { id: 'dans', emoji: '💃', label: 'Dans' },
  { id: 'wow', emoji: '🤩', label: 'Wow' },
] as const;
export type EmoteId = (typeof EMOTES)[number]['id'];
export const EMOTE_BY_ID: Record<string, (typeof EMOTES)[number]> = Object.fromEntries(EMOTES.map((e) => [e.id, e]));

export type AvatarPoseWire =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'sit'
  | 'sleep'
  | 'hold'
  | 'wave'
  | 'fly'
  | 'swing'
  | 'slide'
  | 'seesaw'
  | 'spin'
  | 'dance'
  | 'drive';

/** Where the player is. Newer clients may also send cars/pets; older ones only know the first four. */
export type PlaceWire = 'town' | 'house' | 'shop' | 'vet' | 'cars' | 'pets';

/** How the player is attached to their pet (pony ride etc.). */
export type MountWire = 'none' | 'ride' | 'hold' | 'fly' | 'drive' | 'pram';

export interface PetWire {
  speciesId: string;
  name: string;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  avatar: Avatar;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: AvatarPoseWire;
  speed: number;
  place: PlaceWire;
  /** Whose private house, when place === 'house' (playerId). */
  area: string | null;
  pet: PetWire | null;
  equip: string | null;
  /** Pet mount mode; missing/unknown → none (backward tolerant). */
  mount: MountWire;
  /** Exterior house style shown on the player's neighbourhood plot. */
  houseStyle: HouseStyle | null;
  /** Full house (style + furniture) carried into the room; others place it on `plot`. */
  house: HouseWire | null;
  /** Neighbourhood plot index 1..N for remotes (0 = local home on each client, never assigned). */
  plot: number | null;
  /** Vehicle catalog id when mount is drive/pram. */
  vehicle: string | null;
  emote: EmoteId | null;
  emoteUntil: number;
}

/** Client → server */
export type ClientMsg =
  | { t: 'hello'; v: number; name: string; avatar: Avatar; playerId: string; house?: HouseWire }
  | {
      t: 'state';
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
      houseStyle?: HouseStyle | null;
      vehicle?: string | null;
    }
  | { t: 'avatar'; avatar: Avatar }
  | { t: 'emote'; id: EmoteId }
  | { t: 'house'; house: HouseWire }
  | { t: 'visit-ask'; to: string }
  | { t: 'visit-reply'; to: string; ok: boolean; house?: HouseWire }
  | { t: 'activity'; kind: ActivityKind }
  | { t: 'ping'; n: number };

/** Server → client */
export type ServerMsg =
  | { t: 'welcome'; you: string; code: string; players: PlayerSnapshot[] }
  | { t: 'joined'; player: PlayerSnapshot }
  | { t: 'left'; id: string }
  | {
      t: 'state';
      id: string;
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
      houseStyle?: HouseStyle | null;
      vehicle?: string | null;
    }
  | { t: 'avatar'; id: string; avatar: Avatar }
  | { t: 'emote'; id: string; emote: EmoteId }
  | { t: 'house'; id: string; house: HouseWire }
  | { t: 'visit-ask'; from: string; fromName: string; fromPlayerId: string }
  | { t: 'visit-reply'; from: string; ok: boolean; house?: HouseWire }
  | { t: 'activity'; id: string; kind: ActivityKind }
  | { t: 'pong'; n: number }
  | { t: 'error'; code: string; message: string };

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

export function decodeClient(raw: string): ClientMsg | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseClient(data);
}

export function decodeServer(raw: string): ServerMsg | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseServer(data);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const POSES: AvatarPoseWire[] = ['idle', 'walk', 'jump', 'sit', 'sleep', 'hold', 'wave', 'fly', 'swing', 'slide', 'seesaw', 'spin', 'dance', 'drive'];
const PLACES: PlaceWire[] = ['town', 'house', 'shop', 'vet', 'cars', 'pets'];
const MOUNTS: MountWire[] = ['none', 'ride', 'hold', 'fly', 'drive', 'pram'];
const ACTIVITY_KINDS: ActivityKind[] = ['dance', 'parade'];

function parsePet(v: unknown): PetWire | null {
  if (v === null) return null;
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.speciesId) || o.speciesId.length > 32) return null;
  if (!isStr(o.name) || o.name.length > 24) return null;
  return { speciesId: o.speciesId, name: o.name };
}

function parseMount(v: unknown): MountWire {
  if (isStr(v) && MOUNTS.includes(v as MountWire)) return v as MountWire;
  return 'none';
}

function parseArea(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (!isStr(v) || v.length > 64) return null;
  return v;
}

export function parseClient(data: unknown): ClientMsg | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (o.t === 'hello') {
    if (!isNum(o.v) || o.v !== MP_VERSION) return null;
    if (!isStr(o.name) || !isStr(o.playerId) || o.playerId.length > 64) return null;
    let house: HouseWire | undefined;
    if (o.house !== undefined) {
      const h = parseHouseWire(o.house);
      if (h) house = h;
    }
    return { t: 'hello', v: MP_VERSION, name: o.name, avatar: cleanAvatar(o.avatar), playerId: o.playerId, ...(house ? { house } : {}) };
  }
  if (o.t === 'state') {
    if (!isNum(o.x) || !isNum(o.y) || !isNum(o.z) || !isNum(o.yaw) || !isNum(o.speed)) return null;
    if (!isStr(o.pose) || !POSES.includes(o.pose as AvatarPoseWire)) return null;
    if (!isStr(o.place) || !PLACES.includes(o.place as PlaceWire)) return null;
    if (o.equip !== null && o.equip !== undefined && !isStr(o.equip)) return null;
    const pet = parsePet(o.pet ?? null);
    if (o.pet !== null && o.pet !== undefined && pet === null) return null;
    const clamp = (n: number, lim: number) => Math.max(-lim, Math.min(lim, n));
    return {
      t: 'state',
      x: clamp(o.x, 250),
      y: clamp(o.y, 80),
      z: clamp(o.z, 250),
      yaw: o.yaw,
      pose: o.pose as AvatarPoseWire,
      speed: clamp(o.speed, 30),
      place: o.place as PlaceWire,
      area: parseArea(o.area),
      pet,
      equip: isStr(o.equip) && o.equip.length <= 32 ? o.equip : null,
      mount: parseMount(o.mount),
      houseStyle: parseHouseStyle(o.houseStyle),
      vehicle: isStr(o.vehicle) && o.vehicle.length <= 32 ? o.vehicle : null,
    };
  }
  if (o.t === 'avatar') {
    return { t: 'avatar', avatar: cleanAvatar(o.avatar) };
  }
  if (o.t === 'emote') {
    if (!isStr(o.id) || !EMOTE_BY_ID[o.id]) return null;
    return { t: 'emote', id: o.id as EmoteId };
  }
  if (o.t === 'ping') {
    if (!isNum(o.n)) return null;
    return { t: 'ping', n: o.n };
  }
  if (o.t === 'house') {
    const house = parseHouseWire(o.house);
    if (!house) return null;
    return { t: 'house', house };
  }
  if (o.t === 'visit-ask') {
    if (!isStr(o.to) || o.to.length > 64) return null;
    return { t: 'visit-ask', to: o.to };
  }
  if (o.t === 'visit-reply') {
    if (!isStr(o.to) || o.to.length > 64) return null;
    if (typeof o.ok !== 'boolean') return null;
    let house: HouseWire | undefined;
    if (o.house !== undefined) {
      const h = parseHouseWire(o.house);
      if (!h) return null;
      house = h;
    }
    return { t: 'visit-reply', to: o.to, ok: o.ok, ...(house ? { house } : {}) };
  }
  if (o.t === 'activity') {
    if (!isStr(o.kind) || !ACTIVITY_KINDS.includes(o.kind as ActivityKind)) return null;
    return { t: 'activity', kind: o.kind as ActivityKind };
  }
  return null;
}

export function parseServer(data: unknown): ServerMsg | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (!isStr(o.t)) return null;
  // Server messages are trusted from our own server; light shape check is enough for client.
  return o as unknown as ServerMsg;
}

export function snapshotFromHello(id: string, name: string, avatar: Avatar): PlayerSnapshot {
  return {
    id,
    name,
    avatar: cleanAvatar(avatar),
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pose: 'idle',
    speed: 0,
    place: 'town',
    area: null,
    pet: null,
    equip: null,
    mount: 'none',
    houseStyle: null,
    house: null,
    plot: null,
    vehicle: null,
    emote: null,
    emoteUntil: 0,
  };
}

/** Normalize a snapshot that may come from an older server without area/mount. */
export function normalizeSnapshot(raw: Partial<PlayerSnapshot> & { id: string; name: string; avatar: Avatar }): PlayerSnapshot {
  const base = snapshotFromHello(raw.id, raw.name, raw.avatar);
  return {
    ...base,
    ...raw,
    avatar: cleanAvatar(raw.avatar),
    area: raw.area ?? null,
    mount: parseMount(raw.mount),
    houseStyle: parseHouseStyle(raw.houseStyle),
    house: raw.house ? parseHouseWire(raw.house) : null,
    plot: typeof raw.plot === 'number' && raw.plot >= 1 && raw.plot <= 8 ? (raw.plot | 0) : null,
    vehicle: typeof raw.vehicle === 'string' ? raw.vehicle : null,
    place: (PLACES.includes(raw.place as PlaceWire) ? raw.place : 'town') as PlaceWire,
  };
}
