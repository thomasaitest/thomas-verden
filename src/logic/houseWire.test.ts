import { describe, expect, it } from 'vitest';
import { newHouse } from './house.ts';
import { guestHouseFromWire, houseToWire, parseHouseWire } from './houseWire.ts';

describe('house wire', () => {
  it('roundtrips style and furniture', () => {
    const h = newHouse('villa', 'owner', 0);
    const w = houseToWire(h);
    expect(w.style).toBe('villa');
    expect(w.items.length).toBeGreaterThan(0);
    const back = parseHouseWire(w);
    expect(back?.style).toBe('villa');
    const guest = guestHouseFromWire('owner', back!);
    expect(guest.ownerId).toBe('owner');
    expect(guest.items[0].itemId).toBe(w.items[0].id);
  });

  it('sparse wire still gets starter bed and table for visitors', () => {
    const guest = guestHouseFromWire('owner', { style: 'hytte', items: [], locked: false });
    expect(guest.items.some((i) => i.itemId === 'seng')).toBe(true);
    expect(guest.items.some((i) => i.itemId === 'spisebord')).toBe(true);
  });

  it('does not duplicate bed/table already on the wire', () => {
    const h = newHouse('hytte', 'owner', 0);
    const w = houseToWire(h);
    const guest = guestHouseFromWire('owner', w);
    expect(guest.items.filter((i) => i.itemId === 'seng').length).toBe(1);
    expect(guest.items.filter((i) => i.itemId === 'spisebord').length).toBe(1);
  });
});
