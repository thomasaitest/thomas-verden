/** Cars and prams (vogner): ownership helpers and movement speeds. */

import { CAR_BY_ID, PET_SHOP_BY_ID, type CarItem, type PetShopItem } from './catalog.ts';
import type { SaveData } from './save.ts';

export const DRIVE_SPEED = 18;
export const PRAM_SPEED = 7;
export const WALK_SPEED = 9;

export function ownedCars(save: SaveData): CarItem[] {
  return Object.keys(save.bag)
    .filter((id) => CAR_BY_ID[id] && (save.bag[id] ?? 0) > 0)
    .map((id) => CAR_BY_ID[id]);
}

export function ownedPrams(save: SaveData): PetShopItem[] {
  return Object.keys(save.bag)
    .filter((id) => {
      const it = PET_SHOP_BY_ID[id];
      return it && it.kind === 'vogn' && (save.bag[id] ?? 0) > 0;
    })
    .map((id) => PET_SHOP_BY_ID[id]);
}

export function canDrive(save: SaveData, carId: string | null | undefined): boolean {
  return !!carId && !!CAR_BY_ID[carId] && (save.bag[carId] ?? 0) > 0;
}

export function canPram(save: SaveData, pramId: string | null | undefined): boolean {
  if (!pramId) return false;
  const it = PET_SHOP_BY_ID[pramId];
  return !!it && it.kind === 'vogn' && (save.bag[pramId] ?? 0) > 0;
}

/** First owned car, or null. */
export function defaultCar(save: SaveData): string | null {
  return ownedCars(save)[0]?.id ?? null;
}

/** First owned pram, or null. */
export function defaultPram(save: SaveData): string | null {
  return ownedPrams(save)[0]?.id ?? null;
}

export function vehicleSpeed(opts: { driving: boolean; pramming: boolean; riding: boolean; flying: boolean }): number {
  if (opts.flying) return 18;
  if (opts.driving) return DRIVE_SPEED;
  if (opts.riding) return 15;
  if (opts.pramming) return PRAM_SPEED;
  return WALK_SPEED;
}
