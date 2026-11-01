import { FURN_BY_ID, HOUSE_BY_STYLE, type HouseStyle } from './catalog.ts';
import type { CareWhere } from './needs.ts';
import { FLOORS, houseLayout, itemRadius, moveInLayout, placeInLayout, roomCenter } from './layout.ts';
import { uid } from './rng.ts';

export interface PlacedItem {
  uid: string;
  itemId: string;
  /** Room-local position in metres; (0,0) is the room centre, the door is at +z. */
  x: number;
  z: number;
  /** Radians. */
  rot: number;
  scale: number;
  color: string;
  /** Which floor it stands on (0 = ground floor). */
  floor: number;
}

export interface House {
  id: string;
  style: HouseStyle;
  /** Multiplayer stub: the owner and the players allowed to build here. */
  ownerId: string;
  editors: string[];
  editRequests: string[];
  wallColor: string;
  floorColor: string;
  items: PlacedItem[];
  createdAt: number;
  /** When true, other players cannot walk in (owner always can). Synced in multiplayer. */
  locked: boolean;
}

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;
const MARGIN = 0.4;

export function roomSize(style: HouseStyle): { w: number; d: number } {
  const h = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  return { w: h.w, d: h.d };
}

const HUMAN_BEDS = new Set(['seng', 'dobbeltseng', 'koyeseng', 'himmelseng', 'stjerneseng', 'hengekoye']);
const TABLES = new Set(['spisebord', 'salongbord']);

export function hasHumanBed(items: readonly PlacedItem[]): boolean {
  return items.some((i) => HUMAN_BEDS.has(i.itemId));
}
export function hasTable(items: readonly PlacedItem[]): boolean {
  return items.some((i) => TABLES.has(i.itemId));
}

/** Starter bed + table (+ pet care bits). Used by newHouse and save migration. */
/** Prefer bed in a sleep-ish room and table in the living/salon; always run through placeInLayout. */
export function starterSpots(style: HouseStyle): { bed: { x: number; z: number; rot: number }; table: { x: number; z: number; rot: number } } {
  const L = houseLayout(style);
  const sleep = roomCenter(L, 0, /Soverom|Master|Lugar|Kongesuite|Prinsesse/i) ?? { x: -L.w * 0.25, z: -L.d * 0.15 };
  const live = roomCenter(L, 0, /Stue|Salon|Festsal|Åpen stue|Salong|Dekk/i) ?? { x: L.w * 0.15, z: L.d * 0.15 };
  // Nudge bed/table off the exact centre so they do not stack on the player spawn path.
  return {
    bed: { x: sleep.x, z: sleep.z, rot: Math.PI / 2 },
    table: { x: live.x, z: live.z, rot: 0 },
  };
}

export function starterFurniture(style: HouseStyle): PlacedItem[] {
  const L = houseLayout(style);
  const spots = starterSpots(style);
  const bedP = placeInLayout(L, 0, spots.bed.x, spots.bed.z, itemRadius(2.2, 1));
  const tableP = placeInLayout(L, 0, spots.table.x, spots.table.z, itemRadius(2.0, 1));
  const rugP = placeInLayout(L, 0, L.door.x, L.door.z - 4, itemRadius(1.5, 1));
  const petP = placeInLayout(L, 0, L.door.x - 3, L.door.z - 3, itemRadius(1.2, 1));
  const bathRoom = roomCenter(L, 0, /Bad|Ensuite|Vaskerom|Tronsal/i) ?? { x: L.w * 0.3, z: -L.d * 0.25 };
  const bathP = placeInLayout(L, 0, bathRoom.x, bathRoom.z, itemRadius(2.0, 1));
  const plantP = placeInLayout(L, 0, L.door.x + 3, L.door.z - 2, itemRadius(0.8, 1));
  return [
    { uid: uid('it'), itemId: 'seng', x: bedP.x, z: bedP.z, rot: spots.bed.rot, scale: 1, color: '#8fb8ff', floor: 0 },
    { uid: uid('it'), itemId: 'spisebord', x: tableP.x, z: tableP.z, rot: spots.table.rot, scale: 1, color: '#d9a066', floor: 0 },
    { uid: uid('it'), itemId: 'dyreseng', x: petP.x, z: petP.z, rot: 0, scale: 1, color: '#ffb84d', floor: 0 },
    { uid: uid('it'), itemId: 'badekar', x: bathP.x, z: bathP.z, rot: 0, scale: 1, color: '#ffffff', floor: 0 },
    { uid: uid('it'), itemId: 'rundtteppe', x: rugP.x, z: rugP.z, rot: 0, scale: 1, color: '#ff9ccf', floor: 0 },
    { uid: uid('it'), itemId: 'potteplante', x: plantP.x, z: plantP.z, rot: 0, scale: 1, color: '#5cc36b', floor: 0 },
  ];
}

/** Add missing starter bed/table to an existing house without duplicating. */
export function ensureStarterFurniture(house: House): House {
  const L = houseLayout(house.style);
  const spots = starterSpots(house.style);
  const extras: PlacedItem[] = [];
  if (!hasHumanBed(house.items)) {
    const p = placeInLayout(L, 0, spots.bed.x, spots.bed.z, itemRadius(2.2, 1));
    extras.push({ uid: uid('it'), itemId: 'seng', x: p.x, z: p.z, rot: spots.bed.rot, scale: 1, color: '#8fb8ff', floor: 0 });
  }
  if (!hasTable(house.items)) {
    const p = placeInLayout(L, 0, spots.table.x, spots.table.z, itemRadius(2.0, 1));
    extras.push({ uid: uid('it'), itemId: 'spisebord', x: p.x, z: p.z, rot: spots.table.rot, scale: 1, color: '#d9a066', floor: 0 });
  }
  if (!extras.length) return house;
  return { ...house, items: [...house.items, ...extras] };
}



export function newHouse(style: HouseStyle, ownerId: string, now = Date.now()): House {
  const items = starterFurniture(style);
  const info = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  return { id: uid('house'), style, ownerId, editors: [], editRequests: [], wallColor: info.wall, floorColor: '#d9a066', items, createdAt: now, locked: false };
}

export function canEdit(house: House, playerId: string): boolean {
  return house.ownerId === playerId || house.editors.includes(playerId);
}
export function requestEdit(house: House, playerId: string): House {
  if (canEdit(house, playerId) || house.editRequests.includes(playerId)) return house;
  return { ...house, editRequests: [...house.editRequests, playerId] };
}
/** Only the owner can let someone build. */
export function grantEdit(house: House, byId: string, playerId: string): House {
  if (byId !== house.ownerId || house.editors.includes(playerId)) return house;
  return { ...house, editors: [...house.editors, playerId], editRequests: house.editRequests.filter((p) => p !== playerId) };
}
export function revokeEdit(house: House, byId: string, playerId: string): House {
  if (byId !== house.ownerId) return house;
  return { ...house, editors: house.editors.filter((p) => p !== playerId) };
}

export function clampToRoom(style: HouseStyle, x: number, z: number): { x: number; z: number } {
  const { w, d } = roomSize(style);
  const cx = w / 2 - MARGIN;
  const cz = d / 2 - MARGIN;
  return { x: Math.max(-cx, Math.min(cx, x)), z: Math.max(-cz, Math.min(cz, z)) };
}

/** Move a wall item onto the nearest wall, facing into the room. The front wall (with the door) is skipped. */
export function snapToWall(style: HouseStyle, x: number, z: number): { x: number; z: number; rot: number } {
  const { w, d } = roomSize(style);
  const p = clampToRoom(style, x, z);
  const inset = 0.08;
  const options = [
    { dist: Math.abs(p.z + d / 2), x: p.x, z: -d / 2 + inset, rot: 0 },
    { dist: Math.abs(p.x + w / 2), x: -w / 2 + inset, z: p.z, rot: Math.PI / 2 },
    { dist: Math.abs(p.x - w / 2), x: w / 2 - inset, z: p.z, rot: -Math.PI / 2 },
  ];
  options.sort((a, b) => a.dist - b.dist);
  const { x: sx, z: sz, rot } = options[0];
  return { x: sx, z: sz, rot };
}

const floorOf = (n: unknown): number => Math.max(0, Math.min(FLOORS - 1, Math.floor(Number(n) || 0)));

/** Make an item legal: scale in range, on a real floor, and not inside a wall or the staircase. */
function fit(style: HouseStyle, item: PlacedItem): PlacedItem {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number.isFinite(item.scale) ? item.scale : 1));
  const floor = floorOf(item.floor);
  const def = FURN_BY_ID[item.itemId];
  if (def?.wall) return { ...item, scale, floor, ...snapToWall(style, item.x, item.z) };
  const p = placeInLayout(houseLayout(style), floor, item.x, item.z, itemRadius(def?.size ?? 1, scale));
  return { ...item, scale, floor, x: p.x, z: p.z };
}

/** After plan changes, push every free-standing item out of walls/stairs (saved positions migrate safely). */
export function migrateFurnitureClearOfWalls(house: House): House {
  return { ...house, items: house.items.map((it) => fit(house.style, it)) };
}

export function placeItem(house: House, itemId: string, x = 0, z = 0, color?: string, floor = 0): House {
  const def = FURN_BY_ID[itemId];
  if (!def) return house;
  const item = fit(house.style, { uid: uid('it'), itemId, x, z, rot: 0, scale: 1, color: color ?? def.color, floor });
  return { ...house, items: [...house.items, item] };
}

export function updateItem(house: House, itemUid: string, patch: Partial<Omit<PlacedItem, 'uid' | 'itemId'>>): House {
  return { ...house, items: house.items.map((it) => (it.uid === itemUid ? fit(house.style, { ...it, ...patch }) : it)) };
}

/**
 * Drag an item to a new spot. It slides along walls and stops at them, so furniture can never be pushed
 * through a wall into another room (only through a doorway). Wall decorations just snap to the nearest outer wall.
 */
export function moveItem(house: House, itemUid: string, x: number, z: number): House {
  const it = house.items.find((i) => i.uid === itemUid);
  if (!it) return house;
  const def = FURN_BY_ID[it.itemId];
  if (def?.wall) return updateItem(house, itemUid, { x, z });
  const p = moveInLayout(houseLayout(house.style), it.floor, it, { x, z }, itemRadius(def?.size ?? 1, it.scale));
  return { ...house, items: house.items.map((i) => (i.uid === itemUid ? { ...i, x: p.x, z: p.z } : i)) };
}

export function rotateItem(house: House, itemUid: string): House {
  const it = house.items.find((i) => i.uid === itemUid);
  if (!it || FURN_BY_ID[it.itemId]?.wall) return house;
  const rot = (it.rot + Math.PI / 4) % (Math.PI * 2);
  return updateItem(house, itemUid, { rot });
}

export function removeItem(house: House, itemUid: string): { house: House; itemId: string | null } {
  const it = house.items.find((i) => i.uid === itemUid);
  if (!it) return { house, itemId: null };
  return { house: { ...house, items: house.items.filter((i) => i.uid !== itemUid) }, itemId: it.itemId };
}

/** Placed items that give a kind of care, e.g. beds for sleep. */
export function careItems(house: House, where: CareWhere): PlacedItem[] {
  return house.items.filter((i) => FURN_BY_ID[i.itemId]?.care === where);
}

export function serializeHouse(house: House): string {
  return JSON.stringify(house);
}

export function deserializeHouse(json: string): House | null {
  try {
    const raw = JSON.parse(json) as Partial<House>;
    if (!raw || typeof raw.id !== 'string' || typeof raw.ownerId !== 'string' || !raw.style || !HOUSE_BY_STYLE[raw.style]) return null;
    const style = raw.style;
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .filter((i) => i && FURN_BY_ID[i.itemId] && typeof i.uid === 'string')
      .map((i) => fit(style, { uid: i.uid, itemId: i.itemId, x: Number(i.x) || 0, z: Number(i.z) || 0, rot: Number(i.rot) || 0, scale: Number(i.scale) || 1, floor: floorOf((i as PlacedItem).floor), color: typeof i.color === 'string' ? i.color : FURN_BY_ID[i.itemId].color }));
    return {
      id: raw.id,
      style,
      ownerId: raw.ownerId,
      editors: Array.isArray(raw.editors) ? raw.editors.filter((e) => typeof e === 'string') : [],
      editRequests: Array.isArray(raw.editRequests) ? raw.editRequests.filter((e) => typeof e === 'string') : [],
      wallColor: typeof raw.wallColor === 'string' ? raw.wallColor : '#fff1e0',
      floorColor: typeof raw.floorColor === 'string' ? raw.floorColor : '#d9a066',
      items,
      createdAt: Number(raw.createdAt) || Date.now(),
      locked: !!raw.locked,
    };
  } catch {
    return null;
  }
}

/** Owner toggles the front-door lock (does not affect the owner). */
export function setHouseLocked(house: House, locked: boolean): House {
  if (house.locked === locked) return house;
  return { ...house, locked };
}
