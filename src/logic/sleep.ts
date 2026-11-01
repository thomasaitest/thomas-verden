/**
 * Avatar sleeping in beds (pure helpers). Night mode is removed – sleep never changes time of day.
 */
import { FURN_BY_ID } from './catalog.ts';
import type { PlacedItem } from './house.ts';
import { FLOOR_H } from './layout.ts';

export interface SleepSpot {
  x: number;
  y: number;
  z: number;
  /** Facing along the bed (head toward -local z of the furniture after rot). */
  yaw: number;
  itemUid: string;
}

/** Human beds the avatar can lie in (not the tiny pet basket). */
export function isAvatarBed(itemId: string): boolean {
  const def = FURN_BY_ID[itemId];
  return !!def && def.care === 'seng' && def.model !== 'petbed';
}

/** Mattress height for a bed model (world units before item scale / floor). */
export function bedMattressY(model: string): number {
  if (model === 'hammock') return 0.95;
  if (model === 'bunk') return 0.85;
  return 0.75;
}

/** Where the avatar lies on this bed item. */
export function sleepSpotFor(item: PlacedItem): SleepSpot | null {
  if (!isAvatarBed(item.itemId)) return null;
  const def = FURN_BY_ID[item.itemId];
  const y = bedMattressY(def.model) * item.scale + item.floor * FLOOR_H;
  return { x: item.x, y, z: item.z, yaw: item.rot, itemUid: item.uid };
}

/** Nearest usable bed on the same floor within reach. */
export function nearestBed(items: readonly PlacedItem[], x: number, z: number, floor: number, reachPad = 1.8): SleepSpot | null {
  let best: SleepSpot | null = null;
  let bestD = Infinity;
  for (const it of items) {
    if (it.floor !== floor) continue;
    const spot = sleepSpotFor(it);
    if (!spot) continue;
    const def = FURN_BY_ID[it.itemId];
    const reach = def.size * it.scale * 0.55 + reachPad;
    const d = Math.hypot(x - it.x, z - it.z);
    if (d < reach && d < bestD) {
      bestD = d;
      best = spot;
    }
  }
  return best;
}

/** Moving or jumping wakes you up (sleep never changes the sky/day). */
export function shouldWakeFromBed(moveLen: number, jumpPressed: boolean): boolean {
  return jumpPressed || moveLen > 0.12;
}
