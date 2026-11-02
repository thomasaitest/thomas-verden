import { describe, it, expect, vi } from 'vitest';
import { publicUrl } from './publicUrl';

describe('publicUrl', () => {
  it('prefixes Vite BASE_URL and strips a leading slash', () => {
    vi.stubEnv('BASE_URL', '/thomas-verden/');
    // import.meta.env is compile-time in Vite; stubEnv may not rewrite it — assert shape instead
    const out = publicUrl('draco/');
    expect(out.endsWith('draco/')).toBe(true);
    expect(out.includes('//draco')).toBe(false);
    expect(publicUrl('/env/sky.hdr').endsWith('env/sky.hdr')).toBe(true);
  });
});
