import { describe, expect, it } from 'vitest';
import { buyHouse } from './economy.ts';
import { freshSave } from './save.ts';
import { HOUSES } from './catalog.ts';
import { sameVisibility, surfaceUnder, clearsAt, type Surface } from './collision.ts';

describe('house ownership', () => {
  it('buys and switches houses; each style is owned once', () => {
    let s = freshSave(1);
    expect(s.houses).toHaveLength(1);
    s = { ...s, bucks: 99999 };
    for (const h of HOUSES.filter((x) => x.price > 0).slice(0, 3)) {
      const r = buyHouse(s, h.style, 2);
      expect(r.ok).toBe(true);
      s = r.save;
      expect(s.houses.some((x) => x.style === h.style)).toBe(true);
      expect(s.activeHouseId).toBe(s.houses.find((x) => x.style === h.style)!.id);
    }
    const again = buyHouse(s, HOUSES[1].style, 3);
    expect(again.ok).toBe(true);
    expect(again.save.houses.filter((h) => h.style === HOUSES[1].style)).toHaveLength(1);
  });
});

describe('area visibility', () => {
  it('hides town players from someone inside a private house', () => {
    expect(sameVisibility('house', 'p1', 'town', null)).toBe(false);
    expect(sameVisibility('town', null, 'house', 'p1')).toBe(false);
    expect(sameVisibility('house', 'p1', 'house', 'p1')).toBe(true);
    expect(sameVisibility('house', 'p1', 'house', 'p2')).toBe(false);
    expect(sameVisibility('town', null, 'shop', null)).toBe(true);
  });
});

describe('jump clear + surfaces', () => {
  it('clears low benches when airborne above their top', () => {
    expect(clearsAt(0, 1)).toBe(false);
    expect(clearsAt(1.05, 1)).toBe(true);
  });
  it('finds the highest landable surface under the player', () => {
    const surfaces: Surface[] = [
      { x: 0, z: 0, r: 4, top: 1.15 },
      { x: 0, z: 0, r: 2, top: 3.85 },
    ];
    expect(surfaceUnder(0, 0, 4, surfaces)).toBe(3.85);
    expect(surfaceUnder(3, 0, 1.5, surfaces)).toBe(1.15);
    expect(surfaceUnder(10, 0, 2, surfaces)).toBeNull();
  });
});
