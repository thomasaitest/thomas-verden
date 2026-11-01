import { pickIndex, shuffle, type Rng } from './rng.ts';

export type ItemKind = 'life' | 'key' | 'magnifier';
export type DoorContent = { type: 'safe' } | { type: 'trap' } | { type: 'item'; item: ItemKind };

export interface Door {
  content: DoorContent;
  opened: boolean;
  /** Shown as a bad door by the magnifier. */
  revealed: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface DoorGame {
  level: number; // 0-based
  totalLevels: number;
  lives: number;
  keys: number;
  magnifiers: number;
  doors: Door[];
  status: GameStatus;
  /** Points earned so far in this run. */
  points: number;
  lastEvent: DoorEvent | null;
}

export type DoorEvent =
  | { type: 'safe' }
  | { type: 'item'; item: ItemKind }
  | { type: 'trap' }
  | { type: 'trap-blocked' } // a key saved the player
  | { type: 'revealed'; door: number };

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const TOTAL_LEVELS = 5;

export const POINTS = {
  perLevel: 5,
  perItem: 2,
  winBonus: 30,
  perLifeLeft: 10,
  consolation: 10,
} as const;

export const ITEM_INFO: Record<ItemKind, { name: string; emoji: string; text: string }> = {
  life: { name: 'Ekstra liv', emoji: '💖', text: 'Du fikk et ekstra liv!' },
  key: { name: 'Gullnøkkel', emoji: '🗝️', text: 'Gullnøkkelen redder deg fra én felle!' },
  magnifier: { name: 'Lupe', emoji: '🔍', text: 'Bruk lupen for å finne en skummel dør!' },
};

/** How a level is put together: more doors and traps further in. */
export function levelShape(level: number): { doors: number; traps: number } {
  if (level <= 1) return { doors: 3, traps: 1 };
  if (level <= 3) return { doors: 4, traps: 1 };
  return { doors: 4, traps: 2 };
}

export function makeDoors(level: number, rng: Rng): Door[] {
  const { doors, traps } = levelShape(level);
  const contents: DoorContent[] = [];
  for (let i = 0; i < traps; i++) contents.push({ type: 'trap' });
  // Most levels hide one helpful item.
  if (rng() < 0.75 && contents.length < doors) {
    const items: ItemKind[] = ['life', 'key', 'magnifier'];
    contents.push({ type: 'item', item: items[pickIndex(items.length, rng)] });
  }
  while (contents.length < doors) contents.push({ type: 'safe' });
  return shuffle(contents, rng).map((content) => ({ content, opened: false, revealed: false }));
}

export function newGame(rng: Rng, totalLevels = TOTAL_LEVELS): DoorGame {
  return {
    level: 0,
    totalLevels,
    lives: START_LIVES,
    keys: 0,
    magnifiers: 0,
    doors: makeDoors(0, rng),
    status: 'playing',
    points: 0,
    lastEvent: null,
  };
}

function advance(game: DoorGame, rng: Rng): DoorGame {
  const points = game.points + POINTS.perLevel;
  if (game.level + 1 >= game.totalLevels) {
    return { ...game, points: points + POINTS.winBonus + game.lives * POINTS.perLifeLeft, status: 'won' };
  }
  const level = game.level + 1;
  return { ...game, level, points, doors: makeDoors(level, rng) };
}

/**
 * Open a door. Safe and item doors move on to the next level. A trap costs a life
 * (or a key) and the player picks again on the same level. The door contents of
 * the returned game are the doors of the new level when the player moved on.
 */
export function openDoor(game: DoorGame, index: number, rng: Rng): DoorGame {
  if (game.status !== 'playing') return game;
  const door = game.doors[index];
  if (!door || door.opened || door.revealed) return game;
  const doors = game.doors.map((d, i) => (i === index ? { ...d, opened: true } : d));
  const opened = { ...game, doors };
  switch (door.content.type) {
    case 'safe':
      return advance({ ...opened, lastEvent: { type: 'safe' } }, rng);
    case 'item': {
      const item = door.content.item;
      const next = {
        ...opened,
        points: opened.points + POINTS.perItem,
        lives: item === 'life' ? Math.min(MAX_LIVES, opened.lives + 1) : opened.lives,
        keys: item === 'key' ? opened.keys + 1 : opened.keys,
        magnifiers: item === 'magnifier' ? opened.magnifiers + 1 : opened.magnifiers,
        lastEvent: { type: 'item', item } as DoorEvent,
      };
      return advance(next, rng);
    }
    case 'trap': {
      if (opened.keys > 0) return { ...opened, keys: opened.keys - 1, lastEvent: { type: 'trap-blocked' } };
      const lives = opened.lives - 1;
      if (lives <= 0) return { ...opened, lives: 0, status: 'lost', points: POINTS.consolation + opened.points, lastEvent: { type: 'trap' } };
      return { ...opened, lives, lastEvent: { type: 'trap' } };
    }
  }
}

/** Use a magnifier to mark one unopened trap door on this level. */
export function useMagnifier(game: DoorGame, rng: Rng): DoorGame {
  if (game.status !== 'playing' || game.magnifiers <= 0) return game;
  const hidden = game.doors.map((d, i) => ({ d, i })).filter(({ d }) => d.content.type === 'trap' && !d.opened && !d.revealed);
  if (hidden.length === 0) return game;
  const target = hidden[pickIndex(hidden.length, rng)].i;
  return {
    ...game,
    magnifiers: game.magnifiers - 1,
    doors: game.doors.map((d, i) => (i === target ? { ...d, revealed: true } : d)),
    lastEvent: { type: 'revealed', door: target },
  };
}
