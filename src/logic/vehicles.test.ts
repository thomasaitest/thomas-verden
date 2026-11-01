import { describe, expect, it } from 'vitest';
import { freshSave } from './save.ts';
import { canDrive, canPram, defaultCar, defaultPram, ownedCars, vehicleSpeed } from './vehicles.ts';

describe('vehicles', () => {
  it('detects owned cars and prams from the bag', () => {
    let s = freshSave(0);
    expect(ownedCars(s)).toHaveLength(0);
    s = { ...s, bag: { ...s.bag, 'bil-rosa': 1, 'vogn-rosa': 1 } };
    expect(defaultCar(s)).toBe('bil-rosa');
    expect(defaultPram(s)).toBe('vogn-rosa');
    expect(canDrive(s, 'bil-rosa')).toBe(true);
    expect(canPram(s, 'vogn-rosa')).toBe(true);
  });
  it('picks drive speed over walk', () => {
    expect(vehicleSpeed({ driving: true, pramming: false, riding: false, flying: false })).toBeGreaterThan(
      vehicleSpeed({ driving: false, pramming: false, riding: false, flying: false }),
    );
  });
});
