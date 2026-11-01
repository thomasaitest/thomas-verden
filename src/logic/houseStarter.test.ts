import { describe, expect, it } from 'vitest';
import { HOUSES } from './catalog.ts';
import { ensureStarterFurniture, hasHumanBed, hasTable, migrateFurnitureClearOfWalls, newHouse, starterSpots } from './house.ts';
import { itemBlocked, itemRadius, houseLayout, roomAt } from './layout.ts';
import { freshSave, parseSave } from './save.ts';

describe('starter furniture', () => {
  it('new houses include a bed and a table', () => {
    const h = newHouse('hytte', 'p1');
    expect(hasHumanBed(h.items)).toBe(true);
    expect(hasTable(h.items)).toBe(true);
    expect(h.items.some((i) => i.itemId === 'seng')).toBe(true);
    expect(h.items.some((i) => i.itemId === 'spisebord')).toBe(true);
  });

  it('ensureStarterFurniture adds missing bed/table once only', () => {
    const h = newHouse('hytte', 'p1');
    const stripped = { ...h, items: h.items.filter((i) => i.itemId !== 'seng' && i.itemId !== 'spisebord') };
    expect(hasHumanBed(stripped.items)).toBe(false);
    const fixed = ensureStarterFurniture(stripped);
    expect(hasHumanBed(fixed.items)).toBe(true);
    expect(hasTable(fixed.items)).toBe(true);
    const again = ensureStarterFurniture(fixed);
    expect(again.items.filter((i) => i.itemId === 'seng').length).toBe(1);
    expect(again.items.filter((i) => i.itemId === 'spisebord').length).toBe(1);
  });

  it('parseSave migrates old houses without duplicating', () => {
    const s = freshSave();
    const bare = {
      ...s,
      houses: s.houses.map((h) => ({
        ...h,
        items: h.items.filter((i) => i.itemId !== 'seng' && i.itemId !== 'spisebord'),
      })),
    };
    const json = JSON.stringify(bare);
    const loaded = parseSave(json);
    const house = loaded.houses[0];
    expect(hasHumanBed(house.items)).toBe(true);
    expect(hasTable(house.items)).toBe(true);
    const again = parseSave(JSON.stringify(loaded));
    expect(again.houses[0].items.filter((i) => i.itemId === 'seng').length).toBe(1);
  });

  it.each(HOUSES.map((h) => h.style))('style %s has reachable bed+table clear of walls', (style) => {
    const h = newHouse(style, 'p1');
    const L = houseLayout(style);
    const bed = h.items.find((i) => i.itemId === 'seng')!;
    const table = h.items.find((i) => i.itemId === 'spisebord')!;
    expect(itemBlocked(L, 0, bed.x, bed.z, itemRadius(2.2, 1) - 0.05)).toBe(false);
    expect(itemBlocked(L, 0, table.x, table.z, itemRadius(2.0, 1) - 0.05)).toBe(false);
    const bedRoom = roomAt(L, 0, bed.x, bed.z);
    const tableRoom = roomAt(L, 0, table.x, table.z);
    expect(bedRoom?.name).toMatch(/Soverom|Master|Lugar|Kongesuite|Prinsesse/i);
    expect(tableRoom?.name).toMatch(/Stue|Salon|Festsal|Salong|Dekk/i);
    const spots = starterSpots(style);
    expect(Math.hypot(spots.bed.x - spots.table.x, spots.bed.z - spots.table.z)).toBeGreaterThan(2);
  });

  it.each(HOUSES.map((h) => h.style))('migrateFurnitureClearOfWalls keeps items legal for %s', (style) => {
    const base = newHouse(style, 'p1');
    // Simulate pre-layout-change furniture jammed into a wall / stair mid.
    const L = houseLayout(style);
    const jammed = {
      ...base,
      items: [
        ...base.items,
        { uid: 'jam1', itemId: 'sofa', x: L.walls[0][0]?.x ?? 0, z: L.walls[0][0]?.z ?? 0, rot: 0, scale: 1, color: '#fff', floor: 0 },
        { uid: 'jam2', itemId: 'sofa', x: (L.stairs.x0 + L.stairs.x1) / 2, z: (L.stairs.zTop + L.stairs.zBottom) / 2, rot: 0, scale: 1, color: '#fff', floor: 0 },
      ],
    };
    const fixed = migrateFurnitureClearOfWalls(jammed);
    for (const it of fixed.items) {
      if (it.uid === 'jam1' || it.uid === 'jam2' || it.itemId === 'seng' || it.itemId === 'spisebord') {
        // Migrated centre must leave the stair footprint / wall solid; use a conservative radius.
        expect(itemBlocked(L, it.floor, it.x, it.z, 0.35), `${it.uid} still blocked`).toBe(false);
      }
    }
    const jam2 = fixed.items.find((i) => i.uid === 'jam2')!;
    expect(Math.hypot(jam2.x - (L.stairs.x0 + L.stairs.x1) / 2, jam2.z - (L.stairs.zTop + L.stairs.zBottom) / 2)).toBeGreaterThan(1);
  });
});
