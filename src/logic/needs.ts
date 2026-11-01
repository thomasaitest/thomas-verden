import { pickWeighted, type Rng } from './rng.ts';
import type { OwnedPet } from './pets.ts';

export type NeedKind = 'sulten' | 'torst' | 'trott' | 'skitten' | 'kjedelig' | 'syk' | 'tur';
/** Where or how a need is fixed. */
export type CareWhere = 'mat' | 'drikke' | 'seng' | 'bad' | 'lek' | 'dyrlege' | 'tur';

export interface Need {
  kind: NeedKind;
  since: number;
  /** 0–1 */
  progress: number;
}

export interface PetState extends OwnedPet {
  xp: number;
  need: Need | null;
  nextNeedAt: number;
  lastNeed: NeedKind | null;
  /** How happy the pet is, 0–1 right after `joyAt` (playing with toys raises it; it fades over 10 minutes). Missing = 0. */
  joy?: number;
  joyAt?: number;
}

export const JOY_FADE_MS = 10 * 60_000;
/** Happiness right now (0–1). */
export function joyNow(pet: Pick<PetState, 'joy' | 'joyAt'>, now: number): number {
  const j = pet.joy ?? 0;
  if (j <= 0) return 0;
  return Math.max(0, Math.min(1, j - Math.max(0, now - (pet.joyAt ?? now)) / JOY_FADE_MS));
}
export function addJoy<T extends PetState>(pet: T, amount: number, now: number): T {
  return { ...pet, joy: Math.max(0, Math.min(1, joyNow(pet, now) + amount)), joyAt: now };
}

export const NEED_INFO: Record<NeedKind, { label: string; emoji: string; where: CareWhere; hint: string; reward: number; weight: number }> = {
  sulten: { label: 'Sulten', emoji: '🍎', where: 'mat', hint: 'Kjøp mat i Butikken og gi den til dyret', reward: 20, weight: 4 },
  torst: { label: 'Tørst', emoji: '🥤', where: 'drikke', hint: 'Kjøp drikke i Butikken og gi den til dyret', reward: 20, weight: 4 },
  trott: { label: 'Trøtt', emoji: '💤', where: 'seng', hint: 'Gå hjem og stå ved en seng', reward: 25, weight: 3 },
  skitten: { label: 'Skitten', emoji: '🫧', where: 'bad', hint: 'Gå hjem til badekaret eller dusjen', reward: 25, weight: 3 },
  kjedelig: { label: 'Kjeder seg', emoji: '⚽', where: 'lek', hint: 'Lek på Lekeplassen (eller med leker hjemme)', reward: 25, weight: 3 },
  tur: { label: 'Vil på tur', emoji: '🌳', where: 'tur', hint: 'Gå en tur ute i byen', reward: 25, weight: 2 },
  syk: { label: 'Syk!', emoji: '🤒', where: 'dyrlege', hint: 'Ta dyret med til Dyrlegen!', reward: 35, weight: 0 },
};

/** Seconds standing at the right place (or meters walked for a walk). */
export const CARE_AMOUNT: Record<CareWhere, number> = { mat: 1, drikke: 1, seng: 6, bad: 5, lek: 6, dyrlege: 5, tur: 40 };

/** A need left alone this long turns into sickness. */
export const SICK_AFTER = 4 * 60_000;
export const RANDOM_SICK_CHANCE = 0.08;
export const NEED_DELAY_MIN = 20_000;
export const NEED_DELAY_MAX = 50_000;
export const GROW_BONUS = 60;

export const STAGES = [
  { name: 'Nyfødt', at: 0, scale: 0.7 },
  { name: 'Baby', at: 2, scale: 0.8 },
  { name: 'Barn', at: 5, scale: 0.9 },
  { name: 'Tenåring', at: 9, scale: 1.0 },
  { name: 'Ungdom', at: 14, scale: 1.1 },
  { name: 'Voksen', at: 20, scale: 1.2 },
] as const;

export function stageIndex(xp: number): number {
  let idx = 0;
  STAGES.forEach((s, i) => {
    if (xp >= s.at) idx = i;
  });
  return idx;
}
export function stageOf(xp: number) {
  return STAGES[stageIndex(xp)];
}
export function stageProgress(xp: number): number {
  const i = stageIndex(xp);
  const next = STAGES[i + 1];
  if (!next) return 1;
  return (xp - STAGES[i].at) / (next.at - STAGES[i].at);
}

export function newPetState(pet: OwnedPet, now: number): PetState {
  return { ...pet, xp: 0, need: null, nextNeedAt: now + 4_000, lastNeed: null };
}

export function nextDelay(rng: Rng): number {
  return NEED_DELAY_MIN + Math.floor(rng() * (NEED_DELAY_MAX - NEED_DELAY_MIN));
}

export function rollNeed(last: NeedKind | null, rng: Rng, allowSick = true): NeedKind {
  if (allowSick && rng() < RANDOM_SICK_CHANCE) return 'syk';
  const kinds = (Object.keys(NEED_INFO) as NeedKind[]).filter((k) => k !== last && NEED_INFO[k].weight > 0);
  return pickWeighted(kinds, (k) => NEED_INFO[k].weight, rng);
}

/** Advance time for one pet: new needs appear, and ignored needs turn into sickness. */
export function tickPet(pet: PetState, now: number, rng: Rng): PetState {
  if (pet.need) {
    if (pet.need.kind !== 'syk' && now - pet.need.since > SICK_AFTER) {
      return { ...pet, need: { kind: 'syk', since: now, progress: 0 } };
    }
    return pet;
  }
  // Brand-new pets don't fall ill out of the blue.
  if (now >= pet.nextNeedAt) return { ...pet, need: { kind: rollNeed(pet.lastNeed, rng, pet.xp >= 2), since: now, progress: 0 } };
  return pet;
}

/** Add care at a place. Returns whether the need got fixed by this care. */
export function addCare(pet: PetState, where: CareWhere, amount: number): { pet: PetState; done: boolean } {
  if (!pet.need || NEED_INFO[pet.need.kind].where !== where || amount <= 0) return { pet, done: false };
  const progress = Math.min(1, pet.need.progress + amount / CARE_AMOUNT[where]);
  return { pet: { ...pet, need: { ...pet.need, progress } }, done: progress >= 1 };
}

export interface CompleteResult {
  pet: PetState;
  reward: number;
  grewUp: boolean;
}

/** Finish the current need: pay bucks, add growth, and plan the next need. */
export function completeNeed(pet: PetState, now: number, rng: Rng): CompleteResult {
  if (!pet.need) return { pet, reward: 0, grewUp: false };
  const before = stageIndex(pet.xp);
  const xp = pet.xp + 1;
  const grewUp = stageIndex(xp) > before;
  const reward = NEED_INFO[pet.need.kind].reward + (grewUp ? GROW_BONUS : 0);
  return { pet: { ...pet, xp, need: null, lastNeed: pet.need.kind, nextNeedAt: now + nextDelay(rng) }, reward, grewUp };
}
