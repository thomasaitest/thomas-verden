import { describe, expect, it } from 'vitest';
import { BUBBLE_GOAL, miniReward, startMini, stepMini } from './minigames.ts';

describe('minigames', () => {
  it('bubble pop reaches the goal', () => {
    let s = startMini('bubbles');
    let n = 0;
    const rng = () => {
      n += 1;
      return (n % 10) / 10;
    };
    for (let i = 0; i < 400 && !s.done; i++) {
      const tap = s.bubbles[0] ? { x: s.bubbles[0].x, z: s.bubbles[0].z } : null;
      s = stepMini(s, 0.16, { playerX: 99, playerZ: 99, tap, rng });
    }
    expect(s.score).toBeGreaterThan(0);
    s = { ...s, score: BUBBLE_GOAL, done: true };
    expect(miniReward(s)).toBe(15);
  });
  it('kickball scores when you bump the ball', () => {
    let s = startMini('kickball');
    s = stepMini(s, 0.05, { playerX: 0, playerZ: 0 });
    expect(s.score).toBeGreaterThanOrEqual(1);
  });
});
