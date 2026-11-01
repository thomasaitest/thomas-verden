import { CAR_BY_ID, FOOD_BY_ID, FURN_BY_ID, HOUSE_BY_STYLE, PET_SHOP_BY_ID, TOY_BY_ID, type HouseStyle } from './catalog.ts';
import { canEdit, newHouse, placeItem, removeItem, type House } from './house.ts';
import { addCare, addJoy, CARE_AMOUNT, completeNeed, joyNow, newPetState, NEED_INFO, tickPet, type CareWhere, type PetState } from './needs.ts';
import { cleanPetName, EGG_BY_ID, hatch } from './pets.ts';
import type { Rng } from './rng.ts';
import { MAX_EQUIPPED, type SaveData } from './save.ts';

export type Fail = 'unknown' | 'too-expensive' | 'owned' | 'empty' | 'no-pet' | 'wrong' | 'no-access';
export type Result<T = object> = ({ ok: true; save: SaveData } & T) | { ok: false; reason: Fail; save: SaveData };

const fail = (save: SaveData, reason: Fail): { ok: false; reason: Fail; save: SaveData } => ({ ok: false, reason, save });
const add = (rec: Record<string, number>, id: string, n: number) => {
  const next = { ...rec, [id]: (rec[id] ?? 0) + n };
  if (next[id] <= 0) delete next[id];
  return next;
};

export function activeHouse(save: SaveData): House {
  return save.houses.find((h) => h.id === save.activeHouseId) ?? save.houses[0];
}
function setHouse(save: SaveData, house: House): SaveData {
  return { ...save, houses: save.houses.map((h) => (h.id === house.id ? house : h)) };
}
function setPet(save: SaveData, pet: PetState): SaveData {
  return { ...save, pets: save.pets.map((p) => (p.uid === pet.uid ? pet : p)) };
}

export function buyFurniture(save: SaveData, id: string): Result {
  const item = FURN_BY_ID[id];
  if (!item) return fail(save, 'unknown');
  if (save.bucks < item.price) return fail(save, 'too-expensive');
  return { ok: true, save: { ...save, bucks: save.bucks - item.price, inventory: add(save.inventory, id, 1) } };
}

export function buyFood(save: SaveData, id: string): Result {
  const food = FOOD_BY_ID[id];
  if (!food) return fail(save, 'unknown');
  if (save.bucks < food.price) return fail(save, 'too-expensive');
  return { ok: true, save: { ...save, bucks: save.bucks - food.price, bag: add(save.bag, id, 1) } };
}

/** Toys are bought once (you only need one of each to play, and playing does not use it up). */
export function buyToy(save: SaveData, id: string): Result {
  const toy = TOY_BY_ID[id];
  if (!toy) return fail(save, 'unknown');
  if (save.bag[id]) return fail(save, 'owned');
  if (save.bucks < toy.price) return fail(save, 'too-expensive');
  return { ok: true, save: { ...save, bucks: save.bucks - toy.price, bag: add(save.bag, id, 1) } };
}

export const TOY_JOY = 0.3;

/**
 * Play with a toy from the backpack. The pet gets happier; a bored pet ("Kjeder seg") is cured by it.
 * The toy stays in the backpack.
 */
export function playWithToy(save: SaveData, petUid: string, toyId: string, now: number, rng: Rng): CareOutcome & { reason?: Fail; joy: number } {
  const none = { save, done: false, reward: 0, grewUp: false, joy: 0 };
  const toy = TOY_BY_ID[toyId];
  const pet = save.pets.find((p) => p.uid === petUid);
  if (!toy || !pet) return { ...none, reason: !pet ? 'no-pet' : 'unknown' };
  if (!save.bag[toyId]) return { ...none, reason: 'empty' };
  let next = setPet(save, addJoy(pet, TOY_JOY, now));
  let out: CareOutcome = { save: next, done: false, reward: 0, grewUp: false };
  if (pet.need && NEED_INFO[pet.need.kind].where === 'lek') out = careAt(next, petUid, 'lek', CARE_AMOUNT.lek, now, rng);
  next = out.save;
  return { ...out, save: next, joy: joyOf(next, petUid, now) };
}
const joyOf = (save: SaveData, uid: string, now: number): number => {
  const p = save.pets.find((x) => x.uid === uid);
  return p ? joyNow(p, now) : 0;
};

/** Potions are not sold — kept only so old saves / cheats fail cleanly. */
export function buyPotion(save: SaveData, _id: string): Result {
  return fail(save, 'unknown');
}

/** Chance a flying pet drops a potion when rolled (modest luck). */
export const POTION_FLY_DROP_CHANCE = 0.18;

/** Roll a potion drop from flying with a flyable pet. Prefer flygedrikk if missing, else ridedrikk. */
export function maybeDropPotionFromFlight(save: SaveData, rng: Rng): Result<{ potionId: 'flygedrikk' | 'ridedrikk' }> {
  if (rng() > POTION_FLY_DROP_CHANCE) return fail(save, 'empty');
  const preferFly = !save.bag.flygedrikk || (save.bag.flygedrikk ?? 0) <= (save.bag.ridedrikk ?? 0);
  const potionId: 'flygedrikk' | 'ridedrikk' = preferFly ? 'flygedrikk' : 'ridedrikk';
  return { ok: true, save: { ...save, bag: add(save.bag, potionId, 1) }, potionId };
}

export function usePotion(save: SaveData, id: 'flygedrikk' | 'ridedrikk', petUid: string): Result {
  if (!save.bag[id]) return fail(save, 'empty');
  const pet = save.pets.find((p) => p.uid === petUid);
  if (!pet) return fail(save, 'no-pet');
  if ((id === 'flygedrikk' && pet.flyable) || (id === 'ridedrikk' && pet.rideable)) return fail(save, 'owned');
  const next = id === 'flygedrikk' ? { ...pet, flyable: true } : { ...pet, rideable: true };
  return { ok: true, save: { ...setPet(save, next), bag: add(save.bag, id, -1) } };
}

/** Buy (or claim the free starter) egg and hatch it right away. New pets follow you if there is room. */
export function buyAndHatch(save: SaveData, eggId: string, rng: Rng, now = Date.now()): Result<{ pet: PetState }> {
  const egg = EGG_BY_ID[eggId];
  if (!egg) return fail(save, 'unknown');
  if (egg.price === 0 && save.starterClaimed) return fail(save, 'owned');
  if (save.bucks < egg.price) return fail(save, 'too-expensive');
  const pet = newPetState(hatch(eggId, rng, now), now);
  const equipped = save.equipped.length < MAX_EQUIPPED ? [...save.equipped, pet.uid] : save.equipped;
  return {
    ok: true,
    pet,
    save: {
      ...save,
      bucks: save.bucks - egg.price,
      pets: [...save.pets, pet],
      equipped,
      starterClaimed: save.starterClaimed || egg.price === 0,
      stats: { ...save.stats, hatched: save.stats.hatched + 1 },
    },
  };
}


export function buyCar(save: SaveData, id: string): Result {
  const car = CAR_BY_ID[id];
  if (!car) return fail(save, 'unknown');
  if (save.bag[id]) return fail(save, 'owned');
  if (save.bucks < car.price) return fail(save, 'too-expensive');
  return { ok: true, save: { ...save, bucks: save.bucks - car.price, bag: add(save.bag, id, 1) } };
}

export function buyPetShopItem(save: SaveData, id: string): Result {
  const item = PET_SHOP_BY_ID[id];
  if (!item) return fail(save, 'unknown');
  if (save.bag[id]) return fail(save, 'owned');
  if (save.bucks < item.price) return fail(save, 'too-expensive');
  return { ok: true, save: { ...save, bucks: save.bucks - item.price, bag: add(save.bag, id, 1) } };
}
export function buyHouse(save: SaveData, style: HouseStyle, now = Date.now()): Result {
  const info = HOUSE_BY_STYLE[style];
  if (!info) return fail(save, 'unknown');
  const owned = save.houses.find((h) => h.style === style);
  if (owned) return { ok: true, save: { ...save, activeHouseId: owned.id } };
  if (save.bucks < info.price) return fail(save, 'too-expensive');
  const house = newHouse(style, save.playerId, now);
  return { ok: true, save: { ...save, bucks: save.bucks - info.price, houses: [...save.houses, house], activeHouseId: house.id } };
}

export function toggleEquip(save: SaveData, petUid: string): Result {
  if (!save.pets.some((p) => p.uid === petUid)) return fail(save, 'no-pet');
  if (save.equipped.includes(petUid)) return { ok: true, save: { ...save, equipped: save.equipped.filter((u) => u !== petUid) } };
  const equipped = [...save.equipped, petUid].slice(-MAX_EQUIPPED);
  return { ok: true, save: { ...save, equipped } };
}

export function renamePet(save: SaveData, petUid: string, name: string): SaveData {
  const pet = save.pets.find((p) => p.uid === petUid);
  return pet ? setPet(save, { ...pet, name: cleanPetName(name, pet.name) }) : save;
}

export function placeFromInventory(save: SaveData, itemId: string, x: number, z: number, floor = 0): Result {
  const house = activeHouse(save);
  if (!canEdit(house, save.playerId)) return fail(save, 'no-access');
  if (!save.inventory[itemId]) return fail(save, 'empty');
  return { ok: true, save: { ...setHouse(save, placeItem(house, itemId, x, z, undefined, floor)), inventory: add(save.inventory, itemId, -1) } };
}

export function storeItem(save: SaveData, itemUid: string): Result {
  const house = activeHouse(save);
  if (!canEdit(house, save.playerId)) return fail(save, 'no-access');
  const r = removeItem(house, itemUid);
  if (!r.itemId) return fail(save, 'unknown');
  return { ok: true, save: { ...setHouse(save, r.house), inventory: add(save.inventory, r.itemId, 1) } };
}

export function editHouse(save: SaveData, fn: (h: House) => House): SaveData {
  const house = activeHouse(save);
  if (!canEdit(house, save.playerId)) return save;
  return setHouse(save, fn(house));
}

export interface CareOutcome {
  save: SaveData;
  done: boolean;
  reward: number;
  grewUp: boolean;
}

function finish(save: SaveData, pet: PetState, now: number, rng: Rng): CareOutcome {
  const r = completeNeed(pet, now, rng);
  return { save: { ...setPet(save, r.pet), bucks: save.bucks + r.reward, stats: { ...save.stats, tasks: save.stats.tasks + 1 } }, done: true, reward: r.reward, grewUp: r.grewUp };
}

/** Care at a place (bed, bath, playground, vet, walk distance). */
export function careAt(save: SaveData, petUid: string, where: CareWhere, amount: number, now: number, rng: Rng): CareOutcome {
  const pet = save.pets.find((p) => p.uid === petUid);
  if (!pet) return { save, done: false, reward: 0, grewUp: false };
  const r = addCare(pet, where, amount);
  if (r.pet === pet) return { save, done: false, reward: 0, grewUp: false };
  if (r.done) return finish(save, r.pet, now, rng);
  return { save: setPet(save, r.pet), done: false, reward: 0, grewUp: false };
}

/** Feed food or drink from the bag. The food is only used up if the pet wants it. */
export function feed(save: SaveData, petUid: string, foodId: string, now: number, rng: Rng): CareOutcome & { reason?: Fail } {
  const food = FOOD_BY_ID[foodId];
  const pet = save.pets.find((p) => p.uid === petUid);
  if (!food || !pet) return { save, done: false, reward: 0, grewUp: false, reason: 'unknown' };
  if (!save.bag[foodId]) return { save, done: false, reward: 0, grewUp: false, reason: 'empty' };
  if (!pet.need || NEED_INFO[pet.need.kind].where !== food.fixes) return { save, done: false, reward: 0, grewUp: false, reason: 'wrong' };
  const r = careAt({ ...save, bag: add(save.bag, foodId, -1) }, petUid, food.fixes, 1, now, rng);
  return r;
}

/** Equipped pets get new needs over time; pets resting at home wait. */
export function tickSave(save: SaveData, now: number, rng: Rng): SaveData {
  let changed = false;
  const pets = save.pets.map((p) => {
    if (!save.equipped.includes(p.uid)) return p;
    const next = tickPet(p, now, rng);
    if (next !== p) changed = true;
    return next;
  });
  return changed ? { ...save, pets } : save;
}

export function addBucks(save: SaveData, n: number): SaveData {
  return { ...save, bucks: Math.max(0, save.bucks + Math.floor(n)) };
}
