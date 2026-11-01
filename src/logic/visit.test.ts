import { describe, expect, it } from 'vitest';
import { acceptVisit, canAskVisit, declineOrCancel, receiveAsk, startAsk, tickVisit, VISIT_TIMEOUT_MS } from './visit.ts';

describe('visit permission', () => {
  it('ask → accept as visitor enters', () => {
    let v = startAsk('owner1', 'Ada', 'sock-a', 1000);
    expect(v.status).toBe('asking');
    v = acceptVisit(v, 2000);
    expect(v.status).toBe('inside');
  });
  it('owner incoming accept returns to idle (guest comes in)', () => {
    let v = receiveAsk('vis1', 'Bo', 'sock-b', 1000);
    expect(v.status).toBe('incoming');
    v = acceptVisit(v, 2000);
    expect(v.status).toBe('idle');
  });
  it('decline and timeout clear state', () => {
    expect(declineOrCancel(startAsk('o', 'A', 's', 0)).status).toBe('idle');
    expect(tickVisit(startAsk('o', 'A', 's', 0), VISIT_TIMEOUT_MS + 1).status).toBe('idle');
  });
  it('canAskVisit needs town + door + not busy', () => {
    expect(canAskVisit({ inTown: true, nearFriendDoor: true, alreadyVisiting: false, driving: false, paused: false })).toBe(true);
    expect(canAskVisit({ inTown: true, nearFriendDoor: true, alreadyVisiting: false, driving: true, paused: false })).toBe(false);
  });
});
