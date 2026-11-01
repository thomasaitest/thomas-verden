import { describe, expect, it } from 'vitest';
import { ACCESSORIES, BOTTOMS, CLOTH_COLORS, cleanAvatar, DEFAULT_AVATAR, FACES, HAIR_COLORS, HAIR_STYLES, HATS, randomAvatar, SHIRT_PRINTS, SHOES, SKIN } from './avatar.ts';
import { seeded } from './rng.ts';

const lists = { HAIR_STYLES, FACES, SHIRT_PRINTS, BOTTOMS, SHOES, HATS, ACCESSORIES };

describe('avatar options', () => {
  it('has a rich set of choices (more than the first version)', () => {
    expect(HAIR_STYLES.length).toBeGreaterThanOrEqual(14);
    expect(FACES.length).toBeGreaterThanOrEqual(13);
    expect(SHIRT_PRINTS.length).toBeGreaterThanOrEqual(9);
    expect(HATS.length).toBeGreaterThanOrEqual(15);
    expect(ACCESSORIES.length).toBeGreaterThanOrEqual(20);
    expect(BOTTOMS.length).toBeGreaterThanOrEqual(10);
    expect(SHOES.length).toBe(3);
    expect(SKIN.length).toBeGreaterThanOrEqual(12);
    expect(HAIR_COLORS.length).toBeGreaterThanOrEqual(17);
    expect(CLOTH_COLORS.length).toBeGreaterThanOrEqual(18);
  });
  it('every option has a unique id and a Norwegian name', () => {
    for (const [k, list] of Object.entries(lists)) {
      const ids = list.map((o) => o.id);
      expect(new Set(ids).size, k).toBe(ids.length);
      for (const o of list) expect(o.name.length, `${k}:${o.id}`).toBeGreaterThan(1);
    }
  });
  it('an avatar saved before the new options existed still loads, with defaults for the new parts', () => {
    const { bottom: _b, shoeStyle: _s, ...old } = DEFAULT_AVATAR;
    const a = cleanAvatar({ ...old, hair: 'kort' });
    expect(a.hair).toBe('kort');
    expect(a.bottom).toBe('bukse');
    expect(a.shoeStyle).toBe('sko');
  });
  it('unknown or malicious values fall back to defaults, new ids are accepted', () => {
    const a = cleanAvatar({ hair: 'afro', face: 'sovnig', print: 'lyn', bottom: 'skjort', shoeStyle: 'stovler', hat: 'pirat', accessory: 'sommerfugl', skin: 'red', shirt: '<b>' });
    expect([a.hair, a.face, a.print, a.bottom, a.shoeStyle, a.hat, a.accessory]).toEqual(['afro', 'sovnig', 'lyn', 'skjort', 'stovler', 'pirat', 'sommerfugl']);
    expect(a.skin).toBe(DEFAULT_AVATAR.skin);
    expect(a.shirt).toBe(DEFAULT_AVATAR.shirt);
    expect(cleanAvatar({ hair: 'nope', bottom: 5 }).hair).toBe(DEFAULT_AVATAR.hair);
  });
  it('random avatars only use valid options and use the new ones sometimes', () => {
    const rng = seeded(5);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const a = randomAvatar(rng);
      expect(cleanAvatar(a)).toEqual(a);
      seen.add(a.hair);
      seen.add(a.bottom);
    }
    expect(seen.has('afro') || seen.has('totter') || seen.has('hanekam')).toBe(true);
    expect(seen.has('skjort')).toBe(true);
  });
});
