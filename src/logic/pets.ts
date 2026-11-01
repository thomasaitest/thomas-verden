import { pickWeighted, uid, type Rng } from './rng.ts';

export type Rarity = 'vanlig' | 'uvanlig' | 'sjelden' | 'ultra' | 'legendarisk';
/** Procedural 3D body used to draw the whole animal. */
export type BodyType = 'dog' | 'cat' | 'bunny' | 'bear' | 'pig' | 'horse' | 'bird' | 'penguin' | 'dragon' | 'dino' | 'turtle' | 'bug' | 'fox';

export interface PetSpecies {
  id: string;
  name: string;
  body: BodyType;
  rarity: Rarity;
  /** Main, second and accent colours. */
  colors: [string, string, string];
  /** Extra looks drawn on the body. */
  horn?: boolean;
  wings?: boolean;
  spots?: boolean;
  mane?: boolean;
  /** Chance that a hatched pet is born able to fly or be ridden (potions can add it later). */
  bornFly?: number;
  bornRide?: number;
}

export const RARITY_ORDER: Rarity[] = ['vanlig', 'uvanlig', 'sjelden', 'ultra', 'legendarisk'];

export const RARITY_INFO: Record<Rarity, { label: string; color: string }> = {
  vanlig: { label: 'Vanlig', color: '#9aa7b4' },
  uvanlig: { label: 'Uvanlig', color: '#54c45e' },
  sjelden: { label: 'Sjelden', color: '#3fa4ff' },
  ultra: { label: 'Ultrasjelden', color: '#b05cff' },
  legendarisk: { label: 'Legendarisk', color: '#ffb300' },
};

export const SPECIES: PetSpecies[] = [
  // Vanlig
  { id: 'hund', name: 'Hund', body: 'dog', rarity: 'vanlig', colors: ['#d9a066', '#fff1dc', '#5b3a29'] },
  { id: 'katt', name: 'Katt', body: 'cat', rarity: 'vanlig', colors: ['#ffb36b', '#fff4e6', '#c9663a'] },
  { id: 'kanin', name: 'Kanin', body: 'bunny', rarity: 'vanlig', colors: ['#f4f1f6', '#ffc6dc', '#c9b8d8'] },
  { id: 'kylling', name: 'Kylling', body: 'bird', rarity: 'vanlig', colors: ['#ffe14d', '#ff9a3c', '#ff9a3c'] },
  { id: 'gris', name: 'Gris', body: 'pig', rarity: 'vanlig', colors: ['#ffb3c7', '#ff8fb1', '#e0708f'] },
  { id: 'skilpadde', name: 'Skilpadde', body: 'turtle', rarity: 'vanlig', colors: ['#7ccf6a', '#a0632f', '#5aa74b'] },
  { id: 'marihone', name: 'Marihøne', body: 'bug', rarity: 'vanlig', colors: ['#ff4b4b', '#222233', '#222233'], spots: true, wings: true, bornFly: 0.1 },
  // Uvanlig
  { id: 'rev', name: 'Rev', body: 'fox', rarity: 'uvanlig', colors: ['#ff7a2f', '#ffffff', '#3b2a22'] },
  { id: 'panda', name: 'Panda', body: 'bear', rarity: 'uvanlig', colors: ['#ffffff', '#2b2b38', '#2b2b38'], spots: true },
  { id: 'pingvin', name: 'Pingvin', body: 'penguin', rarity: 'uvanlig', colors: ['#2f3550', '#ffffff', '#ffb02e'] },
  { id: 'dalmatiner', name: 'Dalmatiner', body: 'dog', rarity: 'uvanlig', colors: ['#ffffff', '#ffffff', '#2b2b38'], spots: true },
  { id: 'hest', name: 'Hest', body: 'horse', rarity: 'uvanlig', colors: ['#a86b3c', '#fff1dc', '#4a2e1c'], mane: true, bornRide: 0.3 },
  { id: 'bie', name: 'Bie', body: 'bug', rarity: 'uvanlig', colors: ['#ffd23f', '#2b2b38', '#2b2b38'], wings: true, bornFly: 0.2 },
  { id: 'koala', name: 'Koala', body: 'bear', rarity: 'uvanlig', colors: ['#a7adb8', '#f1f1f4', '#4a4a58'] },
  // Sjelden
  { id: 'ugle', name: 'Ugle', body: 'bird', rarity: 'sjelden', colors: ['#a0703f', '#f3d9b1', '#ffb02e'], wings: true, bornFly: 0.35 },
  { id: 'isbjorn', name: 'Isbjørn', body: 'bear', rarity: 'sjelden', colors: ['#f6fbff', '#dfeaf5', '#2b2b38'], bornRide: 0.2 },
  { id: 'snoleopard', name: 'Snøleopard', body: 'cat', rarity: 'sjelden', colors: ['#eef0f5', '#ffffff', '#5b5f70'], spots: true },
  { id: 'polarrev', name: 'Polarrev', body: 'fox', rarity: 'sjelden', colors: ['#f2f6ff', '#ffffff', '#9fb4d8'] },
  { id: 'papegoye', name: 'Papegøye', body: 'bird', rarity: 'sjelden', colors: ['#ff3d3d', '#ffd23f', '#3fa4ff'], wings: true, bornFly: 0.4 },
  { id: 'enhjorning-baby', name: 'Ponni', body: 'horse', rarity: 'sjelden', colors: ['#ffc6e3', '#fff4fb', '#ff7fbf'], mane: true, bornRide: 0.4 },
  // Ultrasjelden
  { id: 'enhjorning', name: 'Enhjørning', body: 'horse', rarity: 'ultra', colors: ['#ffffff', '#fff4fb', '#c88bff'], horn: true, mane: true, bornRide: 0.5, bornFly: 0.15 },
  { id: 'trex', name: 'T-rex', body: 'dino', rarity: 'ultra', colors: ['#6cc46a', '#d8f5b0', '#3d8a3c'], bornRide: 0.4 },
  { id: 'kenguru', name: 'Kenguru', body: 'bunny', rarity: 'ultra', colors: ['#c98a55', '#f3d9b1', '#7a4a2a'], bornRide: 0.3 },
  { id: 'flamingo', name: 'Flamingo', body: 'bird', rarity: 'ultra', colors: ['#ff8fc7', '#ffc6e3', '#2b2b38'], wings: true, bornFly: 0.5 },
  { id: 'gullkatt', name: 'Gullkatt', body: 'cat', rarity: 'ultra', colors: ['#ffd23f', '#fff4c2', '#ff9a3c'] },
  // Legendarisk
  { id: 'drage', name: 'Drage', body: 'dragon', rarity: 'legendarisk', colors: ['#ff4b6e', '#ffd23f', '#ffd23f'], wings: true, horn: true, bornFly: 0.6, bornRide: 0.4 },
  { id: 'isdrage', name: 'Isdrage', body: 'dragon', rarity: 'legendarisk', colors: ['#7fd8ff', '#ffffff', '#3fa4ff'], wings: true, horn: true, bornFly: 0.6, bornRide: 0.4 },
  { id: 'pegasus', name: 'Pegasus', body: 'horse', rarity: 'legendarisk', colors: ['#ffffff', '#e6f4ff', '#7fd8ff'], wings: true, mane: true, bornFly: 0.7, bornRide: 0.5 },
  { id: 'fenix', name: 'Føniks', body: 'bird', rarity: 'legendarisk', colors: ['#ff5a1f', '#ffd23f', '#ff2e63'], wings: true, bornFly: 0.8 },
  { id: 'regnbuedino', name: 'Regnbue-dino', body: 'dino', rarity: 'legendarisk', colors: ['#c88bff', '#ffe14d', '#ff8fc7'], spots: true, bornRide: 0.6 },
];

export const SPECIES_BY_ID: Record<string, PetSpecies> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export interface EggType {
  id: string;
  name: string;
  price: number;
  color: string;
  spots: string;
  weights: Record<Rarity, number>;
}

export const EGGS: EggType[] = [
  { id: 'egg-start', name: 'Starteregg', price: 0, color: '#bfe9ff', spots: '#ffffff', weights: { vanlig: 70, uvanlig: 30, sjelden: 0, ultra: 0, legendarisk: 0 } },
  { id: 'egg-vanlig', name: 'Vanlig egg', price: 60, color: '#ffe8a8', spots: '#ffb84d', weights: { vanlig: 55, uvanlig: 30, sjelden: 12, ultra: 3, legendarisk: 0 } },
  { id: 'egg-eventyr', name: 'Eventyregg', price: 180, color: '#e2c6ff', spots: '#ff8fc7', weights: { vanlig: 15, uvanlig: 30, sjelden: 30, ultra: 18, legendarisk: 7 } },
  { id: 'egg-gull', name: 'Gullegg', price: 450, color: '#ffd23f', spots: '#fff4c2', weights: { vanlig: 0, uvanlig: 0, sjelden: 35, ultra: 40, legendarisk: 25 } },
];
export const EGG_BY_ID: Record<string, EggType> = Object.fromEntries(EGGS.map((e) => [e.id, e]));

export interface OwnedPet {
  uid: string;
  speciesId: string;
  name: string;
  flyable: boolean;
  rideable: boolean;
  obtainedAt: number;
}

export function rollRarity(egg: EggType, rng: Rng): Rarity {
  return pickWeighted(RARITY_ORDER, (r) => egg.weights[r], rng);
}

export function speciesOfRarity(r: Rarity): PetSpecies[] {
  return SPECIES.filter((s) => s.rarity === r);
}

export function hatch(eggId: string, rng: Rng, now = Date.now()): OwnedPet {
  const egg = EGG_BY_ID[eggId] ?? EGGS[0];
  const rarity = rollRarity(egg, rng);
  const pool = speciesOfRarity(rarity);
  const species = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return {
    uid: uid('pet'),
    speciesId: species.id,
    name: species.name,
    flyable: rng() < (species.bornFly ?? 0),
    rideable: rng() < (species.bornRide ?? 0),
    obtainedAt: now,
  };
}

export function cleanPetName(name: string, fallback: string): string {
  const n = name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return n || fallback;
}
