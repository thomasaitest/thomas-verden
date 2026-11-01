import { describe, expect, it } from 'vitest';
import { EQUIPMENT, EQUIP_BY_ID, MERRY, SIT_DROP, SLIDE, SLIDE_CYCLE, canUse, merryAngle, nearestEquip, seatAt, seesawAngle, slideState, swingAngle, wantsOff } from './playground.ts';

const CYCLE = SLIDE_CYCLE.wait + SLIDE_CYCLE.down + SLIDE_CYCLE.rest + SLIDE_CYCLE.up;
const times = (n: number, to: number) => Array.from({ length: n }, (_, i) => (i / (n - 1)) * to);

describe('playground equipment: seats', () => {
  it('has a swing (two), slide, seesaw and merry-go-round, each with a free exit', () => {
    expect(EQUIPMENT.map((e) => e.kind).sort()).toEqual(['merry', 'seesaw', 'slide', 'swing', 'swing', 'tramp']);
    for (const e of EQUIPMENT) expect(Math.hypot(e.exit.x - e.x, e.exit.z - e.z)).toBeGreaterThan(0.8);
  });

  it('every piece gives a finite seat at any time', () => {
    for (const e of EQUIPMENT) for (const u of times(200, 40)) {
      const s = seatAt(e.id, u);
      for (const v of [s.x, s.y, s.z, s.yaw, s.tilt, s.focus.x, s.focus.y, s.focus.z]) expect(Number.isFinite(v), `${e.id} @${u}`).toBe(true);
      expect(s.y, `${e.id} stays off the ground`).toBeGreaterThan(-SIT_DROP);
    }
  });

  it('a stranger id is a mistake, not a silent origin', () => {
    expect(() => seatAt('trampoline', 0)).toThrow();
  });

  it('swing: starts at rest under the bar and swings back and forth, always hanging below the bar', () => {
    const rest = seatAt('swing1', 0);
    expect(rest.z).toBeCloseTo(-3, 5);
    expect(rest.y + SIT_DROP).toBeCloseTo(5 - 3.2 + 0.1, 5);
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const u of times(400, 12)) {
      const s = seatAt('swing1', u);
      minZ = Math.min(minZ, s.z);
      maxZ = Math.max(maxZ, s.z);
      expect(s.y + SIT_DROP).toBeLessThan(5);
      expect(s.x).toBeCloseTo(2.8, 6);
      // the avatar leans with the ropes
      expect(s.tilt).toBeCloseTo(-swingAngle(u), 6);
    }
    expect(maxZ - minZ).toBeGreaterThan(3); // really swings
    expect(minZ).toBeLessThan(-3);
    expect(maxZ).toBeGreaterThan(-3);
    expect(Math.abs(swingAngle(1000))).toBeLessThan(0.71); // never loops over the bar
  });

  it('slide: top, down to the bottom, then walks back up, in a loop that never jumps', () => {
    const top = seatAt('slide', 0);
    const bottom = seatAt('slide', SLIDE_CYCLE.wait + SLIDE_CYCLE.down + 0.05);
    expect(top.pose).toBe('slide');
    expect(top.y).toBeGreaterThan(bottom.y + 2);
    expect(bottom.z).toBeGreaterThan(top.z + 3);
    const poses = new Set(times(300, CYCLE * 2).map((u) => seatAt('slide', u).pose));
    expect(poses).toEqual(new Set(['slide', 'walk']));
    // continuous: no frame-to-frame jump bigger than the fastest movement allows
    let prev = seatAt('slide', 0);
    for (let i = 1; i <= 2000; i++) {
      const s = seatAt('slide', (i / 2000) * CYCLE * 2);
      const stepped = prev.pose !== s.pose;
      const d = Math.hypot(s.x - prev.x, s.y - prev.y, s.z - prev.z);
      if (!stepped) expect(d).toBeLessThan(0.25);
      prev = s;
    }
    // the rider always stays over the ramp (x on the ramp line, z between the tower and the end)
    for (const u of times(300, CYCLE)) {
      const s = seatAt('slide', u);
      expect(s.x).toBeCloseTo(SLIDE.x, 6);
      expect(s.z).toBeGreaterThan(-3);
      expect(s.z).toBeLessThan(3.5);
    }
  });

  it('slide: the cycle repeats exactly', () => {
    for (const u of [0.2, 0.9, 1.7, 2.6, 3.3]) expect(slideState(u + CYCLE).s).toBeCloseTo(slideState(u).s, 9);
  });

  it('seesaw: the seat goes up and down with the plank and stays at its end', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const u of times(300, 10)) {
      const s = seatAt('seesaw', u);
      lo = Math.min(lo, s.y);
      hi = Math.max(hi, s.y);
      expect(s.z).toBeCloseTo(5.5, 6);
      expect(s.x).toBeGreaterThan(-4 + 1.9);
      expect(s.x).toBeLessThan(-4 + 2.4);
      expect(Math.abs(seesawAngle(u))).toBeLessThanOrEqual(0.24 + 1e-9);
    }
    expect(hi - lo).toBeGreaterThan(0.8);
    expect(lo).toBeGreaterThan(-SIT_DROP + 0.3);
  });

  it('merry-go-round: the rider goes round on the disc at a constant radius, facing the way it moves', () => {
    for (const u of times(300, 20)) {
      const s = seatAt('merry', u);
      expect(Math.hypot(s.x - MERRY.x, s.z - MERRY.z)).toBeCloseTo(MERRY.rider, 6);
      expect(MERRY.rider).toBeLessThan(MERRY.radius);
      expect(s.y + SIT_DROP).toBeCloseTo(MERRY.y + MERRY.thick / 2, 6);
    }
    // really turns, and faster over time until it reaches speed
    expect(merryAngle(5) - merryAngle(4)).toBeGreaterThan(merryAngle(1) - merryAngle(0));
    const a = seatAt('merry', 3);
    const b = seatAt('merry', 3.01);
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    expect(Math.sin(a.yaw) * vx + Math.cos(a.yaw) * vz).toBeGreaterThan(0.9 * Math.hypot(vx, vz));
  });
});

describe('playground equipment: using it', () => {
  it('the nearest piece within reach is chosen, none far away', () => {
    expect(nearestEquip(2.8, -1.5)?.id).toBe('swing1');
    expect(nearestEquip(5.2, -1.5)?.id).toBe('swing2');
    expect(nearestEquip(-4, 3.4)?.id).toBe('slide');
    expect(nearestEquip(-4, 7.1)?.id).toBe('seesaw');
    expect(nearestEquip(0, 4.8)?.id).toBe('merry');
    expect(nearestEquip(40, 40)).toBeNull();
    expect(nearestEquip(0, -9)).toBeNull();
  });

  it('every exit spot is within reach of its own piece (you can always use it again)', () => {
    for (const e of EQUIPMENT) expect(Math.hypot(e.exit.x - e.x, e.exit.z - e.z)).toBeLessThanOrEqual(e.reach);
    for (const e of EQUIPMENT) expect(nearestEquip(e.exit.x, e.exit.z), e.id).not.toBeNull();
  });

  it('moving the stick or jumping gets you off; standing still and tiny stick drift do not', () => {
    expect(wantsOff({ x: 0, y: 0 }, false)).toBe(false);
    expect(wantsOff({ x: 0.1, y: -0.05 }, false)).toBe(false);
    expect(wantsOff({ x: 0, y: -1 }, false)).toBe(true);
    expect(wantsOff({ x: 0.6, y: 0.6 }, false)).toBe(true);
    expect(wantsOff({ x: 0, y: 0 }, true)).toBe(true);
  });

  it('you cannot climb on while riding, carrying an animal, flying or in a menu', () => {
    const free = { riding: false, holding: false, flying: false, paused: false };
    expect(canUse(free)).toBe(true);
    for (const k of ['riding', 'holding', 'flying', 'paused'] as const) expect(canUse({ ...free, [k]: true }), k).toBe(false);
  });

  it('ids are unique and found by id', () => {
    expect(new Set(EQUIPMENT.map((e) => e.id)).size).toBe(EQUIPMENT.length);
    for (const e of EQUIPMENT) expect(EQUIP_BY_ID[e.id]).toBe(e);
  });
});
