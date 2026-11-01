
import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../logic/avatar.ts';
import { createRoom, handleConnect, handleDisconnect, handleRawMessage } from './roomLogic.ts';
import { encode } from './protocol.ts';

const hello = (id: string, house?: { style: string; items: unknown[] }) =>
  encode({
    t: 'hello',
    v: 1,
    name: `Spiller${id}`,
    avatar: DEFAULT_AVATAR,
    playerId: `p${id}`,
    ...(house ? { house: house as never } : {}),
  });

describe('room plots and houses', () => {
  it('assigns unique plots 1..N and carries house furniture on hello', () => {
    const room = createRoom('ABCDE');
    handleConnect(room, 'a');
    handleConnect(room, 'b');
    handleConnect(room, 'c');
    const houseA = { style: 'villa' as const, items: [{ id: 'seng', x: 1, z: 2, rot: 0, floor: 0 }] };
    const houseB = { style: 'gard' as const, items: [{ id: 'sofa', x: 0, z: 0, rot: 0, floor: 0 }] };
    const outA = handleRawMessage(room, 'a', hello('A', houseA));
    const welcomeA = outA.find((o) => o.to === 'a' && o.msg.t === 'welcome');
    expect(welcomeA).toBeTruthy();
    const seatA = room.seats.get('a')!;
    expect(seatA.snap.plot).toBe(1);
    expect(seatA.snap.house?.style).toBe('villa');
    expect(seatA.snap.house?.items.length).toBe(1);

    const outB = handleRawMessage(room, 'b', hello('B', houseB));
    const welcomeB = outB.find((o) => o.msg.t === 'welcome')!;
    expect(welcomeB.msg.t).toBe('welcome');
    if (welcomeB.msg.t === 'welcome') {
      expect(welcomeB.msg.players).toHaveLength(1);
      expect(welcomeB.msg.players[0].plot).toBe(1);
      expect(welcomeB.msg.players[0].house?.items[0].id).toBe('seng');
    }
    expect(room.seats.get('b')!.snap.plot).toBe(2);

    handleRawMessage(room, 'c', hello('C'));
    expect(room.seats.get('c')!.snap.plot).toBe(3);

    // free plot on leave, next joiner reuses lowest free
    handleDisconnect(room, 'b');
    handleConnect(room, 'd');
    handleRawMessage(room, 'd', hello('D'));
    expect(room.seats.get('d')!.snap.plot).toBe(2);
  });
});
