/** Compact house snapshot for multiplayer (style + a few furniture items). */

import { FURN_BY_ID, type HouseStyle } from './catalog.ts';
import { ensureStarterFurniture, migrateFurnitureClearOfWalls, type House, type PlacedItem } from './house.ts';

export const HOUSE_STYLES: HouseStyle[] = ['hytte', 'villa', 'gard', 'slott', 'moderne', 'trehus', 'sjohus'];

export interface FurnWire {
  id: string;
  x: number;
  z: number;
  rot: number;
  floor: number;
  color?: string;
}

export interface HouseWire {
  style: HouseStyle;
  items: FurnWire[];
  /** Locked door: others cannot enter; owner always can. */
  locked?: boolean;
}

export const MAX_FURN_WIRE = 48;

export function parseHouseStyle(v: unknown): HouseStyle | null {
  if (typeof v === 'string' && (HOUSE_STYLES as string[]).includes(v)) return v as HouseStyle;
  return null;
}

export function houseToWire(house: House): HouseWire {
  const items: FurnWire[] = house.items.slice(0, MAX_FURN_WIRE).map((it) => {
    const w: FurnWire = {
      id: it.itemId,
      x: Math.round(it.x * 10) / 10,
      z: Math.round(it.z * 10) / 10,
      rot: Math.round(it.rot * 100) / 100,
      floor: it.floor | 0,
    };
    if (it.color && FURN_BY_ID[it.itemId] && it.color !== FURN_BY_ID[it.itemId].color) w.color = it.color;
    return w;
  });
  return { style: house.style, items, locked: !!house.locked };
}

export function wireToPlaced(items: FurnWire[]): PlacedItem[] {
  return items
    .filter((it) => FURN_BY_ID[it.id])
    .slice(0, MAX_FURN_WIRE)
    .map((it, i) => ({
      uid: `visit-${i}-${it.id}`,
      itemId: it.id,
      x: it.x,
      z: it.z,
      rot: it.rot,
      scale: 1,
      color: it.color ?? FURN_BY_ID[it.id].color,
      floor: it.floor | 0,
    }));
}

export function parseHouseWire(raw: unknown): HouseWire | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const style = parseHouseStyle(o.style);
  if (!style) return null;
  if (!Array.isArray(o.items)) return null;
  const items: FurnWire[] = [];
  for (const it of o.items.slice(0, MAX_FURN_WIRE)) {
    if (!it || typeof it !== 'object') continue;
    const f = it as Record<string, unknown>;
    if (typeof f.id !== 'string' || !FURN_BY_ID[f.id]) continue;
    if (typeof f.x !== 'number' || typeof f.z !== 'number') continue;
    items.push({
      id: f.id,
      x: f.x,
      z: f.z,
      rot: typeof f.rot === 'number' ? f.rot : 0,
      floor: typeof f.floor === 'number' ? (f.floor | 0) : 0,
      ...(typeof f.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(f.color) ? { color: f.color } : {}),
    });
  }
  return { style, items, locked: !!o.locked };
}

export function guestHouseFromWire(ownerId: string, wire: HouseWire, now = Date.now()): House {
  const base: House = {
    id: `visit-${ownerId}`,
    style: wire.style,
    ownerId,
    editors: [],
    editRequests: [],
    wallColor: '#fff1e0',
    floorColor: '#d9a066',
    items: wireToPlaced(wire.items),
    createdAt: now,
    locked: !!wire.locked,
  };
  // Visitors should still see a bed + table even if the host wire was sparse/old.
  return migrateFurnitureClearOfWalls(ensureStarterFurniture(base));
}
