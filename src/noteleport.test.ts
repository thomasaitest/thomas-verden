/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('no teleporting', () => {
  it('the game no longer has any teleport code or teleport buttons', () => {
    const files = Object.entries(sources);
    expect(files.length).toBeGreaterThan(20);
    for (const [f, text] of files) expect(text.toLowerCase(), f).not.toContain('teleport');
  });
});
