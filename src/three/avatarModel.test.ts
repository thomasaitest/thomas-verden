import { beforeAll, describe, expect, it } from 'vitest';
import { ACCESSORIES, BOTTOMS, DEFAULT_AVATAR, FACES, HAIR_STYLES, HATS, SHIRT_PRINTS, SHOES } from '../logic/avatar.ts';
import { installDomStub } from '../test/domStub.ts';

let build: typeof import('./avatarModel.ts').buildAvatar;
beforeAll(async () => {
  installDomStub();
  build = (await import('./avatarModel.ts')).buildAvatar;
});

describe('avatar model', () => {
  it('builds with every single option (no crash, always has body, head, 2 legs and 2 arms)', () => {
    const variants = [
      ...HAIR_STYLES.map((o) => ({ hair: o.id })),
      ...FACES.map((o) => ({ face: o.id })),
      ...SHIRT_PRINTS.map((o) => ({ print: o.id })),
      ...BOTTOMS.map((o) => ({ bottom: o.id })),
      ...SHOES.map((o) => ({ shoeStyle: o.id })),
      ...HATS.map((o) => ({ hat: o.id })),
      ...ACCESSORIES.map((o) => ({ accessory: o.id })),
    ];
    expect(variants.length).toBeGreaterThan(60);
    for (const v of variants) {
      const rig = build({ ...DEFAULT_AVATAR, ...v } as typeof DEFAULT_AVATAR);
      expect(rig.legs.length, JSON.stringify(v)).toBe(2);
      expect(rig.arms.length).toBe(2);
      expect(rig.head).toBeTruthy();
    }
  });
});
