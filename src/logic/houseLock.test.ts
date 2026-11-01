import { describe, expect, it } from 'vitest';
import { canEnterHouse, doorLockStatus, doorPrompt, lockLabel } from './houseLock.ts';

describe('house lock', () => {
  it('owner can always enter; others only when unlocked', () => {
    expect(canEnterHouse({ locked: true, isOwner: true })).toBe(true);
    expect(canEnterHouse({ locked: false, isOwner: true })).toBe(true);
    expect(canEnterHouse({ locked: true, isOwner: false })).toBe(false);
    expect(canEnterHouse({ locked: false, isOwner: false })).toBe(true);
  });
  it('prompts and lock labels are Norwegian', () => {
    expect(lockLabel(false)).toMatch(/Lås huset/);
    expect(lockLabel(true)).toMatch(/Lås opp/);
    expect(doorPrompt({ locked: true, isOwner: false })).toMatch(/Låst/);
    expect(doorPrompt({ locked: false, isOwner: false, ownerName: 'Hedda' })).toMatch(/Besøk/);
    expect(doorPrompt({ locked: false, isOwner: false, ownerName: 'Hedda' })).toMatch(/Hedda/);
  });
  it('doorLockStatus is clear for kids', () => {
    expect(doorLockStatus(true)).toMatch(/Låst/);
    expect(doorLockStatus(false)).toMatch(/Åpen/);
  });
});
